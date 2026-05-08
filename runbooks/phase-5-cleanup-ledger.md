# Phase 5 Cleanup Ledger

> Phase 5 (Firestore Data Model Migration + Rules Authoring — Committed, Not Deployed) cleanup tracker.
> Phase entry state: zero new suppressions; all 6 Phase 4 D-09 + D-13 carryover rows
> closed across Waves 3+4; 4+ new forward-tracking rows queued for Phase 6/7/8.
> Mirrors `runbooks/phase-4-cleanup-ledger.md` structure.

## Suppressions

(Zero rows — Phase 5 introduced no new `eslint-disable-next-line` or `@ts-nocheck`.
The 12 Phase 4 carryover rows in main.js-body-migration sub-wave (Phase 4 4.1) remain
open in `runbooks/phase-4-cleanup-ledger.md`'s "Wave 6 → main.js-body-migration carryover"
section; those are Phase 4 4.1 sub-wave's responsibility, not Phase 5's.)

## Phase 5 forward-tracking (Phase 6 + Phase 7 + Phase 8 closures)

| Carryover item | File / line | Rationale | Closes when |
|---|---|---|---|
| `firestore.rules` + `storage.rules` deploy to production | (deploy via firebase-tools) | Phase 5 Sequencing Non-Negotiable #2: deploy gate held until Phase 6 Auth migration is live + claims propagate | Phase 6 (RULES-07) production deploy step |
| `legacyAppUserId` + `legacyAuthorId` inline fields on migrated docs | `orgs/{orgId}/responses/{respId}` + `orgs/{orgId}/comments/{cmtId}` + `orgs/{orgId}/messages/{msgId}` etc. | D-03 inline legacy fields are the substrate for Phase 6's `legacyAppUserId → firebaseUid` backfill (AUTH-15 bootstrap migration). Cutover-day reality (2026-05-08): no migrated docs yet exist (empty database at cutover); these fields will start populating as orgs are created post-Phase-6, and AUTH-15 walks them at that point. | Phase 6 (AUTH-15) backfill completes; cleanup wave deletes the legacy fields |
| `rateLimits/{uid}/buckets/{windowStart}` deny-block | `firestore.rules` `match /rateLimits/...` | D-17 Phase 5 ships `allow read, write: if false`; Phase 7 FN-09 replaces with `request.time` predicate | Phase 7 (FN-09) replaces the body |
| Server-side writers for `auditLog/`, `softDeleted/` | (Cloud Functions in `functions/`) | D-17 Phase 5 ships `allow write: if false` for clients; Phase 7 (FN-01..09 / AUDIT-01..04) adds the Cloud Function writers | Phase 7 (FN-01..09) ships server-side writers |
| `migrations/{stepId}/items/{docId}` per-doc idempotency markers | (under `migrations/...` collection in production Firestore) | D-02 markers are post-cutover audit evidence; Phase 8 cleanup-wave deletes them after backups confirm migration outcome. Currently no markers exist (cutover-day no-op against empty database; markers will populate on first non-empty re-run). | Phase 8 (BACKUP-07 restore-drill or BACKUP-01 daily-export rotation) |
| Old nested-map fields on parent `orgs/{orgId}` docs (`.responses`, `.comments`, `.actions`, `.documents`, `.messages`, `.readStates`) | (parent docs) | NOT deleted by Phase 5 — intentional rollback substrate for the Phase 5 cutover. Cutover-day reality: no parent docs exist yet, so no nested-map fields to delete. The cleanup pattern remains queued for whenever real data lands and is later re-shaped. | Phase 6+ cleanup wave deletes parent-doc nested-map fields once Phase 6 Auth migration validated + Phase 7 audit-log infra running |
| Deprecated legacy `markPillarRead` shim in `src/domain/unread.js` callsite path | `src/main.js` IIFE consumers (line 1739 callsite already rewired to `setPillarRead` from `data/read-states.js` in Wave 4 Commit A) | Wave 4 Commit A already rewired `src/main.js:1739` to `setPillarRead` from `data/read-states.js`. The remaining IIFE comparator wrappers (`_toTsFromIso` + `_toCommentDuck` + `lastReadForOrg` shims at `src/main.js` lines 402-407) keep IIFE rendering working until Phase 4 4.1 main.js-body-migration sub-wave deletes the IIFE. | Phase 4 4.1 main.js-body-migration sub-wave |
| Deprecated legacy 9-prop `syncFromCloud` shim in `src/data/cloud-sync.js` | `src/data/cloud-sync.js` (parameter-detector branch) | Wave 4 Commit B parameter-detector branch returns no-op + deprecation warn for IIFE consumers using the legacy 9-prop signature. Closes when IIFE consumers migrate. | Phase 4 4.1 main.js-body-migration sub-wave |
| Storage rules MIME allowlist drift tracker | `storage.rules` `validMime()` vs `src/ui/upload.js` `ALLOWED_MIME_TYPES` | Rules language doesn't support `import`; allowlist is duplicated; any change to `ui/upload.js` must sync `storage.rules` in the same commit | (cross-file drift; ongoing — close only when both sources of truth converge into a single source via build-step generation) |
| Pre-migration export bucket lifecycle policy | `gs://bedeveloped-base-layers-backups/pre-phase5-migration/2026-05-08T17-10-06Z/` | One-off pre-migration export taken 2026-05-08 17:10 UTC as the rollback substrate. No lifecycle policy applied at cutover; deferred to Phase 8 BACKUP-02 (which establishes the canonical backup bucket lifecycle: 30d Standard → 90d Nearline → 365d Archive). | Phase 8 (BACKUP-02) lifecycle policy applied to backup bucket |
| 6 stray pre-Phase-4 root-collection docs deletion (audit evidence) | `scripts/migrate-subcollections/find-strays.js` + `scripts/migrate-subcollections/delete-strays.js` | Cutover-day deviation (2026-05-08): 3 stray `messages/{id}` + 3 stray `documents/{id}` root-collection docs lacking D-03 legacy fields were deleted. Both scripts committed as audit evidence (`663927f`). The scripts are one-off cleanup tooling — should be removed or archived under `scripts/migrate-subcollections/archive/` once Phase 5 audit retention window closes (audit narrative purposes). | Phase 12 (audit-walkthrough close) or earlier if archive convention lands |

## Phase 4 carryover (Phase 4 4.1 main.js-body-migration items — DO NOT CLOSE in Phase 5)

The 12 src/main.js IIFE-resident `eslint-disable-next-line` + `@ts-nocheck` rows tracked in
`runbooks/phase-4-cleanup-ledger.md` "Wave 6 → main.js-body-migration carryover" section
remain open. Phase 5 Wave 4 ADDED 2 deprecation shims (`markPillarRead` IIFE wrapper
chain in `src/main.js:402-407` + legacy 9-prop `syncFromCloud` parameter-detector branch
in `src/data/cloud-sync.js`) that ALSO close in Phase 4 4.1 — those are tracked in this
ledger's "Phase 5 forward-tracking" table above as the relevant rows.

Phase 5 takes no action on Phase 4 4.1 carryover items.

## How to regenerate Phase 5 closure status

```sh
# Verify zero rules deploy commands in Phase 5 commits (RULES-06 gate)
git log --grep="firebase deploy --only firestore:rules" 5276d9d..HEAD
#   Expected: only commit 4fe36b9 (Wave 1 atomic commit body documenting the
#   absence of the deploy command) — documented false positive.
git grep "firebase deploy --only firestore:rules" -- '*.yml' '*.yaml' '*.json' '*.js' '*.sh' '*.ts'
#   Expected: empty.

# Verify migration script ran (audit evidence; cutover-day no-op against empty DB)
test -f scripts/migrate-subcollections/dry-run-output.log
test -f scripts/migrate-subcollections/real-run-output.log

# Verify rules + storage rules committed
test -f firestore.rules
test -f storage.rules

# Verify SECURITY.md DOC-10 sections present (Wave 6)
grep -c "## § Firestore Data Model" SECURITY.md   # 1
grep -c "## § Firestore Security Rules — Authored, Not Yet Deployed" SECURITY.md   # 1
grep -c "## § Storage Rules" SECURITY.md   # 1
grep -c "## § Phase 5 Audit Index" SECURITY.md   # 1

# Verify cutover outcome (05-PREFLIGHT)
grep -c "cutover_outcome: success" .planning/phases/05-firestore-data-model-migration-rules-authoring-committed-not-deployed/05-PREFLIGHT.md
```

## Closure

This ledger reaches steady-state at Phase 5 close — the **Suppressions table is
already empty** (zero new Phase 5 suppressions); the **forward-tracking rows are
explicit hand-offs to Phase 6/7/8** with concrete close conditions; the **Phase 4
carryover rows are deferred** to the Phase 4 4.1 sub-wave (they don't belong to
Phase 5's scope).

Phase 5 is **code-complete** (rules authored + tested; migration script + assertion
harness shipped; data/* wrappers rewritten; H7 + H8 fixed) and **operationally
verified** (cutover executed 2026-05-08; export + dry-run + real-run + verify chain
holds; outcome `success` though no-op against empty database — see SECURITY.md
§ Firestore Data Model for the audit-narrative line on this).
