// src/data/messages.js
// @ts-check
// Phase 4 Wave 3 (D-09 / D-12): pass-through to data/orgs.js's flat-map shape
// (org.messages[messageId]) PLUS onSnapshot live subscription via
// firebase/db.js. Phase 5 (DATA-01..06) moves storage to
// orgs/{orgId}/messages/{msgId} subcollection + readStates/{userId}/messages
// — the API surface stays stable.
//
// Cleanup-ledger row: "Phase 5 (DATA-01) replaces body with subcollection
// access (orgs/{orgId}/messages/{msgId}) + readStates/{userId};
// data/messages.js API stable" — closes at Phase 5.
import { getOrg, saveOrg } from "./orgs.js";
import { db, doc, onSnapshot } from "../firebase/db.js";
import { uid } from "../util/ids.js";

/**
 * @param {string} orgId
 * @returns {Promise<Array<any>>}
 */
export async function listMessages(orgId) {
  const org = await getOrg(orgId);
  return Object.values(org?.messages || {}).sort(
    (/** @type {any} */ a, /** @type {any} */ b) => (a.createdAt || 0) - (b.createdAt || 0),
  );
}

/**
 * @param {string} orgId
 * @param {*} message
 * @returns {Promise<string>}
 */
export async function addMessage(orgId, message) {
  const org = await getOrg(orgId);
  const id = message.id || uid("m_");
  if (!org) return id;
  org.messages = org.messages || {};
  org.messages[id] = { ...message, id };
  await saveOrg(org);
  return id;
}

/**
 * @param {string} orgId
 * @param {{ onChange: (messages: Array<any>) => void, onError: (err: Error) => void }} cb
 * @returns {() => void}
 */
export function subscribeMessages(orgId, { onChange, onError }) {
  return onSnapshot(
    doc(db, "orgs", orgId),
    (/** @type {any} */ snap) => {
      const data = snap.exists() ? snap.data() : null;
      const messages = Object.values(data?.messages || {}).sort(
        (/** @type {any} */ a, /** @type {any} */ b) => (a.createdAt || 0) - (b.createdAt || 0),
      );
      onChange(messages);
    },
    onError,
  );
}
