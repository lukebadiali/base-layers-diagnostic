# scripts/setup-budget-alerts

Phase 9 Wave 6 — one-shot idempotent ADC script that provisions a GCP Cloud
Billing budget on the project's billing account with notification thresholds
at 50% / 80% / 100% of the configured monthly amount. Satisfies **OBS-07**:
"Firebase budget alerts at 50% / 80% / 100% of monthly budget."

This script is executed by an operator following
`runbooks/phase-9-monitors-bootstrap.md` Step 4.

## Limitations — read this first

**Budget alerts NOTIFY only. They do NOT cap spend.** [VERIFIED:
docs.cloud.google.com 2026-05-10]

Cloud Billing budgets deliver an email or Pub/Sub notification when
month-to-date spend crosses each threshold. They do **not** pause services,
disable APIs, or suspend the project. The Firebase docs explicitly state:

> Budget alert emails might prompt you to take action … but they don't
> automatically prevent the use or billing of your services.
> — https://firebase.google.com/docs/projects/billing/avoid-surprise-bills

Automatic cutoff requires a separate Pub/Sub-driven Cloud Function that
disables the project on `threshold=100%`. That pattern is documented in the
Firebase "avoid surprise bills" page but is **OUT OF SCOPE for Phase 9** —
v2 deferral. This is the substrate-honest disclosure pattern from Pitfall 19;
the same disclaimer surfaces in `runbooks/phase-9-monitors-bootstrap.md`
Step 4 and (Wave 7) in `SECURITY.md`.

## Prerequisites

- Google Cloud SDK (gcloud) installed. Verify: `gcloud --version`
- Authenticated via Application Default Credentials:
  ```bash
  gcloud auth application-default login
  ```
- The authenticated account must hold `roles/billing.user` (or
  `roles/billing.admin`) on the billing account that owns
  `bedeveloped-base-layers`. Project-level Editor is NOT sufficient — budget
  resources live on the billing account, not the project.
- The `cloudbilling.googleapis.com` API and `billingbudgets.googleapis.com`
  API must be enabled on the project. Phase 7 already enabled the former for
  audit-log purposes; the latter ships enabled by default.

## Usage

```bash
# Dry-run first — print the planned action without making any changes:
node scripts/setup-budget-alerts/run.js --dry-run --project=bedeveloped-base-layers

# Real run with defaults (£100/month):
node scripts/setup-budget-alerts/run.js --project=bedeveloped-base-layers

# Real run with custom amount (e.g. £50/month):
BUDGET_AMOUNT=50 BUDGET_CURRENCY=GBP node scripts/setup-budget-alerts/run.js \
  --project=bedeveloped-base-layers

# Re-run idempotency check (should report [SKIP]):
node scripts/setup-budget-alerts/run.js --project=bedeveloped-base-layers
```

## Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--project=<id>` | `bedeveloped-base-layers` | GCP project ID override |
| `--dry-run` | off | Print the planned action; make no mutations |
| `--help`, `-h` | — | Print usage and exit 0 |

## Env vars

| Variable | Default | Description |
|----------|---------|-------------|
| `BUDGET_AMOUNT` | `100` | Numeric monthly budget amount |
| `BUDGET_CURRENCY` | `GBP` | ISO currency code (must match billing account currency) |

The default `£100/month` is sized to be high enough that ordinary PR-test
traffic never trips the 50% threshold, but low enough that a denial-of-wallet
spike (e.g. a misconfigured loop calling a billed API) trips 100% quickly.
Operator can lower with `BUDGET_AMOUNT=...` during early hardening.

## What the script does

| Step | Action | Idempotent? |
|------|--------|-------------|
| 1 | Verify gcloud CLI is on PATH | n/a (fast-fail) |
| 2 | Resolve billing account via `gcloud billing projects describe` | n/a |
| 3 | List existing budgets on the billing account | n/a |
| 4 | If `base-layers-monthly` exists, `[SKIP]` and exit 0 | Yes |
| 5 | Otherwise create the budget with 0.5/0.8/1.0 threshold rules | Yes — re-running after creation skips |

## Configuration (hardcoded)

| Setting | Value | Rationale |
|---------|-------|-----------|
| Display name | `base-layers-monthly` | Used by idempotency check + alert subject lines |
| Budget amount | `100 GBP` (default; override via env) | Sized for early-hardening guardrail |
| Threshold 1 | 50% (early warning) | Investigate unusual cost growth |
| Threshold 2 | 80% (action threshold) | Operator triages or lowers usage |
| Threshold 3 | 100% (alert; no cap) | Notifies; does NOT pause services |
| Filter projects | `projects/bedeveloped-base-layers` | Scopes the budget to this project only |

## Expected dry-run output

```
=== Phase 9 Wave 6 (OBS-07): GCP Cloud Billing budget provisioner (project=bedeveloped-base-layers, DRY-RUN) ===

[NOTE] Budget alerts NOTIFY only; they do NOT cap spend. Auto-disable via Pub/Sub-driven Cloud Function is OUT OF SCOPE for Phase 9 (v2 deferral). See 09-RESEARCH.md §Pattern 8 line 696 + Pitfall 19.

[OK] gcloud CLI found
[OK] resolved billing account: 01ABCD-23EFGH-45IJKL
[DRY-RUN] would run: gcloud billing budgets create --billing-account=01ABCD-23EFGH-45IJKL --display-name=base-layers-monthly --budget-amount=100GBP --threshold-rule=percent=0.5 --threshold-rule=percent=0.8 --threshold-rule=percent=1.0 --filter-projects=projects/bedeveloped-base-layers

[OK] Dry-run complete; no mutations performed.
     Re-run without --dry-run to create the budget.
```

## Expected re-run output (after initial creation)

```
[OK] gcloud CLI found
[OK] resolved billing account: 01ABCD-23EFGH-45IJKL
[SKIP] budget base-layers-monthly already exists on billing account 01ABCD-23EFGH-45IJKL; no creation needed. Verify in Cloud Console > Billing > Budgets & alerts.
```

## Notification channel (separate operator step)

Creating the budget is one half of the OBS-07 work. The other half is the
notification channel wiring — by default, Cloud Billing emails the billing
administrators. To route the alert to Slack instead, the operator creates a
Pub/Sub topic + Cloud Function subscriber, or wires it through Cloud
Monitoring's notification-channel system. That step is operator-paced and
documented in `runbooks/phase-9-monitors-bootstrap.md` Step 4.

## Operator runbook

For full verification commands, notification-channel wiring, troubleshooting,
and rollback steps, see `runbooks/phase-9-monitors-bootstrap.md` Step 4.

## Citations

- 09-RESEARCH.md §Pattern 8 (lines 672-696) — budget shape + "notify-only" limitation
- 09-PATTERNS.md line 28 — research-pattern marker (no codebase analog)
- Firebase "avoid surprise bills" — https://firebase.google.com/docs/projects/billing/avoid-surprise-bills
- Pitfall 13 — ADC only; no service-account JSON in source
- Pitfall 19 — substrate-honest disclosure pattern ("alerts notify only")
- OBS-07 — Phase 9 requirement ID
