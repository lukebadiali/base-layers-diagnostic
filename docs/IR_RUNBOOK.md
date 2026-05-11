# Incident Response Runbook — Index

**Last updated:** 2026-05-10 (Phase 11 Wave 4)
**Owner:** Hugh (BeDeveloped on-call); escalation paths per scenario
**Compliance posture:** credible, not certified — see `SECURITY.md` § Compliance posture statement
**Related:** `runbooks/ir-*.md` (executable per-scenario runbooks); `SECURITY.md § Anomaly Alerting (OBS-05)` (alert wiring); `THREAT_MODEL.md` (STRIDE substrate this index covers)

---

## How to use

When an alert fires or an incident report arrives:

1. Find the matching scenario below.
2. Follow the link to the executable per-scenario runbook under `runbooks/ir-*.md` (or the existing operational runbook cited) for step-by-step actions.
3. Fill in the Comms template + the RCA template at the bottom of this file. The RCA is committed to `docs/evidence/incidents/IR-{NN}-rca.md` within 30 days of containment.

Every cited `runbooks/*.md` path below resolves to a real file on disk (Pitfall 6 cross-reference existence gate — verified by `tests/ir-runbook-shape.test.js` Test 5).

---

## Scenario 1 — Credential compromise

**Trigger:** Slack alert from `authAnomalyAlert` Rule 1 (auth-fail burst) OR Rule 3 (role escalation), OR direct report from internal user, OR Sentry error spike on `auth.*` events.

**Owner:** Hugh (default). Escalation: notify Luke + George within 1 hour for any admin-account compromise.

**Decision tree:** see `runbooks/ir-credential-compromise.md` for the full procedure (Pre-conditions / 6-step Decision tree / Failure-Mode Triage / Citations). Tier-2 admin un-enrol fallback cross-references `runbooks/phase6-mfa-recovery-drill.md`; alert-routing detail cross-references `runbooks/phase-9-monitors-bootstrap.md`.

**Recovery objectives:** RTO ≤ 30 minutes for session revocation; RPO ≤ 0 (audit log persists across compromise — see `docs/RETENTION.md ## Audit log` for the 12mo+7y window).

**Citations:** SECURITY.md § Authentication & Sessions; SECURITY.md § Multi-Factor Authentication; SECURITY.md § Anomaly Alerting; OWASP ASVS L2 v5.0 V2.x + V7.x; ISO/IEC 27001:2022 Annex A.5.24; SOC 2 CC7.3; GDPR Art. 33 (72-hour breach-notification rule applies only when personal data is confirmed exfiltrated).

---

## Scenario 2 — Data leak / Rules bypass

**Trigger:** Sentry error spike on rules-deny events, OR external report (vulnerability disclosure inbox), OR `firestore.rules` test failure on production after a deploy (the rules-emulator test suite stays green on PR; production-shape divergence indicates a configuration drift).

**Owner:** Hugh + Luke (joint — Luke holds the rules-authorship history; Hugh holds the deploy chain).

**Decision tree:** see `runbooks/phase6-rules-rollback-rehearsal.md` for the 5-minute rules rollback procedure (pre-rehearsed Phase 6 Wave 5; rollback rules files preserved at `runbooks/phase6-rehearsal-rollback-firestore.rules` + `runbooks/phase6-rehearsal-rollback-storage.rules`). After rollback completes, follow the audit-log review pattern in `runbooks/ir-credential-compromise.md` Decision Tree Step 4 to scope the leak window. If the leak is confirmed and personal data is in scope, the GDPR Art. 33 72-hour notification clock starts at confirmation.

**Decision tree:** (additional note) tenant-boundary breach via cross-org IDOR is the most-likely Rules-bypass shape per `THREAT_MODEL.md § T2`. Audit-log query targets actorUid + targetOrgId pairs where the actor is not a member of the target org.

**Recovery objectives:** RTO ≤ 5 minutes for rules rollback (pre-rehearsed); GDPR Art. 33 notification ≤ 72 hours from confirmation if personal data is confirmed exfiltrated; full RCA committed within 30 days.

**Citations:** SECURITY.md § Firestore Security Rules; SECURITY.md § Storage Rules; SECURITY.md § Audit Log Infrastructure; GDPR Art. 33; OWASP ASVS L2 v5.0 V4.x (Access Control); ISO/IEC 27001:2022 Annex A.5.25 + A.8.3 (Access restrictions); SOC 2 CC6.x.

---

## Scenario 3 — Dependency CVE

**Trigger:** Dependabot PR opens against `main`, OR OSV-Scanner CI alert, OR Socket.dev alert at install-time, OR `npm audit` non-zero exit on the scheduled audit run.

**Owner:** Whoever opens the PR (Hugh by default for automated PR creation).

**Decision tree:** see `runbooks/ir-dependency-cve.md` for the 7-step procedure (triage severity / determine reachability / apply patch / run full test + smoke / open PR + merge / post-patch verification / CRITICAL out-of-band path).

**Recovery objectives:** CRITICAL CVE (CVSS ≥ 9.0) patch within 24 hours of confirmation; HIGH (CVSS 7.0-8.9) within 7 days; MEDIUM (4.0-6.9) within 30 days; LOW (< 4.0) batched with next dependency-bump cycle. CISA KEV-catalogue listing forces CRITICAL handling regardless of base CVSS.

**Citations:** SECURITY.md § Dependency Monitoring; SECURITY.md § Build & Supply Chain; OWASP ASVS L2 v5.0 V14.2.x; ISO/IEC 27001:2022 Annex A.8.8; SOC 2 CC7.1; CISA KEV Catalogue.

---

## Scenario 4 — Supply-chain compromise

**Trigger:** Socket.dev install-time alert (proactive detection layer per `runbooks/socket-bootstrap.md`); OR gitleaks ping indicating a leaked secret in repo; OR an unexpected GitHub Actions run; OR a Shai-Hulud-style IOC match in the `node_modules/` install graph.

**Owner:** Hugh.

**Decision tree:** see `runbooks/ir-supply-chain-compromise.md` for the 8-step procedure (halt CI deploys / identify suspect package / audit node_modules integrity / revoke exposed tokens / pivot runtime-vs-build-time / replace suspect package / restart deploys + verify / forensic capture). Coordinate the proactive detection layer with `runbooks/socket-bootstrap.md` (install-time signal source).

**Recovery objectives:** Halt CI deploys within 5 minutes of confirmed detection; revoke any potentially-exposed tokens (Sentry DSN, Slack webhook, GDPR_PSEUDONYM_SECRET) within 30 minutes; full SBOM diff + RCA within 30 days.

**Citations:** SECURITY.md § Build & Supply Chain; SECURITY.md § Rotation Schedule; OWASP ASVS L2 v5.0 V14.1.x + V14.2.x; ISO/IEC 27001:2022 Annex A.8.30 + A.5.21; SOC 2 CC8.1; GDPR Art. 33; CISA SBOM guidance.

---

## Scenario 5 — Lost backup

**Trigger:** Daily Firestore export job fails on 2+ consecutive days (Cloud Scheduler job error monitoring), OR PITR window is reported stale during a restore drill, OR the quarterly restore drill itself fails (per `runbooks/phase-8-restore-drill-cadence.md` cadence; `runbooks/restore-drill-2026-05-13.md` is the prior successful drill record).

**Owner:** Hugh.

**Decision tree:** invoke the `runbooks/phase-8-restore-drill-cadence.md` cadence procedure to diagnose the failure shape. If the diagnosis is export-job failure: manual run via
```
gcloud scheduler jobs run firebase-schedule-scheduledFirestoreExport-europe-west2 \
    --location=europe-west2 --project=bedeveloped-base-layers
```
to recover the missed day; check `gs://bedeveloped-base-layers-backups/firestore/` directory listing for recovery confirmation. PITR provides a 7-day rolling restore as an immediate fallback for data-recovery while the export-job substrate is being repaired.

**Recovery objectives:** RPO ≤ 24 hours (from the daily export schedule) OR seconds-level RPO via PITR for the trailing 7-day window. RTO is operator-paced and documented per the restore-drill closure template at `runbooks/restore-drill-2026-05-13.md` ## Closure.

**Citations:** SECURITY.md § Backups + DR + PITR + Storage Versioning; ISO/IEC 27001:2022 Annex A.8.13 (Information backup) + A.5.30 (ICT readiness for business continuity); SOC 2 CC9.1 (Risk mitigation — disaster recovery); GDPR Art. 32(1)(c) (Ability to restore availability and access to personal data).

---

## Comms templates

### Internal (Slack `#ops`)

> **Incident IR-{NN}**: {short title}.
> **Severity:** {Critical | High | Medium | Low}.
> **Detected:** {ISO timestamp UTC}.
> **Status:** Triage in progress; next update {ISO timestamp UTC + 30 min}.
> **On-call:** {operator name}.
> Updates every 30 minutes until contained; thread on this message.

### Customer-facing (GDPR Art. 33 — only if personal-data breach confirmed within scope)

> Subject: Security Incident Notification — {Date}
>
> Dear {customer},
>
> On {ISO date}, BeDeveloped detected a security incident affecting {scope —
> specific data classes per `docs/RETENTION.md` headings}. We are writing to
> inform you within the GDPR Article 33 72-hour notification window.
>
> **What happened:** {factual, non-speculative summary — 1-2 sentences}.
>
> **What data was affected:** {specific data class names from `docs/RETENTION.md`
> + count of records + count of affected data subjects if known}.
>
> **What we have done:** {immediate containment steps + ongoing remediation
> steps + cross-reference to the per-scenario runbook for procedural detail}.
>
> **What you should do:** {customer-side actions — e.g., reset password,
> review recent account activity, contact our team if unexpected charges
> appear; OR explicitly "no action is required on your part"}.
>
> **Contact:** security@bedeveloped.com (per RFC 9116 `security.txt`).
>
> A full Root Cause Analysis will follow within 30 days at
> `https://baselayers.bedeveloped.com/SECURITY.md` (publication-eligible
> incident summary).

### Status-page update (if a status page is published in v2)

> {Date ISO timestamp} — {Severity} incident affecting {scope}. Triage in
> progress; next update {ISO timestamp + 30 min}.
>
> {Date ISO timestamp + 30 min} — Containment achieved. Service restored.
> Root cause under investigation; RCA published within 30 days.

---

## RCA template

Paste-ready Markdown template. Fill within 30 days of containment; commit
to `docs/evidence/incidents/IR-{NN}-rca.md` with PII redacted (use
`{customer}` and `{uid-tail}` placeholders rather than literal identifiers).

```markdown
# Incident IR-{NN} — Root Cause Analysis

**Date:** {ISO date of detection}
**Severity:** {Critical | High | Medium | Low}
**Duration:** {detection → containment → resolution ISO timestamps}
**Scenario:** {Scenario 1 | 2 | 3 | 4 | 5} — link to per-scenario runbook
**Author:** {operator}
**Reviewers:** {Luke / George if Critical/High}

## Timeline

| Time (UTC) | Event |
|------------|-------|
| {T0}       | First signal (alert / report)  |
| {T0 + X}   | Operator acknowledged          |
| {T0 + Y}   | Containment started            |
| {T0 + Z}   | Containment confirmed          |
| {T0 + ZZ}  | Service restored               |

## Root cause

{1-2 paragraphs — be factual; cite code paths and commits; avoid attribution.}

## Blast radius

- **Users affected:** {N} (cite audit-log query producing the count).
- **Data classes affected:** {names from `docs/RETENTION.md` headings}.
- **Cross-system:** {yes/no — were Sentry / Slack / BigQuery downstream
  systems affected?}.
- **Customer-facing notification triggered:** {yes — Art. 33 72h | no — internal-only scope}.

## Remediation (immediate)

- [ ] {action} — completed {ISO timestamp} — commit {SHA}.
- [ ] {action} — completed {ISO timestamp} — commit {SHA}.

## Prevention (forward-tracking)

- [ ] Add a forward-tracking row to `runbooks/phase-{NN}-cleanup-ledger.md`
      (where {NN} is the phase whose substrate caught this incident).
- [ ] Update `THREAT_MODEL.md` if a new STRIDE category emerged (or update
      the existing T-N category mitigations list).
- [ ] Update `SECURITY.md` § {section} with the lesson — increment DOC-10
      per the Phase 11 final-pass cadence.
- [ ] Update the per-scenario runbook (`runbooks/ir-*.md`) with any
      decision-tree step that needed manual judgement during this incident.

## Appendices

- A1. Audit-log query producing the user-count + record-count above.
- A2. SBOM diff (Scenario 4 only) — suspect-package introduction commit
      → resolution commit.
- A3. Cloud Logging query producing the alert-firing timeline.
- A4. Cross-reference to the customer-facing notification text (Scenario 2
      + 4 only, if GDPR Art. 33 was triggered).
```

---

**Source artefacts.** Per-scenario executable runbooks under `runbooks/ir-*.md` + the existing operational runbooks (`runbooks/phase6-rules-rollback-rehearsal.md`, `runbooks/phase-8-restore-drill-cadence.md`, `runbooks/phase6-mfa-recovery-drill.md`, `runbooks/socket-bootstrap.md`, `runbooks/phase-9-monitors-bootstrap.md`, `runbooks/restore-drill-2026-05-13.md`). This index file links them; per-scenario steps live in the linked runbooks, not duplicated here. Pitfall 6 cross-reference existence gate — every cited `runbooks/*.md` path resolves to a real file on disk, verified by `tests/ir-runbook-shape.test.js` Test 5.
