#!/usr/bin/env node
// @ts-nocheck
// scripts/setup-backup-bucket/run.js
//
// Phase 8 Wave 1 (BACKUP-02 + BACKUP-03 + BACKUP-04 / Pattern E / Pitfall 10 + 13):
// one-shot Admin-CLI ADC script. Provisions the backup substrate that must be
// live before any Phase 8 Cloud Function deploys (Pitfall 10 — backup must be
// proven live before GDPR erasure or soft-delete runs in production):
//
//   1. Verify gcloud + ADC are authenticated (fail fast if not).
//   2. Create GCS backups bucket gs://bedeveloped-base-layers-backups in
//      europe-west2 with Uniform Bucket-Level Access and Public Access
//      Prevention enforced (T-08-01-01 mitigation).
//   3. Apply GCS lifecycle policy (30d STANDARD→NEARLINE, 365d NEARLINE→ARCHIVE)
//      from the sibling lifecycle.json (BACKUP-02).
//   4. Enable Firestore Point-in-Time Recovery (7-day rolling window) on the
//      (default) database (BACKUP-03).
//   5. Enable Object Versioning on gs://bedeveloped-base-layers-uploads (BACKUP-04).
//   6. Set soft-delete retention to 90 days on the uploads bucket (BACKUP-04).
//   7. Print summary table at exit; exit 0 on success, 1 on any non-skip error.
//
// CRITICAL: this script bypasses Firestore Security Rules at runtime — it runs
// Admin-CLI gcloud commands. It MUST NOT be imported into src/ (Pitfall 4).
// Lives in scripts/ entirely separate from the Vite bundle.
//
// ADC: operator runs `gcloud auth application-default login` first (Pitfall 13
// — no service-account JSON in source). The script does NOT read
// GOOGLE_APPLICATION_CREDENTIALS pointed at a JSON file.
//
// Idempotent: every run
//   - describes before mutating; skips steps already in desired state
//   - applies lifecycle policy unconditionally (gcloud is idempotent on identical policy)
//   - prints [SKIP] already in desired state for steps that are already done
//   - safe to re-run; no destructive operations
//
// Usage:
//   gcloud auth application-default login
//   node scripts/setup-backup-bucket/run.js [--project=<id>] [--dry-run]
//
//   --project=<id>   override default project (bedeveloped-base-layers)
//   --dry-run        compute plan + print actions; no mutations
//   --help, -h       print this help text and exit 0
//
// Exit codes:
//   0 — all steps succeeded (or were already in desired state)
//   1 — one or more steps failed (error details above summary)
//
// Citations:
//   - 08-RESEARCH.md Pattern E — one-shot ADC script shape
//   - 08-RESEARCH.md Pattern 2 — GCS lifecycle JSON (BACKUP-02)
//   - 08-RESEARCH.md Pattern 3 — Firestore PITR gcloud commands (BACKUP-03)
//   - 08-RESEARCH.md Pattern 4 — Storage versioning + soft-delete commands (BACKUP-04)
//   - Pitfall 10 — backup substrate must be live before soft-delete / GDPR erasure runs
//   - Pitfall 13 — ADC only; no JSON SA in repo

import { spawnSync } from "node:child_process";
import { argv, exit } from "node:process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_PROJECT = "bedeveloped-base-layers";
const DEFAULT_BACKUPS_BUCKET = "bedeveloped-base-layers-backups";
const DEFAULT_UPLOADS_BUCKET = "bedeveloped-base-layers-uploads";
const DEFAULT_LOCATION = "europe-west2";
// 90 days in seconds: 90 * 24 * 3600 = 7_776_000
const SOFT_DELETE_SECONDS = 7_776_000;
const LIFECYCLE_FILE = join(__dirname, "lifecycle.json");

const HELP = argv.includes("--help") || argv.includes("-h");
if (HELP) {
  console.log(
    "Usage: node scripts/setup-backup-bucket/run.js [--project=<id>] [--dry-run]\n" +
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

const BACKUPS_BUCKET = DEFAULT_BACKUPS_BUCKET;
const UPLOADS_BUCKET = DEFAULT_UPLOADS_BUCKET;

/**
 * Run a gcloud command and return status.
 * @param {string[]} args
 * @param {{ allowFail?: boolean }} [opts]
 * @returns {{ ok: boolean, stdout: string, stderr: string, code: number | null }}
 */
function runGcloud(args, opts = {}) {
  const res = spawnSync("gcloud", args, { encoding: "utf8" });
  const ok = res.status === 0;
  if (!ok && !opts.allowFail) {
    // Caller decides whether to fail; just return the result.
  }
  return {
    ok,
    stdout: (res.stdout ?? "").trim(),
    stderr: (res.stderr ?? "").trim(),
    code: res.status,
  };
}

// ─── Step 1: Verify gcloud + ADC ──────────────────────────────────────────────

function verifyAdc() {
  const r = runGcloud(["auth", "application-default", "print-access-token"], { allowFail: true });
  if (!r.ok) {
    console.error(
      "[FAIL] ADC not configured. Run `gcloud auth application-default login` first.\n" +
        "       Error: " +
        r.stderr,
    );
    exit(1);
  }
  console.log("[OK] ADC verified (application-default access token obtained)");
}

// ─── Step 2: Create backups bucket if absent ───────────────────────────────────

/**
 * @returns {{ ok: boolean, status: "created"|"already-exists"|"error" }}
 */
function ensureBackupsBucket() {
  const describeRes = runGcloud(
    [
      "storage",
      "buckets",
      "describe",
      `gs://${BACKUPS_BUCKET}`,
      `--project=${PROJECT_ID}`,
      "--format=value(location)",
    ],
    { allowFail: true },
  );

  if (describeRes.ok) {
    const location = describeRes.stdout.trim().toUpperCase();
    const expectedLocation = DEFAULT_LOCATION.toUpperCase();
    if (location !== expectedLocation) {
      console.error(
        `[FAIL] Bucket gs://${BACKUPS_BUCKET} already exists but in wrong location: ` +
          `${location} (expected ${expectedLocation}). Do NOT delete — contact operator.`,
      );
      return { ok: false, status: "error" };
    }
    console.log(`[SKIP] gs://${BACKUPS_BUCKET} already exists in ${location} — no creation needed`);
    return { ok: true, status: "already-exists" };
  }

  if (DRY_RUN) {
    console.log(
      `[DRY-RUN] would run: gcloud storage buckets create gs://${BACKUPS_BUCKET} ` +
        `--project=${PROJECT_ID} --location=${DEFAULT_LOCATION} ` +
        `--uniform-bucket-level-access --public-access-prevention=enforced`,
    );
    return { ok: true, status: "created" };
  }

  const createRes = runGcloud([
    "storage",
    "buckets",
    "create",
    `gs://${BACKUPS_BUCKET}`,
    `--project=${PROJECT_ID}`,
    `--location=${DEFAULT_LOCATION}`,
    "--uniform-bucket-level-access",
    "--public-access-prevention=enforced",
  ]);

  if (!createRes.ok) {
    console.error(`[FAIL] could not create bucket gs://${BACKUPS_BUCKET}: ${createRes.stderr}`);
    return { ok: false, status: "error" };
  }
  console.log(`[OK] created gs://${BACKUPS_BUCKET} in ${DEFAULT_LOCATION} with UBLA + PAP`);
  return { ok: true, status: "created" };
}

// ─── Step 3: Apply lifecycle policy ───────────────────────────────────────────

/**
 * @returns {{ ok: boolean, status: "applied"|"error" }}
 */
function applyLifecyclePolicy() {
  if (DRY_RUN) {
    console.log(
      `[DRY-RUN] would run: gcloud storage buckets update gs://${BACKUPS_BUCKET} ` +
        `--lifecycle-file=${LIFECYCLE_FILE} --project=${PROJECT_ID}`,
    );
    return { ok: true, status: "applied" };
  }

  const r = runGcloud([
    "storage",
    "buckets",
    "update",
    `gs://${BACKUPS_BUCKET}`,
    `--lifecycle-file=${LIFECYCLE_FILE}`,
    `--project=${PROJECT_ID}`,
  ]);

  if (!r.ok) {
    console.error(`[FAIL] could not apply lifecycle policy: ${r.stderr}`);
    return { ok: false, status: "error" };
  }
  console.log(
    `[OK] applied lifecycle policy to gs://${BACKUPS_BUCKET} (30d Standard→Nearline, 365d Nearline→Archive)`,
  );
  return { ok: true, status: "applied" };
}

// ─── Step 4: Enable Firestore PITR ────────────────────────────────────────────

/**
 * @returns {{ ok: boolean, status: "enabled"|"already-enabled"|"error" }}
 */
function ensureFirestorePitr() {
  const describeRes = runGcloud(
    [
      "firestore",
      "databases",
      "describe",
      "--database=(default)",
      `--project=${PROJECT_ID}`,
      "--format=value(pointInTimeRecoveryEnablement)",
    ],
    { allowFail: true },
  );

  if (describeRes.ok && describeRes.stdout.trim() === "POINT_IN_TIME_RECOVERY_ENABLED") {
    console.log("[SKIP] Firestore PITR already enabled on (default) database");
    return { ok: true, status: "already-enabled" };
  }

  if (DRY_RUN) {
    console.log(
      `[DRY-RUN] would run: gcloud firestore databases update --database=(default) ` +
        `--enable-pitr --project=${PROJECT_ID}`,
    );
    return { ok: true, status: "enabled" };
  }

  const updateRes = runGcloud([
    "firestore",
    "databases",
    "update",
    "--database=(default)",
    "--enable-pitr",
    `--project=${PROJECT_ID}`,
  ]);

  if (!updateRes.ok) {
    console.error(`[FAIL] could not enable Firestore PITR: ${updateRes.stderr}`);
    return { ok: false, status: "error" };
  }
  console.log("[OK] Firestore PITR enabled on (default) database (7-day rolling window)");
  return { ok: true, status: "enabled" };
}

// ─── Step 5: Enable uploads bucket Object Versioning ──────────────────────────

/**
 * @returns {{ ok: boolean, status: "enabled"|"already-enabled"|"error"|"bucket-missing" }}
 */
function ensureUploadsVersioning() {
  const describeRes = runGcloud(
    [
      "storage",
      "buckets",
      "describe",
      `gs://${UPLOADS_BUCKET}`,
      `--project=${PROJECT_ID}`,
      "--format=value(versioning.enabled)",
    ],
    { allowFail: true },
  );

  if (!describeRes.ok) {
    console.error(
      `[FAIL] Uploads bucket gs://${UPLOADS_BUCKET} does not exist. ` +
        `It must exist before Phase 8 — was it created in Phase 5?`,
    );
    return { ok: false, status: "bucket-missing" };
  }

  if (describeRes.stdout.trim() === "True") {
    console.log(`[SKIP] gs://${UPLOADS_BUCKET} Object Versioning already enabled`);
    return { ok: true, status: "already-enabled" };
  }

  if (DRY_RUN) {
    console.log(
      `[DRY-RUN] would run: gcloud storage buckets update gs://${UPLOADS_BUCKET} ` +
        `--versioning --project=${PROJECT_ID}`,
    );
    return { ok: true, status: "enabled" };
  }

  const updateRes = runGcloud([
    "storage",
    "buckets",
    "update",
    `gs://${UPLOADS_BUCKET}`,
    "--versioning",
    `--project=${PROJECT_ID}`,
  ]);

  if (!updateRes.ok) {
    console.error(
      `[FAIL] could not enable versioning on gs://${UPLOADS_BUCKET}: ${updateRes.stderr}`,
    );
    return { ok: false, status: "error" };
  }
  console.log(`[OK] enabled Object Versioning on gs://${UPLOADS_BUCKET}`);
  return { ok: true, status: "enabled" };
}

// ─── Step 6: Set uploads bucket soft-delete to 90 days ────────────────────────

/**
 * @returns {{ ok: boolean, status: "set"|"already-set"|"error" }}
 */
function ensureUploadsSoftDelete() {
  const describeRes = runGcloud(
    [
      "storage",
      "buckets",
      "describe",
      `gs://${UPLOADS_BUCKET}`,
      `--project=${PROJECT_ID}`,
      "--format=value(softDeletePolicy.retentionDurationSeconds)",
    ],
    { allowFail: true },
  );

  if (describeRes.ok) {
    const current = describeRes.stdout.trim();
    if (current === String(SOFT_DELETE_SECONDS)) {
      console.log(
        `[SKIP] gs://${UPLOADS_BUCKET} soft-delete retention already set to ${SOFT_DELETE_SECONDS}s (90 days)`,
      );
      return { ok: true, status: "already-set" };
    }
  }

  if (DRY_RUN) {
    console.log(
      `[DRY-RUN] would run: gcloud storage buckets update gs://${UPLOADS_BUCKET} ` +
        `--soft-delete-duration=${SOFT_DELETE_SECONDS}s --project=${PROJECT_ID}`,
    );
    return { ok: true, status: "set" };
  }

  const updateRes = runGcloud([
    "storage",
    "buckets",
    "update",
    `gs://${UPLOADS_BUCKET}`,
    `--soft-delete-duration=${SOFT_DELETE_SECONDS}s`,
    `--project=${PROJECT_ID}`,
  ]);

  if (!updateRes.ok) {
    console.error(
      `[FAIL] could not set soft-delete retention on gs://${UPLOADS_BUCKET}: ${updateRes.stderr}`,
    );
    return { ok: false, status: "error" };
  }
  console.log(
    `[OK] set soft-delete retention to ${SOFT_DELETE_SECONDS}s (90 days) on gs://${UPLOADS_BUCKET}`,
  );
  return { ok: true, status: "set" };
}

// ─── Step 7: Print summary table ──────────────────────────────────────────────

/**
 * @param {{ bucketStatus: string, lifecycleStatus: string, pitrStatus: string, versioningStatus: string, softDeleteStatus: string }} info
 */
function printSummary(info) {
  const col1 = 30;
  const col2 = 20;
  const col3 = 20;

  const line = (label, value, note) =>
    `  ${label.padEnd(col1)} ${value.padEnd(col2)} ${note ?? ""}`;

  console.log("\n=== Summary ===");
  console.log("  " + "Resource".padEnd(col1) + " " + "Status".padEnd(col2) + " " + "Detail");
  console.log("  " + "-".repeat(col1) + " " + "-".repeat(col2) + " " + "-".repeat(col3));
  console.log(
    line(`gs://${BACKUPS_BUCKET}`, info.bucketStatus, `location=${DEFAULT_LOCATION}, UBLA, PAP`),
  );
  console.log(
    line(
      "  lifecycle policy",
      info.lifecycleStatus,
      "30d Standard→Nearline, 365d Nearline→Archive",
    ),
  );
  console.log(line("Firestore PITR", info.pitrStatus, "(default) database, 7-day window"));
  console.log(line(`gs://${UPLOADS_BUCKET}`, "", ""));
  console.log(line("  versioning", info.versioningStatus, "Object Versioning"));
  console.log(line("  soft-delete", info.softDeleteStatus, `${SOFT_DELETE_SECONDS}s = 90 days`));
  console.log("");
}

// ─── Main ──────────────────────────────────────────────────────────────────────

function main() {
  console.log(
    `\n=== Phase 8 backup substrate setup (project=${PROJECT_ID}${DRY_RUN ? ", DRY-RUN" : ""}) ===\n`,
  );

  // Step 1 — ADC check (always, even in dry-run — if ADC fails, dry-run is useless)
  verifyAdc();

  let anyFailed = false;

  // Step 2 — backups bucket
  const bucketResult = ensureBackupsBucket();
  if (!bucketResult.ok) anyFailed = true;

  // Step 3 — lifecycle policy (depends on bucket existing; skip if bucket creation failed)
  let lifecycleResult = { ok: true, status: "skipped" };
  if (bucketResult.ok) {
    lifecycleResult = applyLifecyclePolicy();
    if (!lifecycleResult.ok) anyFailed = true;
  } else {
    console.log("[SKIP] lifecycle policy skipped (bucket step failed)");
  }

  // Step 4 — Firestore PITR
  const pitrResult = ensureFirestorePitr();
  if (!pitrResult.ok) anyFailed = true;

  // Step 5 — uploads versioning
  const versioningResult = ensureUploadsVersioning();
  if (!versioningResult.ok) anyFailed = true;

  // Step 6 — uploads soft-delete (only if uploads bucket exists)
  let softDeleteResult = { ok: true, status: "skipped" };
  if (versioningResult.status !== "bucket-missing") {
    softDeleteResult = ensureUploadsSoftDelete();
    if (!softDeleteResult.ok) anyFailed = true;
  }

  // Step 7 — summary table
  printSummary({
    bucketStatus: bucketResult.status,
    lifecycleStatus: lifecycleResult.status,
    pitrStatus: pitrResult.status,
    versioningStatus: versioningResult.status,
    softDeleteStatus: softDeleteResult.status,
  });

  if (anyFailed) {
    console.error("[FAIL] one or more steps failed; see logs above");
    exit(1);
  }
  if (DRY_RUN) {
    console.log("[OK] Dry-run complete; no mutations performed.");
    console.log("     Re-run without --dry-run to apply changes.");
  } else {
    console.log("[OK] Phase 8 backup substrate setup complete.");
    console.log("\nNext steps:");
    console.log("  1. Run the verification commands in runbooks/phase-8-backup-setup.md §4");
    console.log(
      "  2. Provision backup-sa per runbooks/phase-8-backup-setup.md §5 (required for Wave 2 deploy)",
    );
    console.log(
      "  3. Continue with Phase 8 Wave 2 (08-02 scheduledFirestoreExport Cloud Function)",
    );
  }
}

main();
