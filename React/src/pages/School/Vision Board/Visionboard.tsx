import { useEffect, useRef, useState } from "react";
import { useBoardPlacements } from "../../../hooks/useBoardPlacements";
import { useBoardQuotes } from "../../../hooks/useBoardQuotes";
import BackButton from "../../../components/BackButton";
import "./Visionboard.css";

interface Story {
  id: number;
  img: string;
  modalImg: string; // separate image for modal
}

const STORIES: Story[] = [
  { id: 1,  img: "/assets/card/card1.png",  modalImg: "/assets/model/visionboardcard.png" },
  { id: 2,  img: "/assets/card/card1.png",  modalImg: "/assets/model/visionboardcard.png" },
  { id: 3,  img: "/assets/card/card1.png",  modalImg: "/assets/model/visionboardcard.png" },
  { id: 4,  img: "/assets/card/card1.png",  modalImg: "/assets/model/visionboardcard.png" },
  { id: 5,  img: "/assets/card/card1.png",  modalImg: "/assets/model/visionboardcard.png" },
  { id: 6,  img: "/assets/card/card1.png",  modalImg: "/assets/model/visionboardcard.png" },
  { id: 7,  img: "/assets/card/card1.png",  modalImg: "/assets/model/visionboardcard.png" },
  { id: 8,  img: "/assets/card/card1.png",  modalImg: "/assets/model/visionboardcard.png" },
  { id: 9,  img: "/assets/card/card1.png",  modalImg: "/assets/model/visionboardcard.png" },
  { id: 10, img: "/assets/card/card1.png", modalImg: "/assets/model/visionboardcard.png" },
];

const TOTAL = STORIES.length;
const ARC_START = 195;
const ARC_END = 345;
const SCROLL_PER_CARD = 15;
const VISIBLE = 5;

type Mode = "desktop" | "tablet" | "small";

function getMode(): Mode {
  const w = window.innerWidth;
  if (w <= 425) return "small";
  if (w <= 768) return "tablet";
  return "desktop";
}

export default function Visionboard() {
  // No customerId passed — the backend uses the logged-in user's own id.
  // `placementDetails` isn't needed for rendering anymore — the editor now
  // saves an already-cropped photo, so `placements[id]` (its view_url) is
  // ready to display as-is with plain object-fit: cover.
  const { placements } = useBoardPlacements("vision_board");
  const { quotes } = useBoardQuotes("vision_board");

  const [localScroll, setLocalScroll] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [entered, setEntered] = useState(false);

  const [hasScrolled, setHasScrolled] = useState(false);
  const [wheelSize, setWheelSize] = useState(0);
  const [mode, setMode] = useState<Mode>(() =>
    typeof window !== "undefined" ? getMode() : "desktop"
  );

  const sectionRef = useRef<HTMLDivElement>(null);
  const wheelWrapRef = useRef<HTMLDivElement>(null);

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

  const activeStory = STORIES[activeIndex];
  const counterCurrent = String(activeIndex + 1).padStart(2, "0");
  const counterTotal = String(TOTAL).padStart(2, "0");

  const cardW = wheelSize > 0 ? Math.max(52, wheelSize * 0.095) : 72;
  const R = wheelSize * 0.44;
  const arcRange = ARC_END - ARC_START;
  const step = arcRange / (TOTAL - 1);

  const half = Math.floor(VISIBLE / 2);
  const slotStories: Story[] = Array.from({ length: VISIBLE }, (_, slot) => {
    const offset = slot - half;
    const idx = Math.min(Math.max(activeIndex + offset, 0), TOTAL - 1);
    return STORIES[idx];
  });

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
    <div className="nb-page">
      <BackButton className="nb-back-button" />
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
              {wheelSize > 0 && STORIES.map((story, idx) => {
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
                    <div className="nb-card-img-wrap">
                      {/* Each card uses its own unique img, or the editor-assigned photo if set */}
                      <img
                        src={placements[String(story.id)] ?? story.img}
                        alt={`Card ${story.id}`}
                        className="nb-card-img"
                        loading="lazy"
                      />
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
                  return (
                    <div
                      key={slot}
                      className={`nb-slot ${isCenter ? "nb-slot--center" : "nb-slot--side"}`}
                    >
                      <div className="nb-slot-inner">
                        {/* Each slot uses the story's own img, or the editor-assigned photo if set */}
                        <img
                          src={placements[String(story.id)] ?? story.img}
                          alt={`Card ${story.id}`}
                          className="nb-slot-img"
                          loading="lazy"
                        />
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
                  <div className="nb-center-img-wrap">
                    <img
                      src={placements[String(activeStory.id)] ?? activeStory.img}
                      alt={`Card ${activeStory.id}`}
                      className="nb-center-img"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* BACKDROP */}
          {hasScrolled && (
            <div className="nb-backdrop" key={`backdrop-${activeStory.id}`} />
          )}

          {/* MODAL — uses the editor-assigned photo if set, otherwise modalImg,
              plus the editor's quote for this card if one was saved */}
          {hasScrolled && (
            <div className="nb-story-popup" key={activeStory.id}>
              <div className="nb-story-popup-img-wrap">
                <img
                  src={placements[String(activeStory.id)] ?? activeStory.modalImg}
                  alt={`Modal ${activeStory.id}`}
                  className="nb-story-popup-img"
                  loading="lazy"
                />
              </div>
              {quotes[String(activeStory.id)] && (
                <p className="nb-quote-display">{quotes[String(activeStory.id)]}</p>
              )}
            </div>
          )}

          {/* SCROLL HINT */}
          <div className={`nb-scroll-hint ${entered ? "nb-scroll-hint--in" : ""}`}>
            <div className="nb-scroll-icon"><span /></div>
            <p>Scroll to navigate</p>
          </div>

        </div>
      </div>
    </div>
  );
}