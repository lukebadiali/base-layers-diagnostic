// tests/crypto-parity.test.js
// @ts-check
// Phase 2 (D-12 + Pre-flight 3): happy-dom crypto.subtle.digest produces the
// same SHA-256 hex output as Node's crypto.createHash. If this test fails, the
// SHA-256 parity vectors below cannot be trusted and we need a one-line
// shim in src/util/hash.js. Evidence in 02-RESEARCH.md says it won't.
//
// Phase 06.1 Wave 3 (AUTH-17 / D-16): the legacy auth-passwords fixture
// was deleted alongside the state-machine module that consumed it; the 2
// canonical SHA-256 parity vectors below were inlined here (generated
// originally by Node createHash — tests/fixtures/_generators/hash-passwords.js
// retained as the generator).
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";

const knownPasswords = {
  orgClient: {
    plain: "TestOrgClient!2026",
    sha256: "8cf4f8f74fd67acfa6c1df97f0fd5a765d661b39011df18903d6aa69fef87528",
  },
  user: {
    plain: "TestUser!2026",
    sha256: "dac78831720c19dea1ee01f157838e48f44fd9db9382cffd22b680eba998df3d",
  },
};

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
