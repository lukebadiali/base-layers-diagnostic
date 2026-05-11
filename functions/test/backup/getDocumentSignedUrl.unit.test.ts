// Phase 8 Wave 1 (BACKUP-05 / 08-02 Task 2): unit tests for
// getDocumentSignedUrl callable.
//
// Tests pin auth gates, cross-tenant deny, internal/admin bypass, input
// validation, and signed URL issuance. Uses offline mock from
// test/_mocks/admin-sdk.ts (getStorageMock + _allSignedUrls).
// Storage emulator does NOT support getSignedUrl (firebase-tools #3400),
// so getSignedUrl is mocked at the firebase-admin/storage level.

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

vi.mock("../_mocks/admin-sdk.js", async (importOriginal) => {
  // Pass-through: just re-export the real module so tests can call _reset etc.
  return importOriginal<typeof adminSdk>();
});

// ─── firebase-functions-test init ─────────────────────────────────────────────

const t = functionsTest({ projectId: "bedeveloped-base-layers-test" });
afterAll(() => t.cleanup());

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loadWrapped() {
  const mod = await import("../../src/backup/getDocumentSignedUrl.js");
  return t.wrap(mod.getDocumentSignedUrl);
}

type AuthCtx = {
  uid: string;
  token: Record<string, unknown>;
};

function makeReq(data: Record<string, unknown>, auth?: AuthCtx) {
  return { data, ...(auth ? { auth } : {}), app: {} } as never;
}

const VALID_DATA = { orgId: "orgA", docId: "doc1", filename: "report.pdf" };

const clientAuthOrgA: AuthCtx = { uid: "u-client", token: { orgId: "orgA", role: "client" } };
const clientAuthOrgB: AuthCtx = { uid: "u-client-b", token: { orgId: "orgB", role: "client" } };
const internalAuth: AuthCtx = { uid: "u-internal", token: { role: "internal" } };
const adminAuth: AuthCtx = { uid: "u-admin", token: { role: "admin" } };

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  adminSdk.adminMockState._reset();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("getDocumentSignedUrl — unit", () => {
  it("Test 1: unauthenticated request throws HttpsError('unauthenticated')", async () => {
    const wrapped = await loadWrapped();
    await expect(wrapped(makeReq(VALID_DATA))).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("Test 2: client with matching orgId returns { url, expiresAt } within 1h window", async () => {
    const wrapped = await loadWrapped();
    const before = Date.now();
    const result = (await wrapped(makeReq(VALID_DATA, clientAuthOrgA))) as {
      url: string;
      expiresAt: number;
    };
    const after = Date.now();

    expect(typeof result.url).toBe("string");
    expect(result.url.length).toBeGreaterThan(0);
    // expiresAt should be within 60_000ms of now + 3_600_000
    expect(result.expiresAt).toBeGreaterThanOrEqual(before + 3_600_000 - 1000);
    expect(result.expiresAt).toBeLessThanOrEqual(after + 3_600_000 + 1000);
  });

  it("Test 3: client with orgId='orgA' requesting orgId='orgB' throws HttpsError('permission-denied', /Not in org/)", async () => {
    const wrapped = await loadWrapped();
    // Caller token says orgId="orgA" but requests orgId="orgB" — cross-tenant deny
    const crossTenantData = { ...VALID_DATA, orgId: "orgB" };
    await expect(wrapped(makeReq(crossTenantData, clientAuthOrgA))).rejects.toMatchObject({
      code: "permission-denied",
      message: expect.stringMatching(/Not in org/),
    });
  });

  it("Test 4: internal role (no orgId) can access any org's document", async () => {
    const wrapped = await loadWrapped();
    const result = (await wrapped(makeReq(VALID_DATA, internalAuth))) as {
      url: string;
      expiresAt: number;
    };
    expect(typeof result.url).toBe("string");
  });

  it("Test 5: admin role can access any org's document", async () => {
    const wrapped = await loadWrapped();
    const result = (await wrapped(makeReq(VALID_DATA, adminAuth))) as {
      url: string;
      expiresAt: number;
    };
    expect(typeof result.url).toBe("string");
  });

  it("Test 6: missing docId throws HttpsError('invalid-argument')", async () => {
    const wrapped = await loadWrapped();
    const badData = { orgId: "orgA", docId: "", filename: "report.pdf" };
    await expect(wrapped(makeReq(badData, adminAuth))).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("Test 7: signed URL is recorded with bucket='bedeveloped-base-layers-uploads', action='read', expires within 1h", async () => {
    const wrapped = await loadWrapped();
    const before = Date.now();
    await wrapped(makeReq(VALID_DATA, adminAuth));
    const after = Date.now();

    const urls = adminSdk.adminMockState._allSignedUrls();
    expect(urls).toHaveLength(1);
    const entry = urls[0];
    expect(entry.bucket).toBe("bedeveloped-base-layers-uploads");
    expect(entry.path).toBe("orgs/orgA/documents/doc1/report.pdf");
    expect(entry.action).toBe("read");
    expect(entry.expires).toBeGreaterThanOrEqual(before + 3_600_000 - 1000);
    expect(entry.expires).toBeLessThanOrEqual(after + 3_600_000 + 1000);
  });
});
