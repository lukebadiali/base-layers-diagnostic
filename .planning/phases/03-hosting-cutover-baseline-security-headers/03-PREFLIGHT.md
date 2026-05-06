# Phase 3 — Wave 1 Pre-Flight Verifications

**Plan:** 03-01
**Created:** 2026-05-06
**Status:** PARTIAL — gcloud + firebase-tools auth tokens expired in this environment; gcloud-dependent items deferred to PENDING-USER. All offline pre-flights complete.

This file is the canonical record of Wave 1 verifications consumed by Plans 03-02..03-05.
Each section uses the schema defined in 03-01-PLAN.md `<interfaces>`. Items marked
`PENDING-USER` cannot be resolved by Claude alone and require either an authenticated
gcloud/firebase-tools session or human inspection of a console UI.

---

## Firestore Region

- **value:** `PENDING-USER` — gcloud auth token refresh failed (re-auth required)
- **source:** `gcloud firestore databases describe --database='(default)' --project=bedeveloped-base-layers --format=json`
- **divergence_from_D06:** `unknown` (cannot evaluate without resolved value)
- **status:** PENDING-USER

### Verification command (operator runs)

```sh
gcloud auth login
gcloud firestore databases describe --database='(default)' --project=bedeveloped-base-layers --format=json
```

Expected output is JSON containing a `locationId` field (e.g. `"locationId": "europe-west2"` or `"nam5"` / `"eur3"`).

### Decision rules (apply after value is known)

- If `locationId == "europe-west2"` → write `divergence_from_D06: no` and proceed. No CONTEXT.md addendum needed.
- If `locationId != "europe-west2"` (e.g. `nam5`, `eur3`, `us-central`) → write `divergence_from_D06: yes`, append a one-paragraph note to `03-CONTEXT.md` under `## Pre-Flight Addendum (Wave 1)` stating Phase 3 still pins the Cloud Function to `europe-west2` per D-06 (cross-region accepted for this single low-volume function), AND flag for Phase 6 / Phase 11 to re-open the residency conversation. **Do NOT mutate D-06 — locked.**

### Environment note

The gcloud CLI is installed and authenticated as `hugh@assume-ai.com`, but the access token requires a refresh that cannot be performed non-interactively. `gcloud auth login` must run in a foreground terminal session before any of the Firestore / IAM / Workload-Identity-Pool checks below can return data.

---

## Firebase Project

- **project_id:** `bedeveloped-base-layers` (verified via `firebase-init.js` line 40 and `.planning/codebase/INTEGRATIONS.md` — INTEGRATIONS.md confirmation)
- **default_hosting_site:** `PENDING-USER` (firebase-tools auth required)
- **default_url:** `PENDING-USER` — assumed `https://bedeveloped-base-layers.web.app` per CONTEXT.md D-01; awaits CLI confirmation
- **auth_domain:** `bedeveloped-base-layers.firebaseapp.com` (verified via `firebase-init.js` line 39 — config object literal in source)
- **firebase_hosting_console_enabled:** `PENDING-USER` — operator must confirm in Console UI (Task 2 checkpoint)
- **status:** PARTIAL — project_id + auth_domain RESOLVED from in-source config; default_url + site name PENDING-USER

### Verification commands (operator runs)

```sh
npx firebase-tools@15.16.0 login           # only if not already authenticated
npx firebase-tools@15.16.0 projects:list --json
npx firebase-tools@15.16.0 hosting:sites:list --project bedeveloped-base-layers --json
```

### Resolved evidence

- `firebase-init.js` lines 37-44 (in-tree, version-controlled):
  - `apiKey: "AIzaSyDV3RNRFxAoVkSHOMyfl6HqgGTwaenLYfY"`
  - `authDomain: "bedeveloped-base-layers.firebaseapp.com"`
  - `projectId: "bedeveloped-base-layers"`
  - `storageBucket: "bedeveloped-base-layers.firebasestorage.app"`
  - `messagingSenderId: "76749944951"`
  - `appId: "1:76749944951:web:9d0db9603ecaa7cc5fee72"`
- `.planning/codebase/INTEGRATIONS.md` lines 9-15 confirm same values.

### D-09 implication (frame-src directive)

D-09's CSP `frame-src` directive uses the auth domain. Resolved value `bedeveloped-base-layers.firebaseapp.com` matches CONTEXT.md D-09 verbatim. **No blocker for 03-02-PLAN.md.** If Wave 2 wants to confirm via CLI before deploy, it can re-run `firebase apps:sdkconfig WEB --project bedeveloped-base-layers` after re-auth — but the in-source value is sufficient evidence for the Phase 3 firebase.json header build.

---

## Registrar

- **registrar:** Likely **Namecheap parking** (best-effort guess from NS records — confirm in Task 2 checkpoint)
- **ns_records:**
  - `ns1.dns-parking.com`
  - `ns2.dns-parking.com`
- **dns_admin_confirmed:** `PENDING-USER` (Task 2 checkpoint)
- **status:** PARTIAL — NS records RESOLVED; registrar identity + admin access PENDING-USER

### Source

```text
> nslookup -type=NS bedeveloped.com
Non-authoritative answer:
bedeveloped.com   nameserver = ns1.dns-parking.com
bedeveloped.com   nameserver = ns2.dns-parking.com
```

### Registrar inference

`*.dns-parking.com` nameservers are the default Namecheap "parked" nameservers used when a domain is registered through Namecheap but **DNS hosting has not been configured** (or is using Namecheap's BasicDNS/PremiumDNS in parked mode). This is a strong indicator the registrar is **Namecheap** but it could also be an unconfigured domain at any registrar that points NS to dns-parking.com.

### Implication for D-02 (same-session CNAME flip)

Because the domain currently appears to be parked (no custom NS, no A/AAAA, no CNAME records), the cutover plan in 03-05-PLAN.md will need to:
1. Configure DNS at the registrar (move off parking nameservers OR add A/AAAA/CNAME records via Namecheap's BasicDNS interface).
2. Add the Firebase-provided A/AAAA records (or CNAME) for `baselayers.bedeveloped.com`.
3. Wait for SSL provisioning (typically <60 min for Firebase Hosting custom domains).

**Do NOT proceed with same-session CNAME flip until** (a) registrar identity is confirmed, (b) Firebase custom domain is added in Console and provisioning records are visible, (c) operator has tested DNS edit access on a benign record first (e.g. add and remove a TXT record).

### Verification commands (operator runs)

The operator must confirm in the registrar UI:
1. Log in to the registrar (best guess: https://www.namecheap.com — Domain List → bedeveloped.com → Manage).
2. Confirm domain is owned by BeDeveloped's account.
3. Confirm NS records (Manage → Nameservers section). If parked NS, switch to BasicDNS / Namecheap BasicDNS or whatever DNS provider Phase 3 will use to host A/AAAA.
4. Reply with registrar name + DNS-admin-confirmed yes/no in Task 2 resume.

---

## OIDC Pool

- **pool_name:** `github-actions` (per `runbooks/firebase-oidc-bootstrap.md` Step 1)
- **pool_state:** `PENDING-USER` — gcloud auth required to verify
- **provider:** `github-oidc` (per runbook Step 2 — note: runbook uses `github-oidc`, NOT `github-actions-provider` as 03-01-PLAN.md interfaces stub stated; reconciled here)
- **workload_identity_provider_secret:** `projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github-actions/providers/github-oidc` (per runbook Step 6 — exact PROJECT_NUMBER must be derived from `gcloud projects describe bedeveloped-base-layers --format='value(projectNumber)'` post-auth)
- **service_account:** `github-actions-deploy@bedeveloped-base-layers.iam.gserviceaccount.com` (per runbook Step 3 — NOTE: runbook uses `github-actions-deploy`, NOT `github-deployer` as 03-01-PLAN.md interfaces stub stated; reconciled here)
- **github_secrets_present:** `PENDING-USER` (Task 2 checkpoint — operator visits https://github.com/lukebadiali/base-layers-diagnostic/settings/secrets/actions)
- **status:** PENDING-USER (cannot determine ACTIVE vs MISSING without authenticated gcloud)

### Verification commands (operator runs)

```sh
gcloud auth login
gcloud iam workload-identity-pools list --location=global --project=bedeveloped-base-layers --format=json
gcloud iam workload-identity-pools providers list --workload-identity-pool=github-actions --location=global --project=bedeveloped-base-layers --format=json
```

### Decision rules

- If pool list returns an entry with `name` ending in `/workloadIdentityPools/github-actions` and `state: ACTIVE` → record `pool_state: ACTIVE`.
- If pool list returns `[]` or the pool is not found → record `pool_state: MISSING` AND **append the line `BLOCKER for 03-04-PLAN.md (Wave 3 CI deploy)` to this section** so the orchestrator halts before reaching Wave 3. Operator must execute `runbooks/firebase-oidc-bootstrap.md` end-to-end before Wave 3.

### Naming reconciliation note (correction to 03-01-PLAN.md interfaces stub)

The interfaces stub in 03-01-PLAN.md `<interfaces>` block named the provider `github-actions-provider` and the SA `github-deployer@…`. The actual canonical names (per `runbooks/firebase-oidc-bootstrap.md`, the Phase 1 D-23 deliverable) are `github-oidc` and `github-actions-deploy@…` respectively. The runbook is the source of truth — 03-01-PLAN.md interfaces stub is descriptive prose only, not normative. **03-04-PLAN.md should use the runbook names verbatim.**

---

## OIDC SA Roles

- **granted_roles:** `PENDING-USER` (gcloud auth required)
- **expected_baseline_per_03-01-PLAN:** `roles/firebasehosting.admin`, `roles/cloudfunctions.developer`, `roles/iam.serviceAccountUser`
- **runbook_actually_grants:** `roles/firebase.admin` (per `runbooks/firebase-oidc-bootstrap.md` Step 4 — single broad role, not the three narrow ones)
- **excess_roles_present:** `yes` (anticipated based on runbook content; final value awaits gcloud verification)
- **mitigation_for_T-3-5:** **The over-grant of `roles/firebase.admin` is accepted for Phase 3.** Phase 3 ships a single deploy SA used only by the GitHub Actions deploy job; no per-function isolation is required until Phase 7 (FN-04 lands per-function minimal-IAM service accounts). The disposition is documented in 03-01-PLAN.md `<threat_model>` T-3-5 row. Phase 7 narrows the role grants — log the cleanup expectation in `runbooks/phase-4-cleanup-ledger.md` (or wherever the Phase 7 work tracker lives).
- **status:** PENDING-USER for live policy verification; disposition pre-approved per T-3-5.

### Verification command (operator runs)

```sh
gcloud auth login
gcloud projects get-iam-policy bedeveloped-base-layers --format=json \
  | python -c "import json,sys; p=json.load(sys.stdin); sa='github-actions-deploy@bedeveloped-base-layers.iam.gserviceaccount.com'; print('\n'.join(b['role'] for b in p.get('bindings',[]) if sa in b.get('members',[])))"
```

(or equivalent jq pipeline if jq is available — the python one-liner avoids a jq dependency)

### Documented disposition (T-3-5)

Even if the verification confirms `roles/firebase.admin` only (and no narrower roles), the role grant is **accepted as-is for Phase 3** because:
1. The deploy SA is the **only** identity that uses these roles, and its access is gated by the GitHub OIDC trust binding (only `lukebadiali/base-layers-diagnostic` repo can mint a token).
2. No human user holds these credentials directly — there is no long-lived JSON key in GitHub Secrets (per `runbooks/firebase-oidc-bootstrap.md` "Notes" section).
3. Phase 7 (FN-04) will narrow this to per-function service accounts as part of the Cloud Functions hardening work; the broad grant is a known carry-over, not a new defect.

This is the documented mitigation referenced in 03-01-PLAN.md `<threat_model>` row T-3-5.

---

## index.html meta-CSP scan

- **meta_csp_present:** `no` — RESOLVED
- **source:** `grep -nE 'http-equiv' index.html` → returned `NONE` (no `<meta http-equiv="Content-Security-Policy">` tag exists in the source `index.html`)
- **scan_command_output:** `NONE`
- **scan_date:** 2026-05-06
- **status:** RESOLVED — no blocker for 03-02-PLAN.md

### T-3-7 disposition

T-3-7 (Tampering — conflicting CSP source via meta tag + header co-existence) is **mitigated by absence**: no meta CSP tag exists in `index.html`, so the firebase.json `Content-Security-Policy-Report-Only` header in 03-02-PLAN.md will be the canonical and only CSP source. **No removal commit required.** If a future commit re-introduces a `<meta http-equiv="Content-Security-Policy">` tag, ESLint or a pre-commit grep should catch it (consider adding to `.husky/pre-commit` in Phase 10 when CSP enforcement lands).

---

## dist/index.html font-CDN scan

- **google_fonts_googleapis_present:** `yes` — line 8 (`<link rel="preconnect">`) and line 11 (`<link rel="stylesheet">`)
- **google_fonts_gstatic_present:** `yes` — line 9 (`<link rel="preconnect" crossorigin>`)
- **chartjs_cdn_present:** `yes` — line 14 (`<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js" defer>`)
- **status:** RESOLVED — divergence from RESEARCH.md "Codebase Findings" recorded below

### Scan command output

```text
> npm run build
✓ built in 220ms
> grep -nE 'fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr\.net' dist/index.html
8:    <link rel="preconnect" href="https://fonts.googleapis.com" />
9:    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
11:      href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600;700&display=swap"
14:    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js" defer></script>
```

### Significant divergence from RESEARCH.md

`03-RESEARCH.md` Summary §lines 79-82 stated: *"the in-source CDN loads exist in the un-built file and are replaced in the Vite-built `dist/` by self-hosted packages. The CSP therefore does NOT need CDN origins in `style-src` / `script-src` / `font-src` for the Firebase Hosting deployment."*

This claim is **FALSE for the current build artefact**. The Vite build (Vite 8.0.10) preserves the `<link>` and `<script>` tags pointing at `fonts.googleapis.com`, `fonts.gstatic.com`, and `cdn.jsdelivr.net` verbatim in `dist/index.html`. Reasons:

1. `app.js` line 1752 / 2904 reads `if (!window.Chart)` — Chart.js is consumed via the global `window.Chart` (UMD CDN load), not as an ES module import. Vite has nothing to bundle, so it leaves the `<script>` tag alone.
2. The Google Fonts `<link>` is a stylesheet reference, not a CSS `@import`. Vite does not rewrite raw `<link rel="stylesheet">` tags pointing at remote origins.
3. Chart.js is npm-installed at 4.5.1 (`node_modules/chart.js/package.json`) and `vite.config.js` `manualChunks` reserves a `chart` chunk name for it — but **no source file currently imports it** (only `tests/setup.js` mocks it). The CDN-to-npm migration is documented in source as a Phase 4 task (`firebase-init.js` line 2 comment: `// Phase 4: remove after CDN import replacement.`).

### Required CSP directive overrides for 03-02-PLAN.md

The CONTEXT.md D-07 baseline directives MUST be amended for the Phase 3 deploy. **Do NOT modify `firebase.json` here — that is 03-02-PLAN.md's job. This row records the required additions:**

| Directive | CONTEXT.md D-07 baseline | Phase-3-required addition |
|-----------|--------------------------|---------------------------|
| `script-src` | `'self'` | **Add `https://cdn.jsdelivr.net`** (Chart.js UMD CDN) |
| `style-src` | `'self' 'unsafe-inline'` | **Add `https://fonts.googleapis.com`** (Google Fonts CSS) |
| `font-src` | `'self' data:` | **Add `https://fonts.gstatic.com`** (Google Fonts woff2 binaries) |

These three additions are **temporary** — Phase 4 (CDN→npm migration per `runbooks/phase-4-cleanup-ledger.md`) will remove them. Phase 10 (CSP tightening per HOST-07) verifies they are dropped.

### Open question for the planner of 03-02-PLAN.md

D-07 was authored under the assumption that dist/ would be self-hosted. Three options for 03-02-PLAN.md:
1. **Add the three directives temporarily** (recommended — atomic deploy, Phase 4 removes them later).
2. **Block Phase 3 on Phase 4** (would invert sequencing — explicitly forbidden by sequencing constraint #4).
3. **Accept Report-Only-only stance and let the violations log to csp-violations** (philosophically valid but pollutes the soak signal — the sink would log every page-load Google-Fonts violation as a high-volume false positive).

Option 1 is the pragmatic answer. Document the temporary additions in SECURITY.md per D-15 with a clear "Phase 4 will remove" annotation, and add a cleanup-ledger entry.

---

## SDK 12.x connect-src verification

- **firebase_npm_version:** `12.12.1` (verified at `node_modules/firebase/package.json`)
- **scan_command:** ``find node_modules/@firebase -name "*.js" -not -name "*.map" -type f | xargs grep -hoE "(firestore|identitytoolkit|securetoken|firebaseinstallations|firebasestorage|firebase|content-firebaseappcheck|fcmregistrations|firebaseremoteconfig|firebaselogging|iid|cloudfunctions)\.(googleapis\|google\|firebase)\.com" | sort -u``
- **status:** RESOLVED

### Verified origins (sorted alphabetically)

The following origins appear hard-coded as service endpoints in the installed Firebase JS SDK 12.12.1 source:

```
content-firebaseappcheck.googleapis.com
fcmregistrations.googleapis.com
firebase.google.com
firebase.googleapis.com
firebaseinstallations.googleapis.com
firebaselogging.googleapis.com
firebaseremoteconfig.googleapis.com
firebaseremoteconfigrealtime.googleapis.com
firebasestorage.googleapis.com
firestore.googleapis.com
identitytoolkit.googleapis.com
securetoken.google.com
securetoken.googleapis.com
```

Additional referenced (non-API) origins:
```
apis.google.com               (auth UI helper)
console.firebase.google.com   (link target only — not an API)
firebaseio.com                (Realtime Database — present in SDK source for cross-import compatibility, not used by this app)
firebaseapp.com               (Auth popup origin — D-09)
www.google.com                (reCAPTCHA Enterprise — used by App Check, not yet enabled)
www.googleapis.com            (token endpoints / OAuth)
```

### Diff against CONTEXT.md D-07 connect-src list

D-07 connect-src (current):
```
'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com
https://firebasestorage.googleapis.com https://firebaseinstallations.googleapis.com
https://identitytoolkit.googleapis.com https://securetoken.googleapis.com
```

| SDK origin | In D-07? | Action |
|------------|---------|--------|
| `content-firebaseappcheck.googleapis.com` | yes (covered by `*.googleapis.com`) | none — wildcard covers it |
| `fcmregistrations.googleapis.com` | yes (wildcard) | none |
| `firebase.googleapis.com` | yes (wildcard) | none |
| `firebaseinstallations.googleapis.com` | **explicit** in D-07 | none |
| `firebaselogging.googleapis.com` | yes (wildcard) | none |
| `firebaseremoteconfig.googleapis.com` | yes (wildcard) | none — but Remote Config not used yet |
| `firebaseremoteconfigrealtime.googleapis.com` | yes (wildcard) | none |
| `firebasestorage.googleapis.com` | **explicit** in D-07 | none |
| `firestore.googleapis.com` | yes (wildcard) | none — primary Firestore endpoint |
| `identitytoolkit.googleapis.com` | **explicit** in D-07 | none |
| `securetoken.googleapis.com` | **explicit** in D-07 | none |
| `securetoken.google.com` | **NOT covered** (`.google.com` is not `.googleapis.com`) | **ADD** to connect-src |
| `*.firebaseio.com` | explicit in D-07 | none — keep for Realtime Database compat even though we don't use RTDB (per RESEARCH.md "removals_safe but D-07 keeps for safety") |
| `apis.google.com` | not covered | **ADD** if Auth popup helpers fetch — note: this is typically loaded as a `<script>` not via `fetch`, so it would belong in `script-src`, not `connect-src`. Defer to 03-02-PLAN.md decision. |
| `www.google.com` | not covered | **ADD** when App Check enables (Phase 7); not needed Phase 3 |
| `www.googleapis.com` | yes (wildcard) | none |

- **additions_required:** `https://securetoken.google.com` (and conditionally `https://apis.google.com` — see note below)
- **removals_safe:** none (per RESEARCH.md guidance, `*.firebaseio.com` and `wss://*.firebaseio.com` are kept even though Firestore doesn't use them — defensive against any cross-import edge cases in v12.x)

### Note on `apis.google.com`

`apis.google.com` is hosted at the Google domain, NOT `googleapis.com`, so the D-07 wildcard `https://*.googleapis.com` does NOT cover it. The Firebase Auth popup flow (D-09) loads helper JavaScript from `apis.google.com` for OAuth/email-link redirect handling. **However** — this loads as a `<script>` element, so the relevant CSP directive is `script-src`, not `connect-src`. The current Phase 3 CSP `script-src 'self'` would block it. **This is a real gap that will surface during the Phase 6 Auth cutover — not Phase 3.** D-09 mentions only `frame-src`, but the popup also needs `script-src https://apis.google.com` to load the helper. Phase 6 owns this; flag in `03-CONTEXT.md` Pre-Flight Addendum if convenient.

---

## Pre-Flight Summary Table

| Pre-flight item | Status | Blocker for | Resume condition |
|-----------------|--------|-------------|------------------|
| Firestore Region | PENDING-USER | None (D-06 already pins europe-west2 for the function regardless) — but Phase 11 PRIVACY.md needs the answer | User runs `gcloud auth login` then re-runs `gcloud firestore databases describe`; pastes locationId here |
| Firebase Project (project_id) | RESOLVED | — | — |
| Firebase Project (default_url, site name) | PENDING-USER | None — assumed value is fine; CLI confirmation cosmetic | User runs `npx firebase-tools login` then `firebase hosting:sites:list --project bedeveloped-base-layers --json` |
| Firebase Project (auth_domain) | RESOLVED | — | — |
| Firebase Hosting Console enabled | PENDING-USER | **03-05-PLAN.md (Wave 4 cutover)** — `firebase deploy --only hosting` fails if Hosting not initialised in Console | Task 2 checkpoint — operator visits Firebase Console, confirms |
| Registrar (NS records) | RESOLVED | — | — |
| Registrar (identity + DNS admin) | PENDING-USER | **03-05-PLAN.md (cutover day)** — same-session CNAME flip needs DNS-admin login confirmed | Task 2 checkpoint — operator confirms registrar name + admin access |
| OIDC Pool (state) | PENDING-USER | **03-04-PLAN.md (Wave 3 CI deploy)** if MISSING | User runs `gcloud iam workload-identity-pools list ...` and pastes JSON; if MISSING, runs the bootstrap runbook end-to-end first |
| OIDC Pool (provider, SA names) | RESOLVED (from runbook source-of-truth) | — | — |
| OIDC SA Roles | PENDING-USER (verification); disposition pre-approved | — (T-3-5 accepts the over-grant for Phase 3) | User runs `gcloud projects get-iam-policy ... --format=json` and pastes binding for github-actions-deploy SA |
| GitHub OIDC repo secrets | PENDING-USER | **03-04-PLAN.md (Wave 3 CI deploy)** if missing | Task 2 checkpoint — operator visits GitHub repo settings → secrets, confirms `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_SERVICE_ACCOUNT` exist |
| index.html meta-CSP scan | RESOLVED (`no`) | — | — |
| dist/index.html font-CDN scan | RESOLVED (Google Fonts + jsDelivr present) | **Modifies 03-02-PLAN.md CSP directives** — adds `https://cdn.jsdelivr.net` to script-src, `https://fonts.googleapis.com` to style-src, `https://fonts.gstatic.com` to font-src | None — record now consumed by 03-02-PLAN.md |
| SDK 12.x connect-src verification | RESOLVED | — | — |

---

## Inputs handed to downstream plans

### To 03-02-PLAN.md (firebase.json + headers)

- `project_id`: `bedeveloped-base-layers` (`.firebaserc`)
- `default_url`: `https://bedeveloped-base-layers.web.app` (assumed; confirm in Wave 2 once auth refreshed)
- `auth_domain`: `bedeveloped-base-layers.firebaseapp.com` (drives D-09 `frame-src`)
- **CSP directive overrides (Phase-3-only — Phase 4 removes):**
  - `script-src 'self' https://cdn.jsdelivr.net`
  - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
  - `font-src 'self' data: https://fonts.gstatic.com`
  - `connect-src` add: `https://securetoken.google.com` (uncovered by `*.googleapis.com` wildcard)
- **No `<meta http-equiv>` removal commit needed** (T-3-7 mitigated by absence)
- **Cleanup-ledger entry to add:** "Phase 3 CSP carries `cdn.jsdelivr.net` in script-src and `fonts.googleapis.com`/`fonts.gstatic.com` in style-src/font-src — remove when Phase 4 self-hosts Chart.js + Google Fonts."

### To 03-04-PLAN.md (CI deploy)

- `pool_name`: `github-actions`
- `provider_id`: `github-oidc` (NOT `github-actions-provider` — runbook is canonical)
- `service_account`: `github-actions-deploy@bedeveloped-base-layers.iam.gserviceaccount.com` (NOT `github-deployer` — runbook is canonical)
- `pool_state`: PENDING-USER → may BLOCK if MISSING
- `github_secret_names`: `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT` (Task 2 confirms presence)
- T-3-5 disposition: accept `roles/firebase.admin` over-grant for Phase 3; Phase 7 narrows.

### To 03-05-PLAN.md (cutover)

- `domain`: `baselayers.bedeveloped.com`
- `current_NS`: `ns1.dns-parking.com`, `ns2.dns-parking.com` — domain currently parked
- `registrar`: PENDING-USER — best guess Namecheap (Task 2 confirms)
- **Cutover blocker:** domain is parked (not actively serving DNS). Cutover sequence must include "first set up DNS hosting (BasicDNS / managed DNS / etc.) at the registrar BEFORE adding A/AAAA records for Firebase Hosting." This is a non-trivial pre-step that 03-05-PLAN.md must enumerate.
- D-02 same-session flip remains feasible IF DNS hosting can be configured during the smoke window (Namecheap BasicDNS edits propagate quickly — typically <5 min for record creation, but NS-server changes propagate at TTL).

### To 03-03-PLAN.md (csp-violations function)

- Region pin: `europe-west2` (D-06 — independent of Firestore region; cross-region accepted if divergence)
- Same-origin endpoint: `/api/csp-violations` (D-05 — no `connect-src` allowlist entry needed for the report endpoint itself)

---

## Self-verification

- File contains all eight required `## ` headings (verified by command in 03-01-PLAN.md `<verify automated>`).
- Each section contains at minimum the schema keys required by 03-01-PLAN.md `<acceptance_criteria>`:
  - `## Firestore Region` → has `value:`
  - `## Firebase Project` → has `project_id:`, `default_url:`, `auth_domain:`
  - `## OIDC Pool` → has `pool_state:`
  - `## OIDC SA Roles` → has `granted_roles:` (PENDING-USER) and `excess_roles_present: yes`
  - `## index.html meta-CSP scan` → has `meta_csp_present: no`
  - `## dist/index.html font-CDN scan` → has `google_fonts_googleapis_present: yes` and `google_fonts_gstatic_present: yes`
  - `## SDK 12.x connect-src verification` → has `verified_origins:` list and `additions_required:`/`removals_safe:` lines.

---

## Cutover Log

**Owned by:** Plan 03-05 — operator-deferred. The skeleton below is authored by 03-05 (Wave 4) so the operator has a single record-keeping target on cutover day. Each `PENDING-USER` value is filled in by the operator after executing `runbooks/hosting-cutover.md`.

**How to fill in:** see `runbooks/hosting-cutover.md` §Cutover Steps Step 9 (success path) or §DNS Revert Procedure Step R4 (rollback path).

```
cutover_date: PENDING-USER
  # Format: YYYY-MM-DD HH:MM TZ. Set to the moment GitHub Pages was disabled
  # in repo settings (Step 8 of the runbook), which is the moment the 14-day
  # rollback window opens per D-03.

cutover_complete: PENDING-USER
  # Values: yes | rolled-back
  # 'yes'  -> cutover steps 1-10 completed; live traffic now served by Firebase.
  # 'rolled-back' -> §DNS Revert Procedure was executed; live traffic returned
  #                  to GitHub Pages. Must also fill rollback_reason and
  #                  rollback_completed_at.

cutover_observed_headers: PENDING-USER
  # Verbatim output of `curl -sI https://baselayers.bedeveloped.com` from
  # Step 6. Multi-line YAML literal block. Should contain HTTP/2 200 plus
  # the 9 security headers (HSTS / X-Content-Type-Options / Referrer-Policy /
  # Permissions-Policy / COOP / COEP / CORP / Reporting-Endpoints /
  # Content-Security-Policy-Report-Only).

securityheaders_rating: PENDING-USER
  # Values: A+ | A | A- | B | C | D | E | F
  # From https://securityheaders.com/?q=baselayers.bedeveloped.com&followRedirects=on
  # at Step 7. Phase 3 success criterion HOST-08 requires >= A.

ssl_provisioned_at: PENDING-USER
  # Format: YYYY-MM-DD HH:MM TZ. Set to the moment Step 5's curl loop first
  # showed HTTP/2 200 (with no certificate warning). Useful for capacity
  # planning future cutovers; also feeds the Phase 11 PRIVACY.md narrative.

synthetic_csp_e2e_seen_in_cloud_logging: PENDING-USER
  # Values: yes | no
  # The post-cutover smoke from Step 6 produced (or did not produce) a Cloud
  # Logging entry with jsonPayload.report.blockedUri ==
  # "https://post-cutover.example/blocked.js". Required to be 'yes' for FN-10
  # success criterion closure.

post_cutover_smoke_blockedUri: PENDING-USER
  # Verbatim value used in the Step 6 smoke. Default per the runbook is
  # https://post-cutover.example/blocked.js. Operator may use any value as
  # long as it is unique enough to filter in Cloud Logging without collisions.

# --- Rollback-only fields (only fill in if cutover_complete: rolled-back) ---

rollback_reason: PENDING-USER
  # Freeform. Examples: "header X missing on live response", "function
  # rewrite returned index.html for /api/csp-violations", "SSL provisioning
  # exceeded 24h window", "registrar UI rejected A record format".

rollback_completed_at: PENDING-USER
  # Format: YYYY-MM-DD HH:MM TZ. Set to the moment §DNS Revert Procedure
  # Step R3 confirmed the bare GitHub Pages header set was live again.

# --- Optional ---

notes: PENDING-USER
  # Freeform. Anything that didn't fit the structured fields above. Useful
  # for "SSL took 90 minutes (faster than D-02's 24h worst case)" or
  # "registrar required NS switch from dns-parking.com to BasicDNS first
  # which added an hour".
```

### Reading guide for downstream plans

- **03-06-PLAN.md (cleanup ledger):** reads `cutover_date` to compute the day-14 calendar trigger. If `cutover_complete: rolled-back`, the cleanup ledger row is added with status "deferred — cutover not yet successful".
- **Phase 11 PRIVACY.md (DOC-09):** reads `ssl_provisioned_at` and `cutover_observed_headers` for the evidence pack.
- **Phase 11 SECURITY.md verification:** reads `securityheaders_rating` to confirm HOST-08 closure on the live domain.
- **/gsd-verify-work 3:** reads `cutover_complete` to gate Phase 3 verification. If `PENDING-USER` or `rolled-back`, Phase 3 verification cannot pass HOST-01 / HOST-02 / HOST-08.

---

*Pre-flight gathered: 2026-05-06 by Plan 03-01.*
*Cutover Log skeleton appended: 2026-05-06 by Plan 03-05 (Wave 4).*
