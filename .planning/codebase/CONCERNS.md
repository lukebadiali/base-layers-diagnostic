# Codebase Concerns

**Analysis Date:** 2026-05-03

> **Source pointer:** A comprehensive third-party security audit playbook exists at `SECURITY_AUDIT.md` (project root). That file is the canonical OWASP/NCSC/Supabase/Vercel audit checklist and is **not project-specific findings** — it is the framework against which this codebase is measured. Concerns below are the *actual* findings produced by walking that checklist against the BeDeveloped Base Layers source.

---

## Severity Summary

| Severity | Count | Category |
|---|---|---|
| CRITICAL | 4 | Auth bypass, secret-equivalent in repo, missing rules, XSS-via-stored-content |
| HIGH | 8 | Hash strength, monolith, no input validation, no CSP, weak randomness, missing tests, no MFA, file-upload validation |
| MEDIUM | 9 | Cache busting, unprotected `innerHTML` clears, CDN integrity, error UX, fragile state, alert() UX, large file warnings, console noise, no rate limiting |
| LOW | 5 | Naming, dead code paths, minor a11y, comment quality, .gitignore coverage |

---

## CRITICAL Concerns

### C1 — Authentication is client-side only; trivially bypassable
- **Issue:** All auth decisions (`internal` vs `client` role, org membership, password verification) happen in `app.js` against `localStorage`. There is no server-side enforcement. Any user with browser DevTools can:
  1. Edit `localStorage["baselayers:session"]` to assume any user id (`app.js:328-334`).
  2. Edit `localStorage["baselayers:users"]` to flip their own `role` to `"internal"` (`app.js:84-101`).
  3. Read other orgs' data directly from Firestore once anonymously authenticated, since the only gating is JS-side `if (user.role === "client") …` checks (`app.js:298-302`, `app.js:582`, `app.js:2823-2828`).
- **Files:** `app.js:84-101`, `app.js:322-334`, `app.js:440-486`, `app.js:579-605`, `app.js:1068-1183`
- **Impact:** Confidentiality breach. A hostile client (or anyone who knows the URL) can read every other client's diagnostic responses, internal notes, chat messages, comments, and uploaded documents. Treating `localStorage` as a trust boundary is the failure pattern at the heart of *OWASP A01:2025 — Broken Access Control*.
- **Fix approach:** Move auth to Firebase Auth (real users, not anonymous), let Firestore Security Rules enforce per-`orgId` reads/writes server-side, and stop using `localStorage` for `role` or session identity. Until rules are written, this app must be considered effectively public.

### C2 — Hardcoded internal-team password hash + email allowlist in committed source
- **Issue:** Lines 443-444 of `app.js` ship the SHA-256 hash of the BeDeveloped internal-team password and the allowlisted internal emails:
  ```
  const INTERNAL_ALLOWED_EMAILS = ["luke@bedeveloped.com", "george@bedeveloped.com"];
  const INTERNAL_PASSWORD_HASH  = "6110f27c9c91658c3489285abd5c45ffe5c1aa99c7f3f37d23e32834566e7fce";
  ```
  The author's own comment on `app.js:441-442` acknowledges *"this hash lives in a public repo. Treat as a light access gate, not real auth."*
- **Files:** `app.js:440-452`
- **Impact:** Plain SHA-256 of a low-entropy password is **brute-forceable in seconds** with hashcat (no salt, no key-stretch, no pepper). Anyone reading the repo recovers the password and gains the `internal` view (which, combined with C1, is the keys to every client's data). Falls under *OWASP A04:2025 — Cryptographic Failures* and *A07 — Authentication Failures*.
- **Fix approach:** Remove the constant. Issue real per-user accounts via Firebase Auth (or a hosted IdP). If a "shared team password" must persist short-term, store it as a Firestore admin doc gated by Security Rules and rotate immediately — but the long-term answer is per-user auth + MFA.

### C3 — Firestore Security Rules: no evidence rules are scoped, and uploads/messages have no server-side authz
- **Issue:** No `firestore.rules`, `storage.rules`, or `firebase.json` is committed in the repo (`Glob` returns none). The app authenticates anonymously (`firebase-init.js:52`) and writes to top-level collections `orgs`, `users`, `messages`, `documents`, `funnelComments` (`app.js:2616, 2629, 2768, 2988, 3765`) using whatever rules happen to exist on the live Firebase project. Reads use queries like `where("orgId", "==", org.id)` (`app.js:2814-2817`, `app.js:3784-3787`) — but `org.id` comes from the client, so without rules a malicious client can query any orgId.
- **Files:** *(not in repo)* — `firestore.rules`, `storage.rules`, `firebase.json`; relevant client paths: `firebase-init.js:52`, `app.js:2610-2678`, `app.js:2814-2817`, `app.js:3784-3787`
- **Impact:** If the live rules are still the Firebase default ("test mode" / `allow read, write: if request.auth != null`), every anonymously-authenticated visitor can read **and overwrite** every org, user document, chat message, uploaded file metadata, and funnel comment. *OWASP A01:2025 — Broken Access Control* (IDOR), *A05 — Injection-adjacent* (mass-assignment).
- **Fix approach:** Author and commit `firestore.rules` + `storage.rules` to the repo. Rules must (a) require non-anonymous auth tokens with custom claims for `role` and `orgId`; (b) enforce `resource.data.orgId == request.auth.token.orgId` on reads; (c) disallow client writes to `users` and `orgs` documents (do those server-side via a Cloud Function); (d) on `messages`/`documents`/`funnelComments` writes, require `request.resource.data.authorId == request.auth.uid`. Run Firebase Emulator + rules unit tests in CI.

### C4 — Stored-XSS via untrusted user input rendered into chat / comments / org names
- **Issue:** Although `h()` (`app.js:610-626`) text-content path uses `createTextNode` (safe), several places render user-supplied strings via template literals that *could* land back inside `innerHTML`. More directly, the `h()` helper accepts a special `html: ...` attr that does an unconditional `el.innerHTML = v` (`app.js:614`). It's only used internally today, but it is wired into the same factory used everywhere — one careless caller passing untrusted data via `html:` is a stored-XSS bug. Combined with chat/comment text being broadcast to internal staff (`app.js:2945-2978`, `app.js:3724-3756`), an attacker with a client account could persist a payload that fires when a BeDeveloped staff member opens the channel.
- **Files:** `app.js:610-626` (the `html:` escape hatch), `app.js:2945-2978` (chat bubble render), `app.js:3724-3756` (funnel comment render), `app.js:631, 638, 700, 988, 2830, 2868, 2939, 3020, 3107, 3414, 3719, 3794, 3838, 3943, 3974, 4000` (every `innerHTML = ""` reset; safe today but an unsafe coding *posture*)
- **Impact:** *OWASP A03:2025 — Injection (XSS)*. Currently text-only paths use `createTextNode`, so this is **latent** rather than active — but the `html:` shortcut means XSS is one careless commit away, and there is no CSP backstop (see H4) that would limit blast radius if a payload ever did execute.
- **Fix approach:** Delete the `html:` branch in `h()` and force every caller to build DOM via children. Add a strict CSP (see H4). Add a unit test that asserts comment/chat rendering escapes `<script>` and `<img onerror>` payloads.

---

## HIGH Concerns

### H1 — `app.js` is a 4,103-line untestable monolith
- **Files:** `app.js` (4,103 lines, 169 KB) — every concern below cohabits this one IIFE.
- **Why fragile:** Storage layer, auth, routing, rendering for 14 view types (`renderDashboard`, `renderOperationalExcellenceTile`, `renderRoundBar`, `renderDiagnosticIndex`, `renderPillar`, `renderQuestion`, `renderTeamResponses`, `renderScoreBlock`, `renderComments`, `renderActions`, `renderActionRow`, `renderEngagement`, `renderReport`, `renderAdmin`, `renderDocuments`, `renderChat`, `renderRoadmap`, `renderFunnel` — see `app.js:694-3325`), Firestore sync, document upload, and import/export are all in one file scope. No module boundaries, no exports, no tree-shaking.
- **Impact:** Any change risks breaking unrelated features. There is **no test suite** (no `*.test.*`, `jest.config.*`, `vitest.config.*`, or `package.json` exists), so refactors are unverified.
- **Fix approach:** Introduce a build step (Vite is the lowest-friction option for vanilla JS modules). Split by domain: `auth.js`, `storage.js`, `cloud-sync.js`, `views/*.js`, `dom.js`. Add Vitest + a smoke test that mounts each view with a fake user/org.

### H2 — No automated tests anywhere in the repo
- **Files:** *(none)* — no `*.test.*`, no `*.spec.*`, no test runner config, no CI workflow (no `.github/`).
- **Impact:** Every behavioural assumption (scoring math `app.js:206-222`, completion math `app.js:240-256`, comment unread tracking `app.js:304-320`, chat unread `app.js:354-370`, v1→v2 migration `app.js:489-561`, scale-v2 wipe `app.js:4068-4082`) is asserted only by manual click-through. The migration in particular **silently mutates** every org's responses on first load — a regression here destroys customer data with no rollback.
- **Fix approach:** Add Vitest (or Node's built-in test runner — no build config needed). Start with: scoring helpers, comment unread, migration idempotency. Wire to a GitHub Actions workflow that blocks merges on red.

### H3 — Weak password requirements + no MFA + no rate limiting + no lockout
- **Issue:** Passphrases require **4 characters minimum** (`app.js:989-991, 1090-1092`). No complexity rules, no leaked-password check, no MFA, no progressive delay, no account lockout, no CAPTCHA. The "verify" path is a synchronous local hash compare (`app.js:481-486`) so there's nothing the server could rate-limit even if it wanted to.
- **Files:** `app.js:413-486`, `app.js:973-1184`
- **Impact:** *OWASP A07:2025 — Authentication Failures*. Combined with C1/C2 this is academic (auth is bypassed entirely), but as soon as real auth lands, the policy is still 4-char passwords with no MFA — that's not acceptable for a SaaS storing client diagnostic data.
- **Fix approach:** Adopt Firebase Auth Email/Password with `passwordPolicy` (min 12 chars, NIST-style), enable MFA enrolment for internal users, and require enrolment for any account with `role: internal`.

### H4 — No Content-Security-Policy, no security headers, no SRI on third-party scripts
- **Issue:** `index.html` ships `<script>` tags loading `https://cdn.jsdelivr.net/npm/chart.js@4.4.1/...` (`index.html:12`) and `https://www.gstatic.com/firebasejs/10.13.0/...` (`firebase-init.js:4-14`) with no `integrity=` attribute and no CSP. There is no `<meta http-equiv="Content-Security-Policy">`, no `Referrer-Policy`, nothing in headers (the site is hosted on GitHub Pages via `CNAME` — Pages does not set CSP unless configured via meta).
- **Files:** `index.html:12`, `firebase-init.js:4-14`, `index.html:1-26` (no security meta)
- **Impact:** *OWASP A05:2025 — Security Misconfiguration*. If jsdelivr.net or gstatic.com is ever served a tampered version of these scripts (supply-chain compromise — see *Shai-Hulud* class), the malicious script runs with full DOM access and reads every Firestore call and every typed credential. CSP would also be the backstop for a future regression of C4.
- **Fix approach:** Pin Firebase + Chart.js to a self-hosted bundle (the build step from H1 makes this trivial). Add `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://firebasestorage.googleapis.com; connect-src https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com;">` and add `referrer="no-referrer"` to externally-loaded resources.

### H5 — `Math.random()` used to mint security-relevant ids
- **Issue:** The id generator at `app.js:30-31` is `Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)` — non-CSPRNG, ~36 bits of entropy, used to build user ids, org ids, document ids in Firestore, comment ids, etc. (`app.js:121, 122, 144, 153, 290, 499, 517, 853, 1155, 2758, 3853` etc.)
- **Files:** `app.js:30-31` and ~30 callers
- **Impact:** *OWASP A04:2025 — Cryptographic Failures*. With Firestore rules tightened (per C3), an attacker who can enumerate ids can target specific resources. Even without that, collisions are possible at scale (~7 random alnum chars + a 4-char timestamp suffix). Document storage paths like `orgs/${org.id}/documents/${docId}/${file.name}` (`app.js:2759`) become guess-able.
- **Fix approach:** Replace with `crypto.randomUUID()` (universally available in modern browsers and in Firebase JS runtime). One-line change; no migration needed for existing ids since they remain unique strings.

### H6 — File uploads have no validation: any size, any MIME, any filename
- **Issue:** The Documents upload (`app.js:2749-2787`) accepts whatever `<input type="file">` gives it. No size cap, no extension/MIME allowlist, no filename sanitisation. The filename is concatenated into the storage path (`app.js:2759`) and shown back to other org members on download (`app.js:2840`) — including the `Content-Type` the *client* claims (`app.js:2761`).
- **Files:** `app.js:2749-2872`
- **Impact:** *OWASP A05:2025 — Injection-adjacent* + denial-of-wallet. A client can: (a) upload arbitrarily large files, burning Firebase Storage quota; (b) upload an executable named `report.pdf.exe` or an HTML file with a misleading `Content-Type: application/pdf` that the browser sniffs and renders as HTML (since `X-Content-Type-Options: nosniff` is also missing); (c) include `../` style segments in filename (Firebase Storage tolerates these but the displayed name in the UI is not escaped to text — `app.js:2840` uses `h("div", {…}, d.filename)` which is safe via `createTextNode`, but the download URL is not validated against the bucket origin).
- **Fix approach:** Enforce in `storage.rules`: `request.resource.size < 25 * 1024 * 1024 && request.resource.contentType.matches('application/(pdf|vnd.*)|image/.*|text/.*')`. Mirror in client. Sanitise filename with `String(name).replace(/[^\w.\- ]/g, '_').slice(0, 200)`.

### H7 — `serverTimestamp()` not used consistently; clock skew can break ordering and unread tracking
- **Issue:** Most chat/comment writes use `serverTimestamp()` (good — `app.js:2780, 2995, 3772`) but unread tracking compares `msg.createdAt?.toMillis?.()` against client-clock-derived `iso()` values stored under `baselayers:chatLastRead:<userId>` (`app.js:336-369`). Mixing server time with client time inside the same comparator means an unread badge can desync if the client clock is wrong, and the badge will silently under- or over-count.
- **Files:** `app.js:33` (`iso = () => new Date().toISOString()`), `app.js:336-370`, `app.js:286-320`
- **Impact:** Notifications ghost or duplicate; this is a recurring "the chat says I have a message but there's nothing there" support burden. Not a security issue, but a fragility tax on every release.
- **Fix approach:** Pull last-read into Firestore so both halves of the comparator are server-clock; or, accept a ±5-minute fuzz factor in the comparator.

### H8 — Cloud sync is "last-writer-wins" with no conflict resolution
- **Issue:** `cloudPushOrg` (`app.js:2610-2621`) does `setDoc(..., org)` after a 400ms debounce. Two users editing the same org in two tabs/devices will overwrite each other's `responses`, `comments`, `actions`, and `engagement.stageChecks` blobs without merge. The bootstrap (`app.js:2680-2720`) fetches everything once and writes localStorage; subsequent edits never re-pull.
- **Files:** `app.js:2602-2720`
- **Impact:** Data loss when two users (even the same user on two devices) save concurrently. Most likely loss patterns: a client adds a response while internal staff edits engagement stage — whoever saves last wipes the other. This is invisible to users (no error surfaced).
- **Fix approach:** Either move per-field to subcollections (`orgs/{id}/responses/{userId}`) so writes don't collide on the parent doc, or wrap each write in a Firestore transaction that merges the responses map. Add a `version` field with `runTransaction` for last-writer detection.

---

## MEDIUM Concerns

### M1 — Cache busting via `?v=46` query string is brittle
- **Files:** `index.html:22-24` — every script tag has `?v=46`, hand-bumped on each release.
- **Why fragile:** A developer who forgets to bump ships stale assets to every visitor. The CSS link (`index.html:8`) has *no* version query at all — style changes never invalidate. Also, GitHub Pages' CDN respects `Cache-Control` set by the platform, not the query string semantics the dev assumes.
- **Fix approach:** Move to a build pipeline that hashes filenames (`app.[hash].js`), or generate the query string from the deploy SHA. Add a `<link href="styles.css?v=…">` while you're there.

### M2 — `innerHTML = ""` used for clearing nodes (17 sites)
- **Files:** `app.js:631, 638, 700, 988, 2830, 2868, 2939, 3020, 3107, 3414, 3719, 3794, 3838, 3943, 3974, 4000`
- **Why concerning:** `el.innerHTML = ""` is fine for clearing, but it's the *same property* as the XSS vector. Linting cannot distinguish "clear" from "inject", so `no-inner-html` rules become noise. Replace with `el.replaceChildren()` (modern, declarative, intent-clear).

### M3 — `alert()` is the only error-surfacing channel for several flows
- **Files:** `app.js:2969, 2999, 3102, 3748, 3776, 4055, 4057`
- **Impact:** Blocking modal dialogs on errors interrupt input ("Couldn't send: …" while typing). For chat send-failure, the message is restored to the input but the user experience is jarring. *OWASP A10:2025 — Mishandling of Exceptional Conditions* — the failure mode should be a non-blocking inline banner, and the error should be logged centrally (currently only `console.error`).
- **Fix approach:** Inline toast/banner pattern; centralised `notify(level, message)` helper.

### M4 — `console.error` for cloud-sync failures is the only telemetry
- **Files:** `app.js:2618, 2631, 2642, 2652, 2663, 2675, 397`
- **Impact:** No alerting. Persistent Firestore write failures (e.g. bad rules, quota hit, network partition) are invisible to the operator. *OWASP A09:2025 — Security Logging and Alerting Failures*.
- **Fix approach:** Wire to a lightweight error sink (Sentry has a free tier; a minimal alternative is a Cloud Function endpoint that POSTs to Slack).

### M5 — Inline `style="…"` strings everywhere
- **Files:** every render function — examples: `app.js:2737-2882`, `app.js:2902, 2914, 2937, 3733, 3837` etc.
- **Impact:** A future CSP that forbids `style-src 'unsafe-inline'` (recommended by H4) will break the entire UI. Hard to maintain a design system when colours are inlined as strings.
- **Fix approach:** Move to CSS classes; add a pre-commit check that flags new `style="…"` in `app.js`.

### M6 — Anonymous Firebase auth produces a token with no user identity
- **Files:** `firebase-init.js:52`
- **Impact:** Every visitor shares the *kind* of token but has a unique `auth.uid`. Without app-managed `role`/`orgId` claims, Security Rules cannot enforce per-user authorisation properly, only "is signed in or not". This is the substrate underneath C1/C3.
- **Fix approach:** Replace `signInAnonymously` with Email/Password (or an SSO provider). Use a Cloud Function `beforeUserCreated` trigger to attach `role` + `orgId` custom claims at signup based on an internal allowlist.

### M7 — No `.gitignore` for env files; no `.env.example`
- **Files:** `.gitignore` (5 lines: `.DS_Store`, `.vscode/`, `.idea/`, `*.log`, `node_modules/`)
- **Impact:** If anyone later adds a `.env` it won't be ignored. Currently low risk because there *is* no `.env` (Firebase config is intentionally public per Firebase model — but an api-secret accidentally committed would slip through).
- **Fix approach:** Add `.env`, `.env.*`, `*.local`, `firebase-debug.log`, `firestore-debug.log`.

### M8 — Two near-identical chat/comment renderers
- **Files:** `app.js:2933-2980` (chat), `app.js:3717-3757` (funnel comments)
- **Why concerning:** Bug-fixes and security-fixes have to be applied twice. Both will either be patched in lockstep or one will rot.
- **Fix approach:** Extract a `renderConversation({ collection, list, …})` helper.

### M9 — Tab-title unread badge re-runs on every render and reads `document.title` indirectly
- **Files:** `app.js:406-411, 697`
- **Impact:** Each `render()` (51 call sites — see `Grep render\(\) | count = 51`) writes to `document.title`. With a noisy chat, this fires constantly and forces layout updates in some browsers' tab strips. Minor performance + a focus-grabber.
- **Fix approach:** Memoise the last-written title; only `document.title = …` on diff.

---

## LOW Concerns

### L1 — Auth-error UX exposes which emails exist
- **Files:** `app.js:1071-1077`, `app.js:1148-1152`
- **Impact:** *OWASP A07 — Account enumeration*. The signin form distinguishes "we don't have a client account for that email" from "your client account isn't linked to an org" from "company passphrase didn't match". An attacker can enumerate emails registered as clients vs. internals. Low because the public-data exposure (C1/C3) is a much bigger issue, but this is sub-finding worth tidying when auth is rebuilt.
- **Fix approach:** Use a single "Email or password incorrect" message for all client-sign-in failures.

### L2 — Dead `v1Active` cleanup runs on every load
- **Files:** `app.js:560`, `app.js:489-561`
- **Impact:** v1 migration code is run-once but unconditionally invoked at every `init()`. After all customers are migrated, this is dead weight (~70 lines).
- **Fix approach:** Guard with a flag in `loadSettings()` (same pattern as `scaleV2Cleared` at `app.js:4068-4082`).

### L3 — `rel="noopener"` on download link is good; but no `rel="noreferrer"` on the same link
- **Files:** `app.js:2848-2853`
- **Impact:** Referrer leak when opening a Firebase Storage signed URL in a new tab — the referring URL contains `state` from this app.
- **Fix approach:** `rel="noopener noreferrer"`.

### L4 — `formatWhen()` calculates "minutes ago" with rounding that flips at the boundary
- **Files:** `app.js:35-44`
- **Impact:** Cosmetic — at 30 minutes you'll see "30m ago" then "1h ago"; at 12h you'll see "12h ago" then "1d ago". `Math.round` causes premature rollover on the cusp.
- **Fix approach:** `Math.floor` for monotonic-decreasing labels.

### L5 — Comments show `c.authorId` instead of resolving to a name in `commentsFor` consumer paths
- **Files:** `app.js:286-302`, `app.js:1875-1980`
- **Impact:** Pillar comments display name resolution depends on the `users` cache being current; if a user was deleted, their comments display author-id text or `Unknown`. Already handled via `firstNameFromAuthor` for chat — same pattern should be used here.

---

## Test Coverage Gaps

**Status:** Zero automated tests in repo. Highest-priority gaps:

| Untested area | Files | Risk if it breaks |
|---|---|---|
| Diagnostic scoring (`pillarScoreForRound`) | `app.js:206-222` | Wrong red/amber/green status surfaces wrong narrative to client |
| Completion percentage | `app.js:240-256` | "You're done" UI shows on incomplete responses |
| v1 → v2 migration | `app.js:489-561` | Silent data corruption on first load after upgrade |
| Scale-v2 response wipe | `app.js:4068-4082` | Mass deletion of historical data; runs once but no undo |
| Comment unread tracking | `app.js:286-320` | Internal team misses or mis-attributes new comments |
| Chat unread total | `app.js:336-370` | Tab badge wrong; user assumes nothing to read |
| Cloud sync merge logic | `app.js:2680-2720` | Local data wiped or duplicated on multi-device |
| Auth state machine | `app.js:973-1184` | Wrong-role UI exposed to wrong user |

**Priority:** HIGH — start with the four data-integrity tests (scoring, completion, migration, sync) because they each have silent-failure modes.

---

## Fragile Areas — handle with care

### F1 — Single render-everything function
- `render()` at `app.js:694-727` clears `#app` and rebuilds the world on every state change. There are 51 call sites. It also kills the chart instance (`app.js:695`) every time. Any new feature that relies on retained DOM state (e.g. an open modal, a focused input, a half-typed message) will lose that state on any unrelated render.
- **Safe modification:** Don't add features that need persistent input focus inside the main render path. The chat input survives only because it's inside a card that gets full-rebuilt and the focus-loss is hidden by short renders.

### F2 — `localStorage` is the working cache *and* the source of truth for auth
- Clearing localStorage signs the user out and abandons any responses not yet pushed to Firestore (push is debounced 400ms — `app.js:2613, 2626`).
- **Safe modification:** Be very careful adding "clear cache" / "reset" affordances. There's already a foot-gun at `app.js:4068-4082` (`clearOldScaleResponsesIfNeeded`).

### F3 — Live Firestore subscription for chat creates a re-render on every message
- `app.js:392-397` calls `render()` from inside the `onSnapshot` callback. A burst of incoming messages triggers a burst of full-app re-renders. Combined with F1's chart destruction, this can flicker the dashboard.
- **Safe modification:** Don't add expensive computations to `render()` without memoisation.

---

## Scaling Limits

| Resource | Current capacity | Limit | Path |
|---|---|---|---|
| Org doc size | One Firestore doc per org | 1 MiB Firestore doc limit | An org with ~5,000 responses + 1,000 comments will approach the cap. Move `responses`, `comments`, `actions` into subcollections (`orgs/{id}/responses/{userId}`). |
| Concurrent chat subscribers | All internal users subscribe to entire `messages` collection (`app.js:384`) | Firestore read costs scale linearly | Already costs ~N×M reads at idle. Add `where("orgId", "in", […]) ` once internal users are scoped to orgs. |
| Document upload bucket | No size cap, no count cap | Firebase Storage quota | See H6. |
| localStorage per-user | Each user holds every org's full blob locally (`app.js:2701`) | 5–10 MiB browser quota | A user assigned to 50 orgs with 500 responses each will exceed quota and silently fail to persist. |

---

## Dependencies at Risk

| Dependency | Source | Risk |
|---|---|---|
| `firebase-app/firestore/auth/storage` 10.13.0 | `firebase-init.js:4-14` (gstatic CDN, no SRI) | Pinned to 10.13.0 — currently safe but unmonitored. No `package.json`, so Dependabot/Renovate can't run. Firebase JS SDK is at v11+ as of 2025. |
| `chart.js@4.4.1` | `index.html:12` (jsdelivr CDN, no SRI) | Same: no monitoring. Subresource Integrity not set. |

**Migration plan:** Add a `package.json`, install `firebase` and `chart.js` as `dependencies`, build with Vite (or esbuild), self-host the bundles. Then enable Dependabot.

---

## Missing Critical Features

| Feature gap | Blocks |
|---|---|
| Server-side authorisation (Firestore rules) | Any compliance / contractual position on data isolation |
| Real per-user authentication | MFA, password reset, account lifecycle |
| Audit log of who changed what | Internal trust; "who deleted that comment?" investigations |
| Backup / export schedule | DR — currently only the manual `exportData()`/`importData()` (`app.js:4015-4061`) which a user must run by hand |
| Soft-delete / undo | A misclick on "Delete org" cascades to all client users (`app.js:111-119`); no recovery |
| Rate limiting on chat / comment writes | Spam, abuse, denial-of-wallet on Firestore reads |

---

## Summary — Recommended Fix Order

1. **Today:** Author + deploy `firestore.rules` and `storage.rules` (C3, H6). This is the single highest-leverage fix and unblocks honest assessment of everything else.
2. **This week:** Remove hardcoded `INTERNAL_PASSWORD_HASH` (C2), move to Firebase Auth Email/Password with custom claims (C1, M6). Add basic CSP (H4).
3. **Next sprint:** Replace `Math.random()` with `crypto.randomUUID()` (H5). Add `package.json` + Vite + Vitest (H1, H2). Write data-integrity tests for scoring/migration/sync (H2 + Test Coverage Gaps).
4. **Backlog:** Tier-2 items (M1–M9, scaling concerns, dependency monitoring).

---

*Concerns audit: 2026-05-03*
*Cross-reference: `SECURITY_AUDIT.md` (root) — third-party audit playbook used as the framework for this review.*
