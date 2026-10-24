import { useEffect, useState } from "react";
import api from "../services/api.js";
import { MessageSquare, RotateCw, X, Zap, ShieldCheck, ArrowRight } from "lucide-react";

export default function WhatsAppOtpModal({
  isOpen,
  onClose,
  initialPhone = "",
  purpose = "LOGIN", // "LOGIN" | "REGISTER"
  onSuccess,
}) {
  const [step, setStep] = useState("INPUT"); // "INPUT" | "OTP"
  const [phone, setPhone] = useState(initialPhone);
  const [captcha, setCaptcha] = useState(null);
  const [captchaCode, setCaptchaCode] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [simulatedCode, setSimulatedCode] = useState("");
  const [isNotRegistered, setIsNotRegistered] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep("INPUT");
      setPhone(initialPhone || "");
      setError("");
      setSuccessMsg("");
      setOtp("");
      setCaptchaCode("");
      setSimulatedCode("");
      setIsNotRegistered(false);
      loadCaptcha();
    }
  }, [isOpen, initialPhone]);

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown((c) => (c > 0 ? c - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  async function loadCaptcha() {
    try {
      setError("");
      const response = await api.get("/auth/otp/captcha");
      if (response.data.success) {
        setCaptcha(response.data);
      }
    } catch {
      setError("Could not load CAPTCHA challenge. Check your internet connection.");
    }
  }

  async function handleSendOtp(event) {
    if (event) event.preventDefault();
    setError("");
    setSuccessMsg("");

    let cleanPhone = phone.trim();
    if (!cleanPhone.startsWith("+")) {
      cleanPhone = `+${cleanPhone}`;
    }

    if (!/^\+[1-9]\d{7,14}$/.test(cleanPhone)) {
      setError("Enter a valid mobile number with country code, e.g. +919876543210.");
      return;
    }

    if (!captchaCode.trim()) {
      setError("Please solve the visual CAPTCHA.");
      return;
    }

    setLoading(true);

    try {
      setIsNotRegistered(false);
      const response = await api.post("/auth/otp/send", {
        mobile: cleanPhone,
        captchaId: captcha?.captchaId,
        captchaCode: captchaCode.trim(),
        purpose,
      });

      if (response.data.success) {
        setStep("OTP");
        setPhone(cleanPhone);
        setCooldown(response.data.resendCooldown || 60);
        setSuccessMsg(response.data.message || "Code sent to your WhatsApp!");

        if (response.data.simulated && response.data.devOtp) {
          setSimulatedCode(response.data.devOtp);
        }
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to send verification code.";
      setError(msg);
      if (err.response?.status === 404 || err.response?.data?.code === "USER_NOT_REGISTERED") {
        setIsNotRegistered(true);
      }
      loadCaptcha(); // Refresh CAPTCHA on error
      setCaptchaCode("");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(event) {
    if (event) event.preventDefault();
    setError("");

    if (!otp.trim() || otp.trim().length < 6) {
      setError("Enter the 6-digit code received on your WhatsApp.");
      return;
    }

    setLoading(true);

    try {
      const response = await api.post("/auth/otp/verify", {
        mobile: phone,
        otp: otp.trim(),
        purpose,
      });

      if (response.data.success) {
        if (onSuccess) {
          onSuccess(response.data);
        }
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Verification failed. Check the code.");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} style={styles.backdrop}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={styles.modal}
      >
        <div style={styles.header}>
          <div style={styles.brandBadge}>
            <MessageSquare size={22} style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <h2 style={styles.title}>
              {purpose === "LOGIN" ? "Login with WhatsApp" : "Verify WhatsApp Number"}
            </h2>
            <p style={styles.subtitle}>
              {purpose === "LOGIN"
                ? "Fast & secure direct login via your WhatsApp account."
                : "Verify your phone number with a 6-digit code."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={styles.closeBtn}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {error && <div style={styles.errorBox}>{error}</div>}
        {isNotRegistered && (
          <div style={{ marginTop: 8, marginBottom: 12, textAlign: "center", padding: "12px", background: "var(--bg-subtle)", borderRadius: 10, border: "1px dashed var(--border-color)" }}>
            <p style={{ margin: "0 0 8px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Direct OTP login is reserved for registered users.
            </p>
            <a
              href="/register"
              className="btn btn-outline"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.84rem", padding: "6px 14px", textDecoration: "none", color: "var(--primary)", borderColor: "var(--primary)" }}
            >
              <ShieldCheck size={14} /> Create a ProxiFix Account
            </a>
          </div>
        )}
        {successMsg && <div style={styles.successBox}>{successMsg}</div>}

        {/* Development Mode Hint */}
        {simulatedCode && (
          <div style={styles.simBox}>
            <span style={{ fontWeight: "bold", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Zap size={14} style={{ color: "#d97706" }} /> Dev Mode Simulation:
            </span>{" "}
            Your verification code is <code style={styles.simCode}>{simulatedCode}</code>
          </div>
        )}

        {step === "INPUT" ? (
          <form onSubmit={handleSendOtp} style={styles.form}>
            <label style={styles.label}>
              WhatsApp Mobile Number
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+919876543210"
                style={styles.input}
                autoFocus
                required
              />
              <small style={styles.hint}>Include international country code (e.g. +91, +1)</small>
            </label>

            {/* Visual Alphanumeric CAPTCHA */}
            <div style={styles.captchaSection}>
              <div style={styles.captchaLabelRow}>
                <span style={styles.label}>Visual Verification</span>
                <button
                  type="button"
                  onClick={loadCaptcha}
                  style={styles.refreshBtn}
                  title="Refresh CAPTCHA"
                >
                  <RotateCw size={13} /> Refresh
                </button>
              </div>

              {captcha?.svg ? (
                <div
                  dangerouslySetInnerHTML={{ __html: captcha.svg }}
                  style={styles.svgWrapper}
                />
              ) : (
                <div style={styles.loadingSvg}>Loading CAPTCHA...</div>
              )}

              <input
                type="text"
                value={captchaCode}
                onChange={(e) => setCaptchaCode(e.target.value.toUpperCase())}
                placeholder="Type the 5 characters above"
                maxLength={5}
                style={{ ...styles.input, textTransform: "uppercase", letterSpacing: 2, fontWeight: "bold" }}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={styles.submitBtn}
            >
              {loading ? "Sending..." : "Send Verification Code →"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} style={styles.form}>
            <p style={{ margin: "0 0 12px", color: "#475569", fontSize: "0.95rem" }}>
              Enter the 6-digit verification code sent to <strong>{phone}</strong>:
            </p>

            <label style={styles.label}>
              6-Digit Verification Code
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                style={{ ...styles.input, letterSpacing: 8, fontSize: "1.4rem", textAlign: "center", fontWeight: "bold" }}
                autoFocus
                required
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={styles.submitBtn}
            >
              {loading ? "Verifying..." : "Verify & Continue ✓"}
            </button>

            <div style={styles.footerRow}>
              <button
                type="button"
                onClick={() => setStep("INPUT")}
                style={styles.textBtn}
              >
                ← Change Number
              </button>

              <button
                type="button"
                onClick={handleSendOtp}
                disabled={cooldown > 0 || loading}
                style={{ ...styles.textBtn, opacity: cooldown > 0 ? 0.5 : 1 }}
              >
                {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend Code"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 16,
  },
  modal: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    maxWidth: 440,
    width: "100%",
    padding: "28px 24px",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
    border: "1px solid #e2e8f0",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 20,
    position: "relative",
  },
  brandBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#eaf7ec",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  title: {
    margin: 0,
    fontSize: "1.25rem",
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: "-0.02em",
  },
  subtitle: {
    margin: "4px 0 0",
    fontSize: "0.85rem",
    color: "#64748b",
  },
  closeBtn: {
    position: "absolute",
    right: 0,
    top: 0,
    background: "none",
    border: "none",
    fontSize: "1.1rem",
    color: "#94a3b8",
    cursor: "pointer",
    padding: 4,
  },
  errorBox: {
    backgroundColor: "#fee2e2",
    color: "#991b1b",
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: "0.88rem",
    marginBottom: 16,
    border: "1px solid #fecaca",
  },
  successBox: {
    backgroundColor: "#dcfce7",
    color: "#166534",
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: "0.88rem",
    marginBottom: 16,
    border: "1px solid #bbf7d0",
  },
  simBox: {
    backgroundColor: "#eff6ff",
    color: "#1e40af",
    padding: "10px 14px",
    borderRadius: 8,
    fontSize: "0.85rem",
    marginBottom: 16,
    border: "1px solid #bfdbfe",
  },
  simCode: {
    backgroundColor: "#dbeafe",
    padding: "2px 6px",
    borderRadius: 4,
    fontWeight: "bold",
    fontSize: "0.95rem",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: "0.88rem",
    fontWeight: "600",
    color: "#334155",
  },
  input: {
    padding: "11px 14px",
    borderRadius: 10,
    border: "1.5px solid #cbd5e1",
    fontSize: "0.98rem",
    outline: "none",
    transition: "border-color 0.2s",
  },
  hint: {
    fontSize: "0.78rem",
    color: "#94a3b8",
    marginTop: 2,
  },
  captchaSection: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 12,
    border: "1px solid #e2e8f0",
  },
  captchaLabelRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  refreshBtn: {
    background: "none",
    border: "none",
    color: "#075c31",
    fontSize: "0.82rem",
    fontWeight: "700",
    cursor: "pointer",
  },
  svgWrapper: {
    display: "flex",
    justifyContent: "center",
    margin: "4px 0",
  },
  loadingSvg: {
    height: 52,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#94a3b8",
    fontSize: "0.85rem",
  },
  submitBtn: {
    width: "100%",
    padding: 13,
    fontSize: "1rem",
    fontWeight: "700",
    borderRadius: 10,
    backgroundColor: "#075c31",
    color: "#ffffff",
    border: "none",
    cursor: "pointer",
    marginTop: 6,
  },
  footerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  textBtn: {
    background: "none",
    border: "none",
    color: "#075c31",
    fontSize: "0.85rem",
    fontWeight: "600",
    cursor: "pointer",
  },
};
