// Phase 9 Wave 3 (BLOCKER 3 / AUDIT-05): unit tests for the
// data.<type>.restore server-side bare audit emission added to
// functions/src/lifecycle/restoreSoftDeleted.ts.

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
  return `bb0e8400-e29b-41d4-a716-44665544${suffix}`;
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

function seedTombstonePair(type: string, orgId: string, id: string) {
  const livePath =
    type === "funnelComment"
      ? `funnelComments/${id}`
      : `orgs/${orgId}/${type}s/${id}`;
  adminMockState._seedDoc(livePath, {
    body: "seed",
    deletedAt: new Date(),
    deletedBy: "admin-uid",
  });
  adminMockState._seedDoc(`softDeleted/${type}/items/${id}`, {
    body: "seed",
    deletedAt: new Date(),
    deletedBy: "admin-uid",
    originalPath: livePath,
    originalType: type,
    originalOrgId: orgId,
  });
}

describe("restoreSoftDeleted — Phase 9 audit emission", () => {
  // Test 4: emits data.<type>.restore with correct shape
  it("emits data.action.restore after batch.commit() with actor from token + payload {} + correct target", async () => {
    seedTombstonePair("action", "orgA", "a1");

    const result = (await wrapped({
      data: {
        type: "action",
        orgId: "orgA",
        id: "a1",
        clientReqId: reqId("0001"),
      },
      auth: adminAuth,
    } as never)) as { ok: boolean };

    expect(result.ok).toBe(true);

    const auditDoc = findAuditDoc("data.action.restore");
    expect(auditDoc).toBeDefined();
    expect(auditDoc!.target).toEqual({
      type: "action",
      id: "a1",
      orgId: "orgA",
    });
    expect(auditDoc!.actor).toEqual({
      uid: "admin-uid",
      email: "admin@example.com",
      role: "admin",
      orgId: "orgA",
    });
    expect(auditDoc!.payload).toEqual({});
  });

  // Best-effort swallow: emit failure doesn't block the restore.
  it("returns {ok:true} and live doc restoredAt persists even when audit emit throws", async () => {
    seedTombstonePair("comment", "orgA", "c1");

    const auditLogger = await import("../../src/audit/auditLogger.js");
    const writeSpy = vi
      .spyOn(auditLogger, "writeAuditEvent")
      .mockRejectedValueOnce(new Error("audit substrate down"));

    try {
      const result = (await wrapped({
        data: {
          type: "comment",
          orgId: "orgA",
          id: "c1",
          clientReqId: reqId("0002"),
        },
        auth: adminAuth,
      } as never)) as { ok: boolean };

      expect(result.ok).toBe(true);
      const live = adminMockState._readDoc("orgs/orgA/comments/c1");
      expect(live).toBeDefined();
      expect(live!.deletedAt).toBeNull();
      expect(live!.restoredBy).toBe("admin-uid");
      // Snapshot was deleted (batch.delete)
      expect(adminMockState._readDoc("softDeleted/comment/items/c1")).toBeUndefined();
      expect(writeSpy).toHaveBeenCalledTimes(1);
    } finally {
      writeSpy.mockRestore();
    }
  });

  // Ordering: writeAuditEvent invoked AFTER batch.commit() (snapshot already gone).
  it("invokes writeAuditEvent AFTER batch.commit() — audit row sees post-commit state", async () => {
    seedTombstonePair("funnelComment", "orgA", "f1");

    const auditLogger = await import("../../src/audit/auditLogger.js");
    let snapAtEmitTime: Record<string, unknown> | undefined;
    let liveAtEmitTime: Record<string, unknown> | undefined;
    const writeSpy = vi
      .spyOn(auditLogger, "writeAuditEvent")
      .mockImplementationOnce(async () => {
        snapAtEmitTime = adminMockState._readDoc("softDeleted/funnelComment/items/f1");
        liveAtEmitTime = adminMockState._readDoc("funnelComments/f1");
        return undefined as never;
      });

    try {
      const result = (await wrapped({
        data: {
          type: "funnelComment",
          orgId: "orgA",
          id: "f1",
          clientReqId: reqId("0003"),
        },
        auth: adminAuth,
      } as never)) as { ok: boolean };

      expect(result.ok).toBe(true);
      expect(writeSpy).toHaveBeenCalledTimes(1);
      // Snap was already removed by batch.commit().
      expect(snapAtEmitTime).toBeUndefined();
      // Live was already restoredAt-stamped.
      expect(liveAtEmitTime).toBeDefined();
      expect(liveAtEmitTime!.restoredBy).toBe("admin-uid");
    } finally {
      writeSpy.mockRestore();
    }
  });
});
