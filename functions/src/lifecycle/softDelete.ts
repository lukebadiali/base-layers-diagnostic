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

import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";
import { withSentry } from "../util/sentry.js";
import { validateInput } from "../util/zod-helpers.js";
import { ensureIdempotent } from "../util/idempotency.js";
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

    logger.info("lifecycle.softDelete", {
      type: data.type,
      orgId: data.orgId,
      id: data.id,
      actorUid: request.auth.uid,
    });
    return { ok: true };
  }),
);
