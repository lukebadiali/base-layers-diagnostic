# Coding Conventions

**Analysis Date:** 2026-05-03

## Naming Patterns

**Files:**

- Lowercase, hyphen-free, single-word filenames at the repo root: `app.js`, `styles.css`, `index.html`, `firebase-init.js` (only file with a hyphen).
- Data files live in a flat `data/` directory and use lowercase nouns: `data/pillars.js`.
- Assets are lowercase with hyphens permitted: `assets/logo.png`, `assets/logo-blue.png`.
- HTML/CSS/JS are top-level — no `src/`, `dist/`, or `public/` directory.

**Functions:**

- `camelCase` everywhere, regardless of role (private helpers, exported handlers, render functions). Example from `app.js`:

```js
function loadOrgMetas() { return jget(K.orgs, []); }
function pillarScoreForRound(org, roundId, pillarId) { ... }
function renderDashboard(user, org) { ... }
```

- Render functions for routed views are prefixed with `render`: `renderAuth`, `renderTopbar`, `renderFooter`, `renderDashboard`, `renderDiagnosticIndex`, `renderPillar`, `renderActions`, `renderEngagement`, `renderReport`, `renderDocuments`, `renderChat`, `renderRoadmap`, `renderFunnel`, `renderAdmin` (all in `app.js`).
- Modal-opening helpers are prefixed with `open`: `openActionModal`, `openInviteClientModal`, `openChangePasswordModal`, `openSetOrgPassphrase`, `openChangePassphrase`.
- Data-mutating helpers are CRUD verbs first: `loadX`/`saveX`/`upsertX`/`deleteX`/`createX` (e.g. `loadUsers`, `saveOrg`, `upsertUser`, `deleteOrg`, `createOrg` in `app.js` lines 84-141).
- Firebase sync helpers are prefixed with `cloud`: `cloudPushOrg`, `cloudPushUser`, `cloudDeleteOrg`, `cloudDeleteUser`, `cloudFetchAllOrgs`, `cloudFetchAllUsers` (`app.js` lines 2607-2678).
- Predicates begin with `is`/`has`: `isAllowedInternalEmail`, `isClientView`, `orgHasClientPassphrase`, `fbReady`.

**Variables:**

- `camelCase` for locals and parameters: `roundId`, `currentRoundId`, `prevRoundId`, `byUser`, `respUsers`.
- `SCREAMING_SNAKE_CASE` for module-level constants used as configuration: `INTERNAL_ALLOWED_EMAILS`, `INTERNAL_PASSWORD_HASH`, `BASE_TAB_TITLE` (`app.js` lines 406, 443-444).
- Globals exposed on `window` are SCREAMING (`window.BASE_LAYERS` in `data/pillars.js` line 4) or capitalised acronyms (`window.FB` in `firebase-init.js` line 33).
- Single-letter loop/temp names are common and accepted: `s` for score, `o` for org, `u` for user, `m` for message/meta, `p` for pillar, `c` for comment, `q` for query, `d` for date/snapshot, `e` for event/error.
- Storage-key strings live on the `K` object with short property names that describe the entity: `K.users`, `K.session`, `K.settings`, `K.orgs`, `K.mode`, `K.org(id)` (`app.js` lines 18-27).

**Types:**

- No type system. Plain object literals are the de facto data model. There is no JSDoc type annotation on any function in `app.js`.
- Object shapes are documented inline where the object is first constructed — see the `org` literal in `createOrg` (`app.js` lines 122-135) and the `user` literal in `renderFirstRunSetup` (`app.js` lines 995-1001).

## Code Style

**Formatting:**

- No formatter is configured. There is no `.prettierrc`, `.editorconfig`, ESLint config, Biome config, or `package.json` (and therefore no formatter scripts).
- Observed style: 2-space indentation, double-quoted strings, semicolons present, arrow functions for short callbacks, named `function` declarations for module-level helpers.
- One-line getters/setters are placed on a single line:

```js
function loadUsers() {
  return jget(K.users, []);
}
function saveUsers(u) {
  jset(K.users, u);
}
```

- Sign-posted columns occasionally use extra spaces for visual alignment:

```js
function loadOrgMetas() {
  return jget(K.orgs, []);
}
function saveOrgMetas(m) {
  jset(K.orgs, m);
}
function loadOrg(id) {
  return jget(K.org(id), null);
}
```

(`app.js` lines 104-106). Match this when adding sibling functions.

**Linting:**

- No linter configured. Files declare `"use strict";` at the IIFE boundary (`app.js` line 12) which is the only enforcement.

## Import Organization

**Order:**

- `app.js` imports nothing. It reads globals (`window.BASE_LAYERS`, `window.FB`, `window.localStorage`, `window.Chart`) populated by other scripts loaded earlier in `index.html`.
- Script load order in `index.html` (lines 22-24) is the de facto dependency graph:
  1. `firebase-init.js` (ES module, populates `window.FB`)
  2. `data/pillars.js` (populates `window.BASE_LAYERS`)
  3. `app.js` (consumes both, deferred)
- Cache-busting query string `?v=46` on every script tag — bump it when shipping behavioural changes so Cloudflare/browser caches refresh.

**Path Aliases:**

- None.

**ES module imports** appear only in `firebase-init.js`, importing directly from Google's CDN URLs:

```js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  limit,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
```

Pin the SDK version in the URL when adding new imports — never use a floating tag.

## Module Pattern

The entire app is a single IIFE in `app.js`:

```js
(function () {
  "use strict";
  const DATA = window.BASE_LAYERS;
  const LS   = window.localStorage;
  // ... ~4,090 lines of helpers and render functions ...
  function init() { ... }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
```

Nothing is exported. Add new functions inside the IIFE — do not introduce ES modules in `app.js` (it is loaded with a non-module `<script defer>` in `index.html` line 24).

## DOM Construction

The codebase uses a single `h(tag, attrs, children)` helper (`app.js` lines 610-626) instead of templating libraries. Behaviour:

- Keys starting with `on` and a function value are wired with `addEventListener`: `onclick`, `onchange`, `onkeydown`, etc.
- `class` becomes `className`; `html` sets `innerHTML` (use sparingly — observed only for trusted static markup).
- `false` / `null` / `undefined` attribute values are skipped, so conditional attributes can be inlined.
- Children may be elements, strings, numbers, arrays of those, or falsy values (filtered out).

Idiomatic usage:

```js
const btn = h(
  "button",
  {
    class: "nav-btn" + (state.route === route ? " active" : ""),
    "data-route": route,
    onclick: () => setRoute(route),
  },
  label,
);
```

For conditional children, build an array and call `.filter(Boolean)`:

```js
const actions = h("div", { style: "display:flex; gap:6px;" }, [
  canDelete ? h("button", { ... }, "Delete") : null
].filter(Boolean));
```

The two short DOM helpers are `$` (single querySelector) and `$$` (querySelectorAll → array) — `app.js` lines 608-609.

## Re-render Strategy

There is no diffing. Every state change calls the global `render()` (`app.js` line 694) which:

1. Destroys any active Chart.js instance.
2. Empties `#app.innerHTML`.
3. Rebuilds the topbar, the routed view, and the footer from scratch.

Match this pattern when adding new interactivity:

```js
onclick: () => {
  state.expandedPillars.add(p.id);
  render();
};
```

Do not try to update individual nodes in place — rely on the full re-render. The exception is real-time Firestore listeners (Documents, Chat, Roadmap, Funnel) which mutate a single subtree (`listBody.innerHTML = ""; ...`) rather than calling `render()`, to avoid re-running the listener on every keystroke.

## Event Handling

- Always attach via `addEventListener` (or via the `h()` helper's `on*` shorthand). Never set inline `onclick=""` attributes in HTML.
- For form submission via Enter key, attach `keydown` to each input and check `e.key === "Enter"`:

```js
[email, team, pass, passConfirm].forEach((el) =>
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doClientLogin();
  }),
);
```

(`app.js` lines 1110-1112).

- For click-outside-to-close menus, register a one-shot listener on `document` after a `setTimeout(..., 10)` to avoid the originating click triggering it:

```js
setTimeout(() => {
  document.addEventListener("click", handler, { once: true });
}, 10);
```

(`app.js` lines 900-903).

- Stop event propagation on nested clickable areas with `e.stopPropagation()` (e.g. tile-toggle buttons inside clickable tiles, `app.js` line 1366).

## Error Handling

**Patterns:**

- `try/catch` around every `await` to network/Firebase. Errors are logged with `console.error("Context: ", e)` and the operation silently no-ops. Example (`app.js` lines 2613-2620):

```js
cloudSaveTimers["org:" + org.id] = setTimeout(async () => {
  try {
    const { db, firestore } = window.FB;
    await firestore.setDoc(firestore.doc(db, "orgs", org.id), org);
  } catch (e) {
    console.error("Cloud push org failed:", e);
  }
}, 400);
```

- For user-initiated network actions where silence would be confusing, fall through to `alert()` (`app.js` line 2999): `alert("Couldn't send: " + (e.message || e));`. Use this only for actions the user just triggered explicitly.
- For non-critical guard try/catch (e.g. destroying a chart that may already be gone), use bare `catch {}` to swallow:

```js
if (state.chart) {
  try {
    state.chart.destroy();
  } catch {}
  state.chart = null;
}
```

(`app.js` line 695). Acceptable for cleanup; do not use for network calls.

- Custom in-app dialogs use `confirmDialog(title, message, onOk, okLabel)` (`app.js` lines 674-683), not `window.confirm()`. Use `promptText(title, placeholder, onSubmit, initial)` instead of `window.prompt()`.
- Inline form errors append to a per-form `errBox` div (`app.js` lines 988-993, 3945-3947). Errors are styled by the `.auth-error` class.

## Logging

**Framework:** `console` only. No log library, no log levels beyond `console.error`.

**Patterns:**

- Errors only: `console.error("Cloud push org failed:", e);`. There are no `console.log` or `console.warn` calls in production paths.
- Always prefix the message with the operation name + ":". This makes the log searchable when debugging in DevTools.

## Comments

**When to Comment:**

- Top-of-file banner with the project name and a one-line summary. Use `/* === ... === */` ASCII bars (`app.js` line 1, `styles.css` line 1).
- Section dividers inside `app.js` use one of two styles:
  - Short helpers: `// ---------- Settings ----------` (`app.js` line 79)
  - Major view sections: `// ================================================================` followed by `// SECTION NAME` (`app.js` lines 753-755). Used for top-level routed views and subsystems.
- Inline comments are reserved for "why" and gotchas, not "what":

```js
// trivial hashing for demo purposes (NOT secure — just to avoid plaintext storage)
async function hashString(s) { ... }
```

(`app.js` line 413). Match this — the comment explains the security posture, not the code shape.

- v1 → v2 migration is annotated with `// v1 compat` markers (`app.js` line 26).
- Cache-busting decisions and architectural choices are annotated at the call site rather than in a separate doc:

```js
// localStorage is the working cache; Firestore is the source of truth
// across devices. Pushes are debounced; pulls happen once on app boot.
```

(`app.js` lines 2602-2606).

**JSDoc/TSDoc:**

- Not used. No `/** @param */` annotations exist anywhere in the codebase. Do not introduce them — they would be inconsistent with everything else.

## Function Design

**Size:**

- Helpers are small (1-15 lines) and one-shot.
- Render functions are large (50-300 lines) because they construct the entire view inline. This is intentional: each `render*` function is a self-contained, top-to-bottom description of a screen.

**Parameters:**

- Positional, with defaults inline: `function addAction(createdBy, pillarId, title, { owner = "", due = "", internal = false } = {}) { ... }` (`app.js` line 1954). Use destructured options objects only for genuinely optional flags.
- Render functions take `(user, org, ...)` consistently — match this signature when adding a new route.

**Return Values:**

- Helpers return a primitive, plain object, or DOM node directly. There is no Promise wrapping unless the function is genuinely async (in which case `async` is on the declaration).
- Render functions return a single DOM node (the root of the view) which the router appends to `<main>` (`app.js` lines 729-751).

## Data Conventions

**Object IDs:**

- All entity IDs are generated by `uid(prefix)` (`app.js` lines 30-31), which produces strings like `org_abc1234de`, `r_xyz9876fg`, `u_...`, `c_...`, `act_...`, `doc_...`. Match the prefix to the entity type.

```js
const uid = (p = "") =>
  p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
```

**Timestamps:**

- ISO 8601 strings via `iso()` (`app.js` line 33: `new Date().toISOString()`). Stored as plain strings inside org/user records.
- Firestore-native timestamps (`firestore.serverTimestamp()`) are used only for cloud-only collections (messages, documents, roadmaps, funnels). When reading them, use the optional-chaining bridge: `m.createdAt?.toMillis?.()` or `m.createdAt?.toDate?.()` (`app.js` lines 351-353, 2949).

**Score scale:**

- 1-10 confidence scale, normalised to 0-100 for display. The pillar scoring function divides by `meta.scale` and multiplies by 100 (`app.js` lines 215-217).
- Status thresholds are centralised in `pillarStatus(score)` (`app.js` lines 228-233): `≤50 red`, `≤75 amber`, `>75 green`, `null gray`. Use these labels everywhere — do not invent new bands.

**localStorage shape:**

- All keys are prefixed `baselayers:` (`app.js` lines 18-27). Always namespace new keys with this prefix to avoid collisions with other apps on the same origin.
- Wrap reads with `jget(key, fallback)` and writes with `jset(key, value)` (`app.js` lines 73-77). These handle JSON parse errors by returning the fallback — never call `LS.getItem`/`setItem` directly.

## CSS Organisation

**File:** Single file `styles.css` (~2,150 lines).

**Approach:** Hand-written, BEM-flavoured classnames. No utility framework (no Tailwind), no CSS-in-JS, no preprocessor.

**Section structure:** Marked with banner comments:

```css
/* ------------------- Top bar ------------------- */
.topbar { ... }
.brand { ... }
```

Order roughly follows the visual hierarchy: tokens → layout primitives → topbar/footer → views (dashboard, pillars, comments, chat, roadmap, funnel) → modals → media queries.

**Design tokens:** Centralised in `:root` at the top of `styles.css` (lines 7-49). Always reference variables — never hardcode brand colours:

```css
--brand: #579ec0;
--brand-2: #4a8aab;
--ink: #2f2f2f;
--red: #c0392b;
--amber: #d98e00;
--green: #2f8a4f;
--radius: 14px;
--radius-sm: 8px;
--shadow-sm: 0 1px 2px rgba(16, 24, 40, 0.06), ...;
--font-sans: "Aptos Light", "Aptos", "Inter", ...;
--font-display: "Bebas Neue", ...;
```

**Naming convention:**

- Block: `.tile`, `.card`, `.topbar`, `.user-chip`.
- Element via descendant selector or hyphenated suffix: `.tile .num`, `.tile .name`, `.tile-toggle`, `.tile-expansion`.
- Modifier as second class: `.tile.expanded`, `.btn.ghost`, `.btn.secondary`, `.btn.sm`, `.summary-cell.red`, `.badge.amber`.
- Status-driven colour mods piggyback on three globally-known status names: `.red`, `.amber`, `.green`, `.gray` (matches the JS `pillarStatus` output).

**Inline styles:**

- Frequently used for one-off layout via the `style: "..."` attribute in `h()` calls. Acceptable for layout grids, gaps, max-widths, and one-off text styling. Reach for a CSS class only if the same combination appears in 3+ places.

**Print rules:**

- `@media print` block at `styles.css` lines 55-65 disables print output for client accounts (`body.client-view > *`). Print is allowed for internal users so they can save the report as PDF.

**Animations:**

- Defined as named `@keyframes` near their consumer. Only one (`exp-in`, `styles.css` lines 583-586). Keep duration ≤ 200ms to match the existing snappy feel.

## Async / Promise Conventions

- Use `async`/`await`. There are no `.then()` chains in `app.js`.
- Top-level `await` is not available (the IIFE is not an async function). For init, use a synchronous chain that ends with `render()`, and let async listeners catch up (`app.js` lines 4084-4096).
- Debounced cloud writes use a `setTimeout` keyed by entity id, cleared on each call:

```js
const cloudSaveTimers = {};
function cloudPushOrg(org) {
  if (!fbReady() || !org || !org.id) return;
  clearTimeout(cloudSaveTimers["org:" + org.id]);
  cloudSaveTimers["org:" + org.id] = setTimeout(async () => { ... }, 400);
}
```

(`app.js` lines 2609-2621). Apply the same 400 ms debounce to any new write-on-keystroke flow.

## Defensive Defaults

- Always coalesce missing collections before iterating: `(org.responses || {})[roundId] || {}` (`app.js` line 209). Org/user records may have been created before a field was introduced, so never assume nested keys exist.
- Always provide a fallback to `jget`: `jget(K.users, [])`, `jget(K.session, null)`. The helper itself returns `fallback` on any JSON-parse failure.
- When mapping over a list that may be missing, use `(arr || []).map(...)` or `(arr || []).forEach(...)`.

---

_Convention analysis: 2026-05-03_
