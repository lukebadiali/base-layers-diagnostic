// Phase 06.1 Wave 2 Task 1 (AUTH-16 / FN-03 / FN-04 / FN-07 / Pitfall 17):
// unit tests for the inviteClient callable's hardened wiring shape.
//
// Pure-mocked: every Admin SDK module is stubbed via vi.mock so the test
// runs without the Firestore emulator. The integration test
// (inviteClient.integration.test.ts) covers the full firebase-functions-test
// path against the in-memory Admin SDK mock.
//
// Coverage (9 cases mirroring setClaims.unit.test.ts shape verbatim, plus
// the 4 outcome branches specific to inviteClient):
//   1. Non-admin / non-internal caller → permission-denied; no side effects.
//   2. Zod fail (missing email) → invalid-argument; ensureIdempotent NOT called.
//   3. Idempotency key shape + scope + window pinned.
//   4. Passphrase-not-set → throws + audit emit with reason "passphrase-not-set".
//   5. Passphrase-mismatch → throws + audit emit with reason "passphrase-mismatch".
//   6. Happy create → createUser + setCustomUserClaims + audit + return {existed:false}.
//   7. Existed same-org WITHOUT confirmReset → no Auth-mutation + return {existed:true, hasFirstRun}.
//   8. Existed same-org WITH confirmReset:true → updateUser + setCustomUserClaims + audit "auth.client.invite.resend".
//   9. Cross-org refuse → throws + audit "auth.client.invite.rejected.cross-org".

import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const getUserByEmailSpy = vi.fn();
const createUserSpy = vi.fn();
const updateUserSpy = vi.fn();
const setCustomUserClaimsSpy = vi.fn();

const firestoreGetSpy = vi.fn();
const firestoreDocSpy = vi.fn(() => ({ get: firestoreGetSpy }));

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
    updateUser: updateUserSpy,
    setCustomUserClaims: setCustomUserClaimsSpy,
  }),
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => ({ doc: firestoreDocSpy }),
}));

vi.mock("firebase-functions/v2/https", () => ({
  onCall: (
    _opts: unknown,
    handler: (req: unknown) => Promise<unknown>,
  ) => handler,
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
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../../src/util/idempotency.js", () => ({
  ensureIdempotent: (key: string, scope: string, windowSec: number) =>
    ensureIdempotentSpy(key, scope, windowSec),
}));

vi.mock("../../src/util/sentry.js", () => ({
  withSentry: <TIn, TOut>(h: (req: TIn) => Promise<TOut>) => h,
}));

vi.mock("../../src/audit/auditLogger.js", () => ({
  writeAuditEvent: (input: unknown, ctx: unknown) =>
    writeAuditEventSpy(input, ctx),
}));

const VALID_REQ_ID = "550e8400-e29b-41d4-a716-446655440000";

// Helper: precomputed SHA-256 of the test passphrase below. Pinned at module
// load so the org-doc-mock returns it as `clientPassphraseHash`.
// node -e 'console.log(require("crypto").createHash("sha256").update("test-passphrase-12c", "utf8").digest("hex"))'
const TEST_PASSPHRASE = "test-passphrase-12c";
const TEST_PASSPHRASE_HASH =
  "ba0e2dfc5f9c5d57f00a8d4ed6a44c2cda7ec7fb0c61c2bdd5ec1e2e7c1d7c89"; // placeholder — overridden below by computing at test time

beforeEach(() => {
  getUserByEmailSpy.mockReset();
  createUserSpy.mockReset().mockResolvedValue({ uid: "new-uid-123" });
  updateUserSpy.mockReset().mockResolvedValue(undefined);
  setCustomUserClaimsSpy.mockReset().mockResolvedValue(undefined);
  firestoreGetSpy.mockReset();
  firestoreDocSpy.mockClear();
  ensureIdempotentSpy.mockReset().mockResolvedValue(undefined);
  writeAuditEventSpy.mockReset().mockResolvedValue(undefined);
});

async function loadHandler(): Promise<(req: unknown) => Promise<unknown>> {
  vi.resetModules();
  const mod = await import("../../src/auth/inviteClient.js");
  return mod.inviteClient as unknown as (req: unknown) => Promise<unknown>;
}

// Compute the real hash dynamically — node:crypto is available in the test
// environment, so we calculate inside the test to avoid drift between the
// hardcoded constant above and the actual hashString output. This mirrors
// the strategy in the integration test.
async function computeRealHash(input: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(String(input), "utf8").digest("hex");
}

const adminAuthCtx = {
  uid: "admin-uid",
  token: { role: "admin", email: "admin@example.com", orgId: null },
};

const baseValidData = {
  email: "client@example.com",
  name: "Client Name",
  orgId: "org-alpha",
  orgPassphrase: TEST_PASSPHRASE,
  clientReqId: VALID_REQ_ID,
};

// Helper: setup the firestore doc spy to return an org snap with the matching hash.
async function seedOrgWithHash(hash: string | null) {
  firestoreGetSpy.mockResolvedValue({
    exists: hash !== null,
    data: () => (hash !== null ? { clientPassphraseHash: hash } : undefined),
  });
}

describe("inviteClient — role gate (Test 1 / Pitfall 17)", () => {
  it("throws permission-denied for a client-role caller; no side effects", async () => {
    const handler = await loadHandler();
    await expect(
      handler({
        auth: { uid: "u1", token: { role: "client" } },
        data: { ...baseValidData },
      }),
    ).rejects.toMatchObject({ code: "permission-denied" });

    expect(ensureIdempotentSpy).not.toHaveBeenCalled();
    expect(getUserByEmailSpy).not.toHaveBeenCalled();
    expect(createUserSpy).not.toHaveBeenCalled();
    expect(setCustomUserClaimsSpy).not.toHaveBeenCalled();
    expect(writeAuditEventSpy).not.toHaveBeenCalled();
  });

  it("admits an internal-role caller (widened gate vs setClaims) when other inputs valid", async () => {
    const realHash = await computeRealHash(TEST_PASSPHRASE);
    await seedOrgWithHash(realHash);
    getUserByEmailSpy.mockRejectedValueOnce(
      Object.assign(new Error("not found"), { code: "auth/user-not-found" }),
    );
    const handler = await loadHandler();
    await expect(
      handler({
        auth: { uid: "internal-uid", token: { role: "internal" } },
        data: { ...baseValidData },
      }),
    ).resolves.toMatchObject({ existed: false });
  });
});

describe("inviteClient — input validation (Test 2)", () => {
  it("throws invalid-argument when email is missing; ensureIdempotent NOT called", async () => {
    const handler = await loadHandler();
    await expect(
      handler({
        auth: adminAuthCtx,
        data: {
          name: "X",
          orgId: "org-alpha",
          orgPassphrase: TEST_PASSPHRASE,
          clientReqId: VALID_REQ_ID,
        },
      }),
    ).rejects.toMatchObject({ code: "invalid-argument" });

    expect(ensureIdempotentSpy).not.toHaveBeenCalled();
    expect(getUserByEmailSpy).not.toHaveBeenCalled();
    expect(createUserSpy).not.toHaveBeenCalled();
  });

  it("throws invalid-argument when clientReqId is not a UUID", async () => {
    const handler = await loadHandler();
    await expect(
      handler({
        auth: adminAuthCtx,
        data: { ...baseValidData, clientReqId: "not-a-uuid" },
      }),
    ).rejects.toMatchObject({ code: "invalid-argument" });
  });
});

describe("inviteClient — idempotency before side effect (Test 3 / FN-03)", () => {
  it("invokes ensureIdempotent with the canonical key shape + scope + 5-min window", async () => {
    const realHash = await computeRealHash(TEST_PASSPHRASE);
    await seedOrgWithHash(realHash);
    getUserByEmailSpy.mockRejectedValueOnce(
      Object.assign(new Error("not found"), { code: "auth/user-not-found" }),
    );

    const handler = await loadHandler();
    await handler({ auth: adminAuthCtx, data: { ...baseValidData } });

    expect(ensureIdempotentSpy).toHaveBeenCalledTimes(1);
    const [key, scope, windowSec] = ensureIdempotentSpy.mock.calls[0];
    expect(key).toBe(
      `admin-uid:inviteClient:${baseValidData.email}:${VALID_REQ_ID}`,
    );
    expect(scope).toBe("inviteClient");
    expect(windowSec).toBe(5 * 60);
  });
});

describe("inviteClient — passphrase-not-set branch (Test 4)", () => {
  it("emits audit 'auth.client.invite.rejected.passphrase-invalid' with reason 'passphrase-not-set' and throws failed-precondition", async () => {
    await seedOrgWithHash(null); // org doc exists but no clientPassphraseHash field — or org missing
    const handler = await loadHandler();

    await expect(
      handler({ auth: adminAuthCtx, data: { ...baseValidData } }),
    ).rejects.toMatchObject({
      code: "failed-precondition",
      details: { code: "auth/passphrase-not-set" },
    });

    expect(writeAuditEventSpy).toHaveBeenCalledTimes(1);
    const [emittedInput] = writeAuditEventSpy.mock.calls[0];
    expect(emittedInput).toMatchObject({
      type: "auth.client.invite.rejected.passphrase-invalid",
      payload: { reason: "passphrase-not-set" },
    });

    // No user-creation side effects fire.
    expect(getUserByEmailSpy).not.toHaveBeenCalled();
    expect(createUserSpy).not.toHaveBeenCalled();
    expect(setCustomUserClaimsSpy).not.toHaveBeenCalled();
  });
});

describe("inviteClient — passphrase-mismatch branch (Test 5)", () => {
  it("emits audit 'auth.client.invite.rejected.passphrase-invalid' with reason 'passphrase-mismatch' and throws failed-precondition", async () => {
    const wrongHash = await computeRealHash("wrong-passphrase");
    await seedOrgWithHash(wrongHash);
    const handler = await loadHandler();

    await expect(
      handler({ auth: adminAuthCtx, data: { ...baseValidData } }),
    ).rejects.toMatchObject({
      code: "failed-precondition",
      details: { code: "auth/passphrase-invalid" },
    });

    expect(writeAuditEventSpy).toHaveBeenCalledTimes(1);
    const [emittedInput] = writeAuditEventSpy.mock.calls[0];
    expect(emittedInput).toMatchObject({
      type: "auth.client.invite.rejected.passphrase-invalid",
      payload: { reason: "passphrase-mismatch" },
    });
    expect(createUserSpy).not.toHaveBeenCalled();
  });
});

describe("inviteClient — happy create (Test 6)", () => {
  it("creates Auth user + sets claims + emits audit + returns {existed:false}", async () => {
    const realHash = await computeRealHash(TEST_PASSPHRASE);
    await seedOrgWithHash(realHash);
    getUserByEmailSpy.mockRejectedValueOnce(
      Object.assign(new Error("not found"), { code: "auth/user-not-found" }),
    );
    createUserSpy.mockResolvedValueOnce({ uid: "new-uid-123" });

    const handler = await loadHandler();
    const result = await handler({
      auth: adminAuthCtx,
      data: { ...baseValidData },
    });

    expect(result).toEqual({ uid: "new-uid-123", existed: false });

    expect(createUserSpy).toHaveBeenCalledTimes(1);
    expect(createUserSpy).toHaveBeenCalledWith({
      email: baseValidData.email,
      password: TEST_PASSPHRASE,
      emailVerified: true,
      displayName: baseValidData.name,
    });

    expect(setCustomUserClaimsSpy).toHaveBeenCalledTimes(1);
    expect(setCustomUserClaimsSpy).toHaveBeenCalledWith("new-uid-123", {
      role: "client",
      orgId: "org-alpha",
      firstRun: true,
    });

    expect(writeAuditEventSpy).toHaveBeenCalledTimes(1);
    const [emittedInput] = writeAuditEventSpy.mock.calls[0];
    expect(emittedInput).toMatchObject({
      type: "auth.client.invite",
      target: { type: "user", id: "new-uid-123", orgId: "org-alpha" },
      payload: { existed: false, newRole: "client" },
    });
  });
});

describe("inviteClient — existed same-org WITHOUT confirmReset (Test 7)", () => {
  it("returns {existed:true, hasFirstRun} without mutating Auth and without audit emit", async () => {
    const realHash = await computeRealHash(TEST_PASSPHRASE);
    await seedOrgWithHash(realHash);
    getUserByEmailSpy.mockResolvedValueOnce({
      uid: "existing-uid-1",
      customClaims: { role: "client", orgId: "org-alpha", firstRun: true },
    });

    const handler = await loadHandler();
    const result = await handler({
      auth: adminAuthCtx,
      data: { ...baseValidData },
    });

    expect(result).toEqual({
      uid: "existing-uid-1",
      existed: true,
      hasFirstRun: true,
    });

    expect(updateUserSpy).not.toHaveBeenCalled();
    expect(setCustomUserClaimsSpy).not.toHaveBeenCalled();
    expect(createUserSpy).not.toHaveBeenCalled();
    expect(writeAuditEventSpy).not.toHaveBeenCalled();
  });

  it("returns hasFirstRun:false when existing user has no firstRun claim", async () => {
    const realHash = await computeRealHash(TEST_PASSPHRASE);
    await seedOrgWithHash(realHash);
    getUserByEmailSpy.mockResolvedValueOnce({
      uid: "existing-uid-2",
      customClaims: { role: "client", orgId: "org-alpha" }, // no firstRun
    });

    const handler = await loadHandler();
    const result = await handler({
      auth: adminAuthCtx,
      data: { ...baseValidData },
    });

    expect(result).toMatchObject({
      uid: "existing-uid-2",
      existed: true,
      hasFirstRun: false,
    });
  });
});

describe("inviteClient — existed same-org WITH confirmReset (Test 8)", () => {
  it("calls updateUser({password}) + setCustomUserClaims + emits audit 'auth.client.invite.resend'", async () => {
    const realHash = await computeRealHash(TEST_PASSPHRASE);
    await seedOrgWithHash(realHash);
    getUserByEmailSpy.mockResolvedValueOnce({
      uid: "existing-uid-3",
      customClaims: { role: "client", orgId: "org-alpha", firstRun: true },
    });

    const handler = await loadHandler();
    const result = await handler({
      auth: adminAuthCtx,
      data: { ...baseValidData, confirmReset: true },
    });

    expect(result).toEqual({ uid: "existing-uid-3", existed: true });

    expect(updateUserSpy).toHaveBeenCalledTimes(1);
    expect(updateUserSpy).toHaveBeenCalledWith("existing-uid-3", {
      password: TEST_PASSPHRASE,
    });

    expect(setCustomUserClaimsSpy).toHaveBeenCalledTimes(1);
    expect(setCustomUserClaimsSpy).toHaveBeenCalledWith("existing-uid-3", {
      role: "client",
      orgId: "org-alpha",
      firstRun: true,
    });

    expect(writeAuditEventSpy).toHaveBeenCalledTimes(1);
    const [emittedInput] = writeAuditEventSpy.mock.calls[0];
    expect(emittedInput).toMatchObject({
      type: "auth.client.invite.resend",
      target: { type: "user", id: "existing-uid-3", orgId: "org-alpha" },
      payload: { existed: true, newRole: "client" },
    });
  });
});

describe("inviteClient — cross-org refusal (Test 9)", () => {
  it("emits audit 'auth.client.invite.rejected.cross-org' with payload + throws failed-precondition", async () => {
    const realHash = await computeRealHash(TEST_PASSPHRASE);
    await seedOrgWithHash(realHash);
    getUserByEmailSpy.mockResolvedValueOnce({
      uid: "existing-uid-4",
      customClaims: { role: "client", orgId: "org-bravo" }, // different org
    });

    const handler = await loadHandler();
    await expect(
      handler({ auth: adminAuthCtx, data: { ...baseValidData } }),
    ).rejects.toMatchObject({
      code: "failed-precondition",
      details: { code: "auth/cross-org-invite-rejected" },
    });

    expect(writeAuditEventSpy).toHaveBeenCalledTimes(1);
    const [emittedInput] = writeAuditEventSpy.mock.calls[0];
    expect(emittedInput).toMatchObject({
      type: "auth.client.invite.rejected.cross-org",
      target: { type: "user", id: "existing-uid-4", orgId: "org-alpha" },
      payload: { existingOrgId: "org-bravo", requestedOrgId: "org-alpha" },
    });

    expect(createUserSpy).not.toHaveBeenCalled();
    expect(updateUserSpy).not.toHaveBeenCalled();
    expect(setCustomUserClaimsSpy).not.toHaveBeenCalled();
  });
});

describe("inviteClient — getUserByEmail error handling (RESEARCH § 3)", () => {
  it("rethrows non-user-not-found auth errors as HttpsError('internal')", async () => {
    const realHash = await computeRealHash(TEST_PASSPHRASE);
    await seedOrgWithHash(realHash);
    getUserByEmailSpy.mockRejectedValueOnce(
      Object.assign(new Error("network error"), {
        code: "auth/network-request-failed",
      }),
    );

    const handler = await loadHandler();
    await expect(
      handler({ auth: adminAuthCtx, data: { ...baseValidData } }),
    ).rejects.toMatchObject({ code: "internal" });

    expect(createUserSpy).not.toHaveBeenCalled();
  });
});
