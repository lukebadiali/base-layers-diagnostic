// src/firebase/auth.js
// @ts-check
// Phase 4 (D-05): Auth instance + onAuthStateChanged firebase-ready bridge.
// Phase 6 (AUTH-14) replaces signInAnonymously with real Email/Password auth.
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { auth } from "./app.js";

export { auth, onAuthStateChanged, signInAnonymously };

// Preserve the firebase-init.js:82-90 dispatch — app.js IIFE listens for
// "firebase-ready" via the window.dispatchEvent below. The window.FB.currentUser
// bridge keeps the IIFE booting until Wave 5 deletes app.js (D-03).
onAuthStateChanged(auth, (u) => {
  if (u) {
    if (typeof window !== "undefined") {
      /** @type {*} */ (window).FB = /** @type {*} */ (window).FB || {};
      /** @type {*} */ (window).FB.currentUser = u;
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("firebase-ready"));
    }
  }
});
signInAnonymously(auth).catch((e) => console.error("Firebase anon sign-in failed:", e));

// D-05 placeholder helpers — Phase 6 (AUTH-03 / AUTH-08) fills bodies.
/** @param {string} _email @param {string} _password */
export async function signInEmailPassword(_email, _password) {
  /* Phase 6 (AUTH-03) */
}

/** @returns {Promise<void>} */
export async function signOut() {
  /* Phase 6 (AUTH-03) */
}

/** @param {*} _user */
export function multiFactor(_user) {
  /* Phase 6 (AUTH-08) — TOTP enrol shape */
}
