// src/firebase/auth.js
// @ts-check
// Phase 4 (D-05): Auth instance + onAuthStateChanged firebase-ready bridge.
// Phase 6 (AUTH-14) replaces signInAnonymously with real Email/Password auth.
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { auth } from "./app.js";

export { auth, onAuthStateChanged, signInAnonymously };

// Preserve the firebase-init.js:82-90 dispatch — main.js IIFE listens for
// "firebase-ready" via the window.dispatchEvent below + reads
// window.FB.currentUser to avoid coupling main.js to the SDK directly.
//
// Phase 4 Wave 5 (D-03 transitional): the window.FB.currentUser bridge
// stays alive while main.js's IIFE body uses it. Wave 6 cleanup migrates
// the IIFE body into views/* + auth/state-machine.js (which would own
// currentUser directly), at which point the bridge retires. Same Wave 4
// Dev #1 + Wave 3 Dev #1 logic: D-12 + must_haves snapshot stability
// trump literal task instructions.
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
