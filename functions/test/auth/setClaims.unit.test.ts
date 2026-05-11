// Phase 7 Wave 1 (FN-03 / FN-04 / FN-07 / Pitfall 2): unit tests verifying
// the setClaims callable's hardened wiring shape — Zod input gate,
// ensureIdempotent call ordering, and poke-pattern write preservation.
//
// Pure-mocked: every Admin SDK module is stubbed via vi.mock so the test
// runs without the Firestore emulator. Wave 6 TEST-09 covers the full
// firebase-functions-test integration path.

import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const setCustomUserClaimsSpy = vi.fn();
const firestoreSetSpy = vi.fn();
const firestoreDocSpy = vi.fn(() => ({ set: firestoreSetSpy }));
const ensureIdempotentSpy = vi.fn();

vi.mock("firebase-admin/app", () => ({
  initializeApp: () => ({}),
  getApps: () => [{}],
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ setCustomUserClaims: setCustomUserClaimsSpy }),
}));

const SERVER_TS = { __serverTs: true };
vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({ doc: firestoreDocSpy }),
  FieldValue: { serverTimestamp: () => SERVER_TS },
}));

vi.mock("firebase-functions/v2/https", () => ({
  onCall: (
    _opts: unknown,
    handler: (req: unknown) => Promise<unknown>,
  ) => handler,
  HttpsError: class HttpsError extends Error {
    public code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("firebase-functions/params", () => ({
  defineSecret: (name: string) => ({ name, value: () => "" }),
}));

vi.mock("firebase-functions/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../../src/util/idempotency.js", () => ({
  ensureIdempotent: (
    key: string,
    scope: string,
    windowSec: number,
  ) => ensureIdempotentSpy(key, scope, windowSec),
}));

// withSentry passthrough so we test the inner handler shape directly.
vi.mock("../../src/util/sentry.js", () => ({
  withSentry: <TIn, TOut>(h: (req: TIn) => Promise<TOut>) => h,
}));

const VALID_REQ_ID = "550e8400-e29b-41d4-a716-446655440000";

beforeEach(() => {
  setCustomUserClaimsSpy.mockReset().mockResolvedValue(undefined);
  firestoreSetSpy.mockReset().mockResolvedValue(undefined);
  firestoreDocSpy.mockClear();
  ensureIdempotentSpy.mockReset().mockResolvedValue(undefined);
});

async function loadHandler(): Promise<(req: unknown) => Promise<unknown>> {
  vi.resetModules();
  const mod = await import("../../src/auth/setClaims.js");
  return mod.setClaims as unknown as (req: unknown) => Promise<unknown>;
}

const adminAuthCtx = {
  uid: "admin-uid",
  token: { role: "admin" },
};

describe("setClaims — input validation (Test 1)", () => {
  it("throws HttpsError(invalid-argument) when uid is missing (Zod replaces manual typeof gate)", async () => {
    const handler = await loadHandler();
    await expect(
      handler({
        auth: adminAuthCtx,
        data: { clientReqId: VALID_REQ_ID },
      }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(ensureIdempotentSpy).not.toHaveBeenCalled();
    expect(setCustomUserClaimsSpy).not.toHaveBeenCalled();
  });

  it("throws HttpsError(invalid-argument) when clientReqId is not a UUID", async () => {
    const handler = await loadHandler();
    await expect(
      handler({
        auth: adminAuthCtx,
        data: { uid: "target-uid", clientReqId: "not-a-uuid" },
      }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("throws HttpsError(permission-denied) when caller is not admin", async () => {
    const handler = await loadHandler();
    await expect(
      handler({
        auth: { uid: "u1", token: { role: "client" } },
        data: { uid: "target-uid", clientReqId: VALID_REQ_ID },
      }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });
});

describe("setClaims — poke-pattern preserved (Test 2 / Pitfall 2)", () => {
  it("writes users/{uid}/_pokes/{ts} with type=claims-changed after setCustomUserClaims", async () => {
    const handler = await loadHandler();
    const result = await handler({
      auth: adminAuthCtx,
      data: {
        uid: "target-uid",
        role: "internal",
        orgId: null,
        clientReqId: VALID_REQ_ID,
      },
    });

    expect(result).toEqual({ ok: true });
    expect(setCustomUserClaimsSpy).toHaveBeenCalledTimes(1);
    expect(setCustomUserClaimsSpy).toHaveBeenCalledWith("target-uid", {
      role: "internal",
      orgId: null,
    });

    // Phase 9 Wave 3: 2 doc() calls — (1) poke write, (2) writeAuditEvent
    // (audit emission of iam.claims.set bare flavour). Pin the poke is at
    // index 0 (preserved ordering: poke BEFORE audit emit per source code).
    expect(firestoreDocSpy).toHaveBeenCalledTimes(2);
    const pokePath = firestoreDocSpy.mock.calls[0][0] as string;
    expect(pokePath).toMatch(/^users\/target-uid\/_pokes\/\d+$/);
    const auditPath = firestoreDocSpy.mock.calls[1][0] as string;
    expect(auditPath).toMatch(/^auditLog\/[0-9a-f-]+$/);

    // Poke set is index 0; audit set is index 1. Pin the poke shape.
    expect(firestoreSetSpy).toHaveBeenCalledTimes(2);
    const pokeDoc = firestoreSetSpy.mock.calls[0][0];
    expect(pokeDoc).toEqual({ type: "claims-changed", at: SERVER_TS });
  });
});

describe("setClaims — idempotency before side effect (Test 3 / FN-03)", () => {
  it("invokes ensureIdempotent BEFORE getAuth().setCustomUserClaims with the canonical key shape", async () => {
    const order: string[] = [];
    ensureIdempotentSpy.mockImplementation(async () => {
      order.push("ensureIdempotent");
    });
    setCustomUserClaimsSpy.mockImplementation(async () => {
      order.push("setCustomUserClaims");
    });

    const handler = await loadHandler();
    await handler({
      auth: adminAuthCtx,
      data: {
        uid: "target-uid",
        role: "admin",
        orgId: "org-1",
        clientReqId: VALID_REQ_ID,
      },
    });

    expect(order).toEqual(["ensureIdempotent", "setCustomUserClaims"]);

    expect(ensureIdempotentSpy).toHaveBeenCalledTimes(1);
    const [key, scope, windowSec] = ensureIdempotentSpy.mock.calls[0];
    expect(key).toBe(`admin-uid:setClaims:target-uid:${VALID_REQ_ID}`);
    expect(scope).toBe("setClaims");
    expect(windowSec).toBe(5 * 60);
  });

  it("propagates already-exists from ensureIdempotent without writing claims", async () => {
    const dup = Object.assign(new Error("dup"), {
      code: "already-exists",
    });
    ensureIdempotentSpy.mockRejectedValueOnce(dup);

    const handler = await loadHandler();
    await expect(
      handler({
        auth: adminAuthCtx,
        data: {
          uid: "target-uid",
          role: "internal",
          clientReqId: VALID_REQ_ID,
        },
      }),
    ).rejects.toMatchObject({ code: "already-exists" });

    expect(setCustomUserClaimsSpy).not.toHaveBeenCalled();
    expect(firestoreSetSpy).not.toHaveBeenCalled();
  });
});
