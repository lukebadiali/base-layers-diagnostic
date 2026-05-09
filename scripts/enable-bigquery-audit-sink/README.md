# scripts/enable-bigquery-audit-sink

Phase 7 Wave 5 — one-shot Admin-CLI ADC script that bootstraps the
infrastructure-tier audit log archive: enables Cloud Audit Logs Data Access
events, creates the `audit_logs_bq` BigQuery dataset (`europe-west2`,
7-year retention), creates the Cloud Logging sink that routes audit + app logs
to BigQuery with daily-partitioned tables, and grants the sink writer SA
`roles/bigquery.dataEditor`.

## Why a BigQuery sink?

**AUDIT-03 + AUDIT-06** require an append-only, tamper-evident audit log
covering Firestore reads/writes, Storage operations, Auth events, and Cloud
Functions invocations. Cloud Logging routes Data Access logs into BigQuery
partitioned tables — daily partitions can be made read-only, satisfying the
tamper-evidence property at the infrastructure tier (Pitfall 17 closure).

This pairs with the application-tier `auditLog/{eventId}` Firestore collection
(Wave 2) — the Firestore collection captures application-meaningful events
(role change, MFA enrol, password change), the BigQuery sink captures the
unredacted infrastructure ground truth.

## Region rationale

`europe-west2` (London) — matches the Firestore region per **Pitfall 5**
(co-region all the things; cross-region writes from Cloud Logging to BQ would
add latency + egress cost).

## 7-year retention rationale

- **SOC2 CC7.2** — log retention policy aligned to incident-response window
- **ISO 27001 A.12.4.1** — event logging with appropriate retention
- **GDPR Art. 32(1)(d)** — process for regularly testing security measures

7 years = 220_752_000 seconds, set as the dataset's
`--default_table_expiration` so each daily-partition table inherits the
retention automatically.

## Cost guardrail

Per `.planning/phases/07-cloud-functions-app-check-trusted-server-layer/07-RESEARCH.md`
Pattern 10: projected ≤1 GB/year audit log volume — well within the BigQuery
free tier (10 GB storage / month). Re-evaluate at engagement re-start when
real-traffic volume becomes available (07-RESEARCH.md Risks #3).

## Usage

```bash
# 1. ADC login (Pitfall 13 — no service-account JSON in repo)
gcloud auth application-default login

# 2. (Optional) dry-run to inspect plan
node scripts/enable-bigquery-audit-sink/run.js --dry-run

# 3. Apply
node scripts/enable-bigquery-audit-sink/run.js

# 4. Override project if needed
node scripts/enable-bigquery-audit-sink/run.js --project=other-project-id
```

## Idempotency semantics

Safe to re-run — every step checks-and-corrects drift:

- **Step 1 (Data Access logs):** reads project IAM policy, merges
  `auditConfigs` for the 4 services if missing
- **Step 2 (dataset):** `bq show` first; create only if missing
- **Step 3 (sink):** `gcloud logging sinks describe` first; create only if
  missing
- **Step 4 (sink writer binding):** `gcloud projects
  add-iam-policy-binding` is idempotent at the gcloud layer
- **Step 5 (admin viewer bindings):** prints the manual binding commands
  the operator should run after listing internalAllowlist admin emails
  (avoids pulling firebase-admin as a script dep)

## Operator cadence

Run once at Wave 5 ship; re-run after any of the following changes:

- New service added to the Data Access logs allowlist
- Sink filter modified (e.g. new app log message prefix)
- Dataset accidentally deleted (script will re-create)

## Verification

After running the script, wait T+1h then run the verification query
documented in `runbooks/phase-7-bigquery-sink-bootstrap.md`. Expect
`COUNT(*) > 0` once the first audit log batch lands.

## See also

- `runbooks/phase-7-bigquery-sink-bootstrap.md` — run evidence + T+1h verification log
- `runbooks/phase-7-d22-tos-gate-resolution.md` — Wave 5 branch decision context
- `.planning/phases/07-cloud-functions-app-check-trusted-server-layer/07-RESEARCH.md` Pattern 10
- `.planning/research/PITFALLS.md` Pitfalls 5, 13, 17
