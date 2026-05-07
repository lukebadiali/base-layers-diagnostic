// src/cloud/retry.js
// @ts-check
// Phase 4 Wave 3 (D-11): pass-through stub seam. Phase 7 (FN-09) replaces the
// body with exponential-backoff + 429-aware retry shared by every callable
// client in src/cloud/*.
//
// Cleanup-ledger row: "Phase 7 (FN-09) replaces body with
// exponential-backoff + 429-aware retry helper" — closes at Phase 7.

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ retries?: number, baseMs?: number }} [_opts]
 * @returns {Promise<T>}
 */
export async function withRetry(fn, _opts = {}) {
  return fn(); /* Phase 7 body lands here (FN-09) */
}
