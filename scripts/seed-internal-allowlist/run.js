#!/usr/bin/env node
// scripts/seed-internal-allowlist/run.js
// @ts-check
//
// Phase 6 Wave 4 (D-05 / D-20 / Pitfall 13): one-shot Admin-SDK script.
// Seeds:
//   internalAllowlist/luke@bedeveloped.com   { role: "admin" }
//   internalAllowlist/george@bedeveloped.com { role: "admin" }
// before the operator Console-creates the corresponding Auth users (D-05).
//
// The beforeUserCreated blocking trigger reads internalAllowlist/{lowercaseEmail}
// at user creation and sets customClaims.role/orgId so the claim lands in the
// user's first ID token (Pitfall 6 mitigation #3 — no refresh dance for
// bootstrap admins).
//
// CRITICAL: this script bypasses Firestore Security Rules (Admin SDK). It
// MUST NOT be imported into src/ (Pitfall 4). Lives in scripts/ entirely
// separate from the Vite bundled app.
//
// ADC: operator runs `gcloud auth application-default login` first
// (D-20 / Pitfall 13 — no service-account JSON in source).
//
// Usage:
//   cd functions && node ../scripts/seed-internal-allowlist/run.js [--dry-run] [--verify]
//
//   --dry-run   logs intended writes without mutating Firestore (Pitfall 5)
//   --verify    after writes, re-reads each doc and confirms role matches

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { argv, exit } from "node:process";

const PROJECT_ID = "bedeveloped-base-layers";
const DRY_RUN = argv.includes("--dry-run");
const VERIFY = argv.includes("--verify");
const HELP = argv.includes("--help") || argv.includes("-h");

if (HELP) {
  console.log(
    "Usage: node ../scripts/seed-internal-allowlist/run.js [--dry-run] [--verify]\n" +
      "  --dry-run   no Firestore writes; logs intent only\n" +
      "  --verify    after writes, read each doc back and confirm role=admin",
  );
  exit(0);
}

const app = initializeApp({
  credential: applicationDefault(),
  projectId: PROJECT_ID,
});
const db = getFirestore(app);

if (DRY_RUN) console.log("[MODE] DRY-RUN -- no Firestore writes will occur");
if (VERIFY) console.log("[MODE] VERIFY -- read-back after writes");

// ARCHITECTURE.md §8: emails are stored as the doc ID, lowercased. The
// beforeUserCreated trigger reads internalAllowlist/{user.email.toLowerCase()}.
const ALLOWLIST = [
  { email: "luke@bedeveloped.com", role: "admin" },
  { email: "george@bedeveloped.com", role: "admin" },
];

async function main() {
  console.log(
    "\n=== Phase 6 internal allowlist seed (project=" + PROJECT_ID + ") ===",
  );

  for (const { email, role } of ALLOWLIST) {
    const docId = email.toLowerCase(); // ARCHITECTURE.md §8 — emails lowercased
    if (DRY_RUN) {
      console.log(
        "[DRY-RUN] would write internalAllowlist/" +
          docId +
          ' = { role: "' +
          role +
          '", addedBy: "phase-6-bootstrap" }',
      );
      continue;
    }
    await db.doc("internalAllowlist/" + docId).set(
      {
        role,
        addedBy: "phase-6-bootstrap",
        addedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    console.log(
      "[OK] internalAllowlist/" + docId + " seeded with role=" + role,
    );
  }

  if (VERIFY) {
    console.log("\n=== VERIFY: reading back ===");
    let allOk = true;
    for (const { email, role } of ALLOWLIST) {
      const docId = email.toLowerCase();
      const snap = await db.doc("internalAllowlist/" + docId).get();
      if (!snap.exists) {
        console.error(
          "[FAIL] internalAllowlist/" + docId + " does not exist after write",
        );
        allOk = false;
        continue;
      }
      const data = snap.data();
      if (!data || data.role !== role) {
        console.error(
          "[FAIL] internalAllowlist/" +
            docId +
            " role mismatch: expected=" +
            role +
            " got=" +
            (data && data.role),
        );
        allOk = false;
        continue;
      }
      console.log(
        "[OK] internalAllowlist/" + docId + " verified role=" + role,
      );
    }
    if (!allOk) exit(1);
  }

  if (DRY_RUN) {
    console.log(
      "\n[OK] Dry-run complete; no writes performed; rerun without --dry-run to execute.",
    );
  } else {
    console.log("\n[OK] Seed complete.");
  }
}

main().catch((err) => {
  console.error("[FAIL]", err);
  exit(1);
});
