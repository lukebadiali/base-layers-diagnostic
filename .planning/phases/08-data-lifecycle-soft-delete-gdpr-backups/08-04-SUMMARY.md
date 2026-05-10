---
phase: 08
plan: "04"
subsystem: gdpr
tags: [gdpr, cloud-functions, firestore, gcs, signed-url, audit-log, GDPR-01, DOC-10]
dependency_graph:
  requires: [08-03]
  provides: [gdprExportUser, assembleUserBundle, src/cloud/gdpr.js#exportUser]
  affects:
    - functions/src/gdpr/
    - functions/src/index.ts
    - functions/test/_mocks/admin-sdk.ts
    - src/cloud/gdpr.js
tech_stack:
  added:
    - "collectionGroup() factory in admin-sdk.ts mock (path-segment matching for subcollection group queries)"
    - "node:crypto randomUUID() for clientReqId in browser seam (no new npm dep)"
  patterns:
    - "Pattern A callable: enforceAppCheck + Zod + withSentry + ensureIdempotent + Pitfall 17 actor-from-token"
    - "Pattern C purity: assembleUserBundle.ts has zero firebase-admin imports (testable without Admin SDK)"
    - "Single-load callable pattern in unit tests: module loaded once at module level; seed AFTER load; no vi.resetModules per test"
    - "collectionGroup query per DOCUMENT_AUTHOR_FIELDS entry (3 fields × 2 collection paths = 6 document queries)"
key_files:
  created:
    - functions/src/gdpr/assembleUserBundle.ts  (113 lines)
    - functions/src/gdpr/gdprExportUser.ts      (224 lines)
    - functions/test/gdpr/assembleUserBundle.unit.test.ts       (150 lines)
    - functions/test/gdpr/gdprExportUser.unit.test.ts           (268 lines)
    - functions/test/integration/gdprExportUser.integration.test.ts (178 lines)
    - .planning/phases/08-data-lifecycle-soft-delete-gdpr-backups/08-04-FIELD-AUDIT-NOTES.md
  modified:
    - functions/src/index.ts (15 → 16 exports)
    - functions/test/_mocks/admin-sdk.ts (added collectionGroup factory + buildCollectionGroupQuery)
    - src/cloud/gdpr.js (exportUser stub → real httpsCallable wrapper; eraseUser stub preserved)
decisions:
  - "DOCUMENT_AUTHOR_FIELDS = [uploaderId, uploadedBy, legacyAppUserId] — all three confirmed by Task 0 grep (Assumption A1 closed)"
  - "collectionGroup() added to getFirestoreMock() — path-segment matching on second-to-last segment (mirrors Firestore semantics)"
  - "Single-load callable pattern for unit tests (no vi.resetModules) — required so callable's mock instances match assertion-side instances"
  - "Legacy top-level documents/ collection queried separately in addition to collectionGroup('documents') subcollection — covers pre-Phase-5 main.js writes"
  - "src/cloud/gdpr.js imports from ../firebase/functions.js adapter (D-04 ESLint no-restricted-imports compliance)"
metrics:
  duration_minutes: 18
  tasks_completed: 4
  files_changed: 8
  functions_test_count_before: 189
  functions_test_count_after: 205
  root_test_count_before: 445
  root_test_count_after: 445
  completed_date: "2026-05-10"
---

# Phase 8 Plan 04: GDPR Export (gdprExportUser) Summary

**One-liner:** Admin-only gdprExportUser callable assembles all user-linked data across 8+ Firestore collection paths into a versioned JSON bundle uploaded to GCS, returns a V4 signed URL with 24h TTL — closing GDPR-01 with full audit trail and Pattern C pure helper for fast unit testing.

---

## What Was Built

### Task 0 — Documents-Collection Field Audit (Assumption A1 Closure)

`08-04-FIELD-AUDIT-NOTES.md` created from empirical grep findings. Discovered:

- `uploaderId` — exclusive to top-level `documents/{docId}` (legacy `src/main.js` path, line 3363)
- `legacyAppUserId` — exclusive to subcollection `orgs/{orgId}/documents/{docId}` (D-03 invariant, `src/data/documents.js` line 76, derived from `meta?.uploadedBy`)
- `uploadedBy` — defensive inclusion (may appear in meta spread or historic pre-D-03 docs)

**Assumption A1 corrected:** A1 claimed `uploaderId` for the subcollection — verified to be incorrect. The subcollection uses `legacyAppUserId`. Both collection paths must be queried independently.

### Task 1 — `assembleUserBundle.ts` Pure Helper (Pattern C)

`functions/src/gdpr/assembleUserBundle.ts` (113 lines):
- Zero firebase-admin imports — Pattern C purity verified by `grep -E "^import" | grep -v "node:"` → 0
- Exports `BUNDLE_SCHEMA_VERSION = 1`, `DOCUMENT_AUTHOR_FIELDS`, `QueryResults` interface, `UserBundle` interface, `assembleUserBundle(userId, results, nowMs)` pure function
- De-duplication of documents by path (multi-field query overlap: same doc can match uploaderId + legacyAppUserId queries)
- Defensive re-filter of audit events by `actor.uid === userId` (T-08-04-06)
- `assembledAt` is an ISO 8601 string (no Firestore Timestamp objects survive — JSON-roundtrip safe)

`functions/test/gdpr/assembleUserBundle.unit.test.ts` (150 lines) — 6 unit tests, all pass:
1. Empty inputs → skeleton bundle with correct schema version and empty arrays
2. Profile + 2 messages + 1 comment map correctly into bundle
3. Audit events filtered to `actor.uid === userId` only (mixed events, null actor)
4. Documents de-duplicated by path (same doc appears in 2 field queries → 1 bundle entry)
5. JSON roundtrip: `JSON.parse(JSON.stringify(bundle))` deep-equals original
6. `DOCUMENT_AUTHOR_FIELDS` exports all 3 confirmed field names

### Task 2 — `gdprExportUser.ts` Callable + Tests

`functions/src/gdpr/gdprExportUser.ts` (224 lines) — Pattern A callable:
- `region: "europe-west2"`, `enforceAppCheck: true`, `serviceAccount: "gdpr-reader-sa"`, `memory: "512MiB"`, `timeoutSeconds: 540`
- `SIGNED_URL_TTL_MS = 24 * 60 * 60 * 1000` — pinned constant (T-08-04-02), no caller-supplied override
- Admin role gate from `request.auth.token.role` (Pitfall 17, T-08-04-03)
- `ensureIdempotent()` with 5-min window keyed on `gdprExportUser:<actor>:<target>:<clientReqId>` (T-08-04-08)
- Parallel pre-fetch: `users/{uid}` + `auditLog` collection + 6 collectionGroup queries + 3×DOCUMENT_AUTHOR_FIELDS for subcollection docs + 3×DOCUMENT_AUTHOR_FIELDS for legacy top-level docs
- `assembleUserBundle()` pure helper called with query results
- GCS upload via `getStorage().bucket(EXPORT_BUCKET).file(path).save()`
- V4 signed URL issued via `file.getSignedUrl({ version: "v4", action: "read", expires: expiresAt })`
- Audit row written with `type: "compliance.export.user"` — `bundlePath` (gs:// URI) recorded, signed URL never logged (T-08-04-01)
- Pitfall 17: actor sourced from `request.auth.token`, target from `request.data`

`functions/test/gdpr/gdprExportUser.unit.test.ts` (268 lines) — 7 unit tests:
1. non-admin → permission-denied
2. unauthenticated → unauthenticated
3. missing userId → invalid-argument
4. happy path: profile + 2 comments + 1 message → `{url, expiresAt}` + storage object + valid bundle JSON
5. audit event: `compliance.export.user`, `actor.uid === ADMIN_UID`, `target.id === TARGET_UID`
6. all 6 collection groups queried: comments, messages, actions, responses, documents, funnelComments
7. duplicate clientReqId within 5-min window → already-exists

`functions/test/integration/gdprExportUser.integration.test.ts` (178 lines) — 3 integration tests:
1. Happy path: storage object + auditLog row + correct bundle shape
2. Non-admin → permission-denied
3. Duplicate clientReqId → already-exists

**Mock extension:** `collectionGroup()` factory added to `getFirestoreMock()` in `functions/test/_mocks/admin-sdk.ts`. Implements path-segment matching: matches all docs whose path has a segment equal to `groupName` at position `[-2]` (second-to-last). Supports `.where()`, `.limit()`, `.orderBy()`, `.startAfter()` chains — same API surface as `buildQuery`. Phase 7 + 08-01/02/03 baseline tests unaffected (additive surface only).

### Task 3 — `index.ts` Wiring + `src/cloud/gdpr.js` Fill

`functions/src/index.ts`: +1 export line → 16 total Cloud Functions exported.

`src/cloud/gdpr.js` (Phase 4 stub replaced):
- `exportUser({ userId })`: imports `httpsCallable` + `functions` from `../firebase/functions.js` (D-04 compliant adapter import), generates `clientReqId = crypto.randomUUID()`, calls `exportUserCallable({...input, clientReqId})`, returns typed `{ url, expiresAt }`
- `eraseUser()`: stub preserved verbatim — body comment updated to reference 08-05
- `downloadURL` contract removed (stub returned `{ downloadURL: "" }`); new shape is `{ url, expiresAt }` — safe, stub was never wired to a real caller

---

## Test Count Delta

| Suite | Before 08-04 | After 08-04 | Delta |
|-------|-------------|-------------|-------|
| functions (vitest) | 189 | 205 | +16 |
| root (vitest) | 445 | 445 | 0 |
| **Total** | **634** | **650** | **+16** |

New tests breakdown: 6 assembleUserBundle unit + 7 gdprExportUser unit + 3 integration = 16

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Single-load callable pattern required for correct mock instance sharing**
- **Found during:** Task 2
- **Issue:** `vi.resetModules()` inside `loadWrapped()` caused the callable to bind to a fresh module instance of `admin-sdk.ts`, while `beforeEach`/assertions imported the original instance — storage objects saved to one instance were invisible to assertions reading from another.
- **Fix:** Replaced `loadWrapped()` pattern (with `vi.resetModules()`) with single-load at module level (`const { gdprExportUser } = await import(...)`) — same pattern as 08-03 SUMMARY decision. Applied to both unit and integration test files.
- **Files modified:** `functions/test/gdpr/gdprExportUser.unit.test.ts`, `functions/test/integration/gdprExportUser.integration.test.ts`
- **Commit:** `acee6ef`

**2. [Rule 2 - Missing functionality] Legacy top-level documents/ collection queried separately**
- **Found during:** Task 2 implementation
- **Issue:** Task 0 confirmed `src/main.js` writes documents to top-level `documents/{docId}` (not the subcollection). The plan's collectionGroup("documents") only covers `orgs/{orgId}/documents/{docId}`. The legacy path would be missed.
- **Fix:** Added parallel `DOCUMENT_AUTHOR_FIELDS.map(field => db.collection("documents").where(field, "==", userId).get())` queries after the main parallel block, results pushed into the same `documents` array (assembleUserBundle de-dupes by path).
- **Files modified:** `functions/src/gdpr/gdprExportUser.ts`
- **Commit:** `acee6ef`

---

## Assumption A1 Closure

From `08-04-FIELD-AUDIT-NOTES.md` (Task 0):

The assumption that `orgs/{orgId}/documents/{id}` uses `uploaderId` was **incorrect**. Grep findings:
- `src/main.js:3363: uploaderId: user.id` → top-level `documents/{docId}` collection only
- `src/data/documents.js:76: legacyAppUserId: meta?.uploadedBy || null` → subcollection `orgs/{orgId}/documents/{docId}` only

The canonical DOCUMENT_AUTHOR_FIELDS for the GDPR export + future erasure cascade are `["uploaderId", "uploadedBy", "legacyAppUserId"]` queried across BOTH collection paths.

---

## Mock Extension Delta

`functions/test/_mocks/admin-sdk.ts`:
- Added `buildCollectionGroupQuery()` function (~80 lines): path-segment matching, same where/limit/orderBy/startAfter chain support as `buildQuery`
- Added `collectionGroup(name)` method to `getFirestoreMock()` return object
- `grep -c "collectionGroup" functions/test/_mocks/admin-sdk.ts` → 4 (function name + factory + 2 internal references)

---

## Known Stubs

`src/cloud/gdpr.js#eraseUser` — stub body preserved for 08-05. This is intentional and documented in the file header. The stub returns `Promise<void>` (no-op) — it was never wired to a real caller.

---

## Threat Flags

No new threat surface beyond what was in the plan's `<threat_model>`. All 8 STRIDE entries (T-08-04-01 through T-08-04-08) are mitigated in the implementation. No net-new unaddressed surface.

---

## Forward Pointers

- **08-05:** `gdprEraseUser` callable using the same collection-group query shape + GDPR_PSEUDONYM_SECRET + redactionList write. `eraseUser` stub in `src/cloud/gdpr.js` closes there.
- **08-06:** Close-gate provisions `gdpr-reader-sa` service account (Firestore `roles/datastore.viewer` + GCS object admin scoped to `gdpr-exports/` prefix in `bedeveloped-base-layers-backups`).

---

## Self-Check

### Created files exist
- `functions/src/gdpr/assembleUserBundle.ts` — exists (113 lines)
- `functions/src/gdpr/gdprExportUser.ts` — exists (224 lines)
- `functions/test/gdpr/assembleUserBundle.unit.test.ts` — exists (150 lines)
- `functions/test/gdpr/gdprExportUser.unit.test.ts` — exists (268 lines)
- `functions/test/integration/gdprExportUser.integration.test.ts` — exists (178 lines)
- `lib/gdpr/assembleUserBundle.js` — exists (build confirmed)
- `lib/gdpr/gdprExportUser.js` — exists (build confirmed)
- `.planning/phases/08-data-lifecycle-soft-delete-gdpr-backups/08-04-FIELD-AUDIT-NOTES.md` — exists

### Commits exist
- `51ea605` docs(08-04): Task 0 — documents field audit, closes Assumption A1
- `2368748` feat(08-04): Task 1 — assembleUserBundle pure helper + 6 unit tests
- `acee6ef` feat(08-04): Task 2 — gdprExportUser callable + 7 unit + 3 integration tests
- `2497159` feat(08-04): Task 3 — index.ts exports gdprExportUser + fill gdpr.js exportUser

### Test suite
- `cd functions && npm test` → 205 passed (36 test files) — all green
- +16 new tests from this plan (205 - 189 = 16)
- Phase 7 + 08-01/02/03 baseline tests unaffected

### Key verifications
- `grep -c "^export" functions/src/index.ts` → 16 (was 15 after 08-03)
- `grep -c "Phase 8 Wave 4 (GDPR-02) body lands" src/cloud/gdpr.js` → 1 (eraseUser stub preserved)
- `grep -E "^import" functions/src/gdpr/assembleUserBundle.ts | grep -v "node:" | wc -l` → 0 (Pattern C purity)
- `SIGNED_URL_TTL_MS = 24 * 60 * 60 * 1000` confirmed in gdprExportUser.ts
- `grep -c "collectionGroup" functions/test/_mocks/admin-sdk.ts` → 4

## Self-Check: PASSED
