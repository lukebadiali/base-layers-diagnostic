// src/auth/session-policy.js
// @ts-check
//
// Client-side session-age cap. The app keeps returning users signed in via
// Firebase Auth's default browserLocalPersistence, which never expires on its
// own (refresh tokens are indefinite). The product requirement is "continuous
// login, but only for up to 30 days" — so we gate on the last *interactive*
// sign-in and bounce the user back to the sign-in screen once that is older
// than SESSION_MAX_AGE_MS.
//
// Anchor: fbUser.metadata.lastSignInTime (a UTC date string). It updates only
// on a genuine sign-in (signInWithEmailAndPassword / resolveSignIn), never on
// the hourly silent ID-token refresh — so it measures exactly "how long since
// the user actually authenticated", which is what "up to 30 days" means. The
// window is fixed from that sign-in (not rolling per visit).
//
// This is a client-side gate, appropriate for the threat model here (a hostile
// *authenticated* user extending their own session is out of scope) and the
// compliance-credible bar. Server-side forced revocation would need Cloud
// Functions and is out of scope. Pure logic — zero firebase/* imports per the
// CLAUDE.md domain/auth invariant, which also makes it directly unit-testable.

/** 30 days, in milliseconds. */
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * True when the user's last interactive sign-in is older than the 30-day cap
 * and they should be signed out. Fails open (returns false) when the timestamp
 * is missing or unparseable, so a metadata quirk can never lock out a valid
 * user — the worst case of a bad parse is one extra day of session, not a
 * lockout. A last-sign-in dated in the future (clock skew) is likewise treated
 * as not expired.
 *
 * @param {string | null | undefined} lastSignInTimeStr - fbUser.metadata.lastSignInTime
 * @param {number} nowMs - current time in epoch ms (Date.now())
 * @returns {boolean}
 */
export function isSessionExpired(lastSignInTimeStr, nowMs) {
  if (!lastSignInTimeStr) return false;
  const lastSignInMs = Date.parse(lastSignInTimeStr);
  if (Number.isNaN(lastSignInMs)) return false;
  return nowMs - lastSignInMs > SESSION_MAX_AGE_MS;
}
