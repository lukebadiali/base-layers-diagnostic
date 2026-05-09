# Phase 7 — App Check Staged Rollout (Operator Runbook)

> **Phase 7 Wave 3 (07-03) deliverable.** Operator-facing playbook for the
> 6-stage App Check rollout. Wave 3 lands Stages **A + B + C** (enrolment,
> quota alert, 7-day soak start). Stages **D + E + F** (per-service
> enforcement) are **operator-paced** and intentionally deferred to
> [`07-HUMAN-UAT.md`](../../.planning/phases/07-cloud-functions-app-check-trusted-server-layer/07-HUMAN-UAT.md)
> per the standard Phase 3 / Phase 5 / Phase 6 deferred-operator-execution
> pattern.
>
> Source: `.planning/phases/07-cloud-functions-app-check-trusted-server-layer/07-RESEARCH.md`
> Pattern 3 (Staged Rollout) + Pitfall 8 (debug-token gating).

---

## Overview — why staged rollout

App Check enforcement is binary at the service level (Storage / Firestore /
Cloud Functions / RTDB). Once enforced, ANY client missing a valid App Check
token is rejected. Turning enforcement on too fast in front of a long tail of
release channels, scratch projects, and CI runners is the canonical way to
lock legitimate users out (Pitfall 8 — Firebase docs explicitly call this
out).

The mitigation, codified by Firebase docs and SOC2 CC6.6 / OWASP A05:2025, is
a **6-stage rollout** with an **enforced 7-day unenforced-mode soak window**
in the middle. The soak verifies that ≥95% of in-flight tokens come from
properly-enrolled clients before any service flips to enforcement. Per-service
ordering — Storage first (lowest blast radius — uploads only), then Firestore
collection-by-collection, then Cloud Functions — gives independent rollback
toggles at each step.

| Risk if skipped | Mitigation |
|-----------------|------------|
| Production lockout if a client release is missing the token-attached SDK | 7-day soak with ≥95% verified-ratio gate |
| One bad collection's predicate denies legitimate writes | Per-collection enforcement toggle gives 1-click rollback |
| Quota exhaustion under abuse | 70% quota alert (Stage B) gives early warning |
| Silent App Check bypass on production deploy | Build-time guard in `vite.config.js` (Wave 3 Task 2) — `vite build` fails without `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` |

---

## Stage Table (paste-ready from 07-RESEARCH.md Pattern 3)

| Stage | Trigger | Action | Verification |
|-------|---------|--------|--------------|
| **A** | Wave 3 commit | Enrol App Check + reCAPTCHA Enterprise; deploy `check.js` to production; **leave enforcement OFF** | App Check dashboard shows non-zero `verified` count within 24h |
| **B** | Day 0 (deploy) | Configure 70% quota alert | Synthetic alert test fires |
| **C** | Day 7+ | Verify "verified ≥95%, unverified ≤5%" for ≥7 consecutive days | Screenshot for evidence pack (DOC-09) |
| **D** | Day 8+ | Enforce on **Storage** | Upload smoke test passes; failed-auth test denies |
| **E** | Day 9+ | Enforce on Firestore — **collection by collection** | Per-collection dashboard ratio re-verified |
| **F** | Day 14+ | Enforce on **Cloud Functions** | Un-attested client returns `unauthenticated` HttpsError |

Operator tracks each stage with checkbox + ISO timestamp + screenshot path in
`runbooks/phase-7-app-check-enforcement.md` (the evidence-pack runbook).

---

## Stage A — Enrolment (Wave 3 Task 1; OPERATOR EXECUTION REQUIRED)

> **Substrate-honest deferral.** Wave 3 ships the code path
> (`src/firebase/check.js` body filled with `ReCaptchaEnterpriseProvider`)
> + the env-var contract (`.env.example` documents
> `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` + `VITE_APPCHECK_DEBUG_TOKEN`) +
> the build-time guard (`vite.config.js` fails production build if site key
> unset). The Console-side enrolment is operator-execution because it
> requires Firebase Console + GCP Console access as the project owner
> (`business@bedeveloped.com`). Mirrors the Phase 6 D-22 ToS-gate substrate-
> honest pattern.

### A.1 Create the reCAPTCHA Enterprise site key

1. Visit <https://console.cloud.google.com/security/recaptcha?project=bedeveloped-base-layers>.
2. Click **Create Key**.
3. Settings:
   - **Type:** Website
   - **Domains:** `baselayers.bedeveloped.com`, `bedeveloped-base-layers.web.app`, `bedeveloped-base-layers.firebaseapp.com`
   - **Integration type:** Score-based (default)
4. Click **Create**.
5. Copy the **site key** — starts with `6L...`. Save the first 8 chars in `runbooks/phase-7-app-check-enforcement.md` Stage A evidence (full key goes into `.env.local` only — NEVER commit).

### A.2 Register the site key in Firebase Console App Check

1. Visit <https://console.firebase.google.com/project/bedeveloped-base-layers/appcheck/apps>.
2. Click on the Web app `1:76749944951:web:9d0db9603ecaa7cc5fee72`.
3. Settings:
   - **Provider:** reCAPTCHA Enterprise
   - **Site key:** paste the key from Stage A.1
   - **Token TTL:** 1 hour (default)
4. Click **Save**.
5. **DO NOT** click "Enforce" on any service yet — Storage / Firestore / Functions / RTDB toggles MUST stay in **"Unenforced"** state for the 7-day soak.

### A.3 Generate a debug token for the operator's local dev environment

1. App Check Console -> **Apps** -> ⋮ -> **Manage debug tokens** -> **Add debug token**.
2. Name: `local-vite-dev-${operator-handle}` (e.g., `local-vite-dev-hugh`).
3. Copy the token UUID (one-time display).
4. Paste into `.env.local`:

   ```
   VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=<full-site-key-from-A.1>
   VITE_APPCHECK_DEBUG_TOKEN=<debug-token-uuid-from-A.3>
   ```

5. Verify gitignored: `git check-ignore .env.local` returns `.env.local` (exit 0). The `.env.*` rule in `.gitignore:9` covers this.
6. Verify never committed: `git log --all -p -- .env.local` returns no output.

### A.4 Capture evidence

Update `runbooks/phase-7-app-check-enforcement.md` Stage A evidence section:

- `site_key_prefix: 6L<first-6-chars>` (e.g., `6LcAbCdEf`)
- `debug_token_prefix: <first-8-chars-of-uuid>` plus `last_4_chars: <last-4>`
- `registered_at: <ISO timestamp>`
- `registered_by: business@bedeveloped.com` (or operator GitHub handle)
- `registered_provider: reCAPTCHA Enterprise`
- `enforcement_state: unenforced (Storage, Firestore, Cloud Functions, RTDB all OFF)`
- Screenshot path: `runbooks/evidence/phase-7-stage-a-enrolment.png` (App Check page showing reCAPTCHA Enterprise as registered provider AND all enforcement toggles OFF)

---

## Stage B — Quota alert (Wave 3 Task 1; OPERATOR EXECUTION REQUIRED)

> Substrate-honest deferral — same rationale as Stage A. The runbook is the
> substrate; the GCP Console alert config is operator-execution.

### B.1 Configure the assessments quota alert

1. Visit <https://console.cloud.google.com/apis/api/recaptchaenterprise.googleapis.com/quotas?project=bedeveloped-base-layers>.
2. Locate the quota: **Assessments per minute** or **Assessments per day** (the per-day quota is the cumulative monthly free-tier — 10k/month).
3. Click the bell icon next to the quota -> **Create alert**.
4. Threshold: **70% of quota**.
5. Notification channel: email -> `business@bedeveloped.com`.
6. Save.

### B.2 Synthetic alert test (optional but recommended)

Per Pattern 3 Stage B "Synthetic alert test fires":

1. Temporarily lower the alert threshold to **1%** (or whatever the current
   usage is just above) to force a fire.
2. Wait for the email.
3. Restore the threshold to 70%.
4. Document the synthetic-test fire timestamp in
   `runbooks/phase-7-app-check-enforcement.md` Stage B evidence.

If your free-tier usage is so low that 1% is still 0 assessments, log
`synthetic_alert_test_result: deferred` and rely on the alert's own self-test
mechanism.

### B.3 Capture evidence

Update `runbooks/phase-7-app-check-enforcement.md` Stage B evidence section:

- `alert_threshold: 70% of 10k assessments/month`
- `alert_recipient: business@bedeveloped.com`
- `alert_configured_at: <ISO>`
- `synthetic_alert_test_result: pass|deferred`

---

## Stage C — 7-day unenforced soak (Wave 3 Task 2 + 4; OPERATOR EXECUTION REQUIRED)

### C.1 Production deploy with App Check enrolled but enforcement OFF

After Wave 3 Task 2 commits land on `main` and the CI deploy job goes green:

```sh
# CI auto-deploy on main is the load-bearing path — manual deploy only if CI is broken.
gh run list --workflow=ci.yml --branch=main --status=success --limit=1
```

The deploy ships the body-filled `src/firebase/check.js` to production. App
Check tokens are now attached to every Firebase SDK call from
`baselayers.bedeveloped.com`. Enforcement remains OFF for all services per
Stage A.4 above — the dashboard counts verified vs unverified WITHOUT
denying any traffic.

### C.2 Day-1 verification (24h after deploy)

1. Visit <https://console.firebase.google.com/project/bedeveloped-base-layers/appcheck>.
2. Confirm:
   - Storage / Firestore / Cloud Functions / RTDB all show **Unenforced** (toggles OFF)
   - The "Requests" dashboard shows non-zero `verified` count within the last 24h
   - The `verified vs unverified` ratio is ≥95% (Stage C target)
3. If <95% verified:
   - Most common cause: missing debug tokens for CI / staging / scratch
     projects (Pitfall 1 in 07-RESEARCH.md). Check the unverified entries'
     User-Agent + IP — if they correlate with CI runners or admin sessions,
     register debug tokens for those clients.
   - DO NOT proceed to Stage D until verified ≥95%.
4. Capture screenshot to `runbooks/evidence/phase-7-soak-day-1.png`.
5. Update `runbooks/phase-7-app-check-enforcement.md` Stage C evidence:
   - `soak_start_at: <ISO timestamp of production deploy>`
   - `day_1: <ratio> | runbooks/evidence/phase-7-soak-day-1.png`

### C.3 Daily soak verification (Days 2-7)

Repeat C.2 each day for 7 consecutive days. Update the daily ratio log in
`runbooks/phase-7-app-check-enforcement.md` Stage C section:

```
day_1: <ratio>
day_2: <ratio>
day_3: <ratio>
day_4: <ratio>
day_5: <ratio>
day_6: <ratio>
day_7: <ratio>
```

### C.4 Day-7 gate

After 7 consecutive days of verified ratio ≥95%:

- Update `runbooks/phase-7-app-check-enforcement.md`:
  - `day_7_verified_ratio: <ratio>`
  - `soak_passed: YES`
- Stage D may proceed.

If the gate fails (any day <95%):

- `soak_passed: NO`
- Investigate per Pitfall 1; address root cause (most commonly missing debug
  tokens for CI / scratch); reset the 7-day window from the day all clients
  show ≥95%.
- Stage D does NOT proceed until soak_passed: YES.

---

## Stage D — Enforce on Storage (DEFERRED to 07-HUMAN-UAT.md)

> **Operator-paced.** Storage is the lowest-blast-radius service (uploads
> only — diagnostic file uploads in this app's case). Enforcement here is
> the smoke test for whether the soak's verified-ratio actually translates
> to real-world enforcement-passes.

### D.1 Pre-flight

- [ ] Stage C `soak_passed: YES`
- [ ] At least one production-channel deploy has landed AFTER Stage C closure

### D.2 Flip enforcement

1. Visit <https://console.firebase.google.com/project/bedeveloped-base-layers/appcheck>.
2. Locate **Cloud Storage for Firebase**.
3. Click **Enforce**.
4. Capture screenshot: `runbooks/evidence/phase-7-stage-d-storage-enforced.png`.
5. Note ISO timestamp.

### D.3 Smoke verification

Within ≤5 minutes of flipping enforcement:

1. Open <https://baselayers.bedeveloped.com> in a fresh incognito window.
2. Sign in via the production auth path.
3. Upload a test file (any small image to a diagnostic).
4. Verify upload succeeds (network tab: `firebasestorage.googleapis.com` 200 status).
5. Open DevTools -> Application -> Storage -> Cookies. Delete the App Check
   debug-token entry (or use a different browser entirely).
6. Try the upload again. EXPECTED: 401 / 403 from
   `firebasestorage.googleapis.com`.

### D.4 Rollback path

Per-service Console "Unenforce" toggle takes effect within 10-15 min:

1. App Check Console -> **Cloud Storage for Firebase** -> **Unenforce**.
2. Verify on-page label changes from "Enforced" to "Unenforced".

### D.5 Evidence

Update `runbooks/phase-7-app-check-enforcement.md` Stage D evidence:

- `storage_enforcement_at: <ISO>`
- `storage_enforcement_verified_at: <ISO>` (the smoke verification timestamp)
- `storage_enforcement_screenshot: runbooks/evidence/phase-7-stage-d-storage-enforced.png`

---

## Stage E — Enforce on Firestore, collection-by-collection (DEFERRED to 07-HUMAN-UAT.md)

> **Highest-blast-radius service.** Firestore enforcement is per-collection
> (NOT per-document or per-field). Order matters — front-load the lowest-
> usage collections so any false positives are caught before the high-usage
> ones flip.

### E.1 Per-collection ordering (verbatim from 07-RESEARCH.md Pattern 3)

1. `auditLog` — server-only-write; rare client reads
2. `internalAllowlist` — admin-only access path
3. `softDeleted` — recovery-only access path
4. `messages` — high-volume client write path
5. `comments` — high-volume client write path
6. `documents` — diagnostic-doc write path
7. `responses` — diagnostic-response write path
8. `actions` — admin-action audit path

### E.2 Per-collection flip protocol

For EACH collection in the order above:

1. App Check Console -> **Cloud Firestore** -> per-collection enforcement
   panel -> select collection -> **Enforce**.
   *(NOTE: Firestore App Check Console UI may not have per-collection
   granularity at execution time — Firestore App Check enforcement is
   service-wide in current Firebase Console. If still service-wide at
   execution time, treat the collection ordering as a CLIENT-SIDE smoke
   order: flip the service-wide toggle ONCE, then immediately exercise
   each collection in the order above. Record per-collection smoke-pass
   timestamps as the per-collection enforcement timestamps.)*
2. Capture screenshot.
3. Smoke: exercise the collection's read + write path from a real client
   session. Confirm 200/success.
4. Smoke: drop App Check debug token; exercise the same path. Confirm
   `permission-denied` (Firestore) error.
5. Roll back if either smoke fails.
6. Wait ≥1 hour before the next collection (gives dashboard time to surface
   any latent unverified ratio bumps).
7. Update `runbooks/phase-7-app-check-enforcement.md` Stage E table with
   per-collection flip timestamp + screenshot path.

### E.3 Rollback path (per collection)

Per-collection rollback is independent — flipping `messages` enforcement OFF
does NOT affect `auditLog` enforcement. Use the same Console toggle in
reverse.

If service-wide (no per-collection granularity), the rollback affects all
8 collections at once — investigate WHICH collection's rules predicate is
denying legitimate traffic via Cloud Logging structured logs (`cspReportSink`
pattern from Phase 3 — same shape, different sink), then re-enforce after
fix.

---

## Stage F — Enforce on Cloud Functions (DEFERRED to 07-HUMAN-UAT.md)

> **Final stage.** Cloud Functions is the trusted-server boundary. Each
> callable already declares `enforceAppCheck: true` at the function level
> (07-PATTERNS.md Pattern A) — Stage F is the App-Check-Console-side
> ENFORCE toggle that backs that declaration.

### F.1 Pre-flight

- [ ] Stages A-E all `PASS`
- [ ] All 4 callables (`setClaims`, `auditWrite`, `softDelete`, `gdprExportUser`)
      have `enforceAppCheck: true` in their `onCall` options block (Phase 7
      Wave 1+ deliverables; verify with `grep -rn "enforceAppCheck" functions/src/`)

### F.2 Flip enforcement

1. App Check Console -> **Cloud Functions** -> **Enforce**.
2. Screenshot.
3. ISO timestamp.

### F.3 Smoke verification

1. From a real client session (App Check token attached): exercise each
   callable. Confirm HTTP 200.
2. From a session with App Check debug token cleared: exercise each
   callable. Confirm `unauthenticated` HttpsError.

### F.4 Rollback

Per-service toggle — same shape as Stage D.

### F.5 Evidence

Update `runbooks/phase-7-app-check-enforcement.md` Stage F evidence:

- `functions_enforcement_at: <ISO>`
- `functions_enforcement_verified_at: <ISO>`
- `functions_enforcement_screenshot: <path>`

---

## Pitfall 8 reminder — debug-token cadence

Per `.planning/research/PITFALLS.md` Pitfall 8 + 07-RESEARCH.md Pitfall 1:

| Environment | Debug token registration |
|-------------|--------------------------|
| Operator local dev | Register one debug token per developer; place in `.env.local` (gitignored). |
| CI runners | Register one debug token per CI runner identity; inject via repo secret `VITE_APPCHECK_DEBUG_TOKEN`. |
| Staging Firebase project | Register a separate site key + debug tokens for staging (DO NOT reuse production keys per 07-RESEARCH.md Pattern 2 per-env discipline). |
| Scratch / preview channels | If using Firebase Hosting preview channels: same prod site key (domain-bound to `web.app`) — but scratch debug tokens registered per dev session. |

Failure to register debug tokens for any of the above produces unverified-
ratio drag during the Stage C soak — the canonical Pitfall 1 cause.

---

## Citations

- Firebase docs — App Check overview: <https://firebase.google.com/docs/app-check>
- Firebase docs — Enable App Check enforcement: <https://firebase.google.com/docs/app-check/enable-enforcement>
- Firebase docs — App Check debug provider: <https://firebase.google.com/docs/app-check/web/debug-provider>
- 07-RESEARCH.md Pattern 3 — Staged Rollout (FN-08)
- 07-RESEARCH.md Pitfall 1 — debug-token gaps in CI / staging / scratch projects
- 07-PATTERNS.md Pattern E — App Check init in `src/firebase/check.js`
- `.planning/research/PITFALLS.md` Pitfall 8 — App Check enforcement-too-fast lockout
- ARCHITECTURE.md §2 — `src/firebase/*` adapter layer
- STACK.md line 48 — App Check + reCAPTCHA Enterprise locked-in choice
- SOC2 CC6.6 — service-level access control evidence (App Check enforcement is the SOC2 evidence row)
- OWASP A05:2025 — Security Misconfiguration (silent App Check bypass mitigated)
