---
phase: 09-observability-audit-event-wiring
plan: 05
subsystem: observability
tags: [observability, monitors, operator-runbook, gcp, sentry, slack]
status: tasks_1_2_3a_complete_checkpoint_pending_3b
requirements: [OBS-04, OBS-06, OBS-07, OBS-08]
dependency_graph:
  requires:
    - 09-observability-audit-event-wiring/09-04 (authAnomalyAlert + counter rules + Slack synthetic + gitleaks)
    - 09-observability-audit-event-wiring/09-01 (Sentry init substrate)
    - 07-firestore-cloud-functions (scripts/provision-function-sas/run.js — Pattern E SA provisioner)
    - 08-data-lifecycle-soft-delete-gdpr-backups (scripts/setup-backup-bucket/run.js — gcloud shell-out idempotency analog)
  provides:
    - "scripts/setup-uptime-check/run.js (idempotent gcloud monitoring uptime create wrapper)"
    - "scripts/setup-budget-alerts/run.js (idempotent gcloud billing budgets create wrapper)"
    - "runbooks/phase-9-monitors-bootstrap.md (operator runbook — 6 steps for OBS-04/06/07/08 bootstrap)"
    - "runbooks/phase-9-deploy-checkpoint.md (operator runbook — Wave 5 + Wave 6 deploy-day procedure)"
    - "Operator stop signal for Phase 9 close — 5 verification gates (A,B,C,E PASS + D DORMANT) before Plan 09-06 can begin"
  affects:
    - "Plan 09-06 (Wave 7) — consumes the Cutover Log evidence from Step E for SECURITY.md § Observability and cleanup-ledger zero-out"
    - "Phase 11 evidence pack — 4 screenshots at docs/evidence/phase-9-* anchor Phase 9 OBS-04/05/06/07/08 traceability"
tech-stack:
  added: []  # no new dependencies — both scripts use node:child_process.spawnSync (stdlib) only
  patterns:
    - "Pattern E (Phase 7 + Phase 8 analog): idempotent operator script via child_process.spawnSync('gcloud', ...) with describe-first-then-create flow"
    - "Pitfall 13 substrate: ADC only; no service-account JSON in source"
    - "Pitfall 19 substrate-honest disclosure: 3-region minimum (uptime) + alerts-notify-only (budget) surfaced in scripts AND runbooks"
key-files:
  created:
    - "scripts/setup-uptime-check/run.js"
    - "scripts/setup-uptime-check/README.md"
    - "scripts/setup-budget-alerts/run.js"
    - "scripts/setup-budget-alerts/README.md"
    - "runbooks/phase-9-monitors-bootstrap.md"
    - "runbooks/phase-9-deploy-checkpoint.md"
  modified: []
decisions:
  - "D-09-07: uptime check uses 3 regions (USA,EUROPE,ASIA_PACIFIC), not 2. gcloud --regions minimum is 3 (per 09-RESEARCH.md §Pattern 7 line 670); OBS-06 calls for ≥2; we exceed both. Surfaced in script README + monitors-bootstrap runbook Step 3."
  - "D-09-08: budget alerts NOTIFY only — they do NOT cap spend. Auto-disable via Pub/Sub-driven Cloud Function (Firebase 'avoid-surprise-bills' pattern) is v2 — OUT OF SCOPE for Phase 9. Surfaced in 3 places: scripts/setup-budget-alerts/run.js banner + README Limitations section + monitors-bootstrap runbook Step 4 substrate-honest disclosure."
  - "D-09-09: runbook AUTHORING (autonomous, Claude-doable) split from runbook EXECUTION (checkpoint, operator-only) per planner WARNING 6. Task 3a authored runbooks/phase-9-deploy-checkpoint.md autonomously; Task 3b is the BLOCKING operator checkpoint that fills the runbook's Cutover Log."
  - "D-09-10 (implicit): audit-alert-sa SA roles are roles/datastore.user + roles/datastore.viewer at the project level; roles/secretmanager.secretAccessor is granted on individual secrets (SLACK_WEBHOOK_URL, SENTRY_DSN) — NOT project-wide. Phase 7 minimal-IAM principle preserved."
  - "D-09-11 (implicit): SLACK_WEBHOOK_URL + SENTRY_DSN live in GCP Secret Manager, NOT GitHub Actions secrets. CI/build jobs never need them — only the authAnomalyAlert Cloud Function reads them via defineSecret() at invocation. Wave 1 runbook (Sentry bootstrap) explicitly excluded them from GitHub secrets for this reason."
metrics:
  duration_minutes: ~25  # Tasks 1, 2, 3a authoring only — Task 3b (operator) is the multi-hour out-of-band deploy session
  tasks_completed: 3  # Tasks 1, 2, 3a — Task 3b is checkpoint-pending (operator)
  tasks_total: 4
  files_created: 6
  lines_added: ~1700  # 4 script files (~780) + 2 runbook files (~960)
  test_count_delta: 0  # No new tests — Wave 6 ships operator scripts + runbooks; tests landed in Plan 09-04 Wave 5
  commits: [71e7d1b, 8088557, bc79fbb]
completed_date: "2026-05-10 (Tasks 1, 2, 3a; Task 3b operator-pending)"
---

# Phase 09 Plan 05: Wave 6 — GCP-Tier Monitors + Deploy-Day Operator Runbooks Summary

Substrate for Phase 9 Wave 6: 2 idempotent operator scripts (uptime check provisioner + budget-alert provisioner) and 2 operator runbooks (monitors-bootstrap covering 6 steps for OBS-04/06/07/08 + deploy-checkpoint covering the Wave 5 + Wave 6 deploy-day single-session procedure with 5 verification gates A,B,C,D,E where D is DORMANT). Tasks 1, 2, 3a are complete and committed. **Task 3b (BLOCKING operator checkpoint) remains.**

---

## What landed

### Task 1 — Operator scripts (commit `71e7d1b`)

**`scripts/setup-uptime-check/run.js` (~248 lines, 8.3 KB)**

Idempotent Node script that shells out to `gcloud monitoring uptime create base-layers-diagnostic-prod` with:

- `--resource-type=uptime-url`
- `--resource-labels=host=baselayers.bedeveloped.com,project_id=bedeveloped-base-layers`
- `--protocol=https --request-method=get --path=/`
- `--period=60s --timeout=10s`
- `--regions=USA,EUROPE,ASIA_PACIFIC` (3 regions — gcloud minimum; OBS-06 calls for ≥2)
- `--project=bedeveloped-base-layers`

Idempotency: lists existing checks via `gcloud monitoring uptime list-configs` (with fallback to `gcloud monitoring uptime list` for older gcloud versions); if `base-layers-diagnostic-prod` exists, logs `[SKIP]` and exits 0. Supports `--dry-run` and `--project=<id>` overrides.

**`scripts/setup-uptime-check/README.md` (~5 KB)** — Prerequisites, Usage, Flags table, What the script does table, Configuration (hardcoded values), Why 3 regions (not 2) substrate-honest disclosure, Alerting policy operator-paced step, Expected output samples, Cross-reference to monitors-bootstrap runbook, Citations.

**`scripts/setup-budget-alerts/run.js` (~265 lines, 10 KB)**

Idempotent Node script that shells out to `gcloud billing budgets create` with:

- `--billing-account=<resolved via gcloud billing projects describe>`
- `--display-name=base-layers-monthly`
- `--budget-amount=100GBP` (BUDGET_AMOUNT + BUDGET_CURRENCY env overrides supported)
- 3 threshold rules: `percent=0.5`, `percent=0.8`, `percent=1.0`
- `--filter-projects=projects/bedeveloped-base-layers`

Idempotency: lists existing budgets via `gcloud billing budgets list --billing-account=$BA`; if `base-layers-monthly` exists, logs `[SKIP]` and exits 0. Supports `--dry-run`. Banner prints the substrate-honest "alerts NOTIFY only; do NOT cap spend" disclosure before any work begins.

**`scripts/setup-budget-alerts/README.md` (~6.6 KB)** — Includes a dedicated "Limitations — read this first" section reproducing the Pitfall 19 disclosure verbatim.

**Verification:** `node -c scripts/setup-uptime-check/run.js && node -c scripts/setup-budget-alerts/run.js` both exit 0 — no syntax errors. Both READMEs present.

### Task 2 — `runbooks/phase-9-monitors-bootstrap.md` (commit `8088557`, ~20 KB, 518 lines)

Single-operator-session runbook covering the 5 bootstrap steps + verification gate + output handoff for OBS-04/06/07/08:

- **Step 1** — provision `audit-alert-sa` via Phase 7 `scripts/provision-function-sas/run.js` (instructs operator to add `audit-alert-sa` block to `TARGET_SAS` array if missing; roles = `datastore.user` + `datastore.viewer`; secretAccessor bound on individual secrets in Step 2, NOT project-wide).
- **Step 2** — create `SLACK_WEBHOOK_URL` + `SENTRY_DSN` secrets in Secret Manager via stdin pipe (`printf "%s" "..." | gcloud secrets create --data-file=-`); bind `audit-alert-sa` as `secretAccessor` on both; verify both retrievable.
- **Step 3** — run `scripts/setup-uptime-check/run.js` for OBS-06; configure alerting policy to Slack via Cloud Console UI (gcloud alerting-policy YAML/MQL too messy to script).
- **Step 4** — run `scripts/setup-budget-alerts/run.js` for OBS-07 with substrate-honest disclosure that alerts NOTIFY only and v2 auto-cutoff is out of scope; same disclosure copies to SECURITY.md in Wave 7.
- **Step 5** — configure Sentry 70% quota alert in Web UI (OBS-08); duplicates Wave 1 runbook Step 6 for single-session flow; documents Spike Protection fallback if 70% threshold UI is absent.
- **Step 6** — verification gate (5 gcloud commands confirming each artefact in the expected state).
- **Step 7** — output handoff: rolls evidence forward into `runbooks/phase-9-deploy-checkpoint.md` Cutover Log (this runbook deliberately has no own Cutover Log — avoids the two-log-split problem where partial state ends up in different files).

Additionally: Troubleshooting table (6 rows), Rollback procedure (4 commands), Citations.

**Verification:** `grep -cE "OBS-06|OBS-07|OBS-08|audit-alert-sa|SLACK_WEBHOOK_URL|SENTRY_DSN" runbooks/phase-9-monitors-bootstrap.md` returns 54 matches (threshold ≥ 1 per VALIDATION.md).

### Task 3a — `runbooks/phase-9-deploy-checkpoint.md` (commit `bc79fbb`, ~18 KB, 439 lines)

Single-session deploy-day runbook that closes Wave 5 + Wave 6 simultaneously:

- **Pre-flight checklist** — 7 boxes confirming both bootstrap runbooks complete + `firebase login` authenticated + working tree clean + functions test suite green (268/268 from Plan 09-04).
- **Step A** — `firebase deploy --only functions:authAnomalyAlert`; verify SA via `gcloud functions describe`; Pitfall 8 selective-deploy reminder (re-deploy `auditWrite` only if its SA drift detected).
- **Step B** — `firebase deploy --only firestore:rules`; Cloud Console diff confirms `authFailureCounters` block; sanity-test rules suite locally.
- **Step C** — `scripts/test-slack-alert/run.js` end-to-end (OBS-05 close-gate); operator confirms Slack reception + saves screenshot to `docs/evidence/phase-9-obs-05-synthetic-alert.png`.
- **Step D** — DORMANT — defer. Documented rationale: Rule 1 functionally correct (proven by 6 trigger unit tests in Plan 09-04) but production emit source absent (beforeUserSignedIn has zero rejection rules emitting `auth.signin.failure` today). Forward-tracking row queued: "Re-run when first rejection rule lands."
- **Step E** — Cloud Console smoke checks for uptime / budget / Sentry quota (OBS-06/07/08 close-gates); 3 screenshots saved.
- **Cutover Log** — 5-row table with operator-fill `{{ T+? }}` placeholders (Pitfall 19 substrate-honest — false timestamps would violate compliance credibility). Row D explicitly marked `DORMANT — defer`.
- **Rollback procedure** — per-step (git revert for deploy regressions; alternative quick-disable via Cloud Console).
- **Operator stop signal** — BLOCKING for Phase 9 close; operator returns the resume signal to the spawning agent once all 5 rows complete.

**Verification:** `grep -cE "Cutover Log|audit-alert-sa|DORMANT" runbooks/phase-9-deploy-checkpoint.md` returns 29 matches (threshold ≥ 1 per VALIDATION.md).

### Task 3b — BLOCKING operator checkpoint (PENDING)

**Status: awaiting operator session.** This task is a `checkpoint:human-action` gate — not executed by Claude. The operator follows `runbooks/phase-9-deploy-checkpoint.md` Steps A through E and records evidence in the Cutover Log. The Phase 9 close-gate cannot advance until Rows A, B, C, E read PASS and Row D reads `DORMANT — defer`.

---

## Deviations from Plan

**None.** Plan executed exactly as written for Tasks 1, 2, 3a.

The plan explicitly anticipated the autonomous/checkpoint split via D-09-09 (planner WARNING 6 fix): Task 3a authors the runbook autonomously; Task 3b is the operator checkpoint that fills the runbook's Cutover Log. This worked as designed — Tasks 1, 2, 3a landed without operator input or auto-fixes; Task 3b is correctly held for the operator session.

The `must_haves.truths` block from the plan front-matter is fully satisfied by the artefacts:

- ✓ `scripts/setup-uptime-check/run.js` shells out to `gcloud monitoring uptime create` with regions=USA,EUROPE,ASIA_PACIFIC and period=60s
- ✓ `scripts/setup-budget-alerts/run.js` shells out to `gcloud billing budgets create` with thresholds 0.5/0.8/1.0 of monthly amount
- ✓ `runbooks/phase-9-monitors-bootstrap.md` documents the operator-paced steps: provision audit-alert-sa, run setup-uptime-check, run setup-budget-alerts, configure Sentry 70% quota alert (5 steps total — runbook adds Step 2 secrets + Step 6 verification gate beyond the plan's "4 steps" framing)
- ✓ `runbooks/phase-9-deploy-checkpoint.md` captures the single-session deploy procedure: secrets set in Secret Manager, deploy authAnomalyAlert, run `scripts/test-slack-alert/run.js`, verify Slack receipt
- ⏳ Operator close-gate (the `truths` row #5) — PENDING Task 3b operator session

---

## Authentication gates

**None.** Tasks 1, 2, 3a were autonomous file-authoring work — no external auth required.

Task 3b will have multiple authentication touchpoints during the operator session: `gcloud auth login`, `firebase login`, Sentry web UI session, Slack admin to mint the webhook. None of those happen in this summary's scope.

---

## Known Stubs

**None.** Both scripts are complete operator-runnable code; both runbooks are complete operator-readable procedures with explicit `{{ T+? }}` operator-fill markers (matching the Pitfall 19 substrate-honest convention — placeholder timestamps that persist until the operator session executes the procedure are the audit trail, not a stub).

---

## Threat Flags

None — no new security-relevant surface beyond what the plan's `<threat_model>` already covers (T-9-05-1 through T-9-05-6). The 6 mitigations declared in the plan's threat register are all satisfied by the artefacts:

- **T-9-05-1 (E)** — `audit-alert-sa` IAM scoped to `datastore.user` + `datastore.viewer` + per-secret `secretAccessor` (NOT project-wide Editor). Documented in monitors-bootstrap Step 1 + Step 2.3.
- **T-9-05-2 (T)** — runbook Step 2.2 uses `printf "%s" "..." | gcloud secrets create --data-file=-` stdin pipe pattern (never command-line args; never committed). `.gitleaks.toml` slack-webhook-url regex landed in Plan 09-04 Task 4 is the defence-in-depth backstop.
- **T-9-05-3 (I)** — runbook Step 4 documents that budget notifications go to operator email; forward-tracking row queued for Wave 7 to consider Pub/Sub + Slack channel routing as ops capacity grows.
- **T-9-05-4 (D)** — script README documents the `BUDGET_AMOUNT` env override; default £100 is high enough that PR-test traffic does NOT trip 50%; operator can lower with env override for early hardening.
- **T-9-05-5 (T)** — quarterly uptime-check verification cadence is in the deploy-checkpoint runbook's "Forward-tracking rows queued for Wave 7" section.
- **T-9-05-6 (I)** — "alerts NOTIFY only" Pitfall 19 disclosure is in 3 places: script banner, script README "Limitations" section, monitors-bootstrap runbook Step 4. Wave 7 SECURITY.md will copy verbatim.

---

## TDD Gate Compliance

**N/A — Plan 09-05 is type `execute`, not `tdd`.** Wave 6 ships operator scripts + runbooks; production code + tests for the trigger (`authAnomalyAlert`) landed in Plan 09-04 Wave 5 (which followed TDD via the wave-of-build pattern — see Plan 09-04 SUMMARY).

The plan-level TDD gate enforcement guidance (RED/GREEN/REFACTOR) does not apply to Plan 09-05.

---

## Self-Check: PASSED

- ✓ FOUND: scripts/setup-uptime-check/run.js (8276 bytes)
- ✓ FOUND: scripts/setup-uptime-check/README.md (5010 bytes)
- ✓ FOUND: scripts/setup-budget-alerts/run.js (9989 bytes)
- ✓ FOUND: scripts/setup-budget-alerts/README.md (6751 bytes)
- ✓ FOUND: runbooks/phase-9-monitors-bootstrap.md (20679 bytes)
- ✓ FOUND: runbooks/phase-9-deploy-checkpoint.md (18297 bytes)
- ✓ FOUND: commit 71e7d1b (Task 1 — operator scripts)
- ✓ FOUND: commit 8088557 (Task 2 — monitors-bootstrap runbook)
- ✓ FOUND: commit bc79fbb (Task 3a — deploy-checkpoint runbook)
- ✓ `node -c scripts/setup-uptime-check/run.js` exits 0
- ✓ `node -c scripts/setup-budget-alerts/run.js` exits 0
- ✓ `grep -cE "OBS-06|OBS-07|OBS-08|audit-alert-sa" runbooks/phase-9-monitors-bootstrap.md` ≥ 1 (54 matches)
- ✓ `grep -cE "Cutover Log|audit-alert-sa|DORMANT" runbooks/phase-9-deploy-checkpoint.md` ≥ 1 (29 matches)
- ⏳ PENDING (Task 3b — operator session): Cutover Log filled with PASS rows for A/B/C/E + DORMANT row for D.

---

## Next steps

**Task 3b operator session** — operator opens `runbooks/phase-9-deploy-checkpoint.md` and walks through Steps A through E in a single ~30-45 minute session. The resume signal contract is in the runbook's "Operator stop signal" section. Once the operator returns "approved" with the minimum evidence (commit hashes, timestamps, screenshot paths), Phase 9 advances to Plan 09-06 (Wave 7 — cleanup ledger zero-out + DOC-10 SECURITY.md sections + REQUIREMENTS.md row updates).

**If Task 3b operator session fails any gate** — the failure is re-planned as sub-wave 9.1; the deploy-checkpoint runbook's Rollback procedure section documents the per-step rollback.
