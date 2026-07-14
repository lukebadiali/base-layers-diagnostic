// src/firebase/totp-uri.js
// @ts-check
// 2026-07 (client-reported MFA bug): Firebase's TotpSecret.generateQrCodeUrl
// emits the issuer/account UNENCODED and omits `period`. Our issuer
// "BeDeveloped Diagnostic" contains a space, so the raw otpauth:// URI is
// malformed — lenient apps (Google Authenticator) tolerate it, stricter ones
// (Microsoft Authenticator) can misread it and produce codes Firebase then
// rejects with auth/invalid-verification-code. This helper builds a
// spec-conformant, fully percent-encoded otpauth URI with every parameter
// pinned to the secret's real values, so no authenticator app has to guess.
// Pure + dependency-free so it unit-tests without Firebase app init.

/**
 * Build a spec-conformant `otpauth://totp/` enrolment URI.
 *
 * @param {{
 *   secretKey: string,
 *   accountName: string,
 *   issuer: string,
 *   algorithm?: string,
 *   digits?: number,
 *   period?: number,
 * }} params
 * @returns {string}
 */
export function buildTotpUri({ secretKey, accountName, issuer, algorithm, digits, period }) {
  const alg = algorithm || "SHA1";
  const dig = digits || 6;
  const per = period || 30;
  // Label is `Issuer:Account`, each component percent-encoded (spaces -> %20).
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
  // Build the query with encodeURIComponent so spaces encode as %20 —
  // URLSearchParams would emit `+`, which some authenticator apps mis-decode.
  const query = [
    `secret=${encodeURIComponent(secretKey)}`,
    `issuer=${encodeURIComponent(issuer)}`,
    `algorithm=${encodeURIComponent(alg)}`,
    `digits=${dig}`,
    `period=${per}`,
  ].join("&");
  return `otpauth://totp/${label}?${query}`;
}
