// Phase 8 Wave 4 (GDPR-02 / GDPR-03 / GDPR-04 / Pitfall 11):
// pure cascade builder — maps query results into a list of Firestore
// batched-write operations that pseudonymise all references to a user.
// Pattern C purity: no firebase-admin import. Test seam = the ops list.
//
// Per-collection patch map (Pitfall 11 + Wave 4 contract):
//   users/{uid}              → email/name/displayName/photoURL/avatar = null;
//                              erasedAt = sentinel; erasedTo = token
//   orgs/*/messages/{id}     → authorId, legacyAuthorId = token
//   orgs/*/comments/{id}     → authorId, legacyAuthorId = token
//   orgs/*/actions/{id}      → ownerId, legacyAppUserId = token
//   orgs/*/documents/{id}    → uploaderId, uploadedBy, legacyAppUserId = token
//   documents/{id} (legacy)  → same 3 fields + uploaderName=null + uploaderEmail=null
//   funnelComments/{id}      → authorId = token
//   auditLog/{id}            → actor.uid = token; actor.email = null;
//                              payload.email = null (Pitfall 11 PII tombstone;
//                              audit doc PRESERVED for legit-interest)
//
// The "content" of authored items (message body, comment body, document file)
// is intentionally NOT redacted — that data belongs to the org/user-collective
// and remains under the legitimate-interest carve-out post-pseudonymisation.

import { DOCUMENT_AUTHOR_FIELDS } from "./assembleUserBundle.js";

export { DOCUMENT_AUTHOR_FIELDS };

export const FIRESTORE_BATCH_LIMIT = 500 as const;

export interface CascadeOp {
  type: "update";
  path: string;
  patch: Record<string, unknown>;
}

export interface InputDoc {
  path: string;
  data: Record<string, unknown>;
}

/** Symbol the caller substitutes with FieldValue.serverTimestamp() at write time. */
export const ERASED_AT_SENTINEL = "__ERASED_AT__" as const;

/**
 * Build the cascade ops list from query results pre-fetched by gdprEraseUser.
 *
 * @param userId - The uid being erased (used for auditLog actor.uid check)
 * @param token  - The deterministic tombstone token (from tombstoneTokenForUser)
 * @param inputs - Pre-fetched query results
 * @returns      - Flat list of Firestore batched-write operations
 */
export function buildCascadeOps(
  userId: string,
  token: string,
  inputs: {
    userDoc: InputDoc | null;
    messages: InputDoc[];
    comments: InputDoc[];
    actions: InputDoc[];
    documentsSubcoll: InputDoc[];
    documentsLegacy: InputDoc[];
    funnelComments: InputDoc[];
    auditEvents: InputDoc[];
  },
): CascadeOp[] {
  const ops: CascadeOp[] = [];

  // users/{uid} — tombstone PII fields; preserve uid (doc ID immutable)
  if (inputs.userDoc) {
    ops.push({
      type: "update",
      path: inputs.userDoc.path,
      patch: {
        email: null,
        name: null,
        displayName: null,
        photoURL: null,
        avatar: null,
        erasedAt: ERASED_AT_SENTINEL,
        erasedTo: token,
      },
    });
  }

  // orgs/*/messages/{id} — authorId + legacyAuthorId
  for (const m of inputs.messages) {
    ops.push({
      type: "update",
      path: m.path,
      patch: { authorId: token, legacyAuthorId: token },
    });
  }

  // orgs/*/comments/{id} — authorId + legacyAuthorId
  for (const c of inputs.comments) {
    ops.push({
      type: "update",
      path: c.path,
      patch: { authorId: token, legacyAuthorId: token },
    });
  }

  // orgs/*/actions/{id} — ownerId + legacyAppUserId
  for (const a of inputs.actions) {
    ops.push({
      type: "update",
      path: a.path,
      patch: { ownerId: token, legacyAppUserId: token },
    });
  }

  // orgs/*/documents/{id} (subcollection) — all 3 DOCUMENT_AUTHOR_FIELDS
  for (const d of inputs.documentsSubcoll) {
    const patch: Record<string, unknown> = {};
    for (const f of DOCUMENT_AUTHOR_FIELDS) patch[f] = token;
    ops.push({ type: "update", path: d.path, patch });
  }

  // documents/{id} (legacy top-level) — same 3 fields + uploaderName + uploaderEmail nulled
  for (const d of inputs.documentsLegacy) {
    const patch: Record<string, unknown> = {};
    for (const f of DOCUMENT_AUTHOR_FIELDS) patch[f] = token;
    patch.uploaderName = null;
    patch.uploaderEmail = null;
    ops.push({ type: "update", path: d.path, patch });
  }

  // funnelComments/{id} — authorId only
  for (const fc of inputs.funnelComments) {
    ops.push({
      type: "update",
      path: fc.path,
      patch: { authorId: token },
    });
  }

  // auditLog/{id} — Pitfall 11: keep the doc; tombstone actor.uid + PII fields
  // Only process events where actor.uid matches the erased user (defensive guard).
  for (const ev of inputs.auditEvents) {
    const actor = ev.data.actor as Record<string, unknown> | undefined;
    if (!actor || actor.uid !== userId) continue;
    ops.push({
      type: "update",
      path: ev.path,
      patch: {
        "actor.uid": token,
        "actor.email": null,
        "payload.email": null,
      },
    });
  }

  return ops;
}

/**
 * Split a flat ops list into batches of at most FIRESTORE_BATCH_LIMIT
 * operations per batch (Firestore Admin SDK batched-write cap).
 */
export function chunkOpsForBatchedWrite(ops: CascadeOp[]): CascadeOp[][] {
  const out: CascadeOp[][] = [];
  for (let i = 0; i < ops.length; i += FIRESTORE_BATCH_LIMIT) {
    out.push(ops.slice(i, i + FIRESTORE_BATCH_LIMIT));
  }
  return out;
}
