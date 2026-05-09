// src/cloud/audit.js
// @ts-check
// Phase 4 Wave 3 (D-11): empty stub seam. Phase 7 (FN-04 / AUDIT-01) replaces
// the body with real httpsCallable wiring through src/firebase/functions.js
// (the auditWrite callable). API surface defined here so that
// src/data/audit-events.js can import the signature today.
//
// Cleanup-ledger row: "Phase 7 (FN-04 / AUDIT-01) wires src/cloud/audit.js
// body" — closes at Phase 7.

/**
 * @param {{ event: string, payload?: any }} _input
 * @returns {Promise<void>}
 */
export async function writeAuditEvent(_input) {
  /* Phase 7 body lands here (FN-04) */
}
