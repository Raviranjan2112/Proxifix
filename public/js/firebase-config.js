import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import { getAuth } from
  "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import { getFirestore } from
  "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAKDq3152jrElM8YiU13cvun5rwJmlCarc",
  authDomain: "proxifix-30547.firebaseapp.com",
  projectId: "proxifix-30547",
  storageBucket: "proxifix-30547.firebasestorage.app",
  messagingSenderId: "487836130800",
  appId: "1:487836130800:web:ffd3145792b83fd9ff9135"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);