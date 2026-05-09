---
phase: 02-test-suite-foundation
plan: 05
subsystem: data-auth-extraction
tags: [strangler-fig, data, auth, vitest, dependency-injection, pattern-d, pattern-e, pattern-g, regression-baseline, h8, pitfall-20, pitfall-10, test-04, test-06, test-07, d-05, d-06, d-12, auth-14, phase-6-deletion-baseline]

# Dependency graph
requires:
  - phase: 02-test-suite-foundation
    plan: 04
    provides: src/domain/{completion,unread}.js + tests/fixtures/auth-passwords.js (Wave 0) + tests/mocks/firebase.js (Wave 0) + 99-test baseline (Wave 3 outputs)
provides:
  - "src/data/migration.js — migrateV1IfNeeded + clearOldScaleResponsesIfNeeded, byte-identical extraction. uid + iso imported from util/ids.js (Wave 1); full Pattern D DI of loadUsers/loadOrgMetas/loadOrg/saveOrg/upsertUser/findUser/removeV1ActiveKey/loadSettings/saveSettings."
  - "src/data/cloud-sync.js — syncFromCloud, byte-identical extraction. Full Pattern D DI of fbReady/cloudFetchAllOrgs/cloudFetchAllUsers/cloudPushOrg/cloudPushUser/jget/jset/K/render. **Pitfall 20 / H8 entanglement preserved as regression baseline.**"
  - "src/auth/state-machine.js — currentUser + verifyInternalPassword + verifyOrgClientPassphrase + verifyUserPassword, byte-identical extraction. hashString imported from util/hash.js (Wave 1); full Pattern D DI of INTERNAL_PASSWORD_HASH/loadOrg/findUser/currentSession. **Phase 6 (AUTH-14) deletes the whole module — regression baseline.**"
  - "tests/data/migration.test.js — 9 it() cases closing TEST-04: UID determinism canary + 6 migrateV1IfNeeded + 2 clearOldScaleResponsesIfNeeded; load-bearing idempotency assertion (Pitfall 10)"
  - "tests/data/cloud-sync.test.js — 7 it() cases closing TEST-06; opens with verbatim mandatory REGRESSION BASELINE — Phase 2 / Pitfall 20 (H8 entanglement) header (Pattern G); H8 cloud-wins-on-overlap pinned via deep-equal assertion + bail-on-null asserts no localStorage writes"
  - "tests/auth/state-machine.test.js — 13 it() cases closing TEST-07; opens with verbatim mandatory REGRESSION BASELINE — Phase 2 / Phase 6 (AUTH-14) deletes header (Pattern G); uses real crypto.subtle.digest via knownPasswords fixture (Plan 02-01)"
  - "tests/fixtures/v1-localStorage.json — TEST-04 v1 input shape (per app.js:484-556 consumer code)"
  - "tests/fixtures/v2-org.json — TEST-04 expected post-migration shape"
  - "tests/fixtures/cloud-sync-conflict.json — TEST-06 scenarios: scenarioOverlap + scenarioLocalOnly + scenarioBail"
  - "runbooks/phase-4-cleanup-ledger.md — 3 new extraction-table rows (migration.js, cloud-sync.js, state-machine.js) + 3 new history-list rows + 1 new JSDoc-was-any decision row (migration.js); H8 + AUTH-14 break-by-design notes attached"
affects: [02-06, 04, 05, 06]

tech-stack:
  added: []
  patterns:
    - "Pattern D (RESEARCH.md Pattern 2): DI of localStorage helpers + Firebase helpers + auth dependencies into the three new modules"
    - "Pattern E: caller-side wrapper closures in the IIFE bind the DI surface so internal call sites stay byte-identical"
    - "Pattern G: REGRESSION BASELINE — Phase 2 / Pitfall 20 (H8) verbatim header on tests/data/cloud-sync.test.js; REGRESSION BASELINE — Phase 2 / Phase 6 (AUTH-14) deletes verbatim header on tests/auth/state-machine.test.js (D-21 mandatory + T-2-04 mitigation)"
    - "D-12 honoured: real crypto.subtle.digest used via hashString import; knownPasswords fixture imported from Plan 02-01 — no per-test hashing"
    - "Strangler-fig leaf extraction (Pitfall 9 step 2, Wave 4 of the topological order — final wave for D-02 extraction targets)"

key-files:
  created:
    - "src/data/migration.js"
    - "src/data/cloud-sync.js"
    - "src/auth/state-machine.js"
    - "tests/data/migration.test.js"
    - "tests/data/cloud-sync.test.js"
    - "tests/auth/state-machine.test.js"
    - "tests/fixtures/v1-localStorage.json"
    - "tests/fixtures/v2-org.json"
    - "tests/fixtures/cloud-sync-conflict.json"
  modified:
    - "app.js"
    - "runbooks/phase-4-cleanup-ledger.md"
  deleted: []

key-decisions:
  - "D-05 byte-identical extraction honoured for all three modules (3 functions in migration.js, 1 in cloud-sync.js, 4 in state-machine.js — 8 total in this wave)."
  - "D-06 honoured: all three modules carry @ts-check + JSDoc from day 1. JSDoc-was-any decision logged for migration.js's `migrated` local + per-callback args (rationale: byte-identical IIFE used `// @ts-nocheck` for the entire app.js; the deep-loose-object writes don't typecheck under strict checkJs)."
  - "Re-verified extraction line ranges (post-Wave-3 drift): migration source at app.js:484-556 (migrateV1IfNeeded) + app.js:5295-5309 (clearOldScaleResponsesIfNeeded) — planner-cited as 550-622 + 5459-5473; cloud-sync source at app.js:3397-3434 — planner-cited as 3556-3593; auth source at app.js:332-335 (currentUser) + 453-456 (verifyInternalPassword) + 466-471 (verifyOrgClientPassphrase) + 485-490 (verifyUserPassword) — planner-cited as 363-366 + 510-547. Drift consistent with Wave 1+2+3 deletion footprint (~60 lines moved up due to prior extractions)."
  - "currentUser FINALLY extracted in Task 3 — Wave 3 deferred this specifically because state-machine.js owns it. Verified `grep -c '^  function currentUser' app.js` returns 0 AFTER deletion. `currentSession` (different function — session getter/setter, not on D-02 list) STAYS at app.js:329-331 — verified by grep returning 1 BEFORE and AFTER the deletion."
  - "Mandatory regression-baseline headers (Pattern G) committed verbatim to BOTH tests/data/cloud-sync.test.js (H8 variant) AND tests/auth/state-machine.test.js (Phase 6 variant). Both honor WARNING 4 — provenance comment line is the SECOND text element after the regression header, so reverse-grep for 'Phase 2 (D-05)' finds these test files alongside the rest of the wave's outputs."
  - "UID determinism canary pinned at `u_ihs00` (computed deterministically under Math.random=0.5 + frozen Date.now=2026-01-01T00:00:00.000Z mocks: (0.5).toString(36).slice(2,9) = 'i'; (1767225600000).toString(36).slice(-4) = 'hs00'; combined = 'u_ihs00'). The plan's acceptance-criterion regex `/^u_[a-z0-9]{7,}[a-z0-9]{4}$/` was inconsistent with what `uid()` actually produces — see Deviation 2 below."

requirements-completed: [TEST-04, TEST-06, TEST-07]

# Metrics
duration: "~13 min (Tasks 1-3)"
completed: 2026-05-06
---

# Phase 02 Plan 05: Wave 4 — Data + Auth Extraction (TEST-04 + TEST-06 + TEST-07) Summary

**Three coordinated strangler-fig extractions in one wave: src/data/migration.js (migrateV1IfNeeded + clearOldScaleResponsesIfNeeded) with full Pattern D DI; src/data/cloud-sync.js (syncFromCloud) with full Pattern D DI of Firebase helpers; src/auth/state-machine.js (currentUser + verifyInternalPassword + verifyOrgClientPassphrase + verifyUserPassword) — currentUser FINALLY extracted (Wave 3 deferred). Three new test files exercising 9+7+13=29 it() cases closing TEST-04 + TEST-06 + TEST-07; tests/data/migration.test.js carries the load-bearing idempotency assertion (Pitfall 10) plus a UID determinism canary; tests/data/cloud-sync.test.js opens with the MANDATORY verbatim REGRESSION BASELINE — Phase 2 / Pitfall 20 (H8 entanglement) header pinning cloud-wins-on-overlap behaviour as the H8 regression baseline (Phase 5+ subcollection migration cutover evidence); tests/auth/state-machine.test.js opens with the MANDATORY verbatim REGRESSION BASELINE — Phase 2 / Phase 6 (AUTH-14) deletes header pinning the comparator path as the Phase 6 deletion baseline; three new fixtures (v1-localStorage.json, v2-org.json, cloud-sync-conflict.json) committed; cleanup-ledger appended for all three modules with H8 + AUTH-14 break-by-design notes; lint+typecheck+build+test all green; 128 tests across 11 files (was 99/8 in Wave 3, +29 tests / +3 files); zero new npm packages.**

## Performance

- **Duration:** ~13 min (Tasks 1-3)
- **Started:** 2026-05-06T~14:38Z (Task 1 commit `6a30cbd`)
- **Completed:** 2026-05-06T~14:48Z (this SUMMARY commit)
- **Tasks:** 3 / 3
- **Files modified:** 11 (3 new src/{data,auth}/, 3 new tests/{data,auth}/, 3 new tests/fixtures/, app.js, runbooks/phase-4-cleanup-ledger.md)
- **Commits:** 3 (Task 1 = `6a30cbd` test, Task 2 = `ec45ea4` test, Task 3 = `8c744d3` test)

## Re-verified extraction line ranges (post-Wave-3 drift)

The plan cited line ranges from the pre-Wave-3 planner view:

- planner-cited migration source: `app.js:550-622` + `app.js:5459-5473`
- planner-cited cloud-sync source: `app.js:3556-3593`
- planner-cited auth source: `app.js:363-366` (`currentUser`) + `app.js:510-547` (`verify*`)

Actual ranges at execution time (post all prior waves' deletions):

- **migration actual:** `app.js:484-556` (`migrateV1IfNeeded`) + `app.js:5295-5309` (`clearOldScaleResponsesIfNeeded`)
- **cloud-sync actual:** `app.js:3397-3434` (`syncFromCloud`)
- **auth actual:** `app.js:332-335` (`currentUser`) + `app.js:453-456` (`verifyInternalPassword`) + `app.js:466-471` (`verifyOrgClientPassphrase`) + `app.js:485-490` (`verifyUserPassword`)

Drift consistent with the prior waves' deletion footprint (~60 lines moved up because Waves 1-3 collapsed roughly 60-70 lines from above the relevant ranges).

## DI signatures (Pattern D)

`migration.js`:

```javascript
import { uid, iso } from "../util/ids.js";
export function migrateV1IfNeeded({ loadUsers, loadOrgMetas, loadOrg, saveOrg, upsertUser, findUser, removeV1ActiveKey }) { ... }
export function clearOldScaleResponsesIfNeeded({ loadSettings, saveSettings, loadOrgMetas, loadOrg, saveOrg }) { ... }
```

`cloud-sync.js`:

```javascript
export async function syncFromCloud({
  fbReady, cloudFetchAllOrgs, cloudFetchAllUsers, cloudPushOrg, cloudPushUser,
  jget, jset, K, render,
}) { ... }
```

`state-machine.js`:

```javascript
import { hashString } from "../util/hash.js";
export async function verifyInternalPassword(pass, { INTERNAL_PASSWORD_HASH }) { ... }
export async function verifyOrgClientPassphrase(orgId, pass, { loadOrg }) { ... }
export async function verifyUserPassword(userId, pass, { findUser }) { ... }
export function currentUser({ currentSession, findUser }) { ... }
```

## Caller-side wrappers in app.js (Pattern E)

```javascript
const migrateV1IfNeeded = () => _migrateV1IfNeeded({
  loadUsers, loadOrgMetas, loadOrg, saveOrg, upsertUser, findUser,
  removeV1ActiveKey: () => LS.removeItem(K.v1Active),
});
const clearOldScaleResponsesIfNeeded = () => _clearOldScaleResponsesIfNeeded({
  loadSettings, saveSettings, loadOrgMetas, loadOrg, saveOrg,
});
const syncFromCloud = () => _syncFromCloud({
  fbReady, cloudFetchAllOrgs, cloudFetchAllUsers, cloudPushOrg, cloudPushUser,
  jget, jset, K, render,
});
const verifyInternalPassword = (pass) => auth.verifyInternalPassword(pass, { INTERNAL_PASSWORD_HASH });
const verifyOrgClientPassphrase = (orgId, pass) => auth.verifyOrgClientPassphrase(orgId, pass, { loadOrg });
const verifyUserPassword = (userId, pass) => auth.verifyUserPassword(userId, pass, { findUser });
const currentUser = () => auth.currentUser({ currentSession, findUser });
```

`fbReady`, `cloudFetchAllOrgs`, `cloudFetchAllUsers`, `cloudPushOrg`, `cloudPushUser`, `jget`, `jset`, `render` are all defined later in the IIFE — hoisted (function declarations) or lazy-resolved (consts). `INTERNAL_PASSWORD_HASH` is a const declared later but the wrapper resolves it at call time.

## H8 + Phase 6 regression-baseline headers (Pattern G — VERBATIM)

The verbatim text committed to `tests/data/cloud-sync.test.js`:

```javascript
/**
 * REGRESSION BASELINE — Phase 2 / Pitfall 20 (H8 entanglement)
 *
 * These tests pin CURRENT behaviour of syncFromCloud — cloud wins on overlap
 * (last-writer-wins). Phase 5+ subcollection migration will rewrite the merge
 * algorithm; when that lands, these tests will fail — that failure IS the
 * evidence of the cutover, not a regression.
 */

// Provenance: Phase 2 (D-05) regression baseline test for src/data/cloud-sync.js extraction
```

The H8 entanglement is also explicitly pinned in a load-bearing test case:

> `CLOUD WINS on overlap: localStorage org takes the cloud version (H8 baseline)`
>
> `expect(store[K.org("x")].marker).toBe("cloud"); // cloud version, not local`

**This is the H8 / Pitfall 20 regression baseline. Phase 5+ subcollection migration MUST NOT silently drift cloud-sync conflict-resolution behavior without explicitly updating these tests — that failure IS the cutover evidence.**

The verbatim text committed to `tests/auth/state-machine.test.js`:

```javascript
/**
 * REGRESSION BASELINE — Phase 2 / Phase 6 (AUTH-14) deletes
 *
 * These tests pin the CURRENT comparator path: client-side SHA-256 of a
 * pre-shared password compared against a hardcoded hash (INTERNAL_PASSWORD_HASH)
 * or per-org/per-user hash. Phase 6 (AUTH-14) deletes the whole comparator path
 * when real Firebase Auth + custom claims land. When that lands, these tests
 * will be DELETED (not "translated") alongside the production code, per
 * CONTEXT.md `<specifics>` third bullet. The tests' value is the regression
 * baseline during the Phase 6 cutover, not long-term coverage.
 */

// Provenance: Phase 2 (D-05) regression baseline test for src/auth/state-machine.js extraction
```

**This is the Phase 6 deletion baseline. Phase 6 (AUTH-14) WILL delete the whole `src/auth/state-machine.js` module + this test file alongside it. The test file's existence + the canary plaintext+hash assertions document the *current* comparator path so the Phase 6 cutover diff is reviewable as a deliberate replacement, not a silent regression.**

## D-02 extraction inventory — every target now extracted

This wave closes the D-02 extraction list. Every function on the list now lives at its `src/{util,domain,data,auth}/*.js` target path; app.js IIFE no longer defines any of them inline:

| Function | Source line range (final) | Module | Wave |
|---|---|---|---|
| `uid` | app.js:42-44 | src/util/ids.js | Wave 1 |
| `iso` | app.js:46 | src/util/ids.js | Wave 1 |
| `formatWhen` | app.js:48-57 | src/util/ids.js | Wave 1 |
| `initials` | app.js:68-74 | src/util/ids.js | Wave 1 |
| `firstNameFromAuthor` | app.js:76-91 | src/util/ids.js | Wave 1 |
| `hashString` | app.js:483-495 | src/util/hash.js | Wave 1 |
| `pillarStatus` | app.js:241-246, 2761-2786 | src/domain/banding.js | Wave 2 |
| `bandLabel` | app.js:2761-2786 | src/domain/banding.js | Wave 2 |
| `bandStatement` | app.js:2761-2786 | src/domain/banding.js | Wave 2 |
| `bandColor` | app.js:2761-2786 | src/domain/banding.js | Wave 2 |
| `pillarScoreForRound` | app.js:219-235 | src/domain/scoring.js | Wave 2 |
| `pillarScore` | app.js:237-239 | src/domain/scoring.js | Wave 2 |
| `respondentsForRound` | app.js:248-251 | src/domain/scoring.js | Wave 2 |
| `answeredCount` | app.js:253-259 | src/domain/scoring.js | Wave 2 |
| `userCompletionPct` | app.js:241-250 | src/domain/completion.js | Wave 3 |
| `orgSummary` | app.js:241-250 | src/domain/completion.js | Wave 3 |
| `unreadCountForPillar` | app.js:299-317 | src/domain/unread.js | Wave 3 |
| `unreadCountTotal` | app.js:299-317 | src/domain/unread.js | Wave 3 |
| `markPillarRead` | app.js:299-317 | src/domain/unread.js | Wave 3 |
| `unreadChatTotal` | app.js:348-357 | src/domain/unread.js | Wave 3 |
| `migrateV1IfNeeded` | app.js:484-556 | src/data/migration.js | **Wave 4** |
| `clearOldScaleResponsesIfNeeded` | app.js:5295-5309 | src/data/migration.js | **Wave 4** |
| `syncFromCloud` | app.js:3397-3434 | src/data/cloud-sync.js | **Wave 4** |
| `currentUser` | app.js:332-335 | src/auth/state-machine.js | **Wave 4** |
| `verifyInternalPassword` | app.js:453-456 | src/auth/state-machine.js | **Wave 4** |
| `verifyOrgClientPassphrase` | app.js:466-471 | src/auth/state-machine.js | **Wave 4** |
| `verifyUserPassword` | app.js:485-490 | src/auth/state-machine.js | **Wave 4** |

**Verified by grep:** for every function name above, `grep -cE "^  ?(async )?function $fn\b" app.js` returns 0 (zero inline definitions remain in app.js for any D-02 target).

## Load-bearing positions preserved (post-Wave-4)

- `function currentSession() { return jget(K.session, null); }` STAYS at app.js:329-331 — different function from `currentUser`, not on D-02 extraction list. Preserved for the wrapper closure to bind. Verified by `grep -c "function currentSession" app.js` returns 1 BEFORE and AFTER all Task 3 deletions.
- `const INTERNAL_PASSWORD_HASH = "..."` STAYS at app.js:448 — wrapper closure binds it. Phase 6 (AUTH-14) deletes alongside the gitleaks-grandfathered C2 finding (out-of-band soft-fail row in cleanup ledger).
- `function loadOrg`, `function findUser`, `function loadUsers`, `function upsertUser`, `function loadOrgMetas`, `function loadSettings`, `function saveSettings`, `function saveOrg` — all STAY in the IIFE. They're the dependencies the wrapper closures bind.
- `function fbReady`, `function cloudFetchAllOrgs`, `function cloudFetchAllUsers`, `function cloudPushOrg`, `function cloudPushUser`, `const jget`, `const jset`, `const K`, `const LS` — all STAY in the IIFE. cloud-sync wrapper binds them.

## Test counts

- **Before (Wave 3):** 8 test files, 99 it() cases passing
- **After (Wave 4):** 11 test files, 128 it() cases passing
  - tests/setup.test.js: 3 (unchanged)
  - tests/crypto-parity.test.js: 3 (unchanged)
  - tests/util/ids.test.js: 18 (unchanged)
  - tests/util/hash.test.js: 6 (unchanged)
  - tests/domain/banding.test.js: 31 (unchanged)
  - tests/domain/scoring.test.js: 16 (unchanged)
  - tests/domain/completion.test.js: 11 (unchanged)
  - tests/domain/unread.test.js: 11 (unchanged)
  - **tests/data/migration.test.js: 9** (NEW — UID determinism canary + 6 migrateV1IfNeeded including idempotency + 2 clearOldScaleResponsesIfNeeded)
  - **tests/data/cloud-sync.test.js: 7** (NEW — bail × 3 + cloud-wins H8 baseline + local-only push × 2 + render-once)
  - **tests/auth/state-machine.test.js: 13** (NEW — verifyInternalPassword × 3 + verifyOrgClientPassphrase × 4 + verifyUserPassword × 4 + currentUser × 2)

## Phase 2 cleanup-ledger evidence (full extraction-table — 8 rows)

The runbook now contains this complete D-05 extraction table (Wave 1 + 2 + 3 + 4 outputs):

| Source line range  | Module                          | Function(s)                                                                                                  | Phase 4 candidate cleanup                                                                                  |
| ------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `app.js:42-44, 46, 48-57, 68-74, 76-91` | `src/util/ids.js`               | `uid`, `iso`, `formatWhen`, `initials`, `firstNameFromAuthor` (private helper: `capitalise`)                 | Replace `Math.random()` in `uid` with `crypto.randomUUID` (CODE-03); inline `capitalise`. |
| `app.js:483-495`   | `src/util/hash.js`              | `hashString`                                                                                                  | Phase 6 (AUTH-14) deletes — replaced by Firebase Auth.                                                      |
| `app.js:241-246, 2761-2786` | `src/domain/banding.js`         | `pillarStatus`, `bandLabel`, `bandStatement`, `bandColor`                                                     | Pull boundary constants (50, 75) into a named export; consolidate duplicate boundary checks. |
| `app.js:219-235, 237-239, 248-251, 253-259` | `src/domain/scoring.js`         | `pillarScoreForRound`, `pillarScore`, `respondentsForRound`, `answeredCount`         | Remove DI of `DATA` + `questionMeta` once `domain/pillars.js` lands and questionMeta is its own module. |
| `app.js:241-250` | `src/domain/completion.js`      | `userCompletionPct`, `orgSummary`                                                                              | Remove DI of `pillarScore` once import-from-`scoring.js` is direct. |
| `app.js:299-317` + `app.js:348-357` | `src/domain/unread.js`          | `unreadCountForPillar`, `unreadCountTotal`, `markPillarRead`, `unreadChatTotal`                                | **H7 fix (Phase 5, DATA-07) rewrites comparator — `tests/domain/unread.test.js` will break by design.** |
| `app.js:484-556` + `app.js:5295-5309` | `src/data/migration.js`         | `migrateV1IfNeeded`, `clearOldScaleResponsesIfNeeded`                                                          | DI surface collapses once data/orgs.js + data/users.js + data/settings.js own the helpers. Idempotency-via-flag stays — Pitfall 10 reasoning is durable. |
| `app.js:3397-3434` | `src/data/cloud-sync.js`        | `syncFromCloud`                                                                                                | **H8 fix (Phase 5+) rewrites merge algorithm — `tests/data/cloud-sync.test.js` will break by design.** |
| `app.js:332-335` + `app.js:453-456` + `app.js:466-471` + `app.js:485-490` | `src/auth/state-machine.js`     | `currentUser`, `verifyInternalPassword`, `verifyOrgClientPassphrase`, `verifyUserPassword`                     | **Phase 6 (AUTH-14) deletes the whole module — replaced by Firebase Auth + custom claims.** |

(That's actually 9 rows — the wave's frontmatter says "8 rows" but the table grew beyond that; the cleanup ledger evidence is complete.)

## git status confirmation

Final state on the worktree branch (post Tasks 1-3, before SUMMARY commit):

- A src/data/migration.js — new
- A src/data/cloud-sync.js — new
- A src/auth/state-machine.js — new
- A tests/data/migration.test.js — new
- A tests/data/cloud-sync.test.js — new
- A tests/auth/state-machine.test.js — new
- A tests/fixtures/v1-localStorage.json — new
- A tests/fixtures/v2-org.json — new
- A tests/fixtures/cloud-sync-conflict.json — new
- M app.js — modified across 3 task commits (Task 1: -91 +16; Task 2: -42 +7; Task 3: -20 +11; total -153 +34 = -119 net)
- M runbooks/phase-4-cleanup-ledger.md — modified (Phase 2 extraction-table extended + history list extended + JSDoc-was-any decisions extended)

No surprise files modified. No package.json changes (`git diff 2814dac..HEAD -- package.json package-lock.json` returns empty).

## Decisions Made

None outside the Decision Log already captured in 02-CONTEXT.md.

## Deviations from Plan

Two deviations applied during execution:

1. **Rule 2 (correctness — typecheck enforcement) on Task 1:** Plan's verbatim `src/data/migration.js` body uses deep-loose-object writes that don't typecheck under strict `checkJs` (`migrated.responses[roundId][legacyId][pillarId][idx]`). The byte-identical IIFE original used `// @ts-nocheck` on the entire app.js, so this typecheck friction is new in extraction. Resolution per D-06's escape clause ("If a JSDoc would force a behavioural change, leave the type as `any` and log it in the cleanup ledger"): added `/** @type {any} */` to `migrated` local + `@param {any}` to callback args. No behavioural change — all 9 it() cases still pass. Logged in cleanup ledger's JSDoc-was-`any` decisions table.

2. **Rule 1 (acceptance-criterion regex bug) on Task 1:** The plan's acceptance criterion `EXPECTED_LEGACY_UID = "u_<EXACT_VALUE_PRECOMPUTED_DURING_EXECUTION>"` says "value MUST match the regex `/^u_[a-z0-9]{7,}[a-z0-9]{4}$/`" (i.e., 11+ chars after `u_`). The actual `uid("u_")` output under tests/setup.js mocks (Math.random=0.5 + frozen Date.now=2026-01-01T00:00:00.000Z) is `u_ihs00` — only 5 chars after `u_`, because `(0.5).toString(36)` = `"0.i"` (only 1 char after the period) and `.slice(2,9)` returns just `"i"`. The plan's regex was inconsistent with what the `uid()` body actually produces under these mocks (it assumed Math.random would return a longer base-36 representation). Resolution: pinned `EXPECTED_LEGACY_UID = "u_ihs00"` to the actually-computed value with an explanatory comment. The canary still serves its load-bearing purpose — it catches harness drift (if tests/setup.js silently breaks the Math.random or Date.now mock, this canary fails). The plan's regex acceptance criterion is what's wrong, not the canary value.

## Authentication Gates

None.

## Issues Encountered

- **OneDrive cross-path propagation watch:** Wave 1+2 reported leakage where Edit/Write to fresh files occasionally landed in the parent project tree. This wave verified after each Write — `ls "C:/Users/.../base-layers-diagnostic/src/data/"` immediately after creating `migration.js` showed only the worktree path got the file. No leakage observed in Wave 4.
- **Vite build warning unchanged:** `<script src="data/pillars.js?v=50"> in "/index.html" can't be bundled without type="module" attribute` — Phase 1 D-14 anti-pattern; Phase 4 owns the cleanup. Build still exits 0; module count went from 12 (Wave 3) to 15 (Wave 4); bundle hash advanced from `main-DCNgagEP.js` to `main-BiXtwP5Z.js`.
- **PreToolUse Edit hook reminders:** Continued throughout this wave. Reminders were spurious (file content was already known from prior reads in the same session). No edits were blocked.

## Threat Model Compliance

- **T-2-03 (Information Disclosure — `tests/fixtures/auth-passwords.js` import boundary) — `mitigate` honoured.** `src/auth/state-machine.js` imports `hashString` from `../util/hash.js` ONLY (verified by `grep "from " src/auth/state-machine.js` showing the lone util/hash.js import). The test file `tests/auth/state-machine.test.js` imports `knownPasswords` from `../fixtures/auth-passwords.js` (a relative path inside `tests/`), with no leakage into `src/`. The Plan 02-06 ESLint `no-restricted-imports` rule will codify the boundary; this plan keeps it by construction.
- **T-2-04 (Tampering — regression-baseline test simplification) — `mitigate` honoured.** Both new regression-baseline test files have the verbatim Pattern G headers committed at the top:
  - `tests/data/cloud-sync.test.js` lines 4-11: H8 variant citing Pitfall 20 + "Phase 5+ subcollection migration will rewrite the merge algorithm; when that lands, these tests will fail — that failure IS the evidence of the cutover, not a regression."
  - `tests/auth/state-machine.test.js` lines 4-14: Phase 6 (AUTH-14) variant citing Phase 6 deletion + "When that lands, these tests will be DELETED (not 'translated') alongside the production code".
  - The cleanup-ledger rows for cloud-sync.js and state-machine.js carry matching break-by-design notes (H8 + AUTH-14).
  - Provenance lines on both test files honor WARNING 4 — reverse-grep for `Phase 2 (D-05)` finds these test files alongside the rest of the wave's outputs.
- **T-2-04 (cont'd — DI signature widens test surface) — `accept` honoured.** Tests pass mock `loadOrg`/`findUser`/`fbReady`/etc. shapes. The DI surface is intentionally wide; Phase 4 collapses it when state.js / data/orgs.js / firebase/* adapter own the helpers.

No new threat surface introduced; no `threat_flag` entries needed. The plan's `threats: [T-2-03, T-2-04]` frontmatter entries are fully addressed.

## Self-Check: PASSED

### Files

- `src/data/migration.js` exists, contains `// @ts-check`, `import { uid, iso } from "../util/ids.js"`, `export function migrateV1IfNeeded(deps)`, `export function clearOldScaleResponsesIfNeeded(deps)`, `email: "legacy@bedeveloped.local"` (verbatim), `if (users.length > 0) return;` (idempotency-via-flag), `if (s.scaleV2Cleared) return;` (clearOldScale flag) — VERIFIED
- `src/data/cloud-sync.js` exists, contains `// @ts-check`, `Pitfall 20 / H8 entanglement`, `export async function syncFromCloud(deps)`, `if (!fbReady()) return;`, `if (cloudOrgs === null || cloudUsers === null) return;`, `cloudOrgs.forEach((o) => {`, `jset(K.org(o.id), o)` (cloud-wins write) — VERIFIED
- `src/auth/state-machine.js` exists, contains `// @ts-check`, `import { hashString } from "../util/hash.js"`, all 4 export-function literals, `Phase 6 (AUTH-14) deletes this whole module` provenance — VERIFIED
- `tests/data/migration.test.js` exists, contains `// @ts-check`, `is idempotent — second run is a no-op (Pitfall 10)`, `expect(afterSecond).toEqual(afterFirst)` (load-bearing idempotency), `expect(legacy.email).toBe(v2Expected.expected_legacy_user_email)`, `UID determinism canary (catches harness drift)`, `EXPECTED_LEGACY_UID = "u_ihs00"` (precomputed value pinned, no placeholder remains) — VERIFIED
- `tests/data/cloud-sync.test.js` exists, contains the verbatim header `REGRESSION BASELINE — Phase 2 / Pitfall 20 (H8 entanglement)`, `cloud wins on overlap (last-writer-wins)`, `expect(store[K.org("x")].marker).toBe("cloud")` (H8 cloud-wins assertion), `expect(deps.cloudPushOrg).toHaveBeenCalledWith` (local-only push assertion), `// Provenance: Phase 2 (D-05) regression baseline test for src/data/cloud-sync.js extraction` — VERIFIED
- `tests/auth/state-machine.test.js` exists, contains the verbatim header `REGRESSION BASELINE — Phase 2 / Phase 6 (AUTH-14) deletes`, `import { knownPasswords } from "../fixtures/auth-passwords.js"`, `await verifyInternalPassword(knownPasswords.internal.plain, deps)).toBe(true)` (load-bearing positive case), `clientPassphraseHash`, `passwordHash`, `expect(currentUser(deps)).toBeNull()`, `// Provenance: Phase 2 (D-05) regression baseline test for src/auth/state-machine.js extraction` — VERIFIED
- `tests/fixtures/v1-localStorage.json` valid JSON, contains `"orgMetas"` and `"responses"` — VERIFIED
- `tests/fixtures/v2-org.json` valid JSON, contains `"expected_legacy_user_email": "legacy@bedeveloped.local"` — VERIFIED
- `tests/fixtures/cloud-sync-conflict.json` valid JSON with `scenarioOverlap` + `scenarioLocalOnly` + `scenarioBail` keys — VERIFIED

### app.js mutations

- `from "./src/data/migration.js"` — VERIFIED present
- `from "./src/data/cloud-sync.js"` — VERIFIED present
- `import * as auth from "./src/auth/state-machine.js"` — VERIFIED present
- `const migrateV1IfNeeded = () => _migrateV1IfNeeded({` (wrapper) — VERIFIED present
- `const syncFromCloud = () => _syncFromCloud({` (wrapper) — VERIFIED present
- `const verifyInternalPassword = (pass) => auth.verifyInternalPassword(pass, { INTERNAL_PASSWORD_HASH })` — VERIFIED present
- `const currentUser = () => auth.currentUser({ currentSession, findUser })` — VERIFIED present
- All inline definitions REMOVED for migrateV1IfNeeded, clearOldScaleResponsesIfNeeded, syncFromCloud, verifyInternalPassword, verifyOrgClientPassphrase, verifyUserPassword, currentUser — VERIFIED (`grep -cE "^  ?(async )?function $fn\b" app.js` returns 0 for each)
- `function currentSession` STILL present at app.js:329-331 — VERIFIED (count=1)
- `INTERNAL_PASSWORD_HASH` STILL present at app.js:448 — VERIFIED (count=2: definition + wrapper reference)
- Adjacency guards: `function loadOrg`=2, `function findUser`=2 (definition + wrapper ref each), `function loadUsers`=1, `const LS = `=1, `const K = {`=1, `function fbReady`=1, `function cloudFetchAllOrgs`=1, `function cloudFetchAllUsers`=1, `function cloudPushOrg`=1, `function cloudPushUser`=1, `const jget`=1, `const jset`=1 — all VERIFIED

### Cleanup ledger

- 3 new history-list entries (migration.js + cloud-sync.js + state-machine.js) — VERIFIED
- 3 new extraction-table rows with Phase 4 candidate cleanup notes including H8 + AUTH-14 break-by-design — VERIFIED
- 1 new JSDoc-was-`any` decisions row (migration.js `migrated` local + callback args) — VERIFIED

### Gates

- `npm run lint` exits 0 (`--max-warnings=0`) — VERIFIED
- `npm run typecheck` exits 0 (`tsc --noEmit`) — VERIFIED
- `npm run build` exits 0 (15 modules transformed, was 12 in Wave 3) — VERIFIED
- `npm test -- --run` exits 0 — VERIFIED. 11 test files, 128 tests passing (was 8/99 in Wave 3, +3 files / +29 tests).

### Commits

- Task 1 commit `6a30cbd` (`test(02-05): extract data/migration + TEST-04 with idempotency assertion`) — FOUND in git log
- Task 2 commit `ec45ea4` (`test(02-05): extract data/cloud-sync + TEST-06 H8 regression baseline`) — FOUND in git log
- Task 3 commit `8c744d3` (`test(02-05): extract auth/state-machine + TEST-07 Phase 6 regression baseline`) — FOUND in git log

### No package changes

- `git diff 2814dac..HEAD -- package.json package-lock.json` returns empty — VERIFIED. No new packages introduced.

### No accidental deletions

- `git diff --diff-filter=D --name-only 2814dac HEAD` returns empty — VERIFIED. No tracked files deleted across the wave's commits.

## H8 (cloud-sync) + Phase 6 (auth) Regression Baseline Note

**This wave establishes TWO load-bearing regression baselines:**

1. **TEST-06 (cloud-sync) is the H8 / Pitfall 20 regression baseline.** The verbatim Pattern G header at the top of `tests/data/cloud-sync.test.js` + the explicit pinned assertion `expect(store[K.org("x")].marker).toBe("cloud")` codify cloud-wins-on-overlap behaviour. **Phase 5's data-model migration MUST NOT silently drift cloud-sync conflict-resolution behavior without explicitly updating these tests — that failure IS the cutover evidence.**

2. **TEST-07 (auth state-machine) is the Phase 6 deletion baseline.** The verbatim Pattern G header at the top of `tests/auth/state-machine.test.js` + the use of real crypto.subtle.digest + knownPasswords fixtures cross-validate the comparator path Phase 6 (AUTH-14) replaces. **Phase 6 will replace these auth helpers with Firebase Auth + claims; the tests landed here document the current behavior so the replacement is a deliberate cutover, not a silent regression. The tests will be DELETED (not "translated") alongside the production code per CONTEXT.md `<specifics>` third bullet.**

The cleanup-ledger rows for `src/data/cloud-sync.js` and `src/auth/state-machine.js` carry the matching break-by-design notes in the "Phase 4 candidate cleanup" column.

## Pointer to Wave 5 (Plan 02-06)

Wave 5 (Plan 02-06) closes Phase 2 with:

- **TEST-10** — snapshot tests for dashboard / diagnostic / report renderers (D-07 / D-08 / D-09 / D-10)
- **D-15** — per-directory coverage thresholds wired into `vite.config.js` (`src/domain/**` 100%, `src/util/**` 100%, `src/auth/**` 95%, `src/data/**` 90%)
- **D-21** — `SECURITY.md` "Regression baseline" paragraph appended (citing TEST-01..07 + TEST-10 + framework references: OWASP ASVS V14.2, ISO 27001 A.12.1.2, SOC2 CC8.1)
- **D-17 + D-18** — `CONTRIBUTING.md` "Updating snapshot tests" + "Test runtime budget" sections
- **D-20** — coverage report HTML artefact upload step in `.github/workflows/ci.yml`
- **D-19** — delete `tests/smoke.test.js` (no longer needed; was already deleted in Wave 0 — verify still gone)
- **ESLint `no-restricted-imports`** for the `tests/**` ↔ `src/**` boundary (T-2-03 codification)

After Wave 5, Phase 2 is signed off; the test fence is in place; Phase 4's modular split is unblocked.

---

_Phase: 02-test-suite-foundation_
_Plan: 05 (Wave 4 — Data + Auth Extraction: migration + cloud-sync + state-machine; H8 + Phase 6 regression baselines)_
_Completed: 2026-05-06_
