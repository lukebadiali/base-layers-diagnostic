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
