// tests/domain/radar.test.js
// @ts-check
import { describe, it, expect } from "vitest";
import { roundRadarDatasets } from "../../src/domain/radar.js";

const pillars = [{ id: 1 }, { id: 2 }, { id: 3 }];

describe("roundRadarDatasets", () => {
  it("emits one dataset per round with per-pillar data (null -> 0)", () => {
    const rounds = [
      { id: "r1", label: "Round 1", createdAt: "2026-01-01" },
      { id: "r2", label: "Round 2", createdAt: "2026-02-01" },
    ];
    /** @type {Record<string, Record<number, number|null>>} */
    const scores = { r1: { 1: 40, 2: 60, 3: null }, r2: { 1: 70, 2: 80, 3: 90 } };
    const out = roundRadarDatasets(rounds, pillars, (rid, pid) => scores[rid][pid]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ roundId: "r1", label: "Round 1", data: [40, 60, 0] });
    expect(out[1].data).toEqual([70, 80, 90]);
  });

  it("omits rounds where the account has no data", () => {
    const rounds = [
      { id: "r1", label: "R1" },
      { id: "r2", label: "R2" },
    ];
    /** @type {Record<string, Record<number, number|null>>} */
    const scores = { r1: { 1: null, 2: null, 3: null }, r2: { 1: 50, 2: null, 3: null } };
    const out = roundRadarDatasets(rounds, pillars, (rid, pid) => scores[rid][pid]);
    expect(out.map((d) => d.roundId)).toEqual(["r2"]);
  });

  it("handles empty/undefined rounds", () => {
    expect(roundRadarDatasets(/** @type {any} */ (undefined), pillars, () => 1)).toEqual([]);
    expect(roundRadarDatasets([], pillars, () => 1)).toEqual([]);
  });
});
