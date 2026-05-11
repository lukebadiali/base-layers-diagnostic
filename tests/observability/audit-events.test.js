// tests/observability/audit-events.test.js
// @ts-nocheck
// Phase 9 Wave 1 (AUDIT-05): tests for the body-filled emitAuditEvent proxy
// at src/observability/audit-events.js. Mocks ../cloud/audit.js so the proxy
// behaviour is observable without a Firestore round-trip. Replaces the
// Phase 4 D-11 stub smoke tests.
//
// @ts-nocheck applied for vi.mock factory pattern (matches tests/main.test.js).

import { describe, it, expect, beforeEach, vi } from "vitest";

const writeAuditEventSpy = vi.fn();

vi.mock("../../src/cloud/audit.js", () => ({
  writeAuditEvent: (...args) => writeAuditEventSpy(...args),
}));

import { AUDIT_EVENTS, emitAuditEvent } from "../../src/observability/audit-events.js";

beforeEach(() => {
  writeAuditEventSpy.mockReset();
});

describe("AUDIT_EVENTS table — canonical constants", () => {
  it("Test 3a: AUTH_SIGNIN_SUCCESS maps to 'auth.signin.success'", () => {
    expect(AUDIT_EVENTS.AUTH_SIGNIN_SUCCESS).toBe("auth.signin.success");
  });

  it("Test 3b: AUDIT_EVENTS is frozen (cannot be reassigned)", () => {
    expect(Object.isFrozen(AUDIT_EVENTS)).toBe(true);
  });

  it("contains canonical AUTH_* / IAM_* / COMPLIANCE_* / DATA_* constants", () => {
    expect(AUDIT_EVENTS.AUTH_SIGNIN_FAILURE).toBe("auth.signin.failure");
    expect(AUDIT_EVENTS.AUTH_SIGNOUT).toBe("auth.signout");
    expect(AUDIT_EVENTS.AUTH_MFA_ENROL).toBe("auth.mfa.enrol");
    expect(AUDIT_EVENTS.IAM_CLAIMS_SET_REQUESTED).toBe("iam.claims.set.requested");
    expect(AUDIT_EVENTS.COMPLIANCE_EXPORT_USER_REQUESTED).toBe("compliance.export.user.requested");
    expect(AUDIT_EVENTS.COMPLIANCE_ERASE_USER_REQUESTED).toBe("compliance.erase.user.requested");
    expect(AUDIT_EVENTS.DATA_ACTION_SOFTDELETE_REQUESTED).toBe("data.action.softDelete.requested");
    expect(AUDIT_EVENTS.DATA_DOCUMENT_PERMANENTLY_DELETE_REQUESTED).toBe(
      "data.document.permanentlyDelete.requested",
    );
  });
});

describe("emitAuditEvent — proxy to writeAuditEvent", () => {
  it("Test 1: forwards type/target/payload and returns the result", async () => {
    writeAuditEventSpy.mockResolvedValueOnce({ ok: true, eventId: "evt-1" });
    const target = { type: "user", id: "u1", orgId: null };
    const result = await emitAuditEvent("auth.signin.success", target, {});
    expect(writeAuditEventSpy).toHaveBeenCalledTimes(1);
    expect(writeAuditEventSpy).toHaveBeenCalledWith({
      type: "auth.signin.success",
      target,
      payload: {},
    });
    expect(result).toEqual({ ok: true, eventId: "evt-1" });
  });

  it("Test 2: best-effort — returns null and does not rethrow on failure", async () => {
    writeAuditEventSpy.mockRejectedValueOnce(new Error("network down"));
    const target = { type: "user", id: "u2", orgId: null };
    const result = await emitAuditEvent("auth.signin.failure", target, {});
    expect(result).toBeNull();
    expect(writeAuditEventSpy).toHaveBeenCalledTimes(1);
  });

  it("payload is optional — undefined payload still proxies cleanly", async () => {
    writeAuditEventSpy.mockResolvedValueOnce({ ok: true, eventId: "evt-3" });
    const target = { type: "user", id: "u3", orgId: null };
    const result = await emitAuditEvent("auth.signout", target);
    expect(writeAuditEventSpy).toHaveBeenCalledTimes(1);
    expect(writeAuditEventSpy).toHaveBeenCalledWith({
      type: "auth.signout",
      target,
      payload: undefined,
    });
    expect(result).toEqual({ ok: true, eventId: "evt-3" });
  });
});
