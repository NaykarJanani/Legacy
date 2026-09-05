import express from "express";
import { authenticate, authorize } from "../middleware/authMiddleware.js";
import { createUploader } from "../middleware/uploadMiddleware.js";
import {
  // ── existing ──────────────────────────────────────────────────────────────
  addSession,
  adminLogin,
  createEditor,
  customerList,
  editorList,
  getSession,
  getUserGallery,
  getStudents,
  registerAdmin,
  registerCustomer,
  updateSession,
  updateSessionSeq,
  updateSessionStatus,
  getProfile,
  updateProfile,
  getDailyActivity,
  getDashboardStats,
  getCustomerQA,
  updateEditorStatus,
  // ── new ───────────────────────────────────────────────────────────────────
  getCustomerProfile,
  updateCustomerStatus,
  assignEditorToCustomer,
  getCustomerEditor,
  unassignEditorFromCustomer,
  getEditorCustomers,
  getSessionById,
  getFlipbookPublishRequestsAdmin,
  markFlipbookPublishRequestPublished,
  getAllFlipbooksAdmin,
} from "../controller/adminControllers.js";

const router = express.Router();
const excelUpload = createUploader("uploads/excel", "snc-kit-upload");


// ── PUBLIC ───────────────────────────────────────────────────────────────────
router.post("/register", registerAdmin);
router.post("/login",    adminLogin);


// ── CUSTOMER ─────────────────────────────────────────────────────────────────
router.post("/registerCustomer",          authenticate, authorize(["admin"]), registerCustomer);
router.get( "/crmList",                   authenticate, authorize(["admin"]), customerList);

// NEW — full profile for one customer
router.get( "/customer/:user_id/profile", authenticate, authorize(["admin"]), getCustomerProfile);

// NEW — enable / disable a customer account
router.put( "/customer/:user_id/status",  authenticate, authorize(["admin"]), updateCustomerStatus);

// existing — Q&A answers for a customer
router.get( "/customer/qa/:user_id",      authenticate, authorize(["admin"]), getCustomerQA);


// ── EDITOR ───────────────────────────────────────────────────────────────────
router.get(    "/editorList",             authenticate, authorize(["admin"]), editorList);
router.post(   "/editor/create",          authenticate, authorize(["admin"]), createEditor);
router.patch(  "/editor/:id/status",      authenticate, authorize(["admin"]), updateEditorStatus);

// NEW — assign an editor to a customer biography
router.post(   "/editor/assign",          authenticate, authorize(["admin"]), assignEditorToCustomer);

// NEW — check which editor (if any) a customer is currently assigned to
router.get(    "/customer/:user_id/editor", authenticate, authorize(["admin"]), getCustomerEditor);

// NEW — remove an active editor assignment
router.delete( "/editor/assign",          authenticate, authorize(["admin"]), unassignEditorFromCustomer);

// NEW — all customers currently assigned to one editor (with progress stats)
router.get(    "/editor/:editor_id/customers", authenticate, authorize(["admin"]), getEditorCustomers);

// NEW — every pending/acknowledged "publish my book" request across ALL editors (oversight backstop)
router.get(    "/flipbook-publish-requests",   authenticate, authorize(["admin"]), getFlipbookPublishRequestsAdmin);

// NEW — admin confirms a customer's book has actually been published (terminal state)
router.patch(  "/flipbook-publish-requests/:id/publish", authenticate, authorize(["admin"]), markFlipbookPublishRequestPublished);

// NEW — every editor-approved/published flipbook, with a ready-to-view PDF url
router.get(    "/flipbooks",                   authenticate, authorize(["admin"]), getAllFlipbooksAdmin);


// ── SESSION ──────────────────────────────────────────────────────────────────
router.post("/addSession",        authenticate, authorize(["admin"]), addSession);
router.get( "/getSessions",       authenticate, authorize(["admin"]), getSession);

// NEW — single session with full chapter/question tree
router.get( "/session/:session_id", authenticate, authorize(["admin"]), getSessionById);

router.post("/updateSession",     authenticate, authorize(["admin"]), updateSession);
router.post("/updateSessionSeq",  authenticate, authorize(["admin"]), updateSessionSeq);
router.post("/updateSessionStatus", authenticate, authorize(["admin"]), updateSessionStatus);


// ── GALLERY ──────────────────────────────────────────────────────────────────
router.get("/user/gallery/:user_id", authenticate, authorize(["admin"]), getUserGallery);


// ── PROFILE ──────────────────────────────────────────────────────────────────
router.get("/profile",        authenticate, authorize(["admin", "super_admin", "category_admin"]), getProfile);
router.put("/update-profile", authenticate, authorize(["admin", "super_admin", "category_admin"]), updateProfile);


// ── DASHBOARD / ACTIVITY ─────────────────────────────────────────────────────
router.get("/daily-activity",  authenticate, authorize(["admin"]), getDailyActivity);
router.get("/dashboard-stats", authenticate, authorize(["admin"]), getDashboardStats);


export default router;