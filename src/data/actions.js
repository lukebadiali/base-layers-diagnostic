// src/data/actions.js
// @ts-check
// Phase 5 Wave 3 (DATA-01 / D-11 / 05-03): subcollection access at
// orgs/{orgId}/actions/{actId}. API surface unchanged from Phase 4 D-09 /
// D-10 — listActions, saveAction, deleteAction keep their names +
// signatures verbatim per D-11.
//
// Cleanup-ledger row: "Phase 5 (DATA-01) replaces body with subcollection
// access (orgs/{orgId}/actions/{actId}); data/actions.js API stable" —
// CLOSES with this commit.
//
// D-03 invariant: every write carries `legacyAppUserId: action.ownerId` so
// Phase 6 (AUTH-15) can backfill firebaseUid in-place.
import {
  db,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "../firebase/db.js";

/**
 * @param {string} orgId
 * @returns {Promise<Array<any>>}
 */
export async function listActions(orgId) {
  const snap = await getDocs(collection(db, "orgs", orgId, "actions"));
  /** @type {Array<any>} */
  const out = [];
  snap.forEach((/** @type {any} */ d) => out.push({ id: d.id, ...d.data() }));
  return out;
}

/**
 * @param {string} orgId
 * @param {*} action
 * @returns {Promise<void>}
 */
export async function saveAction(orgId, action) {
  if (!action?.id) throw new Error("action.id required");
  await setDoc(
    doc(db, "orgs", orgId, "actions", action.id),
    {
      ...action,
      orgId,
      legacyAppUserId: action.ownerId, // D-03 inline legacy field
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * @param {string} orgId
 * @param {string} actionId
 * @returns {Promise<void>}
 */
export async function deleteAction(orgId, actionId) {
  await deleteDoc(doc(db, "orgs", orgId, "actions", actionId));
}
