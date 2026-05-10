// tests/firebase/auth-audit-emit.test.js
// @ts-nocheck
// Phase 9 Wave 4 (AUDIT-05): pins emitAuditEvent wiring at six call sites in
// src/firebase/auth.js. Mocks firebase/auth + ./app.js + the audit-events proxy
// so the test exercises ONLY the wrapper-side emission logic — no real
// Firebase, no real Firestore round-trip.
//
// @ts-nocheck applied for vi.mock factory pattern (matches tests/main.test.js
// and tests/observability/audit-events.test.js).

import { describe, it, expect, beforeEach, vi } from "vitest";

// --- mocks must be hoisted; declared with `let` + assigned inside factories ---
const emitAuditEventSpy = vi.fn();

// Mock the audit-events proxy: emitAuditEvent is what auth.js calls.
vi.mock("../../src/observability/audit-events.js", () => ({
  emitAuditEvent: (...args) => emitAuditEventSpy(...args),
  AUDIT_EVENTS: {},
}));

// Mock claims-admin.js so updatePassword's BLOCKER-FIX 1 setClaims call is
// inert in tests (the audit emit happens regardless).
vi.mock("../../src/cloud/claims-admin.js", () => ({
  setClaims: vi.fn(async () => undefined),
}));

// Mock firebase/auth — every named import auth.js uses.
const fbSignInWithEmailAndPassword = vi.fn();
const fbSignOutSpy = vi.fn(async () => undefined);
const fbMultiFactorSpy = vi.fn();
const fbUpdatePasswordSpy = vi.fn(async () => undefined);
const fbSendSignInLinkToEmailSpy = vi.fn(async () => undefined);
const fbIsSignInWithEmailLinkSpy = vi.fn(() => true);
const fbSignInWithEmailLinkSpy = vi.fn(async () => ({ user: { uid: "elinkUid" } }));
const fbSendEmailVerificationSpy = vi.fn(async () => undefined);
const fbSendPasswordResetEmailSpy = vi.fn(async () => undefined);

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: (...args) => fbSignInWithEmailAndPassword(...args),
  signOut: (...args) => fbSignOutSpy(...args),
  multiFactor: (...args) => fbMultiFactorSpy(...args),
  updatePassword: (...args) => fbUpdatePasswordSpy(...args),
  sendSignInLinkToEmail: (...args) => fbSendSignInLinkToEmailSpy(...args),
  isSignInWithEmailLink: (...args) => fbIsSignInWithEmailLinkSpy(...args),
  signInWithEmailLink: (...args) => fbSignInWithEmailLinkSpy(...args),
  sendEmailVerification: (...args) => fbSendEmailVerificationSpy(...args),
  sendPasswordResetEmail: (...args) => fbSendPasswordResetEmailSpy(...args),
}));

// Mutable currentUser bound at the top so tests can flip it per case.
let mockCurrentUser = { uid: "u-current", getIdTokenResult: vi.fn(), getIdToken: vi.fn() };

// Mock ./app.js — auth instance is consumed via auth.currentUser.
vi.mock("../../src/firebase/app.js", () => ({
  auth: {
    get currentUser() {
      return mockCurrentUser;
    },
  },
}));

// Single-load: import the module under test AFTER all mocks are declared.
const auth = await import("../../src/firebase/auth.js");

beforeEach(() => {
  emitAuditEventSpy.mockReset();
  fbSignInWithEmailAndPassword.mockReset();
  fbSignOutSpy.mockReset();
  fbSignOutSpy.mockResolvedValue(undefined);
  fbUpdatePasswordSpy.mockReset();
  fbUpdatePasswordSpy.mockResolvedValue(undefined);
  fbSendPasswordResetEmailSpy.mockReset();
  fbSendPasswordResetEmailSpy.mockResolvedValue(undefined);
  fbSignInWithEmailLinkSpy.mockReset();
  fbSignInWithEmailLinkSpy.mockResolvedValue({ user: { uid: "elinkUid" } });
  mockCurrentUser = {
    uid: "u-current",
    getIdTokenResult: vi.fn(async () => ({ claims: {} })),
    getIdToken: vi.fn(async () => "token"),
  };
});

describe("Phase 9 AUDIT-05 — src/firebase/auth.js emit-site wiring", () => {
  it("Test 1: signInEmailPassword success emits auth.signin.success with empty payload (no PII)", async () => {
    fbSignInWithEmailAndPassword.mockResolvedValueOnce({ user: { uid: "u-success" } });
    await auth.signInEmailPassword("u@example.com", "pw");
    expect(emitAuditEventSpy).toHaveBeenCalledTimes(1);
    const [type, target, payload] = emitAuditEventSpy.mock.calls[0];
    expect(type).toBe("auth.signin.success");
    expect(target).toEqual({ type: "user", id: "u-current", orgId: null });
    expect(payload).toEqual({});
    // Pitfall 17: no PII fields ever leak into payload
    expect(payload.email).toBeUndefined();
    expect(payload.password).toBeUndefined();
    expect(payload.actor).toBeUndefined();
  });

  it("Test 2: signInEmailPassword failure emits auth.signin.failure and rethrows SignInError", async () => {
    const credErr = Object.assign(new Error("creds"), { code: "auth/wrong-password" });
    fbSignInWithEmailAndPassword.mockRejectedValueOnce(credErr);

    await expect(auth.signInEmailPassword("u@example.com", "wrong")).rejects.toBeInstanceOf(
      auth.SignInError,
    );
    expect(emitAuditEventSpy).toHaveBeenCalledTimes(1);
    const [type, target, payload] = emitAuditEventSpy.mock.calls[0];
    expect(type).toBe("auth.signin.failure");
    expect(target).toEqual({ type: "user", id: "u-current", orgId: null });
    expect(payload).toEqual({});
  });

  it("Test 3: signOut emits auth.signout BEFORE fbSignOut (PRE-emit ordering)", async () => {
    let signOutCalledFirst = false;
    let emitCalledFirst = false;
    let order = 0;
    emitAuditEventSpy.mockImplementationOnce(() => {
      emitCalledFirst = order === 0;
      order = 1;
    });
    fbSignOutSpy.mockImplementationOnce(async () => {
      signOutCalledFirst = order === 0;
      order = 2;
    });

    await auth.signOut();

    // PRE-emit: emit must be observed BEFORE fbSignOut
    expect(emitCalledFirst).toBe(true);
    expect(signOutCalledFirst).toBe(false);
    expect(emitAuditEventSpy).toHaveBeenCalledWith(
      "auth.signout",
      { type: "user", id: "u-current", orgId: null },
      {},
    );
    expect(fbSignOutSpy).toHaveBeenCalledTimes(1);
  });

  it("Test 4: updatePassword emits auth.password.change after fbUpdatePassword", async () => {
    await auth.updatePassword("newPw1234");
    // Should fire auth.password.change exactly once with empty payload
    const passwordChangeCalls = emitAuditEventSpy.mock.calls.filter(
      ([type]) => type === "auth.password.change",
    );
    expect(passwordChangeCalls).toHaveLength(1);
    const [, target, payload] = passwordChangeCalls[0];
    expect(target).toEqual({ type: "user", id: "u-current", orgId: null });
    expect(payload).toEqual({});
    expect(fbUpdatePasswordSpy).toHaveBeenCalledTimes(1);
  });

  it("Test 5: sendPasswordResetEmail emits auth.password.reset with EMPTY payload (no email leak)", async () => {
    await auth.sendPasswordResetEmail("user@example.com");
    expect(emitAuditEventSpy).toHaveBeenCalledTimes(1);
    const [type, target, payload] = emitAuditEventSpy.mock.calls[0];
    expect(type).toBe("auth.password.reset");
    expect(target).toEqual({ type: "user", id: "unknown", orgId: null });
    // Pitfall 17 invariant: caller is unauthenticated; email NEVER goes in payload
    expect(payload).toEqual({});
    expect(payload.email).toBeUndefined();
    expect(fbSendPasswordResetEmailSpy).toHaveBeenCalledTimes(1);
  });

  it("Test 6: signInWithEmailLink emits auth.signin.success with payload.method='emailLink'", async () => {
    await auth.signInWithEmailLink("user@example.com", "https://link/url");
    expect(emitAuditEventSpy).toHaveBeenCalledTimes(1);
    const [type, target, payload] = emitAuditEventSpy.mock.calls[0];
    expect(type).toBe("auth.signin.success");
    expect(target).toEqual({ type: "user", id: "u-current", orgId: null });
    expect(payload).toEqual({ method: "emailLink" });
    // Verify NO PII keys
    expect(payload.email).toBeUndefined();
    expect(fbSignInWithEmailLinkSpy).toHaveBeenCalledTimes(1);
  });

  it("Test 7: emitAuditEvent throwing inside the finally clause does NOT bubble out (best-effort)", async () => {
    // Sign-in success path — emit is in `finally`. If emit throws, the auth
    // result MUST still be returned (Pattern 5 #2: never block originating op).
    fbSignInWithEmailAndPassword.mockResolvedValueOnce({ user: { uid: "u-success-2" } });
    emitAuditEventSpy.mockImplementationOnce(() => {
      throw new Error("audit emission exploded");
    });
    // The emit failure must NOT propagate — sign-in completes normally.
    const result = await auth.signInEmailPassword("u@example.com", "pw");
    expect(result).toEqual({ user: { uid: "u-success-2" } });
    expect(emitAuditEventSpy).toHaveBeenCalledTimes(1);
  });
});
