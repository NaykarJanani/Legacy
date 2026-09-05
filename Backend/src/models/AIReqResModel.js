import createResponse from "../ChatGPT/chatGPT.js";
import getPromptSchema from "../ChatGPT/Promptschema.js";
import pool from "../config/db/db_config.js";

export const AIReqResModel = {

  /**
   * sendOpinion
   *
   * Sends a user's biography answer through the AI pipeline and saves the
   * full request/response record to the ai_req_res table.
   *
   * @param {boolean} individual_student  - Whether this is an individual record (vs group)
   * @param {string}  opinion             - The user's raw answer text
   * @param {number}  serviceId           - Chapter ID (1–11), maps to biography chapter
   * @param {string}  title               - The question text being answered
   * @param {string}  title_desc          - Sub-session label e.g. "Family & Values → Early Family Memories"
   * @param {string}  category            - User category: "msme" | "school" | "temple" | "village"
   *
   * @returns {{ ai_req_res: number, ai_json: object }}
   *   ai_req_res → the inserted row ID (stored on customer_answer.ai_req_res_id)
   *   ai_json    → the parsed GPT JSON (narrative, highlights, quote, etc.)
   */
  async sendOpinion(
    individual_student,
    opinion,
    serviceId,
    title = "",
    title_desc = "",
    category = "msme"
  ) {

    // ── 1. Input validation ───────────────────────────────────────────────────
    if (!opinion || opinion.trim() === "") {
      throw new Error("Opinion is required");
    }

    if (individual_student === undefined || individual_student === null) {
      throw new Error("individual_student is required");
    }

    // ── 2. Build prompt + schema from chapter context ─────────────────────────
    const { prompt, schema } = getPromptSchema(
      serviceId,
      opinion,
      title,
      title_desc,
      category
    );

    // ── 3. Call OpenAI ────────────────────────────────────────────────────────
    const ai_response = await createResponse(prompt, schema);

    // ── 4. Guard — if OpenAI call itself failed, don't insert a broken row ────
    if (ai_response.status === "error") {
      throw new Error(
        `OpenAI call failed: ${(ai_response.errors ?? []).join(", ")}`
      );
    }

    // ── 5. Build insert values cleanly ────────────────────────────────────────
    const values = [
      ai_response.gptId,                          // $1  api_responce_id  (VARCHAR 255)
      ai_response.type,                            // $2  type             (VARCHAR 50)
      ai_response.status,                          // $3  api_status       (VARCHAR 50)
      prompt,                                      // $4  prompt           (TEXT)
      ai_response.content,                         // $5  res_content      (TEXT)
      ai_response.match,                           // $6  json_validate_status (BOOLEAN)
      JSON.stringify(ai_response.usage   ?? {}),   // $7  token_usages     (VARCHAR 255)
      JSON.stringify(ai_response.errors  ?? []),   // $8  errors           (TEXT)
      ai_response.json                             // $9  json_data        (JSONB) — object, not stringified
        ? JSON.stringify(ai_response.json)
        : null,
      individual_student,                          // $10 individual_student (BOOLEAN)
    ];

    // ── 6. Insert into ai_req_res ─────────────────────────────────────────────
    const query = `
      INSERT INTO ai_req_res (
        api_responce_id,
        type,
        api_status,
        prompt,
        res_content,
        json_validate_status,
        token_usages,
        errors,
        json_data,
        individual_student
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id;
    `;



    try {
  console.log("api_responce_id:", values[0]?.length);
  console.log("type:", values[1]?.length);
  console.log("api_status:", values[2]?.length);
  console.log("prompt:", values[3]?.length);
  console.log("res_content:", values[4]?.length);
  console.log("token_usages:", values[6]?.length);
  console.log("errors:", values[7]?.length);
  console.log("json_data:", values[8]?.length);

  const result = await pool.query(query, values);

  return {
    ai_req_res: result.rows[0].id,
    ai_json: ai_response.json,
  };

} catch (err) {
  console.error("========== DATABASE ERROR ==========");
  console.error("Message:", err.message);
  console.error("Code:", err.code);
  console.error("Detail:", err.detail);
  console.error("Column:", err.column);
  console.error("Constraint:", err.constraint);
  console.error(err);
  console.error("====================================");

  throw err;
}
  },

};