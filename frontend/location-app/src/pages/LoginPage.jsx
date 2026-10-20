import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import WhatsAppOtpModal from "../components/WhatsAppOtpModal.jsx";

export default function LoginPage() {
  const { login, loginWithSession } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);

  function handleAuthSuccess(user) {
    if (user.role === "ADMIN") {
      navigate("/admin");
    } else if (user.role === "WORKER") {
      navigate("/worker");
    } else {
      navigate("/customer");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const user = await login(email.trim(), password);
      handleAuthSuccess(user);
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          error.message ||
          "Login failed. Check your email and password."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleOtpLoginSuccess(data) {
    if (data.token && data.user) {
      loginWithSession(data.token, data.user);
      handleAuthSuccess(data.user);
    }
  }

  return (
    <main className="auth-page">
      <header className="topbar auth-topbar">
        <Link className="brand" to="/">
          <span className="brand-icon">P</span>
          ProxiFix
        </Link>
        <nav className="nav-actions">
          <Link className="nav-link" to="/">Home</Link>
          <Link className="nav-link" to="/register">Create Account</Link>
        </nav>
      </header>

      <section className="auth-card">
        <p className="eyebrow">Welcome back</p>
        <h1>Login to ProxiFix</h1>
        <p className="muted">Access your customer or worker account.</p>

        {/* 💬 WhatsApp Instant OTP Option */}
        <div style={{ marginTop: 14, marginBottom: 18 }}>
          <button
            type="button"
            onClick={() => setShowOtpModal(true)}
            className="btn"
            style={{
              width: "100%",
              backgroundColor: "#EAF7EC",
              border: "1.5px solid #25D366",
              color: "#075C31",
              fontWeight: "700",
              fontSize: "0.98rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "12px 16px",
              borderRadius: 12,
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: "1.2rem" }}>💬</span>
            Login with WhatsApp OTP (Passwordless)
          </button>
          <p style={{ fontSize: "0.78rem", color: "#64748b", textAlign: "center", margin: "6px 0 0" }}>
            * Direct login is available for registered phone numbers only
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              textAlign: "center",
              color: "#94A3B8",
              fontSize: "0.82rem",
              margin: "18px 0 14px",
            }}
          >
            <div style={{ flex: 1, height: 1, backgroundColor: "#E2E8F0" }} />
            <span style={{ padding: "0 10px", fontWeight: "600", textTransform: "uppercase" }}>
              or with password
            </span>
            <div style={{ flex: 1, height: 1, backgroundColor: "#E2E8F0" }} />
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </label>

          {message && <p className="form-error">{message}</p>}

          <button className="btn btn-primary" disabled={loading} type="submit">
            {loading ? "Logging in..." : "Login with Password"}
          </button>
        </form>

        <p className="muted">
          Do not have an account? <Link to="/register">Create account</Link>
        </p>
      </section>

      {/* WhatsApp OTP Verification Modal */}
      <WhatsAppOtpModal
        isOpen={showOtpModal}
        onClose={() => setShowOtpModal(false)}
        purpose="LOGIN"
        onSuccess={handleOtpLoginSuccess}
      />
    </main>
  );
}
