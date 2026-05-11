#!/usr/bin/env node
// scripts/setup-uptime-check/run.js
// @ts-check
//
// Phase 9 Wave 6 (OBS-06 / Pattern E / Pitfall 13): GCP Cloud Monitoring
// uptime check provisioner — idempotent one-shot operator script.
//
// Creates a 60-second multi-region uptime check on the production hostname
// `baselayers.bedeveloped.com`. The check probes the public HTTPS endpoint
// from external GCP regions independent of the project itself, satisfying
// OBS-06: "Uptime monitor checks https://baselayers.bedeveloped.com every
// 1min from ≥2 regions."
//
// REGIONS — IMPORTANT per 09-RESEARCH.md §Pattern 7 line 670:
//   gcloud monitoring uptime requires `--regions` to include AT LEAST 3
//   locations when specified. OBS-06's success criterion says ≥2; we use
//   `USA,EUROPE,ASIA_PACIFIC` to satisfy the gcloud minimum AND exceed the
//   success-criterion threshold.
//
// CRITICAL: this script bypasses Firestore Security Rules at runtime — it
// runs Admin-CLI gcloud commands. It MUST NOT be imported into src/
// (Pitfall 4). Lives in scripts/ entirely separate from the Vite bundle.
//
// ADC: operator runs `gcloud auth application-default login` first
// (Pitfall 13 — no service-account JSON in source).
//
// Idempotency:
//   1. `gcloud monitoring uptime list` describes existing checks.
//   2. If a check named `base-layers-diagnostic-prod` exists, log [SKIP] and exit 0.
//   3. Otherwise run `gcloud monitoring uptime create ...`.
//
// Usage:
//   gcloud auth application-default login
//   node scripts/setup-uptime-check/run.js [--project=<id>] [--dry-run]
//
//   --project=<id>   override default project (bedeveloped-base-layers)
//   --dry-run        print the planned action; no mutations
//   --help, -h       print this help text and exit 0
//
// Exit codes:
//   0 — uptime check exists or was created
//   1 — gcloud / ADC failure
//
// Citations:
//   - 09-RESEARCH.md §Pattern 7 (lines 634-670) — uptime check shape + 3-region minimum
//   - 09-PATTERNS.md line 27 — research-pattern marker (no codebase analog)
//   - Pitfall 13 — ADC only; no JSON SA in repo
//   - OBS-06 — Phase 9 requirement ID

import { spawnSync } from "node:child_process";
import { argv, exit } from "node:process";

const DEFAULT_PROJECT = "bedeveloped-base-layers";
const DEFAULT_HOST = "baselayers.bedeveloped.com";
const CHECK_NAME = "base-layers-diagnostic-prod";
// USA,EUROPE,ASIA_PACIFIC — 3 regions to satisfy gcloud --regions minimum
// (per 09-RESEARCH.md §Pattern 7 line 670). OBS-06 calls for ≥2.
const REGIONS = "USA,EUROPE,ASIA_PACIFIC";

const HELP = argv.includes("--help") || argv.includes("-h");
if (HELP) {
  console.log(
    "Usage: node scripts/setup-uptime-check/run.js [--project=<id>] [--dry-run]\n" +
      "  --project=<id>   override default project (default: " +
      DEFAULT_PROJECT +
      ")\n" +
      "  --dry-run        print the planned action; no mutations\n" +
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

/**
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

function verifyGcloud() {
  const versionCheck = runGcloud(["--version"], { allowFail: true });
  if (!versionCheck.ok) {
    console.error(
      "[FAIL] gcloud CLI not found on PATH. Install Google Cloud SDK and run " +
        "`gcloud auth application-default login` first.",
    );
    exit(1);
  }
  console.log("[OK] gcloud CLI found");
}

// ─── Step 2: Check if uptime check already exists ─────────────────────────────

/**
 * @returns {{ ok: boolean, exists: boolean }}
 */
function uptimeCheckExists() {
  const r = runGcloud(
    [
      "monitoring",
      "uptime",
      "list-configs",
      `--project=${PROJECT_ID}`,
      "--format=value(displayName)",
    ],
    { allowFail: true },
  );
  if (!r.ok) {
    // `list-configs` is the GA verb; older gcloud versions use `list`.
    // Fall back to `list` if `list-configs` is unrecognized.
    const r2 = runGcloud(
      ["monitoring", "uptime", "list", `--project=${PROJECT_ID}`, "--format=value(displayName)"],
      { allowFail: true },
    );
    if (!r2.ok) {
      console.error(
        `[FAIL] could not list uptime checks (tried both list-configs + list): ${r.stderr || r2.stderr}`,
      );
      return { ok: false, exists: false };
    }
    return { ok: true, exists: r2.stdout.split(/\r?\n/).some((l) => l.trim() === CHECK_NAME) };
  }
  return { ok: true, exists: r.stdout.split(/\r?\n/).some((l) => l.trim() === CHECK_NAME) };
}

// ─── Step 3: Create uptime check ──────────────────────────────────────────────

/**
 * @returns {{ ok: boolean, status: "created"|"error" }}
 */
function createUptimeCheck() {
  if (DRY_RUN) {
    console.log(
      `[DRY-RUN] would run: gcloud monitoring uptime create ${CHECK_NAME} ` +
        `--resource-type=uptime-url ` +
        `--resource-labels=host=${DEFAULT_HOST},project_id=${PROJECT_ID} ` +
        `--protocol=https --request-method=get --path=/ ` +
        `--period=60s --timeout=10s ` +
        `--regions=${REGIONS} ` +
        `--project=${PROJECT_ID}`,
    );
    return { ok: true, status: "created" };
  }

  const r = runGcloud([
    "monitoring",
    "uptime",
    "create",
    CHECK_NAME,
    "--resource-type=uptime-url",
    `--resource-labels=host=${DEFAULT_HOST},project_id=${PROJECT_ID}`,
    "--protocol=https",
    "--request-method=get",
    "--path=/",
    "--period=60s",
    "--timeout=10s",
    `--regions=${REGIONS}`,
    `--project=${PROJECT_ID}`,
  ]);

  if (!r.ok) {
    console.error(`[FAIL] could not create uptime check ${CHECK_NAME}: ${r.stderr}`);
    return { ok: false, status: "error" };
  }
  console.log(`[OK] created uptime check ${CHECK_NAME} (60s period, regions=${REGIONS})`);
  return { ok: true, status: "created" };
}

// ─── Main ──────────────────────────────────────────────────────────────────────

function main() {
  console.log(
    `\n=== Phase 9 Wave 6 (OBS-06): GCP Cloud Monitoring uptime check provisioner ` +
      `(project=${PROJECT_ID}${DRY_RUN ? ", DRY-RUN" : ""}) ===\n`,
  );

  verifyGcloud();

  const existsResult = uptimeCheckExists();
  if (!existsResult.ok) {
    console.error("[FAIL] could not query uptime checks; aborting");
    exit(1);
  }

  if (existsResult.exists) {
    console.log(
      `[SKIP] uptime check ${CHECK_NAME} already exists; no creation needed. ` +
        `Verify in Cloud Console > Monitoring > Uptime checks.`,
    );
    exit(0);
  }

  const createResult = createUptimeCheck();
  if (!createResult.ok) {
    exit(1);
  }

  console.log("");
  if (DRY_RUN) {
    console.log("[OK] Dry-run complete; no mutations performed.");
    console.log("     Re-run without --dry-run to create the uptime check.");
  } else {
    console.log(
      "[OK] Verify in Cloud Console > Monitoring > Uptime checks. " +
        "Next: configure an alerting policy that posts to the SLACK_WEBHOOK_URL " +
        "notification channel (operator-paced — see runbooks/phase-9-monitors-bootstrap.md Step 3).",
    );
  }
}

main();
