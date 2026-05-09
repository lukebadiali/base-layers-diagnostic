# Phase 5: Firestore Data Model Migration + Rules Authoring (Committed, Not Deployed) — Research

**Researched:** 2026-05-08
**Domain:** Firestore subcollection migration (firebase-admin Node script) + Security Rules authoring + `@firebase/rules-unit-testing` v5 + H7/H8 fixes
**Confidence:** HIGH — all stack versions verified against npm registry; Rules and migration patterns verified against Firebase official docs; codebase read directly.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** One-shot Node script using firebase-admin SDK, run locally. Lives at `scripts/migrate-subcollections/run.js`. Not a Cloud Function.
- **D-02:** Per-doc idempotency markers under `migrations/{stepId}/items/{docId}`. Granularity is per-source-document.
- **D-03:** Inline legacy fields on every doc that references a user — `legacyAppUserId`, `legacyAuthorId` preserved alongside new shape for Phase 6 backfill.
- **D-04:** Manual `gcloud firestore export gs://bedeveloped-base-layers-backups/pre-phase5-migration/{ISO-timestamp}/` immediately before production migration; rollback is `gcloud firestore import`.
- **D-05:** No separate staging Firebase project. Migration runs directly against production Firestore. Pre-migration export + per-doc idempotency markers are the rollback substrate.
- **D-06:** Migration script supports `--dry-run` flag. Dry-run short-circuits at the write site; read paths execute fully. Dry-run output committed as audit evidence.
- **D-07:** Rules + storage rules are emulator-tested only during Phase 5; never deployed to staging or production in this phase.
- **D-08:** 6-wave shape, rules-first. Wave 1: rules + first matrix slice. Wave 2: migration script body + dry-run. Wave 3: data/* body rewrites. Wave 4: H7 + H8 fixes. Wave 5: runbook + production migration execution. Wave 6: cleanup.
- **D-09:** Phase 5 runs the production migration; Phase 6 only deploys rules + Auth.
- **D-10:** Strict tests-first inside each wave (red-then-green).
- **D-11:** 6 Phase 4 D-09 pass-through wrappers swap to subcollection access; API surface stays stable.
- **D-12:** `src/data/read-states.js` is a new wrapper: `getReadState`, `setPillarRead`, `setChatRead`, `subscribeReadState`. Backed by `orgs/{orgId}/readStates/{userId}`. All writes use `serverTimestamp()`.
- **D-13:** `src/data/cloud-sync.js` rewritten in Wave 4 (not deleted). Phase 2 TEST-06 breaks by design; new tests replace in same commit.
- **D-14:** Helper-rich predicate library at top of `firestore.rules`: `isAuthed()`, `role()`, `orgId()`, `isInternal()`, `isAdmin()`, `inOrg(o)`, `notDeleted(r)`, `isOwnAuthor(r)`, `immutable(field)`, `mutableOnly(fields)`. Storage rules get parallel mini-library.
- **D-15:** Strict mutation whitelist on every `allow update` path via `mutableOnly([...])` + identity-field immutability via `immutable("orgId")`, `immutable("createdAt")`, `immutable("authorId")`.
- **D-16:** Table-driven role × collection × op test matrix at `tests/rules/firestore.test.js` + `tests/rules/storage.test.js`. Hybrid extension: `tests/rules/tenant-jump.test.js`, `tests/rules/soft-delete-predicate.test.js`, `tests/rules/server-only-deny-all.test.js`.
- **D-17:** Phase 5 rules scope: subcollections + RULES-03 server-only deny-blocks. `rateLimits/` ships `allow read, write: if false`. Phase 7 adds `request.time` predicate.
- **D-18:** DATA-07 (H7 fix) folds into D-12. Server-clock `readStates` replace localStorage last-read state. `src/domain/unread.js` rewritten in Wave 4.
- **D-19:** TEST-08 is the Wave 1 + Wave 6 deliverable. Wave 1 ships matrix scaffolding + rules for first collections.
- **D-20:** DOC-10 (incremental SECURITY.md update) is the Wave 6 deliverable.
- **D-21:** Cleanup-ledger row closures: 6 Phase 4 carryover rows close in Phase 5. 4 new rows queued for Phase 6/7.

### Claude's Discretion

- Migration script repo path — planner picks the convention matching existing repo conventions; per-doc marker collection path (`migrations/{stepId}/items/{docId}`) is locked.
- Per-collection migration step ordering within Wave 5 (Pitfall 10 leaves-first ordering).
- Rules predicate naming subtleties (`isMember(o)` vs `inOrg(o)`).
- Test matrix runner format — Vitest `describe.each([...rows])` vs custom matrix iterator.
- Storage rules MIME allowlist constant location — duplicate from `ui/upload.js` or hardcode; cleanup-ledger row queued either way.

### Deferred Ideas (OUT OF SCOPE)

- Nightly rules tests against a real Firebase project (Pitfall 4 prevention).
- Sidecar `legacyIdMap/{appUserId}` collection.
- Pre-deploying rules to a separate Firebase project.
- Migrating `funnelComments` to subcollection of `orgs/{orgId}/*`.
- Pre-emptively writing the rate-limit `request.time` predicate.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | Firestore migrates from monolithic `orgs/{id}` to subcollections (`responses`, `comments`, `actions`, `documents`, `messages`, `readStates`) | Migration script patterns; firebase-admin batch write; per-doc idempotency markers |
| DATA-02 | `users` rekeyed by Firebase Auth UID; `legacyAppUserId` retained | Inline-field pattern (D-03); Phase 6 backfill substrate |
| DATA-03 | New top-level collections: `internalAllowlist`, `auditLog`, `softDeleted`, `rateLimits` with correct rule scopes | Rules deny-block patterns; deny-all for server-only collections |
| DATA-04 | One-shot migration script — clean cutover (no dual-write) | D-01 local Node script; Admin SDK bypasses rules |
| DATA-05 | Migration script is idempotent (re-runnable; idempotency markers per collection) | D-02 per-doc marker pattern; `migrations/{stepId}/items/{docId}` |
| DATA-06 | Pre/post doc-count and field-presence assertion harness verifies no data loss | `db.collectionGroup()` count assertions before/after each step |
| DATA-07 | H7 fix: last-read markers move into `orgs/{orgId}/readStates/{userId}`; server-clock-vs-server-clock comparators | D-12/D-18; `serverTimestamp()` on all writes; `domain/unread.js` rewrite |
| RULES-01 | `firestore.rules` with claims-based predicates: `isAuthed()`, `isInternal()`, `inOrg(orgId)` | D-14 predicate library; `email_verified` + `sign_in_provider != "anonymous"` |
| RULES-02 | Rules constrain both `resource.data` and `request.resource.data`; `mutableOnly([...])` whitelist | D-15; `diff(resource.data).affectedKeys().hasOnly([...])` |
| RULES-03 | Client writes denied to `users/`, parent `orgs/{id}` doc, `internalAllowlist/`, `auditLog/`, `softDeleted/` | D-17 deny-block patterns |
| RULES-04 | Tenant-jump test: client orgId=A cannot read/write `orgs/B/*` | `inOrg(orgId)` predicate; dedicated `tenant-jump.test.js` |
| RULES-05 | `storage.rules` enforces size cap, MIME allowlist, path scope | D-14 storage mini-library; `ui/upload.js` ALLOWED_MIME_TYPES constant |
| RULES-06 | Rules committed and unit-tested in Phase 5 but NOT deployed to production | `firebase.json` adds `firestore.rules` + `storage.rules` declarations; deploy gate held for Phase 6 |
| TEST-08 | `@firebase/rules-unit-testing` v5 suite covering every collection × role × op | D-16 table-driven matrix; `RulesTestEnvironment`; `withSecurityRulesDisabled`; Vitest `describe.each` |
| DOC-10 | Incremental SECURITY.md update — Wave 6 deliverable | D-20 four new sections + Phase 5 audit index |
</phase_requirements>

---

## Summary

Phase 5 is the most technically layered phase of the milestone: it migrates production Firestore data from a monolithic nested-map shape to subcollections, closes H7 (clock skew) and H8 (last-writer-wins) in separate Wave 4 commits, authors `firestore.rules` + `storage.rules` with a claims-based predicate library, and ships a full `@firebase/rules-unit-testing` v5 matrix suite — all while keeping `views/*` API-stable and the rules NOT deployed to production (that gate is Phase 6).

The 21 locked decisions in CONTEXT.md constrain the WHAT extensively. Research focus is therefore HOW to implement each well: migration script patterns (credential loading, idempotency, batch strategies, dry-run short-circuit), `@firebase/rules-unit-testing` v5 API (emulator boot, `RulesTestEnvironment`, `authenticatedContext` with custom claims, table-driven Vitest matrix), Firestore rules composition patterns (`diff().affectedKeys().hasOnly(...)`, helper-rich predicate libraries), storage rules MIME predicate syntax, and CI emulator integration.

The most important landmines are: (1) the `--dry-run` flag must short-circuit at the write site, not the read site, so the dry-run validates full shape transformation; (2) per-doc idempotency markers must be written BEFORE the subcollection writes, not after, so a crash mid-doc leaves a correct "skip me next run" marker; (3) Firestore rules are NOT cascading — each subcollection path requires its own explicit `match` block; (4) `@firebase/rules-unit-testing` v5 uses `initializeTestEnvironment` (not the v4 `initializeAdminApp` API) — the v4 API is fully removed.

**Primary recommendation:** Wave 1 ships the complete rules file and matrix scaffolding first (tests go red, rules go green within the wave). Every subsequent wave adds the corresponding data wrapper tests + rules rows, maintaining the red-then-green discipline throughout. The production migration executes in Wave 5 only after the full rules + data/* + H7/H8 stack is verified green.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Firestore data migration (subcollections) | Node script (offline) | — | Admin SDK bypasses rules; one-shot operator-run; not a service |
| Firestore Security Rules authoring | Firebase backend (rules file) | CI emulator (test validation) | Rules are server-enforced; emulator is the test substrate |
| Storage Rules authoring | Firebase backend (rules file) | CI emulator (test validation) | Storage rules are server-enforced |
| data/* body rewrites | API/Backend adapter tier (`src/data/*`) | `src/firebase/db.js` | data/* is the sole Firestore access layer |
| read-states.js (new wrapper) | API/Backend adapter tier (`src/data/`) | — | Follows same Promise CRUD + subscribe* shape as other data/* |
| cloud-sync.js rewrite (H8) | API/Backend adapter tier (`src/data/`) | — | H8 is a data-tier concern; views/* are untouched |
| domain/unread.js rewrite (H7) | Domain tier (`src/domain/`) | data/read-states.js (server-time injection) | domain/* stays Firebase-free; server-time values injected via data/* wrapper |
| Pre/post assertion harness | Node script (offline) | CI (regression guard) | Part of migration script; collectionGroup count assertions |
| Rules unit test matrix | `tests/rules/` (Vitest + emulator) | CI (test:rules job) | @firebase/rules-unit-testing v5 runs against local emulator |
| SECURITY.md DOC-10 increment | Documentation (Wave 6) | — | Phase pattern established in prior phases |
| Production migration execution | Operator (Wave 5) | runbook | One-shot human-supervised run |

---

## Standard Stack

### Core (Phase 5 additions/verifications)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@firebase/rules-unit-testing` | **5.0.0** | Rules unit tests against local emulator | Only official Firebase Rules testing library; v5 is current; already in devDependencies [VERIFIED: npm registry] |
| `firebase-admin` | **13.8.0** (repo pin) / **13.9.0** (registry) | Migration script: Admin SDK Firestore writes + collectionGroup reads | Admin SDK bypasses Security Rules — required for migration script [VERIFIED: npm registry] |
| `firebase-tools` | **15.16.0** (repo pin) / **15.17.0** (registry) | `firebase emulators:exec` for CI; emulator suite | Already in devDependencies; Firestore + Storage emulators [VERIFIED: npm registry] |
| `vitest` | **4.1.5** | Test runner for rules matrix + data/* tests | Already configured; `describe.each` / `it.each` for table-driven matrix [VERIFIED: package.json] |
| `firebase` (JS SDK) | **12.12.1** | data/* wrapper bodies use db.js re-exports | Already in dependencies [VERIFIED: package.json] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `firebase-admin` (Node CJS) | 13.8.0 | Migration script only — NOT imported into src/ | `scripts/migrate-subcollections/run.js` — a standalone Node process, not bundled by Vite |
| `node:process` (built-in) | — | `process.argv` parsing for `--dry-run` flag | Built-in; no install needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Per-doc idempotency marker (D-02) | Per-step (batch) marker | Per-step marker coarser; partial-run leaves ambiguous state. Per-doc is the right choice. |
| `firebase emulators:exec` | `firebase emulators:start` + separate process | `emulators:exec` auto-starts and stops; preferred for CI. `emulators:start` better for local dev with watch mode. |
| `describe.each` (Vitest) | Custom matrix loop function | `describe.each` gives better test names in the output; preferred. |

**Installation (Phase 5 additions to root package.json):**
```bash
# firebase-admin — for migration script only (scripts/ directory, not src/)
# Simplest: install at root devDependencies since the script is local-only
npm install -D firebase-admin@13.8.0

# @firebase/rules-unit-testing is ALREADY in devDependencies at 5.0.0
# firebase-tools is ALREADY in devDependencies at 15.16.0
# No new production dependencies required
```

**Version verification (confirmed 2026-05-08 against npm registry):**
- `@firebase/rules-unit-testing`: `5.0.0` (no newer version; confirmed current) [VERIFIED: npm registry]
- `firebase-admin`: `13.9.0` latest; `13.8.0` pinned in repo — minor patch bump, no breaking changes [VERIFIED: npm registry]
- `firebase-tools`: `15.17.0` latest; `15.16.0` pinned in repo — patch bump [VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
WAVE 1 FOUNDATION
─────────────────────────────────────────────────────────────────
firestore.rules (authored) ──► tests/rules/firestore.test.js
storage.rules  (authored) ──► tests/rules/storage.test.js
                               │  ↓
                     RulesTestEnvironment (emulator)
                     withSecurityRulesDisabled (fixture seed)
                     authenticatedContext({uid, role, orgId}) (test subjects)
                               │
                     Vitest describe.each([role×collection×op matrix])
                               ↓
                     GREEN: rules correctly allow/deny per cell
                     dedicated: tenant-jump.test.js
                     dedicated: server-only-deny-all.test.js

WAVE 2 MIGRATION SCRIPT
─────────────────────────────────────────────────────────────────
scripts/migrate-subcollections/run.js
  │
  ├── process.argv → --dry-run flag parsed
  ├── ADC credential loading (GOOGLE_APPLICATION_CREDENTIALS or gcloud login)
  │
  ├── PRE-MIGRATION: collectionGroup count assertions (DATA-06 harness)
  │     db.collectionGroup("orgs").count()
  │     per-subcollection-step: document count baseline
  │
  ├── PER-STEP LOOP (for each stepId in MIGRATION_STEPS):
  │     db.collection("orgs").get() → iterate source docs
  │     for each source doc:
  │       1. Check idempotency marker: db.doc("migrations/{stepId}/items/{docId}")
  │          → IF marker exists: SKIP (idempotent resume)
  │          → IF --dry-run: LOG "would write {targetPath}" → CONTINUE (no write)
  │       2. Build target subcollection docs (transform shape + inline legacy fields)
  │       3. Write idempotency marker FIRST (before subcollection write)
  │       4. WriteBatch: setDoc on each subcollection doc
  │       5. LOG: written {count} docs to orgs/{orgId}/{collection}
  │
  └── POST-MIGRATION: collectionGroup count assertions (DATA-06 harness)
        assert post-count == pre-count + new subcollection docs
        assert field-presence (legacyAppUserId present on user-ref'd docs)

WAVE 3 DATA/* BODY REWRITES
─────────────────────────────────────────────────────────────────
src/data/responses.js  ──► tests: emulator integration test first (RED)
  old: getOrg(orgId) + nested-map access        ──► bodies rewritten to:
src/data/comments.js       db.collection("orgs/{orgId}/responses").get()
src/data/actions.js        addDoc(collection(db,"orgs",orgId,"responses"), doc)
src/data/documents.js      onSnapshot(collection(db,"orgs",orgId,"comments"), ...)
src/data/messages.js
src/data/read-states.js  ──► NEW wrapper; same Promise CRUD + subscribe* shape

WAVE 4 H7 + H8 FIXES (two separate commits)
─────────────────────────────────────────────────────────────────
COMMIT A — H7:
  src/data/read-states.js (uses serverTimestamp()) ──► setPillarRead, setChatRead
  src/domain/unread.js (rewritten) ──► reads server-time markers, not ISO strings
  tests/domain/unread.test.js ──► replaces Phase 2 H7 regression baseline
  NEW TEST: 5-minute clock-skew does not change unread counts (ROADMAP SC#4)

COMMIT B — H8:
  src/data/cloud-sync.js (rewritten) ──► per-subcollection listeners + parent doc metadata only
  tests/data/cloud-sync.test.js ──► Phase 2 TEST-06 breaks by design → replaced in same commit

WAVE 5 PRODUCTION EXECUTION
─────────────────────────────────────────────────────────────────
Operator:
  1. gcloud firestore export gs://bedeveloped-base-layers-backups/pre-phase5-migration/{ISO}/
  2. node scripts/migrate-subcollections/run.js --dry-run   (inspect output, verify shape)
  3. node scripts/migrate-subcollections/run.js             (real run)
  4. Pre/post doc-count assertions (DATA-06 harness)
  5. Commit: "chore(05): execute production subcollection migration"
```

### Recommended Project Structure (Phase 5 additions)

```
scripts/
└── migrate-subcollections/
    ├── run.js              # Main migration script (firebase-admin)
    └── dry-run-output.log  # Committed as audit evidence after dry-run

firestore.rules             # New (committed, NOT deployed in Phase 5)
storage.rules               # New (committed, NOT deployed in Phase 5)

src/data/
├── responses.js            # Body rewritten (Wave 3)
├── comments.js             # Body rewritten (Wave 3)
├── actions.js              # Body rewritten (Wave 3)
├── documents.js            # Body rewritten (Wave 3)
├── messages.js             # Body rewritten (Wave 3)
└── read-states.js          # New wrapper (Wave 3, consumed by Wave 4)

tests/rules/
├── firestore.test.js       # Role × collection × op matrix (Wave 1)
├── storage.test.js         # Storage rules matrix (Wave 1)
├── tenant-jump.test.js     # Cross-collection tenant-jump invariant (Wave 1)
├── soft-delete-predicate.test.js  # notDeleted() across collections (Wave 1)
└── server-only-deny-all.test.js   # auditLog/softDeleted/rateLimits deny all clients (Wave 1)

runbooks/
└── phase5-subcollection-migration.md  # Wave 5 cutover runbook
```

### Pattern 1: Migration Script — Credential Loading + Firestore Init

```javascript
// scripts/migrate-subcollections/run.js
// @ts-check
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { argv } from 'node:process';

// ADC (Application Default Credentials) — preferred over service account JSON for local
// operator runs. Operator runs: gcloud auth application-default login
// For CI if needed: set GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json
const app = initializeApp({
  credential: applicationDefault(),
  projectId: 'bedeveloped-base-layers',
});

const db = getFirestore(app);
const DRY_RUN = argv.includes('--dry-run');
```

[VERIFIED: firebase.google.com/docs/admin/setup — ADC pattern for local scripts] [CITED: firebase.google.com/docs/admin/setup]

### Pattern 2: Per-Doc Idempotency Marker — Write Before Subcollection Write

```javascript
// CRITICAL: write marker BEFORE the subcollection writes.
// If the script crashes after marker write but before subcollection write,
// the next run will re-process this doc (marker exists = skip).
// But: the marker is only meaningful if it marks SUCCESS, not INTENT.
// Solution: two-phase — marker with status "pending" → write subcollection → marker "done".
// On re-run: "pending" marker = re-process (previous run crashed mid-write); "done" = skip.

const STEP_ID = 'responses-v1'; // one stepId per collection migration

async function processDoc(sourceDoc) {
  const markerRef = db.doc(`migrations/${STEP_ID}/items/${sourceDoc.id}`);
  const marker = await markerRef.get();

  if (marker.exists && marker.data()?.status === 'done') {
    console.log(`[SKIP] ${sourceDoc.id} — already migrated`);
    return;
  }

  // Build target shape
  const sourceData = sourceDoc.data();
  const targets = buildSubcollectionDocs(sourceData); // returns [{path, data}, ...]

  if (DRY_RUN) {
    console.log(`[DRY-RUN] would write ${targets.length} docs from orgs/${sourceDoc.id}`);
    targets.forEach(t => console.log(`  -> ${t.path} (${JSON.stringify(t.data).length} bytes)`));
    return;
  }

  // Mark as pending BEFORE writes
  await markerRef.set({ status: 'pending', startedAt: FieldValue.serverTimestamp() });

  // WriteBatch (max 500 ops per batch)
  let batch = db.batch();
  let batchCount = 0;
  for (const { path, data } of targets) {
    batch.set(db.doc(path), data);
    batchCount++;
    if (batchCount === 499) { // leave 1 slot for the final marker set
      await batch.commit();
      batch = db.batch();
      batchCount = 0;
    }
  }
  await batch.commit();

  // Mark as done AFTER all writes succeed
  await markerRef.set({ status: 'done', completedAt: FieldValue.serverTimestamp() }, { merge: true });
  console.log(`[DONE] ${sourceDoc.id} — wrote ${targets.length} docs`);
}
```

[ASSUMED — idempotency marker two-phase pattern; basis in Pitfall 10 guidance + standard migration practice]

### Pattern 3: Data/* Wrapper Body Rewrite — Subcollection Access

```javascript
// src/data/comments.js — AFTER Phase 5 Wave 3 rewrite
// @ts-check
import {
  db, collection, doc, addDoc, getDocs, deleteDoc,
  onSnapshot, query, where, serverTimestamp
} from '../firebase/db.js';

/**
 * @param {string} orgId
 * @param {number|string} pillarId
 * @returns {Promise<Array<any>>}
 */
export async function listComments(orgId, pillarId) {
  const q = query(
    collection(db, 'orgs', orgId, 'comments'),
    where('pillarId', '==', pillarId)
  );
  const snap = await getDocs(q);
  /** @type {Array<any>} */ const out = [];
  snap.forEach(d => out.push({ id: d.id, ...d.data() }));
  return out;
}

/**
 * @param {string} orgId
 * @param {*} comment
 * @returns {Promise<string>} — the new doc id
 */
export async function addComment(orgId, comment) {
  const ref = await addDoc(
    collection(db, 'orgs', orgId, 'comments'),
    { ...comment, createdAt: serverTimestamp() }
  );
  return ref.id;
}

/**
 * @param {string} orgId
 * @param {{ onChange: (list: Array<any>) => void, onError: (err: Error) => void }} cb
 * @returns {() => void} unsubscribe
 */
export function subscribeComments(orgId, { onChange, onError }) {
  return onSnapshot(
    collection(db, 'orgs', orgId, 'comments'),
    snap => {
      /** @type {Array<any>} */ const out = [];
      snap.forEach(d => out.push({ id: d.id, ...d.data() }));
      onChange(out);
    },
    onError
  );
}
```

[ASSUMED — pattern consistent with Phase 4 D-10 Promise CRUD + subscribe* shape and firebase/db.js exports]

### Pattern 4: `@firebase/rules-unit-testing` v5 — RulesTestEnvironment Setup

```javascript
// tests/rules/firestore.test.js
// @ts-check
import { describe, beforeAll, afterAll, afterEach, it, expect } from 'vitest';
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
    projectId: 'demo-project-rules',  // must match emulator project ID
    firestore: {
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

// Fixture seeding (bypasses rules)
async function seedOrg(orgId, data = {}) {
  await testEnv.withSecurityRulesDisabled(async ctx => {
    await ctx.firestore().doc(`orgs/${orgId}`).set({
      name: 'Test Org', deletedAt: null, ...data
    });
  });
}
```

[CITED: firebase.google.com/docs/firestore/security/test-rules-emulator]

### Pattern 5: Table-Driven Role × Collection × Op Matrix

```javascript
// tests/rules/firestore.test.js (continued)

/** @type {Array<{role: string, orgId?: string, claims?: object}>} */
const ROLES = [
  { role: 'anonymous',    claims: {} },
  { role: 'client_orgA',  claims: { role: 'client',   orgId: 'orgA', email_verified: true } },
  { role: 'client_orgB',  claims: { role: 'client',   orgId: 'orgB', email_verified: true } },
  { role: 'internal',     claims: { role: 'internal', orgId: null,   email_verified: true } },
  { role: 'admin',        claims: { role: 'admin',    orgId: null,   email_verified: true } },
];

/**
 * @param {string} roleName
 * @param {object} claims
 * @returns firestore instance
 */
function asUser(roleName, claims) {
  if (roleName === 'anonymous') return testEnv.unauthenticatedContext().firestore();
  return testEnv.authenticatedContext(roleName, {
    ...claims,
    firebase: { sign_in_provider: 'password' },  // not anonymous
  }).firestore();
}

// Matrix row shape: [role, collection path, op, expected]
const MATRIX = [
  // orgs/{orgId} parent doc
  ['client_orgA',  'orgs/orgA',                 'read',   'allow'],
  ['client_orgB',  'orgs/orgA',                 'read',   'deny'],   // tenant isolation
  ['anonymous',    'orgs/orgA',                 'read',   'deny'],
  ['internal',     'orgs/orgA',                 'read',   'allow'],
  ['client_orgA',  'orgs/orgA',                 'write',  'deny'],   // client cannot write parent
  ['internal',     'orgs/orgA',                 'write',  'allow'],
  // subcollection comments
  ['client_orgA',  'orgs/orgA/comments/c1',     'read',   'allow'],
  ['client_orgB',  'orgs/orgA/comments/c1',     'read',   'deny'],
  ['anonymous',    'orgs/orgA/comments/c1',     'read',   'deny'],
  // auditLog — server-only
  ['admin',        'auditLog/e1',               'read',   'allow'],
  ['internal',     'auditLog/e1',               'read',   'deny'],   // AUDIT-07 pinned
  ['admin',        'auditLog/e1',               'write',  'deny'],   // no client writes
  // ... (full matrix continues per D-16)
];

describe.each(MATRIX)('Rules matrix — %s on %s %s → %s', (role, path, op, expected) => {
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

[ASSUMED — table-driven Vitest pattern; `describe.each` / `it.each` syntax consistent with Vitest 4.x docs]

### Pattern 6: Firestore Rules Helper-Rich Predicate Library

```javascript
// firestore.rules — top of file
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ── Auth predicates ──────────────────────────────────────────────────────
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

    // ── Document predicates ──────────────────────────────────────────────────
    function notDeleted(r) { return !("deletedAt" in r) || r.deletedAt == null; }
    function isOwnAuthor(r){ return r.authorId == request.auth.uid; }

    // ── Mutation whitelist predicates (Pitfall 3 / RULES-02) ─────────────────
    function immutable(field) {
      return request.resource.data[field] == resource.data[field];
    }
    function mutableOnly(fields) {
      return request.resource.data.diff(resource.data).affectedKeys().hasOnly(fields);
    }

    // ── Collections ─────────────────────────────────────────────────────────
    match /orgs/{orgId} {
      allow read:   if inOrg(orgId) && notDeleted(resource.data);
      allow create: if isInternal();
      allow update: if isInternal()
                    && immutable("orgId")
                    && immutable("createdAt");
      allow delete: if false;  // soft-delete via Cloud Function only

      match /responses/{respId} {
        allow read:   if inOrg(orgId);
        allow create: if inOrg(orgId)
                      && request.resource.data.userId == request.auth.uid;
        allow update: if inOrg(orgId)
                      && immutable("userId")
                      && immutable("orgId");
        allow delete: if false;
      }

      match /comments/{cmtId} {
        allow read:   if inOrg(orgId)
                      && (!resource.data.internalOnly || isInternal());
        allow create: if inOrg(orgId)
                      && request.resource.data.authorId == request.auth.uid;
        allow update: if false;  // immutable comments; deletes via Cloud Function
        allow delete: if false;
      }

      match /readStates/{userId} {
        allow read:   if inOrg(orgId) && (request.auth.uid == userId || isInternal());
        allow create: if inOrg(orgId) && request.auth.uid == userId;
        allow update: if inOrg(orgId) && request.auth.uid == userId
                      && mutableOnly(["pillarReads", "chatLastRead"]);
        allow delete: if false;
      }
      // ... actions, documents, messages match blocks follow same pattern
    }

    match /auditLog/{eventId} {
      allow read:   if isAdmin();   // AUDIT-07: audited user CANNOT read own records
      allow write:  if false;       // Admin SDK (Cloud Functions) only
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
      allow read, write: if false;  // Phase 7 FN-09 replaces with request.time predicate
    }
  }
}
```

[CITED: firebase.google.com/docs/firestore/security/rules-conditions — `diff().affectedKeys().hasOnly()`]
[CITED: ARCHITECTURE.md §4 — target data model + rules sketch]

### Pattern 7: Storage Rules — Size + MIME + Path Scope

```javascript
// storage.rules
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
    function validSize()  { return request.resource.size <= 25 * 1024 * 1024; }  // 25 MiB
    function validMime()  {
      // Mirrors src/ui/upload.js ALLOWED_MIME_TYPES — cleanup-ledger row tracks drift
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
      allow update: if false;   // documents are immutable once uploaded
      allow delete: if isAuthed()
                    && request.auth.token.role in ["internal", "admin"];
    }

    // Deny everything else
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

[CITED: firebase.google.com/docs/storage/security/core-syntax — match path syntax]
[CITED: RULES-05 / CONCERNS H6 — size cap 25 MiB, MIME allowlist mirrors ui/upload.js]

### Pattern 8: Firebase.json Rules Declarations (Wave 1 — committed, not deployed)

```json
{
  "hosting": { /* ... existing Phase 3 config unchanged ... */ },
  "functions": [ /* ... existing Phase 3 config unchanged ... */ ],
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
}
```

**Critical:** Adding `firestore.rules` + `storage.rules` to `firebase.json` does NOT deploy them. It only declares the path so `firebase deploy --only firestore:rules` would know where to find them. Phase 5 never runs that deploy command.

[ASSUMED — firebase.json schema; basis in firebase-tools documentation and existing Phase 3 firebase.json structure in repo]

### Pattern 9: H7 Fix — server/unread.js Rewrite

```javascript
// src/domain/unread.js — AFTER Phase 5 Wave 4 H7 fix
// @ts-check
// H7 CLOSED: all comparators are server-clock-vs-server-clock.
// Requires that callers pass Firestore Timestamps, not ISO strings.

/**
 * @param {import('firebase/firestore').Timestamp|null} lastReadTs — from readStates/{userId}
 * @param {Array<{authorId: string, createdAt: import('firebase/firestore').Timestamp}>} comments
 * @param {string} currentUserId
 * @returns {number}
 */
export function unreadCountForPillar(lastReadTs, comments, currentUserId) {
  const lastMs = lastReadTs ? lastReadTs.toMillis() : 0;
  return comments.filter(c =>
    c.authorId !== currentUserId &&
    c.createdAt.toMillis() > lastMs
  ).length;
}
```

**5-minute clock-skew test (ROADMAP SC#4):**
```javascript
it('5-minute client clock skew does not change unread count (H7 fix)', () => {
  // Simulate a comment written at serverTimestamp T
  // and a read marker written at serverTimestamp T-1min
  // Even if we shift the client clock by 5 minutes forward/backward,
  // the comparison is Timestamp vs Timestamp — client clock is irrelevant.
  const commentTs = { toMillis: () => 1000000 };   // server-assigned
  const lastReadTs = { toMillis: () =>  999000 };  // server-assigned, before comment
  // Result: 1 unread — independent of what Date.now() returns
  expect(unreadCountForPillar(lastReadTs, [
    { authorId: 'u_other', createdAt: commentTs }
  ], 'u_self')).toBe(1);
});
```

[VERIFIED: CONCERNS.md H7 description; CONTEXT.md D-12/D-18; tests/domain/unread.test.js current baseline]

### Pattern 10: CI Rules Test Step — Emulator Boot

```yaml
# .github/workflows/ci.yml addition — new job or step in existing test job
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
        uses: actions/setup-java@3a4f6e1af35884e86e67a7b5d514e5b3e3c4e8a0  # v4 — SHA to be verified
        with:
          distribution: temurin
          java-version: "17"
      - name: Run rules tests via emulators:exec
        run: npx firebase-tools@15.16.0 emulators:exec
          --only firestore,storage
          --project demo-project-rules
          "npx vitest run tests/rules/"
```

**Key emulator detail:** Firestore emulator requires Java 11+. GitHub Actions ubuntu-latest includes Java but `setup-java` ensures the correct version. The `--project demo-project-rules` uses a demo project ID — no real Firebase project credentials needed for emulator-only runs.

[CITED: firebase.google.com/docs/emulator-suite/install_and_configure — `emulators:exec` CI usage]
[ASSUMED — SHA for setup-java action; planner must verify and pin to commit SHA per TOOL-09]

### Anti-Patterns to Avoid

- **Do NOT import `firebase-admin` into `src/` source files.** Migration script lives in `scripts/`, completely separate from the Vite-bundled app. Admin SDK is a Node.js CJS library and would break the browser build.
- **Do NOT use `firebase emulators:start` in CI without `emulators:exec`.** `emulators:start` is a foreground process; tests won't run until you backgrounding it, which is fragile. Use `emulators:exec` — it starts, runs, stops atomically.
- **Do NOT use `@firebase/rules-unit-testing` v4 API.** `initializeAdminApp`, `initializeTestApp` are v4 — completely removed in v5. The v5 API is `initializeTestEnvironment`.
- **Do NOT write idempotency marker AFTER subcollection writes.** If script crashes between writes and marker, next run re-processes and may create duplicate subcollection docs. Write a `status: "pending"` marker first, then writes, then `status: "done"`.
- **Do NOT deploy `firestore.rules` in Phase 5.** The `firebase.json` declaration of rules path does not trigger a deploy. The deploy command is `firebase deploy --only firestore:rules` — this command must NOT appear anywhere in Phase 5.
- **Do NOT use `iso()` (client clock) in the rewritten `domain/unread.js`.** The H7 fix is explicitly that no client clock value touches the unread comparator. Pass Firestore `Timestamp` objects through from `data/read-states.js`.
- **Do NOT mix H7 and H8 in the same commit (Pitfall 20).** Wave 4 has two atomic commits: commit A = H7, commit B = H8. Reviewing them separately is the audit evidence of the split.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rules unit testing | Custom emulator HTTP calls + assertion framework | `@firebase/rules-unit-testing` v5 (`initializeTestEnvironment`) | Official library; handles emulator connection, fixture seeding, `assertSucceeds`/`assertFails` |
| Firestore batch limits | Manual batch splitting | Write-batch with manual 499-doc check + `batch.commit()` when limit approaches | Firestore WriteBatch max 500 ops; hand-roll is the right approach here but limit is 500, not 100 |
| Subcollection path construction | `string.concat(orgId + '/responses/' + docId)` | `collection(db, 'orgs', orgId, 'responses')` + `doc(...)` | Type-safe; avoids path separator bugs; already exposed via `firebase/db.js` |
| MIME type detection in storage.rules | Parsing file headers in rules | `request.resource.contentType.matches(...)` | Rules language supports regex matching on contentType; magic-byte sniff is client-side (already in `ui/upload.js`); server-side is contentType |
| Custom claims token refresh | Polling loop | `getIdToken(true)` after claims update (Phase 6's concern) | Phase 5 doesn't touch auth; documented as Phase 6 Pitfall 6 mitigation |
| Credential loading in migration script | Hardcoded service account JSON | `applicationDefault()` from `firebase-admin/app` | ADC avoids hardcoded credentials in scripts; gitleaks won't flag a file path; aligns with TOOL-09 no-long-lived-credentials principle |

**Key insight:** Rules complexity should live in named helper functions, not inline in match blocks. The audit reviewer reads top-to-bottom; a `isAuthed()` call site is self-documenting in a way that `request.auth != null && request.auth.token.email_verified == true && request.auth.token.firebase.sign_in_provider != "anonymous"` inline is not.

---

## Common Pitfalls

### Pitfall 1: Firestore Rules Are NOT Cascading
**What goes wrong:** Developer writes rules for `orgs/{orgId}` and assumes subcollections inherit. Subcollection docs are accessible to anyone.
**Why it happens:** Unlike some ACL systems, Firestore Rules do NOT cascade. Each `match` path is independent.
**How to avoid:** Every subcollection needs its own explicit `match /orgs/{orgId}/{subcollection}/{docId}` block. The rules file in Pattern 6 above shows the required structure.
**Warning signs:** Rules tests pass for `orgs/{orgId}` but subcollection reads return `permission-denied` for legitimate users (or succeed for unauthorized users).

[CITED: firebase.google.com/docs/firestore/security/rules-structure — "Security rules are not filters"]

### Pitfall 2: Anonymous Token Satisfies `request.auth != null` (PITFALLS.md §Pitfall 2)
**What goes wrong:** Rules predicated on `request.auth != null` are bypassed by anonymous auth tokens — every page visitor has a non-null `request.auth`.
**Why it happens:** Firebase Auth anonymous sign-in produces a real, non-null `request.auth`. The `isAuthed()` helper must explicitly exclude it.
**How to avoid:** `isAuthed()` includes `request.auth.token.firebase.sign_in_provider != "anonymous"` AND `request.auth.token.email_verified == true` per D-14.
**Warning signs:** Rules tests for `anonymous` role show `allow` for read operations on org data.

[CITED: PITFALLS.md §Pitfall 2; CONTEXT.md D-14]

### Pitfall 3: `resource.data` vs `request.resource.data` on Updates (PITFALLS.md §Pitfall 3)
**What goes wrong:** Update rule checks `resource.data.orgId == auth.token.orgId` (pre-update state) but doesn't prevent the update from CHANGING `orgId`. Attacker submits update with a different `orgId` — the rule passes because pre-update state is correct.
**How to avoid:** Always use `immutable("orgId")` and `mutableOnly([...])` on every `allow update` rule per D-15.
**Warning signs:** Rules tests don't include a "can update change orgId?" test case.

[CITED: PITFALLS.md §Pitfall 3; CONTEXT.md D-15]

### Pitfall 4: firebase-admin in scripts/ vs src/ — Import Confusion
**What goes wrong:** `firebase-admin` uses CommonJS (`require()`); the src/ files are ES modules (`import`). Mixing them in the Vite build crashes at build time.
**Why it happens:** Migration script is in `scripts/` which is outside Vite's input; but if vite.config.js has an `include` glob that catches `scripts/`, it fails.
**How to avoid:** Confirm vite.config.js only inputs `src/` and `index.html`. The migration script runs as a raw Node.js process: `node scripts/migrate-subcollections/run.js`. It should use `--input-type=module` or have `"type": "module"` in a local `package.json`, or use the `firebase-admin/app` ESM export path (available since admin SDK v11).
**Warning signs:** `SyntaxError: Cannot use import statement in a module` when running the migration script, or Vite build errors about CJS modules.

[ASSUMED — firebase-admin ESM export availability since v11; basis in firebase-admin changelog]

### Pitfall 5: Dry-Run Checks Marker Before Write — Idempotency Breaks
**What goes wrong:** Dry-run mode checks `if marker.exists { return }` same as the real run. Second dry-run invocation shows nothing (all markers exist from the first run — but only pending markers).
**Why it happens:** Idempotency markers are for the real run. Dry-run should read source docs and compute target shapes without touching markers.
**How to avoid:** Dry-run path short-circuits at the WRITE site, not the read site. It still reads source docs and computes target shapes. It does NOT read or write markers. The only thing it skips is the actual Firestore writes. This is what D-06 specifies.

[CITED: CONTEXT.md D-06]

### Pitfall 6: `@firebase/rules-unit-testing` v4 API Used in a v5 Install
**What goes wrong:** Team copies examples from the internet using `initializeAdminApp`, `initializeTestApp` — these are v4 APIs. With v5 installed, `import { initializeAdminApp } from '@firebase/rules-unit-testing'` throws at runtime.
**Why it happens:** v5 was a complete API redesign. All web content from before 2023 uses the v4 API.
**How to avoid:** v5 API entry point is `initializeTestEnvironment`. There is no `initializeAdminApp` or `initializeTestApp` in v5. The repo already has v5 pinned at `5.0.0`.

[VERIFIED: @firebase/rules-unit-testing@5.0.0 is already in package.json devDependencies]
[CITED: firebase.google.com/docs/firestore/security/test-rules-emulator — v5 API documentation]

### Pitfall 7: Emulator Ports Not Declared in firebase.json
**What goes wrong:** `initializeTestEnvironment` connects to the emulator but the emulator wasn't started with the right ports, or Vitest times out waiting for the emulator connection.
**Why it happens:** `initializeTestEnvironment` needs `host` + `port` matching the running emulator. The emulator ports come from `firebase.json` `emulators` section.
**How to avoid:** Phase 5 adds `firestore.port: 8080` and `storage.port: 9199` to the `emulators` block in `firebase.json`. `initializeTestEnvironment` must pass `host: 'localhost', port: 8080` for Firestore. Both must match.

[CITED: CONTEXT.md code_context — "firebase.json Phase 5 adds firestore + storage emulator ports"]

### Pitfall 8: Per-Doc Migration vs Per-Batch Migration — Batch Limit
**What goes wrong:** Script iterates 5,000 response docs and tries to batch them all in one `db.batch()`. Firestore WriteBatch limit is 500 operations. Commit throws `10 ABORTED`.
**Why it happens:** Firestore WriteBatch is not unlimited. Each set/update/delete counts as one operation.
**How to avoid:** Pattern 2 above shows the 499-doc rolling batch commit pattern. Flush batch when count reaches 499 (one slot reserved for possible marker write).

[CITED: firebase.google.com/docs/firestore/manage-data/transactions — batch limit 500]

---

## Runtime State Inventory

> Phase 5 involves a production Firestore migration — this is a rename/migration phase for data-at-rest.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Firestore: all data is currently in nested maps on `orgs/{id}` documents — `responses{}`, `comments{}`, `actions[]`, `documents[]`, `messages[]`, `readStates{}` as nested fields | Data migration (Wave 5): migration script creates new subcollection docs, does NOT delete old fields until Phase 6 cleanup-ledger row |
| Stored data | Firestore: `users/{appUserId}` documents keyed by app-internal `Math.random()` IDs | DATA-02: Phase 5 adds `legacyAppUserId` field to migrated docs; re-keying to Firebase UID is Phase 6 (AUTH-15) |
| Live service config | Firebase Console: Firestore Security Rules — currently "test mode" or permissive rules (C3 finding) | No change from Phase 5's perspective — rules are authored and committed but NOT deployed. Production rules unchanged until Phase 6. |
| Live service config | firebase.json on disk — currently does NOT have `firestore` or `storage` rules declarations | Phase 5 Wave 1 adds `firestore.rules` + `storage.rules` declarations to firebase.json |
| OS-registered state | None — no OS-level registrations reference Firestore collection names | None |
| Secrets/env vars | `GOOGLE_APPLICATION_CREDENTIALS` may need setting for migration script if ADC not configured via `gcloud auth application-default login` | Operator action before Wave 5 execution: verify `gcloud auth application-default login` works or set env var |
| Build artifacts | `vitest.config.js` does not exist (confirmed by file search) — vitest config is inline in `vite.config.js` | Wave 1: add `tests/rules/**` glob to vite.config.js test include list, or create dedicated vitest.config.js for the rules suite |

**Critical migration note:** Old nested-map fields on `orgs/{id}` documents are NOT deleted by the Phase 5 migration. The migration WRITES new subcollection docs and the data/* wrappers are rewritten to read from subcollections. The old fields become stale/orphaned data on the parent doc — a cleanup-ledger row queues their deletion for a later wave (or Phase 6). This is intentional: it provides a rollback substrate (the old data is still there if needed).

---

## Code Examples

### Example 1: Pre/Post Assertion Harness (DATA-06)

```javascript
// Part of scripts/migrate-subcollections/run.js
async function assertDocCounts(label, expectations) {
  console.log(`\n[ASSERT] ${label}`);
  for (const { collPath, expectedMin } of expectations) {
    const snap = await db.collectionGroup(collPath.split('/').pop()).count().get();
    const count = snap.data().count;
    if (count < expectedMin) {
      throw new Error(`ASSERTION FAILED: ${collPath} count=${count}, expected>=${expectedMin}`);
    }
    console.log(`  [OK] ${collPath}: ${count} docs`);
  }
}

// Usage: call before and after migration for each step
const preOrgsCount = await db.collection('orgs').count().get();
console.log(`Pre-migration: ${preOrgsCount.data().count} org docs`);
// After migration:
await assertDocCounts('post-responses-migration', [
  { collPath: 'orgs/*/responses', expectedMin: preOrgsCount.data().count * 1 }
]);
```

[ASSUMED — `collectionGroup(...).count()` available in firebase-admin v11+; basis in Firestore docs]

### Example 2: Vitest Config Addition for Rules Tests

```javascript
// vite.config.js — addition to existing test configuration
// (vitest.config.js does NOT currently exist in repo)
export default defineConfig({
  // ... existing build config ...
  test: {
    environment: 'node',       // rules tests run in Node, not happy-dom
    include: [
      'tests/**/*.test.js',    // existing unit tests (happy-dom)
      'tests/rules/**/*.test.js',  // rules tests (Node/emulator)
    ],
    // NOTE: rules tests need Node environment; unit tests need happy-dom.
    // If mixing causes issues, use separate vitest.config.js for rules:
    //   npx vitest run --config vitest.rules.config.js
  },
});
```

**Alternative: separate vitest config for rules tests (recommended)**

```javascript
// vitest.rules.config.js (new file, Wave 1)
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.js'],
    testTimeout: 30000,  // emulator operations can be slow
    hookTimeout: 30000,
    singleFork: true,    // emulator state shared across tests; avoid parallel forks
  },
});
```

And in `package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:rules": "firebase-tools emulators:exec --only firestore,storage --project demo-project-rules \"vitest run --config vitest.rules.config.js\""
  }
}
```

[ASSUMED — vitest environment config; basis in Vitest 4.x documentation]

### Example 3: Legacy Fields Inline Pattern (D-03)

```javascript
// In migration script: building subcollection doc shape from nested-map source
function buildCommentDoc(orgId, pillarId, comment, legacyOrgData) {
  return {
    pillarId,
    authorId: comment.authorId,
    legacyAuthorId: comment.authorId,  // D-03: preserved for Phase 6 backfill
    body: comment.body,
    internalOnly: comment.internalOnly || false,
    createdAt: comment.createdAt,  // preserve original timestamp
    // legacyAppUserId: preserved if comment has a userId field different from authorId
  };
}
```

[CITED: CONTEXT.md D-03 — "inline legacy fields... Phase 6 bootstrap migration backfills against"]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@firebase/rules-unit-testing` v4 (`initializeAdminApp`, `initializeTestApp`) | v5 (`initializeTestEnvironment`) | 2022 | Complete API redesign; all online tutorials pre-2022 use wrong API |
| `firebase emulators:start` + `sleep 5 && tests` in CI | `firebase emulators:exec --only ... "test-command"` | 2021 | Atomic start/stop; no race conditions on emulator readiness |
| Firestore Rules without `diff().affectedKeys()` | `mutableOnly([...])` using `diff(resource.data).affectedKeys().hasOnly([...])` | 2020 | Explicit field whitelisting prevents mass-assignment / field injection |
| `functions.config()` for secrets in migration scripts | ADC (`applicationDefault()`) + gcloud login | 2023 | `functions.config()` decommissioned March 2027 |
| firebase-admin v12 `getFirestore()` import | firebase-admin v13 `import { getFirestore } from 'firebase-admin/firestore'` | 2022 | Sub-path imports; avoids importing entire Admin SDK |

**Deprecated/outdated:**
- `import admin from 'firebase-admin'` then `admin.firestore()`: deprecated in favour of `import { getFirestore } from 'firebase-admin/firestore'` (sub-package imports; better tree-shaking)
- `@firebase/rules-unit-testing` v4 API (`initializeAdminApp` etc.): removed in v5
- `firebase-tools` `emulators:start` for CI: replaced by `emulators:exec`

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Per-doc idempotency marker two-phase pattern (pending → done) | Pattern 2 | If wrong: partial-run recovery has a gap — docs with pending marker re-processed on next run, may create duplicate subcollection docs. Mitigation: script should log all docs processed and the marker count is checkable. |
| A2 | `firebase-admin` ESM sub-path imports (`from 'firebase-admin/app'`, `from 'firebase-admin/firestore'`) work in Node 22 with `"type": "module"` | Pattern 1 | If ESM imports fail, use `import admin from 'firebase-admin'; const { getFirestore } = admin;` (CJS-from-ESM interop). |
| A3 | `vitest.config.js` does not exist (only vite.config.js with inline `test:` key) | Code Examples | If a vitest.config.js exists that was not found, the plan should read it before modifying it. File search returned no vitest.config.js — confident it does not exist. |
| A4 | `db.collectionGroup(name).count().get()` is available in firebase-admin v13.8.0 | Example 1 | `count()` was added in Firestore in 2022; firebase-admin v11+ exposes it. If not available, fallback: `db.collectionGroup(name).get()` then `snap.size`. Performance worse but functionally equivalent. |
| A5 | Vitest `describe.each` with a 2D array works in Vitest 4.1.5 for the rules matrix | Pattern 5 | Standard Vitest API; very high confidence. Risk: test name formatting may differ. |
| A6 | `actions/setup-java` GitHub Actions SHA (placeholder in Pattern 10) | Architecture Patterns — CI | Planner MUST verify the correct SHA-pinned version of setup-java before writing CI plan step. |
| A7 | Storage rules `request.resource.contentType.matches(...)` accepts JavaScript-style regex | Pattern 7 | Firebase storage.rules uses RE2 syntax (not full JS regex). The patterns in Pattern 7 use literal strings with `\\.` escaping for dots — this is correct RE2. If dot-matching fails, use `==` instead of `matches()` for exact MIME types. |

**If this table is empty:** Not applicable — several assumptions were flagged.

---

## Open Questions

1. **Does vite.config.js have a `test.include` list or an `exclude` for `tests/rules/`?**
   - What we know: `vitest.config.js` does not exist. vite.config.js was not read in this research (file search showed it exists but content was not fetched).
   - What's unclear: Whether the existing `test:` config in vite.config.js uses `happy-dom` environment globally (which would conflict with Node-environment rules tests).
   - Recommendation: Wave 1 planner reads `vite.config.js` first. If `environment: 'happy-dom'` is set globally, the solution is a separate `vitest.rules.config.js` with `environment: 'node'` and a separate `test:rules` script.

2. **Does the production `orgs/{id}` structure have consistent field names across all docs?**
   - What we know: `responses.js` shows `org.responses[roundId][userId][pillarId][idx]` — deeply nested map. `comments.js` shows `org.comments[pillarId][]`.
   - What's unclear: Whether all production org documents have identical schema (some may be v1 migration artifacts with different shapes).
   - Recommendation: Dry-run output (D-06) will surface any structural inconsistencies. The migration script should log `[WARN] unexpected shape` for docs that don't match the expected nested-map structure.

3. **What is the `gcloud` backup bucket setup status?**
   - What we know: D-04 specifies `gs://bedeveloped-base-layers-backups/pre-phase5-migration/{ISO-timestamp}/`. STATE.md notes BACKUP-01 (automated DR) is Phase 8.
   - What's unclear: Whether `gs://bedeveloped-base-layers-backups` bucket already exists, or needs to be created as part of Wave 5.
   - Recommendation: Wave 5 runbook (D-08) includes a "Verify backup bucket exists" pre-check. If it doesn't exist, operator creates it with `gsutil mb` before running the export.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Migration script, test:rules script | ✓ | v24.12.0 (verified) | — |
| firebase-tools CLI | `emulators:exec`, emulator suite | ✓ | 15.16.0 (devDep) | — |
| Java JRE 11+ | Firestore emulator (required by firebase-tools) | [ASSUMED] | Unknown — not checked locally | CI uses `actions/setup-java` |
| `@firebase/rules-unit-testing` | `tests/rules/` | ✓ | 5.0.0 (devDep) | — |
| `firebase-admin` | `scripts/migrate-subcollections/run.js` | ✗ (not in package.json yet) | — | Must add to devDependencies in Wave 2 |
| `gcloud` CLI | Pre-migration backup export (Wave 5) | [ASSUMED] | Unknown | Operator must have gcloud installed; `gcloud auth application-default login` must work |
| GCS bucket `bedeveloped-base-layers-backups` | D-04 pre-migration backup | [ASSUMED] | — | Operator creates bucket if it doesn't exist |

**Missing dependencies with no fallback:**
- `firebase-admin` in devDependencies — Wave 2 PLAN must add `npm install -D firebase-admin@13.8.0`

**Missing dependencies with fallback:**
- Java JRE: CI handles via `actions/setup-java`; local dev may need `brew install openjdk` or similar

---

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` — section required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.5 |
| Config file | `vite.config.js` (inline `test:` key) — `vitest.rules.config.js` added in Wave 1 for rules suite |
| Quick run command | `npm test` (unit tests only, no emulator) |
| Rules run command | `npm run test:rules` (emulator + rules) |
| Full suite command | `npm test && npm run test:rules` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | Subcollection docs created from nested-map source | integration (migration script) | `node scripts/migrate-subcollections/run.js --dry-run` + post-count harness | ❌ Wave 2 |
| DATA-02 | `legacyAppUserId` field present on migrated docs with user refs | integration (migration assertion) | Pre/post field-presence assertion in migration script | ❌ Wave 2 |
| DATA-05 | Migration script re-run produces identical state (idempotency) | integration (migration script run 2x) | Manual: run twice, assert counts unchanged | ❌ Wave 2 |
| DATA-06 | Pre/post doc-count confirms zero data loss | integration (assertion harness) | Built into migration script | ❌ Wave 2 |
| DATA-07 | Server-clock readStates; 5-min skew test passes | unit | `npm test tests/domain/unread.test.js` | ✅ (must be rewritten Wave 4) |
| RULES-01 | `isAuthed()` predicate denies anonymous tokens | rules-unit | `npm run test:rules` | ❌ Wave 1 |
| RULES-02 | `mutableOnly([...])` blocks non-whitelisted field update | rules-unit | `npm run test:rules` | ❌ Wave 1 |
| RULES-03 | Client writes denied to `auditLog/`, `softDeleted/`, etc. | rules-unit | `npm run test:rules` (server-only-deny-all.test.js) | ❌ Wave 1 |
| RULES-04 | Client orgId=A cannot read/write `orgs/B/*` | rules-unit | `npm run test:rules` (tenant-jump.test.js) | ❌ Wave 1 |
| RULES-05 | Storage rejects >25 MiB, wrong MIME, wrong path | rules-unit | `npm run test:rules` (storage.test.js) | ❌ Wave 1 |
| RULES-06 | `firestore.rules` committed; no deploy command ran | manual gate | `git log --oneline -- firestore.rules` + assert no `firebase deploy --only firestore:rules` | Wave 6 gate |
| TEST-08 | Full role × collection × op matrix green | rules-unit | `npm run test:rules` | ❌ Wave 1 |
| H8 fix | Phase 2 TEST-06 breaks then is replaced | unit | `npm test tests/data/cloud-sync.test.js` | ✅ (breaks by design Wave 4, replaced same commit) |

### Sampling Rate

- **Per task commit:** `npm test` (unit suite only — <30s; no emulator needed)
- **Per wave merge:** `npm test && npm run test:rules` (full suite including emulator)
- **Phase gate:** Full suite green + snapshot diff zero + views/* API-stable check before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `vitest.rules.config.js` — Wave 1; rules-specific Vitest config with `environment: 'node'`
- [ ] `tests/rules/firestore.test.js` — Wave 1; table-driven role × collection × op matrix
- [ ] `tests/rules/storage.test.js` — Wave 1; storage rules matrix
- [ ] `tests/rules/tenant-jump.test.js` — Wave 1; cross-collection tenant-jump invariant
- [ ] `tests/rules/soft-delete-predicate.test.js` — Wave 1; `notDeleted()` across collections
- [ ] `tests/rules/server-only-deny-all.test.js` — Wave 1; `auditLog/`, `softDeleted/`, `rateLimits/` deny all clients
- [ ] `firestore.rules` — Wave 1; full predicate library + collection blocks
- [ ] `storage.rules` — Wave 1; size + MIME + path-scope
- [ ] `firestore.indexes.json` — Wave 1 (empty array `{}` initially; firebase.json requires it)
- [ ] `scripts/migrate-subcollections/run.js` — Wave 2
- [ ] `src/data/read-states.js` — Wave 3
- [ ] `package.json` test:rules script addition — Wave 1
- [ ] `firebase-admin` in devDependencies — Wave 2

---

## Security Domain

> `security_enforcement` is enabled (absent = enabled per config). Section required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (Phase 6 owns auth) | Phase 5 authors rules predicates that enforce email_verified; enforcement waits for Phase 6 deploy |
| V3 Session Management | No | Phase 6 |
| V4 Access Control | Yes | Firestore Rules: `inOrg(orgId)` predicate; subcollection-scoped match blocks; tenant-jump test (RULES-04) |
| V5 Input Validation | Partial | Storage Rules: size cap (RULES-05); MIME allowlist (RULES-05); client-side already in `ui/upload.js` (Phase 4) |
| V6 Cryptography | No | ADC credentials (gcloud); no custom crypto in Phase 5 |

### Known Threat Patterns for Firebase Rules + Migration

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tenant-jump (client reads `orgs/B/*` with `orgId=A` claim) | Elevation of Privilege | `inOrg(orgId)` predicate + tenant-jump.test.js pinning RULES-04 |
| Mass-assignment (update payload injects unexpected fields) | Tampering | `mutableOnly([...])` + `immutable("orgId")` on every update rule (RULES-02) |
| Anonymous token bypasses `request.auth != null` rules | Elevation of Privilege | `isAuthed()` excludes `sign_in_provider == "anonymous"` (Pitfall 2) |
| Audit log written from client (forgeable) | Repudiation | `auditLog` rules `allow write: if false` for all clients (D-17; Pitfall 17) |
| Migration script accesses production without backup | Information Disclosure / Data Destruction | D-04 gcloud export taken immediately before; D-05 deviation from Pitfall 1 explicitly audited in SECURITY.md |
| Rules deployed before Auth migration is live (lockout) | Denial of Service | D-07: rules committed but NOT deployed; deploy gate is Phase 6 (Pitfall 1 prevention) |
| Storage path traversal via filename | Tampering | `match /orgs/{orgId}/documents/{docId}/{filename}` explicit path scope; client-side sanitisation in `ui/upload.js` |

---

## Sources

### Primary (HIGH confidence)
- Firebase official docs — `firebase.google.com/docs/firestore/security/test-rules-emulator` — `initializeTestEnvironment`, `authenticatedContext`, `withSecurityRulesDisabled`, `emulators:exec` CI pattern [CITED inline in relevant patterns]
- Firebase official docs — `firebase.google.com/docs/firestore/security/rules-conditions` — `diff().affectedKeys().hasOnly()`, `getAfter()` billing notes
- Firebase official docs — `firebase.google.com/docs/firestore/security/rules-structure` — rules are NOT cascading; subcollection paths require explicit match blocks
- Firebase official docs — `firebase.google.com/docs/storage/security/core-syntax` — storage.rules match path syntax, `request.resource.contentType.matches()`
- Firebase official docs — `firebase.google.com/docs/admin/setup` — ADC / `applicationDefault()` for local Node scripts
- Firebase official docs — `firebase.google.com/docs/firestore/manage-data/transactions` — WriteBatch 500-op limit
- npm registry — `@firebase/rules-unit-testing@5.0.0` — confirmed current version [VERIFIED]
- npm registry — `firebase-admin@13.9.0` — confirmed current (repo pin 13.8.0 is one minor behind) [VERIFIED]
- `.planning/research/ARCHITECTURE.md` §4 — target Firestore data model + subcollection layout + draft rules sketch [HIGH — project canonical]
- `.planning/research/PITFALLS.md` §1, §2, §3, §4, §5, §10, §17, §20 — load-bearing pitfalls [HIGH — project canonical]
- `.planning/phases/05-firestore-data-model-migration-rules-authoring-committed-not-deployed/05-CONTEXT.md` — 21 locked decisions [HIGH — project canonical]
- `src/firebase/db.js`, `src/data/orgs.js`, `src/data/responses.js`, `src/data/comments.js` — current pass-through wrapper shapes [HIGH — direct codebase read]
- `src/data/cloud-sync.js`, `src/domain/unread.js` — H8/H7 baselines [HIGH — direct codebase read]
- `src/ui/upload.js` — canonical MIME allowlist (`ALLOWED_MIME_TYPES`) [HIGH — direct codebase read]
- `tests/data/cloud-sync.test.js`, `tests/domain/unread.test.js` — Phase 2 regression baselines [HIGH — direct codebase read]
- `tests/mocks/firebase.js` — Phase 4 reusable Firestore mock factory [HIGH — direct codebase read]
- `firebase.json` — current Phase 3 state (no firestore/storage declarations yet) [HIGH — direct codebase read]
- `package.json` — current devDependencies; `@firebase/rules-unit-testing@5.0.0` already installed [HIGH — direct codebase read]
- `.github/workflows/ci.yml` — current CI structure; test job runs `npm run test:coverage` [HIGH — direct codebase read]

### Secondary (MEDIUM confidence)
- WebFetch of `firebase.google.com/docs/firestore/security/test-rules-emulator` — confirmed `initializeTestEnvironment` + `authenticatedContext` + `withSecurityRulesDisabled` API [MEDIUM — official docs fetched this session]

### Tertiary (LOW confidence / ASSUMED)
- Per-doc idempotency marker two-phase pattern (pending → done) — training knowledge, consistent with Firebase migration best-practices [A1]
- Vitest `describe.each` matrix pattern — training knowledge, consistent with Vitest 4.x documentation [A5]
- `actions/setup-java` GitHub Actions SHA — planner must verify and pin [A6]
- `firebase-admin` ESM sub-path import support in v13 — training knowledge [A2]
- Storage rules RE2 regex syntax for MIME matching — training knowledge; RE2 is confirmed for Firestore rules but storage rules docs not directly verified this session [A7]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry; `@firebase/rules-unit-testing@5.0.0` confirmed in package.json
- Architecture: HIGH — target data model from ARCHITECTURE.md §4; current code shapes read directly from src/
- Pitfalls: HIGH — directly cited from PITFALLS.md §Pitfall 1/2/3/4/5/10/17/20 + new Phase-5-specific pitfalls
- Rules patterns: MEDIUM-HIGH — Pattern 6/7 draw from official Firebase docs + CONTEXT.md D-14/D-15 locked decisions + ARCHITECTURE.md §4 draft sketch

**Research date:** 2026-05-08
**Valid until:** 2026-06-08 (Firebase Rules API is stable; `@firebase/rules-unit-testing` v5 unlikely to have breaking changes in 30 days)
