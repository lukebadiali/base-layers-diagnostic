# Phase 7: Cloud Functions + App Check (Trusted-Server Layer) — Pattern Map

**Mapped:** 2026-05-09
**Files analyzed:** ~16 new/modified files across `functions/`, `src/cloud/`, `src/firebase/`, `firestore.rules`, `tests/`, `runbooks/`, `SECURITY.md`
**Analogs found:** 8 / 8 (every new file has an in-repo analog)

This map names the closest in-repo analog for every Phase 7 new/modified file plus paste-ready code excerpts the planner can lift verbatim into PLAN action steps. All excerpts cite file path + line range. Patterns A–H follow the deliverable section ordering.

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `functions/src/audit/auditWrite.ts` | callable Cloud Function | request-response | `functions/src/auth/setClaims.ts` | exact (callable shape) — must add Pattern A overlays (App Check + Zod + idempotency) |
| `functions/src/ratelimit/checkRateLimit.ts` | callable Cloud Function | request-response | `functions/src/auth/setClaims.ts` | exact (callable shape, admin gate replaced with token-bucket logic) |
| `functions/src/audit/onOrgDelete.ts` | Firestore-trigger Function | event-driven | `functions/src/csp/cspReportSink.ts` (HTTPS) + `functions/src/auth/beforeUserCreated.ts` (Admin SDK init pattern) | role-match (Firestore trigger is new shape; init + structured-log + region pattern carries over) |
| `functions/src/audit/onUserDelete.ts` | Auth-trigger Function | event-driven | `functions/src/auth/beforeUserSignedIn.ts` (auth event observation) | role-match (auth-event vs Firestore-event but identity-source identical) |
| `functions/src/audit/onDocumentDelete.ts` | Storage/Firestore-trigger Function | event-driven | `functions/src/csp/cspReportSink.ts` | role-match |
| `functions/src/audit/auditLogger.ts` | pure-logic helper | transform | `functions/src/auth/claim-builder.ts` | exact |
| `functions/src/util/idempotency.ts` | pure-logic helper | transform + Admin-SDK marker write | `functions/src/auth/claim-builder.ts` (purity contract) + `functions/src/csp/dedup.ts` (dedup-window pattern, see below) | exact (purity) — Admin SDK side mirrors `setClaims.ts` Firestore write |
| `functions/src/util/zod-helpers.ts` | pure-logic helper | transform | `functions/src/auth/claim-builder.ts` | exact |
| `functions/test/audit/*.test.ts` | unit test | n/a | `functions/test/auth/claim-builder.test.ts` | exact |
| `firestore.rules` (auditLog + rateLimits edits) | rules predicate | n/a | existing `auditLog/{eventId}` block (already shipped server-only-deny in Phase 5/6) + existing claims-based predicates throughout `firestore.rules` | exact |
| `tests/rules/auditLog.test.js` | rules-unit-test | n/a | `tests/rules/firestore.test.js` | exact |
| `src/cloud/auditWrite.js` | callable client wrapper | request-response | `src/cloud/claims-admin.js` (the only filled stub Phase 6 produced) | exact |
| `src/cloud/checkRateLimit.js` | callable client wrapper | request-response | `src/cloud/claims-admin.js` | exact |
| `src/firebase/check.js` | App Check init (stub fill) | boot | `src/firebase/app.js` (init pattern) + `src/firebase/db.js` (eager singleton export) | exact (stub seam already in place; Phase 7 just fills body) |
| `runbooks/phase-7-cleanup-ledger.md` | runbook (Pattern H) | n/a | `runbooks/phase-6-cleanup-ledger.md` | exact |
| `SECURITY.md ## § Phase 7 Audit Index` (Pattern G) | docs incremental | n/a | `SECURITY.md ## § Phase 6 Audit Index` (lines 724–745) | exact |

---

## Pattern A — 2nd-gen callable Cloud Function with App Check + Zod input validation

**New files:** `functions/src/audit/auditWrite.ts`, `functions/src/ratelimit/checkRateLimit.ts`

**Closest analog:** `functions/src/auth/setClaims.ts`

**What to copy:** `onCall({region, enforceAppCheck:true}, async request => …)` shape; admin-claim re-read from `request.auth.token` (NEVER from payload); Admin SDK init guard; `HttpsError` taxonomy; structured `logger.info(message, {fields})` after success; region pinned to `europe-west2`. Phase 7 ADDS what Phase 6 deferred: `enforceAppCheck: true` (currently the comment says "ships Phase 7 FN-07"), Zod-parsed input replacing the manual `typeof` gates, and an idempotency-marker write before the side effect.

**Paste-ready excerpt — `functions/src/auth/setClaims.ts` lines 14–57:**

```ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

if (!getApps().length) initializeApp();

interface SetClaimsInput {
  uid?: unknown;
  role?: unknown;
  orgId?: unknown;
}

export const setClaims = onCall(
  { region: "europe-west2" /* enforceAppCheck:true ships Phase 7 FN-07 */ },
  async (request) => {
    if (request.auth?.token?.role !== "admin") {
      throw new HttpsError("permission-denied", "admin role required");
    }
    const data = (request.data ?? {}) as SetClaimsInput;
    if (typeof data.uid !== "string" || data.uid.length === 0) {
      throw new HttpsError("invalid-argument", "uid required");
    }
    const role = typeof data.role === "string" ? data.role : null;
    const orgId = typeof data.orgId === "string" ? data.orgId : null;

    await getAuth().setCustomUserClaims(data.uid, { role, orgId });

    // Poke pattern — forces target session to refresh ID token + pick up
    // new claims via getIdToken(true) on the listener path.
    await getFirestore()
      .doc(`users/${data.uid}/_pokes/${Date.now()}`)
      .set({ type: "claims-changed", at: FieldValue.serverTimestamp() });

    logger.info("auth.claims.set", {
      targetUid: data.uid,
      role,
      orgId,
      byUid: request.auth.uid,
    });
    return { ok: true };
  },
);
```

**Phase 7 deltas to layer on top (per ARCHITECTURE.md §3 conventions + 07-CONTEXT.md SC#1):**

1. Replace `{ region: "europe-west2" /* enforceAppCheck:true ships Phase 7 FN-07 */ }` with `{ region: "europe-west2", enforceAppCheck: true, secrets: [/* defineSecret(...) */] }` (Pitfall 13).
2. Replace the manual `typeof` ladder with `const data = AuditWriteSchema.parse(request.data ?? {});` (Zod) — wrap parse in try/catch that re-throws as `HttpsError("invalid-argument", err.message)`.
3. Before the side-effect write, call `markIdempotent(request.auth.uid, data.clientReqId)` from `functions/src/util/idempotency.ts` (5-min window per ARCHITECTURE.md §3); return early on duplicate.
4. After success, write the Firestore audit row via the helper from Pattern C (`auditLogger.ts`) — `auditLog/{eventId}` Admin-SDK write only.
5. The `permission-denied` admin gate becomes per-event-type (auditWrite is open to any authenticated caller for own events; checkRateLimit is per-uid bucket).

**Cross-reference for the Zod-helpers module (`functions/src/util/zod-helpers.ts`):** see Pattern C (purity contract is identical to claim-builder.ts).

---

## Pattern B — 2nd-gen Firestore / Auth / Storage trigger Cloud Function

**New files:** `functions/src/audit/onOrgDelete.ts`, `functions/src/audit/onUserDelete.ts`, `functions/src/audit/onDocumentDelete.ts`

**Closest analogs:**
- `functions/src/csp/cspReportSink.ts` (HTTPS-trigger structural shape: region pin, `firebase-functions/logger` import, structured `logger.warn(message, {fields})` for Cloud Logging jsonPayload)
- `functions/src/auth/beforeUserCreated.ts` (Admin SDK init guard `if (!getApps().length) initializeApp();`, Firestore read pattern, region + 7s-deadline awareness)

The exact trigger entry point — `onDocumentDeleted` from `firebase-functions/v2/firestore`, `onUserDeleted` from `firebase-functions/v2/identity` — does not yet exist in the codebase, so the planner copies the surrounding scaffolding (init, region, logger, no-throw on idempotency hits, structured payload shape) from these two analogs and stitches the new trigger import on top.

**Paste-ready excerpt — `functions/src/csp/cspReportSink.ts` lines 26–106 (structured-log + region + logger pattern):**

```ts
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/logger";
import { normalise } from "./normalise.js";
import { shouldDrop } from "./filter.js";
import { isDuplicate, markSeen, fingerprint } from "./dedup.js";

const MAX_BODY_BYTES = 64 * 1024;

export const cspReportSink = onRequest(
  { region: "europe-west2" },
  (req, res) => {
    // Step 1 — content-type gate (D-12 / T-3-3).
    const contentType = String(req.headers["content-type"] ?? "");
    const isLegacy = contentType.includes("application/csp-report");
    const isModern = contentType.includes("application/reports+json");
    if (!isLegacy && !isModern) {
      res.status(400).send("Bad Request");
      return;
    }

    // [...steps 2-6 elided — body cap + rawBody fallback + normalise + dedup...]

    // Step 7 — structured Cloud Logging (D-10a / RESEARCH.md §Pattern 2).
    // logger.warn(message, structuredObj) yields severity=WARNING with a
    // queryable jsonPayload. Cloud Logging Logs Explorer query:
    //   resource.type="cloud_run_revision"
    //   severity=WARNING
    //   jsonPayload.message="csp.violation"
    logger.warn("csp.violation", { report, fingerprint: fingerprint(report) });

    res.status(204).send();
  },
);
```

**Paste-ready excerpt — `functions/src/auth/beforeUserCreated.ts` lines 14–43 (Admin SDK init + getFirestore + structured-log shape):**

```ts
import { beforeUserCreated } from "firebase-functions/v2/identity";
import { logger } from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { buildClaims, type AllowlistEntry } from "./claim-builder.js";

if (!getApps().length) initializeApp();

export const beforeUserCreatedHandler = beforeUserCreated(
  { region: "europe-west2" },
  async (event) => {
    const email = event.data?.email?.toLowerCase();
    if (!email) {
      // No email on creation event — let Firebase's own validation handle it.
      return;
    }
    const snap = await getFirestore().doc(`internalAllowlist/${email}`).get();
    const entry: AllowlistEntry | null = snap.exists
      ? (snap.data() as AllowlistEntry)
      : null;
    const claims = buildClaims(entry);
    logger.info("auth.user.created", {
      uid: event.data?.uid,
      email,
      role: claims.role,
      orgId: claims.orgId,
    });
    return { customClaims: { role: claims.role, orgId: claims.orgId } };
  },
);
```

**Phase 7 trigger-handler shape to assemble from these two excerpts:**

```ts
// Pattern B target shape (NOT a copy — assembled from analogs above)
import { onDocumentDeleted } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/logger";
import { initializeApp, getApps } from "firebase-admin/app";
import { writeAuditEvent } from "./auditLogger.js"; // Pattern C helper

if (!getApps().length) initializeApp();

export const onOrgDelete = onDocumentDeleted(
  { region: "europe-west2", document: "orgs/{orgId}" },
  async (event) => {
    const orgId = event.params.orgId;
    await writeAuditEvent({
      type: "org.delete.mirror",
      target: { type: "org", id: orgId },
      // No actor — event is server-side mirror per Pitfall 17
      actor: { uid: "system", role: "system" },
      payload: { snapshot: event.data?.data() ?? null },
    });
    logger.info("audit.mirror.orgDelete", { orgId });
  },
);
```

The `onUserDelete` variant uses `onUserDeleted` from `firebase-functions/v2/identity` (mirrors the `beforeUserSignedIn` import pattern at `functions/src/auth/beforeUserSignedIn.ts:11`); the `onDocumentDelete` variant points at the Firestore subcollection path `orgs/{orgId}/documents/{docId}`.

---

## Pattern C — Pure-logic helper + Vitest unit test (firebase-functions-test deferred)

**New files:** `functions/src/audit/auditLogger.ts`, `functions/src/util/idempotency.ts`, `functions/src/util/zod-helpers.ts` + corresponding `functions/test/...test.ts` files

**Closest analogs:** `functions/src/auth/claim-builder.ts` + `functions/test/auth/claim-builder.test.ts`

**Purity contract from claim-builder.ts (lines 1–6):** "MUST NOT import from firebase-functions/* or firebase-admin/*." That holds verbatim for `zod-helpers.ts` and the pure half of `auditLogger.ts`. The Admin-SDK side of `idempotency.ts` (the `markIdempotent(uid, key)` call that writes the marker doc) goes in a thin adjacent module that imports `firebase-admin/firestore` and is exercised through firebase-functions-test v3 integration coverage (TEST-09) — not the pure unit-test seam.

**Paste-ready excerpt — `functions/src/auth/claim-builder.ts` lines 1–29:**

```ts
// Phase 6 (AUTH-03 / D-10): pure transform from internalAllowlist entry to
// the custom-claims shape attached by beforeUserCreated. The unit-test seam
// per D-01 Wave 2 (tests-first, Vitest, no firebase-functions-test substrate).
// Pure, side-effect-free; safe for unit testing without firebase-functions
// runtime. MUST NOT import from firebase-functions/* or firebase-admin/*.

export interface AllowlistEntry {
  role: "admin" | "internal" | "client";
  orgId?: string;
  addedBy?: string;
}

export interface CustomClaims {
  role: "admin" | "internal" | "client";
  orgId: string | null;
}

export function buildClaims(allowlistEntry: AllowlistEntry | null): CustomClaims {
  if (!allowlistEntry) {
    // Pitfall 6 + ARCHITECTURE.md §7 Flow B: no allowlist match falls through
    // to the "client" default; orgId would come from invite-JWT in a future
    // invite flow. Phase 6 ships internal-only.
    return { role: "client", orgId: null };
  }
  return {
    role: allowlistEntry.role,
    orgId: allowlistEntry.orgId ?? null,
  };
}
```

**Paste-ready excerpt — `functions/test/auth/claim-builder.test.ts` lines 1–32 (full file):**

```ts
// Phase 6 (AUTH-03 / D-01 Wave 2 tests-first): unit tests for buildClaims().
// Pure-logic test seam — no firebase-functions-test substrate (deferred to
// Phase 7 TEST-09). These tests land BEFORE the implementation per Phase 5
// D-10 + Phase 6 D-01 Wave 2 (tests-first cadence).
import { describe, it, expect } from "vitest";
import { buildClaims } from "../../src/auth/claim-builder.js";
import type { AllowlistEntry } from "../../src/auth/claim-builder.js";

describe("buildClaims — allowlisted entries", () => {
  it.each<[AllowlistEntry, { role: string; orgId: string | null }]>([
    [{ role: "admin" }, { role: "admin", orgId: null }],
    [{ role: "internal" }, { role: "internal", orgId: null }],
    [{ role: "client", orgId: "org_abc" }, { role: "client", orgId: "org_abc" }],
    [{ role: "admin", orgId: "org_xyz" }, { role: "admin", orgId: "org_xyz" }],
  ])("maps %j to %j", (entry, expected) => {
    expect(buildClaims(entry)).toEqual(expected);
  });
});

describe("buildClaims — null entry (no allowlist match)", () => {
  it("falls through to a client role with null orgId", () => {
    expect(buildClaims(null)).toEqual({ role: "client", orgId: null });
  });
});

describe("buildClaims — drops unrelated fields", () => {
  it("ignores addedBy and any other fields", () => {
    const entry: AllowlistEntry = { role: "admin", addedBy: "phase-6-bootstrap" };
    expect(buildClaims(entry)).toEqual({ role: "admin", orgId: null });
  });
});
```

**Bonus dedup-window analog for `idempotency.ts` (5-min window — same parameter as ARCHITECTURE.md §3 idempotency contract):** `functions/test/csp/dedup.test.ts` lines 21–37 demonstrates the exact `vi.useFakeTimers + advanceTimersByTime` pattern Phase 7 needs to verify the 5-minute idempotency-marker TTL:

```ts
beforeEach(() => {
  _clearForTest();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("dedup — 5-minute window (D-11)", () => {
  it("first occurrence is not a duplicate", () => {
    expect(isDuplicate(r)).toBe(false);
  });

  it("second occurrence at +4m59s is a duplicate", () => {
    markSeen(r);
    vi.advanceTimersByTime(4 * 60 * 1000 + 59_000);
    expect(isDuplicate(r)).toBe(true);
  });

  it("occurrence at +5m+1ms is NOT a duplicate", () => {
    markSeen(r);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(isDuplicate(r)).toBe(false);
  });
});
```

**Vitest config already in place** (`functions/package.json` lines 11–14):

```json
"scripts": {
  "test": "vitest run",
  "test:coverage": "vitest run --coverage"
}
```

`firebase-functions-test@3.4.1` is enumerated in `.planning/research/STACK.md:84` and is the new devDependency Phase 7 must add to `functions/package.json` for TEST-09 integration coverage of `auditWrite` + `setClaims` + Firestore-trigger writers.

---

## Pattern D — Firestore Rules `auditLog/` predicate + rules-unit-test

**Modified file:** `firestore.rules` (auditLog block already exists from Phase 5/6 as `allow write: if false`; `rateLimits/{uid}/buckets/` block already exists as deny-all, to be replaced with a `request.time` predicate)

**New file:** `tests/rules/auditLog.test.js` (Phase 7 owns; Phase 5 `tests/rules/firestore.test.js` already covers some auditLog cells but Phase 7 expands)

**Closest analog (rules):** existing claims-based predicates in `firestore.rules` (lines 5–27 are the predicate library; lines 113–128 are the auditLog + rateLimits blocks Phase 7 keeps deny-all on writes and adds the rate-limit `request.time` predicate to)

**Paste-ready excerpt — `firestore.rules` lines 1–28 (predicate library — these are the predicates the rateLimits-Phase-7-edit + auditLog-test will reuse):**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Auth predicates (D-14 / Pitfall 2) ────────────────────────────
    function isAuthed() {
      return request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.firebase.sign_in_provider != "anonymous";
    }
    function role()  { return request.auth.token.role; }
    function orgId() { return request.auth.token.orgId; }
    function isInternal() { return isAuthed() && role() in ["internal", "admin"]; }
    function isAdmin()    { return isAuthed() && role() == "admin"; }
    function inOrg(o)     { return isAuthed() && (isInternal() || orgId() == o); }

    // ── Document predicates ───────────────────────────────────────────
    function notDeleted(r) { return !("deletedAt" in r) || r.deletedAt == null; }
    function isOwnAuthor(r){ return r.authorId == request.auth.uid; }

    // ── Mutation whitelist (D-15 / Pitfall 3 / RULES-02) ──────────────
    function immutable(field) {
      return request.resource.data[field] == resource.data[field];
    }
    function mutableOnly(fields) {
      return request.resource.data.diff(resource.data).affectedKeys().hasOnly(fields);
    }
```

**Paste-ready excerpt — `firestore.rules` lines 113–128 (auditLog + rateLimits blocks; auditLog stays as-is, rateLimits gets the `request.time` predicate body):**

```javascript
    // ── auditLog/{eventId} (AUDIT-07 / Pitfall 17) ────────────────────
    match /auditLog/{eventId} {
      allow read:  if isAdmin();   // internal CANNOT read own audit records
      allow write: if false;       // server-only via auditWrite callable (Phase 7)
    }

    // ── softDeleted/{type}/items/{id} ─────────────────────────────────
    match /softDeleted/{type}/items/{id} {
      allow read:  if isAdmin();
      allow write: if false;       // server-only (Phase 8)
    }

    // ── rateLimits (D-17: deny-all in Phase 5; FN-09 replaces in Phase 7) ─
    match /rateLimits/{uid}/buckets/{windowStart} {
      allow read, write: if false;
    }
```

**Phase 7 rateLimits-block target shape** (consistent with existing block style — predicates from the library above plus a `request.time`-based bucket predicate per ARCHITECTURE.md §3 + ROADMAP success criterion 5):

```javascript
    // ── rateLimits (FN-09: Phase 7 token-bucket against request.time) ─
    match /rateLimits/{uid}/buckets/{windowStart} {
      allow read:   if isAuthed() && request.auth.uid == uid;
      // Self-write own bucket; window must encode a server-time-derivable
      // start (e.g. floor(request.time.toMillis() / WINDOW_MS) * WINDOW_MS).
      allow create: if isAuthed() && request.auth.uid == uid
                    && int(windowStart) <= request.time.toMillis()
                    && int(windowStart) > request.time.toMillis() - 60000
                    && request.resource.data.count == 1;
      allow update: if isAuthed() && request.auth.uid == uid
                    && immutable("uid")
                    && request.resource.data.count == resource.data.count + 1
                    && request.resource.data.count <= 30;     // 30/60s budget
      allow delete: if false;
    }
```

The exact arithmetic + window granularity is for the planner to fix per ARCHITECTURE.md §3 / `rateLimitedChatWrite` row + Pitfall 9. The shape follows the Phase 5 `mutableOnly` / `immutable` library + claims predicates (lines 22–27).

**Paste-ready excerpt — `tests/rules/firestore.test.js` lines 36–50 + 162–173 + 534–538 (rules-unit-testing setup, lifecycle hooks, and the existing auditLog cells Phase 7 expands):**

```javascript
import {
  initRulesEnv,
  asUser,
  ROLES,
  assertSucceeds,
  assertFails,
} from "./setup.js";

let testEnv;
const claimsByRole = Object.fromEntries(ROLES.map((r) => [r.role, r.claims]));

beforeAll(async () => {
  testEnv = await initRulesEnv("firestore", "fs-matrix");
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedFixtures();
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

// ... (later in the file: the auditLog cells Phase 7 expands) ...

  // auditLog/{eventId} - AUDIT-07: internal CANNOT read; only admin
  { role: "internal", path: "auditLog/e1", op: "read", expected: "deny" },
  { role: "admin", path: "auditLog/e1", op: "read", expected: "allow" },
  { role: "client_orgA", path: "auditLog/e1", op: "read", expected: "deny" },
  { role: "admin", path: "auditLog/e2", op: "create", expected: "deny" }, // server-only writes
```

**Paste-ready excerpt — `tests/rules/setup.js` lines 24–88 (the `initRulesEnv` + `asUser` + ROLES factory the new `tests/rules/auditLog.test.js` re-uses verbatim):**

```javascript
export async function initRulesEnv(service, projectIdSuffix = "default") {
  const projectId = `demo-rules-${projectIdSuffix}`;
  const config =
    service === "firestore"
      ? {
          projectId,
          firestore: {
            rules: readFileSync(
              resolve(process.cwd(), "firestore.rules"),
              "utf8",
            ),
            host: "127.0.0.1",
            port: 8080,
          },
        }
      : {
          projectId,
          storage: {
            rules: readFileSync(
              resolve(process.cwd(), "storage.rules"),
              "utf8",
            ),
            host: "127.0.0.1",
            port: 9199,
          },
        };
  return initializeTestEnvironment(config);
}

/** ROLES per D-16 - 5 roles cover the full matrix. */
export const ROLES = [
  { role: "anonymous", claims: {} },
  { role: "client_orgA", claims: { role: "client", orgId: "orgA", email_verified: true } },
  { role: "client_orgB", claims: { role: "client", orgId: "orgB", email_verified: true } },
  { role: "internal", claims: { role: "internal", orgId: null, email_verified: true } },
  { role: "admin", claims: { role: "admin", orgId: null, email_verified: true } },
];

export function asUser(testEnv, roleName, claims) {
  if (roleName === "anonymous")
    return testEnv.unauthenticatedContext().firestore();
  return testEnv
    .authenticatedContext(roleName, {
      ...claims,
      firebase: { sign_in_provider: "password" },
    })
    .firestore();
}
```

**Phase 7 `tests/rules/auditLog.test.js` cells to add** (uses the exact same harness; the planner enumerates these as a per-row matrix mirroring `firestore.test.js:305`'s `CELLS` array):

- Admin write to `auditLog/anything` → DENY (server-only writes)
- Internal write to `auditLog/anything` → DENY
- Client write to `auditLog/anything` → DENY
- Audited user (uid X) read `auditLog/{eventWithActorUid:X}` → DENY (Pitfall 17 — audited cannot read own audit record)
- Admin read any auditLog row → ALLOW
- New rateLimits self-bucket cells matching the new predicate (allow self-create at current window; deny cross-uid; deny count > 30; deny windowStart in the future)

**App Check enforcement on Storage** (storage.rules — referenced in 07-CONTEXT.md SC#2 as "App Check enforcement turned on per service"): `storage.rules` already enforces `inOrg` predicate (lines 12–16) — the App Check toggle is at the Firebase Console / service-level, not in-rules. No rules edit needed for that toggle.

---

## Pattern E — App Check init in `src/firebase/check.js`

**Modified file:** `src/firebase/check.js` (currently a Phase 4 empty stub)

**Closest analogs:**
- `src/firebase/check.js` itself (the stub seam already in place — Phase 7 only fills the body)
- `src/firebase/app.js` (the boot order that calls `initAppCheck(app)` immediately after `initializeApp` — line 23)
- `src/firebase/db.js` (the eager-singleton + adapter pattern — `export const db = getFirestore(app);` at line 32 is the shape `check.js` mirrors with `export const appCheck = initializeAppCheck(...)`)

**Paste-ready excerpt — `src/firebase/check.js` lines 1–16 (existing stub — Phase 7 replaces the body, leaves the signature alone so `app.js` boot ordering is untouched):**

```js
// src/firebase/check.js
// @ts-check
// Phase 7 (FN-04) replaces the body with:
//   initializeAppCheck(app, {
//     provider: new ReCaptchaEnterpriseProvider(siteKey),
//     isTokenAutoRefreshEnabled: true,
//   })
// Phase 4 (D-07): no-op stub. The exported function exists so src/firebase/app.js
// can call initAppCheck(app) at boot — Phase 7 fills the body, zero adapter-shape
// change. Same stub pattern as src/cloud/* and src/observability/* per D-11.

/** @param {*} _app */
export function initAppCheck(_app) {
  /* Phase 7 (FN-04) body lands here */
}
```

**Paste-ready excerpt — `src/firebase/app.js` lines 1–28 (full file — boot order Phase 7 must NOT disturb):**

```js
// src/firebase/app.js
// @ts-check
// Phase 4 (D-05 / D-06): per-feature SDK adapter — eager sync init at module load.
// Replaces firebase-init.js (deleted in this commit). Phase 7 (FN-04) wires
// src/firebase/check.js body without re-ordering this.
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { initAppCheck } from "./check.js";

const firebaseConfig = {
  apiKey: "AIzaSyDV3RNRFxAoVkSHOMyfl6HqgGTwaenLYfY",
  authDomain: "bedeveloped-base-layers.firebaseapp.com",
  projectId: "bedeveloped-base-layers",
  storageBucket: "bedeveloped-base-layers.firebasestorage.app",
  messagingSenderId: "76749944951",
  appId: "1:76749944951:web:9d0db9603ecaa7cc5fee72",
};

export const app = initializeApp(firebaseConfig);
initAppCheck(app); // Phase 7 (FN-04) replaces the body
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);
```

**Phase 7 target body for `src/firebase/check.js`** (assembled per ARCHITECTURE.md §2 + STACK.md line 48 — reCAPTCHA Enterprise provider is the locked-in choice):

```js
// src/firebase/check.js  — Phase 7 (FN-04) target shape
// @ts-check
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY ?? "";

/** @param {import("firebase/app").FirebaseApp} app */
export function initAppCheck(app) {
  if (!SITE_KEY) {
    // Local-dev / emulator path; debug token comes from .env.local
    // (ARCHITECTURE.md §3 + 07-CONTEXT.md SC#2 "debug tokens live only in .env.local")
    if (typeof self !== "undefined") {
      /** @type {*} */ (self).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    return null;
  }
  return initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}
```

The `firebase/app-check` import is already enumerated in the Wave 1 ESLint-no-restricted-imports allowlist (`firebase/app | firebase/auth | firebase/firestore | firebase/storage | firebase/app-check | firebase/functions` are the only Firebase paths permitted, and only inside `src/firebase/**`). Per `SECURITY.md:178–182`, this guard is already error-level — `src/firebase/check.js` is the unique permitted import site.

**Client-side callable wrappers — `src/cloud/auditWrite.js` and `src/cloud/checkRateLimit.js`** (mirror `src/cloud/claims-admin.js` lines 1–17 verbatim):

```js
// src/cloud/claims-admin.js — paste-ready analog
// @ts-check
// Phase 6 Wave 3 (AUTH-07 / Pattern D): wires the setClaims callable through
// src/firebase/functions.js. The boundary contract - cloud/* imports
// firebase/functions.js, never firebase/functions SDK directly - is preserved
// per Phase 4 ESLint Wave 1 + ARCHITECTURE.md section 2 dep matrix.
import { functions, httpsCallable } from "../firebase/functions.js";

const setClaimsCallable = httpsCallable(functions, "setClaims");

/**
 * @param {{ uid: string, role?: string, orgId?: string }} input
 * @returns {Promise<void>}
 */
export async function setClaims(input) {
  await setClaimsCallable(input);
}
```

The existing Phase 4 `src/cloud/audit.js` stub (lines 1–17) already declares `writeAuditEvent({event, payload})` — Phase 7 replaces the empty body with the same `httpsCallable(functions, "auditWrite")` pattern + a generated `clientReqId` for the idempotency marker. Same shape for `checkRateLimit`.

---

## Pattern F — Cloud Logging structured log → BigQuery sink

**No new in-repo file** — this is a Firebase Console / GCP infrastructure step (Cloud Logging Data Access logs → BigQuery dataset `audit_logs_bq` per 07-CONTEXT.md SC#4). The code-side analog is the **structured-log shape** every Cloud Function already emits — Phase 7 just adds a Cloud Logging sink configured at the GCP-project level.

**Closest analog:** `functions/src/csp/cspReportSink.ts` lines 96–104 (the canonical structured-log invocation in this codebase — `logger.warn(message, structuredObj)` yields a queryable jsonPayload):

```ts
    // Step 7 — structured Cloud Logging (D-10a / RESEARCH.md §Pattern 2).
    // logger.warn(message, structuredObj) yields severity=WARNING with a
    // queryable jsonPayload. Cloud Logging Logs Explorer query:
    //   resource.type="cloud_run_revision"
    //   severity=WARNING
    //   jsonPayload.message="csp.violation"
    logger.warn("csp.violation", { report, fingerprint: fingerprint(report) });
```

Same pattern in `functions/src/auth/beforeUserCreated.ts:35–40` (`logger.info("auth.user.created", {uid, email, role, orgId})`), `functions/src/auth/setClaims.ts:49–54`, and `functions/src/auth/beforeUserSignedIn.ts:17–22`.

**STACK.md line 117 (the source-of-truth row for this pattern):**

> **Cloud Logging (Audit Logs)** — Not configured → **Enable Firestore Data Access audit logs**, route to a BigQuery sink with 1-year retention. Log entries are tamper-evident (Cloud Logging is append-only). This is the _infrastructure-level_ audit log — pairs with the _application-level_ audit-log Firestore collection.
> SOC2 CC7.2 + CC7.3, ISO 27001 A.12.4.1, GDPR Art. 32(1)(d)

**Phase 7 deliverables this row drives** (planner produces a runbook step + SECURITY.md section, no code change):

1. GCP Console → Cloud Logging → Logs Router → create sink `audit-logs-bq`
2. Filter: `resource.type = "cloud_run_revision" AND severity >= "INFO" AND jsonPayload.message =~ "^auth\\.|^audit\\.|^csp\\."` (the canonical message-name prefixes the codebase uses — `auth.user.created`, `auth.user.signin`, `auth.claims.set`, `csp.violation`, plus Phase 7's new `audit.*` prefixes)
3. Destination: BigQuery dataset `audit_logs_bq` (must be created first; partitioned-by-day; **7-year retention** per 07-CONTEXT.md SC#4 — note this is 7y, not the STACK.md placeholder 1y; SC#4 wins)
4. Service account: the auto-created `serviceAccount:p<projectNumber>-XXXX@gcp-sa-logging.iam.gserviceaccount.com` granted `roles/bigquery.dataEditor` on the dataset

**Code convention reinforced for Phase 7's new Functions:** every `auditWrite`, `onOrgDelete`, `onUserDelete`, `onDocumentDelete`, `checkRateLimit` MUST emit a `logger.info("audit.<event>", {…})` entry with the same shape (`uid`, `actor`, `target`, `at`) so the sink filter captures it. The BigQuery row schema is auto-derived from the structured `jsonPayload`.

**Pitfall 17 closure check:** Cloud Logging audit IS the infrastructure-level audit; the Firestore `auditLog/{eventId}` collection IS the application-level audit. Phase 7 wires both — they're complementary, not redundant (per ARCHITECTURE.md §3 and STACK.md:117).

---

## Pattern G — `SECURITY.md ## § Phase 7 Audit Index`

**Modified file:** `SECURITY.md` (append section after line 745 "Phase 6 Audit Index" and before line 754 "Cross-phase plug-ins this index will feed:")

**Closest analog:** `SECURITY.md` lines 724–745 — the §Phase 6 Audit Index 15-row table

**Paste-ready excerpt — `SECURITY.md` lines 724–745 (full §Phase 6 Audit Index — copy this header + table shape verbatim, swap rows for Phase 7 controls):**

```markdown
## § Phase 6 Audit Index

This is a one-stop pointer for an auditor walking Phase 6's controls. Each row maps a Phase 6 control to (a) the SECURITY.md section + decision that defines it, (b) the code path that implements it, (c) the test that verifies it, and (d) the framework citations it addresses. Mirrors the §Phase 3 Audit Index + §Phase 5 Audit Index pattern.

| Audit row | Control | Code path | Test | Framework |
|-----------|---------|-----------|------|-----------|
| beforeUserCreated claims-set | AUTH-03 / AUTH-05 / D-10 / Pitfall 6 | `functions/src/auth/beforeUserCreated.ts` + `functions/src/auth/claim-builder.ts` | `functions/test/auth/claim-builder.test.ts` | ASVS V2.4 / ISO A.5.17 / SOC2 CC6.1 |
| beforeUserSignedIn audit substrate | AUTH-06 / D-21 | `functions/src/auth/beforeUserSignedIn.ts` | (Phase 7 TEST-09 integration tests) | ASVS V2.5 / SOC2 CC6.7 |
| setClaims callable + poke pattern | AUTH-07 / ARCHITECTURE.md §7 Flow C | `functions/src/auth/setClaims.ts` + `src/cloud/claims-admin.js` | (Phase 7 TEST-09) | ASVS V4.1.1 |
| TOTP MFA enrol | AUTH-08 / D-08 | `src/views/auth.js` renderMfaEnrol + `src/firebase/auth.js` multiFactor | `tests/views/auth.test.js` mfa-enrol snapshot | ASVS V2.7 / ISO A.8.5 / SOC2 CC6.1 |
| Password policy >=12 + HIBP | AUTH-04 | (Identity Platform server-side) | `06-PREFLIGHT.md ## passwordPolicy` + cutover Step 4 manual smoke | ASVS V2.1.1 / GDPR Art 32(1)(b) |
| AUTH-12 unified-error wrapper | AUTH-12 / D-13 | `src/firebase/auth.js` SignInError + AUTH_CRED_ERROR_CODES set | `tests/views/auth.test.js` (renderSignIn behaviour) | ASVS V2.6 / OWASP Top 10 A07 |
| Anonymous Auth source removal | AUTH-01 / C1 / D-03 / D-04 | (deletion in cutover commit `auth14_deletion_sha: 3fddc1c`) | `grep -r "signInAnonymously" src/` returns 0 | (audit-narrative integrity) |
| RULES-07 production deploy | RULES-07 / D-11 | `firestore.rules` + `storage.rules` deployed | RULES-07 verification gate (`runbooks/phase-6-cleanup-ledger.md ## RULES-07 Deploy Verification Gate`) — exactly one deploy chain against bedeveloped-base-layers in the phase commit chain | ASVS V4 / SOC2 CC6.1 |
| 5-min rollback rehearsal | SC#4 / D-12 / Pitfall 19 | `runbooks/phase6-rules-rollback-rehearsal.md` | runbook `rehearsal_total_seconds: 121` (< 300) | SOC2 CC9.1 / ISO A.5.30 |
| AUTH-10 MFA drill (Tier-2) | AUTH-10 / D-08 / Pitfall 7 / Pitfall 19 | `runbooks/phase6-mfa-recovery-drill.md` + `scripts/admin-mfa-unenroll/run.js` | runbook drill evidence (skeleton present; populated end-of-phases-batch per operator deferral) | ASVS V2.7.4 / SOC2 CC6.1 |
| AUTH-14 source deletions | AUTH-14 / C2 / D-04 | (partial deletion in cutover commit `auth14_deletion_sha: 3fddc1c` — runtime constants + signInAnonymously call + firebase-ready bridge gone; state-machine.js + 2 test fixtures + .gitleaks.toml C2 rule deferred to Phase 4 sub-wave 4.1 per `phase-6-cleanup-ledger.md`) | partial verification: `grep -r "INTERNAL_PASSWORD_HASH\|INTERNAL_ALLOWED_EMAILS" src/` returns 0; full closure pending sub-wave 4.1 | (audit-narrative integrity) |
| AUTH-09 supersession | AUTH-09 / D-07 | (no code path — supersession is a documented decision) | `.planning/REQUIREMENTS.md` AUTH-09 row marks SUPERSEDED 2026-05-08 by email-link recovery | (compliance-credible posture per D-07) |
| AUTH-13 progressive delay | AUTH-13 / D-21 | (Firebase Auth defaults) | `runbooks/phase6-cutover.md` Step 4 manual smoke; `auth/too-many-requests` documented behaviour | ASVS V2.1.5 |
| AUTH-15 bootstrap migration | AUTH-15 / D-05 | `scripts/seed-internal-allowlist/run.js` + `runbooks/phase6-bootstrap.md` | `06-PREFLIGHT.md ## Cutover Log: bootstrap_log_*` populated for both admins; Luke first-signin verified | ASVS V2.4.5 |
| AUTH-11 email-verify (belt-and-braces) | AUTH-11 / D-14 | `firestore.rules` `isAuthed()` predicate (server) + `src/views/auth.js` renderEmailVerificationLanding (client) + `src/router.js` auth-state ladder | `tests/views/auth.test.js` renderEmailVerificationLanding test | ASVS V2.5 / GDPR Art 32(1)(b) |

**Cross-phase plug-ins this index will feed:**
```

**Phase 7 target rows** (planner fills paths/tests as Phase 7 ships them — this is the row enumeration the index must cover, derived from 07-CONTEXT.md SC#1–6 + AUDIT/FN/TEST requirement IDs):

| Audit row | Control | Code path | Test | Framework |
|-----------|---------|-----------|------|-----------|
| auditWrite callable + App Check + Zod + idempotency | FN-03 / FN-07 / AUDIT-01 / Pitfall 17 | `functions/src/audit/auditWrite.ts` + `src/cloud/auditWrite.js` | `functions/test/audit/auditWrite.test.ts` (firebase-functions-test v3) | ASVS V4.1 / V11.1 / ISO A.8.15 / SOC2 CC7.2 |
| auditLog Firestore predicate (deny-all writes; deny-self-read) | AUDIT-07 / Pitfall 17 | `firestore.rules` `match /auditLog/{eventId}` block | `tests/rules/auditLog.test.js` | ASVS V4 / SOC2 CC7.3 / ISO A.8.15 |
| Firestore-trigger audit mirrors (onOrgDelete, onDocumentDelete) | AUDIT-02 / AUDIT-03 / FN-01 | `functions/src/audit/onOrgDelete.ts` + `onDocumentDelete.ts` | `functions/test/audit/onOrgDelete.test.ts` | SOC2 CC7.2 / ISO A.8.15 |
| Auth-trigger audit mirror (onUserDelete) | AUDIT-04 / FN-01 | `functions/src/audit/onUserDelete.ts` | `functions/test/audit/onUserDelete.test.ts` | SOC2 CC6.7 / GDPR Art. 17 |
| Cloud Logging → BigQuery 7y sink | AUDIT-06 | (GCP Console — sink config in runbook) | `runbooks/phase-7-cloud-logging-sink.md` | SOC2 CC7.2 / ISO A.12.4.1 / GDPR Art. 32(1)(d) |
| Per-user rate limit (rules predicate primary) | FN-09 | `firestore.rules` `match /rateLimits/{uid}/buckets/{windowStart}` | `tests/rules/firestore.test.js` rateLimits cells | OWASP A04:2021 / ASVS V11.1 |
| Per-user rate limit (callable fallback) | FN-09 | `functions/src/ratelimit/checkRateLimit.ts` + `src/cloud/checkRateLimit.js` | `functions/test/ratelimit/checkRateLimit.test.ts` | OWASP A04:2021 |
| App Check enrolment (reCAPTCHA Enterprise) | FN-04 | `src/firebase/check.js` `initAppCheck` | manual smoke + Firebase Console enforcement-mode soak ≥7d | OWASP A05:2025 / SOC2 CC6.6 / GDPR Art. 32(1)(b) |
| App Check enforcement turned on (Storage → Firestore → Functions order) | FN-04 / FN-07 | (Firebase Console) | `runbooks/phase-7-app-check-enforcement.md` (soak evidence + per-service flip dates) | SOC2 CC6.6 / ISO A.13.1 |
| Idempotency-key marker (5-min window) | FN-03 | `functions/src/util/idempotency.ts` | `functions/test/util/idempotency.test.ts` (vi.useFakeTimers — pattern from `functions/test/csp/dedup.test.ts`) | ASVS V11.1 / SOC2 CC8.1 |
| Zod input validation on every callable | FN-03 | `functions/src/util/zod-helpers.ts` + per-callable schemas | `functions/test/util/zod-helpers.test.ts` | ASVS V5.1 / OWASP A03:2021 |
| Per-function minimal-IAM service accounts | FN-05 / FN-06 / Pitfall 13 | `functions/src/*/index.ts` `serviceAccount:` option | `runbooks/phase-7-iam-bootstrap.md` (each function lists its bound SA) | SOC2 CC6.1 / ISO A.5.18 |
| Secret management via `defineSecret()` | FN-06 / Pitfall 13 | `functions/src/*` `defineSecret()` declarations | `npm run build` succeeds with no env-var literal grep hits | ISO A.8.24 / SOC2 CC6.1 |
| Auth-blocking minInstances:1 + cold-start p99 ≤ 4s | FN-08 / Pitfall 12 | `functions/src/auth/beforeUserCreated.ts` + `beforeUserSignedIn.ts` `minInstances:1` | Cloud Monitoring p99 dashboard + cutover-day soak | SOC2 A1.1 |
| firebase-functions-test v3 integration coverage | TEST-09 | `functions/test/**/*.test.ts` (auditWrite + setClaims + Firestore-trigger writers) | `npm run test --prefix functions` exits 0 | SOC2 CC8.1 / ISO A.8.29 |
| D-22 ToS gate resolution (firebaseauth.googleapis.com) | (Phase 6 carry-forward — runbooks/phase-6-cleanup-ledger.md sub-wave 6.1) | (operator action OR callable claims-setter wiring) | `runbooks/phase-7-cleanup-ledger.md` D-22 closure row | (audit-narrative integrity — Pitfall 19) |

15+ rows mirrors the §Phase 6 Audit Index density.

---

## Pattern H — `runbooks/phase-7-cleanup-ledger.md` zero-out gate

**New file:** `runbooks/phase-7-cleanup-ledger.md`

**Closest analog:** `runbooks/phase-6-cleanup-ledger.md` (the most recent Pattern H exemplar — Phase 5 ledger is also valid but Phase 6 is the one to mirror because Phase 7 inherits Phase 6's sub-wave 6.1 carry-forward rows AND queues its own forward-tracking rows for Phase 8/9/12).

**Paste-ready excerpt — `runbooks/phase-6-cleanup-ledger.md` lines 1–50 (header + closed-rows table + RULES-07 verification gate shape):**

```markdown
# Phase 6 Cleanup Ledger

> Phase 6 Wave 6 deliverable. Closes Phase 5 D-21 carry-forward rows + Phase 4 D-?? bridge retirement + queues 4 forward-tracking phase rows for Phase 7 / 9 / 10 / 11 per D-17. Mirrors `runbooks/phase-5-cleanup-ledger.md` and `runbooks/phase-4-cleanup-ledger.md` Pattern H shape.
>
> Substrate-honest: where Phase 6 closed a row at the substrate level but the data-side / IIFE-migration-side closure is paced by another phase or another sub-wave, the row is closed here AND a sub-wave 6.1 carry-forward row is added below to track the deferred remediation.

## Phase 6 — closed (zero-out at phase close)

These rows tracked work that Phase 6 was supposed to close. All resolved during Wave 5 + Wave 6 at the substrate level.

| Row | Originated in | Closure event | Closure evidence |
|-----|---------------|---------------|------------------|
| anonymous-auth-substrate retirement (runtime) | Phase 5 D-21 (carry-forward from Phase 4 firebase-ready bridge) | Phase 6 Wave 5 cutover commit | `06-PREFLIGHT.md ## Cutover Log: auth14_deletion_sha: 3fddc1c`; `grep -r "signInAnonymously" src/` returns 0; `firebase-ready` bridge listener removed from `src/main.js` + `src/firebase/auth.js` |
| INTERNAL_PASSWORD_HASH + INTERNAL_ALLOWED_EMAILS runtime constants deletion | Phase 5 D-21 | Phase 6 Wave 5 cutover commit | `06-PREFLIGHT.md ## Cutover Log: auth14_deletion_sha: 3fddc1c`; `grep -r "INTERNAL_PASSWORD_HASH\|INTERNAL_ALLOWED_EMAILS" src/` returns 0 |
| RULES-07 production deploy | Phase 5 D-21 / RULES-06 verification carry-forward | Phase 6 Wave 5 Step 6 | `06-PREFLIGHT.md ## Cutover Log: rules_deploy_sha: 3fddc1c` + manual local-CLI re-deploy 2026-05-09T~17:00Z; gate verification below |
[...elided rows...]

## RULES-07 Deploy Verification Gate

Per Phase 6 D-11 + D-12 + Wave 6 Task 3: assert `firebase deploy --only firestore:rules,storage:rules` (or equivalent CI deploy chain) ran exactly once against `bedeveloped-base-layers` during the Phase 6 SHA chain.

```
gate_check_date: 2026-05-09T20:34Z
gate_input_evidence_path: .planning/phases/06-real-auth-mfa-rules-deploy/06-PREFLIGHT.md
rules_deploy_sha: 3fddc1c (squash-merge of PR #3 to main 2026-05-09T16:18:22Z; ...)
phase_6_sha_range: 801f1a8..3fddc1c
deploy_invocation_count_in_phase: 1
gate_result: PASS
```

If `gate_result: FAIL` (count != 1), Phase 6 cannot close. Escalate.
```

**Paste-ready excerpt — `runbooks/phase-6-cleanup-ledger.md` lines 87–96 (closure status block — the zero-out gate Pattern H mandates):**

```markdown
## Phase 6 — Cleanup Ledger Status

```
ledger_close_date: 2026-05-09T20:34Z
phase_6_active_rows: 0
phase_6_closed_rows: 8
phase_6_sub_wave_6_1_carry_forward_rows: 11
forward_tracking_rows_queued: 7 (4 phase-tagged: 7 / 9 / 10 / 11; +3 sub-rows under Phase 7 — FN-09 / FN-03+FN-07 / TEST-09)
gate_status: PASS
```

`phase_6_active_rows: 0` indicates no row that originated as Phase 6's responsibility remains open without a documented closure path. The 11 sub-wave 6.1 rows are open BUT explicitly bounded — each names its closure phase / sub-wave and the load-bearing predecessor. Substrate-honest per Pitfall 19.
```

**Paste-ready excerpt — `runbooks/phase-6-cleanup-ledger.md` lines 56–67 (the Phase 7 forward-tracking rows already queued in Phase 6 — these are the ENTRY rows for `phase-7-cleanup-ledger.md`'s "Phase 7 — closed" table):**

```markdown
## Phase 7 — forward-tracking (queued, not started)

Rows added by Phase 6 Wave 6 per D-17 to track Phase 7's owned work.

| Row | Reason | Phase | Owner |
|-----|--------|-------|-------|
| `auditLog/{eventId}` Firestore-side writer (back-fills Phase 6 Cloud-Logging-only audit substrate) | Phase 6 D-21 + Pitfall 17 — Phase 6 logs to Cloud Logging only; Phase 7 wires the persistent audit substrate | Phase 7 | FN-01 + AUDIT-01..04 |
| `rateLimits/{uid}/buckets/{windowStart}` predicate replaces Phase 5 `allow write: if false` deny-block | Phase 5 RULES-03 deny-block was a placeholder; Phase 7 replaces with the rate-limit predicate body | Phase 7 | FN-09 |
| `enforceAppCheck: true` on setClaims (+ all callables); Zod input validation; idempotency-key marker | Phase 6 ARCHITECTURE.md §3 — Phase 7 hardens callables; Phase 6 ships minimal manual gate only | Phase 7 | FN-03 + FN-07 |
| firebase-functions-test integration coverage of beforeUserCreated + beforeUserSignedIn + setClaims | Phase 6 unit-tests pure claim-builder.ts only; Phase 7 owns integration test suite | Phase 7 | TEST-09 |
```

**Phase 7 cleanup-ledger structural target** (target sections + the rows Phase 7 closes vs queues forward — matches Phase 6 ledger shape):

```markdown
# Phase 7 Cleanup Ledger

> Phase 7 Wave N deliverable. Closes the 4 Phase 6 forward-tracking rows (FN-01/AUDIT, FN-09, FN-03+FN-07, TEST-09) + a subset of Phase 6 sub-wave 6.1 carry-forward rows (D-22 ToS gate; cspReportSink redeploy follow-through). Queues forward-tracking rows for Phase 8/9/12. Mirrors `runbooks/phase-6-cleanup-ledger.md` Pattern H shape.

## Phase 7 — closed (zero-out at phase close)

| Row | Originated in | Closure event | Closure evidence |
| auditWrite callable shipped (FN-03 + FN-07) | Phase 6 forward-tracking row (queued from `phase-6-cleanup-ledger.md`) | Phase 7 Wave N | `functions/src/audit/auditWrite.ts` deployed to europe-west2; `npm run test --prefix functions` includes auditWrite.test.ts; rules-unit-test pins server-only-write |
| auditLog/{eventId} predicate live + tested (AUDIT-07) | (Phase 5 placeholder; Phase 6 forward-tracking) | Phase 7 Wave N | `firestore.rules` `match /auditLog/...` deployed; `tests/rules/auditLog.test.js` exits 0 |
| rateLimits predicate replaces deny-block (FN-09) | Phase 5 D-21 forward-tracking; Phase 6 forward-tracking | Phase 7 Wave N | `firestore.rules` rateLimits block + `tests/rules/firestore.test.js` rateLimits cells |
| Firestore-trigger audit mirrors (AUDIT-02..04) | Phase 6 forward-tracking | Phase 7 Wave N | `functions/src/audit/onOrgDelete.ts` + `onUserDelete.ts` + `onDocumentDelete.ts` deployed |
| Cloud Logging → BigQuery 7y sink (AUDIT-06) | New in Phase 7 | Phase 7 Wave N | `runbooks/phase-7-cloud-logging-sink.md` + GCP Console screenshot evidence |
| App Check enrolment (FN-04) + enforcement (FN-07) | New in Phase 7 | Phase 7 Wave N | `src/firebase/check.js` body filled; Firebase Console enforcement-mode soak ≥7d evidence in `runbooks/phase-7-app-check-enforcement.md` |
| firebase-functions-test integration coverage (TEST-09) | Phase 6 forward-tracking | Phase 7 Wave N | `functions/test/audit/*.test.ts` + `functions/test/auth/*.test.ts` (setClaims, beforeUserCreated under firebase-functions-test) green |
| D-22 ToS gate resolution | Phase 6 sub-wave 6.1 carry-forward | Phase 7 Wave N | `firebaseauth.googleapis.com` enabled in GCP Console + `gcp-sa-firebaseauth` SA bound to `roles/run.invoker` on the 4 Cloud Run services |
| cspReportSink wiring follow-through (Phase 3 carry-forward) | Phase 6 sub-wave 6.1 row | (closes here OR carries to Phase 9 OBS) | `runbooks/phase-7-cleanup-ledger.md` row marks closure or re-queues with explicit reason |

## Phase 7 — App Check Enforcement Verification Gate

Mirror of Phase 6's RULES-07 Deploy Verification Gate. Per 07-CONTEXT.md SC#2: enforcement was turned on **per service** (Storage → Firestore collection-by-collection → Cloud Functions) AFTER ≥7d soak in unenforced mode.

```
gate_check_date: <YYYY-MM-DDTHH:MMZ>
gate_input_evidence_path: runbooks/phase-7-app-check-enforcement.md
soak_window_days: 7+
enforcement_flip_storage_at: <ISO>
enforcement_flip_firestore_at: <ISO>
enforcement_flip_functions_at: <ISO>
quota_alert_at_70_percent_configured: true
unenforced_dashboard_screenshot_evidence: <path>
gate_result: PASS | FAIL
```

If `gate_result: FAIL`, Phase 7 cannot close. Escalate.

## Phase 7 sub-wave 7.1 — carry-forward (substrate-honest, optional)

(Only populate if Phase 7 must defer; default state is empty — Phase 7 success criteria are tightly bounded.)

## Phase 8 — forward-tracking (queued)
| `softDelete` + `restoreSoftDeleted` callables wired through src/cloud/soft-delete.js | Phase 4 stub seam (existing row from `phase-5-cleanup-ledger.md`) | Phase 8 | LIFE-04 |
| `gdprExportUser` + `gdprEraseUser` callables wired through src/cloud/gdpr.js | Phase 4 stub seam | Phase 8 | GDPR-01 / GDPR-02 |
| Pre-migration export bucket lifecycle policy (Phase 5 carry-forward) | Phase 5 D-21 | Phase 8 | BACKUP-02 |
| migrations/{stepId}/items/{docId} idempotency markers cleanup | Phase 5 D-21 | Phase 8 | BACKUP-07 |

## Phase 9 — forward-tracking (queued)
| `auditWrite` view-side wiring (sign-in, sign-out, role change, delete, export, MFA enrol, password change) | Phase 6 D-21 + Phase 7 makes the writer available | Phase 9 | AUDIT-05 |

## Phase 12 — forward-tracking (queued)
| 6 stray pre-Phase-4 root-collection docs deletion scripts archive | Phase 5 D-21 | Phase 12 | (audit-walkthrough close) |

## Phase 7 — Cleanup Ledger Status

```
ledger_close_date: <ISO>
phase_7_active_rows: 0
phase_7_closed_rows: <count>
phase_7_sub_wave_7_1_carry_forward_rows: <count, ideally 0>
forward_tracking_rows_queued: <count> (phase-tagged: 8 / 9 / 12)
gate_status: PASS
```

`phase_7_active_rows: 0` is the zero-out gate — no row originating as Phase 7's responsibility remains open without a documented closure path.
```

This Pattern H ledger structurally mirrors Phase 6's exact section ordering: (1) closed-rows table, (2) verification gate (App Check enforcement substituting RULES-07 deploy), (3) sub-wave carry-forward (substrate-honest), (4) per-future-phase forward-tracking tables, (5) closure status zero-out block, (6) citations.

---

## Shared Patterns

### Cloud Functions structural conventions (apply to ALL new `functions/src/**/*.ts` files)

**Source:** ARCHITECTURE.md §3 lines 337–346 + `functions/src/auth/setClaims.ts` (concrete exemplar)

| Convention | Where applied | Excerpt source |
|------------|---------------|----------------|
| Each function in its own file, `index.ts` only re-exports | All new files in `functions/src/audit/`, `functions/src/ratelimit/` | `functions/src/index.ts` (existing; Phase 7 extends) |
| Region pin `europe-west2` | All new Functions | `setClaims.ts:29`, `cspReportSink.ts:35`, `beforeUserCreated.ts:23`, `beforeUserSignedIn.ts:15` |
| Admin SDK init guard `if (!getApps().length) initializeApp();` | Every Function file that touches Firestore/Auth | `setClaims.ts:20`, `beforeUserCreated.ts:20` |
| Structured `logger.info\|warn(message, {fields})` from `firebase-functions/logger` | Every Function | `cspReportSink.ts:27`, `setClaims.ts:15`, `beforeUserCreated.ts:15` |
| TypeScript strict; Node 22; commonjs target | Whole `functions/` workspace | `functions/tsconfig.json` lines 1–18 + `functions/package.json:5` (`"node": "22"`) |
| Re-read claims from `request.auth.token` server-side, NEVER from payload | All callables | `setClaims.ts:31` (`request.auth?.token?.role !== "admin"`) |
| `enforceAppCheck: true` on every callable | Phase 7 ADDS to setClaims + new callables | `setClaims.ts:29` (current comment marks deferral; Phase 7 closes) |
| Zod input validation; reject malformed early | Phase 7 ADDS via `functions/src/util/zod-helpers.ts` | (per ARCHITECTURE.md §3 line 342) |
| Idempotency marker (5-min window) on every callable side-effect | Phase 7 ADDS via `functions/src/util/idempotency.ts` | (per ARCHITECTURE.md §3 line 341) |
| `defineSecret()` for secrets; ADC for scripts; never JSON SA in repo | Phase 7 introduces (Pitfall 13) | (no in-repo analog yet — STACK.md line 84 + ARCHITECTURE.md §3 line 346) |

### Client adapter boundary (apply to `src/cloud/*.js` and `src/firebase/check.js`)

**Source:** ARCHITECTURE.md §2.4 + `eslint.config.js` Wave-1-through-Wave-4 boundaries

`src/cloud/*` may import only from `src/firebase/functions.js` (NEVER from `firebase/functions` SDK directly). `src/firebase/check.js` is the unique permitted import site for `firebase/app-check`. Already lint-error-level — Phase 7 must NOT introduce a `firebase/functions` direct import outside `src/firebase/`.

**Source-of-truth excerpt** (`SECURITY.md:178–182`):

> - `**/*.js` (excluding `src/firebase/**`) cannot import `firebase/firestore | firebase/storage | firebase/auth | firebase/app-check | firebase/functions` directly (Wave 1)

### Vitest test seam parity (apply to all new `functions/test/**/*.test.ts` and `tests/rules/*.test.js`)

**Source:** `functions/test/auth/claim-builder.test.ts` (pure-logic) + `tests/rules/firestore.test.js` (rules emulator) + `functions/test/csp/dedup.test.ts` (vi.useFakeTimers for window-based logic)

| Test class | Pattern | Analog file |
|-----------|---------|-------------|
| Pure-logic (auditLogger, idempotency.compute, zod-helpers) | `import { describe, it, expect } from "vitest";` + `it.each([...])` | `functions/test/auth/claim-builder.test.ts:1-32` |
| Time-window logic (idempotency 5-min marker; rate-limit 60s window) | `vi.useFakeTimers()` + `vi.advanceTimersByTime(MS)` | `functions/test/csp/dedup.test.ts:13-37` |
| Rules-unit-testing (auditLog read/write predicates + rateLimits cells) | `initRulesEnv("firestore", "<suffix>")` + `asUser` + `assertSucceeds`/`assertFails` | `tests/rules/firestore.test.js:36-50, 162-173` + `tests/rules/setup.js:24-88` |
| Function integration (firebase-functions-test v3) | `import { wrap } from "firebase-functions-test";` against `setClaims`, `auditWrite`, etc. | (no in-repo analog — TEST-09 is Phase 7's first integration-test target; STACK.md:84 enumerates the package) |

---

## No Analog Found (planner uses RESEARCH.md / external docs)

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| BigQuery sink config (Cloud Logging → `audit_logs_bq`) | infra config | event-driven | No prior Cloud Logging sink in repo; planner uses STACK.md:117 + GCP docs |
| App Check Enforcement verification (per-service flip soak ≥7d) | runbook | n/a | First App Check flip in project history; planner uses ARCHITECTURE.md:166 + STACK.md:48 + Firebase docs |
| firebase-functions-test v3 integration test setup | test infrastructure | n/a | TEST-09 is Phase 7's first use of this devDep (STACK.md:84) |
| Per-function minimal-IAM service account binding (FN-05/FN-06) | infra config | n/a | Phase 6 deployed under default Compute Engine SA; Phase 7 introduces per-function bindings; planner uses Pitfall 13 + GCP docs |
| Zod schema definitions per callable | helper | transform | Zod is a new devDependency for Phase 7; the schema-shape per event type derives from ARCHITECTURE.md §6 (auditLog event shape lines 519–530) |

---

## Metadata

**Analog search scope:** `functions/src/**`, `functions/test/**`, `src/cloud/**`, `src/firebase/**`, `firestore.rules`, `storage.rules`, `tests/rules/**`, `runbooks/`, `SECURITY.md`, `.planning/research/{ARCHITECTURE,STACK}.md`
**Files scanned:** 28 read in detail; ~6 confirmed via Grep/Glob only
**Pattern extraction date:** 2026-05-09
**Phase 7 entry SHA:** `854fb65` (HEAD of `ci-deploy-narrow-20260509` at PATTERNS authoring time)

---

## Citations

- ARCHITECTURE.md §3 (lines 310–346) — Cloud Functions enumeration + structural conventions (region pin, App Check enforcement, Zod, idempotency, per-function SAs)
- ARCHITECTURE.md §6 (lines 519–558) — auditLog event shape + auditWrite Cloud Function flow
- STACK.md line 48 — App Check + reCAPTCHA Enterprise enforcement (the FN-04 substrate)
- STACK.md line 84 — `firebase-functions-test@3.4.1` (TEST-09 substrate)
- STACK.md line 113 — Cloud Functions 2nd gen + Node 22 (already in `functions/package.json:5`)
- STACK.md line 117 — Cloud Logging Data Access logs → BigQuery sink (Pattern F substrate)
- 07-CONTEXT.md SC#1–6 — Phase 7 Success Criteria authoritative list
- runbooks/phase-6-cleanup-ledger.md lines 56–67 — Phase 7 forward-tracking rows queued by Phase 6 (entry list for Pattern H ledger close)
- SECURITY.md lines 724–745 — §Phase 6 Audit Index (Pattern G shape)
- Pitfall 17 — auditLog written from Cloud Functions only (Admin SDK)
- Pitfall 12 — auth-blocking `minInstances:1` (cold-start lockout)
- Pitfall 13 — `defineSecret()` for runtime secrets; ADC for scripts; no JSON SA in repo
- Pitfall 19 — compliance theatre; every control has code link + test link + framework citation
