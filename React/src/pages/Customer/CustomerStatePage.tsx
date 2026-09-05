import React, { useState } from 'react';
import './CustomerStatePage.css'
import CustomerSideBar from './CustomerSideBar';
import DotsInCircleReveal from '../../components/State';
const CustomerStatePage: React.FC = () => {

  const handlePageClick = () => {
    handleJourneyStart()
  };

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("darkMode") === "true";
    }
    setDarkMode(darkMode)
    return false;
  });

  const [lifting, setLifting] = useState(false);
  const handleJourneyStart = () => {
    setLifting(true);
    setTimeout(() => {
      // Replace with your routing method (e.g., react-router)
      window.location.href = '/nextpage';
    }, 1000); // Match this to the duration of your animation
  };



  return (
    <div className="LifeStorypage-container" >
      {/* Video Background */}
      <div className="LifeStorypage-video-wrapper" style={{ backgroundColor: darkMode == true ? 'white' : '' }}>

      </div>

      <CustomerSideBar />
      
      <main
        className={` start-journey-page__main-content LifeStorypage-main${lifting ? ' lifting' : ''}`}
        role="button"
        tabIndex={0}
        style={{position:'relative'}}
      >
       
        <div className="start-journey-page__left-content">
          <a   style={{ color: darkMode == true ? 'black' : '' }}      onClick={handlePageClick}  className="start-journey-page__journey-link">
            Let's Start Your
            <span className="start-journey-page__circle"></span>
            <br />
            Journey
          </a>
        </div>
        <div className="start-journey-page__map-container">
          <div className='start-journey-page__map-img'>
            <DotsInCircleReveal imageName="gujarat.png" />
          </div>
        </div>

      </main>
     
    </div>
  );
};

export default CustomerStatePage;