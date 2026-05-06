# Hosting Cutover Runbook

> Phase 3 deliverable. Execute on cutover day per CONTEXT.md D-02.
> Rollback window: 14 days from cutover date per D-03.
> Do NOT delete the `gh-pages` branch or any GitHub Pages workflow during cutover — that is the day-14 cleanup commit owned by Phase 3 Plan 06's cleanup ledger row.

This runbook is intentionally executor-deferred. The plan that authored it (03-05) deliberately did NOT run the synthetic smoke, change DNS, change GitHub repo settings, or touch the Firebase Console. Those are operator-only steps. The runbook exists so the operator follows a written script during DNS-cutover stress, not so improvisation happens at the keyboard at 02:00 UTC.

---

## Prerequisites

Before opening this runbook on cutover day, ALL of the following MUST be true. If any is false, stop and resolve it before continuing.

### From 03-PREFLIGHT.md — `PENDING-USER` items resolved

The seven `PENDING-USER` items recorded in `.planning/phases/03-hosting-cutover-baseline-security-headers/03-PREFLIGHT.md` must be resolved first. Do not start the cutover until you have answers to:

- [ ] **Firestore region** (`gcloud firestore databases describe --database='(default)' --project=bedeveloped-base-layers --format=json` returns a `locationId`). Not strictly load-bearing for the cutover (D-06 pins the function to `europe-west2` regardless), but a Phase 11 PRIVACY.md dependency you should close before next phase. Capture the value.
- [ ] **Firebase Project default URL** confirmed via `npx firebase-tools@15.16.0 hosting:sites:list --project bedeveloped-base-layers --json`. CONTEXT.md D-01 assumes `https://bedeveloped-base-layers.web.app`; confirm with the CLI.
- [ ] **Firebase Hosting Console enabled** for the project. Visit https://console.firebase.google.com/project/bedeveloped-base-layers/hosting/sites and confirm at least one Hosting site exists. If none, click "Get started" and accept the defaults (the default site uses the project ID — do not create a named additional site).
- [ ] **OIDC pool state ACTIVE** for `github-actions` pool. `gcloud iam workload-identity-pools list --location=global --project=bedeveloped-base-layers --format=json` must return an entry with `state: ACTIVE`. If MISSING, run `runbooks/firebase-oidc-bootstrap.md` end-to-end first.
- [ ] **OIDC SA roles** include `roles/firebase.admin` (or the narrower triple per `runbooks/firebase-oidc-bootstrap.md` Step 4). Verify with `gcloud projects get-iam-policy bedeveloped-base-layers --format=json` and grep for `github-actions-deploy@bedeveloped-base-layers.iam.gserviceaccount.com`. T-3-5 disposition pre-accepts the over-grant for Phase 3.
- [ ] **GitHub OIDC repo secrets present.** Visit https://github.com/lukebadiali/base-layers-diagnostic/settings/secrets/actions and confirm BOTH `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_SERVICE_ACCOUNT` exist (do NOT print values).
- [ ] **Registrar identity + DNS-admin access confirmed.** 03-PREFLIGHT.md `## Registrar` best-effort guess is **Namecheap** (current NS records are `ns1.dns-parking.com` / `ns2.dns-parking.com` — Namecheap's default parked nameservers). Log in to the registrar (best guess: https://www.namecheap.com → Domain List → bedeveloped.com → Manage), confirm domain ownership, confirm DNS-admin access, and **note the registrar name in the Cutover Log below**. If the domain is parked (no A/AAAA, only NS pointing to dns-parking.com), the registrar UI will require you to either (a) leave NS at the parked nameservers and use Namecheap's BasicDNS to add A/AAAA records on `baselayers.bedeveloped.com`, or (b) switch to whichever DNS provider you prefer to host the records. Plan for option (a) unless you have a strong reason to switch — option (b) introduces NS-propagation delay (TTL-bound, can take 24–48h).

### From the build pipeline

- [ ] **`.github/workflows/ci.yml` `deploy` job has run green on `main` at least once.** Verify with:
  ```sh
  gh run list --workflow=ci.yml --branch=main --status=success --limit=5 --json databaseId,createdAt,headSha,event
  ```
  At least one entry must exist whose `createdAt` is later than the commit that landed the deploy job (03-04). Confirm the post-deploy "Assert security headers" step passed against `https://bedeveloped-base-layers.web.app`. (Note: 03-04-SUMMARY.md flags that the deploy job's hardcoded curl assertion targets `https://baselayers.bedeveloped.com`, which will FAIL on the very first deploy because the custom domain is not yet pointing at Firebase. The first deploy run thus succeeds at the upload step but FAILS at the assertion step. That is expected pre-cutover. The cutover sequence below addresses this.)
- [ ] **`cspReportSink` Cloud Function deployed in `europe-west2`:**
  ```sh
  gcloud functions list --project=bedeveloped-base-layers --regions=europe-west2 --format=json
  ```
  Look for a function named `cspReportSink` with `state: ACTIVE` and `serviceConfig.uri` ending in `.run.app` (2nd-gen Cloud Functions are Cloud Run services).

### From the Pre-cutover Smoke Checklist (next section)

- [ ] **All five synthetic smokes have passed against `https://bedeveloped-base-layers.web.app`** (the Firebase default URL — NOT the custom domain, which still resolves to GitHub Pages parking until you flip DNS).

### Cutover window

- [ ] **~1 hour active work scheduled.** D-02 specifies a same-session ~1-hour cutover. Allow up to 24h for SSL provisioning, but the active flip + verification window is ~1h.
- [ ] **Foreground terminal session with `gcloud auth login` already completed** (so the smoke and verification commands below can run without prompting).

---

## Pre-cutover Smoke Checklist

Run these BEFORE flipping DNS. Each must pass. Run on `https://bedeveloped-base-layers.web.app` — the Firebase default URL — because at this point your custom domain `baselayers.bedeveloped.com` still resolves to GitHub Pages parking.

The five smokes below cover BOTH CSP wire formats AND the abuse path. Pitfall 3 (firebase-functions v7 body-parser may not auto-recognise `application/csp-report` content-type) is exercised here for the FIRST time end-to-end — the unit tests in 03-03 mock body parsing, but the smoke is the only test of the rawBody fallback against a real deployed function.

### Smoke 1 — Modern wire format (`application/reports+json`)

```sh
curl -i -X POST https://bedeveloped-base-layers.web.app/api/csp-violations \
  -H "Content-Type: application/reports+json" \
  -d '[{"type":"csp-violation","age":0,"url":"https://baselayers.bedeveloped.com/","user_agent":"smoke-test","body":{"blockedURL":"https://synthetic.example/blocked.js","effectiveDirective":"script-src-elem","documentURL":"https://baselayers.bedeveloped.com/","disposition":"report-only","originalPolicy":"default-src self","referrer":"","statusCode":200,"sample":""}}]'
```

**Expected:** `HTTP/2 204` (or `HTTP/1.1 204`).

**Cloud Logging verification (run within 30s):**

```sh
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="cspreportsink" AND severity=WARNING AND jsonPayload.message="csp.violation" AND jsonPayload.report.blockedUri="https://synthetic.example/blocked.js"' \
  --project=bedeveloped-base-layers --limit=5 --format=json --freshness=2m
```

**Expected:** at least one log entry. `jsonPayload.report.blockedUri == "https://synthetic.example/blocked.js"`. `jsonPayload.fingerprint` is present (a string keyed on origin + directive). `severity == "WARNING"`.

### Smoke 2 — Legacy wire format (`application/csp-report`) — Pitfall 3 fallback exercise

```sh
curl -i -X POST https://bedeveloped-base-layers.web.app/api/csp-violations \
  -H "Content-Type: application/csp-report" \
  -d '{"csp-report":{"document-uri":"https://baselayers.bedeveloped.com/","blocked-uri":"https://synthetic-legacy.example/blocked.js","violated-directive":"script-src-elem","effective-directive":"script-src-elem","disposition":"report","status-code":200,"original-policy":"default-src self"}}'
```

**Expected:** `HTTP/2 204`.

**Cloud Logging verification (within 30s):**

```sh
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="cspreportsink" AND severity=WARNING AND jsonPayload.message="csp.violation" AND jsonPayload.report.blockedUri="https://synthetic-legacy.example/blocked.js"' \
  --project=bedeveloped-base-layers --limit=5 --format=json --freshness=2m
```

**Expected:** at least one log entry with `jsonPayload.report.blockedUri == "https://synthetic-legacy.example/blocked.js"`.

**If the curl returns 204 but Cloud Logging is empty:** Pitfall 3 (rawBody fallback) failed. The function received the request but did not parse the body. Inspect `functions/src/csp/cspReportSink.ts` — the `req.rawBody?.toString("utf8")` branch may need adjustment or the content-type check may have rejected it before the fallback. Do NOT proceed to cutover until Smoke 2 produces a Cloud Logging entry.

### Smoke 3 — Abuse: wrong content-type rejected

```sh
curl -i -X POST https://bedeveloped-base-layers.web.app/api/csp-violations \
  -H "Content-Type: application/json" \
  -d '{"csp-report":{"blocked-uri":"x"}}'
```

**Expected:** `HTTP/2 400 Bad Request`.

**Cloud Logging verification:** the same gcloud logging filter (with `blockedUri="x"`) MUST return zero entries — the function rejected before `logger.warn`.

### Smoke 4 — Abuse: oversized body rejected

```sh
head -c 67584 /dev/urandom | base64 | curl -i -X POST https://bedeveloped-base-layers.web.app/api/csp-violations \
  -H "Content-Type: application/csp-report" --data-binary @-
```

**Expected:** `HTTP/2 413 Payload Too Large`.

**Cloud Logging verification:** zero entries (the body was rejected at the size gate before logger.warn).

### Smoke 5 — Filter: extension origin dropped

```sh
curl -i -X POST https://bedeveloped-base-layers.web.app/api/csp-violations \
  -H "Content-Type: application/csp-report" \
  -d '{"csp-report":{"document-uri":"https://baselayers.bedeveloped.com/","blocked-uri":"chrome-extension://fakeid/script.js","violated-directive":"script-src-elem","effective-directive":"script-src-elem","disposition":"report"}}'
```

**Expected:** `HTTP/2 204` (the function accepted the report).

**Cloud Logging verification (within 30s):**

```sh
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="cspreportsink" AND severity=WARNING AND jsonPayload.message="csp.violation" AND jsonPayload.report.blockedUri="chrome-extension://fakeid/script.js"' \
  --project=bedeveloped-base-layers --limit=5 --format=json --freshness=2m
```

**Expected:** ZERO entries — the filter dropped the report before `logger.warn`. If a log entry IS produced, `functions/src/csp/filter.ts` `EXTENSION_SCHEMES` is missing `chrome-extension://` or `shouldDrop()` regressed. Re-run filter unit tests (`cd functions && npm test -- --run filter`).

### Cloud Logging filter — full reference

The exact filter expression all five smokes use is:

```
resource.type="cloud_run_revision"
AND resource.labels.service_name="cspreportsink"
AND severity=WARNING
AND jsonPayload.message="csp.violation"
```

Add `jsonPayload.report.blockedUri="<value>"` per smoke. The Cloud Run service name is `cspreportsink` (lowercase, no hyphens) because Firebase's 2nd-gen functions deploy lowercases the function name when minting the underlying Cloud Run service. Verify the actual service name with `gcloud run services list --project=bedeveloped-base-layers --region=europe-west2` if the filter returns nothing.

### Synthetic-smoke result block

After all five smokes pass, append the following block to `.planning/phases/03-hosting-cutover-baseline-security-headers/03-PREFLIGHT.md`:

```markdown
## Smoke Result (Wave 4 — pre-cutover synthetic)

- smoke_run_at: <ISO 8601 UTC timestamp>
- smoke_target: https://bedeveloped-base-layers.web.app/api/csp-violations
- smoke_1_modern_format:
  - http_status: 204
  - cloud_logging_seen: yes (entry insertId: <copy from gcloud output>)
- smoke_2_legacy_format:
  - http_status: 204
  - cloud_logging_seen: yes (entry insertId: <copy from gcloud output>)
- smoke_3_wrong_content_type:
  - http_status: 400
  - cloud_logging_seen: no (correct — rejected before logger.warn)
- smoke_4_oversized_body:
  - http_status: 413
  - cloud_logging_seen: no (correct — rejected before logger.warn)
- smoke_5_extension_origin:
  - http_status: 204
  - cloud_logging_seen: no (correct — filter dropped before logger.warn)
- all_smokes_passed: yes
```

If any smoke fails, set `all_smokes_passed: no`, list `blockers:` below, and STOP — do not flip DNS until smokes are green.

---

## Cutover Steps

The active flip is ~1 hour. Plan for SSL provisioning to add up to 24h on top of that (during which the Firebase default URL `https://bedeveloped-base-layers.web.app` is the rollback target). Steps below are sequenced for the ~1h same-session window per D-02.

### Step 1: Verify smokes from default URL (~5 min)

Confirm the §Pre-cutover Smoke Checklist above is green and the `## Smoke Result` block is appended to `03-PREFLIGHT.md`. If even one smoke is yellow, stop and resolve before proceeding.

### Step 2: Add custom domain in Firebase Console (~5 min + verification wait)

1. Open https://console.firebase.google.com/project/bedeveloped-base-layers/hosting/sites in a browser.
2. Click "Add custom domain".
3. Enter `baselayers.bedeveloped.com` and click Continue.
4. The Console will show a TXT verification record. Capture:
   - The TXT record name (typically `baselayers.bedeveloped.com` or `_firebase-verify.baselayers.bedeveloped.com` — read what the Console shows).
   - The TXT record value (looks like `firebase-site-verification=<long-string>`).
5. Leave the Console tab open. Continue to Step 3.

### Step 3: Get verification TXT record + A/AAAA records from Firebase (~2 min)

Per 03-RESEARCH.md §DNS Cutover Specifics:

- Firebase provides a **TXT verification record** that must remain permanently (it authorises SSL certificate renewal — DO NOT delete it after cutover completes).
- Firebase provides **one or more A records** (and possibly AAAA) for `baselayers.bedeveloped.com`. Note all IP addresses verbatim. The Console will display them after the TXT record is verified in Step 5.

If the Console offers a CNAME flattening option for `baselayers.bedeveloped.com` (a subdomain), prefer A/AAAA — CNAME flattening behaviour varies by registrar.

### Step 4: Update DNS at the registrar (~10 min — TTL-bound)

Log in to the registrar (best guess: Namecheap per 03-PREFLIGHT.md `## Registrar`).

1. **Capture the current state first** (for rollback). Note the existing records on `baselayers.bedeveloped.com`:
   - If parked: there will be no A/AAAA records, only NS pointing at `ns1.dns-parking.com` / `ns2.dns-parking.com`. The cutover effectively configures DNS for the first time.
   - If pointing at GitHub Pages: the existing A records are typically `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` (GitHub Pages IPs). Note them — you will need them if you have to revert.

2. **Add the TXT verification record** captured in Step 3 (name + value) at the registrar UI. Save.

3. **Lower TTL on existing records** for `baselayers.bedeveloped.com` to 300 seconds (5 minutes). If the domain is parked there are no existing records — skip this step.

4. **Wait for TXT verification.** Refresh the Firebase Console tab from Step 2. The Console must show "Verified" on the TXT record before it will display the A/AAAA records. Typical wait: 1–5 minutes for Namecheap BasicDNS.

5. **Add the A/AAAA records** from Step 3 at the registrar UI. Set TTL to 300s. Save.

6. **If the domain is parked** at `ns1.dns-parking.com` / `ns2.dns-parking.com`: the records you just added at Namecheap BasicDNS will become authoritative immediately on the parked NS — no NS-propagation delay. If you instead chose to switch nameservers (option b in Prerequisites), expect 24–48h NS propagation before A/AAAA records become visible.

### Step 5: Wait for SSL provisioning (~5–60 min, up to 24h worst case)

Firebase auto-provisions an SSL certificate within 24 hours of DNS pointing to Firebase IPs (per 03-RESEARCH.md §DNS Cutover Specifics — typical: a few hours; for a fresh domain pointing for the first time: often <60 min).

Monitor with:

```sh
watch -n 30 "curl -sI https://baselayers.bedeveloped.com | head -10"
```

Wait until the response shows:

- `HTTP/2 200` (rather than the GitHub Pages 404 or a TLS handshake error)
- `strict-transport-security: max-age=63072000; includeSubDomains; preload`
- `content-security-policy-report-only: ...` (long value — must contain `frame-ancestors 'none'`, `report-uri /api/csp-violations`, and `report-to csp-endpoint` per 03-02-SUMMARY.md schema-test contract)

If `curl` shows a certificate warning (e.g. `SSL certificate problem: certificate has expired` or `unable to get local issuer certificate`), Firebase is still provisioning. The Firebase Console shows status "Minting certificate" → "Connected"; wait for "Connected".

**During SSL provisioning, the rollback target is the Firebase default URL (`https://bedeveloped-base-layers.web.app`).** Both URLs serve identical content; the only difference is the cert.

### Step 6: Verify smoke from custom domain (~5 min)

Once Step 5 shows `HTTP/2 200` with the full header set, re-run a SUBSET of the smokes — Smoke 1 (modern format) — but against the custom domain:

```sh
curl -i -X POST https://baselayers.bedeveloped.com/api/csp-violations \
  -H "Content-Type: application/reports+json" \
  -d '[{"type":"csp-violation","age":0,"url":"https://baselayers.bedeveloped.com/","user_agent":"post-cutover-smoke","body":{"blockedURL":"https://post-cutover.example/blocked.js","effectiveDirective":"script-src-elem","documentURL":"https://baselayers.bedeveloped.com/","disposition":"report-only","originalPolicy":"default-src self","referrer":"","statusCode":200,"sample":""}}]'
```

**Expected:** `HTTP/2 204`. Verify in Cloud Logging within 30s using:

```sh
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="cspreportsink" AND severity=WARNING AND jsonPayload.message="csp.violation" AND jsonPayload.report.blockedUri="https://post-cutover.example/blocked.js"' \
  --project=bedeveloped-base-layers --limit=5 --format=json --freshness=2m
```

This proves the firebase.json rewrite from `/api/csp-violations` to the function works on the custom domain (T-3-2: rewrite shadowing detection — unit tests can't catch a config bug that only manifests on live DNS).

Also fetch headers and capture verbatim — this is what gets recorded in the `## Cutover Log`:

```sh
curl -sI https://baselayers.bedeveloped.com
```

Save the full output for the Cutover Log entry below.

### Step 7: Verify securityheaders.com rating (~2 min)

Visit https://securityheaders.com/?q=baselayers.bedeveloped.com&followRedirects=on in a browser.

**Expected:** rating ≥ A (A or A+). Capture:

- Overall rating letter
- Summary table (which headers were detected, which were missing)

If rating < A, stop and investigate before continuing. The cutover IS technically complete at this point but a sub-A rating is a phase-3 success-criterion failure (HOST-08).

Save the screenshot under `docs/evidence/phase-3-securityheaders-rating.png` (the screenshot itself is collected by Phase 11 DOC-09; this runbook just notes the path).

### Step 8: Disable GitHub Pages serving (~1 min)

GitHub repo → Settings → Pages → Source → **None** → Save.

**DO NOT** delete the `gh-pages` branch.
**DO NOT** delete any Pages-deploy GitHub Actions workflow file (none currently exists per 03-RESEARCH.md §GitHub Pages "Disable" Semantics; verify with `ls .github/workflows/` and confirm only `ci.yml` is present).

The site at `https://lukebadiali.github.io/base-layers-diagnostic/` will return HTTP 404 after this; the custom domain at `baselayers.bedeveloped.com` is unaffected (DNS now points to Firebase). The 14-day rollback window starts from this moment per D-03.

### Step 9: Update 03-PREFLIGHT.md `## Cutover Log` (~3 min)

Open `.planning/phases/03-hosting-cutover-baseline-security-headers/03-PREFLIGHT.md` and fill in the `## Cutover Log` section that 03-05 authored as a skeleton:

```
cutover_date: <YYYY-MM-DD HH:MM TZ — the moment Step 8 GH-Pages disable was saved>
cutover_complete: yes
cutover_observed_headers: |
  HTTP/2 200
  strict-transport-security: max-age=63072000; includeSubDomains; preload
  x-content-type-options: nosniff
  referrer-policy: strict-origin-when-cross-origin
  permissions-policy: camera=(), microphone=(), ...
  cross-origin-opener-policy: same-origin
  cross-origin-embedder-policy: credentialless
  cross-origin-resource-policy: same-origin
  reporting-endpoints: csp-endpoint="/api/csp-violations"
  content-security-policy-report-only: default-src 'self'; ...
securityheaders_rating: A
ssl_provisioned_at: <YYYY-MM-DD HH:MM TZ — the moment Step 5 first showed HTTP/2 200>
synthetic_csp_e2e_seen_in_cloud_logging: yes
post_cutover_smoke_blockedUri: https://post-cutover.example/blocked.js
notes: <freeform — anything that didn't go to plan, e.g. how long SSL took>
```

Commit with message: `chore(03-05): record cutover log in 03-PREFLIGHT.md`. This commit is owned by the 03-05 checkpoint resume (the human-action handler will run it after the operator replies with the cutover values), not by this runbook directly.

### Step 10: Raise TTL back to normal (~1 min)

In the registrar UI, raise the TTL on the new A records back to 3600s (or whatever the registrar default is). 300s during cutover reduced rollback time; once stable, raise to reduce DNS query load.

---

## DNS Revert Procedure

**Time estimate: 15 minutes total.**

Use this if the cutover is attempted and a regression is discovered within 14 days. The 14-day window per D-03 is why the `gh-pages` branch and Pages workflows are RETAINED.

### Step R1: Re-enable GitHub Pages (~1 min)

GitHub repo → Settings → Pages → Source → **Deploy from a branch** → Branch: `main` (or `gh-pages` if a Pages-deploy workflow was using it; verify by inspecting `git branch -a | grep gh-pages`) → Folder: `/ (root)` → Save.

The site resumes serving from the chosen branch within 1–5 minutes per 03-RESEARCH.md §GitHub Pages "Disable" Semantics.

### Step R2: Revert DNS at the registrar (~5 min)

In the registrar UI for `bedeveloped.com`:

- Remove the Firebase A/AAAA records added in cutover Step 4.
- If `baselayers.bedeveloped.com` was previously pointing at GitHub Pages (had the four `185.199.108-111.153` A records), restore those exact A records. If the domain was parked before cutover (no A records at all), simply leave it without A records — the GitHub Pages serving from `https://lukebadiali.github.io/base-layers-diagnostic/` does not require the custom domain.
- Keep the TXT verification record from Step 3 (it's harmless and avoids re-verification on the next cutover attempt).
- TTL: leave at 300s for the duration of the rollback window.

### Step R3: Wait for propagation (~5 min)

If cutover Step 4 set TTL=300s, propagation completes in ~5 min. Verify with:

```sh
curl -sI https://baselayers.bedeveloped.com | head -10
```

Header set should be the bare GitHub Pages set: `Server: GitHub.com`, no `Strict-Transport-Security`, no `Content-Security-Policy-Report-Only`. If you still see Firebase headers, DNS hasn't propagated yet — wait another TTL cycle.

### Step R4: Update 03-PREFLIGHT.md `## Cutover Log` to record the rollback (~3 min)

```
cutover_date: <YYYY-MM-DD HH:MM TZ>
cutover_complete: rolled-back
rollback_reason: <freeform — what triggered the revert, e.g. "header X missing on live response", "function rewrite returned index.html for /api/csp-violations">
rollback_completed_at: <YYYY-MM-DD HH:MM TZ>
cutover_observed_headers: <output of Step 6 curl, even if it showed the regression — useful for triage>
securityheaders_rating: <whatever was observed, even if F>
ssl_provisioned_at: <if got that far>
synthetic_csp_e2e_seen_in_cloud_logging: <yes | no>
notes: <freeform>
```

Commit with `chore(03-05): record cutover rollback in 03-PREFLIGHT.md`. Add a ROADMAP.md note that Phase 3 cutover was attempted and rolled back; Phase 3 close-out is held until cutover succeeds (Phase 3 Plan 06 will execute differently — the cleanup ledger entry for the 14-day deletion remains future-tense rather than calendar-pinned).

---

## Day-14 Cleanup

**Calendar trigger: cutover_date + 14 days** (where `cutover_date` is the value recorded in `03-PREFLIGHT.md ## Cutover Log` after Step 9). This date opens the window for deleting the GH-Pages rollback substrate.

**Hard rule: DO NOT delete the `gh-pages` branch before day 14.** That branch + any Pages workflows form the 14-day rollback target per CONTEXT.md D-03. Premature deletion forfeits the rollback option. If a regression is discovered on day 13, the runbook's §DNS Revert Procedure must remain executable.

This step is owned by the cleanup ledger row added in Phase 3 Plan 06 (`runbooks/phase-4-cleanup-ledger.md` row "Phase 3 GH-Pages rollback substrate").

### On the calendar-trigger date

1. **Confirm no rollback was triggered.** Check `03-PREFLIGHT.md ## Cutover Log → cutover_complete:` is `yes` (not `rolled-back`). If `rolled-back`, do NOT delete; the substrate is still active.
2. **Delete the `gh-pages` branch:**
   ```sh
   git push origin --delete gh-pages
   ```
   (Confirm with `git branch -r | grep gh-pages` returning empty.)
3. **Delete any Pages-deploy workflow.** Currently there is no Pages-deploy workflow in `.github/workflows/` (the previous deployment was direct from the `gh-pages` branch, not a workflow). Confirm with:
   ```sh
   ls .github/workflows/
   ```
   Only `ci.yml` should be present. If a Pages-deploy workflow file exists (e.g. `pages.yml`, `gh-pages.yml`, `deploy.yml`), delete it.
4. **Update the cleanup-ledger entry to status "closed"** in `runbooks/phase-4-cleanup-ledger.md`.
5. **Commit:**
   ```
   chore(03): delete GH-Pages rollback substrate (day 14 — cutover_date + 14)
   ```

---

## Citations

- D-01 (CONTEXT.md) — Firebase project URL soak before custom-domain flip
- D-02 (CONTEXT.md) — Smoke + same-session ~1h CNAME flip; defensible because no live users
- D-03 (CONTEXT.md) — GH-Pages rollback retained 14 days; branch + workflows kept dormant
- HOST-01 (REQUIREMENTS.md) — `baselayers.bedeveloped.com` resolves to Firebase Hosting; SSL valid; GitHub Pages site disabled
- HOST-02 (REQUIREMENTS.md) — Custom domain migrated via DNS update; SSL auto-provisioned
- HOST-08 (REQUIREMENTS.md) — securityheaders.com rating ≥ A on live custom domain
- FN-10 (REQUIREMENTS.md) — CSP report sink end-to-end (function deployed, route via firebase.json rewrite, log entry visible in Cloud Logging)
- T-3-2 (03-05-PLAN.md `<threat_model>`) — firebase.json rewrite ordering: real-traffic version of the schema test, mitigated by Smoke 1 + Smoke 2 hitting the rewrite path
- Pitfall 3 (03-RESEARCH.md §Pitfall 3) — Body-parser may not auto-recognise `application/csp-report` content-type; rawBody fallback required; Smoke 2 is the end-to-end exercise of this fallback
- 03-RESEARCH.md §DNS Cutover Specifics — TXT verification record + A/AAAA records flow + SSL provisioning timeline + ~1h D-02 plan rationale
- 03-RESEARCH.md §GitHub Pages "Disable" Semantics — what changes when Source → None; gh-pages branch + workflows remain
- `runbooks/firebase-oidc-bootstrap.md` — Phase 1 D-23 deliverable; OIDC pool / SA / repo secrets prerequisite for the deploy job that ships the function this runbook smokes
- [Firebase Hosting custom domain documentation](https://firebase.google.com/docs/hosting/custom-domain)
- [GitHub Pages disable semantics](https://docs.github.com/en/pages)
- OWASP ASVS L2 v5.0 V14.4 (HTTP Security Headers), V14.7 (Build & Deploy Pipeline) — the controls this runbook activates
- ISO/IEC 27001:2022 A.5.7 (cloud services), A.13.1.3 (segregation in networks)
- SOC 2 CC6.6 (logical access security boundaries), CC8.1 (change management)
- GDPR Art. 32(1)(b) (confidentiality of processing systems and services)
