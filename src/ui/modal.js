// src/ui/modal.js
// @ts-check
// Phase 4 Wave 2 (D-12): byte-identical extraction from app.js:550-616.
// modal / promptText / confirmDialog moved verbatim; the IIFE-resident
// closure references to h() were rewritten to `import { h } from "./dom.js"`.
//
// Phase 4 Wave 6 (CODE-05 forward-tracked): the two `root.innerHTML = ""`
// lines were replaced with `root.replaceChildren()` — DOM-equivalent for
// the clearing use case but consistent with the Wave 4 CODE-05 sweep across
// src/** + app.js production code (closes the cleanup-ledger forward-tracking
// row "Phase 4 Wave 2 — modal innerHTML reset").
//
// Per Phase 4 D-13: there are zero confirm()/prompt() sites in the codebase,
// so promptText/confirmDialog are NOT replacements for native prompts —
// they're the existing custom modal helper (used by views/* in Wave 4).
import { h } from "./dom.js";

/** @param {(HTMLElement|string|null|false)[]} content */
export function modal(content) {
  const root = /** @type {HTMLElement} */ (document.getElementById("modalRoot"));
  root.replaceChildren();
  const wrap = h("div", { class: "modal" }, content);
  root.appendChild(wrap);
  root.classList.remove("hidden");
  /** @param {Event & { isProgrammatic?: boolean }} ev */
  const close = (ev) => {
    if (ev && ev.target !== root && !ev.isProgrammatic) return;
    root.classList.add("hidden");
    root.replaceChildren();
    root.removeEventListener("click", /** @type {EventListener} */ (close));
  };
  root.addEventListener("click", /** @type {EventListener} */ (close));
  return {
    close: () => {
      const ev = /** @type {*} */ (new Event("click"));
      ev.isProgrammatic = true;
      Object.defineProperty(ev, "target", { value: root });
      close(ev);
    },
  };
}

/**
 * @param {string} title
 * @param {string} placeholder
 * @param {(value: string) => void} onSubmit
 * @param {string} [initial]
 */
export function promptText(title, placeholder, onSubmit, initial = "") {
  const input = /** @type {HTMLInputElement} */ (h("input", { type: "text", placeholder }));
  input.value = initial;
  const cancel = h("button", { class: "btn secondary", onclick: () => m.close() }, "Cancel");
  const ok = h(
    "button",
    {
      class: "btn",
      onclick: () => {
        const v = input.value.trim();
        if (!v) return;
        onSubmit(v);
        m.close();
      },
    },
    "Save",
  );
  input.addEventListener("keydown", (e) => {
    if (/** @type {KeyboardEvent} */ (e).key === "Enter") /** @type {HTMLButtonElement} */ (ok).click();
  });
  const m = modal([h("h3", {}, title), input, h("div", { class: "row" }, [cancel, ok])]);
  setTimeout(() => input.focus(), 10);
}

/**
 * @param {string} title
 * @param {string} message
 * @param {() => void} onOk
 * @param {string} [okLabel]
 */
export function confirmDialog(title, message, onOk, okLabel = "Confirm") {
  const m = modal([
    h("h3", {}, title),
    h("p", { style: "color: var(--ink-2); font-size: 14px;" }, message),
    h("div", { class: "row" }, [
      h("button", { class: "btn secondary", onclick: () => m.close() }, "Cancel"),
      h(
        "button",
        {
          class: "btn",
          onclick: () => {
            onOk();
            m.close();
          },
        },
        okLabel,
      ),
    ]),
  ]);
}
