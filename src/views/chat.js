// src/views/chat.js
// @ts-check
// Phase 4 Wave 4 (D-12 / D-20): Pattern D DI factory for renderChat +
// setTitleIfDifferent memo (CODE-10 — tab-title unread badge).
//
// IIFE analog: app.js:3351-3587 (renderChat). Body remains in app.js for
// snapshot-baseline stability; Wave 5 (D-02) re-homes here AND adopts the
// _shared/render-conversation.js helper (CODE-08 / M8 closure substrate).
//
// CODE-08: chat.js + funnel.js will both import renderConversation from
// src/views/_shared/render-conversation.js when their bodies extract in
// Wave 5. The shared helper is shipped this wave (genuinely new code, not
// extracted from app.js).
//
// CODE-10: tab-title unread badge memoisation. setTitleIfDifferent is
// applied to the IIFE's updateTabTitleBadge() at app.js:496-500. The memo
// state lives at module scope here; views/chat.js owns the title surface.
import { h as defaultH } from "../ui/dom.js";

/** @type {string|null} */
let __lastTitleWritten = null;

/**
 * Memoised document.title writer — only writes when the value differs from
 * the previous write (CODE-10 — prevents redundant DOM writes).
 *
 * @param {string} t
 * @returns {void}
 */
export function setTitleIfDifferent(t) {
  if (t !== __lastTitleWritten) {
    document.title = t;
    __lastTitleWritten = t;
  }
}

/**
 * Test-only memo reset. Not part of the production API surface.
 * @returns {void}
 */
export function __resetTitleMemo() {
  __lastTitleWritten = null;
}

/**
 * @typedef {{
 *   state?: *,
 *   h?: (tag: string, attrs?: *, children?: *) => HTMLElement,
 * }} ChatDeps
 */

/**
 * @param {ChatDeps} deps
 * @returns {{ renderChat: (user: *, org: *) => HTMLElement }}
 */
export function createChatView(deps) {
  const h = deps.h || defaultH;
  return {
    renderChat(_user, _org) {
      return h("div", { class: "chat-placeholder" });
    },
  };
}

/**
 * @param {*} user
 * @param {*} org
 * @returns {HTMLElement}
 */
export function renderChat(user, org) {
  return createChatView({}).renderChat(user, org);
}

// Re-export the renderConversation helper so chat.js consumers see it as
// part of the views/* import surface (Wave 5 wires the actual call site).
export { renderConversation } from "./_shared/render-conversation.js";
