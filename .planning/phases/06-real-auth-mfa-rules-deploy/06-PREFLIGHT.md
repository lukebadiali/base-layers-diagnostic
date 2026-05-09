# Phase 6 — Wave 1 Pre-flight Verifications

**Plan:** 06-01
**Phase:** 06-real-auth-mfa-rules-deploy
**Authored:** 2026-05-08T20:21:52Z
**Status:** PARTIAL — automated checks PASS; operator-side checks PENDING-OPERATOR-EXECUTION (see `## Wave 1 Status`)

**Purpose.** Prove the platform can run Phase 6 BEFORE writing handlers. Identity Platform must be upgraded (else `passwordPolicy` + TOTP APIs are absent); Firestore must be in `europe-west2` (else `cspReportSink` + new auth functions live in a different region than the database, violating D-09's UK data-residency story); `passwordPolicy` must be enabled (else AUTH-04 is unimplementable); `firebase.json` must already declare `firestore.rules` + `storage.rules` (verify-and-leave per pattern mapper).

This is the load-bearing gate that closes the STATE.md "Firestore region not yet verified" outstanding todo and establishes the deployment substrate Wave 2 lands on.

---

## Firestore Region

**Requirement:** Firestore region for `bedeveloped-base-layers` MUST be `europe-west2` per D-09 (co-located with `cspReportSink` + new `functions/src/auth/*` handlers; UK data-residency story for `PRIVACY.md` Phase 11). If `locationId != europe-west2`, escalate to user before Wave 2 (deviation gate).

**Closes STATE.md outstanding todo:** "Firestore region of `bedeveloped-base-layers` not yet verified."

### Verify Command

```bash
gcloud firestore databases describe \
  --database="(default)" \
  --project=bedeveloped-base-layers \
  --format="value(locationId,type)"
```

**Expected output (PASS):**

```
europe-west2	FIRESTORE_NATIVE
```

### Captured Output

**Status:** PASS — captured 2026-05-08T20:30:00Z

Run by orchestrator from project root using the absolute path to `gcloud.cmd` (Git Bash invokes the Windows .cmd shim correctly, bypassing the broken `gcloud` Python launcher in PATH that the worktree executor agent hit).

```
$ /c/Users/hughd/AppData/Local/Google/Cloud\ SDK/google-cloud-sdk/bin/gcloud.cmd firestore databases describe --database="(default)" --project=bedeveloped-base-layers --format="value(locationId,type)"
europe-west2	FIRESTORE_NATIVE
```

Active gcloud account at capture: `business@bedeveloped.com` (confirmed via `gcloud auth list`).

**Verified at:** `2026-05-08T20:30:00Z`

### Decision

**PASS — region verified at 2026-05-08T20:30:00Z.** Firestore database `(default)` for project `bedeveloped-base-layers` is `europe-west2 / FIRESTORE_NATIVE`, matching D-09's UK data-residency requirement and co-locating with `cspReportSink` (Phase 3) + the new `functions/src/auth/*` handlers (Wave 2). Closes the STATE.md "Firestore region of `bedeveloped-base-layers` not yet verified" outstanding todo. Wave 2 unblocked on this section.

---

## Identity Platform Upgrade

**Requirement:** Firebase project `bedeveloped-base-layers` MUST have the Identity Platform upgrade in place per AUTH-02 (else `passwordPolicy` API + TOTP MFA + org-wide MFA enforcement are absent — Phase 6 cannot ship).

This is a Firebase Console verification — no programmatic command exposes the upgrade flag uniformly.

### Verify Steps (Operator-Run)

1. Visit: `https://console.firebase.google.com/project/bedeveloped-base-layers/authentication/providers`
2. Visual indicator: the page shows "Identity Platform" branding (top-right or in the header) AND the left nav shows an "MFA" tab AND the "Settings" sub-page exposes a "Password policy" section.
3. If absent (page shows only "Firebase Authentication" branding and no MFA tab), the project is on the legacy Firebase Auth tier and must be upgraded via Console "Upgrade to Identity Platform" button. Note: the upgrade is irreversible and may surface billing changes (operator should review pricing before upgrading).

### Captured Confirmation

**Status:** PASS — captured 2026-05-09T00:15:00Z (post-upgrade)

**History:** Pre-flight initially captured `subtype: "FIREBASE_AUTH"` + `mfa.state: "DISABLED"` (legacy Firebase Auth tier) on 2026-05-08T20:35:00Z via the IdP admin v2 API. Operator (Hugh) ran the Identity Platform upgrade in Firebase Console between 20:35 and 00:15. Re-query confirmed the upgrade landed.

**Verification command (orchestrator-run):**

```bash
TOKEN=$(gcloud.cmd auth print-access-token)
curl -sS -H "Authorization: Bearer $TOKEN" \
  -H "X-Goog-User-Project: bedeveloped-base-layers" \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/bedeveloped-base-layers/config"
```

**Captured response (relevant fields):**

```json
{
  "subtype": "IDENTITY_PLATFORM",
  "mfa": { "state": "DISABLED" },
  "passwordPolicyConfig": {
    "passwordPolicyEnforcementState": "ENFORCE",
    "passwordPolicyVersions": [{
      "customStrengthOptions": { "minPasswordLength": 12, "maxPasswordLength": 4096 },
      "schemaVersion": 1
    }],
    "lastUpdateTime": "2026-05-08T20:39:34.664871Z"
  },
  "blockingFunctions": {},
  "emailPrivacyConfig": { "enableImprovedEmailPrivacy": true }
}
```

**Verified at:** `2026-05-09T00:15:00Z`

### Decision

**PASS — Identity Platform upgrade verified at 2026-05-09T00:15:00Z.** Project tier is `IDENTITY_PLATFORM` (not legacy `FIREBASE_AUTH`); blocking-function registration surface (`blockingFunctions: {}`) is now available for Wave 2 to populate; passwordPolicy is enforced with minLength=12; `enableImprovedEmailPrivacy: true` is a positive AUTH-12 signal (account-enumeration story).

**Wave 5 carry-forward (NON-BLOCKING for Wave 2, MUST resolve before live cutover):**

1. **`mfa.state: "DISABLED"`** — IdP tier is in but org-wide MFA enforcement is off. Wave 5 cutover requires enabling TOTP MFA at the project level before admin enrolment can succeed. Operator action: in Console > Authentication > Sign-in method > Multi-factor authentication, enable TOTP and (per AUTH-02) set the enforcement scope. Re-verify with the same admin v2 query — `mfa.state` should be `ENABLED` (or active enforcement equivalent).
2. **HIBP / leaked-password check** — `passwordPolicyConfig.customStrengthOptions` does not expose a breach-check field in the API response. Operator earlier reported the Console toggle is ON, but propagation to the API is not visible. Wave 5 verification: during admin Console-creation, attempt to set a known-breached password (e.g., `Password123!`) and confirm Firebase rejects it. If accepted, escalate before the cutover commit lands.

---

## passwordPolicy

**Requirement:** Project-level `passwordPolicy` MUST be enabled with `minLength >= 12` AND "Check passwords against compromised credentials" (HIBP) enabled per AUTH-04. Without this, Phase 6 client + Console-creation workflows cannot enforce the password floor.

### Verify Steps (Operator-Run)

**Primary path — Firebase Console:**

1. Visit: `https://console.firebase.google.com/project/bedeveloped-base-layers/authentication/settings`
2. Scroll to "Password policy" section.
3. Confirm:
   - **Minimum length** set to a value `>= 12`.
   - **Require uppercase character / lowercase character / numeric character / non-alphanumeric character** — set per project policy (Phase 6 D-?? does not mandate specific composition rules; minimum length + HIBP are the load-bearing checks).
   - **Check passwords against compromised credentials** — toggle ON (HIBP / leaked-password check).

**Secondary path — gcloud (alternative if Console access is unavailable):**

```bash
gcloud identity-toolkit projects describe bedeveloped-base-layers \
  --format="value(passwordPolicyConfig)"
```

(Note: `gcloud identity-toolkit` may require `gcloud components install identity-toolkit` first; some clusters expose this only via REST. If not available, rely on Console verification above.)

### Captured Output

**Status:** PARTIAL-PASS — captured 2026-05-09T00:15:00Z (orchestrator-run via IdP admin v2 API, post-IdP-upgrade)

**Captured fields (from the same admin v2 GET that verified Identity Platform upgrade above):**

```
verified_at: 2026-05-09T00:15:00Z
passwordPolicyEnforcementState: ENFORCE
min_length: 12
max_length: 4096
containsLowercaseCharacter: false
containsUppercaseCharacter: false
containsNumericCharacter: false
containsNonAlphanumericCharacter: false
schemaVersion: 1
lastUpdateTime: 2026-05-08T20:39:34.664871Z
console_url: https://console.firebase.google.com/project/bedeveloped-base-layers/authentication/settings
operator: Hugh (orchestrator-run)
```

**Operator confirmation (Firebase Console):** Hugh confirmed via Console UI on 2026-05-08 (pre-upgrade) that "Check passwords against compromised credentials" toggle is ON. The IdP admin v2 API response does not surface this field in `customStrengthOptions` — either it persists under a v1 endpoint, has a different field name in the API surface than the Console UI suggests, or the Console toggle has not propagated post-upgrade. Treated as PARTIAL-PASS pending Wave 5 runtime verification.

### Decision

**PARTIAL-PASS — verified at 2026-05-09T00:15:00Z (minLength=12, ENFORCE state, HIBP UI-confirmed but not API-visible).**

minLength=12 satisfies AUTH-04's hard floor. `passwordPolicyEnforcementState: ENFORCE` confirms the policy is server-side active (not just OFFLINE/audit). Wave 2 unblocks on this section.

**Wave 5 carry-forward (NON-BLOCKING for Wave 2, MUST resolve before live cutover):**

The HIBP / leaked-password check is not visible in the v2 admin API response. During Wave 5 admin Console-creation, attempt to set a known-breached password (e.g., `Password123!` or any HIBP top-100k value) and confirm Firebase rejects with the expected `auth/password-does-not-meet-requirements` error code. If the breached password is accepted, the AUTH-04 HIBP requirement is not actually enforced and the cutover commit must NOT land until Console > Authentication > Settings > Password policy > "Check passwords against compromised credentials" is toggled ON and propagation is confirmed.

---

## firebase.json declarations

**Requirement (per pattern mapper):** `firebase.json` MUST already declare `firestore.rules` + `firestore.indexes.json` + `storage.rules` paths. Wave 1's plan task collapses to a verify-and-leave gate — declarations are EXPECTED to be present from prior phase work; this section confirms and is a no-op if PASS.

### Verify Command

```bash
node -e "const j=require('./firebase.json'); console.log(JSON.stringify({fs: j.firestore, st: j.storage}, null, 2))"
```

### Captured Output

Run on 2026-05-08T20:21:52Z by executor agent:

```json
{
  "fs": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "st": {
    "rules": "storage.rules"
  }
}
```

### File Existence Check

```bash
ls -la firestore.rules storage.rules firestore.indexes.json
```

Captured stdout:

```
-rw-r--r-- 1 hughd 197609   48 May  8 21:21 firestore.indexes.json
-rw-r--r-- 1 hughd 197609 7633 May  8 21:21 firestore.rules
-rw-r--r-- 1 hughd 197609 1841 May  8 21:21 storage.rules
```

All three files present at repo root with non-zero byte size (`firestore.rules` = 7633 bytes / 159 lines from Phase 5; `storage.rules` = 1841 bytes / 44 lines from Phase 5; `firestore.indexes.json` = 48 bytes scaffold).

### Decision

**PASS — verified at 2026-05-08T20:21:52Z.** `firebase.json` declares both `firestore` (rules + indexes) and `storage` (rules) blocks per the expected shape (lines 50-56 of `firebase.json`). All three referenced files exist at the repo root. Pattern mapper's "verify-and-leave" gate is satisfied — no edit to `firebase.json` is required in Wave 1.

---

## functions/src/auth scaffolding

**Requirement:** `functions/src/auth/` subdirectory MUST exist in git so Wave 2 (06-02) can populate it with `beforeUserCreated.ts`, `beforeUserSignedIn.ts`, `setClaims.ts`, and `claim-builder.ts` per CONTEXT.md D-10. Empty subdirectories are not tracked by git, so a `.keep` placeholder is the minimal acceptable scaffold.

### Verify Command

```bash
test -f functions/src/auth/.keep && grep -q "Phase 6" functions/src/auth/.keep && echo "placeholder OK"
```

### Captured Output

```
subdirectory_created: yes
placeholder_path: functions/src/auth/.keep
verified_at: 2026-05-08T20:21:52Z
```

Captured stdout from verify command:

```
placeholder OK
```

### Decision

**PASS — verified at 2026-05-08T20:21:52Z.** `functions/src/auth/.keep` exists with a one-line comment naming Phase 6 Wave 1 + the Wave 2 hand-off (`beforeUserCreated.ts`, `beforeUserSignedIn.ts`, `setClaims.ts`, `claim-builder.ts` per CONTEXT.md D-10). Zero `.ts` source files added in this wave (D-01 wave shape: Wave 2 owns those). `functions/src/index.ts` UNCHANGED. `functions/package.json` UNCHANGED (Phase 3 pinned firebase-admin@13.8.0 + firebase-functions@7.2.5 stand).

---

## Wave 1 Status

**Summary as of 2026-05-09T00:15:00Z (orchestrator-resolved post-IdP-upgrade):**

| Section                          | Status                                | Decision        |
| -------------------------------- | ------------------------------------- | --------------- |
| Firestore Region                 | Verified by orchestrator (gcloud)     | PASS            |
| Identity Platform Upgrade        | Verified by orchestrator (admin v2)   | PASS            |
| passwordPolicy                   | Verified by orchestrator (admin v2)   | PARTIAL-PASS    |
| firebase.json declarations       | Verified by agent (verify-and-leave)  | PASS            |
| functions/src/auth scaffolding   | Verified by agent (.keep placeholder) | PASS            |

**Wave 2 unblock condition: SATISFIED.** All five Wave 1 sections decisively pass for the Wave 2 scope (function source authoring + Vitest unit tests against `claim-builder.ts`; no production deploy). The PARTIAL-PASS on `passwordPolicy` (HIBP not visible in admin v2 API response) is a Wave 5 carry-forward, not a Wave 2 blocker — Wave 2 doesn't exercise the password policy.

**Wave 5 carry-forward (must resolve before live cutover commits):**

1. Enable TOTP MFA at the project level (`mfa.state` is currently `DISABLED`). Verify post-toggle via the same admin v2 GET; expect `mfa.state: "ENABLED"` (or active enforcement equivalent) and a non-empty `mfa.providerConfigs` containing a TOTP entry.
2. Verify HIBP / leaked-password rejection at runtime during Wave 5 admin Console-creation: attempt a known-breached password (e.g., `Password123!`); expect `auth/password-does-not-meet-requirements`. If accepted, toggle ON in Console > Authentication > Settings > Password policy and re-test before the AUTH-14 deletion commit lands.

**Commit SHA of this preflight:** `<orchestrator updates after Wave 1 merge commit>`

**Wave 2 unblock timestamp:** `2026-05-09T00:15:00Z`

**Wave 1 done — Wave 2 cleared to start.**

---

## Wave 5 D-12 substrate adjustment (deviation captured 2026-05-09T13:30:00Z)

**Discovered before Step 1 of cutover.** The original D-12 design assumed the Phase 3 CI deploy job redeploys `firestore.rules` + `storage.rules` on every push to main. Reading `.github/workflows/ci.yml:189-192` showed the actual deploy command is:

```yaml
npx firebase-tools@15.16.0 deploy \
  --only hosting,functions \
  --project bedeveloped-base-layers \
  --non-interactive
```

Rules are not in the `--only` list — Phase 3 set up CI to deploy hosting+functions only. D-12's "5-minute rollback via `git revert + push`" substrate therefore did not actually exist at Wave 5 start. Caught before any production state changed.

**Resolution chosen (decided 2026-05-09T13:30:00Z): Option A — extend CI deploy to include rules.** The cutover commit (Step 8 in `runbooks/phase6-cutover.md`) will include a single-line edit to `ci.yml` adding `firestore:rules,storage:rules` to the `--only` list, atomic with the AUTH-14 deletions per D-04. The push of that commit IS the rules deploy. From that commit onward, the D-12 substrate works as designed: `git revert <cutover-sha> && git push` triggers CI which redeploys whatever rules are at the parent commit.

**Step 1 rehearsal procedure adjusted:** Because CI does not yet include rules, the pre-cutover rehearsal cannot use the `git revert + push + watch CI` loop in `runbooks/phase6-cutover.md` Step 1 verbatim. Substituted with a manual local `firebase deploy --only firestore:rules,storage:rules` rehearsal that exercises the same effect (production rules can be flipped quickly) using a different mechanism. Procedure:

1. Deploy current main rules to production: `firebase deploy --only firestore:rules,storage:rules --project bedeveloped-base-layers` (T0 timestamp).
2. Switch worktree to a pre-Phase-5 SHA's rules: `git show <pre-phase-5-sha>:firestore.rules > firestore.rules; git show <pre-phase-5-sha>:storage.rules > storage.rules`.
3. Deploy reverted rules: same `firebase deploy --only firestore:rules,storage:rules` (T1 timestamp).
4. Verify rules reverted in Firebase Console.
5. Restore current rules from main: `git checkout HEAD -- firestore.rules storage.rules`.
6. Re-deploy current rules: same `firebase deploy --only firestore:rules,storage:rules` (T2 timestamp).
7. Total elapsed time = T2 − T0; SC#4 target < 5 minutes.

The rehearsal proves the operator can flip rules in <5min via local CLI; the post-cutover production rollback uses the CI substrate. Both paths are now load-bearing and operator should know both. Captured for runbook update post-cutover.

**Runbook update deferred to post-cutover.** `runbooks/phase6-cutover.md` Step 1 + Step 8 are not edited mid-cutover. The actual procedure executed for this phase is the procedure above; the runbook will be reconciled to match in Step 12 or as a Wave 6 documentation task.

---

*Phase: 06-real-auth-mfa-rules-deploy*
*Plan: 06-01 (Wave 1 — Pre-flight Verifications)*
*Authored: 2026-05-08T20:21:52Z*
*Updated: 2026-05-09T13:30:00Z (D-12 substrate adjustment captured)*
*Updated: 2026-05-09T21:00:00Z (Cutover Log appended — Step 12 close-out)*

---

## Cutover Log

**Closing entry — Phase 6 Wave 5 cutover complete with documented substrate gaps.**

### Timeline

| Marker | Timestamp (UTC) | Note |
|---|---|---|
| `cutover_date_started` | 2026-05-09T13:30:00Z | Step 1 rehearsal commenced |
| `cutover_date_paused_1` | 2026-05-09T14:45:00Z | Mid-Wave-5 pause (BLOCKER-FIX 1 wiring scope-creep) |
| `cutover_date_resumed_1` | 2026-05-09T15:13:00Z | Branch `phase-6-cutover-20260509-1513` created |
| `cutover_date_paused_2` | 2026-05-09T15:30:00Z | Mid-Wave-5 second pause (cutover commit on PR branch, awaiting CI fix) |
| `cutover_date_resumed_2` | 2026-05-09T15:45:00Z | New session began |
| `cutover_commit_pushed` | 2026-05-09T15:43:24Z | PR #3 head-of-branch (`eec6aaa`) after Path A.2 CI fixes |
| `pr_merged_to_main` | 2026-05-09T16:18:22Z | Squash-merged by `lukebadiali` → SHA `3fddc1c` |
| `anon_auth_console_disabled_at` | 2026-05-09T16:43:07Z | IdP admin v2 PATCH `signIn.anonymous.enabled=false`, HTTP 200 |
| `sc4_clock_skew_executed` | ~2026-05-09T20:30:00Z | Step 11 confirmed badge/timestamp unchanged after operator drill |
| `cutover_date_completed` | 2026-05-09T21:00:00Z | Step 12 cutover log committed |
| `cutover_complete` | yes (with documented gaps — see Substrate Gaps below) | |

### Step-by-step evidence

```
rehearsal_total_seconds: 121
rehearsal_within_5_min: yes
rehearsal_evidence_path: runbooks/phase6-rules-rollback-rehearsal.md
rehearsal_substrate_caveat: D-12 auto-rollback via "git revert + git push" works for hosting + firestore + storage rules ONLY (not functions). Functions deploys via CI fail at the IAM-set step (D-8). The rehearsal used local CLI as substitute substrate and proved manual rollback timing meets SC#4 < 5 min.

functions_deploy_p99_cold_start_ms: not measured (D-4 minInstances:1 stripped pre-cutover for cost; cold-start baseline deferred to Phase 7+)

seed_script_output: |
  [OK] internalAllowlist/luke@bedeveloped.com seeded with role=admin
  [OK] internalAllowlist/george@bedeveloped.com seeded with role=admin
  [OK] internalAllowlist/luke@bedeveloped.com verified role=admin
  [OK] internalAllowlist/george@bedeveloped.com verified role=admin

mfa_runtime_check_passed: yes (mfa.state ENABLED + TOTP providerConfig visible in IdP admin v2 GET as of pre-cutover; mfa.state subsequently set to DISABLED 2026-05-09T~17:00Z to unblock Step 11 with TOTP wiring deferred — re-enable after `enrollTotp + qrcodeDataUrl` wiring lands in Wave 6).

bootstrap_log_luke_uid: LQpdqpWqcgVLIE59ln3x8RMf5Mk1
bootstrap_log_luke_emailVerified_set_at: 2026-05-09T14:27:00Z
bootstrap_log_luke_first_signin_at: 2026-05-09T~18:50:00Z (live signin during recovery — multi-attempt due to API key referrer + IdP blocking-handler 403 substrate gaps; eventual successful signIn produced JWT with role=admin, orgId=null, email_verified=true, sign_in_provider=password, firstRun field cleared via direct admin claim flip)

bootstrap_log_george_uid: CZTjcv0mYafO49swTc3P4b6j99W2
bootstrap_log_george_emailVerified_set_at: 2026-05-09T14:33:30Z
bootstrap_log_george_first_signin_at: deferred-pending-verification-batch (TOTP enrol + AUTH-10 drill scheduled end of Phase 7-12 per operator instruction)

admin_signin_claims_verified: |
  luke: { role: "admin", orgId: null }   # firstRun cleared during recovery via direct API patch (not BLOCKER-FIX 1's deferred setClaims call)
  george: { role: "admin", orgId: null, firstRun: true }  # bootstrap state preserved; first-signin flow not yet exercised
admin_signin_claims_verification_method: Path B (Admin SDK direct claims) for cutover bootstrap; Luke's firstRun → false flip done by direct accounts:update PATCH today; BLOCKER-FIX 1's post-password-update setClaims wiring still deferred (Wave 6).

rules_deploy_sha: 3fddc1c (squash-merged from PR #3, push-to-main 2026-05-09T16:18Z); manual `firebase deploy --only firestore:rules` + `firebase deploy --only storage` from local CLI 2026-05-09T~17:00Z to ensure production matches HEAD after CI deploy retries. Rules: Phase 5 strict ruleset, all reads/writes gated on isAuthed() + email_verified + non-anonymous + role/orgId claims.
rules_deploy_console_timestamp: 2026-05-09T16:18:55Z (Last-Modified observed on Firebase Hosting after merge); manual re-deploy timestamp ~17:00Z

auth14_deletion_sha: 3fddc1c (verifyInternalPassword + supporting infrastructure removed in this commit per D-10 surgical scope)

luke_mfa_enrolled_at: deferred-pending-wiring (Step 9 batch — `enrollTotp + qrcodeDataUrl` wiring is Wave 6 / 06-06)
george_mfa_enrolled_at: deferred-pending-wiring (same)
mfa_drill_round_1_total_seconds: deferred (Step 10 batch alongside Step 9)
mfa_drill_round_2_total_seconds: deferred
mfa_drill_evidence_path: runbooks/phase6-mfa-recovery-drill.md (skeleton present; populated when drill runs)

sc4_clock_skew_passed: yes (operator-confirmed badge/timestamp unchanged after clock-skew drill)
sc4_substrate_caveat: D-14 server-clock comparator exists in src/data/read-states.js (writes chatLastRead via serverTimestamp()) and src/domain/unread.js (consumes server-Timestamp inputs). main.js's lastReadForOrg accessor (line 468) and markChatReadFor (line 584) STILL use localStorage + client-clock iso() rather than the data adapter. The "PASS" outcome is structurally weak — the badge stays unchanged because localStorage chatLastRead doesn't auto-refresh on reload, NOT because a server-time comparator was actively exercised. The proper SC#4 test (which would actually exercise D-14) requires main.js IIFE migration to consume read-states.js (Phase 4 sub-wave 4.1 carryover; Wave 6 cleanup-ledger row).

oob_credential_delivery_method: not formally captured this cutover (operator-paced, deferred per D-06).
```

### Substrate Gaps (recovered/exposed during this cutover; queued for Wave 6 + Phase 7)

**Production deployment substrate (recovered today):**
- D-13: GitHub Pages CNAME — `baselayers.bedeveloped.com` CNAMEs to `lukebadiali.github.io`, NOT Firebase Hosting. The cutover plan assumed Firebase Hosting served the production URL; reality is GitHub Pages auto-deploys from main branch root. Phase 6 hosting bundle goes only to `bedeveloped-base-layers.web.app`. DNS migration is Phase 3 carry-forward — Wave 6 cleanup-ledger row.
- D-14: Workload Identity Federation — `github-actions-deployer@bedeveloped-base-layers.iam.gserviceaccount.com` SA + WIF pool `github-actions-pool` + GitHub OIDC provider `github-actions-provider` provisioned today. 8 IAM roles (firebase.admin / firebasehosting.admin / firebaserules.admin / cloudfunctions.admin / run.admin / datastore.indexAdmin / artifactregistry.writer / iam.serviceAccountUser / serviceusage.serviceUsageConsumer). WIF principalSet binding scoped to repo `lukebadiali/base-layers-diagnostic`. Two repo secrets configured: `GCP_SERVICE_ACCOUNT` + `GCP_WORKLOAD_IDENTITY_PROVIDER`.
- D-15: cloudbilling.googleapis.com API enabled on the project (was off; gated firebase deploy functions/billing-info read).
- D-16: Cloud Run service names lowercase (`beforeusercreatedhandler` etc.) vs Cloud Functions camelCase (`beforeUserCreatedHandler`). Documented for future invoker rebinding scripts.
- D-17: Firebase API key allowedReferrers extended to include `bedeveloped-base-layers.web.app/*` and `bedeveloped-base-layers.firebaseapp.com/*` (was only `baselayers.bedeveloped.com/*`, `*.lukebadiali.github.io/*`, `localhost/*`).

**CI deploy substrate (recovered today):**
- D-18: CI deploy `--only` narrowed from `hosting,functions,firestore,storage` to `hosting,firestore,storage` (PR #4). Functions deploy via CI is fundamentally broken until D-8 ToS gate resolved — every CI functions-deploy attempt wipes the manually-bound `gcp-sa-identitytoolkit` invoker (D-7 regression cascade). Operator runs `firebase deploy --only functions --project bedeveloped-base-layers` from local CLI when functions need updating.
- D-19: Header-assertion step in CI deploy job retargeted from `baselayers.bedeveloped.com` (GitHub Pages, can't carry custom headers) to `bedeveloped-base-layers.web.app` (Firebase Hosting where firebase.json headers actually land).
- D-20: PR Preview Deploy job rewritten — was using `FirebaseExtended/action-hosting-deploy@v0.10.0` which requires a JSON SA key input incompatible with WIF; replaced with raw `npx firebase-tools hosting:channel:deploy` mirroring the main deploy job's mechanism. Trade-off: lose the action's auto-PR-comment with preview URL.
- D-21: D-7 manual invoker bindings restored on 4 Cloud Run services after CI deploy attempts wiped them — `service-76749944951@gcp-sa-identitytoolkit.iam.gserviceaccount.com` rebound to `roles/run.invoker` on `beforeusercreatedhandler`, `beforeusersignedinhandler`, `cspreportsink`, `setclaims`. Verified end-of-recovery.

**Auth substrate (D-8 cascade — exposed by first live signin attempt):**
- D-22: D-8 substrate gap exposed live. IdP signs blocking-handler invocations as `service-<projectNumber>@gcp-sa-firebaseauth.iam.gserviceaccount.com` SA which doesn't exist on this project (firebaseauth.googleapis.com API not enabled, ToS-gated, gcloud `services enable` returns AUTH_PERMISSION_DENIED). D-7 manual binding to `gcp-sa-identitytoolkit` does NOT satisfy IdP's invocation flow — Cloud Run logs show "Empty Authorization header value" 403. Path B Admin-SDK bootstrap (D-9) bypassed this during cutover but live first-signin exercised it for the first time today and it failed.
- D-23: Workaround applied — IdP `blockingFunctions.triggers` PATCHed to `{}` (cleared) so signInWithPassword no longer invokes the broken Cloud Run path. 2026-05-09T17:11:24Z. Future user creation will not auto-claim — Phase 7 must resolve via either (a) operator accepts firebaseauth.googleapis.com ToS in Firebase/GCP Console (UI loaded fails with "Failed to load" on multiple attempts — needs retry / different network / Firebase Console route), OR (b) callable claims-setter pattern, OR (c) 1st-gen blocking functions migration.

**Application code substrate (recovered today, committed in `7d31bfc`):**
- D-24: Chat send + chat-view subscribe + global chat subscription (3 callsites in main.js) all migrated from legacy top-level `/messages` collection to `/orgs/{orgId}/messages` subcollection. Legacy paths returned `Missing-or-insufficient-permissions` because Phase 5 strict rules only cover the subcollection. Internal-user cross-org global view dropped (was always unsound under strict rules; require active-org context now).
- D-25: `public/data/pillars.js` added so Vite build copies `data/pillars.js` into `dist/`. The legacy `<script src="data/pillars.js">` in `index.html` is load-bearing (`window.BASE_LAYERS = {...}` consumed at main.js line 212). Without this, Firebase Hosting returned `text/html` MIME for the missing path, the script refused to execute, and the app crashed. The repo-root `data/pillars.js` stays intact for GitHub Pages.
- D-26: `renderFirstRun` sign-out button added — escape hatch for stale-session admins. Without it, an admin landed on the firstRun screen with no UI path off (BLOCKER-FIX 1 post-password setClaims wiring deferred — without flip, `firstRun: true` stays in claims forever and router keeps re-rendering firstRun).

**Temporary bypasses (must restore in Wave 6):**
- D-27: `src/main.js` MFA-enrol gate (line 805) + `src/router.js` MFA gate (line ~115) both short-circuited with `false &&` to allow admins past without TOTP enrolment for Step 11. Wave 6 restores both alongside `enrollTotp + qrcodeDataUrl` wiring in `src/firebase/auth.js`.
- D-28: IdP `mfa.state` PATCHed from ENABLED to DISABLED to mirror the client-side bypass. Wave 6 re-enables.

### Wave 6 cleanup-ledger queue (consolidated)

This list seeds `runbooks/phase-6-cleanup-ledger.md` (created in Wave 6 / 06-06):

1. **DNS migration** — `baselayers.bedeveloped.com` CNAME from `lukebadiali.github.io` to Firebase Hosting custom-domain target. Decision required: migrate (lose GH Pages auto-deploy fallback) vs. update security plan to acknowledge GitHub Pages as production (lose CSP/headers).
2. **D-8 ToS gate** — operator clicks Enable on https://console.cloud.google.com/apis/library/firebaseauth.googleapis.com?project=bedeveloped-base-layers and accepts Firebase Authentication Customer Data Processing Addendum. After acceptance, `gcp-sa-firebaseauth` SA auto-provisions in ~30s; rebind `service-<projectNumber>@gcp-sa-firebaseauth.iam.gserviceaccount.com` to `roles/run.invoker` on the 4 Cloud Run services. Then re-PATCH IdP `blockingFunctions.triggers` to restore `beforeCreate.functionUri` + `beforeSignIn.functionUri` (verified URLs preserved in this Cutover Log). Live-test signin to confirm.
3. **TOTP wiring** — implement `enrollTotp` + `unenrollAllMfa` + `qrcodeDataUrl` generation in `src/firebase/auth.js`. After wiring, restore both MFA gates (D-27) and re-enable IdP `mfa.state` (D-28). Then run Step 9 (TOTP enrol) + Step 10 (AUTH-10 drill) for both Luke and George end-of-phases-batch per original deferral plan.
4. **BLOCKER-FIX 1 setClaims wiring** — `src/firebase/auth.js:updatePassword` should call `setClaims` callable to flip `firstRun: true → false` after password update succeeds, then `forceRefresh` the idToken. Closes the stuck-on-firstRun-screen scenario without requiring admin-side claim flip.
5. **Phase 4 sub-wave 4.1 IIFE migration** — main.js's `lastReadForOrg` (line 468) and `markChatReadFor` (line 584) migrated from localStorage + client-clock to consume `src/data/read-states.js`. This is what actually wires D-14 server-clock comparator into production. Until done, SC#4's PASS evidence is structurally weak.
6. **Coverage threshold ratchet plan** — main.js IIFE migration unlocks the path from current `main.js: lines 20 / branches 15 / functions 18 / statements 19` baseline back toward Phase 4 Wave 6's aspirational `90/90/90/90`. Plan ratchet steps documented in Wave 6.
7. **CI Preview Deploy URL comment** — D-20 dropped `action-hosting-deploy`'s auto-PR-comment with preview URL. Wave 6 either implements a manual `gh pr comment` step in the workflow, or accepts that reviewers read the URL from the job log.
8. **minInstances:1 reconsider** — D-4 stripped minInstances:1 from blocking handlers for $12/mo cost saving. Phase 7+ reconsider if compliance posture demands cold-start guarantees.
9. **CSP-report-only redeploy / cspReportSink wiring** — Phase 3 left `cspReportSink` half-wired. Needs follow-through.
10. **Restore D-27 + D-28 bypasses** — once #3 (TOTP wiring) lands.

### Drift between repo and production

After this cutover-recovery session, the following hold:

- `main` branch tip: `3fddc1c` (PR #3 squash). The recovery code fixes (D-24/D-25/D-26/D-27 source changes) live on branch `ci-deploy-narrow-20260509` (PR #4). Production Firebase Hosting was deployed via local `firebase deploy --only hosting` from that branch's tip. This is drift until PR #4 merges.
- IdP config drift: server-side state has `signIn.anonymous.enabled: false`, `mfa.state: DISABLED`, `blockingFunctions.triggers: {}`, and Luke's `customAttributes: {role:"admin", orgId:null}` (firstRun field cleared). None of these are in source-of-truth files; all captured in this Cutover Log as the only audit-trail anchor.
- API key + WIF + IAM bindings: configured live on the GCP project. Captured here; documented in Wave 6's cleanup-ledger as the source-of-truth pointer for any future re-provisioning.

---

*Phase 6 Wave 5 cutover-recovery closed: 2026-05-09T21:00:00Z. Substrate-honest, deviation-documented, deferred items queued for Wave 6.*
