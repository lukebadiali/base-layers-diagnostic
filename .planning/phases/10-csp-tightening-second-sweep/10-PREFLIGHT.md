---
phase: 10
wave: 3
plan: 10-03
owner: operator
status: pending-soak
created: 2026-05-10
runbook: runbooks/phase-10-csp-soak-bootstrap.md
---

# Phase 10 — Preflight Log

This preflight log is the operator-fill audit substrate for Plan 10-03 (Wave 3 — production deploy of Plan 10-02's tightened CSP-RO + 7-day calendar soak observing the `cspReportSink` Cloud Logging stream). The log is a Pitfall 19 substrate-honest disclosure artefact: rows are filled as the soak progresses; un-run rows must remain `{{ ... }}` rather than be back-filled, so the audit trail of pending vs. completed days is explicit at all times.

The runbook for executing the steps that fill this log lives at `runbooks/phase-10-csp-soak-bootstrap.md`. Read that runbook end-to-end before starting Step 1.

---

## Pre-conditions sign-off

Operator confirms each box BEFORE running Step 1 of the runbook:

- [ ] `grep -c 'style:\s*"' src/main.js` returns `0` (Plan 10-01 closure verified)
- [ ] `npm test -- --run firebase-config` returns `24 passed` (Plan 10-02 closure verified)
- [ ] `git log --oneline -5` shows commit `24f8a7c` (Plan 10-02 Task 2) in recent history
- [ ] `gcloud auth list` shows operator's authorised identity active for `bedeveloped-base-layers`
- [ ] `firebase login:list` confirms operator authenticated
- [ ] `gh run list --workflow=ci.yml --branch=main --status=success --limit=3` shows a green run that includes Wave 2's commits (OR operator is using local `firebase deploy`)
- [ ] Calendar window scheduled: 7+ days available for daily ~5 min checks; understanding that triage cycles add 7+ days each
- [ ] This preflight log is open in a buffer/tab — Soak Log rows will be filled as days complete

Sign-off date: `{{ YYYY-MM-DD }}`
Sign-off operator: `{{ operator-identity }}`

---

## Soak Log

> Operator-fills as the 7-day soak progresses. Substrate-honest disclosure (Pitfall 19): leave `{{ ... }}` placeholders for not-yet-run rows so the audit trail of what is still pending stays explicit. Do NOT back-fill timestamps; do NOT delete rows from superseded triage cycles.

### Cycle 1

| Day | Date (UTC)   | Action / Check                                                                | Violations Count | Status                  | Evidence / Notes                                                                  |
|-----|--------------|-------------------------------------------------------------------------------|------------------|-------------------------|-----------------------------------------------------------------------------------|
| 0   | `{{ DATE }}` | `firebase deploy --only hosting --project bedeveloped-base-layers` (SHA `{{ SHA }}`, commit subject `{{ SUBJECT }}`) | n/a              | `{{ PASS / FAIL }}`     | `curl -sI https://baselayers.bedeveloped.com` showed tightened CSP-RO; full header captured below |
| 1   | `{{ DATE }}` | `gcloud logging read ... --freshness=24h`                                     | `{{ N }}`        | `{{ PASS / TRIAGE }}`   | `{{ summary or "clean" }}`                                                        |
| 2   | `{{ DATE }}` | `gcloud logging read ... --freshness=24h`                                     | `{{ N }}`        | `{{ PASS / TRIAGE }}`   | `{{ summary or "clean" }}`                                                        |
| 3   | `{{ DATE }}` | `gcloud logging read ... --freshness=24h`                                     | `{{ N }}`        | `{{ PASS / TRIAGE }}`   | `{{ summary or "clean" }}`                                                        |
| 4   | `{{ DATE }}` | `gcloud logging read ... --freshness=24h`                                     | `{{ N }}`        | `{{ PASS / TRIAGE }}`   | `{{ summary or "clean" }}`                                                        |
| 5   | `{{ DATE }}` | `gcloud logging read ... --freshness=24h`                                     | `{{ N }}`        | `{{ PASS / TRIAGE }}`   | `{{ summary or "clean" }}`                                                        |
| 6   | `{{ DATE }}` | `gcloud logging read ... --freshness=24h`                                     | `{{ N }}`        | `{{ PASS / TRIAGE }}`   | `{{ summary or "clean" }}`                                                        |
| 7   | `{{ DATE }}` | Close-out: `gcloud logging read ... --freshness=7d --limit=200`               | `{{ N }}`        | `{{ CLEAN / RESTART }}` | Authorises Wave 4 (Plan 10-04) IF `CLEAN`; otherwise triage + add Cycle 2 below   |

### Day 0 verbatim header capture

Paste the FULL `curl -sI https://baselayers.bedeveloped.com` output here for Day 0 audit anchor:

```
{{ curl -sI output — full set of response headers including
   content-security-policy-report-only: ...
   strict-transport-security: ...
   x-content-type-options: ...
   etc.
}}
```

### Cycle 2 (only if Cycle 1 triggered a restart — leave entire section as `{{ ... }}` if not used)

| Day | Date (UTC)   | Action / Check                                                                                  | Violations Count | Status                  | Evidence / Notes                                                                            |
|-----|--------------|-------------------------------------------------------------------------------------------------|------------------|-------------------------|---------------------------------------------------------------------------------------------|
| 0   | `{{ DATE }}` | `firebase deploy --only hosting` (fix-SHA `{{ SHA }}` — root cause: `{{ ROOT_CAUSE_FROM_TRIAGE }}`) | n/a              | `{{ PASS / FAIL }}`     | Cycle 1 SUPERSEDED on Day `{{ N }}`; cycle-2 deploy carries fix for `{{ TRIAGE_CASE }}`     |
| 1   | `{{ DATE }}` | `gcloud logging read ... --freshness=24h`                                                       | `{{ N }}`        | `{{ PASS / TRIAGE }}`   | `{{ ... }}`                                                                                 |
| 2   | `{{ DATE }}` | `gcloud logging read ... --freshness=24h`                                                       | `{{ N }}`        | `{{ PASS / TRIAGE }}`   | `{{ ... }}`                                                                                 |
| 3   | `{{ DATE }}` | `gcloud logging read ... --freshness=24h`                                                       | `{{ N }}`        | `{{ PASS / TRIAGE }}`   | `{{ ... }}`                                                                                 |
| 4   | `{{ DATE }}` | `gcloud logging read ... --freshness=24h`                                                       | `{{ N }}`        | `{{ PASS / TRIAGE }}`   | `{{ ... }}`                                                                                 |
| 5   | `{{ DATE }}` | `gcloud logging read ... --freshness=24h`                                                       | `{{ N }}`        | `{{ PASS / TRIAGE }}`   | `{{ ... }}`                                                                                 |
| 6   | `{{ DATE }}` | `gcloud logging read ... --freshness=24h`                                                       | `{{ N }}`        | `{{ PASS / TRIAGE }}`   | `{{ ... }}`                                                                                 |
| 7   | `{{ DATE }}` | Close-out: `gcloud logging read ... --freshness=7d --limit=200`                                 | `{{ N }}`        | `{{ CLEAN / RESTART }}` | Authorises Wave 4 IF `CLEAN`                                                                |

> Add additional cycle blocks (Cycle 3, Cycle 4, ...) below if multiple triage cycles occur. Substrate-honest: every cycle stays in this document permanently as audit substrate.

---

## Triage Incidents

For each triage event during the soak, append a block here. Empty if soak runs CLEAN on Cycle 1.

### Triage 1 (only if first cycle triggered a restart)

- **Cycle:** 1
- **Day surfaced:** `{{ N }}`
- **Date (UTC):** `{{ DATE }}`
- **Trigger:** Cloud Logging filter `gcloud logging read ... --freshness=24h` returned `{{ N }}` non-extension-origin entries
- **`jsonPayload.report` extract:**
  - `effectiveDirective`: `{{ ... }}`
  - `blockedUri`: `{{ ... }}`
  - `documentUri`: `{{ ... }}`
  - `disposition`: `report` (always)
- **Failure mode classification:** `{{ "Sentry sub-host (A4)" / "Missed inline-style" / "Unexpected popup" / "Novel — escalated to sub-wave 10.x" }}`
- **Root cause:** `{{ short prose explanation }}`
- **Fix:** `{{ short prose: code change + commit SHA + or firebase.json change + or runbooks update }}`
- **Fix-commit-SHA:** `{{ short_sha }}`
- **Wave 2 schema test re-run:** `{{ npm test -- --run firebase-config — N passed }}`
- **Re-deploy:** `firebase deploy --only hosting` at `{{ DATE TIME UTC }}`
- **Cycle 2 starts at:** `{{ DATE TIME UTC }}`

---

## Wave 3 Close Decision

ONE of the two checkboxes below MUST be marked. The other stays unchecked.

- [ ] **Soak Log Cycle N Day 7 row marks `CLEAN`** → Wave 4 (Plan 10-04) checkpoint is operator-runnable. Operator returns resume signal `soak clean — authorise Wave 4` to spawning agent.
- [ ] **Soak surfaced violations** → Triage block(s) above documented; cycle restarted; this checkpoint stays open. Operator returns resume signal describing the restart cycle.

Final close date: `{{ YYYY-MM-DD }}`
Total cycles: `{{ N }}`
Total calendar days: `{{ N × 7 + ... }}`
Final authorised cycle: `{{ N }}`

---

## Forward-tracking rows (queued for Plan 10-05 SECURITY.md / cleanup-ledger close-out)

Append rows here for any Wave 3 observations that should propagate into Plan 10-05's documentation pass. Empty until soak completes or triage incidents accumulate.

- `{{ row 1 description, e.g. "Sentry ingest-subdomain confirmed via Wave 3 Cycle 1 Day 3 triage — connect-src now uses https://*.ingest.de.sentry.io wildcard; document in SECURITY.md § HTTP Security Headers" }}`
- `{{ ... }}`

---

## Citations

- `runbooks/phase-10-csp-soak-bootstrap.md` — operator runbook this preflight is the audit log for
- `.planning/phases/10-csp-tightening-second-sweep/10-03-PLAN.md` — Wave 3 plan
- `.planning/phases/10-csp-tightening-second-sweep/10-RESEARCH.md §Pitfall 16` — three-stage rollout rationale + warning signs
- Pitfall 19 (`PITFALLS.md`) — substrate-honest disclosure (this preflight's design rationale)
- HOST-07 (`REQUIREMENTS.md`) — substrate-complete-pending until Wave 4 closes
