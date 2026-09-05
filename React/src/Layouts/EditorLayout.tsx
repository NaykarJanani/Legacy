import { Outlet } from "react-router-dom";
import EditorSidebar from "../components/EditorSidebar";

const EditorLayout = () => {
    return (
        <div className="editorsidebar-layout">
            {/* SIDEBAR */}
            <EditorSidebar />

            {/* PAGE CONTENT */}
            <main className="editorsidebar-page-content">
                <Outlet />
            </main>
        </div>
    );
};

export default EditorLayout;