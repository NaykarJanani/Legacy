import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const LogoutPage = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    logout();           // ✅ called exactly once, after render, not during it
    navigate("/login", { replace: true }); // replace so back button doesn't return to /logout
  }, []);

  return null; // nothing to render — redirect happens in useEffect
};

export default LogoutPage;