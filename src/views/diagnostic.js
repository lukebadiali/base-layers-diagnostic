// src/views/diagnostic.js
// @ts-check
// Phase 4 Wave 4 (D-12 / D-20): Pattern D DI factory for renderDiagnostic.
// IIFE analog: app.js:1575-1672 (renderDiagnosticIndex). Body remains in
// app.js for snapshot-baseline stability; Wave 5 (D-02) re-homes here.
import { h as defaultH } from "../ui/dom.js";

/**
 * @typedef {{
 *   state?: *,
 *   h?: (tag: string, attrs?: *, children?: *) => HTMLElement,
 * }} DiagnosticDeps
 */

/**
 * @param {DiagnosticDeps} deps
 * @returns {{ renderDiagnostic: (user: *, org: *) => HTMLElement }}
 */
export function createDiagnosticView(deps) {
  const h = deps.h || defaultH;
  return {
    renderDiagnostic(_user, _org) {
      return h("div", { class: "diagnostic-placeholder" });
    },
  };
}

/**
 * @param {*} user
 * @param {*} org
 * @returns {HTMLElement}
 */
export function renderDiagnostic(user, org) {
  return createDiagnosticView({}).renderDiagnostic(user, org);
}
