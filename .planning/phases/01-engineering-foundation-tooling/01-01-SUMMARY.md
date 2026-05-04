---
phase: 01-engineering-foundation-tooling
plan: 01
subsystem: infra
tags: [npm, package-json, lockfile, vite, vitest, eslint, husky, supply-chain, engine-strict]

# Dependency graph
requires:
  - phase: 00-bootstrap
    provides: empty repo with .gitignore (5 lines), no package manifest, no build tooling
provides:
  - package.json declaring 4 production deps + 14 devDeps at exact pinned 2026-05-03 versions
  - package-lock.json capturing reproducible install tree (934 packages, 12,633 lines)
  - .npmrc with engine-strict=true (Pitfall D — fail-fast on Node < 22)
  - augmented .gitignore (15 entries, original 5 preserved + 10 build/env artefacts appended)
  - node_modules/ populated and correctly excluded from git
  - husky 9 prepare hook wired (`husky || true` per Pitfall H)
affects: [01-02-vite-config, 01-03-eslint-prettier-tsconfig, 01-04-husky-lintstaged, 01-05-ci-dependabot, 01-06-runbooks-security-md, 02-test-suite, 03-hosting-cutover, 04-modular-split, 05-rules-migration, 06-auth-mfa, 07-cloud-functions]

# Tech tracking
tech-stack:
  added:
    - "firebase@12.12.1 (production dep, runtime CDN until Phase 4)"
    - "chart.js@4.5.1, dompurify@3.4.2, @sentry/browser@10.51.0 (production)"
    - "vite@8.0.10, vitest@4.1.5, @vitest/coverage-v8@4.1.5, happy-dom@20.9.0 (build/test)"
    - "typescript@6.0.3 (typecheck-only, no .ts files)"
    - "eslint@10.3.0, @eslint/js@10.0.1, eslint-plugin-no-unsanitized@4.1.5, eslint-plugin-security@4.0.0 (lint)"
    - "prettier@3.8.3 (format)"
    - "@firebase/rules-unit-testing@5.0.0, firebase-tools@15.16.0 (Phase 5/3 prep)"
    - "husky@9.1.7, lint-staged@16.4.0 (pre-commit hooks)"
  patterns:
    - "Exact-version pinning across all 18 deps (no ^ or ~) — supply-chain T-1-01 mitigation"
    - "engine-strict=true upgrades engines warning to hard install error — Pitfall D"
    - "prepare: husky || true — required so npm ci in CI without .git does not fail (Pitfall H)"
    - "lint-staged eslint --fix WITHOUT --max-warnings — Pitfall E (CI lint job is authoritative gate)"

key-files:
  created:
    - "package.json (49 lines, 4 prod + 14 dev deps, scripts, lint-staged config)"
    - "package-lock.json (12,633 lines, 934 packages, committed)"
    - ".npmrc (1 line: engine-strict=true)"
  modified:
    - ".gitignore (5 → 15 lines; original 5 preserved verbatim, 10 appended)"

key-decisions:
  - "D-01 honoured: every version locked to STACK.md verified-2026-05-03 strings exactly"
  - "D-02 honoured: engines.node >=22.0.0 + .npmrc engine-strict=true (Vite 8 minimum)"
  - "D-03 honoured: npm only (no pnpm/yarn/bun)"
  - "D-04 honoured: @sentry/browser installed now, not initialised until Phase 9"
  - "D-16 honoured: husky 9 + lint-staged 16 selected for pre-commit (Wave 2 wires it up)"

patterns-established:
  - "Pinned-version policy: package.json uses literal version strings, never ^ or ~ ranges"
  - "Pitfall H mitigation: prepare script always uses `husky || true` for CI compatibility"
  - "Pitfall E mitigation: lint-staged is permissive locally; CI is the authoritative gate"
  - "Forward-declaration: .gitignore entries for Phase 3 (.firebase/, *-debug.log, .firebaserc) and Phase 5 added now to avoid future amendment churn"

requirements-completed: [TOOL-01, TOOL-03, TOOL-04]

# Metrics
duration: ~3 min (dominated by 2-min npm install)
completed: 2026-05-04
---

# Phase 01 Plan 01: Wave 0 — Package Foundation Summary

**Greenfield npm package manifest with all 18 deps pinned to exact 2026-05-03 versions, reproducible lockfile committed, engine-strict enforcing Node 22, and .gitignore augmented for downstream phases.**

## Performance

- **Duration:** ~3 min (Task 1 → Task 3 commits span 10:33:15 → 10:36:28 BST)
- **Started:** 2026-05-04T09:33:00Z (approx — Task 1 commit at 09:33:15Z)
- **Completed:** 2026-05-04T09:36:28Z
- **Tasks:** 3 / 3
- **Files modified:** 4 (package.json, package-lock.json, .npmrc, .gitignore)

## Accomplishments

- **Dependency manifest declared at exact versions** — all 4 production deps (firebase 12.12.1, chart.js 4.5.1, dompurify 3.4.2, @sentry/browser 10.51.0) and all 14 devDeps pinned with literal version strings, no `^` / `~` drift. T-1-01 (supply-chain tampering) mitigated.
- **Reproducible lockfile committed** — `npm install` produced 934 packages; `npm ci --dry-run` exits 0, proving the tree reproduces from `package-lock.json` alone. Wave 3 CI (`npm ci`) and Wave 5 evidence pack inherit this contract.
- **Engine-strict enforced for Node 22** — `engines.node >=22.0.0` in package.json + `engine-strict=true` in .npmrc means installs on Node < 22 fail hard rather than silently producing a broken environment (Pitfall D).
- **`.gitignore` augmented for Wave 1 onwards** — `dist/`, `coverage/`, `.env`, `.env.*`, `!.env.example` for Wave 1; `.firebase/`, `*.tsbuildinfo`, `firestore-debug.log`, `firebase-debug.log`, `.firebaserc` forward-declared for Phases 3 and 5 (no future amendment needed). Original 5 lines preserved verbatim.
- **Husky prepare hook wired with Pitfall H mitigation** — `prepare: husky || true` ensures `npm ci` in CI environments without `.git` do not fail; husky 9 ran successfully on first install.

## Task Commits

Each task was committed atomically with `--no-verify` (parallel-executor convention):

1. **Task 1: Create package.json with pinned deps + scripts + lint-staged config** — `0d5757a` (feat)
2. **Task 2: Create .npmrc and augment .gitignore** — `06cd312` (chore)
3. **Task 3: npm install + commit package-lock.json** — `c2c2454` (chore)

**Plan metadata commit:** included in this SUMMARY.md commit (orchestrator does not own state files in worktree mode).

## Files Created/Modified

- `package.json` — created. Top-level: `name`, `version: 0.1.0`, `private: true`, `type: module`, `engines.node: >=22.0.0`. Declares 11 npm scripts (`dev`, `build`, `preview`, `lint`, `lint:fix`, `typecheck`, `test`, `test:watch`, `test:coverage`, `format`, `format:check`, `prepare`), `lint-staged` block (`*.js → eslint --fix + prettier --write`), 4 `dependencies`, 14 `devDependencies`. All versions are exact literal strings.
- `package-lock.json` — created. 934 packages, 12,633 lines, npm v3 lockfile format. Captures integrity hashes for every transitive dep. Committed; `node_modules/` correctly excluded.
- `.npmrc` — created. Single line: `engine-strict=true`.
- `.gitignore` — modified. Existing 5 lines (`.DS_Store`, `.vscode/`, `.idea/`, `*.log`, `node_modules/`) preserved at lines 1–5. 10 new entries appended at lines 6–15 (`dist/`, `coverage/`, `.env`, `.env.*`, `!.env.example`, `.firebase/`, `*.tsbuildinfo`, `firestore-debug.log`, `firebase-debug.log`, `.firebaserc`). Zero deletions.

## Resolved Top-Level Versions (`npm list --depth=0`)

```
base-layers-diagnostic@0.1.0
├── @eslint/js@10.0.1
├── @firebase/rules-unit-testing@5.0.0
├── @sentry/browser@10.51.0
├── @vitest/coverage-v8@4.1.5
├── chart.js@4.5.1
├── dompurify@3.4.2
├── eslint-plugin-no-unsanitized@4.1.5
├── eslint-plugin-security@4.0.0
├── eslint@10.3.0
├── firebase-tools@15.16.0
├── firebase@12.12.1
├── happy-dom@20.9.0
├── husky@9.1.7
├── lint-staged@16.4.0
├── prettier@3.8.3
├── typescript@6.0.3
├── vite@8.0.10
└── vitest@4.1.5
```

All 18 declared deps resolved at the exact pinned version — zero drift, zero `^` resolution surprises.

## Decisions Made

None — followed plan as specified. The plan's three flagged deviations from the RESEARCH.md skeleton (`husky || true`, lint-staged without `--max-warnings`, exact pins) were honoured exactly because the plan documented their load-bearing rationale (Pitfalls D, E, H + D-01).

## Deviations from Plan

**None — plan executed exactly as written.**

The two skeleton-vs-implementation differences flagged in the plan body (`prepare: "husky || true"` instead of `"husky"`; lint-staged without `--max-warnings`) are not deviations — they are explicitly mandated by the plan task body and are required by Pitfalls H and E.

## Issues Encountered

- **Node version observed:** v24.12.0 (the user's local Node is one major above D-02's pinned Node 22 LTS). This satisfies `engines.node: >=22.0.0` and `engine-strict=true`, so install proceeded normally. Production CI (Wave 3, Phase 1 Plan 5) will use `actions/setup-node@…` with `node-version: 22` per D-02, ensuring CI runs against the canonical version. No deviation.
- **npm install warnings:** 5 deprecation warnings on transitive deps (`json-ptr`, `node-domexception`, `uuid@8`, `glob@10`, `uuid@9`) and 4 moderate dev-only vulnerabilities. Out of scope — these are transitive into pinned direct deps and the Phase 1 audit gate is `npm audit --audit-level=high --omit=dev` (D-21), which excludes both the moderate severity and the dev-only scope. Logged here as informational; revisit per D-21's "Phase 11 if compliance review pushes back" cleanup-ledger entry.
- **Husky internal state directory (`.husky/_/`)**: created by husky 9 on the first `prepare` run as designed. Husky 9 generates its own `.husky/_/.gitignore` excluding the internal binaries; nothing tracked here. Wave 2 (Plan 01-04) will write `.husky/pre-commit`.

## User Setup Required

None — no external service configuration required for Wave 0. Wave 5 (Plan 01-06) will document the one-shot Socket.dev install + branch-protection bootstrap + Firebase OIDC setup.

## Next Phase Readiness

**Wave 1 unblocked.** The `package.json` + populated `node_modules/` substrate is in place for:
- Plan 01-02 (vite.config.js + tsconfig.json) — imports from `vite`, `vitest`, `typescript`, `happy-dom` are resolvable.
- Plan 01-03 (eslint.config.js + .prettierrc.json) — imports from `eslint`, `@eslint/js`, `eslint-plugin-no-unsanitized`, `eslint-plugin-security`, `prettier` are resolvable.
- Plan 01-04 (husky + lint-staged + gitleaks) — `husky` binary present, `lint-staged` ready to wire into `.husky/pre-commit`.

**No blockers, no concerns.** Worktree branch is at `c2c2454`, three commits ahead of `dd42c4b` (plan-creation HEAD).

## Threat Model Compliance

- **T-1-01 (Tampering / Supply Chain) — `mitigate` disposition honoured:** every dep version is an exact pinned string; `package-lock.json` captures integrity hashes for every transitive package; `npm ci --dry-run` validates that the lockfile reproduces the declared tree. ASVS V14.2.1, V14.2.4 satisfied at the substrate level. Wave 4 (Dependabot) and Wave 5 (Socket.dev) will layer ongoing monitoring on top.
- **T-1-04 substrate — `mitigate` disposition honoured:** `engine-strict=true` in `.npmrc` blocks installs on unsupported Node versions. ASVS V14.2.5 satisfied.

No new threat surface introduced beyond what the plan's threat model already covers — no flags to raise.

## Self-Check: PASSED

- `package.json` exists at repo root — FOUND
- `package-lock.json` exists at repo root — FOUND
- `.npmrc` exists at repo root — FOUND
- `.gitignore` exists at repo root with 15 lines — FOUND
- Commit `0d5757a` (Task 1) — FOUND in `git log`
- Commit `06cd312` (Task 2) — FOUND in `git log`
- Commit `c2c2454` (Task 3) — FOUND in `git log`
- `npm ci --dry-run` exits 0 — VERIFIED (output: `up to date in 2s`)
- `node_modules/` not tracked in git — VERIFIED (`git ls-files | grep -c node_modules` = 0)
- All 18 declared deps resolve to exact pinned versions in `node_modules/<pkg>/package.json` — VERIFIED for sentinels (firebase 12.12.1, vite 8.0.10, eslint 10.3.0, husky 9.1.7)
- All 8 plan-level success criteria — VERIFIED via the plan's `<verification>` block

---
*Phase: 01-engineering-foundation-tooling*
*Plan: 01 (Wave 0 — Package Foundation)*
*Completed: 2026-05-04*
