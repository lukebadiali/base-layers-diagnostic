# Phase 5 — Deferred Items

Items discovered during Phase 5 plan execution that are out-of-scope for the
current plan but should be tracked for resolution in a later wave/phase.

## From Plan 05-02 (Wave 2 — migration script)

### Pre-existing ESLint errors in tests/rules/** (8 errors)

- **Discovered by:** `npm run lint` after Plan 05-02 Task 2 changes.
- **Confirmed pre-existing:** `git stash && npm run lint` against the post-05-01
  baseline produces the same 8 errors (plus 1 from this plan's run.js, fixed
  via eslint.config.js scripts/** Node-globals override).
- **Files affected:**
  - `tests/rules/firestore.test.js`
  - `tests/rules/server-only-deny-all.test.js`
  - `tests/rules/soft-delete-predicate.test.js`
  - `tests/rules/storage.test.js`
  - `tests/rules/tenant-jump.test.js`
- **Error pattern:** `'firebase/storage' import is restricted ... no-restricted-imports`
  + 1 `expect is defined but never used` in `storage.test.js`.
- **Why deferred:** Out of scope for Plan 05-02 (migration script). Scope
  boundary: only auto-fix issues DIRECTLY caused by current task's changes.
  These tests/rules/** files were authored in Plan 05-01 and the `tests/rules/**`
  directory uses `firebase/...` imports through `@firebase/rules-unit-testing`'s
  re-exports — which the Wave 1 plan presumably accepted as a Wave 1 lint
  carve-out. The eslint.config.js's `tests/**` block (lines 180-203) ignores
  `tests/firebase/**` + `tests/mocks/**` but NOT `tests/rules/**`.
- **Owner:** Plan 05-01 follow-up (or Plan 05-06 close-out wave). Recommend
  extending the eslint.config.js carve-out to include `tests/rules/**` since
  rules-unit-testing intentionally requires SDK-shaped imports.
