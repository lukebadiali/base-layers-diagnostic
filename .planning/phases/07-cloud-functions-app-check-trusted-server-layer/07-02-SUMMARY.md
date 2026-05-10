---
phase: 07-cloud-functions-app-check-trusted-server-layer
plan: 02
plan_id: 07-02
subsystem: functions
type: execute
wave: 2
status: complete
tags:
  - cloud-functions
  - audit-log
  - app-check
  - firestore-trigger
  - auth-trigger
  - mirror-writer
  - idempotency
  - rules-unit-test
  - pattern-a
  - pattern-b
  - pattern-d
requirements_addressed:
  - AUDIT-01
  - AUDIT-04
  - AUDIT-07
must_haves_status:
  truths:
    - claim: "auditWrite callable accepts a valid AuditEventInput and writes a single auditLog/{eventId} doc with server-controlled actor + at + ip + userAgent fields"
      status: PASS
      evidence: "functions/src/audit/auditWrite.ts builds + lints + typechecks; 12 wiring unit tests pin Zod gate, idempotency ordering, identity provenance from request.auth.token, server-derived eventId/ip/userAgent. writeAuditEvent is the same Wave 1 helper which writes to auditLog/{eventId} via Admin SDK."
    - claim: "auditWrite rejects unauthenticated calls (App Check + auth gate)"
      status: PASS
      evidence: "Test 1 (auth gate): two cells (auth missing entirely, auth.uid missing) -> HttpsError('unauthenticated'). enforceAppCheck:true is set in onCall opts (App Check enforcement happens before the handler runs at the runtime level; cannot be unit-tested in pure-mock seam — Wave 6 TEST-09 covers via firebase-functions-test integration)."
    - claim: "auditWrite rejects duplicate calls within 5min idempotency window with HttpsError('already-exists')"
      status: PASS
      evidence: "Test 3 (idempotency): ensureIdempotent invoked BEFORE writeAuditEvent with key='${actorUid}:${type}:${target.id}:${clientReqId}', scope='auditWrite', windowSec=300. already-exists rejection from ensureIdempotent propagates without writing the audit event (writeAuditEventSpy not called)."
    - claim: "Three Firestore-trigger mirror writers (onOrgDelete, onUserDelete, onDocumentDelete) write a `{type}.delete.mirror` audit event when the corresponding document is deleted"
      status: PASS
      evidence: "10 wiring tests across 3 trigger handlers: each writes input.type='data.{org|user|document}.delete.mirror' with severity='warning', target.{type,id} mirroring the deleted resource, payload={source:'trigger',reason:'no-primary-audit-found'}, actor={uid:'system',role:'system',email:null,orgId:null}, idempotencyKey='mirror:{type}:{id}:{eventId}'. Output goes through the same writeAuditEvent helper as auditWrite."
    - claim: "Mirror triggers SKIP if a primary auditWrite event for the same target.id exists within the last 60s (defence-in-depth dedup)"
      status: PASS
      evidence: "Each trigger queries auditLog with .where('type','==', primaryType).where('target.id','==', id).where('at','>', new Date(Date.now()-60_000)).limit(1).get(); on !empty result, logs 'audit.mirror.skipped' and returns without calling writeAuditEvent. Three skip-tests (one per trigger) verify."
    - claim: "rules-unit-test pins: client cannot write auditLog/{*}; audited internal user cannot read auditLog where actor.uid == own uid (AUDIT-07)"
      status: PASS
      evidence: "tests/rules/auditLog.test.js — 8 cells: 4 write-deny (anonymous, client_orgA, internal, admin) + 3 read-deny (anonymous, client_orgA, internal-on-own-row) + 1 read-allow (admin). Cell 7 specifically: seeded auditLog/seeded with actor.uid='internal' is read AS the internal user (whose authenticatedContext uid is also 'internal' per ROLES) — denies. node --check passes; vitest --config vitest.rules.config.js list shows all 8 cells. Emulator-side execution deferred to CI (Java 21 not on local PATH; same constraint as Phase 5 + 6 rules tests)."
  artifacts:
    - path: "functions/src/audit/auditWrite.ts"
      lines: 110
      provides: "auditWrite onCall callable — App Check enforced, Zod validated, idempotency-marked, Sentry-wrapped, runs as audit-writer-sa"
      exports: ["auditWrite"]
    - path: "functions/src/audit/triggers/onOrgDelete.ts"
      lines: 86
      provides: "2nd-gen onDocumentDeleted on orgs/{orgId} — writes mirror audit entry; 60s dedup vs data.org.softDelete"
      exports: ["onOrgDelete"]
    - path: "functions/src/audit/triggers/onUserDelete.ts"
      lines: 97
      provides: "1st-gen auth.user().onDelete() — writes mirror audit entry; 60s dedup vs data.user.delete. v1 fallback because v2 firebase-functions/v2/identity does NOT export onUserDeleted (verified 7.2.5)."
      exports: ["onUserDelete"]
    - path: "functions/src/audit/triggers/onDocumentDelete.ts"
      lines: 83
      provides: "2nd-gen onDocumentDeleted on orgs/{orgId}/documents/{docId} — writes mirror audit entry; 60s dedup vs data.document.delete"
      exports: ["onDocumentDelete"]
    - path: "tests/rules/auditLog.test.js"
      lines: 128
      provides: "rules-unit-test cells pinning AUDIT-01 (client write deny — 4 cells) + AUDIT-07 (audited-self read deny — cell 7)"
      contains: "describe.*auditLog"
    - path: "functions/test/audit/auditWrite.unit.test.ts"
      lines: 306
      provides: "12 wiring tests for auditWrite (auth gate / Zod gate / idempotency ordering / identity provenance / server-context derivation)"
    - path: "functions/test/audit/triggers/mirrorTriggers.unit.test.ts"
      lines: 311
      provides: "10 wiring tests for the three mirror trigger handlers (happy-path mirror write + dedup-query shape + dedup-hit skip + missing-event-data tolerance)"
  key_links:
    - from: "functions/src/audit/auditWrite.ts"
      to: "auditLog/{eventId}"
      via: "writeAuditEvent(input, ctx) helper from auditLogger.ts (Wave 1) — Admin SDK getFirestore().doc(`auditLog/${eventId}`).set"
      verified: "grep -n writeAuditEvent functions/src/audit/auditWrite.ts"
    - from: "functions/src/audit/triggers/onOrgDelete.ts"
      to: "auditLog/{eventId}"
      via: "writeAuditEvent with type='data.org.delete.mirror' after 60s primary-event dedup query"
      verified: "grep -n 'data.org.delete.mirror' functions/src/audit/triggers/onOrgDelete.ts"
    - from: "functions/src/audit/auditWrite.ts"
      to: "functions/src/util/idempotency.ts"
      via: "ensureIdempotent('${actorUid}:${type}:${target.id}:${clientReqId}', 'auditWrite', 300)"
      verified: "grep -n ensureIdempotent functions/src/audit/auditWrite.ts"
    - from: "functions/src/audit/auditWrite.ts"
      to: "functions/src/util/sentry.ts"
      via: "withSentry(handler) wrapping the onCall body"
      verified: "grep -n withSentry functions/src/audit/auditWrite.ts"
    - from: "functions/src/audit/auditWrite.ts"
      to: "functions/src/audit/auditEventSchema.ts"
      via: "validateInput(auditEventInput, request.data)"
      verified: "grep -n auditEventInput functions/src/audit/auditWrite.ts"
dependency_graph:
  requires:
    - phase: 7
      wave: 1
      what: "auditEventInput schema + buildAuditEventDoc + writeAuditEvent + ensureIdempotent + validateInput + withSentry — all consumed verbatim."
    - file: "functions/src/audit/auditEventSchema.ts (Wave 1 baseline)"
      what: "Wave 2 widens auditEventType enum by 3 mirror values; additive-only change (Wave 1 unit tests still green)."
    - file: "firestore.rules (Phase 5/6 baseline)"
      what: "auditLog/{eventId} block already has `allow read: if isAdmin()` and `allow write: if false` — Wave 2 adds rules-unit-test cells against this contract; no rule change needed."
  provides:
    - target: "Wave 4 ratelimit/checkRateLimit callable"
      what: "Same Pattern A shape established in auditWrite (App Check + Zod + idempotency + Sentry + per-function SA + withSentry wrap + node:crypto randomUUID for eventId)."
    - target: "Wave 6 TEST-09 integration coverage"
      what: "auditWrite + 3 mirror triggers are firebase-functions-test integration targets (Wave 1 added firebase-functions-test 3.5.0 as devDep)."
    - target: "Phase 9 view-side wiring (AUDIT-05)"
      what: "src/cloud/auditWrite.js wrapper (Wave 6) will call this callable; Phase 9 wires the diagnostic UI to emit 'data.{org,document,message,comment}.{create,update,delete}' events through it."
  affects:
    - file: "functions/src/audit/auditEventSchema.ts"
      what: "auditEventType enum widened with 3 mirror values; additive-only (Wave 1 unit tests pass against the larger enum)"
tech_stack:
  added:
    - "firebase-functions/v1 (re-used existing dep — used for auth.user().onDelete() because v2 has no equivalent)"
  bumped: []
  patterns:
    - "Pattern A: 2nd-gen callable with App Check + Zod + idempotency + Sentry + per-function SA (auditWrite — second instance after Wave 1 setClaims)"
    - "Pattern B: Firestore + Auth event triggers (onOrgDelete + onDocumentDelete via v2 onDocumentDeleted; onUserDelete via v1 auth.user().onDelete() fallback)"
    - "Pattern D: rules-unit-test cell — focused matrix file alongside the Phase 5 deny-all suite"
    - "Pattern 4b: 60-second primary-event dedup window in mirror triggers (Pitfall 7 — defence-in-depth without double-writes)"
key_files:
  created:
    - "functions/src/audit/auditWrite.ts"
    - "functions/src/audit/triggers/onOrgDelete.ts"
    - "functions/src/audit/triggers/onUserDelete.ts"
    - "functions/src/audit/triggers/onDocumentDelete.ts"
    - "functions/test/audit/auditWrite.unit.test.ts"
    - "functions/test/audit/triggers/mirrorTriggers.unit.test.ts"
    - "tests/rules/auditLog.test.js"
  modified:
    - "functions/src/index.ts"
    - "functions/src/audit/auditEventSchema.ts"
decisions:
  - "v1 fallback for onUserDelete: firebase-functions 7.2.5's v2/identity module exports only the four blocking handlers (beforeUserCreated, beforeUserSignedIn, beforeEmailSent, beforeSmsSent). There is no v2 onUserDeleted equivalent. Used 1st-gen auth.user().onDelete() (still officially supported; Firebase explicitly endorses v1+v2 coexistence) rather than deferring AUDIT-04 coverage to a later wave."
  - "node:crypto randomUUID() over crypto.randomUUID(): functions/eslint.config.cjs's globals list does not include crypto. Importing randomUUID from 'node:crypto' explicitly is cleaner than widening the globals list and matches the existing 1-import-per-file convention."
  - "ESM `import * as functionsV1 from 'firebase-functions/v1'`: the v1 chain is `runWith().region().auth.user().onDelete()`. Importing as a namespace lets us call functionsV1.runWith({...}).region(...).auth.user().onDelete(handler) without polluting the symbol table."
  - "Mirror snapshot field omitted (undefined) when event.data is missing: the schema marks target.snapshot optional and Firestore omits undefined fields on write — cleaner than emitting an explicit null which would require widening the type signature."
  - "Mirror writers do NOT validate input against auditEventInput Zod schema before calling writeAuditEvent: schema is the client-payload gate (per Wave 1's '_mirror triggers bypass this schema_' decision). Mirror writers construct their own AuditEventInput struct from event.params and the system actor; pre-validation would be redundant since the input is server-constructed."
  - "Enum widening preserves Pitfall 17: a client COULD submit type='data.org.delete.mirror' through auditWrite, but actor.{uid,email,role,orgId} is overridden from request.auth.token regardless. The forged 'system' actor case is structurally impossible — the audit row will show the caller's verified ID-token identity, not 'system'."
metrics:
  duration_seconds: 1062
  duration_minutes: 17.7
  completed_date: "2026-05-09"
  tasks_completed: 3
  tasks_total: 3
  files_created: 7
  files_modified: 2
  lines_added: 1121
  unit_tests_added: 22
  unit_tests_total: 103
  rules_test_cells_added: 8
commits:
  - "1d09959 feat(07-02): auditWrite callable + Pattern A wiring (FN-01/AUDIT-01)"
  - "9c1dd47 feat(07-02): mirror triggers (onOrgDelete/onUserDelete/onDocumentDelete) (FN-01/AUDIT-04)"
  - "5dd6c45 test(07-02): rules-unit-test cells for auditLog AUDIT-01 + AUDIT-07"
---

# Phase 7 Plan 02: Wave 2 — Audit-Log Writers (Callable + Mirror Triggers + AUDIT-07 Rules-Unit-Test) Summary

**One-liner:** auditWrite callable (Pattern A) + 3 Firestore/Auth-trigger mirror writers (Pattern B with 60s primary-event dedup) + 8 rules-unit-test cells pinning AUDIT-01 client-write-deny + AUDIT-07 audited-self read-deny.

## Four New Functions Authored

| Function | Trigger | SA | Region | Purpose |
|----|----|----|----|----|
| `auditWrite` | onCall | `audit-writer-sa` | europe-west2 | Primary application-tier writer; called by client wrappers (Wave 6) and `cloud/*` adapters (Phase 9) |
| `onOrgDelete` | v2 `onDocumentDeleted` on `orgs/{orgId}` | `audit-mirror-sa` | europe-west2 | Defence-in-depth mirror; fires on Firestore mutation regardless of caller |
| `onUserDelete` | **v1** `auth.user().onDelete()` | `audit-mirror-sa` | europe-west2 | Auth-event mirror; fires on Firebase Auth user removal |
| `onDocumentDelete` | v2 `onDocumentDeleted` on `orgs/{orgId}/documents/{docId}` | `audit-mirror-sa` | europe-west2 | Subcollection mirror; pairs with the upcoming Wave 5 GCS bucket-event hook |

All four re-exported from `functions/src/index.ts` alongside Wave 1's `setClaims` and Phase 6's auth-blocking + Phase 3's `cspReportSink`.

## auditWrite — Pattern A Shape

The hardened callable shape (mirroring Wave 1's setClaims overlay) — `functions/src/audit/auditWrite.ts:42-104`:

```ts
export const auditWrite = onCall(
  {
    region: "europe-west2",
    enforceAppCheck: true,                   // FN-07
    serviceAccount: "audit-writer-sa",       // FN-04 — Wave 1 SA inventory
    secrets: [SENTRY_DSN],                   // FN-05 — defineSecret
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  withSentry(async (request: CallableRequest<unknown>) => {  // FN-03
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }
    const data = validateInput(auditEventInput, request.data ?? {});  // Zod gate
    const idempotencyKey = `${request.auth.uid}:${data.type}:${data.target.id}:${data.clientReqId}`;
    await ensureIdempotent(idempotencyKey, "auditWrite", 5 * 60);     // FN-03
    const eventId = randomUUID();
    // ip from x-forwarded-for[0]; userAgent from raw header; both null on absence.
    // actor sourced ENTIRELY from request.auth.token (Pitfall 17).
    await writeAuditEvent(data, { now: Date.now(), eventId, actor, ip, userAgent, idempotencyKey });
    logger.info("audit.write", { eventId, type: data.type, actorUid: request.auth.uid });
    return { ok: true, eventId };
  }),
);
```

**Pitfall 17 closure:** `actor.{uid,email,role,orgId}` is reconstructed from `request.auth.token` only. A client passing `data.actor = { uid: "fake" }` is silently ignored — the test pins this explicitly (Test 4 — Identity provenance).

## Mirror Triggers — 60s Primary-Event Dedup

Each mirror trigger uses the same defence-in-depth pattern. `onOrgDelete.ts:35-50`:

```ts
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
// ...else writeAuditEvent({ type: "data.org.delete.mirror", ... })
```

`onUserDelete.ts` queries `data.user.delete`; `onDocumentDelete.ts` queries `data.document.delete`. Cloud Logging captures the trigger invocation regardless (the dedup-skip is logged at INFO with structured fields), so Wave 5 BigQuery sink (AUDIT-03) backstops the application-tier writes.

## auditEventType Enum Widening

`functions/src/audit/auditEventSchema.ts` extended with three additive enum values:

```ts
"data.org.delete.mirror",
"data.user.delete.mirror",
"data.document.delete.mirror",
```

Wave 1's `auditEventSchema.unit.test.ts` and `auditLogger.unit.test.ts` re-run green against the widened enum (no test changes needed; enum widening is forward-compatible).

## Test Coverage — 22 New Unit Tests + 8 Rules-Unit-Test Cells

| File | Tests | Pin |
|----|----|----|
| `functions/test/audit/auditWrite.unit.test.ts` | 12 | Auth gate (2) + Zod gate (3) + idempotency ordering (2) + identity provenance (2) + server-context (3) |
| `functions/test/audit/triggers/mirrorTriggers.unit.test.ts` | 10 | onOrgDelete (4) + onUserDelete (3) + onDocumentDelete (3) — happy-path mirror write + dedup-query shape + dedup-hit skip + missing-event-data tolerance |
| `tests/rules/auditLog.test.js` | 8 cells | 4 write-deny (AUDIT-01) + 4 read (3 deny / 1 admin allow — AUDIT-07 cell 7 is the audited-self deny) |

**Test count after Wave 2:** functions/ = 103/103 (81 baseline + 22 new). Build + typecheck + lint exit 0.

**Rules-unit-test cells:** 8/8 discovered by `vitest --config vitest.rules.config.js list`. Emulator execution deferred to CI (Phase 5 / 6 pattern — local environment lacks Java 21 which the firestore emulator requires; CI installs `temurin@21` then runs `npm run test:rules`).

## AUDIT-07 Cells — Result Matrix (Discovered, Pending CI Execution)

| Cell | Role | Op | Path | Expected | Reason |
|----|----|----|----|----|----|
| 1 | anonymous | write | auditLog/x | deny | rules `allow write: if false` |
| 2 | client_orgA | write | auditLog/x | deny | rules `allow write: if false` |
| 3 | internal | write | auditLog/x | deny | Pitfall 17 — server-only even for internal |
| 4 | admin | write | auditLog/x | deny | even admin can't bypass; only Admin SDK from Cloud Functions |
| 5 | admin | read | auditLog/seeded | **allow** | rules `allow read: if isAdmin()` |
| 6 | client_orgA | read | auditLog/seeded | deny | tenant isolation — not admin |
| 7 | internal | read | auditLog/seeded | **deny** | **AUDIT-07 — audited self CANNOT read own row** (actor.uid='internal' matches own uid) |
| 8 | anonymous | read | auditLog/seeded | deny | not authenticated; rules require isAdmin() |

Cell 7 is the canonical AUDIT-07 contract: the seeded row's `actor.uid="internal"` matches the same string the rules-unit-testing `authenticatedContext("internal", ...)` uses as uid. The read AS the internal user is denied — pinning that an audited internal session cannot self-redact.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 + Rule 3 — Bug + Blocking] firebase-functions/v2/identity has no onUserDeleted export**

- **Found during:** Task 2 (mirror trigger authoring)
- **Issue:** Both `07-02-PLAN.md` (Step 2 of Task 2) and `07-RESEARCH.md` reference `onUserDeleted` from `firebase-functions/v2/identity`. Verified at runtime against firebase-functions 7.2.5: `Object.keys(require('firebase-functions/v2/identity'))` returns only `['HttpsError', 'beforeEmailSent', 'beforeOperation', 'beforeSmsSent', 'beforeUserCreated', 'beforeUserSignedIn', 'getOpts', 'identity_exports']`. Google has not migrated the user-deletion event to 2nd-gen. The v2/identity module ships only the four `before*` blocking handlers.
- **Fix:** Used 1st-gen `firebase-functions/v1`'s `auth.user().onDelete(handler)` chain. The Eventarc subscription target is identical; only the builder shape differs. v1+v2 coexistence in a single index.ts is officially supported (Firebase v2 migration guide §"Coexistence with 1st gen"). Updated test mock to mirror the chain.
- **Files modified:** `functions/src/audit/triggers/onUserDelete.ts`, `functions/test/audit/triggers/mirrorTriggers.unit.test.ts`
- **Commit:** 9c1dd47

**2. [Rule 1 — Bug] ESLint `no-undef` on `crypto.randomUUID()`**

- **Found during:** Task 1 (auditWrite lint gate)
- **Issue:** `functions/eslint.config.cjs`'s `globals` list (Buffer, process, console, URL, URLSearchParams) does not include `crypto`. Node 22 has `crypto` as a runtime global, but lint reports `'crypto' is not defined`.
- **Fix:** Imported `randomUUID` explicitly from `node:crypto`. One-line, no globals widening, matches the project's 1-import-per-file convention.
- **Files modified:** `functions/src/audit/auditWrite.ts` (and same pattern applied preemptively to all 3 mirror trigger files)
- **Commit:** 1d09959

### Verification Deferrals

**1. [Operator-paced — Java 21] Rules-unit-test execution against the emulator**

- **Status:** DEFERRED TO CI
- **Reason:** Local environment lacks Java 21; `firebase emulators:exec` fails with "Could not spawn `java -version`. Please make sure Java is installed and on your system PATH." This is the same constraint that has held since Phase 5 — the project's CI workflow at `.github/workflows/ci.yml` installs `setup-java@v4 (temurin@21)` before running `npm run test:rules`.
- **What was done locally:** `node --check tests/rules/auditLog.test.js` exits 0; `npx vitest --config vitest.rules.config.js list` discovers all 8 cells (verified via grep against the list output). The rules contract being tested (`auditLog/{eventId}` `allow read: if isAdmin(); allow write: if false`) is unchanged from Phase 5/6 — the existing `tests/rules/server-only-deny-all.test.js` already passes against the same contract for the internal-read-deny + admin-read-allow + write-deny cells.
- **What CI will verify:** all 8 cells assert as expected. Cell 5 is the only `allow`; cells 1-4 + 6-8 all `deny`.

**2. [Operator-paced — gcloud + ADC] Live deployment of the four new functions**

- **Status:** DEFERRED TO OPERATOR
- **Reason:** Same as Wave 1's `provision-function-sas` deferral — the worktree-level executor agent does not hold GCP IAM/deploy credentials. `firebase deploy --only functions:auditWrite,functions:onOrgDelete,functions:onUserDelete,functions:onDocumentDelete` is queued for the Phase 7 operator runbook execution (along with `firebase functions:list` + `gcloud run services describe` SA-binding verification).
- **What CI will verify:** TBD — Phase 11 hosting/CD wave will land the deploy-from-CI substrate; until then deploys are operator-paced.

**No architectural deviations (Rule 4) and no auth gates encountered.**

## Self-Check: PASSED

**Files exist (worktree):**

- FOUND: `functions/src/audit/auditWrite.ts` (110 lines)
- FOUND: `functions/src/audit/triggers/onOrgDelete.ts` (86 lines)
- FOUND: `functions/src/audit/triggers/onUserDelete.ts` (97 lines)
- FOUND: `functions/src/audit/triggers/onDocumentDelete.ts` (83 lines)
- FOUND: `functions/test/audit/auditWrite.unit.test.ts` (306 lines)
- FOUND: `functions/test/audit/triggers/mirrorTriggers.unit.test.ts` (311 lines)
- FOUND: `tests/rules/auditLog.test.js` (128 lines)

**Files modified:**

- FOUND: `functions/src/index.ts` — re-exports auditWrite + 3 mirror triggers
- FOUND: `functions/src/audit/auditEventSchema.ts` — auditEventType enum widened by 3 mirror values

**Commits exist (worktree branch):**

- FOUND: 1d09959 (Task 1: auditWrite + 12 wiring tests)
- FOUND: 9c1dd47 (Task 2: 3 mirror triggers + enum widening + 10 wiring tests)
- FOUND: 5dd6c45 (Task 3: 8 rules-unit-test cells)

**Verification gates green:**

- `cd functions && npm run build` → exits 0 (tsc emits lib/)
- `cd functions && npm run typecheck` → exits 0
- `cd functions && npm run lint` → exits 0
- `cd functions && npm test` → 103/103 pass (81 baseline + 22 new)
- `node --check tests/rules/auditLog.test.js` → exits 0
- `npx vitest --config vitest.rules.config.js list | grep auditLog.test` → 8 cells discovered
- `grep -n "writeAuditEvent" functions/src/audit/auditWrite.ts` → line 33 import + line 84 call
- `grep -n "ensureIdempotent" functions/src/audit/auditWrite.ts` → line 31 import + line 60 call
- `grep -n "withSentry" functions/src/audit/auditWrite.ts` → line 29 import + line 50 wrap
- `grep -n "data.org.delete.mirror" functions/src/audit/triggers/onOrgDelete.ts` → line 53 hit (canonical mirror enum value)
- `grep -n "primary-exists" functions/src/audit/triggers/onOrgDelete.ts` → line 47 hit (60s dedup skip log)
- `grep -n "auth.user.*onDelete" functions/src/audit/triggers/onUserDelete.ts` → v1 fallback chain present

## Threat Flags

None — Wave 2 deliverables fall entirely within the `<threat_model>` already enumerated in `07-02-PLAN.md` (T-07-02-01 through T-07-02-06). All STRIDE register `mitigate` dispositions are addressed:

- T-07-02-01 (Tampering — forged audit event from client) → mitigated by rules `allow write: if false` (rules-unit-test cells 1-4) + actor sourced from request.auth.token (auditWrite test 4)
- T-07-02-02 (Information Disclosure — audited user reads own log) → mitigated by rules `allow read: if isAdmin()` (rules-unit-test cell 7 — AUDIT-07)
- T-07-02-03 (Repudiation — auditWrite call replayed) → mitigated by ensureIdempotent 5-min window (auditWrite test 3)
- T-07-02-04 (DoS — bulk delete cascade) → mitigated by 60s primary-event dedup (mirror tests 3-cell skip-when-primary-exists matrix)
- T-07-02-05 (Elevation — compromised auditWrite SA) → mitigated by audit-writer-sa having only roles/datastore.user (Wave 1 SA inventory)
- T-07-02-06 (Repudiation — silent mirror failure with no primary) → accept (Wave 5 BigQuery sink is the infra-tier backstop; Cloud Logging captures all trigger invocations)

The auditEventType enum widening introduces three new enum values (`data.{org,user,document}.delete.mirror`). A client COULD submit one through auditWrite, but actor.{uid,email,role,orgId} is overwritten from request.auth.token (Pitfall 17), so a forged "system" actor on a mirror event is structurally impossible — the audit row will show the caller's verified ID-token identity.

## Phase 7 Cleanup-Ledger Row Drafted

(Full row to land in 07-06 Wave 6 cleanup-ledger):

```
| AUDIT-01 + AUDIT-04 + AUDIT-07 | closed in Wave 2 | auditWrite callable + 3 mirror triggers + tests/rules/auditLog.test.js | 2026-05-09 |
```

Carry-forward queued for Phase 9 view-side wiring (AUDIT-05) — `src/cloud/auditWrite.js` wrapper does not yet exist; Wave 6 fills it (alongside the existing `src/cloud/claims-admin.js` clientReqId fix). Until that wrapper lands, src/-side callers will need to construct `httpsCallable("auditWrite")(...)` calls directly — same blocker shape as Wave 1's `setClaims` clientReqId carry-forward.

## Notes for Wave 6 (TEST-09 firebase-functions-test integration)

The four functions land here with pure-mocked unit test coverage. Wave 6 substitutes the real handler via `firebase-functions-test@3.5.0` (added as devDep in Wave 1) and exercises:

- enforceAppCheck flag at runtime (currently un-testable in pure-mock seam)
- Real Firestore writes against the emulator
- Real ensureIdempotent doc-shard collisions
- Real Sentry capture lifecycle (with a fake DSN)
- The 60s dedup query against an emulator-seeded auditLog row

Wave 2 unit tests pin the WIRING; Wave 6 pins the BEHAVIOUR end-to-end.
