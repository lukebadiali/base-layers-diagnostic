// Phase 8 Wave 4 (GDPR-02 / Pitfall C / Pattern C purity): deterministic
// pseudonym token. sha256(uid + secret) → 16-char hex slice prefixed
// `deleted-user-`. Idempotent: same uid + secret always yields same token,
// so a crashed-and-restarted erasure writes the same token to every
// collection (no orphaned mixed-token references).
//
// The 16-char (8-byte) hex slice gives ~2^64 search space — sufficient to
// collision-resist within any single project's user population (≤ 2^32).
// Prefix `deleted-user-` makes tombstones grep-able.
//
// Pure helper — imports node:crypto only. NEVER imports firebase-admin.

import { createHash } from "node:crypto";

export const TOMBSTONE_PREFIX = "deleted-user-" as const;
export const TOMBSTONE_HEX_LENGTH = 16 as const;

/** Total token length: 13 (prefix) + 16 (hex) = 29 chars. */
export const TOMBSTONE_TOKEN_LENGTH = TOMBSTONE_PREFIX.length + TOMBSTONE_HEX_LENGTH;

/**
 * Compute the deterministic tombstone token for a user.
 * sha256(uid + secret) → first 16 hex chars, prefixed with "deleted-user-".
 *
 * @throws Error if uid or secret is empty (accidental deploy without GDPR_PSEUDONYM_SECRET set)
 */
export function tombstoneTokenForUser(uid: string, secret: string): string {
  if (!uid) throw new Error("tombstoneTokenForUser: uid required");
  if (!secret) throw new Error("tombstoneTokenForUser: secret required (GDPR_PSEUDONYM_SECRET)");
  const hex = createHash("sha256")
    .update(uid + secret)
    .digest("hex")
    .slice(0, TOMBSTONE_HEX_LENGTH);
  return TOMBSTONE_PREFIX + hex;
}

/**
 * Guard: is `value` shaped like a tombstone token?
 * Used by post-erasure audit script to verify redacted fields.
 * Expected: starts with "deleted-user-" and is exactly 29 chars.
 */
export function isTombstoneToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length === TOMBSTONE_TOKEN_LENGTH &&
    value.startsWith(TOMBSTONE_PREFIX)
  );
}
