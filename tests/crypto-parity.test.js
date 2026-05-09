// tests/crypto-parity.test.js
// @ts-check
// Phase 2 (D-12 + Pre-flight 3): happy-dom crypto.subtle.digest produces the
// same SHA-256 hex output as Node's crypto.createHash. If this test fails, the
// auth-password fixtures (TEST-07) cannot be trusted and we need a one-line
// shim in src/util/hash.js. Evidence in 02-RESEARCH.md says it won't.
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { knownPasswords } from "./fixtures/auth-passwords.js";

/**
 * @param {string} s
 * @returns {Promise<string>}
 */
async function happyDomSha256Hex(s) {
  const enc = new TextEncoder().encode(String(s));
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("crypto.subtle.digest parity (Pre-flight 3)", () => {
  it.each(Object.entries(knownPasswords))(
    "happy-dom SHA-256 matches Node createHash for %s",
    async (_label, { plain, sha256 }) => {
      const happyDomHash = await happyDomSha256Hex(plain);
      const nodeHash = createHash("sha256").update(plain, "utf8").digest("hex");
      expect(happyDomHash).toBe(nodeHash);
      expect(happyDomHash).toBe(sha256); // also matches the committed fixture
    },
  );
});
