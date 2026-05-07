# Phase 4: Modular Split + Quick Wins - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 04-modular-split-quick-wins
**Areas discussed:** Wave shape & app.js death; firebase/ adapter + Chart.js CDN→npm; data/* scope vs Phase 5; Toast + upload validation UX

---

## Wave Shape & app.js Death

### Q1: Wave pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Pattern A: boundaries-first | Wave 1 firebase/ → Wave 2 ui/ + html: deletion + meta-CSP test → Wave 3 data/ → Wave 4 views/ (quick-wins fold per view) → Wave 5 state+router+main+app.js dies → Wave 6 cleanup. 5–6 reviewable waves. | ✓ |
| Pattern B: per-view strangler-fig | Each view in its own wave, pulling data/ needs as it goes. ~10+ waves; data/ boundary churns. | |
| Hybrid: boundaries-first then parallelised views | Pattern A for Waves 1–3, then Wave 4 splits into 2–3 parallel sub-waves. | |
| Big-bang: one commit | Single PR moves all of app.js. Defensible for no-live-users; loses snapshot-baseline checkpoint. | |

**User's choice:** Pattern A (Recommended)

### Q2: state.js + router.js extraction order

| Option | Description | Selected |
|--------|-------------|----------|
| Last — with main.js, after views | IIFE retains state + dispatcher until all 12 views extract; state+router+main land together; lowest snapshot-baseline risk. | ✓ |
| First — before views | Extract state+router+main first; views drop in as they extract. Dispatcher rewritten twice. | |
| Middle — after pilot views | Extract 2–3 pilot views, then state+router, then bulk-extract remaining views. | |

**User's choice:** Last — with main.js (Recommended)

### Q3: app.js cutover

| Option | Description | Selected |
|--------|-------------|----------|
| One final commit deletes app.js | Wave 5 commit deletes app.js + flips index.html src to ./src/main.js + closes // @ts-nocheck row. | ✓ |
| Gradual thinning to zero-line file | app.js shrinks per wave; final state is empty file. Misaligned with CODE-01 "previous app.js IIFE is gone". | |
| Two-step: rename to src/legacy/app.js then delete | Rename then delete; adds no-op rename commit. | |

**User's choice:** One final delete commit (Recommended)

### Q4: ESLint no-restricted-imports flip timing

| Option | Description | Selected |
|--------|-------------|----------|
| Per-wave hardening as boundaries land | Wave 1 firebase/* boundary → error; Wave 3 data/ rules; Wave 4 views/ pattern. | ✓ |
| End-of-phase one-shot flip | Keep "warn" through extraction; flip everything to "error" in Wave 6 cleanup. Risk: regressions land as warnings until end. | |
| Tool swap to eslint-plugin-boundaries | Replace no-restricted-imports patterns with boundaries plugin. Adds dep + new rule semantics. | |

**User's choice:** Per-wave hardening (Recommended)

---

## firebase/ Adapter + Chart.js CDN→npm

### Q1: Adapter file layout

| Option | Description | Selected |
|--------|-------------|----------|
| Per-feature submodules per ARCHITECTURE.md §2.2 | firebase/{app,auth,db,storage,functions,check}.js. Per-service mocking; ARCHITECTURE.md §2.2 verbatim. | ✓ |
| Single firebase.js facade | One file exports {app,auth,db,storage,functions}. Simpler import; harder to mock; harder to grow. | |
| Two-tier: firebase/index.js facade re-exporting submodules | Adds indirection that complicates lint boundary. | |

**User's choice:** Per-feature submodules (Recommended)

### Q2: Init pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Eager synchronous init at module load | initializeApp → initAppCheck → getAuth/Firestore/Storage/Functions in order; main.js imports firebase/app.js first. | ✓ |
| Lazy promise-based init | Exports `ready: Promise<{...}>`; every consumer awaits. Noisy refactor; not justified by App Check. | |
| Hybrid: eager but returns null until ready | Adds defensive boilerplate at every call site. | |

**User's choice:** Eager synchronous (Recommended)

### Q3: App Check init in firebase/check.js Phase 4 scope

| Option | Description | Selected |
|--------|-------------|----------|
| Empty no-op stub Phase 7 fills in | Documented seam; Phase 7 replaces body without changing import surface. | ✓ |
| Debug-mode init in Phase 4 | App Check semantics in Phase 4 blast radius for marginal value. | |
| Don't create firebase/check.js until Phase 7 | Phase 4 adapter shape incomplete relative to ARCHITECTURE.md §2.2. | |

**User's choice:** Empty no-op stub (Recommended)

### Q4: CDN cleanup

| Option | Description | Selected |
|--------|-------------|----------|
| Chart.js → ui/charts.js wrapper + Google Fonts self-hosted | npm Chart.js + brand-color CSS custom properties; woff2 in assets/fonts/, local @font-face. Drops 3 CSP allowlist entries. | ✓ |
| Chart.js per-view npm import + Google Fonts self-hosted | Same fonts; per-view Chart import loses brand-color centralisation. | |
| Chart.js → ui/charts.js wrapper + Google Fonts preconnect-only | Self-host Chart.js; keep Google Fonts on CDN. Leaves 2 of 3 temporary CSP entries. | |

**User's choice:** ui/charts.js wrapper + self-hosted fonts (Recommended)

---

## data/* Scope vs Phase 5 Collision

### Q1: Wrapper scope

| Option | Description | Selected |
|--------|-------------|----------|
| All 12 wrappers; rewrite-targets as thin pass-throughs | Phase 4 ships 12; Phase 5 rewrites 6 bodies to subcollection access; API surface stable; views/ never re-extract. | ✓ |
| Only 6 stable wrappers; views/ reach into orgs/ for the rest | Lint boundary fuzzy; doubles views/ churn at Phase 5. | |
| All 12 with rewrite-targets fully implemented against nested-map | Phase 5 rewrites 6 wrapper bodies wholesale; loses delegation chain; no benefit. | |

**User's choice:** All 12 with pass-through rewrite-targets (Recommended)

### Q2: API shape

| Option | Description | Selected |
|--------|-------------|----------|
| Promise CRUD + onSnapshot helpers | get/list/save/delete + subscribe* returning unsubscribe; onSnapshot wrapper localised in firebase/db.js. | ✓ |
| Promise CRUD only | views/ that need live data import from firebase/ directly; punctures boundary. | |
| Raw onSnapshot subscriptions only | Mirror today's IIFE pattern; harder to test. | |

**User's choice:** Promise CRUD + onSnapshot helpers (Recommended)

### Q3: cloud/* + observability/* substrate

| Option | Description | Selected |
|--------|-------------|----------|
| Empty stub seams now; Phase 7/9 fill in | cloud/{audit,soft-delete,gdpr,claims-admin,retry}.js + observability/{sentry,audit-events}.js as documented no-ops. | ✓ |
| Don't create cloud/ or observability/ until Phase 7 | Phase 4 directory tree incomplete relative to ARCHITECTURE.md §2. | |
| Land cloud/audit.js with console.log fallback | Adds Phase 4 wiring that has to be undone in Phase 7. | |

**User's choice:** Empty stub seams (Recommended)

### Q4: Snapshot baseline policy for data/* extraction drift

| Option | Description | Selected |
|--------|-------------|----------|
| Faithful extraction — wrap, don't refactor | Snapshot baselines stay stable; improvements deferred to follow-up commits after wave's snapshot diff lands at zero. Mirrors Phase 2 D-05. | ✓ |
| Permit surgical improvements with documented diff | Per-improvement justification at PR time; review burden up; drift risk up. | |
| Free refactoring — Phase 4 is the rewrite phase | Loses snapshot baseline as regression-detection contract. | |

**User's choice:** Faithful extraction (Recommended)

---

## Toast + Upload Validation UX

### Q1: Toast levels and visual treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Four levels (info/success/warn/error) + tinted bg + Unicode symbols | notify(level,message,opts?). CSS custom properties for theming. role=status / role=alert. | ✓ |
| Three levels (info/warn/error) | Drop success; loses positive-confirmation pattern. | |
| Two levels (info/error) | No warn; can't differentiate "export complete" from "new comment received". | |

**User's choice:** Four levels (Recommended)

### Q2: Toast position and dismissal behaviour

| Option | Description | Selected |
|--------|-------------|----------|
| Top-right + tiered auto-dismiss + sticky errors | 16px from edges. info 4s / success 4s / warn 7s / error ∞ (manual close). Max 3 visible. Pause-on-hover. Mobile swipe. | ✓ |
| Top-center + uniform 5s timer + manual close | Errors disappearing after 5s loses upload-failure context. | |
| Bottom-right + tiered auto-dismiss + sticky errors | Same dismissal rules; bottom placement. Cosmetic. | |

**User's choice:** Top-right + tiered + sticky errors (Recommended)

### Q3: Upload validation surface and error path

| Option | Description | Selected |
|--------|-------------|----------|
| ui/upload.js helper called from views/ before data/documents.js | New helper validateUpload() returns {ok,sanitisedName} \| {ok:false,reason}. Trust boundary at ui/upload.js. | ✓ |
| Validate inside data/documents.js wrapper | Lower trust-boundary risk; doubles error-path code in views/. | |
| Validate at both layers (defence in depth) | Two sources of truth; drift risk. | |

**User's choice:** ui/upload.js helper before data/documents.js (Recommended)

### Q4: MIME-check method and allowlist content

| Option | Description | Selected |
|--------|-------------|----------|
| Magic-byte sniff first 32 bytes + declared file.type cross-check; allowlist {PDF, JPEG, PNG, DOCX, XLSX, TXT} | file.slice(0,32).arrayBuffer() against signature table. Filename sanitisation per CODE-09. Closes H6 client-side. | ✓ |
| Declared file.type only + allowlist {PDF, JPEG, PNG, DOCX, XLSX, TXT} | Faster to ship; weaker control; renamed .exe with forged Content-Type sails through. | |
| Magic-byte sniff + narrower allowlist {PDF, JPEG, PNG only} | Drops Office docs; too restrictive without confirming use case. | |

**User's choice:** Magic-byte sniff + declared file.type cross-check; full allowlist (Recommended)

---

## Claude's Discretion

The following areas were captured as Claude's discretion in CONTEXT.md `<decisions>` "Claude's Discretion":

- Exact CSS class naming convention for inline-style sweep (CODE-06)
- Order of view extraction within Wave 4 (likely deepest-leaf-first)
- Exact API signatures of the 12 data/* wrappers (planner derives from current IIFE consumption)
- ui/charts.js factory shape (function vs thin wrapper)
- Husky pre-commit grep complement to tests/index-html-meta-csp.test.js
- Toast container DOM shape (`<div id="toastRoot">` vs `<aside aria-live="polite">`)
- Whether to add `inert` attribute support during error toasts
- Exact magic-byte signature for TXT type
- Filename collision handling
- Snapshot fixture extension for Wave 5 state+router+main extraction
- Per-view-test snapshot files beyond the 3 baselines

## Deferred Ideas

The following were deferred to other phases or to backlog (full rationale in CONTEXT.md `<deferred>`):

- Trusted Types — Phase 10 add-on or Phase 4 optional follow-up
- DOMPurify — out of scope unless rich-text rendering becomes a feature
- eslint-plugin-boundaries — defer unless per-wave hardening proves brittle
- Per-tsconfig project references for src/* directories
- runbooks/phase-4-extraction-checklist.md — Claude's discretion
- Codecov / Coveralls — sufficient with in-repo HTML report
- Bot-driven snapshot updates — single-developer scale
- Toast WCAG 2.2 AA audit beyond basics
- Inline-style sweep automation (codemod)
- data/pillars.js move from root to src/data/
- Per-view test snapshots beyond the 3 baselines

---

*Discussion log captured 2026-05-07; canonical decisions in 04-CONTEXT.md.*
