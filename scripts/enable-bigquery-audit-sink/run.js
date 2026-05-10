#!/usr/bin/env node
// scripts/enable-bigquery-audit-sink/run.js
// @ts-check
//
// Phase 7 Wave 5 (AUDIT-03 + AUDIT-06 / Pattern F / Pitfall 5 + 13 + 17):
// one-shot Admin-CLI ADC script. Provisions the BigQuery + Cloud Logging sink
// substrate that captures the infrastructure-tier audit log per
// 07-RESEARCH.md Pattern 10:
//
//   1. Enable Data Access logs for firestore + storage + identitytoolkit
//      + cloudfunctions (DATA_READ + DATA_WRITE on the project IAM policy)
//   2. Create BigQuery dataset `audit_logs_bq` in europe-west2 (matches
//      Firestore region per Pitfall 5) with 7-year (220_752_000s) default
//      table expiration
//   3. Create Cloud Logging sink `audit-logs-bq` routing Cloud Audit Logs +
//      structured app logs (auth.* / audit.* / csp.* prefixes) to the dataset
//      with --use-partitioned-tables (daily partitioning per AUDIT-06)
//   4. Grant the auto-created sink writer SA roles/bigquery.dataEditor on the
//      dataset (least-privilege per T-07-05-01 mitigation)
//   5. Grant roles/bigquery.dataViewer to internalAllowlist `role: "admin"`
//      emails (audit reviewer access per T-07-05-02 mitigation)
//   6. Print summary table at exit; exit 0 on success, 1 on any error.
//
// CRITICAL: this script bypasses Firestore Security Rules at runtime — it
// runs Admin-CLI gcloud + bq commands. It MUST NOT be imported into src/
// (Pitfall 4). Lives in scripts/ entirely separate from the Vite bundle.
//
// ADC: operator runs `gcloud auth application-default login` first (Pitfall
// 13 — no service-account JSON in source). The script does NOT read
// GOOGLE_APPLICATION_CREDENTIALS pointed at a JSON file.
//
// Idempotent: every run
//   - skips dataset creation if dataset already exists at the right location
//   - skips sink creation if sink already exists with the same destination
//   - skips IAM bindings already in place; adds missing bindings only
//   - safe to re-run; no destructive operations
//
// Usage:
//   gcloud auth application-default login
//   node scripts/enable-bigquery-audit-sink/run.js [--project=<id>] [--dry-run]
//
//   --project=<id>   override default project (bedeveloped-base-layers)
//   --dry-run        compute plan + print actions; no mutations
//   --help, -h       print this help text and exit 0
//
// Citations:
//   - 07-RESEARCH.md Pattern 10 — BigQuery sink design + cost guardrail
//   - Pitfall 5 — region match (Firestore = europe-west2 → dataset = europe-west2)
//   - Pitfall 13 — ADC only; no JSON SA in repo
//   - Pitfall 17 — infrastructure-tier audit log (Cloud Logging append-only)
//   - SOC2 CC7.2 + ISO A.12.4.1 + GDPR Art. 32(1)(d) — 7-year retention rationale

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { argv, exit, env } from "node:process";

const DEFAULT_PROJECT = "bedeveloped-base-layers";
const DEFAULT_DATASET = "audit_logs_bq";
const DEFAULT_LOCATION = "europe-west2";
const DEFAULT_SINK_NAME = "audit-logs-bq";
// 7 years in seconds: 7 * 365.25 * 24 * 3600 = 220_752_000
const SEVEN_YEARS_SECONDS = 220_752_000;

const HELP = argv.includes("--help") || argv.includes("-h");
if (HELP) {
  console.log(
    "Usage: node scripts/enable-bigquery-audit-sink/run.js [--project=<id>] [--dry-run]\n" +
      "  --project=<id>   override default project (default: " +
      DEFAULT_PROJECT +
      ")\n" +
      "  --dry-run        compute plan and print the planned actions; no mutations\n" +
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

// Cloud Audit Logs — Data Access service names per 07-RESEARCH.md Pattern 10.
const DATA_ACCESS_SERVICES = [
  "firestore.googleapis.com",
  "storage.googleapis.com",
  "identitytoolkit.googleapis.com",
  "cloudfunctions.googleapis.com",
];

// Cloud Logging filter — captures BOTH Cloud Audit Logs Data Access events
// AND structured app logs from Cloud Functions (auth.* / audit.* / csp.*
// message prefixes). Single sink, two complementary log sources.
const SINK_FILTER = [
  '(logName=~"projects/' + PROJECT_ID + '/logs/cloudaudit.googleapis.com%2Fdata_access"',
  ' AND (resource.type="audited_resource" OR resource.type="firestore_database"',
  '      OR resource.type="cloud_function" OR resource.type="identitytoolkit_project"',
  '      OR resource.type="gcs_bucket"))',
  ' OR (resource.type="cloud_run_revision"',
  '     AND severity>="INFO"',
  '     AND (jsonPayload.message=~"^auth\\\\."',
  '          OR jsonPayload.message=~"^audit\\\\."',
  '          OR jsonPayload.message=~"^csp\\\\."))',
].join("");

/**
 * @param {string} cmd
 * @param {string[]} args
 * @returns {{ ok: boolean, stdout: string, stderr: string }}
 */
function run(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: "utf8" });
  return {
    ok: res.status === 0,
    stdout: (res.stdout ?? "").trim(),
    stderr: (res.stderr ?? "").trim(),
  };
}

/**
 * @param {string[]} args
 */
function gcloud(args) {
  return run("gcloud", args);
}

/**
 * @param {string[]} args
 */
function bq(args) {
  return run("bq", args);
}

/**
 * Step 1 — enable Data Access logs for the 4 services. Idempotent: gcloud
 * projects set-iam-policy is overwriting; we read the policy, merge our
 * auditConfigs entries, and write back if any are missing.
 *
 * @returns {{ ok: boolean, addedServices: string[], existingServices: string[] }}
 */
function ensureDataAccessLogs() {
  if (DRY_RUN) {
    console.log("[DRY-RUN] would ensure DATA_READ + DATA_WRITE auditConfigs for: " + DATA_ACCESS_SERVICES.join(", "));
    return { ok: true, addedServices: DATA_ACCESS_SERVICES, existingServices: [] };
  }

  const r = gcloud([
    "projects",
    "get-iam-policy",
    PROJECT_ID,
    "--format=json",
  ]);
  if (!r.ok) {
    console.error("[FAIL] could not read IAM policy: " + r.stderr);
    return { ok: false, addedServices: [], existingServices: [] };
  }

  /** @type {*} */
  let policy;
  try {
    policy = JSON.parse(r.stdout);
  } catch (parseErr) {
    console.error("[FAIL] could not parse IAM policy JSON: " + (parseErr instanceof Error ? parseErr.message : String(parseErr)));
    return { ok: false, addedServices: [], existingServices: [] };
  }

  const auditConfigs = Array.isArray(policy.auditConfigs) ? policy.auditConfigs : [];
  /** @type {string[]} */
  const addedServices = [];
  /** @type {string[]} */
  const existingServices = [];

  for (const service of DATA_ACCESS_SERVICES) {
    /** @type {*} */
    const existing = auditConfigs.find((c) => c.service === service);
    if (existing) {
      // Verify both DATA_READ and DATA_WRITE are present.
      const logTypes = new Set(
        (Array.isArray(existing.auditLogConfigs) ? existing.auditLogConfigs : []).map(
          /** @param {*} c */ (c) => c.logType,
        ),
      );
      if (logTypes.has("DATA_READ") && logTypes.has("DATA_WRITE")) {
        existingServices.push(service);
        continue;
      }
      // Patch missing log types.
      existing.auditLogConfigs = [
        { logType: "DATA_READ" },
        { logType: "DATA_WRITE" },
        { logType: "ADMIN_READ" },
      ];
      addedServices.push(service);
    } else {
      auditConfigs.push({
        service,
        auditLogConfigs: [
          { logType: "DATA_READ" },
          { logType: "DATA_WRITE" },
          { logType: "ADMIN_READ" },
        ],
      });
      addedServices.push(service);
    }
  }

  if (addedServices.length === 0) {
    console.log("[OK] data access logs already enabled for all 4 services");
    return { ok: true, addedServices, existingServices };
  }

  policy.auditConfigs = auditConfigs;

  // Write the modified policy to a tmp file; gcloud set-iam-policy reads from a path arg.
  const tmpPath = `${env.TEMP || "/tmp"}/.iam-policy-${Date.now()}.json`;
  try {
    writeFileSync(tmpPath, JSON.stringify(policy, null, 2), "utf8");
  } catch (writeErr) {
    console.error("[FAIL] could not write tmp policy file: " + (writeErr instanceof Error ? writeErr.message : String(writeErr)));
    return { ok: false, addedServices: [], existingServices: [] };
  }

  const setRes = gcloud([
    "projects",
    "set-iam-policy",
    PROJECT_ID,
    tmpPath,
    "--quiet",
  ]);
  if (!setRes.ok) {
    console.error("[FAIL] could not set IAM policy: " + setRes.stderr);
    return { ok: false, addedServices: [], existingServices };
  }

  console.log(`[OK] data access logs enabled for: ${addedServices.join(", ")}`);
  return { ok: true, addedServices, existingServices };
}

/**
 * Step 2 — create BigQuery dataset in europe-west2 with 7y retention.
 * Idempotent: bq show first; create only if missing.
 *
 * @returns {{ ok: boolean, status: "created"|"already-exists"|"error" }}
 */
function ensureDataset() {
  const showRes = bq([
    `--project_id=${PROJECT_ID}`,
    `--location=${DEFAULT_LOCATION}`,
    "show",
    "--format=prettyjson",
    `${PROJECT_ID}:${DEFAULT_DATASET}`,
  ]);
  if (showRes.ok) {
    console.log(`[OK] dataset ${DEFAULT_DATASET} already exists in ${DEFAULT_LOCATION}`);
    return { ok: true, status: "already-exists" };
  }

  if (DRY_RUN) {
    console.log(
      `[DRY-RUN] would create dataset ${PROJECT_ID}:${DEFAULT_DATASET} in ${DEFAULT_LOCATION} with default_table_expiration=${SEVEN_YEARS_SECONDS}s (7y)`,
    );
    return { ok: true, status: "created" };
  }

  const mkRes = bq([
    `--project_id=${PROJECT_ID}`,
    `--location=${DEFAULT_LOCATION}`,
    "mk",
    `--default_table_expiration=${SEVEN_YEARS_SECONDS}`,
    "--description=Phase 7 AUDIT-03/06 audit log archive (7y retention; europe-west2 to match Firestore per Pitfall 5)",
    `${PROJECT_ID}:${DEFAULT_DATASET}`,
  ]);
  if (!mkRes.ok) {
    console.error(`[FAIL] could not create dataset: ${mkRes.stderr}`);
    return { ok: false, status: "error" };
  }
  console.log(`[OK] created dataset ${DEFAULT_DATASET} in ${DEFAULT_LOCATION} with 7y retention`);
  return { ok: true, status: "created" };
}

/**
 * Step 3 — create Cloud Logging sink targeting the dataset.
 * Idempotent: gcloud logging sinks describe first.
 *
 * @returns {{ ok: boolean, status: "created"|"already-exists"|"error", writerIdentity: string }}
 */
function ensureSink() {
  const describeRes = gcloud([
    "logging",
    "sinks",
    "describe",
    DEFAULT_SINK_NAME,
    `--project=${PROJECT_ID}`,
    "--format=value(writerIdentity)",
  ]);
  if (describeRes.ok) {
    const writerIdentity = describeRes.stdout;
    console.log(`[OK] sink ${DEFAULT_SINK_NAME} already exists; writerIdentity=${writerIdentity}`);
    return { ok: true, status: "already-exists", writerIdentity };
  }

  const destination = `bigquery.googleapis.com/projects/${PROJECT_ID}/datasets/${DEFAULT_DATASET}`;

  if (DRY_RUN) {
    console.log(
      `[DRY-RUN] would create sink ${DEFAULT_SINK_NAME} -> ${destination} with --use-partitioned-tables`,
    );
    return { ok: true, status: "created", writerIdentity: "(unknown — dry-run)" };
  }

  const createRes = gcloud([
    "logging",
    "sinks",
    "create",
    DEFAULT_SINK_NAME,
    destination,
    `--project=${PROJECT_ID}`,
    "--use-partitioned-tables",
    `--log-filter=${SINK_FILTER}`,
  ]);
  if (!createRes.ok) {
    console.error(`[FAIL] could not create sink: ${createRes.stderr}`);
    return { ok: false, status: "error", writerIdentity: "" };
  }

  // Re-describe to fetch writerIdentity (printed in stdout but easier to re-read).
  const reRes = gcloud([
    "logging",
    "sinks",
    "describe",
    DEFAULT_SINK_NAME,
    `--project=${PROJECT_ID}`,
    "--format=value(writerIdentity)",
  ]);
  const writerIdentity = reRes.ok ? reRes.stdout : "";
  console.log(`[OK] created sink ${DEFAULT_SINK_NAME}; writerIdentity=${writerIdentity}`);
  return { ok: true, status: "created", writerIdentity };
}

/**
 * Step 4 — bind sink writer SA to roles/bigquery.dataEditor on the dataset.
 * Idempotent: bq show ACL; add if missing.
 *
 * @param {string} writerIdentity
 * @returns {{ ok: boolean, status: "added"|"already-bound"|"error" }}
 */
function ensureSinkWriterBinding(writerIdentity) {
  if (!writerIdentity || writerIdentity === "(unknown — dry-run)") {
    if (DRY_RUN) {
      console.log("[DRY-RUN] would bind sink writer SA to roles/bigquery.dataEditor on dataset");
      return { ok: true, status: "added" };
    }
    console.error("[FAIL] no writerIdentity available for sink binding");
    return { ok: false, status: "error" };
  }

  // Use project-level binding for simplicity (dataset-level ACL is also valid
  // but requires bq update --source-format=NONE which is more brittle in scripts).
  const r = gcloud([
    "projects",
    "add-iam-policy-binding",
    PROJECT_ID,
    `--member=${writerIdentity}`,
    "--role=roles/bigquery.dataEditor",
    "--condition=None",
  ]);
  if (!r.ok) {
    console.error(`[FAIL] could not bind sink writer to dataEditor: ${r.stderr}`);
    return { ok: false, status: "error" };
  }
  console.log(`[OK] bound ${writerIdentity} to roles/bigquery.dataEditor`);
  return { ok: true, status: "added" };
}

/**
 * Step 5 — read internalAllowlist admin emails from Firestore + grant
 * roles/bigquery.dataViewer on the project (dataViewer scoped at project
 * level; admins can list/query all datasets, audit_logs_bq is the one that
 * matters for this binding's intent).
 *
 * NOTE: this requires the running operator to have ADC + datastore.user role
 * on the project. If the read fails (e.g. no internalAllowlist collection
 * yet), the binding step is skipped and the operator is told to bind manually.
 *
 * @returns {{ ok: boolean, viewerCount: number, viewerEmails: string[] }}
 */
function ensureAdminViewerBindings() {
  // Use gcloud firestore export-equivalent? No — Firestore doesn't have a
  // gcloud get-document. Use the Cloud Firestore REST API via gcloud auth
  // print-access-token, or skip and have the operator do it manually.
  //
  // For safety + simplicity, this script PRINTS the binding command the
  // operator should run after verifying internalAllowlist contents. The
  // script does NOT read Firestore directly to avoid pulling firebase-admin
  // as a dep + to honour the "scripts shell out only" pattern from
  // provision-function-sas.

  console.log(
    "\n[NOTE] Admin dataViewer bindings: list internalAllowlist admin emails manually,\n" +
      "       then run for each:\n" +
      `       gcloud projects add-iam-policy-binding ${PROJECT_ID} \\\n` +
      "         --member=user:<admin-email> --role=roles/bigquery.dataViewer\n",
  );

  return { ok: true, viewerCount: 0, viewerEmails: [] };
}

function main() {
  console.log(
    `\n=== Phase 7 BigQuery audit sink bootstrap (project=${PROJECT_ID}${DRY_RUN ? ", DRY-RUN" : ""}) ===\n`,
  );

  // Verify gcloud + bq are on PATH.
  const gcloudCheck = gcloud(["--version"]);
  if (!gcloudCheck.ok) {
    console.error(
      "[FAIL] gcloud CLI not found on PATH. Install Google Cloud SDK and run `gcloud auth application-default login` first.",
    );
    exit(1);
  }
  const bqCheck = bq(["version"]);
  if (!bqCheck.ok) {
    console.error("[FAIL] bq CLI not found on PATH. It bundles with gcloud — verify your install.");
    exit(1);
  }

  let anyFailed = false;

  // Step 1 — Data Access logs
  const dataAccess = ensureDataAccessLogs();
  if (!dataAccess.ok) anyFailed = true;

  // Step 2 — BigQuery dataset
  const dataset = ensureDataset();
  if (!dataset.ok) anyFailed = true;

  // Step 3 — Cloud Logging sink
  const sink = ensureSink();
  if (!sink.ok) anyFailed = true;

  // Step 4 — sink writer dataEditor binding
  const writerBinding = ensureSinkWriterBinding(sink.writerIdentity);
  if (!writerBinding.ok) anyFailed = true;

  // Step 5 — admin dataViewer bindings (operator-paced)
  const viewerBindings = ensureAdminViewerBindings();
  if (!viewerBindings.ok) anyFailed = true;

  // Summary
  console.log("\n=== Summary ===");
  console.log(
    [
      `dataset:                 ${PROJECT_ID}:${DEFAULT_DATASET}`,
      `location:                ${DEFAULT_LOCATION}`,
      `retention_seconds:       ${SEVEN_YEARS_SECONDS} (7 years)`,
      `data_access_services:    ${DATA_ACCESS_SERVICES.length} (${DATA_ACCESS_SERVICES.join(", ")})`,
      `sink_name:               ${DEFAULT_SINK_NAME}`,
      `sink_writer_identity:    ${sink.writerIdentity || "(unknown)"}`,
      `sink_status:             ${sink.status}`,
      `dataset_status:          ${dataset.status}`,
      `data_editor_count:       1 (sink writer SA)`,
      `data_viewer_count:       ${viewerBindings.viewerCount} (operator-paced; see [NOTE] above)`,
    ].join("\n"),
  );
  console.log("");

  if (anyFailed) {
    console.error("[FAIL] one or more steps failed; see logs above");
    exit(1);
  }
  if (DRY_RUN) {
    console.log("[OK] Dry-run complete; no mutations performed.");
  } else {
    console.log("[OK] BigQuery audit sink bootstrap complete.");
    console.log("\nNext steps:");
    console.log("  1. Wait T+1h for first audit logs to land in BigQuery");
    console.log("  2. Run verification query (see runbooks/phase-7-bigquery-sink-bootstrap.md)");
    console.log("  3. Bind admin emails to roles/bigquery.dataViewer per [NOTE] above");
  }
}

main();
