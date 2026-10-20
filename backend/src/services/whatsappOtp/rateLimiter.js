// In-memory rate limiter with rolling time windows

const mobileHistory = new Map(); // mobile -> Array<timestamp>
const ipHistory = new Map();     // ip -> Array<timestamp>

function pruneHistory(timestamps, windowMs, now) {
  return timestamps.filter((t) => now - t < windowMs);
}

export function checkOtpRateLimit({ mobile, ip, isResend = false, now = Date.now() }) {
  const normMobile = String(mobile || "").trim();
  const clientIp = String(ip || "unknown").trim();

  // 1. IP address check: max 30 per 15 minutes
  const ipWindowMs = 15 * 60 * 1000;
  const currentIpTimes = pruneHistory(ipHistory.get(clientIp) || [], ipWindowMs, now);
  if (currentIpTimes.length >= 30) {
    const oldest = currentIpTimes[0];
    const retryAfter = Math.ceil((oldest + ipWindowMs - now) / 1000);
    return {
      allowed: false,
      message: `Too many requests from your IP. Please retry in ${retryAfter} seconds.`,
      retryAfter,
    };
  }

  // 2. Mobile cooldown: 60s cooldown between dispatches
  const mobileTimes = pruneHistory(mobileHistory.get(normMobile) || [], 24 * 60 * 60 * 1000, now);
  if (mobileTimes.length > 0) {
    const lastSend = mobileTimes[mobileTimes.length - 1];
    const cooldownMs = 60 * 1000;
    if (now - lastSend < cooldownMs) {
      const waitSeconds = Math.ceil((lastSend + cooldownMs - now) / 1000);
      return {
        allowed: false,
        message: `Please wait ${waitSeconds}s before requesting a new code.`,
        retryAfter: waitSeconds,
      };
    }
  }

  // 3. 15-minute quota: max 3
  const times15m = pruneHistory(mobileTimes, 15 * 60 * 1000, now);
  if (times15m.length >= 3) {
    const retryAfter = Math.ceil((times15m[0] + 15 * 60 * 1000 - now) / 1000);
    return {
      allowed: false,
      message: `Max OTP requests reached for this phone number. Please retry in ${retryAfter} seconds.`,
      retryAfter,
    };
  }

  // 4. 1-hour quota: max 5
  const times1h = pruneHistory(mobileTimes, 60 * 60 * 1000, now);
  if (times1h.length >= 5) {
    const retryAfter = Math.ceil((times1h[0] + 60 * 60 * 1000 - now) / 1000);
    return {
      allowed: false,
      message: `Hourly OTP limit exceeded for this number. Please retry in ${retryAfter} seconds.`,
      retryAfter,
    };
  }

  // Record dispatch
  currentIpTimes.push(now);
  ipHistory.set(clientIp, currentIpTimes);

  mobileTimes.push(now);
  mobileHistory.set(normMobile, mobileTimes);

  return { allowed: true, resendCooldown: 60 };
}
