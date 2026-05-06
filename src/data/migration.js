// src/data/migration.js
// @ts-check
// Phase 2 (D-05): byte-identical extraction from app.js:470-542 + 5354-5368.
// One-shot v1→v2 migration. Idempotency-via-flag (the loadUsers().length > 0 check
// is the v2-active marker; for clearOldScaleResponses, settings.scaleV2Cleared).
import { uid, iso } from "../util/ids.js";

/**
 * @param {{
 *   loadUsers:    () => Array<object>,
 *   loadOrgMetas: () => Array<{id:string,name:string}>,
 *   loadOrg:      (id:string) => any,
 *   saveOrg:      (org:object) => void,
 *   upsertUser:   (user:object) => void,
 *   findUser:     (id:string) => any,
 *   removeV1ActiveKey: () => void,
 * }} deps
 */
export function migrateV1IfNeeded(deps) {
  const { loadUsers, loadOrgMetas, loadOrg, saveOrg, upsertUser, findUser, removeV1ActiveKey } = deps;
  const users = loadUsers();
  const orgs = loadOrgMetas();
  if (users.length > 0) return; // already v2

  // If v1 data exists, migrate it
  const v1Orgs = orgs.slice();
  if (v1Orgs.length === 0) return;

  // Create a legacy respondent user so historical responses have an owner
  const legacyId = uid("u_");
  const legacy = {
    id: legacyId,
    email: "legacy@bedeveloped.local",
    name: "Legacy respondent",
    role: "client",
    orgId: null, // set later if single-org
    createdAt: iso(),
  };
  upsertUser(legacy);

  v1Orgs.forEach((meta) => {
    const raw = loadOrg(meta.id);
    if (!raw) return;

    // Already migrated?
    if (raw.rounds && raw.currentRoundId) return;

    const roundId = uid("r_");
    /** @type {any} */
    const migrated = {
      id: raw.id,
      name: raw.name,
      createdAt: raw.createdAt || iso(),
      currentRoundId: roundId,
      rounds: [{ id: roundId, label: "Round 1 (migrated)", createdAt: raw.createdAt || iso() }],
      responses: { [roundId]: {} },
      internalNotes: {},
      actions: (raw.actions || []).map((/** @type {any} */ a) => ({ ...a, createdBy: legacyId })),
      engagement: raw.engagement || { currentStageId: "diagnosed", stageChecks: {} },
      comments: {},
      readStates: {},
    };

    // migrate old responses (single respondent)
    const oldResp = raw.responses || {};
    const byUser = migrated.responses[roundId];
    byUser[legacyId] = {};
    Object.entries(oldResp).forEach(([pillarId, qs]) => {
      byUser[legacyId][pillarId] = {};
      Object.entries(/** @type {any} */ (qs) || {}).forEach(([idx, r]) => {
        byUser[legacyId][pillarId][idx] = {
          score: /** @type {any} */ (r).score,
          note: /** @type {any} */ (r).note || "",
        };
        if (/** @type {any} */ (r).internalNote) {
          migrated.internalNotes[pillarId] = migrated.internalNotes[pillarId] || {};
          migrated.internalNotes[pillarId][idx] = /** @type {any} */ (r).internalNote;
        }
      });
    });

    saveOrg(migrated);
  });

  // If there was exactly one org, point legacy user at it
  if (v1Orgs.length === 1) {
    const leg = findUser(legacyId);
    leg.orgId = v1Orgs[0].id;
    upsertUser(leg);
  }

  removeV1ActiveKey();
}

/**
 * @param {{
 *   loadSettings: () => any,
 *   saveSettings: (s: object) => void,
 *   loadOrgMetas: () => Array<{id:string}>,
 *   loadOrg:      (id:string) => any,
 *   saveOrg:      (org:object) => void,
 * }} deps
 */
export function clearOldScaleResponsesIfNeeded(deps) {
  const { loadSettings, saveSettings, loadOrgMetas, loadOrg, saveOrg } = deps;
  const s = loadSettings();
  if (s.scaleV2Cleared) return;
  loadOrgMetas().forEach((m) => {
    const org = loadOrg(m.id);
    if (!org) return;
    org.responses = {};
    // Keep the current round id present but empty
    if (org.currentRoundId) org.responses[org.currentRoundId] = {};
    org.internalNotes = {};
    saveOrg(org);
  });
  s.scaleV2Cleared = true;
  saveSettings(s);
}
