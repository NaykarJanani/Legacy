import express from "express";
import { authenticate, authorize } from "../middleware/authMiddleware.js";
import {
  getAssignedCustomers,
  getCustomerChapters,
  getQuestionAnswer,
  getCustomerQA,
  editAnswer,
  approveAnswer,
  getCustomerAudio,
  getCustomerSummary,
  getEditorProfile,
  updateEditorProfile,
  getEditorAvatarUploadUrl,
  getMediaLibrary,
  getMediaLibraryUploadUrl,
  saveMediaLibraryImage,
  updateMediaLibraryImage,
  placeBoardImage,
  getBoardPlacements,
  saveBoardQuote,
  getBoardQuotes,
  saveBookPage,
  getBookPages,
  getFlipbookUploadUrl,
  saveFlipbook,
  getFlipbookForEditor,
  getFlipbookNotesForEditor,
  saveFlipbookLocal,
  pdfLocalUploader,
  getFlipbookPublishRequests,
  acknowledgeFlipbookPublishRequest,
  markFlipbookReady,
} from "../controller/editorController.js";
import {
  getStartJourneyUploadUrl,
  getStartJourneyForEditor,
  saveStartJourneyContent,
} from "../controller/StartjourneyController.js";

const router = express.Router();

// All routes below require a valid JWT with role = "editor"

// GET  /api/editor/customers                    → customers assigned to this editor
router.get(
  "/customers",
  authenticate,
  authorize(["editor"]),
  getAssignedCustomers
);

// GET  /api/editor/customer/:user_id/qa         → full Q&A for assigned customer
router.get(
  "/customer/:user_id/qa",
  authenticate,
  authorize(["editor"]),
  getCustomerQA
);

// GET  /api/editor/customer/:user_id/chapters   → chapter/sub-chapter/question tree (no answers)
router.get(
  "/customer/:user_id/chapters",
  authenticate,
  authorize(["editor"]),
  getCustomerChapters
);

// GET  /api/editor/customer/:user_id/question/:question_id/answer
//                                                 → original submitted answer + AI narrative for one question
router.get(
  "/customer/:user_id/question/:question_id/answer",
  authenticate,
  authorize(["editor"]),
  getQuestionAnswer
);

// PUT  /api/editor/answer/:id                   → edit answer text
router.put(
  "/answer/:id",
  authenticate,
  authorize(["editor"]),
  editAnswer
);

// PUT  /api/editor/answer/:id/approve           → approve or revert an answer
router.put(
  "/answer/:id/approve",
  authenticate,
  authorize(["editor"]),
  approveAnswer
);

// GET  /api/editor/customer/:user_id/audio      → audio sessions + transcripts
router.get(
  "/customer/:user_id/audio",
  authenticate,
  authorize(["editor"]),
  getCustomerAudio
);

// GET  /api/editor/customer/:user_id/summary    → project summary + chapter progress
router.get(
  "/customer/:user_id/summary",
  authenticate,
  authorize(["editor"]),
  getCustomerSummary
);

// GET  /api/editor/profile                      → logged-in editor's own profile
router.get(
  "/profile",
  authenticate,
  authorize(["editor"]),
  getEditorProfile
);

// PUT  /api/editor/profile                       → update own name/email/password
router.put(
  "/profile",
  authenticate,
  authorize(["editor"]),
  updateEditorProfile
);

// POST /api/editor/profile/avatar-upload-url      → pre-signed S3 URL for avatar
router.post(
  "/profile/avatar-upload-url",
  authenticate,
  authorize(["editor"]),
  getEditorAvatarUploadUrl
);

// GET  /api/editor/customer/:user_id/start-journey        → current saved image + text for THIS customer (prefill editor form)
router.get(
  "/customer/:user_id/start-journey",
  authenticate,
  authorize(["editor"]),
  getStartJourneyForEditor
);

// POST /api/editor/customer/:user_id/start-journey/upload-url → pre-signed S3 URL for THIS customer's hero image
router.post(
  "/customer/:user_id/start-journey/upload-url",
  authenticate,
  authorize(["editor"]),
  getStartJourneyUploadUrl
);

// PUT  /api/editor/customer/:user_id/start-journey         → save image key + text fields for THIS customer (upsert)
router.put(
  "/customer/:user_id/start-journey",
  authenticate,
  authorize(["editor"]),
  saveStartJourneyContent
);

// GET  /api/editor/customer/:user_id/media-library              → unified customer+editor photo pool
router.get(
  "/customer/:user_id/media-library",
  authenticate,
  authorize(["editor"]),
  getMediaLibrary
);

// POST /api/editor/customer/:user_id/media-library/upload-url   → pre-signed S3 URL
router.post(
  "/customer/:user_id/media-library/upload-url",
  authenticate,
  authorize(["editor"]),
  getMediaLibraryUploadUrl
);

// POST /api/editor/customer/:user_id/media-library               → save editor-uploaded image
router.post(
  "/customer/:user_id/media-library",
  authenticate,
  authorize(["editor"]),
  saveMediaLibraryImage
);

// PUT  /api/editor/customer/:user_id/media-library/:gallery_id   → replace an existing image's file in place
router.put(
  "/customer/:user_id/media-library/:gallery_id",
  authenticate,
  authorize(["editor"]),
  updateMediaLibraryImage
);

// PUT  /api/editor/customer/:user_id/board-placement              → place image at a board slot
router.put(
  "/customer/:user_id/board-placement",
  authenticate,
  authorize(["editor"]),
  placeBoardImage
);

// GET  /api/editor/customer/:user_id/board-placements             → current placements for a board
router.get(
  "/customer/:user_id/board-placements",
  authenticate,
  authorize(["editor"]),
  getBoardPlacements
);

// PUT  /api/editor/customer/:user_id/board-quote                  → save quote text for a board slot
router.put(
  "/customer/:user_id/board-quote",
  authenticate,
  authorize(["editor"]),
  saveBoardQuote
);

// GET  /api/editor/customer/:user_id/board-quotes                 → current quotes for a board
router.get(
  "/customer/:user_id/board-quotes",
  authenticate,
  authorize(["editor"]),
  getBoardQuotes
);

// PUT  /api/editor/customer/:user_id/book-pages                   → autosave one spread's layout (upsert)
router.put(
  "/customer/:user_id/book-pages",
  authenticate,
  authorize(["editor"]),
  saveBookPage
);

// GET  /api/editor/customer/:user_id/book-pages                   → all saved spreads for this book
router.get(
  "/customer/:user_id/book-pages",
  authenticate,
  authorize(["editor"]),
  getBookPages
);

// POST /api/editor/customer/:user_id/flipbook/upload-local     → TEST-ONLY: saves PDF straight to local disk, no AWS needed
router.post(
  "/customer/:user_id/flipbook/upload-local",
  authenticate,
  authorize(["editor"]),
  pdfLocalUploader.single("pdf"),
  saveFlipbookLocal
);

// POST /api/editor/customer/:user_id/flipbook/upload-url          → pre-signed S3 URL for approved PDF
router.post(
  "/customer/:user_id/flipbook/upload-url",
  authenticate,
  authorize(["editor"]),
  getFlipbookUploadUrl
);

// PUT  /api/editor/customer/:user_id/flipbook                     → save/replace the approved PDF (upsert)
router.put(
  "/customer/:user_id/flipbook",
  authenticate,
  authorize(["editor"]),
  saveFlipbook
);

// GET  /api/editor/customer/:user_id/flipbook                     → fetch the approved PDF + viewable URL
router.get(
  "/customer/:user_id/flipbook",
  authenticate,
  authorize(["editor"]),
  getFlipbookForEditor
);

// GET  /api/editor/customer/:user_id/flipbook-notes                → all per-page notes the customer wrote
router.get(
  "/customer/:user_id/flipbook-notes",
  authenticate,
  authorize(["editor"]),
  getFlipbookNotesForEditor
);

// GET  /api/editor/flipbook-publish-requests
router.get(
  "/flipbook-publish-requests",
  authenticate,
  authorize(["editor"]),
  getFlipbookPublishRequests
);

// PATCH /api/editor/flipbook-publish-requests/:id/acknowledge → editor dismisses a publish notification
router.patch(
  "/flipbook-publish-requests/:id/acknowledge",
  authenticate,
  authorize(["editor"]),
  acknowledgeFlipbookPublishRequest
);

// PUT  /api/editor/customer/:user_id/flipbook/ready → mark customer-approved book Ready To Publish
router.put(
  "/customer/:user_id/flipbook/ready",
  authenticate,
  authorize(["editor"]),
  markFlipbookReady
);

export default router;