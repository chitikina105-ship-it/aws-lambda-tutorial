import dotenv from "dotenv";
dotenv.config();

import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is missing");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 10
});

// Connection success / failure logs
pool.on("connect", () => {
  console.log("PostgreSQL connection established successfully");
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error.message);
});

// Verify connection when the application starts
try {
  await pool.query("SELECT 1");
  console.log("Database connection successful");
} catch (error) {
  console.error("Database connection failed:", error.message);
  throw error;
}

export default pool;