// tests/firebase/auth-mfa-challenge.test.js
// @ts-nocheck
// Phase 6 follow-up (UAT-discovered): the MFA challenge path was missing —
// `auth/multi-factor-auth-required` fell through the unified-error wrapper and
// surfaced as a raw Firebase error in the UI, with no TOTP prompt. These tests
// pin the new behaviour: signInEmailPassword recognises the error code, calls
// getMultiFactorResolver, and throws MfaRequiredError carrying the resolver so
// the view layer can route to renderMfaChallenge. verifyMfaCode completes the
// resolved sign-in via TotpMultiFactorGenerator.assertionForSignIn +
// resolver.resolveSignIn. Errors at the TOTP step surface as MfaCodeInvalidError
// (single-chokepoint contract; no firebase/* error codes leak into views/*).

import { describe, it, expect, beforeEach, vi } from "vitest";

const fbSignInWithEmailAndPassword = vi.fn();
const fbGetMultiFactorResolver = vi.fn();
const totpAssertionForSignIn = vi.fn(() => ({ kind: "totp-assertion" }));
const emitAuditEventSpy = vi.fn();

vi.mock("../../src/observability/audit-events.js", () => ({
  emitAuditEvent: (...args) => emitAuditEventSpy(...args),
  AUDIT_EVENTS: {},
}));
vi.mock("../../src/cloud/claims-admin.js", () => ({
  setClaims: vi.fn(async () => undefined),
}));

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: (...args) => fbSignInWithEmailAndPassword(...args),
  signOut: vi.fn(),
  multiFactor: vi.fn(),
  TotpMultiFactorGenerator: {
    generateSecret: vi.fn(),
    assertionForEnrollment: vi.fn(),
    assertionForSignIn: (...args) => totpAssertionForSignIn(...args),
  },
  updatePassword: vi.fn(),
  sendSignInLinkToEmail: vi.fn(),
  isSignInWithEmailLink: vi.fn(),
  signInWithEmailLink: vi.fn(),
  sendEmailVerification: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  getMultiFactorResolver: (...args) => fbGetMultiFactorResolver(...args),
}));

vi.mock("../../src/firebase/app.js", () => ({
  auth: { currentUser: null },
}));

const auth = await import("../../src/firebase/auth.js");

beforeEach(() => {
  fbSignInWithEmailAndPassword.mockReset();
  fbGetMultiFactorResolver.mockReset();
  totpAssertionForSignIn.mockClear();
  emitAuditEventSpy.mockReset();
});

describe("signInEmailPassword — auth/multi-factor-auth-required intercept", () => {
  it("throws MfaRequiredError (not SignInError) when Firebase signals MFA required", async () => {
    const mfaErr = Object.assign(new Error("MFA required"), {
      code: "auth/multi-factor-auth-required",
    });
    const resolver = { hints: [{ uid: "factor-1", factorId: "totp" }], resolveSignIn: vi.fn() };
    fbSignInWithEmailAndPassword.mockRejectedValueOnce(mfaErr);
    fbGetMultiFactorResolver.mockReturnValueOnce(resolver);

    await expect(auth.signInEmailPassword("u@example.com", "pw")).rejects.toBeInstanceOf(
      auth.MfaRequiredError,
    );
  });

  it("MfaRequiredError carries the resolver returned by getMultiFactorResolver", async () => {
    const mfaErr = Object.assign(new Error("MFA required"), {
      code: "auth/multi-factor-auth-required",
    });
    const resolver = { hints: [{ uid: "factor-1", factorId: "totp" }], resolveSignIn: vi.fn() };
    fbSignInWithEmailAndPassword.mockRejectedValueOnce(mfaErr);
    fbGetMultiFactorResolver.mockReturnValueOnce(resolver);

    try {
      await auth.signInEmailPassword("u@example.com", "pw");
      throw new Error("expected throw");
    } catch (err) {
      expect(err.name).toBe("MfaRequiredError");
      expect(err.resolver).toBe(resolver);
    }
    expect(fbGetMultiFactorResolver).toHaveBeenCalledWith(expect.anything(), mfaErr);
  });

  it("does NOT emit auth.signin.failure when MFA is required (mid-flight, not a failure)", async () => {
    // The password was correct — Firebase wouldn't surface MFA-required if it
    // weren't. Emitting failure here would poison the Phase 9 OBS-05 anomaly
    // counters. The real audit event fires from verifyMfaCode on completion.
    const mfaErr = Object.assign(new Error("MFA required"), {
      code: "auth/multi-factor-auth-required",
    });
    fbSignInWithEmailAndPassword.mockRejectedValueOnce(mfaErr);
    fbGetMultiFactorResolver.mockReturnValueOnce({ hints: [{ uid: "f1" }] });

    await expect(auth.signInEmailPassword("u@example.com", "pw")).rejects.toBeInstanceOf(
      auth.MfaRequiredError,
    );

    const failureEmits = emitAuditEventSpy.mock.calls.filter(
      ([type]) => type === "auth.signin.failure",
    );
    expect(failureEmits).toHaveLength(0);
  });
});

describe("verifyMfaCode — completes the 2-factor sign-in", () => {
  it("builds assertion against resolver.hints[0].uid + calls resolveSignIn", async () => {
    const resolver = {
      hints: [{ uid: "factor-1", factorId: "totp" }],
      resolveSignIn: vi.fn(async () => ({ user: { uid: "u-1" } })),
    };
    const result = await auth.verifyMfaCode(resolver, "123456");
    expect(totpAssertionForSignIn).toHaveBeenCalledWith("factor-1", "123456");
    expect(resolver.resolveSignIn).toHaveBeenCalledWith({ kind: "totp-assertion" });
    expect(result).toEqual({ user: { uid: "u-1" } });
  });

  it("throws MfaCodeInvalidError when Firebase rejects the TOTP code", async () => {
    const resolver = {
      hints: [{ uid: "factor-1", factorId: "totp" }],
      resolveSignIn: vi.fn(async () => {
        throw Object.assign(new Error("bad code"), {
          code: "auth/invalid-verification-code",
        });
      }),
    };
    await expect(auth.verifyMfaCode(resolver, "999999")).rejects.toBeInstanceOf(
      auth.MfaCodeInvalidError,
    );
  });

  it("emits auth.signin.success with payload.method='totp' on successful resolve", async () => {
    const resolver = {
      hints: [{ uid: "factor-1", factorId: "totp" }],
      resolveSignIn: vi.fn(async () => ({ user: { uid: "u-1" } })),
    };
    await auth.verifyMfaCode(resolver, "123456");
    const successEmits = emitAuditEventSpy.mock.calls.filter(
      ([type]) => type === "auth.signin.success",
    );
    expect(successEmits).toHaveLength(1);
    const [, , payload] = successEmits[0];
    expect(payload).toEqual({ method: "totp" });
  });
});
