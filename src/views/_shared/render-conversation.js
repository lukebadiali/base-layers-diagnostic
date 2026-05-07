// src/views/_shared/render-conversation.js
// @ts-check
// Phase 4 Wave 4 (CODE-08 / D-20): shared helper for chat.js + funnel.js
// (M8 closure substrate — chat-vs-funnel-comments duplication target).
//
// This module is genuinely new code (NOT an extraction from app.js) — it
// hoists the message-list + input-area + empty-state pattern that the
// IIFE-resident renderChat (app.js:3351) and renderFunnel comment block
// (app.js:4500-4604) share verbatim today. Wave 5 will adopt it from both
// view modules when state.js + router.js + main.js extract and the IIFE
// finally dies (D-02 / D-03).
//
// Citations: CONCERNS.md §M8 (chat/funnel duplication closure target).
import { h } from "../../ui/dom.js";
import { formatWhen, initials, firstNameFromAuthor } from "../../ui/format.js";

/**
 * Conversation message shape — chat + funnel comments share this.
 * @typedef {{ id: string, body: string, author: string, createdAt: number }} ConvMessage
 */

/**
 * Renders a chat-shape conversation widget with message list + input area
 * + empty-state. Used by both chat.js (real-time team channel) and funnel.js
 * (KPI-grid commentary).
 *
 * @param {{
 *   collection: string,
 *   list: Array<ConvMessage>,
 *   currentUser: { id: string, name: string }|null,
 *   placeholder?: string,
 *   onSubmit: (body: string) => void|Promise<void>,
 *   onDelete?: (id: string) => void|Promise<void>,
 * }} opts
 * @returns {HTMLElement}
 */
export function renderConversation(opts) {
  const { collection, list, currentUser, placeholder, onSubmit, onDelete } = opts;
  const root = h("section", { class: `conversation conversation--${collection}` });

  if (list.length === 0) {
    root.appendChild(
      h("p", { class: "conversation__empty" }, placeholder || "No messages yet."),
    );
  } else {
    const ul = h("ul", { class: "conversation__list" });
    for (const m of list) {
      const li = h("li", { class: "conversation__item", "data-id": m.id }, [
        h("span", { class: "conversation__author" }, initials(m.author)),
        h("p", { class: "conversation__body" }, m.body),
        h("time", { class: "conversation__time" }, formatWhen(m.createdAt)),
      ]);
      if (
        onDelete &&
        currentUser &&
        firstNameFromAuthor({ authorName: m.author }) ===
          firstNameFromAuthor({ authorName: currentUser.name })
      ) {
        const del = h(
          "button",
          { class: "conversation__delete", "aria-label": "Delete" },
          "x",
        );
        del.addEventListener("click", () => {
          void onDelete(m.id);
        });
        li.appendChild(del);
      }
      ul.appendChild(li);
    }
    root.appendChild(ul);
  }

  const ta = h("textarea", {
    class: "conversation__input",
    placeholder: "Write a message...",
    rows: 2,
  });
  const send = h("button", { class: "conversation__send" }, "Send");
  send.addEventListener("click", () => {
    const body = /** @type {HTMLTextAreaElement} */ (ta).value.trim();
    if (!body) return;
    /** @type {HTMLTextAreaElement} */ (ta).value = "";
    void onSubmit(body);
  });
  root.appendChild(h("div", { class: "conversation__compose" }, [ta, send]));

  return root;
}
