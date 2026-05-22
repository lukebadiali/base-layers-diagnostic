#!/usr/bin/env node
// scripts/strip-legacy-user-passwords/run.js
// @ts-check
//
// Phase 06.1 Wave 3 (AUTH-18 / D-17 / Pitfall 13): one-shot Admin-SDK script.
// Strips the legacy `passwordHash` field from every `users/{uid}` document
// that still carries it. Per HANDOFF.md (2026-05-22), no live client users
// exist on production — the expected stripped count is 0. This is a
// defensive substrate run: any non-zero count would mean Phase 6 / Phase 7
// landed a path that wrote `passwordHash` despite the Wave 3 cutover commit
// retiring `setUserPassword`.
//
// CRITICAL: this script bypasses Firestore Security Rules (Admin SDK). It
// MUST NOT be imported into src/ (Pitfall 4). Lives in scripts/ entirely
// separate from the Vite bundled app.
//
// ADC: operator runs `gcloud auth application-default login` first
// (D-20 / Pitfall 13 — no service-account JSON in source). The operator's
// gcloud account must hold the `Cloud Datastore User` role on
// `bedeveloped-base-layers`.
//
// Usage:
//   cd functions && node ../scripts/strip-legacy-user-passwords/run.js [--dry-run] [--verify]
//
//   --dry-run   logs intended strips without mutating Firestore (Pitfall 5)
//   --verify    after strips, re-reads each doc and confirms passwordHash absent
//
// Closes Phase 6 HANDOFF.md follow-up #9 (the residual `passwordHash`
// field that survived Phase 6 D-04 + AUTH-14 partial deletion).

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { argv, exit } from "node:process";

const PROJECT_ID = "bedeveloped-base-layers";
const DRY_RUN = argv.includes("--dry-run");
const VERIFY = argv.includes("--verify");
const HELP = argv.includes("--help") || argv.includes("-h");

if (HELP) {
  console.log(
    "Usage: node ../scripts/strip-legacy-user-passwords/run.js [--dry-run] [--verify]\n" +
      "  --dry-run   no Firestore writes; logs intent only\n" +
      "  --verify    after strips, read each previously-stripped doc back and confirm passwordHash absent\n" +
      "\n" +
      "Expected outcome: `Scan complete. 0 doc(s) stripped (expected 0 per HANDOFF.md — no live client users).`\n" +
      "Any non-zero count is a defensive-substrate finding — review the surfaced uids.\n",
  );
  exit(0);
}

const app = initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID,
});
const db = getFirestore(app);

if (DRY_RUN) console.log("[MODE] DRY-RUN -- no Firestore writes will occur");
if (VERIFY) console.log("[MODE] VERIFY -- read-back after strips");

async function main() {
  console.log(
    "\n=== Phase 06.1 Wave 3 legacy passwordHash strip (project=" +
      PROJECT_ID +
      ") ===",
  );

  // RESEARCH § 9 verbatim strip loop.
  const snap = await db.collection("users").get();
  /** @type {string[]} */
  const strippedIds = [];
  let stripped = 0;
  for (const doc of snap.docs) {
    if (doc.get("passwordHash") !== undefined) {
      if (DRY_RUN) {
        console.log("[DRY-RUN] would strip users/" + doc.id + ".passwordHash");
      } else {
        await doc.ref.update({ passwordHash: FieldValue.delete() });
        console.log("[OK] stripped users/" + doc.id + ".passwordHash");
        strippedIds.push(doc.id);
      }
      stripped++;
    }
  }
  console.log(
    "\n[OK] Scan complete. " +
      stripped +
      " doc(s) stripped (expected 0 per HANDOFF.md — no live client users).",
  );

  if (VERIFY && !DRY_RUN) {
    console.log("\n=== VERIFY: reading back each stripped doc ===");
    let allOk = true;
    for (const id of strippedIds) {
      const snap2 = await db.doc("users/" + id).get();
      if (!snap2.exists) {
        console.error("[FAIL] users/" + id + " does not exist after strip");
        allOk = false;
        continue;
      }
      if (snap2.get("passwordHash") !== undefined) {
        console.error(
          "[FAIL] users/" + id + ".passwordHash still present after strip",
        );
        allOk = false;
        continue;
      }
      console.log("[VERIFY] users/" + id + ".passwordHash absent ✓");
    }
    if (!allOk) exit(1);
  }

  if (DRY_RUN) {
    console.log(
      "\n[OK] Dry-run complete; no writes performed; rerun without --dry-run to execute.",
    );
  } else if (stripped === 0) {
    console.log(
      "[OK] No legacy passwordHash fields found — Phase 6 + Phase 06.1 cutover narrative confirmed.",
    );
  } else {
    console.log(
      "[OK] Strip complete; " + stripped + " field(s) removed via FieldValue.delete().",
    );
  }
}

main().catch((err) => {
  console.error("[FAIL]", err);
  exit(1);
});
