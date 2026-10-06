import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api.js";
import ServiceTrackingMap from "../components/ServiceTrackingMap.jsx";
import { getCurrentLocation } from "../hooks/useCurrentLocation.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function CustomerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [services, setServices] = useState([]);
  const [service, setService] = useState("");
  const [radius, setRadius] = useState(10);
  const [workers, setWorkers] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [selectedBookingForReview, setSelectedBookingForReview] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [paymentMethods, setPaymentMethods] = useState({});
  const [bookingHistoryView, setBookingHistoryView] = useState("2");
  const reviewPanelRef = useRef(null);
  const workerResultsRef = useRef(null);
  const bookingFormRef = useRef(null);

  const [bookingForm, setBookingForm] = useState({
    customerAddress: "",
    serviceDescription: "",
    scheduledTime: "",
  });

  const [message, setMessage] = useState(
    "Choose a service and search for available workers."
  );
  const [loading, setLoading] = useState(false);

  async function loadDashboardData() {
    try {
      const [servicesResponse, bookingsResponse, notificationsResponse] = await Promise.all([
        api.get("/services"),
        api.get("/bookings"),
        api.get("/notifications"),
      ]);

      const loadedServices = servicesResponse.data.services || [];

      setServices(loadedServices);
      setBookings(bookingsResponse.data.bookings || []);
      setNotifications(notificationsResponse.data.notifications || []);

      if (loadedServices.length > 0 && !service) {
        setService(loadedServices[0].name);
      }
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Could not load dashboard data. Check the backend server."
      );
    }
  }

  useEffect(() => {
    loadDashboardData();

    const refreshInterval = window.setInterval(loadDashboardData, 10000);
    return () => window.clearInterval(refreshInterval);
  }, []);

  async function findWorkers() {
    setLoading(true);
    setWorkers([]);
    setSelectedWorker(null);
    setHasSearched(true);

    try {
      const location = await getCurrentLocation();

      const response = await api.get("/workers/nearby", {
        params: {
          service,
          latitude: location.latitude,
          longitude: location.longitude,
          radius,
        },
      });

      const foundWorkers = response.data.workers || [];
      setWorkers(foundWorkers);

      setMessage(
        foundWorkers.length
          ? `${foundWorkers.length} available ${service} worker(s) found within ${radius} km.`
          : `No available ${service} workers found within ${radius} km.`
      );

      if (foundWorkers.length > 0) {
        window.setTimeout(() => workerResultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
      }
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          error.message ||
          "Could not get your location or find workers."
      );
    } finally {
      setLoading(false);
    }
  }

  function openBookingForm(worker) {
    if (!worker.serviceCategoryId) {
      setMessage("Please search for workers again before booking.");
      return;
    }

    setSelectedWorker(worker);
    setBookingForm({
      customerAddress: "",
      serviceDescription: "",
      scheduledTime: "",
    });
    setMessage(`Complete the details to request ${worker.service} service from ${worker.name}.`);
    window.setTimeout(() => bookingFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function handleServiceChange(event) {
    setService(event.target.value);
    setWorkers([]);

    if (selectedWorker) {
      setSelectedWorker(null);
      setMessage("Service changed. Search again and select a worker for this service.");
    }
  }

  function updateBookingForm(event) {
    const { name, value } = event.target;

    setBookingForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function submitBooking(event) {
    event.preventDefault();

    const selectedService = services.find((item) => item.id === selectedWorker?.serviceCategoryId);

    if (!selectedService || !selectedWorker) {
      setMessage("Select a worker and service first.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      // Get fresh customer location only when the booking is submitted.
      const location = await getCurrentLocation();

      const payload = {
        workerId: selectedWorker.id,
        serviceCategoryId: selectedWorker.serviceCategoryId,
        customerAddress: bookingForm.customerAddress,
        serviceDescription: bookingForm.serviceDescription,
        customerLatitude: location.latitude,
        customerLongitude: location.longitude,
      };

      if (bookingForm.scheduledTime) {
        payload.scheduledTime = new Date(
          bookingForm.scheduledTime
        ).toISOString();
      }

      const response = await api.post("/bookings", payload);

      setMessage(response.data.message || "Booking request sent successfully.");
      setSelectedWorker(null);
      setBookingForm({
        customerAddress: "",
        serviceDescription: "",
        scheduledTime: "",
      });

      await loadDashboardData();
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          error.message ||
          "Could not create booking."
      );
    } finally {
      setLoading(false);
    }
  }

  async function cancelBooking(bookingId) {
    setLoading(true);
    setMessage("");

    try {
      const response = await api.post(`/bookings/${bookingId}/cancel`);
      setMessage(response.data.message || "Booking cancelled.");
      await loadDashboardData();
    } catch (error) {
      setMessage(
        error.response?.data?.message ||
          "Could not cancel this booking."
      );
    } finally {
      setLoading(false);
    }
  }

  function openReviewForm(booking) {
    setSelectedBookingForReview(booking);
    setReviewRating(5);
    setReviewComment("");
    setMessage("");
    window.setTimeout(() => reviewPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  }

  async function submitReview(event) {
    event.preventDefault();
    if (!selectedBookingForReview) return;

    setLoading(true);
    try {
      const response = await api.post(`/bookings/${selectedBookingForReview.id}/review`, {
        rating: reviewRating,
        comment: reviewComment,
      });
      setMessage(response.data.message || "Your rating has been saved.");
      setBookings((currentBookings) => currentBookings.map((booking) => (
        booking.id === selectedBookingForReview.id
          ? { ...booking, has_review: true, review_rating: reviewRating, review_comment: reviewComment }
          : booking
      )));
      setSelectedBookingForReview(null);
      await loadDashboardData();
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not save your rating.");
    } finally {
      setLoading(false);
    }
  }

  async function recordPayment(booking) {
    const paymentMethod = paymentMethods[booking.id] || "UPI";
    setLoading(true);
    setMessage("");

    try {
      const response = await api.post(`/bookings/${booking.id}/payment`, { paymentMethod });
      setMessage(response.data.message || "Payment recorded successfully.");
      await loadDashboardData();
    } catch (error) {
      setMessage(error.response?.data?.message || "Could not record payment.");
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

  const completedBookings = bookings.filter((booking) => booking.booking_status === "COMPLETED");
  const bookingsToRate = completedBookings.filter((booking) => !booking.has_review);
  const ratingHistory = completedBookings.filter((booking) => booking.has_review);
  const activeTrackingBookings = bookings.filter((booking) => ["ARRIVING", "STARTED"].includes(booking.booking_status));
  const unreadNotifications = notifications.filter((notification) => !notification.is_read);
  const bookingHistoryLimit = bookingHistoryView === "all" ? bookings.length : Number(bookingHistoryView);
  const visibleBookings = bookings.slice(0, bookingHistoryLimit);
  const apiOrigin = (api.defaults.baseURL || "").replace(/\/api\/?$/, "");

  function completionPhotoUrl(path) {
    return path ? `${apiOrigin}${path}` : "";
  }

  return (
    <main className="app-shell customer-dashboard-shell">
      <header className="topbar">
        <Link className="brand" to="/">
          <span className="brand-icon">P</span>
          ProxiFix
        </Link>

        <nav className="nav-actions">
          <Link className="nav-link" to="/">Home</Link>
          <span className="welcome-user">Hi, {user?.name}</span>
          <button className="btn btn-outline" type="button" onClick={handleLogout}>
            Logout
          </button>
        </nav>
      </header>

      <section className="dashboard-section">
        <p className="eyebrow">Customer dashboard</p>
        <h1>Welcome, {user?.name || "Customer"}</h1>
        <p className="dashboard-intro">
          Find verified professionals near your current location.
        </p>

        {message && (
          <p className={message.includes("successfully") ? "form-success" : "muted"}>
            {message}
          </p>
        )}

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
          <article className="card search-card dashboard-hover-card">
            <span className="service-icon">🔎</span>
            <h2>Find a Worker</h2>
            <p>Search verified workers who are online and available now.</p>

            <label>
              Service category
              <select value={service} onChange={handleServiceChange}>
                {services.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Search radius
              <select value={radius} onChange={(event) => setRadius(Number(event.target.value))}>
                <option value={5}>5 km</option>
                <option value={10}>10 km</option>
                <option value={15}>15 km</option>
                <option value={20}>20 km</option>
              </select>
            </label>

            <button
              className="btn btn-primary"
              type="button"
              onClick={findWorkers}
              disabled={!service || loading}
            >
              {loading ? "Searching..." : "Find Nearby Workers"}
            </button>
          </article>

          <article className="card dashboard-hover-card">
            <span className="service-icon">📋</span>
            <h2>My Bookings</h2>

            {bookings.length === 0 ? (
              <p className="muted">No bookings yet.</p>
            ) : (
              <>
                <div className="booking-history-toolbar">
                  <label>
                    Show history
                    <select value={bookingHistoryView} onChange={(event) => setBookingHistoryView(event.target.value)}>
                      <option value="2">Latest 2 bookings</option>
                      <option value="5">Latest 5 bookings</option>
                      <option value="all">All booking history</option>
                    </select>
                  </label>
                  <span>{bookings.length} total</span>
                </div>

                <div className={`booking-list booking-history-list ${bookingHistoryView === "all" && bookings.length > 5 ? "booking-history-scroll" : ""}`.trim()}>
                {visibleBookings.map((booking) => (
                  <div className="booking-item" key={booking.id}>
                    <strong>{booking.service_name}</strong>
                    <p>Worker: {booking.worker_name}</p>
                    <p>Status: {booking.booking_status}</p>
                    <p>₹{booking.estimated_price}</p>

                    {["ACCEPTED", "ARRIVING", "STARTED", "COMPLETED"].includes(booking.booking_status) && booking.worker_phone && (
                      <div className="contact-strip">
                        <a href={`tel:${booking.worker_phone}`}>Call worker: {booking.worker_phone}</a>
                      </div>
                    )}

                    {booking.arrived_at && booking.booking_status !== "COMPLETED" && (
                      <p className="arrival-status">Your worker has arrived and is ready to start.</p>
                    )}

                    {booking.completion_photo_url && (
                      <img className="completion-photo" src={completionPhotoUrl(booking.completion_photo_url)} alt="Completed service work" />
                    )}

                    {booking.booking_status === "COMPLETED" && (
                      <section className="payment-card">
                        <h4>Payment to {booking.worker_name}</h4>
                        <p>Amount: ₹{Number(booking.payment_amount || booking.final_price || booking.estimated_price).toFixed(2)}</p>
                        {booking.payment_status === "PAID" ? (
                          <p className="arrival-status">Payment recorded via {booking.payment_method}.</p>
                        ) : (
                          <>
                            <p className="muted">Pay the worker directly, then record the payment here.</p>
                            <select
                              className="payment-select"
                              value={paymentMethods[booking.id] || "UPI"}
                              onChange={(event) => setPaymentMethods((current) => ({ ...current, [booking.id]: event.target.value }))}
                            >
                              <option value="UPI">UPI</option>
                              <option value="CASH">Cash</option>
                              <option value="BANK_TRANSFER">Bank transfer</option>
                            </select>
                            <button className="btn btn-primary small-button" type="button" disabled={loading} onClick={() => recordPayment(booking)}>
                              Record payment to worker
                            </button>
                          </>
                        )}
                      </section>
                    )}

                    {["PENDING", "ACCEPTED"].includes(booking.booking_status) && (
                      <button
                        className="btn btn-outline small-button"
                        type="button"
                        disabled={loading}
                        onClick={() => cancelBooking(booking.id)}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                ))}
                </div>
              </>
            )}
          </article>

          <article className="card dashboard-hover-card">
            <span className="service-icon">⭐</span>
            <h2>Rate Services</h2>
            {completedBookings.length === 0 ? (
              <><p>Rate completed services and help trusted workers grow.</p><p className="muted">Available after booking completion.</p></>
            ) : (
              <div className="booking-list rating-history-list">
                {bookingsToRate.length > 0 && <p className="rating-subheading">Ready to rate ({bookingsToRate.length})</p>}
                {bookingsToRate.map((booking) => (
                  <div className="booking-item" key={booking.id}>
                    <strong>{booking.service_name}</strong>
                    <p>{booking.worker_name}</p>
                    <button className="btn btn-primary small-button" type="button" disabled={loading} onClick={() => openReviewForm(booking)}>Rate this service</button>
                  </div>
                ))}
                {ratingHistory.length > 0 && <p className="rating-subheading">Your rating history</p>}
                {ratingHistory.map((booking) => (
                  <div className="booking-item" key={booking.id}>
                    <strong>{booking.service_name}</strong>
                    <p>{booking.worker_name}</p>
                    <p className="review-history">Your rating: {Number(booking.review_rating).toFixed(1)} / 5.0{booking.review_comment ? ` · ${booking.review_comment}` : ""}</p>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>

        {activeTrackingBookings.length > 0 && (
          <section className="worker-results">
            <p className="eyebrow">Live service tracking</p>
            <h2>Your worker is on the way</h2>
            <p className="muted">This view refreshes automatically while the worker is travelling to your address.</p>
            <div className="tracking-booking-list">
              {activeTrackingBookings.map((booking) => (
                <article className="tracking-panel tracking-booking-card" key={booking.id}>
                  <h3>{booking.service_name} with {booking.worker_name}</h3>
                  <p className="tracking-summary">
                    <span>Status: {booking.arrived_at ? "Worker has arrived" : "On the way"}</span>
                    {booking.distance_km !== null && booking.distance_km !== undefined && <span>{Number(booking.distance_km).toFixed(2)} km away</span>}
                    {booking.eta_minutes && !booking.arrived_at && <span>Estimated arrival: about {booking.eta_minutes} min</span>}
                  </p>
                  {booking.worker_phone && (
                    <div className="contact-strip">
                      <a href={`tel:${booking.worker_phone}`}>Call {booking.worker_name}: {booking.worker_phone}</a>
                    </div>
                  )}
                  {booking.arrived_at && <p className="arrival-status">Your worker has reached the address and is ready to begin.</p>}
                  <ServiceTrackingMap
                    customerLocation={{ latitude: booking.customer_latitude, longitude: booking.customer_longitude }}
                    workerLocation={{ latitude: booking.worker_latitude, longitude: booking.worker_longitude }}
                  />
                </article>
              ))}
            </div>
          </section>
        )}

        {hasSearched && (
        <section className="worker-results" ref={workerResultsRef}>
          <h2>Available nearby workers</h2>
          <p className="muted">{workers.length > 0 ? "Choose a worker to open the booking form." : message}</p>
          <div className="worker-grid">
            {workers.length === 0 && (
              <article className="worker-card">
                <div>
                  <h3>No workers available yet</h3>
                  <p>Try a larger radius or choose a different service category.</p>
                </div>
              </article>
            )}
            {workers.map((worker) => (
              <article className="worker-card" key={worker.id}>
                <div className="worker-avatar">
                  {worker.name?.charAt(0)?.toUpperCase() || "W"}
                </div>

                <div>
                  <h3>{worker.name}</h3>
                  <p>{worker.service}</p>
                  <p>⭐ {Number(worker.rating || 0).toFixed(1)} rating</p>
                  <p>📍 {Number(worker.distanceKm).toFixed(1)} km away</p>
                  <p>₹{worker.minimumCharge} starting price</p>
                  <span className="available">Available now</span>

                  <button
                    className="btn btn-primary booking-action"
                    type="button"
                    onClick={() => openBookingForm(worker)}
                  >
                    Book {worker.name}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
        )}

        {selectedWorker && (
          <section className="booking-form-card" ref={bookingFormRef}>
            <h2>Book {selectedWorker.name}</h2>
            <p className="muted">
              {selectedWorker.service} · ₹{selectedWorker.minimumCharge} starting price
            </p>

            <form className="auth-form" onSubmit={submitBooking}>
              <label>
                Service address
                <input
                  name="customerAddress"
                  value={bookingForm.customerAddress}
                  onChange={updateBookingForm}
                  placeholder="Enter your complete service address"
                  required
                />
              </label>

              <label>
                Describe the problem
                <textarea
                  name="serviceDescription"
                  value={bookingForm.serviceDescription}
                  onChange={updateBookingForm}
                  placeholder="Example: Kitchen tap is leaking"
                  minLength="10"
                  required
                />
              </label>

              <label>
                Schedule time (optional)
                <input
                  name="scheduledTime"
                  type="datetime-local"
                  value={bookingForm.scheduledTime}
                  onChange={updateBookingForm}
                />
              </label>

              <div className="admin-actions">
                <button className="btn btn-primary" disabled={loading} type="submit">
                  {loading ? "Sending request..." : "Send Booking Request"}
                </button>

                <button
                  className="btn btn-outline"
                  type="button"
                  disabled={loading}
                  onClick={() => setSelectedWorker(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        {selectedBookingForReview && (
          <section className="booking-form-card" ref={reviewPanelRef}>
            <p className="eyebrow">Completed service</p>
            <h2>Rate {selectedBookingForReview.worker_name}</h2>
            <p className="muted">{selectedBookingForReview.service_name} · Each completed booking can be rated once.</p>
            <form className="auth-form" onSubmit={submitReview}>
              <label>
                Your rating
                <select value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))}>
                  <option value={5}>★★★★★ — Excellent</option>
                  <option value={4.5}>★★★★½ — Excellent</option>
                  <option value={4}>★★★★☆ — Very good</option>
                  <option value={3.5}>★★★½☆ — Very good</option>
                  <option value={3}>★★★☆☆ — Good</option>
                  <option value={2.5}>★★½☆☆ — Good</option>
                  <option value={2}>★★☆☆☆ — Needs improvement</option>
                  <option value={1.5}>★½☆☆☆ — Needs improvement</option>
                  <option value={1}>★☆☆☆☆ — Poor</option>
                </select>
              </label>
              <label>
                Comment (optional)
                <textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} placeholder="Share your experience" maxLength="1000" />
              </label>
              <div className="admin-actions">
                <button className="btn btn-primary" disabled={loading} type="submit">{loading ? "Saving..." : "Submit rating"}</button>
                <button className="btn btn-outline" disabled={loading} type="button" onClick={() => setSelectedBookingForReview(null)}>Cancel</button>
              </div>
            </form>
          </section>
        )}
      </section>
    </main>
  );
}
