// tests/views/dashboard.test.js
// @ts-check
// Phase 2 (TEST-10): file-snapshot of dashboard view rendered HTML —
// pre-Phase-4 baseline. Drives app.js end-to-end under happy-dom: seed
// localStorage from tests/fixtures/snapshot-org.json, attach BASE_LAYERS +
// FB stub, dynamically import app.js with a cachebust query string so the
// IIFE re-runs against a fresh `state` object, then snapshot the rendered
// `#app` innerHTML to tests/__snapshots__/views/dashboard.html via
// toMatchFileSnapshot (D-08).
//
// Routing note: the IIFE owns `state.route` privately; there is no hash
// router. The default route is "dashboard" so this test snapshots the
// initial render. diagnostic.test.js + report.test.js click the nav buttons
// to switch route.
import { describe, it, expect, beforeEach, vi } from "vitest";
import snapshotOrg from "../fixtures/snapshot-org.json";

describe("Dashboard view (TEST-10)", () => {
  beforeEach(async () => {
    // Inject DATA + FB stub BEFORE app.js boots (the IIFE captures both at
    // top-of-IIFE on every re-import).
    /** @type {*} */ (window).BASE_LAYERS = {
      pillars: snapshotOrg.pillars,
      engagementStages: snapshotOrg.engagementStages,
      scoreLabels: snapshotOrg.scoreLabels,
      principles: snapshotOrg.principles,
    };
    /** @type {*} */ (window).FB = { ready: false, currentUser: null, db: null };

    // Seed localStorage from fixture.
    localStorage.setItem("baselayers:orgs", JSON.stringify(snapshotOrg.orgMetas));
    snapshotOrg.orgs.forEach((/** @type {*} */ o) => {
      localStorage.setItem(`baselayers:org:${o.id}`, JSON.stringify(o));
    });
    localStorage.setItem("baselayers:users", JSON.stringify(snapshotOrg.users));
    localStorage.setItem("baselayers:session", JSON.stringify(snapshotOrg.session));
    localStorage.setItem("baselayers:settings", JSON.stringify(snapshotOrg.settings));

    // Reset DOM to a known shell so each run starts identically.
    document.body.innerHTML = '<div id="app"></div><div id="modalRoot"></div>';
    window.location.hash = "#dashboard";

    // Reset module cache so app.js IIFE re-runs against a fresh `state`.
    // Vite rejects template-literal cachebust paths ("Unknown variable
    // dynamic import"); vi.resetModules() is the documented Vitest 4 path.
    vi.resetModules();
    await import("../../app.js");

    // Drain microtasks so init() -> render() finishes. setTimeout is faked
    // (tests/setup.js), so use queueMicrotask + Promise.resolve, not
    // setTimeout(...,0) which would block until vi.advanceTimers.
    await Promise.resolve();
    await Promise.resolve();
  });

  it("matches the dashboard snapshot", async () => {
    const html = /** @type {HTMLElement} */ (document.getElementById("app")).innerHTML;
    await expect(html).toMatchFileSnapshot("../__snapshots__/views/dashboard.html");
  });
});
