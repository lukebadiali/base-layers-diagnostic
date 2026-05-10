// Phase 8 Wave 2 (LIFE-06 functional / Pitfall 7): Admin-callable that
// hard-deletes ONE softDeleted/{type}/items/{id} record on demand.
// Same hard-delete logic that scheduledPurge runs in batch — extracted
// here so the admin UI's "Permanently delete now" button can act
// immediately rather than waiting for the next 03:00 UTC purge cycle.
//
// Pitfall 7 mitigation: this function deletes EXACTLY ONE softDeleted
// record per invocation; no per-doc audit event mirror trigger storm
// (the softDeleted/* collection has no onDocumentDelete trigger wired).
//
// Service account: lifecycle-sa (same as softDelete + scheduledPurge —
// no new IAM provisioning required).
//
// T-08-03-09: admin role gate via token.role check (Pitfall 17).
// T-08-03-10: ensureIdempotent on key prevents double-click hard-delete replay.

import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";
import { withSentry } from "../util/sentry.js";
import { validateInput } from "../util/zod-helpers.js";
import { ensureIdempotent } from "../util/idempotency.js";
import { SOFT_DELETABLE_TYPES, resolveSnapshotPath } from "./resolveDocRef.js";

if (!getApps().length) initializeApp();
const SENTRY_DSN = defineSecret("SENTRY_DSN");

const PermanentlyDeleteInput = z.object({
  type: z.enum(SOFT_DELETABLE_TYPES),
  id: z.string().min(1).max(128),
  clientReqId: z.string().uuid(),
});

export const permanentlyDeleteSoftDeleted = onCall(
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

    const data = validateInput(PermanentlyDeleteInput, request.data ?? {});
    await ensureIdempotent(
      `permanentlyDeleteSoftDeleted:${request.auth.uid}:${data.type}:${data.id}:${data.clientReqId}`,
      "permanentlyDeleteSoftDeleted",
      5 * 60,
    );

    const db = getFirestore();
    const ref = db.doc(resolveSnapshotPath({ type: data.type, id: data.id }));
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Soft-deleted record not found");

    await ref.delete();

    logger.info("lifecycle.permanentlyDeleteSoftDeleted", {
      type: data.type,
      id: data.id,
      actorUid: request.auth.uid,
    });
    return { ok: true };
  }),
);
