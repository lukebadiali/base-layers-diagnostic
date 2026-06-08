// Unit tests for the pure-logic internal-invite claims builder consumed by
// inviteInternal.ts. Mirrors invite-builder.unit.test.ts shape — pure-logic
// seam, no firebase-functions-test substrate. Tests land BEFORE the
// implementation (canonical RED signal: module-not-found error).

import { describe, it, expect } from "vitest";
import { buildInternalInviteClaims } from "../../src/auth/internal-invite-builder.js";

describe("buildInternalInviteClaims", () => {
  it("builds internal-staff claims with orgId null + firstRun true", () => {
    expect(buildInternalInviteClaims("internal")).toEqual({
      role: "internal",
      orgId: null,
      firstRun: true,
    });
  });

  it("builds admin claims with orgId null + firstRun true", () => {
    expect(buildInternalInviteClaims("admin")).toEqual({
      role: "admin",
      orgId: null,
      firstRun: true,
    });
  });

  it("sets firstRun to the literal boolean true (drives renderFirstRun)", () => {
    // Mirrors the buildInviteClaims invariant: firstRun must be literal `true`
    // so the first-run forced-password-change view mounts. setClaims (called
    // after the member sets their password) drops firstRun because
    // SetClaimsSchema omits it — that overwrite is what exits the first-run
    // loop. Internal exits via the self-update branch; admin via the isAdmin
    // branch (setClaims.ts).
    const claims = buildInternalInviteClaims("internal");
    expect(claims.firstRun).toBe(true);
    expect(claims.orgId).toBe(null);
  });
});
