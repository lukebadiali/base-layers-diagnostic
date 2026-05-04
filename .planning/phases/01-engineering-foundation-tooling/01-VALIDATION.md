---
phase: 1
slug: engineering-foundation-tooling
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-03
approved: 2026-05-03
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `01-RESEARCH.md` §"Validation Architecture".

---

## Test Infrastructure

| Property               | Value                                                             |
| ---------------------- | ----------------------------------------------------------------- |
| **Framework**          | Vitest 4.1.5 (happy-dom env)                                      |
| **Config file**        | Inline in `vite.config.js` (single config, two consumers)         |
| **Quick run command**  | `npm test`                                                        |
| **Full suite command** | `npm test -- --coverage`                                          |
| **Estimated runtime**  | ~5 seconds (smoke test only in Phase 1; real coverage is Phase 2) |

---

## Sampling Rate

- **After every task commit:** Run `npm test` (Vitest smoke + lint check)
- **After every plan wave:** Run `npm run lint && npm run typecheck && npm test && npm run build`
- **Before `/gsd-verify-work`:** Full local suite green + first PR's CI run all-green
- **Max feedback latency:** ~10 seconds local; ~3 minutes CI

---

## Per-Task Verification Map

Mapping below uses `{plan}-{task}` task IDs. Plans/tasks are produced by `gsd-planner` in step 8; this map will be reconciled by `gsd-plan-checker` (Dimension 8) and finalised before execution.

| Req ID  | Plan | Wave | Behavior                                                                                    | Test Type      | Automated Command                                                                                                                                                                                                                                                                                                                            | Status     |
| ------- | ---- | ---- | ------------------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| TOOL-01 | TBD  | 0    | `package.json` exists with declared deps; `npm ci` reproducible                             | npm verify     | `node -e "require('./package.json')" && npm ci --dry-run`                                                                                                                                                                                                                                                                                    | ⬜ pending |
| TOOL-02 | TBD  | 1    | Vite build produces hashed-filename bundles in `dist/`                                      | CI build       | `npm run build && ls dist/assets/*.js \| grep -E '\\.[a-f0-9]{8,}\\.js$'`                                                                                                                                                                                                                                                                    | ⬜ pending |
| TOOL-03 | TBD  | 0    | `firebase@12.12.1` resolved in `node_modules`                                               | npm verify     | `npm list firebase \| grep -F 'firebase@12.12.1'`                                                                                                                                                                                                                                                                                            | ⬜ pending |
| TOOL-04 | TBD  | 0    | `chart.js@4.5.1` resolved in `node_modules`                                                 | npm verify     | `npm list chart.js \| grep -F 'chart.js@4.5.1'`                                                                                                                                                                                                                                                                                              | ⬜ pending |
| TOOL-05 | TBD  | 1    | ESLint blocks `Math.random()` in new code (no-restricted-syntax + security plugin)          | unit (lint)    | `printf 'const x = Math.random();\\n' > /tmp/baz.js && (npx eslint /tmp/baz.js && echo SHOULD_FAIL && exit 1) \|\| true`                                                                                                                                                                                                                     | ⬜ pending |
| TOOL-05 | TBD  | 1    | ESLint blocks `el.innerHTML = x` in new code (no-unsanitized/property)                      | unit (lint)    | `printf 'const el={};\\nel.innerHTML = "x";\\n' > /tmp/iuh.js && (npx eslint /tmp/iuh.js && echo SHOULD_FAIL && exit 1) \|\| true`                                                                                                                                                                                                           | ⬜ pending |
| TOOL-05 | TBD  | 1    | `npm run lint` passes on the committed codebase (per-line disables in place)                | CI lint        | `npm run lint`                                                                                                                                                                                                                                                                                                                               | ⬜ pending |
| TOOL-06 | TBD  | 1    | Prettier configured; repo formats clean                                                     | CI format      | `npm run format:check`                                                                                                                                                                                                                                                                                                                       | ⬜ pending |
| TOOL-07 | TBD  | 1    | `npm run typecheck` runs without error (with `// @ts-nocheck` on app.js + firebase-init.js) | CI typecheck   | `npm run typecheck`                                                                                                                                                                                                                                                                                                                          | ⬜ pending |
| TOOL-07 | TBD  | 1    | A deliberate JSDoc type mismatch in a new file is caught                                    | manual one-off | Create `types/_typecheck-probe.js` with intentional mismatch, run `npx tsc --noEmit`, expect exit 1, delete file                                                                                                                                                                                                                             | ⬜ pending |
| TOOL-08 | TBD  | 3    | CI workflow runs all 5 jobs (lint, typecheck, test, audit, build) green on a PR             | CI             | Open a no-op PR, observe `gh pr checks` all green                                                                                                                                                                                                                                                                                            | ⬜ pending |
| TOOL-09 | TBD  | 3    | All third-party Actions pinned to commit SHA (40-char hex, not `@v*`)                       | grep gate      | `! grep -nE 'uses: [^@]+@v[0-9]' .github/workflows/ci.yml`                                                                                                                                                                                                                                                                                   | ⬜ pending |
| TOOL-09 | TBD  | 5    | OIDC bootstrap runbook documents `gh api` + GCP workload-identity-pool steps                | doc presence   | `test -f runbooks/firebase-oidc-bootstrap.md && grep -q "workload-identity-pool" runbooks/firebase-oidc-bootstrap.md`                                                                                                                                                                                                                        | ⬜ pending |
| TOOL-10 | TBD  | 4    | Dependabot config valid + covers npm root, npm `functions/`, github-actions                 | YAML lint      | `npx js-yaml .github/dependabot.yml \| grep -c '"package-ecosystem"'` → 3                                                                                                                                                                                                                                                                    | ⬜ pending |
| TOOL-11 | TBD  | 5    | Socket.dev installed at repo level; runbook + screenshot in evidence pack                   | manual         | Inspect `runbooks/socket-bootstrap.md` exists with screenshot reference; PR opened post-install shows Socket.dev check                                                                                                                                                                                                                       | ⬜ pending |
| TOOL-12 | TBD  | 2    | gitleaks pre-commit blocks a commit containing the prior `INTERNAL_PASSWORD_HASH` shape     | manual one-off | `git checkout -b _gl-test && printf 'const HASH="6110f27c9c91658c3489285abd5c45ffe5c1aa99c7f3f37d23e32834566e7fce";\\n' > _gl_probe.js && git add _gl_probe.js && (git commit -m probe \|\| true) && git restore --staged _gl_probe.js && rm _gl_probe.js && git checkout main && git branch -D _gl-test` — pre-commit must abort the commit | ⬜ pending |
| TOOL-12 | TBD  | 3    | gitleaks CI step catches secrets in PR diff                                                 | CI             | Open a probe PR with a fake hex secret, observe gitleaks job fail; close PR without merge                                                                                                                                                                                                                                                    | ⬜ pending |
| DOC-10  | TBD  | 5    | `SECURITY.md` exists with three populated sections + framework citations                    | grep gate      | `grep -q '## Build & Supply Chain' SECURITY.md && grep -q '## Dependency Monitoring' SECURITY.md && grep -q '## Secret Scanning' SECURITY.md && grep -q 'OWASP ASVS' SECURITY.md`                                                                                                                                                            | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `package.json` — created with all production + dev deps pinned per STACK.md
- [ ] `package-lock.json` — committed after `npm install`
- [ ] `.npmrc` — `engine-strict=true` (Pitfall D)
- [ ] No existing test infrastructure to extend; smoke test (`tests/smoke.test.js`) created in Wave 5

---

## Manual-Only Verifications

| Behavior                                                 | Requirement      | Why Manual                                                                                         | Test Instructions                                                                                                            |
| -------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Socket.dev GitHub App installed at repo level            | TOOL-11          | UI-only install at github.com/apps/socket-security; no API path in scope for Phase 1               | Install via Socket UI → screenshot → store under `runbooks/socket-bootstrap.md` and `docs/evidence/socket-install.png`       |
| Branch protection on `main`                              | TOOL-08, TOOL-09 | One-shot `gh api` runbook; must run AFTER first green CI to avoid status-check lockout (Pitfall A) | Run after first CI green: `runbooks/branch-protection-bootstrap.md`; verify with `gh api repos/.../branches/main/protection` |
| OIDC workload-identity-pool documented (not provisioned) | TOOL-09          | Provisioning happens in Phase 3 (deploy job lands then)                                            | Confirm `runbooks/firebase-oidc-bootstrap.md` enumerates `gcloud iam workload-identity-pools` + GitHub provider config       |
| TypeScript typecheck probe (deliberate JSDoc mismatch)   | TOOL-07          | One-shot proof-of-mechanism; not a permanent test                                                  | See Per-Task Verification Map (TOOL-07 row 2)                                                                                |
| gitleaks SHA-256 custom rule fires on the C2 hash shape  | TOOL-12          | One-shot proof-of-mechanism; not a permanent test                                                  | See Per-Task Verification Map (TOOL-12 row 1)                                                                                |

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify entry OR are listed under Manual-Only Verifications above
- [ ] Sampling continuity: no 3 consecutive task commits without an automated verify (lint + typecheck + test cover most commits)
- [ ] Wave 0 (`package.json` + `npm install`) committed before any Wave 1+ task can run
- [ ] No watch-mode flags in CI (`vitest run` not `vitest`; `tsc --noEmit` not `tsc --watch`)
- [ ] Feedback latency < 15s for the local quick-run loop
- [ ] `nyquist_compliant: true` set in frontmatter once gsd-plan-checker confirms coverage

**Approval:** approved 2026-05-03 (gsd-plan-checker Dimension 8 — all 13 REQ rows mapped to automated `<verify>` entries or named Manual-Only Verifications)
