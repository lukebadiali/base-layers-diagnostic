// Phase 7 Wave 6 (TEST-09 / 07-06): firebase-functions-test integration coverage
// for the onOrgDelete Firestore-trigger mirror writer (AUDIT-04 / FN-01).
//
// Pins (per 07-RESEARCH.md Pattern 11):
//   - happy path: Firestore delete event triggers a `data.org.delete.mirror`
//     audit row in auditLog/ (defence-in-depth)
//   - dedup-skip: a primary `data.org.softDelete` event in the last 60s
//     suppresses the mirror write

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
  const mod = await import("../../src/audit/triggers/onOrgDelete.js");
  return t.wrap(mod.onOrgDelete);
}

describe("onOrgDelete — integration (firebase-functions-test v3)", () => {
  it("happy path: Firestore delete event writes a data.org.delete.mirror audit row", async () => {
    const wrapped = await loadWrapped();
    // For v2 onDocumentDeleted triggers, firebase-functions-test 3.5.0 expects
    // the input shape {params, data: {<plain doc fields>}}. The wrapper builds
    // a DocumentSnapshot whose .data() returns those fields. The handler reads
    // event.params.orgId + event.data?.data() — both wired by the harness.
    const orgId = "org_to_delete";
    await wrapped({
      params: { orgId },
      data: { name: "Test Org", createdAt: 1700000000000 },
    } as never);

    const m = await import("../_mocks/admin-sdk.js");
    const docs = m.adminMockState._allDocs();
    const auditEntries = Array.from(docs.entries()).filter(([path]) =>
      path.startsWith("auditLog/"),
    );
    expect(auditEntries.length).toBe(1);
    const [, written] = auditEntries[0]!;
    expect(written.type).toBe("data.org.delete.mirror");
    expect(written.severity).toBe("warning");
    expect((written.target as { id: string }).id).toBe(orgId);
    expect((written.actor as { uid: string }).uid).toBe("system");
    expect((written.actor as { role: string }).role).toBe("system");
    expect((written.payload as { source: string }).source).toBe("trigger");
  });

  it("dedup-skip: primary data.org.softDelete within 60s suppresses the mirror write", async () => {
    const wrapped = await loadWrapped();
    const orgId = "org_recently_softdeleted";

    // Seed a primary audit row dated NOW (well within the 60s window)
    const m = await import("../_mocks/admin-sdk.js");
    m.adminMockState._seedDoc("auditLog/primary-evt", {
      eventId: "primary-evt",
      type: "data.org.softDelete",
      target: { type: "org", id: orgId },
      at: new Date(),
      schemaVersion: 1,
    });

    await wrapped({
      params: { orgId },
      data: { name: "About to be deleted" },
    } as never);

    const docs = m.adminMockState._allDocs();
    const auditEntries = Array.from(docs.entries()).filter(([path]) =>
      path.startsWith("auditLog/"),
    );
    // Only the seeded primary remains — no mirror row written
    expect(auditEntries.length).toBe(1);
    expect(auditEntries[0]![0]).toBe("auditLog/primary-evt");
  });
});
