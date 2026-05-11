// tests/data/documents.test.js
// @ts-check
// Phase 5 Wave 3 (DATA-01 / 05-03): subcollection rewrite.
// documents.js now writes metadata to orgs/{orgId}/documents/{docId} directly
// (no more orgs.js delegation). Storage path orgs/{orgId}/documents/{docId}/{filename}
// stays unchanged (RULES-05). Phase 4 D-09 / D-10 API surface preserved verbatim.
//
// Trust-boundary anchor (D-15 / T-4-3-4): saveDocument is called BY views
// AFTER ui/upload.js validateUpload(file) returns ok:true with sanitisedName.
// data/documents.js does NOT re-validate — trusts the contract.
import { describe, it, expect, vi } from "vitest";
import { makeFirestoreMock } from "../mocks/firebase.js";

vi.mock("../../src/firebase/db.js", () => makeFirestoreMock({
  seed: {
    "orgs/o1/documents/d1": {
      orgId: "o1",
      name: "report.pdf",
      path: "orgs/o1/documents/d1/report.pdf",
      downloadURL: "https://download.example/orgs/o1/documents/d1/report.pdf",
      uploadedBy: "u_a",
      legacyAppUserId: "u_a",
    },
  },
}));

vi.mock("../../src/firebase/storage.js", () => ({
  storage: { __mock: "storage" },
  ref: vi.fn((/** @type {any} */ s, /** @type {string} */ path) => ({ __path: path })),
  uploadBytesResumable: vi.fn((/** @type {any} */ ref, /** @type {*} */ _file) => {
    /** @type {any} */
    const task = Promise.resolve({ snapshot: { ref } });
    task.snapshot = { ref };
    return task;
  }),
  getDownloadURL: vi.fn(async (/** @type {any} */ r) => `https://download.example/${r.__path}`),
  deleteObject: vi.fn(async (/** @type {*} */ _r) => undefined),
}));

const { listDocuments, saveDocument, deleteDocument } = await import("../../src/data/documents.js");

describe("data/documents.js (Phase 5 subcollection rewrite + Storage)", () => {
  it("listDocuments returns the seeded subcollection metadata as an array (id merged)", async () => {
    const ds = await listDocuments("o1");
    const found = ds.find((/** @type {any} */ d) => d.id === "d1");
    expect(found).toBeTruthy();
    expect(found.name).toBe("report.pdf");
  });

  it("listDocuments returns [] when the org has no documents subcollection docs", async () => {
    const ds = await listDocuments("missing-org");
    expect(ds).toEqual([]);
  });

  it("saveDocument constructs orgs/{orgId}/documents/{docId}/{sanitisedName} Storage path + writes subcollection metadata + returns { id } (Phase 8: downloadURL dropped — use signed-url callable)", async () => {
    /** @type {*} */
    const fakeFile = { name: "test.pdf", size: 100, type: "application/pdf" };
    const result = await saveDocument("o1", fakeFile, "test.pdf", { uploadedBy: "u_a" });
    expect(result.id).toBeTruthy();
    // downloadURL no longer returned — clients fetch via getDocumentSignedUrl (BACKUP-05 sweep)
    expect(Object.keys(result)).toEqual(["id"]);
    // Confirm the metadata landed in the subcollection (not the parent doc)
    const ds = await listDocuments("o1");
    const meta = ds.find((/** @type {any} */ d) => d.id === result.id);
    expect(meta).toBeTruthy();
    expect(meta.path).toMatch(/^orgs\/o1\/documents\//);
    expect(meta.path).toMatch(/test\.pdf$/);
    expect(meta.legacyAppUserId).toBe("u_a");
    expect(meta.createdAt).toEqual({ __serverTimestamp: true });
  });

  it("deleteDocument removes both the Storage object and the subcollection metadata doc", async () => {
    const storageMock = await import("../../src/firebase/storage.js");
    /** @type {*} */
    const fakeFile = { name: "kill.pdf", size: 1, type: "application/pdf" };
    const { id: docId } = await saveDocument("o1", fakeFile, "kill.pdf");
    await deleteDocument("o1", docId);
    expect(/** @type {any} */ (storageMock.deleteObject).mock.calls.length).toBeGreaterThan(0);
    const ds = await listDocuments("o1");
    expect(ds.find((/** @type {any} */ d) => d.id === docId)).toBeFalsy();
  });

  it("deleteDocument is a no-op when the metadata doc does not exist", async () => {
    // Should not throw and should not call deleteObject
    await deleteDocument("o1", "does-not-exist");
  });
});
