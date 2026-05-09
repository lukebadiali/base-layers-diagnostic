// Phase 6 (AUTH-03 / D-01 Wave 2 tests-first): unit tests for buildClaims().
// Pure-logic test seam — no firebase-functions-test substrate (deferred to
// Phase 7 TEST-09). These tests land BEFORE the implementation per Phase 5
// D-10 + Phase 6 D-01 Wave 2 (tests-first cadence).
import { describe, it, expect } from "vitest";
import { buildClaims } from "../../src/auth/claim-builder.js";
import type { AllowlistEntry } from "../../src/auth/claim-builder.js";

describe("buildClaims — allowlisted entries", () => {
  it.each<[AllowlistEntry, { role: string; orgId: string | null }]>([
    [{ role: "admin" }, { role: "admin", orgId: null }],
    [{ role: "internal" }, { role: "internal", orgId: null }],
    [{ role: "client", orgId: "org_abc" }, { role: "client", orgId: "org_abc" }],
    [{ role: "admin", orgId: "org_xyz" }, { role: "admin", orgId: "org_xyz" }],
  ])("maps %j to %j", (entry, expected) => {
    expect(buildClaims(entry)).toEqual(expected);
  });
});

describe("buildClaims — null entry (no allowlist match)", () => {
  it("falls through to a client role with null orgId", () => {
    expect(buildClaims(null)).toEqual({ role: "client", orgId: null });
  });
});

describe("buildClaims — drops unrelated fields", () => {
  it("ignores addedBy and any other fields", () => {
    const entry: AllowlistEntry = { role: "admin", addedBy: "phase-6-bootstrap" };
    expect(buildClaims(entry)).toEqual({ role: "admin", orgId: null });
  });
});
