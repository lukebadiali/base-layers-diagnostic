---
status: partial
phase: 07-cloud-functions-app-check-trusted-server-layer
source: [07-03-PLAN.md, 07-03-SUMMARY.md, 07-05-PLAN.md, 07-05-SUMMARY.md, 07-06-PLAN.md, 07-06-SUMMARY.md]
started: 2026-05-09T22:07:51Z
updated: 2026-05-10 (Wave 6 close-gate — operator items unchanged from Wave 5; Tests 1-9 remain pending; Phase 7 close PASS-PARTIAL accepts substrate landed + Tests as queued; Tests 4-6 + 7-9 close at sub-wave 7.1 / Phase 8+ per cleanup-ledger)
---

## Current Test

[awaiting operator execution — Wave 3 substrate-honest deferrals + per-service enforcement stages]

## Tests

### 1. Wave 3 (07-03) Stage A — reCAPTCHA Enterprise site key + Firebase App Check enrolment (Console UI)

expected: Operator executes `runbooks/phase-7-app-check-rollout.md` §Stage A (A.1 + A.2 + A.3 + A.4); creates reCAPTCHA Enterprise site key in GCP Console at https://console.cloud.google.com/security/recaptcha?project=bedeveloped-base-layers (type Website, domains baselayers.bedeveloped.com + bedeveloped-base-layers.web.app + bedeveloped-base-layers.firebaseapp.com, score-based); registers it as the App Check provider for the Web app `1:76749944951:web:9d0db9603ecaa7cc5fee72` at https://console.firebase.google.com/project/bedeveloped-base-layers/appcheck/apps; generates a debug token via App Check Console -> Apps -> ⋮ -> Manage debug tokens; pastes both into operator's local `.env.local` (gitignored — verified via `git check-ignore .env.local` exit 0); fills `runbooks/phase-7-app-check-enforcement.md` Stage A evidence section with site_key_prefix + debug_token_prefix + registered_at + screenshot path showing Storage/Firestore/Functions toggles all in "Unenforced" state.

result: [pending]

why_human: Requires Firebase Console + GCP Console access as project owner `business@bedeveloped.com` — interactive Console UI navigation, secret key handling (debug token is one-time display), and per-environment debug token registration discipline. None can run non-interactively. Substrate-honest: Wave 3 commit 3bc2c6f shipped the body-filled `src/firebase/check.js` + the env-var contract in `.env.example` + the `vite.config.js` build-time guard — the production deploy will start emitting App Check tokens AS SOON AS this Console enrolment lands.

closes_substrate: Phase 4 cleanup-ledger forward-tracking row "src/firebase/check.js body fill" (Phase 4 D-07 + 07-PATTERNS.md Pattern E)

### 2. Wave 3 (07-03) Stage B — 70% quota alert config (GCP Console UI)

expected: Operator executes `runbooks/phase-7-app-check-rollout.md` §Stage B; creates an assessments quota alert at https://console.cloud.google.com/apis/api/recaptchaenterprise.googleapis.com/quotas?project=bedeveloped-base-layers with threshold 70% of 10k assessments/month; notification channel `business@bedeveloped.com`; runs synthetic alert test (or logs `synthetic_alert_test_result: deferred` if free-tier usage too low); fills `runbooks/phase-7-app-check-enforcement.md` Stage B evidence section.

result: [pending]

why_human: Requires GCP Console access. The bell-icon -> Create alert flow has no programmatic equivalent that fits this app's narrow IaC scope (Pattern 3 Stage B is canonical Firebase guidance — not a Cloud Functions / Terraform deliverable in this phase).

depends_on: Test 1 (Stage A) must land first — quota alert is configured against the registered API.

### 3. Wave 3 (07-03) Stage C — 7-day production soak start + daily verification

expected: Operator executes `runbooks/phase-7-app-check-rollout.md` §Stage C (C.2 Day-1 + C.3 Days 2-7 + C.4 Day-7 gate); confirms after each of 7 days that App Check dashboard verified-vs-unverified ratio is ≥95% with all enforcement toggles OFF; updates `runbooks/phase-7-app-check-enforcement.md` Stage C daily ratio log; captures Day-1 screenshot to `runbooks/evidence/phase-7-soak-day-1.png`; sets `soak_passed: YES` after Day-7 gate or investigates per Pitfall 1 (debug-token gaps in CI / staging / scratch projects).

result: [pending]

why_human: Requires Firebase Console dashboard inspection over 7+ consecutive days. Substrate-honest: Wave 3 ships the SDK that emits the tokens; the dashboard counts them. The 7-day window is calendar-pacing — no automation can compress it.

depends_on: Test 1 (Stage A) AND Test 2 (Stage B) — soak only meaningful after enrolment is live.

closes_roadmap_sc: Phase 7 SC#2 (the 7-day soak gate)

### 4. Wave 3 (07-03) Stage D — App Check enforcement on Storage (deferred Day 8+)

expected: Operator executes `runbooks/phase-7-app-check-rollout.md` §Stage D after Stage C `soak_passed: YES`; flips Cloud Storage for Firebase enforcement to "Enforced" via Firebase Console App Check page; runs upload smoke test from `baselayers.bedeveloped.com` (incognito + signed-in path) — confirms 200; runs failed-auth smoke (App Check debug token cleared) — confirms 401/403; captures screenshots; fills `runbooks/phase-7-app-check-enforcement.md` Stage D section.

result: [pending]

why_human: Firebase Console toggle + browser smoke from real client session. Lowest-blast-radius enforcement (Storage = uploads only) — first stage where App Check actually denies traffic.

depends_on: Test 3 (Stage C soak passed)

### 5. Wave 3 (07-03) Stage E — App Check enforcement on Firestore (collection-by-collection, Day 9+)

expected: Operator executes `runbooks/phase-7-app-check-rollout.md` §Stage E in the verbatim collection order: `auditLog -> internalAllowlist -> softDeleted -> messages -> comments -> documents -> responses -> actions`; flips enforcement per collection (or service-wide with per-collection smoke order if Console UI lacks per-collection granularity at execution time — runbook handles both); waits ≥1 hour between collections; runs read+write smoke + no-token denial smoke per collection; fills `runbooks/phase-7-app-check-enforcement.md` Stage E table per collection.

result: [pending]

why_human: Highest-blast-radius service. Firebase Console UI + browser smoke; per-collection rollback flexibility is the load-bearing design choice (07-RESEARCH.md Pattern 3).

depends_on: Test 4 (Stage D Storage enforcement) — Storage smoke confirms the verified-ratio measurement actually translates to enforcement-passes before flipping the higher-volume Firestore collections.

### 6. Wave 3 (07-03) Stage F — App Check enforcement on Cloud Functions (Day 14+)

expected: Operator executes `runbooks/phase-7-app-check-rollout.md` §Stage F after Stages A-E all `PASS`; verifies all 4 callables (`setClaims`, `auditWrite`, `softDelete`, `gdprExportUser`) declare `enforceAppCheck: true` via `grep -rn "enforceAppCheck" functions/src/`; flips Cloud Functions enforcement; runs callable smoke per callable from real client session — confirms 200; runs no-token callable smoke — confirms `unauthenticated` HttpsError; fills `runbooks/phase-7-app-check-enforcement.md` Stage F section.

result: [pending]

why_human: Firebase Console toggle + per-callable smoke. Final stage; closes the App Check rollout end-to-end.

depends_on: Test 5 (Stage E Firestore enforcement complete for all 8 collections)

closes_roadmap_sc: Phase 7 SC#2 (full per-service enforcement landed)

### 7. Wave 5 (07-05) — BigQuery audit sink bootstrap script run + T+1h verification

expected: Operator runs `gcloud auth application-default login` (Pitfall 13 — no SA JSON in repo); runs `node scripts/enable-bigquery-audit-sink/run.js --project=bedeveloped-base-layers`; script exits 0 with summary table showing dataset created in europe-west2 with default_table_expiration=220752000s (7 years), sink `audit-logs-bq` created with `--use-partitioned-tables`, sink writer SA bound to `roles/bigquery.dataEditor`. Operator pastes the run output into `runbooks/phase-7-bigquery-sink-bootstrap.md` Run evidence section. At T+1h, operator runs the verification BQ query (`SELECT COUNT(*) FROM cloudaudit_googleapis_com_data_access_*`) and confirms `row_count > 0`; pastes result into the runbook Verification section; gate result PASS.

result: [pending]

why_human: Requires operator ADC + project IAM admin role; calls `gcloud projects set-iam-policy` (auditConfigs merge) + `bq mk` + `gcloud logging sinks create`. Substrate-honest: Wave 5 ships the script + runbook; the actual run requires operator presence at the local CLI with valid ADC token.

closes_substrate: AUDIT-03 + AUDIT-06 (infrastructure-tier audit log; Pitfall 17 closure)

closes_roadmap_sc: Phase 7 SC#4 (BigQuery sink + 7y retention live; T+1h verification confirms ingest)

### 8. Wave 5 (07-05) — Admin dataViewer bindings on BigQuery dataset

expected: Operator lists internalAllowlist `role:"admin"` emails (Firebase Console -> Firestore -> internalAllowlist filter); for each admin email runs `gcloud projects add-iam-policy-binding bedeveloped-base-layers --member=user:<email> --role=roles/bigquery.dataViewer`; updates `runbooks/phase-7-bigquery-sink-bootstrap.md` "Admin dataViewer bindings" section with bound emails + timestamps + total count.

result: [pending]

why_human: Operator-paced Firestore inspection + per-email IAM binding; the script intentionally does not pull firebase-admin as a dep (mirrors `scripts/provision-function-sas` shell-out-only pattern).

depends_on: Test 7 (sink bootstrap script run + verification PASS)

closes_threat: T-07-05-02 mitigation (BigQuery audit data accessed only by authorised reviewers)

### 9. Wave 5 (07-05) — D-22 ToS gate resolution (operator Console click — DEFERRED to sub-wave 7.1)

expected: Operator visits https://console.cloud.google.com/apis/library/firebaseauth.googleapis.com?project=bedeveloped-base-layers; clicks Enable; accepts ToS as `business@bedeveloped.com` Workspace admin; waits ~30s for `gcp-sa-firebaseauth` SA auto-provisioning; runs verification gcloud commands documented in `runbooks/phase-7-d22-tos-gate-resolution.md` "Resolution path" section; rebinds the SA to `roles/run.invoker` on the 4 Cloud Run services; re-PATCHes IdP `blockingFunctions.triggers` to restore the 4 verified URLs preserved in `06-PREFLIGHT.md ## Cutover Log`. Once D-22 resolved, sub-wave 7.1 lands the deferred Wave 5 Task 5 work (minInstances:1 restoration + cold-start p99 measurement).

result: [pending — Wave 5 selected Branch B substrate-honest fallback]

why_human: Requires Workspace admin role on `business@bedeveloped.com`; ToS acceptance click is not programmatically scriptable; gcloud SDK ADC + project IAM admin needed for SA invoker rebinding.

closes_substrate: Phase 6 sub-wave 6.1 row "D-22 ToS gate" + Phase 7 sub-wave 7.1 carry-forward row (minInstances + cold-start p99)

closes_roadmap_sc: Phase 7 SC#6 (deferred from Wave 5 to sub-wave 7.1 per Branch B selection)

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps

- All 9 tests are operator-execution. Phase 7 Wave 6 cleanup-ledger close gate (07-06) accepts `PASS-PARTIAL` for Phase 7 close when:
  - Test 1 (Stage A) + Test 2 (Stage B) + Test 3 (Stage C) all `PASS` AND
  - Tests 4 + 5 + 6 (Stages D / E / F) `PENDING-OPERATOR-EXECUTION` AND
  - Tests 7 + 8 (BigQuery sink + dataViewer bindings) `PENDING-OPERATOR-EXECUTION` AND
  - Test 9 (D-22 ToS gate) `PENDING-OPERATOR-EXECUTION` carrying to sub-wave 7.1 (Branch B selection).
- Full `PASS` (zero pending rows) requires operator to flip Stages D + E + F per their schedule (Day 8+ to Day 14+ window in `runbooks/phase-7-app-check-rollout.md` §Stage Table) AND run BigQuery sink bootstrap + dataViewer bindings AND resolve D-22 ToS gate (sub-wave 7.1).
- This file mirrors the Phase 3 `03-HUMAN-UAT.md` and Phase 6 `06-HUMAN-UAT.md` deferred-operator-execution shape — the standard pattern for operator-paced Console-UI work that Claude cannot execute non-interactively.
