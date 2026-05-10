---
phase: 10-csp-tightening-second-sweep
plan: 03
subsystem: infra
tags: [csp, soak, operator-paced, cloud-logging, runbook, preflight, host-07, pitfall-16-stage-b, pitfall-8-selective-deploy, pitfall-19-substrate-honest]

# Dependency graph
requires:
  - phase: 10-csp-tightening-second-sweep
    provides: "Plan 10-02 tightened firebase.json CSP-RO directive value (style-src 'self' / connect-src + de.sentry.io / frame-src 'self') + 6 Phase 10 schema-test assertions pinning the shape (cspKey constant pattern); Plan 10-01 closed inline-style migration precondition (162 sites)"
  - phase: 09-observability-audit-event-wiring
    provides: "Plan 09-05/06 operator-runbook-with-Cutover-Log analog (runbooks/phase-9-deploy-checkpoint.md table shape with PASS/FAIL/PENDING/DORMANT markers + Pitfall 19 substrate-honest disclosure pattern)"
  - phase: 03-hosting-cutover-baseline-security-headers
    provides: "cspReportSink Cloud Function (READ-ONLY at Phase 10; FN-04-pinned to csp-sink-sa per Phase 7 Wave 5 rebind); cspreportsink Cloud Run service-name lowercase quirk verified at runbooks/hosting-cutover.md:69-73; functions/src/csp/filter.ts extension-origin pre-filter (chrome-extension/moz-extension/safari-web-extension dropped before logger.warn)"
  - phase: 07-cloud-functions-app-check-enforcement
    provides: "Pitfall 8 selective-deploy substrate (firebase deploy --only hosting only; mass-deploy forbidden in production by Phase 7 Wave 5 cleanup-ledger)"
provides:
  - "runbooks/phase-10-csp-soak-bootstrap.md (308 lines): operator runbook for selective hosting deploy + 7-day Stage B soak observation"
  - ".planning/phases/10-csp-tightening-second-sweep/10-PREFLIGHT.md (138 lines): operator-fill audit log with Pre-conditions sign-off, Cycle 1+2 Soak Log tables (9 rows each), Day 0 verbatim header capture, Triage Incidents block, Wave 3 Close Decision binary gate"
affects: [10-04-csp-enforcement-flip, 10-05-hsts-preload-submission-and-security-md, phase-11-documentation-pack, phase-12-vendor-questionnaire-evidence-pack]

# Tech tracking
tech-stack:
  added: []  # No new libraries — runbook + preflight are documentation deliverables
  patterns:
    - "Operator-paced 7-day soak runbook structure: Pre-conditions / Step 1 (selective deploy) / Step 2 (post-deploy header verify) / Step 3 (daily Cloud Logging query × 7) / Step 4 (Day 7 close-out full-window query + decision gate) / Failure-Mode Triage / Citations"
    - "Pitfall 8 selective-deploy hard-coding in runbook: Step 1 specifies 'firebase deploy --only hosting' AND lists explicit DO NOT RUN commands (mass-deploy, --only functions, --only functions:cspReportSink) with rebind-verification recovery procedure"
    - "Pitfall 19 substrate-honest disclosure in operator-fill log: {{ ... }} placeholders for un-run rows; superseded triage cycles stay in table permanently; novel violation patterns escalate to sub-wave 10.x rather than silently re-classify into known modes"
    - "Cycle-N Soak Log convention for triage-and-restart: cycle-1 rows STAY in table after restart (audit substrate); cycle-2 Day 0 = cycle-1 failing day's date; CLEAN status appears at most once (the close-out row of the succeeding cycle); fix-commit-SHA cited in Notes column for audit"
    - "Failure-Mode Triage decision-tree table (4 known modes): Sentry sub-host A4 (10-RESEARCH.md), missed inline-style (cycle-1 leakage from Plan 10-01 + new code), unexpected popup (Phase 6 D-09 regression), extension noise (Phase 3 substrate regression — out of Phase 10 scope)"

key-files:
  created:
    - "runbooks/phase-10-csp-soak-bootstrap.md (308 lines): operator runbook"
    - ".planning/phases/10-csp-tightening-second-sweep/10-PREFLIGHT.md (138 lines): operator-fill audit log"
  modified: []  # Pure-additive documentation wave; no code or schema changes

key-decisions:
  - "Runbook structure mirrors Phase 9 deploy-checkpoint shape (Pre-flight checklist + numbered Steps + Cutover Log table + Rollback procedure + Operator stop signal + Citations) rather than Phase 3 hosting-cutover shape (Prerequisites + Pre-cutover Smoke Checklist + Cutover Steps + DNS Revert Procedure + Day-14 Cleanup). Reason: Phase 9's shape is closer to Wave 3's actual operator workflow (deploy + observe + decide), while Phase 3's shape is closer to Wave 4's enforcement-flip workflow (one-shot cutover + rollback). 10-PATTERNS.md §File 5 confirms Wave 4's runbook will use a Phase 3-derived shape; Wave 3 here uses a Phase 9-derived shape."
  - "Failure-Mode Triage table includes the 'extension noise' row even though it's explicitly NOT a Phase 10 issue. Reason: operator running gcloud queries WILL see chrome-extension blockedUri values if they leak through Phase 3's filter, and without explicit guidance they may incorrectly restart the soak. The row tells them: do NOT restart on extension-noise; open a forward-tracking row in 10-cleanup-ledger; soak proceeds. This is substrate-honest disclosure of a known cross-phase boundary."
  - "Step 3 specifies --freshness=24h for daily checks; Step 4 specifies --freshness=7d --limit=200 for close-out. Reason: daily checks are bounded windows operator runs at irregular intervals (real calendar time, not 24h-precise); close-out catches anything daily checks may have missed at window edges. Note: --limit raised from 50 to 200 at close-out to handle high-volume violation scenarios in worst case (e.g. a missed inline-style site producing thousands of events per day)."
  - "Soak Log table has Cycle 1 fully-populated (9 rows) AND Cycle 2 skeleton (9 rows) pre-laid-out in the preflight, even though most cycles will not need Cycle 2. Reason: substrate-honest disclosure for first-cycle CLEAN runs is unchanged (Cycle 2 stays as `{{ ... }}` placeholder rows), but if Cycle 1 triggers a restart at, say, Day 4, the operator does NOT have to figure out how to extend the table mid-incident — the Cycle 2 rows are already structured with the right columns + an explicit 'Cycle 1 SUPERSEDED' Notes prompt. Adding cycle blocks is the documented behaviour for Cycle 3+ if multiple restarts occur."
  - "Day 0 verbatim header capture block is a distinct preflight section (separate from the Soak Log table). Reason: the full curl -sI response is multi-line and would not fit in the table's Evidence column; operator needs to paste it verbatim for audit anchor. The Soak Log Day 0 row Evidence column references this block ('full header captured below') rather than embedding the value."

patterns-established:
  - "Pattern 1 — Pitfall 8 hard-coded selective-deploy in operator runbook: Step 1.2 lists FORBIDDEN commands explicitly with reasoning (csp-sink-sa rebind risk + Phase 7 Wave 5 cleanup-ledger forbidding mass-deploy in prod). Recovery procedure (gcloud functions describe + SA verification + sub-wave 10.x rebind) is documented inline so an accidental forbidden-deploy doesn't need a fresh research pass."
  - "Pattern 2 — Cycle-N Soak Log audit structure: cycle blocks accumulate across triage-and-restart events. Original cycle's failing rows STAY in the table marked SUPERSEDED rather than being deleted; cycle-2 Day 0 carries the fix-commit-SHA in Notes; CLEAN status appears at most once per overall checkpoint (the close-out row of the cycle that succeeds). This is the Pitfall 19 substrate-honest pattern applied to a multi-attempt audit log."
  - "Pattern 3 — Failure-Mode Triage table as decision-tree substrate: 4 rows = 4 known violation patterns from 10-RESEARCH.md, each with (Symptom regex, Likely Cause prose, Fix prose with numbered sub-steps). Operator can match an observed jsonPayload.report to the symptom column without re-deriving classification logic during incident pressure. Novel patterns (no symptom match) explicitly escalate to sub-wave 10.x — they are NOT silently mapped to the 'closest' known row."

requirements-completed: []  # HOST-07 remains [~] (substrate-complete-pending) until Plan 10-04 enforcement flip lands; this Wave 3 plan authors substrate for the 7-day soak that gates Wave 4 — the actual soak observation + close-out is Task 2 (operator-pending)

# Metrics
duration: ~12min (Task 1 autonomous portion only — Task 2 is operator-paced calendar time)
completed: 2026-05-10
status: AUTONOMOUS-COMPLETE-CHECKPOINT-PENDING
---

# Phase 10 Plan 03: CSP-RO Tightened Soak Bootstrap (Wave 3 Autonomous Portion) Summary

**Operator runbook for selective hosting deploy + 7-day Stage B Cloud Logging soak (Pitfall 16 three-stage rollout) authored at runbooks/phase-10-csp-soak-bootstrap.md (308 lines, 4 numbered steps + Failure-Mode Triage); operator-fill audit log skeleton authored at 10-PREFLIGHT.md (138 lines, Pre-conditions sign-off + Cycle 1+2 Soak Log + Triage Incidents + Wave 3 Close Decision binary gate); Task 2 (operator deploy + 7-day calendar soak) is checkpoint:human-action and remains pending — the actual production deploy and observation are operator-paced and cannot be automated by an executor agent.**

## Performance

- **Duration (autonomous portion):** ~12 min
- **Started:** 2026-05-10T21:00:00Z (approx)
- **Completed (Task 1):** 2026-05-10T21:05:30Z
- **Tasks autonomous:** 1 of 2 (Task 1 done; Task 2 = operator checkpoint)
- **Files created:** 2
- **Files modified:** 0

## Accomplishments

- `runbooks/phase-10-csp-soak-bootstrap.md` authored at 308 lines (>120 line min_lines from plan must-haves) with the full operator workflow:
  - Pre-conditions checklist (8 items including Plan 10-01 grep + Plan 10-02 schema test + git history check + gcloud/firebase auth + CI green + calendar window scheduling + preflight buffer open)
  - Step 1 (~5 min): `firebase deploy --only hosting --project bedeveloped-base-layers` + Pitfall 8 explicit DO-NOT-RUN list + csp-sink-sa rebind verification recovery + deploy timestamp/SHA capture
  - Step 2 (~2 min): `curl -sI https://baselayers.bedeveloped.com | grep -i content-security` + 6-item verification checklist (header KEY = report-only / style-src 'self' no unsafe-inline / connect-src + de.sentry.io / frame-src 'self' no firebaseapp / Phase 3 substrate retained / report-uri /api/csp-violations) + 5-step failure handling escalation
  - Step 3 (×7 days, ~5 min/day): full gcloud logging read filter (`resource.type="cloud_run_revision" AND resource.labels.service_name="cspreportsink" AND severity=WARNING AND jsonPayload.message="csp.violation" AND jsonPayload.report.disposition="report"`) at `--freshness=24h --limit=50` + clean-soak signal interpretation + non-empty triage workflow + Soak Log row recording cadence
  - Step 4 (~5-10 min): close-out at `--freshness=7d --limit=200` + binary CLEAN/RESTART decision gate + Wave 4 authorisation signal
  - Failure-Mode Triage table: 4 rows (Sentry sub-host A4 from 10-RESEARCH §A4 / missed inline-style with single-line + multi-line grep / unexpected popup with Phase 6 D-09 cross-reference / extension noise as Phase 3 substrate regression) + novel-pattern escalation rule
  - Triage-and-restart Soak Log convention block (cycle-N audit substrate pattern)
  - Citations: HOST-07 + 4 Pitfalls (8/10A/10B/16/19) + 5 cross-runbook references + ASVS L2 V14.4.1 / ISO 27001 A.5.7 / SOC 2 CC6.6 / GDPR Art. 32(1)(b)
- `.planning/phases/10-csp-tightening-second-sweep/10-PREFLIGHT.md` authored at 138 lines with operator-fill structure:
  - Frontmatter (phase=10, wave=3, plan=10-03, owner=operator, status=pending-soak, runbook back-reference)
  - Pre-conditions sign-off section (8 checkboxes mirroring runbook Pre-conditions for operator self-verification + sign-off operator identity field)
  - Soak Log Cycle 1 (9-row table: Day 0 deploy + Day 1-7 daily + Day 7 close-out) with all cells as `{{ ... }}` placeholders
  - Day 0 verbatim header capture block (separate from table — multi-line curl response paste target)
  - Soak Log Cycle 2 skeleton (9 rows, pre-laid-out for triage-and-restart cases — empty if Cycle 1 runs CLEAN)
  - Triage Incidents section template (Cycle / Day surfaced / Date / jsonPayload.report extract / failure mode classification / root cause / fix-commit-SHA / re-deploy timestamp / cycle-N start fields)
  - Wave 3 Close Decision binary gate (CLEAN → resume signal vs. restart → checkpoint stays open)
  - Forward-tracking rows queue (for Plan 10-05 SECURITY.md / cleanup-ledger pickup)
  - Citations to plan + research + Pitfall 19 + HOST-07
- Pitfall 8 selective-deploy boundary preserved: only documentation files created; zero firebase.json / functions/ / src/ modifications. cspReportSink Cloud Function (firebase.json line 38-39 rewrite + functions/src/csp/cspReportSink.ts) untouched and NOT redeployed.
- Pitfall 19 substrate-honest disclosure threaded throughout: `{{ ... }}` placeholders for un-run rows, superseded cycles stay in table permanently, novel triage cases escalate rather than silently re-classify, Day 0 timestamps captured at deploy moment (not back-filled at close-out).
- `npm test -- --run firebase-config`: 24/24 green (sanity — Wave 2 schema-test invariants preserved; this is documentation-only).

## Task Commits

1. **Task 1: Author runbooks/phase-10-csp-soak-bootstrap.md + 10-PREFLIGHT.md skeleton** — `ebd6c5d` (docs)

**Plan metadata:** _pending — final docs commit lands after this SUMMARY + STATE.md + ROADMAP.md edits_

**Task 2:** CHECKPOINT-PENDING — `checkpoint:human-action` — operator deploys Wave 2's tightened CSP-RO via runbook Step 1, runs daily soak per Step 3 for 7 calendar days, runs Step 4 close-out. Calendar time cannot be automated by an executor agent.

## Files Created

- `runbooks/phase-10-csp-soak-bootstrap.md` (308 lines, NEW) — Operator runbook for selective hosting deploy + 7-day Stage B soak observation. Sections: Pre-conditions / Step 1 (selective deploy + Pitfall 8 explicit forbidden list + recovery) / Step 2 (curl header verification checklist + 5-step failure handling) / Step 3 (daily Cloud Logging query at --freshness=24h with classify-and-fix workflow for non-empty results) / Step 4 (Day 7 close-out at --freshness=7d --limit=200 with binary CLEAN/RESTART decision gate) / Failure-Mode Triage 4-row decision-tree table (Sentry sub-host A4 / missed inline-style / unexpected popup / extension noise) / Triage-and-restart Soak Log convention / Citations (HOST-07 + 5 Pitfalls + cross-runbook references + compliance frameworks).
- `.planning/phases/10-csp-tightening-second-sweep/10-PREFLIGHT.md` (138 lines, NEW) — Operator-fill audit log. Frontmatter (phase=10, wave=3, plan=10-03, status=pending-soak) + Pre-conditions sign-off (8 checkboxes mirroring runbook) + Soak Log Cycle 1 (9 rows: Day 0 deploy + Day 1-7 daily + Day 7 close-out) + Day 0 verbatim header capture block + Cycle 2 skeleton (9 rows pre-laid-out for restart cases) + Triage Incidents template + Wave 3 Close Decision binary gate + forward-tracking rows queue + Citations.

## Files Modified

None — pure-additive documentation wave.

## Decisions Made

- **D-01: Runbook structure mirrors Phase 9 deploy-checkpoint shape, not Phase 3 hosting-cutover shape.** Reason: Wave 3's operator workflow is deploy + observe + decide (Phase 9 analog), not one-shot cutover + rollback (Phase 3 analog). 10-PATTERNS.md §File 5 confirms Wave 4's runbook will use a Phase 3-derived shape (one-shot enforcement flip + rollback procedure). Two distinct runbooks for two distinct operator workflows.
- **D-02: Failure-Mode Triage includes 'extension noise' row even though it's explicitly NOT a Phase 10 issue.** Reason: operator WILL observe chrome-extension blockedUri values if Phase 3's filter regresses; without explicit guidance, they may incorrectly restart the soak. Substrate-honest cross-phase-boundary disclosure: do NOT restart on extension noise; open forward-tracking row in 10-cleanup-ledger; soak proceeds.
- **D-03: --freshness=24h for daily / --freshness=7d --limit=200 for close-out.** Reason: daily checks are operator-irregular (not 24h-precise), so a single end-of-window 7d query catches edge cases. --limit raised at close-out to handle worst-case high-volume scenarios (e.g. a missed inline-style site producing thousands of events).
- **D-04: Cycle 2 skeleton pre-laid-out in preflight even when most cycles will be CLEAN on first try.** Reason: substrate cost is zero (skeleton stays as `{{ ... }}` placeholders); incident benefit is high (operator does not have to extend the table mid-incident under triage pressure). Cycle 3+ blocks added below as needed for multiple restarts.
- **D-05: Day 0 verbatim header capture as separate preflight section.** Reason: full curl -sI response is multi-line; doesn't fit Soak Log Evidence column; needs verbatim audit anchor. Soak Log Day 0 row Evidence column references the separate block ('full header captured below').

## Deviations from Plan

None — plan executed exactly as written for Task 1 (autonomous portion). All `<must_haves>` satisfied:

- runbook exists with gcloud logging soak-observation query + interpretation guide ✓
- 10-PREFLIGHT.md exists with `## Soak Log` section ready for operator-fill ✓
- runbook >= 120 lines (308 actual) ✓
- runbook contains Step 1 selective hosting deploy with exact `firebase deploy --only hosting --project bedeveloped-base-layers` command ✓
- runbook contains Step 3 daily soak observation with gcloud logging read command ✓
- runbook Failure-Mode Triage section has 4 documented failure-mode rows (plan asked for ≥3) ✓
- 10-PREFLIGHT.md `## Soak Log` table has 9 rows for Cycle 1 (Day 0 deploy + Day 1-6 daily + Day 7 close-out) — plan asked for "Day 0 + Day 1-7 daily + Day 7 close-out" which equals 9 rows; Cycle 2 skeleton adds another 9 for restart cases ✓
- Vitest schema test green (24/24 firebase-config) ✓

The Task 2 checkpoint is intentionally NOT executed — it is `checkpoint:human-action` per plan frontmatter (`autonomous: false`), and the calendar-time 7-day soak cannot be automated by an executor agent.

## Issues Encountered

None — documentation deliverables landed cleanly. Pre-commit Prettier formatter + gitleaks ran without intervention. Line-ending warnings (LF will be replaced by CRLF) are normal Windows-host behaviour and do not affect file content.

## User Setup Required

None at the autonomous-portion level — Task 1 is documentation only, no external service configuration.

**For Task 2 (operator checkpoint):** operator follows `runbooks/phase-10-csp-soak-bootstrap.md` Pre-conditions checklist. The runbook itself is the user-setup substrate.

## Next Phase Readiness

**Plan 10-04 (Wave 4 — enforcement flip) is BLOCKED on Task 2 close.** Wave 4 cannot run until Wave 3's Day 7 close-out marks `CLEAN` (zero non-extension-origin violations across the 7-day window). If Cycle 1 produces violations, the soak restarts and Wave 4 stays blocked across all subsequent cycles until one closes CLEAN.

**Plan 10-05 (Wave 5 — SECURITY.md + cleanup-ledger close-out) inherits the forward-tracking rows queue** from `10-PREFLIGHT.md ## Forward-tracking rows`. Any Wave 3 observations (e.g. Sentry ingest-subdomain confirmation, novel violation patterns escalated to sub-wave 10.x, extension-noise filter regressions) propagate into Plan 10-05's documentation pass.

**Open Question A4 (Sentry ingest-subdomain assumption)** — Wave 3 Cycle 1 Day 1-7 will resolve this. If `https://de.sentry.io` plain hostname is correct, soak runs CLEAN. If it's a project-specific ingest subdomain (e.g. `https://o<orgId>.ingest.de.sentry.io`), Cycle 1 Day 1 will surface a `connect-src` violation with that exact origin in `blockedUri`; Triage row 1 of the runbook captures the fix workflow + restart cycle.

**Pitfall 16 Stage B observability gap closes when Wave 3 closes CLEAN.** Phase 3's Stage A soak (RO with `'unsafe-inline'`) was silent on the directive shapes about to be enforced; Wave 3's Stage B soak under the tightened shape is the gating substrate that makes Wave 4's enforcement flip safe.

## Self-Check: PASSED

- File `runbooks/phase-10-csp-soak-bootstrap.md` — FOUND (308 lines via wc -l)
- File `.planning/phases/10-csp-tightening-second-sweep/10-PREFLIGHT.md` — FOUND (138 lines via wc -l)
- Commit `ebd6c5d` — FOUND (`docs(10-03): author phase-10-csp-soak-bootstrap runbook + 10-PREFLIGHT.md skeleton`)
- Tests: `npm test -- --run firebase-config` returns `24 passed (24)` — VERIFIED

---
*Phase: 10-csp-tightening-second-sweep*
*Plan: 10-03 (Wave 3 — autonomous portion COMPLETE; Task 2 = operator checkpoint pending)*
*Completed (autonomous): 2026-05-10*
