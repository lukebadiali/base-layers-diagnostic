# Phase 6: Real Auth + MFA + Rules Deploy (Cutover) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-08
**Phase:** 06-real-auth-mfa-rules-deploy
**Areas discussed:** Cutover wave shape + atomicity, Admin bootstrap + MFA enrolment + drill, Auth blocking Functions + RULES-07 deploy & rollback, Sign-in client UX (enumeration + email-verify + reset)

---

## Cutover wave shape + atomicity

### Wave shape

| Option | Description | Selected |
|--------|-------------|----------|
| 6-wave mirror | Wave 1 pre-flight + functions/ workspace prep; Wave 2 blocking + callable functions + tests; Wave 3 sign-in/MFA/recovery views + AUTH-12 wrapper; Wave 4 bootstrap script + MFA UX walkthrough; Wave 5 cutover runbook + production execution + AUTH-10 drill; Wave 6 SECURITY.md + cleanup ledger + RULES-07 verification gate. (Recommended) | ✓ |
| 5-wave | Fold bootstrap-prep into cutover wave | |
| 7-wave | Split RULES-07 deploy from rest of cutover | |

**User's choice:** 6-wave mirror.
**Notes:** Mirrors Phase 4/5 cadence; one coherent boundary per wave; atomic-commit pattern preserved.

### Cutover atomicity

| Option | Description | Selected |
|--------|-------------|----------|
| Single-session atomic cutover | Functions deploy → bootstrap → claims verify → rules deploy → anon disable → AUTH-14 delete in one operator session and one cutover commit. (Recommended) | ✓ |
| Two-session split | Cutover then 24h-later cleanup | |
| Three-session split | Bootstrap then deploy then delete | |

**User's choice:** Single-session atomic cutover.
**Notes:** Mirrors Phase 5 same-session export → dry-run → real-run pattern.

### Anon Auth disable + signInAnonymously source removal

| Option | Description | Selected |
|--------|-------------|----------|
| Console-disable AT cutover; source removed IN cutover commit | Single-state outcome; firebase-ready bridge retires alongside. (Recommended) | ✓ |
| Console-disable but keep source as belt-and-braces | | |
| Remove source first, Console-disable later | | |

**User's choice:** Console-disable AT cutover; source removed IN cutover commit.

### AUTH-14 deletion (INTERNAL_PASSWORD_HASH + state-machine.js + tests + fixtures)

| Option | Description | Selected |
|--------|-------------|----------|
| In the cutover commit | Atomic with rules deploy. Phase 2 TEST-07 baseline retires in same commit as replacement ships. (Recommended) | ✓ |
| Wave 6 cleanup (after 24h soak) | | |
| Wave 3 (delete BEFORE cutover) | | |

**User's choice:** In the cutover commit, atomic with rules deploy.

---

## Admin bootstrap + MFA enrolment + drill

### Bootstrap method

| Option | Description | Selected |
|--------|-------------|----------|
| Allowlist-seeded self-signup | Admins visit sign-up flow; beforeUserCreated reads allowlist + sets claims. (Recommended) | |
| Console manual creation + temp passwords + forced reset | Operator creates accounts via Console UI; first sign-in forces password change. | ✓ |
| Hybrid: Console-create with email-link sign-in | | |

**User's choice:** Console manual creation + temp passwords + forced reset.
**Notes:** Allowlist still seeded first via Admin SDK script so beforeUserCreated has the claim source-of-truth.

### OOB channel for pre-MFA secrets

| Option | Description | Selected |
|--------|-------------|----------|
| In-person, side-by-side enrolment | Both admins together; cleanest audit narrative. (Recommended) | |
| Encrypted password manager share | Bitwarden / 1Password | |
| Signal / encrypted messenger | | |

**User's choice (free text):** "dont worry i will sort the logins just make sure you can create accounts and change passwords"
**Notes:** Operator handles OOB credential delivery operationally; runbook documents "operator delivers via secure channel of own choosing" without prescribing. Phase-side deliverable is account-create + password-change capability only.

### Recovery codes (AUTH-09) model

| Option | Description | Selected |
|--------|-------------|----------|
| (a) AUTH-09 + email codes at enrolment | Generate + hash + store server-side; ALSO email plaintext codes. | |
| (b) Drop pre-generated codes; use email-link recovery | No codes generated. AUTH-09 superseded. Recovery = email-link sign-in. | ✓ |
| (c) Stick with AUTH-09 (show-once-in-browser, never email) | Per Pitfall 7. | |

**User's choice:** (b) — Drop pre-generated codes; use email-link recovery.
**Notes:** AUTH-09 marked superseded in REQUIREMENTS.md. Recovery substrate is email-account; tradeoff captured in SECURITY.md narrative. Initial freeform answer "send recovery codes to emails" was clarified to land here.

### MFA recovery + AUTH-10 drill model

| Option | Description | Selected |
|--------|-------------|----------|
| (c) Operator-side un-enrol via Admin SDK + AUTH-10 drilled | MFA hard-enforced; no in-app toggle; two-tier recovery (email-link Tier-1, Admin SDK Tier-2). (Recommended) | ✓ |
| (d) Skip AUTH-10 drill (document only) | Pitfall 19 risk. | |
| (e) Hard-enforce with no recovery path | Lockout risk. | |

**User's choice:** (c). Confirmed no in-app "disable MFA" UI toggle. AUTH-10 drilled live same-day-as-cutover. Initial freeform answer "i don't want MFA build for 2FA and then have a setting to disable it" was clarified to land here.

---

## Auth blocking Functions + RULES-07 deploy & rollback

### Region for new auth-blocking Cloud Functions

| Option | Description | Selected |
|--------|-------------|----------|
| europe-west2 | Co-located with cspReportSink; UK data-residency story. (Recommended) | ✓ |
| us-central1 | Identity Platform default. | |
| Match Firestore region after pre-flight | Defer one wave. | |

**User's choice:** europe-west2.
**Notes:** Wave 1 pre-flight verifies Firestore region; if mismatch, escalate before Wave 2.

### Functions source layout

| Option | Description | Selected |
|--------|-------------|----------|
| Subdirectory: functions/src/auth/{beforeUserCreated,beforeUserSignedIn,setClaims}.ts | Mirrors functions/src/csp/* pattern; pure logic in sibling claim-builder.ts. (Recommended) | ✓ |
| Flat layout | | |
| Single file | | |

**User's choice:** Subdirectory layout matching csp/* pattern.

### RULES-07 deploy ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Functions first → bootstrap + claims-verify → rules deploy → anon disable | Closes Pitfall 1. (Recommended) | ✓ |
| Rules deploy first → functions → bootstrap | Pitfall 1 anti-pattern. | |
| Functions + rules together → bootstrap last | Risky on first sign-in. | |

**User's choice:** Functions first → bootstrap + claims-verify → rules deploy → anon disable.

### 5-minute rollback substrate

| Option | Description | Selected |
|--------|-------------|----------|
| Git revert + redeploy via CI | Phase 3 CI deploy job IS the rollback mechanism. (Recommended) | ✓ |
| Local firebase deploy from prior commit | Bypasses OIDC + concurrency gates. | |
| Pre-staged sidecar artefact | Duplicates state. | |

**User's choice:** Git revert + redeploy via CI. Pre-cutover rehearsal mandatory; timing evidence in runbook.

---

## Sign-in client UX (enumeration + email-verify + reset)

### AUTH-12 unified-error wrapper location

| Option | Description | Selected |
|--------|-------------|----------|
| In src/firebase/auth.js body | Single chokepoint; no Firebase error codes leak. (Recommended) | ✓ |
| In src/auth/sign-in.js view-layer wrapper | | |
| In auth view directly | | |

**User's choice:** In src/firebase/auth.js body.

### AUTH-11 email-verify enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Both Rules + client | Phase 5 isAuthed() requires email_verified; client adds UX layer. (Recommended) | ✓ |
| Rules only (no client gate) | | |
| Client only (no rules check) | | |

**User's choice:** Both Rules + client.
**Notes:** Bootstrap admins pre-verified via Admin SDK during Console creation.

### Password reset enumeration mitigation

| Option | Description | Selected |
|--------|-------------|----------|
| Generic "If that account exists, you'll receive an email" | Firebase API is silent-success on unknown emails. (Recommended) | ✓ |
| Show "Email sent" only on actual send | Leaks registration. | |
| Skip in-app reset; admin-initiated only | | |

**User's choice:** Generic wording.
**Notes:** Sender-domain customisation deferred to Phase 11.

### Sign-in / MFA / first-run UI location

| Option | Description | Selected |
|--------|-------------|----------|
| New src/views/auth.js view + router entry | Pattern D DI factory exporting renderSignIn / renderFirstRun / renderMfaEnrol / renderEmailVerificationLanding. (Recommended) | ✓ |
| Modal-based (no new view) | | |
| Use firebaseui-web | | |

**User's choice:** New src/views/auth.js view + router entry.

---

## Claude's Discretion

- `scripts/seed-internal-allowlist/` exact path
- Per-view snapshot test glob layout (single file vs one-per-view)
- TOTP QR-code rendering library choice (qrcode npm vs google-charts)
- Whether to keep INTERNAL_PASSWORD_HASH-shape gitleaks rule one milestone post-cutover
- Audit-event firing in beforeUserSignedIn (direct auditLog write vs Cloud Logging only, defer to Phase 7)

## Deferred Ideas

- Custom password-reset sender domain → Phase 11
- firebase-functions-test v3 integration tests → Phase 7 (TEST-09)
- Sender-customised TOTP enrolment email → Phase 11
- "Request audit log of my account" self-serve UI → out of milestone
- Hardware-key (YubiKey) second factor → future v2 milestone
- Sidecar legacyIdMap collection (vs inline-field deletion) → not expected; revisit if cross-collection ID collisions emerge
- Pre-deploying rules to separate Firebase project for nightly drift check → Phase 9
- setClaims callable rate-limiting → Phase 7 (FN-09)
- Account self-service "delete my account" UI → Phase 8 (gdprEraseUser)
