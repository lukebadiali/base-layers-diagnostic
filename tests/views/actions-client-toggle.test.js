// tests/views/actions-client-toggle.test.js
// @ts-check
// 2026-07: both clients and staff complete actions by clicking the row
// checkbox.
//
// Milestone v6 (ACT-04 / ACT-07) changes the row contract this file encodes,
// in two ways it is worth being explicit about:
//
//   1. The collapsed row is read-only text plus the completion checkbox. Every
//      editable field moved into the panel that opens when the row is clicked,
//      so a test that wants to edit has to expand first.
//   2. A client may now edit title, description, owner and pillar. The due
//      date is the one content field that stays with BeDeveloped, and it is
//      denied in firestore.rules as well as disabled here.
//
// Boot pattern mirrors tests/views/diagnostic-client-readonly.test.js.
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

  document.body.innerHTML = '<div id="app"></div><div id="modalRoot"></div>';
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

/** @param {string} id */
function rowFor(id) {
  const row = /** @type {HTMLElement|null} */ (
    document.querySelector(`.action-row[data-action-id="${id}"]`)
  );
  if (!row) throw new Error(`no row for action ${id}`);
  return row;
}

/**
 * The disclosure button for a row — the accessible control, not the row.
 * @param {string} id
 */
function chevronFor(id) {
  const btn = /** @type {HTMLButtonElement|null} */ (
    rowFor(id).querySelector("button.action-chevron")
  );
  if (!btn) throw new Error(`no disclosure button for action ${id}`);
  return btn;
}

/**
 * Expand a row and return its panel.
 * @param {string} id
 */
function expandRow(id) {
  if (chevronFor(id).getAttribute("aria-expanded") !== "true") rowFor(id).click();
  const panel = /** @type {HTMLElement|null} */ (
    rowFor(id).closest(".action-item")?.querySelector(".action-panel") || null
  );
  if (!panel) throw new Error(`row ${id} did not expand`);
  return panel;
}

/** @param {HTMLElement} panel @param {string} label */
function fieldIn(panel, label) {
  const field = Array.from(panel.querySelectorAll(".action-panel-field")).find(
    (f) => (f.querySelector(".action-panel-label")?.textContent || "").trim() === label,
  );
  if (!field) throw new Error(`no "${label}" field in the panel`);
  const control = /** @type {HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement|null} */ (
    field.querySelector("input, textarea, select")
  );
  if (!control) throw new Error(`"${label}" field has no control`);
  return control;
}

/** @param {string} id */
function findAction(id) {
  return storedOrg().actions.find((/** @type {*} */ a) => a.id === id);
}

describe("action plan — completion toggle", () => {
  it("client checkbox toggle persists done + completion audit fields", async () => {
    await bootAs("u_client-a");
    const chk = /** @type {HTMLInputElement|null} */ (
      rowFor("act_1").querySelector("input[type='checkbox']")
    );
    if (!chk) throw new Error("no action checkbox found");
    expect(chk.disabled).toBe(false);
    chk.checked = true;
    chk.dispatchEvent(new Event("change"));
    await Promise.resolve();

    const acted = findAction("act_1");
    expect(acted.done).toBe(true);
    expect(acted.completedBy).toBe("u_client-a");
    expect(typeof acted.completedAt).toBe("string");
    // Re-render moved it into the Completed group
    expect(document.querySelector(".action-group-completed .action-row.done")).not.toBeNull();
  }, 20000);

  it("ticking the checkbox does not also expand the row (ACT-04)", async () => {
    await bootAs("u_internal-luke");
    const row = rowFor("act_1");
    expect(chevronFor("act_1").getAttribute("aria-expanded")).toBe("false");
    const chk = /** @type {HTMLInputElement} */ (row.querySelector("input[type='checkbox']"));
    chk.click();
    await Promise.resolve();
    // The row re-rendered as complete; what matters is that no panel opened.
    expect(document.querySelector(".action-panel")).toBeNull();
  }, 20000);

  it("clicking the row expands it and clicking again collapses it", async () => {
    await bootAs("u_internal-luke");
    rowFor("act_1").click();
    expect(chevronFor("act_1").getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelectorAll(".action-panel").length).toBe(1);
    rowFor("act_1").click();
    expect(chevronFor("act_1").getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector(".action-panel")).toBeNull();
  }, 20000);

  it("the disclosure is a real button, so the keyboard reaches it", async () => {
    await bootAs("u_internal-luke");
    const btn = chevronFor("act_1");
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.getAttribute("aria-label")).toContain("Show details");
    btn.click();
    expect(document.querySelectorAll(".action-panel").length).toBe(1);
    expect(chevronFor("act_1").getAttribute("aria-label")).toContain("Hide details");
  }, 20000);

  it("the row is not itself a button, so the checkbox inside stays reachable", async () => {
    await bootAs("u_internal-luke");
    expect(rowFor("act_1").getAttribute("role")).toBeNull();
  }, 20000);
});

describe("action plan — client edit surface (v6 ACT-07)", () => {
  it("client edits the wording, the owner and the pillar", async () => {
    await bootAs("u_client-a");
    const panel = expandRow("act_1");

    const title = fieldIn(panel, "Action");
    title.value = "Document the ICP properly";
    title.dispatchEvent(new Event("blur"));
    expect(findAction("act_1").title).toBe("Document the ICP properly");

    const notes = fieldIn(panel, "Notes");
    notes.value = "Firmographics, triggers and the two disqualifiers";
    notes.dispatchEvent(new Event("blur"));
    expect(findAction("act_1").description).toBe(
      "Firmographics, triggers and the two disqualifiers",
    );

    const owner = fieldIn(panel, "Owner");
    owner.value = "Priya";
    owner.dispatchEvent(new Event("blur"));
    expect(findAction("act_1").owner).toBe("Priya");

    const pillar = /** @type {HTMLSelectElement} */ (fieldIn(expandRow("act_1"), "Pillar"));
    pillar.value = "3";
    pillar.dispatchEvent(new Event("change"));
    expect(findAction("act_1").pillarId).toBe(3);
  }, 20000);

  it("client cannot change the due date — it stays with BeDeveloped", async () => {
    await bootAs("u_client-a");
    const due = fieldIn(expandRow("act_1"), "Due");
    expect(due.disabled).toBe(true);
  }, 20000);

  it("client gets no create and no delete", async () => {
    await bootAs("u_client-a");
    expandRow("act_1");
    const labels = Array.from(document.querySelectorAll("button")).map((b) =>
      (b.textContent || "").trim(),
    );
    expect(labels).not.toContain("+ New action");
    expect(labels).not.toContain("Paste multiple");
    expect(labels).not.toContain("Delete action");
  }, 20000);

  it("every edit stamps who made it (ACT-08)", async () => {
    await bootAs("u_client-a");
    const title = fieldIn(expandRow("act_1"), "Action");
    title.value = "Reworded by the client";
    title.dispatchEvent(new Event("blur"));
    const acted = findAction("act_1");
    expect(acted.lastEditedBy).toBe("u_client-a");
    expect(typeof acted.lastEditedAt).toBe("string");
  }, 20000);
});

describe("action plan — internal edit surface", () => {
  it("internal edits the title and the due date from the panel", async () => {
    await bootAs("u_internal-luke");
    const panel = expandRow("act_1");

    const title = fieldIn(panel, "Action");
    expect(title.disabled).toBe(false);
    title.value = "Sharpen ICP definition";
    title.dispatchEvent(new Event("blur"));
    expect(findAction("act_1").title).toBe("Sharpen ICP definition");

    const due = fieldIn(expandRow("act_1"), "Due");
    expect(due.disabled).toBe(false);
    due.value = "2027-03-01";
    due.dispatchEvent(new Event("change"));
    expect(findAction("act_1").due).toBe("2027-03-01");
  }, 20000);

  it("internal gets create, paste and delete", async () => {
    await bootAs("u_internal-luke");
    expandRow("act_1");
    const labels = Array.from(document.querySelectorAll("button")).map((b) =>
      (b.textContent || "").trim(),
    );
    expect(labels).toContain("+ New action");
    expect(labels).toContain("Paste multiple");
    expect(labels).toContain("Delete action");
  }, 20000);
});
