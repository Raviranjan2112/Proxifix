import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const workerList = document.getElementById("worker-list");
const categoryFilter = document.getElementById("category-filter");
const logoutButton = document.getElementById("logout-btn");

let approvedWorkers = [];

function renderWorkers() {
  const selectedCategory = categoryFilter.value;

  const visibleWorkers = approvedWorkers.filter((worker) => {
    return selectedCategory === "all"
      || worker.category === selectedCategory;
  });

  if (visibleWorkers.length === 0) {
    workerList.innerHTML = `
      <article class="card">
        <h3>No workers found</h3>
        <p class="muted">
          No approved workers are available in this service category yet.
        </p>
      </article>
    `;
    return;
  }

  workerList.innerHTML = visibleWorkers.map((worker) => `
    <article class="card">
      <span class="service-icon">👷</span>
      <h3>${worker.fullName}</h3>
      <p><strong>Service:</strong> ${worker.category}</p>
      <p><strong>Experience:</strong> ${worker.experience || 0} years</p>
      <p><strong>City:</strong> ${worker.city || "Not provided"}</p>
      <p><strong>Rating:</strong> ${Number(worker.averageRating || 0).toFixed(1)} / 5.0</p>
      <p><strong>Availability:</strong> ${worker.isOnline ? "Online" : "Offline"}</p>
      <br>
      <a class="btn btn-primary" href="booking.html?workerId=${worker.id}">
        Book Now
      </a>
    </article>
  `).join("");
}

async function loadWorkers() {
  const snapshot = await getDocs(collection(db, "workers"));

  approvedWorkers = snapshot.docs
    .map((workerDoc) => ({
      id: workerDoc.id,
      ...workerDoc.data()
    }))
    .filter((worker) => worker.verificationStatus === "approved");

  renderWorkers();
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  await loadWorkers();
});

categoryFilter.addEventListener("change", renderWorkers);

logoutButton.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});