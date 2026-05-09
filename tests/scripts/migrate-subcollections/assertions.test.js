// tests/scripts/migrate-subcollections/assertions.test.js
// @ts-check
//
// Phase 5 Wave 2 (DATA-06): unit tests for the pre/post migration assertion
// harness. Mocks the firebase-admin db surface with a lightweight in-memory
// duck-typed object (no firebase-admin import — these tests stay pure unit
// tests). Tests pin:
//   - captureBaselineCounts walks orgs + 6 subcollections in order
//   - assertCollectionGroupCount throws on regression, passes on growth/equality
//   - assertFieldPresence throws when sampled docs miss the legacy field
import { describe, it, expect, vi } from "vitest";
import {
  captureBaselineCounts,
  assertCollectionGroupCount,
  assertFieldPresence,
  summarise,
} from "../../../scripts/migrate-subcollections/assertions.js";

/**
 * Build a duck-typed firebase-admin db mock. Caller seeds a counts map
 * (collection-name -> count) for the count() path and a docs array per
 * subcollection for the limit().get() path used by assertFieldPresence.
 *
 * @param {{
 *   counts: Record<string, number>,
 *   docs?: Record<string, Array<Record<string, any>>>,
 * }} opts
 */
function makeDbMock(opts) {
  const docs = opts.docs || {};
  return {
    /** @param {string} name */
    collection(name) {
      const count = opts.counts[name] ?? 0;
      return {
        count() {
          return { get: () => Promise.resolve({ data: () => ({ count }) }) };
        },
      };
    },
    /** @param {string} name */
    collectionGroup(name) {
      const count = opts.counts[name] ?? 0;
      const items = docs[name] || [];
      return {
        count() {
          return { get: () => Promise.resolve({ data: () => ({ count }) }) };
        },
        /** @param {number} n */
        limit(n) {
          const limited = items.slice(0, n);
          return {
            get: () =>
              Promise.resolve({
                size: limited.length,
                /** @param {(d: { data: () => any }) => void} cb */
                forEach(cb) {
                  limited.forEach((data) => cb({ data: () => data }));
                },
              }),
          };
        },
      };
    },
  };
}

describe("captureBaselineCounts", () => {
  it("returns counts for orgs (parent) + 6 subcollection groups", async () => {
    const db = makeDbMock({
      counts: {
        orgs: 3,
        responses: 100,
        comments: 50,
        actions: 20,
        documents: 10,
        messages: 30,
        readStates: 5,
      },
    });
    const counts = await captureBaselineCounts(db);
    expect(counts).toEqual({
      orgs: 3,
      responses: 100,
      comments: 50,
      actions: 20,
      documents: 10,
      messages: 30,
      readStates: 5,
    });
  });

  it("returns 0 when counts are absent (defensive default)", async () => {
    const db = makeDbMock({ counts: {} });
    const counts = await captureBaselineCounts(db);
    expect(counts.orgs).toBe(0);
    expect(counts.responses).toBe(0);
  });
});

describe("assertCollectionGroupCount", () => {
  it("passes when post counts equal pre counts", () => {
    const pre = { orgs: 3, responses: 100, comments: 50, actions: 20, documents: 10, messages: 30, readStates: 5 };
    const post = { ...pre };
    expect(() => assertCollectionGroupCount(pre, post)).not.toThrow();
  });

  it("passes when subcollection post counts grow (migration writes new docs)", () => {
    const pre = { orgs: 3, responses: 0, comments: 0, actions: 0, documents: 0, messages: 0, readStates: 0 };
    const post = { orgs: 3, responses: 100, comments: 50, actions: 20, documents: 10, messages: 30, readStates: 5 };
    expect(() => assertCollectionGroupCount(pre, post)).not.toThrow();
  });

  it("throws when responses subcollection post < pre (regression)", () => {
    const pre = { orgs: 3, responses: 100, comments: 0, actions: 0, documents: 0, messages: 0, readStates: 0 };
    const post = { orgs: 3, responses: 50, comments: 0, actions: 0, documents: 0, messages: 0, readStates: 0 };
    expect(() => assertCollectionGroupCount(pre, post)).toThrow(/responses subcollection count regressed/);
  });

  it("throws when orgs parent count drifts (parent docs created or destroyed)", () => {
    const pre = { orgs: 3, responses: 0, comments: 0, actions: 0, documents: 0, messages: 0, readStates: 0 };
    const post = { orgs: 4, responses: 0, comments: 0, actions: 0, documents: 0, messages: 0, readStates: 0 };
    expect(() => assertCollectionGroupCount(pre, post)).toThrow(/orgs parent count drift/);
  });

  it("throws when orgs parent count drops (catastrophic loss)", () => {
    const pre = { orgs: 3, responses: 0, comments: 0, actions: 0, documents: 0, messages: 0, readStates: 0 };
    const post = { orgs: 2, responses: 0, comments: 0, actions: 0, documents: 0, messages: 0, readStates: 0 };
    expect(() => assertCollectionGroupCount(pre, post)).toThrow(/orgs parent count drift/);
  });

  it("throws when post snapshot omits a key", () => {
    const pre = { orgs: 3, responses: 100 };
    const post = /** @type {any} */ ({ orgs: 3 });
    expect(() => assertCollectionGroupCount(pre, post)).toThrow(/post snapshot missing key 'responses'/);
  });
});

describe("assertFieldPresence", () => {
  it("passes when every sampled doc carries the inline legacy field", async () => {
    const db = makeDbMock({
      counts: { responses: 5, comments: 5, messages: 5 },
      docs: {
        responses: [
          { legacyAppUserId: "u1", values: [] },
          { legacyAppUserId: "u2", values: [] },
        ],
        comments: [
          { legacyAuthorId: "u1", body: "hi" },
          { legacyAuthorId: "u2", body: "hi" },
        ],
        messages: [
          { legacyAuthorId: "u1", body: "hi" },
          { legacyAuthorId: "u2", body: "hi" },
        ],
      },
    });
    await expect(assertFieldPresence(db)).resolves.toBeUndefined();
  });

  it("throws when a sampled response is missing legacyAppUserId", async () => {
    const db = makeDbMock({
      counts: { responses: 1, comments: 0, messages: 0 },
      docs: {
        responses: [{ values: [] }], // no legacyAppUserId
      },
    });
    await expect(assertFieldPresence(db)).rejects.toThrow(
      /responses: 1\/1 sampled docs missing inline legacy field 'legacyAppUserId'/,
    );
  });

  it("throws when a sampled comment is missing legacyAuthorId", async () => {
    const db = makeDbMock({
      counts: { responses: 0, comments: 1, messages: 0 },
      docs: {
        responses: [],
        comments: [{ body: "no-legacy" }],
      },
    });
    await expect(assertFieldPresence(db)).rejects.toThrow(
      /comments: 1\/1 sampled docs missing inline legacy field 'legacyAuthorId'/,
    );
  });

  it("throws when a sampled message is missing legacyAuthorId", async () => {
    const db = makeDbMock({
      counts: { responses: 0, comments: 0, messages: 1 },
      docs: {
        responses: [],
        comments: [],
        messages: [{ body: "no-legacy" }],
      },
    });
    await expect(assertFieldPresence(db)).rejects.toThrow(
      /messages: 1\/1 sampled docs missing inline legacy field 'legacyAuthorId'/,
    );
  });

  it("respects the sampleSize parameter", async () => {
    const limitSpy = vi.fn();
    const db = {
      /** @param {string} name */
      collection() { throw new Error("unused"); },
      /** @param {string} name */
      collectionGroup(name) {
        return {
          /** @param {number} n */
          limit(n) {
            limitSpy(name, n);
            return {
              get: () =>
                Promise.resolve({
                  size: 0,
                  /** @param {Function} _cb */
                  forEach() {},
                }),
            };
          },
        };
      },
    };
    await assertFieldPresence(db, 7);
    // 3 collections sampled (responses + comments + messages) at sampleSize=7
    expect(limitSpy).toHaveBeenCalledTimes(3);
    expect(limitSpy).toHaveBeenCalledWith("responses", 7);
    expect(limitSpy).toHaveBeenCalledWith("comments", 7);
    expect(limitSpy).toHaveBeenCalledWith("messages", 7);
  });

  it("passes silently when a subcollection is empty", async () => {
    const db = makeDbMock({
      counts: { responses: 0, comments: 0, messages: 0 },
      docs: { responses: [], comments: [], messages: [] },
    });
    await expect(assertFieldPresence(db)).resolves.toBeUndefined();
  });
});

describe("summarise (pure log helper)", () => {
  it("returns a multi-line string containing every key", () => {
    const s = summarise({ orgs: 3, responses: 100, comments: 50 });
    expect(s).toMatch(/orgs/);
    expect(s).toMatch(/responses/);
    expect(s).toMatch(/comments/);
    expect(s).toMatch(/3/);
    expect(s).toMatch(/100/);
    expect(s).toMatch(/50/);
  });

  it("returns empty string for empty input", () => {
    expect(summarise({})).toBe("");
  });
});
