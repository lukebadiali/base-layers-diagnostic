// src/views/auth.js
// @ts-check
// Phase 4 Wave 4 (D-12 / D-20): Pattern D DI factory for renderAuth.
//
// IIFE analog: app.js:708-1049 (renderAuth + renderFirstRunSetup +
// renderSignInForm). Per the Wave 3 Deviation #1 precedent, the IIFE bodies
// are preserved verbatim until Wave 5 extracts state.js + router.js +
// main.js (D-02). This module ships the export contract and a Pattern D DI
// factory (analog: src/ui/chrome.js createChrome from Wave 2) so views/* are
// importable today and Wave 5's cutover is a deps-source swap (IIFE-closure
// -> src/state.js) with zero adapter-shape change.
//
// Per-site quick wins (CODE-05/06/07/12) folded INSIDE app.js IIFE (D-20)
// at sites that don't affect Phase 2 D-08 snapshot baselines:
//   - CODE-05: replaceChildren() at applicable innerHTML="" sites
//   - CODE-06: classList toggle at app.js:880 (passConfirm.style.display)
//   - CODE-07: notify('error', ...) at app.js alert() sites in non-snapshot
//     view paths (chat/funnel/roadmap/import — not auth)
//   - CODE-12: rel="noopener noreferrer" on download anchors
import { h as defaultH } from "../ui/dom.js";

/**
 * @typedef {{
 *   state?: *,
 *   h?: (tag: string, attrs?: *, children?: *) => HTMLElement,
 *   notify?: (level: string, msg: string) => void,
 * }} AuthDeps
 */

/**
 * Pattern D DI factory — returns renderAuth bound to the supplied deps
 * (mirrors createChrome in src/ui/chrome.js from Wave 2).
 *
 * @param {AuthDeps} deps
 * @returns {{ renderAuth: () => HTMLElement }}
 */
export function createAuthView(deps) {
  const h = deps.h || defaultH;
  return {
    renderAuth() {
      // Wave 4 placeholder — production rendering remains in the app.js IIFE
      // (renderAuth at app.js:708) for snapshot-baseline stability per D-12.
      // Wave 5 (D-02) re-homes the body here when state.js + router.js +
      // main.js extract.
      return h("div", { class: "auth-wrap auth-wrap--placeholder" });
    },
  };
}

/**
 * Standalone renderAuth — returns a placeholder HTMLElement.
 * Wave 5 (D-02) replaces the body with the byte-identical extraction
 * from app.js:708-1049.
 *
 * @returns {HTMLElement}
 */
export function renderAuth() {
  return createAuthView({}).renderAuth();
}
