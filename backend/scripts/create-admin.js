import bcrypt from "bcrypt";
import "dotenv/config";

import { pool } from "../src/config/db.js";

const email = process.env.ADMIN_EMAIL || process.argv[2] || "admin@proxifix.com";
const password = process.env.ADMIN_PASSWORD || process.argv[3] || "Admin@12345";
const name = process.env.ADMIN_NAME || process.argv[4] || "ProxiFix Administrator";
const phone = process.env.ADMIN_PHONE || process.argv[5] || "+919999999999";

try {
  const passwordHash = await bcrypt.hash(password, 12);

  const query = `
    INSERT INTO users (name, email, phone, password_hash, role)
    VALUES ($1, $2, $3, $4, 'ADMIN')
    ON CONFLICT (email)
    DO UPDATE SET
      password_hash = EXCLUDED.password_hash,
      role = 'ADMIN',
      name = EXCLUDED.name
    RETURNING id, name, email, role;
  `;

  const result = await pool.query(query, [name, email, phone, passwordHash]);
  console.log(`Admin account created / updated successfully!`);
  console.log(`Email: ${result.rows[0].email}`);
  console.log(`Password: ${password}`);
  console.log(`Role: ${result.rows[0].role}`);
} catch (error) {
  console.error("Could not create admin account:", error.message);
} finally {
  await pool.end();
}
