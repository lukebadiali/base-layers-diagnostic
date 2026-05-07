# Security — Base Layers Diagnostic

**Last updated:** 2026-05-04 (Phase 1 close)
**Disclosure contact:** security@bedeveloped.com
**Supported versions:** main branch only (no released versions yet).

## Vulnerability disclosure policy

> Phase 11 finalises the policy wording. Current placeholder:
>
> If you believe you have found a security vulnerability in this codebase
> or in the deployed application, please email `security@bedeveloped.com`.
> We will acknowledge your report within 5 business days. We do not take
> legal action against good-faith security researchers acting under the
> terms of this policy.

---

## § Build & Supply Chain

**Control:** All production dependencies (Firebase JS SDK, Chart.js,
DOMPurify, Sentry) are declared in `package.json` at exact pinned versions
(no `^` / `~` ranges) and resolved via `package-lock.json` for reproducible
installs. The Vite 8 build pipeline produces content-hashed filenames
(`*-<hash>.js`) replacing the prior hand-bumped `?v=46` cache-busting
pattern. Build output is verified in CI on every PR via the `Build` job
which uploads `dist/` as a workflow artefact (no production deploy in
Phase 1 — the live site continues to ship from GitHub Pages until
Phase 3's hosting cutover).

**Evidence:**

- Pinned dep versions: `package.json` (Wave 0 — commit `0d5757a`)
- Lockfile reproducibility: `npm ci --dry-run` exits 0 (verified Wave 0)
- Hashed-filename build: `vite.config.js` `rollupOptions` (Wave 1)
- CI build verification: `.github/workflows/ci.yml` `build` job (Wave 3)
- First green CI run: [#25317482833](https://github.com/lukebadiali/base-layers-diagnostic/actions/runs/25317482833) — `dist/` artefact contains `main-BtavOejk.js`, `main-UhxH0Ugg.css`, `logo-Dq8JoGF5.png` (URL-safe base64 hashes)

**Framework citations:**

- OWASP ASVS L2 V14.4.2 — all client-side resources are served from a
  controlled origin (substrate; Phase 3 deploys `dist/` to Firebase Hosting)
- OWASP ASVS L2 V14.2.1 — all components kept up to date; Dependabot
  automates monitoring (see § Dependency Monitoring)
- ISO/IEC 27001:2022 A.8.25 — secure development life cycle
- ISO/IEC 27001:2022 A.8.28 — secure coding (Vite build enforces ESM
  tree-shaking; no dead code paths served)
- SOC 2 CC8.1 — change management; all dependency changes gated by CI +
  human review

**Regression baseline (Phase 2):** TEST-01..07 + TEST-10 form the codified
pre-Phase-4 contract. Vitest 4 unit tests assert the public behaviour of all
extracted leaf modules under `src/`; file-snapshot tests under
`tests/__snapshots__/views/` pin dashboard / diagnostic / report DOM output.
Coverage thresholds (per-directory, hard CI fail) are wired in `vite.config.js`
and verified by the `Test` CI job. The Phase 4 modular split is gated by these
tests staying green; any drift surfaces as a CI failure or a snapshot diff
reviewable in the PR.

**Evidence:**

- Test files: `tests/util/`, `tests/domain/`, `tests/data/`, `tests/auth/`, `tests/views/`
- Snapshot baselines: `tests/__snapshots__/views/*.html` (committed; D-08)
- Coverage thresholds: `vite.config.js` `test.coverage.thresholds` (D-15)
- HTML coverage artefact in CI: `coverage-report-html` per workflow run (D-20)

**Framework citations:**

- OWASP ASVS L2 v5.0 V14.2 — dependencies and build verification
- ISO/IEC 27001:2022 A.12.1.2 — change management (testing of changes)
- SOC 2 CC8.1 — change management evidence trail
- GDPR Art. 32(1)(d) — process for testing/evaluating effectiveness of technical measures

### Phase 4 Wave 2 — html: escape hatch deletion + permanent XSS regression test (CODE-04)

The `html:` attribute branch in the `h(tag, attrs, children)` DOM helper was deleted (`src/ui/dom.js`). Previously `h("div", { html: userContent })` would set `el.innerHTML = userContent`, an XSS escape hatch annotated with `// eslint-disable-next-line no-unsanitized/property` (CONCERNS C4). The branch has no callers in the current codebase (verified by grep across `app.js` and `src/**/*.js`); deleting it removes a defended-but-still-present risk surface.

A permanent regression test fixture at `tests/ui/dom.test.js` pins three assertions: `<script>` payloads inside string children render as text content (`textContent` equals the literal string, no DOM `<script>` element materialises, `window.__xss` remains undefined); `<img onerror>` payloads render as text content (no DOM `<img>` element materialises); the literal attribute name `html:` is silently ignored at runtime (no children consumed; no descendants from the value string). The fixture is doc-comment-marked "REGRESSION FIXTURE — permanent" so future ESLint disables that re-introduce `innerHTML =` in any new module fail this test.

The Wave 2 ESLint hardening also flipped the `domain/* → firebase/*` boundary from warn to error (`eslint.config.js`); domain modules are pure logic and must not import the Firebase SDK (lint-codifies the Phase 2 D-03 already-zero-imports state). The rule is dormant-but-active at Wave 2 close — zero `src/domain/**` files import `firebase/*` today, so no errors fire, but reintroduction during any subsequent change fails CI. Combined with the Wave 1 firebase-SDK boundary (only `src/firebase/**` may import the SDK directly), the lint graph now enforces two of the four ARCHITECTURE.md §2.4 boundaries; Waves 3 + 4 close `data/*` and `views/*`.

**Evidence:**

- `html:` deletion: `src/ui/dom.js` (commit `ceeb07f` Plan 04-02)
- XSS regression fixture: `tests/ui/dom.test.js` (REGRESSION FIXTURE marker)
- Cleanup-ledger row closure: `runbooks/phase-4-cleanup-ledger.md` Suppressions table — `app.js:676` (no-unsanitized/property) row deleted
- Wave 2 ESLint flip: `eslint.config.js` `src/domain/**/*.js` block (commit Plan 04-02 Task 3)
- Verification: `npm run test` exits 0 (XSS fixture green); `npm run lint` exits 0 (rule active, dormant); `grep -c "k === \"html\"" src/ui/dom.js app.js` returns 0

**Framework citations:**

- OWASP ASVS L2 v5.0 V5.3 — Output Encoding / XSS prevention (closes the `html:` escape hatch)
- OWASP ASVS L2 v5.0 V14.2 — Code Integrity (lint-enforced module boundaries)
- ISO/IEC 27001:2022 Annex A.8.28 — Secure coding (modular boundary + lint enforcement)
- ISO/IEC 27001:2022 Annex A.13.1.3 — Network segregation (boundary enforcement at the lint layer mirrors the network/trust boundary policy)
- SOC 2 CC8.1 — Change management; the regression fixture + lint flips land atomically with the code edit per Phase 1 D-25 atomic-commit pattern, and CI hard-fails on either drift
- GDPR Art. 32(1)(b) — Confidentiality of processing (XSS prevention is a confidentiality control because successful XSS leaks session tokens / form data)

---

## § Dependency Monitoring

**Controls:**

- **Pinned versions** — `package.json` declares every production and dev
  dep at exact version. `package-lock.json` is committed. `npm ci` in CI
  verifies integrity hashes on every reinstall (closes the substrate of
  T-1-01 supply-chain compromise).
- **Dependabot** monitors three ecosystems weekly (Mondays):
  - `npm` at `/` (root deps)
  - `npm` at `/functions` (forward-declared for Phase 7)
  - `github-actions` at `/` (keeps the SHA-pinned Actions in
    `.github/workflows/ci.yml` fresh)

  All Dependabot PRs require human review (auto-merge is intentionally OFF —
  compliance posture per D-19).
- **Socket.dev GitHub App** provides install-time behavioural
  malicious-package detection (post-Shai-Hulud-class supply chain attacks)
  on every dependency update PR.
- **OSV-Scanner** runs in CI on every PR via
  `google/osv-scanner-action`, checking against the OSV.dev advisory
  database (broader coverage than npm advisory DB alone). Currently
  configured as soft fail (`continue-on-error: true`) per D-20 — first
  30 days of false-positive baselining; hardens to fail-fast at 2026-06-03
  per `runbooks/phase-4-cleanup-ledger.md` "Out-of-band soft-fail entries".
- **`npm audit --audit-level=high --omit=dev`** runs as a HARD CI gate
  on every PR. Production-dep high-severity findings block merge.

**Evidence:**

- `.github/dependabot.yml` (Wave 4 — commit `e4806a2`) — three ecosystems weekly cadence
- `runbooks/socket-bootstrap.md` + `docs/evidence/socket-install.png`
  (Wave 5) — Socket.dev install evidence
- `.github/workflows/ci.yml` `audit` job (Wave 3) — npm audit HARD,
  OSV-Scanner SOFT, gitleaks-action backstop
- `.github/workflows/ci.yml` `setup` + per-job `npm ci` (Wave 3) — lockfile
  integrity-hash verification on every CI run
- First green audit run: [run #25317482833](https://github.com/lukebadiali/base-layers-diagnostic/actions/runs/25317482833) (run #25317275925 surfaced two real problems and was followed by `de0bb38` `fix(01-04): set fetch-depth: 0 on audit checkout` to unblock gitleaks history scan)

**Framework citations:**

- OWASP ASVS L2 V14.2.1 — components up to date and free from known
  vulnerabilities
- OWASP ASVS L2 V14.2.4 — risk-based dependency review (Dependabot PRs
  require human review)
- ISO/IEC 27001:2022 A.8.8 — management of technical vulnerabilities
- ISO/IEC 27001:2022 A.8.30 — outsourced development (supply chain
  oversight)
- SOC 2 CC8.1 — change management evidence trail
- GDPR Art. 32(1)(d) — process for regularly testing and evaluating
  effectiveness of security measures

---

## § Secret Scanning

**Controls:**

- **gitleaks pre-commit hook** (`.husky/pre-commit`) scans every staged
  diff. Blocks commits containing secrets matching the gitleaks default
  ruleset PLUS a custom rule (see below). Local install via
  `scoop install gitleaks` (Windows) or `brew install gitleaks`
  (macOS) — documented in `CONTRIBUTING.md`.
- **gitleaks CI step** (`gitleaks/gitleaks-action`) runs in the `audit`
  job on every PR + push as the backstop for developers who use
  `--no-verify` to skip the local hook. Requires `actions/checkout`
  with `fetch-depth: 0` so the action can compute its incremental
  scan range (configured Wave 3 fix `de0bb38`).
- **Custom rule `sha256-hex-literal-regression`** (`.gitleaks.toml`)
  matches a 64-char hex literal preceded (within 20 chars) by one of the
  context words `password|hash|secret|key|token|credential`. This rule
  exists specifically to catch a regression of finding C2 — the prior
  `INTERNAL_PASSWORD_HASH = "<64-hex>"` constant in `app.js`. Synthetic
  probe in Wave 2 verified the rule fires.
- **Allowlist** for `tests/`, `runbooks/`, and `.planning/` permits
  legitimate fixtures and the documentation that quotes the C2-shape
  hash to anchor the rule's intent.

**Known gap (grandfathered):** The pre-existing
`INTERNAL_PASSWORD_HASH = "6110f27c..."` constant at `app.js:505` is
itself a finding the custom rule would block, but it is grandfathered in
(it predates Phase 1; the first-green-CI gitleaks scan on commit range
`c2c2454^..56eee56` did not pull line 505 into the diff context, so it
was not flagged). Closure: Phase 6 AUTH-14 deletes the constant when
real Firebase Auth replaces the shared-password substrate. Tracked in
`runbooks/phase-4-cleanup-ledger.md` "Out-of-band soft-fail entries".

**Evidence:**

- `.husky/pre-commit` (Wave 2 — commit `29a0d1f`) — local gate
- `.gitleaks.toml` (Wave 2 — commit `7a3505e`) — config + custom rule + allowlist
- `.github/workflows/ci.yml` `audit` job gitleaks-action step (Wave 3) —
  CI backstop with `fetch-depth: 0`
- Wave 2 commit body (`29a0d1f`) — synthetic probe evidence (committing the literal
  C2 hash shape was BLOCKED by the pre-commit hook)
- First clean gitleaks scan in CI: run #25317482833 — `INF no leaks found`
- Phase 6 AUTH-14 (future) — closure of the grandfathered finding

**Framework citations:**

- OWASP ASVS L2 V14.3.2 — application source code does not contain
  secrets
- ISO/IEC 27001:2022 A.10.1 — use of cryptographic controls (ensures
  secrets remain secret)
- ISO/IEC 27001:2022 A.10.1.1 — policy on the use of cryptographic
  controls
- SOC 2 CC6.1 — logical and physical access controls (credentials
  cannot be committed to repo)
- GDPR Art. 32(1)(a) — appropriate technical measures for protection of
  personal data

---

## Sections planned for later phases

The sections below are stubs. Each phase that closes a SECURITY.md claim
appends to the corresponding stub in the same atomic commit (D-25 —
Pitfall 19 prevention).

### § Authentication & MFA — *TODO Phase 6*

Will document: real Firebase Auth (Email/Password + claims), TOTP MFA
enforced for internal users, recovery codes, two-admin recovery
procedure, password policy (HIBP leaked check, ≥12 chars), email
verification, account-enumeration mitigation. Deletes the prior
`INTERNAL_PASSWORD_HASH` constant (closure of the grandfathered §
Secret Scanning gap above).

### § Authorization & Tenant Isolation — *TODO Phases 5 & 6*

Will document: claims-based Firestore Rules (`role`, `orgId`),
Storage Rules (size + MIME + path scope), tenant-jump test, deploy
rollback procedure.

### § Audit Logging — *TODO Phases 7 & 9*

Will document: `auditLog/{eventId}` server-only collection, audit-event
schema, mirror Firestore-trigger audit writers, BigQuery sink + 7-year
retention, audited-user-cannot-read-own predicate.

### § Data Lifecycle & GDPR — *TODO Phase 8*

Will document: soft-delete + 30-day restore, `gdprExportUser`,
`gdprEraseUser` with consistent-token tombstone, audit-vs-erasure
conflict resolution, backup-rotation propagation.

### § Backup & DR — *TODO Phase 8*

Will document: daily Firestore export, GCS lifecycle (30d Standard / 90d
Nearline / 365d Archive), Firestore PITR (7-day rolling), Storage Object
Versioning + 90-day soft-delete, signed-URL TTL ≤ 1h, restore-drill
runbook.

### § Observability — *TODO Phase 9*

Will document: Sentry browser + node (EU region), PII scrubber, Slack
webhook auth-anomaly alerts, uptime monitor, Firebase budget alerts,
Sentry quota alert.

## § HTTP Security Headers

**Control:** Production traffic to `https://baselayers.bedeveloped.com` is served by Firebase Hosting with a static set of HTTP security response headers configured via `firebase.json hosting.headers` on the `**` source. The header set hardens the boundary against header-stripping downgrade attacks (HSTS), MIME-sniffing tampering (X-Content-Type-Options), referrer leakage (Referrer-Policy), high-risk web platform APIs in unaudited contexts (Permissions-Policy), cross-origin window-handle abuse (COOP), cross-origin embedding without isolation (COEP), and cross-origin resource reads (CORP). Cross-Origin-Embedder-Policy is set to `credentialless` rather than `require-corp` because Firebase CDN-hosted resources do not emit `Cross-Origin-Resource-Policy: cross-origin` and the credentialless variant tolerates that without breaking Storage downloads or Auth popups (Phase 6 verifies this assumption against real Auth flows).

**Evidence:**

- Header configuration: `firebase.json` `hosting.headers[0]` (source: `**`) — Phase 3 Plan 02 commit `e7a3e06`
- Schema validation: `tests/firebase-config.test.js` — guards against silent header drop (T-3-1) on every `npm test` run — Phase 3 Plan 02 commit `03f4c07`
- Post-deploy assertion: `.github/workflows/ci.yml` `deploy` job step "Assert security headers" — fails the deploy if any of HSTS / X-CTO / Referrer-Policy / Permissions-Policy / COOP / COEP / CSP-RO is missing from the live response — Phase 3 Plan 04 commit `49afecb`
- Header values:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (HSTS preload submission deferred to Phase 10 / HOST-06 — gated by ≥7-day stable policy)
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), bluetooth=(), hid=(), midi=(), serial=(), display-capture=(), idle-detection=(), browsing-topics=(), interest-cohort=(), autoplay=(), encrypted-media=(), picture-in-picture=(), fullscreen=(), screen-wake-lock=(), web-share=()` (FLoC's `interest-cohort` retained for backward compatibility alongside its replacement `browsing-topics`)
  - `Cross-Origin-Opener-Policy: same-origin`
  - `Cross-Origin-Embedder-Policy: credentialless`
  - `Cross-Origin-Resource-Policy: same-origin`

**Framework citations:**

- OWASP ASVS L2 v5.0 V14.4 — HTTP Security Headers
- ISO/IEC 27001:2022 A.13.1.3 — Segregation in networks (header-enforced same-origin boundary)
- SOC 2 CC6.6 — Logical access security boundaries

### Phase 4 Wave 1 — CSP allowlist tightening (CODE-01 + ARCHITECTURE.md §2)

The Content-Security-Policy-Report-Only header was tightened to drop three CDN allowlist entries that became unnecessary once Chart.js moved to npm import (`chart.js@4.5.1` bundled via Vite) and Google Fonts (Inter + Bebas Neue, both OFL-licensed) were self-hosted under `assets/fonts/`:

- `script-src` no longer allows `https://cdn.jsdelivr.net` (Chart.js bundled via `src/ui/charts.js` ESM import)
- `style-src` no longer allows `https://fonts.googleapis.com` (font CSS self-hosted via `styles.css` `@font-face` declarations)
- `font-src` no longer allows `https://fonts.gstatic.com` (woff2 binaries served from `dist/assets/`)

This shrinks Phase 10's `HOST-07` strict-CSP-enforcement work to a single-knob flip (drop `'unsafe-inline'` from `style-src` after the Wave 4 inline-style sweep). The change landed atomically with the npm migration commit per the Phase 1 D-25 atomic-commit pattern (no separate "docs catch-up" commit). The CSP-Report-Only baseline established in Phase 3 (HOST-04) remains active; the report sink at `/api/csp-violations` (FN-10) continues to receive violation reports during the report-only soak.

The same wave landed `src/firebase/{app,auth,db,storage,functions,check}.js` as the per-feature SDK adapter (D-05/D-06/D-07 — `src/firebase/check.js` is a no-op stub Phase 7 fills with reCAPTCHA Enterprise without changing the adapter shape) and flipped `eslint.config.js`'s `no-restricted-imports` rule from `warn` to `error` for the `firebase/firestore | firebase/storage | firebase/auth | firebase/app-check | firebase/functions` group (D-04). Non-`src/firebase/**` files can no longer import the SDK directly — every Firestore/Storage/Auth/Functions touch goes through the adapter, which is the audit-narrative anchor for "every Firebase write goes through `data/*`, which goes through `firebase/db.js`, which goes through the SDK."

Wave 1 also closed CODE-03 (CWE-330 mitigation): `src/util/ids.js` `uid()` swapped from the predictable PRNG-backed implementation to `crypto.randomUUID()` (CSPRNG); the corresponding cleanup-ledger row closes.

**Framework citations (Wave 1 increment):**

- OWASP ASVS L2 v5.0 V14.2 — Dependencies (npm migration removes unmanaged CDN supply chain)
- OWASP ASVS L2 v5.0 V14.7 — Build & Deploy (Vite-bundled SRI replaces CDN-without-SRI)
- OWASP ASVS L2 v5.0 V6.3 — Random Values (CSPRNG via `crypto.randomUUID()` — CODE-03)
- ISO/IEC 27001:2022 A.13.1.3 — Network segregation (CSP allowlist tightening)
- ISO/IEC 27001:2022 A.8.24 — Use of cryptography (CSPRNG enforcement)
- ISO/IEC 27001:2022 A.8.28 — Secure coding (modular boundary + lint enforcement via `no-restricted-imports`)
- SOC 2 CC6.6 — Logical access (boundary enforcement via lint)
- SOC 2 CC8.1 — Change management (atomic commits per requirement)

---

## § Content Security Policy (Report-Only)

**Control:** A two-tier CSP is shipped in `Content-Security-Policy-Report-Only` mode this phase. The tight tier covers `script-src`, `connect-src`, `frame-src`, `object-src`, `base-uri`, `form-action`, and `frame-ancestors 'none'`. The temporary permissive tier is `style-src 'self' 'unsafe-inline'` — Phase 4 sweeps inline `style="..."` strings across the views (CODE-06 / M5) and Phase 10 (HOST-07) drops `'unsafe-inline'` to enforce the strict policy. Reports are dual-channeled — legacy `report-uri /api/csp-violations` plus modern `Reporting-Endpoints` / `report-to csp-endpoint`, both pointing at the same same-origin path served by the `cspReportSink` Cloud Function (built in Phase 3 Plan 03; deployed by Phase 3 Plan 04 / 05). The function filters extension and synthetic origins and dedupes within a 5-minute in-memory window before emitting structured `severity=WARNING` entries to Cloud Logging.

**Temporary CDN allowlist (Phase 3 only — removed in Phase 4):** Wave 1 pre-flight (`03-PREFLIGHT.md ## dist/index.html font-CDN scan`) confirmed the Vite-built `dist/index.html` retains three external loads that the CDN→npm migration documented in source as a Phase 4 task has not yet eliminated. To avoid drowning the Phase 3 CSP soak in known-benign violations, the Phase-3-only Report-Only CSP carries:

- `script-src` adds `https://cdn.jsdelivr.net` (Chart.js 4.4.1 UMD CDN)
- `style-src` adds `https://fonts.googleapis.com` (Google Fonts CSS)
- `font-src` adds `https://fonts.gstatic.com` (Google Fonts woff2 binaries)
- `connect-src` adds `https://securetoken.google.com` (Firebase Auth refresh-token endpoint not covered by `*.googleapis.com` wildcard)

Cleanup ledger: revisit in Phase 4 cleanup ledger row "CSP CDN allowlist" — Phase 4 self-hosts Chart.js + Google Fonts via the npm bundler, after which these three additions are deleted from `firebase.json`. Phase 10 (HOST-07) verifies they are gone before flipping CSP to enforced mode.

**Evidence:**

- Policy configuration: `firebase.json` `hosting.headers[0]` (source: `**`) — header keys `Reporting-Endpoints` + `Content-Security-Policy-Report-Only` — Phase 3 Plan 02 commit `e7a3e06`
- Report sink: `functions/src/csp/cspReportSink.ts` (Phase 3 Plan 03)
- Filter and dedup: `functions/src/csp/{filter,dedup,normalise}.ts` (Phase 3 Plan 03)
- Schema validation: `tests/firebase-config.test.js` asserts dual-reporting tokens are present (T-3-1 + T-3-2 mitigation) — Phase 3 Plan 02 commit `03f4c07`
- Soak window: starts on Phase 3 cutover; ends when Phase 10 enforces (CSP enforcement lives at HOST-07)
- Note: The `csp-violations` endpoint is the **only** unauthenticated public Cloud Function in the milestone; every other callable enforces App Check + claims-based auth from Phase 7 onward. Browsers POST CSP reports natively without App Check tokens, so D-12 limits abuse protection to content-type allowlist + 64 KB body cap.

**Framework citations:**

- OWASP ASVS L2 v5.0 V14.4 — HTTP Security Headers
- ISO/IEC 27001:2022 A.13.1 — Network security management
- SOC 2 CC6.6 — Logical access security boundaries
- GDPR Art. 32(1)(b) — Confidentiality of processing systems and services

---

## § Hosting & Deployment

**Control:** Production at `https://baselayers.bedeveloped.com` is served by Firebase Hosting from the build artefact `dist/` produced by Vite. The `cspReportSink` 2nd-generation Cloud Function is deployed alongside hosting in `europe-west2`. Continuous deployment is wired through `.github/workflows/ci.yml` jobs `deploy` (push to `main`) and `preview` (per `pull_request`); both authenticate to GCP via Workload Identity Federation (no long-lived service account JSON keys in GitHub Secrets — OIDC-only trust binding scoped to this exact repo per `runbooks/firebase-oidc-bootstrap.md`). The `deploy` job ends with a `curl -I` assertion that fails the run if any of HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, COEP, CORP, Reporting-Endpoints, or Content-Security-Policy-Report-Only is missing from the live response — a deployment-time control that prevents silent header drop (T-3-1) at the CDN edge layer (the schema test in `tests/firebase-config.test.js` catches config-time regressions; this assertion catches runtime/CDN regressions). PR preview channels are deployed via `FirebaseExtended/action-hosting-deploy` to channel `pr-<number>` with a 7-day auto-expiry, so abandoned channels self-purge (T-3-pr-channel-leak). The deploy job runs under a concurrency group `firebase-deploy-main` with `cancel-in-progress: false` so two simultaneous pushes to main do not interleave deploys (T-3-deploy-collision). The functions/ workspace is built (`cd functions && npm ci && npm run build`) before every `firebase deploy`, mitigating Pitfall 5 / T-3-functions-mod-not-found whereby `firebase-tools` would otherwise upload stale or absent compiled JS. The GitHub Pages serving substrate is retained dormant for 14 days post-cutover as a documented rollback path (5-minute re-enable + DNS revert); deletion of the `gh-pages` branch + Pages workflow is tracked in `runbooks/phase-4-cleanup-ledger.md`. Branch protection rules adding `deploy` and `preview` to required status checks are deferred to a follow-up runbook commit (Phase 3 Plan 06) — added AFTER the first green deploy run registers the check names in GitHub's check registry, mirroring the Pitfall A pattern from Phase 1 D-12.

**Evidence:**

- CI deploy job: `.github/workflows/ci.yml` job `deploy` (Phase 3 Plan 04 commit `49afecb` — push to main, OIDC, post-deploy 9-header curl assertion)
- CI preview job: `.github/workflows/ci.yml` job `preview` (Phase 3 Plan 04 commit `49afecb` — pull_request, channel `pr-<number>`, 7d expiry)
- OIDC bootstrap runbook: `runbooks/firebase-oidc-bootstrap.md` (Phase 1 D-23) — Workload Identity Pool `github-actions`, provider `github-oidc`, service account `github-actions-deploy@bedeveloped-base-layers.iam.gserviceaccount.com`
- SHA-pinned auth action: `google-github-actions/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093` (v3) — verified against GitHub API 2026-05-06
- SHA-pinned preview action: `FirebaseExtended/action-hosting-deploy@e2eda2e106cfa35cdbcf4ac9ddaf6c4756df2c8c` (v0.10.0)
- Post-deploy header assertion: `.github/workflows/ci.yml` `deploy` job step "Assert security headers (T-3-1 mitigation)" — fails the deploy if any of the 9 expected headers is absent
- Functions/ supply chain: `audit` job step "npm audit (functions/ prod deps, high severity)" — extends Phase 1 D-21 root-only `npm audit` to the standalone `functions/` workspace (Dependabot already monitors `/functions` per Phase 1 D-19)
- Concurrency control: `deploy` job `concurrency.group: firebase-deploy-main` with `cancel-in-progress: false`
- Cutover runbook: `runbooks/hosting-cutover.md` (Phase 3 Plan 05 — pre-cutover smoke + same-session CNAME flip + DNS revert procedure)
- Cleanup ledger: `runbooks/phase-4-cleanup-ledger.md` "Phase 3 GH-Pages rollback substrate" entry (Phase 3 Plan 06 — day-14 deletion)
- Header schema test: `tests/firebase-config.test.js` (Phase 3 Plan 02 — guards 9-header set + rewrite ordering at commit time)
- Standalone `functions/` workspace: root `package.json` has no `workspaces` key (Pitfall 2 mitigation — Firebase deploy invokes its own `npm ci` inside `functions/`)
- Branch-protection deferral: `runbooks/branch-protection-bootstrap.md` updated by Phase 3 Plan 06 AFTER the first green run, per Pitfall A pattern from Phase 1 D-12

**Framework citations:**

- OWASP ASVS L2 v5.0 V14.7 — Build & Deploy Pipeline (SHA-pinned actions, OIDC-only trust, post-deploy verification, no long-lived deploy credentials)
- ISO/IEC 27001:2022 A.5.7 — Threat intelligence (cloud services governance — short-lived federated credentials, repo-scoped trust binding)
- SOC 2 CC8.1 — Change management (CI gates every change through lint + typecheck + test + audit + build + deploy verification before reaching production)
- Workload Identity Federation — short-lived OAuth tokens minted via OIDC token-exchange (Google Cloud documentation: cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)

## § Phase 3 Audit Index

This is a one-stop pointer for an auditor walking Phase 3's controls. Each row maps a framework citation to (a) the SECURITY.md section that documents it, (b) the artefact that implements it, (c) the test / smoke / runbook step that verifies it, and (d) the commit SHA(s) that landed each control. Phase 11 (DOC-09) walks this index to populate `docs/CONTROL_MATRIX.md`; Phase 12 (`SECURITY_AUDIT_REPORT.md`) cross-references it for Pass / Partial / N/A entries.

| Framework | Citation | Phase 3 Section | Implemented in | Verified by | Commit SHA(s) |
|-----------|----------|-----------------|----------------|-------------|---------------|
| OWASP ASVS L2 v5.0 | V14.4 — HTTP Security Headers | § HTTP Security Headers | `firebase.json` `hosting.headers[0]` | `tests/firebase-config.test.js` (commit-time, T-3-1) + ci.yml `deploy` job "Assert security headers" step (deploy-time, T-3-1) + securityheaders.com manual smoke per `runbooks/hosting-cutover.md` Step 7 (cutover-time) | `e7a3e06` (firebase.json) + `03f4c07` (schema test) + `49afecb` (CI deploy assertion) |
| OWASP ASVS L2 v5.0 | V14.4 — Content Security Policy | § Content Security Policy (Report-Only) | `firebase.json` `Content-Security-Policy-Report-Only` header value + dual `Reporting-Endpoints` / `report-uri` / `report-to csp-endpoint` + `functions/src/csp/cspReportSink.ts` | `tests/firebase-config.test.js` (header presence + dual-reporting tokens, T-3-1 + T-3-2) + `functions/test/csp/*.test.ts` (filter/dedup/normalise unit tests) + `runbooks/hosting-cutover.md` ## Pre-cutover Smoke Checklist Smokes 1+2 (modern + legacy wire formats; Pitfall 3 rawBody fallback exercise) | `e7a3e06` (firebase.json CSP-RO) + `03f4c07` (schema test) |
| OWASP ASVS L2 v5.0 | V14.7 — Build & Deploy Pipeline | § Hosting & Deployment | `.github/workflows/ci.yml` `deploy` + `preview` jobs via OIDC WIF; SHA-pinned third-party actions; concurrency control | First-green-CI-run (PENDING-USER post-cutover) + post-deploy 9-header assertion + `runbooks/firebase-oidc-bootstrap.md` (Phase 1 D-23) | `49afecb` (CI deploy + preview jobs + functions/ npm audit step) |
| ISO/IEC 27001:2022 | A.13.1.3 — Segregation in networks (header-enforced same-origin boundary) | § HTTP Security Headers | `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: credentialless` + `Cross-Origin-Resource-Policy: same-origin` + `frame-ancestors 'none'` (CSP) | `tests/firebase-config.test.js` `it.each` over 9 header keys + post-deploy curl assertion | `e7a3e06` (firebase.json) + `03f4c07` (schema test) |
| ISO/IEC 27001:2022 | A.13.1 — Network security management | § Content Security Policy (Report-Only) | CSP-RO + dual reporting + same-origin `cspReportSink` Cloud Function in `europe-west2` | Synthetic smoke (`runbooks/hosting-cutover.md` Smokes 1+2) + Cloud Logging filter `jsonPayload.message="csp.violation"` + soak window through Phase 10 | `e7a3e06` (firebase.json CSP-RO) + Phase 3 Plan 03 commits (functions/ workspace) |
| ISO/IEC 27001:2022 | A.5.7 — Threat intelligence (cloud services governance) | § Hosting & Deployment | OIDC Workload Identity Federation (no long-lived JSON keys) + per-PR preview channels with 7d auto-expiry + repo-scoped trust binding | `runbooks/firebase-oidc-bootstrap.md` + `runbooks/hosting-cutover.md` ## Prerequisites OIDC checks | `49afecb` (CI deploy + preview via OIDC) |
| SOC 2 | CC6.6 — Logical access security boundaries | § HTTP Security Headers + § CSP (Report-Only) | Header set (HSTS / X-CTO / Referrer-Policy / Permissions-Policy / COOP / COEP / CORP) + CSP enforcement substrate (Report-Only -> Phase 10 enforced) | `tests/firebase-config.test.js` (commit-time) + post-deploy curl assertion (deploy-time) + securityheaders.com rating ≥ A (cutover-time, recorded as `securityheaders_rating` in `03-PREFLIGHT.md ## Cutover Log`) | `e7a3e06` + `03f4c07` + `49afecb` |
| SOC 2 | CC8.1 — Change management | § Hosting & Deployment | OIDC-authenticated CI deploy from `main` (gated on lint+typecheck+test+audit+build green) + per-PR preview channels + concurrency group `firebase-deploy-main` + 14-day GH-Pages rollback retention | `.github/workflows/ci.yml` (CI gates) + `runbooks/hosting-cutover.md` (cutover script + DNS revert procedure) + `runbooks/phase-4-cleanup-ledger.md` "Phase 3 GH-Pages rollback substrate" row (day-14 trigger) | `49afecb` (CI) + Phase 3 Plan 05 commits (cutover runbook + Cutover Log skeleton) + Phase 3 Plan 06 commits (cleanup ledger row + branch-protection runbook) |
| GDPR | Art. 32(1)(b) — Confidentiality of processing systems and services | § Content Security Policy (Report-Only) | CSP-RO + same-origin report sink (no cross-origin data leak channel for violation reports); functions filter + dedup limits log volume from extension noise | Synthetic smoke confirms reports stay same-origin (Smokes 1+2 in `runbooks/hosting-cutover.md`); SECURITY.md § CSP documents the un-authed-endpoint exemption rationale (D-12 — content-type allowlist + 64 KB body cap) | `e7a3e06` (firebase.json CSP-RO same-origin endpoint) + Phase 3 Plan 03 commits (filter + dedup) |

**Cross-phase plug-ins this index will feed:**

- **Phase 4** (modular split / CDN-to-npm migration) — removes the temporary CSP CDN allowlist (`cdn.jsdelivr.net`, `fonts.googleapis.com`, `fonts.gstatic.com`); the §CSP table row's "Implemented in" cell will lose the temporary additions. Phase 4 also lands `tests/index-html-meta-csp.test.js` (T-3-meta-csp-conflict mitigation per `runbooks/phase-4-cleanup-ledger.md` "Phase 3 — meta-CSP regression guard" row).
- **Phase 10** (CSP enforcement / HOST-06 / HOST-07) — drops `'unsafe-inline'` from `style-src`, submits HSTS preload to hstspreload.org, flips CSP from Report-Only to enforced; updates §HTTP Security Headers + §CSP citations in this index accordingly.
- **Phase 11** (Evidence Pack / DOC-09) — `docs/CONTROL_MATRIX.md` walks this index row-by-row; screenshot evidence under `docs/evidence/` (e.g. `docs/evidence/phase-3-securityheaders-rating.png` per `runbooks/hosting-cutover.md` Step 7).
- **Phase 12** (Audit Walkthrough) — `SECURITY_AUDIT_REPORT.md` Pass / Partial / N/A entries cite specific rows in this index by framework + citation.

**Forward-looking concerns recorded in `runbooks/phase-4-cleanup-ledger.md`:**

- T-3-4 mitigation: GH-Pages rollback substrate deleted on `cutover_date + 14 days` (PENDING-USER until cutover lands `cutover_date`). Row title: "Phase 3 GH-Pages rollback substrate".
- T-3-meta-csp-conflict mitigation: Phase 4 must add `tests/index-html-meta-csp.test.js` to prevent `<meta http-equiv="Content-Security-Policy">` from being silently re-introduced into `index.html`. Row title: "Phase 3 — meta-CSP regression guard".
- T-3-5 partial mitigation (deferred): `roles/firebase.admin` over-grant on the deploy SA accepted for Phase 3; Phase 7 (FN-04) narrows to per-function service accounts. Row title (added in Phase 3 Plan 04 SUMMARY hand-off): "Phase 3 OIDC SA over-grant".

**Index self-check:** if all three forward-looking rows above are still open in the cleanup ledger, this index is current. If T-3-4 + T-3-meta-csp-conflict rows are closed but the index has not been updated by a Phase 4 / Phase 10 / Phase 11 commit, the index needs a maintenance commit. Phase 10's planning explicitly lists "update SECURITY.md ## § Phase 3 Audit Index" as a task when CSP enforcement lands.

---

### § Threat Model — *TODO Phase 11*

Link target: `THREAT_MODEL.md` (created Phase 11 — STRIDE-style coverage
of auth bypass, tenant boundary, file upload abuse, denial-of-wallet,
supply-chain compromise, insider misuse).

---

## Compliance posture statement

This codebase aims for **credible, not certified** compliance with
SOC 2 Common Criteria 2017, ISO/IEC 27001:2022 Annex A, GDPR Article 32,
and OWASP ASVS 5.0 Level 2. Certification is a separate workstream
(see `.planning/PROJECT.md` "Out of Scope"). Each section above maps
controls to the specific framework citations they address; the canonical
mapping lives in `docs/CONTROL_MATRIX.md` (created Phase 11).
