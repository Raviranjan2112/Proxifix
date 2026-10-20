import { Router } from "express";
import { login, register } from "../controllers/auth.controller.js";
import {
  getCaptcha,
  sendOtp,
  verifyOtp,
  getWhatsAppStatus,
  reconnectWhatsApp,
} from "../controllers/otp.controller.js";

const router = Router();

// Standard Password Auth
router.post("/register", register);
router.post("/login", login);

// WhatsApp OTP Authentication (WA-USERAUTH Integration)
router.get("/otp/captcha", getCaptcha);
router.post("/otp/send", sendOtp);
router.post("/otp/verify", verifyOtp);

// Admin WhatsApp Device Pairing
router.get("/otp/whatsapp/status", getWhatsAppStatus);
router.post("/otp/whatsapp/reconnect", reconnectWhatsApp);

export default router;
