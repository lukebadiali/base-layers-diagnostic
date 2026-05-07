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
 *   pillarId: number|null,
 *   chart: *,
 *   userMenuOpen: boolean,
 *   authTab: string,
 *   authError: string,
 *   expandedPillars: Set<number>,
 *   chatMessages: Array<*>,
 *   chatSubscription: (() => void) | null,
 *   chatSubscribedFor: string|null,
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
  pillarId: null,
  chart: null,
  userMenuOpen: false,
  authTab: "client",
  authError: "",
  expandedPillars: new Set(), // dashboard-tile accordion state
  chatMessages: [], // live feed from Firestore, filtered by role
  chatSubscription: null, // unsubscribe function for the live listener
  chatSubscribedFor: null, // user.id the current subscription is for
};
