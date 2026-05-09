# scripts/admin-mfa-unenroll

Phase 6 Wave 4 (BLOCKER-FIX 4 / AUTH-10 / D-08): one-shot Admin-SDK turn-key script for the AUTH-10 Tier-2 recovery drill (operator-side fallback when a user has lost access to their TOTP authenticator AND email-link Tier-1 recovery is not viable).

## Why

Earlier Phase 6 drafts referenced `firebase auth:multifactor:list` / `firebase auth:multifactor:unenroll` CLI subcommands. These were not verified to exist in the firebase-tools version pinned for this milestone. Admin SDK `admin.auth().updateUser(uid, {multiFactor: {enrolledFactors: []}})` is the documented authoritative path. This script wraps it as a turn-key invocation so the operator has a single command on cutover day and during future MFA recovery incidents.

## Prerequisites

- Operator has run `gcloud auth application-default login` (so Application Default Credentials work locally — Pitfall 13 / D-20; no service-account JSON in source).
- Operator's gcloud account has `Firebase Authentication Admin` role on `bedeveloped-base-layers`.
- Operator has performed OOB identity verification with the locked-out user (per Pitfall 7 + AUTH-10 procedure step 1 — voice/video call confirming identity).
- `firebase-admin` SDK installed in the `functions/` workspace (already pinned in `functions/package.json`).

## Usage

Dry run (logs BEFORE state + intent; no mutations):

```sh
cd functions && node ../scripts/admin-mfa-unenroll/run.js --uid <uid> --dry-run
```

Real run:

```sh
cd functions && node ../scripts/admin-mfa-unenroll/run.js --uid <uid>
```

Help:

```sh
cd functions && node ../scripts/admin-mfa-unenroll/run.js --help
```

## Expected output

```
[BEFORE] uid=<uid> enrolled_factors=1
  - factorId=<factorId> factor=phone displayName=(none)
[OK] uid=<uid> mfa cleared (was 1 factor(s); now 0)
```

If the user has no enrolled factors, `[BEFORE]` reports `enrolled_factors=0` and the update is a no-op (still safe to run; idempotent).

## When this runs

Step 3 of `runbooks/phase6-mfa-recovery-drill.md` Tier-2 procedure. Drilled live during Wave 5 cutover per D-08 (each admin takes a turn being locked-out — Round 1 luke / Round 2 george).

## Audit narrative

Every invocation prints the BEFORE state (factor count + factorIds) and AFTER confirmation. Operator pastes stdout into the drill evidence block (`step_3_admin_sdk_unenroll` field) for AUTH-10 closure. This satisfies Pitfall 19's "claim only what was rehearsed" gate — the drill IS the evidence, and the script's stdout IS the artefact.

## Citations

- Phase 6 D-08 (MFA hard-enforced; Tier-2 operator-side fallback)
- Phase 6 D-20 (Pitfall 13 ADC convention)
- BLOCKER-FIX 4 (this script replaces the unverified firebase-tools CLI subcommand)
- AUTH-10 (two-admin recovery procedure drilled live)
- Pitfall 4 (Admin SDK MUST NOT be imported into src/ — this lives in scripts/)
- Pitfall 7 (MFA enrolment lockout — OOB identity verification is a prerequisite)
- Pitfall 19 (compliance theatre — drill evidence must come from real script invocations)
- `runbooks/phase6-mfa-recovery-drill.md` Tier-2 procedure (consumer of this script)
