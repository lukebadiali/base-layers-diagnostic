// src/data/responses.js
// @ts-check
// Phase 4 Wave 3 (D-09 / D-12): pass-through to data/orgs.js's nested-map
// shape (org.responses[roundId][userId][pillarId][idx]). Phase 5 (DATA-01..06)
// replaces this body with subcollection access; the API surface stays stable.
//
// Cleanup-ledger row: "Phase 5 (DATA-01) replaces body with subcollection
// access (orgs/{orgId}/responses/{respId}); data/responses.js API stable" —
// closes at Phase 5.
import { getOrg, saveOrg } from "./orgs.js";

/**
 * @param {string} orgId
 * @param {string} roundId
 * @param {string} userId
 * @param {number|string} pillarId
 * @returns {Promise<Array<any>>}
 */
export async function listResponses(orgId, roundId, userId, pillarId) {
  const org = await getOrg(orgId);
  return ((org?.responses?.[roundId]?.[userId]?.[pillarId]) || []).slice();
}

/**
 * @param {string} orgId
 * @param {string} roundId
 * @param {string} userId
 * @param {number|string} pillarId
 * @param {number} idx
 * @param {*} value
 * @returns {Promise<void>}
 */
export async function saveResponse(orgId, roundId, userId, pillarId, idx, value) {
  const org = await getOrg(orgId);
  if (!org) return;
  org.responses = org.responses || {};
  org.responses[roundId] = org.responses[roundId] || {};
  org.responses[roundId][userId] = org.responses[roundId][userId] || {};
  org.responses[roundId][userId][pillarId] = org.responses[roundId][userId][pillarId] || [];
  org.responses[roundId][userId][pillarId][idx] = value;
  await saveOrg(org);
}

/**
 * @param {string} orgId
 * @param {string} roundId
 * @param {string} userId
 * @param {number|string} pillarId
 * @returns {Promise<void>}
 */
export async function deleteResponse(orgId, roundId, userId, pillarId) {
  const org = await getOrg(orgId);
  if (!org) return;
  if (org.responses?.[roundId]?.[userId]) delete org.responses[roundId][userId][pillarId];
  await saveOrg(org);
}
