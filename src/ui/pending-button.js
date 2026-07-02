// src/ui/pending-button.js
// @ts-check
// Shared pending-state controller for buttons that kick off a slow async
// action (sign-in / sign-out / invite create / invite reset). start() disables
// the button, adds the .is-loading spinner hook (styles.css) and swaps the
// label; stop() restores the idle label captured at construction. This is the
// single JS owner of the .is-loading CSS contract — call sites must not
// hand-roll the class/label dance (four copies had already drifted apart
// before this module existed).
//
// Callers that navigate away on success (sign-in / sign-out) simply never call
// stop() — the pending state holds through the page swap by design.

/**
 * @param {HTMLButtonElement} btn
 * @param {string} pendingLabel
 * @returns {{ start: () => void, stop: () => void }}
 */
export function pendingButton(btn, pendingLabel) {
  const idleLabel = btn.textContent;
  return {
    start() {
      btn.disabled = true;
      btn.classList.add("is-loading");
      btn.textContent = pendingLabel;
    },
    stop() {
      btn.disabled = false;
      btn.classList.remove("is-loading");
      btn.textContent = idleLabel;
    },
  };
}
