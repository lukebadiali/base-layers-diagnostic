// Phase 6 (AUTH-03 / AUTH-05 / D-09 / D-10 / D-11): auth-blocking trigger that
// reads internalAllowlist/{lowercasedEmail} and returns customClaims so they
// land in the user's first ID token (Pitfall 6 mitigation #3 — no refresh
// dance for bootstrap admins).
//
// 7s deadline (Pitfall 12) — single doc-by-id read; never list-walk.
// Region europe-west2.
// minInstances:1 stripped at Wave 5 cutover time per operator decision (cost
// concern, ~$6/mo per instance). Cleanup-ledger row queued for Phase 7+ to
// reconsider — see runbooks/phase-6-cleanup-ledger.md (Wave 6 deliverable).
// Phase 7 (TEST-09) adds firebase-functions-test integration coverage; Phase 6
// unit-tests claim-builder.ts only (the pure-logic seam this module calls).

import { beforeUserCreated } from "firebase-functions/v2/identity";
import { logger } from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { buildClaims, type AllowlistEntry } from "./claim-builder.js";

if (!getApps().length) initializeApp();

export const beforeUserCreatedHandler = beforeUserCreated(
  { region: "europe-west2" },
  async (event) => {
    const email = event.data?.email?.toLowerCase();
    if (!email) {
      // No email on creation event — let Firebase's own validation handle it.
      return;
    }
    const snap = await getFirestore().doc(`internalAllowlist/${email}`).get();
    const entry: AllowlistEntry | null = snap.exists
      ? (snap.data() as AllowlistEntry)
      : null;
    const claims = buildClaims(entry);
    logger.info("auth.user.created", {
      uid: event.data?.uid,
      email,
      role: claims.role,
      orgId: claims.orgId,
    });
    return { customClaims: { role: claims.role, orgId: claims.orgId } };
  },
);
