// src/cloud/soft-delete.js
// @ts-check
// Phase 4 Wave 3 (D-11): empty stub seam. Phase 8 (LIFE-04) replaces the body
// with httpsCallable("softDelete") + httpsCallable("restoreSoftDeleted"),
// wired through src/firebase/functions.js. The exported function signatures
// exist so views/* can call them today and the call lands at the real
// callable Phase 8 — zero adapter-shape change.
//
// Cleanup-ledger row: "Phase 8 (LIFE-04) replaces body with
// httpsCallable('softDelete') + ('restoreSoftDeleted')" — closes at Phase 8.

/**
 * @param {{ type: string, id: string }} _input
 * @returns {Promise<void>}
 */
export async function softDelete(_input) {
  /* Phase 8 body lands here (LIFE-04) */
}

/**
 * @param {{ type: string, id: string }} _input
 * @returns {Promise<void>}
 */
export async function restoreSoftDeleted(_input) {
  /* Phase 8 body lands here (LIFE-04) */
}
