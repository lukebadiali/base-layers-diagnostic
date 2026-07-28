// tests/domain/completion.test.js
// @ts-check
// Phase 2 (TEST-03): coverage of src/domain/completion.js (orgSummary). DATA + pillarScore
// passed explicitly per the DI signatures (D-05 byte-identical, plus Pattern D
// dependency injection). Tests use a minimal hand-built DATA fixture so that
// drift in data/pillars.js content doesn't break this test.
import { describe, it, expect } from "vitest";
import { orgSummary } from "../../src/domain/completion.js";

const DATA = {
  pillars: [
    { id: 1, diagnostics: [{ scale: 10 }, { scale: 5 }] }, // 2 questions
    { id: 2, diagnostics: [{ scale: 10 }] }, // 1 question
    { id: 3, diagnostics: [{ scale: 10 }] }, // 1 question — total 4
  ],
};

describe("orgSummary", () => {
  it("returns all-gray + null avg + 0 scoredCount when no pillar is scored", () => {
    const pillarScore = () => null;
    expect(orgSummary({}, DATA, pillarScore)).toEqual({
      avg: null,
      red: 0,
      amber: 0,
      green: 0,
      gray: DATA.pillars.length,
      scoredCount: 0,
    });
  });

  it("returns all-red + low avg when every pillar scores low", () => {
    const pillarScore = () => 30;
    expect(orgSummary({}, DATA, pillarScore)).toEqual({
      avg: 30,
      red: DATA.pillars.length,
      amber: 0,
      green: 0,
      gray: 0,
      scoredCount: DATA.pillars.length,
    });
  });

  it("returns all-green + high avg when every pillar scores high", () => {
    const pillarScore = () => 90;
    expect(orgSummary({}, DATA, pillarScore)).toEqual({
      avg: 90,
      red: 0,
      amber: 0,
      green: DATA.pillars.length,
      gray: 0,
      scoredCount: DATA.pillars.length,
    });
  });

  it("aggregates a mixed org with scored and unscored pillars", () => {
    /** @type {Record<number, number|null>} */
    const scores = { 1: 30, 2: 60, 3: null }; // red, amber, gray
    /**
     * @param {*} _org
     * @param {number} pillarId
     */
    const pillarScore = (_org, pillarId) => scores[pillarId];
    expect(orgSummary({}, DATA, pillarScore)).toEqual({
      avg: 45, // (30 + 60) / 2 = 45
      red: 1,
      amber: 1,
      green: 0,
      gray: 1,
      scoredCount: 2,
    });
  });

  it("transitions red→amber across the 50/51 boundary (pillarStatus integration)", () => {
    let mockedScore = 50;
    const pillarScore = () => mockedScore;
    expect(orgSummary({}, DATA, pillarScore).red).toBe(DATA.pillars.length);
    mockedScore = 51;
    expect(orgSummary({}, DATA, pillarScore).amber).toBe(DATA.pillars.length);
    expect(orgSummary({}, DATA, pillarScore).red).toBe(0);
  });

  it("transitions amber→green across the 75/76 boundary", () => {
    let mockedScore = 75;
    const pillarScore = () => mockedScore;
    expect(orgSummary({}, DATA, pillarScore).amber).toBe(DATA.pillars.length);
    mockedScore = 76;
    expect(orgSummary({}, DATA, pillarScore).green).toBe(DATA.pillars.length);
  });
});
