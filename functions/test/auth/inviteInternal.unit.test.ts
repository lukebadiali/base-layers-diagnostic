// Unit tests for the inviteInternal callable. Pure-mocked (every Admin SDK
// module stubbed via vi.mock) — mirrors inviteClient.unit.test.ts. The
// pure helpers (generateTempPassword, buildInternalInviteClaims) are NOT
// mocked: they're side-effect-free and exercised for real.
//
// Coverage:
//   1. Non-admin callers (internal AND client) -> permission-denied; no side effects.
//      (Stricter than inviteClient: only admins may mint staff.)
//   2. Zod fail (missing email / bad role / non-uuid) -> invalid-argument; no idempotency.
//   3. Idempotency key shape + scope + 5-min window.
//   4. Happy create (internal) -> createUser(strong temp pw) + claims + mirror doc + audit + {uid,tempPassword}.
//   5. Happy create (admin) -> claims role:"admin".
//   6. Email already exists + HEALTHY -> already-exists; no createUser/claims/mirror.
//   7. getUserByEmail non-user-not-found error -> internal; no createUser.
//   8. (2026-10) Existing-but-unusable states are classified, and surfaced in
//      err.details as {state, reclaimable, uid} so the UI can offer reactivation
//      instead of dead-ending. Still refused without reclaim:true.
//   9. (2026-10) reclaim:true on a reclaimable state revives IN PLACE: same uid,
//      re-enabled, MFA cleared, claims reset with firstRun, profile overwritten,
//      redactionList row cleared, audit carries reclaimedFrom.
//  10. (2026-10) reclaim:true on a HEALTHY or CLIENT account is still refused —
//      reclaim must never be a way to hijack a live colleague's account.

import { describe, it, expect, beforeEach, vi } from "vitest";

const getUserByEmailSpy = vi.fn();
const createUserSpy = vi.fn();
const setCustomUserClaimsSpy = vi.fn();
const updateUserSpy = vi.fn();

const firestoreSetSpy = vi.fn();
const firestoreDeleteSpy = vi.fn();
// Path-aware doc() mock: the reclaim path reads users/{uid} and
// redactionList/{uid} and writes/deletes both, so the stub has to tell them
// apart. Seeded per-test via seedDocs().
let docState: Record<string, { exists: boolean; data?: Record<string, unknown> }> = {};
const firestoreDocSpy = vi.fn((path: string) => ({
  set: (v: unknown) => firestoreSetSpy(path, v),
  delete: () => firestoreDeleteSpy(path),
  get: async () => {
    const hit = docState[path] ?? { exists: false };
    return { exists: hit.exists, data: () => hit.data ?? {} };
  },
}));

function seedDocs(state: Record<string, { exists: boolean; data?: Record<string, unknown> }>) {
  docState = state;
}

const ensureIdempotentSpy = vi.fn();
const writeAuditEventSpy = vi.fn();

vi.mock("firebase-admin/app", () => ({
  initializeApp: () => ({}),
  getApps: () => [{}],
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({
    getUserByEmail: getUserByEmailSpy,
    createUser: createUserSpy,
    setCustomUserClaims: setCustomUserClaimsSpy,
    updateUser: updateUserSpy,
  }),
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

const baseValidData = {
  email: "newstaff@bedeveloped.com",
  name: "New Staff",
  role: "internal" as const,
  clientReqId: VALID_REQ_ID,
};

beforeEach(() => {
  getUserByEmailSpy.mockReset();
  createUserSpy.mockReset().mockResolvedValue({ uid: "new-staff-uid" });
  setCustomUserClaimsSpy.mockReset().mockResolvedValue(undefined);
  updateUserSpy.mockReset().mockResolvedValue(undefined);
  firestoreSetSpy.mockReset().mockResolvedValue(undefined);
  firestoreDeleteSpy.mockReset().mockResolvedValue(undefined);
  firestoreDocSpy.mockClear();
  docState = {};
  ensureIdempotentSpy.mockReset().mockResolvedValue(undefined);
  writeAuditEventSpy.mockReset().mockResolvedValue(undefined);
});

async function loadHandler(): Promise<(req: unknown) => Promise<unknown>> {
  vi.resetModules();
  const mod = await import("../../src/auth/inviteInternal.js");
  return mod.inviteInternal as unknown as (req: unknown) => Promise<unknown>;
}

// getUserByEmail rejecting with user-not-found = the "email is free" path.
function seedEmailFree() {
  getUserByEmailSpy.mockRejectedValueOnce(
    Object.assign(new Error("not found"), { code: "auth/user-not-found" }),
  );
}

describe("inviteInternal — role gate (admin-only, Pitfall 17)", () => {
  it("throws permission-denied for a client-role caller; no side effects", async () => {
    const handler = await loadHandler();
    await expect(
      handler({ auth: { uid: "u1", token: { role: "client" } }, data: { ...baseValidData } }),
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(ensureIdempotentSpy).not.toHaveBeenCalled();
    expect(createUserSpy).not.toHaveBeenCalled();
  });

  it("throws permission-denied for an INTERNAL-role caller (only admins mint staff)", async () => {
    const handler = await loadHandler();
    await expect(
      handler({
        auth: { uid: "int-uid", token: { role: "internal" } },
        data: { ...baseValidData },
      }),
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(createUserSpy).not.toHaveBeenCalled();
  });
});

describe("inviteInternal — input validation", () => {
  it("throws invalid-argument when email is missing; ensureIdempotent NOT called", async () => {
    const handler = await loadHandler();
    await expect(
      handler({
        auth: adminAuthCtx,
        data: { name: "X", role: "internal", clientReqId: VALID_REQ_ID },
      }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(ensureIdempotentSpy).not.toHaveBeenCalled();
    expect(createUserSpy).not.toHaveBeenCalled();
  });

  it("throws invalid-argument for a role outside {admin, internal}", async () => {
    const handler = await loadHandler();
    await expect(
      handler({ auth: adminAuthCtx, data: { ...baseValidData, role: "client" } }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });

  it("throws invalid-argument when clientReqId is not a UUID", async () => {
    const handler = await loadHandler();
    await expect(
      handler({ auth: adminAuthCtx, data: { ...baseValidData, clientReqId: "nope" } }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });
});

describe("inviteInternal — idempotency before side effect", () => {
  it("invokes ensureIdempotent with the canonical key shape + scope + 5-min window", async () => {
    seedEmailFree();
    const handler = await loadHandler();
    await handler({ auth: adminAuthCtx, data: { ...baseValidData } });
    expect(ensureIdempotentSpy).toHaveBeenCalledTimes(1);
    const [key, scope, windowSec] = ensureIdempotentSpy.mock.calls[0];
    expect(key).toBe(`admin-uid:inviteInternal:${baseValidData.email}:${VALID_REQ_ID}`);
    expect(scope).toBe("inviteInternal");
    expect(windowSec).toBe(5 * 60);
  });
});

describe("inviteInternal — happy create (internal)", () => {
  it("creates the Auth user with a strong temp password + emailVerified, sets staff claims, writes the mirror doc, audits, and returns the temp password", async () => {
    seedEmailFree();
    createUserSpy.mockResolvedValueOnce({ uid: "new-staff-uid" });
    const handler = await loadHandler();

    const result = (await handler({ auth: adminAuthCtx, data: { ...baseValidData } })) as {
      uid: string;
      tempPassword: string;
      existed: boolean;
    };

    // createUser called once with a generated password we did NOT supply.
    expect(createUserSpy).toHaveBeenCalledTimes(1);
    const createArg = createUserSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(createArg.email).toBe(baseValidData.email);
    expect(createArg.emailVerified).toBe(true);
    expect(createArg.displayName).toBe(baseValidData.name);
    expect(typeof createArg.password).toBe("string");
    expect((createArg.password as string).length).toBeGreaterThanOrEqual(20);

    // The returned temp password is exactly the one the user was created with.
    expect(result.tempPassword).toBe(createArg.password);
    expect(result).toMatchObject({ uid: "new-staff-uid", existed: false });

    // Staff claims: orgId null + firstRun true.
    expect(setCustomUserClaimsSpy).toHaveBeenCalledWith("new-staff-uid", {
      role: "internal",
      orgId: null,
      firstRun: true,
    });

    // Mirror /users/{uid} doc so the admin "Internal team" table shows them.
    expect(firestoreDocSpy).toHaveBeenCalledWith("users/new-staff-uid");
    const mirror = firestoreSetSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(mirror).toMatchObject({
      id: "new-staff-uid",
      email: baseValidData.email,
      name: baseValidData.name,
      role: "internal",
      orgId: null,
    });

    // Audit emit — NO temp password in the payload (Pitfall 17).
    expect(writeAuditEventSpy).toHaveBeenCalledTimes(1);
    const [emitted] = writeAuditEventSpy.mock.calls[0];
    expect(emitted).toMatchObject({
      type: "auth.internal.invite",
      target: { type: "user", id: "new-staff-uid" },
      payload: { newRole: "internal" },
    });
    expect(JSON.stringify(emitted)).not.toContain(result.tempPassword);
  });
});

describe("inviteInternal — happy create (admin role)", () => {
  it("sets role:'admin' in the claims + mirror doc", async () => {
    seedEmailFree();
    createUserSpy.mockResolvedValueOnce({ uid: "new-admin-uid" });
    const handler = await loadHandler();
    await handler({ auth: adminAuthCtx, data: { ...baseValidData, role: "admin" } });
    expect(setCustomUserClaimsSpy).toHaveBeenCalledWith("new-admin-uid", {
      role: "admin",
      orgId: null,
      firstRun: true,
    });
    const mirror = firestoreSetSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(mirror).toMatchObject({ role: "admin" });
  });
});

// A live, working colleague: enabled, staff claims, intact profile.
function seedHealthyExisting() {
  getUserByEmailSpy.mockResolvedValueOnce({
    uid: "existing-uid",
    disabled: false,
    customClaims: { role: "internal", orgId: null },
  });
  seedDocs({
    "users/existing-uid": {
      exists: true,
      data: { id: "existing-uid", email: baseValidData.email, role: "internal" },
    },
    "redactionList/existing-uid": { exists: false },
  });
}

describe("inviteInternal — email already exists (healthy)", () => {
  it("refuses with already-exists and performs NO mutation", async () => {
    seedHealthyExisting();
    const handler = await loadHandler();
    await expect(
      handler({ auth: adminAuthCtx, data: { ...baseValidData } }),
    ).rejects.toMatchObject({ code: "already-exists" });
    expect(createUserSpy).not.toHaveBeenCalled();
    expect(setCustomUserClaimsSpy).not.toHaveBeenCalled();
    expect(updateUserSpy).not.toHaveBeenCalled();
    expect(firestoreSetSpy).not.toHaveBeenCalled();
  });

  it("marks a healthy account NOT reclaimable, and reclaim:true cannot override", async () => {
    seedHealthyExisting();
    const handler = await loadHandler();
    await expect(
      handler({ auth: adminAuthCtx, data: { ...baseValidData, reclaim: true } }),
    ).rejects.toMatchObject({
      code: "already-exists",
      details: { state: "healthy", reclaimable: false },
    });
    expect(updateUserSpy).not.toHaveBeenCalled();
    expect(firestoreSetSpy).not.toHaveBeenCalled();
  });

  it("refuses a client-role account as not reclaimable even with reclaim:true", async () => {
    getUserByEmailSpy.mockResolvedValueOnce({
      uid: "client-uid",
      disabled: false,
      customClaims: { role: "client", orgId: "org-1" },
    });
    seedDocs({
      "users/client-uid": { exists: true, data: { id: "client-uid", role: "client" } },
      "redactionList/client-uid": { exists: false },
    });
    const handler = await loadHandler();
    await expect(
      handler({ auth: adminAuthCtx, data: { ...baseValidData, reclaim: true } }),
    ).rejects.toMatchObject({
      code: "already-exists",
      details: { state: "client", reclaimable: false },
    });
    expect(updateUserSpy).not.toHaveBeenCalled();
  });
});

describe("inviteInternal — existing-but-unusable states are diagnosed", () => {
  // Seeds the three reclaimable shapes. Each is a real situation the product
  // could previously neither explain nor escape.
  const cases = [
    {
      label: "disabled (what gdprEraseUser leaves behind, or a Console disable)",
      state: "disabled",
      rec: { uid: "ex-uid", disabled: true, customClaims: { role: "admin", orgId: null } },
      docs: {
        "users/ex-uid": { exists: true, data: { id: "ex-uid", role: "admin" } },
        "redactionList/ex-uid": { exists: false },
      },
    },
    {
      label: "erased (GDPR cascade ran — redactionList row present)",
      state: "erased",
      rec: { uid: "ex-uid", disabled: true, customClaims: { role: "admin", orgId: null } },
      docs: {
        "users/ex-uid": {
          exists: true,
          data: { id: "ex-uid", role: "admin", email: null, name: null, erasedAt: "2026-10-01" },
        },
        "redactionList/ex-uid": { exists: true, data: { tombstoneToken: "tok" } },
      },
    },
    {
      label: "orphaned (Auth record survives, /users profile does not)",
      state: "orphaned",
      rec: { uid: "ex-uid", disabled: false, customClaims: { role: "admin", orgId: null } },
      docs: {
        "users/ex-uid": { exists: false },
        "redactionList/ex-uid": { exists: false },
      },
    },
  ];

  for (const c of cases) {
    it(`refuses WITHOUT reclaim but reports state="${c.state}" + uid — ${c.label}`, async () => {
      getUserByEmailSpy.mockResolvedValueOnce(c.rec);
      seedDocs(c.docs);
      const handler = await loadHandler();
      await expect(
        handler({ auth: adminAuthCtx, data: { ...baseValidData } }),
      ).rejects.toMatchObject({
        code: "already-exists",
        details: { code: "auth/email-already-exists", state: c.state, reclaimable: true, uid: "ex-uid" },
      });
      // Diagnosis only — nothing mutated until the admin opts in.
      expect(updateUserSpy).not.toHaveBeenCalled();
      expect(setCustomUserClaimsSpy).not.toHaveBeenCalled();
      expect(firestoreSetSpy).not.toHaveBeenCalled();
      expect(firestoreDeleteSpy).not.toHaveBeenCalled();
    });

    it(`reclaim:true revives in place — ${c.label}`, async () => {
      getUserByEmailSpy.mockResolvedValueOnce(c.rec);
      seedDocs(c.docs);
      const handler = await loadHandler();
      const res = (await handler({
        auth: adminAuthCtx,
        data: { ...baseValidData, role: "admin", reclaim: true },
      })) as { uid: string; tempPassword: string; existed: boolean };

      // Same uid — authored content, uploads and audit history stay attached.
      expect(res.uid).toBe("ex-uid");
      expect(res.existed).toBe(true);
      expect(res.tempPassword).toEqual(expect.any(String));
      expect(res.tempPassword.length).toBeGreaterThanOrEqual(12);
      // Never created a second account for the same person.
      expect(createUserSpy).not.toHaveBeenCalled();

      // Re-enabled, re-credentialled, and MFA cleared (the old authenticator
      // is gone with the access).
      expect(updateUserSpy).toHaveBeenCalledWith("ex-uid", {
        disabled: false,
        password: res.tempPassword,
        emailVerified: true,
        displayName: baseValidData.name,
        multiFactor: { enrolledFactors: [] },
      });
      // firstRun forces password reset + TOTP re-enrolment on next sign-in.
      expect(setCustomUserClaimsSpy).toHaveBeenCalledWith("ex-uid", {
        role: "admin",
        orgId: null,
        firstRun: true,
      });
      // Full overwrite, so an erasure tombstone cannot survive into the profile.
      expect(firestoreSetSpy).toHaveBeenCalledWith("users/ex-uid", {
        id: "ex-uid",
        email: baseValidData.email,
        name: baseValidData.name,
        role: "admin",
        orgId: null,
        createdAt: expect.any(String),
      });

      // Audit records that this was a revival and of what.
      expect(writeAuditEventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "auth.internal.invite",
          payload: expect.objectContaining({ reclaimed: true, reclaimedFrom: c.state }),
        }),
        expect.anything(),
      );
      // The temp password must never reach the audit payload (Pitfall 17).
      expect(JSON.stringify(writeAuditEventSpy.mock.calls)).not.toContain(res.tempPassword);
    });
  }

  it("clears the redactionList row on reclaim so a restore cannot re-erase them", async () => {
    getUserByEmailSpy.mockResolvedValueOnce({
      uid: "ex-uid",
      disabled: true,
      customClaims: { role: "admin", orgId: null },
    });
    seedDocs({
      "users/ex-uid": { exists: true, data: { id: "ex-uid", erasedAt: "2026-10-01" } },
      "redactionList/ex-uid": { exists: true, data: { tombstoneToken: "tok" } },
    });
    const handler = await loadHandler();
    await handler({ auth: adminAuthCtx, data: { ...baseValidData, reclaim: true } });
    expect(firestoreDeleteSpy).toHaveBeenCalledWith("redactionList/ex-uid");
  });

  it("leaves redactionList alone when there was no erasure to undo", async () => {
    getUserByEmailSpy.mockResolvedValueOnce({
      uid: "ex-uid",
      disabled: true,
      customClaims: { role: "admin", orgId: null },
    });
    seedDocs({
      "users/ex-uid": { exists: true, data: { id: "ex-uid", role: "admin" } },
      "redactionList/ex-uid": { exists: false },
    });
    const handler = await loadHandler();
    await handler({ auth: adminAuthCtx, data: { ...baseValidData, reclaim: true } });
    expect(firestoreDeleteSpy).not.toHaveBeenCalled();
  });

  it("still enforces the admin-only gate on the reclaim path", async () => {
    const handler = await loadHandler();
    await expect(
      handler({
        auth: { uid: "int-uid", token: { role: "internal" } },
        data: { ...baseValidData, reclaim: true },
      }),
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(updateUserSpy).not.toHaveBeenCalled();
  });
});

describe("inviteInternal — getUserByEmail error handling", () => {
  it("rethrows non-user-not-found auth errors as HttpsError('internal')", async () => {
    getUserByEmailSpy.mockRejectedValueOnce(
      Object.assign(new Error("network"), { code: "auth/network-request-failed" }),
    );
    const handler = await loadHandler();
    await expect(
      handler({ auth: adminAuthCtx, data: { ...baseValidData } }),
    ).rejects.toMatchObject({ code: "internal" });
    expect(createUserSpy).not.toHaveBeenCalled();
  });
});
