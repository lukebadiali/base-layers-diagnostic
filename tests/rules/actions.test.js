// tests/rules/actions.test.js
// @ts-check
// 2026-07 client completion: actions live at orgs/{orgId}/actions/{actId}.
// Staff create and fully edit; in-org clients may flip ONLY the completion
// fields (done/completedAt/completedBy/updatedAt) on non-internal actions.
// Internal-flagged actions are invisible to clients; deletes are soft
// (deletedAt tombstone) and hard deletes stay denied for everyone.
import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import { setDoc, doc, getDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { initRulesEnv, asUser, ROLES, assertSucceeds, assertFails } from "./setup.js";

let testEnv;
const claimsByRole = Object.fromEntries(ROLES.map((r) => [r.role, r.claims]));

beforeAll(async () => {
  testEnv = await initRulesEnv("firestore", "actions");
});
afterAll(async () => {
  await testEnv.cleanup();
});
beforeEach(async () => {
  await testEnv.clearFirestore();
});

const actPath = "orgs/orgA/actions/act_1";
const internalActPath = "orgs/orgA/actions/act_internal";
const baseAction = {
  orgId: "orgA",
  pillarId: 1,
  title: "Tighten ICP definition",
  owner: "Jane",
  due: "2026-08-01",
  done: false,
  internal: false,
  createdAt: "2026-07-01T00:00:00.000Z",
  createdBy: "internalUid",
  completedAt: null,
  completedBy: null,
  deletedAt: null,
};

/** Seed an action doc bypassing rules. */
async function seed(path = actPath, overrides = {}) {
  await testEnv.withSecurityRulesDisabled(async (/** @type {*} */ ctx) => {
    await setDoc(doc(ctx.firestore(), path), { ...baseAction, ...overrides });
  });
}

describe("actions — create/delete are staff-only", () => {
  it("internal create -> allow; client create -> deny", async () => {
    const internal = asUser(testEnv, "internal", claimsByRole.internal);
    await assertSucceeds(setDoc(doc(internal, actPath), { ...baseAction }));
    const client = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertFails(
      setDoc(doc(client, "orgs/orgA/actions/act_client"), { ...baseAction }),
    );
  });

  it("internal create with mismatched orgId field -> deny", async () => {
    const internal = asUser(testEnv, "internal", claimsByRole.internal);
    await assertFails(setDoc(doc(internal, actPath), { ...baseAction, orgId: "orgB" }));
  });

  it("hard delete -> deny for both roles (soft-delete only)", async () => {
    await seed();
    const internal = asUser(testEnv, "internal", claimsByRole.internal);
    await assertFails(deleteDoc(doc(internal, actPath)));
    const client = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertFails(deleteDoc(doc(client, actPath)));
  });
});

describe("actions — client completion toggle", () => {
  it("client flips done + completion fields on a non-internal action -> allow", async () => {
    await seed();
    const client = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertSucceeds(
      setDoc(
        doc(client, actPath),
        {
          done: true,
          completedAt: "2026-07-27T00:00:00.000Z",
          completedBy: "client_orgA",
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      ),
    );
  });

  it("client un-completes (toggle back) -> allow", async () => {
    await seed(actPath, { done: true, completedAt: "2026-07-26T00:00:00.000Z" });
    const client = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertSucceeds(
      setDoc(
        doc(client, actPath),
        { done: false, completedAt: null, completedBy: null, updatedAt: serverTimestamp() },
        { merge: true },
      ),
    );
  });

  it("client edits the title -> deny", async () => {
    await seed();
    const client = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertFails(setDoc(doc(client, actPath), { title: "Renamed" }, { merge: true }));
  });

  it("client toggles an internal action -> deny", async () => {
    await seed(internalActPath, { internal: true });
    const client = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertFails(
      setDoc(doc(client, internalActPath), { done: true }, { merge: true }),
    );
  });

  it("client of ANOTHER org toggles -> deny (tenant isolation)", async () => {
    await seed();
    const clientB = asUser(testEnv, "client_orgB", claimsByRole.client_orgB);
    await assertFails(setDoc(doc(clientB, actPath), { done: true }, { merge: true }));
  });

  it("client soft-deletes (writes deletedAt) -> deny", async () => {
    await seed();
    const client = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertFails(
      setDoc(doc(client, actPath), { deletedAt: "2026-07-27T00:00:00.000Z" }, { merge: true }),
    );
  });
});

describe("actions — staff edit surface", () => {
  it("internal edits title/owner/due -> allow", async () => {
    await seed();
    const internal = asUser(testEnv, "internal", claimsByRole.internal);
    await assertSucceeds(
      setDoc(
        doc(internal, actPath),
        { title: "Sharpen ICP", owner: "Bob", due: "2026-09-01", updatedAt: serverTimestamp() },
        { merge: true },
      ),
    );
  });

  it("internal soft-delete via deletedAt -> allow", async () => {
    await seed();
    const internal = asUser(testEnv, "internal", claimsByRole.internal);
    await assertSucceeds(
      setDoc(
        doc(internal, actPath),
        { deletedAt: "2026-07-27T00:00:00.000Z", updatedAt: serverTimestamp() },
        { merge: true },
      ),
    );
  });

  it("internal cannot rewrite createdAt/createdBy/orgId", async () => {
    await seed();
    const internal = asUser(testEnv, "internal", claimsByRole.internal);
    await assertFails(
      setDoc(doc(internal, actPath), { createdBy: "someoneElse" }, { merge: true }),
    );
    await assertFails(setDoc(doc(internal, actPath), { orgId: "orgB" }, { merge: true }));
  });
});

describe("actions — client read surface", () => {
  it("client reads a non-internal action -> allow; internal action -> deny", async () => {
    await seed();
    await seed(internalActPath, { internal: true });
    const client = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertSucceeds(getDoc(doc(client, actPath)));
    await assertFails(getDoc(doc(client, internalActPath)));
  });

  it("client reads a soft-deleted action -> deny", async () => {
    await seed(actPath, { deletedAt: "2026-07-20T00:00:00.000Z" });
    const client = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertFails(getDoc(doc(client, actPath)));
  });
});
