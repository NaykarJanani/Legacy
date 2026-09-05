import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../services/api";
import BackButton from "../../../components/BackButton";
import { useBoardPlacements } from "../../../hooks/useBoardPlacements";
import { useBoardQuotes } from "../../../hooks/useBoardQuotes";
import "./Visionboard.css";

interface CropSettings {
  zoom: number;
  x: number;
  y: number;
}

interface Story {
  id: number;
  quote: string; // editable quote text
  img?: string; // set once the card photo is uploaded/cropped — overrides the id-derived default
  modalImg?: string; // set once the modal photo is uploaded/cropped — overrides the id-derived default
  origImg?: string; // uncropped source photo (lets you re-adjust later)
  imgCrop?: CropSettings;
  galleryId?: number; // the user_gallery row currently placed here (the cropped image that was uploaded for it)
}

// Only `id` is needed per card now — the actual file paths are derived from it
// (see cardImgSrc / modalImgSrc below), so adding a card is just adding an id.
const STORIES: Story[] = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  quote: "",
}));

// Default (un-uploaded) image paths are derived straight from the card's id,
// e.g. id 3 -> /assets/card/card3.png — see cardImgSrc/modalImgSrc inside the
// component (they also check Media Library placements before falling back here).

const TOTAL = STORIES.length;
const ARC_START = 195;
const ARC_END = 345;
const SCROLL_PER_CARD = 15;
const VISIBLE = 5;

type Mode = "desktop" | "tablet" | "small";

interface CropTarget {
  id: number;
  src: string; // uncropped source image to crop from
  aspect: number; // width / height
  initialZoom?: number;
  initialPos?: { x: number; y: number };
}

function getMode(): Mode {
  const w = window.innerWidth;
  if (w <= 425) return "small";
  if (w <= 768) return "tablet";
  return "desktop";
}

// ─────────────────────────────────────────────────────────
// CROP / ADJUST EDITOR — drag to pan, slider to zoom
// ─────────────────────────────────────────────────────────
function ImageCropEditor({
  target,
  onCancel,
  onApply,
}: {
  target: CropTarget;
  onCancel: () => void;
  onApply: (dataUrl: string, crop: CropSettings) => void;
}) {
  const VIEWPORT_W = 280;
  const VIEWPORT_H = 280; // square crop, regardless of the card's own aspect ratio
  const FINAL_W = 900;
  const FINAL_H = 900;

  const imgRef = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(target.initialZoom ?? 1);
  const [pos, setPos] = useState(target.initialPos ?? { x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  const onImgLoad = () => {
    const el = imgRef.current;
    if (el) {
      setNatural({ w: el.naturalWidth, h: el.naturalHeight });
      setError(null);
    }
  };

  const onImgError = () => {
    setError("This image couldn't be loaded, so it can't be adjusted right now.");
  };

  // If the browser already had this image cached, the <img>'s onLoad can fire
  // before this component's handler is attached — check el.complete on mount
  // (and whenever the target image changes) so we don't get stuck at natural.w === 0.
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) {
      setNatural({ w: el.naturalWidth, h: el.naturalHeight });
    }
  }, [target.src]);

  const baseScale =
    natural.w > 0 ? Math.max(VIEWPORT_W / natural.w, VIEWPORT_H / natural.h) : 1;

  const clampAxis = (val: number, max: number) => Math.min(Math.max(val, -max), max);

  const clampPos = (p: { x: number; y: number }, z: number) => {
    const dispW = natural.w * baseScale * z;
    const dispH = natural.h * baseScale * z;
    const maxX = Math.max(0, (dispW - VIEWPORT_W) / 2);
    const maxY = Math.max(0, (dispH - VIEWPORT_H) / 2);
    return { x: clampAxis(p.x, maxX), y: clampAxis(p.y, maxY) };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = pos.x;
    const origY = pos.y;
    dragRef.current = { startX, startY, origX, origY };
    setIsDragging(true);

    // Pointer capture keeps delivering move/up events to this element even if
    // the cursor moves outside it mid-drag (fast drags, small viewport, etc.)
    const targetEl = e.currentTarget as HTMLElement;
    try {
      targetEl.setPointerCapture(e.pointerId);
    } catch {
      // some browsers/targets may not support this — safe to ignore
    }

    const handleMove = (ev: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      // Capture everything we need from the ref synchronously, right here —
      // don't reference dragRef.current inside the setPos updater below,
      // since that callback can run after pointerup has already nulled it out,
      // which is what caused "Cannot read properties of null (reading 'origX')".
      const dx = ev.clientX - drag.startX;
      const dy = ev.clientY - drag.startY;
      const nextX = drag.origX + dx;
      const nextY = drag.origY + dy;
      setPos(() => clampPos({ x: nextX, y: nextY }, zoomRef.current));
    };
    const handleUp = () => {
      dragRef.current = null;
      setIsDragging(false);
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", handleUp);
      document.removeEventListener("pointercancel", handleUp);
    };

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", handleUp);
    document.addEventListener("pointercancel", handleUp);
  };

  const onZoomChange = (z: number) => {
    setZoom(z);
    setPos((p) => clampPos(p, z));
  };

  const handleApply = () => {
    const el = imgRef.current;
    if (!el) return;

    const natW = el.naturalWidth || natural.w || 1;
    const natH = el.naturalHeight || natural.h || 1;

    const scale = Math.max(VIEWPORT_W / natW, VIEWPORT_H / natH) * zoom;
    const dispW = natW * scale;
    const dispH = natH * scale;
    const imgLeft = VIEWPORT_W / 2 - dispW / 2 + pos.x;
    const imgTop = VIEWPORT_H / 2 - dispH / 2 + pos.y;

    let sx = (0 - imgLeft) / scale;
    let sy = (0 - imgTop) / scale;
    const sw = VIEWPORT_W / scale;
    const sh = VIEWPORT_H / scale;
    sx = Math.max(0, Math.min(sx, Math.max(0, natW - sw)));
    sy = Math.max(0, Math.min(sy, Math.max(0, natH - sh)));

    const canvas = document.createElement("canvas");
    canvas.width = FINAL_W;
    canvas.height = FINAL_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      ctx.drawImage(el, sx, sy, sw, sh, 0, 0, FINAL_W, FINAL_H);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      onApply(dataUrl, { zoom, x: pos.x, y: pos.y });
    } catch {
      // Swallow silently — Apply always closes the editor without a blocking message.
      onApply(target.src, { zoom, x: pos.x, y: pos.y });
    }
  };

  return (
    <div className="nb-crop-overlay">
      <div className="nb-crop-modal">
        <h4>Adjust Photo</h4>
        <p className="nb-crop-hint">Drag to reposition · use the slider to zoom. This photo is used for both the card and the popup.</p>

        <div
          className={`nb-crop-viewport ${isDragging ? "nb-crop-viewport--dragging" : ""}`}
          style={{ width: VIEWPORT_W, height: VIEWPORT_H }}
          onPointerDown={onPointerDown}
        >
          <img
            ref={imgRef}
            src={target.src}
            crossOrigin="anonymous"
            onLoad={onImgLoad}
            onError={onImgError}
            draggable={false}
            className="nb-crop-img"
            style={{
              width: natural.w * baseScale * zoom,
              height: natural.h * baseScale * zoom,
              left: VIEWPORT_W / 2 - (natural.w * baseScale * zoom) / 2 + pos.x,
              top: VIEWPORT_H / 2 - (natural.h * baseScale * zoom) / 2 + pos.y,
            }}
            alt="Crop preview"
          />
        </div>

        <div className="nb-crop-zoom-row">
          <span>Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => onZoomChange(parseFloat(e.target.value))}
          />
        </div>


        {error && <p className="nb-crop-error">{error}</p>}

        <div className="nb-crop-actions">
          <button type="button" className="nb-crop-btn nb-crop-btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="nb-crop-btn nb-crop-btn--solid" onClick={handleApply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Visionboard() {
  const location = useLocation();
  // Passed from Editorcardinnerpage.tsx via handleToolClick's navigate state.
  const customerId = (location.state as any)?.customerId;
  const { placements, placementDetails } = useBoardPlacements("vision_board", customerId);
  const { quotes, saveQuote } = useBoardQuotes("vision_board", customerId);

  const [localScroll, setLocalScroll] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [entered, setEntered] = useState(false);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [wheelSize, setWheelSize] = useState(0);
  const [mode, setMode] = useState<Mode>(() =>
    typeof window !== "undefined" ? getMode() : "desktop"
  );

  // ── EDITABLE CONTENT STATE ──────────────────────────────
  const [stories, setStories] = useState<Story[]>(STORIES);
  const [editMode, setEditMode] = useState(false);
  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null);
  const [savingCropId, setSavingCropId] = useState<number | null>(null);
  const [isSavingQuote, setIsSavingQuote] = useState(false);

  // Once saved quotes load, merge them into local story state so the
  // textarea starts prefilled instead of blank.
  useEffect(() => {
    if (Object.keys(quotes).length === 0) return;
    setStories((prev) =>
      prev.map((s) =>
        quotes[String(s.id)] !== undefined ? { ...s, quote: quotes[String(s.id)] } : s
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotes]);

  // Once board placements load, remember each card's gallery_id and any
  // previously-saved crop transform, so reopening the crop tool on this
  // card starts the zoom/position where it was left off. Note: after a
  // refresh, only the already-cropped image survives (not the original
  // full photo) — re-adjusting at that point re-crops the cropped square,
  // it can no longer pull back in content that was cropped away earlier.
  useEffect(() => {
    if (Object.keys(placementDetails).length === 0) return;
    setStories((prev) =>
      prev.map((s) => {
        const row = placementDetails[String(s.id)];
        if (!row) return s;
        const hasSavedCrop = row.crop_zoom != null || row.crop_pos_x != null || row.crop_pos_y != null;
        return {
          ...s,
          galleryId: row.gallery_id,
          imgCrop: s.imgCrop ?? (hasSavedCrop
            ? { zoom: Number(row.crop_zoom ?? 1), x: Number(row.crop_pos_x ?? 0), y: Number(row.crop_pos_y ?? 0) }
            : s.imgCrop),
        };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placementDetails]);

  const sectionRef = useRef<HTMLDivElement>(null);
  const wheelWrapRef = useRef<HTMLDivElement>(null);

  // Priority per card: an in-progress local crop (not yet saved anywhere) >
  // the image assigned via the Media Library > the static placeholder asset.
  // `img`/`modalImg`/`placements[id]` now always point at an already-cropped
  // square photo (the crop is baked into its pixels at Apply time), so a
  // plain object-fit: cover is all any box needs — no runtime pan/zoom
  // transform required, and nothing that can end up off-center.
  const cardImgSrc = (s: Story) => s.img ?? placements[String(s.id)] ?? `/assets/card/card${s.id}.png`;
  const modalImgSrc = (s: Story) => s.modalImg ?? placements[String(s.id)] ?? `/assets/model/modal${s.id}.png`;

  useEffect(() => {
    const check = () => setMode(getMode());
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 120);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const measure = () => {
      if (wheelWrapRef.current) setWheelSize(wheelWrapRef.current.offsetWidth);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const vh = window.innerHeight;
    const totalScroll = TOTAL * SCROLL_PER_CARD * vh / 100;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setHasScrolled(true);
      setLocalScroll(prev => Math.min(Math.max(prev + e.deltaY, 0), totalScroll));
    };

    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const delta = touchStartY - e.touches[0].clientY;
      touchStartY = e.touches[0].clientY;
      setHasScrolled(true);
      setLocalScroll(prev => Math.min(Math.max(prev + delta, 0), totalScroll));
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
    };
  }, []);

  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const totalScroll = TOTAL * SCROLL_PER_CARD * vh / 100;
  const progress = Math.min(localScroll / totalScroll, 1);

  const wheelRotation = progress * 360;
  const storyProgress = progress * (TOTAL - 1);
  const centerIdx = Math.min(Math.max(Math.round(storyProgress), 0), TOTAL - 1);

  useEffect(() => { setActiveIndex(centerIdx); }, [centerIdx]);

  const activeStory = stories[activeIndex];
  const counterCurrent = String(activeIndex + 1).padStart(2, "0");
  const counterTotal = String(TOTAL).padStart(2, "0");

  // Jump the scroll-driven wheel so a specific card becomes the centered/active one —
  // used so side cards in tablet/small view can be brought to center for editing.
  const jumpToIndex = (idx: number) => {
    const targetProgress = idx / (TOTAL - 1);
    setLocalScroll(targetProgress * totalScroll);
    setHasScrolled(true);
  };

  const cardW = wheelSize > 0 ? Math.max(52, wheelSize * 0.095) : 72;
  const R = wheelSize * 0.44;
  const arcRange = ARC_END - ARC_START;
  const step = arcRange / (TOTAL - 1);

  const half = Math.floor(VISIBLE / 2);
  const slotStories: Story[] = Array.from({ length: VISIBLE }, (_, slot) => {
    const offset = slot - half;
    const idx = Math.min(Math.max(activeIndex + offset, 0), TOTAL - 1);
    return stories[idx];
  });

  // ── CROP / QUOTE HANDLERS ──────────────────────────────
  // Opens the crop editor for a card's photo — uses the original uncropped
  // source if we have it (from a previous adjustment), otherwise the current
  // default photo itself, so every card's placeholder image is adjustable.
  const openAdjust = (id: number) => {
    const story = stories.find((s) => s.id === id);
    if (!story) return;
    const src = story.origImg ?? cardImgSrc(story);
    setCropTarget({
      id,
      src,
      aspect: 3 / 4,
      initialZoom: story.imgCrop?.zoom,
      initialPos: story.imgCrop ? { x: story.imgCrop.x, y: story.imgCrop.y } : undefined,
    });
  };

  // A single crop always updates BOTH the card image and the modal image,
  // so the same photo shows in both places. Updates local state immediately
  // for instant feedback, then uploads the cropped image + assigns it to
  // this card's position in the background so it survives a refresh —
  // reusing the same media-library + board-placement pipeline the Media
  // Library page uses.
  //
  // Every Apply uploads the freshly-baked cropped pixels (this MUST happen
  // every time, not just on the first save — otherwise the new crop only
  // exists as numbers in board_placement while the actual image file behind
  // it never changes, so a refresh shows the old photo again). The backend
  // always mints a brand-new storage key per upload (it does not reuse the
  // fileName we send), so a re-adjustment's upload always lands at a new
  // key — that means the EXISTING gallery row must be pointed at that new
  // key via PUT /media-library/:galleryId, which also deletes the old file
  // it replaces. First-ever save for a position still creates a new row via
  // POST /media-library. Either way there's exactly one gallery row per
  // position, never a duplicate.
  const handleCropApply = async (dataUrl: string, crop: CropSettings) => {
    if (!cropTarget) return;
    const { id, src } = cropTarget;

    // `dataUrl` is the actual cropped square (the crop baked into real
    // pixels) — that's what gets shown and uploaded. `src` (the full
    // uncropped original) is kept only as `origImg`, so re-opening the
    // crop tool on this card later can still start from the whole photo
    // instead of re-cropping an already-cropped square.
    setStories((prev) =>
      prev.map((s) =>
        s.id === id
          ? { ...s, img: dataUrl, modalImg: dataUrl, origImg: src, imgCrop: crop }
          : s
      )
    );
    setCropTarget(null);

    if (!customerId) {
      console.warn("No customerId available — cropped photo is a local preview only and will not persist.");
      toast.warning("No project selected — this photo won't be saved permanently.");
      return;
    }

    try {
      setSavingCropId(id);

      const existingGalleryId = stories.find((s) => s.id === id)?.galleryId;

      // Always upload the freshly-cropped pixels — every Apply produces a
      // new baked image, so the file behind this position must be
      // refreshed every time, not just on the first save. NOTE: the backend
      // mints a unique storage key on every call regardless of fileName, so
      // this always lands at a brand-new key — that's why re-adjustments
      // below explicitly re-point the existing gallery row at it instead of
      // assuming the key was reused.
      const blob = await (await fetch(dataUrl)).blob();
      const fileType = blob.type || "image/jpeg";
      const fileName = `vision-board-${id}.jpg`;

      const urlRes = await api.post(`/customer/${customerId}/media-library/upload-url`, {
        fileName,
        fileType,
      });
      const { uploadUrl, key } = urlRes.data.data;

      await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": fileType },
        body: blob,
      });

      let galleryId = existingGalleryId;

      if (!galleryId) {
        // First-ever save for this position — create the media-library row.
        const saveRes = await api.post(`/customer/${customerId}/media-library`, { key });
        galleryId = saveRes.data.data.id;
        setStories((prev) => prev.map((s) => (s.id === id ? { ...s, galleryId } : s)));
      } else {
        // Re-adjustment — point the EXISTING row at the newly-uploaded key
        // (the backend mints a new key on every upload-url call, so we
        // can't rely on it reusing the old one). The old file behind this
        // row is deleted server-side as part of this call.
        await api.put(`/customer/${customerId}/media-library/${galleryId}`, { key });
      }

      await api.put(`/customer/${customerId}/board-placement`, {
        board_type: "vision_board",
        position_id: String(id),
        gallery_id: galleryId,
        crop_zoom: crop.zoom,
        crop_pos_x: crop.x,
        crop_pos_y: crop.y,
      });

      toast.success("Photo saved");
    } catch (err) {
      console.error("Failed to save cropped photo", err);
      toast.error("Could not save this photo — it will reset on refresh. Please try again.");
    } finally {
      setSavingCropId(null);
    }
  };

  const handleQuoteChange = (id: number, value: string) => {
    setStories(prev => prev.map(s => (s.id === id ? { ...s, quote: value } : s)));
  };

  // Called when the editor finishes editing (textarea loses focus) — this is
  // the "done with that" save point the user asked for. Only fires with a
  // customerId present (editor side); the user-side hook's saveQuote is a
  // no-op, but this handler is never wired up there anyway.
  const handleQuoteBlur = async (id: number, value: string) => {
    try {
      setIsSavingQuote(true);
      await saveQuote(String(id), value);
    } catch (err) {
      console.error("Failed to save quote", err);
    } finally {
      setIsSavingQuote(false);
    }
  };

  // Always-visible edit control shown on every card in edit mode —
  // opens the crop/adjust tool on whatever photo is currently showing.
  const EditIcons = ({ id }: { id: number }) => (
    <div className="nb-edit-icons">
      <button
        type="button"
        className="nb-edit-icon-btn nb-edit-icon-btn--crop"
        onClick={(e) => {
          e.stopPropagation();
          openAdjust(id);
        }}
        title="Adjust crop"
        aria-label="Adjust crop"
      >
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2v14a2 2 0 0 0 2 2h14" />
          <path d="M18 22V8a2 2 0 0 0-2-2H2" />
        </svg>
      </button>
    </div>
  );

  const WheelSVG = () => (
    <svg viewBox="0 0 500 500" className="nb-wheel-svg" xmlns="http://www.w3.org/2000/svg">
      <circle cx="250" cy="250" r="242" fill="none" stroke="#11111191" strokeWidth="20" />
      {Array.from({ length: 64 }).map((_, i) => {
        const a = (i * 360) / 64, rad = (a * Math.PI) / 180;
        const x1 = 250 + 231 * Math.cos(rad), y1 = 250 + 231 * Math.sin(rad);
        const x2 = 250 + 242 * Math.cos(rad), y2 = 250 + 242 * Math.sin(rad);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1111113a" strokeWidth="3" strokeLinecap="round" />;
      })}
      <circle cx="250" cy="250" r="200" fill="none" stroke="#1111113a" strokeWidth="4.5" />
      <circle cx="250" cy="250" r="184" fill="none" stroke="#1111113a" strokeWidth="1.5" />
      <circle cx="250" cy="250" r="34" fill="#1111113a" />
      <circle cx="250" cy="250" r="20" fill="#1111113a" />
      <circle cx="250" cy="250" r="9" fill="#777" />
      <circle cx="250" cy="250" r="4" fill="#aaa" />
      {Array.from({ length: 18 }).map((_, i) => {
        const a = (i * 360) / 18, rad = (a * Math.PI) / 180;
        const x1 = 250 + 34 * Math.cos(rad), y1 = 250 + 34 * Math.sin(rad);
        const x2 = 250 + 198 * Math.cos(rad), y2 = 250 + 198 * Math.sin(rad);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1111113a" strokeWidth="1.8" strokeLinecap="round" />;
      })}
    </svg>
  );

  return (
    <div className="editordashboard-container">
    <div className="nb-page">
      <BackButton className="nb-back-button" />
      {/* EDIT MODE TOGGLE — admin only, remove/gate this in production */}
      <button
        type="button"
        className={`nb-edit-toggle ${editMode ? "nb-edit-toggle--on" : ""}`}
        onClick={() => setEditMode(v => !v)}
      >
        {editMode ? "Done Editing" : "Edit Content"}
      </button>

      <div ref={sectionRef} className="nb-scroll-driver">
        <div className="nb-sticky">

          {/* COUNTER */}
          <div className={`nb-counter ${entered ? "nb-counter--in" : ""}`}>
            <span>{counterCurrent}</span>
            <span className="nb-counter-slash">/</span>
            <span>{counterTotal}</span>
          </div>

          {/* HERO TEXT */}
          <div className={`nb-hero-text ${entered ? "nb-hero-text--in" : ""}`}>
            
          </div>

          {/* DESKTOP */}
          {mode === "desktop" && (
            <div className="nb-wheel-wrap" ref={wheelWrapRef}>
              <div className="nb-wheel-rotate" style={{ transform: `rotate(${wheelRotation}deg)` }}>
                <WheelSVG />
              </div>
              {wheelSize > 0 && stories.map((story, idx) => {
                const isActive = idx === activeIndex;
                const depth = Math.abs(idx - storyProgress);
                const angleDeg = ARC_START + idx * step;
                const angleRad = (angleDeg * Math.PI) / 180;
                const cx = wheelSize / 2, cy = wheelSize / 2;
                const r = isActive ? R * 0.84 : R * 0.96;
                const x = cx + r * Math.cos(angleRad);
                const y = cy + r * Math.sin(angleRad);
                const cardRotate = angleDeg + 90;
                const opacity = isActive ? 1 : Math.max(0.28, 1 - depth * 0.13);
                const scale = isActive ? 1.22 : Math.max(0.62, 1 - depth * 0.05);
                const zIndex = isActive ? 40 : Math.max(1, 20 - Math.round(depth));
                return (
                  <div
                    key={story.id}
                    className={`nb-card ${isActive ? "nb-card--active" : ""}`}
                    style={{
                      position: "absolute", width: cardW, left: x, top: y,
                      transform: `translate(-50%, -100%) rotate(${cardRotate}deg) scale(${scale})`,
                      opacity, zIndex,
                      transition: "opacity 0.5s ease, transform 0.5s cubic-bezier(0.25,0.46,0.45,0.94)",
                    }}
                  >
                    <div
                      className={`nb-card-img-wrap ${editMode ? "nb-editable" : ""}`}
                      onClick={() => openAdjust(story.id)}
                    >
                      <img src={cardImgSrc(story)} className="nb-card-img" loading="lazy" alt={`Card ${story.id}`} />
                      {editMode && <EditIcons id={story.id} />}
                      {savingCropId === story.id && (
                        <span style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 10, padding: "2px 8px", borderRadius: 10 }}>
                          Saving...
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TABLET */}
          {mode === "tablet" && (
            <>
              <div className="nb-wheel-bg-wrap" ref={wheelWrapRef}>
                <div className="nb-wheel-rotate" style={{ transform: `rotate(${wheelRotation}deg)` }}>
                  <WheelSVG />
                </div>
              </div>
              <div className="nb-row">
                {slotStories.map((story, slot) => {
                  const isCenter = slot === half;
                  const offset = slot - half;
                  const idx = Math.min(Math.max(activeIndex + offset, 0), TOTAL - 1);
                  return (
                    <div
                      key={slot}
                      className={`nb-slot ${isCenter ? "nb-slot--center" : "nb-slot--side"} ${editMode && !isCenter ? "nb-slot--editable" : ""}`}
                    >
                      <div
                        className={`nb-slot-inner ${editMode && isCenter ? "nb-editable" : ""}`}
                        onClick={
                          isCenter
                            ? () => openAdjust(story.id)
                            : editMode
                            ? () => jumpToIndex(idx)
                            : undefined
                        }
                      >
                        <img src={cardImgSrc(story)} className="nb-slot-img" loading="lazy" alt={`Card ${story.id}`} />
                        {editMode && isCenter && <EditIcons id={story.id} />}
                        {editMode && !isCenter && <span className="nb-slot-hint">Click to center &amp; edit</span>}
                      </div>
                      {isCenter && <div className="nb-slot-dash" />}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* SMALL */}
          {mode === "small" && (
            <>
              <div className="nb-wheel-bg-wrap" ref={wheelWrapRef}>
                <div className="nb-wheel-rotate" style={{ transform: `rotate(${wheelRotation}deg)` }}>
                  <WheelSVG />
                </div>
              </div>
              <div className="nb-center-card-wrap">
                <div className="nb-center-card">
                  <div
                    className={`nb-center-img-wrap ${editMode ? "nb-editable" : ""}`}
                    onClick={() => openAdjust(activeStory.id)}
                  >
                    <img
                      src={cardImgSrc(activeStory)}
                      className="nb-center-img"
                      loading="lazy"
                      alt={`Card ${activeStory.id}`}
                    />
                    {editMode && <EditIcons id={activeStory.id} />}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* BACKDROP — only for the normal "reveal" experience, not while editing,
              so the card wheel stays visible behind the editor */}
          {(hasScrolled && !editMode) && (
            <div className="nb-backdrop" key={`backdrop-${activeStory.id}`} />
          )}

          {/* MODAL — image upload + quote text box live here.
              In edit mode this becomes a small corner panel (not a full-screen
              centered popup) so you can see the card update live next to it. */}
          {(hasScrolled || editMode) && (
            <div
              className={`nb-story-popup ${editMode ? "nb-story-popup--editable nb-story-popup--edit-panel" : ""}`}
              key={activeStory.id}
            >
              <div
                className={`nb-story-popup-img-wrap ${editMode ? "nb-editable" : ""}`}
                onClick={() => openAdjust(activeStory.id)}
              >
                <img src={modalImgSrc(activeStory)} alt={`Modal ${activeStory.id}`} className="nb-story-popup-img" />
                {editMode && <EditIcons id={activeStory.id} />}
                {savingCropId === activeStory.id && (
                  <span style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 10, padding: "2px 8px", borderRadius: 10 }}>
                    Saving...
                  </span>
                )}
              </div>

              <div className="nb-story-popup-content">
                {editMode ? (
                  <div className="nb-quote-edit">
                    <label className="nb-quote-label">
                      Quote {isSavingQuote && <span style={{ opacity: 0.6, fontWeight: 400 }}>(saving...)</span>}
                    </label>
                    <textarea
                      className="nb-quote-input"
                      value={activeStory.quote}
                      placeholder="Type the quote for this card..."
                      onChange={(e) => handleQuoteChange(activeStory.id, e.target.value)}
                      onBlur={(e) => handleQuoteBlur(activeStory.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                ) : (
                  activeStory.quote && <p className="nb-quote-display">{activeStory.quote}</p>
                )}
              </div>
            </div>
          )}

          {/* SCROLL HINT */}
          <div className={`nb-scroll-hint ${entered ? "nb-scroll-hint--in" : ""}`}>
            <div className="nb-scroll-icon"><span /></div>
            <p>Scroll to navigate</p>
          </div>

        </div>
      </div>

      {/* CROP / ADJUST EDITOR — sits above everything else */}
      {cropTarget && (
        <ImageCropEditor
          target={cropTarget}
          onCancel={() => setCropTarget(null)}
          onApply={handleCropApply}
        />
      )}
    </div>
    </div>
  );
}