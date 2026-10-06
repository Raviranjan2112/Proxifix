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
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const welcomeMessage = document.getElementById("welcome-message");
const workerSummary = document.getElementById("worker-summary");
const verificationStatus = document.getElementById("verification-status");
const availabilityStatus = document.getElementById("availability-status");
const availabilityButton = document.getElementById("availability-btn");
const rating = document.getElementById("rating");
const logoutButton = document.getElementById("logout-btn");
const jobList = document.getElementById("job-list");

let currentWorker = null;

function displayWorker(worker) {
  welcomeMessage.textContent = `Welcome, ${worker.fullName}`;

  const category = worker.serviceCategory || worker.category || "Service";
  workerSummary.textContent =
    `${category} worker in ${worker.city} with ${worker.experience} years of experience.`;

  verificationStatus.textContent = `Status: ${worker.verificationStatus}`;

  const approved = worker.verificationStatus === "approved";

  if (!approved) {
    availabilityStatus.textContent =
      "Your account must be approved by an admin before you can go online.";

    availabilityButton.disabled = true;
    availabilityButton.textContent = "Waiting for Approval";
    return;
  }

  availabilityButton.disabled = false;

  availabilityStatus.textContent = worker.isOnline
    ? "You are currently online and available for bookings."
    : "You are currently offline.";

  availabilityButton.textContent = worker.isOnline
    ? "Go Offline"
    : "Go Online";
}

async function loadRating(workerId) {
  const reviewsQuery = query(
    collection(db, "reviews"),
    where("workerId", "==", workerId)
  );

  const snapshot = await getDocs(reviewsQuery);

  if (snapshot.empty) {
    rating.textContent = "0.0 / 5.0";
    return;
  }

  const total = snapshot.docs.reduce((sum, reviewDoc) => {
    const review = reviewDoc.data();
    return sum + Number(review.starRating || 0);
  }, 0);

  const average = total / snapshot.size;

  rating.textContent = `${average.toFixed(1)} / 5.0 (${snapshot.size} review${snapshot.size === 1 ? "" : "s"})`;
}

function nextAction(status) {
  if (status === "requested") {
    return { label: "Accept Booking", newStatus: "accepted" };
  }

  if (status === "accepted") {
    return { label: "Start Job", newStatus: "in_progress" };
  }

  if (status === "in_progress") {
    return { label: "Mark Completed", newStatus: "completed" };
  }

  return null;
}

async function loadJobs() {
  if (!auth.currentUser) {
    return;
  }

  const jobsQuery = query(
    collection(db, "bookings"),
    where("workerId", "==", auth.currentUser.uid)
  );

  const snapshot = await getDocs(jobsQuery);

  if (snapshot.empty) {
    jobList.innerHTML = `
      <article class="card">
        <h3>No service requests yet</h3>
        <p class="muted">Customer booking requests will appear here.</p>
      </article>
    `;
    return;
  }

  jobList.innerHTML = snapshot.docs.map((jobDoc) => {
    const job = jobDoc.data();
    const action = nextAction(job.status);

    return `
      <article class="card">
        <span class="service-icon">📋</span>
        <h3>${job.serviceCategory}</h3>
        <p><strong>Customer:</strong> ${job.customerName}</p>
        <p><strong>Address:</strong> ${job.address}</p>
        <p><strong>Problem:</strong> ${job.description}</p>
        <p><strong>Budget:</strong> ₹${job.estimatedFare}</p>
        <p><strong>Status:</strong> ${job.status}</p>
        <br>

        ${
          action
            ? `
              <button
                class="btn btn-primary job-action-btn"
                data-id="${jobDoc.id}"
                data-status="${action.newStatus}">
                ${action.label}
              </button>
            `
            : `<button class="btn btn-outline" disabled>Completed</button>`
        }
      </article>
    `;
  }).join("");

  document.querySelectorAll(".job-action-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      await updateDoc(doc(db, "bookings", button.dataset.id), {
        status: button.dataset.status
      });

      await loadJobs();
    });
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const workerDoc = await getDoc(doc(db, "workers", user.uid));

  if (!workerDoc.exists()) {
    window.location.href = "login.html";
    return;
  }

  currentWorker = workerDoc.data();

  displayWorker(currentWorker);

  await Promise.all([
    loadJobs(),
    loadRating(user.uid)
  ]);
});

availabilityButton.addEventListener("click", async () => {
  if (!auth.currentUser || !currentWorker) {
    return;
  }

  const newStatus = !currentWorker.isOnline;

  await updateDoc(doc(db, "workers", auth.currentUser.uid), {
    isOnline: newStatus
  });

  currentWorker.isOnline = newStatus;

  displayWorker(currentWorker);
});

logoutButton.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});