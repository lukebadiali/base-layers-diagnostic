// Phase 6 (AUTH-06 / D-09 / D-21): auth-blocking trigger that emits a
// structured Cloud Logging audit entry on every sign-in. Observation-only —
// no Firestore writes; Phase 7 (FN-01) wires the Firestore-side auditLog/
// writer + back-fills sign-in events from Cloud Logging (Pitfall 17 — audit
// log written from Cloud Functions only, not from this trigger directly).
//
// Region europe-west2 + minInstances:1 (D-09 + Pitfall 12 — even though this
// trigger is observation-only, cold-start would still breach the 7s
// auth-blocking deadline).

import { beforeUserSignedIn } from "firebase-functions/v2/identity";
import { logger } from "firebase-functions/logger";

export const beforeUserSignedInHandler = beforeUserSignedIn(
  { region: "europe-west2", minInstances: 1 },
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
