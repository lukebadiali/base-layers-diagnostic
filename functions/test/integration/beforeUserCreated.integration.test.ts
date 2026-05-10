// Phase 7 Wave 6 (TEST-09 / 07-06): firebase-functions-test integration coverage
// for the beforeUserCreated auth-blocking handler (AUTH-03 / AUTH-05 / D-10).
//
// Pins:
//   - allowlisted email → returns {customClaims: {role, orgId}} from
//     internalAllowlist/{lowercasedEmail} via buildClaims
//   - non-allowlisted email → falls through to client/null per claim-builder
//
// Note: blocking-handler trigger payload is event.data with email + uid +
// related fields. firebase-functions-test 3.5.0 v2 wrapping accepts a
// CloudEvent-shape input.

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
  const mod = await import("../../src/auth/beforeUserCreated.js");
  return t.wrap(mod.beforeUserCreatedHandler);
}

describe("beforeUserCreated — integration (firebase-functions-test v3)", () => {
  it("happy path: allowlist match → returns customClaims with role + orgId", async () => {
    // Order matters: loadWrapped() calls vi.resetModules() which re-imports
    // the _mocks/admin-sdk module → fresh in-memory store. Seed AFTER the
    // wrapped handler is loaded so the seed lands in the same module instance
    // the handler will read from.
    const wrapped = await loadWrapped();
    const m = await import("../_mocks/admin-sdk.js");
    m.adminMockState._seedDoc("internalAllowlist/luke@bedeveloped.com", {
      role: "admin",
      orgId: null,
      addedBy: "bootstrap",
    });

    const result = (await wrapped({
      data: {
        uid: "new-user-uid",
        email: "luke@bedeveloped.com",
        emailVerified: false,
      },
    } as never)) as { customClaims: { role: string; orgId: string | null } };

    expect(result).toBeDefined();
    expect(result.customClaims.role).toBe("admin");
    expect(result.customClaims.orgId).toBeNull();
  });

  it("non-allowlisted email → falls through to client role with null orgId", async () => {
    const wrapped = await loadWrapped();
    // No allowlist seeded → buildClaims(null) returns {role: "client", orgId: null}
    const result = (await wrapped({
      data: {
        uid: "stranger-uid",
        email: "stranger@example.com",
        emailVerified: false,
      },
    } as never)) as { customClaims: { role: string; orgId: string | null } };

    expect(result).toBeDefined();
    expect(result.customClaims.role).toBe("client");
    expect(result.customClaims.orgId).toBeNull();
  });
});
