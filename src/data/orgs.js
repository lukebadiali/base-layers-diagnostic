// src/data/orgs.js
// @ts-check
// Phase 4 Wave 3 (D-09 / D-10 / D-12): full CRUD owner per D-09. Phase 5
// (DATA-01..06) rewrites this body to use subcollection access
// (orgs/{orgId}/{collection}) — the Promise-CRUD-+-subscribe API surface
// stays stable across the cutover.
//
// IMPORTANT: data/responses.js, comments.js, actions.js, documents.js,
// messages.js, audit-events.js are pass-throughs that delegate here per D-09.
// Phase 5 replaces ALL of those bodies + this body in one wave.
//
// Cleanup-ledger row: "Phase 5 (DATA-01) replaces body with subcollection
// access (orgs/{orgId}/{collection}); orgs.js API stable" — closes at Phase 5.
import {
  db,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from "../firebase/db.js";

/**
 * @param {string} orgId
 * @returns {Promise<any|null>}
 */
export async function getOrg(orgId) {
  const snap = await getDoc(doc(db, "orgs", orgId));
  return snap.exists() ? snap.data() : null;
}

/**
 * @returns {Promise<Array<any>>}
 */
export async function listOrgs() {
  /** @type {Array<any>} */
  const out = [];
  const snap = await getDocs(collection(db, "orgs"));
  snap.forEach((/** @type {any} */ d) => out.push({ id: d.id, ...d.data() }));
  return out;
}

/**
 * @param {*} org
 * @returns {Promise<void>}
 */
export async function saveOrg(org) {
  await setDoc(doc(db, "orgs", org.id), { ...org, updatedAt: serverTimestamp() }, { merge: true });
}

/**
 * @param {string} orgId
 * @returns {Promise<void>}
 */
export async function deleteOrg(orgId) {
  await deleteDoc(doc(db, "orgs", orgId));
}

/**
 * @param {{ onChange: (orgs: Array<any>) => void, onError: (err: Error) => void }} cb
 * @returns {() => void}
 */
export function subscribeOrgs({ onChange, onError }) {
  return onSnapshot(
    collection(db, "orgs"),
    (/** @type {any} */ snap) => {
      /** @type {Array<any>} */
      const out = [];
      snap.forEach((/** @type {any} */ d) => out.push({ id: d.id, ...d.data() }));
      onChange(out);
    },
    onError,
  );
}
