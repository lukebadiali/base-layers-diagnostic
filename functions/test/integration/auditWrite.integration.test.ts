// Phase 7 Wave 6 (TEST-09 / 07-06): firebase-functions-test@3.5.0 integration
// coverage for the auditWrite callable.
//
// Pattern 11 (07-RESEARCH.md) — offline mode: vi.mock stubs the Admin SDK with
// a stateful in-memory Firestore (functions/test/_mocks/admin-sdk.ts) so the
// suite runs without the Firestore emulator. firebase-functions-test's
// `t.wrap()` exercises the REAL exported callable (not the inner handler
// directly — that's what the unit tests under test/audit/auditWrite.unit.test.ts
// cover). This pins:
//
//   - happy path: valid input + auth → returns {ok:true, eventId:<uuid>} +
//     auditLog/{eventId} doc landed
//   - rejects unauthenticated request
//   - rejects invalid input (missing target.id) with HttpsError("invalid-argument")
//   - rejects duplicate within idempotency window with HttpsError("already-exists")

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
}));

const t = functionsTest({ projectId: "bedeveloped-base-layers-test" });
afterAll(() => t.cleanup());

const VALID_REQ_ID_A = "550e8400-e29b-41d4-a716-446655440000";
const VALID_REQ_ID_B = "660e8400-e29b-41d4-a716-446655440000";

beforeEach(async () => {
  const m = await import("../_mocks/admin-sdk.js");
  m.adminMockState._reset();
});

async function loadWrapped() {
  vi.resetModules();
  const mod = await import("../../src/audit/auditWrite.js");
  return t.wrap(mod.auditWrite);
}

const validInput = {
  type: "auth.signin.success" as const,
  target: { type: "user", id: "u1" },
  clientReqId: VALID_REQ_ID_A,
};

const adminAuthCtx = {
  uid: "actor-uid",
  token: {
    email: "admin@example.com",
    role: "admin" as const,
    orgId: null as string | null,
  },
};

describe("auditWrite — integration (firebase-functions-test v3)", () => {
  it("happy path: writes auditLog/{eventId} and returns {ok:true, eventId:<uuid>}", async () => {
    const wrapped = await loadWrapped();
    const result = (await wrapped({
      data: validInput,
      auth: adminAuthCtx,
      rawRequest: {
        headers: {
          "x-forwarded-for": "203.0.113.42, 10.0.0.1",
          "user-agent": "Mozilla/5.0 (testbed)",
        },
      },
    } as never)) as { ok: boolean; eventId: string };

    expect(result.ok).toBe(true);
    expect(result.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    const m = await import("../_mocks/admin-sdk.js");
    const written = m.adminMockState._readDoc(`auditLog/${result.eventId}`);
    expect(written).toBeDefined();
    expect(written!.type).toBe("auth.signin.success");
    expect(written!.schemaVersion).toBe(1);
    expect((written!.actor as { uid: string }).uid).toBe("actor-uid");
    expect((written!.actor as { role: string }).role).toBe("admin");
    expect(written!.ip).toBe("203.0.113.42");
    expect(written!.userAgent).toBe("Mozilla/5.0 (testbed)");
  });

  it("rejects unauthenticated request with HttpsError('unauthenticated')", async () => {
    const wrapped = await loadWrapped();
    await expect(
      wrapped({
        data: validInput,
      } as never),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("rejects invalid input (missing target.id) with HttpsError('invalid-argument')", async () => {
    const wrapped = await loadWrapped();
    await expect(
      wrapped({
        data: {
          type: "auth.signin.success",
          target: { type: "user" /* id missing */ },
          clientReqId: VALID_REQ_ID_A,
        },
        auth: adminAuthCtx,
      } as never),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("rejects duplicate within 5-min idempotency window with HttpsError('already-exists')", async () => {
    const wrapped = await loadWrapped();
    const first = (await wrapped({
      data: { ...validInput, clientReqId: VALID_REQ_ID_B },
      auth: adminAuthCtx,
    } as never)) as { ok: boolean; eventId: string };
    expect(first.ok).toBe(true);

    // Second call with the SAME (actor:type:targetId:clientReqId) — idempotency
    // marker collides → already-exists. Same VALID_REQ_ID_B, same target,
    // same actor uid → same idempotency key.
    await expect(
      wrapped({
        data: { ...validInput, clientReqId: VALID_REQ_ID_B },
        auth: adminAuthCtx,
      } as never),
    ).rejects.toMatchObject({ code: "already-exists" });
  });
});
