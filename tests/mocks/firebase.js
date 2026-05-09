// tests/mocks/firebase.js
// @ts-check
// Phase 2 (D-11): Reusable Firestore mock factory.
// Phase 4 Wave 3: retargeted vi.mock from "firebase/firestore" to
// "../../src/firebase/db.js" — same factory, plus a `db` sentinel + a
// `subscribeDoc` wrapper to match the firebase/db.js exported surface and
// query-aware getDocs/onSnapshot for the funnelComments where("orgId", ...) shape.
// Phase 5 Wave 3 (05-03): collection/doc handlers extended to accept variadic
// path segments so subcollection refs (e.g. collection(db, 'orgs', orgId,
// 'comments') or doc(db, 'orgs', orgId, 'readStates', userId)) compose into
// slash-joined `__coll`/`__path` keys. The seed-key convention now extends
// to 4-segment keys like 'orgs/o1/comments/c1'; the rowsForRef startsWith
// filter handles both 2-segment and 4-segment paths uniformly.
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
      // Restrict to direct children of collName: the remainder after the
      // collection prefix must not contain a '/' (otherwise a 2-segment
      // collection like 'orgs' would match deeper subcollection seed keys
      // such as 'orgs/o1/comments/c1' as if c1 were an org).
      .filter(([k]) => !k.slice(collName.length + 1).includes("/"))
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
    // Variadic doc handler (Phase 5 Wave 3 / 05-03): supports both
    //   doc(db, 'orgs', orgId)                           -> 2-segment
    //   doc(db, 'orgs', orgId, 'readStates', userId)     -> 4-segment
    // Path segments are alternating (collection, id) pairs; the args length
    // (excluding `db`) MUST be even.
    //
    // Phase 7 Wave 4 (FN-09 / 07-04) extension: also supports the
    // single-string-path form
    //   doc(db, 'rateLimits/uid/buckets/win')            -> single string
    // matching firebase/firestore's overloaded `doc(db, path)` API. The
    // path is split on '/' and must have an even number of segments
    // (alternating collection/id).
    doc: vi.fn(/** @param {any} _db @param {...string} args */ (_db, ...args) => {
      // Single-string-path form: split into alternating segments.
      if (args.length === 1 && typeof args[0] === "string" && args[0].includes("/")) {
        const segments = args[0].split("/");
        if (segments.length < 2 || segments.length % 2 !== 0) {
          throw new Error(`doc(path): path must have even segment count; got "${args[0]}"`);
        }
        const id = segments[segments.length - 1];
        const collPath = segments.slice(0, -1).join("/");
        return { __path: `${collPath}/${id}`, __coll: collPath, __id: id };
      }
      if (args.length < 2 || args.length % 2 !== 0) {
        throw new Error(`doc() requires alternating collection/id pairs; got ${args.length} args`);
      }
      const id = args[args.length - 1];
      const collPath = args.slice(0, -1).join("/");
      const path = `${collPath}/${id}`;
      return { __path: path, __coll: collPath, __id: id };
    }),
    // Variadic collection handler (Phase 5 Wave 3 / 05-03): supports both
    //   collection(db, 'orgs')                           -> 1-segment
    //   collection(db, 'orgs', orgId, 'comments')        -> 3-segment (subcollection)
    // Path segments after `db` are joined with '/' to form __coll, which
    // rowsForRef matches against seed keys via startsWith(__coll + '/').
    collection: vi.fn(/** @param {any} _db @param {...string} args */ (_db, ...args) => {
      const collPath = args.join("/");
      return { __coll: collPath };
    }),
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
    // Phase 7 Wave 4 (FN-09 / 07-04): runTransaction shim for src/data/rate-limit.js.
    // Provides a tx with get/set/update/delete that shares the same `seed` map.
    // No real-Firestore optimistic-concurrency emulation — single-threaded test
    // shim only; tests verify the helper's increment/write composition logic,
    // not contention semantics. Conflict semantics are exercised in
    // tests/rules/rate-limit.test.js against the real emulator.
    runTransaction: vi.fn(/** @param {any} _db @param {(tx: any) => Promise<any>} updater */ async (_db, updater) => {
      const tx = {
        get: vi.fn(/** @param {any} ref */ async (ref) => {
          if (opts.failGetDoc) throw new Error("mock-getDoc-fail");
          const data = seed[ref.__path];
          return {
            exists: () => data !== undefined,
            data: () => data,
            id: ref.__id,
          };
        }),
        set: vi.fn(/** @param {any} ref @param {any} data */ (ref, data) => {
          seed[ref.__path] = data;
        }),
        update: vi.fn(/** @param {any} ref @param {any} patch */ (ref, patch) => {
          seed[ref.__path] = { ...(seed[ref.__path] || {}), ...patch };
        }),
        delete: vi.fn(/** @param {any} ref */ (ref) => {
          delete seed[ref.__path];
        }),
      };
      return updater(tx);
    }),
    // src/firebase/db.js subscribeDoc wrapper (matches the adapter's signature)
    subscribeDoc: vi.fn(/** @param {any} ref @param {{ onChange: (snap:any) => void, onError: (err:Error) => void }} cb */ (ref, cb) => {
      const data = seed[ref.__path];
      cb.onChange({ exists: () => data !== undefined, data: () => data, id: ref.__id });
      return () => {};
    }),
  };
}
