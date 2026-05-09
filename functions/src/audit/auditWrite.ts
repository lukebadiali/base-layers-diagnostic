// Phase 7 Wave 2 (FN-01 / FN-03 / FN-04 / FN-07 / AUDIT-01 / AUDIT-04):
// auditWrite — primary application-tier writer for the auditLog/{eventId}
// collection. Pattern A standard callable shape:
//
//   - enforceAppCheck: true                        (FN-07)
//   - serviceAccount: "audit-writer-sa"            (FN-04 — Wave 1 SA inventory)
//   - secrets: [SENTRY_DSN]                        (FN-05; defineSecret)
//   - withSentry handler wrapper                   (FN-03; Pitfall 18 PII scrub)
//   - validateInput(auditEventInput, request.data) (AUDIT-02 Zod gate)
//   - ensureIdempotent(...) before writeAuditEvent (FN-03; 5-min window)
//
// Pitfall 17 (audit-log integrity): actor.{uid,email,role,orgId} are read
// EXCLUSIVELY from `request.auth.token`. They are NEVER copied from
// `request.data`. The caller cannot forge their identity in the audit row.
//
// Phase 7 firestore.rules has `match /auditLog/{eventId} { allow write: if false }` —
// only Admin SDK writes (this callable) reach the collection. Wave 6 TEST-09
// adds firebase-functions-test integration coverage; Wave 2 ships the
// hardened wiring shape and unit-tests it via the same pure-mocked seam used
// by setClaims (functions/test/auth/setClaims.unit.test.ts).

import { randomUUID } from "node:crypto";
import {
  onCall,
  HttpsError,
  type CallableRequest,
} from "firebase-functions/v2/https";
import { logger } from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { withSentry } from "../util/sentry.js";
import { validateInput } from "../util/zod-helpers.js";
import { ensureIdempotent } from "../util/idempotency.js";
import { auditEventInput } from "./auditEventSchema.js";
import { writeAuditEvent } from "./auditLogger.js";

if (!getApps().length) initializeApp();

const SENTRY_DSN = defineSecret("SENTRY_DSN");

export const auditWrite = onCall(
  {
    region: "europe-west2",
    enforceAppCheck: true,
    serviceAccount: "audit-writer-sa",
    secrets: [SENTRY_DSN],
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  withSentry(async (request: CallableRequest<unknown>) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }
    const data = validateInput(auditEventInput, request.data ?? {});

    // Idempotency-marker write BEFORE the side effect (FN-03; 5-min window).
    const idempotencyKey = `${request.auth.uid}:${data.type}:${data.target.id}:${data.clientReqId}`;
    await ensureIdempotent(idempotencyKey, "auditWrite", 5 * 60);

    const eventId = randomUUID();

    // Read transport-tier metadata from the raw request when available.
    const headers = (request.rawRequest?.headers ?? {}) as Record<
      string,
      string | string[] | undefined
    >;
    const xff = headers["x-forwarded-for"];
    const xffStr = Array.isArray(xff) ? xff[0] : xff;
    const ip =
      typeof xffStr === "string" && xffStr.length > 0
        ? xffStr.split(",")[0]?.trim() ?? null
        : null;
    const ua = headers["user-agent"];
    const uaStr = Array.isArray(ua) ? ua[0] : ua;
    const userAgent = typeof uaStr === "string" && uaStr.length > 0 ? uaStr : null;

    // Pitfall 17: actor identity sourced EXCLUSIVELY from the verified ID
    // token, NEVER from request.data. Falls back to nulls when optional
    // claims (email, role, orgId) are absent.
    const token = (request.auth.token ?? {}) as Record<string, unknown>;
    const actor = {
      uid: request.auth.uid,
      email: typeof token.email === "string" ? token.email : null,
      role:
        token.role === "admin" ||
        token.role === "internal" ||
        token.role === "client" ||
        token.role === "system"
          ? token.role
          : null,
      orgId: typeof token.orgId === "string" ? token.orgId : null,
    } as const;

    await writeAuditEvent(data, {
      now: Date.now(),
      eventId,
      actor,
      ip,
      userAgent,
      idempotencyKey,
    });

    logger.info("audit.write", {
      eventId,
      type: data.type,
      actorUid: request.auth.uid,
    });
    return { ok: true, eventId };
  }),
);
