// Phase 8 Wave 3 (GDPR-01 / Pattern C purity): pure assembler that maps
// pre-fetched Firestore query results into the canonical GDPR export
// bundle shape. NO firebase-admin imports — safe for unit tests + reusable
// by the post-erasure audit script (08-05) for residual-PII verification.
//
// Field names confirmed by Task 0 (08-04-FIELD-AUDIT-NOTES.md):
//   - uploaderId       — top-level documents/{docId} (legacy main.js path)
//   - legacyAppUserId  — subcollection orgs/{orgId}/documents/{docId} (D-03)
//   - uploadedBy       — defensive inclusion (may appear in meta spread or historic docs)

export const BUNDLE_SCHEMA_VERSION = 1 as const;

/**
 * Field names used to attribute documents to a user across both collection
 * paths. Source of truth: 08-04-FIELD-AUDIT-NOTES.md Task 0 grep findings.
 *
 * - uploaderId      → top-level `documents/{docId}` (legacy main.js)
 * - legacyAppUserId → subcollection `orgs/{orgId}/documents/{docId}` (D-03 invariant)
 * - uploadedBy      → defensive: may appear in meta spread or pre-D-03 historic docs
 */
export const DOCUMENT_AUTHOR_FIELDS = [
  "uploaderId",
  "uploadedBy",
  "legacyAppUserId",
] as const;

export interface QueryResults {
  profile: Record<string, unknown> | null;
  auditEvents: Array<Record<string, unknown>>;
  responses: Array<{ path: string; data: Record<string, unknown> }>;
  comments: Array<{ path: string; data: Record<string, unknown> }>;
  messages: Array<{ path: string; data: Record<string, unknown> }>;
  actions: Array<{ path: string; data: Record<string, unknown> }>;
  documents: Array<{ path: string; data: Record<string, unknown> }>;
  funnelComments: Array<{ path: string; data: Record<string, unknown> }>;
}

export interface UserBundle {
  bundleSchemaVersion: typeof BUNDLE_SCHEMA_VERSION;
  userId: string;
  /** ISO 8601 string — no Firestore Timestamp objects survive into the bundle. */
  assembledAt: string;
  profile: Record<string, unknown> | null;
  auditEvents: Array<Record<string, unknown>>;
  responses: Array<{ path: string; data: Record<string, unknown> }>;
  comments: Array<{ path: string; data: Record<string, unknown> }>;
  messages: Array<{ path: string; data: Record<string, unknown> }>;
  actions: Array<{ path: string; data: Record<string, unknown> }>;
  documents: Array<{ path: string; data: Record<string, unknown> }>;
  funnelComments: Array<{ path: string; data: Record<string, unknown> }>;
}

/**
 * Assemble the canonical GDPR export bundle from pre-fetched query results.
 * Inputs are pre-fetched so this helper stays pure (testable without the
 * Admin SDK — Pattern C purity).
 *
 * Two defensive behaviours:
 *
 * 1. Documents are de-duplicated by path because the caller issues one query
 *    per DOCUMENT_AUTHOR_FIELDS entry (3 queries) and the same document may
 *    match more than one field (e.g. a doc has both uploaderId and
 *    legacyAppUserId set). De-dup ensures one entry per physical document.
 *
 * 2. Audit events are re-filtered by actor.uid === userId even though the
 *    caller already pre-queries by actor.uid. This is a defensive double-check
 *    in case the caller mis-queried or if collectionGroup semantics differ from
 *    the direct collection query (T-08-04-06).
 *
 * @param userId   The UID of the data subject whose bundle is being assembled.
 * @param results  Pre-fetched query results from the Admin SDK.
 * @param nowMs    Wall-clock milliseconds at assembly time (caller supplies so
 *                 this function stays pure — no Date.now() inside).
 */
export function assembleUserBundle(
  userId: string,
  results: QueryResults,
  nowMs: number,
): UserBundle {
  // De-dupe documents by path (multi-field query overlap — same doc may appear
  // once per DOCUMENT_AUTHOR_FIELDS query that matched it).
  const docsByPath = new Map<string, { path: string; data: Record<string, unknown> }>();
  for (const d of results.documents) {
    if (!docsByPath.has(d.path)) {
      docsByPath.set(d.path, d);
    }
  }

  // Defensive re-filter: only include audit events where actor.uid === userId.
  // The caller pre-queries by actor.uid but this double-check guards against
  // mis-query or collectionGroup semantic surprises (T-08-04-06).
  const auditEvents = results.auditEvents.filter((e) => {
    const actor = (e as Record<string, unknown>).actor as
      | Record<string, unknown>
      | null
      | undefined;
    return actor !== null && actor !== undefined && actor.uid === userId;
  });

  return {
    bundleSchemaVersion: BUNDLE_SCHEMA_VERSION,
    userId,
    assembledAt: new Date(nowMs).toISOString(),
    profile: results.profile,
    auditEvents,
    responses: results.responses,
    comments: results.comments,
    messages: results.messages,
    actions: results.actions,
    documents: [...docsByPath.values()],
    funnelComments: results.funnelComments,
  };
}
