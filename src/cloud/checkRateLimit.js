// src/cloud/checkRateLimit.js
// @ts-check
// Phase 7 Wave 6 (FN-09 / 07-06): client-side wrapper for the checkRateLimit
// fallback callable. Pattern 5b status: callable is deployed (Wave 4) but the
// LIVE rate-limit primary path is the firestore.rules `rateLimitOk(uid)`
// predicate composed on messages + comments create rules (zero per-write Cloud
// Function cost — Pitfall 4 honoured). This wrapper exists so that an operator
// can hot-swap the rules-side path for the callable path with minimal source
// changes if the rules-side hits the single-`get()` budget under future
// predicate composition.
//
// Activation path:
//   1. Replace `incrementBucketAndWrite` in src/data/{messages,comments}.js
//      with a call to `checkRateLimit({scope: "chat" | "comment"})` followed
//      by the protected write
//   2. Drop the `&& rateLimitOk(uid)` conjunct from the messages + comments
//      create rules
//   3. Selective deploy `firebase deploy --only functions:checkRateLimit` +
//      `firebase deploy --only firestore:rules`
//
// Boundary: imports only from ../firebase/functions.js + ./retry.js — never
// from `firebase/functions` SDK directly. Phase 4 ESLint Wave 3 boundary is
// error-level; npm run lint exits 0 if compliant.
import { functions, httpsCallable } from "../firebase/functions.js";
import { withRetry } from "./retry.js";

const checkRateLimitCallable = httpsCallable(functions, "checkRateLimit");

/**
 * Check the per-user rate-limit bucket for the given scope. Returns
 * `{ok: true, count, limit}` on under-limit, throws `HttpsError("resource-exhausted")`
 * on over-limit. The clientReqId UUID is generated per call so the 60s
 * idempotency window coalesces retries (network flakes / view re-mounts)
 * without double-counting against the bucket.
 *
 * @param {{ scope: "chat" | "comment" }} input
 * @returns {Promise<{ ok: true, count: number, limit: number }>}
 */
export async function checkRateLimit(input) {
  const clientReqId = crypto.randomUUID();
  const result = await withRetry(
    () => checkRateLimitCallable({ ...input, clientReqId }),
    { retries: 3, baseMs: 250 },
  );
  return /** @type {{ ok: true, count: number, limit: number }} */ (result.data);
}
