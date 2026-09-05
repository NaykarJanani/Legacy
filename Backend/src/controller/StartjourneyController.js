import apiResponse from "../utils/apiResponse.js";
import pool from "../config/db/db_config.js";
import { getUploadUrl, getCachedViewUrl } from "../aws/storageService.js";

// ─────────────────────────────────────────────────────────────────────────────
// Shared helper — start_journey_content now has ONE ROW PER CUSTOMER (user_id),
// not a single global row. Every read/write must be scoped by user_id or every
// school ends up sharing (and overwriting) the same content.
// ─────────────────────────────────────────────────────────────────────────────
const getOrCreateRow = async (user_id) => {
  const existing = await pool.query(
    `SELECT * FROM start_journey_content WHERE user_id = $1 LIMIT 1`,
    [user_id]
  );

  if (existing.rows.length > 0) return existing.rows[0];

  const inserted = await pool.query(
    `INSERT INTO start_journey_content (user_id) VALUES ($1) RETURNING *`,
    [user_id]
  );
  return inserted.rows[0];
};

// Editors don't own customers directly — verify this customer is actually
// assigned to the logged-in editor before letting them read/write its
// content. Same check already used by every other /customer/:user_id/... route.
const assertCustomerAssignedToEditor = async (editor_id, user_id) => {
  const assignCheck = await pool.query(
    `SELECT id FROM editor_customer WHERE editor_id = $1 AND user_id = $2`,
    [editor_id, user_id]
  );
  return assignCheck.rows.length > 0;
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/editor/customer/:user_id/start-journey/upload-url
// Body: { fileName, fileType }
// Returns a pre-signed S3 URL for the editor to upload this customer's hero
// image to. Namespaced under the customer's user_id so two customers can
// never collide on the same S3 key.
// ─────────────────────────────────────────────────────────────────────────────
export const getStartJourneyUploadUrl = async (req, res, next) => {
  try {
    const editor_id = req.user.id;
    const { user_id } = req.params;
    const { fileName, fileType } = req.body;

    if (!fileName || !fileType) {
      return res
        .status(400)
        .json(apiResponse(false, "fileName and fileType are required", {}, req.rrn));
    }

    const isAssigned = await assertCustomerAssignedToEditor(editor_id, user_id);
    if (!isAssigned) {
      return res
        .status(403)
        .json(apiResponse(false, "This customer is not assigned to you", {}, req.rrn));
    }

    const folder_name = `start-journey/${user_id}`;

    const { uploadUrl, key } = await getUploadUrl({
      fileName,
      fileType,
      folder_name,
      UniqueFileName: `hero-${Date.now()}`,
    });

    return res.json(
      apiResponse(true, "Upload URL generated", { uploadUrl, key }, req.rrn)
    );
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/editor/customer/:user_id/start-journey
// Editor-side fetch — prefill the editor form with whatever is currently
// saved for THIS customer only.
// ─────────────────────────────────────────────────────────────────────────────
export const getStartJourneyForEditor = async (req, res, next) => {
  try {
    const editor_id = req.user.id;
    const { user_id } = req.params;

    const isAssigned = await assertCustomerAssignedToEditor(editor_id, user_id);
    if (!isAssigned) {
      return res
        .status(403)
        .json(apiResponse(false, "This customer is not assigned to you", {}, req.rrn));
    }

    const row = await getOrCreateRow(user_id);

    const data = {
      ...row,
      image_url: row.image_key ? await getCachedViewUrl(row.image_key) : null,
    };

    return res.json(apiResponse(true, "Start journey content fetched", data, req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/user/start-journey
// Customer/user-side fetch — a logged-in customer only ever sees their OWN
// content, scoped by their own user id from the auth token.
// ─────────────────────────────────────────────────────────────────────────────
export const getStartJourneyForUser = async (req, res, next) => {
  try {
    const user_id = req.user.id;

    const row = await getOrCreateRow(user_id);

    const data = {
      ...row,
      image_url: row.image_key ? await getCachedViewUrl(row.image_key) : null,
    };

    return res.json(apiResponse(true, "Start journey content fetched", data, req.rrn));
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/editor/customer/:user_id/start-journey
// Body: { key?, established_label, year, experience_line1, experience_line2, quote }
// "key" is the S3 object key returned by /start-journey/upload-url — only
// send it when a new image was uploaded in this submit; omit it to keep the
// previously saved image untouched while updating just the text fields.
// Upserts the ONE row for THIS customer (creates it on first save).
// ─────────────────────────────────────────────────────────────────────────────
export const saveStartJourneyContent = async (req, res, next) => {
  try {
    const editor_id = req.user.id;
    const { user_id } = req.params;
    const {
      key,
      established_label,
      year,
      experience_line1,
      experience_line2,
      quote,
      image_scale,
      image_pos_x,
      image_pos_y,
    } = req.body;

    const isAssigned = await assertCustomerAssignedToEditor(editor_id, user_id);
    if (!isAssigned) {
      return res
        .status(403)
        .json(apiResponse(false, "This customer is not assigned to you", {}, req.rrn));
    }

    const current = await getOrCreateRow(user_id);

    const result = await pool.query(
      `UPDATE start_journey_content
       SET image_key         = COALESCE($1, image_key),
           established_label = COALESCE($2, established_label),
           year               = COALESCE($3, year),
           experience_line1   = COALESCE($4, experience_line1),
           experience_line2   = COALESCE($5, experience_line2),
           quote              = COALESCE($6, quote),
           image_scale        = COALESCE($7, image_scale),
           image_pos_x        = COALESCE($8, image_pos_x),
           image_pos_y        = COALESCE($9, image_pos_y),
           updated_by         = $10,
           updated_at         = NOW()
       WHERE id = $11
       RETURNING *`,
      [
        key ?? null,
        established_label ?? null,
        year ?? null,
        experience_line1 ?? null,
        experience_line2 ?? null,
        quote ?? null,
        image_scale ?? null,
        image_pos_x ?? null,
        image_pos_y ?? null,
        editor_id,
        current.id,
      ]
    );

    const row = result.rows[0];
    const data = {
      ...row,
      image_url: row.image_key ? await getCachedViewUrl(row.image_key) : null,
    };

    return res.json(apiResponse(true, "Start journey content saved", data, req.rrn));
  } catch (err) {
    next(err);
  }
};
