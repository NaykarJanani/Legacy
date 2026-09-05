import React, { useEffect, useMemo, useState } from "react";
import "./Editorprojects.css";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../services/api";
import { useAuth } from "../../../hooks/useAuth";
import { useLoader } from "../../../context/LoaderContext";

interface AssignedCustomer {
    user_id: number;
    name: string;
    email: string;
    mobile: string;
    category?: string;
    industry?: string;
    entityname?: string;
    state?: string;
    district?: string;
    status?: boolean;
    avatar_url?: string | null;
    created_at?: string;
    assigned_at?: string;
    project_status: string;
    pending_notifications?: number;
}

interface ProjectType {
    id: number;
    title: string;
    author: string;
    created: string;
    editor: string;
    status: string;
    image: string;
    notifications: number;
}

const DEFAULT_PROJECT_IMAGE =
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=300";

const formatDate = (iso?: string) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
};

const Editorprojects: React.FC = () => {

    const navigate = useNavigate();
    const { user } = useAuth();
    const { showLoader, hideLoader } = useLoader();

    const [activeTab, setActiveTab] = useState("All");
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [projects, setProjects] = useState<ProjectType[]>([]);

    const previousPageName = "Dashboard";

    const tabs = [
        "All", "Research", "Drafting", "In Review", "Approved", "Ready To Publish", "Published",
    ];

    useEffect(() => {
        const getData = async () => {
            try {
                showLoader();
                const res = await api.get("/customers");

                if (res.data.success) {
                    const mapped: ProjectType[] = (res.data.data as AssignedCustomer[]).map(
                        (c) => ({
                            id: c.user_id,
                            title: `A journey through time: ${c.name}`,
                            author: c.name,
                            created: formatDate(c.assigned_at || c.created_at),
                            editor: user?.name || "-",
                            image: c.avatar_url || DEFAULT_PROJECT_IMAGE,
                            status: c.project_status || "Research",
                            notifications: c.pending_notifications || 0,
                        })
                    );
                    setProjects(mapped);
                } else {
                    toast.error(res?.data?.message || "Failed to fetch projects");
                }
            } catch (err: any) {
                toast.error(err.response?.data?.message || "Something went wrong");
            } finally {
                hideLoader();
            }
        };

        getData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredProjects = useMemo(() => {
        return projects.filter((item) => {
            const matchesTab =
                activeTab === "All" ||
                (item.status || "").toLowerCase() === activeTab.toLowerCase();

            const matchesSearch =
                (item.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.author || "").toLowerCase().includes(searchQuery.toLowerCase());

            return matchesTab && matchesSearch;
        });
    }, [activeTab, searchQuery, projects]);

    const itemsPerPage = 6;
    const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);

    const paginatedProjects = filteredProjects.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [currentPage]);

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        setCurrentPage(1);
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        setCurrentPage(1);
    };

    return (
        <div className="editordashboard-container">
            <div className="editorprojects-container">
                <div className="editorprojects-wrapper">

                    <div className="editorprojects-nav-header">
                        <button
                            className="back-button"
                            onClick={() => window.history.back()}
                        >
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <line x1="19" y1="12" x2="5" y2="12"></line>
                                <polyline points="12 19 5 12 12 5"></polyline>
                            </svg>

                            <span>{previousPageName}</span>
                        </button>
                    </div>

                    <div className="editorprojects-header">
                        <div>
                            <h1 className="editorprojects-title">
                                Biography Projects
                            </h1>

                            <p className="editorprojects-subtitle">
                                Manage all active legacy projects.
                            </p>
                        </div>
                    </div>

                    <div className="editorprojects-topbar">

                        <div className="editorprojects-search">
                            <svg
                                className="search-icon"
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <circle cx="11" cy="11" r="8"></circle>
                                <line
                                    x1="21"
                                    y1="21"
                                    x2="16.65"
                                    y2="16.65"
                                ></line>
                            </svg>

                            <input
                                type="text"
                                placeholder="Search project title or author..."
                                value={searchQuery}
                                onChange={handleSearchChange}
                            />
                        </div>

                        <div className="editorprojects-tabs">
                            {tabs.map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => handleTabChange(tab)}
                                    className={`editorprojects-tab-btn ${activeTab === tab
                                        ? "editorprojects-tab-active"
                                        : ""
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                    </div>

                    {paginatedProjects.length > 0 ? (
                        <div className="editorprojects-grid">
                            {paginatedProjects.map((project) => (
                                <div
                                    className="editorprojects-card"
                                    key={project.id}
                                    onClick={() =>
                                        navigate("/editor/Editorcardinnerpage", {
                                            state: { project },
                                        })
                                    }
                                    role="button"
                                    tabIndex={0}
                                    style={{ cursor: "pointer" }}
                                >
                                    <div className="card-overlay-header">

                                        {project.notifications > 0 && (
                                            <div
                                                className="editorprojects-bell"
                                                title={`${project.notifications} Notification${project.notifications > 1 ? "s" : ""} Pending`}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <span className="bell-emoji">🔔</span>

                                                <span className="notification-badge">
                                                    {project.notifications}
                                                </span>
                                            </div>
                                        )}

                                        <div
                                            className={`editorprojects-status status-${project.status
                                                .toLowerCase()
                                                .replace(/\s+/g, "-")
                                                }`}
                                        >
                                            {project.status}
                                        </div>
                                    </div>

                                    <div className="editorprojects-image-wrapper">
                                        <div className="editorprojects-image-border">
                                            <img
                                                src={project.image}
                                                alt={project.author}
                                                className="editorprojects-image"
                                            />
                                        </div>
                                    </div>

                                    <div className="editorprojects-content">
                                        <h3>{project.title}</h3>

                                        <p className="project-meta-author">
                                            <span>By</span> {project.author}
                                        </p>

                                        <p className="project-meta-date">
                                            Created on {project.created}
                                        </p>
                                    </div>

                                    <div className="editorprojects-footer">
                                        <span className="editor-assignment">
                                            Editor:
                                            <strong>{project.editor}</strong>
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="editorprojects-empty">
                            <p>No project data matches your filters.</p>
                        </div>
                    )}

                    {totalPages > 1 && (
                        <div className="editorprojects-pagination">
                            {Array.from({ length: totalPages }).map(
                                (_, index) => (
                                    <button
                                        key={index}
                                        onClick={() =>
                                            setCurrentPage(index + 1)
                                        }
                                        className={`editorprojects-page-dot ${currentPage === index + 1
                                            ? "editorprojects-page-active"
                                            : ""
                                            }`}
                                    />
                                )
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Editorprojects;