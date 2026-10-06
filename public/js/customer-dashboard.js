import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const welcomeMessage = document.getElementById("welcome-message");
const logoutButton = document.getElementById("logout-btn");
const bookingsList = document.getElementById("bookings-list");
const ratingsList = document.getElementById("ratings-list");

async function loadDashboard(userId) {
  const bookingsQuery = query(
    collection(db, "bookings"),
    where("customerId", "==", userId)
  );

  const reviewsQuery = query(
    collection(db, "reviews"),
    where("customerId", "==", userId)
  );

  const [bookingsSnapshot, reviewsSnapshot] = await Promise.all([
    getDocs(bookingsQuery),
    getDocs(reviewsQuery)
  ]);

  const reviewsByBookingId = new Map(
    reviewsSnapshot.docs.map((reviewDoc) => {
      const review = reviewDoc.data();
      return [review.bookingId, review];
    })
  );

  if (bookingsSnapshot.empty) {
    bookingsList.innerHTML = `<p class="muted">No bookings yet.</p>`;
    ratingsList.innerHTML = `<p class="muted">No completed services to rate yet.</p>`;
    return;
  }

  // MY BOOKINGS: Details only, without rating buttons.
  bookingsList.innerHTML = bookingsSnapshot.docs.map((bookingDoc) => {
    const booking = bookingDoc.data();

    return `
      <div style="border-top: 1px solid #e4e7ec; margin-top: 14px; padding-top: 14px;">
        <strong>${booking.serviceCategory}</strong>
        <p class="muted">Worker: ${booking.workerName}</p>
        <p class="muted">Status: ${booking.status}</p>
        <p class="muted">Budget: ₹${booking.estimatedFare}</p>
      </div>
    `;
  }).join("");

  const completedBookings = bookingsSnapshot.docs.filter((bookingDoc) => {
    return bookingDoc.data().status === "completed";
  });

  if (completedBookings.length === 0) {
    ratingsList.innerHTML = `
      <p class="muted">
        Rate Worker becomes available after a booking is completed.
      </p>
    `;
    return;
  }

  // RATE SERVICES: Completed booking details and rating button.
  ratingsList.innerHTML = completedBookings.map((bookingDoc) => {
    const booking = bookingDoc.data();
    const review = reviewsByBookingId.get(bookingDoc.id);

    const ratingContent = review
      ? `
        <p class="muted"><strong>✓ Rated: ${review.starRating} / 5 ⭐</strong></p>
        <p class="muted">Feedback: ${review.feedback || "No written feedback."}</p>
      `
      : `
        <a class="btn btn-primary" href="review.html?bookingId=${bookingDoc.id}">
          Rate Worker
        </a>
      `;

    return `
      <div style="border-top: 1px solid #e4e7ec; margin-top: 14px; padding-top: 14px;">
        <strong>${booking.serviceCategory}</strong>
        <p class="muted">Worker: ${booking.workerName}</p>
        <p class="muted">Completed booking · Budget: ₹${booking.estimatedFare}</p>
        ${ratingContent}
      </div>
    `;
  }).join("");
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const userDoc = await getDoc(doc(db, "users", user.uid));

  if (!userDoc.exists() || userDoc.data().role !== "customer") {
    window.location.href = "login.html";
    return;
  }

  welcomeMessage.textContent = `Welcome, ${userDoc.data().fullName}`;

  await loadDashboard(user.uid);
});

logoutButton.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});