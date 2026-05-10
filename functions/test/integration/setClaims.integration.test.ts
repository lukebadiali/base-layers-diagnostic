// Phase 7 Wave 6 (TEST-09 / 07-06): firebase-functions-test integration coverage
// for the setClaims callable (AUTH-07 / FN-03 / FN-04 / FN-07).
//
// Pins:
//   - happy path: admin caller, valid input → setCustomUserClaims invoked,
//     poke doc written, returns {ok:true}
//   - permission-denied: non-admin caller → HttpsError("permission-denied")
//   - invalid-input: uid missing → HttpsError("invalid-argument")
//   - idempotency-replay: same (caller:uid:clientReqId) twice → already-exists

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

vi.mock("firebase-admin/auth", async () => {
  const m = await import("../_mocks/admin-sdk.js");
  return {
    getAuth: () => m.getAuthMock(),
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
  const mod = await import("../../src/auth/setClaims.js");
  return t.wrap(mod.setClaims);
}

const adminCtx = {
  uid: "admin-uid",
  token: { role: "admin" as const },
};

describe("setClaims — integration (firebase-functions-test v3)", () => {
  it("happy path: admin caller sets claims + writes _pokes doc + returns {ok:true}", async () => {
    const wrapped = await loadWrapped();
    const result = (await wrapped({
      data: {
        uid: "target-user",
        role: "internal",
        orgId: null,
        clientReqId: VALID_REQ_ID_A,
      },
      auth: adminCtx,
    } as never)) as { ok: boolean };

    expect(result.ok).toBe(true);

    const m = await import("../_mocks/admin-sdk.js");
    // Custom claims set
    const claims = m.adminMockState._allClaims().get("target-user");
    expect(claims).toBeDefined();
    expect(claims!.role).toBe("internal");
    expect(claims!.orgId).toBeNull();

    // Poke doc landed under users/{uid}/_pokes/{ts}
    const pokes = Array.from(m.adminMockState._allDocs().entries()).filter(
      ([path]) => path.startsWith("users/target-user/_pokes/"),
    );
    expect(pokes.length).toBe(1);
    expect((pokes[0]![1] as { type: string }).type).toBe("claims-changed");
  });

  it("rejects non-admin caller with HttpsError('permission-denied')", async () => {
    const wrapped = await loadWrapped();
    await expect(
      wrapped({
        data: {
          uid: "victim",
          role: "admin",
          clientReqId: VALID_REQ_ID_A,
        },
        auth: { uid: "client-uid", token: { role: "client" } },
      } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("rejects invalid input (uid missing) with HttpsError('invalid-argument')", async () => {
    const wrapped = await loadWrapped();
    await expect(
      wrapped({
        data: {
          // uid omitted
          role: "client",
          clientReqId: VALID_REQ_ID_A,
        },
        auth: adminCtx,
      } as never),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("idempotency-replay: same (caller:target:clientReqId) within 5min → already-exists", async () => {
    const wrapped = await loadWrapped();
    const first = (await wrapped({
      data: {
        uid: "target-user-2",
        role: "client",
        clientReqId: VALID_REQ_ID_B,
      },
      auth: adminCtx,
    } as never)) as { ok: boolean };
    expect(first.ok).toBe(true);

    await expect(
      wrapped({
        data: {
          uid: "target-user-2",
          role: "client",
          clientReqId: VALID_REQ_ID_B,
        },
        auth: adminCtx,
      } as never),
    ).rejects.toMatchObject({ code: "already-exists" });
  });
});
