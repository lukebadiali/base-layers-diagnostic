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
//
// Phase 9 Wave 4 (AUDIT-05): try/finally emitAuditEvent at six call sites:
// signInEmailPassword (POST, both outcomes — failure feeds OBS-05 anomaly
// counter alongside the SERVER-side substrate from Plan 03a beforeUserSignedIn),
// signOut (PRE — App Check token revoked after), updatePassword (POST),
// sendPasswordResetEmail (POST, NO email in payload), signInWithEmailLink
// (POST, payload.method:"emailLink"). Best-effort emission via emitAuditEvent —
// failures swallowed (Pattern 5 #2 — never block auth flow on audit failure).
// NOTE on auth.signin.failure: the auditWrite callable rejects unauthenticated
// callers, so a wrong-password attempt's client emit may itself be rejected —
// emitAuditEvent's internal swallow handles that gracefully. Wave 4 Rule 1
// reads from BOTH the client `.failure` rows (post-auth) AND the server
// `auth.signin.failure` rows from Plan 03a beforeUserSignedIn substrate.
import {
  onAuthStateChanged,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  multiFactor as fbMultiFactor,
  TotpMultiFactorGenerator,
  getMultiFactorResolver as fbGetMultiFactorResolver,
  updatePassword as fbUpdatePassword,
  reauthenticateWithCredential as fbReauthenticateWithCredential,
  EmailAuthProvider,
  sendSignInLinkToEmail as fbSendSignInLinkToEmail,
  isSignInWithEmailLink as fbIsSignInWithEmailLink,
  signInWithEmailLink as fbSignInWithEmailLink,
  sendEmailVerification as fbSendEmailVerification,
  sendPasswordResetEmail as fbSendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "./app.js";
import { setClaims } from "../cloud/claims-admin.js";
import { emitAuditEvent } from "../observability/audit-events.js";

export { auth, onAuthStateChanged, onIdTokenChanged };

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

// Phase 6 follow-up (UAT-discovered): signInEmailPassword throws this when the
// account has MFA enrolled. Carries the live MultiFactorResolver so the view
// layer can route to renderMfaChallenge + call verifyMfaCode without
// re-issuing the password sign-in. Resolver is non-serializable; never persist.
export class MfaRequiredError extends Error {
  /** @param {*} resolver */
  constructor(resolver) {
    super("Multi-factor authentication required");
    this.name = "MfaRequiredError";
    /** @type {*} */ this.resolver = resolver;
  }
}

// Phase 6 follow-up: verifyMfaCode rethrows as this when the TOTP code is
// wrong / expired. AUTH-12 chokepoint contract — no firebase/* error codes
// reach views/*. Generic message is safe (no account-enumeration concern;
// caller is already partial-authed at the second-factor step).
export class MfaCodeInvalidError extends Error {
  constructor() {
    super("Invalid verification code");
    this.name = "MfaCodeInvalidError";
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

const MFA_CODE_INVALID_ERROR_CODES = new Set([
  "auth/invalid-verification-code",
  "auth/missing-verification-code",
  "auth/code-expired",
]);

/** @param {string} email @param {string} password */
export async function signInEmailPassword(email, password) {
  // outcome: "failure" | "success" | "mfa-required". MFA-required is NOT a
  // sign-in failure — the password was correct, the user is mid-flight to the
  // second factor. Emitting auth.signin.failure here would poison Phase 9's
  // OBS-05 anomaly counter. The completion audit fires from verifyMfaCode.
  let outcome = "failure";
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    outcome = "success";
    return result;
  } catch (err) {
    const code = (err && /** @type {*} */ (err).code) || "";
    if (code === "auth/multi-factor-auth-required") {
      outcome = "mfa-required";
      const resolver = fbGetMultiFactorResolver(auth, /** @type {*} */ (err));
      throw new MfaRequiredError(resolver);
    }
    if (AUTH_CRED_ERROR_CODES.has(code)) {
      throw new SignInError();
    }
    // Unexpected - let it bubble for observability (Phase 9 Sentry will catch).
    throw err;
  } finally {
    // Phase 9 (AUDIT-05) best-effort emission — never block the auth flow on
    // audit failure. emitAuditEvent's internal try/catch swallows on failure;
    // we wrap again here so a thrown emit (e.g. throw inside the proxy itself)
    // also cannot escape the finally block. MFA-required is skipped — see
    // outcome doc above.
    if (outcome !== "mfa-required") {
      try {
        emitAuditEvent(
          outcome === "success" ? "auth.signin.success" : "auth.signin.failure",
          { type: "user", id: auth.currentUser?.uid ?? "unknown", orgId: null },
          {},
        );
      } catch (_emitErr) {
        // Pattern 5 #2 — best-effort. Never block auth flow on audit failure.
      }
    }
  }
}

/**
 * Complete a 2-factor sign-in by verifying the user's TOTP code against the
 * resolver provided by signInEmailPassword's MfaRequiredError. Assumes a
 * single enrolled TOTP factor — picks resolver.hints[0]. Emits
 * auth.signin.success with payload.method:"totp" on resolved success
 * (mirrors the email-link emission shape in signInWithEmailLink).
 *
 * @param {*} resolver - the MultiFactorResolver from the MfaRequiredError
 * @param {string} verificationCode - 6-digit TOTP code
 * @returns {Promise<*>} resolved user credential
 */
export async function verifyMfaCode(resolver, verificationCode) {
  let outcome = "failure";
  try {
    const hint = resolver.hints[0];
    const assertion = TotpMultiFactorGenerator.assertionForSignIn(hint.uid, verificationCode);
    const result = await resolver.resolveSignIn(assertion);
    outcome = "success";
    return result;
  } catch (err) {
    const code = (err && /** @type {*} */ (err).code) || "";
    if (MFA_CODE_INVALID_ERROR_CODES.has(code)) {
      throw new MfaCodeInvalidError();
    }
    throw err;
  } finally {
    try {
      emitAuditEvent(
        outcome === "success" ? "auth.signin.success" : "auth.signin.failure",
        { type: "user", id: auth.currentUser?.uid ?? "unknown", orgId: null },
        outcome === "success" ? { method: "totp" } : {},
      );
    } catch (_emitErr) {
      // Pattern 5 #2 — best-effort.
    }
  }
}

/** @returns {Promise<void>} */
export async function signOut() {
  // Phase 9 (AUDIT-05) PRE-emit: App Check token + ID-token are revoked by
  // fbSignOut, so auditWrite would reject after — emit BEFORE the side effect.
  // Best-effort: emitAuditEvent's internal try/catch swallows on failure.
  try {
    await emitAuditEvent(
      "auth.signout",
      { type: "user", id: auth.currentUser?.uid ?? "unknown", orgId: null },
      {},
    );
  } catch (_emitErr) {
    // Pattern 5 #2 — best-effort. Never block sign-out on audit failure.
  }
  await fbSignOut(auth);
}

/** @param {*} user */
export function multiFactor(user) {
  return fbMultiFactor(user);
}

// Phase 6 Wave 5 BLOCKER-FIX 1 carry-forward: TOTP enrolment wiring deferred
// during 2026-05-09 cutover-recovery. Three exports below close the gap so
// renderMfaEnrol's deps.qrcodeDataUrl + deps.enrollTotp + deps.unenrollAllMfa
// resolve to working bodies. Audit emit follows the AUDIT-05 best-effort
// pattern from signInEmailPassword above.

/**
 * Begin TOTP enrolment by issuing a fresh secret. Returns the secret (handed
 * to enrollTotp later) and the otpauth:// URI that the caller renders into a
 * QR code. The MFA session is bound to the secret so verification only works
 * for the same in-flight enrolment.
 *
 * @returns {Promise<{ secret: *, totpUri: string }>}
 */
export async function beginTotpEnrollment() {
  const user = auth.currentUser;
  if (!user) throw new SignInError();
  const session = await fbMultiFactor(user).getSession();
  const secret = await TotpMultiFactorGenerator.generateSecret(session);
  const accountName = user.email || user.uid;
  const totpUri = secret.generateQrCodeUrl(accountName, "BeDeveloped Diagnostic");
  return { secret, totpUri };
}

/**
 * Complete TOTP enrolment by verifying the 6-digit code against the secret
 * issued by beginTotpEnrollment.
 *
 * @param {*} secret - the TotpSecret returned from beginTotpEnrollment
 * @param {string} verificationCode - 6-digit code from the authenticator app
 * @param {string} [displayName] - friendly factor name shown in the user's MFA list
 * @returns {Promise<void>}
 */
export async function enrollTotp(secret, verificationCode, displayName) {
  const user = auth.currentUser;
  if (!user) throw new SignInError();
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, verificationCode);
  try {
    await fbMultiFactor(user).enroll(assertion, displayName || "Authenticator app");
  } finally {
    try {
      emitAuditEvent("auth.mfa.enrol", { type: "user", id: user.uid, orgId: null }, {});
    } catch (_emitErr) {
      // Pattern 5 #2 — best-effort.
    }
  }
}

/**
 * Un-enrol every TOTP factor on the current user. Used by the Tier-1
 * forgot-MFA recovery flow after the user re-authenticates via email link.
 *
 * @returns {Promise<void>}
 */
export async function unenrollAllMfa() {
  const user = auth.currentUser;
  if (!user) throw new SignInError();
  const mf = fbMultiFactor(user);
  const factors = mf.enrolledFactors || [];
  try {
    for (const factor of factors) {
      await mf.unenroll(factor);
    }
  } finally {
    try {
      emitAuditEvent(
        "auth.mfa.unenrol",
        { type: "user", id: user.uid, orgId: null },
        { factorCount: factors.length },
      );
    } catch (_emitErr) {
      // Pattern 5 #2 — best-effort.
    }
  }
}

// Phase 6 Wave 3 (BLOCKER-FIX 2): updatePassword export - consumed by views/auth.js
// renderFirstRun's deps.updatePassword. SignInError reuse is intentional -
// failure surfaces a generic message at the chokepoint per D-13.
//
// Phase 6 follow-up (UAT-discovered firstRun loop): Firebase revokes the user's
// refresh tokens server-side the moment updatePassword resolves. Any subsequent
// id-token-requiring call (setClaims callable, audit emit, Firestore listener)
// fails with auth/user-token-expired and onAuthStateChanged fires with null —
// bouncing the user to sign-in BEFORE the firstRun:true claim can be flipped.
// Because the claim is never flipped, the next sign-in re-routes to renderFirstRun
// and the user re-enters the same screen forever. Fix: reauthenticate with the
// brand-new credential immediately after fbUpdatePassword so Firebase mints a
// fresh ID token tied to the new password — then setClaims can run, the claim
// flips, and render proceeds to the MFA enrol path. Since updatePassword is
// only called from renderFirstRun (pre-MFA), the reauth does not trigger an
// MFA challenge.
//
// Phase 7 Wave 5 (BLOCKER-FIX 1 — sub-wave 6.1 row closes): if the current
// id-token claims include `firstRun: true`, invoke the setClaims callable to
// flip firstRun off (server-side setCustomUserClaims path drops firstRun
// because it's not in SetClaimsSchema), then force a getIdToken(true) refresh
// so the new claim is picked up immediately.
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

  // Reauthenticate with the brand-new credential to mint a fresh ID token
  // (Firebase revoked the previous refresh tokens on the password change).
  // Best-effort — if reauth fails, the password DID update; the user will be
  // bounced via onAuthStateChanged and can sign in fresh on the next attempt.
  let reauthed = false;
  if (user.email) {
    try {
      const credential = EmailAuthProvider.credential(user.email, newPassword);
      await fbReauthenticateWithCredential(user, credential);
      reauthed = true;
    } catch (_reauthErr) {
      // Phase 9 Sentry will capture if observability is wired by then.
    }
  }

  // BLOCKER-FIX 1: re-flip firstRun:true → absent + force token refresh.
  // Only attempted after reauth succeeds — otherwise setClaims would fail
  // with auth/user-token-expired (the very failure mode this guard prevents).
  if (reauthed) {
    try {
      const idTokenResult = await user.getIdTokenResult();
      const claims = /** @type {Record<string, unknown>} */ (idTokenResult.claims);
      if (claims.firstRun === true) {
        const role = typeof claims.role === "string" ? /** @type {string} */ (claims.role) : null;
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
      /** @type {*} */ (claimsErr);
    }
  }

  // Phase 9 (AUDIT-05) POST-emit — both firebase update + setClaims have
  // settled (or failed/swallowed). Best-effort: never roll back the successful
  // password update on audit failure. Empty payload — no PII (Pitfall 17).
  try {
    emitAuditEvent("auth.password.change", { type: "user", id: user.uid, orgId: null }, {});
  } catch (_emitErr) {
    // Pattern 5 #2 — best-effort. Never block password change on audit failure.
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
  const result = await fbSignInWithEmailLink(auth, email, url);
  // Phase 9 (AUDIT-05) POST-emit. payload.method distinguishes from
  // password sign-in for downstream analysis (Tier-1 recovery flow).
  // NO email in payload — actor.email is server-set from verified ID-token.
  try {
    emitAuditEvent(
      "auth.signin.success",
      { type: "user", id: auth.currentUser?.uid ?? "unknown", orgId: null },
      { method: "emailLink" },
    );
  } catch (_emitErr) {
    // Pattern 5 #2 — best-effort.
  }
  return result;
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
  const result = await fbSendPasswordResetEmail(auth, email);
  // Phase 9 (AUDIT-05) POST-emit. NO email in payload — caller is by
  // definition not yet authenticated, so target.id is "unknown" (server cannot
  // resolve a uid pre-sign-in). actor.email is server-set from request.auth
  // when the auditWrite callable is invoked from an authenticated session;
  // for this unauthenticated path emitAuditEvent's internal swallow handles
  // the predictable callable rejection (Pitfall 17).
  try {
    emitAuditEvent("auth.password.reset", { type: "user", id: "unknown", orgId: null }, {});
  } catch (_emitErr) {
    // Pattern 5 #2 — best-effort.
  }
  return result;
}
