# docs/evidence/ — Evidence Pack Inventory

**Last updated:** 2026-05-10 (Phase 11 Wave 6)
**Owner:** Phase 11 (DOC-09); upstream phases supply captures via deferred-checkpoint operator sessions.
**Compliance posture:** credible, not certified — see `SECURITY.md` (compliance posture statement footer).

**Pitfall 19 substrate-honest disclosure:** Captures marked `PENDING-OPERATOR` carry an explicit pointer to the deferred-checkpoint document, RESUME-NOTE, or user-testing batch step where they will be captured. They are NOT silently omitted. Each `PENDING-OPERATOR` row clears when the upstream operator session completes — in the same commit that adds the screenshot to `docs/evidence/`, the row flips to `PRESENT`.

---

## How to use this inventory

This file is the auditor-friendly index over the screenshot evidence bundle that supports `docs/CONTROL_MATRIX.md`. An auditor reading `SECURITY.md` + `docs/CONTROL_MATRIX.md` + this inventory has a complete pointer trail from every requirement (REQ-ID) to its implementation, its test, its framework citation, AND its operator-captured evidence (where applicable).

Status states (only two allowed — Pitfall 19):

- `PRESENT` — the capture file exists on disk in `docs/evidence/`.
- `PENDING-OPERATOR — <pointer>` — the capture is operator-deferred; the pointer cites the deferred-checkpoint document or batch step that will land it.

Phase 11 does NOT trigger new operator sessions — it documents what's pending and where it will land. Captures land via the existing Phase 6 / 8 / 9 / 10 operator sessions; this inventory tracks them.

---

## Inventory

| # | Capture | Status | Source phase | Path |
|---|---------|--------|--------------|------|
| 1 | Branch-protection enforced on `main` | PRESENT | Phase 1 user-verify | `docs/evidence/branch-protection-screenshot.png` |
| 2 | Socket.dev install-time detection of malicious package | PRESENT | Phase 1 Wave 2 | `docs/evidence/socket-install.png` |
| 3 | MFA enrolment for Luke (TOTP) | PENDING-OPERATOR — see `.planning/phases/06-real-auth-mfa-rules-deploy/06-RESUME-NOTE.md` Step 9 (end-of-phases user-testing batch) | Phase 6 | `docs/evidence/phase-6-mfa-luke.png` |
| 4 | MFA enrolment for George (TOTP) | PENDING-OPERATOR — see `06-RESUME-NOTE.md` Step 9 (end-of-phases user-testing batch) | Phase 6 | `docs/evidence/phase-6-mfa-george.png` |
| 5 | MFA recovery drill pass (Luke + George same-session — AUTH-10) | PENDING-OPERATOR — see `06-RESUME-NOTE.md` Step 10 (user-testing batch) + `runbooks/phase6-mfa-recovery-drill.md` | Phase 6 | `docs/evidence/phase-6-mfa-recovery-drill-pass.png` |
| 6 | Firestore region screenshot (`europe-west2`) | PENDING-OPERATOR — gcloud verification recorded in `.planning/phases/06-real-auth-mfa-rules-deploy/06-PREFLIGHT.md`; Firebase Console screenshot supplemental (Phase 6 user-testing batch) | Phase 6 | `docs/evidence/phase-6-firestore-region.png` |
| 7 | Rules deployment timestamp (firestore.rules + storage.rules) | PENDING-OPERATOR — captured at Phase 6 RULES-07 cutover (see `06-PREFLIGHT.md ## Cutover Log: rules_deploy_console_timestamp`); operator paste of console screenshot | Phase 6 | `docs/evidence/phase-6-rules-deploy.png` |
| 8 | Sample audit-log entry (PII redacted) | PENDING-OPERATOR — Phase 7/9 user-testing batch (sign-in event + scrubbed payload; `tests/firebase/auth-audit-emit.test.js` shape gate already pins schema) | Phase 7 | `docs/evidence/phase-7-audit-log-sample.png` |
| 9 | App Check enforcement state per service (Storage / Firestore / Functions) | PENDING-OPERATOR — see `.planning/phases/07-cloud-functions-app-check-audit-log-rate-limits/07-HUMAN-UAT.md` Tests 4 / 5 / 6 (Stages D-F operator-paced rollout) | Phase 7 | `docs/evidence/phase-7-app-check-enforcement.png` |
| 10 | Backup-policy console screenshot (GCS lifecycle + PITR) | PENDING-OPERATOR — see `.planning/phases/08-data-lifecycle-soft-delete-gdpr-backups/08-06-DEFERRED-CHECKPOINT.md` (Phase 8 close-out batch) | Phase 8 | `docs/evidence/phase-8-backup-policy.png` |
| 11 | Phase 9 Sentry source-map upload (CI deploy log) | PENDING-OPERATOR — see `.planning/phases/09-observability-audit-event-wiring/09-06-DEFERRED-CHECKPOINT.md` Step E (first deploy log evidence) | Phase 9 | `docs/evidence/phase-9-sentry-source-maps.png` |
| 12 | Phase 9 Sentry EU residency (Sentry Console region indicator) | PENDING-OPERATOR — see `09-06-DEFERRED-CHECKPOINT.md` Step E (Sentry Console screenshot) | Phase 9 | `docs/evidence/phase-9-sentry-eu-region.png` |
| 13 | Phase 9 anomaly-alert Slack reception (synthetic test) | PENDING-OPERATOR — see `09-06-DEFERRED-CHECKPOINT.md` Step C synthetic Slack alert | Phase 9 | `docs/evidence/phase-9-slack-anomaly-alert.png` |
| 14 | Phase 9 GCP uptime check (3 regions, 60s, HTTPS GET) | PENDING-OPERATOR — see `09-06-DEFERRED-CHECKPOINT.md` Step E (Cloud Console uptime-checks screenshot) | Phase 9 | `docs/evidence/phase-9-uptime-check.png` |
| 15 | Phase 9 GCP budget alerts (50% / 80% / 100%) | PENDING-OPERATOR — see `09-06-DEFERRED-CHECKPOINT.md` Step E (Cloud Console billing budgets screenshot) | Phase 9 | `docs/evidence/phase-9-budget-alerts.png` |
| 16 | Phase 9 Sentry 70% quota alert (Settings → Subscription → Usage Alerts) | PENDING-OPERATOR — see `09-06-DEFERRED-CHECKPOINT.md` Step E (Sentry Console screenshot) | Phase 9 | `docs/evidence/phase-9-sentry-quota-alert.png` |
| 17 | Phase 10 securityheaders.com A+ rating | PENDING-OPERATOR — see `.planning/phases/10-csp-tightening-second-sweep/10-DEFERRED-CHECKPOINT.md` Step 3 (securityheaders.com scan after enforcement flip) | Phase 10 | `docs/evidence/phase-10-securityheaders-rating.png` |
| 18 | Phase 10 hstspreload.org submission confirmation | PENDING-OPERATOR — see `10-DEFERRED-CHECKPOINT.md` Step 3 (hstspreload.org submission via `runbooks/hsts-preload-submission.md`) | Phase 10 | `docs/evidence/phase-10-hsts-preload-submission.png` |
| 19 | Phase 10 hstspreload.org listing-status `preloaded` | PENDING-OPERATOR — see `10-DEFERRED-CHECKPOINT.md` + `runbooks/phase-10-cleanup-ledger.md` Row F1 (Chrome propagation calendar-deferred, weeks-months) | Phase 10 | `docs/evidence/phase-10-hsts-preload-listed.png` |
| 20 | Phase 10 enforcement smoke matrix (5-target DevTools console clean) | PENDING-OPERATOR — see `10-DEFERRED-CHECKPOINT.md` Step 2 (`runbooks/csp-enforcement-cutover.md` Step 6 — 5-target smoke matrix capture) | Phase 10 | `docs/evidence/phase-10-enforcement-smoke-console.png` |
| 21 | Latest CI green run (lint + typecheck + Vitest + rules-unit-tests + npm audit + build) | PENDING-OPERATOR — Phase 11 close-out capture (operator screenshots latest green Actions run for the milestone-final commit) | Phase 11 | `docs/evidence/phase-11-ci-green.png` |
| 22 | Latest `npm audit --omit=dev` clean output | PENDING-OPERATOR — Phase 11 close-out capture (operator runs `npm audit --omit=dev` and captures terminal screenshot) | Phase 11 | `docs/evidence/phase-11-npm-audit.png` |

---

## Capture cadence

Most pending captures are batched into existing `*-DEFERRED-CHECKPOINT.md` operator sessions queued at Phases 6 / 8 / 9 / 10 close. Phase 11 does NOT trigger new operator sessions — it documents what's pending and where it will land.

When an operator session completes a capture, the matching row above flips `PENDING-OPERATOR` → `PRESENT` in the same commit that adds the screenshot to `docs/evidence/`.

## Cross-references

- `SECURITY.md` § Phase 11 Audit Index (DOC-09 row points back here)
- `docs/CONTROL_MATRIX.md` DOC category (DOC-09 row points back here)
- `.planning/REQUIREMENTS.md` DOC-09 row (substrate-honest closure annotation)
- `runbooks/phase-11-cleanup-ledger.md` row F3 (forward-tracking — re-sweep this inventory after upstream phases close their deferred-checkpoint sessions)

## Framework citations

- OWASP ASVS L2 v5.0 V14.1 (build and deployment)
- ISO/IEC 27001:2022 Annex A.5.36 (compliance monitoring)
- SOC 2 CC2.3 (information and communication — internal control documentation)
