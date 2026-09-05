import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import BackButton from "../../../components/BackButton";

/**
 * Legacytimeline — CUSTOMER/SCHOOL SIDE
 * ------------------------------------------------------------------
 * Identical component to the editor side (same dot-reveal game, same
 * click-to-navigate behavior) — the ONLY difference is innerPagePath
 * defaults to the SCHOOL detail route instead of the editor's
 * protected one. That mismatch was the actual bug: clicking a dot
 * tried to navigate to /editor/Legacyimginnerpage, which a customer
 * role can't access, so it silently redirected elsewhere instead of
 * landing on the real detail page.
 */

export interface LegacytimelineProps {
    years?: number;
    label?: string;
    targetDotCount?: number;
    backgroundDotColor?: string;
    dividerColor?: string;
    idleColor?: string;
    accentColor?: string;
    lockedColor?: string;
    onComplete?: () => void;
    innerPagePath?: string;
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

const PATH_TWO =
    "M70,110 C70,55 110,28 150,28 C195,28 232,55 232,97 C232,142 195,168 150,198 C118,220 88,246 62,278 L238,278";

const PATH_FIVE =
    "M215,28 L95,28 L95,140 C95,140 138,117 170,130 C212,147 227,185 216,221 C205,260 165,278 129,268 C106,262 90,248 80,225";

const BASE_CONTENT_W = 600;
const VIEW_H = 320;
const BG_GRID_SPACING = 16;
const CLEAR_RADIUS = 13;

function evenlySpacedPoints(
    pathEl: SVGPathElement,
    count: number,
    xOffset: number,
    group: "two" | "five"
): NumberDot[] {
    const total = pathEl.getTotalLength();
    const points: NumberDot[] = [];
    for (let i = 0; i < count; i++) {
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
    innerPagePath = "/school/legacyimginnerpage",
    className = "",
}: LegacytimelineProps) {
    const navigate = useNavigate();
    const path2Ref = useRef<SVGPathElement | null>(null);
    const path5Ref = useRef<SVGPathElement | null>(null);
    const boxRef = useRef<HTMLDivElement | null>(null);

    const [viewW, setViewW] = useState(BASE_CONTENT_W);
    const [numberDots, setNumberDots] = useState<NumberDot[]>([]);
    const [backgroundDots, setBackgroundDots] = useState<BackgroundDot[]>([]);
    const [revealed, setRevealed] = useState<Set<string>>(new Set());
    const [completed, setCompleted] = useState(false);

    useEffect(() => {
        if (!boxRef.current) return;
        const el = boxRef.current;

        const measure = () => {
            const w = el.clientWidth;
            const h = el.clientHeight;
            if (w > 0 && h > 0) {
                const computedW = VIEW_H * (w / h);
                setViewW(Math.max(BASE_CONTENT_W, computedW));
            }
        };

        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        if (!path2Ref.current || !path5Ref.current) return;

        const clampedTarget = Math.max(30, Math.min(45, targetDotCount));
        const len2 = path2Ref.current.getTotalLength();
        const len5 = path5Ref.current.getTotalLength();
        const totalLen = len2 + len5;

        const count2 = Math.max(10, Math.round(clampedTarget * (len2 / totalLen)));
        const count5 = Math.max(10, clampedTarget - count2);

        const contentOffset = (viewW - BASE_CONTENT_W) / 2;

        const dots2 = evenlySpacedPoints(path2Ref.current, count2, contentOffset, "two");
        const dots5 = evenlySpacedPoints(path5Ref.current, count5, contentOffset + 300, "five");

        const allNumberDots = [...dots2, ...dots5].map((d, i) => ({
            ...d,
            id: `dot-${i + 1}`,
        }));
        setNumberDots(allNumberDots);

        const cols = Math.floor(viewW / BG_GRID_SPACING);
        const rows = Math.floor(VIEW_H / BG_GRID_SPACING);
        const offsetX = (viewW - cols * BG_GRID_SPACING) / 2 + BG_GRID_SPACING / 2;
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
    }, [targetDotCount, viewW]);

    const numberIds = useMemo(() => numberDots.map((d) => d.id), [numberDots]);

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

        navigate(`${innerPagePath}?id=${encodeURIComponent(dot.id)}`);
    };

    const revealedCount = revealed.size;
    const totalCount = numberIds.length;
    const resolvedLabel = label ?? `${years} Years`;
    const dividerX = viewW / 2;

    return (
        <div
            className={className}
            style={{
                width: "100%",
                height: "100dvh",
                display: "flex",
                flexDirection: "column",
                padding: "20px",
                boxSizing: "border-box",
                gap: 16,
                overflow: "hidden",
            }}
        >
            <BackButton />
            <div
                ref={boxRef}
                style={{
                    width: "100%",
                    flex: 1,
                    minHeight: 0,
                    borderRadius: 16,
                    overflow: "hidden",
                    background: "#ffffff",
                    border: "1px solid #eef0f4",
                    boxShadow: "0 1px 2px rgba(16, 24, 40, 0.04)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <svg
                    width="100%"
                    height="100%"
                    viewBox={`0 0 ${viewW} ${VIEW_H}`}
                    preserveAspectRatio="none"
                    style={{ display: "block" }}
                >
                    <path ref={path2Ref} d={PATH_TWO} fill="none" stroke="none" />
                    <path ref={path5Ref} d={PATH_FIVE} fill="none" stroke="none" />

                    <line
                        x1={dividerX}
                        y1={0}
                        x2={dividerX}
                        y2={VIEW_H}
                        stroke={dividerColor}
                        strokeWidth={2}
                    />

                    {backgroundDots.map((dot) => (
                        <circle key={dot.id} cx={dot.x} cy={dot.y} r={1.6} fill={backgroundDotColor} />
                    ))}

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
                                    aria-label={`Number dot ${dot.id}${isLocked ? ", locked" : isOn ? ", revealed" : ""}`}
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
                    flexShrink: 0,
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
                </div>
            </div>
        </div>
    );
}