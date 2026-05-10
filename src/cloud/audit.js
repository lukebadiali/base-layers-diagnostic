// src/cloud/audit.js
// @ts-check
// Phase 7 Wave 6 (FN-04 / AUDIT-01 / 07-06): wires writeAuditEvent through
// src/firebase/functions.js per the Phase 4 ESLint Wave 3 boundary. Phase 4
// D-11 left this as a stub; Wave 6 fills the body.
//
// clientReqId is mandatory for the auditWrite callable's Zod schema (Wave 1
// auditEventInput — FN-03 idempotency-key derivation). Every call generates a
// fresh UUID so retries surface as deterministic duplicates within the 5-min
// window. Callers (src/data/* + src/views/* in Phase 9) do not bring their own
// clientReqId — keeps the cloud/* boundary minimal and avoids leaking
// crypto.randomUUID() into every caller.
//
// Boundary: imports only from ../firebase/functions.js + ./retry.js — never
// from `firebase/functions` SDK directly. Phase 4 ESLint Wave 3 boundary is
// error-level; npm run lint exits 0 if compliant.
//
// withRetry tuning rationale:
//   - retries: 3 (4 total attempts) — covers transient network blips without
//     building cascading delays under sustained outage
//   - baseMs: 250ms — first retry at ~250-500ms; 3rd at ~1000-1250ms; 4th at
//     ~2000-2250ms; cumulative ~3.5-4s at worst, well under the user-perceived
//     "stuck" threshold and the auditWrite callable's 30s server timeout
//
// Notes for downstream phases (do NOT execute in this wave):
//   - Phase 9 AUDIT-05 will wire writeAuditEvent calls into views/* on every
//     sign-in / sign-out / role change / delete / export / MFA enrol /
//     password change.
//   - The `actor` field is server-side only — view-side callers don't pass it;
//     auditWrite reads it from request.auth.token (Pitfall 17).
import { functions, httpsCallable } from "../firebase/functions.js";
import { withRetry } from "./retry.js";

const auditWriteCallable = httpsCallable(functions, "auditWrite");

/**
 * Append an audit event to the auditLog/{eventId} collection via the
 * server-side `auditWrite` callable. Returns the canonical {ok, eventId}
 * response from the callable (eventId is server-generated; never trusted from
 * payload per Pitfall 17).
 *
 * @param {{
 *   type: string,
 *   severity?: "info"|"warning"|"alert",
 *   target: { type: string, id: string, orgId?: string|null, snapshot?: any },
 *   payload?: any,
 * }} input
 * @returns {Promise<{ ok: true, eventId: string }>}
 */
export async function writeAuditEvent(input) {
  const clientReqId = crypto.randomUUID();
  const result = await withRetry(
    () => auditWriteCallable({ ...input, clientReqId }),
    { retries: 3, baseMs: 250 },
  );
  return /** @type {{ ok: true, eventId: string }} */ (result.data);
}
