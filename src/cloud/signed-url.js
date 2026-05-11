// src/cloud/signed-url.js
// @ts-check
// Phase 8 Wave 1 (BACKUP-05 / Pitfall G): browser seam for the
// getDocumentSignedUrl callable. Replaces unbounded
// getDownloadURL(ref) calls in src/data/documents.js + src/main.js with
// a server-issued V4 signed URL bounded to 1 hour.
//
// Refresh-on-download: callers MUST issue a fresh callable invocation per
// download click — DO NOT cache the returned url. The server-side TTL
// enforces this; the client-side contract documents the expectation.
//
// Cleanup-ledger row: "Phase 8 (BACKUP-05) seam — getDownloadURL call sites
// in src/data/documents.js + src/main.js converted in 08-03 Wave 2"
// CLOSES with the 08-03 Wave 2 sweep.

import { functions, httpsCallable } from "../firebase/functions.js";

const callable = httpsCallable(functions, "getDocumentSignedUrl");

/**
 * Request a 1-hour V4 signed URL for a document.
 * @param {string} orgId
 * @param {string} docId
 * @param {string} filename
 * @returns {Promise<{ url: string, expiresAt: number }>}
 */
export async function getDocumentSignedUrl(orgId, docId, filename) {
  const result = await callable({ orgId, docId, filename });
  const data = /** @type {{ url: string, expiresAt: number }} */ (result.data);
  return data;
}
