// src/cloud/gdpr.js
// @ts-check
// Phase 4 Wave 3 (D-11): empty stub seam. Phase 8 (GDPR-01/02) replaces the
// body with httpsCallable("gdprExportUser") + httpsCallable("gdprEraseUser").
//
// Cleanup-ledger row: "Phase 8 (GDPR-01/02) replaces body with
// httpsCallable('gdprExportUser') + ('gdprEraseUser')" — closes at Phase 8.

/**
 * @param {{ userId: string }} _input
 * @returns {Promise<{ downloadURL: string }>}
 */
export async function exportUser(_input) {
  /* Phase 8 body lands here (GDPR-01) */
  return { downloadURL: "" };
}

/**
 * @param {{ userId: string }} _input
 * @returns {Promise<void>}
 */
export async function eraseUser(_input) {
  /* Phase 8 body lands here (GDPR-02) */
}
