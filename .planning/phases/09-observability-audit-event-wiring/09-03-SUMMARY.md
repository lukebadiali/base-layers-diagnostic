---
phase: 09-observability-audit-event-wiring
plan: 03
subsystem: observability/audit-events
tags: [audit, observability, client-wiring, auth, gdpr, lifecycle, claims, wave-4]
requirements: [AUDIT-05, OBS-02]
dependency_graph:
  requires:
    - 09-01 (emitAuditEvent proxy at src/observability/audit-events.js)
    - 09-03a (server-side bare audit emissions + 33-literal enum extension)
    - 06 (setClaims callable + Phase 6 unified-error wrapper at src/firebase/auth.js)
    - 07 (writeAuditEvent + auditWrite callable infrastructure)
    - 08 (gdprExportUser + gdprEraseUser callables; soft-delete + restore + permanentlyDelete callables)
  provides:
    - Client-side `.requested` audit-event emission at all 6 cloud/* call sites
    - Client-side bare auth-event emission at 5 src/firebase/auth.js sites
    - Latency-observable client⇄server pair for every sensitive op
    - Wiring-matrix regression gate at tests/audit-wiring.test.js
    - PII-scrub regression gate (zero email/password/name/ip/userAgent in payloads)
  affects:
    - src/firebase/auth.js (5 emit sites added: signIn success/failure ternary, signOut PRE-emit, updatePassword POST-emit, sendPasswordResetEmail POST-emit, signInWithEmailLink POST-emit)
    - src/cloud/claims-admin.js (1 emit site: iam.claims.set.requested with newRole payload)
    - src/cloud/gdpr.js (2 emit sites: compliance.export.user.requested, compliance.erase.user.requested)
    - src/cloud/soft-delete.js (3 emit sites: data.<type>.{softDelete,restore,permanentlyDelete}.requested)
tech_stack:
  added: []
  patterns:
    - Pattern 5 #2 (best-effort emission — try/catch around emit; never block originating op on audit failure)
    - Pattern 5 #4 (latency-observable .requested companion — client wrapper emits .requested AFTER server callable resolves; pairs with server-side bare emission from Plan 03a)
    - Pattern A (try/finally for sign-in dual-outcome — outcome flag flipped inside the try, emit fires in finally regardless of throw path)
    - Pitfall 17 (server-only actor identity — payload carries only opaque non-PII fields like {newRole, method}; actor.{uid,email,role,orgId} server-overlaid from request.auth.token by auditWrite)
    - PRE-emit ordering for signOut (emit BEFORE fbSignOut because App Check token + ID-token are revoked by sign-out, so post-emit auditWrite would reject)
key_files:
  created:
    - tests/firebase/auth-audit-emit.test.js
    - tests/audit-wiring.test.js
    - .planning/phases/09-observability-audit-event-wiring/09-03-SUMMARY.md
  modified:
    - src/firebase/auth.js
    - src/cloud/claims-admin.js
    - src/cloud/gdpr.js
    - src/cloud/soft-delete.js
decisions:
  - "All 11 emit calls wrapped in try/catch around emitAuditEvent — defensive double-wrap (the proxy already swallows internally per Plan 09-01) so a thrown emission cannot escape and disrupt the originating op"
  - "signInEmailPassword uses try/finally with an `outcome` flag — single emit call site with ternary type selection (auth.signin.success vs auth.signin.failure); cleaner than two separate emits in catch + try blocks"
  - "signOut uses PRE-emit ordering — App Check token + ID-token revoked by fbSignOut; post-emit would predictably 401/403 the auditWrite callable, so emit BEFORE the side effect"
  - "sendPasswordResetEmail target.id is hardcoded 'unknown' — caller is by definition not yet authenticated; server cannot resolve a uid pre-sign-in; the auditWrite callable will reject this emit (no request.auth) and emitAuditEvent's internal swallow handles that gracefully"
  - "permanentlyDeleteSoftDeleted target.orgId:null — callable input has no orgId field (admin-only resource at admin-scoped softDeleted/<type>/items/{id} path); pinned in test to prevent drift"
  - "MFA enrol/un-enrol audit-event wiring DEFERRED — Plan 03a §mfa_rationale carry-forward; the deps `enrollTotp` / `unenrollAllMfa` are explicitly undefined in src/main.js:916-917 (`// deferred to user-testing phase`); Wave 4 Rule 2 (MFA disenrolment alert) trigger code stays DORMANT — observation is zero until those deps land"
  - "auth.js emit sites use bare auth.* literals (auth.signin.success, auth.signin.failure, auth.signout, auth.password.change, auth.password.reset) — no .requested suffix — because the server-side observation point for auth events is the Firebase Identity Platform's ID-token issuance, not a Cloud Function callable; the .requested suffix is reserved for client wrappers around server callables (cloud/* sites)"
  - "Removed 4 incorrect `eslint-disable-next-line @typescript-eslint/no-floating-promises` comments — the rule isn't configured in this project's eslint config; Rule 1 fix during GREEN to clear lint errors without changing behaviour"
metrics:
  start: "2026-05-10T17:35:00Z"
  end: "2026-05-10T17:48:24Z"
  duration_minutes: 13
  tasks_completed: 3
  tests_added: 14
  files_created: 2
  files_modified: 4
  commits: 4
---

# Phase 9 Plan 03: AUDIT-05 Client-side Audit-Event Wiring Summary

Client-side audit-event emission wired across all 9 sensitive-op view-side call sites (5 in src/firebase/auth.js + 1 in claims-admin.js + 2 in gdpr.js + 3 in soft-delete.js) — pairs with the Plan 03a server-side bare emissions to make every client⇄server round-trip latency-observable.

## What Landed

### Task 1 — Plan 03a enum verification (verify-only, no commit)

Per the plan's Task 1 spec, this was a pure VERIFIER step — confirming Plan 03a landed the auditEventSchema enum extension correctly so this plan's emission sites have the literals they need. No source files modified; no commit produced.

Verification results:

```
$ grep -cE '"iam\.claims\.set\.requested"' functions/src/audit/auditEventSchema.ts
1
$ grep -cE '"compliance\.(export|erase)\.user\.requested"' functions/src/audit/auditEventSchema.ts
2
$ grep -cE '"data\.(action|comment|document|message|funnelComment)\.(softDelete|restore|permanentlyDelete)\.requested"' functions/src/audit/auditEventSchema.ts
15
$ grep -cE '\.requested"' functions/src/audit/auditEventSchema.ts
18
$ cd functions && npm test -- --run test/audit/auditEventSchema.unit.test.ts
Test Files  1 passed (1)
Tests       18 passed (18)
```

Total: 1 + 2 + 15 = 18 `.requested` literals + 15 bare data-domain literals + 28 baseline = 61 enum entries (matches Plan 03a). Schema test green at HEAD. Plan 03a deliverable confirmed.

### Task 2 — src/firebase/auth.js client wiring (GREEN after RED)

Wired 5 emit calls covering 6 functional call sites (signInEmailPassword counts as ONE emit-call site with TWO outcome variants via the `outcome` flag inside the try/finally):

| Function | Emit type | Ordering | target.id | payload |
|----------|-----------|----------|-----------|---------|
| `signInEmailPassword` | `auth.signin.success` or `auth.signin.failure` (ternary on `outcome`) | POST (in `finally`) | `auth.currentUser?.uid ?? "unknown"` | `{}` |
| `signOut` | `auth.signout` | **PRE** (before `fbSignOut`) | `auth.currentUser?.uid ?? "unknown"` | `{}` |
| `updatePassword` | `auth.password.change` | POST (after `fbUpdatePassword` + BLOCKER-FIX 1 setClaims block) | `user.uid` | `{}` |
| `sendPasswordResetEmail` | `auth.password.reset` | POST (after `fbSendPasswordResetEmail`) | `"unknown"` (caller unauthenticated) | `{}` |
| `signInWithEmailLink` | `auth.signin.success` | POST (after `fbSignInWithEmailLink`) | `auth.currentUser?.uid ?? "unknown"` | `{ method: "emailLink" }` |

**PRE-emit rationale for signOut:** the underlying `fbSignOut(auth)` revokes both the App Check token and the ID-token; any subsequent `auditWrite` callable invocation would then reject for lack of authentication. Emit BEFORE the side effect.

**try/catch wrapping:** Every emit is wrapped — `emitAuditEvent` already swallows errors internally per Plan 09-01's contract, but the double-wrap defends against any synchronous throw at the call site itself (e.g. a TypeError if the proxy is somehow undefined). Pattern 5 #2 enforced strictly: never block auth flow on audit failure.

**signInEmailPassword try/finally with `outcome` flag:** the `let outcome = "failure"` declared before the try block defaults to failure. On success path, `outcome = "success"` is assigned BEFORE the return statement (which propagates the auth result back to caller). The `finally` block reads `outcome` and emits the correct event type via ternary. This is a single emit-call site with two type variants — cleaner than duplicating the emit logic in both the try and catch branches.

### Task 3 — src/cloud/* client wiring (GREEN after RED)

Wired 6 POST-emit sites — every cloud/* callable wrapper emits the `.requested` companion AFTER the server callable resolves:

| File | Function | Emit type | target.id | target.orgId | payload |
|------|----------|-----------|-----------|--------------|---------|
| `claims-admin.js` | `setClaims` | `iam.claims.set.requested` | `input.uid` | `input.orgId ?? null` | `{ newRole: input.role ?? null }` |
| `gdpr.js` | `exportUser` | `compliance.export.user.requested` | `input.userId` | `null` | `{}` |
| `gdpr.js` | `eraseUser` | `compliance.erase.user.requested` | `input.userId` | `null` | `{}` |
| `soft-delete.js` | `softDelete` | `data.${input.type}.softDelete.requested` | `input.id` | `input.orgId` | `{}` |
| `soft-delete.js` | `restoreSoftDeleted` | `data.${input.type}.restore.requested` | `input.id` | `input.orgId` | `{}` |
| `soft-delete.js` | `permanentlyDeleteSoftDeleted` | `data.${input.type}.permanentlyDelete.requested` | `input.id` | **`null`** (admin-scoped, no org) | `{}` |

The soft-delete callables use template-literal type construction (`` `data.${input.type}.softDelete.requested` ``) — input.type is constrained at the JSDoc level to `"action"|"comment"|"document"|"message"|"funnelComment"`, so each construction synthesises one of the 15 valid `.requested` enum literals from Plan 03a. Compile-time enum-literal check via JSDoc + ts-check.

Every emit POST-resolves the server callable (await `<callable>({ ...input, clientReqId })` first, THEN emit). Best-effort try/catch wrapper preserves the originating op outcome on emit failure.

### Tests

| Test file | Tests | Coverage |
|-----------|-------|----------|
| `tests/firebase/auth-audit-emit.test.js` (new) | 7 | Test 1-2: signInEmailPassword success+failure paths emit correct types with empty payload (Pitfall 17); Test 3: signOut PRE-emit ordering verified via call-order tracking; Test 4: updatePassword POST-emits `auth.password.change`; Test 5: sendPasswordResetEmail emits with target.id="unknown" + empty payload (no email leak); Test 6: signInWithEmailLink emits with payload.method="emailLink"; Test 7: emit-throw inside finally does NOT bubble out (best-effort) |
| `tests/audit-wiring.test.js` (new — wiring matrix) | 7 | Test 1-3: claims-admin + gdpr exportUser/eraseUser emit correct types; Test 4-6: soft-delete trio emits per-type literals; Test 7: full matrix sweep + Pitfall 17 forbidden-PII grep over all 6 cloud/* payloads |

**Total: +14 new tests across 2 new test files.** Both test files pass on their own and the full root vitest suite remains green.

## Verification Results

Per the plan's `<verification>` block and VALIDATION.md acceptance criteria:

```
$ npx vitest run tests/firebase/auth-audit-emit.test.js
Test Files  1 passed (1)
Tests       7 passed (7)

$ npx vitest run tests/audit-wiring.test.js
Test Files  1 passed (1)
Tests       7 passed (7)

$ npx vitest run
Test Files  68 passed (68)
Tests       478 passed (478)
Duration    47.12s

$ cd functions && npm test -- --run test/audit/auditEventSchema.unit.test.ts
Test Files  1 passed (1)
Tests       18 passed (18)

$ npm run lint
(exit 0 — no errors, no warnings)

$ grep -cE "emitAuditEvent\(" src/firebase/auth.js src/cloud/claims-admin.js src/cloud/gdpr.js src/cloud/soft-delete.js
src/firebase/auth.js:5
src/cloud/claims-admin.js:1
src/cloud/gdpr.js:2
src/cloud/soft-delete.js:3
(11 emit invocations across 9 functional call sites — auth.js's signInEmailPassword
 is one emit call with a ternary that emits success or failure based on outcome flag)

$ grep -nE "(emitAuditEvent|writeAuditEvent)" -A 5 src/firebase/auth.js src/cloud/*.js | grep -iE "(email:|password:|name:|ip:|userAgent:)"
(empty — zero PII in any payload; Pitfall 17 invariant verified)

$ grep -cE "auth\.signin\.success|auth\.signin\.failure|auth\.signout|auth\.password\.change|auth\.password\.reset" src/firebase/auth.js
7  (covers all 5 distinct types — auth.signin.success appears twice: once in the
   signInEmailPassword ternary, once in signInWithEmailLink)
```

`npm run typecheck` exits non-zero on **pre-existing** Phase 8 inheritance errors in `src/views/admin.js` (LIFE-06 admin UI wiring) and `tests/data/soft-deleted.test.js`. Verified pre-existing by stashing my Plan 09-03 changes and reproducing identical failures on the bare branch tip. Documented in `deferred-items.md` (existing 2026-05-10 entry under "Discovered during 09-01 Task 2"). Zero new typecheck errors introduced by this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed 4 incorrect `eslint-disable-next-line @typescript-eslint/no-floating-promises` comments**

- **Found during:** Task 2 verification (`npm run lint` after wiring auth.js)
- **Issue:** I had added `// eslint-disable-next-line @typescript-eslint/no-floating-promises` above each `emitAuditEvent(...)` call to silence the floating-promise warning that fires-and-forgets the promise return. ESLint reported these as errors: "Definition for rule '@typescript-eslint/no-floating-promises' was not found" — the rule isn't configured in this project's flat eslint.config.js.
- **Fix:** Removed all 4 disable comments. The fire-and-forget calls are intentional (best-effort emission per Pattern 5 #2) and the project doesn't actually have the floating-promises rule enabled, so no disable is needed.
- **Files modified:** src/firebase/auth.js
- **Commit:** included in `9aecdd5` (Task 2 GREEN — squashed with the wiring change since they were in the same edit cycle)

### Auth gates

None occurred during execution.

### Out-of-scope discoveries

**Pre-existing typecheck errors in `src/views/admin.js` + `tests/data/soft-deleted.test.js`.** Logged previously in deferred-items.md. Plan 09-03 explicitly does NOT touch either file, and `git stash && npm run typecheck` reproduces identical failures on the pre-Plan-09-03 working tree. Not fixed; tracking persists for Plan 09-06 cleanup-ledger close-gate sweep (or Phase 8 follow-up).

## DORMANT Substrates Documented

### MFA enrol/un-enrol audit-event wiring

**Status:** Deferred — bound to landing of `enrollTotp` / `unenrollAllMfa` deps in `src/main.js:916-917` (currently `// deferred to user-testing phase`). Plan 03a §mfa_rationale carry-forward; this plan inherits the deferral.

**Rationale:** the canonical AUDIT-05 wiring inventory in 09-RESEARCH.md lists 9 view-side sites. Two of those — `auth.mfa.enrol` after TOTP enrolment and `auth.mfa.unenrol` after MFA factor removal — depend on view-layer dispatchers (`enrollTotp`, `unenrollAllMfa`) that haven't been built yet. The `auth.mfa.enrol` and `auth.mfa.unenrol` enum literals (Phase 7 baseline) are RETAINED in the schema; Wave 4 Rule 2 (MFA disenrolment alert) trigger logic is RETAINED — both will fire correctly the moment any source emits these types.

**Forward-tracking ledger row** (carries forward into Plan 06 Task 2 close gate):
> "MFA audit-event emission DEFERRED — bound to landing of `enrollTotp`/`unenrollAllMfa` deps in src/main.js (currently `// deferred to user-testing phase`). Re-evaluate in Phase 10 or whenever the MFA deps land."

### auth.signin.failure double-emission semantics

**Status:** Substrate-honest — both client `.failure` (this plan) and server `auth.signin.failure` (Plan 03a beforeUserSignedIn) coexist by design.

**Why no double-row risk:** the client emit fires from `signInEmailPassword`'s `finally` block on the failure path. However, the auditWrite callable rejects unauthenticated callers (`auditWrite.ts:51-53`), so a wrong-password attempt's client emit will itself receive `unauthenticated` from the callable and emitAuditEvent's internal swallow logs it but writes nothing to auditLog. The Plan 03a server-side substrate at `beforeUserSignedIn.ts` is the ONLY actual writer for `auth.signin.failure` rows.

When/if a future plan adds business-rule sign-in rejections (e.g. block disabled accounts), the Plan 03a substrate emits real rows and Wave 4 Rule 1 (auth-fail burst >5/IP/5min) starts seeing them. The client emit remains useful as a "tried" signal in client-side telemetry without polluting the server-side audit log.

## Forward-Tracking Ledger Rows Carried Forward

(For Plan 09-06 cleanup-ledger zero-out gate.)

1. **MFA enrol/un-enrol client-side audit emission** — DEFERRED until enrollTotp/unenrollAllMfa deps land in src/main.js:916-917. Adds 2 emit sites at view-side.
2. **Phase 9 mirror-trigger collision verification** — verifiable post-deploy by examining auditLog rows for a synthetic 50-doc soft-delete cascade. Plan 06 cleanup ledger carryover; expect: 1 cascade alert per pitfall 7 dedup window.

## Next Plan

**09-04 (authAnomalyAlert Slack dispatcher + authFailureCounters substrate):** onDocumentCreated trigger over `auditLog/{eventId}` pattern-matches the four anomaly rules:

- Rule 1: >5 `auth.signin.failure` from same IP in 5 minutes (reads from beforeUserSignedIn substrate from Plan 03a; client `.failure` rows are blocked by auditWrite's auth gate so don't pollute the counter)
- Rule 2: any `auth.mfa.unenrol` (DORMANT until MFA wiring lands)
- Rule 3: any `iam.claims.set` where `payload.newRole === "admin"` (reads from Plan 03a setClaims emission)
- Rule 4: `compliance.export.user` outside business hours (reads from Phase 8 gdprExportUser server emission)

Plan 09-04 + this plan together complete OBS-05 substrate (anomaly detection wired); Plan 09-05 then provisions the `audit-alert-sa` SA + Secret Manager secrets + first deploy.

## Self-Check: PASSED

Per the executor self-check protocol:

**Created files exist:**
- `tests/firebase/auth-audit-emit.test.js` — FOUND
- `tests/audit-wiring.test.js` — FOUND
- `.planning/phases/09-observability-audit-event-wiring/09-03-SUMMARY.md` — being written now

**Commits exist:**
- `f8cf0ef` — test(09-03): add failing audit-emit tests for src/firebase/auth.js (RED)
- `9aecdd5` — feat(09-03): wire 6 audit emit sites in src/firebase/auth.js (GREEN)
- `77ccf2d` — test(09-03): add wiring-matrix test for cloud/* audit emit sites (RED)
- `a0639e8` — feat(09-03): wire 6 .requested audit emits in src/cloud/* (GREEN)

**Verification spot-checks:**
- All 7 auth-audit-emit tests green at HEAD
- All 7 audit-wiring matrix tests green at HEAD
- Full root suite 478/478 green (was 471 baseline + 7 new wiring matrix tests; the 7 auth-audit-emit tests were already counted in the post-RED baseline of 471 since Task 2 RED was committed first)
- Plan 03a auditEventSchema.unit.test.ts 18/18 green
- Lint clean (zero errors, zero warnings)
- PII-grep over the 11 emit call sites returns empty (Pitfall 17 invariant verified)
