// Phase 06.1 Wave 2 Task 1 (AUTH-16 / RESEARCH § "Don't Hand-Roll"): pins
// byte-parity between functions/src/util/hash.ts (server-side SHA-256) and
// src/util/hash.js (client-side SHA-256). The orgPassphrase verification at
// the inviteClient callable depends on this invariant — admin's modal hashes
// the passphrase candidate (via src/util/hash.js) at set-passphrase time;
// callable hashes the admin's transit candidate (via functions/src/util/
// hash.ts) at invite time. If the two hash functions ever drift, every
// invite would fail with "passphrase-mismatch" even with the correct input.
//
// Precomputed expectations (UTF-8 encoding + lowercase hex). Each value was
// generated via:
//   node -e 'console.log(require("crypto").createHash("sha256").update(<input>, "utf8").digest("hex"))'
//
// SHA-256 is deterministic — these values will not drift. If the server-side
// implementation in functions/src/util/hash.ts ever diverges (e.g. switches
// encoding or output format), THESE assertions are the regression gate.

import { describe, it, expect } from "vitest";
import { hashString as serverHashString } from "../../src/util/hash.js";

describe("functions/src/util/hash.ts — SHA-256 hex parity with src/util/hash.js", () => {
  // sha256("hello")
  it("hashes 'hello' to the canonical SHA-256 hex", async () => {
    expect(await serverHashString("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  // sha256("a 12-char strn") — UTF-8 ASCII input at the org-passphrase length floor
  it("hashes 'a 12-char strn' to the precomputed SHA-256 hex", async () => {
    expect(await serverHashString("a 12-char strn")).toBe(
      "7042a039bfc7a3de2eeebd57d0e891803859fe973a510ad5f38d826a92b7d42e",
    );
  });

  // sha256("") — canonical SHA-256 empty-string hex
  it("hashes the empty string to the canonical SHA-256 hex (e3b0c4...)", async () => {
    expect(await serverHashString("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });

  // sha256("café") — UTF-8 multi-byte encoding (the é is 0xC3 0xA9)
  it("hashes UTF-8 'café' (multi-byte é) to the precomputed SHA-256 hex", async () => {
    expect(await serverHashString("café")).toBe(
      "850f7dc43910ff890f8879c0ed26fe697c93a067ad93a7d50f466a7028a9bf4e",
    );
  });

  // sha256("z" * 100) — long ASCII input (boundary against single-block hash assumptions)
  it("hashes 100-char 'z' string to the precomputed SHA-256 hex", async () => {
    expect(await serverHashString("z".repeat(100))).toBe(
      "bd7475717a88f13dc3864a91c12fb7d155e7cccc8ca9430ef2665db2d2df7f2e",
    );
  });

  it("coerces non-string inputs via String() (defensive — production callers always pass strings)", async () => {
    // sha256("123") — same as String(123)
    const numericResult = await serverHashString(123);
    const stringResult = await serverHashString("123");
    expect(numericResult).toBe(stringResult);
    expect(stringResult).toBe(
      "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
    );
  });
});
