// Phase 8 Wave 2 (LIFE-01): firebase-functions-test integration coverage for
// the softDelete callable. Pattern 11 (offline mode) — vi.mock stubs Admin SDK
// with stateful in-memory Firestore; t.wrap() exercises the REAL exported callable.

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

const mod = await import("../../src/lifecycle/softDelete.js");
const wrapped = t.wrap(mod.softDelete);

beforeEach(async () => {
  const m = await import("../_mocks/admin-sdk.js");
  m.adminMockState._reset();
});

const adminAuth = { uid: "admin-uid", token: { role: "admin" as const } };

function reqId(suffix: string) {
  return `aa0e8400-e29b-41d4-a716-44665544${suffix}`;
}

describe("softDelete — integration (firebase-functions-test v3)", () => {
  it("happy path: admin caller, type:comment — returns {ok:true}; live doc tombstoned; snapshot has originalPath", async () => {
    const m = await import("../_mocks/admin-sdk.js");
    m.adminMockState._seedDoc("orgs/orgA/comments/c_int", {
      body: "integration test comment",
      authorId: "u1",
      pillarId: "2",
    });

    const result = (await wrapped({
      data: { type: "comment", orgId: "orgA", id: "c_int", clientReqId: reqId("0001") },
      auth: adminAuth,
    } as never)) as { ok: boolean };

    expect(result.ok).toBe(true);

    const live = m.adminMockState._readDoc("orgs/orgA/comments/c_int");
    expect(live!.deletedAt).toBeDefined();
    expect(live!.deletedBy).toBe("admin-uid");

    const snap = m.adminMockState._readDoc("softDeleted/comment/items/c_int");
    expect(snap).toBeDefined();
    expect(snap!.originalPath).toBe("orgs/orgA/comments/c_int");
    expect(snap!.body).toBe("integration test comment");
  });

  it("rejects non-admin (role:client) with permission-denied", async () => {
    await expect(
      wrapped({
        data: { type: "comment", orgId: "orgA", id: "c_int", clientReqId: reqId("0002") },
        auth: { uid: "client-uid", token: { role: "client" } },
      } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("rejects unauthenticated with unauthenticated", async () => {
    await expect(
      wrapped({
        data: { type: "comment", orgId: "orgA", id: "c_int", clientReqId: reqId("0003") },
      } as never),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("rejects already-deleted doc with failed-precondition", async () => {
    const m = await import("../_mocks/admin-sdk.js");
    m.adminMockState._seedDoc("orgs/orgA/comments/c_del2", {
      body: "already gone",
      deletedAt: new Date(),
    });

    await expect(
      wrapped({
        data: { type: "comment", orgId: "orgA", id: "c_del2", clientReqId: reqId("0004") },
        auth: adminAuth,
      } as never),
    ).rejects.toMatchObject({ code: "failed-precondition" });
  });

  it("rejects unknown type via Zod with invalid-argument", async () => {
    await expect(
      wrapped({
        data: { type: "badtype", orgId: "orgA", id: "c_int", clientReqId: reqId("0005") },
        auth: adminAuth,
      } as never),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });
});
