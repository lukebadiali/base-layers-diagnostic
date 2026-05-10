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
//
// Phase 9 Wave 1 (OBS-01): beforeSend extended to scrub via the shared
// PII_KEYS dictionary in ./pii-scrubber.ts (parity-tested with the browser
// twin at src/observability/pii-scrubber.js). Free-form request bodies are
// also clipped to "<redacted-body>" to defend against chat/comment payload
// leaks (Pitfall 18 #4).

import * as Sentry from "@sentry/node";
import { logger } from "firebase-functions/logger";
import { PII_KEYS } from "./pii-scrubber.js";

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
        for (const k of ["authorization", "Authorization", "cookie", "Cookie"]) {
          delete headers[k];
        }
      }
      // Phase 9 (extend) — strip extras + contexts via shared dictionary.
      const bags: Record<string, unknown>[] = [];
      if (event.extra && typeof event.extra === "object") {
        bags.push(event.extra as Record<string, unknown>);
      }
      if (event.contexts && typeof event.contexts === "object") {
        for (const c of Object.values(event.contexts)) {
          if (c && typeof c === "object") bags.push(c as Record<string, unknown>);
        }
      }
      for (const bag of bags) {
        for (const k of PII_KEYS) {
          if (k in bag) bag[k] = "<redacted>";
        }
      }
      // Phase 9 (NEW) — clip free-form request bodies (chat/comment payload
      // defence — Pitfall 18 #4).
      if (event.request && typeof event.request === "object") {
        const req = event.request as Record<string, unknown>;
        for (const k of ["data", "body"]) {
          if (typeof req[k] === "string") req[k] = "<redacted-body>";
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
 *
 * Phase 9 (OBS-01) extended: now uses the shared PII_KEYS dictionary, applies
 * to extras AND each contexts bag, and clips free-form request.data/body
 * strings to "<redacted-body>". The redaction contract changed from `delete`
 * (Phase 7) to `"<redacted>"` assignment — keeps the field present so SRE can
 * still see "this PII slot WAS populated" without leaking the value.
 */
export function _scrubEventForTest(event: Record<string, unknown>): Record<string, unknown> {
  const e = event as {
    request?: { headers?: Record<string, unknown>; data?: unknown; body?: unknown } & Record<string, unknown>;
    extra?: Record<string, unknown>;
    contexts?: Record<string, unknown>;
  };
  if (e.request?.headers) {
    for (const k of ["authorization", "Authorization", "cookie", "Cookie"]) {
      delete e.request.headers[k];
    }
  }
  const bags: Record<string, unknown>[] = [];
  if (e.extra && typeof e.extra === "object") bags.push(e.extra);
  if (e.contexts && typeof e.contexts === "object") {
    for (const c of Object.values(e.contexts)) {
      if (c && typeof c === "object") bags.push(c as Record<string, unknown>);
    }
  }
  for (const bag of bags) {
    for (const k of PII_KEYS) {
      if (k in bag) bag[k] = "<redacted>";
    }
  }
  if (e.request && typeof e.request === "object") {
    const req = e.request as Record<string, unknown>;
    for (const k of ["data", "body"]) {
      if (typeof req[k] === "string") req[k] = "<redacted-body>";
    }
  }
  return event;
}
