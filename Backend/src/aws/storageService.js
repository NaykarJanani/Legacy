import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  getUploadUrl_aws,
  getUploadUrl_aws_policy,
  getPdfUploadUrl_aws,
  getViewUrl_aws,
  deleteFile_aws,
  getCachedViewUrl as getCachedViewUrl_aws,
} from "./aws3.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Same folder your server.js already serves statically at "/uploads"
const LOCAL_UPLOAD_ROOT = path.join(__dirname, "../../uploads");

// Used to build absolute URLs the frontend can fetch/PUT to when running
// on local storage (S3 mode doesn't need this — S3 URLs are already absolute).
const LOCAL_BASE_URL =
  process.env.LOCAL_STORAGE_BASE_URL ||
  `http://localhost:${process.env.PORT || 5000}`;

/**
 * The one flag everything else in this file depends on.
 *
 * AWS isn't purchased yet, so storage must stay 100% local until it is.
 * USE_AWS_STORAGE is the deliberate on/off switch for that: it defaults to
 * local storage, and only ever considers using S3 when someone explicitly
 * sets USE_AWS_STORAGE=true in .env — at which point it still requires real
 * (non-placeholder) AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY to actually be
 * present before switching over. This way, stray or half-filled-in AWS_*
 * values sitting in .env before the account is set up can never silently
 * flip the app over to a non-working S3 path — someone has to turn
 * USE_AWS_STORAGE on by hand once AWS is actually purchased and configured.
 *
 * Checked fresh on every call (not cached at startup), so updating .env
 * and restarting the server is all that's needed to switch.
 */
function useAWS() {
  if (process.env.USE_AWS_STORAGE !== "true") return false;

  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const isPlaceholder = (v) => !v || v.trim() === "" || v.trim() === "NA";
  return !isPlaceholder(accessKey) && !isPlaceholder(secretKey);
}

function safeFileName(name) {
  return String(name || "unknown").replace(/[^a-zA-Z0-9-_]/g, "-");
}

function buildKey(folder_name, UniqueFileName, ext) {
  const prefix = process.env.isProd === "true" ? "" : "test/";
  return `${prefix}${folder_name}/${safeFileName(UniqueFileName)}${ext}`;
}

// ─────────────────────────────────────────────────────────────
// Upload URL — for images (same contract as getUploadUrl_aws)
// ─────────────────────────────────────────────────────────────
export async function getUploadUrl({ fileName, fileType, folder_name, UniqueFileName }) {
  if (useAWS()) {
    return getUploadUrl_aws({ fileName, fileType, folder_name, UniqueFileName });
  }

  if (!fileName) throw new Error("fileName required");
  if (!fileType) throw new Error("fileType required");
  if (!UniqueFileName) throw new Error("UniqueFileName required");
  if (!fileType.startsWith("image/")) throw new Error("Only images allowed");

  const ext = path.extname(fileName) || ".bin";
  const key = buildKey(folder_name, UniqueFileName, ext);

  // Points back at OUR OWN backend instead of S3. The frontend already does
  // fetch(uploadUrl, { method: "PUT", body: file }) for the S3 case — this
  // URL just gets handled by the /api/storage/local-upload route instead.
  const uploadUrl = `${LOCAL_BASE_URL}/api/storage/local-upload?key=${encodeURIComponent(key)}`;
  return { uploadUrl, key };
}

// ─────────────────────────────────────────────────────────────
// Upload URL — policy/scheme images (same contract as getUploadUrl_aws_policy)
// ─────────────────────────────────────────────────────────────
export async function getUploadUrlPolicy({ fileName, fileType }) {
  if (useAWS()) {
    return getUploadUrl_aws_policy({ fileName, fileType });
  }

  if (!fileName) throw new Error("fileName required");
  if (!fileType) throw new Error("fileType required");
  if (!fileType.startsWith("image/")) throw new Error("Only images allowed");

  const prefix = process.env.isProd === "true" ? "" : "test/";
  const key = `${prefix}SchemePolicy/${Date.now()}.png`;

  const uploadUrl = `${LOCAL_BASE_URL}/api/storage/local-upload?key=${encodeURIComponent(key)}`;
  return { uploadUrl, key };
}

// ─────────────────────────────────────────────────────────────
// Upload URL — PDFs (same contract as getPdfUploadUrl_aws)
// ─────────────────────────────────────────────────────────────
export async function getPdfUploadUrl({ fileName, fileType, folder_name, UniqueFileName }) {
  if (useAWS()) {
    return getPdfUploadUrl_aws({ fileName, fileType, folder_name, UniqueFileName });
  }

  if (!fileName) throw new Error("fileName required");
  if (!fileType) throw new Error("fileType required");
  if (!UniqueFileName) throw new Error("UniqueFileName required");
  if (fileType !== "application/pdf") throw new Error("Only PDF files allowed");

  const key = buildKey(folder_name, UniqueFileName, ".pdf");
  const uploadUrl = `${LOCAL_BASE_URL}/api/storage/local-upload?key=${encodeURIComponent(key)}`;
  return { uploadUrl, key };
}

// ─────────────────────────────────────────────────────────────
// View URL (same contract as getViewUrl_aws)
// ─────────────────────────────────────────────────────────────
export async function getViewUrl(key) {
  if (!key) throw new Error("key required");
  if (useAWS()) {
    return getViewUrl_aws(key);
  }
  // Local files are already served statically by server.js at "/uploads",
  // so no signing is needed — just point straight at the static file.
  return `${LOCAL_BASE_URL}/uploads/${key}`;
}

// ─────────────────────────────────────────────────────────────
// Cached view URL (same contract as getCachedViewUrl)
// ─────────────────────────────────────────────────────────────
export async function getCachedViewUrl(key) {
  if (!key) return null;
  if (useAWS()) {
    return getCachedViewUrl_aws(key);
  }
  // No caching needed locally — it's just a static file path, not a
  // time-limited signed URL like S3's.
  return `${LOCAL_BASE_URL}/uploads/${key}`;
}

// ─────────────────────────────────────────────────────────────
// Delete a file — used to clean up superseded images so re-cropping/
// re-zooming a photo doesn't leave the old version behind forever.
// ─────────────────────────────────────────────────────────────
export async function deleteFile(key) {
  if (!key) return;
  if (useAWS()) {
    return deleteFile_aws(key);
  }
  const filePath = path.join(LOCAL_UPLOAD_ROOT, key);
  fs.rm(filePath, { force: true }, (err) => {
    if (err) console.error(`Failed to delete local file ${key}:`, err);
  });
}

// ─────────────────────────────────────────────────────────────
// Used only by the local-upload route below — writes the incoming
// file bytes to disk at the same key the frontend was given.
// ─────────────────────────────────────────────────────────────
export function saveLocalFile(key, buffer) {
  const filePath = path.join(LOCAL_UPLOAD_ROOT, key);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
}

export function isUsingAWS() {
  return useAWS();
}