// tests/views/diagnostic-extract.test.js
// @ts-check
// Phase 4 Wave 4 (D-12 / D-20): smoke + DI-shape contract test for the
// src/views/diagnostic.js Pattern D extraction. NOT a snapshot test — the
// existing tests/views/diagnostic.test.js (Phase 2 D-08) covers the rendered
// DOM via the boot-through-app.js path.
import { describe, it, expect } from "vitest";
import { renderDiagnostic, createDiagnosticView } from "../../src/views/diagnostic.js";

describe("src/views/diagnostic.js — Wave 4 Pattern D extraction", () => {
  it("exports renderDiagnostic as a function", () => {
    expect(typeof renderDiagnostic).toBe("function");
  });

  it("createDiagnosticView returns DI-bound view", () => {
    const view = createDiagnosticView({ state: {}, h: () => document.createElement("div") });
    expect(typeof view.renderDiagnostic).toBe("function");
    const el = view.renderDiagnostic({ id: "u1" }, { id: "o1" });
    expect(el).toBeInstanceOf(HTMLElement);
  });
});
