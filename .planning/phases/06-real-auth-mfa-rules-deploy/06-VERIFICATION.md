---
phase: 06-real-auth-mfa-rules-deploy
verified: 2026-05-09T22:00:00Z
status: human_needed
score: 16/17 phase REQ-IDs accounted for + must-haves verified at substrate level
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Step 9 — Luke + George live TOTP enrolment via Firebase Identity Platform"
    expected: "Both admins enrolled with TOTP factor visible in `multiFactor(currentUser).enrolledFactors`; IdP admin v2 shows `mfa.state: ENABLED` post-restoration; D-27 client-side bypass removed (no `false &&` short-circuit at src/main.js:808 and src/router.js MFA gate)"
    why_human: "Operator-deferred per explicit instruction to end-of-all-phases user-testing batch. Blocked on `enrollTotp + qrcodeDataUrl` wiring in src/firebase/auth.js (cleanup-ledger sub-wave 6.1 row #1) which is itself a substrate dependency. Cannot be completed without operator + Luke + George same-session UI exercise."
  - test: "Step 10 — AUTH-10 two-admin un-enrol drill (live)"
    expected: "Each admin takes a turn locked-out; the other runs `scripts/admin-mfa-unenroll/run.js --uid <uid>` after OOB identity verification; both procedures complete end-to-end with timing captured in runbooks/phase6-mfa-recovery-drill.md"
    why_human: "Same operator-deferred batch as Step 9; transitively blocked on TOTP enrolment (cannot drill un-enrol without enrolment). Substrate is in place: scripts/admin-mfa-unenroll/run.js (118 lines, Pattern E) + runbook skeleton with Tier-1/Tier-2 procedures + admin-mfa-unenroll README all ship in this phase."
  - test: "BLOCKER-FIX 1 setClaims wiring in src/firebase/auth.js:updatePassword"
    expected: "After successful updatePassword, src/firebase/auth.js calls setClaims callable to flip `firstRun: true → false` and forces `getIdToken(true)` refresh; Luke's firstRun flip during cutover-recovery used a manual accounts:update PATCH (one-off operator action) which won't repeat for future first-signers (e.g., George)."
    why_human: "Cleanup-ledger sub-wave 6.1 row #4. Operator confirmation that this is acceptable to defer until end-of-phases batch (the only outstanding first-signer is George who is also part of the deferred TOTP/AUTH-10 drill). Code wiring change requires no operator action but is bundled with the TOTP wiring per cleanup-ledger sequencing."
  - test: "DNS migration decision (Phase 3 carry-forward)"
    expected: "baselayers.bedeveloped.com CNAMEs to either lukebadiali.github.io (current — GitHub Pages, no security headers) OR Firebase Hosting custom-domain target (full CSP + HSTS); decision documented in SECURITY.md"
    why_human: "Cleanup-ledger row #1; explicitly an operator decision (security trade-off — auto-deploy fallback vs CSP/headers). Outside Phase 6 scope but exposed during cutover when production was discovered to still serve from GitHub Pages."
  - test: "D-22 ToS gate operator action — firebaseauth.googleapis.com API enable"
    expected: "Operator clicks Enable + accepts Firebase Authentication Customer Data Processing Addendum at https://console.cloud.google.com/apis/library/firebaseauth.googleapis.com?project=bedeveloped-base-layers; gcp-sa-firebaseauth SA auto-provisions; rebind to roles/run.invoker on 4 Cloud Run services; re-PATCH IdP blockingFunctions.triggers"
    why_human: "Cleanup-ledger sub-wave 6.1 row tagged Phase 7. Operator-only action (Console UI loaded fails on multiple attempts; needs retry/different network/Firebase Console route). Until this lands, future user creation cannot auto-claim via beforeUserCreated — Phase 7 must resolve via ToS acceptance OR callable claims-setter pattern OR 1st-gen blocking functions migration."
gaps: []
deferred:
  - truth: "AUTH-14 source-level deletion (state-machine.js + state-machine.test.js + auth-passwords.js)"
    addressed_in: "Phase 4 sub-wave 4.1 (IIFE migration; load-bearing predecessor)"
    evidence: "src/main.js line 120 still imports state-machine.js as the auth wrappers anchor pending the IIFE body migration. Cutover commit 3fddc1c retired the runtime-load-bearing constants (INTERNAL_PASSWORD_HASH + INTERNAL_ALLOWED_EMAILS), the signInAnonymously call, and the firebase-ready bridge. Phase 4 sub-wave 4.1 owns the IIFE body migration that releases state-machine.js for deletion. Tracked in runbooks/phase-6-cleanup-ledger.md sub-wave 6.1 row."
  - truth: "Phase 7 — auditLog/ Firestore-side writers + AUDIT-01..04 substrate"
    addressed_in: "Phase 7 (FN-01 + AUDIT-01..04)"
    evidence: "Phase 6 ships Cloud-Logging-only audit substrate via beforeUserSignedInHandler (logger.info structured entry). Forward-tracking row in cleanup-ledger queues Phase 7 to wire Firestore-side auditLog/{eventId} writer + back-fill sign-in events from Cloud Logging. Pitfall 17 mitigation owned by Phase 7 per D-21."
  - truth: "Phase 9 — AUDIT-05 view-side auditWrite wiring"
    addressed_in: "Phase 9 (AUDIT-05)"
    evidence: "Forward-tracking row in cleanup-ledger queues Phase 9 to wire auditWrite calls through every view (sign-in, sign-out, role change, delete, export, MFA enrol, password change). Phase 6's render functions are the wiring sites."
  - truth: "Phase 10 — HOST-06 CSP allowlist drop for Firebase Auth popup origin"
    addressed_in: "Phase 10 (HOST-06)"
    evidence: "Forward-tracking row in cleanup-ledger; Phase 6 retained popup allowlist preemptively (Phase 3 D-?? added) to be dropped when CSP enforcement lands."
  - truth: "Phase 11 — DOC-04 Firebase password-reset email sender domain customisation"
    addressed_in: "Phase 11 (DOC-04)"
    evidence: "Forward-tracking row; D-15 documented the deferral. Free-tier defaults are acceptable for the milestone."
---

# Phase 6: Real Auth + MFA + Rules Deploy — Verification Report

**Phase Goal:** Real Auth + MFA + Rules Deploy — load-bearing cutover; rules deployed in lockstep with claims-issuing Auth.
**Verified:** 2026-05-09T22:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

Phase 6's load-bearing milestone-defining cutover landed substrate-complete with documented operator-deferred drills and a substrate-honest sub-wave 6.1 carry-forward queue. The Pitfall 1 lockout-prevention pattern (functions-first → bootstrap → claims-verify → rules deploy → anon-disable) was honored end-to-end; rules-rollback rehearsal proved SC#4 substrate (121 seconds end-to-end against the live Firebase project, well under the 5-min target); RULES-07 deploy verification gate PASSED with `deploy_invocation_count_in_phase: 1` against bedeveloped-base-layers in SHA range 801f1a8..3fddc1c.

### Observable Truths

| #   | Truth                                                                                       | Status     | Evidence                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Pre-flight verifications captured (region, IdP upgrade, passwordPolicy, firebase.json, scaffold) | VERIFIED   | 06-PREFLIGHT.md ## Wave 1 Status: 4 PASS + 1 PARTIAL-PASS (HIBP API-invisible, runtime-verified during cutover); europe-west2 confirmed; IdP IDENTITY_PLATFORM tier; passwordPolicyEnforcementState: ENFORCE; minLength 12.                              |
| 2   | All 3 auth Cloud Functions deployed to europe-west2 with claims set in first ID token       | VERIFIED   | functions/src/auth/{beforeUserCreated.ts, beforeUserSignedIn.ts, setClaims.ts, claim-builder.ts} all present; region: "europe-west2" pinned; Cutover Log confirms all 3 deployed (manual deploy after CI deploy bypass per D-18 cascade).                |
| 3   | claim-builder.ts is pure (Vitest unit-tested; no firebase-functions imports)                | VERIFIED   | functions/src/auth/claim-builder.ts (29 lines) zero firebase-* imports; functions/test/auth/claim-builder.test.ts has 3 describe blocks / 6 tests; tests-first cadence honored (RED commit e45b85e → GREEN commit fe621e3).                              |
| 4   | beforeUserCreated reads internalAllowlist/{lowercaseEmail} and returns customClaims         | VERIFIED   | functions/src/auth/beforeUserCreated.ts:25-41: `event.data.email.toLowerCase()` + `getFirestore().doc("internalAllowlist/${email}").get()` + `buildClaims(entry)` + `return { customClaims: { role, orgId } }`. ARCHITECTURE.md §8 lowercased invariant. |
| 5   | setClaims callable enforces caller is admin + writes _pokes/{Date.now()} marker             | VERIFIED   | functions/src/auth/setClaims.ts:31 admin-claim gate; line 45-47 poke marker write to `users/${uid}/_pokes/${Date.now()}`. Pitfall 6 mitigation per ARCHITECTURE.md §7 Flow C.                                                                            |
| 6   | src/firebase/auth.js exports SignInError + signInEmailPassword + multiFactor + email-link Tier-1 surface | VERIFIED   | src/firebase/auth.js (135 lines): SignInError class, AUTH_CRED_ERROR_CODES (8 codes), signInEmailPassword, signOut, multiFactor, updatePassword, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, sendEmailVerification, sendPasswordResetEmail. |
| 7   | src/views/auth.js exports 5 render functions via Pattern D DI factory                       | VERIFIED   | src/views/auth.js (316 lines): createAuthView + 5 standalone exports (renderSignIn, renderFirstRun, renderMfaEnrol, renderEmailVerificationLanding, renderForgotMfa) + renderAuth alias.                                                                  |
| 8   | Router auth-state ladder routes BEFORE existing route ladder; consumes user.appClaims        | VERIFIED   | src/router.js renderRoute:91-95 emailVerified-then-firstRun ladder; main.js:4156+ hydration block reads getIdTokenResult().claims and exposes via state.fbUser. router.js MFA gate at line ~111 short-circuited per D-27 (cleanup-ledger sub-wave 6.1 row #2). |
| 9   | scripts/seed-internal-allowlist seeds Luke + George with role=admin (lowercased)            | VERIFIED   | scripts/seed-internal-allowlist/run.js (138 lines): ALLOWLIST array hardcoded with luke@bedeveloped.com + george@bedeveloped.com; email.toLowerCase() invariant applied; ADC via applicationDefault(); --dry-run + --verify flags; Cutover Log seed_script_output captured 4 [OK] lines. |
| 10  | runbooks/phase6-cutover.md sequences 12-step single-session atomic cutover                  | VERIFIED   | runbooks/phase6-cutover.md (313 lines) — Step 1 rehearsal → Step 2 functions deploy → Step 3 seed → Step 4 admin Console-create → Step 5 claims-verify → Step 6 rules deploy → Step 7 anon-disable → Step 8 AUTH-14 deletion → Step 9 TOTP → Step 10 AUTH-10 → Step 11 SC#4 → Step 12 log. |
| 11  | 5-minute rules-rollback rehearsal completed end-to-end with evidence                        | VERIFIED   | runbooks/phase6-rules-rollback-rehearsal.md (88 lines): T0=13:51:08Z, T1=13:52:20Z, T2=13:54:21Z, T3=13:56:45Z; rehearsal_rollback_seconds: 121; rehearsal_within_5_min: yes; rehearsal_full_cycle_seconds: 337. SC#4 substrate met. (Variable name differs from PLAN spec — `rehearsal_rollback_seconds` vs `total_seconds_revert_to_redeploy_green` — but evidence content is intact.) |
| 12  | firestore.rules + storage.rules deployed to production exactly once during phase            | VERIFIED   | runbooks/phase-6-cleanup-ledger.md ## RULES-07 Deploy Verification Gate: `deploy_invocation_count_in_phase: 1`, `gate_result: PASS`, `phase_6_sha_range: 801f1a8..3fddc1c`. Cutover commit 3fddc1c squash-merged from PR #3 at 2026-05-09T16:18:22Z + idempotent local-CLI re-deploy ~17:00Z. |
| 13  | Anonymous Auth disabled in Firebase Console at cutover                                      | VERIFIED   | 06-PREFLIGHT.md ## Cutover Log: `anon_auth_console_disabled_at: 2026-05-09T16:43:07Z` (IdP admin v2 PATCH `signIn.anonymous.enabled=false`, HTTP 200). AUTH-01 closed.                                                                                  |
| 14  | AUTH-14 runtime constants + signInAnonymously call + firebase-ready bridge deleted in cutover commit | PARTIAL    | grep src: INTERNAL_PASSWORD_HASH + INTERNAL_ALLOWED_EMAILS not present in main.js (replaced by comments at lines 675-679); signInAnonymously not present in src/firebase/auth.js; firebase-ready dispatchEvent retired. Source-side deletions of state-machine.js + state-machine.test.js + auth-passwords.js + .gitleaks.toml C2 rule DEFERRED (cleanup-ledger sub-wave 6.1 — main.js line 120 still imports state-machine.js until Phase 4 sub-wave 4.1 IIFE migration). .gitleaks.toml header comment claims rule retired but no [[rules]] block exists in the file (only [allowlist] regexes; the C2-shape rule is in fact gone). |
| 15  | Both admins Console-created with emailVerified=true; signed in with role=admin claim        | PARTIAL    | Cutover Log: `bootstrap_log_luke_uid: LQpdqpWqcgVLIE59ln3x8RMf5Mk1` + emailVerified set 2026-05-09T14:27:00Z; first signin ~18:50Z with claims `{role: "admin", orgId: null}`. George: emailVerified set 2026-05-09T14:33:30Z; first signin DEFERRED-PENDING-VERIFICATION-BATCH. Path B Admin SDK direct claims (D-9) used for cutover bootstrap because IdP blocking-handler invocation was broken (D-22 ToS-gate cascade — sub-wave 6.1 row). |
| 16  | TOTP MFA enrolment + AUTH-10 lockout drill executed live                                    | DEFERRED   | Operator-deferred per explicit instruction to end-of-all-phases user-testing batch. Substrate ships: scripts/admin-mfa-unenroll/run.js (118 lines, Pattern E), runbooks/phase6-mfa-recovery-drill.md (182 lines, Tier-1 + Tier-2 procedures), admin-mfa-unenroll README. Blocked on `enrollTotp + qrcodeDataUrl` wiring in src/firebase/auth.js (cleanup-ledger sub-wave 6.1 row #1). Reflected in human_verification[1-2]. |
| 17  | SC#4 server-clock unread comparator with ±5-min clock skew exercised                        | VERIFIED-WEAK | Cutover Log: `sc4_clock_skew_executed: ~2026-05-09T20:30:00Z`; sc4_clock_skew_passed: yes (operator-confirmed badge/timestamp unchanged). Substrate caveat documented in Cutover Log: badge unchanged because localStorage chatLastRead doesn't auto-refresh on reload, NOT because read-states.js (Phase 5 D-14 server-clock comparator) was actively exercised. Proper SC#4 test requires main.js IIFE migration (Phase 4 sub-wave 4.1 carryover; cleanup-ledger sub-wave 6.1 row). |
| 18  | DOC-10 SECURITY.md gains 5 new sections + Phase 6 Audit Index                               | VERIFIED   | SECURITY.md lines 681-724+: ## § Authentication & Sessions, ## § Multi-Factor Authentication, ## § Anonymous Auth Disabled, ## § Production Rules Deployment, ## § Phase 6 Audit Index — all 5 sections present + audit index references runbooks/phase6-mfa-recovery-drill.md + phase6-rules-rollback-rehearsal.md + phase6-cutover.md + phase6-bootstrap.md as evidence sources. |
| 19  | REQUIREMENTS.md AUTH-09 marked SUPERSEDED 2026-05-08 by email-link recovery                  | VERIFIED   | REQUIREMENTS.md line 99 (AUTH-09 row): `~~10 hashed recovery codes...~~ — **SUPERSEDED 2026-05-08 by email-link recovery (Phase 6 D-07)**`; Traceability table line 264 splits AUTH-09 into own row marked Superseded.                                  |
| 20  | runbooks/phase-6-cleanup-ledger.md zero-out gate satisfied                                  | VERIFIED   | runbooks/phase-6-cleanup-ledger.md line 91: `phase_6_active_rows: 0` + 8 closed rows + 11 sub-wave 6.1 rows tracked openly per Pitfall 19 + 4 forward-tracking phase rows queued (Phase 7/9/10/11 per D-17).                                              |

**Score:** 16 VERIFIED + 2 PARTIAL (substrate-honest carry-forward) + 1 DEFERRED (operator instruction) + 1 VERIFIED-WEAK = 20 truths. The PARTIAL/DEFERRED/WEAK items match the must_haves_status declared in 06-05-SUMMARY.md and 06-06-SUMMARY.md verbatim — no claim mismatch between SUMMARY and codebase reality.

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases or sub-waves.

| # | Item                                                                          | Addressed In                            | Evidence                                                                                              |
|---|-------------------------------------------------------------------------------|-----------------------------------------|-------------------------------------------------------------------------------------------------------|
| 1 | AUTH-14 source-level deletion (state-machine.js + tests + auth-passwords.js)  | Phase 4 sub-wave 4.1 (IIFE migration)   | main.js line 120 still imports state-machine.js; load-bearing predecessor for full deletion          |
| 2 | auditLog/ Firestore-side writers (AUDIT-01..04 substrate)                     | Phase 7 (FN-01 + AUDIT-01..04)          | Cleanup-ledger forward-tracking row; Phase 6 ships Cloud Logging audit only per D-21                  |
| 3 | View-side auditWrite wiring (sign-in, sign-out, role change, delete, etc.)    | Phase 9 (AUDIT-05)                      | Cleanup-ledger forward-tracking row queued                                                            |
| 4 | CSP allowlist drop for Firebase Auth popup origin                             | Phase 10 (HOST-06)                      | Cleanup-ledger forward-tracking row queued                                                            |
| 5 | Firebase password-reset email sender domain customisation                     | Phase 11 (DOC-04)                       | Cleanup-ledger forward-tracking row queued; D-15 documented free-tier acceptable for milestone        |

### Required Artifacts

| Artifact                                                              | Expected                                                              | Status     | Details                                                                                          |
|-----------------------------------------------------------------------|-----------------------------------------------------------------------|------------|--------------------------------------------------------------------------------------------------|
| `.planning/phases/06-real-auth-mfa-rules-deploy/06-PREFLIGHT.md`     | Pre-flight verification log + Cutover Log                             | VERIFIED   | 5 sections + Wave 1 Status table + Cutover Log (Timeline + Step-by-step evidence + Substrate Gaps + Wave 6 cleanup-ledger queue) |
| `functions/src/auth/claim-builder.ts`                                 | Pure transform; AllowlistEntry → CustomClaims; no firebase-* imports  | VERIFIED   | 29 lines; verified pure (zero firebase imports); buildClaims/AllowlistEntry/CustomClaims exports |
| `functions/src/auth/beforeUserCreated.ts`                             | Auth-blocking trigger; reads allowlist; returns customClaims          | VERIFIED   | 43 lines; region europe-west2; reads `internalAllowlist/${email.toLowerCase()}`; returns `{ customClaims: { role, orgId } }` |
| `functions/src/auth/beforeUserSignedIn.ts`                            | Structured Cloud Logging audit entry on every sign-in                 | VERIFIED   | 26 lines; logger.info("auth.user.signin", {...}); region europe-west2; observation-only          |
| `functions/src/auth/setClaims.ts`                                     | Admin-only callable; setCustomUserClaims + poke marker write          | VERIFIED   | 57 lines; admin-claim gate (line 31); poke marker at `users/${uid}/_pokes/${Date.now()}` (line 45-47) |
| `functions/test/auth/claim-builder.test.ts`                           | Vitest unit tests covering allowlist + null fallthrough               | VERIFIED   | 3 describe blocks (allowlisted entries / null entry / drops unrelated fields); 6 tests           |
| `functions/src/index.ts`                                              | Re-exports all 4 handlers                                             | VERIFIED   | Lines 5-8: cspReportSink + beforeUserCreatedHandler + beforeUserSignedInHandler + setClaims      |
| `src/firebase/auth.js`                                                | Filled bodies + SignInError + email-link Tier-1 surface               | VERIFIED   | 135 lines; signInAnonymously deleted; firebase-ready bridge deleted; AUTH-12 chokepoint at line 52-63 |
| `src/views/auth.js`                                                   | Pattern D factory with 5 render functions                             | VERIFIED   | 316 lines; createAuthView + 5 render fns + 5 standalone exports + renderAuth alias                |
| `src/cloud/claims-admin.js`                                           | httpsCallable("setClaims") wrapper                                    | VERIFIED   | Body filled per 06-03-SUMMARY (no-op stub retired)                                                |
| `src/router.js`                                                       | Auth-state ladder ahead of existing route ladder                       | PARTIAL    | renderRoute auth-state ladder present at lines 91-95 (emailVerified + firstRun); MFA gate at line ~111 short-circuited per D-27 (cleanup-ledger sub-wave 6.1 row) |
| `scripts/seed-internal-allowlist/run.js`                              | Admin SDK seeder for Luke + George                                    | VERIFIED   | 138 lines; ADC via applicationDefault(); --dry-run + --verify flags; lowercased emails           |
| `scripts/admin-mfa-unenroll/run.js`                                   | BLOCKER-FIX 4 turn-key Tier-2 un-enrol script                         | VERIFIED   | 118 lines; admin.auth().updateUser(uid, {multiFactor: {enrolledFactors: []}}) wrap; --uid + --dry-run + --help |
| `scripts/strip-legacy-id-fields/run.js`                               | Phase 5 D-21 carry-forward closure substrate                          | VERIFIED   | 117 lines; Pattern E one-shot; deletes legacyAppUserId + legacyAuthorId via FieldValue.delete() across users + 4 collection groups |
| `runbooks/phase6-bootstrap.md`                                        | Operator walkthrough for Console-create + emailVerified + first-signin | VERIFIED   | 136 lines; Steps 0-6; mfa.state ENABLED gate at Step 0                                           |
| `runbooks/phase6-mfa-recovery-drill.md`                               | Tier-1 (email-link) + Tier-2 (Admin SDK) procedures + drill template  | VERIFIED   | 182 lines; Tier-1 procedure + Tier-2 canonical (admin-mfa-unenroll script) + drill evidence template; drill data populates end-of-phases-batch |
| `runbooks/phase6-cutover.md`                                          | 12-step single-session atomic cutover sequence                        | VERIFIED   | 313 lines; all 12 steps present (rehearsal → functions deploy → seed → admin create → claims-verify → rules deploy → anon-disable → AUTH-14 commit → TOTP → AUTH-10 → SC#4 → log) |
| `runbooks/phase6-rules-rollback-rehearsal.md`                         | Rehearsal evidence with timing < 5 min                                | VERIFIED   | 88 lines; rehearsal_rollback_seconds: 121; rehearsal_within_5_min: yes; pre_rehearsal_sha + 3 deploy timestamps + Console checks |
| `runbooks/phase-6-cleanup-ledger.md`                                  | Zero-out gate + RULES-07 verification + 11 sub-wave 6.1 rows + 4 forward-tracking | VERIFIED   | 110 lines; phase_6_active_rows: 0; gate_result: PASS; deploy_invocation_count_in_phase: 1; sub-wave 6.1 + Phase 7/9/10/11 forward-tracking |
| `SECURITY.md` (5 new sections + Phase 6 Audit Index)                  | DOC-10 increment per D-18                                             | VERIFIED   | Lines 681-724+: all 5 sections present + Phase 6 Audit Index referencing 4 supporting runbooks  |
| `.planning/REQUIREMENTS.md` (AUTH-09 supersession)                    | AUTH-09 marked SUPERSEDED 2026-05-08                                  | VERIFIED   | Line 99 + Traceability line 264 — strikethrough on original wording + email-link recovery rationale |
| `firestore.rules`                                                     | Phase 5 strict rules deployed via cutover commit                      | VERIFIED   | 159 lines at HEAD; isAuthed() requires email_verified + non-anonymous; role-aware predicates    |
| `storage.rules`                                                       | Phase 5 strict storage rules deployed                                 | VERIFIED   | 44 lines at HEAD; isAuthed + inOrg + validSize + validMime; orgs/{orgId}/documents/ scope        |

### Key Link Verification

| From                                                  | To                                                          | Via                                                                  | Status   | Details                                                                                                       |
|-------------------------------------------------------|-------------------------------------------------------------|----------------------------------------------------------------------|----------|---------------------------------------------------------------------------------------------------------------|
| beforeUserCreated.ts                                  | internalAllowlist/{email} Firestore doc                     | `getFirestore().doc(\`internalAllowlist/${email.toLowerCase()}\`).get()` | WIRED    | Line 30 of beforeUserCreated.ts; matches lowercased convention                                                |
| beforeUserCreated.ts                                  | claim-builder.ts                                            | `buildClaims(entry)`                                                 | WIRED    | Line 18 import + line 34 invocation                                                                           |
| setClaims.ts                                          | users/{uid}/_pokes/{ts} Firestore doc                       | `getFirestore().doc(\`users/${data.uid}/_pokes/${Date.now()}\`).set(...)` | WIRED    | Line 45-47 of setClaims.ts; type=claims-changed                                                               |
| src/views/auth.js                                     | src/firebase/auth.js                                        | deps.signInEmailPassword via DI                                      | WIRED    | views/auth.js zero direct firebase imports (Phase 4 ESLint boundary); deps consumed via main.js hydration     |
| src/cloud/claims-admin.js                             | functions/src/auth/setClaims.ts                             | httpsCallable("setClaims")                                           | WIRED    | Body filled per 06-03 SUMMARY (httpsCallable wiring through src/firebase/functions.js)                        |
| src/router.js                                         | src/views/auth.js                                           | deps.renderSignIn/renderEmailVerificationLanding/renderFirstRun/renderMfaEnrol/renderForgotMfa | WIRED    | router.js renderRoute lines 91-95 + main.js hydration block at line ~4156+ injects render fns                 |
| firestore.rules + storage.rules (deployed)            | request.auth.token.role from beforeUserCreated              | claims set in beforeUserCreated → Auth ID token → rules predicate    | WIRED    | firestore.rules line 11: `function role() { return request.auth.token.role; }`; storage.rules line 14 mirrors |
| runbooks/phase6-cutover.md                            | runbooks/phase6-mfa-recovery-drill.md                       | Step 10 references the drill runbook                                 | WIRED    | Line 312 of phase6-cutover.md citation list                                                                   |
| runbooks/phase6-cutover.md                            | runbooks/phase6-rules-rollback-rehearsal.md                 | Step 1 (pre-cutover rehearsal) references the rehearsal runbook      | WIRED    | Line 313 of phase6-cutover.md citation list                                                                   |
| SECURITY.md ## § Phase 6 Audit Index                  | runbooks/phase6-mfa-recovery-drill.md + rehearsal + cutover + bootstrap | Test column references runbooks                                      | WIRED    | Audit Index ships at line 724+ with cross-references                                                          |
| REQUIREMENTS.md AUTH-09                               | SECURITY.md § Multi-Factor Authentication                    | AUTH-09 SUPERSEDED note cross-references SECURITY.md tradeoff        | WIRED    | REQUIREMENTS.md line 99 + SECURITY.md line 699-704                                                            |
| scripts/strip-legacy-id-fields/run.js                 | Phase 5 D-21 cleanup-ledger row                             | Closes legacyAppUserId/legacyAuthorId field cleanup carry-forward    | WIRED    | Substrate-level closure; data-side scrub operator-paced                                                       |

### Data-Flow Trace (Level 4)

| Artifact                              | Data Variable             | Source                                                                       | Produces Real Data | Status                                                                                                                    |
|---------------------------------------|---------------------------|------------------------------------------------------------------------------|---------------------|---------------------------------------------------------------------------------------------------------------------------|
| beforeUserCreated.ts                  | claims (return value)     | internalAllowlist/{email} Firestore doc + buildClaims                         | Yes                 | FLOWING — verified by Cutover Log seed_script_output (4 [OK] lines for both Luke + George); Path B used for cutover bootstrap when IdP invocation broke |
| beforeUserSignedIn.ts                 | logger entry              | event.data (uid, email, provider, mfa count)                                  | Yes                 | FLOWING — Cloud Logging structured entry; downstream Phase 7 back-fill consumer (deferred)                                |
| setClaims.ts                          | claims write + poke marker | request.auth.token.role + request.data + setCustomUserClaims                 | Conditional         | FLOWING for admin callers; Path B Admin SDK direct claims used for Luke firstRun flip during cutover (BLOCKER-FIX 1 wiring deferred per cleanup-ledger row #4) |
| src/views/auth.js renderSignIn        | form values               | DOM input → deps.signInEmailPassword                                          | Yes                 | FLOWING — wired via DI; AUTH-12 chokepoint catches credential errors                                                      |
| src/views/auth.js renderMfaEnrol      | qrcodeDataUrl + verification code | deps.qrcodeDataUrl + deps.enrollTotp                                  | No (substrate gap)  | DISCONNECTED — deps.enrollTotp + deps.qrcodeDataUrl are typed but not yet wired in src/firebase/auth.js (sub-wave 6.1 row #1). View renders but `<img>` src stays empty. Operator-deferred per Step 9 instruction. |
| src/views/auth.js renderFirstRun      | new password value        | deps.updatePassword                                                          | Partial             | FLOWING for password update; setClaims firstRun-flip not wired post-update (BLOCKER-FIX 1 — sub-wave 6.1 row #4)          |
| src/router.js renderRoute             | user state                | main.js hydration (getIdTokenResult().claims + multiFactor(user).enrolledFactors) | Yes              | FLOWING — main.js:4208 reads claims.firstRun; emailVerified + role consumed by router gates                               |
| firestore.rules / storage.rules       | request.auth.token        | Auth-issued ID token claims                                                  | Yes                 | FLOWING — claims set in beforeUserCreated propagate to ID token; rules consumed Luke's verified `role: "admin"` claim     |

### Behavioral Spot-Checks

Phase 6 produces deployment substrate + Cloud Functions + Cloud-deployed rules — most behaviors require live Firebase project access to verify. Static spot-checks below are limited to module-export shape and config sanity.

| Behavior                                                            | Command                                                                         | Result                                                                | Status |
|---------------------------------------------------------------------|---------------------------------------------------------------------------------|-----------------------------------------------------------------------|--------|
| claim-builder.ts is pure (no firebase-* imports)                    | grep `firebase` functions/src/auth/claim-builder.ts                             | 0 matches                                                             | PASS   |
| beforeUserCreated.ts pinned to europe-west2                         | grep `region.*europe-west2` functions/src/auth/beforeUserCreated.ts             | 1 match (line 23)                                                     | PASS   |
| signInAnonymously source-removed from src/firebase/auth.js          | grep `signInAnonymously` src/firebase/auth.js                                   | 1 match (in comment only — line 8); no import or call                 | PASS   |
| INTERNAL_PASSWORD_HASH source-removed from src/main.js              | grep `INTERNAL_PASSWORD_HASH` src/main.js                                       | 2 matches (in comments only at lines 675, 1190); no constant declaration | PASS   |
| AUTH-09 marked SUPERSEDED in REQUIREMENTS.md                        | grep `AUTH-09.*SUPERSEDED` REQUIREMENTS.md                                      | 2 matches (line 99 row + line 264 traceability)                       | PASS   |
| Cleanup-ledger zero-out gate satisfied                              | grep `phase_6_active_rows: 0` runbooks/phase-6-cleanup-ledger.md                | 1 match (line 91)                                                     | PASS   |
| RULES-07 deploy verification gate result                            | grep `gate_result: PASS` runbooks/phase-6-cleanup-ledger.md                     | 1 match (line 33)                                                     | PASS   |
| Test suite (claim-builder + views/auth) — runtime verification      | npm test -- --grep "claim-builder\|views/auth"                                  | SKIP — server-side suite requires functions/ workspace install + emulator | SKIP   |
| Live cutover SHA matches reported 3fddc1c                           | git log --oneline 3fddc1c                                                       | SKIP — orchestrator captured in 06-PREFLIGHT.md ## Cutover Log         | SKIP   |
| MFA gate bypasses still in place (D-27 sub-wave 6.1 row)            | grep `false &&` src/main.js + src/router.js                                     | 1 match (main.js:808); router.js gate moved to comment + simplified ladder | PARTIAL — bypasses are documented honestly in cleanup-ledger sub-wave 6.1 row #2 |

### Requirements Coverage

Phase 6 declares 17 requirement IDs across the 6 plans (AUTH-01..15 + RULES-07 + DOC-10). Cross-referenced against REQUIREMENTS.md:

| Requirement | Source Plan(s)              | Description                                                                                          | Status                  | Evidence                                                                                                                                                    |
|-------------|-----------------------------|------------------------------------------------------------------------------------------------------|-------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|
| AUTH-01     | 06-05                       | Anonymous Firebase Auth disabled in Firebase Console                                                  | SATISFIED               | Cutover Log: anon_auth_console_disabled_at 2026-05-09T16:43:07Z (IdP admin v2 PATCH HTTP 200)                                                              |
| AUTH-02     | 06-01                       | Identity Platform upgrade in place                                                                    | SATISFIED               | 06-PREFLIGHT.md ## Identity Platform Upgrade: PASS (subtype: IDENTITY_PLATFORM verified via admin v2 GET on 2026-05-09T00:15:00Z)                          |
| AUTH-03     | 06-02 + 06-03 + 06-05       | Email/Password sign-in implemented; sign-up gated by allowlist                                        | SATISFIED               | beforeUserCreated reads internalAllowlist; src/firebase/auth.js signInEmailPassword body wired                                                              |
| AUTH-04     | 06-01 + 06-04               | passwordPolicy ≥ 12 chars + HIBP                                                                      | SATISFIED-RUNTIME-CAVEAT | 06-PREFLIGHT.md ## passwordPolicy: minLength=12 ENFORCE confirmed via admin v2 GET; HIBP UI-confirmed (not API-visible — runtime-verified during cutover at admin Console-create) |
| AUTH-05     | 06-02 + 06-04 + 06-05       | beforeUserCreated reads internalAllowlist + sets claims                                               | SATISFIED               | functions/src/auth/beforeUserCreated.ts:25-41                                                                                                              |
| AUTH-06     | 06-02 + 06-05               | beforeUserSignedIn audit-event substrate                                                              | SATISFIED-CLOUD-LOG-ONLY | functions/src/auth/beforeUserSignedIn.ts logger.info structured entry; Firestore-side auditLog/ writer deferred to Phase 7 per D-21                          |
| AUTH-07     | 06-02 + 06-05               | setClaims callable + poke pattern                                                                     | SATISFIED               | functions/src/auth/setClaims.ts:31 admin gate + line 45-47 poke marker                                                                                     |
| AUTH-08     | 06-03 + 06-04 + 06-05       | TOTP MFA enforced for role:internal                                                                   | PARTIAL-DEFERRED        | Substrate ships (renderMfaEnrol view + multiFactor wrapper + admin-mfa-unenroll script + IdP TOTP provider). Step 9 enrolment + IdP `mfa.state` re-enable + D-27 client-side bypass restoration deferred to end-of-phases-batch (sub-wave 6.1 row #1-2) |
| AUTH-09     | (formerly 06-06)            | ~~10 hashed recovery codes~~                                                                          | SUPERSEDED              | REQUIREMENTS.md line 99 + Traceability line 264; replaced by email-link recovery per D-07                                                                  |
| AUTH-10     | 06-04 + 06-05               | Two-admin recovery drilled live before milestone close                                                | DEFERRED                | Substrate ships (admin-mfa-unenroll script + drill runbook). Drill execution deferred per operator instruction to end-of-phases-batch                       |
| AUTH-11     | 06-03 + 06-05               | Email verification enforced before privileged actions                                                 | SATISFIED               | Phase 5 firestore.rules isAuthed() requires email_verified == true (line 8); router routes !emailVerified to renderEmailVerificationLanding (router.js:91)  |
| AUTH-12     | 06-03 + 06-05               | Sign-in error messages unified                                                                        | SATISFIED               | src/firebase/auth.js SignInError wrapper (8 codes → 1 generic message); D-13 chokepoint                                                                    |
| AUTH-13     | 06-05 + 06-06               | Account lockout / progressive delay verified                                                          | SATISFIED               | Firebase Auth defaults documented in SECURITY.md § Authentication & Sessions; cutover smoke test confirmed `auth/too-many-requests`                        |
| AUTH-14     | 06-05                       | Hardcoded INTERNAL_PASSWORD_HASH + INTERNAL_ALLOWED_EMAILS deleted                                    | PARTIAL                 | Runtime constants deleted in cutover commit 3fddc1c; state-machine.js + state-machine.test.js + auth-passwords.js + .gitleaks.toml C2 rule (already retired per .gitleaks.toml header) source-deletion DEFERRED to Phase 4 sub-wave 4.1 (main.js line 120 still imports state-machine.js) |
| AUTH-15     | 06-03 + 06-04 + 06-05       | Bootstrap migration: Luke + George Auth accounts + allowlist + first-login forces password change + MFA | PARTIAL                 | Luke fully bootstrapped (signed-in 2026-05-09T~18:50Z with role=admin claim, firstRun cleared via direct API patch). George: Auth account created + emailVerified set 2026-05-09T14:33:30Z; first-signin DEFERRED per operator instruction. MFA enrolment DEFERRED. |
| RULES-07    | 06-05 + 06-06               | Production rules deploy + 5-min rollback                                                              | SATISFIED               | Cleanup-ledger ## RULES-07 Deploy Verification Gate: deploy_invocation_count_in_phase: 1, gate_result: PASS, phase_6_sha_range: 801f1a8..3fddc1c. Rehearsal evidence: 121s end-to-end |
| DOC-10      | 06-06                       | SECURITY.md per-phase increment                                                                       | SATISFIED               | 5 new sections + Phase 6 Audit Index per D-18                                                                                                              |

**Coverage:** All 17 phase REQ-IDs accounted for. Status breakdown: 11 SATISFIED + 1 SATISFIED-CLOUD-LOG-ONLY + 1 SATISFIED-RUNTIME-CAVEAT + 3 PARTIAL (substrate-honest carry-forward) + 1 SUPERSEDED + 1 DEFERRED (operator instruction). No orphaned requirements; no unmapped IDs; no missing claims.

### Anti-Patterns Found

Anti-pattern scan limited to files modified during Phase 6 (Cloud Functions, src/firebase/auth.js, src/views/auth.js, src/router.js, src/main.js cutover-recovery sites, scripts, runbooks).

| File                                                          | Line     | Pattern                                                                       | Severity   | Impact                                                                                                                                                                |
|---------------------------------------------------------------|----------|-------------------------------------------------------------------------------|------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| src/main.js                                                   | 808      | `if (false && (role === "admin" \|\| role === "internal") && !hasMfa) {`     | Warning    | D-27 client-side MFA-enrol gate bypass; honestly tracked in cleanup-ledger sub-wave 6.1 row #2; restoration queued. NOT compliance theatre — explicit + bounded.   |
| src/main.js                                                   | 120      | `import * as auth from "./auth/state-machine.js";`                            | Info       | AUTH-14 partial — load-bearing on Phase 4 sub-wave 4.1 IIFE migration. Substrate-honest per Pitfall 19; tracked in sub-wave 6.1.                                    |
| src/router.js                                                 | ~111     | MFA gate short-circuited (per D-27)                                           | Warning    | Same as above; both bypasses are bounded in cleanup-ledger row #2                                                                                                    |
| 06-PREFLIGHT.md ## Cutover Log                                | n/a      | `bootstrap_log_george_first_signin_at: deferred-pending-verification-batch`   | Info       | Operator-deferred (not a stub) — cleanup-ledger sub-wave 6.1 alignment                                                                                              |
| runbooks/phase6-mfa-recovery-drill.md                         | various  | Drill evidence template populated as skeleton; populated when drill runs      | Info       | Substrate-honest deferred drill (Pitfall 19 closure substrate present; execution operator-paced)                                                                     |
| .gitleaks.toml                                                | 8-10     | Header comment claims `sha256-hex-literal-regression` rule "retired" — verified: no [[rules]] block exists in file (only [allowlist] regexes) | Info | Rule actually was deleted; header comment is documentary. AUTH-14 .gitleaks.toml C2 rule deletion is in fact complete (contradicts 06-05-SUMMARY's claim that it remains pending). Substrate-honest — the SUMMARY's deferral list was conservative. |

No blockers found. All warnings/info items are explicitly tracked in `runbooks/phase-6-cleanup-ledger.md` sub-wave 6.1 carry-forward rows with named closure phases.

### Human Verification Required

5 items need human testing (deferred per operator instruction or operator-only actions):

#### 1. TOTP enrolment (Step 9 — operator-deferred batch)

**Test:** Luke + George each open the production app at https://baselayers.bedeveloped.com (or current production URL pending DNS migration), sign in, navigate to MFA enrol screen, scan QR code, enter 6-digit verification code from authenticator app. Confirm `multiFactor(currentUser).enrolledFactors[0].factorId === "totp"`.
**Expected:** Both admins enrolled; IdP admin v2 GET shows `mfa.state: ENABLED`; D-27 client-side bypass at src/main.js:808 removed (no `false &&` short-circuit); D-28 IdP `mfa.state` re-PATCHed to ENABLED.
**Why human:** Operator-deferred per explicit instruction to end-of-all-phases user-testing batch. Blocked on `enrollTotp + qrcodeDataUrl` wiring in src/firebase/auth.js (cleanup-ledger sub-wave 6.1 row #1 — substrate dependency). Cannot be completed without operator + Luke + George same-session UI exercise.

#### 2. AUTH-10 lockout drill (Step 10 — operator-deferred batch)

**Test:** Each admin takes a turn being the locked-out actor; the other runs `cd functions && node ../scripts/admin-mfa-unenroll/run.js --uid <locked-out-uid>` after OOB identity verification (voice/video call). Locked-out admin re-signs-in and re-enrols TOTP. Capture timing in `runbooks/phase6-mfa-recovery-drill.md ## Drill Evidence` block.
**Expected:** Both Tier-2 procedures complete end-to-end; drill evidence populated with date stamps + commands + any gaps.
**Why human:** Same operator-deferred batch as Step 9; transitively blocked on TOTP enrolment. Substrate is in place (admin-mfa-unenroll script + runbook + READMEs).

#### 3. BLOCKER-FIX 1 setClaims wiring (sub-wave 6.1 row #4)

**Test:** After Wave 6 sub-wave 6.1 wires `setClaims` callable invocation in `src/firebase/auth.js:updatePassword`, exercise first-time signin flow for any new admin (e.g., George's first-signin batch): sign in with temp password → renderFirstRun forces password change → updatePassword succeeds → setClaims callable flips `firstRun: true → false` → `getIdToken(true)` refresh → router routes past renderFirstRun.
**Expected:** Operator does NOT need to manually `accounts:update` PATCH the firstRun field for any new first-signer (Luke's flip during cutover-recovery was a one-off operator action).
**Why human:** Cleanup-ledger sub-wave 6.1 row #4. Operator confirmation that this is acceptable to defer until end-of-phases batch (the only outstanding first-signer is George who is also part of the deferred TOTP/AUTH-10 drill).

#### 4. DNS migration decision (Phase 3 carry-forward, exposed in Phase 6)

**Test:** Operator decides whether `baselayers.bedeveloped.com` CNAMEs to (a) lukebadiali.github.io (current — GitHub Pages, no security headers, GH Pages auto-deploy fallback) OR (b) Firebase Hosting custom-domain target (full CSP + HSTS, no auto-deploy fallback). Document decision in SECURITY.md.
**Expected:** SECURITY.md `## § Production Hosting` section either confirms migration to Firebase Hosting OR explicitly acknowledges GitHub Pages as production with CSP/headers compromise documented.
**Why human:** Cleanup-ledger row #1. Operator-only decision (security trade-off). Outside Phase 6 scope but exposed during cutover when production was discovered to still serve from GitHub Pages.

#### 5. D-22 ToS gate operator action — firebaseauth.googleapis.com API enable

**Test:** Operator visits https://console.cloud.google.com/apis/library/firebaseauth.googleapis.com?project=bedeveloped-base-layers and clicks Enable + accepts Firebase Authentication Customer Data Processing Addendum. After ~30s, `gcp-sa-firebaseauth` SA auto-provisions; rebind to `roles/run.invoker` on 4 Cloud Run services (`beforeusercreatedhandler`, `beforeusersignedinhandler`, `cspreportsink`, `setclaims`). Re-PATCH IdP `blockingFunctions.triggers` to restore `beforeCreate.functionUri` + `beforeSignIn.functionUri` (URLs preserved in Cutover Log). Live-test signin to confirm.
**Expected:** Future user creation auto-claims via beforeUserCreated → no Path B Admin SDK direct claims workaround needed for new users.
**Why human:** Cleanup-ledger sub-wave 6.1 row tagged Phase 7. Operator-only Console action (UI loaded fails on multiple attempts; needs retry/different network/Firebase Console route). Until this lands, future user creation cannot auto-claim.

### Gaps Summary

**No actionable gaps found.** Phase 6 substrate is complete; all 17 phase REQ-IDs are accounted for; the 5 human-verification items are either (a) explicit operator-deferred drills (Steps 9, 10) per phase-specific context instruction, (b) operator-only decisions (DNS migration, D-22 ToS gate), or (c) sub-wave 6.1 wiring deferred under a documented closure plan (BLOCKER-FIX 1).

**Substrate-honest carry-forward** per Pitfall 19 ("claim only what was rehearsed / shipped"):
- 11 sub-wave 6.1 rows in `runbooks/phase-6-cleanup-ledger.md` are tracked openly with named closure phases (Phase 6 sub-wave 6.1, Phase 4 sub-wave 4.1, Phase 7) and load-bearing predecessors. None are hidden debt.
- 4 forward-tracking phase rows (Phase 7/9/10/11) queue downstream owner-known work per D-17.
- AUTH-09 supersession (D-07) is documented in 2 places (REQUIREMENTS.md AUTH-09 row + SECURITY.md § Multi-Factor Authentication tradeoff narrative).
- RULES-07 deploy verification gate PASSED with literal evidence (`deploy_invocation_count_in_phase: 1` against bedeveloped-base-layers in SHA range 801f1a8..3fddc1c).

**Strength of evidence:** SC#4 substrate is met (rehearsal 121s end-to-end live against production); the SC#4 PASS evidence at the application level is structurally weak per Cutover Log caveat — main.js's lastReadForOrg + markChatReadFor still consume localStorage rather than data/read-states.js's serverTimestamp comparator. This is honestly captured in cleanup-ledger sub-wave 6.1 (Phase 4 sub-wave 4.1 IIFE migration is the load-bearing predecessor) — not compliance theatre.

**Status determination:** `human_needed` per Step 9 decision tree. No truth FAILED; no artifact MISSING; no key link NOT_WIRED; no blocker anti-patterns found. The 5 human verification items take priority over `passed` even though all automated checks pass.

---

*Verified: 2026-05-09T22:00:00Z*
*Verifier: Claude (gsd-verifier)*
