// tests/domain/scoring.test.js
// @ts-check
// Phase 2 (TEST-02): coverage of src/domain/scoring.js. DATA + questionMeta are
// passed explicitly per the DI signature (D-05 byte-identical, plus Pattern D
// dependency injection). Test uses a minimal hand-built DATA fixture so that
// drift in data/pillars.js content doesn't break this test (per RESEARCH.md
// "tests/domain/scoring.test.js" subsection).
import { describe, it, expect } from "vitest";
import {
  pillarScoreForRound,
  pillarScore,
  respondentsForRound,
  answeredCount,
} from "../../src/domain/scoring.js";

// Minimal DATA fixture matching app.js's questionMeta shape.
const DATA = {
  pillars: [
    { id: 1, diagnostics: [{ scale: 10 }, { scale: 5 }] }, // pillar 1: 2 questions
    { id: 2, diagnostics: [{ scale: 10 }] }, // pillar 2: 1 question
  ],
};

// questionMeta mirrors app.js:195-211 — extracts the diagnostic entry's scale.
// In production it does more (it/role/etc.); this minimal stub is sufficient
// because byte-identical scoring only reads .scale.
/** @param {*} entry */
const questionMeta = (entry) => entry || null;

describe("pillarScoreForRound", () => {
  it("returns null for an org with no responses", () => {
    const org = { currentRoundId: "r1", responses: {} };
    expect(pillarScoreForRound(org, "r1", 1, DATA, questionMeta)).toBeNull();
  });

  it("returns null for an unknown pillarId (find returns undefined)", () => {
    const org = {
      currentRoundId: "r1",
      responses: { r1: { u1: { 1: { 0: { score: 5 } } } } },
    };
    expect(pillarScoreForRound(org, "r1", 999, DATA, questionMeta)).toBeNull();
  });

  it("normalizes a single response against the question's scale", () => {
    // pillar 1 question 0 has scale 10. score=5 normalizes to (5/10)*100 = 50.
    const org = {
      currentRoundId: "r1",
      responses: { r1: { u1: { 1: { 0: { score: 5 } } } } },
    };
    expect(pillarScoreForRound(org, "r1", 1, DATA, questionMeta)).toBe(50);
  });

  it("averages multiple respondents and rounds the result", () => {
    // u1 score=5 -> 50; u2 score=10 -> 100. Mean = 75.
    const org = {
      currentRoundId: "r1",
      responses: {
        r1: {
          u1: { 1: { 0: { score: 5 } } },
          u2: { 1: { 0: { score: 10 } } },
        },
      },
    };
    expect(pillarScoreForRound(org, "r1", 1, DATA, questionMeta)).toBe(75);
  });

  it("skips entries with non-finite scores", () => {
    const org = {
      currentRoundId: "r1",
      responses: {
        r1: {
          u1: { 1: { 0: { score: 5 }, 1: { score: NaN } } },
        },
      },
    };
    // Only the finite score (5/10 = 50) counts; NaN at idx 1 (scale 5) is skipped.
    expect(pillarScoreForRound(org, "r1", 1, DATA, questionMeta)).toBe(50);
  });

  it("skips entries when questionMeta returns null or no scale", () => {
    const badQuestionMeta = () => null;
    const org = {
      currentRoundId: "r1",
      responses: { r1: { u1: { 1: { 0: { score: 5 } } } } },
    };
    expect(pillarScoreForRound(org, "r1", 1, DATA, badQuestionMeta)).toBeNull();
  });

  it("returns null when meta has no scale field (falsy meta.scale)", () => {
    const noScaleQuestionMeta = () => ({ scale: 0 });
    const org = {
      currentRoundId: "r1",
      responses: { r1: { u1: { 1: { 0: { score: 5 } } } } },
    };
    expect(pillarScoreForRound(org, "r1", 1, DATA, noScaleQuestionMeta)).toBeNull();
  });

  it("handles missing responses key on org (defensive null-guard branch)", () => {
    const org = { currentRoundId: "r1" };
    expect(pillarScoreForRound(org, "r1", 1, DATA, questionMeta)).toBeNull();
  });

  // Plan 02-06 (Wave 5) coverage back-fill: drive the `perPillar || {}` defensive
  // short-circuit on line 30 so the 100% src/domain/** threshold (D-15) holds.
  it("skips a user whose response object is falsy (defensive `perPillar || {}` branch)", () => {
    const org = {
      currentRoundId: "r1",
      responses: {
        r1: {
          u1: null, // falsy perPillar — drives the `|| {}` fallback on line 30
          u2: { 1: { 0: { score: 5 } } }, // counted as 50 → average just 50
        },
      },
    };
    expect(pillarScoreForRound(org, "r1", 1, DATA, questionMeta)).toBe(50);
  });
});

describe("pillarScore", () => {
  it("delegates to pillarScoreForRound with org.currentRoundId", () => {
    const org = {
      currentRoundId: "r1",
      responses: { r1: { u1: { 1: { 0: { score: 5 } } } } },
    };
    expect(pillarScore(org, 1, DATA, questionMeta)).toBe(50);
  });

  it("returns the result for the org's current round, not other rounds", () => {
    // Only r2 has data, but currentRoundId is r1 -> null (no responses for r1).
    const org = {
      currentRoundId: "r1",
      responses: { r2: { u1: { 1: { 0: { score: 5 } } } } },
    };
    expect(pillarScore(org, 1, DATA, questionMeta)).toBeNull();
  });
});

describe("respondentsForRound", () => {
  it("returns the user-id keys of the responses for the given round", () => {
    const org = { responses: { r1: { u1: {}, u2: {}, u3: {} } } };
    expect(respondentsForRound(org, "r1").sort()).toEqual(["u1", "u2", "u3"]);
  });

  it("returns [] when the round is missing", () => {
    expect(respondentsForRound({ responses: {} }, "r1")).toEqual([]);
  });

  it("returns [] when responses is undefined", () => {
    expect(respondentsForRound({}, "r1")).toEqual([]);
  });
});

describe("answeredCount", () => {
  it("returns {done: N, total: M} where total is pillars[i].diagnostics.length", () => {
    const org = {
      responses: {
        r1: { u1: { 1: { 0: { score: 5 } } } }, // 1 of 2 done in pillar 1
      },
    };
    expect(answeredCount(org, "r1", "u1", 1, DATA)).toEqual({ done: 1, total: 2 });
  });

  it("returns {done: 0, total: M} when the user has no responses for that pillar", () => {
    const org = { responses: { r1: { u1: {} } } };
    expect(answeredCount(org, "r1", "u1", 1, DATA)).toEqual({ done: 0, total: 2 });
  });

  it("ignores responses where score is not finite", () => {
    const org = {
      responses: { r1: { u1: { 1: { 0: { score: NaN }, 1: { score: 3 } } } } },
    };
    expect(answeredCount(org, "r1", "u1", 1, DATA)).toEqual({ done: 1, total: 2 });
  });

  it("handles missing responses tree (defensive null-guard branch)", () => {
    const org = {};
    expect(answeredCount(org, "r1", "u1", 1, DATA)).toEqual({ done: 0, total: 2 });
  });
});
