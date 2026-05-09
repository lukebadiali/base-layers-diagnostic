// tests/views/admin.test.js
// @ts-check
// Phase 4 Wave 4 (D-12 / D-20): smoke + DI-shape contract test.
import { describe, it, expect } from "vitest";
import { renderAdmin, createAdminView } from "../../src/views/admin.js";

describe("src/views/admin.js — Wave 4 Pattern D extraction", () => {
  it("exports renderAdmin as a function", () => {
    expect(typeof renderAdmin).toBe("function");
  });

  it("createAdminView returns DI-bound view", () => {
    const view = createAdminView({ state: {}, h: () => document.createElement("div") });
    expect(typeof view.renderAdmin).toBe("function");
    const el = view.renderAdmin({ id: "u1", role: "internal" });
    expect(el).toBeInstanceOf(HTMLElement);
  });
});
