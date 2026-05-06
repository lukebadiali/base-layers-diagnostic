---
phase: 02-test-suite-foundation
plan: 06
subsystem: snapshots-coverage-governance
tags: [test-10, snapshots, coverage-thresholds, governance, d-08, d-10, d-15, d-16, d-17, d-18, d-20, t-2-02, t-2-03, t-2-04, phase-4-fence]

# Dependency graph
requires:
  - phase: 02-test-suite-foundation
    plan: 05
    provides: 11 test files / 128 tests + every D-02 leaf module extracted to src/{util,domain,data,auth}/* (Wave 4 outputs)
provides:
  - "tests/views/dashboard.test.js + diagnostic.test.js + report.test.js — TEST-10 view snapshots via toMatchFileSnapshot (D-08)"
  - "tests/__snapshots__/views/dashboard.html + diagnostic.html + report.html — committed pre-Phase-4 baselines (D-08, D-10)"
  - "tests/fixtures/snapshot-org.json — TEST-10 deterministic input fixture: 1 org / 2 rounds / 5 users / red+amber+green+gray pillar bands / 3 comments / 2 actions / engagement / readStates + verbatim 10 pillars + engagementStages + scoreLabels + principles from data/pillars.js (D-10)"
  - "vite.config.js — test.coverage.thresholds tiered per-directory (D-15: domain/util 100, auth 95, data 90) + exclude list + the mandatory 'DO NOT add a global threshold key' comment"
  - ".github/workflows/ci.yml — test job runs npm run test:coverage, uploads coverage-report-html artefact (D-20), verifies snapshot baselines present and non-empty (Pitfall 5 backstop)"
  - "CONTRIBUTING.md — Updating snapshot tests + Regression-baseline tests + Coverage thresholds + Test runtime budget sections (D-17 + D-18)"
  - "eslint.config.js — no-restricted-imports rule blocking tests/** imports from src/** + app.js (T-2-03 codified)"
  - "src/util/ids.js — 2 c8 ignore annotations on genuinely unreachable defensive branches (capitalise falsy-s + first-empty after trim) preserving D-05 byte-identical extraction"
  - "Coverage back-fill across 7 test files (Rule 1 — Wave 1-4 had branch gaps once the threshold gate fired): 1 hash + 3 ids + 1 completion + 1 scoring + 2 unread + 8 migration + 3 cloud-sync new it() cases"
  - "runbooks/phase-4-cleanup-ledger.md — Phase 2 close-out entry + 2 documented coverage holes within threshold"
  - "02-06-NOTES.md — route-resolution + fixture branch coverage matrix + 2 tooling deviations from plan body"
affects: [04, 05, 06, 12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hash-router was not used: routes are private state.route in the IIFE; snapshot tests programmatically click [data-route] nav buttons instead (deviation from plan body)"
    - "vi.resetModules() + static import path replaces template-literal cachebust (Vite 8 rejects 'Unknown variable dynamic import')"
    - "Microtask drain (await Promise.resolve() x2) replaces setTimeout(0) — fake timers in tests/setup.js block setTimeout"
    - "scaleV2Cleared:true in fixture settings prevents init() from wiping responses on every boot — D-10 fixture-vs-init-helper interaction documented"
    - "c8 ignore comments on genuinely unreachable defensive branches preserve D-05 byte-identical while satisfying the 100% threshold"
    - "Coverage threshold gate enforcement verified by canary: skip 2 it() blocks → exit=1 with literal 'src/domain/' threshold-violation message → restore → exit=0 (T-2-04 mitigation proven)"

key-files:
  created:
    - "tests/views/dashboard.test.js"
    - "tests/views/diagnostic.test.js"
    - "tests/views/report.test.js"
    - "tests/__snapshots__/views/dashboard.html"
    - "tests/__snapshots__/views/diagnostic.html"
    - "tests/__snapshots__/views/report.html"
    - "tests/fixtures/snapshot-org.json"
    - ".planning/phases/02-test-suite-foundation/02-06-NOTES.md"
  modified:
    - "vite.config.js (coverage.exclude + coverage.thresholds added)"
    - "eslint.config.js (no-restricted-imports for src/** + app.js → tests/**)"
    - ".github/workflows/ci.yml (test job: npm run test:coverage + upload-artifact + Verify snapshot baselines)"
    - "CONTRIBUTING.md (Updating snapshot tests + Coverage thresholds + Test runtime budget)"
    - "runbooks/phase-4-cleanup-ledger.md (Phase 2 close-out)"
    - "src/util/ids.js (2 c8 ignore annotations + comment)"
    - "tests/util/hash.test.js (catch{} fallback test)"
    - "tests/util/ids.test.js (3 defensive-branch tests)"
    - "tests/domain/completion.test.js (defensive `org.responses ||{}` test)"
    - "tests/domain/scoring.test.js (defensive `perPillar ||{}` test)"
    - "tests/domain/unread.test.js (missing readStates + missing chatMessages tests)"
    - "tests/data/migration.test.js (6 new branch tests)"
    - "tests/data/cloud-sync.test.js (3 new branch tests)"

key-decisions:
  - "Plan body's window.location.hash routing approach REPLACED with [data-route] nav-button click after boot — investigation shows app.js has no hash router (state.route private to IIFE). Resolution documented in 02-06-NOTES.md and inline test comments."
  - "Plan body's await import('../../app.js?cachebust=${...}') REPLACED with vi.resetModules() + static import — Vite rejects template-literal dynamic imports."
  - "Plan body's await new Promise(r => setTimeout(r, 0)) REPLACED with await Promise.resolve() x2 — setTimeout is faked in tests/setup.js."
  - "tests/fixtures/snapshot-org.json includes settings.scaleV2Cleared:true to prevent init() wiping the seeded responses (Plan Step 0a 'walk renderers' branch coverage required this)."
  - "Coverage gaps flagged by initial threshold run BACK-FILLED with 18 new it() cases across 7 test files (Rule 1 — Wave 1-4 claimed coverage that didn't materialise under the gate). 2 unreachable defensive branches in src/util/ids.js marked with /* c8 ignore */ + Phase 2 (D-15) comment preserving D-05 byte-identical."
  - "Coverage threshold gate enforcement verified end-to-end via canary procedure: skipped tests/domain/scoring.test.js's 'questionMeta returns null' + 'meta.scale=0' it() blocks → npm test -- --run --coverage exited NON-ZERO with literal 'ERROR: Coverage for ... does not meet \"src/domain/**\" threshold (100%)' → assertions restored → re-ran for exit=0. T-2-04 mitigation proven load-bearing."
  - "Vitest 4.1.5 coverage.thresholds glob syntax matches the documented form at https://vitest.dev/config/coverage (verified via Context7 MCP fallback `npx ctx7 docs /vitest-dev/vitest`): 'src/utils/**.ts': { statements, functions, branches, lines }. The plan's syntax (with bare ** vs **.ts) works because Vitest applies thresholds against any source file matched by the glob, irrespective of extension."

requirements-completed: [TEST-10, DOC-10]

# Metrics
duration: "~70 min (Tasks 1-3 + canary verification + coverage back-fill)"
completed: 2026-05-06
---

# Phase 02 Plan 06: Wave 5 — Snapshots + Coverage Threshold Gate + Governance Summary

**TEST-10 closed: 3 view snapshot tests (dashboard / diagnostic / report) using `toMatchFileSnapshot` (D-08) with committed baselines + 41,951-byte deterministic snapshot-org.json fixture (D-10) covering all four pillarStatus bands. Tiered coverage thresholds wired into vite.config.js (D-15 — domain/util 100%, auth 95%, data 90%) with the mandatory "DO NOT add a global threshold key" comment + exclude list (app.js, firebase-init.js, data/pillars.js, tests/**, **/_generators/**). CI test job extended (D-20): runs `npm run test:coverage`, uploads `coverage-report-html` artefact, verifies snapshot baselines via `test -s` (Pitfall 5 backstop). ESLint `no-restricted-imports` (T-2-03) blocks `src/**` + `app.js` from importing `tests/**` — verified blocking via canary probe. CONTRIBUTING.md gets D-17 + D-18 governance: Updating snapshot tests / Regression-baseline tests / Coverage thresholds / Test runtime budget sections. Coverage back-fill (Rule 1 — Wave 1-4 had branch gaps under the new gate): +18 it() cases across 7 test files, 2 c8 ignore annotations on genuinely unreachable defensive branches in src/util/ids.js preserving D-05 byte-identical. Coverage gate enforcement proven end-to-end via canary (skip → exit=1 with literal "src/domain/" threshold violation → restore → exit=0). T-2-04 mitigation activated: from this commit forward, lowering a threshold requires a reviewable PR diff. Test suite is now load-bearing — Phase 4's modular split is fenced.**

## Performance

- **Duration:** ~70 min total (Task 1: ~30 min including coverage back-fill + canary; Task 2: ~25 min including fixture build + 2 tooling deviations; Task 3: ~10 min governance docs)
- **Started:** 2026-05-06T~14:55Z (Task 1 commit `0193c03`)
- **Completed:** 2026-05-06T~15:18Z (Task 3 commit `3aabc87`)
- **Tasks:** 3 / 3
- **Files modified:** 16 (8 new + 8 modified across the wave)
- **Commits:** 3 (Task 1 = `0193c03` feat; Task 2 = `c231053` test; Task 3 = `3aabc87` ci)
- **Test runtime:** `npm test -- --run --coverage` = **10.04s wall-clock** (target <90s CI / <30s local — well within budget per D-18)
- **Test runtime (no coverage):** `npm test -- --run` = **9.14s wall-clock**

## Final Coverage Report (per-directory %)

```
% Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |     100 |    98.94 |     100 |     100 |                   
 data              |     100 |    96.66 |     100 |     100 |                   
  cloud-sync.js    |     100 |    95.83 |     100 |     100 | 58                
  migration.js     |     100 |    97.22 |     100 |     100 | 70                
-------------------|---------|----------|---------|---------|-------------------

Statements   : 100% ( 241/241 )
Branches     : 98.94% ( 188/190 )
Functions    : 100% ( 63/63 )
Lines        : 100% ( 185/185 )
```

`src/domain/**`, `src/util/**`, `src/auth/**` all reach **100% across all four metrics** (after coverage back-fill + 2 c8-ignore annotations on genuinely unreachable defensive branches in ids.js). `src/data/**` is at 100% statements / functions / lines + 96.66% branches — well above the 90% threshold per D-15. The 2 remaining uncovered branches (cloud-sync.js:58 + migration.js:70) are documented in the Phase 4 cleanup ledger.

## Snapshot Baseline File Sizes

These three files are committed to git (NOT gitignored — re-verified `.gitignore` has no `__snapshots__` entry per T-2-02 step 2). The byte sizes are recorded here so a future PR that resets a snapshot to empty fails the SUMMARY's self-check:

| File                                            | Bytes  | First-line distinguishing marker                |
| ----------------------------------------------- | ------ | ----------------------------------------------- |
| `tests/__snapshots__/views/dashboard.html`      |  9,970 | `class="view-title">Test Org<` (h1 = org name)  |
| `tests/__snapshots__/views/diagnostic.html`     |  5,345 | `class="view-title">Diagnostic<` + `class="tiles">` |
| `tests/__snapshots__/views/report.html`         | 17,172 | `<h1>The Base Layers diagnostic - Test Org</h1>` + `class="report"` |

All three files have LF line endings (verified via `file` and inline grep on `\r\n` returning 0 matches). All three exceed the 5KB acceptance criterion. Each contains its view-distinctive marker AND fixture-driven content (`Test Org` for the org name, pillar names from data/pillars.js for diagnostic tiles, band-statement prose for report).

## Snapshot Content Sanity (Plan Step 0a — fixture-driven strings)

Verified strings present in each snapshot, derived from the fixture and the actual app.js renderers (NOT guessed):

- `dashboard.html` contains `Test Org` (org.name) + `Scored 3 of 10 pillars` (orgSummary integration: pillar 1 red, pillar 2 amber, pillar 3 green = 3 scored) + `data-route="dashboard"` with `class="nav-btn active"` (topbar active-tab marker).
- `diagnostic.html` contains `Strategy & ICP` (pillar 1 shortName from data/pillars.js verbatim) + `<div class="tiles">` (pillar tiles container) + `Diagnostic` (the view-title h1).
- `report.html` contains `LOW score` + `MEDIUM score` + `HIGH score` (the three bandStatement prose discriminators — proves all 3 scored bands rendered) + `class="report-toolbar"` + `Print / save PDF` button text + `Internal view` (the render-time view-mode discriminator).

## Enforcement-canary Verification (Plan Task 1 acceptance)

The plan required end-to-end proof that the coverage threshold gate fires non-zero on a real coverage drop. Procedure executed:

1. **Skipped 2 it() blocks** in `tests/domain/scoring.test.js`: `"skips entries when questionMeta returns null or no scale"` + `"returns null when meta has no scale field (falsy meta.scale)"` (drives uncovered branches inside `pillarScoreForRound`'s body — `if (!meta || !meta.scale) return;` on line 34).
2. **Ran `npm test -- --run --coverage`** — exited NON-ZERO. The coverage table showed `domain/scoring.js | 96.55 | 96.66 | 100 | 100 | 34` with two error lines:
   ```
   ERROR: Coverage for statements (98.97%) does not meet "src/domain/**" threshold (100%)
   ERROR: Coverage for branches (98.93%) does not meet "src/domain/**" threshold (100%)
   ```
   Verified `exit=1` via `npm test -- --run --coverage > /tmp/canary.out 2>&1 ; echo "exit=$?"`.
3. **Restored both assertions** by reverting the `it.skip` to `it`.
4. **Re-ran `npm test -- --run --coverage`** — exited zero with all four metrics at 100% on `src/domain/**`. Tests: 146 → 146 (the canary doesn't add tests, just toggles them).

The canary demonstrates: coverage threshold drops produce a hard CI failure with a literal `"src/domain/"` substring in the error message. **T-2-04 (Tampering / CI gate weakening) mitigation is load-bearing** — silently lowering a threshold or quietly removing a test now requires a PR diff that's plain in `git diff vite.config.js` or `git diff tests/`.

## ESLint `no-restricted-imports` Rule (T-2-03 — committed text)

Verbatim from `eslint.config.js`:

```javascript
{
  files: ["src/**/*.js", "app.js"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["**/tests/**", "../tests/*", "../../tests/*"],
            message:
              "Production code (src/** or app.js) must not import from tests/. T-2-03 mitigation: tests/fixtures/auth-passwords.js is a TEST credential and must not leak into production paths.",
          },
        ],
      },
    ],
  },
},
```

**Verified end-to-end:** dropped a probe at `src/_lint-canary/probe.js` containing `import { knownPasswords } from "../tests/fixtures/auth-passwords.js"` and ran `npx eslint`. Output:

```
src/_lint-canary/probe.js
  2:1  error  '../tests/fixtures/auth-passwords.js' import is restricted from being used by a pattern. Production code (src/** or app.js) must not import from tests/. T-2-03 mitigation: tests/fixtures/auth-passwords.js is a TEST credential and must not leak into production paths
```

Probe deleted post-verification. The rule fires on the exact import shape T-2-03 names — `tests/fixtures/auth-passwords.js` from inside `src/`.

## Phase 2 Test Suite Manifest (full tests/ tree at close-out)

```
tests/
├── __snapshots__/
│   └── views/
│       ├── dashboard.html         (9,970 B)
│       ├── diagnostic.html        (5,345 B)
│       └── report.html            (17,172 B)
├── auth/
│   └── state-machine.test.js      (Phase 6 deletion baseline)
├── crypto-parity.test.js          (Pre-flight 3)
├── data/
│   ├── cloud-sync.test.js         (H8 regression baseline)
│   └── migration.test.js          (TEST-04 + Pitfall 10 idempotency)
├── domain/
│   ├── banding.test.js            (TEST-02 banding half)
│   ├── completion.test.js         (TEST-03)
│   ├── scoring.test.js            (TEST-02 scoring half)
│   └── unread.test.js             (H7 regression baseline)
├── fixtures/
│   ├── _generators/
│   │   └── hash-passwords.js      (Node CLI generator)
│   ├── auth-passwords.js          (TEST-07 known-passwords)
│   ├── cloud-sync-conflict.json   (TEST-06 scenarios)
│   ├── snapshot-org.json          (TEST-10 — 41,951 B)
│   ├── unread-state.json          (TEST-05)
│   ├── v1-localStorage.json       (TEST-04 input)
│   └── v2-org.json                (TEST-04 expected)
├── mocks/
│   ├── chartjs.js                 (D-14 GlobalChartStub)
│   └── firebase.js                (D-11 makeFirestoreMock)
├── setup.js                       (D-09 fake timers + UUID + Math.random)
├── setup.test.js                  (Pre-flight 1)
├── util/
│   ├── hash.test.js               (TEST-01 hash half)
│   └── ids.test.js                (TEST-01 ids half)
└── views/
    ├── dashboard.test.js          (TEST-10 — NEW)
    ├── diagnostic.test.js         (TEST-10 — NEW)
    └── report.test.js             (TEST-10 — NEW)
```

**Final test counts:** 14 test files / 149 tests passing (was 11 / 128 in Wave 4, +3 files / +21 tests across this wave: 18 coverage back-fill + 3 view snapshots).

## Test Runtime Budget (D-18)

| Invocation                                  | Wall-clock | Target    | Status  |
| ------------------------------------------- | ---------- | --------- | ------- |
| `npm test -- --run`                         | 9.14s      | <30s local | PASS    |
| `npm test -- --run --coverage`              | 10.04s     | <90s CI    | PASS    |
| `npm test -- --run tests/views/`            | 1.40s      | (subset)   | PASS    |
| `npm test -- --run tests/views/dashboard.test.js` | 0.99s | (single)   | PASS    |

Well within the soft target. Phase 7 will introduce hard timeouts when Cloud Functions tests + emulator suites push the runtime up legitimately (per D-18).

## Decisions Made

None outside the Decision Log already captured in `02-CONTEXT.md`. The three deviations from the plan body are documented in the Deviations section below + in `02-06-NOTES.md` (route-resolution + tooling deviations + fixture branch coverage).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug fix] Plan body's `window.location.hash = "#dashboard"` doesn't drive the router**

- **Found during:** Task 2 Step 0 (route hash patterns resolution)
- **Issue:** Plan Step 0 instructs to grep app.js for `location.hash` patterns and use those to drive the route in snapshot tests. Investigation shows app.js has NO hash router. Routes live in `state.route` (private to the IIFE, defaulting to `"dashboard"` at app.js:484). The only mutator is `setRoute(route)` (app.js:619-622), called from topbar nav buttons via `onclick: () => setRoute(route)` (app.js:735-736). Setting `window.location.hash` has no effect on the rendered view.
- **Fix:** snapshot tests programmatically click `button[data-route="diagnostic"]` / `button[data-route="report"]` after the IIFE boots (the dashboard test gets the dashboard view "for free" because state.route defaults to that). The click handler synchronously calls `setRoute()` → `render()`, so a single microtask drain after the click is sufficient.
- **Files modified:** `tests/views/dashboard.test.js`, `diagnostic.test.js`, `report.test.js`
- **Documented:** `02-06-NOTES.md` "Route hash patterns resolved 2026-05-06" section
- **Commit:** `c231053`

**2. [Rule 1 — Bug fix] Plan body's template-literal cachebust crashes Vite**

- **Found during:** Task 2 first test run
- **Issue:** Plan body specifies `await import('../../app.js?cachebust=${Date.now()}')`. Vite/Vitest 4 rejects this with `Error: Unknown variable dynamic import: ../../app.js?cachebust=...`. Vite needs the import path statically analysable at build time (the cachebust pattern is a Jest-world idiom; Vite has its own module-graph invalidation).
- **Fix:** use `vi.resetModules()` + a static `await import("../../app.js")`. This is the documented Vitest 4 pattern for forcing a fresh module evaluation. Each test's `beforeEach` calls `vi.resetModules()` before the import, so the IIFE re-runs against a fresh `state` object.
- **Files modified:** `tests/views/dashboard.test.js`, `diagnostic.test.js`, `report.test.js`
- **Documented:** `02-06-NOTES.md` "Tooling deviation: vi.resetModules() over template-literal cachebust" section
- **Commit:** `c231053`

**3. [Rule 1 — Bug fix] Plan body's `setTimeout(0)` blocked by fake timers**

- **Found during:** Task 2 second test run (after fixing #2)
- **Issue:** Plan body specifies `await new Promise((r) => setTimeout(r, 0))` to settle init() → render(). Under `tests/setup.js`'s `vi.useFakeTimers({ toFake: [..., "setTimeout", ...] })`, `setTimeout(0)` does NOT execute synchronously — it queues a fake-timer callback that requires `vi.advanceTimersByTime(...)` or `vi.runAllTimers()` to fire. The naive plan body causes a 10-second hook timeout.
- **Fix:** drain microtasks with `await Promise.resolve(); await Promise.resolve()`. The IIFE's `init()` call chain is fully synchronous (migrate → clearOldScale → currentUser → render → DOM mount), so two microtask ticks is sufficient.
- **Files modified:** `tests/views/dashboard.test.js`, `diagnostic.test.js`, `report.test.js`
- **Documented:** `02-06-NOTES.md` "Tooling deviation: microtask drain instead of setTimeout(...,0)" section
- **Commit:** `c231053`

**4. [Rule 1 — Bug fix] Plan body's fixture spec missing `settings.scaleV2Cleared`**

- **Found during:** Task 2 Step 0a (walk renderers)
- **Issue:** `init()` (app.js:5270-5282) calls `clearOldScaleResponsesIfNeeded` which WIPES `org.responses` unless `settings.scaleV2Cleared === true`. Without this flag, every snapshot test boot would leave the fixture's seeded responses empty — the renderers would all show the empty-state "no diagnostics completed yet" prose, defeating the snapshot's purpose.
- **Fix:** added `settings: { internalPassphrase: null, scaleV2Cleared: true }` to `tests/fixtures/snapshot-org.json`.
- **Files modified:** `tests/fixtures/snapshot-org.json`
- **Documented:** `02-06-NOTES.md` "Fixture branch coverage / Settings flag (`scaleV2Cleared: true`)" section
- **Commit:** `c231053`

**5. [Rule 1 — Bug fix] Plan body's fixture spec missing `engagementStages` + `scoreLabels` + `principles`**

- **Found during:** Task 2 first report-snapshot run
- **Issue:** `renderReport` reads `DATA.engagementStages.find(...)` (app.js:2680). Without this, the report renderer crashes with `TypeError: Cannot read properties of undefined (reading 'find')`. The plan body specifies the fixture's `pillars` field MUST be verbatim from `data/pillars.js` but doesn't extend that to `engagementStages` (4 entries) + `scoreLabels` (10 entries) + `principles` (10 entries).
- **Fix:** generated all four fields from `data/pillars.js` via Node script and committed them in `snapshot-org.json`. Each test's `window.BASE_LAYERS` setup exposes all four fields to the IIFE.
- **Files modified:** `tests/fixtures/snapshot-org.json`, `tests/views/dashboard.test.js`, `diagnostic.test.js`, `report.test.js`
- **Commit:** `c231053`

**6. [Rule 1 — Bug fix] Wave 1-4 coverage gaps under the new gate**

- **Found during:** Task 1 first `npm test -- --run --coverage` run
- **Issue:** Wave 1-4 SUMMARY.md files claimed 100% coverage on `src/util/**` and `src/domain/**` and reported all branches covered — but NEVER ran with the threshold gate active (the gate is being introduced in this wave). When the gate activated, v8 reported branch gaps across all four src directories: `src/util/hash.js` (catch{} fallback uncovered, 55% statements), `src/util/ids.js` (firstNameFromAuthor defensive branches), `src/domain/{completion,scoring,unread}.js` (defensive `||{}` short-circuits), `src/data/{migration,cloud-sync}.js` (multiple defensive branches).
- **Fix:** back-filled 18 it() cases across 7 test files targeting each uncovered branch + applied 2 `/* c8 ignore */` annotations to genuinely unreachable defensive branches in `src/util/ids.js` (capitalise's falsy-s + first-empty-after-trim — both unreachable due to upstream `if (piece)` / `if (name)` guards). Each c8 ignore carries a Phase 2 (D-15) explanatory comment + preserves byte-identical D-05 extraction.
- **Files modified:** `tests/util/hash.test.js`, `tests/util/ids.test.js`, `tests/domain/completion.test.js`, `tests/domain/scoring.test.js`, `tests/domain/unread.test.js`, `tests/data/migration.test.js`, `tests/data/cloud-sync.test.js`, `src/util/ids.js`
- **Commit:** `0193c03`

**7. [Rule 1 — Bug fix] cloud-sync.js test: `null` in cloudOrgs crashes line 29 before line 37 guard fires**

- **Found during:** Task 1 cloud-sync coverage back-fill
- **Issue:** Initial back-fill test passed `[null, { name: "no-id" }, { id: "good", ... }]` to drive line 37's `o && o.id` defensive guard. Line 29 (`cloudOrgs.map((o) => o.id)`) crashes on `null` BEFORE reaching line 37 — there's no null guard at line 29.
- **Fix:** removed the `null` element from the test fixture; kept the `{ name: "no-id" }` object which DOES drive line 37's `o && o.id` false branch. Documented the line-29-no-null-guard as a Phase 4 hardening candidate in the test comment.
- **Files modified:** `tests/data/cloud-sync.test.js`
- **Commit:** `0193c03`

## Authentication Gates

None.

## Issues Encountered

- **Coverage threshold mismatches on first-time gate activation.** Resolution captured under Deviation #6 above. The 18 back-fill it() cases + 2 c8-ignore annotations brought the gate green. The remaining 2 uncovered branches (cloud-sync.js:58 + migration.js:70) are documented in the Phase 4 cleanup ledger as defensive-branch acceptances.
- **CRLF line-ending warnings on commit.** `git commit` warned `LF will be replaced by CRLF the next time Git touches it` for the new test files + fixture + NOTES.md. This is the standard Windows-on-Git behaviour with `core.autocrlf=true`; files are stored as LF in the repo and converted to CRLF in the working tree. Verified by reading the committed snapshot files via `cat | head -c` — they are stored with LF in git.
- **Vite build informational warning unchanged from Wave 4:** `<script src="data/pillars.js?v=50"> in "/index.html" can't be bundled without type="module" attribute` — Phase 1 D-14 anti-pattern; Phase 4 owns the cleanup. Build still exits 0 (15 modules transformed, bundle hash `main-BiXtwP5Z.js` 93.32 kB).

## User Setup Required

None.

## Threat Model Compliance

- **T-2-02 (Tampering — `tests/__snapshots__/`) — `mitigate` step 2 honoured end-to-end.** `.gitignore` re-verified clean (`grep -c '__snapshots__' .gitignore` returns 0; `git check-ignore tests/__snapshots__/views/dashboard.html` exits 1). The CI `Verify snapshot baselines present and non-empty` step runs `if: always()` and uses `test -s <file>` (file exists AND is non-empty). A future PR that adds `tests/__snapshots__/` to `.gitignore` or deletes a baseline file will fail CI even if the test job itself somehow passes.
- **T-2-03 (Information Disclosure via test-fixture leakage) — `mitigate` honoured by codification.** The ESLint `no-restricted-imports` rule blocks `tests/**` imports from `src/**` and `app.js`. Verified end-to-end via the canary probe (output documented above). No production code today imports from `tests/`; the rule prevents future regressions.
- **T-2-04 (Tampering — CI gate weakening on coverage thresholds) — `mitigate` honoured + load-bearing.** This wave introduces the threshold gate (D-15 + D-16). Enforcement-canary procedure proven (skip → exit=1 → restore → exit=0 with literal `"src/domain/"` violation message). Threshold values are committed source of truth — any reduction is reviewable in `git diff vite.config.js`. The CONTRIBUTING.md "Coverage thresholds" section codifies the rule that lowering a threshold is a separate, justified PR (the SECURITY_AUDIT.md §0(4) "weakening to make it pass" anti-pattern is named explicitly). The Updating snapshot tests + Regression-baseline tests subsections extend this to test-content tampering.
- **No new threat surface introduced.** The only network surface change is the CI artefact upload; that uses the same SHA-pinned action (`actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1`) already in the build job. Verified: `grep -oE 'upload-artifact@[a-f0-9]+' .github/workflows/ci.yml | sort -u` returns ONE line.

No `threat_flag` entries needed.

## Phase 2 Close-out — Test Fence Established

**Phase 2 closed on 2026-05-06.** Every line in `<success_criteria>` from `02-06-PLAN.md` is satisfied:

1. ✅ Coverage threshold gate live: `vite.config.js` has tiered per-directory thresholds; the mandatory "DO NOT add a global threshold key" comment is present; CI fails on threshold miss (D-16, canary verified).
2. ✅ ESLint test-isolation rule live: `no-restricted-imports` blocks `tests/**` imports from `src/**` and `app.js` (T-2-03 codified, canary probe verified).
3. ✅ TEST-10 closed: 3 view snapshot tests + 3 committed baselines + 1 fixture (snapshot-org.json with verbatim pillars + engagementStages + scoreLabels + principles from data/pillars.js).
4. ✅ CI extended: runs with `--coverage`, uploads `coverage-report-html` artefact (D-20), verifies snapshot baselines present (Pitfall 5 backstop).
5. ✅ CONTRIBUTING.md has snapshot governance (D-17) + regression-baseline guidance + runtime budget (D-18) + Coverage thresholds anti-pattern guard.
6. ✅ Phase 2 close-out documented in cleanup ledger.
7. ✅ Full Phase 2 contract complete: TEST-01..07 + TEST-10 + DOC-10 all closed; lint + typecheck + build + test all green; no new packages.

**The Phase 4 modular-split test fence is now in place.** Phase 4 may now begin moving renderers / cloud helpers / firebase glue out of the IIFE — every move is fenced by:

- **Domain/util/data/auth tests** (`tests/util/`, `tests/domain/`, `tests/data/`, `tests/auth/`) that pin behaviour byte-identical with the pre-Phase-4 code path.
- **Snapshot tests** (`tests/views/`) that pin the rendered DOM. Phase 4's verification = `git diff tests/__snapshots__/` against this commit boundary must match the explicit DOM-shape changes a wave introduces, nothing more.
- **Coverage thresholds** that make a Phase 4 sub-wave's coverage-loss visible in CI. Phase 4 plan task: extend the per-directory threshold list to cover the new `src/views/`, `src/cloud/`, `src/observability/` directories as they appear (D-15 ratchet).
- **CONTRIBUTING.md governance** that documents the test-first PR rule and the regression-baseline preservation pattern.

**The wave that turns the test suite ON as a real CI gate is complete.** Prior 5 waves built the tests; this wave makes them load-bearing.

## Self-Check: PASSED

### Files (Task 1)

- `vite.config.js` contains literal `exclude: [` AND `"app.js"` AND `"firebase-init.js"` AND `"data/pillars.js"` AND `"tests/**"` AND `"**/_generators/**"` — VERIFIED
- `vite.config.js` contains literal `thresholds: {` immediately followed by the `DO NOT add a global threshold key` comment — VERIFIED
- `vite.config.js` contains literal `"src/domain/**": { lines: 100, branches: 100, functions: 100, statements: 100 }` — VERIFIED
- `vite.config.js` contains literal `"src/util/**":` with 100% values — VERIFIED
- `vite.config.js` contains literal `"src/auth/**":` with 95% values — VERIFIED
- `vite.config.js` contains literal `"src/data/**":` with 90% values — VERIFIED
- `vite.config.js` does NOT contain a top-level threshold key (no `lines:` outside the per-directory blocks) — VERIFIED
- `eslint.config.js` contains literal `no-restricted-imports` (NEW block) AND `**/tests/**` AND `T-2-03` — VERIFIED
- ESLint canary probe at `src/_lint-canary/probe.js` rejected with the T-2-03 message — VERIFIED + probe deleted
- Coverage threshold canary: skipped 2 it() blocks → exit=1 with literal `"src/domain/"` threshold violation → restored → exit=0 — VERIFIED

### Files (Task 2)

- `tests/fixtures/snapshot-org.json` is valid JSON, contains all 8 required keys (`pillars`, `users`, `orgs`, `orgMetas`, `comments`, `actions`, `engagement`, `readStates`), is 41,951 bytes (>5KB) — VERIFIED
- `tests/views/dashboard.test.js` exists, contains `// @ts-check` AND `await expect(html).toMatchFileSnapshot("../__snapshots__/views/dashboard.html")` AND `vi.resetModules()` — VERIFIED
- `tests/views/diagnostic.test.js` exists with `toMatchFileSnapshot("../__snapshots__/views/diagnostic.html")` AND `button[data-route="diagnostic"]` click — VERIFIED
- `tests/views/report.test.js` exists with `toMatchFileSnapshot("../__snapshots__/views/report.html")` AND `button[data-route="report"]` click — VERIFIED
- `tests/__snapshots__/views/dashboard.html` exists, 9,970 B (>5KB), contains `class="view-title">Test Org<` + `data-route="dashboard"` `nav-btn active` — VERIFIED
- `tests/__snapshots__/views/diagnostic.html` exists, 5,345 B (>5KB), contains `class="view-title">Diagnostic<` + `class="tiles">` + `Strategy & ICP` — VERIFIED
- `tests/__snapshots__/views/report.html` exists, 17,172 B (>5KB), contains `<h1>The Base Layers diagnostic - Test Org</h1>` + `class="report"` + `LOW score` + `MEDIUM score` + `HIGH score` — VERIFIED
- All three snapshot files have LF line endings (Vitest 4's normaliser per RESEARCH.md Pre-flight 4) — VERIFIED
- `.gitignore` does NOT contain `tests/__snapshots__/` — VERIFIED (`grep -c '__snapshots__' .gitignore` returns 0)
- `git check-ignore tests/__snapshots__/views/dashboard.html` exits 1 (not ignored) — VERIFIED
- `02-06-NOTES.md` exists with "Route hash patterns resolved" + "Fixture branch coverage" + tooling-deviation sections — VERIFIED
- Running `npm test -- --run` twice in succession shows zero diff in `tests/__snapshots__/` — VERIFIED (stability test passed)

### Files (Task 3)

- `.github/workflows/ci.yml` contains literal `run: npm run test:coverage` (replaces prior `npm test`) — VERIFIED
- `.github/workflows/ci.yml` contains literal `name: coverage-report-html` AND `path: coverage/` AND `retention-days: 14` — VERIFIED
- `.github/workflows/ci.yml` contains literal `actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1` — VERIFIED
- Both upload-artifact uses share BYTE-IDENTICAL SHA: `grep -oE 'upload-artifact@[a-f0-9]+' .github/workflows/ci.yml | sort -u | wc -l` returns 1 — VERIFIED
- `.github/workflows/ci.yml` contains literal `Verify snapshot baselines present and non-empty` AND `if: always()` AND `test -s tests/__snapshots__/views/dashboard.html` (+ diagnostic + report) — VERIFIED
- `CONTRIBUTING.md` contains literal `## Updating snapshot tests` AND `npm test -- -u` AND `CI never auto-updates snapshots` — VERIFIED
- `CONTRIBUTING.md` contains literal `### Regression-baseline tests` AND `Phase 5 (DATA-07) will break it by design` AND `Phase 6 (AUTH-14) will DELETE this file` — VERIFIED
- `CONTRIBUTING.md` contains literal `## Test runtime budget` AND `<30s locally` AND `<90s in CI` — VERIFIED
- `CONTRIBUTING.md` contains literal `Coverage thresholds` section + reference to `SECURITY_AUDIT.md §0(4)` (the weakening anti-pattern) — VERIFIED
- `runbooks/phase-4-cleanup-ledger.md` contains literal `Phase 2 close-out` — VERIFIED

### Gates

- `npm run lint` exits 0 — VERIFIED
- `npm run typecheck` exits 0 — VERIFIED
- `npm run build` exits 0 (15 modules transformed) — VERIFIED
- `npm test -- --run --coverage` exits 0 with all per-directory thresholds met — VERIFIED
- `coverage/` directory contains `index.html` after the run (`ls coverage/index.html` succeeds) — VERIFIED
- 14 test files / 149 tests passing (was 11 / 128 in Wave 4 — +3 files / +21 tests) — VERIFIED

### Commits

- Task 1 commit `0193c03` (`feat(02-06-task1): wire coverage thresholds + test-isolation lint rule (D-15, D-16, T-2-03)`) — FOUND in git log
- Task 2 commit `c231053` (`test(02-06-task2): TEST-10 view snapshot tests + 3 committed baselines (D-08, D-10)`) — FOUND in git log
- Task 3 commit `3aabc87` (`ci(02-06-task3): wire coverage HTML artefact + snapshot governance docs (D-17, D-18, D-20)`) — FOUND in git log

### No package changes

- `git diff 7791bea..HEAD -- package.json package-lock.json` returns no output — VERIFIED. Zero new npm packages introduced this wave.

### No accidental deletions

- `git diff --diff-filter=D --name-only 7791bea HEAD` returns empty — VERIFIED. No tracked files deleted across the wave's three commits.

---

_Phase: 02-test-suite-foundation_
_Plan: 06 (Wave 5 — Snapshots + Coverage Threshold Gate + Governance — Phase 2 close-out)_
_Completed: 2026-05-06_
