// src/data/soft-deleted.js
// @ts-check
// Phase 8 Wave 2 (LIFE-06 functional): admin-only read wrapper over
// softDeleted/{type}/items/*. The existing firestore.rules block
//   match /softDeleted/{type}/items/{id} {
//     allow read:  if isAdmin();
//     allow write: if false;       // server-only (Phase 8)
//   }
// gates these reads — non-admin callers get permission-denied (the
// admin view shows the error inline via the catch branch).

import { db, collection, getDocs } from "../firebase/db.js";

const SOFT_DELETABLE_TYPES = /** @type {const} */ ([
  "org",
  "comment",
  "document",
  "message",
  "funnelComment",
]);

/**
 * List all soft-deleted items across all 5 SOFT_DELETABLE_TYPES.
 * Admin-only — non-admin callers receive a permission-denied FirebaseError
 * that the admin view surfaces inline.
 *
 * @returns {Promise<Array<{ type: string, orgId: string|null, id: string, snapshot: any, deletedAt: any }>>}
 */
export async function listSoftDeleted() {
  const out = [];
  for (const type of SOFT_DELETABLE_TYPES) {
    const snap = await getDocs(collection(db, "softDeleted", type, "items"));
    snap.forEach((/** @type {any} */ docSnap) => {
      const data = docSnap.data() || {};
      out.push({
        type,
        orgId: typeof data.originalOrgId === "string" ? data.originalOrgId : null,
        id: docSnap.id,
        snapshot: data,
        deletedAt: data.deletedAt ?? null,
      });
    });
  }
  return out;
}

export { SOFT_DELETABLE_TYPES };
