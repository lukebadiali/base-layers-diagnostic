---
phase: 10-csp-tightening-second-sweep
plan: 04
subsystem: infra
tags: [csp, enforcement-flip, operator-cutover, runbook, schema-test, host-07, pitfall-16-stage-c, pitfall-8-selective-deploy, pitfall-19-substrate-honest, describe-skip-pre-stage]

# Dependency graph
requires:
  - phase: 10-csp-tightening-second-sweep
    provides: "Plan 10-02 tightened firebase.json CSP-RO directive value (style-src 'self' / connect-src + de.sentry.io / frame-src 'self') + 6 Phase 10 schema-test assertions pinning the shape under the RO key; Plan 10-03 authored runbooks/phase-10-csp-soak-bootstrap.md (Wave 3 operator runbook for selective hosting deploy + 7-day Stage B soak) + 10-PREFLIGHT.md (operator-fill audit log skeleton with Soak Log Cycle 1+2 tables + Day 0 verbatim header capture + Triage Incidents template + Wave 3 Close Decision binary gate)"
  - phase: 03-hosting-cutover-baseline-security-headers
    provides: "runbooks/hosting-cutover.md (Phase 3 — primary structural analog at 432 lines; Plan 10-04 cutover runbook copies the section structure: Prerequisites / Pre-cutover Smoke Checklist / Cutover Steps with time estimates / Cutover Log table / Rollback Procedure / Citations); cspReportSink Cloud Function (READ-ONLY at Plan 10-04; FN-04-pinned to csp-sink-sa per Phase 7 Wave 5 rebind) — Wave 4 commits forbidden from --only functions deploys per Pitfall 8 substrate"
  - phase: 09-observability-audit-event-wiring
    provides: "Plan 09-05/06 operator-runbook-with-Cutover-Log analog (runbooks/phase-9-deploy-checkpoint.md tabular Cutover Log shape with PASS/FAIL/PENDING/DORMANT markers + Pitfall 19 substrate-honest disclosure pattern)"
provides:
  - "runbooks/csp-enforcement-cutover.md (302 lines): Wave 4 operator runbook for the single-knob CSP enforcement flip — full Prerequisites + Pre-cutover Smoke Checklist + 7 numbered Cutover Steps + Cutover Log paste-ready template (rows A-E with A/B/C in scope this wave) + single-knob Rollback Procedure + Post-deploy 7-day soak forward to Plan 10-05 + Citations"
  - "tests/firebase-config.test.js: pre-staged describe.skip block with 6 enforced-shape assertions waiting for Task 2's un-skip token deletion — Task 2 operator's test-file edit shrinks to two deletions (delete `.skip` on the Wave 4 describe + delete the Wave 2 RO describe block) instead of authoring 8+ lines of new test code under deploy pressure"
affects: [10-05-hsts-preload-submission-and-security-md, phase-11-documentation-pack, phase-12-vendor-questionnaire-evidence-pack]

# Tech tracking
tech-stack:
  added: []  # No new libraries — runbook + describe.skip block are documentation/test deliverables
  patterns:
    - "Single-knob enforcement-flip operator runbook structure: Prerequisites (4 sub-checklists) / Pre-cutover Smoke Checklist (5 targets under existing RO state to surface latent violations BEFORE the flip) / Cutover Steps 1-7 (key flip / un-skip describe / local verify / selective hosting deploy / curl smoke / 5-target smoke matrix under enforcement / Cutover Log update) / Cutover Log paste-ready template (5-row tabular form with substrate-honest PENDING markers for D+E) / Rollback Procedure (single-knob revert + redeploy ~5 min) / Post-deploy 7-day soak forward / Citations"
    - "Pre-staged describe.skip pattern for operator-paced cutovers: autonomous portion authors the new describe block under describe.skip with the post-cutover assertions; operator session deletes the .skip token + the superseded predecessor describe block in a single commit. Net delta: zero new test code authored under deploy pressure; the assertion shape is settled at planning time, not at deploy time."
    - "Pitfall 8 explicit-forbidden-deploys block in operator runbook: Step 4 lists FORBIDDEN commands (mass-deploy, --only functions, --only functions:cspReportSink, --only firestore, --only storage) with reasoning + recovery procedure cross-reference (back to Plan 10-03's runbook Step 1.4 SA rebind verification)"
    - "Pitfall 19 substrate-honest disclosure threaded through Cutover Log template: rows D + E (securityheaders.com A+ rating + 7-day post-enforcement soak) explicitly carry `{{ PENDING }}` markers for Plan 10-05 close-out rather than silent omission"
    - "5-target smoke matrix as Cutover Log Row C evidence: per-target PASS/FAIL recorded individually (1=sign-in / 2=dashboard / 3=charts / 4=upload / 5=chat) so a single-target regression is auditable to the specific user-flow that broke"

key-files:
  created:
    - "runbooks/csp-enforcement-cutover.md (302 lines): Wave 4 operator runbook for single-knob enforcement flip"
  modified:
    - "tests/firebase-config.test.js: append PLAN 10-04 WAVE 4 NOTE banner + new describe.skip block (6 enforced-shape assertions pre-staged, awaiting Task 2 un-skip)"

key-decisions:
  - "D-01: Pre-stage the enforced-shape describe under describe.skip rather than leaving Task 2 to author new test code under deploy pressure. Reason: vitest's describe.skip API is well-supported (skipped tests show as SKIP markers in output, count is preserved); operator session's test-file edit shrinks from 8+ lines of new code to two deletions (delete .skip + delete Wave 2 RO describe). The same approach is documented in 10-PATTERNS.md §File 3 Wave 4 as the planner-recommended path."
  - "D-02: Runbook copies Phase 3 hosting-cutover.md section structure (Prerequisites / Pre-cutover Smoke / Cutover Steps / Rollback Procedure) rather than Phase 9 deploy-checkpoint.md structure (numbered verification gates). Reason: Wave 4's workflow is one-shot cutover + rollback (Phase 3 analog), not deploy + observe + decide (Phase 9 analog — that was Plan 10-03's shape). 10-PATTERNS.md §File 5 explicitly confirmed this — two distinct runbook shapes for two distinct operator workflows."
  - "D-03: Cutover Log uses Phase 9's tabular shape with explicit `{{ PENDING }}` markers for rows D (securityheaders.com A+) and E (7-day post-enforcement soak) rather than free-form prose. Reason: 5 verification gates with mixed in-scope/forward-deferred status need substrate-honest disclosure (Pitfall 19); a tabular form makes the row-by-row status auditable, and PENDING markers correctly signal that Plan 10-05 owns those rows rather than that they were silently skipped."
  - "D-04: 5-target smoke matrix records per-target PASS/FAIL individually in Cutover Log Row C evidence column. Reason: a smoke that fails on target 4 only (document upload — likely connect-src missed firebasestorage origin) carries different rollback context than a smoke that fails on target 2 only (dashboard — likely style-src violation from a missed Wave 1 inline-style site). Per-target evidence preserves that diagnostic information for incident review."
  - "D-05: Step 2 operator instructions include an OPTIONAL step (c) for swapping the security-headers it.each() array entry from RO key string to enforced key string. Reason: pre-flip the security-headers presence test asserts Content-Security-Policy-Report-Only is present. Post-flip that header is gone, so the test fails unless the array is updated. Optional because the array swap MAY have already been auto-handled by other test framework behaviour (e.g. case-insensitive match, header reading by index) — operator verifies via npm test in Step 3 and applies (c) only if needed."
  - "D-06: Runbook's Rollback Procedure recommends forward-fix on a sub-wave 10.x micro-plan over `git revert`. Reason: reverting risks losing the un-skip token edit, which Plan 10-04 Task 1 invested autonomous time in pre-staging. Forward-fix preserves the substrate (un-skipped describe stays; firebase.json key flips back; underlying issue gets a dedicated fix commit) and keeps the wave-4 retry trivial."

patterns-established:
  - "Pattern 1 — Pre-staged describe.skip for operator-paced test changes: autonomous executor lands the new describe block under describe.skip with all assertions targeting the post-cutover state; operator session deletes the .skip token and the superseded predecessor describe in a single commit. Net delta: zero new test code authored under deploy pressure; assertion shape is settled at planning time."
  - "Pattern 2 — Single-knob enforcement-flip runbook structure: 7 numbered Cutover Steps (key flip / un-skip describe / local verify / selective hosting deploy / curl smoke / 5-target smoke matrix / Cutover Log update) sized to ~45 min active operator work. Smaller surface than Phase 3's hosting-cutover (~1h) because the flip itself is one-knob; majority of time is the 5-target smoke matrix under enforcement."
  - "Pattern 3 — Cutover Log substrate-honest with PENDING markers for forward-deferred rows: rows that fall under a later wave's scope (e.g. securityheaders.com A+ rating closes in Plan 10-05) carry `{{ PENDING }}` rather than being silently omitted. Mirrors Phase 9 deploy-checkpoint.md Row D DORMANT pattern; Pitfall 19 substrate-honest disclosure applied to multi-wave audit substrates."

requirements-completed: []  # HOST-07 substrate now in place; full closure waits on Plan 10-04 Task 2 (operator enforcement flip — checkpoint:human-action) + Plan 10-05 (HSTS preload + securityheaders.com A+ + 7-day post-enforcement soak)

# Metrics
duration: ~8min (Task 1 autonomous portion only — Task 2 is operator-paced ~45 min active session)
completed: 2026-05-10
status: AUTONOMOUS-COMPLETE-CHECKPOINT-PENDING
---

# Phase 10 Plan 04: CSP Enforcement Cutover (Wave 4 Autonomous Portion) Summary

**Single-knob CSP enforcement-flip operator runbook (302 lines, 7 numbered Cutover Steps + 5-target smoke matrix + Cutover Log paste-ready template + single-knob Rollback Procedure) authored at runbooks/csp-enforcement-cutover.md; tests/firebase-config.test.js carries a pre-staged describe.skip block with 6 enforced-shape assertions awaiting Task 2's un-skip token deletion (24 passed | 6 skipped (30) — Wave 2 RO describe still green at Task 1 close); Task 2 (operator enforcement flip + production deploy + 5-target smoke matrix + Cutover Log fill rows A/B/C) is checkpoint:human-action and remains pending — the actual production deploy and browser-side smoke matrix are operator-paced and cannot be automated by an executor agent.**

## Performance

- **Duration (autonomous portion):** ~8 min
- **Started:** 2026-05-10T21:08:00Z (approx)
- **Completed (Task 1):** 2026-05-10T21:16:30Z
- **Tasks autonomous:** 1 of 2 (Task 1 done; Task 2 = operator checkpoint)
- **Files created:** 1
- **Files modified:** 1

## Accomplishments

- `runbooks/csp-enforcement-cutover.md` authored at 302 lines (>250 line min from plan must-haves) with the full single-knob enforcement-flip operator workflow:
  - **Prerequisites** (4 sub-checklists): From `10-PREFLIGHT.md ## Soak Log` (Plan 10-03 Day 7 CLEAN + Wave 4 explicitly authorised + no outstanding triage incidents); From `tests/firebase-config.test.js` (24/24 baseline + 6 SKIP marker for Plan 10-04 pre-staged describe); From the build pipeline (CI green + no in-flight Cloud Function deploys per Pitfall 8); Operator state (firebase login + DevTools clean Chrome profile + foreground gcloud auth); Cutover window (~45 min active + no competing deploys)
  - **Pre-cutover Smoke Checklist** (run under EXISTING Report-Only state): 5-target smoke matrix mirror — same 5 targets, same expected console state, run BEFORE the flip so any regression is provably caused by the flip and not pre-existing drift. STOP-and-restart-Plan-10-03 escalation if any console violation surfaces under RO.
  - **Step 1: Apply firebase.json key flip** (~3 min): paste-ready diff, single-knob (key string only — value identical to Wave 2)
  - **Step 2: Un-skip the pre-staged enforced-shape describe + delete the Wave 2 RO describe** (~1 min): two surgical deletions in tests/firebase-config.test.js, plus optional (c) security-headers it.each array swap if needed; no new test code authored
  - **Step 3: Local verification** (~2 min): `npm test -- --run firebase-config` — expected count consistent with 17 baseline + 6 enforced (un-skipped) — Wave 2 RO describe (6) deleted = 23/23 OR 24/24 depending on (c)
  - **Step 4: Selective hosting deploy** (~5 min): `firebase deploy --only hosting --project bedeveloped-base-layers` + Pitfall 8 explicit DO-NOT-RUN list (mass-deploy / --only functions / --only functions:cspReportSink / --only firestore / --only storage) + recovery procedure cross-reference back to Plan 10-03 runbook Step 1.4
  - **Step 5: Post-deploy curl smoke** (~2 min): `curl -sI ... | grep -i content-security` — expected `content-security-policy:` (no `-report-only` suffix); MUST NOT contain `-report-only` suffix; MUST NOT appear twice (no dual RO + enforced state); CDN cache lag handling + dual-headers ROLLBACK escalation
  - **Step 6: 5-target smoke matrix under enforcement** (~25 min): 5-row table per HOST-07 SC#2 — sign-in / dashboard / radar+donut chart / document upload / chat — each with Action / Expected / If-fails columns. Verification gate per target: zero `Refused to ...` lines in DevTools console. Screenshot capture to `docs/evidence/phase-10-enforcement-smoke-console.png`.
  - **Step 7: Update 10-PREFLIGHT.md ## Cutover Log** (~5 min): paste-ready Cutover Log template (5-row tabular form A/B/C/D/E with `{{ PENDING }}` markers for D + E) + commit message template
  - **Rollback Procedure** (single-knob; ~5 min): 8 numbered steps for inverse single-knob revert — firebase.json key revert + tests/firebase-config.test.js .skip restore + Wave 2 RO describe restore via `git restore -p` + npm test re-run + redeploy + curl verify + Cycle 2 daily soak query restart + 10-PREFLIGHT.md ## Cutover Log rollback documentation + forward-fix-vs-revert recommendation
  - **Post-deploy 7-day soak** (Plan 10-05 owns): forward reference to Plan 10-05's `disposition="enforce"` Cloud Logging filter (vs Plan 10-03's `disposition="report"`)
  - **Citations**: HOST-06 + HOST-07 + 3 Pitfalls (8/16/19) + 4 cross-runbook references (Phase 3 hosting-cutover.md / Phase 9 deploy-checkpoint.md / Phase 10 csp-soak-bootstrap.md / 10-PATTERNS.md §File 5) + ASVS L2 V14.4.1 / ISO 27001 A.5.7+A.8.23 / SOC 2 CC6.6 / GDPR Art. 32(1)(b)
- `tests/firebase-config.test.js` extended with PLAN 10-04 WAVE 4 NOTE comment banner + new `describe.skip("firebase.json — Phase 10 enforced CSP shape (HOST-07) — Wave 4 un-skip", ...)` block carrying 6 enforced-shape assertions:
  - style-src locked to 'self' (no 'unsafe-inline' under enforced key)
  - connect-src includes Sentry EU origin (https://de.sentry.io)
  - frame-src is 'self' (no firebaseapp.com popup origin)
  - base-uri 'self' and form-action 'self' present (HOST-07 SC#1)
  - default-src + object-src + frame-ancestors retain Phase 3 substrate
  - Content-Security-Policy-Report-Only header is REMOVED (enforced shipped)
- Vitest output: `Tests 24 passed | 6 skipped (30)` — Wave 2 RO describe (6 assertions) still green at Task 1 close; the new Plan 10-04 describe block listed as 6 SKIPPED. Net delta at Task 2 close: -1 RO describe + 1 enforced describe (un-skipped) = zero count change.
- Pitfall 8 selective-deploy boundary preserved: zero firebase.json modifications in Task 1; cspReportSink Cloud Function (firebase.json line 38-39 rewrite + functions/src/csp/cspReportSink.ts) untouched and NOT redeployed. firebase.json line 21 key flip is Task 2's operator-only edit.
- Pitfall 19 substrate-honest disclosure threaded through the Cutover Log template: rows D + E carry explicit `{{ PENDING }}` markers (vs silent omission); Plan 10-05 owns their close-out.

## Task Commits

1. **Task 1: Author runbooks/csp-enforcement-cutover.md + pre-stage tests/firebase-config.test.js describe.skip block** — `def252e` (docs)

**Plan metadata:** _pending — final docs commit lands after this SUMMARY + STATE.md + ROADMAP.md edits_

**Task 2:** CHECKPOINT-PENDING — `checkpoint:human-action` (gate=blocking) — operator runs `runbooks/csp-enforcement-cutover.md` end-to-end: pre-cutover smoke under existing CSP-RO + firebase.json line 21 flip + tests/firebase-config.test.js .skip deletion + Wave 2 RO describe deletion + selective hosting deploy + curl smoke + 5-target smoke matrix under enforcement + Cutover Log fill rows A/B/C. Calendar time + browser-side DevTools verification cannot be automated by an executor agent.

## Files Created

- `runbooks/csp-enforcement-cutover.md` (302 lines, NEW) — Wave 4 operator runbook for single-knob CSP enforcement flip. Sections detailed in Accomplishments above.

## Files Modified

- `tests/firebase-config.test.js` (+57 lines, no deletions) — Append PLAN 10-04 WAVE 4 NOTE comment banner + new `describe.skip(...)` block with 6 enforced-shape assertions. Wave 2 RO describe block left intact (Task 2 deletes it in the same commit as the firebase.json key flip).

## Decisions Made

- **D-01: Pre-stage enforced-shape describe under describe.skip** — operator session's test-file edit shrinks from 8+ lines of new code to two deletions; vitest describe.skip API is well-supported.
- **D-02: Runbook copies Phase 3 hosting-cutover.md section structure** rather than Phase 9 deploy-checkpoint.md — Wave 4's workflow is one-shot cutover + rollback (Phase 3 analog), not deploy + observe + decide (Phase 9 analog — that was Plan 10-03's shape).
- **D-03: Cutover Log uses Phase 9 tabular shape with explicit `{{ PENDING }}` markers** for rows D + E rather than free-form prose; substrate-honest disclosure of multi-wave row ownership.
- **D-04: 5-target smoke matrix records per-target PASS/FAIL individually** in Cutover Log Row C evidence column; preserves diagnostic information for incident review.
- **D-05: Step 2 includes optional (c) for security-headers it.each array swap** — operator verifies via npm test in Step 3 and applies (c) only if needed; avoids over-prescribing under uncertainty about test framework behaviour for header-presence-by-name.
- **D-06: Rollback Procedure recommends forward-fix on a sub-wave 10.x micro-plan over `git revert`** — preserves the un-skip token edit + makes wave-4 retry trivial.

## Deviations from Plan

None — plan executed exactly as written for Task 1 (autonomous portion). All `<must_haves>` truths and artefacts satisfied:

- runbooks/csp-enforcement-cutover.md exists with same-session deploy + multi-target smoke (5 targets per HOST-07 SC#2) + Cutover Log + Rollback Procedure ✓
- runbook >= 250 lines (302 actual) ✓
- runbook contains paste-ready firebase deploy command + Pitfall 8 explicit DO-NOT-RUN list ✓
- runbook contains 5-target smoke matrix table (sign-in / dashboard / radar+donut / document upload / chat) ✓
- runbook contains single-knob Rollback Procedure (~5 min) ✓
- runbook contains Cutover Log paste-ready template with rows A-E (A/B/C in scope; D/E `{{ PENDING }}` for Plan 10-05) ✓
- tests/firebase-config.test.js has new `describe.skip(...)` block with 6 enforced-shape assertions (will fail without `.skip` until Task 2 deletes it) ✓
- `grep -c "PLAN 10-04 WAVE 4 NOTE" tests/firebase-config.test.js` returns 1 (the comment banner above the skipped describe) ✓
- `grep -c "describe.skip" tests/firebase-config.test.js` returns 1 (the pre-staged enforced-shape describe) ✓
- 24 baseline assertions remain green; vitest output lists 6 assertions SKIPPED (the new describe.skip block); total 30 ✓

The Task 2 checkpoint is intentionally NOT executed — it is `checkpoint:human-action` with `gate="blocking"` per plan task definition (`autonomous: false` plan-level), and the calendar-paced enforcement flip + browser-side 5-target smoke matrix cannot be automated by an executor agent.

## Issues Encountered

None — documentation + test-file deliverables landed cleanly. Pre-commit hooks (lint-staged + Prettier formatter + gitleaks) ran without intervention. Line-ending warnings (LF will be replaced by CRLF) are normal Windows-host behaviour and do not affect file content.

## User Setup Required

None at the autonomous-portion level — Task 1 is documentation + test pre-staging only, no external service configuration.

**For Task 2 (operator checkpoint):** operator follows `runbooks/csp-enforcement-cutover.md` Prerequisites checklist + Pre-cutover Smoke Checklist + Cutover Steps 1-7. The runbook itself is the user-setup substrate.

## Next Phase Readiness

**Plan 10-04 Task 2 is operator-runnable as soon as Plan 10-03 Task 2 closes CLEAN.** The Wave 3 7-day soak must mark `CLEAN` in `10-PREFLIGHT.md ## Soak Log` Cycle N Day 7 row before Wave 4 starts. Plan 10-04's Prerequisites checklist explicitly cross-references this gate.

**Plan 10-05 (Wave 5 — HSTS preload submission + securityheaders.com A+ verification + SECURITY.md DOC-10 increment) is BLOCKED on Plan 10-04 Task 2 close.** Wave 5 cannot run until enforcement is live + 5-target smoke PASS + Cutover Log Rows A/B/C marked PASS. Wave 5 then closes Cutover Log Rows D + E (currently `{{ PENDING }}`).

**HOST-07 closure path:**
- HOST-07 SC#1 (CSP enforced + directive matrix tightened): closes when Plan 10-04 Task 2 lands the firebase.json key flip + selective hosting deploy
- HOST-07 SC#2 (5-target smoke under enforcement + 7-day post-enforcement soak): partially closes at Plan 10-04 Task 2 (5-target smoke); fully closes at Plan 10-05 Wave 5 close (7-day post-enforcement soak)
- HOST-07 SC#3 (HSTS preload submission): closes at Plan 10-05 Wave 5
- HOST-07 SC#4 (securityheaders.com A+): closes at Plan 10-05 Wave 5

**Pitfall 16 Stage C (enforcement flip) is operator-runnable.** Wave 3 closed Stage B (RO with tightened directives); Wave 4 takes Stage C (enforced). Three-stage rollout is now substrate-complete pending the operator session.

## Self-Check: PASSED

- File `runbooks/csp-enforcement-cutover.md` — FOUND (302 lines via wc -l)
- File `tests/firebase-config.test.js` — modified with new describe.skip block (verified via grep "PLAN 10-04 WAVE 4 NOTE" returning 1 + grep "describe.skip" returning 1)
- Commit `def252e` — FOUND (`docs(10-04): author csp-enforcement-cutover runbook + pre-stage enforced-shape describe.skip`)
- Tests: `npm test -- --run firebase-config` returns `24 passed | 6 skipped (30)` — VERIFIED
- Runbook contains all 7 numbered Cutover Steps + Rollback Procedure + 5-target smoke matrix + Cutover Log paste-ready template — VERIFIED via grep "^## |^### Step"

---
*Phase: 10-csp-tightening-second-sweep*
*Plan: 10-04 (Wave 4 — autonomous portion COMPLETE; Task 2 = operator checkpoint:human-action pending)*
*Completed (autonomous): 2026-05-10*
