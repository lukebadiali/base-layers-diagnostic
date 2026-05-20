// tests/firebase/auth-update-password.test.js
// @ts-nocheck
// Phase 6 follow-up (UAT-discovered firstRun loop): Firebase's updatePassword
// revokes the user's refresh tokens server-side immediately on success. Any
// subsequent ID-token-requiring call (setClaims callable, audit emit, Firestore
// listener) fails with auth/user-token-expired and onAuthStateChanged fires
// with null, bouncing the user to the home screen. Because setClaims failed,
// the `firstRun: true` custom claim is never flipped — so next sign-in routes
// the user back to the first-run set-password screen, looping forever.
//
// Fix: immediately after fbUpdatePassword resolves, reauthenticate using the
// brand-new credential (EmailAuthProvider.credential(email, newPassword)) so
// Firebase Auth mints a fresh ID token tied to the new password. setClaims
// then succeeds, claim flips, and render proceeds to the MFA enrol path.
// updatePassword is only called from renderFirstRun (pre-MFA), so the reauth
// does not trigger an MFA challenge.

import { describe, it, expect, beforeEach, vi } from "vitest";

const fbUpdatePasswordSpy = vi.fn();
const fbReauthenticateWithCredentialSpy = vi.fn();
const fbEmailAuthProviderCredentialSpy = vi.fn((email, password) => ({
  providerId: "password",
  email,
  password,
}));
const setClaimsSpy = vi.fn(async () => undefined);
const emitAuditEventSpy = vi.fn();
const getIdTokenResultSpy = vi.fn();
const getIdTokenSpy = vi.fn();

vi.mock("../../src/observability/audit-events.js", () => ({
  emitAuditEvent: (...args) => emitAuditEventSpy(...args),
  AUDIT_EVENTS: {},
}));
vi.mock("../../src/cloud/claims-admin.js", () => ({
  setClaims: (...args) => setClaimsSpy(...args),
}));

const mockUser = {
  uid: "u-1",
  email: "new@bedeveloped.com",
  getIdTokenResult: (...args) => getIdTokenResultSpy(...args),
  getIdToken: (...args) => getIdTokenSpy(...args),
};

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  multiFactor: vi.fn(),
  TotpMultiFactorGenerator: {
    generateSecret: vi.fn(),
    assertionForEnrollment: vi.fn(),
    assertionForSignIn: vi.fn(),
  },
  updatePassword: (...args) => fbUpdatePasswordSpy(...args),
  sendSignInLinkToEmail: vi.fn(),
  isSignInWithEmailLink: vi.fn(),
  signInWithEmailLink: vi.fn(),
  sendEmailVerification: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  getMultiFactorResolver: vi.fn(),
  reauthenticateWithCredential: (...args) => fbReauthenticateWithCredentialSpy(...args),
  EmailAuthProvider: {
    credential: (...args) => fbEmailAuthProviderCredentialSpy(...args),
  },
}));

vi.mock("../../src/firebase/app.js", () => ({
  auth: { currentUser: mockUser },
}));

const auth = await import("../../src/firebase/auth.js");

beforeEach(() => {
  fbUpdatePasswordSpy.mockReset();
  fbReauthenticateWithCredentialSpy.mockReset();
  fbEmailAuthProviderCredentialSpy.mockClear();
  setClaimsSpy.mockReset();
  setClaimsSpy.mockImplementation(async () => undefined);
  emitAuditEventSpy.mockReset();
  getIdTokenResultSpy.mockReset();
  getIdTokenSpy.mockReset();
  getIdTokenSpy.mockResolvedValue("fresh-id-token");
  fbUpdatePasswordSpy.mockResolvedValue(undefined);
  fbReauthenticateWithCredentialSpy.mockResolvedValue({ user: mockUser });
});

describe("updatePassword — reauthenticate after password change", () => {
  it("calls reauthenticateWithCredential with EmailAuthProvider.credential after fbUpdatePassword", async () => {
    getIdTokenResultSpy.mockResolvedValue({
      claims: { firstRun: true, role: "admin", orgId: null },
    });

    await auth.updatePassword("newSecurePw1234");

    expect(fbUpdatePasswordSpy).toHaveBeenCalledTimes(1);
    expect(fbEmailAuthProviderCredentialSpy).toHaveBeenCalledWith(
      "new@bedeveloped.com",
      "newSecurePw1234",
    );
    expect(fbReauthenticateWithCredentialSpy).toHaveBeenCalledTimes(1);
    expect(fbReauthenticateWithCredentialSpy).toHaveBeenCalledWith(
      mockUser,
      expect.objectContaining({ providerId: "password", password: "newSecurePw1234" }),
    );
  });

  it("calls fbUpdatePassword → reauthenticateWithCredential → setClaims in that order", async () => {
    getIdTokenResultSpy.mockResolvedValue({
      claims: { firstRun: true, role: "internal", orgId: null },
    });

    const callOrder = [];
    fbUpdatePasswordSpy.mockImplementation(async () => {
      callOrder.push("updatePassword");
    });
    fbReauthenticateWithCredentialSpy.mockImplementation(async () => {
      callOrder.push("reauthenticate");
      return { user: mockUser };
    });
    setClaimsSpy.mockImplementation(async () => {
      callOrder.push("setClaims");
    });

    await auth.updatePassword("newSecurePw1234");

    expect(callOrder).toEqual(["updatePassword", "reauthenticate", "setClaims"]);
  });

  it("does NOT call setClaims when firstRun claim is absent (no flip needed)", async () => {
    getIdTokenResultSpy.mockResolvedValue({ claims: { role: "admin", orgId: null } });

    await auth.updatePassword("newSecurePw1234");

    expect(fbReauthenticateWithCredentialSpy).toHaveBeenCalledTimes(1);
    expect(setClaimsSpy).not.toHaveBeenCalled();
  });

  it("does not throw when reauth fails — password update is preserved", async () => {
    // If reauth fails, Firebase has still applied the password change. The
    // user will be bounced via onAuthStateChanged; on next sign-in they use
    // the new password. Better than re-throwing and confusing the caller into
    // thinking the password update itself failed.
    getIdTokenResultSpy.mockResolvedValue({
      claims: { firstRun: true, role: "admin", orgId: null },
    });
    fbReauthenticateWithCredentialSpy.mockRejectedValueOnce(
      Object.assign(new Error("session lost"), { code: "auth/user-token-expired" }),
    );

    await expect(auth.updatePassword("newSecurePw1234")).resolves.toBeUndefined();
    expect(fbUpdatePasswordSpy).toHaveBeenCalledTimes(1);
    // setClaims should be skipped since reauth failed and fresh token isn't available
    expect(setClaimsSpy).not.toHaveBeenCalled();
  });

  it("emits auth.password.change exactly once on successful update + reauth", async () => {
    getIdTokenResultSpy.mockResolvedValue({
      claims: { firstRun: true, role: "admin", orgId: null },
    });

    await auth.updatePassword("newSecurePw1234");

    const passwordChangeCalls = emitAuditEventSpy.mock.calls.filter(
      ([type]) => type === "auth.password.change",
    );
    expect(passwordChangeCalls).toHaveLength(1);
    expect(passwordChangeCalls[0][1]).toEqual({ type: "user", id: "u-1", orgId: null });
    expect(passwordChangeCalls[0][2]).toEqual({});
  });
});
