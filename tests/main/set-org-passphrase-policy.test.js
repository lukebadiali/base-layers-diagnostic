// tests/main/set-org-passphrase-policy.test.js
// @ts-check
// Phase 06.1 Wave 1 Task 1 (AUTH-16 / RESEARCH § Critical Pinned Fact 1.1):
// pins the ≥12-char length floor for the org client passphrase. Admin SDK
// auth.createUser({password}) bypasses Identity Platform passwordPolicy
// (research finding A1) — if a weak passphrase is hashed and stored, every
// client invited under it will be bricked at first signInWithEmailAndPassword
// (auth/password-does-not-meet-requirements). The chokepoint is the modal-
// submit-driven setOrgClientPassphrase in src/main.js, but the testable seam
// is the pure validateOrgPassphrase helper in src/auth/passphrase-policy.js
// (which setOrgClientPassphrase calls before hashing).
//
// TDD RED gate (Wave 1 Task 1 Step 1a):
// This test file lands BEFORE src/auth/passphrase-policy.js exists. The
// module-not-found error is the canonical RED signal.

import { describe, it, expect } from "vitest";

import {
  ORG_PASSPHRASE_MIN_LENGTH,
  validateOrgPassphrase,
} from "../../src/auth/passphrase-policy.js";

describe("ORG_PASSPHRASE_MIN_LENGTH", () => {
  it("is exactly 12 (RESEARCH § Critical Pinned Fact 1.1 floor)", () => {
    expect(ORG_PASSPHRASE_MIN_LENGTH).toBe(12);
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
  it("returns false at 11 chars (one below floor)", () => {
    expect(validateOrgPassphrase("a".repeat(11))).toBe(false);
  });

  it("returns true at exactly 12 chars (floor)", () => {
    expect(validateOrgPassphrase("a".repeat(12))).toBe(true);
  });

  it("returns true at 16 chars (well above floor)", () => {
    expect(validateOrgPassphrase("CorrectHorse-12!")).toBe(true);
  });

  it("returns true at 64 chars (sanity — long passphrase accepted)", () => {
    expect(validateOrgPassphrase("z".repeat(64))).toBe(true);
  });
});
