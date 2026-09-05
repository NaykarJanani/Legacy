import React from "react";
import { useNavigate } from "react-router-dom";
import "./BackButton.css";

interface BackButtonProps {
    /** Text shown next to the arrow. Defaults to "Back". */
    label?: string;
    /** Optional fallback path used if there's no previous page in history. */
    fallbackPath?: string;
    /** Optional extra class name for page-specific spacing overrides. */
    className?: string;
}

/**
 * Reusable "go back to previous page" button.
 * Used across every Editor module page for consistent back navigation.
 */
const BackButton: React.FC<BackButtonProps> = ({
    label = "Back",
    fallbackPath,
    className = "",
}) => {
    const navigate = useNavigate();

    const handleBackClick = () => {
        // If the page was opened directly (no history to go back to),
        // fall back to a sensible default instead of leaving the app.
        if (fallbackPath && window.history.state?.idx === 0) {
            navigate(fallbackPath);
            return;
        }
        navigate(-1);
    };

    return (
        <div className={`back-button-nav-header ${className}`}>
            <button
                type="button"
                className="back-button"
                onClick={handleBackClick}
                aria-label={`Back to ${label}`}
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
             
            </button>
        </div>
    );
};

export default BackButton;
