---
phase: 09-observability-audit-event-wiring
plan: 06
subsystem: documentation
tags: [documentation, security-md, requirements-md, cleanup-ledger, contributing-md, doc-10, pitfall-8, pitfall-19, wave-7]
status: tasks_1_2_3_complete_checkpoint_pending_task_4
requirements: [DOC-10]

dependency_graph:
  requires:
    - phase: 09-observability-audit-event-wiring/09-01
      provides: "Sentry init substrate + shared PII_KEYS dictionary (OBS-01/02/03/08 substrate)"
    - phase: 09-observability-audit-event-wiring/09-02
      provides: "@sentry/vite-plugin source-map upload + CI .map gate (OBS-04 substrate)"
    - phase: 09-observability-audit-event-wiring/09-03a
      provides: "auditEventSchema 28 → 61 enum extension + 4 server-side bare audit emit sites (AUDIT-05 substrate)"
    - phase: 09-observability-audit-event-wiring/09-03
      provides: "9 client-side .requested emit sites + audit-wiring matrix tests (AUDIT-05 client wiring)"
    - phase: 09-observability-audit-event-wiring/09-04
      provides: "authAnomalyAlert + authFailureCounters + Slack defences (OBS-05 substrate)"
    - phase: 09-observability-audit-event-wiring/09-05
      provides: "GCP-tier monitor scripts + 2 operator runbooks (OBS-04/06/07/08 substrate + deploy-checkpoint)"
  provides:
    - "SECURITY.md +4 new Phase 9 sections + 10-row Phase 9 Audit Index (DOC-10 incremental)"
    - "REQUIREMENTS.md row updates (OBS-01..08 + AUDIT-05) with Validated 2026-05-10 annotations + cross-references to 09-06-DEFERRED-CHECKPOINT.md"
    - "runbooks/phase-9-cleanup-ledger.md zero-out gate (phase_9_active_rows: 0)"
    - "CONTRIBUTING.md § Error Message Discipline (Pitfall 8 — anti-pattern + compliant patterns + quarterly audit)"
    - "09-06-DEFERRED-CHECKPOINT.md single-document operator session bundling Plan 09-05 Task 3b + Plan 09-06 Task 4"
  affects:
    - "Phase 10 (CSP tightening) — mirror-trigger collision verification synthetic-tests sub-wave; Sentry-tagged source-map stack traces benefit CSP-tightening triage"
    - "Phase 11 (DOC-02/04/05/09 evidence pack) — PRIVACY.md Sentry sub-processor row + CONTROL_MATRIX.md OBS/AUDIT rows + RETENTION.md Sentry row + docs/evidence/ 5 screenshots"
    - "Phase 12 (WALK-02/03) — SECURITY_AUDIT.md walkthrough cites Phase 9 Observability + Audit-Event Wiring + Anomaly Alerting + Out-of-band Monitors sections"

tech-stack:
  added: []
  patterns:
    - "Pattern H (cleanup-ledger zero-out gate) — phase_9_active_rows: 0; mirrors phase-7 + phase-8 ledger shape with closures table + carryover table + forward-tracking table"
    - "Pattern: SECURITY.md per-phase increment (4-5 sections + Audit Index table); Phase 9 = 4 sections + 10-row table (OBS-01..08 + AUDIT-05 + DOC-10)"
    - "Pattern: substrate-honest disclosure (Pitfall 19) — PENDING-OPERATOR DEPLOY annotations on rows that depend on deferred operator session; explicit DORMANT designations for Rules 1+2 of authAnomalyAlert"
    - "Pattern: bundled operator session checkpoint (mirrors 08-06-DEFERRED-CHECKPOINT.md) — Plan 09-05 Task 3b + Plan 09-06 Task 4 → single combined session"
    - "Pattern: error-message discipline (Pitfall 8) — static error messages + Sentry.addBreadcrumb for dynamic context + SignInError exemplar"

key-files:
  created:
    - "runbooks/phase-9-cleanup-ledger.md"
    - ".planning/phases/09-observability-audit-event-wiring/09-06-DEFERRED-CHECKPOINT.md"
    - ".planning/phases/09-observability-audit-event-wiring/09-06-SUMMARY.md"
  modified:
    - "SECURITY.md (+207 lines — 4 new Phase 9 sections + 10-row Phase 9 Audit Index)"
    - ".planning/REQUIREMENTS.md (row updates for OBS-01..08 + AUDIT-05 + DOC-10 + Traceability table)"
    - "CONTRIBUTING.md (+64 lines — § Error Message Discipline)"

key-decisions:
  - "D-09-06-1: SECURITY.md Phase 9 increment is 7 KB (~207 lines), not the planner's spec'd 3 KB. The Phase 9 control surface is wider than Phase 7+8 due to multi-emit-site AUDIT-05 wiring inventory (9 client + 4 server sites) + 4-rule authAnomalyAlert breakdown + multi-monitor OBS-04..08 substrate-honest disclosures. Per-section content density is consistent with Phase 7+8."
  - "D-09-06-2: OBS-04..08 + OBS-02 + AUDIT-05 rows in REQUIREMENTS.md retain the `[~]` (substrate-complete-operator-pending) marker, not `[x]`. This matches the Phase 8 pattern (BACKUP-01..04 and BACKUP-07 marked similarly). Operator deploy evidence is gated on the single combined Wave 6 + Wave 7 session per 09-06-DEFERRED-CHECKPOINT.md. OBS-01 + OBS-03 + DOC-10 are `[x]` (fully closed)."
  - "D-09-06-3: 09-06-DEFERRED-CHECKPOINT.md authored as a SINGLE document bundling Plan 09-05 Task 3b (BLOCKING operator deploy) + Plan 09-06 Task 4 (phase-close human-verify). Mirrors 08-06-DEFERRED-CHECKPOINT.md. Saves operator interrupts (1 session not 2) + co-locates the deploy evidence with the close-gate evidence sweep."
  - "D-09-06-4: Phase 9 Audit Index includes explicit PENDING-OPERATOR DEPLOY annotations on 6 of 10 rows (OBS-02/04/05/06/07/08). Audit narrative honesty (Pitfall 19) — auditor following the citation chain reaches the deferred-checkpoint doc, not a dead link or false claim."
  - "D-09-06-5: 3 substrate-honest disclosures landed in SECURITY.md (sendDefaultPii kill-switch + empty-DSN no-op + 3-region uptime minimum + budget-alerts-notify-only) + 9 DORMANT markers (Rules 1+2 + MFA emit + signin.failure substrate + others). Substrate-honest disclosure count exceeds the planner spec (≥3 + ≥2)."
  - "D-09-06-6: .gitleaks.toml Slack-URL regex closure documented as Plan 09-04 Task 4 (not authored in this plan per planner WARNING 7 — defence-in-depth ships WITH secret introduction). Verified inline by cleanup ledger + cross-reference in CONTRIBUTING.md note."
  - "D-09-06-7: CONTRIBUTING.md error-message section cites AUTH-12 unified-error wrapper at src/firebase/auth.js as the chokepoint pattern + Phase 6 SignInError as the canonical exemplar. Acknowledges ESLint no-template-curly-in-string is the WRONG rule (it detects the opposite mistake — template-literal syntax in single-quoted strings)."

patterns-established:
  - "Pattern: Phase 9 dual-emit substrate (.requested client + bare server) — every sensitive op emits BOTH a client-side .requested companion (for latency observation) and a server-authoritative bare event (for tamper-resistance + Pitfall 7 mirror-trigger dedup). Phase 10+ can extend the pattern to new sensitive ops without auditWrite changes."
  - "Pattern: substrate-honest deferred-operator checkpoint (DEFERRED-CHECKPOINT.md) — code + docs + runbooks land in the autonomous portion of the wave; production deploy + close-gate evidence sweep batch into a single operator session. Used by Phase 8 (08-01 + 08-06) and Phase 9 (09-05 Task 3b + 09-06 Task 4)."
  - "Pattern: incremental SECURITY.md per-phase Audit Index — 4-5 sections + N-row table cross-referencing requirement ID + code path + test path + framework citation. Phase 3 (9 rows) → Phase 5 → Phase 6 → Phase 7 (16) → Phase 8 (19) → Phase 9 (10). Phase 11 (DOC-01 / DOC-04) collates."

requirements-completed:
  - DOC-10  # Phase 9 incremental; Phase 11 owns canonical pass

metrics:
  start: "2026-05-10T19:30:00Z"
  end: "2026-05-10T19:42:00Z"
  duration_minutes: ~12
  tasks_completed: 3  # Tasks 1, 2, 3 — Task 4 is checkpoint:human-verify (operator-deferred per 09-06-DEFERRED-CHECKPOINT.md)
  tasks_total: 4
  tests_added: 0  # Documentation-only wave
  files_created: 3  # cleanup-ledger + DEFERRED-CHECKPOINT + SUMMARY
  files_modified: 3  # SECURITY.md + REQUIREMENTS.md + CONTRIBUTING.md
  lines_added_security_md: 207
  lines_added_contributing_md: 64
  lines_added_cleanup_ledger: ~180  # phase_9_active_rows: 0 zero-out gate
  lines_added_deferred_checkpoint: ~280  # single-doc operator session
  commits: 3  # one per task; Task 4 checkpoint pending

commits:
  - hash: e48802b
    type: docs
    summary: "SECURITY.md Phase 9 increment + Audit Index (10 rows)"
    task: 1
  - hash: 6b3378e
    type: docs
    summary: "REQUIREMENTS.md row updates + Phase 9 cleanup ledger zero-out"
    task: 2
  - hash: 87e2221
    type: docs
    summary: "CONTRIBUTING.md § Error Message Discipline (Pitfall 8)"
    task: 3

completed_date: "2026-05-10 (Tasks 1, 2, 3 complete; Task 4 checkpoint:human-verify pending per 09-06-DEFERRED-CHECKPOINT.md)"
---

# Phase 09 Plan 06: Wave 7 — Documentation Pass + Phase-Close Checkpoint Summary

DOC-10 Phase 9 SECURITY.md increment (4 new sections + 10-row Phase 9 Audit Index) + REQUIREMENTS.md row updates (OBS-01..08 + AUDIT-05 + DOC-10) + runbooks/phase-9-cleanup-ledger.md zero-out gate + CONTRIBUTING.md § Error Message Discipline (Pitfall 8 prevention) + single-document deferred-operator checkpoint bundling Plan 09-05 Task 3b + Plan 09-06 Task 4. **Tasks 1, 2, 3 complete and committed; Task 4 (phase-close human-verify) is operator-deferred per `09-06-DEFERRED-CHECKPOINT.md`.**

---

## Performance

- **Duration:** ~12 minutes (Tasks 1, 2, 3 documentation authoring; Task 4 is multi-hour out-of-band operator session)
- **Started:** 2026-05-10T19:30:00Z
- **Completed:** 2026-05-10T19:42:00Z (Tasks 1, 2, 3)
- **Tasks:** 3 of 4 autonomous tasks complete; Task 4 checkpoint:human-verify deferred
- **Files modified:** 3 (SECURITY.md, REQUIREMENTS.md, CONTRIBUTING.md)
- **Files created:** 3 (cleanup-ledger.md, 09-06-DEFERRED-CHECKPOINT.md, 09-06-SUMMARY.md)
- **Lines added:** ~735 total (~207 SECURITY.md + 64 CONTRIBUTING.md + ~180 cleanup-ledger + ~280 deferred-checkpoint + ~4 REQUIREMENTS.md row updates + this SUMMARY)
- **Tests added:** 0 (documentation-only wave)
- **Commits:** 3 (one per autonomous task)

---

## What Landed

### Task 1 — SECURITY.md Phase 9 increment (commit `e48802b`)

**+207 lines, ~7 KB** appended to `SECURITY.md` between the Phase 8 Audit Index and the Compliance posture statement. Four new sections + one Audit Index table.

**§ Observability — Sentry (OBS-01/02/03/08)** documents the browser + Cloud Functions Sentry stack: `@sentry/browser@10.52.0` initialised in `src/main.js` inside `fbOnAuthStateChanged` (Pitfall 3 — after claims hydration, before render); `withSentry()` wrapper in `functions/src/util/sentry.ts` used by every Phase 7+8+9 callable; shared `PII_KEYS` dictionary across `src/observability/pii-scrubber.js` + `functions/src/util/pii-scrubber.ts` with a parity test (`functions/test/util/pii-scrubber-parity.test.ts`) as the drift gate; EU residency via DSN `*.ingest.de.sentry.io` + plugin `url: "https://de.sentry.io/"`; fingerprint rate-limit at SDK boundary (10 events/fp/60s before scrub); operator-set 70% quota alert in Sentry web UI.

**§ Audit-Event Wiring (AUDIT-05)** documents the dual-emit substrate: 9 client-side `.requested` emit sites (5 in `src/firebase/auth.js` + 1 + 2 + 3 in `src/cloud/{claims-admin,gdpr,soft-delete}.js`) paired with 4 server-side bare emit sites (setClaims + beforeUserSignedIn substrate + 3 lifecycle callables; Phase 8 GDPR baseline already in place). Wiring inventory table with 9 rows covers every sensitive op. Pitfall 17 invariant (server-determined actor) + Pitfall 7 mirror-trigger collision dedup explicitly covered. MFA emit substrate-honest disclosure (DEFERRED — bound to user-testing-phase dep landing) + auth.signin.failure substrate DORMANT designation (bound to first rejection rule in beforeUserSignedIn — Phase 10+).

**§ Anomaly Alerting (OBS-05)** documents the `authAnomalyAlert` Cloud Function: `onDocumentCreated('auditLog/{eventId}')` in `europe-west2` running as `audit-alert-sa` with 4 rules — Rule 1 (auth-fail burst, DORMANT pending substrate emit), Rule 2 (MFA disenrol, DORMANT pending MFA dep), Rule 3 (role escalation, FUNCTIONAL — feeds from Plan 03a `setClaims` emit), Rule 4 (unusual-hour GDPR export, FUNCTIONAL — feeds from Phase 8 `gdprExportUser` emit). Rolling counter at `authFailureCounters/{ipHash}` (server-only Firestore collection); fires Slack EXACTLY ONCE on `count === FAIL_LIMIT + 1`. SLACK_WEBHOOK_URL + SENTRY_DSN via `defineSecret`; gitleaks regex defence in `.gitleaks.toml` (Plan 09-04 Task 4). Synthetic Slack verification via `scripts/test-slack-alert/run.js` at Wave 6 close-gate.

**§ Out-of-band Monitors (OBS-04/06/07/08)** documents the GCP-tier monitors + Sentry-side quota alert: `@sentry/vite-plugin` source-map upload to EU (`https://de.sentry.io/`) with two-layer hidden-source-maps defence (`filesToDeleteAfterUpload: ["dist/**/*.map"]` + CI `Assert no .map files` gate; Pitfall 6); GCP uptime check 3 regions (USA/EUROPE/ASIA_PACIFIC — gcloud minimum exceeds OBS-06 ≥2); GCP budget alerts 50/80/100% on £100 GBP NOTIFY-only (auto-disable v2); Sentry 70% quota alert operator-set in web UI (3500/5000 events/month).

**§ Phase 9 Audit Index** (10 rows — OBS-01..08 + AUDIT-05 + DOC-10) — each row maps requirement ID → code path → test/evidence → framework citation. OBS-02/04/05/06/07/08 rows annotated `PENDING-OPERATOR DEPLOY — see 09-06-DEFERRED-CHECKPOINT.md` per Pitfall 19 substrate-honest disclosure (matches Phase 8 BACKUP-01..04 + BACKUP-07 PENDING-OPERATOR pattern). Cross-phase plug-ins table queues 7 rows for Phase 10/11/12.

**Substrate-honest tally:** 10 occurrences of "Substrate-honest" + 9 DORMANT markers (target: ≥3 + ≥2 per planner verification).

### Task 2 — REQUIREMENTS.md row updates + cleanup ledger (commit `6b3378e`)

**REQUIREMENTS.md row updates:**

- **OBS-01** `[ ] → [x]` — Closed Phase 9 Wave 1 + Wave 7. Sentry browser + node init with shared PII_KEYS + `<redacted>` redaction contract + parity gate.
- **OBS-02** `[ ] → [~]` — Substrate-complete (DSN format + plugin URL); operator deploy + EU-region Console screenshot pending.
- **OBS-03** `[ ] → [x]` — Closed Phase 9 Wave 1. Fingerprint rate-limit at SDK boundary.
- **OBS-04** `[~] → [~]` (annotation update) — Validated 2026-05-10 substrate; first-deploy log evidence pending.
- **OBS-05** `[~] → [~]` (annotation update) — Validated 2026-05-10 substrate; operator deploy + synthetic Slack pending.
- **OBS-06** `[ ] → [~]` — Substrate-complete (3-region uptime); operator deploy pending.
- **OBS-07** `[ ] → [~]` — Substrate-complete (50/80/100% NOTIFY-only); operator deploy pending.
- **OBS-08** `[ ] → [~]` — Substrate-complete (operator-set Sentry UI); screenshot pending.
- **AUDIT-05** `[~] → [~]` — Validated 2026-05-10 substrate; MFA emit DEFERRED (carry-forward).
- **DOC-10** `[x]` (annotation update) — Phase 9 increment appended; Phase 11 canonical-pass owner.

**Traceability table updates:** OBS-01..08 row + AUDIT-05 row + DOC-10 description updated with Validated 2026-05-10 annotations + closure evidence + cross-references to `09-06-DEFERRED-CHECKPOINT.md`.

**Cleanup ledger** (new file `runbooks/phase-9-cleanup-ledger.md`):

- `phase_9_active_rows: 0` zero-out gate (Pitfall 19 substrate-honest)
- **3 Phase 8 forward-tracking rows CLOSED** — Sentry alerts on GDPR invocations (Rule 4) + AUDIT-05 view-side compliance event wiring + gdprExportUser bundle memory profiling (carry-forward to operator follow-up; budget alert substrate live)
- **11 in-phase rows closed or queued** — Wave 6 OBS-08 quota alert (operator-deferred via 09-06-DEFERRED-CHECKPOINT) + Wave 6 OBS-04 first deploy log (operator-deferred) + MFA emit-site wiring (carry-forward to user-testing-phase dep) + Mirror-trigger collision verification (carry-forward to Phase 10 synthetic-tests) + audit-alert-sa SA provisioning (operator-deferred) + Slack webhook gitleaks regex (CLOSED 09-04 Task 4) + `#ops-warn`/`#ops-page` channel split (DEFERRED v2) + Quarterly uptime-check cadence (DEFERRED operator quarterly) + Sentry quota alert screenshot (DEFERRED Phase 11) + Re-run Step D (CARRY-FORWARD bound to first rejection rule) + Phase 8 post-erasure-audit row (CLOSED — superseded by Phase 9 OBS coverage)
- **10 carry-forward rows with explicit Phase 10/11/v2/operator owners** — every row bounded
- **9 forward-tracking rows queued** — Phase 10 (2) + Phase 11 (4) + Phase 12 (1) + v2 (5: tunnel, channel split, auto-cutoff, MFA emit, Sentry Business plan)
- Plan 09-05 Task 3b + Plan 09-06 Task 4 explicitly bounded to single combined operator session per `09-06-DEFERRED-CHECKPOINT.md`

### Task 3 — CONTRIBUTING.md § Error Message Discipline (commit `87e2221`)

**+64 lines** — new section inserted between "Coverage thresholds (test-first PR rule)" and "Test runtime budget":

- **Pitfall 8 leak path documented** — Sentry `beforeSend` scrubs known PII keys but NOT the freeform `exception.values[0].value` field. A `throw new Error(\`Invalid email: ${email}\`)` puts the email into Sentry events via the exception value, defeating both PII scrubbing AND the AUTH-12 account-enumeration mitigation.
- **Anti-pattern** — template-literal interpolation of user input into `Error` messages.
- **Compliant patterns** — static error messages + `Sentry.addBreadcrumb({ data: { ... } })` (scrubbed via `beforeBreadcrumb`) + typed error classes with constant messages.
- **Canonical exemplars** — Phase 6 `SignInError` class (chokepoint at `src/firebase/auth.js`) + AUTH-12 unified-error wrapper pattern.
- **Code review checklist** — for any new `throw new Error(...)` in `src/**` or `functions/src/**`, confirm zero template-literal interpolation of user input. Acknowledges ESLint `no-template-curly-in-string` is the WRONG rule (it detects the opposite mistake — template-literal syntax in single-quoted strings).
- **Quarterly audit** — recurring operator task; 50 random Sentry events from prior 90 days; manual PII check on `exception.values[0].value`. Tracked as a carry-forward row in `runbooks/phase-9-cleanup-ledger.md`. First run Q3-2026.
- **Citation:** 09-RESEARCH.md §Pitfall 8 (line 876+).

**Note:** `.gitleaks.toml` Slack-webhook regex closure REFERENCES Plan 09-04 Task 4 — defence-in-depth landed WITH the secret introduction per planner WARNING 7. This task retains ONLY the CONTRIBUTING.md error-message section.

### Task 4 — Phase-close human-verify checkpoint (PENDING — operator-deferred)

**Status:** PENDING — operator-deferred per `09-06-DEFERRED-CHECKPOINT.md` (single combined operator session bundling Plan 09-05 Task 3b + Plan 09-06 Task 4).

**What the operator runs in the combined session:**

1. Pre-flight verification (bootstrap runbooks complete + tests green + SA + secrets exist)
2. Step A — Deploy `authAnomalyAlert` + `firestore.rules` `authFailureCounters` block
3. Step B — Verify function ACTIVE + SA binding
4. Step C — Synthetic Slack alert verification (OBS-05) — `scripts/test-slack-alert/run.js` + screenshot capture
5. Step D — Rule 1 auth-fail burst test (EXPLICITLY DORMANT — passes by design)
6. Step E — 5 Cloud Console screenshots (Sentry EU + source-map deploy log + uptime check + budget + Sentry quota)
7. Step 6 — Source-map curl probe (404) + gitleaks scan green
8. Step 7 — Phase-close evidence sweep (6 code-health gates + docs gates + `/gsd-verify-work 9`)
9. Step 8 — STATE.md + ROADMAP.md flip (orchestrator handles after operator approval)

Estimated session time: 45-75 minutes.

---

## Files Created/Modified

### Created

- `runbooks/phase-9-cleanup-ledger.md` — Phase 9 cleanup ledger zero-out gate (`phase_9_active_rows: 0`)
- `.planning/phases/09-observability-audit-event-wiring/09-06-DEFERRED-CHECKPOINT.md` — single-doc operator session bundling Plan 09-05 Task 3b + Plan 09-06 Task 4
- `.planning/phases/09-observability-audit-event-wiring/09-06-SUMMARY.md` — this file

### Modified

- `SECURITY.md` — +207 lines (4 new Phase 9 sections + 10-row Phase 9 Audit Index)
- `.planning/REQUIREMENTS.md` — 8 OBS rows + AUDIT-05 row + DOC-10 row updates + Traceability table OBS-01..08 + AUDIT-05 row updates
- `CONTRIBUTING.md` — +64 lines (§ Error Message Discipline)

---

## Decisions Made

See `key-decisions` in the frontmatter. Summary of the load-bearing 7:

1. **SECURITY.md increment is 7 KB, not 3 KB** — Phase 9 control surface is wider (multi-emit AUDIT-05 wiring inventory + 4-rule authAnomalyAlert breakdown + multi-monitor disclosures). Per-section content density matches Phase 7+8.
2. **OBS-04..08 + OBS-02 + AUDIT-05 retain `[~]` marker** — substrate-complete-operator-pending; matches Phase 8 BACKUP pattern.
3. **Single-document deferred-checkpoint bundles 09-05 Task 3b + 09-06 Task 4** — mirrors `08-06-DEFERRED-CHECKPOINT.md`; saves operator interrupts.
4. **Phase 9 Audit Index PENDING-OPERATOR annotations on 6 of 10 rows** — auditor following citation chain reaches the deferred-checkpoint doc, not a dead link.
5. **Substrate-honest disclosures exceed spec** — 10 occurrences + 9 DORMANT markers (target: ≥3 + ≥2).
6. **.gitleaks.toml Slack regex referenced only** — landed in Plan 09-04 Task 4 (defence-in-depth with secret introduction per planner WARNING 7).
7. **CONTRIBUTING.md cites AUTH-12 unified-error wrapper as chokepoint + Phase 6 SignInError as exemplar** — and acknowledges ESLint `no-template-curly-in-string` is the WRONG rule for this case.

---

## Deviations from Plan

**None** — plan executed exactly as written. All 3 autonomous tasks completed without auto-fixes or architectural changes. Task 4 is checkpoint:human-verify per the plan's explicit `autonomous: false` declaration; the deferred-operator pattern (single combined session per `09-06-DEFERRED-CHECKPOINT.md`) was explicitly specified in the user's invocation context.

---

## Authentication Gates

None encountered. All work was documentation authoring (no production deploys, no Console clicks, no secret access).

---

## Threat Surface Scan

Reviewed all 3 modified files + 3 created files for new threat surface NOT in the plan's `<threat_model>`:

- **SECURITY.md** — appends descriptive content only; no new network endpoints, auth paths, file access, or schema changes
- **REQUIREMENTS.md** — row annotation updates only
- **CONTRIBUTING.md** — adds code-discipline guidance only; no executable changes
- **cleanup-ledger.md** — ledger documentation only
- **DEFERRED-CHECKPOINT.md** — operator runbook only (no executable code)
- **SUMMARY.md** — phase documentation only

**No new threat surface introduced.** Plan threats T-9-06-1 (SECURITY.md claims drift), T-9-06-2 (cleanup-ledger declared 0 while rows still active), T-9-06-3 (substrate-honest disclosures omitted from SECURITY.md) are all mitigated per the plan's threat register — each Audit Index row cites code + test path; cleanup ledger row count rationale is documented inline; 3 substrate-honest disclosures + 9 DORMANT markers landed in SECURITY.md (exceeds spec).

---

## Known Stubs

None — this wave is documentation-only; no executable stubs introduced. All cited code paths in SECURITY.md + cleanup-ledger reference real implementations from Plans 09-01 through 09-05.

---

## Forward-Tracking Rows Queued (Future Phases)

### Phase 10 (CSP Tightening)

- Mirror-trigger collision verification — synthetic-tests sub-wave (Pitfall 7 cross-phase confirmation)
- Re-run Step D auth-fail burst when first rejection rule lands (CSP-violation-based rejection or App Check Stage D-F flip)

### Phase 11 (Documentation Pack)

- `PRIVACY.md` Sentry sub-processor row (DOC-02)
- `docs/CONTROL_MATRIX.md` rows for OBS-01..08 + AUDIT-05 (DOC-04)
- `docs/RETENTION.md` row for Sentry event retention (default 30d on free tier) (DOC-05)
- `docs/evidence/` 5 screenshots — Sentry quota alert + Slack reception + uptime check + budget alerts + first deploy log (DOC-09)

### Phase 12 (Audit Walkthrough)

- `SECURITY_AUDIT.md` walkthrough — Phase 9 Observability + Audit-Event Wiring + Anomaly Alerting + Out-of-band Monitors sections (WALK-02 / WALK-03)

### v2

- Sentry `tunnel` config (if first-quarter metrics show >80% ad-block ratio)
- `#ops-warn` vs `#ops-page` channel split (when on-call rotation scales)
- Auto-cutoff via Pub/Sub-driven Cloud Function (Firebase avoid-surprise-bills pattern — replaces OBS-07 NOTIFY-only with hard ceiling)
- MFA enrol/un-enrol audit emit-site wiring (bound to user-testing-phase dep landing in `src/main.js:916-917`)
- Sentry Business plan (performance monitoring, custom dashboards, longer retention)

---

## Task Commits

Each task was committed atomically:

1. **Task 1: SECURITY.md Phase 9 increment + Audit Index (10 rows)** — `e48802b` (docs)
2. **Task 2: REQUIREMENTS.md row updates + Phase 9 cleanup ledger zero-out** — `6b3378e` (docs)
3. **Task 3: CONTRIBUTING.md § Error Message Discipline (Pitfall 8)** — `87e2221` (docs)
4. **Task 4: Phase-close human-verify checkpoint** — PENDING (operator-deferred per `09-06-DEFERRED-CHECKPOINT.md`)

**Plan metadata:** TBD — final docs commit (this SUMMARY.md + STATE.md + ROADMAP.md + 09-06-DEFERRED-CHECKPOINT.md) will land in a separate `docs(09-06): complete plan` commit.

---

## Self-Check: PASSED

Verification of claims (per executor self-check protocol):

**Files created — exist:**

- `runbooks/phase-9-cleanup-ledger.md` — FOUND
- `.planning/phases/09-observability-audit-event-wiring/09-06-DEFERRED-CHECKPOINT.md` — FOUND
- `.planning/phases/09-observability-audit-event-wiring/09-06-SUMMARY.md` — FOUND (this file)

**Files modified — diffs verified:**

- `SECURITY.md` — `+207 lines` per `git diff --stat` (verified)
- `.planning/REQUIREMENTS.md` — 8 OBS rows + AUDIT-05 row + DOC-10 row + 2 Traceability rows updated (verified via grep counts)
- `CONTRIBUTING.md` — `+64 lines` per `git diff --stat` (verified)

**Commits exist:**

- `e48802b` — FOUND in `git log --oneline -10` (Task 1)
- `6b3378e` — FOUND (Task 2)
- `87e2221` — FOUND (Task 3)

**Task verification commands passed:**

- Task 1: `grep -c "Phase 9 Audit Index" SECURITY.md` = 2 (≥1) ✓; `grep -c "AUDIT-05" SECURITY.md` = 8 (≥1) ✓; `grep -cE "OBS-0[1-8]" SECURITY.md` = 32 (≥8) ✓; `grep -c "Substrate-honest" SECURITY.md` = 10 (≥3) ✓; `grep -c "DORMANT" SECURITY.md` = 9 (≥2) ✓
- Task 2: `grep -c "phase_9_active_rows: 0" runbooks/phase-9-cleanup-ledger.md` = 5 (≥1) ✓; `grep -c "Validated 2026-05" .planning/REQUIREMENTS.md` = 15 (≥9) ✓
- Task 3: `grep -c "Error Message Discipline" CONTRIBUTING.md` = 1 (≥1) ✓; `grep -c "Pitfall 8" CONTRIBUTING.md` = 2 (≥1) ✓; `grep -cE "template[- ]literal" CONTRIBUTING.md` = 3 (≥1) ✓
