# Phase 7 — App Check Enforcement Verification Gate (Evidence Pack)

> Mirrors `runbooks/phase6-rules-rollback-rehearsal.md` evidence-pack shape.
> Operator-filled file — substrate authored by `07-03-PLAN.md` Wave 3 Task 3;
> values are filled in as Stages A through F land per
> `runbooks/phase-7-app-check-rollout.md`.
>
> This file feeds the **Phase 7 Wave 6 cleanup-ledger gate** (07-06):
> Stages A + B + C closed in-phase by 07-03; Stages D + E + F deferred to
> `07-HUMAN-UAT.md` per the standard pattern. The Wave 6 gate accepts
> `PASS-PARTIAL` when A+B+C green AND D-F queued in HUMAN-UAT.

---

## Stage A evidence (enrolment)

```
site_key_prefix: <first 8 chars, rest masked> (e.g. 6L_abcdef)
registered_at: <ISO>
registered_by: business@bedeveloped.com
registered_provider: reCAPTCHA Enterprise
environments_with_site_keys: [prod]   # staging deferred until staging project exists; CI uses prod key + per-CI debug tokens
debug_tokens_registered_for: [local-vite-dev]   # CI runner debug token added in sub-wave 7.1 if/when CI exercises App Check-protected paths in unit/integration suites
enforcement_state: unenforced (Storage, Firestore, Cloud Functions, RTDB all OFF)
screenshot_path: runbooks/evidence/phase-7-stage-a-enrolment.png
```

### Stage A SUBSTRATE-HONEST status (Wave 3 close)

```
substrate_landed: YES   # src/firebase/check.js body filled (commit 3bc2c6f); .env.example committed; vite.config.js build guard added; tests/firebase/app.test.js updated
console_action_status: PENDING-OPERATOR-EXECUTION   # see 07-HUMAN-UAT.md row "Stage A console enrolment"
```

---

## Stage B evidence (quota alert)

```
alert_threshold: 70% of 10k assessments/month
alert_recipient: business@bedeveloped.com
alert_configured_at: <ISO>
synthetic_alert_test_result: <pass|deferred>
screenshot_path: runbooks/evidence/phase-7-stage-b-quota-alert.png
```

### Stage B SUBSTRATE-HONEST status (Wave 3 close)

```
substrate_landed: YES   # runbook documents the GCP Console alert config steps
console_action_status: PENDING-OPERATOR-EXECUTION   # see 07-HUMAN-UAT.md row "Stage B quota alert config"
```

---

## Stage C evidence (7-day soak)

```
soak_start_at: <ISO timestamp of production deploy>
daily_verified_ratio_log:
  day_1: <ratio> | runbooks/evidence/phase-7-soak-day-1.png
  day_2: <ratio>
  day_3: <ratio>
  day_4: <ratio>
  day_5: <ratio>
  day_6: <ratio>
  day_7: <ratio>
day_7_verified_ratio: <ratio — gate is ≥95%>
soak_passed: <YES|NO|PENDING>
```

### Stage C SUBSTRATE-HONEST status (Wave 3 close)

```
substrate_landed: YES   # runbook + production deploy of body-filled check.js (Wave 3 Task 2 commit 3bc2c6f) means the SDK is attaching App Check tokens to every Firebase call AS SOON AS Stage A.2 console enrolment completes
console_action_status: PENDING-OPERATOR-EXECUTION   # see 07-HUMAN-UAT.md row "Stage C 7-day soak start + daily verification"
soak_window_days: 7+ (by definition)
```

---

## Stage D — F (deferred to 07-HUMAN-UAT.md)

Per 07-RESEARCH.md Pattern 3 + the standard Phase 3 / Phase 5 / Phase 6
deferred-operator-execution pattern. Each Stage row below is a
`PENDING-OPERATOR-EXECUTION` row in `07-HUMAN-UAT.md`.

### Stage D — Storage enforcement

```
storage_enforcement_at: PENDING
storage_enforcement_verified_at: PENDING
storage_smoke_pass: PENDING
storage_failed-auth_smoke_denies: PENDING
storage_enforcement_screenshot: PENDING
```

### Stage E — Firestore enforcement (per-collection log)

| Collection | Enforced At | Smoke Pass | Smoke Fail (no-token) | Screenshot |
|------------|-------------|------------|----------------------|------------|
| auditLog | PENDING | PENDING | PENDING | PENDING |
| internalAllowlist | PENDING | PENDING | PENDING | PENDING |
| softDeleted | PENDING | PENDING | PENDING | PENDING |
| messages | PENDING | PENDING | PENDING | PENDING |
| comments | PENDING | PENDING | PENDING | PENDING |
| documents | PENDING | PENDING | PENDING | PENDING |
| responses | PENDING | PENDING | PENDING | PENDING |
| actions | PENDING | PENDING | PENDING | PENDING |

### Stage F — Cloud Functions enforcement

```
functions_enforcement_at: PENDING
functions_enforcement_verified_at: PENDING
functions_callable_smoke_pass:
  setClaims: PENDING
  auditWrite: PENDING
  softDelete: PENDING
  gdprExportUser: PENDING
functions_no-token_returns_unauthenticated: PENDING
functions_enforcement_screenshot: PENDING
```

---

## Cleanup-ledger gate (Wave 6 closes)

This is the canonical input row for the Phase 7 Wave 6 close gate
(07-06-PLAN.md). Mirror of Phase 6's RULES-07 Deploy Verification Gate
shape (per 07-PATTERNS.md Pattern H).

```
gate_check_date: <ISO when Wave 6 close runs>
gate_input_evidence_path: runbooks/phase-7-app-check-enforcement.md
soak_window_days: 7+
enforcement_flip_storage_at: <ISO|PENDING>
enforcement_flip_firestore_at: <ISO|PENDING>
enforcement_flip_functions_at: <ISO|PENDING>
quota_alert_at_70_percent_configured: true|false
unenforced_dashboard_screenshot_evidence: <path>
gate_result: PASS-PARTIAL | PASS | FAIL
notes: |
  Stage A + B + C land in Phase 7 Wave 3 (07-03 commit <hash>); Stages
  D + E + F deferred to 07-HUMAN-UAT.md per standard pattern (Phase 3 /
  Phase 5 / Phase 6 precedent — substrate-honest fallback). Phase 7 Wave 6
  close gate accepts PASS-PARTIAL when A+B+C green AND D-F queued in
  07-HUMAN-UAT.md as PENDING-OPERATOR-EXECUTION rows. Full PASS requires
  operator to flip Stages D-F per their schedule.
```

---

## Citations

- 07-RESEARCH.md Pattern 3 (Staged Rollout — FN-08)
- 07-PATTERNS.md Pattern H (cleanup-ledger zero-out gate)
- `.planning/phases/06-real-auth-mfa-rules-deploy/06-HUMAN-UAT.md` (deferred-operator-execution precedent)
- `.planning/phases/03-hosting-cutover-baseline-security-headers/03-HUMAN-UAT.md` (deferred-operator-execution precedent)
- `runbooks/phase6-rules-rollback-rehearsal.md` (evidence-pack shape mirror)
