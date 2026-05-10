// src/data/audit-events.js
// @ts-check
// Phase 4 Wave 3 (D-11) → Phase 7 Wave 6 (FN-04 / AUDIT-01 / 07-06): the
// cloud/audit.js seam now wires the real auditWrite callable (Wave 6 body
// fill). recordAuditEvent forwards the input shape unchanged and returns the
// callable's {ok, eventId} response. Phase 9 (AUDIT-05) will wire view-side
// call sites; the API contract here matches the Wave 1 auditEventInput Zod
// schema (functions/src/audit/auditEventSchema.ts).
//
// Cleanup-ledger row: "Phase 7 (FN-04 / AUDIT-01) wires recordAuditEvent →
// cloud/audit.js → real auditWrite callable" — closes at Phase 7 Wave 6.
import { writeAuditEvent } from "../cloud/audit.js";

/**
 * @param {{
 *   type: string,
 *   severity?: "info"|"warning"|"alert",
 *   target: { type: string, id: string, orgId?: string|null, snapshot?: any },
 *   payload?: any,
 * }} input
 * @returns {Promise<{ ok: true, eventId: string }>}
 */
export async function recordAuditEvent(input) {
  return writeAuditEvent(input);
}
