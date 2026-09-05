import React, { useMemo, useRef, useState, useCallback, useEffect } from "react";
import api from "../../../services/api";
import BackButton from "../../../components/BackButton";
import { useAuth } from "../../../hooks/useAuth";

/**
 * GenerationWebPage
 * ------------------------------------------------------------------
 * A scattered photo-grid landing page. Thumbnails sit at irregular
 * positions across the canvas; hovering one lifts it out of the grid
 * and flies it to the center of the screen as a large focal image
 * (with title/caption), while its neighbours stay small and dim —
 * matching the reference "Don't Call Me Urban" style interaction.
 *
 * Class prefix: "genweb-" (every class in this file is namespaced
 * so it can be dropped into an existing app without collisions).
 *
 * ------------------------------------------------------------------
 * FIX (hover "pumping" / flicker):
 * Previously the same element that listened for onMouseEnter /
 * onMouseLeave was also the element being animated by the ambient
 * float (translate/rotate) loop. That created a feedback loop: float
 * moves the hitbox -> cursor falls off it -> onMouseLeave fires ->
 * float resumes -> tile drifts back under the cursor -> onMouseEnter
 * fires again -> repeat. This produced a rapid "pumping" flicker
 * right at the cursor edge.
 *
 * The fix separates concerns into three nested layers per tile:
 *   1. .genweb-tile-hitbox   – STATIONARY. Owns position + hover
 *                              listeners. Never animates. Has a small
 *                              padding buffer so fast mouse movement
 *                              near the visual edge doesn't toggle
 *                              hover state.
 *   2. .genweb-tile-float    – the ambient drift animation layer.
 *                              `pointer-events: none` so it can move
 *                              freely without ever affecting what's
 *                              under the cursor.
 *   3. .genweb-tile-enter    – page-enter stagger animation (unchanged).
 *   4. .genweb-tile (button) – the actual clickable/focusable element,
 *                              `pointer-events: auto`.
 * ------------------------------------------------------------------
 */

/* ----------------------------- Types ----------------------------- */

export interface GenWebItem {
  id: string;
  src: string;
  title: string;
  caption?: string;
  /** 0–1, optional manual width hint relative to the base tile size */
  scale?: number;
  /** Per-image zoom/pan saved by the editor's crop tool — applied as
   * `scale(imgScale) translate(imgX%, imgY%)` on the tile's photo,
   * matching the editor's own preview so what the editor sees is what
   * shows up here. Defaults to no zoom/pan (1, 0, 0) when unset. */
  imgScale?: number;
  imgX?: number;
  imgY?: number;
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
  /** Called when an item is clicked (in addition to hover-grow) */
  onItemClick?: (item: GenWebItem) => void;
  /** How many items appear per scattered "page". Scrolling pages through the rest. Default 12 */
  itemsPerPage?: number;
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
  // 'next' = current page exits upward, new page enters from below.
  // 'prev' = current page exits downward, new page enters from above.
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const isTransitioning = useRef(false);
  const touchStartY = useRef<number | null>(null);

  // ---- Centered-focus tracking -------------------------------------
  // tileRefs holds the actual rendered <button> for every visible tile,
  // keyed by item id, so we can read its real on-screen rect the moment
  // it's hovered and fly a centered clone out from that exact spot.
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

  const handleEnter = useCallback((item: PlacedItem) => {
    setHoveredId(item.id);
    const el = tileRefs.current.get(item.id);
    if (!el) return;
    // Viewport-relative rect — the focus clone is now rendered as a
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

  const handleLeave = useCallback((id: string) => {
    setHoveredId((curr) => (curr === id ? null : curr));
    // Defer clearing the focused clone so the exit transition can play
    // back to the tile's real grid position before it unmounts.
    setFocus((curr) => {
      if (!curr || curr.item.id !== id) return curr;
      return curr; // keep mounted; CSS class swap drives the exit
    });
  }, []);

  // When hoveredId clears, let the focus overlay animate back, then unmount.
  useEffect(() => {
    if (hoveredId !== null) return;
    if (!focus) return;
    focusTimeout.current = window.setTimeout(() => {
      setFocus(null);
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
      if (Math.abs(e.deltaY) < 12) return;
      e.preventDefault();
      goToPage(e.deltaY > 0 ? 1 : -1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [goToPage, pages.length]);

  // Touch swipe (mobile)
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

  // Escape clears hover/focus; Arrow keys / PageUp/PageDown page through.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
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

  return (
    <div
      ref={containerRef}
      className={`genweb-root${darkMode ? " genweb-root--dark" : ""}`}
    >
      <style>{GENWEB_STYLES}</style>
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
      <main className="genweb-canvas" aria-label="Project gallery" ref={canvasRef}>
        <div
          key={pageIndex}
          className={`genweb-page genweb-page--enter-${direction}`}
        >
          {currentPlaced.map((item, i) => {
            const isHovered = hoveredId === item.id;
            const isDimmed = hoveredId !== null && !isHovered;
            const isLifted = focus?.item.id === item.id;

            return (
              // LAYER 1: stationary hitbox. Owns position + hover
              // listeners. Never animated, so the hover zone can never
              // drift out from under the cursor.
              <div
                key={item.id}
                className={`genweb-tile-hitbox${isHovered ? " genweb-tile-hitbox--active" : ""}`}
                style={
                  {
                    top: `${item.top}%`,
                    left: `${item.left}%`,
                  } as React.CSSProperties
                }
                onMouseEnter={() => handleEnter(item)}
                onMouseLeave={() => handleLeave(item.id)}
              >
                {/* LAYER 2: ambient float animation. pointer-events:none
                    so it can drift freely without ever affecting what's
                    under the cursor (this is what stops the "pumping"). */}
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
                      }`}
                      style={
                        {
                          "--genweb-base-w": `${item.baseWidth}px`,
                          "--genweb-rotate": `${item.rotate}deg`,
                        } as React.CSSProperties
                      }
                      onFocus={() => handleEnter(item)}
                      onBlur={() => handleLeave(item.id)}
                      onClick={() => onItemClick?.(item)}
                    >
                      <span className="genweb-tile-imgwrap">
                        <img
                          src={item.src}
                          alt={item.title}
                          className="genweb-tile-img"
                          loading="lazy"
                          draggable={false}
                          style={{
                            transform: `scale(${item.imgScale ?? 1}) translate(${item.imgX ?? 0}%, ${item.imgY ?? 0}%)`,
                          }}
                        />
                      </span>
                      {/* Keep this mounted while focused so the stationary
                          hover hitbox never shrinks underneath the pointer. */}
                      <span className="genweb-tile-caption">
                        <span className="genweb-tile-title">{item.title}</span>
                        {item.caption && (
                          <span className="genweb-tile-sub">{item.caption}</span>
                        )}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ---------- Centre heading ---------- */}
        <div className="genweb-heading" aria-hidden={hoveredId !== null}>
          <h1 className="genweb-heading-title">{heading}</h1>
          <p className="genweb-heading-sub">{subheading}</p>
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

      {/* ---------- Centred hover focus clone ----------
          Rendered at the root level (not inside .genweb-canvas) so it is
          never clipped by the canvas's overflow:hidden, and sits above
          the top/bottom bars. Flies from the hovered tile's real
          viewport rect to a fixed centered position/size, then flies
          back to that same rect on mouse-leave before unmounting. */}
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
          aria-hidden="true"
        >
          <span className="genweb-focus-imgwrap">
            <img
              src={focus.item.src}
              alt=""
              className="genweb-focus-img"
              draggable={false}
              style={{
                transform: `scale(${focus.item.imgScale ?? 1}) translate(${focus.item.imgX ?? 0}%, ${focus.item.imgY ?? 0}%)`,
              }}
            />
          </span>
          <span className="genweb-focus-caption">
            <span className="genweb-focus-title">{focus.item.title}</span>
            {focus.item.caption && (
              <span className="genweb-focus-sub">{focus.item.caption}</span>
            )}
          </span>
        </div>
      )}

      {/* ---------- Bottom bar ---------- */}
    
    </div>
  );
};

/* ------------------------------ Styles ----------------------------- */

const GENWEB_STYLES = `
.genweb-root {
  --genweb-bg: #f8f8f8;
  --genweb-fg: #14130f;
  --genweb-muted: #6b6a63;
  --genweb-rule: #14130f;
  --genweb-tile-shadow: 0 1px 2px rgba(20,19,15,0.08);
  --genweb-tile-shadow-active: 0 24px 48px rgba(20,19,15,0.28);
  --genweb-blob-1: ##ffffff;
  --genweb-blob-2: #c2d2c8;
  --genweb-blob-3: #d6c6d8;
  --genweb-blob-4: #c9d3df;
  --genweb-blob-opacity: 0.55;

  position: relative;
  width: 100%;
  min-height: 100vh;
  background: var(--genweb-bg);
  color: var(--genweb-fg);
  font-family: "Helvetica Neue", Arial, sans-serif;
  overflow: hidden;
  transition: background 0.4s ease, color 0.4s ease;
  box-sizing: border-box;
}
.genweb-root *, .genweb-root *::before, .genweb-root *::after {
  box-sizing: border-box;
}

.genweb-root--dark {
  --genweb-bg: #121210;
  --genweb-fg: #f3f2ec;
  --genweb-muted: #a3a298;
  --genweb-rule: #f3f2ec;
  --genweb-tile-shadow: 0 1px 2px rgba(0,0,0,0.5);
  --genweb-tile-shadow-active: 0 24px 60px rgba(0,0,0,0.7);
  --genweb-blob-1: #4a3f5e;
  --genweb-blob-2: #2d4a4a;
  --genweb-blob-3: #5a3a4a;
  --genweb-blob-4: #2f3f5a;
  --genweb-blob-opacity: 0.45;
}

/* ---------- Bars ---------- */
.genweb-bar {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  z-index: 20;
  pointer-events: none;
}
.genweb-bar--top { top: 0; }
.genweb-bar--bottom { bottom: 0; }

.genweb-bar-label {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--genweb-fg);
  pointer-events: auto;
  white-space: nowrap;
}
.genweb-bar-label--left { text-align: left; }
.genweb-bar-label--center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-family: 'Cairo', sans-serif;
}
.genweb-bar-label--right { text-align: right; }

.genweb-bar-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  padding: 4px 2px;
  color: var(--genweb-fg);
  transition: opacity 0.2s ease;
}
.genweb-bar-btn:hover { opacity: 0.55; }
.genweb-bar-btn:focus-visible {
  outline: 2px solid var(--genweb-fg);
  outline-offset: 3px;
}

/* ---------- Animated background ---------- */
.genweb-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}
.genweb-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(60px);
  opacity: var(--genweb-blob-opacity);
  will-change: transform;
  transition: background 0.4s ease;
}
.genweb-blob--a {
  width: 38vw;
  height: 38vw;
  min-width: 320px;
  min-height: 320px;
  top: -10%;
  left: -8%;
  background: var(--genweb-blob-1);
  animation: genweb-blob-drift-a 26s ease-in-out infinite alternate;
}
.genweb-blob--b {
  width: 30vw;
  height: 30vw;
  min-width: 260px;
  min-height: 260px;
  top: 55%;
  left: 65%;
  background: var(--genweb-blob-2);
  animation: genweb-blob-drift-b 32s ease-in-out infinite alternate;
}
.genweb-blob--c {
  width: 26vw;
  height: 26vw;
  min-width: 220px;
  min-height: 220px;
  top: 15%;
  left: 72%;
  background: var(--genweb-blob-3);
  animation: genweb-blob-drift-c 22s ease-in-out infinite alternate;
}
.genweb-blob--d {
  width: 24vw;
  height: 24vw;
  min-width: 200px;
  min-height: 200px;
  top: 68%;
  left: 4%;
  background: var(--genweb-blob-4);
  animation: genweb-blob-drift-d 29s ease-in-out infinite alternate;
}

@keyframes genweb-blob-drift-a {
  0%   { transform: translate(0, 0) scale(1); }
  100% { transform: translate(6vw, 8vh) scale(1.12); }
}
@keyframes genweb-blob-drift-b {
  0%   { transform: translate(0, 0) scale(1); }
  100% { transform: translate(-7vw, -6vh) scale(0.92); }
}
@keyframes genweb-blob-drift-c {
  0%   { transform: translate(0, 0) scale(1); }
  100% { transform: translate(-5vw, 7vh) scale(1.08); }
}
@keyframes genweb-blob-drift-d {
  0%   { transform: translate(0, 0) scale(1); }
  100% { transform: translate(5vw, -5vh) scale(0.95); }
}

/* ---------- Canvas ---------- */
.genweb-canvas {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100vh;
  min-height: 560px;
  overflow: hidden;
  touch-action: pan-x;
  overscroll-behavior: contain;
}

.genweb-page {
  position: absolute;
  inset: 0;
}

/* ---------- Page indicator ---------- */
.genweb-pager {
  position: absolute;
  right: 22px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 10px;
  z-index: 20;
}
.genweb-pager-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  border: none;
  padding: 0;
  background: var(--genweb-muted);
  opacity: 0.45;
  cursor: pointer;
  transition: opacity 0.25s ease, transform 0.25s ease, background 0.25s ease;
}
.genweb-pager-dot:hover { opacity: 0.8; }
.genweb-pager-dot--active {
  background: var(--genweb-fg);
  opacity: 1;
  transform: scale(1.4);
}
.genweb-pager-dot:focus-visible {
  outline: 2px solid var(--genweb-fg);
  outline-offset: 3px;
}

@media (max-width: 720px) {
  .genweb-pager { right: 12px; gap: 8px; }
}

/* ---------- Heading ---------- */
.genweb-heading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 5;
  pointer-events: none;
  max-width: 60%;
  transition: opacity 0.3s ease;
  font-family: 'Sarabun', sans-serif;
}
.genweb-heading-title {
  margin: 0 0 6px;
  font-size: clamp(15px, 1.6vw, 20px);
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--genweb-fg);
}
.genweb-heading-sub {
  margin: 0;
  font-size: clamp(10px, 1vw, 12px);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--genweb-muted);
}

/* ---------- Tiles ---------- */

/* LAYER 1 — Stationary hitbox: absolute placement on the canvas +
   hover listeners. This element itself NEVER animates/transforms in
   response to float/hover state, which is what eliminates the
   "pumping" flicker — the hover zone can't move out from under the
   cursor mid-hover.
   The padding below enlarges the actual hoverable area slightly
   beyond the visible tile, so fast mouse movement near the edge of a
   drifting tile doesn't repeatedly cross in/out of the hit area. */
.genweb-tile-hitbox {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 1;
  padding: 14px;
  margin: -14px;
}
.genweb-tile-hitbox--active {
  z-index: 10;
}

/* LAYER 2 — Ambient float animation. Purely decorative: pointer
   events are disabled here so this layer's motion can never change
   what element is "under the cursor". This is the key fix. */
.genweb-tile-float {
  pointer-events: none;
  animation-name: genweb-float;
  animation-duration: var(--genweb-float-duration);
  animation-delay: var(--genweb-float-delay);
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
  animation-direction: alternate;
}
.genweb-tile-float--paused {
  animation-play-state: paused;
}

@keyframes genweb-float {
  0% {
    translate: 0 0;
    rotate: 0deg;
  }
  50% {
    translate: var(--genweb-float-x) var(--genweb-float-y);
    rotate: var(--genweb-float-rotate);
  }
  100% {
    translate: calc(var(--genweb-float-x) * -0.6) calc(var(--genweb-float-y) * 0.8);
    rotate: calc(var(--genweb-float-rotate) * -0.7);
  }
}

/* LAYER 3 — page-enter cascade only, kept separate from the float
   animation above so the two transforms never fight. */
.genweb-tile-enter {
  opacity: 0;
  animation: genweb-page-enter-next 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  animation-delay: var(--genweb-stagger);
}
.genweb-page--enter-prev .genweb-tile-enter {
  animation-name: genweb-page-enter-prev;
}

@keyframes genweb-page-enter-next {
  from { opacity: 0; translate: 0 22px; }
  to   { opacity: 1; translate: 0 0; }
}
@keyframes genweb-page-enter-prev {
  from { opacity: 0; translate: 0 -22px; }
  to   { opacity: 1; translate: 0 0; }
}

/* LAYER 4 — the actual clickable/focusable button: base rotation,
   sizing — stays its normal small size at all times now; the
   centered "grow" happens on a separate flying clone (see
   .genweb-focus below), so the grid never reflows on hover.
   pointer-events re-enabled here since LAYER 2 turned them off. */
.genweb-tile {
  position: relative;
  display: block;
  pointer-events: auto;
  transform: rotate(var(--genweb-rotate));
  width: var(--genweb-base-w);
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  cursor: pointer;
  transition: opacity 0.35s ease, filter 0.35s ease;
  -webkit-tap-highlight-color: transparent;
}

.genweb-tile-imgwrap {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  box-shadow: var(--genweb-tile-shadow);
  background: #ddd;
}

.genweb-tile-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.genweb-tile-caption {
  display: block;
  margin-top: 8px;
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 0.3s ease 0.05s, transform 0.3s ease 0.05s;
  pointer-events: none;
}
.genweb-tile-title {
  display: block;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.genweb-tile-sub {
  display: block;
  margin-top: 2px;
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.03em;
  color: var(--genweb-muted);
}

/* The source tile a focus clone has been lifted from: fade the original
   out of the way so only the centered clone reads as "the hovered one". */
.genweb-tile--source {
  opacity: 0;
}

.genweb-tile--dimmed {
  opacity: 0.55;
  filter: grayscale(0.15);
}

.genweb-tile:focus-visible {
  outline: none;
}
.genweb-tile:focus-visible .genweb-tile-imgwrap {
  outline: 2px solid var(--genweb-fg);
  outline-offset: 4px;
}

/* ---------- Centred focus clone ----------
   Rendered as a viewport-fixed overlay (a root-level sibling of the
   canvas, not nested inside it) so it can never be cropped by the
   canvas's overflow:hidden and always renders above the top/bottom
   bars. It starts exactly over the hovered tile's real on-screen rect
   (captured via getBoundingClientRect at hover time) and animates to a
   large centered size/position. The wrapper centers the image+caption
   as one block — via a flex column anchored at 50%/50% with a
   translate — so the caption is guaranteed visible underneath the
   image instead of being pushed past the viewport edge. */
.genweb-focus {
  position: fixed;
  top: var(--genweb-fs-top);
  left: var(--genweb-fs-left);
  width: var(--genweb-fs-w);
  height: var(--genweb-fs-h);
  z-index: 60;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition:
    top 0.5s cubic-bezier(0.22, 1, 0.36, 1),
    left 0.5s cubic-bezier(0.22, 1, 0.36, 1),
    width 0.5s cubic-bezier(0.22, 1, 0.36, 1),
    height 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}
.genweb-focus--active {
  /* Center the image box in the viewport, then nudge up to leave
     guaranteed room for the caption below — clamped so on short
     viewports it never creeps under the top bar. */
  top: max(64px, calc(50vh - (var(--genweb-ft-h) / 2) - 22px));
  left: calc(50vw - (var(--genweb-ft-w) / 2));
  width: var(--genweb-ft-w);
  height: var(--genweb-ft-h);
}

.genweb-focus-imgwrap {
  display: block;
  width: 100%;
  height: 100%;
  flex: 0 0 auto;
  overflow: hidden;
  box-shadow: var(--genweb-tile-shadow);
  background: #ddd;
  transition: box-shadow 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}
.genweb-focus--active .genweb-focus-imgwrap {
  box-shadow: var(--genweb-tile-shadow-active);
}

.genweb-focus-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.genweb-focus-caption {
  display: block;
  flex: 0 0 auto;
  margin-top: 10px;
  text-align: center;
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 0.3s ease, transform 0.3s ease;
  white-space: nowrap;
}
.genweb-focus--active .genweb-focus-caption {
  opacity: 1;
  transform: translateY(0);
  transition-delay: 0.18s;
}
.genweb-focus-title {
  display: block;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.genweb-focus-sub {
  display: block;
  margin-top: 3px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.03em;
  color: var(--genweb-muted);
}

/* ---------- Reduced motion ---------- */
@media (prefers-reduced-motion: reduce) {
  .genweb-tile,
  .genweb-tile-img,
  .genweb-tile-caption,
  .genweb-focus,
  .genweb-focus-imgwrap,
  .genweb-focus-caption,
  .genweb-root {
    transition-duration: 0.01ms !important;
  }
  .genweb-tile-float,
  .genweb-blob,
  .genweb-tile-enter {
    animation: none !important;
    opacity: 1 !important;
  }
}

/* ---------- Responsive ---------- */
@media (max-width: 720px) {
  .genweb-canvas { height: 100vh; min-height: 640px; }
  .genweb-tile { width: calc(var(--genweb-base-w) * 0.72) !important; }
  .genweb-bar-label { font-size: 9px; }
  .genweb-heading { max-width: 86%; }
}

/* Back button — pinned above the animated canvas */
.genweb-back-button {
  position: absolute;
  top: 16px;
  left: 20px;
  z-index: 100;
  margin-bottom: 0;
}
`;

/* ------------------------- Example usage --------------------------- */
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

/** Default export — fetches this logged-in customer's own real image
 * placements + quotes (board_type = generation_web, as assigned by
 * their editor via Media Library) and merges them onto the demo tile
 * layout by matching position_id to item.id. Anything unassigned keeps
 * its placeholder demo content.
 */
export default function CustomerGenerationWebPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<GenWebItem[]>(demoItems);
  const [editorHeading, setEditorHeading] = useState("KIRAN PATEL");
  const [pageSubheading, setPageSubheading] = useState("CHARACTER, BUILT QUARTER BY QUARTER (©2025)");
  const loggedInUserName =
    user?.name?.trim() ||
    user?.display_name?.trim() ||
    user?.username?.trim() ||
    "";

  useEffect(() => {
    Promise.all([
      api.get("/board-placements", { params: { board_type: "generation_web" } }),
      api.get("/board-quotes", { params: { board_type: "generation_web" } }),
    ])
      .then(([placementsRes, quotesRes]) => {
        const placements = placementsRes.data.data as Array<{ position_id: string; view_url: string }>;
        const quotes = quotesRes.data.data as Array<{ position_id: string; quote: string }>;

        const srcByPositionId: Record<string, string> = {};
        placements.forEach((p: any) => { srcByPositionId[p.position_id] = p.view_url; });

        const captionByPositionId: Record<string, string> = {};
        const titleByPositionId: Record<string, string> = {};
        const imgScaleByPositionId: Record<string, number> = {};
        const imgXByPositionId: Record<string, number> = {};
        const imgYByPositionId: Record<string, number> = {};
        quotes.forEach((q: any) => {
          if (q.position_id === "heading") {
            try {
              const parsed = JSON.parse(q.quote);
              if (parsed?.heading != null) setEditorHeading(parsed.heading);
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
              if (parsed.imgScale != null) imgScaleByPositionId[q.position_id] = parsed.imgScale;
              if (parsed.imgX != null) imgXByPositionId[q.position_id] = parsed.imgX;
              if (parsed.imgY != null) imgYByPositionId[q.position_id] = parsed.imgY;
              return;
            }
          } catch {
            // Not JSON — treat as a plain caption string (older saved data)
          }
          captionByPositionId[q.position_id] = q.quote;
        });

        if (
          Object.keys(srcByPositionId).length === 0 &&
          Object.keys(captionByPositionId).length === 0 &&
          Object.keys(titleByPositionId).length === 0 &&
          Object.keys(imgScaleByPositionId).length === 0 &&
          Object.keys(imgXByPositionId).length === 0 &&
          Object.keys(imgYByPositionId).length === 0
        ) {
          return;
        }

        setItems((prev) =>
          prev.map((item) => ({
            ...item,
            src: srcByPositionId[item.id] ?? item.src,
            caption: captionByPositionId[item.id] ?? item.caption,
            title: titleByPositionId[item.id] ?? item.title,
            imgScale: imgScaleByPositionId[item.id] ?? item.imgScale,
            imgX: imgXByPositionId[item.id] ?? item.imgX,
            imgY: imgYByPositionId[item.id] ?? item.imgY,
          }))
        );
      })
      .catch(() => {
        // Non-fatal — the board still works fine on its default demo images
      });
  }, []);

  return (
    <GenerationWebPage
      items={items}
      heading={editorHeading}
      topCenterLabel={loggedInUserName}
      subheading={pageSubheading}
    />
  );
}
