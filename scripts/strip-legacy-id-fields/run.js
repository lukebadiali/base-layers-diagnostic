#!/usr/bin/env node
// scripts/strip-legacy-id-fields/run.js
// @ts-check
//
// Phase 6 Wave 6 (D-17 / closes Phase 5 D-21 carry-forward): one-shot Admin-SDK
// script that deletes the legacy fields `legacyAppUserId` and `legacyAuthorId`
// from existing migrated docs. Backfill happened during Wave 5's admin
// Console-create step (`beforeUserCreated` claims-set keys users by
// `firebaseUid`); this script just scrubs the now-unused legacy fields.
//
// CRITICAL: this script bypasses Firestore Security Rules (Admin SDK).
// MUST NOT be imported into src/ (Pitfall 4). Lives in scripts/ entirely
// separate from the Vite bundled app.
//
// ADC: operator runs `gcloud auth application-default login` first
// (D-20 / Pitfall 13 — no service-account JSON in source).
//
// Usage:
//   node scripts/strip-legacy-id-fields/run.js [--dry-run]

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { argv, exit } from "node:process";

const PROJECT_ID = "bedeveloped-base-layers";
const DRY_RUN = argv.includes("--dry-run");

const app = initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID,
});
const db = getFirestore(app);

if (DRY_RUN) console.log("[MODE] DRY-RUN -- no Firestore writes will occur");

// Phase 5 DATA-02 + DATA-07 retained legacyAppUserId on users docs and
// legacyAuthorId on per-doc records under orgs/{orgId}/{responses,comments,
// actions,messages}/. Phase 6's beforeUserCreated keys users by firebaseUid;
// the legacy fields are now unused.
const COLLECTION_GROUPS = ["responses", "comments", "actions", "messages"];

async function stripLegacyFromCollectionGroup(name) {
  const snap = await db.collectionGroup(name).get();
  let stripped = 0;
  let skipped = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const hasLegacyApp = "legacyAppUserId" in data;
    const hasLegacyAuthor = "legacyAuthorId" in data;
    if (!hasLegacyApp && !hasLegacyAuthor) {
      skipped++;
      continue;
    }
    if (DRY_RUN) {
      console.log(
        `[DRY-RUN] would strip from ${doc.ref.path}: legacyAppUserId=${hasLegacyApp}, legacyAuthorId=${hasLegacyAuthor}`,
      );
      stripped++;
      continue;
    }
    const update = {};
    if (hasLegacyApp) update.legacyAppUserId = FieldValue.delete();
    if (hasLegacyAuthor) update.legacyAuthorId = FieldValue.delete();
    await doc.ref.update(update);
    stripped++;
  }
  console.log(`[STEP ${name}] docs=${snap.size} stripped=${stripped} skipped=${skipped}`);
  return { stripped, skipped, total: snap.size };
}

async function stripLegacyAppUserIdFromUsers() {
  const snap = await db.collection("users").get();
  let stripped = 0;
  let skipped = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (!("legacyAppUserId" in data)) {
      skipped++;
      continue;
    }
    if (DRY_RUN) {
      console.log(`[DRY-RUN] would strip from users/${doc.id}: legacyAppUserId`);
      stripped++;
      continue;
    }
    await doc.ref.update({ legacyAppUserId: FieldValue.delete() });
    stripped++;
  }
  console.log(`[STEP users] docs=${snap.size} stripped=${stripped} skipped=${skipped}`);
  return { stripped, skipped, total: snap.size };
}

async function main() {
  console.log("=== Phase 6 D-17: stripping legacy ID fields ===");
  const totals = { stripped: 0, skipped: 0, total: 0 };
  for (const cg of COLLECTION_GROUPS) {
    const r = await stripLegacyFromCollectionGroup(cg);
    totals.stripped += r.stripped;
    totals.skipped += r.skipped;
    totals.total += r.total;
  }
  const r = await stripLegacyAppUserIdFromUsers();
  totals.stripped += r.stripped;
  totals.skipped += r.skipped;
  totals.total += r.total;
  console.log(
    `\n=== TOTAL: docs=${totals.total} stripped=${totals.stripped} skipped=${totals.skipped} ===`,
  );
  if (DRY_RUN) {
    console.log("[MODE] DRY-RUN -- no writes occurred. Re-run without --dry-run to apply.");
  }
}

main().catch((err) => {
  console.error("[FAIL]", err);
  exit(1);
});
