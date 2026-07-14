// tests/domain/diagnostic-select.test.js
// @ts-check
// UX polish (2026-07): re-clicking the already-selected Likert figure clears it
// (deselect → unanswered) instead of re-writing the same score. Pure toggle
// semantics live in src/domain/diagnostic-select.js so they are unit-testable
// without booting main.js (the diagnostic DOM path is snapshot-only + flaky).
import { describe, it, expect } from "vitest";
import { toggleScorePatch } from "../../src/domain/diagnostic-select.js";

describe("toggleScorePatch", () => {
  it("selects a figure when nothing is selected yet", () => {
    expect(toggleScorePatch(null, 4)).toEqual({ score: 4 });
  });

  it("switches selection when a different figure is clicked", () => {
    expect(toggleScorePatch(2, 5)).toEqual({ score: 5 });
  });

  it("clears the selection when the already-selected figure is re-clicked", () => {
    expect(toggleScorePatch(3, 3)).toEqual({ score: null });
  });

  it("clears at the scale extremes too (1 and 10)", () => {
    expect(toggleScorePatch(1, 1)).toEqual({ score: null });
    expect(toggleScorePatch(10, 10)).toEqual({ score: null });
  });

  it("cleared score is not a finite number (reverts to unanswered)", () => {
    // The whole app counts 'answered' via Number.isFinite(r.score)
    // (src/domain/scoring.js, main.js answerSummaryForPillar). A cleared
    // figure must therefore fail that predicate.
    expect(Number.isFinite(toggleScorePatch(3, 3).score)).toBe(false);
    expect(Number.isFinite(toggleScorePatch(null, 3).score)).toBe(true);
  });
});
