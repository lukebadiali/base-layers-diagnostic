# Phase 5 Pre-flight + Cutover Log

**Plan:** 05-05
**Created:** 2026-05-08
**Status:** RESOLVED — cutover executed 2026-05-08 ~17:10 UTC by `business@bedeveloped.com` (project Owner). Outcome: success (no-op against an empty production database). Stray-data cleanup deviation captured in §Notes.

This file is the canonical record of Wave 5 verifications consumed by Phase 5 close (Wave 6 verification gate per CONTEXT.md D-08) and downstream Phase 6 (which reads `cutover_outcome` to decide whether to proceed with RULES-07 deploy).

The schema mirrors Phase 3's `03-PREFLIGHT.md ## Cutover Log` (Phase 3 precedent — same idea applied to a database mutation rather than a DNS flip).

**How filled in:** see `runbooks/phase5-subcollection-migration.md` §3 (success path) or §5 (rollback path). Each block below cites the runbook section that produced the value.

---

## Pre-flight verifications (Wave 5 Task 2 — operator response)

Run these BEFORE invoking `runbooks/phase5-subcollection-migration.md` §3.1. Each maps to a runbook §1 Prerequisites checkbox.

```yaml
firestore_region: europe-west2
  # gcloud firestore databases describe --database='(default)' \
  #   --project=bedeveloped-base-layers --format=value(locationId)
  # Returned: europe-west2 (matches Phase 3 03-PREFLIGHT carry-forward expectation).

backup_bucket_exists: yes (created)
  # gsutil ls gs://bedeveloped-base-layers-backups/ initially returned
  # BucketNotFoundException; bucket created with:
  #   gsutil mb -l europe-west2 -p bedeveloped-base-layers \
  #     gs://bedeveloped-base-layers-backups
  # Verified post-create via `gsutil ls -L -b` -- Location constraint EUROPE-WEST2,
  # Storage class STANDARD.

operator_iam: yes (roles/owner — implicitly includes roles/datastore.importExportAdmin)
  # gcloud projects get-iam-policy bedeveloped-base-layers \
  #   --flatten='bindings[].members' \
  #   --filter='bindings.members:business@bedeveloped.com' \
  #   --format='value(bindings.role)'
  # Returned: roles/owner. The Owner role transitively grants
  # datastore.importExportAdmin per GCP IAM policy semantics, which is
  # why the explicit-grant check returned empty earlier.

adc_token_works: ya29.a0AQvPyIMMCitxR... (first 20 chars; full token redacted)
  # gcloud auth application-default print-access-token | Select-Object -First 1
  # Set with:
  #   gcloud auth application-default login   (as business@bedeveloped.com)
  #   gcloud auth application-default set-quota-project bedeveloped-base-layers

firebase_admin_version: "13.8.0"
  # npm pkg get devDependencies.firebase-admin -> "13.8.0".
  # Note: the dependency is declared on main but node_modules required a
  # fresh `npm install` post-merge (worktree node_modules don't transfer);
  # logged for future-orchestrator reference.

ci_phase5_waves_1_to_4_green: yes
  # `npm test` -> 65 files / 454 tests passed (post-Wave-4 baseline).
  # `npm run test:rules` not re-run for the cutover (Wave 1 emulator-suite
  # was last verified green at 176/176 in commit 4fe36b9).
  # `npm run test:migrate` covered indirectly via npm test (Wave 2 builders +
  # idempotency suites are in tests/scripts/migrate-subcollections/).

no_premature_rules_deploy: yes
  # `git log --grep="firebase deploy --only firestore:rules" -- .` matched
  # 3 commits (4fe36b9, 49afecb, 0c3f28e) -- all FALSE POSITIVES.
  # The match strings are inside commit-message bodies that explicitly
  # DOCUMENT the absence of the deploy command (e.g. "no firebase deploy
  # --only firestore:rules invocation anywhere"). Manual verification:
  # zero actual deploy invocations in the Phase 5 history.
```

---

## Cutover Log

Filled in section-by-section as the operator works through `runbooks/phase5-subcollection-migration.md`. Each block cites the runbook section that produced it.

```yaml
# --- Filled in after runbook §3.1 (pre-migration export) ---

pre_migration_export:
  iso_timestamp: 2026-05-08T17-10-06Z
  bucket_uri: gs://bedeveloped-base-layers-backups/pre-phase5-migration/2026-05-08T17-10-06Z/
  operation_name: projects/bedeveloped-base-layers/databases/(default)/operations/ASAzZjU4MjJkMjRjMTUtYTE5OS1lOTc0LTU1MWYtZTNlMjQ4OTUkGnNlbmlsZXBpcAkKMxI
  operation_done_at: 2026-05-08 17:10 UTC
    # Effectively immediate -- the database was empty so the export had no
    # documents to walk. `gcloud firestore operations describe ...` returned
    # `done=True, operationState=SUCCESSFUL` on the first poll.
  metadata_files_observed: yes
    # gsutil ls gs://.../pre-phase5-migration/2026-05-08T17-10-06Z/ listed:
    #   2026-05-08T17-10-06Z.overall_export_metadata
    #   all_namespaces/

# --- Filled in after runbook §3.2 (dry-run rehearsal) ---

dry_run:
  ran_at: 2026-05-08 ~17:15 UTC
  log_committed: 663927f
    # `chore(05-05): execute phase 5 production cutover - logs + stray
    # cleanup evidence` -- batched the dry-run log + real-run log + stray
    # cleanup evidence (find-strays.js, delete-strays.js) into a single
    # commit per atomic-commit pattern (Phase 1 D-25). Diverges from the
    # runbook's "one commit per log" prescription; documented here for
    # audit clarity.
  warnings_observed: looks clean (zero would-writes across all 6 STEPS)
    # The empty-database state means every step's source-shape inspection
    # found no orgs/* parent docs -- so dryRunWouldWrite=0 for all six
    # steps. This is the expected outcome given PROJECT.md baseline
    # ("project is between client engagements").
  step_dry_run_counts: |
    [STEP responses-v1] orgs=0 skipped=0 written=0 dryRunWouldWrite=0
    [STEP comments-v1] orgs=0 skipped=0 written=0 dryRunWouldWrite=0
    [STEP actions-v1] orgs=0 skipped=0 written=0 dryRunWouldWrite=0
    [STEP documents-v1] orgs=0 skipped=0 written=0 dryRunWouldWrite=0
    [STEP messages-v1] orgs=0 skipped=0 written=0 dryRunWouldWrite=0
    [STEP readStates-init] orgs=0 skipped=0 written=0 dryRunWouldWrite=0

# --- Filled in after runbook §3.3 (real migration) ---

real_migration:
  start_time: 2026-05-08 ~17:25 UTC
  end_time: 2026-05-08 ~17:25 UTC
    # Effectively instant -- empty source data plus stray-cleanup re-run.
  pre_counts: |
    orgs         0
    responses    0
    comments     0
    actions      0
    documents    0
    messages     0
    readStates   0
  post_counts: |
    orgs         0
    responses    0
    comments     0
    actions      0
    documents    0
    messages     0
    readStates   0
  per_step_summaries: |
    [STEP responses-v1] orgs=0 skipped=0 written=0 dryRunWouldWrite=0
    [STEP comments-v1] orgs=0 skipped=0 written=0 dryRunWouldWrite=0
    [STEP actions-v1] orgs=0 skipped=0 written=0 dryRunWouldWrite=0
    [STEP documents-v1] orgs=0 skipped=0 written=0 dryRunWouldWrite=0
    [STEP messages-v1] orgs=0 skipped=0 written=0 dryRunWouldWrite=0
    [STEP readStates-init] orgs=0 skipped=0 written=0 dryRunWouldWrite=0
  assertions_passed: yes (after stray cleanup)
    # Initial real-run FAILED with: `[FAIL] Error: messages: 3/3 sampled
    # docs missing inline legacy field 'legacyAuthorId' (D-03 invariant)`.
    # Root cause: 3 stray messages/{id} + 3 stray documents/{id} root-collection
    # docs predating the Phase-4 modular split + Phase-5 subcollection model
    # had no legacy fields. They were stale v0 test fixtures.
    # Resolution: deleted via scripts/migrate-subcollections/delete-strays.js
    # after parent-path verification via find-strays.js (both committed
    # in 663927f as audit evidence). Re-run produced
    # `[OK] Migration complete; pre/post assertions passed.`
  log_committed: 663927f

# --- Filled in after runbook §4 (post-migration verification) ---

post_verification:
  console_subcollections_visible: n/a (empty database)
    # No orgs/{orgId} parent docs to inspect for subcollection presence.
    # Spot-check moot until first user creates an org (Phase 6 onwards).
  spot_checked_doc_paths: n/a (empty database)
    # No migrated docs to spot-check.
  legacy_fields_present: n/a (empty database)
    # The D-03 inline legacy fields will start appearing on docs created
    # post-Phase-6 once the new wrappers (Wave 3) write through them. The
    # Phase 6 AUTH-15 backfill is therefore a no-op against current data
    # but the substrate is in place.
  verify_command_exit_code: 0
    # node scripts/migrate-subcollections/run.js --verify
    # Output: `[OK] Verify-only mode complete; field-presence assertions passed.`
  smoke_test_outcome: deferred to Phase 6
    # `npm run dev` smoke test against an empty database is degenerate
    # (the dashboard would render with no orgs to choose from). Logged as
    # a Phase 6 bootstrap-time validation: once business@bedeveloped.com
    # creates the first real org via the Phase 6 auth flow, the unread-count
    # badge + comment/action/message render paths get exercised end-to-end.

# --- Outcome ---

cutover_outcome: success

# --- Rollback-only fields (only fill if cutover_outcome: rolled-back) ---

rollback_reason: n/a
rollback_completed_at: n/a
rollback_log_committed: n/a

# --- Optional ---

notes: |
  - Production database was empty at cutover time (no orgs/* parent docs).
    Project baseline per PROJECT.md: "between client engagements" -- this
    matches expectation.
  - Stray-data cleanup was an in-flight scope deviation: the post-migration
    `assertFieldPresence` sampled 3 messages/{id} + 3 documents/{id}
    root-collection docs that predate the Phase-4 modular split and the
    Phase-5 subcollection model. They lacked the D-03 inline legacy fields
    (legacyAuthorId / legacyAppUserId) so the assertion failed. The 6 docs
    were investigated via find-strays.js, confirmed to be v0 test fixtures
    with `text` field instead of `body` (pre-builders.js shape), and
    deleted via delete-strays.js. Both scripts committed as audit evidence
    in 663927f.
  - The migration was effectively a no-op given empty source data; the
    audit value is in the export + dry-run + real-run + verify evidence
    chain rather than transformed data. The same migration script will
    correctly walk real client data once it exists post-Phase-6.
  - Bucket `gs://bedeveloped-base-layers-backups` created in europe-west2
    for the cutover; lifecycle policy deferred to Phase 8 BACKUP-02 per
    runbook §1 + CONTEXT.md D-21 cleanup-ledger.
```

---

## Reading guide for downstream plans

- **05-06-PLAN.md (Wave 6 cleanup ledger + DOC-10 + RULES-06 verification gate):** reads `cutover_outcome: success` -> Wave 6 closes the cleanup ledger rows + writes DOC-10 increment + asserts RULES-06's `committed-not-deployed` invariant via `git log --grep="firebase deploy --only firestore:rules" -- .` returning empty (false-positive caveat documented above).
- **Phase 6 (RULES-07 + AUTH-15):** reads `cutover_outcome: success` -> Phase 6 can proceed. AUTH-15's bootstrap migration walks the `legacyAppUserId` / `legacyAuthorId` inline fields populated by this Phase 5 cutover (currently no docs to walk; will activate as orgs/* docs are created post-Phase-6).
- **/gsd-verify-work 5:** reads `cutover_outcome: success` -> DATA-06 closure is satisfied (live evidence the assertion harness ran against production).
- **Phase 11 SECURITY.md / DOC-10 (Wave 6):** reads the per-step summaries + assertion outcomes for the audit-narrative line ("Migration is idempotent + bracketed by manual gcloud export; per-doc markers under migrations/{stepId}/items/{docId} are the audit log of what completed").
- **Phase 11 PRIVACY.md / GDPR Art. 32 evidence:** the export's bucket URI + the dry-run-log commit SHA + the real-run-log commit SHA -- the three artefacts together (663927f bundles all three) are the change-management evidence pack for the database mutation.

---

## Self-verification (Wave 5 close)

- [x] `runbooks/phase5-subcollection-migration.md` exists with the 7 sections.
- [x] `.planning/phases/05-firestore-data-model-migration-rules-authoring-committed-not-deployed/05-PREFLIGHT.md` populated (this file).
- [x] `scripts/migrate-subcollections/dry-run-output.log` populated with cutover-day dry-run output and committed (663927f).
- [x] `scripts/migrate-subcollections/real-run-output.log` populated with cutover-day real-run output and committed (663927f).
- [x] All Wave 5 PR-time deliverables committed.
- [x] Operator-execution checkpoint RESOLVED.

---

*Pre-flight skeleton authored: 2026-05-08 by Plan 05-05 (Wave 5).*
*Cutover Log filled in: 2026-05-08 by `business@bedeveloped.com` via Claude orchestrator session.*
