// tests/ui/format.test.js
// @ts-check
// Phase 4 Wave 2 (D-12): smoke test for src/ui/format.js — re-exports from
// src/util/ids.js. Behavioural coverage of these functions lives in
// tests/util/ids.test.js; this file confirms the re-export shape so views/*
// can import from ../ui/format.js per ARCHITECTURE.md §2 helpers table.
import { describe, it, expect } from "vitest";
import {
  formatWhen,
  iso,
  initials,
  firstNameFromAuthor,
} from "../../src/ui/format.js";

describe("src/ui/format.js re-export shape", () => {
  it("exports formatWhen as a function", () => {
    expect(typeof formatWhen).toBe("function");
  });

  it("exports iso as a function", () => {
    expect(typeof iso).toBe("function");
  });

  it("exports initials as a function", () => {
    expect(typeof initials).toBe("function");
  });

  it("exports firstNameFromAuthor as a function", () => {
    expect(typeof firstNameFromAuthor).toBe("function");
  });

  it("re-exported initials behaves identically to src/util/ids.js", () => {
    expect(initials("Luke Badiali")).toBe("LB");
  });

  it("re-exported iso returns the frozen test-time ISO string", () => {
    expect(iso()).toBe("2026-01-01T00:00:00.000Z");
  });
});
