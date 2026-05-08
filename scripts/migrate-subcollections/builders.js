// scripts/migrate-subcollections/builders.js
// @ts-check
//
// Phase 5 Wave 2 (D-01 / D-03 / D-11): pure builder functions that translate the
// monolithic `orgs/{orgId}` parent doc shape (nested-maps + flat-maps) into the
// target subcollection shape (one doc per item under
// `orgs/{orgId}/{collection}/{itemId}` per ARCHITECTURE.md §4).
//
// CRITICAL: this module is intentionally pure — it imports nothing from
// firebase-admin (Pitfall 4 closure). Every export takes a source-doc payload
// and returns an `Array<{ path, data }>`. This is the substrate that makes
// the builders unit-testable without booting firebase-admin or an emulator
// (D-08 Wave 2 + plan must_have: "builders pure; assertion harness").
//
// D-03 invariant: every produced target doc that references a user / author
// carries the legacy app-internal id verbatim as `legacyAppUserId` or
// `legacyAuthorId`. Phase 6 (AUTH-15) backfills these fields with the
// firebaseUid mapping, then deletes them.
//
// Subcollection paths per D-11 / ARCHITECTURE.md §4:
//   responses   -> orgs/{orgId}/responses/{roundId}__{userId}__{pillarId}
//   comments    -> orgs/{orgId}/comments/{c.id}             (preserve source id)
//   actions     -> orgs/{orgId}/actions/{actionId}
//   documents   -> orgs/{orgId}/documents/{docId}
//   messages    -> orgs/{orgId}/messages/{messageId}
//   readStates  -> orgs/{orgId}/readStates/{userId}        (one doc per user)

/**
 * Build response subcollection docs from the nested-map at
 * orgs/{orgId}.responses[roundId][userId][pillarId][idx]. Each (round, user,
 * pillar) tuple becomes one subcollection doc whose `values` is the array
 * collected at that path.
 *
 * @param {string} orgId
 * @param {Record<string, any>} orgData - the parent doc data
 * @returns {Array<{ path: string, data: any }>}
 */
export function buildResponses(orgId, orgData) {
  /** @type {Array<{ path: string, data: any }>} */
  const out = [];
  const responses = orgData?.responses || {};
  for (const [roundId, perRound] of Object.entries(responses)) {
    if (!perRound || typeof perRound !== "object") continue;
    for (const [userId, perUser] of Object.entries(perRound)) {
      if (!perUser || typeof perUser !== "object") continue;
      for (const [pillarId, valuesArr] of Object.entries(perUser)) {
        if (!Array.isArray(valuesArr)) continue;
        const respId = `${roundId}__${userId}__${pillarId}`;
        out.push({
          path: `orgs/${orgId}/responses/${respId}`,
          data: {
            roundId,
            userId,
            legacyAppUserId: userId, // D-03 inline legacy field
            pillarId,
            values: valuesArr,
            updatedAt: orgData.updatedAt || null,
          },
        });
      }
    }
  }
  return out;
}

/**
 * Build comment subcollection docs from nested-map orgs/{orgId}.comments[pillarId][i].
 * Each source comment becomes orgs/{orgId}/comments/{commentId}; commentId comes
 * from the source comment's `id` field (preserved per D-12 contract — comments
 * are a flat array under each pillar key in the legacy shape).
 *
 * @param {string} orgId
 * @param {Record<string, any>} orgData
 * @returns {Array<{ path: string, data: any }>}
 */
export function buildComments(orgId, orgData) {
  /** @type {Array<{ path: string, data: any }>} */
  const out = [];
  const comments = orgData?.comments || {};
  for (const [pillarId, list] of Object.entries(comments)) {
    if (!Array.isArray(list)) continue;
    for (const c of list) {
      if (!c || typeof c !== "object" || !c.id) continue;
      out.push({
        path: `orgs/${orgId}/comments/${c.id}`,
        data: {
          pillarId,
          authorId: c.authorId,
          legacyAuthorId: c.authorId, // D-03
          body: c.body,
          internalOnly: c.internalOnly || false,
          createdAt: c.createdAt || null,
        },
      });
    }
  }
  return out;
}

/**
 * Build action subcollection docs from flat-map orgs/{orgId}.actions[actionId].
 * The migration preserves the source actionId as the subcollection doc id.
 *
 * @param {string} orgId
 * @param {Record<string, any>} orgData
 * @returns {Array<{ path: string, data: any }>}
 */
export function buildActions(orgId, orgData) {
  /** @type {Array<{ path: string, data: any }>} */
  const out = [];
  const actions = orgData?.actions || {};
  for (const [actionId, a] of Object.entries(actions)) {
    if (!a || typeof a !== "object") continue;
    out.push({
      path: `orgs/${orgId}/actions/${actionId}`,
      data: {
        orgId,
        title: a.title,
        description: a.description,
        status: a.status || "open",
        ownerId: a.ownerId,
        legacyAppUserId: a.ownerId, // D-03 - the owner is a user
        dueAt: a.dueAt || null,
        createdAt: a.createdAt || null,
        updatedAt: a.updatedAt || null,
      },
    });
  }
  return out;
}

/**
 * Build document subcollection docs from flat-map orgs/{orgId}.documents[docId].
 * Storage path stays at `orgs/{orgId}/documents/{docId}/{filename}`; only the
 * Firestore METADATA doc moves into the subcollection. The data shape mirrors
 * what `src/data/documents.js` writes today (id, name, path, downloadURL,
 * uploadedBy, createdAt) plus the D-03 inline legacy field.
 *
 * @param {string} orgId
 * @param {Record<string, any>} orgData
 * @returns {Array<{ path: string, data: any }>}
 */
export function buildDocuments(orgId, orgData) {
  /** @type {Array<{ path: string, data: any }>} */
  const out = [];
  const documents = orgData?.documents || {};
  for (const [docId, d] of Object.entries(documents)) {
    if (!d || typeof d !== "object") continue;
    out.push({
      path: `orgs/${orgId}/documents/${docId}`,
      data: {
        orgId,
        name: d.name,
        path: d.path,
        downloadURL: d.downloadURL,
        uploadedBy: d.uploadedBy,
        legacyAppUserId: d.uploadedBy || null, // D-03
        createdAt: d.createdAt || null,
      },
    });
  }
  return out;
}

/**
 * Build message subcollection docs from flat-map orgs/{orgId}.messages[messageId].
 *
 * @param {string} orgId
 * @param {Record<string, any>} orgData
 * @returns {Array<{ path: string, data: any }>}
 */
export function buildMessages(orgId, orgData) {
  /** @type {Array<{ path: string, data: any }>} */
  const out = [];
  const messages = orgData?.messages || {};
  for (const [messageId, m] of Object.entries(messages)) {
    if (!m || typeof m !== "object") continue;
    out.push({
      path: `orgs/${orgId}/messages/${messageId}`,
      data: {
        authorId: m.authorId,
        legacyAuthorId: m.authorId, // D-03
        body: m.body,
        createdAt: m.createdAt || null,
      },
    });
  }
  return out;
}

/**
 * Initialise readStates subcollection. From the nested-map
 * orgs/{orgId}.readStates[userId][pillarId] = ISO string we create one
 * orgs/{orgId}/readStates/{userId} doc per user with `pillarReads` seeded
 * from the legacy ISO strings + `chatLastRead: null` (Wave 4 H7 fix replaces
 * these with serverTimestamp on the next write).
 *
 * Phase 5 keeps the legacy ISO values temporarily so unread counts don't
 * reset to 0 on cutover; H7 (Wave 4) means new writes use serverTimestamp()
 * and the comparator switches over. The migrated value still mixes
 * client-clock + server-clock until the next write — ROADMAP SC#4 acceptance
 * is on comparator behaviour, not on legacy data.
 *
 * @param {string} orgId
 * @param {Record<string, any>} orgData
 * @returns {Array<{ path: string, data: any }>}
 */
export function buildReadStatesInit(orgId, orgData) {
  /** @type {Array<{ path: string, data: any }>} */
  const out = [];
  const readStates = orgData?.readStates || {};
  for (const [userId, perUser] of Object.entries(readStates)) {
    if (!perUser || typeof perUser !== "object") continue;
    /** @type {Record<string, any>} */
    const pillarReads = {};
    for (const [pillarId, isoStr] of Object.entries(perUser)) {
      pillarReads[pillarId] = isoStr; // legacy ISO; H7 fix overwrites on next setPillarRead via serverTimestamp()
    }
    out.push({
      path: `orgs/${orgId}/readStates/${userId}`,
      data: {
        pillarReads,
        chatLastRead: null,
        legacyAppUserId: userId, // D-03 - userId == legacy app-internal user id
      },
    });
  }
  return out;
}
