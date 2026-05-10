// Phase 7 Wave 1 (AUDIT-02): unit tests for auditEventInput schema.
// Pure-logic test — Zod only.

import { describe, it, expect } from "vitest";
import { auditEventInput } from "../../src/audit/auditEventSchema.js";

const FIXED_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("auditEventInput — accepts a minimal valid event (Test 1)", () => {
  it("parses a happy-path payload with type + target + clientReqId", () => {
    const out = auditEventInput.parse({
      type: "auth.signin.success",
      target: { type: "user", id: "u1" },
      clientReqId: FIXED_UUID,
    });
    expect(out.type).toBe("auth.signin.success");
    expect(out.target).toEqual({ type: "user", id: "u1" });
    expect(out.clientReqId).toBe(FIXED_UUID);
  });
});

describe("auditEventInput — required fields (Test 2)", () => {
  it("rejects when target.id is missing with a path of [target,id]", () => {
    expect(() =>
      auditEventInput.parse({
        type: "data.org.softDelete",
        target: { type: "org" },
        clientReqId: FIXED_UUID,
      }),
    ).toThrow();
    try {
      auditEventInput.parse({
        type: "data.org.softDelete",
        target: { type: "org" },
        clientReqId: FIXED_UUID,
      });
    } catch (err) {
      const e = err as { issues: Array<{ path: (string | number)[] }> };
      const paths = e.issues.map((i) => i.path);
      expect(paths).toContainEqual(["target", "id"]);
    }
  });
});

describe("auditEventInput — clientReqId UUID guard (Test 3)", () => {
  it("rejects when clientReqId is not a UUID", () => {
    expect(() =>
      auditEventInput.parse({
        type: "auth.signout",
        target: { type: "user", id: "u1" },
        clientReqId: "not-a-uuid",
      }),
    ).toThrow();
  });

  it("accepts a v4 UUID for clientReqId", () => {
    expect(() =>
      auditEventInput.parse({
        type: "auth.signout",
        target: { type: "user", id: "u1" },
        clientReqId: FIXED_UUID,
      }),
    ).not.toThrow();
  });
});

describe("auditEventInput — type enum guard (Test 4)", () => {
  it("rejects when type is not in the enum", () => {
    expect(() =>
      auditEventInput.parse({
        type: "not.in.enum",
        target: { type: "user", id: "u1" },
        clientReqId: FIXED_UUID,
      }),
    ).toThrow();
  });
});

describe("auditEventInput — optional fields (Test 5)", () => {
  it("severity is optional (server fills 'info'); payload is optional", () => {
    const out = auditEventInput.parse({
      type: "iam.claims.set",
      target: { type: "claims", id: "u1" },
      clientReqId: FIXED_UUID,
    });
    expect(out.severity).toBeUndefined();
    expect(out.payload).toBeUndefined();
  });

  it("accepts severity when supplied + payload as a freeform record", () => {
    const out = auditEventInput.parse({
      type: "iam.claims.set",
      severity: "warning",
      target: { type: "claims", id: "u1" },
      clientReqId: FIXED_UUID,
      payload: { reason: "role-promotion" },
    });
    expect(out.severity).toBe("warning");
    expect(out.payload).toEqual({ reason: "role-promotion" });
  });

  it("target.snapshot is optional and accepts a freeform record", () => {
    const out = auditEventInput.parse({
      type: "data.org.softDelete",
      target: {
        type: "org",
        id: "org_1",
        orgId: "org_1",
        snapshot: { name: "Old Name" },
      },
      clientReqId: FIXED_UUID,
    });
    expect(out.target.snapshot).toEqual({ name: "Old Name" });
  });
});
