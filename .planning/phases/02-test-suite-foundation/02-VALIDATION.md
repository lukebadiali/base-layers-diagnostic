---
phase: 02
slug: test-suite-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-06
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `02-RESEARCH.md` §"Validation Architecture" and `02-CONTEXT.md` D-15..D-20.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4 + happy-dom 20.9.0 + @vitest/coverage-v8 (pinned by Phase 1 D-31) |
| **Config file** | `vite.config.js` (inline `test:` block — Phase 1 inlined; D-15 thresholds extend) |
| **Quick run command** | `npm test -- --run` (no watch; default `vitest run`) |
| **Full suite command** | `npm test -- --run --coverage` |
| **Estimated runtime** | ~15-30s local, ~30-60s CI (D-18 soft target: <30s local, <90s CI) |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run` (changed-file scope acceptable for in-wave iteration)
- **After every plan wave:** Run `npm test -- --run --coverage`
- **Before `/gsd-verify-work`:** Full suite + coverage gate must be green; snapshot files must be diff-clean against `HEAD~1`
- **Max feedback latency:** 90 seconds (CI ceiling per D-18)

---

## Per-Task Verification Map

> Task IDs map to plans defined by `gsd-planner` in step 8. Pre-allocated row stubs match the topological wave sequence from RESEARCH.md §"Topological Extraction Order"; the planner SHALL refine task IDs and fill `Status` during execution.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-00-01 | 02-00 | 0 | TEST-01 (preflight) | T-2-04 | GH-Pages serves `<script type="module">` with `application/javascript` MIME on preview branch | manual | `curl -I https://<preview>.github.io/<repo>/app.js` | ❌ W0 | ⬜ pending |
| 02-00-02 | 02-00 | 0 | TEST-01 (preflight) | T-2-04 | happy-dom `crypto.subtle.digest` byte-matches Node `crypto.createHash('sha256')` | unit | `node tests/fixtures/_generators/hash-passwords.js && npm test -- crypto-parity.test.js` | ❌ W0 | ⬜ pending |
| 02-00-03 | 02-00 | 0 | TEST-01 (preflight) | — | `tests/setup.js` loads via `vite.config.js` `test.setupFiles`; fake timers + UUID + Math.random + happy-dom gap stubs in place | unit | `npm test -- setup.test.js` | ❌ W0 | ⬜ pending |
| 02-00-04 | 02-00 | 0 | TEST-01 (preflight) | — | Bridge: `index.html` `<script type="module" src="./app.js">`; `app.js` IIFE imports from `src/` | smoke | `npm run build && grep -q 'type="module"' index.html` | ❌ W0 | ⬜ pending |
| 02-01-01 | 02-01 | 1 | TEST-01 (utils) | — | `src/util/hash.js` exports `hashString` byte-identical to IIFE | unit | `npm test -- util/hash.test.js` | ❌ W0 | ⬜ pending |
| 02-01-02 | 02-01 | 1 | TEST-01 (utils) | — | `src/util/ids.js` exports `uid`, `iso`, `formatWhen`, `initials`, `firstNameFromAuthor` — deterministic under fake timers | unit | `npm test -- util/ids.test.js` | ❌ W0 | ⬜ pending |
| 02-01-03 | 02-01 | 1 | DOC-10 (incremental) | — | `SECURITY.md` § Build & Supply Chain "Regression baseline" paragraph cites TEST-01..07 + TEST-10 + ASVS V14.2 + ISO 27001 A.12.1.2 + SOC2 CC8.1 (D-21) | doc-grep | `grep -q "Regression baseline" SECURITY.md && grep -q "ASVS V14.2" SECURITY.md` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02-02 | 2 | TEST-02 (banding) | — | `src/domain/banding.js` exports `pillarStatus`, `bandLabel`, `bandStatement`, `bandColor`; idempotency + boundary tests fail if behaviour drifts | unit | `npm test -- domain/banding.test.js` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02-02 | 2 | TEST-02 (scoring) | — | `src/domain/scoring.js` exports `pillarScoreForRound`, `pillarScore`, `respondentsForRound`, `answeredCount`; boundary tests for 0/full/missing rounds | unit | `npm test -- domain/scoring.test.js` | ❌ W0 | ⬜ pending |
| 02-03-01 | 02-03 | 3 | TEST-03 (completion) | — | `src/domain/completion.js` exports `userCompletionPct`, `orgSummary`; orgSummary boundary at 0/100% | unit | `npm test -- domain/completion.test.js` | ❌ W0 | ⬜ pending |
| 02-03-02 | 02-03 | 3 | TEST-05 (unread) | — | `src/domain/unread.js` exports `unreadCountForPillar`, `unreadCountTotal`, `markPillarRead`, `unreadChatTotal`; **pins H7 broken behaviour as regression baseline** (Pitfall 20 — Phase 5 fix WILL break these tests; that diff is the cutover evidence) | unit | `npm test -- domain/unread.test.js` | ❌ W0 | ⬜ pending |
| 02-04-01 | 02-04 | 4 | TEST-04 (migration) | — | `src/data/migration.js` exports `migrateV1IfNeeded`, `clearOldScaleResponsesIfNeeded`; idempotency assertion (Pitfall 10): re-run on migrated data is a no-op | unit | `npm test -- data/migration.test.js` | ❌ W0 | ⬜ pending |
| 02-04-02 | 02-04 | 4 | TEST-06 (cloud-sync) | — | `src/data/cloud-sync.js` exports `syncFromCloud`; `tests/mocks/firebase.js` factory drives failure scenarios; **pins H8 broken behaviour as regression baseline** (Pitfall 20) | unit | `npm test -- data/cloud-sync.test.js` | ❌ W0 | ⬜ pending |
| 02-04-03 | 02-04 | 4 | TEST-07 (auth) | T-1-01 | `src/auth/state-machine.js` exports `verifyInternalPassword`, `verifyOrgClientPassphrase`, `verifyUserPassword`, `currentUser`; uses real `crypto.subtle.digest`; known-password fixtures match | unit | `npm test -- auth/state-machine.test.js` | ❌ W0 | ⬜ pending |
| 02-05-01 | 02-05 | 5 | TEST-10 (snapshot) | — | `tests/__snapshots__/views/dashboard.html` produced via `toMatchFileSnapshot`; comprehensive seeding (fake timers + deterministic UUID + Math.random=0.5 + Chart.js stub) | snapshot | `npm test -- views/dashboard.test.js` | ❌ W0 | ⬜ pending |
| 02-05-02 | 02-05 | 5 | TEST-10 (snapshot) | — | `tests/__snapshots__/views/diagnostic.html` produced; stable across Linux CI + Windows + macOS dev (Vitest 4 normalises newlines per PR #3164) | snapshot | `npm test -- views/diagnostic.test.js` | ❌ W0 | ⬜ pending |
| 02-05-03 | 02-05 | 5 | TEST-10 (snapshot) | — | `tests/__snapshots__/views/report.html` produced | snapshot | `npm test -- views/report.test.js` | ❌ W0 | ⬜ pending |
| 02-05-04 | 02-05 | 5 | TEST-01..10 (CI gate) | — | `vite.config.js` `test.coverage.thresholds` enforces D-15 tiers (domain/util 100%, auth 95%, data 90%, app.js excluded); CI fails on threshold miss | ci-job | `npm test -- --run --coverage` | ❌ W0 | ⬜ pending |
| 02-05-05 | 02-05 | 5 | TEST-01..10 (CI artefacts) | — | `.github/workflows/ci.yml` extends Phase 1 with HTML coverage artefact upload (`coverage-report-html`) per D-20; snapshot mismatch → CI fail (no `-u` flag) | ci-job | `gh run view --log` (manual on first push) | ❌ W0 | ⬜ pending |
| 02-05-06 | 02-05 | 5 | TEST-10 + housekeeping | — | `tests/smoke.test.js` deleted in same commit as first real snapshot test (D-19); cleanup ledger entries appended for D-05 + D-06 | doc-grep | `! test -f tests/smoke.test.js && grep -q "Phase 2 extracted" runbooks/phase-4-cleanup-ledger.md` | ❌ W0 | ⬜ pending |
| 02-05-07 | 02-05 | 5 | DOC-10 (incremental) | — | `CONTRIBUTING.md` "Updating snapshot tests" section + soft <30s/<90s runtime target (D-17 + D-18) | doc-grep | `grep -q "Updating snapshot tests" CONTRIBUTING.md && grep -q "30s" CONTRIBUTING.md` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/setup.js` — global config (fake timers + deterministic UUID + Math.random + happy-dom gap stubs for `matchMedia`, `ResizeObserver`, `IntersectionObserver`)
- [ ] `tests/mocks/firebase.js` — reusable factory (`makeFirestoreMock({ failGetDoc, failSetDoc, failUpdateDoc, seed })`)
- [ ] `tests/mocks/chartjs.js` — Chart.js stub storing `__lastConfig` on instance
- [ ] `tests/fixtures/_generators/hash-passwords.js` — Node script generating SHA-256 hex for known-password fixtures
- [ ] `tests/fixtures/auth-passwords.js` — known-password fixtures (generator output committed alongside)
- [ ] `tests/fixtures/snapshot-org.json` — TEST-10 renderer baseline (1 org, 2 rounds, 3 internal + 2 client users, ~10 responses, 3 comments incl. 1 unread, 2 actions, 1 document, 5 chat messages)
- [ ] `tests/fixtures/v1-localStorage.json` — TEST-04 v1 input shape
- [ ] `tests/fixtures/v2-org.json` — TEST-04 post-migration baseline
- [ ] `tests/fixtures/unread-state.json` — TEST-05 read/unread test inputs
- [ ] `tests/fixtures/cloud-sync-conflict.json` — TEST-06 sync error scenarios
- [ ] `vite.config.js` — extend Phase 1's `test:` block with `setupFiles: ['./tests/setup.js']` + `coverage.thresholds` per-directory tiers + `coverage.exclude` (`app.js`, `firebase-init.js`, `data/pillars.js`, `tests/**`, `_generators/**`)
- [ ] `index.html` — rewrite `<script>` tag to `type="module"` (D-04, supersedes Phase 1 D-14)
- [ ] `app.js` — prepend named ESM imports from extracted modules at the top of the IIFE; replace inline definitions with `// Phase 4: extracted to src/<path> — re-imported here, do not re-define` comments

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GH-Pages serves `<script type="module">` correctly | TEST-01 (preflight) | Production hosting smoke test before merging the bridge change; cannot run inside CI without preview channel | Push the bridge change to a feature branch deployed to a preview subdomain (or use a temporary GH-Pages site); load in a fresh browser tab; confirm DevTools console shows zero module-loading errors and `app.js` imports resolve |
| GH-Pages serves `src/**/*.js` with `application/javascript` MIME | TEST-01 (preflight) | Production hosting smoke test; CI cannot test live MIME headers | Same preview branch; `curl -I https://<preview>/src/util/hash.js` and confirm `Content-Type: application/javascript` (or `text/javascript`) |
| Snapshot intentionality on update | TEST-10 (governance D-17) | Snapshot updates require human judgement of what changed | Reviewer reads PR diff in `tests/__snapshots__/views/`; confirms the only delta corresponds to a deliberate UI change documented in the PR description |
| Phase 5/Phase 6 cutover evidence (forward-looking) | TEST-05 + TEST-06 + TEST-07 (deliberate brittleness) | Future phases will break these tests by design; the diff IS the cutover evidence | When Phase 5 lands H7 fix or Phase 6 lands real Auth, reviewer confirms the breaking tests are TEST-05/06/07 and not collateral damage from a different change |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (Wave 0 = setup; Waves 1-5 every task ships with a passing test of the same name)
- [ ] Wave 0 covers all MISSING references (12 files enumerated above)
- [ ] No watch-mode flags (CI invokes `vitest run`; planner enforces `--run` in every command)
- [ ] Feedback latency < 90s (D-18 ceiling)
- [ ] `nyquist_compliant: true` set in frontmatter (flip from `false` after planner audit + first wave green)

**Approval:** pending (planner to confirm task IDs match plan output)
