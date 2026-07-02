# Client Read-Only Diagnostic + Static Stage Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Client logins get a view-only Diagnostic (no scoring, no mutating buttons — enforced in UI and Firestore rules), and the four Delivery-framework stage cards lose click-to-highlight for all roles.

**Architecture:** Per-site gating on the existing `isClientView(user)` predicate inside the `src/main.js` IIFE (matches how clients are already gated elsewhere). Stage cards become static markup; the orphaned `setEngagementStage` write path and dead report binding are deleted. Firestore `responses` writes tighten from `inOrg()` to `isInternal()`.

**Tech Stack:** Vanilla JS (no framework), `h()` DOM helper (`src/ui/dom.js`), Vitest + happy-dom for view tests, `@firebase/rules-unit-testing` v5 + Firebase emulator for rules tests.

**Spec:** `docs/superpowers/specs/2026-07-02-client-readonly-diagnostic-design.md`

## Global Constraints

- Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`); no emojis in commits or source.
- Branch `feat/client-readonly-diagnostic` (already created off `origin/main`); merges to `main` via squash-PR needing a non-author review from `lukebadiali`.
- Pre-commit hook runs eslint/prettier only — run `npm run typecheck && npm run lint && npm run test` locally before pushing (project feedback memory).
- Known pre-existing flake: `tests/views/*.test.js` can time out in the FULL parallel suite but pass in isolation. Verify view tests by running their files directly; do not chase the full-suite flake.
- View tests boot the real `src/main.js` IIFE against localStorage fixtures with `window.FB = { ready: false }` (see `tests/views/diagnostic.test.js` for the canonical boot pattern).
- `npm run test:rules` requires the Firebase emulator (`firebase emulators:exec`, demo project — no login needed).
- Working directory: repo root `C:\Users\hughd\OneDrive\Desktop\base-layers-diagnostic`.

---

### Task 1: Static delivery-stage cards (all roles)

The four "Delivery framework" cards at the bottom of the Diagnostic page currently click-to-highlight for staff (`setEngagementStage` writes `org.engagement.currentStageId`, read nowhere else) and render a `read-only` variant for clients. Make them four static info cards for everyone and delete the dead write path.

**Files:**
- Create: `tests/views/stages-static.test.js`
- Modify: `src/main.js:1859` (callsite), `src/main.js:2377-2417` (`renderEngagement` + `setEngagementStage`), `src/main.js:2428-2431` (dead `stage` binding in `renderReport`)
- Modify: `styles.css:1226-1253` (`.stage-card` block)
- Update snapshot: `tests/__snapshots__/views/diagnostic.html`

**Interfaces:**
- Consumes: `h(tag, attrs, children)` from the IIFE scope; `DATA.engagementStages` (4 entries: diagnosed/designed/deployed/embedded).
- Produces: `renderEngagement()` — signature changes from `(user, org)` to zero-arg. Task 2 does NOT call it; only the callsite inside `renderDiagnosticIndex` (line 1859) uses it.

- [ ] **Step 1: Write the failing test**

Create `tests/views/stages-static.test.js`:

```js
// tests/views/stages-static.test.js
// @ts-check
// Delivery-framework stage cards are static info cards: no click-to-select,
// no active highlight, for staff as well as clients. Boot pattern mirrors
// tests/views/diagnostic.test.js (internal session from the snapshot fixture).
import { describe, it, expect, beforeEach, vi } from "vitest";
import snapshotOrg from "../fixtures/snapshot-org.json";

describe("Delivery stage cards are static", () => {
  beforeEach(async () => {
    /** @type {*} */ (window).BASE_LAYERS = {
      pillars: snapshotOrg.pillars,
      engagementStages: snapshotOrg.engagementStages,
      scoreLabels: snapshotOrg.scoreLabels,
      principles: snapshotOrg.principles,
    };
    /** @type {*} */ (window).FB = { ready: false, currentUser: null, db: null };

    localStorage.setItem("baselayers:orgs", JSON.stringify(snapshotOrg.orgMetas));
    snapshotOrg.orgs.forEach((/** @type {*} */ o) => {
      localStorage.setItem(`baselayers:org:${o.id}`, JSON.stringify(o));
    });
    localStorage.setItem("baselayers:users", JSON.stringify(snapshotOrg.users));
    localStorage.setItem("baselayers:session", JSON.stringify(snapshotOrg.session));
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
  });

  it("renders four stage cards with no active or read-only variant", () => {
    const cards = document.querySelectorAll(".stage-card");
    expect(cards.length).toBe(4);
    cards.forEach((card) => {
      expect(card.className).toBe("stage-card");
    });
  });

  it("clicking a stage card does not highlight it or write engagement state", () => {
    const orgId = snapshotOrg.orgMetas[0].id;
    const before = localStorage.getItem(`baselayers:org:${orgId}`);
    const card = /** @type {HTMLElement} */ (document.querySelector(".stage-card"));
    card.click();
    expect(document.querySelectorAll(".stage-card.active").length).toBe(0);
    expect(localStorage.getItem(`baselayers:org:${orgId}`)).toBe(before);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/views/stages-static.test.js`
Expected: FAIL — first test gets `className === "stage-card active "` (staff session, current stage highlighted); second test finds an `.active` card after click and a changed localStorage org.

- [ ] **Step 3: Implement — make renderEngagement static**

In `src/main.js`, replace the whole `renderEngagement` + `setEngagementStage` block (currently lines 2377-2417):

```js
  function renderEngagement() {
    const frag = h("div", { class: "delivery-section" });
    frag.appendChild(h("h2", { class: "section-h2" }, "Delivery framework"));
    frag.appendChild(
      h("p", { class: "view-sub" }, "Every BeDeveloped engagement runs through four stages."),
    );

    // Static info cards — the click-to-highlight stage selector was removed
    // 2026-07 (the selected stage was read nowhere else in the app).
    const stages = h("div", { class: "stages" });
    DATA.engagementStages.forEach((s, i) => {
      stages.appendChild(
        h("div", { class: "stage-card" }, [
          h("div", { class: "n" }, `STAGE ${i + 1}`),
          h("div", { class: "name" }, s.name),
          h("div", { class: "sum" }, s.summary),
        ]),
      );
    });
    frag.appendChild(stages);
    return frag;
  }
```

(`setEngagementStage` is deleted entirely — nothing else references it.)

Update the only callsite at `src/main.js:1859` inside `renderDiagnosticIndex`:

```js
    frag.appendChild(renderEngagement());
```

In `renderReport` (currently `src/main.js:2428-2431`), delete these four lines (dead binding, already eslint-flagged):

```js
    // eslint-disable-next-line no-unused-vars -- Phase 4: remove dead binding or wire up render. See runbooks/phase-4-cleanup-ledger.md
    const stage = DATA.engagementStages.find(
      (s) => s.id === (org.engagement?.currentRoundId || "diagnosed"),
    );
```

CAUTION: the actual second line reads `(s) => s.id === (org.engagement?.currentStageId || "diagnosed"),` — match the file content exactly when deleting, not this plan text.

- [ ] **Step 4: Implement — CSS cleanup**

In `styles.css`, replace the `.stage-card` base rule (lines 1226-1237) — drop `cursor: pointer` and the now-pointless `transition`:

```css
.stage-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 16px;
  position: relative;
  box-shadow: var(--shadow-sm);
}
```

Then delete these four rules entirely (lines 1238-1253):

```css
.stage-card:hover {
  border-color: var(--brand);
}
.stage-card.read-only {
  cursor: default;
}
.stage-card.read-only:hover {
  border-color: var(--line);
}
.stage-card.active {
  border-color: var(--brand);
  background: var(--brand-tint);
  box-shadow:
    0 0 0 3px rgba(87, 158, 192, 0.25),
    var(--shadow-sm);
}
```

Keep `.stage-card .n / .name / .sum / .progress` rules as-is.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/views/stages-static.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Update the diagnostic view snapshot**

The staff diagnostic snapshot contains the old `stage-card active` class strings.

Run: `npx vitest run tests/views/diagnostic.test.js -u`
Expected: PASS with `1 snapshot updated`. Then `git diff tests/__snapshots__/views/diagnostic.html` should show ONLY `class="stage-card..."` attribute changes — if anything else changed, stop and investigate.

- [ ] **Step 7: Verify no other snapshot/test regressions**

Run: `npx vitest run tests/views/ tests/ui/`
Expected: PASS (dashboard/report snapshots unaffected — the report change removed a binding that never rendered).

- [ ] **Step 8: Commit**

```bash
git add src/main.js styles.css tests/views/stages-static.test.js tests/__snapshots__/views/diagnostic.html
git commit -m "feat(ui): delivery-stage cards are static info cards, drop click-to-highlight

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Client view-only diagnostic UI

Clients (and staff in client-preview mode — both covered by `isClientView`) see the diagnostic read-only: inert Likert buttons with saved answers still highlighted, review-oriented copy, and no Complete / "+ Add" buttons. Staff scoring is unchanged.

**Files:**
- Create: `tests/views/diagnostic-client-readonly.test.js`
- Modify: `src/main.js` — import block (~line 134-137), wrapper block (~line 471-478), `renderDiagnosticIndex` (~1771-1862), `renderPillar` (~1867-1996), `renderQuestion` (~1998-2038)
- Modify: `styles.css` (after `.likert button.sel .t` block, ~line 1053)

**Interfaces:**
- Consumes: `isClientView(user)` (main.js:812 — true for role `client` and staff client-preview mode); `h()`; `setResponse` (unchanged); `renderEngagement()` zero-arg from Task 1.
- Produces: no new exports — behavior only. The `userCompletionPct` IIFE wrapper and its `_userCompletionPct` import are DELETED (banner was their only consumer; `src/domain/completion.js` itself is untouched).

- [ ] **Step 1: Write the failing test**

Create `tests/views/diagnostic-client-readonly.test.js`:

```js
// tests/views/diagnostic-client-readonly.test.js
// @ts-check
// Client logins get a view-only diagnostic: inert Likert buttons (saved
// answers stay highlighted), review copy, no progress banner, no Complete
// or "+ Add" buttons. Staff scoring still works. Boot pattern mirrors
// tests/views/diagnostic.test.js with a parameterised session user.
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

function openFirstPillar() {
  const tile = /** @type {HTMLElement|null} */ (document.querySelector(".tiles .tile"));
  if (!tile) throw new Error("no pillar tile found");
  tile.click();
}

describe("client view-only diagnostic", () => {
  it("index shows review copy and no progress banner", async () => {
    await bootAs("u_client-a");
    const app = /** @type {HTMLElement} */ (document.getElementById("app"));
    expect(app.querySelector(".client-progress-banner")).toBeNull();
    expect(app.textContent).toContain("Review how the business scored");
    expect(app.textContent).not.toContain("Score each pillar honestly");
  });

  it("pillar page renders inert scoring and no mutating buttons", async () => {
    await bootAs("u_client-a");
    openFirstPillar();

    const likertButtons = Array.from(document.querySelectorAll(".likert button"));
    expect(likertButtons.length).toBeGreaterThan(0);
    likertButtons.forEach((b) => expect(b.hasAttribute("disabled")).toBe(true));
    expect(document.querySelector(".likert.read-only")).not.toBeNull();

    const labels = Array.from(document.querySelectorAll("button")).map((b) =>
      (b.textContent || "").trim(),
    );
    expect(labels).not.toContain("Complete");
    expect(labels).not.toContain("+ Add");
  });

  it("clicking a likert button writes nothing", async () => {
    await bootAs("u_client-a");
    openFirstPillar();
    const orgId = snapshotOrg.orgMetas[0].id;
    const before = localStorage.getItem(`baselayers:org:${orgId}`);
    const btn = /** @type {HTMLButtonElement|null} */ (
      document.querySelector(".likert button:not(.sel)")
    );
    if (!btn) throw new Error("no unselected likert button found");
    btn.click();
    await Promise.resolve();
    expect(localStorage.getItem(`baselayers:org:${orgId}`)).toBe(before);
    expect(btn.classList.contains("sel")).toBe(false);
  });
});

describe("staff scoring regression", () => {
  it("internal user can still score a question", async () => {
    await bootAs("u_internal-luke");
    openFirstPillar();
    const orgId = snapshotOrg.orgMetas[0].id;
    const beforeRaw = /** @type {string} */ (localStorage.getItem(`baselayers:org:${orgId}`));
    const before = JSON.parse(beforeRaw);
    const btn = /** @type {HTMLButtonElement|null} */ (
      document.querySelector(".likert button:not(.sel)")
    );
    if (!btn) throw new Error("no unselected likert button found");
    expect(btn.hasAttribute("disabled")).toBe(false);
    btn.click();
    await Promise.resolve();
    const after = JSON.parse(
      /** @type {string} */ (localStorage.getItem(`baselayers:org:${orgId}`)),
    );
    expect(JSON.stringify(after.responses)).not.toBe(JSON.stringify(before.responses));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/views/diagnostic-client-readonly.test.js`
Expected: FAIL — client tests fail ("Score each pillar honestly" copy present, banner present, likert buttons enabled, "Complete"/"+ Add" present, click writes to localStorage). The staff regression test should already PASS. If `bootAs("u_client-a")` throws "nav button not found", stop — the client boot path needs investigation before proceeding (do not paper over it).

- [ ] **Step 3: Implement — renderDiagnosticIndex copy + banner + tile tag**

In `src/main.js` `renderDiagnosticIndex` (starts ~line 1771):

3a. Replace the subtext ternary (currently lines 1778-1780):

```js
        isClientView(user)
          ? "Review how the business scored against each pillar's diagnostic questions."
          : "Score each pillar against its diagnostic questions.",
```

3b. Delete the whole client progress banner block (currently lines 1784-1807), i.e. from the comment `// Show current user's own completion if client/internal preview` through the closing `}` of `if (isClientView(user)) { ... }`.

3c. Replace the tile tag ternary (currently lines 1833-1835 — both branches are identical today; the client branch drops the "your answers" invitation to score):

```js
          isClientView(user)
            ? `Team score ${s !== null ? s + "/100" : "—"}`
            : `${userDone}/${total} of your answers · team score ${s !== null ? s + "/100" : "—"}`,
```

- [ ] **Step 4: Implement — remove the orphaned userCompletionPct wrapper**

The banner was the only consumer; eslint (`--max-warnings=0`) will fail on the unused binding.

4a. In the import block (currently lines 134-137), change:

```js
import {
  userCompletionPct as _userCompletionPct,
  orgSummary as _orgSummary,
} from "./domain/completion.js";
```

to:

```js
import { orgSummary as _orgSummary } from "./domain/completion.js";
```

4b. In the wrapper block (currently lines 471-479), delete the two `userCompletionPct` lines and update the comment:

```js
  // Phase 2 Wave 3 (D-05): wrappers for completion + unread (Pattern E).
  // Bodies extracted to src/domain/completion.js + src/domain/unread.js.
  // orgSummary injects DATA + pillarScore; unread wrappers
  // inject saveOrg / commentsFor / state / lastReadMillis / msgMillis
  // (all defined later in the IIFE — safe because wrappers resolve those names
  // at call time, by which point they exist in scope).
  const orgSummary = (org) => _orgSummary(org, DATA, pillarScore);
```

(`src/domain/completion.js` keeps exporting `userCompletionPct` — its own unit tests still cover it.)

- [ ] **Step 5: Implement — renderPillar heading, Complete, + Add**

In `renderPillar` (starts ~line 1867):

5a. Heading (currently line 1908):

```js
    left.appendChild(
      h("h3", {}, isClient ? "Diagnostic questions" : "Diagnostic questions (your responses)"),
    );
```

5b. Wrap the Complete button block (currently lines 1914-1926) so clients don't get it:

```js
    // Complete button - returns to the diagnostic landing (staff only:
    // clients have nothing to complete in the view-only diagnostic)
    if (!isClient) {
      left.appendChild(
        h("div", { class: "pillar-actions-foot" }, [
          h(
            "button",
            {
              class: "btn",
              onclick: () => setRoute("diagnostic"),
            },
            "Complete",
          ),
        ]),
      );
    }
```

5c. In the `actionsPanel` header (currently lines 1953-1967), make the "+ Add" button staff-only (the `h()` helper skips `null` children):

```js
        h("div", { class: "actions-card-header" }, [
          h("h3", { class: "u-m-0" }, "Actions"),
          isClient
            ? null
            : h(
                "button",
                {
                  class: "btn sm",
                  onclick: () =>
                    promptText("New action", "e.g. Validate ICP with closed-won data", (title) => {
                      addAction(user.id, p.id, title);
                      render();
                    }),
                },
                "+ Add",
              ),
        ]),
```

- [ ] **Step 6: Implement — inert Likert buttons in renderQuestion**

Replace the buttons section of `renderQuestion` (currently lines 2013-2036) with:

```js
    // Buttons — inert for clients (view-only diagnostic): no handler,
    // disabled, saved answers keep the `sel` highlight so previously
    // captured scoring stays visible.
    const readOnly = isClientView(user);
    const scaleClass = meta.scale === 10 ? "likert likert-10" : "likert likert-" + meta.scale;
    const likert = h("div", { class: scaleClass + (readOnly ? " read-only" : "") });
    // Clamp any stale responses to this question's scale so old data doesn't get stuck selected out-of-range.
    const selectedScore = resp.score >= 1 && resp.score <= meta.scale ? resp.score : null;
    for (let n = 1; n <= meta.scale; n++) {
      const attrs = {
        class: selectedScore === n ? "sel" : "",
        title: (meta.labels && meta.labels[n]) || DATA.scoreLabels[n] || String(n),
      };
      if (readOnly) {
        attrs.disabled = true;
      } else {
        attrs.onclick = () => {
          setResponse(user, org, p.id, idx, { score: n });
          render();
        };
      }
      const btn = h(
        "button",
        attrs,
        [
          h("span", { class: "n" }, String(n)),
          meta.labels && meta.labels[n] ? h("span", { class: "t" }, meta.labels[n]) : null,
        ].filter(Boolean),
      );
      likert.appendChild(btn);
    }
    card.appendChild(likert);
```

(Note: `h()` maps `disabled: true` to `setAttribute("disabled", "")` — see `src/ui/dom.js:34`.)

- [ ] **Step 7: Implement — read-only Likert CSS**

In `styles.css`, insert directly after the `.likert button.sel .n, .likert button.sel .t { ... }` rule (ends ~line 1053):

```css
.likert.read-only button {
  cursor: default;
}
.likert.read-only button:not(.sel):hover {
  border-color: var(--line);
}
```

(The `:not(.sel)` guard keeps the selected answer's brand border from being washed out on hover; specificity beats `.likert button:hover`.)

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run tests/views/diagnostic-client-readonly.test.js`
Expected: PASS (4 tests).

- [ ] **Step 9: Verify staff snapshots unchanged**

Run: `npx vitest run tests/views/ tests/ui/`
Expected: PASS with NO snapshot updates needed — the staff-session snapshots don't exercise the client branches. If `diagnostic.html` wants an update here, a staff branch was touched by mistake — investigate before updating anything.

- [ ] **Step 10: Commit**

```bash
git add src/main.js styles.css tests/views/diagnostic-client-readonly.test.js
git commit -m "feat(diagnostic): client logins get a view-only diagnostic

Clients (and staff client-preview) see inert scoring with saved answers
highlighted, review copy, and no Complete / + Add buttons. Staff scoring
unchanged. UI half of the change; rules enforcement lands next.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Firestore rules — responses writes staff-only

Tighten `/orgs/{orgId}/responses/{respId}` create/update from `inOrg()` to `isInternal()`. Reads stay org-wide so clients can view prior scoring. Matrix tests flip first (TDD), then the rules change makes them pass.

**Files:**
- Modify: `tests/rules/firestore.test.js` (createPayload ~line 174, responses cells ~lines 353-383)
- Modify: `firestore.rules:64-74`

**Interfaces:**
- Consumes: `isInternal()` predicate (firestore.rules:13 — role in ["internal","admin"]); test helpers `runCell`, `createPayload`, `claimsByRole`, `ROLES` (tests/rules/setup.js).
- Produces: nothing downstream; `tests/rules/tenant-jump.test.js` (cross-tenant denies) is unaffected — denies stay denies.

- [ ] **Step 1: Update the matrix cells (failing tests first)**

In `tests/rules/firestore.test.js`:

1a. Generalise the responses create payload (currently `if (path === "orgs/orgA/responses/r2")` at line 174) so new doc ids work:

```js
  if (path.startsWith("orgs/orgA/responses/"))
    return {
      orgId: "orgA",
      userId: uid,
      values: { p1: 4 },
      updatedAt: Timestamp.now(),
    };
```

1b. Replace the responses cell block (currently lines 353-383, from the `// orgs/orgA/responses/{respId}` comment through the delete cell) with:

```js
  // orgs/orgA/responses/{respId} — writes are staff-only since the client
  // view-only diagnostic change (2026-07); reads stay org-wide so clients
  // can view previously captured scoring.
  {
    role: "client_orgA",
    path: "orgs/orgA/responses/r2",
    op: "create",
    expected: "deny",
  }, // client scoring removed
  {
    role: "client_orgA",
    path: "orgs/orgA/responses/r1",
    op: "read",
    expected: "allow",
  },
  {
    role: "client_orgB",
    path: "orgs/orgA/responses/r1",
    op: "read",
    expected: "deny",
  },
  {
    role: "client_orgA",
    path: "orgs/orgA/responses/r1",
    op: "update",
    expected: "deny",
  }, // client scoring removed
  {
    role: "client_orgA",
    path: "orgs/orgA/responses/r1",
    op: "delete",
    expected: "deny",
  },
  {
    role: "internal",
    path: "orgs/orgA/responses/r3",
    op: "create",
    expected: "allow",
  }, // userId = uid
  {
    role: "internal",
    path: "orgs/orgA/responses/r1",
    op: "update",
    expected: "allow",
  },
  {
    role: "admin",
    path: "orgs/orgA/responses/r4",
    op: "create",
    expected: "allow",
  }, // userId = uid
```

- [ ] **Step 2: Run rules tests to verify the new cells fail**

Run: `npm run test:rules`
Expected: FAIL — exactly the two flipped client cells (`create` r2 deny, `update` r1 deny) fail because current rules still allow them. The new internal/admin cells PASS already (staff writes were always allowed via `inOrg`). Everything else stays green — if `tenant-jump` or other files fail, stop and investigate.

- [ ] **Step 3: Tighten the rules**

In `firestore.rules`, replace the responses subcollection block (lines 64-74) with:

```
      // ── responses subcollection ─────────────────────────────────────
      // Writes are staff-only (2026-07, client view-only diagnostic):
      // clients read prior scoring but can no longer submit or edit it.
      match /responses/{respId} {
        allow read:   if inOrg(orgId);
        allow create: if isInternal()
                      && request.resource.data.userId == request.auth.uid;
        allow update: if isInternal()
                      && immutable("userId")
                      && immutable("orgId")
                      && mutableOnly(["values", "updatedAt", "legacyAppUserId"]);
        allow delete: if false;
      }
```

- [ ] **Step 4: Run rules tests to verify they pass**

Run: `npm run test:rules`
Expected: PASS — full rules suite green (firestore matrix, tenant-jump, server-only-deny-all, storage, and the rest).

- [ ] **Step 5: Commit**

```bash
git add firestore.rules tests/rules/firestore.test.js
git commit -m "feat(rules): responses writes are staff-only, clients read-only

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Full verification + PR

**Files:**
- No source changes expected (snapshot updates only if Task 1/2 missed one).

**Interfaces:**
- Consumes: everything above.
- Produces: squash-PR to `main`.

- [ ] **Step 1: Local CI-equivalent gate**

Run each, expect success:

```bash
npm run typecheck
npm run lint
npm run test
```

Known flake: if `tests/views/*` snapshot tests time out in the full run, re-run those files in isolation (`npx vitest run tests/views/`) — pass in isolation is the accepted bar (project memory: pre-existing, not this change).

- [ ] **Step 2: Rules suite once more (post-rebase state)**

Run: `npm run test:rules`
Expected: PASS.

- [ ] **Step 3: Push and open squash-PR**

```bash
git push -u origin feat/client-readonly-diagnostic
gh pr create --base main --title "feat: client view-only diagnostic + static delivery-stage cards" --body "## Summary
- Client logins (and staff client-preview) get a view-only Diagnostic: inert Likert buttons with saved answers highlighted, review copy, no progress banner, no Complete / + Add buttons
- Firestore rules: /orgs/{orgId}/responses writes tightened to staff-only (clients keep read) — defense in depth to match the UI change
- The four Delivery-framework stage cards are now static info cards for all roles: click-to-highlight removed, dead setEngagementStage write path and unused report stage binding deleted

Spec: docs/superpowers/specs/2026-07-02-client-readonly-diagnostic-design.md

## Test plan
- [x] tests/views/stages-static.test.js — cards static for staff, click writes nothing
- [x] tests/views/diagnostic-client-readonly.test.js — client inert UI + staff scoring regression
- [x] tests/rules/firestore.test.js — client create/update on responses denied; internal/admin allowed
- [x] npm run typecheck / lint / test / test:rules locally

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Then request review from `lukebadiali` (ruleset requires non-author approval; no self-approve).

- [ ] **Step 4: Post-merge deploy check (after approval + squash-merge)**

CI deploys hosting + rules on merge to main, and the WIF auth flake is confirmed intermittent (project memory). After the merge, verify the deploy job succeeded:

```bash
gh run list --branch main --limit 3
```

Expected: the deploy workflow for the merge commit shows `success`. If it failed with "have you run firebase login?", re-run the job — otherwise the rules tightening silently never ships.

---

## Self-Review (done at plan time)

- **Spec coverage:** UI inert scoring (Task 2 Step 6), copy/banner/tag (Task 2 Step 3), Complete/+ Add (Task 2 Step 5), heading (Task 2 Step 5a), likert CSS (Task 2 Step 7), stage cards static + dead code (Task 1), rules tightening + tests (Task 3), snapshots (Task 1 Step 6, Task 2 Step 9), local gate + PR + deploy check (Task 4). Error-handling section of spec requires no code (removal-based design; stale-tab writes get permission-denied via existing sync error path). ✓
- **Placeholder scan:** no TBDs; all code complete. ✓
- **Type consistency:** `renderEngagement()` zero-arg matches its single callsite edit; `attrs.disabled`/`attrs.onclick` match `h()` semantics (dom.js:32-34); test fixture ids (`u_client-a`, `u_internal-luke`, `org_test-1` via `orgMetas[0].id`) verified against `tests/fixtures/snapshot-org.json`. ✓
