import { createLogger, format, transports } from "winston";
import "winston-daily-rotate-file";

const { combine, timestamp, printf, errors } = format;

// ✅ Custom log format
const logFormat = printf(({ timestamp, level, message, stack }) => {
  // If error, log both message + stack
  if (level === "error") {
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${
      stack ? `\nStack: ${stack}` : ""
    }`;
  }

  // Normal logs
  return `${timestamp} [${level.toUpperCase()}]: ${message}`;
});

// 📌 Daily rotate file (info & below warnings, not errors)
const dailyRotateTransport = new transports.DailyRotateFile({
  filename: "src/logs/app-%DATE%.log",
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "14d",
  level: "info", // only info/warn/debug, NOT error
});

// 📌 Dedicated server error log (messages + stack)
const serverErrorTransport = new transports.File({
  filename: "src/logs/server_error.log",
  level: "error", // ONLY errors
});

const logger = createLogger({
  level: "info",
  format: combine(
    errors({ stack: true }), // include stack in `err.stack`
    timestamp({
      format: () =>
        new Date().toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour12: false,
        }),
    }),
    logFormat
  ),
  transports: [
    dailyRotateTransport,
    serverErrorTransport,
    new transports.Console({ level: "debug" }), // console shows all
  ],
});

// ✅ catch uncaught exceptions into server_error.log only
logger.exceptions.handle(
  new transports.File({ filename: "src/logs/server_error.log" })
);

// ✅ catch unhandled promise rejections into server_error.log only
process.on("unhandledRejection", (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`, err);
});

export default logger;
