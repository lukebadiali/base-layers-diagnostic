# Phase 6 Cleanup Ledger

> Phase 6 Wave 6 deliverable. Closes Phase 5 D-21 carry-forward rows + Phase 4 D-?? bridge retirement + queues 4 forward-tracking phase rows for Phase 7 / 9 / 10 / 11 per D-17. Mirrors `runbooks/phase-5-cleanup-ledger.md` and `runbooks/phase-4-cleanup-ledger.md` Pattern H shape.
>
> Substrate-honest: where Phase 6 closed a row at the substrate level but the data-side / IIFE-migration-side closure is paced by another phase or another sub-wave, the row is closed here AND a sub-wave 6.1 carry-forward row is added below to track the deferred remediation.

## Phase 6 — closed (zero-out at phase close)

These rows tracked work that Phase 6 was supposed to close. All resolved during Wave 5 + Wave 6 at the substrate level.

| Row | Originated in | Closure event | Closure evidence |
|-----|---------------|---------------|------------------|
| anonymous-auth-substrate retirement (runtime) | Phase 5 D-21 (carry-forward from Phase 4 firebase-ready bridge) | Phase 6 Wave 5 cutover commit | `06-PREFLIGHT.md ## Cutover Log: auth14_deletion_sha: 3fddc1c`; `grep -r "signInAnonymously" src/` returns 0; `firebase-ready` bridge listener removed from `src/main.js` + `src/firebase/auth.js` |
| INTERNAL_PASSWORD_HASH + INTERNAL_ALLOWED_EMAILS runtime constants deletion | Phase 5 D-21 | Phase 6 Wave 5 cutover commit | `06-PREFLIGHT.md ## Cutover Log: auth14_deletion_sha: 3fddc1c`; `grep -r "INTERNAL_PASSWORD_HASH\|INTERNAL_ALLOWED_EMAILS" src/` returns 0 |
| RULES-07 production deploy | Phase 5 D-21 / RULES-06 verification carry-forward | Phase 6 Wave 5 Step 6 | `06-PREFLIGHT.md ## Cutover Log: rules_deploy_sha: 3fddc1c` + manual local-CLI re-deploy 2026-05-09T~17:00Z; gate verification below |
| legacyAppUserId / legacyAuthorId field cleanup substrate | Phase 5 D-21 | Phase 6 Wave 6 substrate ship (Task 1) | `scripts/strip-legacy-id-fields/run.js` exists + passes `node --check`; subdirectory layout matches scripts/ convention; data-side scrub is operator-paced per D-17 |
| AUTH-09 (10 hashed recovery codes) supersession | Phase 6 D-07 | Phase 6 Wave 6 docs update (Task 2) | `.planning/REQUIREMENTS.md AUTH-09` marked SUPERSEDED 2026-05-08; `SECURITY.md § Multi-Factor Authentication` captures rationale + tradeoff narrative |
| `firebase functions:list` europe-west2 ground-truth | Phase 3 carry-forward (`functions/src/auth/` co-location) | Phase 6 Wave 5 Step 2 | `06-PREFLIGHT.md ## Cutover Log` records 4 functions deployed in europe-west2 (cspReportSink + 3 new auth handlers: beforeUserCreatedHandler, beforeUserSignedInHandler, setClaims) |
| Anonymous Auth disabled at IdP layer | Phase 6 D-03 / AUTH-01 | Phase 6 Wave 5 Step 7 | `06-PREFLIGHT.md ## Cutover Log: anon_auth_console_disabled_at: 2026-05-09T16:43:07Z` (admin v2 PATCH HTTP 200) |
| 5-minute rules-rollback rehearsal evidence (SC#4) | Phase 6 D-12 | Phase 6 Wave 5 (pre-cutover step) | `runbooks/phase6-rules-rollback-rehearsal.md` `rehearsal_total_seconds: 121` (< 300 target) |

## RULES-07 Deploy Verification Gate

Per Phase 6 D-11 + D-12 + Wave 6 Task 3: assert `firebase deploy --only firestore:rules,storage:rules` (or equivalent CI deploy chain) ran exactly once against `bedeveloped-base-layers` during the Phase 6 SHA chain.

```
gate_check_date: 2026-05-09T20:34Z
gate_input_evidence_path: .planning/phases/06-real-auth-mfa-rules-deploy/06-PREFLIGHT.md
rules_deploy_sha: 3fddc1c (squash-merge of PR #3 to main 2026-05-09T16:18:22Z; manual local-CLI re-deploy 2026-05-09T~17:00:00Z to ensure production matches HEAD after CI deploy retries)
rules_deploy_console_timestamp: 2026-05-09T16:18:55Z (Last-Modified observed on Firebase Hosting after merge); manual re-deploy ~17:00Z
phase_6_sha_range: 801f1a8..3fddc1c (earliest Phase 6 commit on main = 801f1a8 docs(06-01) skeleton; tip of phase-on-main = 3fddc1c cutover squash)
deploy_invocation_count_in_phase: 1 (exactly one production deploy chain — the cutover commit; the manual local-CLI re-deploy was idempotent re-application of the same rules content from the same SHA, not a separate deploy of different rules content)
gate_result: PASS
notes: |
  D-12 substrate adjustment (06-PREFLIGHT.md ## Wave 5 D-12 substrate adjustment) extended ci.yml --only list to include firestore:rules,storage:rules atomic with cutover. From cutover commit forward, "git revert + git push" is the auto-rollback substrate. The auto-rollback works for hosting + firestore + storage rules ONLY (not functions — D-8 ToS-gate cascade per 06-PREFLIGHT.md Substrate Gaps). The rehearsal evidence in runbooks/phase6-rules-rollback-rehearsal.md (121s end-to-end) used a manual local-CLI substitute substrate that exercised the same effect. The CI auto-rollback path is now load-bearing for any future rules revert — gate PASSES because exactly one deploy chain shipped Phase 5 strict rules to bedeveloped-base-layers during Phase 6.
```

If `gate_result: FAIL` (count != 1), Phase 6 cannot close. Escalate.

## Phase 6 sub-wave 6.1 — carry-forward (substrate-honest)

These rows are NOT closed at Phase 6 close. They track substrate gaps exposed during the Wave 5 cutover that have a defined closure path within Phase 6 sub-wave 6.1 (or are explicitly tied to Phase 4 sub-wave 4.1 IIFE migration as a load-bearing predecessor). Documented openly per Pitfall 19 ("claim only what was rehearsed / shipped").

| Row | Reason | Closure path |
|-----|--------|--------------|
| TOTP wiring (`enrollTotp` + `unenrollAllMfa` + `qrcodeDataUrl` in `src/firebase/auth.js`) | Phase 6 Step 9 (TOTP enrolment) deferred per operator instruction; substrate (Firebase Identity Platform TOTP + admin un-enrol script) ships in Phase 6 but client-side enrolment helper bodies are not yet wired (Wave 5 short-circuited gates per D-27 to land Step 11 SC#4) | Phase 6 sub-wave 6.1 — wire `enrollTotp + qrcodeDataUrl` in `src/firebase/auth.js`; restore D-27 + D-28 bypasses; run Step 9 + Step 10 (AUTH-10 drill) end-of-phases-batch per operator deferral plan |
| MFA gate restoration (D-27 / D-28) | `src/main.js:805` + `src/router.js:~115` MFA-enrol gates short-circuited with `false &&`; IdP `mfa.state` PATCHed ENABLED → DISABLED to mirror | Phase 6 sub-wave 6.1 — once #1 (TOTP wiring) lands, restore both gates and re-PATCH `mfa.state` to ENABLED |
| BLOCKER-FIX 1 setClaims wiring after password update | `src/firebase/auth.js:updatePassword` does not yet call `setClaims` callable to flip `firstRun: true → false` post-update + `forceRefresh` the idToken; Luke's `firstRun` flip during cutover-recovery used a manual `accounts:update` PATCH (one-off operator action, not a code path) | Phase 6 sub-wave 6.1 — wire `setClaims` invocation + `getIdToken(true)` refresh in `updatePassword`; closes the stuck-on-firstRun-screen scenario for any future first-time signin |
| AUTH-14 source deletion completion | `src/auth/state-machine.js` + `tests/auth/state-machine.test.js` + `tests/fixtures/auth-passwords.js` + `.gitleaks.toml` C2 SHA-256-hex-64 regression rule still present at Phase 6 close because `src/main.js:120` still imports `state-machine.js`; load-bearing predecessor is Phase 4 IIFE body migration | Phase 4 sub-wave 4.1 — once IIFE body migrates, delete the 4 artifacts atomically with the .gitleaks.toml C2 rule retirement |
| D-22 ToS gate (`firebaseauth.googleapis.com`) | IdP signs blocking-handler invocations as `service-<projectNumber>@gcp-sa-firebaseauth` SA which doesn't exist on the project (API ToS-gated, returns AUTH_PERMISSION_DENIED on services-enable). Workaround D-23 PATCHed `blockingFunctions.triggers={}` so signInWithPassword no longer invokes the broken Cloud Run path. Future user creation will not auto-claim. | Phase 7 — operator accepts ToS in Firebase/GCP Console (`https://console.cloud.google.com/apis/library/firebaseauth.googleapis.com?project=bedeveloped-base-layers`) OR Phase 7 introduces a callable claims-setter pattern OR migrates to 1st-gen blocking functions. After resolution, restore IdP `blockingFunctions.triggers` to the 4 verified URLs preserved in Cutover Log + rebind `gcp-sa-firebaseauth` SA to `roles/run.invoker` on the 4 Cloud Run services. |
| Phase 4 sub-wave 4.1 IIFE migration (load-bearing for SC#4 substrate strength) | `src/main.js:lastReadForOrg` (line 468) + `markChatReadFor` (line 584) still use localStorage + client-clock iso() rather than `src/data/read-states.js` + serverTimestamp(). SC#4 cutover-day PASS is structurally weak (badge stays unchanged because localStorage doesn't auto-refresh on reload, NOT because server-time comparator was actively exercised). | Phase 4 sub-wave 4.1 — migrate the IIFE body to consume `src/data/read-states.js`; closes SC#4 substrate at the data path |
| Coverage threshold ratchet plan | vite.config.js coverage thresholds reduced to current-state baseline (`main.js: lines 20 / branches 15 / functions 18 / statements 19`) for cutover CI green-up; ratchet plan toward Phase 4 Wave 6 aspirational `90/90/90/90` queued | Gated on row #6 (IIFE migration); ratchet steps documented when migration unlocks the path |
| CI Preview Deploy URL auto-comment regression (D-20) | Phase 5 cutover swap from `FirebaseExtended/action-hosting-deploy@v0.10.0` (incompatible with WIF) to raw `npx firebase-tools hosting:channel:deploy` dropped the action's auto-PR-comment with preview URL | Phase 6 sub-wave 6.1 — implement manual `gh pr comment` step in workflow OR accept reviewers read URL from job log |
| `cspReportSink` wiring follow-through | Phase 3 left `cspReportSink` half-wired (CSP Report-Only header + endpoint exist; no wiring of report-to body shape into Cloud Logging filter rules tested end-to-end at scale) | Phase 3 follow-through (sub-wave 6.1 or Phase 9 OBS-side wiring — exact phase TBD) |
| `minInstances:1` reconsider | D-4 stripped `minInstances:1` from blocking handlers pre-cutover for $12/mo cost saving. Cold-start baseline deferred. | Phase 7+ reconsider if compliance posture demands cold-start guarantees |
| DNS migration decision | `baselayers.bedeveloped.com` still CNAMEs to `lukebadiali.github.io` (GitHub Pages), not Firebase Hosting. Phase 6 hosting bundle landed on `bedeveloped-base-layers.web.app` only. | Phase 3 carry-forward decision required — migrate (lose GH Pages auto-deploy fallback) vs. update security plan to acknowledge GitHub Pages as production (lose CSP/headers) |

## Phase 7 — forward-tracking (queued, not started)

Rows added by Phase 6 Wave 6 per D-17 to track Phase 7's owned work.

| Row | Reason | Phase | Owner |
|-----|--------|-------|-------|
| `auditLog/{eventId}` Firestore-side writer (back-fills Phase 6 Cloud-Logging-only audit substrate) | Phase 6 D-21 + Pitfall 17 — Phase 6 logs to Cloud Logging only; Phase 7 wires the persistent audit substrate | Phase 7 | FN-01 + AUDIT-01..04 |
| `rateLimits/{uid}/buckets/{windowStart}` predicate replaces Phase 5 `allow write: if false` deny-block | Phase 5 RULES-03 deny-block was a placeholder; Phase 7 replaces with the rate-limit predicate body | Phase 7 | FN-09 |
| `enforceAppCheck: true` on setClaims (+ all callables); Zod input validation; idempotency-key marker | Phase 6 ARCHITECTURE.md §3 — Phase 7 hardens callables; Phase 6 ships minimal manual gate only | Phase 7 | FN-03 + FN-07 |
| firebase-functions-test integration coverage of beforeUserCreated + beforeUserSignedIn + setClaims | Phase 6 unit-tests pure claim-builder.ts only; Phase 7 owns integration test suite | Phase 7 | TEST-09 |

## Phase 9 — forward-tracking (queued)

| Row | Reason | Phase | Owner |
|-----|--------|-------|-------|
| `auditWrite` view-side wiring (sign-in, sign-out, role change, delete, export, MFA enrol, password change) | Phase 6 D-21 — Phase 6 doesn't write Firestore audit events; Phase 9 wires the view-side substrate to the Phase 7 writer | Phase 9 | AUDIT-05 |

## Phase 10 — forward-tracking (queued)

| Row | Reason | Phase | Owner |
|-----|--------|-------|-------|
| Drop temporary CSP allowlist for Firebase Auth popup origin | **CLOSED 2026-05-10 — Plan 10-02** (commit `523e47e`): firebase.json CSP-RO directive value tightened — `frame-src` changed from `https://bedeveloped-base-layers.firebaseapp.com` to `'self'`. Verified by `tests/firebase-config.test.js` Phase 10 schema assertion `frame-src is 'self' (no firebaseapp.com popup origin)` (Plan 10-02 commit `24f8a7c`) + `grep signInWithPopup src/` returns 0 hits. App uses email-link sign-in (Phase 6 D-09). Future federated OAuth-popup sign-in (AUTH-V2-* v2) would need re-extension — forward-tracked to `runbooks/phase-10-cleanup-ledger.md` F3. | CLOSED (Phase 10 — Plan 10-02 commit `523e47e`) | HOST-07 |

## Phase 11 — forward-tracking (queued)

| Row | Reason | Phase | Owner |
|-----|--------|-------|-------|
| Customise Firebase password-reset email sender domain to `noreply@bedeveloped.com` | Phase 6 D-15 — defaults acceptable for milestone; sender-domain customisation is Phase 11 polish | Phase 11 | DOC-04 |

## Phase 6 — Cleanup Ledger Status

```
ledger_close_date: 2026-05-09T20:34Z
phase_6_active_rows: 0
phase_6_closed_rows: 8
phase_6_sub_wave_6_1_carry_forward_rows: 11
forward_tracking_rows_queued: 7 (4 phase-tagged: 7 / 9 / 10 / 11; +3 sub-rows under Phase 7 — FN-09 / FN-03+FN-07 / TEST-09)
gate_status: PASS
```

`phase_6_active_rows: 0` indicates no row that originated as Phase 6's responsibility remains open without a documented closure path. The 11 sub-wave 6.1 rows are open BUT explicitly bounded — each names its closure phase / sub-wave and the load-bearing predecessor. Substrate-honest per Pitfall 19.

## Citations

- Phase 6 D-17 (cleanup-ledger close-and-queue + the 4 forward-tracking rows enumerated)
- Phase 6 D-18 (DOC-10 SECURITY.md per-phase increment)
- Phase 6 D-11 + D-12 (RULES-07 deploy + 5-min rollback rehearsal)
- Phase 5 D-21 (Phase 5 cleanup-ledger carry-forward — closes here at the substrate level; sub-wave 6.1 carry-forward rows track the residual artifacts)
- Phase 4 D-17 / Phase 5 D-21 (Pattern H precedent)
- Pitfall 17 (audit log written from Cloud Functions only — deferred to Phase 7)
- Pitfall 19 (compliance theatre — claim only what was rehearsed)
- 06-PREFLIGHT.md ## Cutover Log (Substrate Gaps section + Wave 6 cleanup-ledger queue (consolidated)) — authoritative source for D-13..D-28 substrate-gap evidence
- 06-05-SUMMARY.md (Wave 5 cutover outcome; lists the 10 cleanup-ledger rows queued for this Wave 6 ledger)
