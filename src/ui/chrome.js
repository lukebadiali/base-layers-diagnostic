// src/ui/chrome.js
// @ts-check
// Phase 4 Wave 2 (D-12): byte-identical extraction of renderTopbar +
// renderFooter from app.js:621-826 + 831-875. Closure references to
// state / activeOrgForUser / unreadCountTotal / unreadChatTotal / setRoute
// / loadOrgMetas / jset / K / render / isClientView / signOut /
// openChangePasswordModal / exportData / importData are replaced with the
// `deps` parameter passed to createChrome (Pattern D from Phase 2 D-05).
// Wave 5 (D-02) moves state into src/state.js — the createChrome adapter
// shape stays stable across the cutover, so views/* and main.js need no
// further re-extraction.
//
// h() and initials() are imported directly (they're pure leaves with no
// closure-state dependency); only the IIFE-state-dependent symbols flow
// through deps.
import { h } from "./dom.js";
import { initials } from "./format.js";

/**
 * @typedef {{
 *   state: { route: string, mode: string, userMenuOpen: boolean, orgId: any },
 *   activeOrgForUser: (user: *) => *,
 *   unreadCountTotal: (org: *, user: *) => number,
 *   unreadChatTotal: (user: *) => number,
 *   setRoute: (route: string) => void,
 *   loadOrgMetas: () => Array<{ id: string, name: string }>,
 *   jset: (key: string, value: *) => void,
 *   K: { mode: string },
 *   render: () => void,
 *   isClientView: (user: *) => boolean,
 *   signOut: () => void,
 *   openChangePasswordModal: (user: *) => void,
 *   exportData: () => void,
 *   importData: (file: File) => void,
 * }} ChromeDeps
 */

/**
 * Bind chrome render functions to the IIFE state + helpers (Pattern D DI).
 * Returns the two render functions with the original (user) / (user, org)
 * signatures so existing callers in app.js don't change.
 *
 * @param {ChromeDeps} deps
 */
export function createChrome(deps) {
  const {
    state,
    activeOrgForUser,
    unreadCountTotal,
    unreadChatTotal,
    setRoute,
    loadOrgMetas,
    jset,
    K,
    render,
    isClientView,
    signOut,
    openChangePasswordModal,
    exportData,
    importData,
  } = deps;

  /** @param {*} user */
  function renderTopbar(user) {
    const isClient = user.role === "client";
    const org = activeOrgForUser(user);

    const logoImg = h("img", {
      class: "brand-logo",
      src: "assets/logo.png?v=54",
      alt: "BeDeveloped",
    });
    const brand = h("div", { class: "brand" }, [
      logoImg,
      h("span", { class: "brand-sub" }, "The Base Layers"),
    ]);

    // Nav
    const nav = h("nav", { class: "topnav" });
    const items = [
      ["dashboard", "Dashboard"],
      ["diagnostic", "Diagnostic"],
      ["report", "Report"],
      ["engagement", "Delivery"],
      ["documents", "Documents"],
      ["chat", "Chat"],
      ["actions", "Actions"],
      ["roadmap", "Plan"],
      ["funnel", "Funnel"],
    ];
    // Admin access moved to the user dropdown ("Admin · manage people").

    const unread = org ? unreadCountTotal(org, user) : 0;
    const unreadChat = unreadChatTotal(user);

    items.forEach(([route, label]) => {
      const btn = h(
        "button",
        {
          class:
            "nav-btn" +
            (state.route === route ||
            (route === "diagnostic" && state.route.startsWith("pillar:"))
              ? " active"
              : ""),
          "data-route": route,
          onclick: () => setRoute(route),
        },
        label,
      );
      // Unread indicator on diagnostic (since comments live on pillar pages)
      if (route === "diagnostic" && unread > 0) {
        btn.appendChild(
          h("span", { class: "dot", title: `${unread} unread comment(s)` }),
        );
      }
      // Unread indicator on chat
      if (route === "chat" && unreadChat > 0) {
        btn.appendChild(
          h(
            "span",
            {
              class: "count-badge",
              title: `${unreadChat} unread message${unreadChat === 1 ? "" : "s"}`,
            },
            String(unreadChat),
          ),
        );
      }
      nav.appendChild(btn);
    });

    const topright = h("div", { class: "topright" });

    // Internal-only: mode toggle + org switcher
    if (!isClient) {
      const modeToggle = h(
        "label",
        {
          class: "mode-toggle",
          title:
            "Internal view shows private commentary. Client view previews what a client sees.",
        },
        [
          h(
            "span",
            {},
            state.mode === "internal" ? "Internal" : "Client preview",
          ),
          (() => {
            const input = /** @type {HTMLInputElement} */ (
              h("input", {
                type: "checkbox",
                checked: state.mode === "internal",
              })
            );
            input.addEventListener("change", () => {
              state.mode = input.checked ? "internal" : "external";
              jset(K.mode, state.mode);
              render();
            });
            return input;
          })(),
          h("span", { class: "switch" }),
        ],
      );
      topright.appendChild(modeToggle);

      const orgSelect = /** @type {HTMLSelectElement} */ (
        h("select", { "aria-label": "Select organisation" })
      );
      loadOrgMetas().forEach((o) => {
        const opt = document.createElement("option");
        opt.value = o.id;
        opt.textContent = o.name;
        if (o.id === org?.id) opt.selected = true;
        orgSelect.appendChild(opt);
      });
      orgSelect.id = "orgSelect";
      orgSelect.addEventListener("change", (e) => {
        state.orgId = /** @type {HTMLSelectElement} */ (e.target).value;
        state.route = "dashboard";
        render();
      });
      topright.appendChild(orgSelect);
    }

    // User chip
    const avatar = h(
      "span",
      {
        class: "avatar" + (isClient ? "" : " internal"),
      },
      initials(user.name || user.email),
    );
    const who = h("div", { class: "who" }, [
      h("div", { class: "name" }, user.name || user.email),
      h(
        "div",
        { class: "role" },
        isClient ? (org ? org.name : "Client") : "BeDeveloped team",
      ),
    ]);
    const chip = h(
      "button",
      {
        class: "user-chip",
        onclick: (/** @type {Event} */ e) => {
          e.stopPropagation();
          state.userMenuOpen = !state.userMenuOpen;
          render();
        },
      },
      [avatar, who],
    );

    if (state.userMenuOpen) {
      const menu = h("div", { class: "user-menu" });
      menu.addEventListener("click", (e) => e.stopPropagation());
      menu.appendChild(
        h(
          "div",
          { style: "padding: 8px 12px; font-size: 12px; color: var(--ink-3);" },
          `Signed in as ${user.email}`,
        ),
      );
      menu.appendChild(h("div", { class: "divider" }));
      if (!isClient && !isClientView(user)) {
        menu.appendChild(
          h(
            "button",
            {
              onclick: () => {
                state.userMenuOpen = false;
                setRoute("admin");
              },
            },
            "Admin · manage people",
          ),
        );
      }
      if (isClient && user.passwordHash) {
        menu.appendChild(
          h(
            "button",
            {
              onclick: () => {
                state.userMenuOpen = false;
                render();
                openChangePasswordModal(user);
              },
            },
            "Change password",
          ),
        );
      }
      menu.appendChild(
        h(
          "button",
          {
            onclick: () => {
              state.userMenuOpen = false;
              signOut();
              render();
            },
          },
          "Sign out",
        ),
      );
      chip.appendChild(menu);

      // click-outside to close
      setTimeout(() => {
        const handler = () => {
          state.userMenuOpen = false;
          render();
        };
        document.addEventListener("click", handler, { once: true });
      }, 10);
    }

    topright.appendChild(chip);

    return h("header", { class: "topbar" }, [brand, nav, topright]);
  }

  /**
   * @param {*} user
   * @param {*} org
   */
  function renderFooter(user, org) {
    if (!user || user.role === "client") {
      // minimal footer for clients
      return h("footer", { class: "footer" }, [
        h("span", {}, `The Base Layers — ${org ? org.name : "client view"}`),
        h("span", {}),
      ]);
    }
    const actions = h("span", { class: "footer-actions" }, [
      h(
        "button",
        {
          class: "btn ghost",
          title:
            "Full backup of all orgs, users and responses. For internal recovery only.",
          onclick: exportData,
        },
        "Export backup",
      ),
      (() => {
        const input = /** @type {HTMLInputElement} */ (
          h("input", {
            type: "file",
            accept: "application/json",
            style: "display:none;",
          })
        );
        input.addEventListener("change", (e) => {
          const target = /** @type {HTMLInputElement} */ (e.target);
          if (target.files && target.files[0]) importData(target.files[0]);
          target.value = "";
        });
        const btn = h(
          "button",
          {
            class: "btn ghost",
            title:
              "Restore a previously exported JSON backup. Overwrites current data.",
            onclick: () => input.click(),
          },
          "Restore backup",
        );
        return h("span", {}, [btn, input]);
      })(),
    ]);
    return h("footer", { class: "footer" }, [
      h(
        "span",
        {},
        "The Base Layers — local build. Data stays in this browser.",
      ),
      actions,
    ]);
  }

  return { renderTopbar, renderFooter };
}
