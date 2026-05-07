# Phase 4 Cleanup Ledger

> Every `// eslint-disable-next-line` and `// @ts-nocheck` introduced in Phase 1
> is enumerated here. Phase 4 (Modular Split) closes each entry as the
> corresponding code path is rewritten. The ledger empties to zero rows when
> Phase 4 is complete.

## Suppressions

Source enumeration (run on `bc585c6` — first commit on origin/main; counts unchanged through `a9efabb`):

```sh
$ git grep -nE "eslint-disable-next-line" -- app.js firebase-init.js data/pillars.js
$ git grep -nE "@ts-(nocheck|ignore|expect-error)" -- app.js firebase-init.js data/pillars.js
```

Total rows at Phase 4 entry: **16** (14 ESLint disables + 2 `@ts-nocheck`).
Closed in Phase 4 Wave 1 (04-01): the `@ts-nocheck` row at the deleted firebase-init.js (file removed entirely in 04-01), plus the `no-restricted-syntax` eslint-disable in src/util/ids (CODE-03 swap to crypto.randomUUID).
Remaining: **14** (13 ESLint disables in app.js + 1 `@ts-nocheck` on app.js, all closing as Waves 2-5 extract app.js into src/views/* + src/state.js + src/router.js + src/main.js).

| File              | Line | Annotation                                                  | Rule / Check                | Intended Fix                                                                                                | Closure Phase     |
| ----------------- | ---- | ----------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------- |
| app.js            | 1    | `// @ts-nocheck`                                            | tsc strict checkJs          | Remove after IIFE → modules split; per-module JSDoc types pass `tsc --noEmit` cleanly.                      | Phase 4 (CODE-01) |
| app.js            | 237  | `// eslint-disable-next-line no-unused-vars`                | no-unused-vars              | Phase 2 (D-05): line shifted from app.js:274 (was the in-IIFE `answeredCount` declaration); the function body moved to `src/domain/scoring.js` (export form, no active directive needed); the carry-over `eslint-disable` now sits on the in-IIFE wrapper closure `const answeredCount = ...`. Remove dead code or wire up call site. | Phase 4 (CODE-01) |
| app.js            | 420  | `// eslint-disable-next-line no-empty`                      | no-empty                    | Replace empty catch with explicit ignore + comment (Phase 9 logger TBD).                                    | Phase 4 (CODE-01) |
| app.js            | 670  | `// eslint-disable-next-line no-unused-vars`                | no-unused-vars              | Remove dead helper or expose via export.                                                                    | Phase 4 (CODE-01) |
| app.js            | 676  | `// eslint-disable-next-line no-unsanitized/property`       | no-unsanitized/property     | Replace `innerHTML =` with `replaceChildren()` + DOMPurify.sanitize() if HTML truly required (CODE-04).      | Phase 4 (CODE-04) |
| app.js            | 774  | `// eslint-disable-next-line no-empty`                      | no-empty                    | Replace empty catch with explicit ignore + comment.                                                         | Phase 4 (CODE-01) |
| app.js            | 1131 | `// eslint-disable-next-line no-unused-vars`                | no-unused-vars              | Remove dead code or wire up call site.                                                                      | Phase 4 (CODE-01) |
| app.js            | 2018 | `// eslint-disable-next-line no-useless-assignment`         | no-useless-assignment       | Tighten loop control flow (initial value never read before reassignment).                                   | Phase 4 (CODE-01) |
| app.js            | 2374 | `// eslint-disable-next-line no-unused-vars`                | no-unused-vars              | Remove dead code or wire up call site.                                                                      | Phase 4 (CODE-01) |
| app.js            | 2847 | `// eslint-disable-next-line no-unused-vars`                | no-unused-vars              | Remove dead binding or wire up render.                                                                      | Phase 4 (CODE-01) |
| app.js            | 3081 | `// eslint-disable-next-line no-empty`                      | no-empty                    | Replace empty catch with explicit ignore + comment.                                                         | Phase 4 (CODE-01) |
| app.js            | 3772 | `// eslint-disable-next-line no-unused-vars`                | no-unused-vars              | Replace with central error logger (Phase 9 observability).                                                  | Phase 4 (CODE-01) → Phase 9 wires the logger |
| app.js            | 4354 | `// eslint-disable-next-line no-useless-escape`             | no-useless-escape           | Clean up regex (`\\` is unnecessary in char class).                                                         | Phase 4 (CODE-01) |
| app.js            | 5353 | `// eslint-disable-next-line no-unused-vars`                | no-unused-vars              | Remove dead code or wire up call site.                                                                      | Phase 4 (CODE-01) |

## How to regenerate this table

The Phase 1 suppression rows above were captured from live `git grep` at `bc585c6`. Phase 4 runs MUST re-run these commands and verify each closure landing:

```sh
git grep -nE "eslint-disable-next-line" -- app.js firebase-init.js data/pillars.js
git grep -nE "@ts-(nocheck|ignore|expect-error)" -- app.js firebase-init.js data/pillars.js
```

Each row in the Suppressions table corresponds to one location in this output. As Phase 4 sub-tasks land, the per-module file rewrites should remove the disable comments. When the tables produce zero output, this ledger empties to zero rows and Phase 4 sign-off is unblocked.

## Out-of-band soft-fail entries

These are not `eslint-disable-next-line` lines but they're still trackable Phase 1 → Phase 4 cleanup items.

| Source                                                         | Why soft-fail                                                                                  | Re-evaluation date | Hardening target                                                                              |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml` OSV-Scanner step                    | `continue-on-error: true` (D-20) — first 30 days of false-positive baseline                    | 2026-06-03         | Remove `continue-on-error` line; OSV-Scanner becomes hard-fail.                                |
| `eslint.config.js` ESLint `no-restricted-imports` rule (per-wave hardening)   | `"warn"` → `"error"` flips per-wave per D-04 as boundaries land. Wave 1 (04-01) closes `firebase/firestore | firebase/storage | firebase/auth | firebase/app-check | firebase/functions` group at `error` for non-`src/firebase/**` files. Remaining work: Wave 2 closes `domain/* → firebase/*`; Wave 3 closes `data/* → only firebase/*`; Wave 4 closes `views/* → no firebase/*`. | Phase 4 (per-wave) | Per-wave checkbox: [x] Wave 1 firebase/* group; [ ] Wave 2 domain/*; [ ] Wave 3 data/*; [ ] Wave 4 views/*. Row closes when all four waves' boundaries flip and Wave 6 final hardening verifies via `npm run lint` clean. |
| `.gitleaks.toml` — `INTERNAL_PASSWORD_HASH` at `app.js:505`    | Grandfathered C2 finding (predates Phase 1; not blocked by Wave 3 first-green-CI scan range)   | Phase 6 (AUTH-14)  | Delete the constant when real Firebase Auth replaces the shared-password substrate.            |
| `gitleaks/gitleaks-action@ff98106e` Node.js 20 deprecation     | GitHub deprecates Node 20 actions on 2026-06-02; current pinned v2.3.9 ships on Node 20         | 2026-06-02         | Dependabot github-actions ecosystem (`.github/dependabot.yml`) surfaces the v3.x update PR.   |
| Phase 3 GH-Pages rollback substrate (`gh-pages` branch + any Pages workflow file) | D-03 — 14-day rollback retention; the substrate is dormant (Pages disabled in repo settings) but re-deployable. T-3-4 mitigation (stale GH-Pages serving substrate could be re-enabled accidentally — calendar-driven cleanup closes the window). | PENDING-USER (compute as `cutover_date + 14 days`; replace this token after Wave 4 cutover lands `cutover_date` in `.planning/phases/03-hosting-cutover-baseline-security-headers/03-PREFLIGHT.md ## Cutover Log`. If `cutover_complete: rolled-back`, write `TBD — cutover rolled back; update when cutover succeeds` instead — the substrate must remain available indefinitely as the production fallback until a future cutover succeeds.) | Delete `gh-pages` branch (`git push origin --delete gh-pages`) + any Pages workflow file in `.github/workflows/`; commit `chore(03): delete GH-Pages rollback substrate (day 14 — cutover_date + 14)`; close this row. See `runbooks/hosting-cutover.md` §Day-14 Cleanup for the precise command sequence. T-3-4 mitigation. |

## Closure

This ledger MUST be empty (zero rows in the Suppressions table) before Phase 4 is signed off. Any rows remaining at Phase 4 close indicate either:

- A Phase 4 task missed a callsite — fix and re-run.
- A suppression was actually still needed — document under "Persistent suppressions" with rationale, and reflect in `SECURITY.md` so the audit narrative is honest.

The "Out-of-band soft-fail entries" table follows a separate cadence:

- OSV-Scanner soft-fail: re-evaluate at 2026-06-03 regardless of Phase 4 status.
- `no-restricted-imports`: hardens with Phase 4 close.
- `INTERNAL_PASSWORD_HASH`: closes at Phase 6 AUTH-14.
- gitleaks-action Node 20: closes when Dependabot's v3.x bump PR merges.

## Phase 1 — first-green-CI deviations (informational)

The Wave 3 checkpoint resolution (2026-05-04) introduced two non-suppression fixes that ARE NOT in the table above (because they're permanent fixes, not suppressions):

- `.github/workflows/ci.yml` audit job: `fetch-depth: 0` on `actions/checkout` (gitleaks-action requires full history).
- `tests/smoke.test.js` pulled forward from Wave 5 Plan 01-06 Task 1 Step 1 (Vitest 4.x exits 1 on no-tests).

Both are documented in `01-04-SUMMARY.md` "Resolved Checkpoint" and `01-06-SUMMARY.md` (when Wave 5 lands).

## Phase 2 — extracted leaf modules (D-05 byte-identical)

**D-05 byte-identical convention clarification:** Byte-identical means semantic body equivalence, not character-by-character. Extracted modules drop the 2-space indentation level that came from being nested inside the IIFE — they are now top-level ESM functions. To verify equivalence: `diff -w` (whitespace-insensitive) on the function body, or run the test that exercises the function and confirm it passes against both the inline and extracted versions.

### Extracted in this phase:

- 2026-05-06: extracted `hashString` from `app.js:483-495` to `src/util/hash.js` — byte-identical (Plan 02-02 Task 1)
- 2026-05-06: extracted `uid`, `iso`, `formatWhen`, `initials`, `firstNameFromAuthor` from `app.js:42-44, 46, 48-57, 68-74, 76-91` to `src/util/ids.js` — byte-identical (Plan 02-02 Task 1). Private helper `capitalise` extracted alongside `firstNameFromAuthor`.
- 2026-05-06: extracted `pillarStatus`, `bandLabel`, `bandStatement`, `bandColor` from `app.js:241-246, 2761-2786` to `src/domain/banding.js` — byte-identical (Plan 02-03 Task 1).
- 2026-05-06: extracted `pillarScoreForRound`, `pillarScore`, `respondentsForRound`, `answeredCount` from `app.js:219-235, 237-239, 248-251, 253-259` to `src/domain/scoring.js` — byte-identical with Pattern D DI of `DATA` + `questionMeta` (Plan 02-03 Task 1).
- 2026-05-06: extracted `userCompletionPct`, `orgSummary` from `app.js:241-250` (post-Wave-2 line shift; planner-cited as `app.js:282-307`) to `src/domain/completion.js` — byte-identical with Pattern D DI of `DATA` + `pillarScore`; `pillarStatus` imported directly from `./banding.js` (Plan 02-04 Task 1).
- 2026-05-06: extracted `unreadCountForPillar`, `unreadCountTotal`, `markPillarRead`, `unreadChatTotal` from `app.js:299-317, 348-357` (post-Wave-2 line shift; planner-cited as `app.js:340-414`) to `src/domain/unread.js` — byte-identical, **Pitfall 20 / H7 entanglement preserved as regression baseline**. Pattern D DI of `commentsFor`, `saveOrg`, `state`, `lastReadMillis`, `msgMillis`, `unreadChatForOrg`. `iso` imported directly from `../util/ids.js`. `currentUser` at app.js:306-309 STAYS for Wave 4 (auth) (Plan 02-04 Task 1).
- 2026-05-06: extracted `migrateV1IfNeeded`, `clearOldScaleResponsesIfNeeded` from `app.js:484-556` + `app.js:5295-5309` (post-Wave-3 line shift; planner-cited as `app.js:550-622` + `app.js:5459-5473`) to `src/data/migration.js` — byte-identical with full Pattern D DI (`loadUsers`, `loadOrgMetas`, `loadOrg`, `saveOrg`, `upsertUser`, `findUser`, `removeV1ActiveKey`, `loadSettings`, `saveSettings`). `uid` + `iso` imported directly from `../util/ids.js`. Idempotency-via-flag (Pitfall 10) preserved verbatim — `loadUsers().length > 0` early-return + `settings.scaleV2Cleared` flag (Plan 02-05 Task 1).
- 2026-05-06: extracted `syncFromCloud` from `app.js:3397-3434` (post-Wave-3 line shift; planner-cited as `app.js:3556-3593`) to `src/data/cloud-sync.js` — byte-identical with full Pattern D DI (`fbReady`, `cloudFetchAllOrgs`, `cloudFetchAllUsers`, `cloudPushOrg`, `cloudPushUser`, `jget`, `jset`, `K`, `render`). **Pitfall 20 / H8 entanglement preserved as regression baseline** — cloud wins on overlap (last-writer-wins). H8 fix (Phase 5+) rewrites the merge algorithm — `tests/data/cloud-sync.test.js` will break by design (Plan 02-05 Task 2).
- 2026-05-06: extracted `currentUser`, `verifyInternalPassword`, `verifyOrgClientPassphrase`, `verifyUserPassword` from `app.js:332-335` + `app.js:453-456` + `app.js:466-471` + `app.js:485-490` (post-Wave-3 line shift; planner-cited as `app.js:363-366` + `app.js:510-547`) to `src/auth/state-machine.js` — byte-identical with full Pattern D DI (`INTERNAL_PASSWORD_HASH`, `loadOrg`, `findUser`, `currentSession`). `hashString` imported directly from `../util/hash.js`. **Phase 6 (AUTH-14) deletes the whole module — replaced by Firebase Auth + custom claims. tests/auth/state-machine.test.js will be DELETED (not "translated") alongside the production code per CONTEXT.md `<specifics>` third bullet.** `currentSession` STAYS in app.js (different function from currentUser; not on D-02 extraction list) (Plan 02-05 Task 3).
- (subsequent waves append below)

## Phase 2 — extracted leaf modules (informational, not suppression)

Phase 2 (D-05) extracts pure-helper functions byte-identical from `app.js` into
`src/{util,domain,data,auth}/*.js`. Phase 4 may simplify their internals
(rename variables, split long functions, replace `let` with `const`) once the
test fence is in place. Each row below records a function whose body is
identical to the in-IIFE original; Phase 4 closes a row by either landing the
simplification or marking the row "no further work required".

| Source line range  | Module                          | Function(s)                                                                                                  | Phase 4 candidate cleanup                                                                                  |
| ------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `app.js:42-44, 46, 48-57, 68-74, 76-91` (planner-cited as `app.js:32-81` pre-Plan-02-01 line shift) | `src/util/ids.js`               | `uid`, `iso`, `formatWhen`, `initials`, `firstNameFromAuthor` (private helper: `capitalise`)                 | Replace `Math.random()` in `uid` with `crypto.randomUUID` (CODE-03 — already tracked); inline `capitalise`. |
| `app.js:483-495` (planner-cited as `app.js:473-486` pre-Plan-02-01 line shift) | `src/util/hash.js`              | `hashString`                                                                                                  | Phase 6 (AUTH-14) deletes — replaced by Firebase Auth.                                                      |
| `app.js:241-246, 2761-2786` (planner-cited as `app.js:262-267, 2816-2841` pre-Plan-02-02 line shift) | `src/domain/banding.js`         | `pillarStatus`, `bandLabel`, `bandStatement`, `bandColor`                                                     | Pull boundary constants (50, 75) into a named export; consolidate duplicate boundary checks across the four functions. |
| `app.js:219-235, 237-239, 248-251, 253-259` (planner-cited as `app.js:240-280` pre-Plan-02-02 line shift) | `src/domain/scoring.js`         | `pillarScoreForRound`, `pillarScore`, `respondentsForRound`, `answeredCount` (latter still dead code)         | Remove DI of `DATA` + `questionMeta` once `domain/pillars.js` lands and questionMeta is its own module; remove `answeredCount` if still dead at Phase 4 close. |
| `app.js:241-250` (`userCompletionPct` + `orgSummary`; planner-cited as `app.js:282-307` pre-Plan-02-02 line shift) | `src/domain/completion.js`      | `userCompletionPct`, `orgSummary`                                                                              | Remove DI of `pillarScore` once import-from-`scoring.js` is direct (no `DATA` leakage). Pull `pillarStatus` boundary constants in alongside Phase 4's banding cleanup. |
| `app.js:299-317` + `app.js:348-357` (`unreadCountForPillar`, `unreadCountTotal`, `markPillarRead`, `unreadChatTotal`; `currentUser` at app.js:306-309 EXCLUDED — Wave 4 owns it. Planner-cited as `app.js:340-414` pre-Plan-02-02 line shift) | `src/domain/unread.js`          | `unreadCountForPillar`, `unreadCountTotal`, `markPillarRead`, `unreadChatTotal`                                | **H7 fix (Phase 5, DATA-07) rewrites comparator — `tests/domain/unread.test.js` will break by design (regression baseline).** Phase 5 plan task: replace TEST-05 with server-clock-vs-server-clock assertions; the diff IS the cutover evidence. |
| `app.js:484-556` (`migrateV1IfNeeded`) + `app.js:5295-5309` (`clearOldScaleResponsesIfNeeded`); planner-cited as `app.js:550-622` + `app.js:5459-5473` pre-Plan-02-04 line shift | `src/data/migration.js`         | `migrateV1IfNeeded`, `clearOldScaleResponsesIfNeeded`                                                          | Pattern D DI surface (loadUsers/loadOrgMetas/loadOrg/saveOrg/upsertUser/findUser/removeV1ActiveKey/loadSettings/saveSettings) collapses once data/orgs.js + data/users.js + data/settings.js own the helpers (Phase 4). Idempotency-via-flag stays — Pitfall 10 reasoning is durable. |
| `app.js:3397-3434` (`syncFromCloud`); planner-cited as `app.js:3556-3593` pre-Plan-02-04 line shift | `src/data/cloud-sync.js`        | `syncFromCloud`                                                                                                | **H8 fix (Phase 5+) rewrites merge algorithm — `tests/data/cloud-sync.test.js` will break by design (regression baseline).** Phase 5+ subcollection migration replaces last-writer-wins overlap with explicit conflict resolution; the diff IS the cutover evidence. Pattern D DI (fbReady/cloudFetchAllOrgs/cloudFetchAllUsers/cloudPushOrg/cloudPushUser/jget/jset/K/render) collapses once the firebase/ adapter owns these helpers. |
| `app.js:332-335` (`currentUser`) + `app.js:453-456` (`verifyInternalPassword`) + `app.js:466-471` (`verifyOrgClientPassphrase`) + `app.js:485-490` (`verifyUserPassword`); planner-cited as `app.js:363-366` + `app.js:510-547` pre-Plan-02-04 line shift | `src/auth/state-machine.js`     | `currentUser`, `verifyInternalPassword`, `verifyOrgClientPassphrase`, `verifyUserPassword`                     | **Phase 6 (AUTH-14) deletes the whole module — replaced by Firebase Auth + custom claims.** Tests at `tests/auth/state-machine.test.js` will be DELETED (not "translated") alongside the production code per CONTEXT.md `<specifics>` third bullet. The tests' value is the regression baseline during the Phase 6 cutover, not long-term coverage. `INTERNAL_PASSWORD_HASH` constant + the gitleaks-grandfathered finding (out-of-band soft-fail row above) ALSO close at Phase 6. |

### JSDoc-was-`any` decisions (D-06)

Phase 2 left the following types as `any` in JSDoc because tightening would
force a behavioural change. Phase 4 may revisit:

| Module                          | Symbol               | Why `any`                                                                                                |
| ------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/domain/scoring.js`         | `org` parameter (all four exports) | The `org` tree shape is read via byte-identical loose-object indexing (`org.responses[roundId][userId][pillarId][idx]`). Tightening to a concrete `Org` interface in Phase 2 would either (a) force defensive nullability rewrites or (b) require a cast at every call site. Phase 4 (CODE-01) tightens once a domain `Org` shape lands. |
| `src/domain/scoring.js`         | `answeredCount` `find()` result | Cast `(DATA.pillars.find(...))` to `{ diagnostics: Array<unknown> }` because the byte-identical original throws on unknown `pillarId`. The cast preserves that throw-on-unknown behaviour (D-05); Phase 4 may replace with explicit error handling once `answeredCount` is either wired up or deleted. |
| `src/domain/completion.js`      | `org` parameter (both exports) | Same rationale as `src/domain/scoring.js`: byte-identical loose-object indexing (`org.responses[roundId][userId][p.id]`). Phase 4 (CODE-01) tightens once a domain `Org` shape lands. |
| `src/domain/unread.js`          | `org` parameter (3 of 4 exports) | Same rationale: byte-identical loose-object indexing (`org.readStates[user.id][pillarId]`). Phase 4 (CODE-01) tightens once a domain `Org` shape lands. |
| `src/domain/unread.js`          | `user` parameter on `unreadChatTotal` | Original byte-identical IIFE code passes `user.orgId` (typed `string\|undefined`) into `unreadChatForOrg(user, orgId: string)`. Tightening `user.orgId` to `string` would force a defensive guard the IIFE doesn't have; relaxing the parameter to `*` preserves byte-identical behaviour (D-05). The other three exports keep structural `user` typing because `user.id` access is straightforward. Phase 5 (DATA-07) refactors this whole module — full `User` shape lands then. |
| `src/data/migration.js`         | `migrated` local + `r` / `qs` / `a` callback params | Original byte-identical IIFE used `// @ts-nocheck` for the entire app.js — the `migrated.responses[roundId][legacyId][pillarId][idx]` deep-loose-object writes don't typecheck under strict `checkJs`. Tagging `migrated` as `any` and the callback args as `any` preserves the byte-identical write pattern (D-05). Phase 4 (CODE-01) tightens once a domain `Org` shape lands. |

### Phase 2 close-out

Phase 2 closed on 2026-05-06. All 9 leaf modules extracted (uid+iso+formatWhen
+initials+firstNameFromAuthor → `src/util/ids.js`; hashString → `src/util/
hash.js`; banding 4 → `src/domain/banding.js`; scoring 4 → `src/domain/
scoring.js`; completion 2 → `src/domain/completion.js`; unread 4 → `src/domain/
unread.js`; migration 2 → `src/data/migration.js`; cloud-sync 1 → `src/data/
cloud-sync.js`; auth state-machine 4 → `src/auth/state-machine.js`).

All TEST-01..07 + TEST-10 closed (149 tests across 14 files). Per-directory
coverage thresholds wired into `vite.config.js` (D-15 — domain/util 100%,
auth 95%, data 90%) with the mandatory "DO NOT add a global threshold key"
comment. CI test job runs `npm run test:coverage` and uploads the HTML report
as a `coverage-report-html` artefact (D-20). CI also enforces the snapshot-
presence backstop (Pitfall 5) via three `test -s` checks against the committed
baselines at `tests/__snapshots__/views/`. ESLint `no-restricted-imports`
(T-2-03) blocks `src/**` and `app.js` from importing `tests/**`. Snapshots
committed (T-2-02 step 2 mitigated end-to-end by `git check-ignore` returning
exit 1 for each baseline).

Phase 4 may now begin its modular split work — every domain/util/data/auth
move is fenced by tests + by the snapshot baselines that pin the rendered
DOM at the pre-Phase-4 boundary. Phase 4's verification = `git diff
tests/__snapshots__/` against the boundary commit must match the explicit
DOM-shape changes that wave introduces, nothing more.

Two coverage holes remain at Phase 2 close (both inside the data tier,
both within the 90% threshold):

- `src/data/migration.js:70` — branch on `(qs)` truthiness inside the per-
  pillar response migration. Defensive against a malformed v1 fixture where a
  pillar entry is set but its question map is null. Wave 5 added 9 migration
  cases including the falsy-fallback fixture, but this specific sub-branch
  remains uncovered without a uniquely contrived fixture. Phase 4 cleanup may
  remove the defensive guard once `migrated` has a tight `Org` shape.
- `src/data/cloud-sync.js:58` — the `if (typeof render === "function") render()`
  guard's false branch. Plan body says render is always a function in the IIFE
  binding. The guard is defensive for the test surface; tightening it would
  require either removing the guard (Phase 4 work once the firebase/ adapter
  owns sync) or contriving a non-function render dependency (rejected — would
  test the test, not the code).
