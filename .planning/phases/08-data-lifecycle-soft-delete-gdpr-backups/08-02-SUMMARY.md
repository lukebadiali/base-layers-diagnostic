---
phase: 08
plan: 02
subsystem: backup
tags: [backup, cloud-functions, signed-url, firestore-export, BACKUP-01, BACKUP-05]
dependency_graph:
  requires: [08-01]
  provides: [scheduledFirestoreExport, getDocumentSignedUrl, signed-url-browser-seam]
  affects: [functions/src/index.ts, src/cloud/]
tech_stack:
  added: ["@google-cloud/firestore v1.FirestoreAdminClient (exportDocuments)", "firebase-admin/storage (getSignedUrl V4)"]
  patterns: ["onSchedule Gen2 cron pattern", "Pattern A callable (enforceAppCheck + Zod + withSentry)", "Pitfall 17 token-claim isolation", "T-08-02-07 URL-never-logged"]
key_files:
  created:
    - functions/src/backup/scheduledFirestoreExport.ts
    - functions/src/backup/getDocumentSignedUrl.ts
    - functions/test/backup/scheduledFirestoreExport.unit.test.ts
    - functions/test/backup/getDocumentSignedUrl.unit.test.ts
    - functions/test/integration/scheduledFirestoreExport.integration.test.ts
    - functions/test/integration/getDocumentSignedUrl.integration.test.ts
    - src/cloud/signed-url.js
  modified:
    - functions/src/index.ts
    - functions/vitest.config.ts
decisions:
  - "retryCount:2 flat (not retryConfig object) — ScheduleOptions type uses top-level retryCount field"
  - "vi.mock uses constructor-function (not vi.fn().mockImplementation) for FirestoreAdminClient to support new keyword"
  - "pool:forks + maxForks:4 + testTimeout:15000 added to vitest.config.ts to fix cross-file vi.mock contamination in thread pool"
  - "toFake:['Date'] scoped fake timers to prevent setTimeout leakage into integration tests"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-10"
  tasks_completed: 4
  files_created: 9
  files_modified: 2
---

# Phase 8 Plan 02: Backup Cloud Functions Summary

**One-liner:** Daily Firestore export (BACKUP-01) and V4 signed URL callable (BACKUP-05) authored with full unit+integration test coverage; browser seam wired; vitest pool isolation fixed.

---

## What Was Built

### New Cloud Functions

| File | Lines | Purpose |
|------|-------|---------|
| `functions/src/backup/scheduledFirestoreExport.ts` | 60 | Daily Firestore export via FirestoreAdminClient.exportDocuments to gs://bedeveloped-base-layers-backups/firestore/{YYYY-MM-DD}/; onSchedule cron 0 2 * * * UTC, europe-west2, 540s, retryCount:2, serviceAccount:backup-sa |
| `functions/src/backup/getDocumentSignedUrl.ts` | 94 | Callable: V4 signed URL with exactly 1h TTL; Pattern A (enforceAppCheck, Zod, withSentry, Pitfall 17 token isolation); URL never logged (T-08-02-07); serviceAccount:storage-reader-sa |

### index.ts delta

`functions/src/index.ts` exports: 9 → 11 (added `scheduledFirestoreExport` + `getDocumentSignedUrl`)

### Browser Seam

| File | Lines | Purpose |
|------|-------|---------|
| `src/cloud/signed-url.js` | 31 | @ts-check + JSDoc `getDocumentSignedUrl(orgId, docId, filename)` wrapper; httpsCallable via `../firebase/functions.js`; refresh-on-download contract documented; cleanup-ledger forward pointer to 08-03 Wave 2 getDownloadURL sweep |

### Test Files

| File | Tests | Coverage |
|------|-------|---------|
| `functions/test/backup/scheduledFirestoreExport.unit.test.ts` | 5 | Request shape, date derivation, error-rethrow, GCLOUD_PROJECT env, missing-env guard |
| `functions/test/backup/getDocumentSignedUrl.unit.test.ts` | 7 | Auth gate, client match, cross-tenant deny, internal bypass, admin bypass, invalid input (empty docId), signed URL shape |
| `functions/test/integration/scheduledFirestoreExport.integration.test.ts` | 2 | Export call shape regex, error rethrow via t.wrap() |
| `functions/test/integration/getDocumentSignedUrl.integration.test.ts` | 4 | Admin happy path, cross-tenant deny, unauthenticated deny, invalid-argument |

### Test Count Delta

| Stage | Count |
|-------|-------|
| Phase 7 baseline | 133 |
| + scheduledFirestoreExport unit (Task 1) | +5 = 138 |
| + getDocumentSignedUrl unit (Task 2) | +7 = 145 |
| + integration tests (Task 3) | +6 = 151 |
| **Final** | **151 (all passing)** |

---

## Commits

| Hash | Message |
|------|---------|
| `9fb299d` | feat(08-02): scheduledFirestoreExport Cloud Function + 5 unit tests (BACKUP-01) |
| `43b4b0b` | feat(08-02): getDocumentSignedUrl callable + 7 unit tests (BACKUP-05) |
| `628e0eb` | feat(08-02): wire index.ts exports + integration tests for both backup CFs |
| `40d7ebe` | feat(08-02): src/cloud/signed-url.js browser seam for getDocumentSignedUrl (BACKUP-05) |
| `eb56590` | fix(08-02): vitest pool:forks + maxForks:4 + testTimeout:15000 for test isolation |

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `retryConfig` property does not exist on `ScheduleOptions`**
- **Found during:** Task 1 typecheck
- **Issue:** Plan specified `retryConfig: { retryCount: 2 }` but `ScheduleOptions` type in firebase-functions 7.2.5 uses `retryCount: 2` as a top-level field (not nested)
- **Fix:** Changed to `retryCount: 2` at the top-level of the options object
- **Files modified:** `functions/src/backup/scheduledFirestoreExport.ts`
- **Commit:** `9fb299d`

**2. [Rule 1 - Bug] `vi.fn().mockImplementation()` cannot be used as constructor with `new`**
- **Found during:** Task 1 test GREEN phase
- **Issue:** Plan example used `vi.fn(() => m.getFirestoreAdminClientMock())` as the FirestoreAdminClient constructor, but `vi.fn()` instances are not usable as constructors (TypeError: not a constructor)
- **Fix:** Used a plain constructor function (`function MockFirestoreAdminClient()`) that returns the mock object; exportDocuments delegated to `adminSdk.getFirestoreAdminClientMock()` for shared state tracking
- **Files modified:** `functions/test/backup/scheduledFirestoreExport.unit.test.ts`
- **Commit:** `9fb299d`

**3. [Rule 1 - Bug] `vi.mock("@google-cloud/firestore")` leaked into other test files via shared thread-pool module registry**
- **Found during:** Task 1 test full-suite run (Task 3 onward)
- **Issue:** Vitest's default thread pool shares module registries within the same worker process. The `vi.mock("@google-cloud/firestore")` registration in `scheduledFirestoreExport.unit.test.ts` contaminated `getDocumentSignedUrl.unit.test.ts` and all three pre-existing integration test happy-path tests, causing 5000ms timeouts
- **Fix:** Added `pool: "forks"`, `poolOptions: { forks: { maxForks: 4 } }`, and `testTimeout: 15000` to `functions/vitest.config.ts`. Process isolation eliminates cross-file mock contamination; maxForks:4 caps parallelism to prevent import-time contention across 25 simultaneous processes; testTimeout:15000 gives async module init headroom
- **Files modified:** `functions/vitest.config.ts`
- **Commit:** `eb56590`

---

## Forward Pointers

- **08-03 Wave 2:** Wires `src/data/documents.js` + `src/main.js` getDownloadURL call sites to `src/cloud/signed-url.js` (cleanup-ledger row: "Phase 8 (BACKUP-05) seam — getDownloadURL converted in 08-03")
- **08-06 close-gate:** Triggers Cloud Function deploy for both `scheduledFirestoreExport` + `getDocumentSignedUrl` alongside rules redeploy

## Operator Action Required

**`storage-reader-sa` service account provisioning** is queued for the cleanup wave (08-06 close-gate or operator follow-up). The callable is deploy-ready pending this SA:

```bash
gcloud iam service-accounts create storage-reader-sa \
  --display-name="Phase 8 Storage signed URL issuer" \
  --project=bedeveloped-base-layers

gcloud storage buckets add-iam-policy-binding gs://bedeveloped-base-layers-uploads \
  --member="serviceAccount:storage-reader-sa@bedeveloped-base-layers.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"

gcloud iam service-accounts add-iam-policy-binding \
  storage-reader-sa@bedeveloped-base-layers.iam.gserviceaccount.com \
  --member="serviceAccount:storage-reader-sa@bedeveloped-base-layers.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountTokenCreator"
```

---

## Threat Model Coverage

All T-08-02-01..08 mitigations implemented:
- **T-08-02-01** (URL TTL): `SIGNED_URL_TTL_MS = 60 * 60 * 1000` constant; no caller-supplied TTL
- **T-08-02-02** (cross-tenant): `callerOrgId` from `request.auth.token.orgId` only; mismatch → permission-denied (Test 3)
- **T-08-02-03** (input tampering): Zod schema min/max on all fields (Test 6)
- **T-08-02-05** (repudiation): `backup.export.started` + `backup.export.failed` logged with operation name
- **T-08-02-06** (SA spoofing): explicit `serviceAccount: "backup-sa"` on scheduledFirestoreExport
- **T-08-02-07** (URL in logs): `logger.info` logs metadata only; `url` never appears in logs

---

## Known Stubs

None — all functionality is wired. The `src/cloud/signed-url.js` seam is connected to the real callable; the cleanup-ledger forward pointer documents that call sites in `src/data/documents.js` + `src/main.js` are intentionally deferred to 08-03 Wave 2 (not a stub — a coordinated sweep decision).

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| All 9 created/modified files exist | PASSED |
| All 5 commits found in git log | PASSED |
| functions/src/index.ts exports == 11 | PASSED |
| lib/backup/ contains scheduledFirestoreExport.js + getDocumentSignedUrl.js | PASSED |
| src/cloud/signed-url.js httpsCallable count == 2 | PASSED |
| functions test suite: 151/151 passing (3 runs verified) | PASSED |
| root test suite: 440/440 passing | PASSED |
