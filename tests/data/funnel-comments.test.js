// tests/data/funnel-comments.test.js
// @ts-check
import { describe, it, expect, vi } from "vitest";
import { makeFirestoreMock } from "../mocks/firebase.js";

vi.mock("../../src/firebase/db.js", () => makeFirestoreMock({
  seed: {
    "funnelComments/c1": { id: "c1", orgId: "o1", body: "Q1 spike" },
    "funnelComments/c2": { id: "c2", orgId: "o2", body: "Other org" },
  },
}));

const { listFunnelComments, addFunnelComment, deleteFunnelComment, subscribeFunnelComments } = await import("../../src/data/funnel-comments.js");

describe("data/funnel-comments.js (D-09 full owner)", () => {
  it("listFunnelComments returns rows for the requested orgId only", async () => {
    const cs = await listFunnelComments("o1");
    expect(cs.find((/** @type {any} */ c) => c.id === "c1")).toBeTruthy();
    expect(cs.find((/** @type {any} */ c) => c.id === "c2")).toBeFalsy();
  });

  it("addFunnelComment writes a new comment scoped to the orgId (Firestore auto-id)", async () => {
    const { id } = await addFunnelComment("o1", { body: "Q2 KPI shift" });
    expect(id).toBeTruthy();
    const cs = await listFunnelComments("o1");
    expect(cs.find((/** @type {any} */ c) => c.body === "Q2 KPI shift")).toBeTruthy();
  });

  it("deleteFunnelComment removes the doc", async () => {
    await deleteFunnelComment("c1");
    const cs = await listFunnelComments("o1");
    expect(cs.find((/** @type {any} */ c) => c.id === "c1")).toBeFalsy();
  });

  it("subscribeFunnelComments returns unsubscribe and fires onChange", () => {
    /** @type {any[]} */
    const received = [];
    const unsub = subscribeFunnelComments("o1", {
      onChange: (cs) => received.push(cs),
      onError: () => {},
    });
    expect(typeof unsub).toBe("function");
    expect(received.length).toBeGreaterThanOrEqual(1);
  });
});
