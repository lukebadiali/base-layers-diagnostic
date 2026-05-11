---
phase: 8
phase_name: Data Lifecycle (Soft-Delete + GDPR + Backups)
verified: 2026-05-10T15:10:00Z
verifier: gsd-verifier (autonomous run)
status: human_needed
score: 5/6 success criteria code-verified; 1/6 awaiting operator execution
re_verification: false
human_verification:
  - test: "Execute the single operator session documented in 08-06-DEFERRED-CHECKPOINT.md"
    expected: |
      Step 0: GDPR_PSEUDONYM_SECRET + 5 SAs confirmed in gcloud (backup-sa, storage-reader-sa,
      lifecycle-sa, gdpr-reader-sa, gdpr-writer-sa)
      Step 1: `firebase deploy --only functions:scheduledFirestoreExport,...` (8 functions) exits 0;
      all 8 appear ACTIVE in `gcloud functions list`
      Step 2: `firebase deploy --only firestore:rules` exits 0; console shows notDeleted +
      redactionList blocks live
      Step 3: Smoke tests pass — 8 functions ACTIVE, 2 scheduler jobs registered, first export
      creates a `YYYY-MM-DD/` directory in gs://bedeveloped-base-layers-backups/firestore/,
      client list render returns data without permission-denied
      Step 4: Restore drill (Path A PITR clone) completes; `runbooks/restore-drill-2026-05-13.md`
      filled with actual timestamps + sign-off committed
      Step 5: Close-gate checklist all 6 checks pass; STATE.md flipped to Phase 8 COMPLETE
    why_human: >
      Production gcloud/firebase deploys require operator authentication (ADC + firebase login).
      The restore drill requires PITR clone creation against the live Firestore instance.
      These cannot be executed autonomously.
  - test: "Fix 2 failing root-suite tests in tests/cloud/gdpr.test.js"
    expected: |
      The test file was authored as a Phase 4 stub smoke test expecting the old stub behaviour
      (downloadURL property + resolves.toBeUndefined). After Phase 8 filled the real
      implementation (src/cloud/gdpr.js), these two tests now fail with FirebaseError: internal.
      The fix mirrors what was done for tests/cloud/soft-delete.test.js in 08-03:
      mock ../../src/firebase/functions.js so httpsCallable returns {data: ...}; assert the
      real return shapes ({url, expiresAt} for exportUser; {ok, counts} for eraseUser).
      Root suite should then show 445/445 passing (0 failed).
    why_human: >
      This is a code fix requiring a commit. The verifier does not commit changes.
      Two specific tests are failing: "exportUser resolves to a placeholder shape" and
      "eraseUser resolves without throwing". Both fail because the real callable throws
      FirebaseError: internal when invoked without a Firebase app in the test environment.
gaps:
  - truth: "Root test suite passes with 0 failures"
    status: failed
    reason: >
      tests/cloud/gdpr.test.js has 2 failing tests. The Phase 4 stub smoke tests assert
      the old stub behaviour (downloadURL property, resolves undefined) but src/cloud/gdpr.js
      was filled with the real httpsCallable in Phase 8 Wave 3/4. The tests were never
      updated to mock the Firebase functions adapter. tests/cloud/soft-delete.test.js was
      correctly updated in 08-03 for the same pattern; gdpr.test.js was missed.
    artifacts:
      - path: "tests/cloud/gdpr.test.js"
        issue: >
          Line 19: expects out.downloadURL but exportUser now returns {url, expiresAt}.
          Line 23: expects resolves.toBeUndefined but eraseUser now returns {ok, counts}.
          Both fail with FirebaseError: internal (no Firebase app in test env).
    missing:
      - >
        Update tests/cloud/gdpr.test.js to mock ../../src/firebase/functions.js (httpsCallable
        stub returning {data: {url: 'https://...', expiresAt: 0}} for exportUser and
        {data: {ok: true, counts: {}}} for eraseUser). Mirror the pattern in
        tests/cloud/soft-delete.test.js (commit 464ba77).
---

# Phase 8: Data Lifecycle — Verification Report

**Phase Goal:** Deletes are recoverable, GDPR Art. 15 + 17 are honourable, and a documented backup + tested restore exists — the milestone's recoverability and data-rights story.

**Verified:** 2026-05-10T15:10:00Z
**Status:** human_needed (1 operator session outstanding; 1 test fix required before session)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (6 ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Admin can soft-delete and restore an org, comment, document, message, or funnel comment within the 30-day window; soft-deleted items disappear from normal queries; hard-deleted by scheduledPurge past retention | VERIFIED (code) / HUMAN_NEEDED (production deploy) | `functions/src/lifecycle/{softDelete,restoreSoftDeleted,scheduledPurge,permanentlyDeleteSoftDeleted}.ts` — Pattern A, paginated purge, 1200-doc test. `firestore.rules` notDeleted predicate on 5 subcollections + funnelComments. 5 data wrappers have `where("deletedAt","==",null)`. Admin UI in `src/views/admin.js`. 08-03 SUMMARY self-check PASSED. Functions tests 189→189+38=227 (all passing). |
| 2 | gdprExportUser produces a signed-URL JSON bundle (TTL ≤ 24h) of all user-linked data | VERIFIED (code) / HUMAN_NEEDED (production deploy) | `functions/src/gdpr/{assembleUserBundle,gdprExportUser}.ts`. Pattern C purity (zero firebase-admin in assembleUserBundle). V4 signed URL TTL 24h pinned constant. Covers profile + 8 collection paths + legacy top-level documents/ + legacyAuthorId parallel queries (M-02 fix). 3 integration tests green. 08-04 SUMMARY self-check PASSED. |
| 3 | gdprEraseUser replaces authorId with deterministic pseudonym across all denormalised collections + Storage + redactionList; post-erasure audit script confirms zero residual PII | VERIFIED (code, with note) / HUMAN_NEEDED (operator provisioning + deploy) | `functions/src/gdpr/{pseudonymToken,eraseCascade,gdprEraseUser}.ts`. sha256(uid+GDPR_PSEUDONYM_SECRET) tombstone. 7+ collection cascade + Storage enumeration + Auth disable. M-01 fix removed tombstoneToken from response. M-02 fix added legacyAuthorId queries. H-02 fix corrected post-erasure-audit pass/fail logic. GDPR_PSEUDONYM_SECRET deferred to operator session. 08-05 SUMMARY self-check PASSED. |
| 4 | Daily Firestore export lands in gs://bedeveloped-base-layers-backups/firestore/{YYYY-MM-DD}/ with 30d/90d/365d lifecycle; Firestore PITR enabled; Storage versioning + 90d soft-delete enabled | VERIFIED (code + runbook) / HUMAN_NEEDED (operator gcloud setup + first export) | `functions/src/backup/scheduledFirestoreExport.ts` — 02:00 UTC cron, europe-west2, retryCount:2. `scripts/setup-backup-bucket/lifecycle.json` — Standard→Nearline@30d→Archive@365d. `runbooks/phase-8-backup-setup.md` — full operator procedure for bucket + PITR + uploads versioning. GCS bucket creation and Firestore PITR enable are in 08-06-DEFERRED-CHECKPOINT Step 0 prerequisite. |
| 5 | Storage signed URLs for documents are issued with TTL ≤ 1h and refresh-on-download; prior unbounded getDownloadURL paths are gone | VERIFIED | `functions/src/backup/getDocumentSignedUrl.ts` — V4 1h TTL pinned constant. `src/cloud/signed-url.js` browser seam wired. `src/main.js` and `src/data/documents.js` getDownloadURL call sites swept (confirmed by `grep -r getDownloadURL src/` — only comment text and the storage.js adapter re-export remain; no live call sites). |
| 6 | One restore drill has been performed and documented in runbooks/restore-drill-<date>.md with timing, evidence, and any gaps; quarterly cadence documented | HUMAN_NEEDED | `runbooks/restore-drill-2026-05-13.md` template authored with operator-fill placeholders per Pitfall 19 (no fabricated timestamps). `runbooks/phase-8-restore-drill-cadence.md` quarterly cadence through Q2-2027. Drill execution is operator-deferred (08-06 Step 4). |

**Score:** 5/6 truths code-verified (SC#1–5 all artifacts exist, substantive, wired); 1/6 (SC#6) awaiting operator execution. 5/6 criteria are also blocked from final production confirmation by the deferred operator session.

**Test gap (separate from operator deferral):** Root suite has 2 failing tests in `tests/cloud/gdpr.test.js`. This is a code fix required before the operator session (the deploy build verification in 08-06 Step 0.1 runs `npm test`; it must exit 0).

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `functions/src/index.ts` | 17 exported Cloud Functions | VERIFIED | `grep -c "^export" functions/src/index.ts` → 17. All 8 Phase 8 functions present plus 9 Phase 6/7 functions. |
| `functions/src/backup/scheduledFirestoreExport.ts` | Daily Firestore export CF | VERIFIED | Exists (60 lines), 02:00 UTC cron, europe-west2, backup-sa, retryCount:2. |
| `functions/src/backup/getDocumentSignedUrl.ts` | V4 signed URL callable | VERIFIED | Exists (94 lines), Pattern A, 1h TTL constant. |
| `functions/src/lifecycle/resolveDocRef.ts` | SoftDeletableType enum (action, comment, document, message, funnelComment) | VERIFIED | H-01 fix confirmed — SOFT_DELETABLE_TYPES is `["action","comment","document","message","funnelComment"]`; "org" removed. |
| `functions/src/lifecycle/softDelete.ts` | Soft-delete callable | VERIFIED | Exists (92 lines), Pattern A, batch atomic tombstone + snapshot. |
| `functions/src/lifecycle/restoreSoftDeleted.ts` | Restore callable | VERIFIED | Exists (80 lines), Pattern A. L-01 (live doc existence check) deferred with rationale. |
| `functions/src/lifecycle/scheduledPurge.ts` | Daily purge CF | VERIFIED | Exists (62 lines), 03:00 UTC cron, 500-doc pagination, 30d retention. |
| `functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts` | Admin permanent-delete callable | VERIFIED | Exists (76 lines), Pattern A, idempotency guard. |
| `functions/src/gdpr/assembleUserBundle.ts` | Pure bundle assembler | VERIFIED | Exists (113 lines), zero firebase-admin imports (Pattern C). |
| `functions/src/gdpr/gdprExportUser.ts` | GDPR Art. 15 callable | VERIFIED | Exists (224 lines), 24h TTL constant, gdpr-reader-sa. |
| `functions/src/gdpr/pseudonymToken.ts` | Deterministic tombstone helper | VERIFIED | Exists, sha256 + 16hex suffix, TOMBSTONE_TOKEN_LENGTH=29 pinned. |
| `functions/src/gdpr/eraseCascade.ts` | Cascade batch-ops builder | VERIFIED | Exists, 7+ collections + auditLog tombstone, 500-op chunk limit. |
| `functions/src/gdpr/gdprEraseUser.ts` | GDPR Art. 17 callable | VERIFIED | Exists (post M-01 fix: tombstoneToken removed from response), gdpr-writer-sa, 1GiB/540s. |
| `firestore.rules` | notDeleted predicate on 5 collections | VERIFIED | 1 function definition + 5 allow-read conjuncts + 1 on funnelComments = 7 occurrences. redactionList match block: allow read: if isAdmin(); allow write: if false. |
| `src/cloud/signed-url.js` | Browser seam for getDocumentSignedUrl | VERIFIED | Exists (31 lines), httpsCallable via adapter, refresh-on-download contract. |
| `src/cloud/soft-delete.js` | Browser seam for lifecycle callables | VERIFIED | Real httpsCallable wrappers (not stub), crypto.randomUUID clientReqId, adapter import. |
| `src/cloud/gdpr.js` | Browser seam for GDPR callables | VERIFIED (impl) / STUB_TEST | Real implementation exists. BUT tests/cloud/gdpr.test.js still tests old stub behavior — 2 tests failing. |
| `src/data/soft-deleted.js` | Admin UI data wrapper | VERIFIED | Exists (47 lines), uses SOFT_DELETABLE_TYPES (H-01 fix applied — "org" replaced with "action"). |
| `src/views/admin.js` | Recently Deleted UI (LIFE-06) | VERIFIED | Exists (145 lines), functional — Restore button + Permanently delete now, Pattern D DI factory. |
| `scripts/post-erasure-audit/run.js` | GDPR-03 evidence script | VERIFIED | Exists, H-02 fix applied (inverted pass/fail corrected). ADC-only, exit 0/1/2. |
| `scripts/setup-backup-bucket/run.js` | GCS bucket setup script | VERIFIED | Exists with lifecycle.json; idempotent ADC-based script. |
| `runbooks/phase-8-backup-setup.md` | Backup operator runbook | VERIFIED | Exists, §7 added by 08-05 Task 7 with GDPR secrets + 4 SA provisioning steps. |
| `runbooks/restore-drill-2026-05-13.md` | BACKUP-07 evidence template | VERIFIED (template) / HUMAN_NEEDED (fill) | Exists with operator-fill placeholder timestamps per Pitfall 19. |
| `runbooks/phase-8-restore-drill-cadence.md` | BACKUP-06 quarterly cadence | VERIFIED | Exists, Q2-2026 through Q2-2027 schedule, paired-review requirement, P1 escalation. |
| `SECURITY.md` | Phase 8 DOC-10 increment (4 sections + 19-row Audit Index) | VERIFIED | 27 `## §` sections confirmed. Phase 8 Audit Index present. 4 new sections: Data Lifecycle, GDPR, Backups+DR, Phase 8 Audit Index. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/cloud/signed-url.js` | `functions/src/backup/getDocumentSignedUrl.ts` | httpsCallable("getDocumentSignedUrl") | WIRED | Adapter import from ../firebase/functions.js; refresh-on-download documented. |
| `src/main.js` (download button) | `src/cloud/signed-url.js` | dynamic import on click | WIRED | BACKUP-05 sweep complete — no live getDownloadURL call sites in src/ (only comments and storage.js adapter re-export remain). |
| `src/cloud/soft-delete.js` | lifecycle callables | httpsCallable per function | WIRED | Real wrappers, crypto.randomUUID clientReqId; src/views/admin.js calls listSoftDeleted + restoreSoftDeleted + permanentlyDeleteSoftDeleted. |
| `src/cloud/gdpr.js` (exportUser) | `gdprExportUser` CF | httpsCallable("gdprExportUser") | WIRED (impl) | Real implementation present and correct. Test mocking is broken but does not affect the wiring itself. |
| `src/cloud/gdpr.js` (eraseUser) | `gdprEraseUser` CF | httpsCallable("gdprEraseUser") | WIRED (impl) | Both Phase 4 stub seams closed in 08-04/08-05. |
| `firestore.rules` notDeleted | 5 client data wrappers | where("deletedAt","==",null) | WIRED | Pitfall A compliance: both rules predicate AND client where conjunct on all 5 soft-deletable collections. |
| `firestore.rules` redactionList | `gdprEraseUser` | redactionList/{userId}.set() | WIRED | Rules allow write: if false (server-only via callable). 10 rules-unit-test cells pass. |
| `scheduledFirestoreExport` | GCS bucket | FirestoreAdminClient.exportDocuments | WIRED (code) / HUMAN_NEEDED (bucket must exist) | GCS bucket creation is deferred to operator session Step 0 prerequisite. |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `src/views/admin.js` Recently Deleted UI | listSoftDeleted() result | `src/data/soft-deleted.js` → Firestore `softDeleted/*` | Yes (Firestore collectionGroup query per type) | VERIFIED — data flows from Firestore through data wrapper to render table; not hardcoded. |
| `functions/src/gdpr/assembleUserBundle.ts` | query results | Parallel Firestore collectionGroup fetches in gdprExportUser.ts | Yes (7+ live Firestore queries) | VERIFIED — Pattern C pure function called with real query results. |
| `functions/src/gdpr/eraseCascade.ts` | batch ops | Pre-fetched query snapshots in gdprEraseUser.ts | Yes (same parallel query structure as export) | VERIFIED — operates on real pre-fetched docs. |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 17 Cloud Functions registered in index.ts | `grep -c "^export" functions/src/index.ts` | 17 | PASS |
| functions test suite passes | `cd functions && npm test` | 234/234 passed (40 files) | PASS |
| Root test suite passes | `npm test` (repo root) | 443/445 passed — 2 FAILED in tests/cloud/gdpr.test.js | FAIL |
| notDeleted predicate in rules | `grep -c "notDeleted" firestore.rules` | 7 (1 definition + 6 conjuncts) | PASS |
| redactionList match block in rules | `grep -c "redactionList" firestore.rules` | 2 (match + comment) | PASS |
| SECURITY.md Phase 8 sections | `grep -c "^## § " SECURITY.md` | 27 | PASS |
| getDownloadURL call sites swept | `grep -r "getDownloadURL" src/` (excluding comments/adapter) | 0 live call sites | PASS |
| resolveDocRef "org" removed | `grep -c '"org"' functions/src/lifecycle/resolveDocRef.ts` | 0 | PASS |
| Cleanup ledger gate | `grep "phase_8_active_rows" runbooks/phase-8-cleanup-ledger.md` | phase_8_active_rows: 0 | PASS |
| REQUIREMENTS.md Phase 8 rows validated | `grep -c "Closed Phase 8" .planning/REQUIREMENTS.md` | 18 | PASS |
| Traceability rows updated | `grep -c "Validated 2026-05-13" .planning/REQUIREMENTS.md` | 3 | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LIFE-01 | 08-03 | Soft-delete + 30-day restore window across 5 collections | VERIFIED | softDelete + restoreSoftDeleted + scheduledPurge CFs; rules predicate; client where conjunct |
| LIFE-02 | 08-03 | deletedAt tombstone + softDeleted/{type}/items/{id} snapshot | VERIFIED | Single-batch atomic write in softDelete.ts |
| LIFE-03 | 08-03 | Rules hide soft-deleted docs from normal queries | VERIFIED | notDeleted predicate in 6 positions; client where conjunct in 5 data wrappers |
| LIFE-04 | 08-03 | restoreSoftDeleted callable (admin-only, 30-day window) | VERIFIED | Pattern A callable; 3 integration tests; browser seam wired |
| LIFE-05 | 08-03 | Daily scheduledPurge hard-deletes past 30d | VERIFIED | 03:00 UTC cron; 500-doc pagination; 1200-doc fake-timer pagination test |
| LIFE-06 | 08-03 | Admin Recently Deleted UI + Restore + Permanently Delete | VERIFIED | src/views/admin.js functional (145 lines); window.confirm() guard (L-03 deferred) |
| GDPR-01 | 08-04 | gdprExportUser callable, signed URL TTL ≤ 24h, all user-linked data | VERIFIED | 24h TTL constant; 8 collection paths + legacy; 3 integration tests |
| GDPR-02 | 08-05 | gdprEraseUser callable, deterministic tombstone pattern | VERIFIED | sha256(uid+secret) token; eraseCascade across 7+ collections; M-01 fix applied |
| GDPR-03 | 08-05 | Erasure cascade covers all denormalised collections + Storage + Auth | VERIFIED | eraseCascade.ts 7+ collections + Storage enumeration + Auth disable; post-erasure-audit/run.js |
| GDPR-04 | 08-05 | Audit-log retention vs erasure: tombstone PII, retain doc | VERIFIED | auditLog branch tombstones actor.uid/email + payload.email; Art. 6(1)(f) rationale documented |
| GDPR-05 | 08-05 + 08-06 | Erasure propagation to backups via redactionList | VERIFIED | redactionList/{uid}.set() in gdprEraseUser; rules allow write: if false; restore-drill §Re-Redaction Step |
| BACKUP-01 | 08-02 | Daily Firestore export → GCS bucket | VERIFIED (code) / HUMAN_NEEDED (deploy + first run) | scheduledFirestoreExport.ts; 02:00 UTC cron; GCS bucket path pattern |
| BACKUP-02 | 08-01 | GCS lifecycle: 30d Standard → 90d Nearline → 365d Archive | VERIFIED (script) / HUMAN_NEEDED (gcloud apply) | lifecycle.json; Standard→Nearline@30d creation→Archive@365d creation (335d Nearline dwell) |
| BACKUP-03 | 08-01 | Firestore PITR enabled (7-day rolling) | VERIFIED (script) / HUMAN_NEEDED (gcloud apply) | setup-backup-bucket/run.js enables PITR; phase-8-backup-setup.md verification steps |
| BACKUP-04 | 08-01 | Storage bucket versioning + 90d soft-delete | VERIFIED (script) / HUMAN_NEEDED (gcloud apply) | setup-backup-bucket/run.js enables versioning + soft-delete on uploads bucket |
| BACKUP-05 | 08-02 + 08-03 | Signed URL TTL ≤ 1h; getDownloadURL gone | VERIFIED | getDocumentSignedUrl 1h TTL pinned; getDownloadURL sweep confirmed 0 live call sites |
| BACKUP-06 | 08-06 | Quarterly restore-drill cadence documented | VERIFIED | runbooks/phase-8-restore-drill-cadence.md; Q2-2026 through Q2-2027 |
| BACKUP-07 | 08-06 | One restore drill performed + documented | HUMAN_NEEDED | Template authored; drill execution deferred to operator session (08-06 Step 4) |
| DOC-10 | 08-06 | SECURITY.md Phase 8 increment | VERIFIED | 27 §-blocks confirmed; Phase 8 Audit Index (19 rows: LIFE-01..06 + GDPR-01..05 + BACKUP-01..07 + DOC-10) |

---

### Code Review Status

**Review conducted:** 2026-05-10T13:49:41Z (`08-REVIEW.md`)
**Review fix applied:** 2026-05-10 (`08-REVIEW-FIX.md`)

| Finding | Severity | Status | Evidence |
|---------|----------|--------|----------|
| H-01: resolveDocRef.ts "org" instead of "action" in SOFT_DELETABLE_TYPES | HIGH | FIXED | Commit e4d5177. Verified: `grep '"org"' functions/src/lifecycle/resolveDocRef.ts` → 0 results. |
| H-02: post-erasure-audit/run.js audit-log check always FAIL regardless of outcome | HIGH | FIXED | Commit e5aa1b7. if(untombstoned.length===0) now emits PASS correctly. |
| M-01: tombstoneToken returned in gdprEraseUser callable response | MEDIUM | FIXED | Commit 7b5841a. Response is now {ok, counts}; token stays in redactionList and audit event only. |
| M-02: legacyAuthorId queries missing from messages/comments in erasure + export | MEDIUM | FIXED | Commit eb30640. Parallel legacyAuthorId collectionGroup queries added to both gdprEraseUser and gdprExportUser; mergeByPath de-duplication applied. |
| L-01: restoreSoftDeleted does not check live doc existence before batch.update | LOW | DEFERRED | Rationale: edge case only triggered if live doc hard-deleted after soft-delete — impossible under normal admin-only lifecycle. No live users. Fix in REVIEW.md is clear for future hardening pass. |
| L-02: gdpr.js double import from same module | LOW | FIXED | Commit 601fe85. Merged to `import { httpsCallable, functions } from "../firebase/functions.js"`. |
| L-03: window.confirm() for destructive-action guard in admin.js | LOW | DEFERRED | Rationale: explicit Phase 8 plan decision (MVP approach); not a compliance blocker; modal.js pattern replacement queued for Phase 10/UI-polish. |

**Functions test count after review fixes:** 234/234 (40 files) — all passing.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `tests/cloud/gdpr.test.js:19` | `expect(out).toHaveProperty("downloadURL")` — expects removed stub property | BLOCKER | 2 tests fail; deploy build verification (Step 0.1) requires `npm test` to exit 0 |
| `tests/cloud/gdpr.test.js:23` | `expect(eraseUser(...)).resolves.toBeUndefined()` — expects stub no-op | BLOCKER | Same file, same root cause |
| `src/views/admin.js:93-97` | `window.confirm()` for "Permanently delete now" guard | WARNING | L-03 deferred per review; not a compliance blocker |
| `functions/src/lifecycle/restoreSoftDeleted.ts:56-69` | No live-doc existence check before batch.update | WARNING | L-01 deferred per review; edge case only under abnormal admin sequences |

---

### Human Verification Required

#### 1. Fix tests/cloud/gdpr.test.js (pre-operator-session blocker)

**Test:** Update `tests/cloud/gdpr.test.js` to mock `../../src/firebase/functions.js` so both `exportUser` and `eraseUser` return controlled data instead of throwing FirebaseError. Mirror the pattern from `tests/cloud/soft-delete.test.js` (commit `464ba77`).

**Expected:** Root suite goes from 443/445 to 445/445. The `npm test` command in 08-06-DEFERRED-CHECKPOINT Step 0.1 then exits 0.

**Why human:** Requires a code change and commit. The verifier does not modify source.

#### 2. Execute the Phase 8 Wave 6 Operator Session

**Test:** Follow `08-06-DEFERRED-CHECKPOINT.md` Steps 0–5 in sequence.

**Expected:**
- Step 0: 5 SAs + GDPR_PSEUDONYM_SECRET confirmed in gcloud
- Step 1: 8 functions deployed, all ACTIVE in `gcloud functions list`
- Step 2: Firestore rules deployed; notDeleted + redactionList blocks live in console
- Step 3: 2 scheduler jobs registered; first Firestore export creates a dated directory in GCS; client list renders without permission-denied
- Step 4: PITR clone completes; `runbooks/restore-drill-2026-05-13.md` filled with real timestamps + committed with evidence
- Step 5: All 6 close-gate checks pass; STATE.md flipped to Phase 8 COMPLETE

**Why human:** Production gcloud ADC + firebase login required. PITR clone exercises the live Firestore project. Drill timings and RTO evidence cannot be fabricated (Pitfall 19).

---

### Gaps Summary

**One code gap requiring a fix before the operator session:**

`tests/cloud/gdpr.test.js` was authored in Phase 4 as a stub smoke test and was not updated when Phase 8 filled the real implementation in `src/cloud/gdpr.js`. Two tests fail:
- "exportUser resolves to a placeholder shape (no-op today)" — expects `downloadURL` property; real implementation returns `{url, expiresAt}`
- "eraseUser resolves without throwing (no-op)" — expects `resolves.toBeUndefined()`; real implementation returns `{ok, counts}`

The fix is mechanical: mock `../../src/firebase/functions.js` in the test file (same pattern as `tests/cloud/soft-delete.test.js`). This must be resolved before running the 08-06-DEFERRED-CHECKPOINT Step 0.1 build check, which requires `npm test` to exit 0.

All other Phase 8 code is substantive, wired, and test-covered. The deferred operator actions (BACKUP-01..04 GCS/PITR provisioning, 8 CF deploy, rules deploy, restore drill) are explicitly planned and documented with step-by-step runbooks — they are not unplanned gaps.

---

_Verified: 2026-05-10T15:10:00Z_
_Verifier: Claude (gsd-verifier)_
