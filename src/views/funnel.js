// src/views/funnel.js
// @ts-check
// Phase 4 Wave 4 (D-12 / D-20): Pattern D DI factory for renderFunnel.
//
// IIFE analog: app.js:4052-4710 (renderFunnel — KPI grid + comments block).
// Body remains in app.js for snapshot-baseline stability; Wave 5 (D-02)
// re-homes here AND adopts the _shared/render-conversation.js helper for
// the funnel comments block (CODE-08 / M8 closure substrate).
import { h as defaultH } from "../ui/dom.js";

/**
 * @typedef {{
 *   state?: *,
 *   h?: (tag: string, attrs?: *, children?: *) => HTMLElement,
 * }} FunnelDeps
 */

/**
 * @param {FunnelDeps} deps
 * @returns {{ renderFunnel: (user: *, org: *) => HTMLElement }}
 */
export function createFunnelView(deps) {
  const h = deps.h || defaultH;
  return {
    renderFunnel(_user, _org) {
      return h("div", { class: "funnel-placeholder" });
    },
  };
}

/**
 * @param {*} user
 * @param {*} org
 * @returns {HTMLElement}
 */
export function renderFunnel(user, org) {
  return createFunnelView({}).renderFunnel(user, org);
}

// Re-export renderConversation for the funnel-comment-block adoption site
// (Wave 5 wires the actual call).
export {
  renderConversation,
  renderConversationBubble,
} from "./_shared/render-conversation.js";
