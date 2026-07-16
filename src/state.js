// src/state.js
// @ts-check
// Phase 4 Wave 5 (D-02 / D-12): byte-identical extraction of the in-memory
// state singleton from app.js:574-587. Exported as the canonical source of
// truth — main.js + router.js + (eventually) src/views/* all import from
// here. Phase 6 (AUTH-14) will tighten state shape when Firebase Auth
// replaces the local-allowlist substrate.
//
// LocalStorage key: "baselayers:mode" — preserved verbatim from app.js
// (K.mode = "baselayers:mode") for clean cutover with no migration logic.

/**
 * @typedef {{
 *   mode: string,
 *   route: string,
 *   orgId: string|null,
 *   accountId: string|null,
 *   viewRoundId: string|null,
 *   pillarId: number|null,
 *   chart: *,
 *   userMenuOpen: boolean,
 *   authTab: string,
 *   authError: string,
 *   expandedPillars: Set<number>,
 *   activity: { messages: Record<string, Array<*>>, documents: Record<string, Array<*>> },
 *   bellOpen: boolean,
 *   fbUser: *,
 *   authResolved: boolean,
 *   qrcodeDataUrl: string|null,
 *   mfaResolver: *,
 * }} AppState
 */

/**
 * Reads the persisted mode from localStorage. Mirrors app.js's `jget(K.mode,
 * "internal")` shape — falls back to "internal" when the key is unset or
 * corrupt.
 * @returns {string}
 */
function readPersistedMode() {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem("baselayers:mode") : null;
    if (v == null) return "internal";
    // app.js's jget JSON-parses; preserve that shape so existing persisted
    // values (string-quoted "internal" / "external") round-trip correctly.
    try {
      const parsed = JSON.parse(v);
      return typeof parsed === "string" ? parsed : "internal";
    } catch {
      // Tolerate raw string values stored without JSON quotes (defensive).
      return typeof v === "string" ? v : "internal";
    }
  } catch {
    return "internal";
  }
}

/** @type {AppState} */
export const state = {
  mode: readPersistedMode(), // internal view mode (only meaningful for internal role)
  route: "dashboard",
  orgId: null, // current selected org (for internal role; for client it's pinned)
  accountId: null, // internal-only: the account (client user id) being "entered"
  viewRoundId: null, // the round being viewed/edited for that account (null = current)
  pillarId: null,
  chart: null,
  userMenuOpen: false,
  authTab: "client",
  authError: "",
  expandedPillars: new Set(), // dashboard-tile accordion state
  // Scope item 7 (2026-07): per-org live activity feeds for the bell +
  // unread badges. Keyed by orgId; populated by ensureActivitySubscriptions
  // in main.js (one messages + one documents listener per org, limit 30).
  activity: { messages: {}, documents: {} },
  bellOpen: false, // bell dropdown open state (survives re-renders)
  // Phase 6 Wave 5 (BLOCKER-FIX 1): Firebase Auth user shim — null when
  // unauthenticated; populated by main.js's onAuthStateChanged callback with
  // a hybrid object that exposes BOTH the Firebase User properties (uid,
  // email, emailVerified, appClaims, appEnrolledFactors) AND the legacy
  // shape (id, role, name, orgId) so existing render functions work
  // unchanged. Phase 7+ tightens this when the legacy substrate retires.
  fbUser: null,
  // False until Firebase Auth has reported the initial persisted-session
  // state (the first onAuthStateChanged fire, user OR null). Until then,
  // render() paints a neutral splash instead of the sign-in screen — this is
  // what stops the login screen flashing for already-signed-in users while
  // Firebase resolves the persisted session asynchronously on cold load.
  authResolved: false,
  // Pre-rendered QR-code data URL for renderMfaEnrol. Populated when MFA
  // enrolment is initiated (deferred to user-testing phase).
  qrcodeDataUrl: null,
  // Live Firebase MultiFactorResolver for the in-flight MFA challenge (set by
  // main.js when signInEmailPassword throws MfaRequiredError; cleared on
  // resolve or cancel). Transient + non-serializable — never persist.
  mfaResolver: null,
};
