// src/cloud/retry.js
// @ts-check
// Phase 7 Wave 6 (FN-09 / 07-06): exponential-backoff helper for callable
// clients in src/cloud/*. Phase 4 D-11 introduced this seam as a pass-through
// stub; Wave 6 fills the body so src/cloud/audit.js (and any future caller)
// can absorb transient network / 429 / unavailable errors without dropping
// requests. Non-retryable Firebase HttpsError codes propagate immediately.
//
// Cleanup-ledger row: "Phase 7 (FN-09) replaces body with exponential-backoff
// + 429-aware retry helper" — closes at Phase 7 Wave 6.
//
// Boundary: this file imports nothing from firebase/* — pure-logic helper that
// composes over any async function. Phase 4 ESLint Wave 3 boundary preserved.

const NON_RETRYABLE_CODES = new Set([
  // Caller errors — retrying makes things worse
  "permission-denied",
  "invalid-argument",
  "unauthenticated",
  // Idempotency hit — duplicate detected, retry would re-detect the duplicate
  "already-exists",
  // Hard rejections that won't change between retries
  "not-found",
  "failed-precondition",
  "out-of-range",
  "data-loss",
]);

/**
 * Run `fn`, retrying on transient errors with exponential backoff + jitter.
 *
 * Defaults: 3 retries (4 total attempts), base 250ms, jitter [0..baseMs] random.
 * Non-retryable HttpsError codes propagate immediately. Any non-coded error
 * (e.g., a bare network rejection) is treated as retryable so we degrade safely
 * under transient connectivity loss.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ retries?: number, baseMs?: number }} [opts]
 * @returns {Promise<T>}
 */
export async function withRetry(fn, opts = {}) {
  const retries = opts.retries ?? 3;
  const baseMs = opts.baseMs ?? 250;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const code = /** @type {{ code?: string }} */ (err)?.code;
      if (typeof code === "string" && NON_RETRYABLE_CODES.has(code)) {
        throw err;
      }
      if (attempt === retries) throw err;
      // CSPRNG-sourced jitter (project ESLint rule no-restricted-syntax bans
      // Math.random everywhere — even for non-security uses like backoff
      // jitter). Single u32 → fraction in [0,1) → scaled to [0,baseMs).
      const buf = new Uint32Array(1);
      crypto.getRandomValues(buf);
      const jitterMs = ((buf[0] ?? 0) / 0xffffffff) * baseMs;
      const delay = baseMs * Math.pow(2, attempt) + jitterMs;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastErr;
}
