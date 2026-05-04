# Phase 1: Engineering Foundation (Tooling) — Pattern Map

**Mapped:** 2026-05-03
**Files analyzed:** 22 new/modified files (plus 3 source-file edits)
**Analogs found:** 1 / 22 (`.gitignore` is the only file with any in-repo analog)

---

## Critical Context: Greenfield Tooling Layer

This phase introduces every piece of build infrastructure from zero. The repo currently contains:

- `app.js`, `firebase-init.js`, `data/pillars.js`, `index.html`, `styles.css`, `assets/` — application only
- `.gitignore` (5 lines) — the sole config file

There is **no existing `package.json`, no build config, no test framework, no CI, no lint config, no pre-commit hooks**. Every tooling file this phase creates is greenfield. This is the expected and correct result for the pattern-mapping step — the planner must use RESEARCH.md skeletons (which are fully specified) as the pattern source for all files except `.gitignore`.

All RESEARCH.md skeletons in `01-RESEARCH.md` are authoritative and ready to copy. Line references below point into that file.

---

## File Classification

| New/Modified File                         | Role               | Data Flow | Closest Analog                   | Match Quality |
| ----------------------------------------- | ------------------ | --------- | -------------------------------- | ------------- |
| `package.json`                            | config             | N/A       | GREENFIELD                       | none          |
| `package-lock.json`                       | config (generated) | N/A       | GREENFIELD                       | none          |
| `.npmrc`                                  | config             | N/A       | GREENFIELD                       | none          |
| `vite.config.js`                          | config             | transform | GREENFIELD                       | none          |
| `tsconfig.json`                           | config             | N/A       | GREENFIELD                       | none          |
| `eslint.config.js`                        | config             | N/A       | GREENFIELD                       | none          |
| `.prettierrc.json`                        | config             | N/A       | GREENFIELD                       | none          |
| `.gitleaks.toml`                          | config             | N/A       | GREENFIELD                       | none          |
| `.husky/pre-commit`                       | config / utility   | N/A       | GREENFIELD                       | none          |
| `.github/workflows/ci.yml`                | config / CI        | N/A       | GREENFIELD                       | none          |
| `.github/dependabot.yml`                  | config             | N/A       | GREENFIELD                       | none          |
| `.gitignore`                              | config             | N/A       | `.gitignore` (existing, 5 lines) | augment-only  |
| `tests/smoke.test.js`                     | test               | N/A       | GREENFIELD                       | none          |
| `types/globals.d.ts`                      | config / type      | N/A       | GREENFIELD                       | none          |
| `runbooks/phase-4-cleanup-ledger.md`      | documentation      | N/A       | GREENFIELD                       | none          |
| `runbooks/branch-protection-bootstrap.md` | documentation      | N/A       | GREENFIELD                       | none          |
| `runbooks/firebase-oidc-bootstrap.md`     | documentation      | N/A       | GREENFIELD                       | none          |
| `runbooks/socket-bootstrap.md`            | documentation      | N/A       | GREENFIELD                       | none          |
| `CONTRIBUTING.md`                         | documentation      | N/A       | GREENFIELD                       | none          |
| `SECURITY.md`                             | documentation      | N/A       | GREENFIELD                       | none          |
| `app.js` (modify)                         | source             | N/A       | `app.js` (existing)              | augment-only  |
| `firebase-init.js` (conditional modify)   | source             | N/A       | `firebase-init.js` (existing)    | augment-only  |
| `data/pillars.js` (conditional modify)    | source             | N/A       | `data/pillars.js` (existing)     | augment-only  |

---

## Pattern Assignments

### `package.json` (config, greenfield)

**Analog:** NONE — no `package.json` exists in the repo.

**External reference:** `01-RESEARCH.md` Implementation Strategy — Wave 0, lines ~257-285.

**Pattern to copy (full skeleton from RESEARCH.md):**

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

**Version pinning rule (D-01):** All versions must be pinned exactly as listed in `01-RESEARCH.md` Standard Stack section (~lines 118-146). Production deps: `firebase@12.12.1`, `chart.js@4.5.1`, `dompurify@3.4.2`, `@sentry/browser@10.51.0`. Dev deps: full list at RESEARCH.md ~lines 158-173.

**Key constraints:**

- `"type": "module"` is mandatory — Vite 8 and ESLint 10 flat config both require ESM. Pitfall B in RESEARCH.md explains what breaks without it.
- `"private": true` prevents accidental npm publish.
- `"engines"` enforces Node 22 per D-02.
- `"prepare": "husky"` is the Husky 9 initialisation pattern (no `husky install`). See RESEARCH.md OQ-8.

---

### `package-lock.json` (config, generated)

**Analog:** NONE — generated by `npm install`.

**Pattern:** Run `npm install` after `package.json` is written. `package-lock.json` is generated, not hand-authored. Commit it to the repo (lockfile reproducibility).

---

### `.npmrc` (config, greenfield)

**Analog:** NONE.

**External reference:** Standard npm practice.

**Pattern to use:**

```ini
engine-strict=true
```

`engine-strict=true` enforces the `engines.node` field from `package.json` — installing with Node < 22 will fail hard rather than silently (prevents CI/local version drift per D-02).

---

### `vite.config.js` (config/transform, greenfield)

**Analog:** NONE — no build config exists in the repo.

**External reference:** `01-RESEARCH.md` Implementation Strategy — Wave 1, lines ~311-347 (full skeleton). Also see OQ-1 (~lines 737-752) for the coexistence rationale with un-rewritten `index.html`.

**Pattern to copy (full skeleton from RESEARCH.md):**

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
    port: 5178, // matches .claude/launch.json
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

**Key constraints:**

- `server.port: 5178` preserves the existing dev workflow (`.claude/launch.json` confirmed at port 5178 per RESEARCH.md OQ-2).
- `test:` block inline in the same file as the build config (D-31 — one config file, two consumers).
- No coverage threshold (`thresholds:` key absent) — Phase 2 sets the threshold once real tests exist.
- `input: { main: "index.html" }` targets the existing `index.html` as the Vite entry without rewriting it (D-14, OQ-1).
- ESM `export default` syntax required because `"type": "module"` is set in `package.json` (Pitfall B).

---

### `tsconfig.json` (config, greenfield)

**Analog:** NONE — no `tsconfig.json` exists.

**External reference:** `01-RESEARCH.md` Implementation Strategy — Wave 1, lines ~352-370.

**Pattern to copy:**

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

**Key constraints (D-28):**

- `"allowJs": true` + `"checkJs": true` + `"noEmit": true` — typecheck JS files without emitting — this is the JSDoc-as-typecheck pattern (no `.ts` files exist).
- `"moduleResolution": "bundler"` — required for Vite 8 path resolution.
- `"include": ["**/*.js", "**/*.d.ts"]` — covers `app.js`, `firebase-init.js`, `data/pillars.js`, `tests/`, and `types/globals.d.ts`.
- `"exclude"` must include `functions/lib` (forward-declared for Phase 7).
- `app.js` carries `// @ts-nocheck` at line 1 (D-07) so tsc skips it despite it matching the `include` glob.

---

### `eslint.config.js` (config, greenfield)

**Analog:** NONE — no ESLint config exists.

**External reference:** `01-RESEARCH.md` Implementation Strategy — Wave 1, lines ~386-447 (full skeleton). Also see RESEARCH.md Pitfall C (~lines 1044-) for the flat-config plugin import pattern.

**Pattern to copy (full skeleton from RESEARCH.md):**

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
      "no-unsanitized/method": "error",
      "no-unsanitized/property": "error",
      "security/detect-pseudo-random-bytes": "error",
      "security/detect-non-literal-regexp": "warn",
      "security/detect-eval-with-expression": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
          message:
            "Use crypto.randomUUID() instead. Phase 4: replace all call sites. See runbooks/phase-4-cleanup-ledger.md",
        },
      ],
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

**Key constraints (D-05, D-06, D-26):**

- `no-unsanitized/method` and `no-unsanitized/property` fire as `error` on all files — per-line disables on existing `app.js` violations are required before `npm run lint` can pass.
- `no-restricted-imports` fires as `warn` in Phase 1 (hardens to `error` in Phase 4 when the modular boundary is enforced).
- `--max-warnings=0` in the `lint` script means even warnings block CI — the single `no-restricted-imports` warn on existing violations in `firebase-init.js` (if any; it uses CDN URL strings, not bare specifiers, so likely does not trigger) must be verified.
- ESM `export default [...]` flat config — no `module.exports`, no `.eslintrc`.

---

### `.prettierrc.json` (config, greenfield)

**Analog:** NONE.

**External reference:** `01-RESEARCH.md` Implementation Strategy — Wave 1, lines ~374-383.

**Pattern to copy:**

```json
{
  "printWidth": 100,
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all"
}
```

**Note (D-27):** These are the locked opinionated-zero choices. `singleQuote: false` matches the existing `app.js` style (double-quoted strings throughout). `printWidth: 100` chosen for the 4,103-line IIFE context.

---

### `.gitleaks.toml` (config, greenfield)

**Analog:** NONE.

**External reference:** `01-RESEARCH.md` Implementation Strategy — Wave 2, lines ~485-511. Also OQ-6 (~lines 900-922) for regex rationale.

**Pattern to copy:**

```toml
# .gitleaks.toml
title = "Base Layers Diagnostic — gitleaks config"

[extend]
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
  '''expect\([^)]+\)\.toBe\(["\'][a-f0-9]{64}["\']''',
]
```

**Key constraint (D-18):** The `useDefault = true` extends the gitleaks default ruleset. The custom rule targets the specific C2 finding (`INTERNAL_PASSWORD_HASH` shape) — a 64-char lowercase hex literal preceded by a password/secret label word.

---

### `.husky/pre-commit` (config/utility, greenfield)

**Analog:** NONE.

**External reference:** `01-RESEARCH.md` Implementation Strategy — Wave 2, lines ~465-479. Also OQ-8 (~lines 950-973) for Husky 9 setup detail.

**Pattern to copy:**

```bash
#!/usr/bin/env sh
npx lint-staged
npx gitleaks protect --staged --config .gitleaks.toml
```

**Key constraints (D-16, D-17):**

- Must be a plain shell script committed to the repo (not gitignored).
- Husky 9 does NOT use `husky install` — the `"prepare": "husky"` script in `package.json` handles initialisation.
- `npx lint-staged` runs ESLint `--fix` + Prettier `--write` on staged `.js` files (config lives in `package.json` `"lint-staged"` key).
- `npx gitleaks protect --staged` requires the `gitleaks` binary in PATH (installed via scoop/brew, documented in `CONTRIBUTING.md`).
- Windows caveat: `#!/usr/bin/env sh` shebang works via Git for Windows; avoid Windows-only paths.

---

### `.github/workflows/ci.yml` (config/CI, greenfield)

**Analog:** NONE — no GitHub Actions workflows exist.

**External reference:** `01-RESEARCH.md` Implementation Strategy — Wave 3, lines ~526-645.

**Full skeleton is in RESEARCH.md (~lines 527-637).** Key structural decisions to preserve:

- **Job order:** `setup → lint → typecheck → test → audit → build` (D-09).
- **`build` depends on all other jobs** (`needs: [lint, typecheck, test, audit]`) — build only if everything passes.
- **Fail-fast is implicit** for parallel jobs; `setup` is a separate job that the others wait on for the `npm ci` cache.
- **All `uses:` references must be pinned to commit SHA** (not tags like `@v4`). The RESEARCH.md skeletons contain placeholder SHAs — executor must replace with current SHAs from each action's releases page (D-10).
- **OSV-Scanner step has `continue-on-error: true`** (D-20 soft fail).
- **No `deploy:` job** — build produces `dist/` as a workflow artefact only (D-11, D-13).
- **`permissions: contents: read`** at workflow level — principle of least privilege.
- **Node 22, `cache: "npm"`** in every `setup-node` step.

**SHA replacement reminder:** The following SHAs in RESEARCH.md are explicitly noted as illustrative placeholders and must be replaced with real current SHAs:

- `actions/checkout`
- `actions/setup-node`
- `actions/upload-artifact`
- `google/osv-scanner-action`
- `gitleaks/gitleaks-action`

---

### `.github/dependabot.yml` (config, greenfield)

**Analog:** NONE.

**External reference:** `01-RESEARCH.md` Implementation Strategy — Wave 4, lines ~652-686.

**Pattern to copy:**

```yaml
version: 2

updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 10
    rebase-strategy: "auto"

  - package-ecosystem: "npm"
    directory: "/functions"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    rebase-strategy: "auto"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
    open-pull-requests-limit: 5
    rebase-strategy: "auto"
```

**Key constraints (D-19):**

- Weekly cadence (not daily) — noise reduction.
- No `automerge:` key — compliance posture requires human review on every dep bump.
- `/functions` entry is forward-declared for Phase 7. Dependabot silently skips directories that don't exist yet.
- `github-actions` ecosystem entry keeps CI Action SHAs updated after D-10 pins them.

---

### `.gitignore` (config, augment-only)

**Analog:** `.gitignore` (existing, 5 lines) — the only file in this phase with an in-repo analog.

**Existing content (lines 1-5):**

```
.DS_Store
.vscode/
.idea/
*.log
node_modules/
```

**Additions to append** (from RESEARCH.md Wave 0, lines ~287-299):

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

**Instruction:** Append the additions block after line 5. Do not rewrite or reorder existing lines. `.firebase/` and `firebase-debug.log` are forward-declared for Phase 3/5.

---

### `tests/smoke.test.js` (test, greenfield)

**Analog:** NONE — no test files exist anywhere in the repo.

**External reference:** `01-RESEARCH.md` Implementation Strategy — Wave 5, lines ~696-712.

**Pattern to copy:**

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

**Key constraints (D-30):**

- `// @ts-check` at top — all new files (not `app.js`) use this pattern (D-07).
- ESM `import` syntax required (matches `"type": "module"` in `package.json`).
- No coverage threshold set — Phase 2 adds thresholds once real tests exist (D-31).

---

### `types/globals.d.ts` (config/type, greenfield)

**Analog:** NONE.

**External reference:** `01-RESEARCH.md` Implementation Strategy — Wave 5, lines ~714-731.

**Pattern to copy:**

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

**Key constraint (D-29):** Phase-4 cleanup comments on each declaration so they surface in the cleanup ledger.

---

### `runbooks/phase-4-cleanup-ledger.md` (documentation, greenfield)

**Analog:** NONE — no `runbooks/` directory exists.

**External reference:** `01-CONTEXT.md` D-08; `01-RESEARCH.md` OQ-7 (OSV-Scanner soft-fail ledger entry example).

**Pattern:** Markdown table with columns: `File`, `Line`, `Annotation`, `Rule/Check`, `Intended Fix`, `Phase`. Planner writes the initial structure; executor fills in exact file:line entries after running `eslint app.js --format=json` to enumerate violations (RESEARCH.md ~line 450).

**Minimum entries at Phase 1 close:**

- Every `// eslint-disable-next-line <rule>` in `app.js`, `firebase-init.js`, `data/pillars.js`
- The `// @ts-nocheck` in `app.js`
- Any `// @ts-nocheck` added to `firebase-init.js` or `data/pillars.js` during typecheck-first-run
- OSV-Scanner soft-fail entry: "Harden `continue-on-error: false` after 30-day false-positive baseline. Review date: 2026-06-03."

---

### `runbooks/branch-protection-bootstrap.md` (documentation, greenfield)

**Analog:** NONE.

**External reference:** `01-RESEARCH.md` OQ-5, lines ~854-895 (full runbook content ready to commit verbatim).

**Critical timing note (Pitfall A in RESEARCH.md ~line 1022):** Apply branch protection ONLY after the first successful CI run. The runbook must include this as a hard prerequisite step. The `gh api` payload protects `main` with required status checks `lint`, `typecheck`, `test`, `audit`, `build`.

---

### `runbooks/firebase-oidc-bootstrap.md` (documentation, greenfield)

**Analog:** NONE.

**External reference:** `01-RESEARCH.md` OQ-4, lines ~779-846 (full runbook content ready to commit verbatim).

**Note (D-23):** Phase 1 commits this document only. Phase 3 executes the GCP commands. The runbook contains the exact `gcloud iam workload-identity-pools` commands and the Phase 3 workflow snippet.

---

### `runbooks/socket-bootstrap.md` (documentation, greenfield)

**Analog:** NONE.

**External reference:** D-22 in `01-CONTEXT.md`. No full skeleton in RESEARCH.md — planner writes the content.

**Pattern:** Short runbook documenting the one-time UI steps to install the Socket.dev GitHub App at `https://socket.dev`. Include: visit URL, grant repo access to `AssumeAIhugh/base-layers-diagnostic`, save a screenshot to `docs/evidence/socket-screenshot.png` for DOC-09 evidence pack.

---

### `CONTRIBUTING.md` (documentation, greenfield)

**Analog:** NONE.

**External reference:** D-17 in `01-CONTEXT.md`; RESEARCH.md Wave 2, lines ~513-516.

**Minimum content:** gitleaks local installation instructions:

- Windows: `scoop install gitleaks`
- macOS: `brew install gitleaks`
- Verify: `gitleaks version`
- Pre-commit hook note: the hook calls `npx gitleaks protect --staged` — requires `gitleaks` in PATH.
- Conventional Commits reminder (already in use, not linted — see Deferred).

---

### `SECURITY.md` (documentation, greenfield)

**Analog:** NONE — `SECURITY_AUDIT.md` is a different artefact (internal audit framework, not a public disclosure document).

**External reference:** D-24 in `01-CONTEXT.md`; compliance citations from RESEARCH.md `01-RESEARCH.md` Standard Stack and CONTEXT.md `01-CONTEXT.md` lines ~82-89 (Canonical References — Compliance Citations section).

**Required structure (D-24):**

1. Header: project name, contact `security@bedeveloped.com`, supported versions
2. Vulnerability disclosure paragraph (placeholder text)
3. **Populated section — "Build & Supply Chain":** Vite-bundled deps, pinned npm versions, hashed-filename output. Citations: OWASP ASVS V14.4, ISO 27001 A.14.2.5, SOC2 CC8.1
4. **Populated section — "Dependency Monitoring":** Dependabot weekly cadence, OSV-Scanner in CI, Socket.dev behavioural detection. Citations: OWASP ASVS V14.2, ISO 27001 A.12.6, SOC2 CC8.1
5. **Populated section — "Secret Scanning":** gitleaks pre-commit + CI, custom SHA-256-hex-64 rule. Citations: OWASP ASVS V14.2, ISO 27001 A.10.1, SOC2 CC6.1
6. Stub sections (TOC entries with `TODO — Phase N:` markers) for: Authentication & MFA (Phase 6), Authorization & Tenant Isolation (Phase 5/6), Audit Logging (Phase 7/9), Data Lifecycle & GDPR (Phase 8), Backup & DR (Phase 8), Observability (Phase 9), CSP & Headers (Phase 3/10), Threat Model link (Phase 11)

---

### `app.js` — modifications (source, augment-only)

**Analog:** `app.js` (existing, 4,103 lines) — read-only during Phase 1; only comment injections.

**Two modification types (D-06, D-07):**

**1. `// @ts-nocheck` at line 1:**

```javascript
// @ts-nocheck
// Phase 4: remove after modular split. See runbooks/phase-4-cleanup-ledger.md
```

Insert as the new first two lines of `app.js`. Existing line 1 (`(function () {`) becomes line 3.

**2. Per-line `eslint-disable-next-line` comments on each violation:**

```javascript
// eslint-disable-next-line no-unsanitized/property -- Phase 4: replace innerHTML with replaceChildren(). See runbooks/phase-4-cleanup-ledger.md
el.innerHTML = sanitizedHtml;
```

Pattern: comment goes on the line immediately before the violating line. The `--` separator followed by the remediation note is mandatory so the cleanup ledger can be auto-generated from `eslint app.js --format=json`.

**Finding violations:** Run `eslint app.js --format=json > /tmp/violations.json` to enumerate all violations before writing disables. Known violation types from CONTEXT.md ~lines 173:

- ~30 `Math.random()` call sites (rule: `security/detect-pseudo-random-bytes` + `no-restricted-syntax`)
- ~17 `innerHTML =` / `insertAdjacentHTML` / `outerHTML` sites (rule: `no-unsanitized/property`, `no-unsanitized/method`)

---

### `firebase-init.js` / `data/pillars.js` — conditional modifications

**Analog:** Both files exist and are read-only in Phase 1 unless typecheck-first-run reveals errors.

**Pattern (D-07):** After running `npm run typecheck` for the first time, assess whether `firebase-init.js` (53 lines, ES module) and `data/pillars.js` (540 lines, plain script) generate type errors. If noise exceeds signal, add `// @ts-nocheck` + `// Phase 4: remove` at their respective line 1. Document any added `// @ts-nocheck` in `runbooks/phase-4-cleanup-ledger.md`.

**`firebase-init.js` note:** This file already uses `import` (ES module); it likely generates some type errors from the typed Firebase SDK. Per-line `@ts-ignore` is an option if only a few errors exist; `// @ts-nocheck` if pervasive.

---

## Shared Patterns

### `// @ts-check` Header Pattern

**Applies to:** All new `.js` files created in this phase and all subsequent phases.

**Pattern:**

```javascript
// @ts-check
```

Place as the first line of every new `.js` file (except those that receive `// @ts-nocheck`). This activates the TypeScript language server's JSDoc type checking on the file without any additional configuration.

**Source:** D-07 in `01-CONTEXT.md`; `01-RESEARCH.md` OQ-3.

---

### Phase-4 Cleanup Comment Pattern

**Applies to:** Every `eslint-disable-next-line`, `// @ts-nocheck`, and `// @ts-ignore` introduced in Phase 1.

**Pattern:**

```javascript
// eslint-disable-next-line <rule-name> -- Phase 4: <what to do>. See runbooks/phase-4-cleanup-ledger.md
// @ts-nocheck
// Phase 4: remove after modular split. See runbooks/phase-4-cleanup-ledger.md
```

The cleanup comment ensures every suppression is traceable to a Phase 4 action and appears in the ledger.

---

### ESM-only Pattern

**Applies to:** All config files (`vite.config.js`, `eslint.config.js`) and new source files.

**Pattern:** Use `import`/`export` syntax. Never use `require()` or `module.exports = {}`.

**Trigger:** `"type": "module"` in `package.json` makes CommonJS syntax a hard error for all `.js` files.

**Source:** `01-RESEARCH.md` Pitfall B.

---

### SHA-Pinned Actions Pattern

**Applies to:** Every `uses:` entry in `.github/workflows/ci.yml`.

**Pattern:**

```yaml
uses: actions/checkout@<40-char-hex-sha> # vX.Y.Z
```

The comment with the human-readable version tag is mandatory for maintainability. Dependabot (`github-actions` ecosystem in `dependabot.yml`) keeps these SHAs current after initial setup.

**Source:** D-10 in `01-CONTEXT.md`; `01-RESEARCH.md` notes at lines ~639-644.

---

## No Analog Found

All files except `.gitignore` have no in-repo analog. The planner must use RESEARCH.md skeletons as the authoritative copy source.

| File                       | Role          | Data Flow | Reason                            |
| -------------------------- | ------------- | --------- | --------------------------------- |
| `package.json`             | config        | N/A       | No package manager in repo        |
| `vite.config.js`           | config        | transform | No build tooling in repo          |
| `tsconfig.json`            | config        | N/A       | No TypeScript config in repo      |
| `eslint.config.js`         | config        | N/A       | No linter config in repo          |
| `.prettierrc.json`         | config        | N/A       | No formatter config in repo       |
| `.gitleaks.toml`           | config        | N/A       | No secret-scanning config in repo |
| `.husky/pre-commit`        | utility       | N/A       | No git hooks in repo              |
| `.github/workflows/ci.yml` | CI config     | N/A       | No CI workflows in repo           |
| `.github/dependabot.yml`   | config        | N/A       | No Dependabot config in repo      |
| `tests/smoke.test.js`      | test          | N/A       | No test files exist in repo       |
| `types/globals.d.ts`       | type          | N/A       | No types directory in repo        |
| `runbooks/*.md` (x4)       | documentation | N/A       | No runbooks directory in repo     |
| `CONTRIBUTING.md`          | documentation | N/A       | No CONTRIBUTING.md in repo        |
| `SECURITY.md`              | documentation | N/A       | No SECURITY.md in repo            |

---

## Metadata

**Analog search scope:** Entire repo root + all subdirectories (`.github/`, `.husky/`, `tests/`, `types/`, `runbooks/`, `data/`)
**Files scanned:** 9 source files total in repo (`app.js`, `firebase-init.js`, `data/pillars.js`, `index.html`, `styles.css`, `CNAME`, `.gitignore`, `SECURITY_AUDIT.md`, `.claude/serve.py`)
**Result:** Zero tooling files found. All 22 new files are greenfield.
**Pattern extraction date:** 2026-05-03
**Primary pattern source:** `01-RESEARCH.md` (fully specified skeletons for all config files)
