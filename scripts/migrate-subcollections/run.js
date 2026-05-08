#!/usr/bin/env node
// scripts/migrate-subcollections/run.js
// @ts-check
//
// Phase 5 Wave 2 (D-01 / D-02 / D-03 / D-06): one-shot Admin-SDK migration script.
// Run by an internal operator with the production database export (D-04) taken
// immediately before. Live invocation in Wave 5; this wave authors the body +
// dry-run path + per-doc idempotency markers + pre/post assertions.
//
// CRITICAL: this script bypasses Firestore Security Rules (Admin SDK).
// It MUST NOT be imported into src/ (Pitfall 4 closure) — lives in scripts/
// entirely separate from the Vite bundled app.
//
// Usage:
//   node scripts/migrate-subcollections/run.js [--dry-run] [--verify]
//
//   --dry-run   walks every source doc, computes target shapes, logs intent;
//               no markers + no Firestore writes (D-06 / Pitfall 5)
//   --verify    skips migration; runs the post-assertion harness only
//
// Pre-flight (operator runbook — Wave 5):
//   1. gcloud auth application-default login   (D-04 ADC credentials)
//   2. gcloud firestore export gs://...        (D-04 rollback substrate)
//   3. node scripts/migrate-subcollections/run.js --dry-run   (audit log)
//   4. node scripts/migrate-subcollections/run.js             (real run)
//   5. node scripts/migrate-subcollections/run.js --verify    (post-check)

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { argv } from "node:process";
import {
  buildResponses,
  buildComments,
  buildActions,
  buildDocuments,
  buildMessages,
  buildReadStatesInit,
} from "./builders.js";
import {
  captureBaselineCounts,
  assertCollectionGroupCount,
  assertFieldPresence,
  summarise,
} from "./assertions.js";
import { processDoc } from "./process-doc.js";

const PROJECT_ID = "bedeveloped-base-layers";
const DRY_RUN = argv.includes("--dry-run");
const VERIFY_ONLY = argv.includes("--verify");

const app = initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID,
});
const db = getFirestore(app);

if (DRY_RUN) console.log("[MODE] DRY-RUN -- no Firestore writes will occur");
if (VERIFY_ONLY) console.log("[MODE] VERIFY-ONLY -- pre/post assertions only");

// Migration step ordering per D-08 / Pitfall 10 (deepest leaves first, then
// flat-maps, then the readStates init last). Step ids are stable + namespaced
// so re-runs match markers across runs (migrations/{stepId}/items/{docId}).
const STEPS = [
  { stepId: "responses-v1", builder: buildResponses, label: "responses" },
  { stepId: "comments-v1", builder: buildComments, label: "comments" },
  { stepId: "actions-v1", builder: buildActions, label: "actions" },
  { stepId: "documents-v1", builder: buildDocuments, label: "documents" },
  { stepId: "messages-v1", builder: buildMessages, label: "messages" },
  { stepId: "readStates-init", builder: buildReadStatesInit, label: "readStates" },
];

async function main() {
  console.log(`\n=== Phase 5 subcollection migration (project=${PROJECT_ID}) ===`);

  const preCounts = await captureBaselineCounts(db);
  console.log("[PRE]\n" + summarise(preCounts));

  if (VERIFY_ONLY) {
    // Verify-only mode: skip migration; run post-assertion harness against
    // the current Firestore state. Used as a post-cutover health check.
    await assertFieldPresence(db);
    console.log("\n[OK] Verify-only mode complete; field-presence assertions passed.");
    return;
  }

  // PER-STEP loop. Each step iterates every org doc and processes against
  // the step's builder. processDoc handles idempotency + dry-run + batching.
  for (const step of STEPS) {
    console.log(`\n=== STEP ${step.stepId} (${step.label}) ===`);
    const orgsSnap = await db.collection("orgs").get();
    let written = 0;
    let skipped = 0;
    let dryRunWouldWrite = 0;
    for (const orgDoc of orgsSnap.docs) {
      const result = await processDoc(
        { db, FieldValue, dryRun: DRY_RUN },
        step.stepId,
        step.builder,
        orgDoc,
      );
      if (result.skipped) skipped++;
      if (result.dryRun) dryRunWouldWrite += result.wouldWrite || 0;
      if (result.written) written += result.written;
    }
    console.log(
      `[STEP ${step.stepId}] orgs=${orgsSnap.size} skipped=${skipped} written=${written} dryRunWouldWrite=${dryRunWouldWrite}`,
    );
  }

  // POST-MIGRATION assertions (skipped under --dry-run since no writes
  // happened, so post counts would equal pre counts trivially).
  if (!DRY_RUN) {
    const postCounts = await captureBaselineCounts(db);
    console.log("\n[POST]\n" + summarise(postCounts));
    assertCollectionGroupCount(preCounts, postCounts);
    await assertFieldPresence(db);
    console.log("\n[OK] Migration complete; pre/post assertions passed.");
  } else {
    console.log(
      "\n[OK] Dry-run complete; no writes performed; rerun without --dry-run to execute.",
    );
  }
}

main().catch((err) => {
  console.error("[FAIL]", err);
  process.exitCode = 1;
});
