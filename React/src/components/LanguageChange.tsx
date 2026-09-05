import { useState, useEffect } from "react";
import './LanguageChange.css'
import { useNavigate } from "react-router-dom";
const LanguageChange = () => {
  const [open, setOpen] = useState(false);
    // const navigate = useNavigate();

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("darkMode") === "true";
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("darkMode", darkMode.toString());
      if (darkMode) {
        document.body.classList.add("dark-mode");
      } else {
        document.body.classList.remove("dark-mode");
      }
    }
  }, [darkMode]);

  const languages = ["English", "Spanish", "French", "German"];

  const handleLanguageClick = (lang: any) => {
    setOpen(false);
   
  };

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
    window.location.reload();
  };

  return (
    <>
      {open && (
        <div style={styles.languageList}>
          {languages.map((lang) => (
            <div
              key={lang}
              style={styles.languageItem}
              onClick={() => handleLanguageClick(lang)}
            >
              {lang}
            </div>
          ))}
        </div>
      )}

      <div style={styles.circle} onClick={() => setOpen(!open)}>
        {/* World icon SVG */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="white"
          height="24"
          width="24"
          viewBox="0 0 24 24"
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c0 0 0 0 0 0 5.52 0 10-4.48 10-10S17.52 2 12 2zm6.93 6h-2.36a15.222 15.222 0 0 0-1.423-3.999A8.015 8.015 0 0 1 18.93 8zm-6.93-4c1.654 0 3.169.67 4.232 1.752A13.61 13.61 0 0 0 12 9c-1.082 0-2.12.208-3.07.576A8.045 8.045 0 0 1 12 4zm-4.37.901A15.283 15.283 0 0 0 6.43 8H4.07a8.013 8.013 0 0 1 3.53-3.099zm-3.53 6.199H6.4a13.183 13.183 0 0 0 3.995 6.327A8.043 8.043 0 0 1 4.07 11.1zm7.23 6.9c-1.654 0-3.169-.672-4.232-1.754A13.607 13.607 0 0 0 12 15c1.122 0 2.207.267 3.156.737A8.043 8.043 0 0 1 11.3 18zm2.66-4a14.733 14.733 0 0 1 1.263 4.002 8.003 8.003 0 0 1-5.203-4.002h3.94zm.464-3.94h-3.96a15.545 15.545 0 0 1-1.5-2.968 8.02 8.02 0 0 1 5 2.968zm2.786 2.968h-2.37a13.813 13.813 0 0 0-1.46-4.01 8.11 8.11 0 0 1 3.83 4.01zM18.7 11.1a13.282 13.282 0 0 0-3.845-6.327 7.998 7.998 0 0 1 3.825 6.327z" />
        </svg>
      </div>

      {/* Theme toggle switch */}
      <label className="switch" style={styles.themeSwitch}>
        <input
          type="checkbox"
          checked={darkMode}
          onChange={toggleDarkMode}
          id="checkbox"
        />
        <span className="slider">
          <div className="star star_1"></div>
          <div className="star star_2"></div>
          <div className="star star_3"></div>
          <svg
            viewBox="0 0 16 16"
            className="cloud_1 cloud"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              transform="matrix(.77976 0 0 .78395-299.99-418.63)"
              fill="#fff"
              d="m391.84 540.91c-.421-.329-.949-.524-1.523-.524-1.351 0-2.451 1.084-2.485 2.435-1.395.526-2.388 1.88-2.388 3.466 0 1.874 1.385 3.423 3.182 3.667v.034h12.73v-.006c1.775-.104 3.182-1.584 3.182-3.395 0-1.747-1.309-3.186-2.994-3.379.007-.106.011-.214.011-.322 0-2.707-2.271-4.901-5.072-4.901-2.073 0-3.856 1.202-4.643 2.925"
            ></path>
          </svg>
        </span>
      </label>
    </>
  );
};

const styles: any = {
  circle: {
    position: "fixed",
    bottom: 20,
    right: 20,
    backgroundColor: "#383838ff",
    borderRadius: "50%",
    width: 50,
    height: 50,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    cursor: "pointer",
    boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
    zIndex: 1000,
    
  },
  languageList: {
    position: "fixed",
    bottom: 80,
    right: 20,
    backgroundColor: "white",
    borderRadius: 8,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    padding: 10,
    zIndex: 1000,
    width: 120,
    display: "flex",
    flexDirection: "column",
    color:'black'
  },
  languageItem: {
    padding: 8,
    cursor: "pointer",
    borderRadius: 4,
    userSelect: "none",
  },
  themeSwitch: {
    position: "fixed",
    top: 70,
    right: 32,
    zIndex: 1000,
  },
};

export default LanguageChange;
