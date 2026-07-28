// tests/domain/scoring.test.js
// @ts-check
// Phase 2 (TEST-02): coverage of src/domain/scoring.js. DATA + questionMeta are
// passed explicitly per the DI signature (Pattern D dependency injection).
// 2026-07 org-level re-shift: responses are one shared sheet per org per round
// (`responses[roundId][pillarId][idx]`) — the per-account dimension, and with
// it respondentsForRound / answeredCount / per-user scoping, was removed.
import { describe, it, expect } from "vitest";
import { pillarScoreForRound, pillarScore, isScoredInScale } from "../../src/domain/scoring.js";

// Minimal DATA fixture matching app.js's questionMeta shape.
const DATA = {
  pillars: [
    { id: 1, diagnostics: [{ scale: 10 }, { scale: 5 }] }, // pillar 1: 2 questions
    { id: 2, diagnostics: [{ scale: 10 }] }, // pillar 2: 1 question
  ],
};

// questionMeta mirrors app.js — extracts the diagnostic entry's scale.
// In production it does more (it/role/etc.); this minimal stub is sufficient
// because scoring only reads .scale.
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
      responses: { r1: { 1: { 0: { score: 5 } } } },
    };
    expect(pillarScoreForRound(org, "r1", 999, DATA, questionMeta)).toBeNull();
  });

  it("normalizes a single response against the question's scale", () => {
    // pillar 1 question 0 has scale 10. score=5 normalizes to (5/10)*100 = 50.
    const org = {
      currentRoundId: "r1",
      responses: { r1: { 1: { 0: { score: 5 } } } },
    };
    expect(pillarScoreForRound(org, "r1", 1, DATA, questionMeta)).toBe(50);
  });

  it("averages the pillar's answered questions and rounds the result", () => {
    // q0 score=5/10 -> 50; q1 score=5/5 -> 100. Mean = 75.
    const org = {
      currentRoundId: "r1",
      responses: { r1: { 1: { 0: { score: 5 }, 1: { score: 5 } } } },
    };
    expect(pillarScoreForRound(org, "r1", 1, DATA, questionMeta)).toBe(75);
  });

  it("reads only the requested round — rounds are fully independent", () => {
    const org = {
      currentRoundId: "r2",
      responses: {
        r1: { 1: { 0: { score: 10 } } },
        r2: { 1: { 0: { score: 5 } } },
      },
    };
    expect(pillarScoreForRound(org, "r1", 1, DATA, questionMeta)).toBe(100);
    expect(pillarScoreForRound(org, "r2", 1, DATA, questionMeta)).toBe(50);
    expect(pillarScoreForRound(org, "r3", 1, DATA, questionMeta)).toBeNull();
  });

  it("skips entries with non-finite scores", () => {
    const org = {
      currentRoundId: "r1",
      responses: { r1: { 1: { 0: { score: 5 }, 1: { score: NaN } } } },
    };
    // Only the finite score (5/10 = 50) counts; NaN at idx 1 (scale 5) is skipped.
    expect(pillarScoreForRound(org, "r1", 1, DATA, questionMeta)).toBe(50);
  });

  it("excludes a stale score that exceeds the question's current scale", () => {
    // pillar 1 question 1 has scale 5. A leftover score of 8 (captured when
    // that question was a 1..10 item) must NOT be averaged in — the UI already
    // hides it as unselected (renderQuestion clamps), so the number must too.
    const org = {
      currentRoundId: "r1",
      responses: { r1: { 1: { 0: { score: 5 }, 1: { score: 8 } } } },
    };
    // Only idx 0 counts: (5/10)*100 = 50. The out-of-range 8 at idx 1 (scale 5)
    // is skipped, so the average is 50 — NOT (50 + 160)/2 = 105.
    expect(pillarScoreForRound(org, "r1", 1, DATA, questionMeta)).toBe(50);
  });

  it("excludes a score below 1", () => {
    const org = {
      currentRoundId: "r1",
      responses: { r1: { 1: { 0: { score: 0 } } } },
    };
    expect(pillarScoreForRound(org, "r1", 1, DATA, questionMeta)).toBeNull();
  });

  it("skips entries when questionMeta returns null or no scale", () => {
    const badQuestionMeta = () => null;
    const org = {
      currentRoundId: "r1",
      responses: { r1: { 1: { 0: { score: 5 } } } },
    };
    expect(pillarScoreForRound(org, "r1", 1, DATA, badQuestionMeta)).toBeNull();
  });

  it("returns null when meta has no scale field (falsy meta.scale)", () => {
    const noScaleQuestionMeta = () => ({ scale: 0 });
    const org = {
      currentRoundId: "r1",
      responses: { r1: { 1: { 0: { score: 5 } } } },
    };
    expect(pillarScoreForRound(org, "r1", 1, DATA, noScaleQuestionMeta)).toBeNull();
  });

  it("handles missing responses key on org (defensive null-guard branch)", () => {
    const org = { currentRoundId: "r1" };
    expect(pillarScoreForRound(org, "r1", 1, DATA, questionMeta)).toBeNull();
  });

  it("handles a round present with no entry for the pillar (defensive `|| {}` branch)", () => {
    const org = {
      currentRoundId: "r1",
      responses: { r1: { 2: { 0: { score: 5 } } } },
    };
    expect(pillarScoreForRound(org, "r1", 1, DATA, questionMeta)).toBeNull();
  });
});

describe("isScoredInScale", () => {
  it("accepts an in-range score", () => {
    expect(isScoredInScale(3, 5)).toBe(true);
  });

  it("accepts the boundary scores 1 and scale", () => {
    expect(isScoredInScale(1, 5)).toBe(true);
    expect(isScoredInScale(5, 5)).toBe(true);
  });

  it("rejects a score above the scale (stale higher-scale answer)", () => {
    expect(isScoredInScale(8, 5)).toBe(false);
  });

  it("rejects a score below 1", () => {
    expect(isScoredInScale(0, 5)).toBe(false);
  });

  it("rejects non-finite scores", () => {
    expect(isScoredInScale(NaN, 5)).toBe(false);
    expect(isScoredInScale(undefined, 5)).toBe(false);
    expect(isScoredInScale(null, 5)).toBe(false);
  });
});

describe("pillarScore", () => {
  it("delegates to pillarScoreForRound with org.currentRoundId", () => {
    const org = {
      currentRoundId: "r1",
      responses: { r1: { 1: { 0: { score: 5 } } } },
    };
    expect(pillarScore(org, 1, DATA, questionMeta)).toBe(50);
  });

  it("returns the result for the org's current round, not other rounds", () => {
    // Only r2 has data, but currentRoundId is r1 -> null (no responses for r1).
    const org = {
      currentRoundId: "r1",
      responses: { r2: { 1: { 0: { score: 5 } } } },
    };
    expect(pillarScore(org, 1, DATA, questionMeta)).toBeNull();
  });
});
