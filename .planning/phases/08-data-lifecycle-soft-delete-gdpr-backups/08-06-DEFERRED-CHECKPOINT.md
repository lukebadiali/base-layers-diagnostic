---
plan: 08-06
status: code_and_docs_complete_operator_pending
deferred_to: single operator session (Hugh or Luke)
deferred_at: 2026-05-10
reason: |
  All code, tests, and documentation are authored and committed.
  Production deployment and restore drill are operator-gated actions
  batched into one session to minimise context-switching.
  Mirrors the 08-01-DEFERRED-CHECKPOINT.md pattern.
---

# 08-06 Operator Checkpoint — Phase 8 Production Deploy + Restore Drill

## What is code-complete and committed

All Phase 8 Cloud Functions are authored, tested, and committed across Waves 1–5:

| Function | Source | Wave | Tests |
|----------|--------|------|-------|
| `scheduledFirestoreExport` | `functions/src/backup/scheduledFirestoreExport.ts` | 08-02 | 5 unit |
| `getDocumentSignedUrl` | `functions/src/backup/getDocumentSignedUrl.ts` | 08-02 | 7 unit |
| `softDelete` | `functions/src/lifecycle/softDelete.ts` | 08-03 | unit + integration |
| `restoreSoftDeleted` | `functions/src/lifecycle/restoreSoftDeleted.ts` | 08-03 | unit + integration |
| `scheduledPurge` | `functions/src/lifecycle/scheduledPurge.ts` | 08-03 | unit (1200-doc) |
| `permanentlyDeleteSoftDeleted` | `functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts` | 08-03 | unit |
| `gdprExportUser` | `functions/src/gdpr/gdprExportUser.ts` | 08-04 | 7 unit + 3 integration |
| `gdprEraseUser` | `functions/src/gdpr/gdprEraseUser.ts` | 08-05 | 8 unit + 1 integration |

Total functions in `functions/src/index.ts`: 17 exports.
Total functions tests at 08-05 close: 233.

Documentation authored this wave (08-06):
- `runbooks/restore-drill-2026-05-13.md` — BACKUP-07 template (operator fills timings)
- `runbooks/phase-8-restore-drill-cadence.md` — BACKUP-06 quarterly cadence
- `SECURITY.md` — 4 new Phase 8 sections + 19-row Phase 8 Audit Index (DOC-10)
- `.planning/REQUIREMENTS.md` — 18 rows flipped to `[x]` + Traceability table updated
- `runbooks/phase-8-cleanup-ledger.md` — zero-out gate (`phase_8_active_rows: 0`)

---

## Operator Action Plan — Single Session

Run in the order below. The ordering matters:
1. Substrate verification FIRST (secrets + SAs)
2. Cloud Functions deploy SECOND (so callables exist before rules deploy)
3. Firestore rules deploy THIRD (rules predicate becomes live; client queries now gated)
4. Smoke tests FOURTH
5. Restore drill FIFTH (exercises the deployed infrastructure)
6. Fill in the drill runbook + commit SIXTH
7. Close-gate review SEVENTH

Estimated session time: 60–90 minutes.

---

## Step 0 — Pre-Deploy Verification

### 0.1 Build + test confirmation

```bash
cd functions && npm run build && npm test 2>&1 | tail -10
```

Expected: exit 0; "Test Files X passed"; total ≥ 233 tests.

### 0.2 Confirm secrets + service accounts (from 08-01 + 08-05 runbooks)

```bash
# GDPR_PSEUDONYM_SECRET must exist before deploy
gcloud secrets describe GDPR_PSEUDONYM_SECRET \
  --project=bedeveloped-base-layers \
  --format="value(name)"
# Expected: projects/<num>/secrets/GDPR_PSEUDONYM_SECRET

# All 5 Phase 8 SAs must exist (backup-sa + 4 from §7 of phase-8-backup-setup.md)
gcloud iam service-accounts list \
  --project=bedeveloped-base-layers \
  --format="value(email)" \
  | grep -E "(backup-sa|storage-reader-sa|lifecycle-sa|gdpr-reader-sa|gdpr-writer-sa)"
```

Expected: 5 SA emails printed.

If either check fails: complete `runbooks/phase-8-backup-setup.md` §5 (backup-sa) and §7 (GDPR secrets + 4 SAs) before proceeding to Step 1.

---

## Step 1 — Deploy 8 Phase 8 Cloud Functions

Deploy selectively (Pitfall 8 — preserves Phase 6/7 invoker bindings on other functions):

```bash
cd <repo-root>
firebase deploy --only \
  functions:scheduledFirestoreExport,\
functions:getDocumentSignedUrl,\
functions:softDelete,\
functions:restoreSoftDeleted,\
functions:permanentlyDeleteSoftDeleted,\
functions:scheduledPurge,\
functions:gdprExportUser,\
functions:gdprEraseUser \
  --project=bedeveloped-base-layers
```

Expected output: 8 functions deployed; URLs printed for each callable; cron jobs registered for `scheduledFirestoreExport` and `scheduledPurge`.

**Record evidence:**

```
step_1_at: <ISO timestamp>
operator: <email>
functions_deployed: 8
deploy_exit_code: <0 or error>
deploy_output_tail: |
  <paste last 20 lines of firebase deploy output>
```

---

## Step 2 — Deploy Firestore Rules

Deploy rules AFTER functions (client queries only gate once rules are live; functions must exist first so callable seams have something to route to):

```bash
firebase deploy --only firestore:rules --project=bedeveloped-base-layers
```

Expected: "Rules deployed successfully" + version increment in Firebase Console at
`https://console.firebase.google.com/project/bedeveloped-base-layers/firestore/rules`.

**Record evidence:**

```
step_2_at: <ISO timestamp>
rules_deployed: YES
rules_version_in_console: <paste version number>
console_check_url: https://console.firebase.google.com/project/bedeveloped-base-layers/firestore/rules
```

---

## Step 3 — Smoke Tests

### 3.1 Confirm 8 functions ACTIVE

```bash
gcloud functions list \
  --regions=europe-west2 \
  --project=bedeveloped-base-layers \
  --format="table(name,entryPoint,state)" \
  | grep -E "(scheduledFirestoreExport|getDocumentSignedUrl|softDelete|restoreSoftDeleted|permanentlyDeleteSoftDeleted|scheduledPurge|gdprExportUser|gdprEraseUser)"
```

Expected: 8 rows, each with state `ACTIVE`.

### 3.2 Confirm scheduler jobs registered

```bash
gcloud scheduler jobs list \
  --location=europe-west2 \
  --project=bedeveloped-base-layers \
  --format="value(name,schedule)" \
  | grep -E "(firestore-export|scheduledPurge)"
```

Expected: 2 entries (daily export at 02:00 UTC; daily purge at 03:00 UTC).

### 3.3 Trigger first export (one-shot manual test)

```bash
gcloud scheduler jobs run \
  firebase-schedule-scheduledFirestoreExport-europe-west2 \
  --location=europe-west2 \
  --project=bedeveloped-base-layers
```

Wait 3–5 minutes, then verify:

```bash
gcloud storage ls gs://bedeveloped-base-layers-backups/firestore/
```

Expected: at least one `<YYYY-MM-DD>/` directory with Firestore export metadata files.

### 3.4 Verify rules predicate is live (negative smoke test)

Open the deployed app; sign in as a client user; navigate to a data list view (dashboard or chat). If the client data wrappers correctly add `where("deletedAt", "==", null)`, lists render. If they do not, lists fail with `permission-denied`. Note the outcome.

**Record evidence:**

```
step_3_1_at: <ISO>
functions_active_count: <8>
step_3_2_at: <ISO>
scheduler_jobs_found: <2>
step_3_3_at: <ISO>
first_export_directory: <YYYY-MM-DD>
step_3_4_at: <ISO>
client_list_render_result: <PASS — lists render correctly | FAIL — permission-denied; investigate>
```

---

## Step 4 — Restore Drill (BACKUP-07)

Open `runbooks/restore-drill-2026-05-13.md` and execute each timed step, filling in the actual timestamps and command outputs as you go.

Summary of drill steps (full commands in the runbook):

1. Set `SNAPSHOT_TIME` + `DEST_DB` variables.
2. `gcloud firestore databases clone ...` — record elapsed time.
3. `gcloud firestore documents list --database=$DEST_DB --collection-id=orgs ...` — spot-check.
4. Check `redactionList` in production; document re-redaction outcome (expect NO-OP at Phase 8 close).
5. `gcloud firestore databases delete "$DEST_DB" ...` — cleanup.

After completing the drill, fill in the `Sign-off` block in `runbooks/restore-drill-2026-05-13.md` and commit:

```bash
git add runbooks/restore-drill-2026-05-13.md
git commit -m "docs: restore-drill-2026-05-13 BACKUP-07 evidence — operator drill complete"
```

**Record evidence:**

```
step_4_drill_path: A (PITR clone)
step_4_clone_elapsed_seconds: <fill>
step_4_rto_met: <YES | NO>
step_4_redaction_list_empty: <YES | NO>
step_4_drill_result: <PASS | FAIL>
step_4_commit_sha: <fill after commit>
```

---

## Step 5 — Close-Gate Review

Operator final verification pass. Confirm ALL items before marking Phase 8 complete.

### 5.1 Deployment state

```bash
gcloud functions list \
  --regions=europe-west2 \
  --project=bedeveloped-base-layers \
  --format="value(name,state)" \
  | grep -E "(scheduledFirestoreExport|getDocumentSignedUrl|softDelete|restoreSoftDeleted|permanentlyDeleteSoftDeleted|scheduledPurge|gdprExportUser|gdprEraseUser)"
```

Expected: 8 ACTIVE.

### 5.2 Rules version

Open `https://console.firebase.google.com/project/bedeveloped-base-layers/firestore/rules` and confirm:
- Latest version is dated today
- Contains the 5 `notDeleted(resource.data)` conjuncts (search "notDeleted")
- Contains the `redactionList` match block (search "redactionList")

### 5.3 Restore drill artifact

```bash
test -f runbooks/restore-drill-2026-05-13.md \
  && grep -c "operator:" runbooks/restore-drill-2026-05-13.md \
  && echo "FOUND"
```

Confirm the `Sign-off` section has operator name + date + commit SHA filled in (no `{{ }}` placeholders in sign-off block).

### 5.4 SECURITY.md

```bash
grep -c "^## § " SECURITY.md
# Expected: ≥ 27 (23 baseline + 4 Phase 8 sections)
grep "Phase 8 Audit Index" SECURITY.md | head -1
# Expected: "## § Phase 8 Audit Index"
```

### 5.5 REQUIREMENTS.md

```bash
grep -c "Closed Phase 8" .planning/REQUIREMENTS.md
# Expected: 18
grep -c "Validated 2026-05-13" .planning/REQUIREMENTS.md
# Expected: 3 (LIFE + GDPR + BACKUP traceability rows)
```

### 5.6 Cleanup ledger

```bash
grep "phase_8_active_rows" runbooks/phase-8-cleanup-ledger.md
# Expected: phase_8_active_rows: 0
```

### 5.7 Phase 8 complete — STATE.md flip

After all 6 checks above pass, update `.planning/STATE.md`:
- Phase 8 status: COMPLETE
- Current Position: Phase 9 (Observability)
- Last updated: <date operator completes>

The orchestrator (`/gsd-execute-phase`) handles the STATE.md update; the operator confirms the pre-conditions are met.

**Close-gate sign-off record:**

```
close_gate_date: <YYYY-MM-DD>
operator: <email>
check_5_1_functions_active: <8 ACTIVE | FAIL>
check_5_2_rules_version: <PASS | FAIL>
check_5_3_drill_artifact: <PASS | FAIL>
check_5_4_security_md: <27+ sections | FAIL>
check_5_5_requirements_md: <18 Closed Phase 8 | FAIL>
check_5_6_cleanup_ledger: <phase_8_active_rows: 0 | FAIL>
phase_8_status: <COMPLETE | BLOCKED — describe>
phase_9_unblocked: <YES | NO>
```

---

## Combined gcloud + firebase Command Sequence

Single-session command block for copy-paste. Run in order; stop if any step errors.

```bash
# === Phase 8 Wave 6 — Production Deploy Session ===
# Pre-requisites: gcloud authenticated + firebase login + ADC configured
# Estimated time: 60–90 min including drill

# --- Step 0: Pre-deploy checks ---
gcloud secrets describe GDPR_PSEUDONYM_SECRET --project=bedeveloped-base-layers --format="value(name)"
gcloud iam service-accounts list --project=bedeveloped-base-layers --format="value(email)" | grep -E "(backup-sa|storage-reader-sa|lifecycle-sa|gdpr-reader-sa|gdpr-writer-sa)"
cd functions && npm run build && npm test 2>&1 | tail -10

# --- Step 1: Deploy 8 Phase 8 Cloud Functions ---
cd ..
firebase deploy --only \
  functions:scheduledFirestoreExport,\
functions:getDocumentSignedUrl,\
functions:softDelete,\
functions:restoreSoftDeleted,\
functions:permanentlyDeleteSoftDeleted,\
functions:scheduledPurge,\
functions:gdprExportUser,\
functions:gdprEraseUser \
  --project=bedeveloped-base-layers

# --- Step 2: Deploy Firestore rules ---
firebase deploy --only firestore:rules --project=bedeveloped-base-layers

# --- Step 3: Smoke tests ---
gcloud functions list --regions=europe-west2 --project=bedeveloped-base-layers --format="table(name,state)" | grep -E "(scheduledFirestoreExport|getDocumentSignedUrl|softDelete|restoreSoftDeleted|permanentlyDeleteSoftDeleted|scheduledPurge|gdprExportUser|gdprEraseUser)"

gcloud scheduler jobs list --location=europe-west2 --project=bedeveloped-base-layers --format="value(name,schedule)" | grep -E "(firestore-export|scheduledPurge)"

# Trigger first export (manual one-shot)
gcloud scheduler jobs run firebase-schedule-scheduledFirestoreExport-europe-west2 --location=europe-west2 --project=bedeveloped-base-layers
# Wait 3–5 min then:
gcloud storage ls gs://bedeveloped-base-layers-backups/firestore/

# --- Step 4: Restore drill (Path A — PITR clone) ---
SNAPSHOT_TIME="2026-05-13T08:00:00.00Z"   # adjust to ≤ 7 days old
DEST_DB="restore-drill-$(date -u +%Y%m%d-%H%M)"
time gcloud firestore databases clone \
  --source-database="projects/bedeveloped-base-layers/databases/(default)" \
  --snapshot-time="$SNAPSHOT_TIME" \
  --destination-database="$DEST_DB" \
  --project=bedeveloped-base-layers

# Spot-check
gcloud firestore documents list --database="$DEST_DB" --collection-id=orgs --project=bedeveloped-base-layers --limit=5

# Check redactionList (expect 0 entries at Phase 8 close)
gcloud firestore documents list --database="(default)" --collection-id=redactionList --project=bedeveloped-base-layers --limit=10

# Cleanup
gcloud firestore databases delete "$DEST_DB" --project=bedeveloped-base-layers

# Fill in runbooks/restore-drill-2026-05-13.md then commit:
# git add runbooks/restore-drill-2026-05-13.md
# git commit -m "docs: restore-drill-2026-05-13 BACKUP-07 evidence — operator drill complete"
```

---

## Rollback Path

If Cloud Functions deploy fails or rules cause `permission-denied` on client lists:

```bash
# Rollback rules to previous version
# (find previous version SHA from Firebase Console → Rules → History)
git revert <rules-commit-sha> --no-edit
git push
# CI deploys previous rules automatically via the firebase deploy job on main

# OR manual rollback:
firebase deploy --only firestore:rules --project=bedeveloped-base-layers
# (after reverting firestore.rules in git)
```

If individual function fails to deploy, re-deploy selectively:

```bash
firebase deploy --only functions:<functionName> --project=bedeveloped-base-layers
```

---

## Why Deferred (Not Blocked)

- Waves 2–5 (08-02 through 08-05) only landed code + tests — no production deploys
- Production deploys for all 8 Phase 8 Cloud Functions happen in Wave 6 (08-06)
- Batching all operator gcloud/firebase work into one session reduces operator interrupts from 3 to 1 (08-01 deferred + 08-05 SA provisioning deferred + 08-06 deploy + drill = single session)
- This deferral does NOT violate Pitfall 10 — Pitfall 10 requires backup-substrate-live BEFORE GDPR erasure RUNS in production. Code can land safely; only the production deploy (Wave 6) executes against the real GCS bucket and Firestore

## Dependency Note

08-01-DEFERRED-CHECKPOINT.md §7 (backup-sa provisioning) and 08-05 Task 7 (GDPR secrets + 4 SAs) MUST be complete before Step 1 above. This checkpoint collates all three deferred sets into the single operator session.
