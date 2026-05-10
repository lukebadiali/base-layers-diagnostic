// tests/observability/sentry-init.test.js
// @ts-nocheck
// Phase 9 Wave 1 (OBS-01 / OBS-02 / OBS-03): tests for src/observability/sentry.js.
//
// Mocks @sentry/browser so init/setUser/captureException/addBreadcrumb/withScope
// are observable spies. _resetForTest() clears the inited flag and the
// fingerprint-rate-limit map between cases.
//
// @ts-nocheck applied because vi.mock(...) factory functions use rest-args
// passthrough patterns that fight strict checkJs. Same pattern used by
// tests/main.test.js. The runtime behaviour is exercised exhaustively via
// vitest assertions; type-discipline lives in the production module.

import { describe, it, expect, beforeEach, vi } from "vitest";

const initSpy = vi.fn();
const setUserSpy = vi.fn();
const captureExceptionSpy = vi.fn();
const addBreadcrumbSpy = vi.fn();
const withScopeSpy = vi.fn((cb) => cb({ setExtras: vi.fn() }));
const breadcrumbsIntegrationSpy = vi.fn(() => ({ name: "Breadcrumbs" }));
const globalHandlersIntegrationSpy = vi.fn(() => ({ name: "GlobalHandlers" }));
const linkedErrorsIntegrationSpy = vi.fn(() => ({ name: "LinkedErrors" }));

vi.mock("@sentry/browser", () => ({
  init: (...args) => initSpy(...args),
  setUser: (...args) => setUserSpy(...args),
  captureException: (...args) => captureExceptionSpy(...args),
  addBreadcrumb: (...args) => addBreadcrumbSpy(...args),
  withScope: (cb) => withScopeSpy(cb),
  breadcrumbsIntegration: (...args) => breadcrumbsIntegrationSpy(...args),
  globalHandlersIntegration: (...args) => globalHandlersIntegrationSpy(...args),
  linkedErrorsIntegration: (...args) => linkedErrorsIntegrationSpy(...args),
}));

import {
  initSentryBrowser,
  captureError,
  addBreadcrumb,
  setUser,
  _resetForTest,
  _fingerprintRateLimitForTest,
} from "../../src/observability/sentry.js";

beforeEach(() => {
  initSpy.mockReset();
  setUserSpy.mockReset();
  captureExceptionSpy.mockReset();
  addBreadcrumbSpy.mockReset();
  withScopeSpy.mockReset();
  withScopeSpy.mockImplementation((cb) => cb({ setExtras: vi.fn() }));
  _resetForTest();
});

describe("initSentryBrowser — empty DSN no-op (kill-switch)", () => {
  it("Test 1: empty DSN returns without calling Sentry.init", () => {
    initSentryBrowser("", "sha-abc");
    expect(initSpy).not.toHaveBeenCalled();
  });
});

describe("initSentryBrowser — idempotent on subsequent calls", () => {
  it("Test 2: calls Sentry.init exactly once even when called twice", () => {
    initSentryBrowser("https://x@o1.ingest.de.sentry.io/2", "sha");
    initSentryBrowser("https://x@o1.ingest.de.sentry.io/2", "sha");
    expect(initSpy).toHaveBeenCalledTimes(1);
  });

  it("Sentry.init receives sendDefaultPii: false + tracesSampleRate: 0", () => {
    initSentryBrowser("https://x@o1.ingest.de.sentry.io/2", "sha");
    expect(initSpy).toHaveBeenCalledTimes(1);
    const cfg = initSpy.mock.calls[0][0];
    expect(cfg.sendDefaultPii).toBe(false);
    expect(cfg.tracesSampleRate).toBe(0);
    expect(cfg.dsn).toBe("https://x@o1.ingest.de.sentry.io/2");
    expect(cfg.release).toBe("sha");
    expect(typeof cfg.beforeSend).toBe("function");
  });
});

describe("setUser — sends id + role only (never email/name)", () => {
  it("Test 3: setUser({ id, role }) calls Sentry.setUser with only id+role", () => {
    setUser({ id: "uid-1", role: "admin" });
    expect(setUserSpy).toHaveBeenCalledTimes(1);
    const arg = setUserSpy.mock.calls[0][0];
    expect(arg.id).toBe("uid-1");
    expect(arg.role).toBe("admin");
    expect(arg.email).toBeUndefined();
    expect(arg.name).toBeUndefined();
  });
});

describe("captureError — withScope + captureException", () => {
  it("Test 4: captureError(err, context) calls withScope and captureException", () => {
    const err = new Error("boom");
    captureError(err, { foo: "bar" });
    expect(withScopeSpy).toHaveBeenCalledTimes(1);
    expect(captureExceptionSpy).toHaveBeenCalledTimes(1);
    expect(captureExceptionSpy).toHaveBeenCalledWith(err);
  });

  it("captureError without context just captures (no withScope)", () => {
    const err = new Error("plain");
    captureError(err);
    expect(withScopeSpy).not.toHaveBeenCalled();
    expect(captureExceptionSpy).toHaveBeenCalledWith(err);
  });
});

describe("addBreadcrumb — passthrough", () => {
  it("Test 5: addBreadcrumb forwards crumb to Sentry.addBreadcrumb", () => {
    const crumb = { category: "ui", message: "click" };
    addBreadcrumb(crumb);
    expect(addBreadcrumbSpy).toHaveBeenCalledTimes(1);
    expect(addBreadcrumbSpy).toHaveBeenCalledWith(crumb);
  });
});

describe("fingerprint rate-limit — drops 11+ events per fingerprint per 60s", () => {
  it("Test 6: 11th event with the same fingerprint returns null", () => {
    const ev = { fingerprint: ["dup-fp"], message: "x" };
    // First 10 calls — pass through.
    for (let i = 0; i < 10; i++) {
      const out = _fingerprintRateLimitForTest({ fingerprint: ["dup-fp"], message: "x" });
      expect(out).not.toBeNull();
    }
    // 11th call — dropped.
    const dropped = _fingerprintRateLimitForTest({ ...ev });
    expect(dropped).toBeNull();
  });

  it("after 60s window elapses, count resets and events flow again", () => {
    const realNow = Date.now;
    let t = 1_000_000;
    Date.now = () => t;
    try {
      // Burn 11 calls inside the window — last one dropped.
      for (let i = 0; i < 10; i++) _fingerprintRateLimitForTest({ fingerprint: ["fp"] });
      expect(_fingerprintRateLimitForTest({ fingerprint: ["fp"] })).toBeNull();
      // Advance time past the 60s window.
      t += 60_001;
      // First call after window resets → not dropped.
      const out = _fingerprintRateLimitForTest({ fingerprint: ["fp"] });
      expect(out).not.toBeNull();
    } finally {
      Date.now = realNow;
    }
  });
});
