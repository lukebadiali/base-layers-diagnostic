// @ts-nocheck
// tests/data/soft-deleted.test.js
// Phase 8 Wave 2 (LIFE-06): unit tests for src/data/soft-deleted.js browser
// wrapper. Mocks src/firebase/db.js so no Firestore connection needed.

import { beforeEach, describe, it, expect, vi } from "vitest";

vi.mock("../../src/firebase/db.js", () => {
  // Minimal Firestore mock for collection + getDocs
  const collections = new Map();

  return {
    db: { __mock: true },
    collection: vi.fn((_db, ...segments) => ({ __path: segments.join("/") })),
    getDocs: vi.fn(async (ref) => {
      const docs = collections.get(ref.__path) || [];
      return {
        forEach: (/** @type {(d: any) => void} */ fn) => docs.forEach(fn),
      };
    }),
    // Expose seed helper for test setup
    __seed(path, docs) {
      collections.set(path, docs);
    },
    __clear() {
      collections.clear();
    },
  };
});

const dbMod = await import("../../src/firebase/db.js");
const { listSoftDeleted } = await import("../../src/data/soft-deleted.js");

describe("src/data/soft-deleted.js — listSoftDeleted()", () => {
  beforeEach(() => {
    /** @type {any} */ (dbMod).__clear();
  });

  it("returns empty array when all softDeleted collections are empty", async () => {
    const result = await listSoftDeleted();
    expect(result).toEqual([]);
  });

  it("returns merged entries across all 5 types with correct shape", async () => {
    const deletedAt = new Date("2026-05-01T00:00:00Z");
    /** @type {any} */ (dbMod).__seed("softDeleted/comment/items", [
      {
        id: "c1",
        data: () => ({
          body: "test comment",
          originalOrgId: "orgA",
          deletedAt,
        }),
      },
    ]);
    /** @type {any} */ (dbMod).__seed("softDeleted/message/items", [
      {
        id: "m1",
        data: () => ({
          body: "test message",
          originalOrgId: "orgB",
          deletedAt,
        }),
      },
    ]);

    const result = await listSoftDeleted();
    expect(result).toHaveLength(2);

    const comment = result.find((r) => r.type === "comment");
    expect(comment).toBeDefined();
    expect(comment.id).toBe("c1");
    expect(comment.orgId).toBe("orgA");
    expect(comment.deletedAt).toBe(deletedAt);
    expect(comment.snapshot.body).toBe("test comment");

    const message = result.find((r) => r.type === "message");
    expect(message).toBeDefined();
    expect(message.id).toBe("m1");
    expect(message.orgId).toBe("orgB");
  });

  it("derives orgId from snapshot.originalOrgId; falls back to null when absent", async () => {
    /** @type {any} */ (dbMod).__seed("softDeleted/document/items", [
      {
        id: "d1",
        data: () => ({
          name: "file.pdf",
          // no originalOrgId
          deletedAt: new Date(),
        }),
      },
    ]);

    const result = await listSoftDeleted();
    const doc = result.find((r) => r.type === "document");
    expect(doc).toBeDefined();
    expect(doc.orgId).toBeNull();
  });
});
