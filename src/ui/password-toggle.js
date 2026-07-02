// src/ui/password-toggle.js
// @ts-check
// Reusable show/hide ("eye") toggle bound to a password input. Clicking flips
// the input between masked (type=password) and visible (type=text). Accessible:
// aria-pressed reflects visibility and aria-label describes the action. Purely
// presentational — no data or Firebase dependency.
import { h as defaultH } from "./dom.js";

/**
 * @param {HTMLInputElement} input - the password input to reveal/mask
 * @param {{ h?: (tag: string, attrs?: *, children?: *) => HTMLElement, label?: string }} [opts]
 * @returns {HTMLButtonElement}
 */
export function createVisibilityToggle(input, opts = {}) {
  const h = opts.h || defaultH;
  const noun = opts.label || "password";
  const btn = /** @type {HTMLButtonElement} */ (
    h(
      "button",
      {
        type: "button",
        class: "pw-toggle",
        "aria-pressed": "false",
        "aria-label": "Show " + noun,
        title: "Show " + noun,
      },
      "👁",
    )
  );

  function sync() {
    const revealed = input.type === "text";
    btn.setAttribute("aria-pressed", String(revealed));
    btn.setAttribute("aria-label", (revealed ? "Hide " : "Show ") + noun);
    btn.setAttribute("title", (revealed ? "Hide " : "Show ") + noun);
    btn.classList.toggle("is-revealed", revealed);
  }

  btn.addEventListener("click", () => {
    input.type = input.type === "password" ? "text" : "password";
    sync();
  });

  return btn;
}
