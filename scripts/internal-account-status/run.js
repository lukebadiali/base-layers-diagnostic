#!/usr/bin/env node
// scripts/internal-account-status/run.js
// @ts-check
//
// 2026-10: READ-ONLY diagnostic. Answers "what state is this account actually
// in?" for one or more staff emails.
//
// Why this exists: the admin panel reads /users, Firebase Auth holds the
// sign-in record, and the GDPR cascade writes a third place (redactionList).
// Those can disagree. When they do, a person can be simultaneously invisible
// in the UI and un-recreatable ("an account with this email already exists")
// with nothing in the product explaining why. This script reads all four
// surfaces and prints the verdict plus the remedy.
//
// Reads ONLY. Makes no writes of any kind — safe to run against production at
// any time, including mid-incident.
//
// Shares its classification with the inviteInternal callable by importing the
// compiled classifier (functions/src/auth/account-state.ts), so the script and
// the server can never drift into disagreeing about what a state means.
//
// CRITICAL: Admin SDK — bypasses Firestore Security Rules. MUST NOT be
// imported into src/ (Pitfall 4).
//
// ADC: operator runs `gcloud auth application-default login` first
// (D-20 / Pitfall 13 — no service-account JSON in source).
//
// Usage (from the functions/ workspace, which pins firebase-admin):
//   cd functions && npm run build
//   cd functions && node ../scripts/internal-account-status/run.js <email> [<email> ...]
//   cd functions && node ../scripts/internal-account-status/run.js --all-staff

import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { argv, exit } from "node:process";
import { classifyExistingAccount } from "../../functions/lib/auth/account-state.js";

const PROJECT_ID = "bedeveloped-base-layers";
const HELP = argv.includes("--help") || argv.includes("-h");
const ALL_STAFF = argv.includes("--all-staff");
const emails = argv.slice(2).filter((a) => !a.startsWith("-"));

if (HELP || (!emails.length && !ALL_STAFF)) {
  console.log(
    "Usage: node ../scripts/internal-account-status/run.js <email> [<email> ...]\n" +
      "       node ../scripts/internal-account-status/run.js --all-staff\n\n" +
      "  <email>       one or more addresses to diagnose\n" +
      "  --all-staff   diagnose every email in internalAllowlist plus every\n" +
      "                admin/internal row in /users (finds orphans you'd\n" +
      "                otherwise have to already suspect)\n\n" +
      "Read-only. Requires `gcloud auth application-default login` and\n" +
      "`npm run build` in functions/ (the classifier is imported from lib/).",
  );
  exit(HELP ? 0 : 1);
}

const app = initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
const db = getFirestore(app);
const auth = getAuth(app);

/**
 * Remedy text per state — kept here (operator-facing) rather than in the
 * shared classifier, which stays UI-safe.
 * @type {Record<string, string>}
 */
const REMEDY = {
  healthy: "Nothing to do.",
  disabled:
    "Admin panel -> + Add internal member -> same email -> 'Reactivate this account'.\n" +
    "       Keeps the original uid, clears MFA, issues a fresh temporary password.",
  erased:
    "Admin panel -> + Add internal member -> same email -> 'Reactivate this account'.\n" +
    "       NOTE: restores sign-in only. Content pseudonymised by the erasure stays\n" +
    "       pseudonymised and deleted uploads stay deleted — both are irreversible.",
  orphaned:
    "Admin panel -> + Add internal member -> same email -> 'Reactivate this account'.\n" +
    "       Rebuilds the missing /users profile against the existing sign-in record.",
  client:
    "Not a staff account. Use the client invite flow, or change their role\n" +
    "       deliberately via setClaims rather than re-creating them.",
};

/** @param {string} email */
async function diagnose(email) {
  const key = String(email || "").toLowerCase();
  console.log("\n=== " + key + " ===");

  /** @type {*} */
  let rec = null;
  try {
    rec = await auth.getUserByEmail(key);
  } catch (err) {
    const code = /** @type {*} */ (err)?.code ?? "";
    if (code !== "auth/user-not-found") {
      console.log("  [ERROR] Auth lookup failed: " + code);
      return;
    }
  }

  const allowSnap = await db.doc("internalAllowlist/" + key).get();
  const allowline = allowSnap.exists
    ? "role=" +
      (allowSnap.data() ?? {}).role +
      " (survives deletion; re-claims on Console re-create)"
    : "MISSING (no break-glass entitlement — if the Auth record goes, so does the admin)";

  if (!rec) {
    console.log("  auth record        : NONE");
    console.log("  internalAllowlist  : " + allowline);
    console.log("\n  VERDICT: free. The email has no Auth record — a normal");
    console.log("           + Add internal member will create it cleanly.");
    return;
  }

  const [usersSnap, redactionSnap] = await Promise.all([
    db.doc("users/" + rec.uid).get(),
    db.doc("redactionList/" + rec.uid).get(),
  ]);
  const usersDoc = usersSnap.exists ? usersSnap.data() : null;

  const d = classifyExistingAccount({
    auth: { uid: rec.uid, disabled: rec.disabled, customClaims: rec.customClaims ?? null },
    usersDoc: usersDoc ?? null,
    hasRedactionRow: redactionSnap.exists,
  });

  const factors = (rec.multiFactor && rec.multiFactor.enrolledFactors) || [];
  console.log("  auth record        : uid=" + rec.uid);
  console.log("    disabled         : " + rec.disabled);
  console.log("    emailVerified    : " + rec.emailVerified);
  console.log("    customClaims     : " + JSON.stringify(rec.customClaims ?? null));
  console.log(
    "    MFA factors      : " +
      factors.length +
      (factors.length ? "" : "  <- cannot satisfy the mandatory-MFA gate"),
  );
  console.log("    created          : " + rec.metadata.creationTime);
  console.log("    last sign-in     : " + (rec.metadata.lastSignInTime || "never"));
  console.log("  users/" + rec.uid + " : " + (usersSnap.exists ? "present" : "MISSING"));
  if (usersDoc) {
    console.log("    role             : " + usersDoc.role);
    console.log(
      "    email / name     : " +
        JSON.stringify(usersDoc.email) +
        " / " +
        JSON.stringify(usersDoc.name),
    );
    if (usersDoc.erasedAt != null)
      console.log("    erasedAt         : " + usersDoc.erasedAt + "  <- GDPR tombstone");
  }
  console.log(
    "  redactionList      : " +
      (redactionSnap.exists ? "PRESENT — tombstone is replayed over restored backups" : "none"),
  );
  console.log("  internalAllowlist  : " + allowline);

  console.log(
    "\n  VERDICT: " +
      d.state.toUpperCase() +
      (d.reclaimable ? " (reclaimable)" : " (not reclaimable)"),
  );
  console.log("  " + d.summary.replace(/\s+/g, " "));
  console.log("  FIX: " + (REMEDY[d.state] ?? "n/a"));
}

/** @returns {Promise<string[]>} */
async function allStaffEmails() {
  const out = new Set();
  const allow = await db.collection("internalAllowlist").get();
  allow.forEach((doc) => out.add(doc.id.toLowerCase()));
  const users = await db.collection("users").where("role", "in", ["admin", "internal"]).get();
  users.forEach((doc) => {
    const e = (doc.data() ?? {}).email;
    if (typeof e === "string" && e) out.add(e.toLowerCase());
  });
  return [...out].sort();
}

const targets = ALL_STAFF ? await allStaffEmails() : emails.map((e) => e.toLowerCase());
if (ALL_STAFF) {
  console.log(
    "[MODE] --all-staff: " + targets.length + " address(es) from internalAllowlist + /users",
  );
  console.log("[NOTE] An erased account has a nulled email in /users, so it can only be");
  console.log("       found this way if it still has an internalAllowlist row. Pass the");
  console.log("       address explicitly if you know it.");
}
console.log("[MODE] READ-ONLY — this script performs no writes.");

for (const t of targets) await diagnose(t);
console.log("");
exit(0);
