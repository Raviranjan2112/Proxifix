import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { ThemeToggle } from "../context/ThemeContext.jsx";
import { MessageSquare, Lock, Mail, LogIn, Home, UserPlus } from "lucide-react";
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
        <nav className="nav-actions auth-nav-actions">
          <Link className="auth-nav-link" to="/" title="Home">
            <Home size={16} />
            <span>Home</span>
          </Link>
          <Link className="btn btn-primary auth-nav-cta" to="/register">
            <UserPlus size={15} />
            <span>Create Account</span>
          </Link>
          <ThemeToggle />
        </nav>
      </header>

      <section className="auth-card">
        <p className="eyebrow">Welcome back</p>
        <h1>Login to ProxiFix</h1>
        <p className="muted">Access your customer or worker account.</p>

        {/* WhatsApp Instant OTP Option */}
        <div style={{ marginTop: 14, marginBottom: 18 }}>
          <button
            type="button"
            onClick={() => setShowOtpModal(true)}
            className="btn"
            style={{
              width: "100%",
              backgroundColor: "var(--primary-light)",
              border: "1.5px solid var(--primary)",
              color: "var(--primary)",
              fontWeight: "700",
              fontSize: "0.95rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "12px 16px",
              borderRadius: "var(--radius-md)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <MessageSquare size={18} />
            Login with WhatsApp OTP
          </button>
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", textAlign: "center", margin: "6px 0 0" }}>
            * Direct login is available for registered phone numbers only
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: "0.82rem",
              margin: "18px 0 14px",
            }}
          >
            <div style={{ flex: 1, height: 1, backgroundColor: "var(--border-color)" }} />
            <span style={{ padding: "0 10px", fontWeight: "600", textTransform: "uppercase" }}>
              or with password
            </span>
            <div style={{ flex: 1, height: 1, backgroundColor: "var(--border-color)" }} />
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
