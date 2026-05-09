// Phase 7 Wave 6 (TEST-09): shared Admin SDK mock for the firebase-functions-test
// integration suite under test/integration/. The integration tests use
// firebase-functions-test@3.5.0's `wrap()` to exercise the REAL exported
// callable / trigger functions; the Admin SDK behind them is stateful but
// in-memory (no Firestore emulator dependency, per 07-RESEARCH.md Pattern 11
// "offline mode preferred"). This complements (does not replace) the
// pure-mocked unit tests under test/{auth,audit,ratelimit}/*.unit.test.ts.
//
// Surface modelled (just enough for Phase 7 callables + triggers):
//   - getFirestore().doc(path).get() / set() / update() / delete()
//   - getFirestore().collection(prefix).where(field, op, value).limit(n).get()
//   - getFirestore().runTransaction(fn) — single-shot snapshot, last-write-wins
//   - FieldValue.serverTimestamp() — sentinel marker
//   - getAuth().setCustomUserClaims(uid, claims) — records into a map
//
// State is module-level so the integration tests share one logical Firestore
// per test run; each `beforeEach` should call `_reset()` to clear it. This
// mirrors functions/src/util/idempotency.ts's `_resetForTest` seam pattern.
//
// ESLint @typescript-eslint/no-explicit-any: this mock is opt-in `any`-heavy
// at boundaries because it stands in for the broad firebase-admin/firestore
// API surface; types are kept loose deliberately so individual tests can
// drive whichever shape they need.

/* eslint-disable @typescript-eslint/no-explicit-any */

const docStore = new Map<string, Record<string, unknown>>();
const customClaims = new Map<string, Record<string, unknown>>();
const SERVER_TIMESTAMP = { __isServerTs: true } as const;

export function _reset(): void {
  docStore.clear();
  customClaims.clear();
}

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

export const adminMockState = {
  _reset,
  _seedDoc,
  _readDoc,
  _allDocs,
  _allClaims,
  SERVER_TIMESTAMP,
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

// ─── Public mock factory ──────────────────────────────────────────────────────

export function getFirestoreMock() {
  return {
    doc(path: string) {
      return makeDocRef(path);
    },
    collection(prefix: string) {
      return buildQuery(prefix, [], null);
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
