// src/App.tsx
import { Routes, Route } from "react-router-dom";
import Login from "./pages/Login/Login";
import { AuthProvider } from "./context/AuthContext";
import LogoutPage from "./components/LogoutPage";
import Unauthorized from "./pages/Others/Unauthorized";
import NotFound from "./pages/Others/404_page";

import adminRoutes from "./routes/adminRoutes";
import customerRoutes from "./routes/customerRoutes";
import schoolRoutes from "./routes/schoolRoutes";       // ← NEW
import editorRoutes from "./routes/editorRoutes";       // ← NEW

import "bootstrap/dist/css/bootstrap.min.css";
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./i18n/i18n";
import { useDetectDevTools } from "./utils/useDetectDevTools";
import api from "./services/api";
import "./App.css";
import BeforeLogin from "./pages/Login/BeforeLogin";
import LegacySignupForm from "./pages/Login/Legacysignupform";

function App() {
  useDetectDevTools({
    onDetect: (reason) => {
      api.post("/api/securityError/log-security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, url: window.location.href, ts: Date.now() }),
      }).catch(() => {});
    },
    blockUI: true,
    redirectOnDetect: false,
    disableCopyCut: true,
    checkIntervalMs: 1200,
  });

  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/" element={<BeforeLogin />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<LegacySignupForm />} />
        <Route path="/logout" element={<LogoutPage />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Admin Routes */}
        {adminRoutes}

        {/* Customer Routes */}
        {customerRoutes}

        {/* School Routes */}
        {schoolRoutes}

        {/* Editor Routes */}
        {editorRoutes}

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;