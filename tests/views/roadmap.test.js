// tests/views/roadmap.test.js
// @ts-check
// Phase 4 Wave 4 (D-12 / D-20): smoke + DI-shape contract test.
import { describe, it, expect } from "vitest";
import { renderRoadmap, createRoadmapView } from "../../src/views/roadmap.js";

describe("src/views/roadmap.js — Wave 4 Pattern D extraction", () => {
  it("exports renderRoadmap as a function", () => {
    expect(typeof renderRoadmap).toBe("function");
  });

  it("createRoadmapView returns DI-bound view", () => {
    const view = createRoadmapView({ state: {}, h: () => document.createElement("div") });
    expect(typeof view.renderRoadmap).toBe("function");
    const el = view.renderRoadmap({ id: "u1" }, { id: "o1" });
    expect(el).toBeInstanceOf(HTMLElement);
  });
});
