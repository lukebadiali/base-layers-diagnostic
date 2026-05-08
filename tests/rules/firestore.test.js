// tests/rules/firestore.test.js
// @ts-check
// Phase 5 Wave 1 (D-14 / D-16): table-driven role x collection x op matrix
// against firestore.rules running in the local Firestore emulator.
//
// Roles (per D-16 ROLES table in tests/rules/setup.js):
//   anonymous, client_orgA, client_orgB, internal, admin
//
// Collections in scope (D-17): orgs/{orgId} + 6 subcollections + users +
// internalAllowlist + auditLog + softDeleted + rateLimits + roadmaps + funnels
// + funnelComments. Every cell asserts the documented allow/deny outcome via
// assertSucceeds / assertFails.
//
// Pitfall 1 closure: rules are NOT cascading - every subcollection match block
// has its own predicates; matrix exercises every branch.
// Pitfall 2 closure: anonymous role denied on every read/write across every
// collection (isAuthed() requires sign_in_provider != "anonymous").
// Pitfall 3 closure: mass-assignment cell asserts client_orgA cannot add a
// `role: admin` field to an existing actions doc.
// AUDIT-07 (D-17): internal role CANNOT read auditLog - only admin can.
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

/**
 * Seed the canonical fixture set used by every test. Uses
 * withSecurityRulesDisabled so seed writes are not subject to rules.
 */
async function seedFixtures() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const now = Timestamp.now();

    // Parent org docs
    await setDoc(doc(db, "orgs/orgA"), {
      orgId: "orgA",
      name: "Org A",
      createdAt: now,
    });
    await setDoc(doc(db, "orgs/orgB"), {
      orgId: "orgB",
      name: "Org B",
      createdAt: now,
    });

    // Subcollection fixtures under orgs/orgA
    await setDoc(doc(db, "orgs/orgA/responses/r1"), {
      orgId: "orgA",
      userId: "u_orgA_user",
      values: { p1: 3 },
      updatedAt: now,
    });
    await setDoc(doc(db, "orgs/orgA/comments/c1"), {
      orgId: "orgA",
      authorId: "u_orgA_user",
      body: "hello",
      internalOnly: false,
      createdAt: now,
    });
    await setDoc(doc(db, "orgs/orgA/comments/cInternal"), {
      orgId: "orgA",
      authorId: "u_orgA_user",
      body: "internal note",
      internalOnly: true,
      createdAt: now,
    });
    await setDoc(doc(db, "orgs/orgA/actions/a1"), {
      orgId: "orgA",
      title: "Action 1",
      description: "desc",
      ownerId: "u_orgA_user",
      status: "open",
      createdAt: now,
      updatedAt: now,
    });
    await setDoc(doc(db, "orgs/orgA/documents/d1"), {
      orgId: "orgA",
      storagePath: "orgs/orgA/documents/d1/foo.pdf",
      createdAt: now,
    });
    await setDoc(doc(db, "orgs/orgA/messages/m1"), {
      orgId: "orgA",
      authorId: "u_orgA_user",
      body: "hi",
      createdAt: now,
    });
    await setDoc(doc(db, "orgs/orgA/readStates/u_orgA_user"), {
      pillarReads: {},
      chatLastRead: now,
    });
    await setDoc(doc(db, "orgs/orgA/readStates/u_other_user"), {
      pillarReads: {},
      chatLastRead: now,
    });

    // Top-level fixtures
    await setDoc(doc(db, "users/uClient"), {
      role: "client",
      orgId: "orgA",
      email: "client@example.com",
    });
    await setDoc(doc(db, "users/uOther"), {
      role: "client",
      orgId: "orgB",
      email: "other@example.com",
    });
    await setDoc(doc(db, "internalAllowlist/test@bedeveloped.com"), {
      addedAt: now,
    });
    await setDoc(doc(db, "auditLog/e1"), {
      type: "role.change",
      actorUid: "uAdmin",
      timestamp: now,
    });
    await setDoc(doc(db, "softDeleted/comment/items/c1"), {
      origPath: "orgs/orgA/comments/c1",
      deletedAt: now,
    });
    await setDoc(doc(db, "rateLimits/uClientA/buckets/w1"), { count: 0 });
    await setDoc(doc(db, "roadmaps/orgA"), {
      orgId: "orgA",
      pillars: {},
      updatedAt: now,
    });
    await setDoc(doc(db, "funnels/orgA"), {
      orgId: "orgA",
      stages: {},
      updatedAt: now,
    });
    await setDoc(doc(db, "funnelComments/fc1"), {
      orgId: "orgA",
      authorId: "u_orgA_user",
      body: "fc body",
      createdAt: now,
    });
  });
}

beforeAll(async () => {
  testEnv = await initRulesEnv("firestore", "fs-matrix");
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedFixtures();
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

// -------- Cell helpers --------

/**
 * Build a doc payload appropriate for create-tests of the given path.
 * Encodes "valid create" shape per D-15/D-17.
 */
function createPayload(role, path) {
  const uid = role === "anonymous" ? null : role;
  if (path === "orgs/orgA")
    return { orgId: "orgA", name: "Org A new", createdAt: Timestamp.now() };
  if (path === "orgs/orgA/responses/r2")
    return {
      orgId: "orgA",
      userId: uid,
      values: { p1: 4 },
      updatedAt: Timestamp.now(),
    };
  if (path === "orgs/orgA/comments/c2")
    return {
      orgId: "orgA",
      authorId: uid,
      body: "new comment",
      internalOnly: false,
      createdAt: Timestamp.now(),
    };
  if (path === "orgs/orgA/actions/a2")
    return {
      orgId: "orgA",
      title: "A2",
      description: "d",
      ownerId: uid,
      status: "open",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };
  if (path === "orgs/orgA/documents/d2")
    return {
      orgId: "orgA",
      storagePath: "orgs/orgA/documents/d2/foo.pdf",
      createdAt: Timestamp.now(),
    };
  if (path === "orgs/orgA/messages/m2")
    return {
      orgId: "orgA",
      authorId: uid,
      body: "msg",
      createdAt: Timestamp.now(),
    };
  if (path === "orgs/orgA/readStates/u_orgA_user")
    return { pillarReads: {}, chatLastRead: Timestamp.now() };
  if (path.startsWith("users/"))
    return { role: "client", orgId: "orgA", email: "x@y" };
  if (path.startsWith("internalAllowlist/")) return { addedAt: Timestamp.now() };
  if (path.startsWith("auditLog/"))
    return { type: "x", actorUid: uid, timestamp: Timestamp.now() };
  if (path.startsWith("softDeleted/"))
    return { origPath: "x", deletedAt: Timestamp.now() };
  if (path.startsWith("rateLimits/")) return { count: 0 };
  if (path.startsWith("roadmaps/"))
    return { orgId: path.split("/")[1], pillars: {}, updatedAt: Timestamp.now() };
  if (path.startsWith("funnels/"))
    return { orgId: path.split("/")[1], stages: {}, updatedAt: Timestamp.now() };
  if (path.startsWith("funnelComments/"))
    return {
      orgId: "orgA",
      authorId: uid,
      body: "fc",
      createdAt: Timestamp.now(),
    };
  return { _placeholder: true };
}

/**
 * Build an update payload for the given path. The "mass-assignment" variant
 * adds a forbidden field (e.g. role: admin) to test mutableOnly + immutable.
 */
function updatePayload(path, opts = {}) {
  if (opts.massAssignment) {
    // Mass-assignment cell - try to inject role:admin into an actions doc.
    return { role: "admin" };
  }
  if (path === "orgs/orgA")
    return { name: "Org A renamed", updatedAt: Timestamp.now() };
  if (path === "orgs/orgA/actions/a1")
    return { status: "done", updatedAt: Timestamp.now() };
  if (path === "orgs/orgA/responses/r1")
    return { values: { p1: 5 }, updatedAt: Timestamp.now() };
  if (path === "orgs/orgA/readStates/u_orgA_user")
    return { chatLastRead: Timestamp.now() };
  if (path.startsWith("roadmaps/"))
    return { pillars: { p1: 1 }, updatedAt: Timestamp.now() };
  if (path.startsWith("funnels/"))
    return { stages: { s1: 1 }, updatedAt: Timestamp.now() };
  return { touched: Timestamp.now() };
}

/**
 * Run a single cell - dispatches read/create/update/delete to the right
 * Firestore call and asserts allow or deny.
 */
async function runCell({ role, path, op, expected, opts = {} }) {
  const claims = claimsByRole[role] || {};
  const db = asUser(testEnv, role, claims);
  const ref = doc(db, path);
  let promise;
  switch (op) {
    case "read":
      promise = getDoc(ref);
      break;
    case "create":
      promise = setDoc(ref, createPayload(role, path));
      break;
    case "update":
      promise = updateDoc(ref, updatePayload(path, opts));
      break;
    case "delete":
      promise = deleteDoc(ref);
      break;
    default:
      throw new Error(`Unknown op: ${op}`);
  }
  if (expected === "allow") {
    await assertSucceeds(promise);
  } else {
    await assertFails(promise);
  }
}

// -------- Matrix cells (D-16 D-17) --------

const CELLS = [
  // anonymous - denied on every read across every collection (Pitfall 2)
  { role: "anonymous", path: "orgs/orgA", op: "read", expected: "deny" },
  {
    role: "anonymous",
    path: "orgs/orgA/comments/c1",
    op: "read",
    expected: "deny",
  },
  { role: "anonymous", path: "users/uClient", op: "read", expected: "deny" },
  { role: "anonymous", path: "auditLog/e1", op: "read", expected: "deny" },
  { role: "anonymous", path: "rateLimits/u/buckets/w", op: "read", expected: "deny" },
  { role: "anonymous", path: "roadmaps/orgA", op: "read", expected: "deny" },

  // orgs/orgA parent doc
  { role: "client_orgA", path: "orgs/orgA", op: "read", expected: "allow" },
  { role: "client_orgB", path: "orgs/orgA", op: "read", expected: "deny" }, // tenant-isolation
  { role: "internal", path: "orgs/orgA", op: "read", expected: "allow" },
  { role: "admin", path: "orgs/orgA", op: "read", expected: "allow" },
  { role: "client_orgA", path: "orgs/orgA", op: "create", expected: "deny" }, // parent doc internal-only create
  { role: "internal", path: "orgs/orgA-new", op: "create", expected: "allow" },
  { role: "admin", path: "orgs/orgA-new2", op: "create", expected: "allow" },
  { role: "client_orgA", path: "orgs/orgA", op: "delete", expected: "deny" }, // soft-delete via Cloud Function only
  { role: "internal", path: "orgs/orgA", op: "delete", expected: "deny" }, // delete: false for everyone

  // orgs/orgA/responses/{respId}
  {
    role: "client_orgA",
    path: "orgs/orgA/responses/r2",
    op: "create",
    expected: "allow",
  }, // userId = uid
  {
    role: "client_orgA",
    path: "orgs/orgA/responses/r1",
    op: "read",
    expected: "allow",
  },
  {
    role: "client_orgB",
    path: "orgs/orgA/responses/r1",
    op: "read",
    expected: "deny",
  },
  {
    role: "client_orgA",
    path: "orgs/orgA/responses/r1",
    op: "update",
    expected: "allow",
  },
  {
    role: "client_orgA",
    path: "orgs/orgA/responses/r1",
    op: "delete",
    expected: "deny",
  },

  // orgs/orgA/comments/{cmtId}
  {
    role: "client_orgA",
    path: "orgs/orgA/comments/c2",
    op: "create",
    expected: "allow",
  }, // authorId = uid
  {
    role: "client_orgA",
    path: "orgs/orgA/comments/c1",
    op: "update",
    expected: "deny",
  }, // immutable
  {
    role: "client_orgA",
    path: "orgs/orgA/comments/cInternal",
    op: "read",
    expected: "deny",
  },
  {
    role: "internal",
    path: "orgs/orgA/comments/cInternal",
    op: "read",
    expected: "allow",
  },
  {
    role: "admin",
    path: "orgs/orgA/comments/cInternal",
    op: "read",
    expected: "allow",
  },
  {
    role: "client_orgA",
    path: "orgs/orgA/comments/c1",
    op: "delete",
    expected: "deny",
  },

  // orgs/orgA/actions/{actId}
  {
    role: "client_orgA",
    path: "orgs/orgA/actions/a2",
    op: "create",
    expected: "allow",
  },
  {
    role: "client_orgA",
    path: "orgs/orgA/actions/a1",
    op: "update",
    expected: "allow",
  }, // status flip
  {
    role: "client_orgB",
    path: "orgs/orgA/actions/a1",
    op: "update",
    expected: "deny",
  },
  // Mass-assignment cell (Pitfall 3 closure) - tries to add role:admin field
  {
    role: "client_orgA",
    path: "orgs/orgA/actions/a1",
    op: "update",
    expected: "deny",
    opts: { massAssignment: true },
    label: "mass-assignment role:admin denied",
  },

  // orgs/orgA/documents/{docId}
  {
    role: "client_orgA",
    path: "orgs/orgA/documents/d2",
    op: "create",
    expected: "allow",
  },
  {
    role: "client_orgA",
    path: "orgs/orgA/documents/d1",
    op: "read",
    expected: "allow",
  },
  {
    role: "client_orgA",
    path: "orgs/orgA/documents/d1",
    op: "update",
    expected: "deny",
  },
  {
    role: "client_orgA",
    path: "orgs/orgA/documents/d1",
    op: "delete",
    expected: "deny",
  },

  // orgs/orgA/messages/{msgId}
  {
    role: "client_orgA",
    path: "orgs/orgA/messages/m2",
    op: "create",
    expected: "allow",
  }, // authorId = uid
  {
    role: "client_orgA",
    path: "orgs/orgA/messages/m1",
    op: "update",
    expected: "deny",
  },
  {
    role: "client_orgA",
    path: "orgs/orgA/messages/m1",
    op: "delete",
    expected: "deny",
  },

  // orgs/orgA/readStates/{userId}
  {
    role: "client_orgA",
    path: "orgs/orgA/readStates/client_orgA",
    op: "create",
    expected: "allow",
  }, // own readState
  {
    role: "client_orgA",
    path: "orgs/orgA/readStates/u_other_user",
    op: "read",
    expected: "deny",
  }, // cross-user readState
  {
    role: "client_orgA",
    path: "orgs/orgA/readStates/u_orgA_user",
    op: "read",
    expected: "deny",
  }, // not own
  {
    role: "internal",
    path: "orgs/orgA/readStates/u_orgA_user",
    op: "read",
    expected: "allow",
  }, // internal can read any

  // users/{uid}
  { role: "client_orgA", path: "users/uOther", op: "read", expected: "deny" },
  { role: "internal", path: "users/uClient", op: "read", expected: "allow" },
  { role: "admin", path: "users/uClient", op: "read", expected: "allow" },
  { role: "client_orgA", path: "users/uOther", op: "create", expected: "deny" },
  { role: "internal", path: "users/uNew", op: "create", expected: "deny" }, // server-only

  // internalAllowlist/{email}
  {
    role: "admin",
    path: "internalAllowlist/test@bedeveloped.com",
    op: "read",
    expected: "allow",
  },
  {
    role: "client_orgA",
    path: "internalAllowlist/test@bedeveloped.com",
    op: "read",
    expected: "deny",
  },
  {
    role: "internal",
    path: "internalAllowlist/test@bedeveloped.com",
    op: "read",
    expected: "deny",
  },
  {
    role: "admin",
    path: "internalAllowlist/new@bedeveloped.com",
    op: "create",
    expected: "allow",
  },

  // auditLog/{eventId} - AUDIT-07: internal CANNOT read; only admin
  { role: "internal", path: "auditLog/e1", op: "read", expected: "deny" },
  { role: "admin", path: "auditLog/e1", op: "read", expected: "allow" },
  { role: "client_orgA", path: "auditLog/e1", op: "read", expected: "deny" },
  { role: "admin", path: "auditLog/e2", op: "create", expected: "deny" }, // server-only writes

  // softDeleted/{type}/items/{id}
  {
    role: "admin",
    path: "softDeleted/comment/items/c1",
    op: "read",
    expected: "allow",
  },
  {
    role: "client_orgA",
    path: "softDeleted/comment/items/c1",
    op: "read",
    expected: "deny",
  },
  {
    role: "internal",
    path: "softDeleted/comment/items/c1",
    op: "read",
    expected: "deny",
  },
  {
    role: "admin",
    path: "softDeleted/comment/items/c2",
    op: "create",
    expected: "deny",
  }, // server-only

  // rateLimits/{uid}/buckets/{windowStart} - deny-all in Phase 5
  {
    role: "client_orgA",
    path: "rateLimits/uClientA/buckets/w1",
    op: "read",
    expected: "deny",
  },
  {
    role: "client_orgA",
    path: "rateLimits/uClientA/buckets/w1",
    op: "create",
    expected: "deny",
  },
  {
    role: "admin",
    path: "rateLimits/uClientA/buckets/w1",
    op: "read",
    expected: "deny",
  },

  // roadmaps/{orgId}
  { role: "client_orgA", path: "roadmaps/orgA", op: "read", expected: "allow" },
  { role: "client_orgB", path: "roadmaps/orgA", op: "read", expected: "deny" },
  {
    role: "client_orgA",
    path: "roadmaps/orgA",
    op: "update",
    expected: "allow",
  },

  // funnels/{orgId}
  { role: "client_orgA", path: "funnels/orgA", op: "read", expected: "allow" },
  { role: "client_orgA", path: "funnels/orgB", op: "create", expected: "deny" },
  { role: "client_orgA", path: "funnels/orgA", op: "update", expected: "allow" },

  // funnelComments/{id} - orgId field on doc
  {
    role: "client_orgA",
    path: "funnelComments/fc2",
    op: "create",
    expected: "allow",
  }, // orgId/authorId match
  {
    role: "client_orgA",
    path: "funnelComments/fc1",
    op: "read",
    expected: "allow",
  },
  {
    role: "client_orgB",
    path: "funnelComments/fc1",
    op: "read",
    expected: "deny",
  },
  {
    role: "client_orgA",
    path: "funnelComments/fc1",
    op: "update",
    expected: "deny",
  },
];

describe.each(CELLS)(
  "rules matrix: $role $op $path -> $expected",
  (cell) => {
    it(cell.label || `${cell.expected}s`, async () => {
      await runCell(cell);
    });
  },
);
