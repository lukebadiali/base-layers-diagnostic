// src/firebase/auth.js
// @ts-check
// Phase 4 (D-05): Auth instance + onAuthStateChanged export.
// Phase 6 Wave 3: real signInEmailPassword + signOut + multiFactor bodies +
// AUTH-12 unified-error wrapper at this chokepoint per D-13 + BLOCKER-FIX 2
// (updatePassword) + BLOCKER-FIX 3 (email-link Tier-1 recovery surface).
//
// Phase 6 Wave 5 cutover (D-04 / AUTH-14): signInAnonymously import + call +
// firebase-ready bridge DELETED. main.js subscribes to onAuthStateChanged
// directly via the export below; the legacy `window.FB.currentUser` global
// + `firebase-ready` event are retired. Re-exports below add the auth helpers
// that views/auth.js (Wave 3 D-13 / D-16) consumes via deps.
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  multiFactor as fbMultiFactor,
  updatePassword as fbUpdatePassword,
  sendSignInLinkToEmail as fbSendSignInLinkToEmail,
  isSignInWithEmailLink as fbIsSignInWithEmailLink,
  signInWithEmailLink as fbSignInWithEmailLink,
  sendEmailVerification as fbSendEmailVerification,
  sendPasswordResetEmail as fbSendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "./app.js";

export { auth, onAuthStateChanged };

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

// Phase 6 Wave 5 (BLOCKER-FIX 1 wiring): re-exports consumed by views/auth.js
// deps via main.js. Trivial wrappers — no AUTH-12 chokepoint applies (these
// are silent-success / generic-success per Firebase Auth's account-enumeration
// hardening on the email-link APIs).

/** @param {*} user */
export async function sendEmailVerification(user) {
  return fbSendEmailVerification(user);
}

/** @param {string} email */
export async function sendPasswordResetEmail(email) {
  return fbSendPasswordResetEmail(auth, email);
}
