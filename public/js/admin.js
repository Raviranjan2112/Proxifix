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
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const welcomeMessage = document.getElementById("welcome-message");
const totalWorkers = document.getElementById("total-workers");
const pendingWorkers = document.getElementById("pending-workers");
const approvedWorkers = document.getElementById("approved-workers");
const workerList = document.getElementById("worker-list");
const logoutButton = document.getElementById("logout-btn");

async function loadWorkers() {
  const snapshot = await getDocs(collection(db, "workers"));

  const workers = snapshot.docs.map((workerDoc) => ({
    id: workerDoc.id,
    ...workerDoc.data()
  }));

  totalWorkers.textContent = workers.length;
  pendingWorkers.textContent =
    workers.filter((worker) => worker.verificationStatus === "pending").length;
  approvedWorkers.textContent =
    workers.filter((worker) => worker.verificationStatus === "approved").length;

  if (workers.length === 0) {
    workerList.innerHTML = `
      <article class="card">
        <h3>No worker applications yet</h3>
        <p class="muted">Worker registrations will appear here.</p>
      </article>
    `;
    return;
  }

  workerList.innerHTML = workers.map((worker) => `
    <article class="card">
      <span class="service-icon">👷</span>
      <h3>${worker.fullName}</h3>
      <p><strong>Category:</strong> ${worker.category || "Not provided"}</p>
      <p><strong>Experience:</strong> ${worker.experience || 0} years</p>
      <p><strong>City:</strong> ${worker.city || "Not provided"}</p>
      <p><strong>Status:</strong> ${worker.verificationStatus}</p>
      <br>
      ${
        worker.verificationStatus === "approved"
          ? `<button class="btn btn-outline" disabled>Approved</button>`
          : `<button class="btn btn-primary approve-btn" data-id="${worker.id}">
               Approve Worker
             </button>`
      }
    </article>
  `).join("");

  document.querySelectorAll(".approve-btn").forEach((button) => {
    button.addEventListener("click", async () => {
      const workerId = button.dataset.id;

      await updateDoc(doc(db, "workers", workerId), {
        verificationStatus: "approved"
      });

      await updateDoc(doc(db, "users", workerId), {
        verificationStatus: "approved"
      });

      await loadWorkers();
    });
  });
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const userDoc = await getDoc(doc(db, "users", user.uid));

  if (!userDoc.exists() || userDoc.data().role !== "admin") {
    window.location.href = "login.html";
    return;
  }

  welcomeMessage.textContent = `Welcome, ${userDoc.data().fullName}`;
  await loadWorkers();
});

logoutButton.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});