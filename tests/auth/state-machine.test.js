// tests/auth/state-machine.test.js
// @ts-check

/**
 * REGRESSION BASELINE for client/user passphrase paths.
 *
 * Phase 2 (D-05) regression baseline. Phase 6 Wave 5 (AUTH-14 / D-04) removed
 * the verifyInternalPassword test cases alongside deletion of the legacy
 * internal-admin-password mechanism (replaced by Firebase Auth). The
 * verifyOrgClientPassphrase + verifyUserPassword + currentUser test cases
 * remain — those exports are still in active use for client/user passphrase
 * login paths (main.js call sites at lines 1012, 1033, 4934).
 */

import { describe, it, expect } from "vitest";
import {
  verifyOrgClientPassphrase,
  verifyUserPassword,
  currentUser,
} from "../../src/auth/state-machine.js";
import { knownPasswords } from "../fixtures/auth-passwords.js";

describe("verifyOrgClientPassphrase", () => {
  const matchingOrg = { id: "org_a", clientPassphraseHash: knownPasswords.orgClient.sha256 };

  it("returns false when loadOrg returns null", async () => {
    const deps = { loadOrg: () => null };
    expect(await verifyOrgClientPassphrase("org_a", knownPasswords.orgClient.plain, deps)).toBe(
      false,
    );
  });

  it("returns false when org has no clientPassphraseHash", async () => {
    const deps = { loadOrg: () => ({ id: "org_a" }) }; // no hash set
    expect(await verifyOrgClientPassphrase("org_a", "anything", deps)).toBe(false);
  });

  it("returns true for the known org-client plaintext + matching hash", async () => {
    const deps = { loadOrg: () => matchingOrg };
    expect(await verifyOrgClientPassphrase("org_a", knownPasswords.orgClient.plain, deps)).toBe(
      true,
    );
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
