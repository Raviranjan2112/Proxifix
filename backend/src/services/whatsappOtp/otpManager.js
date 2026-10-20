import crypto from "node:crypto";

const challenges = new Map(); // mobile -> challengeObject

setInterval(() => {
  const now = Date.now();
  for (const [mobile, c] of challenges.entries()) {
    if (now > c.expiresAt) {
      challenges.delete(mobile);
    }
  }
}, 30000);

export function generateSecureOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashOtp(otp, salt) {
  return crypto.createHash("sha256").update(`${otp}:${salt}`).digest("hex");
}

export function createOtpChallenge({ mobile, purpose = "LOGIN", metadata = {} }) {
  const rawOtp = generateSecureOtp();
  const salt = crypto.randomBytes(16).toString("hex");
  const otpHash = hashOtp(rawOtp, salt);
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min TTL

  const challenge = {
    mobile,
    otpHash,
    salt,
    expiresAt,
    remainingAttempts: 3,
    purpose,
    metadata,
    createdAt: Date.now(),
  };

  challenges.set(mobile, challenge);

  return { rawOtp, expiresAt, remainingAttempts: 3 };
}

export function verifyOtpChallenge(mobile, inputOtp) {
  if (!mobile || !inputOtp) {
    return { success: false, error: "Phone number and OTP code are required." };
  }

  const challenge = challenges.get(mobile);
  if (!challenge) {
    return { success: false, error: "No active verification request found or OTP expired." };
  }

  if (Date.now() > challenge.expiresAt) {
    challenges.delete(mobile);
    return { success: false, error: "OTP expired. Please request a new verification code." };
  }

  if (challenge.remainingAttempts <= 0) {
    challenges.delete(mobile);
    return { success: false, error: "Too many incorrect attempts. Please request a new OTP." };
  }

  const candidateHash = hashOtp(String(inputOtp).trim(), challenge.salt);
  if (candidateHash !== challenge.otpHash) {
    challenge.remainingAttempts -= 1;
    if (challenge.remainingAttempts <= 0) {
      challenges.delete(mobile);
      return { success: false, error: "Too many incorrect attempts. Challenge expired." };
    }
    return {
      success: false,
      error: `Incorrect verification code. ${challenge.remainingAttempts} attempts remaining.`,
      remainingAttempts: challenge.remainingAttempts,
    };
  }

  // Success! Invalidate challenge to prevent replay
  challenges.delete(mobile);
  return {
    success: true,
    purpose: challenge.purpose,
    metadata: challenge.metadata,
  };
}

export function clearChallenge(mobile) {
  challenges.delete(mobile);
}
