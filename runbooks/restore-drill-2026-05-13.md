# Phase 8 — BACKUP-07 Restore Drill

> **Phase:** 8 — Data Lifecycle (Soft-Delete + GDPR + Backups)
> **Requirement satisfied:** BACKUP-07 — one restore drill performed and documented before milestone close
> **Date authored:** 2026-05-10 (template); operator fills in actual timings during execution on 2026-05-13
> **Operator:** Hugh / Luke (bedeveloped.com)
> **Objective:** Demonstrate ability to restore Firestore data from PITR within the 1h RTO target. Exercise the re-redaction propagation step (GDPR-05 closure). Record every timing and gap honestly per Pitfall 19 (substrate-honest disclosure).

---

## Restore Path Chosen

**Path A — PITR clone** (recommended path; selected here).

**Rationale:** Staging project (`bedeveloped-base-layers-staging`) is not yet provisioned at Phase 8 close. Path A clones the production database at a fixed snapshot timestamp into a throwaway database ID on the same project. Demonstrates Firestore PITR (BACKUP-03) end-to-end. Lower blast radius than Path B (no GCS egress; no staging dependency). Path B (GCS export → staging) will be exercised when a staging project is available.

---

## Pre-conditions (verify before starting)

- [ ] Firestore PITR enabled: `gcloud firestore databases describe --database="(default)" --format="value(pointInTimeRecoveryEnablement)"` returns `POINT_IN_TIME_RECOVERY_ENABLED`
- [ ] GCS backups bucket has ≥ 1 daily export: `gcloud storage ls gs://bedeveloped-base-layers-backups/firestore/` returns ≥ 1 directory
- [ ] Operator has `roles/datastore.owner` on `bedeveloped-base-layers`
- [ ] `gcloud auth list` shows active account is operator's `bedeveloped.com` identity
- [ ] 8 Phase 8 Cloud Functions are ACTIVE (Task 1 deploy prerequisite)

---

## Timed Steps

**Step 1 — Set variables + choose snapshot timestamp**

```bash
SNAPSHOT_TIME="2026-05-13T08:00:00.00Z"   # adjust to a whole-minute timestamp ≤ 7 days old
DEST_DB="restore-drill-$(date -u +%Y%m%d-%H%M)"
echo "Snapshot: $SNAPSHOT_TIME"
echo "Destination DB: $DEST_DB"
```

```
step_1_at: {{ T+0 }}
snapshot_time_chosen: {{ fill in: 2026-05-13TXX:XX:00.00Z }}
dest_db_id: {{ fill in: restore-drill-YYYYMMDD-HHMM }}
```

**Step 2 — Trigger PITR clone**

```bash
time gcloud firestore databases clone \
  --source-database="projects/bedeveloped-base-layers/databases/(default)" \
  --snapshot-time="$SNAPSHOT_TIME" \
  --destination-database="$DEST_DB" \
  --project=bedeveloped-base-layers
```

Expected: command exits 0; output includes `done: true` and a new database appears at `https://console.firebase.google.com/project/bedeveloped-base-layers/firestore`. The `time` prefix records elapsed wall-clock seconds.

```
step_2_at: {{ T+0 to T+? }}
clone_elapsed_seconds: {{ fill in: X seconds }}
clone_exit_code: {{ fill in: 0 or error }}
clone_output_summary: {{ fill in: "done: true" or error message }}
```

**Step 3 — Spot-check restored data**

```bash
# Count orgs in restored DB (sanity check — should be > 0 if production has data)
gcloud firestore documents list \
  --database="$DEST_DB" \
  --collection-id=orgs \
  --project=bedeveloped-base-layers \
  --limit=5
```

Expected: ≥ 1 org document listed; structure matches production at snapshot time (org IDs visible; no PII recorded here).

```
step_3_at: {{ T+? }}
orgs_listed_count: {{ fill in: N }}
spot_check_org_ids: {{ fill in: doc ID list — no PII }}
spot_check_result: {{ PASS | FAIL }}
```

**Step 4 — Check redactionList (GDPR-05 propagation)**

```bash
# Count entries in redactionList (production default DB)
gcloud firestore documents list \
  --database="(default)" \
  --collection-id=redactionList \
  --project=bedeveloped-base-layers \
  --limit=10
```

Expected: If redactionList is empty (no real erasures performed at Phase 8 close), document this as a NO-OP drill for the re-redaction step — this is the expected state at initial milestone close.

```
step_4_at: {{ T+? }}
redaction_list_entry_count: {{ fill in: 0 or N }}
re_redaction_step: {{ NO-OP (redactionList empty at Phase 8 close) | APPLIED (N entries re-tombstoned in clone) }}
re_redaction_notes: {{ fill in }}
```

**Step 5 — Cleanup drill database**

```bash
gcloud firestore databases delete "$DEST_DB" --project=bedeveloped-base-layers
```

Expected: command exits 0; drill database deleted; production `(default)` database untouched.

```
step_5_at: {{ T+? }}
drill_db_deleted: {{ YES | NO }}
production_db_untouched_confirmed: {{ YES | NO }}
```

---

## Spot-Check Results

```
collections_inspected: orgs
sample_doc_ids_inspected: {{ fill in: comma-separated org doc IDs — no PII }}
data_structure_matches_production: {{ YES | PARTIAL | NO }}
notes: {{ fill in any structural differences noticed }}
```

---

## Re-Redaction Step (GDPR-05 closure)

**Purpose:** After a PITR restore, the cloned database reflects state at the snapshot time. If any users were erased after the snapshot, their tombstones are absent from the clone. The `redactionList/{uid}` collection tracks all erasure events; the operator re-applies tombstones to the clone before using it for any purpose.

**Outcome for this drill:**

```
redaction_list_empty_at_drill_time: {{ YES | NO }}
re_redaction_outcome: |
  {{ If YES: "redactionList was empty at Phase 8 close — no erasures performed yet. Re-redaction is NO-OP for this drill. This is the expected state. When real erasures accumulate, future quarterly drills must iterate redactionList and re-apply tombstones to the restored DB using the post-erasure-audit script (scripts/post-erasure-audit/run.js) modified to target the clone database." }}
  {{ If NO: describe each re-applied tombstone — uid (anonymised), collection, count }}
```

---

## Cleanup

```
drill_database_deleted: {{ YES | NO }}
deletion_confirmed_at: {{ T+? }}
production_database_verified_untouched: {{ YES | NO }}
verification_method: {{ fill in: "gcloud firestore databases list showed only (default) and audit_logs_bq after deletion" }}
```

---

## Gaps Found

```
gaps:
  - {{ fill in: e.g. "PITR clone took Xs — within/exceeds 1h RTO target" }}
  - {{ fill in: e.g. "redactionList re-redaction is operator-manual; v2 candidate for automation in Phase 9 or Phase 11" }}
  - {{ fill in: e.g. "gcloud documents list --collection-id does not support subcollections; subcollection spot-check required separate loop" }}
  - {{ fill in: "NONE" if no gaps }}
```

---

## RTO Achieved

```
drill_start_time: {{ T+0 }}
data_restored_time: {{ T+? (end of Step 3 — data confirmed present in clone) }}
total_elapsed_minutes: {{ fill in }}
rto_target_minutes: 60
rto_met: {{ YES | NO }}
rto_notes: {{ fill in }}
```

---

## Sign-off

```
operator: {{ fill in: Hugh / Luke }}
drill_date: 2026-05-13
commit_sha_at_drill_time: {{ fill in: git rev-parse --short HEAD }}
result: {{ PASS | FAIL }}
next_drill_date: 2026-08-13 (Q3-2026 — per runbooks/phase-8-restore-drill-cadence.md)
```

---

## Citations

- BACKUP-07 — One restore drill performed and documented before milestone close
- BACKUP-03 — Firestore PITR enabled (7-day rolling); this drill exercises it
- GDPR-05 — Erasure propagation to backups via redactionList; re-redaction step above
- 08-RESEARCH.md §Pattern 3 — PITR clone commands + cost model
- Pitfall 10 — Backup substrate must be live before GDPR erasure runs (ordering constraint honoured: drill performed after deploy)
- Pitfall 19 — Substrate-honest disclosure: timestamp placeholders are operator-filled; claims are only made about verified outcomes
