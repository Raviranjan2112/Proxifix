import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const emptySummary = { total_workers: 0, pending_workers: 0, approved_workers: 0, rejected_workers: 0 };

function formatStatus(status) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [workers, setWorkers] = useState([]);
  const [serviceCounts, setServiceCounts] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [selectedService, setSelectedService] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 8, total: 0, totalPages: 1 });
  const [message, setMessage] = useState("Loading worker directory...");
  const [loadingId, setLoadingId] = useState("");

  async function loadDashboard() {
    try {
      const response = await api.get("/admin/workers", {
        params: { service: selectedService || undefined, search: search || undefined, page, limit: 8 },
      });
      const nextWorkers = response.data.workers || [];
      setWorkers(nextWorkers);
      setServiceCounts(response.data.serviceCounts || []);
      setSummary(response.data.summary || emptySummary);
      setPagination(response.data.pagination || { page: 1, limit: 8, total: 0, totalPages: 1 });
      setMessage(nextWorkers.length
        ? `${response.data.pagination?.total || nextWorkers.length} matching worker(s). Rejected workers are kept offline.`
        : "No worker accounts have been registered yet.");
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not load the worker directory. Log in as an admin.");
    }
  }

  useEffect(() => { loadDashboard(); }, [selectedService, search, page]);

  async function updateWorkerStatus(worker, status) {
    if (status === "REJECTED" && !window.confirm(`Reject ${worker.name}? They will be taken offline immediately.`)) return;

    setLoadingId(worker.id);
    setMessage("");
    try {
      const response = await api.put(`/admin/workers/${worker.id}/approval`, { status });
      setMessage(response.data.message);
      await loadDashboard();
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not update this worker.");
    } finally {
      setLoadingId("");
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const pendingWorkers = workers.filter((worker) => worker.verification_status === "PENDING");

  return (
    <main className="app-shell admin-dashboard-shell">
      <header className="topbar">
        <Link className="brand" to="/"><span className="brand-icon">P</span>ProxiFix Admin</Link>
        <nav className="nav-actions">
          <Link className="nav-link" to="/">Home</Link>
          <button className="btn btn-outline" type="button" onClick={handleLogout}>Logout</button>
        </nav>
      </header>

      <section className="dashboard-section">
        <p className="eyebrow">Administrator</p>
        <h1>Welcome, {user?.name || "Admin"}</h1>
        <p className="dashboard-intro">Review service professionals, monitor registrations by service, and keep customers safe.</p>

        <div className="dashboard-grid admin-summary-grid">
          <SummaryCard icon="👷" title="Total Workers" value={summary.total_workers} />
          <SummaryCard icon="⌛" title="Pending Approval" value={summary.pending_workers} />
          <SummaryCard icon="✅" title="Approved Workers" value={summary.approved_workers} />
          <SummaryCard icon="⛔" title="Rejected Workers" value={summary.rejected_workers} />
        </div>

        <SectionTitle eyebrow="Service overview" title="Registered workers by service" description="See exactly how many workers offer each service." />
        <div className="admin-service-grid">
          {serviceCounts.map((service) => (
            <article className="admin-service-card" key={service.id}>
              <span className="service-icon">{service.icon || "🛠️"}</span>
              <div>
                <h3>{service.name}</h3>
                <p><strong>{service.total_workers}</strong> registered</p>
                <small>{service.approved_workers} approved · {service.pending_workers} pending · {service.rejected_workers} rejected</small>
              </div>
            </article>
          ))}
        </div>

        <SectionTitle eyebrow="Verification management" title="Pending worker applications" description={message} />
        <div className="worker-grid">
          {pendingWorkers.length === 0 && <article className="worker-card"><div><h3>No pending applications</h3><p>New worker registrations will appear here for approval.</p></div></article>}
          {pendingWorkers.map((worker) => <WorkerCard key={worker.id} worker={worker} loadingId={loadingId} onUpdate={updateWorkerStatus} />)}
        </div>

        <SectionTitle eyebrow="Worker directory" title="All registered worker details" description="You can reject an approved worker here if a future issue is reported. Rejection takes them offline." />
        <div className="directory-toolbar">
          <label>
            Service type
            <select value={selectedService} onChange={(event) => { setSelectedService(event.target.value); setPage(1); }}>
              <option value="">All registered services</option>
              {serviceCounts.map((service) => <option key={service.id} value={service.name}>{service.name} ({service.total_workers})</option>)}
            </select>
          </label>
          <label className="directory-search">
            Search worker
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Name or mobile number" />
          </label>
          <p className="directory-count">Showing {workers.length} of {pagination.total} worker(s)</p>
        </div>
        <div className="admin-worker-list">
          {workers.length === 0 && <article className="worker-card"><div><h3>No workers found</h3><p>Try another service, name, or mobile number.</p></div></article>}
          {workers.map((worker) => <WorkerCard key={worker.id} worker={worker} loadingId={loadingId} onUpdate={updateWorkerStatus} compact />)}
        </div>
        {pagination.totalPages > 1 && <div className="directory-pagination">
          <button className="btn btn-outline" type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>Page {pagination.page} of {pagination.totalPages}</span>
          <button className="btn btn-primary" type="button" disabled={page === pagination.totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>}
      </section>
    </main>
  );
}

function SummaryCard({ icon, title, value }) {
  return <article className="card admin-summary-card dashboard-hover-card"><span className="service-icon">{icon}</span><h2>{title}</h2><p className="admin-stat">{value}</p></article>;
}

function SectionTitle({ eyebrow, title, description }) {
  return <div className="section-heading applications-heading"><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p className="muted">{description}</p></div>;
}

function WorkerCard({ worker, loadingId, onUpdate, compact = false }) {
  const isPending = worker.verification_status === "PENDING";
  const isRejected = worker.verification_status === "REJECTED";
  const isLoading = loadingId === worker.id;

  return (
    <article className={`worker-card ${compact ? "worker-card-wide" : ""}`}>
      <div className="worker-avatar">{worker.name?.charAt(0)?.toUpperCase() || "W"}</div>
      <div className="worker-content">
        <div className="worker-title-row"><h3>{worker.name}</h3><span className={`status-badge status-${worker.verification_status.toLowerCase()}`}>{formatStatus(worker.verification_status)}</span></div>
        <div className="worker-details">
          <p>📧 {worker.email}</p><p>📱 {worker.phone || "No phone number"}</p>
          <p>🛠️ {(worker.services || []).join(", ") || "No services selected"}</p>
          <p>💼 {worker.experience_years || 0} year(s) experience</p>
          {worker.description && <p>📝 {worker.description}</p>}
        </div>
        {!isRejected && <div className="admin-actions">
          {isPending && <button className="btn btn-primary" type="button" disabled={isLoading} onClick={() => onUpdate(worker, "APPROVED")}>Approve</button>}
          <button className="btn btn-danger" type="button" disabled={isLoading} onClick={() => onUpdate(worker, "REJECTED")}>{isLoading ? "Saving..." : "Reject & take offline"}</button>
        </div>}
      </div>
    </article>
  );
}
