# Design: diagnostic round controls — "+ New" label + navbar styling

**Date:** 2026-07-20
**Status:** Approved (design reviewed in conversation; label "+ New" per user)
**Branch:** feat/navbar-scope-picker (lands as an additional commit on PR #89)

## Problem

The diagnostic index's round row is visually orphaned: a browser-default
`<select>` next to a generic `.btn.secondary` labelled "+ Start new round".
PR #89's navbar tidy gives the topbar a coherent control language (scope
picker: white, 1px `var(--line-2)` border, 8px radius); the round row should
speak it too, and the button label is longer than it needs to be.

## Changes

### Copy

- Diagnostic button label: "+ Start new round" -> **"+ New"**.
- Button gets `title="Start new round"` so the short label still explains
  itself on hover.
- The confirm dialog is unchanged (full "Start new assessment round?" copy —
  the safety explanation lives there).
- The dashboard round-bar button keeps its longer label; only the diagnostic
  row changes.

### Styling

Both controls in `.round-select-wrap` adopt the navbar control treatment
(mirroring `.scope-btn` tokens):

- `background: #fff`, `border: 1px solid var(--line-2)`, `border-radius: 8px`
- `height: 36px` (in-page scale of the navbar's 40px), `padding: 0 12px`
- `font-size: 13px`, `font-family: inherit`, `color: var(--ink)`
- hover: `border-color: var(--brand)`; focus-visible: brand border +
  `box-shadow: 0 0 0 3px var(--brand-tint)` ring (same as `.scope-btn`)
- The native select keeps its built-in dropdown arrow — no custom caret.

Implementation: the button gains class `round-new-btn` (replacing
`btn secondary`); a shared rule styles `.round-select, .round-new-btn`.

## Testing

- `tests/views/diagnostic-new-round.test.js`: the button-finder helper matches
  the trimmed label — update to "+ New".
- Regenerate `tests/__snapshots__/views/diagnostic.html` (label + class +
  title delta only).
- Chrome tests untouched.

## Delivery

Additional commit(s) on `feat/navbar-scope-picker`, pushed to update open
PR #89 (same navbar-tidy theme; the styles being matched live on that branch).

## Out of scope

- Renaming/restyling the dashboard round-bar button.
- Custom select caret or replacing the native select.
