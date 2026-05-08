// tests/scripts/migrate-subcollections/idempotency.test.js
// @ts-check
//
// Phase 5 Wave 2 (D-02 / D-06 / Pitfall 8 / Pitfall 10): unit tests for
// processDoc — the per-source-doc processor with two-phase idempotency
// markers, --dry-run short-circuit, and 499-op WriteBatch flushing.
//
// Tests inject a duck-typed firebase-admin db mock so the processor can be
// exercised in isolation (no firebase-admin import in test code; no emulator).
import { describe, it, expect, vi } from "vitest";
import {
  processDoc,
  __BATCH_FLUSH_THRESHOLD,
} from "../../../scripts/migrate-subcollections/process-doc.js";

/**
 * Build a duck-typed firebase-admin db mock with deterministic state. Tracks
 * marker reads/writes + batch.set + batch.commit calls in a journal so tests
 * can assert on the call sequence.
 *
 * @param {{ markerInitial?: { status: string } | null }} opts
 */
function makeDbMock(opts) {
  const markerInitial = opts.markerInitial ?? null;
  /** @type {Array<{ op: string, args: any }>} */
  const journal = [];
  /** @type {Record<string, any>} */
  const markerStore = {};
  // Seed the marker store with the initial state if provided.
  let markerExists = markerInitial !== null;
  let markerData = markerInitial;

  /** @type {Array<{ batchIndex: number, set: ReturnType<typeof vi.fn>, commit: ReturnType<typeof vi.fn> }>} */
  const batches = [];

  const db = {
    /** @param {string} path */
    doc(path) {
      // Marker doc handle: returns get/set bound to the in-memory marker state.
      if (path.startsWith("migrations/")) {
        return {
          /** @returns {Promise<{ exists: boolean, data: () => any }>} */
          async get() {
            journal.push({ op: "marker.get", args: path });
            return {
              exists: markerExists,
              data: () => markerData,
            };
          },
          /** @param {any} data @param {any} [opts2] */
          async set(data, opts2) {
            journal.push({ op: "marker.set", args: { path, data, opts: opts2 } });
            markerExists = true;
            // Honour merge: true semantics — shallow merge previous state.
            if (opts2 && opts2.merge && markerData) {
              markerData = { ...markerData, ...data };
            } else {
              markerData = { ...data };
            }
            markerStore[path] = markerData;
          },
        };
      }
      // Target doc handle: returned to batch.set; we just stamp the path so
      // batch.set assertions can verify the call shape.
      return { __path: path };
    },
    batch() {
      const set = vi.fn();
      const commit = vi.fn(async () => undefined);
      const idx = batches.length;
      batches.push({ batchIndex: idx, set, commit });
      return {
        /** @param {any} ref @param {any} data */
        set: (ref, data) => {
          set(ref, data);
          journal.push({ op: "batch.set", args: { batchIndex: idx, ref, data } });
        },
        commit: async () => {
          await commit();
          journal.push({ op: "batch.commit", args: { batchIndex: idx } });
        },
      };
    },
    __journal: journal,
    __batches: batches,
    __markerStore: markerStore,
    __setMarker(/** @type {any} */ d) {
      markerExists = true;
      markerData = d;
    },
  };
  return db;
}

const FAKE_FIELD_VALUE = {
  serverTimestamp: () => "<server-timestamp>",
};

const SOURCE_DOC = {
  id: "o1",
  data: () => ({ responses: { r1: { u1: { p1: [{ score: 7 }] } } } }),
};

/** Builder that emits N target docs deterministically — for batch flush tests. */
function makeFixedBuilder(/** @type {number} */ n) {
  return (/** @type {string} */ orgId) => {
    /** @type {Array<{path: string, data: any}>} */
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push({ path: `orgs/${orgId}/responses/r__u__p${i}`, data: { i } });
    }
    return out;
  };
}

const SILENT_LOGGER = { log: () => {} };

describe("processDoc — idempotency markers (D-02 / Pitfall 10)", () => {
  it("fresh source doc + no marker: writes PENDING -> batch -> DONE", async () => {
    const db = makeDbMock({ markerInitial: null });
    const builder = makeFixedBuilder(3);

    const result = await processDoc(
      { db, FieldValue: FAKE_FIELD_VALUE, dryRun: false, logger: SILENT_LOGGER },
      "responses-v1",
      builder,
      SOURCE_DOC,
    );

    expect(result).toEqual({ written: 3 });

    // Journal sequence: get marker -> set PENDING -> batch.set x3 -> batch.commit -> set DONE
    const ops = db.__journal.map((e) => e.op);
    expect(ops).toEqual([
      "marker.get",
      "marker.set", // PENDING
      "batch.set",
      "batch.set",
      "batch.set",
      "batch.commit",
      "marker.set", // DONE
    ]);

    // PENDING marker shape
    const pending = db.__journal.find((e) => e.op === "marker.set");
    expect(pending?.args.data).toMatchObject({
      status: "pending",
      startedAt: "<server-timestamp>",
      targetsPlanned: 3,
    });

    // DONE marker shape
    const setEvents = db.__journal.filter((e) => e.op === "marker.set");
    expect(setEvents).toHaveLength(2);
    expect(setEvents[1].args.data).toMatchObject({
      status: "done",
      completedAt: "<server-timestamp>",
      targetsWritten: 3,
    });
    expect(setEvents[1].args.opts).toEqual({ merge: true });
  });

  it("marker.status === 'done': SKIPS the source doc; no writes fire", async () => {
    const db = makeDbMock({ markerInitial: { status: "done", targetsWritten: 3 } });
    const builder = vi.fn(makeFixedBuilder(3));

    const result = await processDoc(
      { db, FieldValue: FAKE_FIELD_VALUE, dryRun: false, logger: SILENT_LOGGER },
      "responses-v1",
      builder,
      SOURCE_DOC,
    );

    expect(result).toEqual({ skipped: true });
    // Builder never invoked
    expect(builder).not.toHaveBeenCalled();
    // No batch ever created (no batch.* ops in journal)
    const batchOps = db.__journal.filter((e) => e.op.startsWith("batch."));
    expect(batchOps).toHaveLength(0);
    // No marker.set after the initial seeded one (we only assert the
    // processor didn't write — only marker.get appears in the journal).
    expect(db.__journal.map((e) => e.op)).toEqual(["marker.get"]);
  });

  it("marker.status === 'pending': RE-PROCESSES (partial-run recovery)", async () => {
    // Simulates a previous run that crashed AFTER writing PENDING but BEFORE
    // the DONE marker. The next run must retry: write PENDING again, batch,
    // DONE. No SKIP fires because status !== 'done'.
    const db = makeDbMock({ markerInitial: { status: "pending", targetsPlanned: 3 } });
    const builder = vi.fn(makeFixedBuilder(3));

    const result = await processDoc(
      { db, FieldValue: FAKE_FIELD_VALUE, dryRun: false, logger: SILENT_LOGGER },
      "responses-v1",
      builder,
      SOURCE_DOC,
    );

    expect(result).toEqual({ written: 3 });
    expect(builder).toHaveBeenCalledOnce();

    const setEvents = db.__journal.filter((e) => e.op === "marker.set");
    expect(setEvents).toHaveLength(2);
    expect(setEvents[0].args.data).toMatchObject({ status: "pending" });
    expect(setEvents[1].args.data).toMatchObject({ status: "done" });
  });

  it("--dry-run: no marker writes; no batch writes; reads + builder still run", async () => {
    const db = makeDbMock({ markerInitial: null });
    const builder = vi.fn(makeFixedBuilder(3));

    const result = await processDoc(
      { db, FieldValue: FAKE_FIELD_VALUE, dryRun: true, logger: SILENT_LOGGER },
      "responses-v1",
      builder,
      SOURCE_DOC,
    );

    expect(result).toEqual({ dryRun: true, wouldWrite: 3 });
    // Builder invoked (read path executes; D-06 / Pitfall 5)
    expect(builder).toHaveBeenCalledOnce();
    // Journal contains ONLY marker.get -- no marker.set, no batch.* ops
    expect(db.__journal.map((e) => e.op)).toEqual(["marker.get"]);
  });

  it("--dry-run + marker.done: SKIP path still fires (idempotency stable across modes)", async () => {
    const db = makeDbMock({ markerInitial: { status: "done" } });
    const builder = vi.fn(makeFixedBuilder(3));

    const result = await processDoc(
      { db, FieldValue: FAKE_FIELD_VALUE, dryRun: true, logger: SILENT_LOGGER },
      "responses-v1",
      builder,
      SOURCE_DOC,
    );

    expect(result).toEqual({ skipped: true });
    expect(builder).not.toHaveBeenCalled();
  });
});

describe("processDoc — WriteBatch flushing (Pitfall 8)", () => {
  it("commits at exactly 499 ops (the threshold value)", () => {
    expect(__BATCH_FLUSH_THRESHOLD).toBe(499);
  });

  it("600 targets -> 2 commits (499 + 101)", async () => {
    const db = makeDbMock({ markerInitial: null });
    const builder = makeFixedBuilder(600);

    const result = await processDoc(
      { db, FieldValue: FAKE_FIELD_VALUE, dryRun: false, logger: SILENT_LOGGER },
      "responses-v1",
      builder,
      SOURCE_DOC,
    );

    expect(result).toEqual({ written: 600 });

    // Two batches were created (mock allocates a fresh batch per db.batch() call)
    expect(db.__batches).toHaveLength(2);
    // First batch flushed at 499 ops; second batch holds the remaining 101
    expect(db.__batches[0].set).toHaveBeenCalledTimes(499);
    expect(db.__batches[0].commit).toHaveBeenCalledOnce();
    expect(db.__batches[1].set).toHaveBeenCalledTimes(101);
    expect(db.__batches[1].commit).toHaveBeenCalledOnce();
  });

  it("499 targets -> exactly 1 commit (boundary case)", async () => {
    const db = makeDbMock({ markerInitial: null });
    const builder = makeFixedBuilder(499);

    await processDoc(
      { db, FieldValue: FAKE_FIELD_VALUE, dryRun: false, logger: SILENT_LOGGER },
      "responses-v1",
      builder,
      SOURCE_DOC,
    );

    // 499 hits the flush -> commit fires; trailing batchCount == 0 -> no second commit
    expect(db.__batches).toHaveLength(2); // a second empty batch is allocated post-flush
    expect(db.__batches[0].set).toHaveBeenCalledTimes(499);
    expect(db.__batches[0].commit).toHaveBeenCalledOnce();
    expect(db.__batches[1].set).not.toHaveBeenCalled();
    expect(db.__batches[1].commit).not.toHaveBeenCalled();
  });

  it("0 targets -> no batch commits at all (defensive default)", async () => {
    const db = makeDbMock({ markerInitial: null });
    const builder = makeFixedBuilder(0);

    const result = await processDoc(
      { db, FieldValue: FAKE_FIELD_VALUE, dryRun: false, logger: SILENT_LOGGER },
      "responses-v1",
      builder,
      SOURCE_DOC,
    );

    expect(result).toEqual({ written: 0 });
    // One batch is created but never committed (batchCount == 0 trailing)
    expect(db.__batches).toHaveLength(1);
    expect(db.__batches[0].set).not.toHaveBeenCalled();
    expect(db.__batches[0].commit).not.toHaveBeenCalled();

    // Markers still written (PENDING then DONE) — the source doc is "processed"
    // even with zero targets, so re-runs SKIP it.
    const setEvents = db.__journal.filter((e) => e.op === "marker.set");
    expect(setEvents).toHaveLength(2);
    expect(setEvents[1].args.data).toMatchObject({ status: "done", targetsWritten: 0 });
  });
});

describe("processDoc — marker path shape (D-02)", () => {
  it("uses migrations/{stepId}/items/{sourceDoc.id} as the marker path", async () => {
    const db = makeDbMock({ markerInitial: null });
    const builder = makeFixedBuilder(1);

    await processDoc(
      { db, FieldValue: FAKE_FIELD_VALUE, dryRun: false, logger: SILENT_LOGGER },
      "comments-v1",
      builder,
      { id: "org-abc", data: () => ({}) },
    );

    const getOp = db.__journal.find((e) => e.op === "marker.get");
    expect(getOp?.args).toBe("migrations/comments-v1/items/org-abc");
    const setOp = db.__journal.find((e) => e.op === "marker.set");
    expect(setOp?.args.path).toBe("migrations/comments-v1/items/org-abc");
  });
});
