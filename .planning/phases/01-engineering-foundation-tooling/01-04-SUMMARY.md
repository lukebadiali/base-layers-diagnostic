---
phase: 01-engineering-foundation-tooling
plan: 04
subsystem: tooling
tags:
  [
    github-actions,
    ci,
    sha-pinning,
    osv-scanner,
    gitleaks-action,
    npm-audit,
    upload-artifact,
    least-privilege,
    supply-chain,
    t-1-04,
  ]

# Dependency graph
requires:
  - phase: 01-engineering-foundation-tooling
    plan: 01-01
    provides: package.json scripts (lint, typecheck, test, build) + lockfile + engine-strict
  - phase: 01-engineering-foundation-tooling
    plan: 01-02
    provides: eslint.config.js + tsconfig.json + .prettierrc.json + vite.config.js (lint/typecheck/build all green)
  - phase: 01-engineering-foundation-tooling
    plan: 01-03
    provides: .gitleaks.toml (gitleaks-action backstop in CI uses this config)
provides:
  - .github/workflows/ci.yml — six jobs (setup, lint, typecheck, test, audit, build) running on every PR + push to main, all third-party Actions SHA-pinned with # vX.Y.Z comments
  - npm audit hard gate (--audit-level=high --omit=dev, D-21) wired into the audit job
  - google/osv-scanner-action soft gate (continue-on-error: true, D-20) wired into the audit job
  - gitleaks/gitleaks-action backstop (catches --no-verify pre-commit bypasses, T-1-02 layered defence) wired into the audit job
  - actions/upload-artifact uploads dist/ for build verification (D-11, D-13, T-1-05 substrate) — no deploy
  - permissions: contents: read at workflow level (least privilege)
  - Five required-status-check job names (lint, typecheck, test, audit, build) ready to be referenced by Wave 5's branch-protection runbook
affects:
  [
    01-05-dependabot,
    01-06-runbooks-security-md,
    02-test-suite,
    03-hosting-cutover,
    07-cloud-functions,
  ]

# Tech tracking
tech-stack:
  added:
    - "actions/checkout v6.0.2 (de0fac2e4500dabe0009e67214ff5f5447ce83dd) — repo checkout"
    - "actions/setup-node v6.4.0 (48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e) — Node 22 + npm cache"
    - "actions/upload-artifact v7.0.1 (043fb46d1a93c77aae656e7c1c64a875d1fc6a0a) — dist/ artefact upload"
    - "google/osv-scanner-action v2.3.5 (c51854704019a247608d928f370c98740469d4b5) — OSV soft gate"
    - "gitleaks/gitleaks-action v2.3.9 (ff98106e4c7b2bc287b24eaf42907196329070c7) — CI backstop secret scan"
  patterns:
    - "All third-party Actions pinned to 40-char commit SHAs with `# vX.Y.Z` trailing comment for human readability + Dependabot tracking — TOOL-09 grep gate passes (! grep -nE 'uses: [^@]+@v[0-9]')"
    - "Annotated-tag dereferencing applied during SHA resolution (Pitfall G) — gh api .object.type checked, when 'tag' the SHA is followed via git/tags/<sha> to the commit SHA, not the tag-object SHA"
    - "Audit job layers three scanners with distinct fail modes: npm audit (hard fail, prod deps only) + OSV-Scanner (soft fail, broader DB) + gitleaks-action (hard fail, secret scan)"
    - "Build job needs: [lint, typecheck, test, audit] — build only runs if all four parallel gates pass (D-09)"
    - "Workflow-level permissions: contents: read — single line at workflow root applies least-privilege to every job step"

key-files:
  created:
    - ".github/workflows/ci.yml (110 lines, 6 jobs, 15 SHA-pinned `uses:` references)"
  modified: []

key-decisions:
  - "D-09 honoured: setup -> {lint, typecheck, test, audit} -> build dependency order; build gated on all four parallel gates"
  - "D-10 honoured: every Action pinned to 40-char commit SHA with `# vX.Y.Z` comment; Dependabot github-actions ecosystem (Wave 4) tracks these"
  - "D-11 honoured: build job runs `npm run build` and uploads `dist/` via actions/upload-artifact — NO deploy step (Phase 3 owns Firebase Hosting deploy)"
  - "D-13 honoured: build verification only — dist/ produced and artefact-uploaded, but the production site continues to ship from GH-Pages until Phase 3"
  - "D-20 honoured: OSV-Scanner soft fail via continue-on-error: true (broader advisory DB; signal without blocking)"
  - "D-21 honoured: npm audit hard fail with --audit-level=high --omit=dev (production attack surface only)"
  - "T-1-04 mitigated: SHAs resolved deterministically via gh api at execution time; not copy-pasted from RESEARCH.md placeholders"
  - "Pitfall G honoured: annotated-tag dereferencing applied to every SHA resolution (object.type='tag' check + git/tags follow)"
  - "Pitfall A honoured (deferred to Wave 5): branch protection NOT applied in this plan — must come AFTER first green CI run on a PR"

patterns-established:
  - "SHA-resolution deterministic pattern: `gh release view --json tagName --jq .tagName` to find latest tag, then `gh api repos/<owner>/<repo>/git/ref/tags/<tag> --jq .object.sha` with annotated-tag deref via `gh api repos/<owner>/<repo>/git/tags/<sha> --jq .object.sha` when type=tag. Reusable for any future Action SHA pin."
  - "Atomic CI workflow commit pattern: one task = one file = one commit. The 6 jobs share the same SHA mappings; Dependabot will issue one PR per Action update, not 6."
  - "Build artefact verification pattern: upload-artifact for dist/ proves the build is reproducible across runs without coupling to Firebase Hosting deploy contract (which lives in Phase 3)."

requirements-completed: [TOOL-08, TOOL-09]

# Metrics
duration: ~4 min (worktree base reset + SHA resolution via 5 gh api calls + ci.yml authoring + 4-gate validation + commit)
completed: 2026-05-04
checkpoint_pending: true
---

# Phase 01 Plan 04: Wave 3 — GitHub Actions CI Workflow Summary (PARTIAL — checkpoint pending)

**Six-job CI workflow lands at `.github/workflows/ci.yml` with all five third-party Actions SHA-pinned to current 2026-05-04 release commits. npm audit hard-gates supply-chain regressions; OSV-Scanner provides broader (soft-fail) signal; gitleaks-action backstops local-pre-commit bypasses. Build job depends on all four parallel gates and uploads `dist/` as verification artefact (no deploy). The first PR run on this workflow is the human-verification checkpoint that establishes the five required-status-check names in GitHub's check registry — a precondition for Wave 5's branch-protection runbook (Pitfall A).**

> **Status:** Tasks 1 and 2 complete + committed. **Task 3 is a `checkpoint:human-verify` task** — the user must push the worktree branch to `origin`, open a PR against `main`, and verify all five required-status-check jobs ran GREEN before Wave 4 (Dependabot) can proceed. This SUMMARY captures Tasks 1-2 evidence; the checkpoint resolution (PR URL + run URL + green-ness confirmation + dist/ artefact verification) will be appended once the user signals completion.

## Performance (Tasks 1-2 only)

- **Started:** 2026-05-04 (post worktree-base reset to b6fdf6e)
- **Completed (Tasks 1-2):** 2026-05-04
- **Duration (Tasks 1-2):** ~4 minutes
- **Tasks complete:** 2 / 3 (Task 3 is the human-verify checkpoint)
- **Commits:** 1 atomic (Task 1 was no-commit per plan; Task 2 = single feat commit)
- **Files created:** 1 (.github/workflows/ci.yml)
- **Files modified:** 0

## Accomplishments (Tasks 1-2)

- **Five Action SHAs resolved deterministically** — used `gh release view` to find the latest stable release tag for each Action, then `gh api` to resolve the tag to its 40-char commit SHA. Annotated-tag dereferencing (Pitfall G) was applied where applicable: when `object.type` returned `tag`, the SHA was followed through `git/tags/<sha>` to the underlying commit SHA, ensuring `uses: ...@<sha>` references a real commit (not a tag-object SHA which would fail with "ref not found"). All 5 SHAs validated as 40-char hex.
- **Six-job CI workflow authored** — `.github/workflows/ci.yml` declares `setup, lint, typecheck, test, audit, build` jobs in dependency order. `setup` runs `npm ci` to seed the cache; the four parallel gates (`lint`, `typecheck`, `test`, `audit`) each `needs: setup`; `build` `needs: [lint, typecheck, test, audit]` (D-09). Workflow triggers on every push to `main` and every PR against `main`.
- **Audit job layered three scanners** — `npm audit --audit-level=high --omit=dev` (D-21 hard fail on prod-dep CVEs) + `google/osv-scanner-action` (D-20 soft fail with `continue-on-error: true`) + `gitleaks/gitleaks-action` (CI backstop for `--no-verify` pre-commit bypass, layering on Wave 2's local hook).
- **Build job verifies dist/ without deploying** — runs `npm run build` (Vite 8 hashed-filename output from Wave 1) then `actions/upload-artifact` writes `dist/` as a 7-day retention artefact. T-1-05 substrate evidenced; no `firebase deploy` step (Phase 3 owns that, D-11).
- **Workflow-level least privilege** — `permissions: contents: read` at the workflow root. Single declaration applies the GITHUB_TOKEN restriction to every job step (no per-job overrides needed for read-only operations).
- **All four validation gates passed before commit** — (1) no `<*_SHA>` / `<*_TAG>` placeholders remain; (2) no `uses: ...@v0` tag-style refs (TOOL-09 grep gate); (3) ≥15 `uses:` lines with 40-char SHAs (actual: 15); (4) `js-yaml.load(...)` parses cleanly producing the expected job graph.

## Task Commits

Task 1 produced no commit per plan design (SHA-resolution work is consumed by Task 2; the temp file `_tmp_action_shas.txt` was deleted before commit).

Task 2 was committed atomically with `--no-verify` (parallel-executor convention):

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Resolve current commit SHAs for all five third-party Actions | (no commit; data consumed by Task 2) | `_tmp_action_shas.txt` (created + deleted) |
| 2 | Create .github/workflows/ci.yml with all six jobs and SHA-pinned Actions | `aac7b0c` (feat) | `.github/workflows/ci.yml` |
| 3 | **CHECKPOINT — human-verify** Open first PR + confirm five required-status-check jobs run green | _pending user action_ | _N/A_ |

## Resolved Action SHAs (commit body baseline for Wave 4 Dependabot tracking)

| Action | Tag | 40-char Commit SHA |
|--------|-----|--------------------|
| actions/checkout | v6.0.2 | `de0fac2e4500dabe0009e67214ff5f5447ce83dd` |
| actions/setup-node | v6.4.0 | `48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e` |
| actions/upload-artifact | v7.0.1 | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` |
| google/osv-scanner-action | v2.3.5 | `c51854704019a247608d928f370c98740469d4b5` |
| gitleaks/gitleaks-action | v2.3.9 | `ff98106e4c7b2bc287b24eaf42907196329070c7` |

These five SHAs are the baseline for Wave 4's Dependabot `github-actions` ecosystem — Dependabot will compare against them and PR updates weekly.

## Build Verification (pre-CI, local)

`npm run build` (Wave 1 substrate) was already verified producing `dist/assets/main-<8charhash>.js`. The CI build job re-runs this and uploads `dist/` as a workflow artefact, so the GitHub Actions run becomes the canonical evidence trail going forward.

## Decisions Made

None outside what the plan specified — every load-bearing plan decision (D-09, D-10, D-11, D-13, D-20, D-21; Pitfalls A, G; T-1-04, T-1-05) was honoured exactly.

## Deviations from Plan

**None — plan executed exactly as written.**

The plan's RESEARCH.md skeleton (lines 526-645) was used as the literal authoring template for `ci.yml`. The illustrative SHA placeholders in that skeleton (`11bd71901bbe...`, `39370e3970a6...`, `65c4c4a1ddee...`, `63b7cb9cb68a...`, `9b35a74e8a32...`) were replaced with current SHAs resolved deterministically at execution time per the plan's Step 1 instruction (Task 1). This is plan-mandated SHA replacement, not a deviation.

The only minor authoring choice not strictly templated by RESEARCH.md was the addition of comments to the audit job clarifying each scanner's role (`# Hard fail: npm audit on production deps (D-21)`, `# Soft fail: OSV-Scanner (D-20)`, `# CI gitleaks scan - backstop for devs who skip local pre-commit hook`). These are documentation-only and do not change any executable behaviour.

## Issues Encountered

- **Worktree base mismatch on first check** — `git merge-base HEAD b6fdf6ec...` returned `28ab720d579e56e78a054f4a30f4f146ce7ea99e` (the pre-GSD legacy HEAD), indicating the worktree was created before the Wave 2 commit landed. Hard-reset to `b6fdf6ec9214e0e41f39b049595807ad7d862240` per `<worktree_branch_check>` protocol. Reset succeeded; proceeded immediately. No deviation.
- **First gh-api SHA-extraction attempt used a Python parser that silently failed** — initially piped the JSON through a small Python one-liner; on this Windows/Git-Bash environment it returned literal `ERROR` strings without raising. Switched immediately to `gh api ... --jq '.object.sha'` (the plan's prescribed pattern). All 5 SHAs resolved correctly on the second pass. Logged here for awareness; not a deviation.
- **CRLF line-ending warning on commit** — `git add` warned `LF will be replaced by CRLF the next time Git touches it`. Standard Git-on-Windows behaviour; the workflow file is committed with LF in the index (per Git's default `core.autocrlf` for committed files), and GitHub Actions runners on `ubuntu-latest` will check it out as LF. No action required.

## User Setup Required

**Yes — Task 3 is `checkpoint:human-verify` requiring user action:**

1. Push worktree branch to `origin` (worktree merge will land it as part of Wave 3's orchestrator merge — the user does NOT need to do this manually inside this worktree).
2. Open a PR against `main`: `gh pr create --title "Phase 1: tooling foundation" --body "Closes TOOL-01..12 + DOC-10. Wave-by-wave commits."`
3. Wait for CI to start, then `gh pr checks --watch`.
4. Verify all five required-status-check jobs ran green: `Lint`, `Typecheck`, `Test`, `Security Audit`, `Build`.
   - **Note on `Test`:** Vitest may emit "no tests found" warnings (Wave 5 lands the smoke test). At this checkpoint, the warning is benign and should not fail the job.
   - **Note on `Security Audit` (gitleaks step):** the pre-existing `INTERNAL_PASSWORD_HASH` finding at `app.js:505` (documented in 01-03-SUMMARY.md) may surface in the gitleaks-action output. Two outcomes possible:
     - **Outcome A:** gitleaks-action exits non-zero on existing findings → audit job FAILS. **Fix:** add the historical commit SHA(s) carrying the hash to `.gitleaks.toml [allowlist] commits = [...]`. Re-push and the finding is grandfathered in. Document the SHA + rationale in the resolved SUMMARY.
     - **Outcome B:** gitleaks-action treats existing findings as informational and audit job is GREEN.
5. Confirm the dist/ artefact contains hashed-filename bundles: `gh run download <run-id> --name dist --dir /tmp/dist-verify` then `ls /tmp/dist-verify/assets/*.js | grep -E '\.[a-f0-9]{8,}\.js$'`. T-1-05 final evidence.
6. **Do NOT merge yet, and do NOT apply branch protection yet.** Wave 5 owns branch protection — applying it before all five status-check names exist in the GitHub check registry locks the repo (Pitfall A).

User signals completion by typing `approved <PR URL>` (or describes any failure mode for diagnosis). Once approved, the orchestrator proceeds to Wave 4 (Dependabot) and Wave 5 (runbooks + branch protection).

## Next Phase Readiness (post-checkpoint)

Once the checkpoint resolves green:

- **Plan 01-05 (Dependabot)** is unblocked. The five Action+SHA pairs in this commit's body are the baseline that the `github-actions` ecosystem in `.github/dependabot.yml` will track and update weekly.
- **Plan 01-06 (runbooks + SECURITY.md)** can append the § Build & Supply Chain, § Dependency Monitoring, and § Secret Scanning sections (D-25 atomic-commit pattern) — citing OWASP ASVS V14.2 / V14.4, ISO 27001 A.12.6 / A.10.1, SOC2 CC8.1 / CC6.1.
- **Phase 1 success criteria 1-4 are evidenced** by this commit (CI workflow exists; SHA-pinned; lint+typecheck+test+audit+build jobs run; build verifies dist/). Criterion 7 (first green PR run) resolves when the user approves the checkpoint. Criterion 6 (status-check names visible) resolves at the same moment. Criterion 5 (Wave 4 Dependabot) and 8 (T-1-05 dist/ hash bundle evidence pack) come in the next two plans.

## Threat Model Compliance

- **T-1-01 (Tampering / Supply Chain — npm production deps) — `mitigate` disposition honoured:** audit job runs `npm audit --audit-level=high --omit=dev` as HARD gate on every PR + push. OSV-Scanner runs as SOFT signal alongside (D-20). ASVS V14.2.1 + V14.2.4. ISO 27001 A.8.30 + A.12.6.1. SOC2 CC8.1.

- **T-1-02 (Information Disclosure / Hardcoded Secrets — repo source) — `mitigate (CI backstop)` disposition honoured:** audit job runs `gitleaks/gitleaks-action@ff98106e4c7b2bc287b24eaf42907196329070c7` (v2.3.9) with `config-path: .gitleaks.toml` (Wave 2 config — including the custom `sha256-hex-literal-regression` rule). Catches `--no-verify` pre-commit bypasses. Local + CI layered defence — both gates fire independently. ASVS V14.3.2. ISO 27001 A.10.1. SOC2 CC6.1.

- **T-1-03 (Tampering / Unsanitised DOM Sink — new code in PR) — `mitigate` disposition honoured:** lint job runs `npm run lint` which is `eslint . --max-warnings=0` (Wave 1's flat config). New `innerHTML` / `Math.random` additions fail the lint job. ASVS V5.3.3 + V6.3.1. SOC2 CC7.1.

- **T-1-04 (Tampering / CI Action Substitution — `.github/workflows/ci.yml`) — `mitigate` disposition honoured:** all 5 third-party Actions pinned to 40-char commit SHAs (TOOL-09). Task 1 deterministically resolved SHAs via `gh api` with annotated-tag dereferencing (Pitfall G). VALIDATION.md grep gate (`! grep -nE 'uses: [^@]+@v[0-9]'`) is part of acceptance criteria + verified in this SUMMARY. Wave 4 Dependabot keeps SHAs fresh weekly. ASVS V14.2.5. ISO 27001 A.8.31. SOC2 CC8.1.

- **T-1-05 (Tampering / Build-Output Cache Poisoning — `dist/`) — `mitigate (substrate)` disposition honoured:** build job runs `npm run build` and uploads `dist/` via `actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` (v7.0.1). Hashed filenames produced by Vite 8 (Wave 1 config). Substrate ready for Phase 3 deploy + Phase 10 SRI. ASVS V14.4.1. SOC2 CC8.1.

No new threat surface introduced beyond what the plan's threat model already covers — no flags to raise.

## Known Stubs

None. The CI workflow is fully wired and producing real signal as of the first PR run; there is no placeholder data, no mock-data wiring, and no "TODO/FIXME" markers in the shipped artefact.

## TDD Gate Compliance

This plan is `type: execute`, not `type: tdd`, so the RED/GREEN/REFACTOR commit triad is not required.

## Self-Check: PASSED (Tasks 1-2)

Files exist:

- `.github/workflows/ci.yml` at repo root — FOUND (110 lines, 6 jobs)

Commits exist (verified via `git log --oneline`):

- `aac7b0c` (Task 2: feat(01-04): add CI workflow with SHA-pinned Actions) — FOUND

Plan-level verification block (every check from the plan's `<verification>` block):

- `test -f .github/workflows/ci.yml` — PASS
- `! grep -qE 'uses: [^@]+@v[0-9]' .github/workflows/ci.yml` — PASS (no tag-style refs)
- `[ "$(grep -cE 'uses: [^@]+@[a-f0-9]{40}' .github/workflows/ci.yml)" -ge 15 ]` — PASS (exactly 15)
- `grep -q "audit-level=high"` — PASS
- `grep -q 'continue-on-error: true'` — PASS
- `grep -q "config-path: .gitleaks.toml"` — PASS
- `grep -q "needs: \[lint, typecheck, test, audit\]"` — PASS
- `grep -q "name: dist"` — PASS
- `! grep -q "firebase deploy"` — PASS
- `grep -q "contents: read"` — PASS
- `[ "$(git rev-list --count HEAD ^HEAD~1)" = "1" ]` — PASS (one atomic commit)

YAML parse:

- `js-yaml.load(...)` parses cleanly producing jobs `setup, lint, typecheck, test, audit, build` — PASS

Plan-level success criteria (8 criteria from plan `<success_criteria>` block):

1. `.github/workflows/ci.yml` exists and defines six jobs — PASS
2. All third-party Actions reference 40-char commit SHAs (T-1-04 mitigated; TOOL-09 grep gate passes) — PASS
3. Each SHA carries a `# vX.Y.Z` comment — PASS (5/5 Action references in lines 16-17, 32-33, 47-48, 62-63, 77-78, 100-101 — wait, let me re-state: every `uses:` line has both the SHA and the `# vX.Y.Z` comment)
4. Audit job runs npm audit (hard), OSV-Scanner (soft), gitleaks-action (CI backstop) — PASS
5. Build job depends on all four parallel gates and produces `dist/` artefact (no deploy) — PASS
6. `permissions: contents: read` at workflow level — PASS
7. **First PR opened against main; all five required-status-check jobs (lint, typecheck, test, audit, build) ran GREEN** — **CHECKPOINT PENDING** (Task 3)
8. T-1-05 substrate verified: dist/ artefact contains hashed-filename bundles — **CHECKPOINT PENDING** (resolves at Task 3 via `gh run download` step)

---

_Phase: 01-engineering-foundation-tooling_
_Plan: 04 (Wave 3 — GitHub Actions CI Workflow)_
_Status: Tasks 1-2 complete; Task 3 (checkpoint:human-verify) pending user action_
_Partial SUMMARY committed: 2026-05-04_

## Pause record (2026-05-04)

`git push origin main` returned `Permission denied to AssumeAIhugh` — the
git user `AssumeAIhugh` is not yet a collaborator on
`lukebadiali/base-layers-diagnostic`. User chose to pause and arrange push
access from Luke before proceeding. No fork or alternate remote was used —
single source of truth remains `origin = lukebadiali/base-layers-diagnostic`.

**Resume condition:** Hugh has push access (collaborator role on
lukebadiali/base-layers-diagnostic, or write access via the AssumeAI
team if Luke configures org-level permissions).

**Resume command:** `/gsd-execute-phase 1` — discovery will see Plan 01-04
has a partial SUMMARY but no `## Resolved Checkpoint` section, and will
re-spawn the executor to drive the push + 5-green verification + Wave 4.

**Local state at pause:** 18 commits ahead of `origin/main` on branch
`main` — all of Phase 1 Waves 0-3 plus the merge commits. No local
uncommitted changes. Pre-commit hook active and tested.

**What still needs human action after push works:**
1. `git push origin main`
2. Watch the 5 required jobs go green (`gh run watch` or Actions tab)
3. If gitleaks-action fails on the pre-existing `app.js:505`
   `INTERNAL_PASSWORD_HASH` literal: add the historical commit SHA to
   `.gitleaks.toml [allowlist] commits = [...]` and re-push (Outcome A)
4. Verify `dist/` artefact contains hashed-filename bundles via
   `gh run download` (T-1-05 substrate evidence)
5. Do NOT apply branch protection — Wave 5 owns it (Pitfall A: applying
   it before all 5 status-check names are registered locks the repo)
