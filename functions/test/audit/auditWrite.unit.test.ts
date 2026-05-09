// Phase 7 Wave 2 (FN-01 / FN-03 / FN-04 / FN-07 / AUDIT-01 / AUDIT-04):
// wiring unit tests for the auditWrite callable. Mirrors the setClaims
// hardening test shape (Wave 1 setClaims.unit.test.ts) — pure-mocked, no
// emulator. Wave 6 TEST-09 covers the firebase-functions-test integration.
//
// Pins:
//   - Auth gate (unauthenticated request → HttpsError("unauthenticated"))
//   - Zod gate (malformed input → HttpsError("invalid-argument"))
//   - Idempotency gate (ensureIdempotent before writeAuditEvent;
//     already-exists propagates without writing)
//   - Identity provenance (actor.{uid,email,role,orgId} EXCLUSIVELY from
//     request.auth.token; never from request.data — Pitfall 17)
//   - Server-side context (eventId is a fresh UUID, ip + userAgent read from
//     request.rawRequest.headers, returned eventId matches written eventId)

import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const writeAuditEventSpy = vi.fn();
const ensureIdempotentSpy = vi.fn();

vi.mock("firebase-admin/app", () => ({
  initializeApp: () => ({}),
  getApps: () => [{}],
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

vi.mock("../../src/audit/auditLogger.js", () => ({
  writeAuditEvent: (
    input: unknown,
    ctx: unknown,
  ) => writeAuditEventSpy(input, ctx),
}));

const VALID_REQ_ID = "550e8400-e29b-41d4-a716-446655440000";

beforeEach(() => {
  ensureIdempotentSpy.mockReset().mockResolvedValue(undefined);
  writeAuditEventSpy.mockReset().mockResolvedValue(undefined);
});

async function loadHandler(): Promise<(req: unknown) => Promise<unknown>> {
  vi.resetModules();
  const mod = await import("../../src/audit/auditWrite.js");
  return mod.auditWrite as unknown as (req: unknown) => Promise<unknown>;
}

const authedCtx = {
  uid: "actor-uid",
  token: {
    role: "internal",
    orgId: null,
    email: "actor@example.com",
  },
};

const validInput = {
  type: "auth.signin.success",
  target: { type: "user", id: "target-uid" },
  clientReqId: VALID_REQ_ID,
};

// ─── Test 1: auth gate ───────────────────────────────────────────────────────

describe("auditWrite — auth gate (Test 1 / FN-07)", () => {
  it("throws HttpsError(unauthenticated) when request.auth is missing", async () => {
    const handler = await loadHandler();
    await expect(
      handler({ data: validInput }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
    expect(ensureIdempotentSpy).not.toHaveBeenCalled();
    expect(writeAuditEventSpy).not.toHaveBeenCalled();
  });

  it("throws HttpsError(unauthenticated) when request.auth.uid is missing", async () => {
    const handler = await loadHandler();
    await expect(
      handler({ auth: { token: {} }, data: validInput }),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });
});

// ─── Test 2: Zod gate ────────────────────────────────────────────────────────

describe("auditWrite — Zod input gate (Test 2 / FN-03 / AUDIT-02)", () => {
  it("throws HttpsError(invalid-argument) when target.id is missing", async () => {
    const handler = await loadHandler();
    await expect(
      handler({
        auth: authedCtx,
        data: {
          type: "auth.signin.success",
          target: { type: "user" },
          clientReqId: VALID_REQ_ID,
        },
      }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(ensureIdempotentSpy).not.toHaveBeenCalled();
    expect(writeAuditEventSpy).not.toHaveBeenCalled();
  });

  it("throws HttpsError(invalid-argument) when clientReqId is not a UUID", async () => {
    const handler = await loadHandler();
    await expect(
      handler({
        auth: authedCtx,
        data: { ...validInput, clientReqId: "not-a-uuid" },
      }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("throws HttpsError(invalid-argument) when type is not in the enum", async () => {
    const handler = await loadHandler();
    await expect(
      handler({
        auth: authedCtx,
        data: { ...validInput, type: "not.in.enum" },
      }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });
});

// ─── Test 3: idempotency before side effect ──────────────────────────────────

describe("auditWrite — idempotency before side effect (Test 3 / FN-03)", () => {
  it("invokes ensureIdempotent BEFORE writeAuditEvent with the canonical key shape", async () => {
    const order: string[] = [];
    ensureIdempotentSpy.mockImplementation(async () => {
      order.push("ensureIdempotent");
    });
    writeAuditEventSpy.mockImplementation(async () => {
      order.push("writeAuditEvent");
    });

    const handler = await loadHandler();
    await handler({ auth: authedCtx, data: validInput });

    expect(order).toEqual(["ensureIdempotent", "writeAuditEvent"]);
    expect(ensureIdempotentSpy).toHaveBeenCalledTimes(1);
    const [key, scope, windowSec] = ensureIdempotentSpy.mock.calls[0];
    expect(key).toBe(
      `actor-uid:auth.signin.success:target-uid:${VALID_REQ_ID}`,
    );
    expect(scope).toBe("auditWrite");
    expect(windowSec).toBe(5 * 60);
  });

  it("propagates already-exists from ensureIdempotent without writing the audit event", async () => {
    const dup = Object.assign(new Error("dup"), {
      code: "already-exists",
    });
    ensureIdempotentSpy.mockRejectedValueOnce(dup);

    const handler = await loadHandler();
    await expect(
      handler({ auth: authedCtx, data: validInput }),
    ).rejects.toMatchObject({ code: "already-exists" });

    expect(writeAuditEventSpy).not.toHaveBeenCalled();
  });
});

// ─── Test 4: identity provenance (Pitfall 17) ────────────────────────────────

describe("auditWrite — actor identity comes from request.auth.token only (Test 4 / Pitfall 17)", () => {
  it("populates actor from request.auth.token; ignores any actor field smuggled into request.data", async () => {
    const handler = await loadHandler();
    await handler({
      auth: {
        uid: "real-uid",
        token: {
          role: "admin",
          orgId: "real-org",
          email: "real@example.com",
        },
      },
      // Attempt to smuggle a fake actor in the payload — must be ignored.
      data: {
        ...validInput,
        // @ts-expect-error: payload must NOT contain actor — server overrides.
        actor: { uid: "fake-uid", role: "admin", orgId: "fake-org" },
      },
    });

    expect(writeAuditEventSpy).toHaveBeenCalledTimes(1);
    const [, ctx] = writeAuditEventSpy.mock.calls[0];
    expect(ctx.actor).toEqual({
      uid: "real-uid",
      email: "real@example.com",
      role: "admin",
      orgId: "real-org",
    });
  });

  it("falls back to nulls for missing optional token fields (email/role/orgId)", async () => {
    const handler = await loadHandler();
    await handler({
      auth: { uid: "minimal-uid", token: {} },
      data: validInput,
    });

    expect(writeAuditEventSpy).toHaveBeenCalledTimes(1);
    const [, ctx] = writeAuditEventSpy.mock.calls[0];
    expect(ctx.actor).toEqual({
      uid: "minimal-uid",
      email: null,
      role: null,
      orgId: null,
    });
  });
});

// ─── Test 5: server context — eventId, ip, userAgent ─────────────────────────

describe("auditWrite — server-derived context fields (Test 5)", () => {
  it("generates a fresh UUID eventId and returns it in the result", async () => {
    const handler = await loadHandler();
    const result = (await handler({
      auth: authedCtx,
      data: validInput,
    })) as { ok: boolean; eventId: string };

    expect(result.ok).toBe(true);
    expect(typeof result.eventId).toBe("string");
    // Loose UUID v4 shape: 8-4-4-4-12 hex.
    expect(result.eventId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    expect(writeAuditEventSpy).toHaveBeenCalledTimes(1);
    const [, ctx] = writeAuditEventSpy.mock.calls[0];
    expect(ctx.eventId).toBe(result.eventId);
  });

  it("reads ip from x-forwarded-for first hop and userAgent from the raw header", async () => {
    const handler = await loadHandler();
    await handler({
      auth: authedCtx,
      data: validInput,
      rawRequest: {
        headers: {
          "x-forwarded-for": "1.2.3.4, 5.6.7.8",
          "user-agent": "UA/Test",
        },
      },
    });

    expect(writeAuditEventSpy).toHaveBeenCalledTimes(1);
    const [, ctx] = writeAuditEventSpy.mock.calls[0];
    expect(ctx.ip).toBe("1.2.3.4");
    expect(ctx.userAgent).toBe("UA/Test");
  });

  it("falls back to null for ip and userAgent when headers are absent", async () => {
    const handler = await loadHandler();
    await handler({
      auth: authedCtx,
      data: validInput,
      rawRequest: { headers: {} },
    });

    expect(writeAuditEventSpy).toHaveBeenCalledTimes(1);
    const [, ctx] = writeAuditEventSpy.mock.calls[0];
    expect(ctx.ip).toBeNull();
    expect(ctx.userAgent).toBeNull();
  });
});
