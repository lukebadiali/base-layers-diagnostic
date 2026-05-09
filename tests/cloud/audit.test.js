// tests/cloud/audit.test.js
// @ts-check
// Phase 4 Wave 3 (D-11) smoke test for the cloud/audit.js stub. Phase 7
// (FN-04 / AUDIT-01) replaces the body with a real auditWrite httpsCallable;
// this test pins the import-surface contract (function exists + resolves to
// undefined as a no-op) so the Phase 7 swap is a body-only change.
//
// Excluded from coverage thresholds in Phase 4 per D-21 (cloud/* bodies land
// Phase 7/8); existence here satisfies the Pattern Map "test-file pairing"
// rule, not coverage gating.
import { describe, it, expect } from "vitest";
import { writeAuditEvent } from "../../src/cloud/audit.js";

describe("cloud/audit.js (Phase 4 D-11 stub)", () => {
  it("writeAuditEvent is a function", () => {
    expect(typeof writeAuditEvent).toBe("function");
  });

  it("writeAuditEvent resolves without throwing (no-op)", async () => {
    await expect(writeAuditEvent({ event: "test" })).resolves.toBeUndefined();
  });
});
