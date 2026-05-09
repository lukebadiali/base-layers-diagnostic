// src/data/funnels.js
// @ts-check
// Phase 4 Wave 3 (D-09 / D-10 / D-12): full CRUD owner. Per ARCHITECTURE.md §4
// the collection is funnels/{orgId} — one funnel doc per org.
import {
  db,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
} from "../firebase/db.js";

/**
 * @param {string} orgId
 * @returns {Promise<any|null>}
 */
export async function getFunnel(orgId) {
  const snap = await getDoc(doc(db, "funnels", orgId));
  return snap.exists() ? snap.data() : null;
}

/**
 * @returns {Promise<Array<any>>}
 */
export async function listFunnels() {
  /** @type {Array<any>} */
  const out = [];
  const snap = await getDocs(collection(db, "funnels"));
  snap.forEach((/** @type {any} */ d) => out.push({ id: d.id, ...d.data() }));
  return out;
}

/**
 * @param {string} orgId
 * @param {*} funnel
 * @returns {Promise<void>}
 */
export async function saveFunnel(orgId, funnel) {
  await setDoc(doc(db, "funnels", orgId), funnel, { merge: true });
}

/**
 * @param {string} orgId
 * @returns {Promise<void>}
 */
export async function deleteFunnel(orgId) {
  await deleteDoc(doc(db, "funnels", orgId));
}

/**
 * @param {{ onChange: (funnels: Array<any>) => void, onError: (err: Error) => void }} cb
 * @returns {() => void}
 */
export function subscribeFunnels({ onChange, onError }) {
  return onSnapshot(
    collection(db, "funnels"),
    (/** @type {any} */ snap) => {
      /** @type {Array<any>} */
      const out = [];
      snap.forEach((/** @type {any} */ d) => out.push({ id: d.id, ...d.data() }));
      onChange(out);
    },
    onError,
  );
}
