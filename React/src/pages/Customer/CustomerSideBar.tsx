import { useEffect, useState } from "react";
import { Menu, X } from 'lucide-react';
import LanguageChange from "../../components/LanguageChange";
import { useNavigate } from "react-router-dom";
import { confirmAlert } from "../../utils/confirmAlert";

const CustomerSideBar = () => {

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);



  const navigate = useNavigate();
  const category = localStorage.getItem("category") || "msme";
  const menuItems =
  category === "school"
    ? [
        { label: 'School Dashboard', href: '/Customer/Dashboard' },
        { label: 'Academic Journey', href: '/Customer/State' },
        { label: 'Student Activities', href: '/Customer/Activities' },
        { label: 'School Vision', href: '/Customer/Vision' },
        { label: 'Support', href: '/Support' },
        { label: 'Logout', href: '/Logout' },
      ]
    : [
        { label: 'Home', href: '/Customer/Dashboard' },
        { label: 'Journey Map', href: '/Customer/State' },
        { label: 'Vision Board', href: '/Customer/Vision' },
        { label: 'Key Involvements', href: '/Customer/Involvements' },
        { label: 'Support', href: '/Support' },
        { label: 'Logout', href: '/Logout' },
      ];

  const handleMenuClick = async(href: string) => {
    setIsSidebarOpen(false);
    
    if(href.includes("Logout")){
      const cof = await confirmAlert("Are you sure .?","");
      if(cof){
      navigate(href);
      }
    }else{ 
      navigate(href);
    }
    // Navigate to section
  };
 const [darkMode, setDarkMode] = useState(() => {
      if (typeof window !== "undefined") {
        return localStorage.getItem("darkMode") === "true";
      }
      setDarkMode(darkMode)
      return false;
    });

    useEffect(() => {
    if (!darkMode) {
      document.body.style.background = "#000000ff"; // dark background color
    } else {
      document.body.style.background = "#ffffff"; // light background color
    }
  }, [darkMode]);
  return (
    <>
      <LanguageChange />

      <header className="LifeStorypage-header">
        <div className="LifeStorypage-logo" style={{color: darkMode==true? 'black':''}}>LEGACY LIBRARY</div>
        <button
          className="LifeStorypage-menu-btn"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          aria-label="Toggle menu"
          
        >
          {isSidebarOpen ? <X  size={24} /> : <Menu style={{color: darkMode==true? 'black':''}} size={24} />}
        </button>
      </header>
      <aside className={`LifeStorypage-sidebar ${isSidebarOpen ? 'LifeStorypage-sidebar-open' : ''}`} style={{background: darkMode==true? 'rgb(223 223 223)':''}}>
        <nav className="LifeStorypage-nav">
          {menuItems.map((item, index) => (
            <a
              key={index}
              href={item.href}
              className="LifeStorypage-nav-item"
              onClick={(e) => {
                e.preventDefault();
                handleMenuClick(item.href);
              }}
              style={{color: darkMode==true? 'black':'',border: darkMode==true? '0':''}}
              
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
    </>

  )

}

export default CustomerSideBar;