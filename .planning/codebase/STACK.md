# Technology Stack

**Analysis Date:** 2026-05-03

## Languages

**Primary:**
- JavaScript (ES2017+, vanilla / no transpiler) - Application logic in `app.js`, data definitions in `data/pillars.js`, Firebase wiring in `firebase-init.js`. Uses native `async/await`, optional chaining (`?.`), template literals, and `class`-free IIFE module pattern (`app.js` line 11: `(function () { "use strict"; ...`).
- HTML5 - Single static page `index.html` (27 lines). App shell mounted by JS into `<div id="app">`.
- CSS3 - Single stylesheet `styles.css` (~2,150 lines) using CSS custom properties (`:root` variables), media queries, and print rules.

**Secondary:**
- Python 3 - Local dev server only at `.claude/serve.py` (12 lines, `http.server.SimpleHTTPRequestHandler`). Not part of production runtime.

## Runtime

**Environment:**
- Browser-only (no Node.js runtime). The application is a static single-page app served as plain files. ES module support required (`firebase-init.js` is loaded via `<script type="module">` in `index.html` line 22).
- Local development: Python `http.server` on port 5178 via `.claude/serve.py` (configured in `.claude/launch.json`).

**Package Manager:**
- None. There is no `package.json`, `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml` in the repository. All third-party code is loaded from CDNs at runtime.
- Lockfile: not applicable (no package manager).

## Frameworks

**Core:**
- None. Vanilla JavaScript only. UI rendering is handled by an in-house `h(tag, attrs, children)` helper in `app.js` that creates DOM nodes directly (no React/Vue/Svelte). View state lives in a plain `state` object; the app re-renders by replacing `#app`'s children.

**Testing:**
- None detected. No test runner, test files, or testing framework references exist in the repo (no `*.test.js`, no `*.spec.js`, no `jest`/`vitest`/`mocha` references).

**Build/Dev:**
- No build step. Files are served as-is. Cache-busting is achieved via querystring versioning on `<script>` tags in `index.html` (`?v=46` on `firebase-init.js`, `data/pillars.js`, and `app.js`).

## Key Dependencies

**Critical (loaded from CDN at runtime):**
- `firebase-app` 10.13.0 - App initialisation. Imported in `firebase-init.js` line 4 from `https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js`.
- `firebase-firestore` 10.13.0 - Cloud Firestore client. Imported in `firebase-init.js` line 5 (modular API: `getFirestore`, `collection`, `doc`, `setDoc`, `getDoc`, `getDocs`, `addDoc`, `updateDoc`, `deleteDoc`, `query`, `where`, `orderBy`, `onSnapshot`, `serverTimestamp`, `limit`).
- `firebase-auth` 10.13.0 - Auth client (anonymous sign-in only). Imported in `firebase-init.js` line 9 (`getAuth`, `signInAnonymously`, `onAuthStateChanged`).
- `firebase-storage` 10.13.0 - Cloud Storage for file uploads. Imported in `firebase-init.js` line 12 (`getStorage`, `ref`, `uploadBytesResumable`, `getDownloadURL`, `deleteObject`).
- `chart.js` 4.4.1 - Radar chart on diagnostic results and donut on report views. Loaded UMD build via `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js" defer>` in `index.html` line 12. Used in `app.js` (line 1565: radar `new Chart(...)`, line 2377: donut chart).

**Infrastructure:**
- Google Fonts (Bebas Neue + Inter) - Loaded in `index.html` lines 9-11 via `https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600;700&display=swap`. Bebas Neue used for display headings (see `styles.css` line 48 `--font-display`).

## Configuration

**Environment:**
- No `.env` files. No environment variables. No build-time configuration.
- Firebase config is hard-coded as a literal object in `firebase-init.js` lines 16-23 (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`). These are public-by-design Firebase web config values; protection relies on Firebase Security Rules server-side.
- Internal-user gate: hard-coded allowlist + SHA-256 password hash in `app.js` lines 443-444 (`INTERNAL_ALLOWED_EMAILS = ["luke@bedeveloped.com", "george@bedeveloped.com"]`, `INTERNAL_PASSWORD_HASH = "6110f27c..."`). Comment at line 441-442 explicitly notes this is a "light access gate, not real auth".
- Custom domain: `baselayers.bedeveloped.com` defined in `CNAME` (single-line file) — indicates GitHub Pages or similar static-host deployment.

**Build:**
- No build config files. No `tsconfig.json`, `webpack.config.js`, `vite.config.*`, `rollup.config.*`, `babel.config.*`, or `.eslintrc*`. No bundler, transpiler, linter, or formatter is configured.

## Platform Requirements

**Development:**
- Any modern browser supporting ES modules and async/await.
- Python 3 to run the local static server (`.claude/serve.py`). Note: the script's `os.chdir` path is hard-coded to a Mac user's local path (`/Users/lukebadiali/Documents/...`) — non-portable.
- Editor of choice. Repo carries no editor-specific config (`.vscode/`, `.idea/` are git-ignored per `.gitignore` lines 2-3).

**Production:**
- Any static file host. Content of repo deploys directly: `index.html`, `app.js`, `firebase-init.js`, `data/pillars.js`, `styles.css`, `assets/`.
- Custom domain configured via `CNAME` (`baselayers.bedeveloped.com`) — consistent with GitHub Pages.
- Browser must be able to reach: `www.gstatic.com` (Firebase SDKs), `cdn.jsdelivr.net` (Chart.js), `fonts.googleapis.com` + `fonts.gstatic.com` (Google Fonts), and the Firebase project endpoints (Firestore, Storage, Identity Toolkit) for the project `bedeveloped-base-layers`.

---

*Stack analysis: 2026-05-03*
