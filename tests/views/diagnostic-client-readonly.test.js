// tests/views/diagnostic-client-readonly.test.js
// @ts-check
// Client logins get a view-only diagnostic: inert Likert buttons (saved
// answers stay highlighted), review copy, no progress banner, no Complete
// or "+ Add" buttons. Staff scoring still works. Boot pattern mirrors
// tests/views/diagnostic.test.js with a parameterised session user.
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

describe("client view-only diagnostic", () => {
  it("index shows review copy and no progress banner", async () => {
    await bootAs("u_client-a");
    const app = /** @type {HTMLElement} */ (document.getElementById("app"));
    expect(app.querySelector(".client-progress-banner")).toBeNull();
    expect(app.textContent).toContain("View your responses here");
    expect(app.textContent).not.toContain("Score each pillar honestly");
  }, 20000);

  it("pillar page renders inert scoring and no mutating buttons", async () => {
    await bootAs("u_client-a");
    openFirstPillar();

    const likertButtons = Array.from(document.querySelectorAll(".likert button"));
    expect(likertButtons.length).toBeGreaterThan(0);
    likertButtons.forEach((b) => expect(b.hasAttribute("disabled")).toBe(true));
    expect(document.querySelector(".likert.read-only")).not.toBeNull();

    const labels = Array.from(document.querySelectorAll("button")).map((b) =>
      (b.textContent || "").trim(),
    );
    expect(labels).not.toContain("Complete");
    expect(labels).not.toContain("+ Add");
  }, 20000);

  it("clicking a likert button writes nothing", async () => {
    await bootAs("u_client-a");
    openFirstPillar();
    const orgId = snapshotOrg.orgMetas[0].id;
    const before = localStorage.getItem(`baselayers:org:${orgId}`);
    const btn = /** @type {HTMLButtonElement|null} */ (
      document.querySelector(".likert button:not(.sel)")
    );
    if (!btn) throw new Error("no unselected likert button found");
    btn.click();
    await Promise.resolve();
    expect(localStorage.getItem(`baselayers:org:${orgId}`)).toBe(before);
    expect(btn.classList.contains("sel")).toBe(false);
  }, 20000);
});

describe("staff scoring regression", () => {
  it("internal user can still score a question", async () => {
    await bootAs("u_internal-luke");
    openFirstPillar();
    const orgId = snapshotOrg.orgMetas[0].id;
    const beforeRaw = /** @type {string} */ (localStorage.getItem(`baselayers:org:${orgId}`));
    const before = JSON.parse(beforeRaw);
    const btn = /** @type {HTMLButtonElement|null} */ (
      document.querySelector(".likert button:not(.sel)")
    );
    if (!btn) throw new Error("no unselected likert button found");
    expect(btn.hasAttribute("disabled")).toBe(false);
    btn.click();
    await Promise.resolve();
    const after = JSON.parse(
      /** @type {string} */ (localStorage.getItem(`baselayers:org:${orgId}`)),
    );
    expect(JSON.stringify(after.responses)).not.toBe(JSON.stringify(before.responses));
  }, 20000);
});
