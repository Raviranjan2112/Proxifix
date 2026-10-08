import { pool } from "../config/db.js";

/**
 * STRIDE Security Audit Logger
 * Mitigates Repudiation by immutably logging critical actions with user, action, category, and IP.
 * 
 * Threat Categories:
 * - 'S': Spoofing (Authentication & identity events)
 * - 'T': Tampering (Integrity checks, file uploads, price locks)
 * - 'R': Repudiation (Non-repudiation audit trail, status transitions)
 * - 'I': Information Disclosure (Access to sensitive customer records)
 * - 'D': Denial of Service (Throttling / boundary alerts)
 * - 'E': Elevation of Privilege (Administrative authorization actions)
 */
export async function recordAuditLog({
  userId = null,
  userEmail = null,
  action,
  threatCategory = "R",
  details = {},
  ipAddress = null
}) {
  try {
    const query = `
      INSERT INTO audit_logs (user_id, user_email, action, threat_category, details, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;
    await pool.query(query, [
      userId,
      userEmail,
      action,
      threatCategory,
      JSON.stringify(details),
      ipAddress
    ]);
  } catch (error) {
    // Non-blocking log failure
    console.error("Audit log recording failed:", error.message);
  }
}
