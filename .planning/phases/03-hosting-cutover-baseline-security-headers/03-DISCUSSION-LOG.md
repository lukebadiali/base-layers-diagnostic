# Phase 3: Hosting Cutover + Baseline Security Headers - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `03-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 03-hosting-cutover-baseline-security-headers
**Areas discussed:** Cutover topology, csp-violations Cloud Function, CSP report-only policy strictness, CSP report sink + filtering

---

## Cutover Topology

### Q1: Cutover style — how do we validate Firebase Hosting before flipping the baselayers.bedeveloped.com CNAME?

| Option | Description | Selected |
|--------|-------------|----------|
| Firebase project URL soak | Deploy to Firebase Hosting; smoke on Firebase default URL; flip CNAME once green | ✓ (fallback after Vercel question) |
| Sub-subdomain soak | DNS-point a sub-subdomain at Firebase for soak under our own domain shape | |
| Parallel-run week | Run GH-Pages + Firebase Hosting in parallel for ~1 week | |
| Big-bang flip | Deploy + flip CNAME in one shot | |

**User's choice:** "we want to deploy on vercel but if thats not relavent 1" — fell back to option 1 (Firebase project URL soak)
**Notes:** User raised Vercel mid-question. PROJECT.md locks "Stay on Firebase" with Pitfall 15 rationale (SOC2 co-location). Acknowledged seriously, captured Vercel-for-hosting-only as a deferred consideration in CONTEXT.md (not the same as the full Vercel + Supabase migration that PROJECT.md Out-of-Scope rejected; but the same Pitfall 15 reason applies). Confirmed Firebase Hosting path per fallback.

### Q2: Soak duration on the Firebase project URL before flipping CNAME?

| Option | Description | Selected |
|--------|-------------|----------|
| 48 hours | One full Firebase build cache cycle + a day of curl-based header verification | |
| Smoke + same-session flip (~1 hour) | Deploy, smoke, flip CNAME same session | ✓ |
| 1 week | Full week soak | |

**User's choice:** Smoke + same-session flip (~1 hour)
**Notes:** Overrides 48h conservative default. Defensible: no live users, registrar-side rollback is fast, the Firebase default URL is already a true production-shape URL on a Firebase project that already houses Auth/Firestore/Storage.

### Q3: After cutover, how long do we keep GH-Pages instantly redeployable as rollback?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep gh-pages branch + Pages setting deployable for 14 days | Rollback = re-enable Pages + revert CNAME (15 min) | ✓ |
| Keep indefinitely | Permanent fallback | |
| Cut clean on cutover day | Disable + delete substrate same commit | |

**User's choice:** 14-day retention
**Notes:** Clean rollback window without permanent "two production paths" audit smell. Day-14 cleanup commit owned by phase-4-cleanup-ledger.

---

## csp-violations Cloud Function

### Q1: How much of Phase 7's full functions/ setup do we stand up in Phase 3?

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal skeleton | TS + Node 22 + Gen 2 + firebase-admin/functions deps + ESLint + Prettier + tsc + one HTTPS function | ✓ |
| Full Phase 7 substrate now | App Check, Zod, Sentry, per-function service accounts, idempotency markers, defineSecret() | |
| Adapter-only (no functions/) | Sentry Security Endpoint or report-uri.com; defer functions/ entirely | |

**User's choice:** Minimal skeleton
**Notes:** Phase 7 expands the same skeleton — same Node version, same Gen-2 stance. Adapter-only would add an external sub-processor (PRIVACY.md cost) for marginal effort savings.

### Q2: How is the report endpoint URL exposed?

| Option | Description | Selected |
|--------|-------------|----------|
| firebase.json rewrite to /api/csp-violations | Same-origin; CSP report-uri stays decoupled from CF URL shape | ✓ |
| Raw Cloud Functions URL | Requires connect-src entry for cloudfunctions.net; couples CSP to function URL | |

**User's choice:** Same-origin rewrite
**Notes:** Means Phase 7 can rename/move the function without a CSP edit.

### Q3: Cloud Function region for csp-violations?

| Option | Description | Selected |
|--------|-------------|----------|
| europe-west2 (London) | Closest GCP region to UK clients + BeDeveloped; resolves Phase 11 PRIVACY.md residency early | ✓ |
| us-central1 (default) | Lowest cold-start latency on free tier | |
| Match Firestore region (verify first) | Run gcloud firestore databases describe before deploying | |

**User's choice:** europe-west2
**Notes:** Pulls STATE.md's "Firestore region not yet verified" Phase 6 todo forward as a Phase 3 pre-flight. If Firestore is somewhere else, planner records the divergence and Phase 6 owns the residency conversation.

---

## CSP Report-Only Policy Strictness

### Q1: How strict is the initial Content-Security-Policy-Report-Only policy?

| Option | Description | Selected |
|--------|-------------|----------|
| Two-tier | Tight on script/connect/frame/object/base/form; permissive on style-src 'unsafe-inline' until Phase 10 | ✓ |
| Target-strict from day 1 | Phase 10's eventual policy in Report-Only now | |
| Permissive (Pitfall 16 Stage A literal) | default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: | |

**User's choice:** Two-tier
**Notes:** Useful soak signal without drowning in known Chart.js / inline-style noise. Phase 10 flips one knob: drop 'unsafe-inline' from style-src. Phase 4's M5 sweep is the gate.

### Q2: Reporting mechanism for CSP violations?

| Option | Description | Selected |
|--------|-------------|----------|
| Both report-uri (legacy) + report-to + Reporting-Endpoints (modern) | Belt-and-braces; function accepts both wire formats | ✓ |
| report-uri only | Loses reports from modern Chromium that prefers report-to | |
| report-to only | Loses reports from older Safari / Firefox without full Reporting-Endpoints support | |

**User's choice:** Both
**Notes:** Zero report loss across browser versions during the milestone-long soak.

### Q3: Add frame-src for the Firebase Auth popup origin proactively, or defer until Phase 6?

| Option | Description | Selected |
|--------|-------------|----------|
| Add now — frame-src https://bedeveloped-base-layers.firebaseapp.com | Saves Phase 6 a CSP edit; harmless since origin isn't loaded until Phase 6 | ✓ |
| Defer to Phase 6 | Cleaner audit narrative ("CSP changed when behaviour changed") but adds a Phase 6 dependency on CSP edits | |

**User's choice:** Add now
**Notes:** Phase 6 is the load-bearing Auth + Rules-deploy cutover; one fewer CSP-edit blast radius is preferable.

---

## CSP Report Sink + Filtering

### Q1: Where do CSP violation reports persist?

| Option | Description | Selected |
|--------|-------------|----------|
| Cloud Logging structured logs | Queryable in Logs Explorer; free tier 50 GiB/mo; no Firestore footprint | ✓ |
| Firestore cspViolations/{reportId} collection | In-app admin view possible; rules + index + soft-delete entanglement | |
| Both — Firestore + Cloud Logging | Defence-in-depth; doubles writes; in-app dashboard not on milestone path | |
| Sentry only (defer to Phase 9) | Loses reports for the soak window | |

**User's choice:** Cloud Logging structured logs
**Notes:** Right tier for security telemetry. Phase 9 can build a dashboard backed by Cloud Logging queries (or BigQuery sink, since Phase 7 sets one up for AUDIT-03 anyway).

### Q2: Filter rules — what do we drop in the function before logging?

| Option | Description | Selected |
|--------|-------------|----------|
| Browser extension origins (moz-extension://, chrome-extension://, safari-web-extension://) | User-installed extensions; not our problem | ✓ |
| about:srcdoc, about:blank, data: source-files | Synthetic origins from injected iframes; pure noise | ✓ |
| Dedup within a 5-minute window per (blocked-uri, violated-directive) | Cuts log volume ~95% without losing distinct violations | ✓ |
| Reports with referrer / document-uri not matching baselayers.bedeveloped.com or *.web.app | Risky during soak when actively testing project URL | |

**User's choice:** Browser extensions + synthetic origins + 5-min dedup. Document-uri filter NOT applied (kept open during soak).
**Notes:** Document-uri filter can be tightened post-cutover once we know what's legitimate.

### Q3: Abuse protection on the un-authed report endpoint?

| Option | Description | Selected |
|--------|-------------|----------|
| Content-type + body-size validation only | Lightest defence; sufficient for low-volume single-tenant app | ✓ |
| Per-IP rate limiting in the function | In-memory token bucket; doesn't survive cold-starts | |
| Cloud Armor in front of the function | Real protection; Phase-7-grade infrastructure for one endpoint | |

**User's choice:** Content-type + body-size only
**Notes:** App Check is not enforceable on this endpoint by design (browsers POST CSP reports without App Check tokens). Escalate to per-IP rate-limit (in-function token bucket) in Phase 7 if Cloud Logging shows abuse.

---

## Claude's Discretion

- Permissions-Policy directive list (D-13 specifies a conservative default)
- COEP variant — `credentialless` chosen over `require-corp` (D-13 rationale)
- `firebase.json` location at repo root
- `functions/` workspace as standalone (root `package.json` does NOT add it as a workspace member)
- Cache headers on `dist/assets/*` vs `index.html`
- Firebase Hosting site name (default site = project ID)
- Branch protection update timing (Pitfall A — after first green run)
- Exact dedup-key normalization in the report sink
- The exact rewrite glob ordering in `firebase.json` (SPA fallback vs `/api/**` rewrite)

## Deferred Ideas

- Vercel-for-hosting-only (raised by user mid-discussion; deferred per PROJECT.md "Stay on Firebase" lock)
- Trusted Types (`require-trusted-types-for 'script'`) in Report-Only — revisit at Phase 4 entry
- Cloud Armor edge rate-limit on `csp-violations` — Phase 7 territory
- Per-IP rate limit at the function — defer unless soak shows abuse
- Firestore-backed CSP violations dashboard — Phase 9 if ever wanted
- HSTS preload submission to hstspreload.org — Phase 10 (HOST-06)
- Strict CSP enforcement / dropping style-src 'unsafe-inline' — Phase 10 (HOST-07)
- Custom Firebase Auth domain — Phase 6 consideration
- SRI for third-party scripts — moot post-Phase-1 (everything Vite-bundled now)
