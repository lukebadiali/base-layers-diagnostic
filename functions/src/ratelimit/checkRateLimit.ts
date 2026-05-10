// Phase 7 Wave 4 (FN-09 / 07-04): checkRateLimit fallback callable —
// Pattern A standard shape (App Check + Zod + idempotency + Sentry +
// per-function SA) per 07-PATTERNS.md.
//
// Pattern 5b status: deployed-but-NOT-live-wired. The rules-side predicate
// (firestore.rules `rateLimitOk(uid)` composed into messages + comments
// create rules) is the live primary path. This callable is the operator
// hot-swap seam for cases where the rules-side hits Pitfall 4 single-`get()`
// budget under composition (e.g., per-org + per-user combined limits).
// To activate: ship src/cloud/checkRateLimit.js wrapper + replace
// incrementBucketAndWrite with the callable in src/data/{messages,comments}.js.
//
// Service account: ratelimit-sa (created Wave 1; minimal-IAM datastore.user).
// Region: europe-west2 (matches Firestore for transfer minimisation).
// Memory: 256MiB (matches setClaims; bucket-counter logic is lightweight).
// Timeout: 10s (transaction-bounded; cold-start tolerance built into clients
// via the rules-side primary path).

import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import { withSentry } from "../util/sentry.js";
import { validateInput } from "../util/zod-helpers.js";
import { ensureIdempotent } from "../util/idempotency.js";

if (!getApps().length) initializeApp();

const SENTRY_DSN = defineSecret("SENTRY_DSN");

// Pitfall: callers MUST send a fresh clientReqId per logical write attempt
// so the idempotency window coalesces retries (network flakes / view re-mounts)
// without double-counting against the per-uid bucket.
const CheckRateLimitInput = z.object({
  scope: z.enum(["chat", "comment"]),
  clientReqId: z.string().uuid(),
});

export const checkRateLimit = onCall(
  {
    region: "europe-west2",
    enforceAppCheck: true,                  // FN-07
    serviceAccount: "ratelimit-sa",         // FN-04 (Wave 1 SA inventory)
    secrets: [SENTRY_DSN],                  // FN-05 (defineSecret)
    memory: "256MiB",
    timeoutSeconds: 10,
  },
  withSentry(async (request: CallableRequest<unknown>) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }
    const data = validateInput(CheckRateLimitInput, request.data ?? {});

    // Idempotency window matches the rate-limit window (60s) — replays of the
    // same logical write within the same window are no-ops on the bucket.
    const idempotencyKey = `${request.auth.uid}:checkRateLimit:${data.scope}:${data.clientReqId}`;
    await ensureIdempotent(idempotencyKey, "checkRateLimit", 60);

    const winStart = Math.floor(Date.now() / 60_000) * 60_000;
    const bucketRef = getFirestore().doc(
      `rateLimits/${request.auth.uid}/buckets/${winStart}`,
    );

    const result = await getFirestore().runTransaction(async (tx) => {
      const snap = await tx.get(bucketRef);
      const cur = snap.exists ? (snap.get("count") as number) : 0;
      if (cur >= 30) {
        return { ok: false as const, count: cur, limit: 30 };
      }
      if (cur === 0) {
        tx.set(bucketRef, { uid: request.auth!.uid, count: 1 });
      } else {
        tx.update(bucketRef, { count: cur + 1 });
      }
      return { ok: true as const, count: cur + 1, limit: 30 };
    });

    logger.info("ratelimit.check", {
      uid: request.auth.uid,
      scope: data.scope,
      ok: result.ok,
      count: result.count,
      limit: result.limit,
    });

    if (!result.ok) {
      throw new HttpsError("resource-exhausted", "Rate limit exceeded");
    }
    return result;
  }),
);
