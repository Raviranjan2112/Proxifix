import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const reviewForm = document.getElementById("review-form");
const message = document.getElementById("form-message");
const ratingInput = reviewForm.querySelector("select");
const feedbackInput = reviewForm.querySelector("textarea");

const bookingId = new URLSearchParams(window.location.search).get("bookingId");

function showMessage(text, isError = false) {
  message.textContent = text;
  message.style.display = "block";
  message.className = isError ? "message error" : "message success";
}

async function hasAlreadyRated() {
  const reviewQuery = query(
    collection(db, "reviews"),
    where("bookingId", "==", bookingId)
  );

  const reviewSnapshot = await getDocs(reviewQuery);

  return !reviewSnapshot.empty;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  if (!bookingId) {
    showMessage("No booking was selected.", true);
    reviewForm.style.display = "none";
    return;
  }

  const bookingDoc = await getDoc(doc(db, "bookings", bookingId));

  if (
    !bookingDoc.exists() ||
    bookingDoc.data().customerId !== user.uid ||
    bookingDoc.data().status !== "completed"
  ) {
    showMessage("You can rate only your completed bookings.", true);
    reviewForm.style.display = "none";
    return;
  }

  if (await hasAlreadyRated()) {
    showMessage("You already rated this booking.", true);
    reviewForm.style.display = "none";
  }
});

reviewForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const user = auth.currentUser;

  if (!user || !bookingId) {
    return;
  }

  try {
    const bookingDoc = await getDoc(doc(db, "bookings", bookingId));

    if (!bookingDoc.exists()) {
      throw new Error("Booking not found.");
    }

    const booking = bookingDoc.data();

    if (
      booking.customerId !== user.uid ||
      booking.status !== "completed"
    ) {
      throw new Error("You can rate only your completed bookings.");
    }

    if (await hasAlreadyRated()) {
      throw new Error("You already rated this booking.");
    }

    await setDoc(doc(db, "reviews", bookingId), {
      bookingId,
      customerId: user.uid,
      workerId: booking.workerId,
      workerName: booking.workerName,
      starRating: Number(ratingInput.value),
      feedback: feedbackInput.value.trim(),
      createdAt: serverTimestamp()
    });

    showMessage("Thank you. Your rating was submitted.");

    setTimeout(() => {
      window.location.href = "customer-dashboard.html";
    }, 1200);
  } catch (error) {
    console.error(error);
    showMessage(error.message, true);
  }
});