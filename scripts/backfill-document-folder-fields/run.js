#!/usr/bin/env node
// scripts/backfill-document-folder-fields/run.js
// @ts-check
//
// Milestone v6 (FILE-02 / FILE-05): one-shot Admin-SDK script that adds
// `folderId: null` and `deletedAt: null` to existing document metadata rows
// that predate the folder tree.
//
// WHY THIS IS NOT OPTIONAL.
//
// The v6 documents listener queries with `where("deletedAt", "==", null)`, so
// that tombstoned files are excluded by the query rather than relying on
// per-document rule evaluation to hide them.
//
// A Firestore equality filter on null matches documents whose field IS null. It
// does NOT match documents that lack the field entirely. The pre-v6 upload path
// never wrote `deletedAt` at all, so without this backfill every document
// uploaded before v6 would silently disappear from the list: no error, no empty
// state, just a shorter list than the client remembers. That is the worst shape
// a data bug can take.
//
// `folderId: null` is cosmetic by comparison — src/domain/folder-tree.js treats
// a missing folderId as root — but it is written here anyway so every row has
// the same shape and nothing downstream has to special-case an absent field.
//
// CRITICAL: this script bypasses Firestore Security Rules (Admin SDK).
// MUST NOT be imported into src/ (Pitfall 4). Lives in scripts/ entirely
// separate from the Vite bundled app.
//
// ADC: operator runs `gcloud auth application-default login` first
// (D-20 / Pitfall 13 — no service-account JSON in source).
//
// Usage:
//   node scripts/backfill-document-folder-fields/run.js [--dry-run]

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { argv, exit } from "node:process";

const PROJECT_ID = "bedeveloped-base-layers";
const DRY_RUN = argv.includes("--dry-run");
const BATCH_LIMIT = 400; // Firestore caps a write batch at 500

const app = initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID,
});
const db = getFirestore(app);

if (DRY_RUN) console.log("[MODE] DRY-RUN -- no Firestore writes will occur");

async function backfill() {
  // Collection group: documents live under orgs/{orgId}/documents, and this
  // runs across every org in one pass.
  const snap = await db.collectionGroup("documents").get();
  let patched = 0;
  let skipped = 0;
  /** @type {FirebaseFirestore.WriteBatch|null} */
  let batch = null;
  let inBatch = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    /** @type {Record<string, null>} */
    const patch = {};
    if (!("deletedAt" in data)) patch.deletedAt = null;
    if (!("folderId" in data)) patch.folderId = null;

    if (!Object.keys(patch).length) {
      skipped++;
      continue;
    }

    console.log(
      `${DRY_RUN ? "[would patch]" : "[patch]"} ${docSnap.ref.path} ${JSON.stringify(patch)}`,
    );
    patched++;
    if (DRY_RUN) continue;

    batch = batch || db.batch();
    batch.update(docSnap.ref, patch);
    inBatch++;
    if (inBatch >= BATCH_LIMIT) {
      await batch.commit();
      batch = null;
      inBatch = 0;
    }
  }

  if (batch && inBatch) await batch.commit();
  console.log(`\nDone. ${patched} patched, ${skipped} already had both fields.`);
}

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  exit(1);
});
