// Phase 06.1 Wave 2 Task 3 (AUTH-16 / TEST-09 / D-12): firebase-functions-test
// integration coverage for the inviteClient callable. Uses the in-memory
// Admin SDK mock (functions/test/_mocks/admin-sdk.ts) — no Firestore emulator
// dependency, per 07-RESEARCH.md Pattern 11 "offline mode preferred".
//
// 6 outcome cases pinned (RESEARCH § Wave 2 + PATTERNS § integration test):
//   1. Happy create — admin caller, valid input + org with matching hash →
//      Auth user created + claims set + audit row landed type "auth.client.invite"
//   2. Happy resend (confirmReset:true) — pre-seeded existing user same-org →
//      updateUser called + audit "auth.client.invite.resend"
//   3. Cross-org refuse — pre-seeded existing user with different orgId →
//      failed-precondition + audit "auth.client.invite.rejected.cross-org"
//   4. Passphrase invalid — org has hash A, caller supplies plaintext hashing
//      to B → failed-precondition + audit ".rejected.passphrase-invalid"
//   5. Idempotency-replay — same clientReqId within 5min → already-exists
//   6. Non-admin caller → permission-denied
//
// Plus Test 0: hash-parity precheck — the precomputed TEST_PASSPHRASE_HASH
// constant matches what functions/src/util/hash.ts produces (drift gate
// alongside hash-parity.test.ts).

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import functionsTest from "firebase-functions-test";
import { createHash } from "node:crypto";

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

vi.mock("firebase-admin/auth", async () => {
  const m = await import("../_mocks/admin-sdk.js");
  return {
    getAuth: () => m.getAuthMock(),
  };
});

vi.mock("firebase-functions/params", () => ({
  defineSecret: (name: string) => ({ name, value: () => "" }),
}));

vi.mock("firebase-functions/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const t = functionsTest({ projectId: "bedeveloped-base-layers-test" });
afterAll(() => t.cleanup());

const VALID_REQ_ID_A = "550e8400-e29b-41d4-a716-446655440000";
const VALID_REQ_ID_B = "660e8400-e29b-41d4-a716-446655440000";
const VALID_REQ_ID_C = "770e8400-e29b-41d4-a716-446655440000";
const VALID_REQ_ID_D = "880e8400-e29b-41d4-a716-446655440000";
const VALID_REQ_ID_E = "990e8400-e29b-41d4-a716-446655440000";
const VALID_REQ_ID_F = "aa0e8400-e29b-41d4-a716-446655440000";
// Phase 06.1 CR-01 test: privileged-user refusal integration cell.
const VALID_REQ_ID_G = "bb0e8400-e29b-41d4-a716-446655440000";

const TEST_PASSPHRASE = "test-passphrase-12c";
// Precomputed SHA-256 of TEST_PASSPHRASE (UTF-8 + lowercase hex). Verified
// against functions/src/util/hash.ts via Test 0 below — drift gate.
const TEST_PASSPHRASE_HASH = createHash("sha256")
  .update(TEST_PASSPHRASE, "utf8")
  .digest("hex");

beforeEach(async () => {
  const m = await import("../_mocks/admin-sdk.js");
  m.adminMockState._reset();
  // Pre-seed the org doc with the matching hash for happy-path tests.
  m.adminMockState._seedDoc("orgs/org-alpha", {
    clientPassphraseHash: TEST_PASSPHRASE_HASH,
    name: "OrgAlpha",
  });
});

async function loadWrapped() {
  // Note: do NOT vi.resetModules() here — admin-sdk.js holds the in-memory
  // state map at module scope, and a reset would discard the seeded org
  // doc + seeded users that beforeEach + per-test setup placed there. The
  // setClaims integration test gets away with vi.resetModules because it
  // does not seed state before loading; we do.
  const mod = await import("../../src/auth/inviteClient.js");
  return t.wrap(mod.inviteClient);
}

const adminCtx = {
  uid: "admin-uid",
  token: { role: "admin" as const, email: "admin@example.com" },
};

describe("inviteClient — integration (firebase-functions-test v3)", () => {
  it("Test 0: precomputed TEST_PASSPHRASE_HASH matches functions/src/util/hash.ts (drift gate)", async () => {
    const { hashString } = await import("../../src/util/hash.js");
    const live = await hashString(TEST_PASSPHRASE);
    expect(live).toBe(TEST_PASSPHRASE_HASH);
  });

  it("Test 1: happy create — admin caller + valid input + org-matched hash → Auth user + claims + audit", async () => {
    const wrapped = await loadWrapped();
    const result = (await wrapped({
      data: {
        email: "client@example.com",
        name: "Client Name",
        orgId: "org-alpha",
        orgPassphrase: TEST_PASSPHRASE,
        clientReqId: VALID_REQ_ID_A,
      },
      auth: adminCtx,
    } as never)) as { uid: string; existed: boolean };

    expect(result.existed).toBe(false);
    expect(result.uid).toBeTruthy();

    const m = await import("../_mocks/admin-sdk.js");
    const user = m.adminMockState._readUser("client@example.com");
    expect(user).toBeDefined();
    expect(user!.emailVerified).toBe(true);
    expect(user!.password).toBe(TEST_PASSPHRASE);
    expect(user!.displayName).toBe("Client Name");

    const claims = m.adminMockState._allClaims().get(result.uid);
    expect(claims).toEqual({
      role: "client",
      orgId: "org-alpha",
      firstRun: true,
    });

    // Audit row landed at auditLog/{eventId} with type "auth.client.invite"
    const auditRows = Array.from(m.adminMockState._allDocs().entries()).filter(
      ([path]) => path.startsWith("auditLog/"),
    );
    expect(auditRows.length).toBe(1);
    const auditDoc = auditRows[0]![1] as Record<string, unknown>;
    expect(auditDoc.type).toBe("auth.client.invite");
    expect((auditDoc.target as Record<string, unknown>).id).toBe(result.uid);
  });

  it("Test 2: happy resend (confirmReset:true) — updateUser + audit auth.client.invite.resend", async () => {
    const m = await import("../_mocks/admin-sdk.js");
    m.adminMockState._seedUser({
      uid: "existing-uid-2",
      email: "existing@example.com",
      customClaims: { role: "client", orgId: "org-alpha", firstRun: false },
    });

    const wrapped = await loadWrapped();
    const result = (await wrapped({
      data: {
        email: "existing@example.com",
        name: "Existing Client",
        orgId: "org-alpha",
        orgPassphrase: TEST_PASSPHRASE,
        confirmReset: true,
        clientReqId: VALID_REQ_ID_B,
      },
      auth: adminCtx,
    } as never)) as { uid: string; existed: boolean };

    expect(result).toEqual({ uid: "existing-uid-2", existed: true });

    const updates = m.adminMockState._allUpdateUserCalls();
    expect(updates.length).toBe(1);
    expect(updates[0]).toMatchObject({
      uid: "existing-uid-2",
      properties: { password: TEST_PASSPHRASE },
    });

    const claims = m.adminMockState._allClaims().get("existing-uid-2");
    expect(claims).toEqual({
      role: "client",
      orgId: "org-alpha",
      firstRun: true,
    });

    const auditRows = Array.from(m.adminMockState._allDocs().entries()).filter(
      ([path]) => path.startsWith("auditLog/"),
    );
    expect(auditRows.length).toBe(1);
    const auditDoc = auditRows[0]![1] as Record<string, unknown>;
    expect(auditDoc.type).toBe("auth.client.invite.resend");
  });

  it("Test 3: cross-org refuse — existing user with different orgId → failed-precondition + audit", async () => {
    const m = await import("../_mocks/admin-sdk.js");
    m.adminMockState._seedUser({
      uid: "existing-uid-3",
      email: "crossorg@example.com",
      customClaims: { role: "client", orgId: "org-bravo", firstRun: false },
    });

    const wrapped = await loadWrapped();
    await expect(
      wrapped({
        data: {
          email: "crossorg@example.com",
          name: "Cross Org",
          orgId: "org-alpha",
          orgPassphrase: TEST_PASSPHRASE,
          clientReqId: VALID_REQ_ID_C,
        },
        auth: adminCtx,
      } as never),
    ).rejects.toMatchObject({
      code: "failed-precondition",
      details: { code: "auth/cross-org-invite-rejected" },
    });

    const auditRows = Array.from(m.adminMockState._allDocs().entries()).filter(
      ([path]) => path.startsWith("auditLog/"),
    );
    expect(auditRows.length).toBe(1);
    const auditDoc = auditRows[0]![1] as Record<string, unknown>;
    expect(auditDoc.type).toBe("auth.client.invite.rejected.cross-org");
    const auditPayload = auditDoc.payload as Record<string, unknown>;
    expect(auditPayload.existingOrgId).toBe("org-bravo");
    // Phase 06.1 CR-01 fix: payload now carries a reason discriminator so
    // cross-org and privileged-user refusals (which share the same audit
    // type) are queryable separately.
    expect(auditPayload.reason).toBe("cross-org");
  });

  it("Test 3b (CR-01): existing admin-role user + confirmReset → failed-precondition + audit reason:privileged-user; NO password / claims mutation", async () => {
    const m = await import("../_mocks/admin-sdk.js");
    m.adminMockState._seedUser({
      uid: "admin-victim-uid",
      email: "admin-victim@example.com",
      customClaims: { role: "admin", orgId: "org-bravo", firstRun: false },
      // Track existing password so we can assert it wasn't overwritten.
      // (The mock createUser+seed flow stores password; we seed directly so
      //  no password is set, mirroring an already-provisioned admin user.)
    });

    const wrapped = await loadWrapped();
    await expect(
      wrapped({
        data: {
          email: "admin-victim@example.com",
          name: "Admin Victim",
          orgId: "org-alpha",
          orgPassphrase: TEST_PASSPHRASE,
          confirmReset: true, // CRITICAL: even with confirmReset, must refuse
          clientReqId: VALID_REQ_ID_G,
        },
        auth: adminCtx,
      } as never),
    ).rejects.toMatchObject({
      code: "failed-precondition",
      details: { code: "auth/email-belongs-to-privileged-user" },
    });

    // Critical: the admin user's password / claims MUST NOT be touched.
    const updates = m.adminMockState._allUpdateUserCalls();
    expect(updates.length).toBe(0);
    const claims = m.adminMockState._allClaims().get("admin-victim-uid");
    // Claims map mirrors only what was seeded; role MUST still be admin.
    expect(claims).toEqual({
      role: "admin",
      orgId: "org-bravo",
      firstRun: false,
    });

    const auditRows = Array.from(m.adminMockState._allDocs().entries()).filter(
      ([path]) => path.startsWith("auditLog/"),
    );
    expect(auditRows.length).toBe(1);
    const auditDoc = auditRows[0]![1] as Record<string, unknown>;
    expect(auditDoc.type).toBe("auth.client.invite.rejected.cross-org");
    const auditPayload = auditDoc.payload as Record<string, unknown>;
    expect(auditPayload.reason).toBe("privileged-user");
    expect(auditPayload.existingRole).toBe("admin");
  });

  it("Test 4: passphrase mismatch — org hash A, caller supplies B → failed-precondition + audit", async () => {
    const wrapped = await loadWrapped();
    await expect(
      wrapped({
        data: {
          email: "passmis@example.com",
          name: "Pass Mismatch",
          orgId: "org-alpha",
          orgPassphrase: "wrong-passphrase",
          clientReqId: VALID_REQ_ID_D,
        },
        auth: adminCtx,
      } as never),
    ).rejects.toMatchObject({
      code: "failed-precondition",
      details: { code: "auth/passphrase-invalid" },
    });

    const m = await import("../_mocks/admin-sdk.js");
    const auditRows = Array.from(m.adminMockState._allDocs().entries()).filter(
      ([path]) => path.startsWith("auditLog/"),
    );
    expect(auditRows.length).toBe(1);
    const auditDoc = auditRows[0]![1] as Record<string, unknown>;
    expect(auditDoc.type).toBe("auth.client.invite.rejected.passphrase-invalid");
    expect((auditDoc.payload as Record<string, unknown>).reason).toBe(
      "passphrase-mismatch",
    );
  });

  it("Test 5: idempotency-replay — same clientReqId within 5min → already-exists", async () => {
    const wrapped = await loadWrapped();
    const firstResult = (await wrapped({
      data: {
        email: "replay@example.com",
        name: "Replay",
        orgId: "org-alpha",
        orgPassphrase: TEST_PASSPHRASE,
        clientReqId: VALID_REQ_ID_E,
      },
      auth: adminCtx,
    } as never)) as { existed: boolean };
    expect(firstResult.existed).toBe(false);

    await expect(
      wrapped({
        data: {
          email: "replay@example.com",
          name: "Replay",
          orgId: "org-alpha",
          orgPassphrase: TEST_PASSPHRASE,
          clientReqId: VALID_REQ_ID_E,
        },
        auth: adminCtx,
      } as never),
    ).rejects.toMatchObject({ code: "already-exists" });
  });

  it("Test 6: non-admin caller → permission-denied", async () => {
    const wrapped = await loadWrapped();
    await expect(
      wrapped({
        data: {
          email: "denied@example.com",
          name: "Denied",
          orgId: "org-alpha",
          orgPassphrase: TEST_PASSPHRASE,
          clientReqId: VALID_REQ_ID_F,
        },
        auth: { uid: "client-uid", token: { role: "client" } },
      } as never),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });
});
