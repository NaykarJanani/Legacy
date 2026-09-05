import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
  user: process.env.isProd == 'true' ? process.env.DB_USER_PRODUCTION:process.env.DB_USER,
  host: process.env.isProd == 'true' ? process.env.DB_HOST_PRODUCTION:process.env.DB_HOST,
  database: process.env.isProd == 'true' ? process.env.DB_NAME_PRODUCTION:process.env.DB_NAME,
  password: process.env.isProd == 'true' ? process.env.DB_PASS_PRODUCTION:process.env.DB_PASS,
  port: process.env.isProd == 'true' ? process.env.DB_PORT_PRODUCTION:process.env.DB_PORT,
  ssl: process.env.isProd == 'true' ? { rejectUnauthorized: false } : false,
});

// Test connection
(async () => {
  try {
    const client = await pool.connect();
    console.log("✅ Database connected successfully!");
    client.release();
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
  }
})();

export default pool;
