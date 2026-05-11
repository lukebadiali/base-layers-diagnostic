# Phase 9 — GCP Monitors Bootstrap (Operator Runbook)

> Phase: 9 — Observability + Audit-Event Wiring
> Wave: 6 (Plan 09-05)
> Requirements: OBS-04 (paired with Wave 2 source-map upload) + OBS-06 + OBS-07 + OBS-08
> Date authored: 2026-05-10
> Objective: Single-operator-session procedure that provisions the three out-of-band
> observability monitors (GCP uptime check, Firebase budget alerts, Sentry quota
> alert) plus the `audit-alert-sa` service account and the two Secret Manager
> secrets (`SLACK_WEBHOOK_URL`, `SENTRY_DSN`) that Wave 5's `authAnomalyAlert`
> Cloud Function consumes via `defineSecret()`.

This is the second of two Phase 9 operator runbooks. The first
(`runbooks/phase-9-sentry-bootstrap.md`) covers Sentry org + project + DSN +
GitHub Actions secrets. This runbook covers everything else — the GCP-tier
monitors, the Cloud Function service account, and the Secret Manager secrets.
The third (`runbooks/phase-9-deploy-checkpoint.md`) is the deploy-day single
session that runs after both bootstrap runbooks are complete.

---

## Pre-conditions

- `runbooks/phase-9-sentry-bootstrap.md` Steps 1-5 are complete — Sentry
  organisation, EU-region project, DSN, auth token, and GitHub Actions
  `VITE_SENTRY_DSN` + `SENTRY_AUTH_TOKEN` secrets are all in place.
- `gcloud` CLI authenticated:
  ```bash
  gcloud auth login
  gcloud auth application-default login
  gcloud config set project bedeveloped-base-layers
  gcloud config get-value project
  # Expected: bedeveloped-base-layers
  ```
- Operator holds these roles on the project:
  - `roles/iam.serviceAccountAdmin` (Step 1 — create `audit-alert-sa`)
  - `roles/secretmanager.admin` (Step 2 — create + bind SLACK_WEBHOOK_URL + SENTRY_DSN secrets)
  - `roles/monitoring.editor` (Step 3 — create uptime check + alerting policy)
- Operator holds `roles/billing.user` on the billing account that owns
  `bedeveloped-base-layers` (Step 4 — budget creation).
- Operator has Sentry organisation admin access (Step 5 — quota alert config).
- Slack workspace admin access to create an Incoming Webhook (Step 2 — Slack
  side of SLACK_WEBHOOK_URL).

---

## Step 1: Provision `audit-alert-sa` service account (OBS-04, OBS-05 dependency)

Wave 5's `authAnomalyAlert` Cloud Function (deployed in `runbooks/phase-9-deploy-checkpoint.md`)
runs under a dedicated minimal-IAM service account named `audit-alert-sa`. The
Phase 7 `scripts/provision-function-sas/run.js` is the canonical SA provisioner
for the project; this runbook extends its SA list rather than spinning up a
parallel script.

### 1.1 — Add `audit-alert-sa` to the Phase 7 SA list

Verify the SA entry exists in `scripts/provision-function-sas/run.js`:

```bash
grep -E '"audit-alert-sa"' scripts/provision-function-sas/run.js
```

If the grep returns no match, the entry is missing — append the following to
the `TARGET_SAS` array in `scripts/provision-function-sas/run.js` and commit
to a follow-up branch BEFORE running the provisioner:

```javascript
{
  accountId: "audit-alert-sa",
  displayName: "Auth Anomaly Alert (Phase 9 authAnomalyAlert trigger)",
  // roles/datastore.user        → writes to authFailureCounters/{ipHash}
  // roles/datastore.viewer      → reads auditLog/{eventId} (trigger payload context)
  // roles/secretmanager.secretAccessor is granted on individual secrets in Step 2
  roles: ["roles/datastore.user", "roles/datastore.viewer"],
},
```

### 1.2 — Run the provisioner

```bash
# Dry-run first
node scripts/provision-function-sas/run.js --project=bedeveloped-base-layers --dry-run

# Real run (idempotent — existing SAs report `already-exists`)
node scripts/provision-function-sas/run.js --project=bedeveloped-base-layers
```

Expected: the summary table shows `audit-alert-sa@bedeveloped-base-layers.iam.gserviceaccount.com`
with status `created` (first run) or `already-exists` (re-run) and
`roles/datastore.user, roles/datastore.viewer` in the `added` column.

### 1.3 — Verify

```bash
gcloud iam service-accounts describe \
  audit-alert-sa@bedeveloped-base-layers.iam.gserviceaccount.com \
  --project=bedeveloped-base-layers \
  --format="value(email,displayName)"
# Expected: audit-alert-sa@bedeveloped-base-layers.iam.gserviceaccount.com  Auth Anomaly Alert (Phase 9 authAnomalyAlert trigger)
```

```
audit_alert_sa_created_at: <ISO timestamp>
operator: <handle / email>
```

---

## Step 2: Configure `SLACK_WEBHOOK_URL` + `SENTRY_DSN` secrets in Secret Manager

These are the secrets `functions/src/observability/authAnomalyAlert.ts` reads
at runtime via `defineSecret()`. They live in **GCP Secret Manager**, not in
GitHub Actions — only the Cloud Function consumes them, and CI/build jobs
never need them. The Wave-1 runbook explicitly excludes them from GitHub
secrets for this reason.

### 2.1 — Create the Slack Incoming Webhook (Slack admin step)

1. Slack admin console → Apps → Incoming Webhooks → Add to Slack.
2. Channel: `#ops-alerts` (or whichever channel the operator chooses for
   anomaly alerts — document the choice in the Cutover Log below).
3. Copy the webhook URL. It has the shape
   `https://hooks.slack.com/services/T.../B.../...` — `.gitleaks.toml`
   (extended in Plan 09-04 Task 4) blocks any commit of this URL pattern.

### 2.2 — Set both secrets in Secret Manager

CRITICAL: paste secret values via stdin only — never as command-line argument
(args are visible in process listings + shell history). The `printf "%s"`
piped to `gcloud secrets create --data-file=-` pattern keeps the value out of
all writable surfaces.

```bash
# SLACK_WEBHOOK_URL — Wave 5 anomaly trigger consumer
printf "%s" "<paste the Slack webhook URL here>" | \
  gcloud secrets create SLACK_WEBHOOK_URL \
    --data-file=- \
    --replication-policy=automatic \
    --project=bedeveloped-base-layers

# SENTRY_DSN — Wave 5 trigger forwards captureException to Sentry (Node DSN; can
# be the same DSN as VITE_SENTRY_DSN from the Wave 1 runbook — DSNs are not
# region-scoped on the SDK side; they encode project + ingest region only)
printf "%s" "<paste the Sentry DSN here>" | \
  gcloud secrets create SENTRY_DSN \
    --data-file=- \
    --replication-policy=automatic \
    --project=bedeveloped-base-layers
```

If either secret already exists, append a new version instead:

```bash
printf "%s" "<paste the URL>" | \
  gcloud secrets versions add SLACK_WEBHOOK_URL --data-file=- \
    --project=bedeveloped-base-layers
```

### 2.3 — Grant `audit-alert-sa` read access on both secrets

```bash
SA_EMAIL="audit-alert-sa@bedeveloped-base-layers.iam.gserviceaccount.com"

gcloud secrets add-iam-policy-binding SLACK_WEBHOOK_URL \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" \
  --project=bedeveloped-base-layers

gcloud secrets add-iam-policy-binding SENTRY_DSN \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" \
  --project=bedeveloped-base-layers
```

### 2.4 — Verify

```bash
# Both secrets exist
gcloud secrets list --project=bedeveloped-base-layers \
  --filter="name:SLACK_WEBHOOK_URL OR name:SENTRY_DSN" \
  --format="value(name)"
# Expected: 2 lines — SLACK_WEBHOOK_URL + SENTRY_DSN

# audit-alert-sa can read SLACK_WEBHOOK_URL
gcloud secrets get-iam-policy SLACK_WEBHOOK_URL \
  --project=bedeveloped-base-layers \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:${SA_EMAIL}" \
  --format="value(bindings.role)"
# Expected: roles/secretmanager.secretAccessor

# Verify the URL is retrievable (operator-side smoke test; DO NOT paste output anywhere)
gcloud secrets versions access latest --secret=SLACK_WEBHOOK_URL \
  --project=bedeveloped-base-layers > /dev/null && echo "[OK] SLACK_WEBHOOK_URL readable"
```

```
slack_webhook_url_created_at: <ISO>
sentry_dsn_created_at: <ISO>
audit_alert_sa_granted_secretAccessor: <YES|NO>
slack_channel: #ops-alerts (or operator's chosen channel)
```

---

## Step 3: Provision the GCP Cloud Monitoring uptime check (OBS-06)

`scripts/setup-uptime-check/run.js` shells out to `gcloud monitoring uptime
create` with the OBS-06 configuration. It's idempotent — re-running after the
first execution reports `[SKIP]` and exits 0.

### 3.1 — Pre-check

```bash
gcloud config get-value project
# Expected: bedeveloped-base-layers
```

### 3.2 — Dry-run, then real run

```bash
# Dry-run
node scripts/setup-uptime-check/run.js --dry-run --project=bedeveloped-base-layers

# Real run
node scripts/setup-uptime-check/run.js --project=bedeveloped-base-layers
```

Expected output (real run):

```
[OK] gcloud CLI found
[OK] created uptime check base-layers-diagnostic-prod (60s period, regions=USA,EUROPE,ASIA_PACIFIC)
[OK] Verify in Cloud Console > Monitoring > Uptime checks. ...
```

### 3.3 — Verify in Cloud Console

1. Cloud Console → Monitoring → Uptime checks.
2. See `base-layers-diagnostic-prod` row with check-status = Pass (first probe
   completes within 60s of creation).
3. Confirm the 3 regions are listed: USA, EUROPE, ASIA_PACIFIC.

### 3.4 — Configure the alerting policy that posts to Slack

The uptime check itself only PROBES; the alerting-policy layer is what fires
the Slack notification on failure. This step is Console-only because gcloud
alerting policies require YAML/MQL conditions that are messier in CLI form.

**Console steps:**

1. Cloud Console → Monitoring → Alerting → Create Policy.
2. Add condition: select the uptime check `base-layers-diagnostic-prod`;
   condition: "Failure for ≥ 2 minutes" (allows 2 consecutive failed probes
   before paging — tolerates transient flakes).
3. Notification channels: create a new Webhook channel if one does not exist:
   - Type: Webhook
   - Display name: `ops-alerts-slack`
   - Endpoint URL: the same Slack webhook URL stored in `SLACK_WEBHOOK_URL` —
     paste it here (the channel config IS the only operator surface that holds
     a copy of the URL outside Secret Manager; `.gitleaks.toml` does not scan
     Cloud Console configuration)
4. Policy name: `base-layers-prod-down`.
5. Save.

### 3.5 — Verify the uptime check + policy combination

```bash
gcloud monitoring uptime list-configs \
  --project=bedeveloped-base-layers \
  --format="value(displayName,httpCheck.path,httpCheck.requestMethod,period)"
# Expected: base-layers-diagnostic-prod  /  GET  60s
```

```
uptime_check_created_at: <ISO>
alerting_policy_name: base-layers-prod-down
alerting_policy_created_at: <ISO>
notification_channel_name: ops-alerts-slack
```

---

## Step 4: Provision the Firebase budget alert (OBS-07)

`scripts/setup-budget-alerts/run.js` creates a £100/month budget with
notification thresholds at 50%, 80%, and 100%. **Read the script README first
— budget alerts NOTIFY only, they do NOT cap spend.** (Pitfall 19 substrate-honest
disclosure; auto-cutoff via Pub/Sub-driven Function is v2 — out of scope for
Phase 9.)

### 4.1 — Pre-check

```bash
gcloud billing projects describe bedeveloped-base-layers \
  --format="value(billingAccountName)"
# Expected: billingAccounts/<account-id> — confirms billing is enabled
```

### 4.2 — Dry-run, then real run

```bash
# Dry-run (default amount: £100)
node scripts/setup-budget-alerts/run.js --dry-run --project=bedeveloped-base-layers

# Real run (default amount)
node scripts/setup-budget-alerts/run.js --project=bedeveloped-base-layers

# Optional — override the amount (e.g. for early hardening, set £50 instead)
BUDGET_AMOUNT=50 BUDGET_CURRENCY=GBP \
  node scripts/setup-budget-alerts/run.js --project=bedeveloped-base-layers
```

Expected output (real run):

```
[NOTE] Budget alerts NOTIFY only; they do NOT cap spend. ...
[OK] gcloud CLI found
[OK] resolved billing account: <account-id>
[OK] created budget base-layers-monthly (100 GBP/month, thresholds 50/80/100%)
```

### 4.3 — Verify in Cloud Console

1. Cloud Console → Billing → Budgets & alerts.
2. See `base-layers-monthly` row with 3 thresholds (50%, 80%, 100%).
3. Verify the budget is scoped to `projects/bedeveloped-base-layers` only.

### 4.4 — Substrate-honest disclosure (Pitfall 19)

The budget mechanism **does not** stop spending. If a denial-of-wallet attack
or runaway loop drives spend above the budget, the alert fires but the
project continues to bill. The credible mitigation for Phase 9 is:

- Operator email + Pub/Sub notification at all three thresholds (this runbook
  + Cloud Console default).
- Quarterly cleanup-ledger audit of actual spend vs budget (queued for Wave 7
  cleanup-ledger).
- v2 deferral: a Pub/Sub-subscribed Cloud Function that calls
  `gcloud billing projects unlink` on threshold=100%. NOT shipped in Phase 9
  because (1) the project is currently between engagements with negligible
  traffic; (2) accidentally unlinking billing breaks Firestore reads, so the
  cure is more dangerous than the disease while only Luke + George exist as
  bootstrap admin users.

Document this in the Cutover Log under Step 4 — the same disclosure will be
copied verbatim into the Wave 7 SECURITY.md § Observability section.

```
budget_created_at: <ISO>
budget_amount: 100 GBP / month (or operator override)
auto_cutoff_v2_deferral_acknowledged: YES
```

---

## Step 5: Configure Sentry 70% quota alert (OBS-08)

This step duplicates `runbooks/phase-9-sentry-bootstrap.md` Step 6 — kept
here for the single-session flow so the operator does not have to flip
between two runbooks during the bootstrap. If the Wave-1 runbook's Step 6 has
already been completed and `docs/evidence/phase-9-sentry-70pct-quota-alert.png`
exists, skip to Step 5.4 (verification) below.

### 5.1 — Sentry Web UI

1. Sentry web UI → Settings → Subscription → Quotas (or Subscription → Billing).
2. Locate "Quota Alerts" or "Spike Protection".
3. Configure: **Notify when monthly events reach 70% of quota**.
4. Channel: operator email (the email Sentry sends invoices to is fine).
5. Save.

### 5.2 — Screenshot evidence

Save the configured alert page to
`docs/evidence/phase-9-sentry-70pct-quota-alert.png`. This screenshot is the
OBS-08 close-gate artefact for the Phase 11 evidence pack.

### 5.3 — Fallback if UI omits 70% threshold

If the free tier UI does not expose a 70% threshold (Sentry UI has been in
flux), the substitute is "Spike Protection" (which fires on anomalous bursts)
plus a manual quarterly check that monthly volume is < 70% of quota.
Document whichever path was taken in the Cutover Log below.

### 5.4 — Verify

```
sentry_quota_alert_configured_at: <ISO>
sentry_quota_alert_threshold: 70% (or "Spike Protection — manual quarterly check")
sentry_quota_alert_evidence: docs/evidence/phase-9-sentry-70pct-quota-alert.png
```

---

## Step 6: Verification gate (all four artefacts visible)

Before declaring the bootstrap complete, the operator confirms ALL of the
following:

```bash
# 6.1 — audit-alert-sa exists
gcloud iam service-accounts list \
  --project=bedeveloped-base-layers \
  --format="value(email)" | grep audit-alert-sa
# Expected: audit-alert-sa@bedeveloped-base-layers.iam.gserviceaccount.com

# 6.2 — Both secrets in Secret Manager
gcloud secrets list --project=bedeveloped-base-layers \
  --filter="name:SLACK_WEBHOOK_URL OR name:SENTRY_DSN" \
  --format="value(name)"
# Expected: 2 lines — SLACK_WEBHOOK_URL, SENTRY_DSN

# 6.3 — Uptime check exists with 3 regions
gcloud monitoring uptime list-configs \
  --project=bedeveloped-base-layers \
  --filter="displayName:base-layers-diagnostic-prod" \
  --format="value(displayName,monitoredResource.labels.host)"
# Expected: base-layers-diagnostic-prod  baselayers.bedeveloped.com

# 6.4 — Budget exists with 3 thresholds
BILLING_ACCOUNT=$(gcloud billing projects describe bedeveloped-base-layers \
  --format="value(billingAccountName)" | sed 's|billingAccounts/||')
gcloud billing budgets list --billing-account=$BILLING_ACCOUNT \
  --format="value(displayName)" | grep base-layers-monthly
# Expected: base-layers-monthly

# 6.5 — Sentry quota alert visible (operator confirms in Sentry web UI;
#       no gcloud check available — Sentry config is out-of-band)
```

All five checks must return the expected output before proceeding to the
deploy checkpoint (`runbooks/phase-9-deploy-checkpoint.md`).

---

## Step 7: Output — record session in deploy-checkpoint Cutover Log

After completing Steps 1-6, the operator records start/finish times and
evidence links in `runbooks/phase-9-deploy-checkpoint.md` ## Cutover Log
section — that runbook is the canonical evidence anchor for the deploy day.

This runbook does NOT carry its own Cutover Log — it is a bootstrap runbook,
and the bootstrap evidence rolls up into the deploy-checkpoint runbook's log.
This avoids a two-log split problem where partial state ends up in different
files.

### Forward-tracking rows queued for Wave 7 cleanup-ledger

- **Quarterly uptime-check verification cadence** — operator confirms
  `gcloud monitoring uptime list-configs` returns the check; recorded in
  `runbooks/phase-9-cleanup-ledger.md` (Wave 7).
- **Sentry quota alert screenshot for docs/evidence/** — verify
  `phase-9-sentry-70pct-quota-alert.png` is committed to the repo (Phase 11
  evidence pack owner).
- **Quarterly budget vs actual-spend audit** — Wave 7 cleanup-ledger row to
  document the v2 auto-cutoff deferral status and re-evaluate quarterly.

---

## Troubleshooting

| Error | Cause | Resolution |
|-------|-------|------------|
| `gcloud monitoring uptime: error: argument --regions: expected at least 3 values` | Tried to use only 2 regions | Use `USA,EUROPE,ASIA_PACIFIC` — the script already does this |
| `failed to create budget: billing account not found` | Operator lacks `roles/billing.user` on the billing account | Check ADC identity; re-authenticate with the correct account, or escalate to a billing-account admin |
| `secret SLACK_WEBHOOK_URL already exists` (Step 2.2) | Re-running creation after first run | Use `gcloud secrets versions add` instead of `create` (Step 2.2 alternative) |
| `permission denied: roles/secretmanager.secretAccessor` (Step 2.3) | Operator lacks `roles/secretmanager.admin` on the project | Escalate to a project owner |
| Sentry UI shows no 70% threshold control | Sentry free tier UI has been in flux | Use Spike Protection + document the manual quarterly cadence (Step 5.3) |
| `audit-alert-sa not in scripts/provision-function-sas/run.js` | Phase 7 script not yet extended | Append the SA block per Step 1.1, commit, then run the provisioner |

---

## Rollback

If the bootstrap must be undone (e.g. wrong project, wrong budget amount):

```bash
# Uptime check
gcloud monitoring uptime delete base-layers-diagnostic-prod \
  --project=bedeveloped-base-layers

# Budget (irreversible if the billing account has audit-log retention)
BILLING_ACCOUNT=$(gcloud billing projects describe bedeveloped-base-layers \
  --format="value(billingAccountName)" | sed 's|billingAccounts/||')
gcloud billing budgets delete <BUDGET_RESOURCE_ID> --billing-account=$BILLING_ACCOUNT

# Secrets
gcloud secrets delete SLACK_WEBHOOK_URL --project=bedeveloped-base-layers
gcloud secrets delete SENTRY_DSN --project=bedeveloped-base-layers

# SA
gcloud iam service-accounts delete \
  audit-alert-sa@bedeveloped-base-layers.iam.gserviceaccount.com \
  --project=bedeveloped-base-layers
```

NOTE: deleting `audit-alert-sa` while `authAnomalyAlert` is deployed will
cause the function to fail with `permission denied` on its next invocation.
ALWAYS undeploy the function first (`firebase functions:delete authAnomalyAlert
--project bedeveloped-base-layers`) before deleting the SA.

---

## Citations

- 09-RESEARCH.md §Pattern 7 (lines 634-670) — gcloud monitoring uptime create (OBS-06)
- 09-RESEARCH.md §Pattern 8 (lines 672-696) — gcloud billing budgets create (OBS-07)
- 09-RESEARCH.md §Pattern 9 (lines 698-709) — Sentry quota alert (OBS-08)
- 09-RESEARCH.md §Pattern 11 — shared PII scrubber (`audit-alert-sa` reads auditLog rows; scrubber lives in functions/src/util/pii-scrubber.ts)
- Pitfall 13 — ADC only; no service-account JSON in source
- Pitfall 19 — substrate-honest disclosure ("alerts notify only"; auto-cutoff is v2)
- `scripts/setup-uptime-check/README.md` — script-level documentation
- `scripts/setup-budget-alerts/README.md` — script-level documentation
- `scripts/provision-function-sas/run.js` — Phase 7 SA provisioner extended in Step 1
- `runbooks/phase-9-sentry-bootstrap.md` — Wave 1 Sentry org/project/DSN bootstrap
- `runbooks/phase-9-deploy-checkpoint.md` — deploy-day single-session procedure
- OBS-04, OBS-06, OBS-07, OBS-08 — Phase 9 requirement IDs
