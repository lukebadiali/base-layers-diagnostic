---
phase: 09-observability-audit-event-wiring
plan: 02
subsystem: observability
tags: [obs-04, sentry, vite-plugin, ci, source-maps, hidden-source-maps, pitfall-6]
requires:
  - phase: 09-observability-audit-event-wiring/09-01
    provides: "@sentry/vite-plugin@5.2.1 devDep installed; @sentry/browser init substrate; operator runbook (Steps 1-5 = Sentry org/project/DSN/auth-token/GH-secrets)"
  - phase: 03-hosting-cutover-baseline-security-headers
    provides: "Build/deploy/preview CI job structure (build → deploy on main, preview on PR)"
  - phase: 07-cloud-functions-app-check
    provides: "vite.config.js FN-07 conditional plugin guard pattern (env.VAR && command === build && plugin())"
provides:
  - "@sentry/vite-plugin registered conditionally in vite.config.js (env.SENTRY_AUTH_TOKEN && command === build)"
  - "EU-region source-map upload to https://de.sentry.io/ (data residency)"
  - "Hidden source maps invariant — filesToDeleteAfterUpload: [dist/**/*.map] in plugin AND post-build CI gate (Pitfall 6 two-layer defence)"
  - "CI build/deploy/preview jobs all carry VITE_SENTRY_DSN, VITE_GIT_SHA, SENTRY_AUTH_TOKEN, GITHUB_SHA env wiring"
  - "Static-source drift-detector test (tests/build/source-map-gate.test.js) — 5 assertions over vite.config.js"
affects:
  - "Wave 5 close-gate (Plan 09-05) — verifies first deploy-to-main shows source-map upload step + 'Assert no .map files' step OK in run logs"
  - "Operator runbook Step 5 (runbooks/phase-9-sentry-bootstrap.md) — Sentry secrets MUST be set in GitHub Actions before first deploy-to-main, otherwise the .map gate fails the deploy by design"
  - "Phase 10 (CSP tightening) — source-map-aware error stacks land in Sentry once deploy runs; Phase 10 CSP tightening will benefit from Sentry-tagged stack traces"
tech-stack:
  added:
    - "@sentry/vite-plugin@5.2.1 (devDep — installed Wave 1; first usage Wave 2)"
  patterns:
    - "Conditional vite plugin via env-var-AND-command guard with .filter(Boolean) (extends Phase 7 FN-07 pattern from one plugin to N)"
    - "Hidden source-map two-layer defence: plugin filesToDeleteAfterUpload + CI find-grep gate (defends against both plugin misconfig AND missing-token scenarios)"
    - "Static-source drift detector via fs.readFileSync + regex assertions (cheap CI gate; complements but does not replace runtime build assertion)"
    - "PR-validation build does NOT carry the .map gate (no token = .map files survive by design); deploy + preview gates fail closed instead"
key-files:
  created:
    - tests/build/source-map-gate.test.js
    - .planning/phases/09-observability-audit-event-wiring/09-02-SUMMARY.md
  modified:
    - vite.config.js
    - .github/workflows/ci.yml
key-decisions:
  - "Plugin telemetry disabled (telemetry: false) — no plugin-side phone-home to Sentry, only release + sourcemap upload calls fire"
  - ".map gate intentionally OMITTED from PR-validation build job — that job runs without SENTRY_AUTH_TOKEN (forks have no secrets) and would false-positive; deploy + preview gates are the operative defence"
  - "Test uses path.resolve(process.cwd(), 'vite.config.js') instead of new URL(..., import.meta.url) — happy-dom test env serves http:// not file://, breaking the URL-form readFileSync"
  - "Hard-coded org=bedeveloped + project=base-layers-diagnostic (not via env) — Sentry org/project slugs are public-ish identifiers per Sentry conventions; auth-token is the secret"
  - "Conditional ordering: env.SENTRY_AUTH_TOKEN && command === 'build' && plugin() — short-circuits before plugin allocation; plugins[].filter(Boolean) drops the false from non-build paths"
patterns-established:
  - "Pattern: Hidden source-map two-layer defence (filesToDeleteAfterUpload + post-build CI gate). Future phases requiring sensitive build artifacts can mirror this."
  - "Pattern: Static-source drift-detector test — readFileSync + regex over a config file. Cheap, fast, catches drift at PR-time without running the build."
requirements-completed:
  - OBS-04
metrics:
  duration_seconds: 969
  duration_human: "~16 minutes"
  tasks_completed: 2
  files_created: 2  # source-map-gate.test.js + this SUMMARY.md
  files_modified: 2 # vite.config.js + ci.yml
  files_deleted: 0
  tests_added: 5
  tests_passing_source_map_gate: "5/5"
  completed_date: "2026-05-10"
commits:
  - hash: fc29a4f
    type: feat
    summary: "register @sentry/vite-plugin in vite.config.js + source-map gate test"
  - hash: f3978eb
    type: feat
    summary: "wire Sentry env vars into CI build/deploy/preview + .map gate"
---

# Phase 9 Plan 02: @sentry/vite-plugin source-map upload + CI env wiring Summary

**Source maps now upload to EU Sentry (https://de.sentry.io/) on every main deploy and PR preview, release-tagged with the GitHub SHA, with a two-layer hidden-source-maps defence — vite plugin's `filesToDeleteAfterUpload: ["dist/**/*.map"]` cleanup + a post-build CI gate that fails the deploy if any .map files survive in dist (OBS-04 / Pitfall 6).**

## Performance

- **Duration:** ~16 minutes (969 seconds)
- **Started:** 2026-05-10T16:41:27Z
- **Completed:** 2026-05-10T16:57:36Z
- **Tasks:** 2 (both autonomous, no checkpoints)
- **Files modified:** 2 (`vite.config.js`, `.github/workflows/ci.yml`)
- **Files created:** 2 (`tests/build/source-map-gate.test.js`, this SUMMARY)

## Accomplishments

- `@sentry/vite-plugin@5.2.1` registered conditionally in `vite.config.js` plugins array. The condition `env.SENTRY_AUTH_TOKEN && command === "build" && sentryVitePlugin({...})` short-circuits cleanly: local dev (`vite serve`), unit tests, and PR builds without the secret are silent no-ops. Mirrors the Phase 7 FN-07 reCAPTCHA placeholder pattern.
- EU-region URL hard-coded (`url: "https://de.sentry.io/"`) — data-residency contract anchor.
- Hidden source-maps invariant satisfied via two layers: plugin `filesToDeleteAfterUpload: ["dist/**/*.map"]` cleans up after upload, AND a post-build CI gate (`find dist -name "*.map" -type f | grep -q .` → exit 1 if matches) on both deploy + preview jobs fails closed if any .map remains.
- CI workflow build/deploy/preview jobs now all carry the four new env vars (`VITE_SENTRY_DSN`, `VITE_GIT_SHA`, `SENTRY_AUTH_TOKEN`, `GITHUB_SHA`) on top of the existing reCAPTCHA placeholder. SENTRY_AUTH_TOKEN unset on fork PRs is the no-op path; gate catches the consequence.
- `tests/build/source-map-gate.test.js` — 5 static-source assertions (regex over `vite.config.js`) catch config-file drift at PR time without running vite. Test passes 5/5; lint clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: Register @sentry/vite-plugin in vite.config.js + source-map-gate test** — `fc29a4f` (feat)
2. **Task 2: Wire Sentry env vars into CI build/deploy/preview + .map gate** — `f3978eb` (feat)

**Plan metadata commit:** _(this SUMMARY.md + STATE.md update — separate final commit)_

## Files Created / Modified

### Created (2)

- **`tests/build/source-map-gate.test.js`** — 5 static-source assertions over `vite.config.js`:
  1. imports `sentryVitePlugin` from `@sentry/vite-plugin`
  2. registers under `SENTRY_AUTH_TOKEN.*command === "build".*sentryVitePlugin(`
  3. uses EU region URL `https://de.sentry.io/`
  4. declares `filesToDeleteAfterUpload: ["dist/**/*.map"]`
  5. disables plugin telemetry (`telemetry: false`)
  Reads via `path.resolve(process.cwd(), "vite.config.js")` (happy-dom test env serves http:// URLs, breaks the `new URL(..., import.meta.url)` form).
- **`.planning/phases/09-observability-audit-event-wiring/09-02-SUMMARY.md`** — this file.

### Modified (2)

- **`vite.config.js`** — added top-of-file Phase 9 Wave 2 banner; added `import { sentryVitePlugin } from "@sentry/vite-plugin"`; added `plugins: [...]` array containing the conditional plugin entry; preserved existing `build`, `server`, `test` blocks and the FN-07 fail-closed guard. `sourcemap: true` was already present in `build` (no change needed). Prettier reformatted on commit (line-wrapping). 
- **`.github/workflows/ci.yml`** — added 4 new env vars (`VITE_SENTRY_DSN`, `VITE_GIT_SHA`, `SENTRY_AUTH_TOKEN`, `GITHUB_SHA`) to the build, deploy, and preview job build steps; added a post-build "Assert no .map files served from dist" step to deploy + preview jobs (NOT to build job — see decision below).

### Deleted (0)

None.

## Verification

| Command                                                                          | Outcome             |
| -------------------------------------------------------------------------------- | ------------------- |
| `npm test -- --run tests/build/source-map-gate.test.js`                          | 5/5 pass            |
| `npm run lint`                                                                    | exit 0 (no errors)  |
| `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=ci-build-verification-placeholder npm run build` | exits 0; 4 .map files present in dist (no token = plugin no-op = expected) |
| `grep -c "VITE_SENTRY_DSN" .github/workflows/ci.yml`                             | 4 (≥ 3 required)    |
| `grep -c "SENTRY_AUTH_TOKEN" .github/workflows/ci.yml`                           | 10 (≥ 3 required)   |
| `grep -c "Assert no .map files" .github/workflows/ci.yml`                        | 2 (≥ 2 required)    |
| `node -e "yaml.parse(...)"` (yaml validity)                                       | 9 jobs valid; deploy=9 steps; preview=8 steps |
| `git diff --check .github/workflows/ci.yml`                                       | exit 0 (no whitespace errors) |

CI sanity (cannot run locally — verified post-merge by inspecting first deploy run logs per Wave 5 close-gate):

- Build step shows env vars set in the run log preamble.
- For deploy/preview: plugin runs (or no-op if token missing); .map gate runs and either passes (zero .map) or fails (clear error).

## Decisions Made

1. **Plugin telemetry disabled** (`telemetry: false`) — no plugin self-telemetry to Sentry, only release-finalize + sourcemap-upload API calls fire. Matches the project's "no third-party telemetry" disposition.
2. **.map gate omitted from PR-validation build job** — the build job runs without `SENTRY_AUTH_TOKEN` (forks don't carry repo secrets), so the plugin no-ops by design and `.map` files survive in `dist/` by design. Adding the gate there would false-positive on every fork PR. The deploy + preview jobs are the operative defence layer; both have the gate.
3. **Test uses `path.resolve(process.cwd(), "vite.config.js")`** instead of `new URL(..., import.meta.url)` — happy-dom test env (vitest's default in this repo) serves `http://` URLs from `import.meta.url`, which `readFileSync(URL)` rejects with "URL must be of scheme file." `process.cwd()` resolves cleanly because vitest always runs from project root.
4. **Hard-coded `org: "bedeveloped"` + `project: "base-layers-diagnostic"`** — Sentry org/project slugs are public-ish identifiers (they appear in DSN URLs and in error event metadata); only `authToken` is the secret. No need to plumb non-secrets through env.
5. **Conditional ordering: `env.SENTRY_AUTH_TOKEN && command === "build" && sentryVitePlugin(...)`** — short-circuit semantics drop the plugin allocation when either guard is false. `plugins: [...].filter(Boolean)` strips the resulting `false` so vite never sees a non-plugin entry.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Test failed under happy-dom env: `import.meta.url` is not file-scheme**

- **Found during:** Task 1 (initial test run)
- **Issue:** First version used `new URL("../../vite.config.js", import.meta.url)` per the plan's paste-ready snippet. happy-dom (vitest's default test environment in this repo per `vite.config.js test.environment`) sets `import.meta.url` to an `http://` URL, which `readFileSync(URL)` rejects with `TypeError: The URL must be of scheme file`.
- **Fix:** Switched to `readFileSync(resolve(process.cwd(), "vite.config.js"), "utf-8")`. vitest always runs from project root so `process.cwd()` resolves the file unambiguously.
- **Files modified:** `tests/build/source-map-gate.test.js`
- **Verification:** Test passed 5/5 after the fix.
- **Committed in:** `fc29a4f` (Task 1 commit; the fix landed before the first commit)

**2. [Rule 1 — Bug] Lint flagged `/* global process */` as `no-redeclare`**

- **Found during:** Task 1 (lint pass after test passed)
- **Issue:** Added `/* global process */` per defensive habit; the project's flat ESLint config already declares `process` as a Node global, so the `globals` block flagged it as a redeclaration (`'process' is already defined as a built-in global variable no-redeclare`).
- **Fix:** Dropped the comment.
- **Files modified:** `tests/build/source-map-gate.test.js`
- **Verification:** `npm run lint` exit 0 after the fix.
- **Committed in:** `fc29a4f` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — Bugs in my own freshly-written test file; the plan's paste-ready snippet would have failed under happy-dom but the plan already documented the test should be defensive).
**Impact on plan:** No scope creep. Both fixes were direct to the plan's verification criteria (test must pass; lint must be clean).

## Threat Model Disposition Recap

All 5 threats from the plan's `<threat_model>` are addressed:

- **T-9-02-1 (I — .map files served from Hosting):** mitigated by two layers — plugin `filesToDeleteAfterUpload: ["dist/**/*.map"]` AND post-build CI gate. Both must fail for an exposure.
- **T-9-02-2 (I — SENTRY_AUTH_TOKEN exposure in build logs):** mitigated. Token only sourced from `${{ secrets.SENTRY_AUTH_TOKEN }}` (no echo, no `set -x`). Gate step does NOT print the token. GitHub Actions auto-masks any echoed value as well.
- **T-9-02-3 (T — compromised SENTRY_AUTH_TOKEN):** accepted. Token scope is bounded to one Sentry project; quarterly rotation per Phase 7 secret cadence (operator action documented in `runbooks/phase-9-sentry-bootstrap.md`).
- **T-9-02-4 (D — build failure when token absent on deploy):** accepted. PR-validation builds are no-op-OK (token absent by design on forks). Deploy + preview gate fails with a clear "FAIL: dist/*.map files present" message — operator action surfaces as a bright red CI step rather than silent skip.
- **T-9-02-5 (D — plugin retry storm):** accepted. Plugin v5 has built-in backoff; deploy is gated on .map cleanup, not on upload success — defence layer is local.

## Issues Encountered

None beyond the two auto-fixed deviations above.

## Forward-Tracking Ledger Rows

Queued for downstream plans:

| Row | Owner | Closure Path |
|-----|-------|--------------|
| First-deploy verification: source-map upload step + .map gate OK in run logs | Plan 09-05 close-gate | Wave 5 verifies the first push-to-main run shows the plugin firing AND the gate passing |
| Operator must set GitHub Actions secrets before first deploy: `SENTRY_AUTH_TOKEN`, `VITE_SENTRY_DSN` | Operator (per `runbooks/phase-9-sentry-bootstrap.md` Step 5) | Without these secrets the .map gate fails the deploy by design — the failure mode is the substrate-honest signal that Step 5 was not yet executed |

## User Setup Required

None for code execution. The deploy-time activation requires the operator to have completed Steps 1-5 of `runbooks/phase-9-sentry-bootstrap.md` (Sentry org → EU project → DSN → auth token → GitHub Actions secrets). Plan 09-02 lands the code substrate; the source-map upload is a no-op until the operator-set secrets resolve.

## Next Phase Readiness

- **Code substrate complete.** Wave 3 (Plan 09-03 — AUDIT-05 view wiring at `src/firebase/auth.js` + `src/cloud/*.js` seams) can proceed immediately; it has no dependency on the Sentry vite plugin or CI env wiring.
- **Operator action gates the Wave 5 close-gate verification**, not Plan 09-03 execution.

## Self-Check: PASSED

**Files claimed created — all exist:**
- `tests/build/source-map-gate.test.js` — FOUND
- `.planning/phases/09-observability-audit-event-wiring/09-02-SUMMARY.md` — FOUND (this file)

**Files claimed modified — diffs present in commits:**
- `vite.config.js` — `git show fc29a4f --stat` shows 81 insertions
- `.github/workflows/ci.yml` — `git show f3978eb --stat` shows 63 insertions / 2 deletions

**Commits claimed — all exist:**
- `fc29a4f` — FOUND
- `f3978eb` — FOUND

**Verification commands all pass:**
- `npm test -- --run tests/build/source-map-gate.test.js`: 5/5 green
- `grep -c "VITE_SENTRY_DSN" .github/workflows/ci.yml`: 4
- `grep -c "SENTRY_AUTH_TOKEN" .github/workflows/ci.yml`: 10
- `grep -c "Assert no .map files" .github/workflows/ci.yml`: 2

---
*Phase: 09-observability-audit-event-wiring*
*Plan: 02*
*Completed: 2026-05-10*
