---
phase: 05-firestore-data-model-migration-rules-authoring-committed-not-deployed
plan: 05
subsystem: data-migration
tags:
  - phase-5
  - wave-5
  - data-01
  - data-02
  - data-04
  - data-05
  - data-06
  - migration-runbook
  - operator-deferred
  - rollback-substrate
  - dry-run
  - pitfall-10
  - pitfall-20
dependency-graph:
  requires:
    - 05-02 (scripts/migrate-subcollections/run.js + builders.js + assertions.js + process-doc.js - migration substrate)
    - 05-03 (data/* subcollection wrappers + new data/read-states.js - read-side substrate the runbook smoke-tests against)
    - 05-04 (H7 + H8 fixes - the dispatcher + server-time markers are read-path dependencies the post-migration smoke exercises)
  provides:
    - operator runbook for the live cutover (export -> dry-run -> real run -> verification -> rollback)
    - 05-PREFLIGHT.md skeleton for capturing the operator response + cutover log
    - dry-run-output.log placeholder for committed audit evidence post-rehearsal
  affects:
    - Phase 5 Wave 6 close-out (reads cutover_outcome from 05-PREFLIGHT.md to gate phase close)
    - Phase 6 RULES-07 + AUTH-15 (preconditions on cutover_outcome=success + populated legacy fields)
    - Phase 11 SECURITY.md DOC-10 (audit-narrative line cites the runbook + dry-run log + export bucket URI)
tech-stack:
  added: []
  patterns:
    - operator-deferred runbook authored as Wave 5 PR-time deliverable (mirrors Phase 3 hosting-cutover.md precedent)
    - PREFLIGHT skeleton with PENDING-USER markers (mirrors Phase 3 03-PREFLIGHT.md schema)
    - committed dry-run log as audit-friendly substitute for staging (D-06 + CONTEXT.md `<specifics>` 3rd bullet)
    - export-then-mutate-then-import rollback substrate (D-04)
    - per-doc idempotency markers documented as the partial-run-recovery substrate (D-02)
key-files:
  created:
    - runbooks/phase5-subcollection-migration.md
    - .planning/phases/05-firestore-data-model-migration-rules-authoring-committed-not-deployed/05-PREFLIGHT.md
    - scripts/migrate-subcollections/dry-run-output.log
  modified: []
decisions:
  - Runbook mirrors Phase 3 hosting-cutover.md structure but with 7 sections (Phase 3 has 6) - Phase 5 adds a dedicated Post-Migration Verification section because data mutations need a positive integrity assertion, not just "the new URL serves a 200"
  - dry-run-output.log force-added (`git add -f`) because *.log is gitignored - the committed placeholder keeps git history showing the file existed pre-rehearsal so the operator's overwrite-and-commit during runbook section 3.2 is the audit-evidence diff
  - Per-collection step ordering documented verbatim against scripts/migrate-subcollections/run.js STEPS constant (responses-v1 -> comments-v1 -> actions-v1 -> documents-v1 -> messages-v1 -> readStates-init) - leaves-first per Pitfall 10
  - PENDING-USER marker count = 40 in 05-PREFLIGHT.md (acceptance criterion >= 10) - markers cover pre-flight verifications + every cutover-log subblock (export + dry-run + real-run + post-verification + rollback fields)
  - Live execution intentionally NOT performed in this plan execution - the runbook IS the deliverable per Wave 5's operator-deferred nature; the parent orchestrator surfaces the human-action checkpoint after merge
metrics:
  completed_date: "2026-05-08"
  duration: "~15 minutes"
  tasks_completed: 1
  tasks_deferred: 1
  files_created: 3
  files_modified: 0
---

# Phase 5 Plan 05: Production Migration Runbook + 05-PREFLIGHT Skeleton + Dry-Run Log Placeholder Summary

Wave 5 PR-time deliverables for the production subcollection migration: a 7-section operator runbook (`runbooks/phase5-subcollection-migration.md`), a PENDING-USER-marker-rich PREFLIGHT skeleton (`05-PREFLIGHT.md`), and a force-added placeholder for the dry-run audit log (`scripts/migrate-subcollections/dry-run-output.log`). Live execution is operator-deferred per the plan's Wave 5 nature — the runbook IS the deliverable; the cutover happens when the operator runs the documented sequence with production credentials.

## Outcome

Wave 5's PR-time contract is met: every artefact a Phase 5 reviewer needs to evaluate the migration cutover plan exists, is committed, and cross-references the actual migration script the runbook drives (`scripts/migrate-subcollections/run.js` STEPS constant + the assertion harness + the per-doc idempotency markers under `migrations/{stepId}/items/{docId}`). The operator-execution checkpoint is surfaced as Task 2 in the plan and is OPERATOR-DEFERRED per the prompt — the parent orchestrator handles it after merge; this agent's job ends with the three artefacts committed.

## Commits

| # | Hash      | Title                                                                  | Files                                                                                                                                                                              |
|---|-----------|------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| A | `130a501` | docs(05-05): wave 5 production migration runbook + preflight skeleton  | runbooks/phase5-subcollection-migration.md, .planning/phases/05-firestore-data-model-migration-rules-authoring-committed-not-deployed/05-PREFLIGHT.md, scripts/migrate-subcollections/dry-run-output.log |

One atomic commit per Phase 1 D-25 atomic-commit pattern — the three deliverables form one coherent boundary (the Wave 5 cutover-day operator package).

## Runbook Structure

`runbooks/phase5-subcollection-migration.md` — 7 sections, each cited in the plan's `must_haves.truths` block:

1. **Prerequisites** — splits across "from the build pipeline" (Phase 5 Waves 1–4 green in CI; `npm run test:rules` / `test:migrate` / `test` pass; no premature `firebase deploy --only firestore:rules` per RULES-06), "from the local environment" (`firebase-admin@13.8.0`; `gcloud >= 470.0.0`; ADC token via `gcloud auth application-default login`; `roles/datastore.importExportAdmin` IAM grant; backup bucket `gs://bedeveloped-base-layers-backups/` exists), "from the production Firestore state" (no live writes; current parent-doc nested-map shape confirmed in Console), "cutover window" (~1h active work).
2. **Pre-cutover Smoke Checklist** — six checkboxes asserting the build + CI + RULES-06 invariants are satisfied.
3. **Cutover Steps** — four sub-sections:
   - **3.1** Pre-migration backup via `gcloud firestore export gs://bedeveloped-base-layers-backups/pre-phase5-migration/$ISO/` (D-04 verbatim) + `gcloud firestore operations describe ...` poll loop + `gsutil ls` metadata verification.
   - **3.2** Dry-run rehearsal via `node scripts/migrate-subcollections/run.js --dry-run 2>&1 | tee scripts/migrate-subcollections/dry-run-output.log` (D-06) + checklist for inspecting the log + `git commit -m "chore(05-05): capture pre-cutover dry-run log evidence"`.
   - **3.3** Real migration execution via `node scripts/migrate-subcollections/run.js 2>&1 | tee scripts/migrate-subcollections/real-run-output.log` + decision tree on assertion failure (re-run is idempotent vs roll back).
   - **3.4** Commit the real-run log.
4. **Post-Migration Verification** — Firebase Console subcollection visibility check; spot-check 3 migrated docs for D-03 inline legacy fields; `node scripts/migrate-subcollections/run.js --verify` exit code; dev-server smoke test (dashboard + org list + comments + unread badge).
5. **Rollback Procedure** — `gcloud firestore import gs://bedeveloped-base-layers-backups/pre-phase5-migration/$ISO/` (D-04 ROLLBACK substrate verbatim) + verification of restored shape + `migrations/{stepId}` marker cleanup note.
6. **Post-cutover cleanup (deferred to later phases)** — explicit downstream-phase commitments per CONTEXT.md D-21: AUTH-15 backfill (Phase 6), RULES-07 production deploy (Phase 6), FN-09 rate-limit predicate (Phase 7), FN-01..09 audit/softDelete writers (Phase 7), old-nested-map cleanup (Phase 6+ wave).
7. **Citations** — every CONTEXT.md decision (D-01..D-08, `<specifics>` 1st + 3rd, D-21), RESEARCH.md patterns (1, 2, 8), PITFALLS.md entries (5, 10, 20), ARCHITECTURE.md §4, the three migration script files, the Phase 3 runbook precedent, REQUIREMENTS.md DATA-01..06 + RULES-06, plus framework citations (OWASP ASVS L2 V14.7, ISO 27001:2022 A.5.7 + A.12.3.1, SOC 2 CC8.1, GDPR Art. 32(1)(b)).

## 05-PREFLIGHT.md Schema

Mirrors Phase 3 `03-PREFLIGHT.md ## Cutover Log` precedent. Two top-level blocks:

- **Pre-flight verifications** (7 PENDING-USER values for runbook §1 prerequisites: firestore_region, backup_bucket_exists, operator_iam, adc_token_works, firebase_admin_version, ci_phase5_waves_1_to_4_green, no_premature_rules_deploy).
- **Cutover Log** (33 PENDING-USER values across pre_migration_export, dry_run, real_migration, post_verification, rollback subblocks; final `cutover_outcome` field with values `success | rolled-back | partial-then-resumed`).

Total PENDING-USER count: 40 (acceptance criterion `>= 10`). Each marker is annotated with the verification command + expected output shape + the runbook section that produces it. Downstream-plan reading guide is appended (Wave 6, Phase 6, /gsd-verify-work 5, Phase 11 SECURITY.md/PRIVACY.md consumers).

## Dry-Run Log Placeholder

`scripts/migrate-subcollections/dry-run-output.log` — 5-line placeholder with header pointing at the generation command + operator + authored-as-placeholder date + `Date of live capture: PENDING-USER` line. Force-added to bypass the `*.log` gitignore (verified: `git status --ignored` showed `!! scripts/migrate-subcollections/dry-run-output.log` before `git add -f`).

The file's purpose is to make the operator's runbook §3.2 overwrite-and-commit cycle visible in git history: the diff between this placeholder and the populated log IS the audit evidence that the dry-run was executed pre-cutover.

## Operator-Execution Checkpoint Status

**DEFERRED to operator (parent orchestrator)** per the prompt's `<parallel_execution>` instruction:

> The actual operator-execution checkpoint (running the dry-run + real migration against production) is OPERATOR-DEFERRED per the plan's Wave 5 nature; the orchestrator will surface the operator-checkpoint markers in 05-PREFLIGHT.md after this agent returns.

The plan's Task 2 is `<task type="checkpoint:human-action" gate="blocking">` — Phase 5 Wave 5 cannot fully close until the operator runs the runbook end-to-end and fills every PENDING-USER value in `05-PREFLIGHT.md`. The Wave 6 verification gate (per CONTEXT.md D-08) is responsible for asserting `cutover_outcome != PENDING-USER` before phase close.

If the operator chooses to defer execution (e.g. quieter time slot needed), the runbook + skeleton + placeholder remain the Wave 5 PR-time deliverables; subsequent operator execution becomes a UAT-tracked item in `05-HUMAN-UAT.md` carrying into Phase 6's gate (per Phase 3 + Phase 4 precedent).

## Threat Model — Wave 5 Disposition

| Threat ID                 | Disposition | Status After Wave 5 PR-time Deliverables                                                                                                              |
|---------------------------|-------------|-------------------------------------------------------------------------------------------------------------------------------------------------------|
| T-5-w5-no-export          | mitigate    | Section 3.1 mandates the `gcloud firestore export` verbatim. Section 5 documents `gcloud firestore import` as the rollback procedure verbatim. Pre-flight (§1) verifies bucket existence + IAM + ADC. **Mitigation in place at PR-time; activated when operator follows the runbook.** |
| T-5-w5-no-dryrun          | mitigate    | Section 3.2 mandates the dry-run rehearsal + log commit. CONTEXT.md `<specifics>` 3rd bullet ("dry-run flag is the audit-friendly substitute for staging") is captured in §3.2 + §7 Citations. **Mitigation in place at PR-time.**                                              |
| T-5-w5-bypass-runbook     | mitigate    | Runbook is sequential markdown checklist; 05-PREFLIGHT.md captures 40 PENDING-USER markers that must be resolved before phase close; Wave 6 verification gate enforces "preflight markers all filled" per the Reading Guide section. **Mitigation in place at PR-time.**          |
| T-5-w5-partial-failure    | mitigate    | Section 3.3 documents the per-doc idempotency markers under `migrations/{stepId}/items/{docId}` (D-02 / Wave 2 substrate) + the (A) re-run + (B) rollback decision tree. The marker shape itself is the audit log of what completed. **Mitigation in place at PR-time.**         |
| T-5-w5-bucket-iam         | mitigate    | Pre-flight checklist (§1) verifies `gsutil ls gs://bedeveloped-base-layers-backups/` succeeds + `roles/datastore.importExportAdmin` IAM grant + ADC token. If any check fails, operator stops. **Mitigation in place at PR-time.**                                                |

All five threats from the plan's `<threat_model>` STRIDE register are addressed by the Wave 5 PR-time artefacts. None require live-execution evidence to call the threat "mitigated at the PR-time level" — the live execution will produce *additional* evidence (the populated PREFLIGHT.md + dry-run log + real-run log + commit SHAs), which Phase 11 SECURITY.md / PRIVACY.md DOC-10 consumes.

## Acceptance Criteria — Verification

All Task 1 acceptance criteria from `05-05-PLAN.md` verified post-commit:

| Criterion | Result |
|-----------|--------|
| `test -f runbooks/phase5-subcollection-migration.md` | exists (130a501) |
| `test -f .planning/phases/.../05-PREFLIGHT.md` | exists (130a501) |
| `test -f scripts/migrate-subcollections/dry-run-output.log` | exists, force-added past *.log gitignore (130a501) |
| `grep -c "## 1. Prerequisites"` (runbook) | 1 ✓ |
| `grep -c "## 2. Pre-cutover Smoke Checklist"` (runbook) | 1 ✓ |
| `grep -c "## 3. Cutover Steps"` (runbook) | 1 ✓ |
| `grep -c "## 5. Rollback Procedure"` (runbook) | 1 ✓ |
| `grep -c "## 7. Citations"` (runbook) | 1 ✓ |
| `grep -c "gcloud firestore export gs://bedeveloped-base-layers-backups/pre-phase5-migration/"` (runbook) | 1 (>= 1 required) ✓ |
| `grep -c "gcloud firestore import gs://bedeveloped-base-layers-backups/pre-phase5-migration/"` (runbook) | 1 (>= 1 required) ✓ |
| `grep -c "node scripts/migrate-subcollections/run.js --dry-run"` (runbook) | 1 (>= 1 required) ✓ |
| All 6 step ids (`responses-v1` … `readStates-init`) present in runbook | yes (each appears at least twice) ✓ |
| `grep -c "PENDING-USER"` (05-PREFLIGHT.md) | 40 (>= 10 required) ✓ |
| `grep -c "Cutover Log"` (05-PREFLIGHT.md) | 4 (>= 1 required) ✓ |

## Carryforward / Cleanup-Ledger Implications

No new cleanup-ledger rows are added by this plan — every downstream commitment captured in §6 of the runbook is already queued per CONTEXT.md D-21 (Phase 6 AUTH-15 legacy-field deletion + Phase 6 RULES-07 deploy + Phase 7 FN-09 rate-limit predicate + Phase 7 FN-01..09 audit/softDelete writers + Phase 6+ old-nested-map cleanup).

The runbook itself is the cutover-day source-of-truth artefact and stays in `runbooks/` indefinitely as a reference (Phase 3 + Phase 4 precedent — runbooks are not deleted post-cutover; they become the audit-narrative substrate for the relevant change-management evidence pack).

## Deviations from Plan

None — plan executed exactly as written. All three deliverables (runbook + 05-PREFLIGHT.md + dry-run-output.log placeholder) were authored per the `<interfaces>` skeletons in `05-05-PLAN.md`, with verbatim adaptation of the migration script's STEPS ordering + flag set + assertion harness contract.

One environment-specific note (not a plan deviation): when the Write tool initially wrote files using absolute Windows paths, the writes landed in the main repo working tree rather than the parallel-executor worktree. The files were copied into the worktree using `cp` and then committed there; the main-repo working tree retains the originals as untracked files (visible in `git status` from the main worktree but not staged on `main`). The worktree branch's commit (`130a501`) contains the canonical versions; merging the worktree branch to `main` will land the deliverables on `main` as expected. This was a tool-routing artefact, not a plan deviation.

## Self-Check: PASSED

**Files verified to exist on disk in the worktree:**

- `runbooks/phase5-subcollection-migration.md` — FOUND
- `.planning/phases/05-firestore-data-model-migration-rules-authoring-committed-not-deployed/05-PREFLIGHT.md` — FOUND
- `scripts/migrate-subcollections/dry-run-output.log` — FOUND (force-added past *.log gitignore)

**Commit verified to exist in worktree branch:**

- `130a501` — FOUND (`docs(05-05): wave 5 production migration runbook + preflight skeleton`)

**Acceptance-criteria greps:** all 14 acceptance criteria from `05-05-PLAN.md` Task 1 `<acceptance_criteria>` block return values meeting or exceeding the required thresholds (verified inline in §"Acceptance Criteria — Verification" above).
