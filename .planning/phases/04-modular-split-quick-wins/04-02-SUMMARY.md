---
phase: 04-modular-split-quick-wins
plan: 02
subsystem: ui
tags: [ui, dom, modal, toast, upload, chrome, xss, eslint, security]

# Dependency graph
requires:
  - phase: 02-test-suite-foundation
    provides: src/util/ids.js (formatWhen/iso/initials/firstNameFromAuthor — re-exported by ui/format.js); snapshot baselines at tests/__snapshots__/views/{dashboard,diagnostic,report}.html (rendered-DOM contract); tests/auth/state-machine.test.js regression-baseline doc-comment style for the XSS fixture; tests/data/cloud-sync.test.js DI deps factory analog for tests/ui/upload.test.js
  - phase: 04-modular-split-quick-wins
    plan: 01
    provides: src/firebase/ adapter (boundary the Wave 2 lint rule guards against); ESLint argsIgnorePattern '^_' for placeholder/forward-import aliases; eslint.config.js Wave 1 firebase/* group flip skeleton
provides:
  - 6 src/ui/* helpers (dom + modal + toast + format + chrome + upload) with `// @ts-check` + JSDoc types
  - src/ui/dom.js with html: branch DELETED per CODE-04 (CWE-79 mitigation, audit narrative anchor)
  - tests/ui/dom.test.js permanent XSS REGRESSION FIXTURE (D-19 pinning <script> + <img onerror> payloads as text content)
  - src/ui/toast.js notify(level, message, opts?) substrate per D-13/D-14 (4 levels, role=status/role=alert, auto-dismiss tiers, MAX_VISIBLE=3 + eviction, focus-on-error, pause-on-hover) — Wave 4 alert→notify wiring
  - src/ui/upload.js validateUpload + ALLOWED_MIME_TYPES + MAX_BYTES per D-15/D-16 — single source of truth for Phase 5 storage.rules + Phase 7 callable validation
  - src/ui/chrome.js createChrome(deps) Pattern D DI factory binding renderTopbar + renderFooter
  - styles.css toast custom properties + container/level/close/mobile classes (.toast-root, .toast, .toast-{info,success,warn,error}, .toast-close)
  - eslint.config.js Wave 2 flip — domain/* may not import firebase/* (D-04 codifies Phase 2 D-03 already-zero-imports state)
  - app.js IIFE thinned by ~293 lines (5289 → 4996); IIFE-resident h/$/$$/modal/promptText/confirmDialog/renderTopbar/renderFooter all extracted
  - SECURITY.md § Build & Supply Chain gains Phase 4 Wave 2 paragraph (CODE-04 + Wave 2 ESLint flip)
  - runbooks/phase-4-cleanup-ledger.md Suppressions table closes 2 rows (app.js:670 + 676); out-of-band no-restricted-imports row gains Wave 2 checkbox
affects: [04-03, 04-04, 04-05, 04-06, 05-firestore-data-model-migration-rules-authoring, 06-real-auth-mfa-rules-deploy, 07-cloud-functions-app-check, 09-observability-audit-event-wiring, 10-csp-tightening-second-sweep]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Permanent regression fixture pattern (CODE-04) — REGRESSION FIXTURE doc-comment marker on tests/ui/dom.test.js makes the pinning policy explicit"
    - "Pattern D DI factory pattern extended to ui/* — createChrome(deps) returns {renderTopbar, renderFooter} with original signatures so existing IIFE callers don't change; Wave 5 swaps the deps source from IIFE closure → src/state.js with zero adapter-shape change"
    - "_-prefix import aliasing for forward-tracked unused imports — leverages the Wave 1 argsIgnorePattern '^_' to keep imports landed-but-unused without re-introducing eslint-disable rows (D-17 ledger zero-out direction)"
    - "Single-allowlist-multiple-enforcement-points (D-15) — ALLOWED_MIME_TYPES exported from src/ui/upload.js consumed by Phase 5 storage.rules + Phase 7 callable validation (server) AND views/* (client) — single source of truth, defence in depth"
    - "Color-mix CSS custom property tinting for toast levels (D-13) — decouples level palette from the inline-style sweep (CODE-06) precondition for Phase 10 strict-CSP enforcement"

key-files:
  created:
    - src/ui/dom.js
    - src/ui/modal.js
    - src/ui/format.js
    - src/ui/toast.js
    - src/ui/upload.js
    - src/ui/chrome.js
    - tests/ui/dom.test.js
    - tests/ui/modal.test.js
    - tests/ui/format.test.js
    - tests/ui/toast.test.js
    - tests/ui/upload.test.js
    - tests/ui/chrome.test.js
  modified:
    - app.js (file-scope ui/* imports; deleted IIFE-resident h/$/$$/modal/promptText/confirmDialog/renderTopbar/renderFooter; createChrome(deps) binding)
    - styles.css (toast :root tokens + .toast-root + .toast + per-level + close button + mobile breakpoint)
    - eslint.config.js (Wave 2 flip — src/domain/**/*.js block forbids firebase/* imports)
    - runbooks/phase-4-cleanup-ledger.md (Suppressions table -2 rows; out-of-band table Wave 2 checkbox; Phase 2 close-out section +3 informational rows; new Phase 4 forward-tracking section for modal.js innerHTML CODE-05 candidates)
    - SECURITY.md (§ Build & Supply Chain gains the Phase 4 Wave 2 paragraph + framework citations)
  deleted: []

key-decisions:
  - "Pattern D DI factory for chrome.js — createChrome(deps) returns {renderTopbar, renderFooter} with original (user) / (user, org) signatures. Alternative: top-level state-import in chrome.js wouldn't work because Phase 4 state still lives in the app.js IIFE closure (Wave 5 moves it). The factory adapter shape is stable across the Wave 5 cutover; views/* and main.js never re-extract."
  - "_$$ + _notify + _validateUpload + _ALLOWED_MIME_TYPES + _MAX_BYTES forward-import aliasing in app.js — Wave 4 (D-20) wires the actual consumers, but the imports land NOW so the Wave 4 patches are pure rewires, not new module discovery. The `^_` argsIgnorePattern (added in Wave 1) absorbs the unused-by-design contract WITHOUT new eslint-disable rows (D-17 zero-out direction)."
  - "uploadtest expected sanitisedName diverges from plan literal — plan's '______etc_p_sswd_.pdf' was inconsistent with CODE-09 spec /[^\\w.\\- ]/g (literal `.` is kept inside the char class). Implementation faithful to the spec; test corrected to '.._.._etc_p_sswd_.pdf'. Path-traversal trust boundary is server-side (Phase 5 storage.rules + the doc-id-keyed Storage path); client sanitisation is the audit-narrative claim."
  - "createTextNode arg coerced to String() in src/ui/dom.js — original IIFE was @ts-nocheck so the typeof-string-or-number → createTextNode(string|number) typecheck was never enforced. The coercion preserves runtime behaviour byte-identically while satisfying strict checkJs."
  - "no Husky pre-commit grep complement to tests/index-html-meta-csp.test.js (Wave 1 D-18) added in Wave 2 — Wave 2 doesn't touch index.html; the existing lint-staged + the in-CI test cover the regression fence"

patterns-established:
  - "Pattern D DI factory in ui/* (extends Phase 2 carry-forward) — src/ui/chrome.js createChrome(deps) is the template Wave 4 will follow for any other extracted-from-IIFE function that needs closure state"
  - "Permanent regression fixture documentation pattern (D-19) — the `REGRESSION FIXTURE — permanent` doc-comment on tests/ui/dom.test.js makes the pin-forever policy explicit + framework-cited (OWASP ASVS V5.3 / ISO 27001 A.8.28 / GDPR Art. 32(1)(b)) so future contributors don't relax the assertions accidentally"
  - "Per-wave per-files-scoped ESLint config blocks (D-04) — Wave 2 added src/domain/**/*.js block AFTER the Wave 1 src/**/*.js block; flat-config last-match-wins, but the file globs are non-overlapping so both rules compose correctly"

requirements-completed: [CODE-02, CODE-04, DOC-10]

# Metrics
duration: 16min
completed: 2026-05-07
---

# Phase 4 Plan 02: ui/* Helpers + html: Branch Deletion + Wave 2 ESLint Flip Summary

**6 src/ui/* helpers (dom + modal + toast + format + chrome + upload) extracted from the app.js IIFE with `// @ts-check` + JSDoc types; html: escape hatch deleted from h() with permanent XSS regression fixture (CODE-04, CWE-79); toast helper substrate for Wave 4 alert→notify wiring (D-13/D-14); upload validation helper as the single canonical allowlist for Phase 5/7 server enforcement (D-15/D-16); ESLint domain/* → firebase/* boundary flipped from warn to error (codifies Phase 2 D-03); IIFE thinned by ~293 lines (5289 → 4996).**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-05-07T11:01:59Z
- **Completed:** 2026-05-07T11:18:30Z
- **Tasks:** 3 (2 TDD with RED/GREEN splits + 1 chore = 5 commits)
- **Files modified:** 17 (12 created + 5 modified)
- **Lines deleted from app.js:** ~293 (5289 → 4996; -293 net across two GREEN commits)

## Accomplishments

- `src/ui/dom.js` — h() / $ / $$ extracted byte-identical from `app.js:526-547` EXCEPT the `html:` branch is DELETED (CODE-04, CWE-79). The eslint-disable for `no-unsanitized/property` is gone with it. `createTextNode` arg coerced to `String()` to satisfy strict checkJs (the original IIFE source was under `@ts-nocheck`).
- `src/ui/modal.js` — modal / promptText / confirmDialog extracted byte-identical from `app.js:550-616` (D-12 faithful extraction); IIFE-closure references to `h()` rewritten to `import { h } from "./dom.js"`. The `root.innerHTML = ""` resets at modal.js:21 + 28 are CODE-05 forward-tracking candidates per the new ledger row (Wave 4 sweep closes).
- `src/ui/format.js` — re-exports formatWhen / iso / initials / firstNameFromAuthor from `src/util/ids.js` per ARCHITECTURE.md §2 helpers table. Wave 4 may switch consumers to ui/format.js; util/ids.js implementation stays in place so the existing 100% src/util/** coverage threshold continues to fence behaviour.
- `src/ui/toast.js` — D-13/D-14 contract: `notify(level, message, opts?)` with 4 levels (info|success|warn|error), Unicode level symbols (ⓘ ✓ ⚠ ✕), `role="status"` for info/success/warn + `role="alert"` for error, auto-dismiss tiers (4000/4000/7000/null — error sticky), MAX_VISIBLE=3 with oldest-non-error eviction, focus-on-error for keyboard a11y, pause-on-hover for non-error timers. Lazy mounts a single `<aside id="toastRoot" aria-live="polite">` on first call.
- `src/ui/upload.js` — D-15/D-16 contract: `validateUpload(file)` returns `{ok:true, sanitisedName} | {ok:false, reason}`; `ALLOWED_MIME_TYPES` exported as `Set` with 6 entries (PDF/JPEG/PNG/DOCX/XLSX/TXT) — the canonical allowlist for Phase 5 `storage.rules` + Phase 7 callable validation; `MAX_BYTES = 25 MiB` exported; magic-byte sniff (PDF `%PDF-`, JPEG `FF D8 FF`, PNG `89 50 4E 47 0D 0A 1A 0A`, ZIP container disambiguated via declaredType, TXT no-magic + UTF-8 + no NUL byte); declared-vs-detected cross-check (mismatch rejected with descriptive reason); CODE-09 spec sanitiseName regex verbatim.
- `src/ui/chrome.js` — Pattern D DI factory `createChrome(deps)` returning `{renderTopbar, renderFooter}` byte-identical to `app.js:633-887`. Closure references to state / activeOrgForUser / unreadCountTotal / unreadChatTotal / setRoute / loadOrgMetas / jset / K / render / isClientView / signOut / openChangePasswordModal / exportData / importData replaced with `deps` parameter. Wave 5 (D-02) moves state into `src/state.js` — adapter shape stays stable.
- `tests/ui/*.test.js` — 6 paired test files / 56 new tests cover all 6 ui/* modules; XSS regression fixture is doc-comment-marked permanent.
- `eslint.config.js` Wave 2 flip — `src/domain/**/*.js` block forbids firebase/* imports (codifies Phase 2 D-03 already-zero-imports state). Verified rule fires by temporarily importing firebase/db.js into src/domain/banding.js + running lint (1 expected error fired with configured message), then reverting.
- `runbooks/phase-4-cleanup-ledger.md` — Suppressions table closes 2 rows (`app.js:670` no-unused-vars on `$$` + `app.js:676` no-unsanitized/property on the `html:` branch); table now stands at **12 rows** (was 14 at Wave 2 entry, was 16 at phase entry). Out-of-band no-restricted-imports row gains `[x] Wave 2 domain/*` checkbox. Phase 2 close-out section gains 3 informational rows (dom/modal/format extractions). New "Phase 4 forward-tracking rows (CODE-05 candidates)" section captures `modal.js:21 + 28` for the Wave 4 sweep.
- `SECURITY.md` § Build & Supply Chain gains the Phase 4 Wave 2 paragraph documenting the `html:` deletion + permanent XSS regression test fixture + Wave 2 ESLint flip, with framework citations covering OWASP ASVS V5.3 + V14.2, ISO/IEC 27001:2022 A.8.28 + A.13.1.3, SOC 2 CC8.1, GDPR Art. 32(1)(b).
- All 257 tests pass (201 baseline + 56 new); typecheck/lint/build clean; Phase 2 snapshot baselines unchanged (zero diff at `tests/__snapshots__/views/{dashboard,diagnostic,report}.html`).

## Task Commits

Each task was committed atomically (TDD RED→GREEN where applicable):

1. **Task 1 RED: failing tests for src/ui/{dom,modal,format}** — `471f18b` (test)
2. **Task 1 GREEN: extract src/ui/{dom,modal,format} + delete html: branch (CODE-04)** — `ceeb07f` (feat)
3. **Task 2 RED: failing tests for src/ui/{toast,upload,chrome}** — `008b3b7` (test)
4. **Task 2 GREEN: extract src/ui/{toast,upload,chrome} + styles.css toast tokens** — `f6a49ab` (feat)
5. **Task 3: Wave 2 ESLint flip — domain/* may not import firebase/* (D-04)** — `256b4f2` (feat)

**Plan metadata:** TBD (orchestrator commits SUMMARY.md after this agent returns).

## The h() diff (CODE-04 — html: branch DELETED)

**Before** (`app.js:529-547`):

```js
const h = (tag, attrs = {}, children = []) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    // eslint-disable-next-line no-unsanitized/property -- Phase 4: replace innerHTML with replaceChildren() / DOMPurify.sanitize(). See runbooks/phase-4-cleanup-ledger.md
    else if (k === "html") el.innerHTML = v;     // ← DELETED in Wave 2
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    // ...
  }
};
```

**After** (`src/ui/dom.js`, top-level ESM export):

```js
export const h = (tag, attrs = {}, children = []) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    // `html:` branch DELETED (CODE-04). Use children for text/element content.
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    // ...
  }
};
```

The `eslint-disable-next-line no-unsanitized/property` comment is gone. ESLint's `no-unsanitized/property = error` now fences against any future `innerHTML =` reintroduction across the entire codebase.

## XSS Regression Fixture (CODE-04 — `tests/ui/dom.test.js`)

The doc-comment marker is the policy:

```
REGRESSION FIXTURE — permanent (Phase 4 Wave 2, CODE-04)

The `html:` escape hatch in h() was deleted in Phase 4 (CONCERNS C4 closure).
These payloads MUST render as text content forever — any future ESLint
disable that re-enables innerHTML in a new file should fail this test
even if the test wasn't updated for that file (because the dom.js attribute
surface no longer takes `html:`).

Citations: OWASP ASVS V5.3 (Output Encoding / XSS prevention),
ISO/IEC 27001:2022 A.8.28 (Secure coding), GDPR Art. 32(1)(b)
(Confidentiality of processing — XSS prevention).
```

Pinned payloads:

1. `h("div", {}, "<script>window.__xss = true</script>")` — `el.textContent` equals the literal `<script>...</script>` string; `el.querySelector("script")` is null; `window.__xss` is `undefined`.
2. `h("div", {}, '<img src=x onerror="window.__xss=true">')` — `el.querySelector("img")` is null; `window.__xss` is `undefined`.
3. `h("div", { html: "<b>not honoured</b>" })` — `el.textContent` is empty (the `html:` branch is deleted; runtime ignores); `el.querySelector("b")` is null.

## Toast notify() Contract (D-13/D-14 — `src/ui/toast.js`)

| Aspect | Contract |
| --- | --- |
| Signature | `notify(level: ToastLevel, message: string, opts?: { persist?: boolean }): void` |
| Levels | `info` \| `success` \| `warn` \| `error` |
| Symbols | ⓘ / ✓ / ⚠ / ✕ (Unicode, no icon-font dependency) |
| Role | `info`/`success`/`warn` → `role="status"` (announces non-interruptingly); `error` → `role="alert"` (interrupts AT immediately) |
| Auto-dismiss | `info` 4000ms, `success` 4000ms, `warn` 7000ms, `error` ∞ (sticky — manual close required) |
| Container | Lazy mount once: `<aside id="toastRoot" class="toast-root" aria-live="polite">` appended to `<body>` |
| Eviction | When `MAX_VISIBLE = 3` is reached, oldest non-error toast evicts on next call |
| Focus | Error toasts focus the close button (a11y win for keyboard users) |
| Pause-on-hover | Non-error timers pause on `mouseenter`, restart on `mouseleave` |
| Background tint | CSS custom properties `--toast-bg-{info,success,warn,error}` via `color-mix` (decouples palette from the CODE-06 inline-style sweep precondition for Phase 10 strict-CSP) |

## Upload validateUpload() Contract (D-15/D-16 — `src/ui/upload.js`)

```ts
type AllowedMime =
  | "application/pdf"
  | "image/jpeg"
  | "image/png"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  | "text/plain";

export const ALLOWED_MIME_TYPES: ReadonlySet<AllowedMime>; // 6 entries
export const MAX_BYTES: number; // 25 * 1024 * 1024

export async function validateUpload(file: File): Promise<
  | { ok: true; sanitisedName: string }
  | { ok: false; reason: string }
>;
```

**Trust-boundary mapping (D-15):** Client validation = UX-feedback layer + audit-narrative claim ("client validates declared+actual MIME, not just declared"). Server-side enforcement = trust boundary (Phase 5 `storage.rules` + Phase 7 callable validation). The exported `ALLOWED_MIME_TYPES` is the **single source of truth** — both layers read from the same canonical allowlist.

**Magic-byte signatures (D-16):**

| Type | Magic bytes (hex) | Disambiguation |
| --- | --- | --- |
| PDF | `25 50 44 46 2D` (`%PDF-`) | None (unique) |
| JPEG | `FF D8 FF` | None (unique) |
| PNG | `89 50 4E 47 0D 0A 1A 0A` | None (unique) |
| DOCX | `50 4B 03 04` (ZIP) | declaredType === `wordprocessingml.document` |
| XLSX | `50 4B 03 04` (ZIP) | declaredType === `spreadsheetml.sheet` |
| TXT | (no magic bytes) | declaredType === `text/plain` AND no `0x00` byte in head |

Validation flow: size cap → declared MIME in allowlist → read first 32 bytes → magic-byte sniff → cross-check detected vs declared → on success return sanitisedName per `String(name).replace(/[^\w.\- ]/g, "_").slice(0, 200)`.

## Wave 2 ESLint Diff (D-04)

**Added** to `eslint.config.js` after the Wave 1 firebase-SDK boundary block:

```js
{
  files: ["src/domain/**/*.js"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: [
              "**/firebase/*",
              "../firebase/*",
              "../../firebase/*",
              "firebase/*",
            ],
            message:
              "domain/* is pure logic — no Firebase imports allowed (ARCHITECTURE.md §2.4). Phase 4 Wave 2 (D-04).",
          },
        ],
      },
    ],
  },
},
```

**Verification of rule firing:** Temporarily added `import { db as _testDb } from "../firebase/db.js";` to `src/domain/banding.js` → ran `npm run lint` → 1 expected error with the configured message → reverted the import. The lint regression test in CI catches the same.

**State of the four-boundary D-04 plan:**

| Boundary | Wave | Status |
| --- | --- | --- |
| firebase/* SDK group → only src/firebase/** | 1 | DONE (Plan 04-01) |
| domain/* → no firebase/* | 2 | **DONE (this plan)** |
| data/* → only firebase/db.js + firebase/storage.js | 3 | Pending (Plan 04-03) |
| views/* → no firebase/* | 4 | Pending (Plan 04-04) |

## Cleanup-Ledger Row Closures

| File | Line | Annotation | Rule | Closed in |
| --- | --- | --- | --- | --- |
| `app.js` | 670 | `// eslint-disable-next-line no-unused-vars` | `no-unused-vars` (the dead `$$` helper) | This plan — `$$` extracted to `src/ui/dom.js` and now legitimately exported |
| `app.js` | 676 | `// eslint-disable-next-line no-unsanitized/property` | `no-unsanitized/property` (the `html:` branch) | This plan — `html:` branch DELETED entirely (CODE-04, CWE-79 mitigation) |

Suppressions table now stands at **12 rows** (was 14 at Wave 2 entry; was 16 at phase entry). Phase 4 D-17 zero-out target is on track (-4 across Waves 1+2; -12 to go in Waves 3-5).

## SECURITY.md DOC-10 Paragraph Appended

Section: § Build & Supply Chain → ### Phase 4 Wave 2 — html: escape hatch deletion + permanent XSS regression test (CODE-04)

Three paragraphs:
1. The `html:` branch deletion narrative: scope (`src/ui/dom.js`), prior risk surface (eslint-disabled `no-unsanitized/property` annotation, CONCERNS C4), grep-verified zero callers in current codebase.
2. The XSS regression fixture: pinned `<script>` + `<img onerror>` + `html:` attr-name behaviour assertions; doc-comment-marked "REGRESSION FIXTURE — permanent" so future ESLint relaxations fail the test.
3. The Wave 2 ESLint flip: `domain/* → firebase/*` boundary at error level; rule dormant-but-active; combined with Wave 1 firebase-SDK boundary, two of four ARCHITECTURE.md §2.4 boundaries are now lint-enforced.

Citations: OWASP ASVS V5.3 (Output Encoding / XSS prevention), V14.2 (Code Integrity); ISO/IEC 27001:2022 A.8.28 (Secure coding), A.13.1.3 (Network segregation analogue at lint layer); SOC 2 CC8.1 (Change management — atomic-commit pattern); GDPR Art. 32(1)(b) (Confidentiality of processing — XSS prevention).

## app.js Line Count Diff

| Stage | Lines | Δ |
| --- | --- | --- |
| Wave 2 entry | 5289 | — |
| After Task 1 GREEN (dom + modal + format extracted) | 5216 | -73 |
| After Task 2 GREEN (renderTopbar + renderFooter extracted) | 4996 | -220 |
| **Wave 2 close** | **4996** | **-293 net** |

The IIFE shed all 6 helper functions (`h`, `$`, `$$`, `modal`, `promptText`, `confirmDialog`) plus 2 large render functions (`renderTopbar`, `renderFooter`) — well above the planned ~150-line target.

## Snapshot Baseline Zero-Diff Verification

```
$ git diff --stat tests/__snapshots__/views/
(empty)
```

`tests/__snapshots__/views/{dashboard,diagnostic,report}.html` are byte-identical to the Phase 2 D-08 baselines. The boot path now goes through file-scope ESM imports (ui/* modules) before reaching the IIFE, but the rendered HTML at every snapshot-driven view is unchanged — the D-12 faithful-extraction discipline holds.

## Decisions Made

- **Pattern D DI factory for chrome.js** — `createChrome(deps)` returns `{renderTopbar, renderFooter}` with original `(user)` / `(user, org)` signatures so existing render() / renderRoute() callers don't change. Alternative top-level state-import wouldn't work because Phase 4 state still lives in the app.js IIFE closure (Wave 5 moves it). The factory adapter shape is stable across the Wave 5 cutover; views/* and main.js never re-extract.
- **`_$$` + `_notify` + `_validateUpload` + `_ALLOWED_MIME_TYPES` + `_MAX_BYTES` forward-import aliasing in app.js** — Wave 4 (D-20) wires the actual consumers, but the imports land NOW so the Wave 4 patches are pure rewires. The `^_` argsIgnorePattern (added in Wave 1) absorbs the unused-by-design contract WITHOUT new eslint-disable rows (Phase 4 D-17 zero-out direction).
- **Upload test `expected sanitisedName` corrected** — plan literal `'______etc_p_sswd_.pdf'` was inconsistent with CODE-09 spec `/[^\w.\- ]/g` (literal `.` is kept inside the char class; only `/`, `@`, `!` are replaced with `_`). Implementation faithful to the spec; test corrected to `'.._.._etc_p_sswd_.pdf'`. Path-traversal trust boundary is server-side (Phase 5 `storage.rules` + the doc-id-keyed Storage path); client-side sanitisation is the audit-narrative claim, not the trust boundary.
- **`createTextNode` arg coerced to `String()` in `src/ui/dom.js`** — the original IIFE was `@ts-nocheck` so the `typeof string|number → createTextNode(string)` typecheck was never enforced. The coercion preserves runtime behaviour byte-identically while satisfying strict checkJs.
- **No new Husky pre-commit grep complement to `tests/index-html-meta-csp.test.js`** — Wave 2 doesn't touch `index.html`; the existing lint-staged + the in-CI test cover the regression fence.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Coerce `createTextNode` arg to `String()` in `src/ui/dom.js`**

- **Found during:** Task 1 GREEN (`npm run typecheck` after creating src/ui/dom.js)
- **Issue:** `tsc --noEmit` failed with `TS2345: Argument of type 'string | number' is not assignable to parameter of type 'string'.` The original IIFE source was under `@ts-nocheck` so `document.createTextNode(c)` (where `c: string | number` from the typeof guard) was never typechecked.
- **Fix:** Wrapped with `String(c)` to satisfy the `string`-only signature of `createTextNode`. Runtime behaviour byte-identical (number → string coercion that JS already does in `createTextNode` internals).
- **Files modified:** `src/ui/dom.js`
- **Verification:** `npm run typecheck` clean
- **Committed in:** `ceeb07f` (Task 1 GREEN)

**2. [Rule 3 - Blocking] Underscore-alias `$$` import in `app.js`**

- **Found during:** Task 1 GREEN (`npm run lint` after deleting IIFE-resident `$$` definition)
- **Issue:** `app.js` imports `{ h, $, $$ }` from `./src/ui/dom.js`, but `$$` has no callers in app.js until Wave 4 wires consumers. Lint failed with `'$$' is defined but never used. Allowed unused vars must match /^_/u no-unused-vars`.
- **Fix:** Aliased the import `{ h, $, $$ as _$$ }` — the `^_` argsIgnorePattern (Wave 1 D-05 carry-forward) absorbs the unused-by-design contract WITHOUT re-introducing the closed `app.js:670` ledger row.
- **Files modified:** `app.js`
- **Verification:** `npm run lint` clean
- **Committed in:** `ceeb07f` (Task 1 GREEN)

**3. [Rule 1 - Bug] Corrected `tests/ui/upload.test.js` expected sanitisedName**

- **Found during:** Task 2 GREEN (`npx vitest run tests/ui/upload.test.js`)
- **Issue:** Plan-literal expected output `'______etc_p_sswd_.pdf'` for input `'../../etc/p@sswd!.pdf'` was inconsistent with CODE-09 spec regex `/[^\w.\- ]/g` — literal `.` is INSIDE the character class so dots are kept, not replaced. Actual spec-correct output is `'.._.._etc_p_sswd_.pdf'` (only `/`, `@`, `!` replaced with `_`).
- **Fix:** Updated test expectation to match the spec. Added a length-truncation test for the `slice(0, 200)` clause to widen coverage. Documented the trust-boundary stance in the test doc-comment (path-traversal mitigation is server-side via the doc-id-keyed Storage path; client sanitisation is the audit narrative).
- **Files modified:** `tests/ui/upload.test.js`
- **Verification:** All 32 new ui/* tests pass; npm run test exits 0
- **Committed in:** `f6a49ab` (Task 2 GREEN — landed atomically with the production code)

**4. [Rule 3 - Blocking] Type-annotate the `chip` button onclick handler in `src/ui/chrome.js`**

- **Found during:** Task 2 GREEN (`npm run typecheck` after creating src/ui/chrome.js)
- **Issue:** `tsc --noEmit` failed with `TS7006: Parameter 'e' implicitly has an 'any' type.` The `attrs` parameter is typed `Record<string, any>` so `onclick`'s lambda has implicit-any args; the `/** @type {Event} */ (e).stopPropagation()` cast inside the body wasn't sufficient to remove the parameter-declaration error.
- **Fix:** Moved the JSDoc type annotation to the parameter position: `onclick: (/** @type {Event} */ e) => { e.stopPropagation(); ... }`. Runtime behaviour unchanged.
- **Files modified:** `src/ui/chrome.js`
- **Verification:** `npm run typecheck` clean
- **Committed in:** `f6a49ab` (Task 2 GREEN)

---

**Total deviations:** 4 auto-fixed (3 Rule 3 blocking issues at the typecheck/lint frontier from extracting code that was previously under `@ts-nocheck`, 1 Rule 1 bug from an inconsistent literal in the plan's test fixture).
**Impact on plan:** All auto-fixes were necessary for correctness or strict acceptance-criteria compliance. No scope creep — every fix maps to a specified D-* decision or acceptance criterion.

## Issues Encountered

- **plan literal vs spec mismatch on sanitisedName** — see Deviation #3. Fixed by faithfully implementing the CODE-09 regex spec and updating the test expectation; widened coverage with a length-truncation case.
- **typecheck regressions surface at extraction-time** — extracting code from a `@ts-nocheck` IIFE into a `@ts-check` module exposes type errors that were silently passing. Two minimal fixes (Deviations #1 + #4); both are coercion / parameter-annotation level, no behavioural changes.

## User Setup Required

None — no external service configuration required for this wave. The Vite build automatically bundles `src/ui/{dom,modal,toast,format,chrome,upload}.js` into `dist/assets/main-*.js`. The new toast `--toast-bg-*` tokens + `.toast-root`/`.toast` classes ship in `dist/assets/main-*.css`. CSP-RO unchanged; no new origins introduced.

## Next Phase Readiness

- **Wave 3 (04-03) ready:** `src/data/*` per-collection wrappers will reference the firebase/ adapter (Wave 1) directly. The Wave 2 ESLint flip doesn't constrain data/* — Wave 3 adds the `data/* → only firebase/db.js + firebase/storage.js` flip.
- **Wave 4 (04-04) ready:** ui/* helpers now exist for views/* to import. The 7 alert() sites + the upload site at app.js:3433-3465 + the renderTopbar/renderFooter callers will all be rewired in Wave 4 per D-20. The forward-import aliases (`_notify`, `_validateUpload`, `_ALLOWED_MIME_TYPES`, `_MAX_BYTES`, `_$$`) shed their underscore prefixes as Wave 4 wires consumers.
- **Wave 5 (04-05) ready:** `createChrome(deps)` adapter shape is stable; Wave 5's swap of state from IIFE-closure → `src/state.js` is a deps-source change only — chrome.js doesn't re-extract.
- **Phase 5 (DATA + RULES) ready:** `ALLOWED_MIME_TYPES` exported from `src/ui/upload.js` is the canonical allowlist that `storage.rules` will import (or string-mirror) — single source of truth.
- **Phase 7 (FN-04) ready:** `MAX_BYTES` + `ALLOWED_MIME_TYPES` are the exact constants the upload-handling callable validation will consume.
- **Phase 10 (HOST-07) ready:** Toast color-mix tokens give Wave 6 a clean migration path for any remaining inline-style sweep work.

## Self-Check: PASSED

Verified:
- All 12 created files exist (6 src/ui/*.js + 6 tests/ui/*.test.js)
- All 5 commits (`471f18b`, `ceeb07f`, `008b3b7`, `f6a49ab`, `256b4f2`) present in git log
- `grep -c "k === \"html\"" app.js src/ui/dom.js` returns 0 in both files
- `grep -c "no-unsanitized" app.js src/ui/dom.js` returns 0 in both files
- `grep -c "REGRESSION FIXTURE" tests/ui/dom.test.js` returns 1 (permanent fixture marker)
- `grep -nE "function renderTopbar|function renderFooter" app.js` returns no matches (both extracted)
- `grep -c "alert(" app.js` returns 7 (UNCHANGED — Wave 4 wires per D-20)
- `grep -c 'files: \["src/domain/\*\*/\*.js"\]' eslint.config.js` returns 1 (Wave 2 entry added)
- `grep -c "Phase 4 Wave 2 — html: escape hatch deletion" SECURITY.md` returns 1
- `grep -c "Wave 2 domain/" runbooks/phase-4-cleanup-ledger.md` returns 1 (checkbox added)
- 257 tests pass; typecheck/lint/build clean
- Phase 2 snapshot baselines unchanged (zero diff)

---
*Phase: 04-modular-split-quick-wins*
*Plan: 02*
*Completed: 2026-05-07*
