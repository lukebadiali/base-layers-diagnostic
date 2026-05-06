---
phase: 02-test-suite-foundation
plan: 04
subsystem: domain-extraction
tags: [strangler-fig, domain, completion, unread, vitest, dependency-injection, pattern-d, pattern-e, pattern-g, regression-baseline, h7, pitfall-20, test-03, test-05, d-05, d-06]

requires:
  - phase: 02-test-suite-foundation
    plan: 03
    provides: src/domain/banding.js (pillarStatus) + src/domain/scoring.js (pillarScore via DI) + 77-test baseline (Wave 2 outputs)
provides:
  - "src/domain/completion.js — userCompletionPct + orgSummary, byte-identical extraction. pillarStatus imported from banding.js (Wave 2); pillarScore + DATA injected per Pattern D."
  - "src/domain/unread.js — unreadCountForPillar + unreadCountTotal + markPillarRead + unreadChatTotal, byte-identical extraction. iso imported from util/ids.js (Wave 1); commentsFor / saveOrg / state / lastReadMillis / msgMillis / unreadChatForOrg injected per Pattern D. **Pitfall 20 / H7 entanglement preserved as regression baseline.**"
  - "tests/domain/completion.test.js — 11 it() cases closing TEST-03: 5 userCompletionPct + 6 orgSummary including 50/51 + 75/76 pillarStatus integration boundaries"
  - "tests/domain/unread.test.js — 11 it() cases closing TEST-05; opens with the verbatim mandatory REGRESSION BASELINE — Phase 2 / Pitfall 20 header (Pattern G); H7 entanglement explicitly pinned via the 'lastT=0 → every other-author counts' assertion"
  - "tests/fixtures/unread-state.json — TEST-05 input fixture: one pillar with three comments (before-lastRead other-author, after-lastRead other-author, after-lastRead self) + one readState entry; intentionally H7-entangled timestamps"
  - "runbooks/phase-4-cleanup-ledger.md — 2 new extraction rows + 3 JSDoc-was-any rows + Wave 3 history entries; H7 break-by-design note attached to unread.js row"
affects: [02-05, 02-06, 04, 05, 06]

tech-stack:
  added: []
  patterns:
    - "Pattern D (RESEARCH.md Pattern 2): DI of DATA + pillarScore into completion.js; DI of commentsFor + saveOrg + state + lastReadMillis + msgMillis + unreadChatForOrg into unread.js"
    - "Pattern E: caller-side wrapper closures in the IIFE bind the DI surface so internal call sites stay byte-identical"
    - "Pattern G: REGRESSION BASELINE — Phase 2 / Pitfall 20 verbatim header on tests/domain/unread.test.js (D-21 mandatory + T-2-04 mitigation)"
    - "Strangler-fig leaf extraction (Pitfall 9 step 2, Wave 3 of the topological order)"

key-files:
  created:
    - "src/domain/completion.js"
    - "src/domain/unread.js"
    - "tests/domain/completion.test.js"
    - "tests/domain/unread.test.js"
    - "tests/fixtures/unread-state.json"
  modified:
    - "app.js"
    - "runbooks/phase-4-cleanup-ledger.md"
  deleted: []

key-decisions:
  - "D-05 byte-identical extraction honoured for both completion (2 functions, semantic-body identical) and unread (4 functions including H7-entangled comparators preserved verbatim)."
  - "D-06 honoured: completion.js + unread.js carry @ts-check + JSDoc from day 1. JSDoc-was-any decisions logged for org parameter on both modules + the user parameter on unreadChatTotal (rationale: byte-identical IIFE shape uses loose-object indexing + passes user.orgId typed string|undefined into a string-required slot — tightening would force a defensive guard the IIFE doesn't have)."
  - "Re-verified extraction line ranges (post-Wave-2 drift): completion source at app.js:241-250 (post Wave-2 wrappers occupied 241-249, the inline functions originally at 251-276 collapsed); unread source at app.js:299-317 (3 functions: unreadCountForPillar, unreadCountTotal, markPillarRead) + app.js:348-357 (unreadChatTotal — note: the chat block at app.js:318-347 is currentUser + chatReadKey/loadChatLastRead/saveChatLastRead/markChatReadFor/lastReadMillis/msgMillis/unreadChatForOrg, all of which STAY in the IIFE)."
  - "currentUser preserved at app.js:306-309 — Wave 4 (Plan 02-05) auth state-machine extraction owns it. Verified `grep -c 'function currentUser' app.js` returns 1 BEFORE and AFTER all deletions."
  - "Plan-cited line ranges (282-307 for completion; 340-414 for unread) drifted by ~35-40 lines from the planner's pre-Wave-2 view because Wave 2 collapsed ~46 lines from above the relevant ranges. Pre-cite range 340-414 is currently 299-317 + 348-357 (with currentUser at 306-309 and chat helpers at 318-347 explicitly NOT extracted)."
  - "Mandatory regression-baseline header (Pattern G) committed verbatim to tests/domain/unread.test.js per CONTEXT.md `<specifics>` second bullet. Header structure honours WARNING 4 (provenance comment line is the SECOND text element after the regression header, keeping reverse-grep for 'Phase 2 (D-05)' finding these test files alongside the rest of the wave's outputs)."

requirements-completed: [TEST-03, TEST-05]

duration: "~13 min (Tasks 1-3)"
completed: 2026-05-06
---

# Phase 02 Plan 04: Wave 3 — Domain Extraction (completion + unread, TEST-03 + TEST-05) Summary

**Strangler-fig extraction of src/domain/completion.js (userCompletionPct + orgSummary — Level 2 with DATA + pillarScore injected; pillarStatus imported from Wave 2) and src/domain/unread.js (unreadCountForPillar + unreadCountTotal + markPillarRead + unreadChatTotal — Level 2 with iso imported + 6 IIFE-internal helpers injected via Pattern D); two new test files exercising 11 completion cases + 11 unread cases (22 new it() assertions total) closing TEST-03 + TEST-05; tests/fixtures/unread-state.json fixture committed; tests/domain/unread.test.js opens with the MANDATORY verbatim REGRESSION BASELINE — Phase 2 / Pitfall 20 header pinning the H7 entanglement (Phase 5 / DATA-07 cutover evidence); cleanup-ledger appended for both modules + Phase 5 H7-break-by-design note for unread.js + 3 JSDoc-was-any decisions; lint+typecheck+build+test all green.**

## Performance

- **Duration:** ~13 min (start 2026-05-06T14:16Z, end 2026-05-06T14:29Z)
- **Tasks:** 3 / 3 complete
- **Files modified:** 7 (2 new src/domain/, 2 new tests/domain/, 1 new tests/fixtures/, app.js, runbooks/phase-4-cleanup-ledger.md)
- **Commits:** 3 (Task 1 = 7706466 feat, Task 2 = 215927d test, Task 3 = 11049ad test)

## Re-verified extraction line ranges (post-Wave-2 drift)

The plan cited line ranges from the pre-Wave-2 layout:

- planner-cited completion source: `app.js:282-307` (`userCompletionPct` + `orgSummary`)
- planner-cited unread source: `app.js:340-414` (`unreadCountForPillar`, `unreadCountTotal`, `markPillarRead`, `unreadChatTotal` — EXCLUDING `currentUser` at 363-366)

After Wave 2 collapsed the scoring/banding bodies in `app.js` (-66 +21 net per the prior wave's git diff), the actual ranges at execution time were:

- **completion actual:** `app.js:241-250` (Wave 2 wrappers landed at 244-249; the original `userCompletionPct` + `orgSummary` followed immediately at 251-276 in the post-Wave-2 layout, which Wave 3 deleted in Task 1).
- **unread actual:** `app.js:299-317` (`unreadCountForPillar` + `unreadCountTotal` + `markPillarRead`) + `app.js:348-357` (`unreadChatTotal`). The chat helpers (`chatReadKey`, `loadChatLastRead`, `saveChatLastRead`, `markChatReadFor`, `lastReadMillis`, `msgMillis`, `unreadChatForOrg`) at app.js:318-347 are NOT on the D-02 extraction list and STAY inline — they're the IIFE-internal helpers that Wave 3's `unreadChatTotal` wrapper INJECTS.
- **`currentUser` STAYS** at app.js:306-309 (post-Wave-2 location — was app.js:363-366 in the planner's pre-Wave-2 view). Belongs to Wave 4 (auth state machine).

Drift consistent with the prior wave's deletion footprint (~35-40 lines).

## DI signatures (Pattern D)

`completion.js`:

```javascript
import { pillarStatus } from "./banding.js";
export function userCompletionPct(org, roundId, userId, DATA) { ... }
export function orgSummary(org, DATA, pillarScore) { ... }
```

`unread.js`:

```javascript
import { iso } from "../util/ids.js";
export function unreadCountForPillar(org, pillarId, user, commentsFor) { ... }
export function unreadCountTotal(org, user, DATA, commentsFor) { ... }
export function markPillarRead(org, pillarId, user, saveOrg) { ... }
export function unreadChatTotal(user, state, lastReadMillis, msgMillis, unreadChatForOrg) { ... }
```

## Caller-side wrappers in app.js (Pattern E)

The IIFE keeps wrapper closures so every internal call site stays byte-identical:

```javascript
const userCompletionPct = (org, roundId, userId) =>
  _userCompletionPct(org, roundId, userId, DATA);
const orgSummary = (org) => _orgSummary(org, DATA, pillarScore);
const unreadCountForPillar = (org, pillarId, user) =>
  _unreadCountForPillar(org, pillarId, user, commentsFor);
const unreadCountTotal = (org, user) => _unreadCountTotal(org, user, DATA, commentsFor);
const markPillarRead = (org, pillarId, user) => _markPillarRead(org, pillarId, user, saveOrg);
const unreadChatTotal = (user) =>
  _unreadChatTotal(user, state, lastReadMillis, msgMillis, unreadChatForOrg);
```

`pillarScore` is forward-referenced from the wrapper above (defined two lines earlier in the same `const` block — Wave 2's wrapper). `commentsFor`, `saveOrg`, `lastReadMillis`, `msgMillis`, `unreadChatForOrg` are all `function` declarations defined later in the IIFE — hoisted, safe at call time. `state` is a `const` declared at app.js:580; the wrapper resolves it lazily at call time, never at boot time.

## H7 regression-baseline header (Pattern G — VERBATIM)

The verbatim text committed to `tests/domain/unread.test.js`:

```javascript
/**
 * REGRESSION BASELINE — Phase 2 / Pitfall 20
 *
 * These tests pin the CURRENT behaviour of unread tracking, including the
 * known H7 (clock skew) entanglement: client clocks are mixed with server
 * clocks in the comparator. Phase 5 (DATA-07) fixes H7 by moving last-read
 * markers into Firestore readStates. When that lands, these tests will fail —
 * that failure IS the evidence of the cutover, not a regression.
 *
 * Phase 5 plan task: replace these tests with new ones that assert
 * server-clock-vs-server-clock comparators (5-minute clock skew on the
 * client does not change unread counts).
 */

// Provenance: Phase 2 (D-05) regression baseline test for src/domain/unread.js extraction
```

The H7 entanglement is also explicitly pinned in a load-bearing test case:

> `unreadCountForPillar > counts every other-author comment as unread when lastT = 0 (no readState entry)`
>
> `// H7 entanglement: with no readState for this user, EVERY other-author comment counts as unread. Phase 5 fixes; Phase 2 pins.`

**This is the H7 / Pitfall 20 regression baseline. Phase 5's H7 fix MUST NOT silently drift unread-count behaviour without explicitly updating these tests — that failure IS the cutover evidence.**

## Load-bearing positions preserved (Wave 4 prerequisites)

- **`function currentUser()` at app.js:306-309** — UNCHANGED. Belongs to Wave 4 (auth state machine).
- **`function commentsFor` at app.js:294-298** — UNCHANGED. Bound into Wave 3 wrappers via DI; not on the D-02 extraction list.
- **`function lastReadMillis` / `msgMillis` / `unreadChatForOrg` at app.js:334-347** — UNCHANGED. Bound into Wave 3's `unreadChatTotal` wrapper; not on the D-02 extraction list.
- **`const state = { ... }` at app.js:580** — UNCHANGED. Wave 3 wrapper closes over it lazily.
- **`function questionMeta(entry)` at app.js:195** — UNCHANGED (Wave 4+ prerequisite).
- **`const DATA = window.BASE_LAYERS;` at app.js:55** — UNCHANGED (post-Wave-1 line shift; was app.js:45 in the prior summary).
- **`const formatDate = (when) => ...` at app.js:73** — UNCHANGED.

## Test counts

- **Before (Wave 2):** 6 test files, 77 it() cases passing
- **After (Wave 3):** 8 test files, 99 it() cases passing
  - tests/setup.test.js: 3 (unchanged)
  - tests/crypto-parity.test.js: 3 (unchanged)
  - tests/util/ids.test.js: 18 (unchanged)
  - tests/util/hash.test.js: 6 (unchanged)
  - tests/domain/banding.test.js: 31 (unchanged)
  - tests/domain/scoring.test.js: 16 (unchanged)
  - **tests/domain/completion.test.js: 11** (NEW — 5 userCompletionPct + 6 orgSummary including 50/51 + 75/76 pillarStatus integration boundaries)
  - **tests/domain/unread.test.js: 11** (NEW — 4 unreadCountForPillar including H7 lastT=0 pinning + 2 unreadCountTotal + 2 markPillarRead + 3 unreadChatTotal)

## git status confirmation

Final state on the worktree branch (post Tasks 1-3):

- A src/domain/completion.js — new (44 lines)
- A src/domain/unread.js — new (62 lines)
- A tests/domain/completion.test.js — new (137 lines, 11 it cases)
- A tests/domain/unread.test.js — new (140 lines, 11 it cases including the verbatim Pattern G header)
- A tests/fixtures/unread-state.json — new (17 lines)
- M app.js — modified (-54 +29 net across 3 commits in this wave; only the Task 1 commit modified app.js)
- M runbooks/phase-4-cleanup-ledger.md — modified (Phase 2 extraction-table + JSDoc-was-any rows + Wave 3 history entries)

No surprise files modified. No package.json changes (`git diff --stat HEAD~3 -- package.json package-lock.json` returns empty).

## Decisions Made

None outside the Decision Log already captured in 02-CONTEXT.md.

## Deviations from Plan

Three Rule 1 / Rule 2 (correctness) deviations applied during the wave:

1. **Rule 2 (correctness — typecheck enforcement) on Task 1:** D-06 says "JSDoc types as-is, no behavioural change". The plan's PATTERNS.md DI signatures use `{Function} commentsFor` (overly loose) for `unreadCountTotal`'s commentsFor parameter — `tsc --noEmit` strict rejects passing `Function` where a callable signature is required (TS2345). Resolution: tightened the JSDoc to the same callable signature that `unreadCountForPillar` already declares. No behavioural change to unread.js bodies. Logged in cleanup-ledger JSDoc-was-any decisions table is NOT needed because this is a tightening, not a loosening — the loose `Function` was the plan's verbatim shape and the test fixture works equally well with the tighter signature.

2. **Rule 2 (correctness — typecheck enforcement) on Task 1:** PATTERNS.md DI signature for `unreadChatTotal` uses `{ id:string, role:string, orgId?:string }|null` for the user parameter. The byte-identical IIFE call site passes `user.orgId` (typed string|undefined) into `unreadChatForOrg(user, orgId: string)` — TypeScript strict rejects this (TS2345). Per D-06's escape clause ("If a JSDoc would force a behavioural change, leave the type as `any` and log it in the cleanup ledger"), loosened user to `*`. No behavioural change. Logged in the JSDoc-was-`any` decisions table at runbooks/phase-4-cleanup-ledger.md.

3. **Rule 2 (correctness — typecheck enforcement) on Task 2:** The mocked `pillarScore` arrow in `tests/domain/completion.test.js` (the mixed-org case) needed an explicit `/** @param */` JSDoc to satisfy `tsc --noEmit` strict (TS7006: implicit any). Same pattern as Wave 2 deviation #4 — no behavioural change to the test surface.

Plus two minor Rule 1 (lint compliance) on Task 3:

4. **Rule 1 (lint compliance):** ESLint config does not customize `no-unused-vars`'s `argsIgnorePattern`, so the `_user` / `_userId` / `_orgId` JS-convention prefixes still trigger the rule. Removed the unused arrow params from the test fixture's `commentsFor` and `lastReadMillis` mocks (JSDoc preserves the parameter shape for typecheck readers). No behavioural change to the test surface; the fixtures still match the production DI signatures because the consumers pass extra args the mocks ignore.

## Authentication Gates

None.

## Issues Encountered

- **OneDrive cross-path propagation watch:** Wave 1 + Wave 2 reported leakage where Edit/Write to fresh files occasionally landed in the parent project tree. This wave verified after each Write — `ls "C:/Users/hughd/OneDrive/Desktop/base-layers-diagnostic/src/domain/"` immediately after creating `completion.js` + `unread.js` showed the parent tree unchanged (still `banding.js`, `scoring.js` only). No leakage observed in Wave 3.
- **PreToolUse Edit hook reminders:** The runtime hook fires on every Edit, even after Write tool created the file in this same session. Reminders were spurious (file content was already known) and did not block any edits — all Edits succeeded.
- **Vite build warning unchanged:** `<script src="data/pillars.js?v=50"> in "/index.html" can't be bundled without type="module" attribute` — Phase 1 D-14 anti-pattern; Phase 4 owns the cleanup. Build still exits 0; module count went from 10 (Wave 2) to 12 (Wave 3); bundle hash advanced from `main-CpUH-dqT.js` to `main-DCNgagEP.js`.

## Threat Model Compliance

- **T-2-04 (Tampering — test simplification on regression baseline) — `mitigate` honoured.** The mandatory verbatim Pattern G header is committed to `tests/domain/unread.test.js` lines 4-16 — it cites Pitfall 20 / H7 explicitly, names Phase 5 / DATA-07 as the break-by-design path, and includes the load-bearing language "When that lands, these tests will fail — that failure IS the evidence of the cutover, not a regression". The cleanup-ledger row for unread.js carries the matching break-by-design note ("`tests/domain/unread.test.js` will break by design (regression baseline). Phase 5 plan task: replace TEST-05 with server-clock-vs-server-clock assertions; the diff IS the cutover evidence."). The H7 entanglement is also explicitly pinned via the load-bearing test case `unreadCountForPillar > counts every other-author comment as unread when lastT = 0` with the inline `// H7 entanglement: ... Phase 5 fixes; Phase 2 pins.` comment. Plan 02-06 will tighten this further by adding "Updating snapshot tests" governance to CONTRIBUTING.md including "if you change a regression-baseline test, justify in the PR".

- **T-2-04 (cont'd — DI signature widens test surface) — `accept` honoured.** Tests pass mock `commentsFor` / `saveOrg` / `lastReadMillis` / `msgMillis` / `unreadChatForOrg` shapes. The DI surface is intentionally wide; Phase 4 collapses it when state.js / data/orgs.js / domain/pillars.js own the helpers.

No new threat surface introduced; no `threat_flag` entries needed. The plan's `threats: [T-2-04]` frontmatter entry is fully addressed.

## Self-Check: PASSED

### Files

- src/domain/completion.js exists, contains `// @ts-check`, both export-function literals (`export function userCompletionPct(org, roundId, userId, DATA)` + `export function orgSummary(org, DATA, pillarScore)`), `import { pillarStatus } from "./banding.js"` literal, and `red: statuses.filter((s) => s === "red").length` literal — VERIFIED
- src/domain/unread.js exists, contains `// @ts-check`, all 4 export-function literals, `Pitfall 20 / H7 entanglement` provenance literal, `import { iso } from "../util/ids.js"` literal, `org.readStates[user.id][pillarId] = iso()` byte-identical write literal, and `export function unreadChatTotal(user, state, lastReadMillis, msgMillis, unreadChatForOrg)` literal — VERIFIED
- tests/domain/completion.test.js exists, contains 11 it() cases, contains the load-bearing literals (`expect(userCompletionPct(org, "r1", "u1", DATA)).toBe(0)`, `.toBe(100)`, `expect(orgSummary({}, DATA, pillarScore)).toEqual({`, `transitions red→amber across the 50/51 boundary`, `gray: DATA.pillars.length`) — VERIFIED
- tests/domain/unread.test.js exists, contains 11 it() cases, opens with the verbatim REGRESSION BASELINE — Phase 2 / Pitfall 20 header (Pattern G), contains the second-element provenance literal `Provenance: Phase 2 (D-05) regression baseline test for src/domain/unread.js extraction`, the load-bearing H7 literals (`Phase 5 (DATA-07) fixes H7 by moving last-read markers into Firestore readStates`, `When that lands, these tests will fail — that failure IS the evidence of the cutover, not a regression`, `H7 entanglement: with no readState for this user, EVERY other-author comment counts as unread`), the `expect(saveOrg).toHaveBeenCalledTimes(1)` literal, and the `expect(org.readStates).toEqual({ u_self: { 1: "2026-01-01T00:00:00.000Z" } })` frozen-iso literal — VERIFIED
- tests/fixtures/unread-state.json exists, valid JSON, contains the `"authorId": "u_other"` + `"createdAt": "2026-01-01T00:05:00.000Z"` + `"readStates": {` + `"u_self": { "1": "2026-01-01T00:00:00.000Z" }` literals — VERIFIED

### app.js mutations

- Imports both new modules with the planner-required literal patterns (`from "./src/domain/completion.js"`, `from "./src/domain/unread.js"`) — VERIFIED
- All 6 wrapper closures present (`const userCompletionPct = (org, roundId, userId) =>`, `const orgSummary = (org) =>`, `const unreadCountForPillar = (org, pillarId, user) =>`, `const unreadCountTotal = (org, user) =>`, `const markPillarRead = (org, pillarId, user) =>`, `const unreadChatTotal = (user) =>`) at app.js:257-265 — VERIFIED
- All 6 inline `function <name>` declarations REMOVED. `grep -cE "^  function (userCompletionPct|orgSummary|unreadCountForPillar|unreadCountTotal|markPillarRead|unreadChatTotal)\\b" app.js` returns 0 — VERIFIED
- `function currentUser` STILL present at app.js:306-309 (Wave 4 prerequisite) — VERIFIED (count=1)
- `function questionMeta` STILL present (Wave 4+ prerequisite) — VERIFIED (count=1)
- `const formatDate` STILL present — VERIFIED (count=1)
- `const DATA = window.BASE_LAYERS;` STILL present at app.js:55 — VERIFIED (count=1)
- `git diff --stat HEAD~3..HEAD app.js` shows `-54 +29` (29 insertions, 54 deletions) — within the planner's "approximately 100±20 lines" sanity-check (the wrappers add back ~20 lines while removing ~80; net -25 is plausible because each wrapper is ~2 lines while each removed function body was ~5-15 lines) — VERIFIED

### Cleanup ledger

- runbooks/phase-4-cleanup-ledger.md contains literal `src/domain/completion.js` AND `src/domain/unread.js` (two new extraction-table rows) — VERIFIED
- runbooks/phase-4-cleanup-ledger.md contains literal `H7 fix (Phase 5, DATA-07) rewrites comparator` (the break-by-design reminder) — VERIFIED
- Wave 3 history entries appended below the Wave 1 + Wave 2 lines — VERIFIED
- JSDoc-was-`any` decisions table extended with three new rows (completion org, unread org, unread user-on-unreadChatTotal) — VERIFIED

### Gates

- `npm run lint` exits 0 (`--max-warnings=0`) — VERIFIED
- `npm run typecheck` exits 0 (`tsc --noEmit`) — VERIFIED
- `npm run build` exits 0 (12 modules transformed, was 10 in Wave 2) — VERIFIED
- `npm test -- --run` exits 0 — VERIFIED. 8 test files, 99 tests passing (was 6 / 77 in Wave 2, +2 files / +22 tests).

### Commits

- Task 1 commit 7706466 (`feat(02-04): extract completion + unread to src/domain (D-05)`) — FOUND in git log
- Task 2 commit 215927d (`test(02-04): add domain/completion tests (TEST-03)`) — FOUND in git log
- Task 3 commit 11049ad (`test(02-04): add domain/unread tests + fixture (TEST-05, H7 regression baseline)`) — FOUND in git log

### No package changes

- `git diff --stat HEAD~3 -- package.json package-lock.json` returns no output — VERIFIED. No new packages introduced.

### No accidental deletions

- `git diff --diff-filter=D --name-only HEAD~3 HEAD` returns empty — VERIFIED. No tracked files deleted across the wave's commits.

## H7 / Pitfall 20 Regression Baseline Note

**This is the H7 / Pitfall 20 regression baseline.** The two load-bearing pieces:

1. The verbatim Pattern G header at the top of `tests/domain/unread.test.js`.
2. The explicit pinned assertion `unreadCountForPillar > counts every other-author comment as unread when lastT = 0 (no readState entry)`.

Phase 5 (DATA-07) WILL break these tests when the comparator moves to server-clock-only readStates stored in Firestore. **That failure IS the cutover evidence, not a regression.** Phase 5 plan task: replace TEST-05 with server-clock-vs-server-clock assertions; the diff IS the cutover evidence. Phase 5 changes to unread-count behaviour MUST explicitly update these tests — silent drift is forbidden.

The cleanup-ledger row for `src/domain/unread.js` carries the matching break-by-design note in the "Phase 4 candidate cleanup" column.

## Pointer to Wave 4

Wave 4 picks up at **Plan 02-05** (Wave 4 — Data + Auth extraction):

- src/data/migration.js (`migrateV1IfNeeded`, `clearOldScaleResponsesIfNeeded`) — heavy DI surface (loadUsers / loadOrgMetas / loadOrg / saveOrg / upsertUser / findUser / removeV1ActiveKey + idempotency assertion required for TEST-04)
- src/data/cloud-sync.js (`syncFromCloud`) — heaviest DI surface (cloud helpers + jget/jset + render); H8 entanglement preserved as REGRESSION BASELINE (Pattern G header again, this time citing H8 instead of H7 — same break-by-design design)
- src/auth/state-machine.js (`verifyInternalPassword`, `verifyOrgClientPassphrase`, `verifyUserPassword`, `currentUser`) — currentUser leaves app.js in this wave
- tests/data/migration.test.js + tests/data/cloud-sync.test.js + tests/auth/state-machine.test.js (TEST-04 + TEST-06 + TEST-07)

Wave 4 will benefit from this wave's domain extractions: `src/data/migration.js` will use `iso` + `uid` from Wave 1; `src/auth/state-machine.js` will use `hashString` from Wave 1.

After Wave 4, Plan 02-06 closes Phase 2 with:
- TEST-10 (snapshot tests for dashboard / diagnostic / report)
- D-15 per-directory coverage thresholds wired into vite.config.js
- D-21 SECURITY.md "Regression baseline" paragraph appended
- D-17 + D-18 CONTRIBUTING.md "Updating snapshot tests" + "Test runtime budget" sections

---

_Phase: 02-test-suite-foundation_
_Plan: 04 (Wave 3 — Domain Extraction: completion + unread, H7 regression baseline)_
_Completed: 2026-05-06_
