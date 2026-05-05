---
phase: 01-engineering-foundation-tooling
plan: 06
subsystem: tooling
tags:
  [
    runbooks,
    smoke-test,
    contributing,
    security-md,
    socket-dev,
    branch-protection,
    doc-10,
    tool-08,
    tool-09,
    tool-11,
    pitfall-a,
    pitfall-19,
  ]

# Dependency graph
requires:
  - phase: 01-engineering-foundation-tooling
    plan: 01-01
    provides: package.json scripts (lint/typecheck/test/build)
  - phase: 01-engineering-foundation-tooling
    plan: 01-02
    provides: vitest config (smoke test consumes it) + eslint/tsc gates
  - phase: 01-engineering-foundation-tooling
    plan: 01-03
    provides: .gitleaks.toml + .husky/pre-commit (CONTRIBUTING.md documents local install)
  - phase: 01-engineering-foundation-tooling
    plan: 01-04
    provides: .github/workflows/ci.yml — first green CI run #25317482833 registered the 5 status-check names that branch protection now requires
  - phase: 01-engineering-foundation-tooling
    plan: 01-05
    provides: .github/dependabot.yml — SECURITY.md § Dependency Monitoring cites this as one of four monitoring layers
provides:
  - tests/smoke.test.js — pulled forward to commit 56eee56 (Wave 3 fix). Vitest runs green; "no test files found" warning eliminated.
  - runbooks/firebase-oidc-bootstrap.md — 6-step gcloud Workload Identity Pool + OIDC Provider for Phase 3 Firebase Hosting deploy
  - runbooks/branch-protection-bootstrap.md — gh api PUT payload (corrected to use rendered job names: Lint, Typecheck, Test, Security Audit, Build); Pitfall A pre-condition documented
  - runbooks/socket-bootstrap.md — Socket.dev GitHub App install via UI; closes TOOL-11
  - runbooks/phase-4-cleanup-ledger.md — populated row-by-row from live git grep; 16 suppressions enumerated (14 eslint + 2 @ts-nocheck) + 4 out-of-band soft-fail entries; closure target for Phase 4
  - CONTRIBUTING.md — local dev setup including gitleaks install on macOS/Windows/Linux + Conventional Commits + branch-protection expectations
  - SECURITY.md — three populated sections (§ Build & Supply Chain / § Dependency Monitoring / § Secret Scanning) with framework citations + 8 later-phase stubs + "credible, not certified" compliance posture statement
  - docs/evidence/branch-protection-screenshot.png — branch-rule settings page with 5 required contexts, 1 approval, dismiss stale, linear history, no force push, no deletions
  - docs/evidence/socket-install.png — Socket.dev BeDeveloped org dashboard
  - branch protection on main (applied via Repository Rulesets path; verified via /branches/main API)
affects:
  [
    01-PHASE-CLOSE,
    02-test-suite,
    03-hosting-cutover,
    04-modular-split,
    06-real-auth,
    11-evidence-pack,
  ]

# Tech tracking
tech-stack:
  added:
    - "vitest smoke test (pulled forward to commit 56eee56 in Wave 3 fix iteration)"
  patterns:
    - "DOC-10 atomic-commit pattern (D-25): SECURITY.md create commit IS the atomic close for Phase 1's three sections — Wave 0-4 commits accrued evidence; Wave 5 ships the audit narrative wrapping that evidence with framework citations. SECURITY.md did not exist until this wave so D-25's atomicity holds."
    - "Phase 4 cleanup ledger pattern: every suppression annotated inline (eslint-disable-next-line / @ts-nocheck) carries a 'See runbooks/phase-4-cleanup-ledger.md' reference; the ledger enumerates with file:line, rule, intended fix, closure phase. Empties to zero rows when Phase 4 is complete."
    - "Out-of-band soft-fail tracking pattern: items that aren't suppression comments but are still trackable cleanup (OSV continue-on-error, no-restricted-imports warn, INTERNAL_PASSWORD_HASH grandfather, gitleaks-action Node 20 deprecation) live in a separate ledger table with re-evaluation dates."
    - "Compliance posture statement pattern (Pitfall 19 prevention): 'credible, not certified' phrasing + canonical mapping reference (docs/CONTROL_MATRIX.md, Phase 11) prevents inadvertent false-certification claims in the audit narrative."
    - "Repo Path Correction pattern: plan content referenced AssumeAIhugh/base-layers-diagnostic; actual repo is lukebadiali/base-layers-diagnostic (verified via git remote -v + gh repo view). All four runbooks + CONTRIBUTING.md + SECURITY.md use the actual path. Plans authored before the repo's true ownership was confirmed should be updated when first executed; PROJECT.md decisions should pin the actual repo path going forward."

key-files:
  created:
    - "tests/smoke.test.js (committed in Wave 3 fix 56eee56; documented here for traceability)"
    - "runbooks/firebase-oidc-bootstrap.md (~80 lines, 6 steps + workflow snippet)"
    - "runbooks/branch-protection-bootstrap.md (~70 lines, gh api PUT command + status-check name correction note)"
    - "runbooks/socket-bootstrap.md (~50 lines, 5 steps + threat model + compliance citation)"
    - "runbooks/phase-4-cleanup-ledger.md (~100 lines, 16 suppression rows + 4 soft-fail rows)"
    - "CONTRIBUTING.md (~90 lines)"
    - "SECURITY.md (~210 lines, 3 populated + 8 stub sections + posture statement)"
    - "docs/evidence/branch-protection-screenshot.png (71 KB)"
    - "docs/evidence/socket-install.png (2.2 MB)"
  modified: []

key-decisions:
  - "D-08 honoured: phase-4-cleanup-ledger.md populated row-by-row from live git grep at bc585c6 — not deferred, not a placeholder. 16 suppression rows (14 eslint + 2 @ts-nocheck) all carry file:line, rule, intended fix, closure phase."
  - "D-12 honoured: branch-protection-bootstrap.md exists; Wave 5 Task 4 EXECUTED via Repository Rulesets path (modern equivalent of classic gh api PUT). Pitfall A respected — applied AFTER first green CI run #25317482833 registered the 5 status-check names."
  - "D-17 honoured: CONTRIBUTING.md documents gitleaks local install for macOS (brew), Windows (scoop), Linux (releases page) — contributors can run the pre-commit hook end-to-end."
  - "D-19 honoured (cross-wave): Dependabot auto-merge OFF (Wave 4 commit) + SECURITY.md § Dependency Monitoring narrative documents the human-review compliance posture."
  - "D-22 honoured: Socket.dev GitHub App installed via UI; evidence captured in docs/evidence/socket-install.png. TOOL-11 closed."
  - "D-23 honoured: firebase-oidc-bootstrap.md committed as documentation only — Phase 3 executes the gcloud commands."
  - "D-24 honoured: SECURITY.md three populated sections (Build & Supply Chain / Dependency Monitoring / Secret Scanning) + 8 later-phase stubs + 'credible, not certified' posture statement."
  - "D-25 honoured: SECURITY.md atomic-commit close — the create commit ships the audit narrative for the three populated sections. Subsequent phases will append (not overwrite) per the D-25 pattern."
  - "D-30 honoured: tests/smoke.test.js exists and `npm test` exits 0 (one passing test). Phase 2 will populate with TEST-01..07 + TEST-10."
  - "D-31 honoured: types/globals.d.ts exists (from Wave 1) + checkJs gates lint failures via tsconfig.json."
  - "Pitfall A honoured: branch protection applied AFTER first green CI run. The status-check name correction (lowercase YAML keys → rendered display names) was caught and documented in branch-protection-bootstrap.md before the runbook executed."
  - "Pitfall 19 honoured: SECURITY.md ships with eight later-phase stubs (Authentication, Authorization, Audit Logging, Data Lifecycle, Backup & DR, Observability, CSP & Headers, Threat Model) so each downstream phase has a known append-target — no Phase 11 documentation cliff."

patterns-established:
  - "Cleanup-ledger rebuild pattern: future phases that introduce new suppressions add rows; Phase 4 closes them via per-module rewrite. The git grep enumeration is the source of truth and can be re-run at any time to verify the ledger remains exhaustive."
  - "Plan-content vs runtime-fact reconciliation: when plan content (e.g., repo path, exact API arg names) doesn't match runtime reality (e.g., actual repo owner, registered check-run names), the executor corrects the plan-derived artefact AND documents the deviation in SUMMARY. This prevents downstream phases from inheriting stale plan-time assumptions."
  - "Modern Rulesets vs classic Branch Protection: GitHub now defaults UI clicks to the Rulesets path; classic /branches/{branch}/protection API returns 404 when only a Ruleset is configured. /branches/{branch} (no /protection) is the unified read endpoint that surfaces both flavours. Document this for future runbook executions."

requirements-completed: [TOOL-08, TOOL-09, TOOL-11, DOC-10]

# Metrics
duration: ~25 min Wave 5 work (runbooks + CONTRIBUTING + SECURITY) + ~30 min user-action checkpoints (branch protection click-through + Socket.dev install) + ~3 min final clean-clone gauntlet
completed: 2026-05-04
checkpoint_pending: false
---

# Phase 01 Plan 06: Wave 5 — Documentation Pack + Operational Hardening Summary

**Phase 1's audit narrative + operational runbooks land. SECURITY.md (DOC-10) ships with three populated sections (Build & Supply Chain / Dependency Monitoring / Secret Scanning) — each evidenced and framework-cited (OWASP ASVS L2 / ISO 27001:2022 / SOC 2 / GDPR Art. 32). Four runbooks (firebase-oidc-bootstrap, branch-protection-bootstrap, socket-bootstrap, phase-4-cleanup-ledger) document one-shot operational steps. CONTRIBUTING.md unblocks new contributors for the gitleaks pre-commit hook. Branch protection on `main` is APPLIED via Repository Rulesets (gated by Pitfall A: only after Wave 3's first green CI run #25317482833 registered the 5 status-check names). Socket.dev GitHub App installed at the BeDeveloped org level. Phase 1 is complete.**

## Performance

- **Started:** 2026-05-04 (immediately after Wave 4 / Plan 01-05 push)
- **Completed:** 2026-05-04
- **Duration:** ~25 min Wave 5 work + ~30 min user-action checkpoints + ~3 min final gauntlet
- **Tasks complete:** 4 / 4 (Tasks 1, 2 inline; Tasks 3, 4 as user-driven checkpoints)
- **Commits:** 4 (Wave 5 specific) + 1 (Wave 3 smoke-test pull-forward at 56eee56) + 3 evidence/tracking commits
- **Files created:** 9 (1 test pulled forward + 4 runbooks + CONTRIBUTING.md + SECURITY.md + 2 evidence screenshots)

## Wave 5 Commit Trail

| # | SHA | Subject | Wave 5 Task |
|---|-----|---------|-------------|
| 1 | `56eee56` | feat(01-06): pull forward smoke test to unblock Wave 3 CI checkpoint | Task 1 Step 1 (pulled forward) |
| 2 | `4ce04a8` | feat(01-06): add 4 runbooks (smoke test was pulled forward in Wave 3 fix) | Task 1 Steps 2-5 |
| 3 | `542fee6` | feat(01-06): add CONTRIBUTING.md + SECURITY.md (DOC-10 atomic close) | Task 2 |
| 4 | `0acfe85` | docs(01-06): add branch-protection evidence (TOOL-08, TOOL-09) | Task 4 |
| 5 | `41c634e` | docs(01-06): add Socket.dev install evidence (TOOL-11) | Task 3 |

## Accomplishments

### Task 1 — Smoke test + 4 runbooks

- **`tests/smoke.test.js`** — already committed in commit `56eee56` (Wave 3 fix iteration). Vitest 4.x exits 1 on no-tests; the smoke test was pulled forward from this Wave 5 plan as the cleanest unblocker. `npm test` now passes 1/1.
- **`runbooks/firebase-oidc-bootstrap.md`** — 6-step gcloud Workload Identity Pool + OIDC Provider setup for Phase 3's Firebase Hosting deploy. Documentation only in Phase 1 (D-23). Path corrected to `lukebadiali/base-layers-diagnostic` (deviation documented).
- **`runbooks/branch-protection-bootstrap.md`** — `gh api PUT` payload with the **status-check name correction**: rendered job names (`Lint`, `Typecheck`, `Test`, `Security Audit`, `Build`) instead of lowercase YAML keys. GitHub's required-status-checks API matches the strings shown in the Checks UI, not the YAML keys. The correction was made BEFORE the runbook executed, so no lock-out risk materialised.
- **`runbooks/socket-bootstrap.md`** — 5 UI steps for Socket.dev GitHub App install. No CLI/API path exists per Phase 1 scope; UI click-through is the only mechanism (D-22).
- **`runbooks/phase-4-cleanup-ledger.md`** — populated row-by-row from live `git grep` at `bc585c6`:
  - 14 `eslint-disable-next-line` rows (all in `app.js` — none in `firebase-init.js` or `data/pillars.js`)
  - 2 `@ts-nocheck` rows (`app.js:1`, `firebase-init.js:1`)
  - 4 out-of-band soft-fail entries (OSV `continue-on-error: true`, `no-restricted-imports` "warn", grandfathered `INTERNAL_PASSWORD_HASH`, gitleaks-action Node 20 deprecation)

### Task 2 — CONTRIBUTING.md + SECURITY.md (DOC-10 atomic close)

- **`CONTRIBUTING.md`** — local dev setup with platform-specific install instructions (macOS/Windows/Linux for Node, gitleaks, gh CLI). Documents `npm ci`, daily commands, pre-commit hook flow, Conventional Commits, branch-protection expectations, vulnerability disclosure pointer.
- **`SECURITY.md`** — three populated sections, each with **Control / Evidence / Framework citations** triad:
  - **§ Build & Supply Chain** — pinned versions + lockfile + hashed bundles + CI build verification. Citations: ASVS V14.4.2 + V14.2.1, ISO 27001 A.8.25 + A.8.28, SOC 2 CC8.1.
  - **§ Dependency Monitoring** — pinned + Dependabot weekly + Socket.dev install-time + OSV-Scanner + npm audit (4 layers). Citations: ASVS V14.2.1 + V14.2.4, ISO 27001 A.8.8 + A.8.30, SOC 2 CC8.1, GDPR Art. 32(1)(d).
  - **§ Secret Scanning** — gitleaks pre-commit + CI backstop with `fetch-depth: 0` + custom `sha256-hex-literal-regression` rule + grandfathered `INTERNAL_PASSWORD_HASH` (Phase 6 AUTH-14 closes). Citations: ASVS V14.3.2, ISO 27001 A.10.1, SOC 2 CC6.1, GDPR Art. 32(1)(a).
  - **8 later-phase stubs**: Authentication & MFA (Phase 6), Authorization & Tenant Isolation (Phases 5+6), Audit Logging (Phases 7+9), Data Lifecycle & GDPR (Phase 8), Backup & DR (Phase 8), Observability (Phase 9), CSP & Headers (Phases 3+10), Threat Model (Phase 11) — Pitfall 19 prevention.
  - **Compliance posture statement**: "credible, not certified" — explicit Pitfall-19 firewall against false-certification claims.

### Task 3 — Socket.dev GitHub App install (user-action checkpoint)

- App installed at the BeDeveloped Socket.dev org level via UI.
- Evidence: `docs/evidence/socket-install.png` (2.2 MB) — dashboard view showing BeDeveloped org active.
- **Status at install time**: 0 repositories scanned (expected; Socket.dev's initial scan populates over the following minutes-to-hours). Per-repo "Socket Security" check appearance on commits/PRs is a soft follow-up; if it doesn't materialise within a few days, capture a second screenshot and close as a Phase 1.1 polish item.
- TOOL-11 closed.

### Task 4 — Branch protection (user-action checkpoint, Pitfall A)

- Applied via the **Repository Rulesets path** (modern equivalent of classic `gh api PUT`), executed from Luke's owner session in the browser.
- **Effective protection** (verified via `gh api repos/lukebadiali/base-layers-diagnostic/branches/main`):
  - `protected: true`
  - `required_status_checks.contexts`: `["Lint", "Typecheck", "Test", "Security Audit", "Build"]` ✓ (all 5)
  - `enforcement_level: "non_admins"` (admin retains emergency rollback — matches the runbook's `enforce_admins=false`)
  - 1 required approving review + dismiss-stale + linear history (configured via Ruleset; not surfaced in the legacy `/branches/main` JSON projection)
  - `allow_force_pushes: false`
  - `allow_deletions: false`
- Evidence: `docs/evidence/branch-protection-screenshot.png` (71 KB) — Settings → Branch rules page showing the rule with all 5 required contexts.
- TOOL-08 + TOOL-09 closed.
- **Pitfall A respected**: applied AFTER Wave 3's first green CI run #25317482833 registered the 5 status-check names. The status-check name correction (lowercase YAML keys → rendered display names) was caught BEFORE runbook execution, eliminating lock-out risk.

## Final Phase 1 Verification Gauntlet

Run on a clean clone simulation (`rm -rf node_modules && npm ci`) at 2026-05-04 17:16 UTC:

```sh
$ npm ci
141 packages are looking for funding
4 moderate severity vulnerabilities  ← non-blocking; CI gate is high+

$ npm audit --audit-level=high --omit=dev
found 0 vulnerabilities  ← matches CI's audit job exit 0

$ npm run lint
> base-layers-diagnostic@0.1.0 lint
> eslint . --max-warnings=0
EXIT: 0  ← clean

$ npm run typecheck
> base-layers-diagnostic@0.1.0 typecheck
> tsc --noEmit
EXIT: 0  ← clean

$ npm test
 Test Files  1 passed (1)
      Tests  1 passed (1)
   Duration  1.76s
EXIT: 0

$ npm run build
> base-layers-diagnostic@0.1.0 build
> vite build
✓ 5 modules transformed.
dist/index.html                 1.19 kB
dist/assets/logo-Dq8JoGF5.png  65.84 kB
dist/assets/main-UhxH0Ugg.css  37.73 kB
dist/assets/main-BtavOejk.js    2.20 kB
✓ built in 119ms
EXIT: 0

$ ls dist/assets/main-BtavOejk.js | grep -E '\-[A-Za-z0-9_-]{8,}\.js$'
dist/assets/main-BtavOejk.js  ← hashed bundle present
```

All four gates exit 0 on clean install + the hashed-filename `dist/assets/main-BtavOejk.js` exists. **Phase 1 success criterion #1 is verified end-to-end.**

## Phase 1 Success Criteria — Final Status

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | `npm test`, `npm run lint`, `npm run typecheck`, `npm run build` all run locally and pass on a clean clone | ✓ verified | Final gauntlet output above (run 2026-05-04 17:16 UTC) |
| 2 | Every PR runs lint + typecheck + Vitest + npm audit + OSV-Scanner + build with all third-party Actions SHA-pinned | ✓ verified | CI runs #25317275925 (initial fail), #25317482833 (first green), #25318104064 (Wave 5 push green); all 15+ uses: lines reference 40-char SHAs |
| 3 | Adding `Math.random()` or `innerHTML =` to a tracked source file fails CI via ESLint | ✓ verified | Wave 1 synthetic probes (`01-02-SUMMARY.md`); ESLint flat config blocks reintroduction |
| 4 | Adding a new committed file containing the C2 hash shape fails CI via gitleaks | ✓ verified | Wave 2 synthetic probe (`01-03-SUMMARY.md`) — committing the literal C2 hash shape was BLOCKED by the pre-commit hook |
| 5 | Dependabot opens weekly PRs against `npm` + `github-actions` ecosystems | ✓ on track | `.github/dependabot.yml` is on `origin/main` (commit `e4806a2`); first scheduled run window 2026-05-04 → 2026-05-11 |
| 6 | Vite production build outputs hashed-filename bundles in `dist/`, replacing `?v=46` | ✓ verified | `dist/assets/main-BtavOejk.js`, `main-UhxH0Ugg.css`, `logo-Dq8JoGF5.png` (URL-safe base64 hashes); `index.html` references hashed paths; no `?v=46` query strings |

**6/6 success criteria verified or on-track.** Phase 1 is complete.

## Decisions Made

None outside what the plan specified — every load-bearing decision (D-08, D-12, D-17, D-19, D-22, D-23, D-24, D-25, D-30, D-31; Pitfalls A, 19) was honoured exactly. Two corrections WERE made during execution and documented:

1. **Repo path**: plan referenced `AssumeAIhugh/base-layers-diagnostic`; actual repo is `lukebadiali/base-layers-diagnostic`. All runbooks + CONTRIBUTING.md + SECURITY.md use the actual path.
2. **Status-check context names**: plan's branch-protection payload used lowercase YAML keys (`lint`, `typecheck`, `test`, `audit`, `build`); GitHub registers contexts using rendered job display names (`Lint`, `Typecheck`, `Test`, `Security Audit`, `Build`). The runbook was corrected before execution.

## Deviations from Plan

**Two deviations, both documented above:**

1. **Smoke test pulled forward** — `tests/smoke.test.js` was committed in `56eee56` during the Wave 3 fix iteration (rather than waiting for Wave 5 Task 1 Step 1). Reason: Vitest 4.x exits 1 on no-tests, blocking Wave 3's CI checkpoint. Pulling forward was the cleanest unblocker because it preserves the Phase 2 sequencing constraint ("a real test exists; future phases extend it").
2. **Branch protection applied via Rulesets** — plan specified the classic `gh api PUT /branches/main/protection` runbook; actual application used the Repository Rulesets UI path (Settings → Branch rules → Add classic branch protection rule, which on this account routes to a Rulesets-style form). The effective protection is identical (verified via `/branches/main` API) — both classic Branch Protection and Rulesets surface the same `protected: true` state. Documented as a pattern in `patterns-established`.

Both deviations are LOWER risk than the plan's prescribed paths and improve robustness rather than degrade it.

## Issues Encountered

- **Permission scope discovery**: AssumeAIhugh holds Write/Triage/Pull on `lukebadiali/base-layers-diagnostic` but NOT admin/maintain. Branch protection requires admin. Resolved by Hugh executing the Rulesets UI flow from Luke's owner session in the browser. No automation wrinkle remains — future branch-protection updates require either admin promotion or running the runbook from an admin account.
- **GitHub Pages workflow check-name collision**: the legacy GH Pages workflow registers lowercase `build`, `deploy`, and `report-build-status` checks. Our branch protection's required `Build` (capital B) does NOT collide with these because GitHub treats check names as case-sensitive. The runbook's status-check name correction note explicitly warns against picking the lowercase `build` from the search dropdown. Phase 3 (Hosting Cutover) removes the GH Pages workflow entirely, eliminating this footgun.
- **Socket.dev initial scan latency**: at install time, the BeDeveloped Socket.dev dashboard showed 0 repositories scanned. Expected — Socket.dev's first scan populates over the following minutes-to-hours. Per-repo "Socket Security" check appearance on commits/PRs is a soft follow-up. Captured as a Phase 1.1 polish item if not visible by 2026-05-07.
- **CRLF warnings on `git add`**: standard Git-on-Windows behaviour for files committed with LF in the index. No action required — GitHub Actions runners on `ubuntu-latest` check files out as LF.

## User Setup Required

**Already completed during execution:**

1. ✓ Branch protection on `main` (executed by Hugh from Luke's owner session)
2. ✓ Socket.dev GitHub App install (executed by Hugh from BeDeveloped Socket.dev account)

**Still pending (NOT Phase 1 blockers):**

- Verify "Socket Security" check appears on a future commit/PR within 1-3 days. If not, capture another screenshot or treat as a Phase 1.1 polish item.
- Optional: review the four moderate dev-dep severities surfaced by `npm ci` and decide whether to upgrade or defer. CI gate is `high` so they don't block, but they're trackable.

## Next Phase Readiness

- **Phase 2 (Test Suite Foundation)** is unblocked. Vitest infrastructure exists; the smoke test (`tests/smoke.test.js`) is the single passing test that Phase 2 expands into TEST-01..07 + TEST-10 coverage. Sequencing non-negotiable #1 (tests-first before modular split) is now armable: Phase 2 → Phase 4.
- **Phase 3 (Hosting Cutover)** can reference `runbooks/firebase-oidc-bootstrap.md` to provision the gcloud Workload Identity Pool + bind to the deploy SA. The 6 steps in the runbook are turnkey.
- **Phase 4 (Modular Split)** has a closure target: `runbooks/phase-4-cleanup-ledger.md` enumerates 16 rows. The ledger empties to zero rows when Phase 4 is complete.
- **Phase 6 (Real Auth + MFA)** has a closure target for the grandfathered `INTERNAL_PASSWORD_HASH` finding (referenced in `SECURITY.md` § Secret Scanning under "Known gap (grandfathered)" and tracked in the cleanup ledger's "Out-of-band soft-fail entries" table).

## Threat Model Compliance

- **T-1-01 (Tampering / Supply Chain)** — `mitigate (final layer)` honoured: Socket.dev install adds install-time behavioural detection on top of Wave 3 (npm audit + OSV-Scanner) and Wave 4 (Dependabot weekly). Branch protection (Task 4) prevents merging without these checks. ASVS V14.2.1, V14.2.4. ISO 27001 A.8.8, A.8.30. SOC 2 CC8.1.
- **T-1-04 (Tampering / CI Action Substitution)** — `mitigate (final layer)` honoured: branch protection requires the `Security Audit` job to pass before merge — meaning a malicious PR that re-points an Action SHA to a compromised version would fail SHA grep validation OR fail OSV-Scanner. Plus Dependabot github-actions ecosystem keeps SHAs current. ASVS V14.2.5. ISO 27001 A.8.31.
- **T-1-02, T-1-03, T-1-05** — `document` honoured: SECURITY.md catalogues each closure with framework citations so the milestone has an audit narrative (DOC-10 — Pitfall 19 prevention).
- **T-1-Wave5-01 (Repudiation — `main` branch protection)** — `mitigate` honoured: branch protection prevents force-push (`allow_force_pushes=false`) and direct push (PRs only via `required_status_checks[strict]=true`), preserving the CI evidence trail. ASVS V8.3.1. ISO 27001 A.8.31. SOC 2 CC8.1. Evidence: `docs/evidence/branch-protection-screenshot.png`.

No new threat surface introduced.

## Known Stubs

None in shipped artefacts. The 8 SECURITY.md later-phase sections are intentional stubs (Pitfall 19 prevention) — they will be filled by their owning phases via D-25 atomic-commit pattern.

## TDD Gate Compliance

This plan is `type: execute`, not `type: tdd`. The smoke test was test-first by construction (the test was committed in commit `56eee56` and immediately verified to pass), but the TDD RED/GREEN/REFACTOR triad is not formally required.

## Self-Check: PASSED

Files exist:

- `tests/smoke.test.js` — FOUND (committed 56eee56)
- `runbooks/firebase-oidc-bootstrap.md` — FOUND
- `runbooks/branch-protection-bootstrap.md` — FOUND
- `runbooks/socket-bootstrap.md` — FOUND
- `runbooks/phase-4-cleanup-ledger.md` — FOUND
- `CONTRIBUTING.md` — FOUND (at repo root)
- `SECURITY.md` — FOUND (at repo root)
- `docs/evidence/branch-protection-screenshot.png` — FOUND
- `docs/evidence/socket-install.png` — FOUND

Commits exist (verified via `git log --oneline 56eee56..HEAD`):

- `56eee56` (smoke test pull-forward) — FOUND
- `4ce04a8` (4 runbooks) — FOUND
- `542fee6` (CONTRIBUTING + SECURITY) — FOUND
- `0acfe85` (branch-protection evidence) — FOUND
- `41c634e` (Socket.dev evidence) — FOUND

Plan-level verification block (every check from the plan's `<verification>` block):

- `test -f tests/smoke.test.js` — PASS
- `test -f runbooks/phase-4-cleanup-ledger.md` — PASS
- `test -f runbooks/branch-protection-bootstrap.md` — PASS
- `test -f runbooks/firebase-oidc-bootstrap.md` — PASS
- `test -f runbooks/socket-bootstrap.md` — PASS
- `test -f CONTRIBUTING.md` — PASS
- `test -f SECURITY.md` — PASS
- `test -f docs/evidence/socket-install.png` — PASS
- `test -f docs/evidence/branch-protection-screenshot.png` — PASS
- `npm test` exits 0 — PASS (1 test passed)
- `grep '## § Build & Supply Chain' SECURITY.md` — PASS
- `grep '## § Dependency Monitoring' SECURITY.md` — PASS
- `grep '## § Secret Scanning' SECURITY.md` — PASS
- `grep 'OWASP ASVS' SECURITY.md` — PASS
- Branch protection contexts.length == 5 (verified via `/branches/main` API) — PASS
- Final clean-clone gauntlet (npm ci + lint + typecheck + test + build) — ALL PASS
- `ls dist/assets/*.js | grep -E '\-[A-Za-z0-9_-]{8,}\.js$'` — PASS (`main-BtavOejk.js`)

Plan-level success criteria (11 criteria from plan `<success_criteria>` block):

1. Smoke test exists and passes — PASS
2. Four runbooks exist with concrete content — PASS
3. phase-4-cleanup-ledger.md enumerates every Phase 1 suppression — PASS (16 rows)
4. CONTRIBUTING.md documents gitleaks local install + dev workflow — PASS
5. SECURITY.md three populated sections evidenced + framework-cited — PASS
6. SECURITY.md eight later-phase stubs (Pitfall 19) — PASS
7. SECURITY.md "credible, not certified" posture statement — PASS
8. Socket.dev installed; evidence at docs/evidence/socket-install.png — PASS
9. Branch protection on main APPLIED after first green CI; evidence at docs/evidence/branch-protection-screenshot.png — PASS
10. Final clean-clone gauntlet passes — PASS
11. Phase 1 success criteria 1, 2, 3, 4, 6 evidenced; #5 on track — PASS

---

_Phase: 01-engineering-foundation-tooling_
_Plan: 06 (Wave 5 — Documentation Pack + Operational Hardening)_
_Status: Complete — Phase 1 close pending verifier sign-off_
_Summary committed: 2026-05-04_
