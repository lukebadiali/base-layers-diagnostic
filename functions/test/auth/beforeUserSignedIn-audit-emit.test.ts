// Phase 9 Wave 3 (BLOCKER 1 / OBS-05): unit tests for the auth.signin.failure
// substrate added to functions/src/auth/beforeUserSignedIn.ts.
//
// SUBSTRATE-HONEST: the handler does NOT currently REJECT sign-ins. The
// catch branch added in Phase 9 fires only on internal handler errors
// (logger.info throw, malformed event.data, etc.). Wave 4 Rule 1 (auth-fail
// burst) trigger code is functional + dormant until a future plan adds an
// explicit rejection rule (e.g. block disabled accounts at sign-in).
//
// 2 tests: failure path emits audit + happy path does NOT emit.

import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const writeAuditEventSpy = vi.fn();
const loggerInfoSpy = vi.fn();
const loggerWarnSpy = vi.fn();

// Capture the handler passed into beforeUserSignedIn so we can invoke it
// directly with synthesised event objects.
let capturedHandler: ((event: unknown) => Promise<void>) | null = null;
vi.mock("firebase-functions/v2/identity", () => ({
  beforeUserSignedIn: (
    _opts: unknown,
    handler: (event: unknown) => Promise<void>,
  ) => {
    capturedHandler = handler;
    return handler;
  },
}));

vi.mock("firebase-functions/logger", () => ({
  logger: {
    info: loggerInfoSpy,
    warn: loggerWarnSpy,
    error: vi.fn(),
  },
}));

vi.mock("../../src/audit/auditLogger.js", () => ({
  writeAuditEvent: (
    input: unknown,
    ctx: unknown,
  ) => writeAuditEventSpy(input, ctx),
}));

beforeEach(() => {
  writeAuditEventSpy.mockReset().mockResolvedValue(undefined);
  loggerInfoSpy.mockReset();
  loggerWarnSpy.mockReset();
  capturedHandler = null;
});

async function loadHandler(): Promise<(event: unknown) => Promise<void>> {
  vi.resetModules();
  await import("../../src/auth/beforeUserSignedIn.js");
  if (!capturedHandler) {
    throw new Error("beforeUserSignedIn handler was not captured by the mock");
  }
  return capturedHandler;
}

// ─── Test 5: failure-branch substrate emits auth.signin.failure ──────────────

describe("beforeUserSignedIn — Phase 9 substrate (Test 5: failure branch)", () => {
  it("emits writeAuditEvent({type:'auth.signin.failure', ...}) on the catch branch + re-throws", async () => {
    // Force logger.info to throw — simulates an internal handler error.
    loggerInfoSpy.mockImplementationOnce(() => {
      throw new Error("ServerError");
    });

    const handler = await loadHandler();
    const event = {
      data: {
        uid: "u-attempt-1",
        email: "victim@example.com",
        providerData: [{ providerId: "password" }],
      },
      ipAddress: "203.0.113.7",
      userAgent: "Mozilla/5.0 test",
    };

    // Handler should re-throw the inner error.
    await expect(handler(event)).rejects.toThrow(/ServerError/);

    // Audit emit fired exactly once with the expected shape.
    expect(writeAuditEventSpy).toHaveBeenCalledTimes(1);
    const [input, ctx] = writeAuditEventSpy.mock.calls[0];

    expect(input).toMatchObject({
      type: "auth.signin.failure",
      target: { type: "user", id: "u-attempt-1", orgId: null },
      payload: { reason: "Error" },
    });
    // clientReqId is server-generated UUID (substrate path has no client req id).
    expect((input as { clientReqId: string }).clientReqId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    // actor.uid is null (unauthenticated context); email comes from event.data.
    expect((ctx as { actor: { uid: null; email: string; role: null; orgId: null } }).actor).toEqual({
      uid: null,
      email: "victim@example.com",
      role: null,
      orgId: null,
    });
    // ip + userAgent surfaced from event for forensics.
    const c = ctx as { ip: string; userAgent: string };
    expect(c.ip).toBe("203.0.113.7");
    expect(c.userAgent).toBe("Mozilla/5.0 test");
  });
});

// ─── Test 6: happy path does NOT emit ────────────────────────────────────────

describe("beforeUserSignedIn — Phase 9 substrate (Test 6: happy path)", () => {
  it("does NOT call writeAuditEvent when the handler completes without error", async () => {
    // logger.info succeeds (default mock impl is no-op).
    const handler = await loadHandler();
    const event = {
      data: {
        uid: "u-happy",
        email: "user@example.com",
        providerData: [{ providerId: "password" }],
        multiFactor: { enrolledFactors: [{ factorId: "totp" }] },
      },
      ipAddress: "203.0.113.7",
      userAgent: "Mozilla/5.0 test",
    };

    await expect(handler(event)).resolves.toBeUndefined();

    // Sign-in success is intentionally NOT a Phase 9 substrate goal — only
    // failure emits feed Wave 4 Rule 1. The client-side wrapper (Plan 03)
    // emits auth.signin.success.
    expect(writeAuditEventSpy).not.toHaveBeenCalled();
    // logger.info still ran for the structured Cloud Logging trail.
    expect(loggerInfoSpy).toHaveBeenCalledTimes(1);
  });
});
