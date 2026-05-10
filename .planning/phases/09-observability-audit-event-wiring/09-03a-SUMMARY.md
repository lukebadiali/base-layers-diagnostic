---
phase: 09-observability-audit-event-wiring
plan: 03a
subsystem: observability/audit-events
tags: [audit, observability, sentry, lifecycle, auth, schema, wave-3]
requirements: [AUDIT-05, OBS-02, OBS-05]
dependency_graph:
  requires:
    - 09-01 (Sentry init substrate + audit-events proxy)
    - 07 (writeAuditEvent helper, ServerContext, AuditActor)
    - 08 (lifecycle callables — softDelete, restoreSoftDeleted, permanentlyDeleteSoftDeleted)
    - 06 (setClaims callable, beforeUserSignedIn handler)
  provides:
    - 33 new auditEventType enum literals (15 server bare + 18 client .requested)
    - server-side bare audit emissions for iam.claims.set + 3 × 5 lifecycle ops
    - auth.signin.failure substrate wired into beforeUserSignedIn (DORMANT until rejection rules land)
    - foundation for Wave 4 anomaly rules (Plan 04: Rule 1 auth-fail burst, Rule 3 role escalation)
    - foundation for Wave 4 mirror-trigger Pitfall 7 dedup (data.<type>.softDelete is now the primary)
  affects:
    - functions/src/audit/auditEventSchema.ts (enum 28 → 61 entries)
    - functions/src/auth/setClaims.ts (audit emit added after poke write)
    - functions/src/auth/beforeUserSignedIn.ts (try/catch substrate + emit on catch)
    - functions/src/lifecycle/{softDelete,restoreSoftDeleted,permanentlyDeleteSoftDeleted}.ts
    - functions/test/auth/setClaims.unit.test.ts (Test 2 expectations updated for audit-emit doc()/set() calls)
tech_stack:
  added: []
  patterns:
    - Pattern A (callable + audit emit) — matches gdprExportUser:197 / gdprEraseUser:289
    - Pattern 5 #2 (best-effort emit — try/catch swallow, never block underlying op)
    - Pitfall 17 (server-side actor identity from request.auth.token, never from payload)
    - Pitfall 7 (audit fan-out — bare data-domain emissions are PRIMARY, NOT collide with Phase 7 mirrors which are pinned to .delete literals)
key_files:
  created:
    - functions/test/auth/setClaims-audit-emit.test.ts
    - functions/test/auth/beforeUserSignedIn-audit-emit.test.ts
    - functions/test/lifecycle/softDelete-audit-emit.test.ts
    - functions/test/lifecycle/restoreSoftDeleted-audit-emit.test.ts
    - functions/test/lifecycle/permanentlyDeleteSoftDeleted-audit-emit.test.ts
    - .planning/phases/09-observability-audit-event-wiring/09-03a-SUMMARY.md
  modified:
    - functions/src/audit/auditEventSchema.ts
    - functions/src/auth/setClaims.ts
    - functions/src/auth/beforeUserSignedIn.ts
    - functions/src/lifecycle/softDelete.ts
    - functions/src/lifecycle/restoreSoftDeleted.ts
    - functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts
    - functions/test/audit/auditEventSchema.unit.test.ts
    - functions/test/auth/setClaims.unit.test.ts
    - .planning/phases/09-observability-audit-event-wiring/deferred-items.md
decisions:
  - server-side bare emission via direct writeAuditEvent (Admin SDK) — bypasses auditWrite callable's authentication gate (auditWrite.ts:51-53 rejects unauthenticated callers; this is the loop BLOCKER 1 fix specifically avoids)
  - beforeUserSignedIn substrate fires only on internal handler errors today (logger throw, malformed event.data); rejection-emission is intentionally substrate-only (no new business rejection rules added in Phase 9)
  - permanentlyDeleteSoftDeleted target.orgId:null because callable input has no orgId field (resource lives in admin-scoped softDeleted/{type}/items/{id})
  - 33 enum literals landed atomically here (15 bare + 18 .requested) so Plan 03 (client wiring) is reduced to a no-op verifier — no double-edit
  - existing setClaims.unit.test.ts Test 2 broken by Phase 9 wiring (now 2 doc()/set() calls instead of 1) — fixed inline per Rule 1, pinning poke at index 0 + audit emit at index 1
metrics:
  start: "2026-05-10T17:09:37Z"
  end: "2026-05-10T17:30:09Z"
  duration_minutes: 20
  tasks_completed: 3
  tests_added: 25
  files_created: 6
  files_modified: 9
  commits: 3
---

# Phase 9 Plan 03a: Server-side Audit-Event Substrate Summary

Server-side bare audit emissions for iam.claims.set + 3 × 5 lifecycle ops + auth.signin.failure substrate, with the full 33-literal enum extension landed atomically so Plan 03 (client wiring) becomes a pure consumer.

## What Landed

### Enum extension (Task 1)

`functions/src/audit/auditEventSchema.ts` — auditEventType Zod enum extended from 28 to 61 entries:

- **15 server-side bare flavours** (5 types × 3 ops): `data.{action,comment,document,message,funnelComment}.{softDelete,restore,permanentlyDelete}`
- **18 client-side `.requested` companions**: `iam.claims.set.requested`, `compliance.{export,erase}.user.requested`, plus the 15 data-domain `.requested` variants

Verification: `grep -cE '^\s*"data\.(action|comment|document|message|funnelComment)\.(softDelete|restore|permanentlyDelete)",'` returns 15; `grep -cE '\.requested",'` returns 18; total enum entry count is 61.

### Auth audit emissions (Task 2)

**`functions/src/auth/setClaims.ts`** — emits `iam.claims.set` AFTER the poke write (Pitfall 2 ordering preserved), BEFORE the existing `logger.info("auth.claims.set")`. Actor sourced from `request.auth.token` (uid/email/role/orgId) per Pitfall 17. Payload carries `{newRole, newOrgId}` only — no identity. Wrapped in try/catch (Pattern 5 #2): claim mutation never blocked by audit-emit failure; `logger.warn("audit.emit.failed")` on catch. Wave 4 Rule 3 (role escalation alert) reads from these rows.

**`functions/src/auth/beforeUserSignedIn.ts`** — body wrapped in try/catch; on catch branch, emits `auth.signin.failure` with `actor.uid:null` (unauthenticated context), `actor.email` from `event.data`, `ip` + `userAgent` from event for forensics. Original error re-thrown so blocking-handler infrastructure signals failure to client; audit emit fires regardless. **SUBSTRATE-HONEST: handler does NOT currently REJECT sign-ins.** Catch fires only on internal handler errors today. Wave 4 Rule 1 (auth-fail burst >5/IP/5min) trigger code is functional + dormant; populates the moment any future plan adds an explicit rejection rule (e.g. block disabled accounts at sign-in time).

### Lifecycle audit emissions (Task 3)

All 3 lifecycle callables import `writeAuditEvent` + `randomUUID` and emit immediately AFTER the data mutation (`batch.commit()` for softDelete/restoreSoftDeleted, `ref.delete()` for permanentlyDeleteSoftDeleted), BEFORE the existing `logger.info` trace.

| Callable | Emit type | target.orgId | Notes |
|----------|-----------|--------------|-------|
| `softDelete` | `data.<type>.softDelete` | `data.orgId` from input | 5 types via union narrow |
| `restoreSoftDeleted` | `data.<type>.restore` | `data.orgId` from input | snapshot already deleted at emit time |
| `permanentlyDeleteSoftDeleted` | `data.<type>.permanentlyDelete` | `null` | callable input has no orgId (admin-scoped softDeleted/* path) |

Every emit uses union literal narrowing on the type string to satisfy the Zod enum check at compile time (TypeScript template-literal types). Every emit is wrapped in try/catch (Pattern 5 #2) — the data mutation already committed by the time audit-emit runs, so emit failure cannot roll back the underlying op. `logger.warn("audit.emit.failed", {type, id, error})` on catch.

Pitfall 7 dedup: the new bare `data.<type>.softDelete` flavours do NOT collide with Phase 7 mirror triggers — those are pinned to the bare `.delete` literals (`data.org.delete`, `data.user.delete`, `data.document.delete`). The new soft/restore/permanently variants are net-new emissions; no double-write risk.

### Tests

| Test file | Tests | Coverage |
|-----------|-------|----------|
| `test/audit/auditEventSchema.unit.test.ts` (extended) | +10 | 6 new acceptance tests (bare + .requested), 2 existing-literal-preserved tests, 2 negative tests (over-broad rejected, bogus rejected) |
| `test/auth/setClaims-audit-emit.test.ts` (new) | 4 | success path shape + actor from token, best-effort swallow, auth gate prevents emit, emit ordering after poke |
| `test/auth/beforeUserSignedIn-audit-emit.test.ts` (new) | 2 | failure-branch substrate emits + re-throws, happy path does NOT emit |
| `test/lifecycle/softDelete-audit-emit.test.ts` (new) | 3 | success shape, best-effort swallow, emit ordering after batch.commit |
| `test/lifecycle/restoreSoftDeleted-audit-emit.test.ts` (new) | 3 | success shape, swallow, ordering after batch.commit (snap already gone) |
| `test/lifecycle/permanentlyDeleteSoftDeleted-audit-emit.test.ts` (new) | 3 | success shape with target.orgId:null, no emit on not-found, swallow |

**Total: +25 new tests across 5 new test files + 1 extended file.** All 25 pass.

## Verification Results

Per the plan's `<verification>` block:

```
$ cd functions; npm test -- --run test/audit/ test/auth/ test/lifecycle/
Test Files  16 passed (16)
Tests       107 passed (107)
Duration    4.60s

$ grep -cE '^\s*"data\.(action|comment|document|message|funnelComment)\.(softDelete|restore|permanentlyDelete)",' functions/src/audit/auditEventSchema.ts
15

$ grep -cE '\.requested",' functions/src/audit/auditEventSchema.ts
18

$ grep -c "writeAuditEvent" functions/src/auth/setClaims.ts \
                            functions/src/auth/beforeUserSignedIn.ts \
                            functions/src/lifecycle/softDelete.ts \
                            functions/src/lifecycle/restoreSoftDeleted.ts \
                            functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts
sum: 11 (>= 5 required by plan)
```

`cd functions; npm run lint` — 6 pre-existing errors only (all documented in `deferred-items.md` as Phase 8 inheritance: 4 × `FirebaseFirestore` no-undef + 2 × `_event` no-unused-vars). Zero new errors introduced.

`cd functions; npm run typecheck` — 5 pre-existing `node_modules` errors only (firebase-admin nested `@google-cloud/firestore` dep collision). Zero new errors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated pre-existing setClaims.unit.test.ts Test 2 to expect 2 doc()/set() calls**

- **Found during:** Task 2 verification (after wiring writeAuditEvent into setClaims.ts)
- **Issue:** The pre-existing `test/auth/setClaims.unit.test.ts` Test 2 ("poke-pattern preserved") asserted `expect(firestoreDocSpy).toHaveBeenCalledTimes(1)` and `expect(firestoreSetSpy).toHaveBeenCalledTimes(1)`. With Phase 9 wiring, writeAuditEvent (which dynamically imports firebase-admin/firestore) routes through the same vi.mock — so doc() now fires twice (poke + audit emit) and set() fires twice.
- **Fix:** Updated Test 2 to expect `toHaveBeenCalledTimes(2)` for both spies, pinned poke at index 0 + audit emit at index 1, asserted the audit doc path matches `auditLog/[uuid]`.
- **Files modified:** functions/test/auth/setClaims.unit.test.ts
- **Commit:** 4d625d7

This is a Rule 1 fix — the change is a direct consequence of Task 2's wiring; the test asserted a now-stale invariant. The poke-pattern assertion (poke is at index 0; audit emit is at index 1) is preserved + tightened.

### Auth gates

None occurred during execution.

### Out-of-scope discoveries

**Full-suite test-pollution flakes (5 integration tests).** When running `cd functions && npm test -- --run` (full 247-test suite), 5 integration tests intermittently fail — each one passes deterministically when run in isolation. Verified pre-existing by stashing my changes and reproducing identical failures on the bare branch tip. Flakes are caused by vitest forks pool sharing module-level state in `_mocks/admin-sdk.ts`. Logged in `.planning/phases/09-observability-audit-event-wiring/deferred-items.md` (2026-05-10 entry). Resolution is a vitest config refactor — out of scope for the audit-event substrate work. Tracking for Plan 09-06 cleanup-ledger close-gate sweep.

## DORMANT Substrates Documented

### beforeUserSignedIn try/catch substrate

**Status:** Substrate-honest dormancy. Wave 4 Rule 1 (auth-fail burst >5/IP/5min) trigger code is functional + sees zero rows today.

**Why:** the handler does NOT currently REJECT sign-ins. The catch branch fires only on internal handler errors (logger.info throw, malformed event.data). When a future plan adds business-rule rejections (e.g. "block sign-in if `event.data.disabled === true`" or "reject blocked email domains"), Rule 1 starts seeing real wrong-password and disabled-account events with ZERO additional schema/trigger changes — just throw inside the handler.

This is the same dormancy pattern applied to MFA Rule 2 (see plan's `<mfa_rationale>`).

### MFA enrol/un-enrol audit emission

**Status:** Deferred — bound to landing of `enrollTotp`/`unenrollAllMfa` deps in `src/main.js:916-917` (currently `// deferred to user-testing phase`). Per plan D-09-03a-4.

The current `auth.mfa.enrol` + `auth.mfa.unenrol` enum literals (Phase 7 baseline) are RETAINED — they are valid types ready for emission. Wave 4 Rule 2 (MFA disenrolment alert) trigger logic is RETAINED — it WILL fire correctly the moment any source emits these types.

**Forward-tracking ledger row queued for Phase 9 cleanup ledger (Plan 06 Task 2):**
> "MFA audit-event emission DEFERRED — bound to landing of `enrollTotp`/`unenrollAllMfa` deps in src/main.js (currently `// deferred to user-testing phase`). Re-evaluate in Phase 10 or whenever the MFA deps land."

## Next Plan

**09-03 (client-side `.requested` wiring):** Plan 03 is now reduced from "extend enum + wire client wrappers" to a pure consumer of the enum that this plan defines. The Plan 03 enum-extension Task is a verify-only step (assert all 18 `.requested` literals exist via `grep -c '\.requested",' functions/src/audit/auditEventSchema.ts | xargs test 18 =` plus a Vitest assertion).

## Self-Check: PASSED

Per the executor self-check protocol:

**Created files exist:**
- `functions/test/auth/setClaims-audit-emit.test.ts` — FOUND
- `functions/test/auth/beforeUserSignedIn-audit-emit.test.ts` — FOUND
- `functions/test/lifecycle/softDelete-audit-emit.test.ts` — FOUND
- `functions/test/lifecycle/restoreSoftDeleted-audit-emit.test.ts` — FOUND
- `functions/test/lifecycle/permanentlyDeleteSoftDeleted-audit-emit.test.ts` — FOUND
- `.planning/phases/09-observability-audit-event-wiring/09-03a-SUMMARY.md` — being written now

**Commits exist:**
- `cf768d7` — feat(09-03a): extend auditEventSchema enum (Task 1)
- `4d625d7` — feat(09-03a): emit iam.claims.set + auth.signin.failure substrate (Task 2)
- `aca4bd2` — feat(09-03a): emit data.<type>.<op> from 3 lifecycle callables (Task 3)
