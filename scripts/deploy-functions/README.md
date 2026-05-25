# scripts/deploy-functions

One-shot Functions deploy script for operator workstations.

## Why

CI (`.github/workflows/ci.yml`) deploys Hosting + Rules on every push to `main` but **EXCLUDES Functions** — the firebase-tools functions deploy attempts to touch IAM bindings that the WIF identity used by CI is not granted (D-8/D-9 substrate gap documented inline in the workflow). So any change under `functions/src/**` needs a manual deploy from an operator workstation with the right credentials.

## When to run

After any merge to `main` that touches `functions/src/**`. Most recently relevant: **PLATFORM-UAT F1-B** dropped `enforceAppCheck: true` from 7 callables (setClaims, auditWrite, checkRateLimit, softDelete, getDocumentSignedUrl, gdprExportUser, gdprEraseUser) to unblock incognito client first-run.

## Preconditions

- `firebase-tools` installed and on PATH: `npm i -g firebase-tools`
- Authenticated: `firebase login` (one-time; firebase-tools uses its own credential store, NOT gcloud's)
- Operator account has Functions deploy permissions on the `bedeveloped-base-layers` project

## Usage

```bash
# Full deploy
node scripts/deploy-functions/run.mjs

# Print plan without deploying
node scripts/deploy-functions/run.mjs --dry-run

# Help
node scripts/deploy-functions/run.mjs --help
```

The script:

1. Confirms `firebase-tools` is on PATH
2. Confirms an active `firebase login`
3. `npm ci` + `npm run build` inside `functions/`
4. Runs `firebase deploy --only functions --project bedeveloped-base-layers`

Exit codes:
- `0` — deploy succeeded
- `1` — precondition failed (missing tool, not logged in, etc.)
- `2` — build failed (TypeScript compile error)
- `3` — deploy command failed (check stderr for IAM / network / secret-manager errors)

## What to do after a successful deploy

Hard-reload the app (`Ctrl+Shift+R` on `baselayers.bedeveloped.com`) so any cached App Check tokens or stale function URLs flush. Then exercise whichever flow the change targeted (for F1-B: incognito client first-run + chat + document download).
