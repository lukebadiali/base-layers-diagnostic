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
    openChangePasswordModal: () => {},
    exportData: () => {},
    importData: () => {},
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

  it("renders a 9-button nav (dashboard, diagnostic, report, engagement, documents, chat, actions, roadmap, funnel)", () => {
    const { renderTopbar } = createChrome(makeDeps());
    const el = renderTopbar({ role: "internal", name: "L", email: "l@x.com" });
    const buttons = el.querySelectorAll(".topnav .nav-btn");
    expect(buttons.length).toBe(9);
    expect(buttons[0].getAttribute("data-route")).toBe("dashboard");
    expect(buttons[8].getAttribute("data-route")).toBe("funnel");
  });

  it("renders the mode toggle + org select for non-client users", () => {
    const { renderTopbar } = createChrome(makeDeps());
    const el = renderTopbar({ role: "internal", name: "L", email: "l@x.com" });
    expect(el.querySelector(".mode-toggle")).not.toBeNull();
    expect(el.querySelector("#orgSelect")).not.toBeNull();
  });
});

describe("renderTopbar() — client user", () => {
  it("does NOT render the mode toggle or org select", () => {
    const { renderTopbar } = createChrome(makeDeps());
    const el = renderTopbar({ role: "client", name: "Client Co", email: "c@x.com" });
    expect(el.querySelector(".mode-toggle")).toBeNull();
    expect(el.querySelector("#orgSelect")).toBeNull();
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
