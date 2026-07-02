// tests/ui/pending-button.test.js
// @ts-check
// Unit tests for the shared pending-state controller used by every slow-async
// button (sign-in, sign-out, invite create, invite reset). One owner for the
// .is-loading CSS contract in styles.css.
import { describe, it, expect } from "vitest";
import { pendingButton } from "../../src/ui/pending-button.js";

/** @returns {HTMLButtonElement} */
function btn() {
  const b = document.createElement("button");
  b.textContent = "Create account";
  return b;
}

describe("pendingButton", () => {
  it("start() disables the button, adds .is-loading and swaps the label", () => {
    const b = btn();
    const pending = pendingButton(b, "Creating…");
    pending.start();
    expect(b.disabled).toBe(true);
    expect(b.classList.contains("is-loading")).toBe(true);
    expect(b.textContent).toBe("Creating…");
  });

  it("stop() restores the idle label captured at construction", () => {
    const b = btn();
    const pending = pendingButton(b, "Creating…");
    pending.start();
    pending.stop();
    expect(b.disabled).toBe(false);
    expect(b.classList.contains("is-loading")).toBe(false);
    expect(b.textContent).toBe("Create account");
  });

  it("a double start() cannot lose the idle label", () => {
    const b = btn();
    const pending = pendingButton(b, "Creating…");
    pending.start();
    pending.start();
    pending.stop();
    expect(b.textContent).toBe("Create account");
  });

  it("controllers built inside a click handler capture the current label", () => {
    const b = btn();
    b.textContent = "Yes, reset";
    const pending = pendingButton(b, "Resetting…");
    pending.start();
    expect(b.textContent).toBe("Resetting…");
    pending.stop();
    expect(b.textContent).toBe("Yes, reset");
  });
});
