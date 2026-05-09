// tests/views/diagnostic.test.js
// @ts-check
// Phase 2 (TEST-10): file-snapshot of the diagnostic-index view rendered HTML.
// Phase 4 Wave 5 (D-03 retarget): now imports src/main.js (the renamed
// app.js IIFE) since app.js died in the cutover commit. Same boot pattern
// as dashboard.test.js, but after the IIFE renders the default dashboard,
// this test programmatically clicks the `[data-route="diagnostic"]` nav
// button to flip `state.route` (which is now imported from src/state.js
// per D-02) and trigger a re-render of the diagnostic view.
//
// Routing note: the IIFE has no hash router; `state.route` is owned by
// src/state.js (Wave 5 D-02 extraction). Click-to-navigate is the realistic
// path a real user would take, so this also exercises the topbar nav
// onclick handler end-to-end.
import { describe, it, expect, beforeEach, vi } from "vitest";
import snapshotOrg from "../fixtures/snapshot-org.json";

describe("Diagnostic view (TEST-10)", () => {
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

    // Click the diagnostic nav button to flip state.route -> "diagnostic" and
    // re-render. The button's onclick handler is `() => setRoute("diagnostic")`,
    // which calls render() inline (no async work).
    const diagBtn = /** @type {HTMLButtonElement|null} */ (
      document.querySelector('button[data-route="diagnostic"]')
    );
    if (!diagBtn) throw new Error("diagnostic nav button not found — boot failed");
    diagBtn.click();

    await Promise.resolve();
  });

  it("matches the diagnostic snapshot", async () => {
    const html = /** @type {HTMLElement} */ (document.getElementById("app")).innerHTML;
    await expect(html).toMatchFileSnapshot("../__snapshots__/views/diagnostic.html");
  });
});
