---
phase: 08
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - scripts/setup-backup-bucket/run.js
  - scripts/setup-backup-bucket/lifecycle.json
  - scripts/setup-backup-bucket/lifecycle.notes.md
  - scripts/setup-backup-bucket/README.md
  - runbooks/phase-8-backup-setup.md
  - functions/test/_mocks/admin-sdk.ts
  - functions/package.json
  - functions/package-lock.json
autonomous: false
requirements:
  - BACKUP-02
  - BACKUP-03
  - BACKUP-04
  - DOC-10
user_setup:
  - service: gcp
    why: "Create backups GCS bucket, enable Firestore PITR, enable Storage versioning + soft-delete (operator-only — gcloud commands)"
    env_vars: []
    dashboard_config:
      - task: "Run setup script with ADC"
        location: "Local terminal: `gcloud auth application-default login` then `node scripts/setup-backup-bucket/run.js --project=bedeveloped-base-layers`"
must_haves:
  truths:
    - "GCS bucket gs://bedeveloped-base-layers-backups exists in europe-west2 with Uniform Bucket-Level Access and lifecycle policy applied (30d STANDARD→NEARLINE, 365d NEARLINE→ARCHIVE)"
    - "Firestore PITR is enabled on the (default) database (7-day rolling window)"
    - "GCS bucket gs://bedeveloped-base-layers-uploads has Object Versioning enabled and 90-day soft-delete retention"
    - "Operator runbook documents the exact gcloud commands run, expected output, and idempotency guarantees"
    - "functions/test/_mocks/admin-sdk.ts exports getStorageMock() (bucket().file().save() / file().getSignedUrl() / bucket().file().getFiles()) and FirestoreAdminClientMock (exportDocuments)"
  artifacts:
    - path: "scripts/setup-backup-bucket/run.js"
      provides: "Idempotent ADC script: create backups bucket + apply lifecycle.json + enable PITR + enable uploads versioning + enable uploads soft-delete (90d)"
      contains: "gcloud storage buckets create"
    - path: "scripts/setup-backup-bucket/lifecycle.json"
      provides: "GCS lifecycle JSON (30d Standard→Nearline, 365d Nearline→Archive)"
      contains: "SetStorageClass"
    - path: "runbooks/phase-8-backup-setup.md"
      provides: "Operator runbook for one-shot Wave 1 substrate provisioning"
    - path: "functions/test/_mocks/admin-sdk.ts"
      provides: "Extended mock surface — getStorageMock + FirestoreAdminClientMock for Phase 8 unit/integration tests"
      contains: "export function getStorageMock"
    - path: "functions/package.json"
      provides: "@google-cloud/firestore@8.5.0 added to dependencies"
      contains: "@google-cloud/firestore"
  key_links:
    - from: "scripts/setup-backup-bucket/run.js"
      to: "gs://bedeveloped-base-layers-backups"
      via: "gcloud storage buckets create + buckets update --lifecycle-file"
      pattern: "lifecycle-file"
    - from: "scripts/setup-backup-bucket/run.js"
      to: "Firestore (default) database"
      via: "gcloud firestore databases update --enable-pitr"
      pattern: "--enable-pitr"
    - from: "functions/test/_mocks/admin-sdk.ts"
      to: "Phase 8 Cloud Function unit tests (Wave 1+2+3+4 consumers)"
      via: "vi.mock('firebase-admin/storage', ...) + vi.mock('@google-cloud/firestore', ...)"
      pattern: "getStorageMock"
---

<objective>
Provision the backup substrate that Pitfall 10 makes load-bearing for the rest of Phase 8: a GCS backups bucket with the documented lifecycle policy, Firestore Point-in-Time Recovery on the production database, and uploads-bucket Object Versioning + 90-day soft-delete. Extend the shared Admin SDK mock so subsequent waves can write integration tests for Storage and Firestore-export surfaces without spinning up emulators.

Purpose: nothing in Wave 2/3/4 is safe to deploy until BACKUP-02/03/04 are live — the restore substrate is the safety net if soft-delete or GDPR erasure goes wrong. Per CONTEXT.md and 08-RESEARCH.md (User Constraints), this ordering is non-negotiable inside Phase 8.

Output: an idempotent ADC script + lifecycle JSON + operator runbook + extended test mocks + the @google-cloud/firestore dependency the Wave-2 export Cloud Function will import.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/08-data-lifecycle-soft-delete-gdpr-backups/08-CONTEXT.md
@.planning/phases/08-data-lifecycle-soft-delete-gdpr-backups/08-RESEARCH.md
@.planning/research/PITFALLS.md
@scripts/provision-function-sas/run.js
@scripts/enable-bigquery-audit-sink/run.js
@functions/test/_mocks/admin-sdk.ts
@functions/package.json
@runbooks/phase-7-bigquery-sink-bootstrap.md

<interfaces>
<!-- Pattern E one-shot ADC script — paste-ready signature shape from Phase 7. -->
<!-- Both reference scripts use spawnSync(child_process), --dry-run flag, --project= flag, --help, idempotency, and exit-0-or-1. -->

From scripts/enable-bigquery-audit-sink/run.js (Pattern F precedent):
- spawnSync("gcloud", [...], { encoding: "utf8" }) for every gcloud invocation
- DRY_RUN flag short-circuits before any mutating call
- PROJECT_ID resolution: --project=<id> arg → DEFAULT_PROJECT
- HELP flag prints usage and exits 0 before any side effect

From functions/test/_mocks/admin-sdk.ts (existing Phase 7 mock):
- export function _reset(): void  // clears docStore + customClaims maps
- export function _seedDoc(path, data): void
- export function getFirestoreMock(): { doc(path), collection(prefix), runTransaction(fn) }
- export function getAuthMock(): { setCustomUserClaims(uid, claims) }
- export const FieldValueMock = { serverTimestamp: () => SERVER_TIMESTAMP }
- adminMockState: { _reset, _seedDoc, _readDoc, _allDocs, _allClaims, SERVER_TIMESTAMP }

Wave 1 ADD (this plan):
- export function getStorageMock(): { bucket(name): { file(path): { save(data, opts), getSignedUrl(opts), getFiles(opts) }, getFiles(opts) } }
- export function getFirestoreAdminClientMock(): { databasePath(project, db), exportDocuments(req): Promise<[{ name }]> }
- export function _seedStorageObject(bucketName, path, body, contentType): void
- export function _allStorageObjects(): Map<string, { body, contentType, savedAt }>
- export function _allSignedUrls(): Array<{ bucket, path, expires, action }>
- adminMockState gains _seedStorageObject, _allStorageObjects, _allSignedUrls

Existing reference test for shape (do NOT edit, just mirror in mock):
@functions/test/integration/auditWrite.integration.test.ts (uses vi.mock("firebase-admin/firestore", ...) — Wave 2/3/4 will add vi.mock("firebase-admin/storage", ...) and vi.mock("@google-cloud/firestore", ...) using the new helpers)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add @google-cloud/firestore dependency to functions/ workspace</name>
  <read_first>
    - functions/package.json (verify firebase-admin@13.9.0 + firebase-functions@7.2.5 baseline)
    - 08-RESEARCH.md §Standard Stack + §Environment Availability (the missing dep)
  </read_first>
  <files>functions/package.json, functions/package-lock.json</files>
  <action>
    Run `cd functions && npm install @google-cloud/firestore@8.5.0 --save-exact` to add the package as an exact-pinned production dependency. The `--save-exact` flag is mandatory per project pattern (every existing dep in functions/package.json is pinned without `^` or `~`). The `Firestore.v1.FirestoreAdminClient` class from this package is the only Node-side way to invoke `exportDocuments` — `firebase-admin/firestore` exposes the data API but NOT the Admin/export API (per 08-RESEARCH.md §Standard Stack alternatives table).

    After install, run `cd functions && npm run typecheck` to confirm no TS resolution errors and `cd functions && npm test` to confirm Phase 7 baseline (133/133 tests) still passes.

    Do NOT add anything else. The bucket creation, IAM grants, and PITR enablement are operator-side gcloud actions handled by Task 2 (the script) — they are not npm dependencies.
  </action>
  <verify>
    <automated>cd functions && npm run typecheck && npm test 2>&1 | tail -20</automated>
  </verify>
  <done>
    - functions/package.json `dependencies` lists `"@google-cloud/firestore": "8.5.0"` (no caret, no tilde)
    - functions/package-lock.json updated with the new resolved tree
    - `cd functions && npm test` exits 0 (Phase 7 baseline 133 tests still pass)
    - `cd functions && npm run typecheck` exits 0
  </done>
</task>

<task type="auto">
  <name>Task 2: Author scripts/setup-backup-bucket/ — idempotent ADC script + lifecycle.json + README</name>
  <read_first>
    - scripts/provision-function-sas/run.js (Pattern E precedent — spawnSync, DRY_RUN, --project arg, idempotent diff)
    - scripts/enable-bigquery-audit-sink/run.js (Pattern F precedent — multi-step IAM + dataset provisioning idempotency)
    - 08-RESEARCH.md §Pattern 2 (lifecycle JSON exact contents) + §Pattern 3 (PITR gcloud commands) + §Pattern 4 (Storage versioning + soft-delete commands)
    - .planning/research/PITFALLS.md §13 (ADC only — no service-account JSON in source)
  </read_first>
  <files>scripts/setup-backup-bucket/run.js, scripts/setup-backup-bucket/lifecycle.json, scripts/setup-backup-bucket/lifecycle.notes.md, scripts/setup-backup-bucket/README.md</files>
  <action>
    Create three files mirroring the Phase 7 Pattern E/F shape:

    **scripts/setup-backup-bucket/lifecycle.json** — exactly this JSON content (verbatim from 08-RESEARCH.md §Pattern 2; pure JSON because `gcloud storage buckets update --lifecycle-file` requires strict JSON — comments live in the sibling `lifecycle.notes.md` file below, NOT inside lifecycle.json):
    ```json
    {
      "rule": [
        { "action": { "type": "SetStorageClass", "storageClass": "NEARLINE" }, "condition": { "age": 30, "matchesStorageClass": ["STANDARD"] } },
        { "action": { "type": "SetStorageClass", "storageClass": "ARCHIVE" }, "condition": { "age": 365, "matchesStorageClass": ["NEARLINE"] } }
      ]
    }
    ```

    **scripts/setup-backup-bucket/lifecycle.notes.md** — sibling documentation file co-located with lifecycle.json. The file MUST contain at minimum this paragraph (verbatim — the same phrasing is mirrored in SECURITY.md and the Phase 8 Audit Index per checker review warning #4):

    ```markdown
    # GCS lifecycle.json — dwell-time semantics

    GCS lifecycle: Standard at upload → Nearline at day 30 from creation → Archive at day 365 from creation (335-day Nearline dwell, exceeds BACKUP-02 90d Nearline minimum).

    Note: `age` values in lifecycle.json are **days-from-object-creation**, NOT days-from-prior-class-transition. Objects spend ~335 days in Nearline (day 30 to day 365), satisfying BACKUP-02's 90d Nearline minimum.

    Citations: BACKUP-02; 08-RESEARCH.md §Pattern 2; GCS lifecycle docs (https://docs.cloud.google.com/storage/docs/lifecycle-configurations).
    ```

    **scripts/setup-backup-bucket/run.js** — Node 22 ESM script. Header banner mirrors `scripts/enable-bigquery-audit-sink/run.js` lines 1-52 verbatim style: phase tag, requirement IDs (BACKUP-02/03/04), Pattern E reference, Pitfall 10 + 13 citations, ADC requirement, idempotency contract, usage block, exit codes. Constants:
      - `DEFAULT_PROJECT = "bedeveloped-base-layers"`
      - `DEFAULT_BACKUPS_BUCKET = "bedeveloped-base-layers-backups"`
      - `DEFAULT_UPLOADS_BUCKET = "bedeveloped-base-layers-uploads"`
      - `DEFAULT_LOCATION = "europe-west2"` (matches Firestore region per Pitfall 5)
      - `SOFT_DELETE_SECONDS = 7_776_000` (90 days)
      - `LIFECYCLE_FILE = path.join(import.meta.dirname, "lifecycle.json")`

    Args: `--project=<id>` (override), `--dry-run` (no mutations — print planned commands), `--help`/`-h`.

    Steps (each idempotent — check current state with describe before mutating):
      1. **Verify gcloud + ADC**: `gcloud auth application-default print-access-token` MUST succeed; otherwise print `[FAIL] Run \`gcloud auth application-default login\` first` and exit 1.
      2. **Create backups bucket** if absent: `gcloud storage buckets describe gs://${BACKUPS_BUCKET} --project=${PROJECT_ID}` — if exit code != 0 (NotFound), run `gcloud storage buckets create gs://${BACKUPS_BUCKET} --project=${PROJECT_ID} --location=${DEFAULT_LOCATION} --uniform-bucket-level-access --public-access-prevention=enforced`. If location returned by describe differs, FAIL with explicit message (do NOT delete).
      3. **Apply lifecycle policy** (always — gcloud is idempotent on identical policy): `gcloud storage buckets update gs://${BACKUPS_BUCKET} --lifecycle-file=${LIFECYCLE_FILE} --project=${PROJECT_ID}`.
      4. **Enable Firestore PITR**: `gcloud firestore databases describe --database="(default)" --project=${PROJECT_ID} --format="value(pointInTimeRecoveryEnablement)"` — if not `POINT_IN_TIME_RECOVERY_ENABLED`, run `gcloud firestore databases update --database="(default)" --enable-pitr --project=${PROJECT_ID}`. Skip if already enabled.
      5. **Enable uploads bucket Object Versioning**: describe via `gcloud storage buckets describe gs://${UPLOADS_BUCKET} --format="value(versioning.enabled)"`; if `False` or empty, run `gcloud storage buckets update gs://${UPLOADS_BUCKET} --versioning --project=${PROJECT_ID}`. If bucket does not exist, FAIL — uploads bucket must already exist from Phase 5.
      6. **Set uploads bucket soft-delete to 90 days**: describe via `gcloud storage buckets describe gs://${UPLOADS_BUCKET} --format="value(softDeletePolicy.retentionDurationSeconds)"`; if not `7776000`, run `gcloud storage buckets update gs://${UPLOADS_BUCKET} --soft-delete-duration=${SOFT_DELETE_SECONDS}s --project=${PROJECT_ID}`.
      7. **Print summary table** — bucket | location | lifecycle? | versioning? | soft-delete? | PITR? — using ASCII table format from `scripts/provision-function-sas/run.js` (mirror its `printSummary()` style verbatim).
      8. **Exit 0** on success; **exit 1** on any non-skip non-recoverable error.

    Use `spawnSync("gcloud", [...args], { encoding: "utf8" })` for every gcloud call. Wrap each in a tiny helper `runGcloud(args, { allowFail = false })` that returns `{ ok, stdout, stderr, code }`. DRY_RUN short-circuits before any mutating call (steps 2/3/4/5/6 print `[DRY-RUN] would run: gcloud ...` and continue).

    **scripts/setup-backup-bucket/README.md** — 40-80 lines documenting: prerequisites (gcloud SDK installed, ADC done), one-shot usage (`node scripts/setup-backup-bucket/run.js`), --dry-run + --project flags, what each step does, why it must run before any Phase 8 Cloud Function deploys (Pitfall F — bucket-not-found), expected idempotent re-run output, and a final note pointing to `runbooks/phase-8-backup-setup.md` for the operator runbook.
  </action>
  <verify>
    <automated>node scripts/setup-backup-bucket/run.js --dry-run --project=bedeveloped-base-layers 2>&1 | head -40</automated>
  </verify>
  <done>
    - `scripts/setup-backup-bucket/lifecycle.json` content matches 08-RESEARCH.md §Pattern 2 byte-for-byte (verified by `node -e "JSON.parse(require('fs').readFileSync('scripts/setup-backup-bucket/lifecycle.json','utf8'))"` — exits 0)
    - `scripts/setup-backup-bucket/run.js --help` prints usage and exits 0
    - `scripts/setup-backup-bucket/run.js --dry-run` prints `[DRY-RUN]` lines for steps 2-6 and exits 0 (or exits 1 with explicit `[FAIL]` if `gcloud auth application-default print-access-token` fails — that itself is a valid dry-run outcome)
    - Header banner cites BACKUP-02 + BACKUP-03 + BACKUP-04, Pitfall 10, Pitfall 13, Pattern E
    - README.md exists with usage + prerequisites
    - scripts/setup-backup-bucket/lifecycle.notes.md exists and contains the exact phrase "335-day Nearline dwell, exceeds BACKUP-02 90d Nearline minimum" (verified by `grep -c "335-day Nearline dwell" scripts/setup-backup-bucket/lifecycle.notes.md` == 1)
  </done>
</task>

<task type="auto">
  <name>Task 3: Author runbooks/phase-8-backup-setup.md operator runbook</name>
  <read_first>
    - runbooks/phase-7-bigquery-sink-bootstrap.md (precedent — operator runbook structure: prerequisites, ordered steps, expected output, troubleshooting, rollback, citations)
    - 08-RESEARCH.md §Pattern 1/2/3/4 + §Architectural Responsibility Map (lines marked "GCloud CLI / GCP Console — operator provisioning")
    - .planning/research/PITFALLS.md §10 (backup substrate must be live before any Wave 2/3 code lands)
  </read_first>
  <files>runbooks/phase-8-backup-setup.md</files>
  <action>
    Author a 150-300 line operator runbook with 8 sections (mirror `runbooks/phase-7-bigquery-sink-bootstrap.md` structure exactly):

    1. **Header** — phase tag (Phase 8 — BACKUP-02/03/04), date, objective: "Provision GCS backups bucket + Firestore PITR + uploads bucket versioning/soft-delete before any Phase 8 Cloud Function deploys (Pitfall 10)."

    2. **Prerequisites** — exact bullet list: gcloud SDK ≥ 480.0.0 installed; `gcloud auth application-default login` completed by an operator with `roles/owner` on `bedeveloped-base-layers` (or composite of `roles/storage.admin` + `roles/datastore.owner`); current working directory = repo root; commit `<TBD-by-executor>` checked out.

    3. **One-shot script execution**:
       - Dry-run first: `node scripts/setup-backup-bucket/run.js --dry-run --project=bedeveloped-base-layers` — paste the exact expected stdout (use a fenced block; mark fields that vary at runtime with `<…>`).
       - Real run: `node scripts/setup-backup-bucket/run.js --project=bedeveloped-base-layers` — paste the exact expected summary table.
       - Re-run idempotency check: re-run the real command; expected output: every step reports `[SKIP] already in desired state`.

    4. **Manual verification commands** (operator copy-pastes each, expected output documented):
       ```bash
       # Bucket location + UBLA + PAP
       gcloud storage buckets describe gs://bedeveloped-base-layers-backups --format="value(location,iamConfiguration.uniformBucketLevelAccess.enabled,iamConfiguration.publicAccessPrevention)"
       # Expected: EUROPE-WEST2  True  enforced

       # Lifecycle rules
       gcloud storage buckets describe gs://bedeveloped-base-layers-backups --format=json | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(JSON.stringify(d.lifecycle.rule, null, 2))"
       # Expected: 2 rules — STANDARD→NEARLINE@30d, NEARLINE→ARCHIVE@365d

       # PITR
       gcloud firestore databases describe --database="(default)" --format="value(pointInTimeRecoveryEnablement)"
       # Expected: POINT_IN_TIME_RECOVERY_ENABLED

       # Uploads versioning + soft-delete
       gcloud storage buckets describe gs://bedeveloped-base-layers-uploads --format="value(versioning.enabled,softDeletePolicy.retentionDurationSeconds)"
       # Expected: True  7776000s
       ```

    5. **IAM additions for downstream waves** (operator runs these AFTER the script — they grant Wave 2's `backup-sa` write to the backups bucket):
       ```bash
       # Service account creation (Wave 2 deploy will fail without this)
       gcloud iam service-accounts create backup-sa \
         --display-name="Phase 8 Firestore export writer" \
         --project=bedeveloped-base-layers

       # Project-level role for export operation
       gcloud projects add-iam-policy-binding bedeveloped-base-layers \
         --member="serviceAccount:backup-sa@bedeveloped-base-layers.iam.gserviceaccount.com" \
         --role="roles/datastore.importExportAdmin"

       # Bucket-level write
       gcloud storage buckets add-iam-policy-binding gs://bedeveloped-base-layers-backups \
         --member="serviceAccount:backup-sa@bedeveloped-base-layers.iam.gserviceaccount.com" \
         --role="roles/storage.objectAdmin"
       ```

    6. **Cost expectations** — copy from 08-RESEARCH.md §Pattern 3 (Cost Model): ~Same order of magnitude as live DB size for PITR, ~negligible for STANDARD→NEARLINE→ARCHIVE during hardening, document Pitfall D (export reads billed separately, accept).

    7. **Troubleshooting**:
       - `quota exceeded — bucket limit` → escalate; pre-existing project should be far below quota
       - `permission denied creating bucket` → operator lacks `roles/storage.admin`; check ADC identity with `gcloud auth list`
       - `database update is locked` (PITR enable) → wait 30s, re-run
       - `softDeletePolicy not supported in this project` → soft-delete requires Cloud Storage v2; project should already be on v2

    8. **Rollback** — explicit, terse: PITR can be disabled with `gcloud firestore databases update --database="(default)" --no-pitr` (incurs PITR-storage-cost stop). Bucket lifecycle can be unset with `gcloud storage buckets update gs://bedeveloped-base-layers-backups --clear-lifecycle`. Bucket itself MUST NOT be deleted while Wave 2's scheduledFirestoreExport could be running. Versioning + soft-delete on uploads bucket is reversible but data already in versioned/soft-deleted state remains.

    Close with citations: 08-RESEARCH.md §Pattern 1/2/3/4, PITFALLS.md §10 + §13, BACKUP-02/03/04 requirement IDs.
  </action>
  <verify>
    <automated>test -f runbooks/phase-8-backup-setup.md && grep -c "Expected:" runbooks/phase-8-backup-setup.md</automated>
  </verify>
  <done>
    - File exists at `runbooks/phase-8-backup-setup.md` with the 8 sections above
    - At least 4 distinct `Expected:` blocks in section 4 (bucket describe, lifecycle, PITR, uploads describe)
    - Citations footer references BACKUP-02, BACKUP-03, BACKUP-04, Pitfall 10, Pattern E
    - File length 150-400 lines (sanity check — runbook detail without bloat)
  </done>
</task>

<task type="auto">
  <name>Task 4: Extend functions/test/_mocks/admin-sdk.ts with Storage + FirestoreAdminClient mocks</name>
  <read_first>
    - functions/test/_mocks/admin-sdk.ts (existing exports, _reset / _seedDoc / getFirestoreMock / getAuthMock — keep verbatim, ADD only)
    - functions/test/integration/auditWrite.integration.test.ts (consumer pattern — vi.mock factory shape)
    - 08-RESEARCH.md §Wave 0 Gaps (test infrastructure listing)
  </read_first>
  <files>functions/test/_mocks/admin-sdk.ts</files>
  <action>
    Append (do NOT modify existing exports — this is purely additive so Phase 7's 133 tests remain green) to `functions/test/_mocks/admin-sdk.ts`:

    1. **Storage state** — module-level maps:
       ```typescript
       const storageObjects = new Map<string, { body: string | Buffer; contentType: string; savedAt: number }>();
       const issuedSignedUrls: Array<{ bucket: string; path: string; expires: number; action: string }> = [];
       ```
       Extend `_reset()` to clear both. Extend `adminMockState` to expose `_seedStorageObject`, `_allStorageObjects`, `_allSignedUrls`.

    2. **getStorageMock factory** — exposed as `export function getStorageMock()` returning:
       ```typescript
       {
         bucket(bucketName: string) {
           return {
             file(path: string) {
               const key = `${bucketName}/${path}`;
               return {
                 async save(data: string | Buffer, opts: { contentType?: string } = {}) {
                   storageObjects.set(key, { body: data, contentType: opts.contentType ?? "application/octet-stream", savedAt: Date.now() });
                 },
                 async getSignedUrl(opts: { version?: string; action?: string; expires: number }) {
                   issuedSignedUrls.push({ bucket: bucketName, path, expires: opts.expires, action: opts.action ?? "read" });
                   return [`https://signed.example/${bucketName}/${encodeURIComponent(path)}?expires=${opts.expires}`];
                 },
                 async delete() { storageObjects.delete(key); },
                 async exists() { return [storageObjects.has(key)]; },
               };
             },
             async getFiles(opts: { prefix?: string } = {}) {
               const matches = [...storageObjects.entries()]
                 .filter(([k]) => k.startsWith(`${bucketName}/${opts.prefix ?? ""}`))
                 .map(([k]) => ({ name: k.slice(bucketName.length + 1), async delete() { storageObjects.delete(k); } }));
               return [matches];
             },
           };
         },
       }
       ```

    3. **FirestoreAdminClient mock** — exposed as `export function getFirestoreAdminClientMock()`:
       ```typescript
       const exportCalls: Array<{ name: string; outputUriPrefix: string; collectionIds: string[] }> = [];
       export function _allExportCalls() { return [...exportCalls]; }
       export function getFirestoreAdminClientMock() {
         return {
           databasePath(projectId: string, db: string) { return `projects/${projectId}/databases/${db}`; },
           async exportDocuments(req: { name: string; outputUriPrefix: string; collectionIds?: string[] }) {
             exportCalls.push({ name: req.name, outputUriPrefix: req.outputUriPrefix, collectionIds: req.collectionIds ?? [] });
             return [{ name: `operations/export-${Date.now()}` }];
           },
         };
       }
       ```
       Extend `_reset()` to also clear `exportCalls`. Extend `adminMockState` to expose `_allExportCalls`.

    4. **Seed helper** — `export function _seedStorageObject(bucketName: string, path: string, body: string | Buffer, contentType = "application/octet-stream"): void` writes directly into the `storageObjects` map (mirrors `_seedDoc` shape).

    5. **Type-safety**: keep the file's existing `/* eslint-disable @typescript-eslint/no-explicit-any */` header. Re-export everything; verify Phase 7 tests still pass:
       - `cd functions && npm test` MUST exit 0 with the existing 133 tests still green
       - `cd functions && npm run typecheck` MUST exit 0
  </action>
  <verify>
    <automated>cd functions && npm test 2>&1 | tail -15</automated>
  </verify>
  <done>
    - `functions/test/_mocks/admin-sdk.ts` exports `getStorageMock`, `getFirestoreAdminClientMock`, `_seedStorageObject`, `_allStorageObjects`, `_allSignedUrls`, `_allExportCalls` (verified by `grep -c "^export" functions/test/_mocks/admin-sdk.ts` ≥ 12)
    - `_reset()` clears `storageObjects`, `issuedSignedUrls`, AND `exportCalls` in addition to its existing maps (grep `_reset` body for `storageObjects.clear` + `issuedSignedUrls.length = 0` + `exportCalls.length = 0`)
    - `adminMockState` object contains the 4 new helpers
    - `cd functions && npm test` exits 0 (Phase 7 baseline 133 tests still green; this plan adds NO new tests — tests land in subsequent waves)
    - `cd functions && npm run typecheck` exits 0
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5: Operator runs setup-backup-bucket script against bedeveloped-base-layers</name>
  <what-built>
    Tasks 1-4 produced:
    - `@google-cloud/firestore@8.5.0` added to functions/package.json (the dep Wave 2's scheduledFirestoreExport will import)
    - `scripts/setup-backup-bucket/{run.js,lifecycle.json,README.md}` — idempotent ADC script that creates the backups bucket, applies lifecycle policy, enables PITR, enables uploads versioning + 90-day soft-delete
    - `runbooks/phase-8-backup-setup.md` — operator runbook with prerequisites, dry-run + real-run procedure, manual verification commands, IAM additions for `backup-sa`, troubleshooting, rollback
    - Extended `functions/test/_mocks/admin-sdk.ts` with `getStorageMock`, `getFirestoreAdminClientMock`, plus seed/inspect helpers

    The operator now needs to actually run the script and verify the substrate is live in production. Wave 2 (08-02) cannot deploy `scheduledFirestoreExport` until step 1 + 2 below are done — the Cloud Function will fail with `bucket not found` (Pitfall F) on first invocation otherwise.
  </what-built>
  <how-to-verify>
    Operator (Hugh / Luke) executes — copy/paste each block, paste output into a comment on the PR or the cleanup ledger:

    1. **ADC + project context**:
       ```bash
       gcloud auth application-default login
       gcloud config set project bedeveloped-base-layers
       gcloud auth list
       ```
       Expected: active account is the operator's bedeveloped.com identity.

    2. **Dry run, then real run**:
       ```bash
       node scripts/setup-backup-bucket/run.js --dry-run --project=bedeveloped-base-layers
       # Review planned actions
       node scripts/setup-backup-bucket/run.js --project=bedeveloped-base-layers
       ```
       Expected: 6-step summary table at exit; exit code 0.

    3. **Verify backups bucket** (per runbook §4):
       ```bash
       gcloud storage buckets describe gs://bedeveloped-base-layers-backups \
         --format="value(location,iamConfiguration.uniformBucketLevelAccess.enabled,iamConfiguration.publicAccessPrevention)"
       ```
       Expected: `EUROPE-WEST2  True  enforced`

    4. **Verify lifecycle**:
       ```bash
       gcloud storage buckets describe gs://bedeveloped-base-layers-backups --format=json \
         | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(JSON.stringify(d.lifecycle.rule, null, 2))"
       ```
       Expected: 2 rules — `STANDARD→NEARLINE @ 30d` and `NEARLINE→ARCHIVE @ 365d`.

    5. **Verify PITR**:
       ```bash
       gcloud firestore databases describe --database="(default)" \
         --format="value(pointInTimeRecoveryEnablement)"
       ```
       Expected: `POINT_IN_TIME_RECOVERY_ENABLED`.

    6. **Verify uploads bucket versioning + soft-delete**:
       ```bash
       gcloud storage buckets describe gs://bedeveloped-base-layers-uploads \
         --format="value(versioning.enabled,softDeletePolicy.retentionDurationSeconds)"
       ```
       Expected: `True  7776000s`.

    7. **Provision `backup-sa`** (per runbook §5 — required before Wave 2 deploys):
       ```bash
       gcloud iam service-accounts create backup-sa \
         --display-name="Phase 8 Firestore export writer" \
         --project=bedeveloped-base-layers || echo "[SKIP] already exists"

       gcloud projects add-iam-policy-binding bedeveloped-base-layers \
         --member="serviceAccount:backup-sa@bedeveloped-base-layers.iam.gserviceaccount.com" \
         --role="roles/datastore.importExportAdmin"

       gcloud storage buckets add-iam-policy-binding gs://bedeveloped-base-layers-backups \
         --member="serviceAccount:backup-sa@bedeveloped-base-layers.iam.gserviceaccount.com" \
         --role="roles/storage.objectAdmin"
       ```
       Expected: each command exits 0 (or skips if binding already exists).

    8. **Re-run idempotency**: re-run step 2 — expected: every step reports `[SKIP] already in desired state`.
  </how-to-verify>
  <resume-signal>Type "approved" with pasted outputs of steps 3, 4, 5, 6 — OR describe issues for me to address.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| operator → gcloud | Operator's ADC identity holds project IAM roles to provision buckets + databases |
| script → GCS / Firestore Admin API | spawnSync invokes gcloud which uses the operator's ADC token |
| backups bucket → public internet | Bucket has UBLA + Public Access Prevention enforced — no allUsers / allAuthenticatedUsers binding ever |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-08-01-01 | Information Disclosure | gs://bedeveloped-base-layers-backups | mitigate | Bucket created with `--uniform-bucket-level-access --public-access-prevention=enforced` (Task 2 step 2). No allUsers / allAuthenticatedUsers binding ever. Verified by operator at Task 5 step 3. |
| T-08-01-02 | Tampering | scripts/setup-backup-bucket/run.js | mitigate | Idempotent script — every step describes-before-mutating; --dry-run flag printed actions before mutation; rerunning the script does not destroy state. |
| T-08-01-03 | Elevation of Privilege | backup-sa | mitigate | SA created with NO roles by default (Task 5 step 7 grants exactly two: `roles/datastore.importExportAdmin` project-wide + `roles/storage.objectAdmin` on backups bucket only). No `roles/storage.objectAdmin` at project level. |
| T-08-01-04 | Repudiation | Script execution | accept | Script-side audit-trail is the operator's terminal log + the PR comment they paste outputs into. Cloud Audit Logs (already wired in Phase 7 BigQuery sink) capture every gcloud mutation server-side regardless. |
| T-08-01-05 | Denial of Service | Firestore PITR enablement | accept | PITR enable is a one-shot command; Firestore takes seconds to apply. No DoS surface. |
| T-08-01-06 | Spoofing | gcloud ADC identity | mitigate | `gcloud auth application-default print-access-token` check at script start; if identity is wrong, operator must log out + log back in. Per Pitfall 13 — no service-account JSON in source ever. |
</threat_model>

<verification>
- `cd functions && npm test` exits 0 (Phase 7 baseline 133 tests still green; this plan introduces NO new tests in functions/test/)
- `cd functions && npm run typecheck` exits 0
- `cd functions && npm install` produces no resolution errors
- `node scripts/setup-backup-bucket/run.js --help` exits 0 with usage text
- `node scripts/setup-backup-bucket/run.js --dry-run --project=bedeveloped-base-layers` runs without exception (may exit 1 if ADC not configured — that itself is a valid dry-run signal)
- `runbooks/phase-8-backup-setup.md` exists and contains explicit `Expected:` blocks for bucket / lifecycle / PITR / uploads verifications
- `functions/test/_mocks/admin-sdk.ts` exports the new helpers; `grep -c "^export" functions/test/_mocks/admin-sdk.ts` returns ≥ 12
- Operator (Task 5) confirms backups bucket exists in europe-west2 with UBLA + lifecycle, PITR enabled, uploads bucket has versioning + 90d soft-delete, `backup-sa` provisioned with the two required role bindings
</verification>

<success_criteria>
- BACKUP-02 substrate: lifecycle.json + setup script in repo; operator-applied to backups bucket
- BACKUP-03 substrate: PITR enabled on (default) Firestore database
- BACKUP-04 substrate: uploads bucket Object Versioning + 90-day soft-delete enabled
- Wave 2 (08-02 backup-cloud-functions) can deploy without hitting Pitfall F (bucket-not-found)
- Wave 2/3/4 test files can `vi.mock("firebase-admin/storage", ...)` and `vi.mock("@google-cloud/firestore", ...)` against the new helpers in `functions/test/_mocks/admin-sdk.ts` without further mock infrastructure work
- Phase 7's 133 tests remain green (no regression)
</success_criteria>

<output>
After completion, create `.planning/phases/08-data-lifecycle-soft-delete-gdpr-backups/08-01-SUMMARY.md` covering:
- Files created/modified with line counts
- @google-cloud/firestore@8.5.0 install confirmation
- Operator execution outcome (Task 5) — paste of outputs steps 3-6 (or PR comment link)
- Confirmation that `backup-sa` exists with the two required role bindings
- Phase 7 baseline test count (should still be 133)
- Forward pointers: 08-02 will deploy `scheduledFirestoreExport` against the now-existing bucket; 08-04/08-05 will use the extended mocks
</output>
