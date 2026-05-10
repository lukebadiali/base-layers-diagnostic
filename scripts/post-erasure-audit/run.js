#!/usr/bin/env node
// scripts/post-erasure-audit/run.js
// @ts-check
//
// Phase 8 Wave 4 (GDPR-03 / Pattern F / Pitfall 13):
// post-erasure audit script — verifies zero residual PII after gdprEraseUser.
//
// Runs the same multi-field collectionGroup queries used by gdprExportUser
// to prove no non-tombstoned reference to the erased userId remains in
// any denormalised collection. Exits 0 on PASS, 1 on FAIL with residual
// paths printed.
//
// CRITICAL: this script uses Application Default Credentials (ADC) and
// the Firestore Admin SDK. It MUST NOT be imported into src/ (Pitfall 4).
// Lives in scripts/ entirely separate from the Vite bundle.
//
// ADC: operator runs `gcloud auth application-default login` first.
// Pitfall 13 — no service-account JSON in source.
//
// Idempotent: read-only — no mutations performed.
//
// Usage:
//   gcloud auth application-default login
//   node scripts/post-erasure-audit/run.js --uid=<userId>
//   node scripts/post-erasure-audit/run.js --uid=<userId> --project=<projectId>
//   node scripts/post-erasure-audit/run.js --help
//
// Exit codes:
//   0 — all checks PASS (zero residual PII detected)
//   1 — one or more checks FAIL (residual PII paths printed to stderr)
//   2 — usage error (missing required --uid argument)
//
// Author-field constants (source of truth: 08-04-FIELD-AUDIT-NOTES.md):
//   DOCUMENT_AUTHOR_FIELDS = ["uploaderId", "uploadedBy", "legacyAppUserId"]
//   These match the same constant in functions/src/gdpr/assembleUserBundle.ts.
//
// isTombstoneToken logic mirrors functions/src/gdpr/pseudonymToken.ts:
//   prefix = "deleted-user-" (13 chars) + 16 hex chars = 29 total chars.
//
// Citations:
//   GDPR-03 — post-erasure verification requirement
//   Pattern F — ADC + Admin SDK script pattern
//   Pitfall 13 — ADC only; no JSON SA in repo

import { argv, exit } from "node:process";

// ─── Constants (mirrors assembleUserBundle.ts source of truth) ──────────────

const DEFAULT_PROJECT = "bedeveloped-base-layers";
const DOCUMENT_AUTHOR_FIELDS = ["uploaderId", "uploadedBy", "legacyAppUserId"];
const TOMBSTONE_PREFIX = "deleted-user-";
const TOMBSTONE_TOKEN_LENGTH = 29; // 13 prefix + 16 hex chars

/** Mirror of isTombstoneToken from functions/src/gdpr/pseudonymToken.ts */
function isTombstoneToken(value) {
  return (
    typeof value === "string" &&
    value.length === TOMBSTONE_TOKEN_LENGTH &&
    value.startsWith(TOMBSTONE_PREFIX)
  );
}

// ─── Arg parsing ─────────────────────────────────────────────────────────────

const HELP = `
usage: node scripts/post-erasure-audit/run.js --uid=<userId> [--project=<id>]

Verifies zero residual PII after gdprEraseUser has been invoked.
Runs read-only collectionGroup queries against production Firestore
using Application Default Credentials (ADC).

Options:
  --uid=<userId>       (required) Firebase Auth UID of the erased user
  --project=<id>       Override Firebase project (default: ${DEFAULT_PROJECT})
  --help, -h           Print this help text and exit 0

Prerequisites:
  gcloud auth application-default login

Exit codes:
  0 — all checks PASS (zero residual PII detected)
  1 — one or more checks FAIL (residual paths printed to stderr)
  2 — usage error
`.trim();

function parseArgs() {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    exit(0);
  }

  let uid = null;
  let project = DEFAULT_PROJECT;

  for (const arg of args) {
    if (arg.startsWith("--uid=")) {
      uid = arg.slice("--uid=".length).trim();
    } else if (arg.startsWith("--project=")) {
      project = arg.slice("--project=".length).trim();
    }
  }

  if (!uid) {
    console.error("ERROR: --uid=<userId> is required");
    console.error(HELP);
    exit(2);
  }

  return { uid, project };
}

// ─── Result table helpers ─────────────────────────────────────────────────────

const LINE = "─".repeat(56);

/** @param {string} check @param {"PASS"|"FAIL"} status @param {string} detail */
function printRow(check, status, detail) {
  const padded = check.padEnd(32);
  const sym = status === "PASS" ? "PASS" : "FAIL";
  console.log(`${padded}  ${sym}   ${detail}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { uid, project } = parseArgs();

  console.log(`\nUSER ERASURE AUDIT — uid=${uid}  project=${project}`);
  console.log(LINE);

  // Initialise Admin SDK with ADC (Pitfall 13 — no JSON service account)
  const { initializeApp, getApps } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const { getAuth } = await import("firebase-admin/auth");

  if (!getApps().length) {
    initializeApp({ projectId: project });
  }
  const db = getFirestore();
  const auth = getAuth();

  let allPass = true;
  const failures = [];

  // ── 1. users/{uid} doc ─────────────────────────────────────────────────────
  {
    const snap = await db.doc(`users/${uid}`).get();
    if (!snap.exists) {
      printRow(`users/${uid}`, "PASS", "doc not found (already deleted)");
    } else {
      const data = snap.data();
      const piiFields = ["email", "name", "displayName", "photoURL", "avatar"];
      const residual = piiFields.filter(
        (f) => data[f] !== null && data[f] !== undefined && !isTombstoneToken(data[f]),
      );
      const hasErasedAt = data.erasedAt !== null && data.erasedAt !== undefined;
      const hasErasedTo = isTombstoneToken(data.erasedTo);
      if (residual.length === 0 && hasErasedAt && hasErasedTo) {
        printRow(`users/${uid}`, "PASS", `email=null, name=null, erasedTo=${data.erasedTo}`);
      } else {
        const reason =
          residual.length > 0
            ? `residual PII fields: ${residual.join(", ")}`
            : !hasErasedAt
              ? "erasedAt not set"
              : "erasedTo is not a tombstone token";
        printRow(`users/${uid}`, "FAIL", reason);
        allPass = false;
        failures.push({ check: `users/${uid}`, reason });
      }
    }
  }

  // ── 2. auditLog where actor.uid == uid → should be tombstoned ───────────────
  {
    const snap = await db.collection("auditLog").where("actor.uid", "==", uid).get();
    if (snap.empty) {
      printRow("auditLog (about user)", "PASS", "0 docs (none reference raw uid)");
    } else {
      // All matching docs should have actor.uid as a tombstone (they match because
      // actor.uid still equals uid — this would mean erasure didn't tombstone them)
      const untombstoned = snap.docs.filter((d) => !isTombstoneToken(d.data()?.actor?.uid));
      if (untombstoned.length === 0) {
        // Edge: these docs matched uid — if actor.uid IS uid (not tombstoned) that's a fail.
        // But if we're here, the query matched uid exactly, meaning the token isn't in place.
        printRow("auditLog (about user)", "FAIL", `${snap.size} docs still reference raw uid`);
        allPass = false;
        failures.push({
          check: "auditLog (about user)",
          reason: `${snap.size} untombstoned audit docs`,
        });
      } else {
        printRow("auditLog (about user)", "FAIL", `${snap.size} docs still reference raw uid`);
        allPass = false;
        failures.push({
          check: "auditLog (about user)",
          reason: `${snap.size} untombstoned audit docs`,
        });
      }
    }
  }

  // ── 3. messages.authorId == uid (should be 0 after erasure) ─────────────────
  {
    const snap = await db.collectionGroup("messages").where("authorId", "==", uid).get();
    if (snap.empty) {
      printRow("messages.authorId == uid", "PASS", "0 hits");
    } else {
      printRow("messages.authorId == uid", "FAIL", `${snap.size} residual docs`);
      allPass = false;
      failures.push({ check: "messages.authorId", reason: snap.docs.map((d) => d.ref.path) });
    }
  }

  // ── 4. comments.authorId == uid ──────────────────────────────────────────────
  {
    const snap = await db.collectionGroup("comments").where("authorId", "==", uid).get();
    if (snap.empty) {
      printRow("comments.authorId == uid", "PASS", "0 hits");
    } else {
      printRow("comments.authorId == uid", "FAIL", `${snap.size} residual docs`);
      allPass = false;
      failures.push({ check: "comments.authorId", reason: snap.docs.map((d) => d.ref.path) });
    }
  }

  // ── 5. actions.ownerId == uid ────────────────────────────────────────────────
  {
    const snap = await db.collectionGroup("actions").where("ownerId", "==", uid).get();
    if (snap.empty) {
      printRow("actions.ownerId == uid", "PASS", "0 hits");
    } else {
      printRow("actions.ownerId == uid", "FAIL", `${snap.size} residual docs`);
      allPass = false;
      failures.push({ check: "actions.ownerId", reason: snap.docs.map((d) => d.ref.path) });
    }
  }

  // ── 6. documents: 3 author fields (subcollection + legacy) ──────────────────
  for (const field of DOCUMENT_AUTHOR_FIELDS) {
    // subcollection
    {
      const snap = await db.collectionGroup("documents").where(field, "==", uid).get();
      const label = `documents.${field} (subcoll)`;
      if (snap.empty) {
        printRow(label, "PASS", "0 hits");
      } else {
        printRow(label, "FAIL", `${snap.size} residual docs`);
        allPass = false;
        failures.push({ check: label, reason: snap.docs.map((d) => d.ref.path) });
      }
    }
    // legacy top-level
    {
      const snap = await db.collection("documents").where(field, "==", uid).get();
      const label = `documents.${field} (legacy)`;
      if (snap.empty) {
        printRow(label, "PASS", "0 hits");
      } else {
        printRow(label, "FAIL", `${snap.size} residual docs`);
        allPass = false;
        failures.push({ check: label, reason: snap.docs.map((d) => d.ref.path) });
      }
    }
  }

  // ── 7. funnelComments.authorId == uid ───────────────────────────────────────
  {
    const snap = await db.collection("funnelComments").where("authorId", "==", uid).get();
    if (snap.empty) {
      printRow("funnelComments.authorId", "PASS", "0 hits");
    } else {
      printRow("funnelComments.authorId", "FAIL", `${snap.size} residual docs`);
      allPass = false;
      failures.push({ check: "funnelComments.authorId", reason: snap.docs.map((d) => d.ref.path) });
    }
  }

  // ── 8. redactionList/{uid} — must exist with correct shape ──────────────────
  {
    const snap = await db.doc(`redactionList/${uid}`).get();
    if (snap.exists) {
      const data = snap.data();
      const hasToken = isTombstoneToken(data.tombstoneToken);
      const hasErasedAt = data.erasedAt !== null && data.erasedAt !== undefined;
      const hasErasedBy = typeof data.erasedBy === "string";
      if (hasToken && hasErasedAt && hasErasedBy) {
        printRow(`redactionList/${uid}`, "PASS", `exists, tombstoneToken=${data.tombstoneToken}`);
      } else {
        const reason = !hasToken
          ? "tombstoneToken is not a valid tombstone"
          : !hasErasedAt
            ? "erasedAt missing"
            : "erasedBy missing";
        printRow(`redactionList/${uid}`, "FAIL", reason);
        allPass = false;
        failures.push({ check: `redactionList/${uid}`, reason });
      }
    } else {
      printRow(
        `redactionList/${uid}`,
        "FAIL",
        "doc does not exist — gdprEraseUser may not have completed",
      );
      allPass = false;
      failures.push({ check: `redactionList/${uid}`, reason: "doc does not exist" });
    }
  }

  // ── 9. Auth user.disabled ────────────────────────────────────────────────────
  {
    try {
      const user = await auth.getUser(uid);
      if (user.disabled) {
        printRow("Auth user.disabled", "PASS", "true");
      } else {
        printRow("Auth user.disabled", "FAIL", "user exists but disabled=false");
        allPass = false;
        failures.push({ check: "Auth user.disabled", reason: "disabled=false" });
      }
    } catch (err) {
      const msg = /** @type {Error} */ (err).message ?? String(err);
      if (/not.*found|user.*not.*exist/i.test(msg)) {
        printRow("Auth user.disabled", "PASS", "user not found (acceptable)");
      } else {
        printRow("Auth user.disabled", "FAIL", msg);
        allPass = false;
        failures.push({ check: "Auth user.disabled", reason: msg });
      }
    }
  }

  // ─── Summary ─────────────────────────────────────────────────────────────────
  console.log(LINE);
  if (allPass) {
    console.log("RESULT: PASS (zero residual PII)\n");
    exit(0);
  } else {
    console.error(`RESULT: FAIL — ${failures.length} check(s) failed`);
    console.error("\nFailed checks:");
    for (const f of failures) {
      console.error(`  - ${f.check}: ${JSON.stringify(f.reason)}`);
    }
    console.error("\nRemediation: re-run gdprEraseUser with same userId.");
    console.error("The deterministic token guarantees idempotent re-cascade.\n");
    exit(1);
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  exit(1);
});
