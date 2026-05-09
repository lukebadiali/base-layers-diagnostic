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

import { beforeUserSignedIn } from "firebase-functions/v2/identity";
import { logger } from "firebase-functions/logger";

export const beforeUserSignedInHandler = beforeUserSignedIn(
  { region: "europe-west2" },
  async (event) => {
    logger.info("auth.user.signin", {
      uid: event.data?.uid,
      email: event.data?.email,
      provider: event.data?.providerData?.[0]?.providerId,
      mfa: event.data?.multiFactor?.enrolledFactors?.length ?? 0,
    });
    // No mutation — observation-only per ARCHITECTURE.md §3 "Use sparingly"
    // + D-21 (Firestore-side auditLog/ deferred to Phase 7).
  },
);
