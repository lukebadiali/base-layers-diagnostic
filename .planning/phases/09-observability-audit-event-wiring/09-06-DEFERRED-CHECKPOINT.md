---
plan: 09-06 (bundled with 09-05 Task 3b)
status: code_and_docs_complete_operator_pending
deferred_to: single operator session (Hugh or Luke)
deferred_at: 2026-05-10
reason: |
  All Phase 9 code, tests, runbooks, and documentation are authored and
  committed across Waves 1-7. Production deployment of authAnomalyAlert +
  firestore.rules authFailureCounters block, end-to-end synthetic Slack
  verification, GCP-tier monitor provisioning evidence, and the Phase 9
  phase-close evidence sweep are operator-gated actions batched into ONE
  session to minimise context-switching.
  Mirrors the 08-06-DEFERRED-CHECKPOINT.md pattern (Phase 8 also deferred
  its production deploy + restore drill into a single operator session).
bundles:
  - "Plan 09-05 Task 3b: BLOCKING operator deploy checkpoint (Wave 6) — runbooks/phase-9-deploy-checkpoint.md Steps A-E"
  - "Plan 09-06 Task 4: Phase-close human-verify checkpoint (Wave 7) — evidence sweep + cleanup-ledger zero-out confirmation + /gsd-verify-work 9 (preferred)"
---

# 09-06 Operator Checkpoint — Phase 9 Production Deploy + Phase-Close Evidence Sweep

## What is code-complete and committed

All Phase 9 Cloud Functions, scripts, runbooks, tests, and documentation are authored, tested, and committed across Waves 1-7:

| Wave | Plan | Key deliverable | Tests |
|------|------|-----------------|-------|
| 1 | 09-01 | `src/observability/sentry.js` + shared `PII_KEYS` browser/node dictionary + Sentry boot in `src/main.js` + `runbooks/phase-9-sentry-bootstrap.md` | 22 (9 sentry-init + 7 pii-scrubber + parity gate + 2 functions sentry-scrub + 1 contract update) |
| 2 | 09-02 | `@sentry/vite-plugin@5.2.1` registered in `vite.config.js` + CI env wiring + `.map` deletion gate + `tests/build/source-map-gate.test.js` | 5 (source-map-gate static drift assertions) |
| 3 | 09-03a | `auditEventSchema` 28 → 61 enum extension + 4 server-side bare emit sites (setClaims + beforeUserSignedIn substrate + 3 lifecycle callables) | 25 (5 server audit-emit test files) |
| 4 | 09-03 | 9 client-side `.requested` emit sites (5 auth + 1 + 2 + 3 in cloud/*) + auth-audit-emit + audit-wiring matrix tests | 14 (auth-audit-emit + audit-wiring matrix) |
| 5 | 09-04 | `functions/src/observability/authAnomalyAlert.ts` (4 rules; 2 functional + 2 DORMANT) + `authFailureCounters/{ipHash}` Firestore rules + `scripts/test-slack-alert/run.js` + `.gitleaks.toml` Slack-URL regex | 10 (6 trigger behaviour + 4 rules-emulator cells) |
| 6 | 09-05 | `scripts/setup-uptime-check/run.js` + `scripts/setup-budget-alerts/run.js` + `runbooks/phase-9-monitors-bootstrap.md` (6 steps) + `runbooks/phase-9-deploy-checkpoint.md` (5 verification gates A/B/C/D/E) | 0 (runbooks + scripts only) |
| 7 | 09-06 | SECURITY.md +4 sections + 10-row Phase 9 Audit Index (DOC-10 increment) + REQUIREMENTS.md row updates + `runbooks/phase-9-cleanup-ledger.md` zero-out + CONTRIBUTING.md § Error Message Discipline | 0 (docs only) |

Total functions tests after Phase 9: 268+ (Phase 7 + 8 baseline 233 + 35 from Plan 09-01 + 09-03a + 09-04).

Documentation authored this wave (09-06):
- `SECURITY.md` — 4 new Phase 9 sections (§ Observability — Sentry + § Audit-Event Wiring (AUDIT-05) + § Anomaly Alerting (OBS-05) + § Out-of-band Monitors) + 10-row Phase 9 Audit Index (OBS-01..08 + AUDIT-05 + DOC-10)
- `.planning/REQUIREMENTS.md` — 8 OBS rows + AUDIT-05 row flipped to `[x]` / `[~]` with Validated 2026-05-10 + closure evidence + cross-references to this checkpoint
- `runbooks/phase-9-cleanup-ledger.md` — `phase_9_active_rows: 0` zero-out gate; 3 Phase 8 forward-tracking rows closed + 11 in-phase rows closed/carry-forward + 10 bounded carry-forward rows + 9 forward-tracking rows queued for Phase 10/11/12/v2
- `CONTRIBUTING.md` — § Error Message Discipline (Pitfall 8 — anti-pattern + compliant patterns + SignInError exemplar + quarterly audit row)

---

## Operator Action Plan — Single Session

Run in the order below. The ordering matters:
1. Pre-flight verification FIRST (secrets + SAs + sentry/monitors bootstrap runbooks complete)
2. Wave 5 Cloud Function deploy SECOND (`authAnomalyAlert` + `firestore.rules` `authFailureCounters` block)
3. Wave 6 verification gates THIRD (A/B/C/D/E per `runbooks/phase-9-deploy-checkpoint.md`)
4. Wave 7 phase-close evidence sweep FOURTH (cleanup ledger + REQUIREMENTS.md + SECURITY.md + tests)
5. `/gsd-verify-work 9` FIFTH (preferred — verifier agent walks must_haves across all 7 plans)
6. STATE.md + ROADMAP.md flip SIXTH (orchestrator handles after operator approval)

Estimated session time: 45-75 minutes (Wave 5 deploy + monitor provisioning + verification + sweep).

---

## Step 0 — Pre-Deploy Verification

### 0.1 Bootstrap runbooks complete

```bash
# runbooks/phase-9-sentry-bootstrap.md Cutover Log:
# Expected: 7 PASS rows (Sentry org + project + EU region + DSN + auth token + GitHub Actions secrets + 70% quota alert)

# runbooks/phase-9-monitors-bootstrap.md Cutover Log:
# Expected: 6 PASS rows (audit-alert-sa SA + SLACK_WEBHOOK_URL secret + SENTRY_DSN secret + uptime check + budget alerts + Sentry quota alert verified)
```

If either bootstrap runbook is incomplete, STOP — resolve the pre-condition before continuing.

### 0.2 Build + test confirmation

```bash
# Functions tests
cd functions && npm test -- --run 2>&1 | tail -10
# Expected: exit 0; Test Files X passed; total ≥ 268

# Root tests (incl. observability + audit-wiring)
cd .. && npm test -- --run 2>&1 | tail -10
# Expected: exit 0; observability + audit-wiring tests green

# Build
npm run build 2>&1 | tail -5
# Expected: exit 0; dist/ artefacts produced
```

### 0.3 Confirm SA + secrets exist

```bash
# audit-alert-sa SA exists
gcloud iam service-accounts list \
  --project=bedeveloped-base-layers \
  --format="value(email)" \
  | grep audit-alert-sa
# Expected: audit-alert-sa@bedeveloped-base-layers.iam.gserviceaccount.com

# SLACK_WEBHOOK_URL + SENTRY_DSN secrets exist
gcloud secrets list \
  --project=bedeveloped-base-layers \
  --format="value(name)" \
  | grep -E "(SLACK_WEBHOOK_URL|SENTRY_DSN)"
# Expected: 2 lines

# audit-alert-sa has secretAccessor on both
for secret in SLACK_WEBHOOK_URL SENTRY_DSN; do
  gcloud secrets get-iam-policy "$secret" \
    --project=bedeveloped-base-layers \
    --format=json \
    | grep "audit-alert-sa"
done
# Expected: 2 lines (one per secret)
```

If any check fails: complete `runbooks/phase-9-monitors-bootstrap.md` Steps 1-2 before proceeding to Step 1.

---

## Step 1 — Deploy `authAnomalyAlert` Cloud Function + `authFailureCounters` Rules

Follow `runbooks/phase-9-deploy-checkpoint.md` Step A in full. Summary:

```bash
# From repo root
firebase deploy --only \
  functions:authAnomalyAlert \
  --project=bedeveloped-base-layers
# Expected: authAnomalyAlert deployed in europe-west2 with audit-alert-sa SA

firebase deploy --only firestore:rules --project=bedeveloped-base-layers
# Expected: rules deployed with authFailureCounters match block
```

**Record evidence (paste into runbooks/phase-9-deploy-checkpoint.md Cutover Log row A):**

```
step_A_at: <ISO timestamp>
operator: <email>
function_deployed: authAnomalyAlert
function_state: <ACTIVE | FAIL>
gcloud_describe_sa: <paste audit-alert-sa@... from gcloud functions describe>
rules_version_in_console: <paste from Firebase Console → Firestore → Rules → History>
step_A_result: <PASS | FAIL — describe>
```

---

## Step 2 — Verify Function Active + SA Binding (Step B)

Follow `runbooks/phase-9-deploy-checkpoint.md` Step B:

```bash
gcloud functions describe authAnomalyAlert \
  --region=europe-west2 \
  --project=bedeveloped-base-layers \
  --format="value(serviceAccount,state)"
# Expected: audit-alert-sa@bedeveloped-base-layers.iam.gserviceaccount.com  ACTIVE
```

**Record evidence (Cutover Log row B):**

```
step_B_at: <ISO>
function_sa: <paste>
function_state: <ACTIVE | FAIL>
step_B_result: <PASS | FAIL>
```

---

## Step 3 — Synthetic Slack Alert Verification (Step C — OBS-05)

Follow `runbooks/phase-9-deploy-checkpoint.md` Step C:

```bash
SLACK_WEBHOOK_URL=$(gcloud secrets versions access latest \
  --secret=SLACK_WEBHOOK_URL \
  --project=bedeveloped-base-layers) \
  node scripts/test-slack-alert/run.js
# Expected: exit 0; Slack channel #ops-alerts receives the synthetic test message
```

**Operator captures:**

- Screenshot of Slack channel showing the synthetic message — save to `docs/evidence/phase-9-slack-synthetic-<date>.png` (Phase 11 evidence-pack-ready)

**Record evidence (Cutover Log row C):**

```
step_C_at: <ISO>
script_exit_code: <0 | non-zero>
slack_message_received: <YES | NO>
slack_screenshot_path: docs/evidence/phase-9-slack-synthetic-<date>.png
step_C_result: <PASS | FAIL>
```

---

## Step 4 — Rule 1 Auth-Fail Burst Test (Step D — EXPLICITLY DORMANT)

Follow `runbooks/phase-9-deploy-checkpoint.md` Step D. **Expected outcome at Phase 9 close: DORMANT** (passes by design — no rejection rule currently emits `auth.signin.failure`).

This step is run to confirm the substrate is wired correctly (no error on the trigger code) but NOT expected to produce a Slack alert in production today. The first rejection rule introduced in Phase 10+ will activate Rule 1.

**Record evidence (Cutover Log row D):**

```
step_D_at: <ISO>
step_D_result: DORMANT
step_D_rationale: |
  No rejection rule currently emits auth.signin.failure in production.
  beforeUserSignedIn substrate emits only on internal handler errors.
  Rule 1 (auth-fail burst) trigger code is functional and tested but the
  observation pipeline awaits an emission source. Substrate-honest disclosure
  per Pitfall 19. Re-run Step D when first rejection rule lands (Phase 10+).
```

---

## Step 5 — Cloud Console Screenshots (Step E — OBS-02 / OBS-04 / OBS-06 / OBS-07 / OBS-08)

Follow `runbooks/phase-9-deploy-checkpoint.md` Step E. Capture **5 screenshots** for the Phase 11 evidence pack:

1. **Sentry Console EU region** (OBS-02) — Settings → Organization → confirms project is in EU.
2. **Latest deploy log with source-map upload + .map gate OK** (OBS-04) — GitHub Actions run page for the deploy-to-main job; assert `[sentry-vite-plugin]` upload log lines + `Assert no .map files served from dist (OBS-04 / Pitfall 6)` step OK.
3. **GCP Cloud Console uptime checks** (OBS-06) — Monitoring → Uptime checks → `base-layers-diagnostic-prod` with 3 regions ACTIVE.
4. **GCP Cloud Console budgets** (OBS-07) — Billing → Budgets & alerts → £100 GBP budget with 50%/80%/100% thresholds.
5. **Sentry Console quota alert** (OBS-08) — Settings → Subscription → Usage Alerts → 70% threshold at 3500/5000 events/month.

Save to `docs/evidence/phase-9-{sentry-eu,source-map,uptime,budget,quota}-<date>.png` (Phase 11 DOC-09 evidence pack owner collates).

**Record evidence (Cutover Log row E):**

```
step_E_at: <ISO>
screenshot_obs_02_sentry_eu: <path | FAIL>
screenshot_obs_04_deploy_log: <path | FAIL>
screenshot_obs_06_uptime: <path | FAIL>
screenshot_obs_07_budget: <path | FAIL>
screenshot_obs_08_sentry_quota: <path | FAIL>
step_E_result: <PASS — 5 screenshots captured | FAIL — list missing>
```

---

## Step 6 — Source-Map Verification (curl probe — OBS-04)

```bash
# Confirm no .map served from production
curl -sI "https://baselayers.bedeveloped.com/main-<hash>.js.map"
# Expected: HTTP/2 404 (no .map served — hidden source maps invariant)

# Confirm gitleaks scan green
npx gitleaks detect --no-git --source . --config .gitleaks.toml --redact
# Expected: 0 leaks found (Plan 09-04 .gitleaks.toml slack-webhook-url rule active)
```

**Record evidence:**

```
step_6_curl_map_status: <404 | OTHER>
step_6_gitleaks_result: <0 leaks | NON-ZERO>
```

---

## Step 7 — Phase-Close Evidence Sweep (Plan 09-06 Task 4)

Operator final verification pass. Confirm ALL items before marking Phase 9 complete.

### 7.1 Code-health gates (all must exit 0)

```bash
npm test -- --run
(cd functions && npm test -- --run)
npm run test:rules
npm run lint && npm run typecheck
(cd functions && npm run lint && npm run typecheck)
npm run build
```

### 7.2 Documentation gates

```bash
# Cleanup ledger zero-out
grep "phase_9_active_rows: 0" runbooks/phase-9-cleanup-ledger.md
# Expected: phase_9_active_rows: 0

# SECURITY.md Phase 9 Audit Index
grep -c "Phase 9 Audit Index" SECURITY.md
# Expected: ≥ 2

# REQUIREMENTS.md Validated annotations
grep -c "Validated 2026-05-10" .planning/REQUIREMENTS.md
# Expected: ≥ 9 (8 OBS rows + AUDIT-05; plus pre-existing Phase 7 rows)

# CONTRIBUTING.md error-message section
grep "Error Message Discipline" CONTRIBUTING.md
# Expected: 1 match
```

### 7.3 `/gsd-verify-work 9` (preferred)

If available, the verifier agent walks the must_haves across all 7 plans + reports any gaps. Operator addresses missing items as a sub-wave 9.1 sub-plan if needed.

### 7.4 Sub-wave 9.1 fallback

If any verification fails, operator opens a sub-wave 9.1 sub-plan that targets the specific failure (e.g., "uptime check Slack alerting policy not yet wired — opening 9.1 sub-plan to add it"). Phase 9 does NOT close until either operator approval OR the sub-plan resolves.

---

## Step 8 — STATE.md + ROADMAP.md Flip

After all 7 steps above PASS, the orchestrator updates:

- `.planning/STATE.md` — Phase 9 status: COMPLETE; Current Position: Phase 10; Last updated: <date operator completes>
- `.planning/ROADMAP.md` — Phase 9 progress row: `0/0 | Not started` → `7/7 | Complete`

The orchestrator (`/gsd-execute-phase`) handles these updates; the operator confirms the pre-conditions are met.

**Close-gate sign-off record:**

```
close_gate_date: <YYYY-MM-DD>
operator: <email>
check_step_A_function_deployed: <PASS | FAIL>
check_step_B_sa_binding: <PASS | FAIL>
check_step_C_synthetic_slack: <PASS | FAIL>
check_step_D_dormant: <DORMANT | FAIL>
check_step_E_5_screenshots: <PASS — N screenshots | FAIL>
check_step_6_curl_gitleaks: <PASS | FAIL>
check_step_7_code_health: <6/6 green | FAIL>
check_step_7_docs: <PASS | FAIL>
check_step_7_verify_work: <PASS | gap — describe>
phase_9_status: <COMPLETE | BLOCKED — describe>
phase_10_unblocked: <YES | NO>
```

---

## Why Deferred (Not Blocked)

- Waves 1-7 (Plans 09-01 through 09-06) landed code + tests + scripts + runbooks + docs — no production deploys
- Production deploy of `authAnomalyAlert` + `firestore.rules` `authFailureCounters` block happens in Wave 6 (09-05) and is BLOCKING per the runbook's "Operator stop signal"
- Phase-close evidence sweep (Plan 09-06 Task 4) is the human-verify checkpoint that confirms the deployed system matches the documented controls
- Batching both into a single operator session reduces operator interrupts from 2 to 1 (mirrors Phase 8's 08-06-DEFERRED-CHECKPOINT.md pattern: 08-01 deferred + 08-05 SA provisioning + 08-06 deploy + drill = single session)
- This deferral does NOT violate any sequencing invariant — Phase 9 substrate is fully shipped + tested at the code level; only the production deploy + evidence-pack screenshots are operator-deferred

## Dependency Notes

- `runbooks/phase-9-sentry-bootstrap.md` Steps 1-7 (Sentry org + project + EU region + DSN + auth token + GitHub Actions secrets + 70% quota alert) MUST be complete before Step 0 above.
- `runbooks/phase-9-monitors-bootstrap.md` Steps 1-6 (`audit-alert-sa` SA + Secret Manager secrets + uptime check + budget alerts + Sentry quota alert verified) MUST be complete before Step 0 above.
- This checkpoint collates the BLOCKING Plan 09-05 Task 3b operator session + the Plan 09-06 Task 4 phase-close human-verify checkpoint into a single combined session.

## Resume Signal Contract

Operator types **"approved"** when:

- All 8 step rows above show PASS or DORMANT (Step D is DORMANT by design)
- All 6 code-health gates green
- Cleanup ledger `phase_9_active_rows: 0` confirmed
- 5 Cloud Console / Sentry / deploy-log screenshots captured at `docs/evidence/phase-9-*`
- Synthetic Slack alert received and screenshot captured
- gitleaks scan green (0 leaks)
- `/gsd-verify-work 9` (if run) returns 0 unresolved must_have failures

OR the operator types **failure-mode + sub-wave 9.1 sub-plan** if any verification fails. The phase does NOT close until either operator approval OR the sub-plan resolves.

## Forward-Tracking Carry-Forward Confirmation

At close-gate, operator confirms the 10 carry-forward rows in `runbooks/phase-9-cleanup-ledger.md` are bounded:

- Plan 09-05 Task 3b + Plan 09-06 Task 4 — closed by this session
- MFA emit-site wiring — bound to user-testing-phase dep landing
- `auth.signin.failure` substrate DORMANT — bound to first rejection rule
- Mirror-trigger collision verification — bound to Phase 10 synthetic-tests sub-wave
- Quarterly uptime-check cadence — recurring operator task (first Q3-2026)
- Sentry quota alert screenshot for docs/evidence — Phase 11 (DOC-09)
- `#ops-warn` vs `#ops-page` split — v2
- Sentry `tunnel` config — v2 (re-eval after Q1 metrics)
- CONTRIBUTING.md Pitfall 8 quarterly audit — recurring operator task (first Q3-2026)

All 10 are explicitly bounded; none block Phase 9 close.
