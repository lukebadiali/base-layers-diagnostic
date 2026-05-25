// tests/auth/role-predicates.test.js
// @ts-check
// PLATFORM-UAT T17 regression fixture: lock the role-predicate contract so
// the {admin, internal, client} taxonomy stays explicit. If the role enum
// ever changes (e.g. a new "viewer" role is added), failing this test
// is the signal to revisit the 8+ sweep sites that import isStaff.

import { describe, it, expect } from "vitest";
import { isStaff, isInternalOnly } from "../../src/auth/role-predicates.js";

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
