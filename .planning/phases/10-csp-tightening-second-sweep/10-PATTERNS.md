# Phase 10: CSP Tightening (Second Sweep) - Pattern Map

**Mapped:** 2026-05-10
**Files analysed:** 7 (4 modified, 3 new)
**Analogs found:** 7 / 7
**Phase scope source:** `10-CONTEXT.md` + `10-RESEARCH.md` (5-wave breakdown)

---

## File Classification

| New / Modified File | Wave | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|------|-----------|----------------|---------------|
| `src/main.js` (lines ~1097, 1180, 1215, 1216, 1219, +126 sites) | 1 | view-render IIFE | DOM-construction (h() factory) | `src/main.js:1097-1106` (already-migrated `is-hidden` site at line 1106) | exact (in-file pattern) |
| `styles.css` (utility-class additions) | 1 | stylesheet | static config | `styles.css:2781-2786` (`.is-hidden` / `.is-shown-block` utility block) | exact |
| `index.html` (cache-buster bump `?v=52` -> `?v=53`) | 1 | HTML shell | static config | `index.html:8,23,24` (existing `?v=52` convention) | exact |
| `firebase.json` (CSP-RO -> enforced + connect-src +Sentry + frame-src 'self') | 2, 4 | hosting config | static config / HTTP headers | `firebase.json:21-22` (existing CSP-RO header) | exact |
| `tests/firebase-config.test.js` (extend with 6 new assertions) | 2 | unit test (schema) | request-response (file-read assertion) | `tests/firebase-config.test.js:60-92` (Phase 3+4 header-value assertions) | exact |
| `runbooks/csp-enforcement-cutover.md` (NEW) | 4 | operator runbook | event-driven / single-session checklist | **Primary:** `runbooks/hosting-cutover.md` (Phase 3); **Secondary (for `## Cutover Log`):** `runbooks/phase-9-deploy-checkpoint.md` | exact (primary) + role-match (secondary) |
| `runbooks/hsts-preload-submission.md` (NEW) | 5 | operator runbook | request-response (web-form submission) | **Primary:** `runbooks/phase-9-monitors-bootstrap.md` (Phase 9 — operator-paced web-form/SaaS-config substrate); **Secondary:** `runbooks/hosting-cutover.md` Step 7 (securityheaders.com manual smoke) | role-match |
| `SECURITY.md` Phase 10 increment (§ CSP — replace + § HSTS Preload Status + § Phase 10 Audit Index) | 5 | docs (security narrative) | append-only | `SECURITY.md:1177-1201` (§ Phase 9 Audit Index — most recent Pattern G table) + `SECURITY.md:436-463` (existing § Content Security Policy (Report-Only) — section being replaced) | exact |

---

## Pattern Assignments

### File 1: `src/main.js` — inline-style attribute migration (Wave 1)

**Role:** view-render IIFE (DOM-construction via `h()` factory at `src/ui/dom.js:27-44`)
**Data flow:** static-string DOM attributes -> CSS classes
**Why migrate:** `src/ui/dom.js:35` calls `el.setAttribute("style", v)` for any `style:` property; CSP3 `style-src 'self'` blocks ALL inline `style="..."` attributes (Pitfall 16 line 541).
**Verification command:** `grep -c 'style:\s*"' src/main.js` returns **130** today. Wave 1 closes this to **0**.

**In-file analog (already-migrated pattern at `src/main.js:1101-1106`):**

```js
// CODE-06 (D-20): classList toggle replaces el.style.display mutation.
passConfirm.classList.toggle("is-hidden", !needsPassword);
```

This shows the existing convention: dynamic `el.style.X` mutations migrated to `classList.toggle()` against a utility class declared in `styles.css`. Wave 1 extends this pattern from dynamic to **static** style strings.

**Migration pattern (paste-ready, from `10-RESEARCH.md` §Code Examples Example 3):**

```diff
// BEFORE - src/main.js:1097
- const hint = h(
-   "div",
-   { class: "auth-help", style: "margin-top:0; padding-top:0; border:0;" },
-   "First time signing in? ...",
- );

// AFTER - src/main.js
+ const hint = h(
+   "div",
+   { class: "auth-help u-mt-0 u-pt-0 u-no-border" },
+   "First time signing in? ...",
+ );
```

**Sample inventory (representative call sites — full inventory via grep):**

| Line | Current attribute | Recommended utility classes |
|------|------------------|----------------------------|
| 1097 | `style: "margin-top:0; padding-top:0; border:0;"` | `u-mt-0 u-pt-0 u-no-border` |
| 1180 | `style: "margin-top:-6px;"` | `u-mt-neg-6` (or context class `auth-confirm-spacer`) |
| 1215 | `style: "text-align:center; padding:48px;"` | `u-text-center u-pad-48` |
| 1216 | `style: "margin-top:0;"` | `u-mt-0` |
| 1219 | `style: "color: var(--ink-3); max-width:480px; margin: 0 auto;"` | context class `card-empty-text` (compound — better as semantic class than 3 utilities) |

**Strategy note (operator decision):** Pure utility classes are cheapest for single-property attributes (lines 1097, 1180, 1216). Multi-property compounds with semantic meaning (line 1219) may be cleaner as named classes. Wave 1 plan should mint both kinds.

---

### File 2: `styles.css` — utility-class additions (Wave 1)

**Role:** stylesheet (single-file, repo-root)
**Path:** `C:\Users\hughd\OneDrive\Desktop\base-layers-diagnostic\styles.css` (single source — no `src/styles/` subdirectory exists)
**Loaded by:** `index.html:8` via `<link rel="stylesheet" href="styles.css?v=52" />`
**Length:** 2,801 lines

**Closest analog (existing utility-class block at `styles.css:2774-2802`):**

```css
/* Phase 4 Wave 1 utility-class block (Wave 1 D-12 / D-13):
   in src/views/** + app.js. The remaining style="..." inline-attr
   strings (132 sites) defer to Wave 5 per D-12 (Wave 3 Dev #1 precedent
   - production rendering bodies remain in app.js IIFE until Wave 5
   re-homes them, at which point the inline-attr sweep + CSP-strict
   precondition land together with the body migration).
   ============================================================ */
.is-hidden {
  display: none !important;
}
.is-shown-block {
  display: block !important;
}
```

**Convention extracted:**
- Utility classes use `.is-X` (state) or `.u-X` (single-property) prefix
- Block is at end-of-file with header comment citing the wave + rationale
- `!important` reserved for state-toggle utilities (display); avoid for layout

**Wave 1 deliverable pattern (paste-ready append to bottom of `styles.css`):**

```css
/* ============================================================
   Phase 10 Wave 1 (HOST-06): utility classes minted to absorb
   the 130 static `style="..."` h()-attributes in src/main.js
   IIFE so style-src 'self' enforcement does not silently drop
   layout. Closes the row in runbooks/phase-4-cleanup-ledger.md
   "132 static `style="..."` inline-attr strings".
   ============================================================ */
.u-mt-0 { margin-top: 0; }
.u-pt-0 { padding-top: 0; }
.u-mt-neg-6 { margin-top: -6px; }
.u-no-border { border: 0; }
.u-text-center { text-align: center; }
.u-pad-48 { padding: 48px; }
/* + additional utilities derived from Wave 1 pattern enumeration */
```

**Cache-busting (per `10-RESEARCH.md` §Runtime State Inventory):** Bump `index.html:8,23,24` from `?v=52` -> `?v=53` since `styles.css` gains new classes.

---

### File 3: `firebase.json` — CSP enforcement flip (Wave 2 RO-tighten + Wave 4 RO-to-enforced)

**Role:** Hosting config (HTTP-header source-of-truth)
**Path:** `C:\Users\hughd\OneDrive\Desktop\base-layers-diagnostic\firebase.json`

**Existing structure (analog — file lines 5-34, the entire `hosting.headers` block):**

```jsonc
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "headers": [
      {
        "source": "**",
        "headers": [
          { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
          { "key": "X-Content-Type-Options", "value": "nosniff" },
          { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
          { "key": "Permissions-Policy", "value": "camera=(), microphone=(), ..." },
          { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
          { "key": "Cross-Origin-Embedder-Policy", "value": "credentialless" },
          { "key": "Cross-Origin-Resource-Policy", "value": "same-origin" },
          { "key": "Reporting-Endpoints", "value": "csp-endpoint=\"/api/csp-violations\"" },
          {
            "key": "Content-Security-Policy-Report-Only",
            "value": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firebasestorage.googleapis.com https://firebaseinstallations.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://securetoken.google.com; frame-src https://bedeveloped-base-layers.firebaseapp.com; img-src 'self' data: https:; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests; report-uri /api/csp-violations; report-to csp-endpoint"
          }
        ]
      }
    ]
  }
}
```

**Wave 2 — tightened Report-Only (drop `'unsafe-inline'`, add Sentry, drop firebaseapp.com from frame-src):**

The header **key remains `Content-Security-Policy-Report-Only`** at Wave 2. Only the value changes. This produces fresh observability with the new shape during the 7-day soak (Pitfall 16 Stage B).

```jsonc
{
  "key": "Content-Security-Policy-Report-Only",
  "value": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firebasestorage.googleapis.com https://firebaseinstallations.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://securetoken.google.com https://de.sentry.io; frame-src 'self'; img-src 'self' data: https:; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests; report-uri /api/csp-violations; report-to csp-endpoint"
}
```

**Wave 4 — single-knob enforcement flip (Pattern 1 from `10-RESEARCH.md`):**

Change one key name only. Value identical to Wave 2.

```diff
- "key": "Content-Security-Policy-Report-Only",
+ "key": "Content-Security-Policy",
```

**Per-directive diff narrative (from `10-RESEARCH.md` §CSP Directive Matrix):**

| Directive | Phase 3 RO | Phase 10 enforced | Reason |
|-----------|-----------|-------------------|--------|
| `style-src` | `'self' 'unsafe-inline'` | `'self'` | HOST-06; Wave 1 inline-style migration is the prerequisite |
| `connect-src` | 9 hosts (no Sentry) | 9 hosts + `https://de.sentry.io` | Pitfall 10B; Phase 9 Wave 2 source-map plugin uploads to Sentry EU |
| `frame-src` | `https://bedeveloped-base-layers.firebaseapp.com` | `'self'` | App uses email-link (no popup); verified `grep signInWithPopup src/` returns 0 hits |

**Verified facts (recorded so the planner does not re-verify):**
- `vite.config.js:36` hard-codes `url: "https://de.sentry.io/"` for the `@sentry/vite-plugin` registration. **`[VERIFIED 2026-05-10 by Grep]`**
- `signInWithPopup` / `signInWithRedirect` returns **0 hits** under `src/`. **`[VERIFIED 2026-05-10 by Grep]`**
- `index.html` retains zero `<meta http-equiv="Content-Security-Policy">` tags (Phase 3 cleanup landed). **`[VERIFIED 2026-05-10 by Read]`**
- Existing rewrite for `/api/csp-violations` -> `cspReportSink` in `europe-west2` is at `firebase.json:35-39`. **READ-ONLY — do not edit in Phase 10.**

---

### File 4: `tests/firebase-config.test.js` — schema-test extension (Wave 2)

**Role:** unit test (Vitest 4.1.5)
**Data flow:** file-read assertion (read `firebase.json` -> assert structure)
**Run command:** `npm test -- --run firebase-config` (~3s)
**Existing length:** 94 lines / 17 assertions

**Imports + setup pattern (lines 1-15) — extended file MUST keep this verbatim:**

```js
// @ts-check
// Phase 3 (HOST-01, HOST-03, HOST-04, HOST-05): schema-validate firebase.json
// Guards against (a) silent header drop (T-3-1) and (b) rewrite reordering that
// would shadow the function rewrite behind the SPA fallback (T-3-2).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const cfg = JSON.parse(
  readFileSync(resolve(process.cwd(), "firebase.json"), "utf-8"),
);
const rewrites = cfg.hosting.rewrites;
const globalHeaders = cfg.hosting.headers.find((h) => h.source === "**")?.headers ?? [];
const headerByKey = (key) =>
  globalHeaders.find((h) => h.key.toLowerCase() === key.toLowerCase());
```

**Existing assertion pattern (lines 60-92) — Wave 2 mimics this exact shape:**

```js
describe("firebase.json — header values (HSTS preload + COEP + CSP)", () => {
  it("HSTS includes max-age, includeSubDomains, and preload tokens", () => {
    const v = headerByKey("Strict-Transport-Security")?.value ?? "";
    expect(v).toMatch(/max-age=63072000/);
    expect(v).toContain("includeSubDomains");
    expect(v).toContain("preload");
  });

  it("CSP Report-Only contains frame-ancestors 'none' and dual reporting", () => {
    const v = headerByKey("Content-Security-Policy-Report-Only")?.value ?? "";
    expect(v).toContain("frame-ancestors 'none'");
    expect(v).toContain("report-uri /api/csp-violations");
    expect(v).toContain("report-to csp-endpoint");
  });
  // Phase 4 Wave 1 (D-08): chart.js npm import + Inter/Bebas Neue self-host let
  // us drop the 3 CDN allowlist entries Phase 3 D-07 carried as temporary.
  it("CSP-RO header drops cdn.jsdelivr.net + fonts.googleapis.com + fonts.gstatic.com (Phase 4 D-08)", () => {
    const csp = headerByKey("Content-Security-Policy-Report-Only")?.value ?? "";
    expect(csp).not.toMatch(/cdn\.jsdelivr\.net/);
    expect(csp).not.toMatch(/fonts\.googleapis\.com/);
    expect(csp).not.toMatch(/fonts\.gstatic\.com/);
  });
});
```

**Wave 2 deliverable — 6 new assertions (paste-ready, from `10-RESEARCH.md` §Code Examples Example 2):**

```js
// Phase 10 (HOST-06): assert ENFORCED CSP shape — no Report-Only suffix on the
// header key, no 'unsafe-inline' in style-src, frame-src locked to 'self',
// connect-src includes Sentry EU.
describe("firebase.json — Phase 10 enforced CSP shape (HOST-06)", () => {
  it("header key is 'Content-Security-Policy' (NOT Report-Only)", () => {
    expect(headerByKey("Content-Security-Policy")).toBeDefined();
    expect(headerByKey("Content-Security-Policy-Report-Only")).toBeUndefined();
  });

  it("style-src is locked to 'self' — no 'unsafe-inline'", () => {
    const csp = headerByKey("Content-Security-Policy")?.value ?? "";
    expect(csp).toMatch(/style-src 'self'(?!\s*'unsafe-inline')/);
    expect(csp).not.toMatch(/style-src[^;]*'unsafe-inline'/);
  });

  it("frame-src is 'self' (no firebaseapp.com popup origin)", () => {
    const csp = headerByKey("Content-Security-Policy")?.value ?? "";
    expect(csp).toMatch(/frame-src 'self'/);
    expect(csp).not.toMatch(/firebaseapp\.com/);
  });

  it("connect-src includes Sentry EU origin (https://de.sentry.io)", () => {
    const csp = headerByKey("Content-Security-Policy")?.value ?? "";
    expect(csp).toContain("https://de.sentry.io");
  });

  it("base-uri 'self' and form-action 'self' present (HOST-06 SC#1)", () => {
    const csp = headerByKey("Content-Security-Policy")?.value ?? "";
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  // HOST-07 substrate test - actual submission verification is Wave 5 manual
  it("HSTS preload-eligible: max-age >= 31536000, includeSubDomains, preload", () => {
    const v = headerByKey("Strict-Transport-Security")?.value ?? "";
    const m = v.match(/max-age=(\d+)/);
    expect(m).toBeTruthy();
    expect(parseInt(m[1], 10)).toBeGreaterThanOrEqual(31536000);
    expect(v).toContain("includeSubDomains");
    expect(v).toContain("preload");
  });
});
```

**Wave 2 timing nuance:** Wave 2 ships the test against `Content-Security-Policy-Report-Only` value (same value, RO key). The new assertions targeting `headerByKey("Content-Security-Policy")` will FAIL until Wave 4 enforcement flip. Recommended planner pattern: Wave 2 commits the test in **`describe.skip`** or behind a `WAVE_4_FLIP_LANDED` env gate, OR (cleaner) Wave 2 ships only the Sentry-connect-src + style-src-no-unsafe-inline assertions (which apply to both RO and enforced shapes), and Wave 4 unwraps the remaining 4 assertions in the same commit that flips the key. Planner picks.

---

### File 5: `runbooks/csp-enforcement-cutover.md` (NEW — Wave 4 deliverable)

**Role:** operator runbook (single-session deploy + verification)
**Data flow:** sequential operator-paced steps with curl smokes + Cutover Log
**Length target:** ~250-400 lines (smaller than Phase 3 `hosting-cutover.md` at 432 lines because the cutover surface is one-knob)

**Primary analog: `runbooks/hosting-cutover.md` (432 lines) — section structure to copy:**

```markdown
# Hosting Cutover Runbook

> Phase 3 deliverable. Execute on cutover day per CONTEXT.md D-02.
> Rollback window: 14 days from cutover date per D-03.

This runbook is intentionally executor-deferred. ...

---

## Prerequisites
### From <phase>-PREFLIGHT.md - PENDING-USER items resolved
- [ ] ... (checklist boxes)

### From the build pipeline
- [ ] **`.github/workflows/ci.yml` `deploy` job has run green on `main`...**
- [ ] **`cspReportSink` Cloud Function deployed in `europe-west2`:**
  ```sh
  gcloud functions list --project=bedeveloped-base-layers --regions=europe-west2 --format=json
  ```

### From the Pre-cutover Smoke Checklist (next section)
- [ ] All five synthetic smokes passed against <staging URL>

### Cutover window
- [ ] **~1 hour active work scheduled.**
- [ ] **Foreground terminal session with `gcloud auth login` already completed**

---

## Pre-cutover Smoke Checklist
[5 numbered Smokes with curl + gcloud logging verification]

---

## Cutover Steps
### Step 1: Verify smokes from default URL (~5 min)
### Step 2: ... (sequenced steps with time estimates)
...
### Step N: Update <phase>-PREFLIGHT.md `## Cutover Log` (~3 min)

```
cutover_date: <YYYY-MM-DD HH:MM TZ>
cutover_complete: yes
cutover_observed_headers: |
  HTTP/2 200
  ...
securityheaders_rating: A
notes: <freeform>
```

---

## Revert Procedure
**Time estimate: 15 minutes total.**

### Step R1: ... (numbered rollback steps)

---

## Citations
- D-XX (CONTEXT.md) - <decision>
- HOST-XX (REQUIREMENTS.md) - <requirement>
...
```

**Pre-cutover smoke pattern to copy (from `runbooks/hosting-cutover.md:236-269`, Step 5+6 — verify the new headers via `curl`):**

```sh
watch -n 30 "curl -sI https://baselayers.bedeveloped.com | head -10"
```

Wait until response shows:
- `HTTP/2 200`
- `strict-transport-security: max-age=63072000; includeSubDomains; preload`
- `content-security-policy: ...` (NEW — must NOT have `-report-only` suffix; must contain `style-src 'self'` without `'unsafe-inline'`)

**Soak query pattern to copy (from `runbooks/hosting-cutover.md:69-73` — extended for Phase 10 freshness window):**

```sh
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="cspreportsink" AND severity=WARNING AND jsonPayload.message="csp.violation" AND jsonPayload.report.disposition="report"' \
  --project=bedeveloped-base-layers \
  --limit=50 \
  --format=json \
  --freshness=7d
```

(Already in `10-RESEARCH.md` §Code Examples Example 4.)

**Securityheaders.com smoke pattern (from `runbooks/hosting-cutover.md:279-290`, Step 7 — copy verbatim, swap "A" -> "A+"):**

```markdown
### Step N: Verify securityheaders.com rating (~2 min)

Visit https://securityheaders.com/?q=baselayers.bedeveloped.com&followRedirects=on in a browser.

**Expected:** rating = A+ (was A pre-Phase-10).

If rating < A+, stop and investigate before continuing. The cutover IS technically complete at this point but a sub-A+ rating is a phase-10 success-criterion failure (HOST-06 SC#4).

Save the screenshot under `docs/evidence/phase-10-securityheaders-rating.png`.
```

**Secondary analog — `runbooks/phase-9-deploy-checkpoint.md:308-330` (Cutover Log table pattern):**

Phase 9 introduced a tabular Cutover Log (vs Phase 3's free-form Cutover Log). The Phase 10 cutover runbook should use **Phase 9's tabular shape** because it has 5 verification gates, not just headers. Paste-ready template:

```markdown
## Cutover Log

> Operator-fill template. Substitute `{{ T+? }}` placeholders with real UTC
> timestamps. Substrate-honest disclosure (Pitfall 19): if a step has not run
> yet, leave the `{{ T+? }}` placeholder in place as the audit trail of what
> is still pending.

| Step | Action                                                    | T+0 (UTC)    | Result               | Evidence                                                                |
|------|-----------------------------------------------------------|--------------|----------------------|-------------------------------------------------------------------------|
| A    | 7-day soak window closed (zero violations)                | `{{ T+? }}`  | `{{ PASS / FAIL }}` | `gcloud logging read ... --freshness=7d` returned zero entries          |
| B    | `firebase deploy --only hosting` (key flip)               | `{{ T+? }}`  | `{{ PASS / FAIL }}` | Commit SHA + `curl -sI` showing `content-security-policy:` (no -RO)     |
| C    | Same-session smoke: sign-in / dashboard / chart / upload  | `{{ T+? }}`  | `{{ PASS / FAIL }}` | DevTools console screenshot; zero CSP violations                        |
| D    | securityheaders.com rating = A+                           | `{{ T+? }}`  | `{{ PASS / FAIL }}` | `docs/evidence/phase-10-securityheaders-rating.png`                     |
| E    | 7-day post-enforcement soak (no new violations)           | `{{ T+? }}`  | `{{ PASS / FAIL }}` | Cloud Logging filter; HOST-06 SC#2                                      |
```

**Rollback procedure (analog from `runbooks/hosting-cutover.md` §DNS Revert Procedure):** Wave 4 rollback is simpler — revert `firebase.json` line 21 (`Content-Security-Policy` -> `Content-Security-Policy-Report-Only`) + `firebase deploy --only hosting`. ~5-min total. Document this procedure as `## Rollback Procedure` in the new runbook.

**Selective-deploy reminder (Pitfall 8 from `runbooks/phase-9-deploy-checkpoint.md:62-65`):**

```markdown
Per Pitfall 8 (Phase 7 substrate): use **selective deploy** to avoid disturbing
unrelated functions/hosting routes. The Phase 10 deploy is hosting-only:

```bash
firebase deploy --only hosting --project bedeveloped-base-layers
```

DO NOT use `firebase deploy --only functions:cspReportSink` — Phase 10 leaves the
function untouched (READ-ONLY substrate per `10-RESEARCH.md` §Component Responsibilities).
```

---

### File 6: `runbooks/hsts-preload-submission.md` (NEW — Wave 5 deliverable)

**Role:** operator runbook (one-shot SaaS web-form submission + verification)
**Length target:** ~80-120 lines (much shorter than the cutover runbook — single web form + check)

**Primary analog: `runbooks/phase-9-monitors-bootstrap.md` (Phase 9 — Sentry quota alert + Slack webhook setup is the closest substrate-honest "operator visits SaaS web UI, captures evidence" runbook).**

**Header pattern to copy (from `runbooks/phase-9-monitors-bootstrap.md:1-21`):**

```markdown
# Phase 10 — HSTS Preload Submission (Operator Runbook)

> Phase: 10 — CSP Tightening (Second Sweep)
> Wave: 5 (Plan 10-XX)
> Requirement: HOST-07 (HSTS preload submitted to hstspreload.org once
>   policy stable for >= 7 days)
> Date authored: 2026-05-10
> Objective: Single-operator-session procedure that submits
>   `baselayers.bedeveloped.com` to the Chrome HSTS preload list at
>   hstspreload.org. Operator-paced because the form is web-only and
>   inclusion in browser preload caches takes weeks to months after
>   submission.
```

**Pre-conditions section (analog from `runbooks/phase-9-monitors-bootstrap.md:22-44`):**

```markdown
## Pre-conditions

- [ ] Phase 10 Wave 4 enforcement flip completed (`Content-Security-Policy`
      header live, NOT `-Report-Only`).
- [ ] 7-day post-enforcement soak shows zero new CSP violations
      (per HOST-06 SC#2; Wave 4 close-gate Row E).
- [ ] `curl -sI https://baselayers.bedeveloped.com | grep -i strict-transport`
      returns `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- [ ] Operator confirms `bedeveloped.com` apex domain ownership +
      preload-list policy decision (apex vs subdomain — recommend
      subdomain-only per `10-RESEARCH.md` §HSTS Preload Submission Procedure).
- [ ] `tests/firebase-config.test.js` HSTS-preload-eligibility assertion
      (Wave 2 deliverable) passes:
      ```bash
      npm test -- --run firebase-config
      ```
```

**Submission flow section (paste from `10-RESEARCH.md` §HSTS Preload Submission Procedure §Submission flow):**

```markdown
## Step 1: Verify live HSTS header (~1 min)

```bash
curl -sI https://baselayers.bedeveloped.com | grep -i strict-transport-security
```

Expected: `strict-transport-security: max-age=63072000; includeSubDomains; preload`

If `preload` token absent or `max-age < 31536000`, STOP — `firebase.json` is misconfigured.

## Step 2: Visit hstspreload.org (~5 min)

1. Visit https://hstspreload.org
2. Enter `baselayers.bedeveloped.com` in the form
3. The site auto-checks the live header against the URL
4. If all green checks, click "Submit"
5. Capture confirmation email

## Step 3: Verify listing (operator-paced; weeks-months)

Periodically check via:
- https://hstspreload.org/?domain=baselayers.bedeveloped.com
- Or via `curl https://hstspreload.org/api/v2/status?domain=baselayers.bedeveloped.com`

Once status is `preloaded`, screenshot for `docs/evidence/phase-10-hsts-preload-listed.png`.
```

**Cutover Log pattern (5-row tabular form per `runbooks/phase-9-deploy-checkpoint.md:318-324`):**

```markdown
## Cutover Log

| Step | Action                                                    | T+0 (UTC)    | Result               | Evidence                                                                |
|------|-----------------------------------------------------------|--------------|----------------------|-------------------------------------------------------------------------|
| 1    | Verify live HSTS header on production                     | `{{ T+? }}`  | `{{ PASS / FAIL }}` | `curl -sI` output                                                       |
| 2    | hstspreload.org form submission for baselayers.bedeveloped.com | `{{ T+? }}` | `{{ PASS / FAIL }}` | hstspreload.org confirmation email screenshot                            |
| 3    | hstspreload.org status = `preloaded`                      | `{{ T+? }}`  | `{{ PASS / FAIL / PENDING }}` | `docs/evidence/phase-10-hsts-preload-listed.png` (weeks-deferred)  |
```

Note: Step 3 is calendar-deferred (weeks-months for Chrome to roll the preload list). Mark `PENDING` and forward-track in `runbooks/phase-10-cleanup-ledger.md` until status flips to `preloaded`.

---

### File 7: `SECURITY.md` Phase 10 increment (DOC-10 — Wave 5 deliverable)

**Role:** docs (security narrative, append-only by phase)
**Path:** `C:\Users\hughd\OneDrive\Desktop\base-layers-diagnostic\SECURITY.md`
**Existing length:** ~1,212 lines (last updated Phase 9 close)

**Three Wave 5 edits:**

#### Edit A: REPLACE `## § Content Security Policy (Report-Only)` (lines 436-463)

Existing section header (Phase 3 close):

```markdown
## § Content Security Policy (Report-Only)

**Control:** A two-tier CSP is shipped in `Content-Security-Policy-Report-Only` mode this phase. The tight tier covers `script-src`, `connect-src`, `frame-src`, `object-src`, `base-uri`, `form-action`, and `frame-ancestors 'none'`. The temporary permissive tier is `style-src 'self' 'unsafe-inline'` — Phase 4 sweeps inline `style="..."` strings...
```

Replace with — tightened title + new control narrative:

```markdown
## § Content Security Policy (enforced)

**Control:** A strict CSP is enforced via `Content-Security-Policy` header (no longer Report-Only) covering `script-src 'self'`, `style-src 'self'` (no `'unsafe-inline'`), `connect-src` allowlisting Firebase APIs + Sentry EU, `frame-src 'self'`, `frame-ancestors 'none'`, `base-uri 'self'`, `form-action 'self'`, `object-src 'none'`, plus `upgrade-insecure-requests` and dual reporting via `report-uri /api/csp-violations` + `report-to csp-endpoint`. The Phase 3 substrate (`cspReportSink` Cloud Function in `europe-west2` + `Reporting-Endpoints` header + `firebase.json` rewrite) is unchanged. The Phase 10 enforcement flip closed H4 fully and produced an A+ securityheaders.com rating.

**Per-directive table:**

| Directive | Value | Justification |
|-----------|-------|---------------|
| `default-src` | `'self'` | Root fallback - same-origin only |
| `script-src` | `'self'` | Vite produces hashed-filename ESM only; zero inline scripts |
| `style-src` | `'self'` | Phase 10 Wave 1 migrated 130 inline `style="..."` attrs to utility classes |
| `connect-src` | `'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firebasestorage.googleapis.com https://firebaseinstallations.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://securetoken.google.com https://de.sentry.io` | Firebase backplane + Sentry EU (Phase 9 OBS-04) |
| `frame-src` | `'self'` | App uses `signInWithEmailLink` (no popup) - dropped firebaseapp.com origin |
| `img-src` | `'self' data: https:` | data: for inline avatars; https: for future external |
| `font-src` | `'self' data:` | Self-hosted Inter + Bebas Neue (Phase 4) |
| `object-src` | `'none'` | Closes legacy plugin attack surface |
| `base-uri` | `'self'` | HOST-06 SC#1 |
| `form-action` | `'self'` | HOST-06 SC#1 |
| `frame-ancestors` | `'none'` | Click-jacking defence |
| `upgrade-insecure-requests` | (present) | Defence-in-depth |
| `report-uri` | `/api/csp-violations` | Legacy reporting fallback |
| `report-to` | `csp-endpoint` | Modern Reporting API |

**Soak evidence:** Wave 3 ran a 7-day Report-Only soak with the tightened policy (Stage B per Pitfall 16). Cloud Logging filter `severity=WARNING jsonPayload.message="csp.violation"` returned zero entries during the soak window (recorded in `10-PREFLIGHT.md ## Soak Log`). Wave 4 flipped key from `Content-Security-Policy-Report-Only` to `Content-Security-Policy`.

**Evidence:**

- Policy configuration: `firebase.json` `hosting.headers[0]` Phase 10 commit `<sha>` (Plan 10-04)
- Schema test (enforced shape): `tests/firebase-config.test.js` 6 new assertions (Plan 10-02)
- Inline-style migration: `src/main.js` + `styles.css` utility classes (Plan 10-01); closes `runbooks/phase-4-cleanup-ledger.md` "132 static `style="..."`" row
- Cutover runbook: `runbooks/csp-enforcement-cutover.md` (Plan 10-04 deliverable)
- Soak window: 7-day post-enforcement zero-violation; `10-PREFLIGHT.md ## Soak Log`
- securityheaders.com rating: `docs/evidence/phase-10-securityheaders-rating.png` (A+)

**Framework citations:**

- OWASP ASVS L2 v5.0 V14.4 — HTTP Security Headers (CSP enforced + frame-ancestors + base-uri + form-action)
- ISO/IEC 27001:2022 A.8.23 — Web filtering (style-src locks inline-style attack surface)
- ISO/IEC 27001:2022 A.13.1 — Network security management
- SOC 2 CC6.6 — Logical access security boundaries
- GDPR Art. 32(1)(b) — Confidentiality of processing systems and services
```

#### Edit B: ADD new section `## § HSTS Preload Status` (~80 words)

Insert after `## § Content Security Policy (enforced)`:

```markdown
## § HSTS Preload Status

**Control:** `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (set in `firebase.json` since Phase 3) was submitted to https://hstspreload.org on `<submission-date>` for the `baselayers.bedeveloped.com` subdomain. Apex domain (`bedeveloped.com`) preload was deliberately NOT submitted to preserve operator flexibility on other subdomains.

**Evidence:**

- Submission date + screenshot: `docs/evidence/phase-10-hsts-preload-submission.png` (Wave 5)
- Listing status check: https://hstspreload.org/?domain=baselayers.bedeveloped.com (re-check periodically; inclusion takes weeks-months)
- Operator runbook: `runbooks/hsts-preload-submission.md`

**Framework citations:**

- OWASP ASVS L2 V14.4 — HTTP Security Headers (HSTS preload directive)
- GDPR Art. 32(1)(a) — Pseudonymisation/encryption of personal data (HTTPS enforcement)
- SOC 2 CC6.7 — Restricted data transmission (HTTPS-only via preload)
```

#### Edit C: ADD new section `## § Phase 10 Audit Index` (Pattern G table)

**Analog: `SECURITY.md:1177-1201` (`## § Phase 9 Audit Index`) — copy structure verbatim, swap rows.**

Pattern G table shape (extracted from Phase 9 Audit Index lines 1182-1192):

```markdown
| Requirement | Control | Code | Test / Evidence | Framework |
|-------------|---------|------|-----------------|-----------|
| OBS-01 | <one-line description> | <file:line> + <file> | <test-path> + <runbook-path> | <framework citations comma-separated> |
```

Phase 10 deliverable (paste-ready):

```markdown
## § Phase 10 Audit Index

Auditor walk-through pointer for Phase 10. Each row maps a Phase 10 control to its requirement ID, the code/config that implements it, the test or operator evidence that verifies it, and the framework citations it satisfies. Mirrors the §Phase 7 + §Phase 8 + §Phase 9 Audit Index shape. Substrate-honest (Pitfall 19): every Validated row has evidence pointers.

| Requirement | Control | Code | Test / Evidence | Framework |
|-------------|---------|------|-----------------|-----------|
| HOST-06 | CSP enforced (no Report-Only) + style-src 'self' (no 'unsafe-inline') + frame-src 'self' + base-uri 'self' + form-action 'self' | `firebase.json` `hosting.headers[0]` Content-Security-Policy + `src/main.js` + `styles.css` utility classes | `tests/firebase-config.test.js` 6 Phase 10 assertions; `runbooks/csp-enforcement-cutover.md` Steps A-E (operator); `docs/evidence/phase-10-securityheaders-rating.png` (A+) | ASVS V14.4; ISO A.8.23 + A.13.1; SOC 2 CC6.6; GDPR Art. 32(1)(b) |
| HOST-07 | HSTS preload submitted to hstspreload.org for baselayers.bedeveloped.com | `firebase.json` `Strict-Transport-Security` (preload directive present since Phase 3) | `tests/firebase-config.test.js` HSTS-preload-eligibility assertion; `runbooks/hsts-preload-submission.md` Step 2; `docs/evidence/phase-10-hsts-preload-submission.png` | ASVS V14.4; GDPR Art. 32(1)(a); SOC 2 CC6.7 |
| DOC-10 | Phase 10 incremental SECURITY.md - replaced § CSP (Report-Only) with § CSP (enforced) + new § HSTS Preload Status + this Audit Index | This file | this commit; Phase 11 owns canonical DOC-10 pass | ISO A.5.36 |

**Cross-phase plug-ins this index will feed:**

- **Phase 11** (DOC-02 / DOC-04 / DOC-09 evidence pack) — `docs/CONTROL_MATRIX.md` rows for HOST-06 + HOST-07; `docs/evidence/` securityheaders.com rating screenshot + hstspreload.org submission screenshot.
- **Phase 12** (WALK-02 / WALK-03) — audit-walkthrough cites Phase 10 § CSP (enforced) + § HSTS Preload Status as ground truth.

**Index self-check:** if `runbooks/phase-10-cleanup-ledger.md` has a forward-tracking row "hstspreload.org status = preloaded" still open (calendar-deferred to weeks-months), this index is current. Once the listing-status row closes, this index needs a maintenance commit.
```

**Maintenance update to `## § Phase 3 Audit Index` (lines 494-523):**

Per the existing index self-check at line 523 (`Phase 10's planning explicitly lists "update SECURITY.md ## § Phase 3 Audit Index" as a task when CSP enforcement lands`), Wave 5 should also update the Phase 3 Audit Index to reference Phase 10's enforcement flip. Specifically the row at line 504 (`ISO/IEC 27001:2022 | A.13.1 ... soak window through Phase 10`) should be updated to note "soak window CLOSED Phase 10 Wave 4".

---

## Shared Patterns

### Cache-busting (`?v=N` convention)
**Source:** `index.html:8,23,24`
**Apply to:** Wave 1 — bump `?v=52` -> `?v=53` for `styles.css`, `data/pillars.js`, `./src/main.js`
```html
<link rel="stylesheet" href="styles.css?v=53" />
<script src="data/pillars.js?v=53"></script>
<script type="module" src="./src/main.js?v=53"></script>
```
This is a hand-bumped convention from pre-Vite-content-hash days; per `10-RESEARCH.md` Wave 1 deliverable, bump per stylesheet edit.

### Selective-deploy discipline (Pitfall 8)
**Source:** `runbooks/phase-9-deploy-checkpoint.md:62-65` ("Per Pitfall 8 (Phase 7 substrate): use **selective deploy**...")
**Apply to:** All Wave 3 + Wave 4 deploy steps in `csp-enforcement-cutover.md`
```bash
firebase deploy --only hosting --project bedeveloped-base-layers
```
DO NOT use `firebase deploy --only functions` — Phase 10 leaves `cspReportSink` untouched.

### Substrate-honest disclosure (Pitfall 19)
**Source:** `runbooks/phase-9-deploy-checkpoint.md:312-316` ("Substrate-honest disclosure (Pitfall 19): false timestamps would violate compliance credibility")
**Apply to:** Both new runbooks' Cutover Log tables — leave `{{ T+? }}` placeholders in place if a step is pending. Mark calendar-deferred rows (e.g. hstspreload.org status check) as `PENDING` not `PASS` until the operator captures evidence.

### Conventional Commits with phase-plan prefix
**Source:** `CLAUDE.md ## Conventions` + `10-RESEARCH.md` §Recommended Wave Structure deliverable lines
**Apply to:** All Phase 10 commits
- `refactor(10-01): migrate 130 inline-style attrs to utility classes (Phase 4 sub-wave 4.1 closure)`
- `feat(10-02): tighten CSP-RO directives + extend schema test (HOST-06 substrate)`
- `feat(10-04): flip CSP from Report-Only to enforced (HOST-06 closes)`
- `docs(10-05): SECURITY.md Phase 10 increment + Audit Index`
- `chore(10-05): close Phase 10 cleanup ledger`

### Operator-fill `## Cutover Log` (5-row tabular form)
**Source:** `runbooks/phase-9-deploy-checkpoint.md:318-324`
**Apply to:** Both `csp-enforcement-cutover.md` AND `hsts-preload-submission.md`
Rows must be A-E (or 1-N) with columns: Step / Action / T+0 (UTC) / Result / Evidence. Evidence column links to `docs/evidence/phase-10-*` PNGs.

### `gcloud logging read` filter (Cloud Run-equivalent service name)
**Source:** `runbooks/hosting-cutover.md:69-73` + `10-RESEARCH.md` §Code Examples Example 4
**Apply to:** Wave 3 (RO-tightened) + Wave 4 (enforced) soak observations
```bash
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND resource.labels.service_name="cspreportsink"
   AND severity=WARNING
   AND jsonPayload.message="csp.violation"' \
  --project=bedeveloped-base-layers \
  --limit=50 --format=json --freshness=7d
```
Note: `service_name` is `cspreportsink` (lowercase, no hyphen) because Firebase 2nd-gen lowercases function names when minting Cloud Run services.

---

## No Analog Found

No files in this phase lack an analog. Every new file or modification has a strong existing reference in the codebase or a Phase 3 / Phase 4 / Phase 9 runbook.

---

## Key Locations Confirmed

Per the orchestrator's "also locate" list:

| Item | Location | Verified by |
|------|----------|-------------|
| CSS file home | `styles.css` (single file at repo root) - 2,801 lines, loaded via `index.html:8` `<link rel="stylesheet" href="styles.css?v=52" />` | Glob + Read |
| CSP report endpoint URL | `/api/csp-violations` (rewritten to `cspReportSink` in `europe-west2` per `firebase.json:35-39`) | Read firebase.json |
| Deploy command pattern | `firebase deploy --only hosting --project bedeveloped-base-layers` (selective per Pitfall 8) | `runbooks/phase-9-deploy-checkpoint.md:69-71` |
| Existing CSP-RO header | `firebase.json:21-22` (single-line value with all directives space-separated, semicolon-separated) | Read firebase.json |
| Existing utility-class block in styles.css | `styles.css:2774-2802` (`.is-hidden`, `.is-shown-block` block at end-of-file with header comment citing wave + rationale) | Read styles.css |
| Inline `style:` attribute count in src/main.js | **130** (verified via `Grep style:\s*\"`) | Grep |
| h() function body | `src/ui/dom.js:27-44`, with `el.setAttribute("style", v)` at line 35 (the CSP-violating call path) | Read |
| Sentry plugin URL | `vite.config.js:36` — `url: "https://de.sentry.io/"` | Grep |
| index.html meta-CSP tag | **0 hits** (Phase 3 cleanup landed; Phase 4 added regression test) | Read |
| signInWithPopup / signInWithRedirect in src | **0 files match** (confirms `frame-src` can drop firebaseapp.com origin) | Grep |
| Phase 9 SECURITY.md Audit Index location | `SECURITY.md:1177-1201` (10-row table with "Cross-phase plug-ins" footer) | Grep + Read |
| § CSP (Report-Only) section to replace | `SECURITY.md:436-463` | Grep + Read |

---

## Metadata

**Analog search scope:** `firebase.json`, `tests/firebase-config.test.js`, `src/main.js`, `src/ui/dom.js`, `src/ui/format.js`, `styles.css`, `index.html`, `runbooks/*.md` (25 files), `SECURITY.md`, `vite.config.js`.

**Files scanned:** ~40 (read via Read + Grep + Glob).

**Pattern extraction date:** 2026-05-10
