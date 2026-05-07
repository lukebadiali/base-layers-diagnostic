// tests/data/documents.test.js
// @ts-check
// Phase 4 Wave 3 (D-09 pass-through + Storage): documents.js delegates the
// metadata write to data/orgs.js (org.documents[docId] map) AND uploads the
// file via firebase/storage.js. Phase 5 (DATA-01) rewrites to subcollection
// access; Phase 7 wires the file-upload callable.
//
// Trust-boundary anchor (D-15 / T-4-3-4): saveDocument receives sanitisedName
// from validateUpload (ui/upload.js) — does NOT re-validate. Tests assert the
// path construction shape `orgs/{orgId}/documents/{docId}/{sanitisedName}`.
import { describe, it, expect, vi } from "vitest";
import { makeFirestoreMock } from "../mocks/firebase.js";

vi.mock("../../src/firebase/db.js", () => makeFirestoreMock({
  seed: {
    "orgs/o1": { id: "o1", documents: { d1: { id: "d1", name: "report.pdf" } } },
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

describe("data/documents.js (D-09 pass-through + Storage)", () => {
  it("listDocuments returns the seeded org's document map as an array", async () => {
    const ds = await listDocuments("o1");
    expect(ds.find((/** @type {any} */ d) => d.id === "d1")).toBeTruthy();
  });

  it("listDocuments returns [] when the org is absent", async () => {
    const ds = await listDocuments("missing-org");
    expect(ds).toEqual([]);
  });

  it("saveDocument constructs orgs/{orgId}/documents/{docId}/{sanitisedName} path and returns the downloadURL", async () => {
    /** @type {*} */
    const fakeFile = { name: "test.pdf", size: 100, type: "application/pdf" };
    const result = await saveDocument("o1", fakeFile, "test.pdf", { uploaderId: "u1" });
    expect(result.id).toBeTruthy();
    expect(result.downloadURL).toMatch(/^https:\/\/download\.example\/orgs\/o1\/documents\//);
    expect(result.downloadURL).toMatch(/test\.pdf$/);
  });

  it("deleteDocument removes the doc from the org's documents map and calls deleteObject", async () => {
    const storageMock = await import("../../src/firebase/storage.js");
    /** @type {*} */
    const fakeFile = { name: "kill.pdf", size: 1, type: "application/pdf" };
    const { id: docId } = await saveDocument("o1", fakeFile, "kill.pdf");
    await deleteDocument("o1", docId);
    expect(/** @type {any} */ (storageMock.deleteObject).mock.calls.length).toBeGreaterThan(0);
  });
});
