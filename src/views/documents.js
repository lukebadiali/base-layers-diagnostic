// src/views/documents.js
// @ts-check
// Phase 4 Wave 4 (D-12 / D-15 / D-20): Pattern D DI factory for
// renderDocuments + standalone uploadWithValidation helper closing CODE-09
// (validateUpload BEFORE saveDocument trust boundary).
//
// IIFE analog: app.js:3154-3350 (renderDocuments). Body remains in app.js
// for snapshot-baseline stability; Wave 5 (D-02) re-homes here.
//
// CODE-09 + D-15 trust boundary: client-side validateUpload runs BEFORE the
// data-tier saveDocument call. The data tier (src/data/documents.js) trusts
// the contract — does NOT re-validate. Server-side enforcement (Phase 5
// storage.rules + Phase 7 callable validation) is the actual security
// boundary; client-side check is the UX-feedback layer + audit-narrative
// claim.
//
// CODE-12: download anchors carry rel="noopener noreferrer" — applied
// directly to the IIFE-resident renderDocuments at app.js:3303.
import { h as defaultH } from "../ui/dom.js";

/**
 * @typedef {{
 *   state?: *,
 *   h?: (tag: string, attrs?: *, children?: *) => HTMLElement,
 *   validateUpload?: (file: *) => Promise<{ ok: true, sanitisedName: string } | { ok: false, reason: string }>,
 *   saveDocument?: (orgId: string, file: *, sanitisedName: string, meta?: *) => Promise<*>,
 *   notify?: (level: string, msg: string) => void,
 * }} DocumentsDeps
 */

/**
 * @param {DocumentsDeps} deps
 * @returns {{ renderDocuments: (user: *, org: *) => HTMLElement }}
 */
export function createDocumentsView(deps) {
  const h = deps.h || defaultH;
  return {
    renderDocuments(_user, _org) {
      return h("div", { class: "documents-placeholder" });
    },
  };
}

/**
 * @param {*} user
 * @param {*} org
 * @returns {HTMLElement}
 */
export function renderDocuments(user, org) {
  return createDocumentsView({}).renderDocuments(user, org);
}

/**
 * CODE-09 / D-15 trust-boundary helper: runs validateUpload BEFORE
 * saveDocument. On validation failure, notifies the user and aborts (no
 * Storage write attempted). Used by views/documents.js + the IIFE-resident
 * renderDocuments upload site at app.js:3188-3220.
 *
 * @param {{
 *   file: *,
 *   orgId: string,
 *   meta?: *,
 *   validateUpload: (file: *) => Promise<{ ok: true, sanitisedName: string } | { ok: false, reason: string }>,
 *   saveDocument: (orgId: string, file: *, sanitisedName: string, meta?: *) => Promise<*>,
 *   notify: (level: string, msg: string) => void,
 * }} args
 * @returns {Promise<{ saved: true } | { saved: false, reason: string }>}
 */
export async function uploadWithValidation(args) {
  const { file, orgId, meta, validateUpload, saveDocument, notify } = args;
  const result = await validateUpload(file);
  if (!result.ok) {
    notify("error", result.reason);
    return { saved: false, reason: result.reason };
  }
  try {
    await saveDocument(orgId, file, result.sanitisedName, meta);
    return { saved: true };
  } catch (e) {
    const msg = (e && /** @type {*} */ (e).message) || String(e);
    notify("error", "Upload failed: " + msg);
    return { saved: false, reason: msg };
  }
}
