// tests/views/engagement.test.js
// @ts-check
// Phase 4 Wave 4 (D-12 / D-20): smoke + DI-shape contract test.
import { describe, it, expect } from "vitest";
import { renderEngagement, createEngagementView } from "../../src/views/engagement.js";

describe("src/views/engagement.js — Wave 4 Pattern D extraction", () => {
  it("exports renderEngagement as a function", () => {
    expect(typeof renderEngagement).toBe("function");
  });

  it("createEngagementView returns DI-bound view", () => {
    const view = createEngagementView({ state: {}, h: () => document.createElement("div") });
    expect(typeof view.renderEngagement).toBe("function");
    const el = view.renderEngagement({ id: "u1" }, { id: "o1" });
    expect(el).toBeInstanceOf(HTMLElement);
  });
});
