// tests/views/documents-marker.test.js
// @ts-check
// Scope item 7 (2026-07): renderDocuments writes the docsLastSeen marker for
// the current user/org the moment the Documents view renders — this is what
// clears the bell's per-org document-activity count. Boot pattern mirrors
// tests/views/stages-static.test.js (default staff session from the
// snapshot fixture, FB.ready=false since Firestore isn't wired up in tests).
import { describe, it, expect, beforeEach, vi } from "vitest";
import snapshotOrg from "../fixtures/snapshot-org.json";

describe("Documents view writes the docsLastSeen marker", () => {
  beforeEach(async () => {
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
    localStorage.setItem("baselayers:session", JSON.stringify(snapshotOrg.session));
    localStorage.setItem("baselayers:settings", JSON.stringify(snapshotOrg.settings));

    document.body.innerHTML = '<div id="app"></div><div id="modalRoot"></div>';
    window.location.hash = "#diagnostic";

    vi.resetModules();
    await import("../../src/main.js");
    await Promise.resolve();
    await Promise.resolve();
  }, 20000);

  it("sets the fixture org's docsLastSeen entry to a parseable date when Documents renders", async () => {
    const userId = snapshotOrg.session.userId;
    const orgId = snapshotOrg.orgMetas[0].id;

    const docsBtn = /** @type {HTMLButtonElement|null} */ (
      document.querySelector('button[data-route="documents"]')
    );
    if (!docsBtn) throw new Error("documents nav button not found — boot failed");
    docsBtn.click();
    await Promise.resolve();

    const raw = localStorage.getItem(`baselayers:docsLastSeen:${userId}`);
    expect(raw).not.toBeNull();
    const map = JSON.parse(/** @type {string} */ (raw));
    expect(map[orgId]).toBeTruthy();
    expect(Number.isNaN(new Date(map[orgId]).getTime())).toBe(false);
  }, 20000);
});
