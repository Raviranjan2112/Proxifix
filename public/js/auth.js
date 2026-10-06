import { auth, db } from "./firebase-config.js";

import {
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const loginForm = document.getElementById("login-form");
const formMessage = document.getElementById("form-message");

function showMessage(text, type) {
  formMessage.textContent = text;
  formMessage.className = `message ${type}`;
  formMessage.style.display = "block";
}

if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      const userDoc = await getDoc(
        doc(db, "users", userCredential.user.uid)
      );

      const role = userDoc.exists()
        ? userDoc.data().role
        : "customer";

      showMessage("Login successful. Redirecting...", "success");

      if (role === "worker") {
        window.location.href = "worker-dashboard.html";
      } else if (role === "admin") {
        window.location.href = "admin.html";
      } else {
        window.location.href = "customer-dashboard.html";
      }
    } catch (error) {
      let message = "Login failed. Please try again.";

      if (error.code === "auth/invalid-credential") {
        message = "Incorrect email address or password.";
      }

      showMessage(message, "error");
    }
  });
}