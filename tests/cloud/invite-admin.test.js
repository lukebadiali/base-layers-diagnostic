// tests/cloud/invite-admin.test.js
// @ts-check
// Phase 06.1 Wave 2 (AUTH-16 / D-14): smoke + error-mapping tests for the
// inviteClient httpsCallable wrapper. AUTH-12 chokepoint contract — server
// HttpsError codes (carried in error.details.code) map to typed errors
// re-thrown from src/firebase/auth.js; the modal in src/main.js never sees
// raw Firebase codes.
//
// Tests:
//   1. Smoke — typeof inviteClient is "function"
//   2. PassphraseInvalidError mapping for details.code "auth/passphrase-invalid"
//   3. CrossOrgError mapping for details.code "auth/cross-org-invite-rejected"
//   4. PassphraseNotSetError mapping for details.code "auth/passphrase-not-set"
//   5. Passthrough for unrecognised codes (Sentry browser SDK + modal catch-all surface them)
//   6. Happy path — resolves to res.data

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PassphraseInvalidError,
  CrossOrgError,
  PassphraseNotSetError,
} from "../../src/firebase/auth.js";

// vi.hoisted: vi.mock factories are hoisted ABOVE imports, so any top-level
// `const spy = vi.fn()` declared after the mock block is uninitialized at
// factory-call time. Hoisting the spy declaration alongside the mock factory
// resolves the temporal-dead-zone error.
const { callableSpy } = vi.hoisted(() => ({ callableSpy: vi.fn() }));

vi.mock("../../src/firebase/functions.js", () => ({
  functions: {},
  httpsCallable: () => callableSpy,
}));

beforeEach(() => {
  callableSpy.mockReset();
});

describe("src/cloud/invite-admin.js (Phase 06.1 Wave 2 AUTH-16)", () => {
  it("Test 1: inviteClient is a function (smoke)", async () => {
    const { inviteClient } = await import("../../src/cloud/invite-admin.js");
    expect(typeof inviteClient).toBe("function");
  });

  it("Test 2: maps server HttpsError details.code 'auth/passphrase-invalid' → PassphraseInvalidError", async () => {
    callableSpy.mockRejectedValueOnce(
      Object.assign(new Error("Passphrase incorrect"), {
        code: "failed-precondition",
        details: { code: "auth/passphrase-invalid" },
      }),
    );
    const { inviteClient } = await import("../../src/cloud/invite-admin.js");
    await expect(
      inviteClient({
        email: "c@x.com",
        name: "C",
        orgId: "o1",
        orgPassphrase: "p",
      }),
    ).rejects.toBeInstanceOf(PassphraseInvalidError);
  });

  it("Test 3: maps 'auth/cross-org-invite-rejected' → CrossOrgError", async () => {
    callableSpy.mockRejectedValueOnce(
      Object.assign(new Error("cross-org"), {
        code: "failed-precondition",
        details: { code: "auth/cross-org-invite-rejected" },
      }),
    );
    const { inviteClient } = await import("../../src/cloud/invite-admin.js");
    await expect(
      inviteClient({
        email: "c@x.com",
        name: "C",
        orgId: "o1",
        orgPassphrase: "p",
      }),
    ).rejects.toBeInstanceOf(CrossOrgError);
  });

  it("Test 4: maps 'auth/passphrase-not-set' → PassphraseNotSetError", async () => {
    callableSpy.mockRejectedValueOnce(
      Object.assign(new Error("not set"), {
        code: "failed-precondition",
        details: { code: "auth/passphrase-not-set" },
      }),
    );
    const { inviteClient } = await import("../../src/cloud/invite-admin.js");
    await expect(
      inviteClient({
        email: "c@x.com",
        name: "C",
        orgId: "o1",
        orgPassphrase: "p",
      }),
    ).rejects.toBeInstanceOf(PassphraseNotSetError);
  });

  it("Test 5: passes through unrecognised errors (no typed-error mapping)", async () => {
    const original = Object.assign(new Error("Auth lookup failed: auth/network-request-failed"), {
      code: "internal",
    });
    callableSpy.mockRejectedValueOnce(original);
    const { inviteClient } = await import("../../src/cloud/invite-admin.js");
    let caught;
    try {
      await inviteClient({
        email: "c@x.com",
        name: "C",
        orgId: "o1",
        orgPassphrase: "p",
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBe(original);
    expect(caught).not.toBeInstanceOf(PassphraseInvalidError);
    expect(caught).not.toBeInstanceOf(CrossOrgError);
    expect(caught).not.toBeInstanceOf(PassphraseNotSetError);
  });

  it("Test 6: returns res.data on success", async () => {
    callableSpy.mockResolvedValueOnce({
      data: { uid: "u1", existed: false },
    });
    const { inviteClient } = await import("../../src/cloud/invite-admin.js");
    const result = await inviteClient({
      email: "c@x.com",
      name: "C",
      orgId: "o1",
      orgPassphrase: "p",
    });
    expect(result).toEqual({ uid: "u1", existed: false });
  });

  it("Test 7: forwards clientReqId to the callable (generated per call)", async () => {
    callableSpy.mockResolvedValueOnce({
      data: { uid: "u2", existed: true, hasFirstRun: true },
    });
    const { inviteClient } = await import("../../src/cloud/invite-admin.js");
    await inviteClient({
      email: "c@x.com",
      name: "C",
      orgId: "o1",
      orgPassphrase: "p",
      confirmReset: true,
    });
    expect(callableSpy).toHaveBeenCalledTimes(1);
    const [arg] = callableSpy.mock.calls[0];
    expect(arg).toMatchObject({
      email: "c@x.com",
      name: "C",
      orgId: "o1",
      orgPassphrase: "p",
      confirmReset: true,
    });
    expect(typeof arg.clientReqId).toBe("string");
    expect(arg.clientReqId.length).toBeGreaterThan(0);
  });
});
