// src/utils/generateRRN.js
import crypto from "crypto";

/**
 * Generate a Request Reference Number (RRN)
 * Format: RRN-YYYYMMDDHHmmss-<12 hex chars>
 * Example: RRN-20250816-221530-a3f9c1b27d4e
 *
 * - Timestamp uses Indian Standard Time (IST, UTC+5:30)
 * - Random bytes ensure global uniqueness without a DB call
 */
export default function generateRRN(prefix = "RRN") {
  const now = new Date();

  // Convert to IST (UTC +5:30)
  const istOffset = 5.5 * 60 * 60 * 1000; // milliseconds
  const istDate = new Date(now.getTime() + istOffset);

  // Build IST timestamp: YYYYMMDDHHmmss
  const YYYY = istDate.getFullYear().toString();
  const MM = String(istDate.getMonth() + 1).padStart(2, "0");
  const DD = String(istDate.getDate()).padStart(2, "0");
  const HH = String(istDate.getHours()).padStart(2, "0");
  const mm = String(istDate.getMinutes()).padStart(2, "0");
  const ss = String(istDate.getSeconds()).padStart(2, "0");
  const stamp = `${YYYY}${MM}${DD}${HH}${mm}${ss}`;

  // 6 random bytes -> 12 hex chars
  const rand = crypto.randomBytes(6).toString("hex");

  return `${stamp}_${rand}`;
}
