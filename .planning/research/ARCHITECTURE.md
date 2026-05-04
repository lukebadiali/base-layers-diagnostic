# Architecture Research — Firebase Hardening Pass

**Domain:** Compliance-credible Firebase web SaaS — hardening of an existing live app
**Researched:** 2026-05-03
**Confidence:** HIGH
**Mode:** Project research (architecture dimension), subsequent milestone

> Read first: `.planning/codebase/ARCHITECTURE.md` (current single-IIFE state), `.planning/codebase/CONCERNS.md` (the 4 CRITICAL + 8 HIGH findings this milestone closes), `.planning/PROJECT.md` (constraints — stay on Firebase, vanilla JS).
>
> This document recommends the **target** architecture. It is not a description of what's there today.

---

## 0. Constraints and assumptions baked into every recommendation

These are non-negotiable inputs (decided in `PROJECT.md`) that constrained every choice below:

- **Stay on Firebase** (Auth, Firestore, Storage, Functions, App Check, Hosting). No migration.
- **Stay on vanilla JS** (no React/Vue/Svelte). Add `package.json` + Vite + Vitest + JSDoc types.
- **No live users**, so clean cutover migrations are acceptable.
- **Compliance bar = credible, not certified**. Honest mapping to SOC2 CC / ISO27001 Annex A / GDPR Art. 32 / OWASP ASVS L2.
- **Hardening of existing 4,103-line `app.js` IIFE**, not greenfield design. Recommendations explicitly ladder from the current shape (org JSON tree at `orgs/{id}`, anonymous Auth, hardcoded allowlist) to the target shape, without an intermediate "rewrite the world" step.
- **Security controls don't get weakened to make features pass** (`SECURITY_AUDIT.md` §0(4)).

---

## 1. Target System Overview

### Logical layers (target end-state)

```
┌──────────────────────────────────────────────────────────────────────┐
│                       BROWSER (vanilla JS, ES modules)               │
│                                                                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐      │
│  │ views/*.js │  │   ui.js    │  │ chrome.js  │  │  router.js │      │
│  │ (per-route)│  │ (h, modal) │  │ (topbar /  │  │ (route     │      │
│  │            │  │            │  │  footer)   │  │  switch)   │      │
│  └─────┬──────┘  └────────────┘  └────────────┘  └────────────┘      │
│        │                                                              │
│  ┌─────▼────────┐  ┌─────────────┐  ┌──────────────┐  ┌─────────┐    │
│  │ domain/*.js  │  │  state.js   │  │ observability│  │telemetry│    │
│  │ (pure logic: │  │ (in-memory  │  │  /sentry.js  │  │ /audit. │    │
│  │  scoring,    │  │  singleton) │  │              │  │  js     │    │
│  │  banding)    │  │             │  │              │  │         │    │
│  └──────────────┘  └─────────────┘  └──────────────┘  └─────────┘    │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                    firebase/ (adapter — single import       │     │
│  │   point for the SDK; rest of the code never imports         │     │
│  │   firebase/* directly)                                      │     │
│  │  app.js  auth.js  db.js  storage.js  functions.js  check.js │     │
│  └────────────────────────────┬────────────────────────────────┘     │
│                               │                                      │
│  ┌──────────────┐  ┌──────────▼──────┐  ┌──────────────┐             │
│  │  auth.js     │  │  data/*.js      │  │ cloud-fns.js │             │
│  │ (sign-in,    │  │ (typed wrappers │  │ (callable    │             │
│  │  claims,     │  │  per collection;│  │  Function    │             │
│  │  MFA flow)   │  │  no listener    │  │  clients)    │             │
│  │              │  │  leaks)         │  │              │             │
│  └──────────────┘  └─────────────────┘  └──────────────┘             │
└──────────────────────────────────────────────────────────────────────┘
                  │ HTTPS, App Check token, ID token (custom claims)
                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│  EDGE: Firebase Hosting (CSP / HSTS / X-CTO / Referrer-Policy /      │
│  Permissions-Policy headers; SRI on any external script if kept)     │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────────┐
│                        FIREBASE BACKEND                              │
│                                                                       │
│  ┌─────────────────┐   ┌──────────────────┐   ┌──────────────────┐   │
│  │ Firebase Auth   │   │ App Check        │   │ Firestore Rules  │   │
│  │ (Email/Password │   │ (reCAPTCHA       │   │ + Storage Rules  │   │
│  │  + MFA TOTP for │   │  Enterprise on   │   │ (orgId-scoped,   │   │
│  │  internal)      │   │  web)            │   │  custom-claims   │   │
│  │                 │   │                  │   │  driven)         │   │
│  │ + custom claims │   │                  │   │                  │   │
│  │   {role, orgId} │   │                  │   │                  │   │
│  └────────┬────────┘   └────────┬─────────┘   └────────┬─────────┘   │
│           │                     │                      │             │
│           │ blocking trigger    │ token gate           │             │
│           ▼                     ▼                      │             │
│  ┌────────────────────────────────────────────────────▼─────────┐    │
│  │                Cloud Functions for Firebase (2nd gen, TS)    │    │
│  │                                                              │    │
│  │  beforeUserCreated   beforeUserSignedIn   onCallAuditWrite   │    │
│  │  scheduledBackup     onCallSoftDelete     onCallRestore      │    │
│  │  onCallExportUser    onCallEraseUser      onCallSetClaims    │    │
│  │  rateLimitedWrite    onUserDelete         (plus Firestore    │    │
│  │                                            mirror triggers   │    │
│  │                                            for audit)        │    │
│  └─────────────────────┬────────────────────────────────────────┘    │
│                        │                                             │
│  ┌─────────────────────▼─────────┐  ┌────────────────────────────┐   │
│  │         Firestore             │  │    Cloud Storage           │   │
│  │                               │  │                            │   │
│  │  orgs/{id}                    │  │  orgs/{id}/documents/      │   │
│  │  ├─ responses/{respId}        │  │     {docId}/{filename}     │   │
│  │  ├─ comments/{cmtId}          │  │  (size cap, MIME allowlist,│   │
│  │  ├─ actions/{actId}           │  │   sanitised filename)      │   │
│  │  ├─ documents/{docId}         │  │                            │   │
│  │  ├─ messages/{msgId}          │  └────────────────────────────┘   │
│  │  └─ readStates/{userId}       │                                   │
│  │                               │                                   │
│  │  users/{uid}                  │                                   │
│  │  internalAllowlist/{email}    │                                   │
│  │  roadmaps/{orgId}             │                                   │
│  │  funnels/{orgId}              │                                   │
│  │  funnelComments/{id}          │                                   │
│  │  auditLog/{eventId}    ◄──── append-only, server-only writes     │
│  │  rateLimits/{userId}/         │                                   │
│  │     buckets/{window}          │                                   │
│  │  softDeleted/{type}/items/{id}│                                   │
│  └───────────────┬───────────────┘                                   │
│                  │ Cloud Audit Logs (Admin Activity = always on)     │
│                  ▼                                                   │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  Cloud Logging  →  Log Sink  →  BigQuery (audit dataset)     │    │
│  │                            +  GCS bucket (nightly export)    │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
                  │
                  ▼
        ┌──────────────────────┐
        │  Sentry              │  ← browser SDK + Functions SDK both report here
        │  (errors,            │
        │   compliance events  │
        │   as breadcrumbs)    │
        └──────────────────────┘
```

### Component responsibilities (target)

| Component                         | Responsibility                                                                                                                                                                                | Implementation                                                                                                                                                                                           |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `firebase/` (adapter)             | Sole import surface for the Firebase SDK. Exposes typed helpers; everything else imports from this folder, never `firebase/*` directly.                                                       | One module per SDK area: `firebase/app.js`, `auth.js`, `db.js`, `storage.js`, `functions.js`, `check.js`. Initialises App + App Check first.                                                             |
| `auth.js`                         | Sign-in / sign-out / claims read / MFA enrolment / token refresh on role change. Single source of truth for "who is the user, what role, what orgId."                                         | Wraps Firebase Auth Email/Password + multi-factor (TOTP). Reads `idTokenResult.claims` for `role` / `orgId`.                                                                                             |
| `data/` (per-collection wrappers) | Typed CRUD per Firestore collection (`orgs`, `users`, `responses`, `comments`, `actions`, `documents`, `messages`, `roadmaps`, `funnels`, `funnelComments`). Owns its own listener lifecycle. | One file per collection. Exports `subscribe*()` returning unsubscribe; `add*()` / `update*()` / `softDelete*()` callable.                                                                                |
| `domain/`                         | Pure functions over the domain types: scoring, banding, completion %, top-constraints. Zero Firebase imports.                                                                                 | `domain/scoring.js`, `domain/comments.js`, `domain/migration.js`. Trivially unit-testable.                                                                                                               |
| `cloud-fns.js`                    | Client wrappers around callable Cloud Functions. Adds App Check token, retries on 429.                                                                                                        | Thin: `httpsCallable(functions, "auditWrite")(payload)` style.                                                                                                                                           |
| `views/*.js`                      | One file per route. Each exports `renderX(user, org, deps)` returning a DOM node.                                                                                                             | `dashboard.js`, `diagnostic.js`, `pillar.js`, `actions.js`, `engagement.js`, `report.js`, `documents.js`, `chat.js`, `roadmap.js`, `funnel.js`, `admin.js`, `auth.js` (sign-in / first-run / MFA enrol). |
| `ui.js`                           | DOM helpers (`h`, `modal`, `promptText`, `confirmDialog`, `toast`). No business logic. The `html:` escape hatch in `h()` is **deleted** (CONCERNS C4).                                        | Pure DOM.                                                                                                                                                                                                |
| `chrome.js`                       | Topbar + footer.                                                                                                                                                                              | Imports auth + view registry.                                                                                                                                                                            |
| `router.js`                       | Route switch. Optionally adds History API for share-able URLs (out of scope this milestone — keep string switch).                                                                             | One `setRoute` / `render` pair, same as today.                                                                                                                                                           |
| `state.js`                        | In-memory singleton. **Loses the role of "auth source of truth"** — that moves to Firebase Auth claims.                                                                                       | Smaller than today.                                                                                                                                                                                      |
| `observability/sentry.js`         | Init Sentry once on boot; expose `captureError(err, context)` and `addBreadcrumb({category, message, data})`.                                                                                 | Sentry browser SDK.                                                                                                                                                                                      |
| `telemetry/audit.js`              | Client-side helper that emits an audit event to the `auditWrite` Cloud Function. Used for: sign-in, sign-out, role change, deletes, exports, MFA enrol, password change.                      | Calls `cloud-fns.js`. Treats failures as best-effort + Sentry breadcrumb.                                                                                                                                |
| Cloud Functions (TS, 2nd gen)     | The trusted server: claim-setting on signup, audit-log writing, soft-delete + restore, rate limiting, daily backup, GDPR export/erase.                                                        | See §3.                                                                                                                                                                                                  |
| Firestore + Storage Rules         | The actual authorization boundary. Read `request.auth.token.role` / `request.auth.token.orgId` for scope.                                                                                     | See §4.                                                                                                                                                                                                  |
| App Check                         | Binds the deployed web app to legitimate clients.                                                                                                                                             | reCAPTCHA Enterprise provider.                                                                                                                                                                           |
| Firebase Hosting                  | Replaces GitHub Pages. Serves the static bundle and sets CSP / HSTS / X-Content-Type-Options / Referrer-Policy / Permissions-Policy via `firebase.json` headers.                              | See §6.                                                                                                                                                                                                  |
| Cloud Logging + BigQuery sink     | Audit log of last resort: GCP Admin Activity Logs (always on, can't be disabled or edited).                                                                                                   | Set up a sink to a dedicated BigQuery dataset for retention + queryability. See §5.                                                                                                                      |
| Sentry (or equivalent)            | Centralised error sink for browser + Functions.                                                                                                                                               | See §7.                                                                                                                                                                                                  |

---

## 2. Module boundaries — recommended split

### Decision: **YES, build a `firebase/` adapter**

Rationale (HIGH confidence):

1. **Testability.** Vitest can stub `firebase/db.js` to return canned snapshots. Today, every view imports the SDK directly via `window.FB`, so unit-testing a render function requires booting the real SDK.
2. **Single boot location.** App Check has to initialise _before_ any other SDK call uses Firestore/Auth/Storage, otherwise tokens are missing and rules deny. Centralising init in `firebase/app.js` makes that ordering enforceable.
3. **Future-portability is a side benefit, not the driver.** If you ever did want to swap (Firebase → Supabase, say), the adapter limits the blast radius. But for _this_ milestone, the testability win alone justifies it.
4. **Audit narrative.** "All Firestore writes go through `data/`, which goes through `firebase/db.js`, which adds App Check + retry policy" is a _much_ tighter sentence to tell an auditor than "every view file calls the SDK directly."

### Recommended source layout

```
src/
├── main.js                    # entry point — boots everything in order
├── firebase/                  # SDK adapter (the only place that imports firebase/*)
│   ├── app.js                 # initializeApp + App Check, exports `app`
│   ├── auth.js                # Auth instance + helpers (signIn, signOut, multiFactor enrol)
│   ├── db.js                  # Firestore instance + helpers (doc, collection, onSnapshot wrapper)
│   ├── storage.js             # Storage instance + uploadBytesResumable wrapper
│   ├── functions.js           # Functions instance + httpsCallable wrapper
│   └── check.js               # App Check init (reCAPTCHA Enterprise)
├── data/                      # per-collection typed wrappers — depend only on firebase/db.js
│   ├── orgs.js
│   ├── users.js
│   ├── responses.js           # NEW — was nested inside the org doc
│   ├── comments.js            # NEW — was nested inside the org doc
│   ├── actions.js             # NEW — was nested inside the org doc
│   ├── documents.js
│   ├── messages.js
│   ├── roadmaps.js
│   ├── funnels.js
│   ├── funnel-comments.js
│   ├── audit-events.js        # client of cloud-fns.js, not direct Firestore writes
│   └── allowlist.js           # internalAllowlist read-only client (admin only)
├── domain/                    # pure logic — zero Firebase imports
│   ├── scoring.js             # pillarScoreForRound, pillarStatus, deriveAnchors
│   ├── completion.js          # answeredCount, userCompletionPct, orgSummary
│   ├── banding.js             # red/amber/green thresholds
│   ├── unread.js              # comment + chat unread tracking (server-clock now)
│   ├── migration.js           # v1→v2 + scaleV2 (kept until purged from data)
│   └── ids.js                 # crypto.randomUUID() wrapper (replaces Math.random())
├── auth/                      # session-layer logic on top of firebase/auth.js
│   ├── session.js             # currentUser, role, orgId; force-refresh on claim updates
│   ├── mfa.js                 # MFA enrol / verify flow (TOTP)
│   └── claims.js              # claim-shape constants + validators
├── cloud/                     # callable Cloud Functions clients
│   ├── audit.js               # client of auditWrite function
│   ├── soft-delete.js         # client of softDelete + restore
│   ├── gdpr.js                # client of exportUser + eraseUser
│   ├── claims-admin.js        # client of setClaims (admin-only)
│   └── retry.js               # exponential backoff helper, 429-aware
├── views/                     # one file per route; each exports renderX(deps)
│   ├── auth.js                # sign-in, first-run, MFA enrol, password reset
│   ├── dashboard.js
│   ├── diagnostic.js
│   ├── pillar.js
│   ├── actions.js
│   ├── engagement.js
│   ├── report.js
│   ├── documents.js
│   ├── chat.js
│   ├── roadmap.js
│   ├── funnel.js
│   └── admin.js
├── ui/
│   ├── dom.js                 # h() — html: escape hatch DELETED (CONCERNS C4)
│   ├── modal.js               # modal, promptText, confirmDialog
│   ├── toast.js               # NEW — replaces alert() per CONCERNS M3
│   ├── format.js              # formatWhen, firstNameFromAuthor, etc.
│   └── chrome.js              # topbar, footer
├── observability/
│   ├── sentry.js              # init + captureError + addBreadcrumb
│   └── audit-events.js        # constant set of event types ("auth.signin.success", "data.org.delete", etc.)
├── state.js                   # in-memory state singleton (smaller than today)
└── router.js                  # setRoute + render dispatch (string switch, no URL hash for now)

functions/                     # Cloud Functions (deployed separately to Firebase project)
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts               # exports
│   ├── auth/
│   │   ├── before-user-created.ts
│   │   ├── before-user-signed-in.ts
│   │   └── set-claims.ts
│   ├── audit/
│   │   ├── on-call-audit-write.ts
│   │   └── triggers/         # Firestore-trigger mirror writes (defence in depth)
│   │       ├── on-org-delete.ts
│   │       ├── on-user-delete.ts
│   │       └── on-document-delete.ts
│   ├── lifecycle/
│   │   ├── on-call-soft-delete.ts
│   │   ├── on-call-restore.ts
│   │   └── scheduled-purge.ts            # delete soft-deleted records past retention
│   ├── gdpr/
│   │   ├── on-call-export-user.ts
│   │   └── on-call-erase-user.ts
│   ├── ratelimit/
│   │   └── on-call-rate-limited.ts       # token-bucket helper used by chat / comments
│   ├── backup/
│   │   └── scheduled-firestore-export.ts
│   └── shared/
│       ├── claims.ts
│       ├── audit-events.ts
│       └── retry.ts
└── test/                                 # Vitest unit tests for pure logic
                                          # + emulator integration tests for triggers

firestore.rules
storage.rules
firebase.json                 # Hosting + Functions + Firestore + Storage config (incl. headers)
.firebaserc
package.json                  # root — Vite + Vitest + lint
vite.config.js
vitest.config.js
.github/workflows/ci.yml      # typecheck + test + audit + build
```

### Helpers — where they live

| Helper                                       | Today (`app.js` line) | Target location                      | Notes                                                                                                                                                              |
| -------------------------------------------- | --------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `h(tag, attrs, children)`                    | 610-626               | `src/ui/dom.js`                      | **Delete the `html:` branch** (C4).                                                                                                                                |
| `modal()`, `promptText()`, `confirmDialog()` | 629-684               | `src/ui/modal.js`                    | Mounts to `#modalRoot`. Add `toast()` here too.                                                                                                                    |
| `formatWhen()`, `iso()`, `escapeHtml()`      | 33-48                 | `src/ui/format.js`                   | `iso()` becomes "client-clock display only — never compared to server-clock"; the unread-tracking comparator (CONCERNS H7) uses `serverTimestamp()` on both sides. |
| `firstNameFromAuthor()`                      | search caller         | `src/ui/format.js`                   | Resolution helper.                                                                                                                                                 |
| `hashString()` (SHA-256)                     | 414                   | **Delete**                           | Was the password-hash helper for the local allowlist (C2). Firebase Auth handles password hashing.                                                                 |
| Storage helpers `jget`/`jset`                | 73-77                 | `src/state.js` (drastically reduced) | After the migration, `localStorage` is _not_ the source of truth for anything. Only used for UI prefs (collapsed pillars, last-route).                             |

### Module dependency rules (enforce via lint)

```
domain/         depends on: nothing (pure)
firebase/       depends on: firebase SDK only
data/           depends on: firebase/, domain/types
auth/           depends on: firebase/, observability/audit-events
cloud/          depends on: firebase/functions
ui/             depends on: nothing (pure DOM)
observability/  depends on: firebase/auth (for user id only)
views/          depends on: data/, domain/, auth/, ui/, cloud/
router.js       depends on: views/
main.js         depends on: everything in order
```

The point: a unit test for `domain/scoring.js` needs **zero** Firebase mocks. A unit test for `data/orgs.js` mocks **only** `firebase/db.js`. A view test mocks `data/*`. That structure unblocks H1 + H2.

---

## 3. Cloud Functions — required set, structure, and runtime choice

### Decision: **2nd gen, TypeScript**

- **2nd gen (HIGH confidence):** [Firebase docs](https://firebase.google.com/docs/functions/version-comparison) explicitly recommend 2nd gen for new functions. Built on Cloud Run, fewer cold starts, per-instance concurrency, declarative config via `params` (the `functions.config` API is being decommissioned March 2027). Auth blocking triggers (`beforeUserCreated`, `beforeUserSignedIn`) work in both generations but the rest of the world has moved.
- **TypeScript (HIGH confidence):** Type safety on event payloads, claims shape, audit event schema, and emulator test fixtures. The marginal cost on top of Vite is `tsc` in the Functions package only — the browser code can stay vanilla JS with JSDoc.
- **Both gens can coexist** in a single `functions/src/index.ts` (different import paths from `firebase-functions/v1` vs `firebase-functions/v2`). Useful only if you find a 1st-gen-only feature; default to 2nd gen.

### Required Cloud Functions for compliance-credible posture

| Function                   | Generation                | Trigger                                       | Purpose                                                                                                                                                                                                           | Notes                                                                                                                         |
| -------------------------- | ------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `beforeUserCreated`        | Auth blocking             | New user signup                               | Look up email in `internalAllowlist/{email}` doc; set custom claims `{role, orgId}` on the user record. Write audit event. Reject creation if email not in allowlist (depending on policy — see §8).              | Hard 7s deadline. Keep allowlist read fast (single doc by ID).                                                                |
| `beforeUserSignedIn`       | Auth blocking             | Each sign-in                                  | Re-evaluate session claims if app permits role escalation between sessions; stamp last-sign-in audit event.                                                                                                       | Same 7s deadline. Use sparingly.                                                                                              |
| `auditWrite`               | 2nd gen Callable HTTPS    | Client `httpsCallable("auditWrite", payload)` | Validates the caller's claims, normalises the event, writes to `auditLog/{eventId}` (server-controlled UID, not client-supplied).                                                                                 | Rate-limited by per-user token bucket. Idempotency key on payload.                                                            |
| `setClaims`                | 2nd gen Callable HTTPS    | Admin user calls                              | Allows internal admins to grant/revoke `role` and `orgId` claims on other users. Writes audit event. Forces target user to refresh ID token next sign-in.                                                         | Auth: caller must have `role: "admin"` claim (a sub-role of internal).                                                        |
| `softDelete`               | 2nd gen Callable HTTPS    | Client                                        | Server-side soft-delete: copies the resource to `softDeleted/{type}/items/{id}`, marks original `deletedAt: serverTimestamp()`, writes audit event.                                                               | Restore window 30 days (configurable). Not exposed for orgs without admin claim.                                              |
| `restoreSoftDeleted`       | 2nd gen Callable HTTPS    | Admin user calls                              | Restore from `softDeleted/{type}/items/{id}`. Writes audit event.                                                                                                                                                 | Admin-only.                                                                                                                   |
| `scheduledPurge`           | 2nd gen Scheduler         | Daily                                         | Removes `softDeleted/*` records older than retention window. Writes audit summary event.                                                                                                                          | Cloud Scheduler cron `0 3 * * *`.                                                                                             |
| `scheduledFirestoreExport` | 2nd gen Scheduler         | Daily                                         | Calls Firestore managed export API to dump all collections to a dedicated GCS bucket.                                                                                                                             | Cloud Scheduler `0 2 * * *`. Bucket has 90-day lifecycle policy + Object Lock for tamper resistance. **Requires Blaze plan.** |
| `gdprExportUser`           | 2nd gen Callable HTTPS    | User self-service or admin                    | Generates a JSON of all data linked to a user (responses, comments, actions, messages they authored, audit events about them). Returns signed URL valid for 24h. Writes audit event.                              | Output goes to a private Storage bucket; signed URL not the data itself.                                                      |
| `gdprEraseUser`            | 2nd gen Callable HTTPS    | User self-service or admin                    | Deletes / pseudonymises user across all collections. Writes audit event. **Requires admin approval if user is `internal`.**                                                                                       | Two-phase: schedule for deletion at +T+30d (in case of mistake) unless admin override "delete now".                           |
| `onUserDelete`             | 2nd gen Auth event        | When a user is deleted                        | Cleanup: revoke sessions, mirror audit event.                                                                                                                                                                     | Defence-in-depth.                                                                                                             |
| `onOrgDelete`              | 2nd gen Firestore trigger | `orgs/{id}` deleted                           | Mirrors deletion as audit event from server's perspective even if client `auditWrite` failed.                                                                                                                     | Defence-in-depth.                                                                                                             |
| `onDocumentDelete`         | 2nd gen Storage trigger   | Object deleted in `orgs/*/documents/*`        | Mirrors as audit event.                                                                                                                                                                                           | Defence-in-depth.                                                                                                             |
| `rateLimitedChatWrite`     | 2nd gen Callable HTTPS    | Client                                        | Optional: enforce rate limit before chat write; wraps `messages` insert. (Alternative: enforce per-user rate in Rules using `rateLimits/{userId}` doc check, no Function needed for chat — simpler, recommended.) | If implementing Function-based: token-bucket pattern, 30 messages / 60s.                                                      |

### Cloud Functions structural conventions

- **Each function in its own file**, named after its export. `index.ts` only re-exports.
- **Shared logic in `shared/`**: claims helpers, audit event constants, retry, error classes.
- **Idempotency on every callable**: client passes a `clientReqId` (UUID); server stores a marker doc and rejects duplicates within 5 minutes.
- **Input validation with Zod**: every callable validates its payload against a schema before doing anything. Reject malformed; never "best-effort parse" (mirrors `SECURITY_AUDIT.md` §4 / LLM05).
- **Authorization re-checked inside the handler.** Don't trust that the caller is who they say they are because the Firebase SDK attached an ID token; _re-read_ the claims server-side and assert the operation is allowed for that role + orgId.
- **App Check enforcement on every callable.** Set `enforceAppCheck: true`.
- **Sentry init at the top of `index.ts`** before any handler imports (Sentry's Firebase Functions integration auto-instruments).

---

## 4. Firestore data model — split or stay flat?

### Decision: **Split the `orgs/{id}` document into subcollections**

Rationale (HIGH confidence — the [Firebase quotas](https://firebase.google.com/docs/firestore/quotas) page is unambiguous about the 1 MiB hard limit and subcollections being uncounted):

The current org doc carries `responses{roundId:{userId:{pillarId:{idx:{score, note}}}}}` plus `comments{}`, `actions[]`, `engagement{}`, `internalNotes{}`, `readStates{}`. Per CONCERNS scaling table, an org with ~5,000 responses + 1,000 comments approaches 1 MiB. That's a _hard_ future ceiling; right now you're not at it but the trajectory is bad. Splitting also closes CONCERNS H8 (last-writer-wins on the parent doc — moving children to subcollections eliminates the parent-doc-overwrite class of conflicts).

### Target Firestore data model

```
orgs/{orgId}                                     # parent doc — small, just metadata
├─ name, createdAt, currentRoundId, rounds[],
├─ tier, deletedAt, softDeletedBy
└─ engagement: { currentStageId, stageChecks{} } # small enough to stay nested
   └─ subcollections:
      ├─ responses/{respId}                      # one doc per (userId × pillarId × questionIdx × roundId)
      │     { roundId, userId, pillarId, qIdx, score, note, updatedAt }
      ├─ comments/{cmtId}
      │     { pillarId, authorId, body, internalOnly, createdAt }
      ├─ actions/{actId}
      │     { title, status, ownerId, dueAt, ... }
      ├─ documents/{docId}
      │     { filename, size, contentType, storagePath, uploadedBy, uploadedAt }
      ├─ messages/{msgId}
      │     { authorId, body, createdAt(serverTimestamp) }
      └─ readStates/{userId}
            { pillarReads{ pillarId: serverTimestamp }, chatLastRead: serverTimestamp }

users/{uid}                                      # uid = Firebase Auth UID, NOT an app-internal id
   { email, name, role: "internal" | "client" | "admin", orgId?,
     createdAt, mfaEnrolled, deletedAt? }

internalAllowlist/{emailLowercased}              # admin-managed; read by beforeUserCreated
   { role: "internal" | "admin", orgId?, addedBy, addedAt }

roadmaps/{orgId}                                 # keep as single doc (small enough)
funnels/{orgId}                                  # keep as single doc
funnelComments/{id}                              # already a flat collection
auditLog/{eventId}                               # append-only, server-only writes
   { type, actor: {uid, email, role}, target: {type, id, orgId},
     at: serverTimestamp(), ip?, userAgent?, payload, idempotencyKey }
softDeleted/{type}/items/{id}                    # soft-delete tombstone store
   { originalCollection, originalId, snapshot, deletedAt, deletedBy, restoreUntil }
rateLimits/{uid}/buckets/{windowStart}           # if using rules-based rate limit
```

### Subcollection vs separate top-level collection — choosing per resource

| Resource                                                                  | Pattern                             | Why                                                                                                                                           |
| ------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `responses`, `comments`, `actions`, `documents`, `messages`, `readStates` | **Subcollection of org**            | All naturally org-scoped; security rules express "must match `request.auth.token.orgId == <segment>`" cleanly; backup/export is hierarchical. |
| `roadmaps`, `funnels`                                                     | Top-level keyed by orgId            | Already works; small docs; not worth breaking the existing pattern.                                                                           |
| `funnelComments`                                                          | Top-level with `orgId` field        | Same as today. Could be moved to subcollection in a later sweep.                                                                              |
| `auditLog`                                                                | **Top-level**                       | Server-only writes. Querying across orgs (admin reports) is a first-class need. Subcollection-of-org would prevent that.                      |
| `softDeleted/{type}/items/{id}`                                           | Two-level top-level                 | Type segment lets soft-delete restore policies vary per resource type. Server-only writes.                                                    |
| `internalAllowlist`                                                       | Top-level keyed by lowercased email | Read by `beforeUserCreated`; admin-only writes.                                                                                               |

### Security Rules complexity — does the split make rules harder?

Slightly, but in a _healthy_ way. Subcollection rules are **per-path explicit** (Firestore rules don't cascade — see [Firebase Rules docs](https://firebase.google.com/docs/firestore/security/get-started)), so each resource gets its own block. That's actually clearer than one giant rule covering a deeply nested doc with 5 different read/write semantics inside it. Sketch:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() { return request.auth != null
      && request.auth.token.firebase.sign_in_provider != "anonymous"; }
    function role() { return request.auth.token.role; }
    function orgId() { return request.auth.token.orgId; }
    function isInternal() { return isAuthenticated() && role() in ["internal", "admin"]; }
    function isAdmin() { return isAuthenticated() && role() == "admin"; }
    function isOrgMember(o) { return isAuthenticated()
      && (isInternal() || orgId() == o); }
    function notDeleted(r) { return !("deletedAt" in r) || r.deletedAt == null; }

    match /orgs/{orgId} {
      allow read: if isOrgMember(orgId) && notDeleted(resource.data);
      allow create, update: if isInternal();
      allow delete: if false;  // soft-delete via Cloud Function only

      match /responses/{respId} {
        allow read: if isOrgMember(orgId);
        allow create: if isOrgMember(orgId)
          && request.resource.data.userId == request.auth.uid;
        allow update: if isOrgMember(orgId)
          && resource.data.userId == request.auth.uid
          && request.resource.data.userId == resource.data.userId;
        allow delete: if false;
      }

      match /comments/{cmtId} {
        allow read: if isOrgMember(orgId)
          && (!resource.data.internalOnly || isInternal());
        allow create: if isOrgMember(orgId)
          && request.resource.data.authorId == request.auth.uid;
        allow update, delete: if false;     // through Cloud Function (audit + soft-delete)
      }
      // ...etc per subcollection
    }

    match /auditLog/{id} {
      allow read: if isAdmin();
      allow write: if false;                // ONLY Cloud Functions write here (Admin SDK)
    }

    match /softDeleted/{type}/items/{id} {
      allow read: if isAdmin();
      allow write: if false;                // ONLY Cloud Functions
    }

    match /internalAllowlist/{email} {
      allow read: if isAdmin();
      allow write: if isAdmin();
    }
  }
}
```

The complexity tradeoff is favourable: ~10 explicit blocks (one per subcollection) are easier to audit than one block trying to gate 6 different operations on a single nested doc. This is also the pattern OWASP/SOC2 reviewers expect to see.

### Backup/export interaction with subcollections

The Firestore managed export API ([docs](https://firebase.google.com/docs/firestore/solutions/schedule-export)) exports collection groups including subcollections. So the daily backup function dumps everything in one call. The export goes to a dedicated GCS bucket with:

- **Object Lock / retention policy**: 30 days minimum, prevents premature deletion.
- **Lifecycle rule**: auto-delete after 90 days.
- **IAM**: only the Cloud Functions service account writes; no human role has delete rights to the bucket.

That gives you tamper resistance without rolling custom crypto.

---

## 5. Audit log architecture

### Decision: **Two-track audit log: dedicated `auditLog/*` Firestore collection (app-level events) + Google Cloud Audit Logs (infrastructure events) sunk to BigQuery**

Rationale (HIGH confidence):

- Application events ("user X soft-deleted comment Y", "MFA enrolled", "claims changed for user Z") are **app-level** and only the app knows the semantics. Those go to `auditLog/{eventId}` written by Cloud Functions.
- Infrastructure events ("admin SDK key used to read user", "role changed via gcloud", "Firebase Console policy change") are emitted by GCP itself as Cloud Audit Logs — Admin Activity logs are **always-on and immutable** ([Cloud Audit Logs overview](https://docs.cloud.google.com/logging/docs/audit)). You can't disable them. That's your tamper-resistant backstop without custom crypto.
- BigQuery sink gives both queryability ("show me everyone who accessed orgId X in the last 30 days") and retention beyond Cloud Logging's default. Set up:
  - Log sink: routing filter `resource.type=("audited_resource" OR "firestore_database" OR "cloud_function" OR "identitytoolkit_project")` → BigQuery dataset `audit_logs`, partitioned daily, 7-year retention.

> Why **not** roll custom crypto / blockchain anchoring? It's an anti-feature here. The Pangea Firebase extension exists (and works) but adds operational dependency, custom auditor explanation, and a third-party trust point — none of which a SOC2 / ISO27001 reviewer would weight as "essential." Cloud Audit Logs + BigQuery + bucket Object Lock satisfies the _immutable audit trail_ control without it.

### `auditLog/{eventId}` document schema

```typescript
{
  eventId: string,                   // crypto.randomUUID(), enforced unique
  type: AuditEventType,              // enum from observability/audit-events.js
                                     // e.g. "auth.signin.success",
                                     // "auth.signin.failure", "auth.mfa.enrol",
                                     // "data.org.create", "data.org.softDelete",
                                     // "data.org.restore", "iam.claims.set",
                                     // "compliance.export.user", "compliance.erase.user",
                                     // "ratelimit.exceeded", "appcheck.failure"
  severity: "info" | "warning" | "alert",
  actor: {
    uid: string | null,              // Firebase Auth UID; null for system events
    email: string | null,
    role: "internal" | "client" | "admin" | "system" | null,
    orgId: string | null
  },
  target: {
    type: string,                    // "org" | "user" | "comment" | "document" | "claims" | ...
    id: string,
    orgId: string | null,
    snapshot?: object                // optional minimal snapshot of pre-change state
  },
  at: Timestamp,                     // serverTimestamp(), source of truth for ordering
  ip?: string,                       // X-Forwarded-For from Function context
  userAgent?: string,                // from Function context
  payload?: object,                  // event-specific data (validated against per-event Zod schema)
  idempotencyKey: string,            // {actor.uid}:{type}:{target.id}:{clientReqId}
  schemaVersion: 1
}
```

### Write path — client events

```
[user action]
   ↓
[view/auth.js fires audit event] → cloud/audit.js → cloud-fns.js → httpsCallable("auditWrite")
                                                                      ↓
                                                          [auditWrite Cloud Function]
                                                          • validate App Check token
                                                          • validate ID token + claims
                                                          • read uid / email / role from token (NOT payload)
                                                          • run Zod schema on payload
                                                          • check idempotency marker
                                                          • addDoc(auditLog, normalisedEvent)
                                                          • return {ok: true, eventId}
                                                                      ↓
                                                                Firestore (auditLog/*)
```

The **critical property**: the actor's identity comes from the verified ID token, **never from client-supplied payload**. This is the OWASP A01 / IDOR mitigation.

### Write path — server-mirror events (defence in depth)

For high-stakes operations, _also_ fire from a Firestore trigger so an audit record exists even if the client `auditWrite` call failed:

```
[client soft-deletes an org]
   ↓
[softDelete Cloud Function] writes orgs/{id}.deletedAt = now()
                            and writes auditLog event (primary)
                            and copies snapshot to softDeleted/.../{id}
                                                                      ↓
[onOrgUpdate Firestore trigger] sees deletedAt change → writes a *secondary*
                                "data.org.softDelete.mirror" audit event
                                if no primary exists for this {target,within 60s}
```

The mirror trigger is the safety net for "what if the client crashed between mutation and `auditWrite`." For _most_ events this is overkill; reserve it for org delete, user delete, claims change, document delete.

### Client- vs server-written events

| Event                | Written by client?                                    | Written by server?                       | Why                                                                                                                                                                     |
| -------------------- | ----------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign-in success      | Client (`auditWrite`)                                 | Mirrored by `beforeUserSignedIn`         | Client first because it has UA + better breadcrumb context; server mirrors for reliability.                                                                             |
| Sign-in failure      | Client                                                | —                                        | Client only — server doesn't see failed-password attempts (Firebase Auth doesn't trigger blocking functions for those). Cloud Logging captures these too as a backstop. |
| MFA enrol            | Client                                                | Mirrored from Auth state                 | —                                                                                                                                                                       |
| Role / claims change | —                                                     | **Server only** (`setClaims` Function)   | Privileged op; never trust client.                                                                                                                                      |
| Soft-delete          | Client → calls server function which writes the event | —                                        | Single source: the Function writes the audit event itself.                                                                                                              |
| Org create / update  | Client (callable)                                     | Mirrored by Firestore trigger for safety | —                                                                                                                                                                       |
| Document upload      | Client (`auditWrite`)                                 | Mirrored by Storage trigger              | —                                                                                                                                                                       |
| Backup completion    | —                                                     | **Server only** (scheduled function)     | —                                                                                                                                                                       |

---

## 6. Static hosting decision: GitHub Pages vs Firebase Hosting

### Decision: **Move to Firebase Hosting**

Rationale (HIGH confidence):

- **GitHub Pages cannot set HTTP headers.** Confirmed: [GitHub Community thread](https://github.com/orgs/community/discussions/157852) and the [Firebase Hosting full-config docs](https://firebase.google.com/docs/hosting/full-config) — Firebase Hosting supports `headers` in `firebase.json`; GitHub Pages does not.
- **CSP via `<meta http-equiv>` is strictly weaker than HTTP-header CSP.** Some directives (`frame-ancestors`, `report-to`, sandbox in some contexts) are header-only. CONCERNS H4 calls out "no CSP, no security headers" as HIGH; meta-tag CSP closes this _partially_, header CSP closes it properly.
- **Strict-Transport-Security, Permissions-Policy, X-Content-Type-Options, Referrer-Policy** are header-only and required for OWASP A02 / ASVS L2.
- **CNAME continuity:** Firebase Hosting supports custom domains. Migration is: in Firebase Console → Hosting → Add custom domain → `baselayers.bedeveloped.com` → it gives you DNS records to set. Update your DNS provider. The current `CNAME` file in the repo (which only matters to GitHub Pages) becomes inert. **Cost: roughly 10 minutes of DNS work** and a 24h TTL wait. SSL certs are auto-provisioned.
- **Side benefit:** Firebase Hosting's preview channels (`firebase hosting:channel:deploy preview-...`) give per-PR ephemeral URLs that GitHub Pages can't easily produce.
- **Costs:** Stays on free Spark plan for low-traffic static. _However_ — Cloud Functions, scheduled exports, and BigQuery sink require **Blaze plan** (pay-as-you-go). Blaze is required for the rest of the milestone anyway, so Hosting cost is moot.

### `firebase.json` headers section (draft)

```json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "headers": [
      {
        "source": "**/*",
        "headers": [
          {
            "key": "Strict-Transport-Security",
            "value": "max-age=63072000; includeSubDomains; preload"
          },
          { "key": "X-Content-Type-Options", "value": "nosniff" },
          { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
          {
            "key": "Permissions-Policy",
            "value": "camera=(), microphone=(), geolocation=(), payment=()"
          }
        ]
      },
      {
        "source": "**/*.html",
        "headers": [
          {
            "key": "Content-Security-Policy",
            "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://firebasestorage.googleapis.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firebaseinstallations.googleapis.com https://identitytoolkit.googleapis.com https://www.google.com/recaptcha/ https://recaptchaenterprise.googleapis.com https://o*.ingest.sentry.io; frame-src https://www.google.com/recaptcha/; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
          }
        ]
      },
      {
        "source": "**/*.@(js|css|png|jpg|jpeg|svg|woff|woff2)",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
      }
    ]
  },
  "functions": [{ "source": "functions", "codebase": "default", "runtime": "nodejs22" }],
  "firestore": { "rules": "firestore.rules", "indexes": "firestore.indexes.json" },
  "storage": { "rules": "storage.rules" }
}
```

**`unsafe-inline` on style-src** is a temporary tax until CONCERNS M5 (inline `style="..."` in `app.js`) is cleaned up. Once those are moved to CSS classes, drop `unsafe-inline`. Track as a follow-up — it's _not_ a blocker for the milestone.

> Known footgun: there's a [longstanding firebase-tools issue](https://github.com/firebase/firebase-tools/issues/5999) about `Strict-Transport-Security` being silently overridden in some Hosting configurations. Test the deployed headers with `curl -I https://baselayers.bedeveloped.com/` and `securityheaders.com` after deploy; if HSTS is missing, the workaround is to set it via a redirect rule.

### Migration cost estimate

- Add `firebase.json` Hosting section: 30 min.
- Run `firebase login`, `firebase init hosting`: 15 min.
- DNS update: 10 min + TTL wait.
- First deploy: `firebase deploy --only hosting`: 5 min.
- Validate headers, validate redirect from `bedeveloped.com` if any, check 404 page: 30 min.
- Decommission GitHub Pages (keep the repo, just disable Pages in settings): 2 min.

**Total: under 2 hours** including DNS propagation. The `CNAME` file can stay in the repo or be deleted; it's now inert.

---

## 7. Auth + claims flow

### Decision: **Email/Password + custom claims `{role, orgId}` set by `beforeUserCreated`; admin can change claims via callable; client force-refreshes ID token after admin makes changes**

### Flow A: Internal user signup (the migration path for Luke + George)

```
1. Admin (one-time bootstrap by hand or by gcloud) writes:
     internalAllowlist/luke@bedeveloped.com  → { role: "admin", addedBy: "bootstrap" }
     internalAllowlist/george@bedeveloped.com → { role: "admin", addedBy: "bootstrap" }

2. Luke goes to /signin → "Create account" (Firebase Auth Email/Password).

3. beforeUserCreated fires:
     • Reads internalAllowlist/{lower(luke.email)}
     • If found: sets customClaims = { role: "admin", orgId: null } on the new user
     • If not found and signup policy is "allowlist-only-for-internals":
         throw HttpsError("permission-denied", ...) — Firebase rejects creation
       OR: assign role: "client" with orgId from invitation token (Flow B)
     • Writes "iam.user.create" audit event (server-side)
     • Returns within 7s

4. Luke gets prompted to enrol MFA on first sign-in (TOTP) — required for role: "admin" or "internal".
   The MFA flow is in views/auth.js, calling firebase/auth.js → multiFactor(currentUser).getSession().

5. From this point, Luke's ID token carries { role: "admin" } and Firestore Rules act on it.
```

### Flow B: Client user signup (invited)

```
1. Internal user clicks "Invite client" → calls cloud function (or for now, copy a magic link).
   Magic link path: /signin?invite=<signedJWT>?orgId=<id>
   The signed JWT is issued by a Cloud Function (callable, internal-only) with payload
   { orgId, expiresAt, signature } and signed with a project secret.

2. Client clicks link → /signin form prefilled with orgId in hidden field, invite JWT in localStorage.

3. Client creates account.

4. beforeUserCreated fires:
     • Reads invite JWT from a custom claim path (Firebase Auth blocking functions can read
       payload from request body via beforeUserCreated context).
     • Verifies signature + not expired.
     • Sets customClaims = { role: "client", orgId: <from invite> }.
     • Writes "iam.user.create" audit event with the inviting internal user's uid.
```

> **Why an invite JWT instead of just trusting the URL param:** without it, anyone could sign up with `?orgId=foo` and become a member of foo. The signed JWT proves an internal user authorised the membership.

### Flow C: Role change mid-session

```
1. Admin opens the admin panel → "Change role for client X to admin".
2. Client calls cloud/claims-admin.js → setClaims function.
3. setClaims:
     • Verifies caller has role: "admin" claim
     • Calls admin.auth().setCustomUserClaims(targetUid, { role: "admin", orgId: null })
     • Writes audit event
     • Returns { ok: true, mustRefreshIn: 0 }
4. Server-side: target user's existing ID token is still valid until expiry (default 1h).
   Firestore Rules will use the OLD claims for up to 1h.
5. Client-side mitigation: when admin completes setClaims, push a Firestore document at
   users/{targetUid}/_pokes/{pokeId} with { type: "claims-changed", at: serverTimestamp() }.
6. The target user's session listens to that doc (per-user listener); on poke arrival,
   call currentUser.getIdToken(true) to force-refresh and pick up new claims immediately.
```

The "poke" pattern is the standard Firebase workaround for the 1h ID token TTL. Alternative: tell admins "the role change takes up to 1 hour to fully propagate" — acceptable for low-frequency role changes, simpler.

### Flow D: Migration of the existing hardcoded allowlist

```
1. Pre-migration: confirm Luke and George are the only internal users (they are, per PROJECT.md).
2. Firebase Console: manually create their accounts with temp passwords; manually call
   admin.auth().setCustomUserClaims(uid, {role: "admin"}) via a one-shot script.
3. Email them temp passwords out-of-band (Slack DM, password manager).
4. Make them sign in, change password, enrol MFA.
5. Delete the hardcoded INTERNAL_ALLOWED_EMAILS + INTERNAL_PASSWORD_HASH from app.js (CONCERNS C2).
6. Delete the localStorage-based session shim from app.js.
7. Add internalAllowlist/{email} entries via the admin panel for any future internals.
```

This is a **clean cutover** — PROJECT.md confirms there are no live users to keep working, so there's no "dual-write" window. Just migrate Luke + George, then ship the cutover. (If any client orgs have stored user records that you want to preserve, write a one-shot migration script that creates Firebase Auth accounts for each existing `users/{id}` doc and emails password-reset links — but per the PROJECT.md "no backwards-compatibility" decision, you can also just delete and re-onboard.)

---

## 8. Build / Phase ordering — validation of proposed sequence

### Your proposed order

> 1: Tooling, 2: Modular split, 3: Auth + MFA, 4: Rules + App Check, 5: Cloud Functions, 6: CSP/headers/Hosting, 7: Data lifecycle, 8: Observability, 9: Audit walkthrough.

### My recommendation: **adjust to this order**

| #   | Phase                                                                                                                                                              | Change vs your proposal                                                                                                                                                                                  | Justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Tooling foundation** (Vite + Vitest + GitHub Actions CI + JSDoc types)                                                                                           | Same.                                                                                                                                                                                                    | Unlocks tests + SRI + Dependabot. Everything else benefits from being testable.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2   | **Hosting cutover to Firebase Hosting** _(NEW — moved up)_                                                                                                         | Was step 6.                                                                                                                                                                                              | Two reasons: (a) you'll deploy _to_ Firebase Hosting from day 1 of CI, so the earlier you switch the fewer extra deploy targets you maintain. (b) the CSP / headers infrastructure is _available_ from this point, even if the CSP itself is permissive at first (you tighten it as you delete `unsafe-inline`-requiring code).                                                                                                                                                                                         |
| 3   | **Modular split of `app.js`**                                                                                                                                      | Same.                                                                                                                                                                                                    | Pure refactor with tests in place. **Critical: write Vitest tests for scoring + completion + migration BEFORE you start moving code** (CONCERNS Test Coverage Gaps) so the refactor has a safety net.                                                                                                                                                                                                                                                                                                                   |
| 4   | **Firestore data model migration to subcollections** _(NEW — added)_                                                                                               | You didn't list this.                                                                                                                                                                                    | The old data shape is incompatible with proper Rules — you can't easily express "user can only write their own response" when responses are nested 4 levels deep in a single doc. Doing the data split _before_ writing Rules makes the Rules dramatically simpler. **Must include a one-shot migration script** that reads existing `orgs/{id}` and explodes the nested fields into the new subcollections, with a feature-flag to keep both shapes readable during cutover (or do clean-cutover since no live users). |
| 5   | **Real Firebase Auth + custom claims + MFA + `beforeUserCreated`**                                                                                                 | Was step 3. Moved after data model split because: (a) the new `users/{uid}` doc shape uses Firebase Auth UID as the document key; (b) `beforeUserCreated` writes claims that the new Rules will rely on. | Includes deleting the hardcoded `INTERNAL_PASSWORD_HASH`.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 6   | **Firestore + Storage Rules + App Check**                                                                                                                          | Was step 4.                                                                                                                                                                                              | Now you can write Rules that `request.auth.token.role` and `request.auth.token.orgId` correctly because step 5 set them. App Check enforced at the same time.                                                                                                                                                                                                                                                                                                                                                           |
| 7   | **Cloud Functions: audit log + soft-delete + restore + scheduled backup + GDPR + claims admin**                                                                    | Same.                                                                                                                                                                                                    | All the trusted server logic. With Rules in place, Functions can rely on "client can't bypass me to write directly to `auditLog`."                                                                                                                                                                                                                                                                                                                                                                                      |
| 8   | **Observability + audit-event wiring throughout views**                                                                                                            | Was step 8 (last but one).                                                                                                                                                                               | Now that Functions exist, you can wire `auditWrite` calls from every view that does sensitive ops (sign-in, sign-out, role change, deletes, exports). Sentry init too.                                                                                                                                                                                                                                                                                                                                                  |
| 9   | **Data lifecycle UX**: soft-delete UI in admin, restore UI, GDPR export download UI, retention policy doc                                                          | Was step 7. Moved after observability because the audit events are wired first.                                                                                                                          | Delete buttons now write audit events automatically because step 8 instrumented them.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 10  | **CSP tightening** _(NEW — separated from step 2)_                                                                                                                 | Was bundled in step 6.                                                                                                                                                                                   | Now you can drop `'unsafe-inline'` from style-src once CONCERNS M5 (inline styles) is fixed. This is the "second sweep" through the CSP.                                                                                                                                                                                                                                                                                                                                                                                |
| 11  | **Audit walkthrough**: translate `SECURITY_AUDIT.md` Vercel/Supabase sections to Firebase, run end-to-end, produce `SECURITY_AUDIT_REPORT.md`, fill remaining gaps | Same.                                                                                                                                                                                                    | Last because everything else is the input.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### Dependencies (what blocks what)

```
1 (tooling) ────► 2 (hosting) ────► 3 (modular split) ─────┐
                                                            ▼
                              ┌─── 4 (data model) ───► 5 (auth) ───► 6 (rules)
                              │                                        │
                              ▼                                        ▼
                    [migration of existing org data]          7 (cloud functions)
                                                                       │
                                                                       ▼
                                                           8 (observability + audit wiring)
                                                                       │
                                                                       ▼
                                                              9 (lifecycle UX)
                                                                       │
                                                                       ▼
                                                            10 (CSP tightening)
                                                                       │
                                                                       ▼
                                                       11 (audit walkthrough + report)
```

### Specific dependencies you may have missed

1. **Firestore data model split must happen before Rules.** If you write Rules against the current monolithic doc shape, you'll have to rewrite them when you split. Doing it the other way (split first, Rules second) means you write Rules once.
2. **`beforeUserCreated` claims setup must happen before Rules can rely on `request.auth.token.role`.** If you ship Rules first and Auth second, you'll have a gap where Rules deny everything because no users have claims yet.
3. **App Check enforcement must come _after_ the deployed app reliably attaches App Check tokens to every request.** Phase: deploy with App Check in _monitoring mode_ first (it logs which requests would be denied without enforcing). Watch for a few days. Then turn on enforcement.
4. **Daily backup function (step 7) requires Blaze plan.** Confirm Blaze is enabled before step 7. Most other Functions need Blaze too, but the _scheduled_ ones (Cloud Scheduler) require it explicitly.
5. **The `softDelete` Cloud Function and the soft-delete UX (step 9) must agree on schema.** Bake the schema into `functions/src/shared/audit-events.ts` AND `src/cloud/audit.js` AND the corresponding Rules at the same commit, ideally with a shared types file.
6. **Migration script for existing data** is part of step 4, not a separate phase. Test it against an emulator copy of production data before running on production. You have no live users right now, so this is risk-free; _future_ milestones won't have that luxury.
7. **GDPR export/erasure UX (step 9) requires the audit log (step 7) to be functional** because erase events themselves must be auditable.

### Phases that are likely to need their own deeper research

| Phase                    | Why it needs its own research                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 4 (data model migration) | Migration script correctness is high-blast-radius. Should produce its own RESEARCH note that enumerates every field's new home.    |
| 5 (Auth + MFA)           | TOTP UX, recovery codes UX, password reset flow, account-enumeration mitigation (CONCERNS L1) — each is its own micro-decision.    |
| 7 (Cloud Functions)      | Per-function research: input schema, idempotency strategy, rate-limit thresholds, cold-start tolerance for callable vs background. |
| 11 (audit walkthrough)   | Translating `SECURITY_AUDIT.md` Vercel/Supabase sections into Firebase equivalents is non-trivial; produces `SECURITY.md`.         |

### Phases unlikely to need extra research

- 1 (tooling): Vite + Vitest + GH Actions are standard.
- 2 (hosting cutover): mechanical.
- 3 (modular split): pure refactor with tests.
- 6 (Rules): patterns are well-documented.
- 8 (observability): Sentry has a turnkey Firebase integration.
- 10 (CSP tightening): mechanical inline-style → class sweep.

---

## 9. Anti-architecture — what NOT to do

The patterns explicitly _not_ to adopt:

| Anti-pattern                                                                 | Why it's wrong                                                                                                          | What to do instead                                                                                                                                        |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client-only auth (the current state)                                         | Auth bypassable via DevTools localStorage edit. Cannot be a trust boundary. CONCERNS C1.                                | Firebase Auth + custom claims + Firestore Rules. Server enforces.                                                                                         |
| Hardcoded password hash in repo                                              | Brute-forceable; world-readable. CONCERNS C2.                                                                           | Per-user passwords managed by Firebase Auth (Argon2-equivalent server-side hashing).                                                                      |
| Custom session tokens (rolling your own JWT)                                 | Rolling crypto is anti-feature; ID tokens already exist.                                                                | Use Firebase ID tokens. Force-refresh on claim change.                                                                                                    |
| Mixing client-clock and server-clock timestamps in auth-relevant comparators | Causes silent failures (CONCERNS H7) and breaks audit log ordering.                                                     | Always `serverTimestamp()` for anything compared to or stored alongside other server-clock values. Client clock is _only_ for "time ago" display.         |
| Separate "internal" and "client" auth mechanisms                             | Doubles the auth surface area; doubles the audit story.                                                                 | Unified auth: one Firebase Auth user, one ID token, role differentiated by custom claim.                                                                  |
| Shared org passphrase                                                        | Identity is a property of a person, not an org. Audit logs become useless ("someone who knew the passphrase did this"). | Per-user accounts within an org. Org membership encoded as `orgId` custom claim.                                                                          |
| Trusting client-supplied `orgId`                                             | Mass-assignment / IDOR.                                                                                                 | `orgId` from `request.auth.token.orgId` (Rules) or token payload (Functions). Never from client request body.                                             |
| `localStorage` as source of truth for `role`                                 | Trivially editable.                                                                                                     | `localStorage` is UI cache only (collapsed pillars, last-route, draft text). `role` from claims.                                                          |
| Anonymous Firebase Auth in production                                        | Token has no identity, can't drive Rules. CONCERNS M6.                                                                  | Email/Password + MFA. Drop `signInAnonymously`.                                                                                                           |
| Cloud Functions that trust the caller's claim payload                        | Caller can lie about their role in callable args.                                                                       | Re-read claims from `context.auth.token` server-side, never from `data.payload`.                                                                          |
| Cloud Functions writing without App Check enforcement                        | Bypassable from any client.                                                                                             | `enforceAppCheck: true` on every callable.                                                                                                                |
| `service_role`-equivalent (Admin SDK) reachable from client                  | Catastrophic. (Firebase doesn't have a single equivalent but: never expose service-account credentials in client code.) | Service account only in Functions runtime. Never in browser bundle.                                                                                       |
| Storing PII in Storage paths or Firestore document IDs                       | Path leaks via signed URLs and rule paths.                                                                              | Random IDs (`crypto.randomUUID()`). PII goes in document fields, where Rules can scope.                                                                   |
| Audit log writable by clients                                                | Clients can fabricate events or delete incriminating ones.                                                              | `auditLog` is writable only by Cloud Functions (Admin SDK), readable only by admins, with `allow write: if false` in Rules for clients.                   |
| Global `render()` re-running listener subscriptions on every render          | Listener leaks (CONCERNS F3).                                                                                           | Subscriptions live in `data/*.js` keyed by stable inputs (orgId, route); cleaned up in a render-cycle teardown. View files don't open listeners directly. |
| `innerHTML = ""` for clearing nodes                                          | Indistinguishable from XSS injection in lint rules (CONCERNS M2).                                                       | `el.replaceChildren()`.                                                                                                                                   |
| `alert()` for error UX                                                       | Blocking, jarring, unloggable (CONCERNS M3).                                                                            | `toast(level, message)` + Sentry breadcrumb.                                                                                                              |
| Long-lived secrets in env vars                                               | Secrets in env vars are inert until they leak.                                                                          | Cloud Functions params (`defineSecret`) for runtime secrets. Functions config API is being decommissioned March 2027 — start on params now.               |
| Single org owner on the Firebase project                                     | Bus factor of 1.                                                                                                        | Multiple owners on the GCP project (Luke + George at minimum).                                                                                            |

---

## 10. Sources

**Authoritative (HIGH confidence):**

- [Cloud Functions for Firebase — version comparison (2nd gen vs 1st gen)](https://firebase.google.com/docs/functions/version-comparison)
- [Cloud Functions — TypeScript guide](https://firebase.google.com/docs/functions/typescript)
- [Auth blocking triggers (`beforeUserCreated`, `beforeUserSignedIn`)](https://firebase.google.com/docs/functions/auth-blocking-events)
- [Control access with custom claims and Security Rules](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Firestore — usage and limits (1 MiB doc limit, subcollections excluded)](https://firebase.google.com/docs/firestore/quotas)
- [Firestore — get started with Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Firestore — schedule data exports](https://firebase.google.com/docs/firestore/solutions/schedule-export)
- [Cloud Audit Logs overview](https://docs.cloud.google.com/logging/docs/audit)
- [Firebase Hosting — full configuration (firebase.json headers)](https://firebase.google.com/docs/hosting/full-config)
- [Firebase App Check with reCAPTCHA Enterprise (web)](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider)
- [Sentry — Cloud Functions for Firebase integration](https://docs.sentry.io/platforms/javascript/guides/firebase/)
- [Using module bundlers with Firebase (Vite + tree-shaking)](https://firebase.google.com/docs/web/module-bundling)

**Verified secondary:**

- [Configure custom claims (Identity Platform)](https://docs.cloud.google.com/identity-platform/docs/how-to-configure-custom-claims)
- [Patterns for security with Firebase: custom claims with Firestore + Cloud Functions (Doug Stevenson, Firebase Developers)](https://medium.com/firebase-developers/patterns-for-security-with-firebase-supercharged-custom-claims-with-firestore-and-cloud-functions-bb8f46b24e11)
- [Setting Strict-Transport-Security header on Firebase Hosting (known issue)](https://github.com/firebase/firebase-tools/issues/5999)
- [GitHub Pages — custom HTTP headers not supported](https://github.com/orgs/community/discussions/157852)

**Project context (read first):**

- `.planning/codebase/ARCHITECTURE.md` — current single-IIFE architecture
- `.planning/codebase/STRUCTURE.md` — current file layout
- `.planning/codebase/INTEGRATIONS.md` — current Firebase usage
- `.planning/codebase/CONCERNS.md` — 4 CRITICAL + 8 HIGH findings being closed
- `.planning/PROJECT.md` — milestone scope, constraints, decisions
- `SECURITY_AUDIT.md` — audit framework being applied

---

_Architecture research for: BeDeveloped Base Layers — Full Hardening Pass milestone_
_Researched: 2026-05-03_
_Author note: this document recommends the **target** state. The phase plan in §8 lays the laddered path from today's IIFE to that state._
