import { useEffect, useRef, useState, type ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import BackButton from "../../../components/BackButton";
import "./Scrollgallery.css";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Slide {
  sessionId: number;
  chapter: string;
  img: string;
  label: string;
  title: string;
}

interface CardPos {
  x: number;
  y: number;
  z: number;
  rz: number;
  scale: number;
  opacity: number;
}

interface ApiChapter {
  chapterTitle: string;
  session_id: number;
  cover_image: string | null;
}

const API_BASE = `${(import.meta as any).env?.VITE_API_URL ?? "http://localhost:5002"}/api`;
const FALLBACK_IMG = "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=700&q=80";

function getToken(): string {
  return localStorage.getItem("token") ?? "";
}

function authHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

// ─── Layout Config ────────────────────────────────────────────────────────────
const SPREAD      = 250;  // horizontal gap between card centers (px)
const CURVE       = 80;   // how far edge cards drop below center (px)
const TILT        = 12;   // max rotateZ tilt on edge cards (degrees)
const SCALE_EDGE  = 0.82; // scale of outermost cards
const SCROLL_EACH = 300;  // px of internal scroll per slide step

// ─── Helpers ─────────────────────────────────────────────────────────────────
const clamp = (v: number, a: number, b: number): number =>
  Math.max(a, Math.min(b, v));

function getCardPos(centerFloat: number, i: number, total: number): CardPos {
  const offset = i - centerFloat;
  const absOff = Math.abs(offset);
  const norm   = absOff / ((total - 1) / 2);

  const x       = offset * SPREAD;
  const y       = norm * norm * CURVE;
  const z       = -absOff * 30;
  const rz      = (offset / ((total - 1) / 2)) * TILT;
  const scale   = 1 - (1 - SCALE_EDGE) * norm;
  const opacity = clamp(1 - absOff * 0.12, 0.3, 1);

  return { x, y, z, rz, scale, opacity };
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function ScrollGallery(): ReactElement {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null); // internal scroll container
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [showHint,  setShowHint]  = useState<boolean>(true);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchChapters() {
      try {
        const res = await fetch(`${API_BASE}/user/gallery/chapters`, { headers: authHeaders() });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.message ?? "Failed to fetch chapters");

        const mapped: Slide[] = (json.data as ApiChapter[]).map((ch) => ({
          sessionId: ch.session_id,
          chapter: ch.chapterTitle,
          img: ch.cover_image ?? FALLBACK_IMG,
          label: ch.chapterTitle,
          title: ch.chapterTitle,
        }));
        setSlides(mapped);
      } catch (err) {
        console.error("Failed to load chapters:", err);
        setSlides([]);
      } finally {
        setLoading(false);
      }
    }
    fetchChapters();
  }, []);

  const totalSlides = slides.length;
  const maxScroll    = SCROLL_EACH * Math.max(totalSlides - 1, 1); // total scrollable px inside the box
  const spacerHeight = `calc(100% + ${maxScroll}px)`;   // makes the container scrollable by that much

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || totalSlides === 0) return;

    function onScroll(): void {
      if (!el) return;

      const scrolledIn  = clamp(el.scrollTop, 0, maxScroll);
      const progress     = clamp(scrolledIn / maxScroll, 0, 1);
      const centerFloat  = progress * (totalSlides - 1);

      cardRefs.current.forEach((card, i) => {
        if (!card) return;
        const { x, y, z, rz, scale, opacity } = getCardPos(centerFloat, i, totalSlides);
        card.style.transform = `translateX(${x}px) translateY(${y}px) translateZ(${z}px) rotateZ(${rz}deg) scale(${scale})`;
        card.style.opacity   = String(opacity);
        card.style.zIndex    = String(Math.round(1000 - Math.abs(i - centerFloat) * 10));
      });

      const idx = Math.round(clamp(centerFloat, 0, totalSlides - 1));
      setActiveIdx(idx);
      setShowHint(scrolledIn < 20);
    }

    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [totalSlides, maxScroll]);

  function handleCardClick(slide: Slide): void {
    navigate(`/school/galleryinner/${slide.sessionId}/${encodeURIComponent(slide.chapter)}`);
  }

  function handleCardKeyDown(e: React.KeyboardEvent<HTMLDivElement>, slide: Slide): void {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      navigate(`/school/galleryinner/${slide.sessionId}/${encodeURIComponent(slide.chapter)}`);
    }
  }

  if (loading) {
    return <div className="sg-outer">Loading chapters...</div>;
  }

  return (
    <div className="sg-outer">
      <BackButton />
      <div className="sg-scroll" ref={scrollRef}>
        {/* spacer gives the container something to scroll through;
            sg-sticky pins inside it while you scroll the spacer's height */}
        <div className="sg-spacer" style={{ height: spacerHeight }}>
          <div className="sg-sticky">

            <span className="sg-brand">Explore</span>
            <span className="sg-counter">
              {String(activeIdx + 1).padStart(2, "0")} / {String(totalSlides).padStart(2, "0")}
            </span>

            <div className="sg-stage">
              {slides.map((slide, i) => (
                <div
                  key={`${slide.sessionId}-${slide.chapter}`}
                  className="sg-card"
                  ref={(el) => { cardRefs.current[i] = el; }}
                  onClick={() => handleCardClick(slide)}
                  onKeyDown={(e) => handleCardKeyDown(e, slide)}
                  role="button"
                  tabIndex={0}
                  aria-label={`View ${slide.label} gallery`}
                >
                  <img src={slide.img} alt={slide.label} loading="lazy" />
                  <div className="sg-card-shade" />
                  <div className="sg-card-label">{slide.label}</div>
                </div>
              ))}

              <div className="sg-title">
                {slides[activeIdx]?.title}
              </div>
            </div>

            <div className="sg-dots">
              {slides.map((s, i) => (
                <div
                  key={`${s.sessionId}-${s.chapter}`}
                  className={`sg-dot${i === activeIdx ? " active" : ""}`}
                />
              ))}
            </div>

            <div className="sg-hint" style={{ opacity: showHint ? 1 : 0 }}>
              <span>Scroll</span>
              <div className="sg-arrow" />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}