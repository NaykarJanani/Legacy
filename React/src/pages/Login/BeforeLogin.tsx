import React from "react";
import "./BeforeLogin.css";
import { useNavigate } from "react-router-dom";

const SchoolUserStartingPage: React.FC = () => {
    const navigate = useNavigate();

    const handleEnter = () => { navigate("/login"); };

    return (
        <div className="schooluserstartingpage-container">
            <div className="schooluserstartingpage-content">

                <p className="schooluserstartingpage-subtitle">
                    Lets inspire through
                </p>

                <img
                    src="/assets/lifestory.png"
                    alt="Life Story"
                    className="schooluserstartingpage-logo"
                />

                <p className="schooluserstartingpage-description">
                    Behind every face, there’s a story of getting through.
                </p>

                <button
                    className="schooluserstartingpage-enterbtn"
                    onClick={handleEnter}
                >
                    ENTER
                </button>

            </div>
        </div>
    );
};

export default SchoolUserStartingPage;