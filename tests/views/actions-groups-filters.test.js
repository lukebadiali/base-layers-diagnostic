// tests/views/actions-groups-filters.test.js
// @ts-check
// Milestone v6 (ACT-01 / ACT-02 / ACT-03): the Actions tab groups into
// Overdue, Current and Completed in that order, and filters by pillar, owner
// and due date.
//
// The domain rules themselves are proved in tests/domain/action-grouping.js
// and tests/domain/action-filters.js. What this file proves is the wiring: the
// groups render in the stated order, the filter bar is built from the actions
// actually present, and a filter narrows the list rather than the list within
// each group — a filtered "Overdue" must empty Completed, not leave a
// populated Completed section under an Overdue filter.
import { describe, it, expect, vi } from "vitest";
import snapshotOrg from "../fixtures/snapshot-org.json";

const ORG_ID = snapshotOrg.orgMetas[0].id;

// Dates are computed INSIDE the test, never at module scope.
//
// tests/setup.js installs fake timers in beforeEach, pinned to 2026-01-01. A
// fixture built at module load is therefore built against the real wall clock,
// while the app under test reads the frozen one — so "thirty days ago"
// silently becomes eight months in the future and every overdue case passes
// through as Current. The bug is invisible: the fixture looks right, the
// domain unit tests pass, and only the rendered grouping disagrees.
/** @param {number} days @returns {string} YYYY-MM-DD relative to the clock in force */
function isoOffset(days) {
  const d = new Date(Date.now() + days * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** A deliberately mixed set: one per group, plus the undated edge case. */
function makeActions() {
  return [
    {
      id: "a_late",
      title: "Long overdue",
      pillarId: 1,
      owner: "Jane",
      due: isoOffset(-30),
      done: false,
      internal: false,
      createdAt: "2025-10-01T00:00:00.000Z",
      createdBy: "u_internal-luke",
    },
    {
      id: "a_soon",
      title: "Due shortly",
      pillarId: 2,
      owner: "Sam",
      due: isoOffset(3),
      done: false,
      internal: false,
      createdAt: "2025-11-01T00:00:00.000Z",
      createdBy: "u_internal-luke",
    },
    {
      id: "a_undated",
      title: "No date at all",
      pillarId: null,
      owner: "",
      due: "",
      done: false,
      internal: false,
      createdAt: "2025-12-01T00:00:00.000Z",
      createdBy: "u_internal-luke",
    },
    {
      id: "a_done",
      title: "Finished long ago",
      pillarId: 1,
      owner: "Jane",
      due: isoOffset(-90),
      done: true,
      completedAt: "2025-12-15T00:00:00.000Z",
      completedBy: "u_internal-luke",
      internal: false,
      createdAt: "2025-10-01T00:00:00.000Z",
      createdBy: "u_internal-luke",
    },
  ];
}

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
    localStorage.setItem(
      `baselayers:org:${o.id}`,
      JSON.stringify(o.id === ORG_ID ? { ...o, actions: makeActions() } : o),
    );
  });
  localStorage.setItem("baselayers:users", JSON.stringify(snapshotOrg.users));
  localStorage.setItem("baselayers:session", JSON.stringify({ userId }));
  localStorage.setItem("baselayers:settings", JSON.stringify(snapshotOrg.settings));

  document.body.innerHTML =
    '<div id="app"></div><div id="modalRoot"></div><div id="toastRoot"></div>';
  window.location.hash = "#actions";

  vi.resetModules();
  await import("../../src/main.js");
  await Promise.resolve();
  await Promise.resolve();

  const btn = /** @type {HTMLButtonElement|null} */ (
    document.querySelector('button[data-route="actions"]')
  );
  if (!btn) throw new Error("actions nav button not found — boot failed");
  btn.click();
  await Promise.resolve();
}

/**
 * Ids rendered under a given group, in render order.
 * @param {string} groupKey
 */
function idsIn(groupKey) {
  return Array.from(
    document.querySelectorAll(`.action-group-${groupKey} .action-row[data-action-id]`),
  ).map((r) => r.getAttribute("data-action-id"));
}

/** @param {string} label */
function filterSelect(label) {
  const wrap = Array.from(document.querySelectorAll(".action-filter")).find(
    (f) => (f.querySelector(".action-filter-label")?.textContent || "").trim() === label,
  );
  if (!wrap) throw new Error(`no "${label}" filter`);
  return /** @type {HTMLSelectElement} */ (wrap.querySelector("select"));
}

/** @param {string} label @param {string} value */
function setFilter(label, value) {
  const sel = filterSelect(label);
  sel.value = value;
  sel.dispatchEvent(new Event("change"));
}

function bannerText() {
  return (document.querySelector(".stage-section-banner div")?.textContent || "").trim();
}

describe("action plan — grouping (ACT-01 / ACT-02)", () => {
  it("renders exactly three groups, in the order Overdue, Current, Completed", async () => {
    await bootAs("u_internal-luke");
    const titles = Array.from(document.querySelectorAll(".action-group-title")).map((t) =>
      (t.textContent || "").trim(),
    );
    expect(titles).toEqual(["Overdue", "Current", "Completed"]);
  }, 20000);

  it("routes each action to its group, with undated work in Current", async () => {
    await bootAs("u_internal-luke");
    expect(idsIn("overdue")).toEqual(["a_late"]);
    expect(idsIn("current")).toEqual(["a_soon", "a_undated"]);
    expect(idsIn("completed")).toEqual(["a_done"]);
  }, 20000);

  it("keeps a completed action out of Overdue however far past its date", async () => {
    await bootAs("u_internal-luke");
    expect(idsIn("overdue")).not.toContain("a_done");
  }, 20000);

  it("orders Current by soonest due date, undated last", async () => {
    await bootAs("u_internal-luke");
    expect(idsIn("current")).toEqual(["a_soon", "a_undated"]);
  }, 20000);

  it("shows the count on each group header", async () => {
    await bootAs("u_internal-luke");
    const counts = Array.from(document.querySelectorAll(".action-group-count")).map((c) =>
      (c.textContent || "").trim(),
    );
    expect(counts).toEqual(["1", "2", "1"]);
  }, 20000);
});

describe("action plan — filters (ACT-03)", () => {
  it("builds the pillar filter from the pillars in use, plus No pillar", async () => {
    await bootAs("u_internal-luke");
    const opts = Array.from(filterSelect("Pillar").options).map((o) => o.value);
    expect(opts[0]).toBe("all");
    expect(opts).toContain("1");
    // a_undated has no pillar, so the Unassigned option is offered
    expect(opts).toContain("none");
  }, 20000);

  it("builds the owner filter from the owners actually present", async () => {
    await bootAs("u_internal-luke");
    const opts = Array.from(filterSelect("Owner").options).map((o) => o.value);
    expect(opts).toEqual(["all", "Jane", "Sam", "none"]);
  }, 20000);

  it("filters by pillar across every group", async () => {
    await bootAs("u_internal-luke");
    setFilter("Pillar", "1");
    expect(idsIn("overdue")).toEqual(["a_late"]);
    expect(idsIn("current")).toEqual([]);
    expect(idsIn("completed")).toEqual(["a_done"]);
  }, 20000);

  it("filters by owner", async () => {
    await bootAs("u_internal-luke");
    setFilter("Owner", "Sam");
    expect(idsIn("current")).toEqual(["a_soon"]);
    expect(idsIn("overdue")).toEqual([]);
  }, 20000);

  it("the No owner option finds work nobody has picked up", async () => {
    await bootAs("u_internal-luke");
    setFilter("Owner", "none");
    expect(idsIn("current")).toEqual(["a_undated"]);
  }, 20000);

  it("an Overdue filter empties Completed rather than leaving it populated", async () => {
    await bootAs("u_internal-luke");
    setFilter("Due", "overdue");
    expect(idsIn("overdue")).toEqual(["a_late"]);
    expect(idsIn("completed")).toEqual([]);
  }, 20000);

  it("filters compose with AND", async () => {
    await bootAs("u_internal-luke");
    setFilter("Pillar", "1");
    setFilter("Owner", "Sam");
    expect(idsIn("overdue")).toEqual([]);
    expect(idsIn("current")).toEqual([]);
    expect(idsIn("completed")).toEqual([]);
  }, 20000);

  it("the banner switches to a showing-N-of-M count once filtered", async () => {
    await bootAs("u_internal-luke");
    expect(bannerText()).toContain("4 total");
    setFilter("Owner", "Sam");
    expect(bannerText()).toBe("showing 1 of 4");
  }, 20000);

  it("Clear filters appears only when filtered, and restores the full list", async () => {
    await bootAs("u_internal-luke");
    const clearLabel = () =>
      Array.from(document.querySelectorAll("button")).find(
        (b) => (b.textContent || "").trim() === "Clear filters",
      );
    expect(clearLabel()).toBeUndefined();
    setFilter("Owner", "Sam");
    const clear = clearLabel();
    expect(clear).toBeDefined();
    /** @type {HTMLButtonElement} */ (clear).click();
    expect(clearLabel()).toBeUndefined();
    expect(idsIn("overdue")).toEqual(["a_late"]);
    expect(idsIn("completed")).toEqual(["a_done"]);
  }, 20000);

  it("an empty group says so, and says so differently when a filter caused it", async () => {
    await bootAs("u_internal-luke");
    const emptyIn = (/** @type {string} */ key) =>
      (document.querySelector(`.action-group-${key} .empty-card`)?.textContent || "").trim();
    setFilter("Owner", "Sam");
    expect(emptyIn("overdue")).toBe("Nothing here matches these filters.");
    setFilter("Owner", "all");
    // Nothing is filtered now and every group has something, so no empty cards
    expect(document.querySelector(".action-group .empty-card")).toBeNull();
  }, 20000);

  it("a filter survives the re-render caused by completing an action", async () => {
    await bootAs("u_internal-luke");
    setFilter("Owner", "Jane");
    const chk = /** @type {HTMLInputElement} */ (
      document.querySelector('.action-row[data-action-id="a_late"] input[type="checkbox"]')
    );
    chk.checked = true;
    chk.dispatchEvent(new Event("change"));
    await Promise.resolve();
    expect(filterSelect("Owner").value).toBe("Jane");
    expect(idsIn("completed")).toContain("a_late");
  }, 20000);
});

describe("action plan — filter bar visibility", () => {
  it("is absent when the org has no actions at all", async () => {
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
      localStorage.setItem(
        `baselayers:org:${o.id}`,
        JSON.stringify(o.id === ORG_ID ? { ...o, actions: [] } : o),
      );
    });
    localStorage.setItem("baselayers:users", JSON.stringify(snapshotOrg.users));
    localStorage.setItem("baselayers:session", JSON.stringify({ userId: "u_internal-luke" }));
    localStorage.setItem("baselayers:settings", JSON.stringify(snapshotOrg.settings));
    document.body.innerHTML =
      '<div id="app"></div><div id="modalRoot"></div><div id="toastRoot"></div>';
    window.location.hash = "#actions";
    vi.resetModules();
    await import("../../src/main.js");
    await Promise.resolve();
    await Promise.resolve();
    /** @type {HTMLButtonElement} */ (
      document.querySelector('button[data-route="actions"]')
    ).click();
    await Promise.resolve();

    expect(document.querySelector(".action-filter-bar")).toBeNull();
    expect(document.querySelector(".action-group")).toBeNull();
    expect(document.querySelector(".empty")?.textContent).toContain("No actions yet");
  }, 20000);
});
