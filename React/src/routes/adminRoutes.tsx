// src/routes/adminRoutes.tsx
import { Route } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";
import AdminSidebar from "../pages/Admin/AdminSidebar/AdminSidebar";
import AdminDashboard from "../pages/Admin/AdminDashboard/AdminDashboard";
import AdminCrm from "../pages/Admin/AdminCrm/AdminCrm";
import AdminCrmRegister from "../pages/Admin/AdminCrm/AdminCrmRegister";
import AdminEditorManagement from "../pages/Admin/AdminEditorManagement/AdminEditorManagement";
import AdminPublishingFlipbookManagement from "../pages/Admin/AdminPublishingFlipbookManagement/AdminPublishingFlipbookManagement";
import AdminDailyActiveUser from "../pages/Admin/AdminDailyActiveUser/AdminDailyActiveUser";
import AdminSessionManagement from "../pages/Admin/AdminSessionManagement/AdminSessionManagement";
import AdminCrmDetails from "../pages/Admin/AdminCrm/AdminCrmDetailsPage";
import AdminEditorRegister from "../pages/Admin/AdminEditorManagement/AdminEditorRegister";
import AdminEditorDetails from "../pages/Admin/AdminEditorManagement/AdminEditorDetails";
import AdminSessionManagementRegister from "../pages/Admin/AdminSessionManagement/AdminSessionManagementRegister";
import AdminSessionManagementEdit from "../pages/Admin/AdminSessionManagement/AdminSessionManagementEdit";
import AdminFlipbookViewer from "../pages/Admin/AdminPublishingFlipbookManagement/AdminFlipbookViewer";
import Settings from "../pages/Admin/AdminSettings/Settings";

const adminRoutes = (
  <>

    <Route
      path="/Admin/Dashboard"
      element={
        <ProtectedRoute requiredRole="admin">

          <div className="d-flex">
            <AdminSidebar >
              <AdminDashboard />
            </AdminSidebar>

          </div>
        </ProtectedRoute>
      }
    />

    <Route
      path="/Admin/CRM"
      element={
        <ProtectedRoute requiredRole="admin">

          <div className="d-flex">
            <AdminSidebar >
              <AdminCrm />
            </AdminSidebar>

          </div>
        </ProtectedRoute>

      }
    />


    <Route
      path="/Admin/CRM/Register"
      element={
        <ProtectedRoute requiredRole="admin">

          <div className="d-flex">
            <AdminSidebar >
              <AdminCrmRegister />
            </AdminSidebar>

          </div>
        </ProtectedRoute>

      }
    />


    <Route
      path="/Admin/EditorManagement"
      element={
        <ProtectedRoute requiredRole="admin">

          <div className="d-flex">
            <AdminSidebar >
              <AdminEditorManagement />
            </AdminSidebar>

          </div>
        </ProtectedRoute>

      }
    />

    <Route
      path="/Admin/SessionManagement"
      element={
        <ProtectedRoute requiredRole="admin">

          <div className="d-flex">
            <AdminSidebar >
              <AdminSessionManagement />
            </AdminSidebar>

          </div>
        </ProtectedRoute>

      }
    />


    <Route
      path="/Admin/PublishingFlipbookManagement"
      element={
        <ProtectedRoute requiredRole="admin">

          <div className="d-flex">
            <AdminSidebar >
              <AdminPublishingFlipbookManagement />
            </AdminSidebar>

          </div>
        </ProtectedRoute>

      }
    />

    <Route
      path="/Admin/DailyActiveUser"
      element={
        <ProtectedRoute requiredRole="admin">

          <div className="d-flex">
            <AdminSidebar >
              <AdminDailyActiveUser />
            </AdminSidebar>

          </div>
        </ProtectedRoute>

      }
    />


     <Route
      path="/Admin/CRM/Details"
      element={
        <ProtectedRoute requiredRole="admin">
          <div className="d-flex">
            <AdminSidebar >
              <AdminCrmDetails />
            </AdminSidebar>

          </div>
        </ProtectedRoute>
      }
    />
    
     <Route
      path="/Admin/EditorManagement/Register"
      element={
        <ProtectedRoute requiredRole="admin">
          <div className="d-flex">
            <AdminSidebar >
              <AdminEditorRegister />
            </AdminSidebar>

          </div>
        </ProtectedRoute>
      }
    />

     <Route
      path="/Admin/EditorManagement/Details"
      element={
        <ProtectedRoute requiredRole="admin">
          <div className="d-flex">
            <AdminSidebar >
              <AdminEditorDetails />
            </AdminSidebar>

          </div>
        </ProtectedRoute>
      }
    />

    <Route
      path="/Admin/SessionManagement/Register"
      element={
        <ProtectedRoute requiredRole="admin">
          <div className="d-flex">
            <AdminSidebar >
              <AdminSessionManagementRegister />
            </AdminSidebar>

          </div>
        </ProtectedRoute>
      }
    />

     <Route
      path="/Admin/SessionManagement/edit"
      element={
        <ProtectedRoute requiredRole="admin">
          <div className="d-flex">
            <AdminSidebar >
              <AdminSessionManagementEdit />
            </AdminSidebar>

          </div>
        </ProtectedRoute>
      }
    />

    <Route
  path="/Admin/FlipbookViewer/:id"
  element={
    <ProtectedRoute requiredRole="admin">

      <div className="d-flex">
        <AdminSidebar >
          <AdminFlipbookViewer />
        </AdminSidebar>

      </div>
    </ProtectedRoute>
  }
/>

<Route
  path="/Admin/Settings"
  element={
    <ProtectedRoute requiredRole="admin">

      <div className="d-flex">
        <AdminSidebar>
          <Settings />
        </AdminSidebar>

      </div>
    </ProtectedRoute>
  }
/>
  </>
  
);


export default adminRoutes;
