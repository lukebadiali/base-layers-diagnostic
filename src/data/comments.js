// src/data/comments.js
// @ts-check
// Phase 4 Wave 3 (D-09 / D-12): pass-through to data/orgs.js's nested-map
// shape (org.comments[pillarId][...]). Phase 5 (DATA-01..06) replaces this
// body with subcollection access (orgs/{orgId}/comments/{commentId}); the
// API surface stays stable — views/* never re-extract their consumption
// pattern.
//
// Cleanup-ledger row: "Phase 5 (DATA-01) replaces body with subcollection
// access (orgs/{orgId}/comments/{cmtId}); data/comments.js API stable" —
// closes at Phase 5.
import { getOrg, saveOrg } from "./orgs.js";

/**
 * @param {string} orgId
 * @param {number|string} pillarId
 * @returns {Promise<Array<any>>}
 */
export async function listComments(orgId, pillarId) {
  const org = await getOrg(orgId);
  return ((org?.comments || {})[pillarId] || []).slice();
}

/**
 * @param {string} orgId
 * @param {number|string} pillarId
 * @param {*} comment
 * @returns {Promise<void>}
 */
export async function addComment(orgId, pillarId, comment) {
  const org = await getOrg(orgId);
  if (!org) return;
  org.comments = org.comments || {};
  org.comments[pillarId] = org.comments[pillarId] || [];
  org.comments[pillarId].push(comment);
  await saveOrg(org);
}

/**
 * @param {string} orgId
 * @param {number|string} pillarId
 * @param {string} commentId
 * @returns {Promise<void>}
 */
export async function deleteComment(orgId, pillarId, commentId) {
  const org = await getOrg(orgId);
  if (!org) return;
  const arr = (org.comments?.[pillarId] || []);
  const next = arr.filter((/** @type {any} */ c) => c.id !== commentId);
  if (next.length === arr.length) return;
  org.comments[pillarId] = next;
  await saveOrg(org);
}
