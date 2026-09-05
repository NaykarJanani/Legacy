import React, { useEffect, useState } from "react";
import "./Editorcardinnerpage.css";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import api from "../../../services/api";
import { useLoader } from "../../../context/LoaderContext";

interface CustomerSummary {
    user_id: number;
    name: string;
    year?: string;
    category?: string;
    industry?: string;
    entityname?: string;
    avatar_url?: string | null;
    created_at?: string;
    assigned_at?: string;
    project_status: string;
    total_chapters: number;
    approved_chapters: number;
    progress_percent: number;
    total_pages: number;
    last_updated?: string | null;
}

const formatDate = (iso?: string | null) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
    });
};

const Editorcardinnerpage: React.FC = () => {

    const navigate = useNavigate();
    const location = useLocation();
    const { showLoader, hideLoader } = useLoader();

    // Passed from Editorprojects.tsx as { project: { id, title, author, ... } }
    const projectFromState = (location.state as any)?.project;
    const customerId = projectFromState?.id;

    const [summary, setSummary] = useState<CustomerSummary | null>(null);

    const previousPageName = "All Projects";

    useEffect(() => {
        const getData = async () => {
            if (!customerId) {
                toast.error("No project selected");
                navigate(-1);
                return;
            }
            try {
                showLoader();
                const res = await api.get(`/customer/${customerId}/summary`);

                if (res.data.success) {
                    setSummary(res.data.data);
                } else {
                    toast.error(res?.data?.message || "Failed to fetch project details");
                }
            } catch (err: any) {
                toast.error(err.response?.data?.message || "Something went wrong");
            } finally {
                hideLoader();
            }
        };

        getData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customerId]);

    const tools = [
        {
            title: "Start Journey",
            subtitle: "",
            icon: "🚀",
            path: "/editor/startjourney",
        },
        {
            title: "AI Writing Studio",
            subtitle: "Chapter-by-chapter AI drafts",
            icon: "✍️",
            path: "/editor/EditorChapterpage",
        },
        {
            title: "Book Layout Designer",
            subtitle: "Drag & drop 2-page spread builder",
            icon: "📚",
            new: true,
            path: "/editor/BookLayoutPage",
        },
        {
            title: "Review & Approval",
            subtitle: "Chapter sign-off workflow",
            icon: "✅",
            path: "/editor/Viewapprovedpage",
        },
        {
            title: "Vision Board",
            subtitle: "",
            icon: "🎯",
            path: "/editor/visionboard",
        },
        {
            title: "Achievement",
            subtitle: "",
            icon: "🏆",
            path: "/editor/achievement",
        },
        {
            title: "Legacy Timeline",
            subtitle: "",
            icon: "🕒",
            path: "/editor/legacytimeline",
        },
        {
            title: "Generational Web",
            subtitle: "",
            icon: "🧬",
            path: "/editor/generationweb",
        },
        {
            title: "Media Library",
            subtitle: "",
            icon: "🖼️",
            path: "/editor/Editormedialibrary",
        },
    ];
    const handleBackClick = () => {
        window.history.back();
    };

    // Pass the customer along to whichever tool the editor picks next,
    // so those pages (once made dynamic) already know which project this is.
    const handleToolClick = (path?: string) => {
        if (!path) return;
        navigate(path, { state: { customerId, project: projectFromState, summary } });
    };

    const displayName = summary?.name || projectFromState?.author || "-";
    const establishedYear = summary?.year;
    const status = summary?.project_status || projectFromState?.status || "Research";
    const createdLabel = formatDate(summary?.assigned_at || projectFromState?.created);
    const updatedLabel = summary?.last_updated
        ? formatDate(summary.last_updated)
        : createdLabel;

    return (
        <div className="editordashboard-container">
            <div className="editorcardinnerpage-wrapper">

                {/* BACK NAVIGATION BUTTON */}
                <div className="editorcardinnerpage-nav-header">
                    <button className="back-button" onClick={handleBackClick}>
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

                {/* Main Card */}
                <div className="editorcardinnerpage-maincard">

                    {/* Top Section */}
                    <div className="editorcardinnerpage-top">
                        <div>
                            <h1 className="editorcardinnerpage-title">
                                A Journey Through Time: {displayName}
                            </h1>

                            <p className="editorcardinnerpage-subtitle">
                                {displayName}
                                {establishedYear ? ` • Est. ${establishedYear}` : ""}
                            </p>
                        </div>

                        <div className="editorcardinnerpage-status">
                            {status}
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="editorcardinnerpage-stats">
                        <div className="editorcardinnerpage-statbox">
                            <h2>{summary?.total_pages ?? 0}</h2>
                            <p>Total Pages</p>
                        </div>

                        <div className="editorcardinnerpage-statbox">
                            <h2>{summary?.total_chapters ?? 0}</h2>
                            <p>Chapters</p>
                        </div>

                        <div className="editorcardinnerpage-statbox">
                            <h2>{summary?.progress_percent ?? 0}%</h2>
                            <p>Progress</p>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="editorcardinnerpage-progressbar">
                        <div
                            className="editorcardinnerpage-progressfill"
                            style={{ width: `${summary?.progress_percent ?? 0}%` }}
                        ></div>
                    </div>

                    {/* Footer */}
                    <div className="editorcardinnerpage-footer">
                        Created {createdLabel} • Last updated {updatedLabel}
                    </div>
                </div>

                {/* Tools Section */}
                <div className="editorcardinnerpage-toolssection">
                    <h3 className="editorcardinnerpage-tooltitle">
                        Project Tools
                    </h3>

                    <div className="editorcardinnerpage-toolsgrid">

                        {tools.map((tool, index) => (
                            <div
                                className="editorcardinnerpage-toolcard"
                                key={index}
                                style={{ cursor: "pointer" }}
                                onClick={() => handleToolClick(tool.path)}
                            >
                                <div className="editorcardinnerpage-toolleft">

                                    <div className="editorcardinnerpage-toolicon">
                                        {tool.icon}
                                    </div>

                                    <div>
                                        <div className="editorcardinnerpage-toolname">
                                            {tool.title}

                                            {tool.new && (
                                                <span className="editorcardinnerpage-newbadge">
                                                    New
                                                </span>
                                            )}
                                        </div>

                                        <p className="editorcardinnerpage-toolsubtitle">
                                            {tool.subtitle}
                                        </p>
                                    </div>
                                </div>

                                <div className="editorcardinnerpage-arrow">
                                    ›
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Editorcardinnerpage;