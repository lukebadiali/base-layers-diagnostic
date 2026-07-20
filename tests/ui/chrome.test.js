// tests/ui/chrome.test.js
// @ts-check
// Phase 4 Wave 2 (D-12): smoke test for src/ui/chrome.js — renderTopbar +
// renderFooter extracted byte-identical from app.js:621-826 + 831-875 with
// Pattern D DI per Phase 2 D-05 (state + helpers passed via createChrome
// factory; Wave 5 moves state into src/state.js — adapter shape stable).
//
// Behavioural coverage of routing/menu interactions belongs to view-level
// snapshot tests in Wave 4 (per-view extraction). This file's contract:
// the factory binds deps once, returns the two render functions with the
// original (user) / (user, org) signatures, and produces the expected
// topbar/footer DOM shells for the canonical user roles.
import { describe, it, expect, beforeEach } from "vitest";
import { createChrome } from "../../src/ui/chrome.js";

/** @returns {*} Stub deps with stable defaults that exercise every branch. */
function makeDeps(overrides = {}) {
  return {
    state: { route: "dashboard", mode: "internal", userMenuOpen: false, orgId: null },
    activeOrgForUser: () => null,
    unreadCountTotal: () => 0,
    unreadChatTotal: () => 0,
    setRoute: () => {},
    loadOrgMetas: () => [],
    jset: () => {},
    K: { mode: "baselayers:mode" },
    render: () => {},
    isClientView: () => false,
    signOut: () => {},
    // Phase 06.1 Wave 3 (AUTH-17 / D-16): the Change-password modal stub
    // dep removed from ChromeDeps alongside the modal definition + the
    // user-menu entry that consumed it.
    exportData: () => {},
    importData: () => {},
    // Scope item 7 (2026-07): staff notification bell defaults — zero
    // activity, closed panel, no-op handlers.
    activitySummary: () => ({ total: 0, orgs: [] }),
    bellOpen: () => false,
    toggleBell: () => {},
    openOrgActivity: () => {},
    ...overrides,
  };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("createChrome factory", () => {
  it("returns an object with renderTopbar + renderFooter functions", () => {
    const c = createChrome(makeDeps());
    expect(typeof c.renderTopbar).toBe("function");
    expect(typeof c.renderFooter).toBe("function");
  });
});

describe("renderTopbar() — internal user", () => {
  it("returns a <header class='topbar'> with brand / topnav / topright children", () => {
    const { renderTopbar } = createChrome(makeDeps());
    const el = renderTopbar({
      role: "internal",
      name: "Luke Badiali",
      email: "luke@bedeveloped.com",
    });
    expect(el.tagName).toBe("HEADER");
    expect(el.className).toBe("topbar");
    expect(el.querySelector(".brand")).not.toBeNull();
    expect(el.querySelector(".topnav")).not.toBeNull();
    expect(el.querySelector(".topright")).not.toBeNull();
  });

  it("renders an 8-button nav (dashboard, diagnostic, report, documents, chat, actions, roadmap, funnel)", () => {
    // The "Delivery" (engagement) tab was removed from the topnav and folded
    // into the bottom of the Diagnostic page (src/main.js renderDiagnosticIndex)
    // to keep the admin topbar from overflowing horizontally on laptop widths.
    const { renderTopbar } = createChrome(makeDeps());
    const el = renderTopbar({ role: "internal", name: "L", email: "l@x.com" });
    const buttons = el.querySelectorAll(".topnav .nav-btn");
    expect(buttons.length).toBe(8);
    expect(buttons[0].getAttribute("data-route")).toBe("dashboard");
    expect(buttons[7].getAttribute("data-route")).toBe("funnel");
    expect(el.querySelector('button[data-route="engagement"]')).toBeNull();
  });

  it("renders the mode toggle + scope picker for non-client users", () => {
    const { renderTopbar } = createChrome(makeDeps());
    const el = renderTopbar({ role: "internal", name: "L", email: "l@x.com" });
    expect(el.querySelector(".mode-toggle")).not.toBeNull();
    expect(el.querySelector(".scope-btn")).not.toBeNull();
  });

  it("collapses the internal identity to an avatar-only chip", () => {
    const { renderTopbar } = createChrome(makeDeps());
    const el = renderTopbar({ role: "internal", name: "Luke Badiali", email: "luke@x.com" });
    const chip = el.querySelector(".user-chip");
    expect(chip?.classList.contains("avatar-only")).toBe(true);
    // No name/role block for internal; identity is on the tooltip instead.
    expect(chip?.querySelector(".who")).toBeNull();
    expect(chip?.getAttribute("title")).toBe("Luke Badiali");
  });
});

describe("renderTopbar() — client user", () => {
  it("does NOT render the mode toggle or scope picker", () => {
    const { renderTopbar } = createChrome(makeDeps());
    const el = renderTopbar({ role: "client", name: "Client Co", email: "c@x.com" });
    expect(el.querySelector(".mode-toggle")).toBeNull();
    expect(el.querySelector(".scope-picker")).toBeNull();
  });

  it("keeps the name/role block on the client chip", () => {
    const { renderTopbar } = createChrome(
      makeDeps({ activeOrgForUser: () => ({ id: "o", name: "Client Co" }) }),
    );
    const el = renderTopbar({ role: "client", name: "Alice", email: "a@x.com" });
    const chip = el.querySelector(".user-chip");
    expect(chip?.classList.contains("avatar-only")).toBe(false);
    expect(chip?.querySelector(".who .name")?.textContent).toBe("Alice");
    expect(chip?.querySelector(".who .role")?.textContent).toBe("Client Co");
  });
});

describe("renderTopbar() — scope picker (navbar tidy 2026-07)", () => {
  /** @returns {*} Internal deps with two orgs; org1 has two client accounts. */
  const scopeDeps = () =>
    makeDeps({
      state: {
        route: "dashboard",
        mode: "internal",
        userMenuOpen: false,
        scopeOpen: true,
        orgId: "org1",
        accountId: "acc2",
        viewRoundId: null,
      },
      activeOrgForUser: () => ({ id: "org1", name: "Acme Corp" }),
      loadOrgMetas: () => [
        { id: "org1", name: "Acme Corp" },
        { id: "org2", name: "Globex" },
      ],
      accountsForOrg: (/** @type {string} */ orgId) =>
        orgId === "org1"
          ? [
              { id: "acc1", name: "Jane Smith" },
              { id: "acc2", name: "Bob Lee" },
            ]
          : [],
    });

  it("closed button shows the current org over the entered client", () => {
    const deps = scopeDeps();
    deps.state.scopeOpen = false;
    const { renderTopbar } = createChrome(deps);
    const el = renderTopbar({ role: "internal", name: "L", email: "l@x.com" });
    expect(el.querySelector(".scope-org-name")?.textContent).toBe("Acme Corp");
    expect(el.querySelector(".scope-acct-name")?.textContent).toBe("Bob Lee");
    expect(el.querySelector(".scope-panel")).toBeNull();
  });

  it("open panel lists every org, each with its client flyout", () => {
    const { renderTopbar } = createChrome(scopeDeps());
    const el = renderTopbar({ role: "internal", name: "L", email: "l@x.com" });
    const orgRows = el.querySelectorAll(".scope-panel .scope-org");
    expect(orgRows.length).toBe(2);
    // Active org's flyout lists its two clients, with the entered one ticked.
    expect(orgRows[0].querySelectorAll(".scope-acct").length).toBe(2);
    expect(orgRows[0].querySelector(".scope-acct.active")?.textContent).toContain("Bob Lee");
    // An org with no clients shows the empty state, not a broken flyout.
    expect(orgRows[1].querySelector(".scope-empty")?.textContent).toBe("No clients");
  });

  it("selecting a client enters that account and closes the picker", () => {
    let rendered = 0;
    const deps = scopeDeps();
    deps.render = () => {
      rendered++;
    };
    const { renderTopbar } = createChrome(deps);
    const el = renderTopbar({ role: "internal", name: "L", email: "l@x.com" });
    const janeBtn = /** @type {HTMLButtonElement} */ (
      Array.from(el.querySelectorAll(".scope-acct")).find((b) =>
        b.textContent?.includes("Jane Smith"),
      )
    );
    janeBtn.click();
    expect(deps.state.orgId).toBe("org1");
    expect(deps.state.accountId).toBe("acc1");
    expect(deps.state.scopeOpen).toBe(false);
    expect(rendered).toBeGreaterThan(0);
  });
});

describe("renderTopbar() — mode toggle label (scope item 6, 2026-07)", () => {
  it('says "Client" (not "Client preview") when mode is external', () => {
    const deps = makeDeps();
    deps.state.mode = "external";
    const { renderTopbar } = createChrome(deps);
    const el = renderTopbar({ role: "internal", name: "L", email: "l@x.com" });
    const label = el.querySelector(".mode-toggle span");
    expect(label?.textContent).toBe("Client");
  });

  it('says "Internal" when mode is internal', () => {
    const deps = makeDeps();
    deps.state.mode = "internal";
    const { renderTopbar } = createChrome(deps);
    const el = renderTopbar({ role: "internal", name: "L", email: "l@x.com" });
    const label = el.querySelector(".mode-toggle span");
    expect(label?.textContent).toBe("Internal");
  });
});

describe("renderFooter()", () => {
  it("returns a minimal <footer class='footer'> for client users", () => {
    const { renderFooter } = createChrome(makeDeps());
    const el = renderFooter(
      { role: "client", name: "C", email: "c@x.com" },
      { id: "org_x", name: "Client Co" },
    );
    expect(el.tagName).toBe("FOOTER");
    expect(el.className).toBe("footer");
    // Client footer has the org name in the first span.
    expect(el.querySelector("span")?.textContent).toMatch(/Client Co/);
    expect(el.querySelector(".footer-actions")).toBeNull();
  });

  it("returns the internal footer with Export/Restore actions for internal users", () => {
    const { renderFooter } = createChrome(makeDeps());
    const el = renderFooter(
      { role: "internal", name: "L", email: "l@x.com" },
      { id: "o", name: "X" },
    );
    expect(el.tagName).toBe("FOOTER");
    expect(el.querySelector(".footer-actions")).not.toBeNull();
    const buttons = el.querySelectorAll(".footer-actions button");
    expect(Array.from(buttons).map((b) => b.textContent)).toEqual([
      "Export backup",
      "Restore backup",
    ]);
  });
});

describe("renderTopbar() — sign-out pending state (tactile feedback)", () => {
  /** @param {*} el @returns {HTMLButtonElement} */
  const signOutButton = (el) =>
    /** @type {HTMLButtonElement} */ (
      Array.from(el.querySelectorAll(".user-menu button")).find((b) => b.textContent === "Sign out")
    );

  it("locks the sign-out button with a pending label while sign-out is in flight", () => {
    let renderCalls = 0;
    const { renderTopbar } = createChrome(
      makeDeps({
        state: { route: "dashboard", mode: "internal", userMenuOpen: true, orgId: null },
        render: () => {
          renderCalls++;
        },
        // Never settles during the test — hold the in-flight state.
        signOut: () => new Promise(() => {}),
      }),
    );
    const el = renderTopbar({ role: "internal", name: "L", email: "l@x.com" });
    document.body.appendChild(el);
    const btn = signOutButton(el);
    expect(btn).toBeTruthy();

    btn.click();

    expect(btn.disabled).toBe(true);
    expect(btn.classList.contains("is-loading")).toBe(true);
    expect(btn.textContent).toBe("Signing out…");
    // No eager render() — that would tear the button down and swallow the
    // feedback. The post-sign-out flip is driven by onAuthStateChanged.
    expect(renderCalls).toBe(0);
  });

  it("restores the sign-out button if sign-out fails", async () => {
    /** @type {(reason?: unknown) => void} */
    let rejectSignOut = () => {};
    const { renderTopbar } = createChrome(
      makeDeps({
        state: { route: "dashboard", mode: "internal", userMenuOpen: true, orgId: null },
        signOut: () =>
          new Promise((_res, rej) => {
            rejectSignOut = rej;
          }),
      }),
    );
    const el = renderTopbar({ role: "internal", name: "L", email: "l@x.com" });
    document.body.appendChild(el);
    const btn = signOutButton(el);

    btn.click();
    expect(btn.disabled).toBe(true);

    rejectSignOut(new Error("nope"));
    await Promise.resolve();
    await Promise.resolve();

    expect(btn.disabled).toBe(false);
    expect(btn.classList.contains("is-loading")).toBe(false);
    expect(btn.textContent).toBe("Sign out");
  });
});

describe("renderTopbar() — notification bell (scope item 7, 2026-07)", () => {
  const SUMMARY = {
    total: 3,
    orgs: [{ orgId: "orgA", orgName: "Acme", chatCount: 2, docCount: 1, latestMs: 5 }],
  };

  it("renders the bell with a count badge for staff", () => {
    const deps = makeDeps();
    deps.activitySummary = () => SUMMARY;
    const { renderTopbar } = createChrome(deps);
    const el = renderTopbar({ role: "internal", name: "L", email: "l@x.com" });
    const bell = el.querySelector(".bell-btn");
    expect(bell).not.toBeNull();
    expect(bell?.getAttribute("aria-label")).toBe("Activity notifications");
    expect(el.querySelector(".bell-btn .count-badge")?.textContent).toBe("3");
  });

  it("hides the badge at zero and never renders for clients", () => {
    const deps = makeDeps();
    deps.activitySummary = () => ({ total: 0, orgs: [] });
    const { renderTopbar } = createChrome(deps);
    const staffEl = renderTopbar({ role: "internal", name: "L", email: "l@x.com" });
    expect(staffEl.querySelector(".bell-btn")).not.toBeNull();
    expect(staffEl.querySelector(".bell-btn .count-badge")).toBeNull();
    const clientEl = renderTopbar({ role: "client", name: "C", email: "c@x.com" });
    expect(clientEl.querySelector(".bell-btn")).toBeNull();
  });

  it("caps the badge display at 30+", () => {
    const deps = makeDeps();
    deps.activitySummary = () => ({ total: 31, orgs: [] });
    const { renderTopbar } = createChrome(deps);
    const el = renderTopbar({ role: "internal", name: "L", email: "l@x.com" });
    expect(el.querySelector(".bell-btn .count-badge")?.textContent).toBe("30+");
  });

  it("open panel lists org rows and clicking one calls openOrgActivity", () => {
    const calls = /** @type {Array<*>} */ ([]);
    const deps = makeDeps();
    deps.activitySummary = () => SUMMARY;
    deps.bellOpen = () => true;
    deps.openOrgActivity = (/** @type {string} */ orgId, /** @type {string} */ route) =>
      calls.push([orgId, route]);
    const { renderTopbar } = createChrome(deps);
    const el = renderTopbar({ role: "internal", name: "L", email: "l@x.com" });
    const panel = el.querySelector(".bell-panel");
    expect(panel).not.toBeNull();
    expect(panel?.textContent).toContain("Acme");
    expect(panel?.textContent).toContain("2 new messages");
    expect(panel?.textContent).toContain("1 new document");
    const chatRow = /** @type {HTMLButtonElement} */ (
      Array.from(panel?.querySelectorAll("button.bell-row") || []).find((b) =>
        b.textContent?.includes("message"),
      )
    );
    chatRow.click();
    expect(calls).toEqual([["orgA", "chat"]]);
  });

  it("open panel with no activity shows the empty state", () => {
    const deps = makeDeps();
    deps.activitySummary = () => ({ total: 0, orgs: [] });
    deps.bellOpen = () => true;
    const { renderTopbar } = createChrome(deps);
    const el = renderTopbar({ role: "internal", name: "L", email: "l@x.com" });
    expect(el.querySelector(".bell-panel")?.textContent).toContain("No new activity");
  });

  it("bell click calls toggleBell", () => {
    let toggled = 0;
    const deps = makeDeps();
    deps.activitySummary = () => ({ total: 0, orgs: [] });
    deps.toggleBell = () => {
      toggled += 1;
    };
    const { renderTopbar } = createChrome(deps);
    const el = renderTopbar({ role: "internal", name: "L", email: "l@x.com" });
    /** @type {HTMLButtonElement} */ (el.querySelector(".bell-btn")).click();
    expect(toggled).toBe(1);
  });
});
