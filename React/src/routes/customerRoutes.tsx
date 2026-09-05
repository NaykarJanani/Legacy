// src/routes/adminRoutes.tsx
import { Route } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";
import CustomerDashboard from "../pages/Customer/CustomerDashboard";
import Support from "../pages/Customer/Support";
import CustomerStatePage from "../pages/Customer/CustomerStatePage";
import State from "../components/State";

const customerRoutes = (
  <>

    <Route
      path="/customer/Dashboard"
      element={
        <ProtectedRoute requiredRole="customer">

          <div className="d-flex">
              <CustomerDashboard />
          </div>
        </ProtectedRoute>
      }
    />

      <Route
      path="/Support"
      element={
        <ProtectedRoute requiredRole="customer">

          <div className="d-flex">
              <Support />
          </div>
        </ProtectedRoute>
      }
    />

    
      <Route
      path="/Customer/State"
      element={
        <ProtectedRoute requiredRole="customer">

          <div className="d-flex">
              <CustomerStatePage />
          </div>
        </ProtectedRoute>
      }
    />

     
      <Route
      path="/State"
      element={
        <ProtectedRoute requiredRole="customer">
          <div className="d-flex">
              <State />
          </div>
        </ProtectedRoute>
      }
    />

  </>
);

export default customerRoutes;
