import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { confirmAlert } from "../utils/confirmAlert";
import api from "../services/api";
import "./SchoolUserNavbar.css";

const SchoolUserNavbar: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  useEffect(() => {
    let cancelled = false;

    api.get("/profile")
      .then((response) => {
        const entityName = response.data?.data?.entityname;
        if (!cancelled && typeof entityName === "string" && entityName.trim()) {
          updateUser({ entityname: entityName.trim() });
        }
      })
      .catch(() => {
        // Keep the navbar usable if profile loading temporarily fails.
      });

    return () => {
      cancelled = true;
    };
  }, [updateUser]);

  const handleLogout = async () => {
    const confirmed = await confirmAlert("Confirm Logout?", "");
    if (confirmed) {
      navigate("/logout");
    }
  };

  return (
    <header className="school-user-navbar">
      {/* Left Section */}
      <div className="school-user-navbar__left">
        <div className="school-user-navbar__logo">
          <img
            src="/assets/schoollogo.png"
            alt="School Logo"
            className="school-user-navbar__logo-img"
          />
        </div>
        <h1 className="school-user-navbar__school-name">
          {user?.entityname || ""}
        </h1>
      </div>

      {/* Center Section */}
      <div className="school-user-navbar__center">
        <span className="school-user-navbar__page-title">
          Founder's Story - Inner Page
        </span>
      </div>

      {/* Right Section */}
      <div className="school-user-navbar__right">
        {/* User name */}
        {user?.name && (
          <span className="school-user-navbar__username">{user.name}</span>
        )}

        {/* Profile avatar */}
        <button className="school-user-navbar__profile-btn">
          <img
            src="/assets/profileimg.png"
            alt="User"
            className="school-user-navbar__profile-img"
          />
        </button>

        {/* Logout button */}
        <button
          className="school-user-navbar__logout-btn"
          onClick={handleLogout}
          title="Logout"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            width="18"
            height="18"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M15 3H19C20.1 3 21 3.9 21 5V19C21 20.1 20.1 21 19 21H15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M10 17L15 12L10 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line
              x1="15"
              y1="12"
              x2="3"
              y2="12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
};

export default SchoolUserNavbar;
