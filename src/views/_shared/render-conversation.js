// src/views/_shared/render-conversation.js
// @ts-check
// Phase 4 Wave 4 (CODE-08 / D-20): shared helpers for chat.js + funnel.js
// (M8 closure substrate — chat-vs-funnel-comments duplication target).
//
// Exports two helpers:
//   1. renderConversation(opts) — generic future-shape helper (the
//      conversation__* BEM-ish CSS class set). Used by Wave 5 when
//      chat.js + funnel.js view modules adopt the body. Tests pin this
//      shape at tests/views/_shared/render-conversation.test.js.
//   2. renderConversationBubble(opts) — production-shape bubble helper
//      (chat-bubble / comment-bubble class shape). Used TODAY by the
//      IIFE-resident renderChat (app.js:3355) + renderFunnel comment
//      block (app.js:4500-4604) — both call it for each message,
//      closing CODE-08 / M8 without disturbing production DOM.
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


/**
 * Production-shape bubble helper — emits a single message bubble in the
 * IIFE existing chat-bubble / comment-bubble shape. Used by the IIFE-
 * resident renderChat (app.js:3355) + renderFunnel comment block
 * (app.js:4500-4604) — both call this for each message instead of
 * inlining the bubble construction (M8 closure / CODE-08).
 *
 * @param {{
 *   message: { id: string, text: string, authorId: string, authorName?: string, authorEmail?: string, authorRole?: string, createdAt?: { toDate?: () => Date } },
 *   isSelf: boolean,
 *   canDelete: boolean,
 *   bg: string,
 *   bubbleClass: string,
 *   metaClass: string,
 *   textClass: string,
 *   delClass: string,
 *   onDelete: () => void,
 * }} opts
 * @returns {HTMLElement}
 */
export function renderConversationBubble(opts) {
  const {
    message: m,
    isSelf,
    canDelete,
    bg,
    bubbleClass,
    metaClass,
    textClass,
    delClass,
    onDelete,
  } = opts;
  const ts = m.createdAt?.toDate?.().toLocaleString?.() || "";
  const who = firstNameFromAuthor(m);
  const bubble = h(
    "div",
    {
      class: bubbleClass,
      style: `align-self:${isSelf ? "flex-end" : "flex-start"}; background:${bg}; border-color:${bg};`,
    },
    [
      h("div", { class: metaClass }, `${who} · ${ts}`),
      h("div", { class: textClass }, m.text),
    ],
  );
  if (canDelete) {
    const del = h(
      "button",
      {
        class: delClass,
        title: "Delete",
        onclick: (/** @type {Event} */ e) => {
          e.stopPropagation();
          onDelete();
        },
      },
      "×",
    );
    bubble.appendChild(del);
  }
  return bubble;
}
