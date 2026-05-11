// src/observability/audit-events.js
// @ts-check
// Phase 9 Wave 1 (AUDIT-05 — Wave 3 wires call sites; Wave 1 lands the
// boundary contract): canonical AUDIT_EVENTS table + emitAuditEvent proxy.
// Replaces the Phase 4 D-11 empty stub. emitAuditEvent forwards to
// writeAuditEvent in src/cloud/audit.js (the boundary contract: views/* and
// auth/* import from observability/audit-events.js, never from cloud/* directly).
//
// Best-effort emission: failures swallowed and converted to `null` return
// (Pattern 5 #2 — never block originating op on audit failure).
//
// AUDIT_EVENTS values mirror the canonical event-name set in
// functions/src/audit/auditEventSchema.ts (the server-side Zod enum).
// Plan 09-03a (Wave 3) extends the server enum with `.requested` literals
// for the client-emitted variants in this table.

import { writeAuditEvent } from "../cloud/audit.js";

/** @type {Readonly<Record<string, string>>} */
export const AUDIT_EVENTS = Object.freeze({
  AUTH_SIGNIN_SUCCESS: "auth.signin.success",
  AUTH_SIGNIN_FAILURE: "auth.signin.failure",
  AUTH_SIGNOUT: "auth.signout",
  AUTH_MFA_ENROL: "auth.mfa.enrol",
  AUTH_MFA_UNENROL: "auth.mfa.unenrol",
  AUTH_PASSWORD_CHANGE: "auth.password.change",
  AUTH_PASSWORD_RESET: "auth.password.reset",
  IAM_CLAIMS_SET_REQUESTED: "iam.claims.set.requested",
  COMPLIANCE_EXPORT_USER_REQUESTED: "compliance.export.user.requested",
  COMPLIANCE_ERASE_USER_REQUESTED: "compliance.erase.user.requested",
  DATA_ACTION_SOFTDELETE_REQUESTED: "data.action.softDelete.requested",
  DATA_COMMENT_SOFTDELETE_REQUESTED: "data.comment.softDelete.requested",
  DATA_DOCUMENT_SOFTDELETE_REQUESTED: "data.document.softDelete.requested",
  DATA_MESSAGE_SOFTDELETE_REQUESTED: "data.message.softDelete.requested",
  DATA_FUNNELCOMMENT_SOFTDELETE_REQUESTED: "data.funnelComment.softDelete.requested",
  DATA_ACTION_RESTORE_REQUESTED: "data.action.restore.requested",
  DATA_COMMENT_RESTORE_REQUESTED: "data.comment.restore.requested",
  DATA_DOCUMENT_RESTORE_REQUESTED: "data.document.restore.requested",
  DATA_MESSAGE_RESTORE_REQUESTED: "data.message.restore.requested",
  DATA_FUNNELCOMMENT_RESTORE_REQUESTED: "data.funnelComment.restore.requested",
  DATA_ACTION_PERMANENTLY_DELETE_REQUESTED: "data.action.permanentlyDelete.requested",
  DATA_COMMENT_PERMANENTLY_DELETE_REQUESTED: "data.comment.permanentlyDelete.requested",
  DATA_DOCUMENT_PERMANENTLY_DELETE_REQUESTED: "data.document.permanentlyDelete.requested",
  DATA_MESSAGE_PERMANENTLY_DELETE_REQUESTED: "data.message.permanentlyDelete.requested",
  DATA_FUNNELCOMMENT_PERMANENTLY_DELETE_REQUESTED: "data.funnelComment.permanentlyDelete.requested",
});

/**
 * Best-effort proxy to src/cloud/audit.js#writeAuditEvent. Returns the
 * canonical {ok, eventId} server response, or null on any failure (the
 * originating op MUST NOT block on audit failure — Pattern 5 #2). Once Sentry
 * boot is wired in src/main.js (Plan 09-01 Task 4) the catch can upgrade to
 * captureError(_err, { audit: { type, target } }) for SRE visibility.
 *
 * @param {string} type — value from AUDIT_EVENTS or any string in the schema enum
 * @param {{ type: string, id: string, orgId?: string|null, snapshot?: any }} target
 * @param {*} [payload]
 * @returns {Promise<{ ok: true, eventId: string } | null>} null on best-effort failure
 */
export async function emitAuditEvent(type, target, payload) {
  try {
    return await writeAuditEvent({ type, target, payload });
  } catch (_err) {
    // Best-effort — never block the originating op on audit failure (Pattern 5 #2).
    return null;
  }
}
