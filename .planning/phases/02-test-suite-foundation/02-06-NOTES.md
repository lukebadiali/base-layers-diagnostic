# Phase 02-06 Notes — Route resolution + fixture branch coverage

**Updated:** 2026-05-06 (Wave 5 execution)

## Route hash patterns resolved 2026-05-06

The plan body specified `window.location.hash = "#dashboard"` etc. as the
mechanism to switch views before snapshotting. Investigation of `app.js` shows
**there is NO hash router**. Routes are stored in `state.route` (a private IIFE
variable, defaulting to `"dashboard"` at app.js:484), and `setRoute(route)`
(app.js:619-622) is the only mutator. Each topbar nav button has
`data-route="<routeName>"` and `onclick: () => setRoute(route)` (app.js:735-736).

### Resolution applied

Snapshot tests use one of two paths:

1. **Dashboard:** the IIFE's default `state.route = "dashboard"` already
   delivers the dashboard render after `init()` fires. No nav action needed.
2. **Diagnostic / Report:** programmatically click the corresponding
   `button[data-route="diagnostic"]` / `button[data-route="report"]` after
   boot. The onclick handler fires `setRoute()` synchronously, which calls
   `render()` inline. This also exercises the topbar nav onclick wiring
   end-to-end — closer to a real user flow than directly mutating state.

This resolves Plan Step 0 (route hash patterns) by recording: **no hash router
exists; the app uses internal state mutation via `setRoute(route)`.** The plan's
verbatim hash strings are placeholders only.

## Fixture branch coverage (Plan Step 0a — walk renderers)

The fixture `tests/fixtures/snapshot-org.json` was sized to exercise every
material renderer branch under `renderDashboard` / `renderDiagnosticIndex` /
`renderReport`:

### Score-band coverage

`pillarStatus(score)` returns `"red" | "amber" | "green" | "gray"` based on
score thresholds (50, 75). The fixture's round-2 responses (the active
`currentRoundId`) drive these bands:

| Pillar | Scores in fixture                                        | Avg score | Band  |
| ------ | -------------------------------------------------------- | --------- | ----- |
| 1      | scale-5 q0=1, scale-10 q1-9=2,3,2,3,4,3,4,5,4            | ~32       | red   |
| 2      | scale-10 q0-9=6,7,7,6,7,7,6,7,7,6                        | ~66       | amber |
| 3      | scale-10 q0-9=8,9,8,9,8,9,9,8,9,8                        | ~85       | green |
| 4-10   | (no responses)                                           | n/a       | gray  |

Each band drives a different `bandStatement(...)` prose discriminator + a
different `bandColor(...)` CSS variable assignment in renderReport. All four
are visible in the report snapshot.

### Round overlay coverage

Round 1 (baseline) has partial pillar-1 responses with lower scores (avg ~22)
so the dashboard radar chart's "previous round" overlay differs from the
current round (avg ~32 for pillar 1) — proving radar overlay logic runs.

### Comments / read-state coverage (unread integration)

Pillar 1 has 3 comments: 1 internal (before luke's lastRead), 1 client (after
luke's lastRead — counts as 1 unread), 1 internal reply (after readState).
Drives the `unreadCountForPillar` integration → topbar diagnostic-tab dot
indicator. Visible in the dashboard snapshot.

### Actions / engagement coverage

2 actions: one open (Alice owner, due 2026-02-01), one done (Luke owner).
Engagement currentStageId = "diagnosed" → drives the `find` lookup in
`renderReport` line 2680 (uses `engagementStages[id="diagnosed"]`).

### Settings flag (`scaleV2Cleared: true`)

CRITICAL: this flag is set to `true` in the fixture so that `init()`'s call to
`clearOldScaleResponsesIfNeeded` (app.js:5272) is a no-op. Without this flag,
the migration helper would wipe all responses on every test boot — the fixture
data would never reach the renderers and the snapshots would all show the
empty-state "no diagnostics completed yet" prose.

## Snapshot content sanity strings (for SUMMARY.md cross-reference)

After running the snapshot tests, the following load-bearing strings were
verified present in each snapshot file:

- `dashboard.html` — contains `class="view-title">Test Org<` (org name in the
  view-title h1) + `Scored 3 of 10 pillars` (orgSummary integration) +
  `data-route="dashboard"` with `class="nav-btn active"`.
- `diagnostic.html` — contains `class="view-title">Diagnostic<` +
  `<div class="tiles">` (the per-pillar tile container) +
  `Strategy & ICP` (pillar 1 shortName) — proves all 10 pillars rendered.
- `report.html` — contains `<h1>The Base Layers diagnostic - Test Org</h1>`
  + `class="report"` + `class="report-toolbar"` + per-pillar bandStatement
  prose strings (the `LOW score`, `MEDIUM score`, `HIGH score` discriminators).

## Tooling deviation: `vi.resetModules()` over template-literal cachebust

The plan body specifies:

```javascript
await import(`../../app.js?cachebust=${Date.now()}`);
```

Vite/Vitest 4 reject this with `Error: Unknown variable dynamic import:
../../app.js?cachebust=...` because Vite needs the import path statically
analysable for module-graph construction. The plan's pattern is from a
bundler-less Jest world.

**Resolution (Rule 1 — bug fix while preserving intent):** use
`vi.resetModules()` before a static `await import("../../app.js")` call. This
clears Vitest's ESM module cache, forcing the IIFE to re-evaluate against a
fresh `state` object. Verified by: dashboard test passes consistently (1
written + 0 diff on second run), no module-cache pollution between
describe-blocks.

## Tooling deviation: microtask drain instead of `setTimeout(..., 0)`

The plan body specifies:

```javascript
await new Promise((r) => setTimeout(r, 0));
```

Under `tests/setup.js`'s `vi.useFakeTimers({ toFake: [..., "setTimeout", ...] })`,
`setTimeout(0)` does NOT execute synchronously — it queues a fake-timer
callback that requires `vi.advanceTimersByTime(...)` or `vi.runAllTimers()` to
fire. The naive plan body causes a 10-second hook timeout.

**Resolution (Rule 1 — bug fix while preserving intent):** drain microtasks
with `await Promise.resolve(); await Promise.resolve()`. The IIFE's `init()`
call chain is fully synchronous (migrate → clearOldScale → currentUser →
render → DOM mount), so two microtask ticks is sufficient to settle. Verified
by: all 3 view tests pass on first run + remain stable across re-runs.

---

_Phase: 02-test-suite-foundation_
_Plan: 06 (Wave 5 — Snapshots + coverage gate + governance)_
_Notes captured: 2026-05-06_
