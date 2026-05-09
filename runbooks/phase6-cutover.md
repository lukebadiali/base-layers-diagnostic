# Phase 6 Cutover Runbook

> Phase 6 Wave 4 deliverable. Execute as a single operator-supervised session per CONTEXT.md D-02. The 12-step sequence is load-bearing — sub-steps cannot be reordered without violating Pitfall 1 (rules deploy before claims propagate causes lockout).
>
> Rollback substrate: `git revert <cutover-sha> --no-edit && git push` triggers the Phase 3 CI deploy job which redeploys the parent commit's rules (D-12). Pre-cutover rehearsal in Step 1 below — the rehearsal IS the SC#4 evidence.

This runbook is intentionally executor-deferred. The plan that authored it deliberately did NOT deploy functions, Console-create the admin users, or flip Anonymous Auth. Those are operator-only steps. The runbook exists so the operator follows a written script during a single-session auth + rules cutover, not so improvisation happens at the keyboard.

---

## Prerequisites

- [ ] **Phase 6 Waves 1-4 merged to main.** Verify with: `git log --oneline --grep="^docs(06-04):" main..HEAD` returns 0 (all Wave 4 commits merged).
- [ ] **Wave 1 06-PREFLIGHT.md PASS.** Verify all 5 sections marked PASS (Firestore region, Identity Platform, passwordPolicy, firebase.json declarations, functions/src/auth scaffolding) AND `mfa.state ENABLED` carry-forward closed (TOTP provider configured per `phase6-bootstrap.md` Step 0).
- [ ] **Wave 2 functions tests green in CI on the cutover SHA.** `gh run list --workflow=ci.yml --branch=main --limit=1 --json conclusion -q '.[0].conclusion'` returns `"success"`.
- [ ] **`gcloud auth application-default login`** completed (D-20).
- [ ] **`firebase login`** completed for the operator account.
- [ ] **Both admins available in same session.** AUTH-10 drill needs both admins online — do NOT begin cutover unless both can complete the drill same-day per D-08.

## Pre-Cutover Smoke Checklist

- [ ] Phase 5 rules + Phase 4 modular split verified GREEN against current Firebase project.
- [ ] cspReportSink in europe-west2 still receives test pings (Phase 3 deliverable — verifies europe-west2 region is alive).
- [ ] No live users (PROJECT.md baseline confirmed; no anonymous-auth-bridged sessions in production).
- [ ] HIBP runtime check confirmed (carry-forward from 06-PREFLIGHT.md — passwordPolicy enforces leaked-password check at AUTH user creation).

---

## Cutover Steps

### Step 1: Pre-cutover rules-rollback rehearsal (~10 min)

[Per D-12: deploy current → revert → re-deploy current → time each step. Rehearsal evidence lives in `runbooks/phase6-rules-rollback-rehearsal.md` — that runbook is authored DURING this step in Wave 5 (06-05 Plan Task 1).]

1. Confirm CI deploy job is green on current main: `gh run list --workflow=ci.yml --branch=main --status=success --limit=1`.
2. Note the SHA at HEAD: `git rev-parse HEAD` -> capture as `$REHEARSAL_SHA_BEFORE`.
3. `git revert $REHEARSAL_SHA_BEFORE --no-edit && git push` -> capture revert SHA as `$REHEARSAL_REVERT_SHA` + push timestamp.
4. Watch CI deploy job: `gh run watch $(gh run list --branch=main --limit=1 --json databaseId -q '.[0].databaseId')`. Capture the timestamp when the deploy job goes green.
5. Verify rules reverted: visit Firebase Console -> Firestore -> Rules; confirm pre-rehearsal rules deployed.
6. Re-deploy current rules: `git revert $REHEARSAL_REVERT_SHA --no-edit && git push` (revert-the-revert). Watch CI green.
7. Total elapsed time from Step 3 push to Step 4 green is the SC#4 evidence; target < 5 minutes.

Capture all timing in `runbooks/phase6-rules-rollback-rehearsal.md` (Wave 5 plan creates that runbook; this Step is the procedure that fills it). Capture `rehearsal_total_seconds:` and `rehearsal_within_5_min: yes|no` in `06-PREFLIGHT.md ## Cutover Log`.

If rehearsal exceeds 5 minutes: ABORT cutover; investigate CI bottleneck before continuing.

---

### Step 2: Deploy auth-blocking + callable Cloud Functions (~5 min + cold-start verify)

[Per D-09: europe-west2; minInstances:1 on blocking triggers; cold-start p99 ≤ 4s.]

```sh
firebase deploy --only functions:beforeUserCreatedHandler,functions:beforeUserSignedInHandler,functions:setClaims --project bedeveloped-base-layers
```

Verify:

- `firebase functions:list --project bedeveloped-base-layers | grep -E "beforeUserCreated|beforeUserSignedIn|setClaims"` returns 3 lines, all in `europe-west2`.
- Cold-start measurement (manual probe): trigger an Auth event from a throwaway test account creation (e.g., via Console "Add user" with a disposable test email — DELETE the test user immediately after), then measure end-to-end latency in Cloud Logging for the `beforeUserCreated` invocation.
- Capture `functions_deploy_p99_cold_start_ms:` in `06-PREFLIGHT.md ## Cutover Log`. Target ≤ 4000.

If cold-start exceeds target: investigate `minInstances:1` config; do NOT continue to Step 3 until p99 ≤ 4s.

---

### Step 3: Run scripts/seed-internal-allowlist/run.js (~1 min)

```sh
cd functions && node ../scripts/seed-internal-allowlist/run.js --verify
```

Expect 4 lines of `[OK]` output (2 writes + 2 verifies):

```
[OK] internalAllowlist/luke@bedeveloped.com seeded with role=admin
[OK] internalAllowlist/george@bedeveloped.com seeded with role=admin
[OK] internalAllowlist/luke@bedeveloped.com verified role=admin
[OK] internalAllowlist/george@bedeveloped.com verified role=admin
```

Capture stdout under `seed_script_output:` in `06-PREFLIGHT.md ## Cutover Log`.

---

### Step 4: Console-create both admin Auth users + emailVerified flag + first-sign-in walkthrough (~15 min)

Follow `runbooks/phase6-bootstrap.md` Steps 0-6 verbatim for each admin (Step 0 verifies `mfa.state` ENABLED; Steps 1-3 cover Console creation + emailVerified + claims-verify for luke; Step 4 repeats for george; Steps 5-6 cover OOB delivery + first-sign-in walkthrough). Capture all timing in `06-PREFLIGHT.md ## Cutover Log` under `bootstrap_log_*` keys.

---

### Step 5: Both admins sign in against OLD anon-OK rules; verify claims (~5 min)

[Per D-11: rules deploy is gated on this step. ABORT cutover if either claim verification fails.]

For each admin:

1. Sign in at `https://baselayers.bedeveloped.com` (or Firebase default URL).
2. In DevTools console: `firebase.auth().currentUser.getIdTokenResult(true).then(r => console.log(r.claims))`.
3. Verify `claims.role === "admin"`. If absent: **ABORT cutover**. Roll back functions deploy via `firebase functions:delete beforeUserCreatedHandler beforeUserSignedInHandler setClaims --project bedeveloped-base-layers --force`. Investigate (most likely cause: case mismatch on internalAllowlist docId — verify `email.toLowerCase()` semantics).

Capture both admins' claims output in `06-PREFLIGHT.md ## Cutover Log` under `admin_signin_claims_verified:`.

---

### Step 6: Deploy firestore.rules + storage.rules (~3 min)

[Per RULES-07: this is the load-bearing step. Pitfall 1 mitigation gate just passed (Step 5).]

Two paths — operator picks:

**Path A (preferred — uses Phase 3 CI substrate):** Merge the cutover commit (built in Step 8 below) to main; CI deploy job runs `firebase deploy` automatically. This requires Step 8 to land BEFORE Step 6 — re-order locally if going this path; the strict-ordering invariant remains "rules deploy AFTER claims-verified", and Path A satisfies that because the CI job runs after the merge.

**Path B (operator-direct):**

```sh
firebase deploy --only firestore:rules,storage:rules --project bedeveloped-base-layers
```

Capture exit code + Firebase Console "Last deployed" timestamp.

Verify (both paths):

- Firebase Console -> Firestore -> Rules: deployed timestamp is current.
- Firebase Console -> Storage -> Rules: deployed timestamp is current.
- `git log --grep="firebase deploy --only firestore:rules" --since="<cutover-day>"` shows exactly one entry (RULES-07 Wave 6 verification gate counts these — must be exactly 1).

Capture `rules_deploy_sha:` and `rules_deploy_console_timestamp:` in `06-PREFLIGHT.md ## Cutover Log`.

---

### Step 7: Disable Anonymous Auth in Firebase Console (~1 min)

1. Open https://console.firebase.google.com/project/bedeveloped-base-layers/authentication/providers.
2. Find "Anonymous" in the providers list.
3. Click the provider; click the "Status" toggle to disable; Save.
4. Capture `anon_auth_console_disabled_at:` in `06-PREFLIGHT.md ## Cutover Log` with the timestamp the Save button was clicked.

---

### Step 8: Land the AUTH-14 deletion commit (~3 min)

[Per D-04: deletes INTERNAL_PASSWORD_HASH + INTERNAL_ALLOWED_EMAILS + state-machine.js + signInAnonymously call + firebase-ready bridge + .gitleaks.toml custom rule. Atomic — a single commit.]

Operator runs (from a clean checkout of main HEAD):

```sh
# 1. Delete src/auth/state-machine.js + tests/auth/state-machine.test.js + tests/fixtures/auth-passwords.js
rm -f src/auth/state-machine.js tests/auth/state-machine.test.js tests/fixtures/auth-passwords.js

# 2. Edit src/main.js to remove:
#    - Line 464: const verifyInternalPassword = ...
#    - Lines 625-633: the INTERNAL_ALLOWED_EMAILS + INTERNAL_PASSWORD_HASH constants block
#    - Line 3156: "Allowed emails: " + INTERNAL_ALLOWED_EMAILS.join(", ") (or rewrite to remove the dead reference)
#    Verify all three deletion sites with: grep -n "INTERNAL_PASSWORD_HASH\|INTERNAL_ALLOWED_EMAILS\|verifyInternalPassword" src/main.js
#    Expected: 0 matches.

# 3. Edit src/firebase/auth.js to remove:
#    - The signInAnonymously import name from line 5
#    - The signInAnonymously re-export from line 8
#    - The onAuthStateChanged + window.FB.currentUser + dispatchEvent block at lines 20-30
#    - The signInAnonymously(auth).catch(...) call at line 31
#    Verify with: grep -n "signInAnonymously\|firebase-ready" src/firebase/auth.js
#    Expected: 0 matches.

# 4. Edit src/main.js to remove the window.addEventListener("firebase-ready", ...) at line 4115
#    Verify with: grep -n "firebase-ready" src/main.js
#    Expected: 0 matches.

# 5. Edit .gitleaks.toml to remove the [[rules]] block at lines 8-14 (the SHA-256 hex regression rule)
#    Keep the [allowlist] block at lines 16-37 unchanged (it covers other legitimate hex literals).

# 6. Run the full local quality gate
npm test
npm run lint
npm run typecheck
cd functions && npm test && cd ..

# 7. Commit
git add -A
git commit -m "feat(06-05): AUTH-14 atomic deletion + signInAnonymously source removal + firebase-ready bridge retirement (D-04)"
git push
```

Verify post-commit (10 grep verifications — matches 06-05 Task 3 enumeration; WARNING-FIX reconciliation):

1. `git diff main~1 main --stat` shows 8-10 file mods (deletions of state-machine.js + state-machine.test.js + auth-passwords.js + the source-edit files).
2. `grep -r "INTERNAL_PASSWORD_HASH" src/ tests/` returns 0 matches.
3. `grep -r "INTERNAL_ALLOWED_EMAILS" src/ tests/` returns 0 matches.
4. `grep -r "verifyInternalPassword" src/ tests/` returns 0 matches.
5. `grep -r "signInAnonymously" src/` returns 0 matches.
6. `grep -r "firebase-ready" src/` returns 0 matches.
7. `test ! -f src/auth/state-machine.js` exits 0.
8. `test ! -f tests/auth/state-machine.test.js` exits 0.
9. `test ! -f tests/fixtures/auth-passwords.js` exits 0.
10. `grep "sha256-hex-literal-regression" .gitleaks.toml` returns 0 matches.

Capture `auth14_deletion_sha:` in `06-PREFLIGHT.md ## Cutover Log`.

---

### Step 9: Both admins enrol TOTP MFA (~10 min)

Each admin signs in (or refreshes session) at `https://baselayers.bedeveloped.com`; the router (D-16) routes to `renderMfaEnrol`; admin scans QR + enters code + submits. Capture `luke_mfa_enrolled_at:` and `george_mfa_enrolled_at:` in `06-PREFLIGHT.md ## Cutover Log`.

If `renderMfaEnrol` fails to load TOTP enrolment QR: Step 0 of `phase6-bootstrap.md` (mfa.state ENABLED + TOTP provider configured) was incomplete; STOP and remediate — do NOT skip MFA enrolment.

---

### Step 10: AUTH-10 drill — Tier-2 un-enrol procedure (~15 min, both admins each)

Follow `runbooks/phase6-mfa-recovery-drill.md` Tier 2 procedure end-to-end. Round 1 (Luke locked out, George operating) + Round 2 (George locked out, Luke operating). Capture all evidence in `phase6-mfa-recovery-drill.md` `## Drill Evidence — Round 1` + `## Drill Evidence — Round 2` blocks.

The Tier-2 turn-key script `scripts/admin-mfa-unenroll/run.js` is the canonical command (BLOCKER-FIX 4); the drill IS the AUTH-10 closure evidence (Pitfall 19).

---

### Step 11: SC#4 clock-skew exercise (~5 min)

[Per D-19 — closes 05-HUMAN-UAT.md test #2 deferred from Phase 5.]

1. One admin spins up a test org via the admin panel.
2. Sends 2 chat messages from the test org.
3. Marks messages read via the standard read-state interaction.
4. In DevTools, override system clock by ±5 minutes (DevTools -> Sensors -> "Override clock" or system time change).
5. Reload page; observe unread-count badge.
6. Expected: badge count UNCHANGED (server-clock-vs-server-clock comparator from Phase 5 D-14).
7. Capture `sc4_clock_skew_passed: yes|no` in `06-PREFLIGHT.md ## Cutover Log`.

---

### Step 12: Update 06-PREFLIGHT.md ## Cutover Log (~3 min)

Append the populated `## Cutover Log` block (skeleton below) to `06-PREFLIGHT.md`. Commit + push.

```sh
git add .planning/phases/06-real-auth-mfa-rules-deploy/06-PREFLIGHT.md
git commit -m "docs(06-05): cutover log evidence (D-02 single-session atomic cutover)"
git push
```

---

## Cutover Log

```
cutover_date: <YYYY-MM-DD HH:MM TZ — moment of git push of cutover commit>
cutover_complete: yes
rehearsal_total_seconds: <int>
rehearsal_within_5_min: yes
functions_deploy_p99_cold_start_ms: <int>
seed_script_output: |
  [OK] internalAllowlist/luke@bedeveloped.com seeded with role=admin
  [OK] internalAllowlist/george@bedeveloped.com seeded with role=admin
  [OK] internalAllowlist/luke@bedeveloped.com verified role=admin
  [OK] internalAllowlist/george@bedeveloped.com verified role=admin
mfa_runtime_check_passed: yes
bootstrap_log_luke_uid: <uid>
bootstrap_log_luke_emailVerified_set_at: <HH:MM:SS TZ>
bootstrap_log_luke_first_signin_at: <HH:MM:SS TZ>
bootstrap_log_george_uid: <uid>
bootstrap_log_george_emailVerified_set_at: <HH:MM:SS TZ>
bootstrap_log_george_first_signin_at: <HH:MM:SS TZ>
admin_signin_claims_verified: |
  luke: { role: "admin", orgId: null }
  george: { role: "admin", orgId: null }
rules_deploy_sha: <sha>
rules_deploy_console_timestamp: <YYYY-MM-DDTHH:MM:SSZ>
anon_auth_console_disabled_at: <YYYY-MM-DD HH:MM TZ>
auth14_deletion_sha: <sha>
luke_mfa_enrolled_at: <HH:MM:SS TZ>
george_mfa_enrolled_at: <HH:MM:SS TZ>
mfa_drill_round_1_total_seconds: <int>
mfa_drill_round_2_total_seconds: <int>
mfa_drill_evidence_path: runbooks/phase6-mfa-recovery-drill.md
sc4_clock_skew_passed: yes
oob_credential_delivery_method: <captured post-cutover per D-06>
```

---

## Rollback Procedure (if Steps 5-7 fail)

[Per D-12: 5-minute target via `git revert` + Phase 3 CI deploy job.]

1. `git revert <cutover-sha> --no-edit && git push`
2. Watch CI: `gh run watch $(gh run list --branch=main --limit=1 --json databaseId -q '.[0].databaseId')`
3. Re-enable Anonymous Auth in Firebase Console (Step 7 in reverse).
4. Re-deploy Phase 5 rules manually if CI deploy job is broken: `firebase deploy --only firestore:rules,storage:rules --project bedeveloped-base-layers`
5. Investigate root cause; resolve; re-attempt cutover.

If rollback exceeds 5 minutes (target per D-12): the rehearsal in Step 1 should have caught this; escalate to user before continuing investigation.

---

## Citations

- Phase 6 D-02 (single-session atomic cutover)
- Phase 6 D-04 (AUTH-14 deletion atomic with rules deploy)
- Phase 6 D-09 (europe-west2 + minInstances:1 + cold-start p99 ≤ 4s)
- Phase 6 D-11 (deploy ordering — functions FIRST → bootstrap → claims-verify → rules deploy → anon-disable)
- Phase 6 D-12 (5-min rollback substrate via Phase 3 CI deploy job)
- Phase 6 D-19 (SC#4 clock-skew exercise closes 05-HUMAN-UAT.md test #2)
- BLOCKER-FIX 4 (AUTH-10 Tier-2 turn-key script `scripts/admin-mfa-unenroll/run.js` is canonical, replacing unverified firebase-tools CLI)
- Pitfall 1 (locking yourself out on first rules deploy — D-11 closes via Step 5 ABORT gate)
- Pitfall 6 (custom claims propagation lag — claims-set-on-creation closes)
- Pitfall 12 (auth-blocking 7s deadline — minInstances:1 closes)
- Pitfall 19 (compliance theatre — drill IS the evidence)
- `runbooks/hosting-cutover.md` (Phase 3 cutover precedent — same checklist shape)
- `runbooks/phase5-subcollection-migration.md` (Phase 5 cutover precedent)
- `runbooks/phase6-bootstrap.md` (Step 4 procedure)
- `runbooks/phase6-mfa-recovery-drill.md` (Step 10 procedure)
- `runbooks/phase6-rules-rollback-rehearsal.md` (Step 1 procedure — Wave 5 authors during execution)
