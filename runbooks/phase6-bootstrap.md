# Phase 6 Bootstrap Runbook

> Phase 6 Wave 4 deliverable. Walks the operator through Console-creating Luke + George as real Firebase Auth users with `emailVerified: true` flagged + force-password-change pattern + first-sign-in walkthrough (D-05). Run after `scripts/seed-internal-allowlist/run.js` (Step 3 of `phase6-cutover.md`) and before AUTH-14 deletion (Step 8 of `phase6-cutover.md`).

This runbook is intentionally executor-deferred. The plan that authored it deliberately did NOT create the Auth users — Console creation is operator-only because (a) it's a one-shot bootstrap, (b) the operator chooses + delivers the temp passwords (D-06 — operator-defined OOB channel), and (c) running it via Admin SDK alone would require a service-account JSON which D-20 explicitly avoids.

---

## Prerequisites

- [ ] **Phase 6 Wave 2 functions deployed.** Verify with: `firebase functions:list --project bedeveloped-base-layers | grep -E "beforeUserCreated|beforeUserSignedIn|setClaims"` returns 3 lines, all in europe-west2.
- [ ] **Phase 6 Wave 4 seed script run.** Verify with: `cd functions && node ../scripts/seed-internal-allowlist/run.js --verify` exits 0 and prints `[OK] internalAllowlist/luke@bedeveloped.com verified role=admin` + `[OK] internalAllowlist/george@bedeveloped.com verified role=admin`.
- [ ] **`gcloud auth application-default login`** completed (D-20 / Pitfall 13).
- [ ] **`firebase login`** completed for the operator account.
- [ ] **passwordPolicy enabled in Firebase Console** (verified PASS in `06-PREFLIGHT.md ## passwordPolicy` section — ≥12 chars + HIBP leaked-password check per AUTH-04).

---

## Step 0: Verify `mfa.state` ENABLED + TOTP provider configured (~2 min)

[Carry-forward from `06-PREFLIGHT.md` Wave 1: Identity Platform `mfa.state` was confirmed in Wave 1 but TOTP enrolment requires the runtime provider to be live. This is the last gate before live admin enrolment.]

1. Open https://console.cloud.google.com/customer-identity/mfa?project=bedeveloped-base-layers
2. Confirm "Multi-factor authentication" status is **Enabled**.
3. Confirm "TOTP authenticators (Time-based One-Time Password)" provider is configured + status `Enabled`.
4. If either is `Disabled`: ABORT bootstrap. Re-run Wave 1 verification + remediate before continuing — Phase 6 D-08 hard-enforces TOTP MFA; live admin enrolment in Step 6 below will fail server-side without this.

Capture under `mfa_runtime_check_passed:` in `06-PREFLIGHT.md ## Cutover Log`.

---

## Operator Steps

### Step 1: Console-create luke@bedeveloped.com (~3 min)

1. Open https://console.firebase.google.com/project/bedeveloped-base-layers/authentication/users in a browser.
2. Click "Add user".
3. Enter email: `luke@bedeveloped.com`.
4. Enter operator-chosen temp password (≥12 chars; passwordPolicy + HIBP leaked-password check enforced server-side per AUTH-04).
5. Submit. Capture the resulting `uid` (Console displays after creation). Record under `bootstrap_log_luke_uid:` in `06-PREFLIGHT.md ## Cutover Log`.

**What just happened server-side:** `beforeUserCreated` fired, read `internalAllowlist/luke@bedeveloped.com`, called `buildClaims({role: "admin"})`, returned `{customClaims: {role: "admin", orgId: null}}`. The user record now carries `customClaims.role = "admin"` (verified in Step 3 below).

### Step 2: Mark emailVerified=true via Admin SDK (~1 min)

The Console doesn't expose this flag directly. From a terminal in the repo root with ADC active:

```sh
cd functions && node -e '
const admin = require("firebase-admin");
admin.initializeApp({projectId: "bedeveloped-base-layers"});
admin.auth().updateUser("<luke uid>", {emailVerified: true})
  .then(u => { console.log("[OK] emailVerified=true for", u.uid); process.exit(0); })
  .catch(e => { console.error("[FAIL]", e); process.exit(1); });
'
```

Verify by re-fetching the user via `admin.auth().getUser(<luke uid>)` and confirming `emailVerified === true`. Capture timestamp under `bootstrap_log_luke_emailVerified_set_at:` in `06-PREFLIGHT.md ## Cutover Log`.

### Step 3: Verify claims via getIdTokenResult (~2 min)

Operator opens https://baselayers.bedeveloped.com (or the Firebase default URL pre-cutover) in an incognito window, signs in with Luke's credentials, and runs in DevTools console:

```javascript
firebase.auth().currentUser.getIdTokenResult(true).then(r => console.log(r.claims))
```

Expected output: `{ role: "admin", orgId: null, ... }` (the standard Firebase claims plus the role + orgId from `beforeUserCreated`).

If `role` is absent: **ABORT cutover**. `beforeUserCreated` did not see the allowlist doc; investigate before proceeding (most likely cause: case mismatch on the allowlist docId — verify `email.toLowerCase()` in the seed script ran cleanly via `--verify`).

Capture the claims output under `admin_signin_claims_verified.luke:` in `06-PREFLIGHT.md ## Cutover Log`.

### Step 4: Repeat Steps 1-3 for george@bedeveloped.com (~6 min)

Same procedure; capture george uid + emailVerified confirmation + claims verification under the equivalent `*_george_*` keys in `06-PREFLIGHT.md ## Cutover Log`.

### Step 5: OOB temp-credential delivery (operator-defined channel)

Per D-06: operator delivers the temp credentials to each admin via a secure channel of operator's standard practice. The runbook does NOT prescribe the channel (e.g., voice call, password manager invite, GPG-encrypted message). Capture the delivery method in `06-PREFLIGHT.md ## Cutover Log` under `oob_credential_delivery_method:` only AFTER-the-fact (post-cutover) — do NOT pre-record to avoid leaking the channel choice into pre-cutover artefacts.

### Step 6: First-sign-in walkthrough (each admin)

1. Admin opens https://baselayers.bedeveloped.com in an incognito window.
2. Enters email + temp password.
3. App prompts password change (D-05 force-password-change pattern).

   **WARNING-FIX: canonical path** — Identity Platform does NOT expose a "must change password on next sign-in" flag programmatically; `admin.auth().setCustomUserClaims(uid, {forcePasswordChange: true})` is NOT enforced server-side. The locked canonical mechanism is:
   - operator delivers a temp password OOB (Step 5);
   - admin signs in;
   - the `renderFirstRun` view (per `06-03 D-16` router rule "user.firstRun === true → renderFirstRun") detects the first-sign-in state via a `firstRun: true` custom claim set as part of bootstrap (either by the seed script, or by a manual one-off Admin SDK `setCustomUserClaims` call — Wave 5 wiring contract);
   - `renderFirstRun` calls `deps.updatePassword(newPassword)`;
   - on success, an Admin SDK callable clears the `firstRun` claim.

   This is a Phase 6 Wave 5 wiring contract (Pitfall 19: do NOT claim "force password change" without this exact flow rehearsed). Admin sets a new password (≥12 chars enforced server-side by passwordPolicy + HIBP per AUTH-04).

4. App routes to `renderEmailVerificationLanding` (D-14 / D-16) — admin will NOT see this if Step 2 set `emailVerified=true`; if they do see it, **ABORT** and re-verify Step 2 (re-run the Admin SDK `updateUser` call + re-fetch).
5. App routes to `renderMfaEnrol` (D-16 + D-08) — admin scans QR code with TOTP authenticator + enters 6-digit code + submits. Capture `luke_mfa_enrolled_at:` (or george) in `06-PREFLIGHT.md ## Cutover Log`.
6. App routes to dashboard. Admin is fully signed in.

---

## Bootstrap Log

```
bootstrap_date: <YYYY-MM-DD HH:MM TZ>
mfa_runtime_check_passed: yes
luke_uid: <uid>
luke_emailVerified_set_at: <HH:MM:SS TZ>
luke_claims_verified: yes (role=admin in ID token at HH:MM:SS TZ)
luke_first_signin_at: <HH:MM:SS TZ>
luke_password_changed_at: <HH:MM:SS TZ>
luke_mfa_enrolled_at: <HH:MM:SS TZ>
george_uid: <uid>
george_emailVerified_set_at: <HH:MM:SS TZ>
george_claims_verified: yes
george_first_signin_at: <HH:MM:SS TZ>
george_password_changed_at: <HH:MM:SS TZ>
george_mfa_enrolled_at: <HH:MM:SS TZ>
oob_credential_delivery_method: <captured post-cutover>
```

---

## Citations

- Phase 6 D-05 (operator-driven Console creation with internalAllowlist seeded first)
- Phase 6 D-06 (OOB credential delivery operator-defined; runbook does not prescribe channel)
- Phase 6 D-08 (MFA hard-enforced for internal users)
- Phase 6 D-14 (AUTH-11 belt-and-braces email verification)
- Phase 6 D-16 (router auth-state ladder: unauthed → signin → email-verify → first-run → mfa-enrol → dashboard)
- Phase 6 D-20 (Pitfall 13 secret pattern via ADC; no service-account JSON in source)
- Pitfall 6 (custom claims propagation lag — claims-set-on-creation closes this)
- Pitfall 19 (compliance theatre — do NOT claim force-password-change without the exact wiring rehearsed)
- ARCHITECTURE.md §8 (emails lowercased in internalAllowlist)
- AUTH-02 / AUTH-04 / AUTH-05 / AUTH-08 / AUTH-11 / AUTH-15
