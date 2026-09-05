import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import PublishRequestsBell from "./PublishRequestsBell";
import "./EditorSidebar.css";

import {
  LayoutDashboard,
  FolderKanban,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const menuItems = [
  {
    id: 1,
    icon: <LayoutDashboard size={20} />,
    label: "Dashboard",
    path: "/editor/dashboard",
  },
  {
    id: 2,
    icon: <FolderKanban size={20} />,
    label: "Projects",
    path: "/editor/Editorprojects",
  },
  {
    id: 3,
    icon: <Settings size={20} />,
    label: "Settings",
    path: "/editor/Editorsetting",
  },
];

const EditorSidebar = () => {
  const [open, setOpen] = useState(false);

  // ACTIVE MENU STATE
  const [activeMenu, setActiveMenu] = useState("Dashboard");

  // NAVIGATE
  const navigate = useNavigate();

  // LOGGED-IN USER (already set at login, updated live from Editor Settings)
  const { user } = useAuth();
  const displayName = user?.display_name || user?.username || user?.name || "Editor";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <>
      {/* MOBILE HEADER */}
      <div className="editorsidebar-mobile-header">
        <button
          className="editorsidebar-menu-btn"
          onClick={() => setOpen(true)}
        >
          <Menu size={22} />
        </button>

        <div style={{ marginLeft: "auto" }}>
          <PublishRequestsBell />
        </div>
      </div>

      {/* OVERLAY */}
      {open && (
        <div
          className="editorsidebar-overlay"
          onClick={() => setOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`editorsidebar-container ${open ? "editorsidebar-open" : ""
          }`}
      >
        {/* CLOSE BUTTON */}
        <button
          className="editorsidebar-close-btn"
          onClick={() => setOpen(false)}
        >
          <X size={22} />
        </button>

        {/* LOGO */}
        <div className="editorsidebar-logo-section">
          <div className="editorsidebar-logo-icon">✎</div>

          <div>
            <h1>LifeStory</h1>
            <p>LEGACY LIBRARY</p>
          </div>
        </div>

        {/* MENU */}
        <nav className="editorsidebar-menu">
          {menuItems.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                setActiveMenu(item.label);
                setOpen(false);

                // NAVIGATE TO PAGE
                navigate(item.path);
              }}
              className={`editorsidebar-menu-item ${activeMenu === item.label ? "active" : ""
                }`}
            >
              <span className="editorsidebar-menu-icon">
                {item.icon}
              </span>

              <span>{item.label}</span>
            </div>
          ))}
        </nav>

        {/* FOOTER */}
        <div className="editorsidebar-footer">
          <div className="editorsidebar-user">
            <div className="editorsidebar-avatar">{initial}</div>

            <div>
              <h4>{displayName}</h4>
              <p>Editor</p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <PublishRequestsBell />

            <button
              className="editorsidebar-logout"
              onClick={() => {
                setOpen(false);
                navigate("/logout");
              }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default EditorSidebar;