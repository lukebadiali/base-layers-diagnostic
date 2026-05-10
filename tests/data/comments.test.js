// tests/data/comments.test.js
// @ts-check
// Phase 5 Wave 3 (DATA-01 / 05-03): subcollection rewrite.
// comments.js now reads/writes orgs/{orgId}/comments/{cmtId} directly via
// firebase/db.js — Phase 4 D-09 / D-10 API surface preserved verbatim.
import { describe, it, expect, vi } from "vitest";
import { makeFirestoreMock } from "../mocks/firebase.js";

vi.mock("../../src/firebase/db.js", () => makeFirestoreMock({
  seed: {
    "orgs/o1/comments/c1": {
      pillarId: "p1",
      authorId: "u_a",
      legacyAuthorId: "u_a",
      body: "hi",
      createdAt: null,
    },
    "orgs/o1/comments/c2": {
      pillarId: "p2",
      authorId: "u_b",
      legacyAuthorId: "u_b",
      body: "elsewhere",
      createdAt: null,
    },
  },
}));

const { listComments, addComment, deleteComment } = await import("../../src/data/comments.js");

describe("data/comments.js (Phase 5 subcollection rewrite)", () => {
  it("listComments filters subcollection by pillarId", async () => {
    const cs = await listComments("o1", "p1");
    expect(cs.length).toBe(1);
    expect(cs[0].id).toBe("c1");
    expect(cs[0].body).toBe("hi");
  });

  it("listComments returns [] when no comments match the pillar", async () => {
    const cs = await listComments("o1", "p999");
    expect(cs).toEqual([]);
  });

  it("addComment writes to subcollection with createdAt: serverTimestamp() and legacyAuthorId", async () => {
    await addComment("o1", "p1", { authorId: "u_c", body: "hello" });
    const cs = await listComments("o1", "p1");
    const added = cs.find((/** @type {any} */ c) => c.body === "hello");
    expect(added).toBeTruthy();
    expect(added.authorId).toBe("u_c");
    expect(added.legacyAuthorId).toBe("u_c");
    expect(added.createdAt).toEqual({ __serverTimestamp: true });
  });

  it("deleteComment removes the matching subcollection doc by id", async () => {
    await deleteComment("o1", "p1", "c1");
    const cs = await listComments("o1", "p1");
    expect(cs.find((/** @type {any} */ c) => c.id === "c1")).toBeFalsy();
  });

  it("addComment throws when authorId is missing (defensive branch — Phase 7 Wave 4)", async () => {
    await expect(addComment("o1", "p1", { body: "no-author" })).rejects.toThrow(
      /authorId is required/,
    );
  });
});
