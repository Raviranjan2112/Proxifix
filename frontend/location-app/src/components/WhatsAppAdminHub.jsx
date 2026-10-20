import { useEffect, useState, useRef } from "react";
import api from "../services/api.js";

export default function WhatsAppAdminHub() {
  const [waStatus, setWaStatus] = useState({
    status: "DISCONNECTED",
    phoneNumber: null,
    isSimulated: true,
    qrDataUrl: null,
  });
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [backendError, setBackendError] = useState(null);
  const pollTimerRef = useRef(null);

  useEffect(() => {
    loadStatus();
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // When QR code is visible, poll status every 3s to auto-detect when admin scans it
  useEffect(() => {
    if (waStatus.qrDataUrl && waStatus.status !== "CONNECTED") {
      pollTimerRef.current = setInterval(() => {
        loadStatusSilent();
      }, 3000);
    } else {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    }

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [waStatus.qrDataUrl, waStatus.status]);

  async function loadStatus() {
    try {
      setLoading(true);
      const res = await api.get("/auth/otp/whatsapp/status");
      if (res.data?.success) {
        setWaStatus(res.data);
        setBackendError(null);
      }
    } catch (err) {
      console.warn("Could not load WhatsApp status:", err);
      setBackendError(
        err.response?.data?.message ||
        err.message ||
        "Backend server is offline or unreachable."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadStatusSilent() {
    try {
      const res = await api.get("/auth/otp/whatsapp/status");
      if (res.data?.success) {
        setWaStatus(res.data);
      }
    } catch {}
  }

  async function triggerPairing() {
    try {
      setLoading(true);
      setBackendError(null);
      const res = await api.post("/auth/otp/whatsapp/reconnect");
      if (res.data?.success) {
        setWaStatus({
          status: res.data.status || "QR_READY",
          phoneNumber: res.data.phoneNumber || null,
          isSimulated: res.data.isSimulated ?? false,
          qrDataUrl: res.data.qrDataUrl,
        });

        // If for some reason qrDataUrl was not ready in the response, poll immediately
        if (!res.data.qrDataUrl) {
          setTimeout(loadStatusSilent, 1200);
          setTimeout(loadStatusSilent, 2500);
        }
      }
    } catch (err) {
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        "Failed to initialize pairing. Make sure backend API is reachable.";
      setBackendError(errorMsg);
      alert("WhatsApp Pairing Error: " + errorMsg);
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    if (!window.confirm("Are you sure you want to unlink and disconnect this WhatsApp device?")) {
      return;
    }

    try {
      setDisconnecting(true);
      const res = await api.post("/auth/otp/whatsapp/disconnect");
      if (res.data?.success) {
        setWaStatus({
          status: "DISCONNECTED",
          phoneNumber: null,
          isSimulated: true,
          qrDataUrl: null,
        });
      }
    } catch (err) {
      alert("Failed to disconnect: " + (err.response?.data?.message || err.message));
    } finally {
      setDisconnecting(false);
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

      {backendError && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            padding: "14px 18px",
            borderRadius: "10px",
            marginBottom: "1.5rem",
            fontSize: "0.9rem",
            lineHeight: 1.5,
          }}
        >
          <strong>⚠️ Backend Connection Notice:</strong> {backendError}
          <div style={{ marginTop: "4px", fontSize: "0.82rem", color: "#b91c1c" }}>
            If you are running on production (Vercel), ensure your backend server is deployed and configured in <code>VITE_API_URL</code>. For local testing, verify your Express backend is running on <code>http://localhost:4000</code>.
          </div>
        </div>
      )}

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
                : waStatus.qrDataUrl
                ? "Scan QR Code"
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
              <p style={{ color: "#64748b", fontSize: "0.84rem", margin: "8px 0 16px" }}>
                Verification codes are streaming live through this WhatsApp session.
              </p>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleDisconnect}
                disabled={disconnecting}
                style={{ fontSize: "0.85rem", color: "#dc2626", borderColor: "#fca5a5" }}
              >
                {disconnecting ? "Unlinking..." : "Disconnect / Unlink Device"}
              </button>
            </div>
          ) : waStatus.qrDataUrl ? (
            <div style={{ textAlign: "center", padding: "24px 20px", background: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <div style={{ display: "inline-block", padding: "12px", background: "#ffffff", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <img
                  src={waStatus.qrDataUrl}
                  alt="WhatsApp Pairing QR Code"
                  style={{ width: 260, height: 260, display: "block", borderRadius: "8px" }}
                />
              </div>
              <div style={{ marginTop: "16px" }}>
                <p style={{ margin: "0 0 6px", fontSize: "1rem", fontWeight: "700", color: "#0f172a" }}>
                  Scan with your WhatsApp App:
                </p>
                <p style={{ margin: 0, fontSize: "0.86rem", color: "#475569", lineHeight: 1.6 }}>
                  1. Open WhatsApp on your phone.<br />
                  2. Go to <strong>Settings</strong> &gt; <strong>Linked Devices</strong> &gt; <strong>Link a Device</strong>.<br />
                  3. Point your camera at this QR code.
                </p>
              </div>

              <div style={{ marginTop: "18px", display: "flex", gap: "10px", justifyContent: "center" }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={triggerPairing}
                  disabled={loading}
                  style={{ fontSize: "0.82rem" }}
                >
                  {loading ? "Refreshing..." : "🔄 Generate New QR"}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  style={{ fontSize: "0.82rem" }}
                >
                  Cancel Pairing
                </button>
              </div>
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
                {loading ? "⏳ Connecting Socket & Generating QR..." : "📲 Connect Real WhatsApp Device"}
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
