// tests/ui/dom.test.js
// @ts-check

/**
 * REGRESSION FIXTURE — permanent (Phase 4 Wave 2, CODE-04)
 *
 * The `html:` escape hatch in h() was deleted in Phase 4 (CONCERNS C4 closure).
 * These payloads MUST render as text content forever — any future ESLint
 * disable that re-enables innerHTML in a new file should fail this test
 * even if the test wasn't updated for that file (because the dom.js attribute
 * surface no longer takes `html:`). The XSS regression payloads remain pinned
 * here as a permanent fence: <script> + <img onerror> are the canonical XSS
 * vectors and removing/relaxing these assertions requires explicit Phase 10+
 * threat-model sign-off.
 *
 * Citations: OWASP ASVS V5.3 (Output Encoding / XSS prevention),
 * ISO/IEC 27001:2022 A.8.28 (Secure coding), GDPR Art. 32(1)(b)
 * (Confidentiality of processing — XSS prevention).
 */

import { describe, it, expect } from "vitest";
import { h, $, $$ } from "../../src/ui/dom.js";

describe("h() XSS-regression payloads (CODE-04 — REGRESSION FIXTURE)", () => {
  it("renders <script> tags inside string children as text content, not as DOM script", () => {
    const el = h("div", {}, "<script>window.__xss = true</script>");
    document.body.appendChild(el);
    expect(el.textContent).toBe("<script>window.__xss = true</script>");
    expect(el.querySelector("script")).toBeNull();
    expect(/** @type {*} */ (window).__xss).toBeUndefined();
  });

  it("renders <img src=x onerror=...> as text content, not as a DOM <img>", () => {
    const el = h("div", {}, '<img src=x onerror="window.__xss=true">');
    document.body.appendChild(el);
    expect(el.querySelector("img")).toBeNull();
    expect(/** @type {*} */ (window).__xss).toBeUndefined();
  });

  it("does NOT honour any attribute named 'html' (the branch was deleted)", () => {
    // Purposely passing the deleted attr; runtime ignores. Cast to any so the
    // JSDoc type for attrs (Record<string, any>) accepts the call without
    // // @ts-expect-error gymnastics — the runtime behaviour is what matters.
    const el = h("div", /** @type {*} */ ({ html: "<b>not honoured</b>" }));
    expect(el.textContent).toBe(""); // no children consumed; html: is now opaque
    expect(el.querySelector("b")).toBeNull();
  });
});

describe("h() control-case attributes (unchanged behaviour)", () => {
  it("sets className when attrs has class", () => {
    const el = h("div", { class: "foo" }, []);
    expect(el.className).toBe("foo");
  });

  it("registers event listeners for on* attributes", () => {
    let clicked = 0;
    const el = h("button", { onclick: () => clicked++ }, "click");
    el.click();
    expect(clicked).toBe(1);
  });

  it("treats true value as bare attribute and false/null/undefined as omitted", () => {
    const el = h("input", { type: "checkbox", checked: true, disabled: false }, []);
    expect(el.getAttribute("checked")).toBe("");
    expect(el.hasAttribute("disabled")).toBe(false);
  });

  it("appends string children as text nodes", () => {
    const el = h("p", {}, "hello");
    expect(el.textContent).toBe("hello");
  });

  it("appends number children as text nodes", () => {
    const el = h("p", {}, 42);
    expect(el.textContent).toBe("42");
  });

  it("appends element children as-is", () => {
    const span = h("span", {}, "child");
    const el = h("div", {}, [span]);
    expect(el.querySelector("span")).toBe(span);
  });
});

describe("$ and $$ query helpers", () => {
  it("$ returns a single match via querySelector", () => {
    document.body.innerHTML = '<div id="needle"></div>';
    const el = $("#needle");
    expect(el).not.toBeNull();
  });

  it("$$ returns an array (not NodeList) of matches", () => {
    document.body.innerHTML = '<span class="x"></span><span class="x"></span>';
    const els = $$(".x");
    expect(Array.isArray(els)).toBe(true);
    expect(els.length).toBe(2);
  });
});
