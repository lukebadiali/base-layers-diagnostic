// tests/data/audit-events.test.js
// @ts-check
// Phase 4 Wave 3 (D-11) → Phase 7 Wave 6 (FN-04 / AUDIT-01 / 07-06): the
// cloud/audit.js seam is now body-filled. recordAuditEvent forwards the
// auditEventInput-shaped payload to cloud/audit.writeAuditEvent and returns
// the {ok, eventId} response. This test pins the delegation contract via a
// vi.mock spy on cloud/audit.js.
import { describe, it, expect, vi } from "vitest";

const writeAuditEventSpy = vi.fn(async () => ({ ok: true, eventId: "evt-1" }));
vi.mock("../../src/cloud/audit.js", () => ({
  writeAuditEvent: writeAuditEventSpy,
}));

const { recordAuditEvent } = await import("../../src/data/audit-events.js");

describe("data/audit-events.js (Phase 7 Wave 6 — delegates to cloud/audit.js)", () => {
  it("recordAuditEvent delegates the auditEventInput payload to writeAuditEvent", async () => {
    const input = {
      type: "auth.signin.success",
      target: { type: "user", id: "u1" },
      payload: { x: 1 },
    };
    await recordAuditEvent(input);
    expect(writeAuditEventSpy).toHaveBeenCalledWith(input);
  });

  it("recordAuditEvent resolves to the {ok, eventId} response from the callable", async () => {
    const result = await recordAuditEvent({
      type: "auth.signout",
      target: { type: "user", id: "u2" },
    });
    expect(result).toEqual({ ok: true, eventId: "evt-1" });
  });
});
