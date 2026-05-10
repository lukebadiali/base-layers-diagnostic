---
plan: 08-01
status: code_complete_operator_pending
deferred_to: 08-06 (Wave 6 deploy batch)
deferred_at: 2026-05-10
reason: Operator gcloud actions for production substrate batched with Wave 6 production deploy to avoid two operator sessions
---

# 08-01 Operator Checkpoint — Deferred to Wave 6

## What landed in Tasks 1-4 (committed)

- `functions/package.json` — added `@google-cloud/firestore@8.5.0`
- `scripts/setup-backup-bucket/` — ADC-based setup script + `lifecycle.json` + `lifecycle.notes.md` + README
- `runbooks/phase-8-backup-setup.md` — full operator runbook with verification + rollback steps
- `functions/test/_mocks/admin-sdk.ts` — extended with Storage and FirestoreAdminClient mocks for Wave 2 tests

## What the operator must run before Wave 6 production deploy

See `runbooks/phase-8-backup-setup.md` for the complete operator procedure. Summary:

1. `gcloud auth application-default login` + project context
2. `node scripts/setup-backup-bucket/run.js --project=bedeveloped-base-layers` (idempotent)
3. Verify backups bucket location/UBLA/PAP
4. Verify lifecycle rules (2 rules: STANDARD→NEARLINE@30d, NEARLINE→ARCHIVE@365d)
5. Verify Firestore PITR enabled
6. Verify uploads bucket versioning + 90d soft-delete
7. Provision `backup-sa` service account with `roles/datastore.importExportAdmin` + `roles/storage.objectAdmin` on the backups bucket
8. Paste evidence (gcloud describe outputs) for verification

## Why deferred (not blocked)

- Waves 2-5 only land code + tests (no production deploys)
- Production deploys for all 8 Phase 8 Cloud Functions happen in Wave 6 (08-06)
- Batching all operator gcloud work into Wave 6 reduces operator interrupts from 2 to 1
- This deferral does NOT violate Pitfall 10 — Pitfall 10 requires backup-substrate-live before GDPR erasure RUNS in production. Code can land safely; only the production deploy (Wave 6) actually executes against the real GCS bucket.

## Wave 6 dependency

Plan 08-06 Task 1 (deploy 8 functions) MUST be preceded by completion of this deferred checkpoint, otherwise `scheduledFirestoreExport` will fail on first invocation (Pitfall F — bucket not found).
