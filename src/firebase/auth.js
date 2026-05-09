// src/firebase/auth.js
// @ts-check
// Phase 4 (D-05): Auth instance + onAuthStateChanged firebase-ready bridge.
// Phase 6 Wave 3: real signInEmailPassword + signOut + multiFactor bodies +
// AUTH-12 unified-error wrapper at this chokepoint per D-13 + BLOCKER-FIX 2
// (updatePassword) + BLOCKER-FIX 3 (email-link Tier-1 recovery surface).
//
// Wave 5 cutover commit (D-04) DELETES the signInAnonymously import + call +
// firebase-ready bridge in a single atomic commit alongside the rules deploy.
// Wave 3 leaves them in place so the existing main.js IIFE continues to boot.
import {
  signInAnonymously,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  multiFactor as fbMultiFactor,
  updatePassword as fbUpdatePassword,
  sendSignInLinkToEmail as fbSendSignInLinkToEmail,
  isSignInWithEmailLink as fbIsSignInWithEmailLink,
  signInWithEmailLink as fbSignInWithEmailLink,
} from "firebase/auth";
import { auth } from "./app.js";

export { auth, onAuthStateChanged, signInAnonymously };

// Phase 4 firebase-ready bridge - Wave 5 cutover commit deletes this block per D-04.
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

// Phase 6 (AUTH-12 / D-13): single-chokepoint unified-error wrapper. Catches
// Firebase auth-credential error codes and re-throws SignInError so callers
// in views/* never see Firebase error codes (mitigates account enumeration
// per AUTH-12 + L1).
export class SignInError extends Error {
  constructor() {
    super("Email or password incorrect");
    this.name = "SignInError";
  }
}

const AUTH_CRED_ERROR_CODES = new Set([
  "auth/user-not-found",
  "auth/wrong-password",
  "auth/invalid-credential",
  "auth/too-many-requests",
  "auth/user-disabled",
  "auth/invalid-email",
  "auth/missing-password",
  "auth/missing-email",
]);

/** @param {string} email @param {string} password */
export async function signInEmailPassword(email, password) {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    const code = (err && /** @type {*} */ (err).code) || "";
    if (AUTH_CRED_ERROR_CODES.has(code)) {
      throw new SignInError();
    }
    // Unexpected - let it bubble for observability (Phase 9 Sentry will catch).
    throw err;
  }
}

/** @returns {Promise<void>} */
export async function signOut() {
  await fbSignOut(auth);
}

/** @param {*} user */
export function multiFactor(user) {
  return fbMultiFactor(user);
}

// Phase 6 Wave 3 (BLOCKER-FIX 2): updatePassword export - consumed by views/auth.js
// renderFirstRun's deps.updatePassword. SignInError reuse is intentional -
// failure surfaces a generic message at the chokepoint per D-13.
/** @param {string} newPassword */
export async function updatePassword(newPassword) {
  const user = auth.currentUser;
  if (!user) throw new SignInError();
  try {
    await fbUpdatePassword(user, newPassword);
  } catch (err) {
    const code = (err && /** @type {*} */ (err).code) || "";
    // Surface password-policy failures verbatim so the user can retry; account
    // enumeration is not at risk here (the user is already signed in).
    if (code === "auth/weak-password" || code === "auth/requires-recent-login") {
      const wrapped = new Error(
        code === "auth/weak-password"
          ? "Password does not meet policy (min 12 chars, no leaked passwords)"
          : "Please sign in again to change your password",
      );
      /** @type {*} */ (wrapped).cause = err;
      throw wrapped;
    }
    throw err;
  }
}

// Phase 6 Wave 3 (BLOCKER-FIX 3 D-07 Tier-1 recovery surface): wraps email-link
// sign-in for the Forgot 2FA flow. View calls sendSignInLinkToEmail; user
// clicks the link in their inbox; the email-link handler calls
// signInWithEmailLink which yields a session with no MFA gate; user then
// un-enrols all MFA factors via multiFactor(currentUser).unenroll(...) and
// re-enrols TOTP.
/** @param {string} email @param {{url: string, handleCodeInApp: boolean}} settings */
export async function sendSignInLinkToEmail(email, settings) {
  return fbSendSignInLinkToEmail(auth, email, settings);
}

/** @param {string} url */
export function isSignInWithEmailLink(url) {
  return fbIsSignInWithEmailLink(auth, url);
}

/** @param {string} email @param {string} url */
export async function signInWithEmailLink(email, url) {
  return fbSignInWithEmailLink(auth, email, url);
}
