// tests/views/funnel.test.js
// @ts-check
// Phase 4 Wave 4 (D-12 / D-20): smoke + DI-shape contract test +
// CODE-08 (renderConversation seam for funnel comments).
import { describe, it, expect } from "vitest";
import { renderFunnel, createFunnelView } from "../../src/views/funnel.js";

describe("src/views/funnel.js — Wave 4 Pattern D extraction", () => {
  it("exports renderFunnel as a function", () => {
    expect(typeof renderFunnel).toBe("function");
  });

  it("createFunnelView returns DI-bound view", () => {
    const view = createFunnelView({ state: {}, h: () => document.createElement("div") });
    expect(typeof view.renderFunnel).toBe("function");
    const el = view.renderFunnel({ id: "u1" }, { id: "o1" });
    expect(el).toBeInstanceOf(HTMLElement);
  });
});
