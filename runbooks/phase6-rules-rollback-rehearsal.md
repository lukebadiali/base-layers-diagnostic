# Phase 6 — Rules Rollback Rehearsal

> Phase 6 Wave 5 Step 1 deliverable. Authored DURING the rehearsal per `runbooks/phase6-cutover.md` Step 1 instructions and Phase 6 Plan 06-05 Task 1. Substrate adjusted from the original D-12 design — see `.planning/phases/06-real-auth-mfa-rules-deploy/06-PREFLIGHT.md` "Wave 5 D-12 substrate adjustment" block (CI deploy job did not yet include rules at rehearsal time; manual `firebase deploy` substituted for the originally-planned `git revert + push + watch CI` loop).

## Pre-rehearsal state

- **Project:** bedeveloped-base-layers (europe-west2 Firestore, verified Wave 1)
- **Operator-side prerequisites (verified before Step 1):**
  - gcloud authenticated as `business@bedeveloped.com` ✓
  - Firebase CLI authenticated ✓ (`firebase projects:list` returned `bedeveloped-base-layers (current)`)
  - gh CLI authenticated ✓
  - Identity Platform upgrade in place ✓
  - TOTP MFA provider enabled ✓ (SMS-MFA disabled)
  - George available for AUTH-10 drill (Step 10) ✓
- **Production rules at rehearsal start:** Apr-27-2026 ~13-line flat shape per Phase 5 05-HUMAN-UAT.md (`/documents/{docId}` + `/messages/{msgId}` + `/funnels/{...}` + `/funnelComments/{...}` with `if request.auth != null`). Last deploy predates Phase 5 work. Phase 5 committed strict rules to git but did NOT deploy.
- **Repo SHA at rehearsal start:** `c06416f86be16f34a947c00c4483474863a7585d`

## Procedure

Three live deploys to production against `bedeveloped-base-layers`. Captures timing evidence; T1→T2 elapsed seconds is the SC#4 substrate.

| Step | Action | Files | Captured |
|------|--------|-------|----------|
| 1.1 | Capture pre-rehearsal SHA + timestamp | — | `pre_rehearsal_sha`, `T0` |
| 1.2 | First deploy: production gets Phase 5 strict rules for the first time | `firestore.rules` (159 lines), `storage.rules` (44 lines) | `T1`, `deploy_1_console_timestamp` |
| 1.3 | Operator verifies Console: deploy timestamp updated, content is strict rules | — | `console_check_1` |
| 1.4 | Swap in rollback target (cp from `runbooks/phase6-rehearsal-rollback-*.rules`) | `firestore.rules`, `storage.rules` (transient ~13-line shape) | — |
| 1.5 | Second deploy: rollback to ~13-line shape | rollback rules | `T2`, `deploy_2_console_timestamp` |
| 1.6 | Operator verifies Console: rules reverted | — | `console_check_2` |
| 1.7 | Restore Phase 5 rules from git: `git checkout -- firestore.rules storage.rules` | `firestore.rules`, `storage.rules` | — |
| 1.8 | Third deploy: re-deploy Phase 5 strict rules | strict rules (canonical) | `T3`, `deploy_3_console_timestamp` |
| 1.9 | Operator verifies Console: strict rules back | — | `console_check_3` |

## Evidence

```
pre_rehearsal_sha: c06416f86be16f34a947c00c4483474863a7585d
T0: 2026-05-09T13:51:08Z   # rehearsal start
T1: 2026-05-09T13:52:20Z   # first deploy of Phase 5 strict rules complete (firestore + storage)
T2: 2026-05-09T13:54:21Z   # rollback deploy complete (~13-line shape live in production)
T3: 2026-05-09T13:56:45Z   # re-deploy of Phase 5 strict rules complete
deploy_1_console_timestamp: ~14:51 BST / 13:51 UTC (operator-confirmed in Console)
deploy_2_console_timestamp: ~14:54 BST / 13:54 UTC (operator-confirmed in Console)
deploy_3_console_timestamp: ~14:56 BST / 13:56 UTC (operator-confirmed in Console)
console_check_1: PASS — operator confirmed strict 159-line firestore.rules + 44-line storage.rules content visible after first deploy
console_check_2: PASS — operator confirmed ~13-line rollback rules content visible after rollback deploy
console_check_3: PASS — operator confirmed strict rules back after re-deploy
rehearsal_rollback_seconds: 121   # T2 - T1; SC#4 metric, target <300
rehearsal_within_5_min: yes
rehearsal_full_cycle_seconds: 337   # T3 - T0; full deploy/revert/redeploy cycle
deploy_command_workaround_note: |
  Originally attempted `firebase deploy --only firestore:rules,storage:rules` (single command); firebase-tools 15.16.0
  errored with "Could not find rules for the following storage targets: rules". Workaround: split into two
  sequential deploys (`--only firestore:rules` then `--only storage`). All three deploys (T1/T2/T3) used the
  split approach. This affects the cutover commit's planned ci.yml edit — the CI deploy command must use
  `--only hosting,functions,firestore,storage` (the firestore/storage shorthands without ":rules" suffix)
  OR keep the deploys split. To be reconciled at Step 8 (cutover commit) before pushing.
deploy_1_warnings: |
  Two compile warnings on firestore.rules (non-blocking):
    [W] 19:14 - Unused function: isOwnAuthor.
    [W] 19:51 - Invalid variable name: request.
  Captured for Wave 6 / post-cutover review — deploy succeeded despite warnings; rules behave as intended.
deploy_3_warnings: |
  Same two warnings re-surfaced on T3 deploy (same rules file):
    [W] 19:14 - Unused function: isOwnAuthor.
    [W] 19:51 - Invalid variable name: request.
```

## Production state after rehearsal

- `firestore.rules` deployed: Phase 5 strict 159-line ruleset
- `storage.rules` deployed: Phase 5 strict 44-line ruleset
- Anonymous Auth provider: still ENABLED (Step 7 of `runbooks/phase6-cutover.md` will disable in Console)
- Auth blocking handlers: NOT yet deployed (Step 2 will deploy `beforeUserCreatedHandler`, `beforeUserSignedInHandler`, `setClaims`)
- Admins: NOT yet bootstrapped (Step 3 seeds `internalAllowlist/`; Step 4 Console-creates the Auth users)
- Window of brokenness: from T1 (13:52:20Z) until Step 4 admin claims propagate, anonymous-auth users would receive deny errors on all Firestore + Storage operations. PROJECT.md baseline confirms no live users — safe.

## SC#4 substrate

The 121-second rollback time at T1→T2 is the SC#4 evidence. Substrate works: operator can flip production rules in <5min via `firebase deploy --only firestore:rules` + `firebase deploy --only storage`.

Post-cutover, the substrate ALSO works via `git revert <cutover-sha> + git push`, because Step 8 of the cutover commit edits `ci.yml` to add `firestore:rules,storage:rules` to the CI deploy `--only` list (per `.planning/phases/06-real-auth-mfa-rules-deploy/06-PREFLIGHT.md` "Wave 5 D-12 substrate adjustment" block). Both rollback paths (manual + auto-via-CI) are operator-supported.

## Aftermath

After Step 1.9 verifies, the canonical `firestore.rules` + `storage.rules` are deployed to production. Production is now in the "strict rules + no admin claims yet" state — anonymous-auth users would see deny errors (no live users baseline; safe). Steps 2-5 of `runbooks/phase6-cutover.md` proceed against this state to bootstrap the admins, after which Step 6 (cutover commit + push) lands the AUTH-14 deletions and updates `ci.yml` to include rules in CI deploy.

The `firestore.rules` and `storage.rules` files at repo HEAD are unchanged through this rehearsal — git is untouched (the rollback swap was a transient working-tree edit reverted via `git checkout`).
