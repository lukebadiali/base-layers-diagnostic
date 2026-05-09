// tests/views/_shared/render-conversation.test.js
// @ts-check
// Phase 4 Wave 4 (CODE-08 / D-20): contract test for the shared
// renderConversation helper that chat.js + funnel.js will adopt in Wave 5
// (when the IIFE bodies extract to standalone DOM-emitting modules).
//
// The helper is genuinely new code (M8 closure substrate) — its tests verify
// the input/output contract independent of the IIFE-resident chat/funnel
// renderers.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderConversation } from "../../../src/views/_shared/render-conversation.js";

describe("src/views/_shared/render-conversation.js (CODE-08 — chat + funnel duplication closure)", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("exports renderConversation as a function", () => {
    expect(typeof renderConversation).toBe("function");
  });

  it("returns an HTMLElement with class conversation--<collection>", () => {
    const el = renderConversation({
      collection: "chat",
      list: [],
      currentUser: null,
      onSubmit: () => {},
    });
    expect(el).toBeInstanceOf(HTMLElement);
    expect(el.className).toContain("conversation");
    expect(el.className).toContain("conversation--chat");
  });

  it("renders empty-state placeholder when list is empty", () => {
    const el = renderConversation({
      collection: "funnel",
      list: [],
      currentUser: null,
      onSubmit: () => {},
      placeholder: "No comments yet.",
    });
    expect(el.querySelector(".conversation__empty")?.textContent).toBe("No comments yet.");
  });

  it("renders messages from list with author, body, time", () => {
    const el = renderConversation({
      collection: "chat",
      list: [
        { id: "m1", body: "Hello", author: "Alice", createdAt: 1000 },
        { id: "m2", body: "World", author: "Bob", createdAt: 2000 },
      ],
      currentUser: { id: "u1", name: "Alice" },
      onSubmit: () => {},
    });
    const items = el.querySelectorAll(".conversation__item");
    expect(items.length).toBe(2);
    expect(items[0].getAttribute("data-id")).toBe("m1");
    expect(items[0].querySelector(".conversation__body")?.textContent).toBe("Hello");
  });

  it("invokes onSubmit with trimmed body when send is clicked", async () => {
    const onSubmit = vi.fn();
    const el = renderConversation({
      collection: "chat",
      list: [],
      currentUser: { id: "u1", name: "Alice" },
      onSubmit,
    });
    document.body.appendChild(el);
    const ta = /** @type {HTMLTextAreaElement} */ (el.querySelector(".conversation__input"));
    const send = /** @type {HTMLButtonElement} */ (el.querySelector(".conversation__send"));
    ta.value = "  hello world  ";
    send.click();
    // microtask flush
    await Promise.resolve();
    expect(onSubmit).toHaveBeenCalledWith("hello world");
  });

  it("does not invoke onSubmit when body is empty/whitespace-only", () => {
    const onSubmit = vi.fn();
    const el = renderConversation({
      collection: "chat",
      list: [],
      currentUser: null,
      onSubmit,
    });
    const ta = /** @type {HTMLTextAreaElement} */ (el.querySelector(".conversation__input"));
    const send = /** @type {HTMLButtonElement} */ (el.querySelector(".conversation__send"));
    ta.value = "   ";
    send.click();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
