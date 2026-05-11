#!/usr/bin/env node
// scripts/setup-budget-alerts/run.js
// @ts-check
//
// Phase 9 Wave 6 (OBS-07 / Pattern E / Pitfall 13): GCP Cloud Billing budget
// provisioner — idempotent one-shot operator script.
//
// Creates a monthly budget on the billing account with notification thresholds
// at 50% / 80% / 100% of the configured budget amount. Default budget is
// £100/month; operator can override via env vars (BUDGET_AMOUNT + BUDGET_CURRENCY).
//
// IMPORTANT — substrate-honest disclosure per 09-RESEARCH.md §Pattern 8 line 696
// and Pitfall 19:
//
//   Budget alerts NOTIFY only. They do NOT cap spend. Cloud Billing's
//   budget mechanism delivers an email / Pub/Sub notification when the
//   month-to-date spend crosses each threshold — it does not pause or
//   disable services. Automatic cutoff via a Pub/Sub-driven Cloud Function
//   that disables the project on threshold=100% is the documented Firebase
//   pattern (https://firebase.google.com/docs/projects/billing/avoid-surprise-bills)
//   and is explicitly OUT OF SCOPE for Phase 9. v2 deferral.
//
// CRITICAL: this script bypasses Firestore Security Rules at runtime — it runs
// Admin-CLI gcloud commands. It MUST NOT be imported into src/ (Pitfall 4).
// Lives in scripts/ entirely separate from the Vite bundle.
//
// ADC: operator runs `gcloud auth application-default login` first (Pitfall 13
// — no service-account JSON in source).
//
// Idempotency:
//   1. Resolve BILLING_ACCOUNT from `gcloud billing projects describe`.
//   2. List existing budgets with `gcloud billing budgets list`.
//   3. If a budget named `base-layers-monthly` exists, log [SKIP] and exit 0.
//   4. Otherwise create the budget with 0.5/0.8/1.0 threshold rules.
//
// Usage:
//   gcloud auth application-default login
//   node scripts/setup-budget-alerts/run.js [--project=<id>] [--dry-run]
//
//   --project=<id>   override default project (bedeveloped-base-layers)
//   --dry-run        print the planned action; no mutations
//   --help, -h       print this help text and exit 0
//
// Env overrides:
//   BUDGET_AMOUNT     numeric amount (default: 100)
//   BUDGET_CURRENCY   ISO currency code (default: GBP)
//
// Exit codes:
//   0 — budget exists or was created
//   1 — gcloud / ADC / billing API failure
//
// Citations:
//   - 09-RESEARCH.md §Pattern 8 (lines 672-696) — budget shape + "notify-only" limitation
//   - 09-PATTERNS.md line 28 — research-pattern marker (no codebase analog)
//   - Pitfall 13 — ADC only; no JSON SA in repo
//   - Pitfall 19 — substrate-honest disclosure pattern ("alerts notify only")
//   - OBS-07 — Phase 9 requirement ID

import { spawnSync } from "node:child_process";
import { argv, env, exit } from "node:process";

const DEFAULT_PROJECT = "bedeveloped-base-layers";
const BUDGET_NAME = "base-layers-monthly";
// Operator can override these via env vars.
const BUDGET_AMOUNT = env.BUDGET_AMOUNT ?? "100";
const BUDGET_CURRENCY = env.BUDGET_CURRENCY ?? "GBP";

const HELP = argv.includes("--help") || argv.includes("-h");
if (HELP) {
  console.log(
    "Usage: node scripts/setup-budget-alerts/run.js [--project=<id>] [--dry-run]\n" +
      "  --project=<id>   override default project (default: " +
      DEFAULT_PROJECT +
      ")\n" +
      "  --dry-run        print the planned action; no mutations\n" +
      "  --help, -h       print this help text and exit 0\n" +
      "\n" +
      "Env overrides:\n" +
      "  BUDGET_AMOUNT     numeric amount (default: 100)\n" +
      "  BUDGET_CURRENCY   ISO currency code (default: GBP)",
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

// ─── Step 2: Resolve billing account ──────────────────────────────────────────

/**
 * @returns {{ ok: boolean, billingAccount: string }}
 */
function resolveBillingAccount() {
  const r = runGcloud(
    ["billing", "projects", "describe", PROJECT_ID, "--format=value(billingAccountName)"],
    { allowFail: true },
  );
  if (!r.ok) {
    console.error(
      `[FAIL] could not resolve billing account for project ${PROJECT_ID}: ${r.stderr}\n` +
        "       Ensure the project has billing enabled and the operator has " +
        "roles/billing.viewer (or roles/billing.user) on the billing account.",
    );
    return { ok: false, billingAccount: "" };
  }
  // Strip the `billingAccounts/` prefix — gcloud returns the resource name.
  const billingAccount = r.stdout.replace(/^billingAccounts\//, "").trim();
  if (!billingAccount) {
    console.error(`[FAIL] project ${PROJECT_ID} has no billingAccountName set`);
    return { ok: false, billingAccount: "" };
  }
  console.log(`[OK] resolved billing account: ${billingAccount}`);
  return { ok: true, billingAccount };
}

// ─── Step 3: Check if budget already exists ───────────────────────────────────

/**
 * @param {string} billingAccount
 * @returns {{ ok: boolean, exists: boolean }}
 */
function budgetExists(billingAccount) {
  const r = runGcloud(
    [
      "billing",
      "budgets",
      "list",
      `--billing-account=${billingAccount}`,
      "--format=value(displayName)",
    ],
    { allowFail: true },
  );
  if (!r.ok) {
    console.error(
      `[FAIL] could not list budgets on billing account ${billingAccount}: ${r.stderr}`,
    );
    return { ok: false, exists: false };
  }
  return { ok: true, exists: r.stdout.split(/\r?\n/).some((l) => l.trim() === BUDGET_NAME) };
}

// ─── Step 4: Create budget ────────────────────────────────────────────────────

/**
 * @param {string} billingAccount
 * @returns {{ ok: boolean, status: "created"|"error" }}
 */
function createBudget(billingAccount) {
  if (DRY_RUN) {
    console.log(
      `[DRY-RUN] would run: gcloud billing budgets create ` +
        `--billing-account=${billingAccount} ` +
        `--display-name=${BUDGET_NAME} ` +
        `--budget-amount=${BUDGET_AMOUNT}${BUDGET_CURRENCY} ` +
        `--threshold-rule=percent=0.5 ` +
        `--threshold-rule=percent=0.8 ` +
        `--threshold-rule=percent=1.0 ` +
        `--filter-projects=projects/${PROJECT_ID}`,
    );
    return { ok: true, status: "created" };
  }

  const r = runGcloud([
    "billing",
    "budgets",
    "create",
    `--billing-account=${billingAccount}`,
    `--display-name=${BUDGET_NAME}`,
    `--budget-amount=${BUDGET_AMOUNT}${BUDGET_CURRENCY}`,
    "--threshold-rule=percent=0.5",
    "--threshold-rule=percent=0.8",
    "--threshold-rule=percent=1.0",
    `--filter-projects=projects/${PROJECT_ID}`,
  ]);

  if (!r.ok) {
    console.error(`[FAIL] could not create budget ${BUDGET_NAME}: ${r.stderr}`);
    return { ok: false, status: "error" };
  }
  console.log(
    `[OK] created budget ${BUDGET_NAME} (${BUDGET_AMOUNT} ${BUDGET_CURRENCY}/month, thresholds 50/80/100%)`,
  );
  return { ok: true, status: "created" };
}

// ─── Main ──────────────────────────────────────────────────────────────────────

function main() {
  console.log(
    `\n=== Phase 9 Wave 6 (OBS-07): GCP Cloud Billing budget provisioner ` +
      `(project=${PROJECT_ID}${DRY_RUN ? ", DRY-RUN" : ""}) ===\n`,
  );
  console.log(
    "[NOTE] Budget alerts NOTIFY only; they do NOT cap spend. Auto-disable via " +
      "Pub/Sub-driven Cloud Function is OUT OF SCOPE for Phase 9 (v2 deferral). " +
      "See 09-RESEARCH.md §Pattern 8 line 696 + Pitfall 19.\n",
  );

  verifyGcloud();

  const billing = resolveBillingAccount();
  if (!billing.ok) {
    exit(1);
  }

  const existsResult = budgetExists(billing.billingAccount);
  if (!existsResult.ok) {
    exit(1);
  }

  if (existsResult.exists) {
    console.log(
      `[SKIP] budget ${BUDGET_NAME} already exists on billing account ` +
        `${billing.billingAccount}; no creation needed. ` +
        `Verify in Cloud Console > Billing > Budgets & alerts.`,
    );
    exit(0);
  }

  const createResult = createBudget(billing.billingAccount);
  if (!createResult.ok) {
    exit(1);
  }

  console.log("");
  if (DRY_RUN) {
    console.log("[OK] Dry-run complete; no mutations performed.");
    console.log("     Re-run without --dry-run to create the budget.");
  } else {
    console.log(
      "[OK] Verify in Cloud Console > Billing > Budgets & alerts. " +
        "NOTE: this notifies only; does not cap spend (Pitfall 19).",
    );
  }
}

main();
