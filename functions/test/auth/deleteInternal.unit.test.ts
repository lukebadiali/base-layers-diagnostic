// Unit tests for the deleteInternal callable. Pure-mocked — mirrors
// deleteClient (which deliberately REFUSES admin/internal targets, so it can't
// be reused for staff). deleteInternal is the inverse: admin-only, deletes ONLY
// admin/internal targets, and refuses self-deletion (which alone prevents total
// admin lock-out — the last admin can never delete themselves).
//
// Coverage:
//   1. Non-admin callers (internal AND client) -> permission-denied.
//   2. Self-delete -> failed-precondition; no idempotency / lookup / delete; audit failed.
//   3. Zod fail -> invalid-argument.
//   4. Idempotency key shape + scope + 5-min window.
//   5. Happy delete (internal target) -> deleteUser + mirror delete + audit + {deleted:true}.
//   6. Happy delete (admin target).
//   7. Non-privileged target (client) -> failed-precondition; no delete; audit failed.
//   8. user-not-found -> not-found; audit failed.

import { describe, it, expect, beforeEach, vi } from "vitest";

const getUserSpy = vi.fn();
const deleteUserSpy = vi.fn();

const firestoreDeleteSpy = vi.fn();
const firestoreDocSpy = vi.fn(() => ({ delete: firestoreDeleteSpy }));

const ensureIdempotentSpy = vi.fn();
const writeAuditEventSpy = vi.fn();

vi.mock("firebase-admin/app", () => ({
  initializeApp: () => ({}),
  getApps: () => [{}],
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ getUser: getUserSpy, deleteUser: deleteUserSpy }),
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({ doc: firestoreDocSpy }),
}));

vi.mock("firebase-functions/v2/https", () => ({
  onCall: (_opts: unknown, handler: (req: unknown) => Promise<unknown>) => handler,
  HttpsError: class HttpsError extends Error {
    public code: string;
    public details: unknown;
    constructor(code: string, message: string, details?: unknown) {
      super(message);
      this.code = code;
      this.details = details;
    }
  },
}));

vi.mock("firebase-functions/params", () => ({
  defineSecret: (name: string) => ({ name, value: () => "" }),
}));

vi.mock("firebase-functions/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("../../src/util/idempotency.js", () => ({
  ensureIdempotent: (key: string, scope: string, windowSec: number) =>
    ensureIdempotentSpy(key, scope, windowSec),
}));

vi.mock("../../src/util/sentry.js", () => ({
  withSentry: <TIn, TOut>(h: (req: TIn) => Promise<TOut>) => h,
}));

vi.mock("../../src/audit/auditLogger.js", () => ({
  writeAuditEvent: (input: unknown, ctx: unknown) => writeAuditEventSpy(input, ctx),
}));

const VALID_REQ_ID = "550e8400-e29b-41d4-a716-446655440000";

const adminAuthCtx = {
  uid: "admin-uid",
  token: { role: "admin", email: "admin@example.com", orgId: null },
};

const baseValidData = { uid: "target-staff-uid", clientReqId: VALID_REQ_ID };

beforeEach(() => {
  getUserSpy.mockReset().mockResolvedValue({
    uid: "target-staff-uid",
    customClaims: { role: "internal", orgId: null },
  });
  deleteUserSpy.mockReset().mockResolvedValue(undefined);
  firestoreDeleteSpy.mockReset().mockResolvedValue(undefined);
  firestoreDocSpy.mockClear();
  ensureIdempotentSpy.mockReset().mockResolvedValue(undefined);
  writeAuditEventSpy.mockReset().mockResolvedValue(undefined);
});

async function loadHandler(): Promise<(req: unknown) => Promise<unknown>> {
  vi.resetModules();
  const mod = await import("../../src/auth/deleteInternal.js");
  return mod.deleteInternal as unknown as (req: unknown) => Promise<unknown>;
}

describe("deleteInternal — role gate (admin-only)", () => {
  it("throws permission-denied for a client-role caller", async () => {
    const handler = await loadHandler();
    await expect(
      handler({ auth: { uid: "u1", token: { role: "client" } }, data: { ...baseValidData } }),
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(deleteUserSpy).not.toHaveBeenCalled();
  });

  it("throws permission-denied for an internal-role caller (only admins remove staff)", async () => {
    const handler = await loadHandler();
    await expect(
      handler({ auth: { uid: "int", token: { role: "internal" } }, data: { ...baseValidData } }),
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(deleteUserSpy).not.toHaveBeenCalled();
  });
});

describe("deleteInternal — self-delete guard (lock-out prevention)", () => {
  it("refuses when target uid === caller uid; no idempotency, lookup, or delete; audits failure", async () => {
    const handler = await loadHandler();
    await expect(
      handler({ auth: adminAuthCtx, data: { uid: "admin-uid", clientReqId: VALID_REQ_ID } }),
    ).rejects.toMatchObject({
      code: "failed-precondition",
      details: { code: "auth/cannot-delete-self" },
    });
    expect(ensureIdempotentSpy).not.toHaveBeenCalled();
    expect(getUserSpy).not.toHaveBeenCalled();
    expect(deleteUserSpy).not.toHaveBeenCalled();
    const [emitted] = writeAuditEventSpy.mock.calls[0];
    expect(emitted).toMatchObject({
      type: "auth.internal.delete.failed",
      payload: { reason: "self-delete" },
    });
  });
});

describe("deleteInternal — input validation", () => {
  it("throws invalid-argument when uid is missing", async () => {
    const handler = await loadHandler();
    await expect(
      handler({ auth: adminAuthCtx, data: { clientReqId: VALID_REQ_ID } }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(deleteUserSpy).not.toHaveBeenCalled();
  });
});

describe("deleteInternal — idempotency before side effect", () => {
  it("invokes ensureIdempotent with the canonical key shape + scope + 5-min window", async () => {
    const handler = await loadHandler();
    await handler({ auth: adminAuthCtx, data: { ...baseValidData } });
    expect(ensureIdempotentSpy).toHaveBeenCalledTimes(1);
    const [key, scope, windowSec] = ensureIdempotentSpy.mock.calls[0];
    expect(key).toBe(`admin-uid:deleteInternal:${baseValidData.uid}:${VALID_REQ_ID}`);
    expect(scope).toBe("deleteInternal");
    expect(windowSec).toBe(5 * 60);
  });
});

describe("deleteInternal — happy delete", () => {
  it("deletes the Auth user + mirror doc, audits, and returns {deleted:true} (internal target)", async () => {
    const handler = await loadHandler();
    const result = await handler({ auth: adminAuthCtx, data: { ...baseValidData } });
    expect(result).toEqual({ uid: "target-staff-uid", deleted: true });
    expect(deleteUserSpy).toHaveBeenCalledWith("target-staff-uid");
    expect(firestoreDocSpy).toHaveBeenCalledWith("users/target-staff-uid");
    expect(firestoreDeleteSpy).toHaveBeenCalledTimes(1);
    const [emitted] = writeAuditEventSpy.mock.calls[0];
    expect(emitted).toMatchObject({
      type: "auth.internal.delete",
      target: { type: "user", id: "target-staff-uid" },
      payload: { targetRole: "internal" },
    });
  });

  it("deletes an admin target too", async () => {
    getUserSpy.mockResolvedValueOnce({
      uid: "target-staff-uid",
      customClaims: { role: "admin", orgId: null },
    });
    const handler = await loadHandler();
    const result = await handler({ auth: adminAuthCtx, data: { ...baseValidData } });
    expect(result).toEqual({ uid: "target-staff-uid", deleted: true });
    expect(deleteUserSpy).toHaveBeenCalledWith("target-staff-uid");
  });
});

describe("deleteInternal — non-privileged target refusal", () => {
  it("refuses to delete a client target (use deleteClient instead); no delete; audits failure", async () => {
    getUserSpy.mockResolvedValueOnce({
      uid: "target-staff-uid",
      customClaims: { role: "client", orgId: "org-alpha" },
    });
    const handler = await loadHandler();
    await expect(
      handler({ auth: adminAuthCtx, data: { ...baseValidData } }),
    ).rejects.toMatchObject({
      code: "failed-precondition",
      details: { code: "auth/not-an-internal-user" },
    });
    expect(deleteUserSpy).not.toHaveBeenCalled();
    expect(firestoreDeleteSpy).not.toHaveBeenCalled();
    const [emitted] = writeAuditEventSpy.mock.calls[0];
    expect(emitted).toMatchObject({
      type: "auth.internal.delete.failed",
      payload: { reason: "not-privileged" },
    });
  });
});

describe("deleteInternal — user-not-found", () => {
  it("throws not-found + audits failure when the target uid does not exist", async () => {
    getUserSpy.mockReset().mockRejectedValueOnce(
      Object.assign(new Error("not found"), { code: "auth/user-not-found" }),
    );
    const handler = await loadHandler();
    await expect(
      handler({ auth: adminAuthCtx, data: { ...baseValidData } }),
    ).rejects.toMatchObject({
      code: "not-found",
      details: { code: "auth/user-not-found" },
    });
    expect(deleteUserSpy).not.toHaveBeenCalled();
    const [emitted] = writeAuditEventSpy.mock.calls[0];
    expect(emitted).toMatchObject({
      type: "auth.internal.delete.failed",
      payload: { reason: "user-not-found" },
    });
  });
});
