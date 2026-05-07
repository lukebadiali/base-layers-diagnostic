// tests/views/actions.test.js
// @ts-check
// Phase 4 Wave 4 (D-12 / D-20): smoke + DI-shape contract test.
import { describe, it, expect } from "vitest";
import { renderActions, createActionsView } from "../../src/views/actions.js";

describe("src/views/actions.js — Wave 4 Pattern D extraction", () => {
  it("exports renderActions as a function", () => {
    expect(typeof renderActions).toBe("function");
  });

  it("createActionsView returns DI-bound view", () => {
    const view = createActionsView({ state: {}, h: () => document.createElement("div") });
    expect(typeof view.renderActions).toBe("function");
    const el = view.renderActions({ id: "u1" }, { id: "o1" });
    expect(el).toBeInstanceOf(HTMLElement);
  });
});
