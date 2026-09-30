// tests/mocks/window-fb.js
// @ts-check
// Milestone v6: an in-memory stand-in for the `window.FB` bridge that
// src/views/documents.js reads through its getFB dep.
//
// WHY THIS EXISTS. Before v6 the Documents tab had no behavioural tests at
// all — only a DI-shape smoke test — because every view test boots with
// `FB.ready = false`, which short-circuits renderDocuments at its
// "Connecting to shared storage…" branch. That was tolerable while the tab was
// a flat list with a delete button. It is not tolerable for a folder tree with
// breadcrumbs, move pickers and three sort keys, where the interesting
// behaviour is exactly the part that only runs once Firebase is "ready".
//
// This is NOT a Firestore emulator and does not pretend to be one. It
// implements the subset the Documents view actually calls, with the two
// semantics that matter for these tests:
//
//   1. onSnapshot is LIVE — a write re-fires every listener whose collection it
//      touched, which is what the view relies on to repaint after an upload or
//      a move without calling render().
//   2. where("deletedAt", "==", null) matches a field that IS null and NOT a
//      document missing the field. That is real Firestore behaviour, it is the
//      reason scripts/backfill-document-folder-fields exists, and a mock that
//      quietly matched both would hide the exact bug the backfill prevents.
//
// Security rules are NOT modelled. Rules are proved against the real emulator
// in tests/rules/*; asserting them here would be asserting this file.

/** A Firestore Timestamp duck, enough for the view and for document-sort.js. */
/** @param {number} ms */
export function fakeTimestamp(ms) {
  return {
    toMillis: () => ms,
    toDate: () => new Date(ms),
  };
}

const SERVER_TIMESTAMP = Symbol("serverTimestamp");

/**
 * @param {{ now?: () => number, seed?: Record<string, *> }} [opts]
 */
export function makeWindowFB(opts = {}) {
  const now = opts.now || (() => Date.now());
  /** @type {Map<string, *>} Firestore docs, keyed by full slash path. */
  const store = new Map();
  /** @type {Array<{ path: string, match: (data: *) => boolean, constraints: *, cb: (snap: *) => void }>} */
  let listeners = [];
  /** @type {Array<{ path: string, bytes: number, contentType: string }>} */
  const uploads = [];

  Object.entries(opts.seed || {}).forEach(([path, data]) => store.set(path, data));

  /** Replace serverTimestamp sentinels with a concrete stamp. */
  const materialise = (/** @type {*} */ data) => {
    /** @type {*} */
    const out = {};
    Object.entries(data).forEach(([k, v]) => {
      out[k] = v === SERVER_TIMESTAMP ? fakeTimestamp(now()) : v;
    });
    return out;
  };

  /** @param {string} path */
  const collectionOf = (path) => path.slice(0, path.lastIndexOf("/"));

  /** @param {*} constraints */
  const matcher = (constraints) => (/** @type {*} */ data) =>
    constraints
      .filter((/** @type {*} */ c) => c.field !== undefined)
      .every((/** @type {*} */ c) => {
        // Only the equality form the views use. An unsupported operator throws
        // rather than silently passing everything through.
        if (c.op !== "==") throw new Error(`window-fb mock: unsupported operator ${c.op}`);
        // Real Firestore: a field that is absent does not match `== null`.
        if (!(c.field in data)) return false;
        return data[c.field] === c.value;
      });

  /**
   * Apply orderBy/limit constraints to an already-filtered row set. Ordering is
   * only ever by a millisecond timestamp in this app, so a numeric compare on
   * toMillis() covers it; anything else falls back to input order rather than
   * pretending to sort.
   * @param {Array<*>} rows @param {*} constraints
   */
  const applyOrdering = (rows, constraints) => {
    const order = constraints.find((/** @type {*} */ c) => c.__orderBy);
    const cap = constraints.find((/** @type {*} */ c) => c.__limit !== undefined);
    let out = rows;
    if (order) {
      const key = order.__orderBy;
      const dir = order.direction === "desc" ? -1 : 1;
      out = out.slice().sort((a, b) => {
        const av = a.data()[key];
        const bv = b.data()[key];
        const an = av && typeof av.toMillis === "function" ? av.toMillis() : 0;
        const bn = bv && typeof bv.toMillis === "function" ? bv.toMillis() : 0;
        return (an - bn) * dir;
      });
    }
    if (cap) out = out.slice(0, cap.__limit);
    return out;
  };

  /** @param {string} collPath @param {(d: *) => boolean} match @param {*} [constraints] */
  const snapshotFor = (collPath, match, constraints = []) => {
    /** @type {Array<{ id: string, data: () => * }>} */
    let rows = [];
    store.forEach((data, path) => {
      if (collectionOf(path) !== collPath) return;
      if (!match(data)) return;
      rows.push({ id: path.slice(path.lastIndexOf("/") + 1), data: () => ({ ...data }) });
    });
    rows = applyOrdering(rows, constraints);
    return {
      docs: rows,
      size: rows.length,
      empty: rows.length === 0,
      forEach: (/** @type {(d: *) => void} */ fn) => rows.forEach(fn),
    };
  };

  // Writes notify on a microtask, because real Firestore's emissions are
  // asynchronous — see the note on the first emission in onSnapshot.
  const notify = (/** @type {string} */ collPath) => {
    listeners
      .filter((l) => l.path === collPath)
      .forEach((l) => queueMicrotask(() => l.cb(snapshotFor(l.path, l.match, l.constraints))));
  };

  const firestore = {
    /** @param {*} _db @param {...string} segs */
    collection: (_db, ...segs) => ({ __coll: segs.join("/"), __constraints: [] }),
    /** @param {*} _db @param {...string} segs */
    doc: (_db, ...segs) => ({ __path: segs.join("/") }),
    /** @param {*} ref @param {...*} constraints */
    query: (ref, ...constraints) => ({
      __coll: ref.__coll,
      __constraints: [...(ref.__constraints || []), ...constraints],
    }),
    /** @param {string} field @param {string} op @param {*} value */
    where: (field, op, value) => ({ field, op, value }),
    // orderBy + limit are here for main.js's activity-bell subscriptions
    // (ensureActivitySubscriptions), which run on every boot regardless of
    // which route is on screen. Without them the whole render throws before a
    // Documents test gets anywhere near its own assertions.
    /** @param {string} field @param {string} [direction] */
    orderBy: (field, direction = "asc") => ({ __orderBy: field, direction }),
    /** @param {number} n */
    limit: (n) => ({ __limit: n }),
    serverTimestamp: () => SERVER_TIMESTAMP,
    /** @param {*} ref @param {*} data @param {*} [options] */
    setDoc: async (ref, data, options) => {
      const prev = options && options.merge ? store.get(ref.__path) || {} : {};
      store.set(ref.__path, { ...prev, ...materialise(data) });
      notify(collectionOf(ref.__path));
    },
    /** @param {*} ref @param {*} data */
    updateDoc: async (ref, data) => {
      const prev = store.get(ref.__path);
      if (!prev) throw new Error(`window-fb mock: no document at ${ref.__path}`);
      store.set(ref.__path, { ...prev, ...materialise(data) });
      notify(collectionOf(ref.__path));
    },
    /** @param {*} ref */
    getDoc: async (ref) => {
      const data = store.get(ref.__path);
      return { exists: () => data !== undefined, id: ref.__path, data: () => data };
    },
    /** @param {*} refOrQuery @param {(snap: *) => void} onNext */
    onSnapshot: (refOrQuery, onNext) => {
      const constraints = refOrQuery.__constraints || [];
      const match = matcher(constraints);
      const entry = { path: refOrQuery.__coll, match, constraints, cb: onNext };
      listeners.push(entry);
      // The FIRST emission is asynchronous, because real Firestore's is.
      //
      // This is not a detail. main.js calls ensureActivitySubscriptions() from
      // inside render(), and that subscription's callback calls render() again.
      // A synchronous first emission therefore re-enters render() while the
      // outer render is still building the page, and the DOM ends up with two
      // of everything — two <main>s, two document lists, every assertion
      // quietly seeing doubles. Deferring by a microtask is both what
      // Firestore actually does and what keeps the app's own flow intact.
      queueMicrotask(() => onNext(snapshotFor(entry.path, match, constraints)));
      return () => {
        listeners = listeners.filter((l) => l !== entry);
      };
    },
  };

  const storageOps = {
    /** @param {*} _storage @param {string} path */
    ref: (_storage, path) => ({ __path: path }),
    /** @param {*} ref @param {*} file @param {*} [meta] */
    uploadBytesResumable: (ref, file, meta) => {
      uploads.push({
        path: ref.__path,
        bytes: file.size,
        contentType: (meta && meta.contentType) || file.type,
      });
      /** @type {*} */
      const task = Promise.resolve({ ref });
      // The view attaches a progress listener before awaiting.
      task.on = (/** @type {string} */ _evt, /** @type {(s: *) => void} */ cb) => {
        cb({ bytesTransferred: file.size, totalBytes: file.size });
      };
      return task;
    },
    deleteObject: async () => {},
  };

  const FB = {
    ready: true,
    db: { __db: true },
    storage: { __storage: true },
    firestore,
    storageOps,
  };

  // fbReady() in main.js is `!!(window.FB && window.FB.currentUser)`, so this
  // has to stay truthy for any view to get past its "Connecting…" state.
  //
  // It is a property with a setter rather than a plain field because main.js's
  // onAuthStateChanged callback assigns `window.FB.currentUser = null` whenever
  // Firebase Auth reports no user — which, with no real Firebase in a test, is
  // always, and immediately after boot. A plain field would be nulled out
  // before the first render and every one of these tests would silently assert
  // against the connecting state.
  //
  // The setter accepts a real user and ignores a null, which is exactly the
  // shape of "a signed-in session that Firebase Auth has not contradicted".
  let currentUser = { uid: "u_internal-luke" };
  Object.defineProperty(FB, "currentUser", {
    get: () => currentUser,
    set: (v) => {
      if (v) currentUser = v;
    },
    configurable: true,
    enumerable: true,
  });

  return {
    FB,
    // Test-side handles
    store,
    uploads,
    /** @param {string} path @param {*} data */
    seedDoc: (path, data) => {
      store.set(path, data);
      notify(collectionOf(path));
    },
    /** @param {string} path */
    read: (path) => store.get(path),
    /** @param {string} collPath */
    idsIn: (collPath) =>
      Array.from(store.keys())
        .filter((p) => collectionOf(p) === collPath)
        .map((p) => p.slice(p.lastIndexOf("/") + 1)),
  };
}
