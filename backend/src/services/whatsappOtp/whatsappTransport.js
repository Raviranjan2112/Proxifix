import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import qrcode from "qrcode";

export class WhatsAppTransport extends EventEmitter {
  constructor() {
    super();
    this.status = "DISCONNECTED"; // 'DISCONNECTED' | 'QR_READY' | 'CONNECTING' | 'CONNECTED'
    this.phoneNumber = null;
    this.qrCode = null; // { raw: string, dataUrl: string }
    this.client = null;
    this.isInitializing = false;
    this.sessionDir = path.resolve(process.cwd(), "data/whatsapp_session");

    if (!fs.existsSync(this.sessionDir)) {
      try {
        fs.mkdirSync(this.sessionDir, { recursive: true });
      } catch {}
    }
  }

  async initialize() {
    if (this.isInitializing || this.status === "CONNECTED") {
      return;
    }

    this.isInitializing = true;
    this.status = "CONNECTING";
    this.emit("status", this.status);

    try {
      const { BerryProtocol } = await import("berryprotocol");
      this.client = new BerryProtocol({
        sessionPath: this.sessionDir,
        printQRInTerminal: false,
      });

      this.client.on("auth.qr", async ({ value }) => {
        try {
          const dataUrl = await qrcode.toDataURL(value, {
            width: 280,
            margin: 2,
            color: { dark: "#075c31", light: "#ffffff" },
          });
          this.qrCode = { raw: value, dataUrl };
          this.status = "QR_READY";
          this.emit("qr", this.qrCode);
          this.emit("status", this.status);
        } catch (err) {
          console.error("[WhatsAppTransport] QR generation error:", err);
        }
      });

      this.client.on("connection.open", () => {
        this.status = "CONNECTED";
        this.qrCode = null;
        try {
          const rawUser = this.client.socket?.sock?.user?.id || this.client.socket?.sock?.user?.jid;
          if (rawUser) {
            this.phoneNumber = rawUser.split(":")[0].split("@")[0];
          }
        } catch {}
        console.log(`[WhatsAppTransport] 🟢 WhatsApp session connected (${this.phoneNumber || "Paired"})`);
        this.emit("status", this.status);
      });

      this.client.on("connection.close", () => {
        this.status = "DISCONNECTED";
        this.emit("status", this.status);
      });

      await this.client.init();
    } catch (err) {
      console.warn(`[WhatsAppTransport] BerryProtocol running in fallback simulation mode: ${err.message}`);
      this.status = "DISCONNECTED";
    } finally {
      this.isInitializing = false;
    }
  }

  getStatus() {
    return this.status;
  }

  getQrCode() {
    return this.qrCode;
  }

  getClientInfo() {
    return {
      status: this.status,
      phoneNumber: this.phoneNumber,
      isSimulated: this.status !== "CONNECTED",
    };
  }

  /**
   * Dispatches an OTP text message to a WhatsApp number.
   */
  async sendOtpMessage(mobile, otp) {
    const cleanMobile = String(mobile || "").replace(/[^0-9]/g, "");
    const message = `🔐 *ProxiFix Verification Code*\n\nYour 6-digit code is: *${otp}*\n\nValid for 5 minutes. Do not share this code with anyone.`;

    // If connected via real WhatsApp device
    if (this.client && this.status === "CONNECTED") {
      try {
        const jid = `${cleanMobile}@s.whatsapp.net`;
        await this.client.sendText(jid, message);
        console.log(`[WhatsAppTransport] 🚀 Real WhatsApp OTP sent to +${cleanMobile}`);
        return {
          success: true,
          delivered: true,
          simulated: false,
        };
      } catch (err) {
        console.error(`[WhatsAppTransport] Error sending WhatsApp message:`, err.message);
      }
    }

    // Fallback simulation mode (for local testing or before WhatsApp device pairing)
    console.log(`\n========================================================`);
    console.log(`[ProxiFix WhatsApp OTP] 💬 DISPATCH TO: +${cleanMobile}`);
    console.log(`[ProxiFix WhatsApp OTP] 🔑 CODE: ${otp}`);
    console.log(`[ProxiFix WhatsApp OTP] ℹ️ (Device unlinked / dev mode: use this code in UI)`);
    console.log(`========================================================\n`);

    return {
      success: true,
      delivered: true,
      simulated: true,
      otp, // Provided in development response for rapid testing
    };
  }
}

export const defaultWhatsAppTransport = new WhatsAppTransport();
