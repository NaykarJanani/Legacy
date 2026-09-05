import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { ToastContainer } from "react-toastify";
import { LoaderProvider } from "./context/LoaderContext";
import "slick-carousel/slick/slick.css"; 
import "slick-carousel/slick/slick-theme.css";
import "react-toastify/dist/ReactToastify.css";

document.title = import.meta.env.VITE_APP_NAME || "Default Title";

function Root() {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("darkMode") === "true";
    }
    setDarkMode(darkMode)
    return false;
  });

  // Optional: keep dark mode in sync with localStorage
  useEffect(() => {
    localStorage.setItem("darkMode", darkMode.toString());
    document.body.classList.toggle("dark", darkMode);
  }, [darkMode]);

  return (
    <BrowserRouter>
      <LoaderProvider>
        <ToastContainer
          theme={!darkMode ? "dark" : "light"}
          position="top-right"
          autoClose={3000}
          style={{ zIndex: "1000000" }}
        />
        <App />
      </LoaderProvider>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
