---
phase: 09-observability-audit-event-wiring
plan: 03a
type: execute
wave: 3
depends_on: ["09-observability-audit-event-wiring/09-01"]
files_modified:
  - functions/src/audit/auditEventSchema.ts
  - functions/src/auth/setClaims.ts
  - functions/src/auth/beforeUserSignedIn.ts
  - functions/src/lifecycle/softDelete.ts
  - functions/src/lifecycle/restoreSoftDeleted.ts
  - functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts
  - functions/test/audit/auditEventSchema.test.ts
  - functions/test/auth/setClaims-audit-emit.test.ts
  - functions/test/auth/beforeUserSignedIn-audit-emit.test.ts
  - functions/test/lifecycle/softDelete-audit-emit.test.ts
  - functions/test/lifecycle/restoreSoftDeleted-audit-emit.test.ts
  - functions/test/lifecycle/permanentlyDeleteSoftDeleted-audit-emit.test.ts
autonomous: true
requirements: [AUDIT-05, OBS-02, OBS-05]
must_haves:
  truths:
    - "auditEventSchema enum extended with 16 NEW server-side bare literals NOT yet in enum (auth.signin.failure already exists; verify) — 15 data-domain bare flavours (5 types × 3 ops: softDelete/restore/permanentlyDelete) + 1 if any iam-substrate gap"
    - "auditEventSchema enum extended with 18 NEW client-side .requested literals (1 iam + 2 compliance + 15 data) — moved here from Plan 03 so the enum lands in one atomic edit"
    - "functions/src/auth/setClaims.ts emits writeAuditEvent({type:'iam.claims.set', target:{type:'user', id:data.uid, orgId}, payload:{newRole, newOrgId}}) AFTER getCustomUserClaims succeeds — actor server-resolved from request.auth.token (Pitfall 17)"
    - "functions/src/auth/beforeUserSignedIn.ts emits writeAuditEvent({type:'auth.signin.failure', ...}) on the BLOCKING-rejection branch (when handler throws or signals failure to client). The handler currently does NOT reject — Phase 9 ADDS a rejection branch only for the failure-emission path. The IP comes from event.ipAddress; actor is null/system because user is unauthenticated."
    - "functions/src/lifecycle/softDelete.ts emits writeAuditEvent({type:`data.${data.type}.softDelete`, target:{type:data.type, id:data.id, orgId:data.orgId}, payload:{}}) AFTER batch.commit() succeeds"
    - "functions/src/lifecycle/restoreSoftDeleted.ts emits writeAuditEvent({type:`data.${data.type}.restore`, ...}) AFTER batch.commit() succeeds"
    - "functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts emits writeAuditEvent({type:`data.${data.type}.permanentlyDelete`, ...}) AFTER ref.delete() succeeds"
    - "Every server-side emission uses Pattern: build a synthesised ServerContext (now=Date.now(), eventId=randomUUID(), ip=null/event.ipAddress, userAgent=null, actor={uid:request.auth.uid, email:token.email, role:token.role, orgId:token.orgId}) and calls writeAuditEvent directly — bypasses the auditWrite callable's request.auth.uid gate (the reason BLOCKER 1 cannot fire from client today)"
    - "Best-effort: each server emit wrapped in try/catch that logs but does NOT throw — never block the underlying op on audit failure (Pattern 5 #2)"
  artifacts:
    - path: "functions/src/audit/auditEventSchema.ts"
      provides: "Extended Zod enum: existing 28 + 16 new bare server-side literals (15 data-domain + 1 verify-existing) + 18 new client-side .requested literals = ~62 total. Verify by counting at end of task."
      contains: "data.action.softDelete"
    - path: "functions/src/auth/setClaims.ts"
      provides: "iam.claims.set server-side emission after successful claim mutation"
      contains: "iam.claims.set"
    - path: "functions/src/auth/beforeUserSignedIn.ts"
      provides: "auth.signin.failure server-side emission on rejection branch (FAIL_ON_DISABLED_USER, FAIL_ON_BLOCKED_DOMAIN, etc.)"
      contains: "auth.signin.failure"
    - path: "functions/src/lifecycle/softDelete.ts"
      provides: "data.<type>.softDelete server emission"
      contains: "data."
    - path: "functions/src/lifecycle/restoreSoftDeleted.ts"
      provides: "data.<type>.restore server emission"
      contains: "data."
    - path: "functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts"
      provides: "data.<type>.permanentlyDelete server emission"
      contains: "data."
  key_links:
    - from: "functions/src/auth/setClaims.ts"
      to: "functions/src/audit/auditLogger.ts"
      via: "import { writeAuditEvent }"
      pattern: "from \"\\.\\./audit/auditLogger\\.js\""
    - from: "functions/src/auth/beforeUserSignedIn.ts"
      to: "functions/src/audit/auditLogger.ts"
      via: "import { writeAuditEvent }"
      pattern: "from \"\\.\\./audit/auditLogger\\.js\""
    - from: "functions/src/lifecycle/softDelete.ts"
      to: "functions/src/audit/auditLogger.ts"
      via: "import { writeAuditEvent }"
      pattern: "from \"\\.\\./audit/auditLogger\\.js\""
    - from: "functions/src/lifecycle/restoreSoftDeleted.ts"
      to: "functions/src/audit/auditLogger.ts"
      via: "import { writeAuditEvent }"
      pattern: "from \"\\.\\./audit/auditLogger\\.js\""
    - from: "functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts"
      to: "functions/src/audit/auditLogger.ts"
      via: "import { writeAuditEvent }"
      pattern: "from \"\\.\\./audit/auditLogger\\.js\""
---

<objective>
Phase 9 Wave 3 (substrate) — server-side bare audit-event emissions for the call sites that DO NOT currently emit. Closes the BLOCKER discovered during checker review: Plan 03's narrative claimed dual-emit (server bare + client `.requested`) for setClaims, lifecycle/*, and beforeUserSignedIn, but the bare flavours did not exist server-side. Wave 4 anomaly rules (Plan 04) read from these bare flavours — they MUST exist before Plan 03 lands, otherwise:

- Rule 1 (auth-fail burst) cannot fire — `auditWrite` callable rejects unauthenticated client requests (auditWrite.ts:51-53). Failure-burst counting requires the SERVER to write `auth.signin.failure` rows because the client cannot.
- Rule 3 (role escalation) cannot fire — no server-side `iam.claims.set` row ever lands.
- AUDIT-05 mirror-trigger collision dedup (Pitfall 7) cannot work — the bare `data.<type>.<op>` row is the primary, the client `.requested` is the companion; without the bare row, the mirror triggers never see a primary.

Purpose: Land the server-side substrate. Each emission uses the existing `writeAuditEvent` helper from `functions/src/audit/auditLogger.ts` (Pattern A — Admin-SDK Firestore write), bypassing the `auditWrite` callable's authentication gate by writing directly via Admin SDK. Each emission is best-effort (try/catch swallow) — never blocks the underlying op.

This plan also lands the FULL enum extension (both bare and `.requested` literals) in one atomic edit. Plan 03 (client wiring) becomes a pure consumer of the enum that this plan defines.

Output: 6 server files extended (1 schema + 1 auth + 1 blocking handler + 3 lifecycle); 5 unit tests for the audit emission paths; auditEventSchema test extended to cover all new literals.

D-09-03a-1 (server-emit pattern): Direct `writeAuditEvent` call from inside each callable. The server constructs the `ServerContext` synthetically (now=Date.now(), eventId=randomUUID(), ip=null, userAgent=null, actor=resolved-from-token). NO call to `auditWrite` callable from the server — that's the loop the BLOCKER 1 fix specifically avoids.

D-09-03a-2 (best-effort): Every emit is wrapped in try/catch — log+swallow on failure. Pattern 5 #2 — never block the underlying op on audit failure.

D-09-03a-3 (enum scope): The enum extension here is the SUPERSET of what Plan 03 was originally going to add. Plan 03's enum-extension task is updated to depend on this plan's enum (no double-edit). Specifically: 28 existing + 15 NEW bare data-domain literals (action/comment/document/message/funnelComment × softDelete/restore/permanentlyDelete) + 18 NEW client-side .requested literals = 61 total. Verify the bare auth + iam + compliance literals already exist (auth.signin.failure already exists at line 20; iam.claims.set at line 26; compliance.export.user + compliance.erase.user at lines 39-40 — Phase 7 baseline).

D-09-03a-4 (MFA scope): MFA enrol/un-enrol server-side detection is OUT OF SCOPE for this plan. See `<mfa_rationale>` below — `enrollTotp` + `unenrollAllMfa` deps are explicitly DEFERRED in src/main.js:916-917 ("deferred to user-testing phase"); there is no client emit site to wire AND no server-side hook to detect factor-state change reliably without polling. Wave 4 Rule 2 (MFA disenrolment alert) is documented as DORMANT until those deps land in a future phase.
</objective>

<mfa_rationale>
## MFA Wiring Decision (D-09-03a-4)

**Status:** Deferred — MFA enrol/un-enrol audit emission is NOT wired in Phase 9.

**Rationale:**
- `src/main.js:916-917` shows `enrollTotp` + `unenrollAllMfa` deps are EXPLICITLY left undefined ("deferred to the user-testing phase — left undefined here, the view forms render but submission is a no-op until those deps are wired"). There is no client-side call site to add `emitAuditEvent` to.
- `functions/src/auth/beforeUserSignedIn.ts` runs on EVERY sign-in but does not have access to a "previous factor state" — Firebase Identity Platform does not expose factor-state-change as a separate trigger. We could compute `event.data?.multiFactor?.enrolledFactors?.length` but to detect a CHANGE we'd need to maintain a counter per uid and diff — that's a Phase 10+ scope creep for one observability rule.
- The current `auth.mfa.enrol` + `auth.mfa.unenrol` enum literals (Phase 7 baseline) are RETAINED — they are valid types ready for emission. Wave 4 Rule 2 (MFA disenrolment alert) trigger logic is RETAINED — it WILL fire correctly the moment any source emits these types.

**Wave 4 Plan 04 update:** Rule 2 documented as DORMANT (no current emit source) but trigger code stays. When MFA deps land in a future phase, the audit emit will be a one-line addition to the wired callsite — no schema change, no anomaly-trigger change.

**Forward-tracking ledger row queued for Phase 9 cleanup ledger (Plan 06 Task 2):**
> "MFA audit-event emission DEFERRED — bound to landing of `enrollTotp`/`unenrollAllMfa` deps in src/main.js (currently `// deferred to user-testing phase`). Re-evaluate in Phase 10 or whenever the MFA deps land."
</mfa_rationale>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-observability-audit-event-wiring/09-RESEARCH.md
@.planning/phases/09-observability-audit-event-wiring/09-PATTERNS.md
@functions/src/audit/auditEventSchema.ts
@functions/src/audit/auditLogger.ts
@functions/src/audit/auditWrite.ts
@functions/src/auth/setClaims.ts
@functions/src/auth/beforeUserSignedIn.ts
@functions/src/lifecycle/softDelete.ts
@functions/src/lifecycle/restoreSoftDeleted.ts
@functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts

<interfaces>
From functions/src/audit/auditLogger.ts (Phase 7 — already implemented):

```typescript
import type { AuditEventInput } from "./auditEventSchema.js";

export interface ServerContext {
  now: number;                                  // wall-clock millis
  eventId: string;                              // UUID, server-generated
  ip: string | null;                            // null when unavailable
  userAgent: string | null;                     // null when unavailable
  actor: AuditActor;                            // server-resolved from token
  at?: unknown;                                 // optional override
  idempotencyKey?: string;                      // optional override
}

export interface AuditActor {
  uid: string | null;
  email: string | null;
  role: "admin" | "internal" | "client" | "system" | null;
  orgId: string | null;
}

export async function writeAuditEvent(
  input: AuditEventInput,
  ctx: ServerContext,
): Promise<AuditLogDoc>;
```

From functions/src/audit/auditEventSchema.ts (current 28 entries — see Phase 7 substrate). Already includes: `auth.signin.failure` (line 20), `iam.claims.set` (line 26), `compliance.export.user` + `compliance.erase.user` (lines 39-40). MISSING enum literals (this plan adds them):

15 bare data-domain literals (5 types × 3 ops):
- data.action.softDelete, data.action.restore, data.action.permanentlyDelete
- data.comment.softDelete, data.comment.restore, data.comment.permanentlyDelete
- data.document.softDelete, data.document.restore, data.document.permanentlyDelete  *(note: data.document.delete already exists — softDelete/restore/permanentlyDelete are new)*
- data.message.softDelete, data.message.restore, data.message.permanentlyDelete  *(note: data.message.delete already exists)*
- data.funnelComment.softDelete, data.funnelComment.restore, data.funnelComment.permanentlyDelete

18 client-side .requested literals (1 iam + 2 compliance + 15 data — same shape as bare with `.requested` suffix):
- iam.claims.set.requested
- compliance.export.user.requested, compliance.erase.user.requested
- data.{action,comment,document,message,funnelComment}.{softDelete,restore,permanentlyDelete}.requested  (15 entries)

Total enum after this plan: 28 + 15 + 18 = 61 entries.

From functions/src/auth/beforeUserSignedIn.ts (Phase 6 — current observation-only handler):
- Wraps `firebase-functions/v2/identity` `beforeUserSignedIn` blocking trigger.
- Does NOT currently reject any sign-in.
- Phase 9 EXTENDS: add a try/catch around the existing `logger.info` such that we can emit `auth.signin.failure` on a future failure path — BUT since the handler currently never rejects, the only "failure" we can emit during Phase 9 is when the handler ITSELF throws (e.g. unexpected error). We document that explicit rejection-emission paths (e.g. `event.data.disabled === true → reject + emit failure`) are an EXTENSION POINT — Phase 9 wires the SUBSTRATE (try/catch + writeAuditEvent on the rejection branch), but does NOT add new business-logic rejection rules. The substrate makes Wave 4 Rule 1 fire-able the moment any future plan adds a rejection rule.

**Important nuance:** Wave 4 Rule 1 (auth-fail burst >5/IP/5min) reads from `auth.signin.failure` rows in the auditLog. If beforeUserSignedIn doesn't currently reject anyone, the substrate is in place but the observation rate is zero. THIS IS CORRECT BEHAVIOUR for Phase 9 — when a future phase adds a rejection rule (e.g. blocking disabled accounts), the audit emit fires automatically and Rule 1 starts seeing data. The Wave 4 trigger CODE works; the OBSERVATION pipeline is dormant until rejection rules exist.

This is the same dormancy pattern we apply to MFA Rule 2.
</interfaces>

<patterns_reference>
PATTERNS.md analogs used in this plan:
- functions/src/auth/setClaims.ts (extend) → analog functions/src/gdpr/gdprExportUser.ts:197 + functions/src/gdpr/gdprEraseUser.ts:289 — Phase 8 Wave 3 ALREADY uses writeAuditEvent direct call from inside a callable. Same shape applies to setClaims, lifecycle/*.
- functions/src/auth/beforeUserSignedIn.ts (extend) → analog gdprExportUser.ts but actor.uid is null (unauthenticated context); use actor={uid:null, email:event.data?.email||null, role:null, orgId:null}.
- functions/src/lifecycle/softDelete.ts (extend) → analog functions/src/gdpr/gdprExportUser.ts:197 — same direct writeAuditEvent pattern.
- functions/test/auth/setClaims-audit-emit.test.ts (NEW) → analog functions/test/gdpr/gdprExportUser.test.ts (Phase 8 — mocks writeAuditEvent and asserts called once with correct shape).
</patterns_reference>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend functions/src/audit/auditEventSchema.ts enum with 15 bare data-domain literals + 18 .requested literals (33 new entries) + extend test fixture</name>
  <read_first>
    - functions/src/audit/auditEventSchema.ts (current 28-entry enum at lines 18-54)
    - .planning/phases/09-observability-audit-event-wiring/09-PATTERNS.md (section "functions/src/audit/auditEventSchema.ts (modify — extend enum)")
    - .planning/phases/09-observability-audit-event-wiring/09-RESEARCH.md §AUDIT-05 Wiring Inventory (lines 503-517)
    - functions/test/audit/auditEventSchema.test.ts IF IT EXISTS (else create new in this task)
  </read_first>
  <behavior>
    - Test 1: auditEventInput.parse({ type: "data.action.softDelete", target: {type:"action", id:"a1", orgId:"o1"}, clientReqId: <uuid> }) succeeds — bare flavour
    - Test 2: auditEventInput.parse({ type: "data.action.softDelete.requested", ... }) succeeds — .requested companion
    - Test 3: auditEventInput.parse({ type: "data.message.permanentlyDelete", ... }) succeeds — bare
    - Test 4: auditEventInput.parse({ type: "data.funnelComment.restore.requested", ... }) succeeds — .requested
    - Test 5: auditEventInput.parse({ type: "iam.claims.set.requested", ... }) succeeds
    - Test 6: auditEventInput.parse({ type: "compliance.erase.user.requested", ... }) succeeds
    - Test 7: auditEventInput.parse({ type: "auth.signin.failure", ... }) STILL succeeds (existing literal preserved)
    - Test 8: auditEventInput.parse({ type: "iam.claims.set", ... }) STILL succeeds (existing literal preserved)
    - Test 9: auditEventInput.parse({ type: "data.action.delete", ... }) FAILS (we did NOT add a bare `delete` for action — only for document/message/comment/user/org per Phase 7 baseline; action only has the new soft/restore/permanently variants). This pins the enum is exactly the intended shape, not over-broad.
    - Test 10: auditEventInput.parse({ type: "totally.bogus.event", ... }) fails with ZodError
  </behavior>
  <action>
    Step 1 — open functions/src/audit/auditEventSchema.ts and locate `auditEventType = z.enum([...])` (lines 18-54). Inside the enum array, after the last existing entry (`"data.document.delete.mirror"` at line 53), append a Phase 9 block:

    ```typescript
      // Phase 9 Wave 3 (AUDIT-05 / OBS-05): server-side bare flavours emitted
      // by the corresponding callables (lifecycle/* and setClaims) and by the
      // beforeUserSignedIn rejection branch (substrate; dormant until rejection
      // rules exist — see 09-03a-PLAN.md mfa_rationale + interfaces). Wave 4
      // anomaly rules read from THESE literals (`auth.signin.failure` already
      // existed; the data-domain bare flavours are NEW).
      "data.action.softDelete",
      "data.action.restore",
      "data.action.permanentlyDelete",
      "data.comment.softDelete",
      "data.comment.restore",
      "data.comment.permanentlyDelete",
      "data.document.softDelete",
      "data.document.restore",
      "data.document.permanentlyDelete",
      "data.message.softDelete",
      "data.message.restore",
      "data.message.permanentlyDelete",
      "data.funnelComment.softDelete",
      "data.funnelComment.restore",
      "data.funnelComment.permanentlyDelete",
      // Phase 9 Wave 3 (AUDIT-05): client-side .requested companion flavours.
      // Server emits the bare flavour (above + Phase 7 baseline auth.* / iam.* /
      // compliance.*); client emits the .requested suffix from the call-site
      // wrapper so the pair is observable for latency analysis (gap between
      // client request + server execution). Pitfall 17: actor.uid/email/role/
      // orgId is server-overlaid on auditWrite from request.auth.token —
      // payload never carries identity.
      "iam.claims.set.requested",
      "compliance.export.user.requested",
      "compliance.erase.user.requested",
      "data.action.softDelete.requested",
      "data.action.restore.requested",
      "data.action.permanentlyDelete.requested",
      "data.comment.softDelete.requested",
      "data.comment.restore.requested",
      "data.comment.permanentlyDelete.requested",
      "data.document.softDelete.requested",
      "data.document.restore.requested",
      "data.document.permanentlyDelete.requested",
      "data.message.softDelete.requested",
      "data.message.restore.requested",
      "data.message.permanentlyDelete.requested",
      "data.funnelComment.softDelete.requested",
      "data.funnelComment.restore.requested",
      "data.funnelComment.permanentlyDelete.requested",
    ```

    Total enum length after edit: existing 28 + 15 bare + 18 .requested = 61 entries.

    Step 2 — create or extend `functions/test/audit/auditEventSchema.test.ts`. If a Phase 7 schema test already exists, append the 10 behaviour tests. If not, create a new file with imports:
    ```typescript
    import { describe, it, expect } from "vitest";
    import { auditEventInput } from "../../src/audit/auditEventSchema.js";
    import { randomUUID } from "node:crypto";
    ```

    Implement all 10 behaviour tests above. Use `randomUUID()` for clientReqId. The 9th and 10th (negative) tests should `expect(() => auditEventInput.parse({...})).toThrow();`.

    Step 3 — Verify (cd functions; npm test -- --run test/audit/auditEventSchema.test.ts) passes.

    Step 4 — confirm pre-existing functions/ tests still pass (the auditWrite callable's own tests should ALL still pass — the enum widening is additive, not breaking).
  </action>
  <verify>
    <automated>cd functions; npm test -- --run test/audit/auditEventSchema.test.ts; npm test -- --run; cd ..</automated>
  </verify>
  <done>
    - `functions/src/audit/auditEventSchema.ts` enum has 61 entries (28 pre-existing + 15 bare + 18 .requested)
    - `grep -cE "^\s*\"data\.(action|comment|document|message|funnelComment)\.(softDelete|restore|permanentlyDelete)\"" functions/src/audit/auditEventSchema.ts` returns 15 (bare data-domain)
    - `grep -cE "\.requested\"" functions/src/audit/auditEventSchema.ts` returns 18 (.requested companions)
    - `functions/test/audit/auditEventSchema.test.ts` — 10 behaviour tests pass
    - `cd functions; npm test -- --run` exits 0 (full suite green)
    - `cd functions; npm run lint; npm run typecheck` exits 0
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire writeAuditEvent into setClaims + beforeUserSignedIn (server emissions for iam.claims.set + auth.signin.failure substrate)</name>
  <read_first>
    - functions/src/auth/setClaims.ts (current — admin-only callable; the emission goes AFTER getCustomUserClaims succeeds + AFTER the poke pattern, BEFORE the logger.info + return)
    - functions/src/auth/beforeUserSignedIn.ts (current 31 lines — observation-only; Phase 9 wraps the body in try/catch and emits on the catch branch as substrate)
    - functions/src/audit/auditLogger.ts (writeAuditEvent + ServerContext + AuditActor types)
    - functions/src/gdpr/gdprExportUser.ts:197 (analog — direct writeAuditEvent call from inside a callable; copy the ServerContext shape)
    - functions/src/gdpr/gdprEraseUser.ts:289 (same analog)
  </read_first>
  <behavior>
    - Test 1 (setClaims success path): valid admin invokes setClaims({uid:"u1",role:"admin",orgId:"o1",clientReqId:<uuid>}) → writeAuditEvent called ONCE with type "iam.claims.set", target {type:"user", id:"u1", orgId:"o1"}, payload {newRole:"admin", newOrgId:"o1"}. actor populated from request.auth.token (uid + email + role="admin" + orgId).
    - Test 2 (setClaims emit failure swallowed): writeAuditEvent throws ("audit substrate down") → setClaims STILL returns {ok:true}. Test by mocking writeAuditEvent to reject; assert setClaims fulfils + logger.warn called with "audit.emit.failed".
    - Test 3 (setClaims auth gate): non-admin caller → setClaims throws permission-denied BEFORE writeAuditEvent is even imported. Assert writeAuditEvent NOT called.
    - Test 4 (setClaims emit ordering): writeAuditEvent invoked AFTER getCustomUserClaims AND AFTER the poke write — assert mock invocation order via vi.mocked(...).mock.invocationCallOrder.
    - Test 5 (beforeUserSignedIn substrate): handler wraps body in try/catch; the catch branch emits writeAuditEvent({type:"auth.signin.failure", target:{type:"user", id:event.data?.uid||"unknown"}, payload:{reason:"<error.name>"}}) with actor={uid:null,email:event.data?.email,role:null,orgId:null}. Test by injecting a thrown error into the inner logger.info call; assert writeAuditEvent called with the expected shape.
    - Test 6 (beforeUserSignedIn happy path): handler completes without error → writeAuditEvent NOT called (no failure emission on success — sign-in success continues to be emitted by the client wrapper in Plan 03; the bare `auth.signin.success` flavour is NOT a Phase 9 substrate goal — only failure is, because failure is what feeds Wave 4 Rule 1).
  </behavior>
  <action>
    Step 1 — modify functions/src/auth/setClaims.ts. Add imports at top after the existing import block:
    ```typescript
    import { randomUUID } from "node:crypto";
    import { writeAuditEvent } from "../audit/auditLogger.js";
    ```

    Insert the audit emission AFTER the poke pattern (currently lines 73-75) and BEFORE the `logger.info("auth.claims.set", ...)` call (line 77). Use this exact block:

    ```typescript
        // Phase 9 Wave 3 (BLOCKER 2 / AUDIT-05): server-side bare emission of
        // iam.claims.set. Client wrapper (src/cloud/claims-admin.js — Plan 03)
        // emits the .requested companion. Pair makes latency observable.
        // Best-effort: log + swallow on emit failure — do NOT block the underlying
        // claim mutation (Pattern 5 #2).
        try {
          const token = (request.auth.token ?? {}) as Record<string, unknown>;
          await writeAuditEvent(
            {
              type: "iam.claims.set",
              target: { type: "user", id: data.uid, orgId },
              clientReqId: data.clientReqId,
              payload: { newRole: role, newOrgId: orgId },
            },
            {
              now: Date.now(),
              eventId: randomUUID(),
              ip: null,
              userAgent: null,
              actor: {
                uid: request.auth.uid,
                email: typeof token.email === "string" ? token.email : null,
                role:
                  token.role === "admin" ||
                  token.role === "internal" ||
                  token.role === "client" ||
                  token.role === "system"
                    ? token.role
                    : null,
                orgId: typeof token.orgId === "string" ? token.orgId : null,
              },
            },
          );
        } catch (auditErr) {
          logger.warn("audit.emit.failed", {
            type: "iam.claims.set",
            targetUid: data.uid,
            error: auditErr instanceof Error ? auditErr.message : String(auditErr),
          });
        }
    ```

    Append to the existing header banner (around line 18):
    ```typescript
    // Phase 9 Wave 3 (BLOCKER 2 fix): server-side `iam.claims.set` audit emission
    // landed AFTER the poke write. Wave 4 Rule 3 (role escalation alert) reads
    // from these rows — the dual-emit pair is satisfied here + at the client
    // wrapper (src/cloud/claims-admin.js — Plan 03 .requested companion).
    ```

    Step 2 — modify functions/src/auth/beforeUserSignedIn.ts. Wrap the existing logger.info body in try/catch + add the failure-branch audit emission. Replace lines 19-31 with:

    ```typescript
    export const beforeUserSignedInHandler = beforeUserSignedIn(
      { region: "europe-west2" },
      async (event) => {
        try {
          logger.info("auth.user.signin", {
            uid: event.data?.uid,
            email: event.data?.email,
            provider: event.data?.providerData?.[0]?.providerId,
            mfa: event.data?.multiFactor?.enrolledFactors?.length ?? 0,
          });
          // No mutation — observation-only per ARCHITECTURE.md §3 "Use sparingly"
          // + D-21 (Firestore-side auditLog/ deferred to Phase 7 → wired Phase 9).
        } catch (err) {
          // Phase 9 Wave 3 (BLOCKER 1 fix): emit auth.signin.failure on the
          // rejection branch. The handler currently never explicitly rejects —
          // this catch fires only on internal handler errors (logger throws,
          // event.data is malformed, etc.). Wave 4 Rule 1 (auth-fail burst >5/IP/
          // 5min) reads from these rows. The audit emit is the ONLY substrate
          // through which client-side wrong-password attempts can be counted —
          // the auditWrite callable rejects unauthenticated clients
          // (auditWrite.ts:51-53), so the client cannot emit failures itself.
          //
          // SUBSTRATE-HONEST: this handler does not currently REJECT sign-ins
          // (no business rules require it yet). The catch branch is here so a
          // future plan that adds rejection rules (e.g. block disabled
          // accounts at sign-in time) needs ZERO schema changes — just throw.
          // Rule 1 fires the moment any future code path inside this handler
          // throws, automatically.
          //
          // Best-effort: log + swallow if writeAuditEvent itself fails.
          try {
            await writeAuditEvent(
              {
                type: "auth.signin.failure",
                target: {
                  type: "user",
                  id: event.data?.uid ?? "unknown",
                  orgId: null,
                },
                clientReqId: randomUUID(),
                payload: {
                  reason: err instanceof Error ? err.name : "UnknownError",
                },
              },
              {
                now: Date.now(),
                eventId: randomUUID(),
                ip: event.ipAddress ?? null,
                userAgent: event.userAgent ?? null,
                actor: {
                  uid: null,
                  email: event.data?.email ?? null,
                  role: null,
                  orgId: null,
                },
              },
            );
          } catch (auditErr) {
            logger.warn("audit.emit.failed", {
              type: "auth.signin.failure",
              error: auditErr instanceof Error ? auditErr.message : String(auditErr),
            });
          }
          // Re-throw the original error — let the blocking-handler infrastructure
          // signal failure to the client. The audit emit fires regardless.
          throw err;
        }
      },
    );
    ```

    Add imports at the top:
    ```typescript
    import { randomUUID } from "node:crypto";
    import { writeAuditEvent } from "../audit/auditLogger.js";
    ```

    Append to the existing header banner (after line 14):
    ```typescript
    // Phase 9 Wave 3 (BLOCKER 1 fix): try/catch substrate around the observation
    // handler with auth.signin.failure emission on the catch branch. Substrate is
    // dormant until business rules add explicit rejections — Wave 4 Rule 1 fires
    // automatically once a rejection rule lands. See 09-03a-PLAN.md for rationale.
    ```

    Step 3 — create `functions/test/auth/setClaims-audit-emit.test.ts`. Use `vi.mock("../../src/audit/auditLogger.js", () => ({ writeAuditEvent: vi.fn() }))` and the standard setClaims test bootstrap (mirror the existing `functions/test/auth/setClaims.unit.test.ts` if it exists). Implement Tests 1-4. For ordering (Test 4): mock `getCustomUserClaims` and the `getFirestore().doc().set()` chain; assert `writeAuditEvent.mock.invocationCallOrder[0] > setCustomUserClaims.mock.invocationCallOrder[0]`.

    Step 4 — create `functions/test/auth/beforeUserSignedIn-audit-emit.test.ts`. Mock `writeAuditEvent` and `logger.info` (force throw). Implement Tests 5-6. For Test 5 (failure path), patch `logger.info` to throw on first call; the handler should re-throw the same error AND have called writeAuditEvent.

    Step 5 — verify both test files pass + full functions suite stays green.
  </action>
  <verify>
    <automated>cd functions; npm test -- --run test/auth/setClaims-audit-emit.test.ts test/auth/beforeUserSignedIn-audit-emit.test.ts; npm test -- --run; cd ..</automated>
  </verify>
  <done>
    - `functions/src/auth/setClaims.ts` imports writeAuditEvent + randomUUID; emits iam.claims.set after the poke write
    - `functions/src/auth/beforeUserSignedIn.ts` wraps body in try/catch + emits auth.signin.failure on catch branch + re-throws
    - `grep -c "writeAuditEvent" functions/src/auth/setClaims.ts` returns ≥ 1
    - `grep -c "writeAuditEvent" functions/src/auth/beforeUserSignedIn.ts` returns ≥ 1
    - `grep -c "iam.claims.set" functions/src/auth/setClaims.ts` returns ≥ 1
    - `grep -c "auth.signin.failure" functions/src/auth/beforeUserSignedIn.ts` returns ≥ 1
    - `functions/test/auth/setClaims-audit-emit.test.ts` — 4 tests pass
    - `functions/test/auth/beforeUserSignedIn-audit-emit.test.ts` — 2 tests pass
    - Pre-existing functions/ tests still pass (`cd functions; npm test -- --run` exits 0)
    - `cd functions; npm run lint; npm run typecheck` exits 0
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Wire writeAuditEvent into 3 lifecycle callables (softDelete + restoreSoftDeleted + permanentlyDeleteSoftDeleted)</name>
  <read_first>
    - functions/src/lifecycle/softDelete.ts (current — emit goes AFTER batch.commit() at line 82, BEFORE logger.info at line 84)
    - functions/src/lifecycle/restoreSoftDeleted.ts (current — emit goes AFTER batch.commit() at line 70, BEFORE logger.info at line 72)
    - functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts (current — emit goes AFTER ref.delete() at line 67, BEFORE logger.info at line 69)
    - functions/src/audit/auditLogger.ts (writeAuditEvent + ServerContext + AuditActor)
    - functions/src/gdpr/gdprExportUser.ts:197 (analog — same shape pattern)
  </read_first>
  <behavior>
    - Test 1 (softDelete success): valid admin invokes softDelete({type:"document",orgId:"o1",id:"d1",clientReqId:<uuid>}) → writeAuditEvent called ONCE with type "data.document.softDelete", target {type:"document", id:"d1", orgId:"o1"}, payload {}, actor.uid=request.auth.uid + role="admin" + orgId="o1"
    - Test 2 (softDelete emit failure swallowed): writeAuditEvent throws → softDelete STILL returns {ok:true}; logger.warn called with "audit.emit.failed"
    - Test 3 (softDelete emit ordering): writeAuditEvent invoked AFTER batch.commit() — assert order via vi.mocked invocationCallOrder
    - Test 4 (restoreSoftDeleted success): emits "data.<type>.restore" with same shape
    - Test 5 (permanentlyDeleteSoftDeleted success): emits "data.<type>.permanentlyDelete"; target.orgId is null (callable input has no orgId field)
    - Test 6 (permanentlyDeleteSoftDeleted not-found early return): if doc doesn't exist, throws not-found; writeAuditEvent NOT called (no audit row for never-happened ops)
  </behavior>
  <action>
    Step 1 — modify functions/src/lifecycle/softDelete.ts. Add imports at top:
    ```typescript
    import { randomUUID } from "node:crypto";
    import { writeAuditEvent } from "../audit/auditLogger.js";
    ```

    Insert the audit emission AFTER `await batch.commit();` (line 82) and BEFORE `logger.info("lifecycle.softDelete", ...)` (line 84):

    ```typescript
        // Phase 9 Wave 3 (BLOCKER 3 / AUDIT-05): server-side bare emission of
        // data.<type>.softDelete. Client wrapper (src/cloud/soft-delete.js —
        // Plan 03) emits the .requested companion.
        // Best-effort: log + swallow on emit failure — do NOT block the underlying
        // soft-delete (Pattern 5 #2). The Firestore batch already committed; we
        // can't roll back the data mutation just because the audit emit fails.
        try {
          const token = (request.auth.token ?? {}) as Record<string, unknown>;
          await writeAuditEvent(
            {
              type: `data.${data.type}.softDelete` as
                | "data.action.softDelete"
                | "data.comment.softDelete"
                | "data.document.softDelete"
                | "data.message.softDelete"
                | "data.funnelComment.softDelete",
              target: { type: data.type, id: data.id, orgId: data.orgId },
              clientReqId: data.clientReqId,
              payload: {},
            },
            {
              now: Date.now(),
              eventId: randomUUID(),
              ip: null,
              userAgent: null,
              actor: {
                uid: request.auth.uid,
                email: typeof token.email === "string" ? token.email : null,
                role:
                  token.role === "admin" ||
                  token.role === "internal" ||
                  token.role === "client" ||
                  token.role === "system"
                    ? token.role
                    : null,
                orgId: typeof token.orgId === "string" ? token.orgId : null,
              },
            },
          );
        } catch (auditErr) {
          logger.warn("audit.emit.failed", {
            type: `data.${data.type}.softDelete`,
            id: data.id,
            error: auditErr instanceof Error ? auditErr.message : String(auditErr),
          });
        }
    ```

    Append to the existing header banner (after line 12):
    ```typescript
    // Phase 9 Wave 3 (BLOCKER 3 fix): server-side `data.<type>.softDelete` audit
    // emission landed AFTER the batch commit. Wave 4 Rule 3 + AUDIT-05 mirror-
    // trigger collision dedup (Pitfall 7) read from these rows. The dual-emit
    // pair is satisfied here + at the client wrapper (src/cloud/soft-delete.js).
    ```

    Step 2 — modify functions/src/lifecycle/restoreSoftDeleted.ts. Same pattern, but with `data.${data.type}.restore` and the union literal narrowed to the 5 restore variants.

    Insert AFTER `await batch.commit();` (line 70) — same structure as Step 1.

    Step 3 — modify functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts. Same pattern, but:
    - Type literal: `data.${data.type}.permanentlyDelete`
    - target.orgId: `null` (callable input has no orgId field; resource is in `softDeleted/{type}/items/{id}` — admin-scoped, no orgId)
    - Insert AFTER `await ref.delete();` (line 67)

    Step 4 — create three test files:
    - `functions/test/lifecycle/softDelete-audit-emit.test.ts` — Tests 1, 2, 3 from behaviour list
    - `functions/test/lifecycle/restoreSoftDeleted-audit-emit.test.ts` — Test 4 + best-effort swallow + ordering (3 tests total)
    - `functions/test/lifecycle/permanentlyDeleteSoftDeleted-audit-emit.test.ts` — Tests 5, 6 + best-effort swallow (3 tests total)

    Each file mocks `writeAuditEvent` and the Firestore batch chain. Follow the structure of any existing functions/test/lifecycle/*.test.ts (Phase 8 baseline).

    Step 5 — verify all three test files pass + full functions suite stays green.
  </action>
  <verify>
    <automated>cd functions; npm test -- --run test/lifecycle/softDelete-audit-emit.test.ts test/lifecycle/restoreSoftDeleted-audit-emit.test.ts test/lifecycle/permanentlyDeleteSoftDeleted-audit-emit.test.ts; npm test -- --run; cd ..</automated>
  </verify>
  <done>
    - All 3 lifecycle/* files import writeAuditEvent + randomUUID
    - `grep -c "writeAuditEvent" functions/src/lifecycle/softDelete.ts functions/src/lifecycle/restoreSoftDeleted.ts functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts` returns ≥ 3
    - softDelete emits `data.<type>.softDelete`; restoreSoftDeleted emits `data.<type>.restore`; permanentlyDeleteSoftDeleted emits `data.<type>.permanentlyDelete`
    - 3 new test files pass — at least 9 tests across the three files (Tests 1-6 + best-effort swallow + ordering for each)
    - Pre-existing functions/ tests still pass (`cd functions; npm test -- --run` exits 0)
    - `cd functions; npm run lint; npm run typecheck` exits 0
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Cloud Function (Admin SDK) ↔ auditLog/{eventId} Firestore collection | Direct Admin SDK write via `writeAuditEvent` from inside a callable; bypasses the auditWrite callable's authentication gate. firestore.rules `allow write: if false` denies all client writes — only Admin SDK writes reach the collection. |
| beforeUserSignedIn (blocking trigger) ↔ auditLog | Trigger runs in a server-side context with no client identity; emits `auth.signin.failure` with actor.uid:null + actor.email from event.data |
| setClaims callable ↔ auditLog | Invoked by admin caller; actor identity from request.auth.token (Pitfall 17 — never from payload); emits server-side `iam.claims.set` |
| lifecycle/* callables ↔ auditLog | Invoked by admin caller; actor identity from request.auth.token; emits `data.<type>.<op>` AFTER the batch commit |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-9-03a-1 | T (Tampering) | Server-side audit row written directly via Admin SDK could include forged target.id | mitigate | `target.id` comes from validated input (Zod-parsed `data.id`); the schema bounds id length and rejects empty strings. The actor is server-set from `request.auth.token` — Pitfall 17 invariant preserved. |
| T-9-03a-2 | I (Information disclosure) | beforeUserSignedIn emits actor.email even though caller is unauthenticated | accept | event.data.email is the email submitted to the failed sign-in attempt — known to the server and required to attribute the failure to a user. The Sentry beforeSend PII scrubber (Wave 1) does NOT scrub auditLog rows because they're internal server state, not Sentry events. Audit-log access is rules-denied for all clients (firestore.rules `auditLog/{eventId} { allow read: if false }`). Slack alert text (Wave 4 Rule 1) does NOT include the email — only the ipHash. |
| T-9-03a-3 | D (Denial of service) | writeAuditEvent failure cascading into the underlying op failure | mitigate | Every emission wrapped in try/catch — log via logger.warn and continue. The underlying op (claim mutation, soft-delete, restore, permanentlyDelete) commits BEFORE the emit; if the emit fails, the data state is already correct. (Pattern 5 #2 — never block on audit failure.) |
| T-9-03a-4 | T (Tampering) | beforeUserSignedIn substrate fires on internal handler errors (logger throw) → false-positive auth.signin.failure rows | accept | The substrate is intentionally broad — better to over-emit failures (false positives are visible and explainable in operator review) than to under-emit (silent failure, missed attacks). Internal handler errors are rare; an alert spike on this signal correctly indicates a server-side problem worth investigation. |
| T-9-03a-5 | E (Elevation of privilege) | Admin SDK write to auditLog/{eventId} from inside a non-admin callable (lifecycle ones require admin role; beforeUserSignedIn runs as system) | mitigate | All four sites verified: setClaims requires `token.role === "admin"`, lifecycle/* require `token.role === "admin"`, beforeUserSignedIn is a server-trust context (no caller). The Admin SDK write is the only path; client cannot bypass. |
| T-9-03a-6 | I (Information disclosure) | Audit-emit failure logger.warn call leaks targetUid in plaintext | accept | targetUid is non-PII (Firebase UID is an opaque identifier). No email/role/orgId in the warn payload (intentionally — `error: auditErr.message` only). Sentry beforeSend (Wave 1) scrubs anything else. |
</threat_model>

<verification>
- `cd functions; npm test -- --run; cd ..` exits 0 (full functions suite green; +10 tests across the 6 new test files)
- `cd functions; npm run lint; npm run typecheck; cd ..` exits 0
- `grep -c "writeAuditEvent" functions/src/auth/*.ts functions/src/lifecycle/*.ts` returns ≥ 5 (setClaims + beforeUserSignedIn + 3 lifecycle/*)
- `grep -cE "^\s*\"data\.(action|comment|document|message|funnelComment)\.(softDelete|restore|permanentlyDelete)\"" functions/src/audit/auditEventSchema.ts` returns 15
- `grep -cE "\.requested\"" functions/src/audit/auditEventSchema.ts` returns 18
- `grep -c "auth.signin.failure" functions/src/auth/beforeUserSignedIn.ts` returns ≥ 1
- `grep -c "iam.claims.set" functions/src/auth/setClaims.ts` returns ≥ 1
</verification>

<success_criteria>
- AUDIT-05 substrate: server-side bare audit emissions exist for all sites Plan 03 originally claimed dual-emit for. Wave 4 anomaly rules can now actually fire.
- BLOCKER 1 (auth.signin.failure unfireable): substrate landed in beforeUserSignedIn — Wave 4 Rule 1 trigger code is functional + dormant until a rejection rule lands (documented as DORMANT, not BROKEN).
- BLOCKER 2 (iam.claims.set unfireable): server-side emission added to setClaims callable. Wave 4 Rule 3 (role escalation) trigger code now sees real rows.
- BLOCKER 3 (lifecycle/* unfireable): 3 lifecycle callables emit bare flavours after batch commit. AUDIT-05 mirror-trigger Pitfall 7 dedup is now real.
- Schema: 33 new enum literals (15 bare + 18 .requested) — atomic edit; Plan 03 task 1 is reduced to a no-op verifier (just confirms the literals exist).
- Pitfall 17 invariant preserved: every emit reads actor from request.auth.token (or actor=null/system for the unauthenticated beforeUserSignedIn path); zero PII in payload fields.
- Best-effort emission: every emit wrapped in try/catch; underlying ops never fail because of audit-emit failures.
</success_criteria>

<output>
After completion, create `.planning/phases/09-observability-audit-event-wiring/09-03a-SUMMARY.md` describing:
- Final enum count (28 + 33 = 61)
- Per-file emit-site count: setClaims (1 emit), beforeUserSignedIn (1 emit substrate, dormant), lifecycle/* (3 emits — softDelete + restore + permanentlyDelete)
- Test counts: auditEventSchema.test.ts (10 tests), setClaims-audit-emit.test.ts (4 tests), beforeUserSignedIn-audit-emit.test.ts (2 tests), softDelete-audit-emit.test.ts (3 tests), restoreSoftDeleted-audit-emit.test.ts (3 tests), permanentlyDeleteSoftDeleted-audit-emit.test.ts (3 tests) — 25 total tests
- DORMANT substrates documented:
  - beforeUserSignedIn try/catch — fires only on internal handler errors today; future business rules (e.g. block disabled accounts) will populate the channel naturally
  - MFA enrol/un-enrol audit emission — bound to `enrollTotp`/`unenrollAllMfa` deps in src/main.js (currently `// deferred to user-testing phase`)
- Forward-tracking ledger row added: "MFA emit-site wiring DEFERRED — bound to dep landing in src/main.js" (closes via Plan 06 Task 2 cleanup ledger)
- Next plan: 09-03 (client-side .requested wiring; enum extension is now a verify-only step there)
</output>
</content>
</invoke>