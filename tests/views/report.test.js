// tests/views/report.test.js
// @ts-check
// Phase 2 (TEST-10): file-snapshot of the report view rendered HTML —
// pre-Phase-4 baseline. Same boot pattern as dashboard.test.js, then click
// the `[data-route="report"]` nav button to flip `state.route` (private to
// the IIFE) and re-render the report view.
import { describe, it, expect, beforeEach, vi } from "vitest";
import snapshotOrg from "../fixtures/snapshot-org.json";

describe("Report view (TEST-10)", () => {
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
    window.location.hash = "#report";

    vi.resetModules();
    await import("../../app.js");

    await Promise.resolve();
    await Promise.resolve();

    // Click the report nav button to flip state.route -> "report" and re-render.
    const reportBtn = /** @type {HTMLButtonElement|null} */ (
      document.querySelector('button[data-route="report"]')
    );
    if (!reportBtn) throw new Error("report nav button not found — boot failed");
    reportBtn.click();

    await Promise.resolve();
  });

  it("matches the report snapshot", async () => {
    const html = /** @type {HTMLElement} */ (document.getElementById("app")).innerHTML;
    await expect(html).toMatchFileSnapshot("../__snapshots__/views/report.html");
  });
});
