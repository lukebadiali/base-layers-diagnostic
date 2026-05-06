// src/auth/state-machine.js
// @ts-check
// Phase 2 (D-05): byte-identical extraction from app.js:306-309 (currentUser),
// 430-433 (verifyInternalPassword), 443-448 (verifyOrgClientPassphrase),
// 462-467 (verifyUserPassword) — post-Wave-3 line shift; planner-cited as
// app.js:363-366 + 510-547.
// Phase 6 (AUTH-14) deletes this whole module when real Firebase Auth lands.
import { hashString } from "../util/hash.js";

/**
 * @param {string} pass
 * @param {{ INTERNAL_PASSWORD_HASH: string }} deps
 */
export async function verifyInternalPassword(pass, deps) {
  const h = await hashString(pass);
  return h === deps.INTERNAL_PASSWORD_HASH;
}

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
