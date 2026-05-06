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

## Updating snapshot tests

Snapshot files at `tests/__snapshots__/views/*.html` are committed; the diff in
PR review IS the snapshot governance.

### When a snapshot diff appears

1. `npm test` will fail with a snapshot mismatch.
2. Run `npm test -- -u` locally to update the snapshot files.
3. Inspect the diff — `git diff tests/__snapshots__/`. The diff should match
   the change you intended (e.g., the dashboard header text changed —
   verify the only diff is the header text).
4. Commit the snapshot update in the same PR as the change.
5. Reviewer asserts intentionality of the snapshot diff.

### CI never auto-updates snapshots

The CI invocation is `npm run test:coverage` (no `-u` / `--update`). A snapshot
mismatch in CI is a hard failure. The `-u` flag is a developer tool, never a
CI tool.

### Regression-baseline tests

Three test files are deliberate regression baselines of broken behaviour:

- `tests/domain/unread.test.js` — pins H7 (clock skew) entanglement; Phase 5
  (DATA-07) will break it by design.
- `tests/data/cloud-sync.test.js` — pins H8 (last-writer-wins) cloud-sync
  semantics; Phase 5+ subcollection migration will break it by design.
- `tests/auth/state-machine.test.js` — pins the pre-Phase-6 password
  comparator path; Phase 6 (AUTH-14) will DELETE this file alongside the
  production code.

Each file opens with a `REGRESSION BASELINE` header documenting the design
intent. If you find yourself "fixing" a failing assertion in one of these
files, **stop** and check whether you're in the cutover phase that's supposed
to break it. If yes, the test diff is the cutover evidence — preserve it.
If no, you've found a real regression; investigate the production change.

### Coverage thresholds (test-first PR rule, D-15 + D-17 + D-18)

`vite.config.js` declares per-directory coverage thresholds enforced as a hard
CI gate (`npm run test:coverage` exits non-zero on threshold miss):

- `src/domain/**` and `src/util/**`: 100% lines / branches / functions / statements
- `src/auth/**`: 95% across the four metrics
- `src/data/**`: 90% across the four metrics

Every PR that touches `src/**` must touch a corresponding `tests/**` file.
**Lowering a threshold is a separate PR** that explicitly justifies the change
(usually with a referenced phase plan); doing so silently inside an unrelated
feature PR is the "weakening to make it pass" anti-pattern that
`SECURITY_AUDIT.md` §0(4) blocks. The threshold values are committed source
of truth — any reduction shows up in `git diff vite.config.js`.

## Test runtime budget

Soft target (no enforcement): `npm test` completes in <30s locally and <90s in
CI on a clean clone. If a future PR pushes runtime past 2× the target, the PR
description should justify. Hard timeouts are added in Phase 7 once Cloud
Functions tests + emulator suites push runtime up legitimately.

## Reporting security issues

See `SECURITY.md` for the vulnerability disclosure process. Do NOT open
public issues for security findings.
