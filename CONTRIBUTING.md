# Contributing — Base Layers Diagnostic

## Local development setup

### Required tools

- **Node 22 LTS** — verified via `.npmrc` `engine-strict=true`. Install:
  - macOS: `brew install node@22`
  - Windows: download Node 22 LTS installer from nodejs.org or `scoop install nodejs-lts`
  - Linux: use `nvm install 22 && nvm use 22`
- **gitleaks** — required by `.husky/pre-commit`. Install:
  - macOS: `brew install gitleaks`
  - Windows: `scoop install gitleaks`
  - Linux: download from https://github.com/gitleaks/gitleaks/releases
  - Verify: `gitleaks version` should output a version >= 8.x
- **gh CLI** — used by some runbooks (e.g., branch protection). Install:
  - https://cli.github.com (covers all platforms)
  - Authenticate: `gh auth login`

### One-time setup

```sh
git clone https://github.com/lukebadiali/base-layers-diagnostic
cd base-layers-diagnostic
npm ci   # reproduces the exact lockfile state
```

The `npm ci` triggers `husky || true` via the `prepare` script, which sets up
`.husky/_/`. The pre-commit hook (`.husky/pre-commit`) is then active for
every `git commit` in this repo.

### Daily commands

```sh
npm test          # Vitest run (Phase 2 will populate this with real coverage)
npm run lint      # ESLint flat config — blocks new Math.random / innerHTML / outerHTML
npm run typecheck # tsc --noEmit (JSDoc-as-typecheck; vanilla-JS — no .ts files)
npm run build     # Vite build → dist/ with hashed-filename bundles
npm run format    # Prettier write
npm run dev       # Vite dev server on port 5178 (matches .claude/launch.json)
```

### Pre-commit hook

`.husky/pre-commit` runs on every `git commit`:

1. `lint-staged` runs `eslint --fix` + `prettier --write` on staged `.js` files.
2. `gitleaks protect --staged --config .gitleaks.toml` scans the staged diff
   for secrets (custom rule blocks SHA-256 hex literals labelled
   password/hash/secret/key/token/credential — see `.gitleaks.toml`).

If gitleaks is not installed locally the hook fails. CI is the backstop —
`.github/workflows/ci.yml` audit job runs gitleaks-action on every push +
PR.

## Commits

We use [Conventional Commits](https://www.conventionalcommits.org). Prefixes
in active use: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`. Scope is
the phase number where applicable (e.g., `feat(01): ...` or `feat(01-04): ...`).

Commit-message linting (commitlint) is NOT enforced — convention only. If
this becomes inconsistent we will add a hook.

## Pull requests

- Open against `main`. CI must be green (`Lint` + `Typecheck` + `Test` +
  `Security Audit` + `Build`) before merge.
- Branch protection requires 1 approving review and a linear history
  (applied via `runbooks/branch-protection-bootstrap.md`).
- Direct pushes to `main` are blocked by branch protection.
- Force pushes to `main` are blocked.

## Where things live

See `.planning/codebase/STRUCTURE.md` for the current source layout. The
target post-Phase-4 layout is in `.planning/research/ARCHITECTURE.md`.

Tests live under `tests/`. Runbooks for one-shot operations live under
`runbooks/`. Project planning + decision history lives under `.planning/`.

## Reporting security issues

See `SECURITY.md` for the vulnerability disclosure process. Do NOT open
public issues for security findings.
