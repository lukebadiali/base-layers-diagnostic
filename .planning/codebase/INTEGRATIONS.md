# External Integrations

**Analysis Date:** 2026-05-03

## APIs & External Services

**Firebase (Google Cloud) — sole backend:**
- Firebase project: `bedeveloped-base-layers` (config in `firebase-init.js` lines 16-23). The Firebase web app config object is hard-coded into client JS:
  - `apiKey: "AIzaSyDV3RNRFxAoVkSHOMyfl6HqgGTwaenLYfY"` (public web API key, not a secret in Firebase's threat model — security relies on Firebase Security Rules, not on this value).
  - `authDomain: "bedeveloped-base-layers.firebaseapp.com"`
  - `projectId: "bedeveloped-base-layers"`
  - `storageBucket: "bedeveloped-base-layers.firebasestorage.app"`
  - `messagingSenderId: "76749944951"`
  - `appId: "1:76749944951:web:9d0db9603ecaa7cc5fee72"`
- SDK/Client: Firebase Modular SDK 10.13.0, loaded via ES module imports from `https://www.gstatic.com/firebasejs/10.13.0/...` in `firebase-init.js`. Exposed to non-module code as `window.FB` (lines 33-42).
- Auth: anonymous sign-in only — `signInAnonymously(auth)` called once on load (`firebase-init.js` line 52). No env-var-based credentials.

**Chart.js (jsDelivr CDN):**
- Loaded from `https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js` (`index.html` line 12).
- Used for the diagnostic radar chart (`app.js` line 1565) and the report donut chart (`app.js` line 2377). Accessed via the global `window.Chart`.
- No auth, no env var. Public CDN.

**Google Fonts:**
- `https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;500;600;700&display=swap` (`index.html` line 11).
- `<link rel="preconnect">` to both `fonts.googleapis.com` and `fonts.gstatic.com` (`index.html` lines 9-10) for performance.
- No auth, no env var. Public CDN.

## Data Storage

**Databases:**
- Cloud Firestore (Firebase project `bedeveloped-base-layers`).
  - Connection: implicit via the Firebase Web SDK; no explicit connection string. Project resolved from `firebaseConfig.projectId` in `firebase-init.js` line 19.
  - Client: `firebase-firestore` 10.13.0 modular SDK, exposed as `window.FB.firestore` in `firebase-init.js` lines 37-40.
  - Collections in use (`app.js`):
    - `orgs/{orgId}` - one doc per client organisation, full org state. Written by `cloudPushOrg` (`app.js` lines 2610-2620), fetched by `cloudFetchAllOrgs` (line 2656), deleted by `cloudDeleteOrg` (line 2636).
    - `users/{userId}` - one doc per user. Written by `cloudPushUser` (line 2623), fetched by `cloudFetchAllUsers` (line 2668), deleted by `cloudDeleteUser` (line 2646).
    - `messages` - chat messages. Written via `addDoc` (line 2988), subscribed via `onSnapshot` filtered by `orgId` (lines 386-387, 3008-3012), deleted by id (line 2967). Internal users see all; client users see only their org's `messages`.
    - `documents/{docId}` - file metadata for Storage uploads (`app.js` lines 2768-2781). Real-time list via `onSnapshot` filtered by `orgId` (lines 2814-2818).
    - `roadmaps/{orgId}` - one doc per org, real-time roadmap data (`app.js` line 3064, write at line 3096, subscribe at line 3252).
    - `funnels/{orgId}` - one doc per org, sales funnel numbers (`app.js` line 3345).
    - `funnelComments` - comments on funnel KPIs. `addDoc` at line 3765, `onSnapshot` at line 3785, `deleteDoc` at line 3746.

- Browser `localStorage` is used as a working cache and the v1 source of truth before cloud sync; comment at `app.js` line 2604: "localStorage is the working cache; Firestore is the source of truth." Keys are namespaced under `baselayers:` (see `app.js` lines 18-27): `baselayers:users`, `baselayers:session`, `baselayers:settings`, `baselayers:orgs`, `baselayers:mode`, `baselayers:org:{id}`, `baselayers:active` (v1 compat), `baselayers:chatLastRead:{userId}` (line 337).

**File Storage:**
- Firebase Cloud Storage on bucket `bedeveloped-base-layers.firebasestorage.app`.
- Path scheme: `orgs/{orgId}/documents/{docId}/{filename}` (`app.js` line 2759).
- Uploads use `uploadBytesResumable` with progress callback (`app.js` lines 2761-2766). Downloads served via `getDownloadURL` URLs persisted in the Firestore `documents` doc (`app.js` line 2767).
- Deletion via `deleteObject` paired with `deleteDoc` (`app.js` lines 2858-2860).

**Caching:**
- `localStorage` — see Databases above. Acts as offline-friendly cache; cloud sync runs on `firebase-ready` event (`app.js` line 3300-3304: `syncFromCloud()` triggered when Firebase auth resolves).

## Authentication & Identity

**Auth Provider:**
- Firebase Authentication — anonymous sign-in only.
  - Implementation: `signInAnonymously(auth)` in `firebase-init.js` line 52, with `onAuthStateChanged` resolving a `ready` promise (lines 30-31, 44-50). No email/password, OAuth, OIDC, or SAML against Firebase.
  - Application-level identity is layered on top inside `app.js`:
    - "Internal" users (BeDeveloped staff) gated by a hard-coded email allowlist + SHA-256 password hash (`app.js` lines 443-444, `INTERNAL_ALLOWED_EMAILS = ["luke@bedeveloped.com", "george@bedeveloped.com"]`, `INTERNAL_PASSWORD_HASH = "6110f27c..."`). Hashing uses `crypto.subtle.digest("SHA-256", ...)` (`app.js` lines 414-425). Source comment (lines 441-442) explicitly notes: "this hash lives in a public repo. Treat as a light access gate, not real auth."
    - "Client" users are identified by email/passphrase combos stored as user records in Firestore `users` collection — application-level only; Firebase Auth never sees them as distinct identities (everything runs under one anonymous Firebase user).

## Monitoring & Observability

**Error Tracking:**
- None. No Sentry, Datadog, Rollbar, or LogRocket. Errors surface via `console.error` (e.g. `firebase-init.js` line 52, `app.js` line 397 chat subscription error handler) and inline error messages in the UI.

**Logs:**
- Browser console only. No remote logging.

## CI/CD & Deployment

**Hosting:**
- Static hosting at `baselayers.bedeveloped.com` (per `CNAME` file). Pattern is consistent with GitHub Pages serving directly from the repo's `main` branch root.

**CI Pipeline:**
- None detected. No `.github/workflows/`, no `.gitlab-ci.yml`, no `vercel.json`, no `netlify.toml`, no `wrangler.toml`.

## Environment Configuration

**Required env vars:**
- None. The application has no environment variables. All configuration is committed in source:
  - Firebase web config: `firebase-init.js` lines 16-23.
  - Internal-user allowlist + password hash: `app.js` lines 443-444.
  - Custom domain: `CNAME`.
  - Sign-in URL surfaced in onboarding emails: `app.js` line 3874 (`https://baselayers.bedeveloped.com`).

**Secrets location:**
- No secrets directory. No `.env*` (none exist; `.gitignore` does not list `.env` patterns, but no env files are present in the working tree). The Firebase web API key is non-secret by design; the SHA-256 password hash for internal access is committed to the public repo (acknowledged in the source comment at `app.js` lines 441-442).

## Webhooks & Callbacks

**Incoming:**
- None. The app has no server, hence no webhook receivers. All inbound state changes are routed through Firestore real-time listeners (`onSnapshot` calls in `app.js` lines 392, 2818, 3012, 3252, 3785).

**Outgoing:**
- None. No `fetch()` to third-party REST APIs from the app code. The only network egress is to Firebase services (via the Firebase SDK), Chart.js / Google Fonts CDNs (page load), and `mailto:` / clipboard handoffs for invitation emails (`navigator.clipboard.writeText` at `app.js` line 3900).

---

*Integration audit: 2026-05-03*
