# Stack Research

**Domain:** Firebase-backed vanilla-JS SPA — compliance-credible hardening (SOC2 CC / ISO 27001 Annex A / GDPR Art. 32 / OWASP ASVS L2)
**Researched:** 2026-05-03
**Confidence:** HIGH — all version numbers verified against the live npm registry on the research date; Firebase product surface verified against firebase.google.com docs.

---

## TL;DR — what to install

```bash
# 1. Initialise package.json (no existing one — see codebase STACK.md §Package Manager)
npm init -y

# 2. Self-host Firebase + Chart.js (replaces gstatic / jsdelivr CDN — closes H4 SRI gap)
npm install firebase@12.12.1 chart.js@4.5.1

# 3. Hardening-time runtime libraries
npm install dompurify@3.4.2

# 4. Build + dev tooling
npm install -D vite@8.0.10 vitest@4.1.5 @vitest/coverage-v8@4.1.5 happy-dom@20.9.0

# 5. JSDoc-typecheck (no TS rewrite — types live in JSDoc per Constraints)
npm install -D typescript@6.0.3

# 6. Lint + format
npm install -D eslint@10.3.0 eslint-plugin-no-unsanitized@4.1.5 eslint-plugin-security@4.0.0 prettier@3.8.3

# 7. Firestore Rules unit tests (running against the local emulator)
npm install -D @firebase/rules-unit-testing@5.0.0

# 8. Observability — client SDK
npm install @sentry/browser@10.51.0

# 9. Firebase CLI (global; or use `npx firebase-tools`)
npm install -D firebase-tools@15.16.0

# 10. Cloud Functions runtime — installed in the `functions/` workspace, not root
#     (see "Cloud Functions" row below; deferred until you `firebase init functions`)
#   cd functions
#   npm install firebase-admin@13.8.0 firebase-functions@7.2.5 @sentry/node@10.51.0
#   npm install -D firebase-functions-test@3.4.1 typescript@6.0.3
```

Plus enable on the Firebase console / via CLI:

- App Check with **reCAPTCHA Enterprise** (10k free assessments/month)
- Authentication → **Identity Platform** upgrade (required for MFA SMS; TOTP works on base tier but Identity Platform unlocks the org-wide MFA enforcement controls)
- Hosting (move off GitHub Pages — see §Hosting decision below)
- Firestore + Storage Security Rules (already an existing concern — C3)
- Two Firebase Extensions: `firestore-send-email` (transactional email) and `delete-user-data` (GDPR Art. 17 right to erasure)
- One scheduled Cloud Function: nightly Firestore export to GCS bucket
- One Cloud Logging sink: Firestore Data Access logs → BigQuery (audit-trail evidence)

---

## Recommended Stack

### Core Technologies

| Technology                                      | Version     | Purpose                                                                                                                               | Why Recommended                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Firebase JS SDK**                             | **12.12.1** | Browser-side Auth + Firestore + Storage + App Check + Performance                                                                     | Current `latest` on npm 2026-05-03 (verified). Major-version upgrade from the codebase's pinned **10.13.0** — v11 reorganised modular API exports and v12 introduced `getModularInstance` helper improvements. **Self-hosted via Vite bundle** (closes H4 — gstatic CDN with no SRI). Tree-shakes per-product (only `firebase/auth`, `firebase/firestore`, `firebase/storage`, `firebase/app-check` get bundled). |
| **firebase-admin** (Cloud Functions only)       | **13.8.0**  | Server-side identity + custom claims + Firestore writes for trusted operations (audit log, role assignment, soft-delete, GDPR export) | Required for the audit-log + custom-claims pattern (C1, M6). Must run server-side because client cannot write to its own custom claims. v13 is current `latest`. Node 18+ engine.                                                                                                                                                                                                                                 |
| **firebase-functions**                          | **7.2.5**   | 2nd-gen Cloud Functions runtime + triggers (`onDocumentWritten`, `onCall`, `onSchedule`, `beforeUserCreated`)                         | v7 is current `latest`. **Use 2nd-gen exclusively** — Firebase docs say "1st gen functions should consider migrating" and `functions.config()` is decommissioned March 2027. 2nd gen runs on Cloud Run, supports up to 1000 concurrent requests/instance, integrates with Cloud Secret Manager natively.                                                                                                          |
| **Vite**                                        | **8.0.10**  | Build / dev-server / hashed asset filenames / SRI / tree-shaking / multi-entry bundling                                               | Lowest-friction bundler for vanilla JS modules — no React/Vue assumption. Fixes M1 (`?v=46` cache busting → content-hashed `app-[hash].js`), enables H4 SRI (`integrity=`), unblocks H1 (modular split — Vite handles ES modules natively without transpiling). v8 is current `latest`; major bumps every ~9 months on Vite — pin to a major.                                                                     |
| **Vitest**                                      | **4.1.5**   | Test runner with the same config language as Vite, `happy-dom` JSDOM-equivalent                                                       | Fixes H2 (no test suite). Same `vite.config.js` understood by both, no second toolchain. v4 is current `latest`. The `@firebase/rules-unit-testing` library plays well with Vitest for rules tests.                                                                                                                                                                                                               |
| **TypeScript** (typecheck only, no `.ts` files) | **6.0.3**   | `tsc --noEmit` against `// @ts-check` JSDoc-annotated `.js`                                                                           | Honours the Constraint "**vanilla JS, no rewrite**" while still getting type errors at PR time. Standard pattern: `// @ts-check` at top of each module, JSDoc `/** @type {…} */` on tricky values, `tsc --noEmit --allowJs --checkJs --strict` in CI. v6 is current `latest`.                                                                                                                                     |
| **ESLint**                                      | **10.3.0**  | Static analysis — flat config (`eslint.config.js`), security plugins                                                                  | v10 is current `latest`. Use **`eslint-plugin-no-unsanitized`** v4.1.5 to catch every `innerHTML =` / `outerHTML =` / `insertAdjacentHTML(... 'unsafe')` (closes M2 + H4 + C4). Use **`eslint-plugin-security`** v4.0.0 for `Math.random()` / `eval` / `child_process` / unsafe regex flags.                                                                                                                      |
| **DOMPurify**                                   | **3.4.2**   | Whitelist-based HTML sanitiser for any rich-text path                                                                                 | The escape hatch in `h()` (`app.js:614`, the `html:` branch) is being deleted (C4 fix), but if any future feature needs sanitised HTML render, DOMPurify is the canonical choice — Trail of Bits–audited, Mozilla-recommended, ~22kB minified. **Don't roll your own escaper.**                                                                                                                                   |
| **@sentry/browser**                             | **10.51.0** | Centralised error sink — client                                                                                                       | Closes M4 + the "missing observability" GDPR Art. 32 / SOC2 CC7.2 gap. **Free tier** = 5k errors/month, sufficient for a between-engagements app. `@sentry/browser` (~30–85kB depending on integrations) — disable default integrations and use only `breadcrumbsIntegration`, `globalHandlersIntegration`, `linkedErrorsIntegration` to keep bundle <30kB.                                                       |
| **@sentry/node** (Cloud Functions only)         | **10.51.0** | Error sink — server-side                                                                                                              | Wraps every Cloud Function `onCall` / `onRequest` handler. Same DSN as the browser SDK; same Sentry project. Logs all unhandled rejections from scheduled exports + audit-log writes.                                                                                                                                                                                                                             |
| **Firebase CLI (`firebase-tools`)**             | **15.16.0** | Deploy rules + functions + hosting + extensions; emulator suite for tests                                                             | v15 is current `latest`. Pin in `devDependencies` so CI pulls the same version Luke + George ran locally. Used by GitHub Actions for `firebase deploy --only hosting,firestore:rules,storage:rules,functions`.                                                                                                                                                                                                    |
| **`@firebase/rules-unit-testing`**              | **5.0.0**   | Authoring rules tests — runs against the local Firestore + Storage emulator                                                           | The standard way to test `firestore.rules` and `storage.rules` server-side. Closes the H2 + C3 gap simultaneously: the rules are **the** new server-side authz boundary, so the rules need automated tests. v5 is current.                                                                                                                                                                                        |

### Supporting Libraries

| Library                            | Version    | Purpose                                                                                             | When to Use                                                                                                                                                                                  |
| ---------------------------------- | ---------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chart.js**                       | **4.5.1**  | Radar + donut visualisations (existing)                                                             | Already in use at 4.4.1; bump to 4.5.1 (current latest) and self-host via the Vite bundle (closes H4 SRI). Tree-shake to only `RadarController` + `DoughnutController` to keep bundle small. |
| **`@vitest/coverage-v8`**          | **4.1.5**  | Test coverage reporter                                                                              | `npm test -- --coverage` produces a coverage report uploadable to GitHub Actions artifacts. Set a floor (e.g. 60% on data-integrity helpers) but don't gate the milestone on 100%.           |
| **`happy-dom`**                    | **20.9.0** | DOM mock for Vitest unit tests                                                                      | Faster than `jsdom@29.1.1` for the kinds of tests this app needs (DOM-helper unit tests, not full integration). Vitest first-class support.                                                  |
| **`firebase-functions-test`**      | **3.4.1**  | Unit-testing Cloud Functions in isolation (offline, mocked admin SDK)                               | For the audit-log Cloud Function + soft-delete Cloud Function. Run alongside Vitest in the `functions/` workspace.                                                                           |
| **`prettier`**                     | **3.8.3**  | Code formatting (zero-config)                                                                       | `npm run format` + a pre-commit hook. Don't bikeshed style.                                                                                                                                  |
| **`eslint-plugin-no-unsanitized`** | **4.1.5**  | Catches every `innerHTML` / `outerHTML` / `insertAdjacentHTML`                                      | The single most useful CSP-supporting lint rule for this codebase. Will fire on all 17 `innerHTML = ""` clears (M2). Use auto-fix to `replaceChildren()`.                                    |
| **`eslint-plugin-security`**       | **4.0.0**  | `detect-non-literal-fs-filename`, `detect-eval-with-expression`, `detect-pseudo-random-bytes`, etc. | Will fire on `app.js:30-31` (`Math.random()` for ids — H5). Fix once with `crypto.randomUUID()`, rule then permanently green.                                                                |

### Development Tools

| Tool                                     | Purpose                                                                                              | Notes                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GitHub Actions**                       | CI: lint + typecheck + test + audit + build + Firebase emulator rules tests + Firestore Rules deploy | Free for public repos and within the included minutes for private repos. Workflow shape is below in §CI Workflow Shape.                                                                                                                                                                                                                     |
| **Dependabot**                           | Dependency monitoring                                                                                | **Recommended over Renovate for this project** — see decision below. Configured via `.github/dependabot.yml`, native to GitHub, free, no app to install. The 2026 ecosystem consensus is "Dependabot for GitHub-only, Renovate for multi-platform / monorepo / complex grouping" — this project is GitHub-only and small, single developer. |
| **OSV-Scanner**                          | Supplementary advisory scan                                                                          | Run via `npx osv-scanner@latest -r .` in CI on every PR. Catches advisories that are in OSV.dev but not yet in npm advisory DB. Zero-friction supplement to `npm audit`.                                                                                                                                                                    |
| **Socket.dev**                           | Behavioural malicious-package detection                                                              | Free GitHub App, recommended in `SECURITY_AUDIT.md` §10.2 explicitly post-Shai-Hulud. Detects `preinstall` / `postinstall` script abuse, install-time network calls, suspicious file writes — the things `npm audit` cannot see because they're not CVE-class. Install once at the org/repo level, no config.                               |
| **Firebase Emulator Suite**              | Local Auth + Firestore + Storage + Functions emulator                                                | Bundled with `firebase-tools`. Required for `@firebase/rules-unit-testing`. Speeds up PR feedback (no need to deploy rules to a sandbox project to test them). Run via `firebase emulators:start --only firestore,storage,auth,functions` in the `test:emulator` npm script.                                                                |
| **GitHub native Code Scanning (CodeQL)** | SAST                                                                                                 | Free for public repos; Advanced Security required for private. **Skip for this milestone** unless the prospect's questionnaire specifically asks — diminishing return for a vanilla-JS app of this size. Semgrep (free) is a defensible alternative.                                                                                        |
| **gitleaks**                             | Pre-commit + CI secret scan                                                                          | Configure as a pre-commit hook (`pre-commit install`) and as a CI gate. Fires on `INTERNAL_PASSWORD_HASH` style hardcoded credentials. Will help prevent regressions of C2.                                                                                                                                                                 |

---

## Firebase Product Surface — Exact Set + Versions

| Firebase product                               | Status today                            | Action this milestone                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Compliance / control framework citation                                            |
| ---------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ----- | --- | ----- | -------- | ------------------------ | ----------------------------------------------- |
| **Authentication** (anonymous)                 | In use, anonymous-only                  | **Replace with Email/Password + custom claims**, enable email verification, set `passwordPolicy.minimumLength = 12`, enable leaked-password protection (HIBP). Drop anonymous sign-in entirely.                                                                                                                                                                                                                                                                                                                   | OWASP ASVS L2 V2.1, SOC2 CC6.1 (logical access), GDPR Art. 32 (technical measures) |
| **Authentication → Identity Platform upgrade** | Not enabled                             | **Upgrade.** Required for the **`passwordPolicy`** API (min length, leaked-password check), required for **SMS MFA**, required for **org-wide MFA enforcement**. **TOTP MFA** works on the base tier, but Identity Platform is the practical path for credible MFA. Free for first 50k MAU.                                                                                                                                                                                                                       | OWASP ASVS V2.7, SOC2 CC6.7, NIST 800-63B AAL2                                     |
| **Multi-Factor Authentication**                | Not configured                          | Enable **TOTP MFA** for internal users (Luke, George). SMS MFA optional. **Restrictive** rule: any custom claim `role: internal` requires MFA enrolment within N days or account is locked.                                                                                                                                                                                                                                                                                                                       | OWASP ASVS V2.7, SOC2 CC6.7, ISO 27001 A.9.4                                       |
| **Firestore Security Rules**                   | **No `firestore.rules` in repo (C3)**   | **Author + commit `firestore.rules`.** Per-collection: require non-anonymous `request.auth`, validate `request.auth.token.role` and `request.auth.token.orgId`, enforce `resource.data.orgId == request.auth.token.orgId` on reads, disallow client writes to `users` and `orgs` (Cloud Function only).                                                                                                                                                                                                           | OWASP A01:2025, SOC2 CC6.3, ISO 27001 A.9.4.1                                      |
| **Storage Security Rules**                     | **No `storage.rules` in repo (C3, H6)** | **Author + commit `storage.rules`.** Path scope `orgs/{orgId}/...` must check `request.auth.token.orgId == orgId`. Size cap `request.resource.size < 25 * 1024 * 1024`. MIME allowlist `request.resource.contentType.matches('application/pdf                                                                                                                                                                                                                                                                     | image/(png                                                                         | jpe?g | gif | webp) | text/.\* | application/vnd\..\*')`. | OWASP A01 + A05, SOC2 CC6.1, ISO 27001 A.13.2.1 |
| **App Check**                                  | Not enabled                             | **Enable with reCAPTCHA Enterprise.** Free quota = 10k assessments/month, sufficient for this app. Bind clients to legitimate app instances (closes the "any anonymous Firestore client can hit our project" exposure). Protects: Firestore, Storage, Auth (preview), Cloud Functions (callable).                                                                                                                                                                                                                 | OWASP A05:2025, SOC2 CC6.6 (system boundary), GDPR Art. 32(1)(b)                   |
| **Cloud Functions (2nd gen)**                  | Not used                                | **Add `functions/` workspace.** Use `firebase-functions` v7 (Gen 2 default). Functions: (a) `beforeUserCreated` to attach `role` + `orgId` custom claims; (b) `onCall` for sensitive writes (role change, soft-delete, GDPR export); (c) `onSchedule` for nightly Firestore export → GCS; (d) `onDocumentWritten('messages/{id}')` for rate limiting + audit log. Node 18+ engine.                                                                                                                                | OWASP A01 (server-side authz), SOC2 CC7.2 (monitoring)                             |
| **Hosting**                                    | Not in use (using GitHub Pages)         | **Move from GitHub Pages to Firebase Hosting.** Reason: GitHub Pages **cannot set HTTP response headers** — CSP must go in a `<meta>` tag, which doesn't support `frame-ancestors`, `report-uri`, or some directives, and is parsed late (script-src directives that come after a script tag are too late). `firebase.json` `hosting.headers` lets you set the full strict CSP server-side at the edge. **Free Spark plan** includes Hosting. Custom domain `baselayers.bedeveloped.com` migrates via DNS update. | OWASP A02:2025 (security headers), SOC2 CC6.6, ISO 27001 A.13.1.3                  |
| **Firebase Extensions**                        | Not used                                | Install two: (a) **Trigger Email from Firestore** (`firestore-send-email`) for transactional email (Firebase Auth password-reset already works without this, but invite emails currently use `mailto:` per `app.js:3874` — this gives a server-side path); (b) **Delete User Data** (`delete-user-data`) for GDPR Art. 17 right-to-be-forgotten — auto-cascades deletion across configured collections + Storage paths when a user is deleted.                                                                    | GDPR Art. 17 (erasure), Art. 20 (portability)                                      |
| **Performance Monitoring**                     | Not used                                | **Skip this milestone.** Optional. Real-User Monitoring is nice but not on the audit critical path. Add later if needed.                                                                                                                                                                                                                                                                                                                                                                                          | —                                                                                  |
| **Cloud Logging** (Audit Logs)                 | Not configured                          | **Enable Firestore Data Access audit logs**, route to a BigQuery sink with 1-year retention. Log entries are tamper-evident (Cloud Logging is append-only). This is the _infrastructure-level_ audit log — pairs with the _application-level_ audit-log Firestore collection.                                                                                                                                                                                                                                     | SOC2 CC7.2 + CC7.3, ISO 27001 A.12.4.1, GDPR Art. 32(1)(d)                         |

---

## Build setup — Vite for vanilla-JS SPA

**Why Vite:** the codebase's existing pattern is ES module imports (`firebase-init.js` uses `<script type="module">`), so Vite's native ESM dev server gives instant feedback on every save with no configuration. Build output is hashed-filename ESM bundles. Vite handles SRI hash injection via the `transformIndexHtml` hook.

**`vite.config.js` shape (essentials):**

```javascript
// vite.config.js — CONCEPTUAL, NOT EXECUTED
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2020", // matches existing browser-support assumption
    sourcemap: true, // needed for Sentry source maps
    rollupOptions: {
      input: { main: "index.html" }, // single-page app
      output: {
        manualChunks: {
          firebase: [
            "firebase/app",
            "firebase/auth",
            "firebase/firestore",
            "firebase/storage",
            "firebase/app-check",
          ],
          chart: ["chart.js"],
        },
      },
    },
  },
  server: { port: 5178 }, // matches existing local dev port (.claude/launch.json)
  test: {
    // Vitest config inline
    environment: "happy-dom",
    coverage: { provider: "v8" },
  },
});
```

**SRI** is generated via `vite-plugin-sri` (or the built-in approach: Vite hashes filenames; SRI hashes are emitted into `index.html` automatically via the `crossorigin` + content-hash mechanism on modern Vite builds). For belt-and-braces, a 30-line `transformIndexHtml` plugin can compute SHA-384 over each emitted asset and inject `integrity="sha384-…"`.

**What this replaces:** `index.html`'s hand-bumped `?v=46` (M1) and the no-SRI CDN tags (H4) — both gone in one move.

---

## Vitest setup — JSDoc-types-as-typecheck

**Pattern:** every `.js` file gets `// @ts-check` at the top, JSDoc on every exported function. CI runs:

```bash
npx tsc --noEmit --allowJs --checkJs --strict --target es2020 --module esnext --moduleResolution bundler
```

That's the full typecheck. No `.ts` files, no source rewrite. Works because TypeScript has supported `--allowJs --checkJs` as a first-class typecheck mode since 3.7.

**`tsconfig.json` shape (essentials):**

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "strict": true,
    "target": "es2020",
    "module": "esnext",
    "moduleResolution": "bundler",
    "skipLibCheck": true
  },
  "include": ["**/*.js"],
  "exclude": ["node_modules", "dist", "functions/lib"]
}
```

**What to test (priority order matching `CONCERNS.md` Test Coverage Gaps):**

1. **`pillarScoreForRound` + completion math** (`app.js:206-256`) — pure functions, easy to test, silent-failure-mode if wrong.
2. **`v1 → v2` migration + `clearOldScaleResponsesIfNeeded`** (`app.js:489-561`, `4068-4082`) — silent data corruption on first load.
3. **Comment unread tracking** (`app.js:286-320`) and **chat unread total** (`app.js:336-370`) — H7 fix lives here.
4. **Cloud sync merge logic** (`app.js:2680-2720`) — H8 fix lives here.
5. **Firestore Security Rules** (via `@firebase/rules-unit-testing` against the emulator) — every collection × every role × allowed/denied operation. This is the highest-leverage test set because the rules ARE the new authz boundary.
6. **Auth state machine** (`app.js:973-1184`) — wrong-role UI exposed to wrong user is a CRITICAL impact path.

**What to skip:** view rendering smoke tests beyond a single "view mounts without throwing" per view. Visual regression is out of audit scope, and the H1 modular split makes integration testing cheaper later.

---

## CI / Dependency Monitoring

### GitHub Actions workflow shape

Single workflow file `.github/workflows/ci.yml`, runs on every PR + every push to `main`:

```yaml
# CONCEPTUAL — actual file written in the foundations phase
jobs:
  test:
    steps:
      - actions/checkout@<sha> # pinned SHA per SECURITY_AUDIT §A03
      - actions/setup-node@<sha> with node 20
      - npm ci
      - npm run lint # ESLint — flat config
      - npm run typecheck # tsc --noEmit
      - npm run test # Vitest (unit + happy-dom)
      - npm run test:rules # Vitest + emulator + @firebase/rules-unit-testing
      - npm audit --audit-level=high --omit=dev
      - npx osv-scanner@latest -r . # supplementary advisory scan
      - npm run build # Vite production build
  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    steps:
      - npx firebase-tools deploy --only hosting,firestore:rules,storage:rules,functions \
        --token "${{ secrets.FIREBASE_TOKEN }}"
```

**Key constraints from `SECURITY_AUDIT.md` §A03:**

- All third-party Actions pinned to **commit SHA** (`@<sha>`), not tag.
- Top-level `permissions:` block scoped to minimum required.
- Service account JSON **not** in env — use Firebase Hosting GitHub Action's recommended OIDC flow (`firebase init hosting:github` generates the secret + workflow correctly).

### Dependabot vs Renovate — decision

**Recommend: Dependabot.**

| Criterion       | Dependabot                                                       | Renovate                                                         | Why for this project                                                                                                                                                      |
| --------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup cost      | ~30 seconds (toggle in repo settings + 10-line `dependabot.yml`) | ~15 minutes (install GitHub App, onboarding PR, `renovate.json`) | This is a single-developer project. Setup-time parity matters.                                                                                                            |
| Platform        | GitHub-only                                                      | GitHub, GitLab, Bitbucket, Azure DevOps, Gitea                   | This project IS GitHub-only and will stay GitHub-only.                                                                                                                    |
| PR style        | One PR per outdated package (verbose)                            | Configurable grouping (e.g. all non-major patches in one PR)     | Renovate's grouping is genuinely better, but for a project with ~6 production deps (`firebase`, `chart.js`, `dompurify`, `@sentry/browser`) the verbose-PR model is fine. |
| Cost            | Free                                                             | Free (open-source)                                               | Tied.                                                                                                                                                                     |
| Auditor optics  | "We use Dependabot" is the GitHub-native answer prospects expect | Equally credible                                                 | Tied.                                                                                                                                                                     |
| Future-proofing | If you ever move to GitLab, switch then                          | Already multi-platform                                           | Not relevant — Firebase Hosting + GitHub is the chosen stack.                                                                                                             |

**Verdict:** Dependabot. The tipping point for Renovate is monorepo / complex grouping rules / multi-ecosystem. None of those apply. Use the saved 14.5 minutes elsewhere in the milestone.

**Configure both to run with:**

- Weekly schedule (not daily — noise reduction).
- Grouped patch updates only (Renovate-style if available; otherwise live with one-PR-per-dep).
- Auto-rebase enabled.
- Auto-merge **disabled** (compliance posture: human review on every dep bump).

### Supplements to Dependabot

- **OSV-Scanner** in CI on every PR. Adds advisories from OSV.dev (cross-ecosystem) that npm advisory DB hasn't picked up yet.
- **Socket.dev** GitHub App — free, post-Shai-Hulud essential, detects malicious-package behavioural patterns (`preinstall`/`postinstall` shenanigans, install-time network calls). Cited in `SECURITY_AUDIT.md` §10.2.
- **`npm audit signatures`** in CI — verifies package signatures.

---

## Observability — Sentry recommended

| Option                            | Verdict                   | Why                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sentry (free tier)**            | ✅ **Recommended**        | 5k errors/month free is sufficient for an app with no live users. Browser SDK (`@sentry/browser` v10.51.0) + Node SDK (`@sentry/node` v10.51.0 in Cloud Functions) share a single project + DSN — one dashboard for client and server errors. Source-map upload integrates with Vite via `@sentry/vite-plugin`. PII scrubbing on by default. EU data residency available. |
| Highlight.io                      | ⚪ Defensible alternative | Open-source self-host option exists; session replay built-in. Free tier comparable. **Not recommended** for this project because the auditor optics of "we use Sentry" are universally recognised; Highlight.io requires explanation.                                                                                                                                     |
| Bugsnag                           | ⚪ Defensible alternative | Mature product. Free tier weaker (7.5k errors but more pricing-heavy on growth). **Not recommended** — Sentry's free tier + brand recognition wins on a tie.                                                                                                                                                                                                              |
| GCP Error Reporting (server-only) | ⚠️ Partial                | Already wired to Cloud Functions stderr; near-zero setup cost. **Use as a backstop** for server errors, not as the primary sink. Doesn't cover client errors.                                                                                                                                                                                                             |
| LogRocket                         | ❌ Not recommended        | Session replay = privacy + GDPR review burden ("we record user sessions"). Avoid for a SaaS holding client diagnostic data unless prospect explicitly asks.                                                                                                                                                                                                               |
| Console.error only                | ❌ The status quo, M4     | Invisible to operators. Already a finding.                                                                                                                                                                                                                                                                                                                                |

**Concrete integration shape:**

- Browser: `Sentry.init({ dsn, tracesSampleRate: 0.1, integrations: [], release: import.meta.env.VITE_GIT_SHA })` after Firebase init in `firebase-init.js`'s replacement.
- Functions: `import * as Sentry from "@sentry/node"; Sentry.init({...}); export const myFn = onCall((req) => Sentry.withScope(...))`.
- Source-map upload via `@sentry/vite-plugin` in CI (release step).

---

## CSP / security-header tooling

**Decision: move from GitHub Pages → Firebase Hosting.**

Why: GitHub Pages cannot set HTTP response headers. CSP via `<meta http-equiv>` has known limitations:

- No `frame-ancestors` (must come from a real header).
- No `report-uri` / `report-to`.
- Late-parsed — directives that disallow already-loaded scripts are too late.
- HSTS, `X-Frame-Options`, `Permissions-Policy`, `Referrer-Policy`, `Cross-Origin-*-Policy` all need real headers.

Firebase Hosting solves this via `firebase.json` `hosting.headers`:

```json
{
  "hosting": {
    "public": "dist",
    "headers": [
      {
        "source": "/**",
        "headers": [
          {
            "key": "Strict-Transport-Security",
            "value": "max-age=63072000; includeSubDomains; preload"
          },
          { "key": "X-Content-Type-Options", "value": "nosniff" },
          { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
          { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" },
          { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
          { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" },
          {
            "key": "Content-Security-Policy",
            "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob: https://firebasestorage.googleapis.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://o0.ingest.sentry.io https://firebaseappcheck.googleapis.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
          }
        ]
      },
      {
        "source": "**/*.@(js|css)",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
      }
    ]
  }
}
```

Closes H4 fully.

**Migration cost:** trivial. One `firebase deploy --only hosting`, one DNS update on `baselayers.bedeveloped.com` from GitHub Pages CNAME → Firebase Hosting custom domain. ~30 minutes including DNS propagation. No data migration. **Constraint check:** doesn't conflict with "Stay on Firebase" (it's _more_ Firebase, not less).

**Optional plugin:** `vite-plugin-csp-guard@4.0.1` can compute hashes for inline scripts/styles at build time and emit them into the CSP — useful if you ever need `'sha256-...'` directives. Not required for this codebase if all `style="..."` inline strings are removed first (M5).

---

## Audit log storage approach

**Two-tier audit log — both layers are needed:**

### Tier 1 — application-level (what users did)

Dedicated **`audit/{eventId}` Firestore collection** written **only** by Cloud Functions (Firestore Rules: `allow write: if false` from clients; only the Admin SDK in Functions can write).

**Schema (each event):**

```
{
  eventId: string (UUID),
  ts: serverTimestamp,
  actor: { uid, email, role, orgId },
  action: "auth.signin" | "auth.signout" | "auth.mfa-enrolled" | "user.role-changed"
        | "org.created" | "org.deleted" | "org.restored"
        | "document.uploaded" | "document.deleted"
        | "data.exported" | "data.erased"
        | "rules.deployed" | ...,
  target: { kind, id, orgId },
  context: { ip, userAgent },
  metadata: { ...action-specific... },
  outcome: "success" | "denied" | "error"
}
```

Retention: keep 1 year online (Firestore), then archive to GCS via the same scheduled-export Function (lifecycle rule on the bucket: 1y → Archive class, 7y → delete).

### Tier 2 — infrastructure-level (what the platform did)

**Cloud Logging Data Access audit logs** for Firestore + Storage + Auth, routed to a **BigQuery sink** with `protoPayload.serviceName="firestore.googleapis.com"` filter. Captures every read/write with the IAM-identified principal — tamper-evident, append-only, and pre-redacted to a compliance-acceptable level.

**Why two tiers, not one:**

- Tier 1 is human-readable, queryable from the admin UI, gives the "who deleted that comment?" answer cheaply.
- Tier 2 is the auditor-acceptable infrastructure log — useful when Tier 1 is suspected tampered or when you need to prove a control was operating.

**Compliance citations:** SOC2 CC7.2 + CC7.3 (system monitoring + change management), ISO 27001 A.12.4.1 (event logging), GDPR Art. 32(1)(d) (process for testing effectiveness).

**Standard pattern at this scale:** application-tier in Firestore + infra-tier in Cloud Logging → BigQuery is the canonical Firebase compliance pattern (Google Cloud's own reference architecture for Firestore-on-Firebase + audit). Sole-Firestore-collection approach is too easy to tamper with from a compromised Function; sole-Cloud-Logging is too coarse for the "show me org X's deletion history" UI surface.

---

## Automated DR / Backup approach

**Pattern (Firebase canonical):**

1. **Scheduled Cloud Function** (`onSchedule("every day 03:00")`) calls `@google-cloud/firestore` Admin client's `exportDocuments()` with target `gs://bedeveloped-base-layers-backups/firestore/{YYYY-MM-DD}/`.
2. **GCS bucket lifecycle rule:** keep 30 days hot (Standard), 90 days warm (Nearline), 365 days cold (Archive), then delete. RPO ≤ 24h, RTO ≤ 2h (manual restore via `gcloud firestore import`).
3. **Storage backup:** Cloud Storage objects are versioned (enable Object Versioning on the bucket); soft-deleted Storage objects retained 30 days by default. **Enable `softDeletePolicy.retentionDurationSeconds: 7776000` (90d)** on the bucket via `gcloud storage buckets update --soft-delete-duration=90d`.
4. **Restore drill:** quarterly. Spin up a `bedeveloped-base-layers-restoredrill` GCP project, import latest export, confirm doc counts match. Document in `SECURITY.md` with date of last drill.
5. **Permissions:** the Cloud Function's service account needs `roles/datastore.importExportAdmin` and `roles/storage.objectAdmin` on the destination bucket only.

**Per `SECURITY_AUDIT.md` §7 (Ransomware row):** RPO ≤ 1h is the bar for _production data_. Daily exports give RPO 24h — defensible for "compliance-credible, not certified" but worth noting in `SECURITY.md` as a known deviation. **PITR (Point-in-Time Recovery)** is available for Firestore at extra cost — gives 7-day rolling restore down to the second. Recommend enabling once the milestone has live users again; skip for now to keep cost down between engagements.

**Compliance citations:** SOC2 CC9.1 (backup), ISO 27001 A.12.3.1 (information backup), CAF D1 (restore drill cadence), GDPR Art. 32(1)(c) (restore availability).

---

## Compliance Mapping Cheat-Sheet

| Control area               | Tools / config                                                                     | SOC2 CC      | ISO 27001 Annex A | GDPR Art. | OWASP ASVS L2 |
| -------------------------- | ---------------------------------------------------------------------------------- | ------------ | ----------------- | --------- | ------------- |
| Authentication             | Firebase Auth Email/Password + custom claims + email verification                  | CC6.1        | A.9.2             | 32(1)(b)  | V2.1          |
| MFA                        | Firebase Auth TOTP MFA + Identity Platform enforcement                             | CC6.7        | A.9.4             | 32(1)(b)  | V2.7          |
| Authorisation              | Firestore + Storage Rules + custom claims + Cloud Functions for trusted writes     | CC6.3        | A.9.4.1           | 32(1)(b)  | V4.1, V4.2    |
| Bot / abuse defence        | App Check (reCAPTCHA Enterprise)                                                   | CC6.6        | A.13.1            | 32(1)(b)  | V11.1         |
| Input validation           | DOMPurify on rich-text paths; size + MIME enforcement in Storage Rules             | CC6.1        | A.14.1.2          | 32(1)(b)  | V5.1, V5.2    |
| Output encoding / XSS      | Delete `html:` branch in `h()`, ESLint `no-unsanitized`, strict CSP                | CC6.6        | A.14.2.5          | 32(1)(b)  | V5.3          |
| Security headers           | Firebase Hosting `firebase.json` headers                                           | CC6.6        | A.13.1.3          | —         | V14.4         |
| Secrets management         | No client-side hashes; Cloud Secret Manager for Cloud Function secrets             | CC6.1        | A.10.1            | 32(1)(a)  | V6.1          |
| Audit logging              | Tier 1: `audit/{id}` Firestore + Cloud Functions; Tier 2: Cloud Logging → BigQuery | CC7.2, CC7.3 | A.12.4.1          | 32(1)(d)  | V7.1          |
| Observability              | Sentry browser + node                                                              | CC7.2        | A.12.4.1          | 32(1)(d)  | V7.4          |
| Backup / DR                | Scheduled Cloud Function + GCS lifecycle + quarterly drill                         | CC9.1        | A.12.3.1          | 32(1)(c)  | V14.1         |
| Right of access (Art. 15)  | Cloud Function `onCall("exportUserData")`                                          | —            | A.18.1.4          | 15, 20    | —             |
| Right to erasure (Art. 17) | `delete-user-data` Extension + Cloud Function                                      | —            | A.18.1.4          | 17        | —             |
| Dependency monitoring      | Dependabot + OSV-Scanner + Socket.dev                                              | CC8.1        | A.12.6            | 32(1)(d)  | V14.2         |
| CI / change management     | GitHub Actions + branch protection + required reviews                              | CC8.1        | A.14.2.2          | —         | V14.2         |
| Rate limiting              | App Check (perimeter) + Cloud Function token-bucket on writes                      | CC6.6        | A.13.1            | 32(1)(b)  | V11.1         |

---

## Installation — full sequence

```bash
# 1. Init
npm init -y

# 2. Production deps
npm install firebase@12.12.1 chart.js@4.5.1 dompurify@3.4.2 @sentry/browser@10.51.0

# 3. Dev deps (root)
npm install -D \
  vite@8.0.10 \
  vitest@4.1.5 \
  @vitest/coverage-v8@4.1.5 \
  happy-dom@20.9.0 \
  typescript@6.0.3 \
  eslint@10.3.0 \
  eslint-plugin-no-unsanitized@4.1.5 \
  eslint-plugin-security@4.0.0 \
  prettier@3.8.3 \
  @firebase/rules-unit-testing@5.0.0 \
  firebase-tools@15.16.0

# 4. Init Firebase (interactive — choose Hosting, Firestore, Storage, Functions, Emulators)
npx firebase init

# 5. Functions workspace deps
cd functions
npm install firebase-admin@13.8.0 firebase-functions@7.2.5 @sentry/node@10.51.0
npm install -D firebase-functions-test@3.4.1 typescript@6.0.3
cd ..

# 6. Install Firebase Extensions (interactive)
npx firebase ext:install firebase/firestore-send-email
npx firebase ext:install firebase/delete-user-data

# 7. Enable App Check (Console — no CLI)
#    Firebase Console → App Check → Register app → reCAPTCHA Enterprise

# 8. Upgrade Auth → Identity Platform (Console — one-click, free up to 50k MAU)
#    Firebase Console → Authentication → Settings → Upgrade
```

---

## Alternatives Considered

| Recommended                              | Alternative                                  | When to Use Alternative                                                                                                                                                                                                                                |
| ---------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vite                                     | Webpack                                      | Never for this project — Webpack's vanilla-JS DX in 2026 is materially worse than Vite's; the only reason to pick Webpack is an existing config investment.                                                                                            |
| Vite                                     | esbuild (raw)                                | If the project ever drops the dev-server need entirely — esbuild as a build-only tool is faster than Vite's underlying Rollup, but Vite's HMR + emulator integration win for this milestone.                                                           |
| Vitest                                   | Node's built-in `node:test`                  | If the test surface stays purely _pure-function_ (scoring math, migration logic) and never touches DOM / Firestore Rules. The moment you need `happy-dom` or rules-unit-testing, Vitest is simpler.                                                    |
| TypeScript `--checkJs` (no rewrite)      | Full TS rewrite                              | Out of scope per Constraints.                                                                                                                                                                                                                          |
| Dependabot                               | Renovate                                     | If the project ever moves to a monorepo, GitLab, or needs grouped non-major updates as one PR.                                                                                                                                                         |
| `@sentry/browser`                        | Highlight.io / Bugsnag / GCP Error Reporting | If a customer / auditor specifically asks for self-hosted error tracking (Highlight.io) or if cost ever materially exceeds Sentry's tier.                                                                                                              |
| Firebase Hosting                         | Cloudflare Pages / Vercel                    | Both can set headers, both support custom domains. **Don't do this** — fragmenting the platform off Firebase contradicts the Constraint. Firebase Hosting also has the BotID-equivalent perimeter integrations Vercel lacks for non-Vercel-stack apps. |
| 2nd-gen Cloud Functions                  | 1st-gen Cloud Functions                      | Never for new code in 2026 — `functions.config()` decommissioned March 2027 forces migration anyway.                                                                                                                                                   |
| reCAPTCHA Enterprise (App Check)         | reCAPTCHA v3 (App Check)                     | Firebase docs explicitly recommend Enterprise for new integrations; v3 is legacy. Free quota is comparable for this app's scale.                                                                                                                       |
| Application + infra audit log (two-tier) | Application-only audit log                   | If running in a regulated environment (PCI, HIPAA, FedRAMP) — the infra log is non-negotiable. For "compliance-credible, not certified" the two-tier is the right bar.                                                                                 |
| Firestore Scheduled Export + GCS         | Firestore PITR                               | PITR is better DR (7d rolling, second-level RPO) but costs extra and is unnecessary while between engagements. Add when going live.                                                                                                                    |

---

## What NOT to Use

| Avoid                                                                | Why                                                                                                                                                                                          | Use Instead                                                                                                                    |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Firebase JS SDK 9.x or 10.x**                                      | The codebase is on 10.13.0; v11 reorganised internal exports and v12 is current. Staying on 10.x means missing security patches and tree-shaking improvements. **Move directly to 12.12.1.** | `firebase@12.12.1`                                                                                                             |
| **Anonymous Firebase Auth as the only sign-in method**               | The substrate of C1 + C3 + M6. Anonymous auth produces a token with no user identity; Security Rules cannot enforce per-user authorisation against it.                                       | Email/Password + custom claims; anonymous can co-exist for unauthenticated browsing if needed but never as the trust boundary. |
| **Firebase Hosting "Compatibility mode"**                            | Legacy; ignore when init asks.                                                                                                                                                               | Firebase Hosting (default) — supports `firebase.json` headers natively.                                                        |
| **`functions.config()` for secrets**                                 | Decommissioned March 2027 per Firebase docs.                                                                                                                                                 | Cloud Secret Manager via `defineSecret()` in `firebase-functions/params`.                                                      |
| **Storing JWTs / session tokens in `localStorage`**                  | XSS-readable. The current pattern (`baselayers:session`) is exactly the failure mode `SECURITY_AUDIT.md` §A04 calls out.                                                                     | Firebase Auth manages its own session via IndexedDB internally — leave it alone. Don't add a custom token cache.               |
| **`Math.random()` for ids** (H5)                                     | Non-CSPRNG; ~36 bits of entropy.                                                                                                                                                             | `crypto.randomUUID()` — universally available, ~122 bits, one-line replacement.                                                |
| **Plain SHA-256 of passwords** (`INTERNAL_PASSWORD_HASH` — C2)       | No salt, no key-stretch; brute-forceable in seconds. Never roll your own auth.                                                                                                               | Firebase Auth — Firebase handles password hashing via scrypt internally. Delete the hash.                                      |
| **CDN-loaded scripts with no SRI** (current state — H4)              | Supply-chain compromise on jsdelivr or gstatic = full DOM access, Firestore credential exfiltration.                                                                                         | Self-host via Vite bundle; Vite emits content-hashed filenames + SRI integrity attrs.                                          |
| **`<meta http-equiv="Content-Security-Policy">` as the primary CSP** | Doesn't support `frame-ancestors`, `report-uri`. Late-parsed.                                                                                                                                | Real `Content-Security-Policy` HTTP header via Firebase Hosting `firebase.json`.                                               |
| **`innerHTML = userString` anywhere**                                | C4 + the entire OWASP A03 XSS category.                                                                                                                                                      | DOM construction (`createElement` + `createTextNode`) or DOMPurify when HTML is genuinely needed.                              |
| **Webpack** for this project                                         | Slower DX, more config, no ecosystem advantage for vanilla JS in 2026.                                                                                                                       | Vite.                                                                                                                          |
| **Jest** for this project                                            | Heavier, slower, separate config from the build tool. Vitest is the strict superset for Vite-based projects.                                                                                 | Vitest.                                                                                                                        |
| **Cloudflare in front of Firebase Hosting**                          | Strips headers Firebase Hosting expects to set; also adds another caching layer to debug.                                                                                                    | Firebase Hosting's own CDN is sufficient for this app's traffic.                                                               |
| **Renovate** for this project                                        | Setup overhead with no payoff at this scale (single dev, GitHub-only, ~6 prod deps).                                                                                                         | Dependabot.                                                                                                                    |
| **`functions.https.onRequest` (1st gen) for new code**               | 1st gen scheduled for `functions.config()` decommission March 2027.                                                                                                                          | `firebase-functions/v2/https.onCall` (2nd gen).                                                                                |
| **MCP servers connected to production Firebase**                     | `SECURITY_AUDIT.md` §LLM03 + §8.7 — explicit "never connect MCP to production database with write access".                                                                                   | Out of scope for this milestone, but flag it in `SECURITY.md` as a forward-looking control.                                    |
| **Performance Monitoring SDK** in this milestone                     | Adds bundle size, adds another data flow to document for GDPR DPIA, and isn't on the critical path.                                                                                          | Defer until post-milestone.                                                                                                    |

---

## Stack Patterns by Variant

**If the milestone is closing CRITICAL findings only (subset variant):**

- Cut: Sentry, OSV-Scanner, Socket.dev, BigQuery audit-log sink, Trigger Email Extension, scheduled backup automation, soft-delete Cloud Functions.
- Keep: Vite + Vitest + Firestore Rules + Storage Rules + Email/Password auth + custom claims + App Check + CSP via Firebase Hosting.
- Use this if commercial pressure forces a 2-week timeline instead of 6.

**If the project ever takes on a regulated customer (HIPAA / FedRAMP):**

- Add: Firestore PITR, Cloud KMS-managed encryption keys (CMEK), VPC Service Controls, infrastructure-level customer-managed encryption.
- Replace: Sentry free tier → Sentry Business plan with PII scrubbing audited, or self-hosted Sentry.

**If a framework rewrite is greenlit later (separate milestone):**

- Pick: SvelteKit or Astro for vanilla-JS-feel-with-routing. **Don't pick React** — the ecosystem of XSS / RSC / `dangerouslySetInnerHTML` / CVE-2025-55182 React2Shell footguns adds compliance burden the current vanilla approach avoids.

---

## Version Compatibility

| Package A                            | Compatible With                | Notes                                                                                                                                                             |
| ------------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `firebase@12.12.1`                   | Node 18+ for build tooling     | Browser SDK runs in any modern browser ES2020+.                                                                                                                   |
| `firebase-functions@7.2.5`           | `firebase-admin@13.8.0`        | Both released 2026, paired. v7 functions support Node 18, 20, 22 runtimes — pick **Node 22** for 2nd gen (longest support window).                                |
| `firebase-functions@7.x`             | `firebase-tools@15.16.0`       | CLI v15 supports Functions Gen 2 + emulator. Older CLI versions (≤ v12) can deploy Gen 2 but with reduced emulator features.                                      |
| `vite@8`                             | `vitest@4`                     | Same Rollup version line; share `vite.config.js`.                                                                                                                 |
| `vite@8`                             | Node 20.19+ or 22.12+          | Vite 8 dropped Node 18 support — pin CI to Node 22.                                                                                                               |
| `@firebase/rules-unit-testing@5.0.0` | `firebase-tools@15.x` emulator | Works with v15 emulator suite.                                                                                                                                    |
| `@sentry/browser@10`                 | `@sentry/node@10`              | Pair both at v10 for source-map upload + release tracking consistency.                                                                                            |
| `typescript@6.0.3`                   | `--allowJs --checkJs`          | TS 6 keeps full JSDoc-checking parity; safe for typecheck-only mode.                                                                                              |
| `chart.js@4.5.1`                     | None of note                   | Drop-in upgrade from 4.4.1; tree-shaking via `import { Chart, RadarController, DoughnutController } from 'chart.js'` requires registering controllers explicitly. |
| `dompurify@3.4.2`                    | Browser DOM                    | Not needed in Cloud Functions (no DOM there); browser-only.                                                                                                       |

---

## Sources

- **Firebase JS SDK** — npm registry `npm view firebase version` → `12.12.1` (verified 2026-05-03). [HIGH]
- **firebase-admin** — npm registry → `13.8.0` (verified 2026-05-03). [HIGH]
- **firebase-functions** — npm registry → `7.2.5` (verified 2026-05-03). [HIGH]
- **firebase-tools** — npm registry → `15.16.0`. [HIGH]
- **Vite** — npm registry → `8.0.10`. [HIGH]
- **Vitest** — npm registry → `4.1.5`. [HIGH]
- **TypeScript** — npm registry → `6.0.3`. [HIGH]
- **ESLint** — npm registry → `10.3.0`. [HIGH]
- **@sentry/browser / @sentry/node** — npm registry → `10.51.0`. [HIGH]
- **Chart.js** — npm registry → `4.5.1`. [HIGH]
- **DOMPurify** — npm registry → `3.4.2`. [HIGH]
- **`@firebase/rules-unit-testing`** — npm registry → `5.0.0`. [HIGH]
- **`firebase-functions-test`** — npm registry → `3.4.1`. [HIGH]
- **Cloud Functions Gen 2 recommendation** — Firebase docs, [2nd gen upgrade guide](https://firebase.google.com/docs/functions/2nd-gen-upgrade) — confirms Gen 2 is current default and `functions.config()` decommission March 2027. [HIGH]
- **App Check + reCAPTCHA Enterprise** — [Firebase App Check docs](https://firebase.google.com/docs/app-check) — confirms reCAPTCHA Enterprise + v3 are the web providers, lists protected services (Firestore, Storage, Auth preview, Cloud Functions). [HIGH]
- **App Check pricing** — [reCAPTCHA Enterprise pricing](https://cloud.google.com/recaptcha/docs/compare-tiers) confirmed via WebSearch — 10k assessments/month free. [MEDIUM, verify on the Firebase Console at install time]
- **MFA on Identity Platform vs base Firebase Auth** — [Firebase MFA docs](https://firebase.google.com/docs/auth/web/multi-factor) — SMS MFA requires Identity Platform upgrade; TOTP supported on base. [HIGH]
- **Custom claims pattern** — [Firebase Admin SDK custom-claims docs](https://firebase.google.com/docs/auth/admin/custom-claims) — `setCustomUserClaims()` + `beforeUserCreated` trigger; 1KB payload limit. [HIGH]
- **Firebase Hosting headers** — [Firebase Hosting full-config docs](https://firebase.google.com/docs/hosting/full-config) — confirms `firebase.json` `hosting.headers` JSON shape. [HIGH]
- **Scheduled Firestore export pattern** — [Firestore scheduled-export docs](https://firebase.google.com/docs/firestore/solutions/schedule-export) — Cloud Scheduler + Cloud Function pattern remains canonical. [HIGH]
- **Firestore Cloud Audit Logs → BigQuery** — [Cloud Logging audit best-practices](https://docs.cloud.google.com/logging/docs/audit/best-practices) + [Firestore audit logging docs](https://docs.cloud.google.com/firestore/native/docs/audit-logging) — confirms sink-to-BigQuery as the standard compliance pattern. [HIGH]
- **Dependabot vs Renovate for single dev** — [appsecsanta.com 2026 comparison](https://appsecsanta.com/sca-tools/dependabot-vs-renovate) + [Renovate Bot comparison docs](https://docs.renovatebot.com/bot-comparison/) — confirms Dependabot for GitHub-only / single-dev, Renovate for multi-platform / monorepo. [MEDIUM]
- **Sentry bundle size** — [Sentry bundle-size guide](https://www.mintlify.com/getsentry/sentry-javascript/guides/best-practices/bundle-size) + [bundle-size optimisation blog](https://blog.sentry.io/javascript-sdk-package-reduced/) — minimum config <30kB gzipped. [MEDIUM]
- **`SECURITY_AUDIT.md`** — repo root — control framework citations (OWASP A01–A10:2025, ASVS L2 sections, CAF v4.0). [HIGH — primary input]
- **`.planning/codebase/STACK.md` + `INTEGRATIONS.md` + `CONCERNS.md`** — pre-existing codebase analysis dated 2026-05-03. [HIGH — primary input for "current state"]

---

_Stack research for: Firebase-backed vanilla-JS SPA hardening (compliance-credible)_
_Researched: 2026-05-03_
