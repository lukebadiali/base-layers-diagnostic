// Phase 8 Wave 2 (LIFE-02): unit tests for restoreSoftDeleted callable.
// Uses the stateful in-memory admin-sdk mock — no Firestore emulator.
// Callable loaded once so vi.mock factories and seedDoc calls share the same
// module-registry instance (avoids vi.resetModules seed-visibility bug).

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

const restoreMod = await import("../../src/lifecycle/restoreSoftDeleted.js");
const wrapped = t.wrap(restoreMod.restoreSoftDeleted);

beforeEach(async () => {
  const m = await import("../_mocks/admin-sdk.js");
  m.adminMockState._reset();
});

const adminAuth = {
  uid: "admin-uid",
  token: { role: "admin" as const, orgId: "orgA" },
};

function reqId(suffix: string) {
  return `770e8400-e29b-41d4-a716-44665544${suffix}`;
}

describe("restoreSoftDeleted callable", () => {
  it("happy path: clears deletedAt on live doc + removes snapshot", async () => {
    const m = await import("../_mocks/admin-sdk.js");

    m.adminMockState._seedDoc("orgs/orgA/comments/c_xyz", {
      body: "hello",
      deletedAt: new Date(),
      deletedBy: "admin-uid",
    });
    m.adminMockState._seedDoc("softDeleted/comment/items/c_xyz", {
      body: "hello",
      deletedAt: new Date(),
      deletedBy: "admin-uid",
      originalPath: "orgs/orgA/comments/c_xyz",
      originalType: "comment",
      originalOrgId: "orgA",
    });

    const result = (await wrapped({
      data: { type: "comment", orgId: "orgA", id: "c_xyz", clientReqId: reqId("0001") },
      auth: adminAuth,
    } as never)) as { ok: boolean };

    expect(result.ok).toBe(true);

    const live = m.adminMockState._readDoc("orgs/orgA/comments/c_xyz");
    expect(live).toBeDefined();
    expect(live!.deletedAt).toBeNull();
    expect(live!.deletedBy).toBeNull();
    expect(live!.restoredBy).toBe("admin-uid");

    const snapshot = m.adminMockState._readDoc("softDeleted/comment/items/c_xyz");
    expect(snapshot).toBeUndefined();
  });

  it("rejects non-admin with permission-denied", async () => {
    await expect(
      wrapped({
        data: { type: "comment", orgId: "orgA", id: "c_xyz", clientReqId: reqId("0002") },
        auth: { uid: "client-uid", token: { role: "client" } },
      } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("rejects unauthenticated with unauthenticated error", async () => {
    await expect(
      wrapped({
        data: { type: "comment", orgId: "orgA", id: "c_xyz", clientReqId: reqId("0003") },
      } as never),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("rejects when softDeleted snapshot is absent with not-found", async () => {
    const m = await import("../_mocks/admin-sdk.js");
    m.adminMockState._seedDoc("orgs/orgA/comments/c_xyz", {
      body: "hello",
      deletedAt: new Date(),
    });

    await expect(
      wrapped({
        data: { type: "comment", orgId: "orgA", id: "c_xyz", clientReqId: reqId("0004") },
        auth: adminAuth,
      } as never),
    ).rejects.toMatchObject({ code: "not-found" });
  });
});
