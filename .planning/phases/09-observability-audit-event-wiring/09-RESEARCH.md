# Phase 9: Observability + Audit-Event Wiring — Research

**Researched:** 2026-05-10
**Domain:** Sentry browser + node SDK init, audit-event wiring across views, auth-anomaly Slack alerts, GCP uptime + budget monitoring, source-map upload via @sentry/vite-plugin
**Confidence:** HIGH for SDK shapes and command patterns (Sentry npm verified 2026-05-10, Slack incoming webhooks pattern verified, gcloud monitoring uptime + billing budgets verified). MEDIUM for Slack alert function topology (multiple valid patterns; chosen pattern justified). One ASSUMED row in the assumptions log (`unusual-hour` outlier detection threshold).

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

CONTEXT.md was auto-generated (`workflow.skip_discuss=true`). No locked decisions specific to this phase. The following constraints are inherited from project-wide locked decisions in `./CLAUDE.md` and accumulated decisions in `.planning/STATE.md`:

- **Stay on Firebase.** No platform migration to Vercel/Supabase.
- **Stay on vanilla JS.** No React/Vue/Svelte rewrite. JSDoc-as-typecheck only — `// @ts-check` + `tsc --noEmit --allowJs --checkJs --strict`.
- **No backwards-compatibility window.** Clean cutover migrations are acceptable (no live users currently).
- **Compliance bar = credible, not certified.** Honest mapping with citations, not auditor sign-off.
- **Sentry EU region required** (data residency / Pitfall 19 substrate-honest disclosure). Project hosted on `de.sentry.io`; sub-processor row added to `PRIVACY.md` (Phase 11 owns canonical, Phase 9 increments).
- **`beforeSend` PII scrubber must block:** chat bodies, comments, names, emails (Pitfall 18 / GDPR Art. 6 / Art. 32). Shared scrubber module across browser + node SDKs.
- **`auditWrite` actor identity must come from verified ID token server-side, never client payload** (Pitfall 11 / Pitfall 17 — already enforced by the Phase 7 `auditWrite` callable; Phase 9 must not regress it by passing a payload `actor` field).
- **Slack webhook URL stored via `defineSecret()`** (Phase 7 secret-management pattern; Pitfall 13).
- **Mirror Firestore-trigger writers from Phase 7** (`onOrgDelete`, `onUserDelete`, `onDocumentDelete`) feed audit events for soft-delete; lifecycle/GDPR callable Functions in Phase 8 also need audit-event wiring (AUDIT-05 — view-side and cloud-side complete coverage).
- **`@sentry/vite-plugin` source-map upload runs in CI on push to `main`** (Phase 1 CI extension; SENTRY_AUTH_TOKEN as a GitHub secret).
- **Pre-existing forward-tracking ledger row from Phase 8** (post-erasure-audit first run → operator follow-up) folds into Phase 9 OBS validation.

### Claude's Discretion

All implementation choices (wave shape, Slack alert function topology, anomaly detection thresholds beyond those in success criteria, fingerprint rate-limit dictionary, scrubber dictionary keys) are at Claude's discretion. The 6-wave default that prior Phases 7+8 used is the natural fit for this phase's scope and is recommended in the §Architecture Patterns section below.

### Deferred Ideas (OUT OF SCOPE)

- Sentry session replay (LogRocket-style record/playback) — privacy-burdening, see PITFALLS.md §18.
- Performance monitoring SDK (Real-User Monitoring) — explicitly skipped per `.planning/research/SUMMARY.md` to keep bundle size + DPIA surface minimal.
- Cloud Armor / per-IP rate limiting at Hosting tier — Phase 9 does not touch the perimeter; Phase 7 owns App Check.
- Self-hosted Sentry — alternative considered, deferred (free tier sufficient; EU region solves residency).
- Anomaly-detection ML / auto-tuning — fixed thresholds (5 fails / 5 min, etc.) per success criteria.
- BigQuery dashboard for audit-log analysis — `PLAT-V2-02` (v2 deferred per REQUIREMENTS.md).
- DLP / advanced PII scrubbing on free-form text bodies (Sentry has DLP add-on; not in free tier and not justified at this scale).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OBS-01 | `@sentry/browser` + `@sentry/node` initialised; `sendDefaultPii: false`; `beforeSend` PII scrubber blocks chat bodies, comments, names, emails | §Standard Stack; §Pattern 1 (Sentry browser init); §Pattern 2 (node init reuses Phase 7 substrate) |
| OBS-02 | Sentry project hosted in EU region (`*.de.sentry.io`); listed in `PRIVACY.md` as a sub-processor | §Pattern 1 (DSN encodes region); §Documentation Increment |
| OBS-03 | Sentry submission rate-limited at SDK level (max 10× same fingerprint per minute) | §Pattern 3 (fingerprint dedup) |
| OBS-04 | Source maps uploaded via `@sentry/vite-plugin` in CI (release-tagged, hidden source maps) | §Pattern 4 (vite-plugin config); §CI changes |
| OBS-05 | Cloud Function alert fires Slack webhook on auth anomalies (>5 fail/IP/5min, MFA disenrolment, role escalation, unusual-hour `gdprExportUser`) | §Pattern 6 (Slack alert Cloud Function); §Anomaly Detection Topology |
| OBS-06 | Uptime monitor checks `https://baselayers.bedeveloped.com` every 1min from ≥2 regions | §Pattern 7 (gcloud monitoring uptime create) |
| OBS-07 | Firebase budget alerts at 50% / 80% / 100% of monthly budget | §Pattern 8 (gcloud billing budgets create) |
| OBS-08 | Sentry quota alert at 70% of monthly free-tier (5k errors/month) | §Pattern 9 (Sentry quota alert) |
| AUDIT-05 | `auditWrite` calls wired through every view that does sensitive ops: sign-in, sign-out, role change, delete, export, MFA enrol, password change | §Pattern 5 (AUDIT-05 wiring map); §AUDIT-05 Wiring Inventory |
| DOC-10 (incremental) | `SECURITY.md` § Observability + § Audit-Event Wiring + § Phase 9 Audit Index appended | §Documentation Increment |
</phase_requirements>

---

## Summary

Phase 9 is the **operator-visibility phase** — every sensitive op emits a server-verified-actor audit event, every error surfaces to Sentry with PII scrubbed, every auth anomaly wakes an operator within minutes. The technical surface is mostly **wiring** rather than novel infrastructure: Phase 7 already shipped the `auditWrite` callable + 3 mirror triggers + the server-side Sentry helper (`functions/src/util/sentry.ts`); Phase 9 connects the dots and adds the Slack-alert Cloud Function plus three GCP-tier alarms (Sentry quota, Firebase budget, uptime).

There are four sub-stacks: **(A) Sentry init** (browser body fill + reuse + extend the existing node helper from Phase 7 with the same scrubber dictionary; both SDKs share a project but use separate DSNs per `.planning/research/PITFALLS.md` §18 anti-pattern "single Sentry project for client + Functions" — the SUMMARY recommends a single project but PITFALLS recommends separate; this contradiction is documented in §Open Questions and the recommendation is **shared project, separate environments** — see analysis there). **(B) AUDIT-05 view wiring** — 7 sensitive-op call sites identified across `src/firebase/auth.js`, `src/main.js` (during MFA enrol routing), `src/cloud/gdpr.js` callers, `src/cloud/soft-delete.js` callers, and `src/cloud/claims-admin.js`; pattern is `await writeAuditEvent({ type, target, payload })` in a try/finally so success/failure both emit. **(C) Slack alert topology** — a single new `functions/src/observability/authAnomalyAlert.ts` `onDocumentCreated('auditLog/{eventId}')` trigger that pattern-matches on event type + actor.role + at-hour and dispatches to a Slack webhook (Pattern 6); auth-failure-rate detection requires a small in-memory windowed counter or a Firestore `authFailureCounters/{ipHash}` rolling-window doc. **(D) GCP-tier monitors** — three idempotent operator scripts: uptime check (gcloud monitoring uptime create), budget alerts (gcloud billing budgets create), Sentry quota alert (Sentry-side dashboard config — operator action, not scriptable from gcloud).

The phase has **two structural risks** the planner must address: (1) **Audit-fan-out pitfall (PITFALLS.md §7 + §17)** — wiring AUDIT-05 from views means every sensitive op will emit *two* audit rows (the view-emitted one + the Phase 7 mirror trigger, when the underlying Firestore doc deletion fires `onOrgDelete`/`onUserDelete`/`onDocumentDelete`). The Phase 7 mirror writers already implement 60s primary-event dedup (Pattern 4b — see `functions/src/audit/triggers/onUserDelete.ts:60-67`); Phase 9 must verify the AUDIT-05 view-side write lands BEFORE the Firestore delete (so it counts as the "primary" and the trigger dedupes). (2) **Sentry init ordering (Phase 9 boot contract)** — Sentry browser init must run AFTER Firebase auth state is known (so `Sentry.setUser({ id: uid, role })` can include the verified UID without including PII like email) but BEFORE first sensitive action. The natural seam is `src/main.js` boot, immediately after `onAuthStateChanged` first fires and before any view renders.

**Primary recommendation:** Six waves, mirroring Phase 7+8 cadence — Wave 1 Sentry init substrate (browser body fill + scrubber module + node helper extension with the shared dictionary); Wave 2 source-map upload (vite.config.js + CI + release tagging); Wave 3 AUDIT-05 view wiring (the 7 sensitive-op call sites); Wave 4 Slack alert Cloud Function + auth-failure rolling counter substrate; Wave 5 GCP-tier monitors (uptime + budget + Sentry quota — operator scripts + 1 operator-execution checkpoint); Wave 6 cleanup + DOC-10 + SECURITY.md § Observability + § Phase 9 Audit Index + cleanup-ledger zero-out.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Browser-side error capture | Browser (Sentry browser SDK) | — | Errors originate in the browser; browser SDK has the source map context |
| Server-side error capture | Cloud Functions (Sentry node SDK) | — | Already implemented Phase 7 (`functions/src/util/sentry.ts`); Phase 9 extends with the shared scrubber dictionary |
| PII scrubbing | Both SDKs (`beforeSend` hook) | Shared scrubber module | One source of truth for which keys to redact; scrubber JS module imported from both `src/observability/sentry.js` (browser) and `functions/src/util/sentry.ts` (node) — see §Pattern 11 for the boundary |
| Audit-event emission (sensitive ops) | Browser → `src/cloud/audit.js` → `auditWrite` callable | Cloud Function mirror triggers (defence-in-depth) | View-side primary event is the actor-attributed source of truth; mirror triggers only fire if no primary event exists in 60s window (Phase 7 Pattern 4b) |
| Auth-anomaly detection | Cloud Function (`onDocumentCreated('auditLog/{eventId}')`) | — | The `auditLog` collection is the natural input stream; trigger pattern-matches on event type + payload |
| Auth-failure counter (5/IP/5min) | Cloud Function (Firestore rolling-window doc) | — | Stateless trigger cannot count alone; backed by `authFailureCounters/{ipHash}` doc — same pattern as Phase 7 `rateLimits/{uid}/buckets/{windowStart}` |
| Slack webhook dispatch | Cloud Function (HTTPS POST to webhook URL) | — | Webhook URL is a secret; cannot dispatch from browser without leaking the URL |
| Uptime monitoring | GCP Cloud Monitoring (uptime check + alerting policy) | — | Out-of-band check from external regions — must NOT depend on the app's own infrastructure |
| Source-map upload | CI (`@sentry/vite-plugin` build step) | — | Release-tagged + hidden source maps; auth token as GitHub secret (`SENTRY_AUTH_TOKEN`) |
| Sentry quota alert | Sentry dashboard (operator-configured, not scriptable) | — | Sentry's own quota alerting at 70% — set in the Sentry org settings UI |
| Firebase budget alert | GCP Cloud Billing (budget + threshold rules) | — | Set on the billing account, not the project; gcloud billing budgets create |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@sentry/browser` | 10.52.0 [VERIFIED: `npm view @sentry/browser dist-tags` 2026-05-10 → latest=10.52.0] | Browser-side error sink with `beforeSend` PII hook + EU DSN | Already pinned at `10.51.0` in `package.json`; bump to current latest. Free tier 5k events/month sufficient. |
| `@sentry/node` | 10.52.0 [VERIFIED: `npm view @sentry/node dist-tags` 2026-05-10] | Server-side error sink already wired in `functions/src/util/sentry.ts` Phase 7 | Already pinned at `10.52.0` in `functions/package.json`; no change. Phase 9 EXTENDS the existing helper with the shared scrubber dictionary. |
| `@sentry/vite-plugin` | 5.2.1 [VERIFIED: `npm view @sentry/vite-plugin dist-tags` 2026-05-10 → latest=5.2.1] | Source-map upload + release-tag emission at build time | The official Sentry-maintained plugin; mature (5.x). Reads `SENTRY_AUTH_TOKEN` from env or `.env.sentry-build-plugin` file. |
| `firebase-functions` | 7.2.5 [VERIFIED: `functions/package.json`] | `onDocumentCreated` v2 trigger for the Slack-alert function | Already in functions/; v2 exclusive per FN-01 |
| `firebase-admin` | 13.9.0 [VERIFIED: `functions/package.json`] | Admin SDK for the auth-failure rolling-window counter (Firestore writes from triggers) | Already in functions/ |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fetch` (built-in) | Node 22 built-in [VERIFIED: Node 22 docs] | HTTPS POST to Slack webhook URL | Slack incoming-webhook pattern is a single POST with `application/json` body — no client library needed |
| `node:crypto` (built-in) | Node 22 built-in | sha256 hash for `ipHash` in `authFailureCounters/{ipHash}` (avoids storing raw IP in Firestore — privacy) | The `actor.ip` from auditLog already serves as the input; hash for keying |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sentry browser + node | Highlight.io / Bugsnag / GCP Error Reporting | Sentry brand recognition + EU region + free-tier sufficient — see SUMMARY §Observability |
| Slack incoming-webhook | PagerDuty / Opsgenie / email-only | Slack is BeDeveloped's existing operator channel; webhook is the cheapest credible "wake an operator" path; PagerDuty/Opsgenie defer to v2 when staffing supports a 24/7 oncall |
| `@sentry/vite-plugin` 5.x | `vite-plugin-sentry` (community) | The official `@sentry/vite-plugin` is Sentry-maintained, simpler config, supports the `release.create`/`release.finalize` lifecycle and hidden source maps natively |
| `onDocumentCreated('auditLog/{eventId}')` trigger | Scheduled function reading auditLog every 5 min | Trigger is real-time + cheaper at this volume; scheduled would batch and add latency |
| Firestore rolling-window counter for auth-fail-rate | In-memory counter in Cloud Function | In-memory does not survive cold starts and does not aggregate across instances; Firestore-backed is the only correct path for distributed Cloud Functions |

**Installation (Phase 9):**

```bash
# Root workspace — bump @sentry/browser, add @sentry/vite-plugin
npm install @sentry/browser@10.52.0
npm install -D @sentry/vite-plugin@5.2.1

# functions/ workspace — already has @sentry/node@10.52.0; no install needed
```

**Version verification:** Verified against npm registry on 2026-05-10:
- `@sentry/browser`: latest `10.52.0` (training cutoff knew `10.51.0`; bump is trivial — same major)
- `@sentry/node`: latest `10.52.0` (already pinned in functions/)
- `@sentry/vite-plugin`: latest `5.2.1` (no training-data version; verified live)

---

## Architecture Patterns

### System Architecture Diagram

```
                                BROWSER
   ┌──────────────────────────────────────────────────────────────┐
   │  src/main.js boot                                            │
   │     │                                                         │
   │     ├─ initSentryBrowser()        ← Wave 1 (OBS-01/02/03)    │
   │     │     beforeSend(scrubPii)                                │
   │     │     EU DSN: https://...@o<id>.ingest.de.sentry.io/...  │
   │     │                                                         │
   │     └─ onAuthStateChanged                                     │
   │           ├─ Sentry.setUser({id: uid, role})                 │
   │           └─ AUDIT-05 wiring sites:                          │
   │                                                               │
   │   ┌─────────────────────────────────────────────────────┐   │
   │   │ AUDIT-05 emit sites (Wave 3):                        │   │
   │   │   src/firebase/auth.js → signInEmailPassword         │   │
   │   │   src/firebase/auth.js → signOut                     │   │
   │   │   src/firebase/auth.js → updatePassword              │   │
   │   │   src/main.js          → enrollTotp / unenrollAll   │   │
   │   │   src/cloud/claims-admin.js → setClaims (role chg)  │   │
   │   │   src/cloud/gdpr.js    → exportUser / eraseUser     │   │
   │   │   src/cloud/soft-delete.js → softDelete / restore   │   │
   │   └─────────────────────┬───────────────────────────────┘   │
   │                         │ writeAuditEvent({type,target,...}) │
   └─────────────────────────┼───────────────────────────────────┘
                             │ App Check + ID token
                             ▼
   ┌──────────────────────────────────────────────────────────────┐
   │     CLOUD FUNCTIONS (Gen2, europe-west2)                     │
   │                                                              │
   │  auditWrite (Phase 7, unchanged)                            │
   │     ├─ withSentry → util/sentry.ts (Wave 1 scrubber extend) │
   │     └─ writeAuditEvent → Firestore auditLog/{eventId}       │
   │                                                              │
   │  ┌─────────────── auditLog/{eventId} (Firestore) ─────────┐ │
   │  │                                                          │ │
   │  └─────────────────┬────────────────────────┬──────────────┘ │
   │                    │                        │                 │
   │  onDocumentCreated('auditLog/{eventId}')   │                 │
   │  authAnomalyAlert (Wave 4)                 │                 │
   │     pattern-match on:                      │                 │
   │       type=auth.signin.failure → counter+1 │                 │
   │       type=auth.mfa.unenrol    → alert     │                 │
   │       type=iam.claims.set      → check role-escalation      │
   │       type=compliance.export.user → check at-hour outlier   │
   │     │                                       │                 │
   │     ▼                                       ▼                 │
   │  authFailureCounters/{ipHash}      Slack webhook POST        │
   │     {at: rolling 5min, count: N}    (defineSecret SLACK_WH)  │
   │     │                                                          │
   │     count>5 → emit alert                                       │
   └──────────────────────────────────────────────────────────────┘
                                                  ▲
   ┌──────────────────────────────────────────────┘
   │     OUT-OF-BAND MONITORS (Wave 5)
   │
   │   Cloud Monitoring uptime check
   │     URL: https://baselayers.bedeveloped.com
   │     period: 60s
   │     regions: USA + EUROPE
   │     alerting policy → Slack webhook (same secret)
   │
   │   GCP Cloud Billing budget
   │     thresholds: 50% / 80% / 100%
   │     notification: email + Slack via Pub/Sub
   │
   │   Sentry quota alert (Sentry-side dashboard)
   │     threshold: 70% of monthly free-tier (5000 events × 0.7 = 3500)
   │     channel: Sentry email
   │
   │   ┌─ CI source-map upload (Wave 2)
   │   │   vite.config.js + @sentry/vite-plugin
   │   │   .github/workflows/ci.yml deploy job
   │   │   release.name = github.sha; release.create=true; finalize=true
   │   │   hidden source maps (no sourceMappingURL in served bundle)
   │   └─ SENTRY_AUTH_TOKEN as GitHub secret
   └──────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure (Phase 9 additions)

```
src/observability/                    ← Phase 4 stubs; Wave 1 fills bodies
├── sentry.js                         # body-fill: init + captureError + addBreadcrumb + setUser
├── audit-events.js                   # body-fill: AUDIT_EVENTS constants table + emit helper proxy
└── pii-scrubber.js                   ← NEW Wave 1: shared scrubber dictionary (browser-safe;
                                       imported by both src/observability/sentry.js and
                                       functions/src/util/pii-scrubber.ts which mirrors keys)

functions/src/observability/          ← NEW Wave 4
└── authAnomalyAlert.ts               # onDocumentCreated('auditLog/{eventId}') Slack dispatcher

functions/src/util/
├── sentry.ts                         ← Wave 1 EXTEND: import scrubber dictionary
└── pii-scrubber.ts                   ← NEW Wave 1: TS twin of src/observability/pii-scrubber.js
                                       (cannot import .js across the JS/TS boundary cleanly without
                                       a shared package; document the dictionary as the contract
                                       and unit-test that the two files agree)

scripts/setup-uptime-check/           ← NEW Wave 5
└── run.js                            # idempotent gcloud monitoring uptime create

scripts/setup-budget-alerts/          ← NEW Wave 5
└── run.js                            # idempotent gcloud billing budgets create

runbooks/
├── phase-9-cleanup-ledger.md         ← NEW Wave 6 (zero-out gate)
└── phase-9-sentry-bootstrap.md       ← NEW Wave 1: operator runbook
                                       (Sentry org create + EU project + DSN copy + quota alert)
```

### Pattern 1: Sentry Browser Init (OBS-01 / OBS-02 / OBS-03)

**What:** Initialise `@sentry/browser` in `src/main.js` boot, AFTER `onAuthStateChanged` first fires (so `setUser` has the verified UID), BEFORE any view renders.
**When to use:** Wave 1 — replaces the `src/observability/sentry.js` empty-stub body.

```javascript
// Source: [VERIFIED: docs.sentry.io/platforms/javascript/configuration/options/]
// + [VERIFIED: project src/observability/sentry.js Phase 4 stub contract]
// File: src/observability/sentry.js (body fill)
// @ts-check
import * as Sentry from "@sentry/browser";
import { scrubPii } from "./pii-scrubber.js";

let inited = false;

/** @param {string} dsn @param {string} release */
export function initSentryBrowser(dsn, release) {
  if (inited) return;
  if (!dsn) {
    // No DSN configured — local dev / unit-test / preview-channel path.
    inited = true;
    return;
  }
  Sentry.init({
    dsn,                            // e.g. https://<key>@o<id>.ingest.de.sentry.io/<project>
    release,                        // GitHub SHA; aligns with @sentry/vite-plugin release-tag
    environment: import.meta.env.MODE, // "production" / "development" / preview-channel
    sendDefaultPii: false,          // Pitfall 18 explicit
    tracesSampleRate: 0,            // No tracing in v1; revisit if perf monitoring is wanted v2
    integrations: [
      Sentry.breadcrumbsIntegration({ console: false }),
      Sentry.globalHandlersIntegration(),
      Sentry.linkedErrorsIntegration(),
    ],
    beforeSend: scrubPii,
    beforeBreadcrumb: (breadcrumb) => scrubPii({ breadcrumb })?.breadcrumb ?? null,
  });
  inited = true;
}

/** @param {Error} err @param {*} [context] */
export function captureError(err, context) {
  if (context) Sentry.withScope((scope) => { scope.setExtras(context); Sentry.captureException(err); });
  else Sentry.captureException(err);
}

/** @param {{ category: string, message: string, data?: any }} crumb */
export function addBreadcrumb(crumb) { Sentry.addBreadcrumb(crumb); }

/** @param {{ id: string, role?: string }} user */
export function setUser(user) { Sentry.setUser({ id: user.id, role: user.role }); }
```

**Critical: EU residency** — the DSN itself encodes the region. A DSN in the form `https://<publickey>@o<orgId>.ingest.de.sentry.io/<projectId>` routes events to the EU (Frankfurt) data centre. There is NO `region` config option — the DSN is the contract. [VERIFIED: docs.sentry.io DSN explainer + 2026-05-10 search]. The operator runbook (Wave 1 — `runbooks/phase-9-sentry-bootstrap.md`) documents the project create flow with EU region selected at create time.

**Boot wiring in `src/main.js`** — Sentry init lands inside `onAuthStateChanged`'s first callback to ensure the verified UID is available. The DSN comes from a `VITE_SENTRY_DSN` env var (mirroring the existing `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY` pattern); release tag is `import.meta.env.VITE_GIT_SHA` populated by CI from `github.sha`.

### Pattern 2: Sentry Node Init Extension (OBS-01 — server side)

**What:** Phase 7 already shipped `functions/src/util/sentry.ts` with a `beforeSend` that strips auth/cookie headers + email/name/ip from `event.extra`. Phase 9 EXTENDS the same `beforeSend` to also strip the **chat-body / comment-body / name / email** fields that the success criteria require — consolidating the dictionary across browser + node SDKs.

```typescript
// Wave 1 EXTEND — functions/src/util/sentry.ts
// Source: [CITED: existing functions/src/util/sentry.ts Phase 7 substrate]
// + [NEW: import scrub keys from sibling pii-scrubber.ts]
import * as Sentry from "@sentry/node";
import { logger } from "firebase-functions/logger";
import { PII_KEYS } from "./pii-scrubber.js";

let inited = false;
export function _resetForTest() { inited = false; }

function init(dsn: string): void {
  if (inited) return;
  if (!dsn) { inited = true; return; }
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      // Strip headers (Phase 7 substrate — keep)
      if (event.request?.headers) {
        const h = event.request.headers as Record<string, unknown>;
        for (const k of ["authorization","Authorization","cookie","Cookie"]) delete h[k];
      }
      // Strip extras + contexts via dictionary (Phase 9 extend)
      for (const bag of [event.extra, ...(Object.values(event.contexts ?? {}) as Record<string, unknown>[])]) {
        if (bag && typeof bag === "object") {
          for (const k of PII_KEYS) {
            if (k in bag) (bag as Record<string, unknown>)[k] = "<redacted>";
          }
        }
      }
      // Strip free-form bodies/messages (chat/comments) by length-clip + key-match
      if (event.request && typeof event.request === "object") {
        const req = event.request as Record<string, unknown>;
        for (const k of ["data", "body"]) {
          if (typeof req[k] === "string") req[k] = "<redacted-body>";
        }
      }
      return event;
    },
  });
  inited = true;
}

export function withSentry<TIn, TOut>(handler: (req: TIn) => Promise<TOut>) {
  return async (req: TIn) => {
    init(process.env.SENTRY_DSN ?? "");
    try { return await handler(req); }
    catch (err) {
      Sentry.captureException(err);
      logger.error("handler.error", { name: (err as Error)?.name ?? "Error" });
      throw err;
    }
  };
}
```

The shared scrubber dictionary — `PII_KEYS = ["email", "name", "ip", "phone", "address", "body", "message", "chatBody", "commentBody", "displayName"]` — lives in `functions/src/util/pii-scrubber.ts` (TS) and the byte-equivalent dictionary lives in `src/observability/pii-scrubber.js` (JS). A unit test in `functions/test/util/pii-scrubber-parity.test.ts` asserts the two arrays are equal so drift is caught at PR time.

### Pattern 3: SDK-Level Fingerprint Rate-Limit (OBS-03)

**What:** Sentry's free tier is 5k events/month. A regression that throws on every render burns the quota in hours. The fix: **dedup by fingerprint at the SDK boundary** — if the same fingerprint fires >10× per minute, drop the event before it leaves the browser.

```javascript
// Source: [VERIFIED: PITFALLS.md §18 #5 "Free-tier limits"] + [CITED: Sentry beforeSend hook docs]
// Embedded inside src/observability/sentry.js beforeSend wrapper.

const fingerprintCounts = new Map(); // fingerprint -> { count, windowStart }
const WINDOW_MS = 60_000;
const LIMIT = 10;

/** @param {*} event */
function fingerprintRateLimit(event) {
  const fp = (event.fingerprint?.[0] ?? event.message ?? event.exception?.values?.[0]?.value ?? "unknown");
  const now = Date.now();
  const entry = fingerprintCounts.get(fp);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    fingerprintCounts.set(fp, { count: 1, windowStart: now });
    return event;
  }
  entry.count += 1;
  if (entry.count > LIMIT) return null; // drop
  return event;
}
```

This wraps the `scrubPii` `beforeSend`. Returning `null` from `beforeSend` suppresses the event. [VERIFIED: docs.sentry.io/platforms/javascript/configuration/filtering/]

### Pattern 4: Source-Map Upload via @sentry/vite-plugin (OBS-04)

**What:** Build-time plugin uploads source maps to Sentry, tags them with the release SHA, and (with `sourcemaps.filesToDeleteAfterUpload`) deletes the .map files from `dist/` so they are NEVER served from Hosting.

```javascript
// Source: [VERIFIED: npmjs.com/package/@sentry/vite-plugin 2026-05-10]
// + [VERIFIED: project vite.config.js Phase 4 + Phase 7 lock]
// File: vite.config.js (Wave 2 EXTEND)
import { defineConfig, loadEnv } from "vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Phase 7 FN-07 guard kept verbatim …
  return {
    build: {
      target: "es2020",
      sourcemap: true,                      // produces .map files for upload
      rollupOptions: { /* … existing manualChunks unchanged … */ },
    },
    plugins: [
      // Only emit when SENTRY_AUTH_TOKEN is present — no-op for PR/preview builds.
      env.SENTRY_AUTH_TOKEN && command === "build" && sentryVitePlugin({
        org: "bedeveloped",                 // Sentry org slug — operator-set Wave 1
        project: "base-layers-diagnostic",  // Sentry project slug
        url: "https://de.sentry.io/",       // EU region — VERIFIED 2026-05-10
        authToken: env.SENTRY_AUTH_TOKEN,
        release: { name: env.GITHUB_SHA ?? "local", create: true, finalize: true },
        sourcemaps: {
          assets: ["dist/**/*.js", "dist/**/*.map"],
          filesToDeleteAfterUpload: ["dist/**/*.map"],   // hide source maps from prod (OBS-04)
        },
        telemetry: false,                   // no plugin-side telemetry to Sentry
      }),
    ].filter(Boolean),
    // … rest of config unchanged …
  };
});
```

**CI extension** (`.github/workflows/ci.yml` deploy job — Wave 2):

```yaml
- name: Build (with reCAPTCHA + Sentry source-map upload)
  env:
    VITE_RECAPTCHA_ENTERPRISE_SITE_KEY: ${{ secrets.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY || 'ci-build-verification-placeholder' }}
    VITE_SENTRY_DSN: ${{ secrets.VITE_SENTRY_DSN }}
    VITE_GIT_SHA: ${{ github.sha }}
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
    GITHUB_SHA: ${{ github.sha }}
  run: npm run build
```

Three new GitHub Actions secrets — `SENTRY_AUTH_TOKEN`, `VITE_SENTRY_DSN`, and a Slack webhook secret — are operator-set in Wave 5/6.

**Hidden source maps:** `filesToDeleteAfterUpload: ["dist/**/*.map"]` ensures the .map files are deleted from `dist/` after upload to Sentry. Firebase Hosting serves only the bundles; stack traces resolve in the Sentry UI from the uploaded maps. This satisfies the OBS-04 success criterion "stack traces in Sentry resolve to the original source" without exposing maps publicly.

### Pattern 5: AUDIT-05 View Wiring — try/finally pattern

**What:** Every sensitive op wraps the underlying call in a `try/finally` that emits an `auditWrite` event whether the op succeeded or failed. Pitfall 17 dictates that the actor identity is server-determined; the view passes only `type`, `target`, `payload` (and the wrapper in `src/cloud/audit.js` adds `clientReqId`).

```javascript
// Source: [CITED: src/cloud/audit.js Phase 7 Wave 6 body — already wraps writeAuditEvent]
// Pattern applied to src/firebase/auth.js#signInEmailPassword:

import { writeAuditEvent } from "../cloud/audit.js";

export async function signInEmailPassword(email, password) {
  let outcome = "failure";
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    outcome = "success";
    return result;
  } catch (err) {
    if (AUTH_CRED_ERROR_CODES.has(err?.code ?? "")) throw new SignInError();
    throw err;
  } finally {
    // Best-effort emission — never block the auth flow on audit failure.
    try {
      await writeAuditEvent({
        type: outcome === "success" ? "auth.signin.success" : "auth.signin.failure",
        target: { type: "user", id: auth.currentUser?.uid ?? "unknown", orgId: null },
        payload: {},   // NO email, password, or other PII — actor.email comes from server-side ID-token
      });
    } catch (auditErr) { /* swallow + log to Sentry once Sentry is live */ }
  }
}
```

**KEY DESIGN POINTS for the planner:**

1. **Failure events use the `auth.signin.failure` type but emit *anyway*.** This is the input the Wave 4 `authAnomalyAlert` trigger needs to count toward the >5/IP/5min rule.
2. **The view-side write is "best effort."** A failure to emit the audit event MUST NEVER block the auth/data op. Wrap in `try/catch`; future Sentry will catch.
3. **Pre-action vs post-action emission.** Sign-out emits BEFORE the `signOut()` call (because after sign-out the App Check token is gone and `auditWrite` will reject). Sign-in emits AFTER (because before, there's no actor). MFA enrol emits AFTER. Password change emits AFTER. The wave plan must specify ordering per call site.
4. **Mirror-trigger collision (Pitfall 7).** Phase 7 mirror triggers (`onOrgDelete`/`onUserDelete`/`onDocumentDelete`) fire 60s after the underlying Firestore deletion if no primary `auditLog` doc exists for the target. Wave 3 must verify the AUDIT-05 emission for `data.org.softDelete` / `data.user.delete` etc. lands BEFORE the corresponding Firestore mutation — otherwise mirror triggers fire too. The Phase 8 `gdprEraseUser` callable already emits `compliance.erase.user` from the server side; Phase 9's view-side AUDIT-05 for the *call site* of `eraseUser` will produce a duplicate. **Recommendation:** for callables that emit their own audit event server-side (gdprEraseUser, gdprExportUser, softDelete, restoreSoftDeleted, setClaims), the view-side AUDIT-05 emits a DIFFERENT type (`compliance.export.user.requested` vs server-side `compliance.export.user`), making both useful (latency analysis: gap between client request and server execution).

### AUDIT-05 Wiring Inventory

The seven sensitive-op categories in OBS-05 / AUDIT-05 map to nine concrete call sites:

| Sensitive Op | File | Function | Audit Type | Pre/Post | Notes |
|--------------|------|----------|-----------|----------|-------|
| sign-in | `src/firebase/auth.js` | `signInEmailPassword` | `auth.signin.success` / `auth.signin.failure` | POST | Emit both outcomes; failure feeds anomaly counter |
| sign-out | `src/firebase/auth.js` | `signOut` | `auth.signout` | PRE | App Check token gone after signOut; emit first |
| password change | `src/firebase/auth.js` | `updatePassword` | `auth.password.change` | POST | Already calls `setClaims` for firstRun flip |
| password reset request | `src/firebase/auth.js` | `sendPasswordResetEmail` | `auth.password.reset` | POST | Emit even on swallowed errors (D-15 generic-success surface) |
| MFA enrol | `src/main.js` (or new `src/auth/mfa.js` if extracted) | `enrollTotp` | `auth.mfa.enrol` | POST | Wired in Wave 3; D-23 from Phase 6 partial-state |
| MFA un-enrol | `src/main.js` (or `src/auth/mfa.js`) | `unenrollAllMfa` | `auth.mfa.unenrol` | POST | Wave 4 anomaly trigger fires on this type |
| email-link Tier-1 recovery | `src/firebase/auth.js` | `signInWithEmailLink` | `auth.signin.success` (with `payload.method: "emailLink"`) | POST | Same type, but payload distinguishes |
| role/claims change | `src/cloud/claims-admin.js` | `setClaims` (client wrapper) | `iam.claims.set` (CLIENT request flavour) | POST | Server-side `setClaims` callable already emits `iam.claims.set`; client wrapper emits `iam.claims.set.requested` to differentiate (see Pattern 5 #4) |
| GDPR export | `src/cloud/gdpr.js` | `exportUser` | `compliance.export.user.requested` | POST | Server emits `compliance.export.user`; pair makes latency observable |
| GDPR erase | `src/cloud/gdpr.js` | `eraseUser` | `compliance.erase.user.requested` | POST | Same dual-emit pattern |
| soft-delete | `src/cloud/soft-delete.js` | `softDelete` | `data.<type>.softDelete.requested` | POST | Server emits `data.<type>.softDelete` from softDelete CF |
| restore | `src/cloud/soft-delete.js` | `restoreSoftDeleted` | `data.<type>.restore.requested` | POST | Same |
| permanently delete | `src/cloud/soft-delete.js` | `permanentlyDeleteSoftDeleted` | `data.<type>.permanentlyDelete.requested` | POST | Same |

The `auditEventInput` Zod schema in `functions/src/audit/auditEventSchema.ts` lists the canonical 25-entry enum. Wave 3 must extend the enum with the `.requested` variants (or use a single `.requested` suffix convention server-side and accept it via a regex-based schema). Recommendation: extend the enum literally — explicit > clever.

### Pattern 6: Slack Alert Cloud Function (OBS-05)

**What:** A single `onDocumentCreated('auditLog/{eventId}')` trigger evaluates the new audit row against four rules and dispatches a Slack message via incoming webhook on match.

```typescript
// Source: [VERIFIED: docs.slack.dev/messaging/sending-messages-using-incoming-webhooks 2026-05-10]
// + [VERIFIED: firebase-functions v2/firestore.onDocumentCreated docs]
// File: functions/src/observability/authAnomalyAlert.ts (Wave 4)

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import { logger } from "firebase-functions/logger";
import { withSentry } from "../util/sentry.js";
import { createHash } from "node:crypto";

if (!getApps().length) initializeApp();

const SLACK_WEBHOOK_URL = defineSecret("SLACK_WEBHOOK_URL");
const SENTRY_DSN = defineSecret("SENTRY_DSN");

const FAIL_WINDOW_MS = 5 * 60_000;
const FAIL_LIMIT = 5;
const UNUSUAL_HOURS = [0, 1, 2, 3, 4, 5, 22, 23]; // UTC: 22:00–05:00

export const authAnomalyAlert = onDocumentCreated(
  {
    document: "auditLog/{eventId}",
    region: "europe-west2",
    serviceAccount: "audit-alert-sa",   // NEW SA — Wave 5 provisioning
    secrets: [SLACK_WEBHOOK_URL, SENTRY_DSN],
    memory: "256MiB",
    timeoutSeconds: 30,
    retryConfig: { retryCount: 1 },     // best-effort alerting
  },
  withSentry(async (event) => {
    const audit = event.data?.data() as Record<string, unknown> | undefined;
    if (!audit) return;
    const type = audit.type as string;
    const actor = audit.actor as { uid?: string; role?: string; email?: string } | undefined;
    const ip = (audit.ip as string) ?? null;
    const at = audit.at as Timestamp | undefined;
    const hourUtc = at ? new Date(at.toMillis()).getUTCHours() : -1;

    // Rule 1: failed-sign-in burst (>5/IP/5min)
    if (type === "auth.signin.failure" && ip) {
      const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 16);
      const now = Date.now();
      const ref = getFirestore().doc(`authFailureCounters/${ipHash}`);
      const next = await getFirestore().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const cur = snap.exists ? snap.data() as { count: number; windowStart: number } : { count: 0, windowStart: now };
        if (now - cur.windowStart > FAIL_WINDOW_MS) {
          tx.set(ref, { count: 1, windowStart: now });
          return 1;
        }
        tx.update(ref, { count: FieldValue.increment(1) });
        return cur.count + 1;
      });
      if (next === FAIL_LIMIT + 1) {  // fire EXACTLY ONCE per window (not on every event past threshold)
        await postToSlack({ text: `:warning: Auth-fail burst: >${FAIL_LIMIT} failed sign-ins in ${FAIL_WINDOW_MS/60000}min from ipHash=${ipHash}` });
      }
    }

    // Rule 2: MFA disenrolment
    if (type === "auth.mfa.unenrol") {
      await postToSlack({ text: `:rotating_light: MFA disenrolment for actor=${actor?.email ?? actor?.uid ?? "unknown"} role=${actor?.role ?? "?"}` });
    }

    // Rule 3: role escalation (claims set elevating a user to admin)
    if (type === "iam.claims.set") {
      const payload = audit.payload as { newRole?: string; previousRole?: string } | undefined;
      if (payload?.newRole === "admin" && payload?.previousRole !== "admin") {
        await postToSlack({ text: `:rotating_light: Role escalation: ${actor?.email ?? actor?.uid} elevated to admin (was ${payload?.previousRole ?? "none"})` });
      }
    }

    // Rule 4: unusual-hour gdprExportUser
    if (type === "compliance.export.user" && UNUSUAL_HOURS.includes(hourUtc)) {
      await postToSlack({ text: `:warning: Unusual-hour GDPR export: actor=${actor?.email ?? actor?.uid} hour=${hourUtc}Z` });
    }
  }),
);

async function postToSlack(payload: { text: string }): Promise<void> {
  const url = SLACK_WEBHOOK_URL.value();
  if (!url) { logger.warn("slack.skip.no-webhook"); return; }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) logger.warn("slack.post.failed", { status: res.status });
  } catch (err) {
    logger.warn("slack.post.error", { name: (err as Error)?.name });
  }
}
```

**Slack incoming webhook minimal payload** [VERIFIED: docs.slack.dev]:

```bash
curl -X POST -H 'Content-Type: application/json' \
  --data '{"text":"Hello, world."}' \
  https://hooks.slack.com/services/T.../B.../...
```

Slack webhook rate limit is 1 message per second per webhook on average, with bursts allowed [CITED: docs.slack.dev/apis/web-api/rate-limits — Tier 1]. For the four anomaly types at expected volume (low single digits per day post-bootstrap), this is comfortably under.

**Synthetic test alert** (Wave 4 verification — required by OBS-05 success criterion "an operator receives a synthetic test alert end-to-end"): a small one-shot script `scripts/test-slack-alert/run.js` POSTs a `:white_check_mark: Phase 9 OBS-05 synthetic test alert` to the configured webhook. Operator confirms reception in Slack as part of Wave 5 close-gate.

### Pattern 7: GCP Cloud Monitoring Uptime Check (OBS-06)

**What:** A multi-region uptime check on `https://baselayers.bedeveloped.com` every 60 seconds, with an alerting policy that posts to the same Slack webhook.

```bash
# Source: [VERIFIED: cloud.google.com/sdk/gcloud/reference/monitoring/uptime/create 2026-05-10]
# File: scripts/setup-uptime-check/run.js (idempotent script — Pattern E from Phase 7)

gcloud monitoring uptime create base-layers-diagnostic-prod \
  --resource-type=uptime-url \
  --resource-labels=host=baselayers.bedeveloped.com,project_id=bedeveloped-base-layers \
  --protocol=https \
  --request-method=get \
  --path=/ \
  --period=60s \
  --timeout=10s \
  --regions=USA,EUROPE \
  --project=bedeveloped-base-layers
```

**Alerting policy** (Wave 5 second step — operator-runbook):

```bash
# Notification channel — Slack webhook backed by a Pub/Sub topic
gcloud alpha monitoring channels create \
  --display-name="ops-alerts-slack" \
  --type=webhook_tokenauth \
  --channel-labels=url=https://hooks.slack.com/services/T.../B.../...

# Alerting policy — fire when uptime check fails ≥1 region for ≥2 minutes
gcloud alpha monitoring policies create \
  --display-name="base-layers-prod-down" \
  --conditions=...   # uses MQL or YAML; see runbook
  --notification-channels=projects/bedeveloped-base-layers/notificationChannels/<id>
```

**Constraint:** Cloud Monitoring requires `--regions` to include AT LEAST 3 locations [VERIFIED: 2026-05-10 docs] when specified. The success criterion says ≥2 regions; the gcloud minimum is 3. **Resolution:** specify `USA,EUROPE,ASIA_PACIFIC` for compliance with the gcloud constraint while exceeding the success criterion.

### Pattern 8: GCP Cloud Billing Budget Alerts (OBS-07)

**What:** A monthly budget on the billing account with notification thresholds at 50% / 80% / 100%.

```bash
# Source: [VERIFIED: docs.cloud.google.com/billing/docs/how-to/budgets 2026-05-10]
# File: scripts/setup-budget-alerts/run.js (idempotent)

# 1. Get the billing account ID
BILLING_ACCOUNT=$(gcloud billing projects describe bedeveloped-base-layers \
  --format="value(billingAccountName)" | sed 's|billingAccounts/||')

# 2. Create the budget
gcloud billing budgets create \
  --billing-account="$BILLING_ACCOUNT" \
  --display-name="base-layers-monthly" \
  --budget-amount=100GBP \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.8 \
  --threshold-rule=percent=1.0 \
  --filter-projects=projects/bedeveloped-base-layers \
  --notifications-rule-monitoring-notification-channels=projects/bedeveloped-base-layers/notificationChannels/<id>
```

**Critical: budget alerts do NOT cap spend.** [VERIFIED: docs.cloud.google.com 2026-05-10] — they only notify. The Firebase docs explicitly call out that "budget alert emails might prompt you to take action … but they don't automatically prevent the use or billing of your services." For automatic cutoff, a Pub/Sub-driven Cloud Function that disables the project on threshold-100% is required (see [Avoid surprise bills](https://firebase.google.com/docs/projects/billing/avoid-surprise-bills)). **OUT OF SCOPE for Phase 9** — Phase 9 alerts only; auto-disable belongs to a v2 deferral. Document this honestly in `SECURITY.md` per Pitfall 19.

### Pattern 9: Sentry Quota Alert (OBS-08)

**What:** Sentry-side dashboard alert at 70% of monthly free-tier (3500 of 5000 events/month).

This is **NOT scriptable from gcloud or any IaC tool**. It is an operator action in the Sentry web UI:

1. Sentry → Settings → Subscription → Quota Alerts
2. Set "Notify when monthly events ≥ 70%"
3. Channel: Sentry email (operator's address)

Wave 1 operator runbook (`runbooks/phase-9-sentry-bootstrap.md`) documents this step. Wave 5 close-gate verifies the alert is configured (operator screenshot evidence per `docs/evidence/` — Phase 11).

### Pattern 10: Auth-Failure Rolling Counter (Wave 4 substrate)

**What:** A `authFailureCounters/{ipHash}` Firestore collection holds a rolling 5-minute window per IP-hash. Same shape as Phase 7 `rateLimits/{uid}/buckets/{windowStart}`.

```
authFailureCounters/{ipHash} = {
  count: number,         // failures in current window
  windowStart: number,   // unix-millis at window start
  lastSeenAt: serverTimestamp(),
}
```

**Rules** (Wave 4 firestore.rules edit):

```
match /authFailureCounters/{ipHash} {
  allow read: if false;            // server-only — Pattern from Phase 7 auditLog
  allow write: if false;           // Admin SDK only via authAnomalyAlert trigger
}
```

Tests for the rules block are 4 cells (read-deny client / read-deny internal-role / write-deny client / write-deny internal-role) following the Phase 7 `tests/rules/auditLog.test.js` cells 1–4 pattern.

### Pattern 11: Shared PII Scrubber (Wave 1 substrate)

**What:** A dictionary of PII keys lives in two byte-equivalent files (one JS, one TS), with a parity test guarding drift.

```javascript
// src/observability/pii-scrubber.js
// @ts-check
/** @type {readonly string[]} */
export const PII_KEYS = Object.freeze([
  "email", "name", "displayName", "ip", "phone", "address",
  "body", "message", "chatBody", "commentBody",
]);

/** @param {*} event @returns {*|null} */
export function scrubPii(event) {
  if (!event || typeof event !== "object") return event;
  // Strip extras + contexts
  for (const bag of [event.extra, ...(Object.values(event.contexts ?? {}))]) {
    if (bag && typeof bag === "object") {
      for (const k of PII_KEYS) if (k in bag) bag[k] = "<redacted>";
    }
  }
  // Strip free-form bodies on requests
  if (event.request && typeof event.request === "object") {
    for (const k of ["data", "body"]) {
      if (typeof event.request[k] === "string") event.request[k] = "<redacted-body>";
    }
  }
  return event;
}
```

```typescript
// functions/src/util/pii-scrubber.ts (byte-equivalent dictionary)
export const PII_KEYS = [
  "email", "name", "displayName", "ip", "phone", "address",
  "body", "message", "chatBody", "commentBody",
] as const;
```

**Parity test** (`functions/test/util/pii-scrubber-parity.test.ts`):

```typescript
import { PII_KEYS as NODE_KEYS } from "../../src/util/pii-scrubber.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

it("PII_KEYS dictionary matches between browser + node", () => {
  // Read the browser sibling and parse the array literal — string-equality is the simplest contract.
  const browserSrc = readFileSync(
    fileURLToPath(new URL("../../../src/observability/pii-scrubber.js", import.meta.url)), "utf-8");
  const match = browserSrc.match(/PII_KEYS\s*=\s*Object\.freeze\(\[([^\]]+)\]/);
  const browserKeys = (match?.[1] ?? "").match(/"[^"]+"/g)?.map(s => s.slice(1, -1)) ?? [];
  expect(browserKeys.sort()).toEqual([...NODE_KEYS].sort());
});
```

This is intentionally simple — string-extraction over the JS source — and tolerates whitespace/newline drift.

### Anti-Patterns to Avoid

- **Don't init Sentry before `onAuthStateChanged` first fires.** The `setUser` call needs the verified UID; otherwise events are anonymous and operators can't correlate.
- **Don't pass `actor`, `email`, or `name` in the `payload` of an `auditWrite` call.** Pitfall 17 — server overwrites from `request.auth.token`. Putting them in payload is at best dead code, at worst a leak channel if a future schema-loosen change persists payload verbatim.
- **Don't use a SHARED Slack webhook for all alert tiers.** Wave 5 should use ONE webhook for now (anomaly + uptime + budget); but document a forward-tracking ledger row to split into `#ops-warn` vs `#ops-page` channels when alert volume justifies it.
- **Don't enable Sentry tracing (`tracesSampleRate > 0`) in v1.** Burns the free-tier quota fast; PII surface area in trace spans is wider than in error events; defer to v2.
- **Don't try to mutate the `auditLog` doc in the Slack-alert trigger.** The collection's rules disallow writes from anything but the `auditWrite` callable. Triggers run with the `audit-alert-sa` SA, which should NOT have `roles/datastore.user` write to `auditLog/*` — only `roles/datastore.viewer` for read + write to `authFailureCounters/*`.
- **Don't skip the `try/finally` audit emission on auth failure.** Failure events are the primary input to the OBS-05 anomaly counter; missing them means `>5 failed/IP/5min` is uncountable.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Browser error capture + breadcrumb capture | Custom `window.onerror` + `unhandledrejection` listener that POSTs to a Cloud Function | `@sentry/browser` | Sentry handles cross-frame errors, source maps, deduplication, breadcrumb context, fingerprinting — building this badly is exactly what M4 was |
| Source-map upload | Custom CI step that POSTs `.map` files to a Sentry endpoint | `@sentry/vite-plugin` | Plugin handles release lifecycle, hidden-source-map deletion, retry on failed upload, debug-id matching |
| Slack webhook signing | HMAC verification of incoming webhooks | (N/A — outgoing webhook only) | Phase 9 only POSTS to Slack; never receives. No signing surface |
| Auth-anomaly counter | In-memory map keyed on IP-hash | Firestore rolling-window doc + transaction | In-memory does not survive cold starts, doesn't aggregate across Function instances, and would silently miss bursts spanning instance boundaries |
| Uptime monitor | Self-built scheduled function pinging the URL | GCP Cloud Monitoring uptime check | Monitor must be EXTERNAL to the system being monitored — a self-built check on the same project will go down with the project |
| Budget cap | Custom Pub/Sub-driven project-disable function | Cloud Billing budget alert (manual response v1; auto-disable v2) | The "auto-disable on threshold-100%" pattern works but adds a moving part with its own failure modes; v1 = alert-only is the credible bar |
| Sentry quota alert | Custom monitoring of Sentry's API for event count | Sentry's own dashboard alert | Built-in. Free. Don't reinvent. |
| PII scrubbing on free-text fields | Regex-based detector for emails / phone numbers in error messages | Whitelist keys + drop free-form bodies | Regex-based PII detection has 70%+ false-negative rate at scale; a key-whitelist + body-drop is the credible compliance bar at this scale (DLP/ML belongs in v2 with Sentry Business plan) |

**Key insight:** Phase 9 has near-zero novel infrastructure. Everything is wiring or a single-step config. The risk is wiring it WRONG (Pitfall 18 PII leak; Pitfall 7 mirror-trigger fan-out; Pitfall 11 server-only audit boundary), not building it.

---

## Common Pitfalls

### Pitfall 1: Sentry submission burns quota in an error storm

**What goes wrong:** A regression that throws on every render hits 5k events in hours.
**Why it happens:** Default Sentry config has no per-fingerprint rate limit; quota alerts fire at 70% AFTER the spend.
**How to avoid:** Pattern 3 fingerprint-rate-limit at the SDK boundary (drops before transport); OBS-08 quota alert; have a **Sentry kill-switch** in the form of `VITE_SENTRY_DSN=""` empty-string, deployable via Hosting redirect or env-var flip — `initSentryBrowser("")` is a no-op. Document the kill-switch in the runbook.
**Warning signs:** Sentry event-count graph hockey-stick.

### Pitfall 2: Mirror-trigger fan-out duplicates events on bulk operations

**What goes wrong:** Soft-delete of an org cascades to 50 child documents; each delete fires `onDocumentDelete`, each emits a mirror audit event; 50 alerts fire.
**Why it happens:** Phase 7 mirror triggers only dedup against a primary in 60s; bulk delete can fire 50 in <60s with no primary for each child.
**How to avoid:** The Phase 7 design already addresses this for the *primary* event types — `onOrgDelete`/`onUserDelete`/`onDocumentDelete` only fire if no primary `data.<type>.delete` event exists in 60s. AUDIT-05 wires the primary view-side event for the *parent* operation (e.g., `data.org.softDelete.requested` from `src/cloud/soft-delete.js`); Phase 7 mirror triggers handle the cascade. Verify with a synthetic 50-doc soft-delete in the verification phase that exactly ONE alert fires.
**Warning signs:** Slack channel hot-spotted with N identical alerts within seconds.

### Pitfall 3: Sentry init before auth = anonymous events

**What goes wrong:** Errors during the first render are reported but with `setUser({})` empty; operators can't correlate to a user.
**Why it happens:** Easy mistake to put `initSentryBrowser` at the top of `src/main.js` before any await.
**How to avoid:** Init AFTER first `onAuthStateChanged` callback. Boot sequence in `src/main.js`:
1. Bind `onAuthStateChanged` listener.
2. In the listener's first invocation, call `initSentryBrowser(dsn, sha)` and `Sentry.setUser({ id: user.uid, role: user.appClaims?.role })`.
3. Then call `routerRenderRoute(...)`.

This also means errors that occur BEFORE auth state is known (e.g., rare Firebase init errors) are lost. Acceptable tradeoff — the cost is one error class with no remediation cost (errors that crash boot are reproducible locally).
**Warning signs:** Sentry events with empty `user.id` or `<unknown>` actor.

### Pitfall 4: Slack webhook URL committed accidentally

**What goes wrong:** Webhook URL grants any holder POST access to the Slack channel — instant operator-spam vector.
**Why it happens:** Easy to paste into a config file during dev.
**How to avoid:** Three layers: (a) `defineSecret("SLACK_WEBHOOK_URL")` in functions/ — never reads from env-var or file; (b) gitleaks pre-commit + CI rule (already in place from Phase 1) — extend the regex to match Slack webhook URL format `^https://hooks\.slack\.com/services/T[A-Z0-9]+/B[A-Z0-9]+/[A-Za-z0-9]+$`; (c) operator-rotated quarterly per Phase 7 secret-management cadence.
**Warning signs:** Slack channel receiving anonymous test messages.

### Pitfall 5: Cloud Monitoring uptime check loops back through Firebase Hosting under load

**What goes wrong:** If the uptime check is heavily configured (e.g. checks every 10s instead of every 60s) it can itself trigger Cloud Functions cold-starts or App Check rate limits.
**Why it happens:** Forgetting to bypass App Check on the static Hosting URL — uptime checks don't carry App Check tokens.
**How to avoid:** Uptime check hits `https://baselayers.bedeveloped.com/` (the static SPA root); App Check is enforced on Cloud Functions, not on Hosting static assets. Verified by the Phase 7 enforcement pattern. Also, `--period=60s` (the success criterion's 1-minute interval) is the minimum supported by gcloud — there's no temptation to go lower.
**Warning signs:** `securityheaders.com` rating drop; Cloud Functions cold-start spikes correlated with uptime check timestamps.

### Pitfall 6: Source maps publicly served (defeats hidden-map intent)

**What goes wrong:** `vite build` emits `dist/*.js.map` files; if Hosting serves them, the source code is publicly visible.
**Why it happens:** `vite-plugin-sentry` defaults can vary; the `filesToDeleteAfterUpload` option is the explicit fix.
**How to avoid:** Pattern 4 explicitly sets `sourcemaps.filesToDeleteAfterUpload: ["dist/**/*.map"]`. Wave 2 verification step: after `npm run build` in CI, assert `find dist -name "*.map" | wc -l` returns 0.
**Warning signs:** `https://baselayers.bedeveloped.com/main-<hash>.js.map` returns 200 OK.

### Pitfall 7: PII scrubber dictionary drift between browser and node

**What goes wrong:** Browser strips `email` but server doesn't (or vice versa); audit becomes inconsistent.
**Why it happens:** Two SDKs, two `beforeSend` hooks, two source files, manual sync.
**How to avoid:** Pattern 11 — a dictionary in two files with a parity test (`functions/test/util/pii-scrubber-parity.test.ts`). The test is the contract.
**Warning signs:** Sentry events from server contain `email` field; client events don't.

### Pitfall 8: Sentry events containing raw error.message that includes user input

**What goes wrong:** A `throw new Error(\`Invalid email: ${email}\`)` somewhere in `src/firebase/auth.js` puts the email into the Sentry event's `exception.values[0].value`.
**Why it happens:** Code throws errors that include user-supplied strings, and `beforeSend` only scrubs known KEYS, not free-form `value`s.
**How to avoid:** Code-level discipline — error messages MUST be static strings, with details in `error.cause` or in a `Sentry.addBreadcrumb` (which IS scrubbed). The Phase 6 `SignInError` class is already an exemplar (constant message). ESLint rule `no-template-curly-in-string` does NOT catch this; consider a custom rule. **Recommendation:** in Wave 1 add a code-review checklist item ("Error messages contain no template literals interpolating user input") in `CONTRIBUTING.md`.
**Warning signs:** Manual Sentry event audit during Wave 5 close-gate finds emails/names in `exception.value`.

---

## Code Examples

Verified patterns from official sources (referenced in Patterns 1–11 above).

### Sentry browser init (EU)

```javascript
// Source: [VERIFIED: docs.sentry.io/platforms/javascript/configuration/options/]
// Source: [VERIFIED: docs.sentry.io/platforms/javascript/sourcemaps/uploading/vite/]
import * as Sentry from "@sentry/browser";
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN, // contains *.ingest.de.sentry.io
  release: import.meta.env.VITE_GIT_SHA,
  sendDefaultPii: false,
  beforeSend: scrubPii,
});
```

### onDocumentCreated v2 trigger

```typescript
// Source: [VERIFIED: firebase.google.com/docs/functions/firestore-events]
import { onDocumentCreated } from "firebase-functions/v2/firestore";
export const fn = onDocumentCreated(
  { document: "auditLog/{eventId}", region: "europe-west2", serviceAccount: "audit-alert-sa", secrets: [SLACK_WEBHOOK_URL] },
  async (event) => { /* … */ },
);
```

### Slack incoming webhook POST

```javascript
// Source: [VERIFIED: docs.slack.dev/messaging/sending-messages-using-incoming-webhooks 2026-05-10]
await fetch(webhookUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ text: "alert message" }),
});
```

### gcloud monitoring uptime create

```bash
# Source: [VERIFIED: cloud.google.com/sdk/gcloud/reference/monitoring/uptime/create]
gcloud monitoring uptime create base-layers-prod \
  --resource-type=uptime-url \
  --resource-labels=host=baselayers.bedeveloped.com \
  --protocol=https --request-method=get --path=/ \
  --period=60s --timeout=10s --regions=USA,EUROPE,ASIA_PACIFIC
```

### gcloud billing budgets create

```bash
# Source: [VERIFIED: docs.cloud.google.com/billing/docs/how-to/budgets 2026-05-10]
gcloud billing budgets create \
  --billing-account="$BILLING_ACCOUNT" \
  --display-name="base-layers-monthly" \
  --budget-amount=100GBP \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.8 \
  --threshold-rule=percent=1.0 \
  --filter-projects=projects/bedeveloped-base-layers
```

### @sentry/vite-plugin minimal config

```javascript
// Source: [VERIFIED: npmjs.com/package/@sentry/vite-plugin 5.2.1]
sentryVitePlugin({
  org: "bedeveloped",
  project: "base-layers-diagnostic",
  url: "https://de.sentry.io/",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  release: { name: process.env.GITHUB_SHA, create: true, finalize: true },
  sourcemaps: {
    assets: ["dist/**/*.js", "dist/**/*.map"],
    filesToDeleteAfterUpload: ["dist/**/*.map"],
  },
  telemetry: false,
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@sentry/browser` v8.x integrations API | v10 functional integrations (`Sentry.breadcrumbsIntegration({...})`) | Sentry v10 GA early 2025 | Already on v10.51.0 → 10.52.0 — no migration; continue with functional integrations |
| Sentry "tunnel" option for ad-blocker bypass | Same — `tunnel: '/sentry-relay'` | Ongoing | Out of scope v1; document in cleanup-ledger if 80%+ events being blocked |
| `@sentry/vite-plugin` v3 → v5 | Hidden source maps via `filesToDeleteAfterUpload`; release lifecycle via `release.create/finalize` | v4 onwards | Use v5 — this is the current major; v3 had different source-map config |
| Slack `attachments` array | `blocks` array (Block Kit) | Slack legacy attachments deprecated 2023 | For v1 use plain `text` field — simpler + sufficient for ops alerts |
| Cloud Monitoring stackdriver-uptime APIs | gcloud monitoring uptime / `google_monitoring_uptime_check_config` Terraform | 2023 GA | Use the `gcloud monitoring uptime` command — current; `gcloud monitoring uptime-check-configs` is the older alpha namespace |

**Deprecated / outdated:**

- **Sentry v7 integrations classes** (`new BrowserTracing()`) — use functional integrations instead.
- **`functions.config()` for secrets** — already migrated to `defineSecret()` in Phase 7; reuse for `SLACK_WEBHOOK_URL`.
- **`gcloud beta monitoring`** namespace for uptime — use `gcloud monitoring uptime` GA.

---

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation` absent from `.planning/config.json` → treat as enabled).

### Test Framework

| Property | Value |
|----------|-------|
| Framework (root) | Vitest 4.1.5 |
| Framework (functions/) | Vitest 4.1.5 |
| Config file (root) | `vite.config.js` — D-21 per-directory thresholds, src/observability/* currently EXCLUDED until Wave 6 |
| Config file (functions/) | `functions/vitest.config.ts` (inherited Phase 7) |
| Quick run command | `npm test` (root) + `cd functions && npm test` |
| Full suite command | `npm run test:coverage` + `cd functions && npm test -- --coverage` |
| Rules-emulator command | `npm run test:rules` (firestore + storage emulators) — used Wave 4 for `authFailureCounters` rules |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OBS-01 | `initSentryBrowser` creates a Sentry init call with `sendDefaultPii: false` + `beforeSend` set | unit | `npm test -- src/observability/sentry` | ❌ Wave 1 |
| OBS-01 | `scrubPii` removes PII keys from synthetic event | unit | `npm test -- src/observability/pii-scrubber` | ❌ Wave 1 |
| OBS-01 | `_scrubEventForTest` (server) removes the same PII keys | unit | `cd functions && npm test -- pii-scrubber` | ❌ Wave 1 |
| OBS-01 | Browser + node PII_KEYS dictionary parity | unit (parity) | `cd functions && npm test -- pii-scrubber-parity` | ❌ Wave 1 |
| OBS-02 | DSN includes `de.sentry.io` (env-var assertion) | unit (env shape) | `npm test -- env-shape` | ❌ Wave 1 |
| OBS-02 | `PRIVACY.md` Sentry sub-processor row present | doc-test (grep) | `npm test -- security-md-content` | ❌ Wave 6 |
| OBS-03 | `fingerprintRateLimit` drops events past 10/min same fingerprint | unit | `npm test -- src/observability/sentry` | ❌ Wave 1 |
| OBS-04 | `dist/**/*.map` count is 0 after build with `SENTRY_AUTH_TOKEN` set | integration (CI) | `find dist -name "*.map" | wc -l` (asserted in CI) | ❌ Wave 2 (CI step) |
| OBS-04 | Source-map upload step appears in vite plugin config when env var set | unit | `npm test -- vite-config` | ❌ Wave 2 |
| OBS-05 | `authAnomalyAlert` triggers on `auth.signin.failure` — increments counter | integration (firebase-functions-test wrap) | `cd functions && npm test -- authAnomalyAlert.signinFailure` | ❌ Wave 4 |
| OBS-05 | `authAnomalyAlert` posts Slack ON 6th failure in 5min window | integration | `cd functions && npm test -- authAnomalyAlert.threshold` | ❌ Wave 4 |
| OBS-05 | `authAnomalyAlert` triggers on `auth.mfa.unenrol` — posts Slack | integration | `cd functions && npm test -- authAnomalyAlert.mfaUnenrol` | ❌ Wave 4 |
| OBS-05 | `authAnomalyAlert` triggers on `iam.claims.set` newRole=admin previousRole≠admin | integration | `cd functions && npm test -- authAnomalyAlert.roleEscalation` | ❌ Wave 4 |
| OBS-05 | `authAnomalyAlert` triggers on `compliance.export.user` at unusual hour | integration | `cd functions && npm test -- authAnomalyAlert.unusualHour` | ❌ Wave 4 |
| OBS-05 | `authFailureCounters/{ipHash}` rules deny client read + write | rules-unit-test (emulator) | `npm run test:rules -- auth-failure-counters` | ❌ Wave 4 |
| OBS-05 | Synthetic test alert ends in Slack channel (operator) | manual | operator runbook §Slack synthetic test | N/A (Wave 5 close-gate) |
| OBS-06 | `gcloud monitoring uptime list` returns expected check (operator) | manual | `gcloud monitoring uptime list --filter=base-layers-prod` | N/A (Wave 5 operator) |
| OBS-07 | `gcloud billing budgets list` returns expected budget (operator) | manual | `gcloud billing budgets list --billing-account=$BA` | N/A (Wave 5 operator) |
| OBS-08 | Sentry quota alert configured in Sentry dashboard (operator) | manual | screenshot evidence | N/A (Wave 5 operator) |
| AUDIT-05 | `signInEmailPassword` emits `auth.signin.success` on resolve | unit (mock writeAuditEvent) | `npm test -- src/firebase/auth` | ❌ Wave 3 (extends existing) |
| AUDIT-05 | `signInEmailPassword` emits `auth.signin.failure` on bad credential | unit | `npm test -- src/firebase/auth` | ❌ Wave 3 |
| AUDIT-05 | `signOut` emits `auth.signout` BEFORE the firebase signOut | unit (call order) | `npm test -- src/firebase/auth` | ❌ Wave 3 |
| AUDIT-05 | `updatePassword` emits `auth.password.change` on success | unit | `npm test -- src/firebase/auth` | ❌ Wave 3 |
| AUDIT-05 | `setClaims` (client wrapper) emits `iam.claims.set.requested` | unit | `npm test -- src/cloud/claims-admin` | ❌ Wave 3 |
| AUDIT-05 | `exportUser` (client wrapper) emits `compliance.export.user.requested` | unit | `npm test -- src/cloud/gdpr` | ❌ Wave 3 |
| AUDIT-05 | `eraseUser` (client wrapper) emits `compliance.erase.user.requested` | unit | `npm test -- src/cloud/gdpr` | ❌ Wave 3 |
| AUDIT-05 | `softDelete` (client wrapper) emits `data.<type>.softDelete.requested` | unit | `npm test -- src/cloud/soft-delete` | ❌ Wave 3 |
| AUDIT-05 | `restoreSoftDeleted` (client wrapper) emits `data.<type>.restore.requested` | unit | `npm test -- src/cloud/soft-delete` | ❌ Wave 3 |
| AUDIT-05 | `permanentlyDeleteSoftDeleted` (client wrapper) emits `data.<type>.permanentlyDelete.requested` | unit | `npm test -- src/cloud/soft-delete` | ❌ Wave 3 |
| AUDIT-05 | `enrollTotp` emits `auth.mfa.enrol` on success | unit | `npm test -- src/main` (or src/auth/mfa if extracted) | ❌ Wave 3 |
| AUDIT-05 | `unenrollAllMfa` emits `auth.mfa.unenrol` on success | unit | `npm test -- src/main` | ❌ Wave 3 |
| AUDIT-05 | `auditEventInput` Zod enum extended with `.requested` variants | unit (functions/) | `cd functions && npm test -- auditEventSchema` | ❌ Wave 3 |
| DOC-10 | `SECURITY.md` § Observability + § Audit-Event Wiring + § Phase 9 Audit Index present | doc-test (grep) | `npm test -- security-md-phase9` | ❌ Wave 6 |

### Sampling Rate

- **Per task commit:** `npm test` (root) — runs in <30s for src/observability/* + src/firebase/* + src/cloud/* unit tests
- **Per wave merge:** `npm run test:coverage` + `cd functions && npm test -- --coverage` + `npm run test:rules` (Wave 4 only)
- **Phase gate:** Full suite green + `find dist -name "*.map" | wc -l == 0` after Wave 2 build before `/gsd-verify-work 9`

### Wave 0 Gaps

Phase 7 + Phase 8 established robust test infrastructure. Phase 9 adds:

- [ ] `src/observability/pii-scrubber.js` — NEW Wave 1 (does not exist; tests need it)
- [ ] `functions/src/util/pii-scrubber.ts` — NEW Wave 1
- [ ] `functions/test/util/pii-scrubber-parity.test.ts` — NEW Wave 1
- [ ] `functions/test/observability/authAnomalyAlert.integration.test.ts` — NEW Wave 4
- [ ] `tests/rules/auth-failure-counters.test.js` — NEW Wave 4 (rules-unit-test extension)
- [ ] `vite.config.js` test suite — already exists (`tests/firebase-config.test.js` for similar shape); add `tests/vite-config.test.js` Wave 2 for the sentry-plugin shape
- [ ] Coverage thresholds — vite.config.js currently EXCLUDES `src/observability/**` from coverage. Wave 6 raises thresholds (target: lines 95, branches 90, functions 95, statements 95 for `src/observability/**`)
- [ ] `tests/security-md-phase9.test.js` — doc-content grep test for SECURITY.md sections (mirroring Phase 7 pattern)

---

## Security Domain

Security enforcement is enabled (no `security_enforcement: false` in `.planning/config.json`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | AUDIT-05 wires sign-in / sign-out / MFA / password change events; actor identity from verified ID token (server-side, Pitfall 17 — already enforced by Phase 7 `auditWrite`) |
| V3 Session Management | no | Phase 6 owns this |
| V4 Access Control | yes | `authAnomalyAlert` runs as `audit-alert-sa` with `roles/datastore.viewer` on auditLog + `roles/datastore.user` scoped to authFailureCounters/* — minimal IAM (FN-04 pattern) |
| V5 Input Validation | yes | `authAnomalyAlert` reads from auditLog where Zod validation already happened in `auditWrite`; defence-in-depth Zod schema for the trigger's expected fields recommended |
| V6 Cryptography | yes | sha256(`actor.ip`) for `ipHash` keying; uses `node:crypto` (not hand-rolled); no key material |
| V7 Error Handling and Logging | yes | This phase IS the error-handling-and-logging phase. ASVS V7.1 (logging key security events) + V7.2 (centralised log review) directly addressed. Pitfall 18 (PII in logs) addressed by scrubber dictionary. |
| V8 Data Protection | yes | PII scrubbing in `beforeSend`; Sentry EU residency; no session replay |
| V9 Communications | no | Slack webhook is HTTPS by Slack's contract; uptime check is HTTPS via gcloud config |
| V14 Configuration | yes | `defineSecret()` for SLACK_WEBHOOK_URL + SENTRY_DSN (already exists Phase 7); per-function SA `audit-alert-sa` (NEW Wave 5 provisioning) |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| PII leak via Sentry breadcrumb / extra | Information Disclosure | `beforeSend` PII scrubber; key-whitelist + body-drop; parity test browser↔node; quota cap |
| Slack webhook URL leak | Information Disclosure | `defineSecret()`; gitleaks rule extension; quarterly rotation |
| Auth-anomaly false-positive flood | Availability (operator-attention exhaustion) | Fingerprint rate-limit at SDK; per-window single-fire on counter threshold (`if (next === FAIL_LIMIT + 1)`); separate channels for warn vs page (deferred v2) |
| Source-map disclosure | Information Disclosure | `filesToDeleteAfterUpload` deletes .map files post-upload; CI assertion `find dist -name "*.map" \| wc -l == 0` |
| Sentry event ingest bypass / tampering | Tampering | Sentry DSN public key allows any client to submit; abuse mitigated by quota cap (5k/month free + 70% alert) and EU project isolation; tunnel option deferred to v2 if needed |
| Audit-event spoofing via client payload | Tampering | Phase 7 `auditWrite` enforces actor from `request.auth.token`, never from payload (Pitfall 17). Phase 9 view-side calls MUST NOT pass actor in payload — Wave 3 lint check verifies |
| `authAnomalyAlert` deletes real `auditLog/{eventId}` doc | Tampering | `audit-alert-sa` IAM excludes `roles/datastore.user` on auditLog; only viewer role + writer role scoped to authFailureCounters/* |
| Slack alert exfiltrates payload PII | Information Disclosure | The `payload` field is server-set + Zod-validated by `auditWrite`; the alert function reads `actor.email` (already verified-identity, not free-form) and a few enum-typed payload fields like `newRole`. No free-form text from client payloads is forwarded to Slack. |
| Sentry tunnel endpoint accepts any payload | Tampering | Tunnel option NOT enabled in v1 — direct DSN POST only |
| Uptime check probes leak from non-public regions | Information Disclosure | gcloud uptime checks come from documented IP ranges; no internal endpoint exposed; production hostname is already public |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Sentry free tier remains 5k events/month + EU region with no geographic surcharge | Standard Stack §@sentry/browser; OBS-08 | Quota math + 70% alert threshold change; documentation update only |
| A2 | "Unusual hours" for `gdprExportUser` are 22:00–05:00 UTC | Pattern 6 §Rule 4 | False-positive rate; planner can adjust thresholds via discuss-phase if user wants different timezone bounds |
| A3 | Phase 7 mirror triggers' 60-second dedup window is wider than the latency between view-side AUDIT-05 emission and the corresponding Firestore mutation | Pitfall 2 (mirror fan-out) | If view emits AFTER the mutation by >60s in some flow (network blip, App Check token refresh), mirror trigger fires too — duplicate audit row. Empirically the audit emission via `auditWrite` callable returns in <2s typical; >60s is implausible. |
| A4 | The `authFailureCounters/{ipHash}` collection at expected volume (single-digit fails/day post-bootstrap) does not bump Firestore costs materially | Pattern 10 | Cost rounding; <1 GBP/month even at 100× expected volume |
| A5 | Slack webhook quota (1 msg/sec) is not exceeded by combined alert types | Pattern 6 | Need throttling layer; not at v1 volume |
| A6 | Sentry DSN can be embedded in the public client bundle without elevating risk beyond the documented 70% quota alert | Pattern 1 | DSN public-key model is by design (Sentry docs); abuse limited to quota burn (already alerted on) |
| A7 | `firebase-functions/v2/firestore` `onDocumentCreated` runs in the same `europe-west2` region as `auditWrite` (avoids cross-region trigger latency) | Pattern 6 | Region pin set explicitly to `europe-west2` to match — covered by config |

**A2 risk:** the "unusual hour" is the only ASSUMED claim with a concrete decision impact. Recommendation: leave as 22:00–05:00 UTC for v1; add a comment in the Slack alert ("Adjust hours in `UNUSUAL_HOURS` constant in `functions/src/observability/authAnomalyAlert.ts`"); document for the operator to tune after observing actual export patterns.

---

## Open Questions

1. **Single Sentry project (browser + node) vs separate projects.**
   - What we know: SUMMARY.md §Observability says "Browser SDK ... + Node SDK ... share a single project + DSN — one dashboard for client and server errors." PITFALLS.md §"Anti-Patterns Worth Naming" says "Single Sentry project for client + Functions" → "Never — separate the projects from day one."
   - What's unclear: The two project research files contradict.
   - Recommendation: **Single Sentry project, two environments** (`environment: "browser"` for client; `environment: "node"` for server). This gives one dashboard (SUMMARY's intent) while letting operators filter by environment to mute the noisier source (PITFALLS' intent). The DSNs are still distinct (Sentry projects carry one DSN), but a single project with environment tags is the credible middle path. **Action: planner confirms in Wave 1.**

2. **Audit-event type-naming for client-side request markers.**
   - What we know: Phase 7 `auditEventInput` Zod enum has 25 entries; Phase 9 needs to add `.requested` variants for the 6 server-emitting callables (gdprExportUser, gdprEraseUser, softDelete, restoreSoftDeleted, permanentlyDeleteSoftDeleted, setClaims).
   - What's unclear: Whether to extend the enum or replace with an open-string + regex validator.
   - Recommendation: Extend the enum literally — `compliance.export.user.requested`, `compliance.erase.user.requested`, etc. Explicit > clever.

3. **Slack alert channel routing — single vs split.**
   - What we know: Success criteria specifies "a Slack webhook fires" (singular). Anti-pattern advice in this research recommends splitting `#ops-warn` vs `#ops-page` when volume justifies.
   - Recommendation: Single webhook for v1 (one Slack channel `#bedeveloped-ops`). Forward-tracking ledger row queues split for v2 review at engagement re-start.

4. **Sentry DSN exposure in the public bundle.**
   - What we know: The DSN is the SDK's transport endpoint; embedding in the bundle is the standard Sentry pattern. The DSN public-key model accepts events from any source — abuse vector is quota burn (5k/month).
   - What's unclear: Whether the prospect's security questionnaire will flag "DSN visible in source" as a finding.
   - Recommendation: Document honestly in `SECURITY.md` § Observability + `PRIVACY.md` Sentry sub-processor entry — "DSN intentionally embedded; abuse mitigated by quota cap + 70% alert; no other sensitive material in the DSN." This is the credible answer.

5. **Auth-failure counter sharding (high-volume future).**
   - What we know: At current volume (no live users) the single `authFailureCounters/{ipHash}` doc per IP is fine. At scale, the 1-write-per-second-per-doc Firestore limit could throttle counter updates during a credential-stuffing attack.
   - Recommendation: Defer. Log a row in cleanup-ledger forward-tracking — "If/when post-engagement traffic resumes, audit credential-stuffing attack drill writes to `authFailureCounters` against the 1 wps/doc limit." V2.

6. **Whether to add an alerting policy for "AUDIT-05 emission rate dropped to zero in the last 30 minutes."**
   - What we know: A silent failure mode (some upstream change breaks `writeAuditEvent`) would mean operators stop receiving audit events and don't know it.
   - What's unclear: Whether GCP Cloud Monitoring metric-based alerting on Firestore write rates is in scope for v1.
   - Recommendation: Out of scope for v1 — too much instrumentation for the audit narrative. Add a forward-tracking ledger row.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@sentry/browser` | Wave 1 src/observability/sentry.js | ✓ | 10.51.0 (bump → 10.52.0) | — |
| `@sentry/node` | Wave 1 functions/src/util/sentry.ts | ✓ | 10.52.0 | — |
| `@sentry/vite-plugin` | Wave 2 vite.config.js | ✗ | not installed | Wave 2 `npm install -D @sentry/vite-plugin@5.2.1` |
| Firebase Secret Manager | Wave 4 SLACK_WEBHOOK_URL | ✓ | — | Already used by Phase 7 (SENTRY_DSN, GDPR_PSEUDONYM_SECRET) |
| `audit-alert-sa` service account | Wave 4 authAnomalyAlert | ✗ | does not exist | Wave 5 `scripts/provision-phase9-sas/run.js` (Pattern E) |
| Sentry org + project (EU region) | Wave 1 OBS-02 | ✗ | does not exist | Operator action — `runbooks/phase-9-sentry-bootstrap.md` |
| Slack workspace + incoming webhook | Wave 5 OBS-05 | ⚠ | (BeDeveloped Slack workspace exists; webhook URL not yet created) | Operator action — runbook documents app-create + webhook generation |
| GCP billing API + budget API | Wave 5 OBS-07 | ✓ | (already enabled — Phase 7 uses cloudbilling.googleapis.com) | — |
| GCP Cloud Monitoring API | Wave 5 OBS-06 | ⚠ | (verify: gcloud services list \| grep monitoring.googleapis.com) | If disabled: `gcloud services enable monitoring.googleapis.com` |
| GitHub secret SENTRY_AUTH_TOKEN | Wave 2 CI | ✗ | does not exist | Operator-set after Sentry org create — runbook step |
| GitHub secret VITE_SENTRY_DSN | Wave 2 CI | ✗ | does not exist | Operator-set — runbook step |

**Missing dependencies with no fallback:** None. Every gap has either a code-path-fallback (no DSN = init no-op) or an operator-script fallback documented in the Wave 5 runbooks.

**Missing dependencies with operator-action fallback:**
- Sentry org create + EU project + DSN copy + quota alert (Wave 1 runbook)
- Slack incoming webhook generation (Wave 5 runbook)
- GitHub Actions secret population (Wave 2/5 runbook)
- Cloud Monitoring uptime check create (Wave 5 script)
- Billing budget create (Wave 5 script)

---

## Sources

### Primary (HIGH confidence)
- [Sentry JavaScript SDK options](https://docs.sentry.io/platforms/javascript/configuration/options/) — `sendDefaultPii`, `beforeSend`, `tracesSampleRate`, `release`, `environment`, `integrations` documented
- [Sentry Vite plugin source-map upload guide](https://docs.sentry.io/platforms/javascript/sourcemaps/uploading/vite/) — sentryVitePlugin parameters + auth-token env var
- [Sentry DSN explainer](https://docs.sentry.io/concepts/key-terms/dsn-explainer/) — DSN encodes region; *.ingest.de.sentry.io is EU
- [Slack incoming webhooks](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks) — minimal POST shape, content-type, Tier-1 rate limit
- [gcloud monitoring uptime create](https://docs.cloud.google.com/sdk/gcloud/reference/monitoring/uptime/create) — period/timeout/regions params
- [GCP Cloud Monitoring uptime checks](https://docs.cloud.google.com/monitoring/uptime-checks) — public uptime check creation flow
- [GCP Cloud Billing budget alerts](https://docs.cloud.google.com/billing/docs/how-to/budgets) — budget create + threshold rules
- [Firebase avoid surprise bills](https://firebase.google.com/docs/projects/billing/avoid-surprise-bills) — budget alerts do NOT cap; Pub/Sub-driven cap is separate
- [Firebase v2 onDocumentCreated](https://firebase.google.com/docs/functions/firestore-events) — trigger options + retryConfig
- npm registry `npm view @sentry/browser dist-tags` 2026-05-10 → latest=10.52.0
- npm registry `npm view @sentry/node dist-tags` 2026-05-10 → latest=10.52.0
- npm registry `npm view @sentry/vite-plugin dist-tags` 2026-05-10 → latest=5.2.1

### Secondary (MEDIUM confidence)
- [@sentry/vite-plugin readme on npm](https://www.npmjs.com/package/@sentry/vite-plugin) — config options (org, project, url, authToken, release, sourcemaps, telemetry, debug)
- Existing project files verified by direct read — `functions/src/util/sentry.ts`, `functions/src/audit/auditWrite.ts`, `functions/src/audit/auditLogger.ts`, `functions/src/audit/auditEventSchema.ts`, `src/observability/sentry.js` (stub), `src/observability/audit-events.js` (stub), `src/cloud/audit.js`, `src/cloud/gdpr.js`, `src/cloud/soft-delete.js`, `src/cloud/claims-admin.js`, `src/firebase/auth.js`, `src/views/auth.js`, `vite.config.js`, `.github/workflows/ci.yml`, `functions/src/index.ts`, `functions/package.json`, `package.json`, `.planning/research/STACK.md`, `.planning/research/SUMMARY.md` (Phase 9 row), `.planning/research/PITFALLS.md` (Pitfalls 7 + 11 + 17 + 18 + 19), `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/phases/08-data-lifecycle-soft-delete-gdpr-backups/08-RESEARCH.md` (precedent format)

### Tertiary (LOW confidence)
- WebSearch result on `@sentry/vite-plugin` configuration options — confirms shape but no version-specific 2026 changelog citation
- WebSearch result on Sentry EU region (`de.sentry.io`) confirmed — but EU customer-support-region docs page returned 404; cited via search-result excerpts
- Slack webhook 1 msg/sec rate limit cited from Slack Tier-1 docs but the cited rate-limit page itself was not directly fetched (search-result only); plan should verify on first synthetic alert

---

## Metadata

**Confidence breakdown:**
- Standard stack (Sentry + Slack + gcloud): HIGH — npm versions verified; SDK shapes verified against docs.sentry.io
- Architecture (boot ordering, AUDIT-05 wiring map, Slack alert topology): HIGH — derived from existing Phase 7+8 substrate verified by direct file read
- AUDIT-05 wiring inventory (9 sites): HIGH — every site verified by grep across `src/firebase/auth.js`, `src/cloud/*`, `src/main.js`, `src/views/auth.js`
- Pitfalls (mirror fan-out, Sentry init ordering, source-map disclosure): HIGH — Phase 7 mirror trigger code read directly; Pitfall 18 derived from project research
- Anomaly detection thresholds (5 fails / 5 min, unusual hours): MEDIUM — counts are from success criteria (verbatim); "unusual hours" is ASSUMED 22:00–05:00 UTC (A2)
- Slack alert function topology (single onDocumentCreated trigger): MEDIUM — alternative would be a scheduled trigger, but the real-time trigger is the natural shape and the integration test surface is well understood
- Single-Sentry-project decision: MEDIUM — research files contradict; recommendation falls between them

**Research date:** 2026-05-10
**Valid until:** 2026-06-10 (Sentry v10 SDK is stable through 2026; Slack webhook contract has been stable since 2018; gcloud monitoring + billing CLI commands GA since 2022)

---

## Project Constraints (from CLAUDE.md)

The following directives in `./CLAUDE.md` constrain Phase 9 implementation. Plans must respect all of them; verification confirms compliance.

| # | Directive | Scope |
|---|-----------|-------|
| C1 | Stay on Firebase (no Vercel/Supabase) | All Cloud Functions stay in `functions/`, region `europe-west2` |
| C2 | Stay on vanilla JS | `src/observability/sentry.js` body fill uses `// @ts-check` + JSDoc; no `.ts` files in `src/` |
| C3 | No backwards-compatibility window | Free to change `auditEventInput` Zod enum (extend with `.requested` variants) without dual-write window |
| C4 | Compliance bar = credible, not certified | Document Sentry DSN exposure honestly; document budget-alert-not-cap honestly; Pitfall 19 substrate-honest |
| C5 | Conventional Commits | `feat(09-01):`, `feat(09-04):`, `docs(09-06):`, `chore(09-05):`, etc. |
| C6 | `.planning/` is committed (per config) | Phase 9 planning docs, runbooks, and code commits all land |
| C7 | No emojis in commit messages or in source unless asked | Slack alert messages may use emojis (e.g. `:warning:`, `:rotating_light:`) — that's the message body, not the commit message |
| C8 | Source layout: `firebase/` + `data/*` + `domain/*` + `auth/*` + `cloud/*` + `views/*` + `ui/*` + `observability/*` (lint-enforced) | Wave 1 fills `src/observability/*`; new file `src/observability/pii-scrubber.js` must follow ESLint Wave 3 boundary (not import from `firebase/*`, not import from `views/*`) |
| C9 | YOLO + saved defaults (per memory.md user_context) | discuss skipped per `workflow.skip_discuss=true`; recommended defaults selected without explicit confirmation |
| C10 | Recommend decisively when asked (per feedback memory) | Open Question #1 (single vs separate Sentry project) gives a concrete recommendation rather than alternatives |
| C11 | Run UAT verification commands directly (per feedback memory) | Verifier phase runs `find dist -name "*.map" \| wc -l`, `gcloud monitoring uptime list`, etc., directly; only screenshots and Slack-channel-receipt confirmations are user-asked |

---

## Documentation Increment (DOC-10 — Wave 6)

`SECURITY.md` gains four new sections + a Phase 9 Audit Index row, mirroring the Phase 7 + Phase 8 cadence:

1. **§ Observability** — Sentry browser + node init, EU residency, DSN handling, sendDefaultPii false, beforeSend scrubber dictionary, fingerprint rate limit, source-map upload (hidden), quota alert
2. **§ Audit-Event Wiring (AUDIT-05)** — the 9 wiring sites, dual-emit pattern (`.requested` client-side + server-authoritative type), Pitfall 17 (server-determined actor), Pitfall 7 (mirror-trigger dedup window)
3. **§ Auth-Anomaly Alerting (OBS-05)** — the four rules, Slack channel, secret rotation cadence, false-positive-rate calibration
4. **§ Phase 9 Audit Index** — 10-row Pattern G framework-citation table:
   - OBS-01 → ASVS V8.2, V7.1, V7.4 / ISO 27001 A.8.16 / SOC2 CC7.2 / GDPR Art. 32(1)(d)
   - OBS-02 → GDPR Art. 32(1)(b) (data residency)
   - OBS-03 → ASVS V11.1 (rate-limit on observability ingest)
   - OBS-04 → ASVS V14.2 (build-pipeline integrity)
   - OBS-05 → ASVS V7.2 (centralised log review) / ISO 27001 A.5.25, A.8.16 / SOC2 CC7.2, CC7.3
   - OBS-06 → ISO 27001 A.5.25 / SOC2 A1.1 (availability)
   - OBS-07 → SOC2 A1.1 / DoW defence
   - OBS-08 → SOC2 CC7.2 (capacity monitoring)
   - AUDIT-05 → ASVS V8.1, V8.2 / ISO 27001 A.8.15 / SOC2 CC7.2 / GDPR Art. 30
   - DOC-10 → Pitfall 19 substrate-honest disclosure

`PRIVACY.md` (Phase 11 owns canonical) — Phase 9 increment: Sentry sub-processor row added with DPA URL + EU region statement.

---

_Research dated: 2026-05-10. Next freshness check: 2026-06-10._
