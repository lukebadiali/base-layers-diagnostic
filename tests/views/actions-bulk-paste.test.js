// tests/views/actions-bulk-paste.test.js
// @ts-check
// 2026-08 scope change (Luke, 10-11 Aug): "Paste multiple" on the Actions tab,
// mirroring the Plan tab, plus a blank option in the pillar dropdown. Boot
// pattern mirrors tests/views/actions-client-toggle.test.js.
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

/** Opens the paste dialogue and returns its textarea + pillar select. */
async function openPasteModal() {
  clickButton("Paste multiple");
  await Promise.resolve();
  const ta = /** @type {HTMLTextAreaElement|null} */ (
    document.querySelector("#modalRoot textarea")
  );
  const select = /** @type {HTMLSelectElement|null} */ (
    document.querySelector("#modalRoot select")
  );
  if (!ta || !select) throw new Error("paste modal did not open");
  return { ta, select };
}

/** @param {HTMLTextAreaElement} ta @param {string} text */
function type(ta, text) {
  ta.value = text;
  ta.dispatchEvent(new Event("input"));
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
    const titles = Array.from(document.querySelectorAll(".a-title")).map(
      (/** @type {*} */ i) => i.value,
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

  it("applies the chosen pillar and the internal flag to the whole batch", async () => {
    await bootAs("u_internal-luke");
    const { ta, select } = await openPasteModal();
    type(ta, "First\nSecond");
    select.value = String(snapshotOrg.pillars[1].id);
    /** @type {HTMLInputElement} */ (
      document.querySelector("#modalRoot #actBulkInternal")
    ).checked = true;
    clickButton("Add all");
    await Promise.resolve();

    const created = storedOrg().actions.slice(0, 2);
    created.forEach((/** @type {*} */ a) => {
      expect(a.pillarId).toBe(snapshotOrg.pillars[1].id);
      expect(a.internal).toBe(true);
    });
  }, 20000);

  it("refuses an oversized batch instead of truncating it", async () => {
    await bootAs("u_internal-luke");
    const before = storedOrg().actions.length;
    const { ta } = await openPasteModal();
    type(ta, Array.from({ length: 201 }, (_, i) => `Item ${i}`).join("\n"));
    expect(document.querySelector("#modalRoot .outcomes-count")?.textContent).toContain("too many");
    clickButton("Add all");
    await Promise.resolve();
    // Nothing written, modal stays open so the user can trim the list
    expect(storedOrg().actions.length).toBe(before);
    expect(document.querySelector("#modalRoot textarea")).not.toBeNull();
  }, 20000);

  it("adds nothing when the box is empty", async () => {
    await bootAs("u_internal-luke");
    const before = storedOrg().actions.length;
    await openPasteModal();
    clickButton("Add all");
    await Promise.resolve();
    expect(storedOrg().actions.length).toBe(before);
    expect(document.querySelector("#modalRoot textarea")).not.toBeNull();
  }, 20000);

  it("is staff-only — clients get neither paste nor create", async () => {
    await bootAs("u_client-a");
    const labels = Array.from(document.querySelectorAll("button")).map((b) =>
      (b.textContent || "").trim(),
    );
    expect(labels).not.toContain("Paste multiple");
    expect(labels).not.toContain("+ New action");
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
    expect(document.querySelector("#modalRoot textarea")).not.toBeNull();
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
