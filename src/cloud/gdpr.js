// src/cloud/gdpr.js
// @ts-check
// Phase 8 Wave 3 (GDPR-01): exportUser body filled.
// Phase 8 Wave 4 (GDPR-02 / 08-05): eraseUser body fill — STUB until 08-05.
//
// Cleanup-ledger row "Phase 4 stub seam" — exportUser CLOSES with this
// commit; eraseUser CLOSES with 08-05.
//
// D-04 lint rule: import from ../firebase/functions.js adapter, not
// directly from "firebase/functions".

import { httpsCallable } from "../firebase/functions.js";
import { functions } from "../firebase/functions.js";

const exportUserCallable = httpsCallable(functions, "gdprExportUser");

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
 * GDPR Art. 17 — admin-callable erasure of user data. STUB until Phase 8
 * Wave 4 (08-05) which lands gdprEraseUser callable + GDPR_PSEUDONYM_SECRET
 * + redactionList write.
 * @param {{ userId: string }} _input
 * @returns {Promise<void>}
 */
export async function eraseUser(_input) {
  /* Phase 8 Wave 4 (GDPR-02) body lands in 08-05 */
}
