import React, { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../services/api";
import BackButton from "../../../components/BackButton";
import './GenerationWebPage.css'

export interface GenWebItem {
  id: string;
  src: string;
  title: string;
  caption?: string;
  /** 0–1, optional manual width hint relative to the base tile size */
  scale?: number;
}

export interface GenerationWebPageProps {
  /** Items to scatter across the canvas */
  items: GenWebItem[];
  /** Centre title, e.g. brand / project name */
  heading?: string;
  /** Centre subtitle under the heading */
  subheading?: string;
  /** Top-left label, e.g. a year or copyright mark */
  topLeftLabel?: string;
  /** Top-centre label, e.g. brand name */
  topCenterLabel?: string;
  /** Top-right label, e.g. "INFO" */
  topRightLabel?: string;
  /** Bottom-left label, e.g. "DARK MODE" */
  bottomLeftLabel?: string;
  /** Bottom-centre label */
  bottomCenterLabel?: string;
  /** Bottom-right label, e.g. "INDEX" */
  bottomRightLabel?: string;
  /** Called when a corner control is clicked */
  onTopRightClick?: () => void;
  onBottomLeftClick?: () => void;
  onBottomRightClick?: () => void;
  /** Called when an item is clicked (in addition to click-to-focus) */
  onItemClick?: (item: GenWebItem) => void;
  /** How many items appear per scattered "page". Scrolling pages through the rest. Default 12 */
  itemsPerPage?: number;
  /**
   * Called when the editor picks a file via the "Replace" button in the
   * focused-image toolbar. If provided, the returned URL (once resolved)
   * replaces the local preview — this is how a replace gets PERSISTED
   * (uploaded + saved as this item's board placement) instead of only
   * existing as a local object URL that vanishes on refresh.
   */
  onImageReplace?: (item: GenWebItem, file: File) => Promise<string | void>;
  /**
   * Called when a title/caption input loses focus, with the item and
   * its current (possibly edited) title + caption. This is how text
   * edits get PERSISTED — without this, itemTexts is local-only state
   * that vanishes on refresh and is never seen by the customer side.
   */
  onTextSave?: (item: GenWebItem, title: string, caption: string) => void;
  /** Called when the centre heading/subheading textareas lose focus. */
  onHeadingSave?: (heading: string, subheading: string) => void;
  /**
   * Called when the editor finishes adjusting an item's zoom/pan (Done or
   * Reset in the focused-image toolbar), with the item and its current
   * {scale,x,y}. Without this, the zoom/pan slider is local-only state
   * that vanishes on refresh and never reaches the customer side.
   */
  onImageEditSave?: (item: GenWebItem, edit: ImageEdit) => void;
  /** Seeds per-item zoom/pan state on mount (e.g. from a previous save),
   * so reopening the editor resumes where the last session left off. */
  initialImageEdits?: Record<string, ImageEdit>;
}

/* ------------------------- Layout engine -------------------------- */
/**
 * Deterministic pseudo-random scatter so the same item list always
 * produces the same layout (no layout shift between renders).
 */
function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface PlacedItem extends GenWebItem {
  top: number; // %
  left: number; // %
  baseWidth: number; // px at 1440 reference width
  rotate: number; // deg, very slight
  floatDuration: number; // seconds, one full drift loop
  floatDelay: number; // seconds, negative to desync start phase
  floatX: number; // px, horizontal drift amplitude
  floatY: number; // px, vertical drift amplitude
  floatRotate: number; // deg, rotational drift amplitude
}

function scatterLayout(items: GenWebItem[]): PlacedItem[] {
  const rand = seededRandom(items.length * 97 + 13);

  // Loose grid of cells we shuffle items into, then jitter within
  // each cell so images feel hand-placed rather than gridded.
  const cols = 7;
  const rows = Math.ceil(items.length / cols) + 1;
  const cellW = 100 / cols;
  const cellH = 100 / rows;

  const cells: { row: number; col: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Skip the dead-centre cell(s) reserved for the heading
      const isCenter =
        r === Math.floor(rows / 2) &&
        (c === Math.floor(cols / 2) || c === Math.floor(cols / 2) - 1);
      if (!isCenter) cells.push({ row: r, col: c });
    }
  }

  // Shuffle cells deterministically
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  return items.map((item, i) => {
    const cell = cells[i % cells.length];
    const jitterX = (rand() - 0.5) * cellW * 0.32;
    const jitterY = (rand() - 0.5) * cellH * 0.32;

    const top = Math.min(
      92,
      Math.max(6, cell.row * cellH + cellH / 2 + jitterY)
    );
    const left = Math.min(
      94,
      Math.max(4, cell.col * cellW + cellW / 2 + jitterX)
    );

    const sizeRoll = rand();
    const baseWidth =
      item.scale != null
        ? 90 * item.scale
        : sizeRoll > 0.82
        ? 150
        : sizeRoll > 0.5
        ? 110
        : 80;

    const rotate = (rand() - 0.5) * 2.4;

    // Ambient idle drift: each tile loops a slow, gentle float with its
    // own randomized speed/phase/amplitude so the whole canvas feels
    // alive without ever moving in lockstep.
    const floatDuration = 9 + rand() * 10; // 9s–19s per loop
    const floatDelay = -rand() * floatDuration; // negative = random start phase
    const floatX = (rand() - 0.5) * 22; // px
    const floatY = (rand() - 0.5) * 22; // px
    const floatRotate = (rand() - 0.5) * 3; // deg

    return {
      ...item,
      top,
      left,
      baseWidth,
      rotate,
      floatDuration,
      floatDelay,
      floatX,
      floatY,
      floatRotate,
    };
  });
}

/* --------------------- Centered focus geometry --------------------- */
/**
 * Width/height (px) the focused image grows to, centered in the canvas.
 * Kept in one place so the JS (rect math) and CSS (clamp sizing) agree.
 */
function getFocusSize(viewportW: number) {
  if (viewportW <= 720) {
    return { w: Math.min(320, viewportW * 0.78), h: Math.min(320, viewportW * 0.78) * 0.75 };
  }
  const w = Math.min(520, Math.max(320, viewportW * 0.3));
  return { w, h: w * 0.75 };
}

/* --------------------- Per-item image crop/edit --------------------- */
interface ImageEdit {
  scale: number; // 1 = no zoom
  x: number; // % translate, -50..50
  y: number; // % translate, -50..50
  src?: string; // overridden image (replaced by user upload)
}

/* ------------------------------ View ------------------------------ */

export const GenerationWebPage: React.FC<GenerationWebPageProps> = ({
  items,
  heading = "KIRAN PATEL",
  subheading = "CHARACTER, BUILT QUARTER BY QUARTER (©2025)",

  topCenterLabel = "KIRAN PATEL",

  onBottomLeftClick,
  onBottomRightClick,
  onItemClick,
  itemsPerPage = 12,
  onImageReplace,
  onTextSave,
  onHeadingSave,
  onImageEditSave,
  initialImageEdits,
}) => {
  // Split items into pages; each page gets its own deterministic scatter.
  const pages = useMemo(() => {
    const chunks: GenWebItem[][] = [];
    for (let i = 0; i < items.length; i += itemsPerPage) {
      chunks.push(items.slice(i, i + itemsPerPage));
    }
    return chunks.length > 0 ? chunks : [[]];
  }, [items, itemsPerPage]);

  const placedPages = useMemo(
    () => pages.map((pageItems) => scatterLayout(pageItems)),
    [pages]
  );

  const [pageIndex, setPageIndex] = useState(0);
  // Editable heading/subheading text — starts from the props but the
  // user can type directly into them (see the textareas in the render
  // below), so we need local state rather than reading `heading`/
  // `subheading` straight from props.
  const [headingText, setHeadingText] = useState(heading);
  const [subheadingText, setSubheadingText] = useState(subheading);
  const headingRef = useRef<HTMLTextAreaElement | null>(null);
  const subheadingRef = useRef<HTMLTextAreaElement | null>(null);

  // `heading`/`subheading` arrive as props that may update asynchronously
  // (once the wrapper's fetch resolves, after this component already
  // mounted with the hardcoded default) — useState's initial value only
  // applies once, so without this the fetched text would never show.
  useEffect(() => { setHeadingText(heading); }, [heading]);
  useEffect(() => { setSubheadingText(subheading); }, [subheading]);

  // `initialImageEdits` arrives asynchronously too (after the wrapper's
  // board-quotes fetch resolves) — merge it in without clobbering any
  // edit already made locally in this session.
  useEffect(() => {
    if (initialImageEdits && Object.keys(initialImageEdits).length > 0) {
      setImageEdits((prev) => ({ ...initialImageEdits, ...prev }));
    }
  }, [initialImageEdits]);

  // ---- Editable per-item title/caption text -------------------------
  // Keyed by item id, seeded lazily from item.title / item.caption the
  // first time an item is edited. Mirrors the heading/subheading
  // pattern above but scoped per-tile.
  const [itemTexts, setItemTexts] = useState<Record<string, { title: string; caption: string }>>(
    {}
  );

  const getItemText = useCallback(
    (item: GenWebItem) => itemTexts[item.id] ?? { title: item.title, caption: item.caption ?? "" },
    [itemTexts]
  );

  const updateItemText = useCallback(
    (item: GenWebItem, field: "title" | "caption", value: string) => {
      setItemTexts((prev) => {
        const base = prev[item.id] ?? { title: item.title, caption: item.caption ?? "" };
        return { ...prev, [item.id]: { ...base, [field]: value } };
      });
    },
    []
  );

  // Fires on blur of any title/caption input — reads the just-committed
  // itemTexts value (blur always happens after the triggering onChange's
  // setState has flushed) and hands it off to the parent to persist.
  const handleTextBlur = useCallback(
    (item: GenWebItem) => {
      if (!onTextSave) return;
      const text = itemTexts[item.id] ?? { title: item.title, caption: item.caption ?? "" };
      onTextSave(item, text.title, text.caption);
    },
    [itemTexts, onTextSave]
  );

  // ---- Image crop / pan / zoom / replace per item --------------------
  const [imageEdits, setImageEdits] = useState<Record<string, ImageEdit>>(
    initialImageEdits ?? {}
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const getImageEdit = useCallback(
    (id: string): ImageEdit => imageEdits[id] ?? { scale: 1, x: 0, y: 0 },
    [imageEdits]
  );

  const updateImageEdit = useCallback((id: string, patch: Partial<ImageEdit>) => {
    setImageEdits((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? { scale: 1, x: 0, y: 0 }), ...patch },
    }));
  }, []);

  const resetImageEdit = useCallback((id: string) => {
    setImageEdits((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  // Auto-grow a textarea to fit its content (no scrollbar, no fixed
  // row count) — called on mount and on every keystroke.
  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    autoResize(headingRef.current);
    autoResize(subheadingRef.current);
  }, []);
  // 'next' = current page exits upward, new page enters from below.
  // 'prev' = current page exits downward, new page enters from above.
  const [direction, setDirection] = useState<"next" | "prev">("next");
  // NOTE: name kept as `hoveredId` to avoid renaming every CSS class
  // that reads off it (--hovered / --dimmed), but semantically this is
  // now "activeId" — it is set ONLY by a click, never by mouse hover.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const isTransitioning = useRef(false);
  const touchStartY = useRef<number | null>(null);

  // ---- Centered-focus tracking -------------------------------------
  // tileRefs holds the actual rendered <button> for every visible tile,
  // keyed by item id, so we can read its real on-screen rect the moment
  // it's clicked and fly a centered clone out from that exact spot.
  const tileRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [focus, setFocus] = useState<{
    item: PlacedItem;
    startRect: { top: number; left: number; width: number; height: number };
  } | null>(null);
  const focusTimeout = useRef<number | null>(null);

  const registerTileRef = useCallback(
    (id: string, el: HTMLButtonElement | null) => {
      if (el) tileRefs.current.set(id, el);
      else tileRefs.current.delete(id);
    },
    []
  );

  const commitFocus = useCallback((item: PlacedItem) => {
    setHoveredId(item.id);
    const el = tileRefs.current.get(item.id);
    if (!el) return;
    // Viewport-relative rect — the focus clone is rendered as a
    // viewport-fixed overlay (sibling of the canvas, not inside it), so
    // it is never clipped by the canvas's overflow:hidden and always
    // sits above the top/bottom bars.
    const rect = el.getBoundingClientRect();
    if (focusTimeout.current) {
      window.clearTimeout(focusTimeout.current);
      focusTimeout.current = null;
    }
    setFocus({
      item,
      startRect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      },
    });
  }, []);

  // ---- Click-to-focus (all pointer types) ----------------------------
  // A single click on a tile opens the centered focus preview; clicking
  // the SAME tile again closes it. There is no hover involved anywhere,
  // so there's nothing that can drift/re-trigger and cause flicker.
  // Closing goes through the `hoveredId === null` effect below, which
  // keeps the fly-back-then-unmount animation.
  const handleTileActivate = useCallback(
    (item: PlacedItem) => {
      setHoveredId((curr) => {
        if (curr === item.id) {
          return null; // second click on the active tile: close it
        }
        commitFocus(item);
        return item.id;
      });
      onItemClick?.(item);
    },
    [commitFocus, onItemClick]
  );

  // When hoveredId clears, let the focus overlay animate back, then unmount.
  useEffect(() => {
    if (hoveredId !== null) return;
    if (!focus) return;
    focusTimeout.current = window.setTimeout(() => {
      setFocus(null);
      setEditingId(null);
    }, 460);
    return () => {
      if (focusTimeout.current) window.clearTimeout(focusTimeout.current);
    };
  }, [hoveredId, focus]);

  const handleBottomLeft = () => {
    setDarkMode((d) => !d);
    onBottomLeftClick?.();
  };

  const goToPage = useCallback(
    (delta: number) => {
      if (isTransitioning.current) return;
      setPageIndex((curr) => {
        const next = curr + delta;
        if (next < 0 || next > pages.length - 1) return curr;
        isTransitioning.current = true;
        setDirection(delta > 0 ? "next" : "prev");
        setHoveredId(null);
        setFocus(null);
        setEditingId(null);
        window.setTimeout(() => {
          isTransitioning.current = false;
        }, 650);
        return next;
      });
    },
    [pages.length]
  );

  // Wheel = page through the gallery, one gesture at a time.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || pages.length <= 1) return;
    const onWheel = (e: WheelEvent) => {
      if (editingId) return; // don't page while actively editing an image
      if (Math.abs(e.deltaY) < 12) return;
      e.preventDefault();
      goToPage(e.deltaY > 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [goToPage, pages.length, editingId]);

  // Touch swipe (mobile) — pages the gallery. Only fires on a real
  // vertical drag past the threshold, so it won't conflict with the
  // tap-to-preview handling on individual tiles above.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || pages.length <= 1) return;
    const onTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0]?.clientY ?? null;
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartY.current == null) return;
      const endY = e.changedTouches[0]?.clientY ?? touchStartY.current;
      const delta = touchStartY.current - endY;
      if (Math.abs(delta) > 40) {
        goToPage(delta > 0 ? 1 : -1);
      }
      touchStartY.current = null;
    };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [goToPage, pages.length]);

  // Escape clears focus/editing; Arrow keys / PageUp/PageDown page through.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditingId(null);
        setHoveredId(null);
      }
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        goToPage(1);
      }
      if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goToPage(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goToPage]);

  const currentPlaced = placedPages[pageIndex] ?? [];

  // Centered target size for the focus clone, recomputed on resize.
  const [viewportW, setViewportW] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1440
  );
  useEffect(() => {
    const onResize = () => setViewportW(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const focusSize = getFocusSize(viewportW);

  // ---- Drag-to-pan while editing -------------------------------------
  // Global mouse/touch listeners so a drag started on the focused image
  // keeps tracking even if the pointer briefly leaves the image bounds
  // (fast drags), mirroring how the wheel/touch page handlers above are
  // wired at the container level rather than the element level.
  const handleCropPointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent, id: string) => {
      if (editingId !== id) return;
      e.preventDefault();
      const point = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
      if (!point) return;
      const edit = getImageEdit(id);
      dragRef.current = {
        id,
        startX: point.clientX,
        startY: point.clientY,
        origX: edit.x,
        origY: edit.y,
      };
    },
    [editingId, getImageEdit]
  );

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const point = "touches" in e ? e.touches[0] : (e as MouseEvent);
      if (!point) return;
      const dx = point.clientX - d.startX;
      const dy = point.clientY - d.startY;
      // Convert pixel drag distance into the same % translate space
      // the CSS transform uses, scaled to the focus box's own size so
      // panning speed feels consistent regardless of image size.
      const pctX = (dx / focusSize.w) * 100;
      const pctY = (dy / focusSize.h) * 100;
      const clamp = (v: number) => Math.max(-50, Math.min(50, v));
      updateImageEdit(d.id, {
        x: clamp(d.origX + pctX),
        y: clamp(d.origY + pctY),
      });
    };
    const handleUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleUp);
    };
  }, [focusSize.w, focusSize.h, updateImageEdit]);

  const [replacing, setReplacing] = useState(false);

  const handleReplaceFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && focus) {
        // Instant local preview so it doesn't feel like nothing happened
        const localUrl = URL.createObjectURL(file);
        updateImageEdit(focus.item.id, { src: localUrl });

        if (onImageReplace) {
          setReplacing(true);
          try {
            const realUrl = await onImageReplace(focus.item, file);
            if (realUrl) {
              // Swap the local preview for the real persisted URL once saved
              updateImageEdit(focus.item.id, { src: realUrl });
            }
          } finally {
            setReplacing(false);
          }
        }
      }
      e.target.value = "";
    },
    [focus, updateImageEdit, onImageReplace]
  );

  return (
     <div className="editordashboard-container">
    <div
      ref={containerRef}
      className={`genweb-root${darkMode ? " genweb-root--dark" : ""}`}
    >
      <BackButton className="genweb-back-button" />

      {/* ---------- Top bar ---------- */}
      <header className="genweb-bar genweb-bar--top">
        <span className="genweb-bar-label genweb-bar-label--center">
          {topCenterLabel}
        </span>
      </header>

      {/* ---------- Animated background ---------- */}
      <div className="genweb-bg" aria-hidden="true">
        <span className="genweb-blob genweb-blob--a" />
        <span className="genweb-blob genweb-blob--b" />
        <span className="genweb-blob genweb-blob--c" />
        <span className="genweb-blob genweb-blob--d" />
      </div>

      {/* ---------- Scatter canvas ---------- */}
      <main
        className="genweb-canvas"
        aria-label="Project gallery"
        ref={canvasRef}
        onClick={(e) => {
          // Close the open focus when the click didn't originate from a
          // tile's hitbox — i.e. a click on empty background. Clicking a
          // DIFFERENT tile still works normally: that tile's own hitbox
          // onClick (handleTileActivate) fires first and switches focus
          // directly, and this check sees the click came from inside a
          // hitbox, so it does nothing.
          const target = e.target as HTMLElement;
          if (!target.closest(".genweb-tile-hitbox")) {
            setHoveredId(null);
            setEditingId(null);
          }
        }}
      >
        <div
          key={pageIndex}
          className={`genweb-page genweb-page--enter-${direction}`}
        >
          {currentPlaced.map((item, i) => {
            const isHovered = hoveredId === item.id;
            const isDimmed = hoveredId !== null && !isHovered;
            const isLifted = focus?.item.id === item.id;
            const text = getItemText(item);
            const edit = getImageEdit(item.id);

            return (
              // LAYER 1: stationary hitbox. This is the ONLY element
              // that owns interaction — a single onClick, nothing else.
              // It never animates, so unlike binding interaction to the
              // floating image layer, the hit zone can't drift out from
              // under the cursor and re-trigger itself.
              <div
                key={item.id}
                className="genweb-tile-hitbox"
                style={
                  {
                    top: `${item.top}%`,
                    left: `${item.left}%`,
                    width: `${item.baseWidth}px`,
                    height: `${item.baseWidth * 0.75}px`,
                  } as React.CSSProperties
                }
                onClick={() => handleTileActivate(item)}
              >
                {/* LAYER 2: ambient float animation. pointer-events:none
                    so it can drift freely without ever affecting what's
                    under the cursor. */}
                <div
                  className={`genweb-tile-float${isHovered ? " genweb-tile-float--paused" : ""}`}
                  style={
                    {
                      "--genweb-float-duration": `${item.floatDuration}s`,
                      "--genweb-float-delay": `${item.floatDelay}s`,
                      "--genweb-float-x": `${item.floatX}px`,
                      "--genweb-float-y": `${item.floatY}px`,
                      "--genweb-float-rotate": `${item.floatRotate}deg`,
                      "--genweb-stagger": `${i * 35}ms`,
                    } as React.CSSProperties
                  }
                >
                  {/* LAYER 3: page-enter stagger (unchanged) */}
                  <div className="genweb-tile-enter">
                    {/* LAYER 4: the actual clickable/focusable tile */}
                    <button
                      type="button"
                      ref={(el) => registerTileRef(item.id, el)}
                      className={`genweb-tile${isDimmed ? " genweb-tile--dimmed" : ""}${
                        isLifted ? " genweb-tile--source" : ""
                      }${isHovered ? " genweb-tile--hovered" : ""}`}
                      style={
                        {
                          "--genweb-base-w": `${item.baseWidth}px`,
                          "--genweb-rotate": `${item.rotate}deg`,
                        } as React.CSSProperties
                      }
                    >
                      {/* Purely visual — no handlers here. A native
                          <button> click bubbles up to the stationary
                          hitbox div above, so mouse click AND
                          keyboard Enter/Space both work through the
                          single handler there. */}
                      <span className="genweb-tile-imgwrap">
                        <img
                          src={edit.src ?? item.src}
                          alt={text.title}
                          className="genweb-tile-img"
                          loading="lazy"
                          draggable={false}
                          style={{
                            transform: `scale(${edit.scale}) translate(${edit.x}%, ${edit.y}%)`,
                          }}
                        />
                      </span>
                      {/* Caption only shows in the small state; the centered
                          focus clone renders its own caption below.
                          Editable now: stopPropagation so typing/clicking
                          into the inputs doesn't toggle the tile's own
                          click handler on the hitbox beneath. */}
                      {!isLifted && (
                        <span
                          className="genweb-tile-caption"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            className="genweb-tile-title genweb-tile-input"
                            value={text.title}
                            onChange={(e) => updateItemText(item, "title", e.target.value)}
                            onBlur={() => handleTextBlur(item)}
                            aria-label="Tile title"
                          />
                          <input
                            type="text"
                            className="genweb-tile-sub genweb-tile-input"
                            placeholder="Add caption…"
                            value={text.caption}
                            onChange={(e) => updateItemText(item, "caption", e.target.value)}
                            onBlur={() => handleTextBlur(item)}
                            aria-label="Tile caption"
                          />
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ---------- Centre heading ---------- */}
        <div className="genweb-heading" aria-hidden={hoveredId !== null}>
          <textarea
            ref={headingRef}
            className="genweb-heading-title genweb-heading-input"
            value={headingText}
            onChange={(e) => {
              setHeadingText(e.target.value);
              autoResize(e.target);
            }}
            onBlur={() => onHeadingSave?.(headingText, subheadingText)}
            rows={1}
            spellCheck={false}
            aria-label="Heading"
          />
          <textarea
            ref={subheadingRef}
            className="genweb-heading-sub genweb-heading-input"
            value={subheadingText}
            onChange={(e) => {
              setSubheadingText(e.target.value);
              autoResize(e.target);
            }}
            onBlur={() => onHeadingSave?.(headingText, subheadingText)}
            rows={1}
            spellCheck={false}
            aria-label="Subheading"
          />
        </div>

        {/* ---------- Page indicator ---------- */}
        {pages.length > 1 && (
          <div className="genweb-pager" role="tablist" aria-label="Gallery pages">
            {pages.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === pageIndex}
                aria-label={`Page ${i + 1} of ${pages.length}`}
                className={`genweb-pager-dot${i === pageIndex ? " genweb-pager-dot--active" : ""}`}
                onClick={() => {
                  if (i === pageIndex || isTransitioning.current) return;
                  setDirection(i > pageIndex ? "next" : "prev");
                  isTransitioning.current = true;
                  setHoveredId(null);
                  setFocus(null);
                  setEditingId(null);
                  setPageIndex(i);
                  window.setTimeout(() => {
                    isTransitioning.current = false;
                  }, 650);
                }}
              />
            ))}
          </div>
        )}
      </main>

      {/* ---------- Centred click-focus clone ----------
          Rendered at the root level (not inside .genweb-canvas) so it is
          never clipped by the canvas's overflow:hidden, and sits above
          the top/bottom bars. Flies from the clicked tile's real
          viewport rect to a fixed centered position/size, then flies
          back to that same rect when the same tile is clicked again
          (or Escape is pressed / the page changes) before unmounting.

          While focused, also exposes an "Edit image" control that turns
          on drag-to-pan + zoom + replace for that item's image, and the
          title/caption here are editable inputs too (kept in sync with
          the same itemTexts state as the small tile above). */}
      {focus && (
        <div
          className={`genweb-focus${hoveredId === focus.item.id ? " genweb-focus--active" : ""}`}
          style={
            {
              "--genweb-fs-top": `${focus.startRect.top}px`,
              "--genweb-fs-left": `${focus.startRect.left}px`,
              "--genweb-fs-w": `${focus.startRect.width}px`,
              "--genweb-fs-h": `${focus.startRect.height}px`,
              "--genweb-ft-w": `${focusSize.w}px`,
              "--genweb-ft-h": `${focusSize.h}px`,
            } as React.CSSProperties
          }
        >
          <span
            className={`genweb-focus-imgwrap${editingId === focus.item.id ? " genweb-focus-imgwrap--editing" : ""}`}
            onMouseDown={(e) => handleCropPointerDown(e, focus.item.id)}
            onTouchStart={(e) => handleCropPointerDown(e, focus.item.id)}
            style={{ pointerEvents: editingId === focus.item.id ? "auto" : "none" }}
          >
            <img
              src={getImageEdit(focus.item.id).src ?? focus.item.src}
              alt=""
              className="genweb-focus-img"
              draggable={false}
              style={{
                transform: `scale(${getImageEdit(focus.item.id).scale}) translate(${getImageEdit(focus.item.id).x}%, ${getImageEdit(focus.item.id).y}%)`,
              }}
            />
          </span>

          <span
            className="genweb-focus-caption"
            style={{ pointerEvents: "auto" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <input
              type="text"
              className="genweb-focus-title genweb-focus-input"
              value={getItemText(focus.item).title}
              onChange={(e) => updateItemText(focus.item, "title", e.target.value)}
              onBlur={() => handleTextBlur(focus.item)}
              aria-label="Focused title"
            />
            <input
              type="text"
              className="genweb-focus-sub genweb-focus-input"
              placeholder="Add caption…"
              value={getItemText(focus.item).caption}
              onChange={(e) => updateItemText(focus.item, "caption", e.target.value)}
              onBlur={() => handleTextBlur(focus.item)}
              aria-label="Focused caption"
            />
          </span>

          {/* Edit-image toolbar: shows a single "Edit image" button
              normally, and swaps to zoom/replace/reset/done controls
              once editing that tile's image is active. */}
          <div
            className="genweb-focus-controls"
            style={{ pointerEvents: "auto" }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {editingId === focus.item.id ? (
              <>
                <label className="genweb-focus-zoom">
                  Zoom
                  <input
                    type="range"
                    min={1}
                    max={2.5}
                    step={0.01}
                    value={getImageEdit(focus.item.id).scale}
                    onChange={(e) =>
                      updateImageEdit(focus.item.id, { scale: parseFloat(e.target.value) })
                    }
                  />
                </label>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={replacing}>
                  {replacing ? "Uploading..." : "Replace"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetImageEdit(focus.item.id);
                    onImageEditSave?.(focus.item, { scale: 1, x: 0, y: 0 });
                  }}
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onImageEditSave?.(focus.item, getImageEdit(focus.item.id));
                    setEditingId(null);
                    setHoveredId(null); // also closes the focus, flying the image back to its grid spot
                  }}
                >
                  Done
                </button>
              </>
            ) : (
              <button
                type="button"
                className="genweb-focus-edit-btn"
                onClick={() => setEditingId(focus.item.id)}
              >
                ✎ Edit image
              </button>
            )}
          </div>
        </div>
      )}

      {/* Hidden file input shared by every tile's "Replace" control —
          only ever targets whichever item is currently focused. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleReplaceFile}
      />

      {/* ---------- Bottom bar ---------- */}
    </div>
    </div>
  );
};



/**
 * Sample items so this file renders immediately out of the box.
 * Swap `src` for your real images and edit the text fields — or skip
 * this section entirely and use the named `GenerationWebPage` export
 * with your own `items` array.
 */
const demoItems: GenWebItem[] = [
  { id: "1", src: "https://picsum.photos/seed/genweb1/600/450", title: "Yuvaksham", caption: "Domain 1 — Self Awareness" },
  { id: "2", src: "https://picsum.photos/seed/genweb2/600/450", title: "Yuvaksham", caption: "Domain 2 — Communication" },
  { id: "3", src: "https://picsum.photos/seed/genweb3/600/450", title: "Image Campus", caption: "Tribal Cohort, Batch 04" },
  { id: "4", src: "https://picsum.photos/seed/genweb4/600/450", title: "Future Readiness Index", caption: "Profiling Framework" },
  { id: "5", src: "https://picsum.photos/seed/genweb5/600/450", title: "Q-TECT", caption: "BIS Standards Game" },
  { id: "6", src: "https://picsum.photos/seed/genweb6/600/450", title: "SER", caption: "Student Evolution Record" },
  { id: "7", src: "https://picsum.photos/seed/genweb7/600/450", title: "Creating Bonds", caption: "Early Explorers, Sr. KG" },
  { id: "8", src: "https://picsum.photos/seed/genweb8/600/450", title: "Yogstar", caption: "Digital Health Sprint 01" },
  { id: "9", src: "https://picsum.photos/seed/genweb9/600/450", title: "Legacy Orbit", caption: "Constellation Mind-Map" },
  { id: "10", src: "https://picsum.photos/seed/genweb10/600/450", title: "CY-BI", caption: "Behaviour Unit Pipeline" },
  { id: "11", src: "https://picsum.photos/seed/genweb11/600/450", title: "Yuvaksham", caption: "Domain 3 — Resilience" },
  { id: "12", src: "https://picsum.photos/seed/genweb12/600/450", title: "Roots / Wings / Rise", caption: "Grade Bands, Std 1–8" },
  { id: "13", src: "https://picsum.photos/seed/genweb13/600/450", title: "SkillPrint", caption: "15-Question Persona Engine" },
  { id: "14", src: "https://picsum.photos/seed/genweb14/600/450", title: "Aqua Quest", caption: "Water Awareness Platform" },
  { id: "15", src: "https://picsum.photos/seed/genweb15/600/450", title: "Legacy Timeline", caption: "Sticky Scroll Variant" },
  { id: "16", src: "https://picsum.photos/seed/genweb16/600/450", title: "Pactacy", caption: "Behaviour Change System" },
  { id: "17", src: "https://picsum.photos/seed/genweb17/600/450", title: "ED-Doc", caption: "School Digitisation, Gujarat" },
  { id: "18", src: "https://picsum.photos/seed/genweb18/600/450", title: "EEMM Model", caption: "Know → Feel → Act → Transform" },
  { id: "19", src: "https://picsum.photos/seed/genweb19/600/450", title: "Vision Board", caption: "Spinning Wheel UI" },
  { id: "20", src: "https://picsum.photos/seed/genweb20/600/450", title: "HEMS / TES", caption: "Scoring System" },
];

/** Default export — fetches real image placements + quotes for this
 * customer (board_type = generation_web) and merges them onto the
 * demo tile layout by matching position_id to item.id. Anything
 * without a saved placement/quote keeps its placeholder demo content.
 *
 * NOTE: the inline "Edit image" / title / caption editing already built
 * into GenerationWebPage is still local-only (not persisted) — this
 * change only wires up READING what's been assigned via Media Library,
 * same scoping as Vision Board.
 */
export default function EditorGenerationWebPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const customerId = (location.state as any)?.customerId;

  const [items, setItems] = useState<GenWebItem[]>(demoItems);
  const [pageHeading, setPageHeading] = useState("KIRAN PATEL");
  const [pageSubheading, setPageSubheading] = useState("CHARACTER, BUILT QUARTER BY QUARTER (©2025)");
  // Per-item zoom/pan, mirrored here (not just inside GenerationWebPage's
  // own state) so handleTextSave can include it when it overwrites the
  // same board_quotes JSON blob, and vice versa — without this either
  // save would silently wipe out the other one's fields.
  const [imageEdits, setImageEdits] = useState<Record<string, ImageEdit>>({});

  useEffect(() => {
    if (!customerId) {
      toast.error("No project selected");
      navigate(-1);
      return;
    }

    Promise.all([
      api.get(`/customer/${customerId}/board-placements`, {
        params: { board_type: "generation_web" },
      }),
      api.get(`/customer/${customerId}/board-quotes`, {
        params: { board_type: "generation_web" },
      }),
    ])
      .then(([placementsRes, quotesRes]) => {
        const placements = placementsRes.data.data as Array<{ position_id: string; view_url: string }>;
        const quotes = quotesRes.data.data as Array<{ position_id: string; quote: string }>;

        const srcByPositionId: Record<string, string> = {};
        placements.forEach((p) => { srcByPositionId[p.position_id] = p.view_url; });

        const captionByPositionId: Record<string, string> = {};
        const titleByPositionId: Record<string, string> = {};
        const imageEditByPositionId: Record<string, ImageEdit> = {};
        quotes.forEach((q) => {
          // "heading" is a reserved position_id for the page-level
          // heading/subheading — not a real tile, handled separately.
          if (q.position_id === "heading") {
            try {
              const parsed = JSON.parse(q.quote);
              if (parsed?.heading != null) setPageHeading(parsed.heading);
              if (parsed?.subheading != null) setPageSubheading(parsed.subheading);
            } catch {
              // ignore malformed heading data
            }
            return;
          }
          try {
            const parsed = JSON.parse(q.quote);
            if (parsed && typeof parsed === "object") {
              if (parsed.caption != null) captionByPositionId[q.position_id] = parsed.caption;
              if (parsed.title != null) titleByPositionId[q.position_id] = parsed.title;
              if (parsed.imgScale != null || parsed.imgX != null || parsed.imgY != null) {
                imageEditByPositionId[q.position_id] = {
                  scale: parsed.imgScale ?? 1,
                  x: parsed.imgX ?? 0,
                  y: parsed.imgY ?? 0,
                };
              }
              return;
            }
          } catch {
            // Not JSON — treat as a plain caption string (older saved data)
          }
          captionByPositionId[q.position_id] = q.quote;
        });

        if (Object.keys(imageEditByPositionId).length > 0) {
          setImageEdits((prev) => ({ ...imageEditByPositionId, ...prev }));
        }

        if (
          Object.keys(srcByPositionId).length === 0 &&
          Object.keys(captionByPositionId).length === 0 &&
          Object.keys(titleByPositionId).length === 0
        ) {
          return; // nothing assigned yet — keep the demo content as-is
        }

        setItems((prev) =>
          prev.map((item) => ({
            ...item,
            src: srcByPositionId[item.id] ?? item.src,
            caption: captionByPositionId[item.id] ?? item.caption,
            title: titleByPositionId[item.id] ?? item.title,
          }))
        );
      })
      .catch(() => toast.error("Failed to load generation web images"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  // Called by the inline "Replace" button — same 3-step pipeline as
  // Media Library (get upload URL -> PUT to S3 -> save gallery record),
  // plus one extra step: immediately place it on this exact slot, so
  // it shows up on both editor and customer sides right away.
  const handleImageReplace = async (item: GenWebItem, file: File): Promise<string | void> => {
    if (!customerId) return;
    try {
      const urlRes = await api.post(`/customer/${customerId}/media-library/upload-url`, {
        fileName: file.name,
        fileType: file.type,
      });
      const { uploadUrl, key } = urlRes.data.data;

      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("Image upload to S3 failed");

      const saveRes = await api.post(`/customer/${customerId}/media-library`, { key });
      const saved = saveRes.data.data;

      await api.put(`/customer/${customerId}/board-placement`, {
        board_type: "generation_web",
        position_id: item.id,
        gallery_id: saved.id,
      });

      // Keep the items list in sync too, so if the focus view closes and
      // reopens (or the page re-renders) it reflects the saved image,
      // not just the transient local preview.
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, src: saved.view_url } : it))
      );

      toast.success("Image replaced — now visible on both editor and customer sides");
      return saved.view_url;
    } catch (err: any) {
      toast.error(err.message || "Failed to save replaced image");
    }
  };

  // Called on blur of any title/caption input — saves both fields
  // together as one JSON string, since board_quotes only has a single
  // "quote" text column per slot. Also re-sends this item's current
  // zoom/pan (if any) so a text edit doesn't overwrite and lose it.
  const handleTextSave = async (item: GenWebItem, title: string, caption: string) => {
    if (!customerId) return;
    try {
      const edit = imageEdits[item.id];
      await api.put(`/customer/${customerId}/board-quote`, {
        board_type: "generation_web",
        position_id: item.id,
        quote: JSON.stringify({
          title,
          caption,
          ...(edit ? { imgScale: edit.scale, imgX: edit.x, imgY: edit.y } : {}),
        }),
      });
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, title, caption } : it))
      );
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save text");
    }
  };

  // Called when the editor finishes adjusting an item's zoom/pan (Done or
  // Reset). Re-sends this item's current title/caption so the crop save
  // doesn't overwrite and lose them.
  const handleImageEditSave = async (item: GenWebItem, edit: ImageEdit) => {
    if (!customerId) return;
    setImageEdits((prev) => ({ ...prev, [item.id]: edit }));
    try {
      const current = items.find((it) => it.id === item.id);
      await api.put(`/customer/${customerId}/board-quote`, {
        board_type: "generation_web",
        position_id: item.id,
        quote: JSON.stringify({
          title: current?.title ?? item.title,
          caption: current?.caption ?? item.caption ?? "",
          imgScale: edit.scale,
          imgX: edit.x,
          imgY: edit.y,
        }),
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save photo adjustment");
    }
  };

  // Persists the page-level heading/subheading under the reserved
  // position_id "heading" — same board_quotes table, same board_type.
  const handleHeadingSave = async (heading: string, subheading: string) => {
    if (!customerId) return;
    try {
      await api.put(`/customer/${customerId}/board-quote`, {
        board_type: "generation_web",
        position_id: "heading",
        quote: JSON.stringify({ heading, subheading }),
      });
      setPageHeading(heading);
      setPageSubheading(subheading);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to save heading");
    }
  };

  return (
    <GenerationWebPage
      items={items}
      heading={pageHeading}
      subheading={pageSubheading}
      onImageReplace={handleImageReplace}
      onTextSave={handleTextSave}
      onHeadingSave={handleHeadingSave}
      onImageEditSave={handleImageEditSave}
      initialImageEdits={imageEdits}
    />
  );
}