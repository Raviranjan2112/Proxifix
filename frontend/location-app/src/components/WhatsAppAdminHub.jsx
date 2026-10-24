import { useEffect, useState, useRef } from "react";
import api from "../services/api.js";
import {
  MessageSquare,
  Coins,
  Activity,
  ShieldCheck,
  CheckCircle2,
  RotateCw,
  Smartphone,
  Zap,
  AlertTriangle,
  Lock,
  Clock,
  Sparkles,
} from "lucide-react";

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
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <MessageSquare size={16} style={{ color: "var(--primary)" }} />
        <p className="eyebrow" style={{ margin: 0 }}>Zero-Cost Communications</p>
      </div>
      <h1>WhatsApp Multi-Device OTP Hub</h1>
      <p className="dashboard-intro">
        Autonomous WhatsApp socket engine powered by Berry Protocol. Dispatches high-speed 6-digit verification codes worldwide with zero SMS carrier fees.
      </p>

      {backendError && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.25)",
            color: "#dc2626",
            padding: "14px 18px",
            borderRadius: "var(--radius-md)",
            marginBottom: "1.5rem",
            fontSize: "0.9rem",
            lineHeight: 1.5,
            display: "flex",
            alignItems: "flex-start",
            gap: "12px",
          }}
        >
          <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong>Backend Connection Notice:</strong> {backendError}
            <div style={{ marginTop: "4px", fontSize: "0.82rem", opacity: 0.9 }}>
              If you are running on production (Vercel), ensure your backend server is deployed and configured in <code>VITE_API_URL</code>. For local testing, verify your Express backend is running on <code>http://localhost:4000</code>.
            </div>
          </div>
        </div>
      )}

      {/* Summary KPI Cards in clean SaaS style */}
      <div className="dashboard-grid admin-summary-grid">
        <article className="card admin-summary-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p className="summary-title" style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0 0 6px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Delivery Channel
              </p>
              <p className="summary-value" style={{ fontSize: "1.35rem", fontWeight: "700", color: "var(--text-main)", margin: 0 }}>
                WhatsApp Socket
              </p>
            </div>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--primary-light)", display: "grid", placeItems: "center" }}>
              <MessageSquare size={19} style={{ color: "var(--primary)" }} />
            </div>
          </div>
        </article>

        <article className="card admin-summary-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p className="summary-title" style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0 0 6px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                SMS Carrier Fee
              </p>
              <p className="summary-value" style={{ fontSize: "1.35rem", fontWeight: "700", color: "#16a34a", margin: 0 }}>
                $0.00 Forever
              </p>
            </div>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(22, 163, 74, 0.12)", display: "grid", placeItems: "center" }}>
              <Coins size={19} style={{ color: "#16a34a" }} />
            </div>
          </div>
        </article>

        <article className="card admin-summary-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p className="summary-title" style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0 0 6px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Socket State
              </p>
              <p className="summary-value" style={{ fontSize: "1.2rem", fontWeight: "700", color: isConnected ? "var(--primary)" : "var(--text-main)", margin: 0 }}>
                {isConnected
                  ? `Connected (+${waStatus.phoneNumber || "Device"})`
                  : waStatus.qrDataUrl
                  ? "Scan QR Code"
                  : waStatus.isSimulated
                  ? "Dev Simulation Mode"
                  : waStatus.status}
              </p>
            </div>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: isConnected ? "var(--primary-light)" : "var(--bg-subtle)", display: "grid", placeItems: "center" }}>
              <Activity size={19} style={{ color: isConnected ? "var(--primary)" : "var(--text-muted)" }} />
            </div>
          </div>
        </article>

        <article className="card admin-summary-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p className="summary-title" style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0 0 6px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Anti-Bot Guard
              </p>
              <p className="summary-value" style={{ fontSize: "1.35rem", fontWeight: "700", color: "var(--text-main)", margin: 0 }}>
                Alphanumeric SVG
              </p>
            </div>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(124, 58, 237, 0.12)", display: "grid", placeItems: "center" }}>
              <ShieldCheck size={19} style={{ color: "#7c3aed" }} />
            </div>
          </div>
        </article>
      </div>

      <div className="whatsapp-hub-grid">
        {/* Device Pairing Card */}
        <article className="card whatsapp-hub-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.25rem" }}>WhatsApp Device Pairing</h2>
              <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>
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
              <RotateCw size={13} className={loading ? "spin-icon" : ""} />
              {loading ? "Checking..." : "Refresh"}
            </button>
          </div>

          {isConnected ? (
            <div style={{ textAlign: "center", padding: "36px 16px", background: "var(--primary-light)", borderRadius: "var(--radius-md)", border: "1px solid var(--primary-border)" }}>
              <CheckCircle2 size={48} style={{ color: "var(--primary)", margin: "0 auto 10px" }} />
              <h3 style={{ margin: 0, color: "var(--primary)" }}>WhatsApp Session Active & Ready</h3>
              <p style={{ color: "var(--primary)", fontSize: "1rem", margin: "8px 0 0" }}>
                Paired Device: <strong>+{waStatus.phoneNumber || "Active"}</strong>
              </p>
              <p style={{ color: "var(--text-muted)", fontSize: "0.84rem", margin: "8px 0 16px" }}>
                Verification codes are streaming live through this WhatsApp session.
              </p>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleDisconnect}
                disabled={disconnecting}
                style={{ fontSize: "0.85rem", color: "#dc2626", borderColor: "rgba(220, 38, 38, 0.3)" }}
              >
                {disconnecting ? "Unlinking..." : "Disconnect / Unlink Device"}
              </button>
            </div>
          ) : waStatus.qrDataUrl ? (
            <div style={{ textAlign: "center", padding: "24px 20px", background: "var(--bg-subtle)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
              <div style={{ display: "inline-block", padding: "12px", background: "#ffffff", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <img
                  src={waStatus.qrDataUrl}
                  alt="WhatsApp Pairing QR Code"
                  style={{ width: 260, height: 260, display: "block", borderRadius: "8px" }}
                />
              </div>
              <div style={{ marginTop: "16px" }}>
                <p style={{ margin: "0 0 6px", fontSize: "1rem", fontWeight: "700", color: "var(--text-main)" }}>
                  Scan with your WhatsApp App:
                </p>
                <p style={{ margin: 0, fontSize: "0.86rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
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
                  <RotateCw size={13} />
                  {loading ? "Refreshing..." : "Generate New QR"}
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
            <div style={{ textAlign: "center", padding: "36px 16px", background: "var(--bg-subtle)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--primary-light)", display: "grid", placeItems: "center", margin: "0 auto 12px" }}>
                <Zap size={24} style={{ color: "var(--primary)" }} />
              </div>
              <h3 style={{ margin: 0 }}>Development Simulation Mode Active</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.88rem", margin: "10px 0 20px", lineHeight: 1.5 }}>
                In simulation mode, OTP codes are automatically shown in the UI modal and logged to the terminal for friction-free testing. You can link a real WhatsApp phone anytime!
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={triggerPairing}
                disabled={loading}
                style={{ padding: "10px 20px", fontWeight: "700" }}
              >
                <Smartphone size={16} />
                {loading ? "Connecting Socket & Generating QR..." : "Connect Real WhatsApp Device"}
              </button>
            </div>
          )}
        </article>

        {/* Live Message Template & Defenses Card */}
        <article className="card whatsapp-hub-card">
          <h2 style={{ margin: "0 0 4px", fontSize: "1.25rem" }}>WhatsApp Message Template</h2>
          <p style={{ margin: "0 0 16px", fontSize: "0.85rem", color: "var(--text-muted)" }}>
            Message format delivered to customer and worker WhatsApp devices:
          </p>

          {/* WhatsApp Chat Bubble Mockup */}
          <div style={{ background: "var(--bg-subtle)", padding: "20px", borderRadius: "12px", marginBottom: "20px", border: "1px solid var(--border-color)" }}>
            <div
              style={{
                background: "var(--bg-surface)",
                borderRadius: "8px 8px 8px 0",
                padding: "14px 18px",
                maxWidth: "300px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                fontSize: "0.92rem",
                color: "var(--text-main)",
                lineHeight: 1.5,
                border: "1px solid var(--border-color)",
              }}
            >
              <div style={{ fontWeight: "bold", color: "var(--primary)", marginBottom: "4px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Lock size={14} /> ProxiFix Verification Code
              </div>
              <div>Your 6-digit code is: <strong style={{ fontSize: "1.1rem", letterSpacing: 1 }}>781158</strong></div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "8px" }}>
                Valid for 5 minutes. Do not share this code with anyone.
              </div>
              <div style={{ textAlign: "right", fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "4px" }}>
                12:45 PM ✓✓
              </div>
            </div>
          </div>

          <div style={{ background: "var(--bg-surface)", padding: "16px", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
            <div style={{ fontWeight: "700", fontSize: "0.88rem", color: "var(--text-main)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
              <ShieldCheck size={16} style={{ color: "var(--primary)" }} />
              Active Security Guardrails
            </div>
            <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "0.84rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
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
