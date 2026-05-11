---
phase: 08
plan: 04
type: execute
wave: 4
depends_on:
  - 08-03
files_modified:
  - functions/src/gdpr/gdprExportUser.ts
  - functions/src/gdpr/assembleUserBundle.ts
  - functions/src/index.ts
  - functions/test/gdpr/assembleUserBundle.unit.test.ts
  - functions/test/gdpr/gdprExportUser.unit.test.ts
  - functions/test/integration/gdprExportUser.integration.test.ts
  - src/cloud/gdpr.js
autonomous: true
requirements:
  - GDPR-01
  - DOC-10
must_haves:
  truths:
    - "gdprExportUser callable (admin-only) returns { url, expiresAt } where url is a V4 signed URL with TTL ≤ 24 hours pointing to a JSON bundle in gs://bedeveloped-base-layers-backups/gdpr-exports/{uid}/{ts}/export.json"
    - "Bundle contains profile (users/{uid}), audit events about user (auditLog where actor.uid==uid), responses authored, comments authored, messages authored, actions assigned (ownerId), funnelComments authored, documents uploaded — collected via parallel Admin-SDK queries"
    - "Pure assembleUserBundle helper produces the canonical bundle shape from a Firestore + collectionGroup query results map; Pattern C purity (no firebase-admin imports)"
    - "src/cloud/gdpr.js exportUser() body fills with httpsCallable wrapper returning the typed { url, expiresAt }"
    - "gdprExportUser.bundleSchemaVersion is 1 (pinned for forward-compat)"
  artifacts:
    - path: "functions/src/gdpr/gdprExportUser.ts"
      provides: "Admin-only callable: assemble + upload + sign URL"
      contains: "compliance.export.user"
    - path: "functions/src/gdpr/assembleUserBundle.ts"
      provides: "Pure helper: maps query results → canonical bundle"
      contains: "bundleSchemaVersion"
    - path: "functions/src/index.ts"
      provides: "Exports gdprExportUser"
      contains: "gdprExportUser"
    - path: "src/cloud/gdpr.js"
      provides: "Browser seam: exportUser body filled (eraseUser stub remains for 08-05)"
      contains: "httpsCallable"
  key_links:
    - from: "functions/src/gdpr/gdprExportUser.ts"
      to: "gs://bedeveloped-base-layers-backups/gdpr-exports/{uid}/{ts}/export.json"
      via: "getStorage().bucket(...).file(path).save(bundle, {contentType:'application/json'})"
      pattern: "save"
    - from: "functions/src/gdpr/gdprExportUser.ts"
      to: "auditLog (compliance.export.user event via writeAuditEvent)"
      via: "writeAuditEvent — compliance.export.user enum value"
      pattern: "compliance.export.user"
    - from: "src/cloud/gdpr.js"
      to: "gdprExportUser callable"
      via: "httpsCallable(functions, 'gdprExportUser')"
      pattern: "httpsCallable"
---

<objective>
Land GDPR-01: an admin-only callable that assembles all user-linked data across the Firestore data model into a JSON bundle, uploads to GCS, and returns a 24-hour V4 signed URL the operator can hand to the data subject. Decompose into a pure assembly helper + the callable shell so the bundle shape is unit-testable without the Admin SDK.

Purpose: GDPR Art. 15 right of access. The operator (admin role claim) initiates the export on behalf of the data subject; the bundle includes everything we hold under the user's identifier — profile, all authored content, all assigned actions, all audit events about them. The 24-hour TTL aligns with EDPB guidance on "without undue delay" while bounding URL exposure.

Output: 2 new TypeScript modules in functions/src/gdpr/ + 3 test files + 1 line in functions/src/index.ts + body fill in src/cloud/gdpr.js (exportUser only — eraseUser remains stubbed for 08-05).
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
@functions/src/audit/auditEventSchema.ts
@functions/src/audit/auditLogger.ts
@functions/src/auth/setClaims.ts
@functions/src/util/idempotency.ts
@functions/src/lifecycle/softDelete.ts
@functions/src/lifecycle/resolveDocRef.ts
@functions/src/backup/getDocumentSignedUrl.ts
@functions/test/_mocks/admin-sdk.ts
@src/cloud/gdpr.js

<interfaces>
<!-- All collections that may hold user-linked data per the deployed model. -->

From firestore.rules (current data model):
- /users/{uid}                                 → profile (single doc keyed by uid)
- /orgs/{orgId}/responses/{respId}             → userId field (diagnostic responses)
- /orgs/{orgId}/comments/{cmtId}               → authorId field
- /orgs/{orgId}/actions/{actId}                → ownerId field (assignee)
- /orgs/{orgId}/documents/{docId}              → uploaderId field [ASSUMED A1 from 08-RESEARCH.md — verify in Task 1]
- /orgs/{orgId}/messages/{msgId}               → authorId field
- /funnelComments/{id}                         → authorId field (top-level, has orgId field)
- /auditLog/{eventId}                          → actor.uid field
- /softDeleted/{type}/items/{id}               → tombstones snapshotted by Wave 2 — included for completeness

From functions/src/audit/auditEventSchema.ts:
- auditEventType enum already includes "compliance.export.user" — reuse as the audit-event type for GDPR export ops

From functions/src/audit/auditLogger.ts:
- writeAuditEvent(input: AuditEventInput, ctx: ServerContext): Promise<AuditLogDoc>
- Reuse for the audit row written by gdprExportUser

From functions/src/lifecycle/softDelete.ts (Pattern A reference — admin role gate + idempotency + Sentry):
- Pattern A is the canonical callable shape; this plan mirrors verbatim with: serviceAccount: "gdpr-reader-sa" (least-privilege per 08-RESEARCH.md Open Question 3)

From functions/test/_mocks/admin-sdk.ts (Wave 1 + 2 additions):
- adminMockState._seedDoc, _readDoc, _allDocs, _seedStorageObject, _allStorageObjects, _allSignedUrls
- getFirestoreMock(), getStorageMock()
- Note: the in-memory mock supports `where(field, op, value)` for "==" + ">" + (added in 08-03 Task 2) "<" only. Collection-group queries (where("authorId", "==", uid) across all orgs/{orgId}/comments) require iterating with collection-prefix matching — extend the mock IF needed in this task to support a `collectionGroup(name)` factory that mimics Firestore's behavior.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 0: Verify documents-collection field name (uploaderId vs uploadedBy) — closes Assumption A1</name>
  <read_first>
    - src/data/documents.js (saveDocument writes meta — what field name?)
    - src/main.js lines 3340-3380 (the legacy upload site — what field name does it use?)
    - 08-RESEARCH.md §Assumptions Log A1 (acknowledges this assumption needs verification before erasure cascade)
  </read_first>
  <files>.planning/phases/08-data-lifecycle-soft-delete-gdpr-backups/08-04-FIELD-AUDIT-NOTES.md</files>
  <action>
    Empirical inspection task. Do NOT trust any pre-populated conclusion — discover the field names from the codebase yourself.

    1. Run the discovery grep:
       ```
       grep -n "uploaderId\|uploadedBy\|legacyAppUserId" src/data/documents.js src/main.js src/views/*.js
       ```

    2. For each match, read the surrounding 10 lines of context and determine:
       - Which Firestore collection path the write lands in (top-level `documents/{id}` vs subcollection `orgs/{orgId}/documents/{id}`)
       - Whether the field is part of a write payload (`setDoc`, `updateDoc`, `addDoc`) or a read-side projection
       - Whether the field name comes from a `meta` parameter or is hardcoded

    3. Write your findings to `.planning/phases/08-data-lifecycle-soft-delete-gdpr-backups/08-04-FIELD-AUDIT-NOTES.md` (a working file used as the single source of truth for Tasks 1 + 2). Required structure:

       ```markdown
       # 08-04 Task 0 — Documents-Collection Field Audit

       **Date:** <YYYY-MM-DD>
       **Closes:** Assumption A1 from 08-RESEARCH.md

       ## Grep output (verbatim)
       <paste the grep -n output exactly>

       ## Per-collection findings

       ### Top-level `documents/{docId}` (legacy main.js path)
       Author-attribution fields written: <list discovered>
       Evidence: src/main.js lines <N>-<M>

       ### Subcollection `orgs/{orgId}/documents/{docId}` (data/documents.js path)
       Author-attribution fields written: <list discovered>
       Evidence: src/data/documents.js lines <N>-<M>

       ## Canonical field list for Tasks 1 + 2
       `DOCUMENT_AUTHOR_FIELDS = [<list each discovered field name>]`

       ## Assumption A1 closure
       <one-paragraph summary of what was verified vs the original assumption>
       ```

    4. Task 1 then reads `08-04-FIELD-AUDIT-NOTES.md` (the file you just wrote) to discover the field names — Task 1's executor MUST NOT see the field names from Task 0's action text. Tasks 1 + 2 use the values from the working file as the source of truth.
  </action>
  <verify>
    <automated>grep -n "uploaderId\|uploadedBy\|legacyAppUserId" src/data/documents.js src/main.js 2>&1 | head -10 && test -f .planning/phases/08-data-lifecycle-soft-delete-gdpr-backups/08-04-FIELD-AUDIT-NOTES.md</automated>
  </verify>
  <done>
    - `.planning/phases/08-data-lifecycle-soft-delete-gdpr-backups/08-04-FIELD-AUDIT-NOTES.md` exists with the 4 sections above
    - The working file's "Canonical field list" section lists every field discovered by the grep — the canonical list is whatever the grep + context reads reveal, not a pre-loaded answer
    - The SUMMARY's "Assumption A1 closure" section quotes from the working file rather than rewriting the conclusion
    - Task 1 + Task 2 read 08-04-FIELD-AUDIT-NOTES.md before writing assembleUserBundle.ts — verified by Task 1's read_first list
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 1: Author functions/src/gdpr/assembleUserBundle.ts pure helper + unit tests</name>
  <read_first>
    - functions/src/audit/auditLogger.ts (Pattern C purity precedent — pure helper isolated from firebase-admin)
    - 08-RESEARCH.md §Pattern 8 (GDPR export — bundle shape)
    - functions/src/lifecycle/resolveDocRef.ts (precedent for type-narrowing pure helper)
    - .planning/phases/08-data-lifecycle-soft-delete-gdpr-backups/08-04-FIELD-AUDIT-NOTES.md (working file from Task 0 — single source of truth for DOCUMENT_AUTHOR_FIELDS contents; do NOT read field names from Task 0's action text)
  </read_first>
  <behavior>
    - Test 1 (unit): given empty input maps for every collection, returns a bundle with `bundleSchemaVersion: 1`, `userId: <uid>`, `assembledAt: <iso>`, and empty arrays for every collection key
    - Test 2 (unit): given a user doc + 2 messages + 1 comment, the bundle's `messages` array has length 2, `comments` array has length 1, `profile` object equals the seeded user data
    - Test 3 (unit): given audit events authored by other users mixed with events about this user, only events with actor.uid===userId appear in `auditEvents`
    - Test 4 (unit): documents query results: assembleUserBundle merges results matching uploaderId, uploadedBy, AND legacyAppUserId fields (all three ASSUMED PRESENT per Task 0 verification) — duplicates de-duped by document path
    - Test 5 (unit): bundle stringification roundtrip — JSON.parse(JSON.stringify(bundle)) deep-equals bundle (no Date / Timestamp objects that would lose precision; converted to ISO strings or numeric millis where present)
  </behavior>
  <files>functions/src/gdpr/assembleUserBundle.ts, functions/test/gdpr/assembleUserBundle.unit.test.ts</files>
  <action>
    Create `functions/src/gdpr/assembleUserBundle.ts`:

    ```typescript
    // Phase 8 Wave 3 (GDPR-01 / Pattern C purity): pure assembler that maps
    // pre-fetched Firestore query results into the canonical GDPR export
    // bundle shape. NO firebase-admin imports — safe for unit tests + reusable
    // by the post-erasure audit script (08-05) for residual-PII verification.

    export const BUNDLE_SCHEMA_VERSION = 1 as const;

    /** Field names used in src/data/documents.js + src/main.js legacy writes (verified Task 0). */
    export const DOCUMENT_AUTHOR_FIELDS = ["uploaderId", "uploadedBy", "legacyAppUserId"] as const;

    export interface QueryResults {
      profile: Record<string, unknown> | null;
      auditEvents: Array<Record<string, unknown>>;
      responses: Array<{ path: string; data: Record<string, unknown> }>;
      comments: Array<{ path: string; data: Record<string, unknown> }>;
      messages: Array<{ path: string; data: Record<string, unknown> }>;
      actions: Array<{ path: string; data: Record<string, unknown> }>;
      documents: Array<{ path: string; data: Record<string, unknown> }>;
      funnelComments: Array<{ path: string; data: Record<string, unknown> }>;
    }

    export interface UserBundle {
      bundleSchemaVersion: typeof BUNDLE_SCHEMA_VERSION;
      userId: string;
      assembledAt: string;  // ISO 8601
      profile: Record<string, unknown> | null;
      auditEvents: Array<Record<string, unknown>>;
      responses: Array<{ path: string; data: Record<string, unknown> }>;
      comments: Array<{ path: string; data: Record<string, unknown> }>;
      messages: Array<{ path: string; data: Record<string, unknown> }>;
      actions: Array<{ path: string; data: Record<string, unknown> }>;
      documents: Array<{ path: string; data: Record<string, unknown> }>;
      funnelComments: Array<{ path: string; data: Record<string, unknown> }>;
    }

    /**
     * Assemble the canonical bundle. Inputs are pre-fetched query results so
     * this helper stays pure (testable without the Admin SDK).
     *
     * Documents are de-duped by path because the caller queries 3 fields
     * (uploaderId, uploadedBy, legacyAppUserId) and the same doc may match
     * multiple — the de-dupe ensures one entry per physical doc.
     */
    export function assembleUserBundle(userId: string, results: QueryResults, nowMs: number): UserBundle {
      // De-dupe documents by path (multiple-field query overlap).
      const docsByPath = new Map<string, { path: string; data: Record<string, unknown> }>();
      for (const d of results.documents) {
        if (!docsByPath.has(d.path)) docsByPath.set(d.path, d);
      }

      // Filter audit events to only those where actor.uid === userId
      // (the caller pre-queries by actor.uid==userId; this is a defensive
      // re-check in case the caller mis-queried).
      const auditEvents = results.auditEvents.filter((e) => {
        const actor = (e as Record<string, unknown>).actor as Record<string, unknown> | undefined;
        return actor && actor.uid === userId;
      });

      return {
        bundleSchemaVersion: BUNDLE_SCHEMA_VERSION,
        userId,
        assembledAt: new Date(nowMs).toISOString(),
        profile: results.profile,
        auditEvents,
        responses: results.responses,
        comments: results.comments,
        messages: results.messages,
        actions: results.actions,
        documents: [...docsByPath.values()],
        funnelComments: results.funnelComments,
      };
    }
    ```

    Then `functions/test/gdpr/assembleUserBundle.unit.test.ts` — pure test, no vi.mock needed:
    ```typescript
    import { describe, it, expect } from "vitest";
    import { assembleUserBundle, BUNDLE_SCHEMA_VERSION, DOCUMENT_AUTHOR_FIELDS } from "../../src/gdpr/assembleUserBundle.js";
    ```
    Cover the 5 behaviours above with concrete fixtures.
  </action>
  <verify>
    <automated>cd functions && npm test -- assembleUserBundle 2>&1 | tail -20</automated>
  </verify>
  <done>
    - `functions/src/gdpr/assembleUserBundle.ts` exists with BUNDLE_SCHEMA_VERSION + DOCUMENT_AUTHOR_FIELDS exports
    - File imports from NOTHING outside `node:` builtins or its own types (Pattern C purity verified by `grep -E "^import" functions/src/gdpr/assembleUserBundle.ts | grep -v "node:" | wc -l` == 0)
    - 5 unit tests in `functions/test/gdpr/assembleUserBundle.unit.test.ts`, all pass
    - `cd functions && npm run typecheck` exits 0
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Author functions/src/gdpr/gdprExportUser.ts callable + unit + integration tests</name>
  <read_first>
    - functions/src/lifecycle/softDelete.ts (Pattern A admin-gated callable structure — verbatim mirror)
    - functions/src/audit/auditWrite.ts (Pattern A reference + writeAuditEvent invocation pattern)
    - functions/src/audit/auditLogger.ts (writeAuditEvent signature)
    - functions/src/audit/auditEventSchema.ts ("compliance.export.user" enum value)
    - functions/src/backup/getDocumentSignedUrl.ts (V4 signed URL pattern — adapt for 24h TTL)
    - 08-RESEARCH.md §Pattern 8 (full code listing — adapt with the assembleUserBundle decomposition)
    - functions/test/integration/auditWrite.integration.test.ts (vi.mock layout — REUSE)
  </read_first>
  <behavior>
    - Test 1 (unit): non-admin caller → permission-denied
    - Test 2 (unit): unauthenticated → unauthenticated
    - Test 3 (unit): invalid input (missing userId) → invalid-argument
    - Test 4 (unit): happy path: admin caller, userId="u-target" with seeded profile + 2 comments + 1 message → returns { url, expiresAt }; expiresAt within 60s of now+86400000; storage object exists at gs://bedeveloped-base-layers-backups/gdpr-exports/u-target/<ts>/export.json with valid JSON body matching bundle shape
    - Test 5 (unit): writeAuditEvent is called with type:"compliance.export.user", target:{type:"user", id:"u-target"}, actor.uid===admin caller's uid (Pitfall 17 — actor from token, not payload)
    - Test 6 (unit): bundle queries iterate 6 collection groups (responses, comments, actions, documents, messages, funnelComments) AND the users/{uid} doc AND auditLog where actor.uid==userId — verified by counting the calls into adminMockState
  </behavior>
  <files>functions/src/gdpr/gdprExportUser.ts, functions/test/gdpr/gdprExportUser.unit.test.ts, functions/test/integration/gdprExportUser.integration.test.ts</files>
  <action>
    Create `functions/src/gdpr/gdprExportUser.ts`:

    ```typescript
    // Phase 8 Wave 3 (GDPR-01 / FN-03 / FN-04 / FN-07 / Pitfall 11):
    // gdprExportUser — admin-callable that assembles all user-linked data
    // into a JSON bundle and returns a 24h V4 signed URL.
    //
    // Pattern A standard callable shape (mirror of softDelete + auditWrite):
    //   - enforceAppCheck: true
    //   - serviceAccount: "gdpr-reader-sa" (read-only IAM per FN-04 / 08-RESEARCH.md Open Q3)
    //   - secrets: [SENTRY_DSN]
    //   - withSentry handler wrapper
    //   - validateInput(GdprExportInput, request.data)
    //   - ensureIdempotent(...) before assembly (5-min window — accidental click deduped;
    //     intentional re-runs use new clientReqId)
    //
    // Pitfall 17: target userId is from request.data; actor is from request.auth.token.
    // The audit event records actor.uid !== target.uid (admin exporting on behalf
    // of subject) — that asymmetry is the legitimate-interest signal under GDPR.

    import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
    import { logger } from "firebase-functions/logger";
    import { defineSecret } from "firebase-functions/params";
    import { initializeApp, getApps } from "firebase-admin/app";
    import { getFirestore } from "firebase-admin/firestore";
    import { getStorage } from "firebase-admin/storage";
    import { randomUUID } from "node:crypto";
    import { z } from "zod";
    import { withSentry } from "../util/sentry.js";
    import { validateInput } from "../util/zod-helpers.js";
    import { ensureIdempotent } from "../util/idempotency.js";
    import { writeAuditEvent } from "../audit/auditLogger.js";
    import { assembleUserBundle, DOCUMENT_AUTHOR_FIELDS, type QueryResults } from "./assembleUserBundle.js";

    if (!getApps().length) initializeApp();
    const SENTRY_DSN = defineSecret("SENTRY_DSN");

    const EXPORT_BUCKET = "bedeveloped-base-layers-backups";
    const SIGNED_URL_TTL_MS = 24 * 60 * 60 * 1000;  // GDPR-01: 24h max

    const GdprExportInput = z.object({
      userId: z.string().min(1).max(128),
      clientReqId: z.string().uuid(),
    });

    export const gdprExportUser = onCall(
      {
        region: "europe-west2",
        enforceAppCheck: true,
        serviceAccount: "gdpr-reader-sa",
        secrets: [SENTRY_DSN],
        memory: "512MiB",
        timeoutSeconds: 540,  // bundle assembly + GCS save can be slow for large users
      },
      withSentry(async (request: CallableRequest<unknown>) => {
        if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
        const token = (request.auth.token ?? {}) as Record<string, unknown>;
        if (token.role !== "admin") throw new HttpsError("permission-denied", "admin role required");

        const data = validateInput(GdprExportInput, request.data ?? {});
        await ensureIdempotent(
          `gdprExportUser:${request.auth.uid}:${data.userId}:${data.clientReqId}`,
          "gdprExportUser",
          5 * 60,
        );

        const db = getFirestore();
        const userId = data.userId;

        // Parallel queries — pre-fetch every collection that may hold user data.
        const [
          profileSnap,
          auditSnap,
          responsesSnap,
          commentsSnap,
          actionsSnap,
          messagesSnap,
          funnelCommentsSnap,
          ...documentsSnaps  // one snap per DOCUMENT_AUTHOR_FIELDS entry (3 queries)
        ] = await Promise.all([
          db.doc(`users/${userId}`).get(),
          db.collection("auditLog").where("actor.uid", "==", userId).get(),
          db.collectionGroup("responses").where("userId", "==", userId).get(),
          db.collectionGroup("comments").where("authorId", "==", userId).get(),
          db.collectionGroup("actions").where("ownerId", "==", userId).get(),
          db.collectionGroup("messages").where("authorId", "==", userId).get(),
          db.collection("funnelComments").where("authorId", "==", userId).get(),
          ...DOCUMENT_AUTHOR_FIELDS.map((field) =>
            db.collectionGroup("documents").where(field, "==", userId).get(),
          ),
        ]);

        const toEntries = (snap: FirebaseFirestore.QuerySnapshot) =>
          snap.docs.map((d) => ({ path: d.ref.path, data: d.data() ?? {} }));

        const documents = documentsSnaps.flatMap(toEntries);  // assembleUserBundle de-dupes by path

        // Also include legacy top-level documents/ collection (pre-Phase-5 main.js writes).
        const legacyDocsSnaps = await Promise.all(
          DOCUMENT_AUTHOR_FIELDS.map((field) =>
            db.collection("documents").where(field, "==", userId).get(),
          ),
        );
        documents.push(...legacyDocsSnaps.flatMap(toEntries));

        const queryResults: QueryResults = {
          profile: profileSnap.exists ? (profileSnap.data() ?? null) : null,
          auditEvents: auditSnap.docs.map((d) => d.data() ?? {}),
          responses: toEntries(responsesSnap),
          comments: toEntries(commentsSnap),
          messages: toEntries(messagesSnap),
          actions: toEntries(actionsSnap),
          documents,
          funnelComments: toEntries(funnelCommentsSnap),
        };

        const bundle = assembleUserBundle(userId, queryResults, Date.now());
        const ts = Date.now();
        const path = `gdpr-exports/${userId}/${ts}/export.json`;
        const file = getStorage().bucket(EXPORT_BUCKET).file(path);
        await file.save(JSON.stringify(bundle, null, 2), { contentType: "application/json" });

        const expiresAt = Date.now() + SIGNED_URL_TTL_MS;
        const [url] = await file.getSignedUrl({
          version: "v4",
          action: "read",
          expires: expiresAt,
        });

        // Audit row — mandatory per GDPR Art. 15 + Art. 30 (record of processing).
        const eventId = randomUUID();
        await writeAuditEvent(
          {
            type: "compliance.export.user",
            severity: "warning",
            target: { type: "user", id: userId, orgId: null },
            clientReqId: data.clientReqId,
            payload: {
              bundleSchemaVersion: bundle.bundleSchemaVersion,
              bundlePath: `gs://${EXPORT_BUCKET}/${path}`,
              urlExpiresAt: expiresAt,
              counts: {
                auditEvents: bundle.auditEvents.length,
                responses: bundle.responses.length,
                comments: bundle.comments.length,
                messages: bundle.messages.length,
                actions: bundle.actions.length,
                documents: bundle.documents.length,
                funnelComments: bundle.funnelComments.length,
              },
            },
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
            idempotencyKey: `compliance.export.user:${request.auth.uid}:${userId}:${data.clientReqId}`,
          },
        );

        logger.info("compliance.gdprExportUser", { actorUid: request.auth.uid, targetUserId: userId, bundlePath: path });
        return { url, expiresAt };
      }),
    );
    ```

    Then `functions/test/gdpr/gdprExportUser.unit.test.ts` (mirror auditWrite.integration.test.ts vi.mock structure; add `vi.mock("firebase-admin/storage", ...)` from 08-01 mocks). Cover the 6 behaviours.

    `functions/test/integration/gdprExportUser.integration.test.ts` (focus on `t.wrap()` invocation through firebase-functions-test 3.5):
    - happy path admin → returns {url, expiresAt}; storage object created; auditLog row written
    - non-admin denied
    - duplicate clientReqId within 5min window → already-exists

    **Mock extension note:** The in-memory mock from 08-01 may not support `db.collectionGroup(name)`. If absent, extend `functions/test/_mocks/admin-sdk.ts` to add a `collectionGroup(name)` factory that scans all paths matching `*/<name>/*` (i.e. paths containing `/<name>/` segment) and applies the same where/limit chain. The implementation is similar to `buildQuery` but matches by the `<name>` segment anywhere in the path. Add `collectionGroup(name)` to the `getFirestoreMock()` return object. Update Phase 7 baseline tests if any regress (unlikely — collectionGroup is an additive surface).
  </action>
  <verify>
    <automated>cd functions && npm test -- gdpr 2>&1 | tail -25</automated>
  </verify>
  <done>
    - `functions/src/gdpr/gdprExportUser.ts` exists with the exact onCall config and admin-role gate
    - SIGNED_URL_TTL_MS === `24 * 60 * 60 * 1000`; verified by grep
    - 6 unit tests + ≥ 3 integration tests pass
    - writeAuditEvent invocation uses type:"compliance.export.user" + actor sourced from request.auth.token (Pitfall 17)
    - `functions/test/_mocks/admin-sdk.ts` getFirestoreMock returns a `collectionGroup` factory (added IF needed by these tests; verify `grep -c "collectionGroup" functions/test/_mocks/admin-sdk.ts` ≥ 1)
    - `cd functions && npm test` exits 0; total test count ≥ 08-03 baseline + Wave 3a additions (≥ 14 new = 5 assembler + 6 callable unit + 3 integration)
  </done>
</task>

<task type="auto">
  <name>Task 3: Wire functions/src/index.ts + fill src/cloud/gdpr.js exportUser body</name>
  <read_first>
    - functions/src/index.ts (current 14 exports after 08-03)
    - src/cloud/gdpr.js (current Phase 4 stub — exportUser + eraseUser; this task fills exportUser only)
    - src/cloud/checkRateLimit.js (Pattern reference — httpsCallable wrapper)
    - src/cloud/signed-url.js (Pattern reference — same wrapper shape)
  </read_first>
  <files>functions/src/index.ts, src/cloud/gdpr.js</files>
  <action>
    1. **Add 1 line to `functions/src/index.ts`** (group under a new banner — Wave 3a is just gdprExportUser; gdprEraseUser comes in 08-05):
       ```typescript
       // Phase 8 Wave 3 (08-04): GDPR Art. 15 export.
       export { gdprExportUser } from "./gdpr/gdprExportUser.js";
       ```

    2. **Fill `src/cloud/gdpr.js`#exportUser body** — preserve the existing `eraseUser` stub verbatim (08-05 fills that). New file shape:
       ```javascript
       // src/cloud/gdpr.js
       // @ts-check
       // Phase 8 Wave 3 (GDPR-01): exportUser body filled.
       // Phase 8 Wave 4 (GDPR-02 / 08-05): eraseUser body fill — STUB until 08-05.
       //
       // Cleanup-ledger row "Phase 4 stub seam" — exportUser CLOSES with this
       // commit; eraseUser CLOSES with 08-05.

       import { httpsCallable } from "firebase/functions";
       import { functions } from "../firebase/functions.js";

       const exportUserCallable = httpsCallable(functions, "gdprExportUser");

       /**
        * GDPR Art. 15 — admin-callable export of all user-linked data. Returns
        * { url, expiresAt } where url is a V4 signed URL valid for 24 hours.
        * Server enforces admin role; caller catches HttpsError on
        * permission-denied via the Phase 6 D-13 unified-error wrapper.
        *
        * @param {{ userId: string }} input
        * @returns {Promise<{ url: string, expiresAt: number }>}
        */
       export async function exportUser(input) {
         const clientReqId = crypto.randomUUID();
         const result = await exportUserCallable({ ...input, clientReqId });
         return /** @type {{ url: string, expiresAt: number }} */ (result.data);
       }

       /**
        * GDPR Art. 17 — admin-callable erasure of user data. STUB until Phase 8
        * Wave 4 (08-05) which lands gdprEraseUser callable + GDPR_PSEUDONYM_SECRET
        * + redactionList write.
        * @param {{ userId: string }} _input
        * @returns {Promise<void>}
        */
       export async function eraseUser(_input) {
         /* Phase 8 Wave 4 (GDPR-02) body lands in 08-05 */
       }
       ```

       Note: the existing stub returns `{ downloadURL: "" }` — the new shape returns `{ url, expiresAt }` (matching the gdprExportUser callable return shape). This IS a contract change; verify no current caller depends on the `downloadURL` key (the stub was never wired into a real caller because the function returned an empty string — safe to evolve).
  </action>
  <verify>
    <automated>npm run typecheck 2>&1 | tail -10 && cd functions && npm test 2>&1 | tail -10</automated>
  </verify>
  <done>
    - `functions/src/index.ts` exports gdprExportUser (verified by `grep -c "^export" functions/src/index.ts` == 15 — was 14 after 08-03)
    - `src/cloud/gdpr.js` exportUser body uses httpsCallable with clientReqId; eraseUser body REMAINS a stub (verified by `grep -c "Phase 8 Wave 4 (GDPR-02) body lands" src/cloud/gdpr.js` == 1)
    - `npm run typecheck` (root) exits 0
    - `cd functions && npm test` exits 0; `cd functions && npm run build` exits 0; `lib/gdpr/{gdprExportUser,assembleUserBundle}.js` exist
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → gdprExportUser callable | App Check + ID token + admin role claim verified server-side |
| Cloud Function → all 8+ Firestore queries | gdpr-reader-sa with read-only IAM (datastore.viewer + storage.objectAdmin scoped to backups bucket gdpr-exports/ prefix) |
| signed URL → public internet | 24h TTL; URL is unauthenticated by design — recipient MUST treat as PII-bearing |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-08-04-01 | Information Disclosure | Signed URL leakage in audit log | mitigate | writeAuditEvent payload records `bundlePath` (gs:// URI) and `urlExpiresAt` but NEVER the signed URL string itself. The URL is returned ONLY in the function's HTTP response to the admin caller. |
| T-08-04-02 | Information Disclosure | Signed URL TTL > 24h | mitigate | Constant `SIGNED_URL_TTL_MS = 24 * 60 * 60 * 1000`; no caller-supplied TTL parameter in the Zod schema. |
| T-08-04-03 | Elevation of Privilege | Non-admin invokes export | mitigate | `if (token.role !== "admin") throw permission-denied` (Test 1 in Task 2). Pitfall 17 — role from request.auth.token. |
| T-08-04-04 | Information Disclosure | Cross-user export (admin requests another user's data via crafted userId) | accept | This is by-design — admin operating on behalf of data subject. The audit row's `actor.uid !== target.id` is the legitimate-interest signal; if an admin abuses this, the audit log + Wave 5 BigQuery sink (Phase 7) capture it. Documented in Task 2 file header. |
| T-08-04-05 | Repudiation | Export ops not audited | mitigate | writeAuditEvent fires before return (synchronous in the handler — return value blocks on the audit write). compliance.export.user enum value pins the type. |
| T-08-04-06 | Tampering | Bundle injected with wrong user's data | mitigate | All queries pre-filtered by `userId`/`authorId`/`ownerId`/`uploaderId`/`uploadedBy`/`legacyAppUserId`/`actor.uid` (multi-field for documents per Task 0 closure); assembleUserBundle re-filters audit events by actor.uid==userId as a defensive double-check (Task 1 Test 3). |
| T-08-04-07 | Denial of Service | Large-user export OOM | mitigate | memory:512MiB + timeoutSeconds:540. Bundle is assembled in-memory then JSON.stringified; for a hardening-phase project (low doc count) this is sufficient. Streaming-to-GCS pattern is documented in 08-RESEARCH.md §Standard Stack alternatives — escalation path if a real user grows >100MB of data. |
| T-08-04-08 | Tampering | Replay (admin clicks Export twice in error) | mitigate | ensureIdempotent on key `gdprExportUser:<actor>:<target>:<clientReqId>` with 5-min window; same clientReqId returns already-exists. New clientReqId allows intentional re-export. |
</threat_model>

<verification>
- `cd functions && npm run build` exits 0; `lib/gdpr/{gdprExportUser,assembleUserBundle}.js` exist
- `cd functions && npm test` exits 0; total test count ≥ 08-03 baseline + ≥ 14 new
- `cd functions && npm run typecheck` exits 0
- `npm run typecheck` (root) exits 0
- `functions/src/index.ts` exports gdprExportUser
- `src/cloud/gdpr.js` exportUser fills with httpsCallable; eraseUser remains stub
- Bundle shape pinned by 5 unit tests on assembleUserBundle.ts
- Audit row written with type:"compliance.export.user" verified by Task 2 Test 5
- gdpr-reader-sa SA provisioning queued for 08-06 cleanup wave (or operator follow-up)
</verification>

<success_criteria>
- GDPR-01 substrate: gdprExportUser callable + browser seam authored + tested + audit-traced
- Bundle covers profile + audit events about user + responses + comments + messages + actions + documents (multi-field) + funnelComments
- Phase 7 + 08-01/02/03 baseline tests still all green
- 14+ new tests across pure assembler + callable unit + integration
- Pitfall 11 (audit-vs-erasure conflict) addressed at the export side: audit log entries about the user ARE included in the export bundle
- Assumption A1 (documents author field name) closed in SUMMARY
</success_criteria>

<output>
After completion, create `.planning/phases/08-data-lifecycle-soft-delete-gdpr-backups/08-04-SUMMARY.md` covering:
- 2 new functions/src/gdpr/*.ts files + line counts
- Test counts: assembler unit + callable unit + integration
- Total functions/ test count delta from 08-03 (≥ +14)
- functions/src/index.ts export delta (14 → 15)
- Assumption A1 closure: documents collection author field names confirmed (uploaderId, uploadedBy, legacyAppUserId — all 3 included in the cascade)
- Mock extension delta: collectionGroup factory added to _mocks/admin-sdk.ts (if needed)
- Forward pointers: 08-05 wires gdprEraseUser using the same collection-group query shape + adds redactionList rules and post-erasure audit script; 08-06 close-gate provisions gdpr-reader-sa SA
</output>
