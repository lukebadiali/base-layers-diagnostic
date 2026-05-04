# Phase 4 Cleanup Ledger

> Every `// eslint-disable-next-line` and `// @ts-nocheck` introduced in Phase 1
> is enumerated here. Phase 4 (Modular Split) closes each entry as the
> corresponding code path is rewritten. The ledger empties to zero rows when
> Phase 4 is complete.

## Suppressions

Source enumeration (run on `bc585c6` — first commit on origin/main; counts unchanged through `a9efabb`):

```sh
$ git grep -nE "eslint-disable-next-line" -- app.js firebase-init.js data/pillars.js
$ git grep -nE "@ts-(nocheck|ignore|expect-error)" -- app.js firebase-init.js data/pillars.js
```

Total rows: **16** (14 ESLint disables + 2 `@ts-nocheck`).

| File              | Line | Annotation                                                  | Rule / Check                | Intended Fix                                                                                                | Closure Phase     |
| ----------------- | ---- | ----------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------- |
| app.js            | 1    | `// @ts-nocheck`                                            | tsc strict checkJs          | Remove after IIFE → modules split; per-module JSDoc types pass `tsc --noEmit` cleanly.                      | Phase 4 (CODE-01) |
| firebase-init.js  | 1    | `// @ts-nocheck`                                            | tsc strict checkJs          | Remove after firebase-init.js becomes the lone Firebase SDK import surface (`firebase/` adapter).            | Phase 4 (CODE-01) |
| app.js            | 33   | `// eslint-disable-next-line no-restricted-syntax`          | no-restricted-syntax        | Replace `Math.random()` with `crypto.randomUUID()` (CODE-03).                                               | Phase 4 (CODE-03) |
| app.js            | 274  | `// eslint-disable-next-line no-unused-vars`                | no-unused-vars              | Remove dead code or wire up call site.                                                                      | Phase 4 (CODE-01) |
| app.js            | 420  | `// eslint-disable-next-line no-empty`                      | no-empty                    | Replace empty catch with explicit ignore + comment (Phase 9 logger TBD).                                    | Phase 4 (CODE-01) |
| app.js            | 670  | `// eslint-disable-next-line no-unused-vars`                | no-unused-vars              | Remove dead helper or expose via export.                                                                    | Phase 4 (CODE-01) |
| app.js            | 676  | `// eslint-disable-next-line no-unsanitized/property`       | no-unsanitized/property     | Replace `innerHTML =` with `replaceChildren()` + DOMPurify.sanitize() if HTML truly required (CODE-04).      | Phase 4 (CODE-04) |
| app.js            | 774  | `// eslint-disable-next-line no-empty`                      | no-empty                    | Replace empty catch with explicit ignore + comment.                                                         | Phase 4 (CODE-01) |
| app.js            | 1131 | `// eslint-disable-next-line no-unused-vars`                | no-unused-vars              | Remove dead code or wire up call site.                                                                      | Phase 4 (CODE-01) |
| app.js            | 2018 | `// eslint-disable-next-line no-useless-assignment`         | no-useless-assignment       | Tighten loop control flow (initial value never read before reassignment).                                   | Phase 4 (CODE-01) |
| app.js            | 2374 | `// eslint-disable-next-line no-unused-vars`                | no-unused-vars              | Remove dead code or wire up call site.                                                                      | Phase 4 (CODE-01) |
| app.js            | 2847 | `// eslint-disable-next-line no-unused-vars`                | no-unused-vars              | Remove dead binding or wire up render.                                                                      | Phase 4 (CODE-01) |
| app.js            | 3081 | `// eslint-disable-next-line no-empty`                      | no-empty                    | Replace empty catch with explicit ignore + comment.                                                         | Phase 4 (CODE-01) |
| app.js            | 3772 | `// eslint-disable-next-line no-unused-vars`                | no-unused-vars              | Replace with central error logger (Phase 9 observability).                                                  | Phase 4 (CODE-01) → Phase 9 wires the logger |
| app.js            | 4354 | `// eslint-disable-next-line no-useless-escape`             | no-useless-escape           | Clean up regex (`\\` is unnecessary in char class).                                                         | Phase 4 (CODE-01) |
| app.js            | 5353 | `// eslint-disable-next-line no-unused-vars`                | no-unused-vars              | Remove dead code or wire up call site.                                                                      | Phase 4 (CODE-01) |

## How to regenerate this table

The Phase 1 suppression rows above were captured from live `git grep` at `bc585c6`. Phase 4 runs MUST re-run these commands and verify each closure landing:

```sh
git grep -nE "eslint-disable-next-line" -- app.js firebase-init.js data/pillars.js
git grep -nE "@ts-(nocheck|ignore|expect-error)" -- app.js firebase-init.js data/pillars.js
```

Each row in the Suppressions table corresponds to one location in this output. As Phase 4 sub-tasks land, the per-module file rewrites should remove the disable comments. When the tables produce zero output, this ledger empties to zero rows and Phase 4 sign-off is unblocked.

## Out-of-band soft-fail entries

These are not `eslint-disable-next-line` lines but they're still trackable Phase 1 → Phase 4 cleanup items.

| Source                                                         | Why soft-fail                                                                                  | Re-evaluation date | Hardening target                                                                              |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml` OSV-Scanner step                    | `continue-on-error: true` (D-20) — first 30 days of false-positive baseline                    | 2026-06-03         | Remove `continue-on-error` line; OSV-Scanner becomes hard-fail.                                |
| `.github/workflows/ci.yml` ESLint `no-restricted-imports` rule | `"warn"` not `"error"` (D-26) — soft so existing files don't block CI                          | Phase 4            | Change to `"error"` after modular split lands; lint-enforced module boundaries.                |
| `.gitleaks.toml` — `INTERNAL_PASSWORD_HASH` at `app.js:505`    | Grandfathered C2 finding (predates Phase 1; not blocked by Wave 3 first-green-CI scan range)   | Phase 6 (AUTH-14)  | Delete the constant when real Firebase Auth replaces the shared-password substrate.            |
| `gitleaks/gitleaks-action@ff98106e` Node.js 20 deprecation     | GitHub deprecates Node 20 actions on 2026-06-02; current pinned v2.3.9 ships on Node 20         | 2026-06-02         | Dependabot github-actions ecosystem (`.github/dependabot.yml`) surfaces the v3.x update PR.   |

## Closure

This ledger MUST be empty (zero rows in the Suppressions table) before Phase 4 is signed off. Any rows remaining at Phase 4 close indicate either:

- A Phase 4 task missed a callsite — fix and re-run.
- A suppression was actually still needed — document under "Persistent suppressions" with rationale, and reflect in `SECURITY.md` so the audit narrative is honest.

The "Out-of-band soft-fail entries" table follows a separate cadence:

- OSV-Scanner soft-fail: re-evaluate at 2026-06-03 regardless of Phase 4 status.
- `no-restricted-imports`: hardens with Phase 4 close.
- `INTERNAL_PASSWORD_HASH`: closes at Phase 6 AUTH-14.
- gitleaks-action Node 20: closes when Dependabot's v3.x bump PR merges.

## Phase 1 — first-green-CI deviations (informational)

The Wave 3 checkpoint resolution (2026-05-04) introduced two non-suppression fixes that ARE NOT in the table above (because they're permanent fixes, not suppressions):

- `.github/workflows/ci.yml` audit job: `fetch-depth: 0` on `actions/checkout` (gitleaks-action requires full history).
- `tests/smoke.test.js` pulled forward from Wave 5 Plan 01-06 Task 1 Step 1 (Vitest 4.x exits 1 on no-tests).

Both are documented in `01-04-SUMMARY.md` "Resolved Checkpoint" and `01-06-SUMMARY.md` (when Wave 5 lands).
