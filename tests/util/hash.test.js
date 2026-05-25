// tests/util/hash.test.js
// @ts-check
// Phase 2 (TEST-01): coverage of src/util/hash.js. Uses real crypto.subtle.digest
// from happy-dom (D-12). Phase 06.1 Wave 3 (AUTH-17 / D-16): the legacy
// auth-passwords fixture was deleted alongside the state-machine module
// that consumed it; the 2 canonical SHA-256 parity vectors below were
// inlined here (generated originally by Node createHash —
// tests/fixtures/_generators/hash-passwords.js retained as the generator).
//
// Phase 06.1 WR-01 fix: the prior "falls back to a 32-bit hash string" test
// case was replaced with a "throws when crypto.subtle.digest fails" case.
// The fallback was removed because it silently drifted client-side
// orgs/{orgId}.clientPassphraseHash away from the server-side SHA-256 hex,
// bricking every subsequent inviteClient call. Callers must now surface
// the error loudly rather than write a divergent hash.
import { describe, it, expect, vi } from "vitest";
import { hashString } from "../../src/util/hash.js";

// Canonical SHA-256 hex digests for the two retained TEST passwords.
// Mirrors the structure of the retired tests/fixtures/auth-passwords.js
// export so the existing it.each(...) iteration shape carries forward.
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

describe("hashString", () => {
  it("returns a 64-char lowercase hex string for non-empty input", async () => {
    const h = await hashString("hello");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same input", async () => {
    const a = await hashString("hello");
    const b = await hashString("hello");
    expect(a).toBe(b);
  });

  it.each(Object.entries(knownPasswords))(
    "matches the auth-passwords fixture for %s",
    async (_label, { plain, sha256 }) => {
      const h = await hashString(plain);
      expect(h).toBe(sha256);
    },
  );

  it("coerces non-string inputs to string before hashing (no throw)", async () => {
    // Per app.js String(s) coerces; null/undefined become "null"/"undefined" strings.
    await expect(hashString(null)).resolves.toMatch(/^[0-9a-f]{64}$/);
    await expect(hashString(undefined)).resolves.toMatch(/^[0-9a-f]{64}$/);
    await expect(hashString(42)).resolves.toMatch(/^[0-9a-f]{64}$/);
  });

  it("throws (propagates) when crypto.subtle.digest fails — no silent fallback (WR-01)", async () => {
    // Phase 06.1 WR-01 fix: the prior FNV fallback returned a base-10 string
    // when crypto.subtle.digest threw, silently breaking SHA-256 parity with
    // the server. The fallback was removed; the error must now propagate so
    // setOrgClientPassphrase surfaces "browser does not support secure
    // hashing" instead of writing a divergent hash to
    // orgs/{orgId}.clientPassphraseHash.
    const spy = vi.spyOn(crypto.subtle, "digest").mockImplementation(() => {
      throw new Error("simulated crypto failure");
    });
    try {
      await expect(hashString("hello")).rejects.toThrow("simulated crypto failure");
    } finally {
      spy.mockRestore();
    }
  });

  it("propagates async rejection from crypto.subtle.digest (WR-01)", async () => {
    // Cover the async-rejection variant — crypto.subtle.digest returns a
    // Promise; rejections must surface to the caller, not be swallowed.
    const spy = vi
      .spyOn(crypto.subtle, "digest")
      .mockRejectedValue(new Error("simulated async crypto failure"));
    try {
      await expect(hashString("hello")).rejects.toThrow("simulated async crypto failure");
    } finally {
      spy.mockRestore();
    }
  });
});
