// src/observability/sentry.js
// @ts-check
// Phase 9 Wave 1 (OBS-01 / OBS-02 / OBS-03): @sentry/browser init + capture +
// breadcrumb + setUser. Replaces the Phase 4 D-11 empty stub body. Scrubber
// shared with functions/src/util/sentry.ts via pii-scrubber.js + .ts twin
// (Pattern 11 + parity test).
//
// Init contract: empty-string DSN = no-op (kill-switch + local dev). EU
// residency encoded in the DSN itself (https://...@o<id>.ingest.de.sentry.io/...).
//
// Boot wiring is in src/main.js inside fbOnAuthStateChanged's first invocation
// (after claims hydration, before render) — Pitfall 3 mitigation.
//
// Fingerprint rate-limit (OBS-03): drops events when the same fingerprint
// fires >10x per minute. Wrapped inside beforeSend, runs BEFORE scrubPii so
// dropped events incur zero scrub cost.

import * as Sentry from "@sentry/browser";
import { scrubPii } from "./pii-scrubber.js";

let inited = false;

/** @type {Map<string, { count: number, windowStart: number }>} */
const fingerprintCounts = new Map();
const FP_WINDOW_MS = 60_000;
const FP_LIMIT = 10;

/** @param {*} event @returns {*|null} */
function fingerprintRateLimit(event) {
  const fp =
    event.fingerprint?.[0] ?? event.message ?? event.exception?.values?.[0]?.value ?? "unknown";
  const now = Date.now();
  const entry = fingerprintCounts.get(fp);
  if (!entry || now - entry.windowStart > FP_WINDOW_MS) {
    fingerprintCounts.set(fp, { count: 1, windowStart: now });
    return event;
  }
  entry.count += 1;
  if (entry.count > FP_LIMIT) return null;
  return event;
}

/** Test-only seam — reset internal state between Vitest cases. */
export function _resetForTest() {
  inited = false;
  fingerprintCounts.clear();
}

/**
 * Test-only seam — exposes the rate-limit predicate for unit tests.
 * @param {*} event
 */
export function _fingerprintRateLimitForTest(event) {
  return fingerprintRateLimit(event);
}

/**
 * @param {string} dsn
 * @param {string} release
 */
export function initSentryBrowser(dsn, release) {
  if (inited) return;
  if (!dsn) {
    inited = true;
    return;
  }
  Sentry.init({
    dsn,
    release,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    integrations: [
      Sentry.breadcrumbsIntegration({ console: false }),
      Sentry.globalHandlersIntegration(),
      Sentry.linkedErrorsIntegration(),
    ],
    beforeSend: (event) => {
      const e = fingerprintRateLimit(event);
      return e ? scrubPii(e) : null;
    },
    beforeBreadcrumb: (b) => scrubPii({ breadcrumb: b })?.breadcrumb ?? null,
  });
  inited = true;
}

/**
 * @param {Error} err
 * @param {*} [context]
 */
export function captureError(err, context) {
  if (context) {
    Sentry.withScope((scope) => {
      scope.setExtras(context);
      Sentry.captureException(err);
    });
  } else {
    Sentry.captureException(err);
  }
}

/** @param {{ category: string, message: string, data?: any }} crumb */
export function addBreadcrumb(crumb) {
  Sentry.addBreadcrumb(crumb);
}

/** @param {{ id: string, role?: string }} user */
export function setUser(user) {
  Sentry.setUser({ id: user.id, role: user.role });
}
