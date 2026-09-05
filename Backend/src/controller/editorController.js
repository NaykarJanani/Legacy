import apiResponse from "../utils/apiResponse.js";
import pool from "../config/db/db_config.js";
import bcrypt from "bcryptjs";
import { getUploadUrl, getCachedViewUrl, getPdfUploadUrl, getViewUrl, deleteFile } from "../aws/storageService.js";
import { createPdfUploader } from "../middleware/uploadMiddleware.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename_editor = fileURLToPath(import.meta.url);
const __dirname_editor = path.dirname(__filename_editor);

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/editor/flipbook-publish-requests
// Returns every pending "please publish my book" request from customers
// assigned to the logged-in editor.
// ─────────────────────────────────────────────────────────────────────────────
export const getFlipbookPublishRequests = async (req, res, next) => {
  try {
    const editor_id = req.user.id;

    const result = await pool.query(
      `SELECT fpr.id, fpr.user_id, fpr.status, fpr.created_at, u.name AS customer_name
       FROM flipbook_publish_requests fpr
       JOIN users u ON u.user_id = fpr.user_id
       WHERE fpr.editor_id = $1 AND fpr.status = 'pending'
       ORDER BY fpr.created_at DESC`,
      [editor_id]
    );

    return res.json(apiResponse(true, "Publish requests fetched", result.rows, req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/editor/flipbook-publish-requests/:id/acknowledge
// Editor dismisses/acknowledges a customer's "please publish" notification.
// Scoped to requests addressed to this editor. Flips status from 'pending'
// to 'acknowledged' so it drops out of getFlipbookPublishRequests and the
// pending_notifications count on the Editor Projects list.
// ─────────────────────────────────────────────────────────────────────────────
export const acknowledgeFlipbookPublishRequest = async (req, res, next) => {
  try {
    const editor_id = req.user.id;
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE flipbook_publish_requests
       SET status = 'acknowledged', updated_at = NOW()
       WHERE id = $1 AND editor_id = $2
       RETURNING *`,
      [id, editor_id]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json(apiResponse(false, "Publish request not found", {}, req.rrn));
    }

    return res.json(apiResponse(true, "Request acknowledged", result.rows[0], req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/editor/customers
// Returns list of customers assigned to the logged-in editor
// via the editor_customer linking table
// ─────────────────────────────────────────────────────────────────────────────
// Project-status lifecycle (matches the tabs on the Editor Projects page):
//   Research          → customer still has chapters pending (not all approved yet)
//   Drafting          → all chapters approved, editor is assembling the book
//                        (no final flipbook PDF uploaded yet)
//   In Review         → editor has uploaded the final book PDF, customer is
//                        reviewing it (approved_flipbooks row exists)
//   Approved          → customer approved it — either by clicking "Publish
//                        Book" or by downloading the PDF (customer_approved_at set)
//   Ready To Publish  → editor has confirmed the approved book is ready
//                        for admin to publish (ready_at set)
//   Published         → admin has published the book (published_at set)
const deriveProjectStatus = ({
  total_chapters,
  approved_chapters,
  has_flipbook,
  customer_approved_at,
  ready_at,
  published_at,
}) => {
  if (published_at) return "Published";
  if (ready_at) return "Ready To Publish";
  if (customer_approved_at) return "Approved";
  if (has_flipbook) return "In Review";
  if (Number(total_chapters) > 0 && Number(total_chapters) === Number(approved_chapters)) {
    return "Drafting";
  }
  return "Research";
};

// Progress % is a milestone marker for where the project sits in the overall
// pipeline — NOT a fine-grained measure of chapters/questions answered. The
// whole book is only ever approved once, as a single PDF, at the end — there's
// no meaningful per-chapter "progress" to sum up before that point.
const STAGE_PROGRESS = {
  "Research": 0,
  "Drafting": 20,
  "In Review": 40,
  "Approved": 60,
  "Ready To Publish": 80,
  "Published": 100,
};

export const getAssignedCustomers = async (req, res, next) => {
  try {
    const editor_id = req.user.id;

    const result = await pool.query(
      `SELECT
         u.user_id,
         u.name,
         u.email,
         u.mobile,
         u.category,
         u.industry,
         u."entityname",
         u.state,
         u.district,
         u.status,
         u.avatar_key,
         ec.assigned_at,
         af.id                    AS flipbook_id,
         af.customer_approved_at,
         af.ready_at,
         af.published_at,
         COALESCE(cs.total_chapters, 0)    AS total_chapters,
         COALESCE(cs.approved_chapters, 0) AS approved_chapters,
         COALESCE(pr.pending_count, 0)     AS pending_notifications
       FROM users u
       INNER JOIN editor_customer ec ON ec.user_id = u.user_id
       LEFT JOIN approved_flipbooks af ON af.user_id = u.user_id
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*)::int AS total_chapters,
           COUNT(*) FILTER (
             WHERE chapter_stat.total_questions > 0
               AND chapter_stat.total_questions = chapter_stat.approved_questions
           )::int AS approved_chapters
         FROM (
           SELECT
             s.session_id,
             COUNT(q.question_id) AS total_questions,
             COUNT(ca.customer_answer_id) FILTER (WHERE ca.is_approved = true) AS approved_questions
           FROM session s
           INNER JOIN sub_session ss ON ss.session_id = s.session_id
           INNER JOIN question q ON q.sub_session_id = ss.sub_session_id
           LEFT JOIN customer_answer ca
             ON ca.question_id    = q.question_id
            AND ca.sub_session_id = ss.sub_session_id
            AND ca.session_id     = s.session_id
            AND ca.user_id        = u.user_id
           WHERE s.category = u.category
             AND s.status = true
           GROUP BY s.session_id
         ) chapter_stat
       ) cs ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS pending_count
         FROM flipbook_publish_requests fpr
         WHERE fpr.user_id = u.user_id
           AND fpr.editor_id = $1
           AND fpr.status = 'pending'
       ) pr ON true
       WHERE ec.editor_id = $1
       ORDER BY ec.assigned_at DESC`,
      [editor_id]
    );

    const data = await Promise.all(
      result.rows.map(async (row) => {
        const project_status = deriveProjectStatus({
          total_chapters: row.total_chapters,
          approved_chapters: row.approved_chapters,
          has_flipbook: !!row.flipbook_id,
          customer_approved_at: row.customer_approved_at,
          ready_at: row.ready_at,
          published_at: row.published_at,
        });

        return {
          user_id: row.user_id,
          name: row.name,
          email: row.email,
          mobile: row.mobile,
          category: row.category,
          industry: row.industry,
          entityname: row.entityname,
          state: row.state,
          district: row.district,
          status: row.status,
          avatar_url: row.avatar_key ? await getCachedViewUrl(row.avatar_key) : null,
          created_at: row.assigned_at,
          assigned_at: row.assigned_at,
          total_chapters: row.total_chapters,
          approved_chapters: row.approved_chapters,
          pending_notifications: row.pending_notifications,
          project_status,
          progress_percent: STAGE_PROGRESS[project_status] ?? 0,
        };
      })
    );

    return res.json(
      apiResponse(true, "Assigned customers fetched", data, req.rrn)
    );
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/editor/customer/:user_id/qa
// Returns full Q&A for a customer — editor-scoped
// Editor can only view customers assigned to them
// ─────────────────────────────────────────────────────────────────────────────
export const getCustomerQA = async (req, res, next) => {
  try {
    const editor_id = req.user.id;
    const { user_id } = req.params;

    // Verify this customer is assigned to this editor
    const assignCheck = await pool.query(
      `SELECT id FROM editor_customer
       WHERE editor_id = $1 AND user_id = $2`,
      [editor_id, user_id]
    );

    if (assignCheck.rows.length === 0) {
      return res
        .status(403)
        .json(
          apiResponse(false, "This customer is not assigned to you", {}, req.rrn)
        );
    }

    const result = await pool.query(
      `SELECT
         ss.sub_session_id,
         ss.title        AS sub_session_title,
         q.question_id,
         q.question,
         COALESCE(ca.answer, 'Pending')  AS answer,
         ca.customer_answer_id,
         ca.is_approved,
         ca.source,
         ca.updated_at
       FROM users u
       INNER JOIN session s
           ON s.category = u.category
       INNER JOIN sub_session ss
           ON ss.session_id = s.session_id
       INNER JOIN question q
           ON q.sub_session_id = ss.sub_session_id
       LEFT JOIN customer_answer ca
           ON ca.question_id    = q.question_id
          AND ca.sub_session_id = ss.sub_session_id
          AND ca.session_id     = s.session_id
          AND ca.user_id        = u.user_id
       WHERE u.user_id = $1
       ORDER BY ss.seq, q.question_id`,
      [user_id]
    );

    return res.json(
      apiResponse(true, "Customer Q&A fetched", result.rows, req.rrn)
    );
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/editor/customer/:user_id/chapters
// Returns the chapter → sub-chapter → question CONTENT TREE for this
// customer's category. This is the same tree for every customer sharing a
// category — it holds no answers. (Answers are fetched per-question on the
// next page, via getCustomerQA-style lookups scoped to a single sub_session
// or question.)
//
// sub_session.title is stored as "Chapter → SubChapter", so each sub_session
// row is parsed into a chapter node + sub-chapter leaf, same convention used
// by getSessionById / sessionQuestionModel.getAllSession on the admin side.
// ─────────────────────────────────────────────────────────────────────────────
export const getCustomerChapters = async (req, res, next) => {
  try {
    const editor_id = req.user.id;
    const { user_id } = req.params;

    // Verify this customer is assigned to this editor
    const assignCheck = await pool.query(
      `SELECT id FROM editor_customer
       WHERE editor_id = $1 AND user_id = $2`,
      [editor_id, user_id]
    );

    if (assignCheck.rows.length === 0) {
      return res
        .status(403)
        .json(
          apiResponse(false, "This customer is not assigned to you", {}, req.rrn)
        );
    }

    // Look up the customer's category — this decides which session(s) apply
    const customerRes = await pool.query(
      `SELECT category FROM users WHERE user_id = $1`,
      [user_id]
    );
    if (customerRes.rows.length === 0) {
      return res
        .status(404)
        .json(apiResponse(false, "Customer not found", {}, req.rrn));
    }
    const { category } = customerRes.rows[0];

    // All active sessions for this category
    const sessionRes = await pool.query(
      `SELECT * FROM session
       WHERE category = $1 AND status = TRUE
       ORDER BY seq, session_id`,
      [category]
    );
    const sessions = sessionRes.rows;
    if (sessions.length === 0) {
      return res.json(apiResponse(true, "No chapters found", [], req.rrn));
    }
    const sessionIds = sessions.map((s) => s.session_id);

    // All sub_sessions under those sessions
    const subSessionRes = await pool.query(
      `SELECT * FROM sub_session
       WHERE session_id = ANY($1) AND status = TRUE
       ORDER BY session_id, seq, sub_session_id`,
      [sessionIds]
    );
    const subSessions = subSessionRes.rows;
    const subSessionIds = subSessions.map((ss) => ss.sub_session_id);

    // Question counts per sub_session (page just needs counts + list, no answers)
    let questions = [];
    if (subSessionIds.length) {
      const questionRes = await pool.query(
        `SELECT question_id, session_id, sub_session_id, question, seq, question_type
         FROM question
         WHERE sub_session_id = ANY($1) AND status = TRUE
         ORDER BY sub_session_id, seq, question_id`,
        [subSessionIds]
      );
      questions = questionRes.rows;
    }

    const questionsBySubSession = {};
    for (const q of questions) {
      if (!questionsBySubSession[q.sub_session_id]) {
        questionsBySubSession[q.sub_session_id] = [];
      }
      questionsBySubSession[q.sub_session_id].push(q);
    }

    // Group sub_sessions by session, then split each title into chapter / sub-chapter
    const subSessionsBySession = {};
    for (const ss of subSessions) {
      if (!subSessionsBySession[ss.session_id]) {
        subSessionsBySession[ss.session_id] = [];
      }
      subSessionsBySession[ss.session_id].push(ss);
    }

    const data = sessions.map((s) => {
      const rawSubSessions = subSessionsBySession[s.session_id] || [];

      const chaptersMap = new Map();
      for (const ss of rawSubSessions) {
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
          question_count: (questionsBySubSession[ss.sub_session_id] || []).length,
          questions: (questionsBySubSession[ss.sub_session_id] || []).map((q) => ({
            question_id: q.question_id,
            question: q.question,
            seq: q.seq,
            question_type: q.question_type,
          })),
        });
      }

      const chapters = [];
      for (const [chapterTitle, subChapters] of chaptersMap) {
        chapters.push({ title: chapterTitle, subChapters });
      }

      return {
        session_id: s.session_id,
        title: s.title,
        subtitle: s.subtitle,
        category: s.category,
        seq: s.seq,
        chapters,
      };
    });

    return res.json(apiResponse(true, "Chapters fetched", data, req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/editor/customer/:user_id/question/:question_id/answer
// Returns everything the AI Writing Studio needs for ONE question:
//   - the question text + its sub_session / session context
//   - the customer's original submitted answer (customer_answer.answer)
//   - the AI-generated narrative for it (ai_req_res.json_data.narrative),
//     plus the full structured AI json in case the UI wants highlights/quote/etc.
// ─────────────────────────────────────────────────────────────────────────────
export const getQuestionAnswer = async (req, res, next) => {
  try {
    const editor_id = req.user.id;
    const { user_id, question_id } = req.params;

    const assignCheck = await pool.query(
      `SELECT id FROM editor_customer WHERE editor_id = $1 AND user_id = $2`,
      [editor_id, user_id]
    );
    if (assignCheck.rows.length === 0) {
      return res
        .status(403)
        .json(apiResponse(false, "This customer is not assigned to you", {}, req.rrn));
    }

    const result = await pool.query(
      `SELECT
         q.question_id,
         q.question,
         q.sub_session_id,
         ss.title            AS sub_session_title,
         q.session_id,
         s.title             AS session_title,
         ca.customer_answer_id,
         ca.answer,
         ca.source,
         ca.is_approved,
         ca.ai_req_res_id,
         ca.updated_at,
         ar.json_data        AS ai_json
       FROM question q
       INNER JOIN sub_session ss ON ss.sub_session_id = q.sub_session_id
       INNER JOIN session s      ON s.session_id      = q.session_id
       LEFT JOIN customer_answer ca
              ON ca.question_id = q.question_id
             AND ca.user_id     = $2
       LEFT JOIN ai_req_res ar   ON ar.id = ca.ai_req_res_id
       WHERE q.question_id = $1`,
      [question_id, user_id]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json(apiResponse(false, "Question not found", {}, req.rrn));
    }

    const row = result.rows[0];
    const [chapterTitle, subChapterTitle] = (row.sub_session_title || "").split(" → ");

    const data = {
      question_id: row.question_id,
      question: row.question,
      session_id: row.session_id,
      session_title: row.session_title,
      sub_session_id: row.sub_session_id,
      chapter_title: chapterTitle || row.sub_session_title,
      sub_chapter_title: subChapterTitle || "",
      customer_answer_id: row.customer_answer_id,
      answer: row.answer || null,           // original submitted response
      source: row.source,
      is_approved: row.is_approved || false,
      ai_narrative: row.ai_json?.narrative || null,   // AI-generated response
      ai_json: row.ai_json || null,
      updated_at: row.updated_at,
    };

    return res.json(apiResponse(true, "Answer fetched", data, req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/editor/answer/:id
// Body: { answer }
// Editor edits / corrects the extracted answer text
// ─────────────────────────────────────────────────────────────────────────────
export const editAnswer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { answer } = req.body;

    if (!answer || String(answer).trim() === "") {
      return res
        .status(400)
        .json(apiResponse(false, "answer is required", {}, req.rrn));
    }

    const result = await pool.query(
      `UPDATE customer_answer
       SET answer     = $1,
           updated_at = NOW()
       WHERE customer_answer_id = $2
       RETURNING customer_answer_id`,
      [answer, id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(apiResponse(false, "Answer not found", {}, req.rrn));
    }

    return res.json(apiResponse(true, "Answer updated", {}, req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/editor/answer/:id/approve
// Body: { is_approved: true | false }
// Editor marks an answer as approved or reverts approval
// ─────────────────────────────────────────────────────────────────────────────
export const approveAnswer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { is_approved } = req.body;

    if (typeof is_approved !== "boolean") {
      return res
        .status(400)
        .json(
          apiResponse(false, "is_approved must be true or false", {}, req.rrn)
        );
    }

    const result = await pool.query(
      `UPDATE customer_answer
       SET is_approved = $1,
           updated_at  = NOW()
       WHERE customer_answer_id = $2
       RETURNING customer_answer_id`,
      [is_approved, id]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(apiResponse(false, "Answer not found", {}, req.rrn));
    }

    return res.json(
      apiResponse(
        true,
        is_approved ? "Answer approved" : "Approval reverted",
        {},
        req.rrn
      )
    );
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/editor/customer/:user_id/audio
// Returns audio sessions + transcripts for a customer
// ─────────────────────────────────────────────────────────────────────────────
export const getCustomerAudio = async (req, res, next) => {
  try {
    const editor_id = req.user.id;
    const { user_id } = req.params;

    // Verify assignment
    const assignCheck = await pool.query(
      `SELECT id FROM editor_customer
       WHERE editor_id = $1 AND user_id = $2`,
      [editor_id, user_id]
    );

    if (assignCheck.rows.length === 0) {
      return res
        .status(403)
        .json(
          apiResponse(false, "This customer is not assigned to you", {}, req.rrn)
        );
    }

    // Fetch audio sessions with their transcripts
    const audioSessions = await pool.query(
      `SELECT
         aus.audio_session_id,
         aus.session_id,
         aus.status,
         aus.created_at
       FROM audio_sessions aus
       WHERE aus.user_id = $1
       ORDER BY aus.created_at DESC`,
      [user_id]
    );

    if (audioSessions.rows.length === 0) {
      return res.json(
        apiResponse(true, "No audio sessions found", [], req.rrn)
      );
    }

    const audioSessionIds = audioSessions.rows.map((a) => a.audio_session_id);

    const transcripts = await pool.query(
      `SELECT *
       FROM audio_transcripts
       WHERE audio_session_id = ANY($1)
       ORDER BY transcript_id`,
      [audioSessionIds]
    );

    // Group transcripts under each audio session
    const transcriptsBySession = {};
    for (const t of transcripts.rows) {
      if (!transcriptsBySession[t.audio_session_id]) {
        transcriptsBySession[t.audio_session_id] = [];
      }
      transcriptsBySession[t.audio_session_id].push(t);
    }

    const data = audioSessions.rows.map((s) => ({
      ...s,
      transcripts: transcriptsBySession[s.audio_session_id] || [],
    }));

    return res.json(
      apiResponse(true, "Audio sessions fetched", data, req.rrn)
    );
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/editor/profile
// Returns the logged-in editor's own profile
// ─────────────────────────────────────────────────────────────────────────────
export const getEditorProfile = async (req, res, next) => {
  try {
    const editor_id = req.user.id;

    const result = await pool.query(
      `SELECT user_id, name, username, email, mobile,
              display_name, language, timezone, avatar_key
       FROM users
       WHERE user_id = $1`,
      [editor_id]
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json(apiResponse(false, "Editor not found", {}, req.rrn));
    }

    const row = result.rows[0];
    const data = {
      ...row,
      avatar_url: row.avatar_key ? await getCachedViewUrl(row.avatar_key) : null,
    };

    return res.json(
      apiResponse(true, "Profile fetched", data, req.rrn)
    );
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/editor/profile
// Body: { username, email, password?, display_name?, language?, timezone?, avatar_key? }
// Editor updates their own profile fields, and optionally their password
// ─────────────────────────────────────────────────────────────────────────────
export const updateEditorProfile = async (req, res, next) => {
  try {
    const editor_id = req.user.id;
    const {
      username,
      email,
      password,
      display_name,
      language,
      timezone,
      avatar_key,
    } = req.body;

    if (!username || !email) {
      return res
        .status(400)
        .json(apiResponse(false, "username and email are required", {}, req.rrn));
    }

    let hashedPassword = null;
    if (password && password.trim() !== "") {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const result = await pool.query(
      `UPDATE users
       SET username     = $1,
           email        = $2,
           display_name = $3,
           language     = $4,
           timezone     = $5,
           avatar_key   = COALESCE($6, avatar_key),
           password     = COALESCE($7, password),
           updated_at   = NOW()
       WHERE user_id = $8
       RETURNING user_id, name, username, email, mobile, display_name, language, timezone, avatar_key`,
      [
        username,
        email,
        display_name || null,
        language || null,
        timezone || null,
        avatar_key || null,
        hashedPassword,
        editor_id,
      ]
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json(apiResponse(false, "Editor not found", {}, req.rrn));
    }

    const row = result.rows[0];
    const data = {
      ...row,
      avatar_url: row.avatar_key ? await getCachedViewUrl(row.avatar_key) : null,
    };

    return res.json(
      apiResponse(true, "Profile updated", data, req.rrn)
    );
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/editor/profile/avatar-upload-url
// Body: { fileName, fileType }
// Returns a pre-signed S3 URL for the editor to upload a new avatar image to.
// Same pattern as /api/user/gallery/upload-url — frontend PUTs the file
// directly to S3 using uploadUrl, then sends "key" back via PUT /profile.
// ─────────────────────────────────────────────────────────────────────────────
export const getEditorAvatarUploadUrl = async (req, res, next) => {
  try {
    const { fileName, fileType } = req.body;

    if (!fileName || !fileType) {
      return res
        .status(400)
        .json(apiResponse(false, "fileName and fileType are required", {}, req.rrn));
    }

    const folder_name = `editor-avatars/${req.user.id}`;

    const { uploadUrl, key } = await getUploadUrl({
      fileName,
      fileType,
      folder_name,
      UniqueFileName: `avatar-${Date.now()}`,
    });

    return res.json(
      apiResponse(true, "Upload URL generated", { uploadUrl, key }, req.rrn)
    );
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/editor/customer/:user_id/summary
// Returns a customer's project-level summary: profile info + chapter progress.
//
// A "chapter" = a sub_session (same grouping used in getCustomerQA).
// A chapter counts as "approved" only when EVERY question inside it has an
// approved answer — not just when at least one answer is approved.
// ─────────────────────────────────────────────────────────────────────────────
export const getCustomerSummary = async (req, res, next) => {
  try {
    const editor_id = req.user.id;
    const { user_id } = req.params;

    // Verify this customer is assigned to this editor
    const assignCheck = await pool.query(
      `SELECT assigned_at FROM editor_customer
       WHERE editor_id = $1 AND user_id = $2`,
      [editor_id, user_id]
    );

    if (assignCheck.rows.length === 0) {
      return res
        .status(403)
        .json(
          apiResponse(false, "This customer is not assigned to you", {}, req.rrn)
        );
    }

    // Basic customer profile
    const customerResult = await pool.query(
      `SELECT user_id, name, year, category, industry, entityname, avatar_key, created_at
       FROM users
       WHERE user_id = $1`,
      [user_id]
    );

    if (customerResult.rows.length === 0) {
      return res
        .status(404)
        .json(apiResponse(false, "Customer not found", {}, req.rrn));
    }
    const customer = customerResult.rows[0];

    // Chapter progress
    // NOTE: a "chapter" = a session (e.g. "Chapter 1 — Childhood & Early Life").
    // Each session has several sub_session rows underneath it, which are
    // sub-topics WITHIN that chapter (e.g. "→ Family Background"), not
    // separate chapters themselves. Grouping by sub_session_id here would
    // massively overcount — e.g. 11 real chapters × 5 sub-topics each = 55.
    const chapterResult = await pool.query(
      `WITH chapter_stats AS (
         SELECT
           s.session_id,
           COUNT(q.question_id) AS total_questions,
           COUNT(ca.customer_answer_id) FILTER (WHERE ca.is_approved = true) AS approved_questions,
           MAX(ca.updated_at) AS last_updated
         FROM session s
         INNER JOIN sub_session ss ON ss.session_id = s.session_id
         INNER JOIN question q ON q.sub_session_id = ss.sub_session_id
         LEFT JOIN customer_answer ca
           ON ca.question_id    = q.question_id
          AND ca.sub_session_id = ss.sub_session_id
          AND ca.session_id     = s.session_id
          AND ca.user_id        = $2
         WHERE s.category = $1
           AND s.status = true
         GROUP BY s.session_id
       )
       SELECT
         COUNT(*)::int AS total_chapters,
         COUNT(*) FILTER (
           WHERE total_questions > 0 AND total_questions = approved_questions
         )::int AS approved_chapters,
         MAX(last_updated) AS last_updated
       FROM chapter_stats`,
      [customer.category, user_id]
    );

    const { total_chapters, approved_chapters, last_updated } = chapterResult.rows[0];

    // Pull in the flipbook lifecycle so the status matches the Editor
    // Projects list exactly (chapter progress alone isn't enough once the
    // book has been assembled / sent for approval / published).
    const flipbookResult = await pool.query(
      `SELECT id, customer_approved_at, ready_at, published_at
       FROM approved_flipbooks WHERE user_id = $1`,
      [user_id]
    );
    const flipbook = flipbookResult.rows[0] || null;

    // Total Pages = only the individual sides (left/right) that actually have
    // content placed — an empty spread, or one side of a spread left blank,
    // doesn't count. jsonb_array_length is NULL-safe here: NULL/empty boxes
    // fall through the CASE to 0.
    const bookPagesResult = await pool.query(
      `SELECT COALESCE(SUM(
         (CASE WHEN jsonb_array_length(left_boxes)  > 0 THEN 1 ELSE 0 END) +
         (CASE WHEN jsonb_array_length(right_boxes) > 0 THEN 1 ELSE 0 END)
       ), 0)::int AS total_pages
       FROM book_pages WHERE user_id = $1`,
      [user_id]
    );
    const total_pages = bookPagesResult.rows[0].total_pages;

    const project_status = deriveProjectStatus({
      total_chapters,
      approved_chapters,
      has_flipbook: !!flipbook,
      customer_approved_at: flipbook?.customer_approved_at,
      ready_at: flipbook?.ready_at,
      published_at: flipbook?.published_at,
    });

    const progress_percent = STAGE_PROGRESS[project_status] ?? 0;

    const data = {
      user_id: customer.user_id,
      name: customer.name,
      year: customer.year,
      category: customer.category,
      industry: customer.industry,
      entityname: customer.entityname,
      avatar_url: customer.avatar_key ? await getCachedViewUrl(customer.avatar_key) : null,
      created_at: customer.created_at,
      assigned_at: assignCheck.rows[0].assigned_at,
      project_status,
      total_chapters,
      approved_chapters,
      progress_percent,
      total_pages,
      last_updated,
      customer_approved_at: flipbook?.customer_approved_at || null,
      ready_at: flipbook?.ready_at || null,
      published_at: flipbook?.published_at || null,
    };

    return res.json(
      apiResponse(true, "Customer summary fetched", data, req.rrn)
    );
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/editor/customer/:user_id/media-library
// Returns every photo for this customer — both what the customer uploaded
// themselves (via the answer flow / their own gallery) AND anything the
// editor has separately added. One unified pool, tagged by uploaded_by.
// ─────────────────────────────────────────────────────────────────────────────
export const getMediaLibrary = async (req, res, next) => {
  try {
    const editor_id = req.user.id;
    const { user_id } = req.params;

    const assignCheck = await pool.query(
      `SELECT id FROM editor_customer WHERE editor_id = $1 AND user_id = $2`,
      [editor_id, user_id]
    );
    if (assignCheck.rows.length === 0) {
      return res
        .status(403)
        .json(apiResponse(false, "This customer is not assigned to you", {}, req.rrn));
    }

    const result = await pool.query(
      `SELECT id, user_id, file_url, uploaded_by, uploaded_by_editor_id, created_at
       FROM user_gallery
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [user_id]
    );

    const images = await Promise.all(
      result.rows.map(async (row) => ({
        ...row,
        view_url: await getCachedViewUrl(row.file_url),
      }))
    );

    return res.json(apiResponse(true, "Media library fetched", images, req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/editor/customer/:user_id/media-library/upload-url
// Body: { fileName, fileType }
// Pre-signed S3 URL — uses the SAME folder as customer uploads
// (gallery/{user_id}) so both sources genuinely live in one place.
// ─────────────────────────────────────────────────────────────────────────────
export const getMediaLibraryUploadUrl = async (req, res, next) => {
  try {
    const editor_id = req.user.id;
    const { user_id } = req.params;
    const { fileName, fileType } = req.body;

    const assignCheck = await pool.query(
      `SELECT id FROM editor_customer WHERE editor_id = $1 AND user_id = $2`,
      [editor_id, user_id]
    );
    if (assignCheck.rows.length === 0) {
      return res
        .status(403)
        .json(apiResponse(false, "This customer is not assigned to you", {}, req.rrn));
    }

    if (!fileName || !fileType) {
      return res
        .status(400)
        .json(apiResponse(false, "fileName and fileType are required", {}, req.rrn));
    }

    const folder_name = `gallery/${user_id}`;
    const { uploadUrl, key } = await getUploadUrl({
      fileName,
      fileType,
      folder_name,
      UniqueFileName: `editor-upload-${Date.now()}`,
    });

    return res.json(
      apiResponse(true, "Upload URL generated", { uploadUrl, key }, req.rrn)
    );
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/editor/customer/:user_id/media-library
// Body: { key }
// Saves an editor-uploaded image into the SAME user_gallery table the
// customer's own photos live in, tagged uploaded_by = 'editor'.
// ─────────────────────────────────────────────────────────────────────────────
export const saveMediaLibraryImage = async (req, res, next) => {
  try {
    const editor_id = req.user.id;
    const { user_id } = req.params;
    const { key } = req.body;

    const assignCheck = await pool.query(
      `SELECT id FROM editor_customer WHERE editor_id = $1 AND user_id = $2`,
      [editor_id, user_id]
    );
    if (assignCheck.rows.length === 0) {
      return res
        .status(403)
        .json(apiResponse(false, "This customer is not assigned to you", {}, req.rrn));
    }

    if (!key) {
      return res.status(400).json(apiResponse(false, "key is required", {}, req.rrn));
    }

    const result = await pool.query(
      `INSERT INTO user_gallery (user_id, file_url, uploaded_by, uploaded_by_editor_id)
       VALUES ($1, $2, 'editor', $3)
       RETURNING id, user_id, file_url, uploaded_by, uploaded_by_editor_id, created_at`,
      [user_id, key, editor_id]
    );

    const row = result.rows[0];
    return res.json(
      apiResponse(true, "Image added to media library", {
        ...row,
        view_url: await getCachedViewUrl(row.file_url),
      }, req.rrn)
    );
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/editor/customer/:user_id/media-library/:gallery_id
// Body: { key }
// Updates an EXISTING user_gallery row's file in place — used when an
// editor re-adjusts (pans/zooms) a photo that's already placed on a board.
// A re-adjustment always produces a freshly-baked cropped image on the
// frontend, which still needs to be uploaded to storage under a new key
// (getMediaLibraryUploadUrl always mints a unique key). This endpoint takes
// that new key, points the SAME gallery row at it (so board_placements'
// gallery_id never has to change), and deletes the old file it replaces —
// so re-adjusting a crop never creates a duplicate user_gallery row or
// leaves an orphaned file behind. Use saveMediaLibraryImage instead for a
// genuinely new photo (first save for a position, or a new upload).
// ─────────────────────────────────────────────────────────────────────────────
export const updateMediaLibraryImage = async (req, res, next) => {
  try {
    const editor_id = req.user.id;
    const { user_id, gallery_id } = req.params;
    const { key } = req.body;

    const assignCheck = await pool.query(
      `SELECT id FROM editor_customer WHERE editor_id = $1 AND user_id = $2`,
      [editor_id, user_id]
    );
    if (assignCheck.rows.length === 0) {
      return res
        .status(403)
        .json(apiResponse(false, "This customer is not assigned to you", {}, req.rrn));
    }

    if (!key) {
      return res.status(400).json(apiResponse(false, "key is required", {}, req.rrn));
    }

    const existing = await pool.query(
      `SELECT id, file_url FROM user_gallery WHERE id = $1 AND user_id = $2`,
      [gallery_id, user_id]
    );
    if (existing.rows.length === 0) {
      return res
        .status(404)
        .json(apiResponse(false, "That image was not found in this customer's library", {}, req.rrn));
    }

    const oldKey = existing.rows[0].file_url;

    const result = await pool.query(
      `UPDATE user_gallery
       SET file_url = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING id, user_id, file_url, uploaded_by, uploaded_by_editor_id, created_at, updated_at`,
      [key, gallery_id, user_id]
    );

    // Clean up the file this one replaced — fire-and-forget, never blocks
    // the response. Skip if somehow the key didn't actually change.
    if (oldKey && oldKey !== key) {
      deleteFile(oldKey).catch((err) =>
        console.error(`Failed to delete superseded file ${oldKey}:`, err)
      );
    }

    const row = result.rows[0];
    return res.json(
      apiResponse(true, "Image updated", {
        ...row,
        view_url: await getCachedViewUrl(row.file_url),
      }, req.rrn)
    );
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/editor/customer/:user_id/board-placement
// Body: { board_type, position_id, gallery_id, crop_zoom?, crop_pos_x?, crop_pos_y? }
// board_type: 'vision_board' | 'achievement' | 'generation_web' | 'legacy_timeline'
// Places (or replaces) an image at a specific slot on a board. Upsert on
// (user_id, board_type, position_id) — placing a new image at an already-
// filled slot just replaces what's there.
//
// crop_zoom/crop_pos_x/crop_pos_y are optional pan/zoom transform values for
// the ALREADY-placed image. Re-adjusting an existing photo (drag/zoom, no
// new file picked) should call this with the SAME gallery_id it already has
// and just new crop numbers — it must NOT go through the media-library
// upload pipeline again, otherwise every nudge of the slider creates a new
// row in user_gallery (and a new file on disk) for what is still, visually,
// the same source photo. Only a genuinely new file picked from the editor's
// device should mint a new gallery_id.
// ─────────────────────────────────────────────────────────────────────────────
const VALID_BOARD_TYPES = [
  "vision_board",
  "achievement",
  "generation_web",
  "legacy_timeline",
];

export const placeBoardImage = async (req, res, next) => {
  try {
    const editor_id = req.user.id;
    const { user_id } = req.params;
    const { board_type, position_id, gallery_id, crop_zoom, crop_pos_x, crop_pos_y } = req.body;

    const assignCheck = await pool.query(
      `SELECT id FROM editor_customer WHERE editor_id = $1 AND user_id = $2`,
      [editor_id, user_id]
    );
    if (assignCheck.rows.length === 0) {
      return res
        .status(403)
        .json(apiResponse(false, "This customer is not assigned to you", {}, req.rrn));
    }

    if (!board_type || !position_id || !gallery_id) {
      return res
        .status(400)
        .json(apiResponse(false, "board_type, position_id and gallery_id are required", {}, req.rrn));
    }
    if (!VALID_BOARD_TYPES.includes(board_type)) {
      return res
        .status(400)
        .json(apiResponse(false, `board_type must be one of: ${VALID_BOARD_TYPES.join(", ")}`, {}, req.rrn));
    }

    // Confirm the chosen image actually belongs to this customer's library
    const imageCheck = await pool.query(
      `SELECT id, file_url FROM user_gallery WHERE id = $1 AND user_id = $2`,
      [gallery_id, user_id]
    );
    if (imageCheck.rows.length === 0) {
      return res
        .status(404)
        .json(apiResponse(false, "That image was not found in this customer's library", {}, req.rrn));
    }

    const result = await pool.query(
      `INSERT INTO board_placements
         (user_id, board_type, position_id, gallery_id, placed_by_editor_id, crop_zoom, crop_pos_x, crop_pos_y, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (user_id, board_type, position_id) DO UPDATE SET
         gallery_id           = EXCLUDED.gallery_id,
         placed_by_editor_id  = EXCLUDED.placed_by_editor_id,
         crop_zoom            = EXCLUDED.crop_zoom,
         crop_pos_x           = EXCLUDED.crop_pos_x,
         crop_pos_y           = EXCLUDED.crop_pos_y,
         updated_at           = NOW()
       RETURNING *`,
      [
        user_id,
        board_type,
        position_id,
        gallery_id,
        editor_id,
        crop_zoom ?? null,
        crop_pos_x ?? null,
        crop_pos_y ?? null,
      ]
    );

    const row = result.rows[0];
    return res.json(
      apiResponse(true, "Image placed", {
        ...row,
        view_url: await getCachedViewUrl(imageCheck.rows[0].file_url),
      }, req.rrn)
    );
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/editor/customer/:user_id/board-placements?board_type=vision_board
// Returns current placements for one board (or all boards if board_type omitted)
// ─────────────────────────────────────────────────────────────────────────────
export const getBoardPlacements = async (req, res, next) => {
  try {
    const editor_id = req.user.id;
    const { user_id } = req.params;
    const { board_type } = req.query;

    const assignCheck = await pool.query(
      `SELECT id FROM editor_customer WHERE editor_id = $1 AND user_id = $2`,
      [editor_id, user_id]
    );
    if (assignCheck.rows.length === 0) {
      return res
        .status(403)
        .json(apiResponse(false, "This customer is not assigned to you", {}, req.rrn));
    }

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
// PUT /api/editor/customer/:user_id/board-quote
// Body: { board_type, position_id, quote }
// Saves (upserts) the quote text for one board position — e.g. Vision
// Board's "Edit Content" quote for card 5. Independent of board_placements
// so a quote can be set whether or not that position has an image yet.
// ─────────────────────────────────────────────────────────────────────────────
export const saveBoardQuote = async (req, res, next) => {
  try {
    const editor_id = req.user.id;
    const { user_id } = req.params;
    const { board_type, position_id, quote } = req.body;

    const assignCheck = await pool.query(
      `SELECT id FROM editor_customer WHERE editor_id = $1 AND user_id = $2`,
      [editor_id, user_id]
    );
    if (assignCheck.rows.length === 0) {
      return res
        .status(403)
        .json(apiResponse(false, "This customer is not assigned to you", {}, req.rrn));
    }

    if (!board_type || !position_id) {
      return res
        .status(400)
        .json(apiResponse(false, "board_type and position_id are required", {}, req.rrn));
    }
    if (!VALID_BOARD_TYPES.includes(board_type)) {
      return res
        .status(400)
        .json(apiResponse(false, `board_type must be one of: ${VALID_BOARD_TYPES.join(", ")}`, {}, req.rrn));
    }

    const result = await pool.query(
      `INSERT INTO board_quotes
         (user_id, board_type, position_id, quote, updated_by_editor_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, board_type, position_id) DO UPDATE SET
         quote                = EXCLUDED.quote,
         updated_by_editor_id = EXCLUDED.updated_by_editor_id,
         updated_at           = NOW()
       RETURNING *`,
      [user_id, board_type, position_id, quote ?? "", editor_id]
    );

    return res.json(apiResponse(true, "Quote saved", result.rows[0], req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/editor/customer/:user_id/board-quotes?board_type=vision_board
// Returns saved quotes for one board (or all boards if board_type omitted)
// ─────────────────────────────────────────────────────────────────────────────
export const getBoardQuotes = async (req, res, next) => {
  try {
    const editor_id = req.user.id;
    const { user_id } = req.params;
    const { board_type } = req.query;

    const assignCheck = await pool.query(
      `SELECT id FROM editor_customer WHERE editor_id = $1 AND user_id = $2`,
      [editor_id, user_id]
    );
    if (assignCheck.rows.length === 0) {
      return res
        .status(403)
        .json(apiResponse(false, "This customer is not assigned to you", {}, req.rrn));
    }

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
// PUT /api/editor/customer/:user_id/book-pages
// Body: { page_index, left_boxes, right_boxes }
// Upserts one spread's box layout so the editor's work is saved continuously
// (autosaved from the frontend) instead of only being captured at Publish time.
// ─────────────────────────────────────────────────────────────────────────────
export const saveBookPage = async (req, res, next) => {
  try {
    const editor_id = req.user.id;
    const { user_id } = req.params;
    const { page_index, left_boxes, right_boxes } = req.body;

    const assignCheck = await pool.query(
      `SELECT id FROM editor_customer WHERE editor_id = $1 AND user_id = $2`,
      [editor_id, user_id]
    );
    if (assignCheck.rows.length === 0) {
      return res
        .status(403)
        .json(apiResponse(false, "This customer is not assigned to you", {}, req.rrn));
    }

    if (page_index === undefined || page_index === null || Number.isNaN(Number(page_index))) {
      return res
        .status(400)
        .json(apiResponse(false, "page_index is required", {}, req.rrn));
    }

    const result = await pool.query(
      `INSERT INTO book_pages
         (user_id, page_index, left_boxes, right_boxes, updated_by_editor_id, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id, page_index) DO UPDATE SET
         left_boxes           = EXCLUDED.left_boxes,
         right_boxes          = EXCLUDED.right_boxes,
         updated_by_editor_id = EXCLUDED.updated_by_editor_id,
         updated_at           = NOW()
       RETURNING *`,
      [
        user_id,
        page_index,
        JSON.stringify(left_boxes ?? []),
        JSON.stringify(right_boxes ?? []),
        editor_id,
      ]
    );

    return res.json(apiResponse(true, "Page saved", result.rows[0], req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/editor/customer/:user_id/book-pages
// Returns every saved spread for this customer's book, ordered by page_index,
// so the layout editor can rebuild its in-memory pages array on load/refresh.
// ─────────────────────────────────────────────────────────────────────────────
export const getBookPages = async (req, res, next) => {
  try {
    const editor_id = req.user.id;
    const { user_id } = req.params;

    const assignCheck = await pool.query(
      `SELECT id FROM editor_customer WHERE editor_id = $1 AND user_id = $2`,
      [editor_id, user_id]
    );
    if (assignCheck.rows.length === 0) {
      return res
        .status(403)
        .json(apiResponse(false, "This customer is not assigned to you", {}, req.rrn));
    }

    const result = await pool.query(
      `SELECT * FROM book_pages WHERE user_id = $1 ORDER BY page_index ASC`,
      [user_id]
    );

    return res.json(apiResponse(true, "Pages fetched", result.rows, req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// LOCAL-DISK FALLBACK for the flipbook PDF — useful for testing before AWS
// credentials are configured. Saves straight to backend/uploads/flipbooks
// and serves it via the existing express.static("/uploads") mount.
// ─────────────────────────────────────────────────────────────────────────────
export const pdfLocalUploader = createPdfUploader(
  path.join(__dirname_editor, "../../uploads/flipbooks")
);

// POST /api/editor/customer/:user_id/flipbook/upload-local
// multipart/form-data, field name: "pdf"
export const saveFlipbookLocal = async (req, res, next) => {
  try {
    const editor_id = req.user.id;
    const { user_id } = req.params;

    const assignCheck = await pool.query(
      `SELECT id FROM editor_customer WHERE editor_id = $1 AND user_id = $2`,
      [editor_id, user_id]
    );
    if (assignCheck.rows.length === 0) {
      return res
        .status(403)
        .json(apiResponse(false, "This customer is not assigned to you", {}, req.rrn));
    }

    if (!req.file) {
      return res
        .status(400)
        .json(apiResponse(false, "No PDF file received", {}, req.rrn));
    }

    const pdf_key = `/uploads/flipbooks/${req.file.filename}`;
    const { title } = req.body;

    const result = await pool.query(
      `INSERT INTO approved_flipbooks
         (user_id, pdf_key, pdf_file_name, storage_type, title, updated_by_editor_id, updated_at)
       VALUES ($1, $2, $3, 'local', COALESCE($4, 'My Legacy Book'), $5, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         pdf_key              = EXCLUDED.pdf_key,
         pdf_file_name        = EXCLUDED.pdf_file_name,
         storage_type         = 'local',
         title                = EXCLUDED.title,
         updated_by_editor_id = EXCLUDED.updated_by_editor_id,
         updated_at           = NOW()
       RETURNING *`,
      [user_id, pdf_key, req.file.originalname, title || null, editor_id]
    );

    return res.json(apiResponse(true, "Flipbook saved (local)", result.rows[0], req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/editor/customer/:user_id/flipbook/upload-url
// Body: { fileName, fileType }
// Returns a pre-signed S3 URL the editor can PUT the approved PDF to directly.
// ─────────────────────────────────────────────────────────────────────────────
export const getFlipbookUploadUrl = async (req, res, next) => {
  try {
    const editor_id = req.user.id;
    const { user_id } = req.params;
    const { fileName, fileType } = req.body;

    const assignCheck = await pool.query(
      `SELECT id FROM editor_customer WHERE editor_id = $1 AND user_id = $2`,
      [editor_id, user_id]
    );
    if (assignCheck.rows.length === 0) {
      return res
        .status(403)
        .json(apiResponse(false, "This customer is not assigned to you", {}, req.rrn));
    }

    if (!fileName || !fileType) {
      return res
        .status(400)
        .json(apiResponse(false, "fileName and fileType are required", {}, req.rrn));
    }

    if (fileType !== "application/pdf") {
      return res
        .status(400)
        .json(apiResponse(false, "Only PDF files are allowed", {}, req.rrn));
    }

    const folder_name = `flipbooks/${user_id}`;
    const { uploadUrl, key } = await getPdfUploadUrl({
      fileName,
      fileType,
      folder_name,
      UniqueFileName: `approved-book-${Date.now()}`,
    });

    return res.json(
      apiResponse(true, "Upload URL generated", { uploadUrl, key }, req.rrn)
    );
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/editor/customer/:user_id/flipbook
// Body: { key, fileName, title, totalPages }
// Saves (upserts) the approved PDF for this customer — this is what the user
// side flipbook page will render.
// ─────────────────────────────────────────────────────────────────────────────
export const saveFlipbook = async (req, res, next) => {
  try {
    const editor_id = req.user.id;
    const { user_id } = req.params;
    const { key, fileName, title, totalPages } = req.body;

    const assignCheck = await pool.query(
      `SELECT id FROM editor_customer WHERE editor_id = $1 AND user_id = $2`,
      [editor_id, user_id]
    );
    if (assignCheck.rows.length === 0) {
      return res
        .status(403)
        .json(apiResponse(false, "This customer is not assigned to you", {}, req.rrn));
    }

    if (!key) {
      return res
        .status(400)
        .json(apiResponse(false, "key is required", {}, req.rrn));
    }

    const result = await pool.query(
      `INSERT INTO approved_flipbooks
         (user_id, pdf_key, pdf_file_name, title, total_pages, updated_by_editor_id, updated_at)
       VALUES ($1, $2, $3, COALESCE($4, 'My Legacy Book'), COALESCE($5, 0), $6, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         pdf_key              = EXCLUDED.pdf_key,
         pdf_file_name        = EXCLUDED.pdf_file_name,
         title                = EXCLUDED.title,
         total_pages          = EXCLUDED.total_pages,
         updated_by_editor_id = EXCLUDED.updated_by_editor_id,
         updated_at           = NOW()
       RETURNING *`,
      [user_id, key, fileName || null, title || null, totalPages || 0, editor_id]
    );

    return res.json(apiResponse(true, "Flipbook saved", result.rows[0], req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/editor/customer/:user_id/flipbook/ready
// Editor confirms the customer-approved book is ready for admin to publish.
// Moves the project from "Approved" to "Ready To Publish". Requires the
// customer to have already approved (customer_approved_at set).
// ─────────────────────────────────────────────────────────────────────────────
export const markFlipbookReady = async (req, res, next) => {
  try {
    const editor_id = req.user.id;
    const { user_id } = req.params;

    const assignCheck = await pool.query(
      `SELECT id FROM editor_customer WHERE editor_id = $1 AND user_id = $2`,
      [editor_id, user_id]
    );
    if (assignCheck.rows.length === 0) {
      return res
        .status(403)
        .json(apiResponse(false, "This customer is not assigned to you", {}, req.rrn));
    }

    const bookCheck = await pool.query(
      `SELECT id, customer_approved_at FROM approved_flipbooks WHERE user_id = $1`,
      [user_id]
    );
    if (bookCheck.rows.length === 0) {
      return res
        .status(400)
        .json(apiResponse(false, "No book has been uploaded for this customer yet", {}, req.rrn));
    }
    if (!bookCheck.rows[0].customer_approved_at) {
      return res
        .status(400)
        .json(apiResponse(false, "Customer hasn't approved this book yet", {}, req.rrn));
    }

    const result = await pool.query(
      `UPDATE approved_flipbooks
       SET ready_at = NOW(), updated_by_editor_id = $2, updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [user_id, editor_id]
    );

    return res.json(apiResponse(true, "Marked as Ready To Publish", result.rows[0], req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/editor/customer/:user_id/flipbook
// Returns the approved PDF (with a viewable URL) for this customer, if any.
// ─────────────────────────────────────────────────────────────────────────────
export const getFlipbookForEditor = async (req, res, next) => {
  try {
    const editor_id = req.user.id;
    const { user_id } = req.params;

    const assignCheck = await pool.query(
      `SELECT id FROM editor_customer WHERE editor_id = $1 AND user_id = $2`,
      [editor_id, user_id]
    );
    if (assignCheck.rows.length === 0) {
      return res
        .status(403)
        .json(apiResponse(false, "This customer is not assigned to you", {}, req.rrn));
    }

    const result = await pool.query(
      `SELECT * FROM approved_flipbooks WHERE user_id = $1`,
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.json(apiResponse(true, "No flipbook uploaded yet", null, req.rrn));
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
// GET /api/editor/customer/:user_id/flipbook-notes
// Returns every per-page note the customer has written on their flipbook,
// so the editor can read them while reviewing the approved book.
// ─────────────────────────────────────────────────────────────────────────────
export const getFlipbookNotesForEditor = async (req, res, next) => {
  try {
    const editor_id = req.user.id;
    const { user_id } = req.params;

    const assignCheck = await pool.query(
      `SELECT id FROM editor_customer WHERE editor_id = $1 AND user_id = $2`,
      [editor_id, user_id]
    );
    if (assignCheck.rows.length === 0) {
      return res
        .status(403)
        .json(apiResponse(false, "This customer is not assigned to you", {}, req.rrn));
    }

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