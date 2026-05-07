// src/data/users.js
// @ts-check
// Phase 4 Wave 3 (D-09 / D-10 / D-12): full CRUD owner. Mirrors orgs.js shape
// against the users/{userId} top-level collection (per ARCHITECTURE.md §4).
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
 * @param {string} userId
 * @returns {Promise<any|null>}
 */
export async function getUser(userId) {
  const snap = await getDoc(doc(db, "users", userId));
  return snap.exists() ? snap.data() : null;
}

/**
 * @returns {Promise<Array<any>>}
 */
export async function listUsers() {
  /** @type {Array<any>} */
  const out = [];
  const snap = await getDocs(collection(db, "users"));
  snap.forEach((/** @type {any} */ d) => out.push({ id: d.id, ...d.data() }));
  return out;
}

/**
 * @param {*} user
 * @returns {Promise<void>}
 */
export async function saveUser(user) {
  await setDoc(doc(db, "users", user.id), user, { merge: true });
}

/**
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function deleteUser(userId) {
  await deleteDoc(doc(db, "users", userId));
}

/**
 * @param {{ onChange: (users: Array<any>) => void, onError: (err: Error) => void }} cb
 * @returns {() => void}
 */
export function subscribeUsers({ onChange, onError }) {
  return onSnapshot(
    collection(db, "users"),
    (/** @type {any} */ snap) => {
      /** @type {Array<any>} */
      const out = [];
      snap.forEach((/** @type {any} */ d) => out.push({ id: d.id, ...d.data() }));
      onChange(out);
    },
    onError,
  );
}
