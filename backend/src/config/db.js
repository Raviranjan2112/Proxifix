import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

const isProduction = process.env.NODE_ENV === "production";
const isLocalhost = process.env.DATABASE_URL?.includes("localhost") || process.env.DATABASE_URL?.includes("127.0.0.1");

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" || (isProduction && !isLocalhost)
    ? { rejectUnauthorized: false }
    : false,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL connection error:", error);
});