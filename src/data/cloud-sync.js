// src/data/cloud-sync.js
// @ts-check
// Phase 2 (D-05): byte-identical extraction from app.js:3451-3488 (post-Wave-3 line shift;
// planner-cited as app.js:3556-3593).
// Pitfall 20 / H8 entanglement: cloud wins on overlap (last-writer-wins).
// Phase 5+ subcollection migration rewrites this; TEST-06 pins current behaviour.

/**
 * @param {{
 *   fbReady:            () => boolean,
 *   cloudFetchAllOrgs:  () => Promise<Array<any>|null>,
 *   cloudFetchAllUsers: () => Promise<Array<any>|null>,
 *   cloudPushOrg:       (org: any) => void,
 *   cloudPushUser:      (user: any) => void,
 *   jget:               (k:string, fallback:any) => any,
 *   jset:               (k:string, v:any) => void,
 *   K:                  { orgs:string, users:string, org:(id:string)=>string },
 *   render:             () => void,
 * }} deps
 */
export async function syncFromCloud(deps) {
  const { fbReady, cloudFetchAllOrgs, cloudFetchAllUsers, cloudPushOrg, cloudPushUser, jget, jset, K, render } = deps;
  if (!fbReady()) return;
  const [cloudOrgs, cloudUsers] = await Promise.all([cloudFetchAllOrgs(), cloudFetchAllUsers()]);
  if (cloudOrgs === null || cloudUsers === null) return;

  // ---- Orgs ----
  const localMetas = jget(K.orgs, []);
  const cloudOrgIds = new Set(cloudOrgs.map((o) => o.id));
  localMetas.forEach((/** @type {any} */ meta) => {
    if (!cloudOrgIds.has(meta.id)) {
      const local = jget(K.org(meta.id), null);
      if (local) cloudPushOrg(local);
    }
  });
  cloudOrgs.forEach((o) => {
    if (o && o.id) jset(K.org(o.id), o);
  });
  const newMetas = cloudOrgs.filter((o) => o && o.id).map((o) => ({ id: o.id, name: o.name }));
  localMetas.forEach((/** @type {any} */ m) => {
    if (!cloudOrgIds.has(m.id)) newMetas.push(m);
  });
  jset(K.orgs, newMetas);

  // ---- Users ----
  const localUsers = jget(K.users, []);
  const cloudUserIds = new Set(cloudUsers.map((u) => u.id));
  localUsers.forEach((/** @type {any} */ u) => {
    if (!cloudUserIds.has(u.id)) cloudPushUser(u);
  });
  const merged = [...cloudUsers];
  localUsers.forEach((/** @type {any} */ u) => {
    if (!cloudUserIds.has(u.id)) merged.push(u);
  });
  jset(K.users, merged);

  // Re-render so the UI reflects synced data
  if (typeof render === "function") render();
}
