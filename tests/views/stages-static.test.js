// tests/views/stages-static.test.js
// @ts-check
// Delivery-framework stage cards are static info cards: no click-to-select,
// no active highlight, for staff as well as clients. Boot pattern mirrors
// tests/views/diagnostic.test.js (internal session from the snapshot fixture).
import { describe, it, expect, beforeEach, vi } from "vitest";
import snapshotOrg from "../fixtures/snapshot-org.json";

describe("Delivery stage cards are static", () => {
  beforeEach(async () => {
    /** @type {*} */ (window).BASE_LAYERS = {
      pillars: snapshotOrg.pillars,
      engagementStages: snapshotOrg.engagementStages,
      scoreLabels: snapshotOrg.scoreLabels,
      principles: snapshotOrg.principles,
    };
    /** @type {*} */ (window).FB = { ready: false, currentUser: null, db: null };

    localStorage.setItem("baselayers:orgs", JSON.stringify(snapshotOrg.orgMetas));
    snapshotOrg.orgs.forEach((/** @type {*} */ o) => {
      localStorage.setItem(`baselayers:org:${o.id}`, JSON.stringify(o));
    });
    localStorage.setItem("baselayers:users", JSON.stringify(snapshotOrg.users));
    localStorage.setItem("baselayers:session", JSON.stringify(snapshotOrg.session));
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
  }, 20000);

  it("renders four stage cards with no active or read-only variant", () => {
    const cards = document.querySelectorAll(".stage-card");
    expect(cards.length).toBe(4);
    cards.forEach((card) => {
      expect(card.className).toBe("stage-card");
    });
  });

  it("clicking a stage card does not highlight it or write engagement state", () => {
    const orgId = snapshotOrg.orgMetas[0].id;
    const before = localStorage.getItem(`baselayers:org:${orgId}`);
    const card = /** @type {HTMLElement} */ (document.querySelector(".stage-card"));
    card.click();
    expect(document.querySelectorAll(".stage-card.active").length).toBe(0);
    expect(localStorage.getItem(`baselayers:org:${orgId}`)).toBe(before);
  });
});
