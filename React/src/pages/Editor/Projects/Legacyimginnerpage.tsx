import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../services/api";
import { useBoardPlacements } from "../../../hooks/useBoardPlacements";
import { useBoardQuotes } from "../../../hooks/useBoardQuotes";
import "./Legacyimginnerpage.css";

const TOTAL_DOTS = 38;
const IMAGE_BASE_PATH = "/assets/legacy-images";
const IMAGE_EXT = "png";
const BOARD_TYPE = "legacy_timeline";

const ALL_DOT_IDS = Array.from({ length: TOTAL_DOTS }, (_, i) => `dot-${i + 1}`);

interface EditableContent {
    heading: string;
    body: string;
    footer: string;
}

interface CropSettings {
    zoom: number;
    x: number;
    y: number;
}

function PixelCroppedImage({ src, alt, crop, onError }: {
    src: string; alt: string; crop: CropSettings; onError: () => void;
}) {
    const imageRef = useRef<HTMLImageElement>(null);
    const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const container = imageRef.current?.parentElement;
        if (!container) return;
        const measure = () => setContainerSize({ width: container.clientWidth, height: container.clientHeight });
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    const scale = naturalSize.width && naturalSize.height
        ? Math.max(containerSize.width / naturalSize.width, containerSize.height / naturalSize.height) * Math.max(1, crop.zoom)
        : 0;
    const width = naturalSize.width * scale;
    const height = naturalSize.height * scale;
    return <img ref={imageRef} src={src} alt={alt} onError={onError}
        onLoad={(event) => setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
        style={{ position: "absolute", display: "block", width, height,
            left: (containerSize.width - width) / 2 + crop.x * (containerSize.width / 320),
            top: (containerSize.height - height) / 2 + crop.y * (containerSize.height / 213),
            visibility: scale ? "visible" : "hidden" }} />;
}

interface CropTarget {
    id: string;
    src: string;
    initialZoom?: number;
    initialPos?: { x: number; y: number };
}

const DEFAULT_CONTENT: EditableContent = {
    heading: "આદિવાસી\nબાળકો માટે વિશેષ પ્રયાસો",
    body: "અહીં આ ફોટા વિશે તમારું લખાણ ટાઈપ કરો...",
    footer: "",
};

// The board_quotes table only has a single `quote` string column, so all
// three editable fields are packed into one JSON string — no schema change
// needed. School side unpacks it the same way.
function parseContent(raw: string | undefined): EditableContent {
    if (!raw) return { ...DEFAULT_CONTENT };
    try {
        const parsed = JSON.parse(raw);
        return {
            heading: typeof parsed.heading === "string" ? parsed.heading : DEFAULT_CONTENT.heading,
            body: typeof parsed.body === "string" ? parsed.body : DEFAULT_CONTENT.body,
            footer: typeof parsed.footer === "string" ? parsed.footer : DEFAULT_CONTENT.footer,
        };
    } catch {
        return { ...DEFAULT_CONTENT };
    }
}

/** Auto-growing textarea: height always matches its content. */
function AutoTextarea({
    value,
    onChange,
    onBlur,
    style,
    placeholder,
    ariaLabel,
}: {
    value: string;
    onChange: (v: string) => void;
    onBlur?: (v: string) => void;
    style?: React.CSSProperties;
    placeholder?: string;
    ariaLabel: string;
}) {
    const ref = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
    }, [value]);

    return (
        <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => onBlur?.(e.target.value)}
            placeholder={placeholder}
            aria-label={ariaLabel}
            rows={1}
            style={{
                width: "100%",
                resize: "none",
                overflow: "hidden",
                border: "none",
                outline: "none",
                background: "transparent",
                fontFamily: "inherit",
                padding: 0,
                margin: 0,
                ...style,
            }}
        />
    );
}

// ─────────────────────────────────────────────────────────
// CROP / ADJUST EDITOR — drag to pan, slider to zoom.
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
    const VIEWPORT_W = 320;
    const VIEWPORT_H = 213; // 3:2, matches the photo box on this page
    const FINAL_W = 1200;
    const FINAL_H = 800;

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
            onApply(target.src, { zoom, x: pos.x, y: pos.y });
        }
    };

    return (
        <div className="li-crop-overlay">
            <div className="li-crop-modal">
                <h4>Adjust Photo</h4>
                <p className="li-crop-hint">Drag to reposition · use the slider to zoom.</p>

                <div
                    className={`li-crop-viewport ${isDragging ? "li-crop-viewport--dragging" : ""}`}
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
                        className="li-crop-img"
                        style={{
                            width: natural.w * baseScale * zoom,
                            height: natural.h * baseScale * zoom,
                            left: VIEWPORT_W / 2 - (natural.w * baseScale * zoom) / 2 + pos.x,
                            top: VIEWPORT_H / 2 - (natural.h * baseScale * zoom) / 2 + pos.y,
                        }}
                        alt="Crop preview"
                    />
                </div>

                <div className="li-crop-zoom-row">
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

                {error && <p className="li-crop-error">{error}</p>}

                <div className="li-crop-actions">
                    <button type="button" className="li-crop-btn li-crop-btn--ghost" onClick={onCancel}>
                        Cancel
                    </button>
                    <button type="button" className="li-crop-btn li-crop-btn--solid" onClick={handleApply}>
                        Apply
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Legacyimginnerpage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation();
    const customerId = (location.state as any)?.customerId;

    const rawId = searchParams.get("id") ?? ALL_DOT_IDS[0];
    const id = ALL_DOT_IDS.includes(rawId) ? rawId : ALL_DOT_IDS[0];

    const dotNumber = useMemo(() => Number(id.replace("dot-", "")), [id]);

    const { placements, placementDetails, refetch: refetchPlacements } = useBoardPlacements(BOARD_TYPE, customerId);
    const { quotes, saveQuote } = useBoardQuotes(BOARD_TYPE, customerId);

    const [localImg, setLocalImg] = useState<string | null>(null);
    const [origImg, setOrigImg] = useState<string | null>(null);
    const [imgCrop, setImgCrop] = useState<CropSettings | null>(null);
    const [cropTarget, setCropTarget] = useState<CropTarget | null>(null);
    const [isSavingCrop, setIsSavingCrop] = useState(false);
    const [imageError, setImageError] = useState(false);
    // gallery_id currently placed per dot — reused on re-adjust so nudging
    // zoom/pan never uploads a duplicate image to the Media Library.
    const [galleryIds, setGalleryIds] = useState<Record<string, number>>({});

    // Hydrate galleryIds from the server once placements load — this is what
    // lets a re-adjustment reuse the same image instead of uploading a new
    // one. (Per-dot crop-transform hydration happens in the reset effect
    // below, since that effect also runs on `id` change and must be the
    // last word on imgCrop for the currently-viewed dot.)
    useEffect(() => {
        const ids: Record<string, number> = {};
        Object.entries(placementDetails).forEach(([dotId, row]) => {
            ids[dotId] = row.gallery_id;
        });
        if (Object.keys(ids).length > 0) setGalleryIds((prev) => ({ ...ids, ...prev }));
    }, [placementDetails]);

    const [content, setContent] = useState<EditableContent>(() => parseContent(quotes[id]));
    const [isSavingContent, setIsSavingContent] = useState(false);

    const imageSrc =
        localImg ?? placements[id] ?? `${IMAGE_BASE_PATH}/dot-1.${IMAGE_EXT}`;
    // Reset per-dot local state whenever the id changes (navigated to a
    // different dot) instead of carrying over the previous dot's edits.
    // If the server already has a saved crop transform for this dot, seed
    // it in so re-opening "Adjust" resumes where it left off (and survives
    // a refresh) instead of always starting back at zoom 1 / centered.
    useEffect(() => {
        setContent(parseContent(quotes[id]));
        setImageError(false);
        setLocalImg(null);
        setOrigImg(null);
        const row = placementDetails[id];
        setImgCrop(
            row && (row.crop_zoom != null || row.crop_pos_x != null || row.crop_pos_y != null)
                ? {
                    zoom: Number(row.crop_zoom ?? 1),
                    x: Number(row.crop_pos_x ?? 0),
                    y: Number(row.crop_pos_y ?? 0),
                }
                : null
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Once quotes finish loading (or a save round-trips back into `quotes`),
    // sync the saved value in for the CURRENT dot. Only fires when the raw
    // stored string for this id actually changes, so it never clobbers
    // mid-typing edits.
    useEffect(() => {
        if (quotes[id] !== undefined) {
            setContent(parseContent(quotes[id]));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, quotes[id]]);

    // The reset effect above only runs when `id` changes — if placements are
    // still loading at that moment, this catches the crop transform up once
    // they arrive, without clobbering an adjustment already in progress.
    useEffect(() => {
        const row = placementDetails[id];
        if (!row) return;
        if (row.crop_zoom == null && row.crop_pos_x == null && row.crop_pos_y == null) return;
        setImgCrop((prev) =>
            prev ?? {
                zoom: Number(row.crop_zoom ?? 1),
                x: Number(row.crop_pos_x ?? 0),
                y: Number(row.crop_pos_y ?? 0),
            }
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, placementDetails]);

    const updateContent = (patch: Partial<EditableContent>) => {
        setContent((prev) => ({ ...prev, ...patch }));
    };

    // Saves the full heading+body+footer bundle as one JSON string — fires
    // on blur of any of the three fields (not on every keystroke), same
    // debounce point Vision Board uses for its quote text.
    const persistContent = async (next: EditableContent) => {
        if (!customerId) {
            console.warn("No customerId available — text is a local preview only and will not persist.");
            toast.warning("No project selected — this text won't be saved permanently.");
            return;
        }
        try {
            setIsSavingContent(true);
            await saveQuote(id, JSON.stringify(next));
        } catch (err) {
            console.error("Failed to save content", err);
            toast.error("Could not save this text. Please try again.");
        } finally {
            setIsSavingContent(false);
        }
    };

    const handleFieldBlur = (field: keyof EditableContent, value: string) => {
        const next = { ...content, [field]: value };
        persistContent(next);
    };

    const handleBack = () => {
        // Go back in history instead of pushing a new "/editor/legacytimeline"
        // entry. Pushing a new entry here left a duplicate timeline entry in
        // the history stack, so clicking Back again from the timeline just
        // returned to this inner page instead of leaving the timeline.
        if (window.history.state?.idx > 0) {
            navigate(-1);
        } else {
            navigate("/editor/legacytimeline", { replace: true });
        }
    };

    const openAdjust = () => {
        const src = origImg ?? imageSrc;
        setCropTarget({
            id,
            src,
            initialZoom: imgCrop?.zoom,
            initialPos: imgCrop ? { x: imgCrop.x, y: imgCrop.y } : undefined,
        });
    };

    const handleCropApply = async (dataUrl: string, crop: CropSettings) => {
        if (!cropTarget) return;
        const { src } = cropTarget;
        const existingGalleryId =
            placementDetails[id]?.gallery_id ?? galleryIds[id];

        setLocalImg(src);
        setOrigImg(src);
        setImgCrop(crop);
        setCropTarget(null);
        setImageError(false);

        if (!customerId) {
            console.warn("No customerId available — cropped photo is a local preview only and will not persist.");
            toast.warning("No project selected — this photo won't be saved permanently.");
            return;
        }

        try {
            setIsSavingCrop(true);

            let galleryId = existingGalleryId;

            // Re-adjusting an existing placement only updates its crop fields.
            // Upload to the Media Library solely for a previously-empty dot.
            if (galleryId == null) {
                // Upload the original source and keep pan/zoom in
                // board_placements. Uploading the baked preview here would
                // make the saved transform run a second time on refresh.
                const blob = await (await fetch(src)).blob();
                const fileType = blob.type || "image/jpeg";
                const fileName = `legacy-timeline-${id}-${Date.now()}.jpg`;

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

                const saveRes = await api.post(`/customer/${customerId}/media-library`, { key });
                galleryId = saveRes.data.data.id;
                setGalleryIds((prev) => ({ ...prev, [id]: galleryId as number }));
            }

            await api.put(`/customer/${customerId}/board-placement`, {
                board_type: BOARD_TYPE,
                position_id: id,
                gallery_id: galleryId,
                crop_zoom: crop.zoom,
                crop_pos_x: crop.x,
                crop_pos_y: crop.y,
            });

            await refetchPlacements?.();
            toast.success("Photo saved");
        } catch (err) {
            console.error("Failed to save cropped photo", err);
            toast.error("Could not save this photo — it will reset on refresh. Please try again.");
        } finally {
            setIsSavingCrop(false);
        }
    };

    return (
        <div className="editordashboard-container">
            <div
                style={{
                    width: "100%",
                    boxSizing: "border-box",
                    fontFamily:
                        "'Noto Sans Gujarati', 'Noto Sans', system-ui, -apple-system, sans-serif",
                }}
            >
                <div style={{ maxWidth: 1280, margin: "0 auto 24px", display: "flex" }}>
                    <button
                        type="button"
                        onClick={handleBack}
                        aria-label="Back to timeline"
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            border: "none",
                            background: "#ffffff",
                            color: "#8a1c2b",
                            fontWeight: 600,
                            fontSize: 14,
                            padding: "10px 18px",
                            borderRadius: 999,
                            boxShadow: "0 6px 16px rgba(30, 20, 10, 0.08)",
                            cursor: "pointer",
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                            <path
                                d="M10 12.5L5.5 8L10 3.5"
                                stroke="#8a1c2b"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                        Back
                    </button>
                </div>

                <div
                    style={{
                        maxWidth: 1280,
                        margin: "0 auto",
                        display: "flex",
                        gap: 48,
                        alignItems: "stretch",
                    }}
                >
                    {/* Left: photo for this dot */}
                    <div style={{ position: "relative", flex: "1 1 460px", minWidth: 320 }}>
                        <div
                            aria-hidden
                            style={{
                                position: "absolute",
                                left: -18,
                                bottom: -18,
                                width: 160,
                                height: 160,
                                backgroundImage:
                                    "radial-gradient(circle, #d7d2c4 1.6px, transparent 1.6px)",
                                backgroundSize: "14px 14px",
                                zIndex: 0,
                                display: "none",
                            }}
                        />
                        <div
                            className="li-editable"
                            onClick={openAdjust}
                            style={{
                                position: "relative",
                                zIndex: 1,
                                borderRadius: 28,
                                overflow: "hidden",
                                boxShadow: "0 18px 40px rgba(30, 20, 10, 0.14)",
                                background: "#efece3",
                                aspectRatio: "3 / 2",
                            }}
                        >
                            {!imageError ? (
                                <PixelCroppedImage
                                    src={imageSrc}
                                    alt={`Photo ${dotNumber} of ${TOTAL_DOTS}`}
                                    onError={() => setImageError(true)}
                                    crop={imgCrop ?? { zoom: 1, x: 0, y: 0 }}
                                />
                            ) : (
                                <div
                                    style={{
                                        width: "100%",
                                        height: "100%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "#8a8578",
                                        fontSize: 14,
                                        textAlign: "center",
                                        padding: 24,
                                    }}
                                >
                                    Add {id}.{IMAGE_EXT} to {IMAGE_BASE_PATH}/
                                </div>
                            )}

                            <div className="li-edit-icons">
                                <button
                                    type="button"
                                    className="li-edit-icon-btn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openAdjust();
                                    }}
                                    title="Adjust photo"
                                    aria-label="Adjust photo"
                                >
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M6 2v14a2 2 0 0 0 2 2h14" />
                                        <path d="M18 22V8a2 2 0 0 0-2-2H2" />
                                    </svg>
                                </button>
                            </div>

                            {isSavingCrop && <span className="li-saving-badge">Saving...</span>}
                        </div>
                    </div>

                    {/* Right: editable content card */}
                    <div style={{ position: "relative", flex: "1 1 420px", minWidth: 320, display: "flex" }}>
                        <div
                            style={{
                                position: "relative",
                                width: "100%",
                                background: "#ffffff",
                                borderRadius: 20,
                                boxShadow: "0 10px 30px rgba(30, 20, 10, 0.06)",
                                padding: "36px 40px 30px 44px",
                                boxSizing: "border-box",
                                display: "flex",
                                flexDirection: "column",
                            }}
                        >
                            <div
                                style={{
                                    position: "absolute",
                                    left: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: 4,
                                    borderTopLeftRadius: 20,
                                    borderBottomLeftRadius: 20,
                                    background: "#8a1c2b",
                                }}
                            />

                            <svg
                                width="20"
                                height="46"
                                viewBox="0 0 20 46"
                                style={{ position: "absolute", top: 0, right: 28 }}
                                aria-hidden
                            >
                                <path d="M0 0 H20 V34 L10 46 L0 34 Z" fill="#8a1c2b" />
                            </svg>

                            {isSavingContent && (
                                <span
                                    style={{
                                        position: "absolute",
                                        top: 8,
                                        left: 8,
                                        fontSize: 10,
                                        color: "#9a988d",
                                    }}
                                >
                                    Saving...
                                </span>
                            )}

                            <AutoTextarea
                                value={content.heading}
                                onChange={(v) => updateContent({ heading: v })}
                                onBlur={(v) => handleFieldBlur("heading", v)}
                                ariaLabel="Heading"
                                placeholder="Heading..."
                                style={{
                                    color: "#8a1c2b",
                                    fontWeight: 700,
                                    fontSize: 26,
                                    lineHeight: 1.3,
                                    marginBottom: 18,
                                    whiteSpace: "pre-wrap",
                                    flexShrink: 0,
                                }}
                            />

                            <AutoTextarea
                                value={content.body}
                                onChange={(v) => updateContent({ body: v })}
                                onBlur={(v) => handleFieldBlur("body", v)}
                                ariaLabel="Body text"
                                placeholder="Type the description for this photo..."
                                style={{
                                    color: "#3a382f",
                                    fontSize: 15.5,
                                    lineHeight: 1.7,
                                    marginBottom: 18,
                                }}
                            />

                            <AutoTextarea
                                value={content.footer}
                                onChange={(v) => updateContent({ footer: v })}
                                onBlur={(v) => handleFieldBlur("footer", v)}
                                ariaLabel="Footer note"
                                placeholder="Optional footer note..."
                                style={{
                                    color: "#6b6a5f",
                                    fontSize: 13.5,
                                    fontStyle: "italic",
                                }}
                            />
                        </div>
                    </div>
                </div>

                <div style={{ maxWidth: 1280, margin: "16px auto 0", fontSize: 12, color: "#9a988d" }}>
                    {dotNumber} / {TOTAL_DOTS}
                </div>
            </div>

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
