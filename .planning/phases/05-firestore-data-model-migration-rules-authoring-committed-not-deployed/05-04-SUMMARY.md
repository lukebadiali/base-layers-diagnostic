---
phase: 05-firestore-data-model-migration-rules-authoring-committed-not-deployed
plan: 04
subsystem: data-model
tags:
  - phase-5
  - wave-4
  - h7
  - h8
  - data-07
  - server-clock
  - subcollection
  - atomic-commit
  - pitfall-20
dependency-graph:
  requires:
    - 05-03 (data/read-states.js setPillarRead - server-clock write substrate)
    - 05-03 (data/messages.js + comments + responses + actions + documents subcollection wrappers - per-subcollection listener substrate)
  provides:
    - server-time-only unread comparator (no client clock in domain/unread.js)
    - setPillarRead callsite for src/main.js (replaces deleted iso() write helper)
    - thin cloud-sync dispatcher (subscribeOrgMetadata + syncFromCloud(orgId, ...))
  affects:
    - Phase 4 4.1 main.js-body-migration sub-wave (carries the IIFE comparator wrappers + cloud-sync legacy 9-prop deps shim until views/* migrate)
    - Phase 6 Rules Deploy (depends on H7+H8 closure for read-states subcollection rules)
tech-stack:
  added:
    - duck-typed Timestamp.toMillis() consumption in src/domain/unread.js
  patterns:
    - parameter-detector branch (legacy 9-prop deps no-op shim with deprecation warn)
    - duck-typing across boundaries (Timestamp shape, no firebase imports in domain)
    - atomic-commit (Pitfall 20) - one fix per commit boundary
key-files:
  created: []
  modified:
    - src/domain/unread.js
    - src/main.js
    - tests/domain/unread.test.js
    - src/data/cloud-sync.js
    - tests/data/cloud-sync.test.js
    - runbooks/phase-4-cleanup-ledger.md
decisions:
  - markPillarRead DELETED entirely (no shim) - the iso() write was the H7 root cause; retaining a shim would preserve the bug
  - IIFE comparator wrappers at src/main.js:402-407 adapted to feed new server-time signatures via _toTsFromIso + _toCommentDuck + lastReadForOrg shims (NOT migrated to views/*) - keeps IIFE boot path rendering through to Phase 4 4.1
  - cloud-sync.js parameter-detector branch added for legacy 9-prop deps (no-op + warn) - chosen over keeping a separate syncFromCloud_legacy export because it preserves a single export name + simpler runtime
  - TWO atomic commits (Pitfall 20) - never bundled with each other
metrics:
  completed_date: "2026-05-08"
  duration: "~25 minutes"
  tasks_completed: 2
  files_modified: 6
---

# Phase 5 Plan 04: H7 + H8 Fixes Summary

Server-clock readStates comparator (H7 closure / DATA-07) + per-subcollection listeners replacing parent-doc last-writer-wins sync (H8 closure), shipped as two atomic commits per Pitfall 20.

## Outcome

Both CRITICAL clock-skew and last-writer-wins entanglements documented in `.planning/codebase/CONCERNS.md` (rows H7 and H8) are CLOSED in Phase 5. The substrate that Phase 6 Rules Deploy depends on - server-time markers throughout the unread tracking + per-subcollection conflict-resolution boundaries - is in place.

## Commits

| # | Hash      | Title                                                                                  | Files                                                                                       |
|---|-----------|----------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------|
| A | `d81cb50` | feat(05-04): H7 fix - server-clock readStates comparator + setPillarRead rewire        | src/domain/unread.js, src/main.js, tests/domain/unread.test.js                              |
| B | `3145ebc` | feat(05-04): H8 fix - per-subcollection listeners replace parent-doc sync              | src/data/cloud-sync.js, tests/data/cloud-sync.test.js, runbooks/phase-4-cleanup-ledger.md   |

Per Pitfall 20 + CONTEXT.md `<specifics>` 4th bullet, the H7 fix and H8 fix landed as TWO ATOMIC COMMITS - never bundled. Each commit's reviewable diff tells a single story.

## H7 Closure Narrative

The Phase 2 baseline pinned the BROKEN behaviour at `tests/domain/unread.test.js` (TEST-05) and `src/domain/unread.js` (the `iso()` import + `new Date()` comparators) - that "broken" was specifically the H7 entanglement: client clocks mixed with server clocks in the comparator + the `markPillarRead` write helper used `iso()` to assign a client-clock value to `org.readStates[user.id][pillarId]`.

Wave 4 Commit A closes H7 with three coordinated changes:

1. **Comparator rewrite (`src/domain/unread.js`).** Signature changes from `(org, pillarId, user, commentsFor)` to `(lastReadTs, comments, currentUserId)`; reads server-time `Timestamp` objects via duck-typed `toMillis()`. ZERO client-clock values in source - no `iso()`, no `Date.now()`, no `new Date(`, no import from `../util/ids.js`. domain/unread.js imports nothing from firebase/* or data/* (Phase 4 ESLint Wave 4 boundary preserved).
2. **Write helper DELETED + callsite rewired.** The legacy domain-side write helper (which used `iso()` to assign client-clock ISO strings to `org.readStates[user.id][pillarId]` and called `saveOrg` to persist) is REMOVED entirely from `src/domain/unread.js` (no shim). The sole callsite at `src/main.js:1739` is rewired to `void setPillarRead(org.id, user.id, pillarId)` from `src/data/read-states.js` (server-clock write via `serverTimestamp()`, shipped in Wave 3). The IIFE wrapper at line 405 + the import at line 97 are removed. Per CONTEXT.md D-12 + D-18: "All writes use serverTimestamp() - no client-clock values cross the data tier."

3. **Tests rewritten in lockstep.** `tests/domain/unread.test.js` Phase 2 TEST-05 H7-baseline tests are REPLACED in the same Commit A (per D-10). The new file pins server-clock-vs-server-clock semantics and includes the **5-minute client-clock-skew test (ROADMAP SC#4)** - mocking `Date.now()` ±5min from comment timestamps does NOT change the unread count. Deletion-invariant tests assert that `src/domain/unread.js` no longer exports the legacy write helper and that `src/main.js` no longer references it. 24 tests total (up from 13 in the Phase 2 baseline; net +11).

### IIFE comparator-wrapper carryover (Phase 4 4.1)

The IIFE-resident wrappers at `src/main.js:402-407` (`unreadCountForPillar` / `unreadCountTotal` / `unreadChatTotal`) consumed the OLD comparator signatures. Wave 4 Commit A adapts them via `_toTsFromIso` + `_toCommentDuck` + `lastReadForOrg` shims so the IIFE boot path keeps rendering. The legacy `unreadChatForOrg` per-org client helper is DELETED - its caller migrated to `_unreadChatTotal` via the shared `lastReadForOrg` accessor.

This adaptation is **carryover** - the long-term home for the unread comparator wiring is `src/views/*` (Pattern D DI factories that read `subscribeReadState` directly from `data/read-states.js` and consume native server-time Timestamps). The Phase 4 4.1 main.js-body-migration sub-wave migrates the IIFE-resident render functions into views/* and these wrappers retire entirely.

The plan acknowledged this trade-off explicitly: "src/views/* are NOT modified in Wave 4 - only the single src/main.js:1739 markPillarRead callsite is rewired (the IIFE-resident comparator callsites still consume the OLD comparator signature; they migrate in Phase 4 4.1)".

## H8 Closure Narrative

The Phase 2 baseline pinned the BROKEN behaviour at `tests/data/cloud-sync.test.js` (TEST-06) and `src/data/cloud-sync.js` (the 9-prop deps `syncFromCloud` body that pulled cloud orgs/users + last-writer-wins-merged with localStorage + jset-wrote the merged shape back). That "broken" was the H8 entanglement: cloud wins on overlap, with no conflict resolution mechanism.

Wave 4 Commit B closes H8 with two coordinated changes:

1. **Parent-doc syncer GONE.** `src/data/cloud-sync.js` is rewritten as a thin "init org-metadata listener + dispatcher" role:
   - `subscribeOrgMetadata(orgId, { onChange, onError })` - thin `onSnapshot` wrapper for the small parent doc (name, currentRoundId, createdAt).
   - `syncFromCloud(orgId, { onMetadata, attach, onError })` - dispatcher that hydrates parent metadata + signals downstream wrappers to attach their per-subcollection listeners (`subscribeMessages` / `subscribeReadState` / `subscribeComments` / `subscribeResponses` / `subscribeActions` / `subscribeDocuments` - all shipped in Wave 3).

   The H8 root-cause - last-writer-wins overlap merge - is intentionally NOT executed anywhere in the new body. Each subcollection now owns its own conflict resolution; cloud-sync.js no longer participates in document-level merges. `data/cloud-sync.js` imports only from `src/firebase/db.js` (no jget/jset/cloudFetchAll*/cloudPush* dependencies).

2. **Tests rewritten in lockstep.** `tests/data/cloud-sync.test.js` Phase 2 TEST-06 H8-baseline tests are REPLACED in the same Commit B (per D-10). The new file pins the dispatcher contract: `subscribeOrgMetadata` fires `onChange` with seeded data + with null when the doc doesn't exist; `syncFromCloud` calls `attach(orgId)` once on first resolve + does NOT call `attach` again on subsequent metadata updates + propagates errors via `onError`. The legacy 9-prop deps shim is asserted to be a safe no-op + warns + does NOT trigger the parent-doc syncer (i.e., the H8 root cause is gone). 11 tests total (up from 9 in the Phase 2 baseline).

### Legacy 9-prop deps shim (Phase 4 4.1)

The IIFE callsite at `src/main.js:418` invokes `_syncFromCloud({ fbReady, cloudFetchAllOrgs, cloudFetchAllUsers, cloudPushOrg, cloudPushUser, jget, jset, K, render })` - the OLD 9-prop deps shape. The new `syncFromCloud` body has a parameter-detector branch: if the first argument is an object with a `fbReady` field (legacy discriminator), the function logs a deprecation warning + returns a no-op unsubscribe. The H8 root-cause last-writer-wins overlap merge does NOT execute.

This shim is also **carryover** - removed when the IIFE callsite migrates in the Phase 4 4.1 main.js-body-migration sub-wave to call `syncFromCloud(orgId, { onMetadata, attach, onError })` from a view-resident bootstrap path.

## Atomic-Commit Discipline (Pitfall 20 Evidence)

| Aspect                | Commit A (H7 fix)                                            | Commit B (H8 fix)                                                            |
|-----------------------|--------------------------------------------------------------|------------------------------------------------------------------------------|
| Hash                  | `d81cb50`                                                    | `3145ebc`                                                                    |
| Source                | `src/domain/unread.js` rewrite                               | `src/data/cloud-sync.js` rewrite                                             |
| Callsite rewire       | `src/main.js:1739` -> setPillarRead                          | (none - IIFE legacy callsite handled via parameter-detector shim)            |
| Tests replaced        | `tests/domain/unread.test.js` (TEST-05 baseline)             | `tests/data/cloud-sync.test.js` (TEST-06 baseline)                           |
| Other artefacts       | (none)                                                       | `runbooks/phase-4-cleanup-ledger.md` (H7+H8 carryover rows CLOSED)           |
| Lines changed         | +313 / -184                                                  | +207 / -207                                                                  |
| Reviewable diff focus | Server-clock comparator + write helper deletion              | Parent-doc syncer removal + dispatcher contract                              |

The two commits address two distinct root causes (clock skew, last-writer-wins) with two distinct code paths (domain comparator, data-layer sync). Bundling them would have hidden the H7 evidence under the larger H8 diff and broken the audit narrative.

## Legacy Shim Catalog

After Wave 4 lands, two carryover shims exist - both DELETED in the Phase 4 4.1 main.js-body-migration sub-wave:

| Shim                                              | Location                          | Trigger                                                                                                        | Disposal                                                                                                              |
|---------------------------------------------------|-----------------------------------|----------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------|
| Cloud-sync 9-prop deps no-op                       | `src/data/cloud-sync.js`          | First arg has `fbReady` field (legacy IIFE shape)                                                              | When IIFE callsite migrates to `syncFromCloud(orgId, { onMetadata, attach, onError })` (views/* bootstrap path).      |
| IIFE comparator wrappers `_toTsFromIso` / `_toCommentDuck` / `lastReadForOrg` adapter | `src/main.js:413-446`             | IIFE renderX functions consume comparator wrappers with legacy `(org, pillarId, user)` shape                  | When views/* migrate to `subscribeReadState` from `data/read-states.js` (server-time Timestamp natives).               |

The legacy domain-side write helper has NO equivalent shim - it was DELETED entirely. Per CONTEXT.md D-12 + D-18 + BLOCKER 3, retaining a shim that wrote `iso()` would preserve the H7 root cause; the deletion + setPillarRead rewire is the closure mechanism.

## Cleanup-Ledger Row Closures

`runbooks/phase-4-cleanup-ledger.md` closures landed in Commit B:

1. Chronological list (timestamped 2026-05-08): two new entries documenting Commit A (H7 fix) and Commit B (H8 fix) outcomes.
2. Carryover row 193 (`src/domain/unread.js` H7 entanglement) - marked `CLOSED 2026-05-08 (Phase 5 Wave 4 Commit A / Plan 05-04)`.
3. Carryover row 195 (`src/data/cloud-sync.js` H8 entanglement) - marked `CLOSED 2026-05-08 (Phase 5 Wave 4 Commit B / Plan 05-04)`.

## Verification Evidence

- `npm test`: 65 files / **454 tests passing** (baseline 442 + 11 new in unread.test.js + 1 net new in cloud-sync.test.js).
- `npm test -- tests/domain/unread`: 24/24 passing (includes the 5-minute client-clock-skew test, ROADMAP SC#4).
- `npm test -- tests/data/cloud-sync`: 11/11 passing (dispatcher contract + legacy-shim no-op assertions).
- `npm test -- tests/views`: 16 files / 39 tests passing - **snapshot baselines (`tests/__snapshots__/views/*.html`) zero diff**. The IIFE rewire is a dataflow change, not a render-path change; views/* render output is unchanged.
- `npm run lint`: clean (Phase 4 ESLint Wave 2 + Wave 3 + Wave 4 boundaries preserved).
- `npm run typecheck`: zero new errors in modified files (pre-existing errors in `tests/rules/` + `tests/scripts/` + `vitest.rules.config.js` are out-of-scope per deviation rules).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] IIFE comparator wrappers adapted to feed new domain signatures**
- Found during: Task 1 STEP 3 - views snapshot suite hookTimeouts traced to `unreadChatTotal` IIFE wrapper crashing on `state.chatMessages.filter is not a function` because the new `_unreadChatTotal` signature is `(user, chatMessages, lastReadForOrg)` not the legacy 5-arg shape.
- Plan position: Plan threat T-5-w4-callsite-break accepted "wrong unread count, not broken IIFE" as the IIFE-wrapper failure mode. Reality: the new signature change broke `state.chatMessages || []` semantics (state is an object, not an array - `.filter` undefined) which crashed the IIFE boot.
- Fix: Adapted the three IIFE wrappers (`unreadCountForPillar` / `unreadCountTotal` / `unreadChatTotal`) at `src/main.js:402-407` to feed the new server-time-shaped signatures via `_toTsFromIso` + `_toCommentDuck` + `lastReadForOrg` shims. The legacy `unreadChatForOrg` helper is deleted (caller migrated). views/* untouched (truth #12 preserved).
- Files modified: `src/main.js` (extra IIFE wrapper rewrite beyond the markPillarRead callsite rewire).
- Commit: `d81cb50` (Commit A, same atomic boundary).
- Compatibility with plan truths: truth #11 (snapshot zero diff) PRESERVED via wrapper adapters; truth #12 (views/* not modified) PRESERVED (only main.js IIFE wrappers touched).

**2. [Rule 3 - Lint cleanup] Deleted unused legacy `unreadChatForOrg` helper**
- Found during: Task 1 lint step (eslint --max-warnings=0 errored: `'unreadChatForOrg' is defined but never used`).
- Issue: After IIFE wrapper adaptation, `unreadChatForOrg` had no callers.
- Fix: Deleted the function (8 lines + comment markers). The per-org client unread count flows through the new domain `_unreadChatTotal` via `lastReadForOrg`.
- Files modified: `src/main.js` (function deletion + comment cleanup).
- Commit: `d81cb50`.

### Auth Gates

None.

### Pre-existing Out-of-Scope Issues (Not Fixed)

- `tests/rules/storage.test.js`, `tests/rules/tenant-jump.test.js`, `tests/scripts/migrate-subcollections/{assertions,idempotency}.test.js`, `vitest.rules.config.js` - JSDoc `@param` mismatches and Promise type mismatches in modules NOT touched by this plan. Confirmed pre-existing via `git stash` baseline check. Out-of-scope per deviation rules. Logged for future Phase 4 4.1 / Phase 5 Wave 6 cleanup.

## Forward-Tracking (Phase 4 4.1 Carryover)

The Phase 4 4.1 main.js-body-migration sub-wave deletes both Wave 4 carryover shims and rewires the IIFE consumers:

1. **`src/data/cloud-sync.js` parameter-detector branch.** The IIFE callsite at `src/main.js:418` migrates to a views/* bootstrap path that calls `syncFromCloud(orgId, { onMetadata, attach, onError })` directly. The legacy 9-prop deps no-op + deprecation warning are removed.

2. **`src/main.js:413-446` IIFE comparator wrappers** (`_toTsFromIso` + `_toCommentDuck` + `lastReadForOrg` shims + the three wrapped consumers). The IIFE-resident render functions that consume these wrappers (renderPillar, renderDashboard, etc. - lines 1604-3000+) migrate into `src/views/{pillar,dashboard,...}.js` Pattern D DI factories that read `subscribeReadState` from `data/read-states.js` directly + receive native server-time Timestamps in their props. The shims retire entirely.

After 4.1 closes, `domain/unread.js` consumers exclusively flow through `data/read-states.js` Timestamp-native readers - no adapter layer remains, and the H7 fix is end-to-end without any "legacy ISO string to Timestamp duck" coercion.

## Self-Check: PASSED

All claimed artefacts exist on disk; both atomic commits exist in git history.

| Item                                                    | Status |
|---------------------------------------------------------|--------|
| `src/domain/unread.js` rewritten                        | FOUND  |
| `src/main.js` callsite + import + wrapper rewires       | FOUND  |
| `tests/domain/unread.test.js` rewritten                 | FOUND  |
| `src/data/cloud-sync.js` rewritten                      | FOUND  |
| `tests/data/cloud-sync.test.js` rewritten               | FOUND  |
| `runbooks/phase-4-cleanup-ledger.md` H7+H8 rows closed  | FOUND  |
| `.planning/phases/.../05-04-SUMMARY.md`                 | FOUND  |
| Commit A (H7 fix) `d81cb50`                             | FOUND  |
| Commit B (H8 fix) `3145ebc`                             | FOUND  |

Verification command results:
- `npm test`: 65 files / 454 tests passing.
- `npm run lint`: clean (exit 0).
- `npm run typecheck`: zero new errors in modified files.
- `npm test -- tests/domain/unread`: 24/24.
- `npm test -- tests/data/cloud-sync`: 11/11.
- `npm test -- tests/views`: 39/39 (snapshot baselines zero diff).
