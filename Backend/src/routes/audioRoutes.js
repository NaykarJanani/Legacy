import express from "express";
import { authenticate, authorize } from "../middleware/authMiddleware.js";
import { createAudioUploader } from "../middleware/uploadMiddleware.js";
import {
  uploadAudioFiles,
  processAudioSession,
  getAudioStatus,
  getMappedAnswers,
  getChapterDrafts,
  updateMappedAnswer,
  updateChapterDraft,
  publishApprovedAnswers,
  approveAllDrafts,
} from "../controller/audioControllers.js";

const router = express.Router();

const audioUpload = createAudioUploader("uploads/audio");

const withAudioUpload = (req, res, next) => {
  audioUpload.array("audio_files", 8)(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.code === "LIMIT_FILE_SIZE"
          ? "Each audio file must be under 24MB. Please compress or split the recording."
          : err.message,
      });
    }
    next();
  });
};

// ─────────────────────────────────────────────────────────────────────
// CUSTOMER ROUTES
// ─────────────────────────────────────────────────────────────────────
router.post("/upload",  authenticate, authorize(["customer"]), withAudioUpload, uploadAudioFiles);
router.get("/status",   authenticate, authorize(["customer"]), getAudioStatus);

// ─────────────────────────────────────────────────────────────────────
// ADMIN ROUTES
// ─────────────────────────────────────────────────────────────────────
router.post("/upload/:user_id",              authenticate, authorize(["admin"]), withAudioUpload, uploadAudioFiles);
router.get("/status/:user_id",               authenticate, authorize(["admin"]), getAudioStatus);
router.post("/process/:audio_session_id",    authenticate, authorize(["admin"]), processAudioSession);

// ─────────────────────────────────────────────────────────────────────
// SHARED ROUTES — admin + editor
// ─────────────────────────────────────────────────────────────────────

// Q/A mode
router.get("/mapped/:audio_session_id",      authenticate, authorize(["admin", "editor"]), getMappedAnswers);
router.put("/answer/:mapped_answer_id",      authenticate, authorize(["admin", "editor"]), updateMappedAnswer);
router.post("/publish/:audio_session_id",    authenticate, authorize(["admin", "editor"]), publishApprovedAnswers);

// Story mode
router.get("/drafts/:audio_session_id",      authenticate, authorize(["admin", "editor"]), getChapterDrafts);
router.put("/draft/:draft_id",               authenticate, authorize(["admin", "editor"]), updateChapterDraft);
router.post("/approve/:audio_session_id",    authenticate, authorize(["admin", "editor"]), approveAllDrafts);

export default router;