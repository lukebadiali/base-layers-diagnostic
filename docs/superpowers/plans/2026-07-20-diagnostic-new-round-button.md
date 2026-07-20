# Diagnostic New-Round Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "+ Start new round" button beside the round dropdown on the Diagnostic index so internal users can open a fresh scoring round without a detour via the dashboard.

**Architecture:** The dashboard round bar already owns the exact confirm-and-start flow. Extract it into one shared helper (`confirmStartNewRound`) inside the `src/main.js` IIFE, reuse it from both buttons, and have the helper clear `state.viewRoundId` so a pinned historic round unpins when the fresh round opens. No data-model, Firestore-rules, or cloud changes.

**Tech Stack:** Vanilla JS (IIFE in `src/main.js`), Vitest + jsdom view tests, file snapshots.

**Spec:** `docs/superpowers/specs/2026-07-20-diagnostic-new-round-button-design.md`

## Global Constraints

- Conventional Commits; no emojis anywhere. Commit trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- `npm run lint` runs `eslint . --max-warnings=0` — zero warnings allowed.
- `npm run typecheck` runs `tsc --noEmit` over JSDoc — new code needs JSDoc param types.
- Never run `npm install` (Windows prunes Linux optional deps from the lockfile); deps are already installed via `npm ci`.
- All work happens in the worktree at `.claude/worktrees/diagnostic-new-round-button` on branch `worktree-diagnostic-new-round-button`.
- Known pre-existing flake: view snapshot tests (dashboard/diagnostic/report) can time out booting `main.js` in the full parallel suite; they pass in isolation. Never "fix" this here.

---

### Task 1: Extract shared `confirmStartNewRound` helper

**Files:**
- Modify: `src/main.js:1775` (insert helper above `renderRoundBar`), `src/main.js:1815-1838` (dashboard button uses it)
- Test: existing `tests/views/dashboard.test.js` (snapshot must stay byte-identical)

**Interfaces:**
- Consumes: existing IIFE locals `confirmDialog`, `loadOrg`, `startNewRound`, `render`, and the module-scope `state` singleton (already imported in `src/main.js`).
- Produces: `confirmStartNewRound(org, currentRound)` — IIFE-local function; `org` is a loaded org object, `currentRound` a round object (`{id, label, createdAt}`) or `null`. Task 2 calls it.

- [ ] **Step 1: Insert the helper above `renderRoundBar`**

In `src/main.js`, directly above the line `function renderRoundBar(user, org, currentRound, prevRound, respUsers) {` (line 1775), insert:

```js
  /**
   * Shared confirm-and-start flow for the "+ Start new round" buttons on the
   * dashboard round bar and the diagnostic index. Clears any pinned historic
   * round view (state.viewRoundId) so the UI jumps to the fresh round — a
   * no-op on the dashboard, where viewRoundId is already null.
   * @param {*} org
   * @param {*} currentRound
   */
  function confirmStartNewRound(org, currentRound) {
    confirmDialog(
      "Start new assessment round?",
      `This locks in "${currentRound?.label || "the current round"}" as a historic snapshot and opens a fresh round so the team can retake the diagnostic. Progress against the previous round will appear on the dashboard.`,
      () => {
        const org2 = loadOrg(org.id);
        startNewRound(org2);
        state.viewRoundId = null;
        render();
      },
      "Start new round",
    );
  }

```

- [ ] **Step 2: Point the dashboard button at the helper**

In `renderRoundBar`, replace the button's onclick block (currently lines 1822-1833, the `onclick: () => { confirmDialog( ... ); }` property spanning the `confirmDialog` call) so the whole button reads:

```js
      actions.appendChild(
        h(
          "button",
          {
            class: "btn secondary",
            onclick: () => confirmStartNewRound(org, currentRound),
          },
          "+ Start new round",
        ),
      );
```

- [ ] **Step 3: Verify the dashboard snapshot is unchanged**

Run: `npx vitest run tests/views/dashboard.test.js`
Expected: PASS (1 test). The rendered HTML is identical — this is a pure refactor.

Also run: `git diff --stat tests/` — expected: no test or snapshot files changed.

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "refactor(rounds): extract shared confirmStartNewRound helper

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Diagnostic index button (TDD)

**Files:**
- Create: `tests/views/diagnostic-new-round.test.js`
- Modify: `src/main.js:1966` (the `round-select-wrap` append in `renderDiagnosticIndex`), `styles.css:1974` (after the `.round-bar-actions` block)
- Modify (regenerate): `tests/__snapshots__/views/diagnostic.html`

**Interfaces:**
- Consumes: `confirmStartNewRound(org, currentRound)` from Task 1; existing IIFE locals `roundById`, `isClientView`, `h`.
- Produces: nothing consumed later — this is the feature.

- [ ] **Step 1: Write the failing behavior tests**

Create `tests/views/diagnostic-new-round.test.js` with exactly:

```js
// tests/views/diagnostic-new-round.test.js
// @ts-check
// The diagnostic index gets its own "+ Start new round" button (internal
// users only) so consultants can open a fresh scoring round without a
// detour via the dashboard round bar. Boot pattern mirrors
// tests/views/diagnostic-client-readonly.test.js.
import { describe, it, expect, vi } from "vitest";
import snapshotOrg from "../fixtures/snapshot-org.json";

/** @param {string} userId */
async function bootAs(userId) {
  /** @type {*} */ (window).BASE_LAYERS = {
    pillars: snapshotOrg.pillars,
    engagementStages: snapshotOrg.engagementStages,
    scoreLabels: snapshotOrg.scoreLabels,
    principles: snapshotOrg.principles,
  };
  /** @type {*} */ (window).FB = { ready: false, currentUser: null, db: null };

  localStorage.clear();
  localStorage.setItem("baselayers:orgs", JSON.stringify(snapshotOrg.orgMetas));
  snapshotOrg.orgs.forEach((/** @type {*} */ o) => {
    localStorage.setItem(`baselayers:org:${o.id}`, JSON.stringify(o));
  });
  localStorage.setItem("baselayers:users", JSON.stringify(snapshotOrg.users));
  localStorage.setItem("baselayers:session", JSON.stringify({ userId }));
  localStorage.setItem("baselayers:settings", JSON.stringify(snapshotOrg.settings));

  document.body.innerHTML = '<div id="app"></div><div id="modalRoot"></div>';
  window.location.hash = "#diagnostic";

  vi.resetModules();
  await import("../../src/main.js");
  await Promise.resolve();
  await Promise.resolve();

  const diagBtn = /** @type {HTMLButtonElement|null} */ (
    document.querySelector('button[data-route="diagnostic"]')
  );
  if (!diagBtn) throw new Error("diagnostic nav button not found — boot failed");
  diagBtn.click();
  await Promise.resolve();
}

/** @returns {HTMLButtonElement|null} */
function newRoundButton() {
  const wrap = document.querySelector(".round-select-wrap");
  if (!wrap) return null;
  return /** @type {HTMLButtonElement|null} */ (
    Array.from(wrap.querySelectorAll("button")).find(
      (b) => (b.textContent || "").trim() === "+ Start new round",
    ) || null
  );
}

describe("diagnostic new-round button", () => {
  it("internal user sees the button next to the round dropdown", async () => {
    await bootAs("u_internal-luke");
    expect(newRoundButton()).not.toBeNull();
  }, 20000);

  it("client view has no round controls at all", async () => {
    await bootAs("u_client-a");
    expect(document.querySelector(".round-select-wrap")).toBeNull();
  }, 20000);

  it("confirming creates a fresh round, selects it, and unpins the viewed round", async () => {
    await bootAs("u_internal-luke");
    const { state } = await import("../../src/state.js");

    // Pin the view to the historic round first so the reset is observable.
    const sel = /** @type {HTMLSelectElement|null} */ (document.querySelector(".round-select"));
    if (!sel) throw new Error("round select not found");
    sel.value = "r_round-1";
    sel.dispatchEvent(new Event("change"));
    await Promise.resolve();
    expect(state.viewRoundId).toBe("r_round-1");

    const btn = newRoundButton();
    if (!btn) throw new Error("new-round button not found");
    btn.click();

    const modalEl = /** @type {HTMLElement|null} */ (
      document.querySelector("#modalRoot .modal")
    );
    if (!modalEl) throw new Error("confirm modal did not open");
    expect(modalEl.textContent).toContain("Start new assessment round?");
    const ok = /** @type {HTMLButtonElement|undefined} */ (
      Array.from(modalEl.querySelectorAll("button")).find(
        (b) => (b.textContent || "").trim() === "Start new round",
      )
    );
    if (!ok) throw new Error("confirm button not found");
    ok.click();
    await Promise.resolve();

    const orgId = snapshotOrg.orgMetas[0].id;
    const org = JSON.parse(
      /** @type {string} */ (localStorage.getItem(`baselayers:org:${orgId}`)),
    );
    expect(org.rounds.length).toBe(3);
    const newRound = org.rounds[2];
    expect(newRound.label).toBe("Round 3");
    expect(org.currentRoundId).toBe(newRound.id);
    expect(org.responses[newRound.id]).toEqual({});

    // View unpinned + dropdown re-rendered with the fresh round selected.
    expect(state.viewRoundId).toBeNull();
    const sel2 = /** @type {HTMLSelectElement|null} */ (
      document.querySelector(".round-select")
    );
    if (!sel2) throw new Error("round select not found after re-render");
    expect(sel2.options.length).toBe(3);
    expect(sel2.value).toBe(newRound.id);
  }, 20000);
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npx vitest run tests/views/diagnostic-new-round.test.js`
Expected: 2 FAIL, 1 PASS —
- "internal user sees the button" FAILS (`newRoundButton()` returns null)
- "confirming creates a fresh round" FAILS (throws "new-round button not found")
- "client view has no round controls" PASSES (the wrap is already internal-only)

- [ ] **Step 3: Add the button in `renderDiagnosticIndex`**

In `src/main.js` (inside `renderDiagnosticIndex`), replace the single line:

```js
      frag.appendChild(h("div", { class: "round-select-wrap" }, ["Round: ", roundSel]));
```

with:

```js
      const newRoundBtn = h(
        "button",
        {
          class: "btn secondary",
          onclick: () => confirmStartNewRound(org, roundById(org, org.currentRoundId)),
        },
        "+ Start new round",
      );
      frag.appendChild(
        h("div", { class: "round-select-wrap" }, ["Round: ", roundSel, newRoundBtn]),
      );
```

- [ ] **Step 4: Style the round-select row**

In `styles.css`, directly after the `.round-bar-actions` block (ends line 1974, before `.delta-up`), insert:

```css
.round-select-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
```

(Layout-only: keeps label, dropdown, and button on one row with sane spacing; no color/typography changes.)

- [ ] **Step 5: Run the new tests to verify they pass**

Run: `npx vitest run tests/views/diagnostic-new-round.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Regenerate the diagnostic snapshot and inspect the diff**

Run: `npx vitest run tests/views/diagnostic.test.js -u`
Expected: PASS (1 test, snapshot written).

Run: `git diff tests/__snapshots__/views/diagnostic.html`
Expected: the only change is inside `<div class="round-select-wrap">` — a new `<button class="btn secondary">+ Start new round</button>` after the select. Any other hunk = investigate before committing.

Run: `git status --short tests/__snapshots__/`
Expected: only `diagnostic.html` modified (dashboard/report snapshots untouched).

- [ ] **Step 7: Commit**

```bash
git add src/main.js styles.css tests/views/diagnostic-new-round.test.js tests/__snapshots__/views/diagnostic.html
git commit -m "feat(diagnostic): start-new-round button on diagnostic index

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Repo-wide gates

**Files:** none (verification only; commit only if a gate forces a fix)

**Interfaces:** n/a

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: exit 0, no output.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: exit 0 (zero warnings — `--max-warnings=0`).

- [ ] **Step 3: Format check**

Run: `npm run format:check`
Expected: "All matched files use Prettier code style!". If any of the three touched files fail, run `npm run format`, re-verify, and amend the offending file into a `style:` commit.

- [ ] **Step 4: Full suite**

Run: `npm test`
Expected: all pass, EXCEPT possibly one view snapshot file failing with "Hook timed out in 10000ms" (the pre-existing parallel-boot flake). If that occurs, re-run that file in isolation (`npx vitest run tests/views/<file>.test.js`) and confirm PASS; that is the accepted baseline.

---

## Delivery (post-plan)

Squash-PR `worktree-diagnostic-new-round-button` → `main` (ruleset requires non-author review from lukebadiali). After merge, verify the CI hosting+rules deploy job succeeded (known intermittent WIF auth flake).
