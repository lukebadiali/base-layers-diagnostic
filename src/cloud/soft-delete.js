// src/cloud/soft-delete.js
// @ts-check
// Phase 8 Wave 2 (LIFE-04): browser seam — wraps the softDelete +
// restoreSoftDeleted + permanentlyDeleteSoftDeleted callables
// (functions/src/lifecycle/*). Phase 4 stub body REPLACED — cleanup-ledger
// row CLOSES with this commit.
//
// The real Cloud Function callables enforce admin-only authorization
// server-side via request.auth.token.role; the client wrapper is unaware
// of the gate (caller catches HttpsError on permission-denied via the
// Phase 6 D-13 unified-error wrapper surface).

import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/functions.js";

const softDeleteCallable = httpsCallable(functions, "softDelete");
const restoreSoftDeletedCallable = httpsCallable(functions, "restoreSoftDeleted");
const permanentlyDeleteCallable = httpsCallable(functions, "permanentlyDeleteSoftDeleted");

/**
 * Soft-delete a record. Admin only (server-enforced).
 * @param {{ type: "org"|"comment"|"document"|"message"|"funnelComment", orgId: string, id: string }} input
 * @returns {Promise<{ ok: true }>}
 */
export async function softDelete(input) {
  const clientReqId = crypto.randomUUID();
  const result = await softDeleteCallable({ ...input, clientReqId });
  return /** @type {{ ok: true }} */ (result.data);
}

/**
 * Restore a soft-deleted record. Admin only (server-enforced).
 * @param {{ type: "org"|"comment"|"document"|"message"|"funnelComment", orgId: string, id: string }} input
 * @returns {Promise<{ ok: true }>}
 */
export async function restoreSoftDeleted(input) {
  const clientReqId = crypto.randomUUID();
  const result = await restoreSoftDeletedCallable({ ...input, clientReqId });
  return /** @type {{ ok: true }} */ (result.data);
}

/**
 * Permanently delete (hard-delete) ONE soft-deleted record. Admin only.
 * @param {{ type: "org"|"comment"|"document"|"message"|"funnelComment", id: string }} input
 * @returns {Promise<{ ok: true }>}
 */
export async function permanentlyDeleteSoftDeleted(input) {
  const clientReqId = crypto.randomUUID();
  const result = await permanentlyDeleteCallable({ ...input, clientReqId });
  return /** @type {{ ok: true }} */ (result.data);
}
