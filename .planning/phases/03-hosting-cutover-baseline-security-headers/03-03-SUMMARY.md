---
phase: 03-hosting-cutover-baseline-security-headers
plan: 03
subsystem: cloud-functions
tags: [phase-3, csp, cloud-functions, typescript, vitest, tdd, gen-2, europe-west2]

requires:
  - phase: 01-engineering-foundation-tooling
    provides: pinned-toolchain conventions (eslint 10, vitest 4.1.5, typescript 6.0.3); .github/dependabot.yml functions/ entry forward-declared
  - phase: 03-hosting-cutover-baseline-security-headers (Wave 1, plan 01)
    provides: 03-PREFLIGHT.md with verified Firebase project_id + auth_domain; CSP override list; D-06 europe-west2 lock
provides:
  - functions/ standalone npm workspace (TS + Node 22 + Gen-2) per D-04
  - cspReportSink HTTPS onRequest function pinned to europe-west2 per D-04a + D-06
  - Pure normalise() / shouldDrop() / fingerprint+isDuplicate+markSeen() modules with vitest unit coverage
  - rawBody fallback in cspReportSink (Pitfall 3 mitigation)
  - ESLint no-console=error gate enforcing logger.warn over console.warn (D-10a)
  - 64 KiB body cap + content-type allowlist (D-12 / T-3-3 abuse mitigation)
affects: [03-02 firebase.json rewrite contract, 03-04 CI deploy job, 03-05 synthetic smoke test, Phase 7 FN-01..FN-09 substrate, Phase 11 SECURITY.md observability narrative]

tech-stack:
  added:
    - "firebase-admin@13.8.0"
    - "firebase-functions@7.2.5"
    - "@types/node@22.10.5"
    - "@typescript-eslint/eslint-plugin@8.59.2 (drift from PATTERNS.md @8.18.0; reason: eslint 10 peer-support)"
    - "@typescript-eslint/parser@8.59.2 (drift from PATTERNS.md @8.18.0; reason: eslint 10 peer-support)"
    - "@eslint/js@10.0.1 (added; required by flat-config recommended set)"
    - "eslint@10.3.0, typescript@6.0.3, vitest@4.1.5, @vitest/coverage-v8@4.1.5 (root parity)"
  patterns:
    - "Standalone npm workspace (NOT a root workspace member) per Pitfall 2 / T-3-functions-mod-not-found"
    - "Pure modules + handler split for testability (RESEARCH.md §Wave 0 Gaps)"
    - "Module-level Map dedup with _clearForTest() escape hatch for fake-timer suites"
    - "rawBody fallback for application/csp-report content-type (Pitfall 3)"
    - "Comments deliberately avoid the literal string 'console.warn' so compiled JS does not trip the verifier"

key-files:
  created:
    - "functions/package.json (engines.node=22, main=lib/index.js, no 'type' field, no workspace membership at root)"
    - "functions/package-lock.json (395 packages; required for Cloud Run deploy via `npm ci`)"
    - "functions/tsconfig.json (standalone — does NOT extend root; module=commonjs, outDir=lib, rootDir=src, ignoreDeprecations=6.0)"
    - "functions/vitest.config.ts (test/**/*.test.ts; environment=node; coverage scoped to src/csp/**)"
    - "functions/.eslintrc.cjs (documentation-only breadcrumb; ESLint 10 ignores it)"
    - "functions/eslint.config.cjs (canonical runtime config; flat-config CJS form for ESLint 10)"
    - "functions/.gitignore (node_modules/, lib/, coverage/, *.local.json)"
    - "functions/src/index.ts (single re-export of cspReportSink)"
    - "functions/src/csp/cspReportSink.ts (onRequest+europe-west2; content-type+64 KiB gates; rawBody fallback; logger.warn)"
    - "functions/src/csp/normalise.ts (modern + legacy wire-format → NormalisedReport | null)"
    - "functions/src/csp/filter.ts (5 EXTENSION_SCHEMES + 3 SYNTHETIC_ORIGINS; checks both blockedUri AND sourceFile)"
    - "functions/src/csp/dedup.ts (5-min Map<fingerprint, ms>; URL.origin extraction; _clearForTest)"
    - "functions/test/csp/normalise.test.ts (10 cases — modern, legacy, garbage table)"
    - "functions/test/csp/filter.test.ts (10 cases — extension origins via blockedUri+sourceFile, synthetic, legitimate, doc-uri-mismatch)"
    - "functions/test/csp/dedup.test.ts (11 cases — 5-min boundaries, cross-fingerprint independence, fingerprint normalisation)"
  modified: []

key-decisions:
  - "eslint config delivered in BOTH formats (.eslintrc.cjs as plan-mandated breadcrumb, eslint.config.cjs as actual runtime config) because ESLint 10 dropped legacy auto-discovery."
  - "@typescript-eslint pinned at 8.59.2 (latest 8.x) NOT 8.18.0 — earliest 8.x with eslint-10 peer support is 8.57.0; 8.18.0 declares peer 'eslint ^8.57 || ^9' only."
  - "tsconfig adds rootDir=src + ignoreDeprecations=6.0 (TypeScript 6 hard-errors on bare moduleResolution=node; build needs explicit rootDir to emit lib/csp/*.js without an embedded src/ subtree)."
  - "rawBody fallback in cspReportSink runs AFTER content-type and body-size gates, BEFORE normalise — guarantees we never call JSON.parse on hostile or oversized input."

patterns-established:
  - "ESLint 10 + functions/ workspace: ship eslint.config.cjs (CJS flat config) since the workspace is CommonJS; do not rely on .eslintrc.* in any future cloud function workspace."
  - "TDD RED commits import from .js paths even though source is .ts (Node-CJS module resolution convention) — the import errors visible in the RED commit are the contract that GREEN must satisfy."
  - "Verifier-aware comments: avoid embedding literal anti-pattern strings (e.g. 'console.warn') in source comments where the compiled output is grep-checked."

requirements-completed:
  - HOST-05
  - FN-10

duration: 32min
completed: 2026-05-06
---

# Phase 3 Plan 03: cspReportSink + functions/ Workspace Summary

**TS + Node 22 + 2nd-gen `cspReportSink` Cloud Function pinned to europe-west2, wired to `/api/csp-violations` via the firebase.json rewrite shipped in plan 03-02, with three pure modules (normalise/filter/dedup) backed by 31 vitest unit tests covering both CSP wire formats, the 8 D-11 noise origins, and the 5-min dedup window with fake-timer boundary semantics.**

## Performance

- **Duration:** ~32 min
- **Started:** 2026-05-06T20:59:00Z (worktree base reset to 1842497)
- **Completed:** 2026-05-06T21:31:00Z
- **Tasks:** 2 of 2 complete (3 atomic commits — scaffold, RED, GREEN)
- **Files created:** 15 (7 config, 5 source, 3 test)
- **Files modified:** 0 outside `functions/**`

## Accomplishments

- `functions/` standalone npm workspace exists with 395 packages installed and a complete lockfile committed; `npm ci` will work in CI without root-package interference.
- `cspReportSink` is exported from `functions/src/index.ts`, pinned to `europe-west2`, and ready for the firebase.json rewrite to route `/api/csp-violations` POSTs to it.
- Both CSP wire formats round-trip through `normalise()`: modern `application/reports+json` (camelCase fields) AND legacy `application/csp-report` (kebab-case + `effective-directive`-then-`violated-directive` fallback).
- All 8 D-11 noise origins (5 extension schemes + 3 synthetic) are dropped by `shouldDrop()` whether they appear in `blockedUri` or `sourceFile`.
- 5-min dedup window honours boundary semantics exactly: `+4m59s` is a duplicate; `+5m+1ms` is not. URL.origin extraction means `https://x.example/a/b?c=d` and `https://x.example/` collapse to the same fingerprint.
- Abuse mitigation per D-12 / T-3-3 lands at the code level: 400 on non-CSP content-types; 413 on bodies > 64 KiB.
- Pitfall 3 fallback (rawBody → JSON.parse) sits AFTER content-type/size gates and BEFORE `normalise`, so JSON parse failures return 400 without hitting the dedup map.
- `logger.warn("csp.violation", { report, fingerprint })` is the only logging call in the workspace; `console.*` is forbidden by ESLint `no-console: error` (RESEARCH.md §Pattern 2 / D-10a).
- `cd functions && npm test` exits 0 with 31 passing tests across normalise (10) + filter (10) + dedup (11).
- `npm run typecheck`, `npm run lint`, and `npm run build` all exit 0; `lib/index.js` and `lib/csp/cspReportSink.js` are emitted with the expected shape.

## Task Commits

1. **Task 1: Scaffold functions/ workspace** — `9ebbdcd` (feat)
   `feat(03-03): scaffold functions/ workspace (firebase-admin 13.8 + firebase-functions 7.2)`
2. **Task 2 RED: failing tests** — `f73b428` (test)
   `test(03-03): add failing tests for normalise + filter + dedup (HOST-05, FN-10)`
3. **Task 2 GREEN: implementation** — `10223a3` (feat)
   `feat(03-03): implement cspReportSink + normalise + filter + dedup (HOST-05, FN-10)`

**Plan metadata:** committed alongside this SUMMARY.

## Files Created/Modified

**Created (under `functions/`):**

- `package.json` — Standalone workspace declaration; pinned firebase-admin@13.8.0 + firebase-functions@7.2.5; engines.node=22; main=lib/index.js.
- `package-lock.json` — 395 packages; CI uses this directly via `npm ci`.
- `tsconfig.json` — Standalone TS config (does NOT extend root); module=commonjs, target=es2022, strict=true, rootDir=src, outDir=lib, ignoreDeprecations=6.0.
- `vitest.config.ts` — Vitest config scoped to `test/**/*.test.ts`; coverage to `src/csp/**`.
- `.eslintrc.cjs` — Plan-mandated artefact; documents the rule set; **NOT** read at runtime under ESLint 10.
- `eslint.config.cjs` — Canonical flat-config in CommonJS form (workspace is CJS); enforces no-console=error + @typescript-eslint/recommended + @typescript-eslint/no-explicit-any=warn.
- `.gitignore` — `node_modules/`, `lib/`, `coverage/`, `*.local.json`.
- `src/index.ts` — Single re-export of cspReportSink.
- `src/csp/cspReportSink.ts` — onRequest({ region: "europe-west2" }) handler; pipeline = content-type → body-size → rawBody-fallback → normalise → shouldDrop → isDuplicate/markSeen → logger.warn → 204.
- `src/csp/normalise.ts` — Pure transform exporting `NormalisedReport` interface and `normalise(unknown)` returning `NormalisedReport | null`.
- `src/csp/filter.ts` — Pure `shouldDrop(NormalisedReport): boolean` over `EXTENSION_SCHEMES` + `SYNTHETIC_ORIGINS`.
- `src/csp/dedup.ts` — Module-level `Map<string, number>` keyed on `${origin}|${directive}` lowercased; exports `fingerprint`, `isDuplicate`, `markSeen`, `_clearForTest`.
- `test/csp/normalise.test.ts` — 10 cases (modern + legacy + garbage table).
- `test/csp/filter.test.ts` — 10 cases (extension origins via blockedUri+sourceFile, synthetic, legitimate keep, doc-uri mismatch keep).
- `test/csp/dedup.test.ts` — 11 cases (5-min boundary semantics, cross-fingerprint independence, fingerprint normalisation).

**Modified outside scope:** none (worktree boundary respected — firebase.json, .firebaserc, tests/firebase-config.test.js, tsconfig.json (root), and SECURITY.md remain 03-02's exclusive concern).

## Decisions Made

- **Drift @typescript-eslint/{eslint-plugin,parser} from 8.18.0 → 8.59.2 (Rule 3 - Blocking).** PATTERNS.md pinned 8.18.0; PLAN.md preauthorised the latest 8.x with eslint-10 peer support. 8.18.0 declares `peer: eslint ^8.57 || ^9` (no 10), so npm install ERESOLVE-failed. 8.57.0 is the earliest 8.x with `^10.0.0` in its eslint peer; 8.59.2 is the latest stable 8.x and was selected.
- **Add `@eslint/js@10.0.1` to devDependencies (Rule 3 - Blocking).** The flat-config `eslint.config.cjs` requires `js.configs.recommended` from `@eslint/js`; this package versions independently of `eslint` itself (latest is 10.0.1, NOT 10.3.0).
- **Ship two ESLint configs (Rule 3 - Blocking).** PATTERNS.md said "CommonJS .eslintrc.cjs, NOT flat config". ESLint 10 dropped legacy `.eslintrc.*` auto-discovery; the file would be silently ignored. Resolution: ship `.eslintrc.cjs` verbatim per the plan acceptance criterion (it documents the rule set and acts as a migration breadcrumb if eslint is ever downgraded), AND ship `eslint.config.cjs` as the canonical runtime config. Both encode the same rules. `npm run lint` runs against the flat config and exits 0.
- **Add `rootDir: "src"` and `ignoreDeprecations: "6.0"` to functions/tsconfig.json (Rule 3 - Blocking).** TypeScript 6.0.3 hard-errors on `moduleResolution: "node"` without `ignoreDeprecations: "6.0"` (matches the root tsconfig stance verbatim), and emits `lib/src/csp/*.js` (not `lib/csp/*.js`) without explicit `rootDir`. The plan's verifier expects `lib/csp/cspReportSink.js`.
- **Comment edit in cspReportSink.ts (Rule 1 - Bug).** Initial comment included the literal string `console.warn` in a "NEVER use console.warn here" warning. The plan's automated verifier greps the COMPILED output for `console.warn` and fails if found. TypeScript's default `removeComments: false` propagates the comment to `lib/csp/cspReportSink.js`. Rewrote the comment to "the console.* family is banned"; verifier passes; intent unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Upgraded @typescript-eslint/* from 8.18.0 → 8.59.2 for ESLint 10 peer support**
- **Found during:** Task 1 (`npm install`)
- **Issue:** `@typescript-eslint/eslint-plugin@8.18.0` declares `peer: eslint ^8.57 || ^9` only. With `eslint@10.3.0` pinned, npm install ERESOLVE-failed.
- **Fix:** Selected the latest stable `@typescript-eslint` 8.x (8.59.2) which declares `^8.57 || ^9 || ^10`. PLAN.md Step B note explicitly preauthorised this drift.
- **Files modified:** `functions/package.json` (and lockfile by extension).
- **Verification:** `npm install` succeeded with one harmless peer-override warning; lint exits 0.
- **Committed in:** `9ebbdcd` (Task 1 scaffold commit).

**2. [Rule 3 - Blocking] Added @eslint/js@10.0.1 dependency required by the flat-config recommended set**
- **Found during:** Task 1 (writing eslint.config.cjs)
- **Issue:** `eslint.config.cjs` imports `@eslint/js` for `js.configs.recommended`. PATTERNS.md's eslintrc snippet uses string-extends `"eslint:recommended"`, but flat config (required because of Deviation #4) requires the `@eslint/js` package.
- **Fix:** Added `@eslint/js@10.0.1` to devDependencies. (10.0.1 is the latest published; @eslint/js versions independently of eslint itself.)
- **Files modified:** `functions/package.json`, `functions/package-lock.json`.
- **Verification:** `npm install` resolves cleanly; `npm run lint` exits 0.
- **Committed in:** `9ebbdcd`.

**3. [Rule 3 - Blocking] Added rootDir + ignoreDeprecations to functions/tsconfig.json**
- **Found during:** Task 2 GREEN phase (`npm run build`).
- **Issue:** TS 6.0.3 emitted `error TS5107: Option 'moduleResolution=node10' is deprecated and will stop functioning in TypeScript 7.0` and (separately) `error TS5011: The common source directory of 'tsconfig.json' is './src'. The 'rootDir' setting must be explicitly set`. Both blocked the build entirely.
- **Fix:** Added `"rootDir": "src"` and `"ignoreDeprecations": "6.0"` to `functions/tsconfig.json`. Matches the root tsconfig.json stance verbatim (`ignoreDeprecations: "6.0"` is already there; `rootDir` is set implicitly because the root has only one source directory).
- **Files modified:** `functions/tsconfig.json`.
- **Verification:** `npm run typecheck` exits 0; `npm run build` emits `lib/index.js` and `lib/csp/cspReportSink.js` with correct paths (no embedded `lib/src/` subdirectory).
- **Committed in:** `10223a3` (Task 2 GREEN commit).

**4. [Rule 3 - Blocking] Shipped functions/eslint.config.cjs alongside .eslintrc.cjs**
- **Found during:** Task 1 read_first phase (cross-checking ESLint 10 behaviour).
- **Issue:** PATTERNS.md asserts `.eslintrc.cjs` is the canonical config. ESLint 9 deprecated this format; ESLint 10 (per Migration to v10.0.0) drops the `ESLINT_USE_FLAT_CONFIG=false` escape hatch and no longer auto-discovers `.eslintrc.*`. Running `npm run lint` against `.eslintrc.cjs` would fail to find ANY config (or ignore it silently).
- **Fix:** Created `functions/eslint.config.cjs` as the canonical runtime config (CJS form because the workspace is CJS). Retained `.eslintrc.cjs` verbatim per PLAN.md acceptance criterion ("File `functions/.eslintrc.cjs` exists") with a header comment marking it as documentation-only. Both files encode the same rule set: parser=@typescript-eslint/parser, extends recommended sets, `no-console: error`, `@typescript-eslint/no-explicit-any: warn`.
- **Files modified:** Created both `functions/.eslintrc.cjs` and `functions/eslint.config.cjs`.
- **Verification:** `npm run lint` exits 0 against the flat config.
- **Committed in:** `9ebbdcd`.

**5. [Rule 1 - Bug] Rewrote a documentation comment to avoid the literal string `console.warn` in compiled output**
- **Found during:** Task 2 GREEN phase verifier.
- **Issue:** A file-header comment in `cspReportSink.ts` read "NEVER use console.warn here". TypeScript's default `removeComments: false` means the comment lands in `lib/csp/cspReportSink.js`. The PLAN.md `<verify automated>` script asserts `!out.includes('console.warn')` — the comment caused a false-positive FAIL even though no actual `console.warn(...)` call exists.
- **Fix:** Reworded the comment to "the console.* family is banned in this workspace by ESLint no-console=error per RESEARCH.md §Pattern 2". Intent preserved; the literal anti-pattern string no longer appears in compiled output. Source files still have ZERO `console.*` calls (`grep -rE 'console\.(warn|log|error|info|debug)' src/` returns 0 matches).
- **Files modified:** `functions/src/csp/cspReportSink.ts`.
- **Verification:** Re-ran verifier; OK. `grep -rE 'console\\.\\(warn|log|error|info|debug\\)' src/` returns no matches.
- **Committed in:** `10223a3`.

---

**Total deviations:** 5 (4 Rule-3 blocking, 1 Rule-1 bug). All necessary for the plan's verifier and CI gates to pass; no scope creep. Three of the deviations (1, 2, 4) are upstream-version-drift fixes; PATTERNS.md was authored against an older eslint+@typescript-eslint matrix. Deviation 3 brings functions/tsconfig.json into compliance with TypeScript 6 already in use at the root. Deviation 5 is a verifier-aware comment edit that preserves intent.

## Authentication Gates

None. The plan is fully autonomous; no external auth surfaces (gcloud, firebase login, GitHub) were required.

## Issues Encountered

- TypeScript 6.0.3 deprecation hard-errors (TS5107) hit immediately on `npm run build`. Discovered during Task 2 GREEN; resolved by mirroring the root tsconfig's `ignoreDeprecations: "6.0"` stance. (Documented as Deviation #3 above; not a separate issue.)
- The plan's `<verify automated>` grep on `console.warn` caught a documentation comment, not a real anti-pattern. (Documented as Deviation #5 above.)
- Note re: "Root npm run typecheck still exits 0" plan acceptance criterion: this depends on plan 03-02 expanding the root tsconfig.json `exclude` from `"functions/lib"` to `"functions/**"`. 03-02 runs in a separate worktree and the parallel-execution boundary forbids this executor from modifying root tsconfig.json. The merge-back step orchestrated by the parent will reconcile both worktrees' changes; the criterion is therefore validated at the orchestrator level, not inside this worktree. Manually verified within this worktree by running `npm run typecheck` from the repo root: it now reports type errors on `functions/src/**.ts` AS EXPECTED before 03-02 lands. After the orchestrator merges 03-02's tsconfig change, root typecheck will pass.

## Self-Check

- [x] `functions/package.json` exists with `engines.node === "22"`, `main === "lib/index.js"`, `private === true`, no `type` field.
- [x] firebase-admin@13.8.0 + firebase-functions@7.2.5 pinned exactly (no `^` / `~`).
- [x] `functions/tsconfig.json` exists; `module === "commonjs"`; `outDir === "lib"`; `target === "es2022"`; `strict === true`; does NOT contain `extends`.
- [x] `functions/.eslintrc.cjs` exists (plan acceptance criterion).
- [x] `functions/eslint.config.cjs` exists (canonical runtime config under ESLint 10).
- [x] `functions/.gitignore` exists.
- [x] `functions/vitest.config.ts` exists.
- [x] `functions/package-lock.json` exists (395 packages).
- [x] Root `package.json` has no `workspaces` key (Pitfall 2 / T-3-functions-mod-not-found mitigated).
- [x] `functions/src/csp/normalise.ts` exists; exports `normalise` AND `NormalisedReport`.
- [x] `functions/src/csp/filter.ts` exists; uses `EXTENSION_SCHEMES` + `SYNTHETIC_ORIGINS`.
- [x] `functions/src/csp/dedup.ts` exists; exports `fingerprint`, `isDuplicate`, `markSeen`, `_clearForTest`; contains `5 * 60 * 1000`.
- [x] `functions/src/csp/cspReportSink.ts` exists; contains `onRequest`, `region: "europe-west2"`, `application/csp-report`, `application/reports+json`, `64 * 1024`, `logger.warn`, `csp.violation`, `req.rawBody`. Does NOT contain `console.warn` or `console.log`.
- [x] `functions/src/index.ts` exists; contains `export { cspReportSink }`.
- [x] All three `test/csp/*.test.ts` files exist with the prescribed coverage.
- [x] `cd functions && npm test -- --run` exits 0 with 31 passing tests.
- [x] `cd functions && npm run typecheck` exits 0.
- [x] `cd functions && npm run lint` exits 0.
- [x] `cd functions && npm run build` exits 0; `lib/index.js` + `lib/csp/cspReportSink.js` exist; compiled cspReportSink contains `csp.violation`, `europe-west2`, `logger.warn`; does NOT contain `console.warn`.
- [x] Three atomic commits exist: scaffold (`9ebbdcd`), RED (`f73b428`), GREEN (`10223a3`).
- [x] `grep -rE 'console\\.(warn|log|error|info|debug)' functions/src/` returns nothing.
- [x] `grep -c "europe-west2" functions/src/csp/cspReportSink.ts` returns 2.

## Self-Check: PASSED

## Next Phase Readiness

- **Hand-off to 03-02-PLAN.md (parallel wave-2 worktree):** The contract this plan ships is `functionId: "cspReportSink"`, `region: "europe-west2"`, compiled entry at `functions/lib/index.js`. Plan 03-02's `firebase.json` rewrite must reference exactly these names. Plan 03-02 must also expand the root `tsconfig.json` exclude from `"functions/lib"` to `"functions/**"` so root typecheck does not attempt to JSDoc-check real TypeScript files in `functions/src/`.
- **Hand-off to 03-04-PLAN.md (CI deploy job):** the deploy job MUST run `cd functions && npm ci && npm run build` BEFORE `firebase deploy --only hosting,functions` (Pitfall 5). The functions workspace is standalone; root `npm ci` does NOT install its dependencies. The exact command sequence appears in RESEARCH.md §Pattern 3 lines 521–525 and is reproduced verbatim in PATTERNS.md.
- **Hand-off to 03-05-PLAN.md (synthetic smoke):** the smoke test MUST POST a CSP report with content-type `application/csp-report` (legacy) AND `application/reports+json` (modern) to `https://baselayers.bedeveloped.com/api/csp-violations` to confirm both wire formats round-trip end-to-end. The rawBody fallback (Pitfall 3) is the highest-risk untested branch in unit tests — the smoke test is its only end-to-end verification.
- **Phase 7 carry-forward:** this is the substrate FN-01..FN-09 expand. Same `functions/` directory; same Node 22; same Gen-2; same TS+vitest setup. Phase 7 adds App Check, Zod validation, idempotency markers, Sentry node SDK, per-function service accounts, and the audit-log writers. The eslint.config.cjs canonical-config decision documented above is a Phase 7 input.
- **No blockers.** Plan 03-02 and Plan 03-03 can land in either order; the orchestrator merges both worktrees back to main after this wave.

---

*Phase: 03-hosting-cutover-baseline-security-headers*
*Plan: 03 (Wave 2)*
*Completed: 2026-05-06*
