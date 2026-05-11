// Phase 7 Wave 1 (FN-03 / Pitfall 18): unit tests for withSentry wrapper.
// Mocks @sentry/node so init/captureException are observable spies; mocks
// firebase-functions/logger so handler.error logs are observable.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const initSpy = vi.fn();
const captureExceptionSpy = vi.fn();

vi.mock("@sentry/node", () => ({
  init: (...args: unknown[]) => initSpy(...args),
  captureException: (...args: unknown[]) => captureExceptionSpy(...args),
}));

const loggerErrorSpy = vi.fn();

vi.mock("firebase-functions/logger", () => ({
  logger: { error: (...args: unknown[]) => loggerErrorSpy(...args) },
}));

import { withSentry, _scrubEventForTest, _resetForTest } from "../../src/util/sentry.js";

beforeEach(() => {
  initSpy.mockReset();
  captureExceptionSpy.mockReset();
  loggerErrorSpy.mockReset();
  _resetForTest();
  delete process.env.SENTRY_DSN;
});

afterEach(() => {
  delete process.env.SENTRY_DSN;
});

describe("withSentry — happy path (Test 1)", () => {
  it("returns the handler's result unchanged on success", async () => {
    process.env.SENTRY_DSN = "https://example@sentry.io/1";
    const wrapped = withSentry(async () => "ok");
    await expect(wrapped({} as unknown)).resolves.toBe("ok");
    expect(captureExceptionSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });
});

describe("withSentry — capture + log on throw (Test 2)", () => {
  it("captures the exception, logs handler.error, then rethrows", async () => {
    process.env.SENTRY_DSN = "https://example@sentry.io/1";
    const boom = new Error("boom");
    const wrapped = withSentry(async () => {
      throw boom;
    });

    await expect(wrapped({} as unknown)).rejects.toBe(boom);
    expect(captureExceptionSpy).toHaveBeenCalledTimes(1);
    expect(captureExceptionSpy).toHaveBeenCalledWith(boom);
    expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
    expect(loggerErrorSpy).toHaveBeenCalledWith("handler.error", { name: "Error" });
  });
});

describe("withSentry — Sentry init lifecycle", () => {
  it("only initialises Sentry once across multiple invocations when DSN is set", async () => {
    process.env.SENTRY_DSN = "https://example@sentry.io/1";
    const wrapped = withSentry(async () => "ok");
    await wrapped({} as unknown);
    await wrapped({} as unknown);
    expect(initSpy).toHaveBeenCalledTimes(1);
  });

  it("skips Sentry.init entirely when SENTRY_DSN is empty (local-dev no-op)", async () => {
    delete process.env.SENTRY_DSN;
    const wrapped = withSentry(async () => "ok");
    await wrapped({} as unknown);
    expect(initSpy).not.toHaveBeenCalled();
  });
});

describe("beforeSend PII scrub (Test 3)", () => {
  it("strips authorization + cookie headers and replaces email/name/ip extras with <redacted>", () => {
    // Phase 9 (OBS-01) contract update: extras + contexts use the shared
    // PII_KEYS dictionary and the redaction contract is `"<redacted>"`
    // assignment (not `delete`) so SRE can still see the slot WAS populated.
    // Headers continue to be stripped via `delete`.
    const event: Record<string, unknown> = {
      request: {
        headers: {
          authorization: "Bearer abc",
          Authorization: "Bearer abc",
          cookie: "session=xyz",
          Cookie: "session=xyz",
          "user-agent": "test-ua",
        },
      },
      extra: {
        email: "leak@example.com",
        name: "Real Name",
        ip: "1.2.3.4",
        keepme: "ok",
      },
    };

    _scrubEventForTest(event);

    const headers = (event.request as { headers: Record<string, unknown> }).headers;
    expect(headers.authorization).toBeUndefined();
    expect(headers.Authorization).toBeUndefined();
    expect(headers.cookie).toBeUndefined();
    expect(headers.Cookie).toBeUndefined();
    expect(headers["user-agent"]).toBe("test-ua");

    const extra = event.extra as Record<string, unknown>;
    expect(extra.email).toBe("<redacted>");
    expect(extra.name).toBe("<redacted>");
    expect(extra.ip).toBe("<redacted>");
    expect(extra.keepme).toBe("ok");
  });

  it("Phase 9: scrubs PII keys inside event.contexts.<bag> via shared PII_KEYS dictionary", () => {
    const event: Record<string, unknown> = {
      contexts: {
        user: { name: "Alice", role: "admin" },
        device: { chatBody: "secret message", model: "test" },
      },
    };
    _scrubEventForTest(event);
    const ctx = event.contexts as Record<string, Record<string, unknown>>;
    expect(ctx.user.name).toBe("<redacted>");
    expect(ctx.user.role).toBe("admin");
    expect(ctx.device.chatBody).toBe("<redacted>");
    expect(ctx.device.model).toBe("test");
  });

  it("Phase 9: clips free-form request.body and request.data strings to <redacted-body>", () => {
    const event: Record<string, unknown> = {
      request: {
        body: "long chat message body",
        data: "some payload",
        method: "POST",
      },
    };
    _scrubEventForTest(event);
    const req = event.request as Record<string, unknown>;
    expect(req.body).toBe("<redacted-body>");
    expect(req.data).toBe("<redacted-body>");
    expect(req.method).toBe("POST");
  });

  it("is safe to call with no request.headers and no extra", () => {
    const event: Record<string, unknown> = {};
    expect(() => _scrubEventForTest(event)).not.toThrow();
  });
});
