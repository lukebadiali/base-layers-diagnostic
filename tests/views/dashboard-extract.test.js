// tests/views/dashboard-extract.test.js
// @ts-check
// Phase 4 Wave 4 (D-12 / D-20): smoke + DI-shape contract test for the
// src/views/dashboard.js Pattern D extraction. NOT a snapshot test — the
// existing tests/views/dashboard.test.js (Phase 2 D-08) covers the rendered
// DOM via the boot-through-app.js path.
import { describe, it, expect } from "vitest";
import { renderDashboard, createDashboardView } from "../../src/views/dashboard.js";

describe("src/views/dashboard.js — Wave 4 Pattern D extraction", () => {
  it("exports renderDashboard as a function", () => {
    expect(typeof renderDashboard).toBe("function");
  });

  it("createDashboardView returns DI-bound view", () => {
    const view = createDashboardView({ state: {}, h: () => document.createElement("div") });
    expect(typeof view.renderDashboard).toBe("function");
    const el = view.renderDashboard({ id: "u1", role: "internal" }, { id: "o1", name: "Acme" });
    expect(el).toBeInstanceOf(HTMLElement);
  });
});
