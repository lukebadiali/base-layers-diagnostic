// tests/rules/org-secrets.test.js
// @ts-check
// orgSecrets/{orgId} access matrix — the staff-only plaintext company
// passphrase. Rules contract:
//   allow read/create/update: if isInternal();   allow delete: if false;
// The load-bearing case: a client of the SAME org (client_orgA reading
// orgSecrets/orgA) MUST be denied — the whole point is that the plaintext
// never reaches a client browser.
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { initRulesEnv, asUser, ROLES, assertSucceeds, assertFails } from "./setup.js";

let testEnv;
const claimsByRole = Object.fromEntries(ROLES.map((r) => [r.role, r.claims]));

beforeAll(async () => {
  testEnv = await initRulesEnv("firestore", "org-secrets");
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "orgSecrets/orgA"), {
      passphrase: "correct horse battery",
      updatedAt: new Date(),
    });
  });
});

describe("orgSecrets/{orgId} (staff-only plaintext passphrase)", () => {
  // Clients (even of the same org) + anonymous: read denied.
  for (const role of ["anonymous", "client_orgA", "client_orgB"]) {
    it(`${role} cannot read — deny`, async () => {
      const db = asUser(testEnv, role, claimsByRole[role] || {});
      await assertFails(getDoc(doc(db, "orgSecrets/orgA")));
    });
  }

  // Clients + anonymous: write denied.
  for (const role of ["anonymous", "client_orgA", "client_orgB"]) {
    it(`${role} cannot write — deny`, async () => {
      const db = asUser(testEnv, role, claimsByRole[role] || {});
      await assertFails(
        setDoc(doc(db, "orgSecrets/orgA"), { passphrase: "x", updatedAt: new Date() }),
      );
    });
  }

  // Internal + admin: read + write allowed.
  for (const role of ["internal", "admin"]) {
    it(`${role} can read — allow`, async () => {
      const db = asUser(testEnv, role, claimsByRole[role]);
      await assertSucceeds(getDoc(doc(db, "orgSecrets/orgA")));
    });
    it(`${role} can write — allow`, async () => {
      const db = asUser(testEnv, role, claimsByRole[role]);
      await assertSucceeds(
        setDoc(doc(db, "orgSecrets/orgB"), { passphrase: "new one here", updatedAt: new Date() }),
      );
    });
  }

  // Delete is forbidden for everyone (matches the other server-owned collections).
  it("admin cannot delete — deny", async () => {
    const db = asUser(testEnv, "admin", claimsByRole.admin);
    await assertFails(deleteDoc(doc(db, "orgSecrets/orgA")));
  });
});
