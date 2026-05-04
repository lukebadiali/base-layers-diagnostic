# Phase 1: Engineering Foundation (Tooling) — Research

**Researched:** 2026-05-03
**Domain:** JavaScript build tooling, CI/CD, static analysis, supply-chain security
**Confidence:** HIGH — all versions verified against the live npm registry on 2026-05-03; config shapes verified against official docs; locked decisions from CONTEXT.md are authoritative and are not re-researched.

---

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

All 31 decisions D-01..D-31 in `01-CONTEXT.md` are locked. Key decisions relevant to planning:

- **D-01:** Pin to STACK.md verified-2026-05-03 versions exactly (see Standard Stack below).
- **D-02:** Node 22 LTS. Single version, not a matrix.
- **D-03:** `npm` only. No pnpm/yarn/bun.
- **D-04:** `@sentry/browser@10.51.0` installed as prod dep now; not initialised until Phase 9.
- **D-05:** IIFE is NOT refactored in Phase 1. Tooling adapts to it.
- **D-06:** ESLint with per-line `eslint-disable-next-line` on existing violations; no file-level disables; no blanket excludes.
- **D-07:** `app.js` gets a single `// @ts-nocheck` at top; all new files get `// @ts-check`.
- **D-08:** `runbooks/phase-4-cleanup-ledger.md` enumerates every disable comment.
- **D-09:** Single CI workflow. Jobs: `setup → lint → typecheck → test → audit → build`. Fail-fast disabled.
- **D-10:** All third-party Actions pinned to commit SHA.
- **D-11:** No deploy job in Phase 1. `dist/` uploaded as artefact.
- **D-12:** Branch protection configured via `gh api` runbook (`runbooks/branch-protection-bootstrap.md`).
- **D-13:** Build verification only — `npm run build` in CI; not deployed.
- **D-14:** `index.html` is NOT rewritten in Phase 1.
- **D-15:** Vite config coexistence with un-rewritten `index.html` — mechanism deferred to research (this doc resolves it).
- **D-16:** `husky@9.x` + `lint-staged@16.x`. ESLint --fix + Prettier --write on staged JS files. `gitleaks protect --staged` as separate pre-commit step.
- **D-17:** `gitleaks` installed as binary (scoop/brew); pre-commit hook + CI step. Documented in `CONTRIBUTING.md`.
- **D-18:** `.gitleaks.toml` with SHA-256-hex-64 custom rule.
- **D-19:** Dependabot: npm (root) + npm (functions/, forward-declared) + github-actions. Weekly cadence. Auto-merge off.
- **D-20:** OSV-Scanner as soft fail (`continue-on-error: true`). Logged in cleanup ledger.
- **D-21:** `npm audit --audit-level=high --omit=dev` as hard gate.
- **D-22:** Socket.dev GitHub App (UI step). Documented in `runbooks/socket-bootstrap.md`.
- **D-23:** OIDC runbook documented (`runbooks/firebase-oidc-bootstrap.md`); NOT provisioned in Phase 1.
- **D-24:** `SECURITY.md` skeleton with three populated sections: Build & Supply Chain, Dependency Monitoring, Secret Scanning. Stub sections for everything else.
- **D-25:** Each plan task that closes a SECURITY.md claim commits the SECURITY.md edit atomically.
- **D-26:** ESLint with `no-restricted-syntax` (Math.random) + `no-restricted-imports` (firebase/\* paths, soft warn in Phase 1).
- **D-27:** `.prettierrc.json`: `printWidth: 100, semi: true, singleQuote: false, trailingComma: "all"`.
- **D-28:** `tsconfig.json` per STACK.md exactly.
- **D-29:** `types/` directory for ambient declarations.
- **D-30:** One smoke test only: `tests/smoke.test.js`.
- **D-31:** Vitest config inline in `vite.config.js`. No coverage threshold.

### Claude's Discretion

- Exact config skeleton shapes for `vite.config.js`, `eslint.config.js`, `.gitleaks.toml`, `.husky/pre-commit`, `ci.yml`, `dependabot.yml`
- Exact branch-protection API payload
- OSV-Scanner CI invocation details
- Firebase OIDC runbook GCP commands
- SECURITY.md framework citation section IDs

### Deferred Ideas (OUT OF SCOPE)

- commitlint / Conventional Commits lint enforcement
- Renovate
- CodeQL / Semgrep SAST
- Performance Monitoring SDK
- Python `pre-commit` framework
- Auto-merge for Dependabot patch updates
- `functions/` workspace skeleton (Phase 7)
- OSV-Scanner hard fail (post-30-days re-evaluation)
  </user_constraints>

<phase_requirements>

## Phase Requirements

| ID      | Description                                                                                       | Research Support                                         |
| ------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| TOOL-01 | `package.json` declaring all production + dev dependencies                                        | Standard Stack section; Installation sequence            |
| TOOL-02 | Vite 8 build pipeline produces hashed-filename bundles                                            | Resolved Open Question 1; Architecture Patterns          |
| TOOL-03 | Firebase JS SDK self-hosted via Vite bundle (firebase@12.12.1)                                    | Standard Stack; coexistence strategy                     |
| TOOL-04 | Chart.js self-hosted via Vite bundle (chart.js@4.5.1)                                             | Standard Stack; coexistence strategy                     |
| TOOL-05 | ESLint 10 flat config + security plugins blocks Math.random/innerHTML regressions                 | Implementation Strategy; Code Examples                   |
| TOOL-06 | Prettier configured repo-wide                                                                     | Implementation Strategy                                  |
| TOOL-07 | TypeScript-as-typecheck via --allowJs --checkJs --strict                                          | Implementation Strategy                                  |
| TOOL-08 | GitHub Actions CI on every PR: lint + typecheck + Vitest + npm audit + OSV-Scanner + build        | Resolved Open Question 7; CI skeleton                    |
| TOOL-09 | Third-party Actions pinned to SHA; CI uses OIDC for Firebase auth (documentation only in Phase 1) | Resolved Open Question 4; CI skeleton                    |
| TOOL-10 | Dependabot for npm + github-actions, weekly cadence                                               | Implementation Strategy; Dependabot skeleton             |
| TOOL-11 | Socket.dev GitHub App installed                                                                   | Implementation Strategy (UI step; documented in runbook) |
| TOOL-12 | gitleaks pre-commit + CI                                                                          | Resolved Open Question 6; husky skeleton                 |
| DOC-10  | Incremental SECURITY.md skeleton with three populated sections                                    | Compliance Mapping; SECURITY.md Skeleton                 |

</phase_requirements>

---

## Summary

Phase 1 stands up an entirely new engineering foundation on a repo that currently has no `package.json`, no build tooling, no tests, and no CI. The IIFE in `app.js` is left structurally unchanged; all tooling is designed to coexist with it via narrowly-scoped overrides that make technical debt visible and time-bound rather than hiding or ignoring it. Nothing user-visible changes in production — the site continues shipping from GitHub Pages until Phase 3.

**The defining constraint** is the "quiet debt" posture (D-05): rather than fixing the 4,103-line IIFE now, Phase 1 introduces per-line `eslint-disable-next-line` comments on every existing violation (with phase-4 remediation notes), a single `// @ts-nocheck` on `app.js`, and a cleanup ledger that makes the debt trackable. Danger rules still fire as errors everywhere else — new code cannot introduce violations.

**Primary recommendation:** Introduce all tooling in dependency order across five waves: `package.json` + `node_modules` first, then config files, then hooks, then CI/CD, then runbooks and `SECURITY.md`. Every wave is independently testable before the next begins.

---

## Architectural Responsibility Map

| Capability                       | Primary Tier                     | Secondary Tier               | Rationale                                                      |
| -------------------------------- | -------------------------------- | ---------------------------- | -------------------------------------------------------------- |
| Dependency management            | Developer workstation            | CI (npm ci)                  | package.json declares; CI enforces reproducibility             |
| Static analysis (lint/typecheck) | CI (required gate)               | Pre-commit (fast feedback)   | Gate on CI is authoritative; pre-commit is convenience         |
| Secret scanning                  | Pre-commit (gitleaks)            | CI (gitleaks detect)         | Pre-commit stops secrets ever reaching repo; CI is backstop    |
| Build verification               | CI                               | Local (npm run build)        | CI is the authoritative "dist/ is valid" signal                |
| Dependency monitoring            | GitHub (Dependabot + Socket.dev) | CI (OSV-Scanner + npm audit) | Automated ongoing monitoring; CI provides per-PR point-in-time |
| Branch protection                | GitHub API (one-shot runbook)    | —                            | Platform-enforced; not in-repo config                          |
| OIDC trust config                | GCP (documented only)            | —                            | Phase 3 provisions; Phase 1 documents the runbook              |

---

## Standard Stack

All versions verified against the npm registry on 2026-05-03. These are locked by D-01 — use these exact strings, no drift.

### Core (production deps)

| Library         | Version | Purpose                                                                                 | Why Standard                                                                            |
| --------------- | ------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| firebase        | 12.12.1 | Firebase JS SDK — installed as npm dep now; runtime still served from CDN until Phase 4 | Upgrade from 10.13.0; closes H4 SRI gap once Vite bundles it; tree-shakable modular API |
| chart.js        | 4.5.1   | Radar + donut charts                                                                    | Drop-in upgrade from 4.4.1 in CDN; same tree-shakable API                               |
| dompurify       | 3.4.2   | HTML sanitiser — installed now; used in Phase 4                                         | Trail-of-Bits-audited; installed early so bundle-size budget is accurate from day one   |
| @sentry/browser | 10.51.0 | Error sink — installed now; initialised in Phase 9                                      | Installed early per D-04 so Phase 9 has no extra npm install PR                         |

### Build / test (devDeps)

| Library                      | Version | Purpose                                                | Notes                                                                  |
| ---------------------------- | ------- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| vite                         | 8.0.10  | Build pipeline + dev server                            | Requires Node 20.19+ / 22.12+ — confirmed compatible with D-02 Node 22 |
| vitest                       | 4.1.5   | Test runner                                            | Shares vite.config.js; same Rollup version line as Vite 8              |
| @vitest/coverage-v8          | 4.1.5   | Coverage provider                                      | Paired with Vitest at same version                                     |
| happy-dom                    | 20.9.0  | DOM environment for Vitest                             | Faster than jsdom; Vitest first-class support                          |
| typescript                   | 6.0.3   | JSDoc typecheck (--allowJs --checkJs --noEmit)         | No .ts files; typecheck only                                           |
| eslint                       | 10.3.0  | Static analysis                                        | Flat config (eslint.config.js); no legacy .eslintrc                    |
| @eslint/js                   | 10.0.1  | ESLint recommended rules                               | Peer of eslint@10; provides `recommended` config object                |
| eslint-plugin-no-unsanitized | 4.1.5   | Catches innerHTML/outerHTML/insertAdjacentHTML         | Closes M2 + C4 regression prevention                                   |
| eslint-plugin-security       | 4.0.0   | Catches Math.random, eval, unsafe regex                | Closes H5 regression prevention                                        |
| prettier                     | 3.8.3   | Code formatting                                        | Zero-config; wired into lint-staged                                    |
| @firebase/rules-unit-testing | 5.0.0   | Firestore/Storage Rules tests against emulator         | Installed now; used in Phase 5                                         |
| firebase-tools               | 15.16.0 | Firebase CLI; emulator suite                           | Pinned in devDeps so CI and local use same version                     |
| husky                        | 9.1.7   | Git hook manager (config-as-files, no `husky install`) | Latest; see Open Question 8                                            |
| lint-staged                  | 16.4.0  | Runs linters on staged files only                      | Latest; paired with husky 9                                            |

**Version verification:** All versions above confirmed via `npm view <pkg>@<version> version` on 2026-05-03. [VERIFIED: npm registry]

**Installation sequence:**

```bash
# Init package.json
npm init -y

# Production deps
npm install firebase@12.12.1 chart.js@4.5.1 dompurify@3.4.2 @sentry/browser@10.51.0

# Dev deps
npm install -D \
  vite@8.0.10 \
  vitest@4.1.5 \
  @vitest/coverage-v8@4.1.5 \
  happy-dom@20.9.0 \
  typescript@6.0.3 \
  eslint@10.3.0 \
  "@eslint/js@10.0.1" \
  eslint-plugin-no-unsanitized@4.1.5 \
  eslint-plugin-security@4.0.0 \
  prettier@3.8.3 \
  @firebase/rules-unit-testing@5.0.0 \
  firebase-tools@15.16.0 \
  husky@9.1.7 \
  lint-staged@16.4.0
```

---

## Architecture Patterns

### System Architecture Diagram

```
Developer workstation
  │
  ├─ git commit ──► .husky/pre-commit
  │                    ├─ lint-staged (eslint --fix + prettier --write on staged .js)
  │                    └─ gitleaks protect --staged
  │
  └─ git push / PR ──► GitHub
                          │
                          ├─ Dependabot (weekly: npm root, npm functions/, github-actions)
                          ├─ Socket.dev App (install-time behavioural scan on every dep bump PR)
                          └─ .github/workflows/ci.yml
                                 │
                                 ├─ setup job (actions/checkout + actions/setup-node@Node22 + npm ci)
                                 ├─ lint job (npm run lint)
                                 ├─ typecheck job (npm run typecheck)
                                 ├─ test job (npm test → Vitest smoke)
                                 ├─ audit job
                                 │    ├─ npm audit --audit-level=high --omit=dev [HARD FAIL]
                                 │    └─ npx google/osv-scanner-action [SOFT FAIL continue-on-error]
                                 └─ build job
                                      └─ npm run build → dist/ artefact upload (no deploy)
```

### Recommended Project Structure (Phase 1 deliverables only)

```
base-layers-diagnostic/
├── .github/
│   ├── workflows/
│   │   └── ci.yml
│   └── dependabot.yml
├── .husky/
│   └── pre-commit
├── .planning/                     (unchanged)
├── assets/                        (unchanged)
├── data/                          (unchanged)
├── tests/
│   └── smoke.test.js
├── types/
│   └── globals.d.ts               (ambient: __APP_VERSION__, firebase global if needed)
├── runbooks/
│   ├── branch-protection-bootstrap.md
│   ├── firebase-oidc-bootstrap.md
│   ├── socket-bootstrap.md
│   └── phase-4-cleanup-ledger.md
├── .gitleaks.toml
├── .gitignore                     (augmented)
├── .prettierrc.json
├── app.js                         (// @ts-nocheck added at line 1; per-line disables on violations)
├── eslint.config.js
├── firebase-init.js               (unchanged — no modifications in Phase 1)
├── index.html                     (unchanged)
├── package.json
├── SECURITY.md                    (new skeleton)
├── CONTRIBUTING.md                (gitleaks local setup docs)
├── tsconfig.json
└── vite.config.js
```

**Phase 1 MUST NOT create:** `src/`, `firebase/`, `data/domain/`, `auth/`, `views/`, `ui/`, `cloud/`, `observability/` — these are Phase 4 modular-split targets.

---

## Implementation Strategy

### Wave 0 — package.json + node_modules

**Files:** `package.json`, `.gitignore` (augmented)

`package.json` must declare:

- `"type": "module"` — required for Vite 8 ESM config files and flat ESLint config
- `"engines": { "node": ">=22.0.0" }` — enforces D-02 Node 22
- `"scripts"` block (see below)
- `"lint-staged"` block

```json
{
  "name": "base-layers-diagnostic",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.0.0" },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint . --max-warnings=0",
    "lint:fix": "eslint . --fix",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "prepare": "husky"
  },
  "lint-staged": {
    "*.js": ["eslint --fix --max-warnings=0", "prettier --write"]
  }
}
```

**`.gitignore` additions** (append to existing 5-line file):

```
dist/
coverage/
.env
.env.*
!.env.example
.firebase/
*.tsbuildinfo
firestore-debug.log
firebase-debug.log
.firebaserc
```

---

### Wave 1 — Config Files

**Files:** `vite.config.js`, `tsconfig.json`, `.prettierrc.json`, `eslint.config.js`

#### `vite.config.js`

See Resolved Open Question 1 for the full coexistence rationale. The config uses `index.html` as the entry point. Vite's dev server uses it as-is (CDN scripts load in dev); the build produces `dist/` with hashed bundles (the CDN scripts in the current `index.html` will also be present in the build output, but this is harmless — `dist/` is only used for build-verification in Phase 1, not deployed).

```javascript
// vite.config.js
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2020",
    sourcemap: true,
    rollupOptions: {
      input: { main: "index.html" },
      output: {
        manualChunks: {
          firebase: [
            "firebase/app",
            "firebase/auth",
            "firebase/firestore",
            "firebase/storage",
            "firebase/app-check",
          ],
          chart: ["chart.js"],
        },
      },
    },
  },
  server: {
    port: 5178, // matches .claude/launch.json (verified — serves on 5178)
  },
  test: {
    environment: "happy-dom",
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      reporter: ["text", "html"],
    },
  },
});
```

**Note on CDN scripts in the Phase 1 build:** Vite will process `index.html` and attempt to resolve the CDN `<script src="https://...">` tags. These will remain as external URLs in the output (Vite does not inline remote scripts). The `firebase` and `chart` manual chunks will be built from the npm packages even though the runtime-deployed site still loads CDN scripts. This is intentional: `dist/` is build-verification only in Phase 1; the dual-dependency (npm installed, CDN still used at runtime) is benign until Phase 4 performs the modular split and Phase 3 updates `index.html` for Firebase Hosting. See Resolved Open Question 3.

#### `tsconfig.json`

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "strict": true,
    "target": "es2020",
    "module": "esnext",
    "moduleResolution": "bundler",
    "skipLibCheck": true,
    "lib": ["es2020", "dom"],
    "baseUrl": "."
  },
  "include": ["**/*.js", "**/*.d.ts"],
  "exclude": ["node_modules", "dist", "functions/lib", "coverage"]
}
```

**Note:** `app.js` will have `// @ts-nocheck` at its first line (added in this phase). `firebase-init.js` and `data/pillars.js` may generate type errors; assess at typecheck-first-run and add per-file `// @ts-nocheck` only if the noise exceeds the signal — document in cleanup ledger.

#### `.prettierrc.json`

```json
{
  "printWidth": 100,
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all"
}
```

#### `eslint.config.js`

```javascript
// eslint.config.js
import js from "@eslint/js";
import noUnsanitized from "eslint-plugin-no-unsanitized";
import security from "eslint-plugin-security";

export default [
  // Global ignores — these dirs are never linted
  {
    ignores: ["dist/", "coverage/", "node_modules/", "functions/lib/"],
  },

  // Base recommended rules for all JS files
  {
    files: ["**/*.js"],
    ...js.configs.recommended,
  },

  // Security plugins — fire on all source files (including app.js with per-line disables)
  {
    files: ["**/*.js"],
    plugins: {
      "no-unsanitized": noUnsanitized,
      security,
    },
    rules: {
      // XSS prevention — any innerHTML/outerHTML/insertAdjacentHTML is error
      "no-unsanitized/method": "error",
      "no-unsanitized/property": "error",

      // CSPRNG enforcement — Math.random() is error everywhere
      "security/detect-pseudo-random-bytes": "error",
      // Additional security plugin rules
      "security/detect-non-literal-regexp": "warn",
      "security/detect-eval-with-expression": "error",

      // Block Math.random() explicitly (belt + suspenders with security plugin)
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message:
            "Use crypto.randomUUID() instead. Phase 4: replace all call sites. See runbooks/phase-4-cleanup-ledger.md",
        },
      ],

      // Block direct firebase/* imports outside firebase/ adapter (soft warn in Phase 1)
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: [
                "firebase/firestore",
                "firebase/storage",
                "firebase/auth",
                "firebase/app-check",
              ],
              message:
                "Import Firebase services only through the firebase/ adapter module. This will harden to 'error' in Phase 4.",
            },
          ],
        },
      ],
    },
  },
];
```

**Critical:** When `eslint . --max-warnings=0` is run against the current `app.js`, it will fail on every existing violation. The plan task for TOOL-05 must:

1. Run `eslint app.js --format=json > /tmp/violations.json` to enumerate all existing violations.
2. Add per-line `// eslint-disable-next-line <rule> -- Phase 4: <description>` on each.
3. Commit both the violations (with disables) and the ledger entry in `runbooks/phase-4-cleanup-ledger.md`.

The `no-restricted-imports` rule fires as `warn`, not `error`, so the `--max-warnings=0` flag means it will still block CI. Keep new files from importing firebase directly; existing `firebase-init.js` should not trigger this rule since it imports from the CDN URL string, not a bare specifier.

---

### Wave 2 — Pre-Commit Hooks

**Files:** `.husky/pre-commit`, `.gitleaks.toml`, `CONTRIBUTING.md`

#### Husky 9 setup (Resolved Open Question 8)

Husky 9 uses config-as-files. The `prepare` script in `package.json` (already declared in Wave 0) runs `husky` on `npm install`. Husky 9 creates `.husky/` automatically; the pre-commit file is just a shell script.

```bash
# .husky/pre-commit
npx lint-staged
npx gitleaks protect --staged --config .gitleaks.toml
```

No `husky install` call needed. The `prepare` script handles it. The `.husky/pre-commit` file must be executable — set with `chmod +x .husky/pre-commit` (or git will handle it on Unix; on Windows the file is always executable via git).

**To initialise husky after `npm install`:**

```bash
npm install   # triggers prepare → husky (creates .husky/ dir if not exists)
```

If `.husky/` is already in the repo, `husky` is a no-op. The pre-commit file needs to be committed to the repo (`.husky/pre-commit` is committed, not gitignored).

#### `.gitleaks.toml`

See Resolved Open Question 6 for the custom rule rationale.

```toml
# .gitleaks.toml
title = "Base Layers Diagnostic — gitleaks config"

[extend]
# Extend the default gitleaks ruleset
useDefault = true

[[rules]]
id = "sha256-hex-literal-regression"
description = "SHA-256 hex literal (64 chars) in source — regression check for C2 INTERNAL_PASSWORD_HASH pattern"
regex = '''(?i)(password|hash|secret|key|token|credential)[^=\n]{0,20}[=:]\s*["\']?[a-f0-9]{64}["\']?'''
secretGroup = 0
tags = ["custom", "c2-regression"]
severity = "CRITICAL"

[allowlist]
description = "Allow legitimate hex strings in test fixtures"
paths = [
  "tests/",
  "runbooks/",
]
regexes = [
  # Vitest snapshot hex is fine
  '''expect\([^)]+\)\.toBe\(["\'][a-f0-9]{64}["\']''',
]
```

**Note on gitleaks local install:** gitleaks is a binary (not on npm — confirmed 2026-05-03). The `npx gitleaks` invocation in the pre-commit hook requires the binary to be in PATH. Document in `CONTRIBUTING.md`:

- Windows: `scoop install gitleaks`
- macOS: `brew install gitleaks`
- The CI step uses `google/osv-scanner-action` pattern — for gitleaks in CI, use `gitleaks/gitleaks-action@v2` (pinned to SHA).

---

### Wave 3 — GitHub Actions CI

**File:** `.github/workflows/ci.yml`

See Resolved Open Question 5 for branch protection; see Open Question 7 for OSV-Scanner invocation.

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  setup:
    name: Install
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af # v4.1.0
        with:
          node-version: "22"
          cache: "npm"
      - run: npm ci

  lint:
    name: Lint
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
      - uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af
        with:
          node-version: "22"
          cache: "npm"
      - run: npm ci
      - run: npm run lint

  typecheck:
    name: Typecheck
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
      - uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af
        with:
          node-version: "22"
          cache: "npm"
      - run: npm ci
      - run: npm run typecheck

  test:
    name: Test
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
      - uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af
        with:
          node-version: "22"
          cache: "npm"
      - run: npm ci
      - run: npm test

  audit:
    name: Security Audit
    needs: setup
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
      - uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af
        with:
          node-version: "22"
          cache: "npm"
      - run: npm ci
      # Hard fail: npm audit on production deps
      - name: npm audit (prod deps, high severity)
        run: npm audit --audit-level=high --omit=dev
      # Soft fail: OSV-Scanner (broader advisory DB)
      - name: OSV-Scanner
        id: osv-scanner
        uses: google/osv-scanner-action/osv-scanner-action@63b7cb9cb68a3d7c42c88dd68a0fc7c47c8e1d98 # v1.8.5
        continue-on-error: true
        with:
          scan-args: |-
            --recursive
            --format=table
            .
      # CI gitleaks scan (backstop for devs who skip local hook)
      - name: gitleaks detect
        uses: gitleaks/gitleaks-action@9b35a74e8a32c63099bdc5d0f14fcc4b2ea3d07f # v2.3.6
        with:
          config-path: .gitleaks.toml

  build:
    name: Build
    needs: [lint, typecheck, test, audit]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
      - uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af
        with:
          node-version: "22"
          cache: "npm"
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@65c4c4a1ddee5b72f98dc3e02f09a3e8b4ef87dc # v4.6.0
        with:
          name: dist
          path: dist/
          retention-days: 7
```

**Important notes on Action SHAs:**

- The SHAs above are illustrative placeholders. The executor MUST replace them with actual current SHAs from `github.com/actions/checkout/releases`, `github.com/actions/setup-node/releases`, etc. before committing.
- Dependabot's `github-actions` ecosystem (declared in `dependabot.yml`) will then keep them updated weekly.
- The `google/osv-scanner-action` SHA must be retrieved from `github.com/google/osv-scanner-action/releases`.
- The `gitleaks/gitleaks-action` SHA from `github.com/gitleaks/gitleaks-action/releases`.

**fail-fast: false** is the default for parallel jobs in GitHub Actions (each job runs independently). Since the jobs are declared with `needs:` relationships, each can fail independently. Adding `strategy: { fail-fast: false }` is only needed inside a matrix; here it is implicit.

---

### Wave 4 — Dependabot

**File:** `.github/dependabot.yml`

```yaml
# .github/dependabot.yml
version: 2

updates:
  # Root npm packages
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    rebase-strategy: "auto"
    # auto-merge is NOT set — human review on every dep bump (D-19)

  # functions/ workspace (forward-declared for Phase 7)
  - package-ecosystem: "npm"
    directory: "/functions"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    rebase-strategy: "auto"

  # GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    rebase-strategy: "auto"
```

**Note on `functions/` directory:** This directory does not exist in Phase 1. Dependabot silently skips ecosystem directories that don't exist yet — it will start scanning `functions/` automatically once Phase 7 creates it. No follow-up config change needed.

---

### Wave 5 — Runbooks + Tests + SECURITY.md Skeleton

**Files:** `runbooks/branch-protection-bootstrap.md`, `runbooks/firebase-oidc-bootstrap.md`, `runbooks/socket-bootstrap.md`, `runbooks/phase-4-cleanup-ledger.md`, `tests/smoke.test.js`, `types/globals.d.ts`, `CONTRIBUTING.md`, `SECURITY.md`

#### `tests/smoke.test.js`

```javascript
// tests/smoke.test.js
// @ts-check

/**
 * Smoke test — exists only so `npm test` doesn't emit "no tests found" warning.
 * Real test coverage is Phase 2 (TEST-01..07 + TEST-10).
 */
import { describe, it, expect } from "vitest";

describe("Smoke", () => {
  it("arithmetic works", () => {
    expect(1 + 1).toBe(2);
  });
});
```

#### `types/globals.d.ts`

```typescript
// types/globals.d.ts
// Ambient declarations for globals injected by Vite and legacy globals
// Phase 4: review which of these are still needed after modular split

declare const __APP_VERSION__: string;

// Legacy global from data/pillars.js (window.BASE_LAYERS)
// Phase 4: replace with ES module import from data/pillars.js
declare interface Window {
  BASE_LAYERS: unknown;
  // Phase 4: remove once firebase-init.js is replaced by firebase/ adapter
  FB: unknown;
  Chart: unknown;
}
```

---

## Resolved Open Questions

### OQ-1: Vite + un-rewritten `index.html` coexistence (D-15)

**Question:** How does Vite 8 produce `dist/` from `index.html` as the entry while leaving the live GH-Pages-shipped `index.html` unchanged?

**Resolution:** Use `index.html` as Vite's entry directly (`rollupOptions.input: { main: "index.html" }`). The current `index.html` contains CDN `<script>` tags pointing to `gstatic.com` and `jsdelivr.net`. Vite's behaviour with external URLs is to leave them as-is in the output — it does not inline remote scripts. What this means in Phase 1:

- **`npm run dev` (dev server):** Vite serves `index.html` as-is. The CDN scripts load from the network. The npm-installed `firebase@12.12.1` and `chart.js@4.5.1` packages are NOT loaded at runtime (nothing imports them yet). This is correct for Phase 1.
- **`npm run build` (CI build verification):** Vite builds `dist/index.html` with hashed JS chunks generated from the npm packages (the `manualChunks` in `rollupOptions.output`). The CDN `<script>` tags from the source `index.html` will appear in `dist/index.html` alongside the Vite-generated `<script type="module">` tag. This is harmless because `dist/` is NOT deployed in Phase 1.
- **Live GH-Pages site:** Continues to serve from repo root `index.html` unchanged. No Vite involvement.

**Why no `dev-index.html` symlink or copy strategy is needed:** A separate dev entry would require maintaining two HTML files in sync for the entire time between Phase 1 and Phase 3 — that's a maintenance burden with no payoff. The CDN scripts loading in dev is not a problem (they work fine; this is the current production state). The Vite build producing a slightly hybrid output is also not a problem because `dist/` is only CI-verified, not deployed.

**SRI for CDN paths:** Vite does not generate SRI `integrity=` attributes for remote `<script>` tags in `dist/index.html`. This is correct — SRI for CDN scripts will be addressed when Phase 4 removes CDN scripts entirely (the npm packages take over) and Phase 3 deploys `dist/` to Firebase Hosting.

**Concrete vite.config.js shape:** See Implementation Strategy above. [VERIFIED: STACK.md §Build setup — matches Vite 8 docs pattern]

---

### OQ-2: `.claude/launch.json` dev port verification

**Question:** Does `.claude/launch.json` reference port 5178?

**Resolution:** Confirmed. `.claude/launch.json` line 8: `"port": 5178`. The `serve.py` script uses Python's `http.server` on that port. Set `server.port: 5178` in `vite.config.js` to keep the dev workflow consistent for anyone who has the launch config wired up. [VERIFIED: read .claude/launch.json directly]

---

### OQ-3: Firebase npm dep + CDN dual-load benign for Phase 1

**Question:** Is it safe to have `firebase@12.12.1` in `package.json` while the CDN `<script>` tags for 10.13.0 still execute at runtime?

**Resolution:** Yes, completely benign. The npm-installed `firebase@12.12.1` is installed into `node_modules/` but nothing imports it yet — no source file has `import { ... } from "firebase/..."`. The CDN scripts in `index.html` load `firebase 10.13.0` from `gstatic.com` and expose `window.FB`. The npm package sits inert in `node_modules/` until Phase 4 introduces ES module imports.

The only subtle risk: if the typecheck (`tsc --noEmit --allowJs --checkJs`) were to auto-resolve types from the npm package in a way that conflicts with how `window.FB` is used in `app.js` — but since `app.js` has `// @ts-nocheck`, this is suppressed. The `types/globals.d.ts` ambient declaration (`declare interface Window { FB: unknown }`) covers the typecheck for new files that reference `window.FB`.

**Version mismatch at build time:** Vite's `manualChunks` will include `firebase/app`, `firebase/auth`, etc. from the npm package (12.12.1). The CDN scripts are external URLs untouched by the bundle. In `dist/`, both exist. This is harmless for Phase 1 (dist/ not deployed). [ASSUMED: no official doc explicitly addresses this dual-presence, but it follows from Vite's external URL handling being no-op]

---

### OQ-4: OIDC for Firebase Auth — Phase 1 documentation only (D-23)

**Question:** What are the exact GCP commands + GitHub Actions OIDC trust syntax for the runbook?

**Resolution:** The following is the complete content for `runbooks/firebase-oidc-bootstrap.md`. Phase 3 executes these commands; Phase 1 only commits the document.

```markdown
# Firebase OIDC Bootstrap Runbook

> Phase 1: Document only. Do NOT provision until Phase 3.
> Phase 3: Run these commands before wiring the deploy job.

## Prerequisites

- `gcloud` CLI authenticated as project owner
- Firebase project ID: bedeveloped-base-layers
- GitHub repo: AssumeAIhugh/base-layers-diagnostic

## Step 1: Create Workload Identity Pool

    gcloud iam workload-identity-pools create "github-actions" \
      --project="bedeveloped-base-layers" \
      --location="global" \
      --display-name="GitHub Actions"

## Step 2: Create OIDC Provider in the Pool

    gcloud iam workload-identity-pools providers create-oidc "github-oidc" \
      --project="bedeveloped-base-layers" \
      --location="global" \
      --workload-identity-pool="github-actions" \
      --display-name="GitHub OIDC" \
      --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
      --issuer-uri="https://token.actions.githubusercontent.com"

## Step 3: Create Service Account for Firebase Deploy

    gcloud iam service-accounts create "github-actions-deploy" \
      --project="bedeveloped-base-layers" \
      --display-name="GitHub Actions Deploy SA"

## Step 4: Grant Firebase Hosting Admin to the SA

    gcloud projects add-iam-policy-binding "bedeveloped-base-layers" \
      --member="serviceAccount:github-actions-deploy@bedeveloped-base-layers.iam.gserviceaccount.com" \
      --role="roles/firebase.admin"

## Step 5: Bind Workload Identity to the SA (repo-scoped)

    gcloud iam service-accounts add-iam-policy-binding \
      "github-actions-deploy@bedeveloped-base-layers.iam.gserviceaccount.com" \
      --project="bedeveloped-base-layers" \
      --role="roles/iam.workloadIdentityUser" \
      --member="principalSet://iam.googleapis.com/projects/$(gcloud projects describe bedeveloped-base-layers --format='value(projectNumber)')/locations/global/workloadIdentityPools/github-actions/attribute.repository/AssumeAIhugh/base-layers-diagnostic"

## Step 6: GitHub Actions workflow snippet (Phase 3 ci.yml deploy job)

    - uses: google-github-actions/auth@<SHA>
      with:
        workload_identity_provider: 'projects/<PROJECT_NUMBER>/locations/global/workloadIdentityPools/github-actions/providers/github-oidc'
        service_account: 'github-actions-deploy@bedeveloped-base-layers.iam.gserviceaccount.com'

    - uses: google-github-actions/setup-gcloud@<SHA>

    - run: firebase deploy --only hosting --project bedeveloped-base-layers

## Notes

- Replace <PROJECT_NUMBER> with output of `gcloud projects describe bedeveloped-base-layers --format='value(projectNumber)'`
- No long-lived service account JSON key stored in GitHub Secrets
- Token is scoped to this exact repo; forks cannot request a token
```

[CITED: https://firebase.google.com/docs/hosting/github-integration] [CITED: https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines]

---

### OQ-5: Branch protection bootstrap payload (D-12)

**Question:** Exact `gh api` payload for the branch protection runbook.

**Resolution:** The following is the content for `runbooks/branch-protection-bootstrap.md`.

**Important pre-condition (LANDMINE):** Branch protection with required status checks will LOCK OUT all pushes to `main` until at least one successful CI run has established the check names. If the CI workflow has never run, the status check names (`lint`, `typecheck`, `test`, `audit`, `build`) don't exist in GitHub yet, and the protection will either fail to apply or prevent all merges. **Apply branch protection AFTER the first successful CI run.** This is a documented step in Wave 5 sequencing.

```markdown
# Branch Protection Bootstrap Runbook

> Run AFTER the first successful CI run on the repo (status checks must exist before
> referencing them). This is a one-shot operation. Re-run to update settings.

## Prerequisites

- `gh` CLI authenticated as a repo admin
- First CI run must have completed successfully (creates the check names)

## Command

    gh api repos/AssumeAIhugh/base-layers-diagnostic/branches/main/protection \
      --method PUT \
      --header "Accept: application/vnd.github+json" \
      --field required_status_checks[strict]=true \
      --field "required_status_checks[contexts][]=lint" \
      --field "required_status_checks[contexts][]=typecheck" \
      --field "required_status_checks[contexts][]=test" \
      --field "required_status_checks[contexts][]=audit" \
      --field "required_status_checks[contexts][]=build" \
      --field required_pull_request_reviews[required_approving_review_count]=1 \
      --field required_pull_request_reviews[dismiss_stale_reviews]=true \
      --field required_linear_history=true \
      --field allow_force_pushes=false \
      --field allow_deletions=false \
      --field enforce_admins=false

## Verification

    gh api repos/AssumeAIhugh/base-layers-diagnostic/branches/main/protection | jq .

## Evidence screenshot

Save a screenshot of `https://github.com/AssumeAIhugh/base-layers-diagnostic/settings/branches`
to `docs/evidence/branch-protection-screenshot.png` (for DOC-09 evidence pack).
```

[VERIFIED: GitHub REST API docs — `PUT /repos/{owner}/{repo}/branches/{branch}/protection`]

---

### OQ-6: gitleaks custom rule for SHA-256 hex regression (D-18)

**Question:** Exact `.gitleaks.toml` `[[rules]]` regex for the INTERNAL_PASSWORD_HASH regression.

**Resolution:** The custom rule in the `.gitleaks.toml` above (Implementation Strategy — Wave 2) is:

```
regex = '''(?i)(password|hash|secret|key|token|credential)[^=\n]{0,20}[=:]\s*["\']?[a-f0-9]{64}["\']?'''
```

**Rationale:** The original C2 finding was `INTERNAL_PASSWORD_HASH = "6110f27c9c91658c3489285abd5c45ffe5c1aa99c7f3f37d23e32834566e7fce"`. The regex matches:

- A context word (password, hash, secret, key, token, credential) — reduces false positives from random 64-char hex in things like Firebase App Check tokens (which don't have a `password`/`secret` label beside them)
- Up to 20 chars before the `=` or `:` assignment
- Optional whitespace and optional quote characters
- Exactly 64 hex chars `[a-f0-9]{64}`

**Allowlist paths** (`tests/`, `runbooks/`) let test fixtures include known-good hex for regression testing.

**Known false positives to verify after first run:**

- Firebase API keys are not 64-char hex (they are base64 or alphanumeric, typically 39 chars) — should not trigger
- Storage bucket names — not 64-char hex
- Firestore document IDs (20-char alphanumeric) — not 64-char hex

Run `gitleaks detect --source . --config .gitleaks.toml --verbose` on first setup to confirm no false positives on the existing codebase. [ASSUMED: regex pattern derived from the known C2 value; exact false-positive rate on this repo not measured]

---

### OQ-7: OSV-Scanner CI invocation (D-20)

**Question:** Is `npx osv-scanner@latest -r .` the canonical invocation? What is the soft-fail pattern?

**Resolution:** OSV-Scanner is **not on npm** (confirmed 2026-05-03 — `npm view osv-scanner` returns nothing). The canonical CI invocation for Phase 1 is the **GitHub Action** `google/osv-scanner-action`, NOT `npx osv-scanner@latest`. The `npx` form in STACK.md/CONTEXT.md appears to reference an older installation pattern — use the Action instead.

```yaml
- name: OSV-Scanner
  id: osv-scanner
  uses: google/osv-scanner-action/osv-scanner-action@<SHA>
  continue-on-error: true # D-20: soft fail in Phase 1
  with:
    scan-args: |-
      --recursive
      --format=table
      .
```

`continue-on-error: true` is the correct GitHub Actions pattern for "warn but don't block". The job step will show as yellow (warning) rather than red (failure), and the overall workflow will still pass. [VERIFIED: github.com/google/osv-scanner-action README]

**Cleanup ledger entry:** Note the soft-fail status in `runbooks/phase-4-cleanup-ledger.md` with a 30-day re-evaluation marker: "Harden OSV-Scanner to `continue-on-error: false` after establishing baseline false-positive rate (review date: 2026-06-03)."

---

### OQ-8: Husky 9 + lint-staged 16 setup (D-16)

**Question:** Confirm exact `package.json` `prepare` script + `.husky/pre-commit` shape for husky 9.

**Resolution:** Husky 9 completely changed the setup from husky 8. There is no `husky install` command. The new pattern:

1. **`package.json` `prepare` script:** `"prepare": "husky"` (just the word `husky`, no arguments)
2. **`npm install` triggers `prepare`**, which runs `husky`. Husky 9's `husky` binary:
   - Checks if `.husky/` directory exists; creates it if not
   - Writes a `.husky/.gitignore` to ignore the `_/` subdirectory that husky uses internally
   - Does NOT write hook files — those are manually created and committed
3. **`.husky/pre-commit`** is a plain shell script, committed to the repo, executable. Content:

```bash
#!/usr/bin/env sh
npx lint-staged
npx gitleaks protect --staged --config .gitleaks.toml
```

4. **`lint-staged` config** lives in `package.json` under the `"lint-staged"` key (see Wave 0 — `package.json`).

**Windows caveat:** On Windows, `npm run prepare` will create the `.husky/` dir and the `.husky/_/husky.sh` file but Git hooks are still invoked via Git for Windows/WSL. The pre-commit file should use `#!/usr/bin/env sh` shebang and avoid Windows-only paths. The `npx` invocations work cross-platform.

**Verification test:** After `npm install`, run `git commit --dry-run --allow-empty -m "test"` — should trigger the pre-commit hook and run `lint-staged` (prints "No staged files match..." if nothing staged, which is fine). [VERIFIED: husky 9.x official docs — https://typicode.github.io/husky/]

---

## Validation Architecture

This section maps each TOOL-XX requirement to a testable assertion. These assertions form the basis for `VALIDATION.md` (Phase 1 verification).

### Test Framework

| Property           | Value                      |
| ------------------ | -------------------------- |
| Framework          | Vitest 4.1.5               |
| Config file        | Inline in `vite.config.js` |
| Quick run command  | `npm test`                 |
| Full suite command | `npm test -- --coverage`   |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                   | Test Type        | Automated Command                                                                                                                                                                              | Notes                                                                      |
| ------- | ---------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| TOOL-01 | `package.json` exists with correct deps                    | Manual verify    | `node -e "require('./package.json')"`                                                                                                                                                          | No unit test needed — file presence + `npm ci` success is evidence         |
| TOOL-02 | Vite build produces hashed-filename bundles                | CI build + smoke | `npm run build && ls dist/assets/*.js`                                                                                                                                                         | Filename contains content hash if Vite config is correct                   |
| TOOL-03 | firebase@12.12.1 in node_modules                           | npm verify       | `npm list firebase`                                                                                                                                                                            | `npm ci` reproducibility test                                              |
| TOOL-04 | chart.js@4.5.1 in node_modules                             | npm verify       | `npm list chart.js`                                                                                                                                                                            | Same as above                                                              |
| TOOL-05 | ESLint blocks Math.random() in new code                    | Unit (lint)      | `echo 'Math.random()' > /tmp/test.js && npx eslint /tmp/test.js && echo "SHOULD HAVE FAILED"`                                                                                                  | Should exit non-zero                                                       |
| TOOL-05 | ESLint blocks innerHTML= in new code                       | Unit (lint)      | `echo 'el.innerHTML = x' > /tmp/test.js && npx eslint /tmp/test.js && echo "SHOULD HAVE FAILED"`                                                                                               | Should exit non-zero                                                       |
| TOOL-05 | `npm run lint` passes on committed codebase                | CI lint          | `npm run lint` in CI (green)                                                                                                                                                                   | Per-line disables must be in place first                                   |
| TOOL-06 | Prettier configured                                        | Manual           | `npm run format:check` (no diff)                                                                                                                                                               |                                                                            |
| TOOL-07 | Typecheck runs without error                               | CI typecheck     | `npm run typecheck`                                                                                                                                                                            | `// @ts-nocheck` on app.js must be in place                                |
| TOOL-07 | A JSDoc type mismatch in a new file is caught              | Unit (typecheck) | Create `types/test-type-check.js` with a deliberate mismatch, run `tsc --noEmit`, verify exit code 1, delete file                                                                              | Manual verification during Wave 1                                          |
| TOOL-08 | CI workflow runs and all jobs green                        | CI               | Push to PR branch, observe all 5 jobs pass                                                                                                                                                     | First successful run also creates status check names for branch protection |
| TOOL-09 | All Actions pinned to SHA (not tag)                        | Code review      | `grep -E "uses: .+@v[0-9]" .github/workflows/ci.yml` should return empty                                                                                                                       | SHA must match `uses: owner/repo@<40-char-sha>` pattern                    |
| TOOL-10 | Dependabot config valid YAML                               | Syntax check     | `npx js-yaml .github/dependabot.yml`                                                                                                                                                           |                                                                            |
| TOOL-11 | Socket.dev installed                                       | Manual evidence  | Screenshot of https://github.com/AssumeAIhugh/base-layers-diagnostic showing Socket.dev check on a PR                                                                                          | For DOC-09 evidence pack                                                   |
| TOOL-12 | gitleaks blocks a commit with INTERNAL_PASSWORD_HASH shape | Manual           | `echo 'const HASH = "6110f27c9c91658c3489285abd5c45ffe5c1aa99c7f3f37d23e32834566e7fce"' > /tmp/leak.js && git add /tmp/leak.js && git commit -m "test"` — should be blocked by pre-commit hook | Clean up with `git restore --staged`                                       |
| TOOL-12 | gitleaks CI step catches secrets in PR                     | CI               | Inject a test secret in a branch, push, observe gitleaks job fail                                                                                                                              | Verify during Wave 3 integration testing                                   |
| DOC-10  | SECURITY.md skeleton exists with three populated sections  | Manual           | `cat SECURITY.md` — sections "Build & Supply Chain", "Dependency Monitoring", "Secret Scanning" must exist with framework citations                                                            |                                                                            |

### Wave 0 Gaps

- [ ] `tests/smoke.test.js` — Vitest smoke test (Wave 5)
- [ ] `types/globals.d.ts` — ambient declarations (Wave 5)
- [ ] No existing test infrastructure to extend; full framework created in this phase

---

## Pitfalls / Landmines

### Pitfall A: Branch protection applied before first CI run

**What goes wrong:** If you apply the `gh api` branch protection runbook before the CI workflow has ever run a commit, the status check names (`lint`, `typecheck`, `test`, `audit`, `build`) don't exist in GitHub's check registry yet. The API call will either error or apply protection that references non-existent checks — meaning NO commit can ever merge because the checks are required but never run.

**Prevention:** Apply branch protection as the LAST step of Phase 1, after at least one successful CI run. The `runbooks/branch-protection-bootstrap.md` must include this as a hard prerequisite.

**Detection:** `gh api repos/AssumeAIhugh/base-layers-diagnostic/branches/main/protection` returning a `required_status_checks` block where `contexts` are empty or the checks don't appear in any PR's status list.

---

### Pitfall B: `"type": "module"` breaks older config patterns

**What goes wrong:** Adding `"type": "module"` to `package.json` means every `.js` file in the project is treated as ESM. If any tool still uses `require()` style configs (e.g., a `.eslintrc.js` using `module.exports = {}`), it will break with `SyntaxError: require is not defined`.

**Prevention:** All config files must use ESM syntax (`export default { ... }`). For this phase: `vite.config.js` uses `export default defineConfig(...)` (ESM, correct). `eslint.config.js` uses `export default [...]` (ESM flat config, correct). `.prettierrc.json` is JSON, not affected. No `.eslintrc.js` must exist.

**Watch out for:** Any npm `postinstall` scripts from dependencies that assume CommonJS. Check with `npm install --dry-run` first.

---

### Pitfall C: ESLint 10 flat config + `no-unsanitized` plugin compatibility

**What goes wrong:** `eslint-plugin-no-unsanitized@4.1.5` exports both a `recommended` config and individual rules. In flat config, the import pattern is different from legacy `.eslintrc`.

**Correct flat-config usage:**

```javascript
import noUnsanitized from "eslint-plugin-no-unsanitized";

export default [
  {
    plugins: { "no-unsanitized": noUnsanitized },
    rules: {
      "no-unsanitized/method": "error",
      "no-unsanitized/property": "error",
    },
  },
];
```

**Incorrect (legacy pattern — will fail with flat config):**

```javascript
// WRONG — extends is not valid in flat config objects
{
  extends: ["plugin:no-unsanitized/recommended"],
}
```

[VERIFIED: eslint-plugin-no-unsanitized@4.1.5 README documents flat config usage]

---

### Pitfall D: Vite 8 dropped Node 18

**What goes wrong:** Running `npm run build` or `npm run dev` on a machine with Node 18 will fail with a runtime error about unsupported Node version.

**Prevention:** D-02 already locks Node 22. The `"engines": { "node": ">=22.0.0" }` in `package.json` makes npm warn (not error by default) on version mismatch. To enforce it, add to `.npmrc`: `engine-strict=true`. This causes `npm install` to fail on Node 18.

**CI:** The `actions/setup-node` step with `node-version: "22"` ensures CI always uses Node 22. [VERIFIED: STACK.md §Version Compatibility — Vite 8 requires Node 20.19+ or 22.12+]

---

### Pitfall E: `lint-staged` with `--max-warnings=0` causes false pre-commit failures

**What goes wrong:** The `lint-staged` config runs `eslint --fix --max-warnings=0` on staged files. If a file has any warning (not error), `--max-warnings=0` treats it as a failure and blocks the commit — even though the warning might be expected (e.g., the soft `no-restricted-imports` warn rule on existing firebase imports).

**Prevention:** Keep `no-restricted-imports` as `"warn"` in the ESLint config (D-26 explicitly says "soft (warn) in Phase 1"). But `--max-warnings=0` means even one warning blocks. Two options:

1. Change pre-commit lint-staged to `eslint --fix` (without `--max-warnings`) and only use `--max-warnings=0` in CI. This is the recommended approach — pre-commit provides fast feedback, CI is the authoritative gate.
2. Or keep `--max-warnings=0` everywhere but change `no-restricted-imports` to `"error"` (hardens faster, but D-26 says warn in Phase 1).

**Recommendation:** Pre-commit uses `eslint --fix` (no `--max-warnings`). CI `lint` job uses `eslint . --max-warnings=0`. This separates "developer fast-fix" from "authoritative gate".

**lint-staged config update:**

```json
"lint-staged": {
  "*.js": [
    "eslint --fix",
    "prettier --write"
  ]
}
```

---

### Pitfall F: TypeScript strict mode on `firebase-init.js` and `data/pillars.js`

**What goes wrong:** `tsconfig.json` includes `**/*.js` for typecheck. `firebase-init.js` imports from CDN URLs (`"https://www.gstatic.com/firebasejs/10.13.0/..."`) — TypeScript cannot resolve these as modules and will error.

**Prevention:** `tsconfig.json` already has `"moduleResolution": "bundler"`. CDN URL imports will still likely cause `TS2307: Cannot find module 'https://...'` errors. Since `firebase-init.js` is being left unchanged in Phase 1, add `// @ts-nocheck` to it — document in the cleanup ledger. Same treatment for `data/pillars.js` if it generates type noise.

**Decision rule:** Add `// @ts-nocheck` to a file if and only if it generates errors that Phase 1 cannot fix without violating the "no IIFE refactor in Phase 1" constraint. Track each `@ts-nocheck` in the cleanup ledger with its removal condition.

---

### Pitfall G: OSV-Scanner Action SHA pinning divergence

**What goes wrong:** `google/osv-scanner-action` publishes releases but the SHA pinning in `ci.yml` may drift from what Dependabot knows about. If `ci.yml` references a SHA and Dependabot creates a PR to update it, but the SHA format differs between what you pinned and what Dependabot expects, the PR may break.

**Prevention:** Always use the SHA of a tagged release (not a commit on `main`). Get the SHA from the release page: `https://github.com/google/osv-scanner-action/releases`. Dependabot will then update it cleanly via the `github-actions` ecosystem config.

---

### Pitfall H: Husky 9 `prepare` script runs on `npm ci` in CI

**What goes wrong:** `"prepare": "husky"` runs on `npm install` AND `npm ci`. In CI, there is no `.git` directory available at the typical working directory path used by Actions (it might be present as a shallow clone). Husky 9 will throw `error: Not in a git repository` on `npm ci` in CI.

**Prevention:** Use the standard Husky 9 pattern to skip in CI:

```json
"prepare": "node -e \"if (process.env.CI !== 'true') require('child_process').execSync('husky', {stdio: 'inherit'})\""
```

Or more simply, per Husky 9 docs:

```json
"prepare": "husky || true"
```

The `|| true` means the prepare step always exits 0, even if husky fails in CI because of no `.git` directory. This is the officially recommended pattern. [VERIFIED: https://typicode.github.io/husky/ — "CI/Docker/Prod" section]

---

## Sequencing Within Phase 1

### Wave dependency graph

```
Wave 0 (package.json + npm install)
    │
    ├── Wave 1 (config files — depends on node_modules)
    │       vite.config.js, tsconfig.json, eslint.config.js, .prettierrc.json
    │
    ├── Wave 2 (pre-commit hooks — depends on husky in node_modules)
    │       .husky/pre-commit, .gitleaks.toml, CONTRIBUTING.md
    │       ↕ (independently testable: gitleaks + lint-staged both need Wave 0)
    │
    ├── Wave 3 (CI workflow — depends on config files being finalized)
    │       .github/workflows/ci.yml
    │       ← MUST have Waves 0+1 committed before first push for CI to pass
    │
    ├── Wave 4 (Dependabot — depends on .github/ directory existing)
    │       .github/dependabot.yml
    │
    └── Wave 5 (runbooks + SECURITY.md skeleton + tests — no blocking deps)
            tests/smoke.test.js, types/globals.d.ts
            runbooks/*, CONTRIBUTING.md, SECURITY.md
            ↓
            Branch protection runbook (MUST run after first successful CI run)
```

### Parallel opportunities

- Wave 2 (hooks) and Wave 4 (Dependabot) can be developed in parallel with Wave 3 (CI) — they don't block each other.
- Wave 5 artifacts (runbooks, SECURITY.md) can be drafted before Wave 3 is green — they're documentation, not code.
- The `app.js` per-line disable sweep (required for `npm run lint` to pass) can happen in parallel with writing `eslint.config.js`.

### Critical path

1. `package.json` + `npm install` (Wave 0) — nothing else works without this
2. `eslint.config.js` + per-line disables on `app.js` — required for `npm run lint` to pass in CI
3. `// @ts-nocheck` on `app.js` (and `firebase-init.js` if needed) — required for `npm run typecheck` to pass
4. First CI green run — required before branch protection can be applied
5. Branch protection runbook execution — final step

### Atomic commit requirement (D-25)

Each plan task that closes a SECURITY.md claim must commit the SECURITY.md edit in the same commit. Concretely:

- "Add Dependabot config" commit must also include the "§ Dependency Monitoring" section addition to `SECURITY.md`.
- "Add gitleaks config + pre-commit hook" commit must also include the "§ Secret Scanning" section addition to `SECURITY.md`.
- "Add Vite build pipeline" commit must also include the "§ Build & Supply Chain" section addition to `SECURITY.md`.

---

## Compliance Mapping

### SECURITY.md Skeleton — Section Content

The three sections that Phase 1 populates fully (D-24):

#### § Build & Supply Chain (TOOL-02, TOOL-03, TOOL-04)

```markdown
## Build & Supply Chain

**Control:** All production dependencies (Firebase JS SDK, Chart.js, DOMPurify, Sentry) are
self-hosted via the Vite 8 build pipeline. Build output uses content-hashed filenames
(`app-[hash].js`) eliminating cache-busting fragility (previously `?v=46` hand-bumping).
Third-party scripts load from `node_modules` — no runtime CDN dependency.

**Status:** Phase 1 establishes the build pipeline. CDN script removal completes in Phase 4
(modular split) when `dist/index.html` replaces the CDN script tags. Phase 3 deploys `dist/`
to Firebase Hosting — SRI `integrity=` attributes are then generated by Vite for all bundles.

**Framework citations:**

- OWASP ASVS L2 V14.4.2 — all client-side resources are served from a controlled origin
- OWASP ASVS L2 V14.2.1 — all components kept up to date; Dependabot automates monitoring
- ISO/IEC 27001:2022 A.8.25 — secure development life cycle
- ISO/IEC 27001:2022 A.8.28 — secure coding (Vite build enforces ESM tree-shaking, no dead code paths served)
- SOC 2 CC8.1 — change management (all dependency changes gated by CI + human review)
```

#### § Dependency Monitoring (TOOL-10, TOOL-11)

```markdown
## Dependency Monitoring

**Controls:**

- **Dependabot** monitors `npm` (root) + `npm` (`functions/`) + `github-actions` ecosystems.
  Weekly cadence. All PRs require human review before merge (no auto-merge).
- **Socket.dev GitHub App** provides behavioural malicious-package detection (install-time
  network calls, `preinstall`/`postinstall` script abuse) on every dependency update PR.
- **OSV-Scanner** runs on every PR via GitHub Actions, checking against the OSV.dev advisory
  database (broader coverage than npm advisory DB alone).
- **`npm audit --audit-level=high --omit=dev`** is a hard CI gate — PRs with high-severity
  production dep vulnerabilities cannot merge.

**Framework citations:**

- OWASP ASVS L2 V14.2.1 — components up to date and free from known vulnerabilities
- ISO/IEC 27001:2022 A.8.8 — management of technical vulnerabilities
- ISO/IEC 27001:2022 A.12.6.1 — management of technical vulnerabilities (ISO 2013 mapping)
- SOC 2 CC8.1 — change management evidence trail
- GDPR Art. 32(1)(d) — process for regularly testing and evaluating effectiveness of security measures
```

#### § Secret Scanning (TOOL-12)

```markdown
## Secret Scanning

**Controls:**

- **gitleaks pre-commit hook** scans staged files before every commit. Blocks commits
  containing secrets matching default ruleset plus a custom rule (see below).
- **gitleaks CI step** (`gitleaks/gitleaks-action`) runs on every push as a backstop for
  developers who bypass local hooks.
- **Custom rule:** Detects SHA-256 hex literals (64 chars) preceded by a context word
  (password, hash, secret, key, token, credential). This specifically guards against
  regression of finding C2 (`INTERNAL_PASSWORD_HASH` — a plain SHA-256 of the team password
  previously committed in `app.js`). Config: `.gitleaks.toml`.

**Framework citations:**

- OWASP ASVS L2 V14.2.3 — application, server, and framework components without unnecessary features, files, documentation
- ISO/IEC 27001:2022 A.10.1 — use of cryptographic controls (ensures secrets remain secret)
- SOC 2 CC6.1 — logical and physical access controls (credentials cannot be committed to repo)
- GDPR Art. 32(1)(a) — appropriate technical measures for protection of personal data
```

### Compliance Mapping per TOOL-XX

| Req     | OWASP ASVS L2                 | ISO 27001:2022   | SOC 2 CC     | GDPR Art. |
| ------- | ----------------------------- | ---------------- | ------------ | --------- |
| TOOL-01 | V14.2.1                       | A.8.25, A.8.28   | CC8.1        | —         |
| TOOL-02 | V14.4.2                       | A.8.25, A.8.28   | CC8.1        | —         |
| TOOL-03 | V14.2.1, V14.4.2              | A.8.28           | CC8.1        | —         |
| TOOL-04 | V14.2.1, V14.4.2              | A.8.28           | CC8.1        | —         |
| TOOL-05 | V5.3.3 (XSS), V6.3.1 (CSPRNG) | A.8.28, A.14.2.5 | CC6.6        | 32(1)(b)  |
| TOOL-06 | V14.2 (code quality)          | A.8.28           | CC8.1        | —         |
| TOOL-07 | V14.2, V14.3                  | A.8.28, A.8.29   | CC8.1        | —         |
| TOOL-08 | V14.2.2, V14.3.2              | A.8.29, A.8.31   | CC8.1        | 32(1)(d)  |
| TOOL-09 | V14.2.2                       | A.8.25, A.14.2.2 | CC8.1        | —         |
| TOOL-10 | V14.2.1                       | A.8.8            | CC8.1        | 32(1)(d)  |
| TOOL-11 | V14.2.1                       | A.8.8            | CC8.1        | —         |
| TOOL-12 | V14.2.3                       | A.10.1           | CC6.1        | 32(1)(a)  |
| DOC-10  | V14.2 (evidence)              | A.5.36, A.5.37   | CC2.3, CC8.1 | 32(1)(d)  |

**Note on ISO 27001:2022 version vs. ISO 27001:2013:** The compliance citations above reference ISO 27001:2022 Annex A control numbers (e.g., A.8.8 instead of A.12.6.1 from the 2013 version). The 2022 revision reorganised the Annex A controls. Use 2022 references throughout `SECURITY.md` for current-standard credibility. [CITED: ISO 27001:2022 Annex A published structure]

**Note on OWASP ASVS version:** Using ASVS 5.0 (current as of 2025). Section references are V14.2 (Dependency Management), V14.3 (Unintended Security Disclosure), V14.4 (HTTP Security Headers). [CITED: SECURITY_AUDIT.md — OWASP ASVS 5.0 Level 2 is the stated compliance target]

---

## Files Created / Modified

Complete list for planner `file_modified` frontmatter:

### New files

| File                                      | Purpose                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| `package.json`                            | Declares all deps; defines npm scripts; lint-staged config; engines constraint |
| `vite.config.js`                          | Vite build pipeline + dev server port 5178 + Vitest config inline              |
| `tsconfig.json`                           | TypeScript-as-typecheck config (--allowJs --checkJs --noEmit --strict)         |
| `eslint.config.js`                        | ESLint 10 flat config — security plugins + danger rules + per-file overrides   |
| `.prettierrc.json`                        | Prettier formatting config                                                     |
| `.husky/pre-commit`                       | Git pre-commit hook — lint-staged + gitleaks protect                           |
| `.gitleaks.toml`                          | gitleaks config — default rules + SHA-256-hex custom rule                      |
| `.github/workflows/ci.yml`                | GitHub Actions CI workflow (lint, typecheck, test, audit, build)               |
| `.github/dependabot.yml`                  | Dependabot config — npm root, npm functions/ (forward), github-actions         |
| `tests/smoke.test.js`                     | Single arithmetic smoke test — prevents "no tests found" warning               |
| `types/globals.d.ts`                      | Ambient declarations for Vite-injected globals + legacy window globals         |
| `runbooks/branch-protection-bootstrap.md` | One-shot `gh api` payload for branch protection                                |
| `runbooks/firebase-oidc-bootstrap.md`     | GCP commands for OIDC workload-identity config (Phase 3 executes)              |
| `runbooks/socket-bootstrap.md`            | Socket.dev GitHub App install steps + evidence screenshot instructions         |
| `runbooks/phase-4-cleanup-ledger.md`      | Ledger of all eslint-disable-next-line and @ts-nocheck introduced in Phase 1   |
| `SECURITY.md`                             | Evidence trail skeleton — 3 populated sections + stub TOC for later phases     |
| `CONTRIBUTING.md`                         | gitleaks local install instructions (scoop/brew) + dev setup                   |

### Modified files

| File               | Change                                                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.js`           | Line 1: add `// @ts-nocheck -- Phase 4: remove after modular split`; per-line `// eslint-disable-next-line` on each existing violation with Phase 4 remediation note |
| `firebase-init.js` | If typecheck generates errors: add `// @ts-nocheck -- Phase 4: remove after CDN import replacement` (only if needed)                                                 |
| `data/pillars.js`  | If typecheck generates errors: add `// @ts-nocheck -- Phase 4: add @ts-check + JSDoc` (only if needed)                                                               |
| `.gitignore`       | Append: `dist/`, `coverage/`, `.env`, `.env.*`, `!.env.example`, `.firebase/`, `*.tsbuildinfo`, `firestore-debug.log`, `firebase-debug.log`                          |

---

## State of the Art

| Old Approach                             | Current Approach                          | Notes                                                                                    |
| ---------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------- |
| husky `husky install` in `prepare`       | `"prepare": "husky                        |                                                                                          | true"` (no-arg) | husky 9 completely dropped the `install` subcommand |
| ESLint `.eslintrc.js` with `extends:`    | `eslint.config.js` flat array             | ESLint 10 defaults to flat config; legacy config requires `ESLINT_USE_FLAT_CONFIG=false` |
| OSV-Scanner via `npx osv-scanner@latest` | `google/osv-scanner-action` GitHub Action | OSV-Scanner binary is not on npm; use the Action                                         |
| Dependabot auto-merge for patches        | Auto-merge disabled                       | Compliance posture requires human review on every dep bump                               |
| `actions/checkout@v4` (tag)              | `actions/checkout@<SHA>`                  | TOOL-09 requires SHA pinning, not tag                                                    |

---

## Assumptions Log

| #   | Claim                                                                                                             | Section                          | Risk if Wrong                                                                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | Vite 8 leaves external CDN `<script>` URLs unchanged in `dist/index.html`                                         | OQ-1, vite.config.js             | If Vite 8 attempts to fetch/inline CDN scripts, build fails; mitigation: use `build.rollupOptions.external` to explicitly exclude them                       |
| A2  | The dual-load (firebase 10.13.0 CDN + firebase 12.12.1 npm) is benign in Phase 1 because nothing imports from npm | OQ-3                             | If any existing code path accidentally resolves the npm package instead of window.FB (unlikely given IIFE globals pattern), there could be version confusion |
| A3  | gitleaks SHA-256-hex custom regex has no false positives on the existing repo                                     | OQ-6                             | If false positives block legitimate commits, adjust `secretGroup` or add specific allowlist entries                                                          |
| A4  | `google/osv-scanner-action` SHA in ci.yml is for a current stable release                                         | OQ-7                             | Placeholder SHA in this doc must be replaced with actual verified SHA before committing                                                                      |
| A5  | Action SHAs in ci.yml are illustrative                                                                            | Implementation Strategy (ci.yml) | CRITICAL: executor MUST replace all Action SHAs with verified current values before committing                                                               |

---

## Open Questions

1. **firebase-init.js and data/pillars.js typecheck noise**
   - What we know: Both files may generate TypeScript errors (CDN imports, window globals)
   - What's unclear: Exact error count/type until `tsc --noEmit` is first run
   - Recommendation: Run `npm run typecheck` immediately after Wave 1 config is in place; add `// @ts-nocheck` to each file that generates errors, document in ledger

2. **App.js violation count for cleanup ledger**
   - What we know: CONTEXT.md §code_context estimates ~30 Math.random() callsites + ~17 innerHTML= + 1 html: + 7 alert() + inline styles
   - What's unclear: Exact lint output until `eslint app.js --format=json` is run
   - Recommendation: Run lint enumeration as the first sub-task of the `eslint.config.js` plan task; use output to populate the cleanup ledger

3. **GitHub Actions SHA values**
   - What we know: SHAs must be current at commit time (Dependabot will update weekly after)
   - What's unclear: Exact SHAs at the time of execution (they change with each release)
   - Recommendation: The executor must run `gh release view --repo actions/checkout --json tagName,targetCommitish` (or equivalent) to get current SHAs at task execution time

---

## Environment Availability

| Dependency               | Required By                | Available                        | Version                   | Fallback                                             |
| ------------------------ | -------------------------- | -------------------------------- | ------------------------- | ---------------------------------------------------- |
| Node.js                  | All npm scripts, Vite 8    | To verify                        | Must be >=22.0.0 per D-02 | Install Node 22 LTS from nodejs.org                  |
| npm                      | Package management         | Yes (bundled with Node)          | Any version               | —                                                    |
| git                      | Husky hooks                | Yes                              | Any recent version        | —                                                    |
| gh CLI                   | Branch protection runbook  | To verify                        | Any version ≥2.x          | Install from cli.github.com                          |
| gitleaks binary          | Pre-commit hook            | To verify                        | Any recent version        | Defer local hook; CI gitleaks action is the backstop |
| GitHub repository access | CI, Dependabot, Socket.dev | Yes (repo exists per git status) | —                         | —                                                    |

**gitleaks binary note:** The pre-commit hook runs `npx gitleaks` which will fail if gitleaks is not installed locally. This is non-blocking for CI (the Action handles it there). Developers who skip local install are caught by CI. Document this clearly in `CONTRIBUTING.md`.

---

## Sources

### Primary (HIGH confidence — verified in this session)

- `npm registry` — All versions verified via `npm view <pkg>@<version> version` on 2026-05-03 [VERIFIED]
- `.planning/research/STACK.md` — Primary version reference; all decisions locked by D-01 [VERIFIED: read directly]
- `.planning/phases/01-engineering-foundation-tooling/01-CONTEXT.md` — All 31 locked decisions [VERIFIED: read directly]
- `.claude/launch.json` — Port 5178 confirmed [VERIFIED: read directly]
- husky 9 docs — `"prepare": "husky"` pattern, CI skip pattern [CITED: https://typicode.github.io/husky/]
- GitHub REST API — branch protection payload [CITED: https://docs.github.com/en/rest/branches/branch-protection]
- google/osv-scanner-action — Action-based invocation, not npx [CITED: https://github.com/google/osv-scanner-action]
- ESLint flat config migration guide — plugin import pattern [CITED: https://eslint.org/docs/latest/use/configure/migration-guide]
- Firebase OIDC / Workload Identity Federation docs [CITED: https://firebase.google.com/docs/hosting/github-integration]

### Secondary (MEDIUM confidence)

- OWASP ASVS 5.0 section references — matched against SECURITY_AUDIT.md citations [CITED: SECURITY_AUDIT.md which cites ASVS 5.0]
- ISO 27001:2022 Annex A control numbers — 2022 reorganisation vs 2013 [ASSUMED: control number mappings derived from training knowledge; verify against official ISO 27001:2022 publication if a compliance reviewer challenges specific section IDs]

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all versions npm-registry verified
- Architecture: HIGH — locked by 31 decisions in CONTEXT.md; no ambiguity
- Config shapes: HIGH — derived from official docs and STACK.md verified skeletons
- Action SHAs: LOW — placeholder SHAs in ci.yml skeleton require replacement at execution time
- Regex for gitleaks custom rule: MEDIUM — derived from the known C2 value; false-positive rate unverified until first run

**Research date:** 2026-05-03
**Valid until:** 2026-06-03 (package versions; npm registry moves faster than this)
**Blocked decisions:** None — all 8 open questions resolved above
