// Temp-password generator for the inviteInternal callable. The created member
// signs in once with this password, then is forced (firstRun) to set their own.
//
// 18 random bytes -> 24 URL-safe base64 chars (~144 bits entropy). Always well
// above any Identity Platform passwordPolicy minimum and never present in HIBP
// breach corpora, so it cannot brick the member at first
// signInWithEmailAndPassword. URL-safe charset is safe to relay verbatim
// (email, chat) without escaping. Admin SDK createUser bypasses passwordPolicy
// at creation; the strength here is what matters at the member's first sign-in.

import { randomBytes } from "node:crypto";

/**
 * Returns a fresh, strong, URL-safe temporary password.
 */
export function generateTempPassword(): string {
  return randomBytes(18).toString("base64url");
}
