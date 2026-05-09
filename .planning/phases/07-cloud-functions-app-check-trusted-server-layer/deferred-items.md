# Phase 7 — Deferred Items (logged by parallel executors during Wave 3)

Items discovered during Wave 3 execution that are out-of-scope for the current
plan but should be tracked for future closure.

## Wave 3 (07-03) — discovered 2026-05-09

### functions/ test suite — Vitest can't resolve `firebase-functions/params` under happy-dom

- **Symptom:** Pre-existing on base commit `d00268c` (Wave 1 shared infra merge).
- **Failing files:**
  - `functions/test/util/idempotency.unit.test.ts` (0 tests run — file fails to load)
  - `functions/test/util/sentry.unit.test.ts` (0 tests run)
  - `functions/test/util/zod-helpers.unit.test.ts` (0 tests run)
  - `functions/test/auth/setClaims.unit.test.ts` (6 tests, 6 fail to load)
- **Cause:** `functions/src/auth/setClaims.ts:23` imports from `firebase-functions/params`,
  which Vitest's happy-dom environment can't resolve. The functions/ workspace tests
  should run under Node + the firebase-functions-test runner, not the root Vitest
  happy-dom env. Likely needs:
  - Separate Vitest config for `functions/test/**` with `environment: "node"` + the
    correct moduleResolution; OR
  - Move tests into `functions/` workspace `npm test` script (already exists per
    07-01-SUMMARY.md "npm test → 81/81 pass" — the root `npm test` is what fails).
- **Scope:** Wave 1 (07-01) shipped these tests; Wave 3 inherits the failure but
  did not cause it. Confirmed by stashing Wave 3 changes — failures persist on
  base commit.
- **Recommended action:** Wave 6 (07-06) cleanup-ledger row, or address inline if
  Wave 5 blocks on root test suite green.
