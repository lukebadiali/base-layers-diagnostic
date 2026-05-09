// src/data/roadmaps.js
// @ts-check
// Phase 4 Wave 3 (D-09 / D-10 / D-12): full CRUD owner. Per ARCHITECTURE.md §4
// the collection is roadmaps/{orgId} — one roadmap doc per org.
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
export async function getRoadmap(orgId) {
  const snap = await getDoc(doc(db, "roadmaps", orgId));
  return snap.exists() ? snap.data() : null;
}

/**
 * @returns {Promise<Array<any>>}
 */
export async function listRoadmaps() {
  /** @type {Array<any>} */
  const out = [];
  const snap = await getDocs(collection(db, "roadmaps"));
  snap.forEach((/** @type {any} */ d) => out.push({ id: d.id, ...d.data() }));
  return out;
}

/**
 * @param {string} orgId
 * @param {*} roadmap
 * @returns {Promise<void>}
 */
export async function saveRoadmap(orgId, roadmap) {
  await setDoc(doc(db, "roadmaps", orgId), roadmap, { merge: true });
}

/**
 * @param {string} orgId
 * @returns {Promise<void>}
 */
export async function deleteRoadmap(orgId) {
  await deleteDoc(doc(db, "roadmaps", orgId));
}

/**
 * @param {{ onChange: (roadmaps: Array<any>) => void, onError: (err: Error) => void }} cb
 * @returns {() => void}
 */
export function subscribeRoadmaps({ onChange, onError }) {
  return onSnapshot(
    collection(db, "roadmaps"),
    (/** @type {any} */ snap) => {
      /** @type {Array<any>} */
      const out = [];
      snap.forEach((/** @type {any} */ d) => out.push({ id: d.id, ...d.data() }));
      onChange(out);
    },
    onError,
  );
}
