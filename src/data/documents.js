// src/data/documents.js
// @ts-check
// Phase 4 Wave 3 (D-09 / D-12 / D-15): pass-through to data/orgs.js's flat-map
// shape (org.documents[docId]) PLUS Storage upload via firebase/storage.js.
// Phase 5 (DATA-01..06) replaces the metadata path with subcollection access;
// Phase 7 wires the secure-upload callable. The API surface stays stable.
//
// Trust-boundary anchor (D-15 / T-4-3-4): saveDocument is called BY Wave 4
// views AFTER ui/upload.js validateUpload(file) returns ok:true with a
// sanitisedName. data/documents.js does NOT re-validate — trusts the contract.
// Storage path: orgs/{orgId}/documents/{docId}/{sanitisedName}. Phase 5
// storage.rules adds the actual server-side enforcement (RULES-04).
//
// Cleanup-ledger row: "Phase 5 (DATA-01) replaces body with subcollection
// access (orgs/{orgId}/documents/{docId}); data/documents.js API stable" —
// closes at Phase 5.
import { getOrg, saveOrg } from "./orgs.js";
import { storage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "../firebase/storage.js";
import { uid } from "../util/ids.js";

/**
 * @param {string} orgId
 * @returns {Promise<Array<any>>}
 */
export async function listDocuments(orgId) {
  const org = await getOrg(orgId);
  return Object.values(org?.documents || {});
}

/**
 * @param {string} orgId
 * @param {File} file
 * @param {string} sanitisedName
 * @param {*} [meta]
 * @returns {Promise<{ id: string, downloadURL: string }>}
 */
export async function saveDocument(orgId, file, sanitisedName, meta = {}) {
  const docId = uid("d_");
  const path = `orgs/${orgId}/documents/${docId}/${sanitisedName}`;
  const task = uploadBytesResumable(ref(storage, path), file);
  await task;
  const downloadURL = await getDownloadURL(/** @type {*} */ (task).snapshot.ref);
  const org = await getOrg(orgId);
  if (org) {
    org.documents = org.documents || {};
    org.documents[docId] = { id: docId, name: sanitisedName, path, downloadURL, ...meta };
    await saveOrg(org);
  }
  return { id: docId, downloadURL };
}

/**
 * @param {string} orgId
 * @param {string} docId
 * @returns {Promise<void>}
 */
export async function deleteDocument(orgId, docId) {
  const org = await getOrg(orgId);
  if (!org?.documents?.[docId]) return;
  const d = org.documents[docId];
  if (d?.path) await deleteObject(ref(storage, d.path));
  delete org.documents[docId];
  await saveOrg(org);
}
