// src/domain/bulk-parse.js
// @ts-check
// 2026-08 scope change (Actions tab "Paste multiple"): the delimiter rule for
// bulk list entry. Kept pure — no DOM, no Firebase — so the rule is unit
// testable independently of the modal that calls it (src/main.js
// openBulkActionModal), and so the Plan tab's inline splitter at
// openBulkOutcomeModal can adopt it later without a behaviour surprise today.
//
// The rule, in priority order:
//   1. Any line break present  -> split on line breaks. Commas INSIDE an item
//      are preserved ("Document ICP, including firmographics" stays one item).
//   2. Single line with 2+ "•" -> split on the bullets. Covers lists pasted
//      out of a PDF or slide, which arrive collapsed onto one line.
//   3. Single line that starts with a list marker -> one item. A deliberate
//      bullet signals a list of one, so its commas are content, not delimiters.
//   4. Single line containing a comma -> split on commas.
//   5. Otherwise -> one item.
// Leading markers (-, –, —, •, *, ·, or "1." / "2)" numbering) are stripped
// from every item, and blank items are dropped.

/**
 * Upper bound on one paste. Bulk entry is for a working list of ten or so
 * items; a four-figure count means a mis-paste (a whole document, a CSV
 * column), and each item costs a Firestore write. Callers surface this to
 * the user and refuse the batch rather than truncating it silently.
 */
export const MAX_BULK_ITEMS = 200;

// Bullet-style markers are stripped wherever they lead an item. Numbered
// markers require a following space or end-of-item via lookahead, so
// "1.5x pipeline" and "2026 revenue plan" survive intact.
const LEADING_MARKER = /^\s*(?:[-–—•*·]+\s*|\d+[.)](?=\s|$)\s*)/;

/** @param {string} s */
function stripMarker(s) {
  return s.replace(LEADING_MARKER, "").trim();
}

/**
 * Split pasted text into discrete list items.
 *
 * @param {string} text raw clipboard/textarea contents
 * @returns {string[]} trimmed, marker-stripped items with blanks removed
 */
export function parseBulkList(text) {
  if (typeof text !== "string" || !text.trim()) return [];
  const normalised = text.replace(/\r\n?/g, "\n");

  /** @type {string[]} */
  let parts;
  if (normalised.includes("\n")) {
    parts = normalised.split("\n");
  } else if ((normalised.match(/•/g) || []).length >= 2) {
    parts = normalised.split("•");
  } else if (LEADING_MARKER.test(normalised)) {
    parts = [normalised];
  } else if (normalised.includes(",")) {
    parts = normalised.split(",");
  } else {
    parts = [normalised];
  }

  return parts.map(stripMarker).filter(Boolean);
}
