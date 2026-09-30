// tests/rules/folders.test.js
// @ts-check
// Milestone v6 (FILE-01..FILE-04, FILE-06): the nested folder tree over an org's
// documents, and the one-field widening of the documents update rule.
//
// Two things this file is deliberately explicit about:
//
//   1. What the rules DO enforce — tenancy, internal-only creation and
//      renaming, an immutable orgId, no hard deletes.
//   2. What they CANNOT enforce — cycle prevention and the depth cap. A rule
//      sees one document and the request touching it; it cannot walk a
//      parentId chain. Those guards live in src/domain/folder-tree.js and are
//      proved in tests/domain/folder-tree.test.js. The case at the bottom of
//      this file asserts the gap rather than pretending it is closed, so
//      nobody reads a green rules suite as covering it.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setDoc,
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { initRulesEnv, asUser, ROLES, assertSucceeds, assertFails } from "./setup.js";

let testEnv;
const claimsByRole = Object.fromEntries(ROLES.map((r) => [r.role, r.claims]));

beforeAll(async () => {
  testEnv = await initRulesEnv("firestore", "folders");
});
afterAll(async () => {
  await testEnv.cleanup();
});
beforeEach(async () => {
  await testEnv.clearFirestore();
});

const folderPath = "orgs/orgA/folders/f_root";
const childPath = "orgs/orgA/folders/f_child";
const docPath = "orgs/orgA/documents/d1";

const baseFolder = {
  id: "f_root",
  orgId: "orgA",
  name: "Board pack",
  parentId: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  createdBy: "internal",
  deletedAt: null,
};

const baseDocument = {
  orgId: "orgA",
  uploaderId: "internal",
  uploaderName: "Luke",
  filename: "pack.pdf",
  size: 1024,
  contentType: "application/pdf",
  storagePath: "orgs/orgA/documents/d1/pack.pdf",
  folderId: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  deletedAt: null,
};

/** Seed a doc bypassing rules. */
async function seed(path, data) {
  await testEnv.withSecurityRulesDisabled(async (/** @type {*} */ ctx) => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

describe("folders — creation is internal-only", () => {
  it("internal creates a root folder -> allow", async () => {
    const internal = asUser(testEnv, "internal", claimsByRole.internal);
    await assertSucceeds(setDoc(doc(internal, folderPath), { ...baseFolder }));
  });

  it("internal creates a nested folder -> allow", async () => {
    await seed(folderPath, baseFolder);
    const internal = asUser(testEnv, "internal", claimsByRole.internal);
    await assertSucceeds(
      setDoc(doc(internal, childPath), {
        ...baseFolder,
        id: "f_child",
        name: "Q3",
        parentId: "f_root",
      }),
    );
  });

  it("client creates a folder -> deny", async () => {
    const client = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertFails(setDoc(doc(client, folderPath), { ...baseFolder }));
  });

  it("internal creates a folder with a mismatched orgId field -> deny", async () => {
    const internal = asUser(testEnv, "internal", claimsByRole.internal);
    await assertFails(setDoc(doc(internal, folderPath), { ...baseFolder, orgId: "orgB" }));
  });
});

describe("folders — renaming and moving", () => {
  it("internal renames a folder -> allow", async () => {
    await seed(folderPath, baseFolder);
    const internal = asUser(testEnv, "internal", claimsByRole.internal);
    await assertSucceeds(
      setDoc(
        doc(internal, folderPath),
        { name: "Renamed", updatedAt: serverTimestamp() },
        { merge: true },
      ),
    );
  });

  it("internal moves a folder by changing parentId -> allow", async () => {
    await seed(folderPath, baseFolder);
    await seed(childPath, { ...baseFolder, id: "f_child", parentId: "f_root" });
    const internal = asUser(testEnv, "internal", claimsByRole.internal);
    await assertSucceeds(
      setDoc(
        doc(internal, childPath),
        { parentId: null, updatedAt: serverTimestamp() },
        { merge: true },
      ),
    );
  });

  it("client renames a folder -> deny", async () => {
    await seed(folderPath, baseFolder);
    const client = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertFails(setDoc(doc(client, folderPath), { name: "Renamed" }, { merge: true }));
  });

  it("nobody rewrites orgId, createdAt or createdBy", async () => {
    await seed(folderPath, baseFolder);
    const internal = asUser(testEnv, "internal", claimsByRole.internal);
    await assertFails(setDoc(doc(internal, folderPath), { orgId: "orgB" }, { merge: true }));
    await assertFails(
      setDoc(doc(internal, folderPath), { createdBy: "someoneElse" }, { merge: true }),
    );
    await assertFails(
      setDoc(doc(internal, folderPath), { createdAt: "2020-01-01T00:00:00.000Z" }, { merge: true }),
    );
  });
});

describe("folders — reading and tenancy", () => {
  it("a client in the org reads a folder -> allow", async () => {
    await seed(folderPath, baseFolder);
    const client = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertSucceeds(getDoc(doc(client, folderPath)));
  });

  it("a client in ANOTHER org reads a folder -> deny", async () => {
    await seed(folderPath, baseFolder);
    const clientB = asUser(testEnv, "client_orgB", claimsByRole.client_orgB);
    await assertFails(getDoc(doc(clientB, folderPath)));
  });

  it("a client in ANOTHER org creates a folder in this org -> deny", async () => {
    const clientB = asUser(testEnv, "client_orgB", claimsByRole.client_orgB);
    await assertFails(setDoc(doc(clientB, folderPath), { ...baseFolder }));
  });

  it("a soft-deleted folder is unreadable", async () => {
    await seed(folderPath, { ...baseFolder, deletedAt: Timestamp.now() });
    const internal = asUser(testEnv, "internal", claimsByRole.internal);
    await assertFails(getDoc(doc(internal, folderPath)));
  });
});

describe("folders — deletion is soft-only", () => {
  it("hard delete -> deny for both roles", async () => {
    await seed(folderPath, baseFolder);
    const internal = asUser(testEnv, "internal", claimsByRole.internal);
    await assertFails(deleteDoc(doc(internal, folderPath)));
    const client = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertFails(deleteDoc(doc(client, folderPath)));
  });

  it("nobody writes a deletedAt tombstone directly — not even internal", async () => {
    // Soft-delete goes through the callable, which writes the tombstone AND
    // the restore snapshot in one batch. A folder tombstoned by a direct write
    // would have no snapshot behind it: invisible in the UI and un-restorable
    // inside the 30-day window docs/RETENTION.md promises. The callable uses
    // the Admin SDK and bypasses rules, so the legitimate path is unaffected.
    await seed(folderPath, baseFolder);
    const internal = asUser(testEnv, "internal", claimsByRole.internal);
    await assertFails(
      setDoc(doc(internal, folderPath), { deletedAt: Timestamp.now() }, { merge: true }),
    );
    const client = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertFails(
      setDoc(doc(client, folderPath), { deletedAt: Timestamp.now() }, { merge: true }),
    );
  });

  it("an arbitrary new field cannot be smuggled onto a folder", async () => {
    await seed(folderPath, baseFolder);
    const internal = asUser(testEnv, "internal", claimsByRole.internal);
    await assertFails(setDoc(doc(internal, folderPath), { storagePath: "x" }, { merge: true }));
  });
});

describe("documents — the folderId widening (FILE-03)", () => {
  it("internal refiles a document by changing folderId -> allow", async () => {
    await seed(docPath, baseDocument);
    await seed(folderPath, baseFolder);
    const internal = asUser(testEnv, "internal", claimsByRole.internal);
    await assertSucceeds(
      setDoc(
        doc(internal, docPath),
        { folderId: "f_root", updatedAt: serverTimestamp() },
        { merge: true },
      ),
    );
  });

  it("a client refiles a document -> deny", async () => {
    await seed(docPath, baseDocument);
    const client = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertFails(setDoc(doc(client, docPath), { folderId: "f_root" }, { merge: true }));
  });

  it("storagePath stays immutable for everyone", async () => {
    // The one that matters. A writable storagePath would let a metadata row be
    // repointed at another org's object, after which a signed URL for it is
    // one callable away.
    await seed(docPath, baseDocument);
    const internal = asUser(testEnv, "internal", claimsByRole.internal);
    await assertFails(
      setDoc(
        doc(internal, docPath),
        { storagePath: "orgs/orgB/documents/x/secret.pdf" },
        { merge: true },
      ),
    );
    const client = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertFails(
      setDoc(
        doc(client, docPath),
        { storagePath: "orgs/orgB/documents/x/secret.pdf" },
        { merge: true },
      ),
    );
  });

  it("filename, size and uploader stay immutable", async () => {
    await seed(docPath, baseDocument);
    const internal = asUser(testEnv, "internal", claimsByRole.internal);
    await assertFails(setDoc(doc(internal, docPath), { filename: "other.pdf" }, { merge: true }));
    await assertFails(setDoc(doc(internal, docPath), { size: 1 }, { merge: true }));
    await assertFails(
      setDoc(doc(internal, docPath), { uploaderId: "someoneElse" }, { merge: true }),
    );
  });

  it("a folderId change bundled with a filename change -> deny", async () => {
    await seed(docPath, baseDocument);
    const internal = asUser(testEnv, "internal", claimsByRole.internal);
    await assertFails(
      setDoc(
        doc(internal, docPath),
        { folderId: "f_root", filename: "other.pdf" },
        { merge: true },
      ),
    );
  });

  it("a client can still upload into a folder (create carries folderId)", async () => {
    await seed(folderPath, baseFolder);
    const client = asUser(testEnv, "client_orgA", claimsByRole.client_orgA);
    await assertSucceeds(
      setDoc(doc(client, "orgs/orgA/documents/d_new"), { ...baseDocument, folderId: "f_root" }),
    );
  });
});

describe("documents — what the constrained list query actually guarantees", () => {
  // WHAT THIS BLOCK ORIGINALLY ASSERTED, AND WHY IT WAS WRONG.
  //
  // The pre-v6 listener queried the whole documents collection with no
  // constraint, while the read rule tests notDeleted(resource.data). The
  // documented Firestore model is that rules are not filters: a `list` is
  // refused unless the query itself guarantees every match passes. On that
  // reading, one soft-deleted file was breaking the entire document list for
  // an org — and this file originally asserted that refusal.
  //
  // It does not happen. Against the emulator the unconstrained query SUCCEEDS.
  // So the "live production bug" that reading implied is unconfirmed, and any
  // claim of one has been withdrawn.
  //
  // Two caveats worth keeping, because neither is settled by the above:
  //   1. The emulator is known to be more permissive than production on list
  //      evaluation. Emulator success is not proof of production success.
  //   2. It changes nothing about what the app should do. A constrained query
  //      is correct under either behaviour, and the `deletedAt == null` filter
  //      is what keeps tombstoned files out of the list rather than relying on
  //      per-document rule evaluation to do it.
  //
  // So the cases below assert the app's actual contract — what the constrained
  // query returns — rather than a Firestore implementation detail.
  beforeEach(async () => {
    await seed("orgs/orgA/documents/live", baseDocument);
    await seed("orgs/orgA/documents/gone", { ...baseDocument, deletedAt: Timestamp.now() });
  });

  it("a constrained query returns the live document and not the tombstone", async () => {
    const internal = asUser(testEnv, "internal", claimsByRole.internal);
    const snap = await assertSucceeds(
      getDocs(query(collection(internal, "orgs/orgA/documents"), where("deletedAt", "==", null))),
    );
    expect(snap.docs.map((/** @type {*} */ d) => d.id)).toEqual(["live"]);
  });

  it("a document with NO deletedAt field is excluded — which is why the backfill exists", async () => {
    // A Firestore equality filter on null matches a field that IS null. It does
    // not match a document missing the field. Every file uploaded before v6
    // lacks it, so without scripts/backfill-document-folder-fields those files
    // vanish from the list: no error, no empty state, just a shorter list than
    // the client remembers. This is the case for that script, and it holds
    // regardless of how Firestore evaluates unconstrained lists.
    const legacy = { ...baseDocument };
    delete legacy.deletedAt;
    await seed("orgs/orgA/documents/legacy", legacy);

    const internal = asUser(testEnv, "internal", claimsByRole.internal);
    const snap = await assertSucceeds(
      getDocs(query(collection(internal, "orgs/orgA/documents"), where("deletedAt", "==", null))),
    );
    expect(snap.docs.map((/** @type {*} */ d) => d.id)).not.toContain("legacy");
    expect(snap.docs.map((/** @type {*} */ d) => d.id)).toEqual(["live"]);
  });

  it("the same constrained query works for folders", async () => {
    await seed(folderPath, baseFolder);
    await seed(childPath, { ...baseFolder, id: "f_child", deletedAt: Timestamp.now() });
    const internal = asUser(testEnv, "internal", claimsByRole.internal);
    const snap = await assertSucceeds(
      getDocs(query(collection(internal, "orgs/orgA/folders"), where("deletedAt", "==", null))),
    );
    expect(snap.docs.map((/** @type {*} */ d) => d.id)).toEqual(["f_root"]);
  });

  it("records that the emulator PERMITS an unconstrained list over a tombstone", async () => {
    // Kept as a finding, not as a requirement. If this ever starts failing,
    // the emulator has moved toward the documented production model and the
    // caveat above is the thing to revisit — not this test.
    const internal = asUser(testEnv, "internal", claimsByRole.internal);
    await assertSucceeds(getDocs(collection(internal, "orgs/orgA/documents")));
  });
});
