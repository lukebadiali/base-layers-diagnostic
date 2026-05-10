# Phase 9: Observability + Audit-Event Wiring - Pattern Map

**Mapped:** 2026-05-10
**Files analyzed:** 17 (8 created, 9 modified)
**Analogs found:** 17 / 17

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/observability/sentry.js` (modify — body fill) | observability adapter | event-driven (error/breadcrumb sink) | `functions/src/util/sentry.ts` (server twin) | exact (mirror SDK init) |
| `src/observability/pii-scrubber.js` (NEW) | utility | transform | `functions/src/util/sentry.ts` `beforeSend` | exact (extract scrubber dictionary) |
| `src/observability/audit-events.js` (modify — body fill) | utility (constants + emit proxy) | request-response | `src/cloud/audit.js` `writeAuditEvent` | exact (proxy seam) |
| `functions/src/util/pii-scrubber.ts` (NEW) | utility | transform | `functions/src/util/sentry.ts` (extract dictionary) | exact |
| `functions/src/util/sentry.ts` (modify — extend `beforeSend`) | utility | transform | own Phase 7 substrate | self (extend) |
| `functions/src/observability/authAnomalyAlert.ts` (NEW) | cloud-function trigger | event-driven (Firestore onCreate -> outbound webhook) | `functions/src/audit/triggers/onOrgDelete.ts` | exact (Pattern B Firestore trigger) |
| `functions/src/audit/auditEventSchema.ts` (modify — extend enum) | schema/model | data-validation | own Phase 7 substrate | self (extend) |
| `functions/src/index.ts` (modify — add export) | config (entry point) | static export list | own Phase 7-8 substrate | self (extend) |
| `vite.config.js` (modify — add `@sentry/vite-plugin`) | config (build) | static config | own Phase 7 FN-07 guard | self (extend) |
| `.github/workflows/ci.yml` (modify — env vars + secrets) | config (CI) | static workflow | own Phase 7 build job | self (extend) |
| `firestore.rules` (modify — add `authFailureCounters` block) | rules/policy | access-control | own Phase 7 `auditLog` rules | self (extend) |
| `src/firebase/auth.js` (modify — wire 6 audit emit sites) | adapter | request-response | own Phase 7 unified-error wrapper | self (extend, try/finally pattern) |
| `src/cloud/claims-admin.js` (modify — emit `iam.claims.set.requested`) | cloud seam | request-response | `src/cloud/audit.js` | exact (same shape) |
| `src/cloud/gdpr.js` (modify — emit `compliance.*.requested`) | cloud seam | request-response | `src/cloud/audit.js` | exact |
| `src/cloud/soft-delete.js` (modify — emit `data.*.requested`) | cloud seam | request-response | `src/cloud/audit.js` | exact |
| `src/main.js` (modify — Sentry boot wiring inside onAuthStateChanged) | bootstrap | event-driven | own existing `fbOnAuthStateChanged` block (lines 4171-4239) | self (extend) |
| `scripts/setup-uptime-check/run.js` (NEW) | operator script | one-shot CLI | (research-only — no codebase analog) | research-pattern |
| `scripts/setup-budget-alerts/run.js` (NEW) | operator script | one-shot CLI | (research-only — no codebase analog) | research-pattern |
| `scripts/test-slack-alert/run.js` (NEW) | operator script | one-shot CLI | research-pattern | research-pattern |

---

## Pattern Assignments

### `functions/src/observability/authAnomalyAlert.ts` (NEW — cloud-function trigger, event-driven)

**Analog:** `functions/src/audit/triggers/onOrgDelete.ts` (Phase 7 Pattern B Firestore trigger)
**Secondary analog:** `functions/src/auth/setClaims.ts` (Pattern A callable — for `withSentry` + `defineSecret` wiring)

**Imports pattern** (mirror `onOrgDelete.ts:17-22` + add `defineSecret` + `node:crypto`):
```typescript
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { createHash } from "node:crypto";
import { withSentry } from "../util/sentry.js";

if (!getApps().length) initializeApp();
```

**Secret + trigger config pattern** (compose `setClaims.ts:35-52` callable shape with `onOrgDelete.ts:26-32` trigger shape):
```typescript
const SLACK_WEBHOOK_URL = defineSecret("SLACK_WEBHOOK_URL");
const SENTRY_DSN = defineSecret("SENTRY_DSN");

export const authAnomalyAlert = onDocumentCreated(
  {
    document: "auditLog/{eventId}",
    region: "europe-west2",
    serviceAccount: "audit-alert-sa",     // NEW SA — operator-provisioned in Wave 5
    secrets: [SLACK_WEBHOOK_URL, SENTRY_DSN],
    memory: "256MiB",
    timeoutSeconds: 30,
    retryConfig: { retryCount: 1 },       // best-effort alerting (do not retry-storm Slack)
  },
  withSentry(async (event) => {
    /* … rule body — see Pattern 6 in 09-RESEARCH.md … */
  }),
);
```

**Rolling-window counter pattern** (model after research §Pattern 10 — same shape as Phase 7 `rateLimits/{uid}/buckets/{windowStart}` substrate; use Admin SDK transaction):
```typescript
const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 16);
const ref = getFirestore().doc(`authFailureCounters/${ipHash}`);
const next = await getFirestore().runTransaction(async (tx) => {
  const snap = await tx.get(ref);
  const cur = snap.exists
    ? (snap.data() as { count: number; windowStart: number })
    : { count: 0, windowStart: Date.now() };
  if (Date.now() - cur.windowStart > FAIL_WINDOW_MS) {
    tx.set(ref, { count: 1, windowStart: Date.now() });
    return 1;
  }
  tx.update(ref, { count: FieldValue.increment(1) });
  return cur.count + 1;
});
if (next === FAIL_LIMIT + 1) await postToSlack({ text: "..." });   // fire EXACTLY ONCE per window
```

**60s primary-event dedup precedent** (no dedup needed in this trigger — but mirror the read-side query shape from `onOrgDelete.ts:36-43` if a future rule needs it):
```typescript
// Reference only — authAnomalyAlert reads the freshly-created doc, no dedup query.
const recent = await getFirestore()
  .collection("auditLog")
  .where("type", "==", "data.org.softDelete")
  .where("target.id", "==", orgId)
  .where("at", ">", new Date(Date.now() - 60_000))
  .limit(1)
  .get();
if (!recent.empty) { logger.info("audit.mirror.skipped", { reason: "primary-exists" }); return; }
```

**Slack POST helper** (research §Pattern 6 lines 606-619 — paste-ready):
```typescript
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

**Header banner pattern** (mirror `onOrgDelete.ts:1-15` style — load-bearing comments first):
```typescript
// Phase 9 Wave 4 (OBS-05 / FN-01): authAnomalyAlert — onDocumentCreated trigger
// over auditLog/{eventId}. Pattern-matches against four anomaly rules and
// dispatches a Slack message via SLACK_WEBHOOK_URL secret. Rolling-window
// auth-failure counter at authFailureCounters/{ipHash} for the >5/IP/5min rule
// (same shape as Phase 7 rateLimits/{uid}/buckets — Pattern 10).
//
// Runs as audit-alert-sa (Wave 5 SA inventory) with roles/datastore.user on
// authFailureCounters/* + roles/datastore.viewer on auditLog/*. Rules block
// all client read/write to authFailureCounters/* (Wave 4 firestore.rules edit).
//
// Best-effort alerting: retryConfig: { retryCount: 1 } — do not retry-storm
// Slack on transient webhook failure.
```

---

### `functions/src/audit/auditEventSchema.ts` (modify — extend enum)

**Analog:** self (Phase 7 Wave 1 substrate)

**Current enum at lines 18-54** — extend with `.requested` variants per AUDIT-05 inventory (research lines 503-517):
```typescript
// Add these literals to the existing auditEventType z.enum([…]) array:
"auth.signin.success",          // already present
"auth.signin.failure",          // already present
"auth.signout",                 // already present
"auth.mfa.enrol",               // already present
"auth.mfa.unenrol",             // already present
"auth.password.change",         // already present
"auth.password.reset",          // already present
"iam.claims.set",               // already present (server emits)
"iam.claims.set.requested",     // NEW — client wrapper emits
"compliance.export.user",       // already present (server emits)
"compliance.export.user.requested",  // NEW
"compliance.erase.user",        // already present (server emits)
"compliance.erase.user.requested",   // NEW
"data.org.softDelete",          // already present
"data.org.softDelete.requested",     // NEW
"data.org.restore",             // already present
"data.org.restore.requested",        // NEW
"data.<type>.permanentlyDelete.requested",   // NEW (one literal per type — see below)
```

**Per-type permanently-delete enum expansion** (the lifecycle CF accepts five types — `action|comment|document|message|funnelComment` per `src/cloud/soft-delete.js:23`). Choose ONE convention:
- **Option A (explicit, recommended per research line 519):** add 5 literals (`data.action.permanentlyDelete.requested`, `data.comment.permanentlyDelete.requested`, etc.).
- **Option B (regex-based schema):** replace `auditEventType` `z.enum([...])` with `z.union([z.enum([...]), z.string().regex(/^data\.\w+\.\w+\.requested$/)])`. Loses type safety on the client.

Recommendation per research line 519: **Option A — explicit > clever**.

---

### `src/observability/sentry.js` (modify — body fill, replaces stub)

**Analog:** `functions/src/util/sentry.ts` (server twin); current stub at `src/observability/sentry.js:1-26`

**Imports + init pattern** (research §Pattern 1 lines 263-291 — paste-ready):
```javascript
// @ts-check
import * as Sentry from "@sentry/browser";
import { scrubPii } from "./pii-scrubber.js";

let inited = false;

/** @param {string} dsn @param {string} release */
export function initSentryBrowser(dsn, release) {
  if (inited) return;
  if (!dsn) { inited = true; return; }   // empty DSN = no-op (kill-switch + local dev)
  Sentry.init({
    dsn,
    release,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    integrations: [
      Sentry.breadcrumbsIntegration({ console: false }),
      Sentry.globalHandlersIntegration(),
      Sentry.linkedErrorsIntegration(),
    ],
    beforeSend: scrubPii,
    beforeBreadcrumb: (b) => scrubPii({ breadcrumb: b })?.breadcrumb ?? null,
  });
  inited = true;
}
```

**Existing exports preserved** (`captureError` and `addBreadcrumb` already exist as stubs at `src/observability/sentry.js:14-25` — fill bodies):
```javascript
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

**Header banner update** — replace the existing Phase-4-stub banner at `src/observability/sentry.js:1-10`. Match the `src/cloud/audit.js:1-30` style (cleanup-ledger close annotation):
```javascript
// src/observability/sentry.js
// @ts-check
// Phase 9 Wave 1 (OBS-01 / OBS-02 / OBS-03): @sentry/browser init + capture +
// breadcrumb + setUser. Replaces the Phase 4 D-11 empty stub body. Scrubber
// shared with functions/src/util/sentry.ts via pii-scrubber.js + .ts twin
// (Pattern 11 + parity test).
//
// Init contract: empty-string DSN = no-op (kill-switch + local dev). EU
// residency encoded in the DSN itself (https://...@o<id>.ingest.de.sentry.io/...).
//
// Boot wiring is in src/main.js inside fbOnAuthStateChanged's first invocation
// (after claims hydration, before render) — Pitfall 3 mitigation.
```

**Fingerprint-rate-limit wrapper** (research §Pattern 3 lines 382-398 — embed in `beforeSend`):
```javascript
const fingerprintCounts = new Map();
const WINDOW_MS = 60_000;
const LIMIT = 10;
function fingerprintRateLimit(event) {
  const fp = (event.fingerprint?.[0] ?? event.message
              ?? event.exception?.values?.[0]?.value ?? "unknown");
  const now = Date.now();
  const entry = fingerprintCounts.get(fp);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    fingerprintCounts.set(fp, { count: 1, windowStart: now });
    return event;
  }
  entry.count += 1;
  if (entry.count > LIMIT) return null;   // drop — Sentry suppresses event when null
  return event;
}
// In init(): beforeSend: (event) => { const e = fingerprintRateLimit(event); return e ? scrubPii(e) : null; }
```

---

### `src/observability/pii-scrubber.js` (NEW — utility, transform)

**Analog:** `functions/src/util/sentry.ts` `beforeSend` body (lines 36-52 — extracts the dictionary)

**Full file** (research §Pattern 11 lines 738-763 — paste-ready):
```javascript
// src/observability/pii-scrubber.js
// @ts-check
// Phase 9 Wave 1 (OBS-01 / Pitfall 18): shared PII-scrubber dictionary +
// scrubPii(event) helper. Browser SDK (@sentry/browser) imports this directly;
// node SDK (@sentry/node) imports the byte-equivalent TS twin at
// functions/src/util/pii-scrubber.ts. A parity test in
// functions/test/util/pii-scrubber-parity.test.ts asserts the two arrays
// match — the test IS the contract (Pitfall 7 — drift mitigation).

/** @type {readonly string[]} */
export const PII_KEYS = Object.freeze([
  "email", "name", "displayName", "ip", "phone", "address",
  "body", "message", "chatBody", "commentBody",
]);

/** @param {*} event @returns {*|null} */
export function scrubPii(event) {
  if (!event || typeof event !== "object") return event;
  for (const bag of [event.extra, ...(Object.values(event.contexts ?? {}))]) {
    if (bag && typeof bag === "object") {
      for (const k of PII_KEYS) if (k in bag) bag[k] = "<redacted>";
    }
  }
  if (event.request && typeof event.request === "object") {
    for (const k of ["data", "body"]) {
      if (typeof event.request[k] === "string") event.request[k] = "<redacted-body>";
    }
  }
  return event;
}
```

---

### `functions/src/util/pii-scrubber.ts` (NEW — utility, transform)

**Analog:** `src/observability/pii-scrubber.js` (browser twin); existing scrub logic in `functions/src/util/sentry.ts:46-51`

**Full file** (research §Pattern 11 lines 766-771 — paste-ready, dictionary-only):
```typescript
// Phase 9 Wave 1 (OBS-01 / Pitfall 18): shared PII-scrubber dictionary — TS
// twin of src/observability/pii-scrubber.js. The two arrays MUST be identical
// at the string level; functions/test/util/pii-scrubber-parity.test.ts asserts
// equality by parsing the JS file's array literal and comparing to NODE_KEYS.
//
// Pattern C purity: this module imports from nothing — no firebase-admin/*,
// no firebase-functions/*. Safe to load from any callable / trigger module.
export const PII_KEYS = [
  "email", "name", "displayName", "ip", "phone", "address",
  "body", "message", "chatBody", "commentBody",
] as const;
```

**Parity test** (research lines 775-787 — for `functions/test/util/pii-scrubber-parity.test.ts`):
```typescript
import { PII_KEYS as NODE_KEYS } from "../../src/util/pii-scrubber.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

it("PII_KEYS dictionary matches between browser + node", () => {
  const browserSrc = readFileSync(
    fileURLToPath(new URL("../../../src/observability/pii-scrubber.js", import.meta.url)),
    "utf-8");
  const match = browserSrc.match(/PII_KEYS\s*=\s*Object\.freeze\(\[([^\]]+)\]/);
  const browserKeys = (match?.[1] ?? "").match(/"[^"]+"/g)?.map(s => s.slice(1, -1)) ?? [];
  expect(browserKeys.sort()).toEqual([...NODE_KEYS].sort());
});
```

---

### `functions/src/util/sentry.ts` (modify — extend `beforeSend` to use shared dictionary)

**Analog:** self (Phase 7 substrate at `functions/src/util/sentry.ts`)

**Current `beforeSend` at lines 36-53** — replace inline `["email","name","ip"]` array with imported `PII_KEYS` dictionary (research §Pattern 2 lines 318-345):
```typescript
// Wave 1 EXTEND — at top of file, add:
import { PII_KEYS } from "./pii-scrubber.js";

// Inside Sentry.init({ ... beforeSend(event) { ... } }):
//   Strip extras + contexts via dictionary (Phase 9 extend — was Phase 7 inline array).
for (const bag of [event.extra, ...(Object.values(event.contexts ?? {}) as Record<string, unknown>[])]) {
  if (bag && typeof bag === "object") {
    for (const k of PII_KEYS) {
      if (k in bag) (bag as Record<string, unknown>)[k] = "<redacted>";
    }
  }
}
//   Strip free-form bodies on requests (NEW Phase 9 — chat/comment payload defence)
if (event.request && typeof event.request === "object") {
  const req = event.request as Record<string, unknown>;
  for (const k of ["data", "body"]) {
    if (typeof req[k] === "string") req[k] = "<redacted-body>";
  }
}
```

**Header banner extend** — append a Phase 9 row to the existing `functions/src/util/sentry.ts:1-13` banner:
```typescript
// Phase 9 Wave 1 (OBS-01): beforeSend extended to scrub via the shared
// PII_KEYS dictionary in ./pii-scrubber.ts (parity-tested with the browser
// twin at src/observability/pii-scrubber.js). Free-form request bodies are
// also clipped to "<redacted-body>" to defend against chat/comment payload
// leaks (Pitfall 18 #4).
```

---

### `src/observability/audit-events.js` (modify — body fill, replaces empty stub)

**Analog:** `src/cloud/audit.js` (proxy seam — Phase 7 Wave 6 closed); current stub at `src/observability/audit-events.js:1-31`

**Imports + constants table** (extend existing frozen empty table at lines 17-22 with the canonical event names from Phase 7 schema enum + Phase 9 `.requested` variants):
```javascript
// src/observability/audit-events.js
// @ts-check
// Phase 9 Wave 3 (AUDIT-05): canonical AUDIT_EVENTS table + emitAuditEvent
// proxy. Replaces the Phase 4 D-11 empty stub. emitAuditEvent forwards to
// writeAuditEvent in src/cloud/audit.js (the boundary contract: views/* and
// auth/* import from observability/audit-events.js, never from cloud/* directly).

import { writeAuditEvent } from "../cloud/audit.js";

export const AUDIT_EVENTS = Object.freeze({
  AUTH_SIGNIN_SUCCESS:       "auth.signin.success",
  AUTH_SIGNIN_FAILURE:       "auth.signin.failure",
  AUTH_SIGNOUT:              "auth.signout",
  AUTH_MFA_ENROL:            "auth.mfa.enrol",
  AUTH_MFA_UNENROL:          "auth.mfa.unenrol",
  AUTH_PASSWORD_CHANGE:      "auth.password.change",
  AUTH_PASSWORD_RESET:       "auth.password.reset",
  IAM_CLAIMS_SET_REQUESTED:  "iam.claims.set.requested",
  COMPLIANCE_EXPORT_USER_REQUESTED: "compliance.export.user.requested",
  COMPLIANCE_ERASE_USER_REQUESTED:  "compliance.erase.user.requested",
  // … per-type soft-delete + restore + permanentlyDelete .requested variants
});
```

**Emit proxy pattern** (mirror `src/cloud/audit.js:50-57` `writeAuditEvent` shape):
```javascript
/**
 * @param {string} type — value from AUDIT_EVENTS or the schema enum
 * @param {{ type: string, id: string, orgId?: string|null, snapshot?: any }} target
 * @param {*} [payload]
 * @returns {Promise<{ ok: true, eventId: string } | null>} null on best-effort failure
 */
export async function emitAuditEvent(type, target, payload) {
  try {
    return await writeAuditEvent({ type, target, payload });
  } catch (err) {
    // Best-effort — never block the originating op on audit failure (Pattern 5 #2).
    // Once Sentry is live, capture; pre-Sentry, swallow.
    return null;
  }
}
```

---

### `src/firebase/auth.js` (modify — wire 6 audit emit sites with try/finally)

**Analog:** self (Phase 6 unified-error wrapper at `src/firebase/auth.js:42-72`); pattern from research §Pattern 5 lines 467-489

**Existing imports** (line 33) — add `emitAuditEvent`:
```javascript
import { emitAuditEvent } from "../observability/audit-events.js";
```

**`signInEmailPassword` POST-emit pattern** (replace existing body at `src/firebase/auth.js:60-72`):
```javascript
/** @param {string} email @param {string} password */
export async function signInEmailPassword(email, password) {
  let outcome = "failure";
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    outcome = "success";
    return result;
  } catch (err) {
    const code = (err && /** @type {*} */ (err).code) || "";
    if (AUTH_CRED_ERROR_CODES.has(code)) throw new SignInError();
    throw err;
  } finally {
    // Best-effort emission — never block the auth flow on audit failure.
    // Failure events feed the OBS-05 anomaly counter (>5/IP/5min) — DO NOT skip.
    emitAuditEvent(
      outcome === "success" ? "auth.signin.success" : "auth.signin.failure",
      { type: "user", id: auth.currentUser?.uid ?? "unknown", orgId: null },
      {},   // NO email/password — actor.email comes from server-side ID-token (Pitfall 17)
    );
  }
}
```

**`signOut` PRE-emit pattern** (App Check + ID-token gone after fbSignOut — emit FIRST). Replace `src/firebase/auth.js:74-77`:
```javascript
/** @returns {Promise<void>} */
export async function signOut() {
  // PRE-emit: App Check token + ID-token are revoked by fbSignOut, so
  // auditWrite would reject after — emit BEFORE the side effect.
  await emitAuditEvent("auth.signout",
    { type: "user", id: auth.currentUser?.uid ?? "unknown", orgId: null }, {});
  await fbSignOut(auth);
}
```

**`updatePassword` POST-emit** (extend existing body at `src/firebase/auth.js:99-141` — emit `auth.password.change` after the firebase update + setClaims):
```javascript
// AT END of updatePassword, after the BLOCKER-FIX 1 setClaims block:
emitAuditEvent("auth.password.change",
  { type: "user", id: user.uid, orgId: null }, {});
```

**`sendPasswordResetEmail` POST-emit** (extend `src/firebase/auth.js:174-177`):
```javascript
/** @param {string} email */
export async function sendPasswordResetEmail(email) {
  const result = await fbSendPasswordResetEmail(auth, email);
  // Emit even on swallowed errors — D-15 generic-success surface still reflects intent.
  emitAuditEvent("auth.password.reset",
    { type: "user", id: "unknown", orgId: null }, {});  // NO email in payload
  return result;
}
```

**`signInWithEmailLink` POST-emit** (extend `src/firebase/auth.js:159-162`):
```javascript
/** @param {string} email @param {string} url */
export async function signInWithEmailLink(email, url) {
  const result = await fbSignInWithEmailLink(auth, email, url);
  emitAuditEvent("auth.signin.success",
    { type: "user", id: auth.currentUser?.uid ?? "unknown", orgId: null },
    { method: "emailLink" });   // payload distinguishes from password sign-in
  return result;
}
```

**Banner extend** — append to `src/firebase/auth.js:1-20` Phase 6/7 banner:
```javascript
// Phase 9 Wave 3 (AUDIT-05): try/finally emitAuditEvent at six call sites:
// signInEmailPassword (POST, both outcomes — failure feeds OBS-05 anomaly
// counter), signOut (PRE — App Check token revoked after), updatePassword
// (POST), sendPasswordResetEmail (POST), signInWithEmailLink (POST,
// payload.method:"emailLink"). Best-effort emission via emitAuditEvent —
// failures swallowed (Pattern 5 #2 — never block auth flow on audit failure).
```

---

### `src/cloud/claims-admin.js` (modify — emit `iam.claims.set.requested`)

**Analog:** `src/cloud/audit.js:50-57` (same shape — UUID, callable, withRetry)

**Existing body at `src/cloud/claims-admin.js:23-26`** — extend with POST-emit:
```javascript
/**
 * @param {{ uid: string, role?: string|null, orgId?: string|null }} input
 * @returns {Promise<void>}
 */
export async function setClaims(input) {
  const clientReqId = crypto.randomUUID();
  await setClaimsCallable({ ...input, clientReqId });
  // POST-emit — server-side setClaims callable already emits `iam.claims.set`
  // (server flavour). Client emits `.requested` so the pair is observable for
  // latency analysis (gap between client request and server execution).
  emitAuditEvent("iam.claims.set.requested",
    { type: "user", id: input.uid, orgId: input.orgId ?? null },
    { newRole: input.role ?? null });
}
```

Add `import { emitAuditEvent } from "../observability/audit-events.js";` at top.

---

### `src/cloud/gdpr.js` (modify — emit `compliance.*.requested` on both call sites)

**Analog:** `src/cloud/audit.js:50-57` + own existing body at `src/cloud/gdpr.js:25-45`

**`exportUser` POST-emit** (extend `src/cloud/gdpr.js:25-29`):
```javascript
export async function exportUser(input) {
  const clientReqId = crypto.randomUUID();
  const result = await exportUserCallable({ ...input, clientReqId });
  emitAuditEvent("compliance.export.user.requested",
    { type: "user", id: input.userId, orgId: null }, {});
  return /** @type {{ url: string, expiresAt: number }} */ (result.data);
}
```

**`eraseUser` POST-emit** — same pattern with `compliance.erase.user.requested`.

---

### `src/cloud/soft-delete.js` (modify — emit `data.<type>.<op>.requested` on three call sites)

**Analog:** own existing body at `src/cloud/soft-delete.js:24-50`

**`softDelete` POST-emit pattern**:
```javascript
export async function softDelete(input) {
  const clientReqId = crypto.randomUUID();
  const result = await softDeleteCallable({ ...input, clientReqId });
  emitAuditEvent(
    `data.${input.type}.softDelete.requested`,
    { type: input.type, id: input.id, orgId: input.orgId },
    {},
  );
  return /** @type {{ ok: true }} */ (result.data);
}
```

`restoreSoftDeleted` and `permanentlyDeleteSoftDeleted` follow identically with `.restore.requested` and `.permanentlyDelete.requested` suffixes.

---

### `src/main.js` (modify — Sentry boot wiring inside `fbOnAuthStateChanged`)

**Analog:** self (existing `fbOnAuthStateChanged` block at `src/main.js:4171-4239`)

**Insertion point: after claims hydration (line 4192), before render** (research §Pitfall 3 lines 840-845 — Pitfall 3 mitigation):
```javascript
// Phase 9 Wave 1 (OBS-01 + Pitfall 3): init Sentry AFTER claims hydration so
// setUser carries the verified UID + role (never PII like email).
import { initSentryBrowser, setUser as sentrySetUser } from "./observability/sentry.js";

// Inside the fbOnAuthStateChanged callback, after `claims = tokenResult.claims || {}`:
initSentryBrowser(
  /** @type {string} */ (import.meta.env.VITE_SENTRY_DSN ?? ""),
  /** @type {string} */ (import.meta.env.VITE_GIT_SHA ?? "local"),
);
sentrySetUser({ id: fbUser.uid, role: claims.role || "internal" });
```

The empty-DSN fallback at `src/observability/sentry.js` (Pattern: `if (!dsn) return;`) means local-dev / unit-tests with no `VITE_SENTRY_DSN` are no-ops — no env-var-required failure. Mirrors Phase 7 FN-07 reCAPTCHA placeholder pattern (`vite.config.js:14-22`).

---

### `vite.config.js` (modify — add `@sentry/vite-plugin`)

**Analog:** self (Phase 7 FN-07 guard at `vite.config.js:13-22`)

**Plugin registration pattern** (research §Pattern 4 lines 411-440 — paste-ready, drop into `plugins: [...]` array):
```javascript
import { sentryVitePlugin } from "@sentry/vite-plugin";

// Inside defineConfig({ command, mode }) returned object:
plugins: [
  // Only emit when SENTRY_AUTH_TOKEN is present — no-op for PR/preview builds.
  env.SENTRY_AUTH_TOKEN && command === "build" && sentryVitePlugin({
    org: "bedeveloped",
    project: "base-layers-diagnostic",
    url: "https://de.sentry.io/",       // EU region — DO NOT change
    authToken: env.SENTRY_AUTH_TOKEN,
    release: { name: env.GITHUB_SHA ?? "local", create: true, finalize: true },
    sourcemaps: {
      assets: ["dist/**/*.js", "dist/**/*.map"],
      filesToDeleteAfterUpload: ["dist/**/*.map"],   // hide source maps from prod (OBS-04)
    },
    telemetry: false,                   // no plugin-side telemetry to Sentry
  }),
].filter(Boolean),
```

**Header banner extend** — append a Wave 2 row to `vite.config.js:1-3` banner:
```javascript
// Phase 9 Wave 2 (OBS-04): @sentry/vite-plugin for source-map upload to the
// EU Sentry instance + hidden-source-map enforcement
// (filesToDeleteAfterUpload: ["dist/**/*.map"] — Pitfall 6). Plugin is
// conditional on SENTRY_AUTH_TOKEN: PR/preview builds without the token are
// no-ops (mirrors VITE_RECAPTCHA_ENTERPRISE_SITE_KEY placeholder pattern).
```

---

### `.github/workflows/ci.yml` (modify — env vars + secrets)

**Analog:** self (existing build job at `.github/workflows/ci.yml:141-165`)

**Build job env extension** (replace existing `env:` block at lines 158-159 — paste-ready research lines 446-454):
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

Apply identically to the `deploy` job (`.github/workflows/ci.yml:185-188`) and the `preview` job (`.github/workflows/ci.yml:269-272`).

**Hidden-source-map verification step** (Wave 2 — research Pitfall 6):
```yaml
- name: Assert no .map files served from dist (OBS-04 / Pitfall 6)
  run: |
    set -euo pipefail
    if find dist -name "*.map" | grep -q .; then
      echo "FAIL: dist/*.map files present after build — @sentry/vite-plugin filesToDeleteAfterUpload misconfigured"
      find dist -name "*.map"
      exit 1
    fi
    echo "OK: no .map files in dist"
```

---

### `firestore.rules` (modify — add `authFailureCounters` block)

**Analog:** Phase 7 `auditLog` rules (server-only — both read + write `false` for clients)

**Pattern** (research §Pattern 10 lines 723-731 — paste-ready):
```
match /authFailureCounters/{ipHash} {
  allow read: if false;            // server-only — Admin SDK only via authAnomalyAlert
  allow write: if false;           // Admin SDK only
}
```

**Test cells** (`tests/rules/authFailureCounters.test.js` — mirror Phase 7 `tests/rules/auditLog.test.js` cells 1-4):
- Cell 1: anonymous read denied
- Cell 2: signed-in client read denied
- Cell 3: signed-in client write denied
- Cell 4: internal-role write denied (server-side Admin SDK is the only writer)

---

### `functions/src/index.ts` (modify — add export)

**Analog:** self (existing exports at `functions/src/index.ts:11-30`)

**Pattern** (append after Phase 8 exports):
```typescript
// Phase 9 Wave 4 (OBS-05): authAnomalyAlert Firestore-trigger Slack dispatcher.
export { authAnomalyAlert } from "./observability/authAnomalyAlert.js";
```

---

### `scripts/setup-uptime-check/run.js` + `scripts/setup-budget-alerts/run.js` + `scripts/test-slack-alert/run.js` (NEW — operator scripts)

**Analog:** Phase 7 Wave 1 `scripts/provision-function-sas/run.js` (idempotent operator-script pattern — research §Pattern 7-9). No matching file in current codebase outside Phase 7 SA provisioning; the pattern is "shell-out to gcloud / fetch + echo; exit non-zero on hard failure; idempotent (re-run safe)."

**`scripts/test-slack-alert/run.js` reference shape** (research lines 624-628 + 632 — minimal):
```javascript
// scripts/test-slack-alert/run.js
// Phase 9 Wave 4 verification — synthetic Slack alert (OBS-05 success criterion
// "operator receives a synthetic test alert end-to-end").
//
// Usage: SLACK_WEBHOOK_URL=https://hooks.slack.com/... node scripts/test-slack-alert/run.js
const url = process.env.SLACK_WEBHOOK_URL;
if (!url) { console.error("SLACK_WEBHOOK_URL not set"); process.exit(1); }
const res = await fetch(url, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ text: ":white_check_mark: Phase 9 OBS-05 synthetic test alert" }),
});
if (!res.ok) { console.error("post failed:", res.status); process.exit(1); }
console.log("OK — operator should now see the message in Slack");
```

`scripts/setup-uptime-check/run.js` and `scripts/setup-budget-alerts/run.js` are gcloud shell-outs from research §Pattern 7-8 — paste them verbatim from the research file (lines 642-652 and 681-693 respectively) wrapped in node `child_process.execSync` calls. Note research line 670: gcloud `--regions` minimum is 3, so use `USA,EUROPE,ASIA_PACIFIC`.

---

## Shared Patterns

### Authentication / Authorization on callables
**Source:** `functions/src/auth/setClaims.ts:53-58` (Phase 7 Pattern A — re-read role from `request.auth.token`, NEVER from payload)
**Apply to:** `functions/src/observability/authAnomalyAlert.ts` (no callable here — but the `withSentry` wrapper applies; no caller-role check because the trigger fires from Eventarc, not from a user)
```typescript
// Pitfall 17: re-read role from the verified ID token, NEVER from payload.
if (request.auth?.token?.role !== "admin") {
  throw new HttpsError("permission-denied", "admin role required");
}
```

### Server-only audit-log integrity (Pitfall 17)
**Source:** `functions/src/audit/auditWrite.ts:77-92` (actor sourced exclusively from `request.auth.token`)
**Apply to:** Every Phase 9 view-side `emitAuditEvent` call — the view passes `type`, `target`, `payload` only. NEVER pass `actor`, `email`, `name`, `ip`, or `userAgent` in payload (research Anti-Patterns line 795).

### Error handling — Sentry capture wrapping
**Source:** `functions/src/util/sentry.ts:65-79` (`withSentry` wrapper)
**Apply to:** `functions/src/observability/authAnomalyAlert.ts` — wrap the trigger handler in `withSentry(...)`:
```typescript
withSentry(async (event) => { /* … */ })
```

### Idempotency-key pattern
**Source:** `functions/src/util/idempotency.ts:59-73` (`ensureIdempotent`) + `functions/src/auth/setClaims.ts:60-65` (5-min window pattern)
**Apply to:** Phase 9 does NOT need application-tier idempotency on the trigger (Eventarc handles at-least-once delivery; the Firestore transaction in the rolling-window counter is the dedup). Research §Pattern 6 line 581 fires Slack EXACTLY ONCE per window via `if (next === FAIL_LIMIT + 1)` — that IS the dedup.

### Validation
**Source:** `functions/src/util/zod-helpers.ts:15-34` (`validateInput` -> `HttpsError("invalid-argument")`)
**Apply to:** auditEventSchema enum extension only — no new callables in Phase 9 means no new Zod validators. The existing `auditWrite` callable's `validateInput(auditEventInput, ...)` (`functions/src/audit/auditWrite.ts:54`) handles the new `.requested` types automatically once the enum is extended.

### Cloud-seam adapter pattern
**Source:** `src/cloud/audit.js:31-57` (Phase 7 Wave 6 closed stub)
**Apply to:** All `src/cloud/*.js` modifications — preserve the `httpsCallable(functions, "<name>")` import-from-`../firebase/functions.js` boundary; never import from `firebase/functions` SDK directly (Phase 4 ESLint Wave 3 boundary error-level).

### Try/finally audit-emit pattern (browser side)
**Source:** Research §Pattern 5 lines 467-489 (no codebase analog yet — Phase 9 is the first to use it)
**Apply to:** `src/firebase/auth.js#signInEmailPassword` (both outcomes via `outcome` flag); other call sites use POST-emit (after the side effect) or PRE-emit (signOut, where the App Check token is revoked).

### Server-side audit emission already exists for these types
**Source:** Phase 8 `gdprEraseUser`, `gdprExportUser`, `softDelete`, `restoreSoftDeleted`, `setClaims` — server emits the bare type (`compliance.erase.user`, `data.org.softDelete`, etc.).
**Apply to:** Client emits the `.requested` variant — research line 497 + 519 explicit > clever rule. The pair is the latency observability (gap between client-request and server-execution).

### 60-second mirror-trigger dedup (Phase 7 substrate — relevant context)
**Source:** `functions/src/audit/triggers/onUserDelete.ts:60-67` and `onOrgDelete.ts:36-43`
**Relevance:** Phase 9 view-side AUDIT-05 emission for `data.<type>.softDelete.requested` lands BEFORE the server-side soft-delete callable runs. The server-side soft-delete CF emits the canonical `data.<type>.softDelete` (no `.requested`). The Phase 7 mirror trigger fires only if NEITHER primary exists in the 60s window — so either the client `.requested` event OR the server-side bare event satisfies it. Mirror fan-out is therefore unchanged by Phase 9 (research Pitfall 2 lines 829-834).

---

## No Analog Found

Files with no exact match in the codebase (planner can use research §Pattern + standard tooling):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `scripts/setup-uptime-check/run.js` | operator script (gcloud shell-out) | one-shot CLI | No prior gcloud-uptime script in codebase. Pattern is `child_process.execSync` of `gcloud monitoring uptime create` (research §Pattern 7); idempotent re-run via "describe" check first. |
| `scripts/setup-budget-alerts/run.js` | operator script (gcloud shell-out) | one-shot CLI | No prior gcloud-billing-budgets script. Same `execSync` pattern (research §Pattern 8). |
| `runbooks/phase-9-sentry-bootstrap.md` | runbook | docs | No prior Sentry bootstrap runbook. Mirror style of existing `runbooks/phase-7-cleanup-ledger.md` (per research line 248). |
| `runbooks/phase-9-cleanup-ledger.md` | runbook | docs | Mirror existing `runbooks/phase-7-cleanup-ledger.md` and `runbooks/phase-8-cleanup-ledger.md`. |

---

## Metadata

**Analog search scope:**
- `functions/src/audit/*` (auditWrite callable + 3 mirror triggers)
- `functions/src/auth/setClaims.ts` (Pattern A callable exemplar)
- `functions/src/util/*` (sentry, idempotency, zod-helpers)
- `functions/src/csp/cspReportSink.ts` (alternate Pattern A — onRequest variant)
- `functions/src/index.ts` (export-list extension point)
- `src/observability/*` (Phase 4 stubs)
- `src/cloud/*` (audit, gdpr, soft-delete, claims-admin — wiring sites)
- `src/firebase/auth.js` (Phase 6 unified-error wrapper)
- `src/main.js` (boot wiring — `fbOnAuthStateChanged` block at line 4171)
- `src/views/auth.js` (MFA enroll/un-enroll deps wiring)
- `vite.config.js`, `.github/workflows/ci.yml`, `firestore.rules`

**Files scanned:** ~17 source files + 3 config files. Each Read used a single non-overlapping range or full read for files ≤ 200 lines.

**Pattern extraction date:** 2026-05-10

**Key insight:** Phase 9 is overwhelmingly **wiring-style work**. The single net-new Cloud Function (`authAnomalyAlert.ts`) cleanly composes two existing patterns — Phase 7 Pattern B (Firestore trigger from `onOrgDelete.ts`) for the trigger envelope, plus Phase 7 Pattern A (`setClaims.ts`) for `defineSecret` + `withSentry`. Every other change is body-fill (sentry.js stub, audit-events.js stub), enum extension (auditEventSchema.ts), or call-site wiring (auth.js + cloud/* seams). No novel infrastructure to design — only excerpts to paste with one-line type/target adjustments.
