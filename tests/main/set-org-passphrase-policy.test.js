// tests/main/set-org-passphrase-policy.test.js
// @ts-check
// Pins the org client-passphrase length floor. The passphrase doubles as the
// client's first Firebase Auth password (inviteClient.ts createUser), so this
// floor MUST stay >= the Identity Platform passwordPolicy minimum — otherwise
// a client invited under a weaker passphrase is bricked at first
// signInWithEmailAndPassword (auth/password-does-not-meet-requirements).
//
// 2026-06 change: floor lowered 12 -> 6 per product decision (shorter
// passphrase). This is only safe alongside the matching operator change that
// lowers the Identity Platform passwordPolicy minLength to 6 + relaxes the
// leaked-password (HIBP) check — see docs/PRE-MERGE-UAT.md gating item. The
// chokepoint is setOrgClientPassphrase in src/main.js; the testable seam is the
// pure validateOrgPassphrase helper in src/auth/passphrase-policy.js.

import { describe, it, expect } from "vitest";

import {
  ORG_PASSPHRASE_MIN_LENGTH,
  validateOrgPassphrase,
} from "../../src/auth/passphrase-policy.js";

describe("ORG_PASSPHRASE_MIN_LENGTH", () => {
  it("is exactly 6 (2026-06 lowered floor; mirrors relaxed passwordPolicy)", () => {
    expect(ORG_PASSPHRASE_MIN_LENGTH).toBe(6);
  });
});

describe("validateOrgPassphrase — non-string / empty / undefined inputs", () => {
  it("returns false for undefined", () => {
    expect(validateOrgPassphrase(undefined)).toBe(false);
  });

  it("returns false for null", () => {
    expect(validateOrgPassphrase(null)).toBe(false);
  });

  it('returns false for the empty string ""', () => {
    expect(validateOrgPassphrase("")).toBe(false);
  });

  it("returns false for a numeric input (typeof guard)", () => {
    expect(validateOrgPassphrase(123456789012)).toBe(false);
  });

  it("returns false for an object input (typeof guard)", () => {
    expect(validateOrgPassphrase({ length: 12 })).toBe(false);
  });
});

describe("validateOrgPassphrase — length boundary", () => {
  it("returns false at 5 chars (one below floor)", () => {
    expect(validateOrgPassphrase("a".repeat(5))).toBe(false);
  });

  it("returns true at exactly 6 chars (floor)", () => {
    expect(validateOrgPassphrase("a".repeat(6))).toBe(true);
  });

  it("returns true at 16 chars (well above floor)", () => {
    expect(validateOrgPassphrase("CorrectHorse-12!")).toBe(true);
  });

  it("returns true at 64 chars (sanity — long passphrase accepted)", () => {
    expect(validateOrgPassphrase("z".repeat(64))).toBe(true);
  });
});
