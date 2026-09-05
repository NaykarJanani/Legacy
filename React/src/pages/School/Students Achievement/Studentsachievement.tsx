import { useState, useEffect, useCallback, useRef } from "react";
import { useBoardPlacements } from "../../../hooks/useBoardPlacements";
import { useBoardQuotes } from "../../../hooks/useBoardQuotes";
import BackButton from "../../../components/BackButton";
import "./Studentsachievement.css";

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

// Fallback image shown for a letter until the editor has assigned one via
// the Media Library / Achievement page (each letter has its own default,
// unlike the previous version which pointed every letter at "a.png").
const defaultSeedImages: Record<string, string> = {
  A: "/assets/achievement img/a.png",
  B: "/assets/achievement img/b.png",
  C: "/assets/achievement img/c.png",
  D: "/assets/achievement img/d.png",
  E: "/assets/achievement img/e.png",
  F: "/assets/achievement img/f.png",
  G: "/assets/achievement img/g.png",
  H: "/assets/achievement img/h.png",
  I: "/assets/achievement img/i.png",
  J: "/assets/achievement img/j.png",
  K: "/assets/achievement img/k.png",
  L: "/assets/achievement img/l.png",
  M: "/assets/achievement img/m.png",
  N: "/assets/achievement img/n.png",
  O: "/assets/achievement img/o.png",
  P: "/assets/achievement img/p.png",
  Q: "/assets/achievement img/q.png",
  R: "/assets/achievement img/r.png",
  S: "/assets/achievement img/s.png",
  T: "/assets/achievement img/t.png",
  U: "/assets/achievement img/u.png",
  V: "/assets/achievement img/v.png",
  W: "/assets/achievement img/w.png",
  X: "/assets/achievement img/x.png",
  Y: "/assets/achievement img/y.png",
  Z: "/assets/achievement img/z.png",
};

interface AchievementDetail {
  year: string;
  name: string;
  text: string;
}

const defaultAchievementData: Record<string, AchievementDetail> = letters.reduce(
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

const TEXT_LIMIT = 120;

// Achievement content is saved by the editor as a JSON string (see the
// Editor-side Studentsachievement.tsx) through the generic board-quote
// endpoint. Parse it back into { year, name, text } here, falling back to
// the placeholder copy if the editor hasn't submitted anything for this
// letter yet.
function parseAchievement(letter: string, raw?: string): AchievementDetail {
  const fallback = defaultAchievementData[letter];
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return {
      year: parsed.year ?? fallback.year,
      name: parsed.name ?? fallback.name,
      // The editor page keeps separate left/right text; this page shows one
      // block per column, so pass each straight through.
      text: parsed.leftText ?? fallback.text,
    };
  } catch {
    return { ...fallback, text: raw };
  }
}

function parseAchievementColumn(
  letter: string,
  raw: string | undefined,
  col: "left" | "right"
): AchievementDetail {
  const fallback = defaultAchievementData[letter];
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return {
      year: parsed.year ?? fallback.year,
      name: parsed.name ?? fallback.name,
      text: (col === "left" ? parsed.leftText : parsed.rightText) ?? fallback.text,
    };
  } catch {
    return { ...fallback, text: raw };
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
  cropTransform?: string;
}

function LetterBox({
  letter,
  imageUrl,
  isActive,
  onSelect,
  onImageError,
  boxRef,
  cropTransform,
}: LetterBoxProps) {
  const clipId = `clip-${letter}`;
  const points = cssPolygonToSvgPoints(clipPaths[letter]);

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

        {imageUrl ? (
          <g clipPath={`url(#${clipId})`}>
            <image
              href={imageUrl}
              x="0"
              y="0"
              width="100"
              height="100"
              preserveAspectRatio="xMidYMid slice"
              onError={() => onImageError(letter)}
              transform={cropTransform}
            />
          </g>
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

export default function StudentsAchievement() {
  // No customerId — the backend resolves the logged-in user's own project,
  // same pattern as the user-side Vision Board page. This is the same
  // "achievement" board_type the editor's page and Media Library write to,
  // so anything the editor saves/assigns shows up here automatically.
  const { placements, placementDetails, isLoading: placementsLoading } = useBoardPlacements("achievement");
  const { quotes, isLoading: quotesLoading } = useBoardQuotes("achievement");

  const [brokenLetters, setBrokenLetters] = useState<Record<string, boolean>>({});
  const [selectedLetter, setSelectedLetter] = useState<string>("A");
  const [expandedCols, setExpandedCols] = useState<Record<string, boolean>>({
    left: false,
    right: false,
  });

  // Container that actually scrolls horizontally now (no more pages/dots).
  const trackContainerRef = useRef<HTMLDivElement | null>(null);
  // Individual letter-box refs so we can scroll a selected letter into view.
  const letterRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const imageMap: Record<string, string | null> = {};
  letters.forEach((l) => {
    if (placements[l]) {
      imageMap[l] = placements[l];
    } else if (!brokenLetters[l]) {
      imageMap[l] = defaultSeedImages[l] ?? null;
    } else {
      imageMap[l] = null;
    }
  });

  const cropValues = (letter: string) => {
    const placement = placementDetails[letter];
    const x = Number(placement?.crop_pos_x ?? 0);
    const y = Number(placement?.crop_pos_y ?? 0);
    // Keep the photo covering its frame even when an older gallery asset has
    // a different aspect ratio from the editor's square crop viewport.
    const zoom = Math.max(
      1,
      Number(placement?.crop_zoom ?? 1),
      1 + (2 * Math.abs(x)) / 280,
      1 + (2 * Math.abs(y)) / 280
    );
    return { zoom, x, y };
  };

  const cropStyle = (letter: string): React.CSSProperties => {
    const { zoom, x, y } = cropValues(letter);
    return {
      transform: `translate(${(x / 280) * 100}%, ${(y / 280) * 100}%) scale(${zoom})`,
      transformOrigin: "center",
    };
  };

  const cropSvgTransform = (letter: string) => {
    const { zoom, x, y } = cropValues(letter);
    const svgX = (x / 280) * 100;
    const svgY = (y / 280) * 100;
    return `translate(${svgX} ${svgY}) translate(50 50) scale(${zoom}) translate(-50 -50)`;
  };

  const isLoading = placementsLoading || quotesLoading;

  useEffect(() => {
    setExpandedCols({ left: false, right: false });
  }, [selectedLetter]);

  // Convert a normal (vertical) mouse-wheel scroll into horizontal
  // scrolling on this track only. Without this, a plain wheel scroll
  // is treated as page-vertical-scroll and ignored by this container;
  // only Ctrl+wheel (or a horizontal trackpad swipe) would move it.
  //
  // FIX: this previously ran once on mount with an empty dependency
  // array ([]). But the component returns a "Loading achievements..."
  // placeholder while placementsLoading/quotesLoading are true, so on
  // that very first mount the real `.alphabet-track-container` div (and
  // its ref) didn't exist yet — trackContainerRef.current was null, the
  // effect bailed out immediately via `if (!el) return;`, and because
  // the deps array was empty it never ran again once the real content
  // mounted a moment later. Net effect: the wheel listener was never
  // attached, so scrolling silently did nothing. Depending on `isLoading`
  // makes the effect re-run — and successfully attach the listener —
  // right after loading flips to false and the container actually
  // exists in the DOM.
  useEffect(() => {
    if (isLoading) return;

    const el = trackContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // If the gesture is already primarily horizontal (trackpad swipe,
      // shift+wheel, etc.), let the browser handle it natively.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      const maxScrollLeft = el.scrollWidth - el.clientWidth;

      // Nothing to scroll at all (content fits) - let page scroll happen.
      if (maxScrollLeft <= 0) return;

      // Use a small tolerance instead of a strict >0 / <max check.
      // Reading el.scrollLeft can return fractional values (e.g. 0.4
      // instead of 0) due to sub-pixel rounding and scroll-snap settling,
      // which previously made "at the left edge" register as still
      // scrollable-left on some ticks and not on others - causing
      // backward scroll to intermittently stop responding.
      const atStart = el.scrollLeft <= 0.5;
      const atEnd = el.scrollLeft >= maxScrollLeft - 0.5;

      if (e.deltaY < 0 && atStart) return; // already fully scrolled left
      if (e.deltaY > 0 && atEnd) return; // already fully scrolled right

      e.preventDefault();
      const next = el.scrollLeft + e.deltaY;
      // Clamp manually so a fast wheel tick can't overshoot past either
      // end and conflict with the browser's own scroll-snap correction.
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
    // Smoothly bring the clicked letter to a centered position in the
    // scroll track (nice when clicking a partially-visible edge letter).
    const node = letterRefs.current[letter];
    if (node) {
      node.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, []);

  const toggleExpand = (col: "left" | "right") => {
    setExpandedCols((prev) => ({ ...prev, [col]: !prev[col] }));
  };

  const detailImage = imageMap[selectedLetter] ?? null;

  if (isLoading) {
    return <div className="alphabet-wrapper">Loading achievements...</div>;
  }

  return (
    <div className="alphabet-wrapper">
      <BackButton />
      {/* Header */}


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
                cropTransform={cropSvgTransform(letter)}
              />
            ))}
          </div>
        </div>
      </main>

      {/* Detail panel for selected letter */}
      <section className="achievement-detail">
        <div className="achievement-detail__arch">
          {/* Decorative background image behind center circle */}
          {detailImage && (
            <div className="achievement-detail__arch-bg">
              <img
                src={detailImage}
                alt=""
                className="achievement-detail__arch-bg-image"
                style={cropStyle(selectedLetter)}
              />
            </div>
          )}

          <div className="achievement-detail__content">
            <div className="achievement-detail__center">
              {detailImage ? (
                <img
                  src={detailImage}
                  alt={`Achievement ${selectedLetter}`}
                  className="achievement-detail__image"
                  style={cropStyle(selectedLetter)}
                />
              ) : (
                <div className="achievement-detail__image-fallback">
                  {selectedLetter}
                </div>
              )}
            </div>

            <div className="achievement-detail__meta">
              <span className="achievement-detail__year">
                {parseAchievement(selectedLetter, quotes[selectedLetter]).year}
              </span>
              <span className="achievement-detail__name">
                {parseAchievement(selectedLetter, quotes[selectedLetter]).name}
              </span>
            </div>

            <div className="achievement-detail__columns">
              {(["left", "right"] as const).map((col) => {
                const detail = parseAchievementColumn(
                  selectedLetter,
                  quotes[selectedLetter],
                  col
                );
                const isExpanded = expandedCols[col];
                const isTextLong = detail.text.length > TEXT_LIMIT;
                const displayText =
                  isTextLong && !isExpanded
                    ? detail.text.slice(0, TEXT_LIMIT) + "..."
                    : detail.text;

                return (
                  <div key={col} className="achievement-detail__col">
                    <p>
                      {displayText}
                      {isTextLong && (
                        <button
                          className="achievement-detail__readmore"
                          onClick={() => toggleExpand(col)}
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                            marginLeft: "4px",
                          }}
                        >
                          {isExpanded ? " Show Less" : " Read More..."}
                        </button>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
