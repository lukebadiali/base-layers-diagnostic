// Phase 8 Wave 1 (BACKUP-05 / 08-02 Task 3): firebase-functions-test
// integration tests for getDocumentSignedUrl callable.
//
// Pattern 11 (offline mode): vi.mock stubs firebase-admin/storage with
// the stateful in-memory mock from test/_mocks/admin-sdk.ts.
// t.wrap() exercises the REAL exported callable. Tests verify:
//   1. Admin caller gets signed URL with correct shape + bucket/path/action
//   2. Cross-tenant client is denied (permission-denied)
//   3. Unauthenticated request is denied (unauthenticated)
//   4. Invalid input (empty docId) is rejected (invalid-argument)

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import functionsTest from "firebase-functions-test";
import * as adminSdk from "../_mocks/admin-sdk.js";

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("firebase-admin/app", () => ({
  initializeApp: () => ({}),
  getApps: () => [{}],
}));

vi.mock("firebase-admin/storage", async () => {
  const m = await import("../_mocks/admin-sdk.js");
  return { getStorage: () => m.getStorageMock() };
});

vi.mock("firebase-functions/params", () => ({
  defineSecret: (name: string) => ({ name, value: () => "" }),
}));

vi.mock("firebase-functions/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ─── firebase-functions-test init ─────────────────────────────────────────────

const t = functionsTest({ projectId: "bedeveloped-base-layers-test" });
afterAll(() => t.cleanup());

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loadWrapped() {
  const mod = await import("../../src/backup/getDocumentSignedUrl.js");
  return t.wrap(mod.getDocumentSignedUrl);
}

type AuthCtx = { uid: string; token: Record<string, unknown> };

function makeReq(data: Record<string, unknown>, auth?: AuthCtx) {
  return { data, ...(auth ? { auth } : {}), app: {} } as never;
}

const VALID_DATA = { orgId: "orgA", docId: "d_xyz", filename: "report.pdf" };

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  adminSdk.adminMockState._reset();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("getDocumentSignedUrl — integration (firebase-functions-test v3)", () => {
  it("Test 1 (happy path admin): returns signed URL + expiresAt; _allSignedUrls records correct bucket/path/action", async () => {
    const wrapped = await loadWrapped();
    const before = Date.now();

    const result = (await wrapped(
      makeReq(VALID_DATA, { uid: "admin1", token: { role: "admin" } }),
    )) as { url: string; expiresAt: number };

    const after = Date.now();

    // URL shape
    expect(result.url).toMatch(/^https:\/\/signed\.example/);
    // expiresAt within 1h window
    expect(result.expiresAt).toBeGreaterThanOrEqual(before + 3_600_000 - 1000);
    expect(result.expiresAt).toBeLessThanOrEqual(after + 3_600_000 + 1000);

    // Storage record
    const urls = adminSdk.adminMockState._allSignedUrls();
    expect(urls).toHaveLength(1);
    expect(urls[0].bucket).toBe("bedeveloped-base-layers-uploads");
    expect(urls[0].path).toBe("orgs/orgA/documents/d_xyz/report.pdf");
    expect(urls[0].action).toBe("read");
  });

  it("Test 2 (cross-tenant client deny): client with orgId=orgB requesting orgA → permission-denied", async () => {
    const wrapped = await loadWrapped();
    await expect(
      wrapped(
        makeReq(VALID_DATA, { uid: "u1", token: { role: "client", orgId: "orgB" } }),
      ),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("Test 3 (unauthenticated deny): no auth context → unauthenticated", async () => {
    const wrapped = await loadWrapped();
    await expect(wrapped(makeReq(VALID_DATA))).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("Test 4 (invalid input): admin + empty docId → invalid-argument", async () => {
    const wrapped = await loadWrapped();
    await expect(
      wrapped(
        makeReq(
          { orgId: "orgA", docId: "", filename: "report.pdf" },
          { uid: "admin1", token: { role: "admin" } },
        ),
      ),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });
});
