import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import BackButton from "../../../components/BackButton";
import "./Userdashboard.css";

const menuItems = [
{ label: "Founder's Story", angle: 45,  path: "/school/legacyorbit" },
{ label: "Legacy Timeline", angle: 85,  path: "/school/legacytimeline" },
{ label: "VisionBoard",     angle: 130, path: "/school/visionboard" },
{ label: "Achievement",     angle: 185, path: "/school/studentsachievement" },
{ label: "Generation Web",  angle: 240, path: "/school/generation" },
{ label: "Gallery",         angle: 290, path: "/school/gallery" },
{ label: "Flipbook",        angle: 330, path: "/school/flipbook" },
{ label: "Timecapsule",     angle: 365, path: "" },

];

function polarToXY(
  angleDeg: number,
  r: number
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: 50 + r * Math.cos(rad),
    y: 50 + r * Math.sin(rad),
  };
}

function splitLabel(
  label: string,
  allowWrap: boolean
): [string, string | null] {
  if (!allowWrap) return [label, null];

  const words = label.split(" ");
  if (words.length === 1) return [label, null];
  if (words.length === 2) return [words[0], words[1]];

  const mid = Math.ceil(words.length / 2);
  return [
    words.slice(0, mid).join(" "),
    words.slice(mid).join(" "),
  ];
}

function useWindowWidth(): number {
  const [width, setWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1024
  );

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return width;
}

const SMALL_SCREEN_BREAKPOINT = 600;

const UserDashboard: React.FC = () => {
  const navigate = useNavigate();

  const dotsLeftRef = useRef<HTMLDivElement>(null);
  const dotsRightRef = useRef<HTMLDivElement>(null);

  const windowWidth = useWindowWidth();
  const allowWrap = windowWidth < SMALL_SCREEN_BREAKPOINT;

  useEffect(() => {
    const dotsCount = 12 * 18;

    [dotsLeftRef, dotsRightRef].forEach((ref) => {
      const el = ref.current;
      if (!el) return;

      const fragment = document.createDocumentFragment();

      for (let i = 0; i < dotsCount; i++) {
        const span = document.createElement("span");
        span.className = "userdashboard__dot";
        fragment.appendChild(span);
      }

      el.innerHTML = "";
      el.appendChild(fragment);
    });
  }, []);

  return (
    <div className="userdashboard__root">
      <BackButton className="userdashboard__back-button" />
      <div
        className="userdashboard__dots-left"
        ref={dotsLeftRef}
        aria-hidden="true"
      />

      <div
        className="userdashboard__dots-right"
        ref={dotsRightRef}
        aria-hidden="true"
      />

      <div
        className="userdashboard__stage"
        role="navigation"
        aria-label="Section navigation"
      >
        <svg
          className="userdashboard__ring-svg"
          viewBox="-30 -30 160 160"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Rotating ring */}
          <g className="userdashboard__ring-spin">
            <circle
              className="userdashboard__ring-track"
              cx="50"
              cy="50"
              r="46"
            />

            {menuItems.map((item) => {
              const { x, y } = polarToXY(item.angle, 46);

              return (
                <circle
                  key={`dot-${item.label}`}
                  className="userdashboard__ring-dot"
                  cx={x}
                  cy={y}
                  r="1.3"
                />
              );
            })}
          </g>

          {/* Static Labels */}
          {menuItems.map((item) => {
            const LABEL_R = 62;
            const { x, y } = polarToXY(item.angle, LABEL_R);

            const rad = ((item.angle - 90) * Math.PI) / 180;
            const cosA = Math.cos(rad);

            let anchor: "start" | "middle" | "end";

            if (cosA < -0.2) anchor = "end";
            else if (cosA > 0.2) anchor = "start";
            else anchor = "middle";

            const [line1, line2] = splitLabel(
              item.label,
              allowWrap
            );

            return (
              <g
                key={`label-${item.label}`}
                className="userdashboard__label-group"
                style={{
                  cursor: item.path ? "pointer" : "default",
                }}
                onClick={() =>
                  item.path && navigate(item.path)
                }
              >
                {line2 ? (
                  <>
                    <text
                      x={x}
                      y={y - 2.5}
                      textAnchor={anchor}
                      className="userdashboard__svg-label"
                    >
                      {line1}
                    </text>

                    <text
                      x={x}
                      y={y + 5}
                      textAnchor={anchor}
                      className="userdashboard__svg-label"
                    >
                      {line2}
                    </text>
                  </>
                ) : (
                  <text
                    x={x}
                    y={y + 1.5}
                    textAnchor={anchor}
                    className="userdashboard__svg-label"
                  >
                    {line1}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Portrait */}
        <div className="userdashboard__portrait-wrap">
          <img
            src="/assets/dashboardimg.png"
            alt="Founder portrait"
            className="userdashboard__portrait-img"
          />
        </div>

       
      </div>
    </div>
  );
};

export default UserDashboard;