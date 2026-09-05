import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";

const router = express.Router();

// Fix for __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File to store logs
const logFilePath = path.join(__dirname, "security-logs.jsonl");

// Ensure file exists
if (!fs.existsSync(logFilePath)) {
  fs.writeFileSync(logFilePath, "", "utf8");
}

router.post("/log-security", (req, res) => {
  try {
    let decodedToken = null;

    // 🔑 Extract & decode JWT if available
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Expect: Bearer <token>
    if (token) {
      try {
        decodedToken = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        console.warn("⚠️ Invalid token in log-security request");
      }
    }

    const logData = {
      ...req.body,
      ip: req.headers["x-forwarded-for"] || req.socket.remoteAddress,
      serverTime: new Date().toISOString(),
      tokenPayload: decodedToken || undefined, // only store payload if valid
    };

    // Convert to JSON line
    const line = JSON.stringify(logData) + "\n";

    // Append to file
    fs.appendFile(logFilePath, line, (err) => {
      if (err) {
        console.error("❌ Failed to write security log:", err);
        return res.status(500).json({ success: false, error: "Failed to store log" });
      }

    //   console.log("✅ Security log saved:", logData);
      return res.json({ success: true });
    });
  } catch (err) {
    console.error("❌ Error in /log-security:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

export default router;
