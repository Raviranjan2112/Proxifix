import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import "dotenv/config";

import { pool } from "../src/config/db.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run seed script.");
}

import { existsSync } from "node:fs";

const seedFilePath = existsSync(resolve(import.meta.dirname, "../../database/init/002_seed_workers.sql"))
  ? resolve(import.meta.dirname, "../../database/init/002_seed_workers.sql")
  : resolve(import.meta.dirname, "../database/init/002_seed_workers.sql");

try {
  const seedSql = await readFile(seedFilePath, "utf8");
  await pool.query(seedSql);
  console.log("ProxiFix demo workers seeded successfully!");
} catch (error) {
  console.error("Error seeding workers:", error.message);
} finally {
  await pool.end();
}
