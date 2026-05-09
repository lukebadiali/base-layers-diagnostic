#!/usr/bin/env node
// scripts/admin-mfa-unenroll/run.js
// @ts-check
//
// Phase 6 Wave 4 (BLOCKER-FIX 4 / D-08 / AUTH-10): one-shot Admin-SDK script.
// Clears all enrolled MFA factors for a single user. Used during the AUTH-10
// Tier-2 recovery drill (operator-side fallback when a user has lost access to
// their TOTP authenticator AND email-link Tier-1 recovery is not viable).
//
// Canonical path: admin.auth().updateUser(uid, {multiFactor: {enrolledFactors: []}}).
// Replaces the unverified `firebase auth:multifactor:unenroll` CLI subcommand
// (per BLOCKER-FIX 4 — that subcommand may not exist in the firebase-tools
// version pinned for this milestone; Admin SDK is the documented authoritative
// path).
//
// CRITICAL: this script bypasses Firestore Security Rules + Auth client gates
// (Admin SDK). Operators MUST verify identity OOB (voice/video call) before
// running. BEFORE/AFTER state is logged at execution time for the audit
// narrative (see runbooks/phase6-mfa-recovery-drill.md "Drill Evidence" blocks).
//
// ADC: operator runs `gcloud auth application-default login` first
// (D-20 / Pitfall 13 — no service-account JSON in source).
//
// Usage:
//   cd functions && node ../scripts/admin-mfa-unenroll/run.js --uid <uid> [--dry-run]
//
//   --uid <uid>   target user ID (required)
//   --dry-run     log BEFORE state + intent without mutating
//   --help / -h   print usage

import { initializeApp, applicationDefault, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { argv, exit } from "node:process";

const PROJECT_ID = "bedeveloped-base-layers";
const DRY_RUN = argv.includes("--dry-run");
const HELP = argv.includes("--help") || argv.includes("-h");
const uidIdx = argv.indexOf("--uid");
const uid = uidIdx >= 0 ? argv[uidIdx + 1] : null;

if (HELP) {
  console.log(
    "Usage: node ../scripts/admin-mfa-unenroll/run.js --uid <uid> [--dry-run]\n" +
      "  --uid <uid>   target user ID (required)\n" +
      "  --dry-run     log BEFORE state + intent without mutating\n",
  );
  exit(0);
}

if (!uid) {
  console.error("[FAIL] --uid <uid> is required");
  console.error(
    "Usage: cd functions && node ../scripts/admin-mfa-unenroll/run.js --uid <uid> [--dry-run]",
  );
  exit(1);
}

if (!getApps().length) {
  initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
}

if (DRY_RUN) console.log("[MODE] DRY-RUN -- no Auth mutations will occur");

async function main() {
  const before = await getAuth().getUser(uid);
  const factorsBefore =
    (before.multiFactor && before.multiFactor.enrolledFactors) || [];
  console.log(
    "[BEFORE] uid=" +
      uid +
      " enrolled_factors=" +
      factorsBefore.length,
  );
  for (const f of factorsBefore) {
    console.log(
      "  - factorId=" +
        f.uid +
        " factor=" +
        f.factorId +
        " displayName=" +
        (f.displayName || "(none)"),
    );
  }

  if (DRY_RUN) {
    console.log(
      '[DRY-RUN] would call admin.auth().updateUser("' +
        uid +
        '", {multiFactor: {enrolledFactors: []}})',
    );
    return;
  }

  await getAuth().updateUser(uid, { multiFactor: { enrolledFactors: [] } });

  const after = await getAuth().getUser(uid);
  const factorsAfter =
    (after.multiFactor && after.multiFactor.enrolledFactors) || [];
  if (factorsAfter.length !== 0) {
    console.error(
      "[FAIL] expected 0 enrolled factors after update, got " +
        factorsAfter.length,
    );
    exit(1);
  }
  console.log(
    "[OK] uid=" +
      uid +
      " mfa cleared (was " +
      factorsBefore.length +
      " factor(s); now 0)",
  );
}

main().catch((err) => {
  console.error("[FAIL]", err);
  exit(1);
});
