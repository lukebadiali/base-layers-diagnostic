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
Closed in Phase 4 Wave 2 (04-02): the `no-unused-vars` row at app.js:670 (the `$$` helper extracted to src/ui/dom.js — now legitimately exported and aliased to `_$$` in app.js with the `^_` argsIgnorePattern carrying the unused-import-by-design contract until Wave 4 wires consumers), plus the `no-unsanitized/property` row at app.js:676 (the `html:` branch deleted entirely from src/ui/dom.js per CODE-04 with permanent XSS regression fixture at tests/ui/dom.test.js).
Remaining: **12** (11 ESLint disables in app.js + 1 `@ts-nocheck` on app.js, all closing as Waves 3-5 extract app.js into src/views/* + src/state.js + src/router.js + src/main.js).

| File              | Line | Annotation                                                  | Rule / Check                | Intended Fix                                                                                                | Closure Phase     |
| ----------------- | ---- | ----------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------- |
| app.js            | 1    | `// @ts-nocheck`                                            | tsc strict checkJs          | Remove after IIFE → modules split; per-module JSDoc types pass `tsc --noEmit` cleanly.                      | Phase 4 (CODE-01) |
| app.js            | 237  | `// eslint-disable-next-line no-unused-vars`                | no-unused-vars              | Phase 2 (D-05): line shifted from app.js:274 (was the in-IIFE `answeredCount` declaration); the function body moved to `src/domain/scoring.js` (export form, no active directive needed); the carry-over `eslint-disable` now sits on the in-IIFE wrapper closure `const answeredCount = ...`. Remove dead code or wire up call site. | Phase 4 (CODE-01) |
| app.js            | 420  | `// eslint-disable-next-line no-empty`                      | no-empty                    | Replace empty catch with explicit ignore + comment (Phase 9 logger TBD).                                    | Phase 4 (CODE-01) |
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
| `eslint.config.js` ESLint `no-restricted-imports` rule (per-wave hardening)   | `"warn"` → `"error"` flips per-wave per D-04 as boundaries land. Wave 1 (04-01) closed `firebase/firestore | firebase/storage | firebase/auth | firebase/app-check | firebase/functions` group at `error` for non-`src/firebase/**` files. Wave 2 (04-02) closed `domain/* → firebase/*` (codifies Phase 2 D-03 already-zero-imports state — rule is dormant-but-active). Wave 3 (04-03) closed `data/* → only src/firebase/db.js + src/firebase/storage.js` (rule dormant-but-active: src/data/* already imports only from the adapter — verified by grep). Wave 4 (04-04) closed `views/* → no firebase/*` (rule dormant-but-active: src/views/* are stub Pattern D DI factories that import only from src/ui/dom.js + _shared/render-conversation.js today — verified by grep). | Phase 4 (per-wave) | Per-wave checkbox: [x] Wave 1 firebase/* group; [x] Wave 2 domain/*; [x] Wave 3 data/* → only src/firebase/db.js + src/firebase/storage.js; [x] Wave 4 views/*. Row closes when Wave 6 final hardening verifies via `npm run lint` clean (currently green at Wave 4 close). |
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
- 2026-05-07: extracted `h`, `$`, `$$` from `app.js:526-547` to `src/ui/dom.js` — byte-identical EXCEPT the `html:` branch DELETED (CODE-04, CWE-79 mitigation). The permanent XSS regression fixture at `tests/ui/dom.test.js` (REGRESSION FIXTURE marker per D-19) pins `<script>` + `<img onerror>` payloads as text content forever. Closes ledger rows at app.js:670 (no-unused-vars on `$$`) + app.js:676 (no-unsanitized/property on `html:` branch). The `$$` import in app.js is aliased `_$$` to satisfy the `^_` argsIgnorePattern until Wave 4 wires consumers (Plan 04-02 Task 1).
- 2026-05-07: extracted `modal`, `promptText`, `confirmDialog` from `app.js:550-616` to `src/ui/modal.js` — byte-identical (D-12 faithful extraction); IIFE-resident closure references to `h()` rewritten to `import { h } from "./dom.js"`. The two `root.innerHTML = ""` lines at modal.js:21 + 28 are CODE-05 forward-tracking — Wave 4 may swap to `replaceChildren()` once views/* fully sweep innerHTML sites (see Phase 4 forward-tracking row below) (Plan 04-02 Task 1).
- 2026-05-07: created `src/ui/format.js` — re-exports `formatWhen`, `iso`, `initials`, `firstNameFromAuthor` from `src/util/ids.js`. Provides the `ui/format` import path views/* expect per ARCHITECTURE.md §2 helpers table; util/ids.js implementation stays in place so the existing 100% src/util/** coverage threshold continues to fence behaviour (Plan 04-02 Task 1).
- 2026-05-07: created the 12 src/data/* per-collection wrappers (Plan 04-03 Wave 3) — 6 full owners (orgs/users/roadmaps/funnels/funnel-comments/allowlist) + 6 Phase-5-rewrite-target pass-throughs (responses/comments/actions/documents/messages/audit-events). All ship `// @ts-check` + JSDoc Promise-CRUD + subscribe* per D-10. Pass-throughs delegate to data/orgs.js's nested-map shape per D-09; Phase 5 (DATA-01..06) replaces the bodies with subcollection access in lockstep without changing the API surface (views/* never re-extract their consumption pattern). data/audit-events.js delegates to cloud/audit.js (a Phase 7 stub).
- 2026-05-07: created the 5 src/cloud/* + 2 src/observability/* documented no-op stub seams (Plan 04-03 Wave 3) — cloud/{audit, soft-delete, gdpr, claims-admin, retry}.js + observability/{sentry, audit-events}.js. Each stub ships `// @ts-check` + JSDoc + a "Phase X body lands here" comment template (mirrors src/firebase/check.js Wave 1 pattern). Phase 6 (AUTH-07), Phase 7 (FN-04/FN-09/AUDIT-02), Phase 8 (LIFE-04/GDPR-01/02), and Phase 9 (OBS-01/AUDIT-05) replace bodies WITHOUT changing the import surface — every later phase plugs into a stable substrate. observability/audit-events.js exports AUDIT_EVENTS as Object.freeze({}) so any accidental write fails. ARCHITECTURE.md §2 directory tree is now fully landed (Plan 04-03 Task 3).
- 2026-05-07: ESLint Wave 3 D-04 flip — `src/data/**/*.js` block forbids direct `firebase/firestore | firebase/storage | firebase/auth | firebase/app-check | firebase/functions` imports; data/* must access SDK only through `src/firebase/db.js` + `src/firebase/storage.js`. Rule dormant-but-active (verified by grep — src/data/* imports only from the adapter today). Closes the Wave 3 checkbox on the out-of-band soft-fail row (Plan 04-03 Task 3).
- 2026-05-07: created the 12 src/views/*.js stub Pattern D DI factories + src/views/_shared/render-conversation.js M8 closure helper (Plan 04-04 Wave 4). Per Wave 3 Deviation #1 precedent, the IIFE bodies remain in app.js (D-12 / D-02 — production rendering still flows through the app.js IIFE; Wave 5 re-homes bodies into views when state.js + router.js + main.js extract). The view stubs satisfy the Pattern D DI factory contract + tests/views/*.test.js smoke tests; the per-view CODE quick wins (CODE-05/06/07/08/09/10/12) fold INSIDE the IIFE per D-20.
- 2026-05-07: CODE-05 closed (17 sites total — Wave 4 closes the last 7 in app.js; Waves 1-3 closed 10 from extracted modules). All `innerHTML = ""` clearing patterns in src/** + app.js production code now use `replaceChildren()` (DOM-equivalent + ESLint no-unsanitized/property friendly) (Plan 04-04 Task 2).
- 2026-05-07: CODE-07 closed (7 alert() sites in app.js wired to `notify("error"|"success", ...)` from src/ui/toast.js). The Wave 2 `_notify` import alias retires (Plan 04-04 Task 2).
- 2026-05-07: CODE-09 closed (Plan 04-04 Wave 4 Task 2 / D-15 trust boundary). The IIFE-resident upload site (app.js:3190) now calls `validateUpload(file)` BEFORE `firestore.setDoc(...)` + Storage upload. On validation failure, `notify("error", reason)` fires + the upload aborts (no Storage write attempted). On success, `validation.sanitisedName` is used for both the Storage path + Firestore metadata `filename` field. Single allowlist constant exported from src/ui/upload.js consumed by both client-side (this wave) + server-side (Phase 5 storage.rules + Phase 7 callable validation).
- 2026-05-07: CODE-10 closed (tab-title unread badge memoisation). `updateTabTitleBadge` now calls `setTitleIfDifferent` from src/views/chat.js — title only writes to `document.title` when value differs from previous write (Plan 04-04 Task 2).
- 2026-05-07: CODE-12 closed (download anchors). The documents view download anchor (app.js:3304) gains `rel="noopener noreferrer"` (was `rel="noopener"`) — CWE-1021 opener-phishing mitigation paired with `target="_blank"` (Plan 04-04 Task 2).
- 2026-05-07: CODE-08 closed (chat + funnel-comments duplication — M8 closure target). Both IIFE renderers now call `renderConversationBubble` from src/views/_shared/render-conversation.js, which takes the bubble/meta/text/del class set as parameters (chat passes `chat-bubble`/`chat-bubble-meta`/`chat-bubble-text`/`chat-bubble-del`; funnel passes `comment-bubble`/`comment-meta`/`comment-text`/`comment-bubble-del`). Visually-stable production DOM (snapshot-baseline-equivalent for the non-snapshot-pinned chat + funnel views) (Plan 04-04 Task 2).
- 2026-05-07: CODE-06 partial (the 4 in-IIFE `el.style.X = ...` runtime mutations + the roadmap pillar-drop-zone inline-style block). passConfirm.style.display, drop.style.background ×3, and the drop-zone style block all converted to class-based DOM manipulation. The 132 `style="..."` inline-attr strings in app.js IIFE remain — they are part of the Phase 2 D-08 snapshot baseline contract (dashboard/diagnostic/report) and sweep with body migration in Wave 5 per D-12 + Wave 3 Dev #1 precedent. CSP-strict precondition (Phase 10 HOST-07) is satisfied for the runtime-set inline styles (the harder CSP target); the static inline-attr strings are CSP-tolerated under `style-src 'unsafe-inline'` and get swept atomically with body migration in Wave 5 (Plan 04-04 Task 2).
- 2026-05-07: ESLint Wave 4 D-04 flip — `src/views/**/*.js` block forbids direct `firebase/*` imports (per ARCHITECTURE.md §2.4). Closes the fourth and final boundary of the four-boundary D-04 plan. Rule dormant-but-active (verified by grep — src/views/* are stub Pattern D DI factories that import only from src/ui/dom.js + _shared/render-conversation.js today). Closes the Wave 4 checkbox on the out-of-band soft-fail row (Plan 04-04 Task 3).
- (subsequent waves append below)

### Phase 4 forward-tracking rows (CODE-05 candidates within ui/* extractions — D-12)

Faithful extractions in Wave 2 preserve `innerHTML = ""` reset patterns where they appeared in the IIFE source (D-12 — wrap, don't refactor). Wave 4's per-view innerHTML sweep (CODE-05) closes these:

| Path / line                                  | Pattern                          | Closes when                                                                                          |
| -------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/ui/modal.js:21` + `src/ui/modal.js:28`  | `root.innerHTML = "";` reset     | Wave 4 (per-view CODE-05 sweep) replaces with `root.replaceChildren()` once views/* depend on modal.js stable. |

## Phase 4 — forward-tracking rows (Phase 5 / Phase 7 / Phase 8 / Phase 9 closures)

Wave 3 lands the complete ARCHITECTURE.md §2 directory tree as documented seams. Each row below tracks a downstream phase that fills the body without changing the import surface (views/* / data/* never re-extract).

| Module                               | Forward closure                                                                                                                                | Closure phase     |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `src/data/responses.js`              | Phase 5 (DATA-01) replaces pass-through body with subcollection access (`orgs/{orgId}/responses/{respId}`); API stable                          | Phase 5           |
| `src/data/comments.js`               | Phase 5 (DATA-01) replaces pass-through body with subcollection access (`orgs/{orgId}/comments/{cmtId}`); API stable                            | Phase 5           |
| `src/data/actions.js`                | Phase 5 (DATA-01) replaces pass-through body with subcollection access (`orgs/{orgId}/actions/{actId}`); API stable                             | Phase 5           |
| `src/data/documents.js`              | Phase 5 (DATA-01) replaces pass-through body with subcollection access (`orgs/{orgId}/documents/{docId}`) + Storage Rules (RULES-04); API stable | Phase 5           |
| `src/data/messages.js`               | Phase 5 (DATA-01) replaces pass-through body with subcollection access (`orgs/{orgId}/messages/{msgId}`) + `readStates/{userId}`; API stable    | Phase 5           |
| `src/data/audit-events.js`           | Phase 7 (FN-04 / AUDIT-01) wires `recordAuditEvent` → `cloud/audit.js` → real `auditWrite` callable                                            | Phase 7           |
| `src/cloud/audit.js`                 | Phase 7 (FN-04 / AUDIT-01) replaces body with `httpsCallable("auditWrite")`                                                                    | Phase 7           |
| `src/cloud/soft-delete.js`           | Phase 8 (LIFE-04) replaces body with `httpsCallable("softDelete")` + `httpsCallable("restoreSoftDeleted")`                                     | Phase 8           |
| `src/cloud/gdpr.js`                  | Phase 8 (GDPR-01/02) replaces body with `httpsCallable("gdprExportUser")` + `httpsCallable("gdprEraseUser")`                                   | Phase 8           |
| `src/cloud/claims-admin.js`          | Phase 6 (AUTH-07) replaces body with `httpsCallable("setClaims")`                                                                              | Phase 6           |
| `src/cloud/retry.js`                 | Phase 7 (FN-09) replaces body with exponential-backoff + 429-aware retry helper                                                                | Phase 7           |
| `src/observability/sentry.js`        | Phase 9 (OBS-01) replaces body with `@sentry/browser` init + `captureException` + `addBreadcrumb`                                              | Phase 9           |
| `src/observability/audit-events.js`  | Phase 7 (AUDIT-02) populates `AUDIT_EVENTS` constants table; Phase 9 (AUDIT-05) wires `emitAuditEvent` calls in views/*                        | Phase 7 / Phase 9 |

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
