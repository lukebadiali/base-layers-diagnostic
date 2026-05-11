// Phase 8 Wave 4 (GDPR-02 / Pitfall C): unit tests for pseudonymToken pure helper.
// Pattern C purity: no firebase-admin imports, no vi.mock needed.
// 7 behaviours (6 function tests + 1 isTombstoneToken guard tests).

import { describe, it, expect } from "vitest";
import { tombstoneTokenForUser, isTombstoneToken, TOMBSTONE_TOKEN_LENGTH, TOMBSTONE_PREFIX, TOMBSTONE_HEX_LENGTH } from "../../src/gdpr/pseudonymToken.js";

describe("tombstoneTokenForUser", () => {
  // Test 1: deterministic — same uid + secret always yields the same token
  it("is deterministic: same uid + secret → same token", () => {
    const a = tombstoneTokenForUser("u-123", "secret-A");
    const b = tombstoneTokenForUser("u-123", "secret-A");
    expect(a).toBe(b);
  });

  // Test 2: secret-keyed — different secret → different token
  it("is secret-keyed: same uid, different secret → different token", () => {
    const a = tombstoneTokenForUser("u-123", "secret-A");
    const b = tombstoneTokenForUser("u-123", "secret-B");
    expect(a).not.toBe(b);
  });

  // Test 3: uid-discriminated — different uid → different token
  it("is uid-discriminated: different uid, same secret → different token", () => {
    const a = tombstoneTokenForUser("u-123", "secret-A");
    const b = tombstoneTokenForUser("u-456", "secret-A");
    expect(a).not.toBe(b);
  });

  // Test 4: length contract — prefix 13 + 16 hex chars = 29 total
  it("returns a token of length 29 (TOMBSTONE_TOKEN_LENGTH) starting with deleted-user-", () => {
    const token = tombstoneTokenForUser("u-123", "secret-A");
    expect(token.length).toBe(TOMBSTONE_TOKEN_LENGTH);
    expect(TOMBSTONE_TOKEN_LENGTH).toBe(29);
    expect(TOMBSTONE_PREFIX.length).toBe(13);
    expect(TOMBSTONE_HEX_LENGTH).toBe(16);
    expect(token.startsWith("deleted-user-")).toBe(true);
    // The 16 hex chars after the prefix must be valid hex
    const hexPart = token.slice(TOMBSTONE_PREFIX.length);
    expect(hexPart).toMatch(/^[0-9a-f]{16}$/);
  });

  // Test 5: empty secret throws
  it("throws if secret is empty", () => {
    expect(() => tombstoneTokenForUser("u-123", "")).toThrow("secret required");
  });

  // Test 6: empty uid throws
  it("throws if uid is empty", () => {
    expect(() => tombstoneTokenForUser("", "secret-A")).toThrow("uid required");
  });
});

describe("isTombstoneToken", () => {
  // Test 7: isTombstoneToken shape checks
  it("recognises a valid tombstone token", () => {
    // 29 chars: 13 prefix + 16 hex
    expect(isTombstoneToken("deleted-user-abc123def456ab12")).toBe(true);
  });

  it("rejects a token that is too short (wrong number of hex chars)", () => {
    expect(isTombstoneToken("deleted-user-short")).toBe(false);
  });

  it("rejects null", () => {
    expect(isTombstoneToken(null)).toBe(false);
  });

  it("rejects a number", () => {
    expect(isTombstoneToken(42)).toBe(false);
  });

  it("rejects a token missing the prefix", () => {
    expect(isTombstoneToken("abc123def456ab12cdef")).toBe(false);
  });

  it("a real computed token passes isTombstoneToken", () => {
    const token = tombstoneTokenForUser("u-xyz", "any-secret");
    expect(isTombstoneToken(token)).toBe(true);
  });
});
