// src/data/responses.js
// @ts-check
// Phase 5 Wave 3 (DATA-01 / D-11 / 05-03 / RESEARCH Pattern 3): subcollection
// access at orgs/{orgId}/responses/{respId} where respId = roundId__userId__pillarId.
// API surface unchanged from Phase 4 D-09 / D-10 — listResponses, saveResponse,
// deleteResponse keep their names + signatures + return types verbatim per D-11.
//
// Cleanup-ledger row: "Phase 5 (DATA-01) replaces body with subcollection
// access (orgs/{orgId}/responses/{respId}); data/responses.js API stable" —
// CLOSES with this commit.
//
// D-03 invariant: every write carries `legacyAppUserId: userId` so Phase 6
// (AUTH-15) can backfill the firebaseUid mapping in-place.
import {
  db,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "../firebase/db.js";

/**
 * @param {string} roundId
 * @param {string} userId
 * @param {number|string} pillarId
 * @returns {string}
 */
function buildRespId(roundId, userId, pillarId) {
  return `${roundId}__${userId}__${String(pillarId)}`;
}

/**
 * @param {string} orgId
 * @param {string} roundId
 * @param {string} userId
 * @param {number|string} pillarId
 * @returns {Promise<Array<any>>}
 */
export async function listResponses(orgId, roundId, userId, pillarId) {
  const respId = buildRespId(roundId, userId, pillarId);
  const snap = await getDoc(doc(db, "orgs", orgId, "responses", respId));
  if (!snap.exists()) return [];
  const data = snap.data();
  return Array.isArray(data?.values) ? data.values.slice() : [];
}

/**
 * @param {string} orgId
 * @param {string} roundId
 * @param {string} userId
 * @param {number|string} pillarId
 * @param {number} idx
 * @param {*} value
 * @returns {Promise<void>}
 */
export async function saveResponse(orgId, roundId, userId, pillarId, idx, value) {
  const respId = buildRespId(roundId, userId, pillarId);
  const ref = doc(db, "orgs", orgId, "responses", respId);
  // Read-modify-write: the original API contract accumulates per-idx values
  // into a single per-(round,user,pillar) array. Subcollection rewrite
  // preserves that shape by reading the existing doc, mutating values[idx],
  // writing back via merge.
  const existing = await getDoc(ref);
  /** @type {Array<any>} */
  const values = existing.exists() && Array.isArray(existing.data()?.values)
    ? existing.data().values.slice()
    : [];
  values[idx] = value;
  await setDoc(
    ref,
    {
      roundId,
      userId,
      pillarId: String(pillarId),
      values,
      legacyAppUserId: userId,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * @param {string} orgId
 * @param {string} roundId
 * @param {string} userId
 * @param {number|string} pillarId
 * @returns {Promise<void>}
 */
export async function deleteResponse(orgId, roundId, userId, pillarId) {
  const respId = buildRespId(roundId, userId, pillarId);
  await deleteDoc(doc(db, "orgs", orgId, "responses", respId));
}
