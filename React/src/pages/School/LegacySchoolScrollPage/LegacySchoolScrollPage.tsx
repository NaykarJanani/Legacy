import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./LegacySchoolScrollPage.css";

const LegacySchoolScrollPage = () => {
    const [activeSlide, setActiveSlide] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const startY = useRef<number | null>(null);
    const totalSlides = 3;
    const navigate = useNavigate();

    // ── REMOVED: useEffect that set school_intro_seen on mount ──
    // It was setting the flag immediately when the page loaded,
    // so on the very next login it would skip the scroll page.
    // The flag is now only set when the user clicks "Let's Start".

    const goToSlide = (index: number) => {
        if (isAnimating || index === activeSlide) return;
        setIsAnimating(true);
        setActiveSlide(index);
        setTimeout(() => setIsAnimating(false), 800);
    };

    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            if (isAnimating) return;
            if (e.deltaY > 0 && activeSlide < totalSlides - 1) {
                goToSlide(activeSlide + 1);
            } else if (e.deltaY < 0 && activeSlide > 0) {
                goToSlide(activeSlide - 1);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowDown" && activeSlide < totalSlides - 1) goToSlide(activeSlide + 1);
            if (e.key === "ArrowUp" && activeSlide > 0) goToSlide(activeSlide - 1);
        };

        const handleTouchStart = (e: TouchEvent) => {
            startY.current = e.touches[0].clientY;
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if (startY.current === null) return;
            const diff = startY.current - e.changedTouches[0].clientY;
            if (Math.abs(diff) > 40) {
                if (diff > 0 && activeSlide < totalSlides - 1) goToSlide(activeSlide + 1);
                else if (diff < 0 && activeSlide > 0) goToSlide(activeSlide - 1);
            }
            startY.current = null;
        };

        const el = containerRef.current;
        if (el) {
            el.addEventListener("wheel", handleWheel, { passive: false });
            el.addEventListener("touchstart", handleTouchStart);
            el.addEventListener("touchend", handleTouchEnd);
        }
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            if (el) {
                el.removeEventListener("wheel", handleWheel);
                el.removeEventListener("touchstart", handleTouchStart);
                el.removeEventListener("touchend", handleTouchEnd);
            }
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [activeSlide, isAnimating]);

    // ── Called only when user intentionally clicks "Let's Start" ──
    const handleLetStart = () => {
        const email = localStorage.getItem("user_email") || "default";
        localStorage.setItem(`school_intro_seen_${email}`, "true");
        navigate("/school/startjourney");
    };

    return (
        <div className="LegacySchoolScrollPage__wrapper" ref={containerRef}>
            <div
                className="LegacySchoolScrollPage__track"
                style={{ transform: `translateY(-${activeSlide * 100}vh)` }}
            >
                {/* ── SLIDE 1 : Logo ── */}
                <div className={`LegacySchoolScrollPage__slide LegacySchoolScrollPage__slide--1 ${activeSlide === 0 ? "is-active" : ""}`}>
                    <div className="LegacySchoolScrollPage__slide1-inner">
                        <div className="LegacySchoolScrollPage__logo-glow" />
                        <img
                            src="/assets/legacylogo.png"
                            alt="Legacy Library Logo"
                            className="LegacySchoolScrollPage__logo-img"
                        />
                        <p className="LegacySchoolScrollPage__slide1-tagline">
                            Celebrating <span>100 Years</span> of Stories &amp; Legacy
                        </p>
                        <div className="LegacySchoolScrollPage__scroll-hint">
                            <span />
                            <span />
                            <span />
                            Scroll to explore
                        </div>
                    </div>
                </div>

                {/* ── SLIDE 2 : Tagline + description ── */}
                <div className={`LegacySchoolScrollPage__slide LegacySchoolScrollPage__slide--2 ${activeSlide === 1 ? "is-active" : ""}`}>
                    <div className="LegacySchoolScrollPage__slide2-grid">
                        <div className="LegacySchoolScrollPage__slide2-left">
                            <img
                                src="/assets/legacylogo.png"
                                alt="Legacy Library"
                                className="LegacySchoolScrollPage__slide2-logo"
                            />
                        </div>
                        <div className="LegacySchoolScrollPage__slide2-right">
                            <div className="LegacySchoolScrollPage__ring-badge">
                                <img
                                    src="/assets/schooluserslide2.png"
                                    alt="Legacy Library Year Badge"
                                    className="LegacySchoolScrollPage__ring-img"
                                />
                            </div>
                            <div className="LegacySchoolScrollPage__slide2-text">
                                <h1 className="LegacySchoolScrollPage__headline">
                                    Where<br />
                                    Every story matters. <span className="LegacySchoolScrollPage__accent--purple"></span><br />
                                    Every <span className="LegacySchoolScrollPage__accent--purple">Legacy</span> Lives
                                </h1>
                                <p className="LegacySchoolScrollPage__body-text">
                                    Everyone has their own story and we want to hear it — and make it famous. Your story
                                    can inspire and empower entrepreneurship for national, societal, and global community
                                    growth builders.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── SLIDE 3 : What's Your Story ── */}
                <div className={`LegacySchoolScrollPage__slide LegacySchoolScrollPage__slide--3 ${activeSlide === 2 ? "is-active" : ""}`}>
                    <div className="LegacySchoolScrollPage__dot-field">
                        {Array.from({ length: 180 }).map((_, i) => (
                            <span
                                key={i}
                                className="LegacySchoolScrollPage__dot"
                                style={{ animationDelay: `${(i * 37) % 2400}ms` }}
                            />
                        ))}
                    </div>
                    <div className="LegacySchoolScrollPage__slide3-content">
                        <div className="LegacySchoolScrollPage__card-wrapper">
                            <div className="LegacySchoolScrollPage__typewriter-card">
                                <img
                                    src="/assets/slide3.png"
                                    alt="What's Your Story?"
                                    className="LegacySchoolScrollPage__typewriter-img"
                                />
                            </div>
                            {/* ✅ Flag is set HERE — only when user clicks */}
                            <button
                                className="LegacySchoolScrollPage__cta-btn"
                                onClick={handleLetStart}
                            >
                                Let's Start
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LegacySchoolScrollPage;
