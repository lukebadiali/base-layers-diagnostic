// tests/data/funnels.test.js
// @ts-check
import { describe, it, expect, vi } from "vitest";
import { makeFirestoreMock } from "../mocks/firebase.js";

vi.mock("../../src/firebase/db.js", () => makeFirestoreMock({
  seed: { "funnels/o1": { kpis: [{ id: "k1", name: "MRR" }] } },
}));

const { getFunnel, listFunnels, saveFunnel, deleteFunnel, subscribeFunnels } = await import("../../src/data/funnels.js");

describe("data/funnels.js (D-09 full owner)", () => {
  it("getFunnel returns the seeded doc", async () => {
    const f = await getFunnel("o1");
    expect(f).toEqual({ kpis: [{ id: "k1", name: "MRR" }] });
  });

  it("getFunnel returns null when absent", async () => {
    const f = await getFunnel("missing");
    expect(f).toBeNull();
  });

  it("listFunnels returns an array with the seeded entry", async () => {
    const list = await listFunnels();
    expect(list.find((/** @type {any} */ f) => f.id === "o1")).toBeTruthy();
  });

  it("saveFunnel merges via setDoc", async () => {
    await saveFunnel("o2", { kpis: [{ id: "k2", name: "ARR" }] });
    const f = await getFunnel("o2");
    expect(f).toBeTruthy();
  });

  it("deleteFunnel removes the doc", async () => {
    await deleteFunnel("o1");
    const f = await getFunnel("o1");
    expect(f).toBeNull();
  });

  it("subscribeFunnels returns unsubscribe and fires onChange", () => {
    /** @type {any[]} */
    const received = [];
    const unsub = subscribeFunnels({
      onChange: (fs) => received.push(fs),
      onError: () => {},
    });
    expect(typeof unsub).toBe("function");
    expect(received.length).toBeGreaterThanOrEqual(1);
  });
});
