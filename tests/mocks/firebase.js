// tests/mocks/firebase.js
// @ts-check
// Phase 2 (D-11): Reusable Firestore mock factory.
// Phase 4 Wave 3: now retargets vi.mock from "firebase/firestore" to
// "../../src/firebase/db.js" — same factory, plus a `db` sentinel + a
// `subscribeDoc` wrapper to match the firebase/db.js exported surface and
// query-aware getDocs/onSnapshot for the funnelComments where("orgId", ...) shape.
import { vi } from "vitest";

/**
 * @typedef {object} MockOptions
 * @property {boolean}  [failGetDoc]
 * @property {boolean}  [failSetDoc]
 * @property {boolean}  [failUpdateDoc]
 * @property {Record<string, any>} [seed]    Map from "collection/id" -> doc data
 */

/**
 * @param {MockOptions} [opts]
 */
export function makeFirestoreMock(opts = {}) {
  /** @type {Record<string, any>} */
  const seed = opts.seed || {};
  /**
   * @param {any} db
   * @param {string} coll
   * @param {string} id
   */
  const docPath = (db, coll, id) => `${coll}/${id}`;

  /**
   * Resolve a ref (collection or query) to its matching docs, applying any
   * where("field", "==", value) constraints from a query() composition.
   * @param {any} ref
   * @returns {Array<{ id: string, data: () => any }>}
   */
  function rowsForRef(ref) {
    const collName = ref.__coll;
    /** @type {Array<any>} */
    const constraints = ref.__constraints || [];
    return Object.entries(seed)
      .filter(([k]) => k.startsWith(collName + "/"))
      .map(([k, data]) => ({ id: k.slice(collName.length + 1), data: () => data }))
      .filter((d) => constraints.every((c) => {
        if (c && c.__where) {
          const [field, op, value] = c.__where;
          const v = d.data()[field];
          if (op === "==") return v === value;
          if (op === "!=") return v !== value;
          if (op === "in") return Array.isArray(value) && value.includes(v);
        }
        return true;
      }));
  }

  return {
    // Sentinel db object — Phase 4 Wave 3 retargets vi.mock to src/firebase/db.js
    // which exports `db = getFirestore(app)`. The mock provides the same shape.
    db: { __isMockDb: true },
    getFirestore: vi.fn(() => ({ __isMockDb: true })),
    doc: vi.fn(/** @param {any} db @param {string} coll @param {string} id */ (db, coll, id) => ({ __path: docPath(db, coll, id), __coll: coll, __id: id })),
    collection: vi.fn(/** @param {any} db @param {string} coll */ (db, coll) => ({ __coll: coll })),
    addDoc: vi.fn(/** @param {any} ref @param {any} data */ async (ref, data) => {
      const id = "auto_" + Object.keys(seed).length;
      seed[ref.__coll + "/" + id] = { ...data, id };
      return { id, __path: ref.__coll + "/" + id };
    }),
    getDoc: vi.fn(/** @param {any} ref */ async (ref) => {
      if (opts.failGetDoc) throw new Error("mock-getDoc-fail");
      const data = seed[ref.__path];
      return { exists: () => data !== undefined, data: () => data, id: ref.__id };
    }),
    getDocs: vi.fn(/** @param {any} ref */ async (ref) => {
      if (opts.failGetDoc) throw new Error("mock-getDoc-fail");
      const docs = rowsForRef(ref);
      return { forEach: (/** @type {(d: any) => void} */ fn) => docs.forEach(fn), size: docs.length };
    }),
    setDoc: vi.fn(/** @param {any} ref @param {any} data */ async (ref, data) => {
      if (opts.failSetDoc) throw new Error("mock-setDoc-fail");
      seed[ref.__path] = data;
    }),
    updateDoc: vi.fn(/** @param {any} ref @param {any} patch */ async (ref, patch) => {
      if (opts.failUpdateDoc) throw new Error("mock-updateDoc-fail");
      seed[ref.__path] = { ...(seed[ref.__path] || {}), ...patch };
    }),
    deleteDoc: vi.fn(/** @param {any} ref */ async (ref) => {
      delete seed[ref.__path];
    }),
    onSnapshot: vi.fn(/** @param {any} ref @param {(snap: any) => void} onChange @param {(err: Error) => void} [_onError] */ (ref, onChange, _onError) => {
      // Doc ref (ref.__path) → doc snapshot; collection/query ref (ref.__coll
      // without __path) → collection snapshot.
      if (ref && ref.__path) {
        const data = seed[ref.__path];
        onChange({ exists: () => data !== undefined, data: () => data, id: ref.__id });
      } else if (ref && ref.__coll) {
        const docs = rowsForRef(ref);
        onChange({ forEach: (/** @type {(d: any) => void} */ fn) => docs.forEach(fn), size: docs.length });
      }
      return () => {}; // unsubscribe
    }),
    serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
    query: vi.fn(/** @param {any} coll @param {...any} constraints */ (coll, ...constraints) => ({ __coll: coll.__coll, __constraints: constraints })),
    where: vi.fn(/** @param {string} field @param {string} op @param {any} value */ (field, op, value) => ({ __where: [field, op, value] })),
    orderBy: vi.fn(/** @param {string} field @param {string} dir */ (field, dir) => ({ __orderBy: [field, dir] })),
    limit: vi.fn(/** @param {number} n */ (n) => ({ __limit: n })),
    // src/firebase/db.js subscribeDoc wrapper (matches the adapter's signature)
    subscribeDoc: vi.fn(/** @param {any} ref @param {{ onChange: (snap:any) => void, onError: (err:Error) => void }} cb */ (ref, cb) => {
      const data = seed[ref.__path];
      cb.onChange({ exists: () => data !== undefined, data: () => data, id: ref.__id });
      return () => {};
    }),
  };
}
