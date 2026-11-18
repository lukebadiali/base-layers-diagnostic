// tests/views/knowledge-widget.test.js
// @ts-check
// Client-facing "Ask about your sessions" box: build flag, answers as text,
// unanswered as a sentence, and a plain message while client access is off.
import { describe, it, expect, vi } from "vitest";
import { createKnowledgeWidget, knowledgeWidgetEnabled } from "../../src/views/knowledge-widget.js";

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

/** @param {*} ask */
function setup(ask) {
  const el = createKnowledgeWidget({ orgName: "Northwind Analytics", ask });
  document.body.replaceChildren(el);
  const q = /** @type {HTMLInputElement} */ (el.querySelector("input"));
  const btn = /** @type {HTMLButtonElement} */ (el.querySelector("button"));
  return { el, q, btn };
}

describe("knowledge widget", () => {
  it("is on only when the build flag is exactly 1", () => {
    expect(knowledgeWidgetEnabled({ VITE_KNOWLEDGE_CLIENT: "1" })).toBe(true);
    expect(knowledgeWidgetEnabled({ VITE_KNOWLEDGE_CLIENT: "true" })).toBe(false);
    expect(knowledgeWidgetEnabled({})).toBe(false);
  });

  it("names the client and answers as a list, rendered as text not HTML", async () => {
    const ask = vi.fn(async () => ({
      answer: "- You agreed <b>x</b>\n- Second point",
      answered: true,
    }));
    const { el, q, btn } = setup(ask);
    expect(el.textContent).toMatch(/delivered to Northwind Analytics/);
    q.value = "Who is our ideal customer?";
    btn.click();
    await flush();
    expect(ask).toHaveBeenCalledWith("Who is our ideal customer?");
    const items = [...el.querySelectorAll("li")].map((li) => li.textContent);
    expect(items).toEqual(["You agreed <b>x</b>", "Second point"]);
    expect(el.querySelector("b")).toBeNull();
  });

  it("shows an unanswered reply as a sentence", async () => {
    const { el, q, btn } = setup(
      vi.fn(async () => ({ answer: "That hasn't been covered yet.", answered: false })),
    );
    q.value = "TikTok?";
    btn.click();
    await flush();
    expect(el.querySelector("li")).toBeNull();
    expect(el.querySelector(".knowledge-answer")?.textContent).toBe(
      "That hasn't been covered yet.",
    );
  });

  it("says plainly when client access is not switched on", async () => {
    const err = Object.assign(new Error("The knowledge agent is not available yet"), {
      code: "functions/failed-precondition",
    });
    const { el, q, btn } = setup(vi.fn(async () => Promise.reject(err)));
    q.value = "Anything";
    btn.click();
    await flush();
    expect(el.querySelector(".knowledge-answer")?.textContent).toMatch(
      /isn't switched on for your account yet/,
    );
  });

  it("ignores an empty question and submits on Enter", async () => {
    const ask = vi.fn(async () => ({ answer: "ok", answered: true }));
    const { q, btn } = setup(ask);
    btn.click();
    await flush();
    expect(ask).not.toHaveBeenCalled();
    q.value = "Hello";
    q.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter" }));
    await flush();
    expect(ask).toHaveBeenCalledWith("Hello");
  });
});
