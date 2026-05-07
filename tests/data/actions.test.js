// tests/data/actions.test.js
// @ts-check
// Phase 4 Wave 3 (D-09 pass-through): actions.js preserves the IIFE's flat
// org.actions[actionId] map shape (D-12 faithful extraction). Phase 5
// (DATA-01) rewrites to subcollection access; the API surface stays stable.
import { describe, it, expect, vi } from "vitest";
import { makeFirestoreMock } from "../mocks/firebase.js";

vi.mock("../../src/firebase/db.js", () => makeFirestoreMock({
  seed: {
    "orgs/o1": { id: "o1", actions: { a1: { id: "a1", title: "Wire MFA" } } },
  },
}));

const { listActions, saveAction, deleteAction } = await import("../../src/data/actions.js");

describe("data/actions.js (D-09 pass-through)", () => {
  it("listActions returns the seeded actions as an array", async () => {
    const as = await listActions("o1");
    expect(as).toEqual([{ id: "a1", title: "Wire MFA" }]);
  });

  it("listActions returns [] when the org has no actions", async () => {
    const as = await listActions("missing-org");
    expect(as).toEqual([]);
  });

  it("saveAction upserts by action.id", async () => {
    await saveAction("o1", { id: "a2", title: "Stand up audit log" });
    const as = await listActions("o1");
    expect(as.find((/** @type {any} */ a) => a.id === "a2")).toBeTruthy();
  });

  it("deleteAction removes by id", async () => {
    await deleteAction("o1", "a1");
    const as = await listActions("o1");
    expect(as.find((/** @type {any} */ a) => a.id === "a1")).toBeFalsy();
  });
});
