// tests/data/audit-events.test.js
// @ts-check
// Phase 4 Wave 3 (D-11): audit-events.js is a pass-through to cloud/audit.js
// (which is itself a Phase 7 stub). Tests assert the call delegates without
// throwing — the actual auditWrite callable wires Phase 7 (FN-04 / AUDIT-01).
import { describe, it, expect, vi } from "vitest";

const writeAuditEventSpy = vi.fn(async (/** @type {*} */ _input) => undefined);
vi.mock("../../src/cloud/audit.js", () => ({
  writeAuditEvent: writeAuditEventSpy,
}));

const { recordAuditEvent } = await import("../../src/data/audit-events.js");

describe("data/audit-events.js (D-11 pass-through to cloud/audit.js)", () => {
  it("recordAuditEvent delegates to cloud/audit.js's writeAuditEvent", async () => {
    await recordAuditEvent({ event: "test.event", payload: { x: 1 } });
    expect(writeAuditEventSpy).toHaveBeenCalledWith({ event: "test.event", payload: { x: 1 } });
  });

  it("recordAuditEvent resolves to undefined (no-op surface today)", async () => {
    await expect(recordAuditEvent({ event: "test.event" })).resolves.toBeUndefined();
  });
});
