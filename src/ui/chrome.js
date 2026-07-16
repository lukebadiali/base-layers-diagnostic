// src/ui/chrome.js
// @ts-check
// Phase 4 Wave 2 (D-12): byte-identical extraction of renderTopbar +
// renderFooter from app.js:621-826 + 831-875. Closure references to
// state / activeOrgForUser / unreadCountTotal / unreadChatTotal / setRoute
// / loadOrgMetas / jset / K / render / isClientView / signOut /
// exportData / importData are replaced with the
// `deps` parameter passed to createChrome (Pattern D from Phase 2 D-05).
// Phase 06.1 Wave 3 (AUTH-17 / D-16): the legacy Change-password modal
// dispatch dep was removed from this list (along with its typedef
// entry, destructure entry, and the user-menu entry that invoked it).
// Wave 5 (D-02) moves state into src/state.js — the createChrome adapter
// shape stays stable across the cutover, so views/* and main.js need no
// further re-extraction.
//
// h() and initials() are imported directly (they're pure leaves with no
// closure-state dependency); only the IIFE-state-dependent symbols flow
// through deps.
import { h } from "./dom.js";
import { initials } from "./format.js";
import { pendingButton } from "./pending-button.js";

/**
 * @typedef {{
 *   state: { route: string, mode: string, userMenuOpen: boolean, orgId: any, accountId: any, viewRoundId: any },
 *   activeOrgForUser: (user: *) => *,
 *   unreadCountTotal: (org: *, user: *) => number,
 *   unreadChatTotal: (user: *) => number,
 *   setRoute: (route: string) => void,
 *   loadOrgMetas: () => Array<{ id: string, name: string }>,
 *   accountsForOrg: (orgId: string) => Array<*>,
 *   jset: (key: string, value: *) => void,
 *   K: { mode: string },
 *   render: () => void,
 *   isClientView: (user: *) => boolean,
 *   signOut: () => void,
 *   exportData: () => void,
 *   importData: (file: File) => void,
 *   activitySummary: () => { total: number, orgs: Array<{orgId: string, orgName: string, chatCount: number, docCount: number, latestMs: number}> },
 *   bellOpen: () => boolean,
 *   toggleBell: () => void,
 *   openOrgActivity: (orgId: string, route: string) => void,
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
    accountsForOrg,
    jset,
    K,
    render,
    isClientView,
    signOut,
    exportData,
    importData,
    activitySummary,
    bellOpen,
    toggleBell,
    openOrgActivity,
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
      ["documents", "Documents"],
      ["chat", "Chat"],
      ["actions", "Actions"],
      ["roadmap", "Plan"],
      ["funnel", "Funnel"],
    ];
    // Admin access moved to the user dropdown ("Admin · manage people").
    // The Delivery (engagement) framework now lives at the bottom of the
    // Diagnostic page (renderDiagnosticIndex appends it after the pillar
    // tiles). The /engagement route remains in src/router.js as an alias
    // that redirects to /diagnostic for any persisted state.route or
    // bookmarks from before the consolidation.

    const unread = org ? unreadCountTotal(org, user) : 0;
    const unreadChat = unreadChatTotal(user);

    items.forEach(([route, label]) => {
      const btn = h(
        "button",
        {
          class:
            "nav-btn" +
            (state.route === route || (route === "diagnostic" && state.route.startsWith("pillar:"))
              ? " active"
              : ""),
          "data-route": route,
          onclick: () => setRoute(route),
        },
        label,
      );
      // Unread indicator on diagnostic (since comments live on pillar pages)
      if (route === "diagnostic" && unread > 0) {
        btn.appendChild(h("span", { class: "dot", title: `${unread} unread comment(s)` }));
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
      // Scope item 7 (2026-07): staff notification bell — new chat messages
      // and document uploads across every org, attributed per client.
      const summary = activitySummary();
      const bellWrap = h("div", { class: "bell-wrap" });
      const bellBtn = h(
        "button",
        {
          class: "bell-btn",
          "aria-label": "Activity notifications",
          "aria-expanded": bellOpen() ? "true" : "false",
          onclick: (/** @type {Event} */ e) => {
            e.stopPropagation();
            toggleBell();
          },
        },
        [
          (() => {
            // Inline SVG bell (no-emojis-in-source convention).
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("viewBox", "0 0 16 16");
            svg.setAttribute("width", "16");
            svg.setAttribute("height", "16");
            svg.setAttribute("aria-hidden", "true");
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute(
              "d",
              "M8 1.5a4.5 4.5 0 0 0-4.5 4.5v2.6L2.3 11a.7.7 0 0 0 .6 1h10.2a.7.7 0 0 0 .6-1l-1.2-2.4V6A4.5 4.5 0 0 0 8 1.5Zm-1.6 11.3a1.7 1.7 0 0 0 3.2 0Z",
            );
            path.setAttribute("fill", "none");
            path.setAttribute("stroke", "currentColor");
            path.setAttribute("stroke-width", "1.3");
            path.setAttribute("stroke-linejoin", "round");
            svg.appendChild(path);
            return /** @type {*} */ (svg);
          })(),
          summary.total > 0
            ? h(
                "span",
                { class: "count-badge" },
                summary.total > 30 ? "30+" : String(summary.total),
              )
            : null,
        ].filter(Boolean),
      );
      bellWrap.appendChild(bellBtn);

      if (bellOpen()) {
        const panel = h("div", {
          class: "bell-panel",
          onclick: (/** @type {Event} */ e) => e.stopPropagation(),
        });
        if (summary.orgs.length === 0) {
          panel.appendChild(h("div", { class: "bell-empty" }, "No new activity."));
        } else {
          summary.orgs.forEach((o) => {
            panel.appendChild(h("div", { class: "bell-org" }, o.orgName));
            if (o.chatCount > 0) {
              panel.appendChild(
                h(
                  "button",
                  { class: "bell-row", onclick: () => openOrgActivity(o.orgId, "chat") },
                  `${o.chatCount} new message${o.chatCount === 1 ? "" : "s"}`,
                ),
              );
            }
            if (o.docCount > 0) {
              panel.appendChild(
                h(
                  "button",
                  { class: "bell-row", onclick: () => openOrgActivity(o.orgId, "documents") },
                  `${o.docCount} new document${o.docCount === 1 ? "" : "s"}`,
                ),
              );
            }
          });
        }
        bellWrap.appendChild(panel);
      }
      topright.appendChild(bellWrap);

      const modeToggle = h(
        "label",
        {
          class: "mode-toggle",
          title: "Internal view shows private commentary. Client view previews what a client sees.",
        },
        [
          h("span", {}, state.mode === "internal" ? "Internal" : "Client"),
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
        state.accountId = null;
        state.viewRoundId = null;
        state.route = "dashboard";
        render();
      });
      topright.appendChild(orgSelect);

      const acctSelect = /** @type {HTMLSelectElement} */ (
        h("select", { "aria-label": "Select account" })
      );
      const accounts = org ? accountsForOrg(org.id) : [];
      if (!accounts.length) {
        const opt = document.createElement("option");
        opt.textContent = "No accounts";
        opt.disabled = true;
        opt.selected = true;
        acctSelect.appendChild(opt);
        acctSelect.disabled = true;
      } else {
        const selected = state.accountId || accounts[0].id;
        accounts.forEach((a) => {
          const opt = document.createElement("option");
          opt.value = a.id;
          opt.textContent = a.name || a.email || a.id;
          if (a.id === selected) opt.selected = true;
          acctSelect.appendChild(opt);
        });
      }
      acctSelect.id = "acctSelect";
      acctSelect.addEventListener("change", (e) => {
        state.accountId = /** @type {HTMLSelectElement} */ (e.target).value;
        state.viewRoundId = null;
        state.route = "dashboard";
        render();
      });
      topright.appendChild(acctSelect);
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
      h("div", { class: "role" }, isClient ? (org ? org.name : "Client") : "BeDeveloped team"),
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
      // Phase 06.1 Wave 3 (AUTH-17 / D-16): "Change password" client menu
      // entry removed. Clients no longer have a per-user passwordHash;
      // password changes now go through Firebase Auth
      // (sendPasswordResetEmail — src/firebase/auth.js). The Security
      // panel referenced in CONTEXT D-10 (future opt-in MFA surface)
      // will expose any future password-management UI for clients.
      // Immediate tactile feedback: lock the button + swap in a pending label
      // so the click visibly registers and holds through the sign-out
      // round-trip (an awaited audit-event emit + fbSignOut). Deliberately no
      // eager render() — that would tear this button down and swallow the
      // feedback; the flip to the sign-in screen is driven by main.js's
      // onAuthStateChanged(null). On failure the button is restored for retry.
      const signOutBtn = /** @type {HTMLButtonElement} */ (h("button", {}, "Sign out"));
      signOutBtn.addEventListener("click", async () => {
        state.userMenuOpen = false;
        const pending = pendingButton(signOutBtn, "Signing out…");
        pending.start();
        try {
          await signOut();
        } catch (_err) {
          pending.stop();
        }
      });
      menu.appendChild(signOutBtn);
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
    // The privacy notice lives at /privacy.html (a static page in public/
    // copied to dist/ by Vite). It's reachable without auth and opens in a
    // new tab so clients can review the data-handling story without losing
    // their place in the diagnostic.
    const privacyLink = h(
      "a",
      {
        class: "footer-link",
        href: "/privacy.html",
        target: "_blank",
        rel: "noopener",
      },
      "Privacy",
    );
    if (!user || user.role === "client") {
      // minimal footer for clients
      return h("footer", { class: "footer" }, [
        h("span", {}, `The Base Layers — ${org ? org.name : "client view"}`),
        privacyLink,
      ]);
    }
    const actions = h("span", { class: "footer-actions" }, [
      privacyLink,
      h(
        "button",
        {
          class: "btn ghost",
          title: "Full backup of all orgs, users and responses. For internal recovery only.",
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
            title: "Restore a previously exported JSON backup. Overwrites current data.",
            onclick: () => input.click(),
          },
          "Restore backup",
        );
        return h("span", {}, [btn, input]);
      })(),
    ]);
    // Footer copy was previously "local build. Data stays in this browser."
    // — a leftover from the pre-Firebase localStorage-only era. Replaced
    // with the active-org name (same shape as the client footer) so the
    // line is both accurate and useful when internal users switch orgs.
    return h("footer", { class: "footer" }, [
      h("span", {}, `The Base Layers — ${org ? org.name : "BeDeveloped"}`),
      actions,
    ]);
  }

  return { renderTopbar, renderFooter };
}
