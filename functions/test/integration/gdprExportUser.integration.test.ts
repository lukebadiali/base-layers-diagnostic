// Phase 8 Wave 3 (GDPR-01): integration tests for gdprExportUser via
// firebase-functions-test@3.5.0 t.wrap(). Mirrors auditWrite.integration.test.ts
// layout (Pattern 11 offline mode — in-memory Admin SDK mock, no emulator).
//
// Single-load callable pattern (from 08-03 SUMMARY decision): callable loaded
// once at module level; adminMockState._reset() in beforeEach clears state;
// no vi.resetModules() per test. This ensures the storage/firestore mock
// instances used by the callable are the same instances read in the test
// assertions.
//
// 3 integration tests:
//   1. admin caller → { url, expiresAt }; storage object created; auditLog row written
//   2. non-admin caller → permission-denied
//   3. duplicate clientReqId within 5-min window → already-exists

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import functionsTest from "firebase-functions-test";

// ── Module-level mocks (hoisted by vitest before any imports) ─────────────────

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

vi.mock("firebase-functions/params", () => ({
  defineSecret: (name: string) => ({ name, value: () => "" }),
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

// ── Test setup ────────────────────────────────────────────────────────────────

const t = functionsTest({ projectId: "bedeveloped-base-layers-test" });
afterAll(() => t.cleanup());

// Single-load: import ONCE at module level
const { gdprExportUser } = await import("../../src/gdpr/gdprExportUser.js");
const wrapped = t.wrap(gdprExportUser);

const { adminMockState } = await import("../_mocks/admin-sdk.js");

const ADMIN_UID = "admin-integration-uid";
const TARGET_UID = "u-integration-target";
const REQ_ID_1 = "aabbccdd-1111-4444-8888-000000000001";
const REQ_ID_2 = "aabbccdd-2222-4444-8888-000000000002";
const REQ_ID_DUPE = "aabbccdd-3333-4444-8888-000000000003";

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

describe("gdprExportUser — integration (firebase-functions-test v3)", () => {
  it("happy path: admin caller → returns {url, expiresAt}; storage object created; auditLog row written", async () => {
    // Seed profile + some data
    adminMockState._seedDoc(`users/${TARGET_UID}`, {
      displayName: "Integration User",
      email: "integration@test.com",
    });
    adminMockState._seedDoc(`orgs/o1/messages/m1`, {
      authorId: TARGET_UID,
      body: "Integration message",
    });
    adminMockState._seedDoc("auditLog/prev1", {
      actor: { uid: TARGET_UID },
      type: "auth.signin.success",
    });

    const before = Date.now();
    const result = (await wrapped({
      data: { userId: TARGET_UID, clientReqId: REQ_ID_1 },
      auth: adminAuth,
    } as never)) as { url: string; expiresAt: number };
    const after = Date.now();

    // Return shape
    expect(typeof result.url).toBe("string");
    expect(result.url).toContain("signed.example");
    expect(typeof result.expiresAt).toBe("number");

    // TTL within 24h ± 60s window
    const expected = before + 24 * 60 * 60 * 1000;
    expect(result.expiresAt).toBeGreaterThanOrEqual(expected - 60000);
    expect(result.expiresAt).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000 + 60000);

    // Storage object created at expected path pattern
    const objects = adminMockState._allStorageObjects();
    const exportKey = [...objects.keys()].find(
      (k) =>
        k.startsWith(`bedeveloped-base-layers-backups/gdpr-exports/${TARGET_UID}/`) &&
        k.endsWith("/export.json"),
    );
    expect(exportKey).toBeDefined();

    // Bundle shape
    const bundle = JSON.parse(objects.get(exportKey!)!.body as string);
    expect(bundle.bundleSchemaVersion).toBe(1);
    expect(bundle.userId).toBe(TARGET_UID);
    expect(bundle.messages).toHaveLength(1);
    expect(bundle.auditEvents).toHaveLength(1); // prev1 was actor=TARGET_UID

    // auditLog row for this export operation
    const docs = adminMockState._allDocs();
    const auditRows = [...docs.entries()].filter(
      ([path, data]) =>
        path.startsWith("auditLog/") &&
        (data as Record<string, unknown>).type === "compliance.export.user",
    );
    expect(auditRows).toHaveLength(1);
    const auditDoc = auditRows[0][1] as Record<string, unknown>;
    expect((auditDoc.actor as Record<string, unknown>).uid).toBe(ADMIN_UID);
    expect((auditDoc.target as Record<string, unknown>).id).toBe(TARGET_UID);
  });

  it("non-admin caller → throws permission-denied", async () => {
    await expect(
      wrapped({
        data: { userId: TARGET_UID, clientReqId: REQ_ID_2 },
        auth: {
          uid: "regular-user",
          token: { role: "client", orgId: "org-x" },
        },
      } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("duplicate clientReqId within 5-min window → throws already-exists", async () => {
    adminMockState._seedDoc(`users/${TARGET_UID}`, { displayName: "T" });

    // First call succeeds
    await wrapped({
      data: { userId: TARGET_UID, clientReqId: REQ_ID_DUPE },
      auth: adminAuth,
    } as never);

    // Second call with same clientReqId → idempotency window → already-exists
    await expect(
      wrapped({
        data: { userId: TARGET_UID, clientReqId: REQ_ID_DUPE },
        auth: adminAuth,
      } as never),
    ).rejects.toMatchObject({ code: "already-exists" });
  });
});
