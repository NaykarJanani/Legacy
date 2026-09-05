import apiResponse from "../utils/apiResponse.js";
import pool from "../config/db/db_config.js";
import { AIReqResModel } from "../models/AIReqResModel.js";
import { getUploadUrl, getCachedViewUrl, getViewUrl } from "../aws/storageService.js";
import { sendMail } from "../aws/aws3.js";
import { sarvamTranscribeFile } from "../sarvam/sarvamSTT.js";
import { userActivityModel } from "../models/userActivityModel.js";
import fs from "fs";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/user/profile
// Returns the logged-in user's own profile row from users table
// ─────────────────────────────────────────────────────────────────────────────
export const getUserProfile = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
         user_id,
         name,
         mobile,
         email,
         role,
         category,
         industry,
         "entityname",
         website,
         year,
         pincode,
         address,
         state,
         district,
         status,
         created_at
       FROM users
       WHERE user_id = $1`,
      [req.user.id]
    );

    if (!result.rows[0]) {
      return res
        .status(404)
        .json(apiResponse(false, "User not found", {}, req.rrn));
    }

    return res.json(apiResponse(true, "Profile fetched", result.rows[0], req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/user/sessions
// Returns all active sessions + sub_sessions + questions for the user's category
// The user's category comes from their JWT payload (set at login)
// ─────────────────────────────────────────────────────────────────────────────
export const getUserSessions = async (req, res, next) => {
  try {
    const category = req.user.category;

    if (!category) {
      return res
        .status(400)
        .json(apiResponse(false, "User category not found in token", {}, req.rrn));
    }

    // Fetch sessions for this category
    const sessionRes = await pool.query(
      `SELECT * FROM session
       WHERE category = $1 AND status = TRUE
       ORDER BY seq ASC, session_id ASC`,
      [category]
    );

    const sessions = sessionRes.rows;
    if (!sessions.length) {
      return res.json(apiResponse(true, "Sessions fetched", [], req.rrn));
    }

    const sessionIds = sessions.map((s) => s.session_id);

    // Fetch all sub_sessions for those sessions
    const subSessionRes = await pool.query(
      `SELECT * FROM sub_session
       WHERE session_id = ANY($1) AND status = TRUE
       ORDER BY session_id, seq, sub_session_id`,
      [sessionIds]
    );
    const subSessions = subSessionRes.rows;

    const subSessionIds = subSessions.map((ss) => ss.sub_session_id);
    let questions = [];

    if (subSessionIds.length) {
      const questionRes = await pool.query(
        `SELECT * FROM question
         WHERE sub_session_id = ANY($1) AND status = TRUE
         ORDER BY sub_session_id, question_id`,
        [subSessionIds]
      );
      questions = questionRes.rows;
    }

    // Group questions by sub_session_id
    const questionsBySubSession = {};
    for (const q of questions) {
      if (!questionsBySubSession[q.sub_session_id]) {
        questionsBySubSession[q.sub_session_id] = [];
      }
      questionsBySubSession[q.sub_session_id].push(q);
    }

    // Group sub_sessions by session_id
    const subSessionsBySession = {};
    for (const ss of subSessions) {
      if (!subSessionsBySession[ss.session_id]) {
        subSessionsBySession[ss.session_id] = [];
      }
      subSessionsBySession[ss.session_id].push({
        ...ss,
        questions: questionsBySubSession[ss.sub_session_id] || [],
      });
    }

    // Build final response
    const data = sessions.map((s) => ({
      ...s,
      sub_sessions: subSessionsBySession[s.session_id] || [],
    }));

    return res.json(apiResponse(true, "Sessions fetched", data, req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/user/answer
// Body: { question_id, session_id, sub_session_id, answer, serviceId, title, title_desc }
// Saves answer + triggers AI, stores ai_req_res_id back on the answer row
// ─────────────────────────────────────────────────────────────────────────────
export const submitAnswer = async (req, res, next) => {
  try {
    const {
      question_id,
      session_id,
      sub_session_id,
      answer,
      serviceId,
      title = "",
      title_desc = "",
      time_spent = 0,
      attempts = 1,
      completed = true,
    } = req.body;

    const user_id = req.user.id;

    if (!question_id || !session_id || !sub_session_id || !answer) {
      return res
        .status(400)
        .json(
          apiResponse(
            false,
            "question_id, session_id, sub_session_id and answer are required",
            {},
            req.rrn
          )
        );
    }

    // Check if answer already exists for this user + question
    const existing = await pool.query(
      `SELECT customer_answer_id FROM customer_answer
       WHERE user_id = $1 AND question_id = $2`,
      [user_id, question_id]
    );

    // Call AI and get ai_req_res_id
    let ai_req_res_id = null;
    let ai_json = null;
    try {
      const aiResult = await AIReqResModel.sendOpinion(
  true,               // individual_student — always true for a single user answer
  answer,
  serviceId,
  title,
  title_desc,
  req.user.category   // pass the real category from JWT
);
      // sendOpinion() returns { ai_req_res: <number>, ai_json: {...} } —
      // ai_req_res is already the row id, NOT an object, so no `.id` here.
      ai_req_res_id = aiResult.ai_req_res ?? null;
      ai_json       = aiResult.ai_json ?? null;
    } catch (aiErr) {
      // AI failure should not block saving the answer
      console.error("AI processing error:", aiErr.message);
    }

    if (existing.rows.length > 0) {
      // UPDATE existing answer
      await pool.query(
        `UPDATE customer_answer
         SET answer = $1,
             ai_req_res_id = $2,
             updated_at = NOW()
         WHERE user_id = $3 AND question_id = $4`,
        [answer, ai_req_res_id, user_id, question_id]
      );
    } else {
      // INSERT new answer
      await pool.query(
        `INSERT INTO customer_answer
           (user_id, question_id, session_id, sub_session_id, answer, ai_req_res_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [user_id, question_id, session_id, sub_session_id, answer, ai_req_res_id]
      );
    }

    // Log this as user activity so the admin "Daily Active User" report
    // has data to show. Failure here should never block the answer response.
    try {
      await userActivityModel.saveActivity(
        user_id,
        question_id,
        session_id,
        time_spent,
        attempts,
        completed
      );
    } catch (activityErr) {
      console.error("Failed to log user activity:", activityErr.message);
    }

    // Send the generated story narrative back so the frontend AI panel
    // can display it instead of a placeholder sentence.
    return res.json(apiResponse(true, "Answer saved", { ai_json }, req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/user/answers
// Returns all previously saved answers for the logged-in user
// ─────────────────────────────────────────────────────────────────────────────
export const getUserAnswers = async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT
         ca.customer_answer_id,
         ca.question_id,
         ca.session_id,
         ca.sub_session_id,
         ca.answer,
         ca.ai_req_res_id,
         ca.created_at,
         ca.updated_at,
         q.question,
         ar.json_data AS ai_json
       FROM customer_answer ca
       LEFT JOIN question q ON q.question_id = ca.question_id
       LEFT JOIN ai_req_res ar ON ar.id = ca.ai_req_res_id
       WHERE ca.user_id = $1
       ORDER BY ca.session_id, ca.sub_session_id, ca.question_id`,
      [req.user.id]
    );

    return res.json(apiResponse(true, "Answers fetched", result.rows, req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/user/gallery/upload-url
// Body: { fileName, fileType, UniqueFileName }
// Returns a pre-signed S3 URL for direct image upload from the browser
// ─────────────────────────────────────────────────────────────────────────────
export const getGalleryUploadUrl = async (req, res, next) => {
  try {
    const { fileName, fileType, UniqueFileName } = req.body;

    if (!fileName || !fileType || !UniqueFileName) {
      return res
        .status(400)
        .json(
          apiResponse(
            false,
            "fileName, fileType and UniqueFileName are required",
            {},
            req.rrn
          )
        );
    }

    const folder_name = `gallery/${req.user.id}`;

    const { uploadUrl, key } = await getUploadUrl({
      fileName,
      fileType,
      folder_name,
      UniqueFileName,
    });

    return res.json(
      apiResponse(true, "Upload URL generated", { uploadUrl, key }, req.rrn)
    );
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/user/gallery/save
// Body: { key, session_id, sub_session_id, question_id }
// "key" is the S3 object key returned by /gallery/upload-url — call this AFTER
// the file has been successfully PUT to S3. Saves the row that links the
// uploaded image to the user + question + chapter. We store the S3 key (not a
// public URL, since the bucket is private) and convert it to a viewable signed
// URL on read using getCachedViewUrl.
// ─────────────────────────────────────────────────────────────────────────────
export const saveGalleryImage = async (req, res, next) => {
  try {
    const { key, session_id, sub_session_id, question_id } = req.body;
    const user_id = req.user.id;

    if (!key) {
      return res
        .status(400)
        .json(apiResponse(false, "key is required", {}, req.rrn));
    }

    const result = await pool.query(
      `INSERT INTO user_gallery (user_id, file_url, session_id, sub_session_id, question_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, file_url, session_id, sub_session_id, question_id, created_at`,
      [user_id, key, session_id ?? null, sub_session_id ?? null, question_id ?? null]
    );

    const row = result.rows[0];
    const view_url = await getCachedViewUrl(row.file_url);

    return res.json(apiResponse(true, "Image saved", { ...row, view_url }, req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/user/gallery/chapters
// Returns every chapter the user has questions under, each with a cover image
// (the most recently uploaded image in that chapter, or null if none yet).
// Chapter = the part of sub_session.title before " → " (same parsing used
// elsewhere in this codebase, e.g. getUserSessionById).
// ─────────────────────────────────────────────────────────────────────────────
export const getGalleryChapters = async (req, res, next) => {
  try {
    const user_id = req.user.id;

    // All sub_sessions for the user's category, so we know every chapter that exists
    const subSessionRes = await pool.query(
      `SELECT ss.sub_session_id, ss.session_id, ss.title, ss.seq
       FROM sub_session ss
       INNER JOIN session s ON s.session_id = ss.session_id
       WHERE s.category = $1 AND ss.status = TRUE
       ORDER BY ss.session_id, ss.seq`,
      [req.user.category]
    );
    const subSessions = subSessionRes.rows;
    if (!subSessions.length) {
      return res.json(apiResponse(true, "Chapters fetched", [], req.rrn));
    }

    // This user's uploaded images, most recent first
    const imageRes = await pool.query(
      `SELECT sub_session_id, file_url, created_at
       FROM user_gallery
       WHERE user_id = $1 AND sub_session_id IS NOT NULL
       ORDER BY created_at DESC`,
      [user_id]
    );

    // First (most recent) image per sub_session_id
    const coverBySubSession = {};
    for (const img of imageRes.rows) {
      if (!coverBySubSession[img.sub_session_id]) {
        coverBySubSession[img.sub_session_id] = img.file_url;
      }
    }

    // Group sub_sessions by chapter title (text before " → ")
    const chaptersMap = new Map();
    for (const ss of subSessions) {
      const [chapterTitle = ss.title] = ss.title.split(" → ");
      if (!chaptersMap.has(chapterTitle)) {
        chaptersMap.set(chapterTitle, {
          chapterTitle,
          session_id: ss.session_id,
          sub_session_ids: [],
          cover_image: null,
        });
      }
      const entry = chaptersMap.get(chapterTitle);
      entry.sub_session_ids.push(ss.sub_session_id);
      if (!entry.cover_image && coverBySubSession[ss.sub_session_id]) {
        entry.cover_image = coverBySubSession[ss.sub_session_id];
      }
    }

    // Convert each chapter's cover image key into a viewable signed URL
    const chapters = await Promise.all(
      Array.from(chaptersMap.values()).map(async (ch) => ({
        ...ch,
        cover_image: ch.cover_image ? await getCachedViewUrl(ch.cover_image) : null,
      }))
    );

    return res.json(apiResponse(true, "Chapters fetched", chapters, req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/user/gallery/chapter-images?session_id=&chapter=
// Returns every image the logged-in user uploaded under the given chapter.
// "chapter" is the chapter title text (the part before " → " in sub_session.title).
// ─────────────────────────────────────────────────────────────────────────────
export const getChapterImages = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const { session_id, chapter } = req.query;

    if (!session_id || !chapter) {
      return res
        .status(400)
        .json(apiResponse(false, "session_id and chapter are required", {}, req.rrn));
    }

    // Find all sub_session_ids that belong to this chapter
    const subSessionRes = await pool.query(
      `SELECT sub_session_id, title FROM sub_session
       WHERE session_id = $1 AND status = TRUE`,
      [session_id]
    );
    const subSessionIds = subSessionRes.rows
      .filter((ss) => ss.title.split(" → ")[0] === chapter)
      .map((ss) => ss.sub_session_id);

    if (!subSessionIds.length) {
      return res.json(apiResponse(true, "Images fetched", [], req.rrn));
    }

    const imageRes = await pool.query(
      `SELECT id, file_url, sub_session_id, question_id, created_at
       FROM user_gallery
       WHERE user_id = $1 AND sub_session_id = ANY($2)
       ORDER BY created_at DESC`,
      [user_id, subSessionIds]
    );

    const images = await Promise.all(
      imageRes.rows.map(async (img) => ({
        ...img,
        view_url: await getCachedViewUrl(img.file_url),
      }))
    );

    return res.json(apiResponse(true, "Images fetched", images, req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/user/audio-answer
// Body (multipart/form-data):
//   audio_file   — the recorded audio file (field name: "audio_file")
//   question_id  — the question being answered
//   session_id
//   sub_session_id
//   serviceId    — biography chapter ID
//   title        — question text (for AI context)
//   title_desc   — sub-session label (for AI context)
//
// Flow: upload audio → Sarvam STT → use transcript as answer → same AI pipeline
// ─────────────────────────────────────────────────────────────────────────────
export const submitAudioAnswer = async (req, res, next) => {
  const uploadedFilePath = req.file?.path ?? null;

  try {
    const {
      question_id,
      session_id,
      sub_session_id,
      serviceId,
      title     = "",
      title_desc = "",
      time_spent = 0,
      attempts = 1,
      completed = true,
    } = req.body;

    const user_id = req.user.id;

    // ── Validate required fields ────────────────────────────────────────────
    if (!question_id || !session_id || !sub_session_id) {
      return res.status(400).json(
        apiResponse(false, "question_id, session_id, sub_session_id are required", {}, req.rrn)
      );
    }

    if (!req.file) {
      return res.status(400).json(
        apiResponse(false, "Audio file is required", {}, req.rrn)
      );
    }

    // ── Step 1: Transcribe audio using Sarvam ───────────────────────────────
    let transcriptText = "";
    try {
      console.log("[Audio Answer] Transcribing with Sarvam:", req.file.originalname);
      const sarvamResult = await sarvamTranscribeFile(req.file.path, 'unknown');
      transcriptText = sarvamResult.text?.trim() ?? "";
      console.log("[Audio Answer] Transcript length:", transcriptText.length);
    } catch (sttErr) {
      console.error("[Audio Answer] Sarvam STT failed:", sttErr.message);
      return res.status(422).json(
        apiResponse(false, "Audio transcription failed. Please try again or type your answer.", {}, req.rrn)
      );
    }

    if (!transcriptText) {
      return res.status(422).json(
        apiResponse(false, "Could not extract text from audio. Please speak clearly and try again.", {}, req.rrn)
      );
    }

    // ── Step 2: Run through same AI pipeline as text answers ────────────────
    let ai_req_res_id = null;
    let ai_json = null;
    try {
      const aiResult = await AIReqResModel.sendOpinion(
        true,
        transcriptText,
        serviceId,
        title,
        title_desc,
        req.user.category
      );
      // ai_req_res is already the row id (a number), not an object — no `.id` here.
      ai_req_res_id = aiResult.ai_req_res ?? null;
      ai_json       = aiResult.ai_json ?? null;
    } catch (aiErr) {
      console.error("[Audio Answer] AI processing failed:", aiErr.message);
      // AI failure does not block saving the transcript as answer
    }

    // ── Step 3: Save to customer_answer (same table as text answers) ─────────
    const existing = await pool.query(
      `SELECT customer_answer_id FROM customer_answer WHERE user_id = $1 AND question_id = $2`,
      [user_id, question_id]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE customer_answer
         SET answer = $1, ai_req_res_id = $2, updated_at = NOW()
         WHERE user_id = $3 AND question_id = $4`,
        [transcriptText, ai_req_res_id, user_id, question_id]
      );
    } else {
      await pool.query(
        `INSERT INTO customer_answer
           (user_id, question_id, session_id, sub_session_id, answer, ai_req_res_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [user_id, question_id, session_id, sub_session_id, transcriptText, ai_req_res_id]
      );
    }

    // Log this as user activity so the admin "Daily Active User" report
    // has data to show. Failure here should never block the answer response.
    try {
      await userActivityModel.saveActivity(
        user_id,
        question_id,
        session_id,
        time_spent,
        attempts,
        completed
      );
    } catch (activityErr) {
      console.error("Failed to log user activity:", activityErr.message);
    }

    return res.json(apiResponse(
      true,
      "Audio answer saved successfully",
      { transcript: transcriptText, ai_json },  // Return transcript + AI story so frontend can show it
      req.rrn
    ));

  } catch (err) {
    next(err);
  } finally {
    // Clean up the uploaded audio file from disk after processing
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try { fs.unlinkSync(uploadedFilePath); } catch {}
    }
  }
};
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/user/session/:session_id
// Returns a single session with chapters + subchapters for the logged-in user.
// Only returns the session if it belongs to the user's category.
// ─────────────────────────────────────────────────────────────────────────────
export const getUserSessionById = async (req, res, next) => {
  try {
    const { session_id } = req.params;
    const category = req.user.category;

    // Fetch session — must match user's category
    const sessionRes = await pool.query(
      `SELECT * FROM session WHERE session_id = $1 AND category = $2 AND status = TRUE`,
      [session_id, category]
    );

    if (!sessionRes.rows[0]) {
      return res
        .status(404)
        .json(apiResponse(false, "Session not found", {}, req.rrn));
    }

    const session = sessionRes.rows[0];

    // All active sub_sessions for this session, ordered by seq
    const subSessionRes = await pool.query(
      `SELECT * FROM sub_session
       WHERE session_id = $1 AND status = TRUE
       ORDER BY seq, sub_session_id`,
      [session_id]
    );

    const subSessions = subSessionRes.rows;

    // All questions for those sub_sessions
    let questions = [];
    if (subSessions.length) {
      const subIds = subSessions.map((ss) => ss.sub_session_id);
      const questionRes = await pool.query(
        `SELECT * FROM question
         WHERE sub_session_id = ANY($1) AND status = TRUE
         ORDER BY sub_session_id, question_id`,
        [subIds]
      );
      questions = questionRes.rows;
    }

    // Index questions by sub_session_id
    const questionsBySubSession = {};
    for (const q of questions) {
      if (!questionsBySubSession[q.sub_session_id]) {
        questionsBySubSession[q.sub_session_id] = [];
      }
      questionsBySubSession[q.sub_session_id].push(q);
    }

    // Group sub_sessions under chapter titles
    // Title format: "CHAPTER 1 — Some Chapter Name → SubChapter Name"
    const chaptersMap = new Map();
    for (const ss of subSessions) {
      const [chapterTitle = ss.title, subChapterTitle = ""] =
        ss.title.split(" → ");

      if (!chaptersMap.has(chapterTitle)) {
        chaptersMap.set(chapterTitle, []);
      }

      chaptersMap.get(chapterTitle).push({
        sub_session_id: ss.sub_session_id,
        title: subChapterTitle,
        full_title: ss.title,
        seq: ss.seq,
        status: ss.status,
        questions: questionsBySubSession[ss.sub_session_id] ?? [],
      });
    }

    const mainPoints = [];
    for (const [chapterTitle, subs] of chaptersMap) {
      mainPoints.push({ title: chapterTitle, subChapters: subs });
    }

    return res.json(
      apiResponse(
        true,
        "Session fetched",
        {
          session_id: session.session_id,
          title: session.title,
          category: session.category,
          status: session.status,
          mainPoints,
        },
        req.rrn
      )
    );
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/user/board-placements?board_type=vision_board
// Read-only: returns this customer's own board placements (or all boards
// if board_type is omitted), as placed by their editor.
// ─────────────────────────────────────────────────────────────────────────────
export const getUserBoardPlacements = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const { board_type } = req.query;

    const result = await pool.query(
      board_type
        ? `SELECT bp.*, ug.file_url
           FROM board_placements bp
           INNER JOIN user_gallery ug ON ug.id = bp.gallery_id
           WHERE bp.user_id = $1 AND bp.board_type = $2`
        : `SELECT bp.*, ug.file_url
           FROM board_placements bp
           INNER JOIN user_gallery ug ON ug.id = bp.gallery_id
           WHERE bp.user_id = $1`,
      board_type ? [user_id, board_type] : [user_id]
    );

    const placements = await Promise.all(
      result.rows.map(async (row) => ({
        ...row,
        view_url: await getCachedViewUrl(row.file_url),
      }))
    );

    return res.json(apiResponse(true, "Placements fetched", placements, req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/user/board-quotes?board_type=vision_board
// Read-only: returns this customer's own saved quote text per board
// position (or all boards if board_type is omitted), as set by their editor.
// ─────────────────────────────────────────────────────────────────────────────
export const getUserBoardQuotes = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const { board_type } = req.query;

    const result = await pool.query(
      board_type
        ? `SELECT * FROM board_quotes WHERE user_id = $1 AND board_type = $2`
        : `SELECT * FROM board_quotes WHERE user_id = $1`,
      board_type ? [user_id, board_type] : [user_id]
    );

    return res.json(apiResponse(true, "Quotes fetched", result.rows, req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/user/flipbook
// Returns the editor-approved PDF (with a viewable URL) for the logged-in
// customer, so the flipbook page can render it page by page.
// ─────────────────────────────────────────────────────────────────────────────
export const getUserFlipbook = async (req, res, next) => {
  try {
    const user_id = req.user.id;

    const result = await pool.query(
      `SELECT * FROM approved_flipbooks WHERE user_id = $1`,
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.json(apiResponse(true, "No flipbook available yet", null, req.rrn));
    }

    const row = result.rows[0];
    const pdf_url =
      row.storage_type === "local"
        ? `${req.protocol}://${req.get("host")}${row.pdf_key}`
        : await getViewUrl(row.pdf_key);

    return res.json(
      apiResponse(true, "Flipbook fetched", { ...row, pdf_url }, req.rrn)
    );
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/user/flipbook-notes
// Returns all of the logged-in customer's own per-page notes on their book.
// ─────────────────────────────────────────────────────────────────────────────
export const getUserFlipbookNotes = async (req, res, next) => {
  try {
    const user_id = req.user.id;

    const result = await pool.query(
      `SELECT page_number, note_text, updated_at
       FROM flipbook_notes
       WHERE user_id = $1
       ORDER BY page_number ASC`,
      [user_id]
    );

    return res.json(apiResponse(true, "Notes fetched", result.rows, req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/user/flipbook-notes
// Body: { page_number, note_text }
// Saves (upserts) the note the customer wrote for one page of the flipbook.
// The editor can read these back via GET /api/editor/customer/:user_id/flipbook-notes
// ─────────────────────────────────────────────────────────────────────────────
export const saveUserFlipbookNote = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const { page_number, note_text } = req.body;

    if (page_number === undefined || page_number === null || Number.isNaN(Number(page_number))) {
      return res
        .status(400)
        .json(apiResponse(false, "page_number is required", {}, req.rrn));
    }

    const result = await pool.query(
      `INSERT INTO flipbook_notes (user_id, page_number, note_text, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, page_number) DO UPDATE SET
         note_text  = EXCLUDED.note_text,
         updated_at = NOW()
       RETURNING *`,
      [user_id, page_number, note_text || ""]
    );

    return res.json(apiResponse(true, "Note saved", result.rows[0], req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/user/flipbook/request-publish
// The customer tells their editor(s) they're happy with the book and want it
// published. Logs a request row + emails every editor assigned to them.
// ─────────────────────────────────────────────────────────────────────────────
export const requestFlipbookPublish = async (req, res, next) => {
  try {
    const user_id = req.user.id;

    const editorsResult = await pool.query(
      `SELECT u.user_id AS editor_id, u.email, u.name
       FROM editor_customer ec
       JOIN users u ON u.user_id = ec.editor_id
       WHERE ec.user_id = $1 AND u.role = 'editor'`,
      [user_id]
    );

    const userResult = await pool.query(
      `SELECT name, email FROM users WHERE user_id = $1`,
      [user_id]
    );
    const customer = userResult.rows[0];

    if (editorsResult.rows.length === 0) {
      return res
        .status(400)
        .json(apiResponse(false, "No editor is assigned to you yet", {}, req.rrn));
    }

    // Customer has now approved the book — mark it so the editor's project
    // list can move this from "In Review" to "Approved".
    await pool.query(
      `UPDATE approved_flipbooks
       SET customer_approved_at = COALESCE(customer_approved_at, NOW())
       WHERE user_id = $1`,
      [user_id]
    );

    for (const editor of editorsResult.rows) {
      await pool.query(
        `INSERT INTO flipbook_publish_requests (user_id, editor_id, status)
         VALUES ($1, $2, 'pending')`,
        [user_id, editor.editor_id]
      );

      try {
        await sendMail(
          editor.email,
          `📖 ${customer?.name || "A customer"} wants their book published`,
          `<h3>Publish Request</h3>
           <p><strong>Customer:</strong> ${customer?.name || "Unknown"} (${customer?.email || "no email"})</p>
           <p>They've reviewed their flipbook and would like it published as final.</p>`
        );
      } catch (mailErr) {
        // Don't fail the whole request if email delivery has an issue
        console.error("Failed to email editor about publish request:", mailErr);
      }
    }

    return res.json(
      apiResponse(true, "Your editor has been notified", {}, req.rrn)
    );
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/user/flipbook/mark-downloaded
// Downloading the approved PDF also counts as the customer approving the
// book — moves the project from "In Review" to "Approved" on the editor side.
// ─────────────────────────────────────────────────────────────────────────────
export const markFlipbookDownloaded = async (req, res, next) => {
  try {
    const user_id = req.user.id;

    const result = await pool.query(
      `UPDATE approved_flipbooks
       SET customer_approved_at = COALESCE(customer_approved_at, NOW())
       WHERE user_id = $1
       RETURNING *`,
      [user_id]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json(apiResponse(false, "No flipbook found", {}, req.rrn));
    }

    return res.json(apiResponse(true, "Marked as approved", result.rows[0], req.rrn));
  } catch (err) {
    next(err);
  }
};