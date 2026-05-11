---
phase: 08-data-lifecycle-soft-delete-gdpr-backups
fixed: 2026-05-10
fixes_applied: 5
fixes_deferred: 2
---

# Phase 8: Code Review Fix Report

**Fixed:** 2026-05-10
**Source review:** `.planning/phases/08-data-lifecycle-soft-delete-gdpr-backups/08-REVIEW.md`

**Summary:**
- Findings in scope: HIGH (2) + MEDIUM (2) + LOW (3 — 1 trivial fixed, 2 deferred)
- Fixed: 5 (H-01, H-02, M-01, M-02, L-02)
- Deferred: 2 (L-01, L-03)

---

## Fixed Issues

### H-01: `resolveDocRef.ts` — `"org"` replaced with `"action"` in SOFT_DELETABLE_TYPES

**Files modified:**
- `functions/src/lifecycle/resolveDocRef.ts`
- `functions/test/lifecycle/resolveDocRef.unit.test.ts`
- `src/data/soft-deleted.js`
- `src/cloud/soft-delete.js`

**Commit:** `e4d5177`

**Applied fix:**
- Changed `SoftDeletableType` union and `SOFT_DELETABLE_TYPES` array from `["org", ...]` to `["action", ...]`.
- Replaced the `case "org": return \`orgs/${input.id}\`` switch arm with `case "action": return \`orgs/${input.orgId}/actions/${input.id}\`` (correct subcollection path with orgId, not just id).
- Updated the JS-side enum in `src/data/soft-deleted.js` (admin UI list) and JSDoc type annotations in `src/cloud/soft-delete.js`.
- Updated `resolveDocRef.unit.test.ts`: replaced the `"org"` path test with an `"action"` path test, replaced the `resolveSnapshotPath` `"org"` assertion with `"action"`, and added a regression-pin test that asserts `SOFT_DELETABLE_TYPES` contains exactly the 5 correct types and does NOT contain `"org"`.
- Also updated `functions/test/lifecycle/scheduledPurge.unit.test.ts` (committed separately) — the 5-type iteration test used the old `"org"` literal.

---

### H-02: `scripts/post-erasure-audit/run.js` — audit-log check inverted pass/fail corrected

**Files modified:**
- `scripts/post-erasure-audit/run.js`

**Commit:** `e5aa1b7`

**Applied fix:**
- The `if (untombstoned.length === 0)` branch (meaning all matched docs ARE tombstoned — erasure succeeded) was emitting `FAIL` with a copy-paste of the else branch. Both branches were identical FAIL output.
- Fixed: `length === 0` branch now emits `PASS` with `"${snap.size} docs tombstoned correctly"`.
- `else` branch now emits `FAIL` with accurate count: `"${untombstoned.length} of ${snap.size} docs still reference raw uid"` and only increments `failures` / clears `allPass` in the failure branch.
- Updated comment above the block to correctly describe the semantics.

---

### M-01: `gdprEraseUser.ts` — tombstone token removed from callable response body

**Files modified:**
- `functions/src/gdpr/gdprEraseUser.ts`
- `src/cloud/gdpr.js`
- `functions/test/gdpr/gdprEraseUser.unit.test.ts`

**Commit:** `7b5841a`

**Applied fix:**
- Changed `return { ok: true, tombstoneToken: tombstone, counts }` to `return { ok: true, counts }`. Token is already recorded in `redactionList/{userId}` (admin-only read) and in the `compliance.erase.user` audit event payload — callers have no operational need for it.
- Updated `src/cloud/gdpr.js` JSDoc return type from `{ ok: true, tombstoneToken: string, counts: ... }` to `{ ok: true, counts: ... }`.
- Updated all unit test assertions that previously read `result.tombstoneToken` to instead read the token from `adminMockState._readDoc("redactionList/...")?.tombstoneToken`. Added assertion that `result.tombstoneToken` is `undefined`. Updated Test 5 (idempotency) to derive both tokens from `redactionList` after each call.
- Also fixed `functions/test/integration/gdprEraseUser.integration.test.ts` (committed with the cascading test fix) for the same pattern.

---

### M-02: `gdprEraseUser.ts` / `gdprExportUser.ts` — `legacyAuthorId` queries added for messages and comments

**Files modified:**
- `functions/src/gdpr/gdprEraseUser.ts`
- `functions/src/gdpr/gdprExportUser.ts`

**Commit:** `eb30640`

**Applied fix:**
- Added parallel `collectionGroup("messages").where("legacyAuthorId", "==", userId)` and `collectionGroup("comments").where("legacyAuthorId", "==", userId)` queries in both `gdprEraseUser` and `gdprExportUser` alongside the existing `authorId` queries.
- Added a `mergeByPath` (erase) / `mergeEntries` (export) de-duplication helper that merges results from both snaps by Firestore path, ensuring records that appear in both queries (because they have both `authorId` and `legacyAuthorId` set to the same uid) are not double-processed.
- Updated `buildCascadeOps` inputs to pass the merged `allMessages` / `allComments` arrays instead of the single-snap results.
- Updated `counts.messages` and `counts.comments` in the `compliance.erase.user` audit event to use `allMessages.length` / `allComments.length` (merged de-duped counts) rather than the single-snap `.size`.
- `gdprExportUser`: updated `queryResults.comments` and `queryResults.messages` to use `mergeEntries(commentsSnap, commentsLegacySnap)` / `mergeEntries(messagesSnap, messagesLegacySnap)`.

---

### L-02: `src/cloud/gdpr.js` — duplicate import merged

**Files modified:**
- `src/cloud/gdpr.js`

**Commit:** `601fe85`

**Applied fix:**
- Merged two separate `import` statements from `../firebase/functions.js` into one:
  ```js
  import { httpsCallable, functions } from "../firebase/functions.js";
  ```

---

## Deferred Issues

### L-01: `restoreSoftDeleted.ts` — live-doc existence not checked before batch.update

**File:** `functions/src/lifecycle/restoreSoftDeleted.ts:56-69`

**Rationale:** Non-trivial edge-case guard (requires an extra Firestore read per restore call). The risk is low: this only triggers if a live doc was hard-deleted after it was soft-deleted — an unlikely sequence given the admin-only lifecycle callables and the absence of live users. Deferred to a follow-up hardening pass. The fix suggestion in REVIEW.md is clear and can be applied directly when prioritised.

---

### L-03: `src/views/admin.js` — `window.confirm()` for destructive-action guard

**File:** `src/views/admin.js:93-97`

**Rationale:** The use of `window.confirm()` for the "Permanently delete now" button was an explicit Phase 8 plan decision (MVP approach, noted in the plan as intentional). The REVIEW.md finding acknowledges this: "The plan explicitly chose `window.confirm()` for this guard as an MVP approach." Replacing it with the `modal.js` confirmation pattern is a Phase 10/UI-polish task and is not a compliance blocker. No change made; rationale documented here.

---

## Test Results

Full suite after all fixes: **40/40 test files, 234/234 tests passing.**

Cascading test files also updated (committed with the relevant fix commit or the follow-on test-fix commit `b03ffda`):
- `functions/test/lifecycle/scheduledPurge.unit.test.ts` — replaced `"org"` with `"action"` in 5-type iteration assertion (H-01 cascade).
- `functions/test/integration/gdprEraseUser.integration.test.ts` — removed `tombstoneToken` from result type; read token from `redactionList` (M-01 cascade).

---

_Fixed: 2026-05-10_
_Fixer: Claude (gsd-code-fixer)_
