import { pool } from "../config/db.js";
import { recordAuditLog } from "./auditLogger.js";

// In-memory frequency trackers to detect rapid automated surges
const searchFrequencyMap = new Map(); // key: userId or IP -> array of timestamps
const failedLoginMap = new Map(); // key: email or IP -> array of timestamps

/**
 * STRIDE Security Alert & Non-Repudiation Dispatcher
 * Flags unusual activities (Spoofing, DoS, Tampering) and pushes real-time alerts to Admin.
 */
export async function triggerUnusualActivityAlert({
  userId = null,
  userEmail = null,
  anomalyType,
  threatCategory = "T",
  severity = "CRITICAL",
  description,
  details = {},
  ipAddress = null
}) {
  try {
    let cleanIp = ipAddress ? ipAddress.toString().split(",")[0].trim() : null;
    if (cleanIp && cleanIp.startsWith("::ffff:")) {
      cleanIp = cleanIp.replace("::ffff:", "");
    }

    // 1. Immutable Security Audit Log
    await recordAuditLog({
      userId,
      userEmail,
      action: "UNUSUAL_ACTIVITY_ALERT",
      threatCategory,
      details: {
        anomalyType,
        severity,
        description,
        ...details
      },
      ipAddress: cleanIp
    });

    // 2. Deliver Real-Time Notification to Admin(s)
    const adminResult = await pool.query(
      "SELECT id FROM users WHERE role = 'ADMIN' AND is_active = TRUE"
    );

    const alertPayload = {
      userId,
      userEmail,
      anomalyType,
      severity,
      description,
      details,
      ipAddress: cleanIp,
      detectedAt: new Date().toISOString()
    };

    for (const admin of adminResult.rows) {
      await pool.query(
        `
          INSERT INTO notifications (user_id, title, body, notification_type, data)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          admin.id,
          `🚨 Security Alert: ${anomalyType.replace(/_/g, " ")}`,
          `${description} (User: ${userEmail || cleanIp || "Unknown"})`,
          "SECURITY_ALERT",
          JSON.stringify(alertPayload)
        ]
      );
    }
  } catch (error) {
    console.error("Failed to trigger unusual activity alert:", error.message);
  }
}

/**
 * Detects rapid API request surge / scraper flooding (> 12 searches within 30 seconds)
 */
export function checkSearchRateAnomaly(identityKey, userEmail = null, userId = null, ipAddress = null) {
  const now = Date.now();
  const windowMs = 30 * 1000;
  const maxAllowed = 12;

  let timestamps = searchFrequencyMap.get(identityKey) || [];
  timestamps = timestamps.filter((t) => now - t < windowMs);
  timestamps.push(now);
  searchFrequencyMap.set(identityKey, timestamps);

  if (timestamps.length === maxAllowed) {
    triggerUnusualActivityAlert({
      userId,
      userEmail,
      anomalyType: "RATE_LIMIT_SURGE",
      threatCategory: "D",
      severity: "HIGH",
      description: `Rapid Search Flood Spike: ${timestamps.length} requests in 30 seconds (Potential DoS / automated scraper).`,
      details: {
        requestCount: timestamps.length,
        windowSeconds: 30,
        rateThreshold: maxAllowed
      },
      ipAddress
    });
  }
}

/**
 * Detects brute force login attacks (4+ failed attempts in 5 minutes)
 */
export function recordFailedLoginAttempt(email, ipAddress) {
  const key = email ? email.toLowerCase() : ipAddress;
  const now = Date.now();
  const windowMs = 5 * 60 * 1000;
  const maxFailed = 4;

  let attempts = failedLoginMap.get(key) || [];
  attempts = attempts.filter((t) => now - t < windowMs);
  attempts.push(now);
  failedLoginMap.set(key, attempts);

  if (attempts.length >= maxFailed) {
    triggerUnusualActivityAlert({
      userEmail: email,
      anomalyType: "BRUTE_FORCE_AUTH",
      threatCategory: "S",
      severity: "CRITICAL",
      description: `Multiple Failed Login Attempts: ${attempts.length} consecutive password failures within 5 minutes.`,
      details: {
        failedCount: attempts.length,
        emailTarget: email
      },
      ipAddress
    });
  }
}
