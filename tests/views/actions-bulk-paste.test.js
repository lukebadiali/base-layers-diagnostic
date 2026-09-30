// tests/views/actions-bulk-paste.test.js
// @ts-check
// 2026-08 scope change (Luke, 10-11 Aug): "Paste multiple" on the Actions tab,
// mirroring the Plan tab, plus a blank option in the pillar dropdown.
//
// Milestone v6 (ACT-09 / ACT-10) puts a review step between the paste and the
// write, so a pillar can be set per row. The flow is now
// paste -> Review -> Add all, and the batch-level controls (apply-to-all
// pillar, internal flag) live on the second step with the rows they affect.
//
// Boot pattern mirrors tests/views/actions-client-toggle.test.js.
import { describe, it, expect, vi } from "vitest";
import snapshotOrg from "../fixtures/snapshot-org.json";

/** @param {string} userId */
async function bootAs(userId) {
  /** @type {*} */ (window).BASE_LAYERS = {
    pillars: snapshotOrg.pillars,
    engagementStages: snapshotOrg.engagementStages,
    scoreLabels: snapshotOrg.scoreLabels,
    principles: snapshotOrg.principles,
  };
  /** @type {*} */ (window).FB = { ready: false, currentUser: null, db: null };

  localStorage.clear();
  localStorage.setItem("baselayers:orgs", JSON.stringify(snapshotOrg.orgMetas));
  snapshotOrg.orgs.forEach((/** @type {*} */ o) => {
    localStorage.setItem(`baselayers:org:${o.id}`, JSON.stringify(o));
  });
  localStorage.setItem("baselayers:users", JSON.stringify(snapshotOrg.users));
  localStorage.setItem("baselayers:session", JSON.stringify({ userId }));
  localStorage.setItem("baselayers:settings", JSON.stringify(snapshotOrg.settings));

  document.body.innerHTML =
    '<div id="app"></div><div id="modalRoot"></div><div id="toastRoot"></div>';
  window.location.hash = "#actions";

  vi.resetModules();
  await import("../../src/main.js");
  await Promise.resolve();
  await Promise.resolve();

  const actionsBtn = /** @type {HTMLButtonElement|null} */ (
    document.querySelector('button[data-route="actions"]')
  );
  if (!actionsBtn) throw new Error("actions nav button not found — boot failed");
  actionsBtn.click();
  await Promise.resolve();
}

const ORG_ID = snapshotOrg.orgMetas[0].id;

/** @returns {*} the persisted org from localStorage */
function storedOrg() {
  return JSON.parse(/** @type {string} */ (localStorage.getItem(`baselayers:org:${ORG_ID}`)));
}

/** @param {string} label */
function clickButton(label) {
  const btn = Array.from(document.querySelectorAll("button")).find(
    (b) => (b.textContent || "").trim() === label,
  );
  if (!btn) throw new Error(`button ${JSON.stringify(label)} not found`);
  /** @type {HTMLButtonElement} */ (btn).click();
}

/** @param {string} label */
function buttonExists(label) {
  return Array.from(document.querySelectorAll("button")).some(
    (b) => (b.textContent || "").trim() === label,
  );
}

/** Opens the paste dialogue (step 1) and returns its textarea. */
async function openPasteModal() {
  clickButton("Paste multiple");
  await Promise.resolve();
  const ta = /** @type {HTMLTextAreaElement|null} */ (
    document.querySelector("#modalRoot textarea")
  );
  if (!ta) throw new Error("paste modal did not open");
  return { ta };
}

/** Advance to the review step. */
function goToReview() {
  clickButton("Review");
}

/** The review step's rows, as {text, pillar, remove} handles. */
function reviewRows() {
  return Array.from(document.querySelectorAll("#modalRoot .bulk-review-row")).map((row) => ({
    text: /** @type {HTMLInputElement} */ (row.querySelector(".bulk-review-text")),
    pillar: /** @type {HTMLSelectElement} */ (row.querySelector(".bulk-review-pillar")),
    remove: /** @type {HTMLButtonElement} */ (row.querySelector(".bulk-review-remove")),
  }));
}

/** @param {HTMLElement} el @param {string} value @param {string} [evt] */
function setValue(el, value, evt = "input") {
  /** @type {*} */ (el).value = value;
  el.dispatchEvent(new Event(evt));
}

/** @param {HTMLTextAreaElement} ta @param {string} text */
function type(ta, text) {
  ta.value = text;
  ta.dispatchEvent(new Event("input"));
}

/** True while the paste step (step 1) is on screen. */
function onPasteStep() {
  return document.querySelector("#modalRoot .bulk-step-paste") !== null;
}

/** True while the review step (step 2) is on screen. */
function onReviewStep() {
  return document.querySelector("#modalRoot .bulk-step-review") !== null;
}

const THREE_ITEM_LIST = [
  "- Document ICP, including firmographics and triggers",
  "- Build top 50 hit list",
  "- Improve the properties on HubSpot",
].join("\n");

describe("action plan — paste multiple", () => {
  it("creates one action per line, keeping commas inside an item", async () => {
    await bootAs("u_internal-luke");
    const before = storedOrg().actions.length;
    const { ta } = await openPasteModal();
    type(ta, THREE_ITEM_LIST);
    goToReview();
    clickButton("Add all");
    await Promise.resolve();

    const actions = storedOrg().actions;
    expect(actions.length).toBe(before + 3);
    // Pasted order preserved, newest block on top
    expect(actions.slice(0, 3).map((/** @type {*} */ a) => a.title)).toEqual([
      "Document ICP, including firmographics and triggers",
      "Build top 50 hit list",
      "Improve the properties on HubSpot",
    ]);
    // Defaults every pasted action carries
    actions.slice(0, 3).forEach((/** @type {*} */ a) => {
      expect(a.pillarId).toBe(null);
      expect(a.done).toBe(false);
      expect(a.internal).toBe(false);
      expect(a.createdBy).toBe("u_internal-luke");
      expect(typeof a.createdAt).toBe("string");
      expect(a.id.startsWith("act_")).toBe(true);
    });
    // Modal closed and the table repainted with the new rows
    expect(document.querySelector("#modalRoot textarea")).toBeNull();
    // v6 (ACT-04): the collapsed row shows the title as text, not as an input
    // — editing moved into the expanded panel.
    const titles = Array.from(document.querySelectorAll(".a-title")).map((/** @type {*} */ el) =>
      (el.textContent || "").trim(),
    );
    expect(titles).toContain("Build top 50 hit list");
  }, 20000);

  it("live count reflects the parsed item count", async () => {
    await bootAs("u_internal-luke");
    const { ta } = await openPasteModal();
    const count = () =>
      (document.querySelector("#modalRoot .outcomes-count")?.textContent || "").trim();
    expect(count()).toBe("0 actions");
    type(ta, "Just the one");
    expect(count()).toBe("1 action");
    type(ta, THREE_ITEM_LIST);
    expect(count()).toBe("3 actions");
    // Single line, no bullets -> comma fallback
    type(ta, "Document ICP, hit list, HubSpot props");
    expect(count()).toBe("3 actions");
  }, 20000);

  it("refuses an oversized batch before the user triages it", async () => {
    await bootAs("u_internal-luke");
    const before = storedOrg().actions.length;
    const { ta } = await openPasteModal();
    type(ta, Array.from({ length: 201 }, (_, i) => `Item ${i}`).join("\n"));
    expect(document.querySelector("#modalRoot .outcomes-count")?.textContent).toContain("too many");
    goToReview();
    await Promise.resolve();
    // The cap bites at the step boundary, not at the end — nobody triages 201
    // rows only to be told the batch was never going to land.
    expect(onPasteStep()).toBe(true);
    expect(onReviewStep()).toBe(false);
    expect(storedOrg().actions.length).toBe(before);
  }, 20000);

  it("will not advance to review with an empty box", async () => {
    await bootAs("u_internal-luke");
    const before = storedOrg().actions.length;
    await openPasteModal();
    goToReview();
    await Promise.resolve();
    expect(onPasteStep()).toBe(true);
    expect(storedOrg().actions.length).toBe(before);
  }, 20000);

  it("is staff-only — clients get neither paste nor create", async () => {
    await bootAs("u_client-a");
    expect(buttonExists("Paste multiple")).toBe(false);
    expect(buttonExists("+ New action")).toBe(false);
  }, 20000);
});

describe("action plan — the review step (v6 ACT-09 / ACT-10)", () => {
  it("shows one row per parsed item, each with its own pillar select", async () => {
    await bootAs("u_internal-luke");
    const { ta } = await openPasteModal();
    type(ta, THREE_ITEM_LIST);
    goToReview();

    expect(onReviewStep()).toBe(true);
    const rows = reviewRows();
    expect(rows.length).toBe(3);
    expect(rows.map((r) => r.text.value)).toEqual([
      "Document ICP, including firmographics and triggers",
      "Build top 50 hit list",
      "Improve the properties on HubSpot",
    ]);
    // Every row starts unassigned, and offers the same blank-first list
    rows.forEach((r) => {
      expect(r.pillar.value).toBe("");
      expect(r.pillar.options[0].textContent).toBe("No pillar (unassigned)");
      expect(r.pillar.options.length).toBe(snapshotOrg.pillars.length + 1);
    });
  }, 20000);

  it("assigns a different pillar to each row", async () => {
    await bootAs("u_internal-luke");
    const { ta } = await openPasteModal();
    type(ta, "First\nSecond\nThird");
    goToReview();

    const rows = reviewRows();
    setValue(rows[0].pillar, String(snapshotOrg.pillars[0].id), "change");
    setValue(rows[1].pillar, String(snapshotOrg.pillars[3].id), "change");
    // rows[2] deliberately left blank
    clickButton("Add all");
    await Promise.resolve();

    const created = storedOrg().actions.slice(0, 3);
    expect(created.map((/** @type {*} */ a) => [a.title, a.pillarId])).toEqual([
      ["First", snapshotOrg.pillars[0].id],
      ["Second", snapshotOrg.pillars[3].id],
      ["Third", null],
    ]);
  }, 20000);

  it("re-words an item in review", async () => {
    await bootAs("u_internal-luke");
    const { ta } = await openPasteModal();
    type(ta, "Typo hre\nFine as is");
    goToReview();

    setValue(reviewRows()[0].text, "Typo here");
    clickButton("Add all");
    await Promise.resolve();

    expect(
      storedOrg()
        .actions.slice(0, 2)
        .map((/** @type {*} */ a) => a.title),
    ).toEqual(["Typo here", "Fine as is"]);
  }, 20000);

  it("removes a row, and that action is never created", async () => {
    await bootAs("u_internal-luke");
    const before = storedOrg().actions.length;
    const { ta } = await openPasteModal();
    type(ta, "Keep this\nDrop this\nKeep this too");
    goToReview();

    reviewRows()[1].remove.click();
    expect(reviewRows().length).toBe(2);
    clickButton("Add all");
    await Promise.resolve();

    const actions = storedOrg().actions;
    expect(actions.length).toBe(before + 2);
    expect(actions.slice(0, 2).map((/** @type {*} */ a) => a.title)).toEqual([
      "Keep this",
      "Keep this too",
    ]);
  }, 20000);

  it("removing the middle row leaves the remaining rows editable", async () => {
    // The remove handler closes over the row index, so the list is rebuilt on
    // every removal. If it were not, editing a row after a removal would write
    // to the wrong item.
    await bootAs("u_internal-luke");
    const { ta } = await openPasteModal();
    type(ta, "One\nTwo\nThree");
    goToReview();

    reviewRows()[1].remove.click();
    setValue(reviewRows()[1].text, "Three, edited");
    clickButton("Add all");
    await Promise.resolve();

    expect(
      storedOrg()
        .actions.slice(0, 2)
        .map((/** @type {*} */ a) => a.title),
    ).toEqual(["One", "Three, edited"]);
  }, 20000);

  it("apply-to-all sets every pillar, and a row changed afterwards keeps its own", async () => {
    await bootAs("u_internal-luke");
    const { ta } = await openPasteModal();
    type(ta, "First\nSecond\nThird");
    goToReview();

    const applyAll = /** @type {HTMLSelectElement} */ (
      document.querySelector("#modalRoot .bulk-apply-all")
    );
    setValue(applyAll, String(snapshotOrg.pillars[1].id), "change");
    expect(reviewRows().map((r) => r.pillar.value)).toEqual([
      String(snapshotOrg.pillars[1].id),
      String(snapshotOrg.pillars[1].id),
      String(snapshotOrg.pillars[1].id),
    ]);

    setValue(reviewRows()[2].pillar, String(snapshotOrg.pillars[5].id), "change");
    clickButton("Add all");
    await Promise.resolve();

    expect(
      storedOrg()
        .actions.slice(0, 3)
        .map((/** @type {*} */ a) => a.pillarId),
    ).toEqual([snapshotOrg.pillars[1].id, snapshotOrg.pillars[1].id, snapshotOrg.pillars[5].id]);
  }, 20000);

  it("applies the internal flag to the whole batch", async () => {
    await bootAs("u_internal-luke");
    const { ta } = await openPasteModal();
    type(ta, "First\nSecond");
    goToReview();
    /** @type {HTMLInputElement} */ (document.querySelector("#modalRoot #actBulkInternal")).click();
    clickButton("Add all");
    await Promise.resolve();

    storedOrg()
      .actions.slice(0, 2)
      .forEach((/** @type {*} */ a) => expect(a.internal).toBe(true));
  }, 20000);

  it("Back then Review keeps the edits made in review", async () => {
    await bootAs("u_internal-luke");
    const { ta } = await openPasteModal();
    type(ta, "First\nSecond");
    goToReview();

    setValue(reviewRows()[0].text, "First, reworded");
    setValue(reviewRows()[1].pillar, String(snapshotOrg.pillars[2].id), "change");

    clickButton("Back");
    expect(onPasteStep()).toBe(true);
    // The pasted text is still there to be corrected
    const back = /** @type {HTMLTextAreaElement} */ (document.querySelector("#modalRoot textarea"));
    expect(back.value).toBe("First\nSecond");

    goToReview();
    const rows = reviewRows();
    expect(rows[0].text.value).toBe("First, reworded");
    expect(rows[1].pillar.value).toBe(String(snapshotOrg.pillars[2].id));
  }, 20000);

  it("editing the pasted text after Back re-parses, discarding the old rows", async () => {
    await bootAs("u_internal-luke");
    const { ta } = await openPasteModal();
    type(ta, "First\nSecond");
    goToReview();
    setValue(reviewRows()[0].text, "First, reworded");

    clickButton("Back");
    const back = /** @type {HTMLTextAreaElement} */ (document.querySelector("#modalRoot textarea"));
    type(back, "Completely\nDifferent\nList");
    goToReview();

    expect(reviewRows().map((r) => r.text.value)).toEqual(["Completely", "Different", "List"]);
  }, 20000);

  it("the internal flag survives a Back", async () => {
    await bootAs("u_internal-luke");
    const { ta } = await openPasteModal();
    type(ta, "First");
    goToReview();
    /** @type {HTMLInputElement} */ (document.querySelector("#modalRoot #actBulkInternal")).click();
    clickButton("Back");
    goToReview();
    expect(
      /** @type {HTMLInputElement} */ (document.querySelector("#modalRoot #actBulkInternal"))
        .checked,
    ).toBe(true);
  }, 20000);

  it("adds nothing when every row has been emptied", async () => {
    await bootAs("u_internal-luke");
    const before = storedOrg().actions.length;
    const { ta } = await openPasteModal();
    type(ta, "First\nSecond");
    goToReview();
    reviewRows().forEach((r) => setValue(r.text, "   "));
    clickButton("Add all");
    await Promise.resolve();
    expect(storedOrg().actions.length).toBe(before);
    expect(onReviewStep()).toBe(true);
  }, 20000);
});

describe("action plan — paste from clipboard", () => {
  /** @param {() => Promise<string>} readText */
  function stubClipboard(readText) {
    Object.defineProperty(navigator, "clipboard", {
      value: { readText },
      configurable: true,
      writable: true,
    });
  }

  it("fills the box from the clipboard and recounts", async () => {
    stubClipboard(async () => "- One\n- Two, with a comma\n- Three");
    await bootAs("u_internal-luke");
    const { ta } = await openPasteModal();
    clickButton("Paste from clipboard");
    await Promise.resolve();
    await Promise.resolve();
    expect(ta.value).toContain("Two, with a comma");
    expect(document.querySelector("#modalRoot .outcomes-count")?.textContent).toBe("3 actions");
  }, 20000);

  it("appends to what is already in the box rather than replacing it", async () => {
    stubClipboard(async () => "Second");
    await bootAs("u_internal-luke");
    const { ta } = await openPasteModal();
    type(ta, "First");
    clickButton("Paste from clipboard");
    await Promise.resolve();
    await Promise.resolve();
    expect(ta.value).toBe("First\nSecond");
    expect(document.querySelector("#modalRoot .outcomes-count")?.textContent).toBe("2 actions");
  }, 20000);

  it("explains itself when the browser denies clipboard read", async () => {
    stubClipboard(async () => {
      throw new Error("NotAllowedError");
    });
    await bootAs("u_internal-luke");
    const { ta } = await openPasteModal();
    clickButton("Paste from clipboard");
    await Promise.resolve();
    await Promise.resolve();
    expect(ta.value).toBe("");
    // Modal stays open with a toast pointing the user at Cmd+V
    expect(onPasteStep()).toBe(true);
    expect(document.getElementById("toastRoot")?.textContent).toContain("Cmd+V");
  }, 20000);
});

describe("action plan — blank pillar", () => {
  it("the New action dropdown leads with an unassigned option, and defaults to it", async () => {
    await bootAs("u_internal-luke");
    const before = storedOrg().actions.length;
    clickButton("+ New action");
    await Promise.resolve();
    const select = /** @type {HTMLSelectElement} */ (document.querySelector("#modalRoot select"));
    expect(select.options[0].value).toBe("");
    expect(select.options[0].textContent).toBe("No pillar (unassigned)");
    expect(select.value).toBe("");
    expect(select.options.length).toBe(snapshotOrg.pillars.length + 1);

    const titleInput = /** @type {HTMLInputElement} */ (
      document.querySelector("#modalRoot input[type='text']")
    );
    titleInput.value = "Sort the office plants";
    clickButton("Add");
    await Promise.resolve();

    const actions = storedOrg().actions;
    expect(actions.length).toBe(before + 1);
    // Blank must persist as null — Number("") would have made it 0
    expect(actions[0].pillarId).toBe(null);
  }, 20000);

  it("renders an unassigned action's pillar cell as plain text, not a dead link", async () => {
    await bootAs("u_internal-luke");
    const { ta } = await openPasteModal();
    type(ta, "Action with no pillar");
    goToReview();
    clickButton("Add all");
    await Promise.resolve();

    const none = document.querySelector(".actions-table .action-pillar-none");
    expect(none).not.toBeNull();
    expect((none?.textContent || "").trim()).toBe("Unassigned");
    expect(none?.querySelector("a")).toBeNull();
  }, 20000);

  it("surfaces unassigned actions in the report so they cannot silently vanish", async () => {
    await bootAs("u_internal-luke");
    const { ta } = await openPasteModal();
    type(ta, "Unassigned report item");
    goToReview();
    clickButton("Add all");
    await Promise.resolve();

    const reportBtn = /** @type {HTMLButtonElement|null} */ (
      document.querySelector('button[data-route="report"]')
    );
    if (!reportBtn) throw new Error("report nav button not found");
    reportBtn.click();
    await Promise.resolve();

    const names = Array.from(document.querySelectorAll(".r-pillar header .name")).map((n) =>
      (n.textContent || "").trim(),
    );
    expect(names).toContain("Unassigned");
    const block = Array.from(document.querySelectorAll(".r-pillar")).find(
      (b) => (b.querySelector("header .name")?.textContent || "").trim() === "Unassigned",
    );
    expect(block?.textContent).toContain("Unassigned report item");
  }, 20000);
});
