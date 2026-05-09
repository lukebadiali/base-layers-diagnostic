// src/data/documents.js
// @ts-check
// Phase 5 Wave 3 (DATA-01 / D-11 / 05-03): subcollection METADATA at
// orgs/{orgId}/documents/{docId}. Storage path
// orgs/{orgId}/documents/{docId}/{sanitisedName} unchanged (RULES-05). API
// surface unchanged from Phase 4 D-09 / D-10 — listDocuments, saveDocument,
// deleteDocument keep their names + signatures verbatim per D-11.
//
// Cleanup-ledger row: "Phase 5 (DATA-01) replaces body with subcollection
// access (orgs/{orgId}/documents/{docId}); data/documents.js API stable" —
// CLOSES with this commit.
//
// Trust-boundary anchor (D-15 / T-4-3-4): saveDocument is called BY views
// AFTER ui/upload.js validateUpload(file) returns ok:true with a
// sanitisedName. data/documents.js does NOT re-validate — trusts the
// contract. Phase 5 storage.rules adds the actual server-side enforcement.
//
// D-03 invariant: every doc carries `legacyAppUserId: meta.uploadedBy` so
// Phase 6 (AUTH-15) can backfill firebaseUid in-place.
import {
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "../firebase/db.js";
import { storage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "../firebase/storage.js";
import { uid } from "../util/ids.js";

/**
 * @param {string} orgId
 * @returns {Promise<Array<any>>}
 */
export async function listDocuments(orgId) {
  const snap = await getDocs(collection(db, "orgs", orgId, "documents"));
  /** @type {Array<any>} */
  const out = [];
  snap.forEach((/** @type {any} */ d) => out.push({ id: d.id, ...d.data() }));
  return out;
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
  await setDoc(
    doc(db, "orgs", orgId, "documents", docId),
    {
      id: docId,
      orgId,
      name: sanitisedName,
      path,
      downloadURL,
      ...meta,
      legacyAppUserId: meta?.uploadedBy || null, // D-03 (placed after spread so meta cannot override)
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
  return { id: docId, downloadURL };
}

/**
 * @param {string} orgId
 * @param {string} docId
 * @returns {Promise<void>}
 */
export async function deleteDocument(orgId, docId) {
  const ref0 = doc(db, "orgs", orgId, "documents", docId);
  const snap = await getDoc(ref0);
  if (!snap.exists()) return;
  const data = snap.data();
  if (data?.path) await deleteObject(ref(storage, data.path));
  await deleteDoc(ref0);
}
