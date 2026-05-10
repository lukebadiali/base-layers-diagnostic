// Phase 8 Wave 4 (GDPR-02 / GDPR-03 / GDPR-04):
// integration test for gdprEraseUser via firebase-functions-test@3.5.0 t.wrap().
// Mirrors gdprExportUser.integration.test.ts layout (Pattern 11 offline mode).
//
// Single-load callable pattern: callable loaded once at module level;
// adminMockState._reset() in beforeEach; no vi.resetModules().
//
// 1 integration test (Test 9 from plan):
//   - full happy-path round-trip: verifies redactionList doc shape + audit event
//     row shape (counts payload includes storageObjectsDeleted/storageObjectsMissing)

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import functionsTest from "firebase-functions-test";

// ── Module-level mocks ─────────────────────────────────────────────────────────

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

vi.mock("firebase-admin/storage", async () => {
  const m = await import("../_mocks/admin-sdk.js");
  return {
    getStorage: () => m.getStorageMock(),
  };
});

vi.mock("firebase-admin/auth", async () => {
  const m = await import("../_mocks/admin-sdk.js");
  return {
    getAuth: () => m.getAuthMock(),
  };
});

vi.mock("firebase-functions/params", () => ({
  defineSecret: (name: string) => ({
    name,
    value: () => (name === "GDPR_PSEUDONYM_SECRET" ? "integration-secret-xyz" : ""),
  }),
}));

vi.mock("firebase-functions/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@sentry/node", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
}));

// ── Test setup ─────────────────────────────────────────────────────────────────

const t = functionsTest({ projectId: "bedeveloped-base-layers-test" });
afterAll(() => t.cleanup());

// Single-load
const { gdprEraseUser } = await import("../../src/gdpr/gdprEraseUser.js");
const wrapped = t.wrap(gdprEraseUser);

const { adminMockState } = await import("../_mocks/admin-sdk.js");

const ADMIN_UID = "admin-integration-001";
const TARGET_UID = "u-integration-target";
const REQ_ID_HAPPY = "12345678-aaaa-4444-8888-000000000001";

const adminAuth = {
  uid: ADMIN_UID,
  token: {
    email: "admin@integration.test",
    role: "admin" as const,
    orgId: null as string | null,
  },
};

beforeEach(() => {
  adminMockState._reset();
});

describe("gdprEraseUser — integration test (Test 9)", () => {
  it("full happy-path: redactionList doc shape + audit event counts payload", async () => {
    // Seed: profile + 1 message + 1 document subcollection + 1 audit event
    adminMockState._seedDoc(`users/${TARGET_UID}`, {
      email: "integration@example.com",
      name: "Integration User",
      displayName: "Integration User",
      photoURL: null,
      avatar: null,
    });
    adminMockState._seedDoc("orgs/intOrg/messages/intMsg1", {
      authorId: TARGET_UID,
      legacyAuthorId: TARGET_UID,
      body: "Integration message",
    });
    adminMockState._seedDoc("orgs/intOrg/documents/intDoc1", {
      uploaderId: TARGET_UID,
      uploadedBy: TARGET_UID,
      legacyAppUserId: TARGET_UID,
      filename: "report.pdf",
    });
    adminMockState._seedDoc("auditLog/intEv1", {
      actor: { uid: TARGET_UID, email: "integration@example.com", role: "client", orgId: "intOrg" },
      payload: { email: "integration@example.com", action: "signin" },
    });

    // Seed Storage object for the document
    adminMockState._seedStorageObject(
      "bedeveloped-base-layers-uploads",
      "orgs/intOrg/documents/intDoc1/report.pdf",
      Buffer.from("pdf-content"),
      "application/pdf",
    );

    const result = (await wrapped({
      data: { userId: TARGET_UID, clientReqId: REQ_ID_HAPPY },
      auth: adminAuth,
    } as never)) as {
      ok: boolean;
      tombstoneToken: string;
      counts: {
        messages: number;
        comments: number;
        actions: number;
        documentsSubcoll: number;
        documentsLegacy: number;
        funnelComments: number;
        auditEvents: number;
        storageObjectsDeleted: number;
        storageObjectsMissing: number;
        totalOps: number;
      };
    };

    // ── Basic result shape ─────────────────────────────────────────────────────

    expect(result.ok).toBe(true);
    expect(result.tombstoneToken).toMatch(/^deleted-user-[0-9a-f]{16}$/);

    // ── redactionList/{uid} shape ─────────────────────────────────────────────

    const redactionDoc = adminMockState._readDoc(`redactionList/${TARGET_UID}`);
    expect(redactionDoc).toBeDefined();
    expect(redactionDoc?.tombstoneToken).toBe(result.tombstoneToken);
    expect(redactionDoc?.erasedBy).toBe(ADMIN_UID);
    expect(redactionDoc?.schemaVersion).toBe(1);
    // erasedAt is the SERVER_TIMESTAMP sentinel (substituted at write time)
    expect(redactionDoc?.erasedAt).toEqual({ __isServerTs: true });

    // ── counts payload ────────────────────────────────────────────────────────

    expect(result.counts.messages).toBe(1);
    expect(result.counts.documentsSubcoll).toBe(1);
    expect(result.counts.auditEvents).toBe(1);
    expect(result.counts.storageObjectsDeleted).toBe(1);
    expect(result.counts.storageObjectsMissing).toBe(0);

    // ── compliance.erase.user audit event shape ───────────────────────────────

    const allDocs = adminMockState._allDocs();
    const complianceEventEntry = [...allDocs.entries()].find(
      ([path, data]) =>
        path.startsWith("auditLog/") &&
        path !== "auditLog/intEv1" &&
        (data as Record<string, unknown>).type === "compliance.erase.user",
    );
    expect(complianceEventEntry).toBeDefined();
    const [, evData] = complianceEventEntry!;
    expect(evData.severity).toBe("alert");
    const evPayload = evData.payload as Record<string, unknown>;
    expect(evPayload.tombstoneToken).toBe(result.tombstoneToken);
    const evCounts = evPayload.counts as Record<string, number>;
    expect(evCounts.storageObjectsDeleted).toBeDefined();
    expect(evCounts.storageObjectsMissing).toBeDefined();
    expect(evCounts.totalOps).toBeGreaterThan(0);

    // ── Storage object deleted ────────────────────────────────────────────────

    expect(adminMockState._allStorageObjects().size).toBe(0);

    // ── Auth user disabled ────────────────────────────────────────────────────

    const authCalls = adminMockState._allUpdateUserCalls();
    expect(authCalls).toHaveLength(1);
    expect(authCalls[0]).toMatchObject({ uid: TARGET_UID, properties: { disabled: true } });
  });
});
