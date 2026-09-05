import pool from "../config/db/db_config.js";

export const sessionQuestionModel = {

  // ─── ADD SESSION ────────────────────────────────────────────────────────────
  // Supports both old shape { sessionName, mainPoints } 
  // and new shape { sessions: [...] }
  async addSession(sessionData) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Normalize: wrap old single-session shape into sessions array
      const sessions = sessionData.sessions
        ? sessionData.sessions
        : [{ sessionName: sessionData.sessionName, mainPoints: sessionData.mainPoints }];

      const createdIds = [];

      for (const session of sessions) {
        const { sessionName, category, mainPoints = [] } = session;

        // Insert session row
        const sessionRes = await client.query(
  `INSERT INTO session (title, category, status)
   VALUES ($1, $2, TRUE)
   RETURNING session_id`,
  [sessionName, category]
);
        const session_id = sessionRes.rows[0].session_id;
        createdIds.push(session_id);

        // Each mainPoint = Chapter
        for (const [chapterSeq, mainPoint] of mainPoints.entries()) {
          const chapterTitle = mainPoint.title;
          const subChapters  = mainPoint.subChapters ?? [];

          // Each subChapter = sub_session (the real named section)
          for (const [subSeq, subChapter] of subChapters.entries()) {
            // Title stored as "Chapter → SubChapter" so it's fully descriptive
            const subSessionTitle = `${chapterTitle} → ${subChapter.title}`;

            const subRes = await client.query(
              `INSERT INTO sub_session (session_id, seq, title, status)
               VALUES ($1, $2, $3, TRUE) RETURNING sub_session_id`,
              [session_id, chapterSeq * 100 + subSeq + 1, subSessionTitle]
            );
            const sub_session_id = subRes.rows[0].sub_session_id;

            // Each subPoint = question
            for (const subPoint of (subChapter.subPoints ?? [])) {
              await client.query(
                `INSERT INTO question (session_id, sub_session_id, question, status)
                 VALUES ($1, $2, $3, TRUE)`,
                [session_id, sub_session_id, subPoint.title]
              );
            }
          }
        }
      }

      await client.query('COMMIT');
      return { success: true, session_ids: createdIds };

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // ─── GET ALL SESSIONS ───────────────────────────────────────────────────────
  async getAllSession() {
    const client = await pool.connect();
    try {
      const sessionRes = await client.query(
        'SELECT * FROM session WHERE status = TRUE ORDER BY session_id'
      );
      const sessions = sessionRes.rows;
      if (!sessions.length) return [];

      const sessionIds = sessions.map(s => s.session_id);

      const subSessionRes = await client.query(
        `SELECT * FROM sub_session
         WHERE session_id = ANY($1) AND status = TRUE
         ORDER BY session_id, seq, sub_session_id`,
        [sessionIds]
      );
      const subSessions = subSessionRes.rows;

      const subSessionIds = subSessions.map(ss => ss.sub_session_id);
      let questions = [];
      if (subSessionIds.length) {
        const questionRes = await client.query(
          `SELECT * FROM question
           WHERE sub_session_id = ANY($1) AND status = TRUE
           ORDER BY session_id, sub_session_id, question_id`,
          [subSessionIds]
        );
        questions = questionRes.rows;
      }

      // Index questions by sub_session_id
      const questionsBySubSession = {};
      for (const q of questions) {
        if (!questionsBySubSession[q.sub_session_id]) {
          questionsBySubSession[q.sub_session_id] = [];
        }
        questionsBySubSession[q.sub_session_id].push({
          question_id: q.question_id,
          question:    q.question,
          status:      q.status,
          created_at:  q.created_at,
          updated_at:  q.updated_at,
        });
      }

      // Group sub_sessions by session_id, parse "Chapter → SubChapter" title
      const subSessionsBySession = {};
      for (const ss of subSessions) {
        if (!subSessionsBySession[ss.session_id]) {
          subSessionsBySession[ss.session_id] = [];
        }

        // Parse stored title back into chapter / subChapter parts
        const [chapterTitle = ss.title, subChapterTitle = ''] = ss.title.split(' → ');

        subSessionsBySession[ss.session_id].push({
          sub_session_id:   ss.sub_session_id,
          title:            ss.title,        // full "Chapter → SubChapter"
          chapterTitle,                       // "Chapter"
          subChapterTitle,                    // "SubChapter"
          seq:              ss.seq,
          status:           ss.status,
          created_at:       ss.created_at,
          updated_at:       ss.updated_at,
          questions:        questionsBySubSession[ss.sub_session_id] || [],
        });
      }

      // Build final result grouped as Session → Chapter → SubChapter → Questions
      const result = sessions.map(s => {
        const rawSubSessions = subSessionsBySession[s.session_id] || [];

        // Re-group sub_sessions by chapterTitle for a clean nested structure
        const chaptersMap = new Map();
        for (const ss of rawSubSessions) {
          if (!chaptersMap.has(ss.chapterTitle)) {
            chaptersMap.set(ss.chapterTitle, []);
          }
          chaptersMap.get(ss.chapterTitle).push(ss);
        }

        const mainPoints = [];
        for (const [chapterTitle, subs] of chaptersMap) {
          mainPoints.push({
            title: chapterTitle,
            subChapters: subs.map(ss => ({
              sub_session_id: ss.sub_session_id,
              title:          ss.subChapterTitle,
              questions:      ss.questions,
            })),
          });
        }

       return {
  session_id: s.session_id,
  seq:        s.seq ?? 0,
  title:      s.title,
  category:   s.category,
  status:     s.status,
  created_at: s.created_at,
  updated_at: s.updated_at,
  mainPoints,
};
      });

      return result;

    } catch (err) {
      throw err;
    } finally {
      client.release();
    }
  },

  // ─── UPDATE SESSION ─────────────────────────────────────────────────────────
  // Accepts new shape:  { sessionId, sessions: [{ sessionName, mainPoints }] }
  // Also accepts old:   { sessionId, sessionName, mainPoints }
  async updateSession(session_id, updatedData) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Normalize to sessions array
      const sessions = updatedData.sessions
        ? updatedData.sessions
        : [{ sessionName: updatedData.sessionName, mainPoints: updatedData.mainPoints }];

      // ── If multiple sessions supplied, only the first maps to session_id.
      //    Extra sessions are inserted as brand-new sessions.
      const [primarySession, ...extraSessions] = sessions;

if (!primarySession) {
  await client.query('ROLLBACK');
  throw new Error(`No session data provided for session_id ${session_id}`);
}

      // ── Update the primary session ──────────────────────────────────────────
      await _updateSingleSession(client, session_id, primarySession);

      // ── Insert any extra sessions (new rows) ────────────────────────────────
      for (const extra of extraSessions) {
        const { sessionName, mainPoints = [] } = extra;

        // Check if a session with this name already exists
        const existing = await client.query(
          'SELECT session_id FROM session WHERE title = $1 LIMIT 1',
          [sessionName]
        );

        if (existing.rows.length > 0) {
          // Update it instead of inserting a duplicate
          await _updateSingleSession(client, existing.rows[0].session_id, extra);
        } else {
          // Fresh insert
          const newSes = await client.query(
            'INSERT INTO session (title, status) VALUES ($1, TRUE) RETURNING session_id',
            [sessionName]
          );
          const newId = newSes.rows[0].session_id;
          await _insertSubSessionsForSession(client, newId, mainPoints);
        }
      }

      await client.query('COMMIT');
      return { success: true };

    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // ─── UPDATE SEQ ─────────────────────────────────────────────────────────────
  async updateSeqSession(session_id, number) {
    const result = await pool.query(
      'UPDATE session SET seq = $1 WHERE session_id = $2',
      [number, session_id]
    );
    return result.rows;
  },
};


// ═══════════════════════════════════════════════════════════════════════════════
// Private helpers (not exported)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Full replace strategy for one session:
 * 1. Update session title
 * 2. Delete all existing sub_sessions + questions
 * 3. Re-insert from submitted data
 *
 * This is simpler and safer than trying to diff IDs that are client-generated.
 */
async function _updateSingleSession(client, session_id, sessionData) {
  const { sessionName, category, mainPoints = [] } = sessionData;

if (category !== undefined) {
  await client.query(
  `UPDATE session
   SET title = $1,
       category = COALESCE($2, category),
       updated_at = NOW()
   WHERE session_id = $3`,
  [sessionName, category, session_id]
);
} else {
  await client.query(
    `UPDATE session
     SET title = $1,
         updated_at = NOW()
     WHERE session_id = $2`,
    [sessionName, session_id]
  );
}

  // 2. Delete old questions first (FK), then sub_sessions
  const subRes = await client.query(
    'SELECT sub_session_id FROM sub_session WHERE session_id = $1',
    [session_id]
  );
  const subIds = subRes.rows.map(r => r.sub_session_id);

  if (subIds.length > 0) {
    await client.query(
      'DELETE FROM question WHERE sub_session_id = ANY($1)',
      [subIds]
    );
    await client.query(
      'DELETE FROM sub_session WHERE sub_session_id = ANY($1)',
      [subIds]
    );
  }

  // 3. Re-insert from submitted data
  await _insertSubSessionsForSession(client, session_id, mainPoints);
}

/**
 * Insert all chapters → subChapters → questions for a session_id.
 * Stores title as "ChapterTitle → SubChapterTitle" for round-trip parsing.
 */
async function _insertSubSessionsForSession(client, session_id, mainPoints) {
  for (const [chapterSeq, mainPoint] of mainPoints.entries()) {
    const chapterTitle = mainPoint.title ?? '';
    const subChapters  = mainPoint.subChapters ?? [];

    for (const [subSeq, subChapter] of subChapters.entries()) {
      const subChapterTitle = subChapter.title ?? '';
      // Store combined title so getAllSession can parse it back
      const subSessionTitle = `${chapterTitle} → ${subChapterTitle}`;

      const subRes = await client.query(
        `INSERT INTO sub_session (session_id, seq, title, status, created_at, updated_at)
         VALUES ($1, $2, $3, TRUE, NOW(), NOW()) RETURNING sub_session_id`,
        [session_id, chapterSeq * 100 + subSeq + 1, subSessionTitle]
      );
      const sub_session_id = subRes.rows[0].sub_session_id;

      for (const subPoint of (subChapter.subPoints ?? [])) {
        await client.query(
          `INSERT INTO question (session_id, sub_session_id, question, status, created_at, updated_at)
           VALUES ($1, $2, $3, TRUE, NOW(), NOW())`,
          [session_id, sub_session_id, subPoint.title]
        );
      }
    }
  }
}