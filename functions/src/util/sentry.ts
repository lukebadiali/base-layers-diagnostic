// Phase 7 Wave 1 (FN-03 / Pitfall 18): Sentry node init + withSentry handler
// wrapper. Wraps every callable + trigger handler so unhandled errors surface
// to Sentry with PII-scrubbed event payloads.
//
// Init contract:
//   - sendDefaultPii: false              (Pitfall 18 default)
//   - tracesSampleRate: 0.1              (Phase 7 RESEARCH.md default)
//   - beforeSend strips authorization, cookie headers + email/name/ip extras
//   - DSN read from process.env.SENTRY_DSN at first invocation; absent DSN =
//     no-op init (silent — local dev / emulator safe)
//
// Pattern C purity caveat: this module talks to Sentry only — does NOT import
// firebase-admin/*. Safe to load from any callable / trigger module.

import * as Sentry from "@sentry/node";
import { logger } from "firebase-functions/logger";

let inited = false;

/** Test-only seam: reset init state so vi.resetModules + re-import is unnecessary. */
export function _resetForTest(): void {
  inited = false;
}

function init(dsn: string): void {
  if (inited) return;
  if (!dsn) {
    // No DSN configured — skip init entirely. Local dev / unit-test path.
    inited = true;
    return;
  }
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      // Pitfall 18 #1 — strip auth + cookie headers.
      if (event.request?.headers) {
        const headers = event.request.headers as Record<string, unknown>;
        delete headers["authorization"];
        delete headers["Authorization"];
        delete headers["cookie"];
        delete headers["Cookie"];
      }
      // Strip user-identifying fields from extra context.
      if (event.extra && typeof event.extra === "object") {
        const extra = event.extra as Record<string, unknown>;
        for (const k of ["email", "name", "ip"]) {
          if (k in extra) delete extra[k];
        }
      }
      return event;
    },
  });
  inited = true;
}

/**
 * Wrap a Cloud Function handler with Sentry exception capture.
 * - Initialises Sentry on first invocation (idempotent).
 * - Returns the handler's result on success.
 * - On throw: captures the exception, logs error via firebase-functions/logger,
 *   then rethrows so HttpsError surfaces to the caller per Firebase contract.
 */
export function withSentry<TIn, TOut>(
  handler: (request: TIn) => Promise<TOut>,
): (request: TIn) => Promise<TOut> {
  return async (request: TIn) => {
    init(process.env.SENTRY_DSN ?? "");
    try {
      return await handler(request);
    } catch (err) {
      Sentry.captureException(err);
      const e = err as Error;
      logger.error("handler.error", { name: e?.name ?? "Error" });
      throw err;
    }
  };
}

/**
 * Test-only export of beforeSend behaviour so unit tests can exercise the
 * scrub logic directly without spinning up Sentry's transport.
 */
export function _scrubEventForTest(event: Record<string, unknown>): Record<string, unknown> {
  const e = event as {
    request?: { headers?: Record<string, unknown> };
    extra?: Record<string, unknown>;
  };
  if (e.request?.headers) {
    delete e.request.headers["authorization"];
    delete e.request.headers["Authorization"];
    delete e.request.headers["cookie"];
    delete e.request.headers["Cookie"];
  }
  if (e.extra && typeof e.extra === "object") {
    for (const k of ["email", "name", "ip"]) {
      if (k in e.extra) delete e.extra[k];
    }
  }
  return event;
}
