import pool from "../config/db/db_config.js";
import bcrypt from "bcryptjs";

export const userModel = {

  async findByEmail(email) {
    if (!email) throw new Error("Email is required");
    const query = `SELECT * FROM users WHERE email = $1 LIMIT 1`;
    const result = await pool.query(query, [email]);
    return result.rows[0];
  },

  async findByUsername(username) {
    if (!username) throw new Error("Username is required");
    const query = `SELECT * FROM users WHERE username = $1 LIMIT 1`;
    const result = await pool.query(query, [username]);
    return result.rows[0];
  },

  async insertCustomer(
    name, email, contact, industry, entityName,
    website, year, pincode, address, state, district,
    category, password, username
  ) {
    // Validate required fields
    if (!name || !email || !contact || !industry || !entityName || !year || !pincode || !address || !state || !district) {
      throw new Error("Fields missing in insertCustomer");
    }
    if (!password) throw new Error("Password is required");
    if (!username) throw new Error("Username is required");

    const role = "customer";
    const hashedPassword = await bcrypt.hash(password, 10);

    const query = `
      INSERT INTO users 
      (name, mobile, email, role, category, password, industry, "entityname", 
       website, year, pincode, address, state, district, username)
      VALUES 
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *;
    `;

    const values = [
      name, contact, email, role, category,
      hashedPassword, industry, entityName,
      website || null, year, pincode, address, state, district,
      username,
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
  },

  async getUsers(role, category = null) {
    let query = `SELECT * FROM users WHERE role = $1`;
    let values = [role];
    if (category) {
      query += ` AND category = $2`;
      values.push(category);
    }
    query += ` ORDER BY user_id DESC`;
    const result = await pool.query(query, values);
    return result.rows;
  },

  async insertEditor(name, email, phone, address, category, username, password) {
    if (!name || !email || !address || !phone || !username || !password) {
      throw new Error("Fields missing in insertEditor");
    }
    const role = "editor";
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = `
      INSERT INTO users 
      (name, mobile, email, role, category, password, industry, "entityname", 
       website, year, pincode, address, state, district, status, username)
      VALUES 
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *;
    `;
    const values = [
      name, phone, email, role, category || "msme",
      hashedPassword, "NA", "NA", null, "00", "NA", address, "NA", "NA", true, username,
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  },

};