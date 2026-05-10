// Phase 7 Wave 2 (FN-01 / AUDIT-04): Firestore-trigger mirror writer for
// orgs/{orgId} deletes. Defence-in-depth: even if the client crashed between
// `data.org.softDelete` and the auditWrite callable, an audit row will exist
// for the org-deletion event because this trigger fires from Eventarc on the
// Firestore mutation itself.
//
// 60-second primary-event dedup window (Pattern 4b + Pitfall 7): if a primary
// `data.org.softDelete` audit row already exists for the same target.id
// within 60s, this trigger SKIPS the mirror write and logs
// `audit.mirror.skipped`. Cloud Logging captures the trigger invocation
// regardless (Wave 5 BigQuery sink is the infrastructure-tier backstop —
// T-07-02-06 accept).
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

export const onOrgDelete = onDocumentDeleted(
  {
    document: "orgs/{orgId}",
    region: "europe-west2",
    serviceAccount: "audit-mirror-sa",
  },
  async (event) => {
    const orgId = event.params.orgId;
    const before = (event.data?.data() ?? null) as Record<string, unknown> | null;

    // 60s primary-event dedup query (Pattern 4b + Pitfall 7).
    const recent = await getFirestore()
      .collection("auditLog")
      .where("type", "==", "data.org.softDelete")
      .where("target.id", "==", orgId)
      .where("at", ">", new Date(Date.now() - 60_000))
      .limit(1)
      .get();
    if (!recent.empty) {
      logger.info("audit.mirror.skipped", {
        orgId,
        reason: "primary-exists",
      });
      return;
    }

    const eventId = randomUUID();
    await writeAuditEvent(
      {
        type: "data.org.delete.mirror",
        severity: "warning",
        target: {
          type: "org",
          id: orgId,
          orgId,
          snapshot: before ?? undefined,
        },
        // Synthesised — mirror events have no client request to attribute to.
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
        idempotencyKey: `mirror:org:${orgId}:${eventId}`,
      },
    );
    logger.warn("audit.mirror.fired", { orgId, type: "org" });
  },
);
