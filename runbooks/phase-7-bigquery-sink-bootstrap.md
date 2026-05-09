# Phase 7 Wave 5 — BigQuery Audit Sink Bootstrap

> Wave 5 Task 3 evidence runbook. Captures the run output of
> `scripts/enable-bigquery-audit-sink/run.js` + the T+1h verification that the
> first audit logs landed in BigQuery + the cost projection re-verification at
> the same window. AUDIT-03 + AUDIT-06 + Pitfall 17 closure (infrastructure-tier).

## Run evidence

```
run_at: <ISO timestamp from operator run>
operator: <handle / email>
script_exit_code: 0
project_id: bedeveloped-base-layers
dataset_created: bedeveloped-base-layers:audit_logs_bq
dataset_location: europe-west2
default_table_expiration_seconds: 220752000 (7 years)
sink_name: audit-logs-bq
sink_writer_sa: <serviceAccount:p<projectNumber>-...@gcp-sa-logging.iam.gserviceaccount.com>
data_editor_count: 1 (sink writer SA)
data_viewer_count: <count from internalAllowlist admin emails — operator-paced>
data_access_logs_enabled_for: [firestore.googleapis.com, storage.googleapis.com,
                                 identitytoolkit.googleapis.com, cloudfunctions.googleapis.com]
sink_filter_chars: <count> (DataAccess logs + cloud_run_revision auth.*/audit.*/csp.* prefixes)
sink_use_partitioned_tables: true (daily partitions per AUDIT-06)
```

## Verification (T+1h after run)

After the operator runs the script, wait at least 1 hour for the first audit
log batch to flow Cloud Logging → BigQuery, then run the verification query.

```bash
# Verify dataset metadata
bq show --location=europe-west2 bedeveloped-base-layers:audit_logs_bq
# Expected: defaultTableExpirationMs ~= 220752000000 (7 years in ms)

# Verify sink configuration
gcloud logging sinks describe audit-logs-bq --project=bedeveloped-base-layers
# Expected: destination = bigquery.googleapis.com/projects/.../datasets/audit_logs_bq
# Expected: filter contains the 4 Data Access service patterns + cloud_run_revision app log prefixes
# Expected: useAccelerationConfig + bigqueryOptions.usePartitionedTables = true

# T+1h: query for first audit logs
bq query --use_legacy_sql=false --project_id=bedeveloped-base-layers \
  'SELECT COUNT(*) AS row_count
   FROM `bedeveloped-base-layers.audit_logs_bq.cloudaudit_googleapis_com_data_access_*`'
# Expected: row_count > 0
```

```
bq_query_at: <ISO ≥ run_at + 1h>
bq_query_result_row_count: <number; expected > 0>
bq_partition_count: <count of daily partitions; expected ≥ 1>
verification_gate_result: <PASS|FAIL>
```

If `verification_gate_result: FAIL` (no rows after T+1h):
- Check sink filter for syntax errors (`gcloud logging sinks describe audit-logs-bq`)
- Check sink writer SA has `roles/bigquery.dataEditor` on the dataset
  (`bq show --format=prettyjson bedeveloped-base-layers:audit_logs_bq | jq .access`)
- Check Data Access logs are emitted (`gcloud projects get-iam-policy
  bedeveloped-base-layers --format='value(auditConfigs[].service)'`)
- Trigger a Firestore write (e.g. update an org doc) and re-check at T+15min

## Smoke trigger (optional T+5min reference)

Trigger a Firestore write to seed the first row faster than waiting for organic traffic:

```bash
# Touch any auditable resource:
gcloud firestore documents update orgs/<some-org-id> \
  --update="lastTouchedForAuditTest=$(date -Iseconds)" \
  --project=bedeveloped-base-layers || true

# Then within 5-10 minutes:
bq query --use_legacy_sql=false --project_id=bedeveloped-base-layers \
  'SELECT timestamp, resource.type, protopayload_auditlog.methodName
   FROM `bedeveloped-base-layers.audit_logs_bq.cloudaudit_googleapis_com_data_access_*`
   WHERE timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 MINUTE)
   ORDER BY timestamp DESC
   LIMIT 5'
```

## Cost projection re-verify

```
actual_volume_first_24h_MB: <from bq query SELECT SUM(...)>
projected_year_1_volume_GB: <extrapolated from first_24h × 365>
within_free_tier: <YES|NO>  # BigQuery free tier = 10 GB storage / month
re_evaluate_at: <date — typically engagement re-start; 07-RESEARCH.md Risks #3>
```

```bash
# Daily volume query (run at T+24h):
bq query --use_legacy_sql=false --project_id=bedeveloped-base-layers \
  'SELECT
     DATE(timestamp) AS day,
     COUNT(*) AS rows,
     ROUND(SUM(LENGTH(TO_JSON_STRING(t))) / 1024 / 1024, 2) AS approx_MB
   FROM `bedeveloped-base-layers.audit_logs_bq.cloudaudit_googleapis_com_data_access_*` AS t
   WHERE timestamp > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)
   GROUP BY day'
```

## Admin dataViewer bindings (manual step)

Per the script's `[NOTE]` output, the operator manually binds
`roles/bigquery.dataViewer` to internalAllowlist admin emails. List admin
emails first:

```bash
# (assuming gcloud + Firestore export-equivalent or gcloud firestore export)
# Or via Firebase Console → Firestore → internalAllowlist filter role==admin

# For each admin email:
gcloud projects add-iam-policy-binding bedeveloped-base-layers \
  --member=user:<admin-email> --role=roles/bigquery.dataViewer
```

```
admin_emails_bound:
  - email: <admin-1@bedeveloped.com>, bound_at: <ISO>
  - email: <admin-2@bedeveloped.com>, bound_at: <ISO>
total_data_viewer_count: <number>
```

## Threat model check

Per Wave 5 plan threat register:

- **T-07-05-01 (Tampering at infra tier):** mitigated — Cloud Logging is
  append-only; BigQuery dataset has only sink-writer dataEditor; no dataOwner
  bindings beyond the project owner role
- **T-07-05-02 (Information Disclosure):** mitigated — dataViewer bound only
  to internalAllowlist admin emails (manual step above)
- **T-07-05-06 (PII via Data Access logs):** accepted per plan — Data Access
  logs ARE the audit trail; PII scrubbing happens at the application audit
  log writer (Wave 2) for the auditLog/ collection; BQ infra-tier audit is
  unredacted ground truth (legitimate interest under GDPR Art. 6(1)(f) for
  SOC2 audit purposes; PRIVACY.md will document at Phase 11)

## Citations

- 07-RESEARCH.md Pattern 10 — BigQuery sink design + cost guardrail
- Pitfall 5 — region match (Firestore = europe-west2 → dataset = europe-west2)
- Pitfall 13 — ADC only; no JSON SA in repo
- Pitfall 17 — infrastructure-tier audit log (Cloud Logging append-only)
- SOC2 CC7.2 + ISO 27001 A.12.4.1 + GDPR Art. 32(1)(d) — 7y retention rationale
- AUDIT-03 + AUDIT-06 — Phase 7 audit log substrate requirements
