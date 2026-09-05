import React, { useState, useEffect, type ReactNode } from 'react';
import './AdminSidebar.css';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { confirmAlert } from '../../../utils/confirmAlert';

interface SidebarProps {
  children?: ReactNode;
}

const AdminSidebar: React.FC<SidebarProps> = ({ children }) => {
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [activeMenuItem, setActiveMenuItem] = useState<number>(0);
  const navigate = useNavigate();
  const {user} = useAuth();
  useEffect(() => {
    // Hide sidebar on small screens
    if (window.innerWidth < 768) {
      setIsSidebarHidden(true);
    }

    // Restore active menu from localStorage
    const storedActive = localStorage.getItem('activeMenuItem');
    if (storedActive !== null) {
      setActiveMenuItem(Number(storedActive));
    }
  }, []);

  const menuItems = [
    { icon: 'bxs-dashboard', text: 'Dashboard', link: '/Admin/Dashboard' },
    { icon: 'bxs-user', text: 'CRM', link: '/Admin/CRM' },
    { icon: 'bx-git-branch', text: 'Editor Management', link: '/Admin/EditorManagement' },
    { icon: 'bxs-book-open', text: 'Session Management', link: '/Admin/SessionManagement' },
    { icon: 'bxs-book', text: 'Flipbook Management', link: '/Admin/PublishingFlipbookManagement' },
    { icon: 'bx-tab', text: 'Daily Active User', link: '/Admin/DailyActiveUser' },
  ];
  const toggleSidebar = () => {
    setIsSidebarHidden(!isSidebarHidden);
  };

  const changeThePage = (link: string, index: number) => {
    setActiveMenuItem(index);
    localStorage.setItem('activeMenuItem', index.toString()); // Save active item
    navigate(link);
  };

  return (
    <>
      <link
        href="https://unpkg.com/boxicons@2.0.9/css/boxicons.min.css"
        rel="stylesheet"
      />

      <section id="sidebar" className={isSidebarHidden ? 'hide' : ''}>
        <a className="brand" onClick={(e) => e.preventDefault()}>
          <i className="bx bxs-smile"></i>
          <span className="text">LOGO</span>
        </a>

        <ul className="side-menu top p-0 ml-1">
          {menuItems.map((item, index) => (
            <li
              key={index}
              className={activeMenuItem === index ? 'active' : ''}
              style={{ cursor: 'pointer' }}
            >
              <a
                onClick={(e) => {
                  e.preventDefault();
                  changeThePage(item.link, index);
                }}
              >
                <i className={`bx ${item.icon}`}></i>
                <span className="text">{item.text}</span>
              </a>
            </li>
          ))}
        </ul>

        <ul className="side-menu p-0">
         <li
  className={activeMenuItem === 6 ? 'active' : ''}
  style={{ cursor: 'pointer' }}
>
  <a
    onClick={(e) => {
      e.preventDefault();
      changeThePage('/Admin/Settings', 6);
    }}
  >
    <i className="bx bxs-cog"></i>
    <span className="text">Settings</span>
  </a>
</li>
          <li>
            <a href="#" className="logout" onClick={async (e) => 
            {
              e.preventDefault() 
              const temp = await confirmAlert("Confirm Logout ?","");
              if(temp){
                navigate('/logout')
              }
            }}>
              <i className="bx bxs-log-out-circle"></i>
              <span className="text">Logout</span>
            </a>
          </li>
        </ul>
      </section>

      <section id="content">
        <nav>
          <i className="bx bx-menu" onClick={toggleSidebar}></i>
          <a href="#" className="profile d-flex " style={{gap:"10px"}} onClick={(e) => e.preventDefault()}>
            <div className="profile-avatar-sidebar">
  {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
</div>
            <div className='p-0 m-0'>

            <p className='p-0 m-0' style={{fontSize:'15px'}}>{user?.name}</p>
            <p className='p-0 m-0' style={{fontSize:'12px'}}>{user?.email}</p>
            </div>
          </a>
        </nav>

        <main className='p-4'>
          <div className='p-2' style={{backgroundColor:'#f9f9f9',borderRadius:'10px'}}>
            {children}
          </div>
        </main>
      </section>
    </>
  );
};

export default AdminSidebar;
