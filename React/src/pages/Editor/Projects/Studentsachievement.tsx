import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../services/api";
import BackButton from "../../../components/BackButton";
import { useBoardPlacements } from "../../../hooks/useBoardPlacements";
import { useBoardQuotes } from "../../../hooks/useBoardQuotes";
import "./Studentsachievement.css";

// Editor's fixed square crop viewport (matches ImageCropEditor's
// VIEWPORT_W/H below). Saved crop.x/crop.y are raw pixel offsets captured
// in that space.
const EDITOR_VIEWPORT_PX = 280;

/**
 * Renders an image using the SAME cover+pan+zoom math the crop editor's own
 * preview uses (explicit width/height/left/top in real pixels), instead of
 * CSS `object-fit: cover` + a percentage transform. object-fit:cover picks
 * its own crop of the source to fill the box *before* the saved pan/zoom is
 * applied on top of it, which is what made saved crops look wrong (or
 * effectively reverted after refresh) on these detail-view boxes.
 */
function CropImg({
  src,
  alt,
  crop,
  className,
}: {
  src: string;
  alt: string;
  crop?: { zoom: number; x: number; y: number } | null;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!src) {
      setNatural({ w: 0, h: 0 });
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  const zoom = Math.max(1, Number(crop?.zoom ?? 1) || 1);
  const rawX = Number(crop?.x ?? 0) || 0;
  const rawY = Number(crop?.y ?? 0) || 0;

  let imgStyle: CSSProperties = { opacity: 0 };
  if (box.w > 0 && box.h > 0 && natural.w > 0 && natural.h > 0) {
    const baseScale = Math.max(box.w / natural.w, box.h / natural.h) * zoom;
    const renderW = natural.w * baseScale;
    const renderH = natural.h * baseScale;
    const panScaleX = box.w / EDITOR_VIEWPORT_PX;
    const panScaleY = box.h / EDITOR_VIEWPORT_PX;
    let left = box.w / 2 - renderW / 2 + rawX * panScaleX;
    let top = box.h / 2 - renderH / 2 + rawY * panScaleY;
    // Clamp so the image always fully covers the box — a pan offset valid
    // in the editor's square viewport could otherwise push the image past
    // an edge once rescaled into a box with a different aspect ratio,
    // revealing blank space behind it.
    left = Math.min(0, Math.max(box.w - renderW, left));
    top = Math.min(0, Math.max(box.h - renderH, top));
    imgStyle = {
      position: "absolute",
      width: renderW,
      height: renderH,
      maxWidth: "none",
      left,
      top,
    };
  }

  return (
    <div
      ref={containerRef}
      style={{ position: "relative", overflow: "hidden", width: "100%", height: "100%" }}
    >
      <img src={src} alt={alt} className={className} loading="lazy" style={imgStyle} />
    </div>
  );
}

const letters: string[] = Array.from({ length: 26 }, (_, i) =>
  String.fromCharCode(65 + i)
);

const clipPaths: Record<string, string> = {
  A: "polygon(50% 0%, 100% 25%, 85% 90%, 65% 90%, 70% 65%, 30% 65%, 35% 90%, 15% 90%, 0% 25%)",
  B: "polygon(10% 0%, 90% 0%, 90% 40%, 80% 50%, 90% 60%, 90% 100%, 10% 100%, 10% 0%, 30% 20%, 70% 20%, 70% 45%, 55% 50%, 70% 55%, 70% 80%, 30% 80%)",
  C: "polygon(25% 0%, 85% 0%, 85% 25%, 45% 25%, 45% 75%, 85% 75%, 85% 100%, 25% 100%, 0% 75%, 0% 25%)",
  D: "polygon(10% 0%, 80% 0%, 98% 20%, 98% 80%, 80% 100%, 10% 100%, 10% 0%, 35% 25%, 70% 25%, 80% 45%, 80% 55%, 70% 75%, 35% 75%)",
  E: "polygon(15% 0%, 90% 0%, 90% 30%, 65% 30%, 65% 40%, 90% 40%, 90% 60%, 65% 60%, 65% 70%, 90% 70%, 90% 100%, 15% 100%, 0% 70%, 0% 30%)",
  F: "polygon(15% 0%, 90% 0%, 90% 30%, 65% 30%, 65% 40%, 90% 40%, 90% 60%, 50% 60%, 50% 100%, 15% 100%, 0% 70%, 0% 30%)",
  G: "polygon(25% 0%, 85% 0%, 85% 30%, 65% 30%, 65% 45%, 90% 45%, 90% 80%, 80% 98%, 20% 98%, 0% 80%, 0% 20%, 20% 0%)",
  H: "polygon(15% 0%, 35% 0%, 35% 40%, 65% 40%, 65% 0%, 85% 0%, 85% 100%, 65% 100%, 65% 60%, 35% 60%, 35% 100%, 15% 100%)",
  I: "polygon(25% 0%, 75% 0%, 75% 25%, 60% 25%, 60% 75%, 75% 75%, 75% 100%, 25% 100%, 25% 75%, 40% 75%, 40% 25%, 25% 25%)",
  J: "polygon(30% 0%, 80% 0%, 80% 70%, 70% 90%, 40% 90%, 20% 70%, 20% 45%, 40% 45%, 40% 65%, 60% 65%, 60% 25%, 30% 25%)",
  K: "polygon(15% 0%, 35% 0%, 35% 38%, 65% 15%, 85% 15%, 60% 50%, 90% 85%, 70% 85%, 40% 58%, 35% 62%, 35% 100%, 15% 100%)",
  L: "polygon(15% 0%, 35% 0%, 35% 75%, 85% 75%, 85% 100%, 15% 100%)",
  M: "polygon(10% 0%, 30% 0%, 50% 35%, 70% 0%, 90% 0%, 90% 100%, 68% 100%, 68% 45%, 50% 70%, 32% 45%, 32% 100%, 10% 100%)",
  N: "polygon(10% 0%, 30% 0%, 30% 35%, 70% 0%, 90% 0%, 90% 100%, 70% 100%, 70% 62%, 30% 100%, 10% 100%)",
  O: "polygon(25% 0%, 75% 0%, 90% 25%, 90% 75%, 75% 100%, 25% 100%, 10% 75%, 10% 25%)",
  P: "polygon(15% 0%, 85% 0%, 85% 45%, 65% 60%, 35% 60%, 15% 45%, 15% 100%, 0% 80%, 0% 20%)",
  Q: "polygon(25% 0%, 75% 0%, 90% 20%, 90% 70%, 75% 85%, 65% 75%, 80% 70%, 80% 25%, 70% 15%, 30% 15%, 20% 25%, 20% 75%, 35% 90%, 25% 100%, 10% 85%, 10% 20%)",
  R: "polygon(15% 0%, 80% 0%, 85% 45%, 70% 55%, 55% 55%, 40% 45%, 40% 35%, 60% 35%, 70% 35%, 50% 70%, 80% 100%, 55% 100%, 35% 70%, 15% 70%, 0% 50%, 0% 20%)",
  S: "polygon(25% 0%, 80% 0%, 80% 30%, 60% 30%, 60% 45%, 80% 45%, 80% 80%, 55% 100%, 20% 100%, 20% 70%, 45% 70%, 45% 55%, 20% 55%, 20% 20%, 45% 0%)",
  T: "polygon(15% 0%, 85% 0%, 85% 25%, 65% 25%, 65% 100%, 35% 100%, 35% 25%, 15% 25%)",
  U: "polygon(15% 0%, 35% 0%, 35% 75%, 65% 75%, 65% 0%, 85% 0%, 85% 90%, 70% 100%, 30% 100%, 15% 90%)",
  V: "polygon(10% 0%, 32% 0%, 50% 70%, 68% 0%, 90% 0%, 70% 100%, 30% 100%)",
  W: "polygon(5% 0%, 25% 0%, 40% 45%, 50% 20%, 60% 45%, 75% 0%, 95% 0%, 85% 100%, 65% 100%, 50% 65%, 35% 100%, 15% 100%)",
  X: "polygon(20% 0%, 40% 0%, 50% 30%, 60% 0%, 80% 0%, 65% 50%, 85% 100%, 60% 100%, 50% 70%, 40% 100%, 15% 100%, 35% 50%)",
  Y: "polygon(20% 0%, 45% 0%, 50% 30%, 55% 0%, 80% 0%, 65% 50%, 65% 100%, 35% 100%, 35% 50%)",
  Z: "polygon(20% 0%, 85% 0%, 65% 35%, 75% 45%, 55% 70%, 85% 100%, 15% 100%, 35% 65%, 25% 55%, 45% 30%)",
};
type SeedImage = {
  id: string;
  src: string;
};
// ---------------------------------------------------------------------
// IMAGE STORAGE: instead of static /assets paths, each letter's image is
// stored as a base64 data-URL in localStorage under its own "image id".
// Fallback default paths are kept ONLY as an initial seed if nothing has
// been uploaded yet for that letter (safe to delete this block entirely
// once every letter has a stored upload).
// ---------------------------------------------------------------------
const defaultSeedImages: Record<string, SeedImage> = {
  A: { id: "A", src: "/assets/achievement img/a.png" },
  B: { id: "B", src: "/assets/achievement img/b.png" },
  C: { id: "C", src: "/assets/achievement img/c.png" },
  D: { id: "D", src: "/assets/achievement img/d.png" },
  E: { id: "E", src: "/assets/achievement img/e.png" },
  F: { id: "F", src: "/assets/achievement img/f.png" },
  G: { id: "G", src: "/assets/achievement img/g.png" },
  H: { id: "H", src: "/assets/achievement img/h.png" },
  I: { id: "I", src: "/assets/achievement img/i.png" },
  J: { id: "J", src: "/assets/achievement img/j.png" },
  K: { id: "K", src: "/assets/achievement img/k.png" },
  L: { id: "L", src: "/assets/achievement img/l.png" },
  M: { id: "M", src: "/assets/achievement img/m.png" },
  N: { id: "N", src: "/assets/achievement img/n.png" },
  O: { id: "O", src: "/assets/achievement img/o.png" },
  P: { id: "P", src: "/assets/achievement img/p.png" },
  Q: { id: "Q", src: "/assets/achievement img/q.png" },
  R: { id: "R", src: "/assets/achievement img/r.png" },
  S: { id: "S", src: "/assets/achievement img/s.png" },
  T: { id: "T", src: "/assets/achievement img/t.png" },
  U: { id: "U", src: "/assets/achievement img/u.png" },
  V: { id: "V", src: "/assets/achievement img/v.png" },
  W: { id: "W", src: "/assets/achievement img/w.png" },
  X: { id: "X", src: "/assets/achievement img/x.png" },
  Y: { id: "Y", src: "/assets/achievement img/y.png" },
  Z: { id: "Z", src: "/assets/achievement img/z.png" },
};

interface AchievementDetail {
  year: string;
  name: string;
  text: string;
}

// Fields shown in the detail panel that are user-editable via the single
// Submit button (year, name, left column text, right column text).
interface EditableFields {
  year: string;
  name: string;
  leftText: string;
  rightText: string;
}

const achievementData: Record<string, AchievementDetail> = letters.reduce(
  (acc, letter) => {
    acc[letter] = {
      year: "1998",
      name: "Sunil Shukla",
      text: "Legacy is the lasting impact that a person, organization, or generation leaves behind through its actions, values, and achievements. It is not limited to wealth or material possessions; it also includes ideas, traditions, relationships, and contributions that continue to influence others long after the original source is gone. A positive legacy is often built through consistent effort, integrity, and a commitment to helping others.",
    };
    return acc;
  },
  {} as Record<string, AchievementDetail>
);

const TEXT_LIMIT = 200;

// Achievement content (year/name/left/right text) is persisted through the
// same generic board-quote endpoint Vision Board uses (one text field per
// board_type + position_id). We store it here as a JSON string and parse it
// back out, so no backend changes are needed to support the extra fields.
function parseFields(letter: string, raw?: string): EditableFields {
  const fallback: EditableFields = {
    year: achievementData[letter].year,
    name: achievementData[letter].name,
    leftText: achievementData[letter].text,
    rightText: achievementData[letter].text,
  };
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return {
      year: parsed.year ?? fallback.year,
      name: parsed.name ?? fallback.name,
      leftText: parsed.leftText ?? fallback.leftText,
      rightText: parsed.rightText ?? fallback.rightText,
    };
  } catch {
    // Not JSON (e.g. legacy/manual value) - treat it as plain text for both columns.
    return { ...fallback, leftText: raw, rightText: raw };
  }
}

function cssPolygonToSvgPoints(css: string): string {
  return css
    .replace("polygon(", "")
    .replace(")", "")
    .split(",")
    .map((pair) => pair.trim().replace(/\s+/g, ",").replace(/%/g, ""))
    .join(" ");
}

interface LetterBoxProps {
  letter: string;
  imageUrl: string | null;
  isActive: boolean;
  onSelect: (letter: string) => void;
  onImageError: (letter: string) => void;
  boxRef: (el: HTMLDivElement | null) => void;
  crop?: { zoom: number; x: number; y: number } | null;
}

function LetterBox({
  letter,
  imageUrl,
  isActive,
  onSelect,
  onImageError,
  boxRef,
  crop,
}: LetterBoxProps) {
  const clipId = `clip-${letter}`;
  const points = cssPolygonToSvgPoints(clipPaths[letter]);

  // The clip shapes are all drawn against a fixed 0-100 square viewBox, so
  // (unlike a real on-screen box) we always know its size here — no need to
  // measure it. We just need each image's own natural size to do the same
  // cover+pan+zoom math CropImg uses elsewhere, expressed in these 100
  // viewBox units instead of real pixels.
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!imageUrl) {
      setNatural({ w: 0, h: 0 });
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  const BOX = 100; // the viewBox is always 0 0 100 100
  const zoom = Math.max(1, Number(crop?.zoom ?? 1) || 1);
  const rawX = Number(crop?.x ?? 0) || 0;
  const rawY = Number(crop?.y ?? 0) || 0;

  let imgGeom: { x: number; y: number; w: number; h: number } | null = null;
  if (natural.w > 0 && natural.h > 0) {
    const baseScale = Math.max(BOX / natural.w, BOX / natural.h) * zoom;
    const renderW = natural.w * baseScale;
    const renderH = natural.h * baseScale;
    // Saved pan offsets were captured in the "Adjust Photo" editor's fixed
    // 280px square viewport — rescale into these 100 viewBox units (also
    // square, so this is a single uniform factor, unlike a non-square box).
    const panScale = BOX / EDITOR_VIEWPORT_PX;
    let x = BOX / 2 - renderW / 2 + rawX * panScale;
    let y = BOX / 2 - renderH / 2 + rawY * panScale;
    // Clamp so the image always fully covers the shape — same reasoning as
    // CropImg elsewhere: cover-fit guarantees renderW/H >= BOX, so this
    // range is always valid.
    x = Math.min(0, Math.max(BOX - renderW, x));
    y = Math.min(0, Math.max(BOX - renderH, y));
    imgGeom = { x, y, w: renderW, h: renderH };
  }

  return (
    <div
      ref={boxRef}
      className={`letter-box ${isActive ? "letter-box--active" : ""}`}
      aria-label={`Letter ${letter}`}
      onClick={() => onSelect(letter)}
      role="button"
      tabIndex={0}
    >
      <svg
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          <clipPath id={clipId}>
            <polygon points={points} />
          </clipPath>
        </defs>

        {imageUrl && imgGeom ? (
          <image
            href={imageUrl}
            x={imgGeom.x}
            y={imgGeom.y}
            width={imgGeom.w}
            height={imgGeom.h}
            preserveAspectRatio="none"
            clipPath={`url(#${clipId})`}
            onError={() => onImageError(letter)}
          />
        ) : (
          <>
            <polygon points={points} fill="#e2e8f0" />
            <text
              x="50"
              y="55"
              textAnchor="middle"
              fontSize="28"
              fontWeight="bold"
              fill="#94a3b8"
            >
              {letter}
            </text>
          </>
        )}

        <polygon
          points={points}
          fill="none"
          stroke="white"
          strokeWidth="1.5"
        />
      </svg>

      <div className="letter-overlay">{letter}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// CROP / ADJUST EDITOR — drag to pan, slider to zoom.
// Copied 1:1 from Vision Board so the two pages behave identically.
// ─────────────────────────────────────────────────────────
interface CropSettings {
  zoom: number;
  x: number;
  y: number;
}

interface CropTarget {
  id: string; // letter, e.g. "A"
  src: string; // uncropped source image to crop from
  aspect: number; // width / height
  initialZoom?: number;
  initialPos?: { x: number; y: number };
  isNewFile?: boolean; // true only when src came from a fresh device pick (handleFilePicked) — re-adjusts of an already-placed photo leave this unset
}

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
  const VIEWPORT_H = 280; // square crop, matches the achievement letter frame
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
        <p className="nb-crop-hint">Drag to reposition · use the slider to zoom.</p>

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

export default function StudentsAchievement() {
  const location = useLocation();
  // Passed from Editorcardinnerpage.tsx via handleToolClick's navigate state
  // (same pattern Vision Board uses) — tells us whose project this is.
  const customerId = (location.state as any)?.customerId;

  // Images: position_id -> view_url, shared with the Media Library's
  // "Achievement" category (board_type "achievement", id A-Z).
  const { placements, placementDetails, isLoading: placementsLoading } = useBoardPlacements(
    "achievement",
    customerId
  );
  // Text content: position_id -> JSON string of { year, name, leftText, rightText }.
  const { quotes, isLoading: quotesLoading, saveQuote } = useBoardQuotes(
    "achievement",
    customerId
  );

  // Local overrides so the UI updates instantly after a successful upload,
  // without waiting for a refetch (mirrors Vision Board's crop-apply flow).
  const [localImages, setLocalImages] = useState<Record<string, string>>({});
  // Uncropped source per letter, kept around so re-opening "Adjust" doesn't
  // re-crop an already-cropped image (same idea as Vision Board's origImg).
  const [origImages, setOrigImages] = useState<Record<string, string>>({});
  // Last-used zoom/pan per letter, so re-opening "Adjust" resumes where you left off.
  const [imgCrops, setImgCrops] = useState<Record<string, CropSettings>>({});
  // gallery_id currently placed per letter — reused on re-adjust so we don't
  // upload a duplicate image just to change pan/zoom.
  const [galleryIds, setGalleryIds] = useState<Record<string, number>>({});

  // Hydrate galleryIds + any previously-saved crop transform from the server
  // once placements load (also makes crop state survive a page refresh).
  useEffect(() => {
    const ids: Record<string, number> = {};
    const crops: Record<string, CropSettings> = {};
    Object.entries(placementDetails).forEach(([letter, row]) => {
      ids[letter] = row.gallery_id;
      if (row.crop_zoom != null || row.crop_pos_x != null || row.crop_pos_y != null) {
        crops[letter] = {
          zoom: Number(row.crop_zoom ?? 1),
          x: Number(row.crop_pos_x ?? 0),
          y: Number(row.crop_pos_y ?? 0),
        };
      }
    });
    // Server data wins per-key on every hydrate (placementDetails is the
    // source of truth) — previously this merged as {...ids, ...prev}, which
    // meant local state always won and a freshly-saved crop_zoom/pos could
    // be masked by a stale local value after a refetch.
    if (Object.keys(ids).length > 0) setGalleryIds((prev) => ({ ...prev, ...ids }));
    if (Object.keys(crops).length > 0) setImgCrops((prev) => ({ ...prev, ...crops }));
  }, [placementDetails]);
  const [brokenLetters, setBrokenLetters] = useState<Record<string, boolean>>({});
  const [uploadingLetter, setUploadingLetter] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // The crop/adjust modal — null when closed.
  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null);

  const [selectedLetter, setSelectedLetter] = useState<string>("A");

  // Local edit buffer — nothing commits to the backend until Submit is pressed.
  const [draft, setDraft] = useState<EditableFields>(() => parseFields("A"));

  const trackContainerRef = useRef<HTMLDivElement | null>(null);
  const letterRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Saved (committed) values per letter, derived from the fetched quotes.
  const savedFields: Record<string, EditableFields> = {};
  letters.forEach((l) => {
    savedFields[l] = parseFields(l, quotes[l]);
  });

  // Resolved image per letter: local upload override > saved placement
  // (from this page OR the Media Library) > seed default > broken fallback.
  const imageMap: Record<string, string | null> = {};
  letters.forEach((l) => {
    if (localImages[l]) {
      imageMap[l] = localImages[l];
    } else if (placements[l]) {
      imageMap[l] = placements[l];
    } else if (!brokenLetters[l]) {
      imageMap[l] = defaultSeedImages[l]?.src ?? null;
    } else {
      imageMap[l] = null;
    }
  });

  const isLoading = placementsLoading || quotesLoading;

  // When the selected letter (or freshly-loaded saved fields) changes, load
  // its saved fields into the draft buffer (discarding unsaved edits on the
  // previous letter).
  useEffect(() => {
    setDraft(parseFields(selectedLetter, quotes[selectedLetter]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLetter, quotes]);

  // Wheel-to-horizontal-scroll on the A-Z strip. Depends on `isLoading` so it
  // re-attaches once the real container is actually in the DOM (see notes in
  // the previous fix — this effect used to run once on mount with `[]`, but
  // while isLoading was still true the container hadn't rendered yet, so the
  // listener never got attached).
  useEffect(() => {
    if (isLoading) return;

    const el = trackContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      const maxScrollLeft = el.scrollWidth - el.clientWidth;
      if (maxScrollLeft <= 0) return;

      const atStart = el.scrollLeft <= 0.5;
      const atEnd = el.scrollLeft >= maxScrollLeft - 0.5;

      if (e.deltaY < 0 && atStart) return;
      if (e.deltaY > 0 && atEnd) return;

      e.preventDefault();
      const next = el.scrollLeft + e.deltaY;
      el.scrollLeft = Math.max(0, Math.min(next, maxScrollLeft));
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [isLoading]);

  const handleImageError = useCallback((letter: string) => {
    setBrokenLetters((prev) => ({ ...prev, [letter]: true }));
  }, []);

  const handleSelectLetter = useCallback((letter: string) => {
    setSelectedLetter(letter);
    const node = letterRefs.current[letter];
    if (node) {
      node.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, []);

  // Opens the crop editor on the image already showing for this letter
  // (uses the stored uncropped source if we have one, so re-adjusting
  // doesn't compound crops).
  const openAdjust = (letter: string) => {
    const src = origImages[letter] ?? imageMap[letter];
    if (!src) return;
    setCropTarget({
      id: letter,
      src,
      aspect: 1,
      initialZoom: imgCrops[letter]?.zoom,
      initialPos: imgCrops[letter] ? { x: imgCrops[letter].x, y: imgCrops[letter].y } : undefined,
    });
  };

  // "Change Image" picks a brand-new file from disk, then hands it straight
  // to the crop editor instead of uploading it immediately — matches Vision
  // Board's flow (pick/point at a source -> zoom & pan -> Apply -> upload).
  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setCropTarget({ id: selectedLetter, src: dataUrl, aspect: 1, isNewFile: true });
    };
    reader.readAsDataURL(file);
  };

  // Apply always updates the local preview immediately. A genuinely new
  // file (isNewFile) gets uploaded to the Media Library and placed. A plain
  // re-adjustment (drag/zoom on an already-placed photo) reuses that same
  // gallery_id and only sends the new crop numbers — no re-upload, so
  // re-adjusting never creates a duplicate image in the Media Library.
  const handleCropApply = async (dataUrl: string, crop: CropSettings) => {
    if (!cropTarget) return;
    const letter = cropTarget.id;
    const sourceForReadjust = cropTarget.src;

    setLocalImages((prev) => ({ ...prev, [letter]: sourceForReadjust }));
    setOrigImages((prev) => ({ ...prev, [letter]: sourceForReadjust }));
    setImgCrops((prev) => ({ ...prev, [letter]: crop }));
    setBrokenLetters((prev) => ({ ...prev, [letter]: false }));
    setCropTarget(null);

    if (!customerId) {
      toast.warning("No project selected — this image won't be saved.");
      return;
    }

    // A newly selected file must replace the current gallery item. Reuse the
    // existing id only when this is a crop-only adjustment of the same source.
    const existingGalleryId = cropTarget.isNewFile
      ? undefined
      : placementDetails[letter]?.gallery_id ?? galleryIds[letter];

    setUploadingLetter(letter);
    try {
      let galleryId = existingGalleryId;

      // Re-adjusting an existing placement must never create another Media
      // Library item. Only a position with no gallery_id uploads a new file.
      if (galleryId == null) {
        // Store the original source. The crop itself lives exclusively in
        // board_placements so user-side views can reproduce it responsively
        // without applying the transform twice to an already-baked crop.
        const blob = await (await fetch(sourceForReadjust)).blob();
        const fileType = blob.type || "image/jpeg";
        const fileName = `achievement-${letter}-${Date.now()}.jpg`;

        const urlRes = await api.post(`/customer/${customerId}/media-library/upload-url`, {
          fileName,
          fileType,
        });
        const { uploadUrl, key } = urlRes.data.data;

        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": fileType },
          body: blob,
        });
        if (!uploadRes.ok) throw new Error("Image upload failed");

        const saveRes = await api.post(`/customer/${customerId}/media-library`, { key });
        const gallery = saveRes.data.data;
        galleryId = gallery.id;
        setGalleryIds((prev) => ({ ...prev, [letter]: gallery.id }));
      }

      await api.put(`/customer/${customerId}/board-placement`, {
        board_type: "achievement",
        position_id: letter,
        gallery_id: galleryId,
        crop_zoom: crop.zoom,
        crop_pos_x: crop.x,
        crop_pos_y: crop.y,
      });

      toast.success("Image saved");
    } catch (err) {
      console.error("Failed to save achievement image", err);
      toast.error("Failed to upload image");
    } finally {
      setUploadingLetter(null);
    }
  };

  // Save year / name / left text / right text for the selected letter, all
  // in one commit, via the generic board-quote endpoint (as a JSON string).
  const handleSubmit = async () => {
    if (!customerId) {
      toast.warning("No project selected — this won't be saved.");
      return;
    }
    setSubmitting(true);
    try {
      await saveQuote(selectedLetter, JSON.stringify(draft));
      toast.success("Achievement saved");
    } catch (err) {
      console.error("Failed to save achievement", err);
      toast.error("Failed to save achievement");
    } finally {
      setSubmitting(false);
    }
  };

  const detailImage = imageMap[selectedLetter] ?? null;
  const current = savedFields[selectedLetter];
  const isDirty = JSON.stringify(current) !== JSON.stringify(draft);
  const isUploadingCurrent = uploadingLetter === selectedLetter;

  if (isLoading) {
    return <div className="editordashboard-container">Loading achievements...</div>;
  }

  return (
    <div className="editordashboard-container">
      <div className="alphabet-wrapper">
        <BackButton />
        {/* A-Z scrollable strip */}
        <main className="alphabet-main">
          <div className="alphabet-track-container" ref={trackContainerRef}>
            <div className="alphabet-grid">
              {letters.map((letter) => (
                <LetterBox
                  key={letter}
                  letter={letter}
                  imageUrl={imageMap[letter] ?? null}
                  isActive={letter === selectedLetter}
                  onSelect={handleSelectLetter}
                  onImageError={handleImageError}
                  boxRef={(el) => {
                    letterRefs.current[letter] = el;
                  }}
                  crop={imgCrops[letter]}
                />
              ))}
            </div>
          </div>
        </main>

        {/* Detail panel for selected letter */}
        <section className="achievement-detail">
          <div className="achievement-detail__arch">
            {detailImage && (
              <div className="achievement-detail__arch-bg">
                <CropImg
                  src={detailImage}
                  alt=""
                  crop={imgCrops[selectedLetter]}
                  className="achievement-detail__arch-bg-image"
                />
              </div>
            )}

            <div className="achievement-detail__content">
              <div
                className="achievement-detail__center achievement-detail__center--clickable"
                onClick={() => detailImage && openAdjust(selectedLetter)}
                role="button"
                tabIndex={0}
                title="Click to adjust this photo"
              >
                {detailImage ? (
                  <CropImg
                    src={detailImage}
                    alt={`Achievement ${selectedLetter}`}
                    crop={imgCrops[selectedLetter]}
                    className="achievement-detail__image"
                  />
                ) : (
                  <div className="achievement-detail__image-fallback">
                    <img
                      src={imageMap[selectedLetter] ?? "/assets/default-image.png"}
                      alt={selectedLetter}
                      className="achievement-detail__image"
                    />
                  </div>
                )}

                {/* File picker for a brand-new image (opens the crop editor) */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFilePicked}
                  style={{ display: "none" }}
                />
                <div className="achievement-detail__image-actions">
                  <button
                    type="button"
                    className="achievement-detail__upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingCurrent}
                  >
                    {isUploadingCurrent ? "Uploading..." : "Change Image"}
                  </button>
                  {detailImage && (
                    <button
                      type="button"
                      className="achievement-detail__upload-btn"
                      onClick={() => openAdjust(selectedLetter)}
                      disabled={isUploadingCurrent}
                    >
                      Adjust Photo
                    </button>
                  )}
                </div>
              </div>

              {/* Year (left) + Name (right) — now editable inputs instead
                  of static spans, styled to look the same until focused */}
              <div className="achievement-detail__meta">
                <input
                  className="achievement-detail__year-input"
                  value={draft.year}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, year: e.target.value }))
                  }
                  placeholder="Year"
                />
                <input
                  className="achievement-detail__name-input"
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Name"
                />
              </div>

              {/* Two editable columns, same position/look as before, but
                  now textareas instead of read-only paragraphs */}
              <div className="achievement-detail__columns">
                <div className="achievement-detail__col">
                  <textarea
                    className="achievement-detail__col-textarea"
                    value={draft.leftText}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, leftText: e.target.value }))
                    }
                    rows={4}
                    placeholder="Left column text..."
                  />
                </div>
                <div className="achievement-detail__col">
                  <textarea
                    className="achievement-detail__col-textarea"
                    value={draft.rightText}
                    onChange={(e) =>
                      setDraft((prev) => ({ ...prev, rightText: e.target.value }))
                    }
                    rows={4}
                    placeholder="Right column text..."
                  />
                </div>
              </div>

              <button
                type="button"
                className="achievement-detail__submit-btn"
                onClick={handleSubmit}
                disabled={!isDirty || submitting}
              >
                {submitting ? "Saving..." : "Submit"}
              </button>
            </div>
          </div>
        </section>
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
  );
}