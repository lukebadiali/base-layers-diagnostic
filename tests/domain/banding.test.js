// tests/domain/banding.test.js
// @ts-check
// Phase 2 (TEST-02): boundary-table coverage of src/domain/banding.js.
// Boundary seed taken verbatim from RESEARCH.md "Boundary table for TEST-02".
import { describe, it, expect } from "vitest";
import {
  pillarStatus,
  bandLabel,
  bandStatement,
  bandColor,
} from "../../src/domain/banding.js";

describe("pillarStatus", () => {
  it.each([
    [null, "gray"],
    [undefined, "gray"],
    [0, "red"],
    [49, "red"],
    [50, "red"], // boundary: <= 50 is red
    [51, "amber"],
    [74, "amber"],
    [75, "amber"], // boundary: <= 75 is amber
    [76, "green"],
    [100, "green"],
  ])("pillarStatus(%j) === %j", (score, expected) => {
    expect(pillarStatus(score)).toBe(expected);
  });
});

describe("bandLabel", () => {
  it.each([
    [null, "Not scored"],
    [undefined, "Not scored"],
    [0, "Low"],
    [50, "Low"], // boundary: <= 50 is Low
    [51, "Medium"],
    [75, "Medium"], // boundary: <= 75 is Medium
    [76, "High"],
    [100, "High"],
  ])("bandLabel(%j) === %j", (s, expected) => {
    expect(bandLabel(s)).toBe(expected);
  });
});

describe("bandColor", () => {
  it.each([
    [null, "var(--line-2)"],
    [undefined, "var(--line-2)"],
    [0, "var(--red)"],
    [50, "var(--red)"],
    [51, "var(--amber)"],
    [75, "var(--amber)"],
    [76, "var(--green)"],
    [100, "var(--green)"],
  ])("bandColor(%j) === %j", (s, expected) => {
    expect(bandColor(s)).toBe(expected);
  });
});

describe("bandStatement", () => {
  const PILLAR = "People";

  it("returns the not-yet-scored prose for null/undefined score", () => {
    expect(bandStatement(PILLAR, null)).toContain(`${PILLAR} has not yet been scored`);
    expect(bandStatement(PILLAR, undefined)).toContain(`${PILLAR} has not yet been scored`);
  });

  it("returns LOW prose for s <= 50 and includes the score and pillar name", () => {
    const out = bandStatement(PILLAR, 30);
    expect(out).toContain("LOW score");
    expect(out).toContain(`30/100 on ${PILLAR}`);
    // Lowercased pillar name appears in the rationale clause:
    // "...because people sits upstream..."
    expect(out).toContain(PILLAR.toLowerCase());
  });

  it("returns MEDIUM prose for 50 < s <= 75", () => {
    const out = bandStatement(PILLAR, 60);
    expect(out).toContain("MEDIUM score");
    expect(out).toContain(`60/100 on ${PILLAR}`);
  });

  it("returns HIGH prose for s > 75", () => {
    const out = bandStatement(PILLAR, 90);
    expect(out).toContain("HIGH score");
    expect(out).toContain(`90/100 on ${PILLAR}`);
    expect(out).toContain("competitive advantage");
  });
});
