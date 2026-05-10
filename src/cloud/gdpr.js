// src/cloud/gdpr.js
// @ts-check
// Phase 8 Wave 3 (GDPR-01): exportUser body filled (08-04).
// Phase 8 Wave 4 (GDPR-02): eraseUser body filled (08-05).
//
// Cleanup-ledger row "Phase 4 stub seam" — BOTH stubs now CLOSE.
//
// D-04 lint rule: import from ../firebase/functions.js adapter, not
// directly from "firebase/functions".

import { httpsCallable, functions } from "../firebase/functions.js";

const exportUserCallable = httpsCallable(functions, "gdprExportUser");
const eraseUserCallable = httpsCallable(functions, "gdprEraseUser");

/**
 * GDPR Art. 15 — admin-callable export of all user-linked data. Returns
 * { url, expiresAt } where url is a V4 signed URL valid for 24 hours.
 * Server enforces admin role; caller catches HttpsError on
 * permission-denied via the Phase 6 D-13 unified-error wrapper.
 *
 * @param {{ userId: string }} input
 * @returns {Promise<{ url: string, expiresAt: number }>}
 */
export async function exportUser(input) {
  const clientReqId = crypto.randomUUID();
  const result = await exportUserCallable({ ...input, clientReqId });
  return /** @type {{ url: string, expiresAt: number }} */ (result.data);
}

/**
 * GDPR Art. 17 — admin-callable erasure. Cascades a deterministic
 * pseudonym token across all denormalised collections + tombstones
 * users/{uid} PII + writes redactionList/{uid} + emits compliance.erase.user
 * audit event. Idempotent on (caller, target, clientReqId) within 5min;
 * deterministic on (uid, GDPR_PSEUDONYM_SECRET) across runs.
 *
 * @param {{ userId: string }} input
 * @returns {Promise<{ ok: true, counts: Record<string, number> }>}
 */
export async function eraseUser(input) {
  const clientReqId = crypto.randomUUID();
  const result = await eraseUserCallable({ ...input, clientReqId });
  return /** @type {{ ok: true, counts: Record<string, number> }} */ (result.data);
}
