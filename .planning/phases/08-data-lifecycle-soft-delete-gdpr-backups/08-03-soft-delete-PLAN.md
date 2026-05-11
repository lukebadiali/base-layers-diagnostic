---
phase: 08
plan: 03
type: execute
wave: 3
depends_on:
  - 08-02
files_modified:
  - functions/src/lifecycle/softDelete.ts
  - functions/src/lifecycle/restoreSoftDeleted.ts
  - functions/src/lifecycle/scheduledPurge.ts
  - functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts
  - functions/src/lifecycle/resolveDocRef.ts
  - functions/src/index.ts
  - functions/test/lifecycle/softDelete.unit.test.ts
  - functions/test/lifecycle/restoreSoftDeleted.unit.test.ts
  - functions/test/lifecycle/scheduledPurge.unit.test.ts
  - functions/test/lifecycle/permanentlyDeleteSoftDeleted.unit.test.ts
  - functions/test/lifecycle/resolveDocRef.unit.test.ts
  - functions/test/integration/softDelete.integration.test.ts
  - functions/test/integration/restoreSoftDeleted.integration.test.ts
  - functions/test/integration/permanentlyDeleteSoftDeleted.integration.test.ts
  - firestore.rules
  - tests/rules/soft-delete-predicate.test.js
  - src/cloud/soft-delete.js
  - src/data/soft-deleted.js
  - src/data/messages.js
  - src/data/comments.js
  - src/data/documents.js
  - src/data/funnel-comments.js
  - src/data/actions.js
  - src/views/admin.js
  - src/main.js
autonomous: true
requirements:
  - LIFE-01
  - LIFE-02
  - LIFE-03
  - LIFE-04
  - LIFE-05
  - LIFE-06
  - DOC-10
must_haves:
  truths:
    - "Admin can call softDelete({type, orgId, id}) which writes deletedAt + deletedBy to the live doc AND copies the full document to softDeleted/{type}/items/{id} in a single Firestore batch"
    - "Admin can call restoreSoftDeleted({type, orgId, id}) which reverses the soft-delete: live doc has deletedAt cleared; softDeleted/{type}/items/{id} is removed; both in a single batch"
    - "scheduledPurge runs daily at 03:00 UTC and hard-deletes softDeleted/{type}/items/{id} entries where deletedAt < now-30days; pagination via 500-doc limit + startAfter loop (Pitfall B)"
    - "firestore.rules adds notDeleted(resource.data) to read predicates on every soft-deletable subcollection (messages, comments, actions, documents) AND for funnelComments top-level collection"
    - "Every src/data/*.js subscribe* / list* function on a soft-deletable collection adds .where('deletedAt', '==', null) so client list queries succeed under the rules predicate (Pitfall A)"
    - "src/cloud/soft-delete.js body fills with httpsCallable('softDelete') + httpsCallable('restoreSoftDeleted') wrappers"
    - "src/views/admin.js renders a 'Recently Deleted' section that LOADS the soft-deleted items via the new src/data/soft-deleted.js#listSoftDeleted helper (admin-only read of softDeleted/{type}/items/* gated by existing firestore.rules) and renders Restore + Permanently delete now buttons; the Permanently delete button calls the new permanentlyDeleteSoftDeleted callable (LIFE-06 functional, NOT 'unavailable')"
    - "src/data/soft-deleted.js exposes listSoftDeleted() returning Array<{ type, orgId, id, snapshot, deletedAt }> by reading getDocs(collection(db, 'softDeleted/{type}/items')) for each of the 5 types and merging the results"
    - "functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts is a Pattern A admin-only callable that hard-deletes ONE softDeleted/{type}/items/{id} record on demand (same logic that scheduledPurge runs in batch); pinned by unit + integration tests"
    - "src/main.js getDownloadURL call site at line ~3359 is replaced with await import('./cloud/signed-url.js').then(m => m.getDocumentSignedUrl(orgId, docId, filename)); src/data/documents.js getDownloadURL import is dropped"
  artifacts:
    - path: "functions/src/lifecycle/softDelete.ts"
      provides: "Admin-only callable: tombstone live doc + snapshot to softDeleted/"
      contains: "FieldValue.serverTimestamp"
    - path: "functions/src/lifecycle/restoreSoftDeleted.ts"
      provides: "Admin-only callable: reverse soft-delete via batch"
      contains: "softDeleted"
    - path: "functions/src/lifecycle/scheduledPurge.ts"
      provides: "Daily onSchedule (03:00 UTC) — paginated hard-delete past 30d"
      contains: "startAfter"
    - path: "functions/src/lifecycle/resolveDocRef.ts"
      provides: "Pure helper: maps {type, orgId, id} → DocumentReference path"
      contains: "export function resolveDocPath"
    - path: "src/cloud/soft-delete.js"
      provides: "Browser seam: softDelete + restoreSoftDeleted httpsCallable wrappers"
      contains: "httpsCallable"
    - path: "src/views/admin.js"
      provides: "LIFE-06 functional: Recently Deleted table + Restore + Permanently delete now buttons; depends_on listSoftDeleted + permanentlyDeleteSoftDeleted"
      min_lines: 80
    - path: "src/data/soft-deleted.js"
      provides: "Browser data wrapper: listSoftDeleted() across all 5 SOFT_DELETABLE_TYPES — admin-only via existing rules"
      contains: "softDeleted"
    - path: "functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts"
      provides: "Admin-only callable: hard-delete ONE softDeleted record on demand (Permanently delete now button)"
      contains: "softDeleted"
  key_links:
    - from: "functions/src/lifecycle/softDelete.ts"
      to: "softDeleted/{type}/items/{id} + live doc tombstone"
      via: "Admin SDK batch.update + batch.set"
      pattern: "batch.commit"
    - from: "firestore.rules"
      to: "messages/comments/actions/documents/funnelComments read paths"
      via: "notDeleted(resource.data) conjunct on `allow read`"
      pattern: "notDeleted"
    - from: "src/data/messages.js / comments.js / etc."
      to: "Firestore list queries"
      via: ".where('deletedAt', '==', null) conjunct"
      pattern: "where(\"deletedAt\""
    - from: "src/views/admin.js"
      to: "src/cloud/soft-delete.js + src/data/soft-deleted.js"
      via: "createAdminView({ softDelete, restoreSoftDeleted, permanentlyDeleteSoftDeleted, listSoftDeleted })"
      pattern: "restoreSoftDeleted"
    - from: "src/data/soft-deleted.js#listSoftDeleted"
      to: "softDeleted/{type}/items/* (Firestore)"
      via: "getDocs(collection(db, 'softDeleted', type, 'items')) iterated across SOFT_DELETABLE_TYPES"
      pattern: "softDeleted"
    - from: "src/views/admin.js Permanently delete button"
      to: "functions/src/lifecycle/permanentlyDeleteSoftDeleted callable"
      via: "httpsCallable('permanentlyDeleteSoftDeleted')"
      pattern: "permanentlyDeleteSoftDeleted"
    - from: "src/main.js (line ~3359 getDownloadURL site)"
      to: "src/cloud/signed-url.js"
      via: "dynamic import + getDocumentSignedUrl(orgId, docId, filename)"
      pattern: "getDocumentSignedUrl"
---

<objective>
Land the entire soft-delete lifecycle in one coordinated wave: 3 Cloud Functions (softDelete callable + restoreSoftDeleted callable + scheduledPurge), Firestore rules predicate update for 5 collection paths, the corresponding `where("deletedAt", "==", null)` client query conjuncts in 5 data wrappers, the LIFE-06 minimal admin UI, and the deferred `getDownloadURL` → `getDocumentSignedUrl` sweep across documents.js + main.js.

Purpose: LIFE-01..06 are all server-mediated — deletes must be reversible for 30 days. The Pitfall A trap (rules are not query filters) means the rules update + the client query update MUST land together, otherwise list queries fail with `permission-denied` immediately after deploy. This is why all five concerns ship in one plan: they fail or succeed together.

Output: 4 new functions + 1 helper + index.ts wiring + 5 test files + 5 data wrapper edits + rules update + rules-test cells + admin UI fill + getDownloadURL sweep.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/phases/08-data-lifecycle-soft-delete-gdpr-backups/08-RESEARCH.md
@.planning/research/PITFALLS.md
@firestore.rules
@functions/src/audit/auditWrite.ts
@functions/src/auth/setClaims.ts
@functions/src/util/idempotency.ts
@functions/test/_mocks/admin-sdk.ts
@functions/test/integration/auditWrite.integration.test.ts
@src/cloud/soft-delete.js
@src/data/messages.js
@src/data/comments.js
@src/data/documents.js
@src/data/funnel-comments.js
@src/data/actions.js
@src/views/admin.js
@src/cloud/signed-url.js
@tests/rules/soft-delete-predicate.test.js
@tests/rules/setup.js

<interfaces>
<!-- Existing notDeleted predicate in firestore.rules — use AS-IS, don't redefine. -->

From firestore.rules (Phase 5 artifact, lines 17-19):
- function notDeleted(r) { return !("deletedAt" in r) || r.deletedAt == null; }
- This predicate is already in scope at the top-level service block; reachable from every match block

From firestore.rules (Phase 5 line 47 — orgs/{orgId} parent already uses notDeleted):
- match /orgs/{orgId} { allow read: if inOrg(orgId) && notDeleted(resource.data); ... }

Wave 2 ADDS notDeleted(resource.data) to read predicates on these 5 paths (currently they have `allow read: if inOrg(orgId)` only):
- /orgs/{orgId}/messages/{msgId}
- /orgs/{orgId}/comments/{cmtId}    (preserve internalOnly conjunct)
- /orgs/{orgId}/actions/{actId}
- /orgs/{orgId}/documents/{docId}
- /funnelComments/{id}              (top-level — uses inOrg(resource.data.orgId))

Existing data-wrapper API (preserve verbatim signatures — Phase 5 D-11 contract):
- src/data/messages.js → listMessages(orgId), addMessage(orgId, message), subscribeMessages(orgId, {onChange, onError})
- src/data/comments.js → listComments(orgId, pillarId), addComment(orgId, pillarId, comment), deleteComment(orgId, pillarId, cmtId)
- src/data/documents.js → listDocuments(orgId), saveDocument(orgId, file, sanitisedName, meta), deleteDocument(orgId, docId)
- src/data/actions.js → listActions(orgId), saveAction(orgId, action), deleteAction(orgId, actionId)
- src/data/funnel-comments.js → listFunnelComments(orgId), addFunnelComment(orgId, comment), deleteFunnelComment(commentId), subscribeFunnelComments(orgId, {onChange, onError})

Existing src/cloud/soft-delete.js stub (Phase 4 — body to fill in this plan):
```javascript
export async function softDelete(_input) { /* Phase 8 body lands here */ }
export async function restoreSoftDeleted(_input) { /* Phase 8 body lands here */ }
```

Existing src/views/admin.js stub (Phase 4 Wave 4 — Pattern D DI factory):
- export function createAdminView(deps) { ... }
- export function renderAdmin(user) { ... }
- Add Recently Deleted section to the createAdminView output

5 supported soft-delete types per LIFE-01: "org" | "comment" | "document" | "message" | "funnelComment"
- Path map (resolveDocPath helper):
  - org           → orgs/{id}                  (orgId param ignored — id IS the orgId)
  - comment       → orgs/{orgId}/comments/{id}
  - document      → orgs/{orgId}/documents/{id}
  - message       → orgs/{orgId}/messages/{id}
  - funnelComment → funnelComments/{id}        (orgId required for caller authz check; path is flat)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Author functions/src/lifecycle/resolveDocRef.ts (pure helper) + softDelete callable + restoreSoftDeleted callable</name>
  <read_first>
    - functions/src/audit/auditWrite.ts (Pattern A callable shape — verbatim mirror)
    - functions/src/auth/setClaims.ts (admin role-gate pattern)
    - 08-RESEARCH.md §Pattern 6 (softDelete code listing — adapt with explicit type→path map)
    - 08-RESEARCH.md §Architectural Responsibility Map (server-mediated soft-delete row)
  </read_first>
  <behavior>
    - resolveDocPath unit tests:
      - resolveDocPath({type:"org", orgId:"orgA", id:"orgA"}) === "orgs/orgA"
      - resolveDocPath({type:"comment", orgId:"orgA", id:"c_xyz"}) === "orgs/orgA/comments/c_xyz"
      - resolveDocPath({type:"document", orgId:"orgA", id:"d_xyz"}) === "orgs/orgA/documents/d_xyz"
      - resolveDocPath({type:"message", orgId:"orgA", id:"m_xyz"}) === "orgs/orgA/messages/m_xyz"
      - resolveDocPath({type:"funnelComment", orgId:"orgA", id:"fc_xyz"}) === "funnelComments/fc_xyz"
      - resolveDocPath({type:"unknown", orgId:"orgA", id:"x"}) → throws RangeError
    - softDelete callable:
      - non-admin caller (token.role !== "admin") → HttpsError("permission-denied")
      - unauthenticated → HttpsError("unauthenticated")
      - invalid input (missing target.type) → HttpsError("invalid-argument")
      - happy path: live doc has deletedAt + deletedBy fields written; softDeleted/{type}/items/{id} contains the full original doc data + deletedAt + deletedBy + originalPath
      - already-deleted doc (deletedAt != null) → HttpsError("failed-precondition", "Already deleted")
      - non-existent doc → HttpsError("not-found")
    - restoreSoftDeleted callable:
      - non-admin → HttpsError("permission-denied")
      - happy path: live doc has deletedAt set to null; softDeleted/{type}/items/{id} doc is deleted
      - non-existent in softDeleted → HttpsError("not-found")
  </behavior>
  <files>functions/src/lifecycle/resolveDocRef.ts, functions/src/lifecycle/softDelete.ts, functions/src/lifecycle/restoreSoftDeleted.ts, functions/test/lifecycle/resolveDocRef.unit.test.ts, functions/test/lifecycle/softDelete.unit.test.ts, functions/test/lifecycle/restoreSoftDeleted.unit.test.ts</files>
  <action>
    1. **`functions/src/lifecycle/resolveDocRef.ts`** — pure helper, no firebase-admin import:
       ```typescript
       // Phase 8 Wave 2 (LIFE-01 / Pattern C purity): pure helper that maps a
       // {type, orgId, id} input to its Firestore document path. Used by
       // softDelete + restoreSoftDeleted + scheduledPurge + gdprEraseUser
       // (Wave 4) so the path-map is single-source-of-truth.

       export type SoftDeletableType = "org" | "comment" | "document" | "message" | "funnelComment";
       export const SOFT_DELETABLE_TYPES: readonly SoftDeletableType[] = [
         "org", "comment", "document", "message", "funnelComment",
       ] as const;

       export function resolveDocPath(input: { type: SoftDeletableType; orgId: string; id: string }): string {
         switch (input.type) {
           case "org": return `orgs/${input.id}`;
           case "comment": return `orgs/${input.orgId}/comments/${input.id}`;
           case "document": return `orgs/${input.orgId}/documents/${input.id}`;
           case "message": return `orgs/${input.orgId}/messages/${input.id}`;
           case "funnelComment": return `funnelComments/${input.id}`;
           default: {
             const _exhaustive: never = input.type;
             throw new RangeError(`Unknown type: ${_exhaustive}`);
           }
         }
       }

       export function resolveSnapshotPath(input: { type: SoftDeletableType; id: string }): string {
         return `softDeleted/${input.type}/items/${input.id}`;
       }
       ```

    2. **`functions/src/lifecycle/softDelete.ts`** — Pattern A callable. Mirror auditWrite.ts header style. Module-level: `if (!getApps().length) initializeApp(); const SENTRY_DSN = defineSecret("SENTRY_DSN")`.

       Zod input:
       ```typescript
       const SoftDeleteInput = z.object({
         type: z.enum(SOFT_DELETABLE_TYPES),
         orgId: z.string().min(1).max(128),
         id: z.string().min(1).max(128),
         clientReqId: z.string().uuid(),
       });
       ```

       onCall config: `region:"europe-west2", enforceAppCheck:true, serviceAccount:"lifecycle-sa", secrets:[SENTRY_DSN], memory:"256MiB", timeoutSeconds:30`.

       Handler (Pattern A + admin check + Pitfall 17 actor read):
       ```typescript
       withSentry(async (request) => {
         if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
         const token = (request.auth.token ?? {}) as Record<string, unknown>;
         if (token.role !== "admin") throw new HttpsError("permission-denied", "admin role required");

         const data = validateInput(SoftDeleteInput, request.data ?? {});
         await ensureIdempotent(`softDelete:${request.auth.uid}:${data.type}:${data.id}:${data.clientReqId}`, "softDelete", 5 * 60);

         const db = getFirestore();
         const liveRef = db.doc(resolveDocPath({ type: data.type, orgId: data.orgId, id: data.id }));
         const liveSnap = await liveRef.get();
         if (!liveSnap.exists) throw new HttpsError("not-found", "Document not found");
         const cur = liveSnap.data() ?? {};
         if (cur.deletedAt != null) throw new HttpsError("failed-precondition", "Already deleted");

         const snapRef = db.doc(resolveSnapshotPath({ type: data.type, id: data.id }));
         const batch = db.batch();
         batch.update(liveRef, {
           deletedAt: FieldValue.serverTimestamp(),
           deletedBy: request.auth.uid,
         });
         batch.set(snapRef, {
           ...cur,
           deletedAt: FieldValue.serverTimestamp(),
           deletedBy: request.auth.uid,
           originalPath: liveRef.path,
           originalType: data.type,
           originalOrgId: data.orgId,
         });
         await batch.commit();

         logger.info("lifecycle.softDelete", {
           type: data.type, orgId: data.orgId, id: data.id, actorUid: request.auth.uid,
         });
         return { ok: true };
       })
       ```

    3. **`functions/src/lifecycle/restoreSoftDeleted.ts`** — same Pattern A skeleton. Zod input is the same shape (type/orgId/id/clientReqId). Handler:
       ```typescript
       const snapRef = db.doc(resolveSnapshotPath({ type: data.type, id: data.id }));
       const snap = await snapRef.get();
       if (!snap.exists) throw new HttpsError("not-found", "Soft-deleted record not found");
       const liveRef = db.doc(resolveDocPath({ type: data.type, orgId: data.orgId, id: data.id }));
       const batch = db.batch();
       batch.update(liveRef, { deletedAt: null, deletedBy: null, restoredAt: FieldValue.serverTimestamp(), restoredBy: request.auth.uid });
       batch.delete(snapRef);
       await batch.commit();
       logger.info("lifecycle.restoreSoftDeleted", { type: data.type, orgId: data.orgId, id: data.id, actorUid: request.auth.uid });
       return { ok: true };
       ```

    4. **3 unit test files**:
       - `functions/test/lifecycle/resolveDocRef.unit.test.ts` — 6 tests covering the resolveDocPath cases above + 1 test for resolveSnapshotPath shape `softDeleted/<type>/items/<id>`
       - `functions/test/lifecycle/softDelete.unit.test.ts` — 6 tests (the 6 behaviours above) using the Pattern from `auditWrite.integration.test.ts` with vi.mock factories for firebase-admin/app + firebase-admin/firestore + firebase-functions/params + firebase-functions/logger. Use `adminMockState._seedDoc()` to seed live docs and `adminMockState._readDoc()` to assert post-state.
       - `functions/test/lifecycle/restoreSoftDeleted.unit.test.ts` — 4 tests (admin-only deny, unauth deny, happy path round-trip, not-found-in-snapshot deny). Pre-seed both live and softDeleted/ docs in `beforeEach` to set up the round-trip.

    All callables registered in functions/src/index.ts in Task 5.
  </action>
  <verify>
    <automated>cd functions && npm test -- lifecycle 2>&1 | tail -25</automated>
  </verify>
  <done>
    - 3 source files exist under `functions/src/lifecycle/`
    - 3 test files exist under `functions/test/lifecycle/`; ≥ 16 tests total across them; all pass
    - softDelete + restoreSoftDeleted both call `request.auth.token.role !== "admin"` to gate
    - softDelete callable header banner cites LIFE-01/02/04 + Pattern A + Pitfall 17
    - `cd functions && npm test` exits 0
    - `cd functions && npm run typecheck` exits 0
    - `cd functions && npm run build` exits 0
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Author functions/src/lifecycle/scheduledPurge.ts with paginated 500-doc batches (LIFE-05)</name>
  <read_first>
    - 08-RESEARCH.md §Pattern 7 (scheduledPurge code with pagination — verbatim adaptation)
    - 08-RESEARCH.md §Common Pitfalls B (single getDocs without pagination = timeout)
    - functions/src/lifecycle/resolveDocRef.ts (just authored — for SOFT_DELETABLE_TYPES iteration)
  </read_first>
  <behavior>
    - Test 1 (unit): given 3 softDeleted/comment/items/* docs with deletedAt 31 days ago + 1 with deletedAt 5 days ago, after invocation the 3 old docs are gone and the 1 fresh doc remains
    - Test 2 (unit): pagination — given 1200 softDeleted/message/items/* docs all 31 days old, the function deletes all 1200 (verifies the startAfter loop, not just first 500)
    - Test 3 (unit): empty softDeleted collections → no-op, no error
    - Test 4 (unit): iterates all 5 SOFT_DELETABLE_TYPES; given 1 stale doc per type, all 5 deleted
    - Test 5 (unit): logs `lifecycle.purge.completed` with `purgedByType` map showing per-type counts
  </behavior>
  <files>functions/src/lifecycle/scheduledPurge.ts, functions/test/lifecycle/scheduledPurge.unit.test.ts</files>
  <action>
    Create `functions/src/lifecycle/scheduledPurge.ts` per 08-RESEARCH.md §Pattern 7 (verbatim with these specifications):

    ```typescript
    // Phase 8 Wave 2 (LIFE-05 / Pitfall B): daily scheduled purge of soft-deleted
    // docs past the 30-day retention window. Pagination is mandatory — single
    // getDocs() over a large softDeleted collection exceeds the 9min Function
    // timeout (Pitfall B). Per-type loop with 500-doc batched startAfter pages.

    import { onSchedule } from "firebase-functions/v2/scheduler";
    import { logger } from "firebase-functions/logger";
    import { initializeApp, getApps } from "firebase-admin/app";
    import { getFirestore, type QueryDocumentSnapshot } from "firebase-admin/firestore";
    import { SOFT_DELETABLE_TYPES } from "./resolveDocRef.js";

    if (!getApps().length) initializeApp();

    const RETENTION_DAYS = 30;
    const PAGE_SIZE = 500;

    export const scheduledPurge = onSchedule(
      {
        schedule: "0 3 * * *",       // 03:00 UTC daily — 1h after the 02:00 export
        timeZone: "UTC",
        region: "europe-west2",
        timeoutSeconds: 540,
        memory: "512MiB",
        retryConfig: { retryCount: 1 },
        serviceAccount: "lifecycle-sa",
      },
      async (_event) => {
        const db = getFirestore();
        const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const purgedByType: Record<string, number> = {};

        for (const type of SOFT_DELETABLE_TYPES) {
          let count = 0;
          let lastDoc: QueryDocumentSnapshot | undefined = undefined;
          while (true) {
            let q = db.collection(`softDeleted/${type}/items`)
              .where("deletedAt", "<", cutoff)
              .orderBy("deletedAt")
              .limit(PAGE_SIZE);
            if (lastDoc) q = q.startAfter(lastDoc);
            const snap = await q.get();
            if (snap.empty) break;
            const batch = db.batch();
            for (const d of snap.docs) batch.delete(d.ref);
            await batch.commit();
            count += snap.docs.length;
            lastDoc = snap.docs[snap.docs.length - 1];
            if (snap.docs.length < PAGE_SIZE) break;
          }
          purgedByType[type] = count;
        }

        logger.info("lifecycle.purge.completed", { purgedByType, cutoff: cutoff.toISOString() });
      },
    );
    ```

    **Note about the in-memory mock:** the mock from 08-01 implements `where("deletedAt", "<", cutoff)` for Date values via the `>` op handling — verify that handler also covers `<` comparison. If not, extend the mock factory in this task to add `"<"` op support (mirror the existing `">"` branch in `functions/test/_mocks/admin-sdk.ts buildQuery()`). Add `orderBy()` and `startAfter()` no-op methods that return `this` so the chained call compiles. The mock's existing `limit(n)` already works.

    Test file `functions/test/lifecycle/scheduledPurge.unit.test.ts`:
    - Mock layout mirrors `auditWrite.integration.test.ts` minus the params secret mock (scheduledPurge doesn't use SENTRY_DSN)
    - For Test 2 (pagination): seed 1200 docs via `for (let i=0; i<1200; i++) adminMockState._seedDoc(\`softDeleted/message/items/m${i}\`, { deletedAt: oldDate, ... })` — assert `adminMockState._allDocs().size` post-invocation drops by 1200
    - Use `vi.useFakeTimers()` + `vi.setSystemTime(new Date("2026-06-15T03:00:00Z"))` so the 30-day cutoff is deterministic
    - Use `t.wrap(scheduledPurge)` from firebase-functions-test 3.5

    All 5 tests must pass.
  </action>
  <verify>
    <automated>cd functions && npm test -- scheduledPurge 2>&1 | tail -20</automated>
  </verify>
  <done>
    - `functions/src/lifecycle/scheduledPurge.ts` exists; pagination loop uses `limit(PAGE_SIZE)` with `startAfter(lastDoc)` (verified by grep — both substrings present)
    - `RETENTION_DAYS = 30` and `PAGE_SIZE = 500` are module constants
    - Per-type iteration via `SOFT_DELETABLE_TYPES` import (no hardcoded type list)
    - Test file has ≥ 5 tests including the 1200-doc pagination test; all pass
    - If mock extension was needed, `functions/test/_mocks/admin-sdk.ts` `buildQuery()` now handles `"<"` op + chainable `orderBy()` + `startAfter()` (Phase 7's 133 + Wave 1+2 tests still all green)
    - `cd functions && npm test` exits 0
  </done>
</task>

<task type="auto">
  <name>Task 3: Update firestore.rules + tests/rules/soft-delete-predicate.test.js with the 5 collection paths</name>
  <read_first>
    - firestore.rules (current — Phase 5 Wave 1 baseline; notDeleted predicate already at line 17-19)
    - tests/rules/soft-delete-predicate.test.js (Phase 5 baseline — orgs/{orgId} parent already covered; Wave 8 extends to 5 paths)
    - tests/rules/setup.js (ROLES + asUser + initRulesEnv — reuse verbatim)
    - 08-RESEARCH.md §Pattern 11 (rules-not-filters caveat — both rule conjunct AND client query must add deletedAt==null)
  </read_first>
  <files>firestore.rules, tests/rules/soft-delete-predicate.test.js</files>
  <action>
    1. **firestore.rules** — add `notDeleted(resource.data)` to the `allow read` predicate on these 5 paths (and add `allow list` semantically equivalent — Firestore unifies `read` = `get` + `list` in v2 syntax, so a single `allow read` conjunct suffices). Modify ONLY the `allow read` lines — leave create/update/delete predicates untouched:

       Line ~56 (responses currently has no notDeleted; LEAVE AS IS — responses don't soft-delete per ARCHITECTURE.md §4)

       Line ~68 (comments — preserve internalOnly conjunct):
       ```
       allow read:   if inOrg(orgId)
                     && notDeleted(resource.data)
                     && (!("internalOnly" in resource.data) || !resource.data.internalOnly || isInternal());
       ```

       Line ~79 (actions):
       ```
       allow read:   if inOrg(orgId) && notDeleted(resource.data);
       ```

       Line ~90 (documents):
       ```
       allow read:   if inOrg(orgId) && notDeleted(resource.data);
       ```

       Line ~98 (messages):
       ```
       allow read:   if inOrg(orgId) && notDeleted(resource.data);
       ```

       Line ~184 (funnelComments — top-level, uses resource.data.orgId):
       ```
       allow read:   if inOrg(resource.data.orgId) && notDeleted(resource.data);
       ```

       DO NOT touch the orgs/{orgId} parent doc rule (already has notDeleted from Phase 5). DO NOT change any allow create/update/delete — soft-delete is server-mediated via Cloud Function (delete is `if false`).

    2. **tests/rules/soft-delete-predicate.test.js** — extend with 5 new describe blocks (one per soft-deletable subcollection + funnelComments). Mirror the Phase 5 orgs/{orgId} pattern. For each:
       - In `beforeEach`, use `withSecurityRulesDisabled` to seed:
         - one LIVE doc (deletedAt: null)
         - one SOFT-DELETED doc (deletedAt: Timestamp.now())
       - Test (allow): client_orgA reads the LIVE doc → assertSucceeds
       - Test (deny): client_orgA reads the SOFT-DELETED doc → assertFails
       - Test (allow internal): internal reads the SOFT-DELETED doc → assertFails (rules predicate denies even for internal — only Cloud Function reads softDeleted/ snapshots; internal queries the live collections only)

       Path-by-path:
       - `orgs/orgA/comments/cLive` + `orgs/orgA/comments/cDeleted` (with `pillarId:"1"`)
       - `orgs/orgA/actions/aLive` + `orgs/orgA/actions/aDeleted`
       - `orgs/orgA/documents/dLive` + `orgs/orgA/documents/dDeleted`
       - `orgs/orgA/messages/mLive` + `orgs/orgA/messages/mDeleted` (with `authorId:"u1"`)
       - `funnelComments/fcLive` + `funnelComments/fcDeleted` (with `orgId:"orgA", authorId:"u1"`)

       Total NEW tests: 5 collections × 3 cases = 15 (existing Phase 5 orgs/{orgId} tests preserved verbatim).

    3. **Confirm rules-test invocation**: the `npm test` root vitest config (per Phase 5) sources `tests/rules/*.test.js` against the running Firestore emulator. If the emulator is not running locally, the rules tests are skipped with a notice — in CI they run. Verify locally with `npx firebase emulators:exec --only firestore "vitest run tests/rules/soft-delete-predicate.test.js"` (per Phase 5 README) OR rely on the CI run.

    DO NOT modify rules predicates for `softDeleted/` itself — that already has `allow read: if isAdmin(); allow write: if false`.
  </action>
  <verify>
    <automated>npm test -- tests/rules/soft-delete-predicate 2>&1 | tail -25</automated>
  </verify>
  <done>
    - `firestore.rules` has `notDeleted(resource.data)` on read predicates for 5 new paths (verified by `grep -c "notDeleted(resource.data)" firestore.rules` — count is now ≥ 6: 1 from Phase 5 orgs + 5 added)
    - comments rule preserves the `internalOnly` conjunct AFTER the notDeleted conjunct (verified by `grep -A2 "match /orgs/{orgId}/comments" firestore.rules`)
    - `tests/rules/soft-delete-predicate.test.js` has ≥ 15 new test cases across 5 new describe blocks (verified by `grep -c "^  it\(" tests/rules/soft-delete-predicate.test.js` ≥ 18 — original 3 + 15 new)
    - When run against the Firestore emulator, all tests pass
    - No client create/update/delete rule modifications (verified by `git diff firestore.rules` — only `allow read` lines changed for the 5 paths)
  </done>
</task>

<task type="auto">
  <name>Task 4: Add `where("deletedAt", "==", null)` to client list/subscribe queries on soft-deletable collections</name>
  <read_first>
    - 08-RESEARCH.md §Pattern 11 (client query MUST include deletedAt==null or rules deny — Pitfall A)
    - src/data/messages.js (subscribeMessages query target)
    - src/data/comments.js (listComments query — already uses query+where)
    - src/data/documents.js (listDocuments query)
    - src/data/funnel-comments.js (listFunnelComments + subscribeFunnelComments)
    - src/data/actions.js (listActions)
    - src/firebase/db.js (verify `query` and `where` are exported — Phase 5 already re-exports both)
  </read_first>
  <files>src/data/messages.js, src/data/comments.js, src/data/documents.js, src/data/funnel-comments.js, src/data/actions.js</files>
  <action>
    For each file, wrap the existing `getDocs(collection(...))` or `onSnapshot(collection(...))` calls with `query(...)` + `where("deletedAt", "==", null)`. Preserve every other behavior (sort, filter, etc.). Keep API signatures verbatim (Phase 5 D-11 contract).

    1. **`src/data/messages.js`** — listMessages + subscribeMessages:
       - Add `query, where` to the import line: `import { db, collection, query, where, getDocs, onSnapshot, serverTimestamp } from "../firebase/db.js";`
       - listMessages:
         ```javascript
         const q = query(
           collection(db, "orgs", orgId, "messages"),
           where("deletedAt", "==", null),
         );
         const snap = await getDocs(q);
         ```
       - subscribeMessages:
         ```javascript
         return onSnapshot(
           query(
             collection(db, "orgs", orgId, "messages"),
             where("deletedAt", "==", null),
           ),
           (snap) => { ... },
           onError,
         );
         ```

    2. **`src/data/comments.js`** — listComments already uses query+where for pillarId; add the deletedAt conjunct:
       ```javascript
       const q = query(
         collection(db, "orgs", orgId, "comments"),
         where("pillarId", "==", String(pillarId)),
         where("deletedAt", "==", null),
       );
       ```

    3. **`src/data/actions.js`** — listActions:
       - Add query+where to imports
       - listActions:
         ```javascript
         const q = query(
           collection(db, "orgs", orgId, "actions"),
           where("deletedAt", "==", null),
         );
         const snap = await getDocs(q);
         ```

    4. **`src/data/documents.js`** — listDocuments:
       - Add query+where to imports
       - listDocuments:
         ```javascript
         const q = query(
           collection(db, "orgs", orgId, "documents"),
           where("deletedAt", "==", null),
         );
         const snap = await getDocs(q);
         ```
       - **Additionally** for BACKUP-05 sweep: REMOVE `getDownloadURL` from the storage import line; REMOVE the `await getDownloadURL(...)` call from saveDocument; REMOVE `downloadURL` from the setDoc payload (it's no longer cached — clients fetch via signed-url callable on demand). Update the storage import to drop `getDownloadURL`:
         ```javascript
         import { storage, ref, uploadBytesResumable, deleteObject } from "../firebase/storage.js";
         ```
       - The saveDocument return shape becomes `{ id }` only (downloadURL field dropped). Update JSDoc accordingly: `@returns {Promise<{ id: string }>}`. CALLERS NEED to use the signed-url callable on demand — the only caller is in src/main.js (line ~3359 area) which Task 7 rewires.

    5. **`src/data/funnel-comments.js`** — listFunnelComments + subscribeFunnelComments. Both already use query+where for orgId; add the deletedAt conjunct:
       ```javascript
       const q = query(
         collection(db, "funnelComments"),
         where("orgId", "==", orgId),
         where("deletedAt", "==", null),
       );
       ```
       Apply to both list + subscribe.

    6. After edits: `npm run typecheck` exits 0; `npm test` (root) exits 0 — Phase 4 + Phase 5 + Phase 7 baseline tests don't reference deletedAt; the existing tests/data/*.test.js mocks should still resolve. If a mock test fails because `where("deletedAt", "==", null)` was added to a query whose mock doesn't model it, extend the mock to handle the additional conjunct as a no-op filter (any null deletedAt passes). Most likely the mocks already handle generic where clauses.
  </action>
  <verify>
    <automated>npm run typecheck 2>&1 | tail -10 && npm test 2>&1 | tail -25</automated>
  </verify>
  <done>
    - All 5 data files import `query` and `where` from `../firebase/db.js`
    - All 5 list functions wrap their query in `query(collection(...), where("deletedAt", "==", null))` (verified by `grep -c 'where("deletedAt"' src/data/*.js` ≥ 5)
    - subscribeMessages + subscribeFunnelComments include the deletedAt conjunct
    - src/data/documents.js no longer imports or calls `getDownloadURL`; saveDocument returns `{ id }` only (verified by `grep -c "getDownloadURL" src/data/documents.js` == 0)
    - `npm run typecheck` exits 0
    - `npm test` (root) exits 0 — Phase 2/4/5 unit tests still pass
  </done>
</task>

<task type="auto">
  <name>Task 5: Wire functions/src/index.ts + author 2 integration tests for softDelete + restoreSoftDeleted</name>
  <read_first>
    - functions/src/index.ts (current 11 exports after 08-02 — Wave 2 ADDS only)
    - functions/test/integration/auditWrite.integration.test.ts (offline-mode integration pattern)
  </read_first>
  <files>functions/src/index.ts, functions/test/integration/softDelete.integration.test.ts, functions/test/integration/restoreSoftDeleted.integration.test.ts</files>
  <action>
    1. **Add 3 lines to `functions/src/index.ts`** (group under a new banner — order: backup → lifecycle → existing):
       ```typescript
       // Phase 8 Wave 2 (08-03): soft-delete lifecycle Cloud Functions.
       export { softDelete } from "./lifecycle/softDelete.js";
       export { restoreSoftDeleted } from "./lifecycle/restoreSoftDeleted.js";
       export { scheduledPurge } from "./lifecycle/scheduledPurge.js";
       export { permanentlyDeleteSoftDeleted } from "./lifecycle/permanentlyDeleteSoftDeleted.js";
       ```

    2. **`functions/test/integration/softDelete.integration.test.ts`** — mirror auditWrite.integration.test.ts:
       - vi.mock factories for firebase-admin/app + firebase-admin/firestore + firebase-functions/params + firebase-functions/logger
       - `const t = functionsTest({ projectId: "bedeveloped-base-layers-test" })`
       - 5 tests:
         - happy path: admin caller, type:"comment", live doc seeded → returns {ok:true}; live doc has deletedAt set; softDeleted/comment/items/<id> exists with originalPath
         - rejects non-admin (token.role:"client") → permission-denied
         - rejects unauthenticated → unauthenticated
         - rejects already-deleted (live doc has deletedAt) → failed-precondition
         - rejects unknown type via Zod → invalid-argument

    3. **`functions/test/integration/restoreSoftDeleted.integration.test.ts`** — mirror, with 4 tests:
       - happy path round-trip: pre-seed live (deletedAt set) + softDeleted snapshot, admin restores → live doc has deletedAt:null + restoredAt; snapshot is gone
       - rejects non-admin → permission-denied
       - rejects unauthenticated → unauthenticated
       - rejects when softDeleted/{type}/items/{id} absent → not-found
  </action>
  <verify>
    <automated>cd functions && npm test 2>&1 | tail -20</automated>
  </verify>
  <done>
    - `functions/src/index.ts` exports softDelete + restoreSoftDeleted + scheduledPurge + permanentlyDeleteSoftDeleted (verified by `grep -c "^export" functions/src/index.ts` == 15 — was 11 after 08-02; +4 added in Wave 2)
    - 2 integration test files exist with ≥ 9 tests total; all pass
    - `cd functions && npm test` exits 0
    - `cd functions && npm run build` exits 0; `lib/lifecycle/{softDelete,restoreSoftDeleted,scheduledPurge,resolveDocRef}.js` all exist
  </done>
</task>

<task type="auto">
  <name>Task 6: Fill src/cloud/soft-delete.js stub bodies (LIFE-04 close)</name>
  <read_first>
    - src/cloud/soft-delete.js (current Phase 4 stub)
    - src/cloud/checkRateLimit.js (Pattern reference — httpsCallable wrapper shape)
    - src/cloud/signed-url.js (just authored in 08-02 — same pattern)
  </read_first>
  <files>src/cloud/soft-delete.js</files>
  <action>
    Replace `src/cloud/soft-delete.js` body with the real implementation. Header replaces the Phase-4 cleanup-ledger pointer with Wave 2 closure:

    ```javascript
    // src/cloud/soft-delete.js
    // @ts-check
    // Phase 8 Wave 2 (LIFE-04): browser seam — wraps the softDelete +
    // restoreSoftDeleted callables (functions/src/lifecycle/*). Phase 4 stub
    // body REPLACED — cleanup-ledger row CLOSES with this commit.
    //
    // The real Cloud Function callable enforces admin-only authorization
    // server-side via request.auth.token.role; the client wrapper is unaware
    // of the gate (caller catches HttpsError on permission-denied via the
    // Phase 6 D-13 unified-error wrapper surface).

    import { httpsCallable } from "firebase/functions";
    import { functions } from "../firebase/functions.js";

    const softDeleteCallable = httpsCallable(functions, "softDelete");
    const restoreSoftDeletedCallable = httpsCallable(functions, "restoreSoftDeleted");

    /**
     * Soft-delete a record. Admin only (server-enforced).
     * @param {{ type: "org"|"comment"|"document"|"message"|"funnelComment", orgId: string, id: string }} input
     * @returns {Promise<{ ok: true }>}
     */
    export async function softDelete(input) {
      const clientReqId = crypto.randomUUID();
      const result = await softDeleteCallable({ ...input, clientReqId });
      return /** @type {{ ok: true }} */ (result.data);
    }

    /**
     * Restore a soft-deleted record. Admin only (server-enforced).
     * @param {{ type: "org"|"comment"|"document"|"message"|"funnelComment", orgId: string, id: string }} input
     * @returns {Promise<{ ok: true }>}
     */
    export async function restoreSoftDeleted(input) {
      const clientReqId = crypto.randomUUID();
      const result = await restoreSoftDeletedCallable({ ...input, clientReqId });
      return /** @type {{ ok: true }} */ (result.data);
    }
    ```

    Validate: `npm run typecheck` exits 0. The exported function names AND signatures match the Phase 4 stub contract — views/admin.js can call without an adapter change (per the cleanup-ledger D-11 invariant).
  </action>
  <verify>
    <automated>npm run typecheck 2>&1 | tail -10</automated>
  </verify>
  <done>
    - `src/cloud/soft-delete.js` no longer contains `Phase 8 body lands here` placeholder text (verified by `grep -c "lands here" src/cloud/soft-delete.js` == 0)
    - File header banner cites LIFE-04 + cleanup-ledger CLOSES
    - Both functions instantiate `httpsCallable(functions, "<name>")` and pass `clientReqId: crypto.randomUUID()` per the Pattern A idempotency contract
    - `npm run typecheck` exits 0
    - `grep -c "httpsCallable" src/cloud/soft-delete.js` == 3 (1 import + 2 instantiations)
  </done>
</task>

<task type="auto">
  <name>Task 7: Replace getDownloadURL site in src/main.js + LIFE-06 functional admin UI in src/views/admin.js</name>
  <read_first>
    - src/main.js lines 3340-3380 (the getDownloadURL site identified at line 3359 — verify by re-grepping)
    - src/cloud/signed-url.js (just authored in 08-02 — the seam to import)
    - src/views/admin.js (current Pattern D DI factory stub)
    - src/cloud/soft-delete.js (just filled in Task 6 — softDelete + restoreSoftDeleted helpers)
    - src/data/soft-deleted.js (Task 8 below — listSoftDeleted helper; if this task lands first, the helper signature is documented in Task 8's <interfaces>)
    - 08-RESEARCH.md §Standard Stack (LIFE-06 functional — admin table with Restore + Permanently delete now buttons)
    - .planning/research/PITFALLS.md §G (full sweep — grep getDownloadURL across src/ at end of wave)
  </read_first>
  <action>
    1. **Replace getDownloadURL site in src/main.js** — same as the original plan: find the upload-handler site (~line 3359) + any `\.downloadURL` reads, replace with dynamic-import calls to `src/cloud/signed-url.js#getDocumentSignedUrl`. Pattern:
       ```javascript
       onclick: async () => {
         try {
           const { getDocumentSignedUrl } = await import("./cloud/signed-url.js");
           const { url } = await getDocumentSignedUrl(org.id, m.id, m.filename);
           window.open(url, "_blank", "noopener,noreferrer");
         } catch (e) {
           notify("error", "Couldn't fetch download link: " + (e.message || e));
         }
       }
       ```
       Also drop `downloadURL` from any setDoc payloads. Verify: `grep -c "getDownloadURL" src/main.js` == 0 after edit.

    2. **Fill src/views/admin.js with LIFE-06 functional Recently Deleted section** — wires through `src/data/soft-deleted.js#listSoftDeleted` (Task 8 deliverable) AND the Restore button calls `src/cloud/soft-delete.js#restoreSoftDeleted` AND adds a `Permanently delete now` button that calls `src/cloud/soft-delete.js#permanentlyDeleteSoftDeleted` (Task 8 deliverable). The view MUST work end-to-end — no "unavailable" fallback branch.

       Replace Pattern D factory body. New shape:
       ```javascript
       // src/views/admin.js
       // @ts-check
       // Phase 8 Wave 2 (LIFE-06 functional): admin Recently Deleted view —
       // table of soft-deleted items with Restore + Permanently delete now buttons.
       // Wires through src/cloud/soft-delete.js (LIFE-04 + permanently-delete callables)
       // AND src/data/soft-deleted.js#listSoftDeleted (admin-read of softDeleted/* per
       // existing firestore.rules `allow read: if isAdmin()`).

       import { h as defaultH } from "../ui/dom.js";
       import { listSoftDeleted as defaultListSoftDeleted } from "../data/soft-deleted.js";
       import {
         restoreSoftDeleted as defaultRestoreSoftDeleted,
         permanentlyDeleteSoftDeleted as defaultPermanentlyDelete,
       } from "../cloud/soft-delete.js";

       /**
        * @typedef {{
        *   state?: *,
        *   h?: (tag: string, attrs?: *, children?: *) => HTMLElement,
        *   listSoftDeleted?: () => Promise<Array<{ type: string, orgId: string, id: string, snapshot: any, deletedAt: any }>>,
        *   restoreSoftDeleted?: (input: { type: string, orgId: string, id: string }) => Promise<{ ok: true }>,
        *   permanentlyDeleteSoftDeleted?: (input: { type: string, id: string }) => Promise<{ ok: true }>,
        *   onChange?: () => void,
        * }} AdminDeps
        */

       /**
        * @param {AdminDeps} [deps]
        * @returns {{ renderAdmin: (user: *) => HTMLElement }}
        */
       export function createAdminView(deps = {}) {
         const h = deps.h || defaultH;
         const listFn = deps.listSoftDeleted || defaultListSoftDeleted;
         const restoreFn = deps.restoreSoftDeleted || defaultRestoreSoftDeleted;
         const purgeFn = deps.permanentlyDeleteSoftDeleted || defaultPermanentlyDelete;

         return {
           renderAdmin(user) {
             const root = h("div", { class: "admin-view" });
             root.appendChild(h("h2", { class: "view-title" }, "Admin"));

             const section = h("section", { class: "admin-recently-deleted" });
             section.appendChild(h("h3", null, "Recently Deleted"));
             const tableHost = h("div", { class: "admin-table-host" }, "Loading…");
             section.appendChild(tableHost);
             root.appendChild(section);

             const refresh = async () => {
               try {
                 const items = await listFn();
                 if (!items || items.length === 0) {
                   tableHost.replaceChildren(h("p", { class: "muted" }, "No recently deleted items."));
                   return;
                 }
                 const rows = items.map((it) => h("tr", null, [
                   h("td", null, it.type),
                   h("td", null, it.id),
                   h("td", null, it.deletedAt?.toDate?.()?.toISOString?.() || String(it.deletedAt || "")),
                   h("td", null, [
                     h("button", {
                       class: "btn sm",
                       onclick: async () => {
                         try {
                           await restoreFn({ type: it.type, orgId: it.orgId, id: it.id });
                           if (deps.onChange) deps.onChange();
                           refresh();
                         } catch (e) {
                           tableHost.appendChild(h("p", { class: "auth-error" }, String(e?.message || e)));
                         }
                       },
                     }, "Restore"),
                     " ",
                     h("button", {
                       class: "btn sm danger",
                       onclick: async () => {
                         if (!window.confirm("Permanently delete this record? This cannot be undone.")) return;
                         try {
                           await purgeFn({ type: it.type, id: it.id });
                           if (deps.onChange) deps.onChange();
                           refresh();
                         } catch (e) {
                           tableHost.appendChild(h("p", { class: "auth-error" }, String(e?.message || e)));
                         }
                       },
                     }, "Permanently delete now"),
                   ]),
                 ]));
                 const table = h("table", { class: "admin-table" }, [
                   h("thead", null, h("tr", null, [h("th", null, "Type"), h("th", null, "ID"), h("th", null, "Deleted At"), h("th", null, "Actions")])),
                   h("tbody", null, rows),
                 ]);
                 tableHost.replaceChildren(table);
               } catch (e) {
                 tableHost.replaceChildren(h("p", { class: "auth-error" }, "Failed to load: " + (e?.message || e)));
               }
             };
             refresh();
             return root;
           },
         };
       }

       /**
        * @param {*} user
        * @returns {HTMLElement}
        */
       export function renderAdmin(user) {
         return createAdminView().renderAdmin(user);
       }
       ```

       The factory now defaults each dep to the real wired helper — no caller injection required for production. Tests can still inject mocks via `createAdminView({ listSoftDeleted: vi.fn(), ... })`.

    3. After edits: `npm run typecheck` exits 0; `npm test` (root) exits 0.
  </action>
  <verify>
    <automated>grep -c "getDownloadURL" src/main.js src/data/documents.js && npm run typecheck 2>&1 | tail -10</automated>
  </verify>
  <done>
    - `src/main.js` has zero remaining `getDownloadURL` references (verified by `grep -c "getDownloadURL" src/main.js` == 0)
    - `src/data/documents.js` has zero remaining `getDownloadURL` references (verified — already done in Task 4)
    - `src/firebase/storage.js` STILL re-exports `getDownloadURL` (cleanup-ledger row in 08-06 considers whether to drop)
    - `src/views/admin.js` exports `createAdminView` with the new shape; the `Recently Deleted` h3 + Restore button + `Permanently delete now` button substrings exist (verified by `grep -c "Recently Deleted" src/views/admin.js` >= 1 AND `grep -c "Permanently delete now" src/views/admin.js` >= 1)
    - `createAdminView` defaults listSoftDeleted to `defaultListSoftDeleted` (the real wrapper from src/data/soft-deleted.js) — verified by `grep -c "defaultListSoftDeleted" src/views/admin.js` >= 2 (one import alias + one default assignment)
    - `npm run typecheck` exits 0
    - `npm test` (root) exits 0
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 8: Author src/data/soft-deleted.js + functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts callable + tests</name>
  <read_first>
    - src/data/messages.js (Pattern reference — vanilla JS @ts-check + getDocs over a Firestore collection)
    - src/firebase/db.js (verify db + collection + getDocs are exported)
    - functions/src/lifecycle/softDelete.ts (just authored in Task 1 — Pattern A reference for the new callable)
    - functions/src/lifecycle/scheduledPurge.ts (just authored in Task 2 — single-record hard-delete logic to mirror)
    - functions/src/lifecycle/resolveDocRef.ts (SOFT_DELETABLE_TYPES + resolveSnapshotPath — reuse)
    - firestore.rules lines 137-140 (existing softDeleted/{type}/items/{id} block — `allow read: if isAdmin()` already permits the listSoftDeleted reads; no rules change needed)
  </read_first>
  <behavior>
    src/data/soft-deleted.js#listSoftDeleted (browser):
    - Test 1: returns an empty array if all softDeleted/{type}/items collections are empty
    - Test 2: returns merged entries across all 5 types; each entry has shape { type, orgId, id, snapshot, deletedAt }
    - Test 3: derives `orgId` from `snapshot.originalOrgId` (set by Task 1 softDelete) when present; falls back to null

    functions/src/lifecycle/permanentlyDeleteSoftDeleted (callable):
    - Test 4: non-admin → permission-denied
    - Test 5: unauthenticated → unauthenticated
    - Test 6: invalid input (missing type) → invalid-argument
    - Test 7: happy path: admin caller, type:"comment", id:"c_xyz" with seeded softDeleted/comment/items/c_xyz → returns {ok:true}; the doc is gone from softDeleted/
    - Test 8: not-found: missing softDeleted record → HttpsError("not-found")
    - Test 9: idempotent re-delete with same clientReqId within 5min → already-exists
    - Integration test 10: round-trip via firebase-functions-test wrap()
  </behavior>
  <files>src/data/soft-deleted.js, functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts, functions/test/lifecycle/permanentlyDeleteSoftDeleted.unit.test.ts, functions/test/integration/permanentlyDeleteSoftDeleted.integration.test.ts</files>
  <action>
    1. **`src/data/soft-deleted.js`** — browser-side admin read wrapper:
       ```javascript
       // src/data/soft-deleted.js
       // @ts-check
       // Phase 8 Wave 2 (LIFE-06 functional): admin-only read wrapper over
       // softDeleted/{type}/items/*. The existing firestore.rules block
       //   match /softDeleted/{type}/items/{id} {
       //     allow read:  if isAdmin();
       //     allow write: if false;       // server-only (Phase 8)
       //   }
       // gates these reads — non-admin callers get permission-denied (the
       // admin view shows the error inline via the catch branch).

       import { db, collection, getDocs } from "../firebase/db.js";

       const SOFT_DELETABLE_TYPES = /** @type {const} */ ([
         "org", "comment", "document", "message", "funnelComment",
       ]);

       /**
        * @returns {Promise<Array<{ type: string, orgId: string|null, id: string, snapshot: any, deletedAt: any }>>}
        */
       export async function listSoftDeleted() {
         const out = [];
         for (const type of SOFT_DELETABLE_TYPES) {
           const snap = await getDocs(collection(db, "softDeleted", type, "items"));
           snap.forEach((doc) => {
             const data = doc.data() || {};
             out.push({
               type,
               orgId: typeof data.originalOrgId === "string" ? data.originalOrgId : null,
               id: doc.id,
               snapshot: data,
               deletedAt: data.deletedAt ?? null,
             });
           });
         }
         return out;
       }

       export { SOFT_DELETABLE_TYPES };
       ```

    2. **`functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts`** — Pattern A admin-only callable. Mirror softDelete.ts header style.

       ```typescript
       // Phase 8 Wave 2 (LIFE-06 functional / Pitfall 7): Admin-callable that
       // hard-deletes ONE softDeleted/{type}/items/{id} record on demand.
       // Same hard-delete logic that scheduledPurge runs in batch — extracted
       // here so the admin UI's "Permanently delete now" button can act
       // immediately rather than waiting for the next 03:00 UTC purge cycle.
       //
       // Pitfall 7 mitigation: this function deletes EXACTLY ONE softDeleted
       // record per invocation; no per-doc audit event mirror trigger storm
       // (the softDeleted/* collection has no onDocumentDelete trigger wired).
       //
       // Service account: lifecycle-sa (same as softDelete + scheduledPurge —
       // no new IAM provisioning required).

       import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
       import { logger } from "firebase-functions/logger";
       import { defineSecret } from "firebase-functions/params";
       import { initializeApp, getApps } from "firebase-admin/app";
       import { getFirestore } from "firebase-admin/firestore";
       import { z } from "zod";
       import { withSentry } from "../util/sentry.js";
       import { validateInput } from "../util/zod-helpers.js";
       import { ensureIdempotent } from "../util/idempotency.js";
       import { SOFT_DELETABLE_TYPES, resolveSnapshotPath } from "./resolveDocRef.js";

       if (!getApps().length) initializeApp();
       const SENTRY_DSN = defineSecret("SENTRY_DSN");

       const PermanentlyDeleteInput = z.object({
         type: z.enum(SOFT_DELETABLE_TYPES),
         id: z.string().min(1).max(128),
         clientReqId: z.string().uuid(),
       });

       export const permanentlyDeleteSoftDeleted = onCall(
         {
           region: "europe-west2",
           enforceAppCheck: true,
           serviceAccount: "lifecycle-sa",
           secrets: [SENTRY_DSN],
           memory: "256MiB",
           timeoutSeconds: 30,
         },
         withSentry(async (request: CallableRequest<unknown>) => {
           if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
           const token = (request.auth.token ?? {}) as Record<string, unknown>;
           if (token.role !== "admin") throw new HttpsError("permission-denied", "admin role required");

           const data = validateInput(PermanentlyDeleteInput, request.data ?? {});
           await ensureIdempotent(
             `permanentlyDeleteSoftDeleted:${request.auth.uid}:${data.type}:${data.id}:${data.clientReqId}`,
             "permanentlyDeleteSoftDeleted",
             5 * 60,
           );

           const db = getFirestore();
           const ref = db.doc(resolveSnapshotPath({ type: data.type, id: data.id }));
           const snap = await ref.get();
           if (!snap.exists) throw new HttpsError("not-found", "Soft-deleted record not found");

           await ref.delete();

           logger.info("lifecycle.permanentlyDeleteSoftDeleted", {
             type: data.type, id: data.id, actorUid: request.auth.uid,
           });
           return { ok: true };
         }),
       );
       ```

    3. **`functions/src/index.ts`** — extend the Wave 2 banner exports:
       ```typescript
       export { permanentlyDeleteSoftDeleted } from "./lifecycle/permanentlyDeleteSoftDeleted.js";
       ```
       (This export is also captured in Task 5's index.ts banner update — Task 8 + Task 5 collaborate on the index.ts patch.)

    4. **`src/cloud/soft-delete.js`** — extend Task 6's body to add the new helper:
       ```javascript
       const permanentlyDeleteCallable = httpsCallable(functions, "permanentlyDeleteSoftDeleted");

       /**
        * Permanently delete (hard-delete) ONE soft-deleted record. Admin only.
        * @param {{ type: "org"|"comment"|"document"|"message"|"funnelComment", id: string }} input
        * @returns {Promise<{ ok: true }>}
        */
       export async function permanentlyDeleteSoftDeleted(input) {
         const clientReqId = crypto.randomUUID();
         const result = await permanentlyDeleteCallable({ ...input, clientReqId });
         return /** @type {{ ok: true }} */ (result.data);
       }
       ```

    5. **Test files**:
       - `functions/test/lifecycle/permanentlyDeleteSoftDeleted.unit.test.ts` — covers behaviours 4-9 (6 tests). Mirror the softDelete.unit.test.ts mock layout.
       - `functions/test/integration/permanentlyDeleteSoftDeleted.integration.test.ts` — covers behaviour 10 with full firebase-functions-test wrap.
       - For `src/data/soft-deleted.js` browser tests (behaviours 1-3): co-locate or use the existing tests/data/ pattern — mock `getDocs` to return seeded snapshots; assert the merged output shape. The test file path is at the executor's discretion (project convention).

    6. After edits: all tests pass; no Phase 7 baseline regression.
  </action>
  <verify>
    <automated>cd functions && npm test -- permanentlyDeleteSoftDeleted 2>&1 | tail -20 && npm run typecheck 2>&1 | tail -5</automated>
  </verify>
  <done>
    - `src/data/soft-deleted.js` exists; `listSoftDeleted` exports correctly + iterates over 5 SOFT_DELETABLE_TYPES (verified by `grep -c "softDeleted" src/data/soft-deleted.js` >= 1 AND `grep -c "SOFT_DELETABLE_TYPES" src/data/soft-deleted.js` >= 2)
    - `functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts` exists with admin-only gate + Zod validation + idempotency check + ref.delete()
    - `functions/src/index.ts` exports `permanentlyDeleteSoftDeleted` (Task 5 patch + this task's index.ts edit must agree — verify final `grep -c "^export" functions/src/index.ts` == 15 after both Task 5 + Task 8 land — was 11 after 08-02, +3 from Task 5 + +1 from Task 8 = 15)
    - `src/cloud/soft-delete.js` now exports `permanentlyDeleteSoftDeleted` in addition to `softDelete` and `restoreSoftDeleted` (verified by `grep -c "^export async function" src/cloud/soft-delete.js` == 3)
    - 6+ unit tests + 1 integration test pass for the new callable
    - All Phase 7 + Wave 1 baseline tests still green
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → softDelete callable | App Check + ID token + admin role claim verified server-side |
| browser → permanentlyDeleteSoftDeleted callable | App Check + ID token + admin role claim verified server-side |
| browser → softDeleted/{type}/items/* read | Admin role claim verified by firestore.rules `allow read: if isAdmin()` (existing rule, no Wave 2 change needed) |
| Cloud Function → softDeleted/{type}/items/{id} | Admin SDK (server-only writes per existing rules) |
| scheduledPurge → softDeleted/{type}/items/{id} | Admin SDK paginated delete |
| client query → soft-deletable subcollection | Rules require `notDeleted(resource.data)` AND client query MUST add `where("deletedAt", "==", null)` |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-08-03-01 | Elevation of Privilege | softDelete callable | mitigate | Token role check `if (token.role !== "admin") throw permission-denied` (Task 1 Test 2 pins it). Pitfall 17 — re-read from request.auth.token, NEVER from request.data. |
| T-08-03-02 | Tampering | softDelete inputs | mitigate | Zod validateInput rejects malformed input → invalid-argument (Task 1 Test 3 pins it). resolveDocPath uses an exhaustive switch over a literal type union; unknown type → RangeError. |
| T-08-03-03 | Information Disclosure | Soft-deleted docs visible to clients | mitigate | Rules predicate `notDeleted(resource.data)` denies reads on every soft-deletable subcollection (Task 3 — verified by 15 new rules-test cells). softDeleted/{type}/items/{id} has `allow read: if isAdmin()` only (existing Phase 5 rule preserved). |
| T-08-03-04 | Denial of Service | scheduledPurge timeout on large softDeleted/ | mitigate | Pagination via 500-doc limit + startAfter loop (Pitfall B) — Task 2 Test 2 pins 1200-doc handling. Per-type isolation prevents one type starving another. timeoutSeconds:540 + memory:512MiB headroom. |
| T-08-03-05 | Repudiation | softDelete operations | mitigate | logger.info("lifecycle.softDelete", {actorUid, type, orgId, id}) on every successful invocation. Wave 4 GDPR erase Cloud Function (08-05) writes audit-tier event via writeAuditEvent for the higher-stakes erasure operation; soft-delete relies on Cloud Logging tier. (AUDIT-05 view-side wiring is Phase 9 owner per the canonical map.) |
| T-08-03-06 | Spoofing | Cloud Function SA | mitigate | All 3 functions deployed with `serviceAccount: "lifecycle-sa"`. Operator must provision the SA per 08-06 cleanup wave (or operator-runbook follow-up); minimal IAM = `roles/datastore.user` (covers Firestore read/write) only. |
| T-08-03-07 | Tampering | Already-deleted replay | mitigate | softDelete checks `cur.deletedAt != null` before batch — throws failed-precondition (Task 1 Test 5). Idempotency-marker write (5-min window) catches duplicate clientReqId replays. |
| T-08-03-08 | Information Disclosure | softDeleted snapshot leaks PII via admin view | accept | softDeleted/{type}/items/{id} preserves the FULL original doc data including any author identifiers. This is by design — admin needs full state to evaluate restore. Rules limit to admin reads only. PII tombstoning happens at GDPR erasure (Wave 4 — separate flow). |
| T-08-03-09 | Elevation of Privilege | permanentlyDeleteSoftDeleted callable | mitigate | Token role check `if (token.role !== "admin") throw permission-denied` (Task 8 Test 4 pins it). Pitfall 17 — role from request.auth.token. |
| T-08-03-10 | Tampering | permanentlyDeleteSoftDeleted replay (admin double-click) | mitigate | ensureIdempotent on key `permanentlyDeleteSoftDeleted:<actor>:<type>:<id>:<clientReqId>` with 5-min window (Task 8 Test 9). The window.confirm("Permanently delete this record?") in the admin view also gates accidental clicks at the UI tier. |
| T-08-03-11 | Information Disclosure | listSoftDeleted leaks soft-deleted PII to non-admin browser caller | mitigate | The listSoftDeleted helper relies on the existing firestore.rules `match /softDeleted/{type}/items/{id} { allow read: if isAdmin(); }` block — non-admin callers get permission-denied per-collection iteration; the admin view's catch branch surfaces the error inline. No client-side filtering of PII (defence in depth: rules ARE the gate). |
</threat_model>

<verification>
- `cd functions && npm run build` exits 0; `lib/lifecycle/{softDelete,restoreSoftDeleted,scheduledPurge,resolveDocRef}.js` exist
- `cd functions && npm test` exits 0; total test count ≥ 08-02 baseline (151) + Wave 2 additions (Task 1: 16; Task 2: 5; Task 5: 9 minus deduped) ≈ 175+
- `cd functions && npm run typecheck` exits 0
- `npm run typecheck` (root) exits 0
- `npm test` (root) exits 0 (data-wrapper unit tests + soft-delete-predicate.test.js); rules-test cells run green when emulator is up (CI does this; locally requires `firebase emulators:exec`)
- `grep -c "notDeleted(resource.data)" firestore.rules` ≥ 6
- `grep -c 'where("deletedAt"' src/data/*.js` ≥ 5
- `grep -c "getDownloadURL" src/main.js src/data/documents.js` == 0
- `functions/src/index.ts` exports softDelete + restoreSoftDeleted + scheduledPurge
- `src/cloud/soft-delete.js` body filled (no "lands here" placeholder)
- `src/views/admin.js` Recently Deleted section landed
</verification>

<success_criteria>
- LIFE-01..05: 3 Cloud Functions + supporting helper land + tests pass
- LIFE-03: rules predicate honors notDeleted on 5 subcollection paths + funnelComments
- LIFE-04: src/cloud/soft-delete.js stub closure (now also includes permanentlyDeleteSoftDeleted helper)
- LIFE-06: FUNCTIONAL Recently Deleted admin view — listSoftDeleted dep wired by default + Restore button + Permanently delete now button (no "unavailable" branch)
- BACKUP-05 client sweep: getDownloadURL removed from src/data/documents.js + src/main.js — full closure of Pitfall G modulo the firebase/storage.js re-export (cleanup-ledger row in 08-06)
- Phase 7 + Wave 1 baseline tests still all green
- 25+ new tests across Wave 2 (lifecycle units + integration + rules predicates)
</success_criteria>

<output>
After completion, create `.planning/phases/08-data-lifecycle-soft-delete-gdpr-backups/08-03-SUMMARY.md` covering:
- 4 new functions/src/lifecycle/*.ts files + line counts
- Test counts: lifecycle/* unit tests + integration tests + new soft-delete-predicate.test.js cells
- Total functions/ test count delta from 08-02 (≥ +25)
- firestore.rules — 5 new notDeleted conjuncts; rules-emulator green count delta
- Data wrapper changes: list of 5 files + the where conjunct added to each
- src/cloud/soft-delete.js Wave-2 closure (Phase 4 stub closed)
- src/main.js getDownloadURL sweep — count of sites replaced + the helper they now use
- src/views/admin.js Recently Deleted UI shipped (LIFE-06 minimal — listSoftDeleted dep wiring deferred to 08-06)
- Cleanup-ledger forward pointers: (a) listSoftDeleted dep wiring; (b) src/firebase/storage.js getDownloadURL re-export drop
- Forward pointers: 08-04 wires gdprExportUser; 08-05 wires gdprEraseUser + redactionList rules update
</output>
