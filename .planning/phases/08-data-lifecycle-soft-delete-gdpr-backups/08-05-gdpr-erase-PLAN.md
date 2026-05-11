---
phase: 08
plan: 05
type: execute
wave: 5
depends_on:
  - 08-04
files_modified:
  - functions/src/gdpr/gdprEraseUser.ts
  - functions/src/gdpr/pseudonymToken.ts
  - functions/src/gdpr/eraseCascade.ts
  - functions/src/index.ts
  - functions/test/gdpr/pseudonymToken.unit.test.ts
  - functions/test/gdpr/eraseCascade.unit.test.ts
  - functions/test/gdpr/gdprEraseUser.unit.test.ts
  - functions/test/integration/gdprEraseUser.integration.test.ts
  - firestore.rules
  - tests/rules/redaction-list.test.js
  - scripts/post-erasure-audit/run.js
  - scripts/post-erasure-audit/README.md
  - src/cloud/gdpr.js
autonomous: false
requirements:
  - GDPR-02
  - GDPR-03
  - GDPR-04
  - GDPR-05
  - DOC-10
user_setup:
  - service: gcp
    why: "Provision GDPR_PSEUDONYM_SECRET in Firebase Secret Manager + create gdpr-writer-sa with broader IAM"
    env_vars:
      - name: GDPR_PSEUDONYM_SECRET
        source: "Firebase Secret Manager — created via `firebase functions:secrets:set GDPR_PSEUDONYM_SECRET` with a fresh 32-byte random value (`node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"`); MUST be set BEFORE deploying gdprEraseUser or first invocation throws"
    dashboard_config:
      - task: "Create gdpr-writer-sa with broad write IAM"
        location: "Local terminal: `gcloud iam service-accounts create gdpr-writer-sa` + project bindings for roles/datastore.user + roles/firebaseauth.admin + roles/storage.objectAdmin (uploads bucket)"
must_haves:
  truths:
    - "gdprEraseUser callable (admin-only) cascades a deterministic pseudonym token across all denormalised author/owner/uploader fields in: orgs/{orgId}/messages, orgs/{orgId}/comments, orgs/{orgId}/actions, orgs/{orgId}/documents, funnelComments, plus legacy top-level documents/, AND deletes the underlying Storage objects under orgs/{orgId}/documents/{docId}/{filename} for every tombstoned documents row (GDPR-03 Storage enumeration; missing objects tolerated via try/catch)"
    - "Pseudonym token is sha256(uid + GDPR_PSEUDONYM_SECRET) sliced to first 16 hex chars, prefixed `deleted-user-` — same input always yields same token (idempotent re-run)"
    - "users/{uid} profile fields email, name, displayName, photoURL, avatar are tombstoned (replaced with the pseudonym token / null); the uid itself is preserved (Firestore doc ID immutable; Auth user is also disabled via getAuth().updateUser({disabled: true}))"
    - "auditLog entries where actor.uid==userId are NOT deleted (legitimate interest); actor.email/payload PII fields are tombstoned in-place per GDPR-04 (Pitfall 11)"
    - "redactionList/{userId} doc is written with { tombstoneToken, erasedAt, erasedBy, schemaVersion: 1 } — server-only writes via firestore.rules"
    - "scripts/post-erasure-audit/run.js (Node ADC script) re-runs the same multi-field collectionGroup queries used by gdprExportUser; if any non-tombstoned reference to userId remains, exits 1 with a list of paths"
    - "compliance.erase.user audit event is written via writeAuditEvent — single summary event, NOT per-doc (Pitfall 7 — avoid mirror-trigger stampede on bulk delete cascades)"
    - "src/cloud/gdpr.js eraseUser body fills (Phase 4 stub closure)"
  artifacts:
    - path: "functions/src/gdpr/pseudonymToken.ts"
      provides: "Pure helper: deterministic sha256(uid + secret) → token"
      contains: "deleted-user-"
    - path: "functions/src/gdpr/eraseCascade.ts"
      provides: "Pure helper: maps query results → batched-write ops"
      contains: "Firestore batch limit"
    - path: "functions/src/gdpr/gdprEraseUser.ts"
      provides: "Admin-only callable: cascade + redactionList + audit"
      contains: "compliance.erase.user"
    - path: "scripts/post-erasure-audit/run.js"
      provides: "Operator-run residual-PII verifier (ADC)"
      contains: "DOCUMENT_AUTHOR_FIELDS"
    - path: "src/cloud/gdpr.js"
      provides: "Browser seam: eraseUser body fills"
      contains: "gdprEraseUser"
  key_links:
    - from: "functions/src/gdpr/gdprEraseUser.ts"
      to: "messages/comments/actions/documents/funnelComments + users/{uid} + Auth"
      via: "Admin SDK paginated batched writes (500-op batch limit)"
      pattern: "BulkWriter"
    - from: "functions/src/gdpr/gdprEraseUser.ts"
      to: "redactionList/{userId}"
      via: "db.doc(`redactionList/${uid}`).set(...)"
      pattern: "redactionList"
    - from: "functions/src/gdpr/gdprEraseUser.ts"
      to: "auditLog (compliance.erase.user — single summary event)"
      via: "writeAuditEvent — Pitfall 7 mitigation, NOT per-doc"
      pattern: "compliance.erase.user"
    - from: "scripts/post-erasure-audit/run.js"
      to: "All collections holding user references"
      via: "Same collectionGroup queries as gdprExportUser bundle assembly"
      pattern: "collectionGroup"
---

<objective>
Land GDPR-02/03/04/05: an admin-only callable that pseudonymises every reference to a user across the entire data model in an idempotent, auditable cascade. Decompose into a pure pseudonym-token helper + a pure cascade-builder + the callable shell. Add the `redactionList/{uid}` collection (rules + write) and the post-erasure audit script that proves zero residual PII. Close the Phase 4 src/cloud/gdpr.js stub seam.

Purpose: GDPR Art. 17 right to erasure is the highest-stakes operation in the milestone — it's destructive, cascading, and irreversible. The deterministic-token strategy makes it idempotent (Pitfall C). The audit-log retention with PII tombstoning resolves the GDPR-vs-audit conflict (Pitfall 11). The redactionList feeds the backup-rotation re-redaction script (GDPR-05).

This is the wave that requires the GDPR_PSEUDONYM_SECRET in Secret Manager and a separate gdpr-writer-sa with broader write IAM than gdpr-reader-sa.

Output: 3 new TS modules + 4 test files + rules update + 1 rules-test file + post-erasure script + browser seam fill + 1 operator checkpoint for secret + SA provisioning.
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
@functions/src/gdpr/gdprExportUser.ts
@functions/src/gdpr/assembleUserBundle.ts
@functions/src/audit/auditLogger.ts
@functions/src/audit/auditEventSchema.ts
@functions/src/lifecycle/softDelete.ts
@functions/src/util/idempotency.ts
@src/cloud/gdpr.js
@tests/rules/setup.js
@tests/rules/auditLog.test.js

<interfaces>
<!-- Same collection list as the export bundle (08-04 Task 0 closure). -->

Author/owner field map (verified Task 0 of 08-04):
- /users/{uid}                              → THIS IS the user doc; redact email + name + displayName + photoURL + avatar; preserve uid
- /orgs/{orgId}/messages/{msgId}           → authorId + legacyAuthorId
- /orgs/{orgId}/comments/{cmtId}           → authorId + legacyAuthorId
- /orgs/{orgId}/actions/{actId}            → ownerId + legacyAppUserId
- /orgs/{orgId}/documents/{docId}          → uploaderId + uploadedBy + legacyAppUserId (subcollection — Phase 5 path)
- /documents/{docId}                       → uploaderId + uploaderName + uploaderEmail + legacyAppUserId (legacy top-level — main.js path)
- /funnelComments/{id}                     → authorId
- /auditLog/{eventId} where actor.uid==uid → tombstone actor.email + payload PII; KEEP the doc

From functions/src/gdpr/assembleUserBundle.ts (08-04 just authored):
- DOCUMENT_AUTHOR_FIELDS = ["uploaderId", "uploadedBy", "legacyAppUserId"] as const
- Reuse this constant verbatim — single source of truth for author-field enumeration

From functions/src/audit/auditEventSchema.ts:
- "compliance.erase.user" enum value already present — reuse

From functions/src/audit/auditLogger.ts:
- writeAuditEvent(input, ctx): Promise<AuditLogDoc>

Storage layout for documents (per storage.rules):
- gs://bedeveloped-base-layers-uploads/orgs/{orgId}/documents/{docId}/{filename}
- The Firestore documents row contains the storage `path` field; Storage object enumeration uses bucket.getFiles({prefix: "orgs/"}) filtered by metadata or by the docs array we collected from Firestore

Pitfall 11 (audit log retention):
- auditLog entries where actor.uid==<erased uid> MUST NOT be deleted (legitimate interest under Art. 6(1)(f))
- BUT actor.email + actor.role + payload PII fields MUST be tombstoned to the pseudonym
- The audit row's actor.uid IS replaced with the tombstone token (treated as an identifier)
- Result: auditLog rows are preserved as opaque events without identifying the data subject

Pitfall 7 mitigation for bulk delete cascades:
- A naive per-doc audit event for every cascade write would invoke the onDocumentDelete mirror trigger thousands of times
- Mitigation: write a SINGLE compliance.erase.user audit event with a counts payload; do NOT delete the underlying docs (we update them, not delete) so onDocumentDelete is NOT triggered

From firestore.rules (Wave 4 ADDS):
- New top-level collection: redactionList/{userId}
  - allow read:  if isAdmin();
  - allow write: if false;     // server-only via gdprEraseUser callable
- The match block goes alongside the existing softDeleted/{type}/items/{id} block (line ~138)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Author functions/src/gdpr/pseudonymToken.ts pure helper + unit tests</name>
  <read_first>
    - 08-RESEARCH.md §Pattern 9 (pseudonym token strategy — verbatim implementation)
    - .planning/research/PITFALLS.md §11 (deterministic-token rationale)
    - functions/src/gdpr/assembleUserBundle.ts (Pattern C purity precedent)
  </read_first>
  <behavior>
    - Test 1: tombstoneTokenForUser("u-123", "secret-A") === tombstoneTokenForUser("u-123", "secret-A") (deterministic)
    - Test 2: tombstoneTokenForUser("u-123", "secret-A") !== tombstoneTokenForUser("u-123", "secret-B") (secret-keyed)
    - Test 3: tombstoneTokenForUser("u-123", "secret-A") !== tombstoneTokenForUser("u-456", "secret-A") (uid-discriminated)
    - Test 4: returned token starts with "deleted-user-" and is 30 chars total (prefix 13 + 16 hex chars + 1 separator? — actually `deleted-user-` is 13 chars + 16 hex = 29; verify exact length contract)
    - Test 5: empty secret throws Error (defense — accidental deploy without GDPR_PSEUDONYM_SECRET set)
    - Test 6: empty uid throws Error
  </behavior>
  <files>functions/src/gdpr/pseudonymToken.ts, functions/test/gdpr/pseudonymToken.unit.test.ts</files>
  <action>
    Create `functions/src/gdpr/pseudonymToken.ts`:

    ```typescript
    // Phase 8 Wave 4 (GDPR-02 / Pitfall C / Pattern C purity): deterministic
    // pseudonym token. sha256(uid + secret) → 16-char hex slice prefixed
    // `deleted-user-`. Idempotent: same uid + secret always yields same token,
    // so a crashed-and-restarted erasure writes the same token to every
    // collection (no orphaned mixed-token references).
    //
    // The 16-char (8-byte) hex slice gives ~2^64 search space — sufficient to
    // collision-resist within any single project's user population (≤ 2^32).
    // Prefix `deleted-user-` makes tombstones grep-able.
    //
    // Pure helper — imports node:crypto only. NEVER imports firebase-admin.

    import { createHash } from "node:crypto";

    export const TOMBSTONE_PREFIX = "deleted-user-" as const;
    export const TOMBSTONE_HEX_LENGTH = 16 as const;

    /** Total token length: 13 (prefix) + 16 (hex) = 29 chars. */
    export const TOMBSTONE_TOKEN_LENGTH = TOMBSTONE_PREFIX.length + TOMBSTONE_HEX_LENGTH;

    /**
     * Compute the deterministic tombstone token for a user.
     *
     * @throws Error if uid or secret is empty
     */
    export function tombstoneTokenForUser(uid: string, secret: string): string {
      if (!uid) throw new Error("tombstoneTokenForUser: uid required");
      if (!secret) throw new Error("tombstoneTokenForUser: secret required (GDPR_PSEUDONYM_SECRET)");
      const hex = createHash("sha256").update(uid + secret).digest("hex").slice(0, TOMBSTONE_HEX_LENGTH);
      return TOMBSTONE_PREFIX + hex;
    }

    /** Test: is `value` shaped like a tombstone token? Used by post-erasure audit. */
    export function isTombstoneToken(value: unknown): value is string {
      return typeof value === "string" && value.length === TOMBSTONE_TOKEN_LENGTH && value.startsWith(TOMBSTONE_PREFIX);
    }
    ```

    Test file `functions/test/gdpr/pseudonymToken.unit.test.ts` — pure tests, no vi.mock:
    - Cover the 6 behaviours
    - Add Test 7: isTombstoneToken("deleted-user-abc123def456ab") === true; isTombstoneToken("deleted-user-short") === false; isTombstoneToken(null) === false
  </action>
  <verify>
    <automated>cd functions && npm test -- pseudonymToken 2>&1 | tail -15</automated>
  </verify>
  <done>
    - `functions/src/gdpr/pseudonymToken.ts` exists; only import is `node:crypto` (verified by `grep -E "^import" functions/src/gdpr/pseudonymToken.ts | grep -v "node:" | wc -l` == 0)
    - `functions/test/gdpr/pseudonymToken.unit.test.ts` ≥ 7 tests, all pass
    - TOMBSTONE_TOKEN_LENGTH constant equals 29; verified by Test 4 in the test file
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Author functions/src/gdpr/eraseCascade.ts pure helper + unit tests</name>
  <read_first>
    - 08-RESEARCH.md §Pattern 9 (cascade — list of fields per collection)
    - functions/src/gdpr/pseudonymToken.ts (just authored — TOMBSTONE_PREFIX)
    - functions/src/gdpr/assembleUserBundle.ts (DOCUMENT_AUTHOR_FIELDS reuse)
    - 08-RESEARCH.md §Common Pitfalls C (deterministic token + Pitfall 11 audit handling)
  </read_first>
  <behavior>
    - Test 1: buildCascadeOps for a doc at "orgs/orgA/messages/m1" with {authorId:"u1", legacyAuthorId:"u1", body:"hi"} + token "deleted-user-X" returns one op { type: "update", path:"orgs/orgA/messages/m1", patch: { authorId:"deleted-user-X", legacyAuthorId:"deleted-user-X" } } (body left intact — content tombstoning is a separate concern; per ICO guidance, content authored by the user is "their data" and remains under the legitimate-interest carve-out IF accompanied by pseudonymisation of the author identifier)
    - Test 2: for a doc at "orgs/orgA/documents/d1" with {uploaderId:"u1", uploadedBy:"u1", legacyAppUserId:"u1", path:"orgs/orgA/documents/d1/x.pdf"} returns one op with all 3 author fields tombstoned
    - Test 3: for a users/u1 doc with {email:"a@b.com", name:"A", displayName:"A B", photoURL:"https://...", avatar:"data:..."} returns one op { type:"update", path:"users/u1", patch: { email:null, name:null, displayName:null, photoURL:null, avatar:null, erasedAt:<sentinel>, erasedTo:"deleted-user-X" } }
    - Test 4: for an auditLog entry with actor.uid==u1 and actor.email+payload.email returns one op { type:"update", path:"auditLog/<id>", patch: { "actor.uid":"deleted-user-X", "actor.email":null, "payload.email":null } } — preserves the audit doc; tombstones PII (Pitfall 11)
    - Test 5: for an auditLog entry with actor.uid !== u1 returns no op (not the user's audit row)
    - Test 6: aggregate count — given a mixed input of 1 user doc + 12 messages + 5 comments + 3 documents + 4 audit events about user, returns 25 ops (1 + 12 + 5 + 3 + 4)
    - Test 7: chunkOpsForBatchedWrite splits 1247 ops into 3 batches: 500, 500, 247 (Firestore batched-write limit per 08-RESEARCH.md)
  </behavior>
  <files>functions/src/gdpr/eraseCascade.ts, functions/test/gdpr/eraseCascade.unit.test.ts</files>
  <action>
    Create `functions/src/gdpr/eraseCascade.ts`:

    ```typescript
    // Phase 8 Wave 4 (GDPR-02 / GDPR-03 / GDPR-04 / Pitfall 11):
    // pure cascade builder — maps query results into a list of Firestore
    // batched-write operations that pseudonymise all references to a user.
    // Pattern C purity: no firebase-admin import. Test seam = the ops list.
    //
    // Per-collection patch map (Pitfall 11 + Wave 4 contract):
    //   users/{uid}              → email/name/displayName/photoURL/avatar = null;
    //                              erasedAt = sentinel; erasedTo = token
    //   orgs/*/messages/{id}     → authorId, legacyAuthorId = token
    //   orgs/*/comments/{id}     → authorId, legacyAuthorId = token
    //   orgs/*/actions/{id}      → ownerId, legacyAppUserId = token
    //   orgs/*/documents/{id}    → uploaderId, uploadedBy, legacyAppUserId = token
    //   documents/{id} (legacy)  → same 3 fields + uploaderName=null + uploaderEmail=null
    //   funnelComments/{id}      → authorId = token
    //   auditLog/{id}            → actor.uid = token; actor.email = null;
    //                              payload.email = null (Pitfall 11 PII tombstone;
    //                              audit doc PRESERVED for legit-interest)
    //
    // The "content" of authored items (message body, comment body, document file)
    // is intentionally NOT redacted — that data belongs to the org/user-collective
    // and remains under the legitimate-interest carve-out post-pseudonymisation.

    import { TOMBSTONE_PREFIX } from "./pseudonymToken.js";
    import { DOCUMENT_AUTHOR_FIELDS } from "./assembleUserBundle.js";

    export const FIRESTORE_BATCH_LIMIT = 500 as const;

    export interface CascadeOp {
      type: "update";
      path: string;
      patch: Record<string, unknown>;
    }

    export interface InputDoc {
      path: string;
      data: Record<string, unknown>;
    }

    /** Symbol the caller substitutes with FieldValue.serverTimestamp() at write time. */
    export const ERASED_AT_SENTINEL = "__ERASED_AT__" as const;

    /**
     * Build the cascade ops list from query results pre-fetched by gdprEraseUser.
     */
    export function buildCascadeOps(
      userId: string,
      token: string,
      inputs: {
        userDoc: InputDoc | null;
        messages: InputDoc[];
        comments: InputDoc[];
        actions: InputDoc[];
        documentsSubcoll: InputDoc[];
        documentsLegacy: InputDoc[];
        funnelComments: InputDoc[];
        auditEvents: InputDoc[];
      },
    ): CascadeOp[] {
      const ops: CascadeOp[] = [];

      if (inputs.userDoc) {
        ops.push({
          type: "update",
          path: inputs.userDoc.path,
          patch: {
            email: null,
            name: null,
            displayName: null,
            photoURL: null,
            avatar: null,
            erasedAt: ERASED_AT_SENTINEL,
            erasedTo: token,
          },
        });
      }

      for (const m of inputs.messages) {
        ops.push({ type: "update", path: m.path, patch: { authorId: token, legacyAuthorId: token } });
      }
      for (const c of inputs.comments) {
        ops.push({ type: "update", path: c.path, patch: { authorId: token, legacyAuthorId: token } });
      }
      for (const a of inputs.actions) {
        ops.push({ type: "update", path: a.path, patch: { ownerId: token, legacyAppUserId: token } });
      }
      for (const d of inputs.documentsSubcoll) {
        const patch: Record<string, unknown> = {};
        for (const f of DOCUMENT_AUTHOR_FIELDS) patch[f] = token;
        ops.push({ type: "update", path: d.path, patch });
      }
      for (const d of inputs.documentsLegacy) {
        const patch: Record<string, unknown> = {};
        for (const f of DOCUMENT_AUTHOR_FIELDS) patch[f] = token;
        patch.uploaderName = null;
        patch.uploaderEmail = null;
        ops.push({ type: "update", path: d.path, patch });
      }
      for (const fc of inputs.funnelComments) {
        ops.push({ type: "update", path: fc.path, patch: { authorId: token } });
      }
      for (const ev of inputs.auditEvents) {
        const actor = ev.data.actor as Record<string, unknown> | undefined;
        if (!actor || actor.uid !== userId) continue;  // defensive
        ops.push({
          type: "update",
          path: ev.path,
          patch: {
            "actor.uid": token,
            "actor.email": null,
            "payload.email": null,
          },
        });
      }

      return ops;
    }

    /**
     * Split a flat ops list into batches of at most FIRESTORE_BATCH_LIMIT
     * operations per batch (Firestore Admin SDK batched-write cap).
     */
    export function chunkOpsForBatchedWrite(ops: CascadeOp[]): CascadeOp[][] {
      const out: CascadeOp[][] = [];
      for (let i = 0; i < ops.length; i += FIRESTORE_BATCH_LIMIT) {
        out.push(ops.slice(i, i + FIRESTORE_BATCH_LIMIT));
      }
      return out;
    }
    ```

    Test file `functions/test/gdpr/eraseCascade.unit.test.ts` — pure tests covering the 7 behaviours above.
  </action>
  <verify>
    <automated>cd functions && npm test -- eraseCascade 2>&1 | tail -20</automated>
  </verify>
  <done>
    - `functions/src/gdpr/eraseCascade.ts` exists; imports only pseudonymToken.js + assembleUserBundle.js (no firebase-admin)
    - 7 unit tests pass; chunkOpsForBatchedWrite split test pins the 500-op limit
    - `cd functions && npm run typecheck` exits 0
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Author functions/src/gdpr/gdprEraseUser.ts callable + unit + integration tests</name>
  <read_first>
    - functions/src/gdpr/gdprExportUser.ts (Pattern A reference + collection-group query layout — verbatim adapt)
    - functions/src/gdpr/pseudonymToken.ts + eraseCascade.ts (just authored)
    - functions/src/audit/auditLogger.ts (writeAuditEvent — single summary call per Pitfall 7)
    - 08-RESEARCH.md §Pattern 9 (full erasure cascade pattern)
    - .planning/research/PITFALLS.md §11 (audit retention vs erasure)
  </read_first>
  <behavior>
    - Test 1 (unit): non-admin → permission-denied
    - Test 2 (unit): unauthenticated → unauthenticated
    - Test 3 (unit): missing GDPR_PSEUDONYM_SECRET → throws (caught by ensureIdempotent OR raises HttpsError("internal", ...))
    - Test 4 (unit): happy path: admin caller, userId="u-target" with seeded user doc + 2 messages + 1 audit event → all updates applied with the same token; redactionList/u-target written; users/{uid} email/name set to null; one compliance.erase.user audit event written with counts:{messages:2, ...}
    - Test 5 (unit): idempotent re-run with same clientReqId within 5min → already-exists; with new clientReqId → re-runs and writes the SAME token (deterministic)
    - Test 6 (unit): Auth user updateUser({disabled:true}) called once for the target uid
    - Test 7 (unit): Storage object enumeration — given 2 seeded Storage objects at `orgs/orgA/documents/d1/x.pdf` and `orgs/orgA/documents/d2/y.pdf` whose Firestore rows have `uploadedBy=u-target`, after invocation `adminMockState._allStorageObjects()` no longer contains either; counts.storageObjectsDeleted === 2; counts.storageObjectsMissing === 0
    - Test 8 (unit): Storage object missing tolerance — given a Firestore document row whose Storage object does NOT exist (never uploaded / already deleted), the cascade does NOT throw; counts.storageObjectsMissing increments
    - Test 9 (integration via firebase-functions-test wrap): full happy-path round-trip — verifies the redactionList doc shape + audit-event row shape (counts payload includes storageObjectsDeleted/storageObjectsMissing)
  </behavior>
  <files>functions/src/gdpr/gdprEraseUser.ts, functions/test/gdpr/gdprEraseUser.unit.test.ts, functions/test/integration/gdprEraseUser.integration.test.ts</files>
  <action>
    Create `functions/src/gdpr/gdprEraseUser.ts` mirroring gdprExportUser.ts shape:

    ```typescript
    // Phase 8 Wave 4 (GDPR-02 / GDPR-03 / GDPR-04 / GDPR-05 / FN-03 / FN-04
    // / FN-05 / FN-07 / Pitfall 11): admin-only callable that pseudonymises
    // every reference to a user and writes an entry to redactionList for
    // backup-rotation propagation.
    //
    // Service account: gdpr-writer-sa (broader IAM than gdpr-reader-sa —
    // datastore.user + firebaseauth.admin + storage.objectAdmin scoped to
    // uploads bucket). Operator provisions per 08-06 close-gate.
    //
    // Secret: GDPR_PSEUDONYM_SECRET via defineSecret. MUST be set in Firebase
    // Secret Manager BEFORE first deploy/invocation; otherwise the pure
    // tombstoneTokenForUser helper throws "secret required".
    //
    // Audit event: SINGLE compliance.erase.user summary event with counts
    // payload (Pitfall 7 — never per-doc).

    import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
    import { logger } from "firebase-functions/logger";
    import { defineSecret } from "firebase-functions/params";
    import { initializeApp, getApps } from "firebase-admin/app";
    import { getFirestore, FieldValue } from "firebase-admin/firestore";
    import { getAuth } from "firebase-admin/auth";
    import { getStorage } from "firebase-admin/storage";
    import { randomUUID } from "node:crypto";
    import { z } from "zod";
    import { withSentry } from "../util/sentry.js";
    import { validateInput } from "../util/zod-helpers.js";
    import { ensureIdempotent } from "../util/idempotency.js";
    import { writeAuditEvent } from "../audit/auditLogger.js";
    import { tombstoneTokenForUser } from "./pseudonymToken.js";
    import { DOCUMENT_AUTHOR_FIELDS } from "./assembleUserBundle.js";
    import { buildCascadeOps, chunkOpsForBatchedWrite, ERASED_AT_SENTINEL, type InputDoc } from "./eraseCascade.js";

    if (!getApps().length) initializeApp();
    const SENTRY_DSN = defineSecret("SENTRY_DSN");
    const GDPR_PSEUDONYM_SECRET = defineSecret("GDPR_PSEUDONYM_SECRET");

    const GdprEraseInput = z.object({
      userId: z.string().min(1).max(128),
      clientReqId: z.string().uuid(),
    });

    export const gdprEraseUser = onCall(
      {
        region: "europe-west2",
        enforceAppCheck: true,
        serviceAccount: "gdpr-writer-sa",
        secrets: [SENTRY_DSN, GDPR_PSEUDONYM_SECRET],
        memory: "1GiB",      // larger than export — cascade may aggregate thousands of ops
        timeoutSeconds: 540,
      },
      withSentry(async (request: CallableRequest<unknown>) => {
        if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
        const token = (request.auth.token ?? {}) as Record<string, unknown>;
        if (token.role !== "admin") throw new HttpsError("permission-denied", "admin role required");

        const data = validateInput(GdprEraseInput, request.data ?? {});
        const userId = data.userId;
        await ensureIdempotent(
          `gdprEraseUser:${request.auth.uid}:${userId}:${data.clientReqId}`,
          "gdprEraseUser",
          5 * 60,
        );

        const tombstone = tombstoneTokenForUser(userId, GDPR_PSEUDONYM_SECRET.value());
        const db = getFirestore();

        // Pre-fetch (mirrors gdprExportUser query layout).
        const [
          profileSnap, auditSnap,
          messagesSnap, commentsSnap, actionsSnap, funnelCommentsSnap,
          ...documentsSnaps
        ] = await Promise.all([
          db.doc(`users/${userId}`).get(),
          db.collection("auditLog").where("actor.uid", "==", userId).get(),
          db.collectionGroup("messages").where("authorId", "==", userId).get(),
          db.collectionGroup("comments").where("authorId", "==", userId).get(),
          db.collectionGroup("actions").where("ownerId", "==", userId).get(),
          db.collection("funnelComments").where("authorId", "==", userId).get(),
          ...DOCUMENT_AUTHOR_FIELDS.map((f) => db.collectionGroup("documents").where(f, "==", userId).get()),
        ]);

        const legacyDocsSnaps = await Promise.all(
          DOCUMENT_AUTHOR_FIELDS.map((f) => db.collection("documents").where(f, "==", userId).get()),
        );

        const toInput = (snap: FirebaseFirestore.QuerySnapshot): InputDoc[] =>
          snap.docs.map((d) => ({ path: d.ref.path, data: d.data() ?? {} }));

        // De-dupe documents by path across the 3 field queries.
        const docsByPath = new Map<string, InputDoc>();
        for (const s of documentsSnaps) for (const d of toInput(s)) if (!docsByPath.has(d.path)) docsByPath.set(d.path, d);
        const legacyByPath = new Map<string, InputDoc>();
        for (const s of legacyDocsSnaps) for (const d of toInput(s)) if (!legacyByPath.has(d.path)) legacyByPath.set(d.path, d);

        const ops = buildCascadeOps(userId, tombstone, {
          userDoc: profileSnap.exists ? { path: profileSnap.ref.path, data: profileSnap.data() ?? {} } : null,
          messages: toInput(messagesSnap),
          comments: toInput(commentsSnap),
          actions: toInput(actionsSnap),
          documentsSubcoll: [...docsByPath.values()],
          documentsLegacy: [...legacyByPath.values()],
          funnelComments: toInput(funnelCommentsSnap),
          auditEvents: toInput(auditSnap),
        });

        // Write ops in 500-batch chunks. Substitute ERASED_AT_SENTINEL with FieldValue.serverTimestamp().
        const chunks = chunkOpsForBatchedWrite(ops);
        for (const chunk of chunks) {
          const batch = db.batch();
          for (const op of chunk) {
            const ref = db.doc(op.path);
            const patch: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(op.patch)) {
              patch[k] = v === ERASED_AT_SENTINEL ? FieldValue.serverTimestamp() : v;
            }
            batch.update(ref, patch);
          }
          await batch.commit();
        }

        // Disable Auth user (idempotent — repeated disable is no-op).
        try {
          await getAuth().updateUser(userId, { disabled: true });
        } catch (err) {
          // user-not-found is acceptable (the Firestore profile may exist
          // for a uid the Auth tier no longer recognises). Log and continue.
          logger.warn("compliance.erase.auth.user_not_found", { userId, err: (err as Error).message });
        }

        // GDPR-03 Storage object enumeration — after Firestore tombstoning,
        // delete the underlying Storage objects for all user-uploaded documents.
        // For each tombstoned documents row, derive the Storage path:
        //   orgs/{orgId}/documents/{docId}/{filename}
        // and delete via the Admin SDK. Wrap each delete in try/catch so a
        // missing object (already deleted, or never uploaded) does not abort
        // the cascade.
        let storageObjectsDeleted = 0;
        let storageObjectsMissing = 0;
        const storage = getStorage();
        const uploadsBucket = storage.bucket("bedeveloped-base-layers-uploads");
        const allDocRows = [...docsByPath.values(), ...legacyByPath.values()];
        for (const docRow of allDocRows) {
          const data = docRow.data as Record<string, unknown>;
          // Derive path components: orgId from the doc ref path or data,
          // docId is the trailing segment, filename is data.filename or data.name.
          const segs = docRow.path.split("/");
          // Subcollection: orgs/{orgId}/documents/{docId}; legacy: documents/{docId}
          const isSubcoll = segs.length === 4 && segs[0] === "orgs" && segs[2] === "documents";
          const isLegacy = segs.length === 2 && segs[0] === "documents";
          const orgId = isSubcoll ? segs[1] : (typeof data.orgId === "string" ? data.orgId : null);
          const docId = isSubcoll ? segs[3] : (isLegacy ? segs[1] : null);
          const filename = typeof data.filename === "string" ? data.filename
                         : typeof data.name === "string" ? data.name
                         : typeof data.path === "string" ? data.path.split("/").pop() ?? null
                         : null;
          if (!orgId || !docId || !filename) {
            logger.warn("compliance.erase.storage.path_underivable", { docPath: docRow.path });
            continue;
          }
          const storagePath = `orgs/${orgId}/documents/${docId}/${filename}`;
          try {
            await uploadsBucket.file(storagePath).delete();
            storageObjectsDeleted += 1;
          } catch (err) {
            // 404 / not-found is acceptable (already deleted, never uploaded,
            // or path mismatch from legacy data). Log + continue.
            const msg = (err as Error).message ?? String(err);
            if (/not.*found|404|no such object/i.test(msg)) {
              storageObjectsMissing += 1;
            } else {
              logger.warn("compliance.erase.storage.delete_failed", { storagePath, err: msg });
            }
          }
        }

        // redactionList/{userId} — backup rotation cycle reads this and
        // re-applies tombstones on restored data.
        await db.doc(`redactionList/${userId}`).set({
          tombstoneToken: tombstone,
          erasedAt: FieldValue.serverTimestamp(),
          erasedBy: request.auth.uid,
          schemaVersion: 1,
        });

        // Single summary audit event (Pitfall 7).
        const eventId = randomUUID();
        const counts = {
          messages: messagesSnap.size,
          comments: commentsSnap.size,
          actions: actionsSnap.size,
          documentsSubcoll: docsByPath.size,
          documentsLegacy: legacyByPath.size,
          funnelComments: funnelCommentsSnap.size,
          auditEvents: auditSnap.size,
          storageObjectsDeleted,
          storageObjectsMissing,
          totalOps: ops.length,
        };
        await writeAuditEvent(
          {
            type: "compliance.erase.user",
            severity: "alert",
            target: { type: "user", id: userId, orgId: null },
            clientReqId: data.clientReqId,
            payload: { tombstoneToken: tombstone, counts },
          },
          {
            now: Date.now(),
            eventId,
            actor: {
              uid: request.auth.uid,
              email: typeof token.email === "string" ? token.email : null,
              role: "admin",
              orgId: typeof token.orgId === "string" ? token.orgId : null,
            },
            ip: null,
            userAgent: null,
            idempotencyKey: `compliance.erase.user:${request.auth.uid}:${userId}:${data.clientReqId}`,
          },
        );

        logger.warn("compliance.gdprEraseUser", { actorUid: request.auth.uid, targetUserId: userId, totalOps: ops.length });
        return { ok: true, tombstoneToken: tombstone, counts };
      }),
    );
    ```

    Test files:
    - `functions/test/gdpr/gdprEraseUser.unit.test.ts` — covers behaviours 1-6. vi.mock layout includes `firebase-admin/auth` (mock setCustomUserClaims is already in admin-sdk.ts — extend to add `updateUser(uid, {disabled})` no-op tracker if not present). Mock `defineSecret("GDPR_PSEUDONYM_SECRET")` to return `{ value: () => "test-secret-value" }`.
    - `functions/test/integration/gdprEraseUser.integration.test.ts` — covers behaviour 7 with full firebase-functions-test wrap; assert redactionList doc + audit event row exist post-call.
  </action>
  <verify>
    <automated>cd functions && npm test -- gdpr 2>&1 | tail -25</automated>
  </verify>
  <done>
    - `functions/src/gdpr/gdprEraseUser.ts` exists with the exact onCall config (`secrets: [SENTRY_DSN, GDPR_PSEUDONYM_SECRET]`, `serviceAccount:"gdpr-writer-sa"`, `memory:"1GiB"`)
    - The single writeAuditEvent invocation uses type:"compliance.erase.user" and the counts payload (verified by grep)
    - Auth disable call uses `getAuth().updateUser(userId, { disabled: true })` (verified by grep)
    - 7+ tests across the 3 test files all pass
    - `cd functions && npm test` exits 0; total test count includes ≥ 7+7+1 from this task = 15+ over 08-04 baseline
  </done>
</task>

<task type="auto">
  <name>Task 4: Add redactionList/{userId} match block to firestore.rules + tests/rules/redaction-list.test.js</name>
  <read_first>
    - firestore.rules (existing softDeleted/{type}/items/{id} block at line ~138 — mirror its structure)
    - tests/rules/setup.js (ROLES + asUser)
    - tests/rules/auditLog.test.js (admin-read-only collection precedent)
  </read_first>
  <files>firestore.rules, tests/rules/redaction-list.test.js</files>
  <action>
    1. **`firestore.rules`** — add immediately AFTER the `match /softDeleted/{type}/items/{id}` block (line ~138), BEFORE the rateLimits block:
       ```
       // ── redactionList/{userId} (GDPR-05 — Phase 8 Wave 4) ────────────
       // Server-only writes via gdprEraseUser callable; admin-readable so
       // backup-rotation scripts (BACKUP-07 restore drill) can re-apply
       // tombstone tokens after database restore. Pitfall 17 — never client-writable.
       match /redactionList/{userId} {
         allow read:  if isAdmin();
         allow write: if false;
       }
       ```

    2. **`tests/rules/redaction-list.test.js`** — new file mirroring `tests/rules/auditLog.test.js` structure (admin read-allow + all other roles read-deny + all roles write-deny):
       ```javascript
       // tests/rules/redaction-list.test.js
       // @ts-check
       // Phase 8 Wave 4 (GDPR-05): redactionList/{userId} access matrix.
       import { doc, getDoc, setDoc } from "firebase/firestore";
       import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
       import { initRulesEnv, asUser, ROLES, assertSucceeds, assertFails } from "./setup.js";

       let testEnv;
       const claimsByRole = Object.fromEntries(ROLES.map((r) => [r.role, r.claims]));

       beforeAll(async () => { testEnv = await initRulesEnv("firestore", "redaction-list"); });
       afterAll(async () => { if (testEnv) await testEnv.cleanup(); });

       beforeEach(async () => {
         await testEnv.clearFirestore();
         await testEnv.withSecurityRulesDisabled(async (ctx) => {
           const db = ctx.firestore();
           await setDoc(doc(db, "redactionList/u-target"), {
             tombstoneToken: "deleted-user-abc123def4567890",
             erasedAt: new Date(),
             erasedBy: "admin-uid",
             schemaVersion: 1,
           });
         });
       });

       describe("redactionList/{userId} (Phase 8 Wave 4)", () => {
         for (const role of ["anonymous", "client_orgA", "client_orgB", "internal"]) {
           it(`${role} cannot read - deny`, async () => {
             const db = asUser(testEnv, role, claimsByRole[role] || {});
             await assertFails(getDoc(doc(db, "redactionList/u-target")));
           });
           it(`${role} cannot write - deny`, async () => {
             const db = asUser(testEnv, role, claimsByRole[role] || {});
             await assertFails(setDoc(doc(db, "redactionList/u-target"), { tombstoneToken: "x" }));
           });
         }
         it("admin reads - allow", async () => {
           const db = asUser(testEnv, "admin", claimsByRole.admin);
           await assertSucceeds(getDoc(doc(db, "redactionList/u-target")));
         });
         it("admin writes - DENY (server-only via Cloud Function)", async () => {
           const db = asUser(testEnv, "admin", claimsByRole.admin);
           await assertFails(setDoc(doc(db, "redactionList/u-target"), { tombstoneToken: "x" }));
         });
       });
       ```

    Total tests: 4 roles × 2 ops + 2 admin = 10 tests. All must pass when emulator runs.
  </action>
  <verify>
    <automated>npm test -- tests/rules/redaction-list 2>&1 | tail -15</automated>
  </verify>
  <done>
    - `firestore.rules` has new `match /redactionList/{userId}` block with `allow read: if isAdmin(); allow write: if false;`
    - `tests/rules/redaction-list.test.js` has ≥ 10 tests; all pass against emulator
    - No other rules changes (verified by `git diff firestore.rules` — only the redactionList block added)
  </done>
</task>

<task type="auto">
  <name>Task 5: Author scripts/post-erasure-audit/run.js + README (GDPR-03 evidence script)</name>
  <read_first>
    - scripts/enable-bigquery-audit-sink/run.js (Pattern F precedent — ADC + spawnSync + idempotent)
    - functions/src/gdpr/assembleUserBundle.ts (DOCUMENT_AUTHOR_FIELDS — reuse the same constant)
    - functions/src/gdpr/pseudonymToken.ts (TOMBSTONE_PREFIX + isTombstoneToken)
    - 08-RESEARCH.md §Wave 0 Gaps (post-erasure audit script entry — verifies zero residual PII)
  </read_first>
  <files>scripts/post-erasure-audit/run.js, scripts/post-erasure-audit/README.md</files>
  <action>
    Create `scripts/post-erasure-audit/run.js` — Node 22 ESM ADC script (NOT a Cloud Function — operator-run with ADC):

    Header banner mirrors `scripts/enable-bigquery-audit-sink/run.js` lines 1-52: phase tag (Phase 8 Wave 4 GDPR-03), Pattern F reference, ADC requirement, idempotent (read-only — no mutations), exit codes.

    Args: `--uid=<userId>` (required), `--project=<id>` (override default), `--help`/`-h`. The script needs `firebase-admin` available — but functions/ has it; the script can do a relative import or use a separate top-level `node_modules`. Easiest path: the script lives in scripts/ but imports `firebase-admin` via `node_modules/firebase-admin` resolved from the repo root. Confirm by checking if the repo root's node_modules has firebase-admin (Phase 7 may have hoisted it). If NOT, the script's README requires `npm install firebase-admin` from the repo root before running.

    Logic:
    1. Validate args; print help if missing --uid or --help.
    2. `await import("firebase-admin/app")` + `initializeApp()` using ADC (no service-account JSON — Pitfall 13).
    3. `const db = getFirestore()` + `const auth = getAuth()`.
    4. Run the same query layout as gdprEraseUser:
       - users/{uid}.get() — verify `email`, `name`, `displayName`, `photoURL`, `avatar` are ALL null; `erasedAt` is set; `erasedTo` matches isTombstoneToken
       - auditLog where actor.uid == uid → verify EVERY result's `actor.uid` is a tombstone token (per Pitfall 11 — these docs MUST exist; only the PII fields are tombstoned)
       - collectionGroup("messages") + ("comments") + ("actions") + ("documents") + collection("documents") + collection("funnelComments") with each author-field == uid → MUST return zero docs (post-tombstoning, the author field IS the tombstone, NOT the original uid)
       - redactionList/{uid}.get() — verify exists with `tombstoneToken`, `erasedAt`, `erasedBy` fields
       - auth.getUser(uid) → verify `disabled === true` (or user not found, also acceptable)
    5. Print findings table:
       ```
       USER ERASURE AUDIT — uid=<uid>
       ----------------------------------------
       users/{uid}                  PASS   email=null, name=null, erasedTo=deleted-user-...
       auditLog (about user)        PASS   12 docs, all tombstoned
       messages.authorId == uid     PASS   0 hits
       comments.authorId == uid     PASS   0 hits
       actions.ownerId == uid       PASS   0 hits
       documents.uploaderId == uid  PASS   0 hits
       documents.uploadedBy == uid  PASS   0 hits
       documents.legacyAppUserId    PASS   0 hits
       funnelComments.authorId      PASS   0 hits
       redactionList/{uid}          PASS   exists, tombstoneToken=deleted-user-...
       Auth user.disabled           PASS   (or user-not-found)
       ----------------------------------------
       RESULT: PASS (zero residual PII)
       ```
    6. Exit 0 if all PASS; exit 1 if any FAIL with the residual paths printed.

    `scripts/post-erasure-audit/README.md` — 30-60 lines. Prerequisites (`gcloud auth application-default login` + `cd <repo-root> && npm install firebase-admin@13.9.0` if not already), usage (`node scripts/post-erasure-audit/run.js --uid=<userId>`), expected output (sample PASS table), troubleshooting (FAIL = re-run gdprEraseUser with same userId — deterministic token guarantees idempotent re-cascade).
  </action>
  <verify>
    <automated>node scripts/post-erasure-audit/run.js --help 2>&1 | head -10</automated>
  </verify>
  <done>
    - `scripts/post-erasure-audit/run.js` exists; `--help` prints usage and exits 0
    - File header cites GDPR-03 + Pattern F + Pitfall 13
    - Uses isTombstoneToken from `../../functions/src/gdpr/pseudonymToken.ts` (or reproduces the regex check inline if cross-package import is awkward — comment cites the source of truth either way)
    - README.md exists with prerequisites + sample output
    - Note: actual execution against production requires Wave 5 cleanup gate after a real erasure has been performed; this plan delivers the SCRIPT, not a live audit run
  </done>
</task>

<task type="auto">
  <name>Task 6: Wire functions/src/index.ts + fill src/cloud/gdpr.js eraseUser body</name>
  <read_first>
    - functions/src/index.ts (current 15 exports after 08-04)
    - src/cloud/gdpr.js (08-04 left exportUser filled; eraseUser stub remains — this task fills it)
  </read_first>
  <files>functions/src/index.ts, src/cloud/gdpr.js</files>
  <action>
    1. **Add 1 line to `functions/src/index.ts`** (alongside the 08-04 GDPR banner — extend the comment to reflect Wave 3+4):
       ```typescript
       // Phase 8 Wave 3-4 (08-04, 08-05): GDPR Art. 15 export + Art. 17 erasure.
       export { gdprExportUser } from "./gdpr/gdprExportUser.js";
       export { gdprEraseUser } from "./gdpr/gdprEraseUser.js";
       ```

    2. **Fill `src/cloud/gdpr.js#eraseUser` body**, preserving the exportUser body from 08-04:
       ```javascript
       // src/cloud/gdpr.js
       // @ts-check
       // Phase 8 Wave 3 (GDPR-01): exportUser body filled (08-04).
       // Phase 8 Wave 4 (GDPR-02): eraseUser body filled (08-05).
       //
       // Cleanup-ledger row "Phase 4 stub seam" — BOTH stubs now CLOSE.

       import { httpsCallable } from "firebase/functions";
       import { functions } from "../firebase/functions.js";

       const exportUserCallable = httpsCallable(functions, "gdprExportUser");
       const eraseUserCallable = httpsCallable(functions, "gdprEraseUser");

       /**
        * GDPR Art. 15 — admin-callable export. (Phase 8 Wave 3 / 08-04.)
        * @param {{ userId: string }} input
        * @returns {Promise<{ url: string, expiresAt: number }>}
        */
       export async function exportUser(input) {
         const clientReqId = crypto.randomUUID();
         const result = await exportUserCallable({ ...input, clientReqId });
         return /** @type {{ url: string, expiresAt: number }} */ (result.data);
       }

       /**
        * GDPR Art. 17 — admin-callable erasure. Cascades a deterministic
        * pseudonym token across all denormalised collections + tombstones
        * users/{uid} PII + writes redactionList/{uid} + emits compliance.erase.user
        * audit event. Idempotent on (caller, target, clientReqId) within 5min;
        * deterministic on (uid, GDPR_PSEUDONYM_SECRET) across runs.
        *
        * @param {{ userId: string }} input
        * @returns {Promise<{ ok: true, tombstoneToken: string, counts: Record<string, number> }>}
        */
       export async function eraseUser(input) {
         const clientReqId = crypto.randomUUID();
         const result = await eraseUserCallable({ ...input, clientReqId });
         return /** @type {{ ok: true, tombstoneToken: string, counts: Record<string, number> }} */ (result.data);
       }
       ```

    Note: the original Phase 4 stub returned `void` from eraseUser. The new contract returns the richer shape so callers (admin UI in 08-06 follow-up) can show the cascade summary in the toast. Verify no caller relies on the void shape (the stub was never wired into a real caller — safe to evolve).
  </action>
  <verify>
    <automated>npm run typecheck 2>&1 | tail -10 && cd functions && npm test 2>&1 | tail -10</automated>
  </verify>
  <done>
    - `functions/src/index.ts` exports gdprEraseUser (verified by `grep -c "^export" functions/src/index.ts` == 16 — was 15 after 08-04)
    - `src/cloud/gdpr.js` no longer has any `Phase 8 ... body lands here` placeholder text (verified by `grep -c "lands here\|lands in 08" src/cloud/gdpr.js` == 0)
    - Both exportUser and eraseUser pass `clientReqId: crypto.randomUUID()`
    - `npm run typecheck` exits 0
    - `cd functions && npm run build` exits 0; `lib/gdpr/{gdprExportUser,gdprEraseUser,pseudonymToken,eraseCascade,assembleUserBundle}.js` all exist
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 7: Operator provisions GDPR_PSEUDONYM_SECRET + gdpr-writer-sa + gdpr-reader-sa</name>
  <what-built>
    Tasks 1-6 produced the full GDPR erasure surface:
    - `functions/src/gdpr/{pseudonymToken,eraseCascade,gdprEraseUser}.ts` — the deterministic-token cascade callable
    - `firestore.rules` adds the redactionList/{userId} match block (admin-read, server-only-write)
    - `tests/rules/redaction-list.test.js` pins the access matrix
    - `scripts/post-erasure-audit/run.js` — operator-run residual-PII verifier
    - `src/cloud/gdpr.js#eraseUser` body filled

    BEFORE deploying, the operator MUST:
    1. Generate a fresh 32-byte random secret and set it in Firebase Secret Manager
    2. Provision `gdpr-reader-sa` (08-04 dependency) AND `gdpr-writer-sa` (this plan) with their respective IAM bindings
    3. Provision `lifecycle-sa` (08-03 dependency)
    4. Provision `storage-reader-sa` (08-02 dependency)

    All four SAs are queued for this single checkpoint to consolidate operator effort. Without them, deploy fails with `serviceAccount: <name> not found`.
  </what-built>
  <how-to-verify>
    Operator (Hugh / Luke) executes — paste outputs into the cleanup ledger or a PR comment:

    1. **GDPR_PSEUDONYM_SECRET** — generate + set:
       ```bash
       SECRET_VALUE=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
       echo "$SECRET_VALUE" | firebase functions:secrets:set GDPR_PSEUDONYM_SECRET --project=bedeveloped-base-layers
       # Confirm:
       firebase functions:secrets:get GDPR_PSEUDONYM_SECRET --project=bedeveloped-base-layers
       ```
       Expected: secret appears with `versions: 1` (or N+1 if previously set). DO NOT echo the value to the PR comment — confirm only that the secret exists.

    2. **Provision 4 SAs**:
       ```bash
       PROJECT="bedeveloped-base-layers"
       UPLOADS_BUCKET="gs://bedeveloped-base-layers-uploads"

       # storage-reader-sa (08-02 / BACKUP-05)
       gcloud iam service-accounts create storage-reader-sa --display-name="Phase 8 Storage signed URL issuer" --project=$PROJECT
       gcloud storage buckets add-iam-policy-binding $UPLOADS_BUCKET --member="serviceAccount:storage-reader-sa@$PROJECT.iam.gserviceaccount.com" --role="roles/storage.objectViewer"
       gcloud iam service-accounts add-iam-policy-binding storage-reader-sa@$PROJECT.iam.gserviceaccount.com --member="serviceAccount:storage-reader-sa@$PROJECT.iam.gserviceaccount.com" --role="roles/iam.serviceAccountTokenCreator"

       # lifecycle-sa (08-03 / LIFE-01..05)
       gcloud iam service-accounts create lifecycle-sa --display-name="Phase 8 lifecycle (soft-delete + purge)" --project=$PROJECT
       gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:lifecycle-sa@$PROJECT.iam.gserviceaccount.com" --role="roles/datastore.user"

       # gdpr-reader-sa (08-04 / GDPR-01)
       gcloud iam service-accounts create gdpr-reader-sa --display-name="Phase 8 GDPR export reader" --project=$PROJECT
       gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:gdpr-reader-sa@$PROJECT.iam.gserviceaccount.com" --role="roles/datastore.viewer"
       gcloud storage buckets add-iam-policy-binding gs://bedeveloped-base-layers-backups --member="serviceAccount:gdpr-reader-sa@$PROJECT.iam.gserviceaccount.com" --role="roles/storage.objectAdmin"
       gcloud iam service-accounts add-iam-policy-binding gdpr-reader-sa@$PROJECT.iam.gserviceaccount.com --member="serviceAccount:gdpr-reader-sa@$PROJECT.iam.gserviceaccount.com" --role="roles/iam.serviceAccountTokenCreator"

       # gdpr-writer-sa (08-05 / GDPR-02..05)
       gcloud iam service-accounts create gdpr-writer-sa --display-name="Phase 8 GDPR erasure writer" --project=$PROJECT
       gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:gdpr-writer-sa@$PROJECT.iam.gserviceaccount.com" --role="roles/datastore.user"
       gcloud projects add-iam-policy-binding $PROJECT --member="serviceAccount:gdpr-writer-sa@$PROJECT.iam.gserviceaccount.com" --role="roles/firebaseauth.admin"
       gcloud storage buckets add-iam-policy-binding $UPLOADS_BUCKET --member="serviceAccount:gdpr-writer-sa@$PROJECT.iam.gserviceaccount.com" --role="roles/storage.objectAdmin"
       ```
       Expected: each command exits 0 (or skips with `already exists`).

    3. **Verify all 4 SAs exist**:
       ```bash
       gcloud iam service-accounts list --project=bedeveloped-base-layers --format="value(email)" | grep -E "(storage-reader-sa|lifecycle-sa|gdpr-reader-sa|gdpr-writer-sa)"
       ```
       Expected: 4 lines printed (one per SA).

    4. **Confirm secret exists in Secret Manager**:
       ```bash
       gcloud secrets describe GDPR_PSEUDONYM_SECRET --project=bedeveloped-base-layers --format="value(name,replication.userManaged.replicas[0].location)"
       ```
       Expected: secret name is `projects/<num>/secrets/GDPR_PSEUDONYM_SECRET`; replication is automatic (or europe-west2 if user-managed).
  </how-to-verify>
  <resume-signal>Type "approved" with the output of step 3 (4 SA emails listed) and step 4 (secret exists confirmation). DO NOT paste the secret value.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → gdprEraseUser callable | App Check + ID token + admin role claim verified |
| Cloud Function → all collections + Auth + Storage | gdpr-writer-sa with broad write IAM (datastore.user + firebaseauth.admin + storage.objectAdmin scoped to uploads bucket) |
| GDPR_PSEUDONYM_SECRET | Secret Manager — accessed via defineSecret(); never logged, never returned to caller |
| redactionList/{uid} | Admin-read; server-only write |
| auditLog (preserved post-erasure) | actor.uid pseudonymised but doc retained per legitimate-interest carve-out |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-08-05-01 | Information Disclosure | Pseudonym secret leakage | mitigate | Stored in Firebase Secret Manager via `defineSecret("GDPR_PSEUDONYM_SECRET")` (FN-05). NEVER logged; NEVER returned in handler response. |
| T-08-05-02 | Tampering | Pseudonym token reversibility | mitigate | sha256(uid + 32-byte random secret) is computationally one-way. Without the secret, mapping token → uid requires brute-forcing 2^(8*32) = 2^256 secret guesses per candidate uid — infeasible. |
| T-08-05-03 | Tampering | Non-deterministic token (Pitfall C) | mitigate | tombstoneTokenForUser is pure (Task 1); same (uid, secret) ALWAYS yields same token (Test 1 pins it). Crashed-and-restarted erasure writes the SAME token to every collection — no orphan-token references. |
| T-08-05-04 | Repudiation | Erasure not audited | mitigate | Single compliance.erase.user audit event written via writeAuditEvent at end of cascade (Task 3). Includes counts payload + tombstone token. Captured by Phase 7 BigQuery sink for 7-year retention. |
| T-08-05-05 | Elevation of Privilege | Non-admin invokes erasure | mitigate | Token role check `if (token.role !== "admin") throw permission-denied` (Task 3 Test 1). Pitfall 17 — role from request.auth.token. |
| T-08-05-06 | Denial of Service | Erasure cascade timeout on large user | mitigate | timeoutSeconds:540 + memory:1GiB. Cascade ops chunked in 500-op batches (Task 2 Test 7). Per-collection paginated queries collect all references in parallel. For pathologically large users (millions of refs), the function may need a follow-up rerun with new clientReqId — deterministic token ensures idempotent additions. |
| T-08-05-07 | Tampering | redactionList client-write | mitigate | Rules: `match /redactionList/{userId} { allow write: if false }` (Task 4); rules-test cell pins admin-write-deny (Task 4 Test 10). |
| T-08-05-08 | Information Disclosure | Audit log retains PII | mitigate | Pitfall 11 — audit log entries about the user are PRESERVED (Art. 6(1)(f) legitimate interest) but PII fields (actor.email, payload.email, actor.uid → token) are tombstoned in-place. eraseCascade Task 2 Test 4 pins the patch shape. |
| T-08-05-09 | Tampering | Erasure replay (admin double-click) | mitigate | ensureIdempotent on key `gdprEraseUser:<actor>:<target>:<clientReqId>` with 5-min window (already-exists). New clientReqId allows intentional rerun with deterministic same-token outcome. |
| T-08-05-10 | Information Disclosure | Storage object residual after erasure (GDPR-03) | mitigate | After Firestore tombstoning, the Cloud Function enumerates Storage objects: for each tombstoned document row in `orgs/{orgId}/documents/{docId}` (and the legacy top-level `documents/{docId}`), derive the Storage path `orgs/{orgId}/documents/{docId}/{filename}` and delete the Storage object via `getStorage().bucket(UPLOADS_BUCKET).file(path).delete()`. Each delete is wrapped in try/catch so a missing object (already deleted, or never uploaded) does not abort the cascade. Implementation lives in Task 3 alongside the Firestore cascade; pinned by Task 3 Test 8 (Storage object presence pre-erasure → absence post-erasure). |
| T-08-05-11 | Information Disclosure | Erased user's content (message bodies, document files) remains | accept | Per ICO + EDPB guidance, content authored by the user is "their data" but legitimately processed for the org/user-collective post-pseudonymisation. The pseudonym token replaces author identifiers; content remains under the legitimate-interest carve-out. Documented in Task 2 file header. If a future requirement demands full content deletion, that's a separate v2 capability. |
</threat_model>

<verification>
- `cd functions && npm run build` exits 0; `lib/gdpr/{pseudonymToken,eraseCascade,gdprEraseUser}.js` exist
- `cd functions && npm test` exits 0; total test count ≥ 08-04 baseline + ≥ 22 new (7 pseudonym + 7 cascade + 7 callable + 1 integration)
- `cd functions && npm run typecheck` exits 0
- `npm test` (root) exits 0; tests/rules/redaction-list.test.js ≥ 10 tests pass against emulator
- `functions/src/index.ts` exports gdprEraseUser
- `firestore.rules` has the redactionList/{userId} match block
- `scripts/post-erasure-audit/run.js --help` exits 0
- `src/cloud/gdpr.js` BOTH stubs are now filled
- Operator (Task 7) confirms 4 SAs + GDPR_PSEUDONYM_SECRET provisioned
</verification>

<success_criteria>
- GDPR-02: deterministic pseudonym cascade lands; pure helpers + callable + tests all green
- GDPR-03: erasure spans all 7+ collections + Auth disable; multi-field document author handling; post-erasure audit script exists
- GDPR-04: audit log retention with PII tombstoning per Pitfall 11
- GDPR-05: redactionList/{userId} write + rules + admin-only-read; backup-rotation re-redaction is the BACKUP-07 restore drill responsibility (08-06)
- Operator-side substrate (4 SAs + secret) provisioned at the checkpoint
- src/cloud/gdpr.js Phase 4 stub seam fully closed
- Phase 7 + 08-01..04 baseline tests still all green
- 22+ new tests across pure helpers + callable + rules cells
</success_criteria>

<output>
After completion, create `.planning/phases/08-data-lifecycle-soft-delete-gdpr-backups/08-05-SUMMARY.md` covering:
- 3 new functions/src/gdpr/*.ts files + line counts
- Test counts: pseudonymToken (7), eraseCascade (7), gdprEraseUser unit (≥6), gdprEraseUser integration (≥1) — total ≥ 21
- Total functions/ test count delta from 08-04 (≥ +21)
- functions/src/index.ts export delta (15 → 16)
- firestore.rules delta: redactionList/{userId} block added; tests/rules/redaction-list.test.js with ≥ 10 cells
- scripts/post-erasure-audit/run.js shipped — operator runs after first real erasure (08-06 close-gate)
- src/cloud/gdpr.js fully closed (Phase 4 stub forward-tracking ledger row CLOSES)
- Operator checkpoint outcome: 4 SAs + GDPR_PSEUDONYM_SECRET confirmed
- Forward pointers: 08-06 deploys all Phase 8 Cloud Functions + redacts the BACKUP-07 restore drill (which uses redactionList re-applies on restored data) + DOC-10 SECURITY.md
</output>
