// src/data/cloud-sync.js
// @ts-check
// Phase 5 Wave 4 Commit B (D-13 / H8 fix): the parent-doc nested-map syncer
// is GONE. Each subcollection wrapper (data/responses, data/comments,
// data/actions, data/documents, data/messages, data/read-states) owns its
// own onSnapshot listener (Wave 3). cloud-sync.js retains a thin "init
// org-metadata listener + dispatcher" role: subscribes to the small parent
// doc + signals downstream wrappers to attach their per-subcollection
// listeners.
//
// Phase 2 TEST-06 (H8 cloud-wins-on-overlap last-writer-wins) baseline
// broken by design + replaced. Cleanup-ledger row "Phase 5 (H8 fix)
// rewrites cloud-sync.js" CLOSES with this commit.
import { db, doc, onSnapshot } from "../firebase/db.js";

/**
 * Subscribe to orgs/{orgId} parent doc. Per-subcollection data flows
 * through subscribeMessages / subscribeReadState / subscribeComments / etc.
 *
 * @param {string} orgId
 * @param {{ onChange: (meta: any|null) => void, onError: (err: Error) => void }} cb
 * @returns {() => void}
 */
export function subscribeOrgMetadata(orgId, { onChange, onError }) {
  return onSnapshot(
    doc(db, "orgs", orgId),
    (/** @type {any} */ snap) => onChange(snap.exists() ? snap.data() : null),
    onError,
  );
}

/**
 * Coordinate boot-time hydration: parent doc subscription + signal downstream
 * wrappers to attach per-subcollection listeners. The `attach` callback
 * receives the orgId once the parent doc resolves; the caller (likely
 * views/dashboard.js or src/main.js post-4.1) wires subscribeMessages +
 * subscribeReadState etc. inside attach.
 *
 * Parameter-detector branch: if invoked with the OLD 9-prop deps shape
 * (legacyDeps.fbReady + ...legacy-localStorage helpers...), this is a Phase 4 4.1
 * carryover - logs a deprecation warning + returns a no-op unsubscribe.
 * Removed when src/main.js IIFE migrates to the new shape (D-13 D-18).
 *
 * @param {string|object} orgIdOrLegacyDeps
 * @param {{ onMetadata: (meta: any|null) => void, attach: (orgId: string) => void, onError: (err: Error) => void } | undefined} [deps]
 * @returns {() => void}
 */
export function syncFromCloud(orgIdOrLegacyDeps, deps) {
  // Parameter-detector branch (legacy 9-prop deps shape from Phase 4 IIFE).
  // DELETED in Phase 4 4.1 main.js-body-migration sub-wave when consumers
  // migrate to (orgId, { onMetadata, attach, onError }).
  if (
    typeof orgIdOrLegacyDeps === "object" &&
    orgIdOrLegacyDeps !== null &&
    "fbReady" in orgIdOrLegacyDeps
  ) {
    // DEPRECATED: legacy 9-prop deps shape; treated as no-op to avoid
    // breaking the IIFE boot path. The parent-doc nested-map syncer that
    // implemented last-writer-wins overlap merging IS the H8 root cause -
    // it is intentionally NOT executed here. Per-subcollection listeners
    // (Wave 3 - subscribeMessages / subscribeReadState / subscribeComments
    // / subscribeResponses / subscribeActions / subscribeDocuments) own
    // their data flow now; cloud-sync no longer participates in conflict
    // resolution.
    console.warn(
      "[cloud-sync] DEPRECATED: legacy 9-prop deps shape - rewire to (orgId, { onMetadata, attach, onError }) per Phase 5 Wave 4 D-13. No-op until Phase 4 4.1 main.js-body-migration removes the IIFE callsite.",
    );
    return () => {};
  }
  if (typeof orgIdOrLegacyDeps !== "string" || !deps) {
    throw new Error(
      "syncFromCloud: expected (orgId, { onMetadata, attach, onError })",
    );
  }
  const orgId = orgIdOrLegacyDeps;
  const { onMetadata, attach, onError } = deps;
  let attached = false;
  return subscribeOrgMetadata(orgId, {
    onChange: (meta) => {
      onMetadata(meta);
      if (!attached && meta) {
        attached = true;
        attach(orgId);
      }
    },
    onError,
  });
}
