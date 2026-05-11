# Phase 10 — CSP-RO Tightened Soak Bootstrap (Operator Runbook)

> Phase: 10 — CSP Tightening (Second Sweep)
> Wave: 3 (Plan 10-03)
> Requirement: HOST-07 (Stage B of Pitfall 16 — Report-Only with TIGHTENED directives before enforcement flip)
> Date authored: 2026-05-10
> Objective: Deploy Wave 2's tightened CSP-RO + run a 7-day calendar soak that returns zero new `csp.violation` events from production traffic before Wave 4 (Plan 10-04) flips the enforcement key.

This runbook is the operator-paced execution of Wave 3. Its purpose is to put Plan 10-02's tightened directive value (`style-src 'self'` only / `connect-src` + `https://de.sentry.io` / `frame-src 'self'`) on the production wire under the existing Report-Only header key, then observe the `cspReportSink` Cloud Logging stream for 7 calendar days. A clean window authorises Wave 4 (Plan 10-04) to flip the enforcement key. Any non-extension-origin violation triggers the §Failure-Mode Triage section and restarts the 7-day clock.

The Stage B soak is non-negotiable per Pitfall 16 — Phase 3 ran Stage A (Report-Only WITH `'unsafe-inline'`), but the Stage A soak is silent on the directive shapes about to be enforced. Wave 3 produces fresh observability under the tightened shape before any enforcement flip. The operator runs Step 1 (one-time deploy) + Step 2 (one-time header verification) + Step 3 (daily, 7 times) + Step 4 (one-time close-out).

---

## Pre-conditions

ALL of the following MUST be true before opening Step 1. If any is false, stop and resolve it.

- [ ] **Plan 10-01 closed** — `grep -c 'style:\s*"' src/main.js` returns `0` (162-inline-style migration verified at HEAD; cache-buster bumped to `?v=53`). If non-zero, Stage B WILL surface 162+ silent layout-drop violations and pollute the soak window per Pitfall 10A — STOP, re-check Plan 10-01 close-out.
- [ ] **Plan 10-02 closed** — `npm test -- --run firebase-config` returns `24 passed` (18 existing + 6 new Phase 10 schema-test assertions). Schema-test green proves firebase.json carries the tightened directive shape that this runbook deploys.
- [ ] **Local working tree at the Wave 2 commit OR a descendant** — `git log --oneline -5` shows commit `24f8a7c` (Plan 10-02 Task 2 — `test(10-02): add 6 Phase 10 schema assertions`) within the last few commits. If on a feature branch ahead of main, confirm Wave 2's two commits (`523e47e` + `24f8a7c`) are part of the deploy SHA's history.
- [ ] **`gcloud auth login` valid** for project `bedeveloped-base-layers`:
  ```bash
  gcloud auth list --filter=status:ACTIVE --format="value(account)"
  # Expected: an @bedeveloped.com (or the operator's audited identity) entry
  gcloud config get-value project
  # Expected: bedeveloped-base-layers (set with `gcloud config set project bedeveloped-base-layers` if not)
  ```
- [ ] **`firebase login` valid** for project `bedeveloped-base-layers`:
  ```bash
  firebase login:list
  # Expected: operator's authenticated identity listed
  firebase use bedeveloped-base-layers
  # Expected: "Now using project bedeveloped-base-layers" (or already-active confirmation)
  ```
- [ ] **CI deploy job has run green on `main` since Wave 2 landed** — `gh run list --workflow=ci.yml --branch=main --status=success --limit=3 --json databaseId,createdAt,headSha`. At least one entry whose headSha includes commit `24f8a7c` (or descendant) MUST exist. If the operator prefers to push-and-let-CI-deploy rather than run `firebase deploy` locally, this is the authorising substrate. Otherwise, local deploy is acceptable.
- [ ] **`10-PREFLIGHT.md` open in a buffer/tab** — every Soak Log row gets filled as the day's check completes. Substrate-honest disclosure (Pitfall 19): unfilled rows must remain `{{ ... }}` rather than be back-filled at close-out, so the audit trail of pending vs. completed days is explicit.
- [ ] **Calendar window scheduled** — the 7-day soak runs in real calendar time. Day 0 is deploy day; Days 1-6 are daily ~5 min checks; Day 7 is close-out. Triage-and-restart cycles add 7+ days each (Pitfall 16-expected behavior, not phase failure).

If any check fails, STOP. Do NOT proceed to Step 1.

---

## Step 1: Selective hosting deploy (~5 min)

Per Pitfall 8 (Phase 7 substrate): use **selective deploy** to avoid disturbing unrelated functions/hosting routes. The Phase 10 Wave 3 deploy is hosting-only — it ships firebase.json, which is hosting-routing config, not function code.

### 1.1 — Deploy

```bash
firebase deploy --only hosting --project bedeveloped-base-layers
```

Expected output ends with:

```
✔  hosting[bedeveloped-base-layers]: release complete
✔  Deploy complete!

Hosting URL: https://bedeveloped-base-layers.web.app
```

### 1.2 — DO NOT redeploy `cspReportSink` or any function

Phase 10 leaves the `cspReportSink` Cloud Function READ-ONLY (FN-04-pinned to `csp-sink-sa` per Phase 7 Wave 5 SA-rebind). The following commands are **forbidden** during Wave 3:

```bash
# DO NOT RUN — would disturb csp-sink-sa IAM bindings
firebase deploy --only functions
firebase deploy --only functions:cspReportSink

# Mass-deploy is forbidden in production by Phase 7 Wave 5 cleanup-ledger row
firebase deploy
```

If by mistake one of the above is run, STOP and re-verify the SA binding:

```bash
gcloud functions describe cspReportSink \
  --region=europe-west2 \
  --project=bedeveloped-base-layers \
  --format="value(serviceConfig.serviceAccountEmail)"
# Expected: csp-sink-sa@bedeveloped-base-layers.iam.gserviceaccount.com
```

If the SA does NOT match (e.g. the function fell back to the default Compute Engine SA), open a sub-wave 10.x to rebind per Phase 7 Wave 5 procedure BEFORE proceeding.

### 1.3 — Capture deploy timestamp + SHA

Record in `10-PREFLIGHT.md ## Soak Log` Day 0 row:

```bash
date -u +"%Y-%m-%dT%H:%M:%SZ"
# Capture the timestamp

git rev-parse --short HEAD
# Capture the SHA — must include Wave 2's commits in its history
```

The Day 0 row is the audit anchor for the 7-day window. If a triage-and-restart happens on Day 5, a new Day 0 row is added below the original (mark the original as superseded with the restart-reason in the Notes column).

---

## Step 2: Post-deploy header verification (~2 min)

Confirm the tightened directive shape is on the wire BEFORE starting the soak. If the shape is wrong, the 7-day soak is observing the wrong policy.

### 2.1 — Fetch headers

```bash
curl -sI https://baselayers.bedeveloped.com | grep -i content-security
```

Expected response line (single line; semicolon-separated; abbreviated below for readability):

```
content-security-policy-report-only: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.cloudfunctions.net https://identitytoolkit.googleapis.com https://securetoken.google.com https://de.sentry.io; frame-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; report-uri /api/csp-violations; report-to csp-endpoint
```

### 2.2 — Verification checklist

- [ ] Header KEY is `content-security-policy-report-only` (NOT `content-security-policy`). Wave 4 owns the key flip; Wave 3 is observation only.
- [ ] `style-src 'self'` is present. NO `'unsafe-inline'` substring anywhere in the value.
- [ ] `https://de.sentry.io` is in the connect-src directive.
- [ ] `frame-src 'self'` is present. NO `bedeveloped-base-layers.firebaseapp.com` substring (Phase 6 D-09: app uses email-link auth, popup origin no longer needed).
- [ ] `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `object-src 'none'` all present (Phase 3 substrate retained).
- [ ] `report-uri /api/csp-violations` present (rewrites to `cspReportSink` via firebase.json line 38-39).

### 2.3 — Failure handling

If ANY checklist item fails:

1. STOP — do NOT start the daily soak.
2. Likely cause: deploy timing (CDN edge cache stale) or wrong SHA deployed.
3. Wait 30 seconds, re-run the curl. CDN edge cache typically invalidates within 60 seconds of a successful Firebase Hosting deploy.
4. If still failing after 2 minutes: re-verify the deployed version with `firebase hosting:channel:list --project bedeveloped-base-layers` and compare to local `git rev-parse HEAD`.
5. If still failing: re-run `firebase deploy --only hosting --project bedeveloped-base-layers`.
6. If 3 deploys fail: STOP — open a sub-wave 10.x to investigate (likely a firebase.json schema regression that the Wave 2 schema test missed).

If checklist passes, record `PASS` in `10-PREFLIGHT.md ## Soak Log` Day 0 row Status column + paste the curl output's CSP-RO value into the Evidence column.

---

## Step 3: Daily soak observation (run once per day for 7 days)

Run this query once per calendar day for 7 days. Day 0 is deploy day (no soak query needed — the 24-hour window includes the deploy itself); Day 1 through Day 7 is the actual soak.

### 3.1 — Daily Cloud Logging query

```bash
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND resource.labels.service_name="cspreportsink"
   AND severity=WARNING
   AND jsonPayload.message="csp.violation"
   AND jsonPayload.report.disposition="report"' \
  --project=bedeveloped-base-layers \
  --limit=50 \
  --format=json \
  --freshness=24h
```

> Note: `service_name` is `cspreportsink` (lowercase, no hyphen) — Firebase 2nd-gen lowercases function names when minting the underlying Cloud Run service. Verified at `runbooks/hosting-cutover.md` lines 69-73 (Phase 3 substrate).

### 3.2 — Expected daily output (clean soak)

Empty array:

```
[]
```

This means: zero `csp.violation` events at WARNING severity from non-extension origins in the last 24 hours. (Extension noise from `chrome-extension://` / `moz-extension://` is filtered by the Phase 3 `cspReportSink` filter at `functions/src/csp/filter.ts` BEFORE the `logger.warn("csp.violation")` call, so an empty result is the normal clean-soak signal.)

Record `0` in the Soak Log Day N row Violations Count column + `clean` in the Notes column + `PASS` in Status.

### 3.3 — Non-empty output (soak NOT clean)

If the gcloud output contains ANY entries:

1. **Read each entry's `jsonPayload.report` object.** The Phase 3 sink writes a structured report shape with these fields:
   - `effectiveDirective` — which CSP directive blocked (e.g. `style-src`, `connect-src`, `frame-src`)
   - `blockedUri` — what was blocked (e.g. `inline`, `https://de.sentry.io`, `chrome-extension://...`)
   - `documentUri` — the page where the violation fired
   - `disposition` — `report` (always, by query filter)
   - `originalPolicy` — the full CSP-RO header value the browser saw

2. **Classify each entry by `(effectiveDirective, blockedUri)` pair** and cross-reference with §Failure-Mode Triage below.

3. **Fix root cause:**
   - Code change OR firebase.json change to address the violation cause
   - Land the fix as a new commit
   - Re-run Wave 2 schema test (`npm test -- --run firebase-config`)
   - Selective deploy: `firebase deploy --only hosting --project bedeveloped-base-layers`
   - Restart the 7-day clock from Day 0 fresh

4. **Document the cycle in the Soak Log:**
   - Mark the failing Day N row Status as `TRIAGE` + summarise the root cause in Notes
   - Add a new Day 0 row below for the restart, with the fix-commit-SHA in Notes
   - The original Day 0 row stays in the table (substrate-honest audit trail; do NOT delete or rewrite past rows)

### 3.4 — Recording cadence

Each daily check writes ONE row:

| Day | Date (UTC) | Action | Violations Count | Status | Evidence/Notes |
|-----|------------|--------|------------------|--------|----------------|
| N | YYYY-MM-DD | `gcloud logging read ... --freshness=24h` | 0 (or N) | PASS / TRIAGE | clean (or root-cause summary) |

If a day is missed, leave the row as `{{ ... }}` in the table and add a row the next day with `--freshness=48h` (or whatever covers the gap). Substrate-honest: do NOT back-fill yesterday with `--freshness=24h` and call it Day N — that hides the gap.

---

## Step 4: Day 7 close-out (~5-10 min)

Day 7 close-out replaces the daily check with a full-window query. If clean across all 7 days, Wave 4 is authorised. If any violations remain across the window, restart from Day 0.

### 4.1 — Full-window query

```bash
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND resource.labels.service_name="cspreportsink"
   AND severity=WARNING
   AND jsonPayload.message="csp.violation"
   AND jsonPayload.report.disposition="report"' \
  --project=bedeveloped-base-layers \
  --limit=200 \
  --format=json \
  --freshness=7d
```

Note `--limit=200` (vs. daily `--limit=50`) and `--freshness=7d` (vs. daily `--freshness=24h`). The 7-day query catches anything the daily checks may have missed (e.g. a Day 3 violation that fell off the 24h window before the Day 4 check ran — possible if checks were not exactly 24h apart).

### 4.2 — Decision gate

| Result | Decision |
|--------|----------|
| EMPTY response (`[]`) — zero violations from non-extension origins across all 7 days | Soak CLEAN. Mark Soak Log Day 7 row `CLEAN`. Wave 4 (Plan 10-04) is operator-runnable. |
| ANY violations from non-extension origins (extension noise should already be filtered by Phase 3 sink — see §Failure-Mode Triage row 4) | Soak NOT clean. Triage per §Failure-Mode Triage; FIX → schema test → REDEPLOY → RESTART 7-day clock from Day 0; original Day 0..6 rows stay in table marked superseded. |

### 4.3 — Authorisation signal

If CLEAN, the operator returns the resume signal `soak clean — authorise Wave 4` to the spawning agent. Plan 10-04 (Wave 4) checkpoint is now operator-runnable.

If NOT clean, the operator returns the resume signal describing the restart cycle (e.g. "Day 3 surfaced 12 style-src inline violations — root cause was Plan 10-01 missed a multi-line site at src/main.js:2899; fixed in commit abc1234; soak restarted on Day 0 fresh; expect new Day 7 close-out on YYYY-MM-DD"). The checkpoint stays open until a CLEAN cycle closes.

---

## Failure-Mode Triage

Sourced from `10-RESEARCH.md §Pitfall 16 "Warning signs during soak"` + `§Open Question 2 §A4 Sentry origin assumption`.

| Symptom (`jsonPayload.report.*` fields) | Likely Cause | Fix |
|-----------------------------------------|--------------|-----|
| `effectiveDirective="connect-src"` AND `blockedUri` starts with `https://de.sentry.io` (or any `*.sentry.io` subdomain) | Sentry SDK posts to a project-specific subdomain (e.g. `o<orgId>.ingest.de.sentry.io`), not the plain `de.sentry.io` host added in Plan 10-02. The plain hostname matches the SDK's configured DSN root but NOT the actual ingest endpoint. | (a) Capture the exact origin from a forced-error reproduction (browser DevTools → Network tab → trigger an error → find the Sentry POST → copy the request URL's origin); (b) update `firebase.json` connect-src directive to include the precise ingest host (e.g. add `https://o<orgId>.ingest.de.sentry.io` OR use a wildcard `https://*.ingest.de.sentry.io` if multiple ingest hosts emerge); (c) re-run `npm test -- --run firebase-config` (the Wave 2 Sentry assertion will pass on either substring); (d) `firebase deploy --only hosting --project bedeveloped-base-layers`; (e) restart 7-day soak from Day 0. |
| `effectiveDirective="style-src"` AND `blockedUri="inline"` | Plan 10-01 missed an inline-style site, OR a new `style:` attribute landed in `src/main.js` between Plan 10-01 close-out and Wave 3 deploy. | (a) Re-grep for both patterns: `grep -rn 'style:\s*"' src/` (single-line) AND `rg --multiline 'style:\s*\n\s*"' src/` (multi-line — Plan 10-01 caught 32 of these); (b) classify each finding: assign to existing utility class from `styles.css` Phase 10 Wave 1 block (line 2803+) OR mint a new class if novel; (c) commit the migration with `refactor(10-03): migrate {N} missed inline-style site(s) — soak triage`; (d) re-run snapshot baselines (`npm test -- --run -u`); (e) deploy + restart soak. |
| `violatedDirective="frame-src"` AND `blockedUri` is non-`'self'` (i.e. a popup/iframe origin like `bedeveloped-base-layers.firebaseapp.com` or a federated OAuth provider URL) | An unexpected popup or iframe trigger has been added since Plan 10-02's verification. Phase 6 D-09 confirmed zero `signInWithPopup` / `signInWithRedirect` call sites in src/ at Wave 2 close-out. A new feature has either reintroduced a popup auth flow or added an embedded iframe. | (a) Identify the trigger: `git log --oneline 24f8a7c..HEAD -- src/` to scan post-Wave-2 commits + `grep -rn 'signInWithPopup\|signInWithRedirect\|new Window\|iframe' src/`; (b) operator decision tree — if the popup feature is intentional and recent, restore `https://bedeveloped-base-layers.firebaseapp.com` to firebase.json frame-src directive AND open a forward-tracking row to revisit at Wave 4 (post-enforcement, frame-src would be enforced and break the popup). If the popup is unintentional / dev artefact, remove the calling code; (c) deploy + restart soak. |
| `blockedUri` starts with `chrome-extension://` OR `moz-extension://` OR `safari-web-extension://` OR similar | Browser extension noise leaking through the Phase 3 `cspReportSink` filter. The filter at `functions/src/csp/filter.ts` should drop these BEFORE `logger.warn("csp.violation")` per Phase 3 design. | (a) NOT a Phase 10 issue — this is a Phase 3 substrate regression; (b) DO NOT restart the soak based on extension-noise leakage; (c) open a forward-tracking row in `runbooks/phase-10-cleanup-ledger.md` titled "Extension-noise filter regression — Phase 3 substrate" with the leaking blockedUri samples; (d) the soak proceeds as CLEAN if the only leaking entries are extension-origin (since they should not have reached the WARNING-severity log path at all per Phase 3's design intent); (e) Phase 3 Plan 06's cleanup-ledger picks up the regression in v2 follow-up. |

If a violation pattern doesn't fit any of the four rows above, treat it as a **novel triage case**: STOP the soak, escalate by opening a sub-wave 10.x with the violation's full `jsonPayload.report` object captured, and do NOT restart Wave 3 until the novel cause is understood. Substrate-honest disclosure (Pitfall 19): novel violations are NOT silently re-classified into one of the four known modes.

---

## Triage-and-restart Soak Log convention

When the soak restarts (not when it completes cleanly), the Soak Log table accumulates rows across cycles. Convention:

```
| Day  | Date          | Action / Check                                            | Violations | Status        | Evidence/Notes                                                     |
|------|---------------|-----------------------------------------------------------|------------|---------------|-------------------------------------------------------------------|
| 0    | 2026-05-11    | firebase deploy --only hosting (commit abc1234)           | n/a        | PASS          | curl -sI confirmed tightened CSP-RO; cycle-1 deploy               |
| 1    | 2026-05-12    | gcloud ... --freshness=24h                                | 0          | PASS          | clean                                                              |
| 2    | 2026-05-13    | gcloud ... --freshness=24h                                | 0          | PASS          | clean                                                              |
| 3    | 2026-05-14    | gcloud ... --freshness=24h                                | 12         | TRIAGE        | style-src inline at src/main.js:2899; cycle-1 SUPERSEDED          |
| 0    | 2026-05-14    | firebase deploy --only hosting (commit def5678 — fix-and) | n/a        | PASS          | curl -sI re-confirmed; cycle-2 deploy after Day 3 cycle-1 fix      |
| 1    | 2026-05-15    | gcloud ... --freshness=24h                                | 0          | PASS          | clean — cycle-2 day 1                                              |
| ...  | ...           | ...                                                       | ...        | ...           | ...                                                                |
| 7    | 2026-05-21    | gcloud ... --freshness=7d (close-out)                     | 0          | CLEAN         | cycle-2 close-out — Wave 4 authorised                              |
```

Key rules:
- **Original cycle rows STAY in the table** — they are audit substrate. Do NOT delete cycle-1 Days 0-3.
- **TRIAGE rows MUST cite root cause + fix-commit-SHA in Notes** — substrate-honest per Pitfall 19.
- **Cycle-2 Day 0 is the same calendar date as cycle-1's failing day** (deploy-day always equals Day 0 of the next cycle).
- **CLEAN status is the FINAL marker** — only one row in the table ever carries `CLEAN` (the close-out row of the cycle that succeeds). All previous cycles' Day 7 rows, if reached, would be `TRIAGE`-not-`CLEAN`.

---

## Citations

- HOST-07 (REQUIREMENTS.md) — Strict CSP rolled to enforced + style-src 'self' (substrate-complete-pending until Wave 4 closes the enforcement flip)
- Pitfall 8 (PITFALLS.md) — Selective deploy discipline; mass-deploy is forbidden in production
- Pitfall 10A (PITFALLS.md) — Soak window pollution from un-migrated inline-style sites (Plan 10-01 closure precondition)
- Pitfall 10B (PITFALLS.md) — Sentry connect-src origin must be allowlisted before enforcement (Plan 10-02 closure)
- Pitfall 16 (PITFALLS.md) — Three-stage CSP rollout: Stage A (Phase 3 RO with `'unsafe-inline'`) → Stage B (Wave 3 RO tightened, this runbook) → Stage C (Wave 4 enforced)
- Pitfall 19 (PITFALLS.md) — Substrate-honest disclosure pattern; do NOT back-fill timestamps or hide soak gaps
- `functions/src/csp/cspReportSink.ts` — Phase 3 substrate (READ-ONLY at Phase 10); the WARNING-severity logger.warn invocation that this runbook's gcloud filter targets
- `functions/src/csp/filter.ts` — Phase 3 extension-origin pre-filter; expected to drop chrome-extension/moz-extension/safari-web-extension blockedUri values BEFORE logger.warn
- `firebase.json` line 22 — Plan 10-02's tightened CSP-RO directive value (style-src 'self' / connect-src + de.sentry.io / frame-src 'self')
- `tests/firebase-config.test.js` — Plan 10-02's 6 schema-test assertions pinning the tightened shape; cspKey constant pattern enables single-knob Wave 4 retargeting
- `runbooks/hosting-cutover.md` — Phase 3 analog runbook; lines 67-73 cite the same `cspreportsink` Cloud Run service-name lowercase quirk
- `runbooks/phase-9-deploy-checkpoint.md` — Phase 9 analog runbook; Cutover Log table shape with PASS/FAIL/PENDING/DORMANT markers (Pitfall 19 substrate-honest disclosure)
- `10-RESEARCH.md §Pitfall 16` — Three-stage rollout rationale + warning signs during soak
- `10-RESEARCH.md §Open Question 2 §A4` — Sentry origin ingest-subdomain assumption flagged for Wave 3 verification
- `10-PATTERNS.md §File 5` — Wave 4 sibling runbook (`runbooks/csp-enforcement-cutover.md`); SEPARATE from this Wave 3 runbook
- OWASP ASVS L2 v5.0 V14.4.1 (CSP enforced + report-uri); CSP Level 3 spec; W3C Reporting API Level 1
- ISO/IEC 27001:2022 A.5.7 (cloud services); SOC 2 CC6.6 (logical access boundaries); GDPR Art. 32(1)(b) (confidentiality of processing systems)
