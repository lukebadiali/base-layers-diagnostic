# Architecture

**Analysis Date:** 2026-05-03

## Pattern Overview

**Overall:** Single-page, single-IIFE vanilla-JS web app with imperative DOM rendering, `localStorage` as the working cache and Firestore as the cross-device source of truth.

**Key Characteristics:**

- One closure, one render. The whole app lives inside a single IIFE in `app.js` (line 11: `(function () { "use strict"; ...`). All state, helpers and view functions are private to that closure; nothing is exported.
- Imperative `render()` re-mount. There is no virtual DOM, no diffing, no component framework. Each `render()` call clears `#app` (`app.js` line 700: `app.innerHTML = ""`), rebuilds the entire shell and current route via the `h(tag, attrs, children)` helper (`app.js` lines 610-626) and reattaches event listeners.
- Role-driven view gating. Two real roles (`internal`, `client`) plus an "internal-as-client preview" mode (`app.js` lines 595-605, `effectiveRole` / `isClientView`). Most render paths branch on these flags rather than living in separate component files.
- Two-tier persistence. Every write goes to `localStorage` synchronously via `jset` (line 77) and is then debounced-pushed to Firestore via `cloudPushOrg` / `cloudPushUser` (lines 2610-2634). Reads are served from `localStorage`; cloud is pulled once at boot via `syncFromCloud` (line 2684).
- Real-time collaboration is bolted on per-feature. Chat, documents, roadmaps and funnel each open their own Firestore listener inside their render function rather than going through a central data store.

## Layers

**Bootstrap layer:**

- Purpose: Static page boot, third-party SDK load, Firebase auth handshake.
- Location: `index.html`, `firebase-init.js`.
- Contains: Script tags for Chart.js (CDN, deferred), `firebase-init.js` (ES module), `data/pillars.js` (global assignment), `app.js` (deferred).
- Depends on: Browsers with ES module support; CDN reachability for Firebase + Chart.js + Google Fonts.
- Used by: `app.js` (consumes `window.FB`, `window.BASE_LAYERS`, `window.Chart`).

**Data / domain layer:**

- Purpose: Static framework content (the ten pillars, principles, engagement stages, score labels).
- Location: `data/pillars.js`.
- Contains: A single global `window.BASE_LAYERS` object (`data/pillars.js` line 4) with `principles[]`, `engagementStages[]`, `scoreLabels{}`, `pillars[]`. Each pillar carries `id`, `name`, `shortName`, `tagline`, `dashDescription`, `dashAchieve`, `overview`, `components[]`, `objectives[]`, `diagnostics[]`, `whatWeDo[]`, `outcomes[]`.
- Depends on: Nothing.
- Used by: All scoring, render and report functions in `app.js` via `const DATA = window.BASE_LAYERS` (line 14).

**Storage / persistence layer:**

- Purpose: Local cache + cloud mirror for users, orgs, sessions and settings.
- Location: `app.js` lines 17-141 (`localStorage`-backed CRUD), lines 2602-2720 (Firestore mirror + boot pull).
- Contains: Storage key map `K` (line 18), JSON helpers `jget`/`jset` (lines 73-77), and namespaced loaders/savers: `loadUsers`/`saveUsers`/`upsertUser`/`deleteUser`, `loadOrgMetas`/`saveOrgMetas`, `loadOrg`/`saveOrg`/`createOrg`/`deleteOrg`, plus debounced `cloudPush*`/`cloudDelete*` and `cloudFetchAllOrgs`/`cloudFetchAllUsers`/`syncFromCloud`.
- Depends on: `window.localStorage`, `window.FB.firestore` (Firestore modular API exposed by `firebase-init.js`).
- Used by: Auth, render, mutation helpers (`setResponse`, `addAction`, `addComment`, etc.).

**Domain / scoring layer:**

- Purpose: Stateless calculations over org responses.
- Location: `app.js` lines 167-313.
- Contains: `questionMeta` (line 170), `deriveAnchors` (line 188), `pillarScoreForRound` (line 206), `pillarScore` / `pillarStatus` (lines 224-233), `respondentsForRound`, `answeredCount`, `userCompletionPct`, `orgSummary`, `topConstraints`, plus comments helpers (`addComment`, `commentsFor`, `unreadCountForPillar`, `markPillarRead`).
- Depends on: `DATA.pillars`, the org JSON tree.
- Used by: All view functions that show numbers, badges or progress.

**Auth / session layer:**

- Purpose: Sign-in, sign-out, role gating, password hashing.
- Location: `app.js` lines 322-486.
- Contains: `currentSession`, `currentUser`, `signIn`, `signOut`; SHA-256 helper `hashString` (line 414); `setInternalPassphrase` / `verifyInternalPassphrase`; the hard-coded `INTERNAL_ALLOWED_EMAILS` allowlist + `INTERNAL_PASSWORD_HASH` (lines 443-444); `setOrgClientPassphrase` / `verifyOrgClientPassphrase`; per-user `setUserPassword` / `verifyUserPassword`; chat unread tracking helpers (lines 336-405).
- Depends on: Storage layer, `crypto.subtle`.
- Used by: `renderSignInForm` (line 1028), top-level `render()` gate (line 705).

**View / presentation layer:**

- Purpose: All UI. Pure DOM-building functions named `render*`.
- Location: `app.js` lines 691-3800. Each major route owns one `renderX` function:
  - `renderTopbar` (line 756), `renderFooter` (line 914)
  - `renderAuth` / `renderSignInForm` / `renderFirstRunSetup` (lines 951-1184)
  - `renderNoOrg` (line 1189)
  - `renderDashboard` + `renderOperationalExcellenceTile` + `renderRoundBar` + `drawRadar` (lines 1215-1591)
  - `renderDiagnosticIndex` (line 1592), `renderPillar` + `renderQuestion` + `renderTeamResponses` + `renderScoreBlock` + `sidePanel` + `renderComments` (lines 1659-1953)
  - `renderActions` + `renderActionRow` + `openActionModal` (lines 1981-2122)
  - `renderEngagement` (line 2123)
  - `renderReport` + `drawReportDonut` + `reportRow` (lines 2226-2408)
  - `renderAdmin` (line 2413)
  - `renderDocuments` (line 2734)
  - `renderChat` (line 2878)
  - `renderRoadmap` + `openBulkOutcomeModal` (lines 3045-3324)
  - `renderFunnel` (line 3325)
  - Modals: `openInviteClientModal`, `openInviteInstructionsModal`, `openChangePasswordModal`, `openSetOrgPassphrase`, `openChangePassphrase` (lines 3801-4015)
- Depends on: All other layers + the `h` helper (line 610), `modal`/`promptText`/`confirmDialog` (lines 629-684).
- Used by: `render()` -> `renderRoute()` (lines 694-751).

**Sync / cloud feature layer:**

- Purpose: Real-time multi-user features that bypass `localStorage`.
- Location: `app.js` lines 2722-2876 (Documents), 2878-3026 (Chat), 3028-3267 (Roadmap), 3325-3800 (Funnel + Funnel comments + KPIs).
- Contains: Per-feature Firestore subscriptions using `onSnapshot`. Documents -> `documents` collection; Chat -> `messages` collection (also subscribed app-wide via `startChatSubscription` for unread badges); Roadmap -> `roadmaps/{orgId}` document; Funnel -> `funnels/{orgId}` document; Funnel comments -> `funnelComments` collection.
- Depends on: `window.FB.firestore`, `window.FB.storage`, `window.FB.storageOps` (Storage SDK ops).
- Used by: Their respective render functions only.

## Data Flow

**Boot flow:**

1. Browser loads `index.html`, which runs `firebase-init.js` (ES module).
2. `firebase-init.js` initialises the Firebase app, creates `db`/`auth`/`storage`, exposes `window.FB`, then calls `signInAnonymously(auth)` and waits for `onAuthStateChanged`. On the first auth event it sets `window.FB.currentUser` and dispatches a `firebase-ready` event (`firebase-init.js` lines 44-50).
3. `data/pillars.js` runs synchronously and assigns `window.BASE_LAYERS`.
4. `app.js` runs deferred. The IIFE captures `DATA` and `LS`, defines all helpers, then `init()` (line 4084) runs at `DOMContentLoaded`:
   - `migrateV1IfNeeded()` upgrades old single-respondent data.
   - `clearOldScaleResponsesIfNeeded()` wipes responses once when migrating from a 1-5 to a 1-10 scale (lines 4068-4082).
   - If a `currentUser()` exists and is internal, `state.orgId` is seeded from the first org meta.
   - `render()` is called.
5. Independently, `syncFromCloud()` is invoked when Firebase becomes ready (search call sites in `app.js`); it pulls all `orgs` and `users` from Firestore, writes them into `localStorage`, then re-renders (`app.js` lines 2684-2720).

**Render flow (single tick):**

1. `render()` (line 694) destroys any existing Chart.js chart, updates the tab title badge, and clears `#app`.
2. If no user is signed in -> `renderAuth()`. Otherwise it appends `renderTopbar(user)`, a fresh `<main>`, then dispatches on `state.route` via `renderRoute()` (line 729) to one of: dashboard, diagnostic, pillar:N, actions, engagement, report, documents, chat, roadmap, funnel, admin.
3. Each `render*` returns a single DOM node (or fragment) that is appended to `<main>`.
4. `renderFooter(user, org)` is appended last.
5. Charts are drawn after the DOM settles via `queueMicrotask(() => drawRadar(...))` (line 1401) and `queueMicrotask(() => drawReportDonut(org))` (line 2293).
6. `ensureChatSubscription(user)` (line 399) is called from `render()` (line 703) to keep the live chat listener attached, so unread counts update without user input.

**Mutation flow (e.g. answering a diagnostic question):**

1. User clicks a Likert button in `renderQuestion` (line 1779). The handler calls `setResponse(user, org, p.id, idx, { score: n })` then `render()`.
2. `setResponse` (line 1861) reloads the org from `localStorage`, mutates `o.responses[currentRoundId][userId][pillarId][idx]`, then calls `saveOrg(o)`.
3. `saveOrg` (line 107) writes JSON to `localStorage` via `jset` and calls `cloudPushOrg(org)`.
4. `cloudPushOrg` (line 2610) debounces 400ms and writes the entire org document to Firestore at `orgs/{org.id}` via `setDoc`.
5. `render()` repaints from `localStorage` (instant), independent of the cloud round-trip.

**Real-time chat flow:**

1. On render, `ensureChatSubscription(user)` (line 399) opens an `onSnapshot` listener over `messages` (filtered by `orgId` for clients, unfiltered for internal) -> `state.chatMessages`.
2. Snapshot updates trigger a global `render()` (line 396), which keeps unread badges (`unreadChatTotal`) and the title bar (`updateTabTitleBadge`) accurate.
3. `renderChat` (line 2878) opens its own per-org `onSnapshot` to drive the in-page list and composer, and uses `markChatReadFor` on render to clear the unread state for that org (line 2893).

**State management:**

- Global mutable singleton `state` (lines 564-577): `mode`, `route`, `orgId`, `pillarId`, `chart`, `userMenuOpen`, `authTab`, `authError`, `expandedPillars` (Set), `chatMessages`, `chatSubscription`, `chatSubscribedFor`. Survives across renders, lost on reload (except `mode` and `session` which are mirrored to `localStorage`).
- Per-feature local-component state lives inside the closure of each render function (e.g. `localData`, `localKpis`, `inputs`, `pctCells` in `renderFunnel` at lines 3347-3357).
- Domain state is read from `localStorage` on demand. There is no in-memory copy of orgs/users.

## Key Abstractions

**`h(tag, attrs, children)` DOM builder:**

- Purpose: One-call element construction. Handles `class`, `html`, `on*` listeners, boolean attributes, primitive/Node children.
- Examples: `app.js` line 610, used everywhere (e.g. line 632 in `modal`, line 1276 in dashboard summary grid).
- Pattern: Hyperscript-style. Replaces JSX/templates without a build step.

**`render()` global re-mount:**

- Purpose: Single source of truth for paints. Anything that changes data calls `render()`.
- Examples: `app.js` line 694; called from `setRoute` (line 686), every mutation handler, every modal close, every Firestore snapshot.
- Pattern: Wholesale replace `#app` contents. No diffing, no keys.

**Org JSON tree:**

- Purpose: Canonical per-org payload. One JSON document per org, in `localStorage` and in Firestore at `orgs/{id}`.
- Examples: Created in `createOrg` (line 120), read via `loadOrg` (line 106), persisted via `saveOrg` (line 107). Shape: `{ id, name, createdAt, currentRoundId, rounds[], responses{roundId:{userId:{pillarId:{idx:{score, note}}}}}, internalNotes{}, actions[], engagement{currentStageId, stageChecks{}}, comments{pillarId:[]}, readStates{userId:{pillarId:iso}}, tier?, clientPassphraseHash? }`.
- Pattern: Document-oriented, denormalised. Everything an org owns lives in one blob.

**User record:**

- Purpose: One JSON per user, persisted in `localStorage` (`baselayers:users` array) and mirrored to Firestore `users/{id}`.
- Examples: `findUser` (line 86), `upsertUser` (line 91). Shape: `{ id, email, name, role: "internal"|"client", orgId?, createdAt, passwordHash?, internalPassphrase? }`.

**Routes (string switch):**

- Purpose: View selection. No router library.
- Examples: `state.route` (line 566) defaults to `"dashboard"`; values include `"dashboard"`, `"diagnostic"`, `"pillar:N"` (composite), `"actions"`, `"engagement"`, `"report"`, `"documents"`, `"chat"`, `"roadmap"`, `"funnel"`, `"admin"`. Set by `setRoute(route)` (line 686). Dispatched by `renderRoute` (line 729).
- Pattern: No URL hash, no History API. Refreshing the page resets to `"dashboard"`.

**Modal helpers:**

- Purpose: Reusable dialogs without a component layer.
- Examples: `modal(content)` (line 629), `promptText` (line 652), `confirmDialog` (line 674). Mounts into `#modalRoot` (declared in `index.html` line 20).
- Pattern: Returns a `{ close }` handle. Click outside closes.

**Firestore listener pattern:**

- Purpose: Live data for collaborative features.
- Examples: `startChatSubscription` (line 377), `renderChat` listener (line 3012), `renderRoadmap` listener (search `onSnapshot` in `renderRoadmap`), `renderFunnel` listener, `renderDocuments` listener (`firestore.collection(db, "documents")` line 2815).
- Pattern: Subscription stored on `state` or on a closure variable; manually torn down in `stopChatSubscription` (line 372). Per-render listeners are not always cleaned up (re-renders can stack subscriptions — see CONCERNS).

## Entry Points

**`<div id="app">` mount point:**

- Location: `index.html` line 17.
- Triggers: `init()` -> `render()`.
- Responsibilities: Hosts the entire UI tree. Cleared and rebuilt on every `render()`.

**`<div id="modalRoot">` modal host:**

- Location: `index.html` line 20.
- Triggers: `modal()` (line 629).
- Responsibilities: Holds dialogs above the app shell. Toggled by adding/removing the `hidden` class.

**`firebase-init.js` (module entry):**

- Location: `firebase-init.js` line 1.
- Triggers: Loaded as a module from `index.html` line 22.
- Responsibilities: Initialise Firebase, expose `window.FB`, kick off anonymous sign-in, fire `firebase-ready` event when `onAuthStateChanged` resolves.

**`data/pillars.js` (data entry):**

- Location: `data/pillars.js` line 4.
- Triggers: Plain `<script>` tag in `index.html` line 23.
- Responsibilities: Assigns `window.BASE_LAYERS` for `app.js` to consume.

**`app.js` IIFE entry:**

- Location: `app.js` line 11; bootstrap `init()` at line 4084; auto-start at lines 4098-4102 (DOMContentLoaded or immediate).
- Triggers: `<script src="app.js?v=46" defer>` in `index.html` line 24.
- Responsibilities: Define all helpers, run migrations, render the initial view.

**Auth event entry:**

- Location: `firebase-init.js` lines 44-50 (`onAuthStateChanged`).
- Triggers: Anonymous sign-in completion.
- Responsibilities: Sets `window.FB.currentUser`, resolves `window.FB.ready`, dispatches `firebase-ready`. Cloud-dependent code (`fbReady()` in `app.js` line 2607) gates on this.

## Error Handling

**Strategy:** Defensive `try/catch` around all cloud calls; user-visible errors via `alert()` for blocking failures and inline status text for non-blocking ones. No central error reporting.

**Patterns:**

- Cloud writes wrap in `try { ... } catch (e) { console.error(...) }` and silently fail to keep the local-first UX responsive (see `cloudPushOrg` line 2614, `cloudPushUser` line 2627).
- `syncFromCloud` (line 2684) explicitly bails if either fetch returns null so a network blip never wipes local data (comment lines 2682-2683).
- Per-feature listeners pass an error callback to `onSnapshot` that either logs (`startChatSubscription` line 397) or replaces the list with a red error message (`renderChat` line 3019).
- Storage uploads catch and surface via inline progress text (`renderDocuments` upload `catch` near line 2784).
- JSON parsing in `jget` (line 73) returns the fallback on any throw — never crashes a render.
- Hash fallback in `hashString` (line 414) downgrades to a non-cryptographic string hash if `crypto.subtle` is unavailable.

## Cross-Cutting Concerns

**Logging:** `console.error` only (e.g. `firebase-init.js` line 52, `app.js` lines 2618, 2631, 2643, 2653, 2664, 2676, 3402). No structured logging, no Sentry/LogRocket.

**Validation:** Inline. Client-side only. Auth forms validate length/match before submit (`renderSignInForm` lines 1090-1097). Numeric inputs in funnel are coerced via `Number(v)` with `Number.isNaN` checks. Firestore Security Rules are the only server-side enforcement (rules file is not in the repo).

**Authentication:** Two layers. (1) Firebase Anonymous Auth gives every visitor a Firebase UID for Storage/Firestore access (`firebase-init.js` line 52). (2) Application-level session in `localStorage` under `baselayers:session` keyed by app-internal `userId`. Internal users gated by hard-coded email allowlist + shared SHA-256 password hash (`app.js` lines 443-444). Client users gated by org-shared passphrase hash + per-user password hash (lines 462-486).

**Authorisation:** Role flag on the user record (`role: "internal"|"client"`). Client users see only their own `orgId` (enforced in `activeOrgForUser` line 579). Internal users can switch orgs via the topbar select. The `effectiveRole` helper (line 595) downgrades internal users to client-preview when `state.mode === "external"`. Internal-only comments are filtered in `commentsFor` (line 298). Print is disabled for clients via the `body.client-view` print rule in `styles.css` lines 55-65.

**Caching:** `localStorage` is the read cache; Firestore is canonical. Cloud writes are debounced 400ms per record (`cloudSaveTimers` map, line 2609). Asset cache-busting via `?v=46` querystring on script tags in `index.html` lines 22-24.

**Real-time:** Per-feature `onSnapshot` listeners. App-wide chat listener kept alive by `ensureChatSubscription` (line 399) so unread counts and the tab-title badge stay current.

---

_Architecture analysis: 2026-05-03_
