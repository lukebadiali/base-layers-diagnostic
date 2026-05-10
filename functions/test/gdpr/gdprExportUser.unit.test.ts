// Phase 8 Wave 3 (GDPR-01): unit tests for gdprExportUser callable.
// Pattern 11 offline mode — vi.mock stubs the Admin SDK with in-memory mocks
// from functions/test/_mocks/admin-sdk.ts.
//
// Single-load callable pattern (from 08-03 SUMMARY decision): callable loaded
// once at module level; adminMockState._reset() in beforeEach clears state;
// no vi.resetModules() per test. This ensures the storage/firestore mock
// instances used by the callable are the same instances read in the test
// assertions.
//
// 6 behaviors covered per 08-04-PLAN.md Task 2:
//   1. non-admin caller → permission-denied
//   2. unauthenticated → unauthenticated
//   3. invalid input (missing userId) → invalid-argument
//   4. happy path: admin + seeded data → { url, expiresAt } + storage object exists
//   5. writeAuditEvent called with compliance.export.user + actor from token
//   6. bundle queries all collection groups + users/{uid} + auditLog

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

// Single-load: import ONCE at module level so callable uses the same mock instances
const { gdprExportUser } = await import("../../src/gdpr/gdprExportUser.js");
const wrapped = t.wrap(gdprExportUser);

const { adminMockState } = await import("../_mocks/admin-sdk.js");

const VALID_REQ_ID_A = "550e8400-e29b-41d4-a716-446655440001";
const VALID_REQ_ID_B = "660e8400-e29b-41d4-a716-446655440002";
const VALID_REQ_ID_C = "770e8400-e29b-41d4-a716-446655440003";
const VALID_REQ_ID_D = "880e8400-e29b-41d4-a716-446655440004";
const VALID_REQ_ID_E = "990e8400-e29b-41d4-a716-446655440005";

const ADMIN_UID = "admin-uid-001";
const TARGET_UID = "u-target";

const adminAuthCtx = {
  uid: ADMIN_UID,
  token: {
    email: "admin@example.com",
    role: "admin" as const,
    orgId: null as string | null,
  },
};

// Reset all mock state before each test
beforeEach(() => {
  adminMockState._reset();
});

describe("gdprExportUser — unit tests", () => {
  // Test 1: non-admin caller → permission-denied
  it("throws permission-denied when caller does not have admin role", async () => {
    await expect(
      wrapped({
        data: { userId: TARGET_UID, clientReqId: VALID_REQ_ID_A },
        auth: {
          uid: "non-admin-uid",
          token: { role: "client", orgId: "org-1" },
        },
      } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  // Test 2: unauthenticated → unauthenticated
  it("throws unauthenticated when request has no auth", async () => {
    await expect(
      wrapped({
        data: { userId: TARGET_UID, clientReqId: VALID_REQ_ID_A },
      } as never),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  // Test 3: invalid input (missing userId) → invalid-argument
  it("throws invalid-argument when userId is missing", async () => {
    await expect(
      wrapped({
        data: { clientReqId: VALID_REQ_ID_A }, // userId missing
        auth: adminAuthCtx,
      } as never),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  // Test 4: happy path — returns { url, expiresAt }; storage object exists
  it("happy path: admin caller + seeded data → returns { url, expiresAt } with correct TTL and storage object", async () => {
    // Seed: profile doc + 2 comments + 1 message
    adminMockState._seedDoc(`users/${TARGET_UID}`, {
      displayName: "Target User",
      email: "target@example.com",
    });
    adminMockState._seedDoc(`orgs/o1/comments/c1`, {
      authorId: TARGET_UID,
      text: "Hello",
    });
    adminMockState._seedDoc(`orgs/o1/comments/c2`, {
      authorId: TARGET_UID,
      text: "World",
    });
    adminMockState._seedDoc(`orgs/o1/messages/m1`, {
      authorId: TARGET_UID,
      body: "A message",
    });

    const before = Date.now();
    const result = (await wrapped({
      data: { userId: TARGET_UID, clientReqId: VALID_REQ_ID_B },
      auth: adminAuthCtx,
    } as never)) as { url: string; expiresAt: number };
    const after = Date.now();

    // url is a string (signed URL from mock)
    expect(typeof result.url).toBe("string");
    expect(result.url).toMatch(/signed\.example/);

    // expiresAt is within 60s of now+86400000 (24h TTL)
    const expected24h = before + 24 * 60 * 60 * 1000;
    expect(result.expiresAt).toBeGreaterThanOrEqual(expected24h - 60000);
    expect(result.expiresAt).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000 + 60000);

    // Storage object exists at gdpr-exports/u-target/<ts>/export.json
    const objects = adminMockState._allStorageObjects();
    const exportKey = [...objects.keys()].find((k) =>
      k.startsWith(`bedeveloped-base-layers-backups/gdpr-exports/${TARGET_UID}/`) &&
      k.endsWith("/export.json"),
    );
    expect(exportKey).toBeDefined();

    // Bundle body is valid JSON with correct shape
    const obj = objects.get(exportKey!);
    expect(obj).toBeDefined();
    const bundle = JSON.parse(obj!.body as string);
    expect(bundle.bundleSchemaVersion).toBe(1);
    expect(bundle.userId).toBe(TARGET_UID);
    expect(bundle.profile).toMatchObject({ displayName: "Target User" });
    expect(bundle.comments).toHaveLength(2);
    expect(bundle.messages).toHaveLength(1);
  });

  // Test 5: writeAuditEvent called with compliance.export.user + actor from token (Pitfall 17)
  it("writes compliance.export.user audit event with actor sourced from request.auth.token", async () => {
    adminMockState._seedDoc(`users/${TARGET_UID}`, { displayName: "T" });

    await wrapped({
      data: { userId: TARGET_UID, clientReqId: VALID_REQ_ID_C },
      auth: adminAuthCtx,
    } as never);

    // Find the auditLog doc for this export event
    const docs = adminMockState._allDocs();
    const auditEntries = [...docs.entries()].filter(([path]) => path.startsWith("auditLog/"));
    expect(auditEntries.length).toBeGreaterThanOrEqual(1);

    const exportAuditEntry = auditEntries.find(([, data]) =>
      (data as Record<string, unknown>).type === "compliance.export.user",
    );
    expect(exportAuditEntry).toBeDefined();

    const auditDoc = exportAuditEntry![1] as Record<string, unknown>;
    // Actor sourced from request.auth.token (Pitfall 17), NOT from request.data
    const actor = auditDoc.actor as Record<string, unknown>;
    expect(actor.uid).toBe(ADMIN_UID); // admin's uid, not target uid
    expect(actor.role).toBe("admin");

    // Target is the data subject (not the actor)
    const target = auditDoc.target as Record<string, unknown>;
    expect(target.id).toBe(TARGET_UID);
    expect(target.type).toBe("user");
  });

  // Test 6: all expected collections queried (collectionGroup queries exercised)
  it("queries auditLog, users/{uid}, and 6 collection groups (comments, messages, actions, responses, documents, funnelComments)", async () => {
    // Seed one doc in each collection group to exercise the collectionGroup queries
    adminMockState._seedDoc(`users/${TARGET_UID}`, { displayName: "T" });
    adminMockState._seedDoc("auditLog/evt1", { actor: { uid: TARGET_UID }, type: "auth.signin.success" });
    adminMockState._seedDoc("orgs/o1/comments/c1", { authorId: TARGET_UID });
    adminMockState._seedDoc("orgs/o1/messages/m1", { authorId: TARGET_UID });
    adminMockState._seedDoc("orgs/o1/actions/a1", { ownerId: TARGET_UID });
    adminMockState._seedDoc("orgs/o1/responses/r1", { userId: TARGET_UID });
    adminMockState._seedDoc("orgs/o1/documents/d1", { uploaderId: TARGET_UID });
    adminMockState._seedDoc("funnelComments/f1", { authorId: TARGET_UID });

    const result = (await wrapped({
      data: { userId: TARGET_UID, clientReqId: VALID_REQ_ID_D },
      auth: adminAuthCtx,
    } as never)) as { url: string; expiresAt: number };

    // Verify the export succeeded
    expect(typeof result.url).toBe("string");

    // Verify the bundle includes data from all collection groups
    const objects = adminMockState._allStorageObjects();
    const exportKey = [...objects.keys()].find((k) =>
      k.startsWith(`bedeveloped-base-layers-backups/gdpr-exports/${TARGET_UID}/`),
    );
    expect(exportKey).toBeDefined();
    const bundle = JSON.parse(objects.get(exportKey!)!.body as string);

    expect(bundle.comments).toHaveLength(1);
    expect(bundle.messages).toHaveLength(1);
    expect(bundle.actions).toHaveLength(1);
    expect(bundle.responses).toHaveLength(1);
    expect(bundle.documents).toHaveLength(1);
    expect(bundle.funnelComments).toHaveLength(1);
    expect(bundle.auditEvents).toHaveLength(1);
  });

  // Bonus: idempotency — duplicate clientReqId → already-exists
  it("throws already-exists when same clientReqId is used within 5-min window", async () => {
    adminMockState._seedDoc(`users/${TARGET_UID}`, { displayName: "T" });

    // First call succeeds
    await wrapped({
      data: { userId: TARGET_UID, clientReqId: VALID_REQ_ID_E },
      auth: adminAuthCtx,
    } as never);

    // Second call with same clientReqId → already-exists
    await expect(
      wrapped({
        data: { userId: TARGET_UID, clientReqId: VALID_REQ_ID_E },
        auth: adminAuthCtx,
      } as never),
    ).rejects.toMatchObject({ code: "already-exists" });
  });
});
