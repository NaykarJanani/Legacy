import pool from "../config/db/db_config.js";

export const audioModel = {

  // ── CREATE AUDIO SESSION ───────────────────────────────────────────────────
  async createAudioSession({ user_id, uploaded_by, label, total_files, notes }) {
    const result = await pool.query(
      `INSERT INTO audio_sessions
         (user_id, uploaded_by, label, total_files, notes, status)
       VALUES ($1, $2, $3, $4, $5, 'uploaded')
       RETURNING *`,
      [user_id, uploaded_by, label ?? null, total_files, notes ?? null]
    );
    return result.rows[0];
  },

  // ── CREATE TRANSCRIPT RECORD ───────────────────────────────────────────────
  async createTranscript({ audio_session_id, user_id, file_index, original_filename, local_path }) {
    const result = await pool.query(
      `INSERT INTO audio_transcripts
         (audio_session_id, user_id, file_index, original_filename, local_path, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [audio_session_id, user_id, file_index, original_filename, local_path]
    );
    return result.rows[0];
  },

  // ── SAVE WHISPER RESULT ────────────────────────────────────────────────────
  async saveTranscriptText({ transcript_id, transcript_text, whisper_response, duration_seconds }) {
    const result = await pool.query(
      `UPDATE audio_transcripts
       SET transcript_text   = $1,
           whisper_response  = $2,
           duration_seconds  = $3,
           status            = 'transcribed',
           updated_at        = NOW()
       WHERE transcript_id = $4
       RETURNING *`,
      [transcript_text, JSON.stringify(whisper_response), duration_seconds ?? null, transcript_id]
    );
    return result.rows[0];
  },

  // ── MARK TRANSCRIPT FAILED ─────────────────────────────────────────────────
  async markTranscriptFailed({ transcript_id, error_message }) {
    await pool.query(
      `UPDATE audio_transcripts
       SET status        = 'failed',
           error_message = $1,
           updated_at    = NOW()
       WHERE transcript_id = $2`,
      [error_message, transcript_id]
    );
  },

  // ── UPDATE AUDIO SESSION STATUS ────────────────────────────────────────────
  async updateSessionStatus({ audio_session_id, status }) {
    await pool.query(
      `UPDATE audio_sessions
       SET status = $1, updated_at = NOW()
       WHERE audio_session_id = $2`,
      [status, audio_session_id]
    );
  },

  // ── GET SESSION WITH TRANSCRIPTS ───────────────────────────────────────────
  async getSessionById(audio_session_id) {
    const session = await pool.query(
      `SELECT * FROM audio_sessions WHERE audio_session_id = $1`,
      [audio_session_id]
    );
    if (!session.rows[0]) return null;

    const transcripts = await pool.query(
      `SELECT * FROM audio_transcripts
       WHERE audio_session_id = $1
       ORDER BY file_index ASC`,
      [audio_session_id]
    );

    return {
      ...session.rows[0],
      transcripts: transcripts.rows,
    };
  },

  // ── GET ALL SESSIONS FOR A USER ────────────────────────────────────────────
  async getSessionsByUser(user_id) {
    const result = await pool.query(
      `SELECT
         au.*,
         COUNT(DISTINCT at.transcript_id)::int          AS transcript_count,
         COUNT(DISTINCT ama.mapped_answer_id)::int       AS mapped_answer_count,
         COUNT(DISTINCT CASE WHEN ama.editor_status = 'approved'
               THEN ama.mapped_answer_id END)::int       AS approved_count,
         COUNT(DISTINCT acd.draft_id)::int               AS draft_count,
         COUNT(DISTINCT CASE WHEN acd.status = 'approved'
               THEN acd.draft_id END)::int               AS approved_draft_count
       FROM audio_sessions au
       LEFT JOIN audio_transcripts at
         ON at.audio_session_id = au.audio_session_id
       LEFT JOIN audio_mapped_answers ama
         ON ama.audio_session_id = au.audio_session_id
       LEFT JOIN audio_chapter_drafts acd
         ON acd.audio_session_id = au.audio_session_id
       WHERE au.user_id = $1
       GROUP BY au.audio_session_id
       ORDER BY au.created_at DESC`,
      [user_id]
    );
    return result.rows;
  },

  // ══════════════════════════════════════════════════════════════════════════
  // Q/A MODE — audio_mapped_answers
  // ══════════════════════════════════════════════════════════════════════════

  // ── SAVE MAPPED ANSWERS (Q/A mode) ────────────────────────────────────────
  async saveMappedAnswers(mappings) {
    if (!mappings.length) return [];
    const client = await pool.connect();
    const inserted = [];
    try {
      await client.query("BEGIN");
      for (const m of mappings) {
        const r = await client.query(
          `INSERT INTO audio_mapped_answers
             (audio_session_id, transcript_id, user_id,
              session_id, sub_session_id, question_id, question_text,
              extracted_answer, confidence_score, confidence_label,
              source_start_time, source_end_time, editor_status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending')
           RETURNING *`,
          [
            m.audio_session_id,
            m.transcript_id,
            m.user_id,
            m.session_id         ?? null,
            m.sub_session_id     ?? null,
            m.question_id        ?? null,
            m.question_text      ?? null,
            m.extracted_answer,
            m.confidence_score   ?? 0,
            m.confidence_label   ?? "low",
            m.source_start_time  ?? null,
            m.source_end_time    ?? null,
          ]
        );
        inserted.push(r.rows[0]);
      }
      await client.query("COMMIT");
      return inserted;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  // ── GET MAPPED ANSWERS FOR EDITOR (Q/A mode) ──────────────────────────────
  async getMappedAnswers(audio_session_id) {
    const result = await pool.query(
      `SELECT
         ama.*,
         s.title  AS session_title,
         ss.title AS sub_session_title,
         at.original_filename,
         at.duration_seconds
       FROM audio_mapped_answers ama
       LEFT JOIN session s   ON s.session_id = ama.session_id
       LEFT JOIN sub_session ss ON ss.sub_session_id = ama.sub_session_id
       LEFT JOIN audio_transcripts at ON at.transcript_id = ama.transcript_id
       WHERE ama.audio_session_id = $1
       ORDER BY ama.session_id, ama.sub_session_id, ama.question_id`,
      [audio_session_id]
    );
    return result.rows;
  },

  // ── EDITOR UPDATE MAPPED ANSWER (Q/A mode) ────────────────────────────────
  async updateMappedAnswer({ mapped_answer_id, final_answer, editor_status, editor_notes }) {
    const result = await pool.query(
      `UPDATE audio_mapped_answers
       SET final_answer   = COALESCE($1, final_answer),
           editor_status  = COALESCE($2, editor_status),
           editor_notes   = COALESCE($3, editor_notes),
           updated_at     = NOW()
       WHERE mapped_answer_id = $4
       RETURNING *`,
      [final_answer ?? null, editor_status ?? null, editor_notes ?? null, mapped_answer_id]
    );
    return result.rows[0];
  },

  // ── PUBLISH APPROVED Q/A ANSWERS → customer_answer ────────────────────────
  async publishApprovedAnswers(audio_session_id) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const approved = await client.query(
        `SELECT * FROM audio_mapped_answers
         WHERE audio_session_id = $1
           AND editor_status = 'approved'
           AND question_id IS NOT NULL
           AND final_answer IS NOT NULL`,
        [audio_session_id]
      );
      const published = [];
      for (const m of approved.rows) {
        const r = await client.query(
          `INSERT INTO customer_answer
             (user_id, question_id, session_id, sub_session_id, answer)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, question_id)
           DO UPDATE SET answer = EXCLUDED.answer, updated_at = NOW()
           RETURNING customer_answer_id`,
          [m.user_id, m.question_id, m.session_id, m.sub_session_id, m.final_answer]
        );
        await client.query(
          `UPDATE audio_mapped_answers
           SET customer_answer_id = $1,
               editor_status      = 'published',
               updated_at         = NOW()
           WHERE mapped_answer_id = $2`,
          [r.rows[0].customer_answer_id, m.mapped_answer_id]
        );
        published.push(r.rows[0].customer_answer_id);
      }
      await client.query("COMMIT");
      return { published_count: published.length, customer_answer_ids: published };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  // ── FETCH QUESTIONS FOR A USER'S CATEGORY (Q/A mode) ──────────────────────
  async getQuestionSchemaForUser(user_id) {
    const result = await pool.query(
      `SELECT
         s.session_id,
         s.title       AS session_title,
         ss.sub_session_id,
         ss.title      AS sub_session_title,
         q.question_id,
         q.question
       FROM users u
       JOIN session s   ON s.category = u.category AND s.status = TRUE
       JOIN sub_session ss ON ss.session_id = s.session_id AND ss.status = TRUE
       JOIN question q  ON q.sub_session_id = ss.sub_session_id AND q.status = TRUE
       WHERE u.user_id = $1
       ORDER BY s.session_id, ss.seq, q.question_id`,
      [user_id]
    );
    return result.rows;
  },

  // ══════════════════════════════════════════════════════════════════════════
  // STORY MODE — audio_chapter_drafts
  // ══════════════════════════════════════════════════════════════════════════

  // ── SAVE CHAPTER DRAFTS (Story mode) ──────────────────────────────────────
  async saveChapterDrafts(drafts) {
    if (!drafts.length) return [];
    const client = await pool.connect();
    const inserted = [];
    try {
      await client.query("BEGIN");
      for (const d of drafts) {
        const r = await client.query(
          `INSERT INTO audio_chapter_drafts
             (audio_session_id, user_id, chapter_number,
              chapter_title, draft_content, is_placeholder, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'draft')
           RETURNING *`,
          [
            d.audio_session_id,
            d.user_id,
            d.chapter_number,
            d.chapter_title,
            d.draft_content,
            d.is_placeholder ?? false,
          ]
        );
        inserted.push(r.rows[0]);
      }
      await client.query("COMMIT");
      return inserted;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  // ── GET CHAPTER DRAFTS FOR EDITOR (Story mode) ────────────────────────────
  async getChapterDrafts(audio_session_id) {
    const result = await pool.query(
      `SELECT * FROM audio_chapter_drafts
       WHERE audio_session_id = $1
       ORDER BY chapter_number ASC`,
      [audio_session_id]
    );
    return result.rows;
  },

  // ── EDITOR UPDATE CHAPTER DRAFT (Story mode) ──────────────────────────────
  async updateChapterDraft({ draft_id, editor_content, status, editor_notes }) {
    const result = await pool.query(
      `UPDATE audio_chapter_drafts
       SET editor_content = COALESCE($1, editor_content),
           status         = COALESCE($2, status),
           editor_notes   = COALESCE($3, editor_notes),
           updated_at     = NOW()
       WHERE draft_id = $4
       RETURNING *`,
      [editor_content ?? null, status ?? null, editor_notes ?? null, draft_id]
    );
    return result.rows[0];
  },

  // ── APPROVE ALL CHAPTER DRAFTS (Story mode) ───────────────────────────────
  async approveAllDrafts(audio_session_id) {
    const result = await pool.query(
      `UPDATE audio_chapter_drafts
       SET status = 'approved', updated_at = NOW()
       WHERE audio_session_id = $1
       RETURNING *`,
      [audio_session_id]
    );
    return result.rows;
  },
};