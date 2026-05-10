# Phase 8: Data Lifecycle (Soft-Delete + GDPR + Backups) — Research

**Researched:** 2026-05-10
**Domain:** Firebase data lifecycle, GDPR compliance, GCS backup infrastructure, Cloud Functions scheduled jobs
**Confidence:** HIGH (standard stack and APIs verified via official docs; patterns verified via codebase inspection)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Firebase only (no Vercel/Supabase migration).
- Vanilla JS + Vite + Vitest + JSDoc-as-typecheck (no TS in src/; TS only in functions/).
- Clean cutover migrations are acceptable — no live users.
- Compliance bar = credible, not certified.
- **Pitfall 10 order is non-negotiable within this phase: BACKUP-* infrastructure must be live before GDPR erasure (gdprEraseUser) runs.** Same principle that mandated Phase 5 → Phase 6 ordering applies inside Phase 8: backup → soft-delete → GDPR.

### Claude's Discretion
All implementation choices (internal function structure, test seam shapes, wave ordering) are at Claude's discretion per `workflow.skip_discuss=true`.

### Deferred Ideas (OUT OF SCOPE)
- None explicitly deferred. Anything not in LIFE-*, GDPR-*, BACKUP-*, DOC-10 is out of scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIFE-01 | Soft-delete + 30-day restore window across orgs, comments, documents, messages, funnel comments | §Architecture Patterns: soft-delete lifecycle, Cloud Function patterns |
| LIFE-02 | Soft-delete writes `deletedAt` tombstone + snapshot at `softDeleted/{type}/items/{id}` | §Soft-Delete Pattern; snapshot-then-tombstone in single Admin SDK batch |
| LIFE-03 | Rules hide soft-deleted docs from normal queries | §Firestore Rules: query constraint validation; CRITICAL caveat in Common Pitfalls |
| LIFE-04 | `restoreSoftDeleted` callable CF (admin-only) | §Cloud Function Patterns; existing seam at `src/cloud/soft-delete.js` |
| LIFE-05 | Daily `scheduledPurge` CF hard-deletes records past 30-day window | §onSchedule pattern; §Scheduled Function Code |
| LIFE-06 | Soft-delete UI in admin panel | Research scope: client seam at `src/cloud/soft-delete.js`; view at `src/views/admin.js` |
| GDPR-01 | `gdprExportUser` CF returns signed-URL JSON bundle (TTL ≤ 24h) | §Signed URL; §GDPR Export pattern |
| GDPR-02 | `gdprEraseUser` CF — deterministic pseudonym token, replaces authorId across all collections | §Pseudonym Token Strategy; Firestore batch write |
| GDPR-03 | Erasure cascade covers messages, comments, actions, documents, funnelComments + Storage | §Erasure Cascade; Storage enumeration pattern |
| GDPR-04 | Audit log retained but PII tombstoned; GDPR Art. 6(1)(f) legitimate interest documented | §Audit Log vs Erasure Conflict |
| GDPR-05 | `redactionList` consumed by backup rotation | §redactionList Pattern |
| BACKUP-01 | Daily scheduled Firestore export → GCS `gs://bedeveloped-base-layers-backups/firestore/{YYYY-MM-DD}/` | §Firestore Export Cloud Function |
| BACKUP-02 | GCS lifecycle: 30d Standard → 90d Nearline → 365d Archive | §GCS Lifecycle Policy |
| BACKUP-03 | Firestore PITR enabled (7-day rolling) | §Firestore PITR |
| BACKUP-04 | Storage bucket Object Versioning + 90-day soft delete | §Storage Bucket Setup |
| BACKUP-05 | Signed URL TTL ≤ 1h with refresh-on-download | §Signed URL Callable |
| BACKUP-06 | Quarterly restore-drill cadence documented | §Restore Drill Runbook |
| BACKUP-07 | One restore drill performed + documented before milestone close | §Restore Drill Runbook |
| DOC-10 | Incremental `SECURITY.md` append | §Documentation Increment |
</phase_requirements>

---

## Summary

Phase 8 is the recoverability and data-rights phase. It has three distinct sub-stacks that must be built in order: (1) GCS backup bucket + Firestore PITR + daily export Cloud Function; (2) soft-delete lifecycle with Cloud Functions and Rules; (3) GDPR export and erasure Cloud Functions. The order is load-bearing per Pitfall 10: backup must be proven live before any GDPR erasure runs, because the restore substrate is the safety net if erasure goes wrong.

The technical surface is wider than any previous phase but each sub-problem has a well-understood solution on Firebase Gen2. The main risks are: (a) the Firestore Rules soft-delete predicate caveat — rules cannot act as query filters, so client queries must explicitly include `where('deletedAt', '==', null)`; (b) the GDPR erasure cascade spans six collections and Storage objects, requiring a careful Firestore batched-write + Admin Storage enumeration pattern to avoid missing a reference; (c) the `scheduledPurge` function must handle large result sets (pagination with `startAfter`) rather than a single `getDocs()` call to avoid Cloud Function timeout.

**Primary recommendation:** Organise the phase into four waves: Wave 1 (backup substrate: bucket, PITR, lifecycle policy, scheduled export CF), Wave 2 (soft-delete CFs + Rules updates + client seam bodies), Wave 3 (GDPR CFs: export + erasure + redactionList), Wave 4 (restore drill runbook + SECURITY.md increment). Client seam bodies (`src/cloud/soft-delete.js`, `src/cloud/gdpr.js`) fill in during Waves 2–3 so admin UI can wire up.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Soft-delete initiation | Cloud Functions (Admin SDK) | Firestore Rules (deny client write to softDeleted) | Soft-delete must be server-mediated to snapshot before tombstoning; client must not write `deletedAt` directly |
| Soft-deleted visibility filter | Firestore Rules + Client query | — | Rules validate `deletedAt == null` constraint on list; client must supply the where clause |
| Scheduled purge (hard-delete) | Cloud Functions (onSchedule) | — | Needs Admin SDK + pagination; no client involvement |
| GDPR export assembly | Cloud Functions (Admin SDK) | GCS signed URL | Assembles multi-collection data server-side; signed URL issued with 24h TTL |
| GDPR erasure cascade | Cloud Functions (Admin SDK) | — | Writes across 6 collections + Storage; must not be client-callable |
| Firestore daily backup | Cloud Functions (onSchedule) | GCS bucket (destination) | FirestoreAdminClient.exportDocuments runs entirely server-side |
| PITR management | GCloud CLI / GCP Console | — | One-time operator action; not a Code Function |
| GCS lifecycle policy | GCloud CLI / terraform-like script | — | Operator provisioning; idempotent script pattern per Phase 7 Wave 5 |
| Storage signed URL (documents) | Cloud Functions (callable) | Client refresh-on-download | Server-side signing avoids exposing service-account key in browser |
| Storage bucket versioning + soft delete | GCloud CLI / idempotent script | — | Operator provisioning action |
| Restore drill | Human operator | runbook | Cannot be automated end-to-end; must be human-executed per BACKUP-07 |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase-functions` | 7.2.5 [VERIFIED: npm registry] | `onCall`, `onSchedule` v2 | Already in functions/package.json; v2 exclusive |
| `firebase-admin` | 13.9.0 [VERIFIED: npm registry] | Admin SDK: Firestore, Auth, Storage | Already in functions/package.json |
| `@google-cloud/firestore` | 8.5.0 [VERIFIED: npm registry] | `v1.FirestoreAdminClient` for `exportDocuments` | Only way to call the export API from Node; `firebase-admin` exposes Firestore data APIs but not the Admin/export API |
| `@google-cloud/storage` | 7.19.0 [VERIFIED: npm registry] | `getSignedUrl` v4 on Storage bucket objects | Admin SDK's `getStorage()` provides bucket access; `@google-cloud/storage` is the underlying library; already transitively installed |
| `zod` | 4.4.3 [VERIFIED: functions/package.json] | Input validation on all callables | Project standard (Pattern A) |
| `firebase-functions-test` | 3.5.0 [VERIFIED: functions/package.json] | `wrap()` for integration tests | Project standard (Pattern 11 — offline mode) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:crypto` | built-in | `createHash('sha256')` for deterministic pseudonym token | gdprEraseUser — deterministic per-user tombstone |
| `node:stream` | built-in | Multi-collection JSON bundle assembly for GDPR export | Streaming to GCS avoids memory blow-up on large exports |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@google-cloud/firestore` for export | `gcloud firestore export` CLI in a Cloud Run job | CLI is simpler but requires a separate container image; `FirestoreAdminClient` is callable from existing Cloud Function with no new infrastructure |
| Deterministic sha256 token | Random UUID per erasure | Random token breaks idempotency — if erasure crashes and reruns, a different token is written, leaving orphan references in some collections |
| Streaming GDPR export to GCS | In-memory JSON string | Memory limit on Cloud Functions Gen2 is 256–4096 MiB; large exports risk OOM; streaming to GCS with a writable pipe is safer |

**Installation (functions/ workspace only):**
```bash
cd functions && npm install @google-cloud/firestore@8.5.0
```
`@google-cloud/storage` is already a transitive dep of `firebase-admin`; no explicit install needed unless a version pin is required.

---

## Architecture Patterns

### System Architecture Diagram

```
                    BROWSER (vanilla JS)
                         │
              src/cloud/soft-delete.js  ←── Phase 4 stub body fills Wave 2
              src/cloud/gdpr.js         ←── Phase 4 stub body fills Wave 3
                         │
                         │ App Check token + ID token
                         ▼
              ┌──────────────────────────────────────────────┐
              │         Cloud Functions (Gen2, europe-west2) │
              │                                              │
              │  onCallSoftDelete ────┐                      │
              │  onCallRestore    ────┤── Admin SDK batch    │
              │  scheduledPurge   ────┘── write/delete       │
              │                              │               │
              │  gdprExportUser ─────────────┤── multi-coll  │
              │  gdprEraseUser  ─────────────┘── Admin SDK   │
              │                              │               │
              │  scheduledBackup ──────┐     │               │
              │  (FirestoreAdminClient)│     │               │
              │                        ▼     ▼               │
              │            ┌──────────────────────────────┐  │
              │            │         Firestore            │  │
              │            │  orgs/{id}/messages/{id}     │  │
              │            │  orgs/{id}/comments/{id}     │  │
              │            │  orgs/{id}/actions/{id}      │  │
              │            │  orgs/{id}/documents/{id}    │  │
              │            │  orgs/{id}/funnelComments    │  │
              │            │  softDeleted/{type}/items/   │  │
              │            │  auditLog/{eventId}          │  │
              │            │  redactionList/{uid}         │  │ ← new
              │            └──────────────┬───────────────┘  │
              │                           │                   │
              │            ┌──────────────▼───────────────┐  │
              │            │    Cloud Storage              │  │
              │            │  bedeveloped-base-layers-     │  │
              │            │    uploads (documents)        │  │
              │            │  bedeveloped-base-layers-     │  │
              │            │    backups (daily export)     │  │
              │            │    firestore/{YYYY-MM-DD}/    │  │
              │            │    gdpr-exports/{uid}/{ts}/   │  │
              │            └──────────────────────────────┘  │
              └──────────────────────────────────────────────┘
                  ▲
                  │ gcloud PITR enable (operator, one-time)
                  │ gcloud lifecycle set  (operator, one-time)
                  └── GCP Console / scripts/
```

### Recommended Project Structure (Phase 8 additions)

```
functions/
├── src/
│   ├── lifecycle/                    ← NEW Wave 2
│   │   ├── softDelete.ts             # onCallSoftDelete callable
│   │   ├── restoreSoftDeleted.ts     # onCallRestore callable
│   │   └── scheduledPurge.ts        # onSchedule daily purge
│   ├── gdpr/                         ← NEW Wave 3
│   │   ├── gdprExportUser.ts         # onCallExportUser callable
│   │   └── gdprEraseUser.ts          # onCallEraseUser callable
│   ├── backup/                       ← NEW Wave 1
│   │   └── scheduledFirestoreExport.ts
│   └── index.ts                      # add new exports here
│
src/
├── cloud/
│   ├── soft-delete.js   ← body fills Wave 2 (LIFE-04 stub already exists)
│   └── gdpr.js          ← body fills Wave 3 (GDPR-01/02 stub already exists)
│
runbooks/
├── restore-drill-<date>.md           ← NEW Wave 4 (BACKUP-07)
└── phase-8-backup-setup.md           ← NEW Wave 1 operator steps

scripts/
└── setup-backup-bucket/
    └── run.js                        ← NEW Wave 1 (idempotent GCS setup)
```

---

### Pattern 1: Scheduled Firestore Export (BACKUP-01)

**What:** Cloud Function runs on cron, calls `FirestoreAdminClient.exportDocuments()` to copy all Firestore data to GCS.
**When to use:** BACKUP-01 — daily export.

```typescript
// Source: https://firebase.google.com/docs/firestore/solutions/schedule-export
// Adapted for Gen2 + TypeScript + europe-west2 + per-function SA pattern

import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions/logger";
import { Firestore } from "@google-cloud/firestore";

const BACKUP_BUCKET = "gs://bedeveloped-base-layers-backups";

export const scheduledFirestoreExport = onSchedule(
  {
    schedule: "0 2 * * *",          // 02:00 UTC daily
    timeZone: "UTC",
    region: "europe-west2",
    timeoutSeconds: 540,            // 9 min — export can be slow
    memory: "256MiB",
    retryConfig: { retryCount: 2 },
    serviceAccount: "backup-sa",   // minimal IAM: datastore.importExportAdmin + storage.objectAdmin on bucket
  },
  async (_event) => {
    const client = new Firestore.v1.FirestoreAdminClient();
    const projectId = process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT;
    const databaseName = client.databasePath(projectId!, "(default)");
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const outputUriPrefix = `${BACKUP_BUCKET}/firestore/${date}`;

    try {
      const [operation] = await client.exportDocuments({
        name: databaseName,
        outputUriPrefix,
        collectionIds: [],  // empty = all collections
      });
      logger.info("backup.export.started", { operationName: operation.name, outputUriPrefix });
    } catch (err) {
      logger.error("backup.export.failed", { err });
      throw err;  // causes Cloud Scheduler retry
    }
  }
);
```

**IAM requirements (operator, one-time):**
```bash
# Grant backup-sa the Firestore export role
gcloud projects add-iam-policy-binding bedeveloped-base-layers \
  --member="serviceAccount:backup-sa@bedeveloped-base-layers.iam.gserviceaccount.com" \
  --role="roles/datastore.importExportAdmin"

# Grant backup-sa write access to the backups bucket
gcloud storage buckets add-iam-policy-binding gs://bedeveloped-base-layers-backups \
  --member="serviceAccount:backup-sa@bedeveloped-base-layers.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

---

### Pattern 2: GCS Lifecycle Policy (BACKUP-02)

**What:** JSON lifecycle rule on the backups bucket transitions objects through storage classes.
**When to use:** Applied once via `gcloud` or idempotent script to `bedeveloped-base-layers-backups`.

```json
// Source: https://docs.cloud.google.com/storage/docs/lifecycle-configurations [VERIFIED]
// File: scripts/setup-backup-bucket/lifecycle.json
{
  "rule": [
    {
      "action": { "type": "SetStorageClass", "storageClass": "NEARLINE" },
      "condition": { "age": 30, "matchesStorageClass": ["STANDARD"] }
    },
    {
      "action": { "type": "SetStorageClass", "storageClass": "ARCHIVE" },
      "condition": { "age": 365, "matchesStorageClass": ["NEARLINE"] }
    }
  ]
}
```

**Note on minimum storage durations [VERIFIED: GCS docs]:**
- Nearline minimum: 30 days. Objects transitioned at day 30 satisfy this.
- Archive minimum: 365 days. Objects moved from Nearline at day 365 satisfy this.
- The roadmap specifies "90d Nearline" — in the lifecycle rule, the age-based transitions implement the retention timeline. Objects stay in Nearline from day 30 to day 365 (which is > 90 days), satisfying "90d Nearline" semantically. No separate intermediate Coldline tier is needed.

**Apply via idempotent script:**
```bash
# scripts/setup-backup-bucket/run.js (Node.js Admin SDK pattern)
gcloud storage buckets update gs://bedeveloped-base-layers-backups \
  --lifecycle-file=lifecycle.json
```

---

### Pattern 3: Firestore PITR (BACKUP-03)

**What:** Enable point-in-time recovery for 7-day rolling window.
**When to use:** One-time operator action before any production data lifecycle begins.

```bash
# Source: https://firebase.google.com/docs/firestore/use-pitr [VERIFIED]
gcloud firestore databases update \
  --database="(default)" \
  --enable-pitr \
  --project=bedeveloped-base-layers
```

**Restore from PITR [VERIFIED: Firebase docs]:**
```bash
# Clone database at a past timestamp to a new database ID
gcloud firestore databases clone \
  --source-database="projects/bedeveloped-base-layers/databases/(default)" \
  --snapshot-time="2026-05-09T10:00:00.00Z" \   # must be whole-minute granularity
  --destination-database="restore-$(date +%Y%m%d)"
```

**Cost model [VERIFIED: GCP docs]:**
- Billed separately from Firestore storage at PITR-specific per-GB-month rate
- ~Same order of magnitude as your live DB size
- Read operations during PITR window (stale reads or exports) incur standard read costs
- No free tier — requires Blaze plan (already in use per Phase 7)

---

### Pattern 4: Storage Bucket Versioning + Soft Delete (BACKUP-04)

**What:** Enable Object Versioning + set soft-delete retention to 90 days on the uploads bucket.
**When to use:** One-time operator action on `bedeveloped-base-layers-uploads`.

```bash
# Source: https://docs.cloud.google.com/storage/docs/soft-delete [VERIFIED]
# Enable soft delete (90 days max)
gcloud storage buckets update gs://bedeveloped-base-layers-uploads \
  --soft-delete-duration=7776000s   # 90 days in seconds

# Enable Object Versioning
gcloud storage buckets update gs://bedeveloped-base-layers-uploads \
  --versioning
```

**Cost note [VERIFIED: GCS soft-delete docs]:** Soft-deleted objects are charged at their storage class rate until the retention period expires. This is expected — the uploads bucket holds client documents, not ephemeral data.

**Interaction with Object Versioning [VERIFIED: GCS docs]:** When both are enabled, deleting a noncurrent version moves it to soft-deleted state (not immediately permanent), providing layered protection.

---

### Pattern 5: Signed URL Callable (BACKUP-05)

**What:** Callable Cloud Function issues a short-lived V4 signed URL for a document download, replacing the unbounded `getDownloadURL` pattern.
**When to use:** BACKUP-05 — client calls this instead of `getDownloadURL()`.

```typescript
// Source: https://cloud.google.com/storage/docs/samples/storage-generate-signed-url-v4 [VERIFIED]
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getStorage } from "firebase-admin/storage";
import { withSentry } from "../util/sentry.js";

export const getDocumentSignedUrl = onCall(
  {
    region: "europe-west2",
    enforceAppCheck: true,
    serviceAccount: "storage-reader-sa",
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  withSentry(async (request) => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Auth required");

    const { orgId, docId, filename } = request.data as { orgId: string; docId: string; filename: string };
    // Validate caller is inOrg(orgId) via custom claims
    const token = request.auth.token as Record<string, unknown>;
    const callerOrgId = token.orgId as string | undefined;
    const role = token.role as string | undefined;
    const isInternal = role === "internal" || role === "admin";
    if (!isInternal && callerOrgId !== orgId) {
      throw new HttpsError("permission-denied", "Not in org");
    }

    const path = `orgs/${orgId}/documents/${docId}/${filename}`;
    const bucket = getStorage().bucket("bedeveloped-base-layers-uploads");
    const file = bucket.file(path);

    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 60 * 60 * 1000,  // 1 hour
    });

    return { url, expiresAt: Date.now() + 60 * 60 * 1000 };
  })
);
```

**Client refresh-on-download pattern (src/cloud/signed-url.js):** Client calls this callable when user clicks download; no cached URL is stored. Each download click issues a fresh 1h URL. Prior `getDownloadURL()` call sites are replaced.

---

### Pattern 6: Soft-Delete Callable (LIFE-01/02/04)

**What:** Admin-only callable writes `deletedAt` tombstone on the target doc AND snapshots the full document to `softDeleted/{type}/items/{id}` in a single Firestore batch.
**When to use:** LIFE-02 — soft delete of any doc type.

```typescript
// Source: [ASSUMED - standard Firestore batch pattern; Admin SDK docs confirm batch.set/batch.update atomicity]
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { withSentry } from "../util/sentry.js";
import { validateInput } from "../util/zod-helpers.js";
import { z } from "zod";

const softDeleteInput = z.object({
  type: z.enum(["org", "comment", "document", "message", "funnelComment"]),
  orgId: z.string(),
  id: z.string(),
  clientReqId: z.string().uuid(),
});

export const softDelete = onCall(
  { region: "europe-west2", enforceAppCheck: true, serviceAccount: "lifecycle-sa", memory: "256MiB" },
  withSentry(async (request) => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Auth required");
    const token = request.auth.token as Record<string, unknown>;
    if (token.role !== "admin") throw new HttpsError("permission-denied", "Admin only");

    const data = validateInput(softDeleteInput, request.data);
    const db = getFirestore();

    // Resolve the live document path by type
    const liveRef = resolveDocRef(db, data.type, data.orgId, data.id);
    const liveSnap = await liveRef.get();
    if (!liveSnap.exists) throw new HttpsError("not-found", "Document not found");
    if (liveSnap.data()?.deletedAt != null) throw new HttpsError("failed-precondition", "Already deleted");

    const batch = db.batch();
    // 1. Tombstone on live doc
    batch.update(liveRef, { deletedAt: FieldValue.serverTimestamp(), deletedBy: request.auth.uid });
    // 2. Snapshot to softDeleted collection (full doc preserved)
    const snapshotRef = db.doc(`softDeleted/${data.type}/items/${data.id}`);
    batch.set(snapshotRef, { ...liveSnap.data(), deletedAt: FieldValue.serverTimestamp(), deletedBy: request.auth.uid });
    await batch.commit();

    return { ok: true };
  })
);
```

---

### Pattern 7: Scheduled Purge (LIFE-05) — pagination required

**What:** Daily `onSchedule` function queries `softDeleted/{type}/items/{id}` for records past the 30-day window and hard-deletes them in batches.
**Critical:** Must paginate with `startAfter` — a single `getDocs()` over the full softDeleted collection can exceed Function memory/timeout for large datasets.

```typescript
// Source: [ASSUMED - standard Firestore pagination pattern; official docs confirm getDocs with startAfter]
export const scheduledPurge = onSchedule(
  { schedule: "0 3 * * *", timeZone: "UTC", region: "europe-west2", timeoutSeconds: 540, memory: "512MiB" },
  async (_event) => {
    const db = getFirestore();
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - THIRTY_DAYS_MS);

    for (const type of ["org", "comment", "document", "message", "funnelComment"]) {
      let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | undefined;
      while (true) {
        let q = db.collection(`softDeleted/${type}/items`)
          .where("deletedAt", "<", cutoff)
          .orderBy("deletedAt")
          .limit(500);
        if (lastDoc) q = q.startAfter(lastDoc);
        const snap = await q.get();
        if (snap.empty) break;

        const batch = db.batch();
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        lastDoc = snap.docs[snap.docs.length - 1];
      }
    }
  }
);
```

---

### Pattern 8: GDPR Export (GDPR-01)

**What:** Admin-callable assembles all user-linked data across six Firestore collections into a JSON object, writes it to GCS, returns a signed URL with TTL ≤ 24h.
**Key design:** Data assembly via parallel `getDocs()` queries, then a single `file.save()` to GCS, then `getSignedUrl()`.

```typescript
// Source: [ASSUMED - standard pattern; firebase-admin Storage.file().save() is documented API]
const GDPR_EXPORT_BUCKET = "bedeveloped-base-layers-backups";

// Queries to run in parallel:
const [userSnap, auditSnap, ...subcollSnaps] = await Promise.all([
  db.doc(`users/${userId}`).get(),
  db.collection("auditLog").where("actor.uid", "==", userId).get(),
  // responses, comments, messages, actions, funnelComments filtered by authorId/userId
]);

const bundle = { user: userSnap.data(), auditEvents: auditSnap.docs.map(d => d.data()), /* ... */ };
const path = `gdpr-exports/${userId}/${Date.now()}/export.json`;
const file = getStorage().bucket(GDPR_EXPORT_BUCKET).file(path);
await file.save(JSON.stringify(bundle), { contentType: "application/json" });
const [url] = await file.getSignedUrl({ version: "v4", action: "read", expires: Date.now() + 24 * 60 * 60 * 1000 });
return { url };
```

---

### Pattern 9: GDPR Erasure — Deterministic Pseudonym Token (GDPR-02/03)

**What:** Generates a consistent per-user tombstone token, then replaces `authorId` across all denormalised collections using Firestore bulk writes. Adds user to `redactionList`.

**Pseudonym token strategy [VERIFIED: ICO/EDPB pattern; sha256 deterministic approach verified in PITFALLS.md §11]:**
```typescript
// Source: PITFALLS.md §11 [CITED] + node:crypto docs [VERIFIED]
import { createHash } from "node:crypto";

function tombstoneTokenForUser(uid: string, projectSecret: string): string {
  // Deterministic: same uid + secret always yields same token
  // Irreversible: sha256 one-way; token cannot be used to recover uid
  return "deleted-user-" + createHash("sha256").update(uid + projectSecret).digest("hex").slice(0, 16);
}
```

**The `projectSecret` is stored in Firebase Secret Manager via `defineSecret("GDPR_PSEUDONYM_SECRET")`** — a stable 32-byte random value generated once at Phase 8 setup. This ensures idempotency: if erasure is re-run (crash recovery), the same tombstone token is written.

**Erasure cascade — six collections that hold `authorId` / `userId` references [VERIFIED: from REQUIREMENTS.md GDPR-03 + data model in firestore.rules]:**
1. `orgs/{orgId}/messages/{id}` — `authorId` field
2. `orgs/{orgId}/comments/{id}` — `authorId` field
3. `orgs/{orgId}/actions/{id}` — `ownerId` field (action assignee)
4. `orgs/{orgId}/documents/{id}` — `uploaderId` field [ASSUMED — verify against actual data model in Phase 8 plan]
5. `funnelComments/{id}` — `authorId` field
6. `users/{uid}` — the user doc itself (redact PII fields: name, email, avatar)
7. `Storage objects` under `orgs/*/documents/` where the upload is attributed to the user

**Firestore batched-write limit:** Firestore batches cap at 500 operations per commit. For large orgs, use multiple batches. The erasure function must paginate (same pattern as scheduledPurge) to avoid exceeding batch limits.

**Audit log handling (GDPR-04):** `auditLog/{eventId}` records where `actor.uid == userId` are NOT deleted (legitimate interest under Art. 6(1)(f) — audit-trail integrity). Instead, `actor.email` and any PII payload fields are set to the tombstone token. The `actor.uid` itself is also replaced (it is a de-facto identifier). This is the ICO-confirmed "tombstone" pattern [CITED: PITFALLS.md §11, EDPB guidelines].

---

### Pattern 10: redactionList (GDPR-05)

**What:** After erasure, write a `redactionList/{uid}` doc recording the tombstone token and erasure timestamp. Backup rotation cycle checks this list before restoring.

```typescript
// Source: [ASSUMED - this is the standard pattern; PITFALLS.md §11 documents the concept]
await db.doc(`redactionList/${userId}`).set({
  tombstoneToken,
  erasedAt: FieldValue.serverTimestamp(),
  erasedBy: request.auth.uid,
});
```

**Backup rotation:** On restore, after importing a Firestore export, run a post-import redaction script that iterates `redactionList` and re-applies tombstone tokens. This prevents restored data from re-exposing erased PII. The script is documented in the restore-drill runbook (BACKUP-07).

---

### Pattern 11: Firestore Rules — Soft-Delete Predicate (LIFE-03)

**CRITICAL CAVEAT [VERIFIED: Firebase security rules query docs]:** Security rules are **not filters**. A rule `allow read: if resource.data.deletedAt == null` does NOT hide deleted documents from queries — instead, it causes the entire list query to FAIL if the client query could return any document with `deletedAt != null`. The correct pattern requires both a rule constraint AND a matching client query `where` clause.

**Existing `notDeleted` predicate in firestore.rules (already present from Phase 5):**
```javascript
// Already in firestore.rules (Phase 5 artifact):
function notDeleted(r) { return !("deletedAt" in r) || r.deletedAt == null; }
```

**Rule update needed for list operations (Phase 8 adds `allow list`):**
```javascript
// Addition needed in Phase 8 — currently rules only have `allow read` (single doc)
// List rules for subcollections that support soft-delete:
match /orgs/{orgId}/messages/{msgId} {
  allow read:   if inOrg(orgId) && notDeleted(resource.data);
  allow list:   if inOrg(orgId);  // list validated by query constraint below
  // ...
}
```

**Client query pattern (mandatory — data/*.js wrappers):**
```javascript
// ALL list queries on soft-deletable collections MUST include this where clause:
query(collection(db, `orgs/${orgId}/messages`), where("deletedAt", "==", null))
// Without this clause, the security rule will reject the query outright
```

**Practical decision:** The `notDeleted` predicate on individual `get` (single-doc read) already works. For `list` operations, the data wrapper files (`src/data/messages.js`, etc.) must add `where("deletedAt", "==", null)` to their queries. This is a client-side query change, not a rules change.

---

### Anti-Patterns to Avoid

- **Relying on Rules alone to hide soft-deleted docs from list queries:** Rules are not filters. Clients that omit `where("deletedAt", "==", null)` will get a permission denied error, not filtered results.
- **Single `getDocs()` in scheduledPurge:** Without pagination, a large `softDeleted` collection will exceed Cloud Function memory or the 9-minute timeout. Use 500-doc batch pagination.
- **Random token per erasure run:** Using `crypto.randomUUID()` for the pseudonym makes the erasure non-idempotent. A crashed-and-restarted erasure writes different tokens to different collections, breaking referential integrity.
- **Storing the GDPR pseudonym secret in environment variables:** Must use `defineSecret()` per project pattern (FN-05).
- **Calling `getDownloadURL()` from client post-Phase 8:** This bypass is removed. All document URLs flow through `getDocumentSignedUrl` callable.
- **Mutating GCS backup objects in place to propagate erasure:** Do not try to rewrite backup files to remove PII. The correct pattern is to append the user to `redactionList` and re-run erasure on any restored database.
- **Running `gdprEraseUser` before backup is live:** Pitfall 10. No erasure until `scheduledFirestoreExport` has run at least once and produced a verified backup.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Firestore export API | Custom `getDocs` + JSON dump to GCS | `FirestoreAdminClient.exportDocuments()` | The Admin export produces a binary Firestore format that can be imported back with `importDocuments`; a custom JSON dump cannot |
| PITR | Hourly snapshotting Cloud Function | `gcloud firestore databases update --enable-pitr` | PITR is a managed Firebase feature; custom snapshots miss write-between-snapshot gaps |
| Signed URL generation | Client-side URL construction | `file.getSignedUrl({ version: "v4" })` in Cloud Function | Client cannot sign with service account key; server-side is the only correct approach |
| Pseudonym token | UUID per erasure | `sha256(uid + secret)` | UUID is non-idempotent; sha256 is deterministic and irreversible |
| GCS lifecycle rules | Lambda to check object age and move objects | `gcloud storage buckets update --lifecycle-file` | Lifecycle management is a native GCS feature; custom mover introduces race conditions and costs additional function invocations |

**Key insight:** Every sub-problem in this phase (export, PITR, lifecycle, signed URLs, pseudonymisation) has a native GCP/Firebase solution. The risk is building custom infrastructure where GCP already provides the primitive.

---

## Runtime State Inventory

> Rename/refactor triggers this section. Phase 8 is NOT a rename phase, but this section documents runtime state that Phase 8 MUST interact with.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Firestore collections: `softDeleted/{type}/items/{id}` — already declared in firestore.rules (Phase 5 artifact); currently empty | Phase 8 starts writing to this collection; no migration needed |
| Stored data | `redactionList/{uid}` — new collection, not yet in Firestore or rules | Phase 8 creates this collection; rules must add `allow read: if isAdmin(); allow write: if false` (server-only) |
| Live service config | GCS bucket `bedeveloped-base-layers-uploads` — exists (Phase 5); currently NO versioning or soft-delete | Phase 8 Wave 1 enables versioning + 90-day soft delete via idempotent script |
| Live service config | GCS bucket `bedeveloped-base-layers-backups` — may not yet exist | Phase 8 Wave 1 creates it + sets lifecycle policy |
| Live service config | Firestore PITR — currently DISABLED (not yet set) | Phase 8 Wave 1 enables via gcloud |
| Secrets/env vars | `GDPR_PSEUDONYM_SECRET` — does not exist yet | Phase 8 Wave 3: create via Firebase Secret Manager; add `defineSecret("GDPR_PSEUDONYM_SECRET")` to gdprEraseUser |
| Build artifacts | `functions/lib/` compiled output — will need rebuild after new modules land | Standard `cd functions && npm run build` in each wave |

**Nothing found in OS-registered state, build artifacts (beyond lib/ rebuild), or task scheduler categories** — verified by inspection of repo and runbooks.

---

## Common Pitfalls

### Pitfall A: Rules are not query filters (LIFE-03)
**What goes wrong:** Developer adds `notDeleted(resource.data)` to `allow read` rule and assumes list queries will silently skip soft-deleted documents.
**Why it happens:** Confusion between Firestore Rules and SQL `WHERE` clauses.
**How to avoid:** Every `subscribe*()` function in `src/data/*.js` for soft-deletable collections must add `.where("deletedAt", "==", null)`. The rule then validates the query constraint rather than filtering results.
**Warning signs:** Client receives `permission-denied` on list queries after soft-delete is deployed — indicates the query lacks the `where` clause.

### Pitfall B: scheduledPurge timeout on large softDeleted collections
**What goes wrong:** `getDocs(collection(db, "softDeleted/comment/items"))` returns thousands of docs, takes > 9 minutes, Cloud Function times out mid-batch leaving partial deletes.
**Why it happens:** No pagination.
**How to avoid:** Use 500-doc paginated batches with `startAfter`. The 9-minute timeout is the Gen2 max; set `timeoutSeconds: 540` and paginate.
**Warning signs:** Cloud Function logs show timeout errors on `scheduledPurge`.

### Pitfall C: Non-deterministic pseudonym token breaks idempotency
**What goes wrong:** `gdprEraseUser` crashes at collection 3 of 6. On retry, `crypto.randomUUID()` generates a different token. Collection 1–2 have token A, collection 3–6 have token B. Post-erasure audit finds two different orphan tokens referencing the same user.
**Why it happens:** Using UUID instead of deterministic sha256.
**How to avoid:** Use `sha256(uid + GDPR_PSEUDONYM_SECRET)`. Same secret → same token → idempotent re-run.
**Warning signs:** Post-erasure audit script finds more than one tombstone token per deleted user.

### Pitfall D: Firestore export reads are billed
**What goes wrong:** Daily export of a large Firestore database incurs significant read billing — one read operation per document — that doesn't appear in the standard Firestore usage console.
**Why it happens:** Export read costs are reported separately, not in the main Firestore usage dashboard.
**How to avoid:** Set a Firebase budget alert (OBS-07 from Phase 9 anyway). Accept cost as expected. For this project (low doc count during hardening), impact is negligible but document it.
**Warning signs:** Unexpected GCP bill increase at month boundary.

### Pitfall E: GDPR export includes data user can't access
**What goes wrong:** `gdprExportUser` assembles data for userId X but includes documents from other orgs the user is no longer a member of (historic `orgId` data).
**Why it happens:** Query by `authorId == userId` without org-scoping returns all time, cross-org.
**How to avoid:** This is intentional for GDPR Art. 15 — all data ever linked to the user must be included. Document this clearly in the export bundle metadata. The export is admin-initiated, not client-self-service.
**Warning signs:** None — this is correct behaviour, but must be documented.

### Pitfall F: Backup bucket does not exist before scheduledFirestoreExport deploys
**What goes wrong:** Cloud Function deploys and runs but fails with "bucket not found".
**Why it happens:** Wave ordering — GCS setup is an operator action that must precede Function deployment.
**How to avoid:** Wave 1 explicitly sequences: (1) create bucket, (2) set lifecycle, (3) provision IAM, (4) deploy Function.
**Warning signs:** Cloud Function first-run failure with GCS 404 error.

### Pitfall G: `getDownloadURL` client calls not fully replaced
**What goes wrong:** Some `src/data/documents.js` or view code still calls `getDownloadURL()` after the signed-URL callable lands, bypassing the TTL constraint (BACKUP-05).
**Why it happens:** Multiple call sites; partial sweep.
**How to avoid:** Grep for `getDownloadURL` across `src/` at end of Wave 2; CI ESLint rule can ban it.
**Warning signs:** ESLint scan finds residual `getDownloadURL` imports after Phase 8.

---

## Code Examples

### Verified GCS Lifecycle JSON

```json
{
  "rule": [
    {
      "action": { "type": "SetStorageClass", "storageClass": "NEARLINE" },
      "condition": { "age": 30, "matchesStorageClass": ["STANDARD"] }
    },
    {
      "action": { "type": "SetStorageClass", "storageClass": "ARCHIVE" },
      "condition": { "age": 365, "matchesStorageClass": ["NEARLINE"] }
    }
  ]
}
```
Source: [VERIFIED: https://docs.cloud.google.com/storage/docs/lifecycle-configurations]

### onSchedule v2 (typescript, europe-west2)

```typescript
import { onSchedule } from "firebase-functions/v2/scheduler";
// Source: [VERIFIED: https://firebase.google.com/docs/functions/schedule-functions]
export const myJob = onSchedule(
  {
    schedule: "0 2 * * *",  // cron syntax
    timeZone: "UTC",
    region: "europe-west2",
    timeoutSeconds: 540,
    retryConfig: { retryCount: 2 },
    serviceAccount: "backup-sa",
  },
  async (_event) => { /* ... */ }
);
```

### Signed URL V4 (1 hour, server-side)

```typescript
// Source: [VERIFIED: https://cloud.google.com/storage/docs/samples/storage-generate-signed-url-v4]
const [url] = await file.getSignedUrl({
  version: "v4",
  action: "read",
  expires: Date.now() + 60 * 60 * 1000,  // 1 hour in ms
});
```

### PITR enable + restore commands

```bash
# Enable PITR [VERIFIED: https://firebase.google.com/docs/firestore/use-pitr]
gcloud firestore databases update --database="(default)" --enable-pitr

# Restore to new DB [VERIFIED: same source]
gcloud firestore databases clone \
  --source-database="projects/PROJECT_ID/databases/(default)" \
  --snapshot-time="YYYY-MM-DDThh:mm:00.00Z" \
  --destination-database="restore-YYYYMMDD"
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `functions.pubsub.schedule()` (Gen1) | `onSchedule()` from `firebase-functions/v2/scheduler` | firebase-functions v2 | Use Gen2 exclusively per FN-01 |
| `getDownloadURL()` client-side | Callable CF returning V4 signed URL (≤1h) | BACKUP-05 requires this | Old paths must be removed in Phase 8 |
| GCS soft delete default 7 days | Configurable up to 90 days | GCS feature release 2023 | Set explicitly to 90 days for uploads bucket |
| PITR not available | 7-day rolling PITR | Firestore feature GA 2023 | Enable in Wave 1; enables clone-based restore |

**Not deprecated, but watch:** `@google-cloud/firestore` version — v8.5.0 is current; `FirestoreAdminClient` has been stable since v5.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `firebase-admin` | All Cloud Functions | ✓ | 13.9.0 | — |
| `firebase-functions` | All Cloud Functions | ✓ | 7.2.5 | — |
| `@google-cloud/firestore` | `scheduledFirestoreExport` | ✗ (not in functions/package.json) | — | Must add to functions/package.json |
| `node:crypto` | gdprEraseUser (sha256) | ✓ | Node 22 built-in | — |
| GCS bucket `bedeveloped-base-layers-backups` | BACKUP-01 | ✗ (does not exist yet) | — | Wave 1 creates it |
| Firestore PITR | BACKUP-03 | ✗ (disabled) | — | Wave 1 enables via gcloud |
| `defineSecret("GDPR_PSEUDONYM_SECRET")` | gdprEraseUser | ✗ (not yet created) | — | Wave 1 creates in Secret Manager |

**Missing dependencies requiring action before deployment:**
- `@google-cloud/firestore` must be added to `functions/package.json` (Wave 1)
- GCS backup bucket must be created (Wave 1 operator step)
- Firestore PITR must be enabled (Wave 1 operator step)
- `GDPR_PSEUDONYM_SECRET` must be created in Secret Manager (Wave 3 setup)

**Missing dependencies with fallback:**
- None with viable automated fallback — all blockers above must be resolved.

---

## Validation Architecture

Nyquist validation is enabled (`workflow.nyquist_validation: true` in config.json).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `functions/vitest.config.ts` (inherited from Phase 7) |
| Quick run command | `cd functions && npm test` |
| Full suite command | `cd functions && npm test -- --coverage` |
| Root quick run | `npm test` (root vitest.config.js — covers src/tests/**) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LIFE-01 | Admin can soft-delete an org/comment/message/document/funnelComment | unit (offline mock) | `cd functions && npm test -- lifecycle` | ❌ Wave 1/2 |
| LIFE-02 | Soft-delete writes tombstone + snapshot in single batch | unit | `cd functions && npm test -- softDelete.unit` | ❌ Wave 2 |
| LIFE-03 | Rules hide soft-deleted docs from list queries | rules-unit-test (emulator) | `npm test -- tests/rules/soft-delete` | ❌ Wave 2 |
| LIFE-04 | `restoreSoftDeleted` callable returns doc to live within 30 days | integration (firebase-functions-test wrap) | `cd functions && npm test -- restoreSoftDeleted` | ❌ Wave 2 |
| LIFE-05 | `scheduledPurge` hard-deletes records past 30 days; leaves fresh ones | unit | `cd functions && npm test -- scheduledPurge.unit` | ❌ Wave 2 |
| GDPR-01 | `gdprExportUser` returns signed URL with TTL ≤ 24h, bundle contains user data | integration | `cd functions && npm test -- gdprExportUser` | ❌ Wave 3 |
| GDPR-02 | `gdprEraseUser` deterministic token: same secret → same token | unit (pure) | `cd functions && npm test -- pseudonymToken.unit` | ❌ Wave 3 |
| GDPR-03 | Post-erasure: zero residual PII across all 6 collections | post-erasure audit script (manual-assist) | `node scripts/post-erasure-audit/run.js --uid=<uid>` | ❌ Wave 3 |
| GDPR-04 | Audit log events retained but PII fields tombstoned | unit | `cd functions && npm test -- gdprEraseUser.unit` | ❌ Wave 3 |
| GDPR-05 | `redactionList/{uid}` written with token + timestamp | integration | `cd functions && npm test -- gdprEraseUser.integration` | ❌ Wave 3 |
| BACKUP-01 | `scheduledFirestoreExport` calls `exportDocuments` with correct args | unit (mock FirestoreAdminClient) | `cd functions && npm test -- scheduledFirestoreExport` | ❌ Wave 1 |
| BACKUP-02 | Lifecycle JSON valid (correct ages, correct storageClass values) | unit (JSON schema assert) | `npm test -- tests/scripts/backup-lifecycle` | ❌ Wave 1 |
| BACKUP-03 | PITR enabled — verified by gcloud describe | manual | operator: `gcloud firestore databases describe` | N/A |
| BACKUP-04 | Storage bucket versioning + 90-day soft delete verified | manual | operator: `gcloud storage buckets describe` | N/A |
| BACKUP-05 | Signed URL TTL ≤ 1h: `getDocumentSignedUrl` callable returns url + expiresAt within window | integration | `cd functions && npm test -- getDocumentSignedUrl` | ❌ Wave 2 |
| BACKUP-06 | Quarterly cadence documented | manual | runbooks/restore-drill-<date>.md exists | ❌ Wave 4 |
| BACKUP-07 | Drill performed + documented | manual (human) | runbooks/restore-drill-<date>.md contents | ❌ Wave 4 |

### Sampling Rate

- **Per task commit:** `cd functions && npm test`
- **Per wave merge:** `cd functions && npm test -- --coverage` + `npm test` (root)
- **Phase gate:** Full suite green before `/gsd-verify-work 8`

### Wave 0 Gaps (test infrastructure needed before implementation waves)

Phase 7 established the `functions/test/_mocks/admin-sdk.ts` shared mock and `firebase-functions-test` wrap pattern. Phase 8 extends it with:

- [ ] `functions/test/_mocks/admin-sdk.ts` — extend to add `getStorage()` mock surface (bucket().file().save(), file().getSignedUrl(), bucket().file().getFiles())
- [ ] `functions/test/_mocks/admin-sdk.ts` — extend to add `FirestoreAdminClient` mock (just `exportDocuments` method returning a mock operation)
- [ ] `tests/rules/soft-delete.test.js` — rules-unit-test suite for soft-delete predicates (requires `@firebase/rules-unit-testing` emulator; existing TEST-08 pattern)
- [ ] `scripts/post-erasure-audit/run.js` — Node.js script (ADC, not Function) to enumerate all collections for a given UID and report any residual non-tombstoned references

*(If no Wave 0 gaps: N/A — Phase 7 mock infrastructure is sufficient for pure-logic unit tests; the additions above are for the Storage and export integration surfaces that Phase 8 introduces.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | All callables enforce `request.auth?.uid` + custom claim role check |
| V3 Session Management | no | Phase 6 owns this |
| V4 Access Control | yes | `softDelete` / `gdprEraseUser` / `gdprExportUser` require `role === "admin"` claim; validated server-side from ID token |
| V5 Input Validation | yes | Zod schema on all callable inputs (Pattern A, established Phase 7) |
| V6 Cryptography | yes | Pseudonym token: sha256(uid + secret); not hand-rolled — uses `node:crypto` built-in; secret stored in Secret Manager |
| V8 Data Protection | yes | Signed URL TTL ≤ 1h; GDPR export TTL ≤ 24h; PII redaction on erasure |
| V9 Communications | no | Firebase/GCP TLS handles transport |
| V14 Configuration | yes | Per-function service accounts (backup-sa, lifecycle-sa); minimal IAM |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Admin callable called by non-admin | Elevation of Privilege | `role === "admin"` check from ID token claims; never from request.data |
| GDPR export leaking data of another user | Information Disclosure | Export callable accepts `userId` from admin token claims, not from request.data; caller cannot forge |
| scheduledPurge deleting wrong records | Tampering | `where("deletedAt", "<", cutoff)` uses server-side timestamps; client cannot manipulate `deletedAt` (server-set in softDelete callable) |
| Backup bucket publicly readable | Information Disclosure | Bucket IAM: no allUsers/allAuthenticatedUsers; only backup-sa has write, no public read |
| Signed URL persisted and reused beyond TTL | Information Disclosure | 1h TTL; refresh-on-download pattern issues new URL per download click; no URL caching in client |
| Erasure token reversible to real UID | Information Disclosure | sha256 is one-way; secret managed by Secret Manager; no way to reverse token without secret |
| gdprEraseUser partial failure leaves PII | Integrity | Deterministic token ensures idempotent re-run writes same token; post-erasure audit script validates zero residual PII |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `orgs/{orgId}/documents/{id}` has an `uploaderId` field that must be tombstoned on erasure | Pattern 9 (Erasure Cascade) | Miss a PII field in the cascade; post-erasure audit would catch this |
| A2 | `funnelComments/{id}` is a top-level collection (not subcollection) per ARCHITECTURE.md §1 diagram | Pattern 9 | Erasure query path incorrect; easy to fix during plan |
| A3 | `@google-cloud/storage` is transitively available in functions/ (no explicit install needed) | Standard Stack | Need explicit `npm install @google-cloud/storage` in Wave 1; low risk |
| A4 | The `scheduledPurge` pagination with `limit(500)` batches will complete within 9 minutes for current data volumes | Pattern 7 | May need to split into per-type scheduled functions if data grows large; acceptable for current scale |
| A5 | GDPR export bucket (`bedeveloped-base-layers-backups`) is acceptable for both Firestore exports and GDPR export bundles as separate paths | Pattern 8 | Separate bucket may be preferred for access control clarity; planner can decide |

**Assumption A1 has medium risk** — the erasure cascade must match the actual data model. The plan should include an explicit step to verify all `authorId`/`uploaderId`/`ownerId` field names before writing the erasure function.

---

## Open Questions

1. **Does `bedeveloped-base-layers-backups` bucket already exist?**
   - What we know: Phase 5 created `bedeveloped-base-layers-uploads` for documents. No evidence of a backups bucket in runbooks or scripts.
   - What's unclear: Whether any ad-hoc backup bucket was created during Phase 5/6/7 operator work.
   - Recommendation: Wave 1 idempotent bucket-creation script handles this gracefully either way.

2. **Which service account for `lifecycle-sa` (soft-delete + restore callable)?**
   - What we know: Phase 7 Wave 1 provisioned 6 SAs (`scripts/provision-function-sas/run.js`). None covers lifecycle operations.
   - What's unclear: Whether to add to existing script or create separately.
   - Recommendation: Add `lifecycle-sa` and `gdpr-sa` entries to a new `scripts/provision-phase8-sas/run.js`, mirroring the Phase 7 pattern.

3. **Should `gdprExportUser` and `gdprEraseUser` share a service account or have separate ones?**
   - What we know: Both need Firestore read-all + Storage write access; erasure additionally needs Firestore write-all and Auth access.
   - Recommendation: Separate SAs — `gdpr-reader-sa` (export, read-only IAM) and `gdpr-writer-sa` (erasure, broad write IAM). Least-privilege principle per FN-04 pattern.

4. **Does the Storage emulator support `getSignedUrl` for test coverage of BACKUP-05?**
   - What we know: GitHub issue #3400 (firebase-tools) indicates Storage emulator does NOT support `getSignedUrl`. [CITED: https://github.com/firebase/firebase-tools/issues/3400]
   - Recommendation: Unit test the `getDocumentSignedUrl` callable with a mocked `file.getSignedUrl` method (same `vi.mock` pattern as admin-sdk.ts). Integration test verifies the callable shape; URL validity is a manual verification step.

---

## Sources

### Primary (HIGH confidence)
- [Firebase PITR docs](https://firebase.google.com/docs/firestore/use-pitr) — gcloud enable + clone restore commands verified
- [Firebase scheduled export docs](https://firebase.google.com/docs/firestore/solutions/schedule-export) — FirestoreAdminClient.exportDocuments pattern + IAM roles verified
- [GCS lifecycle config](https://docs.cloud.google.com/storage/docs/lifecycle-configurations) — lifecycle JSON format verified
- [GCS soft delete](https://docs.cloud.google.com/storage/docs/soft-delete) — 90-day max retention, versioning interaction verified
- [Firebase schedule functions v2](https://firebase.google.com/docs/functions/schedule-functions) — onSchedule options, retryConfig verified
- [GCS signed URL V4](https://cloud.google.com/storage/docs/samples/storage-generate-signed-url-v4) — version/action/expires pattern verified
- [Firestore security rules query constraint](https://firebase.google.com/docs/firestore/security/rules-query) — "rules are not filters" + matching query constraint pattern verified
- Codebase inspection — `firestore.rules` (notDeleted predicate exists), `functions/src/util/idempotency.ts`, `functions/src/audit/auditWrite.ts`, `src/cloud/soft-delete.js`, `src/cloud/gdpr.js` — all verified by direct read

### Secondary (MEDIUM confidence)
- [PITFALLS.md §11](GDPR erasure tombstone pattern) — CITED from project research; ICO/EDPB pattern for audit-log retention vs erasure
- [npm registry] — package versions verified: firebase-admin 13.9.0, firebase-functions 7.2.5, @google-cloud/firestore 8.5.0, @google-cloud/storage 7.19.0, zod 4.4.3, firebase-functions-test 3.5.0

### Tertiary (LOW confidence / ASSUMED)
- Storage emulator `getSignedUrl` limitation — CITED from GitHub issue #3400; status may have changed in newer firebase-tools versions
- `@google-cloud/storage` transitive availability — ASSUMED; verify with `ls functions/node_modules/@google-cloud/storage` at Wave 0

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all package versions npm-verified; existing functions/ structure inspected
- Architecture (backup/PITR/lifecycle): HIGH — verified against official Firebase/GCP docs
- Soft-delete Rules caveat: HIGH — verified against Firebase security rules query docs; this is a commonly misunderstood behaviour
- GDPR erasure cascade: MEDIUM — collection list verified against firestore.rules + REQUIREMENTS.md; field names for some collections are ASSUMED (A1)
- Restore drill runbook structure: MEDIUM — pattern from existing runbooks (phase6-rules-rollback-rehearsal.md); BACKUP-07 structure is well-understood

**Research date:** 2026-05-10
**Valid until:** 2026-06-10 (firebase-admin API and GCS lifecycle format are stable; PITR GA since 2023)
