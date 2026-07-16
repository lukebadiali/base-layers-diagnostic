// tests/rules/responses.test.js
// @ts-check
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

const respId = "r1__clientUidX__1";
const respPath = `orgs/orgA/responses/${respId}`;
const newDoc = (userId) => ({
  orgId: "orgA",
  roundId: "r1",
  userId,
  pillarId: "1",
  values: [{ score: 5 }],
  updatedAt: serverTimestamp(),
});

describe("responses — internal may write another account's answers", () => {
  it("internal create with a NON-self userId -> allow", async () => {
    const db = asUser(testEnv, "internal", claimsByRole.internal);
    await assertSucceeds(setDoc(doc(db, respPath), newDoc("clientUidX")));
  });

  it("client create -> deny (view-only diagnostic)", async () => {
    const db = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertFails(setDoc(doc(db, respPath), newDoc("client_orgA")));
  });

  it("internal cannot write a response in a mismatched-path org tenant field", async () => {
    // orgId field must match the path org; write a doc whose orgId != path.
    const db = asUser(testEnv, "internal", claimsByRole.internal);
    await assertFails(setDoc(doc(db, respPath), { ...newDoc("clientUidX"), orgId: "orgB" }));
  });
});
