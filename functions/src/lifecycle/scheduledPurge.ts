// Phase 8 Wave 2 (LIFE-05 / Pitfall B): daily scheduled purge of soft-deleted
// docs past the 30-day retention window. Pagination is mandatory — single
// getDocs() over a large softDeleted collection exceeds the 9min Function
// timeout (Pitfall B). Per-type loop with 500-doc batched startAfter pages.
//
// T-08-03-04: pagination via 500-doc limit + startAfter loop; per-type
// isolation prevents one type starving another; timeoutSeconds:540 headroom.

import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { SOFT_DELETABLE_TYPES } from "./resolveDocRef.js";

if (!getApps().length) initializeApp();

const RETENTION_DAYS = 30;
const PAGE_SIZE = 500;

export const scheduledPurge = onSchedule(
  {
    schedule: "0 3 * * *", // 03:00 UTC daily — 1h after the 02:00 export
    timeZone: "UTC",
    region: "europe-west2",
    timeoutSeconds: 540,
    memory: "512MiB",
    retryCount: 1,
    serviceAccount: "lifecycle-sa",
  },
  async (_event) => {
    const db = getFirestore();
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const purgedByType: Record<string, number> = {};

    for (const type of SOFT_DELETABLE_TYPES) {
      let count = 0;
      let lastDoc: QueryDocumentSnapshot | undefined = undefined;
      while (true) {
        let q = db
          .collection(`softDeleted/${type}/items`)
          .where("deletedAt", "<", cutoff)
          .orderBy("deletedAt")
          .limit(PAGE_SIZE);
        if (lastDoc) q = q.startAfter(lastDoc);
        const snap = await q.get();
        if (snap.empty) break;
        const batch = db.batch();
        for (const d of snap.docs) batch.delete(d.ref);
        await batch.commit();
        count += snap.docs.length;
        lastDoc = snap.docs[snap.docs.length - 1] as QueryDocumentSnapshot;
        if (snap.docs.length < PAGE_SIZE) break;
      }
      purgedByType[type] = count;
    }

    logger.info("lifecycle.purge.completed", {
      purgedByType,
      cutoff: cutoff.toISOString(),
    });
  },
);
