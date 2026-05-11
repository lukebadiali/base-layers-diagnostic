---
phase: 08
plan: 06
type: execute
wave: 6
depends_on:
  - 08-05
files_modified:
  - runbooks/restore-drill-2026-05-13.md
  - runbooks/phase-8-restore-drill-cadence.md
  - runbooks/phase-8-cleanup-ledger.md
  - SECURITY.md
  - REQUIREMENTS.md
autonomous: false
requirements:
  - BACKUP-06
  - BACKUP-07
  - DOC-10
must_haves:
  truths:
    - "Phase 8 Cloud Functions are deployed to bedeveloped-base-layers in europe-west2 (scheduledFirestoreExport, getDocumentSignedUrl, softDelete, restoreSoftDeleted, scheduledPurge, gdprExportUser, gdprEraseUser)"
    - "firestore.rules deployed with the 5 notDeleted conjuncts + redactionList block (Wave 2 + Wave 4 additions)"
    - "One restore drill is performed and documented in runbooks/restore-drill-<YYYY-MM-DD>.md with timing, evidence, gaps, and the restoreList re-redaction step (GDPR-05 propagation closure)"
    - "runbooks/phase-8-restore-drill-cadence.md documents the quarterly cadence (BACKUP-06)"
    - "SECURITY.md has new sections: § Data Lifecycle (Soft-Delete + Purge), § GDPR (Export + Erasure), § Backups + DR + PITR + Storage Versioning, § Phase 8 Audit Index"
    - "REQUIREMENTS.md AUDIT-09-style row updates for LIFE-01..06, GDPR-01..05, BACKUP-01..07 mark each row Validated <date> with evidence"
    - "phase-8-cleanup-ledger.md zero-out: every Phase 8 row that originated as Phase 8's responsibility either CLOSES with this commit OR has an explicit closure path documented; forward-tracking rows for Phase 9/11 queued"
  artifacts:
    - path: "runbooks/restore-drill-2026-05-13.md"
      provides: "BACKUP-07 evidence — one drill performed + documented"
      contains: "PITR clone"
    - path: "runbooks/phase-8-restore-drill-cadence.md"
      provides: "BACKUP-06 — quarterly cadence policy"
      contains: "Quarterly"
    - path: "runbooks/phase-8-cleanup-ledger.md"
      provides: "Phase 8 close-gate ledger; zero active rows"
      contains: "phase_8_active_rows: 0"
    - path: "SECURITY.md"
      provides: "DOC-10 incremental — 4 new Phase 8 sections + Phase 8 Audit Index"
      contains: "Phase 8 Audit Index"
  key_links:
    - from: "Phase 8 Cloud Functions in source (08-01..05)"
      to: "production deployment in europe-west2"
      via: "cd functions && npm run build && firebase deploy --only functions:scheduledFirestoreExport,functions:getDocumentSignedUrl,functions:softDelete,functions:restoreSoftDeleted,functions:scheduledPurge,functions:gdprExportUser,functions:gdprEraseUser --project=bedeveloped-base-layers"
      pattern: "firebase deploy"
    - from: "firestore.rules + storage.rules in repo"
      to: "production rules deployment"
      via: "firebase deploy --only firestore:rules --project=bedeveloped-base-layers"
      pattern: "firebase deploy --only firestore:rules"
    - from: "runbooks/restore-drill-2026-05-13.md"
      to: "redactionList consumption + post-restore re-redaction"
      via: "Step in drill: after restoring DB, iterate redactionList and re-run gdprEraseUser for each entry"
      pattern: "redactionList"
---

<objective>
Close Phase 8: deploy the 8 Phase 8 Cloud Functions + the Wave 2/4 rules updates, perform and document the BACKUP-07 restore drill (the milestone's recoverability evidence), document the BACKUP-06 quarterly cadence, append the 4 DOC-10 SECURITY.md sections + Phase 8 Audit Index, mark every LIFE/GDPR/BACKUP requirement Validated, and zero out the Phase 8 cleanup ledger.

Purpose: this wave is the substrate→evidence transformation. The Cloud Functions and rules are useless until deployed and exercised; the milestone's compliance-credible posture demands a documented restore drill. SECURITY.md DOC-10 is per-phase incremental (Pitfall 19 prevention) — Phase 8 is a heavy-control phase, so the section count grows accordingly.

Output: 4 runbooks/SECURITY/REQUIREMENTS edits + 2 operator checkpoints (deploy + drill).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/phases/08-data-lifecycle-soft-delete-gdpr-backups/08-RESEARCH.md
@.planning/research/PITFALLS.md
@SECURITY.md
@REQUIREMENTS.md
@runbooks/phase-7-cleanup-ledger.md
@runbooks/phase-7-bigquery-sink-bootstrap.md
@runbooks/phase6-rules-rollback-rehearsal.md
@runbooks/phase-8-backup-setup.md
@firestore.rules
@functions/src/index.ts
@.planning/REQUIREMENTS.md

<interfaces>
<!-- Pattern G — SECURITY.md per-phase increment style. Read existing § blocks for tone. -->

From SECURITY.md (head — Phase 1 + Phase 3 + Phase 4 + Phase 5 + Phase 6 + Phase 7 sections all extend it):
- Each phase appends 1+ new `## § <Section Name>` blocks
- Each block has: control statement (1 paragraph), Evidence (bullet list with file paths + commit SHAs), Framework citations (OWASP ASVS + ISO 27001:2022 Annex A + SOC 2 CC + GDPR Article)
- Phase 7 added 4 sections + Phase 7 Audit Index (16-row table); Phase 8 follows same shape

From runbooks/phase-7-cleanup-ledger.md (zero-out gate format):
- ## Active rows | ## Carry-forward sub-wave rows | ## Forward-tracking (queued) per future phase
- Closing footer: `phase_<N>_active_rows: 0` indicator + Branch A/B substrate-honest disclosure
- Cite Pitfall 19 (substrate-honest disclosure)

From runbooks/phase6-rules-rollback-rehearsal.md (deploy + drill log format):
- Steps numbered + timestamped
- Each step has Expected vs Actual columns
- Drill close: gaps found, follow-ups, sign-off

From REQUIREMENTS.md format:
- "Validated <date> (Phase X close)" status update on each row
- Evidence column points to file paths + commit SHAs

From .planning/REQUIREMENTS.md "Traceability" table:
- Each LIFE-01..06 / GDPR-01..05 / BACKUP-01..07 row currently shows "Pending" — this plan flips them to "Validated 2026-05-13 (Phase 8 close)"
</interfaces>
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 1: Operator deploys all 8 Phase 8 Cloud Functions + rules to production</name>
  <what-built>
    Plans 08-01 through 08-05 produced:
    - 7 Cloud Functions in functions/src/{backup,lifecycle,gdpr}/*.ts (scheduledFirestoreExport, getDocumentSignedUrl, softDelete, restoreSoftDeleted, scheduledPurge, gdprExportUser, gdprEraseUser)
    - firestore.rules updates: 5 notDeleted conjuncts (Wave 2) + redactionList match block (Wave 4)
    - All tests green; operator-side substrate provisioned (08-01 Task 5 + 08-05 Task 7): backups bucket, PITR, uploads versioning + soft-delete, GDPR_PSEUDONYM_SECRET, 4 SAs

    Now operator deploys. This is a load-bearing cutover step — once Cloud Functions are live AND rules are deployed, the soft-delete predicate gates client list queries (Pitfall A). The order matters: deploy functions FIRST (so client seams have something to call), THEN rules (so client queries fail predictably if they lack `where("deletedAt", "==", null)`).
  </what-built>
  <how-to-verify>
    Operator (Hugh / Luke) — paste outputs into the cleanup ledger:

    1. **Pre-deploy verification**:
       ```bash
       cd functions && npm run build && npm test 2>&1 | tail -5
       # Expected: exit 0, "Test Files X passed", total ≥ 200
       ```

    2. **Confirm secrets + SAs**:
       ```bash
       gcloud secrets describe GDPR_PSEUDONYM_SECRET --project=bedeveloped-base-layers --format="value(name)"
       gcloud iam service-accounts list --project=bedeveloped-base-layers --format="value(email)" | grep -E "(storage-reader-sa|lifecycle-sa|gdpr-reader-sa|gdpr-writer-sa|backup-sa)"
       ```
       Expected: secret exists; 5 SA emails listed.

    3. **Deploy 8 Phase 8 functions** (selective deploy per Pitfall 8 — preserves Phase 6/7 invoker bindings):
       ```bash
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
       Expected: 8 functions deployed. URLs printed for each callable. Cron jobs registered for the 2 onSchedule functions.

    4. **Deploy firestore.rules**:
       ```bash
       firebase deploy --only firestore:rules --project=bedeveloped-base-layers
       ```
       Expected: rules deployed; "Rules deployed successfully" message + version increment in Firebase Console (https://console.firebase.google.com/project/bedeveloped-base-layers/firestore/rules).

    5. **Smoke-test deployments**:
       ```bash
       # List the deployed Phase 8 functions
       gcloud functions list --regions=europe-west2 --project=bedeveloped-base-layers --format="table(name,entryPoint,state)" | grep -E "(scheduledFirestoreExport|getDocumentSignedUrl|softDelete|restoreSoftDeleted|permanentlyDeleteSoftDeleted|scheduledPurge|gdprExportUser|gdprEraseUser)"
       # Expected: 8 rows, state ACTIVE

       # Verify the scheduledFirestoreExport schedule is registered
       gcloud scheduler jobs list --location=europe-west2 --project=bedeveloped-base-layers --format="value(name,schedule)" | grep -E "(firestore-export|scheduledPurge)"
       # Expected: 2 entries (export at 02:00 UTC, purge at 03:00 UTC)
       ```

    6. **Verify backups bucket gets the first export** (operator runs the next morning, OR triggers manually):
       ```bash
       # Manual trigger of scheduledFirestoreExport (one-shot test invocation)
       gcloud scheduler jobs run firebase-schedule-scheduledFirestoreExport-europe-west2 --location=europe-west2 --project=bedeveloped-base-layers
       # Wait ~3-5 min for the operation to complete, then:
       gcloud storage ls gs://bedeveloped-base-layers-backups/firestore/
       ```
       Expected: at least one `<YYYY-MM-DD>/` directory appears with Firestore export metadata files.

    7. **Verify rules predicate is live** (negative test — a list query WITHOUT where("deletedAt", "==", null) should fail):
       Open the deployed app, sign in as a client user, and observe the dashboard / chat screen. If the data wrappers (08-03 Task 4) correctly added the where conjunct, lists render. If they did NOT, lists fail with `permission-denied` — investigate.
       (This is a smoke test against the deployed rules — paste a console screenshot or note "lists render correctly".)
  </how-to-verify>
  <resume-signal>Type "approved" with the output of step 5 (7 ACTIVE functions) and step 6 (export bucket directory listing). If lists fail, paste the error and we patch the data wrappers before proceeding.</resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Operator performs the BACKUP-07 restore drill against staging or PITR clone</name>
  <what-built>
    Cloud Functions + rules now live in production (Task 1). The milestone's BACKUP-07 evidence requirement is "one restore drill performed and documented." This task IS the drill — operator performs it, and the run's findings populate `runbooks/restore-drill-2026-05-13.md` (created in Task 3 below).

    Two restore paths exist:
    - **Path A — PITR clone**: clone the production database at a recent timestamp into a new database ID. Lower-risk; no GCS dependency; tests Firestore PITR (BACKUP-03).
    - **Path B — GCS export → bedeveloped-base-layers-staging**: import a daily export from gs://bedeveloped-base-layers-backups/firestore/<YYYY-MM-DD>/ into a separate staging project. Tests the GCS export pipeline (BACKUP-01, BACKUP-02). Requires a staging project to exist; if it doesn't, operator chooses Path A.

    Either path proves recoverability; document which one was exercised in the runbook.
  </what-built>
  <how-to-verify>
    Operator (Hugh / Luke) — perform either Path A or Path B. Time the operation; note the timestamp at each step.

    **Path A — PITR clone** (recommended unless staging project exists):

    1. **Pick a snapshot timestamp** (whole minute, ≤ 7 days old):
       ```bash
       SNAPSHOT_TIME="2026-05-13T08:00:00.00Z"  # adjust to a recent past timestamp
       DEST_DB="restore-drill-$(date -u +%Y%m%d-%H%M)"
       echo "Cloning at $SNAPSHOT_TIME → database $DEST_DB"
       ```

    2. **Trigger clone** (per 08-RESEARCH.md §Pattern 3):
       ```bash
       time gcloud firestore databases clone \
         --source-database="projects/bedeveloped-base-layers/databases/(default)" \
         --snapshot-time="$SNAPSHOT_TIME" \
         --destination-database="$DEST_DB" \
         --project=bedeveloped-base-layers
       ```
       Time the operation. Expected: clone completes; new database appears in Firebase Console.

    3. **Spot-check restored data**:
       ```bash
       # Count documents in the restored DB (sanity — should be > 0 if production has data)
       gcloud firestore documents list \
         --database="$DEST_DB" \
         --collection-id=orgs \
         --project=bedeveloped-base-layers \
         --limit=5
       ```
       Expected: 0+ org documents listed; structure matches production at the snapshot time.

    4. **Re-redaction step (GDPR-05 propagation closure)**:
       After restore, iterate redactionList and re-apply tombstones:
       ```bash
       # Pseudo-script (operator runs against the cloned DB):
       # 1. Read all docs from redactionList in production (default DB)
       # 2. For each entry, the cloned DB needs the same erasure re-applied
       # 3. The post-erasure audit script (scripts/post-erasure-audit/run.js)
       #    can be modified to point at the cloned DB to verify zero residual PII
       #
       # For Phase 8 close the operator MAY skip this step IF redactionList is empty
       # (no real erasures performed yet). Document either outcome.
       ```
       Note in the runbook: if redactionList is empty (likely — no live users have requested erasure), document that the re-redaction is a NO-OP for this drill.

    5. **Cleanup the drill database**:
       ```bash
       gcloud firestore databases delete "$DEST_DB" --project=bedeveloped-base-layers
       ```
       Expected: drill database deleted; production untouched.

    **Path B — GCS export → staging** (only if staging project exists):

    1. Identify the most recent backup: `gcloud storage ls gs://bedeveloped-base-layers-backups/firestore/ | tail -1`
    2. Import into staging: `gcloud firestore import gs://bedeveloped-base-layers-backups/firestore/<YYYY-MM-DD>/ --project=bedeveloped-base-layers-staging`
    3. Spot-check + re-redaction + cleanup as in Path A.

    **Capture for the runbook (Task 3)**: paste each command + its timing + actual output (sanitized — no PII). Note any gaps (e.g. "PITR clone took longer than expected" / "redactionList was empty so re-redaction was no-op").

    The operator may NOT defer this step — BACKUP-07 demands "one restore drill performed and documented before milestone close." Without this evidence, the milestone is incomplete.
  </how-to-verify>
  <resume-signal>Type "approved" with the path chosen (A or B), the timing of the clone/import, the spot-check result, and any gaps. The drill must complete successfully; if it fails, we investigate and re-run before proceeding.</resume-signal>
</task>

<task type="auto">
  <name>Task 3: Author runbooks/restore-drill-<YYYY-MM-DD>.md + runbooks/phase-8-restore-drill-cadence.md</name>
  <read_first>
    - runbooks/phase6-rules-rollback-rehearsal.md (precedent for drill format — timed steps + Expected vs Actual + gaps + sign-off)
    - 08-RESEARCH.md §Pattern 3 (PITR commands)
    - Operator output from Task 2 (paste actual timings + commands run)
  </read_first>
  <files>runbooks/restore-drill-2026-05-13.md, runbooks/phase-8-restore-drill-cadence.md</files>
  <action>
    1. **`runbooks/restore-drill-<YYYY-MM-DD>.md`** — use today's date as the filename (e.g. `runbooks/restore-drill-2026-05-13.md`). 100-200 lines. Sections:
       - **Header**: Phase 8 — BACKUP-07 evidence; date; operator name; objective: "Demonstrate ability to restore Firestore data from PITR or GCS export within an acceptable RTO."
       - **Restore Path Chosen**: A (PITR clone) or B (GCS export). Rationale.
       - **Pre-conditions**: PITR enabled (per 08-01); backups bucket has ≥ 1 daily export (per Task 1 step 6); operator has roles/datastore.owner.
       - **Timed Steps**: paste each step from Task 2 (operator output). Each step = command + Expected + Actual + Timing.
       - **Spot-Check Results**: what was inspected; sanitised data sample (e.g. doc IDs only, no PII).
       - **Re-Redaction Step (GDPR-05)**: what was done. If redactionList empty, document "no-op for this drill — no erasures performed at Phase 8 close."
       - **Cleanup**: confirm drill database deleted (Path A) or staging project state restored (Path B).
       - **Gaps Found**: bulleted list of any issues (e.g. "PITR clone exceeded 5min RTO target" or "redactionList re-redaction script is operator-manual; v2 candidate for automation").
       - **RTO Achieved**: total elapsed time from "issue detected" → "data restored." Compare to a target (suggest 1h for v1).
       - **Sign-off**: operator name + date + commit SHA at drill time.
       - **Citations**: BACKUP-07, 08-RESEARCH.md §Pattern 3, Pitfall 10.

    2. **`runbooks/phase-8-restore-drill-cadence.md`** — 50-100 lines documenting BACKUP-06 quarterly cadence:
       - **Cadence**: every quarter (suggest dates: Q3-2026 = 2026-08-13; Q4-2026 = 2026-11-13; Q1-2027; Q2-2027).
       - **Trigger**: calendar reminder + paired-review (Hugh + Luke).
       - **Procedure**: short reference — "Repeat the steps in `runbooks/restore-drill-<latest-date>.md`. Update timing + gaps. New runbook file per drill: `runbooks/restore-drill-<YYYY-MM-DD>.md`."
       - **Required outcomes per drill**: PITR clone or GCS import succeeds within 1h RTO; spot-check confirms data integrity; re-redaction script executes against any redactionList entries; runbook authored.
       - **Escalation**: if a drill fails, treat as a P1 incident — root-cause and re-drill within 7 days.
       - **Citations**: BACKUP-06, BACKUP-07, this is the milestone-close cadence pin.
  </action>
  <verify>
    <automated>test -f runbooks/restore-drill-*.md && test -f runbooks/phase-8-restore-drill-cadence.md && grep -c "Timed Steps\|Quarterly" runbooks/restore-drill-*.md runbooks/phase-8-restore-drill-cadence.md && [ "$(grep -cE '20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}' runbooks/restore-drill-*.md)" -ge 3 ]</automated>
  </verify>
  <done>
    - Both runbook files exist
    - `runbooks/restore-drill-<date>.md` has Timed Steps + Spot-Check Results + Re-Redaction Step + Gaps Found + Sign-off sections
    - Operator output from Task 2 is incorporated verbatim (commands + timings)
    - The Timed Steps section contains at least 3 actual ISO-8601 timestamps (not placeholders): verified by `grep -cE '20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}' runbooks/restore-drill-*.md` >= 3 — fails if the drill log uses placeholders like `<TBD>` or `<timestamp>`
    - `runbooks/phase-8-restore-drill-cadence.md` mentions "Quarterly" cadence + 4 future drill dates
    - Both files cite BACKUP-06 + BACKUP-07
  </done>
</task>

<task type="auto">
  <name>Task 4: Append 4 SECURITY.md sections + Phase 8 Audit Index (DOC-10 incremental)</name>
  <read_first>
    - SECURITY.md (current state — Phase 1/3/4/5/6/7 sections all already present; Phase 8 appends after Phase 7 Audit Index)
    - .planning/research/PITFALLS.md §19 (compliance theatre — substrate-honest only, no claims without evidence)
    - All Phase 8 plans (08-01 through 08-05) — for evidence file paths + commit SHAs
  </read_first>
  <files>SECURITY.md</files>
  <action>
    Append to the END of SECURITY.md (after the Phase 7 Audit Index). 4 new `## §` sections + 1 Phase 8 Audit Index table:

    1. **`## § Data Lifecycle (Soft-Delete + Purge)`**:
       - Control: Admin-mediated soft-delete + 30-day restore window across orgs/messages/comments/actions/documents/funnelComments. Daily scheduledPurge hard-deletes records past retention. Rules predicate `notDeleted(resource.data)` enforced on read; client queries gated by `where("deletedAt", "==", null)`.
       - Evidence: `functions/src/lifecycle/{softDelete,restoreSoftDeleted,scheduledPurge,resolveDocRef}.ts` (commit SHA TBD-by-executor); `firestore.rules` notDeleted conjunct on 5 paths; `tests/rules/soft-delete-predicate.test.js` ≥ 18 cells; `src/cloud/soft-delete.js` browser seam; `src/views/admin.js` Recently Deleted UI.
       - Framework citations: OWASP ASVS L2 V8.3.1 (data lifecycle); ISO 27001:2022 A.5.30 + A.8.10 (information deletion); SOC 2 CC6.5 (logical access — controlled deletion); GDPR Art. 5(1)(e) (storage limitation).

    2. **`## § GDPR (Export + Erasure)`**:
       - Control: Admin-callable gdprExportUser produces a JSON bundle of all user-linked data with a 24h V4 signed URL. Admin-callable gdprEraseUser cascades a deterministic sha256(uid + GDPR_PSEUDONYM_SECRET) tombstone token across all 7+ collections + Storage attribution + Auth user disable + redactionList write. Audit log entries about the user are RETAINED (legitimate interest under Art. 6(1)(f)) but PII fields are tombstoned in-place (Pitfall 11). Post-erasure audit script (scripts/post-erasure-audit/run.js) verifies zero residual PII.
       - Evidence: `functions/src/gdpr/{pseudonymToken,assembleUserBundle,eraseCascade,gdprExportUser,gdprEraseUser}.ts`; tests across 4 unit + 2 integration files; `firestore.rules` redactionList block; `tests/rules/redaction-list.test.js` 10 cells; GDPR_PSEUDONYM_SECRET in Firebase Secret Manager (operator-set 2026-05-13 — version pinned).
       - Framework citations: OWASP ASVS L2 V8.1 (data classification + handling) + V6 (cryptography — sha256 for pseudonymisation); ISO 27001:2022 A.5.34 + A.8.11 + A.8.12 (privacy + data masking); SOC 2 P5.1 (privacy notice); GDPR Art. 15 (right of access), Art. 17 (right to erasure), Art. 25 (data protection by design — pseudonymisation), Art. 30 (record of processing — audit trail), Art. 32 (security of processing).

    3. **`## § Backups + DR + PITR + Storage Versioning`**:
       - Control: Daily Firestore export at 02:00 UTC to gs://bedeveloped-base-layers-backups/firestore/<YYYY-MM-DD>/ with the lifecycle policy: GCS lifecycle: Standard at upload → Nearline at day 30 from creation → Archive at day 365 from creation (335-day Nearline dwell, exceeds BACKUP-02 90d Nearline minimum). Firestore PITR enabled (7-day rolling clone window). Uploads bucket has Object Versioning + 90-day soft-delete. Storage download URLs are V4 signed with 1h TTL via getDocumentSignedUrl callable; `getDownloadURL` calls removed from client code (Pitfall G — full sweep verified by `grep -r getDownloadURL src/`).
       - Evidence: `functions/src/backup/{scheduledFirestoreExport,getDocumentSignedUrl}.ts`; `scripts/setup-backup-bucket/{run.js,lifecycle.json}`; `runbooks/phase-8-backup-setup.md` operator runbook; `runbooks/restore-drill-<date>.md` (BACKUP-07 evidence); `runbooks/phase-8-restore-drill-cadence.md` (BACKUP-06 quarterly); `src/cloud/signed-url.js` browser seam; `src/data/documents.js` + `src/main.js` `getDownloadURL` removal sweep.
       - Framework citations: OWASP ASVS L2 V14.1 (build + deployment) + V8.3 (data protection at rest); ISO 27001:2022 A.5.29 + A.5.30 + A.8.13 + A.8.14 (backup, redundancy, recovery); SOC 2 CC9.1 + A1.2 + A1.3 (availability + DR + recovery); GDPR Art. 32(1)(b)+(c) (resilience + restoration).

    4. **`## § Phase 8 Audit Index`**:
       Table format mirroring Phase 7 Audit Index (16-row Pattern G table). 19 rows — one per requirement ID:

       | Requirement | Substrate | Evidence | Status |
       |-------------|-----------|----------|--------|
       | LIFE-01 | softDelete + restoreSoftDeleted callables; resolveDocRef helper | functions/src/lifecycle/* + tests | Validated 2026-05-13 |
       | LIFE-02 | Snapshot-then-tombstone in single batch | functions/src/lifecycle/softDelete.ts L60-80 + Test | Validated 2026-05-13 |
       | LIFE-03 | Rules notDeleted predicate + client where conjunct | firestore.rules + src/data/*.js + tests/rules/soft-delete-predicate.test.js | Validated 2026-05-13 |
       | LIFE-04 | restoreSoftDeleted callable + src/cloud/soft-delete.js seam | functions/src/lifecycle/restoreSoftDeleted.ts + tests | Validated 2026-05-13 |
       | LIFE-05 | scheduledPurge with 500-doc pagination | functions/src/lifecycle/scheduledPurge.ts + 1200-doc test | Validated 2026-05-13 |
       | LIFE-06 | Functional Recently Deleted admin UI: list + Restore + Permanently delete now | src/views/admin.js + src/data/soft-deleted.js + functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts | Validated 2026-05-13 |
       | GDPR-01 | gdprExportUser callable + assembleUserBundle | functions/src/gdpr/* + 24h V4 URL | Validated 2026-05-13 |
       | GDPR-02 | Deterministic sha256 pseudonym + cascade builder | functions/src/gdpr/pseudonymToken.ts + eraseCascade.ts + gdprEraseUser.ts | Validated 2026-05-13 |
       | GDPR-03 | Cascade across 7 collections + 3-field documents + Storage + Auth disable | functions/src/gdpr/eraseCascade.ts + scripts/post-erasure-audit/run.js | Validated 2026-05-13 |
       | GDPR-04 | Audit log retention with PII tombstoning per Pitfall 11 | functions/src/gdpr/eraseCascade.ts auditEvents branch + tests | Validated 2026-05-13 |
       | GDPR-05 | redactionList write + admin-only-read rules | firestore.rules + tests/rules/redaction-list.test.js + restore-drill re-redaction step | Validated 2026-05-13 |
       | BACKUP-01 | scheduledFirestoreExport (Gen2 onSchedule, europe-west2, backup-sa) | functions/src/backup/scheduledFirestoreExport.ts + first export verified | Validated 2026-05-13 |
       | BACKUP-02 | GCS lifecycle: Standard at upload → Nearline at day 30 from creation → Archive at day 365 from creation (335-day Nearline dwell, exceeds BACKUP-02 90d Nearline minimum). | scripts/setup-backup-bucket/lifecycle.json + scripts/setup-backup-bucket/lifecycle.notes.md + verified via gcloud | Validated 2026-05-13 |
       | BACKUP-03 | Firestore PITR enabled (7-day rolling) | gcloud firestore databases describe | Validated 2026-05-13 |
       | BACKUP-04 | Uploads bucket Object Versioning + 90d soft-delete | gcloud storage buckets describe | Validated 2026-05-13 |
       | BACKUP-05 | V4 signed URL TTL 1h via getDocumentSignedUrl | functions/src/backup/getDocumentSignedUrl.ts + src/cloud/signed-url.js | Validated 2026-05-13 |
       | BACKUP-06 | Quarterly drill cadence | runbooks/phase-8-restore-drill-cadence.md | Validated 2026-05-13 |
       | BACKUP-07 | One restore drill performed + documented | runbooks/restore-drill-2026-05-13.md | Validated 2026-05-13 |
       | DOC-10 | This Phase 8 increment | SECURITY.md § Data Lifecycle / § GDPR / § Backups + this Audit Index | Validated 2026-05-13 |

       Footer: cite Pitfall 19 (substrate-honest disclosure); commit SHAs to be backfilled by the closing commit.
  </action>
  <verify>
    <automated>grep -c "## § " SECURITY.md && grep -c "Phase 8 Audit Index" SECURITY.md</automated>
  </verify>
  <done>
    - SECURITY.md has 4 new `## §` blocks added at the end (verified by `grep -c "## § " SECURITY.md` increases by 4 from the pre-edit baseline)
    - Phase 8 Audit Index table has 19 rows (one per requirement ID + DOC-10)
    - Each section block has Control + Evidence + Framework citations sub-blocks
    - Commit SHA placeholder `TBD-by-executor` is the final state — closing commit fills it (or the SUMMARY notes the SHA at write time)
  </done>
</task>

<task type="auto">
  <name>Task 5: Update REQUIREMENTS.md — flip 19 rows to Validated 2026-05-13 (Phase 8 close)</name>
  <read_first>
    - REQUIREMENTS.md (Traceability table starting at line 250 — find LIFE / GDPR / BACKUP rows; mirror the Phase 5/6/7 row update style)
    - REQUIREMENTS.md headers for LIFE/GDPR/BACKUP sections (lines 130-155 — flip checkbox `[ ]` to `[x]` for each row + add inline note)
  </read_first>
  <files>REQUIREMENTS.md</files>
  <action>
    Two location updates per requirement:

    1. **Top section (LIFE / GDPR / BACKUP requirement listings, lines 130-155)** — flip checkbox + append inline status:
       - For each of LIFE-01..06, GDPR-01..05, BACKUP-01..07: `- [ ]` → `- [x]`; append "— Closed Phase 8 Wave <N> (08-<NN>): <one-line evidence>" to the description (mirror the AUDIT-01..07 row style updated in Phase 7).
       - Example for LIFE-01: `- [x] **LIFE-01**: Soft-delete + 30-day restore window across orgs, users (auth-only delete), comments, documents, messages, funnel comments — Closed Phase 8 Wave 2 (08-03): functions/src/lifecycle/{softDelete,restoreSoftDeleted,scheduledPurge}.ts + firestore.rules notDeleted conjunct on 5 subcollections + src/data/*.js where("deletedAt", "==", null) sweep + src/views/admin.js Recently Deleted UI.`

    2. **Traceability table (lines ~250 onwards)** — update Status column for these 3 grouped rows:
       - `LIFE-01 to LIFE-06` row → Status: `Validated 2026-05-13 (Phase 8 close — 08-03 + 08-06)` | Notes: "Soft-delete CFs + rules predicate + client where + functional admin UI (Recently Deleted with Restore + Permanently delete now); LIFE-06 fully wired via src/data/soft-deleted.js + permanentlyDeleteSoftDeleted callable"
       - `GDPR-01 to GDPR-05` row → Status: `Validated 2026-05-13 (Phase 8 close — 08-04 + 08-05 + 08-06)` | Notes: "Export + erasure + redactionList + post-erasure audit script; GDPR_PSEUDONYM_SECRET in Secret Manager; 4 SAs provisioned"
       - `BACKUP-01 to BACKUP-07` row → Status: `Validated 2026-05-13 (Phase 8 close — 08-01 + 08-02 + 08-06)` | Notes: "GCS bucket + lifecycle + PITR + uploads versioning/soft-delete + scheduledFirestoreExport + V4 signed URL + quarterly drill cadence + first drill performed (runbooks/restore-drill-2026-05-13.md)"

    3. **DOC-10 row** (line ~179 — already a recurring update target):
       - Append to the existing "Per-phase increments to date:" sentence: "**Phase 8 Wave 5** (08-06): § Data Lifecycle + § GDPR + § Backups + DR + PITR + Storage Versioning + § Phase 8 Audit Index (19-row table)."

    No other rows touched. Verify by `git diff REQUIREMENTS.md` showing exactly the targeted rows changed.
  </action>
  <verify>
    <automated>grep -c "Closed Phase 8" REQUIREMENTS.md && grep -c "Validated 2026-05-13" REQUIREMENTS.md</automated>
  </verify>
  <done>
    - 18 rows in the requirements listing flipped `[ ]` → `[x]` with "Closed Phase 8 Wave <N>" inline notes (`grep -c "Closed Phase 8"` ≥ 18 — LIFE-01..06 + GDPR-01..05 + BACKUP-01..07)
    - 3 Traceability table rows updated with Status: `Validated 2026-05-13 (Phase 8 close ...)`
    - DOC-10 row appended with the Phase 8 Wave 5 increment description
    - No other row modifications (verified by `git diff REQUIREMENTS.md` shows only the targeted edits)
  </done>
</task>

<task type="auto">
  <name>Task 6: Author runbooks/phase-8-cleanup-ledger.md — zero-out gate</name>
  <read_first>
    - runbooks/phase-7-cleanup-ledger.md (precedent format — Active rows + Carry-forward + Forward-tracking per future phase + close footer)
    - runbooks/phase-7-cleanup-ledger.md tail — Phase 8 forward-tracking rows queued by Phase 7 (4 rows; this plan CLOSES them all)
    - All 5 prior plans (08-01 through 08-05) — for any in-phase carry-forward items
  </read_first>
  <files>runbooks/phase-8-cleanup-ledger.md</files>
  <action>
    Create `runbooks/phase-8-cleanup-ledger.md` mirroring `runbooks/phase-7-cleanup-ledger.md` structure exactly:

    Sections:

    1. **Header** — Phase 8 Wave 5 close-gate; date; objective: "Document zero-out of all Phase 8 originating cleanup-ledger rows + queue forward-tracking for Phase 9/10/11/12."

    2. **Phase 7 forward-tracking — Phase 8 closure** (4 rows queued by Phase 7's ledger; all close here):
       | Row | Phase 7 reason | Phase 8 closure |
       |-----|----------------|-----------------|
       | softDelete + restoreSoftDeleted callables wired through src/cloud/soft-delete.js | LIFE-01..06 | CLOSED 08-03 Task 6 + functions/src/lifecycle/* + integration tests |
       | gdprExportUser + gdprEraseUser callables wired through src/cloud/gdpr.js | GDPR-01/02/03 | CLOSED 08-04 + 08-05 (both stubs filled) |
       | Pre-migration export bucket lifecycle policy | BACKUP-02/04 | CLOSED 08-01 + operator script run + verified gcloud describe |
       | Phase 8 GDPR-erase summary-event pattern (Pitfall 7 mitigation) | GDPR-02 | CLOSED 08-05 Task 3 (single compliance.erase.user audit event with counts payload — NOT per-doc) |

    3. **Phase 8 in-phase carry-forward** (open rows that did NOT originate as Phase 8 work but are bounded with explicit closure paths):
       | Row | Reason | Closure path |
       |-----|--------|--------------|
       | src/firebase/storage.js getDownloadURL re-export | Phase 8 Wave 2 removed all call sites in src/data + src/main but the re-export remains for theoretical future use | Phase 10 CSP tightening — the re-export is harmless; can be dropped when convenient |
       | scripts/post-erasure-audit/run.js — first execution against real production erasure | Script ships; first real run lands the first time gdprEraseUser is invoked in production | Operator follow-up — log execution outcome in next quarterly drill runbook |

    4. **Forward-tracking — queued for future phases**:

       **Phase 9** (Observability):
       | Row | Reason |
       |-----|--------|
       | Sentry alerts on gdprExportUser + gdprEraseUser invocations (unusual-hour) | OBS-05 (Phase 9 owner) — Phase 8 emits the audit events; Phase 9 wires the Slack webhook |
       | AUDIT-05 view-side wiring of compliance.export.user + compliance.erase.user | Phase 9 — view-side audit-event wiring per the canonical map |
       | gdprExportUser bundle assembly memory profiling (large-user case) | OBS-07 — Phase 9 budget alerts catch unexpected memory bills; if profile reveals > 100MB bundles, escalate to streaming-to-GCS pattern (08-RESEARCH.md alternative) |

       **Phase 10** (CSP Tightening):
       | Row | Reason |
       |-----|--------|
       | Drop src/firebase/storage.js getDownloadURL re-export | See in-phase carry-forward above — eligible to drop when CSP sweep happens |

       **Phase 11** (Documentation Pack):
       | Row | Reason |
       |-----|--------|
       | docs/RETENTION.md row for soft-delete (30d) + GDPR exports (24h URL TTL + indefinite bundle retention) + redactionList (indefinite — backup re-redaction substrate) | DOC-05 — Phase 11 owner; Phase 8 substrate ships, retention catalogue documented in evidence pack |
       | docs/CONTROL_MATRIX.md rows for LIFE-01..06 + GDPR-01..05 + BACKUP-01..07 | DOC-04 — Phase 11 owner; control catalogue cross-references the Phase 8 Audit Index |
       | PRIVACY.md updates: GCS backup region (europe-west2) + retention; redactionList substrate documented | DOC-02 — Phase 11 owner |

       **Phase 12** (Audit Walkthrough):
       | Row | Reason |
       |-----|--------|
       | SECURITY_AUDIT.md walkthrough — Phase 8 GDPR + lifecycle + backup sections | WALK-02 / WALK-03 — Phase 12 produces the report |

    5. **Phase 8 — Cleanup Ledger Status**:
       ```
       ledger_close_date: 2026-05-13
       phase_8_active_rows: 0
       phase_8_closed_rows_originated_in_phase: 4 (Phase 7 forward-tracking — all closed)
       phase_8_carry_forward_open_rows_with_closure_path: 2 (storage.js re-export / post-erasure script first run)
       forward_tracking_rows_queued: 7 (3 Phase 9 + 1 Phase 10 + 3 Phase 11 + 1 Phase 12)
       gate_status: PASS
       ```

       `phase_8_active_rows: 0` per Pitfall 19 substrate-honest disclosure: every Phase-8-originating row CLOSES with this commit; the 3 carry-forward rows are bounded with explicit closure paths and named owners.

    6. **Citations**: Pitfall 19 (substrate-honest); Pitfall 10 (backup-before-erasure ordering); 08-RESEARCH.md §Wave 0 Gaps (post-erasure audit script as deferred-execution); commit SHA TBD-by-executor.
  </action>
  <verify>
    <automated>test -f runbooks/phase-8-cleanup-ledger.md && grep -c "phase_8_active_rows: 0" runbooks/phase-8-cleanup-ledger.md</automated>
  </verify>
  <done>
    - File exists with the 6 sections above
    - `phase_8_active_rows: 0` literal string present
    - 4 rows in "Phase 7 forward-tracking — Phase 8 closure" each show CLOSED
    - 3 rows in in-phase carry-forward each show explicit closure path
    - Forward-tracking sections for Phase 9, 10, 11, 12 each have ≥ 1 row
    - Citations footer present
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 7: Final close-gate operator review</name>
  <what-built>
    Tasks 1-6 produced:
    - Production deployment of 8 Phase 8 Cloud Functions + rules update (Task 1)
    - Restore drill performed against production PITR or staging GCS export (Task 2)
    - 2 new runbooks: restore-drill-<date>.md (BACKUP-07 evidence) + phase-8-restore-drill-cadence.md (BACKUP-06)
    - SECURITY.md DOC-10 increment: 4 new sections + 19-row Phase 8 Audit Index
    - REQUIREMENTS.md flipped 18 rows + DOC-10 increment row
    - phase-8-cleanup-ledger.md zero-out gate; 7 forward-tracking rows queued for Phase 9/10/11/12

    Phase 8 close-gate: confirm everything is live + documented + audited; the next phase (9 — Observability) is unblocked.
  </what-built>
  <how-to-verify>
    Operator (Hugh / Luke) — final review pass, paste into PR comment:

    1. **Deployment state**:
       ```bash
       gcloud functions list --regions=europe-west2 --project=bedeveloped-base-layers --format="value(name,state)" | grep -E "(scheduledFirestoreExport|getDocumentSignedUrl|softDelete|restoreSoftDeleted|permanentlyDeleteSoftDeleted|scheduledPurge|gdprExportUser|gdprEraseUser)"
       ```
       Expected: 8 ACTIVE.

    2. **Rules version**: open https://console.firebase.google.com/project/bedeveloped-base-layers/firestore/rules and confirm latest rules version dated today contains the 5 notDeleted conjuncts + redactionList block.

    3. **Restore drill artifact**: confirm `runbooks/restore-drill-<YYYY-MM-DD>.md` exists with a Sign-off line + non-empty Timed Steps.

    4. **SECURITY.md**: open SECURITY.md and confirm the 4 new sections + Phase 8 Audit Index render correctly. Substrate-honest — every Validated row has Evidence pointers.

    5. **REQUIREMENTS.md**: open REQUIREMENTS.md and confirm:
       - LIFE-01..06, GDPR-01..05, BACKUP-01..07 (18 rows) all show `[x]` checkbox + "Closed Phase 8" inline note
       - Traceability table rows updated to "Validated 2026-05-13 (Phase 8 close ...)"
       - DOC-10 row's "Per-phase increments to date" sentence has the Phase 8 entry

    6. **Cleanup ledger**: confirm `runbooks/phase-8-cleanup-ledger.md` `phase_8_active_rows: 0` and the 4 Phase 7 forward-tracking rows all CLOSED.

    7. **STATE.md follow-up** (post-close): the orchestrator updates `.planning/STATE.md` to mark Phase 8 complete + flip the position bracket. This task does NOT modify STATE.md — that's the orchestrator's responsibility.

    Type "approved" if all 6 checks pass. If any fail, identify which and we patch.
  </how-to-verify>
  <resume-signal>Type "approved" to close Phase 8. The Phase 9 (Observability) plan can begin from a clean baseline.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| operator → firebase deploy | OIDC-authenticated CI or operator's `firebase login` identity |
| Cloud Functions → production Firestore + Storage | Per-function SAs (5 SAs total Phase 8: backup-sa, lifecycle-sa, storage-reader-sa, gdpr-reader-sa, gdpr-writer-sa) |
| operator → drill database (PITR clone) | Operator's gcloud identity; clone is throwaway, deleted post-drill |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-08-06-01 | Tampering | Selective deploy bypassing functions | mitigate | The deploy command in Task 1 step 3 explicitly names all 7 Phase 8 functions; if any are typo'd, deploy will print missing-function warning. Operator pastes deploy output into ledger for evidence (forces visual verification). |
| T-08-06-02 | Information Disclosure | Restore drill leaks production data | mitigate | Path A clones into a throwaway `restore-drill-<ts>` database; Task 2 step 5 deletes it post-drill. Path B imports into `bedeveloped-base-layers-staging` which is access-isolated from production. Operator MUST NOT export the drill database to anywhere outside the project. |
| T-08-06-03 | Repudiation | Drill outcome not recorded | mitigate | Task 2 + Task 3 mandate operator pastes commands + timings into the drill runbook. The runbook is committed to the repo — auditable artefact for Phase 12 walkthrough. |
| T-08-06-04 | Denial of Service | Production rules deploy locks out clients | mitigate | The 5 notDeleted conjuncts + the matching client where conjuncts (08-03 Task 4) ship in coordinated waves; rules deploy is preceded by Cloud Functions deploy so the client app already has the wrapper paths. Pitfall A risk is contained to the 1-deploy window; rollback path = `git revert <rules-commit-sha> && firebase deploy --only firestore:rules`. |
| T-08-06-05 | Elevation of Privilege | Drill operator gets transient elevated access | accept | Path A requires operator to have `roles/datastore.owner` to clone. Operator already has this for Phase 6/7 work (Hugh / Luke = admin claims). Drill database is throwaway. |
| T-08-06-06 | Tampering | SECURITY.md claims unbacked control (Pitfall 19) | mitigate | Each Audit Index row cites a specific file path + commit SHA. Substrate-honest disclosure — every row has Evidence pointers; LIFE-06 row cites src/views/admin.js + src/data/soft-deleted.js + functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts. No control claimed without evidence. |
</threat_model>

<verification>
- 8 Phase 8 Cloud Functions deployed to europe-west2 in production (Task 1 step 5)
- firestore.rules deployed with Wave 2 + Wave 4 additions (Task 1 step 4)
- First scheduledFirestoreExport produced an artefact in gs://bedeveloped-base-layers-backups/firestore/<YYYY-MM-DD>/ (Task 1 step 6)
- One restore drill performed and documented in `runbooks/restore-drill-<date>.md` (Task 2 + Task 3)
- `runbooks/phase-8-restore-drill-cadence.md` exists with quarterly cadence
- SECURITY.md has 4 new sections + Phase 8 Audit Index (19 rows)
- REQUIREMENTS.md has 18 LIFE/GDPR/BACKUP rows flipped + DOC-10 updated + 3 Traceability table status updates
- `runbooks/phase-8-cleanup-ledger.md` exists with `phase_8_active_rows: 0`
- All Phase 8 tests still green (root + functions/)
- Operator confirms close-gate review (Task 7)
</verification>

<success_criteria>
- BACKUP-06 + BACKUP-07: documented quarterly cadence + one drill performed and documented
- DOC-10 incremental: SECURITY.md grows by 4 sections + Audit Index
- All 19 Phase 8 requirement IDs (LIFE-01..06 + GDPR-01..05 + BACKUP-01..07 + DOC-10) marked Validated 2026-05-13
- Phase 8 cleanup ledger zero-out: 0 originating-active rows; 3 carry-forward bounded; 7 forward-tracking queued
- All 8 Phase 8 Cloud Functions deployed and ACTIVE in production
- Phase 9 (Observability) is unblocked — Phase 8 substrate (auditWrite invocations from gdprExportUser + gdprEraseUser) provides the events Phase 9 wires alerts on
</success_criteria>

<output>
After completion, create `.planning/phases/08-data-lifecycle-soft-delete-gdpr-backups/08-06-SUMMARY.md` covering:
- Deployment outcome: list of 8 deployed functions + URLs (or generation IDs)
- Rules deploy outcome + Firebase Console version increment
- Restore drill outcome: path chosen, total elapsed time, gaps found, RTO achieved
- 2 new runbooks created
- SECURITY.md sections added (paste section titles)
- REQUIREMENTS.md row update count (should be 19 — 18 + DOC-10)
- Cleanup ledger zero-out + forward-tracking row count (should be 7)
- Final commit SHA at Phase 8 close (so all SECURITY.md `TBD-by-executor` placeholders can be backfilled in a follow-up if desired)
- Forward pointer: Phase 9 unblocked
</output>
