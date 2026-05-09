// tests/observability/sentry.test.js
// @ts-check
// Phase 4 Wave 3 (D-11) smoke test. Phase 9 (OBS-01) fills the body with
// @sentry/browser init + captureException + addBreadcrumb.
import { describe, it, expect } from "vitest";
import { captureError, addBreadcrumb } from "../../src/observability/sentry.js";

describe("observability/sentry.js (Phase 4 D-11 stub)", () => {
  it("captureError is a function", () => {
    expect(typeof captureError).toBe("function");
  });

  it("addBreadcrumb is a function", () => {
    expect(typeof addBreadcrumb).toBe("function");
  });

  it("captureError does not throw (no-op)", () => {
    expect(() => captureError(new Error("test"), { tag: "x" })).not.toThrow();
  });

  it("addBreadcrumb does not throw (no-op)", () => {
    expect(() => addBreadcrumb({ category: "ui", message: "click" })).not.toThrow();
  });
});
