// Phase 8 Wave 2 (LIFE-05): unit tests for scheduledPurge.
// Uses the stateful in-memory admin-sdk mock with extended "<" + orderBy +
// startAfter support (Phase 8 Wave 2 mock extension).

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import functionsTest from "firebase-functions-test";

vi.mock("firebase-admin/app", () => ({
  initializeApp: () => ({}),
  getApps: () => [{}],
}));

vi.mock("firebase-admin/firestore", async () => {
  const m = await import("../_mocks/admin-sdk.js");
  return {
    getFirestore: () => m.getFirestoreMock(),
    FieldValue: m.FieldValueMock,
  };
});

vi.mock("firebase-functions/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const t = functionsTest({ projectId: "bedeveloped-base-layers-test" });
afterAll(() => t.cleanup());

const purgeMod = await import("../../src/lifecycle/scheduledPurge.js");
const wrapped = t.wrap(purgeMod.scheduledPurge);

beforeEach(async () => {
  const m = await import("../_mocks/admin-sdk.js");
  m.adminMockState._reset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-15T03:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

// Dates relative to fake "now" 2026-06-15T03:00:00Z
const OLD_DATE = new Date("2026-05-14T00:00:00Z"); // 32 days ago — beyond 30d cutoff
const FRESH_DATE = new Date("2026-06-10T00:00:00Z"); // 5 days ago — within 30d

describe("scheduledPurge", () => {
  it("deletes stale docs (>30d) and keeps fresh docs (<30d)", async () => {
    const m = await import("../_mocks/admin-sdk.js");
    m.adminMockState._seedDoc("softDeleted/comment/items/c1", { deletedAt: OLD_DATE, body: "a" });
    m.adminMockState._seedDoc("softDeleted/comment/items/c2", { deletedAt: OLD_DATE, body: "b" });
    m.adminMockState._seedDoc("softDeleted/comment/items/c3", { deletedAt: OLD_DATE, body: "c" });
    m.adminMockState._seedDoc("softDeleted/comment/items/c4", { deletedAt: FRESH_DATE, body: "fresh" });

    await wrapped({} as never);

    expect(m.adminMockState._readDoc("softDeleted/comment/items/c1")).toBeUndefined();
    expect(m.adminMockState._readDoc("softDeleted/comment/items/c2")).toBeUndefined();
    expect(m.adminMockState._readDoc("softDeleted/comment/items/c3")).toBeUndefined();
    expect(m.adminMockState._readDoc("softDeleted/comment/items/c4")).toBeDefined();
  });

  it("paginates correctly: deletes all 1200 stale docs across multiple pages", async () => {
    const m = await import("../_mocks/admin-sdk.js");
    for (let i = 0; i < 1200; i++) {
      m.adminMockState._seedDoc(`softDeleted/message/items/m${i}`, {
        deletedAt: OLD_DATE,
        body: `msg-${i}`,
      });
    }
    const before = m.adminMockState._allDocs().size;
    expect(before).toBe(1200);

    await wrapped({} as never);

    const after = m.adminMockState._allDocs().size;
    expect(after).toBe(0);
  });

  it("no-ops cleanly on empty softDeleted collections", async () => {
    // All collections empty — should not throw
    await expect(wrapped({} as never)).resolves.not.toThrow();
  });

  it("iterates all 5 SOFT_DELETABLE_TYPES: one stale doc per type, all deleted", async () => {
    const m = await import("../_mocks/admin-sdk.js");
    for (const type of ["action", "comment", "document", "message", "funnelComment"]) {
      m.adminMockState._seedDoc(`softDeleted/${type}/items/item1`, {
        deletedAt: OLD_DATE,
      });
    }

    await wrapped({} as never);

    for (const type of ["action", "comment", "document", "message", "funnelComment"]) {
      expect(m.adminMockState._readDoc(`softDeleted/${type}/items/item1`)).toBeUndefined();
    }
  });

  it("logs lifecycle.purge.completed with purgedByType map", async () => {
    const m = await import("../_mocks/admin-sdk.js");
    const { logger } = await import("firebase-functions/logger");
    m.adminMockState._seedDoc("softDeleted/comment/items/c1", { deletedAt: OLD_DATE });
    m.adminMockState._seedDoc("softDeleted/message/items/m1", { deletedAt: OLD_DATE });

    await wrapped({} as never);

    expect(logger.info).toHaveBeenCalledWith(
      "lifecycle.purge.completed",
      expect.objectContaining({
        purgedByType: expect.objectContaining({ comment: 1, message: 1 }),
      }),
    );
  });
});
