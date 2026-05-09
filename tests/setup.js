// tests/setup.js
// @ts-check
import { vi, beforeEach, afterEach } from "vitest";
import { makeChartStub } from "./mocks/chartjs.js";

// -- Time + UUID determinism (D-09) ------------------------------------
beforeEach(() => {
  vi.useFakeTimers({
    now: new Date("2026-01-01T00:00:00.000Z"),
    toFake: ["Date", "setTimeout", "setInterval", "clearTimeout", "clearInterval"],
  });

  let counter = 0;
  vi.spyOn(crypto, "randomUUID").mockImplementation(() => {
    counter++;
    const hex = counter.toString(16).padStart(12, "0");
    return /** @type {`${string}-${string}-${string}-${string}-${string}`} */ (
      `00000000-0000-4000-8000-${hex}`
    );
  });

  // Phase 4 (CODE-03): the Math.random=0.5 spy was removed once src/util/ids.js
  // swapped to crypto.randomUUID. No production code uses Math.random anymore;
  // ESLint no-restricted-syntax + security/detect-pseudoRandomBytes are the
  // regression fences against re-introduction.
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

// -- DOM API stubs happy-dom doesn't ship (D-14) -----------------------
if (typeof window.matchMedia === "undefined") {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver || MockResizeObserver;

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
globalThis.IntersectionObserver = globalThis.IntersectionObserver || MockIntersectionObserver;

// -- Chart.js stub (D-09 + D-14) ---------------------------------------
vi.mock("chart.js", () => makeChartStub());
globalThis.Chart = (await import("./mocks/chartjs.js")).GlobalChartStub;
