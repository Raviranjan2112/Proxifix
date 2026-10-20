import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";
import WhatsAppOtpModal from "../components/WhatsAppOtpModal.jsx";

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
    verificationToken: "",
  });

  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
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
    if (name === "phone") {
      setIsPhoneVerified(false);
      setForm((current) => ({ ...current, phone: value, verificationToken: "" }));
    } else {
      setForm((current) => ({ ...current, [name]: value }));
    }
  }

  function handleOtpVerified(data) {
    if (data.verified && data.verificationToken) {
      setForm((current) => ({
        ...current,
        phone: data.mobile,
        verificationToken: data.verificationToken,
      }));
      setIsPhoneVerified(true);
      setMessage("Mobile number verified via WhatsApp!");
    }
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
        verificationToken: form.verificationToken || undefined,
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
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <input
                name="phone"
                type="tel"
                value={form.phone}
                onChange={updateField}
                placeholder="+919876543210"
                autoComplete="tel"
                style={{ flex: 1 }}
                required
              />
              <button
                type="button"
                onClick={() => setShowOtpModal(true)}
                className="btn"
                style={{
                  backgroundColor: isPhoneVerified ? "#E8F5E9" : "#F1F8F4",
                  border: isPhoneVerified ? "1px solid #1B5E20" : "1px solid #075C31",
                  color: isPhoneVerified ? "#1B5E20" : "#075C31",
                  fontSize: "0.85rem",
                  fontWeight: "700",
                  padding: "0 14px",
                  borderRadius: 10,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                }}
              >
                {isPhoneVerified ? "✅ Verified" : "💬 Verify via WhatsApp"}
              </button>
            </div>
            {isPhoneVerified && (
              <span style={{ fontSize: "0.8rem", color: "#166534", marginTop: 4, display: "block" }}>
                ✓ Phone number verified with WhatsApp OTP
              </span>
            )}
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
            <p className={message.includes("successfully") || message.includes("verified") ? "form-success" : "form-error"}>
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

      {/* WhatsApp OTP Verification Modal */}
      <WhatsAppOtpModal
        isOpen={showOtpModal}
        onClose={() => setShowOtpModal(false)}
        initialPhone={form.phone}
        purpose="REGISTER"
        onSuccess={handleOtpVerified}
      />
    </main>
  );
}
