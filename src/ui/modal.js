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
import { pendingButton } from "./pending-button.js";
import { notify } from "./toast.js";

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
 * Async-aware dispatch for modal confirm buttons. Sync callbacks (returning
 * undefined) close immediately — the original contract. A thenable return
 * keeps the modal open with a pending spinner (shared pendingButton
 * vocabulary) until it settles: close on resolve; on reject stay open,
 * restore the buttons and surface the error as a toast so the user can
 * retry or cancel. Scope item 2 (2026-07): gives slow Cloud-Function-backed
 * actions visible feedback instead of an instantly-closing modal.
 *
 * @param {HTMLButtonElement} okBtn
 * @param {HTMLButtonElement} cancelBtn
 * @param {string} pendingLabel
 * @param {() => *} action
 * @param {() => void} close
 */
function runModalAction(okBtn, cancelBtn, pendingLabel, action, close) {
  let result;
  try {
    result = action();
  } catch (err) {
    notify("error", (err && /** @type {*} */ (err).message) || "Action failed");
    return;
  }
  if (!result || typeof result.then !== "function") {
    close();
    return;
  }
  const pending = pendingButton(okBtn, pendingLabel);
  pending.start();
  cancelBtn.disabled = true;
  result.then(
    () => close(),
    (/** @type {*} */ err) => {
      pending.stop();
      cancelBtn.disabled = false;
      notify("error", (err && err.message) || "Action failed");
    },
  );
}

/**
 * @param {string} title
 * @param {string} placeholder
 * @param {(value: string) => (void|Promise<*>)} onSubmit
 * @param {string} [initial]
 */
export function promptText(title, placeholder, onSubmit, initial = "") {
  const input = /** @type {HTMLInputElement} */ (h("input", { type: "text", placeholder }));
  input.value = initial;
  const cancel = /** @type {HTMLButtonElement} */ (
    h("button", { class: "btn secondary", onclick: () => m.close() }, "Cancel")
  );
  const ok = /** @type {HTMLButtonElement} */ (
    h(
      "button",
      {
        class: "btn",
        onclick: () => {
          const v = input.value.trim();
          if (!v) return;
          runModalAction(
            ok,
            cancel,
            "Saving…",
            () => onSubmit(v),
            () => m.close(),
          );
        },
      },
      "Save",
    )
  );
  input.addEventListener("keydown", (e) => {
    if (/** @type {KeyboardEvent} */ (e).key === "Enter")
      /** @type {HTMLButtonElement} */ (ok).click();
  });
  const m = modal([h("h3", {}, title), input, h("div", { class: "row" }, [cancel, ok])]);
  setTimeout(() => input.focus(), 10);
}

/**
 * @param {string} title
 * @param {string} message
 * @param {() => (void|Promise<*>)} onOk
 * @param {string} [okLabel]
 */
export function confirmDialog(title, message, onOk, okLabel = "Confirm") {
  const cancel = /** @type {HTMLButtonElement} */ (
    h("button", { class: "btn secondary", onclick: () => m.close() }, "Cancel")
  );
  const ok = /** @type {HTMLButtonElement} */ (
    h(
      "button",
      {
        class: "btn",
        onclick: () => runModalAction(ok, cancel, "Working…", onOk, () => m.close()),
      },
      okLabel,
    )
  );
  const m = modal([
    h("h3", {}, title),
    h("p", { style: "color: var(--ink-2); font-size: 14px;" }, message),
    h("div", { class: "row" }, [cancel, ok]),
  ]);
}
