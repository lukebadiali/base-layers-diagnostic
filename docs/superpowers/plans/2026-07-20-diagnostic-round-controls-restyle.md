# Diagnostic Round-Controls Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename the diagnostic "+ Start new round" button to "+ New" and style the round dropdown + button with the navbar control treatment from PR #89.

**Architecture:** Copy + class change in `renderDiagnosticIndex` (src/main.js), one shared CSS rule mirroring `.scope-btn` tokens, updated behavior-test label matcher, regenerated diagnostic snapshot. Lands as additional commits on `feat/navbar-scope-picker` (PR #89).

**Tech Stack:** Vanilla JS (IIFE in `src/main.js`), plain CSS, Vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-07-20-diagnostic-round-controls-restyle-design.md`

## Global Constraints

- Conventional Commits; no emojis. Trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- `npm run lint` (`eslint . --max-warnings=0`) and `npm run typecheck` (`tsc --noEmit`) must pass.
- Work happens in `.claude/worktrees/navbar-scope-picker` on branch `feat/navbar-scope-picker`.
- Known flake: dashboard/diagnostic/report snapshot tests can time out in the full parallel suite; they pass in isolation — that is the accepted baseline.
- Never run `npm install` (Windows lockfile pruning); deps already installed.

---

### Task 1: Rename + restyle (TDD)

**Files:**

- Modify: `tests/views/diagnostic-new-round.test.js` (label matcher in `newRoundButton()`)
- Modify: `src/main.js` (the `newRoundBtn` block in `renderDiagnosticIndex`, ~line 2000)
- Modify: `styles.css` (new rule after the `.round-select-wrap` block at lines 2180-2185)
- Modify (regenerate): `tests/__snapshots__/views/diagnostic.html`

**Interfaces:**

- Consumes: existing `confirmStartNewRound(org, currentRound)` and `roundById(org, id)` IIFE locals; CSS variables `--line-2`, `--ink`, `--brand`, `--brand-tint` (already defined; `.scope-btn` uses them).
- Produces: button class `round-new-btn` (styled together with the existing `.round-select` class). Nothing else consumes these.

- [ ] **Step 1: Update the test's label matcher (failing test)**

In `tests/views/diagnostic-new-round.test.js`, inside `newRoundButton()`, change:

```js
      (b) => (b.textContent || "").trim() === "+ Start new round",
```

to:

```js
      (b) => (b.textContent || "").trim() === "+ New",
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/views/diagnostic-new-round.test.js`
Expected: 2 FAIL ("internal user sees the button" — matcher finds nothing; "confirming creates a fresh round" — throws "new-round button not found"), 1 PASS (client view).

- [ ] **Step 3: Rename the button and swap its class**

In `src/main.js` (`renderDiagnosticIndex`), replace:

```js
const newRoundBtn = h(
  "button",
  {
    class: "btn secondary",
    onclick: () => confirmStartNewRound(org, roundById(org, org.currentRoundId)),
  },
  "+ Start new round",
);
```

with:

```js
const newRoundBtn = h(
  "button",
  {
    class: "round-new-btn",
    title: "Start new round",
    onclick: () => confirmStartNewRound(org, roundById(org, org.currentRoundId)),
  },
  "+ New",
);
```

- [ ] **Step 4: Add the shared navbar-token rule**

In `styles.css`, directly after the `.round-select-wrap` block (lines 2180-2185), insert:

```css
.round-select,
.round-new-btn {
  height: 36px;
  box-sizing: border-box;
  padding: 0 12px;
  background: #fff;
  border: 1px solid var(--line-2);
  border-radius: 8px;
  color: var(--ink);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.round-select:hover,
.round-new-btn:hover {
  border-color: var(--brand);
}
.round-select:focus-visible,
.round-new-btn:focus-visible {
  outline: none;
  border-color: var(--brand);
  box-shadow: 0 0 0 3px var(--brand-tint);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/views/diagnostic-new-round.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Regenerate the diagnostic snapshot and inspect**

Run: `npx vitest run tests/views/diagnostic.test.js -u`
Expected: PASS, snapshot rewritten.

Run: `git diff tests/__snapshots__/views/diagnostic.html`
Expected delta only inside `round-select-wrap`: button becomes `<button class="round-new-btn" title="Start new round">+ New</button>`. Any other hunk = investigate.

- [ ] **Step 7: Commit**

```bash
git add src/main.js styles.css tests/views/diagnostic-new-round.test.js tests/__snapshots__/views/diagnostic.html
git commit -m "feat(diagnostic): rename round button to + New; navbar-style round controls

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Gates + push to PR #89

**Files:** none (verification + push)

**Interfaces:** n/a

- [ ] **Step 1: Typecheck + lint**

Run: `npm run typecheck` — expected exit 0, no output.
Run: `npm run lint` — expected exit 0.

- [ ] **Step 2: Full suite**

Run: `npm test`
Expected: all pass except possibly dashboard/diagnostic/report boot-timeout flakes; re-run any such file in isolation (`npx vitest run tests/views/<file>.test.js`) and confirm PASS.

- [ ] **Step 3: Push**

```bash
git push origin feat/navbar-scope-picker
```

Expected: PR #89 updates with the new commits.
