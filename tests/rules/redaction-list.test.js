// tests/rules/redaction-list.test.js
// @ts-check
// Phase 8 Wave 4 (GDPR-05): redactionList/{userId} access matrix.
//
// Rules contract:
//   allow read:  if isAdmin();      — admin can read for backup-rotation
//   allow write: if false;          — server-only via gdprEraseUser callable
//
// 10 tests: 4 roles × 2 ops (read + write deny) + 1 admin read allow + 1 admin write deny
import { doc, getDoc, setDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { initRulesEnv, asUser, ROLES, assertSucceeds, assertFails } from "./setup.js";

let testEnv;
const claimsByRole = Object.fromEntries(ROLES.map((r) => [r.role, r.claims]));

beforeAll(async () => {
  testEnv = await initRulesEnv("firestore", "redaction-list");
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  // Seed a redactionList doc via bypass (server-only write path)
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "redactionList/u-target"), {
      tombstoneToken: "deleted-user-abc123def4567890",
      erasedAt: new Date(),
      erasedBy: "admin-uid",
      schemaVersion: 1,
    });
  });
});

describe("redactionList/{userId} (Phase 8 Wave 4)", () => {
  // Non-admin roles: read denied
  for (const role of ["anonymous", "client_orgA", "client_orgB", "internal"]) {
    it(`${role} cannot read — deny`, async () => {
      const db = asUser(testEnv, role, claimsByRole[role] || {});
      await assertFails(getDoc(doc(db, "redactionList/u-target")));
    });
  }

  // Non-admin roles: write denied
  for (const role of ["anonymous", "client_orgA", "client_orgB", "internal"]) {
    it(`${role} cannot write — deny`, async () => {
      const db = asUser(testEnv, role, claimsByRole[role] || {});
      await assertFails(setDoc(doc(db, "redactionList/u-target"), { tombstoneToken: "x" }));
    });
  }

  // Admin: read allowed
  it("admin reads — allow", async () => {
    const db = asUser(testEnv, "admin", claimsByRole.admin);
    await assertSucceeds(getDoc(doc(db, "redactionList/u-target")));
  });

  // Admin: write denied (server-only via Cloud Function — Pitfall 17)
  it("admin writes — DENY (server-only via gdprEraseUser callable)", async () => {
    const db = asUser(testEnv, "admin", claimsByRole.admin);
    await assertFails(setDoc(doc(db, "redactionList/u-target"), { tombstoneToken: "x" }));
  });
});
