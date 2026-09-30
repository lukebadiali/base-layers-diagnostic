// src/domain/folder-tree.js
// @ts-check
// Milestone v6 (FILE-01..FILE-04): the nested folder tree for an org's
// documents. Kept pure — no DOM, no Firebase — because this module holds the
// two guards that Firestore rules structurally cannot express.
//
// WHAT RULES CANNOT DO, AND WHY IT MATTERS.
// A security rule sees one document and the request that touches it. It
// cannot walk a parentId chain to find out whether the folder being moved is
// an ancestor of its new parent, and it cannot count how deep the resulting
// tree would be. Both guards therefore live here and at the write site, which
// makes them correctness-and-UX guards, NOT a security boundary. A determined
// internal user with the SDK open can still write a cycle. That residual risk
// is recorded in THREAT_MODEL.md rather than left for a reader to assume the
// rules are covering it.
//
// The consequence of an unguarded cycle is not a crash but an orphaning: a
// folder that is its own ancestor is reachable from no root, so it and
// everything under it vanish from the UI while still counting against the
// org's storage. Every traversal below is therefore written to terminate on
// cyclic input rather than to trust that it cannot happen.

/** A folder at the top level has `parentId === null`. */
export const ROOT = null;

/**
 * Maximum nesting depth, counting a top-level folder as 1.
 *
 * Five is a judgement, not a technical limit: past it, a breadcrumb stops
 * fitting on a laptop and people lose files rather than organise them. It is
 * enforced on create and on move, so a tree can never be built past it by
 * legitimate means.
 */
export const MAX_FOLDER_DEPTH = 5;

/**
 * @param {Array<*>} folders
 * @returns {Map<string, *>}
 */
export function indexFolders(folders) {
  /** @type {Map<string, *>} */
  const byId = new Map();
  (Array.isArray(folders) ? folders : []).forEach((f) => {
    if (f && f.id) byId.set(String(f.id), f);
  });
  return byId;
}

/**
 * The effective parent of a folder: its own parentId when that parent still
 * exists, otherwise ROOT.
 *
 * Orphans surface at the top level instead of disappearing. A folder whose
 * parent has been soft-deleted out from under it (a restore race, a purge
 * against a tree that changed shape) is still a folder holding client files;
 * hiding it would be a silent data loss the user has no way to notice.
 *
 * @param {*} folder
 * @param {Map<string, *>} byId
 * @returns {string|null}
 */
function effectiveParentId(folder, byId) {
  const pid = folder?.parentId;
  if (pid === null || pid === undefined || pid === "") return ROOT;
  return byId.has(String(pid)) ? String(pid) : ROOT;
}

/**
 * Direct children of a folder, or of the root when parentId is ROOT.
 *
 * @param {Array<*>} folders
 * @param {string|null} [parentId]
 * @returns {Array<*>}
 */
export function childFolders(folders, parentId = ROOT) {
  const byId = indexFolders(folders);
  const target = parentId === null || parentId === undefined ? ROOT : String(parentId);
  return (Array.isArray(folders) ? folders : []).filter(
    (f) => f && f.id && effectiveParentId(f, byId) === target,
  );
}

/**
 * Documents filed directly in a folder, or at the root when folderId is ROOT.
 * A document whose folderId points at a folder that no longer exists is
 * surfaced at the root, for the same reason orphaned folders are.
 *
 * @param {Array<*>} documents
 * @param {string|null} [folderId]
 * @param {Array<*>} [folders] needed only to detect a dangling folderId
 * @returns {Array<*>}
 */
export function documentsIn(documents, folderId = ROOT, folders = []) {
  const byId = indexFolders(folders);
  const target = folderId === null || folderId === undefined ? ROOT : String(folderId);
  return (Array.isArray(documents) ? documents : []).filter((d) => {
    if (!d) return false;
    const fid = d.folderId;
    const resolved =
      fid === null || fid === undefined || fid === "" || !byId.has(String(fid))
        ? ROOT
        : String(fid);
    return resolved === target;
  });
}

/**
 * The chain of folders from the top level down to and including folderId.
 * ROOT returns []. A cyclic chain stops at the first folder it revisits, so
 * the breadcrumb renders something finite and truthful-as-far-as-it-goes
 * instead of hanging the tab.
 *
 * @param {Array<*>} folders
 * @param {string|null} folderId
 * @returns {Array<*>}
 */
export function pathTo(folders, folderId) {
  if (folderId === null || folderId === undefined) return [];
  const byId = indexFolders(folders);
  /** @type {Array<*>} */
  const chain = [];
  /** @type {Set<string>} */
  const seen = new Set();
  let cur = byId.get(String(folderId));
  while (cur && cur.id && !seen.has(String(cur.id))) {
    seen.add(String(cur.id));
    chain.unshift(cur);
    const pid = effectiveParentId(cur, byId);
    cur = pid === ROOT ? null : byId.get(pid);
  }
  return chain;
}

/**
 * Depth of a folder: a top-level folder is 1, ROOT is 0.
 *
 * @param {Array<*>} folders
 * @param {string|null} folderId
 * @returns {number}
 */
export function depthOf(folders, folderId) {
  return pathTo(folders, folderId).length;
}

/**
 * Ids of every folder beneath folderId, at any depth, excluding itself.
 *
 * @param {Array<*>} folders
 * @param {string} folderId
 * @returns {Set<string>}
 */
export function descendantIds(folders, folderId) {
  const byId = indexFolders(folders);
  /** @type {Set<string>} */
  const out = new Set();
  /** @type {string[]} */
  const queue = [String(folderId)];
  while (queue.length) {
    const current = /** @type {string} */ (queue.shift());
    (Array.isArray(folders) ? folders : []).forEach((f) => {
      if (!f || !f.id) return;
      const id = String(f.id);
      if (out.has(id) || id === String(folderId)) return;
      if (effectiveParentId(f, byId) === current) {
        out.add(id);
        queue.push(id);
      }
    });
  }
  return out;
}

/**
 * Height of the subtree rooted at folderId, counting the folder itself as 1.
 * A leaf folder is 1; a folder with one level of children is 2.
 *
 * @param {Array<*>} folders
 * @param {string} folderId
 * @returns {number}
 */
export function subtreeHeight(folders, folderId) {
  const children = childFolders(folders, String(folderId));
  if (!children.length) return 1;
  return 1 + Math.max(...children.map((c) => subtreeHeight(folders, String(c.id))));
}

/**
 * @typedef {{ ok: true } | { ok: false, reason: string }} Verdict
 */

/**
 * Can a new folder be created under this parent?
 *
 * @param {Array<*>} folders
 * @param {string|null} parentId
 * @returns {Verdict}
 */
export function canCreateFolder(folders, parentId) {
  if (parentId !== ROOT && !indexFolders(folders).has(String(parentId))) {
    return { ok: false, reason: "That folder no longer exists." };
  }
  if (depthOf(folders, parentId) + 1 > MAX_FOLDER_DEPTH) {
    return {
      ok: false,
      reason: `Folders can be nested ${MAX_FOLDER_DEPTH} levels deep. Move something up a level first.`,
    };
  }
  return { ok: true };
}

/**
 * Can this folder move under this new parent?
 *
 * Three ways it cannot: into itself, into its own descendant (the cycle that
 * would orphan the whole subtree), or into a position that would push the
 * deepest folder beneath it past MAX_FOLDER_DEPTH.
 *
 * @param {Array<*>} folders
 * @param {string} folderId
 * @param {string|null} targetParentId
 * @returns {Verdict}
 */
export function canMoveFolder(folders, folderId, targetParentId) {
  const byId = indexFolders(folders);
  const id = String(folderId);
  if (!byId.has(id)) return { ok: false, reason: "That folder no longer exists." };

  if (targetParentId !== ROOT) {
    const target = String(targetParentId);
    if (!byId.has(target)) return { ok: false, reason: "That folder no longer exists." };
    if (target === id) return { ok: false, reason: "A folder cannot contain itself." };
    if (descendantIds(folders, id).has(target)) {
      return { ok: false, reason: "A folder cannot move into one of its own sub-folders." };
    }
  }

  const resultingDepth = depthOf(folders, targetParentId) + subtreeHeight(folders, id);
  if (resultingDepth > MAX_FOLDER_DEPTH) {
    return {
      ok: false,
      reason: `That would nest folders ${resultingDepth} levels deep; the limit is ${MAX_FOLDER_DEPTH}.`,
    };
  }
  return { ok: true };
}

/**
 * Can this folder be deleted?
 *
 * Only when it is empty of both sub-folders and documents. Cascading the
 * delete would be recoverable — everything goes through the 30-day soft-delete
 * window — but it is far easier to do by accident, and the thing being
 * accidentally deleted is a client's document set. Refusing costs the user one
 * extra step and tells them exactly what is in the way.
 *
 * @param {Array<*>} folders
 * @param {Array<*>} documents
 * @param {string} folderId
 * @returns {Verdict}
 */
export function canDeleteFolder(folders, documents, folderId) {
  const id = String(folderId);
  if (!indexFolders(folders).has(id)) {
    return { ok: false, reason: "That folder no longer exists." };
  }
  const subFolders = childFolders(folders, id).length;
  const files = documentsIn(documents, id, folders).length;
  if (!subFolders && !files) return { ok: true };

  const parts = [];
  if (files) parts.push(`${files} file${files === 1 ? "" : "s"}`);
  if (subFolders) parts.push(`${subFolders} sub-folder${subFolders === 1 ? "" : "s"}`);
  return {
    ok: false,
    reason: `This folder still holds ${parts.join(" and ")}. Move or delete them first.`,
  };
}

/**
 * The tree as nested nodes, for a picker or a full-tree render. Children are
 * ordered by the caller's own sort; this function preserves input order.
 *
 * @param {Array<*>} folders
 * @returns {Array<{ folder: *, depth: number, children: Array<*> }>}
 */
export function buildTree(folders) {
  /** @param {string|null} parentId @param {number} depth @returns {Array<*>} */
  const build = (parentId, depth) =>
    childFolders(folders, parentId).map((f) => ({
      folder: f,
      depth,
      children: depth >= MAX_FOLDER_DEPTH ? [] : build(String(f.id), depth + 1),
    }));
  return build(ROOT, 1);
}

/**
 * The tree flattened into display order with its depths, which is the shape a
 * <select> of move targets needs (one <option> per folder, indented by depth).
 *
 * @param {Array<*>} folders
 * @returns {Array<{ folder: *, depth: number }>}
 */
export function flattenTree(folders) {
  /** @type {Array<{ folder: *, depth: number }>} */
  const out = [];
  /** @param {Array<*>} nodes */
  const walk = (nodes) =>
    nodes.forEach((n) => {
      out.push({ folder: n.folder, depth: n.depth });
      walk(n.children);
    });
  walk(buildTree(folders));
  return out;
}
