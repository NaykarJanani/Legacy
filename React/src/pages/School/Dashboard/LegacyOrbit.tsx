import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../services/api";
import BackButton from "../../../components/BackButton";
import "./LegacyOrbit.css";

// ─── Constants ────────────────────────────────────────────────────────────────

const R   = 72;
const RC  = 98;
const RS  = 42;

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubNode {
  id: string;
  label: string;
  angle: number;
}

interface MainNode {
  id: string;
  label: string;
  cx: number;
  cy: number;
  r: number;
  borderColor: string;
  subNodes: SubNode[];
}

interface CanvasBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// ─── API Types ────────────────────────────────────────────────────────────────

interface SubSessionAPI {
  sub_session_id: number;
  title: string; // "CHAPTER 1 — Chapter Name → SubChapter Name"
  seq: number;
}

interface SessionAPI {
  session_id: number;
  title: string;
  category: string;
  sub_sessions: SubSessionAPI[];
}

// ─── Layout Template — exact positions & angles from original ─────────────────
// Each entry defines the fixed visual layout for chapter index 0..10.
// cx, cy, r, borderColor are taken directly from the original NODES.
// subAngles are the original sub-node angles for that slot.

const LAYOUT_TEMPLATE = [
  { cx: 418,  cy: 118,  r: R,     borderColor: "#e8c97a", subAngles: [195, 255, 155, 310, 355] },
  { cx: 172,  cy: 298,  r: R,     borderColor: "#f4a26b", subAngles: [200, 145, 255, 305, 90]  },
  { cx: 388,  cy: 438,  r: R,     borderColor: "#79c9d8", subAngles: [225, 170, 280, 120, 330] },
  { cx: 156,  cy: 580,  r: R - 8, borderColor: "#a78bfa", subAngles: [200, 145, 265, 310]      },
  { cx: 510,  cy: 668,  r: R,     borderColor: "#6ee7b7", subAngles: [230, 170, 290, 330, 115] },
  { cx: 794,  cy: 668,  r: R,     borderColor: "#f9a8d4", subAngles: [250, 195, 305, 350, 140] },
  { cx: 952,  cy: 148,  r: R,     borderColor: "#fbbf24", subAngles: [55, 340, 15, 120, 175]   },
  { cx: 1062, cy: 478,  r: R,     borderColor: "#fb923c", subAngles: [55, 10, 335, 115, 170]   },
  { cx: 1248, cy: 318,  r: R - 8, borderColor: "#67e8f9", subAngles: [35, 335, 75, 120]        },
  { cx: 1254, cy: 658,  r: R - 8, borderColor: "#f87171", subAngles: [50, 5, 330, 110, 160]    },
  { cx: 1298, cy: 92,   r: R,     borderColor: "#c4b5fd", subAngles: [35, 350, 80, 130]        },
  { cx: 650,  cy: 820,  r: R - 8, borderColor: "#86efac", subAngles: [220, 270, 320]           }, // ← 12th slot
];

// ─── Map API data → MainNode[] using fixed layout ─────────────────────────────

function buildNodes(sessions: SessionAPI[]): MainNode[] {
  // Collect all sub_sessions, group by chapter title (part before " → ")
  const allSubs = sessions.flatMap((s) => s.sub_sessions);

  const chaptersMap = new Map<string, SubSessionAPI[]>();
  for (const ss of allSubs) {
    const [chapterTitle] = ss.title.split(" → ");
    const key = chapterTitle.trim();
    if (!chaptersMap.has(key)) chaptersMap.set(key, []);
    chaptersMap.get(key)!.push(ss);
  }

  const chapters = Array.from(chaptersMap.entries());

  return chapters.map(([chapterTitle, subs], i) => {
    const tmpl = LAYOUT_TEMPLATE[i % LAYOUT_TEMPLATE.length];

    // Format chapter label — strip "CHAPTER N — " prefix, wrap into 2 lines
    const displayLabel = formatChapterLabel(chapterTitle);

    // Map each sub-session to a SubNode, using the template's angles
    // If DB has more subs than template angles, distribute the extras evenly
    const angles = getAnglesForCount(subs.length, tmpl.subAngles);

    const subNodes: SubNode[] = subs.map((ss, j) => {
      const [, subTitle = ss.title] = ss.title.split(" → ");
      return {
        id:    `sub-${ss.sub_session_id}`,
        label: subTitle.trim(),
        angle: angles[j],
      };
    });

    return {
      id:          `chapter-${i}`,
      label:       displayLabel,
      cx:          tmpl.cx,
      cy:          tmpl.cy,
      r:           tmpl.r,
      borderColor: tmpl.borderColor,
      subNodes,
    };
  });
}

// Use template angles when count matches; otherwise distribute evenly
function getAnglesForCount(count: number, templateAngles: number[]): number[] {
  if (count <= templateAngles.length) {
    return templateAngles.slice(0, count);
  }
  // More subs than template — distribute full 360° evenly
  return Array.from({ length: count }, (_, i) =>
    Math.round((360 / count) * i)
  );
}

function formatChapterLabel(raw: string): string {
  const withoutPrefix = raw
    .trim()                                              // ← strip leading/trailing spaces
    .replace(/^Chapter\s+\d+\s*[-—–]+\s*/i, "")        // ← strip "Chapter N —" or "Chapter N -"
    .trim();
  const words = withoutPrefix.split(" ");
  if (words.length <= 2) return withoutPrefix;
  const mid = Math.ceil(words.length / 2);
  return words.slice(0, mid).join(" ") + "\n" + words.slice(mid).join(" ");
}

// ─── Canvas Bounds ────────────────────────────────────────────────────────────

const PAD_X = 70;
const PAD_Y = 70;

function computeCanvasBounds(nodes: MainNode[]): CanvasBounds {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  const expand = (cx: number, cy: number, r: number) => {
    if (cx - r < minX) minX = cx - r;
    if (cx + r > maxX) maxX = cx + r;
    if (cy - r < minY) minY = cy - r;
    if (cy + r > maxY) maxY = cy + r;
  };

  for (const node of nodes) {
    expand(node.cx, node.cy, node.r);
    for (const sub of node.subNodes) {
      const rad  = (sub.angle * Math.PI) / 180;
      const dist = node.r + RS + 28;
      expand(node.cx + Math.cos(rad) * dist, node.cy + Math.sin(rad) * dist, RS);
    }
  }

  if (!nodes.length) return { minX: 0, maxX: 1400, minY: 0, maxY: 780 };
  return { minX, maxX, minY, maxY };
}

// ─── Assets & Shadows ────────────────────────────────────────────────────────

const BG_IMGS: Record<string, string> = {
  center: "/assets/center.png",
};
const BG_IMG_DEFAULT   = "/assets/sidecircleimg.png";
const CENTER_OVERLAY   = "/assets/gujaratmap.png";

const SHADOW_IDLE   = "0 8px 40px rgba(0,0,0,0.40), 0 4px 16px rgba(0,0,0,0.30)";
const SHADOW_ACTIVE = "0 12px 50px rgba(0,0,0,0.60), 0 6px 24px rgba(0,0,0,0.45)";
const SHADOW_SUB    = "0 4px 18px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.30)";

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LegacyOrbit() {
  const navigate = useNavigate();

  const [nodes, setNodes]     = useState<MainNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [activeNode, setActiveNode]       = useState<string | null>(null);
  const [visibleSubs, setVisibleSubs]     = useState<string[]>([]);
  const [scale, setScale]                 = useState<number>(1);
  const [audioFileName, setAudioFileName] = useState<string | null>(null);

  const wrapRef       = useRef<HTMLDivElement>(null);
  const timersRef     = useRef<ReturnType<typeof setTimeout>[]>([]);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch ──
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await api.get("/sessions");
        const sessions: SessionAPI[] = res.data?.data ?? [];
        if (!cancelled) {
          setNodes(buildNodes(sessions));
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load.");
          setLoading(false);
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Canvas dimensions ──
  const bounds  = computeCanvasBounds(nodes);
  const offsetX = bounds.minX < PAD_X ? PAD_X - bounds.minX : 0;
  const offsetY = bounds.minY < PAD_Y ? PAD_Y - bounds.minY : 0;
  const canvasW = bounds.maxX + offsetX + PAD_X;
  const canvasH = bounds.maxY + offsetY + PAD_Y;

  // Center of the original layout
  const CENTER_CX = (bounds.maxX + bounds.minX) / 2 + offsetX;
  const CENTER_CY = (bounds.maxY + bounds.minY) / 2 + offsetY;

  // ── Scale to viewport ──
  useEffect(() => {
    const update = () => {
      const sw = window.innerWidth  / canvasW;
      const sh = window.innerHeight / canvasH;
      setScale(Math.min(sw, sh, 1));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [canvasW, canvasH]);

  // ── Node click ──
  const handleNodeClick = useCallback(
    (nodeId: string) => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];

      if (activeNode === nodeId) {
        setActiveNode(null);
        setVisibleSubs([]);
        return;
      }

      setActiveNode(nodeId);
      setVisibleSubs([]);

      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;

      node.subNodes.forEach((sub, i) => {
        const t = setTimeout(
          () => setVisibleSubs((prev) => [...prev, sub.id]),
          (i + 1) * 160
        );
        timersRef.current.push(t);
      });
    },
    [activeNode, nodes]
  );

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setAudioFileName(file.name);
  };

  // ── Loading / error ──
  if (loading) {
    return (
      <div className="legacy-orbit-root">
        <div className="legacy-orbit-bg" />
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "rgba(255,255,255,0.7)", fontSize: 18, letterSpacing: 1,
        }}>
          Loading chapters…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="legacy-orbit-root">
        <div className="legacy-orbit-bg" />
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#f87171", fontSize: 16, padding: 32, textAlign: "center",
        }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div
      className="legacy-orbit-root"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setActiveNode(null);
          setVisibleSubs([]);
        }
      }}
    >
      <div className="legacy-orbit-bg" />
      <BackButton className="legacy-orbit-back-button" />

      {/* Upload Audio Button */}
      <div
        className="upload-audio-btn"
        onClick={() => audioInputRef.current?.click()}
        title={audioFileName ? `Loaded: ${audioFileName}` : "Upload Audio"}
      >
        <svg className="upload-audio-icon" width="16" height="14" viewBox="0 0 16 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8 10V4M8 4L5.5 6.5M8 4L10.5 6.5" stroke="#5c4e36" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 11.5C1.9 11.5 1 10.6 1 9.5C1 8.56 1.65 7.78 2.52 7.57C2.35 7.22 2.25 6.82 2.25 6.4C2.25 4.85 3.5 3.6 5.05 3.6C5.15 3.6 5.25 3.61 5.35 3.62C5.92 2.35 7.2 1.5 8.68 1.5C10.74 1.5 12.43 3.08 12.5 5.13C13.85 5.44 14.85 6.65 14.85 8.1C14.85 9.49 13.97 10.67 12.74 11.15" stroke="#5c4e36" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
        {audioFileName
          ? audioFileName.length > 18 ? audioFileName.slice(0, 15) + "…" : audioFileName
          : "Upload Audio"}
        <input ref={audioInputRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={handleAudioChange} />
      </div>

      {/* Canvas wrapper */}
      <div
        className="legacy-orbit-canvas-wrapper"
        style={{ width: canvasW * scale, height: canvasH * scale }}
      >
        <div
          ref={wrapRef}
          className="legacy-orbit-canvas"
          style={{
            width: canvasW, height: canvasH,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {/* Center node */}
          <CircleNode
            cx={CENTER_CX} cy={CENTER_CY} r={RC}
            borderColor="rgba(255,255,255,0.5)" borderWidth={4}
            bgImg={BG_IMGS.center} overlayImg={CENTER_OVERLAY}
            label="" isCenter={true} isActive={false}
            onClick={() => {}} zIndex={10}
          />

          {/* Chapter nodes + sub-nodes */}
          {nodes.map((node) => {
            const isActive = activeNode === node.id;
            const ncx      = node.cx + offsetX;
            const ncy      = node.cy + offsetY;

            return (
              <div key={node.id}>
                <CircleNode
                  cx={ncx} cy={ncy} r={node.r}
                  borderColor={node.borderColor}
                  borderWidth={isActive ? 3 : 2}
                  bgImg={BG_IMG_DEFAULT}
                  label={node.label}
                  isCenter={false} isActive={isActive}
                  onClick={() => handleNodeClick(node.id)}
                  zIndex={isActive ? 20 : 5}
                />

                {isActive && node.subNodes.map((sub) => {
                  const visible = visibleSubs.includes(sub.id);
                  const rad     = (sub.angle * Math.PI) / 180;
                  const dist    = node.r + RS + 28;
                  const scx     = node.cx + offsetX + Math.cos(rad) * dist;
                  const scy     = node.cy + offsetY + Math.sin(rad) * dist;
                  return (
                    <SubCircleNode
                      key={sub.id}
                      cx={scx} cy={scy} r={RS}
                      label={sub.label}
                      visible={visible}
                      accentColor={node.borderColor}
                      onClick={() => navigate("/school/Founderstory")}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Circle Node ──────────────────────────────────────────────────────────────

interface CircleNodeProps {
  cx: number; cy: number; r: number;
  borderColor: string; borderWidth: number;
  bgImg: string; overlayImg?: string;
  label: string; isCenter: boolean; isActive: boolean;
  onClick: () => void; zIndex: number;
}

function CircleNode({ cx, cy, r, borderColor, borderWidth, bgImg, overlayImg, label, isCenter, isActive, onClick, zIndex }: CircleNodeProps) {
  const d = r * 2;
  const nodeClasses = [
    "circle-node",
    isCenter ? "circle-node--center" : "circle-node--main",
    !isCenter && "circle-node--clickable",
    isActive  && "circle-node--active",
  ].filter(Boolean).join(" ");

  return (
    <div className={nodeClasses} onClick={isCenter ? undefined : onClick}
      style={{ left: cx - r, top: cy - r, width: d, height: d,
        border: `${borderWidth}px solid ${borderColor}`,
        boxShadow: isActive ? SHADOW_ACTIVE : SHADOW_IDLE, zIndex,
      }}>
      <img src={bgImg} alt="" draggable={false} className="circle-node__bg-img" />
      <div className={`circle-node__tint ${isActive ? "circle-node__tint--active" : "circle-node__tint--idle"}`} />
      {overlayImg && <img src={overlayImg} alt="" draggable={false} className="circle-node__overlay-img" />}
      {(!isCenter || !overlayImg) && (
        <div className="circle-node__label-wrapper">
          <div className={`circle-node__label-box${isCenter ? " circle-node__label-box--center" : ""}`}>
            <span className={`circle-node__label-text${isCenter ? " circle-node__label-text--center" : ""}`}>
              {label}
            </span>
            {!isCenter && (
              <div className="circle-node__label-underline"
                style={{ background: isActive ? borderColor : "rgba(255,255,255,0.55)" }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub Circle Node ──────────────────────────────────────────────────────────

interface SubCircleNodeProps {
  cx: number; cy: number; r: number;
  label: string; visible: boolean;
  accentColor: string; onClick: () => void;
}

function SubCircleNode({ cx, cy, r, label, visible, accentColor, onClick }: SubCircleNodeProps) {
  const d = r * 2;
  return (
    <div
      className={`sub-circle-node ${visible ? "sub-circle-node--visible" : "sub-circle-node--hidden"}`}
      onClick={onClick}
      style={{ left: cx - r, top: cy - r, width: d, height: d,
        border: `2px solid ${accentColor}`,
        boxShadow: visible ? `${SHADOW_SUB}, 0 0 0 1px ${accentColor}22` : "none",
      }}>
      <span className="sub-circle-node__label">{label}</span>
    </div>
  );
}