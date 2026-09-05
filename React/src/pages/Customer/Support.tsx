import { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import CustomerSideBar from "./CustomerSideBar";

const accentColor = "#0D8ABC"; // Example accent color
const supportBgLight = "linear-gradient(135deg, #e0f7fa 60%, #ffffffff 100%)";
const supportBgDark = "linear-gradient(135deg, #000000ff 60%, #02213bff 100%)";
const cardBgLight = "#ffffffee";
const cardBgDark = "#23272b";
const cardShadow = "0 6px 24px rgba(13,138,188,0.12)";

const Support = () => {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("darkMode") === "true";
    }
    setDarkMode(darkMode)
    return false;
  });

  useEffect(() => {
    document.body.style.background =
      darkMode ? supportBgLight : supportBgDark;
    document.body.style.color = darkMode ? "#000000ff" : "#f5f5f5";
  }, [darkMode]);

  // Switch theme for demonstration only
  

  return (
    <div
      className="container d-flex flex-column align-items-center justify-content-center min-vh-100"
    >
      <CustomerSideBar />
      {/* Toggle for Theme (Just for Demo) */}
    

      <div
        className="card shadow-lg border-0 p-4 text-center"
        style={{
          background: darkMode ? cardBgDark : cardBgLight,
          color: darkMode ? "#e0f7fa" : "#06647f",
          borderRadius: "24px",
          maxWidth: "500px",
          boxShadow: cardShadow,
          transition: "all 0.5s cubic-bezier(.4,2,.5,1)",
        }}
      >
        <h1 className="fw-bold mb-3" style={{ color: accentColor }}>
          Support Center
        </h1>
        <p className="mb-4">
          We’re here to help! If you have any questions or issues, please reach
          out using one of the options below.
        </p>

        <div className="d-grid gap-3">
          <button
            className="btn btn-lg fw-semibold"
            style={{
              background: accentColor,
              color: "#fff",
              border: "none",
              boxShadow: "0 2px 8px rgba(13,138,188,0.15)",
              borderRadius: 16,
              letterSpacing: 1,
            }}
          >
            📧 Email Support
          </button>
          
        </div>
      </div>

      <footer className="mt-5 small text-center" style={{ color: !darkMode ? "#b2ebf2" : "#333" }}>
        © {new Date().getFullYear()} Your Company. All rights reserved.
      </footer>
    </div>
  );
};

export default Support;
