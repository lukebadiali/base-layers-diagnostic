---
phase: 07-cloud-functions-app-check-trusted-server-layer
plan: 01
plan_id: 07-01
subsystem: functions
type: execute
wave: 1
status: complete
tags:
  - cloud-functions
  - app-check
  - audit-log
  - idempotency
  - sentry
  - zod
  - per-function-sa
  - pattern-a
  - pattern-c
  - pattern-e
requirements_addressed:
  - FN-01
  - FN-02
  - FN-03
  - FN-04
  - FN-05
  - AUDIT-02
must_haves_status:
  truths:
    - claim: "functions/ workspace builds and tests pass with new deps (zod 4.4.3, @sentry/node 10.52.0, firebase-functions-test 3.5.0, firebase-admin 13.9.0, firebase-functions 7.2.5)"
      status: PASS
      evidence: "functions/package.json deps + devDeps bumped; npm install added 291 packages; npm test → 81/81 pass; npm run typecheck exits 0; npm run lint exits 0"
    - claim: "Pure-logic helpers (idempotency, zod-helpers, auditEventSchema, auditLogger) compile and unit-tests are green"
      status: PASS
      evidence: "44 new Vitest tests across 6 new test files: 8 idempotency + 4 zod-helpers + 7 sentry + 8 auditEventSchema + 6 auditLogger + 7 setClaims wiring; 0 failures"
    - claim: "scripts/provision-function-sas/run.js exists, runs idempotently against bedeveloped-base-layers, and creates 6 service accounts (audit-writer, audit-mirror, claims-admin, auth-blocking, ratelimit, csp-sink) with minimal IAM roles"
      status: PARTIAL_PASS
      evidence: "run.js + README written; node --check passes; --help flag verified. ACTUAL provisioning against the live GCP project is operator-paced (requires gcloud + ADC + project IAM admin role); deferred to Phase 7 operator runbook execution. Script is idempotent: ensures-create + diff-add + diff-remove with summary table."
    - claim: "setClaims is hardened: enforceAppCheck:true, Zod-validated input, idempotency-marker write, withSentry wrapper, secrets:[SENTRY_DSN] declared, serviceAccount:'claims-admin-sa', poke pattern preserved"
      status: PASS
      evidence: "grep -n in setClaims.ts confirms enforceAppCheck:true (line 47), serviceAccount:claims-admin-sa (line 48), secrets:[SENTRY_DSN] (line 49), withSentry wrap (line 53), validateInput(SetClaimsSchema) (line 58), ensureIdempotent (line 61), users/{uid}/_pokes/{ts} write (line 74); 7 wiring unit tests pin Zod gate, ensureIdempotent ordering, poke preservation"
  artifacts:
    - path: "functions/src/util/idempotency.ts"
      lines: 106
      provides: "ensureIdempotent(key, scope, windowSec) Admin SDK helper with sharded marker doc + in-memory store seam for unit tests"
      exports: ["ensureIdempotent", "isDuplicateForTest", "_resetForTest", "_setStoreForTest", "pathForKey"]
    - path: "functions/src/util/zod-helpers.ts"
      lines: 34
      provides: "validateInput<S>(schema, input) wrapper translating ZodError -> HttpsError('invalid-argument') with path-prefixed messages"
      exports: ["validateInput"]
    - path: "functions/src/util/sentry.ts"
      lines: 102
      provides: "withSentry(handler) wrapper; init() with PII-scrubbing beforeSend (Pitfall 18); _scrubEventForTest seam"
      exports: ["withSentry", "_scrubEventForTest", "_resetForTest"]
    - path: "functions/src/audit/auditEventSchema.ts"
      lines: 61
      provides: "auditEventInput Zod schema + 25-entry auditEventType enum + AuditEventInput type (AUDIT-02)"
      exports: ["auditEventInput", "auditEventType", "AuditEventInput", "AuditEventType"]
    - path: "functions/src/audit/auditLogger.ts"
      lines: 116
      provides: "Pure buildAuditEventDoc(input, ctx) + Admin-SDK writeAuditEvent(input, ctx). Pure layer is firebase-admin-free (Pattern C); Admin SDK lazy-loaded inside writeAuditEvent."
      exports: ["buildAuditEventDoc", "writeAuditEvent", "AuditLogDoc", "AuditActor", "ServerContext"]
    - path: "scripts/provision-function-sas/run.js"
      lines: 311
      provides: "Idempotent ADC script that creates and IAM-binds the 6 per-function service accounts (Pattern E + FN-04). Shells out to gcloud (no new npm deps); --dry-run + --project + --help flags."
    - path: "scripts/provision-function-sas/README.md"
      lines: 130
      provides: "SA inventory, idempotency semantics, operator cadence, verification commands"
    - path: "functions/package.json"
      provides: "Deps bumped: firebase-admin 13.9.0, firebase-functions 7.2.5, zod 4.4.3, @sentry/node 10.52.0; devDep firebase-functions-test 3.5.0"
  key_links:
    - from: "functions/src/auth/setClaims.ts"
      to: "functions/src/util/idempotency.ts"
      via: "ensureIdempotent(...) call before getAuth().setCustomUserClaims (line 61)"
      verified: "grep -n 'ensureIdempotent' functions/src/auth/setClaims.ts → line 31 import + line 61 call"
    - from: "functions/src/auth/setClaims.ts"
      to: "functions/src/util/zod-helpers.ts"
      via: "validateInput(SetClaimsSchema, request.data) (line 58)"
      verified: "grep -n 'validateInput' functions/src/auth/setClaims.ts → line 30 import + line 58 call"
    - from: "functions/src/auth/setClaims.ts"
      to: "functions/src/util/sentry.ts"
      via: "withSentry(handler) wrapping the onCall body (line 53)"
      verified: "grep -n 'withSentry' functions/src/auth/setClaims.ts → line 29 import + line 53 wrap"
    - from: "functions/src/audit/auditLogger.ts"
      to: "auditLog/{eventId}"
      via: "Admin SDK getFirestore().doc(`auditLog/${eventId}`).set inside writeAuditEvent"
      verified: "grep -n 'auditLog/' functions/src/audit/auditLogger.ts"
dependency_graph:
  requires:
    - phase: 6
      what: "Custom claims live (request.auth.token.role admin/internal/client) — setClaims hardening assumes the admin gate has a real claim to read."
    - file: "functions/src/auth/setClaims.ts (Phase 6 baseline)"
      what: "Phase 6 callable shape; this plan applies the Phase 7 Pattern A overlay on top."
  provides:
    - target: "Wave 2 auditWrite callable + Firestore-trigger mirror writers"
      what: "Imports auditLogger.writeAuditEvent + auditEventSchema.auditEventInput + util.{validateInput, ensureIdempotent, withSentry}"
    - target: "Wave 4 ratelimit/checkRateLimit callable"
      what: "Same util/* helpers (Zod + idempotency + Sentry + per-function SA shape)"
    - target: "Wave 6 TEST-09 integration coverage"
      what: "firebase-functions-test@3.5.0 added as devDep; setClaims hardened shape is the integration-test target"
  affects:
    - file: "functions/src/auth/setClaims.ts"
      what: "Hardened to Pattern A; closes Phase 6 forward-tracking row 'FN-03 + FN-07 setClaims' at substrate level"
tech_stack:
  added:
    - "@sentry/node 10.52.0 (Cloud Functions error capture, PII-scrubbing beforeSend)"
    - "zod 4.4.3 (input validation + audit event schema)"
    - "firebase-functions-test 3.5.0 (devDep — Wave 6 TEST-09 substrate)"
  bumped:
    - "firebase-admin 13.8.0 → 13.9.0"
  patterns:
    - "Pattern A: 2nd-gen callable with App Check + Zod + idempotency + Sentry + per-function SA (applied to setClaims)"
    - "Pattern C: Pure-logic helper + Vitest unit test (idempotency / zod-helpers / sentry / auditEventSchema / auditLogger pure layer)"
    - "Pattern E: One-shot ADC script (provision-function-sas)"
key_files:
  created:
    - "functions/src/util/idempotency.ts"
    - "functions/src/util/zod-helpers.ts"
    - "functions/src/util/sentry.ts"
    - "functions/src/audit/auditEventSchema.ts"
    - "functions/src/audit/auditLogger.ts"
    - "functions/test/util/idempotency.unit.test.ts"
    - "functions/test/util/zod-helpers.unit.test.ts"
    - "functions/test/util/sentry.unit.test.ts"
    - "functions/test/audit/auditEventSchema.unit.test.ts"
    - "functions/test/audit/auditLogger.unit.test.ts"
    - "functions/test/auth/setClaims.unit.test.ts"
    - "scripts/provision-function-sas/run.js"
    - "scripts/provision-function-sas/README.md"
  modified:
    - "functions/package.json"
    - "functions/package-lock.json"
    - "functions/src/auth/setClaims.ts"
decisions:
  - "Used Zod 4 `issues` field (not legacy `errors`) for ZodError unpacking — verified at runtime: `z.string().parse(42)` produces `err.issues[]` with `path` + `message` + `code`."
  - "Idempotency test seam: in-memory `IdempotencyStore` injected via `_setStoreForTest` rather than mocking firebase-admin/firestore globally. Cleaner contract, mirrors functions/src/csp/dedup.ts `_clearForTest` pattern."
  - "Sentry init guard: skip Sentry.init() entirely when SENTRY_DSN is empty (local-dev / unit-test no-op). Prevents Sentry.init throwing on missing DSN in emulator runs."
  - "auditLogger Admin-SDK-side uses dynamic `await import('firebase-admin/firestore')` so the pure buildAuditEventDoc layer can be loaded and tested without Admin SDK present at module-eval time. Pattern C purity preserved."
  - "Provisioning script shells out to gcloud rather than @google-cloud/iam library — keeps node_modules slim, matches scripts/seed-internal-allowlist convention."
metrics:
  duration_seconds: 732
  duration_minutes: 12
  completed_date: "2026-05-09"
  tasks_completed: 3
  tasks_total: 3
  files_created: 13
  files_modified: 3
  lines_added: ~1745
  unit_tests_added: 44
  unit_tests_total: 81
commits:
  - "9c81372 feat(07-01): shared util helpers + dep bumps for Phase 7 callable shape"
  - "67568c6 feat(07-01): audit schema + logger + setClaims hardened to Pattern A shape"
  - "e223ba4 feat(07-01): provision-function-sas script + README (Pattern E one-shot ADC)"
---

# Phase 7 Plan 01: Wave 1 — Shared Infrastructure (Tests-First Seams) Summary

**One-liner:** Phase 7 substrate landed — shared util helpers (idempotency / zod-helpers / sentry), audit event schema + logger (AUDIT-02), 6-SA provisioning script, and `setClaims` hardened to the Pattern A standard callable shape (App Check + Zod + idempotency + Sentry + per-function SA).

## Deps Bumped + Lockfile Diff

`functions/package.json`:

| Package | Before | After | Why |
|----|----|----|----|
| firebase-admin | 13.8.0 | **13.9.0** | 07-RESEARCH.md verified 2026-05-09 version |
| firebase-functions | 7.2.5 | 7.2.5 | already pinned |
| **zod** (new) | — | **4.4.3** | input validation + audit schema |
| **@sentry/node** (new) | — | **10.52.0** | server-side error capture |
| **firebase-functions-test** (new devDep) | — | **3.5.0** | TEST-09 integration substrate (Wave 6) |

`npm install` outcome: `added 291 packages, changed 1 package, audited 688 packages`. 9 low-severity vulnerabilities (transitive — same baseline as Phase 6). `package-lock.json` regenerated.

## 5 New Modules + 6 New Test Files

| Module | Lines | Purpose |
|----|----|----|
| `functions/src/util/idempotency.ts` | 106 | `ensureIdempotent(key, scope, windowSec)` — sharded marker doc (Pitfall 6); in-memory store seam for unit tests |
| `functions/src/util/zod-helpers.ts` | 34 | `validateInput<S>(schema, input)` — ZodError → HttpsError("invalid-argument") with path-prefixed messages |
| `functions/src/util/sentry.ts` | 102 | `withSentry(handler)` wrapper + PII-scrubbing `beforeSend` (Pitfall 18); idempotent init |
| `functions/src/audit/auditEventSchema.ts` | 61 | 25-entry `auditEventType` enum + `auditEventInput` Zod schema (AUDIT-02) |
| `functions/src/audit/auditLogger.ts` | 116 | Pure `buildAuditEventDoc` + Admin-SDK `writeAuditEvent`; lazy `firebase-admin/firestore` import preserves Pattern C purity |

| Test File | Lines | Tests |
|----|----|----|
| `functions/test/util/idempotency.unit.test.ts` | 130 | 8 (fresh-key write, dup-within-window, TTL expiry, sharding 4-case, isDuplicateForTest 3-case) |
| `functions/test/util/zod-helpers.unit.test.ts` | 67 | 4 (valid input, invalid throws, multi-path message, non-Zod wrap) |
| `functions/test/util/sentry.unit.test.ts` | 118 | 7 (happy path, capture+log on throw, init lifecycle 2-case, beforeSend scrub 2-case, plus init no-op when DSN empty) |
| `functions/test/audit/auditEventSchema.unit.test.ts` | 115 | 8 (Test 1–5 + UUID happy path + payload/snapshot accept) |
| `functions/test/audit/auditLogger.unit.test.ts` | 163 | 6 (canonical doc shape, schemaVersion: 1 always, server-`at` override, idempotencyKey derivation 3-case, Admin-SDK doc.set call) |
| `functions/test/auth/setClaims.unit.test.ts` | 207 | 7 (Zod gate 2-case, permission-denied gate, poke-pattern preserved, ensureIdempotent ordering, already-exists propagation, +) |

**Test count:** 81/81 pass (37 baseline + 44 new). `npm run typecheck` exits 0. `npm run lint` exits 0.

## setClaims Hardening — Before/After

**Before (Phase 6 baseline, ~58 lines):**

```ts
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
    await getFirestore()
      .doc(`users/${data.uid}/_pokes/${Date.now()}`)
      .set({ type: "claims-changed", at: FieldValue.serverTimestamp() });
    logger.info("auth.claims.set", { ... });
    return { ok: true };
  },
);
```

**After (Phase 7 Wave 1, 85 lines):**

```ts
export const setClaims = onCall(
  {
    region: "europe-west2",
    enforceAppCheck: true,                      // FN-07
    serviceAccount: "claims-admin-sa",          // FN-04
    secrets: [SENTRY_DSN],                      // FN-05 (defineSecret)
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  withSentry(async (request: CallableRequest<unknown>) => {  // FN-03
    if (request.auth?.token?.role !== "admin") {
      throw new HttpsError("permission-denied", "admin role required");
    }
    const data = validateInput(SetClaimsSchema, request.data ?? {});  // Zod
    await ensureIdempotent(                                             // FN-03
      `${request.auth.uid}:setClaims:${data.uid}:${data.clientReqId}`,
      "setClaims",
      5 * 60,
    );
    const role = data.role ?? null;
    const orgId = data.orgId ?? null;
    await getAuth().setCustomUserClaims(data.uid, { role, orgId });
    await getFirestore()                                                // PRESERVED: Pitfall 2
      .doc(`users/${data.uid}/_pokes/${Date.now()}`)
      .set({ type: "claims-changed", at: FieldValue.serverTimestamp() });
    logger.info("auth.claims.set", { ... });
    return { ok: true };
  }),
);
```

**Preserved fields (Phase 6 contract honored):**

- Region pin `europe-west2`
- Admin-claim re-read from `request.auth.token.role` (NEVER from payload — Pitfall 17)
- Poke-pattern write to `users/{uid}/_pokes/{Date.now()}` with `{type:"claims-changed", at:FieldValue.serverTimestamp()}`
- `logger.info("auth.claims.set", {...})` structured-log shape
- `{ ok: true }` return value

**Added fields (Pattern A overlay):**

- `enforceAppCheck: true` (FN-07; closes Phase 6 forward-tracking row)
- `serviceAccount: "claims-admin-sa"` (FN-04)
- `secrets: [SENTRY_DSN]` via `defineSecret("SENTRY_DSN")` (FN-05)
- `memory: "256MiB"`, `timeoutSeconds: 30` (explicit Cloud Run sizing)
- `withSentry(handler)` wrapper (FN-03)
- `SetClaimsSchema` Zod object — `uid` (string ≥ 1), `role` (enum admin/internal/client, nullable optional), `orgId` (string nullable optional), `clientReqId` (UUID **mandatory**)
- `validateInput(SetClaimsSchema, request.data)` replaces the 3-line `typeof` ladder
- `ensureIdempotent(...)` call before `setCustomUserClaims` (FN-03; 5-min window)

## 6 SAs — Operator-Run Evidence

**Status: SCRIPT WRITTEN; OPERATOR EXECUTION DEFERRED**

`scripts/provision-function-sas/run.js` exists, passes `node --check`, `--help` flag verified.

The actual provisioning run against `bedeveloped-base-layers` requires:
- `gcloud auth application-default login` by an operator with `roles/iam.serviceAccountAdmin` + `roles/resourcemanager.projectIamAdmin`
- ADC credentials present locally (not in CI yet — Wave 6 verification step deferred)

**Why deferred to operator:** This worktree-level executor agent does NOT hold GCP project IAM admin credentials. Running the script would attempt to mutate live IAM state without operator review. The plan's automated done criterion (`node --check scripts/provision-function-sas/run.js`) passes; the operator-paced verification (`gcloud iam service-accounts list ... | grep ... returns 6 lines`) is queued for the Phase 7 operator runbook execution.

Once the operator runs the script, the expected output:

```
=== Summary ===
service-account                                           | status         | added                                                                  | removed (drift)
----------------------------------------------------------|----------------|------------------------------------------------------------------------|----------------
audit-writer-sa@bedeveloped-base-layers.iam.gserviceaccount.com | created        | roles/datastore.user                                                  | (none)
audit-mirror-sa@bedeveloped-base-layers.iam.gserviceaccount.com | created        | roles/datastore.user, roles/eventarc.eventReceiver                    | (none)
claims-admin-sa@bedeveloped-base-layers.iam.gserviceaccount.com | created        | roles/firebaseauth.admin, roles/datastore.user                        | (none)
auth-blocking-sa@bedeveloped-base-layers.iam.gserviceaccount.com | created        | roles/firebaseauth.viewer, roles/datastore.viewer                     | (none)
ratelimit-sa@bedeveloped-base-layers.iam.gserviceaccount.com    | created        | roles/datastore.user                                                  | (none)
csp-sink-sa@bedeveloped-base-layers.iam.gserviceaccount.com     | created        | roles/logging.logWriter                                               | (none)

[OK] Provisioning complete.
```

Re-runs (idempotency proof) should show every row as `already-exists` with `(none)` in both added and removed columns.

## Pattern 7 SA Inventory Delta vs Prior State

**Before Phase 7 Wave 1:** Cloud Functions deployed under default Compute Engine SA `<project>@appspot.gserviceaccount.com` (Editor scope, project-wide read/write — Pitfall 13 violation).

**After Phase 7 Wave 1 (substrate-level):** 6 minimal-IAM service accounts authored in the provisioning script + per-function `serviceAccount: "claims-admin-sa"` declaration on `setClaims`. Wave 2/4/5 will declare the matching `serviceAccount` on each new callable + trigger.

| SA | Roles | Pattern A binding |
|----|----|----|
| `audit-writer-sa` | `roles/datastore.user` | Wave 2 `auditWrite` callable |
| `audit-mirror-sa` | `roles/datastore.user`, `roles/eventarc.eventReceiver` | Wave 2 `onOrgDelete`, `onUserDelete`, `onDocumentDelete` |
| `claims-admin-sa` | `roles/firebaseauth.admin`, `roles/datastore.user` | **Wave 1 `setClaims` (LANDED in this plan)** |
| `auth-blocking-sa` | `roles/firebaseauth.viewer`, `roles/datastore.viewer` | Wave 5 `beforeUserCreated`, `beforeUserSignedIn` re-bind (D-22 ToS gate dependent) |
| `ratelimit-sa` | `roles/datastore.user` | Wave 4 `checkRateLimit` callable |
| `csp-sink-sa` | `roles/logging.logWriter` | Wave 5 `cspReportSink` redeploy |

## Wave 6 Forward-Tracking Notes

**`src/cloud/claims-admin.js` clientReqId addition (carry-forward):**

The hardened `setClaims` callable now requires a UUID `clientReqId` in its input (mandatory per `SetClaimsSchema`). Phase 6's existing `src/cloud/claims-admin.js` wrapper does NOT yet generate or pass `clientReqId`. Until Wave 6 closes this row, ANY caller of `setClaims` from `src/` will get `HttpsError("invalid-argument", "Validation failed: clientReqId: Invalid UUID")`.

**Affected callers:**

- `src/cloud/claims-admin.js` (Phase 6 Wave 3) — needs `clientReqId: crypto.randomUUID()` injected before `httpsCallable("setClaims", input)`.
- BLOCKER-FIX 1 (sub-wave 6.1) — `src/firebase/auth.js#updatePassword` flow that re-claims after password change.

**Deferred to:** Phase 7 Wave 6 (per plan's explicit "Wave 6 fills that wrapper" note in `<action>` Step 4 constraints).

This is intentional — the plan's `<success_criteria>` explicitly queues this row: "Phase 7 sub-wave 7.1 carry-forward row queued for `src/cloud/claims-admin.js` wrapper update (clientReqId addition) — Wave 6 closes."

## Deviations from Plan

**Auto-fixed Issues:**

**1. [Rule 1 - Bug] Zod 4 API: `issues` not `errors`**
- **Found during:** Task 1 (zod-helpers.ts authoring)
- **Issue:** Plan's paste-ready code excerpt referenced `err.errors` (Zod 3 API). Zod 4 renamed to `err.issues`.
- **Fix:** Used `err.issues ?? []` in `validateInput`; verified at runtime that `z.string().parse(42)` produces `err.issues[]` not `err.errors[]`.
- **Files modified:** `functions/src/util/zod-helpers.ts`
- **Commit:** 9c81372

**2. [Rule 1 - Bug] TypeScript inferred `request: unknown` in onCall handler under withSentry**
- **Found during:** Task 2 (setClaims hardening typecheck)
- **Issue:** `withSentry`'s generic `<TIn, TOut>` collapsed to `unknown` when used inline as the second arg to `onCall(opts, withSentry(async (request) => ...))`. Compiler errors: `'request' is of type 'unknown'`.
- **Fix:** Added explicit `CallableRequest<unknown>` type annotation on the handler arg; imported `CallableRequest` type from `firebase-functions/v2/https`.
- **Files modified:** `functions/src/auth/setClaims.ts`
- **Commit:** 67568c6

**3. [Rule 3 - Blocking] Plan path mismatch: util/auditEventSchema.ts vs audit/auditEventSchema.ts**
- **Found during:** Task 2 (file paths)
- **Issue:** Plan's `must_haves.artifacts` listed `functions/src/util/auditEventSchema.ts` but `files_modified` listed `functions/src/audit/auditEventSchema.ts`. The 07-PATTERNS.md "File Classification" table also placed audit modules under `functions/src/audit/`.
- **Fix:** Used `functions/src/audit/auditEventSchema.ts` + `functions/src/audit/auditLogger.ts` per the `files_modified` list and PATTERNS table (the canonical source). `util/` is reserved for cross-cutting helpers (idempotency, zod-helpers, sentry); audit-specific modules live under `audit/`.
- **Files modified:** N/A (path choice at file creation)
- **Commit:** 67568c6

**No architectural deviations (Rule 4) and no auth gates encountered.**

## Self-Check: PASSED

**Files exist:**

- FOUND: `functions/src/util/idempotency.ts` (106 lines)
- FOUND: `functions/src/util/zod-helpers.ts` (34 lines)
- FOUND: `functions/src/util/sentry.ts` (102 lines)
- FOUND: `functions/src/audit/auditEventSchema.ts` (61 lines)
- FOUND: `functions/src/audit/auditLogger.ts` (116 lines)
- FOUND: `functions/src/auth/setClaims.ts` (85 lines, hardened)
- FOUND: `functions/test/util/idempotency.unit.test.ts` (130 lines)
- FOUND: `functions/test/util/zod-helpers.unit.test.ts` (67 lines)
- FOUND: `functions/test/util/sentry.unit.test.ts` (118 lines)
- FOUND: `functions/test/audit/auditEventSchema.unit.test.ts` (115 lines)
- FOUND: `functions/test/audit/auditLogger.unit.test.ts` (163 lines)
- FOUND: `functions/test/auth/setClaims.unit.test.ts` (207 lines)
- FOUND: `scripts/provision-function-sas/run.js` (311 lines)
- FOUND: `scripts/provision-function-sas/README.md` (130 lines)

**Commits exist:**

- FOUND: 9c81372 (Task 1)
- FOUND: 67568c6 (Task 2)
- FOUND: e223ba4 (Task 3)

**Verification gates green:**

- `npm test` → 81/81 pass (37 baseline + 44 new in this plan)
- `npm run typecheck` → exits 0
- `npm run lint` → exits 0
- `node --check scripts/provision-function-sas/run.js` → exits 0
- `grep -n "enforceAppCheck: true" functions/src/auth/setClaims.ts` → line 47 hit
- `grep -n "ensureIdempotent" functions/src/auth/setClaims.ts` → line 31 import + line 61 call
- `grep -n "withSentry" functions/src/auth/setClaims.ts` → line 29 import + line 53 wrap
- `grep -n "serviceAccount" functions/src/auth/setClaims.ts` → "claims-admin-sa" line 48
- `grep -n "_pokes/" functions/src/auth/setClaims.ts` → line 74 (poke pattern PRESERVED)
- `grep -n "process\\.env\\." functions/src/` → only `functions/src/util/sentry.ts` (FN-05 clean)

## Threat Flags

None — Wave 1 introduces no new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries beyond what the `<threat_model>` block of `07-01-PLAN.md` already enumerated (T-07-01-01 through T-07-01-07). All STRIDE register `mitigate` dispositions are addressed by the artifacts above.
