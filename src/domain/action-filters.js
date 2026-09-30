// src/domain/action-filters.js
// @ts-check
// Milestone v6 (ACT-03): the Actions tab filters by pillar, owner and due
// date. Kept pure — no DOM, no Firebase — so the predicate that decides what
// a consultant is allowed to stop seeing is unit-testable on its own.
//
// Filters run BEFORE grouping (src/domain/action-grouping.js), not after.
// That ordering is deliberate and visible to the user: filtering to "Overdue"
// empties the Completed group, because nothing that is finished is late. The
// alternative — filter inside each group — would leave a Completed section
// populated under an Overdue filter, which reads as a bug.
//
// The three filters compose with AND. Every filter defaults to "all", so the
// unfiltered list is the identity case and costs one cheap comparison per
// action rather than a special-cased early return.

/** Sentinel for "no value set on the action" — a blank pillar or a blank owner. */
export const UNASSIGNED = "none";
/** Sentinel for "do not filter on this field". */
export const ANY = "all";

/**
 * Due-date buckets, in the order they appear in the select.
 *
 * `month` is the current CALENDAR month, not a rolling thirty days: a
 * consultant asking "what is due this month" is looking at the same month
 * boundary their client's board pack is. It therefore includes dates earlier
 * in the month that have already passed, which overlaps with `overdue` on
 * purpose — the two answer different questions.
 */
export const DUE_FILTERS = [
  { key: ANY, label: "Any due date" },
  { key: "overdue", label: "Overdue" },
  { key: "next7", label: "Next 7 days" },
  { key: "month", label: "This month" },
  { key: UNASSIGNED, label: "No due date" },
];

/**
 * Add days to a YYYY-MM-DD string and return the same format. Goes through
 * Date.UTC so the arithmetic never lands on a daylight-saving boundary and
 * silently loses or gains a day.
 *
 * @param {string} iso YYYY-MM-DD
 * @param {number} days
 * @returns {string}
 */
export function addDays(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + days * 86400000;
  return new Date(t).toISOString().slice(0, 10);
}

/** @param {*} a */
function dueOf(a) {
  return typeof a?.due === "string" ? a.due.trim() : "";
}

/** @param {*} a */
function ownerOf(a) {
  return typeof a?.owner === "string" ? a.owner.trim() : "";
}

/**
 * Distinct owner names present on the given actions, case-insensitively
 * de-duplicated and sorted for display.
 *
 * `owner` is free text, not a user reference, so "Jane", "jane" and " Jane "
 * are one person with three spellings. The first spelling seen wins, which
 * keeps the dropdown showing what the consultant actually typed rather than a
 * lowercased normalisation of it. Filtering then matches case-insensitively,
 * so picking any spelling finds all three.
 *
 * @param {Array<*>} actions
 * @returns {string[]}
 */
export function ownerOptions(actions) {
  /** @type {Map<string, string>} */
  const seen = new Map();
  (Array.isArray(actions) ? actions : []).forEach((a) => {
    const owner = ownerOf(a);
    if (!owner) return;
    const key = owner.toLowerCase();
    if (!seen.has(key)) seen.set(key, owner);
  });
  return Array.from(seen.values()).sort((a, b) =>
    a.localeCompare(b, "en-GB", { sensitivity: "base" }),
  );
}

/** @param {Array<*>} actions */
export function hasUnassignedOwner(actions) {
  return (Array.isArray(actions) ? actions : []).some((a) => a && !ownerOf(a));
}

/** @param {Array<*>} actions */
export function hasUnassignedPillar(actions) {
  return (Array.isArray(actions) ? actions : []).some(
    (a) => a && (a.pillarId === null || a.pillarId === undefined || a.pillarId === ""),
  );
}

/**
 * @param {*} action
 * @param {string|number} pillar ANY, UNASSIGNED, or a pillar id
 */
function matchesPillar(action, pillar) {
  if (pillar === ANY) return true;
  const id = action?.pillarId;
  const unassigned = id === null || id === undefined || id === "";
  if (pillar === UNASSIGNED) return unassigned;
  return !unassigned && String(id) === String(pillar);
}

/**
 * @param {*} action
 * @param {string} owner ANY, UNASSIGNED, or an owner name
 */
function matchesOwner(action, owner) {
  if (owner === ANY) return true;
  const actual = ownerOf(action);
  if (owner === UNASSIGNED) return !actual;
  return actual.toLowerCase() === owner.toLowerCase();
}

/**
 * @param {*} action
 * @param {string} due one of DUE_FILTERS' keys
 * @param {string} todayIso YYYY-MM-DD
 */
function matchesDue(action, due, todayIso) {
  if (due === ANY) return true;
  const actual = dueOf(action);
  if (due === UNASSIGNED) return !actual;
  if (!actual) return false;
  switch (due) {
    // Completion settles the question: a finished action is not overdue,
    // however long ago its date passed. Same rule as groupActions.
    case "overdue":
      return !action.done && actual < todayIso;
    case "next7":
      return actual >= todayIso && actual <= addDays(todayIso, 7);
    case "month":
      return actual.slice(0, 7) === todayIso.slice(0, 7);
    default:
      return true;
  }
}

/**
 * @typedef {{ pillar?: string|number, owner?: string, due?: string }} ActionFilterCriteria
 */

/** Every filter cleared — the identity criteria. */
export const NO_FILTERS = Object.freeze({ pillar: ANY, owner: ANY, due: ANY });

/**
 * @param {ActionFilterCriteria} [criteria]
 * @returns {boolean} true when at least one filter is narrowing the list
 */
export function isFiltered(criteria) {
  const c = criteria || {};
  return (c.pillar ?? ANY) !== ANY || (c.owner ?? ANY) !== ANY || (c.due ?? ANY) !== ANY;
}

/**
 * Apply the pillar, owner and due filters together. Input is never mutated.
 *
 * @param {Array<*>} actions
 * @param {ActionFilterCriteria} [criteria]
 * @param {string} [todayIso] YYYY-MM-DD — required only for the date buckets
 * @returns {Array<*>}
 */
export function filterActions(actions, criteria, todayIso = "") {
  if (!Array.isArray(actions)) return [];
  const pillar = criteria?.pillar ?? ANY;
  const owner = criteria?.owner ?? ANY;
  const due = criteria?.due ?? ANY;
  return actions.filter(
    (a) => a && matchesPillar(a, pillar) && matchesOwner(a, owner) && matchesDue(a, due, todayIso),
  );
}
