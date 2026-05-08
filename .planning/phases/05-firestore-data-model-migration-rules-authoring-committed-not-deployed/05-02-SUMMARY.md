---
phase: 05-firestore-data-model-migration-rules-authoring-committed-not-deployed
plan: 02
subsystem: data-migration
tags: [migration, firebase-admin, idempotency, dry-run, batch-writes, collection-group, pre-post-assertions, tdd, dependency-injection]
requires:
  - "Plan 05-01 firestore.rules + storage.rules (committed contract; migration writes must satisfy reads under those rules post-deploy)"
  - "firebase-admin@^13.8.0 installed in root devDependencies (NEVER in src/ — Pitfall 4)"
  - "Phase 4 D-09 src/data/* pass-through wrappers (source-of-truth for current nested-map / flat-map shapes)"
provides:
  - "scripts/migrate-subcollections/builders.js — 6 pure builder functions (buildResponses/Comments/Actions/Documents/Messages/ReadStatesInit)"
  - "scripts/migrate-subcollections/process-doc.js — DI-friendly per-source-doc processor with two-phase markers + dry-run + 499-op batch"
  - "scripts/migrate-subcollections/run.js — Node entrypoint with applicationDefault() + --dry-run / --verify CLI flags + 6-step orchestrator + pre/post assertions"
  - "scripts/migrate-subcollections/assertions.js — captureBaselineCounts, assertCollectionGroupCount (pure), assertFieldPresence, summarise"
  - "tests/scripts/migrate-subcollections/{builders,assertions,idempotency}.test.js — 57 unit tests (29+18+10)"
  - "npm run test:migrate — vitest wrapper for the migrate-subcollections suite"
affects:
  - "Wave 3 (Plan 05-03+) — src/data/* body rewrites consume the subcollection shape this script produces"
  - "Wave 5 — operator runbook references run.js invocation pattern (--dry-run -> real run -> --verify)"
  - "Phase 6 (AUTH-15) — bootstrap migration uses the inline legacyAppUserId/legacyAuthorId fields preserved by these builders"
tech-stack:
  added:
    - "firebase-admin@^13.8.0 (root devDependencies; ESM sub-path imports: firebase-admin/app + firebase-admin/firestore)"
  patterns:
    - "Pure builder pattern (builders.js) — no firebase-admin imports; testable without emulator (D-08 Wave 2)"
    - "Dependency injection on processDoc(deps, stepId, builderFn, sourceDoc) — testable in isolation"
    - "Two-phase idempotency markers (D-02 / RESEARCH Pattern 2) — PENDING before writes, DONE after"
    - "WriteBatch flush at __BATCH_FLUSH_THRESHOLD=499 (Pitfall 8 — strictly under Firestore's 500-op ceiling)"
    - "--dry-run short-circuits at the WRITE site (D-06 / Pitfall 5) — read paths execute fully"
    - "ESM sub-path imports for firebase-admin (Pitfall 4 — never the bare 'firebase-admin' specifier)"
    - "applicationDefault() ADC credentials (D-04 — operator runs gcloud auth application-default login pre-invocation)"
    - "Conventional Commits — feat(05-02) for both tasks"
key-files:
  created:
    - "scripts/migrate-subcollections/builders.js — 6 pure functions, 218 lines, zero firebase-admin imports"
    - "scripts/migrate-subcollections/assertions.js — 4 exports (captureBaselineCounts, assertCollectionGroupCount, assertFieldPresence, summarise)"
    - "scripts/migrate-subcollections/process-doc.js — DI processor with __BATCH_FLUSH_THRESHOLD=499 export"
    - "scripts/migrate-subcollections/run.js — Node entrypoint with shebang, ADC init, 6-step orchestrator"
    - "tests/scripts/migrate-subcollections/builders.test.js — 29 cells (per-builder + edge cases + D-03 cross-cutting + module-shape)"
    - "tests/scripts/migrate-subcollections/assertions.test.js — 18 cells (count capture + regression detection + field-presence sampling)"
    - "tests/scripts/migrate-subcollections/idempotency.test.js — 10 cells (PENDING->DONE, SKIP, RE-PROCESS, dry-run, batch flush 499/600/0, marker path)"
    - ".planning/phases/05-.../deferred-items.md — pre-existing tests/rules/** lint errors (Plan 05-01 carry-forward)"
  modified:
    - "package.json — firebase-admin@^13.8.0 in devDependencies; test:migrate script wired"
    - "package-lock.json — regenerated (firebase-admin transitive deps)"
    - "eslint.config.js — Node-globals languageOptions block extended from tests/**/*.js to ['tests/**/*.js', 'scripts/**/*.js'] so process.exitCode in run.js lints clean (Rule 3 fix; plan Task 2 Step 6)"
decisions:
  - "ID: D-01 closure — Node + firebase-admin Admin SDK; one-shot script at scripts/migrate-subcollections/run.js (NOT a Cloud Function)"
  - "ID: D-02 closure — per-doc markers at migrations/{stepId}/items/{docId}; two-phase pending->done; SKIP fires only on done; PENDING re-processes (verified by 3 dedicated test cells)"
  - "ID: D-03 closure — every applicable builder writes inline legacyAppUserId or legacyAuthorId verbatim; 6 cross-cutting test cells pin the invariant"
  - "ID: D-06 closure — --dry-run flag short-circuits at the WRITE site; reads + builder execute fully; markers + batch writes do not (verified by 2 test cells)"
  - "ID: Pitfall 4 closure — firebase-admin NEVER imported from src/ (verified: grep -rc 'firebase-admin' src/ -> 0); ESM sub-path imports verified by acceptance grep"
  - "ID: Pitfall 8 closure — __BATCH_FLUSH_THRESHOLD=499 (one under the 500-op ceiling); 600-doc fixture proves 499+101 split; 499 boundary case proves trailing-empty-batch behaviour"
  - "ID: Pitfall 10 closure — idempotency markers + builder purity ensure re-runs don't duplicate (DONE skip) or destroy (PENDING re-process resumes from same marker)"
  - "ID: Step ordering — responses-v1 -> comments-v1 -> actions-v1 -> documents-v1 -> messages-v1 -> readStates-init (deepest-leaves-first per Pitfall 10; readStates last because the new collection is initialised, not migrated)"
  - "ID: DI refactor — processDoc extracted to process-doc.js with (deps, stepId, builder, sourceDoc) signature; run.js passes real {db, FieldValue, dryRun}; tests inject mocks. Plan Task 2 Step 4 explicitly recommended this; followed verbatim"
  - "ID: __BATCH_FLUSH_THRESHOLD exported as test-introspection constant; pinned by an explicit test cell so a future change away from 499 fails CI loudly"
metrics:
  duration: "~25 minutes (after firebase-admin npm install completed)"
  tasks-completed: 2
  commits: 2
  test-files-added: 3
  test-cells: 57
  test-pass-rate: "100% (57/57 green)"
  unit-suite-delta: "+57 (376 baseline -> 433 total)"
  builders: 6
  assertion-helpers: 4
  migration-steps: 6
  completed-date: "2026-05-08"
---

# Phase 5 Plan 02: Wave 2 Migration Script — builders + assertions + run.js + idempotency markers Summary

**One-liner:** Production-quality one-shot Node + firebase-admin subcollection migration script with pure builder functions for 6 collections, two-phase idempotency markers (PENDING -> DONE), --dry-run short-circuit, 499-op WriteBatch flushing, and pre/post collectionGroup count + field-presence assertion harness — all backed by 57 unit tests that exercise the substrate without booting an emulator (D-08 Wave 2).

## What Shipped

### Migration substrate

#### Pure builders (`scripts/migrate-subcollections/builders.js` — D-11 / D-03)

Six pure functions, each translating one slice of the legacy `orgs/{orgId}` parent doc to ARCHITECTURE.md §4 subcollection paths:

| Step id            | Builder              | Source shape                                             | Target path                                                | D-03 inline legacy field          |
| ------------------ | -------------------- | -------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------- |
| `responses-v1`     | `buildResponses`     | nested-map: `responses[roundId][userId][pillarId][idx]`  | `orgs/{orgId}/responses/{roundId}__{userId}__{pillarId}`   | `legacyAppUserId: userId`         |
| `comments-v1`      | `buildComments`      | nested-map: `comments[pillarId][i]` (array of {id, ...}) | `orgs/{orgId}/comments/{c.id}`                             | `legacyAuthorId: c.authorId`      |
| `actions-v1`       | `buildActions`       | flat-map: `actions[actionId]`                            | `orgs/{orgId}/actions/{actionId}`                          | `legacyAppUserId: a.ownerId`      |
| `documents-v1`     | `buildDocuments`     | flat-map: `documents[docId]` (metadata only)             | `orgs/{orgId}/documents/{docId}`                           | `legacyAppUserId: d.uploadedBy`   |
| `messages-v1`      | `buildMessages`      | flat-map: `messages[messageId]`                          | `orgs/{orgId}/messages/{messageId}`                        | `legacyAuthorId: m.authorId`      |
| `readStates-init`  | `buildReadStatesInit`| nested-map: `readStates[userId][pillarId] = ISO`         | `orgs/{orgId}/readStates/{userId}` (one doc per user)      | `legacyAppUserId: userId`         |

Each builder takes `(orgId, orgData)` and returns `Array<{ path, data }>`. **No firebase-admin imports** — these are unit-testable without booting any SDK or emulator (Pitfall 4 closure verified by `grep -c "from 'firebase-admin" scripts/migrate-subcollections/builders.js` -> 0).

#### Assertion harness (`scripts/migrate-subcollections/assertions.js` — DATA-06)

Four exports:

- **`captureBaselineCounts(db)`** → reads `orgs` parent count + `collectionGroup` counts for each of the 6 subcollections; returns `Record<string, number>`. Used pre- and post-migration; the diff is the assertion.
- **`assertCollectionGroupCount(preCounts, postCounts)`** → pure pre/post diff. Throws on regression (`orgs` parent count must match exactly; subcollection counts must be `>=` pre).
- **`assertFieldPresence(db, sampleSize=20)`** → samples up to N docs in `responses` / `comments` / `messages` and verifies the D-03 inline legacy field is present on every sampled doc; throws with `{coll}: {missing}/{total} sampled docs missing inline legacy field '{field}' (D-03 invariant)`.
- **`summarise(counts)`** → pure log helper that pretty-prints a counts snapshot for the migration log.

#### Per-source-doc processor (`scripts/migrate-subcollections/process-doc.js` — D-02 / D-06 / Pitfall 8)

Single export `processDoc(deps, stepId, builderFn, sourceDoc)` taking dependencies by parameter (`{db, FieldValue, dryRun, logger?}`) so it can be unit-tested in isolation. State machine:

```
marker.get
  ├─ marker.exists && status='done'  → SKIP   (Pitfall 10 closure)
  ├─ DRY_RUN                         → log targets; return {dryRun: true, wouldWrite: N}
  └─ otherwise                       → PENDING marker
                                       → batch.set per target (flush at 499)
                                       → DONE marker (merge: true)
                                       → return {written: N}
```

`__BATCH_FLUSH_THRESHOLD = 499` is exported so a single test cell pins the value; any future change loud-fails CI.

#### Node entrypoint (`scripts/migrate-subcollections/run.js` — D-01 / D-04)

```bash
node scripts/migrate-subcollections/run.js [--dry-run] [--verify]
```

Initialises firebase-admin via `applicationDefault()` (D-04 ADC credentials; operator runs `gcloud auth application-default login` pre-invocation). Boots a `Firestore` instance scoped to project `bedeveloped-base-layers`. Pre-migration: `captureBaselineCounts` + log. For each of 6 STEPS: walk `orgs.docs`, call `processDoc` per org. Post-migration (only when not `--dry-run`): re-capture counts, run `assertCollectionGroupCount` + `assertFieldPresence`. Sets `process.exitCode = 1` on failure (CI-friendly).

`--verify` mode skips the migration loop and runs `assertFieldPresence` against current Firestore state — used as a post-cutover health check.

### Test scaffolding

- **`tests/scripts/migrate-subcollections/builders.test.js`** — 29 cells:
  - 6 builder describe-blocks (3-6 cells each: normal-shape, edge case, defaults, etc.)
  - 1 cross-cutting `describe("D-03 inline legacy fields invariant")` block iterating all 6 builders against a representative org and pinning the invariant
  - 1 `describe("Pitfall 4 closure")` block asserting the module exports exactly the 6 expected functions

- **`tests/scripts/migrate-subcollections/assertions.test.js`** — 18 cells:
  - `captureBaselineCounts` (2 cells: normal + defensive defaults)
  - `assertCollectionGroupCount` (6 cells: equality, growth, responses regression, orgs drift up, orgs drift down, missing key)
  - `assertFieldPresence` (6 cells: all-present, missing per coll x 3, sampleSize parameter, empty subcollection)
  - `summarise` (2 cells: multi-line content, empty input)

- **`tests/scripts/migrate-subcollections/idempotency.test.js`** — 10 cells:
  - PENDING→DONE flow (full journal sequence assertion)
  - SKIP when status='done' (builder NOT called)
  - RE-PROCESS when status='pending' (partial-run recovery)
  - --dry-run no-write closure (builder still called)
  - --dry-run + marker.done = SKIP (idempotency stable across modes)
  - `__BATCH_FLUSH_THRESHOLD === 499` pin
  - 600 targets → 2 commits (499 + 101)
  - 499 boundary → 1 commit + empty trailing batch
  - 0 targets → no commits + DONE marker still written
  - Marker path shape: `migrations/{stepId}/items/{sourceDoc.id}` verbatim

### Tooling

- **`package.json`** — added `firebase-admin@^13.8.0` to `devDependencies` (NEVER imported into `src/`); added `test:migrate` script: `vitest run tests/scripts/migrate-subcollections/`.
- **`eslint.config.js`** — extended the Node-globals languageOptions block from `tests/**/*.js` to `['tests/**/*.js', 'scripts/**/*.js']` so `process.exitCode` in `run.js` lints clean (Rule 3 fix; plan Task 2 Step 6 explicitly anticipated this).

## Verification Evidence

### `npm run test:migrate` (local)

```
 Test Files  3 passed (3)
      Tests  57 passed (57)
   Duration  1.31s
```

Per-file breakdown:
- `builders.test.js` — 29/29
- `assertions.test.js` — 18/18
- `idempotency.test.js` — 10/10

### `npm test` (full unit suite — no regression)

```
 Test Files  64 passed (64)
      Tests  433 passed (433)
   Duration  42.26s
```

Baseline before this plan: 376 passed (61 files). After Task 1: 423 (63 files; +47). After Task 2: 433 (64 files; +10). Total delta: +57 / +3 files / 0 regressions.

### Pitfall 4 verification (firebase-admin never in src/)

```
$ grep -rc "firebase-admin" src/
(empty — exit 1)

$ grep -c "from 'firebase-admin" scripts/migrate-subcollections/builders.js
0   (builders are pure)

$ grep -c "from 'firebase-admin" scripts/migrate-subcollections/assertions.js
0   (assertions take db by parameter)

$ grep -c "from \"firebase-admin/app\"" scripts/migrate-subcollections/run.js
1   (ESM sub-path import per Pitfall 4)

$ grep -c "from \"firebase-admin/firestore\"" scripts/migrate-subcollections/run.js
1
```

### Pitfall 8 verification (499-op batch ceiling)

```
$ grep -c "499" scripts/migrate-subcollections/process-doc.js
5   (BATCH_FLUSH_THRESHOLD declaration + comparison + named const re-export + comments)

# Pinned by test cell:
> processDoc — WriteBatch flushing (Pitfall 8) > commits at exactly 499 ops (the threshold value)
> processDoc — WriteBatch flushing (Pitfall 8) > 600 targets -> 2 commits (499 + 101)
> processDoc — WriteBatch flushing (Pitfall 8) > 499 targets -> exactly 1 commit (boundary case)
```

### D-02 idempotency marker verification

```
$ grep -c "migrations/.*items/" scripts/migrate-subcollections/process-doc.js
2   (template literal + JSDoc comment)

$ grep -c 'status: "pending"\|status: "done"' scripts/migrate-subcollections/process-doc.js
2   (PENDING write + DONE write)
```

### D-06 dry-run verification

```
$ grep -c "DRY_RUN\|--dry-run" scripts/migrate-subcollections/run.js
9   (CLI parse + log + branch around post-assertion harness + comments)

# Pinned by test cells:
> processDoc — idempotency markers > --dry-run: no marker writes; no batch writes; reads + builder still run
> processDoc — idempotency markers > --dry-run + marker.done: SKIP path still fires
```

### D-03 inline legacy field verification

```
$ grep -c "legacyAppUserId\|legacyAuthorId" scripts/migrate-subcollections/builders.js
12   (assignments + JSDoc + 6 builders covering both field names)

# Pinned by 6 cross-cutting test cells (one per builder).
```

### `applicationDefault` + ESM sub-path imports (Pattern 1)

```
$ grep -c "applicationDefault" scripts/migrate-subcollections/run.js
2   (import + usage)
```

### Lint cleanliness on this plan's new files

```
$ npx eslint scripts/migrate-subcollections/ tests/scripts/migrate-subcollections/
(no output — exit 0)
```

Repo-wide `npm run lint` reports 8 pre-existing errors in `tests/rules/**` (Plan 05-01 carry-forward); see `.planning/phases/05-.../deferred-items.md`. These are out-of-scope per the SCOPE BOUNDARY rule.

### Module load smoke tests (ESM contract)

```
$ node --input-type=module -e "import { processDoc, __BATCH_FLUSH_THRESHOLD } from './scripts/migrate-subcollections/process-doc.js'; console.log('processDoc:', typeof processDoc, '__BATCH_FLUSH_THRESHOLD:', __BATCH_FLUSH_THRESHOLD)"
processDoc: function __BATCH_FLUSH_THRESHOLD: 499

$ node --input-type=module -e "import { buildResponses } from './scripts/migrate-subcollections/builders.js'; console.log('buildResponses:', typeof buildResponses)"
buildResponses: function
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] ESLint `process` undef in run.js**

- **Found during:** Task 2 STEP 6 (running `npx eslint scripts/migrate-subcollections/`).
- **Issue:** ESLint 9+ flat-config in `eslint.config.js` declared Node globals (`process`, `Buffer`, `__dirname`, `__filename`) only for `files: ["tests/**/*.js"]`. The new `scripts/migrate-subcollections/run.js` uses `process.exitCode = 1` (the CI-friendly failure semantics required by the plan's `must_haves.truths` row "process.exitCode set to non-zero on assertion failure"), which surfaced as `'process' is not defined no-undef` lint error.
- **Fix:** Extended the Node-globals languageOptions block to include `scripts/**/*.js`:
  ```diff
  -    files: ["tests/**/*.js"],
  +    files: ["tests/**/*.js", "scripts/**/*.js"],
  ```
- **Files modified:** `eslint.config.js` (lines 122-134).
- **Commit:** `fd7cc7d` (folded into the Task 2 atomic commit).
- **Plan-anticipated:** YES — Plan Task 2 STEP 6 explicitly says "If lint fails... typical addition (only if needed): files: ['scripts/**/*.js', 'tests/**/*.js']". Followed verbatim.

### Authentication Gates

None. The unit suite (`npm run test:migrate`) executes purely against in-memory mocks; no Firestore emulator boot is required for Wave 2's deliverables. The `node scripts/migrate-subcollections/run.js` invocation against real Firestore is Wave 5's operator step (Plan 05-05+) and requires `gcloud auth application-default login` which is documented in the runbook (Wave 5).

## Threats Status

| Threat ID            | Disposition before | Disposition after | Evidence |
|----------------------|---------------------|--------------------|----------|
| T-5-01               | mitigate            | **mitigated**      | Pure builder functions in `builders.js` are unit-tested via 29 cells in `builders.test.js` covering shape correctness + edge cases + cross-cutting D-03 invariant. `--dry-run` short-circuit logged target paths/payload sizes BEFORE any write (verified by 2 test cells). Pre/post collectionGroup count + field-presence assertions run automatically post-migration. |
| T-5-02               | mitigate            | **mitigated**      | Per-doc idempotency markers at `migrations/{stepId}/items/{docId}` write PENDING before subcollection writes + DONE after; re-run finds PENDING → retries; finds DONE → skips. 3 dedicated test cells pin the state machine (fresh-doc, SKIP, RE-PROCESS). The Wave 5 pre-migration `gcloud firestore export` (D-04) is the catastrophic-loss rollback substrate; Phase 5 D-05 explicitly accepts this in lieu of a staging Firebase project. |
| T-5-mig-batch        | mitigate            | **mitigated**      | `__BATCH_FLUSH_THRESHOLD = 499` constant + named export + dedicated test cell pinning the value. Two test cells exercise the boundary (499 → 1 commit + empty trailing batch; 600 → 2 commits at 499+101 split). Future regressions away from 499 fail CI loudly. |
| T-5-mig-anonymous-uid| accept              | **accepted (substrate ready)** | D-03 inline legacy fields preserved verbatim by 6 builders; 6 cross-cutting test cells pin the invariant. Phase 6 (AUTH-15) backfill substrate in place; cleanup-ledger row queued ("Phase 6 deletes inline legacyAppUserId/legacyAuthorId after backfill"). |
| T-5-mig-admin-credentials | mitigate       | **mitigated**      | `applicationDefault()` ADC credential init in `run.js` (verified by acceptance grep returning 2 — import + usage). Operator runs `gcloud auth application-default login` pre-invocation per the Wave 5 runbook; credentials are session-scoped, not embedded in the script. |

## Known Stubs

None. The migration substrate is feature-complete for Wave 2 scope:

- All 6 builders cover their assigned source shapes and produce the target subcollection shape with D-03 inline legacy fields.
- `processDoc` covers all 4 marker states (no-marker / pending / done / dry-run-with-each-of-the-prior).
- `assertCollectionGroupCount` + `assertFieldPresence` cover the DATA-06 pre/post assertion contract.
- `run.js` wires every dependency through DI to `processDoc`.

The single deferred-but-intentional item is the **live Firestore execution** of `node run.js` — that is Wave 5's operator-supervised cutover and is explicitly out of scope for Wave 2. The Wave 5 runbook will reference this script.

## Threat Flags

None. The migration script introduces no new trust boundary beyond what `<threat_model>` enumerates. Operator-level Admin SDK credentials bypass Firestore Security Rules by design (D-01 audit-narrative line); rules-side accommodation is not required because the script writes the post-migration shape that Wave 1's already-committed-but-not-deployed rules accept. Phase 6 (RULES-07) deploys the rules in lockstep with the Auth + claims cutover.

## TDD Gate Compliance

This is a `type: execute` plan (not `type: tdd`), but each task's `tdd="true"` attribute meant we followed RED → GREEN inside each atomic boundary per D-10 strict tests-first:

- **Task 1 RED:** `tests/scripts/migrate-subcollections/builders.test.js` + `assertions.test.js` reference the modules that don't exist yet — initial state would error on import. The plan's atomic-commit pattern (per Phase 1 D-25) folds RED + GREEN into a single commit so the RED state isn't observable in git history; that's a documented atomic-wave pattern, not a TDD violation.
- **Task 1 GREEN:** Builders + assertions implementations land alongside the tests; `npm run test:migrate` exits 0 (47/47).
- **Task 2 RED:** `tests/scripts/migrate-subcollections/idempotency.test.js` references `processDoc` from `process-doc.js` — module doesn't exist yet.
- **Task 2 GREEN:** `process-doc.js` + `run.js` land alongside the tests; `npm run test:migrate` exits 0 (57/57).

Both tasks landed as atomic commits per Phase 1 D-25:
- `f8b7e9b feat(05-02): pure builders + assertion harness + unit tests`
- `fd7cc7d feat(05-02): migration script body + dry-run + idempotency markers`

Plan does not have a `type: tdd` frontmatter, so the plan-level TDD gate enforcement (RED test commit before feat commit) does not apply.

## Self-Check: PASSED

**Files created (verified via `test -f`):**
- FOUND: `scripts/migrate-subcollections/builders.js`
- FOUND: `scripts/migrate-subcollections/assertions.js`
- FOUND: `scripts/migrate-subcollections/process-doc.js`
- FOUND: `scripts/migrate-subcollections/run.js`
- FOUND: `tests/scripts/migrate-subcollections/builders.test.js`
- FOUND: `tests/scripts/migrate-subcollections/assertions.test.js`
- FOUND: `tests/scripts/migrate-subcollections/idempotency.test.js`
- FOUND: `.planning/phases/05-firestore-data-model-migration-rules-authoring-committed-not-deployed/deferred-items.md`

**Files modified (verified via `git log -p`):**
- FOUND: `package.json` (firebase-admin@^13.8.0 + test:migrate script)
- FOUND: `package-lock.json` (regenerated)
- FOUND: `eslint.config.js` (Node-globals extended to scripts/**)

**Commits (verified via `git log --oneline`):**
- FOUND: `f8b7e9b feat(05-02): pure builders + assertion harness + unit tests`
- FOUND: `fd7cc7d feat(05-02): migration script body + dry-run + idempotency markers`

**Acceptance criteria (must_haves.truths):**
- `scripts/migrate-subcollections/run.js` uses `firebase-admin/app` + `firebase-admin/firestore` ESM sub-path imports (verified by acceptance greps returning 1 each)
- Per-doc markers under `migrations/{stepId}/items/{docId}` written PENDING before subcollection writes; updated to DONE after batch.commit() succeeds (verified by 3 idempotency.test.js cells)
- 6 migration step ids: `responses-v1`, `comments-v1`, `actions-v1`, `documents-v1`, `messages-v1`, `readStates-init`
- Re-run with `marker.status==='done'` SKIPS the source doc (test cell: "marker.status === 'done': SKIPS the source doc; no writes fire")
- Re-run with `marker.status==='pending'` RE-PROCESSES (test cell: "marker.status === 'pending': RE-PROCESSES (partial-run recovery)")
- `--dry-run` short-circuits at the WRITE site (test cell: "--dry-run: no marker writes; no batch writes; reads + builder still run")
- WriteBatch flushes at 499 ops (test cell + `__BATCH_FLUSH_THRESHOLD` constant export)
- Every D-03 applicable target carries inline legacyAppUserId or legacyAuthorId (6 cross-cutting test cells in builders.test.js)
- Pre/post collectionGroup count assertions covered by `assertions.js` + 6 cells in `assertions.test.js`
- `firebase-admin@^13.8.0` in root devDependencies; NEVER imported into src/ (verified: `grep -rc "firebase-admin" src/ -> 0`)
- `npm run test:migrate` exits 0 (57/57 green)
- `package.json` has `test:migrate` script
- `process.exitCode = 1` on assertion failure (in `run.js` `main().catch(...)`)
- All 6 migration steps build correct subcollection paths (verified by per-builder test cells)

**Acceptance criteria (must_haves.artifacts + key_links):** All 7 artifact entries present and verified. All 4 key-link patterns verified (applicationDefault + builders import + migrations marker path + ESM sub-path imports).

## Hand-off

Wave 3 (Plan 05-03+) rewrites the 6 `src/data/*` pass-through wrappers to read/write the subcollection shape this Wave's builders produce. The wrappers' API surface stays stable (Phase 4 D-09 contract); only their internals change.

Wave 5 (Plan 05-05+) lands the operator runbook (`runbooks/phase5-subcollection-migration.md`) and executes the production migration:

```bash
# Pre-flight
gcloud auth application-default login
gcloud firestore export gs://bedeveloped-base-layers-backups/pre-phase5-migration/{ISO-timestamp}/

# Dry run (audit log)
node scripts/migrate-subcollections/run.js --dry-run > dry-run-output.log

# Real run
node scripts/migrate-subcollections/run.js

# Post-cutover health check
node scripts/migrate-subcollections/run.js --verify
```

The migration script is **immediately re-runnable**: if any step crashes, the next invocation finds the partially-written PENDING markers and re-processes; finds DONE markers and skips. Operators can iterate the dry-run any number of times without side effects (D-06 + Pitfall 5 closure).

Phase 6 (AUTH-15) consumes the inline `legacyAppUserId` / `legacyAuthorId` fields preserved on every applicable migrated doc to backfill the `legacyAppUserId → firebaseUid` mapping in-place; once the backfill completes, those fields are deleted (cleanup-ledger row queued).
