// tests/audit-wiring.test.js
// @ts-nocheck
// Phase 9 Wave 4 (AUDIT-05): wiring-matrix test asserting all 6 cloud/* call
// sites emit a `.requested` audit event after their callable resolves. Mocks
// ../src/observability/audit-events.js + ../src/firebase/functions.js so the
// emit logic is observable without a real Firestore round-trip.
//
// Coverage matrix (this test):
//   src/cloud/claims-admin.js  → 1 site  (setClaims)
//   src/cloud/gdpr.js          → 2 sites (exportUser, eraseUser)
//   src/cloud/soft-delete.js   → 3 sites (softDelete, restoreSoftDeleted,
//                                          permanentlyDeleteSoftDeleted)
// Total cloud/* sites: 6.
//
// auth.js sites (3 functional sites = 5 emit calls counting both signIn outcomes
// + signOut + updatePassword + sendPasswordResetEmail + signInWithEmailLink)
// are covered separately in tests/firebase/auth-audit-emit.test.js.
//
// Cross-task total: 9 functional sites (per RESEARCH.md inventory).
//
// @ts-nocheck applied for vi.mock factory pattern (matches other Phase 9 tests).

import { describe, it, expect, beforeEach, vi } from "vitest";

const emitAuditEventSpy = vi.fn();

vi.mock("../src/observability/audit-events.js", () => ({
  emitAuditEvent: (...args) => emitAuditEventSpy(...args),
  AUDIT_EVENTS: {},
}));

// Mock firebase/functions adapter so each callable resolves to {data: {...}}.
vi.mock("../src/firebase/functions.js", () => ({
  functions: { __mock: "functions" },
  httpsCallable: vi.fn((_functions, name) => {
    if (name === "gdprExportUser") {
      return vi.fn(async () => ({
        data: { url: "https://signed.example/x", expiresAt: 1234567890 },
      }));
    }
    if (name === "gdprEraseUser") {
      return vi.fn(async () => ({
        data: { ok: true, counts: { messages: 0 } },
      }));
    }
    return vi.fn(async () => ({ data: { ok: true } }));
  }),
}));

const { setClaims } = await import("../src/cloud/claims-admin.js");
const { exportUser, eraseUser } = await import("../src/cloud/gdpr.js");
const { softDelete, restoreSoftDeleted, permanentlyDeleteSoftDeleted } =
  await import("../src/cloud/soft-delete.js");

beforeEach(() => {
  emitAuditEventSpy.mockReset();
});

describe("Phase 9 AUDIT-05 wiring matrix — cloud/* emit sites (6 total)", () => {
  it("Test 1 (claims-admin): setClaims emits iam.claims.set.requested with newRole payload", async () => {
    await setClaims({ uid: "u1", role: "admin", orgId: "o1" });
    expect(emitAuditEventSpy).toHaveBeenCalledTimes(1);
    expect(emitAuditEventSpy).toHaveBeenCalledWith(
      "iam.claims.set.requested",
      { type: "user", id: "u1", orgId: "o1" },
      { newRole: "admin" },
    );
    // Pitfall 17 invariant: no PII in payload
    const payload = emitAuditEventSpy.mock.calls[0][2];
    expect(payload.email).toBeUndefined();
    expect(payload.actor).toBeUndefined();
  });

  it("Test 2 (gdpr): exportUser emits compliance.export.user.requested with empty payload", async () => {
    await exportUser({ userId: "u1" });
    expect(emitAuditEventSpy).toHaveBeenCalledTimes(1);
    expect(emitAuditEventSpy).toHaveBeenCalledWith(
      "compliance.export.user.requested",
      { type: "user", id: "u1", orgId: null },
      {},
    );
  });

  it("Test 3 (gdpr): eraseUser emits compliance.erase.user.requested with empty payload", async () => {
    await eraseUser({ userId: "u1" });
    expect(emitAuditEventSpy).toHaveBeenCalledTimes(1);
    expect(emitAuditEventSpy).toHaveBeenCalledWith(
      "compliance.erase.user.requested",
      { type: "user", id: "u1", orgId: null },
      {},
    );
  });

  it("Test 4 (soft-delete): softDelete emits data.<type>.softDelete.requested for document type", async () => {
    await softDelete({ type: "document", orgId: "o1", id: "d1" });
    expect(emitAuditEventSpy).toHaveBeenCalledTimes(1);
    expect(emitAuditEventSpy).toHaveBeenCalledWith(
      "data.document.softDelete.requested",
      { type: "document", id: "d1", orgId: "o1" },
      {},
    );
  });

  it("Test 5 (soft-delete): restoreSoftDeleted emits data.<type>.restore.requested for comment type", async () => {
    await restoreSoftDeleted({ type: "comment", orgId: "o1", id: "c1" });
    expect(emitAuditEventSpy).toHaveBeenCalledTimes(1);
    expect(emitAuditEventSpy).toHaveBeenCalledWith(
      "data.comment.restore.requested",
      { type: "comment", id: "c1", orgId: "o1" },
      {},
    );
  });

  it("Test 6 (soft-delete): permanentlyDeleteSoftDeleted emits data.<type>.permanentlyDelete.requested with orgId:null", async () => {
    // permanentlyDeleteSoftDeleted's input has NO orgId (admin-only callable;
    // resource lives in admin-scoped softDeleted/<type>/items/{id} path).
    await permanentlyDeleteSoftDeleted({ type: "action", id: "a1" });
    expect(emitAuditEventSpy).toHaveBeenCalledTimes(1);
    expect(emitAuditEventSpy).toHaveBeenCalledWith(
      "data.action.permanentlyDelete.requested",
      { type: "action", id: "a1", orgId: null },
      {},
    );
  });

  it("Test 7: matrix coverage — every cloud/* call site fires an emit (non-null record)", async () => {
    // Invoke all 6 sites in sequence and assert the type literals match.
    await setClaims({ uid: "u-matrix", role: null, orgId: null });
    await exportUser({ userId: "u-matrix" });
    await eraseUser({ userId: "u-matrix" });
    await softDelete({ type: "message", orgId: "o-matrix", id: "m1" });
    await restoreSoftDeleted({
      type: "funnelComment",
      orgId: "o-matrix",
      id: "fc1",
    });
    await permanentlyDeleteSoftDeleted({ type: "document", id: "doc1" });

    expect(emitAuditEventSpy).toHaveBeenCalledTimes(6);
    const types = emitAuditEventSpy.mock.calls.map((c) => c[0]);
    expect(types).toEqual([
      "iam.claims.set.requested",
      "compliance.export.user.requested",
      "compliance.erase.user.requested",
      "data.message.softDelete.requested",
      "data.funnelComment.restore.requested",
      "data.document.permanentlyDelete.requested",
    ]);

    // Pitfall 17 invariant — sweep all payloads for forbidden PII keys.
    const forbidden = ["email", "name", "ip", "userAgent", "actor"];
    for (const call of emitAuditEventSpy.mock.calls) {
      const payload = call[2] ?? {};
      for (const k of forbidden) {
        expect(payload[k]).toBeUndefined();
      }
    }
  });
});
