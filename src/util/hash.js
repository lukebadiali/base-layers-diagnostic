// src/util/hash.js
// @ts-check
// Phase 2 (D-05): byte-identical extraction from app.js:483-495.
// Phase 06.1 (AUTH-16): LOAD-BEARING — client side of the cross-language
// SHA-256 hex parity contract with functions/src/util/hash.ts. Used by
// setOrgClientPassphrase to compute orgs/{orgId}.clientPassphraseHash;
// verified server-side by the inviteClient callable. See
// tests/util/hash.test.js + functions/test/util/hash-parity.test.ts.

/**
 * SHA-256 hex of the input, encoded as UTF-8 lowercase hex.
 *
 * Phase 06.1 WR-01 fix: the prior try/catch FNV fallback was removed.
 * It produced a 32-bit base-10 string when `crypto.subtle.digest` threw,
 * which would silently drift the client-side
 * `orgs/{orgId}.clientPassphraseHash` away from the server-side SHA-256 hex
 * — every subsequent inviteClient call would fail with
 * `auth/passphrase-invalid` even with the correct input. We now let the
 * error propagate so callers (setOrgClientPassphrase modal) surface a loud
 * failure instead of writing a divergent hash.
 *
 * Parity invariant verified by:
 *   - tests/util/hash.test.js (client-side SHA-256 vectors)
 *   - functions/test/util/hash-parity.test.ts (server-side SHA-256 vectors)
 *   - functions/test/auth/inviteClient.integration.test.ts Test 0 (drift gate)
 *
 * @param {string|number|null|undefined} s
 * @returns {Promise<string>} 64-char lowercase hex
 * @throws {Error} when crypto.subtle.digest is unavailable or fails — the
 *   modal MUST handle this and surface a "browser does not support secure
 *   hashing" error rather than silently writing a divergent hash.
 */
export async function hashString(s) {
  const enc = new TextEncoder().encode(String(s));
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
