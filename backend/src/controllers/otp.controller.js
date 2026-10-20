import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
import { recordAuditLog } from "../utils/auditLogger.js";
import { createCaptchaChallenge, verifyCaptcha } from "../services/whatsappOtp/captcha.js";
import { checkOtpRateLimit } from "../services/whatsappOtp/rateLimiter.js";
import { createOtpChallenge, verifyOtpChallenge } from "../services/whatsappOtp/otpManager.js";
import { defaultWhatsAppTransport } from "../services/whatsappOtp/whatsappTransport.js";

function normalizePhone(raw) {
  if (!raw) return "";
  let clean = String(raw).trim();
  if (!clean.startsWith("+")) {
    clean = `+${clean.replace(/^0+/, "")}`;
  }
  return clean.replace(/[\s-]/g, "");
}

function createAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email,
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "7d",
    }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
  };
}

/**
 * GET /api/auth/otp/captcha
 * Generates a fresh visual alphanumeric CAPTCHA challenge.
 */
export async function getCaptcha(request, response) {
  try {
    const challenge = createCaptchaChallenge();
    return response.json({
      success: true,
      captchaId: challenge.captchaId,
      svg: challenge.svg,
    });
  } catch (error) {
    return response.status(500).json({ success: false, message: error.message });
  }
}

/**
 * POST /api/auth/otp/send
 * Validates CAPTCHA, checks rate limits, and sends OTP via WhatsApp.
 */
export async function sendOtp(request, response) {
  try {
    const { mobile, captchaId, captchaCode, purpose = "LOGIN" } = request.body || {};

    if (!mobile) {
      return response.status(400).json({ success: false, message: "Mobile number is required." });
    }

    const normPhone = normalizePhone(mobile);
    if (!/^\+[1-9]\d{7,14}$/.test(normPhone)) {
      return response.status(400).json({
        success: false,
        message: "Invalid mobile number. Include country code, e.g. +919876543210.",
      });
    }

    // 1. CAPTCHA verification
    const captchaCheck = verifyCaptcha(captchaId, captchaCode);
    if (!captchaCheck.success) {
      return response.status(403).json({
        success: false,
        message: captchaCheck.error,
        code: "CAPTCHA_REQUIRED",
      });
    }

    // 2. Anti-spam rate limiting
    const rateCheck = checkOtpRateLimit({
      mobile: normPhone,
      ip: request.ip,
      now: Date.now(),
    });

    if (!rateCheck.allowed) {
      response.setHeader("Retry-After", String(rateCheck.retryAfter));
      return response.status(429).json({
        success: false,
        message: rateCheck.message,
        retryAfter: rateCheck.retryAfter,
      });
    }

    // 3. Database user existence checks
    if (purpose === "LOGIN") {
      const userResult = await pool.query(
        `SELECT id, name, email, phone, role, is_active, blocked_reason FROM users WHERE phone = $1`,
        [normPhone]
      );

      if (userResult.rowCount === 0) {
        return response.status(404).json({
          success: false,
          message: "No registered account found with this phone number. Please register first.",
        });
      }

      const user = userResult.rows[0];
      if (!user.is_active) {
        return response.status(403).json({
          success: false,
          isBlocked: true,
          message: `This account has been suspended: ${user.blocked_reason || "Unusual activity."}`,
        });
      }
    } else if (purpose === "REGISTER") {
      const existingUser = await pool.query(
        `SELECT id FROM users WHERE phone = $1`,
        [normPhone]
      );

      if (existingUser.rowCount > 0) {
        return response.status(409).json({
          success: false,
          message: "This mobile number is already registered. Please log in instead.",
        });
      }
    }

    // 4. Create cryptographically secure OTP challenge
    const { rawOtp, expiresAt } = createOtpChallenge({
      mobile: normPhone,
      purpose,
    });

    // 5. Dispatch message via WhatsApp transport
    const dispatchResult = await defaultWhatsAppTransport.sendOtpMessage(normPhone, rawOtp);

    recordAuditLog({
      action: "OTP_DISPATCHED",
      threatCategory: "T",
      details: { phone: normPhone, purpose, simulated: dispatchResult.simulated },
      ipAddress: request.ip,
      upsert: false,
    });

    return response.json({
      success: true,
      message: dispatchResult.simulated
        ? "Verification code generated (development simulation mode)."
        : "Verification code sent to your WhatsApp.",
      mobile: normPhone,
      expiresIn: Math.ceil((expiresAt - Date.now()) / 1000),
      resendCooldown: 60,
      simulated: dispatchResult.simulated,
      devOtp: dispatchResult.simulated ? rawOtp : undefined,
    });
  } catch (error) {
    console.error("[sendOtp] Error:", error);
    return response.status(500).json({
      success: false,
      message: "Could not send verification code.",
    });
  }
}

/**
 * POST /api/auth/otp/verify
 * Validates submitted 6-digit code and logs the user in or returns verification token.
 */
export async function verifyOtp(request, response) {
  try {
    const { mobile, otp, purpose = "LOGIN" } = request.body || {};

    if (!mobile || !otp) {
      return response.status(400).json({
        success: false,
        message: "Mobile number and verification code are required.",
      });
    }

    const normPhone = normalizePhone(mobile);
    const verification = verifyOtpChallenge(normPhone, otp);

    if (!verification.success) {
      return response.status(400).json({
        success: false,
        message: verification.error,
        remainingAttempts: verification.remainingAttempts,
      });
    }

    if (purpose === "LOGIN") {
      const userResult = await pool.query(
        `SELECT id, name, email, phone, role, is_active, blocked_reason FROM users WHERE phone = $1`,
        [normPhone]
      );

      if (userResult.rowCount === 0) {
        return response.status(404).json({
          success: false,
          message: "User account not found.",
        });
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        return response.status(403).json({
          success: false,
          isBlocked: true,
          message: "This account has been suspended.",
        });
      }

      recordAuditLog({
        userId: user.id,
        userEmail: user.email,
        action: "USER_LOGIN_OTP_SUCCESS",
        threatCategory: "S",
        details: { role: user.role, name: user.name, phone: user.phone },
        ipAddress: request.ip,
        upsert: true,
      });

      return response.json({
        success: true,
        message: "Login successful with WhatsApp OTP.",
        token: createAccessToken(user),
        user: publicUser(user),
      });
    }

    // Registration purpose: issue a 15-minute verification token
    const verificationToken = jwt.sign(
      {
        verifiedPhone: normPhone,
        verifiedAt: Date.now(),
      },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: "15m" }
    );

    return response.json({
      success: true,
      verified: true,
      verificationToken,
      mobile: normPhone,
      message: "Phone number verified successfully via WhatsApp.",
    });
  } catch (error) {
    console.error("[verifyOtp] Error:", error);
    return response.status(500).json({
      success: false,
      message: "Could not verify code.",
    });
  }
}

/**
 * GET /api/auth/otp/whatsapp/status
 * Admin-facing endpoint to inspect WhatsApp device pairing status.
 */
export async function getWhatsAppStatus(request, response) {
  try {
    const info = defaultWhatsAppTransport.getClientInfo();
    const qr = defaultWhatsAppTransport.getQrCode();
    return response.json({
      success: true,
      status: info.status,
      phoneNumber: info.phoneNumber,
      isSimulated: info.isSimulated,
      qrDataUrl: qr?.dataUrl || null,
    });
  } catch (error) {
    return response.status(500).json({ success: false, message: error.message });
  }
}

/**
 * POST /api/auth/otp/whatsapp/reconnect
 * Admin-facing endpoint to trigger pairing QR generation.
 */
export async function reconnectWhatsApp(request, response) {
  try {
    await defaultWhatsAppTransport.initialize();
    const qr = await defaultWhatsAppTransport.waitForQrCode(3500);
    const info = defaultWhatsAppTransport.getClientInfo();
    return response.json({
      success: true,
      message: "WhatsApp socket initialization triggered.",
      status: info.status,
      phoneNumber: info.phoneNumber,
      isSimulated: info.isSimulated,
      qrDataUrl: qr?.dataUrl || null,
    });
  } catch (error) {
    return response.status(500).json({ success: false, message: error.message });
  }
}

/**
 * POST /api/auth/otp/whatsapp/disconnect
 * Admin-facing endpoint to unpair and disconnect WhatsApp device.
 */
export async function disconnectWhatsApp(request, response) {
  try {
    await defaultWhatsAppTransport.disconnect();
    return response.json({
      success: true,
      message: "WhatsApp session unlinked and disconnected.",
      status: "DISCONNECTED",
      qrDataUrl: null,
    });
  } catch (error) {
    return response.status(500).json({ success: false, message: error.message });
  }
}
