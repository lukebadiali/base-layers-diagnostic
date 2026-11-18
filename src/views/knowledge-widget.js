// src/views/knowledge-widget.js
// @ts-check
// Client Knowledge Agent: the client-facing "Ask about your sessions" box on
// the dashboard.
//
// Shown only in the client view (a client, or staff with the Internal toggle
// off) and only when the build sets VITE_KNOWLEDGE_CLIENT=1. Access is
// decided on the server, never here: a client's question is answered from
// their own organisation only (taken from their login, not from this page),
// and clients are refused until knowledgeConfig/access { clientAccess: true }
// exists. Clients never see which sessions an answer drew on.
import { h as defaultH } from "../ui/dom.js";
import { pendingButton } from "../ui/pending-button.js";
import { bulletItems } from "./knowledge-admin.js";

/** @param {Record<string, unknown> | undefined} [env] */
export function knowledgeWidgetEnabled(env = import.meta.env) {
  return env?.VITE_KNOWLEDGE_CLIENT === "1";
}

const NOT_ON_YET = "The knowledge assistant isn't switched on for your account yet.";

/**
 * @typedef {{ answer: string, answered: boolean }} WidgetAnswer
 * @typedef {{
 *   orgName: string,
 *   ask: (question: string) => Promise<WidgetAnswer>,
 *   h?: typeof defaultH,
 * }} KnowledgeWidgetDeps
 * @typedef {HTMLElement & { restoreFocus: () => void }} KnowledgeWidget
 */

/**
 * @param {KnowledgeWidgetDeps} deps
 * @returns {KnowledgeWidget}
 */
export function createKnowledgeWidget(deps) {
  const h = deps.h ?? defaultH;
  const root = /** @type {KnowledgeWidget} */ (
    h("section", { class: "card knowledge-widget", "aria-label": "Ask about your sessions" })
  );
  const question = /** @type {HTMLInputElement} */ (
    h("input", {
      type: "text",
      class: "knowledge-question",
      maxlength: "500",
      placeholder: "e.g. Who did we agree is our ideal customer?",
      "aria-label": "Your question",
    })
  );
  const askBtn = /** @type {HTMLButtonElement} */ (h("button", { class: "btn" }, "Ask"));
  const pending = pendingButton(askBtn, "Thinking…");
  const answerBox = h("div", { class: "knowledge-answer", "aria-live": "polite" });

  root.append(
    h("h3", { class: "section-h3-tight" }, "Ask about your sessions"),
    h(
      "p",
      { class: "muted-paragraph" },
      `Answers come only from the sessions BeDeveloped has delivered to ${deps.orgName}.`,
    ),
    h("div", { class: "row" }, [question, askBtn]),
    answerBox,
  );

  async function run() {
    const q = question.value.trim();
    if (!q) return;
    pending.start();
    answerBox.replaceChildren();
    try {
      const r = await deps.ask(q);
      const items = r.answered ? bulletItems(r.answer) : null;
      answerBox.replaceChildren(
        items
          ? h(
              "ul",
              { class: "knowledge-answer-text" },
              items.map((t) => h("li", {}, t)),
            )
          : h("div", { class: "knowledge-answer-text" }, r.answer),
      );
    } catch (err) {
      const e = /** @type {*} */ (err);
      const notOn =
        e?.code === "functions/failed-precondition" || e?.code === "failed-precondition";
      answerBox.replaceChildren(
        h(
          "div",
          { class: notOn ? "knowledge-hint" : "auth-error" },
          notOn ? NOT_ON_YET : e?.message || "The assistant couldn't answer just now.",
        ),
      );
    } finally {
      pending.stop();
    }
  }
  askBtn.addEventListener("click", () => void run());
  question.addEventListener("keydown", (e) => {
    if (/** @type {KeyboardEvent} */ (e).key === "Enter") void run();
  });

  // The dashboard re-renders on live data; keep the client's place in the box.
  let hadFocus = false;
  question.addEventListener("focus", () => (hadFocus = true));
  question.addEventListener("blur", (e) => {
    const to = /** @type {FocusEvent} */ (e).relatedTarget;
    if (to) hadFocus = false;
  });
  root.restoreFocus = () => {
    const active = document.activeElement;
    if (hadFocus && (!active || active === document.body)) question.focus({ preventScroll: true });
  };
  return root;
}
