// tests/views/diagnostic-historic-round.test.js
// @ts-check
// Milestone v6 (DIA-01 / DIA-02 / DIA-03): an internal user can change scores
// in any round, and every screen that lets them says which round they are in.
//
// The capability was already there before this milestone — activeRoundId()
// honours state.viewRoundId, the likert buttons are disabled for clients only,
// and setResponse writes to whichever round is in view. What these tests fence
// is the part that was missing: that a historic round announces itself, that
// the picker follows the user into a pillar, and — the one that actually
// protects client data — that a write against a historic round lands in that
// round's sheet and leaves the current round alone.
import { describe, it, expect, vi } from "vitest";
import snapshotOrg from "../fixtures/snapshot-org.json";

const ORG_ID = snapshotOrg.orgMetas[0].id;
const HISTORIC_ROUND = "r_round-1";
const CURRENT_ROUND = "r_round-2";

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
  window.location.hash = "#diagnostic";

  vi.resetModules();
  await import("../../src/main.js");
  await Promise.resolve();
  await Promise.resolve();

  const btn = /** @type {HTMLButtonElement|null} */ (
    document.querySelector('button[data-route="diagnostic"]')
  );
  if (!btn) throw new Error("diagnostic nav button not found — boot failed");
  btn.click();
  await Promise.resolve();
}

/** @returns {*} */
function storedOrg() {
  return JSON.parse(/** @type {string} */ (localStorage.getItem(`baselayers:org:${ORG_ID}`)));
}

function roundSelect() {
  return /** @type {HTMLSelectElement|null} */ (document.querySelector(".round-select"));
}

/** @param {string} roundId */
function pickRound(roundId) {
  const sel = roundSelect();
  if (!sel) throw new Error("no round select on screen");
  sel.value = roundId;
  sel.dispatchEvent(new Event("change"));
}

/** Open the first pillar's detail page. */
function openPillarOne() {
  const tile = /** @type {HTMLElement|null} */ (document.querySelector(".tiles .tile"));
  if (!tile) throw new Error("no pillar tile");
  tile.click();
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
 * Score the first question of the open pillar with the given figure.
 * @param {number} figure
 */
function scoreFirstQuestion(figure) {
  const buttons = Array.from(document.querySelectorAll(".q-card .likert button"));
  const btn = buttons.find((b) => (b.querySelector(".n")?.textContent || "") === String(figure));
  if (!btn) throw new Error(`no likert button for ${figure}`);
  /** @type {HTMLButtonElement} */ (btn).click();
}

/**
 * @param {string} roundId
 * @param {number} pillarId
 * @param {number} idx
 */
function scoreIn(roundId, pillarId, idx) {
  return ((storedOrg().responses || {})[roundId] || {})[pillarId]?.[idx]?.score;
}

describe("diagnostic — round context (DIA-02)", () => {
  it("names the round on the diagnostic index and marks nothing historic by default", async () => {
    await bootAs("u_internal-luke");
    expect(roundSelect()?.value).toBe(CURRENT_ROUND);
    expect(document.querySelector(".round-historic")).toBeNull();
    expect(document.querySelector(".round-historic-tag")).toBeNull();
  }, 20000);

  it("says so in words once a historic round is picked", async () => {
    await bootAs("u_internal-luke");
    pickRound(HISTORIC_ROUND);
    expect(document.querySelector(".round-historic")).not.toBeNull();
    const tag = (document.querySelector(".round-historic-tag")?.textContent || "").trim();
    expect(tag).toContain("historic round");
    expect(tag).toContain("do not affect the current round");
  }, 20000);

  it("carries the round context into the pillar page", async () => {
    await bootAs("u_internal-luke");
    pickRound(HISTORIC_ROUND);
    openPillarOne();
    // The picker followed the user in, still on the historic round and still
    // saying so. Before v6 the pillar page showed nothing at all.
    expect(roundSelect()?.value).toBe(HISTORIC_ROUND);
    expect(document.querySelector(".round-historic-tag")).not.toBeNull();
  }, 20000);

  it("Back to current unpins the round", async () => {
    await bootAs("u_internal-luke");
    pickRound(HISTORIC_ROUND);
    clickButton("Back to current");
    expect(roundSelect()?.value).toBe(CURRENT_ROUND);
    expect(document.querySelector(".round-historic-tag")).toBeNull();
  }, 20000);

  it("keeps the start-new-round button available while viewing history", async () => {
    await bootAs("u_internal-luke");
    pickRound(HISTORIC_ROUND);
    expect(document.querySelector(".round-new-btn")).not.toBeNull();
  }, 20000);

  it("clients see no round picker at all", async () => {
    await bootAs("u_client-a");
    expect(roundSelect()).toBeNull();
  }, 20000);
});

describe("diagnostic — editing a historic round (DIA-01 / DIA-03)", () => {
  it("asks for confirmation the first time, then writes to the historic round", async () => {
    await bootAs("u_internal-luke");
    const currentBefore = scoreIn(CURRENT_ROUND, 1, 0);

    pickRound(HISTORIC_ROUND);
    openPillarOne();
    scoreFirstQuestion(4);

    // Nothing is written until the user says they mean it
    expect(document.querySelector("#modalRoot h3")?.textContent).toContain("historic round");
    expect(scoreIn(HISTORIC_ROUND, 1, 0)).not.toBe(4);

    clickButton("Yes, edit it");
    await Promise.resolve();

    expect(scoreIn(HISTORIC_ROUND, 1, 0)).toBe(4);
    // DIA-03: the current round is untouched
    expect(scoreIn(CURRENT_ROUND, 1, 0)).toBe(currentBefore);
  }, 20000);

  it("asks once per round, not once per click", async () => {
    await bootAs("u_internal-luke");
    pickRound(HISTORIC_ROUND);
    openPillarOne();

    scoreFirstQuestion(4);
    clickButton("Yes, edit it");
    await Promise.resolve();

    scoreFirstQuestion(5);
    // No second dialogue — the score just changes
    expect(document.querySelector("#modalRoot h3")).toBeNull();
    expect(scoreIn(HISTORIC_ROUND, 1, 0)).toBe(5);
  }, 20000);

  it("never asks when the current round is the one on screen", async () => {
    await bootAs("u_internal-luke");
    openPillarOne();
    scoreFirstQuestion(4);
    expect(document.querySelector("#modalRoot h3")).toBeNull();
    expect(scoreIn(CURRENT_ROUND, 1, 0)).toBe(4);
  }, 20000);

  it("a historic write does not disturb the other round's other answers", async () => {
    await bootAs("u_internal-luke");
    const currentSheet = JSON.stringify((storedOrg().responses || {})[CURRENT_ROUND]);

    pickRound(HISTORIC_ROUND);
    openPillarOne();
    scoreFirstQuestion(2);
    clickButton("Yes, edit it");
    await Promise.resolve();

    expect(JSON.stringify((storedOrg().responses || {})[CURRENT_ROUND])).toBe(currentSheet);
  }, 20000);
});
