# Phase 6 Wave 5 — Partial State (Paused)

**Date paused:** 2026-05-09T14:45:00Z
**Reason:** Cutover commit scope blow-up. The runbook over-scoped AUTH-14 (assumed `state-machine.js` had only one export; it has four — three still in active use). Plus BLOCKER-FIX 1 wiring contract (`src/main.js` integration with the Phase 6 router) was deferred from Wave 3 to Wave 5 but never planned in detail. Continuing inline would mean ~60-90 min of high-risk source-code refactor on the largest file in the project; pause-and-replan is the disciplined response.

**Production state:** "strict rules deployed + auth Cloud Functions deployed + admins bootstrapped via Admin SDK (Path B), but Phase 6 UI not yet live (Phase 4 UI still serving)." No live users (PROJECT.md baseline), so no breakage.

---

## What landed in production during Wave 5 (load-bearing)

| Artifact | Status | Mechanism | Evidence |
|---|---|---|---|
| Identity Platform upgrade | ✅ Live | Operator clicked Upgrade in Console | IdP admin v2 GET shows `subtype: IDENTITY_PLATFORM` |
| TOTP MFA provider | ✅ Enabled | Orchestrator PATCHed via IdP admin v2 API (`mfa.providerConfigs[0].totpProviderConfig`) | API GET shows `mfa.state: ENABLED` + `providerConfigs[].totpProviderConfig.adjacentIntervals: 5` |
| SMS-MFA disabled | ✅ Off | Same PATCH set `mfa.enabledProviders: []` | API GET shows empty `enabledProviders` |
| Phase 5 strict `firestore.rules` | ✅ Live | Manual `firebase deploy --only firestore:rules` (3× deploys: deploy, rollback, re-deploy) at T1=2026-05-09T13:52:20Z, T2=13:54:21Z, T3=13:56:45Z | Console verified by operator at each T |
| Phase 5 strict `storage.rules` | ✅ Live | Same as firestore — separate `--only storage` deploys (firebase-tools 15.16.0 quirk: combined `--only firestore:rules,storage:rules` errors) | Console verified |
| `cspReportSink` Cloud Function | ⚠ NOT deployed | Phase 3 deliverable; never landed in production. Likely silent CI failure due to Compute SA missing IAM (now fixed). Out-of-scope of Wave 5 — flag for cleanup-ledger | `gcloud functions list` returned only the 3 new auth handlers |
| `beforeUserCreatedHandler` | ✅ Deployed (degraded) | Cloud Run service ACTIVE in europe-west2; trigger registered in IdP `blockingFunctions.triggers.beforeCreate`; bound `gcp-sa-identitytoolkit@…` to `roles/run.invoker` manually. **`minInstances: 1` STRIPPED at cutover-time per operator decision (cost concern, ~$6-12/mo)** — see deviation log below | `firebase functions:list` shows ACTIVE; manual IAM verified via `gcloud run services get-iam-policy` |
| `beforeUserSignedInHandler` | ✅ Deployed (degraded) | Same as above | Same |
| `setClaims` (callable) | ✅ Deployed | Same path; callable functions don't need special invoker | Same |
| Internal allowlist seeded | ✅ Live | `scripts/seed-internal-allowlist/run.js --verify` (orchestrator-run, ADC) at 2026-05-09T14:19:18Z | Script exit 0; both verify lines `[OK] role=admin` |
| Luke admin user (UID `LQpdqpWqcgVLIE59ln3x8RMf5Mk1`) | ✅ Bootstrapped | Console-create + Admin SDK fixups: `emailVerified=true`, `customClaims = {role: "admin", orgId: null, firstRun: true}`. **CRITICAL: claim was NOT set by `beforeUserCreated` blocking handler** — it was set directly via `setCustomUserClaims` (Path B shortcut) because IdP could not invoke the blocking handler (root cause: `firebaseauth.googleapis.com` API gated by ToS not accepted; `gcp-sa-firebaseauth` SA never auto-provisioned; `firebase-tools` attempts to bind a non-existent SA and fails silently) | Admin SDK `getUser` shows full customClaims |
| George admin user (UID `CZTjcv0mYafO49swTc3P4b6j99W2`) | ✅ Bootstrapped | Same Path B as Luke | Admin SDK `getUser` verified |
| Anonymous Auth provider | ⚠ STILL ENABLED | Cutover Step 7 not yet executed | `signIn.anonymous: {enabled: true}` in IdP admin v2 GET |
| Phase 6 hosting bundle | ❌ NOT deployed | Cutover commit not yet authored/pushed; Phase 4 hosting bundle still serving | `https://baselayers.bedeveloped.com` still renders Phase 4 UI |
| AUTH-14 deletion commit | ❌ NOT landed | Scope blow-up discovered; surgical deletion plan in this doc | Source files unchanged |
| `ci.yml` edit (rules in deploy) | ❌ NOT landed | Bundled with cutover commit | `.github/workflows/ci.yml:189-192` still has `--only hosting,functions` |

---

## Deviation Log (chronological)

### D-1 (T+5 min): Identity Platform tier ambiguity → API verification
Operator initially answered "I don't have Identity Platform" but was already enabling SMS-MFA from a Console toggle that requires IdP. Resolved by querying IdP admin v2 API: `subtype: FIREBASE_AUTH` (legacy tier) confirmed. Operator then ran upgrade.

### D-2 (T+15 min): D-12 substrate gap (rules not in CI deploy)
**Captured in `06-PREFLIGHT.md` "Wave 5 D-12 substrate adjustment" block (commit `c06416f`).** CI deploy in `.github/workflows/ci.yml` only includes `hosting,functions` — Phase 6 plan assumed it included rules. Resolution: cutover commit will edit ci.yml to add `firestore:rules,storage:rules`. Step 1 rehearsal substituted manual local `firebase deploy` for the planned `git revert + push + watch CI` loop. Rehearsal completed successfully — 121s rollback time captured (commit `94def66`).

### D-3 (T+25 min): Combined `--only firestore:rules,storage:rules` errors in firebase-tools 15.16.0
"Could not find rules for the following storage targets: rules". Workaround: split into two deploys, `--only firestore:rules` then `--only storage`. All 3 rehearsal deploys + the final re-deploy used split. **For the cutover commit's CI deploy**, the `--only` should be `hosting,functions,firestore,storage` (note: shorthand without `:rules` suffix) — verify in the cutover commit.

### D-4 (T+35 min): minInstances:1 stripped from blocking handlers (Pitfall 12 mitigation removed)
Cost concern — operator chose to save ~$12/mo. Trade-off: cold-start risk on auth events; if a blocking handler exceeds the 7s deadline, the auth operation fails. Source files updated:
- `functions/src/auth/beforeUserCreated.ts` line 7-12 comment + line 20 options
- `functions/src/auth/beforeUserSignedIn.ts` line 7-9 comment + line 15 options

**Cleanup-ledger row needed (Wave 6):** "Phase 7+ reconsider minInstances:1 on blocking handlers if compliance posture demands it — current decision saves ~$12/mo, accepts cold-start risk, captured 2026-05-09."

### D-5 (T+40 min): Compute default SA missing all IAM bindings (post-Apr-2024 Google IAM hardening)
Cloud Build failed with "missing permission on the build service account" because `76749944951-compute@developer.gserviceaccount.com` had ZERO IAM bindings on the project (Google's newer projects no longer auto-grant `roles/editor` to Compute default SA). Granted: `cloudbuild.builds.builder`, `artifactregistry.writer`, `run.developer`, `logging.logWriter`, `storage.objectViewer`, `iam.serviceAccountUser`. **Captured for project setup notes.**

### D-6 (T+50 min): firebase-tools attempts to bind non-existent `gcp-sa-firebaseauth` SA
firebase-tools 15.16.0 expects 2nd-gen blocking functions to grant `roles/run.invoker` to `service-<projectNumber>@gcp-sa-firebaseauth.iam.gserviceaccount.com`. That SA only auto-provisions when `firebaseauth.googleapis.com` API is enabled, which is gated by a ToS that gcloud cannot accept programmatically (`AUTH_PERMISSION_DENIED` even for project owner). The SA does not exist. firebase-tools' deploy logs "Failed to set the IAM Policy on the Service" and exits non-zero, but the underlying Cloud Run services are correctly created. Workaround: manually bound `service-<projectNumber>@gcp-sa-identitytoolkit.iam.gserviceaccount.com` (which exists post-IdP-upgrade) to `roles/run.invoker` on each blocking handler service.

### D-7 (T+55 min): IdP `blockingFunctions: {}` registration not auto-set by firebase-tools
Even though firebase-tools created the Cloud Run services, it failed to PATCH `blockingFunctions.triggers` in IdP admin v2 config (probably the same IAM-set failure aborted that step). Manually PATCHed `blockingFunctions.triggers.beforeCreate.functionUri` and `.beforeSignIn.functionUri` to the Cloud Run service URLs.

### D-8 (T+65 min): Blocking handler invocations from IdP arrive with empty Authorization header
Cloud Run logs show `WARNING The request was not authenticated. Empty Authorization header value.` for IdP's invocation attempts. Root cause: without `gcp-sa-firebaseauth` SA bound, IdP doesn't have a service-account identity to sign requests with for 2nd-gen blocking functions. The standard fix per Firebase docs is to allow `allUsers` invoker — blocked by org policy `iam.allowedPolicyMemberDomains` (Workspace security default).

**Result:** blocking handlers cannot be invoked end-to-end. `beforeUserCreated` doesn't fire when admins are Console-created → no `role: "admin"` claim auto-set.

### D-9 (T+75 min): Path B chosen for admin bootstrap (Admin SDK direct claim-setting)
Instead of relying on the broken blocking-handler path, used `admin.auth().setCustomUserClaims(uid, {role: "admin", orgId: null, firstRun: true})` directly for both Luke and George. Same end-state for the cutover (admins have role=admin claim in their next ID token). Substrate gap: future user creation (Phase 7+ when coaches/clients onboard) will not auto-claim — Phase 7 must either fix the `gcp-sa-firebaseauth` ToS gate OR use an alternative claim-setting mechanism (e.g., a callable function the new user invokes after creation).

**Cleanup-ledger row needed (Wave 6):** "Phase 7 must resolve the blocking-handler substrate before any non-bootstrap user creation. Options: (a) accept Firebase Auth ToS in Console to enable `firebaseauth.googleapis.com` and re-deploy via firebase-tools to get the correct IAM binding, (b) use a callable claims-setter that new users invoke post-creation (admin-side fan-out via setClaims callable), (c) switch to 1st-gen blocking functions which use a different invocation mechanism."

### D-10 (T+90 min): AUTH-14 scope blow-up
Phase 6 plan assumed `src/auth/state-machine.js` had only `verifyInternalPassword` export. Audit revealed it has FOUR exports, three of which are in active use by client/user passphrase flows (lines 1012, 1033, 4934 in `src/main.js`, and `currentUser()` at 7 sites). Whole-module deletion would break the app. **Surgical scope agreed (option chosen by operator):** delete only `verifyInternalPassword` + supporting infrastructure; keep `currentUser`, `verifyOrgClientPassphrase`, `verifyUserPassword`.

### D-11 (T+95 min): BLOCKER-FIX 1 wiring contract iceberg
Wave 3 plan deferred `src/main.js` rewiring (integration with Phase 6 router + Firebase Auth state hydration) to "Wave 5 wiring contract" — but never specified the contract in detail. Audit revealed: main.js currently has zero imports of the new router, no `onAuthStateChanged` integration, no claims-hydration of `user.appClaims` / `user.appEnrolledFactors`. **The cutover commit cannot ship without this wiring**, but the wiring is non-trivial (main.js is the largest file; render loop is intricate; multiple call sites need updating). Planning gap → pause-and-replan.

---

## Resume plan

When resuming Wave 5:

1. **`/gsd-execute-phase 6 --interactive` or new mini-phase** — recommend opening this with a focused planning step that defines the BLOCKER-FIX 1 wiring contract precisely:
   - What does main.js need to import?
   - Where does `onAuthStateChanged` get wired?
   - What's the hydration contract for `user.appClaims` + `user.appEnrolledFactors`?
   - How does the Phase 6 router's auth-state ladder integrate with main.js's existing render loop?

2. **Plan + execute the cutover commit:**
   - ci.yml edit (rules in deploy)
   - Surgical AUTH-14 deletion (per D-10 scope)
   - BLOCKER-FIX 1 main.js wiring (per the contract defined in step 1)
   - signInAnonymously path deletion (src/firebase/auth.js)
   - firebase-ready bridge listener deletion (src/main.js)
   - .gitleaks.toml `sha256-hex-literal-regression` rule deletion
   - tests/fixtures/auth-passwords.js deletion
   - state-machine.test.js test-case pruning
   - Run `npm test` + `npm run lint` + `npm run typecheck` + `cd functions && npm test` until green
   - Commit + push (atomic per D-04)

3. **CI deploys hosting+functions+rules atomically.** Verify CI green via `gh run watch`.

4. **Step 7 — Anonymous Auth Console-disable** (operator action; ~1 min).

5. **Step 9 — TOTP MFA enrolment** for both admins via the now-live Phase 6 UI (operator + each admin; ~10 min total).

6. **Step 10 — AUTH-10 drill** (both admins, two rounds; ~15 min). George must be online same-session.

7. **Step 11 — SC#4 clock-skew** (operator; ~5 min).

8. **Step 12 — Update `06-PREFLIGHT.md ## Cutover Log`** (orchestrator + operator; ~5 min). Push final cutover log commit.

**Total resume time estimate:** 90-150 min, depending on how complex the BLOCKER-FIX 1 wiring turns out. Best done in a single focused session with George available for Steps 9-10.

---

## Cutover Log (partial — final population at Step 12 of resume)

```
cutover_date_started: 2026-05-09T13:30:00Z
cutover_date_paused: 2026-05-09T14:45:00Z
cutover_date_resumed: <YYYY-MM-DDTHH:MM:SSZ>
cutover_date_completed: <YYYY-MM-DDTHH:MM:SSZ>
cutover_complete: no — paused mid-Wave-5
rehearsal_total_seconds: 121
rehearsal_within_5_min: yes
rehearsal_evidence_path: runbooks/phase6-rules-rollback-rehearsal.md
functions_deploy_p99_cold_start_ms: <not measured — strip-minInstances deviation; deferred to post-resume>
seed_script_output: |
  [OK] internalAllowlist/luke@bedeveloped.com seeded with role=admin
  [OK] internalAllowlist/george@bedeveloped.com seeded with role=admin
  [OK] internalAllowlist/luke@bedeveloped.com verified role=admin
  [OK] internalAllowlist/george@bedeveloped.com verified role=admin
mfa_runtime_check_passed: yes (mfa.state ENABLED + TOTP providerConfigs visible in IdP admin v2 GET)
bootstrap_log_luke_uid: LQpdqpWqcgVLIE59ln3x8RMf5Mk1
bootstrap_log_luke_emailVerified_set_at: 2026-05-09T14:27:00Z
bootstrap_log_luke_first_signin_at: <pending Step 5/9>
bootstrap_log_george_uid: CZTjcv0mYafO49swTc3P4b6j99W2
bootstrap_log_george_emailVerified_set_at: 2026-05-09T14:33:30Z
bootstrap_log_george_first_signin_at: <pending Step 5/9>
admin_signin_claims_verified: |
  luke: { role: "admin", orgId: null, firstRun: true }   # via Admin SDK getUser, not live signin
  george: { role: "admin", orgId: null, firstRun: true } # via Admin SDK getUser, not live signin
admin_signin_claims_verification_method: Admin SDK (Path B) — blocking handler invocation broken (D-6/D-7/D-8/D-9)
rules_deploy_sha: 94def66 (Step 1 rehearsal final re-deploy via local CLI; CI-driven deploy still pending cutover commit)
rules_deploy_console_timestamp: ~14:56:45 BST 2026-05-09 (operator-confirmed)
anon_auth_console_disabled_at: <pending Step 7>
auth14_deletion_sha: <pending cutover commit>
luke_mfa_enrolled_at: <pending Step 9>
george_mfa_enrolled_at: <pending Step 9>
mfa_drill_round_1_total_seconds: <pending Step 10>
mfa_drill_round_2_total_seconds: <pending Step 10>
sc4_clock_skew_passed: <pending Step 11>
oob_credential_delivery_method: <captured post-cutover per D-06>
```

---

*Phase: 06-real-auth-mfa-rules-deploy*
*Wave: 5 (paused mid-execution)*
*Authored: 2026-05-09T14:45:00Z*
