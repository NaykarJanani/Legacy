import { Outlet } from "react-router-dom";
import SchoolUserNavbar from "./SchoolUserNavbar";


const MainLayout = () => {
  return (
    <>
      <SchoolUserNavbar />

      <main>
        <Outlet />
      </main>
    </>
  );
};

export default MainLayout;