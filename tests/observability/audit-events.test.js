// tests/observability/audit-events.test.js
// @ts-check
// Phase 4 Wave 3 (D-11) smoke test for the AUDIT_EVENTS constants table.
// Phase 7 (AUDIT-02) populates the table with the canonical event-name set;
// Phase 9 (AUDIT-05) wires emitAuditEvent calls in views/*.
//
// The table is FROZEN today so any accidental write fails silently in non-
// strict mode and throws in strict mode (which @ts-check enforces). The
// freeze test pins the contract.
import { describe, it, expect } from "vitest";
import { AUDIT_EVENTS, emitAuditEvent } from "../../src/observability/audit-events.js";

describe("observability/audit-events.js (Phase 4 D-11 stub)", () => {
  it("AUDIT_EVENTS is exported as an object", () => {
    expect(typeof AUDIT_EVENTS).toBe("object");
    expect(AUDIT_EVENTS).not.toBeNull();
  });

  it("AUDIT_EVENTS is a frozen object", () => {
    expect(Object.isFrozen(AUDIT_EVENTS)).toBe(true);
  });

  it("emitAuditEvent is a function", () => {
    expect(typeof emitAuditEvent).toBe("function");
  });

  it("emitAuditEvent does not throw (no-op)", () => {
    expect(() => emitAuditEvent("test.event", { x: 1 })).not.toThrow();
  });
});
