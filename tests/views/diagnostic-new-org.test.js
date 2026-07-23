// tests/views/diagnostic-new-org.test.js
// @ts-check
// Regression: on a freshly created organisation (no client accounts yet),
// an internal user's likert clicks must highlight and persist. Previously
// setResponse wrote under the internal user's id (viewedAccountId || user.id)
// while every read path used viewedAccountId alone, which is null with no
// accounts — so clicks saved under one key and rendered from another, and
// the blue `sel` highlight never appeared. Boot pattern mirrors
// tests/views/diagnostic-client-readonly.test.js with a fixture org shaped
// like createOrg() output and internal-only users.
import { describe, it, expect, vi } from "vitest";
import snapshotOrg from "../fixtures/snapshot-org.json";

const FRESH_ORG = {
  id: "org_fresh",
  name: "Fresh Org",
  createdAt: "2026-07-01T10:00:00.000Z",
  currentRoundId: "r_fresh-1",
  rounds: [{ id: "r_fresh-1", label: "Round 1", createdAt: "2026-07-01T10:00:00.000Z" }],
  responses: { "r_fresh-1": {} },
  internalNotes: {},
  actions: [],
  engagement: { currentStageId: "diagnosed" },
  comments: {},
  readStates: {},
};

async function bootInternalOnFreshOrg() {
  /** @type {*} */ (window).BASE_LAYERS = {
    pillars: snapshotOrg.pillars,
    engagementStages: snapshotOrg.engagementStages,
    scoreLabels: snapshotOrg.scoreLabels,
    principles: snapshotOrg.principles,
  };
  /** @type {*} */ (window).FB = { ready: false, currentUser: null, db: null };

  localStorage.clear();
  localStorage.setItem(
    "baselayers:orgs",
    JSON.stringify([{ id: FRESH_ORG.id, name: FRESH_ORG.name }]),
  );
  localStorage.setItem(`baselayers:org:${FRESH_ORG.id}`, JSON.stringify(FRESH_ORG));
  const internalUsers = snapshotOrg.users.filter((/** @type {*} */ u) => u.role === "internal");
  localStorage.setItem("baselayers:users", JSON.stringify(internalUsers));
  localStorage.setItem("baselayers:session", JSON.stringify({ userId: "u_internal-luke" }));
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

function openFirstPillar() {
  const tile = /** @type {HTMLElement|null} */ (document.querySelector(".tiles .tile"));
  if (!tile) throw new Error("no pillar tile found");
  tile.click();
}

describe("new organisation with no client accounts", () => {
  it("internal user's likert click highlights the chosen score", async () => {
    await bootInternalOnFreshOrg();
    openFirstPillar();

    expect(document.querySelector(".likert button.sel")).toBeNull();
    const btn = /** @type {HTMLButtonElement|null} */ (
      document.querySelector(".likert button")
    );
    if (!btn) throw new Error("no likert button found");
    const clickedN = btn.querySelector(".n")?.textContent;
    btn.click();
    await Promise.resolve();

    // render() rebuilds the DOM — re-query rather than reuse the stale node
    const sel = /** @type {HTMLButtonElement|null} */ (
      document.querySelector(".likert button.sel")
    );
    expect(sel).not.toBeNull();
    expect(sel?.querySelector(".n")?.textContent).toBe(clickedN);
  }, 20000);

  it("saved score is read back from the same account key it was written under", async () => {
    await bootInternalOnFreshOrg();
    openFirstPillar();

    const btn = /** @type {HTMLButtonElement|null} */ (
      document.querySelector(".likert button")
    );
    if (!btn) throw new Error("no likert button found");
    btn.click();
    await Promise.resolve();

    const org = JSON.parse(
      /** @type {string} */ (localStorage.getItem(`baselayers:org:${FRESH_ORG.id}`)),
    );
    const roundResponses = org.responses[FRESH_ORG.currentRoundId] || {};
    const keys = Object.keys(roundResponses);
    expect(keys).toHaveLength(1);
    expect(keys[0]).not.toBe("null");
    // The rendered selection must come from that same bucket
    expect(document.querySelector(".likert button.sel")).not.toBeNull();
  }, 20000);
});
