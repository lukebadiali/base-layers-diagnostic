// Phase 8 Wave 3 (GDPR-01 / FN-03 / FN-04 / FN-07 / Pitfall 11):
// gdprExportUser — admin-only callable that assembles all user-linked data
// into a JSON bundle, uploads to GCS, and returns a 24h V4 signed URL.
//
// Pattern A standard callable shape (mirror of softDelete + auditWrite):
//   - enforceAppCheck: true
//   - serviceAccount: "gdpr-reader-sa" (read-only IAM per FN-04 / 08-RESEARCH.md Open Q3)
//   - secrets: [SENTRY_DSN]
//   - withSentry handler wrapper
//   - validateInput(GdprExportInput, request.data)
//   - ensureIdempotent(...) before assembly (5-min window — accidental click deduped;
//     intentional re-runs use new clientReqId)
//
// Pitfall 17: target userId is from request.data; actor is from request.auth.token.
// The audit event records actor.uid !== target.uid (admin exporting on behalf
// of subject) — that asymmetry is the legitimate-interest signal under GDPR.
//
// T-08-04-01: bundlePath (gs:// URI) and urlExpiresAt are logged in audit payload,
//             but the signed URL string itself is NEVER logged or audited.
// T-08-04-02: SIGNED_URL_TTL_MS is a constant — no caller-supplied TTL.
// T-08-04-03: admin role gate from request.auth.token (Pitfall 17).
// T-08-04-05: writeAuditEvent fires before return (synchronous).
// T-08-04-06: assembleUserBundle re-filters audit events by actor.uid (defensive).
// T-08-04-07: memory:512MiB + timeoutSeconds:540 for large-user resilience.
// T-08-04-08: ensureIdempotent with 5-min window on clientReqId.

import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withSentry } from "../util/sentry.js";
import { validateInput } from "../util/zod-helpers.js";
import { ensureIdempotent } from "../util/idempotency.js";
import { writeAuditEvent } from "../audit/auditLogger.js";
import {
  assembleUserBundle,
  DOCUMENT_AUTHOR_FIELDS,
  type QueryResults,
} from "./assembleUserBundle.js";

if (!getApps().length) initializeApp();

const SENTRY_DSN = defineSecret("SENTRY_DSN");

/** Destination bucket for all GDPR export bundles (same bucket as Firestore backups, separate path). */
const EXPORT_BUCKET = "bedeveloped-base-layers-backups";

/** T-08-04-02: TTL is a pinned constant — no caller-supplied override. */
const SIGNED_URL_TTL_MS = 24 * 60 * 60 * 1000; // GDPR-01: 24h max (EDPB "without undue delay")

const GdprExportInput = z.object({
  userId: z.string().min(1).max(128),
  clientReqId: z.string().uuid(),
});

export const gdprExportUser = onCall(
  {
    region: "europe-west2",
    enforceAppCheck: true,
    serviceAccount: "gdpr-reader-sa",
    secrets: [SENTRY_DSN],
    memory: "512MiB",
    timeoutSeconds: 540, // bundle assembly + GCS save can be slow for large users (T-08-04-07)
  },
  withSentry(async (request: CallableRequest<unknown>) => {
    // Auth gate — unauthenticated check first
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }

    // T-08-04-03: admin role gate — read from verified token (Pitfall 17)
    const token = (request.auth.token ?? {}) as Record<string, unknown>;
    if (token.role !== "admin") {
      throw new HttpsError("permission-denied", "admin role required");
    }

    // Input validation
    const data = validateInput(GdprExportInput, request.data ?? {});
    const userId = data.userId;

    // T-08-04-08: idempotency — 5-min window per (actor × target × clientReqId)
    await ensureIdempotent(
      `gdprExportUser:${request.auth.uid}:${userId}:${data.clientReqId}`,
      "gdprExportUser",
      5 * 60,
    );

    const db = getFirestore();
    const now = Date.now();

    // ── Parallel pre-fetch of all user-linked data ───────────────────────────
    // 1 users/{uid} doc + 1 auditLog collection + 6 collectionGroup queries
    // + 3 × DOCUMENT_AUTHOR_FIELDS (document subcollections) + legacy top-level docs
    //
    // DOCUMENT_AUTHOR_FIELDS = ["uploaderId", "uploadedBy", "legacyAppUserId"]
    // Each field requires a separate query (Firestore limitation: each collectionGroup
    // query can only filter on one field at a time).
    // M-02: include legacyAuthorId queries for messages/comments to cover
    // pre-D-03 records that may have legacyAuthorId but no authorId field.
    const [
      profileSnap,
      auditSnap,
      responsesSnap,
      commentsSnap,
      commentsLegacySnap,
      actionsSnap,
      messagesSnap,
      messagesLegacySnap,
      funnelCommentsSnap,
      // One snap per DOCUMENT_AUTHOR_FIELDS entry via collectionGroup
      ...documentsSnaps
    ] = await Promise.all([
      db.doc(`users/${userId}`).get(),
      db.collection("auditLog").where("actor.uid", "==", userId).get(),
      db.collectionGroup("responses").where("userId", "==", userId).get(),
      db.collectionGroup("comments").where("authorId", "==", userId).get(),
      db.collectionGroup("comments").where("legacyAuthorId", "==", userId).get(),
      db.collectionGroup("actions").where("ownerId", "==", userId).get(),
      db.collectionGroup("messages").where("authorId", "==", userId).get(),
      db.collectionGroup("messages").where("legacyAuthorId", "==", userId).get(),
      db.collection("funnelComments").where("authorId", "==", userId).get(),
      // collectionGroup for subcollection orgs/{orgId}/documents/{docId} — 3 fields
      ...DOCUMENT_AUTHOR_FIELDS.map((field) =>
        db.collectionGroup("documents").where(field, "==", userId).get(),
      ),
    ]);

    const toEntries = (
      snap: FirebaseFirestore.QuerySnapshot,
    ): Array<{ path: string; data: Record<string, unknown> }> =>
      snap.docs.map((d) => ({ path: d.ref.path, data: (d.data() ?? {}) as Record<string, unknown> }));

    // De-dupe messages and comments by path across authorId + legacyAuthorId queries (M-02).
    const mergeEntries = (
      ...snaps: FirebaseFirestore.QuerySnapshot[]
    ): Array<{ path: string; data: Record<string, unknown> }> => {
      const byPath = new Map<string, { path: string; data: Record<string, unknown> }>();
      for (const s of snaps) {
        for (const e of toEntries(s)) {
          if (!byPath.has(e.path)) byPath.set(e.path, e);
        }
      }
      return [...byPath.values()];
    };

    // Merge subcollection document results (assembleUserBundle de-dupes by path)
    const documents = documentsSnaps.flatMap(toEntries);

    // Also query the LEGACY top-level `documents/` collection (pre-Phase-5 main.js writes
    // used `documents/{docId}` with uploaderId, not the subcollection).
    const legacyDocsSnaps = await Promise.all(
      DOCUMENT_AUTHOR_FIELDS.map((field) =>
        db.collection("documents").where(field, "==", userId).get(),
      ),
    );
    documents.push(...legacyDocsSnaps.flatMap(toEntries));

    const queryResults: QueryResults = {
      profile: profileSnap.exists ? ((profileSnap.data() ?? null) as Record<string, unknown> | null) : null,
      auditEvents: auditSnap.docs.map((d) => (d.data() ?? {}) as Record<string, unknown>),
      responses: toEntries(responsesSnap),
      comments: mergeEntries(commentsSnap, commentsLegacySnap),
      messages: mergeEntries(messagesSnap, messagesLegacySnap),
      actions: toEntries(actionsSnap),
      documents,
      funnelComments: toEntries(funnelCommentsSnap),
    };

    // ── Assemble canonical bundle (pure helper — Pattern C) ──────────────────
    const bundle = assembleUserBundle(userId, queryResults, now);

    // ── Upload bundle to GCS ─────────────────────────────────────────────────
    const ts = now;
    const path = `gdpr-exports/${userId}/${ts}/export.json`;
    const file = getStorage().bucket(EXPORT_BUCKET).file(path);
    await file.save(JSON.stringify(bundle, null, 2), {
      contentType: "application/json",
    });

    // ── Issue V4 signed URL (24h TTL — T-08-04-02) ───────────────────────────
    const expiresAt = now + SIGNED_URL_TTL_MS;
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: expiresAt,
    });

    // ── Audit row — mandatory per GDPR Art. 15 + Art. 30 (T-08-04-05) ────────
    // NOTE: url is intentionally NOT recorded in the audit payload (T-08-04-01).
    // Only the gs:// path and expiry time are recorded so the audit log does not
    // itself become a PII-bearing URL-leakage vector.
    const eventId = randomUUID();
    await writeAuditEvent(
      {
        type: "compliance.export.user",
        severity: "warning",
        target: { type: "user", id: userId, orgId: null },
        clientReqId: data.clientReqId,
        payload: {
          bundleSchemaVersion: bundle.bundleSchemaVersion,
          bundlePath: `gs://${EXPORT_BUCKET}/${path}`, // gs:// URI only, not signed URL
          urlExpiresAt: expiresAt,
          counts: {
            auditEvents: bundle.auditEvents.length,
            responses: bundle.responses.length,
            comments: bundle.comments.length,
            messages: bundle.messages.length,
            actions: bundle.actions.length,
            documents: bundle.documents.length,
            funnelComments: bundle.funnelComments.length,
          },
        },
      },
      {
        now,
        eventId,
        // T-08-04-03 + Pitfall 17: actor sourced from request.auth.token, not payload
        actor: {
          uid: request.auth.uid,
          email: typeof token.email === "string" ? token.email : null,
          role: "admin",
          orgId: typeof token.orgId === "string" ? token.orgId : null,
        },
        ip: null,
        userAgent: null,
        idempotencyKey: `compliance.export.user:${request.auth.uid}:${userId}:${data.clientReqId}`,
      },
    );

    logger.info("compliance.gdprExportUser", {
      actorUid: request.auth.uid,
      targetUserId: userId,
      bundlePath: path,
      // NOTE: url intentionally omitted from logs (T-08-04-01)
    });

    return { url, expiresAt };
  }),
);
