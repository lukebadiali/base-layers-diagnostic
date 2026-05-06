// src/util/hash.js
// @ts-check
// Phase 2 (D-05): byte-identical extraction from app.js:483-495.
// Phase 6 (AUTH-14) deletes this whole module — replaced by Firebase Auth.

/**
 * Trivial hashing for demo purposes (NOT secure — just to avoid plaintext storage).
 * Phase 6 (AUTH-14) replaces with real Firebase Auth — this whole helper goes.
 * @param {string|number|null|undefined} s
 * @returns {Promise<string>}
 */
export async function hashString(s) {
  try {
    const enc = new TextEncoder().encode(String(s));
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    // fallback
    let h = 0;
    for (const ch of String(s)) h = ((h << 5) - h + ch.charCodeAt(0)) | 0;
    return String(h);
  }
}
