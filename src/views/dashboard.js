// src/views/dashboard.js
// @ts-check
// Phase 4 Wave 4 (D-12 / D-20): Pattern D DI factory for renderDashboard.
//
// IIFE analog: app.js:1087-1505 (renderDashboard + drawRadar). Body remains
// in app.js for Phase 2 D-08 snapshot-baseline stability per D-12 +
// Wave 3 Deviation #1 precedent. Wave 5 (D-02) re-homes here when state.js +
// router.js + main.js extract.
import { h as defaultH } from "../ui/dom.js";

/**
 * @typedef {{
 *   state?: *,
 *   h?: (tag: string, attrs?: *, children?: *) => HTMLElement,
 * }} DashboardDeps
 */

/**
 * Pattern D DI factory — returns renderDashboard bound to deps.
 * @param {DashboardDeps} deps
 * @returns {{ renderDashboard: (user: *, org: *) => HTMLElement }}
 */
export function createDashboardView(deps) {
  const h = deps.h || defaultH;
  return {
    renderDashboard(_user, org) {
      const frag = h("div", { class: "dashboard-placeholder" });
      if (org && org.name) frag.appendChild(h("h1", { class: "view-title" }, org.name));
      return frag;
    },
  };
}

/**
 * Standalone renderDashboard — Wave 5 (D-02) replaces the body with the
 * byte-identical extraction from app.js:1087-1505.
 *
 * @param {*} user
 * @param {*} org
 * @returns {HTMLElement}
 */
export function renderDashboard(user, org) {
  return createDashboardView({}).renderDashboard(user, org);
}
