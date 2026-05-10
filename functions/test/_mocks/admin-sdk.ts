// Phase 7 Wave 6 (TEST-09): shared Admin SDK mock for the firebase-functions-test
// integration suite under test/integration/. The integration tests use
// firebase-functions-test@3.5.0's `wrap()` to exercise the REAL exported
// callable / trigger functions; the Admin SDK behind them is stateful but
// in-memory (no Firestore emulator dependency, per 07-RESEARCH.md Pattern 11
// "offline mode preferred"). This complements (does not replace) the
// pure-mocked unit tests under test/{auth,audit,ratelimit}/*.unit.test.ts.
//
// Surface modelled (Phase 7 — Firestore + Auth):
//   - getFirestore().doc(path).get() / set() / update() / delete()
//   - getFirestore().collection(prefix).where(field, op, value).limit(n).get()
//   - getFirestore().runTransaction(fn) — single-shot snapshot, last-write-wins
//   - FieldValue.serverTimestamp() — sentinel marker
//   - getAuth().setCustomUserClaims(uid, claims) — records into a map
//
// Phase 8 Wave 1 additions (getStorageMock + getFirestoreAdminClientMock):
//   - getStorageMock()              — bucket().file().save() / getSignedUrl() / delete() / exists()
//                                     + bucket().getFiles()
//   - getFirestoreAdminClientMock() — databasePath() + exportDocuments()
//   - _seedStorageObject()          — seed helper (mirrors _seedDoc shape)
//   - _allStorageObjects()          — inspector for tests
//   - _allSignedUrls()              — inspector for issued signed URLs
//   - _allExportCalls()             — inspector for exportDocuments calls
//
// State is module-level so the integration tests share one logical store per
// test run; each `beforeEach` should call `_reset()` to clear it. This mirrors
// functions/src/util/idempotency.ts's `_resetForTest` seam pattern.
//
// ESLint @typescript-eslint/no-explicit-any: this mock is opt-in `any`-heavy
// at boundaries because it stands in for the broad firebase-admin/firestore
// API surface; types are kept loose deliberately so individual tests can
// drive whichever shape they need.

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Phase 7 state ────────────────────────────────────────────────────────────

const docStore = new Map<string, Record<string, unknown>>();
const customClaims = new Map<string, Record<string, unknown>>();
const SERVER_TIMESTAMP = { __isServerTs: true } as const;

// ─── Phase 8 Wave 1 state ─────────────────────────────────────────────────────

const storageObjects = new Map<
  string,
  { body: string | Buffer; contentType: string; savedAt: number }
>();
const issuedSignedUrls: Array<{
  bucket: string;
  path: string;
  expires: number;
  action: string;
}> = [];
const exportCalls: Array<{
  name: string;
  outputUriPrefix: string;
  collectionIds: string[];
}> = [];

// ─── Reset (clears all state — Phase 7 + Phase 8) ────────────────────────────

export function _reset(): void {
  docStore.clear();
  customClaims.clear();
  storageObjects.clear();
  issuedSignedUrls.length = 0;
  exportCalls.length = 0;
}

// ─── Phase 7 seed / inspect helpers ──────────────────────────────────────────

export function _seedDoc(path: string, data: Record<string, unknown>): void {
  docStore.set(path, data);
}

export function _readDoc(path: string): Record<string, unknown> | undefined {
  return docStore.get(path);
}

export function _allDocs(): Map<string, Record<string, unknown>> {
  return new Map(docStore);
}

export function _allClaims(): Map<string, Record<string, unknown>> {
  return new Map(customClaims);
}

// ─── Phase 8 Wave 1 seed / inspect helpers ────────────────────────────────────

export function _seedStorageObject(
  bucketName: string,
  path: string,
  body: string | Buffer,
  contentType = "application/octet-stream",
): void {
  storageObjects.set(`${bucketName}/${path}`, { body, contentType, savedAt: Date.now() });
}

export function _allStorageObjects(): Map<
  string,
  { body: string | Buffer; contentType: string; savedAt: number }
> {
  return new Map(storageObjects);
}

export function _allSignedUrls(): Array<{
  bucket: string;
  path: string;
  expires: number;
  action: string;
}> {
  return [...issuedSignedUrls];
}

export function _allExportCalls(): Array<{
  name: string;
  outputUriPrefix: string;
  collectionIds: string[];
}> {
  return [...exportCalls];
}

// ─── Shared state object ──────────────────────────────────────────────────────

export const adminMockState = {
  _reset,
  _seedDoc,
  _readDoc,
  _allDocs,
  _allClaims,
  SERVER_TIMESTAMP,
  // Phase 8 additions
  _seedStorageObject,
  _allStorageObjects,
  _allSignedUrls,
  _allExportCalls,
};

// ─── Doc reference helpers ────────────────────────────────────────────────────

function makeSnap(path: string) {
  const data = docStore.get(path);
  const exists = data !== undefined;
  return {
    path,
    exists,
    data: () => (data ? { ...data } : undefined),
    get(field: string) {
      return data ? readField(data, field) : undefined;
    },
  };
}

function makeDocRef(path: string) {
  return {
    path,
    async set(data: Record<string, unknown>): Promise<void> {
      docStore.set(path, { ...data });
    },
    async update(data: Record<string, unknown>): Promise<void> {
      const cur = docStore.get(path) ?? {};
      docStore.set(path, { ...cur, ...data });
    },
    async delete(): Promise<void> {
      docStore.delete(path);
    },
    async get() {
      return makeSnap(path);
    },
  };
}

// ─── Collection / query helpers ───────────────────────────────────────────────

interface WhereClause {
  field: string;
  op: string;
  value: unknown;
}

function buildQuery(prefix: string, clauses: WhereClause[], limit: number | null): any {
  return {
    where(field: string, op: string, value: unknown) {
      return buildQuery(prefix, [...clauses, { field, op, value }], limit);
    },
    limit(n: number) {
      return buildQuery(prefix, clauses, n);
    },
    async get() {
      const matches: Array<{
        id: string;
        data: () => Record<string, unknown>;
      }> = [];
      for (const [path, data] of docStore.entries()) {
        if (!path.startsWith(prefix + "/")) continue;
        const tail = path.slice(prefix.length + 1);
        // direct children only — no deeper subcollections (matches Firestore
        // collection-query semantics on the rules-side `match /coll/{id}`).
        if (tail.includes("/")) continue;
        let ok = true;
        for (const clause of clauses) {
          const v = readField(data, clause.field);
          if (clause.op === "==" && v !== clause.value) {
            ok = false;
            break;
          }
          if (clause.op === ">") {
            if (v === undefined || v === null) {
              ok = false;
              break;
            }
            const cur = v instanceof Date ? v.getTime() : Number(v);
            const cmp =
              clause.value instanceof Date
                ? clause.value.getTime()
                : Number(clause.value);
            if (!(cur > cmp)) {
              ok = false;
              break;
            }
          }
        }
        if (!ok) continue;
        matches.push({
          id: tail,
          data: () => ({ ...data }),
        });
        if (limit !== null && matches.length >= limit) break;
      }
      return {
        empty: matches.length === 0,
        size: matches.length,
        docs: matches,
        forEach(fn: (d: { id: string; data: () => Record<string, unknown> }) => void) {
          matches.forEach(fn);
        },
      };
    },
  };
}

function readField(data: Record<string, unknown>, field: string): unknown {
  // Support dotted paths like "target.id" (mirror-trigger queries).
  const parts = field.split(".");
  let cur: unknown = data;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

// ─── Transaction helper (single-shot, no contention model) ────────────────────

function makeTx() {
  const localWrites = new Map<string, Record<string, unknown> | null>();
  return {
    async get(ref: { path: string }) {
      if (localWrites.has(ref.path)) {
        const data = localWrites.get(ref.path);
        const exists = data !== null && data !== undefined;
        return {
          path: ref.path,
          exists,
          data: () => (data ? { ...data } : undefined),
          get(field: string) {
            return data ? readField(data, field) : undefined;
          },
        };
      }
      return makeSnap(ref.path);
    },
    set(ref: { path: string }, data: Record<string, unknown>) {
      localWrites.set(ref.path, { ...data });
    },
    update(ref: { path: string }, data: Record<string, unknown>) {
      const cur = localWrites.get(ref.path) ?? docStore.get(ref.path) ?? {};
      localWrites.set(ref.path, { ...cur, ...data });
    },
    delete(ref: { path: string }) {
      localWrites.set(ref.path, null);
    },
    _commit() {
      for (const [path, data] of localWrites.entries()) {
        if (data === null) docStore.delete(path);
        else docStore.set(path, data);
      }
    },
  };
}

// ─── Batch write helper (Phase 8 Wave 2 — softDelete / restoreSoftDeleted) ───

function makeBatch() {
  type Op =
    | { kind: "set"; path: string; data: Record<string, unknown> }
    | { kind: "update"; path: string; data: Record<string, unknown> }
    | { kind: "delete"; path: string };
  const ops: Op[] = [];
  return {
    set(ref: { path: string }, data: Record<string, unknown>) {
      ops.push({ kind: "set", path: ref.path, data: { ...data } });
    },
    update(ref: { path: string }, data: Record<string, unknown>) {
      ops.push({ kind: "update", path: ref.path, data: { ...data } });
    },
    delete(ref: { path: string }) {
      ops.push({ kind: "delete", path: ref.path });
    },
    async commit() {
      for (const op of ops) {
        if (op.kind === "set") {
          docStore.set(op.path, { ...op.data });
        } else if (op.kind === "update") {
          const cur = docStore.get(op.path) ?? {};
          docStore.set(op.path, { ...cur, ...op.data });
        } else if (op.kind === "delete") {
          docStore.delete(op.path);
        }
      }
    },
  };
}

// ─── Phase 7 public mock factories ───────────────────────────────────────────

export function getFirestoreMock() {
  return {
    doc(path: string) {
      return makeDocRef(path);
    },
    collection(prefix: string) {
      return buildQuery(prefix, [], null);
    },
    batch() {
      return makeBatch();
    },
    async runTransaction<T>(fn: (tx: ReturnType<typeof makeTx>) => Promise<T>): Promise<T> {
      const tx = makeTx();
      const result = await fn(tx);
      tx._commit();
      return result;
    },
  };
}

export function getAuthMock() {
  return {
    async setCustomUserClaims(
      uid: string,
      claims: Record<string, unknown>,
    ): Promise<void> {
      customClaims.set(uid, { ...claims });
    },
  };
}

export const FieldValueMock = {
  serverTimestamp: () => SERVER_TIMESTAMP,
};

// ─── Phase 8 Wave 1 public mock factories ─────────────────────────────────────

export function getStorageMock() {
  return {
    bucket(bucketName: string) {
      return {
        file(filePath: string) {
          const key = `${bucketName}/${filePath}`;
          return {
            async save(
              data: string | Buffer,
              opts: { contentType?: string } = {},
            ): Promise<void> {
              storageObjects.set(key, {
                body: data,
                contentType: opts.contentType ?? "application/octet-stream",
                savedAt: Date.now(),
              });
            },
            async getSignedUrl(opts: {
              version?: string;
              action?: string;
              expires: number;
            }): Promise<[string]> {
              issuedSignedUrls.push({
                bucket: bucketName,
                path: filePath,
                expires: opts.expires,
                action: opts.action ?? "read",
              });
              return [
                `https://signed.example/${bucketName}/${encodeURIComponent(filePath)}?expires=${opts.expires}`,
              ];
            },
            async delete(): Promise<void> {
              storageObjects.delete(key);
            },
            async exists(): Promise<[boolean]> {
              return [storageObjects.has(key)];
            },
          };
        },
        async getFiles(
          opts: { prefix?: string } = {},
        ): Promise<[Array<{ name: string; delete(): Promise<void> }>]> {
          const matches = [...storageObjects.entries()]
            .filter(([k]) => k.startsWith(`${bucketName}/${opts.prefix ?? ""}`))
            .map(([k]) => ({
              name: k.slice(bucketName.length + 1),
              async delete(): Promise<void> {
                storageObjects.delete(k);
              },
            }));
          return [matches];
        },
      };
    },
  };
}

export function getFirestoreAdminClientMock() {
  return {
    databasePath(projectId: string, db: string): string {
      return `projects/${projectId}/databases/${db}`;
    },
    async exportDocuments(req: {
      name: string;
      outputUriPrefix: string;
      collectionIds?: string[];
    }): Promise<[{ name: string }]> {
      exportCalls.push({
        name: req.name,
        outputUriPrefix: req.outputUriPrefix,
        collectionIds: req.collectionIds ?? [],
      });
      return [{ name: `operations/export-${Date.now()}` }];
    },
  };
}
