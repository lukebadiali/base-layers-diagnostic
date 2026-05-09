// src/data/messages.js
// @ts-check
// Phase 5 Wave 3 (DATA-01 / D-11 / 05-03): subcollection access at
// orgs/{orgId}/messages/{msgId}. API surface unchanged from Phase 4 D-09 /
// D-10 — listMessages, addMessage, subscribeMessages keep their names +
// signatures verbatim per D-11.
//
// CRITICAL (H8-precursor wiring): subscribeMessages now subscribes to the
// SUBCOLLECTION via onSnapshot(collection(db, 'orgs', orgId, 'messages'), ...).
// The Phase 4 baseline subscribed to the PARENT doc (orgs/{orgId}) and
// projected the messages map; that pattern triggered H8 last-writer-wins
// over the entire org doc on every chat write. This commit rewires the
// listener; Wave 4 Commit B closes H8 fully by rewriting data/cloud-sync.js.
//
// Cleanup-ledger row: "Phase 5 (DATA-01) replaces body with subcollection
// access (orgs/{orgId}/messages/{msgId}); data/messages.js API stable" —
// CLOSES with this commit.
//
// D-03 invariant: every write carries `legacyAuthorId: message.authorId` so
// Phase 6 (AUTH-15) can backfill firebaseUid in-place.
import {
  db,
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
} from "../firebase/db.js";

/**
 * @param {*} a
 * @param {*} b
 * @returns {number}
 */
function byCreatedAt(a, b) {
  // serverTimestamp values are Firestore Timestamp objects with toMillis().
  // Defensive fallback to 0 covers in-flight writes whose serverTimestamp
  // hasn't been resolved by Firestore yet.
  const am = a?.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
  const bm = b?.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
  return am - bm;
}

/**
 * @param {string} orgId
 * @returns {Promise<Array<any>>}
 */
export async function listMessages(orgId) {
  const snap = await getDocs(collection(db, "orgs", orgId, "messages"));
  /** @type {Array<any>} */
  const out = [];
  snap.forEach((/** @type {any} */ d) => out.push({ id: d.id, ...d.data() }));
  return out.sort(byCreatedAt);
}

/**
 * @param {string} orgId
 * @param {*} message
 * @returns {Promise<string>}
 */
export async function addMessage(orgId, message) {
  const ref = await addDoc(
    collection(db, "orgs", orgId, "messages"),
    {
      authorId: message?.authorId,
      legacyAuthorId: message?.authorId, // D-03 inline legacy field
      body: message?.body,
      createdAt: serverTimestamp(),
    },
  );
  return ref.id;
}

/**
 * @param {string} orgId
 * @param {{ onChange: (messages: Array<any>) => void, onError: (err: Error) => void }} cb
 * @returns {() => void}
 */
export function subscribeMessages(orgId, { onChange, onError }) {
  return onSnapshot(
    collection(db, "orgs", orgId, "messages"),
    (/** @type {any} */ snap) => {
      /** @type {Array<any>} */
      const out = [];
      snap.forEach((/** @type {any} */ d) => out.push({ id: d.id, ...d.data() }));
      onChange(out.sort(byCreatedAt));
    },
    onError,
  );
}
