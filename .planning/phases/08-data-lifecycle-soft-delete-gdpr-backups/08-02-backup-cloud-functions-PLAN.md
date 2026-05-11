---
phase: 08
plan: 02
type: execute
wave: 2
depends_on:
  - 08-01
files_modified:
  - functions/src/backup/scheduledFirestoreExport.ts
  - functions/src/backup/getDocumentSignedUrl.ts
  - functions/src/index.ts
  - functions/test/backup/scheduledFirestoreExport.unit.test.ts
  - functions/test/backup/getDocumentSignedUrl.unit.test.ts
  - functions/test/integration/scheduledFirestoreExport.integration.test.ts
  - functions/test/integration/getDocumentSignedUrl.integration.test.ts
  - src/cloud/signed-url.js
autonomous: true
requirements:
  - BACKUP-01
  - BACKUP-05
  - DOC-10
must_haves:
  truths:
    - "scheduledFirestoreExport runs daily at 02:00 UTC and writes Firestore export to gs://bedeveloped-base-layers-backups/firestore/{YYYY-MM-DD}/"
    - "getDocumentSignedUrl callable returns a V4 signed URL with TTL ≤ 1 hour for orgs/{orgId}/documents/{docId}/{filename}"
    - "Caller is verified via custom claims: admin/internal can fetch any org's document; client must have token.orgId === requested orgId"
    - "src/cloud/signed-url.js exposes getDocumentSignedUrl(orgId, docId, filename) returning {url, expiresAt}; consumed by data/documents.js + main.js (replaces getDownloadURL — full sweep lands in 08-03 Wave 2)"
    - "Unit tests pin the export request shape (databasePath + outputUriPrefix + collectionIds:[])"
    - "Integration tests via firebase-functions-test wrap() exercise both callables against the in-memory mock from 08-01"
  artifacts:
    - path: "functions/src/backup/scheduledFirestoreExport.ts"
      provides: "Daily Firestore export Cloud Function (Gen2 onSchedule, europe-west2, backup-sa)"
      contains: "FirestoreAdminClient"
    - path: "functions/src/backup/getDocumentSignedUrl.ts"
      provides: "Callable returning V4 signed URL with 1h TTL"
      contains: "getSignedUrl"
    - path: "functions/src/index.ts"
      provides: "Exports scheduledFirestoreExport + getDocumentSignedUrl"
      contains: "export { scheduledFirestoreExport"
    - path: "src/cloud/signed-url.js"
      provides: "Browser seam — httpsCallable wrapper for getDocumentSignedUrl"
      contains: "httpsCallable"
  key_links:
    - from: "functions/src/backup/scheduledFirestoreExport.ts"
      to: "gs://bedeveloped-base-layers-backups/firestore/{YYYY-MM-DD}/"
      via: "FirestoreAdminClient.exportDocuments({ name, outputUriPrefix, collectionIds: [] })"
      pattern: "exportDocuments"
    - from: "functions/src/backup/getDocumentSignedUrl.ts"
      to: "gs://bedeveloped-base-layers-uploads"
      via: "getStorage().bucket(name).file(path).getSignedUrl({ version: 'v4', action: 'read', expires })"
      pattern: "version: \"v4\""
    - from: "src/cloud/signed-url.js"
      to: "getDocumentSignedUrl callable"
      via: "httpsCallable(functions, 'getDocumentSignedUrl')"
      pattern: "httpsCallable"
---

<objective>
Land the two backup-substrate Cloud Functions: `scheduledFirestoreExport` (BACKUP-01 — daily Firestore export to GCS) and `getDocumentSignedUrl` (BACKUP-05 — replaces unbounded `getDownloadURL` with a 1-hour V4 signed URL issued by the server). Wire `src/cloud/signed-url.js` as the browser seam. Pin both callables' shapes with unit tests + integration tests using the offline mock infrastructure from 08-01.

Purpose: BACKUP-01 produces the daily artifact that Wave 4's restore drill (BACKUP-07) restores from. BACKUP-05 closes the documents.js + main.js trust boundary that currently ships unbounded download URLs. The full client-side sweep that REMOVES every remaining `getDownloadURL()` call site lands in 08-03 Wave 2 (paired with the soft-delete data wrapper rewrite).

Output: 2 Cloud Functions + 1 client seam + 4 test files + 2 lines added to `functions/src/index.ts`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/phases/08-data-lifecycle-soft-delete-gdpr-backups/08-RESEARCH.md
@.planning/research/PITFALLS.md
@functions/src/index.ts
@functions/src/audit/auditWrite.ts
@functions/src/auth/setClaims.ts
@functions/src/util/sentry.ts
@functions/src/util/zod-helpers.ts
@functions/src/util/idempotency.ts
@functions/test/_mocks/admin-sdk.ts
@functions/test/integration/auditWrite.integration.test.ts
@src/cloud/checkRateLimit.js

<interfaces>
<!-- Pattern A standard callable shape — every Phase 7 callable conforms. -->

From functions/src/audit/auditWrite.ts:
- onCall({ region: "europe-west2", enforceAppCheck: true, serviceAccount: <name>, secrets: [SENTRY_DSN], memory: "256MiB", timeoutSeconds: 30 }, withSentry(handler))
- handler: (request: CallableRequest<unknown>) => Promise<{ ok, ... }>
- Auth gate: `if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Authentication required")`
- Validation: `const data = validateInput(<ZodSchema>, request.data ?? {})`
- Idempotency: `await ensureIdempotent(<key>, "<scope>", 5 * 60)` — Wave 2/3/4 callables use 5-min window
- if (!getApps().length) initializeApp()  // module-level guard
- const SENTRY_DSN = defineSecret("SENTRY_DSN")  // module-level secret binding

From functions/src/auth/setClaims.ts:
- Token claim check: `if (request.auth?.token?.role !== "admin") throw new HttpsError("permission-denied", "admin role required")`
- For non-admin scopes (per-org access): re-read `token.role` and `token.orgId` from `request.auth.token`, NEVER from request.data (Pitfall 17)

From functions/src/csp/cspReportSink.ts (file header pattern for SA + selective-deploy guidance):
- `// serviceAccount: "<name>" (FN-04 — Wave 1 SA inventory)`
- `// Pitfall 8 selective-deploy guidance: if redeploying with --only functions:..., re-bind invoker after deploy`

From functions/src/index.ts (current exports — Wave 2 ADDS, never removes):
```typescript
export { cspReportSink } from "./csp/cspReportSink.js";
export { beforeUserCreatedHandler } from "./auth/beforeUserCreated.js";
export { beforeUserSignedInHandler } from "./auth/beforeUserSignedIn.js";
export { setClaims } from "./auth/setClaims.js";
export { auditWrite } from "./audit/auditWrite.js";
export { onOrgDelete } from "./audit/triggers/onOrgDelete.js";
export { onUserDelete } from "./audit/triggers/onUserDelete.js";
export { onDocumentDelete } from "./audit/triggers/onDocumentDelete.js";
export { checkRateLimit } from "./ratelimit/checkRateLimit.js";
```

Additions (this plan):
```typescript
export { scheduledFirestoreExport } from "./backup/scheduledFirestoreExport.js";
export { getDocumentSignedUrl } from "./backup/getDocumentSignedUrl.js";
```

From src/cloud/checkRateLimit.js (browser seam pattern):
- `import { httpsCallable } from "firebase/functions"`
- `import { functions } from "../firebase/functions.js"`
- `const callable = httpsCallable(functions, "<callableName>")`
- `await callable({ ...args })` returning `result.data`
- @ts-check + JSDoc; vanilla JS only

From functions/test/_mocks/admin-sdk.ts (Wave 1 additions just landed in 08-01):
- export function getStorageMock(): { bucket(name): { file(path): { save, getSignedUrl, delete, exists }, getFiles(opts) } }
- export function getFirestoreAdminClientMock(): { databasePath, exportDocuments }
- export function _seedStorageObject(bucket, path, body, contentType): void
- adminMockState._allStorageObjects(): Map
- adminMockState._allSignedUrls(): Array<{ bucket, path, expires, action }>
- adminMockState._allExportCalls(): Array<{ name, outputUriPrefix, collectionIds }>

From functions/test/integration/auditWrite.integration.test.ts (vi.mock factory pattern):
```typescript
vi.mock("firebase-admin/app", () => ({ initializeApp: () => ({}), getApps: () => [{}] }));
vi.mock("firebase-admin/firestore", async () => {
  const m = await import("../_mocks/admin-sdk.js");
  return { getFirestore: () => m.getFirestoreMock(), FieldValue: m.FieldValueMock };
});
vi.mock("firebase-functions/params", () => ({ defineSecret: (name: string) => ({ name, value: () => "" }) }));
vi.mock("firebase-functions/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
const t = functionsTest({ projectId: "bedeveloped-base-layers-test" });
afterAll(() => t.cleanup());
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Author functions/src/backup/scheduledFirestoreExport.ts (BACKUP-01)</name>
  <read_first>
    - functions/src/audit/auditWrite.ts (Pattern A reference — onCall vs onSchedule shape; this task uses onSchedule)
    - functions/src/audit/triggers/onOrgDelete.ts (existing onDocumentDeleted pattern — use as the Gen2 trigger structural reference for `onSchedule` analog)
    - 08-RESEARCH.md §Pattern 1 (full code listing — adapt verbatim with modifications below)
    - .planning/research/PITFALLS.md §10 (backup must be live before any erasure)
  </read_first>
  <behavior>
    - Test 1 (unit, offline): on invocation, calls `client.exportDocuments({ name: "projects/bedeveloped-base-layers/databases/(default)", outputUriPrefix: "gs://bedeveloped-base-layers-backups/firestore/<YYYY-MM-DD>", collectionIds: [] })` exactly once
    - Test 2 (unit): outputUriPrefix's date segment is computed from `new Date().toISOString().slice(0, 10)` (deterministic with vi.useFakeTimers)
    - Test 3 (unit): when exportDocuments throws, the function logs `backup.export.failed` and rethrows so Cloud Scheduler retry fires
    - Test 4 (unit): databasePath is computed via `client.databasePath(projectId, "(default)")`; projectId reads from `process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT`
    - Test 5 (unit): when both env vars are absent, throws with message containing "GCLOUD_PROJECT not set"
  </behavior>
  <files>functions/src/backup/scheduledFirestoreExport.ts, functions/test/backup/scheduledFirestoreExport.unit.test.ts</files>
  <action>
    Create `functions/src/backup/scheduledFirestoreExport.ts` based on 08-RESEARCH.md §Pattern 1 with these exact specifications:

    Imports:
    ```typescript
    import { onSchedule } from "firebase-functions/v2/scheduler";
    import { logger } from "firebase-functions/logger";
    import { v1 as firestoreAdminV1 } from "@google-cloud/firestore";
    ```
    Note: `Firestore.v1.FirestoreAdminClient` per the research example uses the namespace import; the actual @google-cloud/firestore@8.5.0 export shape is `{ v1: { FirestoreAdminClient } }` — verify the import resolves with `cd functions && npm run typecheck` and adjust to `import * as firestoreNs from "@google-cloud/firestore"` if needed.

    Module-level constants:
    ```typescript
    const BACKUP_BUCKET = "bedeveloped-base-layers-backups";  // bare name, NOT "gs://" — gcloud-style URI is built per call
    ```

    File-header banner (mirrors `auditWrite.ts` lines 1-20 structural style):
    ```
    // Phase 8 Wave 1 (BACKUP-01 / FN-01 / Pitfall 10): scheduledFirestoreExport —
    // daily Firestore export to gs://bedeveloped-base-layers-backups/firestore/{YYYY-MM-DD}/.
    // Pattern from 08-RESEARCH.md §Pattern 1 + Firebase docs verbatim adaptation.
    //
    // Substrate dependencies (Wave 1 08-01): backups bucket + lifecycle + backup-sa
    // SA + role bindings MUST be live before deploy or first invocation hits
    // Pitfall F (bucket-not-found). Operator runbook: runbooks/phase-8-backup-setup.md.
    //
    // Schedule: 02:00 UTC daily (cron "0 2 * * *"). Timeout 540s (Gen2 max — exports
    // can be slow). Retry 2x via Cloud Scheduler. SA: backup-sa with
    // roles/datastore.importExportAdmin (project) + roles/storage.objectAdmin (bucket).
    //
    // The output URI uses the gs:// URI prefix; FirestoreAdminClient handles the
    // protocol. collectionIds: [] means "all collections" per Firestore Admin API.
    ```

    Function:
    ```typescript
    export const scheduledFirestoreExport = onSchedule(
      {
        schedule: "0 2 * * *",
        timeZone: "UTC",
        region: "europe-west2",
        timeoutSeconds: 540,
        memory: "256MiB",
        retryConfig: { retryCount: 2 },
        serviceAccount: "backup-sa",
      },
      async (_event) => {
        const projectId = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT;
        if (!projectId) {
          throw new Error("GCLOUD_PROJECT not set");
        }
        const client = new firestoreAdminV1.FirestoreAdminClient();
        const databaseName = client.databasePath(projectId, "(default)");
        const date = new Date().toISOString().slice(0, 10);
        const outputUriPrefix = `gs://${BACKUP_BUCKET}/firestore/${date}`;

        try {
          const [operation] = await client.exportDocuments({
            name: databaseName,
            outputUriPrefix,
            collectionIds: [],
          });
          logger.info("backup.export.started", {
            operationName: operation.name,
            outputUriPrefix,
          });
        } catch (err) {
          logger.error("backup.export.failed", {
            err: (err as Error).message ?? String(err),
            outputUriPrefix,
          });
          throw err;
        }
      },
    );
    ```

    Then create `functions/test/backup/scheduledFirestoreExport.unit.test.ts` mirroring `functions/test/integration/auditWrite.integration.test.ts` mock structure but using:
    - `vi.mock("@google-cloud/firestore", async () => { const m = await import("../_mocks/admin-sdk.js"); return { v1: { FirestoreAdminClient: vi.fn(() => m.getFirestoreAdminClientMock()) } }; })`
    - `vi.mock("firebase-functions/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))`
    - vi.useFakeTimers + vi.setSystemTime(new Date("2026-05-15T10:00:00Z")) for the date-deterministic test
    - process.env.GCLOUD_PROJECT = "bedeveloped-base-layers" set in beforeEach; deleted in the missing-env test
    - Imports the function via dynamic import AFTER vi.mocks are registered: `const { scheduledFirestoreExport } = await import("../../src/backup/scheduledFirestoreExport.js")`
    - The 5 tests above; for behavioural pinning use `adminMockState._allExportCalls()` to assert the request shape

    Tests 1-5 must FAIL initially (file does not exist), then PASS after the source file lands. Use TDD red→green commits per project standard.
  </action>
  <verify>
    <automated>cd functions && npm test -- scheduledFirestoreExport 2>&1 | tail -20</automated>
  </verify>
  <done>
    - `functions/src/backup/scheduledFirestoreExport.ts` exists with the exact onSchedule config (schedule, region, serviceAccount: "backup-sa", timeoutSeconds: 540, memory: 256MiB) — verified by grep
    - `functions/test/backup/scheduledFirestoreExport.unit.test.ts` exists with exactly 5 tests covering the behaviours above; all 5 pass
    - `cd functions && npm test` exit 0; total test count = Phase 7 baseline (133) + 5 new = 138
    - `cd functions && npm run typecheck` exits 0
    - `cd functions && npm run build` exits 0 (compiles to lib/)
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Author functions/src/backup/getDocumentSignedUrl.ts (BACKUP-05)</name>
  <read_first>
    - functions/src/audit/auditWrite.ts (Pattern A callable structure — verbatim shape to mirror)
    - functions/src/auth/setClaims.ts (admin/role token-claim check pattern)
    - 08-RESEARCH.md §Pattern 5 (full code listing for getDocumentSignedUrl)
    - storage.rules (the path layout: orgs/{orgId}/documents/{docId}/{filename})
  </read_first>
  <behavior>
    - Test 1 (unit): unauthenticated request → throws HttpsError("unauthenticated")
    - Test 2 (unit): authenticated client with token.orgId="orgA" requesting orgId="orgA" → returns { url, expiresAt }; expiresAt within 60_000ms of now+3600_000
    - Test 3 (unit): authenticated client with token.orgId="orgA" requesting orgId="orgB" → throws HttpsError("permission-denied", /Not in org/)
    - Test 4 (unit): authenticated internal (token.role="internal", no orgId) requesting any orgId → succeeds
    - Test 5 (unit): authenticated admin (token.role="admin") requesting any orgId → succeeds
    - Test 6 (unit): invalid input (missing docId) → throws HttpsError("invalid-argument")
    - Test 7 (unit): the issued signed URL is recorded against bucket "bedeveloped-base-layers-uploads" with action "read" and expires within 1h of now
  </behavior>
  <files>functions/src/backup/getDocumentSignedUrl.ts, functions/test/backup/getDocumentSignedUrl.unit.test.ts</files>
  <action>
    Create `functions/src/backup/getDocumentSignedUrl.ts`:

    Imports:
    ```typescript
    import { onCall, HttpsError, type CallableRequest } from "firebase-functions/v2/https";
    import { logger } from "firebase-functions/logger";
    import { defineSecret } from "firebase-functions/params";
    import { initializeApp, getApps } from "firebase-admin/app";
    import { getStorage } from "firebase-admin/storage";
    import { z } from "zod";
    import { withSentry } from "../util/sentry.js";
    import { validateInput } from "../util/zod-helpers.js";

    if (!getApps().length) initializeApp();
    const SENTRY_DSN = defineSecret("SENTRY_DSN");

    const UPLOADS_BUCKET = "bedeveloped-base-layers-uploads";
    const SIGNED_URL_TTL_MS = 60 * 60 * 1000;  // BACKUP-05 — exactly 1 hour

    const SignedUrlInput = z.object({
      orgId: z.string().min(1).max(128),
      docId: z.string().min(1).max(128),
      filename: z.string().min(1).max(256),
    });
    ```

    File-header banner pattern (mirror auditWrite.ts header style):
    ```
    // Phase 8 Wave 1 (BACKUP-05 / FN-03 / FN-04 / FN-07 / Pitfall G):
    // getDocumentSignedUrl — replaces unbounded getDownloadURL() with V4 signed
    // URL TTL ≤ 1h (BACKUP-05). Pattern A standard callable shape.
    //
    //   - enforceAppCheck: true                         (FN-07)
    //   - serviceAccount: "storage-reader-sa"           (FN-04 — see runbook below)
    //   - secrets: [SENTRY_DSN]                         (FN-05)
    //   - withSentry handler wrapper                    (Pitfall 18 PII scrub)
    //   - validateInput(SignedUrlInput, request.data)   (Zod)
    //
    // Pitfall 17: caller's effective orgId comes from request.auth.token.orgId
    // (custom claim), NEVER from request.data. Internal/admin role bypasses
    // the orgId match.
    //
    // SA provisioning (operator step — runbooks/phase-8-backup-setup.md §5):
    //   gcloud iam service-accounts create storage-reader-sa --display-name="Phase 8 Storage signed URL issuer"
    //   gcloud storage buckets add-iam-policy-binding gs://bedeveloped-base-layers-uploads \
    //     --member="serviceAccount:storage-reader-sa@bedeveloped-base-layers.iam.gserviceaccount.com" \
    //     --role="roles/storage.objectViewer"
    //   gcloud iam service-accounts add-iam-policy-binding storage-reader-sa@<...>.iam.gserviceaccount.com \
    //     --member="serviceAccount:storage-reader-sa@<...>.iam.gserviceaccount.com" \
    //     --role="roles/iam.serviceAccountTokenCreator"
    // The serviceAccountTokenCreator self-binding is required for V4 signing
    // (Cloud Function uses metadata-server-issued ADC; V4 signing needs
    // the SA to be able to sign-as-itself).
    ```

    Handler:
    ```typescript
    export const getDocumentSignedUrl = onCall(
      {
        region: "europe-west2",
        enforceAppCheck: true,
        serviceAccount: "storage-reader-sa",
        secrets: [SENTRY_DSN],
        memory: "256MiB",
        timeoutSeconds: 30,
      },
      withSentry(async (request: CallableRequest<unknown>) => {
        if (!request.auth?.uid) {
          throw new HttpsError("unauthenticated", "Authentication required");
        }
        const data = validateInput(SignedUrlInput, request.data ?? {});

        // Pitfall 17: re-read role + orgId from verified ID token, never from payload.
        const token = (request.auth.token ?? {}) as Record<string, unknown>;
        const role = typeof token.role === "string" ? token.role : null;
        const callerOrgId = typeof token.orgId === "string" ? token.orgId : null;
        const isInternal = role === "internal" || role === "admin";

        if (!isInternal && callerOrgId !== data.orgId) {
          throw new HttpsError("permission-denied", "Not in org");
        }

        const path = `orgs/${data.orgId}/documents/${data.docId}/${data.filename}`;
        const file = getStorage().bucket(UPLOADS_BUCKET).file(path);

        const expiresAt = Date.now() + SIGNED_URL_TTL_MS;
        const [url] = await file.getSignedUrl({
          version: "v4",
          action: "read",
          expires: expiresAt,
        });

        logger.info("storage.signed_url.issued", {
          actorUid: request.auth.uid,
          orgId: data.orgId,
          docId: data.docId,
          ttlMs: SIGNED_URL_TTL_MS,
        });

        return { url, expiresAt };
      }),
    );
    ```

    Then create `functions/test/backup/getDocumentSignedUrl.unit.test.ts` mirroring auditWrite.integration.test.ts mock layout, but mock `firebase-admin/storage` instead of `firebase-admin/firestore`:
    ```typescript
    vi.mock("firebase-admin/storage", async () => {
      const m = await import("../_mocks/admin-sdk.js");
      return { getStorage: () => m.getStorageMock() };
    });
    ```
    + the standard mocks for `firebase-admin/app`, `firebase-functions/params`, `firebase-functions/logger`. Use `firebase-functions-test`'s `t.wrap(getDocumentSignedUrl)` to invoke. Auth contexts via `wrap()`'s second argument: `{ auth: { uid: "u-client", token: { orgId: "orgA", role: "client" } }, app: {} }` etc.

    Cover the 7 tests in <behavior>. Use `adminMockState._allSignedUrls()` to assert URL issuance shape.
  </action>
  <verify>
    <automated>cd functions && npm test -- getDocumentSignedUrl 2>&1 | tail -20</automated>
  </verify>
  <done>
    - `functions/src/backup/getDocumentSignedUrl.ts` exists with exact onCall config (enforceAppCheck:true, serviceAccount:"storage-reader-sa", region:europe-west2)
    - `getSignedUrl` is called with `version: "v4"`, `action: "read"`, and `expires: <Date.now()+3600000>` — pinned by Test 7
    - `functions/test/backup/getDocumentSignedUrl.unit.test.ts` exists with exactly 7 tests; all pass
    - `cd functions && npm test` exit 0; total test count = 138 (from Task 1) + 7 = 145
    - `cd functions && npm run typecheck` + `npm run build` both exit 0
  </done>
</task>

<task type="auto">
  <name>Task 3: Wire functions/src/index.ts exports + author firebase-functions-test integration tests</name>
  <read_first>
    - functions/src/index.ts (current 9 exports — Wave 2 ADDS only, never removes)
    - functions/test/integration/auditWrite.integration.test.ts (the offline-mode integration pattern)
  </read_first>
  <files>functions/src/index.ts, functions/test/integration/scheduledFirestoreExport.integration.test.ts, functions/test/integration/getDocumentSignedUrl.integration.test.ts</files>
  <action>
    1. **Add 2 lines to `functions/src/index.ts`** (between the existing exports — preserve order; group under a new comment banner):
       ```typescript
       // Phase 8 Wave 1 (08-02): backup substrate Cloud Functions.
       export { scheduledFirestoreExport } from "./backup/scheduledFirestoreExport.js";
       export { getDocumentSignedUrl } from "./backup/getDocumentSignedUrl.js";
       ```

    2. **Author `functions/test/integration/scheduledFirestoreExport.integration.test.ts`** mirroring `auditWrite.integration.test.ts` but for the scheduled function. Tests:
       - Test 1: `t.wrap(scheduledFirestoreExport)` invocation with empty event payload writes one entry to `adminMockState._allExportCalls()`; the entry's `outputUriPrefix` matches `^gs://bedeveloped-base-layers-backups/firestore/\d{4}-\d{2}-\d{2}$`
       - Test 2: invocation with the FirestoreAdminClient mock configured to throw rethrows the same error (verified via `await expect(t.wrap(scheduledFirestoreExport)({})).rejects.toThrow(/test-error/)`); use `vi.mocked(...).mockRejectedValueOnce(new Error("test-error"))` on the exportDocuments method

       Note: scheduled functions wrapped via firebase-functions-test 3.5 take an event-stub object. Verify exact wrap() signature from FFT 3.5 docs — fall back to invoking the inner handler directly if FFT 3.5 doesn't support onSchedule wrap (the unit test in Task 1 already covers handler logic; the integration test then becomes a smoke test verifying the export is registered).

    3. **Author `functions/test/integration/getDocumentSignedUrl.integration.test.ts`** mirroring auditWrite.integration.test.ts. Tests:
       - Test 1 (happy path admin): wrap() with auth `{ uid:"admin1", token:{ role:"admin" } }`, data `{ orgId:"orgA", docId:"d_xyz", filename:"report.pdf" }` returns `{ url:/^https:\/\/signed\.example/, expiresAt:<within 60_000ms of now+3600_000> }`; `adminMockState._allSignedUrls()` has one entry with `bucket:"bedeveloped-base-layers-uploads"`, `path:"orgs/orgA/documents/d_xyz/report.pdf"`, `action:"read"`
       - Test 2 (cross-tenant client deny): wrap() with auth `{ uid:"u1", token:{ role:"client", orgId:"orgB" } }`, data orgId:"orgA" → rejects with HttpsError code "permission-denied"
       - Test 3 (unauthenticated deny): wrap() with no auth context → rejects with HttpsError code "unauthenticated"
       - Test 4 (invalid input): wrap() with auth-admin + data `{ orgId:"orgA", docId:"" }` → rejects with code "invalid-argument"

    Re-export pattern: tests do `const { getDocumentSignedUrl } = await import("../../src/backup/getDocumentSignedUrl.js")` AFTER vi.mock setup.
  </action>
  <verify>
    <automated>cd functions && npm test 2>&1 | tail -20</automated>
  </verify>
  <done>
    - `functions/src/index.ts` exports both new functions; existing 9 exports unchanged (verified by `grep -c "^export" functions/src/index.ts` == 11)
    - `functions/test/integration/scheduledFirestoreExport.integration.test.ts` ≥ 2 tests, all pass
    - `functions/test/integration/getDocumentSignedUrl.integration.test.ts` ≥ 4 tests, all pass
    - `cd functions && npm test` exits 0; total test count = 145 (from Task 2) + 6 = 151 minimum (some integration assertions may overlap with unit; minimum is +2 in scheduled + +4 in signed-url integration files)
    - `cd functions && npm run build` exits 0; `lib/backup/scheduledFirestoreExport.js` and `lib/backup/getDocumentSignedUrl.js` exist after build
  </done>
</task>

<task type="auto">
  <name>Task 4: Author src/cloud/signed-url.js browser seam (BACKUP-05 client wrapper)</name>
  <read_first>
    - src/cloud/checkRateLimit.js (Pattern reference — vanilla JS @ts-check + httpsCallable wrapper)
    - src/cloud/claims-admin.js (Pattern reference — JSDoc shape + error contract)
    - src/firebase/functions.js (the functions instance + httpsCallable re-export — verify it exists; if not, the seam imports from "firebase/functions" directly per the existing pattern in checkRateLimit.js)
  </read_first>
  <files>src/cloud/signed-url.js</files>
  <action>
    Create new file `src/cloud/signed-url.js`. Pattern matches `src/cloud/checkRateLimit.js` exactly:

    ```javascript
    // src/cloud/signed-url.js
    // @ts-check
    // Phase 8 Wave 1 (BACKUP-05 / Pitfall G): browser seam for the
    // getDocumentSignedUrl callable. Replaces unbounded
    // getDownloadURL(ref) calls in src/data/documents.js + src/main.js with
    // a server-issued V4 signed URL bounded to 1 hour.
    //
    // Refresh-on-download: callers MUST issue a fresh callable invocation per
    // download click — DO NOT cache the returned url. The server-side TTL
    // enforces this; the client-side contract documents the expectation.
    //
    // Cleanup-ledger row: "Phase 8 (BACKUP-05) seam — getDownloadURL call sites
    // in src/data/documents.js + src/main.js converted in 08-03 Wave 2"
    // CLOSES with the 08-03 Wave 2 sweep.

    import { httpsCallable } from "firebase/functions";
    import { functions } from "../firebase/functions.js";

    const callable = httpsCallable(functions, "getDocumentSignedUrl");

    /**
     * Request a 1-hour V4 signed URL for a document.
     * @param {string} orgId
     * @param {string} docId
     * @param {string} filename
     * @returns {Promise<{ url: string, expiresAt: number }>}
     */
    export async function getDocumentSignedUrl(orgId, docId, filename) {
      const result = await callable({ orgId, docId, filename });
      const data = /** @type {{ url: string, expiresAt: number }} */ (result.data);
      return data;
    }
    ```

    Do NOT modify `src/data/documents.js` or `src/main.js` in this plan — those edits land in 08-03 Wave 2 alongside the soft-delete data-wrapper rewrite (single coordinated sweep avoids per-wave churn on documents.js).

    Verify the seam imports cleanly: `npm run typecheck` exits 0 + the existing `tests/index-html-meta-csp.test.js` doesn't break (no CSP impact).
  </action>
  <verify>
    <automated>npm run typecheck 2>&1 | tail -10 && npm test -- src/cloud 2>&1 | tail -10</automated>
  </verify>
  <done>
    - `src/cloud/signed-url.js` exists with `@ts-check` + JSDoc-typed `getDocumentSignedUrl(orgId, docId, filename)` export
    - File header cites BACKUP-05 + Pitfall G + cleanup-ledger forward pointer to 08-03 Wave 2
    - `npm run typecheck` exits 0
    - `npm test` (root) exits 0 — no regression in any existing src/ test
    - `grep -c "httpsCallable" src/cloud/signed-url.js` == 2 (one import, one usage)
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → callable | App Check token + Firebase ID token verified at edge |
| callable → Storage | scheduledFirestoreExport runs as `backup-sa`; getDocumentSignedUrl runs as `storage-reader-sa` |
| signed URL → public internet | URL is unauthenticated by design — anyone with the URL can fetch the object until TTL expires |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-08-02-01 | Information Disclosure | getDocumentSignedUrl | mitigate | TTL is exactly 1h (constant `SIGNED_URL_TTL_MS = 60 * 60 * 1000`); no caller-supplied TTL parameter exists in the Zod schema — input shape is `{ orgId, docId, filename }` only. |
| T-08-02-02 | Elevation of Privilege | getDocumentSignedUrl cross-tenant | mitigate | `callerOrgId` read EXCLUSIVELY from `request.auth.token.orgId`; `data.orgId` from payload is the requested target; mismatch + non-internal role → permission-denied (Test 3 in Task 2). |
| T-08-02-03 | Tampering | getDocumentSignedUrl input | mitigate | Zod schema with min/max length on every field; non-conforming input → invalid-argument (Test 6 in Task 2). |
| T-08-02-04 | Denial of Service | scheduledFirestoreExport | accept | Runs once daily as Cloud Scheduler job; no client invocation surface. Cloud Scheduler retry capped at 2 per `retryConfig`. Quota: 1 export/hour per project per Firebase docs — daily cron is well under. |
| T-08-02-05 | Repudiation | scheduledFirestoreExport | mitigate | Logs `backup.export.started` with `operationName` + `outputUriPrefix` on every successful invocation; `backup.export.failed` with err on failure. Cloud Logging captures invocation IDs. |
| T-08-02-06 | Spoofing | scheduledFirestoreExport SA | mitigate | Function deployed with explicit `serviceAccount: "backup-sa"`; SA has scoped roles only (datastore.importExportAdmin project + storage.objectAdmin on backups bucket). |
| T-08-02-07 | Information Disclosure | Signed URL leakage in logs | mitigate | `logger.info("storage.signed_url.issued", ...)` logs metadata (actorUid, orgId, docId, ttlMs) but NEVER the url itself. URL appears only in the function return value to the caller. |
| T-08-02-08 | Tampering | scheduledFirestoreExport replay | accept | onSchedule events have idempotency at the Cloud Scheduler tier; if a retry fires, a second export runs with the same outputUriPrefix (date-based) and overwrites. Output remains a valid Firestore export — accept. |
</threat_model>

<verification>
- `cd functions && npm run build` exits 0; `lib/backup/scheduledFirestoreExport.js` + `lib/backup/getDocumentSignedUrl.js` exist
- `cd functions && npm test` exits 0; total test count is Phase 7 baseline 133 + Wave 1 additions (≥ 5 + 7 + 2 + 4 = 18 new) = 151+
- `cd functions && npm run typecheck` exits 0
- `npm run typecheck` (root) exits 0 (signed-url.js JSDoc clean)
- `functions/src/index.ts` exports `scheduledFirestoreExport` AND `getDocumentSignedUrl`
- `src/cloud/signed-url.js` exists with `httpsCallable` + JSDoc-typed export
- No deploy in this plan — that gates on operator-side `backup-sa` + `storage-reader-sa` provisioning (per 08-01 Task 5 step 7 + this plan's Task 2 banner instructions). Deploy lands when 08-06 cleanup wave triggers the rules+functions deploy.
</verification>

<success_criteria>
- BACKUP-01 substrate: scheduledFirestoreExport Cloud Function authored + tested + exported from index.ts; deploy-ready pending operator SA provisioning
- BACKUP-05 substrate: getDocumentSignedUrl callable + browser seam authored + tested; deploy-ready pending operator `storage-reader-sa` provisioning
- Phase 7 baseline 133 tests still green
- 18+ new tests across unit + integration test files for the two new Cloud Functions
- Wave 2 (08-03) can wire `src/data/documents.js` to the new signed-url seam without further callable infrastructure work
</success_criteria>

<output>
After completion, create `.planning/phases/08-data-lifecycle-soft-delete-gdpr-backups/08-02-SUMMARY.md` covering:
- New Cloud Function file paths + line counts
- Test file paths + test counts (per file)
- Total test count delta from Phase 7 baseline (133 → ≥ 151)
- functions/src/index.ts export delta (9 → 11)
- Forward pointers: 08-03 Wave 2 wires src/data/documents.js getDownloadURL → src/cloud/signed-url.js; 08-06 close-gate triggers Cloud Function deploy alongside rules redeploy
- Operator-action note: `storage-reader-sa` SA provisioning is queued for the cleanup wave (08-06 close-gate or operator follow-up)
</output>
