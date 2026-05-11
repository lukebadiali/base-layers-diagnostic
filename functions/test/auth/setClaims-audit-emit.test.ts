// Phase 9 Wave 3 (BLOCKER 2 / AUDIT-05): unit tests for the iam.claims.set
// server-side bare audit emission added to functions/src/auth/setClaims.ts.
// Pure-mocked: every Admin SDK module is stubbed via vi.mock; writeAuditEvent
// is mocked too so we can assert the exact ServerContext shape passed in
// (Pitfall 17: actor sourced from request.auth.token, never from payload).
//
// Mirrors the structure of test/auth/setClaims.unit.test.ts (Phase 7 baseline).

import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const setCustomUserClaimsSpy = vi.fn();
const firestoreSetSpy = vi.fn();
const firestoreDocSpy = vi.fn(() => ({ set: firestoreSetSpy }));
const ensureIdempotentSpy = vi.fn();
const writeAuditEventSpy = vi.fn();
const loggerWarnSpy = vi.fn();

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
    warn: loggerWarnSpy,
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

// Mock writeAuditEvent — Phase 9 emission target.
vi.mock("../../src/audit/auditLogger.js", () => ({
  writeAuditEvent: (
    input: unknown,
    ctx: unknown,
  ) => writeAuditEventSpy(input, ctx),
}));

const VALID_REQ_ID = "550e8400-e29b-41d4-a716-446655440000";

beforeEach(() => {
  setCustomUserClaimsSpy.mockReset().mockResolvedValue(undefined);
  firestoreSetSpy.mockReset().mockResolvedValue(undefined);
  firestoreDocSpy.mockClear();
  ensureIdempotentSpy.mockReset().mockResolvedValue(undefined);
  writeAuditEventSpy.mockReset().mockResolvedValue(undefined);
  loggerWarnSpy.mockReset();
});

async function loadHandler(): Promise<(req: unknown) => Promise<unknown>> {
  vi.resetModules();
  const mod = await import("../../src/auth/setClaims.js");
  return mod.setClaims as unknown as (req: unknown) => Promise<unknown>;
}

const adminAuthCtx = {
  uid: "admin-uid",
  token: {
    role: "admin",
    email: "admin@example.com",
    orgId: "org-1",
  },
};

// ─── Test 1: success path → writeAuditEvent called with iam.claims.set + correct shape ───

describe("setClaims — Phase 9 audit emission (Test 1: success path shape)", () => {
  it("emits writeAuditEvent({type:'iam.claims.set', target, payload, ...}) once after claim mutation succeeds", async () => {
    const handler = await loadHandler();
    const result = await handler({
      auth: adminAuthCtx,
      data: {
        uid: "u1",
        role: "admin",
        orgId: "o1",
        clientReqId: VALID_REQ_ID,
      },
    });

    expect(result).toEqual({ ok: true });
    expect(writeAuditEventSpy).toHaveBeenCalledTimes(1);

    const [input, ctx] = writeAuditEventSpy.mock.calls[0];
    expect(input).toEqual({
      type: "iam.claims.set",
      target: { type: "user", id: "u1", orgId: "o1" },
      clientReqId: VALID_REQ_ID,
      payload: { newRole: "admin", newOrgId: "o1" },
    });

    // Pitfall 17: actor sourced from request.auth.token, NOT from request.data.
    expect((ctx as { actor: { uid: string; email: string; role: string; orgId: string } }).actor).toEqual({
      uid: "admin-uid",
      email: "admin@example.com",
      role: "admin",
      orgId: "org-1",
    });

    // ServerContext fields populated correctly.
    const c = ctx as { now: number; eventId: string; ip: null; userAgent: null };
    expect(typeof c.now).toBe("number");
    expect(typeof c.eventId).toBe("string");
    expect(c.eventId.length).toBeGreaterThan(0);
    expect(c.ip).toBeNull();
    expect(c.userAgent).toBeNull();
  });
});

// ─── Test 2: emit failure swallowed ──────────────────────────────────────────

describe("setClaims — Phase 9 audit emission (Test 2: best-effort swallow)", () => {
  it("returns {ok:true} even when writeAuditEvent throws — log+swallow per Pattern 5 #2", async () => {
    writeAuditEventSpy.mockRejectedValueOnce(new Error("audit substrate down"));

    const handler = await loadHandler();
    const result = await handler({
      auth: adminAuthCtx,
      data: {
        uid: "u1",
        role: "admin",
        orgId: "o1",
        clientReqId: VALID_REQ_ID,
      },
    });

    expect(result).toEqual({ ok: true });
    // The underlying claim mutation still happened.
    expect(setCustomUserClaimsSpy).toHaveBeenCalledTimes(1);
    // The poke write still happened.
    expect(firestoreSetSpy).toHaveBeenCalledTimes(1);
    // Logger.warn called with audit.emit.failed event.
    expect(loggerWarnSpy).toHaveBeenCalled();
    const warnCall = loggerWarnSpy.mock.calls.find(
      (c) => c[0] === "audit.emit.failed",
    );
    expect(warnCall).toBeDefined();
    expect(warnCall![1]).toMatchObject({
      type: "iam.claims.set",
      targetUid: "u1",
    });
  });
});

// ─── Test 3: auth-gate prevents emission ─────────────────────────────────────

describe("setClaims — Phase 9 audit emission (Test 3: auth gate)", () => {
  it("does NOT call writeAuditEvent when caller is not admin (permission-denied before emission)", async () => {
    const handler = await loadHandler();
    await expect(
      handler({
        auth: { uid: "u1", token: { role: "client" } },
        data: {
          uid: "u2",
          role: "admin",
          clientReqId: VALID_REQ_ID,
        },
      }),
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(writeAuditEventSpy).not.toHaveBeenCalled();
    expect(setCustomUserClaimsSpy).not.toHaveBeenCalled();
  });
});

// ─── Test 4: emit ordering — AFTER getCustomUserClaims AND AFTER poke write ──

describe("setClaims — Phase 9 audit emission (Test 4: emit ordering)", () => {
  it("invokes writeAuditEvent AFTER setCustomUserClaims AND AFTER the poke firestore write", async () => {
    const order: string[] = [];
    setCustomUserClaimsSpy.mockImplementation(async () => {
      order.push("setCustomUserClaims");
    });
    firestoreSetSpy.mockImplementation(async () => {
      order.push("firestoreSet");
    });
    writeAuditEventSpy.mockImplementation(async () => {
      order.push("writeAuditEvent");
    });

    const handler = await loadHandler();
    await handler({
      auth: adminAuthCtx,
      data: {
        uid: "u1",
        role: "admin",
        orgId: "o1",
        clientReqId: VALID_REQ_ID,
      },
    });

    // setCustomUserClaims fires first, then poke (firestoreSet), then audit emit.
    expect(order).toEqual([
      "setCustomUserClaims",
      "firestoreSet",
      "writeAuditEvent",
    ]);
  });
});
