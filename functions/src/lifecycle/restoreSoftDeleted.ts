// Phase 8 Wave 2 (LIFE-02 / Pattern A / Pitfall 17): restoreSoftDeleted —
// admin-only callable that reverses a soft-delete in a single Firestore batch:
//   1. live doc: deletedAt → null, restoredAt + restoredBy set
//   2. softDeleted/{type}/items/{id}: deleted
//
// Pitfall 17 mitigation: actor identity read EXCLUSIVELY from request.auth.token.
// T-08-03-01: admin role gate via token.role check.

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

    logger.info("lifecycle.restoreSoftDeleted", {
      type: data.type,
      orgId: data.orgId,
      id: data.id,
      actorUid: request.auth.uid,
    });
    return { ok: true };
  }),
);
