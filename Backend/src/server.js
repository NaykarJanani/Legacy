import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import errorHandler from "./middleware/errorHandler.js";
import rrnMiddleware from "./middleware/rrnMiddleware.js";

import adminRoutes from "./routes/adminRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import audioRoutes from "./routes/audioRoutes.js";
import editorRoutes from "./routes/editorRoutes.js";
import storageRoutes from "./routes/storageRoutes.js";
import logMiddleware from "./utils/logMiddleware.js";
import ipLogger from "./config/ip_logger.js";
import securityLogRouter from "./config/securityLog.js";
import { login , registerCustomer } from "./controller/authControllers.js";
import path from "path";                      
import { fileURLToPath } from "url";          

const __filename = fileURLToPath(import.meta.url); 
const __dirname = path.dirname(__filename);    
const app = express();

// Rate limiter configuration for DOS protection
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.isProd == 'true' ? 1000:2000, // limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 409,
    error: "Too many requests from this IP, please try again later.",
    data:{
      message:"Too many requests from this IP, please try again later."
    }
  },
  handler: (req, res, next, options) => {
    // Custom handler that sends a 409 status code
    res.status(409).json({
      status: 409,
      error: "Too many requests from this IP, please try again later.",
      data: {
        message: "Too many requests from this IP, please try again later."
      }
    });
  }
});

// Middlewares
app.use(limiter);       // Apply rate limiter first
app.use(express.json());
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(cors({
  origin: process.env.isProd == 'true' ? process.env.FRONTEND_URL : "http://localhost:5174"
}));
app.use(morgan("dev"));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use(rrnMiddleware);
app.use(logMiddleware);
app.use(ipLogger); // ✅ plug in IP counter


// Routes
app.use("/api/admin", adminRoutes);
app.use("/api/user", userRoutes);
app.use("/api/editor", editorRoutes);
app.use("/api/audio", audioRoutes);
app.use("/api/editor/audio", audioRoutes);
app.use("/api/admin/audio", audioRoutes);
app.use("/api/user/audio", audioRoutes);
app.use("/api/storage", storageRoutes);

app.use("/api/securityError", securityLogRouter);
app.post('/login',login)
app.post('/register', registerCustomer)

app.get("/", (req, res) => {
  res.status(200).json({ message: "Welcome to the API 🚀" });
});

// Error handler
app.use(errorHandler);

export default app;