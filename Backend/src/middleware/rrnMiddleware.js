// src/middleware/rrnMiddleware.js
import generateRRN from "../utils/generateRRN.js";
import logger from "../config/logger.js";

const rrnMiddleware = (req, res, next) => {
  const rrn = generateRRN(); // e.g., RRN-20250816-221530-a3f9c1b27d4e
  req.rrn = rrn;
  //logger.info(`REQ ${rrn} - ${req.method} ${req.originalUrl} - Body: ${JSON.stringify(req.body)}`);

  // res.on("finish", () => {
  //   logger.info(`RES ${rrn} - Status: ${res.statusCode}`);
  // });

  next();
};

export default rrnMiddleware;
