import { useEffect, useState } from "react";
import api from "../services/api.js";

export default function WhatsAppAdminHub() {
  const [waStatus, setWaStatus] = useState({
    status: "DISCONNECTED",
    phoneNumber: null,
    isSimulated: true,
    qrDataUrl: null,
  });
  const [loading, setLoading] = useState(false);
  const [testMobile, setTestMobile] = useState("+91");
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    try {
      setLoading(true);
      const res = await api.get("/auth/otp/whatsapp/status");
      if (res.data?.success) {
        setWaStatus(res.data);
      }
    } catch (err) {
      console.warn("Could not load WhatsApp status:", err);
    } finally {
      setLoading(false);
    }
  }

  async function triggerPairing() {
    try {
      setLoading(true);
      await api.post("/auth/otp/whatsapp/reconnect");
      setTimeout(loadStatus, 2000);
    } catch (err) {
      alert("Failed to initialize pairing: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleTestSend(e) {
    e.preventDefault();
    setTestResult(null);
    setTestLoading(true);

    try {
      // First get a CAPTCHA automatically for admin sandbox
      const captchaRes = await api.get("/auth/otp/captcha");
      // For admin sandbox test, send directly via backend test
      const res = await api.post("/auth/otp/send", {
        mobile: testMobile.trim(),
        captchaId: captchaRes.data?.captchaId,
        captchaCode: "ADMIN", // admin bypass or test
        purpose: "REGISTER",
      });

      setTestResult({
        success: true,
        message: res.data?.message || "Test OTP dispatched successfully!",
        data: res.data,
      });
    } catch (err) {
      setTestResult({
        success: false,
        message: err.response?.data?.message || err.message || "Failed to send test OTP.",
      });
    } finally {
      setTestLoading(false);
    }
  }

  const isConnected = waStatus.status === "CONNECTED";

  return (
    <section className="dashboard-section">
      <p className="eyebrow">Zero-Cost Communications</p>
      <h1>WhatsApp Multi-Device OTP Hub</h1>
      <p className="dashboard-intro">
        Autonomous WhatsApp socket engine powered by Berry Protocol. Dispatches high-speed 6-digit verification codes worldwide with zero SMS carrier fees.
      </p>

      {/* Summary KPI Cards */}
      <div className="dashboard-grid admin-summary-grid">
        <article className="card admin-summary-card">
          <span className="summary-icon">💬</span>
          <div className="summary-content">
            <p className="summary-title">Delivery Channel</p>
            <p className="summary-value" style={{ fontSize: "1.2rem" }}>WhatsApp Socket</p>
          </div>
        </article>

        <article className="card admin-summary-card">
          <span className="summary-icon">💰</span>
          <div className="summary-content">
            <p className="summary-title">SMS Carrier Fee</p>
            <p className="summary-value" style={{ fontSize: "1.2rem", color: "#16a34a" }}>$0.00 Forever</p>
          </div>
        </article>

        <article className="card admin-summary-card">
          <span className="summary-icon">🟢</span>
          <div className="summary-content">
            <p className="summary-title">Socket State</p>
            <p className="summary-value" style={{ fontSize: "1.1rem" }}>
              {isConnected
                ? `Connected (+${waStatus.phoneNumber || "Device"})`
                : waStatus.isSimulated
                ? "Dev Simulation Mode"
                : waStatus.status}
            </p>
          </div>
        </article>

        <article className="card admin-summary-card">
          <span className="summary-icon">🛡️</span>
          <div className="summary-content">
            <p className="summary-title">Anti-Bot Guard</p>
            <p className="summary-value" style={{ fontSize: "1.1rem" }}>Alphanumeric SVG</p>
          </div>
        </article>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "1.5rem", marginTop: "2rem" }}>
        {/* Device Pairing Card */}
        <article className="card" style={{ padding: "26px", background: "#ffffff", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#0f172a" }}>WhatsApp Device Pairing</h2>
              <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#64748b" }}>
                Pair a personal or business WhatsApp device to send live messages.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-outline"
              onClick={loadStatus}
              disabled={loading}
              style={{ fontSize: "0.82rem", padding: "6px 12px" }}
            >
              {loading ? "Checking..." : "🔄 Refresh"}
            </button>
          </div>

          {isConnected ? (
            <div style={{ textAlign: "center", padding: "36px 16px", background: "#f0fdf4", borderRadius: "12px", border: "1px solid #bbf7d0" }}>
              <div style={{ fontSize: "3.2rem", marginBottom: "10px" }}>✅</div>
              <h3 style={{ margin: 0, color: "#166534" }}>WhatsApp Session Active & Ready</h3>
              <p style={{ color: "#15803d", fontSize: "1rem", margin: "8px 0 0" }}>
                Paired Device: <strong>+{waStatus.phoneNumber || "Active"}</strong>
              </p>
              <p style={{ color: "#64748b", fontSize: "0.84rem", margin: "8px 0 0" }}>
                Verification codes are streaming live through this WhatsApp session.
              </p>
            </div>
          ) : waStatus.qrDataUrl ? (
            <div style={{ textAlign: "center", padding: "20px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <img
                src={waStatus.qrDataUrl}
                alt="WhatsApp QR Code"
                style={{ width: 230, height: 230, margin: "0 auto", borderRadius: "8px", border: "1px solid #cbd5e1" }}
              />
              <p style={{ margin: "14px 0 4px", fontSize: "0.95rem", fontWeight: "700", color: "#0f172a" }}>
                1. Open WhatsApp &gt; Linked Devices &gt; Link a Device
              </p>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b" }}>
                2. Scan this QR code to authorize OTP delivery for ProxiFix.
              </p>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "36px 16px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "2.8rem", marginBottom: "8px" }}>⚡</div>
              <h3 style={{ margin: 0, color: "#1e293b" }}>Development Simulation Mode Active</h3>
              <p style={{ color: "#64748b", fontSize: "0.88rem", margin: "10px 0 20px", lineHeight: 1.5 }}>
                In simulation mode, OTP codes are automatically shown in the UI modal and logged to the terminal for friction-free testing. You can link a real WhatsApp phone anytime!
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={triggerPairing}
                disabled={loading}
                style={{ padding: "10px 20px", fontWeight: "700" }}
              >
                {loading ? "Initializing..." : "📲 Connect Real WhatsApp Device"}
              </button>
            </div>
          )}
        </article>

        {/* Live Message Template & Defenses Card */}
        <article className="card" style={{ padding: "26px", background: "#ffffff", borderRadius: "16px", border: "1px solid #e2e8f0" }}>
          <h2 style={{ margin: "0 0 4px", fontSize: "1.25rem", color: "#0f172a" }}>WhatsApp Message Template</h2>
          <p style={{ margin: "0 0 16px", fontSize: "0.85rem", color: "#64748b" }}>
            Message format delivered to customer and worker WhatsApp devices:
          </p>

          {/* WhatsApp Chat Bubble Mockup */}
          <div style={{ background: "#efeae2", padding: "20px", borderRadius: "12px", marginBottom: "20px" }}>
            <div
              style={{
                background: "#ffffff",
                borderRadius: "8px 8px 8px 0",
                padding: "14px 18px",
                maxWidth: "300px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                fontSize: "0.92rem",
                color: "#111827",
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: "bold", color: "#075c31", marginBottom: "4px" }}>🔐 ProxiFix Verification Code</div>
              <div>Your 6-digit code is: <strong style={{ fontSize: "1.1rem", letterSpacing: 1 }}>781158</strong></div>
              <div style={{ fontSize: "0.78rem", color: "#6b7280", marginTop: "8px" }}>
                Valid for 5 minutes. Do not share this code with anyone.
              </div>
              <div style={{ textAlign: "right", fontSize: "0.7rem", color: "#9ca3af", marginTop: "4px" }}>
                12:45 PM ✓✓
              </div>
            </div>
          </div>

          <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontWeight: "700", fontSize: "0.88rem", color: "#0f172a", marginBottom: "6px" }}>
              Active Security Guardrails
            </div>
            <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.84rem", color: "#475569", lineHeight: 1.6 }}>
              <li><strong>Alphanumeric CAPTCHA:</strong> 5-character SVG challenge blocks bots</li>
              <li><strong>60-Second Cooldown:</strong> Enforces minimum interval between sends</li>
              <li><strong>Rolling Quotas:</strong> 3/15min, 5/hour, 10/day per mobile number</li>
              <li><strong>Salted Cryptographic Storage:</strong> Codes are SHA-256 hashed in memory</li>
            </ul>
          </div>
        </article>
      </div>
    </section>
  );
}
