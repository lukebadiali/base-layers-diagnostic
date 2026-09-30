// Phase 8 Wave 2 (LIFE-01 / Pattern C purity): pure helper that maps a
// {type, orgId, id} input to its Firestore document path. Used by
// softDelete + restoreSoftDeleted + scheduledPurge + permanentlyDeleteSoftDeleted
// so the path-map is single-source-of-truth.

// Milestone v6 (DOC-06): folders join the soft-delete window. Adding a member
// here fails the build at every exhaustive switch over the union until each is
// updated, which is the point — a lifecycle path that silently skipped folders
// would leave tombstoned folders un-purgeable and un-restorable.
export type SoftDeletableType =
  | "action"
  | "comment"
  | "document"
  | "message"
  | "funnelComment"
  | "folder";
export const SOFT_DELETABLE_TYPES: readonly SoftDeletableType[] = [
  "action", "comment", "document", "message", "funnelComment", "folder",
] as const;

/**
 * Maps a {type, orgId, id} input to the Firestore document path of the live
 * record. RangeError on unknown type (exhaustive switch per ARCHITECTURE.md §4).
 */
export function resolveDocPath(input: { type: SoftDeletableType; orgId: string; id: string }): string {
  switch (input.type) {
    case "action":       return `orgs/${input.orgId}/actions/${input.id}`;
    case "comment":      return `orgs/${input.orgId}/comments/${input.id}`;
    case "document":     return `orgs/${input.orgId}/documents/${input.id}`;
    case "message":      return `orgs/${input.orgId}/messages/${input.id}`;
    case "funnelComment": return `funnelComments/${input.id}`;
    case "folder":       return `orgs/${input.orgId}/folders/${input.id}`;
    default: {
      const _exhaustive: never = input.type;
      throw new RangeError(`Unknown type: ${_exhaustive}`);
    }
  }
}

/**
 * Maps a {type, id} input to the Firestore document path in the softDeleted
 * snapshot store: softDeleted/{type}/items/{id}.
 */
export function resolveSnapshotPath(input: { type: SoftDeletableType; id: string }): string {
  return `softDeleted/${input.type}/items/${input.id}`;
}
