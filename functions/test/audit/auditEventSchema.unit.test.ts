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

// ─── Phase 9 Wave 3 (AUDIT-05 / OBS-05): enum extension tests ────────────────
// 33 new literals — 15 server-side bare data-domain flavours + 18 client-side
// .requested companions. Tests pin the enum is exactly the intended shape:
// the new bare data-domain literals exist, the .requested companions exist,
// the existing literals (auth.signin.failure / iam.claims.set) are preserved,
// over-broad shapes (e.g. data.action.delete bare) are rejected.

describe("auditEventInput — Phase 9 enum extension (Wave 3 substrate)", () => {
  // Test 1: bare data.action.softDelete (NEW — server-side lifecycle/softDelete emit)
  it("accepts data.action.softDelete bare flavour (server-side lifecycle emit)", () => {
    const out = auditEventInput.parse({
      type: "data.action.softDelete",
      target: { type: "action", id: "a1", orgId: "o1" },
      clientReqId: FIXED_UUID,
    });
    expect(out.type).toBe("data.action.softDelete");
  });

  // Test 2: .requested companion (client-side wrapper emit)
  it("accepts data.action.softDelete.requested .requested companion", () => {
    const out = auditEventInput.parse({
      type: "data.action.softDelete.requested",
      target: { type: "action", id: "a1", orgId: "o1" },
      clientReqId: FIXED_UUID,
    });
    expect(out.type).toBe("data.action.softDelete.requested");
  });

  // Test 3: bare data.message.permanentlyDelete (NEW)
  it("accepts data.message.permanentlyDelete bare flavour", () => {
    const out = auditEventInput.parse({
      type: "data.message.permanentlyDelete",
      target: { type: "message", id: "m1", orgId: "o1" },
      clientReqId: FIXED_UUID,
    });
    expect(out.type).toBe("data.message.permanentlyDelete");
  });

  // Test 4: data.funnelComment.restore.requested .requested (NEW)
  it("accepts data.funnelComment.restore.requested .requested companion", () => {
    const out = auditEventInput.parse({
      type: "data.funnelComment.restore.requested",
      target: { type: "funnelComment", id: "fc1", orgId: null },
      clientReqId: FIXED_UUID,
    });
    expect(out.type).toBe("data.funnelComment.restore.requested");
  });

  // Test 5: iam.claims.set.requested (NEW — client-side claims-admin emit)
  it("accepts iam.claims.set.requested .requested companion", () => {
    const out = auditEventInput.parse({
      type: "iam.claims.set.requested",
      target: { type: "user", id: "u1" },
      clientReqId: FIXED_UUID,
    });
    expect(out.type).toBe("iam.claims.set.requested");
  });

  // Test 6: compliance.erase.user.requested (NEW)
  it("accepts compliance.erase.user.requested .requested companion", () => {
    const out = auditEventInput.parse({
      type: "compliance.erase.user.requested",
      target: { type: "user", id: "u1" },
      clientReqId: FIXED_UUID,
    });
    expect(out.type).toBe("compliance.erase.user.requested");
  });

  // Test 7: existing literal preserved (auth.signin.failure was already in enum)
  it("STILL accepts auth.signin.failure (existing literal preserved post-extension)", () => {
    const out = auditEventInput.parse({
      type: "auth.signin.failure",
      target: { type: "user", id: "u1" },
      clientReqId: FIXED_UUID,
    });
    expect(out.type).toBe("auth.signin.failure");
  });

  // Test 8: existing literal preserved (iam.claims.set was already in enum)
  it("STILL accepts iam.claims.set (existing literal preserved post-extension)", () => {
    const out = auditEventInput.parse({
      type: "iam.claims.set",
      target: { type: "user", id: "u1" },
      clientReqId: FIXED_UUID,
    });
    expect(out.type).toBe("iam.claims.set");
  });

  // Test 9: data.action.delete bare is NOT in the enum (action only has soft/restore/perm new variants;
  // the Phase 7 baseline only added bare `delete` for document/message/comment/user/org).
  // This test pins the enum is exactly the intended shape, not over-broad.
  it("REJECTS data.action.delete bare (action only has the new soft/restore/permanently variants — no bare delete)", () => {
    expect(() =>
      auditEventInput.parse({
        type: "data.action.delete",
        target: { type: "action", id: "a1", orgId: "o1" },
        clientReqId: FIXED_UUID,
      }),
    ).toThrow();
  });

  // Test 10: completely bogus event rejected with ZodError
  it("rejects totally.bogus.event with ZodError (negative control)", () => {
    expect(() =>
      auditEventInput.parse({
        type: "totally.bogus.event",
        target: { type: "user", id: "u1" },
        clientReqId: FIXED_UUID,
      }),
    ).toThrow();
  });
});
