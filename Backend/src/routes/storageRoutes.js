import express from "express";
import { saveLocalFile } from "../aws/storageService.js";

const router = express.Router();

/**
 * Stands in for S3's presigned PUT when no AWS credentials are configured.
 * The frontend calls this exactly the same way it calls S3:
 *   fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file })
 * getUploadUrl() in storageService.js hands out a URL that points here
 * (with ?key=...) instead of an S3 URL, so no frontend code changes are needed.
 */
router.put(
  "/local-upload",
  express.raw({ type: "*/*", limit: "2gb" }),
  (req, res) => {
    try {
      const { key } = req.query;
      if (!key) {
        return res.status(400).json({ success: false, message: "key is required" });
      }
      if (!req.body || !req.body.length) {
        return res.status(400).json({ success: false, message: "empty file body" });
      }

      saveLocalFile(key, req.body);
      return res.status(200).json({ success: true, message: "File saved locally" });
    } catch (err) {
      console.error("Local upload failed:", err);
      return res.status(500).json({ success: false, message: "Local upload failed" });
    }
  }
);

export default router;
