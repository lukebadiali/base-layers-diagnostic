# Codebase Structure

**Analysis Date:** 2026-05-03

## Directory Layout

```
base-layers-diagnostic/
├── .claude/                 # Local dev tooling (not deployed)
│   ├── launch.json          # VSCode-style launch config for the static server
│   └── serve.py             # Python http.server wrapper (port 5178)
├── .planning/               # GSD workflow scratch space (codebase maps, plans)
│   └── codebase/            # Output of /gsd-map-codebase (this directory)
├── assets/                  # Static binary assets shipped to the browser
│   ├── BD Diagnostic questions.docx   # Source doc, not loaded by the app
│   ├── logo.png             # Topbar + auth hero logo
│   └── logo-blue.png        # Alt brand logo (not currently referenced in HTML/JS)
├── data/                    # Static domain content
│   └── pillars.js           # window.BASE_LAYERS — pillars, principles, stages, score labels
├── .gitignore               # Ignores .DS_Store, .vscode/, .idea/, *.log, node_modules/
├── app.js                   # Single-file application (4,103 lines, IIFE)
├── CNAME                    # GitHub-Pages custom domain: baselayers.bedeveloped.com
├── firebase-init.js         # Firebase v10 modular SDK setup → window.FB (ES module)
├── index.html               # 27-line app shell. Mounts #app and #modalRoot.
├── SECURITY_AUDIT.md        # Security review notes (not consumed by the app)
└── styles.css               # 2,150-line single stylesheet (CSS variables + components)
```

## Directory Purposes

**`.claude/`:**
- Purpose: Local dev convenience. Not part of the deployed bundle.
- Contains: `serve.py` (a `SimpleHTTPRequestHandler` on port 5178) and `launch.json` referencing it.
- Key files: `.claude/serve.py`, `.claude/launch.json`.
- Note: `serve.py` hard-codes a Mac path (`/Users/lukebadiali/...`) — non-portable, edit before use on other machines.

**`.planning/`:**
- Purpose: GSD command output. Codebase maps, phase plans, scratch.
- Contains: `codebase/` subdir with `STACK.md`, `ARCHITECTURE.md`, `STRUCTURE.md`, etc.
- Key files: `.planning/codebase/*.md`.

**`assets/`:**
- Purpose: Binary assets served at runtime.
- Contains: PNG logos and a source `.docx` (the latter is reference material, not fetched by the app).
- Key files: `assets/logo.png` (referenced from `index.html` line 7 and `app.js` lines 762, 956).

**`data/`:**
- Purpose: Static domain content kept separate from rendering logic.
- Contains: `pillars.js` only.
- Key files: `data/pillars.js` (assigns `window.BASE_LAYERS`).

**Repo root:**
- Purpose: Hosts the deployable static assets plus repo-level docs.
- Contains: `index.html`, `app.js`, `firebase-init.js`, `styles.css`, `CNAME`, `.gitignore`, `SECURITY_AUDIT.md`.

## Key File Locations

**Entry Points:**
- `index.html`: HTML shell, mounts `#app` and `#modalRoot`, loads scripts. 27 lines.
- `firebase-init.js`: Firebase init + `window.FB` exposure + anonymous sign-in. 53 lines, ES module.
- `data/pillars.js`: Static framework data. 540 lines, plain script.
- `app.js`: Application IIFE. 4,103 lines. Auto-runs on DOMContentLoaded (line 4098).

**Configuration:**
- `firebase-init.js` lines 16-23: Firebase web config (public values; access controlled server-side via Security Rules).
- `app.js` lines 18-27: localStorage key map (`baselayers:users`, `baselayers:session`, `baselayers:settings`, `baselayers:orgs`, `baselayers:mode`, `baselayers:org:{id}`, `baselayers:active`).
- `app.js` lines 443-444: Internal user allowlist + SHA-256 team-password hash.
- `app.js` lines 3309-3323: Funnel metric/quarter/year configuration.
- `CNAME`: Production hostname.

**Core Logic (within `app.js`):**
- Lines 17-141: Storage layer (`K`, `jget`/`jset`, users, orgs, rounds CRUD).
- Lines 167-313: Domain calculations (scoring, status, comments, completion).
- Lines 322-486: Auth + chat unread tracking + password hashing.
- Lines 488-561: v1 -> v2 migration.
- Lines 563-577: Global `state` singleton.
- Lines 579-605: Org/role resolution helpers (`activeOrgForUser`, `effectiveRole`, `isClientView`).
- Lines 607-684: DOM helpers (`$`, `$$`, `h`) and modals (`modal`, `promptText`, `confirmDialog`).
- Lines 686-751: Router (`setRoute`, `render`, `renderRoute`).
- Lines 756-946: Topbar + footer.
- Lines 951-1184: Auth screens.
- Lines 1215-1591: Dashboard + radar chart (`drawRadar` line 1531).
- Lines 1592-1953: Diagnostic index, pillar detail, comments thread.
- Lines 1954-2122: Actions (CRUD + modal).
- Lines 2123-2194: Engagement lifecycle.
- Lines 2199-2408: Report (with `drawReportDonut` at 2355).
- Lines 2413-2599: Admin.
- Lines 2602-2720: Cloud sync (Firestore mirror + boot pull).
- Lines 2722-2876: Documents (Firebase Storage uploads).
- Lines 2878-3026: Chat (Firestore live listener).
- Lines 3028-3267: Roadmap / Plan (per-org Firestore document).
- Lines 3269-3324: Funnel constants (and `openBulkOutcomeModal`).
- Lines 3325-3800: Funnel page (KPIs, year/quarter grid, definitions, comments).
- Lines 3801-4015: Invite + password modals.
- Lines 4016-4061: Backup export/import.
- Lines 4068-4102: Migrations + `init()` + auto-start.

**Testing:**
- None present. No `*.test.*` or `*.spec.*` files exist anywhere in the repo.

## Naming Conventions

**Files:**
- All lower-case `kebab-case` for top-level scripts: `app.js`, `firebase-init.js`.
- Lower-case for the data folder file: `data/pillars.js`.
- UPPERCASE for repo-level docs: `CNAME`, `SECURITY_AUDIT.md`.
- Generated planning docs are UPPERCASE.md inside `.planning/codebase/`.

**Directories:**
- Single-word lower-case: `assets/`, `data/`.
- Dotfile dirs for tooling and ignored content: `.claude/`, `.planning/`, `.git/`.

**Functions (inside `app.js`):**
- `camelCase` throughout. Verb-first for actions (`createOrg`, `saveOrg`, `deleteUser`, `addComment`, `setResponse`, `markPillarRead`).
- View functions are prefixed `render*` (`renderDashboard`, `renderPillar`, `renderChat`, `renderFunnel`).
- Modal openers prefixed `open*` (`openInviteClientModal`, `openChangePasswordModal`, `openSetOrgPassphrase`).
- Cloud helpers prefixed `cloud*` (`cloudPushOrg`, `cloudFetchAllUsers`).
- Predicates use `is*` / `has*` (`isClientView`, `isAllowedInternalEmail`, `orgHasClientPassphrase`, `fbReady`).

**Constants:**
- `UPPER_SNAKE_CASE` for module-level constants: `INTERNAL_ALLOWED_EMAILS`, `INTERNAL_PASSWORD_HASH`, `BASE_TAB_TITLE`, `FUNNEL_METRICS`, `FUNNEL_QUARTERS`, `FUNNEL_YEARS`.
- Single-letter `K` is the storage-key namespace map (`app.js` line 18).

**localStorage keys:**
- Always namespaced with `baselayers:` prefix. Composite keys use `:` as separator (e.g. `baselayers:org:{id}`, `baselayers:chatLastRead:{userId}`).

**Firestore collections:**
- All lower-case plurals: `orgs`, `users`, `messages`, `documents`, `roadmaps`, `funnels`, `funnelComments`. Document IDs match the in-app `id` for `orgs`/`users`/`roadmaps`/`funnels`; `messages`/`documents`/`funnelComments` use auto-IDs.

**CSS classes:**
- `kebab-case` (`view-title`, `view-sub`, `nav-btn`, `top-constraints`, `chat-bubble`, `kpi-section`, `roadmap-palette`, `pillar-pill`).
- Status modifiers: `red`, `amber`, `green`, `gray` applied directly (e.g. `<span class="badge red">`).

## Where to Add New Code

**New view / route:**
- Implementation: Add a `renderX(user, org)` function inside the IIFE in `app.js` (place it near the other render functions, grouped under a `// ===` banner).
- Wiring: Add a case in `renderRoute` (`app.js` line 729) — `else if (route === "x") main.appendChild(renderX(user, org));`.
- Top-nav button: Add `["x", "Label"]` to the `items` array in `renderTopbar` (`app.js` line 772).
- Tests: None to add. No test framework is configured.

**New mutation / domain helper:**
- Place near other domain helpers (`app.js` lines 167-320) if it operates on org/scoring data; otherwise near the storage helpers (lines 80-141).
- Always go through `loadOrg` -> mutate -> `saveOrg` so the cloud mirror fires.

**New persisted org field:**
- Add a default in `createOrg` (`app.js` line 120) so new orgs receive it.
- Add backfill logic in `migrateV1IfNeeded` (line 489) or in a fresh one-shot (model on `clearOldScaleResponsesIfNeeded` at line 4068) if existing orgs need patching.
- No schema migration is required server-side — Firestore takes whatever shape `setDoc` writes.

**New Firestore-backed feature:**
- Pattern: Inside the relevant `renderX`, get `{ db, firestore }` from `window.FB` (gated by `if (!fbReady()) return placeholder`). Use `firestore.doc(db, "collection", id)` for single-doc state, `firestore.collection(db, "collection")` + `firestore.query(...)` for lists. Wire `onSnapshot` for live updates and `setDoc({ ..., updatedAt: serverTimestamp() }, { merge: true })` with a debounced save timer for writes (mirror the funnel pattern in `app.js` lines 3387-3411).
- Cleanup: If subscriptions need to outlive a single render, store the unsubscribe on `state` and tear down on sign-out (mirror `stopChatSubscription` at line 372).

**New static framework content (e.g. another pillar field):**
- Edit `data/pillars.js`. Update every pillar to include the new field for shape consistency. The renderer in `app.js` (e.g. `renderPillar` line 1659, `renderReport` line 2226) must be updated to surface it.

**New CSS:**
- Add to `styles.css`. Reuse the variables in `:root` (`styles.css` lines 7-49) for colours, radii, shadows, fonts. New components belong at the end of the relevant section (the file is grouped by area but not strictly enforced).

**New asset:**
- Drop in `assets/`. Reference via relative path `assets/filename` from HTML or JS (e.g. `<img src="assets/logo.png">`).

**New modal:**
- Use `modal(content)` (line 629), `promptText(...)` (line 652), or `confirmDialog(...)` (line 674). Build content with the `h` helper. Place an `openX` opener function near the others (lines 3801-4015) and call it from a button handler.

**New backup field:**
- `exportData` (`app.js` line 4016) and `importData` (line 4033) are the manual backup/restore path. Update both when adding a new top-level localStorage key.

## Special Directories

**`.claude/`:**
- Purpose: Editor/AI tooling and the local static server.
- Generated: No (committed).
- Committed: Yes.

**`.planning/`:**
- Purpose: Output of GSD workflow commands (codebase maps, phase plans).
- Generated: Yes (created/updated by GSD agents).
- Committed: Project-dependent. The `.gitignore` does not exclude it, so it is committed by default in this repo.

**`assets/`:**
- Purpose: Binary assets served at runtime.
- Generated: No.
- Committed: Yes.

**`data/`:**
- Purpose: Hand-curated framework content. Not generated.
- Generated: No.
- Committed: Yes.

**Implicit: `node_modules/`, `.vscode/`, `.idea/`:**
- Purpose: Tooling.
- Generated: Yes (when present).
- Committed: No (excluded by `.gitignore` lines 2-5). The repo intentionally has no `node_modules` because there is no package manager.

---

*Structure analysis: 2026-05-03*
