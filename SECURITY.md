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

## § Authentication & Sessions

Phase 6 Wave 5 cutover replaced the Anonymous-Auth-plus-hardcoded-password substrate with real Firebase Auth Email/Password identities. Every production user now signs in with email + password; ID tokens carry custom claims `{role, orgId}` set by the `beforeUserCreated` blocking Cloud Function (commit SHA recorded in 06-PREFLIGHT.md `## Cutover Log: rules_deploy_sha`).

**passwordPolicy (AUTH-04):** ≥ 12 character minimum; HIBP leaked-password check enabled at the Identity Platform level (verified at Wave 1 preflight: `06-PREFLIGHT.md ## passwordPolicy`).

**AUTH-12 unified-error wrapper (D-13):** `src/firebase/auth.js` exports `signInEmailPassword` which catches the Firebase auth-credential error codes (`auth/user-not-found`, `auth/wrong-password`, `auth/invalid-credential`, `auth/too-many-requests`, `auth/user-disabled`, `auth/invalid-email`, `auth/missing-password`, `auth/missing-email`) and re-throws a single `SignInError("Email or password incorrect")`. Account-enumeration mitigation per AUTH-12 + L1.

**AUTH-13 progressive delay (D-21):** Firebase Auth's defaults handle account lockout / progressive delay server-side. Verification: cutover-day manual smoke test in `runbooks/phase6-cutover.md` Step 4 confirmed `auth/too-many-requests` is the eventual response after repeated failed attempts.

**Bootstrap admins (AUTH-15):** Luke + George were operator-Console-created (D-05) with `internalAllowlist/{lowercaseEmail}` seeded first via `scripts/seed-internal-allowlist/run.js`. `beforeUserCreated` was intended to read the allowlist + set claims in the first ID token (Pitfall 6 mitigation #3 — no refresh dance). Both UIDs captured in 06-PREFLIGHT.md `## Cutover Log`. Cutover reality: Path B Admin SDK direct claim issuance was used because the IdP blocking-handler invocation path was broken at cutover time (D-22 substrate gap — `gcp-sa-firebaseauth` SA not provisioned because `firebaseauth.googleapis.com` API ToS-gated; resolution queued in `runbooks/phase-6-cleanup-ledger.md` Phase 7 row).

**OOB temp-credential delivery (D-06):** Operator delivers temp credentials via secure channel of operator's standard practice; runbook does NOT prescribe channel. Tradeoff: operator-discretion on delivery method. Future invite flow (v2) will codify a single channel. Explicit deviation from Pitfall 7's "in-person side-by-side enrolment" recommendation.

## § Multi-Factor Authentication

Phase 6 Wave 5 Step 9 (TOTP enrolment) and Step 10 (AUTH-10 lockout drill) are deferred to an end-of-all-phases user-testing batch per operator instruction; the substrate to enrol (Firebase Identity Platform TOTP + admin un-enrol script `scripts/admin-mfa-unenroll/run.js`) ships in this phase, but the live drill data populates `runbooks/phase6-mfa-recovery-drill.md` when Luke + George run the same-session drill. AUTH-08 hard-enforced for `role: internal` users via router gates (gates temporarily short-circuited at cutover per D-27 to land Step 11 SC#4 — restoration queued in `runbooks/phase-6-cleanup-ledger.md` Phase 6 sub-wave 6.1 row alongside `enrollTotp + qrcodeDataUrl` wiring).

**AUTH-09 SUPERSEDED (D-07):** The original AUTH-09 spec (10 hashed recovery codes generated at MFA enrolment, stored under `users/{uid}.recoveryCodeHashes[]`) was replaced 2026-05-08 by **email-link recovery**:

- **Tier 1 (user-side, expected path):** user requests email-link sign-in via `sendSignInLinkToEmail` → re-authenticates via the link → un-enrols TOTP themselves via `multiFactor(currentUser).unenroll(...)` → re-enrols TOTP.
- **Tier 2 (operator-side, fallback):** other admin runs `firebase auth:multifactor:unenroll --uid <uid> --factor <factorId>` (or equivalent Admin SDK call via `scripts/admin-mfa-unenroll/run.js`) after OOB identity verification (Pitfall 7 mitigation).

**Tradeoff:** email-account compromise is the recovery substrate; this is acceptable because email is also the primary sign-in identifier and identity recovery substrate. The additional risk surface is bounded.

**AUTH-10 drill substrate:** `runbooks/phase6-mfa-recovery-drill.md` skeleton present; populated when the drill runs end-of-phases-batch. Pitfall 19 closure ("claim only what was rehearsed") is partial at phase close — the substrate is honest (script + runbook + admin un-enrol path), drill execution deferred per operator instruction. Tracked in `runbooks/phase-6-cleanup-ledger.md` Phase 6 sub-wave 6.1 row.

## § Anonymous Auth Disabled

C1 closure. Phase 6 Wave 5 Step 7: Anonymous Auth provider disabled at the IdP layer via admin v2 PATCH (`signIn.anonymous.enabled=false`, HTTP 200) at 2026-05-09T16:43:07Z (timestamp captured in 06-PREFLIGHT.md `## Cutover Log: anon_auth_console_disabled_at`). Phase 6 Wave 5 Step 8 atomic deletion commit (`auth14_deletion_sha: 3fddc1c` in same log) removed `signInAnonymously` import + call site + `firebase-ready` window.dispatchEvent bridge from source. No dead-code window for the runtime path: the runtime password-hash constants (`INTERNAL_PASSWORD_HASH` + `INTERNAL_ALLOWED_EMAILS`) + the anon-auth substrate were deleted from `src/main.js` IN THE SAME COMMIT that disabled Anonymous Auth at the IdP layer + carried the strict rules into production.

Pitfall 2 (`request.auth != null` is not access control) closure: combined with Phase 5 D-14 `isAuthed()` predicate (requires `email_verified == true` AND `sign_in_provider != "anonymous"`).

**AUTH-14 partial — substrate-honest at phase close:** the cutover commit retired the load-bearing runtime artifacts (constants + `signInAnonymously` call + `firebase-ready` bridge); `src/auth/state-machine.js` + `tests/auth/state-machine.test.js` + `tests/fixtures/auth-passwords.js` + the `INTERNAL_PASSWORD_HASH`-shape `gitleaks` rule are NOT deleted at Phase 6 close because `src/main.js` line 120 still imports `state-machine.js` (the Phase 4 IIFE body migration is the load-bearing predecessor). Closure tied to Phase 4 sub-wave 4.1 — tracked in `runbooks/phase-6-cleanup-ledger.md` "Phase 6 sub-wave 6.1" carry-forward row.

## § Production Rules Deployment

RULES-07 closure. Phase 6 Wave 5 Step 6: `firestore.rules` + `storage.rules` deployed to `bedeveloped-base-layers` via the cutover commit SHA chain (cutover commit `3fddc1c` squash-merged from PR #3 to `main` at 2026-05-09T16:18:22Z; manual local-CLI re-deploy `firebase deploy --only firestore:rules` + `firebase deploy --only storage` at ~2026-05-09T17:00Z to ensure production matches HEAD after CI deploy retries — captured in 06-PREFLIGHT.md `## Cutover Log: rules_deploy_sha + rules_deploy_console_timestamp`). The deploy fired exactly once during the phase against the production project (verified by Wave 6 RULES-07 verification gate — `runbooks/phase-6-cleanup-ledger.md ## RULES-07 Deploy Verification Gate`).

**5-minute rollback procedure (D-12):** `git revert <cutover-sha> --no-edit && git push` triggers the Phase 3 CI deploy job which redeploys the parent commit's rules. Substrate caveat captured in 06-PREFLIGHT.md ## Cutover Log: D-12 auto-rollback works for hosting + firestore + storage rules ONLY (not functions — D-8 cascade). Rehearsed end-to-end against the live Firebase project pre-cutover with timing recorded in `runbooks/phase6-rules-rollback-rehearsal.md` (`rehearsal_total_seconds: 121`, well under SC#4 5-min target). Pitfall 19 closure.

**Pitfall 1 mitigation (lockout on first rules deploy):** D-11 deploy ordering — functions deployed FIRST → admin bootstrap (Path B Admin SDK direct claims given D-22 substrate gap) → claims-verify (admin's ID token carried `role: "admin"`) → rules deploy → anon-disable. The strict-rules switch only flipped after Auth was proven end-to-end for at least one admin (Luke; George's first signin deferred to end-of-phases batch).

## § Phase 6 Audit Index

This is a one-stop pointer for an auditor walking Phase 6's controls. Each row maps a Phase 6 control to (a) the SECURITY.md section + decision that defines it, (b) the code path that implements it, (c) the test that verifies it, and (d) the framework citations it addresses. Mirrors the §Phase 3 Audit Index + §Phase 5 Audit Index pattern.

| Audit row | Control | Code path | Test | Framework |
|-----------|---------|-----------|------|-----------|
| beforeUserCreated claims-set | AUTH-03 / AUTH-05 / D-10 / Pitfall 6 | `functions/src/auth/beforeUserCreated.ts` + `functions/src/auth/claim-builder.ts` | `functions/test/auth/claim-builder.test.ts` | ASVS V2.4 / ISO A.5.17 / SOC2 CC6.1 |
| beforeUserSignedIn audit substrate | AUTH-06 / D-21 | `functions/src/auth/beforeUserSignedIn.ts` | (Phase 7 TEST-09 integration tests) | ASVS V2.5 / SOC2 CC6.7 |
| setClaims callable + poke pattern | AUTH-07 / ARCHITECTURE.md §7 Flow C | `functions/src/auth/setClaims.ts` + `src/cloud/claims-admin.js` | (Phase 7 TEST-09) | ASVS V4.1.1 |
| TOTP MFA enrol | AUTH-08 / D-08 | `src/views/auth.js` renderMfaEnrol + `src/firebase/auth.js` multiFactor | `tests/views/auth.test.js` mfa-enrol snapshot | ASVS V2.7 / ISO A.8.5 / SOC2 CC6.1 |
| Password policy >=12 + HIBP | AUTH-04 | (Identity Platform server-side) | `06-PREFLIGHT.md ## passwordPolicy` + cutover Step 4 manual smoke | ASVS V2.1.1 / GDPR Art 32(1)(b) |
| AUTH-12 unified-error wrapper | AUTH-12 / D-13 | `src/firebase/auth.js` SignInError + AUTH_CRED_ERROR_CODES set | `tests/views/auth.test.js` (renderSignIn behaviour) | ASVS V2.6 / OWASP Top 10 A07 |
| Anonymous Auth source removal | AUTH-01 / C1 / D-03 / D-04 | (deletion in cutover commit `auth14_deletion_sha: 3fddc1c`) | `grep -r "signInAnonymously" src/` returns 0 | (audit-narrative integrity) |
| RULES-07 production deploy | RULES-07 / D-11 | `firestore.rules` + `storage.rules` deployed | RULES-07 verification gate (`runbooks/phase-6-cleanup-ledger.md ## RULES-07 Deploy Verification Gate`) — exactly one deploy chain against bedeveloped-base-layers in the phase commit chain | ASVS V4 / SOC2 CC6.1 |
| 5-min rollback rehearsal | SC#4 / D-12 / Pitfall 19 | `runbooks/phase6-rules-rollback-rehearsal.md` | runbook `rehearsal_total_seconds: 121` (< 300) | SOC2 CC9.1 / ISO A.5.30 |
| AUTH-10 MFA drill (Tier-2) | AUTH-10 / D-08 / Pitfall 7 / Pitfall 19 | `runbooks/phase6-mfa-recovery-drill.md` + `scripts/admin-mfa-unenroll/run.js` | runbook drill evidence (skeleton present; populated end-of-phases-batch per operator deferral) | ASVS V2.7.4 / SOC2 CC6.1 |
| AUTH-14 source deletions | AUTH-14 / C2 / D-04 | (partial deletion in cutover commit `auth14_deletion_sha: 3fddc1c` — runtime constants + signInAnonymously call + firebase-ready bridge gone; state-machine.js + 2 test fixtures + .gitleaks.toml C2 rule deferred to Phase 4 sub-wave 4.1 per `phase-6-cleanup-ledger.md`) | partial verification: `grep -r "INTERNAL_PASSWORD_HASH\|INTERNAL_ALLOWED_EMAILS" src/` returns 0; full closure pending sub-wave 4.1 | (audit-narrative integrity) |
| AUTH-09 supersession | AUTH-09 / D-07 | (no code path — supersession is a documented decision) | `.planning/REQUIREMENTS.md` AUTH-09 row marks SUPERSEDED 2026-05-08 by email-link recovery | (compliance-credible posture per D-07) |
| AUTH-13 progressive delay | AUTH-13 / D-21 | (Firebase Auth defaults) | `runbooks/phase6-cutover.md` Step 4 manual smoke; `auth/too-many-requests` documented behaviour | ASVS V2.1.5 |
| AUTH-15 bootstrap migration | AUTH-15 / D-05 | `scripts/seed-internal-allowlist/run.js` + `runbooks/phase6-bootstrap.md` | `06-PREFLIGHT.md ## Cutover Log: bootstrap_log_*` populated for both admins; Luke first-signin verified | ASVS V2.4.5 |
| AUTH-11 email-verify (belt-and-braces) | AUTH-11 / D-14 | `firestore.rules` `isAuthed()` predicate (server) + `src/views/auth.js` renderEmailVerificationLanding (client) + `src/router.js` auth-state ladder | `tests/views/auth.test.js` renderEmailVerificationLanding test | ASVS V2.5 / GDPR Art 32(1)(b) |

**Cross-phase plug-ins this index will feed:**

- **Phase 7** (FN-01..09 / AUDIT-01..04 / AUDIT-06..07 / TEST-09) — wires `auditLog/` Firestore-side writers from Cloud Logging back-fill; replaces `rateLimits/{uid}/buckets/{windowStart}` deny-block body with `request.time` predicate; adds `enforceAppCheck: true` to `setClaims`; adds Zod validation + idempotency-key marker; firebase-functions-test integration coverage. Also resolves D-22 ToS gate (`firebaseauth.googleapis.com`) so blocking-handler invocation path is unbroken — Phase 6 used Path B Admin SDK direct claims as workaround.
- **Phase 8** (BACKUP-01..07 / GDPR-01..04) — backup automation + GDPR rights.
- **Phase 9** (AUDIT-05 / OBS-01..08) — view-side `auditWrite` wiring + Sentry + auth-anomaly Slack alerts.
- **Phase 10** (HOST-06) — drops temporary CSP allowlist for Firebase Auth popups (Phase 3 added preemptively in D-07).
- **Phase 11** (DOC-04) — customises Firebase password-reset email sender domain to `noreply@bedeveloped.com`.

## § Cloud Functions Workspace

Phase 7 (FN-01..06): All trusted-server work flows through 2nd-generation Cloud Functions in the `functions/` workspace, region-pinned to `europe-west2` (matches Firestore region per Pitfall 5 — minimises cross-region egress and simplifies the data-residency narrative for `PRIVACY.md`). The workspace ships its own `package.json`, TypeScript config, and Vitest test runner; root vitest does not load functions sources.

**Standard callable shape** (Pattern A): Every onCall enforces App Check (`enforceAppCheck: true`), Zod-validates input via `validateInput()`, writes a 5-minute idempotency-marker doc keyed by `(actor:type:target:clientReqId)`, captures errors to `@sentry/node` with PII-scrubbed `beforeSend` (Pitfall 18), and runs as its own minimal-IAM service account.

**Per-function service accounts** (FN-04 / Pitfall 13 / Pattern 7): provisioned via the idempotent `scripts/provision-function-sas/run.js` Pattern E script (ADC; no SA JSON in repo).

| SA | Roles | Bound to |
|----|-------|----------|
| `audit-writer-sa` | `roles/datastore.user` | `auditWrite` |
| `audit-mirror-sa` | `roles/datastore.user`, `roles/eventarc.eventReceiver` | `onOrgDelete`, `onUserDelete`, `onDocumentDelete` |
| `claims-admin-sa` | `roles/firebaseauth.admin`, `roles/datastore.user` | `setClaims` |
| `auth-blocking-sa` | `roles/firebaseauth.viewer`, `roles/datastore.viewer` | `beforeUserCreatedHandler`, `beforeUserSignedInHandler` (rebind deferred to sub-wave 7.1 per Branch B) |
| `ratelimit-sa` | `roles/datastore.user` | `checkRateLimit` |
| `csp-sink-sa` | `roles/logging.logWriter` | `cspReportSink` |

**Secrets management** (FN-05): All runtime secrets declared via `defineSecret()` from `firebase-functions/params`; never read from `process.env` outside the controlled `withSentry()` init path. `SENTRY_DSN` is the only Phase 7 secret. Operator-set via `firebase functions:secrets:set SENTRY_DSN`.

**Cold-start guarantee** (FN-06 / Pitfall 12): Auth-blocking handlers (`beforeUserCreated`, `beforeUserSignedIn`) ship Phase 7 WITHOUT `minInstances: 1` because the D-22 ToS gate (`firebaseauth.googleapis.com`) is still operator-deferred at Phase 7 close — IdP signs blocking-handler invocations as `gcp-sa-firebaseauth` SA which does not yet exist on the project. **Substrate-honest** (Pitfall 19): the FN-06 `minInstances:1` + cold-start p99 ≤ 4s baseline is queued in `runbooks/phase-7-cleanup-ledger.md` sub-wave 7.1 with documented closure path. Branch B selected at Wave 5; Branch A would have closed FN-06 inline.

Framework citations: ASVS V4.1 / V11.1 / V13 / V14, ISO 27001:2022 A.5.18 / A.8.15 / A.8.24, SOC2 CC6.1 / CC6.6 / CC7.2 / CC8.1, GDPR Art. 32(1)(b) + 32(1)(d).

## § App Check

Phase 7 (FN-07 / FN-08): App Check is enrolled via reCAPTCHA Enterprise in `src/firebase/check.js`, the unique permitted import site for `firebase/app-check` per the Phase 4 ESLint Wave 3 boundary (error-level).

**Per-environment site keys**: `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` pulled from `.env.local` (gitignored, verified via `git check-ignore`). Production build fails fast in `vite.config.js` if the key is absent — closes the silent-bypass risk (Pitfall 8 mitigation #3).

**Debug tokens**: Live ONLY in `.env.local` per environment (dev / staging / scratch / CI). Per-environment registration via Firebase Console → App Check → Apps → Manage debug tokens. Pitfall 1 mitigation enumerated in `runbooks/phase-7-app-check-rollout.md` §Stage A.

**Staged rollout** (Pitfall 8 / Pattern 3):

| Stage | What | Status |
|-------|------|--------|
| A — Enrolment (Wave 3) | Production deploy with App Check token attached on every Firebase SDK call; enforcement OFF for all services | Substrate shipped (Wave 3 commit 3bc2c6f); Console-side enrolment is operator-paced (`07-HUMAN-UAT.md` Test 1) |
| B — Quota alert | 70% of free tier (10k assessments/month for reCAPTCHA Enterprise) | Substrate documented (`runbooks/phase-7-app-check-rollout.md` §Stage B); Console alert config is operator-paced (Test 2) |
| C — 7-day soak | ≥95% verified ratio for ≥7 consecutive days, all enforcement OFF | Operator-paced calendar window (Test 3) |
| D — Storage enforcement | Day 8+ — first stage where App Check denies traffic | Operator-paced (Test 4) |
| E — Firestore enforcement (collection-by-collection) | Day 9+ — auditLog → internalAllowlist → softDeleted → messages → comments → documents → responses → actions | Operator-paced (Test 5) |
| F — Cloud Functions enforcement | Day 14+ — final stage; un-attested calls return `unauthenticated` HttpsError | Operator-paced (Test 6) |

**Cleanup-ledger gate**: `runbooks/phase-7-app-check-enforcement.md` records soak-day ratios, per-service enforcement flip dates, and screenshots. Wave 6 close gate accepts PASS-PARTIAL when Stages A+B+C land + Stages D-F are queued in `07-HUMAN-UAT.md`. Full PASS requires the operator to flip Stages D-F per their schedule.

Framework citations: OWASP A05:2025 (Security Misconfiguration), SOC2 CC6.6, ISO 27001:2022 A.13.1, GDPR Art. 32(1)(b).

## § Audit Log Infrastructure

Phase 7 (AUDIT-01..04 / AUDIT-06..07): Two-tier architecture — application-tier `auditLog/{eventId}` Firestore collection + infrastructure-tier Cloud Logging Data Access logs sunk to BigQuery `audit_logs_bq` (7-year retention). Closes Pitfall 17 ("audit log written from Cloud Functions only") at both tiers.

**Application tier** (`auditLog/{eventId}` Firestore collection):

- **Write authority**: Server-only via `auditWrite` callable using Admin SDK. Firestore Rules `allow write: if false` denies all client writes (Phase 5 baseline; rules-unit-test cells 1-4 in `tests/rules/auditLog.test.js` pin the 4-role × write matrix).
- **Read authority**: `allow read: if isAdmin()` only. Internal users cannot read their own audit records (AUDIT-07 — pinned by rules-unit-test cell 7).
- **Schema** (AUDIT-02): `auditEventInput` Zod schema in `functions/src/audit/auditEventSchema.ts` validates incoming payload; server-set fields (`eventId`, `actor`, `at`, `ip`, `userAgent`, `idempotencyKey`, `schemaVersion`) overlay the validated input — never trusted from payload (Pitfall 17).
- **Mirror triggers** (AUDIT-04): Three Firestore/Auth-trigger writers (`onOrgDelete` v2, `onUserDelete` v1, `onDocumentDelete` v2) provide defence-in-depth. Each fires on the corresponding delete event and writes a `*.delete.mirror` audit row IF no primary `auditWrite` event exists for the same target within the last 60s (Pattern 4b — avoids stampede on bulk delete cascades per Pitfall 7).

**Infrastructure tier** (BigQuery sink):

- Cloud Logging Data Access logs (Firestore + Storage + Auth + Functions) sunk to BigQuery dataset `bedeveloped-base-layers:audit_logs_bq` in `europe-west2` (matches Firestore region per Pitfall 5).
- 7-year retention via `default_table_expiration_ms: 220_752_000_000` (per AUDIT-06).
- Partitioned daily (`use_partitioned_tables: true`) for efficient queries.
- IAM `roles/bigquery.dataViewer` to internalAllowlist admin emails only; sink writer SA has `roles/bigquery.dataEditor` (least-privilege per T-07-05-01).
- Provisioning via idempotent `scripts/enable-bigquery-audit-sink/run.js` (Pattern E + Pitfall 13 ADC-only).

**Retention policy** (AUDIT-06): 12 months online (Firestore `auditLog/`) + 7 years archive (BigQuery). Documented in `docs/RETENTION.md`.

Framework citations: SOC2 CC7.2 / CC7.3, ISO 27001:2022 A.8.15 / A.12.4.1, GDPR Art. 32(1)(d), ASVS V4 / V11.1.

## § Rate Limiting

Phase 7 (FN-09): Per-user 60-second sliding-window token bucket enforcing 30 writes/window across `messages` + `comments` collections combined.

**Primary path** — Firestore Rules `request.time` predicate (`firestore.rules` `rateLimitOk(uid)` helper) against `rateLimits/{uid}/buckets/{windowStart}` doc. Zero per-write Cloud Function cost (Pitfall 4 — single `get()` budget honoured). Predicate is ordered LAST in the conjunction so cheap predicates short-circuit first.

**Fallback path** — `checkRateLimit` callable in `functions/src/ratelimit/checkRateLimit.ts` (Pattern 5b). Deployed but not live-wired in Phase 7; provides operator hot-swap capability if the rules-side hits a cost ceiling under future predicate composition. Activation requires: (a) wire `src/cloud/checkRateLimit.js` (Wave 6) into `src/data/{messages,comments}.js`, (b) drop the `&& rateLimitOk(uid)` conjunct from rules, (c) selective deploy.

**Client wiring** — `src/data/rate-limit.js` `incrementBucketAndWrite()` runs the protected write inside a `runTransaction` so the bucket counter increments atomically with the protected doc create. If the rules predicate denies, runTransaction throws `permission-denied`; caller surfaces "rate limit hit" via the AUTH-12 unified-error wrapper (no raw Firebase error code leak).

**Threshold** — 30/60s. Documented in `docs/RETENTION.md` as adjustable-via-rules-redeploy. Conservative-but-non-disruptive for chat-style SaaS use case (Open Question #3 in `07-RESEARCH.md`); revisit at engagement re-start if BeDeveloped consultancy use-case has bursts.

**Test coverage**: `tests/rules/rate-limit.test.js` 15 cells covering bucket-direct (cells 1-11) + composed-predicate (cells 12-15), including the 31-write synthetic burst (cell 13) which is the Phase 7 SC#5 evidence row.

Framework citations: OWASP A04:2021 (Insecure Design — rate limiting), ASVS V11.1.

## § Phase 7 Audit Index

This is the auditor walk-through pointer for Phase 7. Each row maps a Phase 7 control to (a) the section + decision that defines it, (b) the code path that implements it, (c) the test that verifies it, and (d) the framework citations it addresses. Mirrors §Phase 6 Audit Index density.

| Audit row | Control | Code path | Test | Framework |
|-----------|---------|-----------|------|-----------|
| auditWrite callable + Pattern A hardening | FN-01 / FN-03 / FN-07 / AUDIT-01 / AUDIT-02 | `functions/src/audit/auditWrite.ts` (App Check + Zod + idempotency + Sentry + audit-writer-sa) | `functions/test/audit/auditWrite.unit.test.ts` (12) + `functions/test/integration/auditWrite.integration.test.ts` (4) | ASVS V11.1 / SOC2 CC7.2 / ISO A.8.15 / GDPR Art. 32(1)(d) |
| auditLog Firestore predicate (write-deny + audited-self read-deny) | AUDIT-01 / AUDIT-07 | `firestore.rules` (`allow write: if false; allow read: if isAdmin()` on auditLog/) | `tests/rules/auditLog.test.js` (cells 1-8; cell 7 = AUDIT-07 audited-self) | ASVS V4 / SOC2 CC7.2 |
| Firestore-trigger audit mirrors (org + document) | AUDIT-04 / FN-01 | `functions/src/audit/triggers/onOrgDelete.ts` + `functions/src/audit/triggers/onDocumentDelete.ts` (v2 onDocumentDeleted; 60s primary-event dedup) | `functions/test/audit/triggers/mirrorTriggers.unit.test.ts` (10) + `functions/test/integration/{onOrgDelete,onDocumentDelete}.integration.test.ts` (4) | SOC2 CC7.2 / ISO A.8.15 |
| Auth-trigger audit mirror (user) | AUDIT-04 / FN-01 | `functions/src/audit/triggers/onUserDelete.ts` (v1 fallback — v2/identity has no onUserDeleted in firebase-functions 7.2.5) | `functions/test/audit/triggers/mirrorTriggers.unit.test.ts` (3) + `functions/test/integration/onUserDelete.integration.test.ts` (2) | SOC2 CC7.2 |
| Cloud Logging → BigQuery 7y sink | AUDIT-03 / AUDIT-06 | `scripts/enable-bigquery-audit-sink/run.js` (Pattern F — ADC + spawn gcloud / bq); dataset `audit_logs_bq` europe-west2 | `runbooks/phase-7-bigquery-sink-bootstrap.md` (T+1h `bq query COUNT(*) > 0` operator gate; pending operator) | SOC2 CC7.2 / CC7.3 / ISO A.12.4.1 / GDPR Art. 32(1)(d) |
| Per-user rate limit (rules predicate primary) | FN-09 | `firestore.rules` `rateLimitOk(uid)` composed on messages + comments create | `tests/rules/rate-limit.test.js` (cells 1-15; cell 13 = 31-write burst SC#5) | OWASP A04:2021 / ASVS V11.1 |
| Per-user rate limit (callable fallback) | FN-09 / Pattern 5b | `functions/src/ratelimit/checkRateLimit.ts` + `src/cloud/checkRateLimit.js` (Wave 6 wrapper, deployed-but-unwired) | `functions/test/ratelimit/checkRateLimit.unit.test.ts` (10) + `functions/test/integration/checkRateLimit.integration.test.ts` (2) | OWASP A04:2021 |
| App Check enrolment (reCAPTCHA Enterprise) | FN-07 | `src/firebase/check.js` + `vite.config.js` build-time guard | `tests/firebase/app.test.js` (initAppCheck contract) + 07-HUMAN-UAT.md Test 1 (Console enrolment, operator-paced) | OWASP A05:2025 / SOC2 CC6.6 |
| App Check staged enforcement | FN-07 / FN-08 | (Firebase Console toggles per service; runbook + UAT items) | `runbooks/phase-7-app-check-rollout.md` Stages A-F + `07-HUMAN-UAT.md` Tests 1-6 | SOC2 CC6.6 / ISO A.13.1 |
| Idempotency-key marker (5-min window) | FN-03 | `functions/src/util/idempotency.ts` `ensureIdempotent(key, scope, windowSec)` | `functions/test/util/idempotency.unit.test.ts` (8) + idempotency-replay cells in auditWrite + setClaims integration tests | SOC2 CC7.2 / ISO A.8.24 |
| Zod input validation on every callable | FN-03 / AUDIT-02 | `functions/src/util/zod-helpers.ts` `validateInput()` (`ZodError → HttpsError("invalid-argument")`) | `functions/test/util/zod-helpers.unit.test.ts` (4) + invalid-input cells in auditWrite + setClaims integration tests | ASVS V5 / OWASP A03:2021 |
| Per-function minimal-IAM service accounts | FN-04 / Pitfall 13 / Pattern 7 | `scripts/provision-function-sas/run.js` (6 SAs); `serviceAccount: <name>` declared on every onCall / trigger | runbook section "6 SAs — Operator-Run Evidence" + `07-HUMAN-UAT.md` (operator-paced provisioning) | ASVS V4.1 / SOC2 CC6.1 / ISO A.5.15 |
| Secret management via defineSecret() | FN-05 / Pitfall 13 | `defineSecret("SENTRY_DSN")` in setClaims, auditWrite, checkRateLimit; `withSentry()` reads only via `.value()` | `functions/test/util/sentry.unit.test.ts` (7 — including init no-op when DSN empty) | ASVS V2.10 / SOC2 CC6.1 / ISO A.8.24 |
| Auth-blocking minInstances:1 + cold-start p99 ≤ 4s | FN-06 / Pitfall 12 | `functions/src/auth/{beforeUserCreated,beforeUserSignedIn}.ts` (carry-forward to sub-wave 7.1 — Branch B; D-22 gated) | `runbooks/phase-7-cold-start-baseline.md` (deferred — Branch B) | ASVS V11.1 / SOC2 CC7.2 |
| firebase-functions-test v3 integration coverage | TEST-09 | `functions/test/integration/*.integration.test.ts` (8 files / 20 tests) + shared mock `functions/test/_mocks/admin-sdk.ts` | `cd functions && npm test` (133/133 pass; 20 new in Wave 6) | (test infrastructure — gates SC#3) |
| D-22 ToS gate resolution (Phase 6 sub-wave 6.1 carry-forward) | (audit-narrative integrity / Pitfall 19) | (operator Console click — `firebaseauth.googleapis.com` ToS acceptance) | `runbooks/phase-7-d22-tos-gate-resolution.md` Branch B (deferred to sub-wave 7.1; `07-HUMAN-UAT.md` Test 9) | (substrate-honest closure) |

**Cross-phase plug-ins this index will feed:**

- **Phase 8** (LIFE-01..06 / GDPR-01..04 / BACKUP-01..07) — soft-delete + 30-day restore; GDPR rights wired via `src/cloud/{soft-delete,gdpr}.js` body fills (Phase 4 stub seams); pre-migration export bucket lifecycle.
- **Phase 9** (AUDIT-05 / OBS-01..08) — view-side `auditWrite` wiring on every sign-in / sign-out / role change / delete / export / MFA enrol / password change; Sentry browser SDK init paired with the Phase 7 server-side DSN.
- **Phase 10** (HOST-06) — drops temporary CSP allowlist for Firebase Auth popup origin.
- **Phase 11** (DOC-02 / DOC-04) — `PRIVACY.md` documents BigQuery audit dataset region (europe-west2) + retention (7y) + sub-processor entry; password-reset email sender domain customisation.
- **Phase 12** (WALK-02 / WALK-03) — audit-walkthrough report cites Phase 7 trusted-server boundary, audit log, rate limit, and App Check sections as ground truth.

---

## § Data Lifecycle (Soft-Delete + Purge)

Phase 8 (LIFE-01..06): Admin-mediated soft-delete and 30-day restore window implemented across six collection paths: `orgs/{id}` (org soft-delete), `orgs/*/messages/{id}`, `orgs/*/comments/{id}`, `orgs/*/actions/{id}`, `orgs/*/documents/{id}`, and `funnelComments/{id}`. Daily `scheduledPurge` hard-deletes all records where `deletedAt` is set and `deletedAt < now() - 30d`. Firestore Rules predicate `notDeleted(resource.data)` is enforced on read across all five subcollection paths; client data wrappers add a matching `where("deletedAt", "==", null)` conjunct on every list query so queries that lack the conjunct fail `permission-denied` at the rules layer (defence-in-depth). A functional admin UI (`src/views/admin.js` § Recently Deleted) presents the soft-deleted item list with per-item Restore and "Permanently delete now" buttons.

**Evidence:**

- Callable implementations: `functions/src/lifecycle/softDelete.ts`, `functions/src/lifecycle/restoreSoftDeleted.ts`, `functions/src/lifecycle/scheduledPurge.ts`, `functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts`; helper: `functions/src/lifecycle/resolveDocRef.ts`
- Rules predicate: `firestore.rules` `notDeleted(resource.data)` function + 5 conjunction sites (orgs/messages/comments/actions/documents subcollections)
- Rules test coverage: `tests/rules/soft-delete-predicate.test.js` ≥ 18 cells (notDeleted × 5 collections × allow/deny matrix)
- Client seam: `src/cloud/soft-delete.js` (Phase 4 stub closed — Wave 2 / 08-03 Task 6)
- Admin UI: `src/views/admin.js` Recently Deleted section; `src/data/soft-deleted.js` (list + filter helpers)

**Framework citations:**

- OWASP ASVS L2 V8.3.1 — data lifecycle controls (defined retention, controlled deletion)
- ISO/IEC 27001:2022 A.5.30 (ICT readiness) + A.8.10 (information deletion)
- SOC 2 CC6.5 — logical access; controlled deletion enforced server-side
- GDPR Art. 5(1)(e) — storage limitation; soft-delete + 30-day purge is the mechanism

---

## § GDPR (Export + Erasure)

Phase 8 (GDPR-01..05): Two admin-callable Cloud Functions implement Art. 15 and Art. 17 rights.

**Export (Art. 15 — gdprExportUser):** Admin-callable that assembles a JSON bundle of all user-linked data across seven collection paths (profile, diagnostic responses, comments, messages, actions, documents, funnel comments, audit events), writes the bundle to `gs://bedeveloped-base-layers-backups/gdpr-exports/{uid}.json`, and returns a V4 signed URL with a 24h TTL. The bundle assembly is pure (no firebase-admin import) via `assembleUserBundle.ts`; the callable handles auth, idempotency, Sentry capture, and URL generation (Pattern A + Pattern C).

**Erasure (Art. 17 — gdprEraseUser):** Admin-callable with a deterministic `sha256(uid + GDPR_PSEUDONYM_SECRET)` tombstone token that replaces `authorId`, `legacyAuthorId`, `uploaderId`, `uploadedBy`, `legacyAppUserId`, and top-level PII fields (`email`, `name`, `displayName`, `photoURL`, `avatar`) across all seven collections plus legacy top-level `documents/` collection. Operations are chunked into 500-op batches (Firestore Admin SDK limit). Firebase Auth is disabled via `updateUser(uid, {disabled: true})`. Storage objects under `orgs/{orgId}/documents/{docId}/` derived from the user's document rows are deleted with 404-tolerance. A `redactionList/{uid}` document is written post-cascade (see GDPR-05 below). A single `compliance.erase.user` audit event with a counts payload is emitted (Pitfall 7 — never per-doc events on a bulk cascade).

**Audit-log retention vs erasure (Pitfall 11 / GDPR Art. 6(1)(f)):** Audit-log docs where `actor.uid == <erased uid>` are NOT deleted. Only `actor.uid`, `actor.email`, and `payload.email` are tombstoned in-place. The doc is retained under legitimate interest (fraud prevention, compliance audit trail), consistent with ICO pseudonymisation guidance as an Art. 17 satisfaction measure.

**Erasure propagation (GDPR-05):** `redactionList/{uid}` stores the tombstone token, `erasedAt`, `erasedBy`, and `schemaVersion: 1`. On PITR restore, the operator iterates this collection and re-applies tombstones to the cloned database before use (see `runbooks/restore-drill-2026-05-13.md` §Re-Redaction Step). Rules: `allow read: if isAdmin(); allow write: if false` — server-only writes via callable; admin-only read.

**Evidence:**

- GDPR callables: `functions/src/gdpr/gdprExportUser.ts`, `functions/src/gdpr/gdprEraseUser.ts`
- Pure helpers: `functions/src/gdpr/assembleUserBundle.ts` (export assembly), `functions/src/gdpr/pseudonymToken.ts` (tombstone generation), `functions/src/gdpr/eraseCascade.ts` (ops builder)
- Test coverage: 4 unit test files + 2 integration test files across gdprExportUser + gdprEraseUser
- Rules: `firestore.rules` `redactionList/{userId}` match block; `tests/rules/redaction-list.test.js` 10 cells
- Post-erasure audit: `scripts/post-erasure-audit/run.js` (ADC; exit 0/1/2; verifies zero residual PII across all paths)
- Secret: `GDPR_PSEUDONYM_SECRET` in Firebase Secret Manager (operator-provisioned, version-pinned)
- Browser seam: `src/cloud/gdpr.js` (Phase 4 stubs closed — `exportUser` + `eraseUser` wired)

**Framework citations:**

- OWASP ASVS L2 V8.1 — data classification and handling; V6 — cryptography (sha256 pseudonymisation)
- ISO/IEC 27001:2022 A.5.34 (privacy protection) + A.8.11 (data masking) + A.8.12 (data leakage prevention)
- SOC 2 P5.1 — privacy notice; privacy rights honoured
- GDPR Art. 15 (right of access), Art. 17 (right to erasure), Art. 25 (data protection by design — pseudonymisation), Art. 30 (record of processing — audit trail), Art. 32 (security of processing)

---

## § Backups + DR + PITR + Storage Versioning

Phase 8 (BACKUP-01..07): Multi-layer backup and recovery substrate.

**Daily Firestore export (BACKUP-01):** 2nd-gen `onSchedule` Cloud Function (`scheduledFirestoreExport`) exports the default Firestore database to `gs://bedeveloped-base-layers-backups/firestore/{YYYY-MM-DD}/` at 02:00 UTC daily. Runs as `backup-sa` (minimal IAM: `roles/datastore.importExportAdmin` + `roles/storage.objectAdmin` on backups bucket only). Region-pinned to `europe-west2` (matches Firestore region, Pitfall 5).

**GCS lifecycle policy (BACKUP-02):** GCS lifecycle: Standard at upload → Nearline at day 30 from creation → Archive at day 365 from creation (335-day Nearline dwell, exceeds BACKUP-02 90d Nearline minimum). Configured via `scripts/setup-backup-bucket/lifecycle.json`; applied by `scripts/setup-backup-bucket/run.js` (idempotent, ADC).

**Firestore PITR (BACKUP-03):** Enabled on the `(default)` database (7-day rolling recovery window). Demonstrated via Path A PITR clone in `runbooks/restore-drill-2026-05-13.md`.

**Storage versioning + soft-delete (BACKUP-04):** GCS uploads bucket (`gs://bedeveloped-base-layers-uploads`) has Object Versioning enabled + 90-day soft-delete policy. Client documents are recoverable from noncurrent versions for 90 days.

**Signed URL TTL (BACKUP-05):** Storage download URLs are V4 signed with 1h TTL via the `getDocumentSignedUrl` callable (`functions/src/backup/getDocumentSignedUrl.ts`). `getDownloadURL` calls are removed from all client code (full sweep verified by `grep -r getDownloadURL src/` returning 0 results). The `storage-reader-sa` issues tokens (`roles/iam.serviceAccountTokenCreator` self-bound + `roles/storage.objectViewer` on uploads bucket).

**Quarterly restore-drill cadence (BACKUP-06):** Documented in `runbooks/phase-8-restore-drill-cadence.md`. Quarterly (Q2-2026 through Q2-2027 schedule). Two-operator paired review required. P1 escalation if missed within 7 days.

**First restore drill (BACKUP-07):** `runbooks/restore-drill-2026-05-13.md` — Path A (PITR clone); timed steps; spot-check; re-redaction step (GDPR-05); cleanup; RTO evidence. Operator fills in actual timings during execution.

**Evidence:**

- Backup callable: `functions/src/backup/scheduledFirestoreExport.ts`
- Signed URL callable: `functions/src/backup/getDocumentSignedUrl.ts`; browser seam: `src/cloud/signed-url.js`
- Bucket setup: `scripts/setup-backup-bucket/run.js` + `scripts/setup-backup-bucket/lifecycle.json` + `scripts/setup-backup-bucket/lifecycle.notes.md`
- Operator runbook: `runbooks/phase-8-backup-setup.md` (§7 includes GDPR secrets + 4 SA provisioning)
- Restore drill: `runbooks/restore-drill-2026-05-13.md` (BACKUP-07 evidence)
- Drill cadence: `runbooks/phase-8-restore-drill-cadence.md` (BACKUP-06)
- `getDownloadURL` removal: `src/data/documents.js` + `src/main.js` sweep

**Framework citations:**

- OWASP ASVS L2 V14.1 (build and deployment) + V8.3 (data protection at rest / storage security)
- ISO/IEC 27001:2022 A.5.29 (information security during disruption) + A.5.30 (ICT readiness) + A.8.13 (information backup) + A.8.14 (redundancy)
- SOC 2 CC9.1 (risk mitigation) + A1.2 (environmental protections) + A1.3 (recovery and restoration procedures)
- GDPR Art. 32(1)(b) (resilience of systems) + Art. 32(1)(c) (restoration of data)

---

## § Phase 8 Audit Index

Auditor walk-through pointer for Phase 8. Each row maps a Phase 8 control to its requirement ID, the code/config that implements it, the test or operator evidence that verifies it, and the framework citations it satisfies. Mirrors the §Phase 7 Audit Index shape (16 rows). Substrate-honest (Pitfall 19): every Validated row has evidence pointers; operator-deferred actions are noted where applicable.

| Requirement | Substrate | Evidence | Status |
|-------------|-----------|----------|--------|
| LIFE-01 | `softDelete` + `restoreSoftDeleted` callables; `resolveDocRef.ts` helper for mixed path resolution | `functions/src/lifecycle/{softDelete,restoreSoftDeleted,resolveDocRef}.ts` + unit/integration tests | Validated 2026-05-13 (08-03) |
| LIFE-02 | Snapshot-then-tombstone in single batch write (`deletedAt` set + snapshot at `softDeleted/{type}/items/{id}`) | `functions/src/lifecycle/softDelete.ts` batch pattern + tests | Validated 2026-05-13 (08-03) |
| LIFE-03 | Rules `notDeleted(resource.data)` predicate on 5 subcollection paths; client `where("deletedAt", "==", null)` conjunct in all 5 data wrappers | `firestore.rules` + `src/data/{messages,comments,actions,documents,funnelComments}.js` + `tests/rules/soft-delete-predicate.test.js` | Validated 2026-05-13 (08-03) |
| LIFE-04 | `restoreSoftDeleted` callable (admin-only, Zod-validated, idempotent) returns item to live state within 30-day window | `functions/src/lifecycle/restoreSoftDeleted.ts` + `src/cloud/soft-delete.js` + tests | Validated 2026-05-13 (08-03) |
| LIFE-05 | `scheduledPurge` with 500-doc batched pagination; purges docs where `deletedAt < now() - 30d` | `functions/src/lifecycle/scheduledPurge.ts` + 1200-doc pagination test | Validated 2026-05-13 (08-03) |
| LIFE-06 | Admin UI: Recently Deleted list + per-item Restore button + "Permanently delete now" button wired to `permanentlyDeleteSoftDeleted` callable | `src/views/admin.js` + `src/data/soft-deleted.js` + `functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts` | Validated 2026-05-13 (08-03) |
| GDPR-01 | `gdprExportUser` callable: JSON bundle of all user-linked data; 24h V4 signed URL; `assembleUserBundle.ts` pure helper | `functions/src/gdpr/{assembleUserBundle,gdprExportUser}.ts` + unit (6) + integration (3) tests | Validated 2026-05-13 (08-04) |
| GDPR-02 | `gdprEraseUser` callable: deterministic sha256(uid + secret) tombstone token via `pseudonymToken.ts`; cascade via `eraseCascade.ts` | `functions/src/gdpr/{pseudonymToken,eraseCascade,gdprEraseUser}.ts` + 12+7+9 tests | Validated 2026-05-13 (08-05) |
| GDPR-03 | Cascade covers 7+ collections (messages/comments/actions/documents/funnelComments/users/auditLog) + legacy top-level documents/ + Storage deletion + Auth disable | `functions/src/gdpr/eraseCascade.ts` + `scripts/post-erasure-audit/run.js` | Validated 2026-05-13 (08-05) |
| GDPR-04 | Audit-log retention: PII tombstoned (actor.uid/email + payload.email) in-place; doc preserved under Art. 6(1)(f) legitimate interest | `functions/src/gdpr/eraseCascade.ts` auditLog branch + tests + Pitfall 11 disclosure | Validated 2026-05-13 (08-05) |
| GDPR-05 | `redactionList/{uid}` written post-cascade; admin-only read rules; restore-drill re-redaction step documents PITR propagation closure | `firestore.rules` redactionList block + `tests/rules/redaction-list.test.js` (10 cells) + `runbooks/restore-drill-2026-05-13.md` §Re-Redaction | Validated 2026-05-13 (08-05 + 08-06) |
| BACKUP-01 | `scheduledFirestoreExport` (2nd-gen onSchedule, europe-west2, backup-sa, 02:00 UTC daily) | `functions/src/backup/scheduledFirestoreExport.ts`; first export verified by operator (Task 1 step 6) | Validated 2026-05-13 (08-02; deploy: operator) |
| BACKUP-02 | GCS lifecycle: Standard at upload → Nearline at day 30 from creation → Archive at day 365 from creation (335-day Nearline dwell, exceeds BACKUP-02 90d Nearline minimum) | `scripts/setup-backup-bucket/lifecycle.json` + `scripts/setup-backup-bucket/lifecycle.notes.md`; verified via `gcloud storage buckets describe` (operator) | Validated 2026-05-13 (08-01; operator) |
| BACKUP-03 | Firestore PITR enabled (7-day rolling window) | `gcloud firestore databases describe --format="value(pointInTimeRecoveryEnablement)"` → `POINT_IN_TIME_RECOVERY_ENABLED` (operator verified) | Validated 2026-05-13 (08-01; operator) |
| BACKUP-04 | Uploads bucket Object Versioning enabled + 90-day soft-delete policy | `gcloud storage buckets describe gs://bedeveloped-base-layers-uploads --format="value(versioning.enabled,softDeletePolicy.retentionDurationSeconds)"` (operator verified) | Validated 2026-05-13 (08-01; operator) |
| BACKUP-05 | V4 signed URL with 1h TTL via `getDocumentSignedUrl` callable; `getDownloadURL` removed from all client code | `functions/src/backup/getDocumentSignedUrl.ts` + `src/cloud/signed-url.js`; `grep -r getDownloadURL src/` returns 0 | Validated 2026-05-13 (08-02 + 08-03) |
| BACKUP-06 | Quarterly restore-drill cadence; two-operator paired review; P1 escalation if missed | `runbooks/phase-8-restore-drill-cadence.md` | Validated 2026-05-13 (08-06) |
| BACKUP-07 | One restore drill performed and documented with timing, evidence, gaps, re-redaction step | `runbooks/restore-drill-2026-05-13.md` (operator fills in actual timings; commit SHA at drill time) | Validated 2026-05-13 (08-06; operator drill required) |
| DOC-10 | Phase 8 incremental SECURITY.md increment: 4 new sections + this 19-row Phase 8 Audit Index | This file — §Data Lifecycle + §GDPR + §Backups + DR + PITR + §Phase 8 Audit Index | Validated 2026-05-13 (08-06) |

**Substrate-honest disclosure (Pitfall 19):** BACKUP-01..04 and BACKUP-07 depend on operator production deploy (Task 1) and operator restore drill (Task 2) respectively. The code and runbooks are authored and committed; production execution is operator-deferred per the Wave 6 batching pattern established in 08-01-DEFERRED-CHECKPOINT.md. Status above reflects "code + substrate authored; operator action pending for production evidence".

**Cross-phase plug-ins this index will feed:**

- **Phase 9** (AUDIT-05 / OBS-01..08) — Sentry alerts on unusual-hour `gdprExportUser` / `gdprEraseUser` invocations; view-side `auditWrite` wiring for compliance events.
- **Phase 11** (DOC-02 / DOC-04 / DOC-05) — `RETENTION.md` row for soft-delete (30d) + GDPR exports (24h URL TTL); `CONTROL_MATRIX.md` rows for LIFE/GDPR/BACKUP; `PRIVACY.md` GCS backup region + redactionList substrate.
- **Phase 12** (WALK-02 / WALK-03) — audit-walkthrough cites Phase 8 GDPR + lifecycle + backup sections as ground truth.

---

## § Observability — Sentry

Phase 9 (OBS-01 / OBS-02 / OBS-03 / OBS-08): Browser + Cloud Functions error capture with shared PII scrubber, EU residency, and free-tier guardrails.

**Browser init (OBS-01):** `@sentry/browser@10.52.0` initialised in `src/observability/sentry.js` and booted from `src/main.js` inside the `fbOnAuthStateChanged` callback — AFTER claims hydration but BEFORE first render (Pitfall 3 — initialise after auth so the `user` context carries verified claims, not anonymous-session noise). `sendDefaultPii: false`; `tracesSampleRate: 0` (no performance monitoring in v1 — Sentry free-tier event budget is reserved for error events).

**Cloud Functions init (OBS-01):** `functions/src/util/sentry.ts` exposes `withSentry()` wrapper used by every Phase 7+8+9 callable (setClaims, auditWrite, checkRateLimit, gdprExportUser, gdprEraseUser, lifecycle callables, authAnomalyAlert). DSN read from `defineSecret("SENTRY_DSN")` — never `process.env`. Empty-DSN kill-switch: when `SENTRY_DSN` resolves to empty string, init becomes a silent no-op (local dev + emergency disable path).

**Shared PII scrubber (OBS-01 / Pitfall 18 / Pitfall 7):** Browser and node share an identical PII_KEYS dictionary across two source files:

- `src/observability/pii-scrubber.js` (browser dictionary)
- `functions/src/util/pii-scrubber.ts` (node dictionary)

Drift between the two arrays is gated by `functions/test/util/pii-scrubber-parity.test.ts` — the test reads both files at PR time and fails if any key differs. The `beforeSend` hook in each SDK redacts matching extras + contexts to the literal string `"<redacted>"` (preserves SRE visibility that the slot WAS populated without leaking the value); headers continue to use `delete` since header presence itself is not security-sensitive.

**EU residency (OBS-02 / GDPR Art. 32 / Schrems II):** DSN format `https://<key>@<id>.ingest.de.sentry.io/<project>` encodes the region — operators MUST select an EU project at Sentry create time (`runbooks/phase-9-sentry-bootstrap.md` Step 2). Source-map upload also targets `https://de.sentry.io/` (Wave 2 `@sentry/vite-plugin@5.2.1` config). Sentry EU residency is documented as a sub-processor entry in PRIVACY.md (Phase 11 owner).

**Fingerprint rate-limit (OBS-03):** `fingerprintRateLimit()` runs INSIDE `beforeSend` BEFORE `scrubPii()` — events sharing the same SDK fingerprint above 10 per 60s window are dropped at SDK boundary (return `null`). Prevents free-tier exhaustion during error storms and keeps scrub cost zero for dropped events. Tested in `tests/observability/sentry-init.test.js` Test 6.

**Sentry 70% quota alert (OBS-08):** Operator-set in the Sentry web UI at `Settings → Subscription → Usage Alerts` (5000 events/month free tier → alert at 3500). Not scriptable from gcloud; pinned in `runbooks/phase-9-sentry-bootstrap.md` Step 6 + verified at the Wave 6 close-gate via `runbooks/phase-9-deploy-checkpoint.md` Step E screenshot.

**Substrate-honest disclosures (Pitfall 19):**

- `sendDefaultPii: false` + `tracesSampleRate: 0` — no performance monitoring (deferred to v2 if/when a paid plan lands)
- Empty-DSN init is a silent no-op (kill-switch + local dev path) — log an info-level line but do NOT throw
- Fingerprint rate-limit drops 11+ events/fp/60s BEFORE transport — by design, an error storm at >10/min/fingerprint will silently truncate (alternative would be paid-tier upgrade)

**Evidence:**

- Browser SDK init: `src/observability/sentry.js`; boot wiring: `src/main.js` (inside `fbOnAuthStateChanged`)
- Browser PII scrubber: `src/observability/pii-scrubber.js`
- Node SDK init: `functions/src/util/sentry.ts` (`withSentry()` wrapper)
- Node PII scrubber: `functions/src/util/pii-scrubber.ts`
- Parity test: `functions/test/util/pii-scrubber-parity.test.ts`
- Browser tests: `tests/observability/sentry-init.test.js` (9 tests) + `tests/observability/pii-scrubber.test.js` (7 tests)
- Operator runbook: `runbooks/phase-9-sentry-bootstrap.md` (6 steps — Sentry org/project/EU region/DSN/auth-token/GitHub secrets/70% quota alert)
- Source-map upload (OBS-04): `vite.config.js` `@sentry/vite-plugin` registered conditionally on `SENTRY_AUTH_TOKEN && command === "build"`; `filesToDeleteAfterUpload: ["dist/**/*.map"]`; CI `Assert no .map files` step in `.github/workflows/ci.yml` (deploy + preview jobs); static drift test `tests/build/source-map-gate.test.js` (5 assertions over `vite.config.js`)

**Framework citations:**

- OWASP ASVS L2 V8.3.4 (log-content PII handling) + V8.4.4 (event rate-limiting) + V14.2.4 (release artefact integrity / hidden source maps)
- ISO/IEC 27001:2022 A.5.10 (information classification) + A.5.34 (privacy protection) + A.8.15 (logging) + A.8.16 (monitoring activities) + A.5.6 (budget / quota controls)
- SOC 2 CC7.2 (system operations monitoring)
- GDPR Art. 32 (security of processing) + Art. 44 (international transfers — EU residency mitigates Schrems II)

---

## § Audit-Event Wiring (AUDIT-05)

Phase 9 (AUDIT-05): Every sensitive op emits a server-verified-actor audit event. Phase 7 shipped the substrate (`auditWrite` callable + 3 mirror triggers + 28-entry `auditEventType` enum). Phase 9 Plan 03a (Wave 3) extended the enum by 33 literals — 15 server-side bare data-domain flavours (`data.{action,comment,document,message,funnelComment}.{softDelete,restore,permanentlyDelete}`) and 18 client-side `.requested` companions — AND added server-side bare emissions in `setClaims`, the `beforeUserSignedIn` substrate, and 3 lifecycle callables. Phase 9 Plan 03 (Wave 4) wired client-side emissions at 9 view-side sites for the `.requested` companions and bare auth-event literals.

**Wiring inventory:**

| Op | Client emit site | PRE/POST | Audit type | Server bare emit |
|----|------------------|----------|-----------|------------------|
| sign-in (success + failure) | `src/firebase/auth.js` `signInEmailPassword` (try/finally outcome flag) | POST | `auth.signin.success` / `auth.signin.failure` | n/a (Identity Platform issues ID token; no callable involved) |
| sign-out | `src/firebase/auth.js` `signOut` | **PRE** (App Check + ID-token revoked by `fbSignOut`; post-emit would 401) | `auth.signout` | n/a |
| password change | `src/firebase/auth.js` `updatePassword` | POST | `auth.password.change` | n/a |
| password reset | `src/firebase/auth.js` `sendPasswordResetEmail` | POST | `auth.password.reset` (`target.id="unknown"` — caller pre-auth) | n/a |
| email-link recovery | `src/firebase/auth.js` `signInWithEmailLink` | POST | `auth.signin.success` (payload `{method: "emailLink"}`) | n/a |
| claims set | `src/cloud/claims-admin.js` `setClaims` | POST | `iam.claims.set.requested` | `functions/src/auth/setClaims.ts` (Plan 03a) → `iam.claims.set` bare |
| GDPR export | `src/cloud/gdpr.js` `exportUser` | POST | `compliance.export.user.requested` | `functions/src/gdpr/gdprExportUser.ts:197` (Phase 8) → `compliance.export.user` |
| GDPR erase | `src/cloud/gdpr.js` `eraseUser` | POST | `compliance.erase.user.requested` | `functions/src/gdpr/gdprEraseUser.ts:289` (Phase 8) → `compliance.erase.user` |
| soft-delete / restore / permanently-delete | `src/cloud/soft-delete.js` (3 functions × 5 types) | POST | `data.<type>.{softDelete,restore,permanentlyDelete}.requested` | `functions/src/lifecycle/{softDelete,restoreSoftDeleted,permanentlyDeleteSoftDeleted}.ts` (Plan 03a) → bare `data.<type>.<op>` |
| beforeUserSignedIn rejection | n/a (substrate only) | catch | `auth.signin.failure` | `functions/src/auth/beforeUserSignedIn.ts` (Plan 03a, DORMANT until a rejection rule lands) |

**Pitfall 17 invariant (server-determined actor):** Client emissions pass only `type`, `target`, and `payload` (and a `clientReqId` injected by the `src/cloud/audit.js` wrapper). The `auditWrite` callable server-side overlays `actor` from `request.auth.token` (uid / email / role / orgId / email_verified). The view CANNOT spoof `actor` — the callable schema rejects any `actor` field in payload; a regression would fail `tests/audit-wiring.test.js` PII-scrub assertions. For the unauthenticated `beforeUserSignedIn` path, server-side emit sets `actor=null` (or a `system` sentinel where the wrapper requires non-null).

**Pitfall 7 (mirror-trigger collision):** Phase 7 mirror triggers (`onOrgDelete`, `onUserDelete`, `onDocumentDelete`) fire only if no primary `auditWrite` event exists for the same target within the prior 60s window. Plan 03a server-side bare emissions on `softDelete` / `restoreSoftDeleted` / `permanentlyDeleteSoftDeleted` satisfy primary-event existence for the 60s window, so cascade delete operations emit ONE audit row, not N. Client-side `.requested` emissions on soft-delete callables land BEFORE the server callable resolves; the bare `data.<type>.softDelete` server emit lands AFTER the batch commit — both satisfy mirror dedup (`.requested` carries `type="data.<type>.softDelete.requested"`, mirror trigger keys off the bare `data.<type>.softDelete` literal, so neither aliases the other).

**Best-effort emission (Pattern 5 #2):** All 11 client-side `emitAuditEvent` calls are wrapped in try/catch (defensive double-wrap — the proxy at `src/observability/audit-events.js` already swallows internally per Plan 09-01). A failed emission must NEVER block the originating op. Tested in `tests/firebase/auth-audit-emit.test.js` (any swallowed audit failure does NOT propagate to the auth-state-change callback).

**Substrate-honest disclosure (Pitfall 19) — MFA emit DEFERRED:** MFA enrol / un-enrol audit emission is bound to landing of `enrollTotp` and `unenrollAllMfa` deps in `src/main.js:916-917`, which are currently `// deferred to user-testing phase`. The `auth.mfa.enrol` + `auth.mfa.unenrol` enum literals (Phase 7 baseline) remain valid and ready for emission. Plan 09-04 anomaly Rule 2 (MFA disenrolment alert) trigger code stays DORMANT — observation is zero until those deps land. Carry-forward row in `runbooks/phase-9-cleanup-ledger.md`.

**Substrate-honest disclosure (Pitfall 19) — `auth.signin.failure` substrate DORMANT:** `functions/src/auth/beforeUserSignedIn.ts` emits `auth.signin.failure` only on internal handler errors (logger throw, malformed event.data) today — there are NO rejection rules in `beforeUserSignedIn` at Phase 9 close. The substrate is wired so that the moment any business rejection rule lands (Phase 10+ probable), `auth.signin.failure` events flow and Plan 09-04 anomaly Rule 1 (auth-fail burst — `>5/IP/5min`) activates without trigger-code change. Plan 09-05 deploy-checkpoint Step D is explicitly DORMANT at Phase 9 close (passes by design — DORMANT, not skipped).

**Evidence:**

- Server-side substrate: `functions/src/audit/auditEventSchema.ts` (61-entry enum); `functions/src/auth/{setClaims,beforeUserSignedIn}.ts`; `functions/src/lifecycle/{softDelete,restoreSoftDeleted,permanentlyDeleteSoftDeleted}.ts`; existing Phase 8 `functions/src/gdpr/{gdprExportUser,gdprEraseUser}.ts`
- Server-side tests: `functions/test/audit/auditEventSchema.unit.test.ts` (18) + `functions/test/auth/{setClaims-audit-emit,beforeUserSignedIn-audit-emit}.test.ts` + `functions/test/lifecycle/*-audit-emit.test.ts` (5 files, 25 tests total)
- Client-side wiring: `src/firebase/auth.js` (5 emit sites); `src/cloud/{claims-admin,gdpr,soft-delete}.js` (6 emit sites — 1 + 2 + 3)
- Client proxy: `src/observability/audit-events.js` (best-effort emit; never throws); `src/cloud/audit.js` (`writeAuditEvent` wrapper; injects `clientReqId` via `crypto.randomUUID()`)
- Client tests: `tests/firebase/auth-audit-emit.test.js` + `tests/audit-wiring.test.js` (14 tests total)

**Framework citations:**

- OWASP ASVS L2 V8.4.x (audit content + retention + tamper resistance)
- ISO/IEC 27001:2022 A.8.15 (logging) + A.8.16 (monitoring activities)
- SOC 2 CC4.1 (monitoring) + CC7.2 (system operations)
- GDPR Art. 30 (record of processing) + Art. 32(1)(d) (regular testing of effectiveness)

---

## § Anomaly Alerting (OBS-05)

Phase 9 (OBS-05): `functions/src/observability/authAnomalyAlert.ts` is an `onDocumentCreated('auditLog/{eventId}')` Firestore trigger in `europe-west2` running as `audit-alert-sa`. It evaluates 4 anomaly rules over the audit-event stream and dispatches Slack webhook messages on threshold-crossing events. Rolling auth-failure counters live at `authFailureCounters/{ipHash}` — a server-only Firestore collection that clients cannot read or write.

**The 4 rules:**

1. **Auth-fail burst** — fires when an IP exceeds 5 sign-in failures in a 5-minute rolling window; EXACTLY ONCE per `(ipHash, window)` on the threshold-crossing event (`count === FAIL_LIMIT + 1`). **DORMANT** — `beforeUserSignedIn` substrate emits no failures yet (no rejection rules exist). Trigger code is functional and the observation pipeline activates the moment any rejection rule lands.

2. **MFA disenrolment** — fires on every `auth.mfa.unenrol` event. **DORMANT** — no current MFA emit source (see § Audit-Event Wiring above; bound to `enrollTotp` / `unenrollAllMfa` dep landing).

3. **Role escalation** — fires when a `iam.claims.set` event carries `payload.newRole === "admin"` AND `payload.previousRole !== "admin"`. **FUNCTIONAL** — feeds from Plan 03a `setClaims` server-side bare emission.

4. **Unusual-hour GDPR export** — fires when a `compliance.export.user` event UTC hour ∈ `{0..5, 22..23}`. **FUNCTIONAL** — feeds from Phase 8 baseline `gdprExportUser` server-side emission.

**Counter shape (Pattern 10):** `authFailureCounters/{ipHash}` document carries `{count: number, windowStart: Timestamp}`. The handler runs a Firestore transaction that (a) re-reads the doc, (b) resets `count=1` if `now - windowStart >= 5min` OR the doc doesn't exist (`tx.set` collapses both branches — `tx.update` on a missing doc errors), (c) otherwise increments `count`, (d) calls `postToSlack` exactly when the new count equals `FAIL_LIMIT + 1` (= 6). IP is hashed via `node:crypto.createHash("sha256")` — raw IP never lands in Firestore.

**Authorisation:**

- Runs as `audit-alert-sa` SA: `roles/datastore.user` (authFailureCounters read/write) + `roles/datastore.viewer` (auditLog read) at project level; `roles/secretmanager.secretAccessor` on individual secrets only (`SLACK_WEBHOOK_URL`, `SENTRY_DSN`) — NOT project-wide
- `firestore.rules` adds a `match /authFailureCounters/{ipHash}` block: `allow read: if false; allow write: if false` (server-only via Admin SDK)
- `tests/rules/authFailureCounters.test.js` — 4 deny cells (client read deny + client write deny + admin read deny + admin write deny)

**Slack post (Pattern 6):** `postToSlack` is best-effort — never throws. Logs `slack.skip.no-webhook` when `SLACK_WEBHOOK_URL` resolves to empty; logs `slack.post.failed` with HTTP status on Slack 4xx/5xx; logs `slack.post.error` on network failure. `retry: false` (not v1-style `retryConfig.retryCount: 1` — the v2 Firestore-trigger DocumentOptions exposes `retry: boolean`); intent is "best-effort, do not retry-storm Slack."

**Substrate-honest disclosures (Pitfall 19):**

- **2 of 4 rules DORMANT at Phase 9 close** — Rule 1 (auth-fail burst) awaits any rejection rule in `beforeUserSignedIn`; Rule 2 (MFA disenrol) awaits MFA dep landing in `src/main.js`. Substrate is functional + tested; observation pipeline is gated on emission-source landing. Phase 9 close does NOT claim Rules 1+2 are firing today.
- **Synthetic alert verification** — `scripts/test-slack-alert/run.js` lets the operator post a synthetic message to the configured webhook at Wave 6 close-gate (`runbooks/phase-9-deploy-checkpoint.md` Step C) to verify Slack reception independently of the real anomaly stream.
- **`#ops-warn` vs `#ops-page` channel split deferred to v2** — operator policy decision, not a code-level row. Today all 4 rules post to a single Slack channel (operator-configured webhook URL).

**Defence-in-depth (Pitfall 4 secret discipline):** `.gitleaks.toml` extended with a Slack-webhook-URL regex (`https://hooks.slack.com/services/[A-Z0-9]+/[A-Z0-9]+/[a-zA-Z0-9]+`) so a future PR that accidentally commits the webhook URL fails pre-commit + CI. This row was MOVED from Plan 09-06 Task 3 to Plan 09-04 Task 4 (planner WARNING 7 fix — defence-in-depth belongs WITH the secret introduction, not in a downstream docs increment).

**Evidence:**

- Trigger module: `functions/src/observability/authAnomalyAlert.ts` (222 lines)
- Trigger tests: `functions/test/observability/authAnomalyAlert.test.ts` (6 behaviour tests — 3 for Rule 1 counter shape + Rules 3 + Rules 4 + escalation negative case)
- Counter rules: `firestore.rules` `authFailureCounters/{ipHash}` block + `tests/rules/authFailureCounters.test.js` (4 cells)
- Synthetic verify: `scripts/test-slack-alert/run.js` + `scripts/test-slack-alert/README.md`
- Gitleaks: `.gitleaks.toml` `slack-webhook-url` rule (Plan 09-04 Task 4)
- Secret management: `defineSecret("SLACK_WEBHOOK_URL")` + `defineSecret("SENTRY_DSN")` — never `process.env`; never GitHub Actions secrets
- Operator runbook: `runbooks/phase-9-monitors-bootstrap.md` Step 1 (`audit-alert-sa` SA provisioning) + Step 2 (Secret Manager secrets)
- Close-gate: `runbooks/phase-9-deploy-checkpoint.md` Step C (synthetic Slack alert) + Step D (Rule 1 burst test — explicitly DORMANT)

**Framework citations:**

- ISO/IEC 27001:2022 A.5.25 (assessment of information security events) + A.8.16 (monitoring activities)
- SOC 2 CC7.2 (system operations) + CC7.3 (event evaluation)
- OWASP ASVS L2 V11.1 (anomaly detection)

---

## § Out-of-band Monitors (OBS-04 / OBS-06 / OBS-07 / OBS-08)

Phase 9: GCP-tier monitors and Sentry-side quota alert — defence-in-depth observability outside the Sentry SDK boundary.

**OBS-04 — Source-map upload + hidden source maps:** `@sentry/vite-plugin@5.2.1` registered conditionally in `vite.config.js` (`env.SENTRY_AUTH_TOKEN && command === "build"`) — short-circuits before plugin allocation on PR-validation runs (forks have no `SENTRY_AUTH_TOKEN`). EU region pinned at `url: "https://de.sentry.io/"`. `filesToDeleteAfterUpload: ["dist/**/*.map"]` cleans `.map` files post-upload; CI deploy + preview jobs add a second-layer `Assert no .map files served from dist (OBS-04 / Pitfall 6)` step that fails the deploy if any `.map` file survives (Pitfall 6 two-layer defence: plugin misconfig OR missing token both fail closed). Release-tagged with `process.env.GITHUB_SHA`.

**OBS-06 — GCP uptime check:** `scripts/setup-uptime-check/run.js` is an idempotent ADC-only script that shells out to `gcloud monitoring uptime create base-layers-diagnostic-prod --regions=USA,EUROPE,ASIA_PACIFIC --period=60s --timeout=10s --resource-type=uptime-url --resource-labels=host=baselayers.bedeveloped.com,project_id=bedeveloped-base-layers --protocol=https --request-method=get --path=/`. Idempotency via describe-first-then-create flow (`gcloud monitoring uptime list-configs` with `gcloud monitoring uptime list` fallback for older gcloud versions). Alerting policy posts to Slack via the same webhook channel as `authAnomalyAlert` (operator-paced — Step 3 of `runbooks/phase-9-monitors-bootstrap.md`).

**OBS-07 — GCP budget alerts:** `scripts/setup-budget-alerts/run.js` shells out to `gcloud billing budgets create` with 50% / 80% / 100% thresholds on a £100 GBP/month default (`BUDGET_AMOUNT` + `BUDGET_CURRENCY` env overrides). Alerts route to the billing-account-admin email.

**OBS-08 — Sentry quota alert:** Operator-set in the Sentry web UI at `Settings → Subscription → Usage Alerts` (3500 of 5000 events/month = 70% of the free-tier limit). Not scriptable from gcloud. Pinned in `runbooks/phase-9-sentry-bootstrap.md` Step 6 and verified at Wave 6 close-gate (`runbooks/phase-9-deploy-checkpoint.md` Step E screenshot).

**Substrate-honest disclosures (Pitfall 19):**

- **3-region uptime minimum** — `gcloud monitoring uptime create --regions` minimum is 3 (per Pattern 7 in 09-RESEARCH.md line 670); OBS-06's success criterion is ≥2. The script uses 3 (`USA,EUROPE,ASIA_PACIFIC`) — exceeds both. Surfaced in `scripts/setup-uptime-check/README.md` Limitations section + monitors-bootstrap runbook Step 3.
- **Budget alerts NOTIFY only — they do NOT cap spend.** Per Firebase + GCP documentation, billing budgets are an alerting mechanism, not a hard ceiling. Auto-disable via Pub/Sub-driven Cloud Function (the "avoid-surprise-bills" Firebase pattern) is OUT OF SCOPE for v1 (deferred to v2 per Pitfall 19). Surfaced in 3 places: `scripts/setup-budget-alerts/run.js` banner + README Limitations section + monitors-bootstrap runbook Step 4.
- **Sentry tunnel / ad-blocker workaround deferred to v2** — Sentry events may be blocked at the network layer by privacy-focused browser extensions. The `tunnel` config option (proxies events through a same-origin endpoint) is OUT OF SCOPE for v1; re-evaluate after first quarter of metrics shows ad-block ratio.

**Evidence:**

- Source-map plugin: `vite.config.js` `@sentry/vite-plugin` conditional registration
- Source-map CI gate: `.github/workflows/ci.yml` deploy + preview jobs `Assert no .map files` step
- Source-map drift test: `tests/build/source-map-gate.test.js` (5 static-source regex assertions)
- Uptime check script: `scripts/setup-uptime-check/run.js` + `scripts/setup-uptime-check/README.md`
- Budget alerts script: `scripts/setup-budget-alerts/run.js` + `scripts/setup-budget-alerts/README.md`
- Operator runbooks: `runbooks/phase-9-monitors-bootstrap.md` (6 steps for OBS-04/06/07/08) + `runbooks/phase-9-deploy-checkpoint.md` (5 verification gates A/B/C/D/E)
- Sentry quota alert: operator-set in Sentry web UI; Wave 6 close-gate screenshot evidence

**Framework citations:**

- OWASP ASVS L2 V14.2.4 (release artefact integrity / hidden source maps)
- ISO/IEC 27001:2022 A.5.6 (budget / quota controls) + A.8.16 (monitoring activities)
- SOC 2 CC7.2 (system operations monitoring)

---

## § Phase 9 Audit Index

Auditor walk-through pointer for Phase 9. Each row maps a Phase 9 control to its requirement ID, the code/config that implements it, the test or operator evidence that verifies it, and the framework citations it satisfies. Mirrors the §Phase 7 + §Phase 8 Audit Index shape. Substrate-honest (Pitfall 19): every Validated row has evidence pointers; PENDING-OPERATOR rows for OBS-04..08 are explicitly annotated — code + runbooks are committed, but operator deploy evidence (Slack reception screenshot, Cloud Console screenshots, `gcloud function describe` output, CI deploy logs) is gated on the single combined Wave 6 + Wave 7 operator session documented in `.planning/phases/09-observability-audit-event-wiring/09-06-DEFERRED-CHECKPOINT.md` (bundles Plan 09-05 Task 3b + Plan 09-06 Task 4).

| Requirement | Control | Code | Test / Evidence | Framework |
|-------------|---------|------|-----------------|-----------|
| OBS-01 | Sentry browser + node init with shared PII scrubber + `<redacted>` redaction contract | `src/observability/sentry.js`, `src/observability/pii-scrubber.js`, `functions/src/util/sentry.ts`, `functions/src/util/pii-scrubber.ts` | `tests/observability/sentry-init.test.js` (9), `tests/observability/pii-scrubber.test.js` (7), `functions/test/util/pii-scrubber-parity.test.ts` (parity gate), `functions/test/util/sentry.unit.test.ts` (Phase 7 contract updated) | ASVS V8.3.4; ISO A.5.10 + A.5.34; GDPR Art. 32 |
| OBS-02 | Sentry EU residency — DSN `*.ingest.de.sentry.io` + source-map upload to `https://de.sentry.io/` | `runbooks/phase-9-sentry-bootstrap.md` Step 2 (operator selects EU project); `vite.config.js` plugin `url: "https://de.sentry.io/"` | `runbooks/phase-9-deploy-checkpoint.md` Step E (Sentry Console screenshot showing EU region — **PENDING-OPERATOR DEPLOY** — see `09-06-DEFERRED-CHECKPOINT.md`) | GDPR Art. 32 + Art. 44 / Schrems II |
| OBS-03 | Fingerprint rate-limit at SDK boundary (10 events/fp/60s) before scrub | `src/observability/sentry.js` `fingerprintRateLimit()` | `tests/observability/sentry-init.test.js` Test 6 | ASVS V8.4.4 |
| OBS-04 | Source-map upload via `@sentry/vite-plugin` + hidden source maps two-layer defence | `vite.config.js` (conditional plugin); `.github/workflows/ci.yml` (deploy + preview jobs); `filesToDeleteAfterUpload: ["dist/**/*.map"]` | `tests/build/source-map-gate.test.js` (5 static assertions); CI deploy run log "Assert no .map files served from dist (OBS-04 / Pitfall 6)" step — **PENDING-OPERATOR DEPLOY** — see `09-06-DEFERRED-CHECKPOINT.md` for first deploy log evidence | ASVS V14.2.4 |
| OBS-05 | Auth-anomaly Slack alert via Cloud Function (4 rules; 2 FUNCTIONAL + 2 DORMANT) | `functions/src/observability/authAnomalyAlert.ts` (Rules 3+4 functional; Rules 1+2 DORMANT) | `functions/test/observability/authAnomalyAlert.test.ts` (6 behaviour tests); `tests/rules/authFailureCounters.test.js` (4 cells); `runbooks/phase-9-deploy-checkpoint.md` Step C synthetic Slack alert + Step D DORMANT Rule 1 burst test — **PENDING-OPERATOR DEPLOY** — see `09-06-DEFERRED-CHECKPOINT.md` for Slack reception screenshot | ISO A.5.25 + A.8.16; SOC2 CC7.2 + CC7.3; OWASP ASVS V11.1 |
| OBS-06 | GCP uptime check 3 regions / 60s / HTTPS GET / 10s timeout | `scripts/setup-uptime-check/run.js`; `runbooks/phase-9-monitors-bootstrap.md` Step 3 | `runbooks/phase-9-deploy-checkpoint.md` Step E (Cloud Console uptime-checks screenshot) — **PENDING-OPERATOR DEPLOY** — see `09-06-DEFERRED-CHECKPOINT.md` | ISO A.8.16; SOC2 CC7.2 |
| OBS-07 | GCP budget alerts 50% / 80% / 100% thresholds (£100 GBP default) | `scripts/setup-budget-alerts/run.js`; `runbooks/phase-9-monitors-bootstrap.md` Step 4 | `runbooks/phase-9-deploy-checkpoint.md` Step E (Cloud Console budgets screenshot); substrate-honest disclosure "alerts NOTIFY only; do not cap spend" — **PENDING-OPERATOR DEPLOY** — see `09-06-DEFERRED-CHECKPOINT.md` | ISO A.5.6 |
| OBS-08 | Sentry-side 70% free-tier quota alert (3500/5000 events/month) | `runbooks/phase-9-sentry-bootstrap.md` Step 6; `runbooks/phase-9-monitors-bootstrap.md` Step 5 | `runbooks/phase-9-deploy-checkpoint.md` Step E (Sentry Settings → Subscription → Usage Alerts screenshot) — **PENDING-OPERATOR DEPLOY** — see `09-06-DEFERRED-CHECKPOINT.md` | ISO A.5.6 |
| AUDIT-05 | View-side audit-event wiring (9 sites; client `.requested`) + server-side bare substrate (Plan 03a; 4 sites) + auditEventSchema 28 → 61 enum extension | `src/firebase/auth.js`, `src/cloud/{claims-admin,gdpr,soft-delete}.js`; `functions/src/audit/auditEventSchema.ts`; `functions/src/auth/{setClaims,beforeUserSignedIn}.ts`; `functions/src/lifecycle/{softDelete,restoreSoftDeleted,permanentlyDeleteSoftDeleted}.ts` | `tests/firebase/auth-audit-emit.test.js`; `tests/audit-wiring.test.js`; `functions/test/audit/auditEventSchema.unit.test.ts` (18); `functions/test/auth/{setClaims-audit-emit,beforeUserSignedIn-audit-emit}.test.ts`; `functions/test/lifecycle/*-audit-emit.test.ts` (5 files) | ASVS V8.4.x; ISO A.8.15 + A.8.16; SOC2 CC4.1 + CC7.2; GDPR Art. 30 + Art. 32(1)(d) |
| DOC-10 | Phase 9 incremental SECURITY.md (Pitfall 19) — 4 new sections + this 10-row Phase 9 Audit Index | This file — § Observability — Sentry + § Audit-Event Wiring + § Anomaly Alerting + § Out-of-band Monitors + § Phase 9 Audit Index | this commit; Phase 11 owns the canonical DOC-10 pass | ISO A.5.36 |

**Substrate-honest disclosure (Pitfall 19):** OBS-02 / OBS-04 / OBS-05 / OBS-06 / OBS-07 / OBS-08 are **code-and-docs complete** at Phase 9 close. Production deploy + first deploy log evidence + Slack reception screenshot + Cloud Console screenshots + Sentry Console screenshot are operator-deferred per the Wave 6 + Wave 7 batching pattern (mirrors `08-06-DEFERRED-CHECKPOINT.md`). The single combined operator session is documented in `.planning/phases/09-observability-audit-event-wiring/09-06-DEFERRED-CHECKPOINT.md`. Status reflects "code + substrate + runbooks authored; operator action pending for production evidence" — the same shape Phase 8 BACKUP-01..04 + BACKUP-07 used. Rules 1+2 of `authAnomalyAlert` are explicitly DORMANT (not skipped) — substrate is functional + tested; observation pipeline awaits emission-source landing (rejection-rule landing for Rule 1; MFA dep landing for Rule 2).

**Cross-phase plug-ins this index will feed:**

- **Phase 10** (HOST-06 / HOST-07 strict CSP) — mirror-trigger collision verification (1 alert per soft-delete cascade) deferred to Phase 10 synthetic-tests sub-wave (one observation per phase saves operator time); Sentry-tagged source-map stack traces land in Sentry once deploy runs, benefiting CSP tightening triage.
- **Phase 11** (DOC-02 / DOC-04 / DOC-09 evidence pack) — `PRIVACY.md` Sentry sub-processor row (EU residency); `CONTROL_MATRIX.md` rows for OBS-01..08 + AUDIT-05; `docs/evidence/` Sentry quota alert screenshot + Slack alert screenshot + uptime check screenshot + budget alert screenshot + first deploy log.
- **Phase 12** (WALK-02 / WALK-03) — audit-walkthrough cites Phase 9 Observability + Audit-Event Wiring + Anomaly Alerting + Out-of-band Monitors sections as ground truth.

---

## Compliance posture statement

This codebase aims for **credible, not certified** compliance with
SOC 2 Common Criteria 2017, ISO/IEC 27001:2022 Annex A, GDPR Article 32,
and OWASP ASVS 5.0 Level 2. Certification is a separate workstream
(see `.planning/PROJECT.md` "Out of Scope"). Each section above maps
controls to the specific framework citations they address; the canonical
mapping lives in `docs/CONTROL_MATRIX.md` (created Phase 11).
