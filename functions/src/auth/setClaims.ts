// Phase 6 (AUTH-07 / D-09) + Phase 7 Wave 1 (FN-03 / FN-04 / FN-05 / FN-07):
// admin-only HTTPS callable for role/orgId mutation. Server-side authority —
// re-reads claims from the verified ID token (does NOT trust caller payload)
// per Pitfall 17 + ARCHITECTURE.md section 3 conventions.
//
// Phase 7 hardening landed here:
//   - enforceAppCheck: true                      (FN-07; closes Phase 6 deferral comment)
//   - serviceAccount: "claims-admin-sa"          (FN-04; per Pattern 7 SA inventory)
//   - secrets: [SENTRY_DSN]                      (FN-05; defineSecret)
//   - withSentry handler wrapper                 (FN-03; Pitfall 18 PII scrub)
//   - validateInput(SetClaimsSchema, request.data) (FN-03; replaces typeof ladder)
//   - ensureIdempotent(...) before getCustomUserClaims (FN-03; 5-min window)
//
// Phase 7 Wave 6 carry-forward: src/cloud/claims-admin.js wrapper does not
// yet pass clientReqId — Wave 6 closes. BLOCKER-FIX 1 (sub-wave 6.1) callers
// from src/firebase/auth.js#updatePassword need the wrapper updated too.
//
// Poke pattern preserved per Pitfall 2 + Phase 6 ARCHITECTURE.md section 7
// Flow C: writes users/{uid}/_pokes/{Date.now()} so the target session
// listener forces an ID-token refresh.

import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { withSentry } from "../util/sentry.js";
import { validateInput } from "../util/zod-helpers.js";
import { ensureIdempotent } from "../util/idempotency.js";

if (!getApps().length) initializeApp();

const SENTRY_DSN = defineSecret("SENTRY_DSN");

const SetClaimsSchema = z.object({
  uid: z.string().min(1),
  role: z.enum(["admin", "internal", "client"]).nullable().optional(),
  orgId: z.string().nullable().optional(),
  clientReqId: z.string().uuid(),
});

export const setClaims = onCall(
  {
    region: "europe-west2",
    enforceAppCheck: true,
    serviceAccount: "claims-admin-sa",
    secrets: [SENTRY_DSN],
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  withSentry(async (request: CallableRequest<unknown>) => {
    // Pitfall 17: re-read role from the verified ID token, NEVER from payload.
    if (request.auth?.token?.role !== "admin") {
      throw new HttpsError("permission-denied", "admin role required");
    }
    const data = validateInput(SetClaimsSchema, request.data ?? {});

    // Idempotency-marker write BEFORE the side effect (FN-03; 5-min window).
    await ensureIdempotent(
      `${request.auth.uid}:setClaims:${data.uid}:${data.clientReqId}`,
      "setClaims",
      5 * 60,
    );

    const role = data.role ?? null;
    const orgId = data.orgId ?? null;

    await getAuth().setCustomUserClaims(data.uid, { role, orgId });

    // Poke pattern PRESERVED — Pitfall 2 + Phase 6 ARCHITECTURE.md section 7 Flow C.
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
  }),
);
