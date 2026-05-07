// tests/ui/modal.test.js
// @ts-check
// Phase 4 Wave 2 (D-12): faithful-extraction smoke test for src/ui/modal.js.
// modal/promptText/confirmDialog were extracted byte-identical from app.js:550-616;
// the IIFE-resident closure references to h() were rewritten to imports.
import { describe, it, expect, beforeEach } from "vitest";
import { modal, promptText, confirmDialog } from "../../src/ui/modal.js";
import { h } from "../../src/ui/dom.js";

beforeEach(() => {
  document.body.innerHTML = '<div id="modalRoot"></div>';
});

describe("modal()", () => {
  it("mounts content into #modalRoot and removes the hidden class", () => {
    modal([h("h3", {}, "Hello")]);
    const root = /** @type {HTMLElement} */ (document.getElementById("modalRoot"));
    expect(root.classList.contains("hidden")).toBe(false);
    expect(root.querySelector(".modal h3")?.textContent).toBe("Hello");
  });

  it("returns a handle whose close() programmatically dismisses", () => {
    const m = modal([h("p", {}, "x")]);
    const root = /** @type {HTMLElement} */ (document.getElementById("modalRoot"));
    expect(root.classList.contains("hidden")).toBe(false);
    m.close();
    expect(root.classList.contains("hidden")).toBe(true);
    expect(root.innerHTML).toBe("");
  });

  it("closes when the user clicks on the root backdrop (event.target === root)", () => {
    modal([h("p", {}, "x")]);
    const root = /** @type {HTMLElement} */ (document.getElementById("modalRoot"));
    const ev = new Event("click", { bubbles: true });
    Object.defineProperty(ev, "target", { value: root });
    root.dispatchEvent(ev);
    expect(root.classList.contains("hidden")).toBe(true);
  });

  it("does NOT close when click target is a descendant (not the root)", () => {
    modal([h("p", { id: "child" }, "x")]);
    const root = /** @type {HTMLElement} */ (document.getElementById("modalRoot"));
    const child = /** @type {HTMLElement} */ (root.querySelector("#child"));
    const ev = new Event("click", { bubbles: true });
    Object.defineProperty(ev, "target", { value: child });
    root.dispatchEvent(ev);
    expect(root.classList.contains("hidden")).toBe(false);
  });
});

describe("promptText()", () => {
  it("renders an input + Cancel + Save and invokes onSubmit with trimmed value", () => {
    let captured = "";
    promptText("Title", "placeholder", (v) => {
      captured = v;
    });
    const root = /** @type {HTMLElement} */ (document.getElementById("modalRoot"));
    const input = /** @type {HTMLInputElement} */ (root.querySelector("input"));
    expect(input).not.toBeNull();
    input.value = "  hello  ";
    const buttons = root.querySelectorAll("button");
    // Order is Cancel, Save
    expect(buttons[0].textContent).toBe("Cancel");
    expect(buttons[1].textContent).toBe("Save");
    /** @type {HTMLButtonElement} */ (buttons[1]).click();
    expect(captured).toBe("hello");
  });

  it("does not submit on empty (whitespace-only) input", () => {
    let calls = 0;
    promptText("Title", "ph", () => {
      calls++;
    });
    const root = /** @type {HTMLElement} */ (document.getElementById("modalRoot"));
    const input = /** @type {HTMLInputElement} */ (root.querySelector("input"));
    input.value = "   ";
    const save = /** @type {HTMLButtonElement} */ (root.querySelectorAll("button")[1]);
    save.click();
    expect(calls).toBe(0);
  });
});

describe("confirmDialog()", () => {
  it("renders title + message and invokes onOk on the confirm button", () => {
    let confirmed = 0;
    confirmDialog("Are you sure?", "Permanent action.", () => {
      confirmed++;
    }, "Delete");
    const root = /** @type {HTMLElement} */ (document.getElementById("modalRoot"));
    expect(root.querySelector("h3")?.textContent).toBe("Are you sure?");
    expect(root.querySelector("p")?.textContent).toBe("Permanent action.");
    const buttons = root.querySelectorAll("button");
    expect(buttons[0].textContent).toBe("Cancel");
    expect(buttons[1].textContent).toBe("Delete");
    /** @type {HTMLButtonElement} */ (buttons[1]).click();
    expect(confirmed).toBe(1);
    expect(root.classList.contains("hidden")).toBe(true);
  });
});
