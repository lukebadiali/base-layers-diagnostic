---
phase: 06-real-auth-mfa-rules-deploy
plan: 04
plan_id: 06-04
subsystem: auth-bootstrap-runbooks
tags: [auth, bootstrap, mfa, runbook, admin-sdk, scripts, cutover, AUTH-04, AUTH-05, AUTH-08, AUTH-10, AUTH-15]
requirements_completed: [AUTH-04, AUTH-05, AUTH-08, AUTH-10, AUTH-15]
dependency_graph:
  requires:
    - 06-01-SUMMARY (Wave 1 pre-flight: firebase.json declarations + Identity Platform + passwordPolicy)
    - 06-02-SUMMARY (Wave 2 functions: beforeUserCreated reads internalAllowlist; setClaims callable)
    - 06-03-SUMMARY (Wave 3 sign-in UI: renderSignIn + renderForgotMfa Tier-1 surface; firebase/auth.js bodies)
    - scripts/migrate-subcollections/run.js (Pattern E ADC + dry-run shape reference)
    - runbooks/hosting-cutover.md (Pattern F operator-deferred runbook shape reference)
  provides:
    - scripts/seed-internal-allowlist/run.js (Wave 5 Step 3 input)
    - scripts/admin-mfa-unenroll/run.js (Wave 5 Step 10 AUTH-10 Tier-2 drill input)
    - runbooks/phase6-bootstrap.md (Wave 5 Step 4 procedure)
    - runbooks/phase6-mfa-recovery-drill.md (Wave 5 Step 10 procedure + evidence template)
    - runbooks/phase6-cutover.md (Wave 5 master 12-step sequence)
  affects:
    - .planning/phases/06-real-auth-mfa-rules-deploy/06-PREFLIGHT.md (Cutover Log block referenced; populated in Wave 5)
tech-stack:
  added:
    - firebase-admin (already pinned in functions/package.json; consumed by both scripts)
  patterns:
    - Pattern E (Admin SDK one-shot script with ADC + --dry-run + --verify + --help)
    - Pattern F (operator-deferred runbook with Prerequisites + numbered Steps + Log block + Citations)
key-files:
  created:
    - scripts/seed-internal-allowlist/run.js
    - scripts/seed-internal-allowlist/README.md
    - scripts/admin-mfa-unenroll/run.js
    - scripts/admin-mfa-unenroll/README.md
    - runbooks/phase6-bootstrap.md
    - runbooks/phase6-mfa-recovery-drill.md
    - runbooks/phase6-cutover.md
  modified: []
decisions:
  - "Admin SDK turn-key scripts wrap a single firebase-admin call each (seed: doc().set; unenroll: auth().updateUser); both follow scripts/migrate-subcollections/ subdirectory + run.js + README.md + ADC + --dry-run + --help convention"
  - "scripts/admin-mfa-unenroll/run.js is the canonical Tier-2 path per BLOCKER-FIX 4 (replaces unverified firebase auth:multifactor:unenroll CLI subcommand); CLI listed only as experimental fallback in mfa-recovery-drill.md"
  - "phase6-bootstrap.md Step 0 verifies mfa.state ENABLED + TOTP provider configured before live admin enrolment, carrying forward 06-PREFLIGHT.md Wave 5 gate"
  - "phase6-cutover.md 12-step ordering is load-bearing per D-02 / D-11; Step 5 (claims-verify) is an explicit ABORT gate before Step 6 (rules deploy) — closes Pitfall 1"
  - "Step 8 (AUTH-14 deletion) enumerates 10 grep verifications (vs 9 in earlier draft) to match 06-05 Task 3 enumeration including the .gitleaks.toml custom rule deletion"
metrics:
  duration_seconds: 445
  duration_human: "7 min 25 sec"
  tasks_completed: 4
  files_created: 7
  files_modified: 0
  commits: 4
  completed_at: "2026-05-09T11:42:54Z"
---

# Phase 6 Plan 04: Bootstrap Script + Cutover-Supporting Runbooks Summary

**One-liner:** Authored the Admin SDK seed script (internalAllowlist for Luke + George), the BLOCKER-FIX 4 canonical Tier-2 MFA un-enrol turn-key script, and the 3 operator-deferred runbooks (bootstrap, MFA-recovery-drill, 12-step cutover) that the Wave 5 single-session cutover consumes end-to-end.

## What was built

Two Admin SDK one-shot scripts in `scripts/` (Pattern E) and three operator-deferred runbooks in `runbooks/` (Pattern F). Together they form the executor-deferred substrate that Wave 5 follows live during the single-session auth + rules cutover.

### scripts/seed-internal-allowlist/run.js + README.md

- Seeds two docs: `internalAllowlist/luke@bedeveloped.com` + `internalAllowlist/george@bedeveloped.com`, each `{role: "admin", addedBy: "phase-6-bootstrap", addedAt: <serverTimestamp>}`.
- `email.toLowerCase()` invariant per ARCHITECTURE.md §8 — applied at the only write site so `beforeUserCreated`'s `internalAllowlist/{user.email.toLowerCase()}` lookup matches.
- `set({merge: true})` makes the script naturally idempotent.
- Flags: `--dry-run` (no writes; logs intent), `--verify` (read-back after writes; exit 1 on any mismatch), `--help`.
- ADC init via `applicationDefault()` from `firebase-admin/app` (Pitfall 13 / D-20 — no service-account JSON in source).
- README documents prerequisites including the carry-forward `mfa.state ENABLED + TOTP provider configured` check.

### scripts/admin-mfa-unenroll/run.js + README.md (BLOCKER-FIX 4)

- Wraps `admin.auth().updateUser(uid, {multiFactor: {enrolledFactors: []}})` — the documented authoritative path per Firebase Admin SDK.
- Replaces the previously-referenced `firebase auth:multifactor:unenroll` CLI subcommand which was not verified to exist in the firebase-tools version pinned for this milestone (BLOCKER-FIX 4).
- Required arg `--uid <uid>` plus `--dry-run` + `--help`.
- Logs BEFORE state (factor count + factorIds + displayName) for the AUTH-10 drill evidence block; logs `[OK]` AFTER confirmation; validates post-update factor count is 0.
- Output is the audit narrative substrate (Pitfall 19 — the drill IS the evidence; the script's stdout IS the artefact).

### runbooks/phase6-bootstrap.md

- 7 numbered Steps (Step 0 mfa.state runtime check + Steps 1-6 Console-create / emailVerified / claims-verify / repeat for george / OOB delivery / first-sign-in walkthrough).
- Documents the WARNING-FIX canonical force-password-change mechanism: Identity Platform does NOT expose a programmatic flag, so the locked path uses a `firstRun: true` custom claim consumed by `renderFirstRun` per 06-03 D-16, with an Admin SDK callable clearing the claim on success.
- Bootstrap Log block captures uid + emailVerified + claims-verified + password-changed + mfa-enrolled timestamps for both admins; OOB delivery channel captured post-cutover only (D-06 — operator-defined channel; not pre-recorded).

### runbooks/phase6-mfa-recovery-drill.md

- **Tier 1 (user-side, expected path):** `renderForgotMfa` view → `sendSignInLinkToEmail` → `signInWithEmailLink` → `unenrollAllMfa()` → `renderMfaEnrol`. BLOCKER-FIX 3 ships the UI surface in 06-03; runbook references it directly.
- **Tier 2 (operator-side, fallback):** OOB identity verification → list factors via Admin SDK → `scripts/admin-mfa-unenroll/run.js --uid <uid>` (canonical, BLOCKER-FIX 4) → locked-out admin signs in → re-enrols TOTP.
- AUTH-09 supersession captured (D-07): no pre-generated recovery codes; tradeoff documented for SECURITY.md Wave 6.
- Drill Evidence Round 1 (luke locked out, george operating) + Round 2 (george locked out, luke operating) blocks ready for Wave 5 live population.
- AUTH-10 Closure Criteria enumerated: both rounds need `step_3_admin_sdk_unenroll.exit_code = 0` + `step_4_locked_out_user_signin` succeeded + `gaps_observed` empty or accepted in SECURITY.md Wave 6.

### runbooks/phase6-cutover.md

- 12 numbered Steps in load-bearing order per D-02 / D-11:
  1. Pre-cutover rules-rollback rehearsal (D-12; SC#4 evidence; runbook authored DURING this step in Wave 5 Plan 06-05 Task 1)
  2. Deploy auth-blocking + callable Cloud Functions (D-09; europe-west2; minInstances:1; cold-start p99 ≤ 4s)
  3. Run `scripts/seed-internal-allowlist/run.js --verify`
  4. Console-create both admin Auth users + emailVerified flag + first-sign-in walkthrough (delegates to `phase6-bootstrap.md`)
  5. Both admins sign in + verify `claims.role === "admin"` in ID token — explicit ABORT gate (closes Pitfall 1)
  6. Deploy `firestore.rules` + `storage.rules` (RULES-07)
  7. Disable Anonymous Auth in Firebase Console
  8. Land AUTH-14 deletion commit (D-04 — 10 enumerated grep verifications including .gitleaks.toml rule deletion)
  9. Both admins enrol TOTP MFA
  10. AUTH-10 drill Tier-2 procedure (delegates to `phase6-mfa-recovery-drill.md`; uses `scripts/admin-mfa-unenroll/run.js`)
  11. SC#4 clock-skew exercise (D-19 — closes 05-HUMAN-UAT.md test #2)
  12. Update `06-PREFLIGHT.md ## Cutover Log`
- Cutover Log skeleton enumerates all 12-step evidence keys.
- Rollback Procedure (5-step) per D-12.
- Cross-references all sibling runbooks (`phase6-rules-rollback-rehearsal.md` Step 1; `phase6-bootstrap.md` Step 4; `phase6-mfa-recovery-drill.md` Step 10).

## Decisions Made

- **Admin SDK Tier-2 path is canonical** (per BLOCKER-FIX 4); the firebase-tools CLI is listed only as an experimental fallback in `phase6-mfa-recovery-drill.md` "Experimental fallback" subsection. Operators should not rely on the CLI on cutover day.
- **`mfa.state ENABLED + TOTP provider configured` is Step 0** of `phase6-bootstrap.md` (not buried in Prerequisites) because the runtime configuration check is a final gate before live admin enrolment — placing it as Step 0 makes it impossible to skip.
- **OOB credential delivery method captured POST-cutover only** (D-06): the runbook explicitly does NOT prescribe the channel, and the Bootstrap Log key `oob_credential_delivery_method:` is annotated `<captured post-cutover>` so the operator does not pre-record it into committed artefacts.
- **`scripts/admin-mfa-unenroll/run.js` validates AFTER state** (re-fetches user + asserts `factorsAfter.length === 0`) so the script fails loudly if the Admin SDK call silently no-ops, rather than producing false-positive `[OK]` evidence.
- **Cutover runbook uses `### Step N:` headings** (not bullets or numbered list items) so the verification regex `### Step ${n}:` reliably finds all 12 steps independent of markdown rendering.
- **Step 8 enumerates 10 grep verifications** (one more than the 9 cited in earlier drafts) to match 06-05 Task 3's enumeration; the additional verification is the `.gitleaks.toml` `sha256-hex-literal-regression` rule deletion which closes the cleanup-ledger row queued in 05-CONTEXT.md D-21.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical functionality] AFTER-state validation in admin-mfa-unenroll/run.js**

- **Found during:** Task 2.5 implementation review.
- **Issue:** Plan specification logged `[OK] mfa cleared` after the `updateUser` call but did not validate the post-call factor count, leaving open a silent-failure window where the SDK call returns success but factors remain enrolled.
- **Fix:** Added a post-update `getAuth().getUser(uid)` re-fetch + assertion `factorsAfter.length === 0`; exits 1 if not zero. The `[OK]` line additionally reports the BEFORE → AFTER count delta for the audit narrative.
- **Files modified:** `scripts/admin-mfa-unenroll/run.js`
- **Commit:** `7c9a7d3`
- **Rationale:** AUTH-10 drill evidence (Pitfall 19) requires the script's stdout to be trustworthy; a silent no-op would corrupt the drill record. Rule 2 (correctness requirement for security-relevant operation).

**2. [Rule 3 - Blocking issue] --help flag added to both scripts**

- **Found during:** Task 1 + Task 2.5 implementation.
- **Issue:** Plan code stub did not include a `--help` flag; without one, an operator running the script with no args sees only an opaque ADC initialisation log + (for unenroll) a `[FAIL]` error. The runbooks reference these scripts as turn-key invocations; an operator who can't easily get usage info from `--help` is a cutover-day friction point.
- **Fix:** Added `--help` / `-h` flag to both scripts, printing the Usage block and exiting 0 before any ADC initialisation.
- **Files modified:** `scripts/seed-internal-allowlist/run.js`, `scripts/admin-mfa-unenroll/run.js`
- **Commits:** `e06f084`, `7c9a7d3`
- **Rationale:** Operator UX during a single-session cutover is load-bearing (D-02). Rule 3 (blocking issue: operator confusion at the keyboard during cutover delays the session).

### Out-of-scope items

- None encountered. The wave is doc + script authoring; no production state changes; no live execution.

## Threat Flags

None — all surface introduced (two Admin SDK scripts + three runbooks) is documented in the plan's `<threat_model>` register (T-06-04-01 through T-06-04-09) and corresponds to mitigate dispositions already named.

## Authentication Gates

None encountered this wave — no live ADC auth or production deploys executed (Wave 5 owns those).

## Self-Check: PASSED

- [x] `scripts/seed-internal-allowlist/run.js` exists; passes `node --check`; contains `luke@bedeveloped.com` + `george@bedeveloped.com` + `toLowerCase`; has `--dry-run` + `--verify` + `--help` flags.
- [x] `scripts/seed-internal-allowlist/README.md` exists; documents prerequisites (ADC + mfa.state ENABLED) + usage + when this runs.
- [x] `scripts/admin-mfa-unenroll/run.js` exists; passes `node --check`; uses `admin.auth().updateUser` with `enrolledFactors: []`; has `--uid` required arg + `--dry-run` + `--help`; validates AFTER state.
- [x] `scripts/admin-mfa-unenroll/README.md` exists; documents prerequisites + usage + when this runs + AUTH-10 audit narrative.
- [x] `runbooks/phase6-bootstrap.md` exists; references both admins by email + seed script + emailVerified Admin SDK call + claims verification via `getIdTokenResult` + Step 0 mfa.state runtime check + force-password-change canonical mechanism.
- [x] `runbooks/phase6-mfa-recovery-drill.md` exists; includes Background (AUTH-09 supersession) + Tier 1 + Tier 2 + Round 1 + Round 2 + AUTH-10 Closure Criteria + references `scripts/admin-mfa-unenroll/run.js` + `renderForgotMfa`.
- [x] `runbooks/phase6-cutover.md` exists with all 12 numbered Steps in the load-bearing order; Cutover Log skeleton + Rollback Procedure + Citations present; cross-references `phase6-bootstrap.md` (Step 4) + `phase6-mfa-recovery-drill.md` (Step 10) + `phase6-rules-rollback-rehearsal.md` (Step 1).
- [x] `node --check` succeeded on both new JS files.
- [x] `npx eslint` clean on both new JS files.
- [x] All 4 task commits exist: `e06f084` (Task 1) + `3ebc27a` (Task 2) + `7c9a7d3` (Task 2.5) + `4353b2e` (Task 3).
- [x] No production state changed this wave (zero deploys, zero live ADC executions).
- [x] STATE.md and ROADMAP.md NOT modified (orchestrator owns those writes).

Verified files via direct filesystem checks; verified commits via `git log --oneline -5`.

## Wave 5 Handoff

The Wave 5 operator session can now run end-to-end against this Wave 4 substrate:

- **Step 1 (rehearsal):** runbook authored DURING the rehearsal in Wave 5 Plan 06-05 Task 1 — Wave 4 explicitly does NOT pre-author it.
- **Step 2 (functions deploy):** consumes Wave 2 deliverables.
- **Step 3 (seed allowlist):** `cd functions && node ../scripts/seed-internal-allowlist/run.js --verify` ready.
- **Step 4 (Console create + bootstrap):** `runbooks/phase6-bootstrap.md` ready; Step 0 mfa.state check inline.
- **Step 5 (claims verify):** ABORT-gate procedure documented in `phase6-cutover.md` Step 5.
- **Step 6 (rules deploy):** RULES-07 procedure documented (Path A CI / Path B operator-direct).
- **Step 7 (anon disable):** Console-flip procedure documented.
- **Step 8 (AUTH-14 deletion):** 10-grep verification checklist enumerated.
- **Step 9 (TOTP enrol):** UX delegates to Wave 3 `renderMfaEnrol`.
- **Step 10 (AUTH-10 drill):** `runbooks/phase6-mfa-recovery-drill.md` Tier-2 + `scripts/admin-mfa-unenroll/run.js` ready; Drill Evidence Round 1 + Round 2 blocks ready for population.
- **Step 11 (SC#4 clock skew):** procedure documented; closes 05-HUMAN-UAT.md test #2.
- **Step 12 (PREFLIGHT cutover log):** evidence skeleton ready in `phase6-cutover.md ## Cutover Log` block; operator copies populated values into `06-PREFLIGHT.md`.

All 12 steps + AUTH-10 drill rounds + AUTH-14 deletion checklist + AUTH-09 supersession are runbook-encoded and ready for Wave 5 live execution.
