// tests/cloud/claims-admin.test.js
// @ts-check
// Phase 6 Wave 3 (AUTH-07): smoke test for the filled httpsCallable wrapper.
// The body now invokes setClaimsCallable through firebase/functions; full
// integration testing against a Cloud Function emulator lands in Phase 7
// (TEST-09 firebase-functions-test substrate). Phase 6 verifies the export
// shape only - the callable wiring is verified via lint + typecheck (the
// httpsCallable("setClaims") import resolves correctly through src/firebase/
// functions.js per the four-boundary lint rules).
import { describe, it, expect } from "vitest";
import { setClaims } from "../../src/cloud/claims-admin.js";

describe("cloud/claims-admin.js (Phase 6 AUTH-07 wired body)", () => {
  it("setClaims is a function", () => {
    expect(typeof setClaims).toBe("function");
  });
});
