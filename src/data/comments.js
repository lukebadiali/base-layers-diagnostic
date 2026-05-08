// src/data/comments.js
// @ts-check
// Phase 5 Wave 3 (DATA-01 / D-11 / 05-03): subcollection access at
// orgs/{orgId}/comments/{cmtId}. API surface unchanged from Phase 4 D-09 /
// D-10 — listComments, addComment, deleteComment keep their names +
// signatures verbatim per D-11.
//
// Cleanup-ledger row: "Phase 5 (DATA-01) replaces body with subcollection
// access (orgs/{orgId}/comments/{cmtId}); data/comments.js API stable" —
// CLOSES with this commit.
//
// D-03 invariant: addComment carries `legacyAuthorId: comment.authorId` so
// Phase 6 (AUTH-15) can backfill firebaseUid in-place.
import {
  db,
  collection,
  doc,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from "../firebase/db.js";

/**
 * @param {string} orgId
 * @param {number|string} pillarId
 * @returns {Promise<Array<any>>}
 */
export async function listComments(orgId, pillarId) {
  const q = query(
    collection(db, "orgs", orgId, "comments"),
    where("pillarId", "==", String(pillarId)),
  );
  const snap = await getDocs(q);
  /** @type {Array<any>} */
  const out = [];
  snap.forEach((/** @type {any} */ d) => out.push({ id: d.id, ...d.data() }));
  return out;
}

/**
 * @param {string} orgId
 * @param {number|string} pillarId
 * @param {*} comment
 * @returns {Promise<void>}
 */
export async function addComment(orgId, pillarId, comment) {
  await addDoc(
    collection(db, "orgs", orgId, "comments"),
    {
      ...comment,
      pillarId: String(pillarId),
      legacyAuthorId: comment?.authorId, // D-03 inline legacy field
      createdAt: serverTimestamp(),
    },
  );
}

/**
 * @param {string} orgId
 * @param {number|string} _pillarId   - unused in subcollection model; preserved per Phase 4 D-09 API contract
 * @param {string} commentId
 * @returns {Promise<void>}
 */
export async function deleteComment(orgId, _pillarId, commentId) {
  await deleteDoc(doc(db, "orgs", orgId, "comments", commentId));
}
