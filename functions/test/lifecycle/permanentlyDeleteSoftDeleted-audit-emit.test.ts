// Phase 9 Wave 3 (BLOCKER 3 / AUDIT-05): unit tests for the
// data.<type>.permanentlyDelete server-side bare audit emission added to
// functions/src/lifecycle/permanentlyDeleteSoftDeleted.ts.

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

const { adminMockState } = await import("../_mocks/admin-sdk.js");

beforeEach(() => {
  adminMockState._reset();
});

const adminAuth = {
  uid: "admin-uid",
  token: {
    role: "admin" as const,
    email: "admin@example.com",
    orgId: "orgA",
  },
};

function reqId(suffix: string) {
  return `cd0e8400-e29b-41d4-a716-44665544${suffix}`;
}

function findAuditDoc(eventType: string): Record<string, unknown> | undefined {
  const docs = adminMockState._allDocs();
  for (const [path, data] of docs.entries()) {
    if (path.startsWith("auditLog/") && (data as Record<string, unknown>).type === eventType) {
      return data as Record<string, unknown>;
    }
  }
  return undefined;
}

describe("permanentlyDeleteSoftDeleted — Phase 9 audit emission", () => {
  // Test 5: emits data.<type>.permanentlyDelete with target.orgId === null
  it("emits data.message.permanentlyDelete after ref.delete() with actor from token + target.orgId:null", async () => {
    adminMockState._seedDoc("softDeleted/message/items/m1", {
      body: "soft-deleted message",
      deletedAt: new Date(),
      originalOrgId: "orgA",
    });

    const result = (await wrapped({
      data: {
        type: "message",
        id: "m1",
        clientReqId: reqId("0001"),
      },
      auth: adminAuth,
    } as never)) as { ok: boolean };

    expect(result.ok).toBe(true);

    const auditDoc = findAuditDoc("data.message.permanentlyDelete");
    expect(auditDoc).toBeDefined();
    // target.orgId is null because the callable input has no orgId field
    // (resource lives in softDeleted/{type}/items/{id} — admin-scoped path).
    expect(auditDoc!.target).toEqual({
      type: "message",
      id: "m1",
      orgId: null,
    });
    expect(auditDoc!.actor).toEqual({
      uid: "admin-uid",
      email: "admin@example.com",
      role: "admin",
      orgId: "orgA",
    });
    expect(auditDoc!.payload).toEqual({});
  });

  // Test 6: not-found early return — no audit emit (op never happened).
  it("does NOT emit when softDeleted record absent (not-found thrown before emission)", async () => {
    await expect(
      wrapped({
        data: {
          type: "comment",
          id: "no-such-doc",
          clientReqId: reqId("0002"),
        },
        auth: adminAuth,
      } as never),
    ).rejects.toMatchObject({ code: "not-found" });

    // No audit row for an op that never happened.
    expect(findAuditDoc("data.comment.permanentlyDelete")).toBeUndefined();
  });

  // Best-effort swallow: emit failure doesn't block the hard-delete.
  it("returns {ok:true} and softDeleted doc is gone even when audit emit throws", async () => {
    adminMockState._seedDoc("softDeleted/document/items/d1", {
      title: "soft-deleted doc",
      deletedAt: new Date(),
      originalOrgId: "orgA",
    });

    const auditLogger = await import("../../src/audit/auditLogger.js");
    const writeSpy = vi
      .spyOn(auditLogger, "writeAuditEvent")
      .mockRejectedValueOnce(new Error("audit substrate down"));

    try {
      const result = (await wrapped({
        data: {
          type: "document",
          id: "d1",
          clientReqId: reqId("0003"),
        },
        auth: adminAuth,
      } as never)) as { ok: boolean };

      expect(result.ok).toBe(true);
      // Hard-delete actually happened.
      expect(adminMockState._readDoc("softDeleted/document/items/d1")).toBeUndefined();
      expect(writeSpy).toHaveBeenCalledTimes(1);
    } finally {
      writeSpy.mockRestore();
    }
  });
});
