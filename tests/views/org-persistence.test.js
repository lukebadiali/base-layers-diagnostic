// tests/views/org-persistence.test.js
// @ts-check
// 2026-10 bug: "all the folders I created disappeared when I refreshed the
// page, including the document I moved into them."
//
// Nothing was lost. The staff org selection (state.orgId) lived only in memory,
// and init() fell back to loadOrgMetas()[0] on every boot — so a refresh
// silently moved the user into whichever org happened to be first, which had no
// folders and not the file they had just filed.
//
// It had been that way since the org picker shipped. It only became alarming
// when v6 added folders, because "my folders are gone" is a far more frightening
// reading than "the org picker reset".
//
// The fix persists the selection under baselayers:activeOrg, written from
// activeOrgForUser so no assignment site can forget it — including the scope
// picker, which lives in a different module (src/ui/chrome.js).
import { describe, it, expect, vi, beforeEach } from "vitest";
import snapshotOrg from "../fixtures/snapshot-org.json";

const KEY = "baselayers:activeOrg";
const ORG_A = snapshotOrg.orgMetas[0].id;
const ORG_B = "org_test-2";

/** Two orgs, so "first in the list" and "the one I chose" can differ. */
function seedTwoOrgs() {
  const metas = [...snapshotOrg.orgMetas, { id: ORG_B, name: "Second Org" }];
  localStorage.setItem("baselayers:orgs", JSON.stringify(metas));
  snapshotOrg.orgs.forEach((/** @type {*} */ o) => {
    localStorage.setItem(`baselayers:org:${o.id}`, JSON.stringify(o));
  });
  localStorage.setItem(
    `baselayers:org:${ORG_B}`,
    JSON.stringify({ ...snapshotOrg.orgs[0], id: ORG_B, name: "Second Org" }),
  );
  localStorage.setItem("baselayers:users", JSON.stringify(snapshotOrg.users));
  localStorage.setItem("baselayers:settings", JSON.stringify(snapshotOrg.settings));
}

/**
 * Boot the app as a given user, preserving localStorage (i.e. a reload).
 * @param {string} userId
 */
async function boot(userId) {
  /** @type {*} */ (window).BASE_LAYERS = {
    pillars: snapshotOrg.pillars,
    engagementStages: snapshotOrg.engagementStages,
    scoreLabels: snapshotOrg.scoreLabels,
    principles: snapshotOrg.principles,
  };
  /** @type {*} */ (window).FB = { ready: false, currentUser: null, db: null };
  localStorage.setItem("baselayers:session", JSON.stringify({ userId }));
  document.body.innerHTML =
    '<div id="app"></div><div id="modalRoot"></div><div id="toastRoot"></div>';
  window.location.hash = "#documents";
  vi.resetModules();
  await import("../../src/main.js");
  await Promise.resolve();
  await Promise.resolve();
}

/** The org name the topbar's scope picker is showing. */
function shownOrg() {
  return (document.querySelector(".scope-org-name")?.textContent || "").trim();
}

beforeEach(() => {
  localStorage.clear();
  seedTwoOrgs();
});

describe("staff org selection survives a reload", () => {
  it("remembers the chosen org instead of snapping back to the first", async () => {
    await boot("u_internal-luke");
    // First boot with nothing remembered picks the first org, and records it.
    expect(JSON.parse(/** @type {string} */ (localStorage.getItem(KEY)))).toBe(ORG_A);

    // The user switches org — this is what the scope picker does.
    localStorage.setItem(KEY, JSON.stringify(ORG_B));

    // Reload: localStorage survives, in-memory state does not.
    await boot("u_internal-luke");
    expect(shownOrg()).toBe("Second Org");
  });

  it("records the selection on first resolve so there is something to restore", async () => {
    expect(localStorage.getItem(KEY)).toBeNull();
    await boot("u_internal-luke");
    expect(localStorage.getItem(KEY)).not.toBeNull();
  });

  it("falls back to the first org when the remembered one no longer exists", async () => {
    // An org deleted since, or one belonging to a different signed-in user. A
    // stale id must not strand the picker on something that cannot load.
    localStorage.setItem(KEY, JSON.stringify("org_deleted-long-ago"));
    await boot("u_internal-luke");
    expect(shownOrg()).toBe("Test Org");
    expect(JSON.parse(/** @type {string} */ (localStorage.getItem(KEY)))).toBe(ORG_A);
  });

  it("tolerates a corrupt stored value", async () => {
    localStorage.setItem(KEY, "{not json");
    await boot("u_internal-luke");
    expect(shownOrg()).toBe("Test Org");
  });

  it("does not apply to clients, whose org is pinned by their claims", async () => {
    // A client's org comes from user.orgId; the remembered staff selection must
    // never override it, or a client could be shown another org's data. Clients
    // get no scope picker, so assert on the Documents subtitle, which names the
    // org whose files are being shown.
    localStorage.setItem(KEY, JSON.stringify(ORG_B));
    await boot("u_client-a");
    // The footer names the active org on every route, so it is the stable
    // assertion — a client lands on the dashboard, not wherever the hash said.
    const footer = (document.querySelector(".footer")?.textContent || "").trim();
    expect(footer).toContain("Test Org");
    expect(footer).not.toContain("Second Org");
  });
});
