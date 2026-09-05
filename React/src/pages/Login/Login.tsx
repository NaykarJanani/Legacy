import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useLoader } from "../../context/LoaderContext";
import api from "../../services/api";
import { toast } from "react-toastify";
import "./Login.css";

const Login: React.FC = () => {
  const [legacyId, setLegacyId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { showLoader, hideLoader } = useLoader();
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    const category = localStorage.getItem("category");
    const email = localStorage.getItem("user_email");

    if (token && email) {
      navigateByRole(role, category, email);
    } else {
      // Fresh arrival — clear stale data
      localStorage.removeItem("role");
      localStorage.removeItem("category");
      localStorage.removeItem("default_password");
      localStorage.removeItem("activeMenuItem");
      localStorage.removeItem("user_email");
    }
  }, []);

  // ✅ intro flag is now per-user: "school_intro_seen_user@email.com"
  // So each new user always sees the scroll page on their first login
  const getIntroKey = (email: string) => `school_intro_seen_${email}`;

  const navigateByRole = (
    role: string | null,
    category: string | null,
    email: string
  ) => {
    if (role === "admin") {
      navigate("/Admin/Dashboard");
    } else if (role === "editor") {
      navigate("/editor/Dashboard");
    } else if (role === "customer" && category === "school") {
      // Check flag for THIS specific user only
      const hasSeenIntro = localStorage.getItem(getIntroKey(email));
      if (hasSeenIntro) {
        navigate("/school/startjourney");
      } else {
        navigate("/school/legacyscrollpage");
      }
    } else if (role === "customer" && category === "msme") {
      navigate("/customer/Dashboard");
    } else if (role === "customer") {
      navigate("/customer/Dashboard");
    } else {
      navigate("/");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    showLoader();

    const apiUrl = legacyId.includes("@admin") ? "/api/admin/login" : "/login";

    try {
      const isAdminLogin = apiUrl === "/api/admin/login";
      const res = await api.post(
        apiUrl,
        isAdminLogin ? { email: legacyId, password } : { username: legacyId, password }
      );

      if (res.data.success) {
        const { token, name, username, display_name, email, role, category } = res.data.data;

        localStorage.setItem("token", token);
        localStorage.setItem("role", role);
        localStorage.setItem("category", category || "");
        localStorage.setItem("default_password", res.data.data.default_password || "");
        localStorage.setItem("activeMenuItem", "0");
        localStorage.setItem("user_email", email); // ✅ store email for flag lookup

        login({ name, username, display_name, email, role, category });

        toast.success("Login successful 🎉");
        navigateByRole(role, category, email);
      } else {
        setError(res.data.message || "Login failed");
        toast.error(res.data.message || "Login failed");
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || "Something went wrong";
      setError(msg);
      toast.error(msg);
    } finally {
      hideLoader();
      setLoading(false);
    }
  };

  return (
    <div className="schooluserloginpage-container">
      <div className="schooluserloginpage-left">
        <img
          src="/assets/loginpagemapimg.png"
          alt="India Map"
          className="schooluserloginpage-map-image"
        />
      </div>

      <div className="schooluserloginpage-right">
        <div className="schooluserloginpage-logo-wrapper">
          <img
            src="/assets/legacylogo.png"
            alt="Legacy Library"
            className="schooluserloginpage-logo-image"
          />
          <p className="schooluserloginpage-sentence">
            A Santuary for extra ordinary lives
          </p>
        </div>

        <form className="schooluserloginpage-form" onSubmit={handleSubmit}>
          <div className="schooluserloginpage-input-group">
            <input
              type="text"
              placeholder="Your Legacy Id"
              className="schooluserloginpage-input"
              value={legacyId}
              onChange={(e) => setLegacyId(e.target.value)}
              required
            />
          </div>

          <div className="schooluserloginpage-input-group">
            <input
              type="password"
              placeholder="Your Password"
              className="schooluserloginpage-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="schooluserloginpage-input-group">
            <select className="schooluserloginpage-select">
              <option>Language</option>
              <option>English</option>
              <option>Hindi</option>
              <option>Gujarati</option>
            </select>
          </div>

          {error && (
            <p style={{ color: "red", fontSize: "0.85rem", marginBottom: "8px" }}>
              {error}
            </p>
          )}

          <button
            className="schooluserloginpage-button"
            type="submit"
            disabled={loading}
          >
            {loading ? "Please wait..." : "Begin your story"}
          </button>

          <p className="schooluserloginpage-signup">
            <a href="/signup">Sign Up</a> / Login
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;