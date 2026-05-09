// Phase 7 Wave 6 (TEST-09 / 07-06): firebase-functions-test integration coverage
// for the onDocumentDelete v2 Firestore-trigger mirror writer (AUDIT-04 / FN-01).
//
// Pins:
//   - happy path: orgs/{orgId}/documents/{docId} delete event fires the
//     trigger and writes a data.document.delete.mirror audit row
//   - dedup-skip: a primary data.document.delete event in the last 60s
//     suppresses the mirror write (Pattern 4b + Pitfall 7)

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import functionsTest from "firebase-functions-test";

vi.mock("firebase-admin/app", () => ({
  initializeApp: () => ({}),
  getApps: () => [{}],
}));

vi.mock("firebase-admin/firestore", async () => {
  const m = await import("../_mocks/admin-sdk.js");
  return {
    getFirestore: () => m.getFirestoreMock(),
    FieldValue: m.FieldValueMock,
  };
});

vi.mock("firebase-functions/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const t = functionsTest({ projectId: "bedeveloped-base-layers-test" });
afterAll(() => t.cleanup());

beforeEach(async () => {
  const m = await import("../_mocks/admin-sdk.js");
  m.adminMockState._reset();
});

async function loadWrapped() {
  vi.resetModules();
  const mod = await import("../../src/audit/triggers/onDocumentDelete.js");
  return t.wrap(mod.onDocumentDelete);
}

describe("onDocumentDelete — integration (firebase-functions-test v3)", () => {
  it("happy path: document-delete event writes a data.document.delete.mirror audit row", async () => {
    const wrapped = await loadWrapped();
    const orgId = "org_a";
    const docId = "doc_xyz";
    await wrapped({
      params: { orgId, docId },
      data: {
        filename: "test.pdf",
        sizeBytes: 1024,
      },
    } as never);

    const m = await import("../_mocks/admin-sdk.js");
    const docs = m.adminMockState._allDocs();
    const auditEntries = Array.from(docs.entries()).filter(([path]) =>
      path.startsWith("auditLog/"),
    );
    expect(auditEntries.length).toBe(1);
    const [, written] = auditEntries[0]!;
    expect(written.type).toBe("data.document.delete.mirror");
    expect(written.severity).toBe("warning");
    expect((written.target as { id: string }).id).toBe(docId);
    expect((written.target as { orgId: string }).orgId).toBe(orgId);
  });

  it("dedup-skip: primary data.document.delete within 60s suppresses the mirror write", async () => {
    const wrapped = await loadWrapped();
    const orgId = "org_b";
    const docId = "doc_just_deleted";

    const m = await import("../_mocks/admin-sdk.js");
    m.adminMockState._seedDoc("auditLog/primary-doc-evt", {
      eventId: "primary-doc-evt",
      type: "data.document.delete",
      target: { type: "document", id: docId, orgId },
      at: new Date(),
      schemaVersion: 1,
    });

    await wrapped({
      params: { orgId, docId },
      data: { filename: "x.pdf" },
    } as never);

    const docs = m.adminMockState._allDocs();
    const auditEntries = Array.from(docs.entries()).filter(([path]) =>
      path.startsWith("auditLog/"),
    );
    expect(auditEntries.length).toBe(1);
    expect(auditEntries[0]![0]).toBe("auditLog/primary-doc-evt");
  });
});
