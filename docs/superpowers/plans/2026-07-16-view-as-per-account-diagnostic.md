# View-As Per-Account Diagnostic + Progress Radar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin pick an org then an account and see/edit *that individual's* diagnostic across rounds (scores out of 100 over only their own answers), with a colour-coded radar overlaying all of that account's rounds — and fix the auth-splash flash and the inflated chat count along the way.

**Architecture:** Two new view-state fields (`state.accountId`, `state.viewRoundId`) drive per-account, per-round scoring/rendering; no auth/identity swap. The domain scorer gains an optional `userId` filter; the IIFE wrappers thread the viewed account through every display site. Answers write under the entered account's uid (rules relaxed to allow it, internal-only). The radar reuses Chart.js, extended from 2 datasets to N.

**Tech Stack:** Vanilla JS (ES modules) + JSDoc `// @ts-check`; Firebase (Auth + Firestore); Chart.js (radar); Vitest 4.1.5 (`vitest run`); `@firebase/rules-unit-testing` 5.0.0 (emulator, Java required).

## Global Constraints

- Conventional Commits (`feat:`/`fix:`/`test:`/`docs:`), no emojis in source or messages.
- `domain/*` imports nothing from `firebase/*` or `data/*` (ESLint-enforced boundary).
- Every source file is `// @ts-check`; keep JSDoc types accurate.
- Lint gate is `eslint . --max-warnings=0`; `typecheck` is `tsc --noEmit`; before pushing run `npm run typecheck && npm run lint && npm run test` (pre-commit only runs eslint/prettier).
- Response docs live at `orgs/{orgId}/responses/{roundId__userId__pillarId}`; clients are view-only (cannot write responses) — must stay true.
- A response counts toward a score only when `isScoredInScale(score, scale)` (score finite and `1..scale`) — the existing #85 rule; do not regress it.
- Feature ships via CI hosting+rules deploy; audit-log wiring is a deferred follow-up (Part C) needing a manual functions deploy.

---

## PART A — Feature

### Task A1: Per-individual scoring (`userId` filter)

**Files:**
- Modify: `src/domain/scoring.js:42-61` (`pillarScoreForRound`), `:70-72` (`pillarScore`)
- Test: `tests/domain/scoring.test.js` (add cases)

**Interfaces:**
- Produces: `pillarScoreForRound(org, roundId, pillarId, DATA, questionMeta, userId?)` — when `userId` is a non-null string, averages only that user's in-scale answers; when omitted/null, averages across all users in the round (unchanged). `pillarScore(org, pillarId, DATA, questionMeta, userId?)` — same, for `org.currentRoundId`.

- [ ] **Step 1: Write the failing tests.** Append to `tests/domain/scoring.test.js` inside the existing `describe("pillarScoreForRound", …)` block (after the "averages multiple respondents" case at line 66):

```js
  it("scopes to a single user when userId is given (individual, not team)", () => {
    // u1 -> 50, u2 -> 100. Team mean is 75, but per-user must be each own.
    const org = {
      currentRoundId: "r1",
      responses: {
        r1: {
          u1: { 1: { 0: { score: 5 } } },
          u2: { 1: { 0: { score: 10 } } },
        },
      },
    };
    expect(pillarScoreForRound(org, "r1", 1, DATA, questionMeta, "u1")).toBe(50);
    expect(pillarScoreForRound(org, "r1", 1, DATA, questionMeta, "u2")).toBe(100);
  });

  it("returns null for a user with no answers in the round", () => {
    const org = { currentRoundId: "r1", responses: { r1: { u1: { 1: { 0: { score: 5 } } } } } };
    expect(pillarScoreForRound(org, "r1", 1, DATA, questionMeta, "ghost")).toBeNull();
  });

  it("still averages across users when userId is omitted (back-compat)", () => {
    const org = {
      currentRoundId: "r1",
      responses: {
        r1: { u1: { 1: { 0: { score: 5 } } }, u2: { 1: { 0: { score: 10 } } } },
      },
    };
    expect(pillarScoreForRound(org, "r1", 1, DATA, questionMeta)).toBe(75);
  });
```

- [ ] **Step 2: Run the tests, verify they fail.**
Run: `npx vitest run tests/domain/scoring.test.js`
Expected: the two new `userId` cases FAIL (current signature ignores the 6th arg, so `"u1"` still returns the team mean 75, not 50).

- [ ] **Step 3: Add the `userId` filter.** Replace `src/domain/scoring.js:42-61` (`pillarScoreForRound`) with:

```js
export function pillarScoreForRound(org, roundId, pillarId, DATA, questionMeta, userId) {
  const p = DATA.pillars.find((pp) => pp.id === pillarId);
  if (!p) return null;
  const byUser = (org.responses || {})[roundId] || {};
  /** @type {number[]} */
  const normalized = [];
  // userId != null -> score only that individual's answers; else aggregate the round.
  const perUsers = userId != null ? [byUser[userId]] : Object.values(byUser);
  perUsers.forEach((perPillar) => {
    const perQ = (perPillar || {})[pillarId] || {};
    Object.entries(perQ).forEach(([idx, r]) => {
      const meta = questionMeta(p.diagnostics[Number(idx)]);
      if (!meta || !meta.scale) return;
      // Only in-scale scores count — excludes stale out-of-range answers that
      // the UI already hides (parity with renderQuestion's display clamp).
      if (!isScoredInScale(r.score, meta.scale)) return;
      normalized.push((r.score / meta.scale) * 100);
    });
  });
  if (!normalized.length) return null;
  return Math.round(normalized.reduce((a, b) => a + b, 0) / normalized.length);
}
```

Also update the JSDoc `@param` block above it — add `@param {string} [userId]` before `@returns`. Then replace `pillarScore` at `:70-72` with:

```js
export function pillarScore(org, pillarId, DATA, questionMeta, userId) {
  return pillarScoreForRound(org, org.currentRoundId, pillarId, DATA, questionMeta, userId);
}
```

Add `@param {string} [userId]` to its JSDoc too.

- [ ] **Step 4: Run the tests, verify they pass.**
Run: `npx vitest run tests/domain/scoring.test.js`
Expected: PASS (all existing cases + 3 new).

- [ ] **Step 5: Commit.**

```bash
git add src/domain/scoring.js tests/domain/scoring.test.js
git commit -m "feat(scoring): optional userId filter for per-individual pillar scores"
```

---

### Task A2: Radar dataset builder (all rounds for one account)

**Files:**
- Create: `src/domain/radar.js`
- Test: `tests/domain/radar.test.js`

**Interfaces:**
- Produces: `roundRadarDatasets(rounds, pillars, scoreForRound)` → `Array<{ roundId, label, createdAt, data: number[] }>`, one entry per round that has ≥1 non-null pillar score, in `rounds` order. `scoreForRound(roundId, pillarId)` returns `number|null`. `data` maps null → 0 for plotting. Pure; no colours (the view assigns colours).

- [ ] **Step 1: Write the failing test.** Create `tests/domain/radar.test.js`:

```js
// tests/domain/radar.test.js
// @ts-check
import { describe, it, expect } from "vitest";
import { roundRadarDatasets } from "../../src/domain/radar.js";

const pillars = [{ id: 1 }, { id: 2 }, { id: 3 }];

describe("roundRadarDatasets", () => {
  it("emits one dataset per round with per-pillar data (null -> 0)", () => {
    const rounds = [
      { id: "r1", label: "Round 1", createdAt: "2026-01-01" },
      { id: "r2", label: "Round 2", createdAt: "2026-02-01" },
    ];
    const scores = { r1: { 1: 40, 2: 60, 3: null }, r2: { 1: 70, 2: 80, 3: 90 } };
    const out = roundRadarDatasets(rounds, pillars, (rid, pid) => scores[rid][pid]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ roundId: "r1", label: "Round 1", data: [40, 60, 0] });
    expect(out[1].data).toEqual([70, 80, 90]);
  });

  it("omits rounds where the account has no data", () => {
    const rounds = [{ id: "r1", label: "R1" }, { id: "r2", label: "R2" }];
    const scores = { r1: { 1: null, 2: null, 3: null }, r2: { 1: 50, 2: null, 3: null } };
    const out = roundRadarDatasets(rounds, pillars, (rid, pid) => scores[rid][pid]);
    expect(out.map((d) => d.roundId)).toEqual(["r2"]);
  });

  it("handles empty/undefined rounds", () => {
    expect(roundRadarDatasets(undefined, pillars, () => 1)).toEqual([]);
    expect(roundRadarDatasets([], pillars, () => 1)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test, verify it fails.**
Run: `npx vitest run tests/domain/radar.test.js`
Expected: FAIL — `Cannot find module '../../src/domain/radar.js'`.

- [ ] **Step 3: Create the module.** Write `src/domain/radar.js`:

```js
// src/domain/radar.js
// @ts-check
// Builds one radar dataset per round that has data for the viewed account.
// Pure + firebase-free (domain boundary). Colours are assigned by the view
// layer (drawRadar), not here.

/**
 * @param {Array<{ id:string, label?:string, createdAt?:string }>} rounds
 * @param {Array<{ id:number }>} pillars
 * @param {(roundId:string, pillarId:number) => number|null} scoreForRound
 * @returns {Array<{ roundId:string, label:string, createdAt:string|undefined, data:number[] }>}
 */
export function roundRadarDatasets(rounds, pillars, scoreForRound) {
  return (rounds || [])
    .map((round) => {
      const raw = pillars.map((p) => scoreForRound(round.id, p.id));
      const hasData = raw.some((v) => v !== null && v !== undefined);
      return {
        roundId: round.id,
        label: round.label || round.id,
        createdAt: round.createdAt,
        data: raw.map((v) => (v == null ? 0 : v)),
        hasData,
      };
    })
    .filter((d) => d.hasData)
    .map(({ hasData, ...keep }) => keep);
}
```

- [ ] **Step 4: Run the test, verify it passes.**
Run: `npx vitest run tests/domain/radar.test.js`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/domain/radar.js tests/domain/radar.test.js
git commit -m "feat(radar): per-account multi-round dataset builder"
```

---

### Task A3: Account selector + entered-account state + per-account scores

**Files:**
- Modify: `src/state.js:12-31` (typedef), `:57-91` (state object) — add `accountId`, `viewRoundId`
- Modify: `src/main.js:843-856` (add `accountsForOrg`/`firstAccountId`/`viewedAccountId`/`activeRoundId` nearby), `:461-463` (score wrappers), `:1043-1057` (createChrome deps)
- Modify: `src/ui/chrome.js:48-63` (deps destructure), `:266-271` (org-select handler reset + account select)

**Interfaces:**
- Consumes: `pillarScore`/`pillarScoreForRound` (Task A1, now userId-aware).
- Produces (IIFE-local): `accountsForOrg(orgId)` → `Array<user>`; `firstAccountId(org)` → `string|null`; `viewedAccountId(user, org)` → `string|null` (client → own id; internal → `state.accountId` validated-in-org, else first account); `activeRoundId(org)` → `string` (`state.viewRoundId` validated-in-org, else `org.currentRoundId`). New chrome dep: `accountsForOrg`.

- [ ] **Step 1: Add the state fields.** In `src/state.js`, add to the `AppState` typedef (after `orgId: string|null,` at line 16):

```js
 *   accountId: string|null,
 *   viewRoundId: string|null,
```

and to the state object (after `orgId: null, ...` at line 61):

```js
  accountId: null, // internal-only: the account (client user id) being "entered"
  viewRoundId: null, // the round being viewed/edited for that account (null = current)
```

- [ ] **Step 2: Add the resolver helpers.** In `src/main.js`, immediately after `isClientView` closes (line 869), insert:

```js
  // ---------- View-as (account + round) ----------
  /** Client accounts belonging to an org (internal-only account selector source). */
  function accountsForOrg(orgId) {
    return loadUsers().filter((u) => u.role === "client" && u.orgId === orgId);
  }
  /** @param {*} org */
  function firstAccountId(org) {
    const list = org ? accountsForOrg(org.id) : [];
    return list.length ? list[0].id : null;
  }
  /**
   * The account whose diagnostic is being viewed/edited. Clients are always
   * themselves; internal users pick via state.accountId (validated against the
   * org, else the first account). Returns null only when there is no account.
   * @param {*} user @param {*} org
   */
  function viewedAccountId(user, org) {
    if (!user || !org) return null;
    if (user.role === "client") return user.id;
    if (state.accountId && accountsForOrg(org.id).some((a) => a.id === state.accountId)) {
      return state.accountId;
    }
    return firstAccountId(org);
  }
  /** The round currently in view (state.viewRoundId if valid for org, else current). */
  function activeRoundId(org) {
    if (state.viewRoundId && (org.rounds || []).some((r) => r.id === state.viewRoundId)) {
      return state.viewRoundId;
    }
    return org.currentRoundId;
  }
```

- [ ] **Step 3: Thread the viewed account through the score wrappers.** Replace `src/main.js:461-463`:

```js
  const pillarScoreForRound = (org, roundId, pillarId) =>
    _pillarScoreForRound(org, roundId, pillarId, DATA, questionMeta);
  const pillarScore = (org, pillarId) => _pillarScore(org, pillarId, DATA, questionMeta);
```

with:

```js
  const pillarScoreForRound = (org, roundId, pillarId) =>
    _pillarScoreForRound(org, roundId, pillarId, DATA, questionMeta, viewedAccountId(currentUser(), org));
  const pillarScore = (org, pillarId) =>
    _pillarScore(org, pillarId, DATA, questionMeta, viewedAccountId(currentUser(), org));
```

- [ ] **Step 4: Pass `accountsForOrg` into chrome.** Find the `createChrome({ … })` deps object (around `src/main.js:1043-1057`) and add `accountsForOrg,` to it (alongside `loadOrgMetas`). In `src/ui/chrome.js`, add `accountsForOrg,` to the `deps` destructure near line 55-63 (next to `activeOrgForUser`).

- [ ] **Step 5: Reset account/round on org switch + render the account selector.** In `src/ui/chrome.js`, change the org-select handler (lines 266-270) to also clear the account/round:

```js
      orgSelect.addEventListener("change", (e) => {
        state.orgId = /** @type {HTMLSelectElement} */ (e.target).value;
        state.accountId = null;
        state.viewRoundId = null;
        state.route = "dashboard";
        render();
      });
```

Then, immediately after `topright.appendChild(orgSelect);` (line 271), insert the account selector (still inside the `if (!isClient)` block):

```js
      const acctSelect = /** @type {HTMLSelectElement} */ (
        h("select", { "aria-label": "Select account" })
      );
      const accounts = org ? accountsForOrg(org.id) : [];
      if (!accounts.length) {
        const opt = document.createElement("option");
        opt.textContent = "No accounts";
        opt.disabled = true;
        opt.selected = true;
        acctSelect.appendChild(opt);
        acctSelect.disabled = true;
      } else {
        const selected = state.accountId || accounts[0].id;
        accounts.forEach((a) => {
          const opt = document.createElement("option");
          opt.value = a.id;
          opt.textContent = a.name || a.email || a.id;
          if (a.id === selected) opt.selected = true;
          acctSelect.appendChild(opt);
        });
      }
      acctSelect.id = "acctSelect";
      acctSelect.addEventListener("change", (e) => {
        state.accountId = /** @type {HTMLSelectElement} */ (e.target).value;
        state.viewRoundId = null;
        state.route = "dashboard";
        render();
      });
      topright.appendChild(acctSelect);
```

- [ ] **Step 6: Typecheck + lint + unit tests.**
Run: `npm run typecheck && npm run lint && npx vitest run tests/domain/`
Expected: PASS (no type/lint errors; domain tests green).

- [ ] **Step 7: Manual verification.** Run `npm run dev`, sign in as an internal/admin user with an org that has ≥2 client accounts each holding different answers. Confirm: (a) an "Select account" dropdown appears beside the org dropdown; (b) switching account changes the dashboard pillar numbers to that individual's scores; (c) switching org resets the account to the first in the new org. Note in the commit message what you observed.

- [ ] **Step 8: Commit.**

```bash
git add src/state.js src/main.js src/ui/chrome.js
git commit -m "feat(diagnostic): admin account selector; per-account pillar scores"
```

---

### Task A4: Editable older rounds (view/edit the entered account's answers)

**Files:**
- Modify: `src/main.js:2050-2101` (`renderQuestion` read path), `:2183-2207` (`setResponse`), `:3174-3210` (`cloudPushResponse` — unchanged signature, already takes userId/roundId), `:1676-1692` (`answerSummaryForPillar` userId), `:1857-1897` (diagnostic-index tile score + count), `:2143-2146` (`renderScoreBlock` score + count), `:1949-1975` (round bar / round selector area)

**Interfaces:**
- Consumes: `viewedAccountId`, `activeRoundId`, `accountsForOrg` (Task A3); `pillarScoreForRound` (A1).
- Produces: `answerSummaryForPillar(org, pillarId, userId?)` (userId scopes the N/M tally); a round `<select>` in the diagnostic index that sets `state.viewRoundId`.

- [ ] **Step 1: Write the failing test for `answerSummaryForPillar` scoping.** `answerSummaryForPillar` is IIFE-local (not exported), so assert the *scoring* parity instead — it already has coverage via Task A1. Add one domain test proving per-user isolation is what feeds the count, in `tests/domain/scoring.test.js` under `describe("answeredCount", …)` (mirrors the count path):

```js
  it("answeredCount isolates a single user's in-scale answers", () => {
    const org = {
      currentRoundId: "r1",
      responses: {
        r1: {
          u1: { 1: { 0: { score: 5 }, 1: { score: 3 } } }, // 2 in-scale
          u2: { 1: { 0: { score: 9 } } },
        },
      },
    };
    // pillar 1 has 2 questions (scale 10 then 5); u1 answered both in-scale.
    expect(answeredCount(org, "r1", "u1", 1, DATA)).toEqual({ done: 2, total: 2 });
    expect(answeredCount(org, "r1", "u2", 1, DATA)).toEqual({ done: 1, total: 2 });
  });
```

Run: `npx vitest run tests/domain/scoring.test.js` — Expected: PASS already (this documents the per-user count contract the UI now relies on; if it fails, `answeredCount` regressed).

- [ ] **Step 2: Scope `answerSummaryForPillar` to the account + viewed round.** Replace `src/main.js:1676-1692` with:

```js
  function answerSummaryForPillar(org, pillarId, userId) {
    const byUser = (org.responses || {})[activeRoundId(org)] || {};
    const pillar = DATA.pillars.find((p) => p.id === pillarId);
    const perUsers = userId != null ? [byUser[userId]] : Object.values(byUser);
    let done = 0,
      total = 0;
    perUsers.forEach((perPillar) => {
      const qs = (perPillar || {})[pillarId] || {};
      total += pillar.diagnostics.length;
      Object.entries(qs).forEach(([idx, r]) => {
        const meta = questionMeta(pillar.diagnostics[Number(idx)]);
        // Count only in-scale answers so the "N/M" tally matches the pillar
        // number, which excludes stale out-of-range scores (2026-07 fix).
        if (meta && meta.scale && isScoredInScale(r.score, meta.scale)) done += 1;
      });
    });
    return { done, total };
  }
```

Update its two callers to pass the account:
- Dashboard tile (`src/main.js:1509`): `const { done, total } = answerSummaryForPillar(org, p.id);` → `const { done, total } = answerSummaryForPillar(org, p.id, viewedAccountId(user, org));`
- `renderScoreBlock` (`src/main.js:2146`): `const { done, total } = answerSummaryForPillar(org, p.id);` → `const acct = viewedAccountId(currentUser(), org);` on the line above, then `answerSummaryForPillar(org, p.id, acct);`. Also change `renderScoreBlock`'s score line `:2144` `const s = pillarScore(org, p.id);` → `const s = pillarScoreForRound(org, activeRoundId(org), p.id);`.

- [ ] **Step 3: Point `renderQuestion` at the entered account + viewed round.** In `src/main.js:2052-2053` replace:

```js
    const resp =
      ((((org.responses || {})[org.currentRoundId] || {})[user.id] || {})[p.id] || {})[idx] || {};
```

with:

```js
    const acct = viewedAccountId(user, org);
    const resp =
      ((((org.responses || {})[activeRoundId(org)] || {})[acct] || {})[p.id] || {})[idx] || {};
```

The `readOnly = isClientView(user)` gate (line 2068) stays — clients remain view-only; internal users edit the entered account.

- [ ] **Step 4: Retarget the write path.** Replace `src/main.js:2183-2207` (`setResponse`) so it writes under the entered account + viewed round:

```js
  function setResponse(user, org, pillarId, idx, patch) {
    const o = loadOrg(org.id);
    const roundId = activeRoundId(o);
    const acctId = viewedAccountId(user, o) || user.id;
    o.responses = o.responses || {};
    o.responses[roundId] = o.responses[roundId] || {};
    o.responses[roundId][acctId] = o.responses[roundId][acctId] || {};
    o.responses[roundId][acctId][pillarId] = o.responses[roundId][acctId][pillarId] || {};
    const cur = o.responses[roundId][acctId][pillarId][idx] || {};
    const merged = Object.assign({}, cur, patch);
    o.responses[roundId][acctId][pillarId][idx] = merged;
    // Local-only write — the in-memory model needs the new score for the inline
    // render() that follows. Cloud push mirrors it to the responses subcollection
    // under the ENTERED account's uid (rules relaxed to allow internal writers;
    // see firestore.rules responses block).
    jset(K.org(o.id), o);
    cloudPushResponse(o.id, roundId, acctId, pillarId, idx, merged);
  }
```

`cloudPushResponse` (`:3174`) already takes `(orgId, roundId, userId, pillarId, idx, value)` and writes `userId` into the doc — no change needed there beyond the rules relaxation in Task A6.

- [ ] **Step 5: Diagnostic-index score reflects the viewed round.** In `src/main.js:1858` replace `const s = pillarScore(org, p.id);` with `const s = pillarScoreForRound(org, activeRoundId(org), p.id);`. Then the per-user count block at `:1863-1866` (`userResp` reading `org.currentRoundId`/`user.id`) — replace its round/user with the account + viewed round:

```js
      const userResp =
        (((org.responses || {})[activeRoundId(org)] || {})[viewedAccountId(user, org)] || {})[p.id] ||
        {};
```

Update the `.tag` copy at `:1878-1882` — drop "team" framing now it is per-account:

```js
          isClientView(user)
            ? `Score ${s !== null ? s + "/100" : "—"}`
            : `${userDone}/${total} answered · score ${s !== null ? s + "/100" : "—"}`,
```

- [ ] **Step 6: Add the round selector.** In `renderDiagnosticIndex` (near the top of the tiles list, right after the intro copy — locate the first `frag.appendChild` after `renderDiagnosticIndex(user, org)` opens, around `src/main.js:1849`), insert an internal-only round `<select>`:

```js
    if (!isClientView(user) && (org.rounds || []).length) {
      const roundSel = /** @type {HTMLSelectElement} */ (
        h("select", { "aria-label": "Select round", class: "round-select" })
      );
      const activeRid = activeRoundId(org);
      org.rounds.forEach((r) => {
        const opt = document.createElement("option");
        opt.value = r.id;
        opt.textContent = `${r.label} (${formatDate(r.createdAt)})`;
        if (r.id === activeRid) opt.selected = true;
        roundSel.appendChild(opt);
      });
      roundSel.addEventListener("change", (e) => {
        state.viewRoundId = /** @type {HTMLSelectElement} */ (e.target).value;
        render();
      });
      frag.appendChild(h("div", { class: "round-select-wrap" }, ["Round: ", roundSel]));
    }
```

(`formatDate` is already used in `renderRoundBar` at `src/main.js:1701`, so it is in scope.)

- [ ] **Step 7: Typecheck + lint + unit tests.**
Run: `npm run typecheck && npm run lint && npx vitest run tests/domain/`
Expected: PASS.

- [ ] **Step 8: Manual verification.** `npm run dev`, sign in as admin, enter an account: (a) answer a few questions → the pillar number updates for that account only; (b) pick an older round in the round selector → the questions show that round's saved answers and edits save into that round; (c) switch to a different account → answers/score change; (d) confirm a client login is still read-only. Note observations in the commit.

- [ ] **Step 9: Commit.**

```bash
git add src/main.js tests/domain/scoring.test.js
git commit -m "feat(diagnostic): edit entered account's answers across any round"
```

---

### Task A5: Multi-round progress radar

**Files:**
- Modify: `src/main.js:1774-1838` (`drawRadar`), `:1603` (radar invocation — drop `prevRoundId` arg), `:1441-1443`/legend area if needed
- Reuse: `src/domain/radar.js` (Task A2)

**Interfaces:**
- Consumes: `roundRadarDatasets` (import alongside the other domain imports at `src/main.js:129-135`); `pillarScoreForRound` (A1, account-aware via wrapper).

- [ ] **Step 1: Import the builder.** Add to the scoring import block (`src/main.js:129-135`), a new import line after it:

```js
import { roundRadarDatasets } from "./domain/radar.js";
```

- [ ] **Step 2: Rewrite `drawRadar` to overlay all of the entered account's rounds.** Replace `src/main.js:1774-1838` (`drawRadar`) with:

```js
  // Distinct colours cycled per round (oldest → newest). Newest round is drawn
  // last (on top) and solid; older rounds are lighter/dashed.
  const RADAR_COLORS = [
    "#579EC0", "#ED7D31", "#7A9E5E", "#9B59B6", "#E0A458", "#C0504D", "#4472C4", "#2E8B8B",
  ];

  function drawRadar(org) {
    if (!window.Chart) {
      setTimeout(() => drawRadar(org), 120);
      return;
    }
    const canvas = $("#radar");
    if (!canvas) return;

    const labels = DATA.pillars.map((p) => p.shortName || p.name);
    // One dataset per round that has data for the entered account (account
    // scoping is inside the pillarScoreForRound wrapper via viewedAccountId).
    const built = roundRadarDatasets(org.rounds || [], DATA.pillars, (roundId, pillarId) =>
      pillarScoreForRound(org, roundId, pillarId),
    );

    const datasets = built.map((d, i) => {
      const isLatest = i === built.length - 1;
      const color = RADAR_COLORS[i % RADAR_COLORS.length];
      return {
        label: `${d.label}${d.createdAt ? " · " + formatDate(d.createdAt) : ""}`,
        data: d.data,
        fill: true,
        backgroundColor: isLatest ? "rgba(87,158,192,0.18)" : "transparent",
        borderColor: color,
        borderWidth: isLatest ? 2.5 : 1.5,
        borderDash: isLatest ? [] : [4, 4],
        pointRadius: isLatest ? 3 : 2,
        pointBackgroundColor: color,
      };
    });

    state.chart = new Chart(canvas.getContext("2d"), {
      type: "radar",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: datasets.length > 1, position: "bottom", labels: { font: { size: 11 } } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.r}/100` } },
        },
        scales: {
          r: {
            suggestedMin: 0,
            suggestedMax: 100,
            ticks: {
              stepSize: 20,
              color: "#8a94a7",
              backdropColor: "rgba(0,0,0,0)",
              font: { size: 10 },
            },
            grid: { color: "#e3e6ee" },
            angleLines: { color: "#e3e6ee" },
            pointLabels: { font: { size: 11, family: "Inter" }, color: "#303849" },
          },
        },
      },
    });
  }
```

(Chart.js gives legend click-to-toggle for free, satisfying the "hide/show a round" requirement.)

- [ ] **Step 3: Update the invocation.** At `src/main.js:1603`, replace `queueMicrotask(() => drawRadar(org, prevRoundId));` with `queueMicrotask(() => drawRadar(org));`. Search for any other `drawRadar(` call site (there is also the report view; grep `drawRadar(`) and drop the second argument.

- [ ] **Step 4: Typecheck + lint + unit tests.**
Run: `npm run typecheck && npm run lint && npx vitest run tests/domain/`
Expected: PASS.

- [ ] **Step 5: Manual verification.** `npm run dev`, admin enters an account that has ≥2 rounds with data: confirm the radar shows one coloured polygon per round with a legend (label + date), the newest is solid/on top, and clicking a legend entry hides/shows that round. Switching account re-draws with that account's rounds.

- [ ] **Step 6: Commit.**

```bash
git add src/main.js
git commit -m "feat(radar): overlay all of the entered account's rounds, colour-coded"
```

---

### Task A6: Relax Firestore rule for cross-account response writes (+ rules test)

**Files:**
- Modify: `firestore.rules:72-81` (responses match block)
- Create: `tests/rules/responses.test.js`

**Interfaces:**
- Produces: internal users may create/update a response doc with any `userId` within an org; clients denied; deletes denied.

- [ ] **Step 1: Write the failing rules test.** Create `tests/rules/responses.test.js` (mirrors `tests/rules/auditLog.test.js` structure):

```js
// tests/rules/responses.test.js
// @ts-check
import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import { setDoc, doc, serverTimestamp } from "firebase/firestore";
import { initRulesEnv, asUser, ROLES, assertSucceeds, assertFails } from "./setup.js";

let testEnv;
const claimsByRole = Object.fromEntries(ROLES.map((r) => [r.role, r.claims]));

beforeAll(async () => {
  testEnv = await initRulesEnv("firestore", "responses");
});
afterAll(async () => {
  await testEnv.cleanup();
});
beforeEach(async () => {
  await testEnv.clearFirestore();
});

const respId = "r1__clientUidX__1";
const respPath = `orgs/orgA/responses/${respId}`;
const newDoc = (userId) => ({
  orgId: "orgA",
  roundId: "r1",
  userId,
  pillarId: "1",
  values: [{ score: 5 }],
  updatedAt: serverTimestamp(),
});

describe("responses — internal may write another account's answers", () => {
  it("internal create with a NON-self userId -> allow", async () => {
    const db = asUser(testEnv, "internal", claimsByRole.internal);
    await assertSucceeds(setDoc(doc(db, respPath), newDoc("clientUidX")));
  });

  it("client create -> deny (view-only diagnostic)", async () => {
    const db = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertFails(setDoc(doc(db, respPath), newDoc("client_orgA")));
  });

  it("internal cannot write a response in a mismatched-path org tenant field", async () => {
    // orgId field must match the path org; write a doc whose orgId != path.
    const db = asUser(testEnv, "internal", claimsByRole.internal);
    await assertFails(
      setDoc(doc(db, respPath), { ...newDoc("clientUidX"), orgId: "orgB" }),
    );
  });
});
```

- [ ] **Step 2: Run the rules test, verify the first case fails.**
Run: `npm run test:rules -- tests/rules/responses.test.js` (requires Java + emulator; if the harness lacks Java, prepend `~/scoop/apps/temurin-lts-jdk/current/bin` to PATH).
Expected: the "internal create with a NON-self userId -> allow" case FAILS (current rule requires `userId == request.auth.uid`, and the internal caller's uid is `"internal"`, not `"clientUidX"`).

- [ ] **Step 3: Relax the create rule + add the org-field match.** Replace `firestore.rules:72-81` with:

```
      match /responses/{respId} {
        allow read:   if inOrg(orgId);
        // 2026-07 view-as: internal users may capture/edit answers on behalf of
        // any account IN THIS ORG (userId is the diagnostic subject, not the
        // caller). Tenant scope enforced via the path orgId + the orgId field.
        // Clients stay fully blocked (isInternal() is false for them).
        allow create: if isInternal()
                      && request.resource.data.orgId == orgId;
        allow update: if isInternal()
                      && immutable("userId")
                      && immutable("orgId")
                      && mutableOnly(["values", "updatedAt", "legacyAppUserId"]);
        allow delete: if false;
      }
```

- [ ] **Step 4: Run the rules test, verify it passes.**
Run: `npm run test:rules -- tests/rules/responses.test.js`
Expected: PASS (internal cross-user allow; client deny; org-mismatch deny).

- [ ] **Step 5: Commit.**

```bash
git add firestore.rules tests/rules/responses.test.js
git commit -m "feat(rules): internal may write any in-org account's diagnostic responses"
```

---

## PART B — Bug fixes (independent of Part A; ship together)

### Task B1: Bug #3 — chat count scope + soft-deleted exclusion

**Files:**
- Modify: `src/domain/unread.js:72-90` (`unreadChatTotal`), `src/domain/activity.js:32-44` (`countNewer`)
- Modify: `tests/domain/unread.test.js` (update internal-user cases to the scoped signature; add deletedAt case)
- Modify: `src/main.js:510-527` (`unreadChatTotal` wrapper — pass active org), `:730-756` (activity listener — skip deletedAt), `:3671-3690` (chat thread — skip deletedAt), `:4909-4930` (funnel — skip deletedAt)

**Interfaces:**
- Produces: `unreadChatTotal(user, chatMessages, lastReadForOrg, scopeOrgId?)` — staff count is scoped to `scopeOrgId` (the active org) instead of summing all orgs; both branches exclude `m.deletedAt`. `countNewer` skips items with `deletedAt`.

- [ ] **Step 1: Update the failing tests.** In `tests/domain/unread.test.js`, replace the three internal-user cases (lines 180-207) with scoped equivalents, and add a deletedAt case:

```js
  it("internal user: counts only the scoped org (chat-nav badge = active org)", () => {
    const user = { id: "u_self", role: "internal" };
    /** @param {string} orgId */
    const lastReadForOrg = (orgId) => ({ orgA: ts(1000), orgB: ts(1500) })[orgId] || null;
    const messages = [
      { orgId: "orgA", authorId: "u_other", createdAt: ts(2000) }, // counted
      { orgId: "orgB", authorId: "u_other", createdAt: ts(2000) }, // other org -> excluded
      { orgId: "orgA", authorId: "u_self", createdAt: ts(2000) }, // self -> excluded
    ];
    expect(unreadChatTotal(user, messages, lastReadForOrg, "orgA")).toBe(1);
  });

  it("internal user: no read-marker for the scoped org treats messages as unread", () => {
    const user = { id: "u_self", role: "internal" };
    const lastReadForOrg = () => null;
    const messages = [{ orgId: "orgA", authorId: "u_other", createdAt: ts(2000) }];
    expect(unreadChatTotal(user, messages, lastReadForOrg, "orgA")).toBe(1);
  });

  it("excludes soft-deleted messages (client and internal)", () => {
    const internal = { id: "u_self", role: "internal" };
    const client = { id: "u_self", role: "client", orgId: "orgA" };
    const lastReadForOrg = () => ts(0);
    const messages = [
      { orgId: "orgA", authorId: "u_other", createdAt: ts(2000), deletedAt: ts(2500) }, // deleted
      { orgId: "orgA", authorId: "u_other", createdAt: ts(2000) }, // live
    ];
    expect(unreadChatTotal(internal, messages, lastReadForOrg, "orgA")).toBe(1);
    expect(unreadChatTotal(client, messages, lastReadForOrg)).toBe(1);
  });
```

Run: `npx vitest run tests/domain/unread.test.js` — Expected: the new internal + deletedAt cases FAIL (current staff branch sums all orgs and ignores `deletedAt`).

- [ ] **Step 2: Rewrite `unreadChatTotal`.** Replace `src/domain/unread.js:72-90` with:

```js
export function unreadChatTotal(user, chatMessages, lastReadForOrg, scopeOrgId) {
  if (!user) return 0;
  const list = chatMessages || [];
  // Clients are pinned to their own org; staff count the ACTIVE org only
  // (the chat-nav badge shows "this chat", not a global roll-up — the bell
  // handles the cross-org total). Soft-deleted messages never count.
  const orgId = user.role === "client" ? user.orgId || "" : scopeOrgId || "";
  const lastReadTs = lastReadForOrg(orgId);
  const lastMs = lastReadTs ? lastReadTs.toMillis() : 0;
  return list.filter(
    (m) =>
      m.orgId === orgId &&
      m.authorId !== user.id &&
      !m.deletedAt &&
      m.createdAt &&
      m.createdAt.toMillis() > lastMs,
  ).length;
}
```

Update the JSDoc `@param` block (lines 67-71) to add `@param {string} [scopeOrgId]`.

- [ ] **Step 3: Exclude soft-deleted from the bell math.** In `src/domain/activity.js:32-44` (`countNewer`), add a `deletedAt` skip after the author guard:

```js
function countNewer(items, authorField, markerMs, selfUid) {
  let count = 0;
  let latestMs = 0;
  for (const item of items || []) {
    if (!item || item[authorField] == null || item[authorField] === selfUid) continue;
    if (item.deletedAt) continue;
    const ms = itemMillis(item);
    if (ms > markerMs) {
      count += 1;
      if (ms > latestMs) latestMs = ms;
    }
  }
  return { count, latestMs };
}
```

- [ ] **Step 4: Run the domain tests, verify green.**
Run: `npx vitest run tests/domain/unread.test.js tests/domain/activity.test.js`
Expected: PASS.

- [ ] **Step 5: Pass the active org into the wrapper.** In `src/main.js:510-527`, change the wrapper to pass the active org id as `scopeOrgId`. Replace the final `return _unreadChatTotal(user, messages, lastReadForOrg);` with:

```js
    const scopeOrgId = activeOrgForUser(user)?.id || null;
    return _unreadChatTotal(user, messages, lastReadForOrg, scopeOrgId);
```

- [ ] **Step 6: Skip soft-deleted in the three listeners.**
  - Activity listener (`src/main.js:735-739` inner `snap.forEach`): change to `snap.forEach((d) => { const data = d.data(); if (data.deletedAt) return; list.push({ id: d.id, orgId, ...data }); });`
  - Chat thread (`src/main.js:3675`): change `snap.forEach((d) => allMessages.push({ id: d.id, ...d.data() }));` to `snap.forEach((d) => { const data = d.data(); if (data.deletedAt) return; allMessages.push({ id: d.id, ...data }); });`
  - Funnel (`src/main.js:4915`): change `snap.forEach((d) => allComments.push({ id: d.id, ...d.data() }));` to `snap.forEach((d) => { const data = d.data(); if (data.deletedAt) return; allComments.push({ id: d.id, ...data }); });`

- [ ] **Step 7: Typecheck + lint + full unit run.**
Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 8: Manual verification.** As admin, open an org chat with 3 messages while other orgs have unread chat: the chat-nav badge shows 3 (this org), the bell still shows the cross-org total. Soft-delete a message via the admin surface → it drops out of the thread and the counts. Note observations.

- [ ] **Step 9: Commit.**

```bash
git add src/domain/unread.js src/domain/activity.js src/main.js tests/domain/unread.test.js
git commit -m "fix(chat): scope chat-nav count to active org; exclude soft-deleted from counts"
```

---

### Task B2: Bug #1 — auth splash flash on reload

**Files:**
- Modify: `src/main.js:4093` (remove premature set), `:4095-4103` (null branch set), after `:4182` (success set), `:4299-4304` (timeout)

**Interfaces:**
- Produces: `state.authResolved` becomes true only once the user state is actually known; the safety-net timeout no longer fires at 2.5s.

- [ ] **Step 1: Remove the premature unconditional set.** Delete `state.authResolved = true;` at `src/main.js:4093` (and its now-stale leading comment lines 4089-4092 that say it is set "unconditionally, before the null split").

- [ ] **Step 2: Set it in the null branch.** In the `if (!fbUser) {` block (`src/main.js:4095`), add `state.authResolved = true;` as the first line inside the block (before `state.fbUser = null;`).

- [ ] **Step 3: Set it after the user is composed.** Immediately after the `state.fbUser = { … };` object literal closes (`src/main.js:4182`, the line with `};`), add:

```js
    // Only now do we truly know the signed-in user — flip the splash guard here
    // (not before the awaits) so no render() in the async gap paints the login
    // screen for an already-authenticated user.
    state.authResolved = true;
```

- [ ] **Step 4: Extend the safety-net timeout.** In `src/main.js:4299-4304`, change `2500` to `8000` (comfortably above a slow App Check / reCAPTCHA cold start, so a valid-but-slow session keeps the splash instead of flashing the homepage; a genuinely dead auth still escapes to sign-in after 8s):

```js
  setTimeout(() => {
    if (!state.authResolved) {
      state.authResolved = true;
      render();
    }
  }, 8000);
```

- [ ] **Step 5: Typecheck + lint + full unit run.**
Run: `npm run typecheck && npm run lint && npm run test`
Expected: PASS (no test touches this path; ensure nothing regressed).

- [ ] **Step 6: Manual verification.** `npm run dev`, sign in, then hard-reload the page several times (and throttle the network in devtools to ~Slow 3G). Expected: the branded splash holds, then the dashboard appears — the marketing homepage + sign-in form never flashes. Sign out and reload → sign-in screen shows correctly (splash briefly, then login). Note observations.

- [ ] **Step 7: Commit.**

```bash
git add src/main.js
git commit -m "fix(auth): resolve splash guard only once user is known; extend safety-net"
```

---

## PART C — Deferred follow-up (NOT in the ship sequence)

### Task C1 (deferred): Audit-log cross-account answer edits

Wire `emitAuditEvent` into `setResponse` when an internal user edits an account other than a fresh current-round entry. **Blocked on a Cloud Function change + manual deploy** (CI does not deploy functions):

1. Add a new event type (e.g. `data.response.edit`) to the functions Zod enum `functions/src/audit/auditEventSchema.ts:18-129` (and any mirror constant).
2. Add the name to the client `AUDIT_EVENTS` table `src/observability/audit-events.js:20-47`.
3. In `setResponse` (post-write), call `emitAuditEvent("data.response.edit", { type: "response", id: `${roundId}__${acctId}__${pillarId}`, orgId: o.id }, { idx, score: patch.score })` — best-effort (never block the write).
4. Deploy: `firebase deploy --only functions` (runs as business@bedeveloped.com; may need `firebase login --reauth`).

Track this as a GSD todo; it dovetails with the existing AUDIT-05 "wire call sites" work.

---

## Self-Review

**Spec coverage:**
- Per-individual scoring → A1 ✓ · account selector + entered state → A3 ✓ · editable older rounds → A4 ✓ · progress radar (all rounds, colour, toggle) → A2 + A5 ✓ · chat/docs stay org-level (untouched) ✓ · rules relaxation + test → A6 ✓ · client sees own answers (scoped by `viewedAccountId`) → A3 ✓ · audit deferred → C1 ✓ · bug #1 → B2 ✓ · bug #3 → B1 ✓.
- Gap accepted by decision: audit (C1) deferred; documents impersonation explicitly out of scope.

**Placeholder scan:** No TBD/"handle errors"/"similar to". Every code step shows full code. Two IIFE-local functions (`viewedAccountId`, `answerSummaryForPillar`) aren't unit-tested directly (not exported); their behaviour is covered by domain tests (A1) + manual steps — flagged, not hidden.

**Type consistency:** `pillarScoreForRound(…, userId?)` / `pillarScore(…, userId?)` defined A1, consumed A3/A4/A5. `roundRadarDatasets(rounds, pillars, scoreForRound)` defined A2, consumed A5. `unreadChatTotal(…, scopeOrgId?)` defined B1, consumed at the `src/main.js:510` wrapper. `viewedAccountId`/`activeRoundId`/`accountsForOrg` defined A3, consumed A4/A5/B1. `state.accountId`/`state.viewRoundId` added A3, read across A3/A4/A5.

**Sequencing:** A1→A3 (scoring before wiring), A2→A5 (builder before radar), A3→A4 (state/helpers before edit path), A6 independent (deploys via rules). Part B independent of Part A. Recommend order: A1, A2, A6, A3, A4, A5, B1, B2.
