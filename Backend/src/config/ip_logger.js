import fs from "fs";
import path from "path";

const logDir = path.resolve("src/ip_logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

let requestCounts = {}; // { ip: count }

// Helper → format local date/time (YYYY-MM-DD HH:mm:ss)
function getLocalDateTime() {
  const now = new Date();
  return now.toLocaleString("en-IN", { hour12: false }); // example: 2025-09-15 16:48:12
}

// Function to append/update counts every 30 min
const saveIpLogs = () => {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const filePath = path.join(logDir, `ip-counts-${today}.json`);

  // Load existing data if file already exists
  let existingData = {};
  if (fs.existsSync(filePath)) {
    try {
      existingData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch (e) {
      existingData = {};
    }
  }

  // Merge current counts into existing data
  for (const ip in requestCounts) {
    existingData[ip] = (existingData[ip] || 0) + requestCounts[ip];
  }

  // Add/Update timestamp with local server time
  existingData["lastUpdated"] = getLocalDateTime();

  // Write back merged data
  fs.writeFileSync(filePath, JSON.stringify(existingData, null, 2), "utf-8");

  // Reset in-memory counts after flushing
  requestCounts = {};
};

// Middleware: count requests per IP
const ipLogger = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  requestCounts[ip] = (requestCounts[ip] || 0) + 1;
  next();
};

// ✅ Flush logs every 30 minutes
setInterval(() => {
  saveIpLogs();
}, 30 * 60 * 1000);

export default ipLogger;
