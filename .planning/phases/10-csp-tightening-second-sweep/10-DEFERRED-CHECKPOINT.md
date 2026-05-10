---
plan: 10-05 (bundles 10-03 Task 2 + 10-04 Task 2 + 10-05 Task 2 + 10-05 Task 4)
status: code_and_docs_complete_operator_pending
deferred_to: single operator session (Hugh or Luke)
deferred_at: 2026-05-10
reason: |
  All Phase 10 code, schema tests, runbooks, and documentation are
  authored and committed across Waves 1-5. Production deploy of the
  tightened CSP-RO (Stage B) + 7-day Cloud Logging soak + single-knob
  enforcement flip + 5-target smoke matrix + hstspreload.org submission
  + securityheaders.com A+ rating capture + 7-day post-enforcement soak
  + phase-close human-verify are operator-gated actions batched into
  ONE session to minimise context-switching.
  Mirrors the 08-06-DEFERRED-CHECKPOINT.md + 09-06-DEFERRED-CHECKPOINT.md
  pattern (Phase 8 + Phase 9 both deferred their production deploy +
  evidence-pack capture + phase-close human-verify into a single
  operator session).
  Calendar pacing within the session: Stage B 7-day soak + post-enforcement
  7-day soak each add 7+ calendar days; in practice this is NOT a single
  ~45-minute session — it is a 14+ day calendar window with three
  operator touchpoints (Stage B deploy day / enforcement-flip day / HSTS
  submission day + close-gate day). The "single combined session"
  framing means a single deferred-operator-action document gates Phase 10
  close (not four separate documents).
bundles:
  - "Plan 10-03 Task 2: BLOCKING operator deploy + Stage B 7-day Cloud Logging soak — runbooks/phase-10-csp-soak-bootstrap.md Steps 1-4 + 10-PREFLIGHT.md Soak Log Cycle 1"
  - "Plan 10-04 Task 2: BLOCKING single-knob enforcement flip + 5-target smoke matrix — runbooks/csp-enforcement-cutover.md Prerequisites + Pre-cutover Smoke + Cutover Steps 1-7 + Cutover Log rows A/B/C"
  - "Plan 10-05 Task 2: BLOCKING hstspreload.org submission + securityheaders.com A+ rating capture + 7-day post-enforcement soak — runbooks/hsts-preload-submission.md Steps 1-4 + 10-PREFLIGHT.md Cutover Log rows D/E"
  - "Plan 10-05 Task 4: Phase-close human-verify checkpoint — evidence sweep + cleanup-ledger zero-out confirmation + /gsd-verify-work 10 (preferred)"
---

# 10-05 Operator Checkpoint — Phase 10 Stage B Soak + Enforcement Flip + HSTS Submission + Phase-Close Evidence Sweep

## What is code-and-docs complete and committed

All Phase 10 schema tests, runbooks, and documentation are authored, tested, and committed across Waves 1-5:

| Wave | Plan | Key deliverable | Tests / Commits |
|------|------|-----------------|-----------------|
| 1 | 10-01 | 162 static `style="..."` h()-attrs in `src/main.js` migrated to a Wave 1 utility-class block in `styles.css` (104 named classes — 24 atom `.u-*` + ~80 semantic compound classes); cache-buster `?v=52` → `?v=53` on 3 sites; 3 view snapshots updated | 478/478 vitest green; commits `89b1140` (utility-class block) + `ec0afa7` (migration + cache-buster + snapshots) |
| 2 | 10-02 | `firebase.json` CSP-RO directive value tightened in three surgical edits (style-src `'self'` only / connect-src + `https://de.sentry.io` / frame-src `'self'`); header KEY remains `Content-Security-Policy-Report-Only` (Wave 4 owns the flip per Pitfall 16 Stage B); `tests/firebase-config.test.js` + 6 Phase 10 schema assertions in new describe block | firebase-config 18→24 cases all green; root suite 478→484 / 484 green; commits `523e47e` (CSP-RO directive tighten) + `24f8a7c` (schema-test extension) |
| 3 | 10-03 | `runbooks/phase-10-csp-soak-bootstrap.md` (308 lines): operator runbook for selective hosting deploy + 7-day Stage B Cloud Logging soak — Pre-conditions 8-item checklist + Step 1 `firebase deploy --only hosting` with Pitfall 8 explicit forbidden-deploys list + Step 2 curl header verification + Step 3 ×7 daily Cloud Logging filter + Step 4 Day 7 binary CLEAN/RESTART decision gate + Failure-Mode Triage 4-row decision-tree + Cycle-N Soak Log convention; `.planning/phases/10-csp-tightening-second-sweep/10-PREFLIGHT.md` (138 lines) operator-fill audit log skeleton | firebase-config 24/24 green sanity; commit `ebd6c5d` (Plan 10-03 Task 1 autonomous portion) |
| 4 | 10-04 | `runbooks/csp-enforcement-cutover.md` (302 lines): Wave 4 single-knob enforcement-flip operator runbook — Prerequisites + Pre-cutover Smoke + Cutover Steps 1-7 + Cutover Log paste-ready template rows A-E + single-knob Rollback Procedure (~5 min) + Post-deploy 7-day soak forward to Plan 10-05; `tests/firebase-config.test.js` pre-staged `describe.skip` block with 6 enforced-shape assertions awaiting Task 2 un-skip | 24 passed | 6 skipped (30); commit `def252e` (Plan 10-04 Task 1 autonomous portion) |
| 5 | 10-05 | `runbooks/hsts-preload-submission.md` (~190 lines): hstspreload.org operator runbook — Pre-conditions + Step 1 verify live HSTS header + Step 2 apex-vs-subdomain decision tree + Step 3 submission + Step 4 same-session JSON status verification + Step 5 calendar-deferred listing-status re-check + 3-row Cutover Log; `SECURITY.md` Phase 10 DOC-10 increment (§ CSP Report-Only REPLACED by § CSP enforced + new § HSTS Preload Status + new § Phase 10 Audit Index 3-row Pattern G table + § Phase 3 Audit Index maintenance annotations); `.planning/REQUIREMENTS.md` HOST-06 + HOST-07 flipped `[x]` substrate-complete + DOC-10 Phase 10 Wave 5 increment annotation + Traceability table update; `runbooks/phase-10-cleanup-ledger.md` `phase_10_active_rows: 0` zero-out gate (1 Phase 4 row CLOSED + 1 Phase 6/7 row CLOSED + 11 in-phase rows CLOSED + 4 carry-forward operator-deferred + 6 forward-tracking rows queued); cross-phase ledger surgery (phase-4 + phase-6 + phase-7) | firebase-config 24/24 + root suite 484/484 green; commits `86ec5cd` (Task 1 HSTS runbook) + `b254230` (Task 3 SECURITY.md + REQUIREMENTS.md + cleanup ledger surgery) |

Total Phase 10 tests at Plan 10-05 autonomous close: 484 passed | 6 skipped (490). 6 skipped tests are the pre-staged `describe.skip` block in `tests/firebase-config.test.js` — operator un-skips at Step 2 below within the same commit as the firebase.json key flip.

Documentation authored this wave (10-05):

- `runbooks/hsts-preload-submission.md` — 5-Step operator runbook + apex-vs-subdomain decision tree + 3-row Cutover Log + Step 5 calendar-deferred listing-status check
- `SECURITY.md` — § Content Security Policy (Report-Only) REPLACED by § Content Security Policy (enforced) with per-directive matrix + Stage A/B/C narrative + soak evidence + framework citations; new § HSTS Preload Status; new § Phase 10 Audit Index (3-row Pattern G table — HOST-07 + HOST-06 + DOC-10); § Phase 3 Audit Index maintenance annotations (4 rows updated)
- `.planning/REQUIREMENTS.md` — HOST-06 + HOST-07 v1 rows flipped `[x]` substrate-complete; DOC-10 row gains Phase 10 Wave 5 increment annotation; Traceability table HOST-06/HOST-07 row updated to Validated 2026-05-10 substrate
- `runbooks/phase-10-cleanup-ledger.md` — `phase_10_active_rows: 0` zero-out gate; closes 1 Phase 4 + 1 Phase 6/7 cross-phase carry-forward row + 11 in-phase rows; 4 carry-forward operator-deferred + 6 forward-tracking rows queued for Phase 11 / 12 / v2
- `runbooks/phase-4-cleanup-ledger.md` "132 static `style="..."`" row marked CLOSED with Plan 10-01 commit SHA cross-reference
- `runbooks/phase-6-cleanup-ledger.md` + `runbooks/phase-7-cleanup-ledger.md` frame-src firebaseapp.com forward-tracking rows marked CLOSED with Plan 10-02 commit SHA cross-reference

---

## Operator Action Plan — Single Combined Session (calendar-paced)

Run in the order below. The ordering matters:

1. **Step 1 — Stage B 7-day Cloud Logging soak (Plan 10-03 Task 2)** — 7+ calendar days
2. **Step 2 — Single-knob enforcement flip + 5-target smoke matrix (Plan 10-04 Task 2)** — ~45 min active session on Day 7+ of Step 1
3. **Step 3 — hstspreload.org submission + securityheaders.com A+ rating + 7-day post-enforcement soak (Plan 10-05 Task 2)** — ~25 min active session + 7+ calendar days
4. **Step 4 — Phase-close human-verify (`/gsd-verify-work 10` OR equivalent) (Plan 10-05 Task 4)** — ~30 min

Estimated total operator wall-clock: **14+ calendar days** (driven by two 7-day soak windows); **~100 min** of active operator work across the three deploy/submission/close-gate touchpoints.

---

## Step 1 — Stage B 7-day Cloud Logging Soak (Plan 10-03 Task 2)

Follow `runbooks/phase-10-csp-soak-bootstrap.md` Steps 1-4 in full. Summary:

```bash
# Step 1.1 (~5 min): selective hosting deploy
firebase deploy --only hosting --project bedeveloped-base-layers
# Pitfall 8 selective-deploy boundary preserved; cspReportSink Cloud Function NOT redeployed

# Step 1.2 (~2 min): curl header verification
curl -sI https://baselayers.bedeveloped.com | grep -i content-security
# Expected: content-security-policy-report-only: ... style-src 'self'; ... https://de.sentry.io; frame-src 'self'; ...

# Step 1.3 (×7 days, ~5 min/day): daily Cloud Logging soak query
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND resource.labels.service_name="cspreportsink"
   AND severity=WARNING
   AND jsonPayload.message="csp.violation"
   AND jsonPayload.report.disposition="report"' \
  --project=bedeveloped-base-layers \
  --limit=50 --format=json --freshness=24h
# Expected: empty array `[]` from non-extension origins

# Step 1.4 (~5-10 min): Day 7 close-out binary CLEAN/RESTART decision gate
gcloud logging read '... AS ABOVE ...' --freshness=7d --limit=200
# Expected: empty array `[]`
# If non-empty: triage per runbooks/phase-10-csp-soak-bootstrap.md §Failure-Mode Triage 4-row decision-tree; restart 7-day clock if novel pattern
```

**Record evidence (paste into 10-PREFLIGHT.md ## Soak Log Cycle 1):**

```
day_0_deploy_at: <ISO timestamp>
day_0_operator: <email>
day_0_deploy_exit_code: <0 or error>
day_0_verbatim_headers: |
  <paste curl -sI output verbatim>
day_1_through_day_6: <PASS empty | INCIDENT — describe + classify + fix + restart>
day_7_close_out: <CLEAN — proceed to Step 2 | RESTART — Cycle 2 needed>
```

---

## Step 2 — Single-Knob Enforcement Flip + 5-Target Smoke Matrix (Plan 10-04 Task 2)

**BLOCKED on Step 1 Day 7 CLEAN signal.**

Follow `runbooks/csp-enforcement-cutover.md` Prerequisites + Pre-cutover Smoke + Cutover Steps 1-7 in single ~45 min session. Summary:

```bash
# Step 2.1 (~3 min): apply firebase.json key flip
# Edit firebase.json line 21: "key": "Content-Security-Policy-Report-Only" → "key": "Content-Security-Policy"

# Step 2.2 (~1 min): un-skip the Plan 10-04 describe block + delete Wave 2 RO describe
# Edit tests/firebase-config.test.js: delete `.skip` token on Wave 4 describe + delete Wave 2 RO describe block

# Step 2.3 (~2 min): local test verification
npm test -- --run firebase-config
# Expected: 23 OR 24 passed | 0 skipped (depending on (c) need)

# Step 2.4 (~5 min): selective hosting deploy
firebase deploy --only hosting --project bedeveloped-base-layers
# Pitfall 8 selective-deploy boundary preserved

# Step 2.5 (~2 min): curl smoke for content-security-policy (no -report-only suffix)
curl -sI https://baselayers.bedeveloped.com | grep -i content-security
# Expected: content-security-policy: ... (NOT content-security-policy-report-only:)

# Step 2.6 (~25 min): 5-target smoke matrix
# Operator visits production app + exercises 5 targets in foreground Chrome with DevTools console open:
#   1. sign-in flow (email-link)
#   2. dashboard view (renderDashboard)
#   3. radar + donut chart (renderReport)
#   4. document upload (uploadFile)
#   5. chat (renderChat)
# Capture DevTools console screenshot → docs/evidence/phase-10-enforcement-smoke-console.png
# Expected: zero CSP violations across all 5 targets

# Step 2.7 (~5 min): update 10-PREFLIGHT.md ## Cutover Log rows A/B/C
```

**Record evidence (paste into 10-PREFLIGHT.md ## Cutover Log):**

```
step_A_soak_window_closed: <ISO timestamp from Step 1 Day 7>
step_A_result: <PASS — zero violations | RESTART — describe>
step_B_key_flip_deploy_at: <ISO>
step_B_curl_verification: <PASS — content-security-policy: (no -report-only) | FAIL>
step_B_commit_sha: <fill from key-flip + un-skip commit>
step_C_smoke_matrix:
  target_1_signin: <PASS | FAIL>
  target_2_dashboard: <PASS | FAIL>
  target_3_charts: <PASS | FAIL>
  target_4_upload: <PASS | FAIL>
  target_5_chat: <PASS | FAIL>
step_C_screenshot: docs/evidence/phase-10-enforcement-smoke-console.png
step_C_result: <PASS — 5/5 targets clean | FAIL — list failing target(s) + rollback per single-knob procedure>
```

### Rollback Procedure (if any 5-target smoke fails)

Follow `runbooks/csp-enforcement-cutover.md ## Rollback Procedure`:

1. Revert `firebase.json` line 21 (`Content-Security-Policy` → `Content-Security-Policy-Report-Only`).
2. Revert `tests/firebase-config.test.js` (re-add `.skip` + restore Wave 2 RO describe via `git restore -p`).
3. Run `npm test -- --run firebase-config` (expect 24 passed | 6 skipped).
4. Selective hosting redeploy.
5. Curl verify rollback successful.
6. Forward-fix on a sub-wave 10.x micro-plan (preserves the un-skip token pre-stage); do NOT `git revert` (loses pre-stage work).
7. Document in 10-PREFLIGHT.md ## Cutover Log rollback section.
8. Restart Step 1 7-day Stage B soak with the fix applied.

---

## Step 3 — hstspreload.org Submission + securityheaders.com A+ Rating + 7-Day Post-Enforcement Soak (Plan 10-05 Task 2)

**BLOCKED on Step 2 enforcement-flip-deploy success.**

### 3.1 7-day post-enforcement soak (~5 min check at Day 7+ of Step 2)

```bash
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND resource.labels.service_name="cspreportsink"
   AND severity=WARNING
   AND jsonPayload.message="csp.violation"
   AND jsonPayload.report.disposition="enforce"' \
  --project=bedeveloped-base-layers \
  --limit=200 --format=json --freshness=7d
# Expected: empty array `[]` from non-extension origins
# If non-empty: violations are user-impacting under enforcement; FIX immediately + REDEPLOY + restart 7-day clock OR rollback per Step 2 Rollback Procedure
```

**Record outcome in `10-PREFLIGHT.md ## Cutover Log` Row E.**

### 3.2 securityheaders.com A+ rating (~5 min)

- Visit https://securityheaders.com/?q=baselayers.bedeveloped.com&followRedirects=on
- Expected rating: **A+** (vs Phase 3's A)
- Capture screenshot → save to `docs/evidence/phase-10-securityheaders-rating.png`
- If rating < A+: investigate (CSP must be enforced — not Report-Only; verify via Step 2.5 curl; if CSP looks correct, check Permissions-Policy / Reporting-Endpoints completeness)

**Record outcome in `10-PREFLIGHT.md ## Cutover Log` Row D.**

### 3.3 hstspreload.org submission (~15 min)

Follow `runbooks/hsts-preload-submission.md` Steps 1-4 in full:

```bash
# Step 3.3.1: verify live HSTS header
curl -sI https://baselayers.bedeveloped.com | grep -i strict-transport-security
# Expected: strict-transport-security: max-age=63072000; includeSubDomains; preload
```

- **Step 3.3.2 — apex-vs-subdomain decision:** tick the subdomain-only option (planner-recommended) in `runbooks/hsts-preload-submission.md` Step 2 + record in this runbook's Cutover Log Row 1.
- **Step 3.3.3 — submission:** visit https://hstspreload.org + enter `baselayers.bedeveloped.com` + wait for all green checks + click Submit + capture confirmation screenshot → `docs/evidence/phase-10-hsts-preload-submission.png`.
- **Step 3.3.4 — same-session JSON status verification:**

```bash
curl -s "https://hstspreload.org/api/v2/status?domain=baselayers.bedeveloped.com"
# Expected: {"status": "pending", ...} OR {"status": "in-pending-list", ...}
```

**Record outcomes in `runbooks/hsts-preload-submission.md ## Cutover Log` Rows 1 + 2 (row 3 remains PENDING — calendar-deferred weeks-months to Chrome propagation per Pitfall 19; forward-tracked in `runbooks/phase-10-cleanup-ledger.md` Row F1).**

---

## Step 4 — Phase-Close Human-Verify Evidence Sweep (Plan 10-05 Task 4)

Operator final verification pass. Confirm ALL items before marking Phase 10 complete.

### 4.1 SECURITY.md Phase 10 increment (~10 min)

```bash
grep -c '^## § Content Security Policy (enforced)' SECURITY.md
# Expected: 1
grep -c '^## § Content Security Policy (Report-Only)' SECURITY.md
# Expected: 0 (REPLACED)
grep -c '^## § HSTS Preload Status' SECURITY.md
# Expected: 1
grep -c '^## § Phase 10 Audit Index' SECURITY.md
# Expected: 1
```

Open `SECURITY.md` and read:

- § Content Security Policy (enforced): per-directive matrix accurately describes the live `firebase.json` state
- § HSTS Preload Status: submission date + subdomain-vs-apex tick match Step 3 actuals
- § Phase 10 Audit Index: 3 rows (HOST-07 + HOST-06 + DOC-10) point to real files + commits

### 4.2 REQUIREMENTS.md (~5 min)

```bash
grep -c '\[x\] \*\*HOST-07' .planning/REQUIREMENTS.md
# Expected: 1
grep -c '\[x\] \*\*HOST-06' .planning/REQUIREMENTS.md
# Expected: 1
grep -c 'Phase 10 Wave 5' .planning/REQUIREMENTS.md
# Expected: 1 (DOC-10 increment annotation)
```

Confirm:

- HOST-07 marked `[x]` in v1 Requirements list
- HOST-06 marked `[x]` substrate-complete (Pitfall 19 listing-status PENDING acknowledgment)
- DOC-10 row has Phase 10 Wave 5 increment annotation
- Traceability table HOST-06/HOST-07 row status = Validated 2026-05-10 substrate

### 4.3 Cleanup ledgers (~5 min)

```bash
grep 'phase_10_active_rows: 0' runbooks/phase-10-cleanup-ledger.md
# Expected: phase_10_active_rows: 0
grep 'Plan 10-01' runbooks/phase-4-cleanup-ledger.md
# Expected: at least 1 match (inline-style row CLOSED with Plan 10-01 commit SHA cross-reference)
grep 'Plan 10-02' runbooks/phase-6-cleanup-ledger.md
# Expected: 1 match
grep 'Plan 10-02' runbooks/phase-7-cleanup-ledger.md
# Expected: 1 match
```

### 4.4 Evidence files (~3 min)

```bash
ls docs/evidence/phase-10-*.png
# Expected: 4 files —
#   docs/evidence/phase-10-securityheaders-rating.png       (A+ — Step 3.2)
#   docs/evidence/phase-10-hsts-preload-submission.png      (submission confirmation — Step 3.3)
#   docs/evidence/phase-10-enforcement-smoke-console.png    (5-target smoke — Step 2.6)
# (docs/evidence/phase-10-hsts-preload-listed.png — calendar-deferred per F1; not expected at Phase 10 close)
```

### 4.5 `/gsd-verify-work 10` (~15 min — produces 10-VERIFICATION.md)

Run if available. The verifier walks must_haves across all 5 plans + ROADMAP success criteria + REQUIREMENTS traceability. Expected outcome:

- All 4 ROADMAP success criteria PASS (or 3/4 with substrate-honest "SC#3 listing-status calendar-deferred per Pitfall 19" annotation)
- Phase 10 close-gate passed

If verifier flags any gap → open sub-wave 10.x micro-plan via `/gsd-plan-phase 10 --gaps`.

### 4.6 STATE.md + ROADMAP.md flip

After all 4.1-4.5 PASS, the orchestrator updates:

- `.planning/STATE.md` — Phase 10 status: COMPLETE; Current Position: Phase 11; Last updated: <date>
- `.planning/ROADMAP.md` — Phase 10 progress row: `4/5` → `5/5 | Complete`

**Close-gate sign-off record:**

```
close_gate_date: <YYYY-MM-DD>
operator: <email>
check_step_1_stage_b_soak_clean: <PASS | FAIL>
check_step_2_enforcement_flip: <PASS | FAIL>
check_step_2_smoke_matrix: <5/5 PASS | partial PASS — list>
check_step_3_1_post_enforcement_soak: <PASS | FAIL>
check_step_3_2_securityheaders_a_plus: <PASS | FAIL>
check_step_3_3_hstspreload_submission: <PASS (subdomain-only | apex) | FAIL>
check_step_4_1_security_md: <PASS | FAIL>
check_step_4_2_requirements_md: <PASS | FAIL>
check_step_4_3_cleanup_ledgers: <PASS | FAIL>
check_step_4_4_evidence_files: <3/3 PASS | partial — list>
check_step_4_5_verify_work: <PASS | gap — describe + sub-wave 10.x>
phase_10_status: <COMPLETE | BLOCKED — describe>
phase_11_unblocked: <YES | NO>
```

---

## Why Deferred (Not Blocked)

- Waves 1-5 (Plans 10-01 through 10-05) landed code + schema tests + runbooks + docs — no production deploys.
- Stage B 7-day Cloud Logging soak is calendar-paced (7+ days minimum); the single-knob enforcement flip MUST wait on Stage B Day 7 CLEAN signal per Pitfall 16 three-stage rollout.
- Single-knob enforcement flip + 5-target smoke matrix is a foreground browser-side operator session; cannot be automated by an executor agent.
- hstspreload.org submission is a third-party web form; cannot be automated.
- securityheaders.com A+ rating is a third-party scanner producing the auditable artefact; cannot be automated.
- Phase-close human-verify is the gate that confirms the deployed system matches the documented controls.
- Batching all four operator-paced touchpoints (Step 1 deploy + 7d soak / Step 2 enforcement-flip + smoke / Step 3 HSTS submission + A+ + 7d soak / Step 4 close-gate) into one deferred-operator-action document reduces tracking surface from 4 separate documents to 1 (mirrors Phase 8 + Phase 9 pattern).
- This deferral does NOT violate Pitfall 16 — Pitfall 16 requires staged rollout (Stage A RO with unsafe-inline / Stage B RO tightened / Stage C enforced); Stage B is the deploy in Step 1, Stage C is the flip in Step 2. Calendar soak windows between stages are the substrate.

## Dependency Notes

- Plan 10-04 Task 2 (Step 2 above) is BLOCKED on Plan 10-03 Task 2 (Step 1 above) Day 7 CLEAN signal.
- Plan 10-05 Task 2 (Step 3 above) is BLOCKED on Plan 10-04 Task 2 (Step 2 above) enforcement-flip-deploy success.
- Plan 10-05 Task 4 (Step 4 above) is BLOCKED on Plan 10-05 Task 2 (Step 3 above) completion (post-enforcement soak CLEAN + A+ captured + HSTS submitted).
- F1 forward-tracking row (`runbooks/phase-10-cleanup-ledger.md`) — hstspreload.org listing-status flips from `pending` to `preloaded` is CALENDAR-DEFERRED (weeks-months Chrome propagation); not blocking Phase 10 close per Pitfall 19 substrate-honest disclosure. Closes at Phase 11 (DOC-09 evidence pack owner picks up the screenshot).

## Resume Signal Contract

Operator types **"approved"** when:

- All 4 step rows above show PASS (Step 1 CLEAN, Step 2 PASS 5/5 smoke, Step 3 PASS A+ + HSTS submitted + post-enforcement CLEAN, Step 4 evidence sweep PASS)
- `docs/evidence/phase-10-securityheaders-rating.png` + `docs/evidence/phase-10-hsts-preload-submission.png` + `docs/evidence/phase-10-enforcement-smoke-console.png` captured
- 10-PREFLIGHT.md Cutover Log Rows A/B/C/D/E filled with PASS
- `runbooks/hsts-preload-submission.md ## Cutover Log` Rows 1 + 2 filled with PASS (Row 3 stays PENDING per Pitfall 19)
- `/gsd-verify-work 10` (if run) returns 0 unresolved must_have failures OR 3/4 ROADMAP SC PASS with substrate-honest "SC#3 listing-status calendar-deferred" annotation
- Cleanup ledger `phase_10_active_rows: 0` confirmed
- Cross-phase ledger rows CLOSED — phase-4 inline-style row references Plan 10-01; phase-6 + phase-7 frame-src rows reference Plan 10-02

OR the operator types **failure-mode + sub-wave 10.x sub-plan** if any verification fails. The phase does NOT close until either operator approval OR the sub-plan resolves.

## Forward-Tracking Carry-Forward Confirmation

At close-gate, operator confirms the 6 forward-tracking rows in `runbooks/phase-10-cleanup-ledger.md` are bounded:

- F1 hstspreload listing-status `preloaded`: bounded to Phase 11 / 12 (DOC-09 evidence pack + audit walkthrough)
- F2 Phase 4 sub-wave 4.1 IIFE body migration: bounded to v2 / separate milestone (independent of HOST-07 enforcement)
- F3 Future federated OAuth-popup sign-in frame-src re-extension: bounded to v2 / AUTH-V2-01
- F4 `docs/CONTROL_MATRIX.md` HOST-06 + HOST-07 + DOC-10 rows: bounded to Phase 11 (DOC-04)
- F5 `docs/evidence/` Phase 10 screenshots collation: bounded to Phase 11 (DOC-09)
- F6 `SECURITY_AUDIT.md` Phase 10 §CSP + §HSTS walkthrough: bounded to Phase 12 (WALK-02 / WALK-03)

All 6 are explicitly bounded; none block Phase 10 close at the code-and-docs level. The 4 operator-deferred carry-forward rows (Plan 10-03 Task 2 + Plan 10-04 Task 2 + Plan 10-05 Task 2 + Plan 10-05 Task 4) close at the single combined operator session via this checkpoint document; they are NOT open ledger rows.
