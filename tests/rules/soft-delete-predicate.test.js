// tests/rules/soft-delete-predicate.test.js
// @ts-check
// Phase 5 Wave 1 (T-5-08): notDeleted(r) cross-cutting suite. For every
// collection that uses `notDeleted(r)`, seeding a doc with deletedAt:<timestamp>
// denies reads; deletedAt:null allows.
//
// Phase 8 Wave 2 (08-03): extends to 5 soft-deletable subcollections:
//   - orgs/{orgId}/comments/{cmtId}
//   - orgs/{orgId}/actions/{actId}
//   - orgs/{orgId}/documents/{docId}
//   - orgs/{orgId}/messages/{msgId}
//   - funnelComments/{id}
import { collection, doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  it,
} from "vitest";
import { initRulesEnv, asUser, ROLES, assertSucceeds, assertFails } from "./setup.js";

let testEnv;
const claimsByRole = Object.fromEntries(ROLES.map((r) => [r.role, r.claims]));

beforeAll(async () => {
  testEnv = await initRulesEnv("firestore", "soft-delete");
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const now = Timestamp.now();
    // orgs/orgA - LIVE (deletedAt: null)
    await setDoc(doc(db, "orgs/orgA"), {
      orgId: "orgA",
      name: "live",
      createdAt: now,
      deletedAt: null,
    });
    // orgs/orgDeleted - SOFT-DELETED (deletedAt: <ts>)
    await setDoc(doc(db, "orgs/orgDeleted"), {
      orgId: "orgDeleted",
      name: "deleted",
      createdAt: now,
      deletedAt: now,
    });

    // ── Phase 8: comments ───────────────────────────────────────────
    await setDoc(doc(db, "orgs/orgA/comments/cLive"), {
      orgId: "orgA", pillarId: "1", body: "live", authorId: "u1",
      deletedAt: null,
    });
    await setDoc(doc(db, "orgs/orgA/comments/cDeleted"), {
      orgId: "orgA", pillarId: "1", body: "deleted", authorId: "u1",
      deletedAt: now,
    });

    // ── Phase 8: actions ────────────────────────────────────────────
    await setDoc(doc(db, "orgs/orgA/actions/aLive"), {
      orgId: "orgA", title: "live action", deletedAt: null,
    });
    await setDoc(doc(db, "orgs/orgA/actions/aDeleted"), {
      orgId: "orgA", title: "deleted action", deletedAt: now,
    });

    // ── Phase 8: documents ──────────────────────────────────────────
    await setDoc(doc(db, "orgs/orgA/documents/dLive"), {
      orgId: "orgA", name: "live.pdf", deletedAt: null,
    });
    await setDoc(doc(db, "orgs/orgA/documents/dDeleted"), {
      orgId: "orgA", name: "deleted.pdf", deletedAt: now,
    });

    // ── Phase 8: messages ───────────────────────────────────────────
    await setDoc(doc(db, "orgs/orgA/messages/mLive"), {
      orgId: "orgA", body: "live msg", authorId: "u1", deletedAt: null,
    });
    await setDoc(doc(db, "orgs/orgA/messages/mDeleted"), {
      orgId: "orgA", body: "deleted msg", authorId: "u1", deletedAt: now,
    });

    // ── Phase 8: funnelComments ─────────────────────────────────────
    await setDoc(doc(db, "funnelComments/fcLive"), {
      orgId: "orgA", body: "live fc", authorId: "u1", deletedAt: null,
    });
    await setDoc(doc(db, "funnelComments/fcDeleted"), {
      orgId: "orgA", body: "deleted fc", authorId: "u1", deletedAt: now,
    });
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

// ── Phase 5: orgs/{orgId} parent (preserved verbatim) ──────────────────────

describe("soft-delete predicate notDeleted(r) - orgs/{orgId} (Phase 5)", () => {
  it("client_orgA reads orgA (deletedAt: null) - allow", async () => {
    const db = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertSucceeds(getDoc(doc(db, "orgs/orgA")));
  });
  it("client_orgDeleted reads orgDeleted (deletedAt: <ts>) - deny", async () => {
    const claims = {
      role: "client",
      orgId: "orgDeleted",
      email_verified: true,
    };
    const db = asUser(testEnv, "client_orgDeleted", claims);
    await assertFails(getDoc(doc(db, "orgs/orgDeleted")));
  });
  it("internal reads orgDeleted - deny (notDeleted applies even for internal)", async () => {
    const db = asUser(testEnv, "internal", claimsByRole.internal);
    await assertFails(getDoc(doc(db, "orgs/orgDeleted")));
  });
});

// ── Phase 8: orgs/{orgId}/comments/{cmtId} ─────────────────────────────────

describe("soft-delete predicate notDeleted(r) - orgs/{orgId}/comments/{cmtId} (Phase 8)", () => {
  it("client_orgA reads live comment (deletedAt: null) - allow", async () => {
    const db = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertSucceeds(getDoc(doc(db, "orgs/orgA/comments/cLive")));
  });
  it("client_orgA reads soft-deleted comment (deletedAt: <ts>) - deny", async () => {
    const db = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertFails(getDoc(doc(db, "orgs/orgA/comments/cDeleted")));
  });
  it("internal reads soft-deleted comment - deny (notDeleted gates all roles)", async () => {
    const db = asUser(testEnv, "internal", claimsByRole.internal);
    await assertFails(getDoc(doc(db, "orgs/orgA/comments/cDeleted")));
  });
});

// ── Phase 8: orgs/{orgId}/actions/{actId} ──────────────────────────────────

describe("soft-delete predicate notDeleted(r) - orgs/{orgId}/actions/{actId} (Phase 8)", () => {
  it("client_orgA reads live action (deletedAt: null) - allow", async () => {
    const db = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertSucceeds(getDoc(doc(db, "orgs/orgA/actions/aLive")));
  });
  it("client_orgA reads soft-deleted action (deletedAt: <ts>) - deny", async () => {
    const db = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertFails(getDoc(doc(db, "orgs/orgA/actions/aDeleted")));
  });
  it("internal reads soft-deleted action - deny", async () => {
    const db = asUser(testEnv, "internal", claimsByRole.internal);
    await assertFails(getDoc(doc(db, "orgs/orgA/actions/aDeleted")));
  });
});

// ── Phase 8: orgs/{orgId}/documents/{docId} ────────────────────────────────

describe("soft-delete predicate notDeleted(r) - orgs/{orgId}/documents/{docId} (Phase 8)", () => {
  it("client_orgA reads live document (deletedAt: null) - allow", async () => {
    const db = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertSucceeds(getDoc(doc(db, "orgs/orgA/documents/dLive")));
  });
  it("client_orgA reads soft-deleted document (deletedAt: <ts>) - deny", async () => {
    const db = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertFails(getDoc(doc(db, "orgs/orgA/documents/dDeleted")));
  });
  it("internal reads soft-deleted document - deny", async () => {
    const db = asUser(testEnv, "internal", claimsByRole.internal);
    await assertFails(getDoc(doc(db, "orgs/orgA/documents/dDeleted")));
  });
});

// ── Phase 8: orgs/{orgId}/messages/{msgId} ─────────────────────────────────

describe("soft-delete predicate notDeleted(r) - orgs/{orgId}/messages/{msgId} (Phase 8)", () => {
  it("client_orgA reads live message (deletedAt: null) - allow", async () => {
    const db = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertSucceeds(getDoc(doc(db, "orgs/orgA/messages/mLive")));
  });
  it("client_orgA reads soft-deleted message (deletedAt: <ts>) - deny", async () => {
    const db = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertFails(getDoc(doc(db, "orgs/orgA/messages/mDeleted")));
  });
  it("internal reads soft-deleted message - deny", async () => {
    const db = asUser(testEnv, "internal", claimsByRole.internal);
    await assertFails(getDoc(doc(db, "orgs/orgA/messages/mDeleted")));
  });
});

// ── Phase 8: funnelComments/{id} ───────────────────────────────────────────

describe("soft-delete predicate notDeleted(r) - funnelComments/{id} (Phase 8)", () => {
  it("client_orgA reads live funnelComment (deletedAt: null) - allow", async () => {
    const db = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertSucceeds(getDoc(doc(db, "funnelComments/fcLive")));
  });
  it("client_orgA reads soft-deleted funnelComment (deletedAt: <ts>) - deny", async () => {
    const db = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertFails(getDoc(doc(db, "funnelComments/fcDeleted")));
  });
  it("internal reads soft-deleted funnelComment - deny", async () => {
    const db = asUser(testEnv, "internal", claimsByRole.internal);
    await assertFails(getDoc(doc(db, "funnelComments/fcDeleted")));
  });
});
