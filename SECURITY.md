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



---

## § Data Handling

### Phase 4 Wave 4 — Client-side upload validation (CODE-09 / D-15 / D-16)

The documents view (today the IIFE-resident `renderDocuments` at app.js:3156-3349; Wave 5 re-homes the body into `src/views/documents.js`) calls `validateUpload(file)` from `src/ui/upload.js` BEFORE invoking the Firestore + Storage upload path. Validation enforces three layers:

1. **Size cap** — reject files where `file.size > 25 * 1024 * 1024` (25 MiB).
2. **MIME allowlist** — reject `file.type` not in `ALLOWED_MIME_TYPES` (PDF, JPEG, PNG, DOCX, XLSX, TXT).
3. **Magic-byte sniff** — read the first 32 bytes via `file.slice(0, 32).arrayBuffer()`, match a fixed signature table (`%PDF-` for PDF, `FF D8 FF` for JPEG, `89 50 4E 47 0D 0A 1A 0A` for PNG, `50 4B 03 04` for ZIP-container DOCX/XLSX disambiguated via declared `file.type`, no-magic + no-NUL for text/plain). Reject when sniffed MIME does not match declared `file.type` (defensive against MIME spoofing). Reject when the sniffer returns null (unrecognised content).

Filename sanitisation is enforced verbatim per CODE-09 specification: `String(name).replace(/[^\w.\- ]/g, "_").slice(0, 200)`. The validated `sanitisedName` is used for both the Storage path and the Firestore metadata `filename` field.

The `ALLOWED_MIME_TYPES` constant is exported from `src/ui/upload.js` so server-side enforcement (Phase 5 `storage.rules` + Phase 7 callable validation) can reference the same allowlist — single source of truth, multiple enforcement points (audit-narrative line: "client and server validate against the same canonical allowlist").

**Trust boundary clarification (D-15):** Client-side validation provides UX feedback and the audit-narrative client-side claim ("we validate at the browser before the network call"). It is NOT the security boundary. Server-side enforcement happens in:

- Phase 5 `storage.rules`: `request.resource.size < 25 * 1024 * 1024` + MIME allowlist + path scope `orgs/{orgId}/documents/{docId}/{filename}`
- Phase 7 callable validation: re-applies the same constraints with Zod schemas and idempotency markers

The `data/documents.saveDocument` wrapper (`src/data/documents.js` — Wave 3) does NOT re-validate; it trusts the contract from the view layer. The two trust-boundary stances are decoupled: client validates declared+actual MIME (via `ui/upload.js`); server enforces (Phase 5 `storage.rules` + Phase 7 callable). Phase 5 + Phase 7 are the actual trust boundaries.

Wave 4 also closes the layered defences supporting the strict-CSP enforcement Phase 10 (HOST-07) will land:

- **CODE-04** (Wave 2) deleted the `html:` escape hatch in `src/ui/dom.js` (XSS regression fixture pins the closure permanently).
- **CODE-05** (Waves 1-4) replaced all 17 `innerHTML = ""` clearing patterns with `replaceChildren()` — DOM-equivalent without touching the unsanitised-property surface ESLint guards.
- **CODE-06** (Wave 4 partial) replaced the 4 in-IIFE `el.style.X = ...` runtime mutations with class-based DOM manipulation (the harder CSP target). The 132 `style="..."` inline-attr strings in app.js IIFE remain — they are part of the Phase 2 D-08 snapshot baseline contract and sweep with body migration in Wave 5 per D-12 + Wave 3 Dev #1 precedent. CSP-tolerated under `style-src 'unsafe-inline'` until then.
- **CODE-07** (Wave 4) replaced 7 `alert()` sites with `notify("error"|"success", ...)` — eliminates browser-blocking modal confirmation dialogs (T-CSP-no-blocking-script-execution narrative anchor).
- **CODE-08** (Wave 4) deduplicated chat + funnel-comments rendering via `renderConversationBubble` in `src/views/_shared/render-conversation.js` (M8 closure).
- **CODE-10** (Wave 4) memoised the tab-title unread badge writer (`setTitleIfDifferent` in `src/views/chat.js`) — only writes `document.title` when value differs from previous write.
- **CODE-12** (Wave 4) added `rel="noopener noreferrer"` to download anchors paired with `target="_blank"` (CWE-1021 opener-phishing mitigation).

The Wave 4 ESLint hardening also flipped the `views/* → no firebase/*` boundary from warn to error (`eslint.config.js`); views/* may import `data/`, `domain/`, `auth/`, `ui/`, `cloud/` only — direct `firebase/firestore | firebase/storage | firebase/auth | firebase/app-check | firebase/functions` imports are blocked outside `src/firebase/**`. Combined with Waves 1+2+3 hardenings, all four ARCHITECTURE.md §2.4 boundaries are now lint-enforced (`firebase/*` SDK group → only `src/firebase/**`; `domain/*` → no `firebase/*`; `data/*` → only `src/firebase/db.js` + `src/firebase/storage.js`; `views/*` → no `firebase/*`). The audit-narrative anchor for T-4-3-1 (Tampering at the data → firebase boundary) is now lint-enforced end-to-end.

**Evidence:**

- Upload validation helper: `src/ui/upload.js` (Plan 04-02 Wave 2 — `validateUpload` / `ALLOWED_MIME_TYPES` / `MAX_BYTES` exports)
- IIFE upload site: `app.js:3201` (Plan 04-04 Wave 4) — `const validation = await validateUpload(file); if (!validation.ok) { notify("error", validation.reason); return; }` BEFORE `firestore.setDoc(...)` + Storage upload
- Wave 4 ESLint flip: `eslint.config.js` `src/views/**/*.js` block (Plan 04-04 Task 3)
- Cleanup-ledger row closures: `runbooks/phase-4-cleanup-ledger.md` Phase 2 timeline section (Plan 04-04 Wave 4 entries — CODE-05/07/08/09/10/12 closed; CODE-06 partial)
- Verification: `npm run test` exits 0 (370 tests green); `npm run typecheck` exits 0; `npm run lint` exits 0; `npm run build` exits 0; `git diff tests/__snapshots__/views/` is empty (D-12 byte-identical extraction holds)

**Framework citations:**

- OWASP ASVS L2 v5.0 V12.1 — File Uploads (size cap + MIME allowlist + magic-byte sniff cross-check)
- OWASP ASVS L2 v5.0 V5.3 — Output Encoding / XSS prevention (CODE-04 html: deletion + CODE-05 replaceChildren + CODE-06 inline-style sweep precondition)
- ISO/IEC 27001:2022 Annex A.8.24 — Use of cryptography (`crypto.randomUUID()` for doc IDs via `src/util/ids.js`)
- ISO/IEC 27001:2022 Annex A.5.34 — Privacy and PII protection (filename sanitisation prevents path-traversal + script-injection vectors)
- ISO/IEC 27001:2022 Annex A.8.28 — Secure coding (lint-enforced module boundaries, all four ARCHITECTURE.md §2.4 walls now hard)
- SOC 2 CC6.1 — Logical access (boundary enforcement at the lint layer mirrors the trust-boundary policy; views/* cannot reach firebase/* directly)
- SOC 2 CC8.1 — Change management (atomic commits per requirement; Wave 4 lands all 8 CODE-* closures + ESLint flip + SECURITY.md update across the wave's commits)
- GDPR Art. 32(1)(b) — Confidentiality of processing (upload validation is a confidentiality control — prevents malicious-content uploads from reaching Storage; XSS prevention is a confidentiality control because successful XSS leaks session tokens / form data; CWE-1021 noopener-noreferrer prevents opener-tab phishing)


---

## § Code Quality + Module Boundaries

### Phase 4 Wave 6 — Modular split + lint-enforced module boundaries (CODE-01 + CODE-02)

Phase 4 decomposed the prior 5,289-line `app.js` IIFE into a per-feature ES module layout per `.planning/research/ARCHITECTURE.md` §2:

- `src/firebase/*` — sole import surface for the Firebase SDK (`@firebase/app|auth|firestore|storage|functions|app-check`)
- `src/data/*` — 12 per-collection wrappers (6 owners + 6 Phase-5-rewrite-target pass-throughs); accesses SDK only through `src/firebase/db.js` + `src/firebase/storage.js`
- `src/domain/*` — pure logic with zero Firebase imports
- `src/auth/*` — session-layer logic on top of `src/firebase/auth.js` (Phase 6 replaces with real Email/Password + custom claims; current state is the local-allowlist substrate)
- `src/cloud/*` — empty stub seams Phase 6/7/8 fill (callable Cloud Functions clients)
- `src/views/*` — 12 per-route render functions; may import data/domain/auth/ui/cloud — never `firebase/*` directly
- `src/ui/*` — DOM helpers (dom/modal/toast/format/chrome/charts/upload); pure DOM, no business logic
- `src/observability/*` — empty stub seams Phase 7/9 fill (Sentry init + audit-event constants + emit)
- `src/state.js` + `src/router.js` + `src/main.js` — boot infrastructure; `src/main.js` imports `src/firebase/app.js` as its FIRST functional import to guarantee `initializeApp` + `initAppCheck` run before any data/* or views/* code touches the SDK

These boundaries are lint-enforced via ESLint `no-restricted-imports` rules in `eslint.config.js` (Wave 1-4 hardening at error level; Wave 6 verified zero `"warn"` strings remain on no-restricted-imports rules):

- `**/*.js` (excluding `src/firebase/**`) cannot import `firebase/firestore | firebase/storage | firebase/auth | firebase/app-check | firebase/functions` directly (Wave 1)
- `src/domain/**` cannot import any `firebase/*` path (Wave 2)
- `src/data/**` cannot import `firebase/*` directly outside the adapter (Wave 3)
- `src/views/**` cannot import `firebase/*` directly (Wave 4)

Wave 6 also added `no-restricted-globals` blocking bare-global `FB` references (the IIFE-era bridge pattern Wave 5 retired from `index.html`'s standalone bridge tags). The rule is dormant-but-active at Wave 6 close because `src/main.js` consumes `window.FB.X` (member access on `window`) which does NOT trigger the bare-global rule. The bare-`Chart` global guard is deferred to the main.js-body-migration carryover sub-wave because `src/main.js` IIFE-resident render functions consume `Chart` as a bare global at two sites; enforcing now would break the boot path. Tracked in `runbooks/phase-4-cleanup-ledger.md` "Wave 6 → main.js-body-migration carryover" section.

Per-directory coverage thresholds are tiered per `vite.config.js` (D-21):

- `src/domain/**` and `src/util/**` and `src/ui/**`: 100%
- `src/auth/**` and `src/data/**`: 95% (data/** raised from 90 in Wave 6 — gates regressions during Phase 5's pass-through → owned rewrite)
- `src/views/**`: 80%
- `src/state.js`, `src/router.js`, `src/main.js`: 90%
- `src/firebase/**`, `src/cloud/**`, `src/observability/**`: EXCLUDED (adapter exercised through data/* tests; cloud + observability stubs filled in Phase 7/8/9)

Quick wins folded across Waves 1-6 close the corresponding CONCERNS.md findings:

- CODE-03 (Math.random → crypto.randomUUID) — closes H5; ESLint security/detect-pseudoRandomBytes blocks reintroduction (Wave 1)
- CODE-04 (delete `html:` branch in `h()` + permanent XSS regression test) — closes C4; ESLint no-unsanitized blocks reintroduction (Wave 2)
- CODE-05 (17 innerHTML="" → replaceChildren) — closes M2 (Waves 1-4 + Wave 6 forward-tracked modal.js closure)
- CODE-06 partial (4 in-IIFE el.style.X mutations + 1 inline-style block) — closes the harder CSP target; the 132 static `style="..."` inline-attr strings sweep atomically with the Wave 5 IIFE body migration in a follow-up sub-wave (Phase 10 HOST-07 single-knob flip pending)
- CODE-07 (alert → toast notify) — closes M3 (Wave 4)
- CODE-08 (renderConversation shared helper) — closes M8 chat/funnel duplication (Wave 4)
- CODE-09 (client-side upload validation) — closes H6 client-side; trust boundary at Phase 5 storage.rules + Phase 7 callable (Wave 4)
- CODE-10 (tab-title unread badge memoisation) — closes M9 (Wave 4)
- CODE-11 (formatWhen Math.floor for monotonic-decreasing labels) — closes L4 (Wave 6)
- CODE-12 (rel="noopener noreferrer" on download links) — closes L3 / CWE-1021 (Wave 4)
- CODE-13 (dead v1-migration code removal — gated on pre-deletion verification of v2-active early-return guard + the absence of live v1 data per PROJECT.md "no backwards-compat window") — closes L2 (Wave 6)

The CSP allowlist tightening (Wave 1 — `cdn.jsdelivr.net`, `fonts.googleapis.com`, `fonts.gstatic.com` dropped via Chart.js npm import + Google Fonts self-host) shrinks Phase 10's strict-CSP enforcement work to a single-knob flip (drop `'unsafe-inline'` from `style-src`).

**Phase 4 cleanup-ledger Suppressions table — D-17 phase-close gate posture:** the in-Phase-4-tracker rows reach zero (every original Phase 1 row closed via extraction or file deletion). The 12 rotated `src/main.js:N` rows + the `window.FB`/`window.Chart` bridges + the 132 inline-style strings + the unmet coverage thresholds are documented as **persistent-with-rationale** under the Wave 6 → main.js-body-migration carryover section (D-17 escape hatch: "if a suppression was actually still needed — document under Persistent suppressions with rationale, and reflect in `SECURITY.md` so the audit narrative is honest"). The carryover items close atomically when IIFE bodies migrate from `src/main.js` into the 12 `src/views/*.js` Pattern D DI factory stubs — a sub-wave deliberately deferred from Wave 6 to keep the human-verify checkpoint contract small and avoid the same Phase-2 D-08 snapshot-baseline jeopardy that gated Wave 4 Dev #1 + Wave 5 Dev #1.

The forward-tracking section in the cleanup-ledger retains rows for Phase 5 (D-09 pass-through bodies → subcollection rewrites), Phase 6 (AUTH-14 deletes `src/auth/state-machine.js` + `INTERNAL_PASSWORD_HASH`; AUTH-07 fills `src/cloud/claims-admin.js`), Phase 7 (FN-04 fills `src/firebase/check.js` + `src/cloud/audit.js` + `src/cloud/retry.js` + `src/observability/audit-events.js` constants), Phase 8 (LIFE-04/GDPR-01 fills `src/cloud/soft-delete.js` + `src/cloud/gdpr.js`), and Phase 9 (OBS-01 fills `src/observability/sentry.js`; AUDIT-05 wires `emitAuditEvent` in views/*) — these are the audit-narrative substrate, not leftover suppressions.

**Citations:** OWASP ASVS L2 v5.0 — V14.2 (Dependencies — npm migration), V14.7 (Build & Deploy — lint-enforced boundaries), V5.3 (Output Encoding / XSS prevention — CODE-04 layered with CODE-05/06); ISO/IEC 27001:2022 Annex A — A.8.28 (Secure coding — modular boundary enforcement), A.8.24 (Use of cryptography — CSPRNG via CODE-03); SOC 2 — CC8.1 (Change management — atomic per-requirement commits), CC6.1 (Logical access — boundary enforcement via lint); GDPR Art. 32(1)(b) (Confidentiality of processing — XSS + upload validation), Art. 32(1)(d) (Testing/evaluating effectiveness — coverage thresholds + permanent regression tests).

**Evidence:**

- Module layout: `src/firebase/`, `src/data/`, `src/domain/`, `src/auth/`, `src/cloud/`, `src/views/`, `src/ui/`, `src/observability/`, `src/state.js`, `src/router.js`, `src/main.js`
- ESLint boundary rules: `eslint.config.js` (Wave 1-4 no-restricted-imports at error + Wave 6 no-restricted-globals on bare FB)
- Coverage thresholds: `vite.config.js` `test.coverage.thresholds` (D-21 extended in Wave 6)
- CODE-* closures: `runbooks/phase-4-cleanup-ledger.md` "Phase 2 — extracted leaf modules" section (timeline)
- Wave 6 → main.js-body-migration carryover documentation: `runbooks/phase-4-cleanup-ledger.md` "Wave 6 → main.js-body-migration carryover" section
- Wave-level summaries: `.planning/phases/04-modular-split-quick-wins/04-01-SUMMARY.md` through `04-06-SUMMARY.md`

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

## § Firestore Data Model

**Control:** Production Firestore data lives under the subcollection-based shape specified in `.planning/research/ARCHITECTURE.md` §4 — `orgs/{orgId}/responses/{respId}`, `orgs/{orgId}/comments/{cmtId}`, `orgs/{orgId}/actions/{actId}`, `orgs/{orgId}/documents/{docId}`, `orgs/{orgId}/messages/{msgId}`, `orgs/{orgId}/readStates/{userId}` — replacing the prior monolithic nested-map shape (`orgs/{orgId}.responses[roundId][userId][pillarId][idx]` etc.) that was approaching the 1 MiB doc-size cliff and exhibited last-writer-wins entanglement (CONCERNS H8).

The migration was executed via a one-shot Node script (`scripts/migrate-subcollections/run.js`) using the firebase-admin SDK from an internal operator workstation. The script supports a `--dry-run` flag whose output (`scripts/migrate-subcollections/dry-run-output.log`) is committed as audit evidence. Per-doc idempotency markers under `migrations/{stepId}/items/{docId}` make the script re-runnable — DONE markers skip; PENDING markers re-process partial-runs.

**Audit-narrative line (D-05 staging deviation):** Migration is idempotent (per-doc markers) and bracketed by a manual `gcloud firestore export` taken immediately before the run.
Rules unit-tested against the local emulator before the script runs.
**Rollback procedure:** `gcloud firestore import` of that export — the pre-migration export bucket URI is the rollback substrate.
This deviates from `.planning/research/PITFALLS.md` Pitfall 1's "use a staging Firebase project" recommendation explicitly. Justification: the project was between client engagements with no live writes; the per-doc markers + pre-migration export + emulator rules tests provide equivalent safety with substantially lower operational cost than a permanent staging project (duplicate IAM, OIDC pool, App Check site keys, billing).

**Cutover outcome (2026-05-08):** The cutover was executed on 2026-05-08 at ~17:10 UTC by the project Owner (`business@bedeveloped.com`) against `bedeveloped-base-layers`. Outcome: success — but a **no-op** because the production database was empty at the time (project baseline per `.planning/PROJECT.md`: "between client engagements"). The audit value of this cutover is therefore in the **discipline of the export → dry-run → real-run → verify chain**, not in transformed data. The same migration script will correctly walk real client data once it exists post-Phase-6. The pre-migration export at `gs://bedeveloped-base-layers-backups/pre-phase5-migration/2026-05-08T17-10-06Z/` (operation `projects/bedeveloped-base-layers/databases/(default)/operations/ASAzZjU4MjJkMjRjMTUtYTE5OS1lOTc0LTU1MWYtZTNlMjQ4OTUkGnNlbmlsZXBpcAkKMxI`) is retained as the rollback substrate and as the change-management evidence artefact.

**Stray-data cleanup deviation:** The post-migration `assertFieldPresence` initially failed because 3 stray `messages/{id}` and 3 stray `documents/{id}` root-collection docs predating the Phase 4 modular split lacked the D-03 inline legacy fields. They were investigated via `scripts/migrate-subcollections/find-strays.js`, confirmed to be v0 test fixtures with the wrong shape (`text` field instead of `body`), and deleted via `scripts/migrate-subcollections/delete-strays.js`. Both scripts are committed as audit evidence in commit `663927f`. The deletion is documented as a Wave 5 in-flight scope deviation in `05-PREFLIGHT.md` §notes.

The CONCERNS.md H7 (clock skew on unread tracking) and H8 (last-writer-wins cloud sync) were folded into Phase 5 Wave 4 as **two atomic commits** per `.planning/research/PITFALLS.md` §Pitfall 20 (the bundled-fix risk): Commit A rewrote `src/domain/unread.js` to read server-time Timestamp values via duck-typed `toMillis()` (DATA-07); Commit B rewrote `src/data/cloud-sync.js` to remove the parent-doc syncer entirely + delegate per-subcollection listening to wrappers.

**Evidence:**

- Subcollection layout: `.planning/research/ARCHITECTURE.md` §4
- Migration script: `scripts/migrate-subcollections/run.js` (Wave 2 — commits `f8b7e9b` + `fd7cc7d`)
- Idempotency marker pattern: `scripts/migrate-subcollections/process-doc.js` (D-02 / Pitfall 10 — Wave 2 commit `fd7cc7d`)
- Pre/post assertion harness: `scripts/migrate-subcollections/assertions.js` (DATA-06 — Wave 2 commit `f8b7e9b`)
- Pre-migration export procedure: `runbooks/phase5-subcollection-migration.md` §3.1 (D-04 — Wave 5 commit `130a501`)
- Migration runbook: `runbooks/phase5-subcollection-migration.md` (Wave 5 commit `130a501`)
- Operator cutover log: `.planning/phases/05-firestore-data-model-migration-rules-authoring-committed-not-deployed/05-PREFLIGHT.md` (Wave 5 skeleton `130a501` + cutover-day fill `7969f21`)
- Cutover evidence (logs + stray cleanup): commit `663927f` — `dry-run-output.log` + `real-run-output.log` + `find-strays.js` + `delete-strays.js`
- Pre-migration export bucket URI: `gs://bedeveloped-base-layers-backups/pre-phase5-migration/2026-05-08T17-10-06Z/`
- `data/responses,comments,actions,documents,messages,read-states.js` body rewrites (Wave 3 — commits `a6d7f2f` + `817a2ed` + `c17d0d0` + `fd44c78` + `2056e9e` + `485c1c2`)
- H7 fix commit: `feat(05-04): H7 fix - server-clock readStates comparator + setPillarRead rewire (DATA-07)` — `d81cb50`
- H8 fix commit: `feat(05-04): H8 fix - per-subcollection listeners replace parent-doc sync (D-13)` — `3145ebc`

**Framework citations:**

- OWASP ASVS L2 V4.1.5 — data-model authorisation aligned with rules engine
- ISO/IEC 27001:2022 A.8.10 — information deletion (the legacy nested-map fields stay during Phase 5 as the rollback substrate; a Phase 6+ cleanup wave deletes them)
- SOC 2 CC6.1 — logical access (subcollection-scoped match blocks make access decisions explicit per resource)
- GDPR Art. 32(1)(b) — ongoing confidentiality + integrity (subcollection migration enables per-resource access controls without 1 MiB doc-size cliff)

---

## § Firestore Security Rules — Authored, Not Yet Deployed

**Control:** `firestore.rules` and `storage.rules` are committed at the repo root. They are **NOT** deployed to production in Phase 5 (`firebase deploy --only firestore:rules` is not invoked anywhere in this phase). Sequencing Non-Negotiable #2: rules deploy in lockstep with the Phase 6 Auth migration when Email/Password sign-in + custom claims + MFA all go live; per `.planning/research/PITFALLS.md` §Pitfall 1, deploying tightened rules before claims-issuing Auth is a production lockout pattern. **The rules deploy gate is held for Phase 6 (RULES-07).**

The rules predicate library (D-14) reads top-to-bottom as English: a reviewer can trace each `allow` rule back to a named helper (`isAuthed()`, `role()`, `orgId()`, `isInternal()`, `isAdmin()`, `inOrg(o)`, `notDeleted(r)`, `isOwnAuthor(r)`, `immutable(field)`, `mutableOnly(fields)`) declared once at the top of the file. `isAuthed()` includes both `email_verified == true` AND `sign_in_provider != "anonymous"` per `.planning/research/PITFALLS.md` §Pitfall 2 (anonymous tokens trivially satisfy `request.auth != null`).

Every `allow update` path uses `mutableOnly([...])` field whitelist + `immutable("orgId")` / `immutable("createdAt")` per D-15 (Pitfall 3 closure). Mass-assignment attacks (a client adding `role: "admin"` to its own user doc) deny by virtue of the whitelist.

The collection scope per D-17:

- `orgs/{orgId}` parent doc (read: `inOrg(orgId) && notDeleted`; create/update: `isInternal`; delete: `false`)
- 6 subcollections under `orgs/{orgId}` — `responses`, `comments`, `actions`, `documents`, `messages`, `readStates`
- `users/{uid}`, `internalAllowlist/{email}`
- `auditLog/{eventId}`, `softDeleted/{type}/items/{id}`, `rateLimits/{uid}/buckets/{windowStart}` — server-only (clients cannot write; Phase 7 fills the writers + replaces `rateLimits` deny-block with a `request.time` predicate)
- `roadmaps/{orgId}`, `funnels/{orgId}`, `funnelComments/{id}` (top-level per ARCHITECTURE.md §4 table)

The audit log rules (`auditLog/{eventId}: allow read: if isAdmin(); allow write: if false`) explicitly prevent the audited user from reading their own audit records (per `.planning/research/PITFALLS.md` §Pitfall 17 / AUDIT-07).

A table-driven `@firebase/rules-unit-testing` v5 matrix at `tests/rules/firestore.test.js` iterates 5 roles (anonymous / client_orgA / client_orgB / internal / admin) × 16 collection paths × 4 ops (read / create / update / delete) with explicit allow/deny expectations per cell. Cross-cutting suites: `tests/rules/tenant-jump.test.js` (every collection enumerated under a tenant-jump scenario per RULES-04), `tests/rules/soft-delete-predicate.test.js`, `tests/rules/server-only-deny-all.test.js`. The CI `test-rules` job boots Firestore + Storage emulators via `firebase emulators:exec` and runs the matrix on every PR (TEST-08). Last verified green at 176/176 in commit `4fe36b9`.

**Phase 5 RULES-06 verification gate (Wave 6):** `git log --grep="firebase deploy --only firestore:rules" 5276d9d..HEAD` (where `5276d9d` is the Phase 4 close commit) matches a single commit `4fe36b9` whose body is the Wave 1 atomic commit explicitly DOCUMENTING the absence of the deploy command (`"RULES-06: rules COMMITTED, NOT DEPLOYED — no firebase deploy --only firestore:rules invocation anywhere"`). The match is therefore a documented false positive. `git grep "firebase deploy --only firestore:rules" -- '*.yml' '*.yaml' '*.json' '*.js' '*.sh' '*.ts'` (enforcement file types) returns empty. The gate **PASSES**.

**Evidence:**

- Rules file: `firestore.rules` (Wave 1 — commit `4fe36b9`)
- Storage rules: `storage.rules` (Wave 1 — commit `4fe36b9`)
- firebase.json declarations: `firebase.json` `firestore.rules` + `storage.rules` paths declared (Wave 1 — commit `4fe36b9`)
- Predicate library: `firestore.rules` lines 5–27 (D-14 — commit `4fe36b9`)
- Mutation whitelist enforcement: every `allow update` path in `firestore.rules`
- Test matrix: `tests/rules/firestore.test.js` (Wave 1 — commit `4fe36b9`)
- Cross-cutting test suites: `tests/rules/tenant-jump.test.js`, `tests/rules/soft-delete-predicate.test.js`, `tests/rules/server-only-deny-all.test.js` (Wave 1 — commit `4fe36b9`)
- Test exemption + cleanup: `fix(05-01): exempt tests/rules/** from no-restricted-imports + drop unused vars` — commit `6e85e1c`; `fix(05-01): exclude tests/rules/** from default vitest run` — commit `345cf5d`
- CI test-rules job: `.github/workflows/ci.yml` `test-rules` job (Wave 1 — commit `4fe36b9`)
- Phase 5 RULES-06 verification gate (Wave 6 — this section): `git log --grep="firebase deploy --only firestore:rules" 5276d9d..HEAD` returns only the Wave 1 false-positive; `git grep` over enforcement file types returns empty
- RULES-07 deploy gate held for Phase 6 — tracked in `runbooks/phase-5-cleanup-ledger.md` forward-tracking row

**Framework citations:**

- OWASP ASVS L2 V4.1 — general access control; V4.2 — operation-level access control; V4.3 — other access control considerations
- ISO/IEC 27001:2022 A.5.15 — access control; A.5.18 — access rights; A.8.3 — information access restriction
- SOC 2 CC6.1 — logical access; CC6.2 — new/modified access; CC6.3 — access modification
- GDPR Art. 32(1)(b) — ongoing confidentiality; Art. 32(2) — level of security appropriate to risk

---

## § Storage Rules

**Control:** `storage.rules` enforces three constraints on uploads to `orgs/{orgId}/documents/{docId}/{filename}`:

1. **Size cap:** `request.resource.size <= 25 * 1024 * 1024` (25 MiB) — matches `src/ui/upload.js` `MAX_BYTES` exactly. Closes CONCERNS.md H6 server-side (the client-side sanitisation in Phase 4 was the UX-feedback layer; the storage rule is the trust boundary).
2. **MIME allowlist:** `request.resource.contentType.matches('application/pdf|image/jpeg|...')` — mirrors the canonical `ALLOWED_MIME_TYPES` constant exported from `src/ui/upload.js`. The client-side magic-byte sniff (Phase 4 `validateUpload`) cross-checks the declared content-type against the actual file header; the storage rule enforces the declared type at upload time.
3. **Path scope:** the `match /orgs/{orgId}/documents/{docId}/{filename}` block constrains writes to the documented prefix; a global `match /{allPaths=**} { allow read, write: if false }` denies everything else (defense in depth).

The MIME allowlist is deliberately duplicated between `src/ui/upload.js` and `storage.rules` because the rules language does not support `import`. A cleanup-ledger row tracks drift if `ui/upload.js`'s allowlist ever changes — any modification must sync `storage.rules` in the same commit.

**Evidence:**

- Storage rules: `storage.rules` (Wave 1 — commit `4fe36b9`)
- Single source of truth: `src/ui/upload.js` `ALLOWED_MIME_TYPES` + `MAX_BYTES` (Phase 4 D-15/D-16)
- Cleanup-ledger drift tracker: `runbooks/phase-5-cleanup-ledger.md` (this Wave 6)
- Storage matrix tests: `tests/rules/storage.test.js` (Wave 1 — commit `4fe36b9`)
- Closure of CONCERNS.md H6: client-side validation (Phase 4 CODE-09) + server-side rule (Phase 5 RULES-05)

**Framework citations:**

- OWASP ASVS L2 V12.1 — file upload; V13.1 — web service security
- ISO/IEC 27001:2022 A.8.24 — use of cryptography (covers content-type integrity); A.8.7 — protection against malware (MIME allowlist limits attack surface)
- SOC 2 CC6.7 — boundary protection
- GDPR Art. 32(1)(b) — integrity

---

## § Phase 5 Audit Index

This is a one-stop pointer for an auditor walking Phase 5's controls. Each row maps a Phase 5 control to (a) the SECURITY.md section + decision that defines it, (b) the code path that implements it, (c) the test that verifies it, and (d) the framework citations it addresses. Mirrors the Phase 3 Audit Index pattern; Phase 11 (DOC-09) walks both indexes to populate `docs/CONTROL_MATRIX.md`.

| Audit row | Control | Code path | Test | Framework |
|-----------|---------|-----------|------|-----------|
| Subcollection data model | DATA-01..04 | `src/data/{responses,comments,actions,documents,messages,read-states}.js` | `tests/data/*.test.js` | ASVS V4.1.5 / ISO A.8.10 / SOC2 CC6.1 / GDPR Art 32(1)(b) |
| Migration script (one-shot) | DATA-04 / D-01 | `scripts/migrate-subcollections/run.js` | `tests/scripts/migrate-subcollections/*.test.js` | ASVS V14.5.1 (deployment) / SOC2 CC8.1 |
| Idempotency markers | DATA-05 / D-02 / Pitfall 10 | `scripts/migrate-subcollections/process-doc.js` | `tests/scripts/migrate-subcollections/idempotency.test.js` | SOC2 CC7.4 (system operations — resilience) |
| Pre/post assertion harness | DATA-06 | `scripts/migrate-subcollections/assertions.js` | `tests/scripts/migrate-subcollections/assertions.test.js` | SOC2 CC7.4 |
| Inline legacy fields | DATA-02 / D-03 / Pitfall 5 | `scripts/migrate-subcollections/builders.js` (`legacyAppUserId` / `legacyAuthorId`) | `tests/scripts/migrate-subcollections/builders.test.js` | (substrate for Phase 6 AUTH-15 backfill) |
| H7 server-clock comparator | DATA-07 | `src/domain/unread.js` | `tests/domain/unread.test.js` (5-min skew test, ROADMAP SC#4) | ASVS V8.3.1 / GDPR Art 32(1)(b) |
| H8 per-subcollection listeners | (D-13) | `src/data/cloud-sync.js` | `tests/data/cloud-sync.test.js` | SOC2 CC7.2 (system operations — data integrity) |
| Helper-rich predicate library | RULES-01 / D-14 / Pitfall 2 | `firestore.rules` lines 5–27 | `tests/rules/firestore.test.js` | ASVS V4.1.1 (claims-based access control) |
| Mutation whitelist | RULES-02 / D-15 / Pitfall 3 | `firestore.rules` every `allow update` | `tests/rules/firestore.test.js` (mass-assignment cells) | ASVS V4.2.1 / SOC2 CC6.1 |
| Server-only collections | RULES-03 / D-17 | `firestore.rules` `auditLog`/`softDeleted`/`rateLimits` blocks | `tests/rules/server-only-deny-all.test.js` | ASVS V13.1.5 / Pitfall 17 |
| Tenant isolation | RULES-04 | `firestore.rules` `inOrg(orgId)` predicate | `tests/rules/tenant-jump.test.js` | ASVS V4.3.2 / SOC2 CC6.1 |
| Storage size + MIME + path | RULES-05 | `storage.rules` | `tests/rules/storage.test.js` | ASVS V12.1 / ISO A.8.7 / GDPR Art 32(1)(b) |
| Rules deploy gate held | RULES-06 / Pitfall 1 | (no `firebase deploy --only firestore:rules` invocation in any enforcement file across the phase) | `git log --grep="firebase deploy --only firestore:rules" 5276d9d..HEAD` returns only documented false positive (commit `4fe36b9` body) | (audit-narrative integrity) |
| AUDIT-07 audited user cannot read | RULES-03 / Pitfall 17 | `firestore.rules` `auditLog` `allow read: if isAdmin()` | `tests/rules/server-only-deny-all.test.js` | ASVS V13.1.5 |
| Migration runbook + rollback | (procedural) | `runbooks/phase5-subcollection-migration.md` | (operator-execution + `05-PREFLIGHT.md` Cutover Log: `cutover_outcome: success`) | SOC2 CC9.1 (risk mitigation) / ISO A.5.30 (ICT readiness for business continuity) |

Each row's evidence + test path is a direct verification of the control. A reviewer reading this index plus the `firestore.rules` and `storage.rules` files plus the `tests/rules/` matrix output answers the "how do you secure data at rest + access?" portion of a vendor questionnaire without referencing additional documentation.

**Cross-phase plug-ins this index will feed:**

- **Phase 6** (RULES-07 + AUTH-15) — flips the "Rules deploy gate held" row from "(no invocation)" to "(deployed via `firebase deploy --only firestore:rules` in lockstep with Auth + claims cutover)"; AUTH-15 backfills `legacyAppUserId → firebaseUid` mapping using the inline legacy fields preserved in Phase 5.
- **Phase 7** (FN-01..09) — flips `auditLog`/`softDeleted` server-only deny-blocks to active server-side writers; replaces `rateLimits/{uid}/buckets/{windowStart}` deny-block body with `request.time` predicate (FN-09).
- **Phase 8** (BACKUP-01..07) — establishes daily-export rotation; deletes the Phase 5 pre-migration export bucket (`gs://bedeveloped-base-layers-backups/pre-phase5-migration/2026-05-08T17-10-06Z/`) once retention policy supersedes the one-off snapshot.
- **Phase 11** (DOC-09 / Evidence Pack) — `docs/CONTROL_MATRIX.md` walks this index row-by-row.

---

## Compliance posture statement

This codebase aims for **credible, not certified** compliance with
SOC 2 Common Criteria 2017, ISO/IEC 27001:2022 Annex A, GDPR Article 32,
and OWASP ASVS 5.0 Level 2. Certification is a separate workstream
(see `.planning/PROJECT.md` "Out of Scope"). Each section above maps
controls to the specific framework citations they address; the canonical
mapping lives in `docs/CONTROL_MATRIX.md` (created Phase 11).
