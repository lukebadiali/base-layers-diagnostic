#!/usr/bin/env node
// scripts/deploy-functions/run.mjs
// @ts-check
//
// PLATFORM-UAT post-T19 F1-B (2026-05-25): one-shot Functions deploy.
//
// Why this exists: CI deploys Hosting + Rules on every push to main but
// EXCLUDES Functions (per the D-8/D-9 substrate gap documented inline in
// .github/workflows/ci.yml — firebase-tools' functions deploy attempts to
// touch IAM bindings the WIF identity is not granted). So Function changes
// — including the F1-B `enforceAppCheck: true` drops in
// functions/src/{auth/setClaims,audit/auditWrite,ratelimit/checkRateLimit,
// lifecycle/softDelete,backup/getDocumentSignedUrl,gdpr/gdprExportUser,
// gdpr/gdprEraseUser}.ts — need a manual deploy from an operator workstation.
//
// This script verifies the operator has firebase-tools + is authenticated +
// is targeting the right project, then runs the canonical deploy command.
// Mirrors scripts/admin-mfa-unenroll/run.js shape.
//
// ADC: operator runs `firebase login` first (NOT gcloud auth — firebase-tools
// uses its own credential store). The Cloud Build / WIF identity that CI
// uses for hosting + rules deploy does NOT have functions deploy rights;
// only operator-attached identities do.
//
// Usage:
//   node scripts/deploy-functions/run.mjs
//   node scripts/deploy-functions/run.mjs --dry-run     # print plan + exit
//   node scripts/deploy-functions/run.mjs --help        # print usage
//
// Exit codes:
//   0  deploy succeeded
//   1  precondition failed (firebase-tools missing, not logged in, etc.)
//   2  build step failed (TypeScript compile error in functions/)
//   3  deploy command failed

import { spawnSync } from "node:child_process";
import { argv, exit, cwd, chdir } from "node:process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ID = "bedeveloped-base-layers";
const DRY_RUN = argv.includes("--dry-run");
const HELP = argv.includes("--help") || argv.includes("-h");

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");

if (HELP) {
  console.log(`
Deploy Cloud Functions to Firebase project ${PROJECT_ID}.

Usage:
  node scripts/deploy-functions/run.mjs           # full deploy
  node scripts/deploy-functions/run.mjs --dry-run # print plan + exit
  node scripts/deploy-functions/run.mjs --help    # this message

Preconditions:
  - firebase-tools installed and on PATH (\`npm i -g firebase-tools\`)
  - Authenticated: \`firebase login\` (one-time)
  - Run from repo root OR scripts/deploy-functions/

CI does NOT deploy Functions (see .github/workflows/ci.yml D-8/D-9 substrate
gap). Use this script after any change to functions/src/**.
`);
  exit(0);
}

function step(label) {
  console.log(`\n→ ${label}`);
}

function fail(code, msg) {
  console.error(`\nFAILED: ${msg}`);
  exit(code);
}

function run(cmd, args, opts = {}) {
  // Use shell:true on Windows so .cmd shims (firebase.cmd, npm.cmd) resolve.
  const result = spawnSync(cmd, args, { stdio: "inherit", shell: true, ...opts });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

function runCapture(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: "utf8", shell: true });
  return {
    status: result.status ?? 1,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

// ── Step 1: cwd to repo root ────────────────────────────────────────
step("Setting working directory to repo root");
chdir(REPO_ROOT);
console.log(`  cwd = ${cwd()}`);

// ── Step 2: verify firebase-tools is on PATH ────────────────────────
step("Checking firebase-tools is installed");
const versionCheck = runCapture("firebase", ["--version"]);
if (versionCheck.status !== 0) {
  fail(
    1,
    "firebase-tools not found on PATH. Install with `npm i -g firebase-tools` then retry.",
  );
}
console.log(`  firebase-tools ${versionCheck.stdout}`);

// ── Step 3: verify authentication ───────────────────────────────────
step("Checking firebase authentication");
const loginCheck = runCapture("firebase", ["login:list"]);
if (loginCheck.status !== 0 || /No authorized accounts/i.test(loginCheck.stdout)) {
  fail(
    1,
    "No firebase login active. Run `firebase login` then retry. (firebase-tools uses its own credential store — `gcloud auth login` is NOT sufficient.)",
  );
}
console.log(`  ${loginCheck.stdout.split("\n")[0]}`);

// ── Step 4: verify functions/ workspace exists ──────────────────────
step("Verifying functions/ workspace");
const functionsDir = resolve(REPO_ROOT, "functions");
if (!existsSync(functionsDir)) {
  fail(1, `functions/ directory not found at ${functionsDir}`);
}
console.log(`  ${functionsDir} OK`);

// ── Step 5: build functions/ (typecheck + compile) ──────────────────
step("Building functions/ workspace (npm run build)");
if (DRY_RUN) {
  console.log("  [dry-run] would run: cd functions && npm ci && npm run build");
} else {
  const installStatus = run("npm", ["ci"], { cwd: functionsDir });
  if (installStatus !== 0) fail(2, "functions/ npm ci failed");
  const buildStatus = run("npm", ["run", "build"], { cwd: functionsDir });
  if (buildStatus !== 0) fail(2, "functions/ build failed (TypeScript compile error?)");
}

// ── Step 6: deploy ──────────────────────────────────────────────────
step(`Deploying functions to ${PROJECT_ID}`);
const deployArgs = ["deploy", "--only", "functions", "--project", PROJECT_ID];
if (DRY_RUN) {
  console.log(`  [dry-run] would run: firebase ${deployArgs.join(" ")}`);
  console.log("\nDry-run complete. Re-run without --dry-run to deploy for real.");
  exit(0);
}

const deployStatus = run("firebase", deployArgs);
if (deployStatus !== 0) {
  fail(
    3,
    "firebase deploy failed. Check the output above. Common causes: missing IAM permissions on the operator account, network errors, secret-manager permission denied.",
  );
}

console.log("\n✓ Deploy succeeded.");
console.log("\nNext: hard-reload baselayers.bedeveloped.com (Ctrl+Shift+R) in your incognito tab and re-test the first-run flow.");
