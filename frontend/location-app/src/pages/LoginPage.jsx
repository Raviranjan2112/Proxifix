import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const user = await login(email.trim(), password);

     if (user.role === "ADMIN") {
  navigate("/admin");
} else if (user.role === "WORKER") {
  navigate("/worker");
} else {
  navigate("/customer");
}
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
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <p className="muted">
          Do not have an account? <Link to="/register">Create account</Link>
        </p>
      </section>
    </main>
  );
}
