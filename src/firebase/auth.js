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
//
// Phase 7 Wave 5 (BLOCKER-FIX 1 — sub-wave 6.1 row closes here): updatePassword
// now invokes the setClaims callable + getIdToken(true) refresh after a
// successful firebase password update. This re-flips the firstRun:true claim
// to firstRun:absent so first-run users don't re-land on the firstRun screen
// after their password change. Closes the manual `accounts:update` operator
// patch that Phase 6 cutover-recovery used as a one-off (Phase 6 cleanup-ledger
// sub-wave 6.1 row "BLOCKER-FIX 1 setClaims wiring after password update").
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
import { setClaims } from "../cloud/claims-admin.js";

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
//
// Phase 7 Wave 5 (BLOCKER-FIX 1 — sub-wave 6.1 row closes): after the firebase
// password update resolves, if the current id-token claims include
// `firstRun: true`, invoke the setClaims callable to flip firstRun off
// (server-side setCustomUserClaims path drops firstRun because it's not in
// SetClaimsSchema), then force a getIdToken(true) refresh so the new claim is
// picked up immediately. The setClaims call is wrapped in try/catch and the
// error is swallowed (logged) — the password DID update successfully and we
// don't want to re-throw and confuse the caller. The user will pick up the
// firstRun flip on next reload via the existing onAuthStateChanged listener
// path or via the _pokes/{ts} write the server emits per Pitfall 2.
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

  // BLOCKER-FIX 1: re-flip firstRun:true → absent + force token refresh.
  // Best-effort; failure here does not roll back the successful password update.
  try {
    const idTokenResult = await user.getIdTokenResult();
    const claims = /** @type {Record<string, unknown>} */ (idTokenResult.claims);
    if (claims.firstRun === true) {
      const role =
        typeof claims.role === "string" ? /** @type {string} */ (claims.role) : null;
      const orgId =
        typeof claims.orgId === "string" ? /** @type {string} */ (claims.orgId) : null;
      await setClaims({ uid: user.uid, role, orgId });
      // Force ID-token refresh — picks up the server-side setCustomUserClaims
      // mutation immediately so the next claim read sees firstRun absent.
      await user.getIdToken(true);
    }
  } catch (claimsErr) {
    // Swallow: password DID update; firstRun re-flip will retry on next auth
    // state change or _pokes listener event (Pitfall 2 mitigation #3).
    // Phase 9 Sentry will capture if observability is wired by then.
    /** @type {*} */ (claimsErr);
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
