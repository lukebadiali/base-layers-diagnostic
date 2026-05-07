# Phase 4: Modular Split + Quick Wins (Pure-Refactor Phase) - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Decompose `app.js` (5,289 lines, IIFE) into the post-Phase-4 source layout per `.planning/research/ARCHITECTURE.md` §2 — `firebase/` adapter (per-feature submodules: app/auth/db/storage/functions/check) + `data/*` per-collection wrappers (12) + `cloud/*` callable clients (5 — empty stub seams this phase) + `views/*` (12 view modules) + `ui/*` (dom/modal/toast/format/chrome/charts/upload) + `observability/*` (sentry/audit-events — empty stub seams this phase) + `state.js` + `router.js` + `main.js` — with lint-enforced dependency rules per ARCHITECTURE.md §2.4 (`domain/*` imports nothing Firebase; `views/*` may import `data/`, `domain/`, `auth/`, `ui/`, `cloud/` only). Land 11 quick wins (CODE-03..CODE-13) in the same window: 7 `alert()` → `notify()` toast; 17 `innerHTML=` → `replaceChildren()`; 4 `el.style.X` + the larger inline-style sweep → CSS classes; delete `html:` branch in `h()` (XSS regression test pins payloads); `crypto.randomUUID()` swap (CODE-03 — already extracted to `src/util/ids.js`); shared `renderConversation` for chat + funnel comments; client-side upload validation (≤25 MB + magic-byte MIME sniff + filename sanitisation); Chart.js CDN→npm (drops `cdn.jsdelivr.net` from CSP allowlist); Google Fonts CDN→self-hosted (drops `fonts.googleapis.com` + `fonts.gstatic.com`); tab-title unread badge memoisation; `formatWhen` `Math.floor` for monotonic; `rel="noopener noreferrer"` on download links; remove dead v1-migration path. Empty the cleanup ledger (`runbooks/phase-4-cleanup-ledger.md`) to zero rows. **Pure-refactor phase** — backend behaviour unchanged; snapshot baselines (Phase 2 D-08) at `tests/__snapshots__/views/{dashboard,diagnostic,report}.html` are the rendered-DOM contract.

**Explicitly NOT in this phase** (owned elsewhere):

- Subcollection migration of orgs/{id}.{responses,comments,actions,documents,messages} → top-level subcollections + `readStates/` collection → Phase 5 (DATA-01..06)
- H7 fix (server-clock readStates) and H8 fix (cloud-sync merge algorithm) → Phase 5 (DATA-07 + cloud-sync rewrite); Phase 4 preserves the regression baseline established in Phase 2
- `firestore.rules` + `storage.rules` authoring → Phase 5 (RULES-01..06)
- Real Auth (Email/Password + claims + MFA + Anonymous Auth disable) → Phase 6; `src/auth/state-machine.js` is deleted by Phase 6 (AUTH-14), not modified by Phase 4
- App Check enrolment with reCAPTCHA Enterprise → Phase 7 (FN-04); Phase 4 ships `firebase/check.js` as a no-op stub
- Cloud Functions bodies (`auditWrite`, `setClaims`, mirror Firestore-trigger audit writers, rate-limit infrastructure) → Phase 7; Phase 4 ships `cloud/*` as empty stub seams
- Sentry browser/node init + PII scrubber + EU residency → Phase 9; Phase 4 ships `observability/sentry.js` as a no-op stub
- Audit-event wiring in `views/*` → Phase 9 (AUDIT-05); Phase 4 ships `observability/audit-events.js` as a no-op stub for the constants table
- Strict-CSP enforcement (drop `style-src 'unsafe-inline'`) → Phase 10 (HOST-07); Phase 4's inline-style sweep (CODE-06) is the precondition
- HSTS preload submission → Phase 10 (HOST-06)

**Pre-flight gates** (planner must include):

1. Verify `src/auth/state-machine.js` test suite still green AFTER firebase/ adapter lands (Wave 1) — the auth tests use the real `crypto.subtle.digest` from happy-dom and are independent of the adapter, but verify.
2. Verify Phase 2 snapshot baselines at `tests/__snapshots__/views/{dashboard,diagnostic,report}.html` produce zero diff after Wave 1 (firebase/ adapter) lands — the boot path changed but the rendered HTML must not.
3. Verify Chart.js version pin against `.planning/research/STACK.md` before adding to package.json (D-08); pin must align with the SDK 12.x compatibility envelope.
4. Verify Inter (or current Google Fonts choice — codebase scout to confirm) is licensed for self-hosting (Inter is OFL — clear; verify if a different font is in use).
5. Confirm `index.html` still has no `<meta http-equiv="Content-Security-Policy">` tag at Wave 1 entry (T-3-meta-csp-conflict regression guard) — this is the precondition for Wave 1's `tests/index-html-meta-csp.test.js` landing.

</domain>

<decisions>
## Implementation Decisions

### Wave Shape & Cutover (Area 1)

- **D-01:** **Pattern A — boundaries-first, 5–6 waves.** Wave 1: `firebase/` adapter (replaces `firebase-init.js`'s `window.FB`-shaped export with per-feature submodules) + meta-CSP regression test (T-3-meta-csp-conflict closure). Wave 2: `ui/` (dom + modal + toast + format + chrome + charts + upload) + delete `html:` branch in `h()` (CODE-04) + XSS regression test. Wave 3: `data/*` per-collection wrappers (all 12 — see D-09). Wave 4: `views/*` (12 views in dependency order) with quick-wins folding into the wave that touches each view's code (see D-20). Wave 5: `state.js` + `router.js` + `main.js`; `app.js` dies (see D-03). Wave 6: cleanup — flip `no-restricted-imports` per-rule to `error` (see D-04), CDN→npm Chart.js + Google Fonts self-host (see D-08), `formatWhen` `Math.floor` (CODE-11), dead v1-migration code (CODE-13), per-directory coverage thresholds extended (see D-21), cleanup-ledger zero-out, SECURITY.md final DOC-10 increment for the phase. The 6-wave shape is reviewable: each wave has one coherent boundary or area; each commit closes one CODE-* requirement (Phase 1 D-25 atomic-commit pattern).
- **D-02:** **`state.js` + `router.js` + `main.js` extract LAST (Wave 5), after all 12 views.** The IIFE retains its `state` object + `render()` dispatcher until every view has been pulled out; each extracted view is called from the IIFE's dispatcher with `state` injected (Pattern D from Phase 2 — DI substitute for closure capture). When the last view lands, state.js + router.js + main.js extract together as the final module trio. Lowest-risk against snapshot baselines: the dispatcher shape never changes mid-flight; rendered DOM stays byte-stable until the cutover commit.
- **D-03:** **`app.js` dies in one final commit.** Wave 5's terminal commit deletes `app.js` entirely + flips `index.html` `<script src>` from `./app.js` to `./src/main.js` + removes Phase 2 D-04's bridge comment. One reviewable cutover commit; pre/post snapshot baseline diff is the verification gate. `app.js`'s `// @ts-nocheck` cleanup-ledger row (Phase 1) closes in the same commit. The IIFE thins gradually as Waves 1–4 extract modules (re-imports stay in app.js); Wave 5's commit is what makes the file vestigial and deletes it.
- **D-04:** **ESLint `no-restricted-imports` flips per-wave from `warn` to `error` as boundaries land.** Wave 1 closes `firebase/firestore | firebase/storage | firebase/auth | firebase/app-check` (only `firebase/*` may import them). Wave 2 closes `domain/* → firebase/*` (`domain/` already has zero Firebase imports per Phase 2 D-03 — this is the lint codification). Wave 3 closes `data/* → only firebase/db.js + firebase/storage.js` (no direct firestore/storage SDK imports outside the adapter). Wave 4 closes `views/*` import-rule pattern: views/ may import `data/`, `domain/`, `auth/`, `ui/`, `cloud/`; views/ may NOT import `firebase/*` directly. By Wave 4 close every boundary in ARCHITECTURE.md §2.4 is `error`. Cleanup-ledger row "no-restricted-imports warn→error" closes incrementally — ledger gets per-wave checkbox closure. `eslint-plugin-boundaries` deferred unless per-wave hardening proves brittle (no current evidence it will).

### `firebase/` Adapter Shape + CDN Cleanup (Area 2)

- **D-05:** **Per-feature submodules per ARCHITECTURE.md §2.2.** `firebase/app.js` (initializeApp + App Check init slot, exports `app`) + `firebase/auth.js` (Auth instance + signIn/signOut/multiFactor helpers — multiFactor is a Phase 6 wiring; Phase 4 ships the placeholder helper signatures) + `firebase/db.js` (Firestore instance + `doc/collection/onSnapshot` wrappers; the `onSnapshot` wrapper is what `data/*` `subscribe*` helpers compose) + `firebase/storage.js` (Storage instance + `uploadBytesResumable` wrapper) + `firebase/functions.js` (Functions instance + `httpsCallable` wrapper) + `firebase/check.js` (App Check init — see D-07). Each submodule's import surface is the firebase SDK 12.x — ESLint `no-restricted-imports` (D-04) lets only `firebase/*` files through. Audit narrative: "every Firestore write goes through `data/*`, which goes through `firebase/db.js`, which goes through the SDK." The existing root-level `firebase-init.js` is **deleted** in Wave 1 — its config object moves into `firebase/app.js`.
- **D-06:** **Eager synchronous init at module load.** `firebase/app.js` runs `initializeApp(config)` → `initAppCheck(app)` (Phase 4 = no-op stub per D-07; Phase 7 = real reCAPTCHA Enterprise call) → `getAuth(app) | getFirestore(app) | getStorage(app) | getFunctions(app)` in order, exports `app | auth | db | storage | functions` as synchronous values. `main.js` imports `firebase/app.js` as its very first import to guarantee init runs before any `data/*` or `views/*` code touches the SDK. Phase 7's reCAPTCHA Enterprise wiring drops into the existing `initAppCheck` slot — zero adapter-shape change between phases.
- **D-07:** **App Check is an empty no-op stub Phase 7 fills in.** `firebase/check.js` exists as `export function initAppCheck(app) { /* Phase 7 (FN-04): replace with initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true }) */ }` — a documented seam that does nothing today. Phase 7 replaces the body without changing the import surface, the firebase/ directory shape, or the lint config. Cleanup ledger gets a row "Phase 7 wires App Check body in firebase/check.js" — closes at Phase 7. Same stub pattern as `cloud/*` and `observability/*` per D-11.
- **D-08:** **Chart.js → `ui/charts.js` wrapper (npm import); Google Fonts self-hosted; CSP allowlist drops three CDN entries.** Add `chart.js@4.x` to `package.json` (ESM import — verify exact pin against `.planning/research/STACK.md`). Create `ui/charts.js` exporting a configured-Chart factory that applies brand colors via CSS custom properties (decouples Chart.js options from CODE-06's inline-style sweep — chart colors live in `:root { --chart-color-primary: ... }` etc., not in Chart.js options literals). Self-host the Google Font (Inter or current — codebase scout to confirm) by downloading woff2 files into `assets/fonts/` and switching `styles.css` to local `@font-face` declarations. Removes `https://cdn.jsdelivr.net`, `https://fonts.googleapis.com`, `https://fonts.gstatic.com` from CSP allowlist (closes 3 of Phase 3 D-07's marked-temporary entries; Phase 10 strict-CSP scope shrinks accordingly). Wave 1 lands the migration; the CSP edits land in the same commit per Phase 1 D-25 atomic-commit pattern. Cleanup-ledger row "Wave 1 CDN divergence" (already queued from Phase 3) closes here.

### `data/*` Scope vs Phase 5 Collision (Area 3)

- **D-09:** **All 12 `data/*` wrappers ship in Phase 4; Phase 5 rewrite-targets are thin pass-throughs.** Wave 3 ships: orgs, users, responses, comments, actions, documents, messages, roadmaps, funnels, funnel-comments, audit-events, allowlist (12 total). The 6 stable wrappers (orgs, users, roadmaps, funnels, funnel-comments, allowlist) own their full read/write logic. The 6 Phase-5-rewrite-targets (responses, comments, actions, documents, messages — plus the soon-to-exist `readStates/` seam) are minimal pass-throughs delegating to `data/orgs.js`'s nested-map reads/writes (today's `orgs/{id}.{collection}[…]` shape). Phase 5 (DATA-01..06) replaces those bodies with subcollection access (`orgs/{orgId}/{collection}/{itemId}` shape). The API surface stays stable across the cutover — `views/*` never re-extract their consumption pattern. Cleanup ledger gets one row per pass-through: "Phase 5 replaces body with subcollection access; data/*.js API stable" — 6 rows that close at Phase 5.
- **D-10:** **API shape — Promise CRUD + onSnapshot helpers.** Each wrapper exports Promise-returning one-shot functions (e.g., `getOrg(orgId): Promise<Org>`, `listOrgs(): Promise<Org[]>`, `saveOrg(org): Promise<void>`, `deleteOrg(orgId): Promise<void>`) AND `subscribeOrgs({ onChange, onError }): () => void` returning an unsubscribe fn. Live views compose `subscribe*`; one-shot reads/writes use the Promise CRUD pattern. The `onSnapshot` SDK wrapper stays localised in `firebase/db.js` (per D-05). Mirrors the `firebase/db.js` `onSnapshot` wrapper — `data/*` doesn't re-implement subscription mechanics, just narrows the type and adds collection-specific normalisation.
- **D-11:** **`cloud/*` + `observability/*` ship as empty stub seams in Phase 4.** Wave 3 (or alongside, planner's call) lands: `cloud/audit.js`, `cloud/soft-delete.js`, `cloud/gdpr.js`, `cloud/claims-admin.js`, `cloud/retry.js`, `observability/sentry.js`, `observability/audit-events.js` — each a file with documented no-op exports. Phase 7 fills `cloud/audit.js` + `cloud/retry.js` + `observability/audit-events.js` (constants table); Phase 8 fills `cloud/soft-delete.js` + `cloud/gdpr.js`; Phase 9 fills `observability/sentry.js`. Phase 4's directory tree matches ARCHITECTURE.md §2 in full. Cleanup ledger gets one row per stub — closes at the phase that fills the body. Same pattern as `firebase/check.js` (D-07).
- **D-12:** **Faithful extraction — wrap, don't refactor.** Each `data/*` wrapper preserves the IIFE's exact read/write semantics so snapshot baselines (Phase 2 D-08) stay stable. If a wrapper signature would force a behavioural change, preserve the side effect verbatim and log a cleanup-ledger row "Phase 4 candidate cleanup: simplify after Phase 5 lands" (mirrors Phase 2 D-05's "no improve while extracting" extended one phase further — Phase 4 is the modular split phase, not the rewrite phase). Improvements (sort, dedup, normalisation) defer to a follow-up commit AFTER each wave's snapshot diff lands at zero; the snapshot baseline is the regression-detection contract through Phase 5+.

### Toast + Upload UX (Area 4)

- **D-13:** **`ui/toast.js` exports `notify(level, message, opts?)` with 4 levels + tinted bg + Unicode symbols.** Levels = `info` | `success` | `warn` | `error`. Visual = neutral 1px border + tinted background per level via CSS custom properties (`--toast-bg-info: ...` etc.) so colors are theme-able and decoupled from CODE-06's inline-style sweep. Symbols via Unicode (✓ ⚠ ⓘ ✕) — no icon-font dependency. Each toast renders into a `#toastRoot` container appended once to `<body>`. `error` toasts get `role="alert"` (interrupts AT immediately); `info | success | warn` get `role="status"` (announces non-interruptingly). Replaces 7 `alert()` sites at app.js (current count); Wave 4 wires per-view as views extract. ARCHITECTURE.md §2 helpers table also names `ui/modal.js` for `modal/promptText/confirmDialog` — those are for new modal patterns; today's IIFE has zero `confirm()`/`prompt()` calls (verified by grep), so `ui/modal.js` ships only the existing custom modal helper (lines 629–684 per ARCHITECTURE.md helpers table). CODE-07 closes when all 7 `alert()` sites are gone.
- **D-14:** **Top-right + tiered auto-dismiss + sticky errors.** Stack vertically in top-right corner (16px from page edges; mobile breakpoint shifts to top-center with full-width minus 16px). Auto-dismiss: `info` 4s, `success` 4s, `warn` 7s, `error` ∞ (manual close required — visible × button). Max 3 visible at once; oldest auto-dismissable removed when a 4th arrives. Errors never queue-evict another error — error stack max is 3. Pause-on-hover for any non-error timer (a11y win — gives screen-reader users time to consume). Mobile: swipe-to-dismiss. Focus: don't steal focus on `info`/`success`; do focus the close button on `error` (helps keyboard users dismiss).
- **D-15:** **Upload validation runs in `ui/upload.js` BEFORE `data/documents.js`; views/ own the error path.** New helper `validateUpload(file, opts?): Promise<{ ok: true, sanitisedName: string } | { ok: false, reason: string }>` lives at `src/ui/upload.js`. Views/ call it on the File from the input change event; on `ok: false`, view emits `notify('error', reason)` and aborts (no Storage write attempted). On `ok: true`, view passes the validated File + `sanitisedName` to `data/documents.js`'s `saveDocument(file, sanitisedName, meta)` wrapper — which **does NOT re-validate** (trust boundary at `ui/upload.js`; data tier trusts the contract). Same helper exposed for any future upload site (chat attachments, profile avatars). Test target: `ui/upload.js` gets full unit coverage at the 100% `ui/**` threshold (D-21); `data/documents.js` is tested at the data/** 95% threshold for non-file paths. Server-side enforcement of size/MIME/filename remains Phase 5's `storage.rules` job + Phase 7's callable validation — Phase 4's client-side check is the UX-feedback layer + the audit-narrative client-side claim, not the trust boundary.
- **D-16:** **MIME check = magic-byte sniff first 32 bytes + declared `file.type` cross-check; allowlist {PDF, JPEG, PNG, DOCX, XLSX, TXT}.** `validateUpload` reads the first 32 bytes via `await file.slice(0, 32).arrayBuffer()`, matches a fixed signature table:
  - PDF: `25 50 44 46 2D` (`%PDF-`) — `application/pdf`
  - JPEG: `FF D8 FF` — `image/jpeg`
  - PNG: `89 50 4E 47 0D 0A 1A 0A` — `image/png`
  - DOCX/XLSX: `50 4B 03 04` (ZIP container — disambiguate via `file.type` for DOCX vs XLSX) — `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `...spreadsheetml.sheet`
  - TXT: no magic bytes — accept if `file.type === 'text/plain'` AND filename ends in `.txt` AND content is valid UTF-8 in the first 32 bytes (no `\x00`)
  Then cross-check declared `file.type` against the allowed MIME set; mismatch → reject with `reason: "File type mismatch — declared {file.type} but content looks like {detected}"`. Filename sanitisation per CODE-09 spec verbatim: `String(name).replace(/[^\w.\- ]/g, '_').slice(0, 200)`. Size cap 25 MB locked by CODE-09. Closes CONCERNS H6 client-side end-to-end with a defensible audit-narrative ("client validates declared+actual MIME, not just declared"). Allowlist constant lives in `ui/upload.js` and is exported so server-side rules (Phase 5 storage.rules) and Phase 7 callable validation can reference the same source of truth — single allowlist, multiple enforcement points.

### Cross-Cutting (carry-forward + derived)

- **D-17:** **Cleanup ledger zero-out gates phase close.** Phase 4 close is gated on `runbooks/phase-4-cleanup-ledger.md` "Suppressions" table containing **zero rows** (16 active rows at phase entry: 14 ESLint disables + 2 `@ts-nocheck`). Each wave closes its rows in the same commit as the corresponding code change (Phase 1 D-25 atomic-commit). The "Out-of-band soft-fail" table also has Phase 4 rows: `no-restricted-imports` `warn`→`error` (closes per D-04 across waves), Phase 3 GH-Pages rollback substrate (closes via cutover_date+14 calendar trigger — orthogonal to Phase 4 work but the calendar tick may land mid-Phase-4), Phase 3 meta-CSP regression guard (closes via D-18). New informational rows added by Phase 4 (per-stub Phase 7/8/9 rewrite trackers per D-07, D-09, D-11) are accepted — those are forward-tracking, not leftover-from-Phase-1 suppressions.
- **D-18:** **`tests/index-html-meta-csp.test.js` lands in Wave 1.** Closes the Phase 3 cleanup-ledger row "T-3-meta-csp-conflict regression guard". Test reads `index.html` and asserts no `<meta http-equiv="Content-Security-Policy">` tag exists; mirrors the schema-test pattern from Phase 3's `tests/firebase-config.test.js`. Lands in Wave 1 because Wave 1 is the first wave that touches `index.html` (the script-src flip from `./app.js` to `./src/main.js` lands in Wave 5 — but Wave 1 introduces the firebase-init.js→firebase/app.js path which may also touch index.html if any boot-time tags reference firebase-init.js directly). Optional Husky pre-commit grep complement is Claude's discretion.
- **D-19:** **Per-wave SECURITY.md DOC-10 increment per Phase 1 D-25 atomic-commit.** Each wave's commits append the relevant SECURITY.md paragraph in the same commit as the code change — never as a separate "docs catch-up" commit. Wave 1: § HTTP Security Headers gets a one-paragraph "CSP allowlist tightening: cdn.jsdelivr.net + fonts.googleapis.com + fonts.gstatic.com removed via Chart.js npm import + Google Fonts self-host (CODE-01 + ARCHITECTURE.md §2)". Wave 2: § Build & Supply Chain gets a paragraph on the `html:` deletion + XSS regression test (CODE-04). Wave 4: § Data Handling gets a paragraph on the upload validation client-side narrative (CODE-09; cite OWASP ASVS V12.1, ISO 27001:2022 A.8.24, SOC2 CC6.1). Wave 6 (cleanup): § Code Quality + Module Boundaries gets the modular-split + lint-enforced-boundaries narrative (CODE-01 + CODE-02; cite OWASP ASVS V14.2, ISO 27001:2022 A.8.28, SOC2 CC8.1).
- **D-20:** **Quick-wins fold into the wave that touches their code.** Mapping:
  - **CODE-03** (`crypto.randomUUID()` swap) — already extracted to `src/util/ids.js` (Phase 2 D-02); Wave 1 swaps the `Math.random()` body inside the existing module + closes the cleanup-ledger row at `src/util/ids.js:7`.
  - **CODE-04** (delete `html:` branch in `h()` + XSS regression test) — Wave 2 (`ui/dom.js` extraction); the XSS test asserts `<script>` and `<img onerror>` payloads are rendered as text content. Closes ledger row `app.js:676` (`no-unsanitized/property` disable).
  - **CODE-05** (17 `innerHTML=` → `replaceChildren()`) — per-view in Wave 4 as each view extracts.
  - **CODE-06** (inline-style sweep — 4 `.style.X=` sites + Chart.js color overrides + any `style="..."` survivors) — per-view in Wave 4 as each view extracts; Wave 6 cleanup consolidates new classes into `styles.css` and verifies zero remaining via grep.
  - **CODE-07** (alert→toast, 7 sites) — Wave 2 ships `ui/toast.js`; per-view wires `notify('error', ...)` in Wave 4. Closes when all 7 `alert()` sites are gone.
  - **CODE-08** (shared `renderConversation` for chat + funnel) — Wave 4 in the wave that extracts the second of (chat view, funnel view) — whichever comes first creates the helper, the second consumes it.
  - **CODE-09** (upload validation) — Wave 4 documents view extraction (uses `ui/upload.js` shipped in Wave 2).
  - **CODE-10** (tab-title unread badge memoisation) — Wave 4 in the view that owns title updates (likely chat or dashboard).
  - **CODE-11** (`formatWhen` `Math.floor` for monotonic) — Wave 6 cleanup (touches `src/util/ids.js`).
  - **CODE-12** (`rel="noopener noreferrer"` on download links) — per-view in Wave 4 (documents view + any others with download anchors).
  - **CODE-13** (dead v1-migration code removal) — Wave 6 cleanup (touches `src/data/migration.js`); requires verifying via flag/code path that v1 is dead before removal — do not delete reactively.
- **D-21:** **Per-directory coverage thresholds extend Phase 2 D-15.** Wave 6 final commit updates `vite.config.js` `test.coverage.thresholds`:
  - `src/domain/**`: 100% (unchanged from Phase 2 D-15)
  - `src/util/**`: 100% (unchanged)
  - `src/auth/**`: 95% (unchanged — Phase 6 deletes this dir per AUTH-14)
  - `src/data/**`: **raise to 95%** (was 90% in Phase 2 D-15; D-12 faithful-extraction + the new pass-through wrappers per D-09 should hit this comfortably)
  - `src/ui/**`: **100%** (pure DOM helpers — dom/modal/toast/format/chrome/charts/upload — fully unit-testable; the 100% target enforces the trust-boundary discipline of D-15)
  - `src/views/**`: **80%** (renderers are hard; 80% balances coverage vs the rendered-DOM snapshot tests which cover the hard paths separately)
  - `src/firebase/**`: **excluded** (adapter — exercised via integration through `data/*` tests; mocking the SDK to test the adapter would test the test)
  - `src/cloud/**`: **excluded in Phase 4** (empty stubs per D-11); Phase 7 sets thresholds when real bodies land
  - `src/observability/**`: **excluded in Phase 4** (empty stubs per D-11); Phase 9 sets thresholds when Sentry init lands
  - `src/state.js`, `src/router.js`, `src/main.js`: **90%** (boot infrastructure — the dispatcher branches are testable via snapshot fixtures)
  - Global threshold: not set (would fail because firebase/ + cloud/ + observability/ are excluded by design)

### Folded Todos

None — `STATE.md` "Outstanding Todos" all reference later phases (5, 6, 7, 9, 11, 12). The Firestore-region todo originally targeting Phase 6/11 was already folded into Phase 3 D-06 as a pre-flight; resolution is operator-deferred (`03-PREFLIGHT.md ## Firestore Region`) but does not block Phase 4.

### Claude's Discretion

- Exact CSS class naming convention for the inline-style sweep (CODE-06) — BEM-ish vs utility vs descriptive; planner picks based on existing `styles.css` patterns surfaced during Wave 1 codebase scout.
- Order in which the 12 views extract within Wave 4 — likely dependency order (deepest leaf first); planner sequences by inspecting view-to-data dependency.
- Exact API signatures of the 12 `data/*` wrappers — planner derives from current IIFE consumption patterns; D-10 fixes the shape (Promise CRUD + `subscribe*`) but not the parameter list.
- Whether `ui/charts.js` exposes a Chart factory function or a thin wrapper around `new Chart(ctx, options)` — implementation choice.
- The exact Husky pre-commit grep complement to `tests/index-html-meta-csp.test.js` (D-18) — Claude's discretion.
- Toast container DOM shape (`<div id="toastRoot">` vs `<aside aria-live="polite">`) — implementation detail consistent with D-13's a11y intent.
- Whether to add `inert` attribute support on background content during error toasts — defer unless required by a future a11y audit.
- Exact magic-byte signature for "TXT" type — D-16 specifies "no magic bytes; UTF-8 + extension"; planner may refine.
- Filename collision handling in upload validation (e.g., `report (1).pdf`) — Storage path uniqueness already comes from the doc ID; collision-on-display is a UX concern, not a Phase 4 concern.
- Snapshot fixture extension for state.js + router.js + main.js extraction (Wave 5) — Phase 2 D-10's `snapshot-org.json` fixture should still drive the 3 view snapshots; Wave 5 verification = same fixture, no diff vs Phase 2 baselines.
- Per-view-test snapshot files — Wave 4 may produce additional view-level snapshot files (e.g., `tests/__snapshots__/views/chat.html`, `pillar.html`) once views are extracted and individually-testable; planner decides scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context

- `.planning/PROJECT.md` — Active milestone, Locked Decisions ("Stay on vanilla JS"; "No backwards-compat window — clean cutover acceptable"), Constraints
- `.planning/REQUIREMENTS.md` §"Code Quality (CODE)" — CODE-01 through CODE-13 acceptance criteria
- `.planning/REQUIREMENTS.md` §"Documentation Pack (DOC)" — DOC-10 incremental requirement
- `.planning/ROADMAP.md` §"Phase 4: Modular Split + Quick Wins (Pure-Refactor Phase)" — Goal + Success Criteria + Dependencies + UI hint = yes
- `.planning/ROADMAP.md` §"Granularity Rationale" #1 — Tests-first before modular split (Phase 2 → Phase 4 sequencing constraint)
- `.planning/STATE.md` §"Sequencing Non-Negotiables" — tests-first / rules-deploy / subcollection-first / hosting-first
- `CLAUDE.md` — Source layout target ("post-Phase 4: firebase/ + data/* + domain/* + auth/* + cloud/* + views/* + ui/* + observability/*; domain/* files import nothing from Firebase (lint-enforced)"), Conventions, Sequencing Non-Negotiables

### Architecture (load-bearing for Phase 4)

- `.planning/research/ARCHITECTURE.md` §1 (Logical layers + Component responsibilities) — target end-state semantics every Phase 4 decision aligns with
- `.planning/research/ARCHITECTURE.md` §2 — **load-bearing.** Recommended source layout (every directory in D-01..D-21 traces to this) + Helpers placement table (D-13's `ui/toast.js` slot, D-15's `ui/upload.js` slot, D-08's `ui/charts.js` slot all in this table) + Module dependency rules §2.4 (D-04's lint flips codify these rules)
- `.planning/research/ARCHITECTURE.md` §2.2 — per-feature `firebase/` submodules (D-05 verbatim source)
- `.planning/research/ARCHITECTURE.md` §4 (Firestore data model) — Phase 5 subcollection split rationale (D-09's pass-through pattern reduces Phase 5 churn)

### Pitfalls (load-bearing)

- `.planning/research/PITFALLS.md` §Pitfall 9 — **load-bearing.** Tests-first sequencing; the strangler-fig precedent in Phase 2 enables Phase 4's bottom-up wave shape (D-01); D-12 "no improve while extracting" extends Phase 2 D-05's Pitfall 9 step 2 discipline.
- `.planning/research/PITFALLS.md` §Pitfall 14 — Vite + base path (every npm-imported module + Vite-bundled font/Chart.js validates this; D-08 closes the CDN exceptions surfaced here)
- `.planning/research/PITFALLS.md` §Pitfall 16 — CSP three-stage rollout (D-08 Wave 1 CSP allowlist tightening is the precondition for Phase 10's HOST-07 strict-CSP enforcement)
- `.planning/research/PITFALLS.md` §Pitfall 19 — incremental SECURITY.md updates (D-19 atomic-commit pattern)

### Research

- `.planning/research/SUMMARY.md` §"Phase 4: Modular Split + Quick Wins (Pure-Refactor Phase)" — phase rationale, scope statement (matches D-01..D-21)
- `.planning/research/SUMMARY.md` §"Compliance Mapping Cheat-Sheet" — citations for D-19 SECURITY.md updates (OWASP ASVS V12.1 / V14.2, ISO 27001:2022 A.8.24 / A.8.28, SOC2 CC6.1 / CC8.1)
- `.planning/research/STACK.md` — exact 2026 versions (Chart.js npm pin verification per D-08; Inter or current Google Fonts choice per D-08)
- `.planning/research/FEATURES.md` — table-stakes features that map to view extractions in Wave 4

### Codebase Map (analysis dated 2026-05-03)

- `.planning/codebase/STRUCTURE.md` — current flat layout; Phase 4 transforms it
- `.planning/codebase/CONVENTIONS.md` — coding style preserved during extraction (CSS class naming for D-08 + CODE-06 inline-style sweep grounds in this)
- `.planning/codebase/CONCERNS.md` §H1 — modular split (closed by Phase 4 CODE-01); §H6 — file upload (closed client-side by CODE-09 + D-15 + D-16); §M2 — innerHTML clearings (closed by CODE-05); §M3 — alert() (closed by CODE-07); §M5 — inline styles (closed by CODE-06; precondition for HOST-07); §M8 — chat/funnel duplication (closed by CODE-08); §M9 — tab-title rewrites (closed by CODE-10); §C4 — html: escape hatch (closed by CODE-04); §H5 — CSPRNG (closed by CODE-03 swap)
- `.planning/codebase/INTEGRATIONS.md` — current Firebase project + CDN endpoints (D-08 removes the CDN entries from CSP allowlist after npm migration)
- `.planning/codebase/ARCHITECTURE.md` — current `app.js` IIFE structure; Phase 4 dismantles

### Phase Carry-Forward (already locked, do not re-derive)

- `.planning/phases/01-engineering-foundation-tooling/01-CONTEXT.md` D-25 — atomic-commit pattern (D-19 here)
- `.planning/phases/01-engineering-foundation-tooling/01-CONTEXT.md` D-09 — CI hard-fail policy
- `.planning/phases/02-test-suite-foundation/02-CONTEXT.md` D-04 — `index.html` already on `<script type="module">`; Phase 4 changes only the `src` attribute (D-03)
- `.planning/phases/02-test-suite-foundation/02-CONTEXT.md` D-05 — "no improve while extracting" extends to Phase 4 (D-12)
- `.planning/phases/02-test-suite-foundation/02-CONTEXT.md` D-08 — snapshot baselines at `tests/__snapshots__/views/{dashboard,diagnostic,report}.html` are the rendered-DOM contract Phase 4 must preserve
- `.planning/phases/02-test-suite-foundation/02-CONTEXT.md` D-15 — tiered coverage thresholds (D-21 here extends to new dirs)
- `.planning/phases/03-hosting-cutover-baseline-security-headers/03-CONTEXT.md` D-07 — CSP CDN allowlist marked temporary; D-08 here closes 3 of the temporary entries
- `.planning/phases/03-hosting-cutover-baseline-security-headers/03-CONTEXT.md` `<preflight_addendum>` — Wave 1 CDN divergence row queued for Phase 4 cleanup; D-08 closes
- `runbooks/phase-4-cleanup-ledger.md` — 16 active suppression rows + 6 informational rows; D-17 zeros it out at phase close

### Audit Framework

- `SECURITY_AUDIT.md` (project root) §A03 (CI/CD), §A04 (Dependencies), §A05 (Code Quality) — checklist items Phase 4 closes (modular boundary + lint enforcement + XSS regression test)
- `SECURITY_AUDIT.md` §0(4) — "no weakening of controls to make tests/features pass" — applies to coverage threshold extensions (D-21) + the snapshot baseline preservation policy (D-12)

### Compliance Citations (for `SECURITY.md` D-19 updates)

- OWASP ASVS L2 v5.0 — V5.3 (Output Encoding / XSS prevention — CODE-04), V12.1 (File Uploads — CODE-09 client-side), V14.2 (Dependencies — npm migration), V14.7 (Build & Deploy)
- ISO/IEC 27001:2022 Annex A — A.8.24 (Use of cryptography — CSPRNG via CODE-03), A.8.28 (Secure coding — modular boundary + lint enforcement), A.13.1.3 (Network segregation — CSP allowlist tightening)
- SOC 2 CC6.1 (Logical access — boundary enforcement via lint), CC8.1 (Change management — atomic commits)
- GDPR Art. 32(1)(b) (Confidentiality of processing — XSS prevention), 32(1)(d) (Testing/evaluating effectiveness — coverage thresholds + XSS regression test)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`firebase-init.js`** (existing root-level ES module) — closest pre-existing analogue of the `firebase/` adapter D-05 lands. Contents (config object + window.FB-style export) move into `firebase/app.js`; the root file is **deleted** in Wave 1. Phase 1 codebase scout flagged this as the eventual `firebase/` adapter.
- **`src/util/ids.js`** (Phase 2 D-02) — `uid` already extracted; CODE-03 swap (Math.random → crypto.randomUUID) is a body-only change in this module + closure of cleanup-ledger row at `src/util/ids.js:7`.
- **`src/util/hash.js`** (Phase 2 D-02) — `hashString` extracted; Phase 6 (AUTH-14) deletes the whole module. Phase 4 doesn't touch.
- **`src/domain/{banding,scoring,completion,unread}.js`** + **`src/data/{migration,cloud-sync}.js`** + **`src/auth/state-machine.js`** (Phase 2 D-02) — all already in target Phase 4 layout. Phase 4 doesn't move these; the JSDoc-was-`any` rows in the Phase 2 cleanup ledger close as Phase 4 lands an `Org` shape (Claude's discretion D-12 — defer unless trivial; Phase 5's subcollection rewrite may force the shape change naturally).
- **`data/pillars.js`** (existing root-level ES module) — static leaf data. ARCHITECTURE.md keeps it as the reference data shape; Phase 4 may move it to `src/data/pillars.js` for consistency, or leave at root (Claude's discretion). The data itself doesn't change.
- **`src/data/cloud-sync.js`** + **`src/domain/unread.js`** — Phase 5 rewrites these (H7 + H8 fixes). Phase 4 doesn't pre-empt; D-12 keeps faithful extraction.
- **`tests/__snapshots__/views/{dashboard,diagnostic,report}.html`** (Phase 2 D-08) — rendered-DOM contract; Phase 4 verification = `git diff` shows zero against these.
- **`tests/mocks/firebase.js`** (Phase 2 D-11 reusable factory) — already designed to mock either the SDK directly OR the firebase/ adapter. Wave 3 onwards re-targets the `vi.mock` path from `firebase/firestore` to `../firebase/db.js` etc. The factory itself doesn't change.
- **`vite.config.js`** (Phase 2) — coverage thresholds extension (D-21) is a one-file edit; the `test.coverage.thresholds` object grows new entries.
- **`runbooks/phase-4-cleanup-ledger.md`** — the canonical work-tracker; D-17 gates phase close on this being empty.
- **`SECURITY.md`** — Phase 1 + Phase 2 + Phase 3 each appended sections; Phase 4 appends per D-19 atomic-commit pattern.

### Established Patterns (carried forward)

- **Atomic commits per requirement** (Phase 1 D-25 / Phase 2 D-21 / Phase 3 D-15) — D-19 here applies to every CODE-* requirement
- **Pinned versions, no rolling-`latest`** (Phase 1 D-01) — D-08's `chart.js@4.x` adds with an exact pin against STACK.md
- **JSDoc-as-typecheck** (Phase 1 D-07) — every new src/ module ships with `// @ts-check` + JSDoc types from day 1; `// @ts-nocheck` rows in cleanup ledger close as their files are extracted/replaced
- **Tiered coverage thresholds** (Phase 2 D-15) — D-21 extends; the in-vite-config.js `test.coverage.thresholds` object grows new entries per directory
- **One Vite config, two consumers** (Phase 1 D-31 / Phase 2 D-15) — D-21's threshold extension lands in the same file
- **Conventional Commits** — `feat(04-XX): ...`, `chore(04-XX): ...`, `refactor(04-XX): ...`, `docs(04-XX): SECURITY.md ...`, `test(04-XX): ...`
- **`runbooks/` for one-shot procedures** — Phase 4 may add `runbooks/phase-4-extraction-checklist.md` (Claude's discretion) tracking per-view extraction state across Wave 4
- **Branch-protection-via-runbook** (Phase 1 D-12, Pitfall A pattern) — Phase 4 doesn't add new CI checks; existing `lint`, `typecheck`, `test`, `audit`, `build` cover the new directories automatically (no required-status-checks update needed)

### Integration Points

- **`index.html`** — `<script type="module" src="./app.js">` today (Phase 2 D-04). Wave 5 changes `src` to `./src/main.js` in the same commit that deletes app.js (D-03). Wave 1 also adds `tests/index-html-meta-csp.test.js` regression guard (D-18).
- **`app.js`** — IIFE source. Loses ~5,000 lines across Waves 1–4 as modules extract; deleted entirely in Wave 5 (D-03). Becomes vestigial in Wave 4 once all views are out and only the dispatcher + state object remain.
- **`firebase-init.js`** — deleted in Wave 1 (D-05); contents move to `firebase/app.js`.
- **`vite.config.js`** — Wave 6 final commit extends `test.coverage.thresholds` per D-21. No build-config change (Vite auto-bundles the new src/ entries).
- **`eslint.config.js`** — extended per-wave per D-04: per-file overrides for `firebase/*`, `data/*`, `domain/*`, `views/*` boundaries. Each wave's first commit lands the boundary edit; the corresponding `no-restricted-imports` rule flips from `warn` to `error` at the same time. The current `no-restricted-imports` block at lines 107–123 is the warn-mode skeleton that gets per-wave hardened.
- **`tsconfig.json`** — current `include` glob already covers `src/**/*.js`; new directories (firebase/, ui/, views/, cloud/, observability/) get picked up automatically. No edit needed unless per-directory references are added (deferred — not justified by current scale).
- **`package.json`** — D-08 adds `chart.js@4.x` (verify exact pin against STACK.md). No other deps added in Phase 4.
- **`assets/fonts/`** — new directory in Wave 1 holding self-hosted woff2 files (Inter or current font). `styles.css` `@font-face` declarations switch to local URLs.
- **`styles.css`** — receives new CSS classes from CODE-06 inline-style sweep (per-view in Wave 4); receives `--toast-bg-*` + `--chart-color-*` custom properties (D-13 + D-08). Wave 6 cleanup consolidates and verifies zero remaining `style="..."` strings.
- **CI hard-fail policy** (Phase 1 D-09 / Phase 2 D-16 / Phase 3 D-14) — extends: any `no-restricted-imports` violation now fails CI (per D-04 per-wave hardening); coverage threshold miss per D-21 fails CI; snapshot baseline diff fails CI unless intentional + documented per D-12.
- **`runbooks/phase-4-cleanup-ledger.md`** — receives per-wave row closures + new informational rows for Phase 7/8/9 stub fillings (per D-07, D-09, D-11).

### Pre-Flight Verifications (planner must include)

1. Verify Phase 2 snapshot baselines produce zero diff after Wave 1 (firebase/ adapter) lands — the boot path changed but the rendered HTML must not.
2. Verify Chart.js exact version pin against `.planning/research/STACK.md` before adding to `package.json` (D-08).
3. Verify the current Google Font in use (codebase scout `styles.css` for `@font-face` URLs and `index.html` for `<link rel="stylesheet">` references) and confirm OFL or equivalent self-hosting license.
4. Confirm `index.html` has zero `<meta http-equiv="Content-Security-Policy">` tags at Wave 1 entry — the `tests/index-html-meta-csp.test.js` D-18 lands a regression guard but the absence must already hold (Phase 3 `03-PREFLIGHT.md ## index.html meta-CSP scan` confirmed this).
5. Verify `data/pillars.js` location decision (root vs `src/data/`) before Wave 3 — Claude's discretion per D-12 + code_context note.
6. Verify the 4 `el.style.X=` sites in `app.js` (passConfirm display, drop background ×3) translate cleanly to CSS classes (CODE-06).
7. Verify the 7 `alert()` sites (`grep -cE 'alert\(' app.js` returned 7) all have natural `notify('error', ...)` or `notify('warn', ...)` mappings — no surprise interactive prompts.
8. Verify magic-byte signature table (D-16) against the file types BeDeveloped consultants actually upload — operator confirmation that {PDF, JPEG, PNG, DOCX, XLSX, TXT} covers their use case before locking the allowlist.
9. Verify Phase 2 cleanup-ledger informational rows (Phase 4 candidate cleanup column) — Phase 4 closes each row by either landing the simplification OR marking "no further work required". Decision per row is planner's call within D-12 faithful-extraction discipline.
10. Verify Husky pre-commit grep for meta-CSP (D-18 complement, Claude's discretion) doesn't conflict with existing Husky `.husky/pre-commit` (Phase 1 D-22).

</code_context>

<specifics>
## Specific Ideas

- **The wave shape is the natural shape, not a padded count.** Pattern A (boundaries-first, 6 waves) was chosen because each wave has one coherent area and one coherent set of cleanup-ledger row closures. Big-bang would lose the snapshot-baseline-as-fence verification gate; per-view strangler-fig (Pattern B) would force `data/*` boundaries to churn wave-over-wave. The 6-wave shape preserves Phase 2's strangler-fig precedent (Pitfall 9 step 2) while letting Phase 4 refactor freely within each wave's snapshot-stable boundary.
- **The `firebase/check.js` + `cloud/*` + `observability/*` empty-stub pattern is the seam strategy.** Phase 4 ships the complete ARCHITECTURE.md §2 directory tree with documented no-op exports in places Phase 7/8/9 will fill. Downstream phases drop bodies in WITHOUT changing the import surface, the directory shape, or the lint config. This is the "build the cathedral's interior walls before the windows" move — every later phase plugs into a stable substrate. The cleanup ledger gets one row per stub; rows close at Phase 7/8/9 as bodies land.
- **The Phase 5 collision-avoidance is in the wrapper API shape, not the body.** D-09's pass-through pattern means views/* see a stable `data/comments.js`-shaped API in both Phase 4 and Phase 5. Phase 5 only rewrites bodies; views/ never re-extract. This is the cheapest viable Phase-4-Phase-5 interaction: Phase 4 produces the boundary, Phase 5 produces the new storage shape, neither touches views/.
- **The Chart.js + Google Fonts CDN→npm migration is structural unblocking for Phase 10.** Phase 3 D-07 explicitly carries `cdn.jsdelivr.net` + `fonts.googleapis.com` + `fonts.gstatic.com` in CSP `script-src` / `style-src` / `font-src` as a temporary allowlist; D-08 here removes them. Phase 10's HOST-07 (drop `style-src 'unsafe-inline'`) becomes a single-step flip rather than a multi-CDN dance.
- **Faithful extraction (D-12) extends Phase 2 D-05 by one phase.** Phase 2 was the test fence; Phase 4 is the modular split phase. Both treat the snapshot baseline as the rendered-DOM contract. Improvements (sort, dedup, normalisation) defer to a follow-up commit AFTER each wave's snapshot diff lands at zero. This is "build, then refine" — no rewrite-while-extracting, even when extracting reveals an obvious clean-up. The cleanup ledger captures the deferred improvements as forward-tracking rows; they close in subsequent commits within the same phase or in Phase 5+ if the data model rewrite makes them moot.
- **The XSS regression test (CODE-04) is a permanent fixture.** Wave 2's deletion of the `html:` branch in `h()` is paired with `tests/ui/dom.test.js` asserting `<script>` and `<img onerror>` payloads are rendered as text content. That test is permanent regression detection — any future ESLint disable that re-enables `innerHTML =` in a new file fails the test. Phase 10's strict-CSP enforcement (HOST-07) is layered defence on top of this fence.
- **The toast helper (`ui/toast.js`) is the seam for Phase 9 audit-event surfacing.** D-13's API `notify(level, message, opts?)` is intentionally minimal; Phase 9 may extend `opts` to carry an `auditEvent` shape that wires through to `observability/audit-events.js` (e.g., `notify('error', 'Upload failed', { auditEvent: 'data.document.upload.failed' })`). Phase 4 doesn't ship the audit wiring — that's Phase 9 (AUDIT-05) — but the API shape leaves room.
- **Upload validation's two-source-of-truth-with-shared-allowlist pattern (D-15 + D-16) honours the SOC2/ISO defence-in-depth framing.** Client-side validation is for UX and audit-narrative ("we validate at the browser"); server-side enforcement (Phase 5 storage.rules + Phase 7 callable validation) is the trust boundary. The allowlist constant exported from `ui/upload.js` is imported by both — single source of truth, multiple enforcement points. Audit-narrative line: "client and server validate against the same canonical allowlist."
- **The Phase 6 deletion of `src/auth/state-machine.js` is intentional and load-bearing.** Phase 4 does NOT touch this module — the entire file (and its tests at `tests/auth/state-machine.test.js`) deletes in Phase 6 (AUTH-14) when Firebase Auth + custom claims replace the local-allowlist substrate. Phase 2 D-02 + cleanup-ledger Phase 2 row already document this; Phase 4 honours the boundary.
- **No `confirm()` or `prompt()` sites exist today** (verified by grep — count = 0). `ui/modal.js`'s `modal/promptText/confirmDialog` exports per ARCHITECTURE.md §2.2 helpers table are for the existing custom modal helper at `app.js:629–684`, not for replacing native `confirm`/`prompt` calls. CODE-07's scope is `alert()` only (7 sites).

</specifics>

<deferred>
## Deferred Ideas

- **Trusted Types (`require-trusted-types-for 'script'`)** — useful CSP signal but adds complexity to Phase 4's already-large scope. Revisit at Phase 10 entry as either a Phase 10 add-on directive or a Phase 4 optional follow-up commit if scope permits.
- **DOMPurify** — CODE-04 deletes the `html:` branch entirely. If a legitimate rich-text rendering need surfaces (e.g., a future report-builder feature wants markdown rendering), it would be its own phase with a separate hardening review per `.planning/REQUIREMENTS.md` "Out of Scope" line for `html:` rich-text.
- **`eslint-plugin-boundaries`** — purpose-built directory-graph rule plugin; defer unless D-04's per-wave `no-restricted-imports` hardening proves brittle. No current evidence it will.
- **Per-tsconfig project references for src/{firebase,data,domain,auth,cloud,views,ui,observability}/** — splits typecheck into per-directory projects; useful at much larger scale. Defer; current scale doesn't justify the build-config complexity.
- **`runbooks/phase-4-extraction-checklist.md`** — per-view extraction state tracker for Wave 4. Claude's discretion per planner; if Wave 4 has high inter-view coupling that's hard to track in commit messages alone, add. Otherwise the cleanup ledger + commit history is sufficient.
- **Codecov / Coveralls** — third-party coverage service. Deferred from Phase 2 D-15; still deferred. The in-repo HTML report (Phase 2 D-20) + threshold gate is sufficient for credible-not-certified compliance.
- **Bot-driven snapshot updates** (`/update-snapshots` PR comment trigger) — deferred from Phase 2 (D-17). Phase 4's per-wave snapshot stability discipline (D-12) doesn't need automation at single-developer scale.
- **`toast` accessibility audit** beyond D-13's role=status/role=alert basics — defer to a future a11y phase if BeDeveloped's audience formally requires WCAG 2.2 AA (not in current scope).
- **Inline-style sweep automation** (codemod that finds `style="..."` and class-named replacements automatically) — overkill at the current scope; manual sweep per view in Wave 4 is sufficient and reviewable.
- **`data/pillars.js` move from root to `src/data/`** — Claude's discretion. Static reference data; the move is a one-line rename. Deferred unless required by lint boundaries (D-04 may force the move if the Wave 4 lint pattern excludes root-level `data/` directories).
- **Per-view test snapshots beyond the 3 baselines** (`tests/__snapshots__/views/{dashboard,diagnostic,report}.html`) — Phase 2 D-08 chose 3 representative views. Wave 4 may add per-view snapshots for chat / pillar / actions / etc. as they extract. Claude's discretion per planner.
- **Reviewed Todos (not folded)** — none beyond the cross-phase ones already routed (Firestore region → Phase 6/11; Sentry free-tier → Phase 9; reCAPTCHA quota → Phase 7; bootstrap migration dry-run → Phase 5; MFA recovery feasibility → Phase 6; AUDIT translation → Phase 12).

</deferred>

---

*Phase: 04-modular-split-quick-wins*
*Context gathered: 2026-05-07*
