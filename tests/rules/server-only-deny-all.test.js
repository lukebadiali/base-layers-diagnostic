// tests/rules/server-only-deny-all.test.js
// @ts-check
// Phase 5 Wave 1 (T-5-06 / AUDIT-07 / D-17): server-only collections
// (auditLog, softDeleted, rateLimits) deny every client role on every op,
// EXCEPT admin reads of auditLog + softDeleted. Nobody writes any of these
// from client-side rules; writes are server-only via Cloud Functions (Phase
// 7). AUDIT-07 specifically: internal CANNOT read auditLog - only admin can.
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
import {
  initRulesEnv,
  asUser,
  ROLES,
  assertSucceeds,
  assertFails,
} from "./setup.js";

let testEnv;
const claimsByRole = Object.fromEntries(ROLES.map((r) => [r.role, r.claims]));

const SERVER_ONLY = [
  // path, allow read for admin? (write: false for everyone)
  { path: "auditLog/e1", adminCanRead: true },
  { path: "softDeleted/comment/items/c1", adminCanRead: true },
  { path: "rateLimits/uClient/buckets/w1", adminCanRead: false }, // deny-all in Phase 5
];

const CLIENT_ROLES = ["anonymous", "client_orgA", "client_orgB", "internal"];
const ALL_OPS = ["read", "create", "update", "delete"];

beforeAll(async () => {
  testEnv = await initRulesEnv("firestore", "server-only");
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const now = Timestamp.now();
    await setDoc(doc(db, "auditLog/e1"), {
      type: "x",
      actorUid: "uA",
      timestamp: now,
    });
    await setDoc(doc(db, "softDeleted/comment/items/c1"), {
      origPath: "x",
      deletedAt: now,
    });
    await setDoc(doc(db, "rateLimits/uClient/buckets/w1"), { count: 0 });
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

async function runOp(db, path, op) {
  const ref = doc(db, path);
  switch (op) {
    case "read":
      return getDoc(ref);
    case "create":
      return setDoc(ref, { x: 1 });
    case "update":
      return updateDoc(ref, { x: 2 });
    case "delete":
      return deleteDoc(ref);
    default:
      throw new Error(`Unknown op ${op}`);
  }
}

describe("server-only collections - non-admin client roles deny on every op", () => {
  for (const { path } of SERVER_ONLY) {
    describe(`path ${path}`, () => {
      for (const role of CLIENT_ROLES) {
        for (const op of ALL_OPS) {
          // AUDIT-07: internal CANNOT read auditLog - only admin can.
          // This is part of the deny matrix - keep as deny here.
          it(`${role} ${op} denied`, async () => {
            const claims = claimsByRole[role] || {};
            const db = asUser(testEnv, role, claims);
            await assertFails(runOp(db, path, op));
          });
        }
      }
    });
  }
});

describe("server-only collections - admin reads auditLog + softDeleted (allow read: if isAdmin())", () => {
  it("admin reads auditLog/e1 (allow)", async () => {
    const db = asUser(testEnv, "admin", claimsByRole.admin);
    await assertSucceeds(getDoc(doc(db, "auditLog/e1")));
  });
  it("admin reads softDeleted/comment/items/c1 (allow)", async () => {
    const db = asUser(testEnv, "admin", claimsByRole.admin);
    await assertSucceeds(getDoc(doc(db, "softDeleted/comment/items/c1")));
  });
  it("admin reads rateLimits/uClient/buckets/w1 (deny - rateLimits is allow read,write: if false in Phase 5)", async () => {
    const db = asUser(testEnv, "admin", claimsByRole.admin);
    await assertFails(getDoc(doc(db, "rateLimits/uClient/buckets/w1")));
  });
});

describe("server-only collections - nobody (including admin) writes via client rules", () => {
  for (const { path } of SERVER_ONLY) {
    for (const op of ["create", "update", "delete"]) {
      it(`admin ${op} on ${path} denied (server-only via Cloud Function)`, async () => {
        const db = asUser(testEnv, "admin", claimsByRole.admin);
        await assertFails(runOp(db, path, op));
      });
    }
  }
});
