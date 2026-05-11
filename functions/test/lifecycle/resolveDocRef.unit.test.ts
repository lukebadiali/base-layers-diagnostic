// Phase 8 Wave 2 (LIFE-01): unit tests for resolveDocRef.ts pure helper.
// No firebase-admin mocks needed — pure TypeScript with no SDK dependencies.

import { describe, expect, it } from "vitest";
import { resolveDocPath, resolveSnapshotPath } from "../../src/lifecycle/resolveDocRef.js";

describe("resolveDocPath", () => {
  it("maps action type to orgs/{orgId}/actions/{id}", () => {
    expect(resolveDocPath({ type: "action", orgId: "orgA", id: "act_xyz" })).toBe("orgs/orgA/actions/act_xyz");
  });

  it("maps comment type to orgs/{orgId}/comments/{id}", () => {
    expect(resolveDocPath({ type: "comment", orgId: "orgA", id: "c_xyz" })).toBe("orgs/orgA/comments/c_xyz");
  });

  it("maps document type to orgs/{orgId}/documents/{id}", () => {
    expect(resolveDocPath({ type: "document", orgId: "orgA", id: "d_xyz" })).toBe("orgs/orgA/documents/d_xyz");
  });

  it("maps message type to orgs/{orgId}/messages/{id}", () => {
    expect(resolveDocPath({ type: "message", orgId: "orgA", id: "m_xyz" })).toBe("orgs/orgA/messages/m_xyz");
  });

  it("maps funnelComment type to funnelComments/{id}", () => {
    expect(resolveDocPath({ type: "funnelComment", orgId: "orgA", id: "fc_xyz" })).toBe("funnelComments/fc_xyz");
  });

  it("throws RangeError for unknown type", () => {
    expect(() =>
      resolveDocPath({ type: "unknown" as never, orgId: "orgA", id: "x" }),
    ).toThrow(RangeError);
  });

  it("SOFT_DELETABLE_TYPES enum is exactly the 5 expected types (regression pin)", async () => {
    const { SOFT_DELETABLE_TYPES } = await import("../../src/lifecycle/resolveDocRef.js");
    expect([...SOFT_DELETABLE_TYPES].sort()).toEqual(
      ["action", "comment", "document", "funnelComment", "message"].sort(),
    );
    expect(SOFT_DELETABLE_TYPES).not.toContain("org");
  });
});

describe("resolveSnapshotPath", () => {
  it("maps type + id to softDeleted/{type}/items/{id}", () => {
    expect(resolveSnapshotPath({ type: "comment", id: "c_xyz" })).toBe("softDeleted/comment/items/c_xyz");
    expect(resolveSnapshotPath({ type: "message", id: "m_abc" })).toBe("softDeleted/message/items/m_abc");
    expect(resolveSnapshotPath({ type: "action", id: "act1" })).toBe("softDeleted/action/items/act1");
  });
});
