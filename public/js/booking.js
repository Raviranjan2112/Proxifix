import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const bookingForm = document.getElementById("booking-form");
const workerNameInput = document.getElementById("worker-name");
const serviceCategoryInput = document.getElementById("service-category");
const addressInput = document.getElementById("address");
const descriptionInput = document.getElementById("description");
const estimatedFareInput = document.getElementById("estimated-fare");
const formMessage = document.getElementById("form-message");

const workerId = new URLSearchParams(window.location.search).get("workerId");
let selectedWorker = null;
let currentCustomer = null;

function showMessage(message, isError = false) {
  formMessage.textContent = message;
  formMessage.style.display = "block";
  formMessage.className = isError ? "message error" : "message success";
}

async function loadWorker() {
  if (!workerId) {
    showMessage("No worker was selected.", true);
    bookingForm.style.display = "none";
    return;
  }

  const workerDoc = await getDoc(doc(db, "workers", workerId));

  if (!workerDoc.exists()) {
    showMessage("This worker profile was not found.", true);
    bookingForm.style.display = "none";
    return;
  }

  selectedWorker = {
    id: workerDoc.id,
    ...workerDoc.data()
  };

  if (
    selectedWorker.verificationStatus !== "approved" ||
    selectedWorker.isOnline !== true
  ) {
    showMessage("This worker is currently unavailable.", true);
    bookingForm.style.display = "none";
    return;
  }

  workerNameInput.value = selectedWorker.fullName || "Worker";

  serviceCategoryInput.value =
    selectedWorker.serviceCategory ||
    selectedWorker.category ||
    "Service";
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const customerDoc = await getDoc(doc(db, "users", user.uid));

  if (!customerDoc.exists() || customerDoc.data().role !== "customer") {
    window.location.href = "login.html";
    return;
  }

  currentCustomer = {
    id: customerDoc.id,
    ...customerDoc.data()
  };

  try {
    await loadWorker();
  } catch (error) {
    console.error(error);
    showMessage(`Could not load worker: ${error.message}`, true);
  }
});

bookingForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!selectedWorker || !currentCustomer) {
    showMessage("Please wait while booking details load.", true);
    return;
  }

  try {
    await addDoc(collection(db, "bookings"), {
      customerId: currentCustomer.id,
      customerName: currentCustomer.fullName || "Customer",
      workerId: selectedWorker.id,
      workerName: selectedWorker.fullName || "Worker",
      serviceCategory: serviceCategoryInput.value,
      address: addressInput.value.trim(),
      description: descriptionInput.value.trim(),
      estimatedFare: Number(estimatedFareInput.value),
      status: "requested",
      createdAt: serverTimestamp()
    });

    showMessage("Booking request sent successfully.");

    setTimeout(() => {
      window.location.href = "customer-dashboard.html";
    }, 1000);
  } catch (error) {
    console.error(error);
    showMessage(`Could not create booking: ${error.message}`, true);
  }
});