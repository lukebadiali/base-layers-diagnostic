// Phase 8 Wave 1 (BACKUP-01 / 08-02 Task 3): firebase-functions-test
// integration tests for scheduledFirestoreExport.
//
// Pattern 11 (offline mode): vi.mock stubs the Admin SDK with the stateful
// in-memory mock from test/_mocks/admin-sdk.ts. t.wrap() exercises the REAL
// exported scheduled function. Tests verify:
//   1. Successful invocation writes one exportDocuments call with the expected
//      outputUriPrefix shape (gs://...-backups/firestore/YYYY-MM-DD).
//   2. When exportDocuments throws, the function rethrows (Cloud Scheduler retry).

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import functionsTest from "firebase-functions-test";
import * as adminSdk from "../_mocks/admin-sdk.js";

// ─── Shared mock state ────────────────────────────────────────────────────────

// exportDocuments implementation — swapped per test
const exportDocumentsSpy = vi.fn();
const databasePathSpy = vi.fn(
  (projectId: string, db: string) => `projects/${projectId}/databases/${db}`,
);

function MockFirestoreAdminClient(this: unknown) {
  return { databasePath: databasePathSpy, exportDocuments: exportDocumentsSpy };
}

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@google-cloud/firestore", () => ({
  v1: { FirestoreAdminClient: MockFirestoreAdminClient },
}));

vi.mock("firebase-functions/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ─── firebase-functions-test init ─────────────────────────────────────────────

const t = functionsTest({ projectId: "bedeveloped-base-layers-test" });
afterAll(() => t.cleanup());

// ─── Helpers ──────────────────────────────────────────────────────────────────

function successImpl(req: { name: string; outputUriPrefix: string; collectionIds?: string[] }) {
  return adminSdk.getFirestoreAdminClientMock().exportDocuments(req);
}

async function loadWrapped() {
  const mod = await import("../../src/backup/scheduledFirestoreExport.js");
  return t.wrap(mod.scheduledFirestoreExport as never);
}

async function invoke(wrapped: ReturnType<typeof t.wrap>) {
  return (wrapped as (e: unknown) => Promise<unknown>)({});
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  adminSdk.adminMockState._reset();
  exportDocumentsSpy.mockImplementation(successImpl);
  databasePathSpy.mockImplementation(
    (projectId: string, db: string) => `projects/${projectId}/databases/${db}`,
  );
  process.env.GCLOUD_PROJECT = "bedeveloped-base-layers";
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("scheduledFirestoreExport — integration (firebase-functions-test v3)", () => {
  it("Test 1: invocation writes one exportDocuments call with gs://...-backups/firestore/YYYY-MM-DD prefix", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-01T02:00:00Z"));

    const wrapped = await loadWrapped();
    await invoke(wrapped);

    const calls = adminSdk.adminMockState._allExportCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].outputUriPrefix).toMatch(
      /^gs:\/\/bedeveloped-base-layers-backups\/firestore\/\d{4}-\d{2}-\d{2}$/,
    );
  });

  it("Test 2: when exportDocuments throws, the function rethrows the same error", async () => {
    exportDocumentsSpy.mockRejectedValueOnce(new Error("test-error"));

    const wrapped = await loadWrapped();
    await expect(invoke(wrapped)).rejects.toThrow(/test-error/);
  });
});
