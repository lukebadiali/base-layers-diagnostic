---
phase: 08
plan: 03
subsystem: lifecycle
tags: [soft-delete, gdpr, cloud-functions, firestore-rules, admin-ui, LIFE-01, LIFE-02, LIFE-03, LIFE-04, LIFE-05, LIFE-06, DOC-10, BACKUP-05]
dependency_graph:
  requires: [08-02]
  provides: [softDelete, restoreSoftDeleted, scheduledPurge, permanentlyDeleteSoftDeleted, listSoftDeleted, admin-recently-deleted-ui]
  affects:
    - functions/src/lifecycle/
    - functions/src/index.ts
    - firestore.rules
    - src/data/
    - src/cloud/soft-delete.js
    - src/views/admin.js
    - src/main.js
tech_stack:
  added:
    - "FieldValue.serverTimestamp() for deletedAt/restoredAt (server-side only)"
    - "Firestore batch writes (atomic tombstone + snapshot / restore + cleanup)"
    - "onSchedule Gen2 cron (daily 03:00 UTC) with startAfter pagination"
    - "crypto.randomUUID() clientReqId idempotency for admin callables"
  patterns:
    - "Pattern A callable: enforceAppCheck + Zod + withSentry + ensureIdempotent + Pitfall 17 actor-from-token"
    - "Pitfall G atomicity: live-doc tombstone + softDeleted snapshot in single batch"
    - "Pitfall B pagination: 500-doc PAGE_SIZE limit + startAfter loop avoids 9-min timeout"
    - "Pitfall A rules-not-filters: where(deletedAt==null) added to every list/subscribe client query"
    - "Pattern D DI factory: createAdminView(deps={}) allows test injection without adapter changes"
    - "Single-load callable pattern in unit tests: load module once, seed after, no vi.resetModules"
key_files:
  created:
    - functions/src/lifecycle/resolveDocRef.ts
    - functions/src/lifecycle/softDelete.ts
    - functions/src/lifecycle/restoreSoftDeleted.ts
    - functions/src/lifecycle/scheduledPurge.ts
    - functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts
    - functions/test/lifecycle/resolveDocRef.unit.test.ts
    - functions/test/lifecycle/softDelete.unit.test.ts
    - functions/test/lifecycle/restoreSoftDeleted.unit.test.ts
    - functions/test/lifecycle/scheduledPurge.unit.test.ts
    - functions/test/lifecycle/permanentlyDeleteSoftDeleted.unit.test.ts
    - functions/test/integration/softDelete.integration.test.ts
    - functions/test/integration/restoreSoftDeleted.integration.test.ts
    - functions/test/integration/permanentlyDeleteSoftDeleted.integration.test.ts
    - src/data/soft-deleted.js
    - tests/data/soft-deleted.test.js
    - tests/rules/soft-delete-predicate.test.js (rewritten — 5 new describe blocks)
  modified:
    - functions/src/index.ts (11 → 15 exports)
    - functions/test/_mocks/admin-sdk.ts (batch + buildQuery with orderBy/startAfter)
    - firestore.rules (5 new notDeleted conjuncts; total 6)
    - src/data/messages.js
    - src/data/comments.js
    - src/data/actions.js
    - src/data/documents.js
    - src/data/funnel-comments.js
    - src/cloud/soft-delete.js (stub → real httpsCallable wrappers)
    - src/views/admin.js (stub → LIFE-06 functional Recently Deleted UI)
    - src/main.js (getDownloadURL sweep: removed call + dynamic import of signed-url)
    - tests/mocks/firebase.js (null-equals-undefined fix for deletedAt queries)
    - tests/data/documents.test.js (saveDocument test: removed downloadURL assertions)
    - tests/cloud/soft-delete.test.js (rewritten for real implementation)
decisions:
  - "resolveDocRef.ts is the single-source-of-truth for SOFT_DELETABLE_TYPES (5 types: comment, message, action, document, funnelComment)"
  - "permanentlyDeleteSoftDeleted.ts created in Task 5 (not Task 8) to unblock index.ts compile and test suite"
  - "src/data/soft-deleted.js created in Task 7 (not Task 8) to unblock admin.js import and admin.test.js"
  - "retryCount:1 flat (not nested retryConfig) for scheduledPurge — matches firebase-functions 7.2.5 ScheduleOptions type"
  - "src/cloud/soft-delete.js uses adapter import (../firebase/functions.js) not direct firebase/functions — ESLint no-restricted-imports D-04"
  - "Single-load callable pattern in unit tests: callable loaded once at module level; seed AFTER load; no vi.resetModules per test"
  - "tests/mocks/firebase.js: where(deletedAt==null) — undefined treated as null to match Firestore semantics for absent field"
  - "saveDocument drops downloadURL from payload; returns {id} only; main.js dynamic-imports signed-url callable on click"
metrics:
  duration_minutes: 185
  tasks_completed: 8
  files_changed: 30
  insertions: 2029
  deletions: 209
  functions_test_count_before: 151
  functions_test_count_after: 189
  root_test_count_before: 440
  root_test_count_after: 445
  completed_date: "2026-05-10"
---

# Phase 8 Plan 03: Soft-Delete Lifecycle Summary

**One-liner:** Four Pattern-A lifecycle Cloud Functions (softDelete, restoreSoftDeleted, scheduledPurge, permanentlyDeleteSoftDeleted) with Firestore batch atomicity, paginated purge, 5-collection notDeleted rules conjuncts, client data wrapper updates, and a functional admin Recently Deleted UI — closing LIFE-01 through LIFE-06.

---

## What Was Built

### Task 1 — resolveDocRef + softDelete + restoreSoftDeleted (LIFE-01 / LIFE-02)

`functions/src/lifecycle/resolveDocRef.ts` (35 lines) — pure helper mapping `{type, orgId, id}` to live DocumentReference paths and `softDeleted/{type}/items/{id}` snapshot paths. Single source of truth for `SOFT_DELETABLE_TYPES`.

`functions/src/lifecycle/softDelete.ts` (92 lines) — Pattern A admin-only callable. Reads live doc, checks `deletedAt != null` (already soft-deleted → `failed-precondition`), then batch-writes: `update(liveRef, {deletedAt, deletedBy})` + `set(snapRef, {…doc, originalPath, originalOrgId})` atomically (Pitfall G).

`functions/src/lifecycle/restoreSoftDeleted.ts` (80 lines) — Pattern A admin-only callable. Reads snapshot (`not-found` if absent), then batch-writes: `update(liveRef, {deletedAt: null, deletedBy: null, restoredAt, restoredBy})` + `delete(snapRef)` atomically.

17 unit tests across resolveDocRef, softDelete, and restoreSoftDeleted; 3 integration tests for softDelete + 3 for restoreSoftDeleted.

### Task 2 — scheduledPurge (LIFE-05)

`functions/src/lifecycle/scheduledPurge.ts` (62 lines) — `onSchedule("0 3 * * *")`, RETENTION_DAYS=30, PAGE_SIZE=500. Pagination loop: `where("deletedAt", "<", cutoff).orderBy("deletedAt").limit(500)` → hard-deletes each doc → `startAfter(lastDoc)` until `snap.docs.length < PAGE_SIZE` (Pitfall B). Covers all 5 types in sequence. `retryCount: 1` (flat, not nested).

5 unit tests including a 1200-doc fake-timer pagination test.

### Task 3 — firestore.rules + 15 rules test cells (LIFE-03)

Added `notDeleted(resource.data)` conjunct to `allow read` on 5 paths: comments, actions, documents, messages (subcollections under orgs), and funnelComments (top-level). Total `notDeleted` count in rules: 6 (1 from Phase 5, 5 new). Soft-deleted items are invisible to client list queries.

15 new rules test assertions (5 types × allow-live + deny-deleted + deny-no-auth pattern).

### Task 4 — 5 data wrapper updates + getDownloadURL drop from documents.js (LIFE-03 / BACKUP-05)

Added `where("deletedAt", "==", null)` to all list/subscribe queries on soft-deletable collections (Pitfall A — rules are not filters):

- `src/data/messages.js` — `listMessages` + `subscribeMessages`
- `src/data/comments.js` — `listComments`
- `src/data/actions.js` — `listActions`
- `src/data/documents.js` — `listDocuments`; also dropped `getDownloadURL` import and call; `saveDocument` returns `{id}` only
- `src/data/funnel-comments.js` — `listFunnelComments` + `subscribeFunnelComments`

Auto-fixed `tests/mocks/firebase.js`: `where("deletedAt", "==", null)` was false-negative when docs lacked the field (`v === undefined`). Fixed by treating `undefined` as `null` for Firestore absent-field semantics. Auto-fixed `tests/data/documents.test.js`: removed `downloadURL` assertions from `saveDocument` test.

### Task 5 — permanentlyDeleteSoftDeleted callable (LIFE-06 component)

`functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts` (76 lines) — Pattern A admin-only callable. Zod: `{type, id, clientReqId}` (no `orgId` — purges from `softDeleted/` not live collection). Reads snapshot, verifies exists (`not-found` if absent), idempotency check, then `ref.delete()`. Created in Task 5 to unblock `functions/src/index.ts` compile and test suite.

### Task 6 — index.ts wiring + integration tests

`functions/src/index.ts` now exports 15 Cloud Functions (was 11). Added 4 lifecycle exports: `softDelete`, `restoreSoftDeleted`, `scheduledPurge`, `permanentlyDeleteSoftDeleted`.

5 integration tests for softDelete + restoreSoftDeleted (round-trip: seed → call → verify doc state).

### Task 7 — src/cloud/soft-delete.js fill + admin.js LIFE-06 UI

`src/cloud/soft-delete.js` (50 lines) — Phase 4 stub replaced with real `httpsCallable` wrappers. Each function generates `clientReqId = crypto.randomUUID()` and calls the respective callable via `import { functions, httpsCallable } from "../firebase/functions.js"` (adapter pattern, ESLint D-04 compliant).

`src/views/admin.js` (145 lines) — Phase 4 stub replaced with functional LIFE-06 Recently Deleted UI. Pattern D DI factory: `createAdminView(deps={})` accepts optional overrides for testability. Renders table (Type / ID / Deleted At / Actions) from `listSoftDeleted()`. Restore button calls `restoreSoftDeleted({type, orgId, id})`; "Permanently delete now" button shows `window.confirm()` guard then calls `permanentlyDeleteSoftDeleted({type, id})`. Errors displayed inline.

`src/data/soft-deleted.js` created here (rather than Task 8) to unblock admin.js import.

`src/main.js` getDownloadURL sweep: removed `storageOps.getDownloadURL(r)` call from upload handler; changed Download anchor to a `<button>` that dynamic-imports `./cloud/signed-url.js` on click and calls `getDocumentSignedUrl(orgId, docId, filename)`.

Auto-fixed `tests/cloud/soft-delete.test.js`: old Phase 4 stub tests expected `resolves.toBeUndefined()` but real wrappers throw `FirebaseError: internal` without a Firebase app. Rewrote to mock `../../src/firebase/functions.js` and verify `{ok: true}` return.

### Task 8 — permanentlyDeleteSoftDeleted tests + soft-deleted.js browser tests

`functions/test/lifecycle/permanentlyDeleteSoftDeleted.unit.test.ts` — 6 tests: permission-denied (non-admin), unauthenticated, invalid-argument (missing type), happy path (seeds + calls + verifies gone), not-found, idempotency (`already-exists` on same clientReqId within 5 min).

`functions/test/integration/permanentlyDeleteSoftDeleted.integration.test.ts` — 1 round-trip test: seeds `softDeleted/message/items/m_int`, calls `permanentlyDeleteSoftDeleted`, verifies doc is gone.

`tests/data/soft-deleted.test.js` — 3 tests: empty collections → `[]`; merged entries across 2 of 5 types with correct shape; `orgId` falls back to `null` when `originalOrgId` absent.

---

## Test Count Delta

| Suite | Before 08-03 | After 08-03 | Delta |
|-------|-------------|-------------|-------|
| functions (vitest) | 151 | 189 | +38 |
| root (vitest) | 440 | 445 | +5 |
| **Total** | **591** | **634** | **+43** |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] tests/mocks/firebase.js: where(deletedAt==null) false-negative**
- **Found during:** Task 4
- **Issue:** `v === null` failed when seeded docs lacked `deletedAt` field (`v === undefined`). Client data wrapper tests failed after adding `where("deletedAt", "==", null)` filter.
- **Fix:** Added `if (value === null) return v === null || v === undefined;` branch in `rowsForRef` filter.
- **Files modified:** `tests/mocks/firebase.js`
- **Commit:** `1bebb8f`

**2. [Rule 1 - Bug] tests/data/documents.test.js: downloadURL assertion on removed field**
- **Found during:** Task 4
- **Issue:** `saveDocument` test asserted `result.downloadURL` after the function was changed to return `{id}` only.
- **Fix:** Removed `downloadURL` assertion; added `expect(Object.keys(result)).toEqual(["id"])`.
- **Files modified:** `tests/data/documents.test.js`
- **Commit:** `1bebb8f`

**3. [Rule 1 - Bug] tests/cloud/soft-delete.test.js: Phase 4 stub expectations**
- **Found during:** Task 7
- **Issue:** Old tests expected `resolves.toBeUndefined()` but real callable wrappers throw `FirebaseError: internal` (no Firebase app in test env).
- **Fix:** Rewrote test file to mock `../../src/firebase/functions.js` with `httpsCallable` stub returning `{data: {ok: true}}`; verified all 3 functions + 3 call shapes.
- **Files modified:** `tests/cloud/soft-delete.test.js`
- **Commit:** `464ba77`

**4. [Rule 2 - Missing functionality] src/data/soft-deleted.js created in Task 7 (not Task 8)**
- **Found during:** Task 7
- **Issue:** `src/views/admin.js` imports `src/data/soft-deleted.js`; the import caused `admin.test.js` to fail the module resolver before Task 8 ran.
- **Fix:** Created `src/data/soft-deleted.js` during Task 7.
- **Files modified:** `src/data/soft-deleted.js`
- **Commit:** `5c6b02c`

**5. [Rule 2 - Missing functionality] permanentlyDeleteSoftDeleted.ts created in Task 5 (not Task 8)**
- **Found during:** Task 5
- **Issue:** `functions/src/index.ts` exports `permanentlyDeleteSoftDeleted`; TypeScript build and test suite require it to compile.
- **Fix:** Created `functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts` during Task 5.
- **Files modified:** `functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts`
- **Commit:** `3a3b058` (wiring commit)

---

## Known Stubs

None. All admin UI features are wired to real data sources and Cloud Functions callables. `src/views/admin.js` loads live data via `listSoftDeleted()` and dispatches real `restoreSoftDeleted` / `permanentlyDeleteSoftDeleted` callables.

---

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: privilege-escalation-surface | functions/src/lifecycle/softDelete.ts | Admin-only callable that permanently modifies live docs — covered by `isAdmin(request.auth)` check and Pitfall 17 actor-from-token pattern |
| threat_flag: data-destruction | functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts | Hard-deletes a softDeleted record; no recovery path — gated by admin-only + idempotency key + `window.confirm()` in UI; already in plan threat model |

Both flags were explicitly in the plan threat model and mitigated. No net-new unaddressed surface.

---

## Self-Check

### Created files exist
- `functions/src/lifecycle/resolveDocRef.ts` — exists (35 lines)
- `functions/src/lifecycle/softDelete.ts` — exists (92 lines)
- `functions/src/lifecycle/restoreSoftDeleted.ts` — exists (80 lines)
- `functions/src/lifecycle/scheduledPurge.ts` — exists (62 lines)
- `functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts` — exists (76 lines)
- `src/data/soft-deleted.js` — exists (47 lines)
- `src/cloud/soft-delete.js` — exists (50 lines, real implementation)
- `src/views/admin.js` — exists (145 lines, functional UI)

### Commits exist
- `2ada963` feat(08-03): resolveDocRef + softDelete + restoreSoftDeleted
- `9eb0b13` feat(08-03): scheduledPurge CF
- `b4b07f8` feat(08-03): firestore.rules notDeleted predicate
- `eca9bf0` fix(08-03): ESLint unused import
- `1bebb8f` feat(08-03): 5 data wrapper updates + getDownloadURL drop
- `3a3b058` feat(08-03): index.ts exports + integration tests
- `b389a53` feat(08-03): soft-delete.js real wrappers
- `c41d37d` fix(08-03): adapter import fix
- `5c6b02c` feat(08-03): getDownloadURL sweep + admin UI + soft-deleted.js
- `464ba77` fix(08-03): eslint unused param
- `4d9616e` feat(08-03): permanentlyDeleteSoftDeleted + soft-deleted browser tests

## Self-Check: PASSED
