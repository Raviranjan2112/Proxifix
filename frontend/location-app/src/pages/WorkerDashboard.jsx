import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api.js";
import ServiceTrackingMap from "../components/ServiceTrackingMap.jsx";
import { getCurrentLocation } from "../hooks/useCurrentLocation.js";
import { useAuth } from "../context/AuthContext.jsx";

const nextStatus = {
  PENDING: { label: "Accept booking", value: "ACCEPTED" },
  ACCEPTED: { label: "Start travelling", value: "ARRIVING" },
  ARRIVING: { label: "Start service", value: "STARTED" },
  STARTED: { label: "Mark completed", value: "COMPLETED" },
};

export default function WorkerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [worker, setWorker] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [completionFiles, setCompletionFiles] = useState({});
  const [message, setMessage] = useState("Loading your worker profile...");
  const [loading, setLoading] = useState(false);
  const lastTrackingSentAt = useRef(0);

  async function loadDashboard() {
    try {
      const [workerResponse, bookingsResponse, notificationsResponse] = await Promise.all([
        api.get("/workers/me"),
        api.get("/bookings"),
        api.get("/notifications"),
      ]);

      setWorker(
        workerResponse.data.worker ||
          workerResponse.data.data ||
          workerResponse.data
      );

      setBookings(bookingsResponse.data.bookings || []);
      setNotifications(notificationsResponse.data.notifications || []);
      setMessage("");
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Could not load worker dashboard. Check the backend server."
      );
    }
  }

  useEffect(() => {
    loadDashboard();

    const refreshInterval = window.setInterval(loadDashboard, 30000);
    return () => window.clearInterval(refreshInterval);
  }, []);

  const travellingBookingId = bookings.find(
    (booking) => booking.booking_status === "ARRIVING" && !booking.arrived_at
  )?.id;

  useEffect(() => {
    if (!travellingBookingId || !navigator.geolocation) {
      return undefined;
    }

    let active = true;

    async function shareLiveLocation(position) {
      const now = Date.now();

      if (!active || now - lastTrackingSentAt.current < 15000) {
        return;
      }

      lastTrackingSentAt.current = now;

      try {
        const response = await api.put(`/bookings/${travellingBookingId}/tracking-location`, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        });

        const tracking = response.data.tracking;
        setBookings((currentBookings) => currentBookings.map((booking) => (
          booking.id === travellingBookingId
            ? {
              ...booking,
              worker_latitude: tracking.worker_latitude,
              worker_longitude: tracking.worker_longitude,
              distance_km: Number(tracking.distance_meters) / 1000,
              eta_minutes: tracking.eta_minutes,
            }
            : booking
        )));
      } catch (error) {
        console.warn("Live booking location could not be updated.", error);
      }
    }

    const watchId = navigator.geolocation.watchPosition(
      shareLiveLocation,
      (error) => console.warn("Live location tracking stopped.", error),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );

    return () => {
      active = false;
      navigator.geolocation.clearWatch(watchId);
    };
  }, [travellingBookingId]);

  async function changeOnlineStatus() {
    if (!worker) return;

    const shouldGoOnline = !worker.onlineStatus;

    if (worker.verificationStatus !== "APPROVED") {
      setMessage("Your account must be approved before you can go online.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      if (shouldGoOnline) {
        setMessage("Detecting your current location before going online...");
        const location = await getCurrentLocation({
          maximumAge: 0,
          enableHighAccuracy: true,
        });

        await api.put("/workers/status", {
          onlineStatus: true,
          availabilityStatus: "AVAILABLE",
          latitude: location.latitude,
          longitude: location.longitude,
          accuracyMeters: location.accuracy,
        });
      } else {
        await api.put("/workers/status", {
          onlineStatus: false,
          availabilityStatus: "OFFLINE",
        });
      }

      await loadDashboard();
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          error.message ||
          "Could not update your availability."
      );
    } finally {
      setLoading(false);
    }
  }

  async function updateBookingStatus(bookingId, status) {
    setLoading(true);
    setMessage("");

    try {
      const response = await api.put(`/bookings/${bookingId}/status`, { status });
      await loadDashboard();
      setMessage(response.data.message || "Booking updated successfully.");
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Could not update this booking."
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmArrival(bookingId) {
    setLoading(true);
    setMessage("");

    try {
      const location = await getCurrentLocation({ maximumAge: 0, enableHighAccuracy: true });
      const response = await api.post(`/bookings/${bookingId}/arrival`, {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracyMeters: location.accuracy,
      });
      await loadDashboard();
      setMessage(response.data.message || "Arrival confirmed. The customer has been notified.");
    } catch (error) {
      setMessage(error.response?.data?.message || error.message || "Could not confirm arrival.");
    } finally {
      setLoading(false);
    }
  }

  async function uploadCompletionPhoto(bookingId) {
    const photo = completionFiles[bookingId];

    if (!photo) {
      setMessage("Choose a JPG, PNG, or WebP completion photo first.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("photo", photo);
      const response = await api.post(`/bookings/${bookingId}/completion-photo`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setCompletionFiles((current) => ({ ...current, [bookingId]: undefined }));
      setMessage(response.data.message);
      await loadDashboard();
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not upload the completion photo.");
    } finally {
      setLoading(false);
    }
  }

  async function markNotificationsRead() {
    try {
      await api.put("/notifications/read");
      setNotifications((current) => current.map((notification) => ({ ...notification, is_read: true })));
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not update notifications.");
    }
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const approved = worker?.verificationStatus === "APPROVED";
  const online = Boolean(worker?.onlineStatus);
  const unreadNotifications = notifications.filter((notification) => !notification.is_read);
  const activeBookingStatuses = ["PENDING", "ACCEPTED", "ARRIVING", "STARTED"];
  const incomingBookings = bookings.filter((booking) => activeBookingStatuses.includes(booking.booking_status));
  const completedAndClosedBookings = bookings.filter((booking) => !activeBookingStatuses.includes(booking.booking_status));
  const apiOrigin = (api.defaults.baseURL || "").replace(/\/api\/?$/, "");
  const messageClass = /could not|must|cannot|denied|within 100 m|choose a/i.test(message)
    ? "form-error"
    : "form-success";

  function completionPhotoUrl(path) {
    return path ? `${apiOrigin}${path}` : "";
  }

  function navigationUrl(booking) {
    const destination = `${booking.customer_latitude},${booking.customer_longitude}`;
    const origin = `${booking.worker_latitude},${booking.worker_longitude}`;
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
  }

  return (
    <main className="app-shell worker-dashboard-shell">
      <header className="topbar">
        <Link className="brand" to="/">
          <span className="brand-icon">P</span>
          ProxiFix
        </Link>

        <nav className="nav-actions">
          <Link className="nav-link" to="/">Home</Link>
          <button className="btn btn-outline" type="button" onClick={handleLogout}>
            Logout
          </button>
        </nav>
      </header>

      <section className="dashboard-section">
        <p className="eyebrow">Worker dashboard</p>
        <h1>Welcome, {user?.name || "Worker"}</h1>
        <p className="dashboard-intro">
          Control your availability and manage your service requests.
        </p>

        {message && <p className={messageClass}>{message}</p>}

        {notifications.length > 0 && (
          <section className="notification-panel" aria-live="polite">
            <div className="notification-heading">
              <div>
                <p className="eyebrow">Service updates</p>
                <h2>Notifications {unreadNotifications.length > 0 && <span className="notification-count">{unreadNotifications.length}</span>}</h2>
              </div>
              {unreadNotifications.length > 0 && <button className="btn btn-outline small-button" type="button" onClick={markNotificationsRead}>Mark all read</button>}
            </div>
            <div className="notification-list">
              {notifications.slice(0, 4).map((notification) => (
                <article className={`notification-item ${notification.is_read ? "" : "notification-unread"}`.trim()} key={notification.id}>
                  <strong>{notification.title}</strong>
                  <p>{notification.body}</p>
                  <small>{new Date(notification.created_at).toLocaleString()}</small>
                </article>
              ))}
            </div>
          </section>
        )}

        <div className="dashboard-grid">
          <article className="card dashboard-hover-card">
            <span className="service-icon">✅</span>
            <h2>Verification Status</h2>
            <p>
              Status:{" "}
              <strong>{worker?.verificationStatus || "PENDING"}</strong>
            </p>
            <p className="muted">
              {approved
                ? "Your account is approved and can receive jobs."
                : "An administrator must approve your account first."}
            </p>
          </article>

          <article className="card dashboard-hover-card">
            <span className="service-icon">🟢</span>
            <h2>Availability</h2>
            <p>
              {online
                ? "You are online and visible to nearby customers."
                : "You are offline. Your current location will be detected when you go online."}
            </p>

            <button
              className="btn btn-primary"
              type="button"
              disabled={!approved || loading}
              onClick={changeOnlineStatus}
            >
              {loading
                ? "Updating..."
                : online
                  ? "Go Offline"
                  : approved
                    ? "Detect location & go online"
                    : "Waiting for Approval"}
            </button>
          </article>

          <article className="card dashboard-hover-card">
            <span className="service-icon">⭐</span>
            <h2>My Rating</h2>
            <p>
              <strong>
                {Number(worker?.rating || 0).toFixed(1)} / 5.0
              </strong>
            </p>
            <p className="muted">
              Based on {worker?.totalReviews || 0} customer reviews.
            </p>
          </article>
        </div>

        <div className="worker-job-sections">
        <section className="worker-results worker-job-panel">
          <h2>Incoming jobs</h2>
          <p className="muted">
            Active customer requests that need your attention.
          </p>

          <div className="worker-job-scroll">
            <div className="worker-grid">
            {incomingBookings.length === 0 && (
              <article className="worker-card">
                <div>
                  <h3>No jobs yet</h3>
                  <p>Go online after approval to receive nearby bookings.</p>
                </div>
              </article>
            )}

            {incomingBookings.map((booking) => {
              const needsArrivalConfirmation = booking.booking_status === "ARRIVING" && !booking.arrived_at;
              const action = ["PENDING", "ACCEPTED"].includes(booking.booking_status)
                ? nextStatus[booking.booking_status]
                : null;
              const hasMapCoordinates = booking.customer_latitude !== null
                && booking.customer_latitude !== undefined
                && booking.customer_longitude !== null
                && booking.customer_longitude !== undefined;

              return (
                <article className="worker-card" key={booking.id}>
                  <div className="worker-avatar">📋</div>

                  <div>
                    <h3>{booking.service_name || "Service request"}</h3>
                    <p><strong>Customer:</strong> {booking.customer_name || "Customer"}</p>
                    <p><strong>Status:</strong> {booking.booking_status}</p>
                    <p><strong>Estimated price:</strong> ₹{booking.estimated_price || 0}</p>
                    <p><strong>Address:</strong> {booking.customer_address || "Not provided"}</p>
                    <p><strong>Problem:</strong> {booking.service_description || "No description provided"}</p>
                    {booking.scheduled_time && <p><strong>Preferred time:</strong> {new Date(booking.scheduled_time).toLocaleString()}</p>}

                    {booking.customer_phone && !["REJECTED", "CANCELLED"].includes(booking.booking_status) && (
                      <div className="contact-strip">
                        <a href={`tel:${booking.customer_phone}`}>Call customer: {booking.customer_phone}</a>
                      </div>
                    )}

                    {booking.booking_status === "ARRIVING" && (
                      <section className="tracking-panel">
                        <h4>Live trip to customer</h4>
                        <p className="tracking-summary">
                          <span>{booking.distance_km === null ? "Getting location..." : `${Number(booking.distance_km).toFixed(2)} km away`}</span>
                          {booking.eta_minutes && <span>About {booking.eta_minutes} min</span>}
                        </p>
                        {hasMapCoordinates && (
                          <a className="btn btn-outline small-button" href={navigationUrl(booking)} target="_blank" rel="noreferrer">
                            Navigate to customer
                          </a>
                        )}
                        <ServiceTrackingMap
                          customerLocation={{ latitude: booking.customer_latitude, longitude: booking.customer_longitude }}
                          workerLocation={{ latitude: booking.worker_latitude, longitude: booking.worker_longitude }}
                        />
                        {booking.arrived_at ? (
                          <>
                            <p className="arrival-status">Arrival confirmed. The customer was notified.</p>
                            <button className="btn btn-primary booking-action" type="button" disabled={loading} onClick={() => updateBookingStatus(booking.id, "STARTED")}>
                              Start work
                            </button>
                          </>
                        ) : (
                          <button className="btn btn-primary booking-action" type="button" disabled={loading} onClick={() => confirmArrival(booking.id)}>
                            I&apos;m at the address (within 100 m)
                          </button>
                        )}
                      </section>
                    )}

                    {booking.booking_status === "STARTED" && (
                      <section className="tracking-panel work-completion-panel">
                        <h4>Finish the service</h4>
                        <p className="muted">Upload a clear photo of the completed work, then mark the service as complete.</p>
                        {!booking.completion_photo_url && (
                          <>
                        <label className="photo-upload-label">
                          Upload completed-work photo
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={(event) => setCompletionFiles((current) => ({ ...current, [booking.id]: event.target.files?.[0] }))}
                          />
                        </label>
                        <button className="btn btn-outline booking-action" type="button" disabled={loading} onClick={() => uploadCompletionPhoto(booking.id)}>
                          Upload completion photo
                        </button>
                          </>
                        )}

                        {booking.completion_photo_url && (
                          <>
                            <p className="arrival-status">Completion photo uploaded. You can now finish the service.</p>
                            <button className="btn btn-primary booking-action" type="button" disabled={loading} onClick={() => updateBookingStatus(booking.id, "COMPLETED")}>
                              Mark work completed
                            </button>
                          </>
                        )}
                      </section>
                    )}

                    {booking.completion_photo_url && (
                      <img className="completion-photo" src={completionPhotoUrl(booking.completion_photo_url)} alt="Completed work" />
                    )}

                    {booking.booking_status === "COMPLETED" && (
                      <p className={booking.payment_status === "PAID" ? "arrival-status" : "muted"}>
                        Payment: {booking.payment_status === "PAID"
                          ? `Recorded by customer via ${booking.payment_method}`
                          : "Awaiting customer payment"}
                      </p>
                    )}

                    {action && (
                      <button
                        className="btn btn-primary booking-action"
                        type="button"
                        disabled={loading}
                        onClick={() => updateBookingStatus(booking.id, action.value)}
                      >
                        {action.label}
                      </button>
                    )}

                    {booking.booking_status === "PENDING" && (
                      <button
                        className="btn btn-outline booking-action"
                        type="button"
                        disabled={loading}
                        onClick={() => updateBookingStatus(booking.id, "REJECTED")}
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
            </div>
          </div>
        </section>

        <section className="worker-results worker-job-panel job-history-section">
          <p className="eyebrow">Service history</p>
          <h2>Job history</h2>
          <p className="muted">
            Review completed work, payment records, and other closed requests.
          </p>

          <div className="worker-job-scroll">
            <div className="worker-grid">
              {completedAndClosedBookings.length === 0 && (
                <article className="worker-card">
                  <div>
                    <h3>No completed jobs yet</h3>
                    <p>Finished services and closed requests will be saved here.</p>
                  </div>
                </article>
              )}

              {completedAndClosedBookings.map((booking) => (
                <article className="worker-card worker-history-card" key={booking.id}>
                  <div className="worker-avatar">{booking.booking_status === "COMPLETED" ? "✅" : "📁"}</div>

                  <div>
                    <h3>{booking.service_name || "Service request"}</h3>
                    <p><strong>Customer:</strong> {booking.customer_name || "Customer"}</p>
                    <p><strong>Status:</strong> {booking.booking_status}</p>
                    <p><strong>Price:</strong> ₹{booking.estimated_price || 0}</p>
                    <p><strong>Address:</strong> {booking.customer_address || "Not provided"}</p>
                    {booking.completed_at && <p><strong>Completed:</strong> {new Date(booking.completed_at).toLocaleString()}</p>}

                    {booking.customer_phone && booking.booking_status === "COMPLETED" && (
                      <div className="contact-strip">
                        <a href={`tel:${booking.customer_phone}`}>Call customer: {booking.customer_phone}</a>
                      </div>
                    )}

                    {booking.completion_photo_url && (
                      <img className="completion-photo" src={completionPhotoUrl(booking.completion_photo_url)} alt="Completed work" />
                    )}

                    {booking.booking_status === "COMPLETED" && (
                      <p className={booking.payment_status === "PAID" ? "arrival-status" : "muted"}>
                        Payment: {booking.payment_status === "PAID"
                          ? `Recorded by customer via ${booking.payment_method}`
                          : "Awaiting customer payment"}
                      </p>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        </div>
      </section>
    </main>
  );
}
