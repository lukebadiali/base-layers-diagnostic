---
status: partial
phase: 06-real-auth-mfa-rules-deploy
source: [06-VERIFICATION.md]
started: 2026-05-09T22:05:00Z
updated: 2026-05-09T22:05:00Z
---

## Current Test

[awaiting human testing — operator-deferred batch]

## Tests

### 1. Step 9 — Luke + George live TOTP enrolment via Firebase Identity Platform
expected: Both admins enrolled with TOTP factor visible in `multiFactor(currentUser).enrolledFactors`; IdP admin v2 shows `mfa.state: ENABLED` post-restoration; D-27 client-side bypass removed (no `false &&` short-circuit at src/main.js:808 and src/router.js MFA gate).
result: pending — operator-deferred to end-of-all-phases user-testing batch. Blocked on `enrollTotp + qrcodeDataUrl` wiring in src/firebase/auth.js (cleanup-ledger sub-wave 6.1 row #1).

### 2. Step 10 — AUTH-10 two-admin un-enrol drill (live)
expected: Each admin takes a turn locked-out; the other runs `scripts/admin-mfa-unenroll/run.js --uid <uid>` after OOB identity verification; both procedures complete end-to-end with timing captured in runbooks/phase6-mfa-recovery-drill.md.
result: pending — same operator-deferred batch as Step 9; transitively blocked on TOTP enrolment.

### 3. BLOCKER-FIX 1 setClaims wiring in src/firebase/auth.js:updatePassword
expected: After successful updatePassword, src/firebase/auth.js calls setClaims callable to flip `firstRun: true → false` and forces `getIdToken(true)` refresh.
result: pending — cleanup-ledger sub-wave 6.1 row #4. Operator confirmation that deferral until end-of-phases batch is acceptable (only outstanding first-signer is George who is also part of deferred TOTP/AUTH-10 drill).

### 4. DNS migration decision (Phase 3 carry-forward)
expected: baselayers.bedeveloped.com CNAMEs to either lukebadiali.github.io (current — GitHub Pages) OR Firebase Hosting custom-domain target; decision documented in SECURITY.md.
result: pending — cleanup-ledger row #1; explicitly an operator decision (security trade-off — auto-deploy fallback vs CSP/headers).

### 5. D-22 ToS gate operator action — firebaseauth.googleapis.com API enable
expected: Operator clicks Enable + accepts Firebase Authentication CDPA at https://console.cloud.google.com/apis/library/firebaseauth.googleapis.com?project=bedeveloped-base-layers; gcp-sa-firebaseauth SA auto-provisions; rebind to roles/run.invoker on 4 Cloud Run services; re-PATCH IdP blockingFunctions.triggers.
result: pending — cleanup-ledger sub-wave 6.1 row tagged Phase 7. Operator-only action.

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
