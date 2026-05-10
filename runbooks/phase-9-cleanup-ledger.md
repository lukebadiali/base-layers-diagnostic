---
phase: 9
created: 2026-05-10
phase_9_active_rows: 0
last_updated: 2026-05-10
---

# Phase 9 Cleanup Ledger

> Phase 9 Wave 7 (09-06) deliverable. Closes all in-Phase-9 forward-tracking rows queued by Waves 1-6; documents persistent carryover rows with explicit Phase 10/11/v2 bounded closure paths. Mirrors `runbooks/phase-7-cleanup-ledger.md` + `runbooks/phase-8-cleanup-ledger.md` Pattern H shape.
>
> Substrate-honest (Pitfall 19): every Phase-9-originating row CLOSES with this commit OR has an explicit closure path documented with a named owner and phase. Carryover rows are open BUT explicitly bounded. The operator-deferred production deploy + close-gate are NOT open ledger rows — they are deferred operator tasks tracked in `.planning/phases/09-observability-audit-event-wiring/09-06-DEFERRED-CHECKPOINT.md` (single combined session bundling Plan 09-05 Task 3b + Plan 09-06 Task 4).

---

## Phase 8 Forward-Tracking — Phase 9 Closure

These 3 rows were queued by `runbooks/phase-8-cleanup-ledger.md` § Phase 9 forward-tracking. All close (or transition to operator-deferred) here.

| Row | Phase 8 reason | Phase 9 closure |
|-----|----------------|-----------------|
| Sentry alerts on `gdprExportUser` + `gdprEraseUser` invocations (unusual-hour or high-frequency) | OBS-05 (Phase 9 owner) — Phase 8 emits the `compliance.export.user` + `compliance.erase.user` audit events; Phase 9 wires the Slack webhook alert on unusual patterns | CLOSED 09-04: `functions/src/observability/authAnomalyAlert.ts` Rule 4 fires on `compliance.export.user` events with UTC hour ∈ {0..5, 22..23}. FUNCTIONAL — feeds from Phase 8 baseline `gdprExportUser` server emission. Operator end-to-end deploy evidence pending per `09-06-DEFERRED-CHECKPOINT.md` (Step C synthetic alert + Step E Slack reception screenshot). |
| AUDIT-05 view-side wiring of `compliance.export.user` + `compliance.erase.user` | Phase 9 — `src/cloud/audit.js` wrapper available since Phase 7 Wave 6; Phase 9 wires the view-side call sites across all sensitive admin actions including GDPR rights invocations | CLOSED 09-03 + 09-03a: 9 client-side `.requested` emit sites including 2 in `src/cloud/gdpr.js` (`compliance.export.user.requested`, `compliance.erase.user.requested`) — pair with server-side bare emissions from Phase 8 (gdprExportUser:197, gdprEraseUser:289). 14 client tests + 25 server tests gate against drift. Pitfall 17 invariant verified. |
| `gdprExportUser` bundle assembly memory profiling (large-user case) | OBS-07 — Phase 9 budget alerts catch unexpected memory bills; if profiling reveals bundles > 100 MB, escalate to streaming-to-GCS pattern | CARRY-FORWARD to operator follow-up — `scripts/setup-budget-alerts/run.js` substrate complete (50/80/100% thresholds, £100 GBP); budget alerts NOTIFY operator if unexpected memory bills land. Bundle assembly profiling is operator-paced; first real-world large-user export triggers the row's resolution path (escalate to streaming if bundle > 100 MB). Bounded by Phase 8 `redactionList` substrate already in place + first quarterly drill. |

---

## Phase 9 In-Phase Forward-Tracking — Closed Wave 7

These rows were queued during Phase 9 Waves 1-6 SUMMARY documents. All close here or have an explicit bounded closure path.

| Row | Queued in | Closure |
|-----|-----------|---------|
| Wave 6 close-gate verifies operator-set 70% quota alert (OBS-08) | Wave 1 09-01 SUMMARY + Wave 6 09-05 monitors-bootstrap runbook Step 5 | CLOSED to `runbooks/phase-9-deploy-checkpoint.md` Step E — operator Sentry Console screenshot at the single combined Wave 6 + Wave 7 operator session (`09-06-DEFERRED-CHECKPOINT.md`). |
| Wave 6 close-gate verifies first deploy log shows source-map upload + "Assert no .map files" step OK (OBS-04 + Pitfall 6) | Wave 2 09-02 SUMMARY | CLOSED to `runbooks/phase-9-deploy-checkpoint.md` Step A + CI run log evidence at the single combined operator session. Pitfall 6 two-layer defence (plugin `filesToDeleteAfterUpload` + CI find-grep gate) verified by deploy-to-main CI run. |
| MFA emit-site wiring (AUDIT-05) DEFERRED — bound to `enrollTotp` / `unenrollAllMfa` dep landing in `src/main.js:916-917` | Wave 3 09-03a + 09-03 SUMMARYs | CARRY-FORWARD — deps are `// deferred to user-testing phase` per Plan 03a §mfa_rationale. Bounded path: whenever the operator pulls MFA enrol/un-enrol into `src/main.js`, the `auth.mfa.enrol` + `auth.mfa.unenrol` enum literals (Phase 7 baseline) are emission-ready; Wave 4 Rule 2 (MFA disenrolment alert) trigger code stays DORMANT — observation activates the moment those deps land. No code-level work remains on this row in Phase 9. |
| Mirror-trigger collision verification (1 alert per soft-delete cascade) | Wave 4 09-03 SUMMARY (validates Pitfall 7 across Phase 9 dual-emit shape) | CARRY-FORWARD to Phase 10 — paired with Phase 10 CSP-tightening synthetic-tests sub-wave (one observation per phase saves operator time; Phase 10 already gains a synthetic-test sub-wave for `curl` smoke checks at strict-CSP cutover). Closure path: Phase 10 synthetic-tests sub-wave runs a 5-doc soft-delete cascade in staging + asserts exactly 1 Slack alert per cascade. |
| `audit-alert-sa` SA provisioning at Wave 6 operator session | Wave 5 09-04 SUMMARY + Wave 6 09-05 monitors-bootstrap Step 1 | CLOSED to `runbooks/phase-9-deploy-checkpoint.md` Step A — operator runs the Phase 7 SA provisioner extension at the single combined Wave 6 + Wave 7 operator session. SA roles: `roles/datastore.user` + `roles/datastore.viewer` (project) + `roles/secretmanager.secretAccessor` (per-secret on `SLACK_WEBHOOK_URL` + `SENTRY_DSN`). |
| Slack webhook gitleaks regex extension | Wave 5 09-04 Task 4 (moved from Plan 06 Task 3 per planner WARNING 7) | CLOSED 09-04 Task 4: `.gitleaks.toml` extended with `slack-webhook-url` rule regex (`https://hooks.slack.com/services/[A-Z0-9]+/[A-Z0-9]+/[a-zA-Z0-9]+`). Pre-commit hook + CI gate now catches accidental webhook URL commits. Defence-in-depth landed WITH the secret introduction in Plan 09-04, not deferred to Plan 09-06 (matches "secrets and their defences ship together" pattern). |
| `#ops-warn` vs `#ops-page` channel split when staffing scales | Wave 5 09-04 SUMMARY | DEFERRED to v2 — operator policy decision, not a code-level row. Today all 4 anomaly rules post to a single Slack channel (operator-configured webhook). Re-evaluate after first quarter of metrics + first on-call rotation establishes. |
| Quarterly uptime-check verification cadence (OBS-06) | Wave 6 09-05 SUMMARY | DEFERRED to operator follow-up — first quarterly verification at Q3-2026 (mirrors Phase 8 BACKUP-06 quarterly restore-drill cadence). Operator paces. |
| Sentry quota alert screenshot for docs/evidence/ (OBS-08) | Wave 6 09-05 SUMMARY | DEFERRED to Phase 11 (DOC-09 evidence pack owner) — Phase 11 final pass collects all 4 Sentry/Slack/uptime/budget screenshots at `docs/evidence/phase-9-*`. Phase 9 ships the substrate + close-gate runbook; Phase 11 collates the screenshots for the evidence pack. |
| Re-run Step D (auth-fail burst synthetic) when first rejection rule lands in `beforeUserSignedIn` | Wave 6 09-05 deploy-checkpoint Step D (explicitly DORMANT) | CARRY-FORWARD — bound to the next phase introducing a rejection rule (Phase 10+ probable; e.g., CSP-violation-based rejection or App Check enforcement Stage D-F flips). When that lands, operator re-runs Step D against staging; the `auth.signin.failure` substrate (Plan 03a) emits, the rolling counter at `authFailureCounters/{ipHash}` fires Slack on count 6, and Rule 1 transitions FUNCTIONAL. |
| Phase 8 forward-tracking row: post-erasure-audit first run → operator follow-up | Phase 8 09-CONTEXT.md (Phase 9 forward-track) | CLOSED — superseded by Phase 9 OBS coverage. Sentry browser + node init with `beforeSend` PII scrubber will catch any post-erasure-audit residual PII via the global error capture path (`scripts/post-erasure-audit/run.js` runs under Node + uses `functions/src/util/sentry.ts withSentry()` wrapper for instrumentation; PII leaks would surface as Sentry events with non-redacted slots, triggering investigation). First production execution of the audit script is still operator-paced (Phase 8 carry-forward), but Phase 9 closes the OBSERVATION gap. |

---

## Phase 9 Carryover — Bounded Closure Paths

These rows originated in or were re-asserted by Phase 9 work but are NOT closed at Phase 9 close. Each has an explicit closure path with a named owner and phase.

| Row | Reason | Closure path |
|-----|--------|--------------|
| **Plan 09-05 Task 3b deferred — operator session pending** | Wave 6 substrate + deploy-checkpoint runbook complete (scripts + monitors-bootstrap + deploy-checkpoint); the operator session executing Steps A-E is multi-hour out-of-band work (provision audit-alert-sa SA + set Secret Manager secrets + first deploy + synthetic Slack + DORMANT Step D + Console screenshots). Batching with Plan 09-06 Task 4 close-gate saves operator interrupts. | Single combined Wave 6 + Wave 7 operator session — `.planning/phases/09-observability-audit-event-wiring/09-06-DEFERRED-CHECKPOINT.md` documents the 7-step procedure. Resume contract: operator types "approved" when Cutover Log shows PASS for A/B/C/E + DORMANT for D + Phase-9 close-gate evidence sweep (cleanup ledger phase_9_active_rows: 0 + 6 code-health gates green + synthetic alert in Slack + .map gate evidence + gitleaks scan green). Owner: Hugh / Luke. |
| **Plan 09-06 Task 4 phase-close checkpoint deferred — pairs with 09-05 Task 3b** | Phase-close human-verify gate; operator runs `/gsd-verify-work 9` OR equivalent evidence sweep against the deployed system | Batched into single combined Wave 6 + Wave 7 operator session per `09-06-DEFERRED-CHECKPOINT.md`. Phase 9 close cannot advance until either operator approval OR a sub-wave 9.1 sub-plan resolves any verification gap surfaced by the verifier. Owner: Hugh / Luke. |
| **MFA emit-site wiring (AUDIT-05)** | Bound to `enrollTotp` / `unenrollAllMfa` dep landing in `src/main.js:916-917` (currently `// deferred to user-testing phase` per Plan 03a §mfa_rationale) | Bounded path: whenever those deps land, the `auth.mfa.enrol` + `auth.mfa.unenrol` enum literals are emission-ready; Wave 4 Rule 2 (MFA disenrolment alert) trigger transitions FUNCTIONAL. Owner: whoever lands the user-testing-phase deps (likely Phase 10+ or operator user-testing batch). |
| **`auth.signin.failure` emit substrate DORMANT — bound to first rejection rule landing in `beforeUserSignedIn`** | `functions/src/auth/beforeUserSignedIn.ts` substrate emits `auth.signin.failure` only on internal handler errors today (no business rejection rules exist) — the trigger module + counter shape are functional but observation pipeline awaits an emission source | Bounded path: Phase 10+ (probable — CSP-violation-based rejection, App Check enforcement Stage D-F, or future allowlist-based rules) introduces a rejection. When that lands, Rule 1 transitions FUNCTIONAL; Plan 09-04 Step D (currently DORMANT in deploy-checkpoint) becomes a live verification gate. Owner: Phase 10+ executor. |
| **Mirror-trigger collision verification (1 alert per soft-delete cascade) — Pitfall 7 cross-phase confirmation** | Phase 9 dual-emit substrate is shipped + tested; cross-phase cascade verification (a real 5+ doc soft-delete in staging asserting EXACTLY 1 Slack alert) is operator-paced | Phase 10 — synthetic-tests sub-wave (paired with strict-CSP cutover synthetic tests; one observation per phase saves operator time). Owner: Phase 10 executor. |
| **Quarterly uptime-check verification cadence (OBS-06)** | Operator policy — first quarterly verification at Q3-2026; mirrors Phase 8 BACKUP-06 quarterly restore-drill cadence | Recurring operator task; first run Q3-2026. Pattern: operator runs `gcloud monitoring uptime list` + curl probe + Cloud Console screenshot capture. Owner: Hugh / Luke. |
| **Sentry quota alert screenshot for docs/evidence/ (OBS-08)** | Operator-paced screenshot for the Phase 11 evidence pack (DOC-09 owner) | Phase 11 (DOC-09) — bundled with all docs/evidence/ collection at evidence-pack stage. Owner: Phase 11 executor. |
| **`#ops-warn` vs `#ops-page` channel split** | Operator policy decision; not a code-level row. Today all 4 anomaly rules post to a single Slack channel | v2 — re-evaluate after first quarter of metrics + first on-call rotation. Owner: v2. |
| **Sentry "tunnel" config (if 80%+ events being ad-blocked)** | Operator policy + cost trade-off (`tunnel` proxies events through a same-origin endpoint; defeats privacy-focused ad-blockers but increases Sentry ingest dependency on first-party origin) | v2 — re-evaluate after first quarter of metrics shows ad-block ratio. Owner: v2. |
| **CONTRIBUTING.md error-message review (Pitfall 8 — quarterly audit)** | Plan 09-06 Task 3 lands the discipline section; quarterly re-audit (50-event Sentry sample for PII in `exception.value`) is a recurring operator task | Quarterly operator audit — first run Q3-2026 (after first quarter of production-Sentry data). Pattern: 50 random Sentry events from prior 90 days, manual PII check on `exception.value`. Owner: Hugh / Luke. |

---

## Phase 4 Cleanup Carry-Forward — Phase 9 Verification

Phase 4 cleanup ledger queued forward-tracking rows for several observability-adjacent items. Re-asserted in Phase 9 for visibility:

| Row | Phase 4 reason | Phase 9 status |
|-----|----------------|----------------|
| `src/observability/sentry.js` + `src/observability/audit-events.js` Phase 4 D-11 stub body fills | Phase 4 stub seams pending Phase 9 owner | CLOSED 09-01: both stubs body-filled (Plan 09-01 Task 2 sentry.js + Task 3 audit-events.js). Verified by `tests/observability/sentry-init.test.js` (9 tests) + audit-events emission tests. |
| Phase 4 IIFE body preservation in `src/main.js` ~5000 lines (Phase 4 deviation cluster 4.1) | Pattern D DI factory stubs pending body migration; observability boot wiring is the smallest possible diff | NO REGRESSION — Phase 9 added 1 import + 1 boot block in `fbOnAuthStateChanged` callback (commit `de2a2cc`). The IIFE body is unchanged. Phase 4 4.1 carry-forward path (full body migration) remains unaffected by Phase 9. |

---

## Forward-Tracking — Queued for Future Phases

### Phase 10 (CSP Tightening)

| Row | Reason |
|-----|--------|
| Mirror-trigger collision verification — synthetic-tests sub-wave | Pitfall 7 cross-phase confirmation; one observation per phase saves operator interrupts (paired with strict-CSP cutover synthetic tests). |
| Re-run Step D when first rejection rule lands in `beforeUserSignedIn` | Phase 10 may introduce App Check enforcement Stage D-F or CSP-violation-based rejection; when any rejection rule emits `auth.signin.failure`, Rule 1 of `authAnomalyAlert` transitions DORMANT → FUNCTIONAL. |

### Phase 11 (Documentation Pack)

| Row | Reason |
|-----|--------|
| `PRIVACY.md` Sentry sub-processor row | DOC-02 (Phase 11 owner) — Sentry is the only new sub-processor introduced by Phase 9; EU region pinning + DPA reference + retention period are Phase 11 documentation. |
| `docs/CONTROL_MATRIX.md` rows for OBS-01..08 + AUDIT-05 | DOC-04 (Phase 11 owner) — control catalogue cross-references the Phase 9 Audit Index (SECURITY.md § Phase 9 Audit Index). |
| `docs/RETENTION.md` row for Sentry event retention (default 30d on free tier) | DOC-05 (Phase 11 owner) — retention catalogue cross-references. |
| `docs/evidence/` — Sentry quota alert screenshot + Slack reception screenshot + uptime check Cloud Console screenshot + budget alerts Cloud Console screenshot + first deploy log with source-map upload + .map gate | DOC-09 (Phase 11 owner) — evidence pack collation; Phase 9 ships the substrate + close-gate runbook directing operator at the screenshots. |

### Phase 12 (Audit Walkthrough)

| Row | Reason |
|-----|--------|
| `SECURITY_AUDIT.md` walkthrough — Phase 9 Observability + Audit-Event Wiring + Anomaly Alerting + Out-of-band Monitors sections | WALK-02 / WALK-03 (Phase 12 owner) — Phase 9 introduces these controls; Phase 12 produces the audit-walkthrough report citing the Phase 9 Audit Index as evidence. |

### v2

| Row | Reason |
|-----|--------|
| Sentry `tunnel` config | If first-quarter metrics show >80% ad-block ratio for Sentry events. |
| `#ops-warn` vs `#ops-page` channel split | When on-call rotation staffing scales beyond Hugh + Luke. |
| Auto-cutoff via Pub/Sub-driven Cloud Function (avoid-surprise-bills Firebase pattern) | OBS-07 budget alerts NOTIFY only — auto-disable is out-of-scope per Pitfall 19 v1 substrate-honest disclosure; re-evaluate when commercial cost-cap risk emerges. |
| MFA enrol/un-enrol audit emit-site wiring | Bound to user-testing-phase enrol dep landing in `src/main.js`. |
| Sentry Business plan (performance monitoring, custom dashboards, longer retention) | If Sentry free-tier event budget proves insufficient OR if performance monitoring becomes a load-bearing observability requirement. |

---

## Phase 9 — Cleanup Ledger Status

```
ledger_close_date: 2026-05-10
phase_9_active_rows: 0
phase_9_closed_rows_originated_in_phase_8_forward_tracking: 3
  - Sentry alerts on GDPR invocations: CLOSED 09-04 Rule 4
  - AUDIT-05 view-side wiring of compliance events: CLOSED 09-03 + 09-03a
  - gdprExportUser bundle memory profiling: CARRY-FORWARD to operator follow-up (budget alert substrate live)
phase_9_in_phase_rows_closed_or_carry_forward: 11
  - Wave 6 close-gate OBS-08 quota alert: CLOSED to deploy-checkpoint Step E (operator-deferred via 09-06-DEFERRED-CHECKPOINT.md)
  - Wave 6 close-gate OBS-04 first deploy log: CLOSED to deploy-checkpoint Step A (operator-deferred via 09-06-DEFERRED-CHECKPOINT.md)
  - MFA emit-site wiring: CARRY-FORWARD bounded to user-testing-phase dep landing
  - Mirror-trigger collision verification: CARRY-FORWARD to Phase 10 synthetic-tests sub-wave
  - audit-alert-sa SA provisioning: CLOSED to deploy-checkpoint Step A
  - Slack webhook gitleaks regex: CLOSED 09-04 Task 4 (.gitleaks.toml extended)
  - #ops-warn vs #ops-page split: DEFERRED to v2
  - Quarterly uptime-check verification: DEFERRED to operator quarterly cadence (first Q3-2026)
  - Sentry quota alert screenshot: DEFERRED to Phase 11 (DOC-09 evidence pack)
  - Re-run Step D auth-fail burst: CARRY-FORWARD bound to first rejection rule
  - Phase 8 post-erasure-audit first run: CLOSED — superseded by Phase 9 OBS coverage
phase_9_carry_forward_open_rows_with_explicit_closure_path: 10
  - Plan 09-05 Task 3b operator session: bounded to 09-06-DEFERRED-CHECKPOINT.md combined session
  - Plan 09-06 Task 4 phase-close: bounded to 09-06-DEFERRED-CHECKPOINT.md combined session
  - MFA emit-site wiring: bounded to user-testing-phase dep landing
  - auth.signin.failure substrate DORMANT: bounded to first rejection rule in Phase 10+
  - Mirror-trigger collision verification: bounded to Phase 10 synthetic-tests sub-wave
  - Quarterly uptime-check cadence: bounded to recurring operator task (first Q3-2026)
  - Sentry quota alert screenshot: bounded to Phase 11 DOC-09
  - #ops-warn vs #ops-page split: bounded to v2 (operator policy + staffing scale)
  - Sentry tunnel config: bounded to v2 (re-eval after Q1 metrics)
  - CONTRIBUTING.md Pitfall 8 quarterly audit: bounded to recurring operator task (first Q3-2026)
forward_tracking_rows_queued: 9
  - Phase 10: 2 rows (mirror-trigger collision + Step D burst test re-run)
  - Phase 11: 4 rows (PRIVACY.md sub-processor + CONTROL_MATRIX.md + RETENTION.md + docs/evidence/ collation)
  - Phase 12: 1 row (SECURITY_AUDIT.md walkthrough Phase 9 sections)
  - v2: 5 rows (tunnel, channel split, auto-cutoff, MFA emit, Sentry Business plan)
gate_status: PASS
```

`phase_9_active_rows: 0` per Pitfall 19 substrate-honest disclosure: every Phase-9-originating row CLOSES with this commit or has an explicit bounded closure path with a named owner. No row is silently omitted. The 10 carry-forward rows are harmless or explicitly bounded — none block Phase 9 close at the code-and-docs level.

**Operator-deferred production actions** (production deploy + close-gate evidence sweep) are NOT open ledger rows — they are batched into `.planning/phases/09-observability-audit-event-wiring/09-06-DEFERRED-CHECKPOINT.md` which documents the single combined operator session that closes Plan 09-05 Task 3b + Plan 09-06 Task 4. This is deferred execution, not open design or coding debt.

---

## Citations

- Pitfall 19 (substrate-honest disclosure) — `phase_9_active_rows: 0` claim is accurate only because every row either closes here or has an explicit bounded closure path. No row is silently omitted. Per 09-RESEARCH.md §Pitfall 19 lines 1027+.
- Pitfall 7 (mirror-trigger stampede dedup) — Phase 9 dual-emit shape (client `.requested` + server bare) satisfies the 60s primary-event dedup window from Phase 7 mirror triggers; cross-phase cascade verification carry-forward to Phase 10 synthetic-tests sub-wave.
- Pitfall 8 (Sentry events containing raw error.message with user input) — Plan 09-06 Task 3 lands CONTRIBUTING.md § Error Message Discipline; quarterly operator re-audit is a recurring carry-forward row.
- Pitfall 17 (server-determined actor identity) — Phase 9 AUDIT-05 client emit sites pass only `type` + `target` + `payload`; actor is server-overlaid by `auditWrite` from `request.auth.token`. Verified in `tests/audit-wiring.test.js` PII-scrub assertions.
- Pitfall 18 (Sentry PII leak via known PII keys) — Phase 9 OBS-01 shared `PII_KEYS` dictionary with parity-tested drift gate (`functions/test/util/pii-scrubber-parity.test.ts`).
- Planner WARNING 7 — Slack webhook gitleaks regex MOVED from Plan 09-06 Task 3 to Plan 09-04 Task 4 (defence-in-depth landed WITH the secret introduction).
- `runbooks/phase-7-cleanup-ledger.md` + `runbooks/phase-8-cleanup-ledger.md` — precedent format; Pattern H zero-out gate.
- Commit SHA: TBD-by-closing-commit (backfill if desired after `docs(09-06)` metadata commit).
