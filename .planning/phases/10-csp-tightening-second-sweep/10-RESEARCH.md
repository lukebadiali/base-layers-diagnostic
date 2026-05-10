# Phase 10: CSP Tightening (Second Sweep) — Research

**Researched:** 2026-05-10
**Domain:** HTTP-header CSP enforcement + HSTS preload submission + inline-style remnant migration
**Confidence:** HIGH for stack + pitfalls (verified against codebase + official sources). MEDIUM for the precise final CSP shape (depends on a 7-day report-only soak observation we can't pre-run). HIGH for the inline-style remnant blocker (verified by grep against `src/main.js`).

---

## Summary

Phase 10 is a **mechanical tightening phase** consuming substrate built in Phase 3 (HTTP-header CSP-Report-Only + `cspReportSink` in europe-west2 + 9-header schema test) and ratifying the inline-style discipline written into Phase 4. It is not a research-heavy phase — Pitfalls 14, 15, 16 were all mitigated by Phase 3. **The single load-bearing technical risk is the 130 static `style: "..."` h()-function attributes preserved in `src/main.js` IIFE** (Phase 4 sub-wave 4.1 carryover). These render as `style="..."` HTML attributes via `el.setAttribute("style", v)` (verified at `src/ui/dom.js:35`) and WILL break under `style-src 'self'` enforcement. The Phase 4 cleanup-ledger explicitly documents these as "atomic with Phase 10 work" but no plan has yet executed sub-wave 4.1.

A second, smaller blocker: the existing `frame-src https://bedeveloped-base-layers.firebaseapp.com` CSP allowlist was added preemptively in Phase 3 to spare Phase 6 a CSP edit. Phase 6 D-07 (email-link recovery) and verified code (`grep signInWithPopup` returns zero hits in `src/`) confirm **no popup auth flow exists** — the app uses `signInEmailPassword` + `signInWithEmailLink` (not popups). The Phase 6 + Phase 7 cleanup-ledgers both pre-queue this as a Phase 10 forward-tracking row: drop or retain per a single decision during Wave 1.

The phase has three operator-paced steps that cannot be compressed:
1. **7-day report-only soak** with the proposed strict CSP in Report-Only mode (calendar time; cannot accelerate)
2. **HSTS preload submission** at hstspreload.org (web form; manual; verification can take days)
3. **securityheaders.com rating verification** (manual; one-shot)

**Primary recommendation:** Land Phase 10 as **5 waves**: (1) inline-style sweep gate — execute Phase 4 sub-wave 4.1 OR adopt CSS-class migration of the 130 strings; (2) write the strict CSP in Report-Only with full directive matrix + decide on `frame-src` retention; (3) staging soak verification + 7-day enforced-soak-on-staging window; (4) production enforcement flip (single firebase.json edit — flip directive name); (5) HSTS preload submission + securityheaders.com rating capture + DOC-10 SECURITY.md increment. Plan size: smaller than Phase 9 — three of the waves are ~15-30 min of work; the soak windows are calendar time.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

All implementation choices are at Claude's discretion — discuss phase was skipped per `workflow.skip_discuss`. Constraints carried forward:

- **Phase 4 inline-style sweep** is the prerequisite for `style-src 'self'`. Phase 4 cleanup-ledger documented ~132 static `style="..."` strings in `src/main.js` deferred as "sub-wave 4.1" — these MUST be migrated to CSS classes BEFORE CSP enforcement, OR the affected views break under enforcement.
- **Phase 3 CSP-RO infrastructure** lives in `firebase.json` (Content-Security-Policy-Report-Only header + cspReportSink Cloud Function via `/api/csp-violations` rewrite).
- **Phase 6 Firebase Auth popup** requires `frame-src https://bedeveloped-base-layers.firebaseapp.com` (or the verified Identity Platform popup origin) — Phase 6 D-09 raised this as a forward-tracking row.
- **HSTS preload requirements:** `max-age=63072000; includeSubDomains; preload` (Phase 3 already sets this); domain must include `preload` directive AND be served on HTTPS only AND apex/www consistent.
- **Staged enforcement:** Report-Only must soak for ≥7 days with zero new violations before flipping to enforced.
- **Operator-paced steps:** 7-day soak (calendar); hstspreload.org submission (web form); securityheaders.com rating (manual).

### Claude's Discretion

All implementation choices — wave structure, plan splits, ordering, exact CSP shape decisions (within the SC envelope), test strategy, test thresholds.

### Deferred Ideas (OUT OF SCOPE)

None — discuss phase skipped.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HOST-06 | Strict CSP rolled to enforced + `style-src 'self'` (no `'unsafe-inline'`) after Phase 4 inline-style sweep is complete (closes H4 fully) | §Inline-Style Remnant Inventory + §CSP Directive Matrix + §Wave Structure |
| HOST-07 | HSTS preload submitted to hstspreload.org once policy stable for ≥7 days | §HSTS Preload Submission Procedure |
| DOC-10 | Each phase incrementally appends to `SECURITY.md` as it closes findings | §SECURITY.md Increment Plan |

---

## Project Constraints (from CLAUDE.md)

| Directive | Source | How Phase 10 Honours It |
|-----------|--------|-------------------------|
| Stay on Firebase | CLAUDE.md "Locked decisions" | Single-knob flip in `firebase.json`; no platform changes |
| Stay on vanilla JS + JSDoc-as-typecheck | CLAUDE.md "Locked decisions" | No source rewrite needed; CSS-class migration is HTML-only |
| No emojis in commits or source | CLAUDE.md "Conventions" | All commit messages ASCII |
| Conventional Commits | CLAUDE.md "Conventions" | `feat(10-XX):`, `chore(10-XX):`, `docs(10-XX):` |
| Hosting cutover before any real CSP work | CLAUDE.md "Sequencing non-negotiables" #4 | **VERIFIED** — Phase 3 cutover landed 2026-05-07; Phase 10 is the second-sweep follow-on |
| Compliance bar = credible, not certified | CLAUDE.md "Locked decisions" | SECURITY.md says "credible / on track for OWASP ASVS L2" — not "compliant" |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CSP directive enforcement | CDN / Static (Firebase Hosting) | — | `firebase.json` `hosting.headers` set at the edge before any tier sees the request; only place a strict CSP can attach |
| HSTS preload directive | CDN / Static (Firebase Hosting) | hstspreload.org (third-party) | Header-set is Hosting; submission is operator-pacing at hstspreload.org's web form |
| `frame-src` enforcement (Firebase Auth popups) | Browser / Client | API / Backend | Browser enforces `frame-src` on the document; if popup flow not used, this is dead allowlist (drop it) |
| Inline-style migration | Browser / Client (HTML build output) | — | CSS-class refactor in `src/main.js` IIFE — produces same DOM but without `style="..."` attributes |
| CSP violation reporting | API / Backend (Cloud Function) | CDN / Static (rewrite path) | `cspReportSink` in europe-west2 is the soak monitor; substrate untouched in Phase 10 |
| Soak observation | API / Backend (Cloud Logging) | — | `gcloud logging read` queries `severity=WARNING jsonPayload.message="csp.violation"` over the 7-day window |
| `securityheaders.com` rating | External (Scott Helme service) | — | Manual visit + screenshot; not in our trust boundary |

---

## Standard Stack

### Core (already in repo — no new installs)

| Item | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Firebase Hosting `firebase.json` `hosting.headers` | n/a (config) | HTTP response headers including CSP + HSTS | The only CSP/HSTS substrate that supports full strict policy at the edge; verified working since Phase 3 |
| `Content-Security-Policy` header (replaces `Content-Security-Policy-Report-Only`) | CSP3 / spec-stable | Browser enforcement of script-src / style-src / frame-src / etc. | Single-knob flip from Report-Only to enforced; CSP Level 3 is universal browser support |
| `cspReportSink` Cloud Function | europe-west2 / 2nd-gen | Soak monitor — receives violation reports during Report-Only soaks | Phase 3 substrate; reused not rebuilt; FN-04-pinned to `csp-sink-sa` |
| `tests/firebase-config.test.js` | Vitest 4.1.5 | Schema-validates `firebase.json` directives | Phase 3 substrate; Wave 2 of Phase 10 extends to assert ENFORCED CSP shape |

### No new dependencies required

Phase 10 introduces zero new npm packages. **`[VERIFIED: package.json reads firebase 12.12.1, vite 8.0.10, vitest 4.1.5]`**.

### Operator-paced external services

| Service | Action | Cost |
|---------|--------|------|
| hstspreload.org | One-shot submission via web form; verification can take days-weeks | Free |
| securityheaders.com | Manual scan + rating screenshot | Free |
| Cloud Logging (existing) | `gcloud logging read` queries during soak | Existing free tier sufficient |

---

## Architecture Patterns

### System Architecture Diagram (Phase 10 substrate flow)

```
                              ┌──────────────────────────────────┐
                              │   Browser (real users on prod)   │
                              │   loads baselayers.bedeveloped   │
                              │           .com/                  │
                              └────────────┬─────────────────────┘
                                           │
                                           │ HTTPS
                                           ▼
        ┌─────────────────────────────────────────────────────────────┐
        │           Firebase Hosting (CDN edge)                       │
        │  Reads hosting.headers from firebase.json:                  │
        │   • Strict-Transport-Security  (HOST-07 source)             │
        │   • Content-Security-Policy    (HOST-06 — ENFORCED)         │
        │   • + 7 other security headers (Phase 3 substrate)          │
        │  Rewrite /api/csp-violations → cspReportSink (europe-west2) │
        └────────────┬─────────────────────────────────────────────┬──┘
                     │                                             │
                     │ HTML + JS + CSS                             │ POST violation
                     │ (with hashed Vite filenames)                │ reports
                     ▼                                             ▼
        ┌─────────────────────────────────────┐     ┌─────────────────────────┐
        │   Browser CSP enforcement engine    │     │  cspReportSink (Phase 3)│
        │   • script-src 'self' → only        │     │  • content-type allowlist│
        │     ./src/main.js + hashed chunks   │     │  • 64 KiB body cap       │
        │   • style-src 'self' → BLOCKS the   │     │  • 5-min in-mem dedup    │
        │     130 inline style="..." strings  │────►│  • logger.warn("csp      │
        │     (Phase 4 sub-wave 4.1 carryover)│     │     .violation")          │
        │   • frame-ancestors 'none'          │     └────────────┬─────────────┘
        │   • connect-src restricted          │                  │
        └────────────────┬────────────────────┘                  │
                         │                                       │
                         │ violation event                       │ JSON payload
                         │ (sent to report-uri / report-to)      │ to Cloud Logging
                         ▼                                       ▼
                   ┌──────────────┐                     ┌─────────────────────┐
                   │  /api/csp-   │                     │  Cloud Logging      │
                   │  violations  │────────────────────►│  (severity=WARNING) │
                   │   (rewrite)  │                     │  Operator query:    │
                   └──────────────┘                     │  gcloud logging read │
                                                        │  ...freshness=7d    │
                                                        └─────────────────────┘
```

### Component Responsibilities

| Component | File / Path | Responsibility |
|-----------|-------------|----------------|
| `firebase.json` `hosting.headers` | `firebase.json` (lines 5-34) | Source of truth for CSP + HSTS + 7 other headers |
| `tests/firebase-config.test.js` | `tests/firebase-config.test.js` | Schema-validates header presence + values; Phase 10 extends with enforced-CSP assertions |
| `src/main.js` IIFE | `src/main.js` (5279 lines) | Hosts the 130 inline `style:` h()-attributes that Phase 10 sub-wave 4.1 sweeps |
| `src/ui/dom.js` `h()` | `src/ui/dom.js` (lines 27-44) | The h() function renders `style:` properties via `el.setAttribute("style", v)` — exactly the path that triggers `style-src` violations |
| `cspReportSink` | `functions/src/csp/cspReportSink.ts` | **READ-ONLY in Phase 10** — soak monitor; no changes needed |
| `runbooks/csp-enforcement-cutover.md` | NEW (Phase 10 Wave 4 deliverable) | Operator runbook for the firebase.json flip + same-session smoke + 7-day soak |
| `runbooks/hsts-preload-submission.md` | NEW (Phase 10 Wave 5 deliverable) | Operator runbook for hstspreload.org form + verification |

### Pattern 1: Single-knob enforcement flip
**What:** Change one key name in `firebase.json` from `Content-Security-Policy-Report-Only` to `Content-Security-Policy`. The directive value can remain identical; the flip is from "log violations" to "block violations".
**When to use:** ONLY after the 7-day Report-Only soak has zero new violations AND the inline-style sweep is complete.
**Example:**
```jsonc
// BEFORE (Phase 3 — Report-Only)
{ "key": "Content-Security-Policy-Report-Only", "value": "default-src 'self'; ... style-src 'self' 'unsafe-inline'; ..." }

// AFTER (Phase 10 — enforced + tightened)
{ "key": "Content-Security-Policy", "value": "default-src 'self'; ... style-src 'self'; ..." }
```
**Source:** `[CITED: firebase.json lines 21-22; Phase 3 substrate verified]`.

### Pattern 2: 7-day staging soak (Stage A → Stage B → Stage C from Pitfall 16)
**What:** Three-stage CSP rollout. Phase 3 already executed Stage A (Report-Only soak with `'unsafe-inline'` allowed). Phase 10 executes Stage B (Report-Only with the TIGHTENED policy — `'unsafe-inline'` removed; Firebase Auth `frame-src` decided) for ≥7 days, then Stage C (flip Report-Only → enforced).
**When to use:** Whenever moving from a permissive policy to a strict one. The intermediate Report-Only-with-strict-shape stage catches violations that would have been silenced by `'unsafe-inline'` in Phase 3.
**Source:** `[CITED: PITFALLS.md Pitfall 16 lines 547-554]`.

### Pattern 3: HSTS preload "be conservative" rule
**What:** Submit to hstspreload.org only after the policy has been STABLE in production for ≥7 days because removal from the preload list takes weeks/months and propagates slowly to user browsers.
**When to use:** Whenever a domain meets the technical requirements AND the operator commits to keeping HSTS active indefinitely.
**Example:**
```
Header: Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        max-age >= 31536000 (1 year minimum per submission rules)
        includeSubDomains required
        preload directive present
```
**Source:** `[VERIFIED: hstspreload.org submission rules; web search 2026-05-10; firebase.json line 9 already sets the canonical form]`.

### Anti-Patterns to Avoid

- **Direct flip without intermediate Report-Only-with-strict-shape soak.** Phase 3's soak ran with `'unsafe-inline'` allowed — it does NOT predict what fires when `'unsafe-inline'` is removed. Always do a fresh 7-day soak with the tightened policy in Report-Only first.
- **Submitting to hstspreload.org from a staging-only domain.** The submission targets the apex/registered domain (`bedeveloped.com`) — the question is whether you want apex preload (likely yes if BeDeveloped owns ALL subdomains) or only `baselayers.bedeveloped.com`. **`[ASSUMED]`: BeDeveloped owns the apex domain; the preload-list submission can be either apex+includeSubDomains (covers all subdomains) or scoped — operator decides at form-fill time.**
- **Adding nonces or hash-source CSP without first doing the cheaper class-migration.** Pitfall 16 line 550 explicitly notes "Firebase Hosting does not generate nonces". Hash-source per-style would require re-computing on every CSS change. **CSS-class migration is strictly cheaper for this codebase.**
- **Editing `cspReportSink` during Phase 10.** The function is FN-04-pinned to `csp-sink-sa` and Pitfall 8-flagged for "selective deploy only" (`firebase deploy --only functions:cspReportSink`). Phase 10 has zero reason to touch it; treat as read-only substrate.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSP violation reporter | Custom violation log writer | `cspReportSink` (Phase 3 — already deployed) | Multi-format wire support (legacy + Reporting API), abuse-mitigated, structured Cloud Logging |
| HSTS preload list | Custom preload notification | hstspreload.org submission form | Browser vendors only honour the Chrome-curated list; no other path exists |
| CSP shape from scratch | Reading the CSP3 spec to build a directive | Use Phase 3's existing CSP-Report-Only as the baseline + drop `'unsafe-inline'` | The 9 directives in `firebase.json` line 22 are already audited + working |
| Securityheaders.com equivalent | Custom rating tool | securityheaders.com (Scott Helme) | The rating is the auditable artefact; rolling your own loses the third-party signal |
| Inline-style → class refactor | Sed-based mechanical replacement | Hand-migrate the 130 attributes during sub-wave 4.1 — they're often dynamic (computed colour values) | Mechanical replacement loses dynamic-value semantics |

**Key insight:** Phase 10 is **almost entirely substrate-reuse**. The only "new code" is (a) extending `tests/firebase-config.test.js` with enforced-shape assertions, (b) the inline-style class migration in main.js (mechanical), and (c) two operator runbooks. The phase is operator-execution-heavy, not autonomous-code-heavy.

---

## Runtime State Inventory

> Phase 10 is a header-policy + CSS-class migration phase, not a rename/refactor phase. State inventory is bounded.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — the firebase.json directive is read-only config; no databases store the CSP value | None |
| Live service config | Phase 3 deployed `cspReportSink` in europe-west2 with content-type allowlist + 64 KiB cap + 5min dedup. **READ-ONLY in Phase 10** — touching it would risk Pitfall 8 (selective deploy violation). | None — explicit DO-NOT-TOUCH directive |
| OS-registered state | No Windows Task Scheduler / launchd / systemd registrations. The 7-day soak is calendar-paced, not Cron-paced. | None |
| Secrets and env vars | No new secrets. `cspReportSink` does not consume secrets. HSTS preload submission does not require auth. | None |
| Build artifacts / installed packages | No new artifacts. The CSS-class migration touches `src/main.js` + `styles.css?v=52` (in `index.html`); rebuild produces fresh hashed bundles per Vite 8.0.10 default. | Bump `styles.css?v=52` to `?v=53` if `styles.css` adds new classes (per `index.html:8` cache-busting convention) |

**Nothing found in category:** Categories 1, 3, 4, 5 verified by grep across the codebase + `runbooks/phase-{3,4,6,7}-cleanup-ledger.md`.

---

## Inline-Style Remnant Inventory (Phase 4 sub-wave 4.1 status — CRITICAL GATE)

This section answers the load-bearing question: **"Will the 130 inline-style attributes break under `style-src 'self'`?"** Yes — verified by reading the h()-function source.

### Verification

```bash
# h()-function call sites with `style: "..."` static-string property
grep -c 'style:\s*"' src/main.js
# Returns: 130

# Total h()-function call sites with `style:` property (any value type)
grep -c 'style:' src/main.js
# Returns: 173

# Confirm src/main.js is still the IIFE preservation site (Phase 4 cleanup-ledger row)
wc -l src/main.js
# Returns: 5279 src/main.js
```

**`[VERIFIED: bash grep 2026-05-10]`**: 130 static `style: "..."` h()-function attributes remain in `src/main.js`. Additional 43 `style:` properties exist with non-static values (template-literal computed strings) — the count of 173 total is consistent with the cleanup-ledger's note of "132 static `style="..."` strings" (the small discrepancy reflects post-Phase-4 minor edits).

### Why h() `style:` properties break under `style-src 'self'`

`src/ui/dom.js:35` (the h() function body):
```js
else el.setAttribute(k, v);  // For any attr that isn't class/onX/boolean
```

When `k === "style"`, this calls `el.setAttribute("style", "margin-top:0; padding-top:0; border:0;")` — equivalent to writing `<div style="margin-top:0; padding-top:0; border:0;">` in HTML. **CSP3 `style-src` controls inline `<style>` blocks AND inline `style="..."` attributes.** Both are blocked when the source-list omits `'unsafe-inline'`.

Reference: `[CITED: PITFALLS.md Pitfall 16 line 541 — "style-src blocks both <style> blocks and style="..." attributes"]`.

### Sample call sites (operator can grep these for the full inventory)

```js
// src/main.js:1097
{ class: "auth-help", style: "margin-top:0; padding-top:0; border:0;" }

// src/main.js:1180
h("div", { class: "auth-field", style: "margin-top:-6px;" }, [passConfirm])

// src/main.js:1215
h("div", { class: "card", style: "text-align:center; padding:48px;" }, [...])

// src/main.js:1216
h("h2", { style: "margin-top:0;" }, "No organisation assigned")
```

### Migration Strategies (operator + planner pick one)

| Option | Effort | Risk | Coverage of 130 strings |
|--------|--------|------|-------------------------|
| **A. Mechanical class migration (recommended)** | ~2-3 hours: enumerate the unique style-string patterns, mint utility classes (e.g. `.u-mt-0`, `.u-text-center`, `.u-pad-48`), substitute in main.js | LOW (snapshot tests catch DOM-text drift) | All 130 |
| **B. Atomic main.js IIFE migration (Phase 4 sub-wave 4.1 deferred mandate)** | ~1-2 days: extract IIFE bodies into `src/views/{name}.js` Pattern D DI factories proper, fix the inline strings as a side-effect | HIGH (the very refactor Phase 4 deferred — significant risk surface) | All 130 |
| **C. Adopt a `style-src 'self' 'unsafe-hashes'` + per-style hash list** | ~4-6 hours; hashes break when any one style changes | MEDIUM (high maintenance burden — every visual tweak rotates a hash) | All 130 |
| **D. Defer Phase 10 until sub-wave 4.1 ships independently** | Schedule slip | LOW operationally; HIGH narrative ("we still haven't tightened CSP") | All 130 |

**Recommendation: Option A.** Cheapest, lowest risk, immediately enables Phase 10 enforcement, and the resulting utility classes are reusable when sub-wave 4.1 finally migrates the IIFE. The planner should size Wave 1 of Phase 10 around Option A.

**`[ASSUMED]`: Option A is acceptable to operator. The discuss phase was skipped, so the operator has not signed off on the migration shape. If the planner has signal that Option B is preferred, switch.**

---

## CSP Directive Matrix (Phase 10 target)

This is the **paste-ready firebase.json snippet** the planner can copy into Wave 2. Every directive is justified by current substrate.

### Current Phase 3 Report-Only directive (line 22 of `firebase.json`)

```text
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';                ← drop 'unsafe-inline' for HOST-06
connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firebasestorage.googleapis.com https://firebaseinstallations.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://securetoken.google.com;
frame-src https://bedeveloped-base-layers.firebaseapp.com;        ← decision: drop or retain
img-src 'self' data: https:;
font-src 'self' data:;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
report-uri /api/csp-violations;
report-to csp-endpoint
```

### Phase 10 enforced directive (RECOMMENDED — paste into firebase.json line 22)

```text
default-src 'self';
script-src 'self';
style-src 'self';
connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://firebasestorage.googleapis.com https://firebaseinstallations.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://securetoken.google.com https://de.sentry.io;
frame-src 'self';
img-src 'self' data: https:;
font-src 'self' data:;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
report-uri /api/csp-violations;
report-to csp-endpoint
```

### Per-directive rationale

| Directive | Phase 3 value | Phase 10 value | Rationale |
|-----------|---------------|---------------|-----------|
| `default-src` | `'self'` | `'self'` | UNCHANGED — root fallback |
| `script-src` | `'self'` | `'self'` | UNCHANGED — Vite produces hashed-filename bundles only; zero inline scripts. **`[VERIFIED: index.html lines 23-24 — the only script tags are `data/pillars.js?v=52` and `./src/main.js?v=52`, both same-origin]`** |
| `style-src` | `'self' 'unsafe-inline'` | **`'self'`** (drop `'unsafe-inline'`) | **HOST-06 the headline change**. Requires Wave 1 inline-style migration to clear the 130 main.js attributes |
| `connect-src` | 9 entries | **+ `https://de.sentry.io`** | **Phase 9 Wave 2 (OBS-04) source-map upload** uses Sentry EU. Without this, source-map upload from CI fails; without Sentry init at runtime fails too. **`[VERIFIED: vite.config.js line 36 — sentryVitePlugin is hard-coded to https://de.sentry.io/]`** |
| `frame-src` | `https://bedeveloped-base-layers.firebaseapp.com` | **`'self'`** (drop the firebaseapp.com allowlist) | **Verified no `signInWithPopup` / `signInWithRedirect` in src/**. The app uses `signInEmailPassword` + `signInWithEmailLink` (Phase 6 D-07 email-link recovery). The Phase 6 + Phase 7 cleanup-ledgers explicitly queue this for Phase 10 with reason "popup flow not used". **`[VERIFIED: grep -r 'signInWithPopup\|signInWithRedirect' src/ returns 0 hits]`** |
| `img-src` | `'self' data: https:` | `'self' data: https:` | UNCHANGED — `data:` for inline avatars; `https:` for any future external image |
| `font-src` | `'self' data:` | `'self' data:` | UNCHANGED — Phase 4 self-hosted Inter + Bebas Neue (woff2 in `assets/fonts/`); CDN font allowlist already dropped in Phase 4 (verified at `tests/firebase-config.test.js:87-92`) |
| `object-src` | `'none'` | `'none'` | UNCHANGED — closes legacy plugin attack surface |
| `base-uri` | `'self'` | `'self'` | UNCHANGED — required by HOST-06 SC#1 |
| `form-action` | `'self'` | `'self'` | UNCHANGED — required by HOST-06 SC#1 |
| `frame-ancestors` | `'none'` | `'none'` | UNCHANGED — already enforced (browsers don't gate on Report-Only mode for `frame-ancestors`) |
| `upgrade-insecure-requests` | present | present | UNCHANGED — defence-in-depth |
| `report-uri` | `/api/csp-violations` | `/api/csp-violations` | UNCHANGED — fallback for browsers that don't support `report-to` |
| `report-to` | `csp-endpoint` | `csp-endpoint` | UNCHANGED — modern Reporting API (paired with `Reporting-Endpoints` header at `firebase.json:19`) |

### What about `'strict-dynamic'`?

The ROADMAP success criterion #1 says `"script-src 'self' (or 'self' 'strict-dynamic' if needed for Firebase SDK lazy loading)"`. **`[VERIFIED]`**: Vite 8 with `manualChunks` (`vite.config.js:63-71`) bundles Firebase as a single named chunk — there is no runtime SDK lazy-loading from a non-self origin. `'strict-dynamic'` is unnecessary AND has tradeoffs (it disables host-source allowlists once a "trusted" script runs). **Recommendation: omit `'strict-dynamic'`. Use plain `'self'`.**

### What about `connect-src` for Sentry?

Phase 9 Wave 1 (`src/observability/sentry.js`) initialises `@sentry/browser` which POSTs error events to `*.de.sentry.io`. Without `connect-src` allowlisting that origin, runtime CSP violations would block the Sentry submission entirely — silently destroying observability. The Wave 2 (this phase) `connect-src` SHOULD include `https://de.sentry.io`. **`[VERIFIED: STATE.md line 159+ — Sentry browser SDK is initialised in production at boot via fbOnAuthStateChanged hook; vite.config.js:36 hard-codes the URL]`.**

This is a **subtle Wave 1 gotcha**: the Phase 9 substrate landed correctly without CSP enforcement (because Phase 3 CSP allowlists `https://*.googleapis.com`-style wildcards but does NOT allow Sentry). Phase 9 ran in Report-Only mode so the violation was logged but Sentry POSTs still succeeded. **Phase 10 enforcement WILL break Sentry submission unless connect-src is updated.** The planner should make this an explicit Wave 2 task: extend `connect-src` with `https://de.sentry.io`.

---

## HSTS Preload Submission Procedure

### Current state (verified)

`firebase.json` line 9: `"Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload"` is **already correctly formed**. Phase 3 schema-test pins this at `tests/firebase-config.test.js:60-66`.

### Eligibility checklist

`[VERIFIED: hstspreload.org submission requirements 2026-05-10 web search]`:

- [x] **HTTPS-only.** Firebase Hosting auto-redirects HTTP → HTTPS at the edge. Verify with `curl -I http://baselayers.bedeveloped.com` returning 301 to https://.
- [x] **`max-age >= 31536000`** (1 year). We set 2 years (63072000). PASS.
- [x] **`includeSubDomains` directive present.** PASS.
- [x] **`preload` directive present.** PASS.
- [ ] **Apex/www consistency.** **`[ASSUMED]`**: `bedeveloped.com` apex serves over HTTPS with HSTS — **operator must verify before submission**. If apex serves with no HSTS, submitting `baselayers.bedeveloped.com` apex-includeSubDomains will commit subdomains the apex doesn't honour. Hostname `baselayers.bedeveloped.com` (subdomain) preload is the safest first step.
- [x] **Custom-domain SSL provisioned.** Phase 3 cutover landed 2026-05-07 with verified A-rated securityheaders rating. PASS.
- [ ] **Policy stable for ≥7 days post-tightening.** Per HOST-06 SC: this gate trips after Phase 10 Wave 3 enforcement flip + 7-day calendar window.

### Submission decision tree

| Question | Decision |
|----------|----------|
| Submit apex `bedeveloped.com` with `includeSubDomains`? | **NO recommended** — `bedeveloped.com` may host services we don't control (email, marketing site, etc.). Apex preload would force HTTPS on every subdomain forever. |
| Submit subdomain `baselayers.bedeveloped.com` directly? | **YES recommended** — bounded scope; reversible (with effort) if BeDeveloped ever pivots. |
| Wait until apex domain is hardened first? | **NO** — would block HOST-07 indefinitely. Subdomain submission is the standard pattern. |

`[ASSUMED]`: Subdomain-only submission is acceptable. **Operator must confirm during Wave 5 — do not auto-submit apex.**

### Submission flow (Wave 5 operator runbook)

```
1. Visit https://hstspreload.org
2. Enter `baselayers.bedeveloped.com` in the form
3. The site auto-checks the live header against the URL
4. If all green, click "Submit"
5. Capture confirmation email (preload list inclusion takes weeks-months;
   verify periodically via https://hstspreload.org/?domain=baselayers.bedeveloped.com)
6. Once verified, screenshot the listing for docs/evidence/ (Phase 11 DOC-09)
```

`[CITED: hstspreload.org]`.

---

## securityheaders.com Rating Verification (Wave 5)

### Current state

Phase 3 verifier achieved "≥A" rating (Phase 3 close 2026-05-07). The Report-Only mode caps the rating at A; **A+ requires enforced CSP**.

### Procedure

```
1. Visit https://securityheaders.com/?q=baselayers.bedeveloped.com&followRedirects=on
2. Capture rating (expected: A+ post-enforcement)
3. Capture summary table (which headers detected, which missing)
4. If rating < A+, investigate:
   - CSP still in Report-Only? (didn't flip to enforced)
   - HSTS missing preload submission? (hstspreload.org status check)
5. Save screenshot to docs/evidence/phase-10-securityheaders-rating.png
   (Phase 11 DOC-09 collects)
```

### A vs A+ delta

| Rating | What's required |
|--------|------------------|
| A | All baseline headers + CSP in Report-Only OR enforced |
| A+ | All baseline headers + CSP enforced (no `unsafe-inline`/`unsafe-eval`) |

**The Phase 10 enforcement flip is what produces the A+ rating** — that's the audit narrative artefact.

---

## Common Pitfalls (Phase 10-specific)

### Pitfall 14 (Vite + GitHub Pages base-path traps with strict CSP) — MITIGATED IN PHASE 3

**Status:** Closed. Phase 3 cut over to Firebase Hosting; Vite `base: '/'` + custom domain works; CSP `script-src 'self'` validated against hashed Vite bundles.

**No further Phase 10 action needed** — verified by Phase 3 close + 376 tests green at Phase 4 close.

`[CITED: PITFALLS.md Pitfall 14 + Phase 3 close note at STATE.md "Phase 3 deliverables (locked 2026-05-07)"]`.

---

### Pitfall 15 (Hosting platform mismatch — meta-CSP vs HTTP-header CSP) — MITIGATED IN PHASE 3

**Status:** Closed. Phase 3 deleted `<meta http-equiv="Content-Security-Policy">` from `index.html`. **`[VERIFIED: index.html 2026-05-10 read — only `<meta charset>` and `<meta name="viewport">` remain]`**. Phase 3 schema test pins this; Phase 4 added a regression test (D-18) that fails if meta-CSP returns.

**Phase 10 verification step:** During Wave 1, re-run `grep '<meta http-equiv="Content-Security-Policy"' index.html` — must return 0. (Already a regression test, but belt-and-braces in the runbook.)

`[CITED: PITFALLS.md Pitfall 15 + STATE.md "tests/firebase-config.test.js — 17 schema-validation assertions"]`.

---

### Pitfall 16 (CSP rollout — too-strict-too-fast breaks Chart.js, Firebase popups, inline styles)

**Status:** Phase 10 is the second-stage execution of Pitfall 16's three-stage rollout. Stage A (Phase 3 — Report-Only with `'unsafe-inline'`). Stage B/C (Phase 10 — drop `'unsafe-inline'`, then flip to enforced).

**Threats Phase 10 must verify on staging before promotion:**

1. **Chart.js radar/donut renders without inline-style violations.** Chart.js 4.5.1 produces canvas-based charts; transient tooltip styles. Test on staging with enforced CSP — verify `npx playwright` or manual smoke with browser DevTools console open.
2. **Firebase Auth flows.** App uses `signInEmailPassword` + email-link recovery — both same-origin POSTs. **Verified no popup flow in `src/`**, so frame-src can drop the firebaseapp.com allowlist. **But:** if a future feature adds federated sign-in (Google/Microsoft OAuth via popup), `frame-src` will need to be re-extended.
3. **Document upload.** Storage SDK posts to `firebasestorage.googleapis.com` — already in `connect-src` allowlist. Verify under enforcement.
4. **Chat real-time updates.** Firestore SDK posts to `firestore.googleapis.com` (covered by `*.googleapis.com` wildcard) and uses WebSocket to `*.firebaseio.com` (covered by `wss://*.firebaseio.com`). Both already in `connect-src`.
5. **Sentry submission.** **NEW concern**: Phase 9 wired `@sentry/browser` posting to `*.de.sentry.io` — currently NOT in `connect-src`. Phase 10 Wave 2 MUST add this.

**Warning signs during soak:**

- `csp.violation` Cloud Logging entries with `blockedUri="https://de.sentry.io"` or `effectiveDirective="connect-src"` — Sentry not allowlisted.
- `csp.violation` entries with `effectiveDirective="style-src"` and `blockedUri="inline"` — Wave 1 inline-style migration missed sites.
- `csp.violation` entries with `violatedDirective="frame-src"` — confirms popup flow IS in use somewhere (unexpected; need to investigate).

`[CITED: PITFALLS.md Pitfall 16 lines 534-562]`.

---

### Pitfall 10A: Inline-style remnant gate (Phase 10-introduced)

**What goes wrong:** Skip the inline-style sweep, flip CSP enforcement, and immediately ALL views with the 130 `style: "..."` properties render with the styles SILENTLY DROPPED. Layouts break. Affects: auth modal padding, dashboard card text-alignment, error-state messages — all the places a user lands on first load.

**Why it happens:** The Phase 4 cleanup-ledger row (line 63: `132 static style="..." inline-attr strings`) explicitly says "atomic with Phase 10 work". If sub-wave 4.1 hasn't run and Phase 10 ships anyway, every static style is now CSP-blocked.

**How to avoid:**

1. **Wave 1 of Phase 10 is the gate.** Either execute Option A (mechanical class migration, recommended) or Option B (full sub-wave 4.1 atomic migration) BEFORE Wave 2 (CSP-RO with strict shape).
2. **Add a CI test** that fails if any new `style: "..."` h()-attribute is added: `grep -c 'style:\s*"' src/` — assert the count never increases above the post-Wave-1 floor.
3. **Snapshot tests cover the visual output.** Phase 2 Snapshot tests at `tests/__snapshots__/views/{dashboard,diagnostic,report}.html` would catch any regression in pre/post the inline-style migration.

**Warning signs:**

- Wave 3 staging soak shows >0 `csp.violation` events with `effectiveDirective="style-src"` and inline source.
- Visual regression in dashboard / auth screens reported by post-cutover smoke.

**Phase to address:** Phase 10 Wave 1 — non-negotiable.

---

### Pitfall 10B: Sentry connect-src omission (newly introduced by Phase 9)

**What goes wrong:** Phase 9 Wave 1 wired `@sentry/browser` and Phase 9 Wave 2 enabled CI source-map upload — but the connect-src allowlist was NEVER updated. Phase 9 ran under CSP Report-Only so violation reports fired but Sentry submissions still succeeded. **Phase 10 enforcement flip will silently destroy Sentry observability.**

**How to avoid:** Wave 2 of Phase 10 MUST add `https://de.sentry.io` to `connect-src`. Add a `tests/firebase-config.test.js` assertion: `expect(cspValue).toContain('https://de.sentry.io')`.

**Warning signs:**

- Cloud Logging `csp.violation` entries with `effectiveDirective="connect-src"` and `blockedUri="https://de.sentry.io/api/..."`.
- Sentry dashboard shows zero events after enforcement flip — silent observability outage.

**Phase to address:** Phase 10 Wave 2 — must include connect-src expansion.

---

## Code Examples

### Example 1: firebase.json hosting.headers DIFF (the substantive Phase 10 edit)

```diff
        {
-         "key": "Content-Security-Policy-Report-Only",
+         "key": "Content-Security-Policy",
          "value": "default-src 'self';
                    script-src 'self';
-                   style-src 'self' 'unsafe-inline';
+                   style-src 'self';
                    connect-src 'self'
                                https://*.googleapis.com
                                https://*.firebaseio.com
                                wss://*.firebaseio.com
                                https://firebasestorage.googleapis.com
                                https://firebaseinstallations.googleapis.com
                                https://identitytoolkit.googleapis.com
                                https://securetoken.googleapis.com
-                               https://securetoken.google.com;
+                               https://securetoken.google.com
+                               https://de.sentry.io;
-                   frame-src https://bedeveloped-base-layers.firebaseapp.com;
+                   frame-src 'self';
                    img-src 'self' data: https:;
                    font-src 'self' data:;
                    object-src 'none';
                    base-uri 'self';
                    form-action 'self';
                    frame-ancestors 'none';
                    upgrade-insecure-requests;
                    report-uri /api/csp-violations;
                    report-to csp-endpoint"
        }
```

### Example 2: tests/firebase-config.test.js extension (Wave 2 deliverable)

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

  // HOST-07 substrate test — actual submission verification is Wave 5 manual
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

### Example 3: Inline-style class-migration pattern (Wave 1)

```diff
// BEFORE — src/main.js line 1097
- const hint = h(
-   "div",
-   { class: "auth-help", style: "margin-top:0; padding-top:0; border:0;" },
-   "First time signing in? ...",
- );

// AFTER — src/main.js + styles.css addition
+ const hint = h(
+   "div",
+   { class: "auth-help u-mt-0 u-pt-0 u-no-border" },
+   "First time signing in? ...",
+ );

// styles.css addition (one-time per unique pattern)
+ .u-mt-0 { margin-top: 0; }
+ .u-pt-0 { padding-top: 0; }
+ .u-no-border { border: 0; }
```

### Example 4: Soak observation query (Wave 3 deliverable)

```bash
# 7-day post-CSP-tightening soak observation
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND resource.labels.service_name="cspreportsink"
   AND severity=WARNING
   AND jsonPayload.message="csp.violation"
   AND jsonPayload.report.disposition="report"' \
  --project=bedeveloped-base-layers \
  --limit=50 \
  --format=json \
  --freshness=7d

# Expected output during soak: ZERO entries from non-extension origins
# (Filter at functions/src/csp/filter.ts already drops chrome-extension://
# and similar synthetic noise.)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Meta-tag CSP (`<meta http-equiv="Content-Security-Policy">`) | HTTP-header CSP via `firebase.json` `hosting.headers` | Phase 3 (2026-05-07) | Enables `frame-ancestors`, `Strict-Transport-Security`, `Permissions-Policy` — none of which work via meta-tag |
| `unsafe-inline` permanent | `'self'` only after class-migration | Phase 10 Wave 1 | Closes XSS-via-inline-style attack surface; HOST-06 |
| Submit hstspreload via email/manual review | hstspreload.org self-service web form | hstspreload.org has been self-service since ~2017 | Operator-paced: form submission + verification weeks |
| `'strict-dynamic'` for SPA bundlers | Plain `'self'` (modern bundlers do not need it for hashed-filename ESM) | CSP3 + bundler maturity | Vite 8 emits no inline scripts — `'strict-dynamic'` adds tradeoffs without benefit |
| Chrome-only preload list | All major browsers (Chrome, Firefox, Safari, Edge) consume the Chrome-curated list | ~2020 | One submission covers all browser HSTS preload caches |

**Deprecated/outdated:**

- **`X-Frame-Options: DENY`** — superseded by `frame-ancestors 'none'`. Already correctly using the modern form.
- **`X-XSS-Protection: 1; mode=block`** — deprecated by all major browsers; CSP supersedes. Phase 3 correctly omits this.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 (`[VERIFIED: package.json devDependencies]`) |
| Config file | `vite.config.js` (lines 78-140 — vitest section) |
| Quick run command | `npm test -- --run firebase-config` |
| Full suite command | `npm test` (excludes tests/rules/** + functions/** per vite.config.js:88-95) |

### Phase 10 Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HOST-06 | header key is "Content-Security-Policy" (not Report-Only) | unit (schema) | `npm test -- --run firebase-config` | EXTEND existing — `tests/firebase-config.test.js` |
| HOST-06 | style-src locked to 'self' | unit (schema) | same | EXTEND existing |
| HOST-06 | frame-src locked to 'self' (no firebaseapp.com) | unit (schema) | same | EXTEND existing |
| HOST-06 | connect-src includes https://de.sentry.io | unit (schema) | same | EXTEND existing |
| HOST-06 | base-uri 'self' + form-action 'self' | unit (schema) | same | EXTEND existing (asserted in Phase 3 partially via line 73-78) |
| HOST-06 SC#2 | sign-in / dashboard / radar / donut / upload / chat work under enforcement on staging | manual smoke (operator runbook) | manual via `runbooks/csp-enforcement-cutover.md` | NEW — Wave 4 deliverable |
| HOST-06 SC#2 | 7-day soak shows zero new violations | operator-paced | `gcloud logging read ... --freshness=7d` | NEW assertion in `runbooks/csp-enforcement-cutover.md` Wave 3 |
| HOST-07 | HSTS header preload-eligible (max-age + includeSubDomains + preload) | unit (schema) | `npm test -- --run firebase-config` | EXTEND existing — already asserted at lines 60-66 (Phase 3) |
| HOST-07 | hstspreload.org submission filed | manual (operator runbook) | manual — see `runbooks/hsts-preload-submission.md` | NEW — Wave 5 deliverable |
| HOST-07 SC#3 | Domain appears in preload list | calendar-paced (weeks-months for inclusion) | manual: `https://hstspreload.org/?domain=baselayers.bedeveloped.com` | NEW assertion in runbook |
| HOST-06 SC#4 | securityheaders.com rating "A+" | manual smoke | manual — visit URL + screenshot | NEW assertion in `runbooks/csp-enforcement-cutover.md` Wave 5 |
| Inline-style sweep | grep returns 0 `style: "..."` h()-properties in src/ | unit (regression) | `grep -c 'style:\\s*"' src/main.js` (assert 0 post-Wave-1) | NEW — Wave 1 ESLint rule + grep gate |

### Sampling Rate

- **Per task commit:** `npm test -- --run firebase-config` (~3s; 17+ assertions)
- **Per wave merge:** `npm test` full suite (~30s; 376+ tests)
- **Phase gate:** Full suite green + manual smoke on staging + 7-day soak query returns zero violations + securityheaders.com A+

### Wave 0 Gaps

- [ ] **`tests/firebase-config.test.js`** — Phase 10 extends with 6 new assertions for enforced CSP shape (Wave 2 deliverable). Existing file is sufficient substrate.
- [ ] **`runbooks/csp-enforcement-cutover.md`** — NEW operator runbook for Wave 4 (analogous to `runbooks/hosting-cutover.md`).
- [ ] **`runbooks/hsts-preload-submission.md`** — NEW operator runbook for Wave 5 hstspreload.org submission flow.
- [ ] **`tests/css/inline-style-regression.test.js`** — OPTIONAL: a `grep`-based regression test that fails CI if any new `style: "..."` attribute returns to `src/`. Could also be enforced via ESLint custom rule. Wave 1 deliverable.

*(Existing test infrastructure covers all phase requirements without new framework installs.)*

---

## Security Domain

### Applicable ASVS Categories (OWASP ASVS 5.0 Level 2)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | partial | `frame-src` decision affects sign-in popup support — Phase 10 confirms email-link only (no popup needed) |
| V3 Session Management | no | Session-fixation defended by Firebase Auth (Phase 6) |
| V4 Access Control | no | Firestore Rules (Phase 5/6) |
| V5 Input Validation | no | Phase 10 doesn't add input handlers |
| V6 Cryptography | no | TLS handled by Firebase Hosting |
| **V14.4 HTTP Security Headers** | **YES — primary** | `Content-Security-Policy`, `Strict-Transport-Security` (preload), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `COOP/COEP`, `frame-ancestors`. Phase 10 closes V14.4 fully. |
| V14.5 Validate HTTP Request Headers | partial | `Reporting-Endpoints` correctly formed (Phase 3) |
| V14.7 Build & Deploy Pipeline | YES | OIDC-authenticated CI deploy (Phase 3 substrate) re-used for Phase 10 |

### Known Threat Patterns for Phase 10

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via injected `<style>` block | Tampering | `style-src 'self'` blocks all inline `<style>` and `style="..."` |
| XSS via `style="..."` attribute on user-controlled DOM | Tampering | Same as above; HOST-06 |
| Click-jacking | Spoofing | `frame-ancestors 'none'` (already enforced — bypasses CSP-Report-Only-mode skip) |
| Mixed-content downgrade | Information Disclosure | `upgrade-insecure-requests` + HSTS preload |
| MITM downgrade attack | Tampering | HSTS preload — browser refuses to attempt HTTP for the domain |
| Form-target hijack | Spoofing | `form-action 'self'` |
| `<base>` tag injection | Tampering | `base-uri 'self'` |
| Untrusted iframe inclusion | Tampering | `frame-src 'self'` (post-Phase-10) |
| External resource leak via `data:` font URL | Information Disclosure | `font-src 'self' data:` — `data:` allowed for known-safe inline fonts only |

### Compliance Framework Citations

| Framework | Section | What Phase 10 Closes |
|-----------|---------|----------------------|
| OWASP ASVS L2 | V14.4 (HTTP Security Headers) | All required headers present + CSP enforced (not Report-Only); HSTS preloaded |
| ISO 27001:2022 | A.8.23 (web filtering) + A.8.26 (application security requirements) | CSP locks the script + style + frame surface; HSTS preload locks transport |
| SOC 2 | CC6.6 (logical access — system boundary) + CC6.7 (data in transit) | Header-level boundary enforcement; HTTPS preload commitment |
| GDPR | Art. 32(1)(a) (pseudonymisation/encryption) | HSTS preload ensures all data subject interactions are HTTPS |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Firebase Hosting | Phase 10 production substrate | ✓ | n/a (managed) | — |
| `firebase-tools` | CI deploy job | ✓ | 15.16.0 | — |
| `gcloud logging` CLI | Soak observation query | ✓ | (operator must have Cloud SDK installed) | Cloud Logging Console UI |
| `curl` | Cutover smoke + securityheaders detection | ✓ | (Windows: PowerShell `Invoke-WebRequest`) | — |
| Browser (modern) | Manual smoke under enforcement | ✓ | Chrome 120+ recommended | — |
| `hstspreload.org` web form | Wave 5 manual submission | ✓ | n/a (third-party) | None — only path to preload list |
| `securityheaders.com` web tool | Wave 5 rating verification | ✓ | n/a (third-party) | Cross-check via `curl -I` for header set; rating is best-of-breed signal |

**Missing dependencies with no fallback:** None. All substrate is present from Phase 3 + Phase 7.

**Missing dependencies with fallback:** None.

---

## SECURITY.md Increment Plan (DOC-10)

Phase 10 Wave 5 closing task adds the following sections to `SECURITY.md`:

| Section | Content | Word Estimate |
|---------|---------|---------------|
| § Content Security Policy (enforced) | Replace existing § CSP (Report-Only) section: directive-by-directive table; rationale per-directive; `'unsafe-inline'` removal narrative; soak window evidence | ~250 words |
| § HSTS Preload Status | Submission date; preload-list inclusion status; eligibility check confirmation | ~80 words |
| § Phase 10 Audit Index | 4-row Pattern G table: HOST-06, HOST-07, DOC-10, code-link/test-link/runbook-link/framework citations (ASVS V14.4, ISO 27001 A.8.23, SOC 2 CC6.6, GDPR Art. 32(1)(a)) | ~150 words |

**Pattern reference:** Phase 9 Wave 7 (`Plan 09-06`) landed § Observability — Sentry + § Audit-Event Wiring + § Anomaly Alerting + § Out-of-band Monitors + § Phase 9 Audit Index — same shape Phase 10 Wave 5 follows.

---

## Recommended Wave Structure

5 waves (smaller than Phase 9). Total estimate: 1-2 days autonomous + 7-day calendar soak + 30 min operator deploy session.

### Wave 1 — Inline-style sweep gate (autonomous; ~2-3 hours)
- **Mandate:** Reduce `grep -c 'style:\s*"' src/main.js` from 130 to 0 via mechanical class migration (Option A).
- Add utility classes to `styles.css` for the unique style-string patterns; substitute in `src/main.js`.
- Bump `index.html` `?v=52` → `?v=53` (cache-busting convention).
- Verify Phase 2 snapshot tests at `tests/__snapshots__/views/{dashboard,diagnostic,report}.html` show zero rendered-HTML drift.
- **Deliverable:** Commit `refactor(10-01): migrate 130 inline-style attrs to utility classes (Phase 4 sub-wave 4.1 closure)`.
- **Closes carryover row:** `runbooks/phase-4-cleanup-ledger.md` "132 static `style="..."` strings" row.

### Wave 2 — Tightened CSP-Report-Only + connect-src expansion (autonomous; ~1 hour)
- Edit `firebase.json` line 22:
  - Drop `'unsafe-inline'` from `style-src`
  - Add `https://de.sentry.io` to `connect-src` (Pitfall 10B mitigation)
  - Drop `https://bedeveloped-base-layers.firebaseapp.com` from `frame-src`; replace with `'self'` (or omit `frame-src` directive — defaults to `default-src 'self'`)
- **Header KEY remains `Content-Security-Policy-Report-Only`** at this wave — we want fresh observability with the new shape.
- Extend `tests/firebase-config.test.js` with 6 new assertions (see §Code Examples Example 2 above).
- Run Vitest, verify all 17+ existing assertions still pass + 6 new pass.
- **Deliverable:** Commit `feat(10-02): tighten CSP-RO directives + extend schema test (HOST-06 substrate)`.

### Wave 3 — Production deploy of Wave 2 + 7-day soak (operator-paced; calendar time)
- Operator runs `firebase deploy --only hosting` (selective deploy per Pitfall 8).
- Document the deploy timestamp in `10-PREFLIGHT.md ## Soak Log`.
- 7-day calendar window observation: `gcloud logging read` daily; expected zero new violations.
- If violations appear: triage at the cspReportSink jsonPayload level, fix root cause (likely missed inline style or new external connect-src needed), re-deploy, restart 7-day window.
- **Deliverable:** `10-PREFLIGHT.md ## Soak Log` populated; CI green; soak window cleanly closed.

### Wave 4 — Production enforcement flip (operator-paced; ~30 min)
- Authoring task (autonomous): Write `runbooks/csp-enforcement-cutover.md` (analog of `runbooks/hosting-cutover.md`):
  - Pre-flight: Soak Log shows 7-day zero-violation window
  - Flip step: Edit firebase.json line 21 `Content-Security-Policy-Report-Only` → `Content-Security-Policy`
  - Same-session smoke: sign-in / dashboard / radar / donut / upload / chat all work under enforcement
  - Verification: `curl -I` shows the enforced header (no `-Report-Only` suffix)
  - Rollback: revert the firebase.json edit + redeploy if any of the smokes regress (~5 min)
- Operator session: Run the runbook end-to-end during a quiet window; capture timestamps.
- **Deliverable:** Commit `feat(10-04): flip CSP from Report-Only to enforced (HOST-06 closes)`.

### Wave 5 — HSTS preload submission + securityheaders.com rating + DOC-10 increment (operator + autonomous; ~1 hour)
- Authoring task (autonomous): Write `runbooks/hsts-preload-submission.md` (~80 lines).
- Operator: Visit hstspreload.org, submit `baselayers.bedeveloped.com`, capture confirmation email.
- Operator: Visit `https://securityheaders.com/?q=baselayers.bedeveloped.com&followRedirects=on`, capture A+ rating screenshot to `docs/evidence/phase-10-securityheaders-rating.png`.
- Authoring task: Append to `SECURITY.md` per §SECURITY.md Increment Plan above.
- Authoring task: Update `REQUIREMENTS.md` traceability — flip HOST-06 + HOST-07 + DOC-10 to `[x]` Validated + Phase 10 close date.
- Authoring task: Author `runbooks/phase-10-cleanup-ledger.md` zero-out gate (closes the Phase 10 forward-tracking row from `runbooks/phase-{6,7}-cleanup-ledger.md`).
- **Deliverable:** Commits `docs(10-05): SECURITY.md Phase 10 increment + Audit Index` + `chore(10-05): close Phase 10 cleanup ledger`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Option A (mechanical class migration) is acceptable to operator | §Inline-Style Remnant Inventory | Operator may prefer Option B (full IIFE migration). Discuss-phase was skipped, so no signal. **Recommend planner check with operator before Wave 1.** |
| A2 | BeDeveloped owns the apex domain and prefers subdomain-only HSTS preload | §HSTS Preload Submission Procedure | If operator wants apex+includeSubDomains, the subdomain submission is harmless but redundant; if operator does NOT want apex preload, subdomain submission is the right call. Wave 5 runbook should make this an explicit operator decision step. |
| A3 | The 7-day soak will surface zero violations after Wave 1 inline-style migration is complete | §Recommended Wave Structure (Wave 3) | If violations appear, Wave 3 extends until clean — calendar slip but not a phase failure. |
| A4 | Sentry submission origin is `https://de.sentry.io` (not a project-specific subdomain) | §CSP Directive Matrix (Sentry connect-src) | If Sentry uses `https://o<orgId>.ingest.de.sentry.io` instead, plain `https://de.sentry.io` may not allowlist the actual ingest endpoint. **Verify against an actual Sentry submission's network tab in browser DevTools during Wave 2 staging soak.** |
| A5 | No popup-based federated sign-in is planned for v1 | §CSP Directive Matrix (frame-src) | If a future feature adds Google/Microsoft OAuth via popup, frame-src will need re-extension. v2 deferred per REQUIREMENTS.md "Authentication / Identity (v2)". |
| A6 | Sub-wave 4.1 main.js IIFE migration is NOT a Phase 10 prerequisite (Option A is sufficient) | §Inline-Style Remnant Inventory | If sub-wave 4.1 IS the prerequisite, Phase 10 schedule slips substantially (~1-2 days). Mitigated by Option A's strictly-cheaper substitute. |

---

## Open Questions

1. **Apex domain HSTS preload decision (A2 above)**
   - What we know: subdomain-only preload is bounded + reversible-with-effort; apex+includeSubDomains is unboundable + irreversible.
   - What's unclear: BeDeveloped's relationship with the apex domain (`bedeveloped.com`) — does it host other services that may break under HSTS preload?
   - Recommendation: Wave 5 runbook makes this an explicit operator decision step. Subdomain-only is the safe default.

2. **Sentry ingest origin precise hostname (A4 above)**
   - What we know: vite.config.js hard-codes `https://de.sentry.io/` for the upload plugin.
   - What's unclear: At runtime, the SDK posts events to a project-specific subdomain that derives from the DSN. The DSN's hostname may be `https://o4506000000000000.ingest.de.sentry.io/api/...`.
   - Recommendation: During Wave 2 staging soak, the operator should open DevTools Network tab on a page with a forced error and capture the actual outbound origin. Update connect-src if it's not `de.sentry.io` plain.

3. **Should Wave 1 also fix the 14 `window.FB.*` + bare `Chart` bridges?**
   - What we know: cleanup-ledger row at line 61-62 says these bridges close with the main.js-body-migration sub-wave.
   - What's unclear: Strict CSP doesn't directly affect `window.FB.*` (it's a property assignment, not a CSP-controlled surface). Chart-as-bare-global is fine under CSP.
   - Recommendation: Out of scope. Leave for Phase 4.1 sub-wave proper.

4. **Does Phase 9's authAnomalyAlert need any CSP allowlist for Slack webhook?**
   - What we know: authAnomalyAlert is a Cloud Function that POSTs to `hooks.slack.com` via server-side `fetch`. Cloud Functions outbound traffic is NOT subject to CSP (CSP is browser-only).
   - What's unclear: Nothing — server-side. No CSP impact.
   - Recommendation: No action needed.

---

## Sources

### Primary (HIGH confidence)

- `firebase.json` (lines 5-34) — current header config; baseline for Phase 10 edits
- `tests/firebase-config.test.js` (94 lines) — Phase 3 schema-validation contract; Phase 10 extends
- `functions/src/csp/cspReportSink.ts` (124 lines) — Phase 3 substrate; READ-ONLY in Phase 10
- `runbooks/hosting-cutover.md` (432 lines) — Phase 3 cutover runbook; analog for Phase 10 enforcement cutover runbook
- `runbooks/phase-4-cleanup-ledger.md` (line 63) — "132 static `style="..."` strings in src/main.js IIFE" — the load-bearing gate
- `runbooks/phase-{6,7}-cleanup-ledger.md` "Phase 10 — forward-tracking" — drop temporary `frame-src` allowlist for Firebase Auth popup
- `src/main.js` (5279 lines) — IIFE preservation site; 130 `style: "..."` h()-properties verified by grep 2026-05-10
- `src/ui/dom.js` (lines 27-44) — h() function; `el.setAttribute("style", v)` is the CSP-violating path
- `src/firebase/app.js` (line 15) — `authDomain: "bedeveloped-base-layers.firebaseapp.com"`
- `vite.config.js` (line 36) — `url: "https://de.sentry.io/"` Sentry plugin config (load-bearing for connect-src expansion)
- `index.html` (27 lines) — verified no meta-CSP; only same-origin script tags
- `package.json` — confirmed firebase 12.12.1, vite 8.0.10, vitest 4.1.5 (zero new deps)
- `[CITED: PITFALLS.md]` Pitfall 14 (lines 452-477), Pitfall 15 (lines 481-530), Pitfall 16 (lines 534-562)
- `[CITED: SUMMARY.md]` Phase 10 (lines 241-247) — research-flagged "Standard patterns. Mechanical inline-style → class sweep was Phase 4; Phase 10 just flips the flag."

### Secondary (MEDIUM confidence)

- [HSTS Preload List Submission](https://hstspreload.org/) — submission requirements verified 2026-05-10
- [Strict-Transport-Security MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security) — directive semantics
- [HTTP Strict Transport Security OWASP Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Strict_Transport_Security_Cheat_Sheet.html) — preload best practices
- Phase 3 securityheaders.com rating (Phase 3 close note in STATE.md) — A rating achieved; A+ requires Phase 10

### Tertiary (LOW confidence — flagged for verification)

- A4 (Sentry ingest origin) — verify against runtime DevTools Network tab during Wave 2 staging soak
- A2 (apex domain ownership + intent) — operator confirms during Wave 5 runbook execution

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all in repo at verified versions
- Architecture: HIGH — Phase 3 substrate is well-documented, working, and unchanged
- Pitfalls: HIGH — Pitfalls 14/15 closed in Phase 3; Pitfall 16 is a known three-stage rollout pattern; Pitfalls 10A/10B are Phase 10-specific gates documented above
- Inline-style remnant blocker: HIGH — 130 attributes verified by grep; mechanical class migration is straightforward
- HSTS preload: HIGH — header already correctly formed; submission flow well-documented
- Sentry connect-src: MEDIUM — origin hostname needs runtime verification during Wave 2 (A4 risk)

**Research date:** 2026-05-10
**Valid until:** 2026-06-10 (CSP3 spec stable; Firebase Hosting headers config stable; hstspreload.org rules unchanged for years)
