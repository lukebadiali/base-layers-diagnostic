---
phase: 10-csp-tightening-second-sweep
plan: 02
subsystem: infra
tags: [csp, firebase-hosting, sentry-connect-src, frame-src, schema-test, hsts-substrate, host-07, host-06]

# Dependency graph
requires:
  - phase: 10-csp-tightening-second-sweep
    provides: "Plan 10-01 closed Wave 1 inline-style sweep — 162 static `style=\"...\"` h()-attrs in src/main.js migrated to utility classes; precondition for dropping `'unsafe-inline'` from style-src without 162+ silent layout-drops during the Wave 3 soak."
  - phase: 09-observability-audit-event-wiring
    provides: "Plan 09-02 wired @sentry/browser → https://de.sentry.io for OBS-04 — connect-src must allow this origin or enforced CSP (Wave 4) silently breaks Sentry submission (Pitfall 10B)."
  - phase: 06-real-auth-mfa-rules-deploy
    provides: "D-09 confirmed app uses signInWithEmailLink (Phase 6); zero signInWithPopup/Redirect call sites remain under src/ — frame-src no longer needs https://bedeveloped-base-layers.firebaseapp.com."
  - phase: 03-hosting-cutover-baseline-security-headers
    provides: "Phase 3 Content-Security-Policy-Report-Only header substrate + tests/firebase-config.test.js schema test infrastructure (T-3-1 mitigation) + cspReportSink Cloud Function in europe-west2 (Pitfall 8 selective-deploy boundary preserved)."
provides:
  - "Tightened firebase.json CSP-RO directive value (style-src 'self' / connect-src + de.sentry.io / frame-src 'self') ready for Wave 3 production deploy + 7-day soak."
  - "tests/firebase-config.test.js + 6 Phase 10 schema assertions pinning the tightened shape — drift-prevention substrate for Wave 3 + Wave 4."
  - "HSTS preload-eligibility assertion (max-age >= 31536000 + includeSubDomains + preload) — substrate test for Plan 10-05 hstspreload.org submission (HOST-06)."
affects: [10-03-csp-soak, 10-04-csp-enforcement-flip, 10-05-hsts-preload-submission, phase-11-documentation-pack]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave-2-RO-tighten before Wave-3-soak before Wave-4-enforce (Pitfall 16 three-stage rollout — Stage A=Phase 3, Stage B=Wave 3, Stage C=Wave 4)"
    - "Header KEY/VALUE separation: tightening the value under the existing RO key proves directive shape during soak BEFORE flipping the key (single-knob enforcement flip in Wave 4)"
    - "Schema-test cspKey constant pattern: Wave 4 needs to update only one constant + one assertion to retarget the enforced key"

key-files:
  created: []
  modified:
    - "firebase.json - CSP-RO directive value (line 22): style-src locked to 'self' (no unsafe-inline); connect-src adds https://de.sentry.io; frame-src 'self' (no firebaseapp.com); header KEY remains Content-Security-Policy-Report-Only (Wave 4 owns the flip)"
    - "tests/firebase-config.test.js - + 1 new describe block ('firebase.json — Phase 10 tightened CSP shape (HOST-07)') + 6 it() blocks pinning the tightened shape; existing 18 assertions unchanged"

key-decisions:
  - "Header KEY remained Content-Security-Policy-Report-Only at Wave 2 — value-shape soak (Wave 3) precedes enforcement flip (Wave 4) per Pitfall 16 three-stage rollout"
  - "Sentry origin used = https://de.sentry.io plain (matches vite.config.js:36 hard-coded value); ingest-subdomain mismatch is flagged for Wave 3 staging-soak verification (threat T-10-02-Sentry-origin-assumption)"
  - "frame-src 'self' (not removed entirely) preserves the directive in the policy so future violations report rather than silently fall through to default-src — defence-in-depth"
  - "Schema-test assertions target the Report-Only key at Wave 2 (cspKey constant) — Wave 4 single-knob change updates the constant + first assertion to point at the enforced key (no other test edits required)"
  - "HSTS preload-eligibility assertion landed in this wave (not Plan 10-05) — Plan 10-05 owns submission to hstspreload.org; this wave provides the substrate test that proves max-age + includeSubDomains + preload satisfy hstspreload.org's eligibility shape before submission"

patterns-established:
  - "Single-knob enforcement-key flip: schema test pins the value shape independently of the key; the key flip in Wave 4 updates one cspKey constant"
  - "Substrate-test-before-soak: Wave 2 lands the directive value + the schema test pinning it; Wave 3 deploys + observes; Wave 4 flips with paired runbook"
  - "Pitfall 8 selective-deploy boundary: only firebase.json modified; cspReportSink Cloud Function rewrite at line 38-39 + functions/src/csp/cspReportSink.ts untouched (READ-ONLY at Phase 10)"

requirements-completed: []  # HOST-07 remains [~] until Plan 10-04 enforcement flip; this wave is substrate-complete-pending per the [~] convention used by Plan 10-01

# Metrics
duration: 6min
completed: 2026-05-10
---

# Phase 10 Plan 02: CSP Report-Only Directive Tighten Summary

**firebase.json CSP-RO value tightened in three surgical edits (drop `'unsafe-inline'` from style-src, add `https://de.sentry.io` to connect-src, replace `bedeveloped-base-layers.firebaseapp.com` in frame-src with `'self'`); tests/firebase-config.test.js extended with 6 Phase 10 schema-test assertions pinning the new shape; header KEY remains `Content-Security-Policy-Report-Only` (Wave 4 owns the enforcement flip).**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-10T19:49:42Z
- **Completed:** 2026-05-10T19:53:18Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Three surgical directive-value edits applied to firebase.json line 22 (single-line semicolon-separated format preserved):
  1. `style-src 'self' 'unsafe-inline'` → `style-src 'self'` (Wave 1 closed the 162-inline-style precondition; Pitfall 16 Stage B-ready)
  2. `connect-src ... https://securetoken.google.com` → `connect-src ... https://securetoken.google.com https://de.sentry.io` (Pitfall 10B — Phase 9 OBS-04 Sentry browser POSTs allowlisted ahead of Wave 4 enforcement)
  3. `frame-src https://bedeveloped-base-layers.firebaseapp.com` → `frame-src 'self'` (Phase 6 D-09 — verified zero signInWithPopup/Redirect under src/; app uses email-link)
- Six new Phase 10 schema-test assertions land in a new `describe("firebase.json — Phase 10 tightened CSP shape (HOST-07)")` block (one per directive boundary) — all pinned against the cspKey constant for single-knob Wave 4 retargeting:
  1. style-src is locked to 'self' — no 'unsafe-inline'
  2. connect-src includes Sentry EU origin (https://de.sentry.io) — Pitfall 10B
  3. frame-src is 'self' (no firebaseapp.com popup origin)
  4. base-uri 'self' and form-action 'self' present (HOST-07 SC#1)
  5. default-src + object-src + frame-ancestors retain Phase 3 substrate
  6. HSTS preload-eligible: max-age >= 31536000, includeSubDomains, preload (HOST-06 substrate; submission lands in Plan 10-05)
- Header KEY remains `Content-Security-Policy-Report-Only` — directive-shape soak (Wave 3) precedes enforcement flip (Wave 4); single-knob change in Plan 10-04 updates only the cspKey constant + the JSON header key.
- Pitfall 8 selective-deploy boundary preserved: only firebase.json + tests/firebase-config.test.js modified. cspReportSink Cloud Function (firebase.json line 38-39 rewrite + functions/src/csp/cspReportSink.ts) untouched and NOT redeployed.
- Vitest root suite: 484 / 484 green (was 478 — +6 new Phase 10 assertions; zero regressions across the other 67 test files).

## Task Commits

Each task was committed atomically:

1. **Task 1: Tighten firebase.json CSP-RO value** — `523e47e` (feat)
2. **Task 2: Extend tests/firebase-config.test.js with 6 Phase 10 assertions** — `24f8a7c` (test)

**Plan metadata:** _pending — final docs commit lands after this SUMMARY + STATE.md + ROADMAP.md edits_

_Note: Both tasks have `tdd="true"` on the plan, but the plan's `<action>` blocks specify a sequential value-then-test ordering (Task 1 edits firebase.json; existing 18 assertions remain green; Task 2 adds 6 new assertions which then pass against the already-tightened value). This is the plan-author's intended TDD interpretation for schema-data validation — the new assertions serve as drift-prevention pins, not failing-first specifications. No deviation logged._

## Files Created/Modified

- `firebase.json` — CSP-RO directive value tightened in three places (line 22); single-line semicolon-separated format preserved; all other hosting config (HSTS, X-CTO, Referrer-Policy, Permissions-Policy 22-directive expanded, COOP/COEP/CORP, Reporting-Endpoints, rewrites, cache-control, emulators) untouched
- `tests/firebase-config.test.js` — appended 1 new describe block + 6 it() blocks after the existing Phase 4 D-08 block (file went from 18 vitest test cases to 24); existing 9-row `it.each` security-header presence test + 8 narrative `it()` blocks unchanged. Pre-commit Prettier formatter merged 3 pre-existing multi-line statements onto single lines (lines 9-12 of the post-format file) — this was a Prettier formatting normalisation triggered by the file edit, not a Phase 10 substantive change

## Decisions Made

- **HOST-07 stays `[~]` not `[x]`** — Plan 10-01 established the convention that HOST-07 remains `[~]` (substrate-complete-pending) until enforcement flip lands in Plan 10-04. Plan 10-02 is also substrate (RO-tighten precedes enforcement flip), so HOST-07 retains `[~]` with a Validated 2026-05-10 annotation in REQUIREMENTS.md traceability. Marking `[x]` now would mis-state the requirement's full closure.
- **Sentry connect-src added at Wave 2, not deferred to Wave 3 deploy** — adding `https://de.sentry.io` to the RO directive value lets Wave 3's 7-day soak verify the origin actively (any cross-origin Sentry event POST will surface in cspReportSink logs IF the de.sentry.io plain hostname is wrong, e.g. an ingest-subdomain like `o<orgId>.ingest.de.sentry.io`). Discovering the mismatch under Report-Only is non-breaking; discovering it under enforced CSP would have broken Sentry submission silently.
- **frame-src 'self' (not omitted)** — keeping the directive in the policy preserves the violation-reporting path for any future popup/iframe attempt; omitting frame-src would fall through to default-src 'self' with the same effect at runtime but no clear signal in violation reports about which directive blocked.
- **HSTS preload-eligibility test bundled into this wave** — Plan 10-02 was the natural home for an HSTS-eligibility schema-test substrate (the file already contained an HSTS presence test at line 61-66; the new assertion at line 130-137 strengthens it from "tokens present" to "preload-list-eligible"). Plan 10-05 still owns the actual submission to hstspreload.org and the resulting REQUIREMENTS.md HOST-06 row update.

## Deviations from Plan

None — plan executed exactly as written. The plan's `<verified_facts>` section pre-validated every grep-based assumption (vite.config.js:36 Sentry URL, signInWithPopup/Redirect zero hits, index.html zero meta-CSP tags, Phase 4 D-08 CDN drops intact). All directive-value verifications passed at first run.

The plan's `<verification>` block specifies "23 assertions (17 existing + 6 new)" — the actual baseline reported by vitest was 18 (one of the existing source-level `it()` blocks is `it.each([...9 keys...])` which expands to 9 parameterised cases, so 9 source-level `it()` + 9 expansion = 18; the plan author counted 8 narrative + 9 expansion = 17 conceptually). Final count is 18 + 6 = 24 vitest test cases. This is a counting convention nuance, not a deviation in code or behaviour — the new 6 assertions are exactly as specified.

## Issues Encountered

None — edits applied surgically; tests passed first run; no auth gates; no third-party API calls; no flaky tests surfaced. The pre-commit Prettier hook (gitleaks pass + Prettier reformat) is established Phase 4+ infrastructure and behaved exactly as designed.

## User Setup Required

None — no external service configuration required. The Sentry origin was already configured in Phase 9 (vite.config.js:36 + src/observability/sentry.js); Wave 2 only adds it to the CSP allowlist. The Wave 3 production deploy of this firebase.json change is operator-paced (Plan 10-03 — `[autonomous: false]`) and bundles its own runbook.

## Next Phase Readiness

Wave 3 (Plan 10-03 — operator-paced production deploy + 7-day soak) is unblocked:
- firebase.json carries the Phase 10 target CSP-RO directive value
- tests/firebase-config.test.js pins the shape (drift prevention during the 7-day soak window)
- Pitfall 8 selective-deploy boundary preserved — Wave 3's `firebase deploy --only hosting` will not touch cspReportSink

Open forward-tracking items (acknowledged at this wave; resolved at later waves):
- **A4 Sentry origin assumption** — `https://de.sentry.io` plain vs `https://o<orgId>.ingest.de.sentry.io`. Wave 3 staging soak surfaces any mismatch; if mismatch found, Wave 3 produces a delta task to update connect-src + restart the 7-day soak before Wave 4 enforcement flip.
- **Wave 4 single-knob change** — Plan 10-04 Task 1 updates two strings: firebase.json header key (`Content-Security-Policy-Report-Only` → `Content-Security-Policy`) and tests/firebase-config.test.js cspKey constant (line 97). All other test logic stays identical.
- **HSTS submission** — Plan 10-05 owns the hstspreload.org form submission. The substrate test landed at Wave 2 (line 130-137) verifies the policy shape is submission-eligible; the actual submission is operator-paced.

## Verification Evidence

| Check | Expected | Actual | Result |
|-------|----------|--------|--------|
| `npm test -- --run firebase-config` | 24 passed (18 existing + 6 new) | 24 passed | PASS |
| `npm test -- --run` (full root suite) | >= 478 + 6 = 484 green | 484 / 484 green (68 test files) | PASS |
| `grep -c "'unsafe-inline'" firebase.json` | 0 | 0 | PASS |
| `grep -c "https://de.sentry.io" firebase.json` | 1 | 1 | PASS |
| `grep -c "bedeveloped-base-layers.firebaseapp.com" firebase.json` | 0 | 0 | PASS |
| `grep -c "Content-Security-Policy-Report-Only" firebase.json` | 1 | 1 | PASS |
| `grep -c "Content-Security-Policy\":" firebase.json` (enforced key) | 0 | 0 | PASS |
| `grep -c "Phase 10 Wave 2 (HOST-07)" tests/firebase-config.test.js` | 1 | 1 | PASS |

## Self-Check: PASSED

- File `firebase.json` — verified via Grep (1 match for `https://de.sentry.io`, 0 for `'unsafe-inline'`, 0 for `bedeveloped-base-layers.firebaseapp.com`).
- File `tests/firebase-config.test.js` — verified via vitest (24 cases including the 6 new) + Grep (1 match for `Phase 10 Wave 2 (HOST-07)`).
- Commit `523e47e` — verified via `git log --oneline -3` (HEAD~1, "feat(10-02): tighten CSP-RO directives ...").
- Commit `24f8a7c` — verified via `git log --oneline -3` (HEAD, "test(10-02): add 6 Phase 10 tightened-CSP schema assertions ...").

---
*Phase: 10-csp-tightening-second-sweep*
*Completed: 2026-05-10*
