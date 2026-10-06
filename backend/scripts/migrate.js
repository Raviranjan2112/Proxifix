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
  for (const migrationFile of migrationFiles) {
    const migrationSql = await readFile(resolve(migrationDirectory, migrationFile), "utf8");
    await pool.query(migrationSql);
    console.log(`Applied ${migrationFile}`);
  }

  console.log("ProxiFix database migrations completed successfully.");
} finally {
  await pool.end();
}
