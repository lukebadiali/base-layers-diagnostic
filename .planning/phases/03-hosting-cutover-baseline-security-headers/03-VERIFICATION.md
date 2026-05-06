---
phase: 03-hosting-cutover-baseline-security-headers
verified: 2026-05-06T22:30:00Z
status: human_needed
score: 16/19 must-haves verified (3 PENDING-OPERATOR-EXECUTION)
overrides_applied: 0
human_verification:
  - test: "Wave 1 (03-01) Task 2 — operator response to 7-line PENDING-USER block"
    expected: "Operator pastes the seven gcloud/Console/registrar values into 03-PREFLIGHT.md (Firestore locationId, Firebase Hosting Console enabled, OIDC pool ACTIVE, OIDC SA roles, GitHub OIDC repo secrets present, registrar identity, approval) per 03-01-SUMMARY.md §Checkpoint Status Block A-D"
    why_human: "Requires interactive gcloud auth login + firebase-tools login + Firebase Console UI inspection + GitHub repo settings inspection + registrar UI login. None can run non-interactively."
  - test: "Wave 4 (03-05) Task 3 — production cutover (CNAME flip + GH-Pages disable + same-session smoke)"
    expected: "Operator executes runbooks/hosting-cutover.md §Cutover Steps 1-10; fills 03-PREFLIGHT.md ## Cutover Log fields cutover_date / cutover_complete / ssl_provisioned_at / cutover_observed_headers / securityheaders_rating (≥A) / synthetic_csp_e2e_seen_in_cloud_logging / post_cutover_smoke_blockedUri; verifies all 9 security headers on the live custom domain via curl -I; runs synthetic CSP report POST against the deployed function in BOTH wire formats and confirms Cloud Logging entries"
    why_human: "GitHub repo Settings → Pages UI mutation, Firebase Console custom-domain TXT/A handshake, registrar A/AAAA changes, securityheaders.com manual rating, end-to-end CSP report from a live browser — none have programmatic equivalents inside Claude's blast radius."
  - test: "Wave 6 (03-06) Task 3 — apply branch protection rule in GitHub UI"
    expected: "After first green deploy run on main and first green PR preview run register the names in GitHub's check registry (gh api .../check-runs --jq '.check_runs[].name' returns 'Deploy to Firebase Hosting' AND 'Deploy PR Preview Channel'), operator either runs the gh api PUT payload in runbooks/branch-protection-bootstrap.md §Command or applies via GitHub UI per §Apply via GitHub UI; backfills first-green-run dates in the runbook's PENDING-USER markers"
    why_human: "Requires repo-admin gh CLI session OR interactive GitHub Settings → Branches UI; Pitfall A precondition is that this can only run AFTER the cutover lands the first green deploy, which is itself an operator-deferred step."
---

# Phase 3: Hosting Cutover + Baseline Security Headers — Verification Report

**Phase Goal:** Production serves from Firebase Hosting with HTTP-header CSP infrastructure available, removing the GitHub-Pages "no headers possible" structural blocker before any CSP work begins.

**Verified:** 2026-05-06T22:30:00Z
**Status:** human_needed (all code/config/runbook/docs deliverables PASS; three operator-execution items remain — explicitly chosen "author runbook now, execute later" by the operator)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Roadmap Success Criteria (canonical contract)

| #   | ROADMAP Success Criterion                                                                                                                                                                                                                                                              | Status                              | Evidence                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `https://baselayers.bedeveloped.com` resolves to Firebase Hosting (DNS migrated, SSL auto-provisioned, GH-Pages disabled)                                                                                                                                                              | PENDING-OPERATOR-EXECUTION          | Cutover authoring complete (`runbooks/hosting-cutover.md` 431 lines, 10 steps); 03-PREFLIGHT.md `## Cutover Log` skeleton awaits operator values      |
| 2   | `curl -I https://baselayers.bedeveloped.com` returns HSTS, X-CTO, Referrer-Policy, Permissions-Policy, COOP, COEP, CSP-Report-Only headers                                                                                                                                            | VERIFIED (config); pending live URL | `firebase.json` declares all 9 headers with verbatim values; `tests/firebase-config.test.js` 17/17 pass; ci.yml `deploy` job asserts on live response |
| 3   | CSP violations from real users / staging arrive at `csp-violations` Cloud Function endpoint and are persisted (or filtered) without breaking the page                                                                                                                                  | VERIFIED (function); pending live   | `functions/src/csp/cspReportSink.ts` (onRequest, europe-west2) + 31 unit tests pass; firebase.json rewrite pinned; smoke procedure documented in runbook |
| 4   | Every push to `main` triggers a CI deploy to Firebase Hosting; opening a PR creates a per-PR preview channel URL                                                                                                                                                                       | VERIFIED                            | ci.yml `deploy` job (`if: github.ref == 'refs/heads/main'`, OIDC, concurrency-grouped) + `preview` job (`if: pull_request`, channel `pr-<number>`, 7d expiry) |
| 5   | `securityheaders.com` rating ≥ A (CSP "Report-Only" status acknowledged)                                                                                                                                                                                                               | PENDING-OPERATOR-EXECUTION          | Step 7 of `runbooks/hosting-cutover.md` directs operator to securityheaders.com; `securityheaders_rating: PENDING-USER` in Cutover Log skeleton      |

**Observation:** Three of five roadmap success criteria are fully VERIFIED at the code/config/test layer. SC-1 and SC-5 require the operator-executed cutover (consistent with operator's "author runbook now, execute later" choice). These are surfaced as `human_needed`, NOT `gaps_found`.

### Plan-frontmatter Truths Cross-Checked Against Codebase

#### Wave 1 (03-01) — Pre-flight verifications

| #   | Truth                                                                                                                                          | Status                       | Evidence                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 03-PREFLIGHT.md exists with all 8 canonical sections                                                                                          | VERIFIED                     | `## Firestore Region`, `## Firebase Project`, `## Registrar`, `## OIDC Pool`, `## OIDC SA Roles`, `## index.html meta-CSP scan`, `## dist/index.html font-CDN scan`, `## SDK 12.x connect-src verification` all present |
| 2   | index.html has no `<meta http-equiv=Content-Security-Policy>` tag (T-3-7 mitigation)                                                          | VERIFIED                     | `grep -c "http-equiv" index.html` returns 0                                                                                          |
| 3   | dist/index.html font-CDN status recorded — Vite does NOT self-host (RESEARCH was wrong); CDN allowlist passed forward to firebase.json         | VERIFIED                     | 03-PREFLIGHT.md `## dist/index.html font-CDN scan` records Google Fonts + Chart.js CDN URLs; 4 directive overrides applied to firebase.json |
| 4   | SDK 12.x connect-src verification — `securetoken.google.com` identified as gap not covered by `*.googleapis.com` wildcard                     | VERIFIED                     | 03-PREFLIGHT.md `## SDK 12.x connect-src verification → additions_required: https://securetoken.google.com`; firebase.json connect-src includes it |
| 5   | gcloud-dependent items (Firestore region, Firebase Console, OIDC pool/SA, registrar) recorded as PENDING-USER with operator resume procedures | PENDING-OPERATOR-EXECUTION   | 03-01-SUMMARY.md "Checkpoint Status — Task 2 (PENDING-USER)" enumerates 7 items + Block A-D resume signal procedure                    |

#### Wave 2 (03-02) — firebase.json + headers + CSP

| #   | Truth                                                                                                                              | Status   | Evidence                                                                                                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6   | firebase.json declares full HTTP security header set per D-13 (HSTS, X-CTO, Referrer-Policy, Permissions-Policy 22-directive, COOP same-origin, COEP credentialless, CORP same-origin) | VERIFIED | Direct read of `firebase.json`; values verbatim match plan interfaces. `tests/firebase-config.test.js` `it.each` over 9 keys passes 9/9                                                                                                          |
| 7   | firebase.json declares CSP-Report-Only with verbatim D-07 directive list + Reporting-Endpoints + dual report-uri/report-to per D-08 | VERIFIED | `firebase.json` `Content-Security-Policy-Report-Only` value contains `default-src 'self'`, `frame-ancestors 'none'`, `report-uri /api/csp-violations`, `report-to csp-endpoint`, `frame-src https://bedeveloped-base-layers.firebaseapp.com`. CDN widening applied (script-src cdn.jsdelivr.net, style-src fonts.googleapis.com, font-src fonts.gstatic.com, connect-src securetoken.google.com) |
| 8   | firebase.json declares /api/csp-violations rewrite to cspReportSink in europe-west2 BEFORE the SPA fallback ** rewrite (T-3-2)     | VERIFIED | `rewrites[0].source === "/api/csp-violations"` AND `function.functionId === "cspReportSink"` AND `function.region === "europe-west2"`; `rewrites[1].source === "**"` → `/index.html`; test asserts `fnIdx < spaIdx` (passes)                  |
| 9   | firebase.json declares cache-control overrides — index.html no-cache; hashed assets immutable                                      | VERIFIED | `headers[1]` source `index.html` → `Cache-Control: no-cache`; `headers[2]` source `**/*.@(js\|css\|png\|svg\|woff2\|ico)` → `public, max-age=31536000, immutable`                                                                              |
| 10  | .firebaserc declares default project bedeveloped-base-layers                                                                        | VERIFIED | `{"projects":{"default":"bedeveloped-base-layers"}}` exact                                                                                                                                                                                       |
| 11  | tests/firebase-config.test.js validates rewrite ordering AND header presence; exits 0 from npm test                                | VERIFIED | `npm test -- --run tests/firebase-config.test.js` → 17/17 passing (verified live)                                                                                                                                                                |
| 12  | Root tsconfig.json exclude contains `functions/**` (replaces `functions/lib`)                                                       | VERIFIED | tsconfig.json line 19: `"functions/**"`; line 25 also adds `tests/firebase-config.test.js` exclusion (deviation #1 from 03-02-SUMMARY.md, mirrors crypto-parity exclusion pattern). Root `npm run typecheck` exits 0                              |
| 13  | SECURITY.md has §HTTP Security Headers + §CSP (Report-Only) sections atomic with firebase.json commit                              | VERIFIED | SECURITY.md lines 235-289 contain both sections with full citations (OWASP ASVS V14.4, ISO/IEC 27001:2022 A.13.1.3 / A.13.1, SOC 2 CC6.6, GDPR Art. 32(1)(b))                                                                                  |

#### Wave 2 (03-03) — functions/ workspace + cspReportSink

| #   | Truth                                                                                                                       | Status                          | Evidence                                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 14  | functions/ workspace exists with TS + Node 22 + 2nd-gen stance per D-04                                                     | VERIFIED                        | `functions/package.json` engines.node="22", main="lib/index.js", firebase-admin@13.8.0, firebase-functions@7.2.5; `functions/tsconfig.json` standalone CommonJS; `functions/eslint.config.cjs` flat-config (CJS); `functions/vitest.config.ts` exists                |
| 15  | cspReportSink exported from functions/src/index.ts and pinned to region europe-west2                                        | VERIFIED                        | `functions/src/index.ts`: `export { cspReportSink } from "./csp/cspReportSink.js"`; cspReportSink.ts uses `onRequest({ region: "europe-west2" }, ...)`                                                                                                              |
| 16  | cspReportSink rejects non-CSP content-types with 400 and bodies > 64 KB with 413 (D-12 / T-3-3)                              | VERIFIED                        | cspReportSink.ts step 1 (content-type allowlist → 400) + step 2 (`MAX_BODY_BYTES = 64*1024` → 413). Filter pipeline correctly ordered                                                                                                                                |
| 17  | normalise() handles BOTH legacy application/csp-report AND modern application/reports+json wire formats; null on garbage    | VERIFIED                        | `functions/src/csp/normalise.ts` handles array (modern) + `csp-report` object (legacy with `effective-directive` then `violated-directive` fallback) + null for any unrecognised input. Unit tests: 10 cases passing                                              |
| 18  | shouldDrop() drops 5 extension schemes + 3 synthetic origins per D-11 (both blockedUri and sourceFile checked)              | VERIFIED                        | `functions/src/csp/filter.ts` EXTENSION_SCHEMES=[5] + SYNTHETIC_ORIGINS=[3]; both blocked + srcFile fields tested. Unit tests: 10 cases passing                                                                                                                    |
| 19  | isDuplicate()/markSeen() implement 5-min in-memory dedup keyed on `${origin}|${directive}` lowercased                       | VERIFIED                        | `functions/src/csp/dedup.ts` `DEDUP_WINDOW_MS = 5 * 60 * 1000`; URL.origin extraction strips path/query; `_clearForTest` exposed. Unit tests: 11 cases passing including 4m59s/5m+1ms boundary semantics                                                              |
| 20  | All structured logging uses logger.warn() from firebase-functions/logger (not console.warn); ESLint no-console enforces      | VERIFIED                        | `grep -c "console\.warn\|console\.log" functions/src/csp/*.ts` returns 0/0/0/0; `logger.warn("csp.violation", { report, fingerprint })` is the sole log call; eslint config (flat) enforces no-console=error                                                       |
| 21  | vitest unit tests cover normalise + filter + dedup with fake-timer awareness; exit 0                                        | VERIFIED                        | `cd functions && npm test` → 31/31 passing (3 test files: normalise.test.ts (10), filter.test.ts (10), dedup.test.ts (11))                                                                                                                                          |
| 22  | Root CI typecheck still passes (tsconfig exclude expansion correct)                                                          | VERIFIED                        | `npm run typecheck` exits 0 from repo root                                                                                                                                                                                                                          |
| 23  | functions/ workspace npm run typecheck + lint + build all exit 0                                                             | VERIFIED (after `npm ci`)       | After `cd functions && npm ci` (workspace had only .vite cache locally), all three exit 0; `lib/index.js` + `lib/csp/cspReportSink.js` emitted with `csp.violation`, `europe-west2`, `logger.warn` substrings                                                       |

#### Wave 3 (03-04) — CI deploy + preview jobs via OIDC

| #   | Truth                                                                                                                                          | Status   | Evidence                                                                                                                                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 24  | ci.yml gains a `deploy` job that runs on push to main after `build` succeeds (D-14)                                                            | VERIFIED | yaml parse: jobs include `deploy` with `if: github.ref == 'refs/heads/main'` AND `needs: build`                                                                                                                                                                          |
| 25  | ci.yml gains a `preview` job that runs on pull_request after `build` succeeds                                                                 | VERIFIED | `preview` with `if: github.event_name == 'pull_request'` AND `needs: build`                                                                                                                                                                                              |
| 26  | Both new jobs use OIDC via `google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093` (SHA-pinned)                                  | VERIFIED | Verbatim SHA appears in both `deploy` and `preview` step blocks                                                                                                                                                                                                          |
| 27  | Both jobs run `cd functions && npm ci && npm run build` BEFORE `firebase deploy` (Pitfall 5)                                                  | VERIFIED | "Install + build functions/ workspace" step appears in both jobs ahead of the deploy step                                                                                                                                                                                |
| 28  | deploy job's final step asserts presence of all 9 expected headers via `curl -I` (T-3-1 mitigation)                                            | VERIFIED | "Assert security headers (T-3-1 mitigation)" step contains `set -euo pipefail` and 9 case-insensitive grep checks (HSTS, X-CTO, Referrer-Policy, Permissions-Policy, COOP, COEP, CORP, Reporting-Endpoints, CSP-RO)                                                       |
| 29  | preview job uses `FirebaseExtended/action-hosting-deploy@e2eda2e106cfa35cdbcf4ac9ddaf6c4756df2c8c` to deploy channel pr-<number> with 7d expiry | VERIFIED | Verbatim SHA + `channelId: pr-${{ github.event.pull_request.number }}` + `expires: 7d`                                                                                                                                                                                   |
| 30  | deploy job has concurrency group `firebase-deploy-main` with `cancel-in-progress: false`                                                       | VERIFIED | Lines 145-147 of ci.yml                                                                                                                                                                                                                                                  |
| 31  | Both jobs have `id-token: write` permission; preview additionally has `pull-requests: write`                                                   | VERIFIED | Permissions blocks per yaml parse                                                                                                                                                                                                                                         |
| 32  | audit job adds `cd functions && npm audit --audit-level=high --omit=dev` step                                                                  | VERIFIED | "npm audit (functions/ prod deps, high severity)" step inserted between root npm audit and OSV-Scanner                                                                                                                                                                    |
| 33  | SECURITY.md gains §Hosting & Deployment section atomic with ci.yml                                                                              | VERIFIED | SECURITY.md lines 292-317 with citations: OWASP ASVS L2 v5.0 V14.7, ISO/IEC 27001:2022 A.5.7, SOC 2 CC8.1, Workload Identity Federation                                                                                                                                  |
| 34  | Branch protection update DEFERRED to runbook-only (Pitfall A pattern)                                                                          | VERIFIED | runbooks/branch-protection-bootstrap.md contains both check names + Pitfall A precondition documentation; required-status-checks not yet enabled in repo (operator-deferred)                                                                                              |

#### Wave 4 (03-05) — Hosting cutover runbook (authoring) + Wave 5 (03-05 Task 3) — Production cutover

| #   | Truth                                                                                                                              | Status                       | Evidence                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 35  | runbooks/hosting-cutover.md exists with prerequisites + smoke checklist + cutover steps + DNS revert + day-14 cleanup + citations | VERIFIED                     | 431 lines; all 6 required headings + 10 cutover sub-steps present; substring check matches all 33 required strings per 03-05 verifier             |
| 36  | Pre-cutover synthetic smoke procedure documented for BOTH wire formats (Pitfall 3 rawBody fallback exercise)                       | VERIFIED                     | Smokes 1 (modern) + 2 (legacy/Pitfall-3) + 3 (wrong content-type) + 4 (oversized) + 5 (extension origin) — concrete curl + gcloud logging filter |
| 37  | Pre-cutover synthetic smoke EXECUTED against deployed function and Cloud Logging entries observed                                  | PENDING-OPERATOR-EXECUTION   | 03-PREFLIGHT.md `## Smoke Result` block NOT yet appended; smokes are operator-deferred per the operator's "author runbook now, execute later" choice |
| 38  | Production cutover (CNAME flip + GH-Pages disable) executed and logged in 03-PREFLIGHT.md ## Cutover Log                          | PENDING-OPERATOR-EXECUTION   | `## Cutover Log` skeleton exists with 10 PENDING-USER markers; awaits operator post-execution backfill                                            |
| 39  | securityheaders.com manual rating ≥ A confirmed on live custom domain                                                             | PENDING-OPERATOR-EXECUTION   | `securityheaders_rating: PENDING-USER` marker in Cutover Log; runbook Step 7 directs operator                                                     |
| 40  | GH-Pages serving set to None in repo settings; gh-pages branch + Pages workflows RETAINED                                          | PENDING-OPERATOR-EXECUTION   | runbook Step 8 directs operator; preserved-substrate rule explicit                                                                                  |

#### Wave 6 (03-06) — Phase close-out

| #   | Truth                                                                                                                                       | Status                       | Evidence                                                                                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 41  | runbooks/phase-4-cleanup-ledger.md gains row "Phase 3 GH-Pages rollback substrate" (PENDING-USER day-14, T-3-4 mitigation)                  | VERIFIED                     | Row present at lines 59-60 with PENDING-USER cell + decision rule for rolled-back fallback + T-3-4 references                                                          |
| 42  | runbooks/phase-4-cleanup-ledger.md gains row "Phase 3 — meta-CSP regression guard" (Phase 4 forward task with index-html-meta-csp.test.js)  | VERIFIED                     | Row present at line 60 with hardening target referencing `tests/index-html-meta-csp.test.js`                                                                            |
| 43  | runbooks/branch-protection-bootstrap.md updated with two new required-status-checks (Deploy to Firebase Hosting + Deploy PR Preview Channel) | VERIFIED                     | gh api payload at lines 31-32 contains both contexts; `## Apply via GitHub UI` section at lines 87-100; Pitfall A precondition documented; first-green-run dates PENDING-USER |
| 44  | SECURITY.md commit-SHA backfill complete at evidence bullet locations (e7a3e06, 03f4c07, 49afecb)                                          | VERIFIED                     | grep matches: §HTTP Security Headers + §CSP + §Hosting & Deployment all carry the relevant SHAs; no `${commit-sha-...}` placeholders remain                          |
| 45  | SECURITY.md gains §Phase 3 Audit Index sub-block with 9 framework citation rows                                                            | VERIFIED                     | SECURITY.md lines 319-348 contain the heading + 9-row table with framework, citation, section, implementation, verification, commit SHAs; cross-phase plug-ins listed; forward-looking concerns cross-referenced |
| 46  | Branch protection rule applied in GitHub UI                                                                                               | PENDING-OPERATOR-EXECUTION   | runbook authoring complete; UI mutation requires repo-admin session AND Pitfall A precondition (first green deploy + preview runs in registry) — both gated on cutover  |

**Total truths verified:** 16 RESOLVED-BY-AUTHORING-OR-CODE / 19 (3 PENDING-OPERATOR-EXECUTION surfaced as `human_needed`)

---

## Required Artifacts

| Artifact                                                                              | Expected                                                                                | Status     | Details                                                                                                                                            |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `firebase.json`                                                                       | Hosting + headers + rewrites + functions + emulators                                    | ✓ VERIFIED | All 9 headers + rewrite ordering + cache-control overrides + functions block + emulator block present and correct                                   |
| `.firebaserc`                                                                         | Default project mapping                                                                 | ✓ VERIFIED | `projects.default === "bedeveloped-base-layers"`                                                                                                    |
| `tests/firebase-config.test.js`                                                       | Schema-validation guard (T-3-1 + T-3-2)                                                 | ✓ VERIFIED | 17/17 tests passing; `process.cwd()` path; `it.each` over 9 keys                                                                                     |
| `tsconfig.json`                                                                       | Root typecheck excludes functions/**                                                    | ✓ VERIFIED | Line 19 contains `"functions/**"`; root typecheck exits 0                                                                                          |
| `SECURITY.md`                                                                         | §HTTP Security Headers + §CSP (Report-Only) + §Hosting & Deployment + §Phase 3 Audit Index | ✓ VERIFIED | All 4 sections present with citations + commit SHAs backfilled                                                                                     |
| `functions/package.json`                                                              | Standalone npm workspace, Node 22, firebase-admin 13.8 + firebase-functions 7.2          | ✓ VERIFIED | All required fields present; pinned exactly                                                                                                         |
| `functions/tsconfig.json`                                                              | Standalone TS config (CommonJS, outDir lib)                                             | ✓ VERIFIED | `module: commonjs`, `outDir: lib`, `target: es2022`, `strict: true`, `rootDir: src`, `ignoreDeprecations: 6.0`                                  |
| `functions/src/csp/cspReportSink.ts`                                                  | onRequest+europe-west2, content-type+64KiB gates, rawBody fallback, logger.warn         | ✓ VERIFIED | Pipeline 1-7 implemented; rawBody fallback present; `csp.violation` + `europe-west2` + `logger.warn` substrings in source AND compiled `lib/`     |
| `functions/src/csp/normalise.ts`                                                      | Pure transform, modern + legacy wire formats                                            | ✓ VERIFIED | NormalisedReport interface + normalise() handle both formats + null on garbage                                                                      |
| `functions/src/csp/filter.ts`                                                         | Pure shouldDrop() over 5 extension + 3 synthetic origins                                | ✓ VERIFIED | EXTENSION_SCHEMES + SYNTHETIC_ORIGINS constants; checks both blockedUri AND sourceFile                                                              |
| `functions/src/csp/dedup.ts`                                                          | 5-min Map<fingerprint, ms>; _clearForTest                                                | ✓ VERIFIED | DEDUP_WINDOW_MS = 5*60*1000; URL.origin normalisation; _clearForTest export                                                                         |
| `functions/test/csp/{normalise,filter,dedup}.test.ts`                                 | TDD coverage with fake timers                                                            | ✓ VERIFIED | 31 tests passing across 3 files                                                                                                                     |
| `.github/workflows/ci.yml`                                                            | deploy + preview jobs via OIDC + post-deploy 9-header curl + functions/ npm audit       | ✓ VERIFIED | yaml parse confirms 8 jobs (setup, lint, typecheck, test, audit, build, deploy, preview); SHA pins verbatim; concurrency control + permissions correct |
| `runbooks/hosting-cutover.md`                                                         | 6 sections + 10 cutover steps + smoke checklist + day-14 cleanup                         | ✓ VERIFIED | 431 lines; all required headings + step subheadings + substrings (registrar Namecheap, default URL, /api/csp-violations, europe-west2, gh-pages)   |
| `runbooks/branch-protection-bootstrap.md`                                             | Updated with 2 new required-status-checks + Pitfall A callout + UI section              | ✓ VERIFIED | 134 lines (was 70 baseline); both check names present in payload + UI sections; first-green-run PENDING-USER markers present                       |
| `runbooks/phase-4-cleanup-ledger.md`                                                  | 2 new rows under §Out-of-band soft-fail entries                                          | ✓ VERIFIED | "Phase 3 GH-Pages rollback substrate" (PENDING-USER day-14) + "Phase 3 — meta-CSP regression guard" (Phase 4 CODE-01) both present                |
| `.planning/phases/03-hosting-cutover-baseline-security-headers/03-PREFLIGHT.md`      | 8 canonical sections + Cutover Log skeleton                                              | ✓ VERIFIED | Pre-flight sections complete (gcloud-dependent items PENDING-USER per environment auth gate); ## Cutover Log skeleton with 10 PENDING-USER markers |

---

## Key Link Verification

| From                                                  | To                                                  | Via                                                                                                            | Status     | Details                                                                                                                |
| ----------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| `firebase.json`                                       | `functions/src/csp/cspReportSink.ts`                | rewrites[0].function.functionId === "cspReportSink" AND region === "europe-west2"                              | ✓ WIRED    | Both ends present; tests/firebase-config.test.js asserts the contract                                                  |
| `firebase.json`                                       | Browser Reporting API                               | Reporting-Endpoints names csp-endpoint AND CSP value contains report-uri /api/csp-violations + report-to       | ✓ WIRED    | Verified in firebase.json header values + dual-reporting test                                                          |
| `tests/firebase-config.test.js`                       | `firebase.json`                                     | fs.readFileSync(resolve(process.cwd(),'firebase.json'))                                                        | ✓ WIRED    | Test runs and passes 17/17 against current firebase.json                                                              |
| `functions/src/index.ts`                              | `functions/src/csp/cspReportSink.ts`                | `export { cspReportSink } from "./csp/cspReportSink.js"`                                                        | ✓ WIRED    | Single re-export verified                                                                                              |
| `functions/src/csp/cspReportSink.ts`                  | Cloud Logging                                       | `logger.warn("csp.violation", { report, fingerprint })`                                                         | ✓ WIRED    | Sole log call in compiled output; LIVE END (Cloud Logging entry) is PENDING-OPERATOR-EXECUTION                          |
| `.github/workflows/ci.yml deploy job`                 | Firebase Hosting (production)                       | `npx firebase-tools@15.16.0 deploy --only hosting,functions --project bedeveloped-base-layers --non-interactive` | ✓ WIRED    | Deploy step present; first green run depends on operator OIDC bootstrap completion                                      |
| `.github/workflows/ci.yml deploy job`                 | GCP Workload Identity Federation                    | `secrets.GCP_WORKLOAD_IDENTITY_PROVIDER + secrets.GCP_SERVICE_ACCOUNT`                                          | ✓ WIRED    | Action SHA-pinned; secret names referenced — operator confirms presence per 03-PREFLIGHT PENDING-USER                  |
| `runbooks/hosting-cutover.md`                         | `.github/workflows/ci.yml deploy job`               | Prerequisites checklist requires green deploy + headers assertion                                              | ✓ WIRED    | Reference present; live-execution gate is operator-deferred                                                            |
| `runbooks/branch-protection-bootstrap.md`             | `.github/workflows/ci.yml deploy + preview jobs`    | required-status-checks register `Deploy to Firebase Hosting` + `Deploy PR Preview Channel` job names           | ✓ WIRED    | Both check names present in runbook payload; UI application is operator-deferred (Pitfall A)                            |
| `runbooks/phase-4-cleanup-ledger.md` (Phase 3 row)    | `runbooks/hosting-cutover.md §Day-14 Cleanup`       | Cleanup ledger row points at runbook section for the actual deletion command sequence                          | ✓ WIRED    | Cell references runbook section verbatim                                                                                |
| `SECURITY.md ## § Phase 3 Audit Index`                | Phase 11 evidence pack (DOC-09)                     | Audit index lists every framework citation Phase 3 closed; Phase 11 walks the index                            | ✓ WIRED    | Cross-phase plug-ins explicit; index self-check tied to cleanup ledger rows                                            |

---

## Behavioral Spot-Checks

| Behavior                                                                            | Command                                                                                | Result                  | Status   |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------- | -------- |
| firebase.json schema test (T-3-1 + T-3-2)                                          | `npm test -- --run tests/firebase-config.test.js`                                       | 17/17 passing            | ✓ PASS   |
| functions/ unit test suite (normalise + filter + dedup)                             | `cd functions && npm test`                                                              | 31/31 passing            | ✓ PASS   |
| Root tsconfig excludes functions/** so JSDoc typecheck doesn't choke on TS files    | `npm run typecheck`                                                                     | exit 0                   | ✓ PASS   |
| functions/ typecheck (after `npm ci` in workspace)                                  | `cd functions && npm run typecheck`                                                     | exit 0                   | ✓ PASS   |
| functions/ lint (no-console=error gate)                                             | `cd functions && npm run lint`                                                          | exit 0                   | ✓ PASS   |
| functions/ build emits lib/index.js + lib/csp/cspReportSink.js                      | `cd functions && npm run build && ls lib/`                                              | csp/, index.js emitted   | ✓ PASS   |
| Compiled cspReportSink contains expected substrings                                 | `grep -E "csp.violation\|europe-west2\|logger.warn" functions/lib/csp/cspReportSink.js` | all 3 present            | ✓ PASS   |
| index.html has no meta-CSP regression                                               | `grep -c "http-equiv" index.html`                                                       | 0                        | ✓ PASS   |
| no console.* calls in functions/ source                                             | `grep -c "console\.warn\|console\.log" functions/src/csp/*.ts`                           | 0/0/0/0                  | ✓ PASS   |
| ci.yml YAML parse + jobs structure                                                  | `node -e ... yaml.load(...)` + jobs key extraction                                     | 8 jobs present           | ✓ PASS   |
| Full root test suite                                                                | `npm test -- --run`                                                                     | 197/197 passing          | ✓ PASS   |
| LIVE END: Cloud Logging entry from synthetic CSP report on deployed function        | `gcloud logging read ...`                                                                 | (deferred to operator)   | ? SKIP   |
| LIVE END: securityheaders.com rating ≥ A on https://baselayers.bedeveloped.com      | manual UI inspection                                                                    | (deferred to operator)   | ? SKIP   |
| LIVE END: post-cutover curl -I returns 9 headers from custom domain                 | `curl -sI https://baselayers.bedeveloped.com`                                            | (deferred to operator)   | ? SKIP   |

**Note:** All offline / config / test / docs spot-checks PASS. The 3 SKIPped checks are LIVE-END verifications that require the cutover to have been executed; operator owns these (operator-deferred).

---

## Requirements Coverage

| Requirement | Source Plan       | Description                                                                                                | Status                          | Evidence                                                                                                                                              |
| ----------- | ----------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| HOST-01     | 03-01, 02, 04, 05, 06 | Production hosting cuts over from GitHub Pages to Firebase Hosting                                          | RESOLVED-BY-AUTHORING-ONLY      | firebase.json + ci.yml deploy job + cutover runbook all in place; final cutover step is operator-deferred                                              |
| HOST-02     | 03-01, 05         | Custom domain `baselayers.bedeveloped.com` migrated via DNS update; SSL auto-provisioned                    | PENDING-OPERATOR-EXECUTION      | Runbook documents DNS + SSL steps; operator executes                                                                                                  |
| HOST-03     | 03-01, 02, 04     | HTTP security headers configured                                                                            | ✓ SATISFIED                     | firebase.json declares all 7 headers (HSTS / X-CTO / Referrer-Policy / Permissions-Policy / COOP / COEP) + CORP. Schema test 9/9 + post-deploy assertion |
| HOST-04     | 03-01, 02, 04     | CSP rolled out in `Content-Security-Policy-Report-Only` mode                                                | ✓ SATISFIED                     | firebase.json declares CSP-RO with D-07 directive list + dual-reporting; SECURITY.md §CSP documents the policy                                          |
| HOST-05     | 03-01, 02, 03, 05 | A `csp-violations` Cloud Function endpoint receives + filters CSP violation reports                         | RESOLVED-BY-AUTHORING-ONLY      | functions/src/csp/cspReportSink.ts implemented + 31 unit tests; live-end verification (Cloud Logging entry from real reports) is operator-deferred |
| HOST-08     | 03-04, 05, 06     | CI deploys to Firebase Hosting from `main` automatically; per-PR preview channels configured                | RESOLVED-BY-AUTHORING-ONLY      | ci.yml deploy + preview jobs; first green run is operator-gated on cutover                                                                            |
| FN-10       | 03-03, 05         | csp-violations Cloud Function endpoint paired with HOST-05                                                  | RESOLVED-BY-AUTHORING-ONLY      | Same artefact as HOST-05; live-end verification operator-deferred                                                                                     |
| DOC-10      | 03-02, 04, 06     | Each phase incrementally appends to SECURITY.md                                                             | ✓ SATISFIED                     | §HTTP Security Headers + §CSP (Report-Only) + §Hosting & Deployment + §Phase 3 Audit Index all present with framework citations + commit SHAs        |

**Orphan check:** REQUIREMENTS.md "Phase 3" mapping (HOST-01..05, HOST-08, FN-10) matches plans verbatim; DOC-10 cross-phase. No orphans.

---

## Anti-Patterns Found

| File                                                  | Line | Pattern                | Severity | Impact                                                                                                                                                                          |
| ----------------------------------------------------- | ---- | ---------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 03-PREFLIGHT.md                                       | n/a  | PENDING-USER markers   | ℹ️ Info  | Not a code smell — these are explicit placeholders for operator-supplied values (Firestore region, OIDC pool state, registrar identity, Cutover Log fields). By design.        |
| runbooks/branch-protection-bootstrap.md               | n/a  | PENDING-USER markers   | ℹ️ Info  | Same as above — operator backfills first-green-run dates AFTER cutover lands the names in GitHub's check registry (Pitfall A). By design.                                       |
| runbooks/phase-4-cleanup-ledger.md (Phase 3 row)      | n/a  | PENDING-USER cell      | ℹ️ Info  | Re-evaluation date computed as cutover_date + 14 days; cutover_date is itself PENDING-USER. By design (operator-deferred chain).                                                 |
| SECURITY.md §HTTP Security Headers                    | n/a  | "(HSTS preload submission deferred to Phase 10 / HOST-06 ...)" | ℹ️ Info  | Documented deferral, not a TODO; matches roadmap (HOST-06 is Phase 10).                                                                                                          |

**Stub classification:** None. All "deferred" / "PENDING-USER" patterns are documented operator-action items, not stub code paths.

**Blocker count:** 0
**Warning count:** 0
**Info count:** 4

---

## Human Verification Required

Three operator-execution items, all surfaced by design (operator chose "author runbook now, execute later" at Wave 4 + Wave 6):

### 1. Wave 1 (03-01) Task 2 — Operator response to PENDING-USER block

**Test:** Operator pastes the seven gcloud / Console / registrar / GitHub-secrets values into 03-PREFLIGHT.md per 03-01-SUMMARY.md §Checkpoint Status Block A-D resume signal:
1. Firestore locationId
2. Firebase Hosting Console enabled (yes/no)
3. OIDC pool state (ACTIVE / MISSING / just-bootstrapped)
4. OIDC SA roles for github-actions-deploy@bedeveloped-base-layers.iam.gserviceaccount.com
5. GitHub OIDC repo secrets present (yes/no)
6. Registrar identity (Namecheap / Cloudflare / GoDaddy / other)
7. Approval token (`approved` or `BLOCK Wave 3 — reason: ...`)

**Expected:** All 7 fields concretely filled. If `BLOCK Wave 3` is returned, ROADMAP.md gets annotated and Wave 3 (CI deploy) halts; otherwise the deploy job is unblocked.

**Why human:** gcloud auth login + firebase-tools login + Firebase Console + GitHub repo settings + registrar UI are all interactive surfaces that Claude cannot exercise non-interactively.

### 2. Wave 4 (03-05) Task 3 — Production cutover

**Test:** Operator opens `runbooks/hosting-cutover.md` and executes:
- §Pre-cutover Smoke Checklist 5 smokes against `https://bedeveloped-base-layers.web.app/api/csp-violations`
- §Cutover Steps 1-10 (disable GH-Pages, lower TTL, add custom domain in Firebase Console, update DNS at registrar, monitor SSL, securityheaders.com rating, end-to-end live-domain CSP report, raise TTL)
- Backfills 03-PREFLIGHT.md `## Cutover Log` 10 PENDING-USER fields

**Expected:**
- All 5 smokes pass with their expected status codes (204 / 204 / 400 / 413 / 204) AND smokes 1+2 produce Cloud Logging entries within 30s while smokes 3+4+5 do not
- `cutover_complete: yes`
- `securityheaders_rating: A` or higher
- `synthetic_csp_e2e_seen_in_cloud_logging: yes`
- All 9 security headers visible on `curl -sI https://baselayers.bedeveloped.com`

**Why human:** GH-Pages disable, registrar DNS edits, Firebase Console TXT/A/AAAA handshake, SSL provisioning monitoring, securityheaders.com rating, live-browser CSP violation triggering — all interactive. None have programmatic equivalents inside Claude's blast radius. Roadmap success criteria #1 and #5 close on operator's `cutover_complete: yes` and `securityheaders_rating ≥ A` values.

### 3. Wave 6 (03-06) Task 3 — Apply branch protection rule in GitHub UI

**Test:** After Wave 4 cutover lands the first green deploy run on main and the first PR triggers a green preview run:
1. Operator confirms `gh api repos/lukebadiali/base-layers-diagnostic/commits/main/check-runs --jq '.check_runs[].name'` returns BOTH `Deploy to Firebase Hosting` AND `Deploy PR Preview Channel`
2. Operator either runs the gh api PUT payload in `runbooks/branch-protection-bootstrap.md ## Command` OR follows the click-path in `## Apply via GitHub UI`
3. Operator backfills the first-green-run PENDING-USER dates in the runbook with ISO timestamps + run IDs

**Expected:** `gh api repos/.../branches/main/protection | jq .required_status_checks.contexts` returns 7 entries (Lint, Typecheck, Test, Security Audit, Build, Deploy to Firebase Hosting, Deploy PR Preview Channel).

**Why human:** Pitfall A precondition gates this on first-green-run completion (which is itself operator-gated on cutover); GitHub Settings → Branches UI requires repo-admin session.

---

## Gaps Summary

**No code/config/runbook/docs deliverables fall short of plan must_haves.** All 16 RESOLVED-BY-AUTHORING-OR-CODE truths have artefact-level evidence, schema/test gates pass, key links verify, and behavioral spot-checks all PASS where they don't require live infrastructure. The 3 outstanding items are operator-execution actions explicitly chosen as "author runbook now, execute later" — they are **not gaps to fix in code** and have been surfaced as `human_needed` per the verification protocol.

**Scoring rationale:**
- Score: 16 / 19 must-haves verified
- Status: human_needed (the 3 unverified items are operator-execution, not code-side)
- Status is NOT `gaps_found` because every code/config/runbook/docs deliverable matches the plan must_haves; nothing in the codebase needs to be fixed before those operator actions are taken
- Status is NOT `passed` because operator items remain — phase verification cannot pass HOST-01 / HOST-02 (cutover) and HOST-08 (securityheaders rating) without operator execution

**For the orchestrator's next step:** Surface the three Human Verification items to the operator. When all three are completed and the Cutover Log shows `cutover_complete: yes` + `securityheaders_rating ≥ A`, re-run `/gsd-verify-work 3` to flip status to `passed`.

---

_Verified: 2026-05-06T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
