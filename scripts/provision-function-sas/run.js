#!/usr/bin/env node
// scripts/provision-function-sas/run.js
// @ts-check
//
// Phase 7 Wave 1 (FN-04 / Pitfall 13 / Pattern E): one-shot Admin-SDK ADC
// script. Provisions the 6 minimal-IAM service accounts each Cloud Function
// runs under, per 07-RESEARCH.md Pattern 7 SA inventory:
//
//   audit-writer-sa     → roles/datastore.user
//   audit-mirror-sa     → roles/datastore.user, roles/eventarc.eventReceiver
//   claims-admin-sa     → roles/firebaseauth.admin, roles/datastore.user
//   auth-blocking-sa    → roles/firebaseauth.viewer, roles/datastore.viewer
//   ratelimit-sa        → roles/datastore.user
//   csp-sink-sa         → roles/logging.logWriter
//
// Idempotent: on every run the script
//   1. ensures each SA exists (creates if missing);
//   2. diffs the project-level IAM bindings against the target role set;
//   3. adds missing role bindings (`gcloud projects add-iam-policy-binding`);
//   4. removes extra role bindings (drift correction);
//   5. prints a summary table at exit;
//   6. exits 0 on success, 1 on any binding error.
//
// CRITICAL: this script bypasses Firestore Security Rules at runtime — it
// runs Admin-CLI gcloud commands. It MUST NOT be imported into src/
// (Pitfall 4). Lives in scripts/ entirely separate from the Vite bundle.
//
// ADC: operator runs `gcloud auth application-default login` first
// (Pitfall 13 — no service-account JSON in source). The script does NOT
// read GOOGLE_APPLICATION_CREDENTIALS pointed at a JSON file.
//
// Usage:
//   node scripts/provision-function-sas/run.js [--project=<id>] [--dry-run]
//
//   --project=<id>   override default project (bedeveloped-base-layers)
//   --dry-run        compute diff and print the planned actions; no mutations
//   --help, -h       print this help text and exit 0

import { spawnSync } from "node:child_process";
import { argv, exit } from "node:process";

const DEFAULT_PROJECT = "bedeveloped-base-layers";

const HELP = argv.includes("--help") || argv.includes("-h");
if (HELP) {
  console.log(
    "Usage: node scripts/provision-function-sas/run.js [--project=<id>] [--dry-run]\n" +
      "  --project=<id>   override default project (default: " +
      DEFAULT_PROJECT +
      ")\n" +
      "  --dry-run        compute diff and print the planned actions; no mutations\n" +
      "  --help, -h       print this help text and exit 0",
  );
  exit(0);
}

const DRY_RUN = argv.includes("--dry-run");
const projectArg = argv.find((a) => a.startsWith("--project="));
const PROJECT_ID = projectArg ? projectArg.slice("--project=".length) : DEFAULT_PROJECT;

if (!PROJECT_ID) {
  console.error("[FAIL] --project=<id> required if not using the default");
  exit(1);
}

// Per Pattern 7 SA inventory.
const TARGET_SAS = [
  {
    accountId: "audit-writer-sa",
    displayName: "Audit Writer (auditWrite callable)",
    roles: ["roles/datastore.user"],
  },
  {
    accountId: "audit-mirror-sa",
    displayName: "Audit Mirror (Firestore-trigger writers)",
    roles: ["roles/datastore.user", "roles/eventarc.eventReceiver"],
  },
  {
    accountId: "claims-admin-sa",
    displayName: "Claims Admin (setClaims callable)",
    roles: ["roles/firebaseauth.admin", "roles/datastore.user"],
  },
  {
    accountId: "auth-blocking-sa",
    displayName: "Auth Blocking (beforeUserCreated/SignedIn handlers)",
    roles: ["roles/firebaseauth.viewer", "roles/datastore.viewer"],
  },
  {
    accountId: "ratelimit-sa",
    displayName: "Rate Limit (token-bucket fallback callable)",
    roles: ["roles/datastore.user"],
  },
  {
    accountId: "csp-sink-sa",
    displayName: "CSP Sink (cspReportSink HTTPS function)",
    roles: ["roles/logging.logWriter"],
  },
];

/**
 * @param {string[]} args
 * @returns {{ ok: boolean, stdout: string, stderr: string }}
 */
function gcloud(args) {
  const res = spawnSync("gcloud", args, { encoding: "utf8" });
  return {
    ok: res.status === 0,
    stdout: (res.stdout ?? "").trim(),
    stderr: (res.stderr ?? "").trim(),
  };
}

function saEmail(accountId) {
  return `${accountId}@${PROJECT_ID}.iam.gserviceaccount.com`;
}

/**
 * Check if the SA exists by email. Returns true on `gcloud iam service-accounts describe` success.
 */
function saExists(accountId) {
  const r = gcloud([
    "iam",
    "service-accounts",
    "describe",
    saEmail(accountId),
    `--project=${PROJECT_ID}`,
    "--format=value(email)",
  ]);
  return r.ok;
}

/**
 * Create the SA if missing. Idempotent.
 * @returns {"created"|"already-exists"|"error"}
 */
function ensureSa({ accountId, displayName }) {
  if (saExists(accountId)) return "already-exists";
  if (DRY_RUN) {
    console.log(`[DRY-RUN] would create SA ${saEmail(accountId)} (${displayName})`);
    return "created";
  }
  const r = gcloud([
    "iam",
    "service-accounts",
    "create",
    accountId,
    `--project=${PROJECT_ID}`,
    `--display-name=${displayName}`,
  ]);
  if (!r.ok) {
    console.error(`[FAIL] could not create ${saEmail(accountId)}: ${r.stderr}`);
    return "error";
  }
  return "created";
}

/**
 * Read the current project-level IAM bindings and return the set of roles
 * bound to a given SA email.
 * @param {string} email
 * @returns {Set<string>}
 */
function rolesBoundToMember(email) {
  // Use --flatten + --filter to get just the roles for this member.
  const r = gcloud([
    "projects",
    "get-iam-policy",
    PROJECT_ID,
    "--flatten=bindings[].members",
    `--filter=bindings.members:serviceAccount:${email}`,
    "--format=value(bindings.role)",
  ]);
  if (!r.ok) {
    console.error(`[WARN] could not read IAM policy for ${email}: ${r.stderr}`);
    return new Set();
  }
  return new Set(
    r.stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
}

/**
 * Add a single role binding for a member. Idempotent at the gcloud layer
 * (re-binding an existing role is a no-op).
 */
function addBinding(email, role) {
  if (DRY_RUN) {
    console.log(`[DRY-RUN] would add binding ${email} -> ${role}`);
    return true;
  }
  const r = gcloud([
    "projects",
    "add-iam-policy-binding",
    PROJECT_ID,
    `--member=serviceAccount:${email}`,
    `--role=${role}`,
    "--condition=None",
  ]);
  if (!r.ok) {
    console.error(`[FAIL] could not add ${role} -> ${email}: ${r.stderr}`);
    return false;
  }
  return true;
}

/**
 * Remove a single role binding for a member. Used for drift correction.
 */
function removeBinding(email, role) {
  if (DRY_RUN) {
    console.log(`[DRY-RUN] would remove binding ${email} -> ${role}`);
    return true;
  }
  const r = gcloud([
    "projects",
    "remove-iam-policy-binding",
    PROJECT_ID,
    `--member=serviceAccount:${email}`,
    `--role=${role}`,
  ]);
  if (!r.ok) {
    console.error(`[FAIL] could not remove ${role} from ${email}: ${r.stderr}`);
    return false;
  }
  return true;
}

function main() {
  console.log(
    `\n=== Phase 7 per-function SA provisioning (project=${PROJECT_ID}${DRY_RUN ? ", DRY-RUN" : ""}) ===\n`,
  );

  // Verify gcloud is on PATH and ADC is set; fail fast otherwise.
  const versionCheck = gcloud(["--version"]);
  if (!versionCheck.ok) {
    console.error(
      "[FAIL] gcloud CLI not found on PATH. Install Google Cloud SDK and run `gcloud auth application-default login` first.",
    );
    exit(1);
  }

  /** @type {Array<{ email: string, status: string, addedRoles: string[], removedRoles: string[] }>} */
  const summary = [];
  let anyFailed = false;

  for (const target of TARGET_SAS) {
    const email = saEmail(target.accountId);
    const status = ensureSa(target);
    if (status === "error") {
      anyFailed = true;
      summary.push({ email, status, addedRoles: [], removedRoles: [] });
      continue;
    }

    // Diff current bindings vs target roles.
    const currentRoles = DRY_RUN && status === "created"
      ? new Set() // Dry-run created the SA; assume no roles yet.
      : rolesBoundToMember(email);
    const targetRoles = new Set(target.roles);

    const toAdd = [...targetRoles].filter((r) => !currentRoles.has(r));
    const toRemove = [...currentRoles].filter((r) => !targetRoles.has(r));

    for (const role of toAdd) {
      if (!addBinding(email, role)) anyFailed = true;
    }
    for (const role of toRemove) {
      if (!removeBinding(email, role)) anyFailed = true;
    }

    summary.push({
      email,
      status,
      addedRoles: toAdd,
      removedRoles: toRemove,
    });
  }

  // Summary table.
  console.log("\n=== Summary ===");
  console.log(
    "service-account                                           | status         | added                                                                  | removed (drift)",
  );
  console.log(
    "----------------------------------------------------------|----------------|------------------------------------------------------------------------|----------------",
  );
  for (const row of summary) {
    const padEmail = row.email.padEnd(58);
    const padStatus = row.status.padEnd(14);
    const added = row.addedRoles.length === 0 ? "(none)" : row.addedRoles.join(", ");
    const padAdded = added.padEnd(70);
    const removed = row.removedRoles.length === 0 ? "(none)" : row.removedRoles.join(", ");
    console.log(`${padEmail} | ${padStatus} | ${padAdded} | ${removed}`);
  }
  console.log("");

  if (anyFailed) {
    console.error("[FAIL] one or more SA / IAM operations failed; see logs above");
    exit(1);
  }
  if (DRY_RUN) {
    console.log("[OK] Dry-run complete; no mutations performed.");
  } else {
    console.log("[OK] Provisioning complete.");
  }
}

main();
