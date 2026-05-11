// Phase 8 Wave 1 (BACKUP-01 / 08-02 Task 1): unit tests for
// scheduledFirestoreExport.
//
// Tests pin the exact exportDocuments request shape + date derivation +
// error-rethrow + env-var lookup. Uses offline mock from test/_mocks/admin-sdk.ts
// (extended in 08-01 Task 4) — no Firestore emulator required.

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import functionsTest from "firebase-functions-test";
import * as adminSdk from "../_mocks/admin-sdk.js";

// ─── Shared mock instance (created once; behaviour mutated per-test) ──────────
// exportDocumentsImpl is swapped per test to control throw vs success.

const exportDocumentsSpy = vi.fn();
const databasePathSpy = vi.fn(
  (projectId: string, db: string) => `projects/${projectId}/databases/${db}`,
);

// Constructor function usable with `new`
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

async function loadFn() {
  const mod = await import("../../src/backup/scheduledFirestoreExport.js");
  return mod.scheduledFirestoreExport;
}

async function invoke(fn: ReturnType<typeof t.wrap>) {
  return (fn as (e: unknown) => Promise<unknown>)({});
}

// Default exportDocuments success implementation — delegates to shared state mock
function successImpl(req: { name: string; outputUriPrefix: string; collectionIds?: string[] }) {
  return adminSdk.getFirestoreAdminClientMock().exportDocuments(req);
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  adminSdk.adminMockState._reset();
  exportDocumentsSpy.mockImplementation(successImpl);
  databasePathSpy.mockImplementation(
    (projectId: string, db: string) => `projects/${projectId}/databases/${db}`,
  );
  process.env.GCLOUD_PROJECT = "bedeveloped-base-layers";
  delete process.env.GCP_PROJECT;
});

// Always restore real timers so fake-timer state does not leak into
// other test files running in the same Vitest worker process.
afterEach(() => {
  vi.useRealTimers();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("scheduledFirestoreExport — unit", () => {
  it("Test 1: calls exportDocuments once with correct name, outputUriPrefix, and collectionIds:[]", async () => {
    // toFake: ["Date"] only — do NOT fake setTimeout/setInterval/etc to avoid
    // leaking into other test files' async operations (timer isolation).
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-05-15T10:00:00Z"));

    const fn = await loadFn();
    const wrapped = t.wrap(fn as never);
    await invoke(wrapped);

    const calls = adminSdk.adminMockState._allExportCalls();
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("projects/bedeveloped-base-layers/databases/(default)");
    expect(calls[0].outputUriPrefix).toBe(
      "gs://bedeveloped-base-layers-backups/firestore/2026-05-15",
    );
    expect(calls[0].collectionIds).toEqual([]);

    vi.useRealTimers();
  });

  it("Test 2: outputUriPrefix date segment is derived from new Date().toISOString().slice(0, 10)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-05-15T10:00:00Z"));

    const fn = await loadFn();
    const wrapped = t.wrap(fn as never);
    await invoke(wrapped);

    const calls = adminSdk.adminMockState._allExportCalls();
    expect(calls[0].outputUriPrefix).toMatch(/\/firestore\/2026-05-15$/);

    vi.useRealTimers();
  });

  it("Test 3: when exportDocuments throws, logs backup.export.failed and rethrows", async () => {
    const loggerModule = await import("firebase-functions/logger");
    const loggerError = vi.mocked(loggerModule.logger.error);
    loggerError.mockClear();

    exportDocumentsSpy.mockRejectedValueOnce(new Error("test-export-error"));

    const fn = await loadFn();
    const wrapped = t.wrap(fn as never);

    await expect(invoke(wrapped)).rejects.toThrow("test-export-error");
    expect(loggerError).toHaveBeenCalledWith(
      "backup.export.failed",
      expect.objectContaining({ err: "test-export-error" }),
    );
  });

  it("Test 4: databasePath uses GCLOUD_PROJECT env var", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-05-15T10:00:00Z"));

    process.env.GCLOUD_PROJECT = "my-test-project";

    const fn = await loadFn();
    const wrapped = t.wrap(fn as never);
    await invoke(wrapped);

    const calls = adminSdk.adminMockState._allExportCalls();
    expect(calls[0].name).toBe("projects/my-test-project/databases/(default)");

    vi.useRealTimers();
  });

  it("Test 5: when both GCLOUD_PROJECT and GCP_PROJECT are absent, throws with 'GCLOUD_PROJECT not set'", async () => {
    delete process.env.GCLOUD_PROJECT;
    delete process.env.GCP_PROJECT;

    const fn = await loadFn();
    const wrapped = t.wrap(fn as never);

    await expect(invoke(wrapped)).rejects.toThrow("GCLOUD_PROJECT not set");
  });
});
