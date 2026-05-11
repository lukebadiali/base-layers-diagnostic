# scripts/setup-uptime-check

Phase 9 Wave 6 — one-shot idempotent ADC script that provisions a GCP Cloud
Monitoring uptime check on `https://baselayers.bedeveloped.com`. The check
probes the production hostname from external GCP regions every 60 seconds,
independently of the project itself — the canonical out-of-band uptime monitor
that satisfies **OBS-06**.

This script is executed by an operator following
`runbooks/phase-9-monitors-bootstrap.md` Step 3. The alerting policy that wires
the uptime check to Slack is a separate Console-only step (gcloud's alerting
policy YAML/MQL is messy enough that the runbook handles it manually).

## Prerequisites

- Google Cloud SDK (gcloud) installed. Verify: `gcloud --version`
- Authenticated via Application Default Credentials:
  ```bash
  gcloud auth application-default login
  ```
- The authenticated account must hold `roles/monitoring.editor` on
  `bedeveloped-base-layers` (or `roles/owner` / `roles/editor`).
- The Cloud Monitoring API must be enabled. Phase 7 already enabled it for
  audit-log sinks; no extra step.

## Usage

```bash
# Dry-run first — print the planned action without making any changes:
node scripts/setup-uptime-check/run.js --dry-run --project=bedeveloped-base-layers

# Real run — applies the uptime check creation:
node scripts/setup-uptime-check/run.js --project=bedeveloped-base-layers

# Re-run idempotency check (should report [SKIP]):
node scripts/setup-uptime-check/run.js --project=bedeveloped-base-layers
```

## Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--project=<id>` | `bedeveloped-base-layers` | GCP project ID override |
| `--dry-run` | off | Print the planned action; make no mutations |
| `--help`, `-h` | — | Print usage and exit 0 |

## What the script does

| Step | Action | Idempotent? |
|------|--------|-------------|
| 1 | Verify gcloud CLI is on PATH | n/a (fast-fail) |
| 2 | List existing uptime checks (`gcloud monitoring uptime list-configs`) | n/a |
| 3 | If a check named `base-layers-diagnostic-prod` exists, `[SKIP]` and exit 0 | Yes |
| 4 | Otherwise create the check with 60s period + USA/EUROPE/ASIA_PACIFIC regions | Yes — re-running after creation skips |

## Configuration (hardcoded)

| Setting | Value | Rationale |
|---------|-------|-----------|
| Display name | `base-layers-diagnostic-prod` | Used by idempotency check + alert-policy condition |
| Resource type | `uptime-url` | Public HTTPS hostname probe |
| Host | `baselayers.bedeveloped.com` | Phase 3 hosting cutover landed in March 2026 |
| Protocol | `https` | Phase 3 HSTS-preload enforces HTTPS |
| Path | `/` | SPA serves the bundle root |
| Request method | `get` | Standard uptime probe |
| Period | `60s` | OBS-06 success criterion: "every 1min" |
| Timeout | `10s` | Generous; production p95 well under 1s |
| Regions | `USA,EUROPE,ASIA_PACIFIC` | gcloud minimum is 3; OBS-06 calls for ≥2 |

## Why 3 regions (not 2)

Per 09-RESEARCH.md §Pattern 7 line 670:

> Cloud Monitoring requires `--regions` to include AT LEAST 3 locations
> [VERIFIED: 2026-05-10 docs] when specified. The success criterion says ≥2
> regions; the gcloud minimum is 3. Resolution: specify
> `USA,EUROPE,ASIA_PACIFIC` for compliance with the gcloud constraint while
> exceeding the success criterion.

The OBS-06 contract is "≥2 regions"; the script supplies 3 (the minimum the
CLI accepts). This is the substrate-honest disclosure pattern from Pitfall 19.

## Alerting policy (separate operator step)

Creating the uptime check is one half of the OBS-06 work. The other half is
the alerting policy that posts to the `SLACK_WEBHOOK_URL` Secret Manager
secret when the check fails. That step is operator-paced (Cloud Console UI
or `gcloud alpha monitoring policies create` with YAML/MQL conditions), and
is documented in `runbooks/phase-9-monitors-bootstrap.md` Step 3.

## Expected dry-run output

```
=== Phase 9 Wave 6 (OBS-06): GCP Cloud Monitoring uptime check provisioner (project=bedeveloped-base-layers, DRY-RUN) ===

[OK] gcloud CLI found
[DRY-RUN] would run: gcloud monitoring uptime create base-layers-diagnostic-prod ...

[OK] Dry-run complete; no mutations performed.
     Re-run without --dry-run to create the uptime check.
```

## Expected re-run output (after initial creation)

```
[OK] gcloud CLI found
[SKIP] uptime check base-layers-diagnostic-prod already exists; no creation needed. Verify in Cloud Console > Monitoring > Uptime checks.
```

## Operator runbook

For full verification commands, Slack alerting-policy configuration,
troubleshooting, and rollback steps, see
`runbooks/phase-9-monitors-bootstrap.md` Step 3.

## Citations

- 09-RESEARCH.md §Pattern 7 (lines 634-670) — uptime check shape + 3-region minimum
- 09-PATTERNS.md line 27 — research-pattern marker (no codebase analog)
- Pitfall 13 — ADC only; no service-account JSON in source
- Pitfall 19 — substrate-honest disclosure pattern (3-region constraint)
- OBS-06 — Phase 9 requirement ID
