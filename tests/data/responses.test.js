// tests/data/responses.test.js
// @ts-check
// Phase 4 Wave 3 (D-09 pass-through): responses.js preserves the IIFE's 4-deep
// nested-map shape org.responses[roundId][userId][pillarId][idx] verbatim
// (D-12 faithful extraction). Phase 5 (DATA-01) rewrites to subcollection
// access; the API surface stays stable.
import { describe, it, expect, vi } from "vitest";
import { makeFirestoreMock } from "../mocks/firebase.js";

vi.mock("../../src/firebase/db.js", () => makeFirestoreMock({
  seed: {
    "orgs/o1": {
      id: "o1",
      responses: { r1: { u1: { p1: [{ score: 7, note: "ok" }] } } },
    },
  },
}));

const { listResponses, saveResponse, deleteResponse } = await import("../../src/data/responses.js");

describe("data/responses.js (D-09 pass-through)", () => {
  it("listResponses returns the seeded response array", async () => {
    const rs = await listResponses("o1", "r1", "u1", "p1");
    expect(rs).toEqual([{ score: 7, note: "ok" }]);
  });

  it("listResponses returns [] for an empty path", async () => {
    const rs = await listResponses("o1", "r1", "u-missing", "p1");
    expect(rs).toEqual([]);
  });

  it("saveResponse writes into the nested-map slot", async () => {
    await saveResponse("o1", "r1", "u2", "p2", 0, { score: 4, note: "low" });
    const rs = await listResponses("o1", "r1", "u2", "p2");
    expect(rs[0]).toEqual({ score: 4, note: "low" });
  });

  it("deleteResponse drops the per-pillar entry under the user", async () => {
    await deleteResponse("o1", "r1", "u1", "p1");
    const rs = await listResponses("o1", "r1", "u1", "p1");
    expect(rs).toEqual([]);
  });
});
