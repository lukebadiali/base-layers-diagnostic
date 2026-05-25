# Phase 6 MFA Recovery Drill Runbook

> Phase 6 Wave 4 deliverable; drilled live in Wave 5. Captures the AUTH-10 two-tier MFA recovery procedure (D-08) — Tier 1 (user-side, expected path) and Tier 2 (operator-side, fallback for catastrophic loss). Drilled live during the cutover session per D-08; each admin takes a turn being the locked-out actor against the production Firebase project.

This runbook is intentionally executor-deferred. The drill is the audit-evidence substrate (Pitfall 19 — "claim only what was rehearsed"); the runbook captures both procedures + the evidence template that gets populated during the live drill in Wave 5.

---

## Background — AUTH-09 SUPERSEDED (D-07)

Per Phase 6 D-07, **AUTH-09** (10 hashed recovery codes generated at MFA enrolment) is **SUPERSEDED 2026-05-08 by email-link recovery**. No pre-generated recovery codes exist; the `users/{uid}.recoveryCodeHashes[]` field is never created.

**Tradeoff captured in SECURITY.md §Multi-Factor Authentication (Wave 6):** email-account compromise enables MFA recovery via the Tier-1 path below. Mitigation: the same email is the primary identifier and ID recovery substrate, so the additional risk surface is bounded; both admins are expected to maintain modern email-account hygiene (TOTP / passkey / hardware-key on the email provider).

---

## Tier 1 — User-side recovery (expected path)

Self-service procedure when the user has lost access to their TOTP authenticator but retains email-account access.

### Procedure

1. **User clicks "Forgot 2FA?" on the sign-in screen** — sibling button next to "Forgot password?" in `renderSignIn` (BLOCKER-FIX 3 ships this as the `renderForgotMfa` view in `06-03`).
2. `renderForgotMfa` view collects email + calls `deps.sendSignInLinkToEmail(email, { url: <origin>/?mfaRecovery=1, handleCodeInApp: true })`. Firebase emails the user a single-use sign-in link.
3. **User clicks the link in their inbox.** `main.js`'s email-link handler (Wave 5 wiring contract) detects `isSignInWithEmailLink(window.location.href) === true`, completes the sign-in via `signInWithEmailLink(email, url)`, and routes to `renderForgotMfa` Step B.
4. `renderForgotMfa` Step B's "I've signed in — un-enrol my 2FA and start over" button calls `deps.unenrollAllMfa()`, which iterates `multiFactor(currentUser).enrolledFactors` and unenrols each via `multiFactor(currentUser).unenroll(factor)`.
5. Router auto-routes to `renderMfaEnrol`; user re-enrols TOTP via the standard Wave 3 flow.

**BLOCKER-FIX 3 note:** Earlier drafts said "if the UI is not present, surface as a manual command-line procedure." This language is removed; the UI surface IS shipped in `06-03` as `renderForgotMfa`.

### When this fails (Tier 2 escalation triggers)

- Email account compromised → Tier 2 procedure is the only path.
- Email account inaccessible (password lost, MFA on the email provider also lost) → Tier 2 procedure is the only path.
- User is admin and the system can't tolerate the lockout window → Tier 2 procedure is faster.

---

## Tier 2 — Operator-side recovery (fallback)

Other admin runs the Admin SDK turn-key script `scripts/admin-mfa-unenroll/run.js` after OOB identity verification (voice/video call confirming identity, per Pitfall 7). Drilled live during Wave 5 cutover per D-08.

**BLOCKER-FIX 4 note:** Earlier drafts referenced `firebase auth:multifactor:list` / `firebase auth:multifactor:unenroll` CLI subcommands. These were not verified to exist in the firebase-tools version pinned for this milestone. The **Admin SDK path is canonical**; the CLI commands at the bottom of this section are listed only as an experimental fallback if a future firebase-tools release ships them — do NOT rely on them on cutover day.

### Procedure (canonical — Admin SDK path)

1. **OOB identity verification.** Operating admin verifies the locked-out admin's identity via voice or video call. Capture: channel + verification timestamp.
2. **List enrolled factors via Admin SDK** (informational; the un-enrol script does not require the factorId — it clears all factors). Operating admin runs:

   ```sh
   cd functions && node -e '
   const admin = require("firebase-admin");
   admin.initializeApp({projectId: "bedeveloped-base-layers"});
   admin.auth().getUser("<locked-out uid>")
     .then(u => { console.log(JSON.stringify(u.multiFactor, null, 2)); process.exit(0); })
     .catch(e => { console.error("[FAIL]", e); process.exit(1); });
   '
   ```

   Capture the `factorId` of the TOTP factor for the drill evidence block.

3. **Un-enrol all MFA factors via Admin SDK turn-key script (BLOCKER-FIX 4 canonical).** Operating admin runs:

   ```sh
   cd functions && node ../scripts/admin-mfa-unenroll/run.js --uid <locked-out uid>
   ```

   This wraps `admin.auth().updateUser(uid, {multiFactor: {enrolledFactors: []}})`. The script prints `[OK] uid=<uid> mfa cleared` on success.

4. **Locked-out admin signs in.** Now without the MFA gate, signs in with email + password.
5. **Locked-out admin re-enrols TOTP.** Standard Wave 3 `renderMfaEnrol` flow.

### Experimental fallback (firebase-tools CLI — NOT verified at milestone pin)

If a future firebase-tools release ships native MFA subcommands, the equivalent CLI invocation would be:

```sh
firebase auth:multifactor:unenroll --uid <locked-out uid> --factor <factorId> --project bedeveloped-base-layers
```

This is NOT the cutover-day path — see the canonical Admin SDK procedure above. Listed only for future-firebase-tools compatibility.

### Procedure timing target

End-to-end Tier-2 drill: **< 15 minutes** (excluding OOB identity verification time, which is operator-paced).

---

## Drill Evidence — Round 1 (luke as locked-out actor)

```
drill_date: <YYYY-MM-DD HH:MM TZ>
locked_out_uid: <luke uid>
locked_out_email: luke@bedeveloped.com
operator_uid: <george uid>
step_1_oob_identity_verification:
  channel: <e.g. "voice call">
  verified_at: <HH:MM:SS TZ>
  duration_seconds: <int>
step_2_list_enrolled_factors:
  ran_at: <HH:MM:SS TZ>
  totp_factorId: <factorId>
  exit_code: 0
step_3_admin_sdk_unenroll:
  command: cd functions && node ../scripts/admin-mfa-unenroll/run.js --uid <luke uid>
  ran_at: <HH:MM:SS TZ>
  exit_code: 0
  before_factor_count: 1
  after_factor_count: 0
step_4_locked_out_user_signin:
  attempted_at: <HH:MM:SS TZ>
  ms_to_signin_success: <int>
step_5_re_enrol_totp:
  attempted_at: <HH:MM:SS TZ>
  ms_to_enrol_success: <int>
total_drill_seconds: <int>
gaps_observed: <freeform>
```

---

## Drill Evidence — Round 2 (george as locked-out actor)

[Same shape as Round 1; admins swap roles per D-08 ("each admin takes a turn being the locked-out actor").]

```
drill_date: <YYYY-MM-DD HH:MM TZ>
locked_out_uid: <george uid>
locked_out_email: george@bedeveloped.com
operator_uid: <luke uid>
step_1_oob_identity_verification:
  channel: <e.g. "voice call">
  verified_at: <HH:MM:SS TZ>
  duration_seconds: <int>
step_2_list_enrolled_factors:
  ran_at: <HH:MM:SS TZ>
  totp_factorId: <factorId>
  exit_code: 0
step_3_admin_sdk_unenroll:
  command: cd functions && node ../scripts/admin-mfa-unenroll/run.js --uid <george uid>
  ran_at: <HH:MM:SS TZ>
  exit_code: 0
  before_factor_count: 1
  after_factor_count: 0
step_4_locked_out_user_signin:
  attempted_at: <HH:MM:SS TZ>
  ms_to_signin_success: <int>
step_5_re_enrol_totp:
  attempted_at: <HH:MM:SS TZ>
  ms_to_enrol_success: <int>
total_drill_seconds: <int>
gaps_observed: <freeform>
```

---

## § Client users (Phase 06.1 extension)

### Scope

A client user (`role: "client"`) has MFA enrolled (opt-in per Phase 06.1 CONTEXT D-10) and has lost their TOTP device PLUS their email-link recovery substrate (i.e. the Tier-1 self-serve path is unavailable).

### Tier-1 (user-side, expected path)

Same as internal admins — `sendSignInLinkToEmail` to the verified email → user re-authenticates via the link → user un-enrols TOTP themselves via `multiFactor(currentUser).unenroll(...)` → user re-enrols TOTP from their account settings (Security panel, CONTEXT D-10 surface). The substrate is `src/firebase/auth.js`; the audit event `auth.recovery.requested` is written via the existing pipeline.

### Tier-2 (operator-side, fallback for catastrophic loss)

When email access itself is compromised (Tier-1 unreachable) for a client user:

1. **Out-of-band identity verification.** Operator (the admin who originally invited the client OR a paired second admin) verifies the client user's identity via voice/video call. Confirm name + org context + the invite event (date / org name). Capture: channel + verification timestamp.
2. **Operator clears all enrolled MFA factors via Admin SDK.** Run:

   ```sh
   cd functions && node -e '
   const admin = require("firebase-admin");
   admin.initializeApp({projectId: "bedeveloped-base-layers"});
   admin.auth().updateUser("<client uid>", { multiFactor: { enrolledFactors: [] } })
     .then(() => { console.log("[OK] mfa cleared for <client uid>"); process.exit(0); })
     .catch(e => { console.error("[FAIL]", e); process.exit(1); });
   '
   ```

   (Equivalent to running `scripts/admin-mfa-unenroll/run.js --uid <client uid>` if extended for client uids; the script accepts any uid by design.)
3. **Operator re-invokes `inviteClient(email, name, orgId, orgPassphrase, confirmReset: true)`** via an in-app admin action — this resets the client's password back to the current org passphrase + re-flips `firstRun: true` + emits `auth.client.invite.resend`. The recovery channel is now identical to first-invite.
4. **Client signs in** with their email + the current org passphrase. The `firstRun: true` claim routes through `renderFirstRun`; the client sets a new personal password (≥6 chars per the existing Phase 6 substrate); the chained `setClaims` callable drops `firstRun`; the next ID-token refresh routes to dashboard. The client can then opt-in to MFA again via the Security panel.

### Audit trail

4 events captured in `auditLog/` for a complete Tier-2 client MFA recovery:

- `auth.mfa.unenrol` (admin-initiated) — Step 2 above.
- `auth.client.invite.resend` (admin-initiated) — Step 3 above.
- `auth.signin.success` (client) — Step 4 sign-in success.
- `auth.password.change` (client) — Step 4 first-run password set via `updatePassword`.

### Drill cadence

Combined with the internal-admin AUTH-10 drill. The next paired-review session exercises both internal + client recovery paths (each admin takes turns being the locked-out actor on both client and internal sides, per D-08 cadence). Audit-evidence capture follows the existing AUTH-10 drill template (Round 1 / Round 2 evidence blocks above).

### Self-serve password reset (separate from MFA recovery)

Clients who simply forget their password (no MFA loss) use Firebase Auth's built-in flow: `sendPasswordResetEmail` (Phase 6 D-15 + `src/firebase/auth.js`). The legacy admin-side reset-via-passwordHash mutation in the Admin Clients table was DELETED in Phase 06.1 Wave 3 cutover (atomic with the legacy substrate removal); the residual mechanism is the user-side `Forgot password` flow on the sign-in screen.

---

## AUTH-10 Closure Criteria

AUTH-10 closes when **all** of the following are true:

- [ ] Round 1 `drill_date` populated with a real timestamp
- [ ] Round 1 `step_3_admin_sdk_unenroll.exit_code` = 0
- [ ] Round 1 `step_4_locked_out_user_signin` succeeded
- [ ] Round 2 `drill_date` populated with a real timestamp
- [ ] Round 2 `step_3_admin_sdk_unenroll.exit_code` = 0
- [ ] Round 2 `step_4_locked_out_user_signin` succeeded
- [ ] `gaps_observed` for both rounds either empty OR explicitly accepted in `SECURITY.md §Multi-Factor Authentication` (Wave 6)

---

## Citations

- Phase 6 D-07 (AUTH-09 superseded by email-link recovery)
- Phase 6 D-08 (MFA hard-enforced; two-tier recovery)
- Phase 6 D-18 (SECURITY.md §Multi-Factor Authentication captures drill evidence)
- AUTH-10 (two-admin recovery procedure drilled live)
- BLOCKER-FIX 3 (Tier-1 user-side UI surface — `renderForgotMfa` ships in 06-03)
- BLOCKER-FIX 4 (Tier-2 canonical Admin SDK script `scripts/admin-mfa-unenroll/run.js`)
- Pitfall 7 (MFA enrolment lockout — Tier 2 procedure mitigation)
- Pitfall 19 (compliance theatre — drill IS the evidence)
- `scripts/admin-mfa-unenroll/run.js` (canonical Tier-2 turn-key script)
- `runbooks/phase6-cutover.md` Step 10 (drill is invoked from the cutover sequence)
