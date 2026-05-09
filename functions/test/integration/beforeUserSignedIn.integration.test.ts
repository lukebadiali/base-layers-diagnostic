// Phase 7 Wave 6 (TEST-09 / 07-06): firebase-functions-test integration coverage
// for the beforeUserSignedIn auth-blocking handler (AUTH-06 / D-21).
//
// Pins:
//   - happy path: signin event observed without modification (handler is
//     observation-only — no Firestore writes, no return value mutation;
//     Pattern preservation verified via no-side-effect assertion)
//   - missing-fields tolerance: signin with no email / no provider does not
//     throw (defensive observation per ARCHITECTURE.md §3 "Use sparingly")

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
  const mod = await import("../../src/auth/beforeUserSignedIn.js");
  return t.wrap(mod.beforeUserSignedInHandler);
}

describe("beforeUserSignedIn — integration (firebase-functions-test v3)", () => {
  it("happy path: signin event observed; no Firestore writes (observation-only)", async () => {
    const wrapped = await loadWrapped();
    const result = await wrapped({
      data: {
        uid: "signin-user-uid",
        email: "user@example.com",
        emailVerified: true,
        providerData: [{ providerId: "password" }],
        multiFactor: { enrolledFactors: [{ factorId: "phone" }] },
      },
    } as never);

    // The handler is observation-only — it returns undefined (no claims
    // modification) and writes nothing. Both invariants pinned per
    // ARCHITECTURE.md §3 "Use sparingly".
    expect(result).toBeUndefined();
    const m = await import("../_mocks/admin-sdk.js");
    expect(m.adminMockState._allDocs().size).toBe(0);
  });

  it("missing-fields tolerance: handler does not throw on bare minimum payload", async () => {
    const wrapped = await loadWrapped();
    // Defensive observation — Firebase guarantees event.data exists; this
    // pin verifies the handler tolerates missing email/provider/mfa fields.
    await expect(
      wrapped({
        data: {
          uid: "bare-uid",
          // no email, no providerData, no multiFactor
        },
      } as never),
    ).resolves.toBeUndefined();
  });
});
