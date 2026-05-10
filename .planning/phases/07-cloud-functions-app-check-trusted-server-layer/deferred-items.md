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

## Wave 6 (07-06) — discovered 2026-05-10

### Pre-existing root `npm run typecheck` errors (NOT introduced by Wave 6)

Confirmed pre-existing by transient comparative diagnostic (stash + typecheck +
unstash) on base commit `f3c2905`. Wave 6 introduces 0 new typecheck errors —
the 14 errors below are inherited substrate gaps:

- `scripts/provision-function-sas/run.js` (5 errors) — implicit-any on
  destructured / parameter types in the Wave 1 ADC provisioning script. Pure
  JSDoc gap; runtime behaviour fine.
- `scripts/strip-legacy-id-fields/run.js` (2 errors) — implicit-any +
  Firestore `update({legacyAppUserId: FieldValue.delete(), ...})` index-signature
  mismatch (Firestore types want dotted-key paths). Pure type strictness gap;
  runtime behaviour fine (sentinel deletion documented in firebase-admin docs).
- `src/firebase/check.js` (4 errors) — `import.meta.env` lacks the Vite-injected
  type augmentation in the Phase 4 typecheck config. Wave 3 body-fill works at
  runtime; needs `vite-env.d.ts` or `<reference types="vite/client" />` to be
  strict-clean.
- `tests/firebase/app.test.js` (1 error) — `initAppCheck({})` test cell's `{}`
  literal doesn't satisfy `FirebaseApp` interface. Pre-existing from Wave 3
  app.test.js update; runtime test passes via the `unknown as FirebaseApp` cast
  pattern would close it.

**Scope:** All 14 errors confirmed pre-Wave-6 via diagnostic compare. Per the
Phase 7 sub-wave 7.1 carry-forward queue, these can either close at sub-wave
7.1 (with the D-22 ToS gate substrate) or queue forward to Phase 8 / Phase 11
DOC closure. **Action:** queue to sub-wave 7.1 typecheck-cleanup row (none
caused by Wave 6 changes; all visible at HEAD f3c2905).

### `functions/test/integration/` shared mock — happy-dom-free

- **Symptom (orthogonal note, not a defect):** The new
  `functions/test/_mocks/admin-sdk.ts` shared mock is consumed only by the new
  `functions/test/integration/*.integration.test.ts` files. The
  vite/`happy-dom` issue logged in Wave 3 (root vitest cannot resolve
  `firebase-functions/params`) does NOT affect Wave 6 because `cd functions &&
  npm test` runs in the `functions/` workspace which uses the local Node
  environment. The 8 new integration test files are GREEN under
  `cd functions && npm test` (133/133 pass — 113 baseline + 20 new).

### Pitfall 19 substrate-honest disclosure: integration mock vs emulator

- The TEST-09 integration suite uses an in-memory Admin-SDK mock rather than
  the real Firestore emulator (per 07-RESEARCH.md Pattern 11 "offline mode
  preferred"). This catches wiring errors (the v1 serviceAccount validation
  bug landed Wave 6 — Rule 1 auto-fix in this same plan was discovered AT
  module-load time under wrap()) but does NOT exercise real Firestore
  query semantics. Phase 11 audit-pack walkthrough will note this.
- **Closure path:** if a future operator rehearsal surfaces an emulator-only
  defect, queue an emulator-mode integration cell as a Phase 8/9 cleanup row.
  Until then, the offline mode is sufficient per Phase 7 SC#5 contract.
