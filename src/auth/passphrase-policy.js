// src/auth/passphrase-policy.js
// @ts-check
// Pure-logic length-floor gate for the org client passphrase. The passphrase
// doubles as the client's first Firebase Auth password (inviteClient.ts
// createUser({password: orgPassphrase})), and Admin SDK createUser bypasses the
// Identity Platform passwordPolicy — so without this gate setOrgClientPassphrase
// would accept a passphrase that the client is then BRICKED on at first
// signInWithEmailAndPassword (auth/password-does-not-meet-requirements, the
// policy IS enforced at sign-in). Enforce the floor at the modal-submit
// chokepoint.
//
// This floor MUST stay >= the live Identity Platform passwordPolicy minLength.
// 2026-06: lowered 12 -> 6 per product decision. SAFE ONLY alongside the
// matching operator change that lowers passwordPolicy minLength to 6 + relaxes
// the leaked-password (HIBP) check in the Firebase console — otherwise 6-char
// passphrases silently brick clients at sign-in. See docs/PRE-MERGE-UAT.md.
//
// Per CLAUDE.md "no Firebase imports in domain/*" and CONVENTIONS.md: this
// module is pure data validation — zero firebase/* or firebase-admin/*
// imports. Safe to consume from tests, views, and (in future) a server-side
// callable parity helper.

export const ORG_PASSPHRASE_MIN_LENGTH = 6;

/**
 * Returns true iff `pass` is a string of length >= ORG_PASSPHRASE_MIN_LENGTH.
 * Returns false for any non-string input (undefined, null, number, object).
 *
 * @param {unknown} pass
 * @returns {boolean}
 */
export function validateOrgPassphrase(pass) {
  return typeof pass === "string" && pass.length >= ORG_PASSPHRASE_MIN_LENGTH;
}
