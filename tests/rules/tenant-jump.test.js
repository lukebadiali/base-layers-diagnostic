// tests/rules/tenant-jump.test.js
// @ts-check
// Phase 5 Wave 1 (RULES-04): cross-tenant invariant. For every collection
// inside orgs/orgA/*, a client_orgA token writing/reading orgs/orgB/* MUST
// deny on every op. Mirrors tests/rules/firestore.test.js cells but isolates
// the cross-tenant axis as its own dedicated suite (RULES-04 audit narrative).
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from "firebase/firestore";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  it,
} from "vitest";
import { initRulesEnv, asUser, ROLES, assertFails } from "./setup.js";

let testEnv;
const claimsByRole = Object.fromEntries(ROLES.map((r) => [r.role, r.claims]));

const TENANT_JUMP_PATHS = [
  "orgs/orgB",
  "orgs/orgB/responses/r1",
  "orgs/orgB/comments/c1",
  "orgs/orgB/actions/a1",
  "orgs/orgB/documents/d1",
  "orgs/orgB/messages/m1",
  "orgs/orgB/readStates/u_orgB_user",
];
const TENANT_JUMP_OPS = ["read", "create", "update", "delete"];

async function seedOrgB() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const now = Timestamp.now();
    await setDoc(doc(db, "orgs/orgB"), {
      orgId: "orgB",
      name: "Org B",
      createdAt: now,
    });
    await setDoc(doc(db, "orgs/orgB/responses/r1"), {
      orgId: "orgB",
      userId: "u_orgB_user",
      values: {},
      updatedAt: now,
    });
    await setDoc(doc(db, "orgs/orgB/comments/c1"), {
      orgId: "orgB",
      authorId: "u_orgB_user",
      body: "hi",
      internalOnly: false,
      createdAt: now,
    });
    await setDoc(doc(db, "orgs/orgB/actions/a1"), {
      orgId: "orgB",
      title: "x",
      ownerId: "u_orgB_user",
      status: "open",
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, "orgs/orgB/documents/d1"), {
      orgId: "orgB",
      storagePath: "orgs/orgB/documents/d1/x.pdf",
      createdAt: now,
    });
    await setDoc(doc(db, "orgs/orgB/messages/m1"), {
      orgId: "orgB",
      authorId: "u_orgB_user",
      body: "x",
      createdAt: now,
    });
    await setDoc(doc(db, "orgs/orgB/readStates/u_orgB_user"), {
      pillarReads: {},
      chatLastRead: now,
    });
  });
}

beforeAll(async () => {
  testEnv = await initRulesEnv("firestore", "tenant-jump");
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedOrgB();
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

function payloadFor(path) {
  if (path === "orgs/orgB")
    return { orgId: "orgB", name: "x", createdAt: Timestamp.now() };
  if (path.endsWith("/responses/r1"))
    return {
      orgId: "orgB",
      userId: "client_orgA",
      values: {},
      updatedAt: Timestamp.now(),
    };
  if (path.endsWith("/comments/c1"))
    return {
      orgId: "orgB",
      authorId: "client_orgA",
      body: "x",
      internalOnly: false,
      createdAt: Timestamp.now(),
    };
  if (path.endsWith("/actions/a1"))
    return {
      orgId: "orgB",
      title: "x",
      ownerId: "client_orgA",
      status: "open",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
  if (path.endsWith("/documents/d1"))
    return {
      orgId: "orgB",
      storagePath: "orgs/orgB/documents/d1/x.pdf",
      createdAt: Timestamp.now(),
    };
  if (path.endsWith("/messages/m1"))
    return {
      orgId: "orgB",
      authorId: "client_orgA",
      body: "x",
      createdAt: Timestamp.now(),
    };
  if (path.includes("/readStates/"))
    return { pillarReads: {}, chatLastRead: Timestamp.now() };
  return {};
}

describe.each(TENANT_JUMP_PATHS)(
  "client_orgB tenant-jump on %s (RULES-04 cross-tenant deny)",
  (path) => {
    it.each(TENANT_JUMP_OPS)("%s denied", async (op) => {
      const db = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
      const ref = doc(db, path);
      let promise;
      switch (op) {
        case "read":
          promise = getDoc(ref);
          break;
        case "create":
          promise = setDoc(ref, payloadFor(path));
          break;
        case "update":
          promise = updateDoc(ref, { touched: Timestamp.now() });
          break;
        case "delete":
          promise = deleteDoc(ref);
          break;
      }
      await assertFails(promise);
    });
  },
);
