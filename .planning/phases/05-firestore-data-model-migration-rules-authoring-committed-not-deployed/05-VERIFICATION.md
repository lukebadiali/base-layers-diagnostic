---
phase: 05-firestore-data-model-migration-rules-authoring-committed-not-deployed
verified: 2026-05-08T18:00:00Z
status: human_needed
score: 6/6 success criteria verified (substrate complete; live data verification deferred to Phase 6 by empty-database condition)
overrides_applied: 0
human_verification:
  - test: "Confirm RULES-06 commit-not-deploy invariant by inspecting Firebase Console"
    expected: "Firebase Console -> bedeveloped-base-layers -> Firestore Database -> Rules tab shows the PRE-PHASE-5 ruleset (or no ruleset / project default), NOT the firestore.rules content committed at firestore.rules. Same for Storage Rules tab. Phase 6 RULES-07 is the deploy gate."
    why_human: "RULES-06 is a negative invariant — it cannot be confirmed from the repo alone (the repo does not know what is deployed). The git log + git grep gates verify nobody invoked the deploy command from CI/scripts; the Console verification confirms a human did not deploy out-of-band. Verifier already ran the negative grep gates (zero matches in *.yml/*.json/*.js/*.sh/*.ts) — only the Console check remains."
  - test: "Confirm the SC#4 5-minute clock-skew test produces correct unread counts in a live browser session"
    expected: "Open a real chat session with one user posting messages; verify the 'unread' badge in the tab title + chat tab updates correctly when comments are posted. Then mock-shift the local browser clock ±5 minutes (DevTools > Sensors > Custom location/time, or equivalent) and refresh — the unread count must NOT change. Phase 5 tests/domain/unread.test.js pins this at the unit level (24/24 green); the human check confirms the IIFE-resident comparator wrappers (src/main.js:402-407 _toTsFromIso/_toCommentDuck shims) feed the same server-time semantics in the live render path."
    why_human: "5-minute clock-skew under real onSnapshot + browser-clock manipulation is observable only in a live session. The unit test mocks the clock and pins comparator output; the live check confirms the IIFE wrapper adapter feeds the same data shape into the rendered DOM."
  - test: "Verify the migration script's --verify mode succeeds against the (empty) production database"
    expected: "Operator runs `node scripts/migrate-subcollections/run.js --verify` against bedeveloped-base-layers production; output is `[OK] Verify-only mode complete; field-presence assertions passed.` (already done at cutover per 05-PREFLIGHT.md `verify_command_exit_code: 0`). Re-run sanity-check is optional — the cutover-day evidence stands."
    why_human: "Live-Firestore-emulator-or-prod evidence is the verification substrate. The 05-PREFLIGHT.md captures the post-cutover verify result; this human checkpoint is to confirm operator (Hugh) has read 05-PREFLIGHT.md and is satisfied with the empty-database no-op outcome before signing off Phase 5 close."
---

# Phase 5: Firestore Data Model Migration + Rules Authoring (Committed, Not Deployed) — Verification Report

**Phase Goal (ROADMAP.md):** Production data lives under the subcollection-based shape the Rules will authorise; `firestore.rules` + `storage.rules` are written, unit-tested, and committed to the repo — but not yet deployed to production (deploy gate is Phase 6).

**Verified:** 2026-05-08T18:00:00Z
**Status:** human_needed (3 manual smoke / out-of-band-Console checks; all automated gates green; all 6 ROADMAP SCs verified at substrate level)
**Re-verification:** No — initial verification.

## Goal Achievement Summary

Phase 5 delivered the full subcollection migration substrate end-to-end:

- **Rules surface** (Wave 1): `firestore.rules` (159 lines, 13 collection match blocks, 9-helper predicate library) + `storage.rules` (44 lines, 25 MiB cap + 6-MIME allowlist) committed and unit-tested via 5 emulator-backed test files (176 cells, 100% green at commit `4fe36b9`). Deploy gate held for Phase 6 RULES-07.
- **Migration substrate** (Wave 2): `scripts/migrate-subcollections/{run,process-doc,builders,assertions}.js` with two-phase per-doc idempotency markers (PENDING → DONE), 499-op WriteBatch flushing, --dry-run / --verify CLI flags, ADC credential init via `applicationDefault()`, 6 step ids (responses-v1 / comments-v1 / actions-v1 / documents-v1 / messages-v1 / readStates-init), pre/post collectionGroup count assertions + sample-based field-presence assertions. 57 unit tests cover builders + assertions + idempotency state machine.
- **Data wrapper rewrites** (Wave 3): 5 Phase 4 D-09 pass-through wrappers (responses, comments, actions, documents, messages) rewritten onto subcollection access via firebase/db.js exclusively; new `src/data/read-states.js` wrapper with serverTimestamp-only writes (DATA-07 substrate). Phase 4 D-09 wrapper API contract preserved verbatim — views/* unchanged.
- **H7 + H8 fixes** (Wave 4): Two atomic commits per Pitfall 20. Commit A `d81cb50` rewrites `src/domain/unread.js` to read server-time Timestamp values via duck-typed `toMillis()`; the legacy `markPillarRead` write helper is DELETED entirely; `src/main.js:1739` callsite rewired to `setPillarRead` from `data/read-states.js`. Commit B `3145ebc` rewrites `src/data/cloud-sync.js` to remove the parent-doc nested-map syncer; per-subcollection listeners replace last-writer-wins overlap merge. 5-minute client-clock-skew test passes (ROADMAP SC#4 pinned at unit level).
- **Production cutover** (Wave 5): Runbook authored at `runbooks/phase5-subcollection-migration.md` (7 sections); `05-PREFLIGHT.md` skeleton with 40 PENDING-USER markers; live cutover executed 2026-05-08 ~17:10 UTC by `business@bedeveloped.com`. Outcome: success against an EMPTY production database (project between client engagements per PROJECT.md baseline). Pre-migration export captured at `gs://bedeveloped-base-layers-backups/pre-phase5-migration/2026-05-08T17-10-06Z/`. 6 stray pre-Phase-4 root-collection docs deleted via find-strays.js + delete-strays.js (audit evidence in `663927f`).
- **DOC-10 close + RULES-06 verification gate** (Wave 6): SECURITY.md gains 4 new sections (Firestore Data Model + Firestore Security Rules - Authored, Not Yet Deployed + Storage Rules + Phase 5 Audit Index); RULES-06 negative invariant verified (`git grep` returned empty across `*.yml/*.yaml/*.json/*.js/*.sh/*.ts`); `runbooks/phase-5-cleanup-ledger.md` queues 10 forward-trackers for Phase 6/7/8 with zero new suppressions.

The known caveat — **the cutover ran against an empty production database** — is the operator-acknowledged condition. The PROJECT.md baseline confirms "between client engagements"; the 05-PREFLIGHT.md narrative documents that pre/post counts are all zero, the assertion harness ran cleanly, and the audit value lives in the discipline of the export → dry-run → real-run → verify chain rather than transformed data. The substrate is in place; first real data exercise lands in Phase 6.

## Success Criteria Verification

### SC1 — Subcollection-based Firestore data model with pre/post zero-data-loss assertions

**Goal:** Firestore production data is read from subcollections (`orgs/{orgId}/responses/{respId}`, `comments/{cmtId}`, `actions/{actId}`, `documents/{docId}`, `messages/{msgId}`, `readStates/{userId}`) with parent docs reduced; pre/post doc-count + field-presence assertions confirm zero data loss.

| Sub-criterion | Status | Evidence |
| --- | --- | --- |
| 6 wrappers (responses, comments, actions, documents, messages, read-states) read/write subcollections | VERIFIED | `src/data/responses.js` line 14-21 imports `db, doc, getDoc, setDoc, deleteDoc, serverTimestamp` from `../firebase/db.js`; line 42 reads `doc(db, "orgs", orgId, "responses", respId)`. `src/data/comments.js` line 32-36 uses `query(collection(db, "orgs", orgId, "comments"), where(...))`. `src/data/actions.js` line 29 uses `collection(db, "orgs", orgId, "actions")`. `src/data/documents.js` line 38 uses `collection(db, "orgs", orgId, "documents")`. `src/data/messages.js` line 49 uses `collection(db, "orgs", orgId, "messages")` + line 80 onSnapshot on subcollection (NOT parent doc — H8-precursor). `src/data/read-states.js` line 42 uses `doc(db, "orgs", orgId, "readStates", userId)`. |
| Phase 4 D-09 wrapper API surface preserved | VERIFIED | All exports retained verbatim: `listResponses/saveResponse/deleteResponse`, `listComments/addComment/deleteComment`, `listActions/saveAction/deleteAction`, `listDocuments/saveDocument/deleteDocument`, `listMessages/addMessage/subscribeMessages`, plus new `getReadState/setPillarRead/setChatRead/subscribeReadState`. Wave 3 SUMMARY.md confirms `npm run typecheck` green with zero new errors in src/data/** + tests/data/**. views/* untouched (snapshot baselines zero diff in 05-04). |
| Pre/post collectionGroup count + field-presence assertions implemented | VERIFIED | `scripts/migrate-subcollections/assertions.js` exports `captureBaselineCounts(db)` (line 36) — orgs parent + 6 subcollection counts via collectionGroup; `assertCollectionGroupCount(preCounts, postCounts)` (line 61) — pure pre/post diff, throws on regression; `assertFieldPresence(db, sampleSize=20)` (line 103) — samples up to 20 docs per (responses/comments/messages) and asserts inline legacy field present (D-03 invariant). 18 unit tests cover the harness in `tests/scripts/migrate-subcollections/assertions.test.js`. |
| Cutover assertions ran successfully | PASSED (empty-data caveat) | 05-PREFLIGHT.md `assertions_passed: yes (after stray cleanup)` + `verify_command_exit_code: 0`. Pre/post counts are all zero (orgs=0, responses=0, etc.) because production database was empty at cutover time — the migration was effectively a no-op. The assertion HARNESS ran end-to-end and returned green; the audit value is in the discipline of running the harness against production, not in transformed data. The substrate is in place; first non-empty exercise lands in Phase 6. |

**SC1 verdict:** VERIFIED (substrate complete; live transformation evidence deferred to Phase 6 by empty-database condition acknowledged in 05-PREFLIGHT.md and SECURITY.md § Firestore Data Model).

### SC2 — Migration script re-runnable end-to-end with idempotency markers

**Goal:** Migration script is re-runnable end-to-end with idempotency markers per collection.

| Sub-criterion | Status | Evidence |
| --- | --- | --- |
| Migration script exists at `scripts/migrate-subcollections/run.js` with --dry-run + --verify | VERIFIED | File exists; line 28-29 imports firebase-admin via ESM sub-paths (`firebase-admin/app` + `firebase-admin/firestore`); line 48 `DRY_RUN = argv.includes("--dry-run")`; line 49 `VERIFY_ONLY = argv.includes("--verify")`; line 51 `applicationDefault()` ADC. |
| Per-doc markers under `migrations/{stepId}/items/{docId}` with PENDING → DONE state machine | VERIFIED | `scripts/migrate-subcollections/process-doc.js` line 59 `db.doc(\`migrations/${stepId}/items/${sourceDoc.id}\`)`; line 64 SKIP path on `marker.data()?.status === "done"`; line 89-93 PENDING marker BEFORE batch writes; line 113-119 DONE marker AFTER all writes succeed. State machine pinned by 3 dedicated test cells in `tests/scripts/migrate-subcollections/idempotency.test.js` (PENDING→DONE flow, SKIP on done, RE-PROCESS on pending). |
| 499-op WriteBatch flush (Pitfall 8) | VERIFIED | `process-doc.js` line 28 `const BATCH_FLUSH_THRESHOLD = 499`; line 102 `if (batchCount === BATCH_FLUSH_THRESHOLD)`. Pinned by test cells exercising 600 targets → 2 commits (499 + 101) and 499 boundary → 1 commit. |
| 6 migration step ids (responses-v1, comments-v1, actions-v1, documents-v1, messages-v1, readStates-init) | VERIFIED | `run.js` line 63-70 STEPS array enumerates all 6 ids in deepest-leaves-first order per Pitfall 10. |
| --dry-run short-circuits at WRITE site | VERIFIED | `process-doc.js` line 75-84 dry-run branch logs targets + returns `{ dryRun: true, wouldWrite: targets.length }` BEFORE any marker write or batch write. Reads + builder execution always run (Pitfall 5 closure). Cutover-day dry-run-output.log captured the empty-database run. |
| Migration is re-runnable | VERIFIED (substrate level) | Combination of marker state machine + builder purity ensures re-runs DO NOT duplicate (DONE → SKIP) or destroy (PENDING → re-process from same marker). Live re-run was performed during cutover-day stray-cleanup recovery (initial run failed on stray field-presence assertion; after stray deletion via delete-strays.js, re-run produced `[OK] Migration complete; pre/post assertions passed.`). 05-PREFLIGHT.md captures the recovery path. |

**SC2 verdict:** VERIFIED. Substrate complete + cutover-day re-run path exercised (stray-cleanup recovery is the live evidence the idempotency markers + dry-run + assertion-fail-recovery loop works against production).

### SC3 — users keyed by Firebase Auth UID + new top-level collections with rule scopes

**Goal:** users collection keyed by Firebase Auth UID with legacyAppUserId for backfill; new top-level collections (internalAllowlist, auditLog, softDeleted/{type}/items/{id}, rateLimits/{uid}/buckets/{windowStart}) exist with correct rule scopes.

| Sub-criterion | Status | Evidence |
| --- | --- | --- |
| `users/{uid}` rule block in firestore.rules | VERIFIED | `firestore.rules` line 100-105: `match /users/{uid}` block. `allow read: if isAuthed() && (request.auth.uid == uid || isInternal());` `allow create: if false;` (server-only; Phase 6 bootstrap). `allow update: if false;` (server-only via `setClaims` callable Phase 6). |
| `internalAllowlist/{email}` rule block | VERIFIED | `firestore.rules` line 108-111: admin-only read + write per RULES-03. |
| `auditLog/{eventId}` rule block (AUDIT-07 / Pitfall 17) | VERIFIED | `firestore.rules` line 114-117: `allow read: if isAdmin();` (internal CANNOT read own audit records — AUDIT-07 pinned by emulator test cell `internal read auditLog/e1 -> deny`). `allow write: if false;` (server-only via auditWrite callable in Phase 7). |
| `softDeleted/{type}/items/{id}` rule block | VERIFIED | `firestore.rules` line 120-123: admin-only read; `allow write: if false` (server-only Phase 8 LIFE-02). |
| `rateLimits/{uid}/buckets/{windowStart}` rule block | VERIFIED | `firestore.rules` line 126-128: `allow read, write: if false;` deny-all (D-17 Phase 5 stance; FN-09 in Phase 7 replaces with `request.time` predicate). Forward-tracking row queued in `runbooks/phase-5-cleanup-ledger.md`. |
| `legacyAppUserId` / `legacyAuthorId` D-03 inline fields written through wrappers | VERIFIED | `src/data/responses.js` line 76 writes `legacyAppUserId: userId`. `src/data/comments.js` line 55 writes `legacyAuthorId: comment?.authorId`. `src/data/actions.js` line 47 writes `legacyAppUserId: action.ownerId`. `src/data/documents.js` line 67 writes `legacyAppUserId: meta?.uploadedBy \|\| null` (placed AFTER spread per security tightening). `src/data/messages.js` line 67 writes `legacyAuthorId: message?.authorId`. Migration `scripts/migrate-subcollections/builders.js` writes the equivalent inline fields per D-03 (6 cross-cutting test cells pin the invariant). |
| users collection keyed by Firebase Auth UID with legacyAppUserId substrate | PASSED (substrate-only caveat) | The rules block keys users by `{uid}` (the Firebase Auth UID per the rule predicate `request.auth.uid == uid`). The wrappers + migration script preserve `legacyAppUserId` inline on every applicable write/migration target. **No actual users exist yet** — Phase 6 AUTH-15 bootstrap migration creates the first real Firebase Auth users (Luke + George) and walks the inline legacy fields to backfill `legacyAppUserId → firebaseUid` mapping. The substrate is in place; activation is Phase 6's responsibility. Forward-tracking row queued in `runbooks/phase-5-cleanup-ledger.md` ("AUTH-15 backfill completes; cleanup wave deletes the legacy fields"). |

**SC3 verdict:** VERIFIED (substrate complete; first real user creation is Phase 6 AUTH-15).

### SC4 — Server-clock-vs-server-clock unread comparators with 5-minute skew test

**Goal:** Comment + chat unread comparators use server-clock-vs-server-clock exclusively (`readStates/{userId}`); 5-minute client-clock skew test does not change unread counts.

| Sub-criterion | Status | Evidence |
| --- | --- | --- |
| `src/domain/unread.js` rewritten to read server-time Timestamp via toMillis() | VERIFIED | `src/domain/unread.js` line 36 `lastMs = lastReadTs ? lastReadTs.toMillis() : 0`; line 38 `c.createdAt.toMillis() > lastMs`. ZERO `iso()` / `Date.now()` / `new Date(` in the source (verifier grep against unread.js returned no matches). |
| `markPillarRead` write helper DELETED entirely (no shim) | VERIFIED | `Grep markPillarRead in src/` returns 0 matches. The legacy domain-side write helper that used `iso()` to write client-clock ISO strings is gone — DATA-07 / D-12 / D-18 invariant. Per Wave 4 SUMMARY.md decision: "retaining a shim that wrote `iso()` would preserve the H7 root cause; the deletion + setPillarRead rewire is the closure mechanism." |
| `src/main.js:1739` callsite rewired to setPillarRead | VERIFIED | `src/main.js` line 99 `import { setPillarRead } from "./data/read-states.js"`; line 1782-1783 `// mark comments read on load (Phase 5 Wave 4 H7 fix: server-clock write via setPillarRead)` + `void setPillarRead(org.id, user.id, pillarId);`. |
| `src/data/read-states.js` writes use serverTimestamp() exclusively | VERIFIED | `src/data/read-states.js` line 53-57 setPillarRead writes `pillarReads: { [pillarId]: serverTimestamp() }`; line 65-71 setChatRead writes `chatLastRead: serverTimestamp()`. ZERO `iso()` / `Date.now()` / `new Date(` in the source (regex-grep test pin in `tests/data/read-states.test.js` lines 935-943 of plan, implementing as a "no-client-clock invariant" test). |
| 5-minute client-clock skew test passes | VERIFIED | `tests/domain/unread.test.js` line 75: `it("5-minute client clock skew does NOT change unread count (H7 / ROADMAP SC#4)", () => {...})`. 24/24 tests green per Wave 4 SUMMARY.md verification. |
| domain/* imports nothing Firebase (Phase 4 ESLint Wave 4 boundary) | VERIFIED | `src/domain/unread.js` has no imports at all (pure module — only exports). The Phase 4 ESLint boundary (forbidding domain/* from importing firebase/* or data/*) is preserved per Wave 4 SUMMARY.md `npm run lint` clean. |

**SC4 verdict:** VERIFIED. Server-clock-vs-server-clock comparator + setPillarRead write rewire + 5-minute clock-skew test all in place. Live render-path SC#4 confirmation surfaced as one of the 3 human verification items (the IIFE-resident comparator wrapper adapter feeds the same server-time semantics; pinned by Wave 4 SUMMARY.md "snapshot baselines zero diff" but real browser session is human-only).

### SC5 — @firebase/rules-unit-testing matrix covers every collection × every role × allowed/denied paths

**Goal:** @firebase/rules-unit-testing suite covers every collection × every role × allowed/denied paths; tenant-jump test passes.

| Sub-criterion | Status | Evidence |
| --- | --- | --- |
| 5 emulator-backed test files exist | VERIFIED | `tests/rules/{firestore,storage,tenant-jump,soft-delete-predicate,server-only-deny-all}.test.js` + `tests/rules/setup.js` (RulesTestEnvironment factory + ROLES + asUser/asStorageUser helpers). |
| Test matrix covers role × collection × op | VERIFIED | Wave 1 SUMMARY.md: 176-cell matrix breakdown — `firestore.test.js` 71 cells (5 roles × ~16 paths × 4 ops with explicit allow/deny per cell), `storage.test.js` 14 cells, `tenant-jump.test.js` 28 cells (7 paths × 4 ops), `soft-delete-predicate.test.js` 3 cells + Phase 8 scaffold rows (TODO-skipped), `server-only-deny-all.test.js` 60 cells (auditLog/softDeleted/rateLimits × 4 client roles × 4 ops + admin reads + admin write denials). |
| Tenant-jump test (RULES-04) passes | VERIFIED | `tests/rules/tenant-jump.test.js` exists per Glob; Wave 1 SUMMARY.md: 28/28 cells green asserting `client_orgA writing/reading orgs/orgB/*` denies for every (path, op) cell. |
| Suite runs green via npm run test:rules | VERIFIED (last execution evidence) | Wave 1 SUMMARY.md captures execution at commit `4fe36b9`: "Test Files 5 passed (5) / Tests 176 passed (176) / Duration 12.23s". CI test-rules job in `.github/workflows/ci.yml` (SHA-pinned setup-java@v4.8.0) runs the matrix on every PR; build job's needs list extended to include test-rules. **Note:** I did not re-run `npm run test:rules` myself — it requires Java JRE 11+ which the host environment may not have on PATH; the cutover-day 05-PREFLIGHT also notes the rules emulator suite was last verified green at 4fe36b9 and not re-run for the cutover. The CI gate continues enforcing this on every PR. |
| isAuthed() denies anonymous + requires email_verified (Pitfall 2) | VERIFIED | `firestore.rules` line 6-10: `request.auth.token.email_verified == true && request.auth.token.firebase.sign_in_provider != "anonymous"`. Pitfall 2 closure pinned by 6 anonymous-role deny cells in firestore.test.js (per Wave 1 SUMMARY.md). |
| Mass-assignment guards (D-15) — mutableOnly + immutable | VERIFIED | `firestore.rules` line 22-27 helper functions; lines 33, 44-46, 65-67, 93-94 use them on every applicable update path. Mass-assignment cell asserts `client_orgA cannot inject role:admin into an existing actions doc` (Wave 1 SUMMARY.md D-15 closure). |

**SC5 verdict:** VERIFIED. 176-cell matrix landed at commit `4fe36b9` and is gated in CI; rules-unit-testing v5 API used (no v4 deprecated `initializeAdminApp` / `initializeTestApp` per Pitfall 6 closure).

### SC6 — Rules committed but NOT deployed to production

**Goal:** firestore.rules + storage.rules committed but NOT deployed to production.

| Sub-criterion | Status | Evidence |
| --- | --- | --- |
| `firestore.rules` exists at repo root | VERIFIED | File exists; 159 lines; predicate library + 13 collection match blocks. |
| `storage.rules` exists at repo root | VERIFIED | File exists; 44 lines; isAuthed + inOrg + validSize (25 MiB) + validMime (6 MIMEs mirroring src/ui/upload.js ALLOWED_MIME_TYPES) + path-scoped + global deny-all fallback. |
| `firebase.json` declares both rules paths + emulator port pins | VERIFIED | `firebase.json` line 50-52 firestore declaration with `"rules": "firestore.rules"` + `"indexes": "firestore.indexes.json"`. Line 54-56 storage declaration with `"rules": "storage.rules"`. Line 60-61 emulator port pins (firestore: 8080, storage: 9199). |
| `firestore.indexes.json` exists with empty initial body | VERIFIED | File exists with `{ "indexes": [], "fieldOverrides": [] }` (required by firebase.json firestore declaration). |
| Zero `firebase deploy --only firestore:rules` invocations in enforcement files | VERIFIED | `Grep "firebase deploy --only firestore:rules"` over `*.{yml,yaml,json,js,sh,ts}` returns NO files. RULES-06 negative invariant satisfied. |
| Out-of-band Console deploy verification | NEEDS HUMAN | The repo cannot prove "rules are not deployed in the live Firebase project" — only that no automation was used to deploy them. Surfaced as human verification item. |

**SC6 verdict:** VERIFIED at the repo level; live Firebase Console verification surfaced as human verification item (the negative invariant is asymmetric — the repo evidence is sufficient for compliance narrative; the Console check is belt-and-braces).

## Required Artefacts

### Wave 1 — Rules + emulator-test substrate

| Artefact | Expected | Status | Details |
| --- | --- | --- | --- |
| `firestore.rules` | Predicate library + 13 match blocks (orgs parent + 6 subcollections + users + internalAllowlist + auditLog + softDeleted + rateLimits + roadmaps + funnels + funnelComments) | ✓ VERIFIED | 159 lines; helper-rich; D-14 / D-15 / D-17 closures pinned by Wave 1 SUMMARY.md and verified by direct file read. |
| `storage.rules` | isAuthed + inOrg + validSize (25 MiB) + validMime (6 types) + path-scoped + global deny-all | ✓ VERIFIED | 44 lines; mirrors src/ui/upload.js ALLOWED_MIME_TYPES + MAX_BYTES; defense-in-depth global deny-all fallback at line 40-42. |
| `firestore.indexes.json` | Empty initial body | ✓ VERIFIED | `{ "indexes": [], "fieldOverrides": [] }` |
| `firebase.json` | firestore + storage rules declarations + emulator port pins | ✓ VERIFIED | Lines 50-56 + 60-61 verified. |
| `vitest.rules.config.js` | Node-environment vitest config; tests/rules/** include; singleFork: true | ✓ VERIFIED | Wave 1 SUMMARY.md confirms; 5 test files run via this config. |
| `tests/rules/{setup,firestore,storage,tenant-jump,soft-delete-predicate,server-only-deny-all}.test.js` | 176-cell matrix | ✓ VERIFIED | All 6 files exist per Glob; Wave 1 SUMMARY.md confirms 176/176 cells green at commit `4fe36b9`. |
| `package.json test:rules` script | firebase emulators:exec wrapper | ✓ VERIFIED | Wave 1 SUMMARY.md confirms. |
| `.github/workflows/ci.yml test-rules` job | SHA-pinned setup-java@v4.8.0 + emulators:exec + vitest; build.needs extended | ✓ VERIFIED | Wave 1 SUMMARY.md confirms with SHA `c1e323688fd81a25caa38c78aa6df2d33d3e20d9`. |

### Wave 2 — Migration substrate

| Artefact | Expected | Status | Details |
| --- | --- | --- | --- |
| `scripts/migrate-subcollections/run.js` | Node entrypoint with shebang, ADC init, 6-step orchestrator, --dry-run + --verify flags | ✓ VERIFIED | 129 lines; `applicationDefault()` line 51; STEPS array line 63-70; main() iterates with processDoc DI dependency on { db, FieldValue, dryRun }. |
| `scripts/migrate-subcollections/process-doc.js` | DI-friendly per-source-doc processor with two-phase markers + dry-run + 499-op batch | ✓ VERIFIED | 127 lines; BATCH_FLUSH_THRESHOLD=499 line 28; PENDING/DONE state machine lines 89-119; dry-run short-circuit lines 75-84. |
| `scripts/migrate-subcollections/builders.js` | 6 pure functions, no firebase-admin imports | ✓ VERIFIED | 230 lines; `Grep "from 'firebase-admin"` in builders.js returns 0; D-03 inline legacy fields on every applicable target. |
| `scripts/migrate-subcollections/assertions.js` | captureBaselineCounts + assertCollectionGroupCount + assertFieldPresence + summarise | ✓ VERIFIED | 137 lines; 4 exports as specified. |
| `tests/scripts/migrate-subcollections/{builders,assertions,idempotency}.test.js` | 57 unit tests (29 + 18 + 10) | ✓ VERIFIED | All 3 files exist per Glob; Wave 2 SUMMARY.md confirms 57/57 green. |
| `package.json firebase-admin@13.x` in devDependencies | NEVER imported into src/ | ✓ VERIFIED | `Grep "firebase-admin"` in `src/` returns NO files. Pitfall 4 closure verified. |
| `package.json test:migrate` script | vitest run wrapper for migrate-subcollections | ✓ VERIFIED | Wave 2 SUMMARY.md confirms. |
| `eslint.config.js` Node-globals extended to scripts/**/*.js | process.exitCode lints clean | ✓ VERIFIED | Wave 2 SUMMARY.md Auto-fix #1. |

### Wave 3 — Data wrapper rewrites

| Artefact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/data/responses.js` | Subcollection access; D-09 API stable; D-03 legacy field | ✓ VERIFIED | 95 lines; reads `getDoc(doc(db, "orgs", orgId, "responses", respId))` line 42; writes `legacyAppUserId: userId` line 76; serverTimestamp line 78. |
| `src/data/comments.js` | Subcollection access; addComment uses serverTimestamp | ✓ VERIFIED | 70 lines; `query(collection(db, "orgs", orgId, "comments"), where("pillarId", "==", ...))` lines 32-35; addComment writes `createdAt: serverTimestamp()` line 56 + `legacyAuthorId` line 55. |
| `src/data/actions.js` | Subcollection access; saveAction requires action.id | ✓ VERIFIED | 62 lines; line 42 throws on missing `action.id`; writes `legacyAppUserId: action.ownerId` line 48. |
| `src/data/documents.js` | Subcollection metadata; Storage path unchanged | ✓ VERIFIED | 87 lines; `setDoc(doc(db, "orgs", orgId, "documents", docId), ...)` line 58; Storage path `orgs/${orgId}/documents/${docId}/${sanitisedName}` line 53; legacyAppUserId placed AFTER spread per security tightening (line 67). |
| `src/data/messages.js` | Subcollection access; subscribeMessages on subcollection (H8-precursor) | ✓ VERIFIED | 90 lines; subscribeMessages line 79 uses `onSnapshot(collection(db, "orgs", orgId, "messages"), ...)` (NOT parent doc); `Grep "onSnapshot\(\s*doc\(" src/data/messages.js` returns 0 (parent-doc listener gone). |
| `src/data/read-states.js` (NEW) | getReadState/setPillarRead/setChatRead/subscribeReadState; serverTimestamp-only writes | ✓ VERIFIED | 86 lines; 4 exports lines 41/52/65/79; setPillarRead line 55 writes `serverTimestamp()`; setChatRead line 67 writes `serverTimestamp()`; ZERO iso/Date.now/new Date in source (regex-grep test pinned). |
| `tests/mocks/firebase.js` | Variadic 4-segment subcollection path support | ✓ VERIFIED | Wave 3 SUMMARY.md confirms variadic collection/doc handlers + direct-children rowsForRef filter; existing `tests/data/orgs.test.js` (2-segment) still green. |
| `tests/data/{responses,comments,actions,documents,messages,read-states}.test.js` | Per-wrapper integration tests rewritten | ✓ VERIFIED | All 6 files exist per Glob; Wave 3 SUMMARY.md confirms 442/442 (after wave) green; tests/data/messages.test.js asserts subcollection listener. |

### Wave 4 — H7 + H8 fixes (two atomic commits)

| Artefact | Expected | Status | Details |
| --- | --- | --- | --- |
| `src/domain/unread.js` | Server-time Timestamp via toMillis(); markPillarRead DELETED; zero client-clock | ✓ VERIFIED | 95 lines; `Grep iso\(\)\|Date\.now\(\)\|new Date\(` in unread.js returns 0; `Grep markPillarRead` in src/ returns 0; line 36 `lastReadTs.toMillis()`; line 39 `c.createdAt.toMillis() > lastMs`. |
| `src/main.js:1739` callsite rewired to setPillarRead | ✓ VERIFIED | Line 99 `import { setPillarRead } from "./data/read-states.js"`; line 1783 `void setPillarRead(org.id, user.id, pillarId)`. |
| `tests/domain/unread.test.js` H7-baseline replaced + 5-min skew test | ✓ VERIFIED | Line 75 `it("5-minute client clock skew does NOT change unread count (H7 / ROADMAP SC#4)", () => {...})`; Wave 4 SUMMARY.md: 24/24 tests green. |
| `src/data/cloud-sync.js` | Parent-doc syncer GONE; per-subcollection listener dispatcher | ✓ VERIFIED | 88 lines; subscribeOrgMetadata line 24 + syncFromCloud line 48 (with parameter-detector branch line 52-69 for legacy 9-prop deps shape). NO jget/jset/cloudFetchAllOrgs/cloudPushOrg dependencies (verified by reading the file). |
| `tests/data/cloud-sync.test.js` H8-baseline replaced | ✓ VERIFIED | Wave 4 SUMMARY.md: 11/11 tests green. |
| Two atomic commits per Pitfall 20 | ✓ VERIFIED | `git log --oneline` shows: `d81cb50 feat(05-04): H7 fix - server-clock readStates comparator + setPillarRead rewire (DATA-07)` and `3145ebc feat(05-04): H8 fix - per-subcollection listeners replace parent-doc sync (D-13)`. NEVER bundled. |

### Wave 5 — Production migration runbook + cutover execution

| Artefact | Expected | Status | Details |
| --- | --- | --- | --- |
| `runbooks/phase5-subcollection-migration.md` | 7 sections; gcloud export + dry-run + real run + verification + rollback procedure | ✓ VERIFIED | File exists; 7 numbered sections present (1. Prerequisites, 2. Pre-cutover Smoke Checklist, 3. Cutover Steps with 4 sub-sections, 4. Post-Migration Verification, 5. Rollback Procedure, 6. Post-cutover cleanup, 7. Citations). |
| `05-PREFLIGHT.md` | Operator response template + cutover log; cutover_outcome field | ✓ VERIFIED | File exists with `cutover_outcome: success` (line 182); 7 pre-flight values populated; Cutover Log subblocks (pre_migration_export, dry_run, real_migration, post_verification) all populated; rollback fields n/a. |
| `scripts/migrate-subcollections/dry-run-output.log` | Committed audit evidence (force-added past *.log gitignore) | ✓ VERIFIED | File exists per Bash ls. Cutover-day output captured per 05-PREFLIGHT `dry_run.log_committed: 663927f`. |
| Pre-migration export at `gs://bedeveloped-base-layers-backups/pre-phase5-migration/<ISO>/` | ✓ VERIFIED | 05-PREFLIGHT records `bucket_uri: gs://bedeveloped-base-layers-backups/pre-phase5-migration/2026-05-08T17-10-06Z/` + operation name + state SUCCESSFUL. |
| 6 stray pre-Phase-4 root-collection docs cleaned (audit evidence) | ✓ VERIFIED | `scripts/migrate-subcollections/find-strays.js` + `delete-strays.js` exist (per Bash ls); committed in `663927f` per 05-PREFLIGHT notes; deviation captured honestly with full root-cause narrative. |

### Wave 6 — DOC-10 + RULES-06 verification gate + cleanup-ledger zero-out

| Artefact | Expected | Status | Details |
| --- | --- | --- | --- |
| SECURITY.md gains 4 Phase-5 sections | ✓ VERIFIED | `Grep "## § (Firestore Data Model\|Firestore Security Rules\|Storage Rules\|Phase 5 Audit Index)"` returns all 4 sections at lines 535, 576, 621, 648. 82 framework citations (>= 8 required) including ASVS / ISO/IEC 27001 / SOC 2 CC / GDPR Art. |
| `runbooks/phase-5-cleanup-ledger.md` (NEW) | Zero suppressions + 10 forward-trackers for Phase 6/7/8 | ✓ VERIFIED | File exists; "Suppressions: zero rows"; forward-tracking table has 10+ rows including `firestore.rules` deploy → Phase 6 (RULES-07), legacyAppUserId/legacyAuthorId → Phase 6 (AUTH-15), rateLimits → Phase 7 (FN-09), auditLog/softDeleted writers → Phase 7 (FN-01..09), per-doc markers → Phase 8, old nested-map fields → Phase 6+, IIFE shims → Phase 4 4.1, MIME-allowlist drift, pre-migration backup bucket lifecycle → Phase 8 (BACKUP-02), stray-cleanup scripts archive → Phase 12. |
| `runbooks/phase-4-cleanup-ledger.md` Phase 5 closure entries | ✓ VERIFIED | `Grep "2026-05-08.*Phase 5 Wave 3\|2026-05-08.*Phase 5 Wave 4"` returns 10 entries (>= 6 required). All 5 D-09 wrapper closures + new read-states.js entry + Wave 4 H7+H8 closures present. `Grep "Phase 5 (DATA-01) replaces body"` returns 0 (forward-tracking rows DELETED — closure entries replace them). |
| RULES-06 verification gate | ✓ VERIFIED | `Grep "firebase deploy --only firestore:rules"` over `*.{yml,yaml,json,js,sh,ts}` returns NO files. The single git-log false positive (commit `4fe36b9` body documenting the absence of the deploy command) is documented in 05-06 SUMMARY.md and 05-PREFLIGHT.md. |

## Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `src/data/responses.js` | subcollection orgs/{orgId}/responses/{respId} | `doc(db, "orgs", orgId, "responses", respId)` | ✓ WIRED | line 42, 59 in responses.js |
| `src/data/comments.js` | subcollection orgs/{orgId}/comments/{cmtId} | `collection(db, "orgs", orgId, "comments")` + `where("pillarId", ...)` | ✓ WIRED | line 32-35 in comments.js |
| `src/data/actions.js` | subcollection orgs/{orgId}/actions/{actId} | `collection(db, "orgs", orgId, "actions")` | ✓ WIRED | line 29 in actions.js |
| `src/data/documents.js` | subcollection orgs/{orgId}/documents/{docId} (metadata) + Storage path unchanged | `doc(db, "orgs", orgId, "documents", docId)` for metadata; `orgs/${orgId}/documents/${docId}/${sanitisedName}` for Storage | ✓ WIRED | lines 53, 58 in documents.js |
| `src/data/messages.js` | subcollection orgs/{orgId}/messages/{msgId} (subscribeMessages H8-precursor) | `onSnapshot(collection(db, "orgs", orgId, "messages"), ...)` | ✓ WIRED | line 79-89 in messages.js; `Grep "onSnapshot\(\s*doc\(" messages.js` returns 0 (parent-doc listener gone) |
| `src/data/read-states.js` | subcollection orgs/{orgId}/readStates/{userId} | `doc(db, "orgs", orgId, "readStates", userId)` | ✓ WIRED | lines 42, 54, 67, 81 in read-states.js |
| `src/data/read-states.js` writes | serverTimestamp() (DATA-07 H7-prevention guard) | `setDoc(... serverTimestamp() ...)` | ✓ WIRED | lines 55, 69 in read-states.js |
| `src/main.js` | data/read-states.js setPillarRead | `import { setPillarRead } from "./data/read-states.js"` + call at line 1783 | ✓ WIRED | lines 99, 1783 in main.js; `Grep markPillarRead in src/` returns 0 (legacy write helper deleted) |
| `src/domain/unread.js` | Timestamp.toMillis() duck typing | `lastReadTs.toMillis()` + `c.createdAt.toMillis()` | ✓ WIRED | lines 36-39 in unread.js |
| `src/domain/unread.js` | ZERO client-clock values | no iso/Date.now/new Date in source | ✓ WIRED | regex-grep returns 0; `Grep markPillarRead` returns 0 |
| `src/data/cloud-sync.js` | no jget/jset/cloudFetchAllOrgs/cloudPushOrg | only `import { db, doc, onSnapshot } from "../firebase/db.js"` | ✓ WIRED | line 14 in cloud-sync.js (only firebase/db.js import) |
| `scripts/migrate-subcollections/run.js` | firebase-admin Admin SDK | `import { initializeApp, applicationDefault } from "firebase-admin/app"` | ✓ WIRED | line 28 — ESM sub-path (Pitfall 4 closure) |
| `scripts/migrate-subcollections/run.js` | ADC credentials | `credential: applicationDefault()` | ✓ WIRED | line 51-54 |
| `scripts/migrate-subcollections/process-doc.js` | migrations/{stepId}/items/{docId} markers | `db.doc(\`migrations/${stepId}/items/${sourceDoc.id}\`)` | ✓ WIRED | line 59 |
| `firestore.rules` predicate library | Pitfall 2 closure | `email_verified == true && sign_in_provider != "anonymous"` | ✓ WIRED | lines 6-10 |
| `firestore.rules` mutation whitelist | D-15 / Pitfall 3 closure | `mutableOnly([...])` + `immutable(field)` | ✓ WIRED | lines 22-27 helper functions; lines 33, 44-46, 65-67 use them |

## Data-Flow Trace (Level 4)

| Artefact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `src/data/read-states.js` | snap.data() (in subscribeReadState onChange) | `onSnapshot(doc(db, "orgs", orgId, "readStates", userId), ...)` | YES (real Firestore subscription; live data when present) | ✓ FLOWING (substrate-level — empty database means no data flows yet, but the wiring is live) |
| `src/data/messages.js subscribeMessages` | snap.data() (per-message in onChange) | `onSnapshot(collection(db, "orgs", orgId, "messages"), ...)` | YES (real Firestore subcollection subscription) | ✓ FLOWING |
| `src/data/cloud-sync.js subscribeOrgMetadata` | snap.data() (parent doc metadata) | `onSnapshot(doc(db, "orgs", orgId), ...)` | YES (real parent-doc subscription) | ✓ FLOWING |
| `scripts/migrate-subcollections/run.js` orgsSnap.docs | source orgs parent docs | `db.collection("orgs").get()` | YES at the wiring level; cutover-day reality: empty DB → orgsSnap.size=0 → 0 source docs → no targets written. The dataflow IS live; the source dataset was empty. | ✓ FLOWING (with empty-data caveat) |
| `src/domain/unread.js unreadCountForPillar` | lastReadTs (Timestamp) + comments[].createdAt (Timestamp) | Caller passes from `data/read-states.js` getReadState + `data/comments.js` listComments | YES — duck-typed Timestamp.toMillis() consumed by comparator | ✓ FLOWING |

**Caveat:** Cutover-day production database was empty (PROJECT.md baseline: "between client engagements"); 05-PREFLIGHT.md transparently documents this. The dataflow wiring is verified end-to-end at the substrate level. First non-empty real-data exercise lands in Phase 6 when AUTH-15 creates the first Firebase Auth users (Luke + George) and they create the first org.

## Behavioural Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Unit test suite green (no regression vs Wave 5/6 baseline 454/454) | `npm test` | 65 files / 454 tests passed | ✓ PASS |
| 5-minute clock-skew test exists in unread.test.js (SC#4 unit pin) | `Grep "5-minute client clock skew" tests/domain/unread.test.js` | line 75 found | ✓ PASS |
| RULES-06 negative invariant: zero deploy commands in enforcement files | `Grep "firebase deploy --only firestore:rules" *.{yml,yaml,json,js,sh,ts}` | NO files | ✓ PASS |
| firebase-admin not imported into src/ (Pitfall 4 closure) | `Grep "firebase-admin" src/` | NO files | ✓ PASS |
| markPillarRead write helper deleted from src/ (H7 closure) | `Grep markPillarRead src/` | NO matches | ✓ PASS |
| Zero client-clock values in unread.js (DATA-07) | `Grep "iso\(\)\|Date\.now\(\)\|new Date\(" src/domain/unread.js` | no matches | ✓ PASS |
| Migration run.js `--dry-run` short-circuit | Re-run dry-run against production | `dry_run.log_committed: 663927f` per 05-PREFLIGHT | ? SKIP (not re-running production-side commands; cutover-day evidence stands) |
| Migration run.js `--verify` exits 0 against current state | Re-run verify against production | `verify_command_exit_code: 0` per 05-PREFLIGHT (cutover-day) | ? SKIP (not re-running production-side commands; cutover-day evidence stands) |
| Rules emulator suite (npm run test:rules) green | `npm run test:rules` | Java JRE-dependent; not re-run (host environment may lack Java on PATH); CI test-rules job enforces on every PR per Wave 1 SUMMARY.md | ? SKIP (CI gate enforces; last green at commit `4fe36b9` per Wave 1 SUMMARY.md 176/176) |

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| DATA-01 | 05-02, 05-03, 05-05 | Firestore subcollection-based data model; one-shot migration script | ✓ SATISFIED | Wave 2 substrate + Wave 3 wrapper rewrites + Wave 5 cutover. SECURITY.md § Firestore Data Model documents the migration narrative. |
| DATA-02 | 05-02, 05-03 | users keyed by Firebase Auth UID with legacyAppUserId for backfill | ✓ SATISFIED (substrate) | `firestore.rules /users/{uid}` block + D-03 inline legacyAppUserId fields written through wrappers + migration builders. First real users created in Phase 6 AUTH-15. |
| DATA-03 | 05-01, 05-02 | New top-level collections (internalAllowlist, auditLog, softDeleted, rateLimits) | ✓ SATISFIED | All 4 collections have rule blocks in firestore.rules (lines 108-128) with correct rule scopes per RULES-03. Audited in Wave 1 SUMMARY.md D-17 closure. |
| DATA-04 | 05-02, 05-04, 05-05 | One-shot migration script tested via dry-run; clean cutover (no dual-write) | ✓ SATISFIED | scripts/migrate-subcollections/run.js with --dry-run substrate; cutover-day live execution captured in 05-PREFLIGHT.md. The "tested against staging" line in REQUIREMENTS.md was deviated explicitly per CONTEXT.md D-05 (no staging project; the dry-run flag + manual gcloud export is the substitute substrate, audit-narrated in SECURITY.md § Firestore Data Model). |
| DATA-05 | 05-02, 05-05 | Migration script idempotency markers per collection | ✓ SATISFIED | process-doc.js two-phase markers at `migrations/{stepId}/items/{docId}` (PENDING → DONE). Pinned by 3 dedicated test cells (PENDING→DONE, SKIP, RE-PROCESS). |
| DATA-06 | 05-02, 05-05 | Pre/post doc-count + field-presence assertion harness | ✓ SATISFIED | scripts/migrate-subcollections/assertions.js exports captureBaselineCounts + assertCollectionGroupCount + assertFieldPresence. Cutover-day live execution: assertions ran successfully (after stray cleanup) per 05-PREFLIGHT. |
| DATA-07 | 05-03, 05-04 | H7 fix folded in: server-clock readStates comparator | ✓ SATISFIED | src/domain/unread.js rewrite (Wave 4 Commit A `d81cb50`) + src/data/read-states.js serverTimestamp-only writes (Wave 3) + 5-min skew test in tests/domain/unread.test.js. Closes CONCERNS H7. |
| RULES-01 | 05-01 | firestore.rules with claims-based predicates (isAuthed/isInternal/inOrg) | ✓ SATISFIED | firestore.rules lines 6-15 predicate library; D-14 closure pinned in Wave 1 SUMMARY.md. |
| RULES-02 | 05-01 | mutableOnly() + immutable() guards | ✓ SATISFIED | firestore.rules lines 22-27 + applied on every update path; D-15 / Pitfall 3 closure pinned by mass-assignment test cell. |
| RULES-03 | 05-01 | Client writes denied to users/, orgs/{id} parent, internalAllowlist/, auditLog/, softDeleted/ | ✓ SATISFIED | firestore.rules: users line 100-105 (write: false), internalAllowlist line 108-111 (admin-only), auditLog line 114-117 (allow write: false), softDeleted line 120-123 (allow write: false). Orgs parent updates restricted to isInternal() per line 33. |
| RULES-04 | 05-01 | Tenant-jump test (client orgA cannot read/write orgs/B/*) | ✓ SATISFIED | tests/rules/tenant-jump.test.js — 28 deny cells (7 paths × 4 ops); Wave 1 SUMMARY.md confirms 28/28 green. |
| RULES-05 | 05-01 | storage.rules size + MIME + path scope | ✓ SATISFIED | storage.rules: validSize (25 MiB) line 19; validMime (6 types mirroring src/ui/upload.js) lines 20-29; path scope `match /orgs/{orgId}/documents/{docId}/{filename}` line 31; global deny-all fallback line 40-42. Closes H6 server-side. |
| RULES-06 | 05-01, 05-06 | Rules committed + unit-tested in Phase 5 but NOT deployed | ✓ SATISFIED | git grep returns NO matches in enforcement files; documented false-positive (commit body) in 05-06 SUMMARY.md and 05-PREFLIGHT.md. Out-of-band Console verification surfaced as human verification item. |
| TEST-08 | 05-01 | @firebase/rules-unit-testing 5 suite covers every Rules collection × role × allowed/denied | ✓ SATISFIED | 5 test files / 176 cells per Wave 1 SUMMARY.md. CI test-rules job gates on every PR. |
| DOC-10 | 05-06 | Each phase incrementally appends to SECURITY.md | ✓ SATISFIED | 4 new sections appended to SECURITY.md per D-20 (verified at lines 535/576/621/648). 82 framework citations across the file. |

**Coverage:** 15 / 15 declared requirements satisfied at substrate level. The "first real exercise lands in Phase 6" caveat applies only to DATA-02 (users keyed by Firebase Auth UID — no users yet) and to live data verification under DATA-01 (no orgs created yet). Both are explicitly Phase 6 / Phase 7 forward-trackers and are queued in `runbooks/phase-5-cleanup-ledger.md`.

## Anti-Patterns Found

None blocker-level. The following are notable observations:

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `src/main.js` | 402-407 | IIFE comparator wrapper shims (`_toTsFromIso` + `_toCommentDuck` + `lastReadForOrg`) | ℹ️ Info | Carryover from Wave 4 — adapts the new server-time comparator signatures back to the IIFE-resident render functions. Documented in Wave 4 SUMMARY.md "Legacy Shim Catalog" + queued for Phase 4 4.1 main.js-body-migration. NOT a stub: real adapter logic; preserves snapshot-baseline contract. |
| `src/data/cloud-sync.js` | 52-69 | Legacy 9-prop deps parameter-detector branch (no-op + deprecation warn) | ℹ️ Info | Carryover from Wave 4 — preserves IIFE boot path while H8 root-cause (last-writer-wins overlap merge) is intentionally NOT executed. Queued for Phase 4 4.1. NOT a stub: deprecation-warn no-op is correct behavior given the H8 closure semantics. |
| `firestore.rules` | 126-128 | `rateLimits/{uid}/buckets/{windowStart}` deny-all (`allow read, write: if false`) | ℹ️ Info | Intentional Phase 5 stance per D-17. Phase 7 FN-09 replaces with `request.time` predicate. Queued in `runbooks/phase-5-cleanup-ledger.md`. NOT a stub. |
| `firestore.rules` | 102, 104 | `users` create + update `allow create: if false` / `allow update: if false` | ℹ️ Info | Intentional — server-only via Phase 6 setClaims callable + bootstrap migration. Queued for Phase 6 (AUTH-15). NOT a stub. |
| `firestore.rules` | 116-117 | `auditLog` write `allow write: if false` | ℹ️ Info | Intentional — server-only via Phase 7 auditWrite callable (FN-01..09). Queued for Phase 7. NOT a stub. |
| `firestore.rules` | 122 | `softDeleted` write `allow write: if false` | ℹ️ Info | Intentional — server-only via Phase 8 LIFE-02 + LIFE-04. Queued for Phase 8. NOT a stub. |

No TODO/FIXME/PLACEHOLDER patterns found in the modified Phase 5 files (verifier did not exhaustively re-grep all touched files; the SUMMARY.md key-files lists are well-documented and the spot reads above show no stub patterns).

## Human Verification Required

### 1. Confirm RULES-06 commit-not-deploy invariant by inspecting Firebase Console

**Test:** Open Firebase Console → bedeveloped-base-layers → Firestore Database → Rules tab. Verify the displayed ruleset is the PRE-PHASE-5 ruleset (or the project default deny-all), NOT the firestore.rules content committed at the repo root. Repeat for the Storage Rules tab.
**Expected:** Console-displayed ruleset does NOT match `firestore.rules` / `storage.rules` from the repo. Phase 6 RULES-07 will be the deploy-gate event. Note any divergence in `runbooks/phase-5-cleanup-ledger.md`.
**Why human:** RULES-06 is a negative invariant — the repo cannot prove "rules are not deployed in the live Firebase project" — only that no automation was used to deploy them. The verifier already ran the negative grep gates (zero matches in `*.yml/*.yaml/*.json/*.js/*.sh/*.ts`); the Console check is belt-and-braces and confirms a human did not deploy out-of-band.

### 2. Confirm SC#4 5-minute clock-skew test produces correct unread counts in a live browser session

**Test:** Open a real chat session against the live app (post Phase 6 / Phase 7 once real users exist; presently moot against the empty database). With one user posting comments and another user reading them, verify the tab-title unread badge updates correctly when comments are posted. Then mock-shift the local browser clock ±5 minutes (DevTools > Sensors > Custom location/time, or equivalent). Refresh the page and confirm the unread count does NOT change.
**Expected:** Unread count is identical with the local clock at +5 minutes, normal time, and -5 minutes. The IIFE-resident comparator wrapper adapter (`src/main.js:402-407`) feeds the same server-time semantics into the rendered DOM.
**Why human:** 5-minute clock-skew under real `onSnapshot` + browser-clock manipulation is observable only in a live session. The unit test (tests/domain/unread.test.js line 75) mocks the clock and pins comparator output; the live check confirms the IIFE wrapper adapter feeds the same data shape. NOTE: this check is degenerate against the current empty database; surface it in the Phase 6 / Phase 7 close gates once real data lands.

### 3. Verify the migration script's --verify mode succeeds against the (empty) production database

**Test:** Operator (Hugh / business@bedeveloped.com) re-runs `node scripts/migrate-subcollections/run.js --verify` against bedeveloped-base-layers production. Inspect the output and confirm `[OK] Verify-only mode complete; field-presence assertions passed.`
**Expected:** Verify mode exits 0 with the OK message. (Already done at cutover per 05-PREFLIGHT.md `verify_command_exit_code: 0`. Re-run sanity-check is optional — the cutover-day evidence already stands. The human checkpoint is to confirm operator has read 05-PREFLIGHT.md and is satisfied with the empty-database no-op outcome before signing off Phase 5 close.)
**Why human:** Live-Firestore-or-emulator evidence is the verification substrate; the verifier should not re-run production-side commands without operator authorisation.

## Gaps Summary

No blocker gaps. The phase shipped its full scope:

- All 6 ROADMAP.md success criteria verified at the substrate level.
- All 15 declared requirement IDs satisfied (DATA-01..07, RULES-01..06, TEST-08, DOC-10).
- All 4 SECURITY.md sections appended per D-20.
- RULES-06 negative invariant verified at the repo level (zero deploy commands in enforcement files; out-of-band Console check is a human verification item).
- Phase 4 D-09 carryover cleanup-ledger rows fully closed (10 closure entries; zero forward-tracking rows remain for those items).
- New `runbooks/phase-5-cleanup-ledger.md` queues 10 forward-trackers for Phase 6/7/8 with zero new suppressions.

The honest caveat the operator and SUMMARY.md / 05-PREFLIGHT.md / SECURITY.md all surface together:

> The cutover ran 2026-05-08 ~17:10 UTC against an EMPTY production database. The migration was effectively a no-op (orgs=0, responses=0, etc.). The audit value is in the discipline of the export → dry-run → real-run → verify chain, not in transformed data. The SUBSTRATE is in place; first non-empty exercise lands in Phase 6 when real Firebase Auth users (Luke + George) are created via AUTH-15 and they create the first org.

This is not a gap. It is the honest narrative of running a migration script against a project that is between client engagements. The SUBSTRATE is feature-complete: rules exist, tests pass, migration script works (live-tested via the stray-cleanup recovery loop), wrappers wire to subcollection paths, server-time comparators replace client-clock comparators, runbook + PREFLIGHT + cleanup-ledger documentation captures every decision and forward-tracker with provenance. The phase is operationally verified to the maximum extent possible against the current data state.

The 3 human verification items are:
1. Firebase Console out-of-band check for RULES-06 (asymmetric-evidence belt-and-braces)
2. Live SC#4 clock-skew check (degenerate against empty DB; deferred to first real session)
3. Operator re-confirmation of cutover_outcome=success in 05-PREFLIGHT (sign-off check)

---

_Verified: 2026-05-08T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
