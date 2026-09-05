// src/routes/schoolRoutes.tsx
import { Route } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";

// School Layouts
import MainLayout from "../Layouts/MainLayout";
import UserDashboard from "../pages/School/Dashboard/Userdashboard";
import LegacyOrbit from "../pages/School/Dashboard/LegacyOrbit";
import CircleSubPointsPage from "../pages/School/Dashboard/CircleSubPointsPage";
import ScrollGallery from "../pages/School/Gallery/Scrollgallery";
import Galleryinnerpage from "../pages/School/Gallery/Galleryinnerpage";
import LegacyTimeline from "../pages/School/Legacy Timeline/Legacytimeline";
import LegacyImgInnerPage from "../pages/School/Legacy Timeline/Legacyimginnerpage";
import Visionboard from "../pages/School/Vision Board/Visionboard";
import StudentsAchievement from "../pages/School/Students Achievement/Studentsachievement";
import LegacySchoolScrollPage from "../pages/School/LegacySchoolScrollPage/LegacySchoolScrollPage";
import StartJourneyPage from "../pages/School/StartJourneyPage/StartJourneyPage";
import CustomerGenerationWebPage from "../pages/School/Generation web page/Generationwebpage";
import UserFlipbookPage from "../pages/School/FlipBook/UserFlipbookPage";

const schoolRoutes = (
  <>
    {/* No navbar pages */}
    <Route path="/school/legacyscrollpage" element={<LegacySchoolScrollPage />} />
    

    {/* Protected school routes — role="customer", category="school" */}
    <Route
      element={
        <ProtectedRoute requiredRole="customer">
          <MainLayout />
        </ProtectedRoute>
      }
    >
      
      <Route path="/school/dashboard" element={<UserDashboard />} />
      <Route path="/school/startjourney" element={<StartJourneyPage />} />
      <Route path="/school/legacyorbit" element={<LegacyOrbit />} />
      <Route path="/school/founderstory" element={<CircleSubPointsPage />} />
      <Route path="/school/gallery" element={<ScrollGallery />} />
      <Route path="/school/galleryinner/:sessionId/:chapter" element={<Galleryinnerpage />} />
      <Route path="/school/generation" element={<CustomerGenerationWebPage />} />
      <Route path="/school/legacytimeline" element={<LegacyTimeline />} />
      <Route path="/school/legacyimginnerpage" element={<LegacyImgInnerPage />} />
      <Route path="/school/visionboard" element={<Visionboard />} />
      <Route path="/school/studentsachievement" element={<StudentsAchievement />} />
      <Route path="/school/flipbook" element={<UserFlipbookPage />} />
    </Route>
  </>
);

export default schoolRoutes;