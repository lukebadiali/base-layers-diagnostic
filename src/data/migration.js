// src/data/migration.js
// @ts-check
// Phase 2 (D-05): byte-identical extraction from app.js:470-542 + 5354-5368.
// Phase 4 Wave 6 (CODE-13): the v1→v2 migration body was REMOVED. Pre-deletion
// verification: (a) the early-return guard `if (users.length > 0) return;`
// is the v2-active marker — when present, the v1 path is unreachable; (b)
// production data has never been v1 (the v1 fixture only lives in
// tests/fixtures/v1-localStorage.json — used to pin the regression-baseline
// behaviour through Phase 2). PROJECT.md "no backwards-compat window" + the
// "currently between active engagements" note in CLAUDE.md confirm there is
// no live v1 data at risk of accidental loss. The function signature is
// preserved (callers in src/main.js still invoke it at boot) but the body
// is now early-return + no-op so the dead v1-localStorage migration code
// path is gone. Closes CONCERNS L2.
//
// `clearOldScaleResponsesIfNeeded` (a separate one-shot scale-response wipe
// gated by `settings.scaleV2Cleared`) is NOT dead and is preserved unchanged.

/**
 * Phase 4 Wave 6 (CODE-13): no-op stub. The v1-localStorage → v2 migration
 * body has been removed (CONCERNS L2 closure); the early-return guard
 * survives so callers see a stable contract. Future migrations land their
 * own functions here.
 *
 * @param {{
 *   loadUsers:          () => Array<object>,
 *   loadOrgMetas?:      () => Array<{id:string,name:string}>,
 *   loadOrg?:           (id:string) => any,
 *   saveOrg?:           (org:object) => void,
 *   upsertUser?:        (user:object) => void,
 *   findUser?:          (id:string) => any,
 *   removeV1ActiveKey?: () => void,
 * }} deps
 */
export function migrateV1IfNeeded(deps) {
  const { loadUsers } = deps;
  // Pre-Phase-4-Wave-6 v2-active guard preserved — when users exist, no
  // migration is needed (v1 path was already dead in production). With the
  // body now removed (CODE-13), this branch is the only path; the function
  // is effectively a no-op for all current callers.
  if (loadUsers().length > 0) return;
  // CODE-13 (Phase 4 Wave 6): dead v1-migration body REMOVED. See file header.
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
