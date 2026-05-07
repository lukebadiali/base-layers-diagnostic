// src/observability/sentry.js
// @ts-check
// Phase 4 Wave 3 (D-11): empty stub seam. Phase 9 (OBS-01) replaces the body
// with @sentry/browser init + captureException + addBreadcrumb (PII scrubber +
// EU residency configuration). Views/* + cloud/* clients call captureError /
// addBreadcrumb today; calls are no-ops until Phase 9 — zero adapter-shape
// change.
//
// Cleanup-ledger row: "Phase 9 (OBS-01) replaces body with @sentry/browser
// init + captureException + addBreadcrumb" — closes at Phase 9.

/**
 * @param {Error} _err
 * @param {*} [_context]
 */
export function captureError(_err, _context) {
  /* Phase 9 body lands here (OBS-01) */
}

/**
 * @param {{ category: string, message: string, data?: any }} _crumb
 */
export function addBreadcrumb(_crumb) {
  /* Phase 9 body lands here (OBS-01) */
}
