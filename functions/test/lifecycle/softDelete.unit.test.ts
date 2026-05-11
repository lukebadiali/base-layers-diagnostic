// Phase 8 Wave 2 (LIFE-01): unit tests for softDelete callable.
// Uses the stateful in-memory admin-sdk mock — no Firestore emulator.
// The callable is loaded once (no vi.resetModules per-test) so vi.mock
// factories and the seedDoc calls share the same module-registry instance.

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

// Load callable once — shared with vi.mock module registry
const softDeleteMod = await import("../../src/lifecycle/softDelete.js");
const wrapped = t.wrap(softDeleteMod.softDelete);

beforeEach(async () => {
  const m = await import("../_mocks/admin-sdk.js");
  m.adminMockState._reset();
});

const adminAuth = {
  uid: "admin-uid",
  token: { role: "admin" as const, orgId: "orgA" },
};

// Use unique clientReqIds per test to avoid idempotency collisions
function reqId(suffix: string) {
  return `550e8400-e29b-41d4-a716-44665544${suffix}`;
}

describe("softDelete callable", () => {
  it("happy path: tombstones live doc + writes snapshot in batch", async () => {
    const m = await import("../_mocks/admin-sdk.js");
    m.adminMockState._seedDoc("orgs/orgA/comments/c_xyz", {
      body: "hello",
      authorId: "u1",
      pillarId: "1",
    });

    const result = (await wrapped({
      data: { type: "comment", orgId: "orgA", id: "c_xyz", clientReqId: reqId("0001") },
      auth: adminAuth,
    } as never)) as { ok: boolean };

    expect(result.ok).toBe(true);

    const live = m.adminMockState._readDoc("orgs/orgA/comments/c_xyz");
    expect(live).toBeDefined();
    expect(live!.deletedAt).toBeDefined();
    expect(live!.deletedBy).toBe("admin-uid");

    const snapshot = m.adminMockState._readDoc("softDeleted/comment/items/c_xyz");
    expect(snapshot).toBeDefined();
    expect(snapshot!.originalPath).toBe("orgs/orgA/comments/c_xyz");
    expect(snapshot!.originalOrgId).toBe("orgA");
    expect(snapshot!.originalType).toBe("comment");
    expect(snapshot!.body).toBe("hello");
  });

  it("rejects non-admin (role: client) with permission-denied", async () => {
    const m = await import("../_mocks/admin-sdk.js");
    m.adminMockState._seedDoc("orgs/orgA/comments/c_xyz", { body: "hi" });

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

  it("rejects invalid input (missing type) with invalid-argument", async () => {
    await expect(
      wrapped({
        data: { orgId: "orgA", id: "c_xyz", clientReqId: reqId("0004") },
        auth: adminAuth,
      } as never),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects already-deleted doc with failed-precondition", async () => {
    const m = await import("../_mocks/admin-sdk.js");
    m.adminMockState._seedDoc("orgs/orgA/comments/c_del", {
      body: "hi",
      deletedAt: new Date(),
    });

    await expect(
      wrapped({
        data: { type: "comment", orgId: "orgA", id: "c_del", clientReqId: reqId("0005") },
        auth: adminAuth,
      } as never),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("rejects non-existent doc with not-found", async () => {
    await expect(
      wrapped({
        data: { type: "comment", orgId: "orgA", id: "no-such-doc", clientReqId: reqId("0006") },
        auth: adminAuth,
      } as never),
    ).rejects.toMatchObject({ code: "not-found" });
  });
});
