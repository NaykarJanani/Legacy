import React, { useState } from 'react';
import { ArrowUp } from 'lucide-react';
import './CustomerDashboard.css';
import CustomerSideBar from './CustomerSideBar';
import { useNavigate } from 'react-router-dom';

const CustomerDashboard: React.FC = () => {

  const handlePageClick = () => {
    window.location.hash = '#journey';
  };
  const navigate = useNavigate();
  const category = localStorage.getItem("category") || "msme";

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("darkMode") === "true";
    }
    setDarkMode(darkMode)
    return false;
  });

  const [lifting, setLifting] = useState(false);
  const dashboardContent = {
  msme: {
    subtitle: "Lets inspire through",
    titleImage: darkMode == true
      ? "/LifeStorypage/lifestoryblack.png"
      : "/LifeStorypage/lifestoryimgwhite.png",
    description: "Lets build your journey map, Starting with your picture",
    route: "/Customer/State"
  },

  school: {
    subtitle: "Lets inspire students through",
    titleImage: darkMode == true
      ? "/LifeStorypage/schoolblack.png"
      : "/LifeStorypage/schoolwhite.png",
    description: "Lets build your school legacy journey",
    route: "/Customer/State"
  }
};
const currentDashboard =
  dashboardContent[category as keyof typeof dashboardContent] ||
  dashboardContent.msme;
  const handleJourneyStart = () => {
    setLifting(true);
    setTimeout(() => {
      // Replace with your routing method (e.g., react-router)
      navigate(currentDashboard.route);
    }, 1000); // Match this to the duration of your animation
  };



  return (
    <div className="LifeStorypage-container" >
      {/* Video Background */}
      <div className={`LifeStorypage-video-wrapper${lifting ? ' lifting' : ''}`} style={{ backgroundColor: darkMode == true ? 'white' : '' }}>
        <video
          className="LifeStorypage-video"
          autoPlay
          muted
          playsInline
        >
          <source src={darkMode == true ? "/login/IndiaMapWhite.mp4" : "/login/IndiaMap.mp4"} type="video/mp4" />

        </video>
        <div className="LifeStorypage-overlay" />
      </div>

      {/* Header with Menu Button */}


      {/* Right Sidebar */}
      <CustomerSideBar />

      {/* Main Content - Clickable */}
      <main
        className={`LifeStorypage-main${lifting ? ' lifting' : ''}`}
        onClick={handlePageClick}
        role="button"
        tabIndex={0}
      >
        <div className="LifeStorypage-content">
          <p
  className="LifeStorypage-subtitle"
  style={{ color: darkMode == true ? 'black' : '' }}
>
  {currentDashboard.subtitle}
</p>
          <img
           src={currentDashboard.titleImage}
            alt="Life Story"
            className="LifeStorypage-logo-img"
          />
          <div className="LifeStorypage-description">
            <span className="LifeStorypage-icon" style={{ color: darkMode == true ? 'black' : '' }}><ArrowUp /></span>

            <p
              className="LifeStorypage-text"
              style={{ color: darkMode == true ? 'black' : '' }}
              onClick={handleJourneyStart}
              role="button"
              tabIndex={0}
            >
              {currentDashboard.description}
            </p>

          </div>
        </div>
      </main>


    </div>
  );
};

export default CustomerDashboard;