// Phase 8 Wave 2 (LIFE-06): unit tests for permanentlyDeleteSoftDeleted callable.
// Callable loaded once (no vi.resetModules per-test) so vi.mock factories and
// seedDoc calls share the same module-registry instance.

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
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

vi.mock("firebase-functions/params", () => ({
  defineSecret: (name: string) => ({ name, value: () => "" }),
}));

vi.mock("firebase-functions/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

const t = functionsTest({ projectId: "bedeveloped-base-layers-test" });
afterAll(() => t.cleanup());

const mod = await import("../../src/lifecycle/permanentlyDeleteSoftDeleted.js");
const wrapped = t.wrap(mod.permanentlyDeleteSoftDeleted);

beforeEach(async () => {
  const m = await import("../_mocks/admin-sdk.js");
  m.adminMockState._reset();
});

const adminAuth = {
  uid: "admin-uid",
  token: { role: "admin" as const },
};

function reqId(suffix: string) {
  return `cc0e8400-e29b-41d4-a716-44665544${suffix}`;
}

describe("permanentlyDeleteSoftDeleted callable", () => {
  it("rejects non-admin with permission-denied", async () => {
    await expect(
      wrapped({
        data: { type: "comment", id: "c_xyz", clientReqId: reqId("0001") },
        auth: { uid: "client-uid", token: { role: "client" } },
      } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("rejects unauthenticated with unauthenticated", async () => {
    await expect(
      wrapped({
        data: { type: "comment", id: "c_xyz", clientReqId: reqId("0002") },
      } as never),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("rejects invalid input (missing type) with invalid-argument", async () => {
    await expect(
      wrapped({
        data: { id: "c_xyz", clientReqId: reqId("0003") },
        auth: adminAuth,
      } as never),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("happy path: admin caller, seeded softDeleted doc — returns {ok:true}; doc is gone", async () => {
    const m = await import("../_mocks/admin-sdk.js");
    m.adminMockState._seedDoc("softDeleted/comment/items/c_xyz", {
      body: "soft-deleted comment",
      deletedAt: new Date(),
      originalOrgId: "orgA",
    });

    const result = (await wrapped({
      data: { type: "comment", id: "c_xyz", clientReqId: reqId("0004") },
      auth: adminAuth,
    } as never)) as { ok: boolean };

    expect(result.ok).toBe(true);
    expect(m.adminMockState._readDoc("softDeleted/comment/items/c_xyz")).toBeUndefined();
  });

  it("rejects when softDeleted record absent with not-found", async () => {
    await expect(
      wrapped({
        data: { type: "comment", id: "no-such", clientReqId: reqId("0005") },
        auth: adminAuth,
      } as never),
    ).rejects.toMatchObject({ code: "not-found" });
  });

  it("rejects idempotent re-delete with same clientReqId within 5min with already-exists", async () => {
    const m = await import("../_mocks/admin-sdk.js");
    m.adminMockState._seedDoc("softDeleted/comment/items/c_idem", {
      body: "idempotency test",
      deletedAt: new Date(),
    });

    // First call succeeds
    await wrapped({
      data: { type: "comment", id: "c_idem", clientReqId: reqId("0006") },
      auth: adminAuth,
    } as never);

    // Re-seed so the doc exists again (simulating a new doc at same path)
    m.adminMockState._seedDoc("softDeleted/comment/items/c_idem", {
      body: "re-seeded",
      deletedAt: new Date(),
    });

    // Second call with same clientReqId → idempotency block
    await expect(
      wrapped({
        data: { type: "comment", id: "c_idem", clientReqId: reqId("0006") },
        auth: adminAuth,
      } as never),
    ).rejects.toMatchObject({ code: "already-exists" });
  });
});
