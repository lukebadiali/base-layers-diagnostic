// tests/rules/responses.test.js
// @ts-check
// 2026-07 org-level re-shift: response docs are keyed roundId__pillarId with
// no userId subject field — one shared sheet per org per round. Writes stay
// staff-only; clients read prior scoring but never submit or edit it.
import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import { setDoc, doc, serverTimestamp } from "firebase/firestore";
import { initRulesEnv, asUser, ROLES, assertSucceeds, assertFails } from "./setup.js";

let testEnv;
const claimsByRole = Object.fromEntries(ROLES.map((r) => [r.role, r.claims]));

beforeAll(async () => {
  testEnv = await initRulesEnv("firestore", "responses");
});
afterAll(async () => {
  await testEnv.cleanup();
});
beforeEach(async () => {
  await testEnv.clearFirestore();
});

const respId = "r1__1";
const respPath = `orgs/orgA/responses/${respId}`;
const newDoc = () => ({
  orgId: "orgA",
  roundId: "r1",
  pillarId: "1",
  values: [{ score: 5 }],
  updatedAt: serverTimestamp(),
});

describe("responses — org-level sheet, staff-only writes", () => {
  it("internal create of the org-level (round, pillar) doc -> allow", async () => {
    const db = asUser(testEnv, "internal", claimsByRole.internal);
    await assertSucceeds(setDoc(doc(db, respPath), newDoc()));
  });

  it("client create -> deny (view-only diagnostic)", async () => {
    const db = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertFails(setDoc(doc(db, respPath), newDoc()));
  });

  it("internal cannot write a response in a mismatched-path org tenant field", async () => {
    // orgId field must match the path org; write a doc whose orgId != path.
    const db = asUser(testEnv, "internal", claimsByRole.internal);
    await assertFails(setDoc(doc(db, respPath), { ...newDoc(), orgId: "orgB" }));
  });

  it("internal update of values -> allow; client update -> deny", async () => {
    await testEnv.withSecurityRulesDisabled(async (/** @type {*} */ ctx) => {
      await setDoc(doc(ctx.firestore(), respPath), { ...newDoc(), updatedAt: null });
    });
    const internal = asUser(testEnv, "internal", claimsByRole.internal);
    await assertSucceeds(
      setDoc(
        doc(internal, respPath),
        { values: [{ score: 3 }], updatedAt: serverTimestamp() },
        { merge: true },
      ),
    );
    const client = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertFails(
      setDoc(
        doc(client, respPath),
        { values: [{ score: 1 }], updatedAt: serverTimestamp() },
        { merge: true },
      ),
    );
  });

  it("internal update touching a field outside values/updatedAt -> deny", async () => {
    await testEnv.withSecurityRulesDisabled(async (/** @type {*} */ ctx) => {
      await setDoc(doc(ctx.firestore(), respPath), { ...newDoc(), updatedAt: null });
    });
    const internal = asUser(testEnv, "internal", claimsByRole.internal);
    await assertFails(
      setDoc(doc(internal, respPath), { roundId: "r2" }, { merge: true }),
    );
  });
});
