# Synthetic Slack Alert Verification

**Phase 9 Wave 5 — OBS-05 evidence script**

Posts a synthetic alert message to the configured Slack incoming webhook so an
operator can confirm the channel + URL end-to-end before the
`authAnomalyAlert` Cloud Function ever fires a real alert. Wave 6 close-gate
(Plan 09-05) uses this script to satisfy the OBS-05 success criterion:
"an operator receives a synthetic test alert end-to-end."

## Prerequisites

1. **`SLACK_WEBHOOK_URL` secret** must exist in Google Secret Manager (project
   `bedeveloped-base-layers`). The Wave 1 runbook
   (`runbooks/phase-9-sentry-bootstrap.md` Step 5) covers provisioning.
2. **`gcloud` CLI** authenticated with read access to the secret (preferred
   path), OR a one-shot inline copy of the URL (local dev path).
3. **Node 22** (project engine pin) — `fetch` is built-in; no additional deps.

## Usage

### Preferred — pull from Secret Manager

```bash
SLACK_WEBHOOK_URL=$(gcloud secrets versions access latest \
  --secret=SLACK_WEBHOOK_URL \
  --project=bedeveloped-base-layers) \
  node scripts/test-slack-alert/run.js
```

This is the operator path used at the Wave 6 close-gate. Pulling from Secret
Manager (rather than committing the URL to a runbook or .env file) is the
defence-in-depth practice — Pitfall 4 from `09-RESEARCH.md`.

### Local one-shot — paste the URL inline

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../... \
  node scripts/test-slack-alert/run.js
```

Use this only for ad-hoc local testing. Never commit a real URL to git —
`.gitleaks.toml` (extended in this plan, Task 4) regex-blocks the Slack
webhook URL shape from being committed.

## Exit Codes

| Exit | Meaning                                                         |
| ---- | --------------------------------------------------------------- |
| 0    | Success — POST returned 2xx; operator should now see message    |
| 1    | `SLACK_WEBHOOK_URL` env var not set                             |
| 2    | POST failed (non-2xx response, network error, or fetch threw)   |

## Idempotency

This script is safe to re-run. Slack accepts unbounded duplicates on a webhook
URL — running this script ten times in a row simply posts ten synthetic
messages. The synthetic-message body includes the marker
`:white_check_mark: Phase 9 OBS-05 synthetic test alert (operator-verifiable;
safe to dismiss)` so they're easy to triage.

## Cross-References

- `functions/src/observability/authAnomalyAlert.ts` — the production trigger
  that consumes the same `SLACK_WEBHOOK_URL` secret via `defineSecret()`.
- `runbooks/phase-9-sentry-bootstrap.md` Step 5 — secret provisioning.
- Plan 09-05 (Wave 6) close-gate — uses this script as one of the OBS-05
  evidence artefacts.
- `.gitleaks.toml` — Slack webhook URL regex extension (Task 4 of this plan)
  prevents the secret from leaking into commits.

## Manual Sanity Verification

Without a real webhook URL, you can confirm the script's exit-code contract:

```bash
# Exit 1: no env var
unset SLACK_WEBHOOK_URL
node scripts/test-slack-alert/run.js; echo "exit=$?"
# Expected: stderr "ERROR: SLACK_WEBHOOK_URL not set" + exit=1

# Exit 2: URL formed correctly but unreachable
# (use a non-Slack hostname so .gitleaks.toml's slack-webhook-url regex
#  doesn't false-positive on this example — see Task 4 of Plan 09-04)
SLACK_WEBHOOK_URL=https://hooks-fakehost.invalid/services/T.../B.../... \
  node scripts/test-slack-alert/run.js; echo "exit=$?"
# Expected: stderr "ERROR: Slack POST threw: TypeError fetch failed" + exit=2
```
