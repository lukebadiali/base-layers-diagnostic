// tests/views/actions-client-toggle.test.js
// @ts-check
// 2026-07: both clients and staff complete actions by clicking the row
// checkbox. Clients get ONLY the toggle — title/owner/due are read-only and
// there is no delete button or "+ New action" (firestore.rules limits client
// action writes to done/completedAt/completedBy on non-internal actions).
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

describe("action plan — client completion", () => {
  it("client checkbox toggle persists done + completion audit fields", async () => {
    await bootAs("u_client-a");
    const firstRow = /** @type {HTMLElement|null} */ (
      document.querySelector(".actions-table .action-row:not(.done) input[type='checkbox']")
        ?.parentElement || null
    );
    const chk = /** @type {HTMLInputElement|null} */ (
      document.querySelector(".actions-table .action-row input[type='checkbox']")
    );
    if (!chk || !firstRow) throw new Error("no action checkbox found");
    expect(chk.disabled).toBe(false);
    chk.checked = true;
    chk.dispatchEvent(new Event("change"));
    await Promise.resolve();

    const acted = storedOrg().actions.find((/** @type {*} */ a) => a.id === "act_1");
    expect(acted.done).toBe(true);
    expect(acted.completedBy).toBe("u_client-a");
    expect(typeof acted.completedAt).toBe("string");
    // Re-render moved it into the Completed section
    expect(document.querySelector(".action-row.done")).not.toBeNull();
  }, 20000);

  it("client rows are otherwise read-only: no edits, no delete, no create", async () => {
    await bootAs("u_client-a");
    const title = /** @type {HTMLInputElement|null} */ (document.querySelector(".a-title"));
    const owner = /** @type {HTMLInputElement|null} */ (document.querySelector(".a-owner"));
    const due = /** @type {HTMLInputElement|null} */ (document.querySelector(".a-due"));
    expect(title?.disabled).toBe(true);
    expect(owner?.disabled).toBe(true);
    expect(due?.disabled).toBe(true);
    const labels = Array.from(document.querySelectorAll("button")).map((b) =>
      (b.textContent || "").trim(),
    );
    expect(labels).not.toContain("+ New action");
    expect(labels).not.toContain("×");
  }, 20000);

  it("internal keeps full edit: title change persists and delete button renders", async () => {
    await bootAs("u_internal-luke");
    const title = /** @type {HTMLInputElement|null} */ (document.querySelector(".a-title"));
    if (!title) throw new Error("no title input found");
    expect(title.disabled).toBe(false);
    title.value = "Sharpen ICP definition";
    title.dispatchEvent(new Event("blur"));
    await Promise.resolve();
    const acted = storedOrg().actions.find((/** @type {*} */ a) => a.id === "act_1");
    expect(acted.title).toBe("Sharpen ICP definition");
    const labels = Array.from(document.querySelectorAll("button")).map((b) =>
      (b.textContent || "").trim(),
    );
    expect(labels).toContain("+ New action");
    expect(labels).toContain("×");
  }, 20000);
});
