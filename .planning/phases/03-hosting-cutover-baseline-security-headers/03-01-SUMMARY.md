---
phase: 03-hosting-cutover-baseline-security-headers
plan: 01
subsystem: infra
tags: [phase-3, preflight, firebase-hosting, csp, oidc, dns, gcloud]

requires:
  - phase: 01-engineering-foundation-tooling
    provides: firebase-tools devDep, runbooks/firebase-oidc-bootstrap.md, vite build artefact shape
  - phase: 02-test-suite-foundation
    provides: src/* modular targets that Vite includes in dist/main-*.js bundle
provides:
  - 03-PREFLIGHT.md canonical Wave-1 verification record (8 sections)
  - 03-CONTEXT.md Pre-Flight Addendum (Wave 1) with D-06/D-09 dispositions and dist/ font-CDN finding
  - Naming reconciliation for OIDC pool provider + service account (runbook canonical: github-oidc, github-actions-deploy)
  - Required CSP directive overrides for 03-02-PLAN.md (cdn.jsdelivr.net, fonts.googleapis.com, fonts.gstatic.com, securetoken.google.com)
  - PENDING-USER list with exact verification commands for the gcloud-dependent items
affects: [03-02 firebase.json, 03-03 csp-violations function, 03-04 CI deploy, 03-05 cutover, Phase 4 CDN-to-npm migration, Phase 6 Auth popup script-src, Phase 7 IAM narrowing, Phase 11 PRIVACY.md residency]

tech-stack:
  added: []
  patterns: [pre-flight-as-canonical-artefact, runbook-vs-stub-naming-reconciliation]

key-files:
  created:
    - .planning/phases/03-hosting-cutover-baseline-security-headers/03-PREFLIGHT.md
    - .planning/phases/03-hosting-cutover-baseline-security-headers/03-01-SUMMARY.md
  modified:
    - .planning/phases/03-hosting-cutover-baseline-security-headers/03-CONTEXT.md (Pre-Flight Addendum (Wave 1) section added before Decision Refinements addendum)

key-decisions:
  - "T-3-5 disposition pre-confirmed: accept roles/firebase.admin over-grant for Phase 3; Phase 7 narrows."
  - "D-09 verified no divergence: bedeveloped-base-layers.firebaseapp.com matches CONTEXT.md."
  - "T-3-7 mitigated by absence: no <meta http-equiv> tag in index.html — no removal commit needed in 03-02-PLAN.md."
  - "Vite build does NOT self-host Google Fonts or Chart.js (RESEARCH.md was wrong). Phase-3 CSP must temporarily allow CDN origins until Phase 4 CDN-to-npm migration."
  - "OIDC pool provider/SA names in 03-01-PLAN.md interfaces stub were descriptive — runbook canonical names are 'github-oidc' / 'github-actions-deploy@bedeveloped-base-layers.iam.gserviceaccount.com'."

patterns-established:
  - "Pre-flight artefact as single source of truth: 03-PREFLIGHT.md is the canonical record consumed by Plans 02-05; CONTEXT.md addendum is a pointer + decision-impact summary."
  - "PENDING-USER explicit-procedure pattern: when external auth blocks a check, write the verification command + decision rules into the artefact rather than skipping the row."

requirements-completed: []

duration: 28min
completed: 2026-05-06
---

# Phase 3 Plan 01: Pre-Flight Verifications Summary

**Wave-1 pre-flight artefact 03-PREFLIGHT.md created with 8 canonical sections; offline checks complete; gcloud-dependent items written as PENDING-USER with exact resume commands. Significant divergence from RESEARCH.md found (dist/ retains Google Fonts + Chart.js CDN loads) — recorded as a CSP directive-list override that 03-02-PLAN.md must apply.**

## Performance

- **Duration:** ~28 min
- **Started:** 2026-05-06T20:31:00Z (worktree creation)
- **Completed:** 2026-05-06T20:59:00Z
- **Tasks:** 1 of 2 complete (Task 2 is a `checkpoint:human-verify` that requires user input — see Issues / Checkpoint section below)
- **Files created:** 2 (03-PREFLIGHT.md, 03-01-SUMMARY.md)
- **Files modified:** 1 (03-CONTEXT.md)

## Accomplishments

- Created `03-PREFLIGHT.md` with all 8 canonical sections required by 03-01-PLAN.md `<acceptance_criteria>`. Automated header-presence check passes (`node -e ...` script returns OK).
- Resolved offline (no external auth required):
  - Firebase project_id (`bedeveloped-base-layers`) and auth_domain (`bedeveloped-base-layers.firebaseapp.com`) from in-source `firebase-init.js`.
  - NS records for bedeveloped.com (`ns1.dns-parking.com`, `ns2.dns-parking.com` — domain currently parked, likely Namecheap).
  - index.html meta-CSP scan: NONE found (T-3-7 mitigated by absence).
  - dist/index.html font-CDN scan: Google Fonts + Chart.js CDN URLs survive Vite build.
  - Firebase JS SDK 12.12.1 origin set: 13 service hostnames identified by greppping `node_modules/@firebase/**/*.js`.
- Diffed verified SDK origin set against CONTEXT.md D-07 connect-src: identified `https://securetoken.google.com` as a single addition required (NOT covered by `*.googleapis.com` wildcard).
- Documented PENDING-USER procedures for gcloud-dependent items (Firestore region, OIDC pool state, OIDC SA roles, default hosting URL, Firebase Console state, GitHub OIDC repo secrets, registrar identity).
- Added `## Pre-Flight Addendum (Wave 1)` section to 03-CONTEXT.md per success criteria — includes D-06 PENDING / D-09 RESOLVED dispositions plus the dist/ font-CDN finding that affects D-07.
- Reconciled naming inconsistency between 03-01-PLAN.md `<interfaces>` stub (descriptive names like `github-actions-provider`, `github-deployer`) and `runbooks/firebase-oidc-bootstrap.md` canonical names (`github-oidc`, `github-actions-deploy@…`). Runbook is canonical — flagged for 03-04-PLAN.md.

## Task Commits

1. **Task 1: Run command-line pre-flights and record output verbatim** — `bd47d4d` (docs)

   Commit message: `docs(03-01): add Wave 1 pre-flight verifications + CONTEXT.md addendum`

2. **Task 2: Confirm registrar + DNS admin access + Firebase Console state** — **NOT YET COMMITTED**

   This is a `checkpoint:human-verify` (gate=blocking). Cannot proceed without operator input. See "Checkpoint Status" section below.

**Plan metadata commit:** committed alongside SUMMARY.md (next step).

## Files Created/Modified

- `.planning/phases/03-hosting-cutover-baseline-security-headers/03-PREFLIGHT.md` — created. 8 canonical sections, ~370 lines, includes a Pre-Flight Summary table and explicit "Inputs handed to downstream plans" mapping.
- `.planning/phases/03-hosting-cutover-baseline-security-headers/03-CONTEXT.md` — Pre-Flight Addendum (Wave 1) section added (~25 lines) between `<deferred>` and the existing `<addendum>` block.
- `.planning/phases/03-hosting-cutover-baseline-security-headers/03-01-SUMMARY.md` — this file.

## Decisions Made

All decisions are documented in `03-PREFLIGHT.md` and `03-CONTEXT.md` Pre-Flight Addendum. Highlights:

- **T-3-5 (over-broad SA roles): accept the over-grant of `roles/firebase.admin` for Phase 3.** Phase 7 narrows. Documented in 03-PREFLIGHT.md `## OIDC SA Roles → mitigation_for_T-3-5`.
- **T-3-7 (meta + header CSP conflict): mitigated by absence.** No removal commit required.
- **Phase-3 CSP directive overrides:** add `https://cdn.jsdelivr.net` to `script-src`, `https://fonts.googleapis.com` to `style-src`, `https://fonts.gstatic.com` to `font-src`, and `https://securetoken.google.com` to `connect-src`. Document as temporary in SECURITY.md per D-15 with cleanup-ledger entry. **All four are passed forward to 03-02-PLAN.md.**
- **D-06 region locked at `europe-west2` for the Cloud Function regardless of Firestore region.** Cross-region accepted if Firestore turns out to be elsewhere; Phase 6/Phase 11 own the residency conversation.

## Deviations from Plan

### Rule-3 (blocking) auto-fixes

**1. [Rule 3 - Blocking] Installed dependencies via `npm ci` to enable build + SDK origin scan**
- **Found during:** Task 1 step 6 (`npm run build`) and step 7 (SDK origin grep)
- **Issue:** `node_modules/` did not exist in the fresh worktree. Both `npm run build` (font-CDN scan precondition) and the `grep` against Firebase SDK source (origin verification) require installed packages.
- **Fix:** Ran `npm ci --prefer-offline --no-audit --no-fund` (~60 s, 934 packages installed).
- **Files modified:** None (node_modules is gitignored).
- **Verification:** Build succeeded; `node_modules/firebase/package.json` confirms version 12.12.1; SDK grep returned 13 distinct service origins.
- **Committed in:** Not applicable (no source files changed).

### Rule-2 (missing critical) auto-additions

**2. [Rule 2 - Missing Critical] Recorded a real divergence from RESEARCH.md (dist/ NOT self-hosted) that the plan only treated as a yes/no question**
- **Found during:** Task 1 step 6 (`grep` over dist/index.html)
- **Issue:** 03-RESEARCH.md §Summary lines 79-82 stated the Vite build self-hosts Google Fonts + Chart.js. The actual `dist/index.html` retains all three CDN URLs (`fonts.googleapis.com`, `fonts.gstatic.com`, `cdn.jsdelivr.net`). The plan structure expected to write `google_fonts_googleapis_present: yes/no` and move on, but the implication is that **D-07's CSP directive list (CONTEXT.md) is too tight for the Phase 3 deploy** and 03-02-PLAN.md must apply temporary additions.
- **Fix:** Documented the four required directive additions (script-src, style-src, font-src, connect-src) in 03-PREFLIGHT.md `## dist/index.html font-CDN scan` AND in 03-CONTEXT.md Pre-Flight Addendum so the next planner cannot miss them. Added a cleanup-ledger note recommendation (Phase 4 CDN-to-npm migration removes them).
- **Files modified:** 03-PREFLIGHT.md (new), 03-CONTEXT.md (addendum).
- **Verification:** `grep -c "## Pre-Flight Addendum (Wave 1)" 03-CONTEXT.md` returns 1.
- **Committed in:** `bd47d4d`.

**3. [Rule 2 - Missing Critical] Identified `securetoken.google.com` as connect-src gap**
- **Found during:** Task 1 step 7 (SDK origin diff against D-07)
- **Issue:** D-07's connect-src wildcard is `https://*.googleapis.com`. `securetoken.google.com` lives at the `.google.com` host (NOT `.googleapis.com`), so the wildcard does NOT cover it. The Firebase Auth SDK references `securetoken.google.com` as a token endpoint. Without this addition, Firebase Auth refresh-token flow would log CSP-Report-Only violations during the soak.
- **Fix:** Recorded in 03-PREFLIGHT.md `## SDK 12.x connect-src verification → additions_required`.
- **Files modified:** 03-PREFLIGHT.md.
- **Verification:** Section content includes `additions_required: https://securetoken.google.com`.
- **Committed in:** `bd47d4d`.

**4. [Rule 2 - Missing Critical] Reconciled provider/SA naming between 03-01-PLAN.md interfaces stub and runbook canonical**
- **Found during:** Task 1 read_first phase (cross-reading 03-01-PLAN.md `<interfaces>` and `runbooks/firebase-oidc-bootstrap.md`)
- **Issue:** 03-01-PLAN.md interfaces stub used descriptive names (`provider: github-actions-provider`, `service_account: github-deployer@…`). The runbook (Phase 1 D-23 deliverable) uses canonical names (`github-oidc`, `github-actions-deploy@…`). If 03-04-PLAN.md uses the stub names verbatim, the OIDC binding would fail at deploy time.
- **Fix:** 03-PREFLIGHT.md `## OIDC Pool` records BOTH stub-and-canonical, with a "Naming reconciliation note" subsection explicitly stating the runbook is canonical and 03-04-PLAN.md should use the runbook names.
- **Files modified:** 03-PREFLIGHT.md.
- **Committed in:** `bd47d4d`.

---

**Total deviations:** 4 (1 Rule 3 blocking, 3 Rule 2 missing-critical). All necessary for downstream plan correctness; no scope creep.

## Authentication Gates

This plan hit **two authentication gates**, both of which are documented in 03-PREFLIGHT.md as PENDING-USER with exact verification commands:

1. **gcloud auth token expired non-interactively.** All `gcloud` calls (Firestore region, OIDC pool list, OIDC SA roles, project describe) returned: *"There was a problem refreshing your current auth tokens: Reauthentication failed. cannot prompt during non-interactive execution. Please run: $ gcloud auth login"*. Authenticated account is `hugh@assume-ai.com`. **Resolution: operator runs `gcloud auth login` in a foreground terminal before re-running the verification commands.**
2. **firebase-tools not authenticated in this environment.** `npx firebase-tools projects:list --json` returned `"status": "error", "error": "Failed to authenticate, have you run firebase login?"`. **Resolution: operator runs `npx firebase-tools@15.16.0 login` once.**

These are gates, not bugs — surfaced as PENDING-USER per the executor's authentication-gates protocol.

## Issues Encountered

- **dig not available on Windows worktree.** Used `nslookup -type=NS bedeveloped.com` instead — equivalent output for the registrar identification step. Recorded the substitution implicitly via the captured stdout (file contains the nslookup output as evidence).
- **Python shim intercepts bare `gcloud` invocation.** The Microsoft Store Python alias on this Windows machine intercepts `gcloud` (bash sees it via the Python launcher). Workaround: invoke gcloud via the explicit `.cmd` wrapper at `/c/Users/hughd/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd`. Documented in 03-PREFLIGHT.md `## Firestore Region → Environment note` so the operator's re-run uses a fresh shell where this is not an issue.

## Checkpoint Status — Task 2 (PENDING-USER)

**Task 2 is a `checkpoint:human-verify` (gate=blocking) and CANNOT be completed by Claude in this worktree.** All inputs the user needs to provide are pre-staged in 03-PREFLIGHT.md.

### Resume conditions (operator action required)

The operator should run the following BEFORE the next Wave-2 / Wave-3 plan executes:

#### Block A — gcloud / firebase-tools re-authentication (in a foreground terminal)

```sh
gcloud auth login                    # opens browser; complete OAuth handshake
npx firebase-tools@15.16.0 login     # opens browser; complete Firebase OAuth handshake
```

#### Block B — Run gcloud verifications and paste output back into 03-PREFLIGHT.md

```sh
# 1. Firestore region (resolves D-06 divergence question)
gcloud firestore databases describe --database='(default)' --project=bedeveloped-base-layers --format=json | grep -E '"locationId"|"name"'

# 2. Firebase project + hosting site
npx firebase-tools@15.16.0 projects:list --json
npx firebase-tools@15.16.0 hosting:sites:list --project bedeveloped-base-layers --json

# 3. OIDC pool state
gcloud iam workload-identity-pools list --location=global --project=bedeveloped-base-layers --format=json
gcloud iam workload-identity-pools providers list --workload-identity-pool=github-actions --location=global --project=bedeveloped-base-layers --format=json

# 4. OIDC SA role bindings
gcloud projects get-iam-policy bedeveloped-base-layers --format=json
```

#### Block C — Confirm three Console-only states (no CLI equivalent)

1. **Firebase Hosting Console enabled:** open https://console.firebase.google.com/project/bedeveloped-base-layers/hosting/sites and confirm a Hosting site exists with the `web.app` URL.
2. **GitHub OIDC repo secrets:** open https://github.com/lukebadiali/base-layers-diagnostic/settings/secrets/actions and confirm `GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_SERVICE_ACCOUNT` exist. Do NOT print values.
3. **Registrar:** log in to whichever registrar holds bedeveloped.com (best guess: Namecheap given the dns-parking.com NS records). Confirm DNS-admin access. Reply with the registrar name.

#### Block D — Reply to the orchestrator with the resume signal

Paste the four CLI outputs from Block B (as JSON snippets) plus the three Block C confirmations. Format:

```text
1. Firestore locationId: <value>           (e.g. "europe-west2" or "nam5")
2. Firebase Hosting Console enabled: <yes|no>
3. OIDC pool state: <ACTIVE|MISSING>
4. OIDC SA roles for github-actions-deploy@…: <list, e.g. roles/firebase.admin>
5. GitHub OIDC repo secrets present: <yes|no>
6. Registrar: <Namecheap|Cloudflare|GoDaddy|other>
7. Approved? <approved | BLOCK Wave 3 — reason: ...>
```

If any answer triggers a blocker, the orchestrator will halt before Wave 3 (CI deploy) until the OIDC bootstrap runbook has been executed.

### Why Claude cannot do this autonomously

- gcloud auth requires an interactive browser handshake — `gcloud auth login` cannot run non-interactively.
- firebase-tools auth requires the same.
- Console UI inspections (Firebase Hosting enabled, GitHub repo secrets) have no read-only API equivalent that does not require a separate auth flow.
- Registrar identity confirmation requires a human to log in and visually inspect the Domain List — no programmatic way to verify "you have admin access" without making a destructive call.

## Self-Check

- [x] 03-PREFLIGHT.md created at the canonical path.
- [x] All 8 required headings present (verified by `node -e ...` script in 03-01-PLAN.md `<verify automated>` — output: `OK`).
- [x] All required schema keys present per `<acceptance_criteria>` (Firestore Region has `value:`; Firebase Project has `project_id:`, `default_url:`, `auth_domain:`; OIDC Pool has `pool_state:`; OIDC SA Roles has `granted_roles:` (PENDING-USER) and `excess_roles_present: yes`; index.html meta-CSP scan has `meta_csp_present: no`; dist/index.html font-CDN scan has both Google Fonts keys; SDK 12.x has `verified_origins:` list and `additions_required:`/`removals_safe:` lines).
- [x] 03-CONTEXT.md `## Pre-Flight Addendum (Wave 1)` section added (`grep -c` returns 1).
- [x] Task 1 commit `bd47d4d` exists in worktree git log.
- [x] Naming reconciliation between 03-01-PLAN.md interfaces stub and runbook canonical recorded.
- [x] All four CSP directive overrides handed to 03-02-PLAN.md (script-src, style-src, font-src, connect-src additions).
- [x] PENDING-USER blockers tagged with target plan number (03-04-PLAN.md if OIDC pool MISSING; 03-05-PLAN.md if registrar/DNS-admin not confirmed).

## Self-Check: PASSED

## Next Phase Readiness

- **Ready for Wave 2 (03-02-PLAN.md firebase.json) if:** the four CSP directive additions from this plan are accepted and applied. Wave 2 can technically start in parallel with the operator's Block A-D resume actions, since 03-02-PLAN.md does not need OIDC pool state or registrar identity.
- **Ready for Wave 3 (03-04-PLAN.md CI deploy) only if:** OIDC pool state is `ACTIVE` and GitHub repo secrets are confirmed present.
- **Ready for Wave 4 (03-05-PLAN.md cutover) only if:** registrar identity confirmed, DNS-admin access confirmed, AND Firebase Hosting site enabled in Console (custom domain provisioning visible in Console).

If the operator resumes with `BLOCK Wave 3 — reason: OIDC pool MISSING`, the orchestrator should:
1. Allow Wave 2 (03-02-PLAN.md) to proceed.
2. HALT before Wave 3 (03-04-PLAN.md).
3. Schedule the OIDC bootstrap runbook as a manual operator task before resuming Wave 3.

---

*Phase: 03-hosting-cutover-baseline-security-headers*
*Plan: 01 (Wave 1)*
*Completed (Task 1): 2026-05-06*
*Pending (Task 2): operator resume signal*
