// src/domain/document-sort.js
// @ts-check
// Milestone v6 (FILE-05): the document list sorts by date added (default),
// name, or uploader. Kept pure — no DOM, no Firebase — even though the
// timestamps it reads arrive as Firestore Timestamp objects, because the
// alternative is a sort comparator that can only be exercised by booting the
// whole app against an emulator.
//
// createdAt is tolerated in three shapes: a Firestore Timestamp (toMillis),
// a Date, or an ISO string. The live listener hands over Timestamps; the
// localStorage mirror and the test fixtures hand over strings. A sort that
// silently treats one of those as zero puts every affected file at the bottom
// of a date-ordered list, which looks like data loss rather than a sort bug.

/** Sort keys, in the order they appear in the select. `added` is the default. */
export const DOCUMENT_SORT_KEYS = [
  { key: "added", label: "Date added (newest first)" },
  { key: "name", label: "Name (A-Z)" },
  { key: "uploader", label: "Uploader (A-Z)" },
];

export const DEFAULT_DOCUMENT_SORT = "added";

/** localStorage key holding the viewer's chosen sort. Per browser, not per org. */
export const DOCUMENT_SORT_STORAGE_KEY = "baselayers:docSort";

/**
 * Milliseconds since epoch for a document's createdAt, whatever shape it
 * arrived in. Unparseable or missing timestamps return 0.
 *
 * @param {*} d
 * @returns {number}
 */
export function createdMillis(d) {
  const v = d?.createdAt;
  if (v == null) return 0;
  if (typeof v.toMillis === "function") return v.toMillis() || 0;
  if (typeof v.toDate === "function") {
    const t = v.toDate();
    return t instanceof Date ? t.getTime() : 0;
  }
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  const parsed = Date.parse(String(v));
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** @param {*} d */
export function displayName(d) {
  return String(d?.filename || d?.name || "");
}

/** @param {*} d */
export function uploaderLabel(d) {
  return String(d?.uploaderName || d?.uploaderEmail || "");
}

/**
 * Compare two strings the way a file browser does: case-insensitive, and with
 * embedded numbers ordered numerically, so "Report 2" sorts before
 * "Report 10" instead of after it.
 *
 * @param {string} a
 * @param {string} b
 */
function compareLabels(a, b) {
  return a.localeCompare(b, "en-GB", { sensitivity: "base", numeric: true });
}

/**
 * Sort documents by the given key. Returns a new array; input is never
 * mutated (the caller's array is usually the live snapshot's own).
 *
 * Every sort falls back to newest-first on ties, so two files uploaded by the
 * same person under the same name still hold a stable, meaningful order
 * rather than whatever order the snapshot happened to arrive in.
 *
 * A document with no uploader recorded sorts to the end of an uploader sort
 * rather than to the top under an empty string, so the named people — the
 * ones the viewer is actually scanning for — stay together.
 *
 * @param {Array<*>} docs
 * @param {string} [key] one of DOCUMENT_SORT_KEYS
 * @returns {Array<*>}
 */
export function sortDocuments(docs, key = DEFAULT_DOCUMENT_SORT) {
  const out = (Array.isArray(docs) ? docs : []).slice();
  const newestFirst = (/** @type {*} */ a, /** @type {*} */ b) =>
    createdMillis(b) - createdMillis(a);

  if (key === "name") {
    out.sort((a, b) => compareLabels(displayName(a), displayName(b)) || newestFirst(a, b));
  } else if (key === "uploader") {
    out.sort((a, b) => {
      const ua = uploaderLabel(a);
      const ub = uploaderLabel(b);
      if (!ua !== !ub) return ua ? -1 : 1;
      return (
        compareLabels(ua, ub) || compareLabels(displayName(a), displayName(b)) || newestFirst(a, b)
      );
    });
  } else {
    out.sort(newestFirst);
  }
  return out;
}

/**
 * Folders always sort by name and always sit above files, whatever the file
 * sort is set to. Sorting folders by "uploader" or by "date added" would be
 * technically answerable and practically useless — nobody navigates a tree by
 * when its branches were created.
 *
 * @param {Array<*>} folders
 * @returns {Array<*>}
 */
export function sortFolders(folders) {
  return (Array.isArray(folders) ? folders : [])
    .slice()
    .sort((a, b) => compareLabels(String(a?.name || ""), String(b?.name || "")));
}

/**
 * Narrow a stored or user-supplied sort key to one this module implements.
 * An unknown key (a stale localStorage value from an older build, say) falls
 * back to the default rather than silently producing an unsorted list.
 *
 * @param {*} key
 * @returns {string}
 */
export function normaliseSortKey(key) {
  return DOCUMENT_SORT_KEYS.some((k) => k.key === key) ? String(key) : DEFAULT_DOCUMENT_SORT;
}
