# Phase 7: Cloud Functions + App Check (Trusted-Server Layer) — Research

**Researched:** 2026-05-09
**Domain:** Firebase 2nd-gen Cloud Functions trust-boundary; reCAPTCHA Enterprise App Check; server-only audit log; Firestore-Rules + token-bucket rate limiting; BigQuery audit-log archive
**Confidence:** HIGH (substrate, patterns, versions verified against npm registry + existing codebase + Firebase docs); MEDIUM on a few operator-input items flagged in Open Questions.

---

## Summary

Phase 7 stands up the **trusted-server layer**: every privileged write the rest of the milestone depends on (audit log, soft-delete, GDPR export/erase, scheduled backup, claims admin) flows through 2nd-gen Cloud Functions that **enforce App Check, validate input via Zod, mark idempotency keys, capture errors to Sentry node, and run as their own minimal-IAM service accounts**. Firestore now stores an `auditLog/{eventId}` collection that **only Admin SDK can write** (rules `allow write: if false`), backed by Cloud Logging Data Access logs sunk to BigQuery `audit_logs_bq` with **partitioned 7-year retention** as the tamper-resistant infra-tier backstop. App Check enrols in **unenforced** mode for ≥7 days; enforcement turns on **per-service in the order Storage → Firestore (collection-by-collection) → Cloud Functions** with quota alerts at 70% of free tier. Rate limiting on chat / comment writes lands as a **Firestore-Rules `request.time` predicate against `rateLimits/{uid}/buckets/{windowStart}`** (no Cloud Function billing per write) with a callable **token-bucket** as a fallback path.

Phase 7 also closes the substrate gaps Phase 6 left open at the Wave 5 cutover-recovery: D-22 ToS gate (firebaseauth.googleapis.com) restoration of `beforeUserCreated` blocking-handler invocation, `minInstances:1` reconsidered for cold-start guarantee, `cspReportSink` redeploy follow-through, and the FN-09 `rateLimits/` predicate that replaces the Phase 5 `allow write: if false` placeholder. TEST-09 lands `firebase-functions-test@3.5.0` integration coverage of `beforeUserCreated` + `beforeUserSignedIn` + `setClaims` + the new audit + rate-limit handlers.

**Primary recommendation:** Six waves (gated by dependency order); land **shared infrastructure first** (Zod schemas, idempotency helper, Sentry init, service-account provisioning script, rule helpers), then `auditWrite` + Firestore-trigger mirrors, then App Check enrolment + production soak gate, then rate-limit predicate + token-bucket fallback, then BigQuery sink + ToS-gate / `minInstances:1` re-enable, then DOC-10 + cleanup-ledger close-out + TEST-09 integration coverage.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

All implementation choices are at Claude's discretion — discuss phase was skipped per `workflow.skip_discuss: true`. Use ROADMAP phase goal, success criteria, codebase conventions, prior-phase patterns (Pattern E one-shot scripts; Pattern G per-phase audit index; Pattern H cleanup-ledger close-and-queue), and `.planning/research/PITFALLS.md` to guide decisions.

### Phase 6 substrate that Phase 7 builds on (load-bearing)

- Cloud Functions workspace exists (`functions/` with TS + Node 22 + Gen 2 — established Phase 3 cspReportSink + Phase 6 auth functions)
- 3 auth Cloud Functions deployed in `europe-west2`: `beforeUserCreatedHandler`, `beforeUserSignedInHandler`, `setClaims`
- Custom claims live: `request.auth.token.role` ∈ {admin, member}, `orgId`, `email_verified`
- `internalAllowlist/{lowercaseEmail}` collection used by `beforeUserCreated`
- AUTH-09 SUPERSEDED by email-link recovery (no recovery codes)
- Phase 5 strict `firestore.rules` + `storage.rules` deployed; `auditLog/{eventId}` already declared `allow write: if false` waiting for Phase 7's Admin-SDK writer.
- `rateLimits/{uid}/buckets/{windowStart}` declared `allow read, write: if false` placeholder waiting for FN-09 predicate.
- `src/cloud/audit.js` + `src/cloud/retry.js` + `src/cloud/soft-delete.js` + `src/cloud/gdpr.js` are empty stub seams Phase 7 fills.

### Phase 6 substrate gaps that Phase 7 must close

- **D-22 ToS gate** (firebaseauth.googleapis.com API enable + ToS acceptance) — operator action; Phase 7 must resolve via either (a) ToS acceptance, (b) callable claims-setter pattern, or (c) 1st-gen blocking functions migration. Until resolved, future user creation cannot auto-claim via `beforeUserCreated`.
- **TOTP wiring** (`enrollTotp` + `unenrollAllMfa` + `qrcodeDataUrl` in `src/firebase/auth.js`) — sub-wave 6.1; Phase 7 may or may not own the wiring depending on whether sub-wave 6.1 lands first. **Decision: NOT Phase 7 scope; sub-wave 6.1 owns it.**
- **MFA gate restoration** (D-27/D-28: `false &&` short-circuits at `src/main.js:808` and `src/router.js`; IdP `mfa.state` re-enable) — sub-wave 6.1; **Phase 7 should not re-introduce regressions but does not own the fix.**
- **BLOCKER-FIX 1** (`setClaims` after password update) — sub-wave 6.1; **Phase 7 hardens setClaims with App Check + Zod + idempotency, but the client-side wiring is sub-wave 6.1.**
- **cspReportSink redeploy** — Phase 3 follow-through; **Phase 7 owns redeploy as a side-effect of the new functions deploy.**
- **AUDIT-01..04** mirror Firestore-trigger audit writers — Phase 7 owns FN-01 + AUDIT-01..04 wiring.
- **FN-09** rate-limit predicate + auditLog writers — Phase 7 owns.

### Pitfalls anchored to Phase 7

- **Pitfall 4** (Admin SDK code in `src/`) — Phase 7 must keep all Admin SDK use under `functions/` and `scripts/` only, never in Vite bundle.
- **Pitfall 12** (cold start lockout from blocking handlers) — `minInstances: 1` mandated for blocking handlers per success criterion 6; reconsider Phase 6 D-4 cost decision (currently no minInstances).
- **Pitfall 13** (service-account JSON in source) — `defineSecret()` for all secrets; ADC for scripts.
- **Pitfall 17** (`auditLog` writer not Admin-SDK-only) — rules `allow write: if false`; only Admin SDK writes; pinned by rules-unit-test.
- **Pitfall 19** (compliance theatre) — every audit-event control must have code link + test link + framework citation in SECURITY.md Phase 7 Audit Index.

### Claude's Discretion

Wave shape (6 recommended), per-function service-account boundaries, idempotency-key shape, audit-event Zod schema concrete fields, App Check soak window operator-deferred or in-phase, BigQuery sink region choice (default `europe-west2` to match Firestore for transfer minimisation), rate-limit threshold values (recommended below).

### Deferred Ideas

- TOTP enrolment client-side wiring — sub-wave 6.1.
- Soft-delete + GDPR export/erase callable bodies — Phase 8.
- Scheduled Firestore export to GCS — Phase 8 (BACKUP-01..07).
- AUDIT-05 view-side `auditWrite` wiring — Phase 9.
- Sentry browser SDK init + PII scrubber — Phase 9 (OBS-01).

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FN-01 | `functions/` workspace exists; TS; Node 22; Gen 2 only | Phase 3 + Phase 6 already established this — Phase 7 only adds modules under existing layout |
| FN-02 | `firebase-admin@13.x` + `firebase-functions@7.x` installed | Already pinned in `functions/package.json` (13.8.0 + 7.2.5); bump to current 13.9.0 + 7.2.5 (latest verified 2026-05-09) |
| FN-03 | Each callable: `enforceAppCheck: true` + Zod input + idempotency-key marker (5min) + Sentry node error capture | Pattern 1 (Standard Callable Shape) + Pattern 4 (Idempotency Marker) + Pattern 6 (Sentry Wrap) |
| FN-04 | Each function: minimal-IAM service account | Pattern 7 (Per-Function Service Account); enumerated table below |
| FN-05 | Secrets via `defineSecret()` only (Firebase Secret Manager); never env vars | Pattern 8 (Secret Manager); enumerated secrets list |
| FN-06 | Auth-blocking functions: `minInstances: 1`; cold-start p99 ≤ 4s | Reverses Phase 6 D-4 stripping; Pattern 9 (minInstances Reconsider); cold-start measurement step |
| FN-07 | App Check + reCAPTCHA Enterprise; per-env site keys; debug tokens `.env.local` only | Pattern 2 (App Check Enrolment); Pattern 3 (Per-Env Site Keys) |
| FN-08 | Staged rollout: 7d unenforced soak → Storage → Firestore (collection-by-collection) → Functions; 70% quota alert | Pattern 3 (Staged Rollout) |
| FN-09 | Rate limit on chat/comment writes — preferred Rules `request.time` predicate against `rateLimits/{uid}/buckets/{windowStart}`; fallback callable token-bucket; synthetic burst test | Pattern 5 (Rate-Limit Predicate); Pattern 5b (Token-Bucket Fallback) |
| AUDIT-01 | `auditLog/{eventId}` collection — server-only writes via `auditWrite` callable; rules `allow write: if false` already in place from Phase 5 | Pattern 4 (Audit Writer); already pinned by `firestore.rules` line 116 |
| AUDIT-02 | Audit event schema documented + Zod-validated | Pattern 4 (schema below) |
| AUDIT-03 | Tier-2 audit log: Cloud Logging Data Access logs → BigQuery dataset `audit_logs_bq`, 7y retention | Pattern 10 (BigQuery Sink) |
| AUDIT-04 | Firestore-trigger mirror writers: `onOrgDelete`, `onUserDelete`, `onDocumentDelete` for defence-in-depth | Pattern 4b (Mirror Triggers) |
| AUDIT-06 | Audit log retention documented: 12mo online + 7y archive | DOC-10 SECURITY.md § Audit Log Retention paragraph |
| AUDIT-07 | Audited user CANNOT read own audit records — rules-unit-test pins this | Already in Phase 5 rules `allow read: if isAdmin();`; Phase 7 adds rules-unit-test cell exercising "internal user attempts to read auditLog where actor.uid == own uid" |
| TEST-09 | `firebase-functions-test@3.x` integration suite covers every callable + trigger | Pattern 11 (firebase-functions-test wrap); test architecture below |
| DOC-10 (incremental) | SECURITY.md Phase 7 Audit Index appended | Pattern 12 (Phase Audit Index — mirrors Phase 6 Pattern G) |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| App Check token attestation | Browser / Client | Firebase Hosting | Token minted by reCAPTCHA Enterprise in browser; attached automatically to every Firebase SDK call by `@firebase/app-check`. Server enforcement is per-product config. |
| App Check enforcement | Firebase backend (per-service config) | — | Console toggle per service; not a code path. |
| Audit-log write authority | API / Backend (Cloud Functions, Admin SDK) | Database (Firestore Rules `allow write: if false`) | Rules deny all client writes; only Admin SDK in Functions can create entries. **Pitfall 17 enforced.** |
| Audit-log mirror (defence-in-depth) | API / Backend (Firestore-trigger Cloud Functions) | — | `onOrgDelete` / `onUserDelete` / `onDocumentDelete` fire even if client `auditWrite` callable was skipped or failed. |
| Audit-log infrastructure tier | Cloud Logging / BigQuery sink | — | Append-only; tamper-evident; immune to compromised Cloud Functions service account. |
| Rate limiting (chat / comments preferred) | Database (Firestore Rules `request.time` predicate) | API / Backend (callable token-bucket fallback) | Rules-side predicate has zero per-write Cloud Function cost. Token-bucket Function is fallback only. |
| Per-function IAM scope | API / Backend (per-function service account) | — | Each function runs as its own SA with only the IAM roles it needs. Compromise of one function doesn't escalate. |
| Secrets management | Firebase Secret Manager via `defineSecret()` | — | Never env vars; never in source. |
| App Check debug tokens | Browser / Client (`.env.local`) | — | Vite-gated via `import.meta.env.DEV`; gitignored. |
| BigQuery audit dataset | Cloud Logging sink → BigQuery `audit_logs_bq` | — | Partitioned daily; 7-year retention; IAM `roles/bigquery.dataViewer` to internal-role users only. |
| Idempotency markers | Database (Firestore `idempotency/{key}` doc with 5-min TTL) | — | Server-side dedup on (uid, type, target.id, clientReqId). |

---

## Standard Stack

### Core (Cloud Functions workspace `functions/`)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase-admin` | **13.9.0** [VERIFIED: npm view firebase-admin version 2026-05-09] | Admin SDK — Firestore + Auth + Storage server-side | Already pinned at 13.8.0 in `functions/package.json`; bump to 13.9.0 latest. |
| `firebase-functions` | **7.2.5** [VERIFIED: npm view firebase-functions version 2026-05-09] | 2nd-gen Cloud Functions runtime | Already pinned. v8 not yet released; v7.2.5 is current latest. |
| `zod` | **4.4.3** [VERIFIED: npm view zod version 2026-05-09] | Input validation for every callable | The 2026 ecosystem default for runtime validation. v4 introduced `z.parseAsync` performance gains relevant to callable hot path. [CITED: https://zod.dev] |
| `@sentry/node` | **10.52.0** [VERIFIED: npm view @sentry/node version 2026-05-09] | Server-side error capture | STACK.md recommended 10.51.0; bump to 10.52.0 latest. Pair version with browser SDK at the same major. |
| `@google-cloud/logging` | **11.x** | Structured logging helper (optional — `firebase-functions/logger` already wraps) | [ASSUMED] — `firebase-functions/logger` is the standard surface; only add `@google-cloud/logging` if direct severity / labels control is needed. |

### Supporting (Cloud Functions devDependencies)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `firebase-functions-test` | **3.5.0** [VERIFIED: npm view firebase-functions-test version 2026-05-09] | Integration testing of callables + triggers in offline / mocked mode | TEST-09 — wraps every callable + trigger; runs against Vitest in `functions/`. STACK.md flagged 3.4.1; bump to 3.5.0. |
| `vitest` | **4.1.5** | Test runner | Already pinned in `functions/package.json`. |
| `@vitest/coverage-v8` | **4.1.5** | Coverage reporter | Already pinned. |
| `@firebase/rules-unit-testing` | **5.0.0** | Rules unit-tests for new `rateLimits/` predicate (root workspace) | Already pinned in root `package.json`. |

### Frontend (`src/cloud/*` body fills)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `firebase` | **12.12.1** | Already pinned at 12.12.1 (Phase 4). `httpsCallable` from `firebase/functions` bundle is the existing surface. | No new dep; `src/cloud/audit.js` body fills with `httpsCallable(functions, "auditWrite")` per Phase 4 D-11 stub plan. |
| `zod` | **4.4.3** (dev only — for client-side type guard, optional) | Optional client-side schema mirror — out of scope for Phase 7 unless minimal | [ASSUMED] — defer; server-side validation is the load-bearing copy. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zod | Joi, ajv, valibot | Zod is the 2026 ecosystem default; ajv (JSON Schema-based) is faster but less ergonomic with TS; valibot is lighter but less audit-name-recognised. **Zod wins for "credible, widely understood".** [CITED: https://zod.dev] |
| reCAPTCHA Enterprise | reCAPTCHA v3 | reCAPTCHA Enterprise is **explicitly recommended** by Firebase docs for new App Check integrations; v3 is legacy. Free quota 10k assessments/month — sufficient for this app. [CITED: https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider] |
| Firestore Rules rate-limit predicate | Cloud Function token-bucket (every write) | Rules-side has zero per-write Function cost; Function-side is the fallback for cases the rules predicate can't express (e.g., complex sliding windows). Spec: "preferred path" is rules; fallback only if rules cap is hit. |
| Firestore-trigger mirror writers | Single-source-of-truth `auditWrite` callable | Mirror triggers cost ~3 extra Function executions per delete event but provide defence-in-depth: an audit entry exists even if the client crashed between mutation and `auditWrite`. **ARCHITECTURE.md §5 prescribes both, restricted to high-stakes events (org delete / user delete / document delete).** |
| BigQuery dataset `audit_logs_bq` (separate) | Single Cloud Logging bucket | Cloud Logging default retention is 30 days (400d for `_Default` bucket); BigQuery sink unlocks 7-year retention + queryable schema. **AUDIT-03/06 explicitly demand BigQuery sink.** [CITED: https://docs.cloud.google.com/logging/docs/export/bigquery] |
| Per-function service accounts | Single `<project>@appspot.gserviceaccount.com` (default) | Default SA has Editor scope across the project; SOC2 finding. **Pitfall 13 requires per-function minimal-IAM SAs.** |

**Installation:**

```bash
# In functions/
cd functions
npm install firebase-admin@13.9.0 firebase-functions@7.2.5 zod@4.4.3 @sentry/node@10.52.0
npm install -D firebase-functions-test@3.5.0
```

---

## Recommended Project Structure

```
functions/
├── package.json                              # bump firebase-admin → 13.9.0, add zod + @sentry/node + firebase-functions-test
├── tsconfig.json
├── src/
│   ├── index.ts                              # exports (re-export auditWrite, mirror triggers, rate-limit fallback)
│   ├── csp/cspReportSink.ts                  # Phase 3 — unchanged
│   ├── auth/
│   │   ├── beforeUserCreated.ts              # Phase 6 — Wave 5 add minInstances:1 (FN-06) + enforceAppCheck where applicable
│   │   ├── beforeUserSignedIn.ts             # Phase 6 — Wave 5 add minInstances:1 (FN-06)
│   │   ├── setClaims.ts                      # Phase 6 — Wave 1 harden: enforceAppCheck:true + Zod + idempotency
│   │   └── claim-builder.ts                  # Phase 6 pure logic — unchanged
│   ├── audit/
│   │   ├── auditWrite.ts                     # Wave 2 — onCall callable (AUDIT-01)
│   │   ├── auditEventSchema.ts               # Wave 1 — Zod schema (AUDIT-02)
│   │   ├── triggers/
│   │   │   ├── onOrgDelete.ts                # Wave 2 — mirror trigger (AUDIT-04)
│   │   │   ├── onUserDelete.ts               # Wave 2 — mirror trigger (AUDIT-04)
│   │   │   └── onDocumentDelete.ts           # Wave 2 — mirror trigger (AUDIT-04)
│   │   └── bigquerySinkBootstrap.md          # Wave 5 — operator runbook for BigQuery sink + 7y retention (AUDIT-03)
│   ├── ratelimit/
│   │   ├── tokenBucket.ts                    # Wave 4 — fallback callable (FN-09)
│   │   └── rulesPredicateNotes.md            # Wave 4 — documentation of rules-side predicate (lives in firestore.rules)
│   └── shared/
│       ├── enforceAppCheck.ts                # Wave 1 — re-exportable callable wrapper (FN-03)
│       ├── idempotency.ts                    # Wave 1 — 5-min idempotency-marker helper (FN-03)
│       ├── sentry.ts                         # Wave 1 — Sentry init + withSentry handler wrapper (FN-03)
│       ├── validateInput.ts                  # Wave 1 — Zod parser with HttpsError translation
│       └── httpsErrors.ts                    # Wave 1 — typed error classes (e.g., RateLimitError, IdempotencyDuplicateError)
└── test/
    ├── audit/
    │   ├── auditWrite.integration.test.ts    # Wave 6 — firebase-functions-test (TEST-09)
    │   ├── onOrgDelete.integration.test.ts
    │   └── auditEventSchema.unit.test.ts
    ├── ratelimit/
    │   └── tokenBucket.integration.test.ts
    ├── shared/
    │   ├── idempotency.unit.test.ts
    │   └── validateInput.unit.test.ts
    └── auth/
        ├── beforeUserCreated.integration.test.ts   # Wave 6 — TEST-09
        ├── beforeUserSignedIn.integration.test.ts
        └── setClaims.integration.test.ts

src/
├── cloud/
│   ├── audit.js                              # Wave 6 body fill — httpsCallable wiring
│   ├── claims-admin.js                       # Phase 6 (no change)
│   ├── retry.js                              # Wave 6 body fill — exponential backoff + 429-aware (FN-09)
│   ├── soft-delete.js                        # Phase 8 — out of scope
│   └── gdpr.js                               # Phase 8 — out of scope

scripts/
├── ensure-function-service-accounts/run.js   # Wave 1 — Pattern E one-shot script (FN-04)
└── enable-bigquery-audit-sink/run.js          # Wave 5 — Pattern E one-shot script (AUDIT-03)

firestore.rules                                # Wave 4 — replace rateLimits placeholder block
.env.local                                     # Wave 3 — App Check debug tokens (gitignored)
docs/operator/phase-7-app-check-rollout.md     # Wave 3 — staged-rollout runbook
SECURITY.md                                    # Wave 6 — § Phase 7 Audit Index appended
runbooks/phase-7-cleanup-ledger.md             # Wave 6 — Pattern H zero-out gate
```

---

## Implementation Patterns

### Pattern 1: Standard Callable Shape (FN-03)

**What:** Every new callable in Phase 7 follows this skeleton — App Check enforced, Zod-validated input, idempotency-marker doc, Sentry-wrapped handler, per-function service account, structured Cloud Logging.

**When to use:** Every `onCall` added in Phase 7 (auditWrite, tokenBucket, plus the Phase 6 setClaims hardening pass).

```typescript
// functions/src/audit/auditWrite.ts (Wave 2)
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { withSentry } from "../shared/sentry.js";
import { validateInput } from "../shared/validateInput.js";
import { ensureIdempotent } from "../shared/idempotency.js";
import { auditEventInput } from "./auditEventSchema.js";

if (!getApps().length) initializeApp();

const SENTRY_DSN = defineSecret("SENTRY_DSN");

export const auditWrite = onCall(
  {
    region: "europe-west2",
    enforceAppCheck: true,                     // FN-07
    serviceAccount: "audit-writer-sa",          // FN-04
    secrets: [SENTRY_DSN],                      // FN-05
    memory: "256MiB",
    timeoutSeconds: 30,
    minInstances: 0,                            // not blocking; cold-start tolerable
  },
  withSentry(async (request) => {
    // 1. Identity from verified ID token (NEVER from payload — Pitfall 17)
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }
    const actorUid = request.auth.uid;
    const actorEmail = request.auth.token.email ?? null;
    const actorRole = request.auth.token.role ?? null;
    const actorOrgId = request.auth.token.orgId ?? null;

    // 2. Validate input via Zod
    const data = validateInput(auditEventInput, request.data);

    // 3. Idempotency marker — 5-minute window per (actor:type:target:clientReqId)
    const idempotencyKey =
      `${actorUid}:${data.type}:${data.target.id}:${data.clientReqId}`;
    await ensureIdempotent(idempotencyKey, "auditWrite", 5 * 60);

    // 4. Write the audit event with server-controlled fields
    const eventId = crypto.randomUUID();
    await getFirestore().doc(`auditLog/${eventId}`).set({
      eventId,
      type: data.type,
      severity: data.severity ?? "info",
      actor: { uid: actorUid, email: actorEmail, role: actorRole, orgId: actorOrgId },
      target: data.target,
      at: FieldValue.serverTimestamp(),     // server clock — Pitfall 17
      ip: request.rawRequest?.headers["x-forwarded-for"]?.toString().split(",")[0] ?? null,
      userAgent: request.rawRequest?.headers["user-agent"] ?? null,
      payload: data.payload ?? {},
      idempotencyKey,
      schemaVersion: 1,
    });

    logger.info("audit.write", { eventId, type: data.type, actorUid });
    return { ok: true, eventId };
  }),
);
```

**Source:** ARCHITECTURE.md §3 + §5 + Pitfall 17 + existing `functions/src/auth/setClaims.ts` shape.

---

### Pattern 2: App Check Enrolment (FN-07)

**What:** Browser-side App Check init via `@firebase/app-check` with reCAPTCHA Enterprise provider; per-environment site keys; debug tokens gated by `import.meta.env.DEV` only.

**When to use:** `src/firebase/check.js` body fill (Phase 4 left this as a stub for Phase 7).

```javascript
// src/firebase/check.js (Wave 3)
// @ts-check
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { app } from "./app.js";

// Per-environment site keys (FN-07): never the same key across dev/staging/prod
const SITE_KEY = import.meta.env.VITE_APPCHECK_SITE_KEY;

if (import.meta.env.DEV && import.meta.env.VITE_APPCHECK_DEBUG_TOKEN) {
  // Vite tree-shakes this entire branch in prod (Pitfall 8 mitigation #3)
  // Token sourced from .env.local (gitignored). Never commit.
  // @ts-ignore — global self augmentation per Firebase App Check docs
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;
}

if (!SITE_KEY) {
  // Fail-closed: bundle without site key would silently bypass App Check
  throw new Error("VITE_APPCHECK_SITE_KEY not configured");
}

export const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaEnterpriseProvider(SITE_KEY),
  isTokenAutoRefreshEnabled: true,
});
```

**Source:** [CITED: https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider]

---

### Pattern 3: Staged Rollout (FN-08)

**What:** App Check enforcement turns on in stages — never all-at-once. Per `Pitfall 8` and the success criterion, the order is: **enrol** → **≥7-day soak in unenforced mode** (verify metrics dashboard "verified vs unverified" >95%) → **enforce on Storage** (lowest blast radius — uploads only) → **enforce on Firestore collection-by-collection** → **enforce on Cloud Functions** → **70% quota alert configured throughout**.

**Operator runbook lives in:** `docs/operator/phase-7-app-check-rollout.md` (Wave 3).

**Stage table:**

| Stage | Trigger | Action | Verification |
|-------|---------|--------|--------------|
| A | Wave 3 commit | Enrol App Check + reCAPTCHA Enterprise; deploy `check.js` to production; **leave enforcement OFF** for all services | App Check dashboard shows non-zero `verified` count within 24h |
| B | Day 0 (deploy) | Configure 70% quota alert in Cloud Console | Synthetic alert test fires |
| C | Day 7+ | Verify "verified ≥95%, unverified ≤5%" in App Check dashboard for ≥7 consecutive days | Screenshot for evidence pack (DOC-09) |
| D | Day 8 | Enforce on **Storage** (Firebase Console → App Check → Storage → Enforce) | Upload smoke test passes; failed-auth test from non-app environment denies |
| E | Day 9 | Enforce on Firestore — **collection by collection**: start with `auditLog` (server-write only — zero client traffic) → `internalAllowlist` → `softDeleted` → progressively user-data collections (`messages`, `comments`, `documents`, `responses`, `actions`) | Per-collection dashboard ratio re-verified before moving on; rollback per-collection only |
| F | Day 14+ | Enforce on **Cloud Functions** (callable + scheduled) | Synthetic burst test from un-attested client returns `unauthenticated` HttpsError |

**Operator runbook tracks each stage with checkbox + timestamp + screenshot path. Wave 5 cleanup ledger row closes only when Stage F lands.**

**Phase 7 close gate:** Stage A + B + C land in-phase. Stages D-F are operator-paced and flagged in `runbooks/phase-7-cleanup-ledger.md` as "operator-execution items pending in 07-HUMAN-UAT.md" — mirrors Phase 3 / Phase 4 / Phase 5 / Phase 6 deferred-operator-execution pattern.

**Source:** [CITED: https://firebase.google.com/docs/app-check/enable-enforcement] + Pitfall 8.

---

### Pattern 4: Audit Event Schema + Zod Validation (AUDIT-02)

**What:** Single source of truth for the audit event shape — Zod schema in `functions/src/audit/auditEventSchema.ts`. Every `auditWrite` call validates against this schema; rules-unit-tests pin denied-write paths.

```typescript
// functions/src/audit/auditEventSchema.ts (Wave 1)
import { z } from "zod";

export const auditEventType = z.enum([
  "auth.signin.success",
  "auth.signin.failure",
  "auth.signout",
  "auth.mfa.enrol",
  "auth.mfa.unenrol",
  "auth.password.change",
  "auth.password.reset",
  "iam.claims.set",
  "data.org.create",
  "data.org.update",
  "data.org.softDelete",
  "data.org.restore",
  "data.user.create",
  "data.user.delete",
  "data.document.upload",
  "data.document.delete",
  "data.message.create",
  "data.message.delete",
  "data.comment.create",
  "data.comment.delete",
  "compliance.export.user",
  "compliance.erase.user",
  "ratelimit.exceeded",
  "appcheck.failure",
  "rules.deployed",
]);

export const auditEventInput = z.object({
  type: auditEventType,
  severity: z.enum(["info", "warning", "alert"]).optional(),
  target: z.object({
    type: z.string().min(1).max(64),         // "org" | "user" | "comment" | ...
    id: z.string().min(1).max(128),
    orgId: z.string().nullable().optional(),
    snapshot: z.record(z.unknown()).optional(), // small pre-change snapshot
  }),
  clientReqId: z.string().uuid(),            // mandatory for idempotency-key
  payload: z.record(z.unknown()).optional(), // event-specific freeform metadata
});

export type AuditEventInput = z.infer<typeof auditEventInput>;
```

**Stored shape (additional server-set fields):** `eventId`, `actor`, `at` (serverTimestamp), `ip`, `userAgent`, `idempotencyKey`, `schemaVersion: 1` — all set in the handler, never trusted from payload (Pitfall 17).

**Source:** ARCHITECTURE.md §5 audit-log document schema + Pitfall 17.

---

### Pattern 4b: Mirror Triggers (AUDIT-04)

**What:** Three Firestore-trigger Cloud Functions provide defence-in-depth. Each fires on the corresponding Firestore document delete and writes a mirror audit event with `source: "trigger"` to disambiguate from primary `auditWrite`-callable events.

```typescript
// functions/src/audit/triggers/onOrgDelete.ts (Wave 2)
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (!getApps().length) initializeApp();

export const onOrgDelete = onDocumentDeleted(
  {
    document: "orgs/{orgId}",
    region: "europe-west2",
    serviceAccount: "audit-mirror-sa",
  },
  async (event) => {
    const orgId = event.params.orgId;
    const before = event.data?.data();
    // Mirror event — only fire if no primary auditWrite event exists for this
    // target within the last 60 seconds (deduplication against the primary)
    const recent = await getFirestore()
      .collection("auditLog")
      .where("type", "==", "data.org.softDelete")
      .where("target.id", "==", orgId)
      .where("at", ">", new Date(Date.now() - 60_000))
      .limit(1)
      .get();
    if (!recent.empty) {
      logger.info("audit.mirror.skipped", { orgId, reason: "primary-exists" });
      return;
    }
    await getFirestore().doc(`auditLog/${crypto.randomUUID()}`).set({
      eventId: crypto.randomUUID(),
      type: "data.org.delete.mirror",
      severity: "warning",
      actor: { uid: null, email: null, role: "system", orgId: null },
      target: { type: "org", id: orgId, orgId, snapshot: before ?? null },
      at: FieldValue.serverTimestamp(),
      payload: { source: "trigger", reason: "no-primary-audit-found" },
      schemaVersion: 1,
    });
    logger.warn("audit.mirror.fired", { orgId });
  },
);
```

**Three triggers, identical shape:** `onOrgDelete` (`orgs/{orgId}`), `onUserDelete` (`users/{uid}`), `onDocumentDelete` (`orgs/{orgId}/documents/{docId}`).

**Mirror-trigger event types:** `data.org.delete.mirror`, `data.user.delete.mirror`, `data.document.delete.mirror` — the `.mirror` suffix lets BigQuery analytics distinguish defence-in-depth events from primary events.

**Source:** ARCHITECTURE.md §5 "Write path — server-mirror events" + Pitfall 17.

---

### Pattern 5: Rate-Limit Predicate in Firestore Rules (FN-09 preferred path)

**What:** Replaces the Phase 5 `rateLimits/{uid}/buckets/{windowStart}` placeholder (currently `allow read, write: if false`) with a predicate that enforces a per-user write quota across `messages` + `comments`. Uses `request.time` to derive the current 60-second window, plus a counter doc the client increments transactionally on each protected write.

**Window key shape:** `windowStart` = `floor(timestamp.now() / 60_000) * 60_000` (60-second buckets).

**Counter doc shape:** `rateLimits/{uid}/buckets/{windowStart}` = `{ count: number, lastWriteAt: timestamp }`.

**Threshold:** **30 writes per 60-second window** (chat 30 msg/min, comments 30/min combined). Documented in `docs/RETENTION.md` and Wave 4 rules unit tests.

**Sketch (firestore.rules — Wave 4):**

```javascript
function rateLimitWindow() {
  // 60-second buckets keyed off request.time.
  // Note: request.time is a Timestamp; toMillis() returns int.
  return string((request.time.toMillis() / 60000).toInt() * 60000);
}

function rateLimitOk(uid) {
  // Resolve the bucket for the calling user + current window.
  // get() costs 1 Firestore read per write — acceptable trade vs Cloud Function.
  let bucketPath = /databases/$(database)/documents/rateLimits/$(uid)/buckets/$(rateLimitWindow());
  let bucket = exists(bucketPath) ? get(bucketPath).data : null;
  return bucket == null || bucket.count < 30;
}

match /rateLimits/{uid}/buckets/{windowStart} {
  // Users CAN read their own bucket (UI affordance: "you've sent 28/30")
  allow read: if request.auth != null && request.auth.uid == uid;
  // Users CAN write/increment their own bucket — but only for the current
  // window (write to past/future window denied).
  allow create: if request.auth != null && request.auth.uid == uid
              && windowStart == rateLimitWindow()
              && request.resource.data.count == 1;
  allow update: if request.auth != null && request.auth.uid == uid
              && windowStart == rateLimitWindow()
              && request.resource.data.count <= 30  // hard cap
              && request.resource.data.count == resource.data.count + 1; // monotonic
  allow delete: if false;
}

// Then in messages + comments rules — add the predicate:
match /orgs/{orgId}/messages/{msgId} {
  allow create: if inOrg(orgId)
              && request.resource.data.authorId == request.auth.uid
              && rateLimitOk(request.auth.uid);
  // ...
}
```

**Client transaction shape:** Wave 4 ships a `src/data/rate-limit.js` helper that runs a `runTransaction` to (a) increment the counter doc and (b) write the message/comment in the same transaction. If counter would exceed 30, transaction aborts with a translated error message (Pitfall: don't show raw Firebase error).

**Synthetic burst test:** Wave 4 ships `tests/rules/rate-limit.test.js` using `@firebase/rules-unit-testing` — 31 sequential writes from a single uid, asserts writes 1-30 succeed and write 31 denies with `permission-denied`.

**Source:** ARCHITECTURE.md §3 row "rateLimitedChatWrite" alternative + Phase 5 D-17 rateLimits placeholder.

---

### Pattern 5b: Token-Bucket Fallback Callable (FN-09 fallback)

**What:** Cloud Function alternative used **only** when (a) the rules-side predicate hits its 1-`get()` budget against multiple bucket lookups (e.g., per-org rate limit + per-user rate limit composed) or (b) the rate threshold needs to be operator-tunable without a rules redeploy.

**Phase 7 ships the fallback as a documented seam in `functions/src/ratelimit/tokenBucket.ts` but does NOT wire it as the live rate-limit path** — the rules predicate is the live path. Token-bucket exists for future scenarios per ARCHITECTURE.md §3.

```typescript
// functions/src/ratelimit/tokenBucket.ts (Wave 4 — seam only, not live)
import { onCall, HttpsError } from "firebase-functions/v2/https";
// (full standard callable shape per Pattern 1)
// Logic: check + increment Firestore counter doc; HttpsError "resource-exhausted" if exceeded.
```

**Source:** ARCHITECTURE.md §3 row "rateLimitedChatWrite" + Pitfall 4 (cost trap of multi-`get()`).

---

### Pattern 6: Sentry Wrap (FN-03 — server-side error capture)

**What:** Every callable + trigger handler runs inside `withSentry(fn)`. Init Sentry once at module top; the wrapper captures unhandled errors with PII-scrubbed `beforeSend`.

```typescript
// functions/src/shared/sentry.ts (Wave 1)
import * as Sentry from "@sentry/node";
import { logger } from "firebase-functions/logger";

let inited = false;
function init(dsn: string) {
  if (inited) return;
  Sentry.init({
    dsn,
    sendDefaultPii: false,                    // Pitfall 18
    tracesSampleRate: 0.1,
    beforeSend(event) {
      // Scrub well-known PII fields before send (Pitfall 18 #1)
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
      // Strip user-identifying fields from extra context
      if (event.extra && typeof event.extra === "object") {
        for (const k of ["email", "name", "ip"]) {
          if (k in event.extra) delete event.extra[k];
        }
      }
      return event;
    },
  });
  inited = true;
}

export function withSentry<TIn, TOut>(
  handler: (request: TIn) => Promise<TOut>,
): (request: TIn) => Promise<TOut> {
  return async (request) => {
    init(process.env.SENTRY_DSN ?? "");
    try {
      return await handler(request);
    } catch (err) {
      Sentry.captureException(err);
      logger.error("handler.error", { name: (err as Error).name });
      throw err; // re-throw so HttpsError surfaces to caller
    }
  };
}
```

**Caveat:** Phase 7 wires Sentry node only. Browser Sentry wiring (OBS-01..02) is Phase 9. The DSN secret is shared between phases — `SENTRY_DSN` defined here, consumed in Phase 9's `src/observability/sentry.js`.

**Source:** STACK.md §Observability + Pitfall 18.

---

### Pattern 7: Per-Function Service Accounts (FN-04)

**What:** Each Cloud Function runs as its own GCP service account with the minimum IAM roles needed to do its job. **No Function uses the default `<project>@appspot.gserviceaccount.com`.**

**Service-account inventory:**

| Service Account | IAM Roles | Used By | Why Minimal |
|----------------|-----------|---------|-------------|
| `audit-writer-sa@bedeveloped-base-layers.iam.gserviceaccount.com` | `roles/datastore.user` (write to Firestore) | `auditWrite` callable | Only writes `auditLog/`; does not need read |
| `audit-mirror-sa@bedeveloped-base-layers.iam.gserviceaccount.com` | `roles/datastore.user` + `roles/eventarc.eventReceiver` | `onOrgDelete`, `onUserDelete`, `onDocumentDelete` triggers | Trigger-style; needs eventarc receive perm |
| `claims-admin-sa@bedeveloped-base-layers.iam.gserviceaccount.com` | `roles/firebaseauth.admin` + `roles/datastore.user` | `setClaims` callable (Phase 6 hardened in Wave 1) | Auth admin + write `users/{uid}/_pokes/` |
| `auth-blocking-sa@bedeveloped-base-layers.iam.gserviceaccount.com` | `roles/firebaseauth.viewer` + `roles/datastore.viewer` | `beforeUserCreatedHandler`, `beforeUserSignedInHandler` | Read internalAllowlist; no writes |
| `ratelimit-sa@bedeveloped-base-layers.iam.gserviceaccount.com` | `roles/datastore.user` | `tokenBucket` callable (fallback only) | — |
| `csp-sink-sa@bedeveloped-base-layers.iam.gserviceaccount.com` | `roles/logging.logWriter` | `cspReportSink` (Phase 3 — re-deploy in Wave 5) | Cloud Logging writes only; no Firestore |

**Provisioning script:** `scripts/ensure-function-service-accounts/run.js` (Pattern E — one-shot Admin SDK ADC script). Idempotent — checks each SA exists, creates if missing, verifies IAM bindings, removes any extra roles. Operator runs once per environment; CI runs as verification step.

**deployment-time wiring:** Each function declares `serviceAccount: "audit-writer-sa"` in its `onCall` / `onDocumentDeleted` config (per Pattern 1 example).

**Caveat — D-22 ToS gate cascade:** During Phase 6 cutover, `service-<projectNumber>@gcp-sa-firebaseauth.iam.gserviceaccount.com` did not auto-provision because firebaseauth.googleapis.com API was not enabled (ToS-gated). **Phase 7 Wave 5 must verify this SA exists before re-binding `blockingFunctions.triggers` for `beforeUserCreated` + `beforeUserSignedIn`** — see Pattern 9 ToS gate resolution.

**Source:** ARCHITECTURE.md §3 + Pitfall 13.

---

### Pattern 8: Secret Manager via `defineSecret()` (FN-05)

**What:** Every secret is declared via `defineSecret()` and bound to handler config; the runtime reads the value via `process.env.SECRET_NAME` only after the handler is invoked. No secret ever appears in source, in `.env`, or in deployment manifests.

**Secret inventory (Phase 7 introduces):**

| Secret | Used By | How It's Set |
|--------|---------|--------------|
| `SENTRY_DSN` | All callables + triggers (via `withSentry`) | `firebase functions:secrets:set SENTRY_DSN --project bedeveloped-base-layers` |
| `RECAPTCHA_ENTERPRISE_SITE_KEY_PROD` | (Read in Console for App Check enrolment, NOT Function-side) | App Check enrolment is Console-only; not a Function-runtime secret |
| `BIGQUERY_AUDIT_DATASET` | (Read at sink-bootstrap time, not a Function secret) | Cloud Logging sink config; operator-provisioned |

**Sketch:**

```typescript
import { defineSecret } from "firebase-functions/params";

const SENTRY_DSN = defineSecret("SENTRY_DSN");

export const auditWrite = onCall({
  secrets: [SENTRY_DSN],     // declared so Cloud Run loads it at startup
  // ...
}, withSentry(async (request) => {
  // SENTRY_DSN.value() yields the runtime value
  // (init.ts reads via process.env.SENTRY_DSN inside withSentry — see Pattern 6)
}));
```

**Operator-rotation cadence:** SECURITY.md § Phase 7 Audit Index documents quarterly rotation per Pitfall 13.

**Source:** [CITED: https://firebase.google.com/docs/functions/config-env] + Pitfall 13.

---

### Pattern 9: minInstances:1 Reconsider (FN-06) + D-22 ToS Gate Resolution

**What:** Reverses the Phase 6 D-4 stripping of `minInstances: 1` from auth-blocking handlers. **Cost trade-off accepted:** ~$12/mo (2 functions × $6/mo per warm instance) buys cold-start p99 ≤ 4s — well within the 7s Firebase Auth blocking-function deadline (Pitfall 12).

**Wave 5 plan:**

1. **D-22 ToS gate resolution** (operator action — gate to all of Wave 5):
   - Operator visits https://console.cloud.google.com/apis/library/firebaseauth.googleapis.com?project=bedeveloped-base-layers and accepts Firebase Authentication Customer Data Processing Addendum.
   - Verify `gcp-sa-firebaseauth` SA auto-provisions within ~30s (run `gcloud iam service-accounts list | grep firebaseauth`).
   - Rebind `service-<projectNumber>@gcp-sa-firebaseauth.iam.gserviceaccount.com` to `roles/run.invoker` on the 4 Cloud Run services (`beforeusercreatedhandler`, `beforeusersignedinhandler`, `setclaims`, `cspreportsink`).
   - Re-PATCH IdP `blockingFunctions.triggers` to restore `beforeCreate.functionUri` + `beforeSignIn.functionUri` — verified URLs preserved in `06-PREFLIGHT.md ## Cutover Log`.
   - Live-test signin to confirm: a fresh user creation (e.g., scripted second admin) successfully invokes `beforeUserCreated` and lands custom claims.

2. **Re-add `minInstances: 1` to `beforeUserCreated.ts` + `beforeUserSignedIn.ts`** in same Wave 5 commit:

```typescript
export const beforeUserCreatedHandler = beforeUserCreated(
  {
    region: "europe-west2",
    minInstances: 1,                          // FN-06 — restored from Phase 6 D-4 strip
    cpu: 1,
    memory: "256MiB",
  },
  async (event) => { /* ... */ },
);
```

3. **Cold-start measurement:** Wave 5 verifier deploys, then triggers a fresh signin and reads the Cloud Run "container startup time" metric. Records p99 over 10 cold-starts in `runbooks/phase7-cold-start-baseline.md`. **Gate: p99 ≤ 4s.** If above, escalate: increase memory or split logic.

**Fallback if D-22 ToS gate cannot be resolved within Wave 5:** Document the substrate gap in `runbooks/phase-7-cleanup-ledger.md` as carry-forward; ship Phase 7 minus the `beforeUserCreated` minInstances bump (still landed for `setClaims` which is unblocked); flag for Phase 8 or operator follow-through. **This is a degraded posture — `auditLog` Cloud-Logging-only audit trail (sub-tier) covers sign-in events even without `beforeUserSignedIn` claims-side audit, so the audit narrative is not breached.**

**Source:** Pitfall 12 + 06-PREFLIGHT.md ## Cutover Log Substrate Gaps D-22.

---

### Pattern 10: BigQuery Sink for Cloud Logging (AUDIT-03 / AUDIT-06)

**What:** Cloud Logging Data Access logs (Firestore + Storage + Auth) routed to a BigQuery dataset `audit_logs_bq` with partitioned daily tables and 7-year retention.

**Provisioning script:** `scripts/enable-bigquery-audit-sink/run.js` (Pattern E — one-shot Admin SDK + `@google-cloud/bigquery` script).

**What it does:**

1. **Enable Data Access logs** for Firestore + Storage + Auth (these are off by default per [CITED: Cloud Audit Logs overview](https://docs.cloud.google.com/logging/docs/audit)) via the IAM Audit Config admin v1 API.
2. **Create the BigQuery dataset** `audit_logs_bq` in `europe-west2` (matches Firestore region — minimises egress) with `defaultTableExpirationMs: 7y` (220_752_000_000 ms).
3. **Create the log sink** routing filter:
   ```
   logName=~"projects/bedeveloped-base-layers/logs/cloudaudit.googleapis.com%2Fdata_access"
   AND (resource.type="audited_resource"
        OR resource.type="firestore_database"
        OR resource.type="cloud_function"
        OR resource.type="identitytoolkit_project")
   ```
   Routes to BigQuery dataset `audit_logs_bq`.
4. **Configure partitioned table** option (`use_partitioned_tables: true`) so queries scan only relevant days. [CITED: https://docs.cloud.google.com/logging/docs/export/bigquery]
5. **Grant IAM** — only `roles/bigquery.dataViewer` to `internalAllowlist` admin emails on the dataset; no `dataEditor` (the sink is the only writer).

**Verification:**

- After 1 hour, query `bq query --use_legacy_sql=false 'SELECT COUNT(*) FROM \`bedeveloped-base-layers.audit_logs_bq.cloudaudit_googleapis_com_data_access_*\`'` — should return non-zero.
- Phase 7 commits a Wave 5 task evidence row in `runbooks/phase7-bigquery-sink-bootstrap.md`.

**Cost guardrail:** 7y retention at typical Firestore audit-log volume for this app (≤100 internal users, low-frequency) projects to ≤1 GB / year — well within BigQuery free tier (10 GB storage / month) and no scan cost for the milestone-pre-engagement period. **Re-evaluate at engagement re-start.**

**Source:** [CITED: https://docs.cloud.google.com/firestore/native/docs/audit-logging] + [CITED: https://docs.cloud.google.com/logging/docs/export/bigquery] + AUDIT-03 / AUDIT-06.

---

### Pattern 11: firebase-functions-test Integration Coverage (TEST-09)

**What:** TEST-09 lands `firebase-functions-test@3.5.0` integration suite covering the 6 core handlers: `beforeUserCreatedHandler`, `beforeUserSignedInHandler`, `setClaims`, `auditWrite`, `onOrgDelete`, `onUserDelete`. **Phase 6 only unit-tested `claim-builder.ts` (pure logic) per Phase 6 D-?? deferral; Phase 7 closes that gap.**

**Test architecture:**

- **Unit tests** (Vitest, no `firebase-functions-test`): pure-logic seams — `auditEventSchema.unit.test.ts` (Zod parse positive + negative), `idempotency.unit.test.ts` (5-min window), `validateInput.unit.test.ts`.
- **Integration tests** (`firebase-functions-test` offline-mode wrap, no emulator): exercise the wrapped handler with synthesised request objects. Mock `getFirestore()` via Admin SDK init-with-stub-credential; assert side-effect docs match expectations.
- **Optional: Emulator-mode tests** for Firestore-trigger behaviour — if offline-mode mocking is too coarse for the trigger semantics, run `firebase emulators:exec` against `firestore` + `functions` emulators in CI.

**Sketch:**

```typescript
// functions/test/audit/auditWrite.integration.test.ts (Wave 6)
import { beforeAll, afterAll, expect, test, vi } from "vitest";
import functionsTest from "firebase-functions-test";

const t = functionsTest({ projectId: "bedeveloped-base-layers-test" });

afterAll(() => t.cleanup());

test("rejects payload with missing target.id", async () => {
  const wrapped = t.wrap((await import("../../src/audit/auditWrite.js")).auditWrite);
  await expect(wrapped({
    data: { type: "auth.signin.success", target: { type: "user" } /* missing id */, clientReqId: "abc" },
    auth: { uid: "test-uid", token: { email: "a@b.com", role: "admin", orgId: null } },
  })).rejects.toThrow(/invalid-argument/);
});

test("happy path writes auditLog doc", async () => {
  // ... mock getFirestore().doc().set, assert call with correct shape
});

test("idempotency rejects duplicate within 5min window", async () => {
  // ... call twice with same clientReqId, assert second throws "already-exists"
});
```

**CI integration:** `functions/package.json` already has `"test": "vitest run"` script; Wave 6 ensures `npm test --workspace=functions` runs in `.github/workflows/ci.yml` (already does — verify in plan-checker).

**Source:** [CITED: https://firebase.google.com/docs/functions/unit-testing] + Phase 6 D-?? unit-test seam pattern.

---

### Pattern 12: SECURITY.md Phase 7 Audit Index (DOC-10)

**What:** Mirrors Phase 5 / Phase 6 Pattern G — a per-phase audit index appended to `SECURITY.md` mapping each closed control to (1) code path, (2) test path, (3) framework citation, (4) commit SHA.

**Wave 6 deliverable:** `SECURITY.md § Phase 7 Audit Index` with rows for each of FN-01..09, AUDIT-01..04, AUDIT-06..07, TEST-09.

**Required sections (added by Wave 6):**

- **§ Trusted Server Layer** — `auditWrite` callable, mirror triggers, per-function service accounts, secrets-via-defineSecret.
- **§ App Check Enforcement** — reCAPTCHA Enterprise enrolment, staged rollout cadence + dates, debug-token policy.
- **§ Audit Log Retention** — 12 months online (Firestore `auditLog/`) + 7 years archive (BigQuery `audit_logs_bq` partitioned).
- **§ Rate Limiting** — Firestore Rules predicate + token-bucket fallback; threshold 30 writes/60s/user/collection-set.
- **§ Phase 7 Audit Index** — per-control 4-tuple table.

**Source:** Pitfall 19 + Phase 5 / Phase 6 SECURITY.md § Phase X Audit Index precedent.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Input validation | Custom `if (!data.uid) throw` ladders | **Zod** schemas | Auditable, declarative; one source of truth shared between server validation + (eventually) client type guards |
| Idempotency dedup | Custom retry+ignore logic | Idempotency-marker doc with TTL (5min) — `idempotency/{key}` Firestore doc | Standard pattern; survives function restarts; observable |
| App Check enforcement gates | Custom token verification middleware | `enforceAppCheck: true` config | Built-in; integrates with Cloud Functions auth context |
| Per-function IAM | Default `<project>@appspot.gserviceaccount.com` | Per-function service accounts via `serviceAccount: "..."` in handler config | SOC2 baseline; default SA has Editor scope (Pitfall 13) |
| Secrets in env | `process.env.MY_SECRET` from `.env` | `defineSecret()` + Firebase Secret Manager | Audit trail; rotation; never in deployment artifacts (Pitfall 13) |
| Rate limiting via Cloud Function on every write | Custom throttle middleware | Firestore Rules `request.time` predicate against bucket doc | Zero per-write Cloud Function cost; no cold-start latency hit |
| Audit log immutability | Custom hash chain / blockchain anchor | Rules `allow write: if false` + Cloud Logging Data Access → BigQuery sink | Cloud Logging is append-only and immutable by IAM; BigQuery sink adds 7y retention without custom crypto |
| BigQuery sink schema | Custom JSON-to-BQ ETL | `use_partitioned_tables: true` log-sink config | Cloud Logging emits proto-defined schema; partitioning is a sink flag |
| Sentry node setup | Manual error-handling middleware on every callable | `withSentry(handler)` wrapper + `beforeSend` PII scrubber | Pitfall 18 — defaults are PII-leaky; centralise the scrub once |
| Cold-start mitigation for blocking handlers | Self-pinging the function every 5min | `minInstances: 1` config | Built-in; ~$6/mo per warm instance buys p99 ≤ 4s |
| App Check token attachment | Custom HTTP interceptor | `@firebase/app-check` SDK with `isTokenAutoRefreshEnabled: true` | Auto-refreshes; attaches to every Firestore/Auth/Functions/Storage call |
| Mirror-trigger dedup | Always write mirror; deduplicate in BigQuery query | Check primary auditLog within 60s window before mirror write | Avoids storage cost / noise; primary is source of truth |

**Key insight:** Every "do it yourself" alternative above has a specific Pitfall in `.planning/research/PITFALLS.md` documenting the failure mode. Phase 7 is dense with library + platform features that exist precisely to handle these patterns — **the Phase 7 reviewer's job is to verify nothing was hand-rolled, not to verify the hand-rolled thing was done correctly.**

---

## Common Pitfalls

### Pitfall 1: Locking Out Production by Forgetting App Check Debug Tokens (Pitfall 8 manifestation)

**What goes wrong:** Wave 3 enrols App Check; operator forgets to register debug tokens for CI / local dev / staging clones; Wave 4's rate-limit synthetic burst test in CI starts failing with `appCheck/fetch-network-error` — and the diagnosis takes hours.

**Why it happens:** Phase 7 Wave 3 ships the App Check enrolment to production but the rest of the engineering surface (CI, local emulator, staging, scratch projects) needs debug tokens too — and tokens are per-environment.

**How to avoid:**
1. Wave 3 task list explicitly includes "register debug tokens for: (a) Vite dev server localhost:5178, (b) GitHub Actions CI runners, (c) any staging clone of the project". Each gets its own token via Firebase Console → App Check → Apps → Manage debug tokens.
2. Tokens stored in `.env.local` (gitignored — verified by `git log -p .env.local`) and CI repo secret (`APPCHECK_DEBUG_TOKEN_CI`).
3. Wave 3 documentation in `docs/operator/phase-7-app-check-rollout.md` includes a "before enabling enforcement" checklist.

**Warning signs:**
- App Check dashboard shows >5% "unverified" requests for >24h after enrolment.
- CI test runs hitting real Firebase fail with App Check token errors.
- "Refused to connect" / `appCheck/fetch-network-error` in any environment.

---

### Pitfall 2: Custom Claims Stale After Phase 7 Hardening of `setClaims` (Pitfall 6 manifestation)

**What goes wrong:** Phase 7 Wave 1 hardens `setClaims` with App Check + Zod + idempotency. The poke pattern (write to `users/{uid}/_pokes/{ts}`) is preserved but a new code path slips through where the client doesn't subscribe to its own `_pokes` collection — claims propagation lag returns. User sees "no access" for up to 1h.

**Why it happens:** Hardening callable involves changes to handler config + body; the orchestrator focused on input validation and forgets the poke side-effect was load-bearing for client-observable claim refresh.

**How to avoid:**
1. Wave 1 hardening task explicitly preserves the poke-pattern `_pokes` write — Pattern 1 example shows it in the body.
2. TEST-09 integration test asserts `users/{uid}/_pokes/<ts>` doc is written on every `setClaims` invocation.
3. Browser-side `users/{uid}/_pokes/{*}` subscription is a sub-wave 6.1 deliverable; Phase 7 does NOT introduce it but verifies via integration test that the substrate is sound.

---

### Pitfall 3: Audit Log Written from Client (Pitfall 17 — fundamental)

**What goes wrong:** Wave 6 wires `src/cloud/audit.js` body — orchestrator implements convenience helper that batches multiple events client-side and skips the `auditWrite` callable for "logging-purposes" events (e.g., "user clicked X"). Forgeable, deletable, gross.

**Why it happens:** Path of least resistance; engineering instinct to "log everything" pulls toward client-side writes for telemetry-style events.

**How to avoid:**
1. **Rules `allow write: if false` on `auditLog/{eventId}`** is the structural defence — Phase 5 already shipped this (`firestore.rules:115`).
2. Wave 6 `src/cloud/audit.js` body is **strictly** `httpsCallable(functions, "auditWrite")` — no batching, no client-side staging.
3. Wave 6 rules-unit-test cell: synthesises a non-Admin-SDK auth context and asserts `addDoc(collection(db, "auditLog"), ...)` returns `permission-denied`. Already exists from Phase 5; verify still green after rate-limit-predicate addition.
4. Audited-user-cannot-read-own pinned by rules-unit-test (AUDIT-07) — Wave 4 cell synthesises an internal user and asserts read of `auditLog` where `actor.uid == own uid` is denied.

---

### Pitfall 4: Phase 6 D-22 ToS Gate Cascades Into Phase 7 Wave 5

**What goes wrong:** Wave 5 plan assumes `beforeUserCreated` blocking-handler invocation works (so `minInstances: 1` re-add lands cleanly). Reality: D-22 still unresolved at Wave 5 start; re-binding `minInstances: 1` produces no observable benefit because the handler is never invoked.

**Why it happens:** D-22 is operator-paced (requires Console click + ToS acceptance). Phase 7 plan must NOT assume D-22 is resolved by phase start — it's the same risk class as Phase 6's "operator-paced first signin" cascade.

**How to avoid:**
1. Wave 5 first task is **"verify D-22 resolution status"** — runs `gcloud iam service-accounts list | grep firebaseauth` and `gcloud services list | grep firebaseauth.googleapis.com`. If unresolved, escalate; if resolved, proceed.
2. Wave 5 plan branches: **resolved** → restore `minInstances: 1` + `blockingFunctions.triggers` + cold-start measurement. **Unresolved** → ship `setClaims` hardening only; carry-forward `beforeUserCreated`/`beforeUserSignedIn` minInstances + invocation-restoration to a sub-wave 7.1 row in `runbooks/phase-7-cleanup-ledger.md`.
3. **Phase 7 close gate (Wave 6) does NOT block on D-22 resolution** — substrate-honest documentation per Pitfall 19; mirrors Phase 6 sub-wave 6.1 carry-forward pattern.

---

### Pitfall 5: BigQuery Sink Region Mismatch with Firestore

**What goes wrong:** Operator provisions `audit_logs_bq` in `us-central1` (BigQuery default) while Firestore is `europe-west2`. Cross-region log routing introduces egress cost + GDPR data-residency complications.

**Why it happens:** Cloud Console BigQuery dataset creation defaults to multi-region `US`; not always obvious to specify region.

**How to avoid:**
1. `scripts/enable-bigquery-audit-sink/run.js` Pattern E script creates dataset with `location: "europe-west2"` explicitly.
2. Wave 5 operator runbook includes pre-flight verification: `bq show --location=europe-west2 audit_logs_bq` returns the dataset; if not, escalate before sink config.
3. PRIVACY.md (Phase 11) documents region.

---

### Pitfall 6: Idempotency Marker Doc Becomes a Hot Spot

**What goes wrong:** Wave 1 ships `idempotency/{key}` doc pattern with 5-min TTL. Under burst (e.g., user spam-clicks "Save"), every callable creates a marker doc — Firestore index on `at` for TTL pruning becomes a hot spot.

**Why it happens:** Idempotency markers are write-heavy (1 per callable invocation); naive shape (`idempotency/{key}` flat collection) produces append-throughput hotspot per [Firestore best practices](https://firebase.google.com/docs/firestore/best-practices).

**How to avoid:**
1. Use the existing 5-min window pattern but **shard by hash of the key**: `idempotency/{shard}/keys/{key}` where `shard = key.slice(0, 2)` (256 shards).
2. TTL handled by **scheduled function `idempotencyCleanup`** running every 10 minutes — deletes docs where `at < now() - 5min`. Cheaper than a Firestore TTL index for 5-min lifetime.
3. Alternative: skip Firestore — use **in-memory Map in the function instance**. Trade-off: doesn't survive restarts, but with `minInstances: 0` non-blocking callables, the cold-start displaces the cache anyway. **Recommend Firestore-backed for auditability.**

---

### Pitfall 7: Mirror Trigger Stampede on Bulk Delete

**What goes wrong:** Phase 8 ships GDPR `gdprEraseUser` callable; deletes 1,000 docs across collections; mirror triggers fire 1,000× and write 1,000 mirror audit entries. BigQuery sink ingests 1,000 entries; Firestore audit collection grows by 1,000.

**Why it happens:** Mirror triggers fire per-doc-delete; bulk operations multiply.

**How to avoid:**
1. Mirror triggers check for "primary audit event with same target.id within 60s window" — Pattern 4b sketch already shows this. Bulk deletes write a single primary `compliance.erase.user` event (not per-doc), so the per-doc mirror triggers all skip.
2. Phase 8's `gdprEraseUser` Wave plan must include the audit-event-batch pattern: write one summary `compliance.erase.user` event with payload `{deletedDocCount: 1000}` ONCE, then perform the deletes.
3. Mirror triggers are **only** wired for `onOrgDelete`, `onUserDelete`, `onDocumentDelete` — not `messages`, `comments`, `actions`, `responses` (high-volume normal-operation deletes — out of scope for mirror coverage anyway).

---

### Pitfall 8: cspReportSink Accidentally Drops on Wave 5 Functions Deploy

**What goes wrong:** Wave 5 Cloud Functions deploy includes 6 new functions; CI deploy with `--only functions` redeploys all functions in the workspace including `cspReportSink`. Either (a) the redeploy succeeds but resets the manual `gcp-sa-identitytoolkit` invoker binding (Phase 6 D-7 cascade) and breaks the CSP endpoint, OR (b) the deploy partial-fails and the live function is in an inconsistent state.

**Why it happens:** Functions deploys are workspace-wide; CI `--only functions` is the existing pattern; manual invoker bindings get wiped on every deploy (Phase 6 D-21).

**How to avoid:**
1. Wave 5 deploy step uses **selective deploy**: `firebase deploy --only functions:auditWrite,functions:onOrgDelete,...` — explicit list rather than blanket `--only functions`. (Functions API supports comma-separated deploy targets.)
2. Wave 5 verifier task includes "verify cspReportSink still responds 204 on synthetic POST" + "verify gcp-sa-identitytoolkit invoker binding still present on cspReportSink" — closes Phase 6 D-21 substrate.
3. Operator-side `firebase deploy --only functions` from local CLI for any urgent Phase 7 redeploy (per Phase 6 D-18).

---

## Wave Structure Recommendation

**6 waves, dependency-driven.** Mirrors Phase 5 + Phase 6 6-wave shape; matches the Phase 7 success criterion granularity.

| Wave | Goal | Requirements | Wave Gate |
|------|------|--------------|-----------|
| **Wave 1** — Shared infrastructure (tests-first seams) | Land Zod schemas + idempotency helper + Sentry init + service-account provisioning script + callable wrapper patterns. **All pure logic — unit-tested before Wave 2 wires them.** Hardens Phase 6 `setClaims` with App Check + Zod + idempotency in same wave. | FN-02 (bump deps), FN-03 (callable shape), FN-04 (per-fn SAs — script + first 3 SAs), FN-05 (defineSecret SENTRY_DSN), AUDIT-02 (event schema) | Vitest unit tests for schemas + idempotency + validateInput green; `scripts/ensure-function-service-accounts/run.js` runs idempotently against project; `setClaims` hardened |
| **Wave 2** — Audit-log writers (callable + mirrors) | Land `auditWrite` callable; 3 Firestore-trigger mirror writers (`onOrgDelete`, `onUserDelete`, `onDocumentDelete`); rules-unit-test for AUDIT-07 (audited user can't read own) | FN-03, AUDIT-01, AUDIT-04, AUDIT-07 | All 4 functions deployed in europe-west2; rules-unit-test cell green; `firebase deploy --only functions:auditWrite,...` succeeds |
| **Wave 3** — App Check enrolment + production soak start | reCAPTCHA Enterprise enrolment; per-env site keys; `src/firebase/check.js` body fill; debug tokens to `.env.local`; quota alert at 70% configured; **leave enforcement OFF for ≥7-day soak**; operator runbook authored | FN-07, FN-08 (Stages A + B + C of staged rollout) | App Check dashboard shows ≥95% verified after 24h; production soak gate opens (operator-paced 7-day window) |
| **Wave 4** — Rate limiting (rules predicate + fallback seam) | Replace `rateLimits/` placeholder block in `firestore.rules` with FN-09 predicate; ship `src/data/rate-limit.js` transaction helper for atomic increment-and-write; `tokenBucket` callable as fallback seam (deployed but not live-wired); rules-unit-test 31-write burst | FN-09 | rules-unit-test green; production rules deploy lands; synthetic burst from staging clone confirms 31st write denies |
| **Wave 5** — D-22 ToS gate resolution + minInstances + BigQuery sink | Operator gate: D-22 ToS acceptance verification; restore `minInstances: 1` on auth-blocking handlers; cold-start p99 ≤ 4s baseline measurement; provision BigQuery sink + 7y retention via `scripts/enable-bigquery-audit-sink/run.js`; cspReportSink redeploy verification | FN-06, AUDIT-03, AUDIT-06 | D-22 either resolved (`gcp-sa-firebaseauth` SA exists) or carry-forward documented; cold-start p99 metric recorded; BigQuery sink confirmed via `bq query` returning entries within 1h |
| **Wave 6** — Cleanup + DOC-10 + TEST-09 + close-out | `src/cloud/audit.js` + `src/cloud/retry.js` body fills; firebase-functions-test integration coverage of all 6 handlers (TEST-09); SECURITY.md § Phase 7 Audit Index appended; `runbooks/phase-7-cleanup-ledger.md` zero-out gate; carry-forward rows queued for Phase 8 / Phase 9 / sub-wave 6.1 / sub-wave 7.1; human-verify checkpoint | TEST-09, DOC-10 | All TEST-09 integration tests green; SECURITY.md Audit Index has 4-tuple rows for FN-01..09 + AUDIT-01..04 + AUDIT-06..07; cleanup-ledger active rows: 0 |

**Wave dependency graph:**

```
Wave 1 (shared infra) ──► Wave 2 (auditWrite + mirrors) ──┐
                                                          ├─► Wave 6 (close-out)
Wave 3 (App Check enrol — 7d soak) ──────────────────────┤
                                                          │
Wave 4 (rate-limit predicate) ───────────────────────────┤
                                                          │
Wave 5 (D-22 + minInstances + BigQuery sink) ────────────┘
```

**Parallelism opportunities:** Waves 2, 3, 4, 5 can run in parallel after Wave 1 lands (no shared file boundaries). Per `parallelization: true` config, the executor can pick up Wave 3 + Wave 4 simultaneously.

**Substrate-honest variants:**
- If D-22 ToS gate is unresolved at Wave 5 start: Wave 5 ships `setClaims` minInstances + BigQuery sink only; substrates `minInstances` for auth-blocking handlers as carry-forward. Phase 7 still closes via Wave 6.
- If 7-day soak window for App Check is shorter than calendar Wave 3 → Wave 5 gap: Wave 6 close gate explicitly defers Stages D-F (per-service enforcement) to a `07-HUMAN-UAT.md` operator-execution batch — same shape as Phase 3 / Phase 5 deferred-operator-execution pattern.

---

## Code Examples

Verified patterns from existing Phase 3 + Phase 6 code, scaled to Phase 7 needs:

### Idempotency Marker Helper (Wave 1)

```typescript
// functions/src/shared/idempotency.ts
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

/**
 * Ensure a callable is idempotent over a sliding window.
 * Throws HttpsError("already-exists") if the same key was seen within windowSec.
 */
export async function ensureIdempotent(
  key: string,
  scope: string,
  windowSec: number,
): Promise<void> {
  // Shard by first 2 chars of key — avoids hot-spot per Pitfall 6
  const shard = key.slice(0, 2).padEnd(2, "0");
  const ref = getFirestore().doc(`idempotency/${shard}/keys/${key}`);
  const snap = await ref.get();
  if (snap.exists) {
    const at = snap.get("at");
    const ageMs = at ? Date.now() - at.toMillis() : 0;
    if (ageMs < windowSec * 1000) {
      throw new HttpsError("already-exists", `Duplicate request (${scope})`);
    }
  }
  await ref.set({ scope, at: FieldValue.serverTimestamp() });
}
```

### Validate Input Helper (Wave 1)

```typescript
// functions/src/shared/validateInput.ts
import { HttpsError } from "firebase-functions/v2/https";
import { z, ZodError, ZodTypeAny } from "zod";

export function validateInput<S extends ZodTypeAny>(
  schema: S,
  input: unknown,
): z.infer<S> {
  try {
    return schema.parse(input);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new HttpsError(
        "invalid-argument",
        `Validation failed: ${err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
      );
    }
    throw new HttpsError("invalid-argument", "Validation failed");
  }
}
```

### `src/cloud/audit.js` Body Fill (Wave 6 — `src/`)

```javascript
// src/cloud/audit.js (Wave 6)
// @ts-check
// Phase 7 (FN-04 / AUDIT-01) body fill — wires through src/firebase/functions.js.
import { functions, httpsCallable } from "../firebase/functions.js";
import { withRetry } from "./retry.js";

const auditWriteCallable = httpsCallable(functions, "auditWrite");

/**
 * @param {{ event: string, payload?: any }} input
 * @returns {Promise<void>}
 */
export async function writeAuditEvent(input) {
  // clientReqId mandatory for idempotency (FN-03)
  const clientReqId = crypto.randomUUID();
  await withRetry(
    () => auditWriteCallable({ ...input, clientReqId }),
    { retries: 3, baseMs: 250 },
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 1st-gen Cloud Functions + `functions.config()` | 2nd-gen + `defineSecret()` | March 2027 decommission of `functions.config()` | Already adopted in Phase 3 + Phase 6 |
| reCAPTCHA v3 for App Check | reCAPTCHA Enterprise | Firebase docs explicitly recommend Enterprise for new integrations 2024+ | Phase 7 adopts directly |
| Custom validation logic per callable | Zod schemas | 2026 ecosystem default | Phase 7 introduces Zod uniformly |
| Default `<project>@appspot.gserviceaccount.com` | Per-function service accounts | SOC2 baseline | Phase 7 introduces 6 SAs |
| Single sink for client + Functions Sentry projects | Browser-only Sentry (Phase 9) + Server-only Sentry (Phase 7) — same DSN, separate releases | Phase 9 ships browser; Phase 7 ships server | Source-map upload separated by release tag |
| Audit-log retention via single Firestore collection | Two-tier: `auditLog/` Firestore (12mo online) + Cloud Logging → BigQuery (7y archive) | ARCHITECTURE.md §5 prescription | Closes the "infra-tier audit log" SOC2 expectation |

**Deprecated/outdated:**
- 1st-gen blocking functions: only useful if D-22 ToS gate cannot be resolved AND Phase 7 cannot tolerate the carry-forward; otherwise stick with 2nd-gen.
- Plain SHA-256 password hashing: never reintroduce (C2 root cause).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | reCAPTCHA Enterprise free quota (10k assessments/month) is sufficient for projected chat volume between engagements + early post-engagement-restart | Pattern 2 + STACK.md | Low — milestone is between engagements; quota alert at 70% catches before lockout |
| A2 | BigQuery sink at 7y retention with this app's audit-log volume costs ≤ $5/month at peak | Pattern 10 cost guardrail | Low — reviewable during Wave 5 sink-bootstrap; sink can be recreated with shorter retention if cost surprises |
| A3 | `minInstances: 1` on `beforeUserCreated` + `beforeUserSignedIn` costs ~$12/mo total | Pattern 9 | Low — confirmed via Cloud Run pricing page during Wave 5 |
| A4 | `firebase-functions-test@3.5.0` works against firebase-functions@7.2.5 with no compat issue | Pattern 11 | Low — same major version line; if breaks, fall back to emulator-mode tests via `firebase emulators:exec` |
| A5 | Rate-limit threshold of 30 writes/60s is conservative-but-not-disruptive for chat use-case | Pattern 5 | Low — adjustable in rules without redeploy of code; widening cap costs nothing |
| A6 | The mirror-trigger 60-second dedup window is sufficient to avoid stampede on bulk delete | Pattern 4b + Pitfall 7 | Medium — if the GDPR erase Phase 8 implementation chooses sub-60s parallelism, mirror triggers may double-fire; verify in Phase 8 with dedicated test |
| A7 | D-22 ToS gate resolution succeeds within Wave 5 operator window | Pattern 9 | Medium — if operator cannot accept ToS in Wave 5, carry-forward path is documented per Pitfall 4 |
| A8 | Audited user reading their own audit records is denied by `allow read: if isAdmin();` rule (already deployed Phase 5) — non-admin internal users also denied | AUDIT-07 | Low — verify in Wave 2 rules-unit-test; if rule allows non-admin internal read, tighten to `isAdmin()`-only or add explicit clause |

**These assumptions need user confirmation if they are load-bearing for plans:** A1 (App Check quota), A6 (mirror-trigger dedup window for Phase 8 GDPR cascade), A7 (D-22 operator timing).

---

## Open Questions

1. **App Check production soak window calendar timing**
   - What we know: ≥7 days of unenforced soak is the documented bar.
   - What's unclear: whether Phase 7 wave timing accommodates a 7-day calendar wall, or whether stages D-F (per-service enforcement) are deferred to operator-execution batch in `07-HUMAN-UAT.md`.
   - **Recommendation:** Wave 6 close gate accepts deferred Stages D-F into `07-HUMAN-UAT.md` mirroring Phase 3 / Phase 5 patterns. Operator runs the staged rollout per their schedule; Phase 8 can begin in parallel since per-service enforcement doesn't gate downstream phases.

2. **BigQuery dataset region — `europe-west2` vs multi-region**
   - What we know: Firestore is `europe-west2`; egress minimisation favours co-location.
   - What's unclear: whether Firebase project billing has any reservation against single-region BQ datasets vs multi-region default.
   - **Recommendation:** Use `europe-west2` to match Firestore; single-region BQ is fine for this volume. Operator-confirm in Wave 5 task.

3. **Rate-limit threshold — 30 writes/60s**
   - What we know: arbitrary chosen as "30 messages/min seems generous for typical SaaS chat".
   - What's unclear: whether BeDeveloped consultancy use-case has bursts (e.g., paste-from-clipboard of multiple comment items in a short window).
   - **Recommendation:** Ship 30/60s; document in SECURITY.md as adjustable; flag for revisit at engagement re-start (mirror pattern of Phase 6 STATE.md "reCAPTCHA Enterprise quota for projected chat volume" outstanding todo).

4. **D-22 ToS gate operator timeline**
   - What we know: D-22 is a Console click + ToS acceptance; not blocked by anything technical.
   - What's unclear: when operator can sit down at the Console; the previous attempt during Phase 6 cutover hit "Failed to load" on multiple browser/network combinations.
   - **Recommendation:** Wave 5 first task is "verify D-22 status"; Plan branches: resolved → full Wave 5; unresolved → reduced Wave 5 (setClaims minInstances + BigQuery sink) + carry-forward.

5. **`minInstances: 1` cost commitment**
   - What we know: $12/mo is the documented marginal cost for two warm instances.
   - What's unclear: whether the operator wants this cost permanent or only during cutover-sensitive window.
   - **Recommendation:** Default to permanent for compliance posture (Pitfall 12); flag as adjustable in SECURITY.md § Phase 7 Audit Index.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 22 runtime | functions/ workspace | ✓ | 22.10.5 (verified `functions/package.json`) | — |
| `firebase-tools` CLI | Wave 2 / Wave 5 deploys | ✓ | 15.16.0 (root `package.json`) | — |
| `gcloud` CLI | D-22 verify + service-account provisioning | ✓ | Operator path: `/c/Users/hughd/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd` (per Phase 6 PREFLIGHT) | — |
| Firebase Console access | App Check enrolment, D-22 ToS, BigQuery sink wiring | ✓ | Operator (business@bedeveloped.com) | — |
| `bq` CLI (BigQuery) | Wave 5 sink-bootstrap verification | [ASSUMED ✓] | Bundled with `gcloud` | Use `gcloud alpha bq` if `bq` not installed |
| reCAPTCHA Enterprise quota | Wave 3 enrolment | ✓ (10k/mo free tier) | — | If quota insufficient: Phase 11 escalation; not Phase 7 blocker |
| BigQuery free-tier storage | Wave 5 sink | ✓ (10GB/mo free) | — | If volume exceeds: Phase 11 escalation |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — all flagged dependencies are available; `bq` CLI is the only ambiguous one and has documented fallback.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 (matches Phase 1 + Phase 6 substrate) |
| Config file | `functions/vitest.config.ts` (already exists from Phase 6); add `firebase-functions-test` setup for integration tier |
| Quick run command | `cd functions && npm test` (offline / mocked tier — runs in <30s) |
| Full suite command | `cd functions && npm test -- --coverage` + root `npm run test:rules` (rules-unit-tests for FN-09 + AUDIT-07) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FN-03 | Callable rejects payload with missing required Zod field | unit | `cd functions && npm test -- shared/validateInput.unit` | ❌ Wave 1 |
| FN-03 | Callable rejects duplicate request within 5min idempotency window | integration | `cd functions && npm test -- shared/idempotency.unit` + `audit/auditWrite.integration` | ❌ Wave 1 + Wave 6 |
| FN-03 | Callable enforces App Check (rejects unauthenticated request) | integration | `cd functions && npm test -- audit/auditWrite.integration` | ❌ Wave 6 |
| FN-04 | Each function has its own service account | manual | `gcloud iam service-accounts list --project bedeveloped-base-layers` returns the 6 SAs | ❌ Wave 1 (script) + Wave 5 (verify) |
| FN-05 | Secrets accessed via `defineSecret()` (no `process.env` reads outside withSentry) | static | `grep -r "process.env" functions/src/` returns only `withSentry` | ❌ Wave 1 grep gate |
| FN-06 | Auth-blocking handlers cold-start p99 ≤ 4s | manual / script | Wave 5 task — 10 cold-start measurements via `gcloud run services describe` | ❌ Wave 5 |
| FN-07 | App Check `enforceAppCheck: true` set on every Phase 7 callable | static | `grep -r "enforceAppCheck" functions/src/audit functions/src/auth functions/src/ratelimit` | ❌ Wave 6 grep gate |
| FN-09 | Firestore rules deny 31st write in 60-second window | rules-unit-test | `npm run test:rules -- rate-limit.test.js` | ❌ Wave 4 |
| AUDIT-01 | Client cannot write to `auditLog` even with valid auth | rules-unit-test | already exists from Phase 5 — verify still green; `npm run test:rules` | ✅ Phase 5 (re-run) |
| AUDIT-04 | `onOrgDelete` writes mirror entry on org doc deletion | integration | `cd functions && npm test -- audit/triggers/onOrgDelete.integration` | ❌ Wave 6 |
| AUDIT-04 | Mirror trigger skips if primary `auditWrite` event exists within 60s | integration | `cd functions && npm test -- audit/triggers/onOrgDelete.integration` | ❌ Wave 6 |
| AUDIT-07 | Internal user cannot read audit records about themselves | rules-unit-test | `npm run test:rules -- audit-log.test.js` | ❌ Wave 2 |
| TEST-09 | All callables have at least one happy-path + one rejection test | integration | `cd functions && npm test -- --coverage` — 80% coverage gate on `functions/src/` | ❌ Wave 6 |

### Sampling Rate

- **Per task commit:** `cd functions && npm test` (Vitest unit + integration offline-mode — runs in <30s)
- **Per wave merge:** `cd functions && npm test -- --coverage` + root `npm run test:rules`
- **Phase gate:** Full suite green + functions coverage ≥80% before `/gsd-verify-work 7`

### Wave 0 Gaps

- [ ] `functions/src/shared/idempotency.ts` + tests — Wave 1
- [ ] `functions/src/shared/validateInput.ts` + tests — Wave 1
- [ ] `functions/src/shared/sentry.ts` + tests — Wave 1
- [ ] `functions/src/audit/auditEventSchema.ts` + tests — Wave 1
- [ ] `functions/test/audit/auditWrite.integration.test.ts` — Wave 6
- [ ] `functions/test/audit/triggers/onOrgDelete.integration.test.ts` — Wave 6
- [ ] `tests/rules/rate-limit.test.js` — Wave 4 (uses `@firebase/rules-unit-testing` already installed)
- [ ] `tests/rules/audit-log.test.js` (AUDIT-07 audited-user-cannot-read pinning) — Wave 2
- [ ] Framework install: `cd functions && npm install -D firebase-functions-test@3.5.0 zod@4.4.3 @sentry/node@10.52.0` — Wave 1

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Phase 6 substrate (Email/Password + MFA + custom claims) — Phase 7 hardens claims-mutation surface (`setClaims` callable) |
| V3 Session Management | yes (indirect) | Token-refresh poke pattern preserved; `setClaims` write to `users/{uid}/_pokes/{ts}` triggers client `getIdToken(true)` |
| V4 Access Control | yes | Custom claims + Firestore Rules + per-function IAM service accounts; `auditLog/` write-deny enforced; rate-limit predicate adds throttling layer |
| V5 Input Validation | yes | **Zod** schemas on every callable (FN-03) |
| V6 Cryptography | no | No application-level crypto introduced; relies on Firebase Auth + Cloud Functions IAM-managed identity |
| V7 Error Handling & Logging | yes | Structured Cloud Logging + Sentry node + audit-log Firestore + BigQuery sink — defence-in-depth observability |
| V8 Data Protection | yes | Audit-log retention (12mo online + 7y archive); per-function SAs prevent unintended-data-access blast |
| V9 Comms | yes | App Check + reCAPTCHA Enterprise binds clients to legitimate app instances; HTTPS-only via Cloud Functions Gen 2 default |
| V10 Malicious Code | partial | Sentry monitoring catches injection-introduced exception patterns; not a primary V10 control |
| V11 Business Logic | yes | Idempotency markers prevent replay attacks; rate-limiting prevents spam abuse |
| V12 Files & Resources | no | Storage Rules already cover this from Phase 5; Phase 7 doesn't introduce new file-handling code paths |
| V13 API & Web Service | yes | Every callable has uniform shape (App Check + Zod + idempotency + Sentry + per-fn SA) |
| V14 Configuration | yes | Secrets via `defineSecret()` only (FN-05); no env vars; per-env App Check site keys |

### Known Threat Patterns for Firebase Cloud Functions + App Check

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged audit log entry from compromised client | Tampering | Rules `allow write: if false` on `auditLog/`; Admin SDK only path; rules-unit-test pinned |
| Audited user attempts to read their own log to time next action | Information Disclosure | Rules `allow read: if isAdmin()` only; AUDIT-07 unit test |
| Replay attack on `auditWrite` callable | Repudiation | Idempotency-marker doc with 5-min window; (actor:type:target:clientReqId) key |
| Cold-start latency causes `beforeUserCreated` 7s timeout → user creation fails intermittently | Denial of Service | `minInstances: 1` (FN-06) — Pitfall 12 |
| App Check enforcement turned on too fast → legitimate clients locked out | Denial of Service | 7-day soak before per-service stage rollout (FN-08); per-service rollback path |
| Compromised single Cloud Function exfiltrates all data | Elevation of Privilege | Per-function service accounts (FN-04) — blast radius limited to one function's IAM scope |
| Secret leaked via Cloud Console / function logs | Information Disclosure | `defineSecret()` (FN-05); never log secrets (Pitfall 13 review checklist) |
| Bulk delete cascade triggers stampede of mirror audit events | Denial of Service | 60-second dedup window in mirror triggers (Pattern 4b); GDPR erase summary-event pattern (Pitfall 7) |
| Rate-limit bypass via writing to past/future window doc | Tampering | Rules predicate enforces `windowStart == rateLimitWindow()` (Pattern 5) |

---

## Project Constraints (from CLAUDE.md)

The following CLAUDE.md directives apply to Phase 7:

- **Stay on Firebase, no Vercel + Supabase migration.** Phase 7's Cloud Functions + App Check are first-class Firebase products — no contradiction.
- **Stay on vanilla JS for `src/`.** Phase 7 Wave 6 body fills (`src/cloud/audit.js`, `src/cloud/retry.js`, `src/firebase/check.js`) MUST be JS with `// @ts-check` + JSDoc — no `.ts` files outside `functions/`.
- **No backwards-compatibility window.** Wave 5 `cspReportSink` redeploy is acceptable as a clean re-deploy.
- **Compliance bar: credible, not certified.** Phase 7 Audit Index uses "credible" / "on track for" framing; never "compliant" or "certified" (Pitfall 19).
- **Conventional Commits.** Wave commits use `feat(07-N):` / `fix(07-N):` / `docs(07-N):` / `test(07-N):` prefixes.
- **`.planning/` is committed (per config).** Wave 6 commits SECURITY.md updates + `runbooks/phase-7-cleanup-ledger.md` per `commit_docs: true`.
- **No emojis in commit messages or source unless asked.**
- **Source layout target:** Phase 7 reinforces — `cloud/*` is the wrapper layer; `firebase/*` is the SDK adapter; `domain/*` stays Firebase-import-free; lint-enforced.
- **Sequencing non-negotiable #2** (Rules committed-and-tested early; deployed only after Auth is live): Wave 4's `rateLimits/` predicate replacement IS a rules redeploy — Phase 6 has already deployed strict rules + Auth is live, so the sequencing constraint is honoured. Wave 4 redeploy is a tightening of an already-strict ruleset, not the load-bearing cutover.

---

## Sources

### Primary (HIGH confidence)

- npm registry verifications (run 2026-05-09):
  - `firebase-functions@7.2.5`
  - `firebase-admin@13.9.0` (bumped from 13.8.0)
  - `zod@4.4.3`
  - `@sentry/node@10.52.0`
  - `firebase-functions-test@3.5.0`
- [Firebase docs — App Check enrolment with reCAPTCHA Enterprise](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider) — verified provider name + site-key shape
- [Firebase docs — Enable App Check enforcement (staged-rollout language)](https://firebase.google.com/docs/app-check/enable-enforcement) — verified 7-day soak language + per-service enforcement
- [Firebase docs — App Check for Cloud Functions (`enforceAppCheck` config)](https://firebase.google.com/docs/app-check/cloud-functions) — verified callable surface
- [Firebase docs — Configure custom claims (Identity Platform / Pitfall 6 propagation)](https://cloud.google.com/identity-platform/docs/how-to-configure-custom-claims) — 1KB claim payload constraint
- [Cloud Logging docs — Audit Logs overview](https://docs.cloud.google.com/logging/docs/audit) — Data Access logs disabled by default
- [Cloud Logging docs — Route to BigQuery](https://docs.cloud.google.com/logging/docs/export/bigquery) — partitioned-tables flag and retention model
- [Firestore audit logging](https://docs.cloud.google.com/firestore/native/docs/audit-logging) — exact log filter shape
- `functions/src/csp/cspReportSink.ts` — Phase 3 callable shape pattern (region, content-type allowlist, body cap)
- `functions/src/auth/{beforeUserCreated,beforeUserSignedIn,setClaims}.ts` — Phase 6 callable + blocking patterns
- `functions/src/auth/claim-builder.ts` — Phase 6 pure-logic test seam pattern (TEST-09 substrate)
- `firestore.rules` — current claims-based predicates + `auditLog`/`rateLimits` placeholders Phase 7 fills
- `runbooks/phase-6-cleanup-ledger.md` — Phase 7 forward-tracking rows (FN-01+AUDIT-01..04, FN-09 rate-limit, FN-03+FN-07 + TEST-09)
- `06-PREFLIGHT.md ## Cutover Log` — Substrate Gaps D-13..D-28 (D-22 ToS gate, cspReportSink redeploy, minInstances reconsider)
- `.planning/research/ARCHITECTURE.md §3 + §5` — Cloud Functions enumeration + audit-log architecture
- `.planning/research/PITFALLS.md` — Pitfalls 4, 8, 12, 13, 17, 18, 19 directly informed Phase 7 patterns
- `.planning/research/STACK.md` — verified 2026 versions baseline (firebase-admin 13.8.0 → 13.9.0; firebase-functions 7.2.5; reCAPTCHA Enterprise free quota)
- `.planning/research/FEATURES.md` — Audit Logging row + App Check row table-stakes mapping

### Secondary (MEDIUM confidence)

- WebSearch 2026-05-09 — `enforceAppCheck` + Zod community libraries (firebase-functions-extended, FireCall) — confirms pattern is mainstream though not from Firebase docs directly
- WebSearch 2026-05-09 — staged rollout cadence is described in Firebase docs as "make sure that doing so won't disrupt your existing legitimate users" + monitoring metrics; specific 7-day window is project-best-practice language inherited from PITFALLS.md Pitfall 8 and STACK.md
- [OneUptime BigQuery sinks blog (2026-02-17)](https://oneuptime.com/blog/post/2026-02-17-how-to-create-log-sinks-to-export-logs-to-bigquery-in-cloud-logging/view) — confirms partitioned-table sink config is current-best-practice

### Tertiary (LOW confidence — flagged for validation)

- BigQuery 7-year retention cost projection: based on rough volume estimate; Wave 5 should re-verify against actual ingest rates after sink active for ≥1 hour
- App Check reCAPTCHA Enterprise quota sufficiency for projected post-engagement-restart chat volume: STATE.md outstanding todo; Phase 7 alerts at 70% but doesn't size beyond default free tier

---

## Risks + Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| App Check enforcement breaks production for legitimate users | M | H | (1) 7-day soak with metrics-watch; (2) per-service rollout (Storage → Firestore-collection-by-collection → Functions) gives per-service rollback; (3) console-instant-disable enforcement on any service; (4) operator runbook documents rollback steps |
| D-22 ToS gate cannot be resolved within Phase 7 | M | M | Carry-forward path documented (Pitfall 4); ship reduced Wave 5; Phase 7 closes with substrate gap noted; Phase 8 unblocked |
| BigQuery sink cost exceeds projection | L | M | Cost guardrail in Pattern 10; Wave 5 verification step measures volume after 1h; sink can be recreated with shorter retention if needed |
| Mirror-trigger stampede on Phase 8 GDPR cascade | M | L | 60-second dedup window in trigger; Phase 8's GDPR erase Wave plan must use single summary event; flagged in Pitfall 7 |
| `minInstances: 1` cost rejected by operator | L | L | Default to permanent; flagged as adjustable in SECURITY.md; alternative is to live with cold-start risk and document |
| Phase 6 sub-wave 6.1 overlaps Phase 7 (TOTP wiring + MFA gates) | M | L | Phase 7 explicitly does NOT own these (CONTEXT.md Decisions); plan-checker verifies no Phase 7 plan touches TOTP wiring |
| Rate-limit predicate hits Firestore `get()` depth limit (Pitfall 4) | L | M | Pattern 5 uses single `get()` per evaluation; rules cost dashboard monitoring documented in SECURITY.md |
| Idempotency marker doc becomes hot spot | L | L | Pattern 6 mitigation — shard by 2-char prefix; flagged in Pitfall 6 |

### Rollback Strategy: App Check Enforcement Breaks Production

If a per-service App Check enforcement turn-on (Stages D / E / F per Pattern 3) starts denying legitimate traffic:

1. **Within ≤2 minutes:** Operator opens Firebase Console → App Check → [Service] → "Unenforce" toggle. Console takes effect within 10-15 min per Firebase docs (Pitfall 8 source).
2. **Within ≤5 minutes:** Verify dashboard shows "unenforced" state; legitimate traffic recovers.
3. **Within ≤1 hour:** Investigate via App Check metrics dashboard "verified vs unverified" ratio per app version; identify which client release / environment / user-agent is hitting unverified.
4. **Within ≤24h:** Triage — if root cause is missing debug token, distribute; if reCAPTCHA Enterprise site key mismatch, fix; if SDK version regression, roll bundle back via `firebase hosting:rollback`.

**Per-collection rollback:** Phase 7 Pattern 3's stage E (per-collection enforcement) means rollback can be scoped to a single collection without affecting others. Each collection's enforcement is a separate Console toggle.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every version verified against npm registry 2026-05-09
- Architecture: HIGH — rooted in `.planning/research/ARCHITECTURE.md §3 + §5` + existing Phase 3 + Phase 6 patterns
- Audit-log shape: HIGH — schema matches ARCHITECTURE.md §5 + Phase 5 rules already pinned `auditLog/` deny-block
- App Check rollout: HIGH — directly maps `Pitfall 8` to `FN-08` success criterion
- Rate-limit Rules predicate: MEDIUM — pattern is sound but synthetic burst test result is operator-confirmed in Wave 4 only; alternative token-bucket fallback documented if predicate hits limits
- BigQuery sink: HIGH — Cloud Logging documentation confirms partitioned-tables flag + multi-region datasets + 7y retention via `defaultTableExpirationMs`
- D-22 ToS gate cascade: HIGH — directly inherited from `06-PREFLIGHT.md ## Cutover Log Substrate Gaps`; Phase 7 plan must accept it as a carry-forward variable

**Research date:** 2026-05-09
**Valid until:** 2026-06-09 (30 days for stable Firebase platform; re-verify versions on Wave 1 install)

---

_Phase 7 research authored 2026-05-09 — ready for plan-phase. Wave shape recommended: 6 waves following Phase 5 / Phase 6 precedent._
