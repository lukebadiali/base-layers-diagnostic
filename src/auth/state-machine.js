// src/auth/state-machine.js
// @ts-check
// Phase 2 (D-05): byte-identical extraction from app.js:306-309 (currentUser),
// 443-448 (verifyOrgClientPassphrase), 462-467 (verifyUserPassword).
// Phase 6 Wave 5 (AUTH-14 / D-04): verifyInternalPassword export DELETED
// alongside deletion of INTERNAL_PASSWORD_HASH from src/main.js — replaced
// by Firebase Auth signInEmailPassword via src/firebase/auth.js. The other
// three exports (currentUser, verifyOrgClientPassphrase, verifyUserPassword)
// remain in active use for client/user passphrase login paths in main.js.
import { hashString } from "../util/hash.js";

/**
 * @param {string} orgId
 * @param {string} pass
 * @param {{ loadOrg: (id:string) => any }} deps
 */
export async function verifyOrgClientPassphrase(orgId, pass, deps) {
  const org = deps.loadOrg(orgId);
  if (!org || !org.clientPassphraseHash) return false;
  const h = await hashString(pass);
  return h === org.clientPassphraseHash;
}

/**
 * @param {string} userId
 * @param {string} pass
 * @param {{ findUser: (id:string) => any }} deps
 */
export async function verifyUserPassword(userId, pass, deps) {
  const u = deps.findUser(userId);
  if (!u || !u.passwordHash) return false;
  const h = await hashString(pass);
  return h === u.passwordHash;
}

/**
 * @param {{ currentSession: () => any, findUser: (id:string) => any }} deps
 */
export function currentUser(deps) {
  const s = deps.currentSession();
  return s ? deps.findUser(s.userId) : null;
}
