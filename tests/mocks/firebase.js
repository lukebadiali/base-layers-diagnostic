// tests/mocks/firebase.js
// @ts-check
// Phase 2 (D-11): Reusable Firestore mock factory.
// Phase 4 forward-compat: when src/firebase/db.js lands, change vi.mock target
// from "firebase/firestore" to "../../src/firebase/db.js" — same factory.
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

  return {
    getFirestore: vi.fn(() => ({ __isMockDb: true })),
    doc: vi.fn(/** @param {any} db @param {string} coll @param {string} id */ (db, coll, id) => ({ __path: docPath(db, coll, id), __coll: coll, __id: id })),
    collection: vi.fn(/** @param {any} db @param {string} coll */ (db, coll) => ({ __coll: coll })),
    getDoc: vi.fn(/** @param {any} ref */ async (ref) => {
      if (opts.failGetDoc) throw new Error("mock-getDoc-fail");
      const data = seed[ref.__path];
      return { exists: () => data !== undefined, data: () => data, id: ref.__id };
    }),
    getDocs: vi.fn(/** @param {any} ref */ async (ref) => {
      if (opts.failGetDoc) throw new Error("mock-getDoc-fail");
      const docs = Object.entries(seed)
        .filter(([k]) => k.startsWith(ref.__coll + "/"))
        .map(([k, data]) => ({ id: k.slice(ref.__coll.length + 1), data: () => data }));
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
    onSnapshot: vi.fn(/** @param {any} ref @param {(snap: any) => void} cb */ (ref, cb) => {
      // Synchronously fire once with current state, return unsubscribe.
      const data = seed[ref.__path];
      cb({ exists: () => data !== undefined, data: () => data, id: ref.__id });
      return () => {}; // unsubscribe
    }),
    serverTimestamp: vi.fn(() => ({ __serverTimestamp: true })),
    query: vi.fn(/** @param {any} coll @param {...any} constraints */ (coll, ...constraints) => ({ __coll: coll.__coll, __constraints: constraints })),
    where: vi.fn(/** @param {string} field @param {string} op @param {any} value */ (field, op, value) => ({ __where: [field, op, value] })),
    orderBy: vi.fn(/** @param {string} field @param {string} dir */ (field, dir) => ({ __orderBy: [field, dir] })),
    limit: vi.fn(/** @param {number} n */ (n) => ({ __limit: n })),
  };
}
