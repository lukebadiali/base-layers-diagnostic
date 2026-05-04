# Testing Patterns

**Analysis Date:** 2026-05-03

## Test Framework

**Runner:**

- None. There is no test framework installed or configured in this project.

**Searched and not found:**

- No `package.json` (so no `jest`, `vitest`, `mocha`, `jasmine`, `node:test`, `playwright`, or `cypress` dependency could be declared).
- No `jest.config.*`, `vitest.config.*`, `karma.conf.*`, `playwright.config.*`, `cypress.config.*` files.
- No `.mocharc.*`, `.tap.*`, or other runner config.
- No test directory anywhere under the repo (`test/`, `tests/`, `__tests__/`, `spec/` — all absent).
- No files matching `*.test.js`, `*.spec.js`, `*.test.mjs`, `*.spec.mjs`, `*.test.ts` anywhere.
- No CI workflow that invokes a test runner (`.github/workflows/` is absent).

**Assertion Library:**

- None.

**Run Commands:**

- Not applicable. No `npm test`, `yarn test`, or shell test script exists.
- The only "command" related to running anything is the local dev server: `python .claude/serve.py` on port 5178 (configured in `.claude/launch.json`).

## Test File Organization

**Location:**

- Not applicable — no test files exist.

**Naming:**

- Not applicable.

**Structure:**

- Not applicable.

## Test Structure

**Suite Organization:**

- Not applicable.

**Patterns:**

- Not applicable.

## Mocking

**Framework:** Not applicable.

**Patterns:** Not applicable.

**What to Mock:** Not applicable.

**What NOT to Mock:** Not applicable.

## Fixtures and Factories

**Test Data:**

- The closest analogue to a fixture is `data/pillars.js`, which is _production_ content (the ten-pillar reference data assigned to `window.BASE_LAYERS`), not test data. It is loaded by `index.html` line 23 and consumed by `app.js` via `const DATA = window.BASE_LAYERS;` (`app.js` line 14).

**Location:**

- Not applicable.

## Coverage

**Requirements:** None enforced. There is no coverage tool, threshold, or report.

**View Coverage:**

- Not applicable.

## Test Types

**Unit Tests:**

- None. None of the pure helpers in `app.js` (`pillarScoreForRound`, `pillarStatus`, `topConstraints`, `userCompletionPct`, `bandLabel`, `bandStatement`, `formatWhen`, `initials`, `firstNameFromAuthor`, `deriveAnchors`, `questionMeta`, `hashString`, `uid`, `iso`) have test coverage despite being good unit-test candidates (pure or near-pure, deterministic inputs/outputs).

**Integration Tests:**

- None. Multi-step flows like v1 → v2 migration (`migrateV1IfNeeded`, `app.js` lines 489-561), localStorage ↔ Firestore sync (`syncFromCloud`, `app.js` lines 2684-2720), and round rollover (`startNewRound`, `app.js` lines 144-154) are untested.

**E2E Tests:**

- None. No Playwright, Cypress, Puppeteer, Selenium, or any browser-automation runner is configured.

## How Things Are Currently "Tested"

The codebase relies entirely on:

1. **Manual verification in the browser.** Run `python .claude/serve.py` and exercise flows by hand (login, score a pillar, post a comment, upload a doc, change tier, etc.). Cache-busting query strings (`?v=46` in `index.html` lines 22-24) are bumped manually when behaviour changes.
2. **Backup / restore round-trip.** `exportData` (`app.js` lines 4016-4031) and `importData` (`app.js` lines 4033-4061) act as a poor-man's data-integrity smoke test — exporting JSON, clearing localStorage, then importing reproduces the prior state.
3. **One-shot data migrations with idempotency flags.** `migrateV1IfNeeded` (`app.js` line 489) and `clearOldScaleResponsesIfNeeded` (`app.js` lines 4068-4082) gate themselves on flags inside the settings record so re-runs are safe. This is "tested" by virtue of the flag, not a test runner.
4. **Defensive guards.** Many helpers coalesce missing nested keys (`(org.responses || {})[roundId] || {}`) so partial/legacy data does not throw at runtime.

## Common Patterns

**Async Testing:** Not applicable.

**Error Testing:** Not applicable. Error paths in production code (Firestore failures, hash failures, JSON parse failures in `jget`) are silently logged or swallowed with `console.error` / bare `catch {}` (`app.js` lines 419-424, 2614-2620). There is no automated verification that the error paths behave correctly.

## Testing Gap (Risk Assessment)

This is a notable gap for a production app handling client diagnostic data. High-value places to add tests if a runner is ever introduced:

| Area                               | File / Function                                                                                      | Why It Matters                                                                                                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Score aggregation**              | `pillarScoreForRound` (`app.js` line 206), `orgSummary` (`app.js` line 258)                          | These drive every dashboard number, radar chart point, and report band. Off-by-one or rounding regressions silently change the headline metric.                     |
| **Status banding**                 | `pillarStatus`, `bandLabel`, `bandStatement`, `bandColor` (`app.js` lines 228, 2199-2224)            | The colour and "LOW/MEDIUM/HIGH" labels are baked into client-facing reports. A boundary regression (e.g. ≤50 vs <50) changes the message a client sees.            |
| **v1 migration**                   | `migrateV1IfNeeded` (`app.js` line 489)                                                              | One-shot, hard to redo. A latent bug here could silently lose historical data on first load against an old browser cache.                                           |
| **Round transitions**              | `startNewRound` (`app.js` line 144), `previousRoundId` (`app.js` line 160)                           | Drives radar overlay (current vs previous) and the dashboard delta arrow.                                                                                           |
| **Comment unread tracking**        | `unreadCountForPillar`, `unreadCountTotal`, `markPillarRead` (`app.js` lines 304-320)                | Visible badge counts; a regression nags users incorrectly or hides real notifications.                                                                              |
| **Auth flows**                     | `verifyInternalPassword`, `verifyOrgClientPassphrase`, `verifyUserPassword` (`app.js` lines 449-486) | Security-critical. Hashes use `crypto.subtle.digest` SHA-256 with no salt; integration tests would at least catch a regression in the comparison logic.             |
| **Cloud sync conflict resolution** | `syncFromCloud` (`app.js` line 2684)                                                                 | "Cloud wins on overlap" — if either fetch errors the function bails to avoid wiping local data. The bail logic is exactly the kind of thing a test should pin down. |
| **Roadmap drag/drop persistence**  | `renderRoadmap` save handler (`app.js` lines 3093-3104)                                              | Internal users edit; clients read. A regression that lets a client write would be a data-integrity issue.                                                           |

If introducing a test runner, the lowest-friction option for this stack is `node:test` with no build step, targeting the pure helpers (everything that takes plain JS in / returns plain JS out and does not touch the DOM, `localStorage`, `crypto.subtle`, or Firebase). DOM/Firebase coverage would require Playwright against the locally-served build.

---

_Testing analysis: 2026-05-03_
