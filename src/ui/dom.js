// src/ui/dom.js
// @ts-check
// Phase 4 Wave 2 (CODE-04 / D-12 / D-19): byte-identical extraction from
// app.js:526-547 EXCEPT the `html:` branch is DELETED. Closes the cleanup-
// ledger row at app.js:676 (`no-unsanitized/property` disable) and the
// `// eslint-disable-next-line no-unused-vars` row at app.js:527 (the $$
// helper is now legitimately exported and consumed by ui/* modules).
//
// The XSS regression test at tests/ui/dom.test.js asserts <script> and
// <img onerror> payloads render as text content — that fixture is permanent
// per D-19 / CODE-04 / OWASP ASVS V5.3 (Output Encoding / XSS prevention)
// and ISO 27001:2022 A.8.28 (Secure coding). Future ESLint disables that
// re-introduce `innerHTML =` in any new module fail this fence.

/** @param {string} sel @param {ParentNode} [el] */
export const $ = (sel, el = document) => el.querySelector(sel);

/** @param {string} sel @param {ParentNode} [el] */
export const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

/**
 * @param {string} tag
 * @param {Record<string, any>} [attrs]
 * @param {*} [children]
 * @returns {HTMLElement}
 */
export const h = (tag, attrs = {}, children = []) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") el.className = v;
    // `html:` branch DELETED (CODE-04). Use children for text/element content.
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (v === false || v === null || v === undefined) continue;
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c === null || c === undefined || c === false) return;
    if (typeof c === "string" || typeof c === "number")
      el.appendChild(document.createTextNode(String(c)));
    else el.appendChild(c);
  });
  return el;
};
