// Phase 8 Wave 4 (GDPR-02 / GDPR-03 / GDPR-04 / Pitfall 11):
// unit tests for eraseCascade pure helper.
// Pattern C purity: no firebase-admin imports, no vi.mock needed.
// 7 behaviours per 08-05-PLAN.md Task 2.

import { describe, it, expect } from "vitest";
import {
  buildCascadeOps,
  chunkOpsForBatchedWrite,
  FIRESTORE_BATCH_LIMIT,
  ERASED_AT_SENTINEL,
} from "../../src/gdpr/eraseCascade.js";

const TOKEN = "deleted-user-abc123def456abcd";
const USER_ID = "u-123";

describe("buildCascadeOps", () => {
  // Test 1: messages — only authorId + legacyAuthorId tombstoned; body left intact
  it("tombstones authorId + legacyAuthorId for a message doc; leaves body intact", () => {
    const ops = buildCascadeOps(USER_ID, TOKEN, {
      userDoc: null,
      messages: [{ path: "orgs/orgA/messages/m1", data: { authorId: USER_ID, legacyAuthorId: USER_ID, body: "hi" } }],
      comments: [],
      actions: [],
      documentsSubcoll: [],
      documentsLegacy: [],
      funnelComments: [],
      auditEvents: [],
    });
    expect(ops).toHaveLength(1);
    const op = ops[0];
    expect(op.type).toBe("update");
    expect(op.path).toBe("orgs/orgA/messages/m1");
    expect(op.patch.authorId).toBe(TOKEN);
    expect(op.patch.legacyAuthorId).toBe(TOKEN);
    // body must NOT appear in the patch
    expect(Object.keys(op.patch)).not.toContain("body");
  });

  // Test 2: subcollection document — all 3 DOCUMENT_AUTHOR_FIELDS tombstoned
  it("tombstones all 3 DOCUMENT_AUTHOR_FIELDS for a subcollection documents row", () => {
    const ops = buildCascadeOps(USER_ID, TOKEN, {
      userDoc: null,
      messages: [],
      comments: [],
      actions: [],
      documentsSubcoll: [
        {
          path: "orgs/orgA/documents/d1",
          data: { uploaderId: USER_ID, uploadedBy: USER_ID, legacyAppUserId: USER_ID, path: "orgs/orgA/documents/d1/x.pdf" },
        },
      ],
      documentsLegacy: [],
      funnelComments: [],
      auditEvents: [],
    });
    expect(ops).toHaveLength(1);
    const op = ops[0];
    expect(op.patch.uploaderId).toBe(TOKEN);
    expect(op.patch.uploadedBy).toBe(TOKEN);
    expect(op.patch.legacyAppUserId).toBe(TOKEN);
  });

  // Test 3: users doc — PII fields nulled; erasedAt + erasedTo set
  it("tombstones users doc PII fields and sets erasedAt sentinel + erasedTo token", () => {
    const ops = buildCascadeOps(USER_ID, TOKEN, {
      userDoc: {
        path: `users/${USER_ID}`,
        data: {
          email: "a@b.com",
          name: "A",
          displayName: "A B",
          photoURL: "https://example.com/photo.jpg",
          avatar: "data:image/png;base64,abc",
        },
      },
      messages: [],
      comments: [],
      actions: [],
      documentsSubcoll: [],
      documentsLegacy: [],
      funnelComments: [],
      auditEvents: [],
    });
    expect(ops).toHaveLength(1);
    const op = ops[0];
    expect(op.type).toBe("update");
    expect(op.path).toBe(`users/${USER_ID}`);
    expect(op.patch.email).toBeNull();
    expect(op.patch.name).toBeNull();
    expect(op.patch.displayName).toBeNull();
    expect(op.patch.photoURL).toBeNull();
    expect(op.patch.avatar).toBeNull();
    expect(op.patch.erasedAt).toBe(ERASED_AT_SENTINEL);
    expect(op.patch.erasedTo).toBe(TOKEN);
  });

  // Test 4: auditLog entry whose actor.uid matches userId — tombstone PII, KEEP doc
  it("tombstones PII on an auditLog entry with actor.uid matching userId (Pitfall 11)", () => {
    const ops = buildCascadeOps(USER_ID, TOKEN, {
      userDoc: null,
      messages: [],
      comments: [],
      actions: [],
      documentsSubcoll: [],
      documentsLegacy: [],
      funnelComments: [],
      auditEvents: [
        {
          path: "auditLog/ev1",
          data: {
            actor: { uid: USER_ID, email: "u@example.com", role: "client", orgId: "orgA" },
            payload: { email: "u@example.com", action: "login" },
          },
        },
      ],
    });
    expect(ops).toHaveLength(1);
    const op = ops[0];
    expect(op.type).toBe("update");
    expect(op.path).toBe("auditLog/ev1");
    expect(op.patch["actor.uid"]).toBe(TOKEN);
    expect(op.patch["actor.email"]).toBeNull();
    expect(op.patch["payload.email"]).toBeNull();
    // The document is NOT deleted — patch does not include a delete marker
    expect(Object.keys(op.patch)).not.toContain("_delete");
  });

  // Test 5: auditLog entry with different actor.uid → NO op generated
  it("generates no op for an auditLog entry whose actor.uid does not match userId", () => {
    const ops = buildCascadeOps(USER_ID, TOKEN, {
      userDoc: null,
      messages: [],
      comments: [],
      actions: [],
      documentsSubcoll: [],
      documentsLegacy: [],
      funnelComments: [],
      auditEvents: [
        {
          path: "auditLog/ev2",
          data: {
            actor: { uid: "other-user", email: "other@example.com" },
            payload: {},
          },
        },
      ],
    });
    expect(ops).toHaveLength(0);
  });

  // Test 6: aggregate count — 1 userDoc + 12 messages + 5 comments + 3 documents + 4 audit events = 25 ops
  it("returns aggregate count of 25 ops for a mixed input", () => {
    const makeDoc = (path: string) => ({ path, data: { authorId: USER_ID } });
    const makeAuditDoc = (id: number) => ({
      path: `auditLog/ev${id}`,
      data: { actor: { uid: USER_ID, email: "u@example.com" }, payload: {} },
    });

    const ops = buildCascadeOps(USER_ID, TOKEN, {
      userDoc: { path: `users/${USER_ID}`, data: { email: "u@e.com", name: "U", displayName: "U", photoURL: null, avatar: null } },
      messages: Array.from({ length: 12 }, (_, i) => makeDoc(`orgs/o1/messages/m${i}`)),
      comments: Array.from({ length: 5 }, (_, i) => makeDoc(`orgs/o1/comments/c${i}`)),
      actions: [],
      documentsSubcoll: Array.from({ length: 3 }, (_, i) => makeDoc(`orgs/o1/documents/d${i}`)),
      documentsLegacy: [],
      funnelComments: [],
      auditEvents: Array.from({ length: 4 }, (_, i) => makeAuditDoc(i)),
    });
    // 1 (user) + 12 (messages) + 5 (comments) + 3 (docs) + 4 (audit) = 25
    expect(ops).toHaveLength(25);
  });

  // Test 7: chunkOpsForBatchedWrite splits 1247 ops into 3 batches: 500, 500, 247
  it("chunkOpsForBatchedWrite splits 1247 ops into batches of at most 500", () => {
    const fakeOps = Array.from({ length: 1247 }, (_, i) => ({
      type: "update" as const,
      path: `col/doc${i}`,
      patch: { field: "val" },
    }));
    const chunks = chunkOpsForBatchedWrite(fakeOps);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(500);
    expect(chunks[1]).toHaveLength(500);
    expect(chunks[2]).toHaveLength(247);
    expect(FIRESTORE_BATCH_LIMIT).toBe(500);
  });
});
