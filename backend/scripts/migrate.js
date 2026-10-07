import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import "dotenv/config";

import { pool } from "../src/config/db.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run migrations.");
}

import { existsSync } from "node:fs";

const migrationDirectory = existsSync(resolve(import.meta.dirname, "../../database/init"))
  ? resolve(import.meta.dirname, "../../database/init")
  : resolve(import.meta.dirname, "../database/init");

const migrationFiles = (await readdir(migrationDirectory))
  .filter((file) => /^\d+_.+\.sql$/.test(file) && !file.includes("_seed_"))
  .sort();

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  for (const migrationFile of migrationFiles) {
    const check = await pool.query("SELECT 1 FROM schema_migrations WHERE name = $1", [migrationFile]);
    if (check.rows.length === 0) {
      const migrationSql = await readFile(resolve(migrationDirectory, migrationFile), "utf8");
      await pool.query(migrationSql);
      await pool.query("INSERT INTO schema_migrations (name) VALUES ($1)", [migrationFile]);
      console.log(`Applied migration: ${migrationFile}`);
    } else {
      console.log(`Migration already applied: ${migrationFile}`);
    }
  }

  console.log("ProxiFix database migrations completed successfully.");
} finally {
  await pool.end();
}
