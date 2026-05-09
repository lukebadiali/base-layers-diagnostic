// src/domain/unread.js
// @ts-check
// Phase 5 Wave 4 Commit A (DATA-07 / H7 fix): comparator rewrite reads
// server-time Timestamp via duck-typed toMillis(). Phase 2 TEST-05 H7
// baseline broken by design + replaced. domain/* imports nothing from
// firebase/* or data/* (Phase 4 ESLint Wave 4 boundary).
//
// The legacy domain-side write helper was DELETED (no shim) - DATA-07 /
// D-12 / D-18 require all writes use serverTimestamp(); the legacy ISO-string
// write was the H7 root cause. The WRITE side now lives in
// src/data/read-states.js setPillarRead (server-clock via serverTimestamp).
// The sole callsite at src/main.js:1739 is rewired to setPillarRead in
// this same commit.

/**
 * @typedef {{ toMillis: () => number }} ServerTimeLike
 * @typedef {{ authorId: string, createdAt?: ServerTimeLike }} CommentLike
 * @typedef {{ id: string, role?: string, orgId?: string }} UserLike
 */

/**
 * Count unread comments for a pillar. ZERO client-clock values touch the
 * comparator (H7 closure / DATA-07).
 *
 * @param {ServerTimeLike|null|undefined} lastReadTs
 *   - the user's last-read marker for this pillar
 *     (from orgs/{orgId}/readStates/{userId}.pillarReads[pillarId]); null
 *     means no prior read.
 * @param {Array<CommentLike>} comments - comments for the pillar (already
 *   filtered by pillarId)
 * @param {string} currentUserId - the current user's id (excludes
 *   self-authored)
 * @returns {number}
 */
export function unreadCountForPillar(lastReadTs, comments, currentUserId) {
  const lastMs = lastReadTs ? lastReadTs.toMillis() : 0;
  return (comments || []).filter((c) =>
    c.authorId !== currentUserId &&
    c.createdAt && c.createdAt.toMillis() > lastMs
  ).length;
}

/**
 * Sum unreadCountForPillar across all pillars. Missing pillarReads entry
 * for a pillar is treated as no-prior-read (lastMs=0).
 *
 * @param {Record<string, ServerTimeLike|null>} pillarReads
 * @param {Record<string, Array<CommentLike>>} commentsByPillar
 * @param {string} currentUserId
 * @param {Array<{ id: number|string }>} pillars
 * @returns {number}
 */
export function unreadCountTotal(pillarReads, commentsByPillar, currentUserId, pillars) {
  return pillars.reduce((s, p) => {
    const list = commentsByPillar[String(p.id)] || [];
    const lastReadTs = (pillarReads || {})[String(p.id)] || null;
    return s + unreadCountForPillar(lastReadTs, list, currentUserId);
  }, 0);
}

/**
 * Count unread chat messages. Server-clock-vs-server-clock comparator -
 * H7 closure: the lastReadForOrg accessor returns server-time Timestamp
 * values (from orgs/{orgId}/readStates/{userId}.chatLastRead) so no client
 * clock participates in the comparison.
 *
 * @param {UserLike|null} user
 * @param {Array<{ authorId: string, orgId: string, createdAt?: ServerTimeLike }>} chatMessages
 * @param {(orgId: string) => ServerTimeLike|null} lastReadForOrg
 * @returns {number}
 */
export function unreadChatTotal(user, chatMessages, lastReadForOrg) {
  if (!user) return 0;
  const list = chatMessages || [];
  if (user.role === "client") {
    const orgId = user.orgId || "";
    const lastReadTs = lastReadForOrg(orgId);
    const lastMs = lastReadTs ? lastReadTs.toMillis() : 0;
    return list.filter((m) =>
      m.orgId === orgId && m.authorId !== user.id &&
      m.createdAt && m.createdAt.toMillis() > lastMs
    ).length;
  }
  return list.reduce((n, m) => {
    if (m.authorId === user.id) return n;
    const lastReadTs = lastReadForOrg(m.orgId);
    const lastMs = lastReadTs ? lastReadTs.toMillis() : 0;
    return m.createdAt && m.createdAt.toMillis() > lastMs ? n + 1 : n;
  }, 0);
}

// The legacy domain-side write helper is INTENTIONALLY DELETED. The WRITE
// side lives in src/data/read-states.js setPillarRead. See src/main.js for
// the rewired callsite (Phase 5 Wave 4 Commit A / DATA-07 / D-12 / D-18).
