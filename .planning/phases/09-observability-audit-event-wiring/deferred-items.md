# Phase 9 — Deferred Items

Discovered out-of-scope issues (pre-existing, NOT caused by Phase 9 plans). Tracked here per the executor scope-boundary rule.

## 2026-05-10 — Discovered during 09-01 Task 1

**`functions/` ESLint pre-existing errors (6 errors):**

- `functions/src/backup/scheduledFirestoreExport.ts:32:10` — `'_event' is defined but never used` (Phase 8 plan 02)
- `functions/src/gdpr/gdprEraseUser.ts:126:28, 130:36` — `'FirebaseFirestore' is not defined` (Phase 8 plan 05; missing global declaration)
- `functions/src/gdpr/gdprExportUser.ts:133:13, 139:17` — `'FirebaseFirestore' is not defined` (Phase 8 plan 04; same root cause)
- `functions/src/lifecycle/scheduledPurge.ts:30:10` — `'_event' is defined but never used` (Phase 8 plan 03)

**Root cause for the 4 `FirebaseFirestore` errors:** the `firebase-admin/firestore` namespace `FirebaseFirestore` is referenced as a type but ESLint can't resolve it without a `globals.d.ts` declaration or an `@types/firebase-admin` style import. These ship with files written before Phase 9 and are unrelated to the OBS-01 substrate.

**Root cause for the 2 `_event` errors:** ESLint's `@typescript-eslint/no-unused-vars` does not honour the leading-underscore convention by default; would need an `argsIgnorePattern: "^_"` rule update.

**Disposition:** these are Phase 8 follow-ups. Phase 9 plans 09-01 through 09-06 do NOT touch any of those files; treating them as out-of-scope. Phase 8 cleanup-ledger should pick these up, OR the Phase 9 close-gate (Plan 06) opens a sweep.

## 2026-05-10 — Discovered during 09-01 Task 2

**Root `tsc --noEmit` pre-existing errors (~16 errors):**

- `src/views/admin.js:80, 100, 105, 116-121, 124, 129` — `Property 'message' does not exist on type '{}'` and `Type 'string' is not assignable to type ...` and `Argument of type 'null' is not assignable ...`. All Phase 8 LIFE-06 admin UI wiring; predates Phase 9.
- `tests/data/soft-deleted.test.js:22, 72-80, 98` — `Parameter 'path' implicitly has an 'any' type` and `comment/message/doc is possibly 'undefined'`. Phase 8 plan 03 test file; predates Phase 9.

**Verified pre-existing:** `git stash && npm run typecheck` reproduces the same errors on the pre-Plan-09-01 working tree. Confirmed by stashing my Plan 09-01 changes and running typecheck against the bare branch tip.

**Disposition:** Phase 8 cleanup-ledger row needed. Phase 9 plans intentionally do NOT touch admin.js or soft-deleted.test.js. The Plan 09-01 Task 4 verify command (`npm run lint && npm run typecheck`) will exit non-zero on these pre-existing failures — the plan's Task 4 done-criteria implicitly assumed a clean baseline. We document this honestly in SUMMARY.md instead of forcing a Phase 8 cleanup mid-Phase-9.

## 2026-05-10 — Discovered during 09-01 Task 3

**`functions/` `tsc --noEmit` pre-existing errors (5 errors in `node_modules`):**

- `node_modules/@google-cloud/firestore/types/firestore.d.ts:21, 512, 2558` — duplicate identifier definitions + duplicate index signatures.
- `node_modules/firebase-admin/node_modules/@google-cloud/firestore/types/firestore.d.ts:24, 470, 2605` — same conflict at the nested copy.

**Root cause:** firebase-admin@13.9.0 bundles its own copy of `@google-cloud/firestore` as a nested dep, conflicting with the top-level pin at `@google-cloud/firestore@8.5.0`. The two .d.ts files both declare the same identifiers in the global `FirebaseFirestore` namespace.

**Verified pre-existing:** `git stash && cd functions && npm run typecheck` reproduces the same 5 errors. None caused by Phase 9 plan 09-01 changes.

**Disposition:** dependency-tier issue. Resolution likely requires `overrides` in `functions/package.json` to dedupe `@google-cloud/firestore`, OR pinning firebase-admin to a version whose nested dep matches the top-level pin. Out of scope for Phase 9 substrate work; tracking for Phase 10/11 dependency cleanup.

## 2026-05-10 — Discovered during 09-01 Task 4

**Root view-snapshot test pre-existing flakes (3 hook timeouts):**

- `tests/views/dashboard.test.js > Dashboard view (TEST-10) > matches the dashboard snapshot` — `Hook timed out in 10000ms` in `beforeEach`.
- `tests/views/diagnostic.test.js > Diagnostic view (TEST-10) > matches the diagnostic snapshot` — same shape.
- `tests/views/report.test.js > Report view (TEST-10) > matches the report snapshot` — same shape.

**Root cause:** the snapshot tests `await import("../../src/main.js")` after `vi.resetModules()`; main.js bootstraps the IIFE which has been growing since Phase 4 sub-wave 4.1 (~5,000 lines). Hook timeout at 10s is no longer enough headroom for the boot path on a Windows CI runner.

**Verified pre-existing:** `git stash && npm test -- --run tests/views/dashboard.test.js` reproduces the same timeout on the pre-Plan-09-01 working tree (15.08s with my Phase 9 changes stashed; 16.41s with them applied — same failure mode, similar magnitude). Phase 9 Plan 09-01 Task 4 (Sentry boot wiring) adds ~1.5s on top of the boot, but the test was already over the 10s hook budget BEFORE Phase 9 touched main.js.

**Disposition:** Phase 4 sub-wave 4.1 cleanup-ledger row already tracks the IIFE-body-migration debt that drives this. Two remediation paths:

1. Raise `hookTimeout: 30000` in vitest.config.js for the views/ directory (cheap; restores green).
2. Migrate IIFE body into views/* so the boot path shrinks (load-bearing fix; tracked by Phase 4 sub-wave 4.1).

Path 1 is the recommended Phase-9-close-gate action — Plan 09-06 should add the `hookTimeout: 30000` config. Out of scope for Plan 09-01 substrate, but flagging for Plan 09-06 cleanup.

## 2026-05-10 — Discovered during 09-03a Task 1

**Full-suite test pollution flakes (5 integration test failures):**

When running `cd functions && npm test -- --run` (full suite), 5 tests intermittently fail. Each one passes deterministically when run in isolation:

- `test/backup/getDocumentSignedUrl.unit.test.ts > Test 1: unauthenticated request throws HttpsError('unauthenticated')`
- `test/integration/auditWrite.integration.test.ts > happy path: writes auditLog/{eventId} and returns {ok:true, eventId:<uuid>}`
- `test/integration/checkRateLimit.integration.test.ts > happy path: count under limit returns {ok:true, count:1, limit:30} on first call`
- `test/integration/getDocumentSignedUrl.integration.test.ts > Test 1 (happy path admin): returns signed URL + expiresAt`
- `test/integration/setClaims.integration.test.ts > happy path: admin caller sets claims + writes _pokes doc + returns {ok:true}`

**Root cause:** Phase 8 Plan 02 already documented this — vitest test-file isolation in the `forks` pool is best-effort; the in-memory admin-sdk mock state is shared at the module level (intentional, per `_mocks/admin-sdk.ts:36`). When ~40 test files run in parallel, occasional state-bleed between integration tests causes flakes. Plan 02 added `pool:forks + maxForks:4 + testTimeout:15000` which reduced but did not eliminate the flake rate.

**Verified pre-existing:** `git stash && cd functions && npm test -- --run` reproduces 5 of the same failures on the pre-Plan-09-03a working tree. None are caused by Plan 09-03a's enum-extension change (which is purely additive — adds 33 string literals to the `auditEventType` Zod enum). All 5 tests pass when run isolated post-Plan-09-03a.

**Disposition:** Phase 9 substrate plans intentionally do not touch the test infrastructure or the admin-sdk mock. Resolution is a vitest config refactor (per-file fork isolation, or fully reset module state in afterEach) — out of scope for the audit-event substrate work. Tracking for Plan 09-06 cleanup-ledger close-gate sweep.
