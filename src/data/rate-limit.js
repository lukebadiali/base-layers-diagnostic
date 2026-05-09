// src/data/rate-limit.js
// @ts-check
// Phase 7 Wave 4 (FN-09 / 07-04): client-side helper that runs the protected
// write inside a runTransaction so the per-uid bucket counter increments
// atomically with the protected doc create. If the rules-side `rateLimitOk`
// predicate denies (bucket.count >= 30 OR window-tampering OR cross-uid),
// runTransaction throws permission-denied — caller translates to a UX
// message via the unified-error wrapper precedent (Phase 6 D-13).
//
// Bucket doc shape mirrors the firestore.rules predicate exactly:
//   rateLimits/{uid}/buckets/{windowStart} = { uid, count }
//
// Boundary contract (eslint Phase 4 Wave 3 D-04): src/data/* may import the
// SDK only through src/firebase/db.js + src/firebase/storage.js. This file
// imports `db` + `doc` + `runTransaction` exclusively from db.js — no direct
// firebase/firestore imports. Phase 7 Wave 4 added `runTransaction` to db.js
// re-exports so the boundary stays clean.
//
// Payload-pass-through invariant: the helper writes `protectedDocPayload`
// VERBATIM (no field rewrites). Caller is responsible for adding the
// timestamp field name expected by parent-collection consumers (existing
// tests/data/{messages,comments}.test.js assert `createdAt: serverTimestamp()`
// — Phase 7 Wave 4 preserves that contract by NOT injecting an `at` field).
//
// Wired callers (Phase 7 Wave 4):
//   - src/data/messages.js → addMessage routes through incrementBucketAndWrite
//   - src/data/comments.js → addComment routes through incrementBucketAndWrite
//
// Cleanup-ledger queue: other write paths (responses, actions, documents,
// funnelComments) are NOT rate-limited at this wave — Phase 8/9 revisits if
// the chat+comments threshold proves insufficient. Rules-side primary path;
// functions/src/ratelimit/checkRateLimit.ts is the deployed-but-unwired
// fallback seam (Pattern 5b — operator hot-swap if rules budget is hit).
import {
  db,
  doc,
  runTransaction,
} from "../firebase/db.js";

/**
 * Returns the windowStart (ms since epoch, floored to 60s boundary) for "now".
 * Mirrors firestore.rules `rateLimitWindow()` so the bucket doc id matches the
 * predicate's get() target. The rules-side derives the same value from
 * request.time (server-controlled) — minor client/server clock skew is
 * tolerated by the rules predicate composing `windowStart == rateLimitWindow()`.
 *
 * @returns {number}
 */
export function currentRateLimitWindow() {
  return Math.floor(Date.now() / 60_000) * 60_000;
}

/**
 * Atomically increment the per-uid 60s bucket counter and write the protected
 * doc. If the bucket already has count >= 30, the rules predicate denies the
 * write and runTransaction throws — caller catches and surfaces a UX message.
 *
 * Behaviour:
 *   - First write in window: creates bucket with { uid, count: 1 } + writes
 *     protected doc. Rules `create` predicate enforces count == 1 + windowStart
 *     matches server's current window.
 *   - Subsequent writes in window: reads current bucket count, updates to
 *     count + 1, writes protected doc. Rules `update` predicate enforces
 *     monotonic +1 + cap 30.
 *   - 31st write in window: predicate denies because update would push
 *     count > 30; transaction aborts with permission-denied — caller
 *     translates to "rate limit hit" UX message.
 *
 * Caller MUST already have auth-gated (auth.currentUser?.uid). Caller MUST
 * also catch the rejected promise — bare callers will see Firebase's
 * permission-denied error code which leaks via console; surface a UX-safe
 * message instead (Pitfall: don't show raw Firebase error codes — Phase 6
 * D-13 unified-error precedent).
 *
 * @template T
 * @param {string} uid                request.auth.uid (caller MUST have already auth-gated)
 * @param {string} protectedDocPath   e.g. "orgs/orgA/messages/abc123"
 * @param {T} protectedDocPayload     document body (must satisfy parent collection's create rule)
 * @returns {Promise<void>}
 */
export async function incrementBucketAndWrite(
  uid,
  protectedDocPath,
  protectedDocPayload,
) {
  const win = currentRateLimitWindow();
  const bucketRef = doc(db, `rateLimits/${uid}/buckets/${win}`);
  const protectedRef = doc(db, protectedDocPath);

  await runTransaction(db, async (/** @type {any} */ tx) => {
    const snap = await tx.get(bucketRef);
    if (!snap.exists()) {
      // First write in window — create bucket. Rules require count == 1.
      tx.set(bucketRef, { uid, count: 1 });
    } else {
      // Subsequent write — monotonic +1. Rules enforce count == n+1 + cap 30;
      // when bucket.count >= 30, the rules-side denies and runTransaction
      // throws.
      tx.update(bucketRef, { count: snap.data().count + 1 });
    }
    // Pass payload through verbatim — caller owns the timestamp field name
    // (existing data/* contracts use `createdAt: serverTimestamp()`).
    tx.set(protectedRef, /** @type {any} */ (protectedDocPayload));
  });
}
