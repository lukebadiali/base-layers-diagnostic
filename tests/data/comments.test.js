// tests/data/comments.test.js
// @ts-check
// Phase 4 Wave 3 (D-09 pass-through): comments.js delegates to data/orgs.js's
// nested-map shape (org.comments[pillarId][...]). Phase 5 (DATA-01) replaces
// the body with subcollection access; the API surface stays stable.
import { describe, it, expect, vi } from "vitest";
import { makeFirestoreMock } from "../mocks/firebase.js";

vi.mock("../../src/firebase/db.js", () => makeFirestoreMock({
  seed: {
    "orgs/o1": { id: "o1", comments: { p1: [{ id: "c1", body: "hi" }] } },
  },
}));

const { listComments, addComment, deleteComment } = await import("../../src/data/comments.js");

describe("data/comments.js (D-09 pass-through)", () => {
  it("listComments returns seeded comments for the pillar", async () => {
    const cs = await listComments("o1", "p1");
    expect(cs).toEqual([{ id: "c1", body: "hi" }]);
  });

  it("listComments returns [] when no comments for that pillar", async () => {
    const cs = await listComments("o1", "p999");
    expect(cs).toEqual([]);
  });

  it("addComment appends to the org's comments map", async () => {
    await addComment("o1", "p1", { id: "c2", body: "hello" });
    const cs = await listComments("o1", "p1");
    expect(cs.find((/** @type {any} */ c) => c.id === "c2")).toBeTruthy();
  });

  it("deleteComment removes the matching comment by id", async () => {
    await deleteComment("o1", "p1", "c1");
    const cs = await listComments("o1", "p1");
    expect(cs.find((/** @type {any} */ c) => c.id === "c1")).toBeFalsy();
  });

  it("addComment is a no-op when the org is missing", async () => {
    // Should not throw
    await addComment("missing-org", "p1", { id: "x", body: "x" });
  });
});
