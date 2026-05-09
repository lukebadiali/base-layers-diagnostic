# Phase 2: Test Suite Foundation (Tests-First) - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up the regression-test fence that Pitfall 9 requires before Phase 4's modular split begins. Concretely: Vitest unit tests against the **current inline** `app.js` for scoring + completion + v1→v2 migration helpers, comment + chat unread tracking, cloud-sync bail-on-error, the auth state machine (TEST-01..07), plus snapshot tests of dashboard / diagnostic / report rendered HTML (TEST-10) as the explicit baseline Phase 4 will diff against. Coverage thresholds wired into CI as hard gates from this phase forward.

**Explicitly NOT in this phase** (owned elsewhere):

- Modular split of view code, Firebase glue, or the IIFE bootstrap → Phase 4 (gated by this phase being green)
- `@firebase/rules-unit-testing` rules tests → Phase 5 (TEST-08)
- `firebase-functions-test` Cloud Function tests → Phase 7 (TEST-09)
- E2E / Cypress / Playwright tests → out of milestone
- Auth replacement (Email/Password + claims) → Phase 6; this phase pins **current behaviour** of `verifyInternalPassword` etc. as the regression baseline before that swap

The inline `app.js` IIFE remains the production code path. Tests reach in via narrow leaf-module extraction (Pitfall 9 step 2) — the IIFE imports the same code it used to inline, so production behaviour is byte-identical.

</domain>

<decisions>
## Implementation Decisions

### IIFE Test-Access Strategy (Area 1)

- **D-01:** **Mini-strangler-fig leaf extraction** is the access strategy. Pure helpers extract into ESM leaf modules; the IIFE imports them. Production behaviour is byte-identical because the extracted function is the same code, just import-reachable. This IS Pitfall 9 step 2 — explicitly recommended by `.planning/research/PITFALLS.md` and `.planning/research/SUMMARY.md` §Phase 2.
- **D-02:** Extraction scope = **only the TEST-01..07 targets**. Specifically:
  - `src/domain/scoring.js` — `pillarScoreForRound`, `pillarScore`, `respondentsForRound`, `answeredCount`
  - `src/domain/banding.js` — `pillarStatus`, `bandLabel`, `bandStatement`, `bandColor`
  - `src/domain/completion.js` — `userCompletionPct`, `orgSummary`
  - `src/domain/unread.js` — `unreadCountForPillar`, `unreadCountTotal`, `markPillarRead`, `unreadChatTotal`
  - `src/data/migration.js` — `migrateV1IfNeeded`, `clearOldScaleResponsesIfNeeded`
  - `src/data/cloud-sync.js` — `syncFromCloud` (only — `saveOrgRemote` etc. stay in the IIFE; Phase 4 owns those)
  - `src/auth/state-machine.js` — `verifyInternalPassword`, `verifyOrgClientPassphrase`, `verifyUserPassword`, `currentUser`
  - `src/util/hash.js` — `hashString`
  - `src/util/ids.js` — `uid`, `iso`, `formatWhen`, `initials`, `firstNameFromAuthor`
  Everything else (renderers, route dispatcher, Firebase glue, state object) stays in the IIFE for Phase 4 to handle.
- **D-03:** Extracted modules live in their **Phase 4 target layout** (`src/domain/`, `src/data/`, `src/auth/`, `src/util/`) per `.planning/research/ARCHITECTURE.md` §"Target source layout" and `CLAUDE.md` "Source layout target (post-Phase 4)". Phase 4 doesn't move these — it pulls the rest of `app.js` into siblings.
- **D-04:** Bridge: `index.html` is rewritten to use `<script type="module" src="./app.js">`; `app.js` IIFE opens with named ESM imports from the extracted modules. Vite serves modules in dev; Vite build bundles them in CI. **This supersedes Phase 1 D-14** (which said `index.html` stays unchanged until Phase 3). The supersession is intentional and scoped: GH-Pages still ships from `main` until Phase 3's hosting cutover, but it now serves a module-bootstrapped `index.html` instead of the classic-script version. **Pre-flight verification** (planner must include): GH-Pages serves `.js` with `application/javascript`, and `src/**/*.js` paths resolve as static files in the deployed tree — both should hold but require a smoke test on a preview branch before merging the bridge change.
- **D-05:** Extraction is byte-identical. Each leaf module's body is copy-pasted from `app.js`; the IIFE keeps a `// Phase 4: extracted to src/<path> — re-imported here, do not re-define` comment at each former call site. No "improvements" land in Phase 2 (no rewrites for clarity, no tightening of types, no refactoring). The cleanup ledger (`runbooks/phase-4-cleanup-ledger.md`, Phase 1 D-08) gets new entries: "Phase 2 extracted N functions; Phase 4 may simplify their internals after the modular split is complete."
- **D-06:** New extracted modules carry `// @ts-check` + JSDoc types from day 1 per Phase 1 D-29. JSDoc types are inferred from the function bodies as-is — no behavioural change driven by typing. If a JSDoc would force a behavioural change, leave the type as `any` and log it in the cleanup ledger.

### Snapshot Strategy — TEST-10 (Area 2)

- **D-07:** Snapshot tests **load `app.js` into happy-dom** and drive renders via `state` + route hash. Test setup: import `app.js` (now ESM-bridged), seed `window.localStorage` + `state` from a fixture, dispatch the route hash for the view under test, then read `document.getElementById('app').innerHTML` for the snapshot. Closest to production behaviour; catches integration bugs the renderers and helpers produce together.
- **D-08:** Snapshot format = **`toMatchFileSnapshot`** with one `.html` file per view. Layout: `tests/__snapshots__/views/dashboard.html`, `diagnostic.html`, `report.html`. Phase 4 verification = `git diff tests/__snapshots__/` against pre-split state must show no diff. File-per-view is reviewable in normal PR diff; the Vitest-default `.snap` file would force readers to scroll a single fat file.
- **D-09:** Stabilisation strategy = **comprehensive seeding**. `tests/setup.js` runs in `beforeAll`/`beforeEach`:
  - `vi.useFakeTimers({ now: new Date('2026-01-01T00:00:00.000Z'), toFake: ['Date', 'setTimeout', 'setInterval'] })`
  - `vi.spyOn(crypto, 'randomUUID').mockImplementation(() => deterministicUuid())` — counter-backed sequential UUIDs
  - `vi.spyOn(Math, 'random').mockReturnValue(0.5)` — deterministic for any residual `Math.random()` calls Phase 4 hasn't replaced yet
  - `vi.mock('chart.js')` returns a stub Chart class storing the config object on `this.__lastConfig`; `destroy()` and `update()` are no-ops. We snapshot the config-object shape, not canvas pixels.
- **D-10:** Snapshot input = **hand-built deterministic fixture** at `tests/fixtures/snapshot-org.json`. Sized to exercise every renderer branch: 1 org, 2 rounds, 3 internal users + 2 client users, ~10 responses across pillars covering low/mid/high score bands, 3 comments (1 unread), 2 actions, 1 document, 5 chat messages. Sanitised production exports are deferred — PII risk + churn outweighs fidelity gain at this scale.

### Mocking & Fixtures (Area 3)

- **D-11:** Firebase SDK mock = **reusable factory at `tests/mocks/firebase.js`**. Exports `makeFirestoreMock({ failGetDoc, failSetDoc, failUpdateDoc, seed }) → { getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, doc, collection }`, all `vi.fn()`-backed. Per-test usage: `vi.mock('firebase/firestore', () => makeFirestoreMock({ failGetDoc: true }))`. **This survives Phase 4**: when the `firebase/` adapter lands and centralises SDK imports, the same factory mocks the adapter instead — only the `vi.mock` target path changes.
- **D-12:** Auth state machine tests use the **real `crypto.subtle.digest`** that happy-dom 20.9.0 ships, with **known-password fixtures** at `tests/fixtures/auth-passwords.js`: `{ internal: { plain: 'TestInternal!2026', sha256: '<pre-computed hex>' }, orgClient: {...}, user: {...} }`. Fixture is generated by a small Node script at `tests/fixtures/_generators/hash-passwords.js` (committed; documented). Tests verify: correct plaintext matches stored hash; wrong plaintext doesn't match. This exercises the real comparator path Phase 6 will replace — the test suite produces a real "before" signal for that cutover.
- **D-13:** Fixtures live in **`tests/fixtures/` flat directory**, one file per use case:
  - `snapshot-org.json` — TEST-10 renderer baseline
  - `v1-localStorage.json` — TEST-04 v1 input shape
  - `v2-org.json` — TEST-04 post-migration baseline
  - `unread-state.json` — TEST-05 read/unread test inputs
  - `cloud-sync-conflict.json` — TEST-06 sync error scenarios
  - `auth-passwords.js` — TEST-07 known-password fixtures (with generator)
  - `_generators/` — committed scripts that regenerate fixtures from canonical inputs (e.g., the password hash generator)
  Each fixture is imported by the test file via relative path. No co-location, no single fixture module — locality of reference is achieved via clear filenames.
- **D-14:** DOM-side mocks = **`tests/mocks/chartjs.js` + same module stubs other missing happy-dom APIs** (`window.matchMedia`, `ResizeObserver`). Centralising prevents the slow drift of "another DOM API mock added inline". `tests/setup.js` imports the centralised mocks once.

### Coverage Threshold + CI Strictness (Area 4)

- **D-15:** Coverage thresholds = **tiered per-directory, hard CI fail**. `vite.config.js` `test.coverage.thresholds`:
  - `src/domain/**`: **100%** lines + branches + functions + statements
  - `src/util/**`: **100%** lines + branches + functions + statements
  - `src/auth/**`: **95%** lines + branches (one defensive early-return branch in `verifyUserPassword` is genuinely hard to exercise without contriving)
  - `src/data/**`: **90%** lines + branches
  - `tests/**`: excluded
  - `app.js`, `firebase-init.js`, `data/pillars.js`: excluded (Phase 4 modularises and re-targets coverage; until then, "untested" is honest)
  - Global threshold: not set (would fail because `app.js` is uncovered by design)
  - Phase 4 plan task: extend the per-directory threshold list to cover the new `src/views/`, `src/cloud/`, `src/observability/` directories as they appear; raise `src/data/` and `src/auth/` to 100% once their full surface is testable.
- **D-16:** CI strictness = **hard fail on every new gate Phase 2 introduces**:
  - Test failure → fail
  - Coverage threshold miss (per D-15) → fail
  - Snapshot mismatch in CI → fail (Vitest is invoked without `-u`/`--update`; CI lacks the env var that would flip that on)
  - TypeScript typecheck on the new `src/**` modules → fail (`tsc --noEmit` already runs per Phase 1 D-09; the new modules are inside its `include` glob)
  Aligned with `SECURITY_AUDIT.md` §0(4) ("no weakening of controls to make tests/features pass") and Phase 1's existing hard-fail policy on lint + test + audit + build (Phase 1 D-09 / D-21). OSV-Scanner remains soft-fail per Phase 1 D-20 (unchanged).
- **D-17:** Snapshot governance = **local-only update, PR review**. Devs run `npm test -- -u` locally to update snapshots; the diff lands in the PR; reviewer asserts intentionality. CI never auto-updates. Documented in a new section of `CONTRIBUTING.md` (created Phase 1 D-25 area) titled "Updating snapshot tests" with a worked example (e.g., "the dashboard header text changed — verify the only diff in `tests/__snapshots__/views/dashboard.html` is the header text"). No bot trigger needed at this scale.
- **D-18:** Time + size budget = **soft target documented in CONTRIBUTING.md, no enforcement**. Target: `npm test` completes in <30s locally, <90s in CI, on a clean clone. Logged as a target so future contributors understand the expectation; if a future PR pushes runtime past 2× the target the PR description should justify, but no CI gate. Hard timeouts get added in Phase 7 once Cloud Functions tests + emulator suites push runtime up legitimately.
- **D-19:** `tests/smoke.test.js` (Phase 1 D-30) is **deleted** in Phase 2 — it was a placeholder to silence Vitest's "no tests found" warning, no longer needed once real tests exist. Removal happens in the same PR that lands the first real test.
- **D-20:** Coverage report artefact = uploaded to the GitHub Actions run as `coverage-report-html` (renders `coverage/index.html` for click-through review on a PR). Plain-text summary written into the PR's CI log. No third-party coverage service (Codecov / Coveralls) is added in Phase 2 — the in-repo HTML + the threshold gate are sufficient for the credible-not-certified compliance bar.

### `SECURITY.md` / DOC-10 Incremental (carried from Phase 1 D-25)

- **D-21:** Phase 2 appends to `SECURITY.md` § Build & Supply Chain a paragraph titled "Regression baseline" citing TEST-01..07 + TEST-10 by name and linking to `tests/__snapshots__/views/` as the codified pre-Phase-4 contract. References OWASP ASVS V14.2 (build verification), ISO 27001 A.12.1.2 (change management — testing), SOC2 CC8.1. Lands in the same commit as the first real test per Phase 1 D-25's atomic-commit pattern.

### Folded Todos

None — `STATE.md` "Outstanding Todos" all reference later phases (Phases 5, 6, 7, 9, 11, 12). No backlog or notes directory exists.

### Claude's Discretion

- Exact wording / TypeScript signatures of the JSDoc types in extracted modules (D-06 says "as-is, no improvements" — judgement call where ambiguity arises)
- The order in which extracted modules land within Phase 2 (each is its own commit; sequencing TBD by planner — likely deepest-leaf-first per Pitfall 9's strangler-fig advice)
- The exact shape of `tests/setup.js` global config
- Specific assertion library style (Vitest's `expect` is locked; choosing between `toBe`/`toEqual`/`toStrictEqual` per test)
- The exact deterministic-UUID generator (counter, hashed counter, etc.) — implementation detail
- Whether `tests/setup.js` is loaded via `vite.config.js` `test.setupFiles` (likely) vs explicit imports per test (rejected unless the planner finds a reason)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context

- `.planning/PROJECT.md` — Active milestone, locked decisions, constraints
- `.planning/REQUIREMENTS.md` §"Tests" — TEST-01 through TEST-07 + TEST-10 acceptance criteria
- `.planning/REQUIREMENTS.md` §"Documentation Pack" — DOC-10 incremental requirement
- `.planning/ROADMAP.md` §"Phase 2: Test Suite Foundation (Tests-First)" — Goal + Success Criteria + Dependencies
- `.planning/STATE.md` §"Sequencing Non-Negotiables" — tests-first before modular split
- `CLAUDE.md` — Source layout target, Conventions, Sequencing Non-Negotiables

### Research

- `.planning/research/PITFALLS.md` §Pitfall 9 — **load-bearing.** Tests-first sequencing rationale, strangler-fig recommendation, snapshot baseline rationale. Step 2 is the explicit basis for D-01..D-05; step 5 is the explicit basis for D-07..D-10.
- `.planning/research/PITFALLS.md` §Pitfall 10 — Migration idempotency, foreign-key safety. TEST-04 (`migrateV1IfNeeded`) tests must include idempotency assertions per this section.
- `.planning/research/PITFALLS.md` §Pitfall 20 — H7 (clock skew) + H8 (last-writer-wins) sequencing. TEST-05 + TEST-06 must pin the **current** broken behaviour as the regression baseline; H7 fix is Phase 5, H8 fix is Phase 5+. Phase 2 does not fix; it captures.
- `.planning/research/SUMMARY.md` §"Phase 2: Test Suite Foundation (Tests-First)" — phase rationale, three-tier test ordering, exact helper list
- `.planning/research/SUMMARY.md` §"Critical Pitfalls / Non-Negotiables" §1 — tests-first sequencing as the milestone gate
- `.planning/research/STACK.md` §"Vitest setup — JSDoc-types-as-typecheck" — Vitest 4 configuration shape, happy-dom 20.9.0, coverage-v8 — already locked Phase 1 D-31
- `.planning/research/STACK.md` §"Build setup — Vite for vanilla-JS SPA" — `vite.config.js` shape; D-04's `<script type="module">` change interacts with this
- `.planning/research/ARCHITECTURE.md` §"Target source layout" — `src/domain/`, `src/data/`, `src/auth/`, `src/util/` are the destination D-03 commits to today

### Codebase Map (analysis dated 2026-05-03)

- `.planning/codebase/TESTING.md` — current state ("none"); §"Testing Gap (Risk Assessment)" enumerates the high-leverage helpers Phase 2 covers
- `.planning/codebase/CONCERNS.md` §"Test Coverage Gaps" — H2 substrate; closed by Phase 2 + Phase 5 + Phase 7 collectively
- `.planning/codebase/CONVENTIONS.md` — coding style preserved in extracted modules
- `.planning/codebase/STRUCTURE.md` — current flat layout; D-03's `src/` directories are new

### Phase 1 Carry-Forward (already locked, do not re-derive)

- `.planning/phases/01-engineering-foundation-tooling/01-CONTEXT.md` D-30 — `tests/smoke.test.js` exists; D-19 deletes it
- `.planning/phases/01-engineering-foundation-tooling/01-CONTEXT.md` D-31 — Vitest config inline in `vite.config.js`, happy-dom, coverage-v8 wired; **coverage threshold deferred to Phase 2** (resolved by D-15)
- `.planning/phases/01-engineering-foundation-tooling/01-CONTEXT.md` D-14 / D-15 — `index.html` was unchanged in Phase 1; **D-04 here supersedes that** for the Phase 2 module-bridge change
- `.planning/phases/01-engineering-foundation-tooling/01-CONTEXT.md` D-09 — CI hard-fail policy; D-16 here extends it with the new gates
- `runbooks/phase-4-cleanup-ledger.md` — receives new entries from D-05's extraction comments

### Audit Framework

- `SECURITY_AUDIT.md` §0(4) — "no weakening of controls to make tests/features pass" — applies to coverage threshold + snapshot strictness calls (D-15, D-16)
- `SECURITY_AUDIT.md` §A03 (CI/CD) — Phase 2 extends the CI evidence trail Phase 1 started

### Compliance Citations (for `SECURITY.md` D-21 update)

- OWASP ASVS L2 v5.0 V14.2 (dependencies / build verification)
- ISO/IEC 27001:2022 Annex A — A.12.1.2 (change management — testing of changes)
- SOC 2 CC8.1 (change management) — CI/CD as evidence trail
- GDPR Art. 32(1)(d) — testing/evaluating effectiveness of technical measures

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`firebase-init.js`** is already an ES module (Phase 1 codebase scout). Its export shape is the closest pre-existing analogue of the `firebase/` adapter Phase 4 will build; D-11's mock factory is designed to mock either, depending on phase.
- **`data/pillars.js`** is a leaf data module (Phase 1 carry-forward). Already ES module-shaped. Stays in place; D-03 doesn't touch it.
- **happy-dom 20.9.0** ships real `crypto.subtle.digest`, real `localStorage`, real `Element` / `Document` APIs — D-12 and the migration tests (TEST-04) lean on this. happy-dom does NOT ship `matchMedia` / `ResizeObserver` — D-14 stubs them.

### Established Patterns (carried forward from Phase 1)

- **One Vite config, two consumers** — `vite.config.js` holds both the build config and the Vitest config (Phase 1 D-31). D-15's coverage threshold lands in the same file.
- **Atomic commits per requirement** (Phase 1 D-25 pattern) — D-21's `SECURITY.md` paragraph commits with the first real test, not separately
- **`runbooks/` for one-shot procedures** (Phase 1 D-12, D-22, D-23) — D-17's "updating snapshots" guidance lives in `CONTRIBUTING.md` (a dev-loop concern), not `runbooks/` (one-shot ops)
- **JSDoc-as-typecheck**, `// @ts-check` at module top, `// @ts-nocheck` only on `app.js` with cleanup-ledger entry (Phase 1 D-07, D-29)
- **Pinned versions, no rolling-`latest`** (Phase 1 D-01) — Phase 2 introduces no new package; Vitest + happy-dom + coverage-v8 are already pinned. Pre-flight check for the planner: `package.json` must already have these from Phase 1.

### Integration Points

- **`index.html`** — D-04 rewrites the `<script>` tag for `app.js` to `type="module"`. This is the **only structural change** to `index.html` in Phase 2.
- **`app.js`** — gets named ESM imports prepended at the top of the IIFE; ~20 functions delete from the IIFE body and become re-imported. Total churn: ~200-400 lines moved out, plus N import statements added at the top.
- **CI workflow `.github/workflows/ci.yml`** (Phase 1 D-09) — extends:
  - `test` job picks up new test files automatically (Vitest's default glob)
  - `test` job's coverage threshold gate fires per D-15
  - new artefact upload step for the HTML coverage report (D-20)
  - typecheck job is unchanged — its `include` glob already covers `**/*.js`, so new `src/` files are covered automatically
- **`runbooks/phase-4-cleanup-ledger.md`** (Phase 1 D-08) — receives new entries enumerating the extracted functions and any JSDoc-type-was-`any` decisions per D-06

### Pre-Flight Verifications (planner must include)

1. GH-Pages serves `<script type="module" src="./app.js">` correctly — verified by deploying the bridge change to a preview branch first; load + check console for module-loading errors
2. GH-Pages serves `src/**/*.js` paths correctly with `application/javascript` MIME — same preview-branch test
3. happy-dom 20.9.0's `crypto.subtle.digest` produces a hash that matches Node's `crypto.createHash('sha256')` output for the same input (sanity-check the auth-password fixture generator runs on Node and is consistent with the digest happy-dom does in tests)
4. Vitest 4's `toMatchFileSnapshot` produces stable file output across OSes (CI is Linux; dev machines are Windows + macOS — newline normalisation is a known gotcha)

</code_context>

<specifics>
## Specific Ideas

- **The Phase 1 D-14 carve-out is intentionally superseded.** Phase 1 said "`index.html` is **not** rewritten" because Phase 1 didn't have a forcing function for the change. Phase 2 has a forcing function: ESM imports require `type="module"`. The supersession is logged in this CONTEXT.md and the cleanup ledger; Phase 3's hosting cutover plan should not assume the un-modified Phase 1 shape.
- **Tests against the inline app.js are intentionally a "before" snapshot of broken behaviour** — TEST-05 (unread tracking, H7 entanglement), TEST-06 (cloud-sync bail-on-error, H8 entanglement). Phase 5 (subcollection migration + H7 fix) and any future H8 fix will explicitly **break** these tests. That's the design — the test diff is the evidence of behaviour change. PITFALLS.md §Pitfall 20 is the load-bearing rationale.
- **Auth tests (TEST-07) are temporary** — Phase 6 deletes the underlying functions (`INTERNAL_PASSWORD_HASH`, `verifyInternalPassword` etc.). The tests' value is the regression baseline during the Phase 6 cutover, not long-term coverage. Phase 6 plan task: delete the test file alongside the production code; do not "translate" the tests to the new auth path (those are new tests, not migrated tests).
- **No "improve while extracting"** (D-05). Phase 2 is a fence, not a rewrite. Any temptation to clarify a function's signature, fix a `let` that should be `const`, or split a 50-line function into two 25-line functions belongs in Phase 4.
- **The cleanup ledger receives new entries** from Phase 2 — most importantly D-05's "extracted byte-identical, may simplify in Phase 4" notes. Phase 4 will work through the ledger to close them.

</specifics>

<deferred>
## Deferred Ideas

- **Real Firestore emulator unit tests** — overkill for unit-test latency; reserved for Phase 5 (`@firebase/rules-unit-testing` for TEST-08).
- **Sanitised production export as snapshot fixture** — PII risk + churn outweigh fidelity gain at current scale. Revisit if the hand-built fixture proves insufficient (it shouldn't).
- **Generated / property-based fixtures (faker, fast-check)** — overkill for snapshot determinism; useful for property tests on scoring math, deferred to a backlog item.
- **Bot-driven snapshot updates** (`/update-snapshots` PR comment trigger) — adds CI complexity not justified at single-developer scale. Revisit if the team grows past 3 contributors.
- **Codecov / Coveralls** — third-party coverage service. The in-repo HTML report + threshold gate is sufficient for the credible-not-certified compliance bar. Adding a vendor adds a sub-processor in `PRIVACY.md` (Phase 11) without proportional value.
- **Hard CI test runtime timeout** — premature; Phase 7 + Phase 5 emulator tests will legitimately push runtime up. Target documented in CONTRIBUTING.md per D-18; enforcement deferred.
- **commitlint enforcement** — Phase 1 deferred (out of TOOL-01..12 scope). Still deferred.
- **`npm test -- --watch` documentation in CONTRIBUTING.md** — useful for dev loop, but a generic Vitest concern not specific to this project. Add only if a future contributor asks.
- **E2E / Playwright / Cypress tests** — out of milestone scope. The test pyramid for this project tops out at unit + snapshot + (later) rules-unit + functions-test. End-to-end behaviour is verified manually + via the production-deploy smoke test (Phase 3+).
- **Reviewed Todos (not folded)** — none; STATE.md "Outstanding Todos" all reference later phases.

</deferred>

---

*Phase: 02-test-suite-foundation*
*Context gathered: 2026-05-06*
