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
//
// Phase 9 Wave 4 (AUDIT-05): POST-emit `data.<type>.<op>.requested` for
// softDelete/restore/permanentlyDelete. Per-type literals (5 types × 3 ops = 15
// literals in auditEventSchema enum). Server callables (Plan 03a) emit the bare
// flavour; AUDIT-05 mirror-trigger Pitfall 7 dedup is satisfied by the bare row.
// Empty payload — actor identity server-overlaid from request.auth.token (Pitfall 17).

import { functions, httpsCallable } from "../firebase/functions.js";
import { emitAuditEvent } from "../observability/audit-events.js";

const softDeleteCallable = httpsCallable(functions, "softDelete");
const restoreSoftDeletedCallable = httpsCallable(functions, "restoreSoftDeleted");
const permanentlyDeleteCallable = httpsCallable(functions, "permanentlyDeleteSoftDeleted");

/**
 * Soft-delete a record. Admin only (server-enforced).
 * @param {{ type: "action"|"comment"|"document"|"message"|"funnelComment", orgId: string, id: string }} input
 * @returns {Promise<{ ok: true }>}
 */
export async function softDelete(input) {
  const clientReqId = crypto.randomUUID();
  const result = await softDeleteCallable({ ...input, clientReqId });
  // Phase 9 (AUDIT-05) POST-emit. Per-type literal — Option A in research
  // line 519 (explicit > clever). Best-effort.
  try {
    emitAuditEvent(
      `data.${input.type}.softDelete.requested`,
      { type: input.type, id: input.id, orgId: input.orgId },
      {},
    );
  } catch (_emitErr) {
    // Pattern 5 #2 — best-effort.
  }
  return /** @type {{ ok: true }} */ (result.data);
}

/**
 * Restore a soft-deleted record. Admin only (server-enforced).
 * @param {{ type: "action"|"comment"|"document"|"message"|"funnelComment", orgId: string, id: string }} input
 * @returns {Promise<{ ok: true }>}
 */
export async function restoreSoftDeleted(input) {
  const clientReqId = crypto.randomUUID();
  const result = await restoreSoftDeletedCallable({ ...input, clientReqId });
  // Phase 9 (AUDIT-05) POST-emit. Best-effort.
  try {
    emitAuditEvent(
      `data.${input.type}.restore.requested`,
      { type: input.type, id: input.id, orgId: input.orgId },
      {},
    );
  } catch (_emitErr) {
    // Pattern 5 #2 — best-effort.
  }
  return /** @type {{ ok: true }} */ (result.data);
}

/**
 * Permanently delete (hard-delete) ONE soft-deleted record. Admin only.
 * @param {{ type: "action"|"comment"|"document"|"message"|"funnelComment", id: string }} input
 * @returns {Promise<{ ok: true }>}
 */
export async function permanentlyDeleteSoftDeleted(input) {
  const clientReqId = crypto.randomUUID();
  const result = await permanentlyDeleteCallable({ ...input, clientReqId });
  // Phase 9 (AUDIT-05) POST-emit. orgId: null because this callable's input
  // schema does not carry orgId (admin-only, hard-delete from
  // softDeleted/<type>/items/{id} which is admin-scoped, not org-scoped).
  try {
    emitAuditEvent(
      `data.${input.type}.permanentlyDelete.requested`,
      { type: input.type, id: input.id, orgId: null },
      {},
    );
  } catch (_emitErr) {
    // Pattern 5 #2 — best-effort.
  }
  return /** @type {{ ok: true }} */ (result.data);
}
