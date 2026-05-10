---
phase: 9
slug: observability-audit-event-wiring
status: revised
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-10
last_updated: 2026-05-10
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x (root + functions/) |
| **Config file** | `vitest.config.js` (root) + `functions/vitest.config.ts` |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run && (cd functions && npm test -- --run)` |
| **Estimated runtime** | ~30 seconds (root) + ~25 seconds (functions) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run` (or scoped subset)
- **After every plan wave:** Run full suite (root + functions)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Wave-of-Build Replaces Wave 0 Stubs

Per revision (2026-05-10) checker WARNING 9 fix: this phase does NOT pre-create test stubs in a "Wave 0" task. Instead, every task that produces production code ALSO produces its own tests in the same atomic commit (TDD pattern — `tdd="true"` on every code-producing task).

The "Wave 0 Requirements" section below is RETAINED for reference but reads as the inventory of test files that the wave-of-build pattern produces, NOT as a separate prerequisite task.

---

## Per-Task Verification Map

Each task in Phase 9 has an `<automated>` verify command that runs in <60s. Wave-of-build means the test file lands in the same task as the code it tests.

### Plan 09-01 (Wave 1) — Sentry init substrate + shared PII scrubber + audit-events proxy

| Task | Files Produced | Verify |
|------|----------------|--------|
| 1: Install deps + create PII_KEYS scrubbers + parity test | `package.json`, `src/observability/pii-scrubber.js`, `functions/src/util/pii-scrubber.ts`, `functions/test/util/pii-scrubber-parity.test.ts`, `tests/observability/pii-scrubber.test.js` | `npm test -- --run tests/observability/pii-scrubber.test.js && cd functions && npm test -- --run test/util/pii-scrubber-parity.test.ts` |
| 2: Fill src/observability/sentry.js + tests | `src/observability/sentry.js`, `tests/observability/sentry-init.test.js` | `npm test -- --run tests/observability/sentry-init.test.js` |
| 3: Fill src/observability/audit-events.js (emitAuditEvent proxy) + tests | `src/observability/audit-events.js`, `tests/observability/audit-events.test.js` | `npm test -- --run tests/observability/audit-events.test.js` |
| 4: Wire Sentry boot in src/main.js + author runbook | `src/main.js`, `runbooks/phase-9-sentry-bootstrap.md` | `npm run lint && npm run typecheck && npm test -- --run tests/observability/` |

### Plan 09-02 (Wave 2) — @sentry/vite-plugin source-map upload + CI env

| Task | Files Produced | Verify |
|------|----------------|--------|
| 1: vite.config.js plugin registration + harness test | `vite.config.js`, `tests/build/source-map-gate.test.js` | `npm test -- --run tests/build/source-map-gate.test.js` |
| 2: CI workflow env vars + post-build .map gate | `.github/workflows/ci.yml` | YAML lint via `yamllint .github/workflows/ci.yml` (or actionlint if available) + `git diff --check .github/workflows/ci.yml` |

### Plan 09-03a (Wave 3) — Server-side audit-event substrate + enum extension (NEW per revision)

| Task | Files Produced | Verify |
|------|----------------|--------|
| 1: auditEventSchema enum extension (15 bare + 18 .requested = 33 new literals) + 10 schema tests | `functions/src/audit/auditEventSchema.ts`, `functions/test/audit/auditEventSchema.test.ts` | `cd functions && npm test -- --run test/audit/auditEventSchema.test.ts` |
| 2: setClaims + beforeUserSignedIn writeAuditEvent emissions + 6 tests | `functions/src/auth/setClaims.ts`, `functions/src/auth/beforeUserSignedIn.ts`, `functions/test/auth/setClaims-audit-emit.test.ts`, `functions/test/auth/beforeUserSignedIn-audit-emit.test.ts` | `cd functions && npm test -- --run test/auth/setClaims-audit-emit.test.ts test/auth/beforeUserSignedIn-audit-emit.test.ts` |
| 3: lifecycle/* writeAuditEvent emissions + 9 tests | `functions/src/lifecycle/{softDelete,restoreSoftDeleted,permanentlyDeleteSoftDeleted}.ts`, `functions/test/lifecycle/{softDelete,restoreSoftDeleted,permanentlyDeleteSoftDeleted}-audit-emit.test.ts` | `cd functions && npm test -- --run test/lifecycle/` |

### Plan 09-03 (Wave 4) — Client-side audit-event wiring (.requested companions)

| Task | Files Produced | Verify |
|------|----------------|--------|
| 1: Verify Plan 03a enum landed (no schema edits) | (none — verifier) | `cd functions && npm test -- --run test/audit/auditEventSchema.test.ts && grep -cE "\.requested\"" functions/src/audit/auditEventSchema.ts` |
| 2: src/firebase/auth.js 6 emit sites + 7 tests | `src/firebase/auth.js`, `tests/firebase/auth-audit-emit.test.js` | `npm test -- --run tests/firebase/auth-audit-emit.test.js` |
| 3: src/cloud/* 6 emit sites + wiring matrix test | `src/cloud/{claims-admin,gdpr,soft-delete}.js`, `tests/audit-wiring.test.js` | `npm test -- --run tests/audit-wiring.test.js` |

### Plan 09-04 (Wave 5) — authAnomalyAlert + counter rules + Slack synthetic + gitleaks

| Task | Files Produced | Verify |
|------|----------------|--------|
| 1a: authAnomalyAlert.ts module body + index.ts export (no tests in this task — split per WARNING 5) | `functions/src/observability/authAnomalyAlert.ts`, `functions/src/index.ts` | `cd functions && npm run lint && npm run typecheck` |
| 1b: 6 trimmed behaviour tests for the trigger | `functions/test/observability/authAnomalyAlert.test.ts` | `cd functions && npm test -- --run test/observability/authAnomalyAlert.test.ts` |
| 2: firestore.rules authFailureCounters block + 4-cell test | `firestore.rules`, `tests/rules/authFailureCounters.test.js` | `npm run test:rules -- tests/rules/authFailureCounters.test.js` |
| 3: scripts/test-slack-alert/run.js + README (parse-only verify per WARNING 8) | `scripts/test-slack-alert/run.js`, `scripts/test-slack-alert/README.md` | `node -c scripts/test-slack-alert/run.js && ls scripts/test-slack-alert/README.md` |
| 4: .gitleaks.toml Slack-webhook regex (moved from Plan 06 per WARNING 7) | `.gitleaks.toml` | `grep -c "slack-webhook-url" .gitleaks.toml && npx --yes gitleaks detect --no-git --source . --config .gitleaks.toml --redact` |

### Plan 09-05 (Wave 6) — GCP-tier monitors + audit-alert-sa SA + deploy checkpoint

| Task | Files Produced | Verify |
|------|----------------|--------|
| 1: scripts/setup-uptime-check + scripts/setup-budget-alerts + READMEs | 4 files | `node -c scripts/setup-uptime-check/run.js && node -c scripts/setup-budget-alerts/run.js` |
| 2: runbooks/phase-9-monitors-bootstrap.md | 1 file | `ls runbooks/phase-9-monitors-bootstrap.md && grep -cE "OBS-06\|OBS-07\|OBS-08\|audit-alert-sa" runbooks/phase-9-monitors-bootstrap.md` |
| 3a: runbooks/phase-9-deploy-checkpoint.md (autonomous authoring; split per WARNING 6) | 1 file | `ls runbooks/phase-9-deploy-checkpoint.md && grep -cE "Cutover Log\|audit-alert-sa\|DORMANT" runbooks/phase-9-deploy-checkpoint.md` |
| 3b: Operator deploy checkpoint (BLOCKING — no automated verify) | (manual) | (operator-paced; checkpoint:human-action gate) |

### Plan 09-06 (Wave 7) — DOC-10 + REQUIREMENTS.md + cleanup ledger + CONTRIBUTING.md

| Task | Files Produced | Verify |
|------|----------------|--------|
| 1: SECURITY.md +4 sections + Phase 9 Audit Index 10 rows | `SECURITY.md` | `grep -c "Phase 9 Audit Index" SECURITY.md && grep -c "AUDIT-05" SECURITY.md && grep -cE "OBS-0[1-8]" SECURITY.md` |
| 2: REQUIREMENTS.md row updates + cleanup ledger zero-out | `.planning/REQUIREMENTS.md`, `runbooks/phase-9-cleanup-ledger.md` | `grep -c "phase_9_active_rows: 0" runbooks/phase-9-cleanup-ledger.md && grep -c "Validated 2026-05" .planning/REQUIREMENTS.md` |
| 3: CONTRIBUTING.md § Error Message Discipline (gitleaks moved to Plan 04 Task 4) | `CONTRIBUTING.md` | `grep -c "Error Message Discipline" CONTRIBUTING.md && grep -c "Pitfall 8" CONTRIBUTING.md` |
| 4: Phase-close human-verify checkpoint (BLOCKING — no automated verify) | (manual) | (operator-paced; checkpoint:human-verify gate) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

All non-checkpoint tasks have an automated `<verify>` block. Checkpoints (Plan 05 Task 3b + Plan 06 Task 4) are operator-paced and gated separately — these are LEGITIMATE manual verifications (deploy + evidence sweep), not gaps in test coverage.

---

## Wave 0 Requirements (legacy — superseded by wave-of-build)

The original Wave 0 stub list:

- [x] `@sentry/browser`, `@sentry/node`, `@sentry/vite-plugin` installed (now in Plan 09-01 Task 1)
- [x] `tests/observability/sentry-init.test.js` — Sentry browser init contract test (Plan 09-01 Task 2)
- [x] `functions/tests/sentry-node.test.ts` — Sentry node init contract test (subsumed by `functions/test/util/pii-scrubber-parity.test.ts` + `functions/test/util/sentry.test.ts` in Plan 09-01 Task 1)
- [x] `functions/tests/auth-anomaly/authAnomalyAlert.test.ts` — Slack alert callable test (now Plan 09-04 Task 1b)
- [x] `tests/audit-wiring.test.js` — AUDIT-05 wiring matrix (now Plan 09-03 Task 3)

All items lift into the wave-of-build pattern; no separate Wave 0 task exists.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Operator receives synthetic Slack alert | OBS-05 | Slack webhook receipt verification | Send test event via callable; confirm Slack channel post |
| Source maps resolve in Sentry UI | OBS-04 | Sentry UI inspection | Trigger error in prod build; verify stack frames show original source in Sentry dashboard |
| Uptime monitor probes from 2+ regions | OBS-06 | GCP Console / `gcloud monitoring uptime list` | Verify configured locations cover >= 2 regions |
| Firebase budget alert delivery | OBS-07 | Email/Pub-Sub receipt | Lower threshold temporarily; verify alert email; restore |
| Sentry quota alert | OBS-08 | Sentry UI inspection | Configure quota at 70%; verify alert config |
| authAnomalyAlert deploy succeeds | OBS-05 | Cloud Console | `gcloud functions describe authAnomalyAlert --region=europe-west2` returns audit-alert-sa as service-account |
| firestore.rules deploy includes authFailureCounters block | OBS-05 | Cloud Console | Cloud Console → Firestore → Rules → see latest deployed version contains the block |

---

## Validation Sign-Off

- [x] All non-checkpoint tasks have `<automated>` verify command (revised — Plan 03a added; Plan 04 split; Plan 05 split)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (checkpoint tasks are explicitly gated separately)
- [x] Wave 0 requirements covered by wave-of-build pattern (each task produces its own tests)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter
- [x] `wave_0_complete: true` set in frontmatter (wave-of-build supersedes Wave 0)

**Approval:** REVISED 2026-05-10 — addresses checker WARNING 9 + restructures per Plan 03a addition.
</content>
</invoke>
