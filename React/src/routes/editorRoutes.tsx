// src/routes/editorRoutes.tsx
import { Route } from "react-router-dom";
import ProtectedRoute from "../components/ProtectedRoute";

// Editor Layout
import EditorLayout from "../Layouts/EditorLayout";

// Editor Pages
import Editordashboard from "../pages/Editor/Dashboard/Editordashboard";
import EditorSetting from "../pages/Editor/Settings/Editorsetting";
import Editorprojects from "../pages/Editor/Projects/Editorprojects";
import Editorcardinnerpage from "../pages/Editor/Projects/Editorcardinnerpage";
import EditorChapterpage from "../pages/Editor/Projects/EditorChapterpage";
import EditorAIgeneratetext from "../pages/Editor/Projects/EditorAIgeneratetext";
import BookLayoutPage from "../pages/Editor/Projects/BookLayoutpage";
import Viewapprovedpage from "../pages/Editor/Projects/Viewapprovedpage";
import Visionboard from "../pages/Editor/Projects/Visionboard";
import Editormedialibrary from "../pages/Editor/Projects/Editormedialibrary";
import StudentsAchievement from "../pages/Editor/Projects/Studentsachievement";
import GenerationWebPageDemo from "../pages/Editor/Projects/GenerationWebPage";
import Legacytimeline from "../pages/Editor/Projects/Legacytimeline";
import Legacyimginnerpage from "../pages/Editor/Projects/Legacyimginnerpage";
import StartJourneyPage from "../pages/Editor/Projects/StartJourneyPage";

const editorRoutes = (
  <>
    {/* Protected editor routes — role="editor" */}
    <Route
      element={
        <ProtectedRoute requiredRole="editor">
          <EditorLayout />
        </ProtectedRoute>
      }
    >
      <Route path="/editor/dashboard" element={<Editordashboard />} />
      <Route path="/editor/Editorsetting" element={<EditorSetting />} />
      <Route path="/editor/Editorprojects" element={<Editorprojects />} />
      <Route path="/editor/Editorcardinnerpage" element={<Editorcardinnerpage />} />
      <Route path="/editor/EditorChapterpage" element={<EditorChapterpage />} />
      <Route path="/editor/EditorAIgeneratetext" element={<EditorAIgeneratetext />} />
      <Route path="/editor/BookLayoutPage" element={<BookLayoutPage />} />
      <Route path="/editor/Viewapprovedpage" element={<Viewapprovedpage />} />
      <Route path="/editor/visionboard" element={<Visionboard />} />
      <Route path="/editor/achievement" element={<StudentsAchievement />} />
      <Route path="/editor/Editormedialibrary" element={<Editormedialibrary />} />
      <Route path="/editor/generationweb" element={<GenerationWebPageDemo />} />
      <Route path="/editor/legacytimeline" element={<Legacytimeline />} />
      <Route path="/editor/Legacyimginnerpage" element={<Legacyimginnerpage />} />
      <Route path="/editor/startjourney" element={<StartJourneyPage />} />
    </Route>
  </>
);

export default editorRoutes;
