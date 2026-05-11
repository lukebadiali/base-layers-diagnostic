// Phase 8 Wave 2 (LIFE-06): firebase-functions-test integration coverage for
// the permanentlyDeleteSoftDeleted callable. Pattern 11 (offline mode).

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

const adminAuth = { uid: "admin-uid", token: { role: "admin" as const } };

describe("permanentlyDeleteSoftDeleted — integration (firebase-functions-test v3)", () => {
  it("round-trip: seeds softDeleted doc, callable hard-deletes it, doc is gone", async () => {
    const m = await import("../_mocks/admin-sdk.js");
    m.adminMockState._seedDoc("softDeleted/message/items/m_int", {
      body: "integration test message",
      deletedAt: new Date(),
      originalOrgId: "orgA",
    });

    const result = (await wrapped({
      data: {
        type: "message",
        id: "m_int",
        clientReqId: "dd0e8400-e29b-41d4-a716-446655440001",
      },
      auth: adminAuth,
    } as never)) as { ok: boolean };

    expect(result.ok).toBe(true);
    expect(m.adminMockState._readDoc("softDeleted/message/items/m_int")).toBeUndefined();
  });
});
