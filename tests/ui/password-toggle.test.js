// tests/ui/password-toggle.test.js
// @ts-check
// Unit tests for the reusable show/hide toggle bound to a password input.
import { describe, it, expect } from "vitest";
import { createVisibilityToggle } from "../../src/ui/password-toggle.js";

/** @returns {HTMLInputElement} */
function pwInput() {
  const i = document.createElement("input");
  i.type = "password";
  i.value = "hunter2";
  return i;
}

describe("createVisibilityToggle", () => {
  it("returns a type=button element and starts masked + unpressed", () => {
    const input = pwInput();
    const btn = createVisibilityToggle(input);
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.getAttribute("type")).toBe("button");
    expect(input.type).toBe("password");
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  });

  it("reveals the input on click and re-masks on a second click", () => {
    const input = pwInput();
    const btn = createVisibilityToggle(input);

    btn.click();
    expect(input.type).toBe("text");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(btn.classList.contains("is-revealed")).toBe(true);

    btn.click();
    expect(input.type).toBe("password");
    expect(btn.getAttribute("aria-pressed")).toBe("false");
    expect(btn.classList.contains("is-revealed")).toBe(false);
  });

  it("labels the action for screen readers and flips the label with state", () => {
    const input = pwInput();
    const btn = createVisibilityToggle(input, { label: "passphrase" });
    expect(btn.getAttribute("aria-label")).toBe("Show passphrase");
    btn.click();
    expect(btn.getAttribute("aria-label")).toBe("Hide passphrase");
  });
});
