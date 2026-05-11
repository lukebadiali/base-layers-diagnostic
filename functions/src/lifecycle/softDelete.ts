// Phase 8 Wave 2 (LIFE-01 / LIFE-02 / LIFE-04 / Pattern A / Pitfall 17):
// softDelete — admin-only callable that tombstones a live document AND writes
// a full snapshot to softDeleted/{type}/items/{id} in a single Firestore
// batch (Pitfall G atomicity). The batch write is the single-source-of-truth
// for the soft-delete state; restoreSoftDeleted reverses it.
//
// Pitfall 17 mitigation: actor identity (uid) read EXCLUSIVELY from
// request.auth.token — NEVER from request.data. Caller cannot forge identity.
//
// T-08-03-01: admin role gate via token.role check (not request.data).
// T-08-03-02: Zod input validation; resolveDocPath exhaustive switch.
// T-08-03-07: already-deleted check before batch; idempotency 5-min window.
//
// Phase 9 Wave 3 (BLOCKER 3 fix): server-side `data.<type>.softDelete` audit
// emission landed AFTER the batch commit. Wave 4 Rule 3 + AUDIT-05 mirror-
// trigger collision dedup (Pitfall 7) read from these rows. The dual-emit
// pair is satisfied here + at the client wrapper (src/cloud/soft-delete.js).

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

const SoftDeleteInput = z.object({
  type: z.enum(SOFT_DELETABLE_TYPES),
  orgId: z.string().min(1).max(128),
  id: z.string().min(1).max(128),
  clientReqId: z.string().uuid(),
});

export const softDelete = onCall(
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

    const data = validateInput(SoftDeleteInput, request.data ?? {});
    await ensureIdempotent(
      `softDelete:${request.auth.uid}:${data.type}:${data.id}:${data.clientReqId}`,
      "softDelete",
      5 * 60,
    );

    const db = getFirestore();
    const liveRef = db.doc(resolveDocPath({ type: data.type, orgId: data.orgId, id: data.id }));
    const liveSnap = await liveRef.get();
    if (!liveSnap.exists) throw new HttpsError("not-found", "Document not found");
    const cur = liveSnap.data() ?? {};
    if (cur.deletedAt != null) throw new HttpsError("failed-precondition", "Already deleted");

    const snapRef = db.doc(resolveSnapshotPath({ type: data.type, id: data.id }));
    const batch = db.batch();
    batch.update(liveRef, {
      deletedAt: FieldValue.serverTimestamp(),
      deletedBy: request.auth.uid,
    });
    batch.set(snapRef, {
      ...cur,
      deletedAt: FieldValue.serverTimestamp(),
      deletedBy: request.auth.uid,
      originalPath: liveRef.path,
      originalType: data.type,
      originalOrgId: data.orgId,
    });
    await batch.commit();

    // Phase 9 Wave 3 (BLOCKER 3 / AUDIT-05): server-side bare emission of
    // data.<type>.softDelete. Client wrapper (src/cloud/soft-delete.js —
    // Plan 03) emits the .requested companion.
    // Best-effort: log + swallow on emit failure — do NOT block the underlying
    // soft-delete (Pattern 5 #2). The Firestore batch already committed; we
    // can't roll back the data mutation just because the audit emit fails.
    try {
      const token = (request.auth.token ?? {}) as Record<string, unknown>;
      await writeAuditEvent(
        {
          type: `data.${data.type}.softDelete` as
            | "data.action.softDelete"
            | "data.comment.softDelete"
            | "data.document.softDelete"
            | "data.message.softDelete"
            | "data.funnelComment.softDelete",
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
        type: `data.${data.type}.softDelete`,
        id: data.id,
        error: auditErr instanceof Error ? auditErr.message : String(auditErr),
      });
    }

    logger.info("lifecycle.softDelete", {
      type: data.type,
      orgId: data.orgId,
      id: data.id,
      actorUid: request.auth.uid,
    });
    return { ok: true };
  }),
);
