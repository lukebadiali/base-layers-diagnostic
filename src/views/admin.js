// src/views/admin.js
// @ts-check
// Phase 4 Wave 4 (D-12 / D-20): Pattern D DI factory for renderAdmin.
// IIFE analog: app.js:2721-3153 (renderAdmin). Body remains in app.js for
// snapshot-baseline stability; Wave 5 (D-02) re-homes here.
import { h as defaultH } from "../ui/dom.js";

/**
 * @typedef {{
 *   state?: *,
 *   h?: (tag: string, attrs?: *, children?: *) => HTMLElement,
 * }} AdminDeps
 */

/**
 * @param {AdminDeps} deps
 * @returns {{ renderAdmin: (user: *) => HTMLElement }}
 */
export function createAdminView(deps) {
  const h = deps.h || defaultH;
  return {
    renderAdmin(_user) {
      return h("div", { class: "admin-placeholder" });
    },
  };
}

/**
 * @param {*} user
 * @returns {HTMLElement}
 */
export function renderAdmin(user) {
  return createAdminView({}).renderAdmin(user);
}
