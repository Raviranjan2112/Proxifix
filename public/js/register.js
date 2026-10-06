import { auth, db } from "./firebase-config.js";

import {
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
  doc,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const registerForm = document.getElementById("register-form");
const fullNameInput = document.getElementById("full-name");
const phoneInput = document.getElementById("phone");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const roleInput = document.getElementById("role");
const serviceCategoryInput = document.getElementById("service-category");
const experienceInput = document.getElementById("experience");
const cityInput = document.getElementById("city");
const workerFields = document.getElementById("worker-fields");
const formMessage = document.getElementById("form-message");
const registerButton = document.getElementById("register-btn");

function showMessage(message, isError = false) {
  formMessage.textContent = message;
  formMessage.style.display = "block";
  formMessage.className = isError ? "message error" : "message success";
}

roleInput.addEventListener("change", () => {
  const isWorker = roleInput.value === "worker";

  workerFields.hidden = !isWorker;
  serviceCategoryInput.required = isWorker;
  experienceInput.required = isWorker;
  cityInput.required = isWorker;
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const fullName = fullNameInput.value.trim();
  const phone = phoneInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const role = roleInput.value;

  if (
    role === "worker" &&
    (
      !serviceCategoryInput.value ||
      !experienceInput.value ||
      !cityInput.value.trim()
    )
  ) {
    showMessage("Complete all worker details.", true);
    return;
  }

  try {
    registerButton.disabled = true;
    showMessage("Creating your account...");

    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    const user = credential.user;

    const userData = {
      fullName,
      phone,
      email,
      role,
      createdAt: serverTimestamp()
    };

    if (role === "worker") {
      userData.serviceCategory = serviceCategoryInput.value;
      userData.experience = Number(experienceInput.value);
      userData.city = cityInput.value.trim();
      userData.verificationStatus = "pending";
      userData.isOnline = false;
      userData.averageRating = 0;
    }

    await setDoc(doc(db, "users", user.uid), userData);

    if (role === "worker") {
      await setDoc(doc(db, "workers", user.uid), userData);
    }

    window.location.href =
      role === "worker"
        ? "worker-dashboard.html"
        : "customer-dashboard.html";
  } catch (error) {
    console.error(error);

    if (error.code === "auth/email-already-in-use") {
      showMessage(
        "This email already has an account. Use another email or log in.",
        true
      );
    } else {
      showMessage(`Registration failed: ${error.message}`, true);
    }

    registerButton.disabled = false;
  }
});