// Phase 7 Wave 2 (FN-01 / AUDIT-04): Firestore-trigger mirror writer for
// orgs/{orgId}/documents/{docId} deletes. Defence-in-depth twin of the
// auditWrite callable for the `data.document.delete` event family.
// 60-second primary-event dedup window.
//
// Note on path: the canonical doc-store collection lives under the org
// subcollection per Phase 5 ARCHITECTURE.md §4. Storage-side deletions are a
// separate concern — Wave 5 GCS bucket-event hook (Phase 8) covers Storage.
//
// Runs as audit-mirror-sa (FN-04 / Wave 1 SA inventory) with
// roles/datastore.user + roles/eventarc.eventReceiver.

import { randomUUID } from "node:crypto";
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { writeAuditEvent } from "../auditLogger.js";

if (!getApps().length) initializeApp();

export const onDocumentDelete = onDocumentDeleted(
  {
    document: "orgs/{orgId}/documents/{docId}",
    region: "europe-west2",
    serviceAccount: "audit-mirror-sa",
  },
  async (event) => {
    const orgId = event.params.orgId;
    const docId = event.params.docId;
    const before = (event.data?.data() ?? null) as Record<string, unknown> | null;

    // 60s primary-event dedup query (Pattern 4b + Pitfall 7).
    const recent = await getFirestore()
      .collection("auditLog")
      .where("type", "==", "data.document.delete")
      .where("target.id", "==", docId)
      .where("at", ">", new Date(Date.now() - 60_000))
      .limit(1)
      .get();
    if (!recent.empty) {
      logger.info("audit.mirror.skipped", {
        orgId,
        docId,
        reason: "primary-exists",
      });
      return;
    }

    const eventId = randomUUID();
    await writeAuditEvent(
      {
        type: "data.document.delete.mirror",
        severity: "warning",
        target: {
          type: "document",
          id: docId,
          orgId,
          snapshot: before ?? undefined,
        },
        clientReqId: eventId,
        payload: {
          source: "trigger",
          reason: "no-primary-audit-found",
        },
      },
      {
        now: Date.now(),
        eventId,
        actor: {
          uid: "system",
          email: null,
          role: "system",
          orgId: null,
        },
        ip: null,
        userAgent: null,
        idempotencyKey: `mirror:document:${docId}:${eventId}`,
      },
    );
    logger.warn("audit.mirror.fired", { orgId, docId, type: "document" });
  },
);
