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

### § CSP & Headers — *TODO Phases 3 & 10*

Will document: Phase 3 baseline (HSTS, X-CTO, Referrer-Policy,
Permissions-Policy, COOP, COEP, CSP Report-Only). Phase 10 enforced CSP
(no `unsafe-inline`), HSTS preload submission.

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
