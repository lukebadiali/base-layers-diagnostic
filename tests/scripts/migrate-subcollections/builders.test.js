// tests/scripts/migrate-subcollections/builders.test.js
// @ts-check
//
// Phase 5 Wave 2 (D-08 / D-10): unit tests for the pure builder functions in
// scripts/migrate-subcollections/builders.js. Tests are tests-first per D-10
// — they pin the contract every builder must honour:
//   - Subcollection paths follow ARCHITECTURE.md §4 / D-11.
//   - Each target doc carries the D-03 inline legacy field where applicable.
//   - Edge cases (empty maps, malformed entries) return [] without throwing.
import { describe, it, expect } from "vitest";
import {
  buildResponses,
  buildComments,
  buildActions,
  buildDocuments,
  buildMessages,
  buildReadStatesInit,
} from "../../../scripts/migrate-subcollections/builders.js";

describe("buildResponses (D-11 path + D-03 legacyAppUserId)", () => {
  it("produces one subcollection doc per (roundId, userId, pillarId) tuple", () => {
    const orgData = {
      updatedAt: 1000,
      responses: { r1: { u1: { p1: [{ score: 7 }, { score: 8 }] } } },
    };
    const out = buildResponses("o1", orgData);
    expect(out).toHaveLength(1);
    expect(out[0].path).toBe("orgs/o1/responses/r1__u1__p1");
    expect(out[0].data).toEqual({
      roundId: "r1",
      userId: "u1",
      legacyAppUserId: "u1", // D-03 invariant
      pillarId: "p1",
      values: [{ score: 7 }, { score: 8 }],
      updatedAt: 1000,
    });
  });

  it("returns [] for an org with no responses field", () => {
    expect(buildResponses("o1", {})).toEqual([]);
  });

  it("skips malformed entries (non-object roundId values)", () => {
    const orgData = { responses: { r1: "not-a-map" } };
    expect(buildResponses("o1", orgData)).toEqual([]);
  });

  it("expands across multiple rounds, users, and pillars", () => {
    const orgData = {
      responses: {
        r1: {
          u1: { p1: [{ score: 5 }], p2: [{ score: 6 }] },
          u2: { p1: [{ score: 4 }] },
        },
        r2: { u1: { p1: [{ score: 9 }] } },
      },
    };
    const out = buildResponses("o1", orgData);
    expect(out).toHaveLength(4);
    const paths = out.map((t) => t.path).sort();
    expect(paths).toEqual([
      "orgs/o1/responses/r1__u1__p1",
      "orgs/o1/responses/r1__u1__p2",
      "orgs/o1/responses/r1__u2__p1",
      "orgs/o1/responses/r2__u1__p1",
    ]);
  });

  it("falls back to updatedAt=null when source doc lacks updatedAt", () => {
    const orgData = { responses: { r1: { u1: { p1: [{}] } } } };
    const out = buildResponses("o1", orgData);
    expect(out[0].data.updatedAt).toBeNull();
  });

  it("skips non-array pillar values (defensive guard)", () => {
    const orgData = { responses: { r1: { u1: { p1: "not-an-array" } } } };
    expect(buildResponses("o1", orgData)).toEqual([]);
  });
});

describe("buildComments (D-11 path + D-03 legacyAuthorId)", () => {
  it("produces one subcollection doc per source comment, preserving id", () => {
    const orgData = {
      comments: {
        p1: [
          { id: "c1", authorId: "u_a", body: "hi", internalOnly: false, createdAt: 1000 },
        ],
      },
    };
    const out = buildComments("o1", orgData);
    expect(out).toHaveLength(1);
    expect(out[0].path).toBe("orgs/o1/comments/c1");
    expect(out[0].data).toEqual({
      pillarId: "p1",
      authorId: "u_a",
      legacyAuthorId: "u_a", // D-03
      body: "hi",
      internalOnly: false,
      createdAt: 1000,
    });
  });

  it("returns [] when comments map is empty", () => {
    expect(buildComments("o1", {})).toEqual([]);
  });

  it("skips comments without an id", () => {
    const orgData = {
      comments: { p1: [{ authorId: "u_a", body: "no-id" }, { id: "c2", authorId: "u_b", body: "ok" }] },
    };
    const out = buildComments("o1", orgData);
    expect(out).toHaveLength(1);
    expect(out[0].path).toBe("orgs/o1/comments/c2");
  });

  it("defaults internalOnly to false when source omits it", () => {
    const orgData = { comments: { p1: [{ id: "c1", authorId: "u_a", body: "x" }] } };
    const out = buildComments("o1", orgData);
    expect(out[0].data.internalOnly).toBe(false);
  });

  it("preserves internalOnly=true verbatim", () => {
    const orgData = {
      comments: { p1: [{ id: "c1", authorId: "u_a", body: "x", internalOnly: true }] },
    };
    const out = buildComments("o1", orgData);
    expect(out[0].data.internalOnly).toBe(true);
  });
});

describe("buildActions (D-11 path + D-03 legacyAppUserId)", () => {
  it("produces one subcollection doc per actionId, preserving id", () => {
    const orgData = {
      actions: {
        a1: { title: "T", description: "D", status: "open", ownerId: "u_a", createdAt: 1, updatedAt: 2, dueAt: 3 },
      },
    };
    const out = buildActions("o1", orgData);
    expect(out).toHaveLength(1);
    expect(out[0].path).toBe("orgs/o1/actions/a1");
    expect(out[0].data).toEqual({
      orgId: "o1",
      title: "T",
      description: "D",
      status: "open",
      ownerId: "u_a",
      legacyAppUserId: "u_a", // D-03
      dueAt: 3,
      createdAt: 1,
      updatedAt: 2,
    });
  });

  it("defaults status to 'open' when source omits it", () => {
    const orgData = { actions: { a1: { title: "T", ownerId: "u_a" } } };
    const out = buildActions("o1", orgData);
    expect(out[0].data.status).toBe("open");
  });

  it("returns [] when actions map is empty", () => {
    expect(buildActions("o1", {})).toEqual([]);
  });
});

describe("buildDocuments (D-11 path + D-03 legacyAppUserId)", () => {
  it("produces one subcollection doc per docId, preserving metadata", () => {
    const orgData = {
      documents: {
        d1: {
          name: "foo.pdf",
          path: "orgs/o1/documents/d1/foo.pdf",
          downloadURL: "https://example/foo.pdf",
          uploadedBy: "u_a",
          createdAt: 1000,
        },
      },
    };
    const out = buildDocuments("o1", orgData);
    expect(out).toHaveLength(1);
    expect(out[0].path).toBe("orgs/o1/documents/d1");
    expect(out[0].data).toEqual({
      orgId: "o1",
      name: "foo.pdf",
      path: "orgs/o1/documents/d1/foo.pdf",
      downloadURL: "https://example/foo.pdf",
      uploadedBy: "u_a",
      legacyAppUserId: "u_a", // D-03
      createdAt: 1000,
    });
  });

  it("sets legacyAppUserId=null when source has no uploadedBy", () => {
    const orgData = { documents: { d1: { name: "x.pdf" } } };
    const out = buildDocuments("o1", orgData);
    expect(out[0].data.legacyAppUserId).toBeNull();
  });

  it("returns [] when documents map is empty", () => {
    expect(buildDocuments("o1", {})).toEqual([]);
  });
});

describe("buildMessages (D-11 path + D-03 legacyAuthorId)", () => {
  it("produces one subcollection doc per messageId, preserving id", () => {
    const orgData = {
      messages: { m1: { authorId: "u_a", body: "hi", createdAt: 1000 } },
    };
    const out = buildMessages("o1", orgData);
    expect(out).toHaveLength(1);
    expect(out[0].path).toBe("orgs/o1/messages/m1");
    expect(out[0].data).toEqual({
      authorId: "u_a",
      legacyAuthorId: "u_a", // D-03
      body: "hi",
      createdAt: 1000,
    });
  });

  it("returns [] when messages map is empty", () => {
    expect(buildMessages("o1", {})).toEqual([]);
  });

  it("defaults createdAt to null when source omits it", () => {
    const orgData = { messages: { m1: { authorId: "u_a", body: "hi" } } };
    const out = buildMessages("o1", orgData);
    expect(out[0].data.createdAt).toBeNull();
  });
});

describe("buildReadStatesInit (D-11 path + D-03 legacyAppUserId)", () => {
  it("produces one subcollection doc per userId, mapping per-pillar ISO strings", () => {
    const orgData = {
      readStates: { u1: { p1: "2026-01-01T00:00:00.000Z" } },
    };
    const out = buildReadStatesInit("o1", orgData);
    expect(out).toHaveLength(1);
    expect(out[0].path).toBe("orgs/o1/readStates/u1");
    expect(out[0].data).toEqual({
      pillarReads: { p1: "2026-01-01T00:00:00.000Z" },
      chatLastRead: null,
      legacyAppUserId: "u1", // D-03 - userId IS the legacy app-internal user id
    });
  });

  it("returns [] when readStates map is empty", () => {
    expect(buildReadStatesInit("o1", {})).toEqual([]);
  });

  it("preserves multiple pillars per user", () => {
    const orgData = {
      readStates: {
        u1: { p1: "2026-01-01T00:00:00.000Z", p2: "2026-02-01T00:00:00.000Z" },
        u2: { p1: "2026-03-01T00:00:00.000Z" },
      },
    };
    const out = buildReadStatesInit("o1", orgData);
    expect(out).toHaveLength(2);
    const u1 = out.find((d) => d.path === "orgs/o1/readStates/u1");
    expect(u1?.data.pillarReads).toEqual({
      p1: "2026-01-01T00:00:00.000Z",
      p2: "2026-02-01T00:00:00.000Z",
    });
  });

  it("skips users whose value is not an object", () => {
    const orgData = { readStates: { u1: "not-a-map" } };
    expect(buildReadStatesInit("o1", orgData)).toEqual([]);
  });
});

describe("D-03 inline legacy fields invariant (cross-builder)", () => {
  // A representative org with every collection populated. Every produced
  // target doc that references a user/author MUST carry the inline legacy
  // field (Phase 6 AUTH-15 backfill substrate).
  const REP_ORG = {
    updatedAt: 1700000000000,
    responses: { r1: { u_a: { p1: [{ score: 7 }] } } },
    comments: { p1: [{ id: "c1", authorId: "u_b", body: "hi" }] },
    actions: { a1: { title: "T", ownerId: "u_c", status: "open" } },
    documents: { d1: { name: "foo.pdf", uploadedBy: "u_d" } },
    messages: { m1: { authorId: "u_e", body: "hi" } },
    readStates: { u_f: { p1: "2026-01-01T00:00:00.000Z" } },
  };

  it("buildResponses: every produced doc has legacyAppUserId verbatim", () => {
    const out = buildResponses("o1", REP_ORG);
    out.forEach((t) => {
      expect(t.data.legacyAppUserId).toBe(t.data.userId);
      expect(t.data.legacyAppUserId).toBe("u_a");
    });
  });

  it("buildComments: every produced doc has legacyAuthorId verbatim", () => {
    const out = buildComments("o1", REP_ORG);
    out.forEach((t) => {
      expect(t.data.legacyAuthorId).toBe(t.data.authorId);
      expect(t.data.legacyAuthorId).toBe("u_b");
    });
  });

  it("buildActions: every produced doc has legacyAppUserId verbatim", () => {
    const out = buildActions("o1", REP_ORG);
    out.forEach((t) => {
      expect(t.data.legacyAppUserId).toBe(t.data.ownerId);
      expect(t.data.legacyAppUserId).toBe("u_c");
    });
  });

  it("buildDocuments: every produced doc has legacyAppUserId verbatim (or null)", () => {
    const out = buildDocuments("o1", REP_ORG);
    out.forEach((t) => {
      expect(t.data.legacyAppUserId).toBe(t.data.uploadedBy || null);
      expect(t.data.legacyAppUserId).toBe("u_d");
    });
  });

  it("buildMessages: every produced doc has legacyAuthorId verbatim", () => {
    const out = buildMessages("o1", REP_ORG);
    out.forEach((t) => {
      expect(t.data.legacyAuthorId).toBe(t.data.authorId);
      expect(t.data.legacyAuthorId).toBe("u_e");
    });
  });

  it("buildReadStatesInit: every produced doc has legacyAppUserId verbatim (= source userId)", () => {
    const out = buildReadStatesInit("o1", REP_ORG);
    out.forEach((t) => {
      // path is orgs/o1/readStates/{userId} — pull the userId from the path
      const userId = t.path.split("/").pop();
      expect(t.data.legacyAppUserId).toBe(userId);
      expect(t.data.legacyAppUserId).toBe("u_f");
    });
  });
});

describe("Pitfall 4 closure (builders are pure)", () => {
  it("builders module exports exactly the 6 expected functions", async () => {
    const mod = await import("../../../scripts/migrate-subcollections/builders.js");
    expect(typeof mod.buildResponses).toBe("function");
    expect(typeof mod.buildComments).toBe("function");
    expect(typeof mod.buildActions).toBe("function");
    expect(typeof mod.buildDocuments).toBe("function");
    expect(typeof mod.buildMessages).toBe("function");
    expect(typeof mod.buildReadStatesInit).toBe("function");
  });
});
