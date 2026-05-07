// tests/views/auth.test.js
// @ts-check
// Phase 4 Wave 4 (D-12 / D-20): smoke + DI-shape contract test for the
// src/views/auth.js Pattern D factory. The view's actual rendered DOM is
// covered by the Phase 2 D-08 snapshot baselines (which boot through app.js)
// — this test verifies the export contract and the DI factory shape so
// Wave 5's state.js + router.js + main.js cutover has a stable seam.
import { describe, it, expect } from "vitest";
import { renderAuth, createAuthView } from "../../src/views/auth.js";

describe("src/views/auth.js — Wave 4 Pattern D extraction", () => {
  it("exports renderAuth as a function", () => {
    expect(typeof renderAuth).toBe("function");
  });

  it("exports createAuthView as a DI factory", () => {
    expect(typeof createAuthView).toBe("function");
  });

  it("createAuthView returns an object with renderAuth bound to deps", () => {
    const fakeDeps = { state: {}, h: () => document.createElement("div") };
    const view = createAuthView(fakeDeps);
    expect(view).toBeTruthy();
    expect(typeof view.renderAuth).toBe("function");
  });

  it("renderAuth is callable as the deps-bound factory variant returning HTMLElement", () => {
    const h = (/** @type {string} */ tag) => document.createElement(tag);
    const view = createAuthView({ state: {}, h });
    const el = view.renderAuth();
    expect(el).toBeInstanceOf(HTMLElement);
  });
});
