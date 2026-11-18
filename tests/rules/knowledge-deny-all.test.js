// tests/rules/knowledge-deny-all.test.js
// @ts-check
// Client Knowledge Agent: every knowledge collection is server-only. No role,
// admin included, can read or write one client's knowledge (or anyone's) from
// the browser. All access goes through the knowledge callables, which decide
// who may see which client in code (functions/src/knowledge/handlers.ts).
// There is no rule for these paths, so Firestore's default deny applies; this
// test pins that so a later rules change can't open them by accident.
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { initRulesEnv, asUser, ROLES, assertFails } from "./setup.js";

let testEnv;

const DOCS = [
  "knowledgeRecords/orgA__1",
  "knowledgeChunks/orgA__1__0",
  "knowledgeUploads/up1",
  "knowledgeQueries/q1",
  "knowledgeConfig/access",
];
const OPS = ["read", "list", "create", "update", "delete"];

beforeAll(async () => {
  testEnv = await initRulesEnv("firestore", "knowledge");
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const p of DOCS) await setDoc(doc(db, p), { orgId: "orgA", text: "seed" });
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

/** @param {*} db @param {string} path @param {string} op */
function runOp(db, path, op) {
  const ref = doc(db, path);
  switch (op) {
    case "read":
      return getDoc(ref);
    case "list":
      return getDocs(collection(db, path.split("/")[0]));
    case "create":
      return setDoc(doc(db, `${path}-new`), { orgId: "orgA" });
    case "update":
      return updateDoc(ref, { text: "changed" });
    case "delete":
      return deleteDoc(ref);
    default:
      throw new Error(`Unknown op ${op}`);
  }
}

describe("knowledge collections are server-only for every role", () => {
  for (const path of DOCS) {
    for (const { role, claims } of ROLES) {
      for (const op of OPS) {
        it(`${role} ${op} ${path} denied`, async () => {
          await assertFails(runOp(asUser(testEnv, role, claims), path, op));
        });
      }
    }
  }
});
