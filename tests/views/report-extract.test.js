// tests/views/report-extract.test.js
// @ts-check
// Phase 4 Wave 4 (D-12 / D-20): smoke + DI-shape contract test for the
// src/views/report.js Pattern D extraction. NOT a snapshot test — the
// existing tests/views/report.test.js (Phase 2 D-08) covers the rendered DOM
// via the boot-through-app.js path.
import { describe, it, expect } from "vitest";
import { renderReport, createReportView } from "../../src/views/report.js";

describe("src/views/report.js — Wave 4 Pattern D extraction", () => {
  it("exports renderReport as a function", () => {
    expect(typeof renderReport).toBe("function");
  });

  it("createReportView returns DI-bound view", () => {
    const view = createReportView({ state: {}, h: () => document.createElement("div") });
    expect(typeof view.renderReport).toBe("function");
    const el = view.renderReport({ id: "u1" }, { id: "o1" });
    expect(el).toBeInstanceOf(HTMLElement);
  });
});
