// src/domain/unread.js
// @ts-check
// Phase 2 (D-05): byte-identical extraction from app.js:340-414.
// Pitfall 20 / H7 entanglement: comparators mix client clock and server clock.
// Phase 5 (DATA-07) fixes; tests pin the BROKEN behaviour as regression baseline.
import { iso } from "../util/ids.js";

/**
 * @param {*} org
 * @param {number} pillarId
 * @param {{ id:string, role?:string }} user
 * @param {(org: *, pillarId: number, user: *) => Array<{authorId:string,createdAt:string}>} commentsFor
 */
export function unreadCountForPillar(org, pillarId, user, commentsFor) {
  const list = commentsFor(org, pillarId, user);
  const last = ((org.readStates || {})[user.id] || {})[pillarId];
  const lastT = last ? new Date(last).getTime() : 0;
  return list.filter((c) => new Date(c.createdAt).getTime() > lastT && c.authorId !== user.id)
    .length;
}

/**
 * @param {*} org
 * @param {*} user
 * @param {{ pillars: Array<{ id:number }> }} DATA
 * @param {(org: *, pillarId: number, user: *) => Array<{authorId:string,createdAt:string}>} commentsFor
 */
export function unreadCountTotal(org, user, DATA, commentsFor) {
  return DATA.pillars.reduce((s, p) => s + unreadCountForPillar(org, p.id, user, commentsFor), 0);
}

/**
 * @param {*} org
 * @param {number} pillarId
 * @param {{ id:string }} user
 * @param {(o: *) => void} saveOrg
 */
export function markPillarRead(org, pillarId, user, saveOrg) {
  org.readStates = org.readStates || {};
  org.readStates[user.id] = org.readStates[user.id] || {};
  org.readStates[user.id][pillarId] = iso();
  saveOrg(org);
}

/**
 * @param {*} user
 * @param {{ chatMessages: Array<{ orgId:string, authorId:string, createdAt:* }> }} state
 * @param {(userId:string, orgId:string) => number} lastReadMillis
 * @param {(msg: *) => number} msgMillis
 * @param {(user: *, orgId: string) => number} unreadChatForOrg
 */
export function unreadChatTotal(user, state, lastReadMillis, msgMillis, unreadChatForOrg) {
  if (!user) return 0;
  if (user.role === "client") return unreadChatForOrg(user, user.orgId);
  // internal: count across every org they're seeing
  return (state.chatMessages || []).reduce((n, m) => {
    if (m.authorId === user.id) return n;
    const lastT = lastReadMillis(user.id, m.orgId);
    return msgMillis(m) > lastT ? n + 1 : n;
  }, 0);
}
