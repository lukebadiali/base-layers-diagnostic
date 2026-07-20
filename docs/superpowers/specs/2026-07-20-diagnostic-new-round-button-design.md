# Design: "+ Start new round" button on the Diagnostic page

**Date:** 2026-07-20
**Status:** Approved (design reviewed in conversation)
**Branch:** worktree-diagnostic-new-round-button (off origin/main)

## Problem

Consultants can create a new assessment round only from the dashboard round bar.
The Diagnostic index has a round dropdown for viewing past rounds but no way to
start a fresh round, forcing a detour back to the dashboard.

## Behavior

- A `+ Start new round` button renders to the right of the existing Round
  dropdown in the `round-select-wrap` row on the Diagnostic index
  (`renderDiagnosticIndex`, src/main.js).
- Internal users only — same `!isClientView(user)` guard that already wraps the
  dropdown. Client view is unchanged.
- Click opens the same `confirmDialog` copy used by the dashboard round-bar
  button ("Start new assessment round? This locks in ... as a historic
  snapshot...").
- On confirm: reload the org via `loadOrg(org.id)`, call the existing
  `startNewRound(org2)` (auto-label "Round N", persists via `saveOrg`), reset
  `state.viewRoundId = null`, then `render()`.
  - The `viewRoundId` reset is required: without it, a user viewing an old
    round would stay pinned to that round instead of jumping to the fresh one.
- After re-render the dropdown shows the new round selected and all pillar
  tiles show 0 answered.

## Implementation shape

- The dashboard round bar (`renderRoundBar`) already contains this exact
  confirm-and-start block. Extract it into one shared helper
  (`confirmStartNewRound(org, currentRound, onDone)` or similar) used by both
  buttons so the dialog copy cannot drift. The diagnostic caller additionally
  clears `state.viewRoundId`.
- No data-model, Firestore rules, or cloud changes — `startNewRound` and its
  persistence already exist.

## Testing

- Update the diagnostic view snapshot (tests/**snapshots**/views/diagnostic.html).
- Behavior tests: internal user sees the button; client view does not;
  confirming creates a round, selects it in the dropdown, and clears
  `state.viewRoundId`.
- Known caveat: view snapshot tests are flaky in the full parallel suite
  (pre-existing main.js boot timeout); verify in isolation.

## Delivery

- Built in an isolated worktree off origin/main (independent of open PR #87).
- Ships as a short-lived squash-PR to main (ruleset requires non-author
  review from lukebadiali).

## Out of scope

- Custom round labels at creation time (dashboard button does not prompt;
  keeping behavior identical).
- Any change to the dashboard round bar beyond extracting the shared handler.
