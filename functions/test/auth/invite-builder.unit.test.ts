// Phase 06.1 Wave 1 Task 1 (AUTH-16 / D-12 / RESEARCH § Pattern 2 + § 6.2):
// unit tests for the pure-logic invite-builder helpers consumed by
// inviteClient.ts (Wave 2). Mirror functions/test/auth/claim-builder.test.ts
// shape — pure-logic test seam, no firebase-functions-test substrate, no
// vi.mock substrate. Tests land BEFORE the implementation per Wave 1 D-01
// tests-first cadence (canonical RED signal: module-not-found error).

import { describe, it, expect } from "vitest";
import {
  verifyOrgPassphrase,
  buildInviteClaims,
  decideInviteOutcome,
} from "../../src/auth/invite-builder.js";
import type { InviteOutcome } from "../../src/auth/invite-builder.js";

// Deterministic stub hashFn — does NOT shell out to node:crypto so the
// pure-logic invariant of invite-builder.ts holds (no firebase-* or runtime
// imports leak in via the test seam). `verifyOrgPassphrase` is the only
// async unit, and it MUST short-circuit before calling hashFn when storedHash
// is null — the test below pins that contract via spy semantics.
const stubHash = async (s: string): Promise<string> => s + ":HASH";

describe("verifyOrgPassphrase — null-storedHash short-circuit", () => {
  it("returns false when storedHash is null and does NOT invoke hashFn", async () => {
    let hashFnCalls = 0;
    const spyHash = async (s: string): Promise<string> => {
      hashFnCalls += 1;
      return s + ":HASH";
    };
    const result = await verifyOrgPassphrase(null, "anything", spyHash);
    expect(result).toBe(false);
    expect(hashFnCalls).toBe(0);
  });
});

describe("verifyOrgPassphrase — candidate vs stored", () => {
  it("returns false when candidateHash !== storedHash", async () => {
    const result = await verifyOrgPassphrase("OTHER:HASH", "candidate", stubHash);
    expect(result).toBe(false);
  });

  it("returns true when candidateHash === storedHash", async () => {
    const result = await verifyOrgPassphrase("candidate:HASH", "candidate", stubHash);
    expect(result).toBe(true);
  });
});

describe("buildInviteClaims", () => {
  it('returns { role: "client", orgId, firstRun: true } for a given orgId', () => {
    // RESEARCH § 6.2 regression-gate: firstRun MUST be the literal true (boolean).
    // SetClaimsSchema deliberately drops firstRun on password-change so this
    // value flips to undefined at first-run completion via getIdToken(true)
    // refresh; if firstRun is anything other than the literal true here, the
    // first-run loop never starts.
    expect(buildInviteClaims("org_abc")).toEqual({
      role: "client",
      orgId: "org_abc",
      firstRun: true,
    });
  });

  it("preserves the literal orgId byte-for-byte (no trimming)", () => {
    const out = buildInviteClaims("org_xyz-123");
    expect(out.orgId).toBe("org_xyz-123");
  });
});

describe("decideInviteOutcome — 6-case boundary table", () => {
  // RESEARCH § Pattern 2 boundary table — 6 cases pinning the pure switch.
  it.each<[string, Parameters<typeof decideInviteOutcome>[0], InviteOutcome]>([
    [
      "passphrase not set → passphrase-not-set",
      {
        passphraseSet: false,
        passphraseValid: false,
        existingUser: null,
        requestedOrgId: "orgA",
        confirmReset: false,
      },
      { kind: "passphrase-not-set" },
    ],
    [
      "passphrase set but invalid → passphrase-invalid",
      {
        passphraseSet: true,
        passphraseValid: false,
        existingUser: null,
        requestedOrgId: "orgA",
        confirmReset: false,
      },
      { kind: "passphrase-invalid" },
    ],
    [
      "valid passphrase + no existing user → create",
      {
        passphraseSet: true,
        passphraseValid: true,
        existingUser: null,
        requestedOrgId: "orgA",
        confirmReset: false,
      },
      { kind: "create" },
    ],
    [
      "valid + existing user same orgId → resend",
      {
        passphraseSet: true,
        passphraseValid: true,
        existingUser: { uid: "u1", orgId: "orgA", role: "client" },
        requestedOrgId: "orgA",
        confirmReset: false,
      },
      { kind: "resend", existingUid: "u1" },
    ],
    [
      "valid + existing user different orgId → cross-org-refuse",
      {
        passphraseSet: true,
        passphraseValid: true,
        existingUser: { uid: "u1", orgId: "orgA", role: "client" },
        requestedOrgId: "orgB",
        confirmReset: false,
      },
      { kind: "cross-org-refuse", existingUid: "u1", existingOrgId: "orgA" },
    ],
    [
      "edge — orphan claims (orgId null, role null) → resend (RESEARCH § 8 adoption)",
      {
        passphraseSet: true,
        passphraseValid: true,
        existingUser: { uid: "u1", orgId: null, role: null },
        requestedOrgId: "orgB",
        confirmReset: false,
      },
      { kind: "resend", existingUid: "u1" },
    ],
  ])("%s", (_label, args, expected) => {
    expect(decideInviteOutcome(args)).toEqual(expected);
  });
});
