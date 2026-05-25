// src/auth/passphrase-policy.js
// @ts-check
// Phase 06.1 Wave 1 Task 1 (AUTH-16 / RESEARCH § Critical Pinned Fact 1.1):
// pure-logic length-floor gate for the org client passphrase. Admin SDK
// auth.createUser({password}) bypasses Identity Platform passwordPolicy
// (≥12 chars + HIBP), so without this gate setOrgClientPassphrase would
// accept arbitrarily-weak passphrases and Wave 2's inviteClient.ts would
// succeed at createUser — but the invited client would be bricked at first
// signInWithEmailAndPassword (auth/password-does-not-meet-requirements).
// Enforce the length floor at the modal-submit chokepoint.
//
// Per CLAUDE.md "no Firebase imports in domain/*" and CONVENTIONS.md: this
// module is pure data validation — zero firebase/* or firebase-admin/*
// imports. Safe to consume from tests, views, and (in future) a server-side
// callable parity helper.

export const ORG_PASSPHRASE_MIN_LENGTH = 12;

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
