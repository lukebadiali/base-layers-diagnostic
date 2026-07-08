# Staff Notification Bell Implementation Plan (scope item 7)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A staff-only bell in the topbar surfacing new chat messages and document uploads across all client orgs, with per-org attribution and click-through; the broken staff chat-unread substrate (`state.activeOrgId` bug) is replaced in the process.

**Architecture:** Per-org `onSnapshot` listeners (messages + documents, `limit(30)`) populate `state.activity`; a pure `activitySummary()` domain function counts items newer than per-browser surface-visit markers (existing `chatLastRead` localStorage pattern + new `docsLastSeen` twin); chrome renders the bell + dropdown via DI. The old single-org `startChatSubscription` and `state.chatMessages` are deleted; `unreadChatTotal` is repointed at the activity store, reviving four dead consumers.

**Tech Stack:** Vanilla JS, `h()` helper, window.FB firestore shim (exposes `query`/`orderBy`/`limit`/`onSnapshot` — src/firebase/db.js:71-86), Vitest + happy-dom.

**Spec:** `docs/superpowers/specs/2026-07-06-notification-bell-design.md` (read it — the Decisions section governs).

## Global Constraints

- Conventional Commits; no emojis in commits or source (bell glyph = inline SVG, never the Unicode/emoji bell).
- Branch `feat/notification-bell` (stacked on `feat/scope-ux-polish`); commit directly, no new branches/worktrees.
- Pre-commit hook: eslint/prettier (lint-staged) + gitleaks; eslint `--max-warnings=0`.
- Do NOT run full `npm run test`; run named files in isolation. `npm run typecheck`: only the pre-existing untracked `scripts/bootstrap-admin/run.js` error is allowed.
- Stage ONLY files named in each commit step.
- `src/domain/*` imports nothing from Firebase (lint-enforced project convention).
- View boot tests run with `window.FB = { ready: false }` — all Firestore wiring must no-op cleanly in that mode (guard on `window.FB && window.FB.currentUser && window.FB.firestore`, the existing pattern).
- Line numbers cited may drift — locate by quoted content.

---

### Task 1: Pure domain — src/domain/activity.js

**Files:**
- Create: `src/domain/activity.js`
- Create: `tests/domain/activity.test.js`

**Interfaces:**
- Produces: `activitySummary(orgMetas, activity, markers, selfUid)` where
  `orgMetas: Array<{id: string, name: string}>`;
  `activity: { messages: Record<string, Array<{authorId?: string, createdAt?: *}>>, documents: Record<string, Array<{uploaderId?: string, createdAt?: *}>> }`;
  `markers: { chatLastRead: Record<string, number>, docsLastSeen: Record<string, number> }` (plain epoch-ms maps; missing key = 0);
  returns `{ total: number, orgs: Array<{orgId: string, orgName: string, chatCount: number, docCount: number, latestMs: number}> }`, zero-activity orgs omitted, sorted `latestMs` desc. Task 3 consumes this exact shape.

- [ ] **Step 1: Write the failing tests**

Create `tests/domain/activity.test.js`:

```js
// tests/domain/activity.test.js
// @ts-check
// Scope item 7 (2026-07): pure aggregation for the staff notification bell.
import { describe, it, expect } from "vitest";
import { activitySummary } from "../../src/domain/activity.js";

const ts = (/** @type {number} */ ms) => ({ toMillis: () => ms });
const METAS = [
  { id: "orgA", name: "Acme" },
  { id: "orgB", name: "Bravo" },
];

describe("activitySummary", () => {
  it("counts messages and documents newer than the org marker, excluding own items", () => {
    const activity = {
      messages: {
        orgA: [
          { authorId: "client1", createdAt: ts(2000) },
          { authorId: "me", createdAt: ts(3000) }, // own — excluded
          { authorId: "client1", createdAt: ts(500) }, // older than marker
        ],
      },
      documents: {
        orgA: [{ uploaderId: "client1", createdAt: ts(2500) }],
      },
    };
    const markers = { chatLastRead: { orgA: 1000 }, docsLastSeen: { orgA: 1000 } };
    const s = activitySummary(METAS, activity, markers, "me");
    expect(s.total).toBe(2);
    expect(s.orgs).toEqual([
      { orgId: "orgA", orgName: "Acme", chatCount: 1, docCount: 1, latestMs: 2500 },
    ]);
  });

  it("missing marker means everything foreign counts (epoch 0)", () => {
    const activity = {
      messages: { orgB: [{ authorId: "x", createdAt: ts(1) }] },
      documents: {},
    };
    const s = activitySummary(METAS, activity, { chatLastRead: {}, docsLastSeen: {} }, "me");
    expect(s.total).toBe(1);
    expect(s.orgs[0].orgId).toBe("orgB");
  });

  it("null/absent createdAt (pending server write) counts as newest", () => {
    const activity = {
      messages: { orgA: [{ authorId: "x" }] },
      documents: {},
    };
    const markers = { chatLastRead: { orgA: Date.now() + 100000 }, docsLastSeen: {} };
    const s = activitySummary(METAS, activity, markers, "me");
    expect(s.total).toBe(1);
    expect(s.orgs[0].latestMs).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("items exactly AT the marker do not count (strictly newer)", () => {
    const activity = {
      messages: { orgA: [{ authorId: "x", createdAt: ts(1000) }] },
      documents: {},
    };
    const s = activitySummary(
      METAS,
      activity,
      { chatLastRead: { orgA: 1000 }, docsLastSeen: {} },
      "me",
    );
    expect(s.total).toBe(0);
    expect(s.orgs).toEqual([]);
  });

  it("sorts orgs by latest activity, newest first", () => {
    const activity = {
      messages: {
        orgA: [{ authorId: "x", createdAt: ts(100) }],
        orgB: [{ authorId: "x", createdAt: ts(900) }],
      },
      documents: {},
    };
    const s = activitySummary(METAS, activity, { chatLastRead: {}, docsLastSeen: {} }, "me");
    expect(s.orgs.map((o) => o.orgId)).toEqual(["orgB", "orgA"]);
  });

  it("unknown orgIds in activity (meta not loaded yet) are skipped, and empty inputs are safe", () => {
    const activity = { messages: { ghost: [{ authorId: "x", createdAt: ts(5) }] }, documents: {} };
    const s = activitySummary(METAS, activity, { chatLastRead: {}, docsLastSeen: {} }, "me");
    expect(s.total).toBe(0);
    expect(
      activitySummary([], { messages: {}, documents: {} }, { chatLastRead: {}, docsLastSeen: {} }, "me")
        .total,
    ).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/domain/activity.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/domain/activity.js`:

```js
// src/domain/activity.js
// @ts-check
// Scope item 7 (2026-07): pure aggregation behind the staff notification
// bell. Counts per-org chat messages / document uploads strictly newer than
// the caller's per-org surface-visit markers, excluding the user's own
// items. No Firebase imports (domain purity is lint-enforced): createdAt is
// duck-typed via toMillis(); a null/absent createdAt is a pending
// serverTimestamp write and counts as newest.

/**
 * @param {*} item
 * @returns {number}
 */
function itemMillis(item) {
  const t = item && item.createdAt;
  if (t && typeof t.toMillis === "function") return t.toMillis();
  return Number.MAX_SAFE_INTEGER;
}

/**
 * @param {Array<*>} items
 * @param {string} authorField
 * @param {number} markerMs
 * @param {string} selfUid
 * @returns {{ count: number, latestMs: number }}
 */
function countNewer(items, authorField, markerMs, selfUid) {
  let count = 0;
  let latestMs = 0;
  for (const item of items || []) {
    if (!item || item[authorField] === selfUid) continue;
    const ms = itemMillis(item);
    if (ms > markerMs) {
      count += 1;
      if (ms > latestMs) latestMs = ms;
    }
  }
  return { count, latestMs };
}

/**
 * @param {Array<{id: string, name: string}>} orgMetas
 * @param {{ messages: Record<string, Array<*>>, documents: Record<string, Array<*>> }} activity
 * @param {{ chatLastRead: Record<string, number>, docsLastSeen: Record<string, number> }} markers
 * @param {string} selfUid
 * @returns {{ total: number, orgs: Array<{orgId: string, orgName: string, chatCount: number, docCount: number, latestMs: number}> }}
 */
export function activitySummary(orgMetas, activity, markers, selfUid) {
  const orgs = [];
  let total = 0;
  for (const meta of orgMetas || []) {
    const chat = countNewer(
      (activity.messages || {})[meta.id],
      "authorId",
      (markers.chatLastRead || {})[meta.id] || 0,
      selfUid,
    );
    const docs = countNewer(
      (activity.documents || {})[meta.id],
      "uploaderId",
      (markers.docsLastSeen || {})[meta.id] || 0,
      selfUid,
    );
    if (chat.count === 0 && docs.count === 0) continue;
    total += chat.count + docs.count;
    orgs.push({
      orgId: meta.id,
      orgName: meta.name,
      chatCount: chat.count,
      docCount: docs.count,
      latestMs: Math.max(chat.latestMs, docs.latestMs),
    });
  }
  orgs.sort((a, b) => b.latestMs - a.latestMs);
  return { total, orgs };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/domain/activity.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/activity.js tests/domain/activity.test.js
git commit -m "feat(domain): activitySummary aggregation for the notification bell

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Data layer — per-org activity subscriptions replace the dead chat pipeline

**Files:**
- Modify: `src/state.js` (field swap ~lines 23-25 typedef, 68-70 values)
- Modify: `src/main.js` — chat-marker block (~622-644), `stopChatSubscription`/`startChatSubscription`/`ensureChatSubscription` (~652-698), `unreadChatTotal` wrapper (~510-525), the two `ensureChatSubscription` call sites (846 and 4067), `renderDocuments` (marker write)

**Interfaces:**
- Consumes: nothing from Task 1 (wiring happens in Task 3).
- Produces (IIFE-internal, Task 3 consumes): `state.activity = { messages: {}, documents: {} }`; helpers `loadDocsSeen(userId)` → `Record<orgId, iso>` and `docsSeenMillisMap(userId)` / `chatLastReadMillisMap(userId)` → `Record<orgId, number>`; `ensureActivitySubscriptions(user)` called from the same two sites `ensureChatSubscription` was.

- [ ] **Step 1: state.js field swap**

In `src/state.js`, replace the typedef lines

```js
 *   chatMessages: Array<*>,
 *   chatSubscription: (() => void) | null,
 *   chatSubscribedFor: string|null,
```

with

```js
 *   activity: { messages: Record<string, Array<*>>, documents: Record<string, Array<*>> },
 *   bellOpen: boolean,
```

and the value lines

```js
  chatMessages: [], // live feed from Firestore, filtered by role
  chatSubscription: null, // unsubscribe function for the live listener
  chatSubscribedFor: null, // user.id the current subscription is for
```

with

```js
  // Scope item 7 (2026-07): per-org live activity feeds for the bell +
  // unread badges. Keyed by orgId; populated by ensureActivitySubscriptions
  // in main.js (one messages + one documents listener per org, limit 30).
  activity: { messages: {}, documents: {} },
  bellOpen: false, // bell dropdown open state (survives re-renders)
```

- [ ] **Step 2: Replace the subscription machinery in main.js**

Replace the whole block from `function stopChatSubscription() {` through the end of `function ensureChatSubscription(user) { ... }` (currently ~652-698) with:

```js
  // Scope item 7 (2026-07): per-org activity listeners (messages + documents)
  // feeding state.activity for the bell, the chat nav badge, the dashboard
  // unread banner and the tab title. Replaces the single-org
  // startChatSubscription, which was dead for staff — it targeted
  // `user.orgId || state.activeOrgId` and state.activeOrgId never existed
  // (only state.orgId does), so the guard bailed and state.chatMessages
  // stayed empty. Clients get their single org; staff get every org meta.
  // Handles live outside state so they can't serialize; keyed "type:orgId".
  /** @type {Map<string, () => void>} */
  const activityUnsubs = new Map();
  let activitySubscribedFor = /** @type {string|null} */ (null);

  function stopActivitySubscriptions() {
    activityUnsubs.forEach((unsub) => {
      try {
        unsub();
      } catch (_e) {
        /* listener already torn down */
      }
    });
    activityUnsubs.clear();
    activitySubscribedFor = null;
    state.activity = { messages: {}, documents: {} };
  }

  function ensureActivitySubscriptions(user) {
    if (!user) {
      stopActivitySubscriptions();
      return;
    }
    if (!(window.FB && window.FB.currentUser && window.FB.firestore)) return;
    const { db, firestore } = window.FB;
    const orgIds = isStaff(user)
      ? loadOrgMetas().map((o) => o.id)
      : user.orgId
        ? [user.orgId]
        : [];
    // Resubscribe from scratch when the user or the org set changes (org
    // metas stay fresh via _subscribeOrgs, which re-renders on change).
    const key = user.id + "|" + orgIds.slice().sort().join(",");
    if (activitySubscribedFor === key) return;
    stopActivitySubscriptions();
    activitySubscribedFor = key;

    orgIds.forEach((orgId) => {
      [
        { type: "messages", store: state.activity.messages },
        { type: "documents", store: state.activity.documents },
      ].forEach(({ type, store }) => {
        const q = firestore.query(
          firestore.collection(db, "orgs", orgId, type),
          firestore.orderBy("createdAt", "desc"),
          firestore.limit(30),
        );
        activityUnsubs.set(
          `${type}:${orgId}`,
          firestore.onSnapshot(
            q,
            (snap) => {
              const list = [];
              // Stamp orgId client-side: message docs deliberately don't
              // carry it (it lives in the path).
              snap.forEach((d) => list.push({ id: d.id, orgId, ...d.data() }));
              store[orgId] = list;
              render();
            },
            (err) => console.error(`Activity subscription error (${type}:${orgId}):`, err),
          ),
        );
      });
    });
  }
```

Then update the two call sites: `ensureChatSubscription(user)` at ~846 → `ensureActivitySubscriptions(user)`; `ensureChatSubscription(state.fbUser)` at ~4067 → `ensureActivitySubscriptions(state.fbUser)`.

- [ ] **Step 3: Repoint unreadChatTotal**

In the wrapper (~510-525), replace the `const messages = (state.chatMessages || []).map(...)` source line with:

```js
    const messages = Object.values(state.activity.messages).flat().map((m) => {
```

(The `.map` body — the toMillis duck-typing — stays identical. The activity docs carry the client-side `orgId` stamp `_unreadChatTotal`'s staff branch needs.)

Also update the stale comment at ~478 mentioning `state.chatMessages` to say `state.activity.messages`.

- [ ] **Step 4: Documents seen-marker (twin of the chat marker)**

Directly after `lastReadMillis` (~638-641) add:

```js
  // Scope item 7 (2026-07): documents twin of the chat marker — written when
  // the Documents view renders for an org, read by the bell aggregation.
  // Same per-browser localStorage contract as chatLastRead.
  function docsSeenKey(userId) {
    return `baselayers:docsLastSeen:${userId}`;
  }
  function loadDocsSeen(userId) {
    return jget(docsSeenKey(userId), {});
  }
  function markDocsSeenFor(userId, orgId) {
    if (!userId || !orgId) return;
    const m = loadDocsSeen(userId);
    m[orgId] = iso();
    jset(docsSeenKey(userId), m);
  }
```

In `renderDocuments` (search `function renderDocuments`), add as the first statement of the function body (mirroring `renderChat`'s `markChatReadFor` call):

```js
    markDocsSeenFor(user.id, org.id);
```

(Check `renderDocuments`'s parameter names — if they differ from `(user, org)`, adapt.)

- [ ] **Step 5: Verify boot + existing suites**

Run: `npx vitest run tests/views/ tests/ui/ tests/domain/`
Expected: all files PASS (the flake trio may time out in this parallel batch — re-run those three files alone; pass-in-isolation is the bar). The boot tests run with `FB.ready=false` and no `FB.currentUser`, so `ensureActivitySubscriptions` no-ops — any crash here means a wiring mistake.
Also run: `npm run lint` (clean) and confirm `git grep -n "chatMessages\|chatSubscription\|chatSubscribedFor\|ensureChatSubscription\|startChatSubscription\|stopChatSubscription" -- src/` returns NO hits (all references swapped or deleted). `src/domain/unread.js`'s JSDoc param named `chatMessages` is fine (function parameter, not state).

- [ ] **Step 6: Commit**

```bash
git add src/state.js src/main.js
git commit -m "feat(data): per-org activity subscriptions replace the dead chat pipeline

startChatSubscription targeted state.activeOrgId, which never existed, so
state.chatMessages was permanently empty for staff and the chat badge, tab
title and dashboard unread banner were dead. Per-org messages+documents
listeners (limit 30, orgId-stamped) now feed state.activity;
unreadChatTotal repoints to it, reviving all four consumers. New
docsLastSeen localStorage marker mirrors chatLastRead for the Documents
surface.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Bell UI in chrome + wiring + tab title

**Files:**
- Modify: `src/ui/chrome.js` (typedef + destructure + bell in `topright`)
- Modify: `src/main.js` (deps wiring ~980-994; `activitySummary` wrapper near the `unreadChatTotal` wrapper; `updateTabTitleBadge` ~700-706)
- Modify: `styles.css` (bell CSS near the `.mode-toggle` rules)
- Test: `tests/ui/chrome.test.js` (extend)

**Interfaces:**
- Consumes: `activitySummary` from `src/domain/activity.js` (Task 1 shape); IIFE helpers `loadChatLastRead`, `loadDocsSeen`, `loadOrgMetas`, `state.activity`, `state.bellOpen` (Task 2).
- Produces: chrome deps additions — `activitySummary: () => Summary`, `openOrgActivity: (orgId: string, route: "chat"|"documents") => void`, `toggleBell: () => void`, `bellOpen: () => boolean`.

- [ ] **Step 1: Failing chrome tests**

Append to `tests/ui/chrome.test.js` (follow the file's `makeDeps` convention; add the four new stub deps to `makeDeps` so existing tests keep passing — verify whether `makeDeps` merges overrides):

```js
describe("renderTopbar() — notification bell (scope item 7, 2026-07)", () => {
  const SUMMARY = {
    total: 3,
    orgs: [{ orgId: "orgA", orgName: "Acme", chatCount: 2, docCount: 1, latestMs: 5 }],
  };

  it("renders the bell with a count badge for staff", () => {
    const deps = makeDeps();
    deps.activitySummary = () => SUMMARY;
    const { renderTopbar } = createChrome(deps);
    const el = renderTopbar({ role: "internal", name: "L", email: "l@x.com" });
    const bell = el.querySelector(".bell-btn");
    expect(bell).not.toBeNull();
    expect(bell?.getAttribute("aria-label")).toBe("Activity notifications");
    expect(el.querySelector(".bell-btn .count-badge")?.textContent).toBe("3");
  });

  it("hides the badge at zero and never renders for clients", () => {
    const deps = makeDeps();
    deps.activitySummary = () => ({ total: 0, orgs: [] });
    const { renderTopbar } = createChrome(deps);
    const staffEl = renderTopbar({ role: "internal", name: "L", email: "l@x.com" });
    expect(staffEl.querySelector(".bell-btn")).not.toBeNull();
    expect(staffEl.querySelector(".bell-btn .count-badge")).toBeNull();
    const clientEl = renderTopbar({ role: "client", name: "C", email: "c@x.com" });
    expect(clientEl.querySelector(".bell-btn")).toBeNull();
  });

  it("caps the badge display at 30+", () => {
    const deps = makeDeps();
    deps.activitySummary = () => ({ total: 31, orgs: [] });
    const { renderTopbar } = createChrome(deps);
    const el = renderTopbar({ role: "internal", name: "L", email: "l@x.com" });
    expect(el.querySelector(".bell-btn .count-badge")?.textContent).toBe("30+");
  });

  it("open panel lists org rows and clicking one calls openOrgActivity", () => {
    const calls = /** @type {Array<*>} */ ([]);
    const deps = makeDeps();
    deps.activitySummary = () => SUMMARY;
    deps.bellOpen = () => true;
    deps.openOrgActivity = (/** @type {string} */ orgId, /** @type {string} */ route) =>
      calls.push([orgId, route]);
    const { renderTopbar } = createChrome(deps);
    const el = renderTopbar({ role: "internal", name: "L", email: "l@x.com" });
    const panel = el.querySelector(".bell-panel");
    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain("Acme");
    expect(panel?.textContent).toContain("2 new messages");
    expect(panel?.textContent).toContain("1 new document");
    const chatRow = /** @type {HTMLButtonElement} */ (
      Array.from(panel?.querySelectorAll("button.bell-row") || []).find((b) =>
        b.textContent?.includes("message"),
      )
    );
    chatRow.click();
    expect(calls).toEqual([["orgA", "chat"]]);
  });

  it("open panel with no activity shows the empty state", () => {
    const deps = makeDeps();
    deps.activitySummary = () => ({ total: 0, orgs: [] });
    deps.bellOpen = () => true;
    const { renderTopbar } = createChrome(deps);
    const el = renderTopbar({ role: "internal", name: "L", email: "l@x.com" });
    expect(el.querySelector(".bell-panel")?.textContent).toContain("No new activity");
  });

  it("bell click calls toggleBell", () => {
    let toggled = 0;
    const deps = makeDeps();
    deps.activitySummary = () => ({ total: 0, orgs: [] });
    deps.toggleBell = () => {
      toggled += 1;
    };
    const { renderTopbar } = createChrome(deps);
    const el = renderTopbar({ role: "internal", name: "L", email: "l@x.com" });
    /** @type {HTMLButtonElement} */ (el.querySelector(".bell-btn")).click();
    expect(toggled).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/ui/chrome.test.js`
Expected: new describe FAILs (no `.bell-btn`); existing tests still pass once `makeDeps` gains default stubs (`activitySummary: () => ({ total: 0, orgs: [] })`, `bellOpen: () => false`, `toggleBell: () => {}`, `openOrgActivity: () => {}`).

- [ ] **Step 3: Implement chrome.js**

Extend the `ChromeDeps` typedef and destructure with the four new entries. In `renderTopbar`, inside the existing `if (!isClient) {` block in `topright`, BEFORE `modeToggle`, insert:

```js
      // Scope item 7 (2026-07): staff notification bell — new chat messages
      // and document uploads across every org, attributed per client.
      const summary = activitySummary();
      const bellWrap = h("div", { class: "bell-wrap" });
      const bellBtn = h(
        "button",
        {
          class: "bell-btn",
          "aria-label": "Activity notifications",
          "aria-expanded": bellOpen() ? "true" : "false",
          onclick: (e) => {
            e.stopPropagation();
            toggleBell();
          },
        },
        [
          (() => {
            // Inline SVG bell (no-emojis-in-source convention).
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("viewBox", "0 0 16 16");
            svg.setAttribute("width", "16");
            svg.setAttribute("height", "16");
            svg.setAttribute("aria-hidden", "true");
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute(
              "d",
              "M8 1.5a4.5 4.5 0 0 0-4.5 4.5v2.6L2.3 11a.7.7 0 0 0 .6 1h10.2a.7.7 0 0 0 .6-1l-1.2-2.4V6A4.5 4.5 0 0 0 8 1.5Zm-1.6 11.3a1.7 1.7 0 0 0 3.2 0Z",
            );
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", "currentColor");
            path.setAttribute("stroke-width", "1.3");
            path.setAttribute("stroke-linejoin", "round");
            svg.appendChild(path);
            return /** @type {*} */ (svg);
          })(),
          summary.total > 0
            ? h("span", { class: "count-badge" }, summary.total > 30 ? "30+" : String(summary.total))
            : null,
        ].filter(Boolean),
      );
      bellWrap.appendChild(bellBtn);

      if (bellOpen()) {
        const panel = h("div", { class: "bell-panel", onclick: (e) => e.stopPropagation() });
        if (summary.orgs.length === 0) {
          panel.appendChild(h("div", { class: "bell-empty" }, "No new activity."));
        } else {
          summary.orgs.forEach((o) => {
            panel.appendChild(h("div", { class: "bell-org" }, o.orgName));
            if (o.chatCount > 0) {
              panel.appendChild(
                h(
                  "button",
                  { class: "bell-row", onclick: () => openOrgActivity(o.orgId, "chat") },
                  `${o.chatCount} new message${o.chatCount === 1 ? "" : "s"}`,
                ),
              );
            }
            if (o.docCount > 0) {
              panel.appendChild(
                h(
                  "button",
                  { class: "bell-row", onclick: () => openOrgActivity(o.orgId, "documents") },
                  `${o.docCount} new document${o.docCount === 1 ? "" : "s"}`,
                ),
              );
            }
          });
        }
        bellWrap.appendChild(panel);
      }
      topright.appendChild(bellWrap);
```

Note: `h()` children take real DOM nodes, so the `createElementNS` IIFE composes fine. The typedef entries:

```js
 *   activitySummary: () => { total: number, orgs: Array<{orgId: string, orgName: string, chatCount: number, docCount: number, latestMs: number}> },
 *   bellOpen: () => boolean,
 *   toggleBell: () => void,
 *   openOrgActivity: (orgId: string, route: string) => void,
```

- [ ] **Step 4: Wire deps + wrapper + tab title in main.js**

Near the `unreadChatTotal` wrapper (~510), add (import `activitySummary as _activitySummary` from `./domain/activity.js` in the domain import block at the top — search `from "./domain/unread.js"` and add the import beside it):

```js
  // Scope item 7 (2026-07): bell aggregation wrapper — injects live org
  // metas, the activity store and the per-browser surface-visit markers.
  const bellSummary = () => {
    const user = currentUser();
    if (!user) return { total: 0, orgs: [] };
    /** @type {Record<string, number>} */
    const chatMs = {};
    const chatIso = loadChatLastRead(user.id);
    Object.keys(chatIso).forEach((k) => (chatMs[k] = new Date(chatIso[k]).getTime()));
    /** @type {Record<string, number>} */
    const docsMs = {};
    const docsIso = loadDocsSeen(user.id);
    Object.keys(docsIso).forEach((k) => (docsMs[k] = new Date(docsIso[k]).getTime()));
    return _activitySummary(
      loadOrgMetas(),
      state.activity,
      { chatLastRead: chatMs, docsLastSeen: docsMs },
      user.id,
    );
  };
```

(Place it AFTER the chat-marker helpers if function hoisting doesn't cover the arrow-function reference — `loadChatLastRead`/`loadDocsSeen` are function declarations, hoisted, so placement near the other wrappers is safe.)

In the `createChrome` deps (~980-994), add:

```js
    activitySummary: bellSummary,
    bellOpen: () => state.bellOpen,
    toggleBell: () => {
      state.bellOpen = !state.bellOpen;
      render();
    },
    openOrgActivity: (orgId, route) => {
      state.bellOpen = false;
      state.orgId = orgId;
      setRoute(route);
    },
```

(Check what `setRoute` does — if it doesn't call `render()`, add `render()` after it, matching the org-select handler's pattern at chrome.js ~178-182.)

Close-on-outside-click: in `updateTabTitleBadge`'s vicinity or the main `render()` function, add a one-time document-level listener (module scope, registered once):

```js
  // Bell panel closes on any outside click (the panel stopPropagation()s
  // its own clicks; the bell button toggles itself).
  document.addEventListener("click", () => {
    if (state.bellOpen) {
      state.bellOpen = false;
      render();
    }
  });
```

Place this beside other one-time listeners (search `document.addEventListener` in main.js for the convention; if none exists at module scope in the IIFE, put it just before the initial `render()` call at the bottom).

`updateTabTitleBadge` (~700-706): replace the `unreadChatTotal` line:

```js
    const unread = isStaff(user) ? bellSummary().total : 0;
```

- [ ] **Step 5: CSS**

In `styles.css`, after the `.mode-toggle` rule block (search `.mode-toggle`), insert:

```css
/* Notification bell (scope item 7, 2026-07) — staff-only topbar control. */
.bell-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.bell-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  color: var(--ink-2);
  cursor: pointer;
}
.bell-btn:hover {
  border-color: var(--brand);
  color: var(--ink);
}
.bell-btn .count-badge {
  position: absolute;
  top: -6px;
  right: -6px;
}
.bell-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 260px;
  max-height: 320px;
  overflow-y: auto;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  padding: 8px;
  z-index: 50;
}
.bell-org {
  font-family: var(--font-display);
  font-size: 12px;
  letter-spacing: 0.06em;
  color: var(--brand);
  padding: 6px 8px 2px;
}
.bell-row {
  display: block;
  width: 100%;
  text-align: left;
  padding: 6px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ink-2);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
}
.bell-row:hover {
  background: var(--surface-muted);
  color: var(--ink);
}
.bell-empty {
  padding: 10px 8px;
  color: var(--ink-3);
  font-size: 13px;
}
```

(Verify `--shadow-sm`, `--radius`, `--surface-muted`, `--line`, `--brand`, `--ink*` variables all exist — they are used throughout styles.css.)

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run tests/ui/chrome.test.js tests/domain/activity.test.js tests/views/diagnostic.test.js`
Expected: PASS. The diagnostic boot test proves main.js wiring introduced no boot crash (it renders the topbar for a staff session — the bell renders with total 0 because `FB.ready=false` leaves `state.activity` empty).

- [ ] **Step 7: Commit**

```bash
git add src/ui/chrome.js src/main.js styles.css tests/ui/chrome.test.js
git commit -m "feat(ui): staff notification bell with per-org chat and document activity

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Verification + stacked PR

- [ ] **Step 1: Local gate**

```bash
npm run lint
npx vitest run tests/ui/ tests/views/ tests/domain/
```
Lint clean; all files pass (flake trio: pass-in-isolation bar). `npm run typecheck`: only the pre-existing untracked-file error.

- [ ] **Step 2: Push + PR**

```bash
git push -u origin feat/notification-bell
gh pr create --base feat/scope-ux-polish --title "feat: staff notification bell — cross-org chat + document activity" --body "..."
```

Stacked on PR #81 (retarget after it merges). Body: scope item 7, the `state.activeOrgId` substrate bug it fixes, per-browser marker limitation, test evidence, standard footer. Request review from lukebadiali.

---

## Self-Review (done at plan time)

- Spec coverage: domain fn (T1), subscriptions + repoint + markers + deletions (T2), bell UI + wiring + tab title + CSS (T3), gate/PR (T4). Staff-only bell enforced in chrome's existing `!isClient` block; client data path preserved via all-users subscriptions. ✓
- Placeholders: none; CAUTION-style verify notes where file internals may differ (makeDeps shape, renderDocuments params, setRoute render behavior). ✓
- Type consistency: Summary shape identical in domain return, chrome typedef, and tests; marker maps are epoch-ms Records at the domain boundary with ISO→ms conversion in the main.js wrapper; `openOrgActivity(orgId, route)` arity matches stub, wiring, and row onclick. ✓
