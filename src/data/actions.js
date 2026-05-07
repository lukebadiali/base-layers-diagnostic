// src/data/actions.js
// @ts-check
// Phase 4 Wave 3 (D-09 / D-12): pass-through to data/orgs.js's flat-map shape
// (org.actions[actionId]). Phase 5 (DATA-01..06) replaces this body with
// subcollection access; the API surface stays stable.
//
// Cleanup-ledger row: "Phase 5 (DATA-01) replaces body with subcollection
// access (orgs/{orgId}/actions/{actId}); data/actions.js API stable" —
// closes at Phase 5.
import { getOrg, saveOrg } from "./orgs.js";

/**
 * @param {string} orgId
 * @returns {Promise<Array<any>>}
 */
export async function listActions(orgId) {
  const org = await getOrg(orgId);
  return Object.values(org?.actions || {});
}

/**
 * @param {string} orgId
 * @param {*} action
 * @returns {Promise<void>}
 */
export async function saveAction(orgId, action) {
  const org = await getOrg(orgId);
  if (!org) return;
  org.actions = org.actions || {};
  org.actions[action.id] = action;
  await saveOrg(org);
}

/**
 * @param {string} orgId
 * @param {string} actionId
 * @returns {Promise<void>}
 */
export async function deleteAction(orgId, actionId) {
  const org = await getOrg(orgId);
  if (!org) return;
  if (org.actions) delete org.actions[actionId];
  await saveOrg(org);
}
