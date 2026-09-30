// tests/domain/folder-tree.test.js
// @ts-check
// Milestone v6 (FILE-01..FILE-04). This module holds the two guards Firestore
// rules structurally cannot express — cycle prevention and the depth cap — so
// these tests are the only place either is enforced-and-proven. The cyclic and
// orphaned fixtures matter: rules cannot stop a cycle being written, so the
// traversals have to terminate on one rather than hang the tab.
import { describe, it, expect } from "vitest";
import {
  MAX_FOLDER_DEPTH,
  ROOT,
  buildTree,
  canCreateFolder,
  canDeleteFolder,
  canMoveFolder,
  childFolders,
  depthOf,
  descendantIds,
  documentsIn,
  flattenTree,
  indexFolders,
  pathTo,
  subtreeHeight,
} from "../../src/domain/folder-tree.js";

/** @param {string} id @param {string|null} parentId @param {string} [name] */
const f = (id, parentId, name = id) => ({ id, parentId, name, orgId: "orgA" });

// a > b > c ; d at root
const TREE = [f("a", null), f("b", "a"), f("c", "b"), f("d", null)];

/** @param {string} id @param {string|null} folderId */
const file = (id, folderId) => ({ id, folderId, filename: `${id}.pdf` });

describe("indexFolders", () => {
  it("keys folders by id and skips junk", () => {
    const idx = indexFolders([f("a", null), null, undefined, { name: "no id" }]);
    expect(Array.from(idx.keys())).toEqual(["a"]);
  });
});

describe("childFolders", () => {
  it("lists the top level for ROOT", () => {
    expect(childFolders(TREE, ROOT).map((x) => x.id)).toEqual(["a", "d"]);
  });
  it("lists direct children only, not grandchildren", () => {
    expect(childFolders(TREE, "a").map((x) => x.id)).toEqual(["b"]);
  });
  it("treats a blank-string parentId as root", () => {
    expect(childFolders([f("x", "")], ROOT).map((x) => x.id)).toEqual(["x"]);
  });
  it("surfaces an orphan at root rather than hiding it", () => {
    const orphaned = [f("ghost", "deleted-parent")];
    expect(childFolders(orphaned, ROOT).map((x) => x.id)).toEqual(["ghost"]);
  });
});

describe("documentsIn", () => {
  const docs = [file("r1", null), file("r2", ""), file("inA", "a"), file("lost", "gone")];

  it("lists root files, counting blank and missing folderIds as root", () => {
    expect(documentsIn(docs, ROOT, TREE).map((d) => d.id)).toEqual(["r1", "r2", "lost"]);
  });
  it("lists a folder's own files", () => {
    expect(documentsIn(docs, "a", TREE).map((d) => d.id)).toEqual(["inA"]);
  });
  it("does not include a sub-folder's files in its parent", () => {
    expect(documentsIn([file("inB", "b")], "a", TREE)).toEqual([]);
  });
});

describe("pathTo and depthOf", () => {
  it("returns the chain from the top level down to the folder", () => {
    expect(pathTo(TREE, "c").map((x) => x.id)).toEqual(["a", "b", "c"]);
  });
  it("returns [] and depth 0 for ROOT", () => {
    expect(pathTo(TREE, ROOT)).toEqual([]);
    expect(depthOf(TREE, ROOT)).toBe(0);
  });
  it("counts a top-level folder as depth 1", () => {
    expect(depthOf(TREE, "a")).toBe(1);
    expect(depthOf(TREE, "c")).toBe(3);
  });
  it("returns [] for an id that does not exist", () => {
    expect(pathTo(TREE, "nope")).toEqual([]);
  });
  it("terminates on a cyclic chain instead of hanging", () => {
    const cyclic = [f("x", "y"), f("y", "x")];
    const path = pathTo(cyclic, "x");
    expect(path.length).toBeLessThanOrEqual(2);
    expect(depthOf(cyclic, "x")).toBeLessThanOrEqual(2);
  });
});

describe("descendantIds", () => {
  it("collects every level beneath a folder, excluding itself", () => {
    expect(Array.from(descendantIds(TREE, "a")).sort()).toEqual(["b", "c"]);
  });
  it("is empty for a leaf", () => {
    expect(descendantIds(TREE, "c").size).toBe(0);
  });
  it("terminates on a cycle", () => {
    const cyclic = [f("x", "y"), f("y", "x")];
    expect(descendantIds(cyclic, "x").size).toBeLessThanOrEqual(2);
  });
});

describe("subtreeHeight", () => {
  it("counts a leaf as 1 and a three-level chain as 3", () => {
    expect(subtreeHeight(TREE, "c")).toBe(1);
    expect(subtreeHeight(TREE, "b")).toBe(2);
    expect(subtreeHeight(TREE, "a")).toBe(3);
  });
  it("takes the deepest branch, not the first", () => {
    const wide = [f("root", null), f("shallow", "root"), f("deep", "root"), f("deeper", "deep")];
    expect(subtreeHeight(wide, "root")).toBe(3);
  });
});

describe("canCreateFolder", () => {
  it("allows a folder at root", () => {
    expect(canCreateFolder(TREE, ROOT)).toEqual({ ok: true });
  });
  it("allows a folder inside an existing one below the cap", () => {
    expect(canCreateFolder(TREE, "a")).toEqual({ ok: true });
  });
  it("refuses a parent that no longer exists", () => {
    const v = canCreateFolder(TREE, "gone");
    expect(v.ok).toBe(false);
  });
  it("refuses once the new folder would exceed the depth cap", () => {
    // Build a chain exactly MAX_FOLDER_DEPTH deep.
    const deep = [];
    for (let i = 1; i <= MAX_FOLDER_DEPTH; i++) {
      deep.push(f(`L${i}`, i === 1 ? null : `L${i - 1}`));
    }
    expect(depthOf(deep, `L${MAX_FOLDER_DEPTH}`)).toBe(MAX_FOLDER_DEPTH);
    expect(canCreateFolder(deep, `L${MAX_FOLDER_DEPTH - 1}`)).toEqual({ ok: true });
    const v = canCreateFolder(deep, `L${MAX_FOLDER_DEPTH}`);
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain(String(MAX_FOLDER_DEPTH));
  });
});

describe("canMoveFolder — the cycle guard rules cannot enforce", () => {
  it("allows a sideways move", () => {
    expect(canMoveFolder(TREE, "c", "d")).toEqual({ ok: true });
  });
  it("allows a move to root", () => {
    expect(canMoveFolder(TREE, "c", ROOT)).toEqual({ ok: true });
  });
  it("refuses a folder moving into itself", () => {
    const v = canMoveFolder(TREE, "a", "a");
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toMatch(/itself/i);
  });
  it("refuses a folder moving into its own child", () => {
    const v = canMoveFolder(TREE, "a", "b");
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toMatch(/sub-folder/i);
  });
  it("refuses a folder moving into its own grandchild", () => {
    const v = canMoveFolder(TREE, "a", "c");
    expect(v.ok).toBe(false);
  });
  it("refuses a move that would push the subtree past the depth cap", () => {
    // chain of MAX_FOLDER_DEPTH-1 under `deep`, plus a 2-high subtree to move in
    const nodes = [];
    for (let i = 1; i <= MAX_FOLDER_DEPTH - 1; i++) {
      nodes.push(f(`L${i}`, i === 1 ? null : `L${i - 1}`));
    }
    nodes.push(f("m", null), f("mChild", "m"));
    // depth(L{max-1}) = max-1, subtreeHeight(m) = 2 -> max+1 > cap
    const v = canMoveFolder(nodes, "m", `L${MAX_FOLDER_DEPTH - 1}`);
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toMatch(/levels deep/);
    // one level higher fits exactly
    expect(canMoveFolder(nodes, "m", `L${MAX_FOLDER_DEPTH - 2}`)).toEqual({ ok: true });
  });
  it("refuses a folder or target that no longer exists", () => {
    expect(canMoveFolder(TREE, "gone", ROOT).ok).toBe(false);
    expect(canMoveFolder(TREE, "a", "gone").ok).toBe(false);
  });
});

describe("canDeleteFolder", () => {
  it("allows deleting an empty folder", () => {
    expect(canDeleteFolder(TREE, [], "c")).toEqual({ ok: true });
  });
  it("refuses a folder holding files, and says how many", () => {
    const v = canDeleteFolder(TREE, [file("x", "c")], "c");
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain("1 file");
  });
  it("refuses a folder holding sub-folders, and says how many", () => {
    const v = canDeleteFolder(TREE, [], "a");
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain("1 sub-folder");
  });
  it("names both when both are in the way, pluralised", () => {
    const v = canDeleteFolder(TREE, [file("x", "a"), file("y", "a")], "a");
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain("2 files");
    expect(v.ok === false && v.reason).toContain("1 sub-folder");
  });
  it("does not count a grandchild's files as blocking the grandparent directly", () => {
    // `b` holds `c`; the sub-folder is what blocks, not the file inside `c`.
    const v = canDeleteFolder(TREE, [file("deep", "c")], "b");
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).not.toContain("file");
  });
  it("refuses a folder that no longer exists", () => {
    expect(canDeleteFolder(TREE, [], "gone").ok).toBe(false);
  });
});

describe("buildTree and flattenTree", () => {
  it("nests children under their parents with depths from 1", () => {
    const tree = buildTree(TREE);
    expect(tree.map((n) => n.folder.id)).toEqual(["a", "d"]);
    expect(tree[0].depth).toBe(1);
    expect(tree[0].children[0].folder.id).toBe("b");
    expect(tree[0].children[0].depth).toBe(2);
    expect(tree[0].children[0].children[0].folder.id).toBe("c");
  });

  it("flattens depth-first into picker order", () => {
    expect(flattenTree(TREE).map((n) => `${n.depth}:${n.folder.id}`)).toEqual([
      "1:a",
      "2:b",
      "3:c",
      "1:d",
    ]);
  });

  it("terminates on a cycle rather than recursing forever", () => {
    const cyclic = [f("x", "y"), f("y", "x")];
    expect(() => flattenTree(cyclic)).not.toThrow();
    expect(flattenTree(cyclic).length).toBeLessThanOrEqual(MAX_FOLDER_DEPTH * 2);
  });

  it("tolerates a non-array", () => {
    expect(buildTree(/** @type {*} */ (null))).toEqual([]);
    expect(flattenTree(/** @type {*} */ (undefined))).toEqual([]);
  });
});

describe("folder-tree — defensive and boundary paths", () => {
  it("descendantIds tolerates a non-array folder set", () => {
    expect(descendantIds(/** @type {*} */ (null), "a").size).toBe(0);
  });

  it("canDeleteFolder pluralises sub-folders correctly", () => {
    const many = [f("p", null), f("c1", "p"), f("c2", "p")];
    const v = canDeleteFolder(many, [], "p");
    expect(v.ok).toBe(false);
    expect(v.ok === false && v.reason).toContain("2 sub-folders");
    expect(v.ok === false && v.reason).not.toContain("file");
  });

  it("canDeleteFolder says one file, singular", () => {
    const v = canDeleteFolder(TREE, [file("only", "c")], "c");
    expect(v.ok === false && v.reason).toContain("1 file");
    expect(v.ok === false && v.reason).not.toContain("1 files");
  });

  it("buildTree stops descending at the depth cap", () => {
    // A chain one level deeper than the cap allows. buildTree must not walk
    // past MAX_FOLDER_DEPTH even though the data says it could — a tree
    // written past the cap out-of-band (the R1 residual risk) must still
    // render something finite.
    const deep = [];
    for (let i = 1; i <= MAX_FOLDER_DEPTH + 1; i++) {
      deep.push(f(`L${i}`, i === 1 ? null : `L${i - 1}`));
    }
    const flat = flattenTree(deep);
    expect(flat.length).toBe(MAX_FOLDER_DEPTH);
    expect(flat[flat.length - 1].depth).toBe(MAX_FOLDER_DEPTH);
    expect(flat.map((n) => n.folder.id)).not.toContain(`L${MAX_FOLDER_DEPTH + 1}`);
  });

  it("documentsIn tolerates a non-array document set", () => {
    expect(documentsIn(/** @type {*} */ (null), ROOT, TREE)).toEqual([]);
  });

  it("childFolders tolerates a non-array folder set", () => {
    expect(childFolders(/** @type {*} */ (undefined), ROOT)).toEqual([]);
  });

  it("indexFolders and pathTo tolerate a folder id given as a number", () => {
    const numeric = [{ id: 7, parentId: null, name: "Seven" }];
    expect(pathTo(numeric, /** @type {*} */ (7)).map((x) => x.name)).toEqual(["Seven"]);
    expect(depthOf(numeric, /** @type {*} */ (7))).toBe(1);
  });
});

describe("folder-tree — null entries inside otherwise valid sets", () => {
  it("documentsIn skips a null document", () => {
    expect(documentsIn([null, file("real", null)], ROOT, TREE).map((d) => d.id)).toEqual(["real"]);
  });

  it("descendantIds skips null and id-less folders while walking", () => {
    const messy = [f("root", null), null, { parentId: "root", name: "no id" }, f("child", "root")];
    expect(Array.from(descendantIds(messy, "root"))).toEqual(["child"]);
  });
});
