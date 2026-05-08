# Phase 5 Pre-flight + Cutover Log

**Plan:** 05-05
**Created:** 2026-05-08
**Status:** PENDING-USER — operator runs `runbooks/phase5-subcollection-migration.md` end-to-end, then fills every `PENDING-USER` value below.

This file is the canonical record of Wave 5 verifications consumed by Phase 5 close (Wave 6 verification gate per CONTEXT.md D-08) and downstream Phase 6 (which reads `cutover_outcome` to decide whether to proceed with RULES-07 deploy).

The schema mirrors Phase 3's `03-PREFLIGHT.md ## Cutover Log` (Phase 3 precedent — same idea applied to a database mutation rather than a DNS flip). Every `PENDING-USER` value gets filled in by the operator after executing the runbook; the Wave 6 verification gate confirms all markers are filled before phase close (or explicit "DEFERRED to UAT" rationale documented in `05-HUMAN-UAT.md`).

**How to fill in:** see `runbooks/phase5-subcollection-migration.md` §3 (success path) or §5 (rollback path). Each block below cites the runbook section that produces the value.

---

## Pre-flight verifications (Wave 5 Task 2 — operator response)

Run these BEFORE invoking `runbooks/phase5-subcollection-migration.md` §3.1. Each maps to a runbook §1 Prerequisites checkbox.

```yaml
firestore_region: PENDING-USER
  # Verification command (operator runs):
  #   gcloud firestore databases describe --database='(default)' \
  #     --project=bedeveloped-base-layers --format=json
  # Paste the locationId value here (expected: europe-west2). Carries forward
  # the Phase 3 03-PREFLIGHT.md PENDING-USER value if not yet filled.

backup_bucket_exists: PENDING-USER
  # Verification command:
  #   gsutil ls gs://bedeveloped-base-layers-backups/
  # Paste 'yes' if the bucket lists; 'no' if BucketNotFoundException returned.
  # If 'no', run the one-time setup per runbook §1:
  #   gsutil mb -l europe-west2 gs://bedeveloped-base-layers-backups
  # then re-run and update this field to 'yes (created)'.

operator_iam: PENDING-USER
  # Verification command:
  #   gcloud projects get-iam-policy bedeveloped-base-layers \
  #     --filter='bindings.role:roles/datastore.importExportAdmin'
  # Paste 'yes' if the operator principal appears as a member; 'no' otherwise.
  # If 'no', request the role from the project owner before continuing.

adc_token_works: PENDING-USER
  # Verification command:
  #   gcloud auth application-default print-access-token | head -c 20
  # Paste the first 20 chars of the token followed by '...' (do NOT paste
  # the full token). Empty output means ADC has not been initialised — run
  # `gcloud auth application-default login` first.

firebase_admin_version: PENDING-USER
  # Verification command:
  #   npm pkg get devDependencies.firebase-admin
  # Expected: "13.8.0". Paste the literal output value here.

ci_phase5_waves_1_to_4_green: PENDING-USER
  # Values: yes | no
  # Confirm `npm run test:rules`, `npm run test:migrate`, `npm test` all
  # exit 0 on the latest main commit (runbook §1 + §2). 'no' = STOP, do not
  # proceed to §3.1.

no_premature_rules_deploy: PENDING-USER
  # Values: yes | no
  # Verification command (RULES-06 sequencing constraint #2):
  #   git log --grep="firebase deploy --only firestore:rules" -- .
  # Output MUST be empty for this to be 'yes'. 'no' = STOP, investigate
  # the offending commit (rules deployed to production prematurely).
```

---

## Cutover Log

Filled in section-by-section as the operator works through `runbooks/phase5-subcollection-migration.md`. Each block cites the runbook section that produces it.

```yaml
# --- Filled in after runbook §3.1 (pre-migration export) ---

pre_migration_export:
  iso_timestamp: PENDING-USER
    # Format: YYYY-MM-DDTHH-MM-SSZ (the $ISO value from runbook §3.1).
    # The same value is appended to the bucket URI below.
  bucket_uri: PENDING-USER
    # Format: gs://bedeveloped-base-layers-backups/pre-phase5-migration/<ISO>/
    # Verbatim copy of the URI passed to `gcloud firestore export`.
  operation_name: PENDING-USER
    # Format: projects/bedeveloped-base-layers/databases/(default)/operations/AS...
    # Verbatim copy from the gcloud export output. Used for the
    # `gcloud firestore operations describe ...` poll loop.
  operation_done_at: PENDING-USER
    # Format: YYYY-MM-DD HH:MM TZ. The moment `done: true` was first observed
    # via the operations describe command.
  metadata_files_observed: PENDING-USER
    # Values: yes | no
    # `gsutil ls gs://.../pre-phase5-migration/<ISO>/` should list
    # `firestore_export.overall_export_metadata` plus per-collection metadata
    # files. 'no' = export incomplete, do NOT proceed to §3.2.

# --- Filled in after runbook §3.2 (dry-run rehearsal) ---

dry_run:
  ran_at: PENDING-USER
    # Format: YYYY-MM-DD HH:MM TZ. The start time of the dry-run command.
  log_committed: PENDING-USER
    # Format: <commit-SHA>. The commit hash of the
    # `chore(05-05): capture pre-cutover dry-run log evidence` commit.
  warnings_observed: PENDING-USER
    # Freeform. Any [WARN] or surprising lines in the log; or "looks clean"
    # if the log matched the expected pattern (every step prints non-zero
    # `dryRunWouldWrite`, no stack traces, final `[OK] Dry-run complete`).
  step_dry_run_counts: PENDING-USER
    # Multi-line YAML literal block. Paste the six `[STEP {stepId}] orgs=...
    # dryRunWouldWrite=...` summary lines from the log. Useful evidence for
    # auditors that the dry-run exercised every step.
    # Example:
    #   step_dry_run_counts: |
    #     [STEP responses-v1] orgs=N skipped=0 written=0 dryRunWouldWrite=A
    #     [STEP comments-v1] orgs=N skipped=0 written=0 dryRunWouldWrite=B
    #     ...

# --- Filled in after runbook §3.3 (real migration) ---

real_migration:
  start_time: PENDING-USER
    # Format: YYYY-MM-DD HH:MM TZ.
  end_time: PENDING-USER
    # Format: YYYY-MM-DD HH:MM TZ. The moment `[OK] Migration complete; pre/post
    # assertions passed.` was logged (or the moment `[FAIL]` was logged if
    # rollback ensued).
  pre_counts: PENDING-USER
    # Multi-line YAML literal block. Paste the script's `[PRE]` block contents
    # verbatim from the log. Schema per `summarise()` in
    # `scripts/migrate-subcollections/assertions.js`:
    #   pre_counts: |
    #     orgs         N
    #     responses    0
    #     comments     0
    #     actions      0
    #     documents    0
    #     messages     0
    #     readStates   0
  post_counts: PENDING-USER
    # Multi-line YAML literal block. Paste the script's `[POST]` block contents
    # verbatim from the log. Same schema as pre_counts; orgs MUST equal the
    # pre value; subcollection counts MUST be >= pre values per
    # `assertCollectionGroupCount`.
  per_step_summaries: PENDING-USER
    # Multi-line YAML literal block. Paste the six `[STEP {stepId}] orgs=...
    # skipped=... written=...` summary lines from the log.
  assertions_passed: PENDING-USER
    # Values: yes | no
    # 'yes' = `[OK] Migration complete; pre/post assertions passed.` logged.
    # 'no'  = `[FAIL]` logged; see rollback section below.
  log_committed: PENDING-USER
    # Format: <commit-SHA>. The commit hash of the
    # `chore(05-05): capture phase 5 production migration execution log` commit.

# --- Filled in after runbook §4 (post-migration verification) ---

post_verification:
  console_subcollections_visible: PENDING-USER
    # Values: yes | no
    # Firebase Console -> Firestore -> orgs/{anyOrgId} -> Subcollections
    # shows responses/comments/actions/documents/messages/readStates with
    # populated doc counts.
  spot_checked_doc_paths: PENDING-USER
    # Multi-line YAML literal block. Paste the 3 doc paths inspected, one
    # per line (e.g. orgs/{X}/responses/{respId}, orgs/{Y}/comments/{cmtId},
    # orgs/{Z}/messages/{msgId}). Useful audit evidence.
  legacy_fields_present: PENDING-USER
    # Values: yes | no
    # The 3 spot-checked docs each have legacyAppUserId or legacyAuthorId
    # populated with the source userId/authorId verbatim per D-03.
  verify_command_exit_code: PENDING-USER
    # Values: 0 | non-zero
    # Exit code from `node scripts/migrate-subcollections/run.js --verify`
    # against production. 0 = `assertFieldPresence` passed.
  smoke_test_outcome: PENDING-USER
    # Freeform. Result of `npm run dev` + http://localhost:5178/ smoke
    # (dashboard loads, org list populates, comments/actions/messages
    # render without console errors, unread-count badge renders).

# --- Outcome ---

cutover_outcome: PENDING-USER
  # Values: success | rolled-back | partial-then-resumed
  # 'success'              -> §3 + §4 all green; phase ready to close.
  # 'rolled-back'          -> §5 was executed; live Firestore restored
  #                           to pre-migration shape; investigate before retry.
  # 'partial-then-resumed' -> §3.3 failed mid-run, operator chose decision (A)
  #                           re-run, the re-run succeeded. Note the failure
  #                           cause in `notes:` below.

# --- Rollback-only fields (only fill if cutover_outcome: rolled-back) ---

rollback_reason: PENDING-USER
  # Freeform. Examples: "assertCollectionGroupCount threw - comments count
  # regressed mid-run", "assertFieldPresence threw on responses sample doc",
  # "post-cutover dashboard threw on comment render - data shape mismatch".

rollback_completed_at: PENDING-USER
  # Format: YYYY-MM-DD HH:MM TZ. The moment §5's
  # `gcloud firestore import` operation reached `done: true`.

rollback_log_committed: PENDING-USER
  # Format: <commit-SHA>. The commit hash of the
  # `chore(05-05): record cutover rollback in 05-PREFLIGHT.md` commit.

# --- Optional ---

notes: PENDING-USER
  # Freeform. Anything that didn't fit the structured fields above. Useful
  # for "export took 12 minutes (longer than expected)" or "spotted one
  # `[WARN] unexpected shape` line during dry-run for an org with a stale
  # 2024-era roundId; investigated and confirmed safe to migrate".
```

---

## Reading guide for downstream plans

- **05-06-PLAN.md (Wave 6 cleanup ledger + DOC-10 + RULES-06 verification gate):** reads `cutover_outcome` to decide whether to close Phase 5. If `PENDING-USER` or `rolled-back`, Wave 6 is held; the runbook is the deliverable but the live execution becomes a UAT-tracked item carrying into Phase 6's gate. If `success`, Wave 6 closes the cleanup ledger rows + writes DOC-10 increment + asserts RULES-06's `committed-not-deployed` invariant via `git log --grep="firebase deploy --only firestore:rules" -- .` returning empty.
- **Phase 6 (RULES-07 + AUTH-15):** reads `cutover_outcome: success` as a precondition. If `rolled-back`, Phase 6 cannot start until the migration is retried successfully. AUTH-15's bootstrap migration walks the `legacyAppUserId` / `legacyAuthorId` inline fields populated by this Phase 5 cutover.
- **/gsd-verify-work 5:** reads `cutover_outcome` to gate Phase 5 verification. If `PENDING-USER` or `rolled-back`, Phase 5 verification cannot pass DATA-06 (no live evidence the assertion harness ran against production).
- **Phase 11 SECURITY.md / DOC-10 (Wave 6):** reads the per-step summaries + assertion outcomes for the audit-narrative line ("Migration is idempotent + bracketed by manual gcloud export; per-doc markers under migrations/{stepId}/items/{docId} are the audit log of what completed").
- **Phase 11 PRIVACY.md / GDPR Art. 32 evidence:** reads the export's bucket URI + the dry-run-log commit SHA + the real-run-log commit SHA — the three artefacts together are the change-management evidence pack for the database mutation.

---

## Self-verification (Wave 5 close)

Before declaring Phase 5 Wave 5 complete:

- [ ] `runbooks/phase5-subcollection-migration.md` exists with the 7 sections (Prerequisites, Pre-cutover Smoke, Cutover Steps, Post-Migration Verification, Rollback, Post-cutover cleanup, Citations).
- [ ] `.planning/phases/05-firestore-data-model-migration-rules-authoring-committed-not-deployed/05-PREFLIGHT.md` exists with the schema above (this file).
- [ ] `scripts/migrate-subcollections/dry-run-output.log` exists as a placeholder; the operator overwrites it during runbook §3.2 and commits the populated log.
- [ ] All Wave 5 PR-time deliverables (this file + the runbook + the placeholder) are committed in a single atomic commit per Phase 1 D-25 atomic-commit pattern.
- [ ] The operator-execution checkpoint is either RESOLVED (every `PENDING-USER` filled) or DEFERRED to `05-HUMAN-UAT.md` per Phase 3 + Phase 4 precedent.

---

*Pre-flight skeleton authored: 2026-05-08 by Plan 05-05 (Wave 5).*
*Cutover Log filled in: PENDING-USER (operator runs `runbooks/phase5-subcollection-migration.md` end-to-end).*
