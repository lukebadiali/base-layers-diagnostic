// tests/domain/completion.test.js
// @ts-check
// Phase 2 (TEST-03): coverage of src/domain/completion.js. DATA + pillarScore
// passed explicitly per the DI signatures (D-05 byte-identical, plus Pattern D
// dependency injection). Tests use a minimal hand-built DATA fixture so that
// drift in data/pillars.js content doesn't break this test.
import { describe, it, expect } from "vitest";
import { userCompletionPct, orgSummary } from "../../src/domain/completion.js";

const DATA = {
  pillars: [
    { id: 1, diagnostics: [{ scale: 10 }, { scale: 5 }] }, // 2 questions
    { id: 2, diagnostics: [{ scale: 10 }] }, // 1 question
    { id: 3, diagnostics: [{ scale: 10 }] }, // 1 question — total 4
  ],
};

describe("userCompletionPct", () => {
  it("returns 0 for an empty org", () => {
    const org = { responses: {} };
    expect(userCompletionPct(org, "r1", "u1", DATA)).toBe(0);
  });

  it("returns 100 when every question has a finite score", () => {
    const org = {
      responses: {
        r1: {
          u1: {
            1: { 0: { score: 5 }, 1: { score: 3 } }, // 2 of 2
            2: { 0: { score: 7 } }, // 1 of 1
            3: { 0: { score: 8 } }, // 1 of 1 — total 4 of 4 = 100%
          },
        },
      },
    };
    expect(userCompletionPct(org, "r1", "u1", DATA)).toBe(100);
  });

  it("returns the rounded percentage for a partial answering", () => {
    const org = {
      responses: { r1: { u1: { 1: { 0: { score: 5 }, 1: { score: 3 } } } } }, // 2 of 4 = 50%
    };
    expect(userCompletionPct(org, "r1", "u1", DATA)).toBe(50);
  });

  it("ignores non-finite scores (NaN, undefined)", () => {
    const org = {
      responses: {
        r1: {
          u1: {
            1: { 0: { score: 5 }, 1: { score: NaN } },
            2: { 0: { score: undefined } },
          },
        },
      },
    };
    expect(userCompletionPct(org, "r1", "u1", DATA)).toBe(25); // 1 of 4
  });

  it("returns 0 when the round or user is missing entirely", () => {
    expect(userCompletionPct({ responses: {} }, "r1", "u1", DATA)).toBe(0);
    expect(userCompletionPct({ responses: { r1: {} } }, "r1", "u1", DATA)).toBe(0);
  });

  // Plan 02-06 (Wave 5) coverage back-fill: drive each defensive `|| {}` branch
  // on line 17 so the 100% src/domain/** threshold (D-15) holds.
  it("handles a missing responses key on the org (defensive `|| {}` branch)", () => {
    expect(userCompletionPct({}, "r1", "u1", DATA)).toBe(0);
  });
});

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
