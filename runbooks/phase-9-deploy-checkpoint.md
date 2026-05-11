# Phase 9 — Deploy Checkpoint (Wave 5 + Wave 6 Single-Session Operator Procedure)

> Phase: 9 — Observability + Audit-Event Wiring
> Wave: 6 (Plan 09-05, Task 3b — BLOCKING operator checkpoint)
> Requirements: OBS-05 verification + OBS-06 + OBS-07 + OBS-08 close-gates
> Date authored: 2026-05-10
> Objective: Single-session deploy of Wave 5's `authAnomalyAlert` Cloud Function +
> firestore.rules `authFailureCounters` block, followed by 5 verification gates
> that close Wave 5 + Wave 6 simultaneously. The Cutover Log table at the bottom
> is operator-fill — Phase 9 close cannot advance until this log has PASS rows
> for gates A, B, C, E and a DORMANT row for gate D.

This is the third Phase 9 operator runbook in the chain. Pre-requisites:

1. `runbooks/phase-9-sentry-bootstrap.md` Steps 1-7 complete (Sentry org + DSN
   + auth token + GitHub Actions secrets + 70% quota alert).
2. `runbooks/phase-9-monitors-bootstrap.md` Steps 1-6 complete (`audit-alert-sa`
   provisioned + `SLACK_WEBHOOK_URL` + `SENTRY_DSN` secrets in Secret Manager +
   uptime check + budget alert + Sentry quota alert all verified).

Once both bootstrap runbooks are complete, this runbook is the deploy-day
single session that runs in ~30-45 minutes.

---

## Pre-flight checklist

Operator confirms each box before starting:

- [ ] `runbooks/phase-9-sentry-bootstrap.md` Steps 1-7 complete (Cutover Log
      shows PASS rows for all 7 steps).
- [ ] `runbooks/phase-9-monitors-bootstrap.md` Step 6 verification gate
      reported 5/5 expected outputs.
- [ ] `audit-alert-sa@bedeveloped-base-layers.iam.gserviceaccount.com` exists
      (`gcloud iam service-accounts list | grep audit-alert-sa`).
- [ ] `SLACK_WEBHOOK_URL` and `SENTRY_DSN` secrets exist with
      `audit-alert-sa` granted `roles/secretmanager.secretAccessor` on both.
- [ ] `firebase login` authenticated:
      ```bash
      firebase login:list
      # Expected: operator's bedeveloped.com identity
      ```
- [ ] Local `git status` clean on the Phase 9 branch with all Wave 5 + Wave 6
      commits landed:
      ```bash
      git status
      git log --oneline -10
      # Expected: 7+ Phase 9 commits visible; working tree clean
      ```
- [ ] Functions test suite green:
      ```bash
      (cd functions && npm test -- --run)
      # Expected: 268/268 passing (Wave 5 added 10 new tests)
      ```

If any box is unchecked, STOP — resolve the pre-condition before continuing.

---

## Step A: Deploy `authAnomalyAlert` Cloud Function

Per Pitfall 8 (Phase 7 substrate): use **selective deploy** to avoid disturbing
unrelated functions. Mass-deploy with `firebase deploy --only functions` is
forbidden in production by the Phase 7 cleanup-ledger.

### A.1 — Deploy the function

```bash
firebase deploy \
  --only functions:authAnomalyAlert \
  --project bedeveloped-base-layers
```

Expected output ends with:

```
✔  functions[europe-west2-authAnomalyAlert] Successful create operation.
Function URL (authAnomalyAlert): <Eventarc trigger; no HTTPS URL>
✔  Deploy complete!
```

### A.2 — Verify the function landed under `audit-alert-sa`

```bash
gcloud functions describe authAnomalyAlert \
  --region=europe-west2 \
  --project=bedeveloped-base-layers \
  --format="value(serviceConfig.serviceAccountEmail)"
# Expected: audit-alert-sa@bedeveloped-base-layers.iam.gserviceaccount.com
```

If the SA does not match, the function deployed under the default Compute
Engine SA — STOP and re-deploy with the explicit SA flag, or check
`functions/src/observability/authAnomalyAlert.ts`'s `serviceAccount` config.

### A.3 — Verify the trigger registered

```bash
gcloud functions describe authAnomalyAlert \
  --region=europe-west2 \
  --project=bedeveloped-base-layers \
  --format="value(eventTrigger.eventType,eventTrigger.eventFilters)"
# Expected: google.cloud.firestore.document.v1.created  database=(default), document=auditLog/{eventId}
```

### A.4 — Record in Cutover Log

Row A in the Cutover Log table below.

### A.5 — Re-deploy neighbouring functions IF IAM was previously bound (Pitfall 8)

Phase 7 Wave 5 substrate: any function whose IAM was previously rebound during
the bootstrap chain should be re-deployed in the same session to prevent
silent permission drift. For this deploy day, the only such candidate is
`auditWrite` (Phase 7) — verify its SA bindings have not changed since
Phase 7 Wave 5 close-gate:

```bash
gcloud functions describe auditWrite \
  --region=europe-west2 \
  --project=bedeveloped-base-layers \
  --format="value(serviceConfig.serviceAccountEmail)"
# Expected: audit-writer-sa@bedeveloped-base-layers.iam.gserviceaccount.com
```

If it does NOT match, redeploy:

```bash
firebase deploy --only functions:auditWrite --project bedeveloped-base-layers
```

If it matches (expected case), no redeploy needed.

---

## Step B: Deploy `firestore.rules` (authFailureCounters block)

Wave 5 Plan 09-04 Task 2 added a `match /authFailureCounters/{ipHash}` block
to `firestore.rules` that denies all client read/write (server-only). The
`authAnomalyAlert` Cloud Function writes to this collection via Admin SDK,
bypassing rules.

### B.1 — Deploy the rules

```bash
firebase deploy \
  --only firestore:rules \
  --project bedeveloped-base-layers
```

Expected output:

```
✔  firestore: released rules firestore.rules to cloud.firestore
✔  Deploy complete!
```

### B.2 — Verify the rules diff in Cloud Console

1. Cloud Console → Firestore → Rules → "View deployed rules".
2. Confirm the `match /authFailureCounters/{ipHash}` block is present with
   `allow read: if false;` and `allow write: if false;`.
3. Confirm the rules version timestamp is within the last 5 minutes.

### B.3 — Verify the rules tests are green (sanity check)

```bash
npm run test:rules -- tests/rules/authFailureCounters.test.js
# Expected: 4 passing (read-deny client / read-deny internal-role /
#                       write-deny client / write-deny internal-role)
```

### B.4 — Record in Cutover Log

Row B.

---

## Step C: Synthetic Slack alert verification (OBS-05 success criterion)

Wave 5 Task 3 shipped `scripts/test-slack-alert/run.js` precisely for this
gate. The script POSTs a synthetic message to the Slack webhook out-of-band,
confirming the URL + channel are reachable BEFORE the `authAnomalyAlert`
trigger ever fires a real alert.

### C.1 — Run the synthetic alert

```bash
SLACK_WEBHOOK_URL=$(gcloud secrets versions access latest \
  --secret=SLACK_WEBHOOK_URL \
  --project=bedeveloped-base-layers) \
  node scripts/test-slack-alert/run.js
```

Expected exit code: 0. Expected stdout: `OK — message posted; operator should
now see it in Slack`.

### C.2 — Operator confirms Slack reception

1. Open Slack `#ops-alerts` (or whichever channel was configured in
   `runbooks/phase-9-monitors-bootstrap.md` Step 2.1).
2. Confirm the message arrives within ~10 seconds:
   `:white_check_mark: Phase 9 OBS-05 synthetic test alert (operator-verifiable; safe to dismiss)`
3. Screenshot the message + timestamp; save to
   `docs/evidence/phase-9-obs-05-synthetic-alert.png`.

### C.3 — Record in Cutover Log

Row C — include the screenshot path in the Evidence column.

---

## Step D: Synthetic auth-failure burst verification — **DORMANT**

### D.1 — Why this step is DORMANT

Plan 09-04 Task 1a + Task 1b shipped `authAnomalyAlert`'s **Rule 1**: a
rolling 5-minute window counter at `authFailureCounters/{ipHash}` that fires
a Slack alert on the 6th failure within the window (`count === FAIL_LIMIT + 1`).
The trigger code is fully tested (6 trigger-behaviour tests + 4 rules-cell
tests, all green in Wave 5 — see Plan 09-04 SUMMARY).

**However**, the upstream emit source — `beforeUserSignedIn` in
`functions/src/auth/beforeUserSignedIn.ts` — currently has **no rejection
rules that produce `auth.signin.failure` audit events**. The Plan 03a
substrate landed the `auth.signin.failure` enum value and the writer code
path, but there is no actual rejection rule that calls
`writeAuditEvent({ event: 'auth.signin.failure', ... })` today. The
beforeUserSignedIn substrate emits zero `auth.signin.failure` rows in
production right now.

Therefore: a synthetic 6-failure burst would NOT trigger
`authAnomalyAlert`'s Rule 1, because no upstream emit source produces the
input rows. Trying to force one (e.g. by manually writing 6 rows into the
`auditLog/` collection with `event: "auth.signin.failure"`) is a smoke test
of the trigger logic, not the production data path — and the trigger logic
is already covered by the 6 unit tests.

### D.2 — What this gate captures

Step D records as **DORMANT — defer** rather than pass/fail. The intent is:

- Rule 1 is **functionally correct** — proven by unit tests.
- Rule 1 is **dormant in production** — proven by the absence of an upstream
  emit source.
- When the first rejection rule lands in `beforeUserSignedIn`
  (e.g. a "block emails from known-abusive domains" rule shipped in a future
  Phase), the operator re-runs this gate by triggering 6 failed sign-ins
  from the same IP and confirming Slack receives the auth-fail-burst alert.

### D.3 — Forward-tracking row

Queued for Wave 7 cleanup-ledger:

> Re-run Step D when the first rejection rule lands in `beforeUserSignedIn` —
> confirm Slack receives the auth-fail-burst alert from a real 6-failure
> burst (not a synthetic auditLog write). Re-evaluation date: when the
> rejection-rules story is taken off the v2 backlog.

### D.4 — Record in Cutover Log

Row D — value `DORMANT — defer`. Evidence column: cross-reference to Plan 09-04
SUMMARY § DORMANT designation + this runbook's Step D.

---

## Step E: Uptime check + budget alert + Sentry quota alert smoke checks

These three artefacts were provisioned in
`runbooks/phase-9-monitors-bootstrap.md`. Step E is the operator-visible
deploy-day confirmation that all three are alive and reporting expected
states.

### E.1 — Uptime check first probe (OBS-06)

1. Cloud Console → Monitoring → Uptime checks.
2. Find `base-layers-diagnostic-prod` row.
3. First-probe latency: ≤ 60 seconds after the check was created in
   `runbooks/phase-9-monitors-bootstrap.md` Step 3. If the bootstrap runbook
   was executed yesterday, the check has run ≥ 1440 times already; today's
   probe pattern should show ~24h of green status pulses.
4. Status = Pass. All 3 regions green.
5. Screenshot to `docs/evidence/phase-9-obs-06-uptime-pass.png`.

### E.2 — Budget alert visible (OBS-07)

1. Cloud Console → Billing → Budgets & alerts.
2. Find `base-layers-monthly` row.
3. Confirm 3 thresholds visible (50%, 80%, 100%).
4. Confirm budget scope = `projects/bedeveloped-base-layers`.
5. Screenshot to `docs/evidence/phase-9-obs-07-budget-thresholds.png`.

### E.3 — Sentry quota alert visible (OBS-08)

1. Sentry web UI → Settings → Subscription → Quota Alerts (or Spike
   Protection if the 70% threshold UI is hidden — see
   `runbooks/phase-9-monitors-bootstrap.md` Step 5.3).
2. Confirm "Notify when monthly events ≥ 70%" toggle is ON (or the Spike
   Protection equivalent is configured).
3. Screenshot to `docs/evidence/phase-9-sentry-70pct-quota-alert.png` (this
   file may already exist from Wave 1 runbook Step 6 — overwrite with the
   current state is fine).

### E.4 — Record in Cutover Log

Row E — link to the 3 screenshots in the Evidence column.

---

## Cutover Log

> Operator-fill template. Substitute `{{ T+? }}` placeholders with real UTC
> timestamps the day this runbook is executed. Substrate-honest disclosure
> (Pitfall 19): false timestamps would violate compliance credibility — if a
> step has not run yet, leave the `{{ T+? }}` placeholder in place as the
> audit trail of what is still pending.

| Step | Action                                                              | T+0 (UTC)     | Result                | Evidence                                                                 |
|------|---------------------------------------------------------------------|---------------|-----------------------|--------------------------------------------------------------------------|
| A    | `firebase deploy --only functions:authAnomalyAlert`                 | `{{ T+? }}`  | `{{ PASS / FAIL }}`  | `gcloud functions describe authAnomalyAlert` output (SA = audit-alert-sa) |
| B    | `firebase deploy --only firestore:rules`                            | `{{ T+? }}`  | `{{ PASS / FAIL }}`  | Cloud Console rules diff showing authFailureCounters block               |
| C    | `node scripts/test-slack-alert/run.js`                              | `{{ T+? }}`  | `{{ PASS / FAIL }}`  | `docs/evidence/phase-9-obs-05-synthetic-alert.png` (Slack screenshot)    |
| D    | Synthetic auth-failure burst — **DORMANT — defer**                  | n/a           | `DORMANT`            | Per Plan 09-04 SUMMARY § DORMANT designation + Step D.1 of this runbook  |
| E    | Uptime check / budget alert / Sentry quota alert smoke confirmations | `{{ T+? }}`  | `{{ PASS / FAIL }}`  | 3 screenshots: `docs/evidence/phase-9-obs-06-uptime-pass.png`, `docs/evidence/phase-9-obs-07-budget-thresholds.png`, `docs/evidence/phase-9-sentry-70pct-quota-alert.png` |

Operator records the table above. Rows A, B, C, E must all be PASS before
the Phase 9 close-gate (Plan 09-06) can begin. Row D must be `DORMANT —
defer` (not PASS, not FAIL) — see Step D.

---

## Rollback procedure

If any of Steps A, B, C, E fails, follow the rollback for that step:

### Step A or B failed (deploy regression)

Per Phase 7 Pitfall 8 (selective-deploy substrate):

```bash
# Quick rollback via git revert + push (fires Phase 3 CI deploy workflow
# with the previous version)
git revert <cutover-sha>
git push
```

Alternative — quick disable without revert:

1. Cloud Console → Functions → `authAnomalyAlert` → Disable trigger.
2. The function does NOT delete; the Eventarc trigger pauses. Re-enable when
   the regression is understood.

### Step C failed (Slack message did not arrive)

Most likely causes:

1. **Wrong webhook URL in Secret Manager.** Re-create the secret with the
   correct URL (see `runbooks/phase-9-monitors-bootstrap.md` Step 2.2
   alternative — `gcloud secrets versions add`).
2. **Slack channel archived or webhook revoked.** Slack admin creates a new
   webhook for the correct channel; operator updates Secret Manager.
3. **Network egress blocked from operator workstation.** Try from a different
   network or VPN; if the issue is project-wide, file a GCP networking
   ticket — egress from Cloud Functions to `hooks.slack.com` was working
   during Phase 9 development.

### Step E failed (uptime check / budget / Sentry quota alert not visible)

Re-run the relevant step in `runbooks/phase-9-monitors-bootstrap.md`:
- Uptime check missing → re-run `scripts/setup-uptime-check/run.js`.
- Budget missing → re-run `scripts/setup-budget-alerts/run.js`.
- Sentry quota alert missing → re-run the Wave 1 runbook Step 6 (or this
  runbook's Step 5).

---

## Operator stop signal (BLOCKING for Phase 9 close)

Operator records all 5 verification gates as PASS (or `DORMANT — defer` for
Row D) in the Cutover Log table above before resuming the GSD workflow.

When the table is complete, operator returns the resume signal to the
spawning agent with the following minimum evidence:

- **Row A:** T+? timestamp recorded; `gcloud functions describe` output
  shows `audit-alert-sa` as the service-account.
- **Row B:** T+? timestamp recorded; Cloud Console rules diff link or
  screenshot showing the `authFailureCounters` block in the latest deployed
  version.
- **Row C:** T+? timestamp recorded; Slack screenshot of the synthetic
  alert message saved to `docs/evidence/phase-9-obs-05-synthetic-alert.png`.
- **Row D:** Marked `DORMANT — defer` — no evidence required beyond the
  cross-reference to Plan 09-04 SUMMARY.
- **Row E:** T+? timestamp recorded; 3 Console screenshots saved to
  `docs/evidence/phase-9-obs-06-uptime-pass.png`,
  `docs/evidence/phase-9-obs-07-budget-thresholds.png`,
  `docs/evidence/phase-9-sentry-70pct-quota-alert.png`.

If any gate FAILS, operator records the failure mode in the Result column
(e.g. `FAIL — Slack webhook 404`) and applies the rollback procedure above.
The Phase 9 work is then re-planned as a sub-wave 9.1 to address the
failure before re-running this checkpoint.

---

## Forward-tracking rows queued for Wave 7 (Plan 09-06) cleanup-ledger

- **Quarterly verification — operator confirms `gcloud monitoring uptime
  list-configs` returns the check.** Recorded in
  `runbooks/phase-9-cleanup-ledger.md`.
- **Re-run Step D when first rejection rule lands in
  `beforeUserSignedIn` — confirm Slack receives auth-fail-burst alert.**
  Re-evaluation date: when the rejection-rules story is taken off the v2
  backlog.
- **Quarterly budget-vs-actual audit — re-evaluate v2 auto-cutoff deferral
  status.** Confirms Pitfall 19 substrate-honest disclosure stays accurate
  as actual spend grows.
- **Update `SECURITY.md` § Observability** (Wave 7 task) to mention the 5
  deploy-day evidence screenshots in `docs/evidence/phase-9-*` as the
  Phase 9 OBS-04/05/06/07/08 evidence anchors.

---

## Citations

- Plan 09-04 Wave 5 SUMMARY — Wave 5 deliverables + DORMANT designation rationale
- Plan 09-05 Wave 6 (this plan) — runbook authoring + operator deploy session
- 09-RESEARCH.md §Pattern 6 — `authAnomalyAlert` 4-rule design
- 09-RESEARCH.md §Pattern 7 — uptime check shape (OBS-06)
- 09-RESEARCH.md §Pattern 8 — budget alert shape (OBS-07)
- 09-RESEARCH.md §Pattern 9 — Sentry quota alert (OBS-08)
- 07-RESEARCH.md Pitfall 8 — selective-deploy practice (never mass-deploy in prod)
- 09-RESEARCH.md Pitfall 19 — substrate-honest disclosure pattern
- `runbooks/phase-9-sentry-bootstrap.md` — Wave 1 bootstrap (precondition)
- `runbooks/phase-9-monitors-bootstrap.md` — Wave 6 bootstrap (precondition)
- `scripts/test-slack-alert/run.js` — Wave 5 OBS-05 synthetic verification script
- `functions/src/observability/authAnomalyAlert.ts` — Wave 5 trigger module
- `firestore.rules` — Wave 5 added `match /authFailureCounters/{ipHash}` block
- OBS-04, OBS-05, OBS-06, OBS-07, OBS-08 — Phase 9 requirement IDs
