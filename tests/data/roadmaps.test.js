// tests/data/roadmaps.test.js
// @ts-check
import { describe, it, expect, vi } from "vitest";
import { makeFirestoreMock } from "../mocks/firebase.js";

vi.mock("../../src/firebase/db.js", () => makeFirestoreMock({
  seed: { "roadmaps/o1": { items: [{ id: "r1", title: "Stand up auth" }] } },
}));

const { getRoadmap, listRoadmaps, saveRoadmap, deleteRoadmap, subscribeRoadmaps } = await import("../../src/data/roadmaps.js");

describe("data/roadmaps.js (D-09 full owner)", () => {
  it("getRoadmap returns the seeded doc", async () => {
    const r = await getRoadmap("o1");
    expect(r).toEqual({ items: [{ id: "r1", title: "Stand up auth" }] });
  });

  it("getRoadmap returns null when absent", async () => {
    const r = await getRoadmap("missing");
    expect(r).toBeNull();
  });

  it("listRoadmaps returns an array with the seeded entry", async () => {
    const list = await listRoadmaps();
    expect(list.find((/** @type {any} */ r) => r.id === "o1")).toBeTruthy();
  });

  it("saveRoadmap merges via setDoc", async () => {
    await saveRoadmap("o2", { items: [{ id: "r2", title: "Wire MFA" }] });
    const r = await getRoadmap("o2");
    expect(r).toBeTruthy();
  });

  it("deleteRoadmap removes the doc", async () => {
    await deleteRoadmap("o1");
    const r = await getRoadmap("o1");
    expect(r).toBeNull();
  });

  it("subscribeRoadmaps returns unsubscribe and fires onChange", () => {
    /** @type {any[]} */
    const received = [];
    const unsub = subscribeRoadmaps({
      onChange: (rs) => received.push(rs),
      onError: () => {},
    });
    expect(typeof unsub).toBe("function");
    expect(received.length).toBeGreaterThanOrEqual(1);
  });
});
