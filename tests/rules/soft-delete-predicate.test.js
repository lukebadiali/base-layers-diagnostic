// tests/rules/soft-delete-predicate.test.js
// @ts-check
// Phase 5 Wave 1 (T-5-08): notDeleted(r) cross-cutting suite. For every
// collection that uses `notDeleted(r)` (Phase 5 only orgs/{orgId} parent uses
// it; Phase 8 extends to comments/messages/etc.), seeding a doc with
// deletedAt:<timestamp> denies reads for non-admin; deletedAt:null allows.
//
// Phase 5 scaffold rows (active):
//   - orgs/{orgId} parent doc
// Future Phase 8 rows (commented out, marked TODO):
//   - orgs/{orgId}/comments/{cmtId}
//   - orgs/{orgId}/messages/{msgId}
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
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
    // members for tenant access
    // (client_orgA can access orgA only; client_orgDeleted token to test the deletedAt branch on its own org)
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

describe("soft-delete predicate notDeleted(r) - orgs/{orgId} (Phase 5)", () => {
  it("client_orgA reads orgA (deletedAt: null) - allow", async () => {
    const db = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertSucceeds(getDoc(doc(db, "orgs/orgA")));
  });
  it("client_orgDeleted reads orgDeleted (deletedAt: <ts>) - deny", async () => {
    // Forge a client whose orgId == "orgDeleted" so tenant predicate would otherwise pass.
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

// TODO Phase 8: extend notDeleted(r) to comments + messages once soft-delete
// covers those collections (BACKUP / soft-delete plan). Rows scaffolded here:
//
// describe('soft-delete predicate notDeleted(r) - orgs/{orgId}/comments/{cmtId} (Phase 8)', () => {
//   it.skip('client_orgA reads soft-deleted comment - deny', () => {});
// });
// describe('soft-delete predicate notDeleted(r) - orgs/{orgId}/messages/{msgId} (Phase 8)', () => {
//   it.skip('client_orgA reads soft-deleted message - deny', () => {});
// });
