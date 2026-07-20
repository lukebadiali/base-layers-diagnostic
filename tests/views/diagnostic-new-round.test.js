// tests/views/diagnostic-new-round.test.js
// @ts-check
// The diagnostic index gets its own "+ Start new round" button (internal
// users only) so consultants can open a fresh scoring round without a
// detour via the dashboard round bar. Boot pattern mirrors
// tests/views/diagnostic-client-readonly.test.js.
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
  window.location.hash = "#diagnostic";

  vi.resetModules();
  await import("../../src/main.js");
  await Promise.resolve();
  await Promise.resolve();

  const diagBtn = /** @type {HTMLButtonElement|null} */ (
    document.querySelector('button[data-route="diagnostic"]')
  );
  if (!diagBtn) throw new Error("diagnostic nav button not found — boot failed");
  diagBtn.click();
  await Promise.resolve();
}

/** @returns {HTMLButtonElement|null} */
function newRoundButton() {
  const wrap = document.querySelector(".round-select-wrap");
  if (!wrap) return null;
  return /** @type {HTMLButtonElement|null} */ (
    Array.from(wrap.querySelectorAll("button")).find(
      (b) => (b.textContent || "").trim() === "+ New",
    ) || null
  );
}

describe("diagnostic new-round button", () => {
  it("internal user sees the button next to the round dropdown", async () => {
    await bootAs("u_internal-luke");
    expect(newRoundButton()).not.toBeNull();
  }, 20000);

  it("client view has no round controls at all", async () => {
    await bootAs("u_client-a");
    expect(document.querySelector(".round-select-wrap")).toBeNull();
  }, 20000);

  it("confirming creates a fresh round, selects it, and unpins the viewed round", async () => {
    await bootAs("u_internal-luke");
    const { state } = await import("../../src/state.js");

    // Pin the view to the historic round first so the reset is observable.
    const sel = /** @type {HTMLSelectElement|null} */ (document.querySelector(".round-select"));
    if (!sel) throw new Error("round select not found");
    sel.value = "r_round-1";
    sel.dispatchEvent(new Event("change"));
    await Promise.resolve();
    expect(state.viewRoundId).toBe("r_round-1");

    const btn = newRoundButton();
    if (!btn) throw new Error("new-round button not found");
    btn.click();

    const modalEl = /** @type {HTMLElement|null} */ (document.querySelector("#modalRoot .modal"));
    if (!modalEl) throw new Error("confirm modal did not open");
    expect(modalEl.textContent).toContain("Start new assessment round?");
    const ok = /** @type {HTMLButtonElement|undefined} */ (
      Array.from(modalEl.querySelectorAll("button")).find(
        (b) => (b.textContent || "").trim() === "Start new round",
      )
    );
    if (!ok) throw new Error("confirm button not found");
    ok.click();
    await Promise.resolve();

    const orgId = snapshotOrg.orgMetas[0].id;
    const org = JSON.parse(/** @type {string} */ (localStorage.getItem(`baselayers:org:${orgId}`)));
    expect(org.rounds.length).toBe(3);
    const newRound = org.rounds[2];
    expect(newRound.label).toBe("Round 3");
    expect(org.currentRoundId).toBe(newRound.id);
    expect(org.responses[newRound.id]).toEqual({});

    // View unpinned + dropdown re-rendered with the fresh round selected.
    expect(state.viewRoundId).toBeNull();
    const sel2 = /** @type {HTMLSelectElement|null} */ (document.querySelector(".round-select"));
    if (!sel2) throw new Error("round select not found after re-render");
    expect(sel2.options.length).toBe(3);
    expect(sel2.value).toBe(newRound.id);
  }, 20000);
});
