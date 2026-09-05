// src/components/layout/Navbar.tsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";

interface NavbarProps {
  isAuthenticated: boolean;
  role?: "student" | "teacher" | "admin";
  onLogout: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ isAuthenticated, role, onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate("/login");
  };

  return (
    <nav className="bg-gray-900 text-white shadow-md">
      <div className="container mx-auto flex justify-between items-center px-6 py-3">
        {/* Logo */}
        <Link to="/" className="text-xl font-bold hover:text-blue-400 transition-colors">
          SNC Portal
        </Link>

        {/* Links */}
        <div className="flex space-x-6">
          <Link to="/" className="hover:text-blue-400 transition-colors">
            Home
          </Link>

          {isAuthenticated && role === "student" && (
            <Link to="/student" className="hover:text-blue-400 transition-colors">
              Student Dashboard
            </Link>
          )}

          {isAuthenticated && role === "teacher" && (
            <Link to="/teacher" className="hover:text-blue-400 transition-colors">
              Teacher Dashboard
            </Link>
          )}

          {isAuthenticated && role === "admin" && (
            <Link to="/admin" className="hover:text-blue-400 transition-colors">
              Admin Panel
            </Link>
          )}

          {!isAuthenticated && (
            <>
              <Link to="/login" className="hover:text-blue-400 transition-colors">
                Login
              </Link>
              <Link to="/register" className="hover:text-blue-400 transition-colors">
                Register
              </Link>
            </>
          )}
        </div>

        {/* Logout Button */}
        {isAuthenticated && (
          <button
            onClick={handleLogout}
            className="ml-6 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Logout
          </button>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
