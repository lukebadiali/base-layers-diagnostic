// tests/ui/toast.test.js
// @ts-check
// Phase 4 Wave 2 (D-13 / D-14): notify() contract — 4 levels (info|success|warn|error)
// + role=status/role=alert + auto-dismiss tiers + MAX_VISIBLE=3 + eviction
// + focus-on-error + pause-on-hover. Per-view alert→notify wiring is Wave 4 (D-20).
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { notify } from "../../src/ui/toast.js";

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  // tests/setup.js wraps each test with vi.useFakeTimers; restore real timers
  // after the test if a test elects to use them, but the default is fake.
});

describe("notify() — container + level + role contracts (D-13)", () => {
  it("creates #toastRoot inside <body> on first call (lazy mount)", () => {
    expect(document.getElementById("toastRoot")).toBeNull();
    notify("info", "hello");
    const root = document.getElementById("toastRoot");
    expect(root).not.toBeNull();
    expect(root?.parentElement).toBe(document.body);
  });

  it("renders a .toast.toast-info[role=status] for an info message", () => {
    notify("info", "hello");
    const t = /** @type {HTMLElement|null} */ (document.querySelector(".toast.toast-info"));
    expect(t).not.toBeNull();
    expect(t?.getAttribute("role")).toBe("status");
    expect(t?.textContent).toContain("hello");
  });

  it("renders [role=alert] for error level (D-13 a11y interruption contract)", () => {
    notify("error", "boom");
    const t = /** @type {HTMLElement|null} */ (document.querySelector(".toast.toast-error"));
    expect(t).not.toBeNull();
    expect(t?.getAttribute("role")).toBe("alert");
  });

  it("renders the Unicode level symbol in .toast-icon (D-13)", () => {
    notify("success", "ok");
    const icon = document.querySelector(".toast-success .toast-icon");
    expect(icon?.textContent).toBe("✓");
  });
});

describe("notify() — auto-dismiss tiers (D-14)", () => {
  it("auto-dismisses info after 4000ms", () => {
    notify("info", "x");
    expect(document.querySelectorAll(".toast").length).toBe(1);
    vi.advanceTimersByTime(3999);
    expect(document.querySelectorAll(".toast").length).toBe(1);
    vi.advanceTimersByTime(1);
    expect(document.querySelectorAll(".toast").length).toBe(0);
  });

  it("auto-dismisses warn after 7000ms", () => {
    notify("warn", "x");
    vi.advanceTimersByTime(7000);
    expect(document.querySelectorAll(".toast").length).toBe(0);
  });

  it("does NOT auto-dismiss error toasts (sticky until manual close)", () => {
    notify("error", "boom");
    vi.advanceTimersByTime(60_000);
    expect(document.querySelectorAll(".toast.toast-error").length).toBe(1);
  });

  it("close button click removes the error toast", () => {
    notify("error", "boom");
    const close = /** @type {HTMLButtonElement|null} */ (
      document.querySelector(".toast.toast-error .toast-close")
    );
    expect(close).not.toBeNull();
    close?.click();
    expect(document.querySelectorAll(".toast.toast-error").length).toBe(0);
  });
});

describe("notify() — MAX_VISIBLE=3 + eviction (D-14)", () => {
  it("when 4th info arrives the oldest non-error evicts", () => {
    notify("info", "a");
    notify("info", "b");
    notify("info", "c");
    expect(document.querySelectorAll(".toast").length).toBe(3);
    notify("info", "d");
    const messages = Array.from(document.querySelectorAll(".toast .toast-message")).map(
      (n) => n.textContent,
    );
    // Oldest ("a") evicted; b/c/d remain.
    expect(messages).toEqual(["b", "c", "d"]);
  });
});

describe("notify() — error focus + pause-on-hover (D-14)", () => {
  it("focuses the close button on error level (a11y win for keyboard users)", () => {
    notify("error", "boom");
    const close = /** @type {HTMLButtonElement|null} */ (
      document.querySelector(".toast.toast-error .toast-close")
    );
    expect(document.activeElement).toBe(close);
  });

  it("pauses the auto-dismiss timer while hovering a non-error toast", () => {
    notify("info", "x");
    const node = /** @type {HTMLElement} */ (document.querySelector(".toast.toast-info"));
    vi.advanceTimersByTime(2000);
    node.dispatchEvent(new Event("mouseenter"));
    vi.advanceTimersByTime(10_000);
    expect(document.querySelectorAll(".toast.toast-info").length).toBe(1);
    node.dispatchEvent(new Event("mouseleave"));
    vi.advanceTimersByTime(4000);
    expect(document.querySelectorAll(".toast.toast-info").length).toBe(0);
  });
});
