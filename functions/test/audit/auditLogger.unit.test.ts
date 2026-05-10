// Phase 7 Wave 1 (AUDIT-02 / FN-01): unit tests for auditLogger.
// - buildAuditEventDoc is pure; tested directly.
// - writeAuditEvent calls firestore.doc(auditLog/{eventId}).set; tested with
//   a mocked firebase-admin/firestore module.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildAuditEventDoc, type ServerContext } from "../../src/audit/auditLogger.js";
import type { AuditEventInput } from "../../src/audit/auditEventSchema.js";

const FIXED_UUID = "550e8400-e29b-41d4-a716-446655440000";

const baseInput: AuditEventInput = {
  type: "iam.claims.set",
  target: { type: "claims", id: "user-123" },
  clientReqId: FIXED_UUID,
};

const baseCtx: ServerContext = {
  now: 1700000000000,
  eventId: "fixed-uuid-evt",
  ip: "1.2.3.4",
  userAgent: "UA/Test",
  actor: { uid: "actor-1", email: null, role: "admin", orgId: null },
};

describe("buildAuditEventDoc — canonical doc shape (Test 1)", () => {
  it("returns the canonical Firestore doc shape per ARCHITECTURE.md section 5", () => {
    const doc = buildAuditEventDoc(baseInput, baseCtx);
    expect(doc).toEqual({
      eventId: "fixed-uuid-evt",
      type: "iam.claims.set",
      severity: "info",
      actor: baseCtx.actor,
      target: { type: "claims", id: "user-123" },
      at: new Date(1700000000000).toISOString(),
      ip: "1.2.3.4",
      userAgent: "UA/Test",
      payload: {},
      idempotencyKey: `actor-1:iam.claims.set:user-123:${FIXED_UUID}`,
      schemaVersion: 1,
    });
  });

  it("propagates supplied severity over default 'info'", () => {
    const doc = buildAuditEventDoc(
      { ...baseInput, severity: "warning" },
      baseCtx,
    );
    expect(doc.severity).toBe("warning");
  });

  it("propagates supplied payload object verbatim", () => {
    const doc = buildAuditEventDoc(
      { ...baseInput, payload: { reason: "x" } },
      baseCtx,
    );
    expect(doc.payload).toEqual({ reason: "x" });
  });
});

describe("buildAuditEventDoc — schemaVersion is always 1 (Test 2)", () => {
  it("hard-codes schemaVersion: 1 — never derived from input", () => {
    const doc = buildAuditEventDoc(baseInput, baseCtx);
    expect(doc.schemaVersion).toBe(1);
    // Verify it ignores any malicious schemaVersion smuggled into payload —
    // payload is preserved verbatim but the top-level schemaVersion stays 1.
    const tampered = buildAuditEventDoc(
      { ...baseInput, payload: { schemaVersion: 99 } },
      baseCtx,
    );
    expect(tampered.schemaVersion).toBe(1);
    expect(tampered.payload).toEqual({ schemaVersion: 99 });
  });
});

describe("buildAuditEventDoc — server-provided `at` overrides default (Test 3)", () => {
  it("uses server-supplied `at` field when provided (FieldValue.serverTimestamp() in production)", () => {
    const SERVER_TS_SENTINEL = { __serverTimestamp: true } as unknown;
    const doc = buildAuditEventDoc(baseInput, {
      ...baseCtx,
      at: SERVER_TS_SENTINEL,
    });
    expect(doc.at).toBe(SERVER_TS_SENTINEL);
  });

  it("falls back to ISO string of `now` when no `at` is supplied", () => {
    const doc = buildAuditEventDoc(baseInput, baseCtx);
    expect(doc.at).toBe(new Date(1700000000000).toISOString());
  });

  it("never copies `at` from input — only ServerContext drives `at`", () => {
    const tampered = buildAuditEventDoc(
      { ...baseInput, payload: { at: "client-supplied-time" } },
      baseCtx,
    );
    expect(tampered.at).not.toBe("client-supplied-time");
    expect(tampered.at).toBe(new Date(1700000000000).toISOString());
  });
});

describe("buildAuditEventDoc — idempotencyKey derivation", () => {
  it("uses ctx.idempotencyKey when supplied", () => {
    const doc = buildAuditEventDoc(baseInput, {
      ...baseCtx,
      idempotencyKey: "explicit-key",
    });
    expect(doc.idempotencyKey).toBe("explicit-key");
  });

  it("falls back to actor.uid:type:target.id:clientReqId composition", () => {
    const doc = buildAuditEventDoc(baseInput, baseCtx);
    expect(doc.idempotencyKey).toBe(
      `actor-1:iam.claims.set:user-123:${FIXED_UUID}`,
    );
  });

  it("substitutes 'system' when actor.uid is null", () => {
    const doc = buildAuditEventDoc(baseInput, {
      ...baseCtx,
      actor: { uid: null, email: null, role: "system", orgId: null },
    });
    expect(doc.idempotencyKey).toBe(
      `system:iam.claims.set:user-123:${FIXED_UUID}`,
    );
  });
});

// ─── Admin-SDK side: writeAuditEvent calls firestore.doc().set() exactly once ──

const setSpy = vi.fn();
const docSpy = vi.fn(() => ({ set: setSpy }));
const getFirestoreSpy = vi.fn(() => ({ doc: docSpy }));
const SERVER_TS = { __serverTs: true };

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: () => getFirestoreSpy(),
  FieldValue: { serverTimestamp: () => SERVER_TS },
}));

describe("writeAuditEvent — Admin-SDK side calls firestore.doc().set() exactly once (Test 4)", () => {
  beforeEach(() => {
    setSpy.mockReset().mockResolvedValue(undefined);
    docSpy.mockClear();
    getFirestoreSpy.mockClear();
  });

  it("writes to auditLog/{eventId} with the canonical doc shape (FieldValue.serverTimestamp() injected)", async () => {
    const { writeAuditEvent } = await import("../../src/audit/auditLogger.js");

    const written = await writeAuditEvent(baseInput, baseCtx);

    expect(docSpy).toHaveBeenCalledTimes(1);
    expect(docSpy).toHaveBeenCalledWith("auditLog/fixed-uuid-evt");
    expect(setSpy).toHaveBeenCalledTimes(1);
    const writtenDoc = setSpy.mock.calls[0][0];
    expect(writtenDoc.eventId).toBe("fixed-uuid-evt");
    expect(writtenDoc.type).toBe("iam.claims.set");
    expect(writtenDoc.schemaVersion).toBe(1);
    // FieldValue.serverTimestamp() sentinel injected unless ctx.at supplied.
    expect(writtenDoc.at).toBe(SERVER_TS);
    expect(written.eventId).toBe("fixed-uuid-evt");
  });
});
