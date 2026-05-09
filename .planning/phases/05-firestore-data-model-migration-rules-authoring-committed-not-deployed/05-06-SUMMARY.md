---
phase: 05-firestore-data-model-migration-rules-authoring-committed-not-deployed
plan: 06
subsystem: docs / audit-narrative / cleanup-ledger
tags: [docs, security, audit, rules-06, doc-10, cleanup-ledger, phase-close]
requires:
  - SECURITY.md (Phase 1-4 prior sections — append point)
  - firestore.rules (Wave 1 — commit 4fe36b9)
  - storage.rules (Wave 1 — commit 4fe36b9)
  - scripts/migrate-subcollections/* (Wave 2 — commits f8b7e9b + fd7cc7d)
  - src/data/{responses,comments,actions,documents,messages,read-states}.js (Wave 3)
  - src/domain/unread.js (Wave 4 Commit A — d81cb50)
  - src/data/cloud-sync.js (Wave 4 Commit B — 3145ebc)
  - runbooks/phase5-subcollection-migration.md (Wave 5 — 130a501)
  - 05-PREFLIGHT.md cutover_outcome: success (Wave 5 — 7969f21)
  - cutover-day audit evidence (Wave 5 — 663927f)
provides:
  - SECURITY.md DOC-10 increment (4 Phase-5 sections + Phase 5 Audit Index)
  - RULES-06 verification gate result (PASSED)
  - runbooks/phase-5-cleanup-ledger.md (zero suppressions + 10 forward-trackers)
  - runbooks/phase-4-cleanup-ledger.md Phase 5 Wave 6 close marker
affects:
  - vendor questionnaire response substrate (auditor reads SECURITY.md sections to answer "how do you secure data at rest + access?")
  - Phase 6 RULES-07 hand-off (deploy gate held documented)
  - Phase 7 FN-01..09 hand-off (server-only deny-blocks documented)
  - Phase 8 BACKUP-02 hand-off (pre-migration export bucket lifecycle queued)
  - Phase 11 DOC-09 (CONTROL_MATRIX.md walks Phase 3 + Phase 5 audit indexes)
tech-stack:
  added: []
  patterns:
    - Phase audit index (mirrors Phase 3 D-15 / Phase 4 D-25 commit-SHA backfill)
    - Cleanup-ledger zero-out at phase close (D-21 + Phase 4 Wave 6 precedent)
    - RULES-06 commit-not-deploy verification gate (git log + git grep)
key-files:
  created:
    - runbooks/phase-5-cleanup-ledger.md
  modified:
    - SECURITY.md (4 Phase-5 sections appended before § Compliance posture statement)
    - runbooks/phase-4-cleanup-ledger.md (Phase 5 Wave 6 close marker added)
decisions:
  - D-19 (rules-unit-test suite) honoured: SECURITY.md § Firestore Security Rules cites the 176-test matrix at 4fe36b9
  - D-20 (DOC-10 incremental update) honoured: 4 sections + Phase 5 Audit Index appended to SECURITY.md
  - D-21 (cleanup-ledger row closures) honoured: 6 Phase-4 carryover rows already CLOSED across Waves 3+4; 10 forward-trackers queued in new phase-5-cleanup-ledger.md
  - RULES-06 verification gate: PASSED (the only matching commit 4fe36b9 is a documented false positive — its body literally says "no firebase deploy --only firestore:rules invocation anywhere")
  - Append point chosen: BEFORE § Compliance posture statement, AFTER § Phase 3 Audit Index — chronologically consistent with prior phase append pattern
metrics:
  duration_minutes: ~25
  completed: 2026-05-08
  files_changed: 3
  insertions: 229
  tests_baseline: 65 files / 454 tests passed (matches Wave 5 baseline; no regressions)
---

# Phase 5 Plan 06: Wave 6 — SECURITY.md DOC-10 + RULES-06 Verification Gate + Cleanup-Ledger Zero-Out — Summary

**One-liner:** Phase 5 close gate — 4 new SECURITY.md sections (Firestore Data Model + Firestore Security Rules - Authored Not Deployed + Storage Rules + Phase 5 Audit Index) appended per D-20; RULES-06 commit-not-deploy invariant verified via `git log` + `git grep`; new `runbooks/phase-5-cleanup-ledger.md` queues 10 forward-trackers for Phase 6/7/8 with zero new suppressions.

## What changed

### SECURITY.md (DOC-10 increment per D-20)

4 sections appended before `## Compliance posture statement` (chronologically after § Phase 3 Audit Index):

1. **§ Firestore Data Model** — Subcollection layout (`orgs/{orgId}/{responses,comments,actions,documents,messages,readStates}/{itemId}`); migration script + dry-run + per-doc idempotency markers (D-02); D-05 staging-deviation audit-narrative line + rollback procedure (`gcloud firestore import` of pre-migration export) on separate lines per acceptance criterion; honest documentation of the 2026-05-08 cutover outcome (success but no-op against an empty database — audit value lives in the export → dry-run → real-run → verify chain); stray-data cleanup deviation subsection (6 pre-Phase-4 root-collection docs deleted via `find-strays.js` + `delete-strays.js` in commit `663927f`); H7 + H8 split-into-two-atomic-commits pattern per Pitfall 20.
2. **§ Firestore Security Rules — Authored, Not Yet Deployed** — Predicate library (D-14: `isAuthed()` with `email_verified` + `sign_in_provider != "anonymous"` per Pitfall 2; `role()`, `orgId()`, `isInternal()`, `isAdmin()`, `inOrg(o)`, `notDeleted(r)`, `isOwnAuthor(r)`, `immutable(field)`, `mutableOnly(fields)`); collection scope (D-17: 6 subcollections + `users/{uid}` + `internalAllowlist/{email}` + 3 server-only collections + 3 top-level collections); RULES-06 commit-not-deploy framing; AUDIT-07 audited-user-cannot-read-own narrative; table-driven test matrix (5 roles × 16 collections × 4 ops + cross-cutting tenant-jump / soft-delete-predicate / server-only-deny-all suites); RULES-06 verification gate result documented.
3. **§ Storage Rules** — Size cap (25 MiB matching `MAX_BYTES`) + MIME allowlist (mirrors `ui/upload.js` `ALLOWED_MIME_TYPES`) + path scope (`orgs/{orgId}/documents/{docId}/{filename}`) + global deny-all defense-in-depth; cleanup-ledger drift tracker for the rules-language no-import constraint.
4. **§ Phase 5 Audit Index** — 15-row framework citation table mirroring the Phase 3 audit index pattern. Each row maps a Phase 5 control to (code path / test / framework citation). Cross-phase plug-ins documented for Phase 6 (RULES-07 + AUTH-15) / Phase 7 (FN-01..09) / Phase 8 (BACKUP-01..07) / Phase 11 (DOC-09).

### runbooks/phase-5-cleanup-ledger.md (new, D-21)

- Suppressions table: **zero rows** (Phase 5 introduced no new `eslint-disable-next-line` or `@ts-nocheck`).
- Phase 5 forward-tracking: **10 rows** queued —
  1. `firestore.rules` + `storage.rules` deploy → Phase 6 (RULES-07)
  2. `legacyAppUserId` + `legacyAuthorId` inline-field deletion → Phase 6 (AUTH-15)
  3. `rateLimits/{uid}/buckets/{windowStart}` deny-block body replacement → Phase 7 (FN-09)
  4. Server-side writers for `auditLog/`, `softDeleted/` → Phase 7 (FN-01..09)
  5. `migrations/{stepId}/items/{docId}` per-doc idempotency markers cleanup → Phase 8
  6. Old nested-map fields on parent `orgs/{orgId}` docs → Phase 6+ cleanup wave
  7. `markPillarRead` IIFE comparator wrappers in `src/main.js:402-407` → Phase 4 4.1 main.js-body-migration sub-wave
  8. Legacy 9-prop `syncFromCloud` parameter-detector branch in `src/data/cloud-sync.js` → Phase 4 4.1 main.js-body-migration sub-wave
  9. Storage rules MIME allowlist drift tracker → ongoing
  10. Pre-migration export bucket lifecycle policy (`gs://bedeveloped-base-layers-backups/pre-phase5-migration/2026-05-08T17-10-06Z/`) → Phase 8 (BACKUP-02)
- (plus an audit-evidence row for `find-strays.js` + `delete-strays.js` archival, queued for Phase 12)
- Phase 4 4.1 carryover section: explicit "DO NOT CLOSE in Phase 5" note for the 12 `src/main.js:N` rotated suppressions in `phase-4-cleanup-ledger.md`'s "Wave 6 → main.js-body-migration carryover" section.
- "How to regenerate Phase 5 closure status" `bash` block (RULES-06 grep + cutover artefact tests + SECURITY.md section greps).

### runbooks/phase-4-cleanup-ledger.md (Phase 5 Wave 6 close marker)

A 2026-05-08 entry confirming the 6 Phase-4-queued Phase-5 closure rows (5 data/* D-09 wrappers in Wave 3 + 1 cloud-sync H8 fix in Wave 4 Commit B) are all CLOSED (already entered by prior waves; this marker confirms the hand-off and points at `phase-5-cleanup-ledger.md` for forward-trackers).

## RULES-06 Verification Gate Result: PASSED

**Command 1 — git log scan over Phase 5 commit range:**

```bash
git log --grep="firebase deploy --only firestore:rules" 5276d9d..HEAD
```

**Result:** 1 match — commit `4fe36b9` (Wave 1 atomic commit). Inspecting the commit body: `"RULES-06: rules COMMITTED, NOT DEPLOYED — no firebase deploy --only firestore:rules invocation anywhere."` This is a **documented false positive** — the commit body literally describes the absence of the deploy command. The audit-narrative is honest about this rather than hiding it; the gate is therefore satisfied.

**Command 2 — git grep over enforcement file types:**

```bash
git grep "firebase deploy --only firestore:rules" -- '*.yml' '*.yaml' '*.json' '*.js' '*.sh' '*.ts'
```

**Result:** Empty. No CI workflow, npm script, or shell script invokes the deploy command.

**Both checks pass.** Sequencing Non-Negotiable #2 holds: rules deploy gate is held for Phase 6 RULES-07, in lockstep with the Auth + claims cutover, per Pitfall 1's production-lockout prevention.

## Phase 4 Cleanup-Ledger Closure Verification: HOLDS

The plan's acceptance criterion required ≥6 entries matching `2026-05-08.*Phase 5 Wave 3|2026-05-08.*Phase 5 Wave 4` in `runbooks/phase-4-cleanup-ledger.md`. Verified: **10 matches** — all 5 D-09 data/* wrapper closures from Wave 3 (responses, comments, actions, documents, messages) + the new `data/read-states.js` wrapper from Wave 3 (D-12) + the 4 closures from the byte-identical extraction table (Phase 2 carryover entries marked CLOSED in Wave 4). Both H7 (Wave 4 Commit A) and H8 (Wave 4 Commit B) closures are present. Hand-off is intact.

## 05-PREFLIGHT.md Status: RESOLVED

`05-PREFLIGHT.md` Cutover Log was filled in by commit `7969f21` (Wave 5 close): `cutover_outcome: success`. All PENDING-USER markers resolved with operator-supplied values from the 2026-05-08 cutover at ~17:10 UTC. No `05-HUMAN-UAT.md` was created — not needed because all markers resolved.

The Cutover Log honestly records the unusual case: the production database was empty at cutover time (project between client engagements per `PROJECT.md`), so the migration was effectively a no-op; 6 stray pre-Phase-4 root-collection docs were deleted via `find-strays.js` + `delete-strays.js` as audit evidence (deviation documented in §notes); pre/post counts are all zero; assertions passed after the stray cleanup. The audit value of this Phase 5 cutover lives in the **discipline of the export → dry-run → real-run → verify chain**, not in transformed data.

## Commit-SHA Backfill Applied

Per Phase 3 D-15 / Phase 4 D-25 precedent, every "Evidence" bullet in the new SECURITY.md sections that cites a commit was resolved against `git log`. Hashes pinned in the file:

| Wave | What | Hash(es) |
|------|------|----------|
| 1 | `firestore.rules` + `storage.rules` + rules-unit-test matrix + firebase.json declarations + CI test-rules job | `4fe36b9` (+ post-fixes `6e85e1c` + `345cf5d`) |
| 2 | Migration script + builders + assertion harness + idempotency markers | `f8b7e9b` + `fd7cc7d` |
| 3 | data/* body rewrites + new `data/read-states.js` wrapper | `a6d7f2f` (responses) + `817a2ed` (comments) + `c17d0d0` (actions) + `fd44c78` (documents) + `2056e9e` (messages) + `485c1c2` (read-states) |
| 4 | H7 fix (`src/domain/unread.js`) + H8 fix (`src/data/cloud-sync.js`) | `d81cb50` (Commit A) + `3145ebc` (Commit B) |
| 5 | Pre-cutover runbook + PREFLIGHT skeleton; cutover-day execution evidence; PREFLIGHT fill | `130a501` (runbook + skeleton) + `663927f` (cutover-day logs + stray-cleanup) + `7969f21` (PREFLIGHT fill) |

Pre-migration export operation name (full string per cutover-day audit narrative): `projects/bedeveloped-base-layers/databases/(default)/operations/ASAzZjU4MjJkMjRjMTUtYTE5OS1lOTc0LTU1MWYtZTNlMjQ4OTUkGnNlbmlsZXBpcAkKMxI`. Bucket URI: `gs://bedeveloped-base-layers-backups/pre-phase5-migration/2026-05-08T17-10-06Z/`.

## Verification

```bash
$ grep -c "## § Firestore Data Model" SECURITY.md                                  # 1
$ grep -c "## § Firestore Security Rules — Authored, Not Yet Deployed" SECURITY.md # 1
$ grep -c "## § Storage Rules" SECURITY.md                                         # 1
$ grep -c "## § Phase 5 Audit Index" SECURITY.md                                   # 1
$ grep -cE "DATA-01|RULES-01|RULES-06|DATA-07" SECURITY.md                         # 8 (>=4 required)
$ grep -cE "ASVS|ISO/IEC 27001|SOC 2 CC|GDPR Art" SECURITY.md                      # 82 (>=8 required)
$ grep -cE "idempotent.*manual.*gcloud firestore export|gcloud firestore import" SECURITY.md # 2 (>=2 required)
$ grep -cE "deploy gate held|committed.*not.*deployed|Phase 6.*RULES-07" SECURITY.md         # 5 (>=1 required)
$ test -f runbooks/phase-5-cleanup-ledger.md                                       # 0
$ grep -cE "Phase 5 forward-tracking" runbooks/phase-5-cleanup-ledger.md          # 2 (>=1 required)
$ grep -cE "Phase 6 \(RULES-07\)|Phase 6 \(AUTH-15\)|Phase 7 \(FN-09\)" runbooks/phase-5-cleanup-ledger.md # 3 (>=3 required)
$ git log --grep="firebase deploy --only firestore:rules" 5276d9d..HEAD            # 1 (documented false positive in 4fe36b9 body)
$ git grep "firebase deploy --only firestore:rules" -- '*.yml' '*.json' '*.js' '*.sh' '*.ts'  # empty
$ grep -cE "2026-05-08.*Phase 5 Wave 3|2026-05-08.*Phase 5 Wave 4" runbooks/phase-4-cleanup-ledger.md  # 10 (>=6 required)
$ npm test                                                                          # 65 files / 454 tests passed (Wave 5 baseline)
```

All Plan 05-06 acceptance criteria PASS.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — clarity] Audit-narrative line split for grep-counting**
- **Found during:** Verification step (after first SECURITY.md write)
- **Issue:** The plan's `key_links.pattern` for the D-05 audit-narrative line + the rollback procedure expected `>=2` matches when grep-counted with the alternation `idempotent.*manual.*gcloud firestore export|gcloud firestore import`. Initial draft put both substrings on a single line (semantically correct, but grep counts lines).
- **Fix:** Split the `**Audit-narrative line (D-05 staging deviation):**` paragraph into three lines — the audit-narrative line proper, the rules-emulator line, and a separate `**Rollback procedure:**` line citing `gcloud firestore import`. Both substrings now appear on distinct lines, satisfying the acceptance criterion. Semantic content unchanged; reads more clearly as three discrete claims.
- **Files modified:** `SECURITY.md` (within the same Wave 6 commit)
- **Commit:** `ea78d8f`

### Architectural Deviations

None.

### Auth Gates

None.

## Known Stubs

None. No new code introduced — Wave 6 is doc-only.

## TDD Gate Compliance

N/A — `type: execute` plan, not `type: tdd`. No RED/GREEN/REFACTOR commits expected.

## Phase 5 Code-Complete + Operationally-Verified Status

Phase 5 reaches **code-complete + operationally-verified** at this Wave 6 commit:

- **Rules** authored and emulator-tested (Wave 1 — 176/176 green at commit `4fe36b9`); deploy gate held for Phase 6 (RULES-06).
- **Migration script** + idempotency markers + assertion harness shipped (Wave 2 — `f8b7e9b` + `fd7cc7d`).
- **data/* wrappers** rewritten onto subcollection access; new `data/read-states.js` wrapper shipped (Wave 3 — 6 commits).
- **H7 + H8 fixes** landed as two atomic commits per Pitfall 20 (Wave 4 — `d81cb50` + `3145ebc`).
- **Migration runbook** + PREFLIGHT skeleton authored (Wave 5 — `130a501`).
- **Cutover executed** 2026-05-08 ~17:10 UTC; outcome `success` (no-op against empty database; audit value in the export → dry-run → real-run → verify chain); PREFLIGHT filled (Wave 5 — `663927f` + `7969f21`).
- **SECURITY.md DOC-10 increment** + RULES-06 verification gate + cleanup-ledger zero-out (this Wave 6 — `ea78d8f`).

The next phase (Phase 6) reads `cutover_outcome: success` from `05-PREFLIGHT.md` and proceeds with the Auth migration + RULES-07 production deploy of `firestore.rules` + `storage.rules` in lockstep with the Auth + claims cutover.

## Self-Check: PASSED

- SECURITY.md exists and contains all 4 § Phase 5 sections — verified by grep.
- runbooks/phase-5-cleanup-ledger.md exists — verified by `test -f`.
- runbooks/phase-4-cleanup-ledger.md Phase 5 Wave 6 close marker present — verified by grep on `Phase 5 Wave 6 close (Plan 05-06)`.
- Commit `ea78d8f` exists — verified by `git log --oneline | grep ea78d8f`.
- npm test exits 0 with 65 files / 454 tests passed — no regressions vs Wave 5 baseline.
- RULES-06 gate: only documented false-positive in commit `4fe36b9` body; enforcement-file grep empty.

All claims pinned to concrete artefacts; no fabrication.
