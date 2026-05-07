// src/util/ids.js
// @ts-check
// Phase 2 (D-05): byte-identical extraction from app.js:42-44, 46, 48-57, 68-74, 76-91.
// formatDate (app.js:59-66) intentionally NOT extracted — not on the D-02 target list.

/**
 * @param {string} [p] prefix
 * @returns {string} prefix + 11 hex chars from crypto.randomUUID()
 *
 * Phase 4 (CODE-03): swapped from the legacy PRNG-backed implementation
 * (the Math `random` + Date `now` base-36 encoding) to crypto.randomUUID()
 * (CSPRNG). Closes the cleanup-ledger row at src/util/ids.js:7 (CWE-330
 * mitigation — the legacy PRNG was predictable).
 * The Date.now() suffix is removed because crypto.randomUUID() is monotonic-uniqueness-
 * sufficient on its own. Output shape changed from `prefix+5chars+4chars` (9 total
 * past prefix) to `prefix+11hex` (11 hex chars past prefix); IDs minted before this
 * swap remain comparable as opaque strings (PROJECT.md "no backwards-compat window"
 * — clean cutover acceptable).
 */
export const uid = (p = "") => p + crypto.randomUUID().replace(/-/g, "").slice(0, 11);

export const iso = () => new Date().toISOString();

/** @param {string|number|null|undefined} when */
export const formatWhen = (when) => {
  if (!when) return "";
  const d = new Date(when);
  // CODE-11 (Phase 4 Wave 6): Math.floor instead of Math.round so labels
  // are monotonic-decreasing as time passes. With Math.round, a 90s-old
  // entry would render "2m ago" then drift back to "1m ago" as it became
  // 91s old (1.5 → 1.51 minutes; round flips at the .5 boundary). Math.floor
  // keeps "1m ago" stable until 120s elapses. Closes CONCERNS L4.
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
  if (mins < 60 * 24 * 7) return `${Math.floor(mins / (60 * 24))}d ago`;
  return d.toLocaleDateString();
};

/** @param {string} [name=""] */
export const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("");

// Take "Luke Badiali" -> "Luke", "luke.badiali@x.com" -> "Luke", "luke@x.com" -> "Luke".
// Plan 02-06 (Wave 5, D-15): the falsy branch is unreachable because every caller
// guards via `if (piece)` (line 47). c8 ignore preserves byte-identical D-05
// extraction while satisfying the 100% src/util/** threshold.
/* c8 ignore next */
const capitalise = (/** @type {string} */ s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** @param {{authorName?:string, authorEmail?:string}} m */
export const firstNameFromAuthor = (m) => {
  const name = (m.authorName || "").trim();
  if (name) {
    // After (...||"").trim(), if `name` is truthy then `name.split(/\s+/)[0]` is
    // always non-empty — the false branch of `if (first)` is unreachable.
    // c8 ignore preserves byte-identical D-05 extraction while satisfying the
    // 100% src/util/** threshold (Plan 02-06 / D-15).
    const first = name.split(/\s+/)[0];
    /* c8 ignore next */
    if (first) return first;
  }
  const email = (m.authorEmail || "").trim();
  if (email) {
    const local = email.split("@")[0] || "";
    const piece = local.split(/[.\-_+]/)[0] || "";
    if (piece) return capitalise(piece);
  }
  return "Unknown";
};
