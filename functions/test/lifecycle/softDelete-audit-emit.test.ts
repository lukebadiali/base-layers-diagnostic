// Phase 9 Wave 3 (BLOCKER 3 / AUDIT-05): unit tests for the
// data.<type>.softDelete server-side bare audit emission added to
// functions/src/lifecycle/softDelete.ts. Uses the stateful in-memory
// admin-sdk mock — the real writeAuditEvent helper writes into that mock,
// so we can read auditLog/{eventId} docs back from _allDocs() to verify
// the emission shape (Pitfall 17: actor sourced from request.auth.token).

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

const softDeleteMod = await import("../../src/lifecycle/softDelete.js");
const wrapped = t.wrap(softDeleteMod.softDelete);

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
  return `aa0e8400-e29b-41d4-a716-44665544${suffix}`;
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

describe("softDelete — Phase 9 audit emission", () => {
  // Test 1: success path emits data.<type>.softDelete with correct shape
  it("emits data.document.softDelete after batch.commit() with actor from token + payload {} + correct target", async () => {
    adminMockState._seedDoc("orgs/orgA/documents/d1", {
      title: "Test doc",
      uploaderId: "u1",
    });

    const result = (await wrapped({
      data: {
        type: "document",
        orgId: "orgA",
        id: "d1",
        clientReqId: reqId("0001"),
      },
      auth: adminAuth,
    } as never)) as { ok: boolean };

    expect(result.ok).toBe(true);

    const auditDoc = findAuditDoc("data.document.softDelete");
    expect(auditDoc).toBeDefined();
    expect(auditDoc!.target).toEqual({
      type: "document",
      id: "d1",
      orgId: "orgA",
    });
    // Pitfall 17: actor sourced from request.auth.token, NOT from payload.
    expect(auditDoc!.actor).toEqual({
      uid: "admin-uid",
      email: "admin@example.com",
      role: "admin",
      orgId: "orgA",
    });
    // Payload is empty (no business data leaked into audit row).
    expect(auditDoc!.payload).toEqual({});
  });

  // Test 2: emit failure swallowed — soft-delete still succeeds
  it("returns {ok:true} and live doc tombstone persists even when audit emit throws", async () => {
    adminMockState._seedDoc("orgs/orgA/messages/m1", {
      body: "hi",
      authorId: "u1",
    });

    // Spy + force throw on writeAuditEvent for this test only.
    const auditLogger = await import("../../src/audit/auditLogger.js");
    const writeSpy = vi
      .spyOn(auditLogger, "writeAuditEvent")
      .mockRejectedValueOnce(new Error("audit substrate down"));

    try {
      const result = (await wrapped({
        data: {
          type: "message",
          orgId: "orgA",
          id: "m1",
          clientReqId: reqId("0002"),
        },
        auth: adminAuth,
      } as never)) as { ok: boolean };

      expect(result.ok).toBe(true);
      // Live doc still tombstoned (batch committed before audit emit attempted).
      const live = adminMockState._readDoc("orgs/orgA/messages/m1");
      expect(live).toBeDefined();
      expect(live!.deletedAt).toBeDefined();
      expect(writeSpy).toHaveBeenCalledTimes(1);
    } finally {
      writeSpy.mockRestore();
    }
  });

  // Test 3: emit ordering — writeAuditEvent invoked AFTER batch.commit()
  it("invokes writeAuditEvent AFTER batch.commit() — audit row sees post-commit state", async () => {
    adminMockState._seedDoc("orgs/orgA/comments/c1", {
      body: "test",
      authorId: "u1",
    });

    const auditLogger = await import("../../src/audit/auditLogger.js");
    let liveDocAtEmitTime: Record<string, unknown> | undefined;
    const writeSpy = vi
      .spyOn(auditLogger, "writeAuditEvent")
      .mockImplementationOnce(async () => {
        // At the moment audit emit is called, the live doc should already
        // be tombstoned (batch.commit ran earlier).
        liveDocAtEmitTime = adminMockState._readDoc("orgs/orgA/comments/c1");
        return undefined as never;
      });

    try {
      const result = (await wrapped({
        data: {
          type: "comment",
          orgId: "orgA",
          id: "c1",
          clientReqId: reqId("0003"),
        },
        auth: adminAuth,
      } as never)) as { ok: boolean };

      expect(result.ok).toBe(true);
      expect(writeSpy).toHaveBeenCalledTimes(1);
      // Pin: at audit-emit time, live doc was already deletedAt-stamped.
      expect(liveDocAtEmitTime).toBeDefined();
      expect(liveDocAtEmitTime!.deletedAt).toBeDefined();
      expect(liveDocAtEmitTime!.deletedBy).toBe("admin-uid");
    } finally {
      writeSpy.mockRestore();
    }
  });
});
