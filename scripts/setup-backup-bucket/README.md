# scripts/setup-backup-bucket

Phase 8 Wave 1 — one-shot idempotent ADC script that provisions the backup
substrate (GCS backups bucket + lifecycle policy + Firestore PITR + uploads
bucket versioning + soft-delete) before any Phase 8 Cloud Function deploys.

This script must be run by an operator BEFORE deploying Wave 2's
`scheduledFirestoreExport` Cloud Function. Skipping this step causes the
function to fail with "bucket not found" on first invocation (Pitfall F in
08-RESEARCH.md).

## Prerequisites

- Google Cloud SDK (gcloud) installed. Verify: `gcloud --version`
- Authenticated via Application Default Credentials:
  ```bash
  gcloud auth application-default login
  ```
- The authenticated account must hold `roles/owner` on `bedeveloped-base-layers`
  OR the composite of `roles/storage.admin` + `roles/datastore.owner`.
- Working directory must be the repo root.
- The uploads bucket `gs://bedeveloped-base-layers-uploads` must already exist
  (created in Phase 5). The script will fail with an explicit error if missing.

## Usage

```bash
# Dry-run first — review planned actions without making any changes:
node scripts/setup-backup-bucket/run.js --dry-run --project=bedeveloped-base-layers

# Real run — applies all changes:
node scripts/setup-backup-bucket/run.js --project=bedeveloped-base-layers

# Re-run idempotency check (all steps should report [SKIP]):
node scripts/setup-backup-bucket/run.js --project=bedeveloped-base-layers
```

## Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--project=<id>` | `bedeveloped-base-layers` | GCP project ID override |
| `--dry-run` | off | Print planned actions; make no mutations |
| `--help`, `-h` | — | Print usage and exit 0 |

## What each step does

| Step | Action | Idempotent? |
|------|--------|-------------|
| 1 | Verify ADC (`gcloud auth application-default print-access-token`) | n/a (fast-fail) |
| 2 | Create `gs://bedeveloped-base-layers-backups` in `europe-west2` with UBLA + PAP | Yes — skips if bucket exists in correct location |
| 3 | Apply lifecycle policy from `lifecycle.json` (30d Standard→Nearline, 365d Nearline→Archive) | Yes — gcloud is idempotent on identical policy |
| 4 | Enable Firestore PITR on `(default)` database | Yes — skips if `POINT_IN_TIME_RECOVERY_ENABLED` |
| 5 | Enable Object Versioning on `gs://bedeveloped-base-layers-uploads` | Yes — skips if `versioning.enabled == True` |
| 6 | Set soft-delete retention to 90 days (`7776000s`) on uploads bucket | Yes — skips if retention already matches |
| 7 | Print summary table | — |

## Lifecycle policy semantics

See `lifecycle.notes.md` for full explanation of GCS `age`-based dwell-time.
Short version: objects spend ~335 days in Nearline (day 30 to day 365),
satisfying BACKUP-02's 90d Nearline minimum.

## Why this must run before Phase 8 Cloud Function deploys

Per 08-RESEARCH.md Pitfall F (Backup bucket does not exist before
`scheduledFirestoreExport` deploys): the Cloud Function will fail with a GCS
404 error on its first invocation if the bucket does not exist. The bucket and
its lifecycle policy must be provisioned as a pre-deploy operator step, not
as part of the function itself.

## Expected dry-run output (ADC configured)

```
=== Phase 8 backup substrate setup (project=bedeveloped-base-layers, DRY-RUN) ===

[OK] ADC verified (application-default access token obtained)
[DRY-RUN] would run: gcloud storage buckets create gs://bedeveloped-base-layers-backups ...
[DRY-RUN] would run: gcloud storage buckets update gs://bedeveloped-base-layers-backups --lifecycle-file=<...>/lifecycle.json ...
[DRY-RUN] would run: gcloud firestore databases update --database=(default) --enable-pitr ...
[DRY-RUN] would run: gcloud storage buckets update gs://bedeveloped-base-layers-uploads --versioning ...
[DRY-RUN] would run: gcloud storage buckets update gs://bedeveloped-base-layers-uploads --soft-delete-duration=7776000s ...

=== Summary ===
  Resource                         Status               Detail
  ------------------------------ -------------------- --------------------
  gs://bedeveloped-base-layers-backups created              location=europe-west2, UBLA, PAP
    lifecycle policy             applied              30d Standard→Nearline, 365d Nearline→Archive
  Firestore PITR                 enabled              (default) database, 7-day window
  gs://bedeveloped-base-layers-uploads
    versioning                   enabled              Object Versioning
    soft-delete                  set                  7776000s = 90 days

[OK] Dry-run complete; no mutations performed.
```

## Expected idempotent re-run output (after initial run)

All steps report `[SKIP] already in desired state` and the script exits 0.

## Operator runbook

For full verification commands, IAM additions for `backup-sa`, troubleshooting,
and rollback steps, see `runbooks/phase-8-backup-setup.md`.

## Citations

- 08-RESEARCH.md Pattern 2 (lifecycle JSON), Pattern 3 (PITR), Pattern 4 (versioning + soft-delete)
- Pitfall 10 — backup substrate before erasure/soft-delete
- Pitfall 13 — ADC only; no service-account JSON in source
- BACKUP-02, BACKUP-03, BACKUP-04 (Phase 8 requirements)
