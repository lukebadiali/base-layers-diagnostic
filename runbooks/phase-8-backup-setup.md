# Phase 8 Wave 1 — Backup Substrate Setup

> Phase: 8 — Data Lifecycle (Soft-Delete + GDPR + Backups)
> Requirements: BACKUP-02 + BACKUP-03 + BACKUP-04
> Date authored: 2026-05-10
> Objective: Provision GCS backups bucket + Firestore PITR + uploads bucket
> versioning/soft-delete before any Phase 8 Cloud Function deploys (Pitfall 10).

This runbook documents the one-shot operator procedure that runs
`scripts/setup-backup-bucket/run.js` against `bedeveloped-base-layers` and
records the evidence of each GCP resource being in the desired state. Wave 2
(08-02 `scheduledFirestoreExport`) CANNOT be deployed until Steps 1-2 below
are complete — the Cloud Function will fail with "bucket not found" (Pitfall F)
on first invocation otherwise.

---

## 1. Prerequisites

- **gcloud SDK version:** ≥ 480.0.0. Verify:
  ```bash
  gcloud --version
  ```
- **ADC configured** by an operator who holds `roles/owner` on
  `bedeveloped-base-layers` (or the composite of `roles/storage.admin` +
  `roles/datastore.owner`):
  ```bash
  gcloud auth application-default login
  gcloud auth list
  # Expected: active account is operator's bedeveloped.com identity
  ```
- **Working directory:** repo root (where this runbook is checked in).
- **Commit checked out:** the commit that introduced
  `scripts/setup-backup-bucket/run.js` (Phase 8 Wave 1; refer to git log for
  the exact SHA — it is the `feat(08-01)` commit on the Phase 8 branch).
- **uploads bucket must already exist:** `gs://bedeveloped-base-layers-uploads`
  was created in Phase 5. The script will fail with an explicit error message
  if it is missing.

---

## 2. Project context

```bash
gcloud config set project bedeveloped-base-layers
gcloud config get-value project
# Expected: bedeveloped-base-layers
```

---

## 3. One-shot script execution

### 3.1 Dry-run first

Review all planned actions before making any changes:

```bash
node scripts/setup-backup-bucket/run.js --dry-run --project=bedeveloped-base-layers
```

Expected stdout (ADC configured):

```
=== Phase 8 backup substrate setup (project=bedeveloped-base-layers, DRY-RUN) ===

[OK] ADC verified (application-default access token obtained)
[DRY-RUN] would run: gcloud storage buckets create gs://bedeveloped-base-layers-backups --project=bedeveloped-base-layers --location=europe-west2 --uniform-bucket-level-access --public-access-prevention=enforced
[DRY-RUN] would run: gcloud storage buckets update gs://bedeveloped-base-layers-backups --lifecycle-file=<...>/lifecycle.json --project=bedeveloped-base-layers
[DRY-RUN] would run: gcloud firestore databases update --database=(default) --enable-pitr --project=bedeveloped-base-layers
[DRY-RUN] would run: gcloud storage buckets update gs://bedeveloped-base-layers-uploads --versioning --project=bedeveloped-base-layers
[DRY-RUN] would run: gcloud storage buckets update gs://bedeveloped-base-layers-uploads --soft-delete-duration=7776000s --project=bedeveloped-base-layers

=== Summary ===
  ...

[OK] Dry-run complete; no mutations performed.
```

### 3.2 Real run

```bash
node scripts/setup-backup-bucket/run.js --project=bedeveloped-base-layers
```

Expected: 6-step summary table at exit; exit code 0. Each step should print
either `[OK] <action>` (first run) or `[SKIP] already in desired state`
(re-run). Paste actual stdout below:

```
run_at: <ISO timestamp>
operator: <email>
exit_code: 0
<paste full stdout here>
```

### 3.3 Re-run idempotency check

Re-run the real command immediately after the first run:

```bash
node scripts/setup-backup-bucket/run.js --project=bedeveloped-base-layers
```

Expected: every step reports `[SKIP] already in desired state`. Exit code 0.

---

## 4. Manual verification commands

Run each command below and paste the output to confirm resources exist with
the correct configuration.

### 4.1 Backups bucket — location + UBLA + PAP

```bash
gcloud storage buckets describe gs://bedeveloped-base-layers-backups \
  --format="value(location,iamConfiguration.uniformBucketLevelAccess.enabled,iamConfiguration.publicAccessPrevention)"
```

Expected: `EUROPE-WEST2  True  enforced`

### 4.2 Lifecycle rules

```bash
gcloud storage buckets describe gs://bedeveloped-base-layers-backups --format=json \
  | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(JSON.stringify(d.lifecycle.rule, null, 2))"
```

Expected: 2 rules — `STANDARD→NEARLINE @ 30d` and `NEARLINE→ARCHIVE @ 365d`:

```json
[
  {
    "action": { "type": "SetStorageClass", "storageClass": "NEARLINE" },
    "condition": { "age": 30, "matchesStorageClass": ["STANDARD"] }
  },
  {
    "action": { "type": "SetStorageClass", "storageClass": "ARCHIVE" },
    "condition": { "age": 365, "matchesStorageClass": ["NEARLINE"] }
  }
]
```

### 4.3 Firestore PITR

```bash
gcloud firestore databases describe --database="(default)" \
  --format="value(pointInTimeRecoveryEnablement)"
```

Expected: `POINT_IN_TIME_RECOVERY_ENABLED`

### 4.4 Uploads bucket versioning + soft-delete

```bash
gcloud storage buckets describe gs://bedeveloped-base-layers-uploads \
  --format="value(versioning.enabled,softDeletePolicy.retentionDurationSeconds)"
```

Expected: `True  7776000s`

---

## 5. IAM additions for downstream waves

Run these commands AFTER the setup script succeeds. The `backup-sa` service
account is required by Wave 2's `scheduledFirestoreExport` Cloud Function.
Without it, the function deploy will fail or the first invocation will fail
with a permission-denied error.

```bash
# 5.1 Create the backup service account (idempotent with || echo)
gcloud iam service-accounts create backup-sa \
  --display-name="Phase 8 Firestore export writer" \
  --project=bedeveloped-base-layers \
  || echo "[SKIP] already exists"

# 5.2 Grant project-level Firestore export role
gcloud projects add-iam-policy-binding bedeveloped-base-layers \
  --member="serviceAccount:backup-sa@bedeveloped-base-layers.iam.gserviceaccount.com" \
  --role="roles/datastore.importExportAdmin"

# 5.3 Grant bucket-level write access to the backups bucket only
gcloud storage buckets add-iam-policy-binding gs://bedeveloped-base-layers-backups \
  --member="serviceAccount:backup-sa@bedeveloped-base-layers.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

Expected: each command exits 0 (or prints `[SKIP] already exists` for step 5.1
if the SA was previously created).

Verify SA and bindings:

```bash
# Confirm SA exists
gcloud iam service-accounts describe \
  backup-sa@bedeveloped-base-layers.iam.gserviceaccount.com \
  --project=bedeveloped-base-layers \
  --format="value(email,displayName)"
# Expected: backup-sa@bedeveloped-base-layers.iam.gserviceaccount.com  Phase 8 Firestore export writer

# Confirm project-level IAM binding
gcloud projects get-iam-policy bedeveloped-base-layers \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:backup-sa@bedeveloped-base-layers.iam.gserviceaccount.com" \
  --format="value(bindings.role)"
# Expected: roles/datastore.importExportAdmin
```

```
backup_sa_created_at: <ISO>
operator: <email>
iam_bindings_verified: <YES|NO>
```

---

## 6. Cost expectations

Per 08-RESEARCH.md Pattern 3 (Cost Model):

- **Firestore PITR:** billed separately from Firestore storage at the
  PITR-specific per-GB-month rate. Approximately the same order of magnitude
  as the live DB size. During hardening with minimal data, impact is negligible.
  Required on the Blaze plan (already active from Phase 7).

- **GCS lifecycle transitions (STANDARD → NEARLINE → ARCHIVE):** cost is
  negligible during hardening because daily export volume is small. As live
  data grows, Nearline and Archive storage are substantially cheaper than
  Standard for cold backup data.

- **Export read billing (Pitfall D):** Each daily `scheduledFirestoreExport`
  run incurs one read operation per document in Firestore. These are billed
  separately from normal Firestore read operations and appear in the GCP
  billing export, not in the standard Firestore usage dashboard. Accept as
  expected. Set a Firebase budget alert (Phase 9 OBS-07) to catch unexpected
  growth.

- **uploads bucket soft-delete retention:** Soft-deleted objects are charged at
  their storage class rate until the 90-day retention period expires. This is
  expected — the uploads bucket holds client documents, not ephemeral data.

---

## 7. Troubleshooting

| Error | Cause | Resolution |
|-------|-------|------------|
| `quota exceeded — bucket limit` | Project hit GCS bucket quota | Escalate; pre-existing project should be far below quota |
| `permission denied creating bucket` | Operator lacks `roles/storage.admin` | Check ADC identity: `gcloud auth list`; re-authenticate with correct account |
| `database update is locked` (PITR enable) | Firestore backend transient lock | Wait 30s, re-run the script |
| `softDeletePolicy not supported in this project` | Cloud Storage v2 not enabled | Project should already be on v2 (Blaze plan); contact GCP support if not |
| `uploads bucket not found` | Phase 5 bucket not yet created | Run Phase 5 operator steps first; this script requires the uploads bucket to already exist |
| ADC `[FAIL]` on dry-run | `gcloud auth application-default login` not run | Run `gcloud auth application-default login` and try again |

---

## 8. Rollback

**Firestore PITR:**
Can be disabled with:
```bash
gcloud firestore databases update --database="(default)" --no-pitr --project=bedeveloped-base-layers
```
Note: PITR storage costs stop accruing after disabling, but data retained
during the PITR window is not retroactively removed.

**GCS backups bucket lifecycle:**
Can be cleared with:
```bash
gcloud storage buckets update gs://bedeveloped-base-layers-backups --clear-lifecycle --project=bedeveloped-base-layers
```

**GCS backups bucket itself:**
Do NOT delete while Wave 2's `scheduledFirestoreExport` could be running.
If the bucket must be removed (e.g. wrong project), disable the scheduled
function first, then delete:
```bash
gcloud storage rm -r gs://bedeveloped-base-layers-backups  # CAUTION: deletes all backups
```

**uploads bucket versioning:**
Object Versioning can be disabled:
```bash
gcloud storage buckets update gs://bedeveloped-base-layers-uploads --no-versioning --project=bedeveloped-base-layers
```
Objects already in versioned/noncurrent state remain versioned until their
lifecycle or explicit deletion.

**uploads bucket soft-delete:**
Soft-delete retention can be set back to the default (7 days):
```bash
gcloud storage buckets update gs://bedeveloped-base-layers-uploads --soft-delete-duration=604800s --project=bedeveloped-base-layers
```
Objects already in soft-deleted state remain until the original 90-day
window expires.

---

## Citations

- 08-RESEARCH.md Pattern 1 — Scheduled Firestore Export (BACKUP-01, Wave 2)
- 08-RESEARCH.md Pattern 2 — GCS Lifecycle Policy (BACKUP-02)
- 08-RESEARCH.md Pattern 3 — Firestore PITR (BACKUP-03)
- 08-RESEARCH.md Pattern 4 — Storage Bucket Versioning + Soft Delete (BACKUP-04)
- PITFALLS.md §10 (Pitfall 10) — backup substrate must be live before soft-delete / GDPR erasure runs
- PITFALLS.md §13 (Pitfall 13) — ADC only; no service-account JSON in source ever
- BACKUP-02, BACKUP-03, BACKUP-04 — Phase 8 requirement IDs
