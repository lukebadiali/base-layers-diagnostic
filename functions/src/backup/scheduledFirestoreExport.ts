// Phase 8 Wave 1 (BACKUP-01 / FN-01 / Pitfall 10): scheduledFirestoreExport —
// daily Firestore export to gs://bedeveloped-base-layers-backups/firestore/{YYYY-MM-DD}/.
// Pattern from 08-RESEARCH.md §Pattern 1 + Firebase docs verbatim adaptation.
//
// Substrate dependencies (Wave 1 08-01): backups bucket + lifecycle + backup-sa
// SA + role bindings MUST be live before deploy or first invocation hits
// Pitfall F (bucket-not-found). Operator runbook: runbooks/phase-8-backup-setup.md.
//
// Schedule: 02:00 UTC daily (cron "0 2 * * *"). Timeout 540s (Gen2 max — exports
// can be slow). Retry 2x via Cloud Scheduler. SA: backup-sa with
// roles/datastore.importExportAdmin (project) + roles/storage.objectAdmin (bucket).
//
// The output URI uses the gs:// URI prefix; FirestoreAdminClient handles the
// protocol. collectionIds: [] means "all collections" per Firestore Admin API.

import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/logger";
import { v1 as firestoreAdminV1 } from "@google-cloud/firestore";

const BACKUP_BUCKET = "bedeveloped-base-layers-backups"; // bare name, NOT "gs://" — gcloud-style URI is built per call

export const scheduledFirestoreExport = onSchedule(
  {
    schedule: "0 2 * * *",
    timeZone: "UTC",
    region: "europe-west2",
    timeoutSeconds: 540,
    memory: "256MiB",
    retryCount: 2,
    serviceAccount: "backup-sa",
  },
  async (_event) => {
    const projectId = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT;
    if (!projectId) {
      throw new Error("GCLOUD_PROJECT not set");
    }
    const client = new firestoreAdminV1.FirestoreAdminClient();
    const databaseName = client.databasePath(projectId, "(default)");
    const date = new Date().toISOString().slice(0, 10);
    const outputUriPrefix = `gs://${BACKUP_BUCKET}/firestore/${date}`;

    try {
      const [operation] = await client.exportDocuments({
        name: databaseName,
        outputUriPrefix,
        collectionIds: [],
      });
      logger.info("backup.export.started", {
        operationName: operation.name,
        outputUriPrefix,
      });
    } catch (err) {
      logger.error("backup.export.failed", {
        err: (err as Error).message ?? String(err),
        outputUriPrefix,
      });
      throw err;
    }
  },
);
