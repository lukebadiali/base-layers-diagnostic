# Phase 9 — Sentry Bootstrap (Operator Runbook)

> Phase: 9 — Observability + Audit-Event Wiring
> Wave: 1 (Plan 09-01 substrate)
> Requirements: OBS-01 + OBS-02 + OBS-08 substrate + DOC-10 (incremental — Wave 6 lands the SECURITY.md § Observability section)
> Date authored: 2026-05-10
> Objective: Bootstrap a Sentry organisation, EU-region project, DSN, auth token, and 70 percent quota alert before Wave 2 (`@sentry/vite-plugin` source-map upload) ships.

This is a single-operator-session runbook. Wave 2 (Plan 09-02) ships source-map upload via `@sentry/vite-plugin`; Wave 4 (Plan 09-04) ships `authAnomalyAlert` (Slack dispatcher); Wave 5 (Plan 09-05) ships GCP-tier monitors. Each has its own runbook. This Wave-1 runbook covers ONLY the Sentry-side bootstrap.

The empty-DSN kill-switch in `src/observability/sentry.js` (`if (!dsn) return;`) means the Phase 9 substrate code is already merged-and-safe BEFORE this runbook is executed — Sentry events only flow once `VITE_SENTRY_DSN` is set in CI/preview/prod (Step 5 below).

---

## Pre-conditions

- **Sentry account access:** operator can create / has admin on a Sentry organisation. If creating a new org, operator has email-verified Sentry credentials.
- **gcloud SDK installed:** required by Wave 5 monitors-bootstrap runbook (not used here, but the operator should already have it for the same session). Verify:
  ```bash
  gcloud --version
  ```
- **GitHub repo settings access:** operator can add Actions secrets to the `lukebadiali/base-layers-diagnostic` repo (Repo settings -> Secrets and variables -> Actions).
- **EU residency requirement understood:** the DSN encodes the region. The substring `.ingest.de.sentry.io` IS the OBS-02 contract — no other indicator matters. Once a Sentry project is created in a region, the region cannot be changed.

---

## Step 1 — Create Sentry organisation (or use existing)

If a `bedeveloped` org already exists, skip to Step 2. Otherwise:

1. Visit https://sentry.io/signup/ and create the org with:
   - **Organisation slug:** `bedeveloped`  (matches the `vite.config.js` Wave-2 plugin config — Plan 09-02 hardcodes this)
   - **Region at signup:** EU (Frankfurt). Sentry asks at sign-up; choose EU.
   - **Plan tier:** start with Developer (free) — quota is 5,000 errors/month. Wave-5 monitors-bootstrap runbook documents the upgrade trigger if quota alerts fire (Step 6 below).

Verify the org created in EU region:

- Sentry web UI -> Settings -> Organisation Settings -> the URL bar should show `https://bedeveloped.sentry.io/...`.
- Settings -> Organisation Settings -> Region: should read **EU (Frankfurt)**.

---

## Step 2 — Create EU-region project

CRITICAL: the region picker is at project create time only. A project created in `us.sentry.io` cannot be migrated to `de.sentry.io`. Verify region BEFORE clicking Create.

1. Sentry web UI -> Projects -> Create Project.
2. Platform: **Browser** -> **JavaScript** (NOT a framework like React/Vue — we are vanilla JS).
3. **Region picker:** select **EU (Frankfurt — `de.sentry.io`)**. If the picker is missing, the org was created in US region and Step 1 must be re-run on a fresh org.
4. **Project name:** `base-layers-diagnostic` (matches the `vite.config.js` Wave-2 plugin config).
5. **Alert frequency:** "Alert me on every new issue" -> deferred to Wave 5 (monitors-bootstrap will re-tune to "anomaly only").
6. Click Create Project.

---

## Step 3 — Copy the DSN

1. Sentry web UI -> the new project -> Settings -> Client Keys (DSN).
2. Copy the DSN string. It MUST start with `https://` and contain the substring `.ingest.de.sentry.io`. Example shape:

   ```
   https://abc123def456@o12345.ingest.de.sentry.io/67890
   ```

3. The `.ingest.de.sentry.io` substring is the EU-residency contract for OBS-02. Save the full DSN to a password manager keyed `bedeveloped-base-layers VITE_SENTRY_DSN` for re-use across the session.

If the DSN does not contain `.de.sentry.io`, STOP — the project was created in the wrong region. Delete it and re-run Step 2 in EU region.

---

## Step 4 — Create Sentry auth token

The auth token is consumed by `@sentry/vite-plugin` (Wave 2) for source-map upload — not by the runtime SDK. Without it, source-map upload is a no-op (intentional fallback — PR/preview builds without the secret will not block).

1. Sentry web UI -> User Settings (top-right avatar) -> Auth Tokens -> Create New Token.
2. **Token name:** `base-layers-diagnostic CI source-maps`.
3. **Scopes (minimum required):**
   - `project:releases`
   - `org:read`
   - `project:write`
4. Click Create Token.
5. Copy the token. It is shown ONCE — save to the password manager keyed `bedeveloped-base-layers SENTRY_AUTH_TOKEN`.

---

## Step 5 — Set GitHub Actions secrets

Two secrets only. NOTE — `SLACK_WEBHOOK_URL` is intentionally NOT a GitHub Actions secret. It lives in GCP Secret Manager (provisioned in `runbooks/phase-9-monitors-bootstrap.md` Step 2 in Wave 5) because the only consumer is the `authAnomalyAlert` Cloud Function, which reads via `defineSecret("SLACK_WEBHOOK_URL")`. CI/build jobs never need it.

1. Repo settings -> Secrets and variables -> Actions -> New repository secret.
2. Add:
   - **Name:** `VITE_SENTRY_DSN` -> **Value:** the DSN from Step 3 (the full `https://...@o<id>.ingest.de.sentry.io/<projectId>` string).
   - **Name:** `SENTRY_AUTH_TOKEN` -> **Value:** the auth token from Step 4.
3. Verify both appear in the secrets list (values are masked; only names visible).

---

## Step 6 — Configure 70 percent quota alert (OBS-08)

This is the budget alert that warns the operator BEFORE Sentry quota is exhausted (defensive — events past 100 percent are dropped silently in the free tier; OBS-08 says we get warned at 70 percent so we can investigate or upgrade).

1. Sentry web UI -> Settings -> Subscription -> Quotas (or Subscription -> Billing).
2. Find "Quota Alerts" or "Spike Protection".
3. Configure: **Notify when monthly events reach 70 percent of quota**.
4. Channel: operator email (the email Sentry sends invoices to is fine).
5. Save.
6. **Screenshot evidence:** capture the configured alert page and store at `docs/evidence/phase-9-sentry-70pct-quota-alert.png` for the Phase 11 evidence pack.

If the free tier UI does not expose a 70 percent threshold (Sentry UI has been in flux), the substitute is "Spike Protection" (which fires on anomalous bursts) plus a manual quarterly check that monthly volume is < 70 percent of quota. Document whichever path was taken in the Cutover Log below.

---

## Step 7 — Verification

After Steps 1-6, the operator confirms:

- [ ] Sentry project visible at `https://bedeveloped.sentry.io/projects/base-layers-diagnostic/` (org slug + project slug match exactly — Wave-2 plugin config will fail otherwise).
- [ ] Sentry project Settings -> General -> Region: **EU (Frankfurt)**.
- [ ] DSN starts with `https://` AND contains `.ingest.de.sentry.io` (OBS-02 contract).
- [ ] GitHub repo Settings -> Secrets and variables -> Actions: `VITE_SENTRY_DSN` and `SENTRY_AUTH_TOKEN` both present.
- [ ] Sentry Settings -> Subscription -> Quota Alert / Spike Protection: configured at 70 percent (or Spike Protection enabled with documented manual cadence).
- [ ] Screenshot saved to `docs/evidence/phase-9-sentry-70pct-quota-alert.png`.

---

## Cutover Log

> Operator-fill template — substitute `{{ T+0 }}` placeholders with real timestamps the day this runbook is executed. Substrate-honest disclosure (Pitfall 19): false timestamps would violate compliance credibility. If this runbook has not yet been executed, the placeholders persist as the audit trail.

| Step | Action | Operator | Timestamp (UTC) | Evidence |
|------|--------|----------|-----------------|----------|
| 1 | Create / verify `bedeveloped` Sentry org in EU region | _PENDING_ | `{{ T+0 }}` | Org URL + Region screenshot |
| 2 | Create `base-layers-diagnostic` project (EU region) | _PENDING_ | `{{ T+0 }}` | Project URL |
| 3 | Copy DSN; verify `.ingest.de.sentry.io` substring | _PENDING_ | `{{ T+0 }}` | DSN substring check |
| 4 | Create auth token (project:releases + org:read + project:write) | _PENDING_ | `{{ T+0 }}` | Token name in audit log |
| 5 | Set `VITE_SENTRY_DSN` + `SENTRY_AUTH_TOKEN` GitHub secrets | _PENDING_ | `{{ T+0 }}` | Secrets list screenshot |
| 6 | Configure 70 percent quota alert (OBS-08) | _PENDING_ | `{{ T+0 }}` | `docs/evidence/phase-9-sentry-70pct-quota-alert.png` |
| 7 | Verification (all four bullets above) | _PENDING_ | `{{ T+0 }}` | Confirmation in this row |

---

## Rollback

If the Sentry project was created in the wrong region (US instead of EU), rollback is:

1. Sentry web UI -> the project -> Settings -> General -> Remove Project. This is a hard delete; events are unrecoverable.
2. Re-run Step 2 in EU region.
3. Re-run Steps 3-6 (DSN, auth token, GitHub secrets, quota alert) with the new project's values.

If `VITE_SENTRY_DSN` is set incorrectly in GitHub Actions, the `src/observability/sentry.js` empty-DSN check coalesces falsy values to no-op — production builds will silently skip Sentry init rather than crash. Operator can update the secret without a redeploy gate (next CI build picks up the new value).

---

## Forward-tracking

- **Wave 2 (Plan 09-02):** `@sentry/vite-plugin` consumes `VITE_SENTRY_DSN` + `SENTRY_AUTH_TOKEN` from CI to upload source maps. Same DSN, same auth token — no new operator step.
- **Wave 4 (Plan 09-04):** `authAnomalyAlert` Cloud Function consumes the SLACK_WEBHOOK_URL secret (separate, NOT the Sentry DSN). See `runbooks/phase-9-monitors-bootstrap.md` Step 2.
- **Wave 5 (Plan 09-05):** GCP-tier uptime + budget alerts are operator-provisioned via `scripts/setup-uptime-check/run.js` + `scripts/setup-budget-alerts/run.js`. Separate runbook.
- **Wave 6 (Plan 09-06):** SECURITY.md § Observability + Phase 9 Audit Index reference this runbook by name as the OBS-02 EU-residency evidence anchor.
