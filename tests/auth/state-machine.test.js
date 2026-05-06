// tests/auth/state-machine.test.js
// @ts-check

/**
 * REGRESSION BASELINE — Phase 2 / Phase 6 (AUTH-14) deletes
 *
 * These tests pin the CURRENT comparator path: client-side SHA-256 of a
 * pre-shared password compared against a hardcoded hash (INTERNAL_PASSWORD_HASH)
 * or per-org/per-user hash. Phase 6 (AUTH-14) deletes the whole comparator path
 * when real Firebase Auth + custom claims land. When that lands, these tests
 * will be DELETED (not "translated") alongside the production code, per
 * CONTEXT.md `<specifics>` third bullet. The tests' value is the regression
 * baseline during the Phase 6 cutover, not long-term coverage.
 */

// Provenance: Phase 2 (D-05) regression baseline test for src/auth/state-machine.js extraction

import { describe, it, expect } from "vitest";
import {
  verifyInternalPassword,
  verifyOrgClientPassphrase,
  verifyUserPassword,
  currentUser,
} from "../../src/auth/state-machine.js";
import { knownPasswords } from "../fixtures/auth-passwords.js";

describe("verifyInternalPassword", () => {
  const deps = { INTERNAL_PASSWORD_HASH: knownPasswords.internal.sha256 };

  it("returns true for the known internal plaintext", async () => {
    expect(await verifyInternalPassword(knownPasswords.internal.plain, deps)).toBe(true);
  });

  it("returns false for an incorrect plaintext", async () => {
    expect(await verifyInternalPassword("wrong-password", deps)).toBe(false);
  });

  it("returns false when INTERNAL_PASSWORD_HASH is empty / undefined", async () => {
    expect(await verifyInternalPassword("anything", { INTERNAL_PASSWORD_HASH: "" })).toBe(false);
  });
});

describe("verifyOrgClientPassphrase", () => {
  const matchingOrg = { id: "org_a", clientPassphraseHash: knownPasswords.orgClient.sha256 };

  it("returns false when loadOrg returns null", async () => {
    const deps = { loadOrg: () => null };
    expect(await verifyOrgClientPassphrase("org_a", knownPasswords.orgClient.plain, deps)).toBe(false);
  });

  it("returns false when org has no clientPassphraseHash", async () => {
    const deps = { loadOrg: () => ({ id: "org_a" }) }; // no hash set
    expect(await verifyOrgClientPassphrase("org_a", "anything", deps)).toBe(false);
  });

  it("returns true for the known org-client plaintext + matching hash", async () => {
    const deps = { loadOrg: () => matchingOrg };
    expect(await verifyOrgClientPassphrase("org_a", knownPasswords.orgClient.plain, deps)).toBe(true);
  });

  it("returns false on hash mismatch", async () => {
    const deps = { loadOrg: () => matchingOrg };
    expect(await verifyOrgClientPassphrase("org_a", "wrong-pass", deps)).toBe(false);
  });
});

describe("verifyUserPassword", () => {
  const matchingUser = { id: "u1", passwordHash: knownPasswords.user.sha256 };

  it("returns false when findUser returns null", async () => {
    const deps = { findUser: () => null };
    expect(await verifyUserPassword("u1", knownPasswords.user.plain, deps)).toBe(false);
  });

  it("returns false when user has no passwordHash", async () => {
    const deps = { findUser: () => ({ id: "u1" }) };
    expect(await verifyUserPassword("u1", "anything", deps)).toBe(false);
  });

  it("returns true for the known user plaintext + matching hash", async () => {
    const deps = { findUser: () => matchingUser };
    expect(await verifyUserPassword("u1", knownPasswords.user.plain, deps)).toBe(true);
  });

  it("returns false on hash mismatch", async () => {
    const deps = { findUser: () => matchingUser };
    expect(await verifyUserPassword("u1", "wrong", deps)).toBe(false);
  });
});

describe("currentUser", () => {
  it("returns null when currentSession() returns null", () => {
    const deps = { currentSession: () => null, findUser: () => null };
    expect(currentUser(deps)).toBeNull();
  });

  it("returns the user from findUser when a session exists", () => {
    const u = { id: "u1", name: "Alice" };
    const deps = {
      currentSession: () => ({ userId: "u1" }),
      /** @param {string} id */
      findUser: (id) => (id === "u1" ? u : null),
    };
    expect(currentUser(deps)).toBe(u);
  });
});
