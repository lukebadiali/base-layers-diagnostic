# scripts/seed-internal-allowlist

Phase 6 Wave 4 (D-05 / D-20 / Pitfall 13): one-shot Admin-SDK script that seeds the `internalAllowlist/{lowercasedEmail}` documents BEFORE the operator Console-creates Luke + George as Auth users.

## Why

The `beforeUserCreated` blocking Cloud Function (Phase 6 Wave 2) reads `internalAllowlist/{lowercasedEmail}` and sets `customClaims = { role, orgId }` on user creation. For Luke + George to be admins in their first ID token, the allowlist docs MUST exist BEFORE Console creation. Pitfall 6 mitigation #3 (claims-set-on-creation, no refresh dance for bootstrap admins).

## Prerequisites

- Operator has run `gcloud auth application-default login` (so Application Default Credentials work locally — Pitfall 13 / D-20).
- Operator's gcloud account has `Cloud Datastore User` role on `bedeveloped-base-layers`.
- Phase 6 Wave 2 functions are deployed (so `beforeUserCreated` is live and ready to read these docs).
- **`mfa.state` is ENABLED + TOTP provider configured** in the Firebase Identity Platform Console (carry-forward from `06-PREFLIGHT.md` — Phase 6 hard-enforces TOTP MFA via D-08; live admin enrolment will fail if `mfa.state` is still `DISABLED`). Verify before running this script via the bootstrap runbook Step 0.
- `firebase-admin` SDK available — script invokes via the `functions/` workspace where firebase-admin is pinned in `functions/package.json`. Run from the `functions/` directory: `cd functions && node ../scripts/seed-internal-allowlist/run.js`.

## Usage

Dry run (no writes; safe preview):

```sh
cd functions && node ../scripts/seed-internal-allowlist/run.js --dry-run
```

Real run:

```sh
cd functions && node ../scripts/seed-internal-allowlist/run.js
```

Real run + read-back verification:

```sh
cd functions && node ../scripts/seed-internal-allowlist/run.js --verify
```

Help:

```sh
cd functions && node ../scripts/seed-internal-allowlist/run.js --help
```

## Expected outcome

Two documents created (or upserted via `set({ merge: true })`) at:

- `internalAllowlist/luke@bedeveloped.com` -> `{ role: "admin", addedBy: "phase-6-bootstrap", addedAt: <serverTimestamp> }`
- `internalAllowlist/george@bedeveloped.com` -> `{ role: "admin", addedBy: "phase-6-bootstrap", addedAt: <serverTimestamp> }`

`set({ merge: true })` makes the script naturally idempotent — re-running it does not double-write or corrupt existing fields.

## When this runs

Step 3 of `runbooks/phase6-cutover.md` (single-session atomic cutover, after the auth-blocking + callable Cloud Functions deploy in Step 2 and before Console creation in Step 4). Stdout from this run is captured under `seed_script_output:` in `06-PREFLIGHT.md ## Cutover Log`.

## Audit narrative

- ARCHITECTURE.md §8 invariant: emails are stored under the lowercased email as doc ID. `email.toLowerCase()` is applied at the only write site in this script.
- `addedBy: "phase-6-bootstrap"` discriminates these seeded docs from any future operator-added entries (Phase 7+ will surface allowlist management UI; provenance is preserved).
- `addedAt` server timestamp lets later phases trace "when did Luke/George become admins" without depending on git history.

## Citations

- Phase 6 D-05 (operator-driven Console creation with internalAllowlist seeded first)
- Phase 6 D-20 (Pitfall 13 secret pattern via ADC; no service-account JSON in source)
- Pitfall 4 (Admin SDK MUST NOT be imported into src/)
- Pitfall 5 (always have a dry-run path on one-shot mutation scripts)
- Pitfall 6 (custom claims propagation lag — claims-set-on-creation closes this)
- ARCHITECTURE.md §8 (emails lowercased in internalAllowlist)
