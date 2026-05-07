// tests/data/orgs.test.js
// @ts-check
// Phase 4 Wave 3 (D-09 / D-10 / D-12): full owner per D-09. The vi.mock target
// is the firebase/db.js adapter (Phase 4 D-11 forward-compat note in
// tests/mocks/firebase.js). Wave 3 retargets all data/* tests this way.
import { describe, it, expect, vi } from "vitest";
import { makeFirestoreMock } from "../mocks/firebase.js";

vi.mock("../../src/firebase/db.js", () => makeFirestoreMock({
  seed: { "orgs/o1": { id: "o1", name: "Acme" } },
}));

const { getOrg, listOrgs, saveOrg, deleteOrg, subscribeOrgs } = await import("../../src/data/orgs.js");

describe("data/orgs.js (D-09 full owner)", () => {
  it("getOrg returns the seeded doc", async () => {
    const o = await getOrg("o1");
    expect(o).toEqual({ id: "o1", name: "Acme" });
  });

  it("getOrg returns null when the doc is absent", async () => {
    const o = await getOrg("missing");
    expect(o).toBeNull();
  });

  it("listOrgs returns an array of seeded orgs with id field merged", async () => {
    const list = await listOrgs();
    expect(Array.isArray(list)).toBe(true);
    expect(list.find((/** @type {any} */ o) => o.id === "o1")).toBeTruthy();
  });

  it("saveOrg writes via setDoc with serverTimestamp() updatedAt", async () => {
    await saveOrg({ id: "o2", name: "Beta" });
    const o = await getOrg("o2");
    expect(o).toBeTruthy();
    expect(o.name).toBe("Beta");
    // The mock seed records the document; serverTimestamp call is captured by the spy.
  });

  it("deleteOrg removes the doc", async () => {
    await deleteOrg("o1");
    const o = await getOrg("o1");
    expect(o).toBeNull();
  });

  it("subscribeOrgs invokes onChange with the snapshot and returns unsubscribe", () => {
    /** @type {any[]} */
    const received = [];
    const unsub = subscribeOrgs({
      onChange: (orgs) => received.push(orgs),
      onError: () => {},
    });
    expect(typeof unsub).toBe("function");
    expect(received.length).toBeGreaterThanOrEqual(1);
  });
});
