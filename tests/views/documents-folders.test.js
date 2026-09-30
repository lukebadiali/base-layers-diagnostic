// tests/views/documents-folders.test.js
// @ts-check
// Milestone v6 (DOC-01 to DOC-05): folder navigation, moving, deletion
// refusal, and the three sort keys on the Documents tab.
//
// This is the first behavioural coverage the Documents tab has ever had. Every
// previous view test booted with FB.ready = false, which short-circuits
// renderDocuments at its "Connecting to shared storage…" branch — so the whole
// body was untested. tests/mocks/window-fb.js is what unlocks it; see the note
// at the top of that file for what it does and does not model.
import { describe, it, expect, vi, beforeEach } from "vitest";
import snapshotOrg from "../fixtures/snapshot-org.json";
import { makeWindowFB, fakeTimestamp } from "../mocks/window-fb.js";

const ORG_ID = snapshotOrg.orgMetas[0].id;

/** @type {ReturnType<typeof makeWindowFB>} */
let fb;

/** @param {*} over */
const fileDoc = (over) => ({
  orgId: ORG_ID,
  uploaderId: "u_internal-luke",
  uploaderName: "Luke Badiali",
  uploaderEmail: "luke@example.com",
  filename: "file.pdf",
  size: 2048,
  contentType: "application/pdf",
  storagePath: `orgs/${ORG_ID}/documents/x/file.pdf`,
  folderId: null,
  deletedAt: null,
  createdAt: fakeTimestamp(1_000_000),
  ...over,
});

/** @param {*} over */
const folderDoc = (over) => ({
  orgId: ORG_ID,
  name: "Folder",
  parentId: null,
  createdBy: "u_internal-luke",
  createdAt: fakeTimestamp(1_000_000),
  deletedAt: null,
  ...over,
});

/**
 * @param {string} userId
 * @param {Record<string, *>} [seed] Firestore paths -> data
 */
async function bootAs(userId, seed = {}) {
  /** @type {*} */ (window).BASE_LAYERS = {
    pillars: snapshotOrg.pillars,
    engagementStages: snapshotOrg.engagementStages,
    scoreLabels: snapshotOrg.scoreLabels,
    principles: snapshotOrg.principles,
  };
  fb = makeWindowFB({ seed });

  // A reload does not wipe localStorage, and the file-sort preference lives
  // there. Preserving it across the reseed is what makes the persistence test
  // mean anything.
  const keptSort = localStorage.getItem("baselayers:docSort");
  localStorage.clear();
  if (keptSort !== null) localStorage.setItem("baselayers:docSort", keptSort);
  localStorage.setItem("baselayers:orgs", JSON.stringify(snapshotOrg.orgMetas));
  snapshotOrg.orgs.forEach((/** @type {*} */ o) => {
    localStorage.setItem(`baselayers:org:${o.id}`, JSON.stringify(o));
  });
  localStorage.setItem("baselayers:users", JSON.stringify(snapshotOrg.users));
  localStorage.setItem("baselayers:session", JSON.stringify({ userId }));
  localStorage.setItem("baselayers:settings", JSON.stringify(snapshotOrg.settings));

  document.body.innerHTML =
    '<div id="app"></div><div id="modalRoot"></div><div id="toastRoot"></div>';
  window.location.hash = "#documents";

  vi.resetModules();
  await import("../../src/main.js");
  await Promise.resolve();
  await Promise.resolve();

  // AFTER the import, not before. src/firebase/db.js and src/firebase/storage.js
  // each overwrite window.FB.{db,firestore,storage,storageOps} with the real
  // SDK bindings at module load, so a double installed beforehand is silently
  // replaced and the view ends up talking to a Firestore that will never
  // answer. main.js only reads window.FB from inside functions, so swapping it
  // in here — before the first render of this route — is enough.
  /** @type {*} */ (window).FB = fb.FB;

  const btn = /** @type {HTMLButtonElement|null} */ (
    document.querySelector('button[data-route="documents"]')
  );
  if (!btn) throw new Error("documents nav button not found — boot failed");
  btn.click();
  // Two flushes: the first lets the listeners deliver their initial snapshots
  // (asynchronous, as Firestore's are), the second lets the paint that follows
  // settle.
  await Promise.resolve();
  await Promise.resolve();
}

/** Let a write's snapshot reach the listeners and repaint. */
async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function folderNames() {
  return Array.from(document.querySelectorAll(".docs-folder-open")).map((b) =>
    (b.textContent || "").trim(),
  );
}

function fileNames() {
  return Array.from(document.querySelectorAll(".docs-row-filename")).map((n) =>
    (n.textContent || "").trim(),
  );
}

function crumbs() {
  return Array.from(document.querySelectorAll(".docs-crumb")).map((c) =>
    (c.textContent || "").trim(),
  );
}

/** @param {string} name */
function openFolder(name) {
  const btn = Array.from(document.querySelectorAll(".docs-folder-open")).find(
    (b) => (b.textContent || "").trim() === name,
  );
  if (!btn) throw new Error(`no folder called ${JSON.stringify(name)}`);
  /** @type {HTMLButtonElement} */ (btn).click();
}

/** @param {string} label */
function clickButton(label) {
  const btn = Array.from(document.querySelectorAll("button")).find(
    (b) => (b.textContent || "").trim() === label,
  );
  if (!btn) throw new Error(`button ${JSON.stringify(label)} not found`);
  /** @type {HTMLButtonElement} */ (btn).click();
}

/**
 * Click a button inside the open modal, not one of the same name on a row.
 * @param {string} label
 */
function clickInModal(label) {
  const root = document.getElementById("modalRoot");
  const btn = Array.from(root?.querySelectorAll("button") || []).find(
    (b) => (b.textContent || "").trim() === label,
  );
  if (!btn) throw new Error(`no ${JSON.stringify(label)} button in the dialogue`);
  /** @type {HTMLButtonElement} */ (btn).click();
}

/**
 * The move dialogue's options, keyed by the folder name they offer. The label
 * carries the tree indent as a prefix and, when the target is illegal, the
 * reason as a suffix — so match on the name rather than the whole string.
 */
function moveOptions() {
  const sel = /** @type {HTMLSelectElement} */ (document.querySelector(".docs-move-select"));
  /** @type {Record<string, HTMLOptionElement>} */
  const byName = {};
  Array.from(sel.options).forEach((o) => {
    const text = (o.textContent || "").replace(/^(?:—\s*)+/, "");
    const name = text.split(" — ")[0].trim();
    byName[name] = o;
  });
  return byName;
}

/** @param {string} label */
function buttonExists(label) {
  return Array.from(document.querySelectorAll("button")).some(
    (b) => (b.textContent || "").trim() === label,
  );
}

/**
 * The action buttons on a named folder's row.
 * @param {string} name
 */
function folderRowFor(name) {
  const row = Array.from(document.querySelectorAll(".docs-folder-row")).find(
    (r) => (r.querySelector(".docs-folder-open")?.textContent || "").trim() === name,
  );
  if (!row) throw new Error(`no folder row for ${JSON.stringify(name)}`);
  return row;
}

/** @param {Element} row @param {string} label */
function clickIn(row, label) {
  const btn = Array.from(row.querySelectorAll("button")).find(
    (b) => (b.textContent || "").trim() === label,
  );
  if (!btn) throw new Error(`no ${JSON.stringify(label)} button on that row`);
  /** @type {HTMLButtonElement} */ (btn).click();
}

function toastText() {
  return document.getElementById("toastRoot")?.textContent || "";
}

const TREE_SEED = {
  [`orgs/${ORG_ID}/folders/f_board`]: folderDoc({ id: "f_board", name: "Board pack" }),
  [`orgs/${ORG_ID}/folders/f_q3`]: folderDoc({ id: "f_q3", name: "Q3", parentId: "f_board" }),
  [`orgs/${ORG_ID}/folders/f_admin`]: folderDoc({ id: "f_admin", name: "Admin" }),
  [`orgs/${ORG_ID}/documents/d_root`]: fileDoc({ filename: "root.pdf", folderId: null }),
  [`orgs/${ORG_ID}/documents/d_board`]: fileDoc({ filename: "board.pdf", folderId: "f_board" }),
  [`orgs/${ORG_ID}/documents/d_q3`]: fileDoc({ filename: "q3.pdf", folderId: "f_q3" }),
};

beforeEach(() => {
  localStorage.removeItem("baselayers:docSort");
});

describe("documents — folder navigation (DOC-01 / DOC-02)", () => {
  it("shows only the root's own folders and files", async () => {
    await bootAs("u_internal-luke", TREE_SEED);
    expect(folderNames()).toEqual(["Admin", "Board pack"]);
    expect(fileNames()).toEqual(["root.pdf"]);
  });

  it("navigating into a folder shows its contents and not its parent's", async () => {
    await bootAs("u_internal-luke", TREE_SEED);
    openFolder("Board pack");
    expect(folderNames()).toEqual(["Q3"]);
    expect(fileNames()).toEqual(["board.pdf"]);
  });

  it("does not show a grandchild's files in the grandparent", async () => {
    await bootAs("u_internal-luke", TREE_SEED);
    openFolder("Board pack");
    expect(fileNames()).not.toContain("q3.pdf");
  });

  it("builds a breadcrumb the whole way down, and back up again", async () => {
    await bootAs("u_internal-luke", TREE_SEED);
    expect(crumbs()).toEqual(["Documents"]);
    openFolder("Board pack");
    expect(crumbs()).toEqual(["Documents", "Board pack"]);
    openFolder("Q3");
    expect(crumbs()).toEqual(["Documents", "Board pack", "Q3"]);

    // Clicking a crumb goes back to that level
    const boardCrumb = Array.from(document.querySelectorAll(".docs-crumb-link")).find(
      (c) => (c.textContent || "").trim() === "Board pack",
    );
    /** @type {HTMLButtonElement} */ (boardCrumb).click();
    expect(crumbs()).toEqual(["Documents", "Board pack"]);
    expect(fileNames()).toEqual(["board.pdf"]);
  });

  it("folders sort above files, and by name", async () => {
    await bootAs("u_internal-luke", TREE_SEED);
    const rows = Array.from(document.querySelectorAll(".docs-table-row")).map((r) =>
      r.classList.contains("docs-folder-row") ? "folder" : "file",
    );
    expect(rows).toEqual(["folder", "folder", "file"]);
  });

  it("an empty folder says so", async () => {
    await bootAs("u_internal-luke", {
      [`orgs/${ORG_ID}/folders/f_empty`]: folderDoc({ id: "f_empty", name: "Empty" }),
    });
    openFolder("Empty");
    expect(document.querySelector(".docs-list-empty")?.textContent).toBe(
      "Nothing in this folder yet.",
    );
  });

  it("a folder row summarises what is inside it", async () => {
    await bootAs("u_internal-luke", TREE_SEED);
    const meta = folderRowFor("Board pack").querySelector(".docs-row-meta")?.textContent || "";
    expect(meta).toContain("1 file");
    expect(meta).toContain("1 folder");
    expect(folderRowFor("Admin").querySelector(".docs-row-meta")?.textContent).toBe("Empty");
  });
});

describe("documents — creating and renaming folders", () => {
  it("creates a folder in the folder currently open", async () => {
    await bootAs("u_internal-luke", TREE_SEED);
    openFolder("Board pack");
    clickButton("+ New folder");
    const input = /** @type {HTMLInputElement} */ (
      document.querySelector("#modalRoot input[type='text']")
    );
    input.value = "Appendices";
    clickButton("Save");
    await settle();

    const created = fb
      .idsIn(`orgs/${ORG_ID}/folders`)
      .map((id) => fb.read(`orgs/${ORG_ID}/folders/${id}`))
      .find((f) => f.name === "Appendices");
    expect(created).toBeDefined();
    expect(created.parentId).toBe("f_board");
    // deletedAt is written explicitly, or the listener's `== null` filter
    // would never match it and the folder would be invisible from birth.
    expect(created.deletedAt).toBe(null);
  });

  it("renames a folder", async () => {
    await bootAs("u_internal-luke", TREE_SEED);
    clickIn(folderRowFor("Admin"), "Rename");
    const input = /** @type {HTMLInputElement} */ (
      document.querySelector("#modalRoot input[type='text']")
    );
    expect(input.value).toBe("Admin");
    input.value = "Administration";
    clickButton("Save");
    await settle();
    expect(fb.read(`orgs/${ORG_ID}/folders/f_admin`).name).toBe("Administration");
  });
});

describe("documents — moving (DOC-03)", () => {
  it("moving a file changes folderId and nothing else — storagePath is untouched", async () => {
    await bootAs("u_internal-luke", TREE_SEED);
    const before = { ...fb.read(`orgs/${ORG_ID}/documents/d_root`) };

    const row = Array.from(document.querySelectorAll(".docs-file-row")).find(
      (r) => (r.querySelector(".docs-row-filename")?.textContent || "").trim() === "root.pdf",
    );
    clickIn(/** @type {Element} */ (row), "Move");
    const sel = /** @type {HTMLSelectElement} */ (document.querySelector(".docs-move-select"));
    sel.value = "f_admin";
    clickInModal("Move");
    await settle();

    const after = fb.read(`orgs/${ORG_ID}/documents/d_root`);
    expect(after.folderId).toBe("f_admin");
    // The Storage object is never rewritten by a move. firestore.rules pins
    // storagePath immutable for exactly this reason.
    expect(after.storagePath).toBe(before.storagePath);
    expect(after.filename).toBe(before.filename);
    expect(after.size).toBe(before.size);
    // And it now shows inside Admin rather than at the root
    expect(fileNames()).not.toContain("root.pdf");
    openFolder("Admin");
    expect(fileNames()).toEqual(["root.pdf"]);
  });

  it("the move picker disables a folder's own descendants as targets", async () => {
    await bootAs("u_internal-luke", TREE_SEED);
    clickIn(folderRowFor("Board pack"), "Move");
    const opts = moveOptions();
    // Top level and a sibling are fine
    expect(opts["Documents (top level)"].disabled).toBe(false);
    expect(opts["Admin"].disabled).toBe(false);
    // Itself and its own child are not — and say why, rather than vanishing
    expect(opts["Board pack"].disabled).toBe(true);
    expect(opts["Board pack"].textContent).toContain("cannot contain itself");
    expect(opts["Q3"].disabled).toBe(true);
    expect(opts["Q3"].textContent).toContain("sub-folder");
  });

  it("moves a folder to a legal target", async () => {
    await bootAs("u_internal-luke", TREE_SEED);
    clickIn(folderRowFor("Board pack"), "Move");
    const sel = /** @type {HTMLSelectElement} */ (document.querySelector(".docs-move-select"));
    sel.value = "f_admin";
    clickInModal("Move");
    await settle();

    expect(fb.read(`orgs/${ORG_ID}/folders/f_board`).parentId).toBe("f_admin");
    expect(folderNames()).toEqual(["Admin"]);
    openFolder("Admin");
    expect(folderNames()).toEqual(["Board pack"]);
  });
});

describe("documents — deleting a folder (DOC-04)", () => {
  it("refuses a folder holding files, and names what is in the way", async () => {
    await bootAs("u_internal-luke", TREE_SEED);
    openFolder("Board pack");
    clickIn(folderRowFor("Q3"), "Delete");
    // No confirmation dialogue — the refusal happens first
    expect(document.querySelector("#modalRoot h3")).toBeNull();
    expect(toastText()).toContain("1 file");
  });

  it("refuses a folder holding sub-folders", async () => {
    await bootAs("u_internal-luke", TREE_SEED);
    clickIn(folderRowFor("Board pack"), "Delete");
    expect(document.querySelector("#modalRoot h3")).toBeNull();
    expect(toastText()).toContain("sub-folder");
  });

  it("asks for confirmation on an empty folder", async () => {
    await bootAs("u_internal-luke", TREE_SEED);
    clickIn(folderRowFor("Admin"), "Delete");
    expect(document.querySelector("#modalRoot h3")?.textContent).toBe("Delete folder?");
  });
});

describe("documents — sorting (DOC-05)", () => {
  const SORT_SEED = {
    [`orgs/${ORG_ID}/documents/d_a`]: fileDoc({
      filename: "Banana.pdf",
      uploaderName: "Zoe",
      createdAt: fakeTimestamp(3000),
    }),
    [`orgs/${ORG_ID}/documents/d_b`]: fileDoc({
      filename: "Apple.pdf",
      uploaderName: "Mo",
      createdAt: fakeTimestamp(1000),
    }),
    [`orgs/${ORG_ID}/documents/d_c`]: fileDoc({
      filename: "Cherry.pdf",
      uploaderName: "Ana",
      createdAt: fakeTimestamp(2000),
    }),
  };

  /** @param {string} value */
  function setSort(value) {
    const sel = /** @type {HTMLSelectElement} */ (document.querySelector(".docs-sort-select"));
    sel.value = value;
    sel.dispatchEvent(new Event("change"));
  }

  it("defaults to date added, newest first", async () => {
    await bootAs("u_internal-luke", SORT_SEED);
    const sel = /** @type {HTMLSelectElement} */ (document.querySelector(".docs-sort-select"));
    expect(sel.value).toBe("added");
    expect(fileNames()).toEqual(["Banana.pdf", "Cherry.pdf", "Apple.pdf"]);
  });

  it("sorts by name", async () => {
    await bootAs("u_internal-luke", SORT_SEED);
    setSort("name");
    expect(fileNames()).toEqual(["Apple.pdf", "Banana.pdf", "Cherry.pdf"]);
  });

  it("sorts by uploader", async () => {
    await bootAs("u_internal-luke", SORT_SEED);
    setSort("uploader");
    expect(fileNames()).toEqual(["Cherry.pdf", "Apple.pdf", "Banana.pdf"]);
  });

  it("remembers the choice across a reload", async () => {
    await bootAs("u_internal-luke", SORT_SEED);
    setSort("name");
    await bootAs("u_internal-luke", SORT_SEED);
    const sel = /** @type {HTMLSelectElement} */ (document.querySelector(".docs-sort-select"));
    expect(sel.value).toBe("name");
    expect(fileNames()).toEqual(["Apple.pdf", "Banana.pdf", "Cherry.pdf"]);
  });

  it("falls back to the default for a stale stored key", async () => {
    localStorage.setItem("baselayers:docSort", "size");
    await bootAs("u_internal-luke", SORT_SEED);
    const sel = /** @type {HTMLSelectElement} */ (document.querySelector(".docs-sort-select"));
    expect(sel.value).toBe("added");
  });
});

describe("documents — what a client may do", () => {
  it("a client navigates and downloads but gets no folder controls", async () => {
    await bootAs("u_client-a", TREE_SEED);
    expect(buttonExists("+ New folder")).toBe(false);
    // Navigation still works
    openFolder("Board pack");
    expect(fileNames()).toEqual(["board.pdf"]);
    // No per-row folder controls either
    expect(buttonExists("Rename")).toBe(false);
    expect(document.querySelectorAll(".docs-folder-row .btn").length).toBe(0);
  });

  it("a client cannot move a file, but can delete their own upload", async () => {
    await bootAs("u_client-a", {
      [`orgs/${ORG_ID}/documents/d_mine`]: fileDoc({
        filename: "mine.pdf",
        uploaderId: "u_client-a",
      }),
      [`orgs/${ORG_ID}/documents/d_theirs`]: fileDoc({
        filename: "theirs.pdf",
        uploaderId: "u_internal-luke",
      }),
    });
    const rowFor = (/** @type {string} */ name) =>
      Array.from(document.querySelectorAll(".docs-file-row")).find(
        (r) => (r.querySelector(".docs-row-filename")?.textContent || "").trim() === name,
      );
    const labels = (/** @type {*} */ row) =>
      Array.from(/** @type {Element} */ (row).querySelectorAll("button")).map((b) =>
        (b.textContent || "").trim(),
      );
    expect(labels(rowFor("mine.pdf"))).toEqual(["Download", "Delete"]);
    expect(labels(rowFor("theirs.pdf"))).toEqual(["Download"]);
  });
});

describe("documents — the deletedAt filter", () => {
  it("a tombstoned file never reaches the list", async () => {
    await bootAs("u_internal-luke", {
      [`orgs/${ORG_ID}/documents/d_live`]: fileDoc({ filename: "live.pdf" }),
      [`orgs/${ORG_ID}/documents/d_gone`]: fileDoc({
        filename: "gone.pdf",
        deletedAt: fakeTimestamp(9000),
      }),
    });
    expect(fileNames()).toEqual(["live.pdf"]);
  });

  it("a row with NO deletedAt field is filtered out too — which is why the backfill exists", async () => {
    // Real Firestore: `where("deletedAt", "==", null)` matches a field that IS
    // null, not a document missing the field. Every file uploaded before v6
    // lacks it. Without scripts/backfill-document-folder-fields those files
    // vanish silently — no error, just a shorter list than the client
    // remembers. This test is the reminder that the script is not optional.
    const legacy = fileDoc({ filename: "legacy.pdf" });
    delete legacy.deletedAt;
    await bootAs("u_internal-luke", {
      [`orgs/${ORG_ID}/documents/d_new`]: fileDoc({ filename: "new.pdf" }),
      [`orgs/${ORG_ID}/documents/d_legacy`]: legacy,
    });
    expect(fileNames()).toEqual(["new.pdf"]);
  });
});
