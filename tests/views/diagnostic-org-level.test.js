// tests/views/diagnostic-org-level.test.js
// @ts-check
// 2026-07 org-level re-shift: ONE shared diagnostic sheet per org per round.
// (a) The sheet is identical no matter which account the scope picker has
//     selected (state.accountId is context only).
// (b) Rounds are fully independent: starting a new round yields a blank sheet
//     while the previous round's answers stay intact under their roundId.
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
  window.location.hash = "#diagnostic";

  vi.resetModules();
  const mod = await import("../../src/main.js");
  await Promise.resolve();
  await Promise.resolve();

  const diagBtn = /** @type {HTMLButtonElement|null} */ (
    document.querySelector('button[data-route="diagnostic"]')
  );
  if (!diagBtn) throw new Error("diagnostic nav button not found — boot failed");
  diagBtn.click();
  await Promise.resolve();
  return mod;
}

function openFirstPillar() {
  const tile = /** @type {HTMLElement|null} */ (document.querySelector(".tiles .tile"));
  if (!tile) throw new Error("no pillar tile found");
  tile.click();
}

/** Snapshot of which likert figures are selected, per question card. */
function selectionFingerprint() {
  return Array.from(document.querySelectorAll(".q-card")).map((card) => {
    const sel = card.querySelector(".likert button.sel .n");
    return sel ? sel.textContent : null;
  });
}

describe("org-level diagnostic sheet", () => {
  it("shows the same answers regardless of which account is selected", async () => {
    await bootAs("u_internal-luke");
    openFirstPillar();
    const withDefaultSelection = selectionFingerprint();
    expect(withDefaultSelection.some((n) => n !== null)).toBe(true);

    // Re-boot and point the scope picker at the OTHER client account via the
    // real picker UI (the picker writes state.accountId then re-renders — the
    // diagnostic must not care).
    await bootAs("u_internal-luke");
    const scopeBtn = /** @type {HTMLButtonElement|null} */ (
      document.querySelector(".scope-btn")
    );
    if (scopeBtn) {
      scopeBtn.click();
      await Promise.resolve();
    }
    const acctBtns = Array.from(document.querySelectorAll(".scope-acct"));
    if (acctBtns.length >= 2) {
      /** @type {HTMLButtonElement} */ (acctBtns[1]).click();
      await Promise.resolve();
      const diagBtn = /** @type {HTMLButtonElement} */ (
        document.querySelector('button[data-route="diagnostic"]')
      );
      diagBtn.click();
      await Promise.resolve();
    }
    openFirstPillar();
    expect(selectionFingerprint()).toEqual(withDefaultSelection);
  }, 20000);

  it("client login sees the same org sheet read-only", async () => {
    await bootAs("u_internal-luke");
    openFirstPillar();
    const internalView = selectionFingerprint();

    await bootAs("u_client-b"); // NOT the account whose answers seeded the fixture
    openFirstPillar();
    expect(selectionFingerprint()).toEqual(internalView);
    expect(document.querySelector(".likert.read-only")).not.toBeNull();
  }, 20000);

  it("a new round starts blank and leaves the previous round's data intact", async () => {
    await bootAs("u_internal-luke");
    const orgId = snapshotOrg.orgMetas[0].id;
    const beforeRaw = /** @type {string} */ (localStorage.getItem(`baselayers:org:${orgId}`));
    const before = JSON.parse(beforeRaw);
    const prevRoundId = before.currentRoundId;
    const prevRoundData = JSON.stringify(before.responses[prevRoundId]);
    expect(prevRoundData).not.toBe("{}");

    // The diagnostic index round bar has the "+ New" round button.
    const newRoundBtn = Array.from(document.querySelectorAll("button")).find(
      (b) => (b.textContent || "").trim() === "+ New",
    );
    if (!newRoundBtn) throw new Error("+ New round button not found");
    newRoundBtn.click();
    await Promise.resolve();
    // Round creation goes through a confirm/prompt modal — accept defaults.
    const modalOk = Array.from(document.querySelectorAll("#modalRoot button")).find((b) =>
      /start|create|ok|new/i.test(b.textContent || ""),
    );
    if (modalOk) {
      /** @type {HTMLButtonElement} */ (modalOk).click();
      await Promise.resolve();
    }

    const after = JSON.parse(
      /** @type {string} */ (localStorage.getItem(`baselayers:org:${orgId}`)),
    );
    expect(after.currentRoundId).not.toBe(prevRoundId);
    expect(after.responses[after.currentRoundId] || {}).toEqual({});
    expect(JSON.stringify(after.responses[prevRoundId])).toBe(prevRoundData);

    openFirstPillar();
    expect(document.querySelector(".likert button.sel")).toBeNull();
  }, 20000);
});
