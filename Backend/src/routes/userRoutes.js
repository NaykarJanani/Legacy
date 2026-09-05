import express from "express";
import { authenticate, authorize } from "../middleware/authMiddleware.js";
import { createUserAudioUploader } from "../middleware/uploadMiddleware.js";
import {
  getUserProfile,
  getUserSessions,
  getUserSessionById,
  submitAnswer,
  getUserAnswers,
  getGalleryUploadUrl,
  saveGalleryImage,
  getGalleryChapters,
  getChapterImages,
  submitAudioAnswer,
  getUserBoardPlacements,
  getUserBoardQuotes,
  getUserFlipbook,
  getUserFlipbookNotes,
  saveUserFlipbookNote,
  requestFlipbookPublish,
  markFlipbookDownloaded,
} from "../controller/userControllers.js";
import { getStartJourneyForUser } from "../controller/StartjourneyController.js";

const router = express.Router();

// Audio uploader for per-question answers (single file, 24MB max)
const userAudioUpload = createUserAudioUploader("uploads/audio/user-answers");

const withUserAudioUpload = (req, res, next) => {
  userAudioUpload.single("audio_file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.code === "LIMIT_FILE_SIZE"
          ? "Audio file must be under 24MB."
          : err.message,
      });
    }
    next();
  });
};
// All routes below require a valid JWT with role = "customer"

// GET  /api/user/profile           → logged-in user's own profile
router.get("/profile", authenticate, authorize(["customer"]), getUserProfile);

// GET  /api/user/board-placements  → own board placements, set by the editor
router.get("/board-placements", authenticate, authorize(["customer"]), getUserBoardPlacements);

// GET  /api/user/board-quotes      → own board quote text, set by the editor
router.get("/board-quotes", authenticate, authorize(["customer"]), getUserBoardQuotes);

// GET  /api/user/sessions          → sessions + sub_sessions + questions for user's category
router.get("/sessions", authenticate, authorize(["customer"]), getUserSessions);
router.get("/session/:session_id", authenticate, authorize(["customer"]), getUserSessionById);

// POST /api/user/answer            → submit or update an answer to a question
router.post("/answer", authenticate, authorize(["customer"]), submitAnswer);

// GET  /api/user/answers           → all saved answers for the logged-in user
router.get("/answers", authenticate, authorize(["customer"]), getUserAnswers);

// POST /api/user/gallery/upload-url → get S3 pre-signed URL for image upload
router.post("/gallery/upload-url", authenticate, authorize(["customer"]), getGalleryUploadUrl);
// POST /api/user/gallery/save       → save the row linking an uploaded image to a question/chapter
router.post("/gallery/save", authenticate, authorize(["customer"]), saveGalleryImage);
// GET  /api/user/gallery/chapters   → all chapters + a cover image for each (for ScrollGallery)
router.get("/gallery/chapters", authenticate, authorize(["customer"]), getGalleryChapters);
// GET  /api/user/gallery/chapter-images?session_id=&chapter= → all images in one chapter (for Galleryinnerpage)
router.get("/gallery/chapter-images", authenticate, authorize(["customer"]), getChapterImages);
// POST /api/user/audio-answer — record audio for a question, transcribe with Sarvam
router.post("/audio-answer",authenticate,authorize(["customer"]),withUserAudioUpload,submitAudioAnswer);

// GET  /api/user/start-journey      → current hero image + text set by the editor
router.get("/start-journey", authenticate, authorize(["customer"]), getStartJourneyForUser);

// GET  /api/user/flipbook           → editor-approved PDF + viewable URL for this customer
router.get("/flipbook", authenticate, authorize(["customer"]), getUserFlipbook);
// GET  /api/user/flipbook-notes     → this customer's own saved per-page notes
router.get("/flipbook-notes", authenticate, authorize(["customer"]), getUserFlipbookNotes);
// POST /api/user/flipbook-notes     → save/update a note for one page
router.post("/flipbook-notes", authenticate, authorize(["customer"]), saveUserFlipbookNote);

// POST /api/user/flipbook/request-publish → notify assigned editor(s) that the customer wants to publish
router.post("/flipbook/request-publish", authenticate, authorize(["customer"]), requestFlipbookPublish);
// POST /api/user/flipbook/mark-downloaded → downloading the PDF also counts as customer approval
router.post("/flipbook/mark-downloaded", authenticate, authorize(["customer"]), markFlipbookDownloaded);

export default router;