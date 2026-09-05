import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import BackButton from "../../../components/BackButton";

/**
 * Legacytimeline
 * ------------------------
 * Alternative to DotNumberReveal: instead of ~100+ highlighted dots
 * (one per background grid cell that touches the number), this version
 * places a controlled, small number of dots (30-45 by default) directly
 * along the "2" and "5" paths — evenly spaced by actual arc length, so
 * fewer dots still trace the shape cleanly, just as clean marks rather
 * than a dense dot-matrix.
 *
 * It also displays a "{years} Years" label, so this variant doubles as
 * an anniversary mark: e.g. years={25} → "25 Years" beneath the dots.
 *
 * Same interaction model as the original: every highlighted dot is
 * individually clickable, turns to the accent color once revealed, and
 * onComplete fires once every dot has been clicked.
 *
 * Clicking any unlocked dot also navigates to /Legacyimginnerpage,
 * passing that dot's id as a query param (e.g. /Legacyimginnerpage?id=dot-5)
 * so the destination page knows which dot/image to show.
 */

export interface LegacytimelineProps {
    /** Number to show in the "{years} Years" label under the visual. */
    years?: number;
    /** Override the label entirely (defaults to "{years} Years"). */
    label?: string;
    /** Total highlighted dots across both digits. Clamped to 30-45. */
    targetDotCount?: number;
    /** Color of the plain (non-number) background dots. */
    backgroundDotColor?: string;
    /** Color of the vertical divider between the two cells. */
    dividerColor?: string;
    /** Color of an un-revealed number dot. */
    idleColor?: string;
    /** Color a number dot turns into once clicked/revealed. */
    accentColor?: string;
    /** Color a locked (not-yet-unlocked) "5" dot is shown in. */
    lockedColor?: string;
    /** Called once, the moment every number dot has been revealed. */
    onComplete?: () => void;
    /** Base path to navigate to when a dot is clicked. */
    innerPagePath?: string;
    /** Extra class name for the outer wrapper. */
    className?: string;
}

interface NumberDot {
    id: string;
    x: number;
    y: number;
    group: "two" | "five";
}

interface BackgroundDot {
    id: string;
    x: number;
    y: number;
}

// Same hand-authored paths as the original component.
const PATH_TWO =
    "M70,110 C70,55 110,28 150,28 C195,28 232,55 232,97 C232,142 195,168 150,198 C118,220 88,246 62,278 L238,278";

const PATH_FIVE =
    "M215,28 L95,28 L95,140 C95,140 138,117 170,130 C212,147 227,185 216,221 C205,260 165,278 129,268 C106,262 90,248 80,225";

const VIEW_W = 600;
const VIEW_H = 320;
const BG_GRID_SPACING = 16;
const CLEAR_RADIUS = 13; // keeps plain background dots from crowding the highlighted dots

function evenlySpacedPoints(
    pathEl: SVGPathElement,
    count: number,
    xOffset: number,
    group: "two" | "five"
): NumberDot[] {
    const total = pathEl.getTotalLength();
    const points: NumberDot[] = [];
    for (let i = 0; i < count; i++) {
        // count - 1 as denominator so first and last dot sit right at the
        // path's start/end, giving a shape with clean edges.
        const dist = count === 1 ? 0 : (i / (count - 1)) * total;
        const p = pathEl.getPointAtLength(dist);
        points.push({ id: "", x: p.x + xOffset, y: p.y, group });
    }
    return points;
}

export default function Legacytimeline({
    years = 25,
    label,
    targetDotCount = 38,
    backgroundDotColor = "#d9dce3",
    dividerColor = "#3aa8ff",
    idleColor = "#111318",
    accentColor = "#e8622c",
    lockedColor = "#c7cad1",
    onComplete,
    innerPagePath = "/editor/Legacyimginnerpage",
    className = "",
}: LegacytimelineProps) {
    const navigate = useNavigate();
    const location = useLocation();
    // Passed from Editorcardinnerpage.tsx via handleToolClick's navigate
    // state — must be re-forwarded to the inner page below, or every save
    // there falls back to a local-only preview.
    const customerId = (location.state as any)?.customerId;
    const path2Ref = useRef<SVGPathElement | null>(null);
    const path5Ref = useRef<SVGPathElement | null>(null);

    const [numberDots, setNumberDots] = useState<NumberDot[]>([]);
    const [backgroundDots, setBackgroundDots] = useState<BackgroundDot[]>([]);
    const [revealed, setRevealed] = useState<Set<string>>(new Set());
    const [completed, setCompleted] = useState(false);

    useEffect(() => {
        if (!path2Ref.current || !path5Ref.current) return;

        const clampedTarget = Math.max(30, Math.min(45, targetDotCount));
        const len2 = path2Ref.current.getTotalLength();
        const len5 = path5Ref.current.getTotalLength();
        const totalLen = len2 + len5;

        // Split the dot budget proportionally to each digit's path length,
        // so neither digit looks over- or under-represented.
        const count2 = Math.max(10, Math.round(clampedTarget * (len2 / totalLen)));
        const count5 = Math.max(10, clampedTarget - count2);

        const dots2 = evenlySpacedPoints(path2Ref.current, count2, 0, "two");
        const dots5 = evenlySpacedPoints(path5Ref.current, count5, 300, "five");

        // Renumber every dot sequentially (dot-1, dot-2, ... dot-N) across both
        // digits combined, so each dot has one stable, predictable id that an
        // external page can key off of (e.g. to look up a matching image).
        const allNumberDots = [...dots2, ...dots5].map((d, i) => ({
            ...d,
            id: `dot-${i + 1}`,
        }));
        setNumberDots(allNumberDots);

        // Background grid, skipping any cell too close to a number dot.
        const cols = Math.floor(VIEW_W / BG_GRID_SPACING);
        const rows = Math.floor(VIEW_H / BG_GRID_SPACING);
        const offsetX = (VIEW_W - cols * BG_GRID_SPACING) / 2 + BG_GRID_SPACING / 2;
        const offsetY = (VIEW_H - rows * BG_GRID_SPACING) / 2 + BG_GRID_SPACING / 2;

        const isNearNumberDot = (x: number, y: number) =>
            allNumberDots.some((d) => {
                const dx = d.x - x;
                const dy = d.y - y;
                return dx * dx + dy * dy <= CLEAR_RADIUS * CLEAR_RADIUS;
            });

        const nextBg: BackgroundDot[] = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x = offsetX + c * BG_GRID_SPACING;
                const y = offsetY + r * BG_GRID_SPACING;
                if (isNearNumberDot(x, y)) continue;
                nextBg.push({ id: `bg-${r}-${c}`, x, y });
            }
        }
        setBackgroundDots(nextBg);
    }, [targetDotCount]);

    const numberIds = useMemo(() => numberDots.map((d) => d.id), [numberDots]);

    // The "5" dots stay locked (grayed out, non-clickable) until every "2"
    // dot has been revealed — so the person must finish 2 in sequence
    // before 5 can be clicked/navigated.
    const twoIds = useMemo(
        () => numberDots.filter((d) => d.group === "two").map((d) => d.id),
        [numberDots]
    );
    const isTwoComplete =
        twoIds.length > 0 && twoIds.every((id) => revealed.has(id));

    useEffect(() => {
        if (
            !completed &&
            numberIds.length > 0 &&
            numberIds.every((id) => revealed.has(id))
        ) {
            setCompleted(true);
            onComplete?.();
        }
    }, [revealed, numberIds, completed, onComplete]);

    const toggle = (dot: NumberDot) => {
        const isLocked = dot.group === "five" && !isTwoComplete;
        if (isLocked) return;

        setRevealed((prev) => {
            const next = new Set(prev);
            next.add(dot.id);
            return next;
        });

        // Navigate to the inner page for this specific dot, passing its id
        // as a query param (e.g. /Legacyimginnerpage?id=dot-5) AND the
        // customerId as navigate state — without this, the inner page has
        // no idea which project it's editing and every save silently no-ops.
        navigate(`${innerPagePath}?id=${encodeURIComponent(dot.id)}`, {
            state: { customerId },
        });
    };

    const revealedCount = revealed.size;
    const totalCount = numberIds.length;
    const resolvedLabel = label ?? `${years} Years`;

    return (
        <div className="editordashboard-container">
            <BackButton />
            <div
                className={className}
                style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}
            >
                <div
                    style={{
                        width: "100%",
                        borderRadius: 16,
                        overflow: "hidden",
                        background: "#ffffff",
                        border: "1px solid #eef0f4",
                        boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
                    }}
                >
                    <svg
                        width="100%"
                        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                        preserveAspectRatio="xMidYMid meet"
                        style={{ display: "block", aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
                    >
                        {/* Hidden measurement paths — never rendered visibly */}
                        <path ref={path2Ref} d={PATH_TWO} fill="none" stroke="none" />
                        <g transform="translate(300,0)">
                            <path ref={path5Ref} d={PATH_FIVE} fill="none" stroke="none" />
                        </g>

                        <line x1={300} y1={0} x2={300} y2={VIEW_H} stroke={dividerColor} strokeWidth={2} />

                        {/* Quiet background grid */}
                        {backgroundDots.map((dot) => (
                            <circle key={dot.id} cx={dot.x} cy={dot.y} r={1.6} fill={backgroundDotColor} />
                        ))}

                        {/* The small set of highlighted, clickable number dots */}
                        {numberDots.map((dot) => {
                            const isOn = revealed.has(dot.id);
                            const isLocked = dot.group === "five" && !isTwoComplete;
                            return (
                                <g key={dot.id} id={dot.id}>
                                    <circle
                                        cx={dot.x}
                                        cy={dot.y}
                                        r={11}
                                        fill="transparent"
                                        style={{ cursor: isLocked ? "not-allowed" : "pointer" }}
                                        onClick={() => toggle(dot)}
                                        role="button"
                                        tabIndex={isLocked ? -1 : 0}
                                        aria-disabled={isLocked}
                                        aria-pressed={isOn}
                                        aria-label={`Number dot ${dot.id}${isLocked ? ", locked" : isOn ? ", revealed" : ""
                                            }`}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                toggle(dot);
                                            }
                                        }}
                                    />
                                    <circle
                                        cx={dot.x}
                                        cy={dot.y}
                                        r={isOn ? 7 : 5.5}
                                        fill={isLocked ? lockedColor : isOn ? accentColor : idleColor}
                                        pointerEvents="none"
                                        style={{ transition: "r 120ms ease, fill 120ms ease" }}
                                    />
                                </g>
                            );
                        })}
                    </svg>
                </div>

                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        fontFamily: "system-ui, sans-serif",
                    }}
                >
                    <span style={{ fontSize: 20, fontWeight: 700, color: "#111318", letterSpacing: 0.2 }}>
                        {resolvedLabel}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 13, color: "#6b7280" }}>
                            {revealedCount} / {totalCount} revealed
                            {completed ? " — complete!" : ""}
                        </span>
                        <button
                            type="button"
                            onClick={() => {
                                setRevealed(new Set());
                                setCompleted(false);
                            }}
                            style={{
                                border: "1px solid #d8dbe3",
                                background: "#fff",
                                borderRadius: 8,
                                padding: "4px 10px",
                                fontSize: 12,
                                cursor: "pointer",
                                color: "#374151",
                            }}
                        >
                            Reset
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}