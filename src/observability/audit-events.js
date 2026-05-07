// src/observability/audit-events.js
// @ts-check
// Phase 4 Wave 3 (D-11): NEW constants table + emit helper. Phase 7 (AUDIT-02)
// populates AUDIT_EVENTS with the canonical event-name set; Phase 9 (AUDIT-05)
// wires emitAuditEvent calls in views/*.
//
// AUDIT_EVENTS is FROZEN today so any accidental write fails (strict mode
// throws; non-strict silently no-ops). Phase 7's body landing replaces this
// table with the canonical set; consumers reference AUDIT_EVENTS.* via
// keyof typeof — type-safe across the swap.
//
// Cleanup-ledger row: "Phase 7 (AUDIT-02) populates AUDIT_EVENTS constants
// table; Phase 9 (AUDIT-05) wires emitAuditEvent calls in views/*" — closes
// at Phase 7 / Phase 9.

/** @type {Readonly<Record<string, string>>} */
export const AUDIT_EVENTS = Object.freeze({
  // Phase 7 (AUDIT-02) replaces with the canonical set, e.g.:
  //   AUTH_SIGNIN_SUCCESS:        "auth.signin.success",
  //   DATA_ORG_DELETE:            "data.org.delete",
  //   DATA_DOCUMENT_UPLOAD_FAILED: "data.document.upload.failed",
});

/**
 * @param {keyof typeof AUDIT_EVENTS|string} _event
 * @param {any} [_payload]
 */
export function emitAuditEvent(_event, _payload) {
  /* Phase 9 body lands here (AUDIT-05) */
}
