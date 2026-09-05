import multer from "multer";
import path from "path";
import fs from "fs";

// ─── EXISTING: image / excel uploader (unchanged) ─────────────────────────
export const createUploader = (destPath, filePrefix = "file") => {
  if (!fs.existsSync(destPath)) {
    fs.mkdirSync(destPath, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, destPath);
    },
    filename: function (req, file, cb) {
      const ext = path.extname(file.originalname);
      const fileName = `${filePrefix}-${Date.now()}${ext}`;
      cb(null, fileName);
    },
  });

  return multer({ storage });
};

// ─── NEW: audio uploader ───────────────────────────────────────────────────
// Accepts: .mp3  .wav  .m4a  .ogg  .flac  .webm  .mp4
// Max size per file: 100MB  (Whisper's actual limit is 25MB — split large files)
// Use with: audioUpload.array("audio_files", 8)

const ALLOWED_AUDIO_EXTENSIONS = new Set([
  ".mp3", ".wav", ".m4a", ".ogg", ".flac", ".webm", ".mp4",
]);

export const createAudioUploader = (destPath) => {
  if (!fs.existsSync(destPath)) {
    fs.mkdirSync(destPath, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, destPath);
    },
    filename: function (req, file, cb) {
      const ext  = path.extname(file.originalname).toLowerCase();
      const base = path.basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .substring(0, 40);
      const fileName = `audio-${base}-${Date.now()}${ext}`;
      cb(null, fileName);
    },
  });

  // Only allow audio file types
  const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_AUDIO_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type: ${ext}. Allowed types: ${[...ALLOWED_AUDIO_EXTENSIONS].join(", ")}`
        ),
        false
      );
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 24 * 1024 * 1024, // 24MB per file
      files:    8,                    // max 8 files per upload
    },
  });
};

// ─── PDF uploader (local-disk fallback for flipbook, no AWS needed) ───────
export const createPdfUploader = (destPath) => {
  if (!fs.existsSync(destPath)) {
    fs.mkdirSync(destPath, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, destPath),
    filename: (req, file, cb) => {
      const name = `approved-book-${Date.now()}.pdf`;
      cb(null, name);
    },
  });

  const fileFilter = (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"), false);
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  });
};
// Single file, up to 24MB — short recordings per question (1–3 min)
export const createUserAudioUploader = (destPath) => {
  if (!fs.existsSync(destPath)) {
    fs.mkdirSync(destPath, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, destPath),
    filename: (req, file, cb) => {
      const ext  = path.extname(file.originalname).toLowerCase();
      const name = `useraudio-${req.user?.id ?? 'unknown'}-q${req.body?.question_id ?? '0'}-${Date.now()}${ext}`;
      cb(null, name);
    },
  });

  const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_AUDIO_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${[...ALLOWED_AUDIO_EXTENSIONS].join(', ')}`), false);
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 24 * 1024 * 1024,  // 24MB — enough for 3 min audio
      files: 1,
    },
  });
};