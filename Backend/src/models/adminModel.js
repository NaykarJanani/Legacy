import pool from "../config/db/db_config.js"; // PostgreSQL connection pool

export const AdminModel = {
  /**
   * Register Admin with inline validation
   */
  async registerAdmin(data) {
    // ✅ Required fields
    if (!data.name) throw new Error("Missing required field: name");
    if (!data.email) throw new Error("Missing required field: email");
    if (!data.password) throw new Error("Missing required field: password");

    // ✅ Validate values
    if (typeof data.name !== "string" || data.name.length > 100) {
      throw new Error("Invalid name (must be string, max 100 chars)");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof data.email !== "string" || !emailRegex.test(data.email)) {
      throw new Error("Invalid email format");
    }

    if (typeof data.password !== "string" || data.password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }

    // ✅ Allowed columns only (extra fields ignored)
    const allowedColumns = ["name", "email", "password", "role", "category_id"];
    const columns = Object.keys(data).filter(col => allowedColumns.includes(col));
    const values = columns.map(col => data[col]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");

    // ✅ Secure query
    const query = `
      INSERT INTO admin (${columns.join(", ")})
      VALUES (${placeholders})
      RETURNING *;
    `;

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  /**
   * Find Admin by Email
   */
  async findByEmail(email) {
    if (!email) throw new Error("Email is required");

    const query = `SELECT * FROM admin WHERE email = $1 LIMIT 1`;
    const result = await pool.query(query, [email]);
    return result.rows[0];
  }
};
