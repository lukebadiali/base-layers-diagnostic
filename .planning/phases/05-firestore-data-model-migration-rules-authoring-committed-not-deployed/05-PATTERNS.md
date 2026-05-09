# Phase 5: Firestore Data Model Migration + Rules Authoring — Pattern Map

**Mapped:** 2026-05-08
**Files analyzed:** 19 new/modified files
**Analogs found:** 15 / 19

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `firestore.rules` | config/rules | request-response | none in codebase | new substrate |
| `storage.rules` | config/rules | request-response | none in codebase | new substrate |
| `firebase.json` | config | — | `firebase.json` (existing) | exact (additive) |
| `scripts/migrate-subcollections/run.js` | utility/script | batch | none in codebase | no analog |
| `src/data/responses.js` | service | CRUD | `src/data/orgs.js` | exact (same role+flow) |
| `src/data/comments.js` | service | CRUD | `src/data/orgs.js` | exact (same role+flow) |
| `src/data/actions.js` | service | CRUD | `src/data/orgs.js` | exact (same role+flow) |
| `src/data/documents.js` | service | CRUD | `src/data/orgs.js` | exact (same role+flow) |
| `src/data/messages.js` | service | CRUD+streaming | `src/data/messages.js` (current) + `src/data/orgs.js` | role-match |
| `src/data/read-states.js` | service | CRUD+streaming | `src/data/orgs.js` | exact (same role+flow) |
| `src/data/cloud-sync.js` | service | event-driven | `src/data/cloud-sync.js` (current — rewrite target) | role-match (body breaks) |
| `src/domain/unread.js` | utility/domain | transform | `src/domain/unread.js` (current — rewrite target) | role-match (body breaks) |
| `tests/rules/firestore.test.js` | test | request-response | `tests/data/orgs.test.js` + RESEARCH Pattern 4/5 | partial (different substrate) |
| `tests/rules/storage.test.js` | test | request-response | `tests/data/orgs.test.js` + RESEARCH Pattern 4/5 | partial (different substrate) |
| `tests/rules/tenant-jump.test.js` | test | request-response | `tests/data/comments.test.js` | partial |
| `tests/rules/soft-delete-predicate.test.js` | test | request-response | `tests/data/comments.test.js` | partial |
| `tests/rules/server-only-deny-all.test.js` | test | request-response | `tests/data/comments.test.js` | partial |
| `.github/workflows/ci.yml` | config/CI | — | `.github/workflows/ci.yml` (existing `test` job) | exact (additive) |
| `runbooks/phase5-subcollection-migration.md` | doc | — | none (first runbook) | no analog |

---

## Pattern Assignments

### `firestore.rules` (config/rules, new substrate)

**Analog:** No existing analog in codebase. Pattern comes from RESEARCH.md Pattern 6 + ARCHITECTURE.md §4 rules sketch (lines 411–467).

**Rule: no analog exists.** The planner must use RESEARCH.md Pattern 6 verbatim. Key structural points extracted here for reference:

**Predicate library at top of file** (from RESEARCH.md Pattern 6, lines 511–539):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthed() {
      return request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.firebase.sign_in_provider != "anonymous";
    }
    function role()  { return request.auth.token.role; }
    function orgId() { return request.auth.token.orgId; }
    function isInternal() { return isAuthed() && role() in ["internal", "admin"]; }
    function isAdmin()    { return isAuthed() && role() == "admin"; }
    function inOrg(o)     { return isAuthed() && (isInternal() || orgId() == o); }
    function notDeleted(r) { return !("deletedAt" in r) || r.deletedAt == null; }
    function isOwnAuthor(r){ return r.authorId == request.auth.uid; }
    function immutable(field) {
      return request.resource.data[field] == resource.data[field];
    }
    function mutableOnly(fields) {
      return request.resource.data.diff(resource.data).affectedKeys().hasOnly(fields);
    }
```

**Core match block pattern** (from RESEARCH.md Pattern 6, lines 542–598):
```
    match /orgs/{orgId} {
      allow read:   if inOrg(orgId) && notDeleted(resource.data);
      allow create: if isInternal();
      allow update: if isInternal()
                    && immutable("orgId")
                    && immutable("createdAt");
      allow delete: if false;

      match /responses/{respId} { ... }
      match /comments/{cmtId} { ... }
      match /readStates/{userId} {
        allow read:   if inOrg(orgId) && (request.auth.uid == userId || isInternal());
        allow create: if inOrg(orgId) && request.auth.uid == userId;
        allow update: if inOrg(orgId) && request.auth.uid == userId
                      && mutableOnly(["pillarReads", "chatLastRead"]);
        allow delete: if false;
      }
    }
    match /auditLog/{eventId} {
      allow read:   if isAdmin();
      allow write:  if false;
    }
    match /softDeleted/{type}/items/{id} {
      allow read:   if isAdmin();
      allow write:  if false;
    }
    match /internalAllowlist/{email} {
      allow read:   if isAdmin();
      allow write:  if isAdmin();
    }
    match /rateLimits/{uid}/buckets/{windowStart} {
      allow read, write: if false;
    }
```

**Critical constraints:**
- Rules are NOT cascading — every subcollection needs its own `match` block (RESEARCH.md Pitfall 1).
- `isAuthed()` MUST include `email_verified == true` AND `sign_in_provider != "anonymous"` (RESEARCH.md Pitfall 2 / D-14).
- Every `allow update` MUST use `mutableOnly([...])` + `immutable("orgId")` / `immutable("createdAt")` as applicable (D-15).
- `rateLimits/` ships `allow read, write: if false` — Phase 7 adds the predicate body (D-17).
- File is COMMITTED but NOT DEPLOYED in Phase 5 (RULES-06).

---

### `storage.rules` (config/rules, new substrate)

**Analog:** No existing analog in codebase. Pattern comes from RESEARCH.md Pattern 7 (lines 607–648).

**Storage rules body** (from RESEARCH.md Pattern 7):
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isAuthed() {
      return request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.firebase.sign_in_provider != "anonymous";
    }
    function inOrg(o) {
      return isAuthed()
        && (request.auth.token.role in ["internal", "admin"]
            || request.auth.token.orgId == o);
    }
    function validSize()  { return request.resource.size <= 25 * 1024 * 1024; }
    function validMime()  {
      // Mirrors src/ui/upload.js ALLOWED_MIME_TYPES
      return request.resource.contentType.matches('application/pdf')
          || request.resource.contentType.matches('image/jpeg')
          || request.resource.contentType.matches('image/png')
          || request.resource.contentType.matches(
               'application/vnd\\.openxmlformats-officedocument\\.wordprocessingml\\.document')
          || request.resource.contentType.matches(
               'application/vnd\\.openxmlformats-officedocument\\.spreadsheetml\\.sheet')
          || request.resource.contentType.matches('text/plain');
    }
    match /orgs/{orgId}/documents/{docId}/{filename} {
      allow read:   if inOrg(orgId);
      allow create: if inOrg(orgId) && validSize() && validMime();
      allow update: if false;
      allow delete: if isAuthed()
                    && request.auth.token.role in ["internal", "admin"];
    }
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

**MIME allowlist source of truth:** `src/ui/upload.js` exports `ALLOWED_MIME_TYPES` (lines 24–33) and `MAX_BYTES = 25 * 1024 * 1024` (line 35). Storage rules duplicate the same set — cleanup-ledger row tracks drift if `ui/upload.js` allowlist ever changes.

---

### `firebase.json` (config, additive modification)

**Analog:** `firebase.json` (existing — lines 1–55)

**Existing structure to preserve** (lines 43–54):
```json
{
  "hosting": { /* ... lines 2–41 — UNCHANGED ... */ },
  "functions": [ /* ... lines 43–49 — UNCHANGED ... */ ],
  "emulators": {
    "hosting":   { "port": 5002 },
    "functions": { "port": 5001 },
    "ui":        { "enabled": true, "port": 4000 }
  }
}
```

**Additions required** (from RESEARCH.md Pattern 8 + D-07 emulator ports):
```json
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  },
  "emulators": {
    "hosting":   { "port": 5002 },
    "functions": { "port": 5001 },
    "firestore": { "port": 8080 },
    "storage":   { "port": 9199 },
    "ui":        { "enabled": true, "port": 4000 }
  }
```

**Critical:** Adding `firestore.rules` + `storage.rules` to `firebase.json` does NOT deploy them. `firebase deploy --only firestore:rules` must NOT appear anywhere in Phase 5.

---

### `scripts/migrate-subcollections/run.js` (utility/script, batch, no analog)

**Analog:** No existing analog. Pattern comes from RESEARCH.md Pattern 1 (credential loading, lines 262–280) + Pattern 2 (idempotency, lines 284–335).

**Imports + credential loading** (RESEARCH.md Pattern 1, lines 262–280):
```javascript
// @ts-check
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { argv } from 'node:process';

const app = initializeApp({
  credential: applicationDefault(),
  projectId: 'bedeveloped-base-layers',
});
const db = getFirestore(app);
const DRY_RUN = argv.includes('--dry-run');
```

**Idempotency marker pattern — two-phase pending/done** (RESEARCH.md Pattern 2, lines 296–335):
```javascript
const STEP_ID = 'responses-v1';

async function processDoc(sourceDoc) {
  const markerRef = db.doc(`migrations/${STEP_ID}/items/${sourceDoc.id}`);
  const marker = await markerRef.get();
  if (marker.exists && marker.data()?.status === 'done') {
    console.log(`[SKIP] ${sourceDoc.id} — already migrated`);
    return;
  }
  const sourceData = sourceDoc.data();
  const targets = buildSubcollectionDocs(sourceData);

  if (DRY_RUN) {
    console.log(`[DRY-RUN] would write ${targets.length} docs from orgs/${sourceDoc.id}`);
    targets.forEach(t => console.log(`  -> ${t.path}`));
    return;
  }
  // Mark pending BEFORE writes
  await markerRef.set({ status: 'pending', startedAt: FieldValue.serverTimestamp() });
  // WriteBatch (499-op ceiling; last slot reserved for marker update)
  let batch = db.batch();
  let batchCount = 0;
  for (const { path, data } of targets) {
    batch.set(db.doc(path), data);
    batchCount++;
    if (batchCount === 499) {
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }
  await batch.commit();
  // Mark done AFTER all writes succeed
  await markerRef.set({ status: 'done', completedAt: FieldValue.serverTimestamp() }, { merge: true });
}
```

**Legacy field inline pattern** (D-03 / RESEARCH.md Example 3 lines 940–960):
Every migrated subcollection doc that references a user MUST include `legacyAppUserId` (or `legacyAuthorId`) copied verbatim from the source doc. Phase 6 backfill walks these inline fields.

**Critical rules:**
- `firebase-admin` is ONLY imported in `scripts/` — never in `src/`. It would break the browser Vite build.
- `--dry-run` short-circuits at the write site (after `DRY_RUN` check), NOT at the read site — full shape transformation executes on dry-run.
- Marker written with `status: "pending"` BEFORE subcollection writes; updated to `status: "done"` after all writes commit.
- Batch write ceiling is 500 ops; the pattern uses 499 + 1 reserved for the marker.

---

### `src/data/responses.js` (service, CRUD — body rewrite)

**Analog:** `src/data/orgs.js` (lines 1–77) — exact role + data flow match for the post-rewrite target shape.

**Imports pattern** (from `src/data/orgs.js` lines 14–24):
```javascript
// @ts-check
import {
  db,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from '../firebase/db.js';
```

**Core CRUD pattern** (from RESEARCH.md Pattern 3 + `src/data/orgs.js`):
```javascript
// List via getDocs on subcollection query
export async function listResponses(orgId, ...) {
  const q = query(
    collection(db, 'orgs', orgId, 'responses'),
    where('pillarId', '==', pillarId)
  );
  const snap = await getDocs(q);
  const out = [];
  snap.forEach(d => out.push({ id: d.id, ...d.data() }));
  return out;
}

// Create via addDoc
export async function saveResponse(orgId, data) {
  return (await addDoc(
    collection(db, 'orgs', orgId, 'responses'),
    { ...data, updatedAt: serverTimestamp() }
  )).id;
}
```

**Subscribe pattern** (from `src/data/orgs.js` lines 66–77 — apply to subcollection):
```javascript
export function subscribeResponses(orgId, { onChange, onError }) {
  return onSnapshot(
    collection(db, 'orgs', orgId, 'responses'),
    snap => {
      const out = [];
      snap.forEach(d => out.push({ id: d.id, ...d.data() }));
      onChange(out);
    },
    onError
  );
}
```

**API surface contract** (D-11 — MUST be preserved verbatim from Phase 4 D-10):
The exported function signatures from Phase 4 are the contract `views/*` depends on. Body changes are transparent to callers. Do not add/remove/rename exported functions.

---

### `src/data/comments.js`, `src/data/actions.js`, `src/data/documents.js`, `src/data/messages.js` (service, CRUD — body rewrites)

**Analog:** `src/data/orgs.js` (lines 1–77) for the target shape. Current bodies are in `src/data/comments.js` (lines 1–53), `src/data/messages.js` (lines 1–59).

These follow the same pattern as `responses.js` above — same imports, same CRUD shape, same subscribe pattern. The only difference per file:

| File | Subcollection path segment | Notes |
|---|---|---|
| `comments.js` | `orgs/{orgId}/comments` | `internalOnly` filter for non-internal users |
| `actions.js` | `orgs/{orgId}/actions` | status + ownerId fields |
| `documents.js` | `orgs/{orgId}/documents` | storagePath field; no delete via client rules |
| `messages.js` | `orgs/{orgId}/messages` | `subscribeMessages` subscribes to subcollection, not parent doc (H8 fix) |

**Current `subscribeMessages` anti-pattern to replace** (from `src/data/messages.js` lines 47–58 — this is what Wave 3 fixes):
```javascript
// CURRENT (H8 — subscribes to parent doc, not subcollection):
export function subscribeMessages(orgId, { onChange, onError }) {
  return onSnapshot(
    doc(db, 'orgs', orgId),   // <-- parent doc listener — H8
    snap => { ... }
  );
}
```
After Wave 3 rewrite, `subscribeMessages` subscribes to `collection(db, 'orgs', orgId, 'messages')` directly.

---

### `src/data/read-states.js` (service, CRUD+streaming — NEW wrapper)

**Analog:** `src/data/orgs.js` (lines 1–77) — exact role + data flow match.

**API contract** (D-12 — must match this exactly):
```javascript
export async function getReadState(orgId, userId)         // Promise<ReadState>
export async function setPillarRead(orgId, userId, pillarId)  // Promise<void>
export async function setChatRead(orgId, userId)          // Promise<void>
export function subscribeReadState(orgId, userId, { onChange, onError })  // () => void
```

**Backed by:** `orgs/{orgId}/readStates/{userId}` with shape `{ pillarReads: { pillarId: serverTimestamp }, chatLastRead: serverTimestamp }`.

**All writes use `serverTimestamp()`** — no client-clock values (ISO strings, `Date.now()`, `iso()`) cross the data tier. This is load-bearing for the H7 fix.

**Imports** (same pattern as `src/data/orgs.js` lines 14–24, plus `updateDoc`):
```javascript
// @ts-check
import {
  db, doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp
} from '../firebase/db.js';
```

**Core setDoc pattern** (from `src/data/orgs.js` `saveOrg` lines 50–52):
```javascript
export async function setPillarRead(orgId, userId, pillarId) {
  await setDoc(
    doc(db, 'orgs', orgId, 'readStates', userId),
    { pillarReads: { [pillarId]: serverTimestamp() } },
    { merge: true }
  );
}
```

---

### `src/data/cloud-sync.js` (service, event-driven — rewrite)

**Analog (current body — H8 regression baseline):** `src/data/cloud-sync.js` (lines 1–59). The current body is the target to REPLACE — it is the Phase 2 TEST-06 pinned baseline.

**Current body shows the anti-pattern** (lines 21–58):
```javascript
// CURRENT — H8: cloudFetchAllOrgs() then jset(K.org(o.id), o) — last-writer-wins
// parent-doc overwrite. Phase 5 Wave 4 replaces this entirely.
export async function syncFromCloud(deps) {
  // ... delegates to cloudFetchAllOrgs / cloudPushOrg / jget / jset / render
}
```

**Target shape after Wave 4 rewrite** (D-13):
- Retains a thin "init org-metadata listener + dispatcher" role.
- Hydrates the small `orgs/{orgId}` parent doc (name, currentRoundId, etc.) via `onSnapshot`.
- Signals downstream wrappers to attach their per-subcollection `onSnapshot` listeners.
- Removes the `cloudFetchAllOrgs` / `jget` / `jset` / `cloudPushOrg` dependency injection entirely — those are the H8 anti-pattern.

**Closest post-rewrite analog for the new dispatcher role:** `src/data/orgs.js` `subscribeOrgs` (lines 66–77) — same `onSnapshot` + `onChange` callback shape, applied to the parent doc instead of the collection.

**Test file to break by design:** `tests/data/cloud-sync.test.js` (lines 1–182). Phase 5 Wave 4 replaces its tests in the same commit. The `describe` block names and test descriptions in the new file must reference "H8 fix" and the new dispatcher contract.

---

### `src/domain/unread.js` (utility/domain, transform — rewrite)

**Analog (current body — H7 regression baseline):** `src/domain/unread.js` (lines 1–61). Current body uses `iso()` / `new Date(c.createdAt).getTime()` — client clock in comparators. This is H7.

**Current H7 anti-pattern** (lines 14–19):
```javascript
export function unreadCountForPillar(org, pillarId, user, commentsFor) {
  const last = ((org.readStates || {})[user.id] || {})[pillarId];
  const lastT = last ? new Date(last).getTime() : 0;  // H7: client-clock ISO string
  return list.filter((c) => new Date(c.createdAt).getTime() > lastT && ...)
    .length;
}
```

**Target shape after Wave 4 H7 fix** (from RESEARCH.md Pattern 9, lines 683–717):
```javascript
// H7 CLOSED — all comparators are Firestore Timestamp.toMillis() vs Timestamp.toMillis()
export function unreadCountForPillar(lastReadTs, comments, currentUserId) {
  const lastMs = lastReadTs ? lastReadTs.toMillis() : 0;
  return comments.filter(c =>
    c.authorId !== currentUserId &&
    c.createdAt.toMillis() > lastMs
  ).length;
}
```

**Signature change:** The rewritten function no longer takes `(org, pillarId, user, commentsFor)` — it takes `(lastReadTs, comments, currentUserId)`. The `lastReadTs` value comes from `data/read-states.js` (server-assigned Firestore Timestamp), NOT from `org.readStates` (the deleted nested-map). This breaks all current callers in `views/*` — but `views/*` passes through `domain/unread.js` by injecting `commentsFor`, so the view-layer adaptation is part of Wave 4.

**Domain purity:** `domain/unread.js` MUST NOT import from `firebase/` or `data/`. It receives Timestamp objects as plain values (duck-typed: `{ toMillis: () => number }`). This preserves the `domain/` boundary from `CLAUDE.md`.

**Test baseline to break by design:** `tests/domain/unread.test.js` (lines 1–172) — specifically `markPillarRead` and the `new Date(last).getTime()` comparator tests. The new test file replaces all of these plus adds the 5-minute clock-skew test (ROADMAP SC#4):
```javascript
it('5-minute client clock skew does not change unread count (H7 fix)', () => {
  const commentTs  = { toMillis: () => 1000000 };
  const lastReadTs = { toMillis: () =>  999000 };
  expect(unreadCountForPillar(lastReadTs,
    [{ authorId: 'u_other', createdAt: commentTs }],
    'u_self'
  )).toBe(1);
});
```

---

### `tests/rules/firestore.test.js` (test, request-response — NEW)

**Analog:** `tests/data/comments.test.js` (lines 1–44) for the Vitest file structure (imports, describe, it, expect, vi). The rules test uses a different substrate (`@firebase/rules-unit-testing` not `makeFirestoreMock`), but the file-level conventions are the same.

**Vitest file header convention** (from `tests/data/comments.test.js` lines 1–6):
```javascript
// tests/rules/firestore.test.js
// @ts-check
import { describe, beforeAll, afterAll, afterEach, it, expect } from 'vitest';
```

**RulesTestEnvironment setup pattern** (from RESEARCH.md Pattern 4, lines 401–441):
```javascript
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let testEnv;
beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-project-rules',
    firestore: {
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
});
afterAll(async () => { await testEnv.cleanup(); });
afterEach(async () => { await testEnv.clearFirestore(); });

async function seedOrg(orgId, data = {}) {
  await testEnv.withSecurityRulesDisabled(async ctx => {
    await ctx.firestore().doc(`orgs/${orgId}`).set({ name: 'Test Org', deletedAt: null, ...data });
  });
}
```

**Table-driven matrix pattern** (from RESEARCH.md Pattern 5, lines 447–503):
```javascript
const ROLES = [
  { role: 'anonymous',   claims: {} },
  { role: 'client_orgA', claims: { role: 'client', orgId: 'orgA', email_verified: true } },
  { role: 'client_orgB', claims: { role: 'client', orgId: 'orgB', email_verified: true } },
  { role: 'internal',    claims: { role: 'internal', orgId: null, email_verified: true } },
  { role: 'admin',       claims: { role: 'admin',    orgId: null, email_verified: true } },
];

function asUser(roleName, claims) {
  if (roleName === 'anonymous') return testEnv.unauthenticatedContext().firestore();
  return testEnv.authenticatedContext(roleName, {
    ...claims,
    firebase: { sign_in_provider: 'password' },
  }).firestore();
}

const MATRIX = [
  ['client_orgA', 'orgs/orgA',             'read',  'allow'],
  ['client_orgB', 'orgs/orgA',             'read',  'deny'],   // tenant isolation
  ['anonymous',   'orgs/orgA',             'read',  'deny'],
  ['admin',       'auditLog/e1',           'read',  'allow'],
  ['internal',    'auditLog/e1',           'read',  'deny'],   // AUDIT-07 pinned
  // ... full matrix per D-16
];

describe.each(MATRIX)('Rules — %s on %s %s → %s', (role, path, op, expected) => {
  it(`${role} ${op} ${path} is ${expected}`, async () => {
    const claims = ROLES.find(r => r.role === role)?.claims || {};
    await seedOrg('orgA');
    const db = asUser(role, claims);
    const ref = db.doc(path);
    const assertion = expected === 'allow' ? assertSucceeds : assertFails;
    if (op === 'read')  await assertion(ref.get());
    if (op === 'write') await assertion(ref.set({ testField: true }));
  });
});
```

**Critical:** Use `initializeTestEnvironment` (v5 API). The v4 `initializeAdminApp` / `initializeTestApp` do not exist in v5.

---

### `tests/rules/storage.test.js` (test, request-response — NEW)

**Analog:** Same as `tests/rules/firestore.test.js` above, using the storage variant of `initializeTestEnvironment`:
```javascript
testEnv = await initializeTestEnvironment({
  projectId: 'demo-project-rules',
  storage: {
    rules: readFileSync(resolve(process.cwd(), 'storage.rules'), 'utf8'),
    host: 'localhost',
    port: 9199,
  },
});
```

Storage matrix rows cover: `orgs/{orgId}/documents/{docId}/{filename}` × roles × `read`/`write` with mock `request.resource` objects having `size` and `contentType` properties that match/fail `validSize()` and `validMime()`.

---

### `tests/rules/tenant-jump.test.js` (test, request-response — NEW)

**Analog:** `tests/data/comments.test.js` (file structure) + RESEARCH.md Matrix row `['client_orgB', 'orgs/orgA', 'read', 'deny']`.

This file enumerates EVERY collection under a tenant-jump scenario: `client_orgA` attempting to read/write `orgs/orgB/*` and every subcollection under it. All cells must be `deny`. One `describe.each` iterating all paths with `client_orgB` as the subject and all paths under `orgs/orgA/*` as targets.

---

### `tests/rules/soft-delete-predicate.test.js` + `tests/rules/server-only-deny-all.test.js` (test, request-response — NEW)

**Analog:** `tests/data/comments.test.js` (file structure).

`soft-delete-predicate.test.js` — tests `notDeleted(resource.data)` across every collection that uses it. Fixture seeds a doc with `deletedAt: <timestamp>` and asserts deny; seeds a doc with `deletedAt: null` and asserts allow.

`server-only-deny-all.test.js` — for each of `auditLog`, `softDeleted`, `rateLimits`: every client role (anonymous, client, internal) on every op (`read`, `create`, `update`, `delete`) is `deny`. Only `admin` gets `read` on `auditLog` and `softDeleted`.

---

### `.github/workflows/ci.yml` (config/CI, additive modification)

**Analog:** `.github/workflows/ci.yml` (lines 51–75 — the existing `test` job)

**Existing job structure to parallel** (lines 51–69):
```yaml
test:
  name: Test
  needs: setup
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd
    - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e
      with:
        node-version: "22"
        cache: "npm"
    - run: npm ci
    - run: npm run test:coverage
```

**New `test-rules` job to add** (from RESEARCH.md Pattern 10, lines 722–748):
```yaml
test-rules:
  name: Rules Tests (Emulator)
  needs: setup
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd
    - uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e
      with:
        node-version: "22"
        cache: "npm"
    - run: npm ci
    - name: Install Java (Firestore emulator requires JRE 11+)
      uses: actions/setup-java@<SHA-to-pin>
      with:
        distribution: temurin
        java-version: "17"
    - name: Run rules tests via emulators:exec
      run: |
        npx firebase-tools@15.16.0 emulators:exec \
          --only firestore,storage \
          --project demo-project-rules \
          "npx vitest run tests/rules/"
```

**Note:** The `setup-java` action SHA must be verified and pinned per the project's pinned-action convention (all existing actions use commit SHAs, not tags). The SHA in RESEARCH.md Pattern 10 is marked `# SHA to be verified`.

**`build` job dependency update** (existing line 124):
```yaml
build:
  needs: [lint, typecheck, test, audit]  # add test-rules here
```

**Action pin convention** (from existing ci.yml lines 18–19, 64–65):
All `uses:` references use the `@<full-commit-SHA> # v<semver>` comment format. The new `setup-java` action must follow the same pattern.

---

## Shared Patterns

### Promise CRUD + `subscribe*` wrapper API shape (Phase 4 D-10 — must be preserved)
**Source:** `src/data/orgs.js` (lines 30–77)
**Apply to:** All `src/data/*.js` body rewrites — `responses.js`, `comments.js`, `actions.js`, `documents.js`, `messages.js`, `read-states.js`

The exported function signatures are the contract `views/*` depends on. The Phase 4 wrapper API is the only thing callers see. Every rewrite changes only the function body — import block changes from `./orgs.js` delegation to direct `firebase/db.js` subcollection access; exports stay identical.

```javascript
// Pattern: every data/* file imports only from firebase/db.js (not from orgs.js)
import { db, collection, doc, addDoc, getDocs, onSnapshot, serverTimestamp } from '../firebase/db.js';
// Exports: one or more of: list*, get*, add*, save*, delete*, subscribe*
// subscribe* signature: (orgId, { onChange, onError }) => () => void (unsubscribe)
```

### Firestore mock for data/* unit tests
**Source:** `tests/mocks/firebase.js` (lines 21–113) + `tests/data/orgs.test.js` (lines 1–56)
**Apply to:** Unit tests for all rewritten `src/data/*.js` wrappers

```javascript
// Standard mock setup at top of every data/* test file:
vi.mock('../../src/firebase/db.js', () => makeFirestoreMock({
  seed: {
    'orgs/o1/comments/c1': { id: 'c1', pillarId: 'p1', body: 'hi' },
  },
}));
const { listComments, addComment } = await import('../../src/data/comments.js');
```

The mock supports nested collection paths in the seed if the key uses the full path (e.g., `orgs/o1/comments/c1`). The planner should verify `makeFirestoreMock` handles 3-segment paths (`orgs/{orgId}/{subcollection}/{id}`) correctly — the current `rowsForRef` filters by `collName + "/"` prefix which should work if `collection(db, 'orgs', orgId, 'comments')` returns a ref with `__coll = 'orgs/orgId/comments'`. If not, the mock needs a `collection` mock update to handle nested paths (minor fix, same mock pattern).

### `serverTimestamp()` on all writes (H7 constraint)
**Source:** `src/data/orgs.js` line 51 (`updatedAt: serverTimestamp()`)
**Apply to:** All write operations in `read-states.js`, `messages.js` (createdAt), and any Phase 5 wrapper writing a timestamp field

No ISO string (`iso()` from `src/util/ids.js`), no `Date.now()`, no `new Date()` may appear in `data/*.js` timestamp fields after Phase 5. The `iso()` import from `src/util/ids.js` is the anti-pattern to eliminate.

### JSDoc type annotations
**Source:** `src/data/orgs.js` (lines 27–29, 37–39, 48–49, 62–64)
**Apply to:** All new/rewritten `src/data/*.js` + `src/domain/unread.js`

```javascript
/**
 * @param {string} orgId
 * @param {string} userId
 * @returns {Promise<any|null>}
 */
```

The `// @ts-check` header and JSDoc on every exported function are required by the project's typecheck configuration (CLAUDE.md). The `domain/unread.js` rewrite must type `lastReadTs` as `import('firebase/firestore').Timestamp|null`.

### Atomic commit per coherent boundary (Phase 1 D-25)
**Source:** Phase 1 D-25 (pattern in CLAUDE.md conventions)
**Apply to:** Every Wave commit in Phase 5

Wave 4 specifically: two separate commits — commit A = H7 (`domain/unread.js` + `data/read-states.js` consumers + new tests), commit B = H8 (`data/cloud-sync.js` rewrite + new tests). These MUST NOT be bundled (Pitfall 20).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `firestore.rules` | config/rules | request-response | First rules file in this project; no prior analog exists |
| `storage.rules` | config/rules | request-response | First storage rules file; no prior analog |
| `scripts/migrate-subcollections/run.js` | utility/script | batch | No other Node scripts in the repo; no scripts/ directory yet |
| `runbooks/phase5-subcollection-migration.md` | doc | — | First runbook; no runbooks/ directory yet |

For these files, the planner must use RESEARCH.md patterns exclusively.

---

## Metadata

**Analog search scope:** `src/data/`, `src/domain/`, `tests/data/`, `tests/domain/`, `tests/mocks/`, `.github/workflows/`, `firebase.json`, `vite.config.js` (contains Vitest config), `src/ui/upload.js`
**Files scanned:** 19
**Pattern extraction date:** 2026-05-08
