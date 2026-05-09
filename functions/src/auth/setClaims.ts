// Phase 6 (AUTH-07 / D-09): admin-only HTTPS callable for role/orgId
// mutation. Server-side authority — re-reads claims from the verified ID
// token (does NOT trust caller payload) per ARCHITECTURE.md §3 conventions.
//
// Poke pattern per ARCHITECTURE.md §7 Flow C: writes
// users/{uid}/_pokes/{Date.now()} so the target session listener forces an
// ID-token refresh (mitigates Pitfall 6 — claims propagation lag for
// post-creation mutations).
//
// enforceAppCheck:true deferred to Phase 7 (FN-07); idempotency-key marker
// + Zod input validation deferred to Phase 7 (FN-03) — minimal manual gate
// here, cleanup-ledger row queued in Wave 6.

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (!getApps().length) initializeApp();

interface SetClaimsInput {
  uid?: unknown;
  role?: unknown;
  orgId?: unknown;
}

export const setClaims = onCall(
  { region: "europe-west2" /* enforceAppCheck:true ships Phase 7 FN-07 */ },
  async (request) => {
    if (request.auth?.token?.role !== "admin") {
      throw new HttpsError("permission-denied", "admin role required");
    }
    const data = (request.data ?? {}) as SetClaimsInput;
    if (typeof data.uid !== "string" || data.uid.length === 0) {
      throw new HttpsError("invalid-argument", "uid required");
    }
    const role = typeof data.role === "string" ? data.role : null;
    const orgId = typeof data.orgId === "string" ? data.orgId : null;

    await getAuth().setCustomUserClaims(data.uid, { role, orgId });

    // Poke pattern — forces target session to refresh ID token + pick up
    // new claims via getIdToken(true) on the listener path.
    await getFirestore()
      .doc(`users/${data.uid}/_pokes/${Date.now()}`)
      .set({ type: "claims-changed", at: FieldValue.serverTimestamp() });

    logger.info("auth.claims.set", {
      targetUid: data.uid,
      role,
      orgId,
      byUid: request.auth.uid,
    });
    return { ok: true };
  },
);
