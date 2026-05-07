// src/ui/toast.js
// @ts-check
// Phase 4 Wave 2 (D-13 / D-14, CODE-07): NEW toast helper substrate. Wave 4
// wires the 7 alert() sites in app.js per D-20 — this wave only ships the
// helper. notify() shape is intentionally minimal — Phase 9 (AUDIT-05) may
// extend opts to carry an auditEvent shape that wires through
// observability/audit-events.js (CONTEXT.md `<specifics>` 7th bullet).
import { h } from "./dom.js";

/** @typedef {"info"|"success"|"warn"|"error"} ToastLevel */

const SYMBOLS = /** @type {Record<ToastLevel,string>} */ ({
  info: "ⓘ",
  success: "✓",
  warn: "⚠",
  error: "✕",
});
const ROLE = /** @type {Record<ToastLevel,string>} */ ({
  info: "status",
  success: "status",
  warn: "status",
  error: "alert",
});
const AUTO_DISMISS_MS = /** @type {Record<ToastLevel, number|null>} */ ({
  info: 4000,
  success: 4000,
  warn: 7000,
  error: null, // error sticks until manual close (D-14)
});
const MAX_VISIBLE = 3;

/** @returns {HTMLElement} */
function ensureContainer() {
  let root = document.getElementById("toastRoot");
  if (!root) {
    root = h("aside", {
      id: "toastRoot",
      class: "toast-root",
      "aria-live": "polite",
    });
    document.body.appendChild(root);
  }
  return /** @type {HTMLElement} */ (root);
}

/**
 * Display a non-blocking toast notification (D-13 / D-14).
 *
 * @param {ToastLevel} level
 * @param {string} message
 * @param {{ persist?: boolean }} [opts]
 */
export function notify(level, message, opts = {}) {
  const root = ensureContainer();

  // Cap at MAX_VISIBLE — evict oldest non-error first (D-14)
  const existing = Array.from(root.querySelectorAll(".toast"));
  if (existing.length >= MAX_VISIBLE) {
    const evictable = existing.find((t) => t.getAttribute("data-level") !== "error");
    if (evictable) evictable.remove();
  }

  const closeBtn = /** @type {HTMLButtonElement} */ (
    h("button", { class: "toast-close", "aria-label": "Dismiss" }, "×")
  );
  const node = h(
    "div",
    {
      class: `toast toast-${level}`,
      role: ROLE[level],
      "data-level": level,
    },
    [
      h("span", { class: "toast-icon" }, SYMBOLS[level]),
      h("span", { class: "toast-message" }, message),
      closeBtn,
    ],
  );
  closeBtn.addEventListener("click", () => node.remove());

  root.appendChild(node);

  const dismissMs = AUTO_DISMISS_MS[level];
  if (dismissMs && !opts.persist) {
    let timer = setTimeout(() => node.remove(), dismissMs);
    // Pause-on-hover (D-14)
    node.addEventListener("mouseenter", () => clearTimeout(timer));
    node.addEventListener("mouseleave", () => {
      timer = setTimeout(() => node.remove(), dismissMs);
    });
  }

  // Focus the close button on errors (D-14 a11y win for keyboard users)
  if (level === "error") closeBtn.focus();
}
