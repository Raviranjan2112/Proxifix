import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const locationState = useLocation();
  const startingRole = new URLSearchParams(locationState.search).get("role") === "WORKER"
    ? "WORKER"
    : "CUSTOMER";

  const [services, setServices] = useState([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    role: startingRole,
    serviceCategoryId: "",
    experienceYears: 0,
    minimumCharge: 0,
  });

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const isWorker = form.role === "WORKER";

  useEffect(() => {
    async function loadServices() {
      try {
        const response = await api.get("/services");
        setServices(response.data.services || []);
      } catch {
        setMessage("Could not load service categories.");
      }
    }

    loadServices();
  }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    const phone = form.phone.trim();

    if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
      setMessage("Enter a valid mobile number with country code, for example +919876543210.");
      return;
    }

    if (isWorker && !form.serviceCategoryId) {
      setMessage("Please select your service category.");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone,
        password: form.password,
        role: form.role,
      };

      if (isWorker) {
        payload.serviceCategoryId = form.serviceCategoryId;
        payload.experienceYears = Number(form.experienceYears);
        payload.minimumCharge = Number(form.minimumCharge);
      }

      const user = await register(payload);
      navigate(user.role === "WORKER" ? "/worker" : "/customer");
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          error.message ||
          "Registration failed. Please try again."
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
          <Link className="nav-link" to="/login">Login</Link>
        </nav>
      </header>

      <section className="auth-card">
        <p className="eyebrow">Create account</p>
        <h1>Join ProxiFix</h1>
        <p className="muted">
          Customers share location only while searching. Workers share their current location only when they go online.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Full name
            <input
              name="name"
              value={form.name}
              onChange={updateField}
              placeholder="Your full name"
              required
            />
          </label>

          <label>
            Mobile number
            <input
              name="phone"
              type="tel"
              value={form.phone}
              onChange={updateField}
              placeholder="+919876543210"
              autoComplete="tel"
              required
            />
          </label>

          <label>
            Email address
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={updateField}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={updateField}
              placeholder="At least 8 characters"
              minLength="8"
              required
            />
          </label>

          <label>
            Register as
            <select name="role" value={form.role} onChange={updateField}>
              <option value="CUSTOMER">Customer</option>
              <option value="WORKER">Service Worker</option>
            </select>
          </label>

          {isWorker && (
            <>
              <label>
                Service category
                <select
                  name="serviceCategoryId"
                  value={form.serviceCategoryId}
                  onChange={updateField}
                  required
                >
                  <option value="">Choose a service</option>
                  {services.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Experience in years
                <input
                  name="experienceYears"
                  type="number"
                  min="0"
                  value={form.experienceYears}
                  onChange={updateField}
                  required
                />
              </label>

              <label>
                Starting price (₹)
                <input
                  name="minimumCharge"
                  type="number"
                  min="0"
                  value={form.minimumCharge}
                  onChange={updateField}
                  required
                />
              </label>

            </>
          )}

          {message && (
            <p className={message.includes("successfully") ? "form-success" : "form-error"}>
              {message}
            </p>
          )}

          <button className="btn btn-primary" disabled={loading} type="submit">
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="muted">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </section>
    </main>
  );
}
