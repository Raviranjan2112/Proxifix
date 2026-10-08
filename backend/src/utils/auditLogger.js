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
  ipAddress = null,
  upsert = false
}) {
  try {
    let cleanIp = ipAddress ? ipAddress.toString().split(",")[0].trim() : null;
    if (cleanIp && cleanIp.startsWith("::ffff:")) {
      cleanIp = cleanIp.replace("::ffff:", "");
    }

    // In-place update: if upsert is true and an existing log exists for this user,
    // update action, threat_category, details, IP, and timestamp instead of creating duplicate repetitive rows.
    if (upsert && (userEmail || userId || cleanIp)) {
      const updateQuery = `
        UPDATE audit_logs
        SET 
          action = $6,
          threat_category = $3,
          details = $1,
          ip_address = $2,
          created_at = NOW()
        WHERE (
          (user_email IS NOT NULL AND user_email = $4)
          OR (user_id IS NOT NULL AND user_id = $5)
          OR (user_email IS NULL AND user_id IS NULL AND ip_address = $2)
        )
        RETURNING id
      `;
      const updateResult = await pool.query(updateQuery, [
        JSON.stringify(details),
        cleanIp,
        threatCategory,
        userEmail,
        userId,
        action
      ]);

      if (updateResult.rowCount > 0) {
        return;
      }
    }

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
      cleanIp
    ]);
  } catch (error) {
    // Non-blocking log failure
    console.error("Audit log recording failed:", error.message);
  }
}
