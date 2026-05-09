// tests/views/pillar.test.js
// @ts-check
// Phase 4 Wave 4 (D-12 / D-20): smoke + DI-shape contract test for
// src/views/pillar.js Pattern D factory.
import { describe, it, expect } from "vitest";
import { renderPillar, createPillarView } from "../../src/views/pillar.js";

describe("src/views/pillar.js — Wave 4 Pattern D extraction", () => {
  it("exports renderPillar as a function", () => {
    expect(typeof renderPillar).toBe("function");
  });

  it("createPillarView returns an object with renderPillar bound to deps", () => {
    const fakeDeps = { state: {}, h: () => document.createElement("div") };
    const view = createPillarView(fakeDeps);
    expect(typeof view.renderPillar).toBe("function");
  });

  it("renderPillar(user, org, pillarId) returns HTMLElement", () => {
    const h = (/** @type {string} */ tag) => document.createElement(tag);
    const view = createPillarView({ state: {}, h });
    const el = view.renderPillar({ id: "u1" }, { id: "o1", pillars: [] }, 1);
    expect(el).toBeInstanceOf(HTMLElement);
  });
});
