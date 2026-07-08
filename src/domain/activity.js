// src/domain/activity.js
// @ts-check
// Scope item 7 (2026-07): pure aggregation behind the staff notification
// bell. Counts per-org chat messages / document uploads strictly newer than
// the caller's per-org surface-visit markers, excluding the user's own
// items. No Firebase imports (domain purity is lint-enforced): createdAt is
// duck-typed via toMillis(); legacy items may carry an ISO-string createdAt
// instead (mirrors main.js's msgMillis) and are compared the same way; a
// null/absent createdAt is a pending serverTimestamp write and counts as
// newest. Items with no author field are skipped rather than counted: they
// can't be attributed, so they also can't be safely excluded as "own" —
// an unset authorField would otherwise equal an unset selfUid.

/**
 * @param {*} item
 * @returns {number}
 */
function itemMillis(item) {
  const t = item && item.createdAt;
  if (t && typeof t.toMillis === "function") return t.toMillis();
  if (typeof t === "string") return new Date(t).getTime() || 0;
  return Number.MAX_SAFE_INTEGER;
}

/**
 * @param {Array<*>} items
 * @param {string} authorField
 * @param {number} markerMs
 * @param {string} selfUid
 * @returns {{ count: number, latestMs: number }}
 */
function countNewer(items, authorField, markerMs, selfUid) {
  let count = 0;
  let latestMs = 0;
  for (const item of items || []) {
    if (!item || item[authorField] == null || item[authorField] === selfUid) continue;
    const ms = itemMillis(item);
    if (ms > markerMs) {
      count += 1;
      if (ms > latestMs) latestMs = ms;
    }
  }
  return { count, latestMs };
}

/**
 * @param {Array<{id: string, name: string}>} orgMetas
 * @param {{ messages: Record<string, Array<*>>, documents: Record<string, Array<*>> }} activity
 * @param {{ chatLastRead: Record<string, number>, docsLastSeen: Record<string, number> }} markers
 * @param {string} selfUid
 * @returns {{ total: number, orgs: Array<{orgId: string, orgName: string, chatCount: number, docCount: number, latestMs: number}> }}
 */
export function activitySummary(orgMetas, activity, markers, selfUid) {
  const orgs = [];
  let total = 0;
  for (const meta of orgMetas || []) {
    const chat = countNewer(
      (activity.messages || {})[meta.id],
      "authorId",
      (markers.chatLastRead || {})[meta.id] || 0,
      selfUid,
    );
    const docs = countNewer(
      (activity.documents || {})[meta.id],
      "uploaderId",
      (markers.docsLastSeen || {})[meta.id] || 0,
      selfUid,
    );
    if (chat.count === 0 && docs.count === 0) continue;
    total += chat.count + docs.count;
    orgs.push({
      orgId: meta.id,
      orgName: meta.name,
      chatCount: chat.count,
      docCount: docs.count,
      latestMs: Math.max(chat.latestMs, docs.latestMs),
    });
  }
  orgs.sort((a, b) => b.latestMs - a.latestMs);
  return { total, orgs };
}
