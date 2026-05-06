# Phase 2: Test Suite Foundation (Tests-First) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `02-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 02-test-suite-foundation
**Areas discussed:** IIFE test-access strategy, Snapshot strategy (TEST-10), Mocking & fixtures, Coverage threshold + CI strictness

---

## IIFE test-access strategy

### How should tests reach the helpers trapped inside the app.js IIFE?

| Option | Description | Selected |
|--------|-------------|----------|
| Mini-strangler-fig leaf extraction | Extract test-target pure helpers into ESM leaf modules under src/domain/ + src/data/ + src/auth/. The IIFE imports them via Vite's module graph. Production behaviour byte-identical. Pitfall 9 step 2's explicit recommendation. | ✓ |
| Test-harness loader | Keep app.js as-is. Build tests/harness.js loading app.js inside happy-dom and exposing private helpers via window.__expose__ behind an `if (window.__TEST__)` guard. | |
| Black-box behavioural tests only | Don't access private helpers. Test only via the public surface (DOM events, localStorage, Firestore writes). | |

**User's choice:** Mini-strangler-fig leaf extraction (Recommended)
**Notes:** Recommendation accepted without modification. Rationale: explicitly recommended by `.planning/research/PITFALLS.md` §Pitfall 9 step 2.

### Which helpers extract in Phase 2?

| Option | Description | Selected |
|--------|-------------|----------|
| Only the TEST-01..07 targets | Just the helpers Phase 2 explicitly tests (~20 functions across scoring, banding, completion, migration, unread, cloud-sync, auth, hash/id utils). | ✓ |
| All pure leaf utilities | Also extract initials, firstNameFromAuthor, formatWhen, deriveAnchors, questionMeta, topConstraints, respondentsForRound, answeredCount, etc. | |
| Minimum viable: scoring + migration only | Extract only what's needed for TEST-02..04. Use a harness for TEST-05..07. | |

**User's choice:** Only the TEST-01..07 targets (Recommended)
**Notes:** Keeps Phase 2 boundary tight; everything else stays in the IIFE for Phase 4.

### Where do extracted modules live?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 4 target layout | src/domain/, src/data/, src/auth/, src/util/ per ARCHITECTURE.md + CLAUDE.md "Source layout target". | ✓ |
| Temporary lib/ directory | Park in lib/ during Phase 2; Phase 4 moves them. | |
| Co-located next to app.js | domain/, data/, auth/ at repo root. | |

**User's choice:** Phase 4 target layout (Recommended)
**Notes:** Phase 4 doesn't have to move anything — just pulls the rest of app.js into siblings.

### How does app.js consume the extracted modules during Phase 2?

| Option | Description | Selected |
|--------|-------------|----------|
| ESM import via Vite + `<script type="module">` in index.html | Standard ESM. Vite serves modules in dev; bundles in CI. Supersedes Phase 1 D-14 — pre-flight: GH-Pages must serve src/**/*.js correctly. | ✓ |
| window.* re-export bridge | Each extracted module assigns to window. app.js reads from window. No script-tag change. | |
| Defer the bridge — only tests use the modules | Two implementations kept in sync by lint rule until Phase 4. | |

**User's choice:** ESM import via Vite + index.html script (Recommended)
**Notes:** Phase 1 D-14 is intentionally superseded. Pre-flight verification on a preview branch is included in the planning context.

---

## Snapshot strategy (TEST-10)

### How should the IIFE's view renderers be invoked in tests?

| Option | Description | Selected |
|--------|-------------|----------|
| Load app.js into happy-dom + drive via state + route | Closest to production; integration coverage. | ✓ |
| Expose render fns via a test-only export | Faster, less realistic; misses route-side-effects. | |
| Refactor renderers into modules (Phase 4 scope) | Out of Phase 2. | |

**User's choice:** Load app.js into happy-dom + drive via state + route (Recommended)

### What snapshot format?

| Option | Description | Selected |
|--------|-------------|----------|
| toMatchFileSnapshot — one .html per view | tests/__snapshots__/views/{dashboard,diagnostic,report}.html. Reviewable in normal PR diff. | ✓ |
| Vitest default .snap file | Single fat file; less natural to review per view. | |
| toMatchInlineSnapshot | Snapshot inside the test file; awkward for HTML > a few lines. | |

**User's choice:** toMatchFileSnapshot — one .html per view (Recommended)

### How do we neutralise non-deterministic output?

| Option | Description | Selected |
|--------|-------------|----------|
| Comprehensive seeding + Chart.js mock | Fake clock + mocked crypto.randomUUID + mocked Math.random + Chart.js stub snapshotting config not canvas. | ✓ |
| Fixed clock + accept residual drift | Only fake clock; tolerate UUID/Math.random churn via custom serialiser. | |
| Snapshot only structural fragments | Snapshot data-bearing elements only; smaller blast radius; might miss layout regressions. | |

**User's choice:** Comprehensive seeding + Chart.js mock (Recommended)

### What input state should snapshots render against?

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-built deterministic fixture | tests/fixtures/snapshot-org.json — sized to exercise every renderer branch. | ✓ |
| Sanitised production export | Higher fidelity; PII risk + churn. | |
| Generated fixture (faker / property-based) | Overkill for deterministic snapshot tests. | |

**User's choice:** Hand-built deterministic fixture (Recommended)

---

## Mocking & fixtures

### Where should the Firebase SDK mock live?

| Option | Description | Selected |
|--------|-------------|----------|
| tests/mocks/firebase.js — reusable factory | makeFirestoreMock({ failGetDoc, failSetDoc, seed }); per-test vi.mock target. Survives Phase 4 firebase/ adapter split. | ✓ |
| Inline vi.mock per test | Each test file owns its own mock. More repetition. | |
| Real Firestore emulator | Higher fidelity; too slow for unit tests. Reserved for Phase 5. | |

**User's choice:** tests/mocks/firebase.js — reusable factory (Recommended)

### How should auth state machine tests handle crypto.subtle.digest?

| Option | Description | Selected |
|--------|-------------|----------|
| Real digest + known-password fixtures | happy-dom's real crypto.subtle.digest. tests/fixtures/auth-passwords.js with pre-computed hashes (committed generator script). | ✓ |
| Stub hashString with deterministic mapping | vi.spyOn the hash; tests don't exercise real comparator. | |
| Test the comparator only | Mock hashString to identity; smallest surface. | |

**User's choice:** Real digest + known-password fixtures (Recommended)

### Where does fixture data live and how is it organised?

| Option | Description | Selected |
|--------|-------------|----------|
| tests/fixtures/ flat directory by purpose | One file per use case (snapshot-org, v1-localStorage, v2-org, unread-state, cloud-sync-conflict, auth-passwords). Generators in tests/fixtures/_generators/. | ✓ |
| Co-located fixtures next to tests | Locality but harder to spot duplication. | |
| Single tests/fixtures.js module | Easy to import; gets large fast. | |

**User's choice:** tests/fixtures/ flat directory by purpose (Recommended)

### How should Chart.js + DOM-side dependencies be handled?

| Option | Description | Selected |
|--------|-------------|----------|
| tests/mocks/chartjs.js + reuse | Centralised stub: Chart class stores config on __lastConfig. Same module stubs window.matchMedia + ResizeObserver. | ✓ |
| Mock only Chart.js | Reactive stubbing for other DOM holes as they appear. | |
| Use jsdom instead of happy-dom | Contradicts Phase 1 D-31 lock; not viable. | |

**User's choice:** tests/mocks/chartjs.js + reuse for all snapshot tests (Recommended)

---

## Coverage threshold + CI strictness

### What coverage threshold model should Phase 2 set?

| Option | Description | Selected |
|--------|-------------|----------|
| Tiered per-directory threshold | src/domain/** + src/util/** 100%; src/auth/** 95%; src/data/** 90%; tests/** + app.js + firebase-init.js + data/pillars.js excluded. Hard CI fail. | ✓ |
| Single global threshold | 75% lines, 70% branches across the repo. Blunt. | |
| No threshold yet — Phase 4 sets it | Coverage report runs but nothing fails. | |

**User's choice:** Tiered per-directory threshold (Recommended)
**Notes:** Resolves Phase 1 D-31's deferral. Excludes the un-modularised parts of app.js so the gate is honest, not theatre.

### What CI strictness for new failure modes Phase 2 introduces?

| Option | Description | Selected |
|--------|-------------|----------|
| Hard fail on all new gates | Test failure + coverage miss + snapshot mismatch + typecheck on new modules → fail. | ✓ |
| Hard fail on tests; soft warn on coverage + snapshots | Lower friction; risk of "fix it next sprint" drift — exactly what SECURITY_AUDIT.md §0(4) warns against. | |
| Tiered: tests + snapshots hard, coverage soft | Middle ground. | |

**User's choice:** Hard fail on all new gates (Recommended)
**Notes:** Aligned with SECURITY_AUDIT.md §0(4) ("no weakening of controls").

### How should the snapshot-update workflow be governed?

| Option | Description | Selected |
|--------|-------------|----------|
| Local-only update + PR review | Devs run `npm test -- -u`; diff lands in PR; reviewer asserts intentionality. CONTRIBUTING.md note documents the convention. | ✓ |
| Bot-driven update with explicit comment trigger | /update-snapshots PR comment triggers a CI job. Adds CI complexity not justified at single-developer scale. | |
| No special governance | Same as Recommended without the CONTRIBUTING.md note. Risk: future contributor doesn't know the convention. | |

**User's choice:** Local-only update + PR review (Recommended)

### What time + size budget should Phase 2 set for `npm test`?

| Option | Description | Selected |
|--------|-------------|----------|
| Soft target: <30s local, <90s CI; document but don't enforce | CONTRIBUTING.md target; PR description must justify if a future PR pushes past 2x. Hard timeouts deferred to Phase 7+ when emulator suites push runtime up legitimately. | ✓ |
| Hard CI timeout at 5 minutes | Catches infinite loops / accidental network calls. May be premature. | |
| No budget yet | Address only if it becomes a problem. Risk: silent dev-loop degradation. | |

**User's choice:** Soft target: <30s local, <90s CI; document but don't enforce (Recommended)

---

## Claude's Discretion

- Exact JSDoc type signatures of extracted modules (`as-is, no improvements` per D-06; judgement where ambiguous)
- Order in which extracted modules land within Phase 2 (each is its own commit; sequencing TBD by planner — likely deepest-leaf-first)
- Exact shape of `tests/setup.js` global config
- Specific assertion library style (`toBe` vs `toEqual` vs `toStrictEqual` per test)
- Deterministic-UUID generator implementation (counter, hashed counter, etc.)
- Whether `tests/setup.js` is loaded via `vite.config.js` `test.setupFiles` (likely) vs explicit imports per test

## Deferred Ideas

(Captured in 02-CONTEXT.md `<deferred>` section.)

- Real Firestore emulator for unit tests
- Sanitised production export as snapshot fixture
- Generated / property-based fixtures
- Bot-driven snapshot updates
- Third-party coverage service (Codecov, Coveralls)
- Hard CI test runtime timeout
- commitlint enforcement
- `npm test -- --watch` documentation
- E2E / Playwright / Cypress tests

---

*Discussion log: 2026-05-06*
