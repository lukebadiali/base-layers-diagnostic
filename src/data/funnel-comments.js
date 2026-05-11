// src/data/funnel-comments.js
// @ts-check
// Phase 4 Wave 3 (D-09 / D-10 / D-12): full CRUD owner. Per ARCHITECTURE.md §4
// the collection is funnelComments/{commentId} — flat with an orgId field for
// query scoping (no parent collection nesting). subscribeFunnelComments scopes
// the live query by orgId.
import {
  db,
  collection,
  doc,
  addDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from "../firebase/db.js";

/**
 * @param {string} orgId
 * @returns {Promise<Array<any>>}
 */
export async function listFunnelComments(orgId) {
  /** @type {Array<any>} */
  const out = [];
  const snap = await getDocs(
    query(
      collection(db, "funnelComments"),
      where("orgId", "==", orgId),
      where("deletedAt", "==", null),
    ),
  );
  snap.forEach((/** @type {any} */ d) => out.push({ id: d.id, ...d.data() }));
  return out;
}

/**
 * @param {string} orgId
 * @param {*} comment
 * @returns {Promise<{ id: string }>}
 */
export async function addFunnelComment(orgId, comment) {
  const ref = await addDoc(collection(db, "funnelComments"), {
    ...comment,
    orgId,
    createdAt: serverTimestamp(),
  });
  return { id: /** @type {*} */ (ref).id };
}

/**
 * @param {string} commentId
 * @returns {Promise<void>}
 */
export async function deleteFunnelComment(commentId) {
  await deleteDoc(doc(db, "funnelComments", commentId));
}

/**
 * @param {string} orgId
 * @param {{ onChange: (comments: Array<any>) => void, onError: (err: Error) => void }} cb
 * @returns {() => void}
 */
export function subscribeFunnelComments(orgId, { onChange, onError }) {
  return onSnapshot(
    query(
      collection(db, "funnelComments"),
      where("orgId", "==", orgId),
      where("deletedAt", "==", null),
    ),
    (/** @type {any} */ snap) => {
      /** @type {Array<any>} */
      const out = [];
      snap.forEach((/** @type {any} */ d) => out.push({ id: d.id, ...d.data() }));
      onChange(out);
    },
    onError,
  );
}
