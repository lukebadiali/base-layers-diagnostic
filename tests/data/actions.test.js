// tests/data/actions.test.js
// @ts-check
// Phase 5 Wave 3 (DATA-01 / 05-03): subcollection rewrite.
// actions.js now reads/writes orgs/{orgId}/actions/{actId} directly via
// firebase/db.js — Phase 4 D-09 / D-10 API surface preserved verbatim.
import { describe, it, expect, vi } from "vitest";
import { makeFirestoreMock } from "../mocks/firebase.js";

vi.mock("../../src/firebase/db.js", () => makeFirestoreMock({
  seed: {
    "orgs/o1": { id: "o1", name: "Acme" },
    "orgs/o1/actions/a1": {
      orgId: "o1",
      title: "Wire MFA",
      ownerId: "u_a",
      legacyAppUserId: "u_a",
      status: "open",
    },
  },
}));

const { listActions, saveAction, deleteAction } = await import("../../src/data/actions.js");

describe("data/actions.js (Phase 5 subcollection rewrite)", () => {
  it("listActions returns the seeded subcollection docs as an array (id merged)", async () => {
    const as = await listActions("o1");
    expect(as.length).toBe(1);
    expect(as[0].id).toBe("a1");
    expect(as[0].title).toBe("Wire MFA");
  });

  it("listActions returns [] when the org has no actions subcollection docs", async () => {
    const as = await listActions("missing-org");
    expect(as).toEqual([]);
  });

  it("saveAction upserts at orgs/{orgId}/actions/{action.id} with legacyAppUserId carried", async () => {
    await saveAction("o1", { id: "a2", title: "Stand up audit log", ownerId: "u_b" });
    const as = await listActions("o1");
    const added = as.find((/** @type {any} */ a) => a.id === "a2");
    expect(added).toBeTruthy();
    expect(added.title).toBe("Stand up audit log");
    expect(added.legacyAppUserId).toBe("u_b");
    expect(added.updatedAt).toEqual({ __serverTimestamp: true });
  });

  it("saveAction throws if action.id is missing (subcollection requires explicit id)", async () => {
    await expect(saveAction("o1", { title: "no id" })).rejects.toThrow(/action\.id required/);
  });

  it("deleteAction removes the matching subcollection doc by id", async () => {
    await deleteAction("o1", "a1");
    const as = await listActions("o1");
    expect(as.find((/** @type {any} */ a) => a.id === "a1")).toBeFalsy();
  });
});
