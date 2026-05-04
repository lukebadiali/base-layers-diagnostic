# Phase 1: Engineering Foundation (Tooling) - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up the engineering foundation that makes every downstream phase testable, dependency-monitored, lint-enforced, and CI-gated. Concretely: `package.json` + Vite 8 build pipeline + Vitest 4 + ESLint 10 (flat config) + Prettier + TypeScript-as-typecheck (via `// @ts-check`) + GitHub Actions CI + Dependabot + Socket.dev + OSV-Scanner + gitleaks (pre-commit + CI) + initial `SECURITY.md` skeleton.

**Explicitly NOT in this phase** (owned elsewhere):

- Hosting cutover from GitHub Pages to Firebase Hosting → Phase 3
- Modular split of `app.js` IIFE → Phase 4 (gated by Phase 2 test fence — Pitfall 9)
- Any `firebase.json` / Firestore Rules / Storage Rules → Phase 3 / Phase 5
- Any change to what production `https://baselayers.bedeveloped.com` serves → Phase 3

The tooling lands. Nothing user-visible changes in production.

</domain>

<decisions>
## Implementation Decisions

### Stack Versions (locked from `.planning/research/STACK.md`)

- **D-01:** Pin to STACK.md's verified-2026-05-03 versions exactly. No drift, no rolling-`latest`.
  - Production deps: `firebase@12.12.1`, `chart.js@4.5.1`, `dompurify@3.4.2`, `@sentry/browser@10.51.0`
  - Build/test deps: `vite@8.0.10`, `vitest@4.1.5`, `@vitest/coverage-v8@4.1.5`, `happy-dom@20.9.0`, `typescript@6.0.3`
  - Lint/format deps: `eslint@10.3.0`, `eslint-plugin-no-unsanitized@4.1.5`, `eslint-plugin-security@4.0.0`, `prettier@3.8.3`
  - Tooling deps: `@firebase/rules-unit-testing@5.0.0`, `firebase-tools@15.16.0`
  - **Note:** `firebase-tools` is installed as devDep but `firebase init` is **not** run in Phase 1 — that lives in Phase 3 (hosting) and Phase 5 (rules). Phase 1 only wires up build + test + lint + CI.
- **D-02:** Node 22 (LTS) — single version, not a matrix. Vite 8 dropped Node 18, so 20+22 matrix would be wasted spend; 22 is the longest support window for 2nd-gen Cloud Functions later.
- **D-03:** `npm` as the package manager. No pnpm / yarn / bun — STACK.md uses `npm install`, single-developer project, `npm ci` reproducibility is sufficient.
- **D-04:** Sentry browser SDK is **installed** (production dep) in Phase 1 but **not initialised** until Phase 9. Carrying the dep early avoids a separate `npm install` PR in Phase 9 and lets the bundle-size budget reflect reality from day 1.

### Coexistence with un-split `app.js` (the "loud-vs-quiet" call)

- **D-05:** **Quiet, time-bounded debt.** The 4,103-line IIFE is _not_ refactored in Phase 1; tooling adapts to it via explicit, narrowly-scoped overrides that make the debt visible and trace to the Phase 4 follow-up.
- **D-06:** ESLint flat-config (`eslint.config.js`) uses `files` + `ignores` overrides:
  - Danger rules — `no-unsanitized/method`, `no-unsanitized/property`, `security/detect-pseudo-random-bytes` — fire as `error` on **all** source files.
  - For each existing violation in `app.js` / `firebase-init.js` / `data/pillars.js`, add a per-line `// eslint-disable-next-line <rule> -- Phase 4: replace with crypto.randomUUID() / replaceChildren()` comment. No file-level disables, no blanket excludes.
  - All other rules (recommended sets, security plugin's other rules, formatting via prettier) fire as `error` everywhere with no exceptions.
- **D-07:** TypeScript typecheck runs via `tsc --noEmit --allowJs --checkJs --strict --target es2020 --module esnext --moduleResolution bundler` against the whole repo. `app.js` carries a single `// @ts-nocheck` at the top with a `// Phase 4: remove after modular split` comment. New files (any module added before Phase 4 — there shouldn't be many) get `// @ts-check` + JSDoc from day 1.
- **D-08:** Visibility ledger: `runbooks/phase-4-cleanup-ledger.md` enumerates every `eslint-disable-next-line` and `@ts-nocheck` introduced in Phase 1, with file:line + rule + intended fix. Phase 4 removes them and the ledger empties to zero.

### CI Gating

- **D-09:** Single GitHub Actions workflow `.github/workflows/ci.yml`. Triggers: every PR against `main` and every push to `main`. Jobs in order: `setup → lint → typecheck → test → audit → build`. Fail-fast disabled so all signal surfaces in one PR run.
- **D-10:** All third-party Actions pinned to **commit SHA** (not tag). Dependabot's `github-actions` ecosystem updates the SHAs weekly.
- **D-11:** No deploy job in the Phase 1 workflow. Firebase Hosting deploy lands in Phase 3 (`if: github.ref == 'refs/heads/main'` job, OIDC-authenticated). Phase 1 produces `dist/` as a build-verification artefact uploaded to the workflow run.
- **D-12:** **Branch protection on `main`** is in scope for Phase 1. Configured via `gh api repos/AssumeAIhugh/<repo>/branches/main/protection` — required status checks: `lint`, `typecheck`, `test`, `build`, `osv-scanner`; require 1 approving review; require linear history; block force-push; block direct push (PRs only). Documented as a one-shot runbook (`runbooks/branch-protection-bootstrap.md`) so it's reproducible + auditable.
- **D-13:** Build verification only — `npm run build` produces `dist/` in CI; the artefact is uploaded but not deployed. The site continues to ship from GitHub Pages as `index.html` + `?v=46` until Phase 3.

### `index.html` + Cache-Bust Cutover

- **D-14:** `index.html` is **not** rewritten in Phase 1. The `?v=46` pattern stays alive on the production GH-Pages site until Phase 3 swaps to Firebase Hosting + serves `dist/index.html` with hashed-filename bundles. Phase 1 produces `dist/` from the existing entry points so Vite's chunking + SRI is exercised in CI, but the deployed site is unchanged.
- **D-15:** Vite config (`vite.config.js`) uses `index.html` as the entry. To avoid double-loading at dev time, a copy or a small alias config keeps the un-built version GH-Pages-shippable while Vite's dev server uses ES module imports. Researcher confirms the exact mechanism (Vite's default behaviour vs an explicit `build.rollupOptions.input` + a `dev-index.html` for the dev server) — the constraint is "live site keeps shipping the un-built HTML; CI builds and verifies the Vite build separately".

### Pre-Commit Hooks

- **D-16:** `husky@9.x` + `lint-staged@16.x` for the pre-commit wrapper. ESLint `--fix` + Prettier `--write` run on staged JS files; `gitleaks protect --staged` runs as a separate pre-commit step.
- **D-17:** `gitleaks` is installed as a binary dependency via `gitleaks-action` in CI; locally, devs install `gitleaks` once via `scoop install gitleaks` (Windows) / `brew install gitleaks` (macOS). Setup documented in `CONTRIBUTING.md`. The pre-commit hook also runs in CI (`gitleaks detect --source .`) so a dev who skips local hook setup still gets caught.
- **D-18:** `gitleaks` config (`.gitleaks.toml`) bundles defaults plus one custom rule that matches the prior `INTERNAL_PASSWORD_HASH` shape (SHA-256 hex literal of length 64 in source, with allowlist for the test fixtures that may need legitimate hex in the future).

### Dependency Monitoring & Supply Chain

- **D-19:** Dependabot config (`.github/dependabot.yml`):
  - `npm` ecosystem at root + `npm` ecosystem at `functions/` (created when Phase 7 lands; config has the entry already so Phase 7 doesn't have to remember).
  - `github-actions` ecosystem.
  - Weekly cadence (not daily — noise reduction; same justification as STACK.md §"Configure both to run with").
  - Auto-rebase on. **Auto-merge off** (compliance posture: human review on every dep bump).
- **D-20:** `OSV-Scanner` runs in CI as `npx osv-scanner@latest -r .` (not the GitHub Action). Reason: keeps CI portable + STACK.md's recommended invocation. Failure of OSV-Scanner is a **soft** fail in Phase 1 (it warns but doesn't block PRs) — escalate to hard-fail in a follow-up phase once we know the false-positive rate. Logged in the cleanup ledger.
- **D-21:** `npm audit --audit-level=high --omit=dev` runs in CI as a hard gate. `--omit=dev` because dev-only audit failures (e.g., a Vite transitive) are noisy without changing the production attack surface; revisit in Phase 11 if compliance review pushes back.
- **D-22:** **Socket.dev** GitHub App installed at the repo level. No code config — it's a separate UI step. Documented in `runbooks/socket-bootstrap.md` (one-shot setup with screenshot for the evidence pack — DOC-09).

### TOOL-09: OIDC for Firebase Auth — preparation only

- **D-23:** Phase 1 does not authenticate to Firebase from CI (no deploy job). But the OIDC-trust workload-identity-pool config is documented in `runbooks/firebase-oidc-bootstrap.md` so Phase 3 can plug it in without a research detour. Phase 1 plan task: "document; do not provision."

### DOC-10 Incremental — `SECURITY.md` Skeleton

- **D-24:** Phase 1 creates `SECURITY.md` at repo root with this structure:
  - Header (project, contact `security@bedeveloped.com`, supported versions)
  - Vulnerability disclosure paragraph (placeholder — Phase 11 finalises wording)
  - **§ Build & Supply Chain** — populated for Phase 1: Vite-bundled deps (closes H4 SRI gap on first deploy in Phase 3), pinned npm versions, hashed-filename output. Cite OWASP ASVS V14.4, ISO 27001 A.14.2.5, SOC2 CC8.1.
  - **§ Dependency Monitoring** — populated for Phase 1: Dependabot weekly cadence, OSV-Scanner in CI, Socket.dev behavioural detection. Cite OWASP ASVS V14.2, ISO 27001 A.12.6, SOC2 CC8.1.
  - **§ Secret Scanning** — populated for Phase 1: gitleaks pre-commit + CI, custom rule for SHA-256-hex-literal regression of C2. Cite OWASP ASVS V14.2, ISO 27001 A.10.1, SOC2 CC6.1.
  - Stub sections (TOC entries with TODO + phase reference) for: Authentication & MFA (Phase 6), Authorization & Tenant Isolation (Phase 5/6), Audit Logging (Phase 7/9), Data Lifecycle & GDPR (Phase 8), Backup & DR (Phase 8), Observability (Phase 9), CSP & Headers (Phase 3/10), Threat Model link (Phase 11).
- **D-25:** Every Phase 1 plan task that closes a `SECURITY.md` claim has a corresponding `SECURITY.md` line edit in the same commit (via the executor's atomic-commit pattern). No "all changes squashed at the end" — Pitfall 19 prevention.

### Lint Rules — Specific Configurations

- **D-26:** `eslint.config.js` extends `@eslint/js` recommended + `eslint-plugin-no-unsanitized/recommended` + `eslint-plugin-security/recommended`. Custom rules:
  - `no-restricted-syntax`: blocks `Math.random()` (CallExpression with callee.object.name === 'Math' && callee.property.name === 'random') as `error` to back D-06's danger rule, with the same per-line disables on existing call sites.
  - `no-restricted-imports`: warns on direct imports of `firebase/firestore`, `firebase/storage`, `firebase/auth` from anywhere except `firebase/`-prefixed paths. **Soft (warn) in Phase 1**; hardens to `error` in Phase 4 when the modular boundary is enforced for real.
- **D-27:** Prettier config (`.prettierrc.json`) is opinionated-zero: `printWidth: 100, semi: true, singleQuote: false, trailingComma: "all"`. No bikeshedding. Wired into lint-staged.

### TypeScript Config

- **D-28:** `tsconfig.json` per STACK.md §"`tsconfig.json` shape (essentials)" exactly. Includes: `**/*.js`. Excludes: `node_modules`, `dist`, `functions/lib` (created Phase 7), `coverage`.
- **D-29:** Add a `types/` directory for ambient declarations needed by typecheck (e.g., the global `__APP_VERSION__` Vite injects, the global `firebase` if any legacy code references it before Phase 4). Each `.d.ts` file carries a `// @ts-check` reference + a Phase 4 cleanup comment.

### Vitest — Smoke Test Only

- **D-30:** Phase 1 ships exactly **one** smoke test (`tests/smoke.test.js`: `expect(1 + 1).toBe(2)`) so `npm test` doesn't emit Vitest's "no tests found" warning. Real test coverage is Phase 2 (TEST-01..07 + TEST-10).
- **D-31:** Vitest config inline in `vite.config.js` per STACK.md (one config file, two consumers). `environment: "happy-dom"`, `coverage: { provider: "v8", reportsDirectory: "coverage", reporter: ["text", "html"] }`. Coverage threshold is **not** set in Phase 1 (it'd block CI on the smoke test); set in Phase 2 once real tests exist.

### Folded Todos

None — no todo backlog cross-referenced for this phase. (`STATE.md` "Outstanding Todos" all reference later phases.)

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context

- `.planning/PROJECT.md` — Active milestone, locked decisions, constraints, Out-of-Scope list
- `.planning/REQUIREMENTS.md` §"Tooling & Build (TOOL)" — TOOL-01..12 acceptance criteria + traceability
- `.planning/REQUIREMENTS.md` §"Documentation Pack (DOC)" — DOC-10 incremental requirement
- `.planning/ROADMAP.md` §"Phase 1: Engineering Foundation (Tooling)" — Goal + Success Criteria + Dependencies
- `.planning/STATE.md` §"Sequencing Non-Negotiables" — Tests-first / Rules-deploy / Subcollection-first / Hosting-first
- `CLAUDE.md` — Project conventions, locked decisions, sequencing non-negotiables, source-layout target

### Stack & Tooling Specifics

- `.planning/research/STACK.md` — **PRIMARY VERSION REFERENCE.** Every package version pinned + verified against npm registry on 2026-05-03.
  - §"TL;DR — what to install" — exact `npm install` invocations
  - §"Build setup — Vite for vanilla-JS SPA" — `vite.config.js` skeleton
  - §"Vitest setup — JSDoc-types-as-typecheck" — `tsconfig.json` skeleton
  - §"CI / Dependency Monitoring" — `ci.yml` shape, Dependabot vs Renovate decision
  - §"What NOT to Use" — explicit anti-patterns to block in lint config
- `.planning/research/PITFALLS.md` — review for Phase 1-relevant pitfalls (Pitfall 9 = tests-first sequencing; Pitfall 19 = compliance-theatre prevention via incremental DOC-10)
- `.planning/research/SUMMARY.md` §"Compliance Mapping Cheat-Sheet" — framework citations to drop into `SECURITY.md` skeleton sections (OWASP ASVS V14.2 / V14.4, ISO 27001 A.10.1 / A.12.6 / A.14.2.5, SOC2 CC6.1 / CC8.1)

### Codebase Map (analysis dated 2026-05-03)

- `.planning/codebase/STACK.md` — current state of stack (no `package.json`, CDN scripts with no SRI, hand-bumped `?v=46`)
- `.planning/codebase/STRUCTURE.md` — current file layout (root: `app.js`, `firebase-init.js`, `data/pillars.js`, `index.html`, `styles.css`, `assets/`)
- `.planning/codebase/CONCERNS.md` §"Test Coverage Gaps", §"Dependency Hygiene", §"Build Tooling" — Phase 1 closes the _substrate_ for many of these (gives Phase 2 something to test through, gives the modular split a fence)
- `.planning/codebase/CONVENTIONS.md` — coding style observations to preserve in Prettier/ESLint config

### Audit Framework

- `SECURITY_AUDIT.md` (project root) §A03 (CI/CD), §10.2 (Supply Chain) — checklist items closed by Phase 1
- `SECURITY_AUDIT.md` §0(4) — "no weakening of controls to make tests/features pass" — applies to lint rule severity calls

### Compliance Citations (for `SECURITY.md` skeleton)

- OWASP ASVS L2 v5.0 — sections V14.2 (dependencies), V14.4 (HTTP headers), V14.7 (build pipeline), V7.1 (logging — stub)
- ISO/IEC 27001:2022 Annex A — A.10.1 (cryptography), A.12.6 (technical vulnerability management), A.14.2.5 (secure system engineering principles)
- SOC 2 CC8.1 (change management) — CI/CD as evidence trail
- GDPR Art. 32(1)(d) — testing/evaluating effectiveness — citable for incremental SECURITY.md updates

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- **`firebase-init.js`** is already an ES module (`<script type="module">`) — Vite can use it as an additional entry without rewriting. The other two scripts (`data/pillars.js`, `app.js`) currently load as classic scripts; Vite tree-shaking only helps once they're modules, but Phase 1 doesn't change that — Phase 4 does.
- **`data/pillars.js`** is a leaf data module — small, no Firebase imports — likely the easiest "first JSDoc-typed file" if any new file gets added in Phase 1.

### Established Patterns

- **No build tooling today.** Project is greenfield from a tooling perspective — no legacy webpack/rollup/parcel config to migrate from. Phase 1 introduces tooling without contending with existing config.
- **Conventional Commits already used** (verified via recent commits — `docs:`, `chore:`, `feat:`). ESLint commit-message linting (`commitlint`) **not** in Phase 1 scope (TOOL-01..12 doesn't include it; husky pre-commit only handles staged-file lint + gitleaks). Add to backlog if useful later.
- **Project structure is flat** (no `src/` directory). Vite default config assumes flat structure works; Phase 4's modular split introduces `firebase/`, `data/`, `domain/`, `auth/`, `cloud/`, `views/`, `ui/`, `observability/` directories per ARCHITECTURE.md §"Target source layout". Phase 1 must not pre-create these.

### Integration Points

- **`index.html` `<script>` tags** — Phase 1's `vite.config.js` references `index.html` as the entry but does **not** rewrite it (D-14). Researcher confirms the exact mechanism for "Vite-aware build without changing the deployed file".
- **`CNAME = baselayers.bedeveloped.com`** — owned by GitHub Pages today. Phase 1 leaves it alone. Phase 3 migrates the DNS pointing.
- **`.gitignore`** is minimal (5 lines: `.DS_Store`, `.vscode/`, `.idea/`, `*.log`, `node_modules/`). Phase 1 adds: `dist/`, `coverage/`, `.env`, `.env.*` (with `!.env.example`), `.firebase/` (for later phases), `*.tsbuildinfo`.
- **`.claude/launch.json`** likely references dev port 5178 per STACK.md. Researcher verifies; if so, Vite `server.port: 5178` keeps existing dev workflow intact.

### Quick-Win Bandwidth (deferred to Phase 4)

The lint config Phase 1 stands up will fire on ~30 `Math.random()` call sites + ~17 `innerHTML =` clears + 1 `html:` escape hatch + 7 `alert()` sites + every inline `style="..."`. **None of these are fixed in Phase 1** — Phase 4 owns CODE-01..13. Phase 1 just makes them visible (via the per-line disables in D-06) and time-bound (via the cleanup ledger D-08).

</code_context>

<specifics>
## Specific Ideas

- **Cleanup ledger (D-08)** is a load-bearing artefact — it converts "we ignored 50 lint errors" into a trackable to-do list that Phase 4 closes line-by-line. Without it, Phase 4 plays hide-and-seek to find every disable comment.
- **Branch-protection bootstrap as a runbook (D-12)** — not a CI workflow, not an Action. It's a one-time `gh api` call documented for evidence-pack reproducibility (DOC-09 will screenshot the resulting policy).
- **Soft fail for OSV-Scanner (D-20)** — distinct from `npm audit` (hard fail). Reason: OSV's broader DB has higher false-positive rate on first deployment; we want signal without blocking PRs the first week. Cleanup ledger entry that re-evaluates after 30 days.

</specifics>

<deferred>
## Deferred Ideas

- **commitlint / Conventional Commits enforcement** — already used by convention; add lint enforcement only if a future contributor breaks the pattern. Out of TOOL-01..12 scope.
- **Renovate** — STACK.md decision is Dependabot. If multi-platform / monorepo / complex grouping becomes relevant later, revisit. Not in this milestone.
- **CodeQL / Semgrep SAST** — STACK.md explicitly defers ("diminishing return for a vanilla-JS app of this size"). Revisit if a prospect questionnaire specifically asks.
- **Performance Monitoring SDK** — STACK.md defers. Adds bundle size + GDPR DPIA documentation burden without audit-critical-path leverage.
- **Pre-commit framework (Python `pre-commit`)** — heavier alternative to husky + lint-staged. Only justified if we add cross-language hooks (e.g., terraform fmt). Not relevant.
- **Auto-merge for Dependabot patch updates** — compliance posture is "human review on every bump" (STACK.md). Revisit after milestone close if dep-bump volume ever becomes a burden.
- **`functions/` workspace skeleton** — not in Phase 1 scope. Phase 7 (Cloud Functions) creates `functions/` from scratch; Dependabot config in D-19 has a forward-declared `functions/` ecosystem entry so Phase 7 doesn't have to remember.
- **OSV-Scanner hard fail** — soft fail in Phase 1 per D-20; revisit after 30 days of signal data.

</deferred>

---

_Phase: 01-engineering-foundation-tooling_
_Context gathered: 2026-05-03_
</content>
</invoke>
