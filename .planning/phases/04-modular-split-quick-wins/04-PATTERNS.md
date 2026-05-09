# Phase 4: Modular Split + Quick Wins - Pattern Map

**Mapped:** 2026-05-07
**Files analyzed:** ~70 (firebase/ x6, ui/ x7, data/ x12, cloud/ x5, observability/ x2, views/ x12, state+router+main, plus tests + config edits)
**Analogs found:** ~70 / ~70 (every new file has a strong pre-existing analog inside this repo)

---

## Orientation — the four canonical analogs

Almost every Phase 4 file copies its skeleton from one of four pre-existing modules. Plans should reference these by name rather than re-deriving:

| Canonical analog                   | Role copied                                                     | Used as template for                                                                  |
| ---------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `firebase-init.js` (root)          | SDK init + per-feature export bag                                | Wave 1 `src/firebase/{app,auth,db,storage,functions,check}.js`                       |
| `src/data/cloud-sync.js`           | Pattern D Pattern-D DI wrapper exporting Promise-returning fns   | Wave 3 `src/data/*.js` (12 files) and the stub `src/cloud/*.js` (5 files)            |
| `src/util/ids.js` + `src/util/hash.js` | `// @ts-check` + JSDoc + small leaf module shape              | Wave 2 `src/ui/*.js` (dom/modal/toast/format/chrome/charts/upload)                   |
| `src/auth/state-machine.js` + its tests | Single-purpose module + companion `tests/<dir>/<file>.test.js` | Every new test file in Waves 1–6                                                     |

Plus three config-edit analogs:

| Canonical config analog            | Pattern                                                          | Used by                                                                                |
| ---------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `eslint.config.js` lines 107–123  | `no-restricted-imports` warn-mode skeleton                       | D-04 per-wave warn→error flips (Waves 1, 2, 3, 4, 6)                                  |
| `vite.config.js` lines 50–57      | tiered `test.coverage.thresholds`                                 | D-21 Wave 6 threshold extension                                                        |
| `tests/firebase-config.test.js`    | Read file from disk + regex/JSON-schema assertions                | D-18 Wave 1 `tests/index-html-meta-csp.test.js`                                       |

---

## File Classification

### Wave 1 — `firebase/` adapter + CDN cleanup

| New / Modified File                          | Role             | Data Flow         | Closest Analog                                | Match Quality |
| -------------------------------------------- | ---------------- | ----------------- | --------------------------------------------- | ------------- |
| `src/firebase/app.js` (NEW)                  | adapter (init)   | sync init         | `firebase-init.js` (root)                     | exact         |
| `src/firebase/auth.js` (NEW; placeholder)    | adapter (auth)   | request-response  | `firebase-init.js` lines 24-28 + 82-90        | role-match    |
| `src/firebase/db.js` (NEW)                   | adapter (db)     | streaming + CRUD  | `firebase-init.js` lines 6-23 + 63-78         | exact         |
| `src/firebase/storage.js` (NEW)              | adapter (storage)| streaming (resumable) | `firebase-init.js` lines 29-35 + 79          | exact         |
| `src/firebase/functions.js` (NEW)            | adapter (callable)| request-response | `firebase-init.js` overall shape              | role-match    |
| `src/firebase/check.js` (NEW; no-op stub)    | adapter (init slot)| (empty)         | `src/util/hash.js` (small leaf w/ Phase-X note) | role-match  |
| `src/ui/charts.js` (NEW)                     | utility / wrapper | request-response (config in/out) | `firebase-init.js` (config bag pattern)    | role-match    |
| `assets/fonts/*.woff2` (NEW; binary)         | static asset     | n/a               | `assets/logo.png` placement convention        | exact         |
| `styles.css` (MODIFIED)                      | stylesheet       | n/a               | existing `:root` token block, `:7-49`         | exact         |
| `index.html` (MODIFIED)                      | shell            | n/a               | current `index.html` lines 9-15, 24-26        | exact         |
| `public/_headers` + `firebase.json` (MODIFIED) | host config    | n/a               | current `firebase.json` (Phase 3 baseline)    | exact         |
| `package.json` (MODIFIED; +chart.js)         | dep manifest     | n/a               | Phase 1 D-01 pinned-version pattern           | exact         |
| `tests/index-html-meta-csp.test.js` (NEW)    | test (schema)    | file-I/O          | `tests/firebase-config.test.js`               | exact         |
| `src/util/ids.js` (MODIFIED; CODE-03)        | utility          | sync transform    | self (`src/util/ids.js` line 6-8)             | self-edit     |
| `eslint.config.js` (MODIFIED; Wave 1 flip)   | lint config      | n/a               | self (`eslint.config.js` lines 107-123)       | self-edit     |

### Wave 2 — `ui/` helpers + `html:` deletion

| New / Modified File                | Role             | Data Flow         | Closest Analog                                | Match Quality |
| ---------------------------------- | ---------------- | ----------------- | --------------------------------------------- | ------------- |
| `src/ui/dom.js` (NEW)              | utility (DOM)    | sync construction | `app.js:528-547` (`h()` + `$`/`$$`) + `src/util/ids.js` shape | exact   |
| `src/ui/modal.js` (NEW)            | utility (DOM)    | event-driven      | `app.js:550-616` (`modal`/`promptText`/`confirmDialog`) | exact   |
| `src/ui/toast.js` (NEW)            | utility (DOM)    | event-driven (timer) | `app.js:550-571` (`modal()` mount-into-root pattern) | role-match |
| `src/ui/format.js` (NEW)           | utility          | sync transform    | `src/util/ids.js` (formatWhen/initials/firstNameFromAuthor already extracted) | exact |
| `src/ui/chrome.js` (NEW)           | utility (DOM)    | sync construction | `app.js:756-946` (`renderTopbar`/`renderFooter`) | role-match |
| `src/ui/upload.js` (NEW)           | utility          | sync transform + async I/O | `src/auth/state-machine.js` (DI Promise pattern) + `app.js:3433-3465` (current upload site) | role-match |
| `tests/ui/dom.test.js` (NEW; XSS)  | test             | XSS regression    | `tests/auth/state-machine.test.js` (regression-baseline doc-comment style) | exact |
| `tests/ui/toast.test.js` (NEW)     | test             | event-driven      | `tests/util/ids.test.js`                      | exact         |
| `tests/ui/upload.test.js` (NEW)    | test             | file-I/O          | `tests/data/cloud-sync.test.js` (DI deps factory) | exact     |
| `styles.css` (MODIFIED; toast vars) | stylesheet      | n/a               | `:root` token block (`styles.css:7-49`)       | exact         |
| `eslint.config.js` (MODIFIED; Wave 2 flip) | lint config | n/a            | self                                          | self-edit     |

### Wave 3 — `data/*` wrappers + `cloud/*` + `observability/*` stubs

| New / Modified File                    | Role           | Data Flow      | Closest Analog                  | Match Quality |
| -------------------------------------- | -------------- | -------------- | ------------------------------- | ------------- |
| `src/data/orgs.js` (NEW)               | service (CRUD) | CRUD + onSnapshot | `src/data/cloud-sync.js`     | exact         |
| `src/data/users.js` (NEW)              | service (CRUD) | CRUD + onSnapshot | `src/data/cloud-sync.js`     | exact         |
| `src/data/roadmaps.js` (NEW)           | service (CRUD) | CRUD + onSnapshot | `src/data/cloud-sync.js`     | exact         |
| `src/data/funnels.js` (NEW)            | service (CRUD) | CRUD + onSnapshot | `src/data/cloud-sync.js`     | exact         |
| `src/data/funnel-comments.js` (NEW)    | service (CRUD) | CRUD + onSnapshot | `src/data/cloud-sync.js`     | exact         |
| `src/data/allowlist.js` (NEW)          | service (read) | request-response  | `src/data/cloud-sync.js`     | role-match    |
| `src/data/responses.js` (NEW; pass-through) | service   | pass-through to orgs.js | `src/data/migration.js` (DI surface) | role-match |
| `src/data/comments.js` (NEW; pass-through)  | service   | pass-through to orgs.js | `src/data/migration.js`            | role-match    |
| `src/data/actions.js` (NEW; pass-through)   | service   | pass-through to orgs.js | `src/data/migration.js`            | role-match    |
| `src/data/documents.js` (NEW; pass-through) | service   | pass-through + Storage  | `src/data/cloud-sync.js`           | role-match    |
| `src/data/messages.js` (NEW; pass-through)  | service   | pass-through + onSnapshot | `src/data/cloud-sync.js`         | role-match    |
| `src/data/audit-events.js` (NEW; pass-through) | service | pass-through            | `src/data/migration.js`            | role-match    |
| `src/cloud/audit.js` (NEW; stub)       | client (RPC)   | request-response  | `src/firebase/check.js` (no-op stub pattern) + `src/util/hash.js` (Phase-X delete note) | role-match |
| `src/cloud/soft-delete.js` (NEW; stub) | client (RPC)   | request-response  | same                            | role-match    |
| `src/cloud/gdpr.js` (NEW; stub)        | client (RPC)   | request-response  | same                            | role-match    |
| `src/cloud/claims-admin.js` (NEW; stub) | client (RPC)  | request-response  | same                            | role-match    |
| `src/cloud/retry.js` (NEW; stub)       | utility        | sync transform    | `src/util/hash.js` (small leaf w/ try/catch) | role-match |
| `src/observability/sentry.js` (NEW; stub) | utility     | event-driven      | `src/firebase/check.js` (no-op stub pattern) | role-match |
| `src/observability/audit-events.js` (NEW; stub) | constants table | n/a       | `data/pillars.js` (static-data shape)    | role-match    |
| `tests/data/*.test.js` (NEW per wrapper) | test         | mock firebase/db.js | `tests/data/cloud-sync.test.js` | exact   |
| `eslint.config.js` (MODIFIED; Wave 3 flip) | lint config | n/a              | self                             | self-edit     |

### Wave 4 — `views/*` (12 views)

| New / Modified File                       | Role       | Data Flow          | Closest Analog                          | Match Quality |
| ----------------------------------------- | ---------- | ------------------ | --------------------------------------- | ------------- |
| `src/views/auth.js` (NEW)                 | view       | sync render        | `app.js:951-1184` (current renderAuth)  | exact (move)  |
| `src/views/dashboard.js` (NEW)            | view       | sync render + queueMicrotask Chart | `app.js:1215-1591`        | exact (move)  |
| `src/views/diagnostic.js` (NEW)           | view       | sync render        | `app.js:1592-1953`                      | exact (move)  |
| `src/views/pillar.js` (NEW)               | view       | sync render        | `app.js:1659-1953`                      | exact (move)  |
| `src/views/actions.js` (NEW)              | view       | sync render        | `app.js:1981-2122`                      | exact (move)  |
| `src/views/engagement.js` (NEW)           | view       | sync render        | `app.js:2123-2225`                      | exact (move)  |
| `src/views/report.js` (NEW)               | view       | sync render + queueMicrotask Chart | `app.js:2226-2408`        | exact (move)  |
| `src/views/admin.js` (NEW)                | view       | sync render        | `app.js:2413-2599`                      | exact (move)  |
| `src/views/documents.js` (NEW)            | view       | onSnapshot live    | `app.js:2734-2876` (uses `ui/upload.js`) | exact (move) |
| `src/views/chat.js` (NEW)                 | view       | onSnapshot live    | `app.js:2878-3026`                      | exact (move)  |
| `src/views/roadmap.js` (NEW)              | view       | onSnapshot live    | `app.js:3045-3324`                      | exact (move)  |
| `src/views/funnel.js` (NEW)               | view       | onSnapshot live + KPI | `app.js:3325-3800`                   | exact (move)  |
| `tests/views/*.test.js` (per view)        | test       | DOM render         | `tests/views/dashboard.test.js`         | exact         |
| `styles.css` (MODIFIED; new classes)      | stylesheet | n/a                | `:root` + section-banner pattern        | exact         |
| `eslint.config.js` (MODIFIED; Wave 4 flip) | lint config | n/a               | self                                     | self-edit     |

### Wave 5 — `state.js` + `router.js` + `main.js` + app.js death

| New / Modified File          | Role             | Data Flow      | Closest Analog                                          | Match Quality |
| ---------------------------- | ---------------- | -------------- | ------------------------------------------------------- | ------------- |
| `src/state.js` (NEW)         | state singleton  | mutable        | `app.js:563-577` (current `state` object)               | exact (move)  |
| `src/router.js` (NEW)        | dispatcher       | event-driven   | `app.js:618-622` (`setRoute`) + `app.js:668-689` (`renderRoute`) | exact (move) |
| `src/main.js` (NEW)          | entry point      | sync init      | `app.js:5466-5494` (current `init()` + DOMContentLoaded) | exact (move) |
| `index.html` (MODIFIED; src flip) | shell       | n/a            | self (`index.html:24-26`)                                | self-edit     |
| `app.js` (DELETED)           | n/a              | n/a            | n/a (terminal commit)                                    | n/a           |

### Wave 6 — Cleanup

| Modified File                                | Role           | Data Flow | Closest Analog                                                  | Match Quality |
| -------------------------------------------- | -------------- | --------- | --------------------------------------------------------------- | ------------- |
| `vite.config.js` (D-21 thresholds)           | build/test config | n/a    | self (`vite.config.js:50-57`)                                   | self-edit     |
| `eslint.config.js` (final hardening)         | lint config    | n/a       | self                                                             | self-edit     |
| `src/util/ids.js` (CODE-11 Math.floor)       | utility        | n/a       | self (`src/util/ids.js:13-22`)                                  | self-edit     |
| `src/data/migration.js` (CODE-13 dead code)  | service        | n/a       | self (`src/data/migration.js`)                                  | self-edit     |
| `runbooks/phase-4-cleanup-ledger.md`         | doc            | n/a       | self                                                             | self-edit     |
| `SECURITY.md`                                | doc            | n/a       | per-wave atomic-commit pattern (Phase 1 D-25 / Phase 3 D-15)    | role-match    |

---

## Pattern Assignments

### Wave 1: `src/firebase/app.js` + `auth.js` + `db.js` + `storage.js` + `functions.js` (adapter, sync init)

**Analog:** `firebase-init.js` (root, lines 1-91 — to be deleted in same Wave 1 commit per D-05)

**Imports pattern (npm-import; replaces `https://www.gstatic.com/...` URLs at firebase-init.js:6-35):**

```js
// firebase-init.js:6-35 — REPLACE with bare-specifier npm imports.
// Phase 4 D-05: per-feature submodule split + npm pin (chart.js@4.x equivalent
// for firebase too — verify exact firebase pin against .planning/research/STACK.md).
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  // ...
  onSnapshot,
  serverTimestamp,
  limit,
} from "firebase/firestore";
```

**Config + sync-init pattern (eager init at module load, D-06):**

```js
// firebase-init.js:37-49 — copy verbatim into src/firebase/app.js, then add
// initAppCheck slot per D-07 BEFORE getAuth/getFirestore/etc. exports.
const firebaseConfig = {
  apiKey: "AIzaSyDV3RNRFxAoVkSHOMyfl6HqgGTwaenLYfY",
  authDomain: "bedeveloped-base-layers.firebaseapp.com",
  projectId: "bedeveloped-base-layers",
  storageBucket: "bedeveloped-base-layers.firebasestorage.app",
  messagingSenderId: "76749944951",
  appId: "1:76749944951:web:9d0db9603ecaa7cc5fee72",
};

const app = initializeApp(firebaseConfig);
// initAppCheck(app); // Phase 7 (FN-04) wires the body — see src/firebase/check.js (D-07)
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
```

**Per-feature submodule export pattern (D-05 — split the bag):**

```js
// firebase-init.js:56-80 — REPLACE the window.FB-shaped object literal with
// per-feature ESM exports across {app,auth,db,storage,functions,check}.js.
// Each submodule exports its instance + the SDK helpers it owns:
// src/firebase/db.js:
import { app } from "./app.js";
import { getFirestore, collection, doc, /* ... */ onSnapshot } from "firebase/firestore";
export const db = getFirestore(app);
export { collection, doc, /* ... */ onSnapshot };
```

**`onSnapshot` wrapper for `data/*` to compose (D-10):**

```js
// New in src/firebase/db.js — wraps onSnapshot with onError + unsubscribe contract
// matching the Promise-CRUD-+-subscribe API surface D-10 fixes for data/*.
/**
 * @param {*} ref
 * @param {{ onChange: (snap:any) => void, onError: (err:Error) => void }} cb
 * @returns {() => void}
 */
export function subscribeDoc(ref, { onChange, onError }) {
  return onSnapshot(ref, onChange, onError);
}
```

**Auth-state-changed bridge (preserves firebase-init.js:82-90 dispatch):**

```js
// firebase-init.js:82-90 — keeps the firebase-ready event dispatch but moves
// to src/firebase/auth.js. Phase 6 (AUTH-14) replaces signInAnonymously with
// real Email/Password sign-in; Phase 4 keeps the substrate.
onAuthStateChanged(auth, (u) => {
  if (u) {
    // Phase 4: shift currentUser off `window.FB` onto an exported state setter
    window.dispatchEvent(new Event("firebase-ready"));
  }
});
signInAnonymously(auth).catch((e) => console.error("Firebase anon sign-in failed:", e));
```

**Critical:** `firebase-init.js` is **deleted** in the same commit. The terminal Wave 1 commit must remove `index.html:24` (`<script type="module" src="firebase-init.js?v=50">`) — `src/main.js` will import `src/firebase/app.js` first instead (Wave 5 wires this; Wave 1 only needs the new modules + the test guard).

---

### Wave 1: `src/firebase/check.js` (adapter; no-op stub for Phase 7)

**Analog:** `src/util/hash.js` (small leaf with explicit Phase-X-deletes-this comment)

**No-op stub pattern (D-07):**

```js
// src/firebase/check.js
// @ts-check
// Phase 7 (FN-04) replaces the body with:
//   initializeAppCheck(app, {
//     provider: new ReCaptchaEnterpriseProvider(siteKey),
//     isTokenAutoRefreshEnabled: true,
//   })
// Phase 4 (D-07): no-op stub. The exported function exists so src/firebase/app.js
// can call initAppCheck(app) at boot — Phase 7 fills the body, zero adapter-shape change.

/** @param {*} _app */
export function initAppCheck(_app) {
  /* Phase 7 body lands here */
}
```

The `// Phase 6 (AUTH-14) deletes this whole module` line at `src/util/hash.js:4` is the canonical comment-template for stub modules. Adapt to "Phase 7 (FN-04) fills the body" / "Phase 8 fills the body" / "Phase 9 fills the body" depending on which downstream phase owns the seam.

---

### Wave 1: `src/util/ids.js` (MODIFIED — CODE-03 swap)

**Analog:** Self — body-only edit at `src/util/ids.js:6-8`.

**Before (current state at `src/util/ids.js:6-8`):**

```js
export const uid = (p = "") =>
  // eslint-disable-next-line no-restricted-syntax -- Phase 4: replace with crypto.randomUUID(). See runbooks/phase-4-cleanup-ledger.md
  p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
```

**After (CODE-03 swap):**

```js
// Drop the eslint-disable line; close the cleanup-ledger row at src/util/ids.js:7
// (per the canonical ledger entry at runbooks/phase-4-cleanup-ledger.md:23).
export const uid = (p = "") =>
  p + crypto.randomUUID().replace(/-/g, "").slice(0, 11);
// Or keep the prefix+suffix shape if uid IDs are surfaced anywhere:
//   p + crypto.randomUUID().slice(0, 8) + Date.now().toString(36).slice(-4);
// Choose to preserve the existing ID-shape audit trail (D-12 faithful extraction).
```

**Test impact:** `tests/util/ids.test.js:23-37` pins `uid("u_") === "u_ihs00"` under Math.random=0.5 + frozen Date.now mocks. After the swap, `tests/setup.js:14-20` already mocks `crypto.randomUUID` (counter-backed). The expected value changes — update the test expectation atomically with the body change. Remove `vi.spyOn(Math, "random").mockReturnValue(0.5)` from `tests/setup.js:22` if no other call sites need it (Phase 4 may track that decision).

---

### Wave 1: `tests/index-html-meta-csp.test.js` (D-18 schema test)

**Analog:** `tests/firebase-config.test.js` (lines 1-58 — exact pattern)

**Imports + schema-read pattern (`tests/firebase-config.test.js:1-15`):**

```js
// @ts-check
// Phase 4 (CODE-01 / D-18): regression guard for T-3-meta-csp-conflict — the
// Phase 3 cleanup-ledger row that closes when this test lands. Index.html must
// not regrow a <meta http-equiv="Content-Security-Policy"> tag (would conflict
// with the firebase.json header CSP).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync(resolve(process.cwd(), "index.html"), "utf-8");

describe("index.html — meta CSP regression guard (T-3-meta-csp-conflict)", () => {
  it("contains zero <meta http-equiv='Content-Security-Policy'> tags", () => {
    // Case-insensitive; tolerates extra whitespace around `=` and the attr value
    // single/double quotes.
    expect(/<meta[^>]+http-equiv\s*=\s*["']Content-Security-Policy["']/i.test(html))
      .toBe(false);
  });
});
```

The describe-it-each style at `tests/firebase-config.test.js:44-58` is the canonical block-of-attributes assertion shape if you want to expand the test to cover additional `<meta>` tag prohibitions later (e.g., `<meta http-equiv="X-Frame-Options">` is also typically header-only).

---

### Wave 2: `src/ui/dom.js` (utility; CODE-04 deletes `html:` branch)

**Analog:** `app.js:528-547` (current `h()` helper) + `src/util/ids.js` (small leaf module shape)

**Before (current state at `app.js:528-547`):**

```js
const h = (tag, attrs = {}, children = []) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    // eslint-disable-next-line no-unsanitized/property -- Phase 4: replace innerHTML with replaceChildren() / DOMPurify.sanitize(). See runbooks/phase-4-cleanup-ledger.md
    else if (k === "html") el.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (v === false || v === null || v === undefined) continue;
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  // ...
};
```

**After (CODE-04 — delete the `html:` branch + the eslint-disable):**

```js
// src/ui/dom.js
// @ts-check
// Phase 4 (CODE-04 / D-13 of context): byte-identical to app.js:528-547 EXCEPT
// the `html:` branch is DELETED. Closes the cleanup-ledger row at app.js:676.
// The XSS regression test at tests/ui/dom.test.js asserts <script> and <img onerror>
// payloads render as text content.

/**
 * @param {string} tag
 * @param {Record<string, any>} [attrs]
 * @param {*} [children]
 * @returns {HTMLElement}
 */
export const h = (tag, attrs = {}, children = []) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    // `html:` branch DELETED (CODE-04). Use children for text/element content.
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (v === false || v === null || v === undefined) continue;
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c === null || c === undefined || c === false) return;
    if (typeof c === "string" || typeof c === "number")
      el.appendChild(document.createTextNode(c));
    else el.appendChild(c);
  });
  return el;
};

/** @param {string} sel @param {ParentNode} [el] */
export const $ = (sel, el = document) => el.querySelector(sel);

/** @param {string} sel @param {ParentNode} [el] */
export const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
```

---

### Wave 2: `tests/ui/dom.test.js` (XSS regression — permanent fixture per CODE-04)

**Analog:** `tests/auth/state-machine.test.js:1-14` (regression-baseline doc-comment style)

**Doc-comment + assertion pattern:**

```js
// tests/ui/dom.test.js
// @ts-check

/**
 * REGRESSION FIXTURE — permanent (CODE-04)
 *
 * The `html:` escape hatch in h() was deleted in Phase 4 (CONCERNS C4 closure).
 * These payloads MUST render as text content forever — any future ESLint
 * disable that re-enables innerHTML in a new file should fail this test
 * even if the test wasn't updated for that file (because the dom.js attribute
 * surface no longer takes `html:`).
 *
 * Citations: OWASP ASVS V5.3 (Output Encoding / XSS prevention).
 */

import { describe, it, expect } from "vitest";
import { h } from "../../src/ui/dom.js";

describe("h() XSS-regression payloads (CODE-04)", () => {
  it("renders <script> tags inside string children as text content, not as DOM script", () => {
    const el = h("div", {}, '<script>window.__xss = true</script>');
    document.body.appendChild(el);
    expect(el.textContent).toBe('<script>window.__xss = true</script>');
    expect(el.querySelector("script")).toBeNull();
    expect(/** @type {*} */ (window).__xss).toBeUndefined();
  });

  it("renders <img onerror=...> as text content, not as a DOM <img>", () => {
    const el = h("div", {}, '<img src=x onerror="window.__xss=true">');
    document.body.appendChild(el);
    expect(el.querySelector("img")).toBeNull();
  });

  it("does NOT honour any attribute named 'html' (the branch was deleted)", () => {
    // @ts-expect-error — purposely passing the deleted attr; runtime ignores.
    const el = h("div", { html: '<b>not honoured</b>' });
    expect(el.textContent).toBe(""); // no children consumed; html: is now opaque
    expect(el.querySelector("b")).toBeNull();
  });
});
```

---

### Wave 2: `src/ui/modal.js` (utility; extraction without behavioural change)

**Analog:** `app.js:550-616` (existing `modal` + `promptText` + `confirmDialog` — extract verbatim per D-12 faithful extraction)

**Mount-into-#modalRoot pattern (`app.js:550-562`):**

```js
// src/ui/modal.js
// @ts-check
// Phase 4 (D-12): byte-identical extraction from app.js:550-616.
// D-13 of context: NO new `confirm()` / `prompt()` replacement helpers — the
// codebase has zero confirm()/prompt() sites today. The existing custom modal
// stays as-is.
import { h } from "./dom.js";

/** @param {(HTMLElement|string|null|false)[]} content */
export function modal(content) {
  const root = /** @type {HTMLElement} */ (document.getElementById("modalRoot"));
  root.innerHTML = ""; // CODE-05 candidate; D-12 keeps faithful extraction this wave
  const wrap = h("div", { class: "modal" }, content);
  root.appendChild(wrap);
  root.classList.remove("hidden");
  /** @param {Event & { isProgrammatic?: boolean }} ev */
  const close = (ev) => {
    if (ev && ev.target !== root && !ev.isProgrammatic) return;
    root.classList.add("hidden");
    root.innerHTML = "";
    root.removeEventListener("click", /** @type {EventListener} */ (close));
  };
  root.addEventListener("click", /** @type {EventListener} */ (close));
  return {
    close: () => {
      const ev = /** @type {*} */ (new Event("click"));
      ev.isProgrammatic = true;
      Object.defineProperty(ev, "target", { value: root });
      close(ev);
    },
  };
}

// promptText() and confirmDialog() copy verbatim from app.js:573-616.
// They both call h() (now imported from ./dom.js) and modal() (defined above).
```

**Note for planner:** `modal()` uses `root.innerHTML = ""` (`app.js:552, 559`). CODE-05 (17 sites) lists this as a candidate but D-12 says preserve byte-identical at extraction time. Mark it as a forward-tracking row in the cleanup ledger; Wave 4 can fold the `replaceChildren()` swap when this file naturally re-enters scope alongside the views that consume it.

---

### Wave 2: `src/ui/toast.js` (utility; NEW per D-13)

**Analog:** `app.js:550-571` (existing `modal()` mount-into-root pattern)

**Container-once + level-aware notify pattern (D-13, D-14):**

```js
// src/ui/toast.js
// @ts-check
// Phase 4 (D-13/D-14): NEW. Replaces 7 alert() sites (CODE-07) — see
// CONTEXT.md `<code_context>` "Pre-Flight Verifications" §7. notify() shape
// is intentionally minimal — Phase 9 may extend opts to carry an auditEvent
// shape that wires through observability/audit-events.js (CONTEXT.md
// `<specifics>` 7th bullet).
import { h } from "./dom.js";

/** @typedef {"info"|"success"|"warn"|"error"} ToastLevel */

const SYMBOLS = /** @type {Record<ToastLevel,string>} */ ({
  info: "ⓘ", success: "✓", warn: "⚠", error: "✕",
});
const ROLE = /** @type {Record<ToastLevel,string>} */ ({
  info: "status", success: "status", warn: "status", error: "alert",
});
const AUTO_DISMISS_MS = /** @type {Record<ToastLevel,number|null>} */ ({
  info: 4000, success: 4000, warn: 7000, error: null, // error sticks until manual close
});
const MAX_VISIBLE = 3;

/** @returns {HTMLElement} */
function ensureContainer() {
  let root = document.getElementById("toastRoot");
  if (!root) {
    root = h("aside", { id: "toastRoot", class: "toast-root", "aria-live": "polite" });
    document.body.appendChild(root);
  }
  return /** @type {HTMLElement} */ (root);
}

/**
 * @param {ToastLevel} level
 * @param {string} message
 * @param {{ persist?: boolean }} [opts]
 */
export function notify(level, message, opts = {}) {
  const root = ensureContainer();
  // Cap at MAX_VISIBLE — evict oldest non-error first (D-14)
  const existing = Array.from(root.querySelectorAll(".toast"));
  if (existing.length >= MAX_VISIBLE) {
    const evictable = existing.find((t) => t.getAttribute("data-level") !== "error");
    if (evictable) evictable.remove();
  }

  const closeBtn = h("button", { class: "toast-close", "aria-label": "Dismiss" }, "×");
  const node = h(
    "div",
    { class: `toast toast-${level}`, role: ROLE[level], "data-level": level },
    [
      h("span", { class: "toast-icon" }, SYMBOLS[level]),
      h("span", { class: "toast-message" }, message),
      closeBtn,
    ],
  );
  closeBtn.addEventListener("click", () => node.remove());

  root.appendChild(node);

  const dismissMs = AUTO_DISMISS_MS[level];
  if (dismissMs && !opts.persist) {
    let timer = setTimeout(() => node.remove(), dismissMs);
    // Pause-on-hover (D-14)
    node.addEventListener("mouseenter", () => clearTimeout(timer));
    node.addEventListener("mouseleave", () => {
      timer = setTimeout(() => node.remove(), dismissMs);
    });
  }

  // Focus the close button on errors (D-14 a11y win for keyboard users)
  if (level === "error") closeBtn.focus();
}
```

**Companion `styles.css` additions (D-13 `--toast-bg-*` custom properties + container styles):**

```css
/* styles.css — append in :root token block (lines 7-49) */
:root {
  /* ...existing tokens... */
  --toast-bg-info:    color-mix(in srgb, var(--brand) 12%, var(--surface));
  --toast-bg-success: color-mix(in srgb, var(--green) 12%, var(--surface));
  --toast-bg-warn:    color-mix(in srgb, var(--amber) 14%, var(--surface));
  --toast-bg-error:   color-mix(in srgb, var(--red) 12%, var(--surface));
}
.toast-root { position: fixed; top: 16px; right: 16px; display: flex; flex-direction: column; gap: 8px; z-index: 1000; }
.toast { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border: 1px solid var(--line-2); border-radius: var(--radius-sm); box-shadow: var(--shadow-sm); }
.toast-info    { background: var(--toast-bg-info); }
.toast-success { background: var(--toast-bg-success); }
.toast-warn    { background: var(--toast-bg-warn); }
.toast-error   { background: var(--toast-bg-error); }
.toast-close { border: 0; background: transparent; cursor: pointer; font-size: 18px; padding: 0 4px; }
@media (max-width: 600px) {
  .toast-root { left: 16px; right: 16px; top: 16px; }
  .toast { width: 100%; }
}
```

---

### Wave 2: `src/ui/upload.js` (utility; NEW per D-15/D-16)

**Analog:** `src/auth/state-machine.js:14-17` (Promise-returning DI helper) + `app.js:3433-3465` (current upload site for context only)

**Allowlist + magic-byte signature table (D-16):**

```js
// src/ui/upload.js
// @ts-check
// Phase 4 (D-15/D-16, CODE-09): NEW client-side validation BEFORE data/documents.js.
// The allowlist constant is exported so server-side enforcement (Phase 5
// storage.rules + Phase 7 callable validation) can reference the same source
// of truth — single allowlist, multiple enforcement points (CONTEXT.md
// `<specifics>` 8th bullet).

/** @typedef {"application/pdf"|"image/jpeg"|"image/png"|
 *   "application/vnd.openxmlformats-officedocument.wordprocessingml.document"|
 *   "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"|
 *   "text/plain"} AllowedMime */

/** @type {ReadonlySet<AllowedMime>} */
export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

export const MAX_BYTES = 25 * 1024 * 1024; // 25 MB (CODE-09)

/** @typedef {{ ok: true, sanitisedName: string } | { ok: false, reason: string }} ValidateResult */

/**
 * Magic-byte signature table (D-16). Returns the detected MIME, or null.
 * @param {Uint8Array} bytes
 * @param {string} declaredType
 * @returns {AllowedMime|null}
 */
function detectMime(bytes, declaredType) {
  // PDF: 25 50 44 46 2D
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d) {
    return "application/pdf";
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return "image/png";
  }
  // ZIP container (DOCX/XLSX): 50 4B 03 04 — disambiguate via declaredType
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    if (declaredType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    }
    if (declaredType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }
  }
  // TXT: no magic bytes; UTF-8 + extension check (D-16)
  if (declaredType === "text/plain" && !bytes.includes(0x00)) return "text/plain";
  return null;
}

/**
 * @param {string} name
 * @returns {string}
 */
function sanitiseName(name) {
  // CODE-09 spec verbatim
  return String(name).replace(/[^\w.\- ]/g, "_").slice(0, 200);
}

/**
 * @param {File} file
 * @returns {Promise<ValidateResult>}
 */
export async function validateUpload(file) {
  if (!file) return { ok: false, reason: "No file selected." };
  if (file.size > MAX_BYTES) {
    return { ok: false, reason: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB > 25 MB).` };
  }
  if (!ALLOWED_MIME_TYPES.has(/** @type {AllowedMime} */ (file.type))) {
    return { ok: false, reason: `File type ${file.type || "(unknown)"} not allowed.` };
  }
  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const detected = detectMime(head, file.type);
  if (!detected) return { ok: false, reason: "Unrecognised file content (magic-byte sniff failed)." };
  if (detected !== file.type) {
    return { ok: false, reason: `File type mismatch — declared ${file.type} but content looks like ${detected}.` };
  }
  return { ok: true, sanitisedName: sanitiseName(file.name) };
}
```

---

### Wave 3: `src/data/orgs.js` (service; CRUD + onSnapshot — full owner per D-09)

**Analog:** `src/data/cloud-sync.js` (existing Pattern-D DI Promise wrapper + `// @ts-check` + JSDoc)

**Imports + DI surface (`src/data/cloud-sync.js:1-22`):**

```js
// src/data/orgs.js
// @ts-check
// Phase 4 (D-09 / D-10 / D-12): full CRUD owner per D-09. Phase 5 (DATA-01..06)
// rewrites this body to use subcollection access (orgs/{orgId}/{collection})
// — the Promise-CRUD-+-subscribe API surface stays stable across the cutover.
//
// IMPORTANT: data/responses.js, comments.js, actions.js, documents.js,
// messages.js, audit-events.js are pass-throughs that delegate here per D-09.
// Phase 5 replaces ALL of those bodies + this body in one wave.
import { db, collection, doc, setDoc, getDoc, getDocs, deleteDoc, onSnapshot, serverTimestamp } from "../firebase/db.js";

/**
 * @param {string} orgId
 * @returns {Promise<any|null>}
 */
export async function getOrg(orgId) {
  const snap = await getDoc(doc(db, "orgs", orgId));
  return snap.exists() ? snap.data() : null;
}

/**
 * @returns {Promise<Array<any>>}
 */
export async function listOrgs() {
  const out = [];
  const snap = await getDocs(collection(db, "orgs"));
  snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
  return out;
}

/**
 * @param {*} org
 * @returns {Promise<void>}
 */
export async function saveOrg(org) {
  await setDoc(doc(db, "orgs", org.id), { ...org, updatedAt: serverTimestamp() }, { merge: true });
}

/**
 * @param {string} orgId
 * @returns {Promise<void>}
 */
export async function deleteOrg(orgId) {
  await deleteDoc(doc(db, "orgs", orgId));
}

/**
 * @param {{ onChange: (orgs: Array<any>) => void, onError: (err: Error) => void }} cb
 * @returns {() => void}
 */
export function subscribeOrgs({ onChange, onError }) {
  return onSnapshot(
    collection(db, "orgs"),
    (snap) => {
      const out = [];
      snap.forEach((d) => out.push({ id: d.id, ...d.data() }));
      onChange(out);
    },
    onError,
  );
}
```

**Pass-through pattern (D-09) — for `responses.js`, `comments.js`, `actions.js`, `documents.js`, `messages.js`, `audit-events.js`:**

```js
// src/data/comments.js
// @ts-check
// Phase 4 (D-09 / D-12): pass-through to data/orgs.js's nested-map shape.
// Phase 5 (DATA-01..06) replaces this body with subcollection access
// (orgs/{orgId}/comments/{commentId}); the API surface stays stable —
// views/* never re-extract their consumption pattern.
//
// Cleanup-ledger row: "Phase 5 replaces body with subcollection access;
// data/comments.js API stable" — closes at Phase 5.
import { getOrg, saveOrg } from "./orgs.js";

/**
 * @param {string} orgId
 * @param {number|string} pillarId
 * @returns {Promise<Array<any>>}
 */
export async function listComments(orgId, pillarId) {
  const org = await getOrg(orgId);
  return ((org?.comments || {})[pillarId] || []).slice();
}

/**
 * @param {string} orgId
 * @param {number|string} pillarId
 * @param {*} comment
 * @returns {Promise<void>}
 */
export async function addComment(orgId, pillarId, comment) {
  const org = await getOrg(orgId);
  if (!org) return;
  org.comments = org.comments || {};
  org.comments[pillarId] = org.comments[pillarId] || [];
  org.comments[pillarId].push(comment);
  await saveOrg(org);
}
```

---

### Wave 3: `src/cloud/audit.js` + `soft-delete.js` + `gdpr.js` + `claims-admin.js` + `retry.js` (no-op stubs per D-11)

**Analog:** `src/firebase/check.js` (no-op stub pattern from D-07) + `src/util/hash.js` (Phase-X delete note)

**Empty stub seam pattern (D-11):**

```js
// src/cloud/audit.js
// @ts-check
// Phase 4 (D-11): empty stub seam. Phase 7 (FN-04) replaces the body with
// real httpsCallable wiring through src/firebase/functions.js (the auditWrite
// callable). API surface defined here so that src/observability/audit-events.js
// (also a Phase 9 stub) can import these signatures today.
//
// Cleanup-ledger row: "Phase 7 wires src/cloud/audit.js body" — closes at Phase 7.

/**
 * @param {{ event: string, payload?: any }} _input
 * @returns {Promise<void>}
 */
export async function writeAuditEvent(_input) {
  /* Phase 7 body lands here (FN-04) */
}
```

---

### Wave 3: `src/observability/sentry.js` + `audit-events.js` (no-op stubs per D-11)

**Analog:** `src/firebase/check.js` (no-op stub) + `data/pillars.js` (static-data table shape, for `audit-events.js`)

**Constants table pattern (`audit-events.js`):**

```js
// src/observability/audit-events.js
// @ts-check
// Phase 4 (D-11): NEW constants table. Phase 7 (AUDIT-05) wires the actual
// emit calls in views/*; Phase 9 (AUDIT-05) populates the table with the
// canonical event-name set.

/** @type {Readonly<Record<string, string>>} */
export const AUDIT_EVENTS = Object.freeze({
  // Placeholder — Phase 7/9 replaces with the canonical set:
  // AUTH_SIGNIN_SUCCESS: "auth.signin.success",
  // DATA_ORG_DELETE:     "data.org.delete",
  // DATA_DOCUMENT_UPLOAD_FAILED: "data.document.upload.failed",
});

/**
 * @param {keyof typeof AUDIT_EVENTS|string} _event
 * @param {any} [_payload]
 */
export function emitAuditEvent(_event, _payload) {
  /* Phase 9 body lands here */
}
```

---

### Wave 3: `tests/data/orgs.test.js` and siblings (re-targets `vi.mock` to firebase/db.js)

**Analog:** `tests/data/cloud-sync.test.js` (lines 1-122 — exact pattern of in-memory store + DI deps factory)

**vi.mock retargeting pattern (per `tests/mocks/firebase.js:4-5` forward-compat note):**

```js
// tests/data/orgs.test.js
// @ts-check
// Phase 4 (D-11 forward-compat): the firebase mock factory at tests/mocks/firebase.js
// already supports either SDK direct mocks or src/firebase/db.js mocks. For Phase 4
// data/* tests, retarget vi.mock to '../../src/firebase/db.js'.
import { describe, it, expect, vi } from "vitest";
import { makeFirestoreMock } from "../mocks/firebase.js";

vi.mock("../../src/firebase/db.js", () => makeFirestoreMock({
  seed: { "orgs/o1": { id: "o1", name: "Acme" } },
}));

import { getOrg, listOrgs, saveOrg, subscribeOrgs } from "../../src/data/orgs.js";

describe("data/orgs.js", () => {
  it("getOrg returns the seeded doc", async () => {
    const o = await getOrg("o1");
    expect(o).toEqual({ id: "o1", name: "Acme" });
  });
  // ...
});
```

---

### Wave 4: `src/views/dashboard.js` (and 11 siblings — all `view`s)

**Analog:** `app.js:1215-1591` (current `renderDashboard` + chart drawing)

**Render-function shape + queueMicrotask Chart pattern (D-12 faithful extraction; CONVENTIONS preserved):**

```js
// src/views/dashboard.js
// @ts-check
// Phase 4 (D-12 faithful extraction): byte-identical move from app.js:1215-1591
// (current renderDashboard + drawRadar). queueMicrotask deferred chart draw
// preserved verbatim (CONVENTIONS.md "Re-render Strategy" — `app.js:1401`).
//
// Quick-wins folded in this wave (D-20):
// - CODE-05: replace `app.innerHTML = ""` and equivalents with `replaceChildren()`
// - CODE-06: extract `el.style.X` sites to CSS classes — see styles.css additions
// - CODE-07: replace `alert(...)` with `notify('error', ...)` from src/ui/toast.js
// - CODE-10: tab-title unread badge memoisation (this view owns the badge)
// - CODE-12: rel="noopener noreferrer" on download links (where applicable)

import { h } from "../ui/dom.js";
import { notify } from "../ui/toast.js";
import { pillarScore, pillarStatus, orgSummary } from "../domain/scoring.js"; // adjust per real surface
import { listOrgs, getOrg } from "../data/orgs.js";

/**
 * @param {*} user
 * @param {*} org
 * @returns {HTMLElement}
 */
export function renderDashboard(user, org) {
  // ... body byte-identical with app.js:1215-1591, except:
  //   - import-cited helpers replace closure-captured ones
  //   - alert(...) → notify('error', ...)
  //   - innerHTML="" → replaceChildren()
  //   - style="..." inline strings → class names declared in styles.css
  // ...
}
```

**Test pattern — `tests/views/dashboard.test.js` (already exists; pattern stays):**

The current `tests/views/dashboard.test.js` (read above) imports `app.js` and snapshots the rendered HTML. After Wave 5, it will import `src/main.js` instead — but Wave 4 keeps the test pinned to `app.js` until app.js dies. The snapshot baseline at `tests/__snapshots__/views/dashboard.html` MUST not diff (D-12 faithful extraction, Phase 2 D-08 baseline).

**Per-view test addition pattern (Claude's discretion D-21 ":80% src/views/**"):**

```js
// tests/views/chat.test.js  (NEW per Wave 4)
// @ts-check
// Phase 4 (D-21): per-view test added when Wave 4 extracts. Snapshot fixture
// extension TBD (Claude's discretion per CONTEXT.md `<discretion>` final two
// bullets).
```

---

### Wave 5: `src/state.js` + `src/router.js` + `src/main.js` (final extraction)

**Analog (state.js):** `app.js:563-577` (current `state` object) — extract verbatim

```js
// src/state.js
// @ts-check
// Phase 4 (D-02 / D-12): byte-identical extraction from app.js:563-577.
// The IIFE no longer captures `state` — it imports from here. Phase 6 (AUTH-14)
// will tighten state.session shape when Firebase Auth replaces the local-allowlist
// substrate.

/** @type {*} */
export const state = {
  mode: localStorage.getItem("baselayers:mode") || "internal",
  route: "dashboard",
  orgId: null,
  pillarId: null,
  chart: null,
  userMenuOpen: false,
  authTab: "signin",
  authError: null,
  expandedPillars: new Set(),
  chatMessages: [],
  chatSubscription: null,
  chatSubscribedFor: null,
};
```

**Analog (router.js):** `app.js:618-622` (`setRoute`) + `app.js:627-689` (`render`/`renderRoute`)

```js
// src/router.js
// @ts-check
// Phase 4 (D-02 / D-12): byte-identical extraction from app.js:618-689.
// renderRoute imports each view from src/views/* (Wave 4 extracted them).

import { state } from "./state.js";
import { h } from "./ui/dom.js";
import { renderDashboard } from "./views/dashboard.js";
// ... 11 more view imports

export function setRoute(route) {
  state.route = route;
  render();
}

export function render() {
  // body byte-identical with app.js:627-666
}

/** @param {HTMLElement} main @param {*} user @param {*} org */
export function renderRoute(main, user, org) {
  // body byte-identical with app.js:668-689
}
```

**Analog (main.js):** `app.js:5466-5494` (init() + DOMContentLoaded auto-start)

```js
// src/main.js
// @ts-check
// Phase 4 (D-06 critical): src/firebase/app.js MUST be imported FIRST so that
// initializeApp + initAppCheck run before any data/* or views/* code touches
// the SDK. Phase 7 (FN-04) wires the App Check body without re-ordering this.
import "./firebase/app.js";
import { migrateV1IfNeeded, clearOldScaleResponsesIfNeeded } from "./data/migration.js";
import { syncFromCloud } from "./data/cloud-sync.js";
import { render } from "./router.js";
// ... etc

function init() {
  // body byte-identical with app.js:5466-5494
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
```

**`index.html` flip (terminal Wave 5 commit, D-03):**

```html
<!-- index.html:24-26 — REPLACE -->
<!--   <script type="module" src="firebase-init.js?v=50"></script>  DELETED in Wave 1 -->
<!--   <script src="data/pillars.js?v=50"></script>                 keep or move to src/data/pillars.js per Claude's discretion -->
<!--   <script type="module" src="./app.js?v=50"></script>          REPLACE with: -->
<script type="module" src="./src/main.js?v=51"></script>
```

The `app.js` deletion is the same commit. Pre/post snapshot diff against `tests/__snapshots__/views/{dashboard,diagnostic,report}.html` is the verification gate (must show zero diff).

---

### Wave 6: `vite.config.js` (D-21 per-directory thresholds)

**Analog:** Self — `vite.config.js:50-57`

**Before:**

```js
thresholds: {
  // DO NOT add a global threshold key — app.js is excluded by design until
  // the Phase 4 modular split. See decision D-15 in 02-CONTEXT.md.
  "src/domain/**": { lines: 100, branches: 100, functions: 100, statements: 100 },
  "src/util/**":   { lines: 100, branches: 100, functions: 100, statements: 100 },
  "src/auth/**":   { lines: 95,  branches: 95,  functions: 95,  statements: 95 },
  "src/data/**":   { lines: 90,  branches: 90,  functions: 90,  statements: 90 },
},
```

**After (D-21):**

```js
thresholds: {
  // Global threshold still NOT set — firebase/, cloud/, observability/ are
  // excluded by design (Phase 4 D-21).
  "src/domain/**":        { lines: 100, branches: 100, functions: 100, statements: 100 },
  "src/util/**":          { lines: 100, branches: 100, functions: 100, statements: 100 },
  "src/auth/**":          { lines: 95,  branches: 95,  functions: 95,  statements: 95 },
  "src/data/**":          { lines: 95,  branches: 95,  functions: 95,  statements: 95 }, // raised from 90
  "src/ui/**":            { lines: 100, branches: 100, functions: 100, statements: 100 }, // NEW
  "src/views/**":         { lines: 80,  branches: 80,  functions: 80,  statements: 80 },  // NEW
  "src/state.js":         { lines: 90,  branches: 90,  functions: 90,  statements: 90 },  // NEW
  "src/router.js":        { lines: 90,  branches: 90,  functions: 90,  statements: 90 },  // NEW
  "src/main.js":          { lines: 90,  branches: 90,  functions: 90,  statements: 90 },  // NEW
  // src/firebase/**, src/cloud/**, src/observability/** EXCLUDED in Phase 4 per D-21.
},
```

Coverage exclude block (`vite.config.js:38-49`) gets `app.js` and `firebase-init.js` rows REMOVED (both files are deleted by end of Phase 4). Add `src/firebase/**`, `src/cloud/**`, `src/observability/**` to the exclude block.

---

### Waves 1–6: `eslint.config.js` (D-04 per-wave warn→error flips)

**Analog:** Self — `eslint.config.js:107-123` (current warn-mode skeleton)

**Wave 1 flip (closes `firebase/firestore | firebase/storage | firebase/auth | firebase/app-check` to error, narrowed to non-`src/firebase/*` files):**

```js
// eslint.config.js — extend the existing block at lines 107-123.
// Wave 1: change "warn" to "error" AND scope it so src/firebase/* files
// can still import the SDK directly.

// Existing block (line 107) becomes a per-files-scoped error config:
{
  files: ["**/*.js"],
  ignores: ["src/firebase/**"], // only firebase/ may import the SDK
  rules: {
    "no-restricted-imports": [
      "error", // flipped from "warn"
      {
        patterns: [
          {
            group: ["firebase/firestore", "firebase/storage", "firebase/auth", "firebase/app-check"],
            message: "Import Firebase services through the firebase/ adapter (src/firebase/*).",
          },
        ],
      },
    ],
  },
},
```

**Wave 2 flip — add domain/* boundary:**

```js
// Wave 2: domain/* MUST NOT import firebase/*
{
  files: ["src/domain/**/*.js"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          { group: ["**/firebase/*", "../firebase/*", "../../firebase/*", "firebase/*"],
            message: "domain/* is pure logic — no Firebase imports allowed (ARCHITECTURE.md §2.4)." },
        ],
      },
    ],
  },
},
```

**Wave 3 flip — data/* limited to firebase/db.js + firebase/storage.js:**

```js
// Wave 3: data/* MUST only import firebase/db.js + firebase/storage.js (not direct SDK)
{
  files: ["src/data/**/*.js"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          { group: ["firebase/firestore", "firebase/storage", "firebase/auth", "firebase/app-check"],
            message: "data/* must access SDK only through src/firebase/db.js + src/firebase/storage.js." },
        ],
      },
    ],
  },
},
```

**Wave 4 flip — views/* allowlist (data, domain, auth, ui, cloud — no firebase/*):**

```js
// Wave 4: views/* import allowlist
{
  files: ["src/views/**/*.js"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          { group: ["**/firebase/*", "../firebase/*", "../../firebase/*", "firebase/*"],
            message: "views/* may import data/, domain/, auth/, ui/, cloud/ — never firebase/* directly." },
        ],
      },
    ],
  },
},
```

**Wave 6 final:** Verify the eslint config has zero `"warn"` strings remaining for `no-restricted-imports`. Close the ledger row "no-restricted-imports warn→error" — was open since Phase 1 D-26 / `runbooks/phase-4-cleanup-ledger.md:56`.

---

## Shared Patterns (cross-cutting)

### Module-header preamble (every NEW src/*.js file)

**Source:** `src/util/ids.js:1-8` and `src/data/cloud-sync.js:1-22` (canonical preamble with `// @ts-check` + Phase-N D-X provenance + JSDoc)

**Apply to:** Every new `src/firebase/*`, `src/ui/*`, `src/data/*`, `src/cloud/*`, `src/observability/*`, `src/views/*`, `src/state.js`, `src/router.js`, `src/main.js`.

**Template:**

```js
// src/<dir>/<file>.js
// @ts-check
// Phase 4 (D-XX / CODE-YY): <byte-identical-extraction|new-helper|stub>
// from app.js:<lines> (planner-cited). <Behavioural-preservation note from D-12.>
// <Cleanup-ledger row reference if applicable: "closes runbooks/phase-4-cleanup-ledger.md row at app.js:<line>".>

import { ... } from "../<dir>/<file>.js";

/**
 * @param {*} <param> JSDoc-was-`any` (D-06): rationale here.
 * @returns {<type>}
 */
export function <name>(<params>) { ... }
```

### Pattern D — dependency injection for IIFE-resident helpers

**Source:** `src/data/migration.js:8-18` (full DI bundle) + `src/data/cloud-sync.js:8-19` (full DI bundle) + `src/auth/state-machine.js:13` (single-DI param shape)

**Apply to:** Any view that imports a `data/*` wrapper but the wrapper still depends on a helper currently in the IIFE. As Phase 4 progresses, DI surfaces shrink because helpers move to imports — D-12's faithful-extraction discipline keeps the DI bundle intact at extraction time; cleanup-ledger forward-tracking rows mark "Phase 5+ collapses DI surface to direct imports" per the existing rows at `runbooks/phase-4-cleanup-ledger.md:118-121`.

### Atomic-commit pattern (per Phase 1 D-25 / D-19 here)

**Source:** Phase 1 D-25 + Phase 2 D-21 + Phase 3 D-15 + Phase 4 D-19

**Apply to:** Every CODE-* requirement closure. Each commit:
1. Lands the code change (e.g., extract module / fold quick-win)
2. Lands the corresponding test addition or update
3. Lands the cleanup-ledger row closure (delete the row from `runbooks/phase-4-cleanup-ledger.md`)
4. Lands the SECURITY.md DOC-10 paragraph append (per D-19 Wave-1/2/4/6 mappings)

Conventional Commit prefixes per Phase 1 carry-forward: `feat(04-XX): ...`, `chore(04-XX): ...`, `refactor(04-XX): ...`, `docs(04-XX): SECURITY.md ...`, `test(04-XX): ...`.

### `// @ts-check` + JSDoc-as-typecheck (Phase 1 D-29; carried)

**Source:** Every `src/**/*.js` file already extracted has `// @ts-check` on line 2.

**Apply to:** Every new `src/**/*.js` file in Phase 4 — no exceptions, no `// @ts-nocheck`. JSDoc types may be `*` / `any` per D-06's "if tightening would force a behavioural change, leave as `any` and log it" — track decisions in cleanup ledger as the existing JSDoc-was-`any` table at `runbooks/phase-4-cleanup-ledger.md:128-135` extends.

### Test-file pairing (per Phase 2 carry-forward)

**Source:** `tests/<dir>/<file>.test.js` mirrors `src/<dir>/<file>.js` exactly. Examples: `src/util/ids.js` ↔ `tests/util/ids.test.js`; `src/data/cloud-sync.js` ↔ `tests/data/cloud-sync.test.js`.

**Apply to:** Every new `src/*` module — even stubs (a one-line "exports the expected no-op function" test for D-11 stubs is sufficient to satisfy lint/coverage tooling without forcing real behaviour).

### Cleanup-ledger row closure-on-landing (D-17)

**Source:** `runbooks/phase-4-cleanup-ledger.md:60-160` (canonical zero-out tracker)

**Apply to:** Every commit that touches a row's source line MUST delete the row from the Suppressions table (or the JSDoc-was-`any` table, or the Out-of-band-soft-fail table) in the same commit. D-17 gates phase close on zero rows in the Suppressions table.

### SECURITY.md per-wave append (D-19)

**Source:** Phase 1 + Phase 2 + Phase 3 already established; Phase 4 D-19 maps appends to specific waves:

- Wave 1: § HTTP Security Headers — CSP allowlist tightening narrative + CODE-01 + ARCHITECTURE.md §2 cite
- Wave 2: § Build & Supply Chain — `html:` deletion + XSS regression test + CODE-04 cite
- Wave 4: § Data Handling — upload validation client-side narrative + CODE-09 + OWASP ASVS V12.1 + ISO 27001:2022 A.8.24 + SOC2 CC6.1 cites
- Wave 6: § Code Quality + Module Boundaries — modular-split narrative + CODE-01 + CODE-02 + OWASP ASVS V14.2 + ISO 27001:2022 A.8.28 + SOC2 CC8.1 cites

---

## No Analog Found

| File                                      | Role                  | Data Flow         | Reason                                                                                                                                                                                                |
| ----------------------------------------- | --------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assets/fonts/*.woff2`                    | binary asset          | n/a               | First self-hosted font in repo. Drop into `assets/fonts/` (matches `assets/logo.png` placement convention from `STRUCTURE.md`). License-verify Inter (or current font) per pre-flight gate #4 + #3.    |

Every other Phase 4 file has a strong analog inside this repo. The font pre-flight is the only "fresh-territory" item; CONTEXT.md Pre-flight #3 is the operator action ("codebase scout `styles.css` for `@font-face` URLs and `index.html` for `<link rel='stylesheet'>`").

---

## Metadata

**Analog search scope:**
- `firebase-init.js` (root)
- `app.js:528-689` (DOM helpers + modal + render dispatch)
- `app.js:951-3800` (12 view render functions)
- `app.js:5466-5494` (init + DOMContentLoaded)
- `src/util/{ids,hash}.js`
- `src/domain/{scoring,banding,completion,unread}.js`
- `src/data/{cloud-sync,migration}.js`
- `src/auth/state-machine.js`
- `tests/auth/state-machine.test.js`, `tests/data/cloud-sync.test.js`, `tests/data/migration.test.js`, `tests/util/ids.test.js`, `tests/domain/scoring.test.js`, `tests/views/dashboard.test.js`, `tests/firebase-config.test.js`, `tests/setup.js`, `tests/mocks/firebase.js`
- `vite.config.js`, `eslint.config.js`, `index.html`
- `runbooks/phase-4-cleanup-ledger.md`

**Files scanned:** ~25 (full reads); plus `app.js` selective grep + targeted reads for h(), modal(), render dispatcher, alert sites, upload site, style sites.

**Pattern extraction date:** 2026-05-07
