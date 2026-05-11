// Phase 8 Wave 4 (GDPR-02 / GDPR-03 / GDPR-04 / GDPR-05 / FN-03 / FN-04
// / FN-05 / FN-07 / Pitfall 11): admin-only callable that pseudonymises
// every reference to a user and writes an entry to redactionList for
// backup-rotation propagation.
//
// Service account: gdpr-writer-sa (broader IAM than gdpr-reader-sa —
// datastore.user + firebaseauth.admin + storage.objectAdmin scoped to
// uploads bucket). Operator provisions per 08-06 close-gate.
//
// Secret: GDPR_PSEUDONYM_SECRET via defineSecret. MUST be set in Firebase
// Secret Manager BEFORE first deploy/invocation; otherwise the pure
// tombstoneTokenForUser helper throws "secret required".
//
// Audit event: SINGLE compliance.erase.user summary event with counts
// payload (Pitfall 7 — never per-doc).
//
// Pitfall 11 (audit log vs erasure):
//   auditLog rows about the erased user are KEPT for compliance (GDPR
//   Art. 6(1)(f) legitimate interest). Only actor.uid, actor.email, and
//   payload.email are tombstoned in-place. The event record is preserved.

import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withSentry } from "../util/sentry.js";
import { validateInput } from "../util/zod-helpers.js";
import { ensureIdempotent } from "../util/idempotency.js";
import { writeAuditEvent } from "../audit/auditLogger.js";
import { tombstoneTokenForUser } from "./pseudonymToken.js";
import { DOCUMENT_AUTHOR_FIELDS } from "./assembleUserBundle.js";
import {
  buildCascadeOps,
  chunkOpsForBatchedWrite,
  ERASED_AT_SENTINEL,
  type InputDoc,
} from "./eraseCascade.js";

if (!getApps().length) initializeApp();
const SENTRY_DSN = defineSecret("SENTRY_DSN");
const GDPR_PSEUDONYM_SECRET = defineSecret("GDPR_PSEUDONYM_SECRET");

const GdprEraseInput = z.object({
  userId: z.string().min(1).max(128),
  clientReqId: z.string().uuid(),
});

export const gdprEraseUser = onCall(
  {
    region: "europe-west2",
    enforceAppCheck: true,
    serviceAccount: "gdpr-writer-sa",
    secrets: [SENTRY_DSN, GDPR_PSEUDONYM_SECRET],
    memory: "1GiB",      // larger than export — cascade may aggregate thousands of ops
    timeoutSeconds: 540,
  },
  withSentry(async (request: CallableRequest<unknown>) => {
    // Auth gate — unauthenticated check first
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    // Admin role gate — read from verified token (Pitfall 17)
    const token = (request.auth.token ?? {}) as Record<string, unknown>;
    if (token.role !== "admin") {
      throw new HttpsError("permission-denied", "admin role required");
    }

    // Input validation
    const data = validateInput(GdprEraseInput, request.data ?? {});
    const userId = data.userId;

    // Idempotency — 5-min window per (actor × target × clientReqId)
    await ensureIdempotent(
      `gdprEraseUser:${request.auth.uid}:${userId}:${data.clientReqId}`,
      "gdprEraseUser",
      5 * 60,
    );

    // Deterministic tombstone token (Pitfall C — same uid+secret → same token across retries)
    const tombstone = tombstoneTokenForUser(userId, GDPR_PSEUDONYM_SECRET.value());
    const db = getFirestore();

    // ── Parallel pre-fetch of all user-linked data ──────────────────────────
    // Mirrors gdprExportUser query layout.
    // M-02: include legacyAuthorId queries for messages/comments to cover
    // pre-D-03 records that may have legacyAuthorId but no authorId field.
    const [
      profileSnap,
      auditSnap,
      messagesSnap,
      messagesLegacySnap,
      commentsSnap,
      commentsLegacySnap,
      actionsSnap,
      funnelCommentsSnap,
      // One snap per DOCUMENT_AUTHOR_FIELDS entry via collectionGroup
      ...documentsSnaps
    ] = await Promise.all([
      db.doc(`users/${userId}`).get(),
      db.collection("auditLog").where("actor.uid", "==", userId).get(),
      db.collectionGroup("messages").where("authorId", "==", userId).get(),
      db.collectionGroup("messages").where("legacyAuthorId", "==", userId).get(),
      db.collectionGroup("comments").where("authorId", "==", userId).get(),
      db.collectionGroup("comments").where("legacyAuthorId", "==", userId).get(),
      db.collectionGroup("actions").where("ownerId", "==", userId).get(),
      db.collection("funnelComments").where("authorId", "==", userId).get(),
      // collectionGroup for subcollection orgs/{orgId}/documents/{docId}
      ...DOCUMENT_AUTHOR_FIELDS.map((f) =>
        db.collectionGroup("documents").where(f, "==", userId).get(),
      ),
    ]);

    // Legacy top-level `documents/` collection (pre-Phase-5 main.js writes)
    const legacyDocsSnaps = await Promise.all(
      DOCUMENT_AUTHOR_FIELDS.map((f) =>
        db.collection("documents").where(f, "==", userId).get(),
      ),
    );

    const toInput = (snap: FirebaseFirestore.QuerySnapshot): InputDoc[] =>
      snap.docs.map((d) => ({ path: d.ref.path, data: (d.data() ?? {}) as Record<string, unknown> }));

    // De-dupe messages and comments by path across authorId + legacyAuthorId queries (M-02).
    const mergeByPath = (...snaps: FirebaseFirestore.QuerySnapshot[]): InputDoc[] => {
      const byPath = new Map<string, InputDoc>();
      for (const s of snaps) {
        for (const d of toInput(s)) {
          if (!byPath.has(d.path)) byPath.set(d.path, d);
        }
      }
      return [...byPath.values()];
    };

    // De-dupe documents by path across the 3 field queries.
    const docsByPath = new Map<string, InputDoc>();
    for (const s of documentsSnaps) {
      for (const d of toInput(s)) {
        if (!docsByPath.has(d.path)) docsByPath.set(d.path, d);
      }
    }
    const legacyByPath = new Map<string, InputDoc>();
    for (const s of legacyDocsSnaps) {
      for (const d of toInput(s)) {
        if (!legacyByPath.has(d.path)) legacyByPath.set(d.path, d);
      }
    }

    const allMessages = mergeByPath(messagesSnap, messagesLegacySnap);
    const allComments = mergeByPath(commentsSnap, commentsLegacySnap);

    // ── Build cascade ops (pure helper — Pattern C) ─────────────────────────
    const ops = buildCascadeOps(userId, tombstone, {
      userDoc: profileSnap.exists
        ? {
            // Use .ref?.path with fallback to .path (mock exposes .path directly)
            path: (profileSnap as { ref?: { path: string }; path?: string }).ref?.path
              ?? (profileSnap as { path?: string }).path
              ?? `users/${userId}`,
            data: (profileSnap.data() ?? {}) as Record<string, unknown>,
          }
        : null,
      messages: allMessages,
      comments: allComments,
      actions: toInput(actionsSnap),
      documentsSubcoll: [...docsByPath.values()],
      documentsLegacy: [...legacyByPath.values()],
      funnelComments: toInput(funnelCommentsSnap),
      auditEvents: toInput(auditSnap),
    });

    // ── Write ops in 500-batch chunks ────────────────────────────────────────
    // Substitute ERASED_AT_SENTINEL with FieldValue.serverTimestamp() at write time.
    const chunks = chunkOpsForBatchedWrite(ops);
    for (const chunk of chunks) {
      const batch = db.batch();
      for (const op of chunk) {
        const ref = db.doc(op.path);
        const patch: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(op.patch)) {
          patch[k] = v === ERASED_AT_SENTINEL ? FieldValue.serverTimestamp() : v;
        }
        batch.update(ref, patch);
      }
      await batch.commit();
    }

    // ── Disable Auth user (idempotent — repeated disable is a no-op) ─────────
    try {
      await getAuth().updateUser(userId, { disabled: true });
    } catch (err) {
      // user-not-found is acceptable (the Firestore profile may exist
      // for a uid the Auth tier no longer recognises). Log and continue.
      logger.warn("compliance.erase.auth.user_not_found", {
        userId,
        err: (err as Error).message,
      });
    }

    // ── GDPR-03 Storage object enumeration ───────────────────────────────────
    // After Firestore tombstoning, delete the underlying Storage objects for
    // all user-uploaded documents.
    // For each tombstoned documents row, derive the Storage path:
    //   orgs/{orgId}/documents/{docId}/{filename}
    // Wrap each delete in try/catch so a missing object does not abort the cascade.
    let storageObjectsDeleted = 0;
    let storageObjectsMissing = 0;
    const uploadsBucket = getStorage().bucket("bedeveloped-base-layers-uploads");
    const allDocRows = [...docsByPath.values(), ...legacyByPath.values()];
    for (const docRow of allDocRows) {
      const docData = docRow.data as Record<string, unknown>;
      // Derive path components from the Firestore path
      const segs = docRow.path.split("/");
      // Subcollection: orgs/{orgId}/documents/{docId} (4 segments)
      // Legacy: documents/{docId} (2 segments)
      const isSubcoll =
        segs.length === 4 && segs[0] === "orgs" && segs[2] === "documents";
      const isLegacy = segs.length === 2 && segs[0] === "documents";
      const orgId = isSubcoll
        ? segs[1]
        : typeof docData.orgId === "string"
          ? docData.orgId
          : null;
      const docId = isSubcoll ? segs[3] : isLegacy ? segs[1] : null;
      const filename =
        typeof docData.filename === "string"
          ? docData.filename
          : typeof docData.name === "string"
            ? docData.name
            : typeof docData.path === "string"
              ? docData.path.split("/").pop() ?? null
              : null;

      if (!orgId || !docId || !filename) {
        logger.warn("compliance.erase.storage.path_underivable", {
          docPath: docRow.path,
        });
        continue;
      }

      const storagePath = `orgs/${orgId}/documents/${docId}/${filename}`;
      try {
        await uploadsBucket.file(storagePath).delete();
        storageObjectsDeleted += 1;
      } catch (err) {
        // 404 / not-found is acceptable (already deleted, never uploaded,
        // or path mismatch from legacy data). Log + continue.
        const msg = (err as Error).message ?? String(err);
        if (/not.*found|404|no such object/i.test(msg)) {
          storageObjectsMissing += 1;
        } else {
          logger.warn("compliance.erase.storage.delete_failed", {
            storagePath,
            err: msg,
          });
        }
      }
    }

    // ── redactionList/{userId} ────────────────────────────────────────────────
    // Backup-rotation cycle reads this to re-apply tombstone tokens after restore.
    await db.doc(`redactionList/${userId}`).set({
      tombstoneToken: tombstone,
      erasedAt: FieldValue.serverTimestamp(),
      erasedBy: request.auth.uid,
      schemaVersion: 1,
    });

    // ── Single summary audit event (Pitfall 7 — never per-doc) ──────────────
    const eventId = randomUUID();
    const counts = {
      messages: allMessages.length,
      comments: allComments.length,
      actions: actionsSnap.size,
      documentsSubcoll: docsByPath.size,
      documentsLegacy: legacyByPath.size,
      funnelComments: funnelCommentsSnap.size,
      auditEvents: auditSnap.size,
      storageObjectsDeleted,
      storageObjectsMissing,
      totalOps: ops.length,
    };

    await writeAuditEvent(
      {
        type: "compliance.erase.user",
        severity: "alert",
        target: { type: "user", id: userId, orgId: null },
        clientReqId: data.clientReqId,
        payload: { tombstoneToken: tombstone, counts },
      },
      {
        now: Date.now(),
        eventId,
        actor: {
          uid: request.auth.uid,
          email: typeof token.email === "string" ? token.email : null,
          role: "admin",
          orgId: typeof token.orgId === "string" ? token.orgId : null,
        },
        ip: null,
        userAgent: null,
        idempotencyKey: `compliance.erase.user:${request.auth.uid}:${userId}:${data.clientReqId}`,
      },
    );

    logger.warn("compliance.gdprEraseUser", {
      actorUid: request.auth.uid,
      targetUserId: userId,
      totalOps: ops.length,
    });

    return { ok: true, counts };
  }),
);
