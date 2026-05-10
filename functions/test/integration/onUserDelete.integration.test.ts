// Phase 7 Wave 6 (TEST-09 / 07-06): firebase-functions-test integration coverage
// for the onUserDelete v1 auth-trigger mirror writer (AUDIT-04 / FN-01).
//
// Note: onUserDelete uses 1st-gen `auth.user().onDelete()` because v2/identity
// has no onUserDeleted equivalent in firebase-functions 7.2.5 (Wave 2 decision).
// firebase-functions-test 3.5.0 supports v1 wrapping via `t.wrap()` taking the
// CloudFunction directly. The handler payload is a UserRecord-like object with
// uid + email at minimum.
//
// Pins:
//   - happy path: deleting a user fires the trigger and writes a
//     data.user.delete.mirror audit row
//   - dedup-skip: a primary data.user.delete event in the last 60s suppresses
//     the mirror write

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
  const mod = await import("../../src/audit/triggers/onUserDelete.js");
  return t.wrap(mod.onUserDelete);
}

describe("onUserDelete — integration (firebase-functions-test v3, v1 trigger)", () => {
  it("happy path: user-deletion event writes a data.user.delete.mirror audit row", async () => {
    const wrapped = await loadWrapped();
    // v1 auth.user().onDelete() handler receives a UserRecord. The wrapper
    // forwards the payload into the handler's first argument.
    const userRecord = {
      uid: "deleted-user-1",
      email: "deleted@example.com",
      emailVerified: false,
      disabled: false,
      metadata: { creationTime: "", lastSignInTime: "" },
      providerData: [],
      toJSON: () => ({}),
    };
    await wrapped(userRecord as never);

    const m = await import("../_mocks/admin-sdk.js");
    const docs = m.adminMockState._allDocs();
    const auditEntries = Array.from(docs.entries()).filter(([path]) =>
      path.startsWith("auditLog/"),
    );
    expect(auditEntries.length).toBe(1);
    const [, written] = auditEntries[0]!;
    expect(written.type).toBe("data.user.delete.mirror");
    expect(written.severity).toBe("warning");
    expect((written.target as { id: string }).id).toBe("deleted-user-1");
    expect((written.actor as { uid: string }).uid).toBe("system");
  });

  it("dedup-skip: primary data.user.delete within 60s suppresses the mirror write", async () => {
    const wrapped = await loadWrapped();
    const uid = "u_just_deleted";

    const m = await import("../_mocks/admin-sdk.js");
    m.adminMockState._seedDoc("auditLog/primary-user-evt", {
      eventId: "primary-user-evt",
      type: "data.user.delete",
      target: { type: "user", id: uid },
      at: new Date(),
      schemaVersion: 1,
    });

    await wrapped({
      uid,
      email: null,
      emailVerified: false,
      disabled: false,
      metadata: { creationTime: "", lastSignInTime: "" },
      providerData: [],
      toJSON: () => ({}),
    } as never);

    const docs = m.adminMockState._allDocs();
    const auditEntries = Array.from(docs.entries()).filter(([path]) =>
      path.startsWith("auditLog/"),
    );
    // Only the seeded primary — no mirror written
    expect(auditEntries.length).toBe(1);
    expect(auditEntries[0]![0]).toBe("auditLog/primary-user-evt");
  });
});
