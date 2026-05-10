// Phase 8 Wave 2 (LIFE-01): unit tests for resolveDocRef.ts pure helper.
// No firebase-admin mocks needed — pure TypeScript with no SDK dependencies.

import { describe, expect, it } from "vitest";
import { resolveDocPath, resolveSnapshotPath } from "../../src/lifecycle/resolveDocRef.js";

describe("resolveDocPath", () => {
  it("maps org type to orgs/{id}", () => {
    expect(resolveDocPath({ type: "org", orgId: "orgA", id: "orgA" })).toBe("orgs/orgA");
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
});

describe("resolveSnapshotPath", () => {
  it("maps type + id to softDeleted/{type}/items/{id}", () => {
    expect(resolveSnapshotPath({ type: "comment", id: "c_xyz" })).toBe("softDeleted/comment/items/c_xyz");
    expect(resolveSnapshotPath({ type: "message", id: "m_abc" })).toBe("softDeleted/message/items/m_abc");
    expect(resolveSnapshotPath({ type: "org", id: "org1" })).toBe("softDeleted/org/items/org1");
  });
});
