# Phase 5 Subcollection Migration — Operator Runbook

**Authored:** 2026-05-08 (Phase 5 Wave 5)
**Owner:** Hugh (operator)
**Estimated execution time:** 30–60 min (depends on production data volume; expect <100 orgs)
**Risk profile:** HIGH — touches production Firestore data-at-rest. Bracketed by `gcloud firestore export` (D-04) for rollback.

> Phase 5 deliverable. Execute on cutover day per CONTEXT.md D-04 + D-08 Wave 5.
> Rollback substrate: the `gcloud firestore export` taken in §3.1 (D-04 invariant).
> Do NOT delete the export bucket contents until Phase 6 RULES-07 has shipped and at least one full week of stable production read traffic has elapsed.

This runbook is intentionally executor-deferred. The plan that authored it (05-05) deliberately did NOT run the export, the dry-run, the real migration, or the post-migration verification. Those are operator-only steps. The runbook exists so the operator follows a written script during a database-mutation cutover, not so improvisation happens at the keyboard.

The Phase 3 hosting-cutover runbook (`runbooks/hosting-cutover.md`) is the structural precedent — same shape (Prerequisites + Smoke + Cutover Steps + Rollback + Cleanup + Citations) with one extra section dedicated to post-migration verification because data mutations need a positive integrity assertion, not just "the new URL serves a 200".

---

## 1. Prerequisites

Before opening this runbook on cutover day, ALL of the following MUST be true. If any is false, stop and resolve it before continuing.

### From the build pipeline

- [ ] **Phase 5 Waves 1–4 all merged to `main`.** Verify with:
  ```sh
  git log --oneline --grep="^docs(05-0[1-4]):" -- .planning/
  ```
  At least four close-out summary commits should be present (one per wave).
- [ ] **`npm run test:rules` exits 0** on the latest `main` commit (Wave 1 contract).
- [ ] **`npm run test:migrate` exits 0** on the latest `main` commit (Wave 2 contract — covers builders + assertion harness).
- [ ] **`npm test` (full Vitest suite) exits 0** on the latest `main` commit. In particular:
  - The 5-minute clock-skew test (ROADMAP Phase 5 SC #4 — `tests/domain/unread.test.js`).
  - The H8 dispatcher test (Wave 4 — `tests/data/cloud-sync.test.js` post-rewrite version).
- [ ] **No `firebase deploy --only firestore:rules` invocation exists in any Phase 5 commit.** RULES-06 verification:
  ```sh
  git log --grep="firebase deploy --only firestore:rules" -- .
  ```
  Output MUST be empty. If anything is returned, that commit shipped rules to production prematurely (sequencing constraint #2 violation) — investigate before continuing.

### From the local environment

- [ ] **`firebase-admin@13.8.0` installed** in root devDependencies. Verify:
  ```sh
  npm pkg get devDependencies.firebase-admin
  ```
  Output should be `"13.8.0"`.
- [ ] **`gcloud` CLI installed; version >= 470.0.0.** Verify:
  ```sh
  gcloud --version
  ```
- [ ] **`gcloud auth application-default login` completed** so the migration script can pick up Application Default Credentials. Verify:
  ```sh
  gcloud auth application-default print-access-token | head -c 20
  ```
  Output should be a partial OAuth token (do NOT print the full token in any committed log).
- [ ] **Operator principal has `roles/datastore.importExportAdmin`** on the `bedeveloped-base-layers` project. Verify:
  ```sh
  gcloud projects get-iam-policy bedeveloped-base-layers \
    --format='table(bindings.role,bindings.members)' \
    | grep importExportAdmin
  ```
  At least one binding row containing the operator principal should appear. If not, request the role from the project owner before proceeding.
- [ ] **Backup bucket exists.** Verify:
  ```sh
  gsutil ls gs://bedeveloped-base-layers-backups/
  ```
  Should not return `BucketNotFoundException`. If the bucket does NOT exist, create it (one-time setup):
  ```sh
  gsutil mb -l europe-west2 gs://bedeveloped-base-layers-backups
  ```
  Region `europe-west2` is chosen for proximity to the Firestore region (verified per Phase 3 03-PREFLIGHT.md `## Firestore Region` once that PENDING-USER value is filled).
- [ ] **Storage Lifecycle policy on the bucket** — *deferred to Phase 8 BACKUP-02.* Phase 5 inherits whatever Phase 8 documents; the cutover does not block on lifecycle rules. Note: the export will sit in the bucket without a lifecycle rule until Phase 8 ships — this is an accepted carry-cost.

### From the production Firestore state

- [ ] **No live writes happening.** PROJECT.md baseline: project is between client engagements with no live users. Quick visual check via Firebase Console → Firestore → Data tab — no recent activity in the last hour.
- [ ] **Production Firestore current shape confirmed.** Open Firebase Console → Firestore → `orgs/{anyOrgId}` and confirm the parent doc still has nested-maps under `.responses`, `.comments`, `.actions`, `.documents`, `.messages`, `.readStates` (i.e. Wave 3's wrapper rewrites + Wave 4 rewrites have NOT yet flipped the actual data; the data still lives on the parent doc until this runbook runs).

### Cutover window

- [ ] **~1 hour active work scheduled.** Allow 30–60 min for the active flip, plus up to 15 min for the export operation to finish.
- [ ] **Foreground terminal session at the repo root** (`/path/to/base-layers-diagnostic`) with `gcloud auth application-default login` already completed.

---

## 2. Pre-cutover Smoke Checklist

Run these BEFORE invoking the migration. Each must pass.

- [ ] `npm run test:rules` exits 0 (Wave 1 emulator-tested rules suite — RULES-06 `committed and unit-tested` contract).
- [ ] `npm run test:migrate` exits 0 (Wave 2 builders + assertion harness suite — DATA-06 contract).
- [ ] `npm test` exits 0 (full unit suite — confirms no regression in views/* snapshots, the 5-min clock-skew test, the H8 dispatcher test).
- [ ] `git log --grep="firebase deploy --only firestore:rules" -- .` returns empty (RULES-06 verification — no rules deploy commands in any Phase 5 commit).
- [ ] Production Firestore Console → `orgs/{anyOrgId}` document inspector confirms current shape: nested-maps under `.responses`, `.comments`, `.actions`, `.documents`, `.messages`, `.readStates` (NOT subcollections yet — those land in §3.3).
- [ ] No `migrations/` collection exists at the root yet (or if it does, inspect it — a stray `migrations/{stepId}/items/{docId}` from an aborted prior run is OK because of D-02 idempotency markers, but you should know it's there before proceeding).

If any smoke fails, STOP and resolve before invoking §3.

---

## 3. Cutover Steps

The active flip is ~1 hour. Steps below are sequenced for that window.

### 3.1 Take pre-migration backup (D-04 — the rollback substrate)

```sh
ISO=$(date -u +%Y-%m-%dT%H-%M-%SZ)
gcloud firestore export gs://bedeveloped-base-layers-backups/pre-phase5-migration/$ISO/ \
  --project=bedeveloped-base-layers
```

Capture the operation name from the output (e.g. `projects/bedeveloped-base-layers/databases/(default)/operations/AS...`). The operation may take 1–10 minutes depending on data volume.

Wait for the operation to complete:

```sh
gcloud firestore operations describe <OPERATION_NAME> --project=bedeveloped-base-layers
```

`done: true` confirms the export landed. Verify the bucket has metadata:

```sh
gsutil ls gs://bedeveloped-base-layers-backups/pre-phase5-migration/$ISO/
```

Should list `firestore_export.overall_export_metadata` plus per-collection metadata files. **Record the ISO timestamp + bucket URI + operation name in `.planning/phases/05-firestore-data-model-migration-rules-authoring-committed-not-deployed/05-PREFLIGHT.md` `## Cutover Log → pre_migration_export` block.**

This export is the substrate for §5 Rollback Procedure. Do NOT proceed to §3.2 until `done: true` is observed.

### 3.2 Dry-run rehearsal (D-06 — the audit-friendly substitute for staging)

```sh
cd /path/to/base-layers-diagnostic
node scripts/migrate-subcollections/run.js --dry-run 2>&1 | tee scripts/migrate-subcollections/dry-run-output.log
```

The script runs every step in dry-run mode: reads source `orgs/{orgId}` parent docs, builds target subcollection paths (responses-v1 → comments-v1 → actions-v1 → documents-v1 → messages-v1 → readStates-init — this is the Pitfall 10 leaves-first ordering documented in `scripts/migrate-subcollections/run.js` `STEPS` constant), logs intent per step. ZERO Firestore writes; ZERO marker writes (D-06 short-circuit at the write site, not at the read site — the read paths still execute fully so the dry-run also exercises every per-doc shape transformation).

Eyeball the output:

- [ ] `[MODE] DRY-RUN -- no Firestore writes will occur` appears at the top of the log.
- [ ] `[PRE]` block at the start lists `orgs N` (matches your known production org count) plus `responses 0`, `comments 0`, `actions 0`, `documents 0`, `messages 0`, `readStates 0` (the subcollections are empty pre-migration).
- [ ] Each `=== STEP {stepId} ===` block prints `[STEP {stepId}] orgs=N skipped=0 written=0 dryRunWouldWrite={count>0}` — the `dryRunWouldWrite` count for each step should be non-zero if the source data has nested-maps for that collection (zero suggests the source-shape inspection failed; investigate before proceeding).
- [ ] Final line: `[OK] Dry-run complete; no writes performed; rerun without --dry-run to execute.`
- [ ] No `[FAIL]` lines anywhere.
- [ ] No surprise stack traces from `processDoc` (those would indicate a builder choking on an unexpected source shape — Open Question 2 from RESEARCH.md; the dry-run is the discovery substrate).

If anything looks wrong, INVESTIGATE before proceeding to §3.3. The dry-run is your last cheap discovery point.

Commit the dry-run log as audit evidence:

```sh
git add scripts/migrate-subcollections/dry-run-output.log
git commit -m "chore(05-05): capture pre-cutover dry-run log evidence"
```

Record the commit SHA in `05-PREFLIGHT.md ## Cutover Log → dry_run.log_committed`.

### 3.3 Real migration execution

```sh
node scripts/migrate-subcollections/run.js 2>&1 | tee scripts/migrate-subcollections/real-run-output.log
```

The script (per `scripts/migrate-subcollections/run.js`):

1. Captures pre-counts via `captureBaselineCounts` (orgs count + per-subcollection `collectionGroup` counts; expected zero for all subcollections).
2. Iterates 6 STEPS in this order (per `STEPS` constant — Pitfall 10 leaves-first):
   - `responses-v1` → `comments-v1` → `actions-v1` → `documents-v1` → `messages-v1` → `readStates-init`
3. Per step: iterates every `orgs/{orgId}` doc; per source doc invokes `processDoc(...)` which:
   - Reads/writes the per-doc idempotency marker at `migrations/{stepId}/items/{orgDocId}` (D-02 — PENDING marker before processing, DONE marker after).
   - Builds the target docs via the step's builder (`buildResponses` etc. from `scripts/migrate-subcollections/builders.js` — pure, no firebase-admin imports).
   - Batches up to 499 subcollection writes per Firestore commit (the 500 cap minus 1 for the marker write).
   - Inline `legacyAppUserId` / `legacyAuthorId` fields are written verbatim per D-03.
4. Captures post-counts; runs `assertCollectionGroupCount(preCounts, postCounts)` — orgs parent count must match exactly; subcollection counts must be ≥ pre-migration. Throws on regression.
5. Runs `assertFieldPresence(db, sampleSize=20)` — samples up to 20 docs each from `responses` (must have `legacyAppUserId`), `comments` (`legacyAuthorId`), `messages` (`legacyAuthorId`); throws if any sampled doc is missing the expected field.
6. Logs `[OK] Migration complete; pre/post assertions passed.` on success.

If any assertion FAILS, the script exits with `process.exitCode = 1` (per the `main().catch(...)` handler in `run.js`). The migration is partially done; markers under `migrations/{stepId}/items/{docId}` indicate what completed. Decision tree:

- **(A) Investigate the failure, fix the bug, re-run.** The migration is idempotent: DONE markers cause `processDoc` to skip; PENDING markers cause it to re-process; new sources get processed fresh. Re-running is safe.
- **(B) Roll back per §5.** Choose this if the failure indicates structural data corruption that re-running won't fix (e.g. an unexpected source-shape that shipped wrong-shape writes for some docs before the assertion caught it).

If `[OK] Migration complete; pre/post assertions passed.` logs without errors, capture the pre/post counts from the log into `05-PREFLIGHT.md ## Cutover Log → real_migration` block, then proceed to §3.4.

### 3.4 Commit the real-run log + post-cutover artefacts

```sh
git add scripts/migrate-subcollections/real-run-output.log
git commit -m "chore(05-05): capture phase 5 production migration execution log"
```

Record the commit SHA in `05-PREFLIGHT.md ## Cutover Log → real_migration.log_committed`.

---

## 4. Post-Migration Verification

Required positive-integrity assertion — DATA-06 closure on the live database.

- [ ] Open Firebase Console → Firestore → `orgs/{anyOrgId}` → Subcollections; confirm `responses`, `comments`, `actions`, `documents`, `messages`, `readStates` subcollections exist with non-zero doc counts (or zero only if the source nested-map was empty for that collection on that org).
- [ ] Spot-check 3 migrated docs across different collections (e.g. `orgs/{X}/responses/{respId}`, `orgs/{Y}/comments/{cmtId}`, `orgs/{Z}/messages/{msgId}`); each should have:
  - The expected target shape per `scripts/migrate-subcollections/builders.js` (responses → `roundId`/`userId`/`legacyAppUserId`/`pillarId`/`values`/`updatedAt`; comments → `pillarId`/`authorId`/`legacyAuthorId`/`body`/`internalOnly`/`createdAt`; messages → `authorId`/`legacyAuthorId`/`body`/`createdAt`).
  - The D-03 inline legacy field (`legacyAppUserId` or `legacyAuthorId`) populated with the source `userId`/`authorId` value verbatim.
- [ ] Run the verify-only mode against production:
  ```sh
  node scripts/migrate-subcollections/run.js --verify
  ```
  Exit code 0 means `assertFieldPresence` passes — the inline-legacy-field invariant holds across a fresh sample.
- [ ] Quick read smoke test against production via the `data/*` wrappers. Start the dev server (`npm run dev`), open `http://localhost:5178/`, and confirm:
  - Dashboard loads.
  - Org list populates.
  - Selecting an org loads comments / actions / messages without console errors.
  - The unread-count badge calculation runs without throwing (Wave 4 H7 + H8 fixes — comparator now reads server-time `readStates`).
- [ ] Document the spot-check evidence + verify-mode exit code + smoke-test outcome in `05-PREFLIGHT.md ## Cutover Log → post_verification` block.

If any verification step regresses, **roll back per §5** — partial-data state with a working `data/*` layer is worse than rolled-back state.

---

## 5. Rollback Procedure

**Trigger:** §3.3 assertion failure that re-running won't fix, OR §4 verification step regresses, OR a data-integrity issue discovered post-cutover within the same operator session.

**Rollback substrate:** the `gcloud firestore export` taken in §3.1 (D-04 invariant). The migration script's per-doc markers are not used for rollback — they are the substrate for re-running, not for reversing.

```sh
gcloud firestore import gs://bedeveloped-base-layers-backups/pre-phase5-migration/$ISO/ \
  --project=bedeveloped-base-layers
```

(Where `$ISO` is the timestamp captured in §3.1 — also recorded in `05-PREFLIGHT.md ## Cutover Log → pre_migration_export.iso_timestamp`.)

`gcloud firestore import` REPLACES production with the export taken at §3.1. Allow 5–15 minutes for the operation. Wait for `done: true` per the same `gcloud firestore operations describe ...` pattern as §3.1.

Verify rollback success:

- [ ] Spot-check `orgs/{anyOrgId}` — the parent doc has nested-maps under `.responses`/`.comments`/`.actions`/`.documents`/`.messages`/`.readStates` again (i.e. pre-migration shape is restored).
- [ ] Subcollections under `orgs/{anyOrgId}` are empty (or absent — the import replaces the entire database state with the export contents).
- [ ] `migrations/{stepId}` markers may still exist if the import's `--collection-ids` filter excluded them. Manually delete via Firebase Console: Firestore → `migrations` → "Delete Collection" (or via `gcloud firestore delete`). The markers are non-load-bearing post-rollback — leftover state, not a correctness issue.
- [ ] The dev-server smoke test from §4 still passes against the rolled-back data (the `data/*` wrappers were rewritten in Wave 3 to read subcollections — so post-rollback the wrappers will return empty results until the migration is re-run; this is expected; the rollback is intentionally a clean reverse to pre-Wave-3-execution shape).

Update `05-PREFLIGHT.md ## Cutover Log → cutover_outcome` to `rolled-back` and fill `rollback_reason` + the relevant timestamps. Commit:

```sh
git add .planning/phases/05-firestore-data-model-migration-rules-authoring-committed-not-deployed/05-PREFLIGHT.md
git commit -m "chore(05-05): record cutover rollback in 05-PREFLIGHT.md"
```

After rollback, RE-RUN the local test suite + investigate the root cause before retrying. Do NOT redeploy rules (Phase 6's job anyway) or invoke the migration again until the root cause is understood.

---

## 6. Post-cutover cleanup (deferred to later phases)

The following are intentionally NOT done by Phase 5; cleanup-ledger rows are queued per CONTEXT.md D-21:

- [ ] **Phase 6 (AUTH-15):** backfill `legacyAppUserId` → `firebaseUid` mapping; delete the inline legacy fields after every migrated user has a Firebase Auth UID. This is why D-03 preserves them inline rather than dropping them — Phase 6's bootstrap is a single-pass walk against these fields.
- [ ] **Phase 6 (RULES-07):** deploy `firestore.rules` + `storage.rules` to production. Phase 5 ships them committed-not-deployed per RULES-06 + Sequencing Non-Negotiable #2 (rules deployed only after Auth is live). The deploy command (`firebase deploy --only firestore:rules,storage:rules`) is held until Phase 6's deploy-job runs.
- [ ] **Phase 7 (FN-09):** replace the `rateLimits/` `allow read, write: if false` deny-block with the `request.time` predicate against `rateLimits/{uid}/buckets/{windowStart}`. Phase 5 ships the deny-block only.
- [ ] **Phase 7 (FN-01..09):** add Cloud Function writers for `auditLog/`, `softDeleted/`. Phase 5 ships only the rules-side `allow read, write: if false` for these; the writer side is Phase 7.
- [ ] **Old nested-map fields on parent `orgs/{orgId}` docs are NOT deleted by Phase 5.** `.responses`, `.comments`, `.actions`, `.documents`, `.messages`, `.readStates` on the parent doc remain populated post-migration as orphaned-but-harmless data. They become stale at the moment §3.3 completes (the `data/*` wrappers no longer read them). A cleanup-ledger row is queued for a Phase 6+ wave to delete them once Phase 6's RULES-07 deploy + the AUTH-15 backfill have shipped — premature deletion would forfeit the rollback option in §5.

These are not optional follow-ups — they are explicit downstream-phase commitments. Each is recorded in CONTEXT.md D-21 and tracked in the cleanup ledger.

---

## 7. Citations

- **CONTEXT.md D-01** — One-shot Node script using firebase-admin SDK, run locally; lives at `scripts/migrate-subcollections/run.js`.
- **CONTEXT.md D-02** — Per-doc idempotency markers under `migrations/{stepId}/items/{docId}`; per-source-doc granularity for partial-run resumability.
- **CONTEXT.md D-03** — Inline legacy fields (`legacyAppUserId`, `legacyAuthorId`) preserved on every migrated doc; substrate for Phase 6 AUTH-15 backfill.
- **CONTEXT.md D-04** — Manual `gcloud firestore export` taken immediately before the migration; rollback procedure is `gcloud firestore import` of that export.
- **CONTEXT.md D-05** — No separate staging Firebase project; runs directly against production. Justification: no live users + idempotency + pre-migration export + emulator-tested rules. Audit-narrative line carried verbatim.
- **CONTEXT.md D-06** — `--dry-run` flag; the audit-friendly substitute for staging (per `<specifics>` 3rd bullet).
- **CONTEXT.md D-08** — 6-wave shape; Wave 5 is the production-execution wave.
- **CONTEXT.md `<specifics>` 1st bullet** — "we run on prod" decision is operator-level confidence, not a generic recommendation. Rationale captured in SECURITY.md DOC-10 (Wave 6).
- **CONTEXT.md `<specifics>` 3rd bullet** — `--dry-run` flag's audit-evidence value (committed dry-run log is stronger than "we ran it on staging and it worked").
- **CONTEXT.md D-21** — Cleanup-ledger row queueing for Phase 6 + Phase 7 follow-ups (legacy-field deletion, RULES-07 deploy, FN-09 rate-limit predicate, FN-01..09 audit/softDelete writers, old-nested-map cleanup).
- **RESEARCH.md Pattern 1** — Application Default Credentials loading via `gcloud auth application-default login`.
- **RESEARCH.md Pattern 2** — Idempotency-marker pattern for re-runnable migrations.
- **RESEARCH.md Pattern 8** — `firebase.json` declares the rules paths; deploy is held for Phase 6.
- **PITFALLS.md §Pitfall 10** — ID migration without idempotency. Closed by D-02 markers + D-04 export + D-06 dry-run.
- **PITFALLS.md §Pitfall 5** — Anonymous-auth UID vs app-internal userId mapping. Substrate is the inline legacy fields per D-03; Phase 6 backfills.
- **PITFALLS.md §Pitfall 20** — H7 + H8 entanglement in a bundled cutover. D-08 splits into two Wave 4 commits + this runbook keeps the data migration out of Phase 6's bundled Auth + rules-deploy cutover.
- **ARCHITECTURE.md §4** — Target Firestore data model (subcollection layout per `orgs/{orgId}/{collection}/{itemId}`).
- **`scripts/migrate-subcollections/run.js`** — `STEPS` constant defines the 6 stepIds + leaves-first ordering this runbook documents verbatim.
- **`scripts/migrate-subcollections/builders.js`** — pure builder functions; the per-doc target shape this runbook references in §4 verification.
- **`scripts/migrate-subcollections/assertions.js`** — `captureBaselineCounts`, `assertCollectionGroupCount`, `assertFieldPresence`, `summarise`. The DATA-06 closure substrate.
- **`runbooks/hosting-cutover.md`** — Phase 3 precedent for runbook structure (Prerequisites + Smoke + Cutover Steps + Rollback + Cleanup + Citations).
- **REQUIREMENTS.md DATA-01..06** — Subcollection migration + idempotency + assertion harness + dry-run + rollback. Closed by Phase 5 Wave 5 execution.
- **REQUIREMENTS.md RULES-06** — Rules committed and unit-tested in Phase 5 but deployed to production only in Phase 6 (verified by §1 + §2 prerequisites).
- [Firebase Admin SDK — Node.js Setup](https://firebase.google.com/docs/admin/setup)
- [`gcloud firestore export` documentation](https://cloud.google.com/sdk/gcloud/reference/firestore/export)
- [`gcloud firestore import` documentation](https://cloud.google.com/sdk/gcloud/reference/firestore/import)
- OWASP ASVS L2 v5.0 V14.7 (Build & Deploy Pipeline) — change-management discipline this runbook activates.
- ISO/IEC 27001:2022 A.5.7 (cloud services), A.12.3.1 (information backup) — the export-before-mutation step.
- SOC 2 CC8.1 (change management) — the runbook IS the change-management evidence.
- GDPR Art. 32(1)(b) (confidentiality of processing systems and services) — the inline legacy-field strategy preserves auditability through the Phase 6 cutover.
