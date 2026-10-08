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
import {
  DOCUMENT_SORT_KEYS,
  DOCUMENT_SORT_STORAGE_KEY,
  normaliseSortKey,
  sortDocuments,
  sortFolders,
} from "../domain/document-sort.js";
import {
  canCreateFolder,
  canDeleteFolder,
  canMoveFolder,
  childFolders,
  documentsIn,
  flattenTree,
  pathTo,
} from "../domain/folder-tree.js";

/**
 * @typedef {{ ok: true } | { ok: false, reason: string }} Verdict
 */

/**
 * The viewer's chosen file sort. Per browser, not per user and not per org: it
 * is a display preference, not data, so it never goes near Firestore.
 *
 * Wrapped because localStorage throws in a private window and returns nothing
 * in a preview — and a sort preference is never worth failing a render over.
 */
function readStoredSort() {
  try {
    return localStorage.getItem(DOCUMENT_SORT_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** @param {string} key */
function writeStoredSort(key) {
  try {
    localStorage.setItem(DOCUMENT_SORT_STORAGE_KEY, key);
  } catch {
    // Ignored on purpose — see readStoredSort.
  }
}

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
 *   modal?: (children: *) => *,
 *   promptText?: (title: string, placeholder: string, onSubmit: (v: string) => *, initial?: string) => void,
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
  const modal = deps.modal || (() => ({ close: () => {} }));
  const promptText = deps.promptText || (() => {});
  // Which folder is open lives on the app state singleton so that navigating
  // away to another tab and back returns the user where they were.
  const state = deps.state || { docFolderId: null };

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
   * The Documents tab: a folder tree over an org's files.
   *
   * Structure. One Firestore listener per collection (folders, documents),
   * both constrained to `deletedAt == null`. Each writes into a local array
   * and calls paint(), which redraws the breadcrumb and the list from those
   * arrays. Navigation, sorting and folder actions all go through paint()
   * rather than the app-level render(), so moving between folders never tears
   * down and re-subscribes the listeners.
   *
   * Both queries are constrained to `deletedAt == null` so that tombstoned
   * rows are excluded by the query itself rather than by per-document rule
   * evaluation. That also means a document MISSING the field is excluded — an
   * equality filter on null does not match an absent field — which is why
   * uploads write `deletedAt: null` explicitly and why
   * scripts/backfill-document-folder-fields exists for rows written before v6.
   * See tests/rules/folders.test.js.
   *
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

    // The Firebase handle arrives through deps rather than off `window`, so
    // the view can be driven by a test double without a global.
    const { db, storage, firestore, storageOps } = getFB();
    const isInternal = isStaff(user);

    /** @type {Array<*>} */
    let folders = [];
    /** @type {Array<*>} */
    let documents = [];
    let sortKey = normaliseSortKey(readStoredSort());

    const currentFolderId = () => state.docFolderId || null;
    /** @param {string|null} id */
    const goTo = (id) => {
      state.docFolderId = id;
      paint();
    };

    // ---- toolbar ----

    const progressBar = h("div", { class: "docs-progress-meta" });
    const fileInput = /** @type {HTMLInputElement} */ (
      h("input", { type: "file", class: "u-display-none" })
    );

    const upload = async (/** @type {*} */ file) => {
      // CODE-09 / D-15 / D-20: validateUpload BEFORE the Storage write. The
      // client-side check (size cap + MIME allowlist + magic-byte sniff +
      // filename sanitisation) is the UX-feedback layer and the audit-narrative
      // claim; storage.rules and the callable validation are the enforcement.
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
          // v6: the file lands in whatever folder is open. deletedAt is written
          // explicitly — the listener filters on `deletedAt == null`, and a
          // Firestore equality filter on null does NOT match a document that
          // lacks the field, so a row without it would be invisible from birth.
          folderId: currentFolderId(),
          deletedAt: null,
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

    const newFolder = () => {
      const verdict = canCreateFolder(folders, currentFolderId());
      if (!verdict.ok) {
        notify("error", verdict.reason);
        return;
      }
      promptText("New folder", "e.g. Board pack", async (name) => {
        const folderId = uid("fld_");
        try {
          await firestore.setDoc(firestore.doc(db, "orgs", org.id, "folders", folderId), {
            id: folderId,
            orgId: org.id,
            name: name.trim(),
            parentId: currentFolderId(),
            createdBy: user.id,
            createdAt: firestore.serverTimestamp(),
            deletedAt: null,
          });
        } catch (e) {
          notify("error", "Couldn't create the folder: " + errText(e));
        }
      });
    };

    const sortSelect = /** @type {HTMLSelectElement} */ (
      h("select", { class: "docs-sort-select", "aria-label": "Sort files by" })
    );
    DOCUMENT_SORT_KEYS.forEach((k) => {
      const opt = document.createElement("option");
      opt.value = k.key;
      opt.textContent = k.label;
      sortSelect.appendChild(opt);
    });
    // Applied after the options exist — see the round select for why.
    sortSelect.value = sortKey;
    sortSelect.addEventListener("change", () => {
      sortKey = normaliseSortKey(sortSelect.value);
      writeStoredSort(sortKey);
      paint();
    });

    const toolbar = h("div", { class: "card docs-toolbar-card" });
    const crumbs = h("nav", { class: "docs-breadcrumb", "aria-label": "Folder path" });
    toolbar.appendChild(crumbs);
    toolbar.appendChild(
      h(
        "div",
        { class: "docs-toolbar-row" },
        [
          isInternal
            ? h("button", { class: "btn secondary", onclick: newFolder }, "+ New folder")
            : null,
          h("button", { class: "btn", onclick: () => fileInput.click() }, "+ Upload file"),
          fileInput,
          h("div", { class: "docs-toolbar-spacer" }),
          sortSelect,
        ].filter(Boolean),
      ),
    );
    toolbar.appendChild(progressBar);
    frag.appendChild(toolbar);

    const listCard = h("div", { class: "card docs-list-card" });
    const listBody = h("div", {});
    listBody.appendChild(h("p", { class: "docs-list-loading" }, "Loading…"));
    listCard.appendChild(listBody);
    frag.appendChild(listCard);

    // ---- folder actions ----

    /**
     * A picker of move targets. Illegal destinations are rendered but
     * disabled, with the reason in the option text — a target that silently
     * vanished would leave the user hunting for a folder they can see on the
     * screen behind the dialogue.
     *
     * @param {string} title
     * @param {(targetId: string|null) => Verdict} verdictFor
     * @param {(targetId: string|null) => void} onPick
     */
    const openMovePicker = (title, verdictFor, onPick) => {
      const sel = /** @type {HTMLSelectElement} */ (
        h("select", { class: "docs-move-select", "aria-label": "Destination folder" })
      );
      const addOption = (/** @type {string|null} */ id, /** @type {string} */ label) => {
        const verdict = verdictFor(id);
        const opt = document.createElement("option");
        opt.value = id === null ? "" : id;
        opt.textContent = verdict.ok ? label : `${label} — ${verdict.reason}`;
        opt.disabled = !verdict.ok;
        sel.appendChild(opt);
      };
      addOption(null, "Documents (top level)");
      flattenTree(folders).forEach(({ folder, depth }) => {
        addOption(String(folder.id), `${"— ".repeat(depth - 1)}${folder.name}`);
      });

      const m = modal([
        h("h3", {}, title),
        sel,
        h("div", { class: "row" }, [
          h("button", { class: "btn secondary", onclick: () => m.close() }, "Cancel"),
          h(
            "button",
            {
              class: "btn",
              onclick: () => {
                onPick(sel.value === "" ? null : sel.value);
                m.close();
              },
            },
            "Move",
          ),
        ]),
      ]);
    };

    /** @param {*} folder */
    const renameFolder = (folder) => {
      promptText(
        "Rename folder",
        "Folder name",
        async (name) => {
          try {
            await firestore.setDoc(
              firestore.doc(db, "orgs", org.id, "folders", folder.id),
              { name: name.trim(), updatedAt: firestore.serverTimestamp() },
              { merge: true },
            );
          } catch (e) {
            notify("error", "Couldn't rename the folder: " + errText(e));
          }
        },
        folder.name,
      );
    };

    /**
     * The folder-move write. One function so the Move dialogue and a drag-drop
     * land identically — a second copy of this is how the two paths drift.
     * @param {string} folderId
     * @param {string|null} targetId
     */
    const moveFolderTo = async (folderId, targetId) => {
      try {
        await firestore.setDoc(
          firestore.doc(db, "orgs", org.id, "folders", folderId),
          { parentId: targetId, updatedAt: firestore.serverTimestamp() },
          { merge: true },
        );
      } catch (e) {
        notify("error", "Couldn't move the folder: " + errText(e));
      }
    };

    /** @param {*} folder */
    const moveFolder = (folder) => {
      openMovePicker(
        `Move "${folder.name}"`,
        (targetId) => canMoveFolder(folders, String(folder.id), targetId),
        async (targetId) => {
          const verdict = canMoveFolder(folders, String(folder.id), targetId);
          if (!verdict.ok) {
            notify("error", verdict.reason);
            return;
          }
          await moveFolderTo(String(folder.id), targetId);
        },
      );
    };

    /** @param {*} folder */
    const deleteFolder = (folder) => {
      // FILE-04: a file anywhere beneath refuses; an empty subtree cascades.
      // The guard decides which, and hands back the exact set to delete — the
      // view does not recompute it, so what the dialogue promises and what the
      // loop deletes cannot drift apart.
      const verdict = canDeleteFolder(folders, documents, String(folder.id));
      if (!verdict.ok) {
        notify("error", verdict.reason);
        return;
      }
      const ids = verdict.folderIds;
      const nested = ids.length - 1;
      const detail = nested
        ? `This also removes ${nested} empty sub-folder${nested === 1 ? "" : "s"} inside it. These can be restored within 30 days.`
        : "It is empty. This can be restored within 30 days.";
      confirmDialog(
        "Delete folder?",
        `Remove "${folder.name}" from ${org.name}? ${detail}`,
        async () => {
          // One callable per folder, deepest first — softDelete tombstones a
          // single document and there is no batch form. Sequential and
          // stop-on-error: a part-failed cascade then leaves the survivors
          // still parented where they were, rather than orphaned at the root.
          let done = 0;
          try {
            const { softDelete } = await import("../cloud/soft-delete.js");
            for (const id of ids) {
              await softDelete({ type: "folder", orgId: org.id, id });
              done += 1;
            }
          } catch (e) {
            notify(
              "error",
              done
                ? `Deleted ${done} of ${ids.length} folders, then stopped: ${errText(e)}`
                : "Couldn't delete the folder: " + errText(e),
            );
          }
        },
        "Delete",
      );
    };

    /**
     * The file-move write. A move is a folderId change and nothing else — the
     * Storage object is never touched, which is why firestore.rules pins
     * storagePath immutable.
     * @param {*} d
     * @param {string|null} targetId
     */
    const moveDocumentTo = async (d, targetId) => {
      try {
        await firestore.setDoc(
          firestore.doc(db, "orgs", org.id, "documents", d.id),
          { folderId: targetId, updatedAt: firestore.serverTimestamp() },
          { merge: true },
        );
      } catch (e) {
        notify("error", "Couldn't move the file: " + errText(e));
      }
    };

    /** @param {*} d */
    const moveDocument = (d) => {
      openMovePicker(
        `Move "${d.filename}"`,
        () => /** @type {Verdict} */ ({ ok: true }),
        async (targetId) => {
          await moveDocumentTo(d, targetId);
        },
      );
    };

    /** @param {*} d */
    const deleteDocument = (d) => {
      confirmDialog(
        "Delete file?",
        `Remove "${d.filename}" for everyone in ${org.name}? This can be restored within 30 days.`,
        async () => {
          try {
            // PLATFORM-UAT T15: the softDelete callable, not a direct delete —
            // firestore.rules denies hard deletes. The callable tombstones the
            // row; the listener's deletedAt == null filter drops it from the
            // next snapshot, so the list repaints without it. Storage cleanup
            // is the scheduled purge's job.
            const { softDelete } = await import("../cloud/soft-delete.js");
            await softDelete({ type: "document", orgId: org.id, id: d.id });
          } catch (e) {
            notify("error", "Couldn't delete file: " + errText(e));
          }
        },
        "Delete",
      );
    };

    /** @param {*} d */
    const downloadDocument = async (d) => {
      try {
        // Phase 8 Wave 2 (BACKUP-05): fetch a signed URL on demand — no cached
        // downloadURL in Firestore. Valid for 1 hour; the caller MUST NOT cache
        // it (the server enforces the TTL).
        const { getDocumentSignedUrl } = await import("../cloud/signed-url.js");
        const { url } = await getDocumentSignedUrl(org.id, d.id, d.filename);
        // CODE-12: noopener noreferrer on every outbound window.
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (e) {
        notify("error", "Couldn't fetch download link: " + errText(e));
      }
    };

    // ---- drag and drop ----
    //
    // Dragging is a shortcut, never the only way: every move is still reachable
    // through the Move dialogue, which is what keyboard and screen-reader users
    // get. The same canMoveFolder guard runs on drop as in the picker, so a
    // drag cannot create a cycle or bust the depth cap just because the pointer
    // went somewhere the select would have greyed out.
    //
    // dragenter/dragleave fire per descendant element, so a naive
    // highlight-on-enter / clear-on-leave flickers as the pointer crosses a
    // row's children. Counting enters and leaves per row is what keeps it
    // steady.
    /** @type {{ kind: "file"|"folder", id: string }|null} */
    let dragging = null;
    /** @type {WeakMap<HTMLElement, number>} */
    const dragDepth = new WeakMap();

    /** Can the thing currently being dragged land on this folder (or root)? */
    const dropAllowed = (/** @type {string|null} */ targetId) => {
      // Copied to a local so the narrowing survives the closures below.
      const drag = dragging;
      if (!drag) return false;
      if (drag.kind === "file") {
        const d = documents.find((x) => String(x.id) === drag.id);
        // No-op drops are refused so the row does not light up for a move that
        // would change nothing.
        return !!d && (d.folderId || null) !== targetId;
      }
      if (drag.id === String(targetId)) return false;
      const folder = folders.find((f) => String(f.id) === drag.id);
      if (folder && (folder.parentId || null) === targetId) return false;
      return canMoveFolder(folders, drag.id, targetId).ok;
    };

    /** Perform the drop. Mirrors the Move dialogue's write exactly. */
    const performDrop = async (/** @type {string|null} */ targetId) => {
      if (!dragging) return;
      const { kind, id } = dragging;
      dragging = null;
      if (kind === "file") {
        const d = documents.find((x) => String(x.id) === id);
        if (d) await moveDocumentTo(d, targetId);
        return;
      }
      const verdict = canMoveFolder(folders, id, targetId);
      if (!verdict.ok) {
        notify("error", verdict.reason);
        return;
      }
      await moveFolderTo(id, targetId);
    };

    /**
     * Make an element a drop target for the given folder id (null = root).
     * @param {HTMLElement} el
     * @param {string|null} targetId
     */
    const asDropTarget = (el, targetId) => {
      el.addEventListener("dragover", (e) => {
        if (!dropAllowed(targetId)) return;
        // Preventing default is what tells the browser a drop is permitted;
        // without it the drop event never fires.
        e.preventDefault();
        /** @type {*} */ (e).dataTransfer && /** @type {*} */ (e.dataTransfer.dropEffect = "move");
      });
      el.addEventListener("dragenter", (e) => {
        if (!dropAllowed(targetId)) return;
        e.preventDefault();
        dragDepth.set(el, (dragDepth.get(el) || 0) + 1);
        el.classList.add("drop-target");
      });
      el.addEventListener("dragleave", () => {
        const next = (dragDepth.get(el) || 0) - 1;
        dragDepth.set(el, Math.max(0, next));
        if (next <= 0) el.classList.remove("drop-target");
      });
      el.addEventListener("drop", (e) => {
        e.preventDefault();
        dragDepth.set(el, 0);
        el.classList.remove("drop-target");
        void performDrop(targetId);
      });
      return el;
    };

    /**
     * Make an element draggable.
     * @param {HTMLElement} el
     * @param {"file"|"folder"} kind
     * @param {string} id
     */
    const asDraggable = (el, kind, id) => {
      el.draggable = true;
      el.addEventListener("dragstart", (e) => {
        dragging = { kind, id };
        el.classList.add("dragging");
        const dt = /** @type {*} */ (e).dataTransfer;
        if (dt) {
          dt.effectAllowed = "move";
          // Some browsers refuse to start a drag with an empty payload.
          dt.setData("text/plain", `${kind}:${id}`);
        }
      });
      el.addEventListener("dragend", () => {
        dragging = null;
        el.classList.remove("dragging");
        listBody.querySelectorAll(".drop-target").forEach((n) => n.classList.remove("drop-target"));
        crumbs.querySelectorAll(".drop-target").forEach((n) => n.classList.remove("drop-target"));
      });
      return el;
    };

    // ---- painting ----

    const paintCrumbs = () => {
      crumbs.replaceChildren();
      /** @type {Array<{ id: string|null, label: string }>} */
      const trail = [{ id: null, label: "Documents" }];
      const path = pathTo(folders, currentFolderId());
      path.forEach((f) => trail.push({ id: String(f.id), label: f.name }));

      // Up one level. The full trail is already clickable, but a single "Back"
      // is the move people reach for most, and it is one target instead of
      // hunting the right crumb. Doubles as a drop target, so dragging a file
      // onto Back moves it up a level.
      if (path.length) {
        const parentId = path.length > 1 ? String(path[path.length - 2].id) : null;
        const back = h(
          "button",
          {
            class: "docs-crumb-back",
            title: "Up one level",
            "aria-label": "Up one level",
            onclick: () => goTo(parentId),
          },
          "← Back",
        );
        crumbs.appendChild(asDropTarget(back, parentId));
      }

      trail.forEach((step, i) => {
        const last = i === trail.length - 1;
        if (i > 0) crumbs.appendChild(h("span", { class: "docs-crumb-sep" }, "/"));
        if (last) {
          crumbs.appendChild(h("span", { class: "docs-crumb docs-crumb-current" }, step.label));
          return;
        }
        // An ancestor crumb takes a drop too — the natural way to move
        // something several levels up in one gesture.
        const crumb = h(
          "button",
          { class: "docs-crumb docs-crumb-link", onclick: () => goTo(step.id) },
          step.label,
        );
        crumbs.appendChild(asDropTarget(crumb, step.id));
      });
    };

    /** @param {*} folder */
    const folderRow = (folder) => {
      const id = String(folder.id);
      const childCount = childFolders(folders, id).length;
      const fileCount = documentsIn(documents, id, folders).length;
      /** @type {string[]} */
      const bits = [];
      if (fileCount) bits.push(`${fileCount} file${fileCount === 1 ? "" : "s"}`);
      if (childCount) bits.push(`${childCount} folder${childCount === 1 ? "" : "s"}`);

      const row = h("div", { class: "docs-table-row docs-folder-row", "data-folder-id": id });

      // The whole row opens the folder, not just the name. The name stays a
      // real <button> so the keyboard still has a focusable target — the row
      // click is an extra on top, which is why the row itself is not given
      // role="button": it contains buttons, and interactive content inside a
      // button is not reliably exposed. Same reasoning as the Actions rows.
      row.addEventListener("click", () => goTo(id));

      row.appendChild(
        h("div", { class: "docs-folder-name" }, [
          h("span", { class: "docs-folder-icon", "aria-hidden": "true" }, "▸"),
          h("button", { class: "docs-folder-open", onclick: () => goTo(id) }, folder.name),
        ]),
      );
      row.appendChild(h("div", { class: "docs-row-meta" }, bits.join(" · ") || "Empty"));
      row.appendChild(h("div", {}, ""));
      row.appendChild(
        h(
          "div",
          { class: "docs-row-actions" },
          isInternal
            ? [
                h(
                  "button",
                  { class: "btn ghost sm", onclick: () => renameFolder(folder) },
                  "Rename",
                ),
                h("button", { class: "btn ghost sm", onclick: () => moveFolder(folder) }, "Move"),
                h(
                  "button",
                  { class: "btn ghost sm danger", onclick: () => deleteFolder(folder) },
                  "Delete",
                ),
              ]
            : [],
        ),
      );

      // Rename / Move / Delete must not also open the folder.
      row.querySelectorAll("button").forEach((b) => {
        if (b.classList.contains("docs-folder-open")) return;
        b.addEventListener("click", (e) => e.stopPropagation());
      });

      // A folder is both a drop target and draggable (staff only — a client
      // cannot move anything, so handing them a drag that always refuses would
      // be worse than no drag at all).
      asDropTarget(row, id);
      if (isInternal) asDraggable(row, "folder", id);
      return row;
    };

    /** @param {*} d */
    const fileRow = (d) => {
      const row = h("div", { class: "docs-table-row docs-file-row", "data-doc-id": d.id });
      // Staff only, for the same reason as folders: a client cannot move a file,
      // so a drag that can only ever refuse is worse than no drag.
      if (isInternal) asDraggable(row, "file", String(d.id));
      row.appendChild(
        h("div", {}, [
          h("div", { class: "docs-row-filename" }, d.filename),
          h("div", { class: "docs-row-meta" }, formatBytes(d.size)),
        ]),
      );
      row.appendChild(h("div", {}, d.uploaderName || d.uploaderEmail || "—"));
      row.appendChild(h("div", {}, d.createdAt?.toDate?.().toLocaleString?.("en-GB") || ""));
      // A client may delete their own upload; staff may delete any.
      const canDelete = isInternal || d.uploaderId === user.id;
      row.appendChild(
        h(
          "div",
          { class: "docs-row-actions" },
          [
            h(
              "button",
              { class: "btn secondary sm", onclick: () => downloadDocument(d) },
              "Download",
            ),
            isInternal
              ? h("button", { class: "btn ghost sm", onclick: () => moveDocument(d) }, "Move")
              : null,
            canDelete
              ? h(
                  "button",
                  { class: "btn ghost sm danger", onclick: () => deleteDocument(d) },
                  "Delete",
                )
              : null,
          ].filter(Boolean),
        ),
      );
      return row;
    };

    const paint = () => {
      paintCrumbs();
      // CODE-05 (D-20): replaceChildren() instead of innerHTML="".
      listBody.replaceChildren();

      const here = currentFolderId();
      // Folders always sort by name and always sit above files, whatever the
      // file sort is set to. Nobody navigates a tree by when its branches were
      // created, so offering "date added" over folders would be answerable and
      // useless.
      const subFolders = sortFolders(childFolders(folders, here));
      const files = sortDocuments(documentsIn(documents, here, folders), sortKey);

      if (!subFolders.length && !files.length) {
        listBody.appendChild(
          h(
            "p",
            { class: "docs-list-empty" },
            here ? "Nothing in this folder yet." : "No files yet.",
          ),
        );
        return;
      }
      subFolders.forEach((f) => listBody.appendChild(folderRow(f)));
      files.forEach((d) => listBody.appendChild(fileRow(d)));
    };

    /** @param {string} message */
    const paintError = (message) => {
      listBody.replaceChildren();
      listBody.appendChild(h("p", { class: "docs-error-paragraph" }, message));
    };

    // ---- listeners ----

    const live = (/** @type {string} */ name) =>
      firestore.query(
        firestore.collection(db, "orgs", org.id, name),
        firestore.where("deletedAt", "==", null),
      );

    firestore.onSnapshot(
      live("folders"),
      (/** @type {*} */ snap) => {
        /** @type {Array<*>} */
        const rows = [];
        snap.forEach((/** @type {*} */ f) => rows.push({ id: f.id, ...f.data() }));
        folders = rows;
        // A folder can disappear under the user — another consultant deletes
        // it, or a restore moves it. Landing them back at the root beats
        // leaving them staring at an empty view of somewhere that is gone.
        if (currentFolderId() && !rows.some((f) => String(f.id) === currentFolderId())) {
          state.docFolderId = null;
        }
        paint();
      },
      (/** @type {*} */ err) => paintError("Couldn't load folders: " + errText(err)),
    );

    firestore.onSnapshot(
      live("documents"),
      (/** @type {*} */ snap) => {
        /** @type {Array<*>} */
        const rows = [];
        snap.forEach((/** @type {*} */ d) => rows.push({ id: d.id, ...d.data() }));
        documents = rows;
        paint();
      },
      (/** @type {*} */ err) => paintError("Couldn't load documents: " + errText(err)),
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
