// tests/data/responses.test.js
// @ts-check
// Phase 5 Wave 3 (DATA-01 / 05-03): subcollection rewrite.
// responses.js now reads/writes orgs/{orgId}/responses/{respId} directly via
// firebase/db.js (no more orgs.js delegation). Phase 4 D-09 / D-10 API
// surface preserved verbatim — same exports, same signatures.
import { describe, it, expect, vi } from "vitest";
import { makeFirestoreMock } from "../mocks/firebase.js";

vi.mock("../../src/firebase/db.js", () => makeFirestoreMock({
  seed: {
    "orgs/o1": { id: "o1", name: "Acme" },
    "orgs/o1/responses/r1__u1__p1": {
      roundId: "r1",
      userId: "u1",
      pillarId: "p1",
      values: [{ score: 7, note: "ok" }],
      legacyAppUserId: "u1",
    },
  },
}));

const { listResponses, saveResponse, deleteResponse } = await import("../../src/data/responses.js");

describe("data/responses.js (Phase 5 subcollection rewrite)", () => {
  it("listResponses returns the seeded subcollection doc values array", async () => {
    const rs = await listResponses("o1", "r1", "u1", "p1");
    expect(rs).toEqual([{ score: 7, note: "ok" }]);
  });

  it("listResponses returns [] when the (round,user,pillar) tuple has no doc", async () => {
    const rs = await listResponses("o1", "r1", "u-missing", "p1");
    expect(rs).toEqual([]);
  });

  it("saveResponse upserts at orgs/{orgId}/responses/{roundId__userId__pillarId} preserving values shape", async () => {
    await saveResponse("o1", "r1", "u2", "p2", 0, { score: 4, note: "low" });
    const rs = await listResponses("o1", "r1", "u2", "p2");
    expect(rs[0]).toEqual({ score: 4, note: "low" });
  });

  it("saveResponse accumulates values across idx writes (preserved API contract)", async () => {
    await saveResponse("o1", "r1", "u3", "p3", 0, { score: 5 });
    await saveResponse("o1", "r1", "u3", "p3", 1, { score: 6 });
    const rs = await listResponses("o1", "r1", "u3", "p3");
    expect(rs).toEqual([{ score: 5 }, { score: 6 }]);
  });

  it("deleteResponse drops the per-(round,user,pillar) subcollection doc", async () => {
    await deleteResponse("o1", "r1", "u1", "p1");
    const rs = await listResponses("o1", "r1", "u1", "p1");
    expect(rs).toEqual([]);
  });
});
