// src/data/read-states.js
// @ts-check
// Phase 5 Wave 3 (D-12 / DATA-07 / 05-03): NEW wrapper backed by
// orgs/{orgId}/readStates/{userId}. All writes use serverTimestamp() so
// Wave 4's H7 fix (domain/unread.js comparator rewrite) can compare
// server-time values exclusively. The legacy nested-map at
// orgs/{orgId}.readStates is retained on the parent doc through migration
// (Wave 2 buildReadStatesInit) but no longer read by domain/unread (Wave 4).
//
// Document shape:
//   {
//     pillarReads: { [pillarId]: Timestamp },
//     chatLastRead: Timestamp | null,
//     legacyAppUserId?: string,
//   }
//
// Cleanup-ledger row queued for Phase 4 → Phase 5 forward-tracking: this
// is the substrate Wave 4's H7 fix (domain/unread.js) consumes via injected
// accessor (domain/* imports nothing Firebase per Phase 4 ESLint Wave 2).
import {
  db,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from "../firebase/db.js";

/**
 * @typedef {object} ReadState
 * @property {Record<string, *>} pillarReads - per-pillar last-read serverTimestamp values
 * @property {*} chatLastRead - chat last-read serverTimestamp or null
 * @property {string} [legacyAppUserId]
 */

/**
 * @param {string} orgId
 * @param {string} userId
 * @returns {Promise<ReadState|null>}
 */
export async function getReadState(orgId, userId) {
  const snap = await getDoc(doc(db, "orgs", orgId, "readStates", userId));
  return snap.exists() ? /** @type {ReadState} */ (snap.data()) : null;
}

/**
 * @param {string} orgId
 * @param {string} userId
 * @param {string} pillarId
 * @returns {Promise<void>}
 */
export async function setPillarRead(orgId, userId, pillarId) {
  await setDoc(
    doc(db, "orgs", orgId, "readStates", userId),
    { pillarReads: { [pillarId]: serverTimestamp() } },
    { merge: true },
  );
}

/**
 * @param {string} orgId
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function setChatRead(orgId, userId) {
  await setDoc(
    doc(db, "orgs", orgId, "readStates", userId),
    { chatLastRead: serverTimestamp() },
    { merge: true },
  );
}

/**
 * @param {string} orgId
 * @param {string} userId
 * @param {{ onChange: (state: ReadState|null) => void, onError: (err: Error) => void }} cb
 * @returns {() => void}
 */
export function subscribeReadState(orgId, userId, { onChange, onError }) {
  return onSnapshot(
    doc(db, "orgs", orgId, "readStates", userId),
    (/** @type {*} */ snap) => onChange(snap.exists() ? snap.data() : null),
    onError,
  );
}
