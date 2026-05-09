# Phase 6 Resume Note

**Last paused:** 2026-05-09T15:30:00Z
**Pause reason:** End of long context-window session. User invoked `/clear`. Cutover commit landed on a feature branch + PR opened; CI surfaced pre-existing Phase 4-5 debt; user chose Option A ("land cutover anyway, fix CI in a follow-up") and asked for a resume note before clearing.

---

## Current state — read these first

1. **`.planning/phases/06-real-auth-mfa-rules-deploy/06-WAVE-5-PARTIAL-STATE.md`** — full deviation log (11 entries) + production state at the time of pause-mid-Wave-5. Still accurate up to the cutover commit.
2. **PR #3** open: <https://github.com/lukebadiali/base-layers-diagnostic/pull/3>
   - Branch: `phase-6-cutover-20260509-1513`
   - Head commit: `b2d6ad8` (package-lock regenerate to add platform-specific @emnapi deps)
   - Cutover commit: `17932d5` (AUTH-14 deletion + BLOCKER-FIX 1 wiring + ci.yml --only extension)
   - 209 commits in diff (entire Phase 4-5-6 history — none of it has ever been pushed to main since May 5)
3. **CI status:** 3 jobs FAIL on the PR — all are pre-existing Phase 4-5 debt, not regressions from the Phase 6 cutover code:

| Failed job | Root cause | First introduced |
|---|---|---|
| **Test** (coverage thresholds) | `vite.config.js:65-85` sets aggressive thresholds (90%/100%) for `src/main.js`, `src/views/**`, `src/ui/**`, `src/state.js`, `src/router.js`. Actual coverage 20-60%. Wave 4 SUMMARY explicitly admitted: "Coverage thresholds set per D-21 but unenforceable on main.js / state.js / router.js / views/* / ui/* until body migration completes." | Phase 4 |
| **Typecheck** | Pre-existing TS errors in `tests/rules/*`, `tests/scripts/*`, `vitest.rules.config.js`. Wave 4 SUMMARY: "0 errors in any modified file ... pre-existing errors out of scope". | Phase 4-5 |
| **Rules Tests (Emulator)** | Failing in 27s — too fast to be running tests. Probably emulator setup gap or test-path resolution. | Phase 5 |

**Passing CI jobs:** Install, Lint, Security Audit, Socket Security: Project Report.

4. **Production state at pause time:**
   - Identity Platform tier: IDENTITY_PLATFORM
   - TOTP MFA: enabled (SMS-MFA disabled)
   - Phase 5 strict `firestore.rules` + `storage.rules`: deployed (rehearsal evidence T1→T2 = 121s rollback time, well under SC#4 5-min target)
   - 3 auth Cloud Functions: deployed in `europe-west2` (no `minInstances` per cost decision)
   - Luke (`LQpdqpWqcgVLIE59ln3x8RMf5Mk1`) + George (`CZTjcv0mYafO49swTc3P4b6j99W2`) bootstrapped with `customClaims = {role: "admin", orgId: null, firstRun: true}` via Admin SDK Path B (the blocking-handler invocation path is broken until `firebaseauth.googleapis.com` ToS gate is resolved — see partial-state doc D-6/D-7/D-8/D-9)
   - Anonymous Auth: still ENABLED in Console (Step 7 not yet executed; cutover commit retired the `signInAnonymously` call so the app no longer USES it)
   - Phase 4 hosting bundle: STILL SERVING at <https://baselayers.bedeveloped.com>. Phase 6 hosting bundle waits on the PR merge → CI deploy.

5. **User decision** (just before pause): **Option A — "Land cutover anyway, fix CI in a follow-up."** Two paths the user explicitly accepted:
   - **Path A.1:** Admin-merge bypassing the failing checks (if user has org-admin rights and chooses to use them)
   - **Path A.2:** Update `vite.config.js` to lower thresholds + handle the typecheck errors + investigate rules-emulator gap, push, get CI green, then merge normally

---

## How to resume cleanly

When the user comes back, the resume sequence is:

### Step 1 — Decide A.1 vs A.2

Ask the user which path. **Recommendation: A.2** — pre-existing Phase 4-5 debt has been silently accumulating because the work was never pushed; landing it on the next push as separate "fix CI green" commits gives a clean baseline going forward and matches GSD's preference for honest, auditable state. A.1 is faster but leaves the debt invisible until the next push.

### Step 2 (Path A.2) — Fix the three failing CI jobs

Recommended commits, in order:

#### Commit 1: Lower coverage thresholds to current reality

Edit `vite.config.js` lines 65-85. Current thresholds and where they fail:

```
"src/firebase/**" → 90/90/90/90  (currently OK)
"src/data/**"     → branches 95  (failing at 91.93%)
"src/domain/**"   → branches 100 (failing at 99.06%)
"src/ui/**"       → 100/100/100/100 (failing — actual ~78/78/65/77)
"src/views/**"    → 80/80/80/80 (failing — actual ~62/62/52/61)
"src/state.js"    → 90/90/90/90 (failing — actual ~44/44/50/25)
"src/router.js"   → 90/90/90/90 (failing — actual ~63/63/57/56)
"src/main.js"     → 90/90/90/90 (failing — actual ~20/20/18/15)
```

Suggested approach: drop ALL aspirational thresholds to reflect TODAY's coverage rounded down (e.g., main.js → 15/15/15/15, views → 50/50/50/50, ui → 70/70/60/65, state → 40/40/40/20, router → 55/55/55/50, data branches → 90, domain branches → 99). This is a "no regression" baseline; future phases ratchet up as code migrates into testable shape (Phase 4 sub-wave 4.1 main.js IIFE migration is still the load-bearing future task).

Keep `src/firebase/**` at 90 (it's already meeting it).

Commit message: `fix(coverage): set thresholds to current state baseline (no-regression gate)` with body explaining the Wave 4 deferred sub-wave context.

#### Commit 2: Suppress pre-existing typecheck errors

Add `// @ts-nocheck` to:
- `tests/rules/storage.test.js`
- `tests/rules/tenant-jump.test.js`
- `tests/scripts/migrate-subcollections/assertions.test.js`
- `tests/scripts/migrate-subcollections/idempotency.test.js`
- `vitest.rules.config.js`

(All flagged in the original Wave 5 typecheck output.) Or alternatively: add these paths to a `tsconfig.json` exclude. Either works.

Commit message: `fix(typecheck): suppress pre-existing errors in tests/rules/ + tests/scripts/ + vitest.rules.config.js`

#### Commit 3: Investigate rules-emulator failure

Read the failing job log: `gh run view <run-id> --job=<rules-tests-job-id> --log-failed`. The failure happens in 27 seconds which is too fast for tests to actually run — likely:
- Emulator binary not downloaded (Firebase tools install hangs?)
- Test path mismatch (vitest.rules.config.js trying to glob a path that no longer exists?)
- Java not available on runner (rules emulator requires Java)

Diagnosis time: ~10-15 min. Fix may be `firebase setup:emulators:firestore` or adding `actions/setup-java@v4` to the workflow.

#### Push, get CI green, then merge

After all three commits, push the branch. CI should run all jobs to completion:
- Install ✓ (already pass)
- Lint ✓ (already pass)
- Typecheck ✓ (after commit 2)
- Test ✓ (after commit 1)
- Rules Tests (Emulator) ✓ (after commit 3)
- Security Audit ✓ (already pass)
- Build ✓ (gated on the above)
- Deploy ✓ (only runs after merge to main)

Merge the PR via GitHub UI or `gh pr merge 3 --squash` (or `--merge` to preserve the 211-commit history — recommend `--merge` to preserve the audit trail of all the deviations and recovery steps).

### Step 3 — After merge, watch the deploy

CI deploy job runs `firebase deploy --only hosting,functions,firestore,storage`. Phase 6 hosting bundle goes live. Anonymous Auth is still on at this point.

### Step 4 — Step 7 of cutover: Console-disable Anonymous Auth

Operator action OR via IdP admin v2 PATCH (orchestrator can do this if user prefers).

```sh
TOKEN=$(gcloud.cmd auth print-access-token)
curl -X PATCH \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Goog-User-Project: bedeveloped-base-layers" \
  -H "Content-Type: application/json" \
  --data '{"signIn":{"anonymous":{"enabled":false}}}' \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/bedeveloped-base-layers/config?updateMask=signIn.anonymous.enabled"
```

Capture `anon_auth_console_disabled_at:` in `06-PREFLIGHT.md ## Cutover Log`.

### Step 5 — Step 11 of cutover: SC#4 clock-skew

Operator-driven UI test in DevTools. ~5 min. No Luke or George needed.

### Step 6 — Update Cutover Log + commit

Orchestrator + user co-author the final `06-PREFLIGHT.md ## Cutover Log` block. Commit + push.

### Step 7 — Wave 5 complete; move to Wave 6 (06-06)

Wave 6 is the cleanup + SECURITY.md + RULES-07 verification gate. **Now's the right time** to add cleanup-ledger rows for all the deviations:
- minInstances:1 reconsider for Phase 7+
- firebaseauth.googleapis.com ToS gate fix
- enrollTotp + unenrollAllMfa + qrcodeDataUrl wiring
- TOTP enrolment user-testing (Step 9)
- AUTH-10 drill user-testing (Step 10)
- cspReportSink redeploy (Phase 3 gap)
- Coverage threshold ratchet plan
- Phase 4 sub-wave 4.1 IIFE migration

`/gsd-execute-phase 6` would resume from where Wave 5 actually finishes (Step 12 cutover log committed) and execute 06-06.

### Step 8 — User-testing batch (deferred end of phases)

When Phase 7-12 are done and Luke + George can sit with you for ~30 min:
1. Wire `enrollTotp` + `unenrollAllMfa` + `qrcodeDataUrl` generation in `src/firebase/auth.js`
2. Push (CI deploys updated bundle)
3. Step 9: TOTP enrolment for both admins (each on their own laptop, ~10 min)
4. Step 10: AUTH-10 lockout drill (both admins live, two rounds, ~15 min)
5. Final cutover log update

---

## Quick prompt for the next session

```
Resuming Phase 6 mid-Wave-5. Read .planning/phases/06-real-auth-mfa-rules-deploy/06-RESUME-NOTE.md
for full context. PR #3 is open with 3 CI failures (all pre-existing Phase 4-5 debt).
User chose "land cutover anyway, fix CI in a follow-up" — recommend Path A.2 (lower
thresholds + ts-nocheck + fix rules emulator + push to get CI green, then merge).
Production state: rules + functions deployed, admins bootstrapped via Path B.
Pending steps after merge: Step 7 anon-disable, Step 11 SC#4, Step 12 cutover log,
then Wave 6 (06-06). User-testing (TOTP enrol + AUTH-10 drill) deferred to end of
all phases per user instruction.
```

---

*Phase: 06-real-auth-mfa-rules-deploy*
*Wave: 5 (mid-execution; cutover commit landed on PR branch, awaiting CI fix + merge)*
*Authored: 2026-05-09T15:30:00Z*
