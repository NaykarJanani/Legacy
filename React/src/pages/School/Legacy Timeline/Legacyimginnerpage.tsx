import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useBoardPlacements } from "../../../hooks/useBoardPlacements";
import { useBoardQuotes } from "../../../hooks/useBoardQuotes";
import BackButton from "../../../components/BackButton";

/**
 * Legacyimginnerpage — CUSTOMER/SCHOOL SIDE (read-only)
 * ------------------------------------------------------------------
 * Same visual template as the editor side's detail page, but with the
 * three text fields shown as plain read-only text instead of editable
 * textareas.
 *
 * Now live: pulls the assigned photo from useBoardPlacements and the
 * saved heading/body/footer bundle from useBoardQuotes, both keyed on
 * board_type = "legacy_timeline", position_id = the dot id (e.g. "dot-7").
 * No customerId is passed to either hook — on this route the backend
 * resolves the logged-in school user automatically. Falls back to
 * DEFAULT_CONTENT / the placeholder photo when nothing's been saved yet.
 */

const TOTAL_DOTS = 38;
const IMAGE_BASE_PATH = "/assets/legacy-images";
const IMAGE_EXT = "png";
const BOARD_TYPE = "legacy_timeline";

function PixelCroppedImage({ src, alt, zoom, x, y, onError }: {
    src: string; alt: string; zoom: number; x: number; y: number; onError: () => void;
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
        ? Math.max(containerSize.width / naturalSize.width, containerSize.height / naturalSize.height) * Math.max(1, zoom)
        : 0;
    const width = naturalSize.width * scale;
    const height = naturalSize.height * scale;
    return <img ref={imageRef} src={src} alt={alt} onError={onError}
        onLoad={(event) => setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
        style={{ position: "absolute", display: "block", width, height,
            left: (containerSize.width - width) / 2 + x * (containerSize.width / 320),
            top: (containerSize.height - height) / 2 + y * (containerSize.height / 213),
            visibility: scale ? "visible" : "hidden" }} />;
}

const ALL_DOT_IDS = Array.from({ length: TOTAL_DOTS }, (_, i) => `dot-${i + 1}`);

interface StaticContent {
    heading: string;
    body: string;
    footer: string;
}

const DEFAULT_CONTENT: StaticContent = {
    heading: "A Journey Through the Years",
    body: "Every school has a story. A story built by visionary founders, dedicated teachers, hardworking students, and supportive parents. Our legacy is not only measured by years but by the countless lives we have inspired, educated, and empowered.Together, we continue to build a future where knowledge, values, and innovation create responsible citizens for tomorrow....",
    footer: "",
};

// Mirrors the editor side's packing scheme — one JSON string in the
// `quote` column holds all three fields.
function parseContent(raw: string | undefined): StaticContent {
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

export default function Legacyimginnerpage() {
    const [searchParams] = useSearchParams();
    const rawId = searchParams.get("id") ?? ALL_DOT_IDS[0];
    const id = ALL_DOT_IDS.includes(rawId) ? rawId : ALL_DOT_IDS[0];

    const dotNumber = useMemo(() => Number(id.replace("dot-", "")), [id]);

    const { placements, placementDetails } = useBoardPlacements(BOARD_TYPE);
    const { quotes } = useBoardQuotes(BOARD_TYPE);

    const [imageError, setImageError] = useState(false);

    useEffect(() => {
        setImageError(false);
    }, [id]);

    const imageSrc = placements[id] ?? `${IMAGE_BASE_PATH}/dot-1.${IMAGE_EXT}`;
    const placement = placementDetails[id];
    const cropZoom = Math.max(1, Number(placement?.crop_zoom ?? 1));
    const cropX = Number(placement?.crop_pos_x ?? 0);
    const cropY = Number(placement?.crop_pos_y ?? 0);
    const content = parseContent(quotes[id]);

    return (
        <div
            style={{
                width: "100%",
                boxSizing: "border-box",
                fontFamily:
                    "'Noto Sans Gujarati', 'Noto Sans', system-ui, -apple-system, sans-serif",
            }}
        >
            <div
                style={{
                    maxWidth: 1280,
                    margin: "0 auto 24px",
                    display: "flex",
                }}
            >
                <BackButton label="Back" fallbackPath="/school/legacytimeline" />
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
                                zoom={cropZoom}
                                x={cropX}
                                y={cropY}
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
                                Photo coming soon
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: content card — plain text, nothing editable */}
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

                        <h2
                            style={{
                                color: "#8a1c2b",
                                fontWeight: 700,
                                fontSize: 26,
                                lineHeight: 1.3,
                                marginBottom: 18,
                                whiteSpace: "pre-wrap",
                                flexShrink: 0,
                            }}
                        >
                            {content.heading}
                        </h2>

                        <p style={{ color: "#3a382f", fontSize: 15.5, lineHeight: 1.7, marginBottom: 18, whiteSpace: "pre-wrap" }}>
                            {content.body}
                        </p>

                        {content.footer && (
                            <p style={{ color: "#6b6a5f", fontSize: 13.5, fontStyle: "italic", whiteSpace: "pre-wrap" }}>
                                {content.footer}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            <div style={{ maxWidth: 1280, margin: "16px auto 0", fontSize: 12, color: "#9a988d" }}>
                {dotNumber} / {TOTAL_DOTS}
            </div>
        </div>
    );
}
