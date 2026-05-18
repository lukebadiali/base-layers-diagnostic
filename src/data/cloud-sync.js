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
 * receives the orgId once the parent doc resolves; the caller wires
 * subscribeMessages + subscribeReadState etc. inside attach.
 *
 * Phase 4.1 / D-13 follow-up: the legacy 9-prop deps shape (and its
 * deprecation shim) is GONE. Top-level orgs + users hydration now lives in
 * src/main.js as direct subscribeOrgs + subscribeUsers listeners. This
 * dispatcher is reserved for future per-org-detail wiring.
 *
 * @param {string} orgId
 * @param {{ onMetadata: (meta: any|null) => void, attach: (orgId: string) => void, onError: (err: Error) => void }} deps
 * @returns {() => void}
 */
export function syncFromCloud(orgId, deps) {
  if (typeof orgId !== "string" || !deps) {
    throw new Error(
      "syncFromCloud: expected (orgId, { onMetadata, attach, onError })",
    );
  }
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
