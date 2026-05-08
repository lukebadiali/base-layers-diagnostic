// tests/data/read-states.test.js
// @ts-check
// Phase 5 Wave 3 (D-12 / DATA-07 / 05-03): NEW wrapper for
// orgs/{orgId}/readStates/{userId}. All writes use serverTimestamp() so
// Wave 4's H7 fix (domain/unread.js rewrite) can compare server-time
// values exclusively.
import { describe, it, expect, vi } from "vitest";
import { makeFirestoreMock } from "../mocks/firebase.js";

vi.mock("../../src/firebase/db.js", () => makeFirestoreMock({
  seed: {
    "orgs/o1/readStates/u_self": {
      pillarReads: { p1: { __serverTimestamp: true } },
      chatLastRead: null,
      legacyAppUserId: "u_self",
    },
  },
}));

const { getReadState, setPillarRead, setChatRead, subscribeReadState } =
  await import("../../src/data/read-states.js");

describe("data/read-states.js (Phase 5 D-12 / DATA-07)", () => {
  it("getReadState returns the seeded doc data shape", async () => {
    const rs = await getReadState("o1", "u_self");
    expect(rs).toBeTruthy();
    expect(/** @type {*} */ (rs).pillarReads.p1).toBeTruthy();
    expect(/** @type {*} */ (rs).legacyAppUserId).toBe("u_self");
  });

  it("getReadState returns null for a user with no readState doc", async () => {
    const rs = await getReadState("o1", "u_missing");
    expect(rs).toBeNull();
  });

  it("setPillarRead writes pillarReads.{pillarId} with serverTimestamp() (D-12 / DATA-07)", async () => {
    await setPillarRead("o1", "u_other", "p2");
    const rs = await getReadState("o1", "u_other");
    expect(rs).toBeTruthy();
    expect(/** @type {*} */ (rs).pillarReads.p2).toEqual({ __serverTimestamp: true });
  });

  it("setChatRead writes chatLastRead with serverTimestamp() (D-12 / DATA-07)", async () => {
    await setChatRead("o1", "u_chat");
    const rs = await getReadState("o1", "u_chat");
    expect(rs).toBeTruthy();
    expect(/** @type {*} */ (rs).chatLastRead).toEqual({ __serverTimestamp: true });
  });

  it("subscribeReadState onChange fires with the seeded readState; returns unsubscribe", () => {
    /** @type {Array<any>} */
    const received = [];
    const unsub = subscribeReadState("o1", "u_self", {
      onChange: (rs) => received.push(rs),
      onError: () => {},
    });
    expect(typeof unsub).toBe("function");
    expect(received.length).toBeGreaterThanOrEqual(1);
    expect(received[0]?.pillarReads).toBeTruthy();
  });

  it("subscribeReadState onChange fires with null when the doc does not exist", () => {
    /** @type {Array<any>} */
    const received = [];
    subscribeReadState("o1", "u_absent", {
      onChange: (rs) => received.push(rs),
      onError: () => {},
    });
    expect(received[0]).toBeNull();
  });
});

describe("data/read-states.js (no-client-clock invariant — H7 prevention guard)", () => {
  it("does NOT use iso() / Date.now() / new Date() — serverTimestamp is the sole timestamp source", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/data/read-states.js", "utf-8");
    expect(src).not.toMatch(/iso\(\)/);
    expect(src).not.toMatch(/Date\.now\(\)/);
    expect(src).not.toMatch(/new\s+Date\(/);
    expect(src).toMatch(/serverTimestamp\(\)/);
  });
});
