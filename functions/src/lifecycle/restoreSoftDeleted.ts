// Phase 8 Wave 2 (LIFE-02 / Pattern A / Pitfall 17): restoreSoftDeleted —
// admin-only callable that reverses a soft-delete in a single Firestore batch:
//   1. live doc: deletedAt → null, restoredAt + restoredBy set
//   2. softDeleted/{type}/items/{id}: deleted
//
// Pitfall 17 mitigation: actor identity read EXCLUSIVELY from request.auth.token.
// T-08-03-01: admin role gate via token.role check.
//
// Phase 9 Wave 3 (BLOCKER 3 fix): server-side `data.<type>.restore` audit
// emission landed AFTER the batch commit. Wave 4 anomaly rules read from
// these rows. The dual-emit pair is satisfied here + at the client wrapper
// (src/cloud/soft-delete.js — Plan 03 .requested companion).

import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withSentry } from "../util/sentry.js";
import { validateInput } from "../util/zod-helpers.js";
import { ensureIdempotent } from "../util/idempotency.js";
import { writeAuditEvent } from "../audit/auditLogger.js";
import { SOFT_DELETABLE_TYPES, resolveDocPath, resolveSnapshotPath } from "./resolveDocRef.js";

if (!getApps().length) initializeApp();

const SENTRY_DSN = defineSecret("SENTRY_DSN");

const RestoreInput = z.object({
  type: z.enum(SOFT_DELETABLE_TYPES),
  orgId: z.string().min(1).max(128),
  id: z.string().min(1).max(128),
  clientReqId: z.string().uuid(),
});

export const restoreSoftDeleted = onCall(
  {
    region: "europe-west2",
    enforceAppCheck: true,
    serviceAccount: "lifecycle-sa",
    secrets: [SENTRY_DSN],
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  withSentry(async (request: CallableRequest<unknown>) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }
    const token = (request.auth.token ?? {}) as Record<string, unknown>;
    if (token.role !== "admin") {
      throw new HttpsError("permission-denied", "admin role required");
    }

    const data = validateInput(RestoreInput, request.data ?? {});
    await ensureIdempotent(
      `restoreSoftDeleted:${request.auth.uid}:${data.type}:${data.id}:${data.clientReqId}`,
      "restoreSoftDeleted",
      5 * 60,
    );

    const db = getFirestore();
    const snapRef = db.doc(resolveSnapshotPath({ type: data.type, id: data.id }));
    const snap = await snapRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Soft-deleted record not found");

    const liveRef = db.doc(resolveDocPath({ type: data.type, orgId: data.orgId, id: data.id }));
    const batch = db.batch();
    batch.update(liveRef, {
      deletedAt: null,
      deletedBy: null,
      restoredAt: FieldValue.serverTimestamp(),
      restoredBy: request.auth.uid,
    });
    batch.delete(snapRef);
    await batch.commit();

    // Phase 9 Wave 3 (BLOCKER 3 / AUDIT-05): server-side bare emission of
    // data.<type>.restore. Client wrapper (src/cloud/soft-delete.js — Plan
    // 03) emits the .requested companion.
    // Best-effort: log + swallow on emit failure — do NOT block the underlying
    // restore (Pattern 5 #2). The Firestore batch already committed.
    try {
      const token = (request.auth.token ?? {}) as Record<string, unknown>;
      await writeAuditEvent(
        {
          type: `data.${data.type}.restore` as
            | "data.action.restore"
            | "data.comment.restore"
            | "data.document.restore"
            | "data.message.restore"
            | "data.funnelComment.restore",
          target: { type: data.type, id: data.id, orgId: data.orgId },
          clientReqId: data.clientReqId,
          payload: {},
        },
        {
          now: Date.now(),
          eventId: randomUUID(),
          ip: null,
          userAgent: null,
          actor: {
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
          },
        },
      );
    } catch (auditErr) {
      logger.warn("audit.emit.failed", {
        type: `data.${data.type}.restore`,
        id: data.id,
        error: auditErr instanceof Error ? auditErr.message : String(auditErr),
      });
    }

    logger.info("lifecycle.restoreSoftDeleted", {
      type: data.type,
      orgId: data.orgId,
      id: data.id,
      actorUid: request.auth.uid,
    });
    return { ok: true };
  }),
);
