# scripts/strip-legacy-user-passwords

Phase 06.1 Wave 3 (AUTH-18 / D-17 / Pitfall 13): one-shot Admin-SDK script that defensively strips the legacy `passwordHash` field from every `users/{uid}` Firestore document that still carries it.

## Why

The Phase 06.1 Wave 3 cutover commit deleted `setUserPassword` (the only source-side writer of `users/{uid}.passwordHash`) atomically alongside the legacy `src/auth/state-machine.js` module, the legacy client sign-in branch, the `openChangePasswordModal` modal, the chrome user-menu Change-password entry, and the Admin Clients table passwordHash zones. With no remaining writers, the `passwordHash` field becomes orphaned data on any user doc that received it under the legacy code path.

This script is the defensive sweep that closes the data-side of HANDOFF.md follow-up #9 (Phase 6 D-04 / AUTH-14 left the field on disk because the writer survived; Phase 06.1 Wave 3 removes the writer + this script removes the data). Per HANDOFF.md (2026-05-22), no live client users exist on production — the expected stripped count is `0`. Any non-zero count is a defensive-substrate finding that surfaces a code path that wrote `passwordHash` despite the cutover.

## Prerequisites

- Operator has run `gcloud auth application-default login` (so Application Default Credentials work locally — Pitfall 13 / D-20).
- Operator's gcloud account has `Cloud Datastore User` role on `bedeveloped-base-layers`.
- Phase 06.1 Wave 3 cutover commit has landed on `main` (this script's narrative depends on the source-side writer being gone — otherwise re-running the strip on a code-base that still writes `passwordHash` would just re-populate the field on subsequent client-side mutations).
- `firebase-admin` SDK available — the script invokes via the `functions/` workspace where firebase-admin is pinned in `functions/package.json`. Run from the `functions/` directory: `cd functions && node ../scripts/strip-legacy-user-passwords/run.js`.

## Usage

Dry run (no writes; safe preview):

```sh
cd functions && node ../scripts/strip-legacy-user-passwords/run.js --dry-run
```

Real run:

```sh
cd functions && node ../scripts/strip-legacy-user-passwords/run.js
```

Real run + read-back verification:

```sh
cd functions && node ../scripts/strip-legacy-user-passwords/run.js --verify
```

Help:

```sh
cd functions && node ../scripts/strip-legacy-user-passwords/run.js --help
```

## Expected outcome

Per HANDOFF.md (no live client users on production):

```
[OK] Scan complete. 0 doc(s) stripped (expected 0 per HANDOFF.md — no live client users).
[OK] No legacy passwordHash fields found — Phase 6 + Phase 06.1 cutover narrative confirmed.
```

If the script finds residual `passwordHash` fields (count > 0), it removes them via `FieldValue.delete()`. Idempotent — re-running the script on a clean dataset returns `0 doc(s) stripped` without error.

## When this runs

Wave 3 of Phase 06.1; after the cutover commit lands; before the `/gsd-verify-work 06.1` operator UAT checkpoint. Sequence:

1. Cutover commit (Task 1) lands.
2. Operator runs `gcloud auth application-default login` to bind ADC.
3. Operator runs `--dry-run` first to preview.
4. Operator reviews; if dry-run reports 0 (expected per HANDOFF.md), optionally re-runs without `--dry-run` to confirm idempotent behaviour (still 0). If dry-run reports 1+: pause, investigate which uid carries `passwordHash` and when it was written, document the deviation, then run for real.
5. Cleanup ledger row C-06.1-10 closes when the strip-script execution is captured in `runbooks/06.1-uat-evidence.md`.

## Audit narrative

- **HANDOFF.md follow-up #9 closure (data-side):** the cutover commit (Task 1) retires the source-side writer; this script retires the on-disk data. Together they close the gap.
- **SECURITY.md cross-reference:** see `## § Client Authentication` + `## § Phase 06.1 Audit Index` for the full Wave 3 narrative.
- **REQUIREMENTS.md cross-reference:** AUTH-18 — "Admin SDK one-shot script strips passwordHash from existing user docs in production."
- **Defensive substrate posture:** the script ships independently of any expected-non-zero workload because the existence of the field on disk is itself audit-evidence the cleanup needs. Even with HANDOFF.md asserting count 0, future auditors checking the data-side narrative want this script in the commit chain.

## Citations

- Phase 06.1 D-17 (Admin SDK ADC pattern; mirror Phase 6 D-20 `seed-internal-allowlist`)
- Phase 06.1 RESEARCH § 9 (verbatim strip loop)
- Pitfall 4 (Admin SDK MUST NOT be imported into src/)
- Pitfall 5 (always have a dry-run path on one-shot mutation scripts)
- Pitfall 13 (Cloud Functions secret management — ADC instead of service-account JSON)
- HANDOFF.md follow-up #9 (state-machine.js + passwordHash residual gap)
