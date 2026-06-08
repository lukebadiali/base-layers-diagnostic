// tests/auth/role-predicates.test.js
// @ts-check
// PLATFORM-UAT T17 regression fixture: lock the role-predicate contract so
// the {admin, internal, client} taxonomy stays explicit. If the role enum
// ever changes (e.g. a new "viewer" role is added), failing this test
// is the signal to revisit the 8+ sweep sites that import isStaff.

import { describe, it, expect } from "vitest";
import {
  isStaff,
  isInternalOnly,
  mfaEnrolmentRequiredForRole,
} from "../../src/auth/role-predicates.js";

describe("isStaff", () => {
  it("returns true for admin", () => {
    expect(isStaff({ role: "admin" })).toBe(true);
  });

  it("returns true for internal", () => {
    expect(isStaff({ role: "internal" })).toBe(true);
  });

  it("returns false for client", () => {
    expect(isStaff({ role: "client" })).toBe(false);
  });

  it("returns false for unknown role values", () => {
    expect(isStaff({ role: "viewer" })).toBe(false);
    expect(isStaff({ role: "" })).toBe(false);
  });

  it("returns false for null/undefined user (terse caller pattern)", () => {
    expect(isStaff(null)).toBe(false);
    expect(isStaff(undefined)).toBe(false);
  });

  it("returns false for user with no role field", () => {
    expect(isStaff({})).toBe(false);
  });
});

describe("isInternalOnly", () => {
  it("returns true ONLY for internal (not admin, not client)", () => {
    expect(isInternalOnly({ role: "internal" })).toBe(true);
    expect(isInternalOnly({ role: "admin" })).toBe(false);
    expect(isInternalOnly({ role: "client" })).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isInternalOnly(null)).toBe(false);
    expect(isInternalOnly(undefined)).toBe(false);
  });
});

describe("mfaEnrolmentRequiredForRole", () => {
  // Takes the bare role string (state.fbUser.appClaims.role), not a user
  // object — the sign-in-ladder gate in main.js has already extracted `role`.
  it("requires MFA enrolment for every known app role", () => {
    expect(mfaEnrolmentRequiredForRole("admin")).toBe(true);
    expect(mfaEnrolmentRequiredForRole("internal")).toBe(true);
    // The client case is the behaviour this predicate exists to add — clients
    // were previously exempt from the forced-enrolment gate.
    expect(mfaEnrolmentRequiredForRole("client")).toBe(true);
  });

  it("does NOT force enrolment for unknown roles (explicit taxonomy)", () => {
    // A future role must be added here deliberately — never force MFA on a
    // role we haven't reasoned about.
    expect(mfaEnrolmentRequiredForRole("viewer")).toBe(false);
    expect(mfaEnrolmentRequiredForRole("client-preview")).toBe(false);
    expect(mfaEnrolmentRequiredForRole("")).toBe(false);
  });

  it("returns false for null/undefined role (terse caller pattern)", () => {
    expect(mfaEnrolmentRequiredForRole(null)).toBe(false);
    expect(mfaEnrolmentRequiredForRole(undefined)).toBe(false);
  });
});
