// src/views/documents.js
// @ts-check
// Milestone v6 Phase A (completes the Phase 4 D-02 re-homing): the Documents
// tab moves out of the src/main.js IIFE and into this module, body intact.
//
// WHY NOW. Phase 4 left renderDocuments in main.js "for snapshot-baseline
// stability" with Wave 5 to re-home it; that wave never ran. The v6 scope
// (a nested folder tree, breadcrumbs, move pickers, three sort keys) turns a
// flat list into a file browser. Building that inside a 6,000-line IIFE would
// leave the tree traversal reachable only by booting the app against an
// emulator, so the debt is paid here, before the features land.
//
// This commit is a PURE MOVE. The body below is byte-identical to the one it
// replaced apart from the deps indirection and the two dynamic import paths
// (./cloud/* -> ../cloud/*, which is the same module from one directory down).
//
// CODE-09 + D-15 trust boundary, carried over intact: client-side
// validateUpload runs BEFORE the Storage write. The data tier trusts the
// contract and does NOT re-validate. Server-side enforcement (storage.rules +
// the callable validation) is the actual security boundary; the client-side
// check is the UX-feedback layer and the audit-narrative claim.
//
// CODE-12: download anchors carry rel="noopener noreferrer".
import { h as defaultH } from "../ui/dom.js";

/**
 * @typedef {{
 *   state?: *,
 *   h?: (tag: string, attrs?: *, children?: *) => HTMLElement,
 *   isStaff?: (user: *) => boolean,
 *   fbReady?: () => boolean,
 *   getFB?: () => *,
 *   markDocsSeenFor?: (userId: string, orgId: string) => void,
 *   validateUpload?: (file: *) => Promise<{ ok: true, sanitisedName: string } | { ok: false, reason: string }>,
 *   saveDocument?: (orgId: string, file: *, sanitisedName: string, meta?: *) => Promise<*>,
 *   uid?: (prefix?: string) => string,
 *   confirmDialog?: (title: string, body: string, onYes: () => void, yesLabel?: string) => *,
 *   notify?: (level: string, msg: string) => void,
 * }} DocumentsDeps
 */

/**
 * The message to show a user for a thrown value.
 *
 * The IIFE original wrote `e.message || e` inline at three catch sites and
 * relied on string concatenation to stringify whatever came back. Under
 * @ts-check a caught value is `unknown`, so the cast has to happen somewhere;
 * doing it once here keeps the three call sites reading as they did, and
 * survives Prettier moving an inline cast comment off the expression it was
 * meant to narrow.
 *
 * @param {unknown} e
 * @returns {string}
 */
function errText(e) {
  const err = /** @type {*} */ (e);
  return String((err && err.message) || err);
}

/**
 * Bind the Documents view to its dependencies.
 *
 * Every dep is optional so the Phase 4 smoke tests (which construct the view
 * with `{ state, h }` alone) keep passing. fbReady defaults to false, which
 * short-circuits the body at its existing "Connecting to shared storage…"
 * branch rather than reaching for a window.FB that is not there.
 *
 * @param {DocumentsDeps} deps
 */
export function createDocumentsView(deps) {
  const h = deps.h || defaultH;
  const isStaff = deps.isStaff || (() => false);
  const fbReady = deps.fbReady || (() => false);
  const getFB = deps.getFB || (() => ({}));
  const markDocsSeenFor = deps.markDocsSeenFor || (() => {});
  const validateUpload =
    deps.validateUpload ||
    (async () => ({ ok: /** @type {const} */ (false), reason: "Uploads are unavailable." }));
  const uid = deps.uid || ((prefix = "") => `${prefix}${Date.now()}`);
  const confirmDialog = deps.confirmDialog || (() => {});
  const notify = deps.notify || (() => {});

  /**
   * @param {number|null|undefined} b
   * @returns {string}
   */
  function formatBytes(b) {
    if (b == null) return "";
    if (b < 1024) return b + " B";
    if (b < 1024 * 1024) return (b / 1024).toFixed(1) + " KB";
    if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + " MB";
    return (b / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  }

  /**
   * @param {*} user
   * @param {*} org
   * @returns {HTMLElement}
   */
  function renderDocuments(user, org) {
    const frag = h("div");
    frag.appendChild(h("h1", { class: "view-title" }, "Documents"));
    frag.appendChild(
      h(
        "p",
        { class: "view-sub" },
        org
          ? `Shared with ${org.name}. Everyone in this organisation can see these documents.`
          : "Select an organisation to see its documents.",
      ),
    );

    if (!org) return frag;

    // Mark everything up to now as seen for this user/org combination.
    markDocsSeenFor(user.id, org.id);

    if (!fbReady()) {
      frag.appendChild(
        h("div", { class: "card docs-empty-card" }, "Connecting to shared storage…"),
      );
      return frag;
    }

    // The one behavioural difference from the IIFE original: the Firebase
    // handle arrives through deps rather than off `window`, so the view can be
    // driven by a test double without a global. main.js passes () => window.FB.
    const { db, storage, firestore, storageOps } = getFB();

    // Upload card
    const uploadCard = h("div", { class: "card" });
    const fileInput = h("input", { type: "file", class: "u-display-none" });
    const progressBar = h("div", { class: "docs-progress-meta" });

    const upload = async (/** @type {*} */ file) => {
      // CODE-09 / D-15 / D-20: validateUpload BEFORE saveDocument trust
      // boundary. Client-side validation (size cap + MIME allowlist + magic-
      // byte sniff + filename sanitisation) for UX feedback + audit-narrative
      // claim. Server-side enforcement is Phase 5 storage.rules + Phase 7
      // callable validation.
      const validation = await validateUpload(file);
      if (!validation.ok) {
        notify("error", validation.reason);
        progressBar.textContent = "";
        return;
      }
      progressBar.textContent = "Uploading " + file.name + "…";
      try {
        const docId = uid("doc_");
        const path = `orgs/${org.id}/documents/${docId}/${validation.sanitisedName}`;
        const r = storageOps.ref(storage, path);
        const task = storageOps.uploadBytesResumable(r, file, { contentType: file.type });
        task.on("state_changed", (/** @type {*} */ snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          progressBar.textContent = `Uploading ${file.name}… ${pct}%`;
        });
        await task;
        // Phase 8 Wave 2 (BACKUP-05 sweep): getDownloadURL removed — clients
        // fetch signed URLs on demand via getDocumentSignedUrl callable.
        await firestore.setDoc(firestore.doc(db, "orgs", org.id, "documents", docId), {
          orgId: org.id,
          uploaderId: user.id,
          uploaderName: user.name || user.email,
          uploaderEmail: user.email,
          filename: validation.sanitisedName,
          size: file.size,
          contentType: file.type,
          storagePath: path,
          createdAt: firestore.serverTimestamp(),
        });
        progressBar.textContent = `✓ Uploaded ${file.name}`;
      } catch (e) {
        progressBar.textContent = "Upload failed: " + errText(e);
      }
    };

    fileInput.addEventListener("change", (e) => {
      const input = /** @type {HTMLInputElement} */ (e.target);
      const f = input.files && input.files[0];
      if (f) upload(f);
      input.value = "";
    });

    uploadCard.appendChild(
      h("div", { class: "docs-toolbar-row" }, [
        h("button", { class: "btn", onclick: () => fileInput.click() }, "+ Upload file"),
        fileInput,
      ]),
    );
    uploadCard.appendChild(progressBar);
    frag.appendChild(uploadCard);

    // List
    const listCard = h("div", { class: "card docs-list-card" });
    listCard.appendChild(h("h3", { class: "docs-list-h3" }, "Files"));
    const listBody = h("div", {});
    listBody.appendChild(h("p", { class: "docs-list-loading" }, "Loading…"));
    listCard.appendChild(listBody);
    frag.appendChild(listCard);

    const q = firestore.collection(db, "orgs", org.id, "documents");
    firestore.onSnapshot(
      q,
      (/** @type {*} */ snap) => {
        /** @type {Array<*>} */
        const docs = [];
        snap.forEach((/** @type {*} */ d) => docs.push({ id: d.id, ...d.data() }));
        docs.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

        const isInternal = isStaff(user);

        // CODE-05 (D-20): replaceChildren() instead of innerHTML="".
        listBody.replaceChildren();
        if (!docs.length) {
          listBody.appendChild(h("p", { class: "docs-list-empty" }, "No files yet."));
          return;
        }
        docs.forEach((d) => {
          const row = h("div", { class: "docs-table-row" });
          row.appendChild(
            h("div", {}, [
              h("div", { class: "docs-row-filename" }, d.filename),
              h("div", { class: "docs-row-meta" }, formatBytes(d.size)),
            ]),
          );
          row.appendChild(h("div", {}, d.uploaderName || d.uploaderEmail || "—"));
          row.appendChild(h("div", {}, d.createdAt?.toDate?.().toLocaleString?.("en-GB") || ""));
          const canDelete = isInternal || d.uploaderId === user.id;
          const actions = h(
            "div",
            { class: "docs-row-actions" },
            [
              h(
                "button",
                {
                  class: "btn secondary sm",
                  // Phase 8 Wave 2 (BACKUP-05 sweep): fetch signed URL on
                  // demand via getDocumentSignedUrl callable — no cached
                  // downloadURL in Firestore. URL is valid for 1 hour; caller
                  // MUST NOT cache it (server enforces TTL).
                  onclick: async () => {
                    try {
                      const { getDocumentSignedUrl } = await import("../cloud/signed-url.js");
                      const { url } = await getDocumentSignedUrl(org.id, d.id, d.filename);
                      window.open(url, "_blank", "noopener,noreferrer");
                    } catch (e) {
                      notify("error", "Couldn't fetch download link: " + errText(e));
                    }
                  },
                },
                "Download",
              ),
              canDelete
                ? h(
                    "button",
                    {
                      class: "btn ghost sm danger",
                      // PLATFORM-UAT T15 fix (2026-05-25): swap direct
                      // firestore.deleteDoc + storageOps.deleteObject for
                      // the softDelete Cloud Function callable. Direct
                      // deletes were blocked by firestore.rules:104
                      // (allow delete: if false — soft-delete-via-CF only).
                      // The callable marks the Firestore doc deleted=true;
                      // firestore.rules:101 notDeleted predicate hides it
                      // from the live snapshot so the list re-renders
                      // without the row automatically. Storage object
                      // cleanup is handled by the scheduled purge via
                      // permanentlyDeleteSoftDeleted — no client-side
                      // storage call needed (it would also be blocked by
                      // storage.rules anyway).
                      onclick: () =>
                        confirmDialog(
                          "Delete file?",
                          `Remove "${d.filename}" for everyone in ${org.name}? This can be restored within 30 days.`,
                          async () => {
                            try {
                              const { softDelete } = await import("../cloud/soft-delete.js");
                              await softDelete({
                                type: "document",
                                orgId: org.id,
                                id: d.id,
                              });
                            } catch (e) {
                              notify("error", "Couldn't delete file: " + errText(e));
                            }
                          },
                          "Delete",
                        ),
                    },
                    "Delete",
                  )
                : null,
            ].filter(Boolean),
          );
          row.appendChild(actions);
          listBody.appendChild(row);
        });
      },
      (/** @type {*} */ err) => {
        // CODE-05 (D-20): replaceChildren() instead of innerHTML="".
        listBody.replaceChildren();
        listBody.appendChild(
          h("p", { class: "docs-error-paragraph" }, "Couldn't load documents: " + err.message),
        );
      },
    );

    return frag;
  }

  return { renderDocuments, formatBytes };
}

/**
 * Standalone entry point kept for the Phase 4 Wave 4 contract test. Renders
 * with defaults only — the app always goes through createDocumentsView.
 *
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
