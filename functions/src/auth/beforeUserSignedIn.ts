// Phase 6 (AUTH-06 / D-09 / D-21): auth-blocking trigger that emits a
// structured Cloud Logging audit entry on every sign-in. Observation-only —
// no Firestore writes; Phase 7 (FN-01) wires the Firestore-side auditLog/
// writer + back-fills sign-in events from Cloud Logging (Pitfall 17 — audit
// log written from Cloud Functions only, not from this trigger directly).
//
// Region europe-west2. minInstances:1 stripped at Wave 5 cutover time per
// operator decision (cost concern). Cleanup-ledger row queued — see
// runbooks/phase-6-cleanup-ledger.md (Wave 6 deliverable).
//
// Phase 7 Wave 5 (Branch B substrate-honest fallback): minInstances:1
// restoration + cold-start p99 measurement DEFERRED to sub-wave 7.1 because
// the D-22 ToS gate (firebaseauth.googleapis.com) is still operator-deferred.
// See `runbooks/phase-7-d22-tos-gate-resolution.md` for resolution path.
//
// Phase 9 Wave 3 (BLOCKER 1 fix): try/catch substrate around the observation
// handler with auth.signin.failure emission on the catch branch. Substrate is
// dormant until business rules add explicit rejections — Wave 4 Rule 1 fires
// automatically once a rejection rule lands. See 09-03a-PLAN.md for rationale.

import { beforeUserSignedIn } from "firebase-functions/v2/identity";
import { logger } from "firebase-functions/logger";
import { randomUUID } from "node:crypto";
import { writeAuditEvent } from "../audit/auditLogger.js";

export const beforeUserSignedInHandler = beforeUserSignedIn(
  { region: "europe-west2" },
  async (event) => {
    try {
      logger.info("auth.user.signin", {
        uid: event.data?.uid,
        email: event.data?.email,
        provider: event.data?.providerData?.[0]?.providerId,
        mfa: event.data?.multiFactor?.enrolledFactors?.length ?? 0,
      });
      // No mutation — observation-only per ARCHITECTURE.md §3 "Use sparingly"
      // + D-21 (Firestore-side auditLog/ deferred to Phase 7 → wired Phase 9).
    } catch (err) {
      // Phase 9 Wave 3 (BLOCKER 1 fix): emit auth.signin.failure on the
      // rejection branch. The handler currently never explicitly rejects —
      // this catch fires only on internal handler errors (logger throws,
      // event.data is malformed, etc.). Wave 4 Rule 1 (auth-fail burst >5/IP/
      // 5min) reads from these rows. The audit emit is the ONLY substrate
      // through which client-side wrong-password attempts can be counted —
      // the auditWrite callable rejects unauthenticated clients
      // (auditWrite.ts:51-53), so the client cannot emit failures itself.
      //
      // SUBSTRATE-HONEST: this handler does not currently REJECT sign-ins
      // (no business rules require it yet). The catch branch is here so a
      // future plan that adds rejection rules (e.g. block disabled
      // accounts at sign-in time) needs ZERO schema changes — just throw.
      // Rule 1 fires the moment any future code path inside this handler
      // throws, automatically.
      //
      // Best-effort: log + swallow if writeAuditEvent itself fails.
      try {
        await writeAuditEvent(
          {
            type: "auth.signin.failure",
            target: {
              type: "user",
              id: event.data?.uid ?? "unknown",
              orgId: null,
            },
            clientReqId: randomUUID(),
            payload: {
              reason: err instanceof Error ? err.name : "UnknownError",
            },
          },
          {
            now: Date.now(),
            eventId: randomUUID(),
            ip: event.ipAddress ?? null,
            userAgent: event.userAgent ?? null,
            actor: {
              uid: null,
              email: event.data?.email ?? null,
              role: null,
              orgId: null,
            },
          },
        );
      } catch (auditErr) {
        logger.warn("audit.emit.failed", {
          type: "auth.signin.failure",
          error: auditErr instanceof Error ? auditErr.message : String(auditErr),
        });
      }
      // Re-throw the original error — let the blocking-handler infrastructure
      // signal failure to the client. The audit emit fires regardless.
      throw err;
    }
  },
);
