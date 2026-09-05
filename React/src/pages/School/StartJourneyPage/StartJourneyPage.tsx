import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../../services/api";

import "./StartJourneyPage.css";

const DEFAULT_IMAGE = "/assets/userstartjourneyimg.png";

const StartJourneyPage: React.FC = () => {
  const navigate = useNavigate();

  // Content set by the editor — falls back to these defaults until (or unless)
  // the editor has saved something, or if the fetch fails.
  const [bgImage, setBgImage] = useState(DEFAULT_IMAGE);
  const [bgScale, setBgScale] = useState(1);
  const [bgPos, setBgPos] = useState({ x: 0, y: 0 });
  const [establishedLabel, setEstablishedLabel] = useState("Established");
  const [year, setYear] = useState("1998");
  const [experienceLine1, setExperienceLine1] = useState("27 Years of");
  const [experienceLine2, setExperienceLine2] = useState(
    "Excellence in Education"
  );
  const [quote, setQuote] = useState(
    "Education is the most powerful weapon which you can use to change the world."
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await api.get("/start-journey");
        const data = res.data?.data;
        if (!data || cancelled) return;

        if (data.image_url) setBgImage(data.image_url);
        if (data.image_scale != null) setBgScale(Number(data.image_scale));
        if (data.image_pos_x != null || data.image_pos_y != null) {
          setBgPos({
            x: Number(data.image_pos_x ?? 0),
            y: Number(data.image_pos_y ?? 0),
          });
        }
        if (data.established_label) setEstablishedLabel(data.established_label);
        if (data.year) setYear(data.year);
        if (data.experience_line1) setExperienceLine1(data.experience_line1);
        if (data.experience_line2) setExperienceLine2(data.experience_line2);
        if (data.quote) setQuote(data.quote);
      } catch (err) {
        // Fall back to defaults already set above — page still renders fine.
        console.error("Failed to load start journey content", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleStartJourney = () => {
    navigate("/school/dashboard");
  };

  return (
    <section className="start-journey-page">
     

      {/* Background Image — zoom/pan set by the editor is applied here so
          the user side matches what was configured in Start Journey editor. */}
      <img
        src={bgImage}
        alt="Founder Banner"
        className="start-journey-page__bg-image"
        style={{
          transform: `translate(${bgPos.x}px, ${bgPos.y}px) scale(${bgScale})`,
        }}
      />

      {/* Overlay */}
      <div className="start-journey-page__overlay" />

      {/* Established Section */}
      <div className="start-journey-page__established">
        <p className="start-journey-page__established-label">
          {establishedLabel}
        </p>

        <h2 className="start-journey-page__year">
          {year}
        </h2>

        <p className="start-journey-page__experience">
          {experienceLine1} <br />
          {experienceLine2}
        </p>
      </div>

      {/* Quote */}
      <div className="start-journey-page__quote">
        <p>{quote}</p>

        <div className="start-journey-page__line" />
      </div>

      {/* Founder Info */}
      <div className="start-journey-page__founder">
        {/* <h1 className="start-journey-page__signature">
          R.K. Sharma
        </h1> */}

        {/* <h2 className="start-journey-page__designation">
          Founder & Visionary
        </h2>

        <p className="start-journey-page__years">
          1954 - 2010
        </p> */}
      </div>

      {/* Play Button */}
      <div className="start-journey-page__play-wrapper">
        <button
          className="start-journey-page__play-btn"
          onClick={handleStartJourney}
        >
           <span className="start-journey-page__play-icon">▶</span>

          <span className="start-journey-page__tooltip">
            Let's Start your Journey
          </span>
        </button>
      </div>

    </section>
  );
};

export default StartJourneyPage;