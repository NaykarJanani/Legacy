// src/middleware/logMiddleware.js
import logger from "../config/logger.js";
import http from "http";

const logMiddleware = (req, res, next) => {
  const start = Date.now();

  // log request
  logger.info(
    `REQ RRN - ${req.rrn} - ${req.method} ${req.originalUrl} - Body: ${process.env.isProd == 'true'?"PRODUCTION":JSON.stringify(req.body)}`
  );

  // --- capture response body ---
  let oldJson = res.json;
  let responseBody;

  res.json = function (body) {
    responseBody = body; // store response body
    return oldJson.call(this, body);
  };

  // hook into response
  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const statusMessage = http.STATUS_CODES[status] || "Unknown Status";

    let logMsg = `RES RRN - ${req.rrn} - Status: ${status} - ${duration}ms - ${statusMessage} - Body ${JSON.stringify(req.body)}`;

    // If response has a "message" field, include it
    if (responseBody?.message) {
      logMsg += ` - Message: ${responseBody.message}`;
    }

    if (status >= 500) {
      logger.error(logMsg); // server_error.log
    } else {
      logger.info(logMsg); // app log
    }
  });

  next();
};

export default logMiddleware;
