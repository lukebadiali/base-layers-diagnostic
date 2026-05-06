// tests/setup.test.js
// @ts-check
// Phase 2 (D-09): Preflight test for tests/setup.js. Verifies the global
// determinism harness is in place before any extraction wave begins.
import { describe, it, expect } from "vitest";

describe("tests/setup.js preflight", () => {
  it("freezes Date at 2026-01-01T00:00:00.000Z (D-09)", () => {
    expect(new Date().toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("returns deterministic counter-shaped UUIDs (D-09)", () => {
    const a = crypto.randomUUID();
    const b = crypto.randomUUID();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^00000000-0000-4000-8000-[0-9a-f]{12}$/);
    expect(b).toMatch(/^00000000-0000-4000-8000-[0-9a-f]{12}$/);
  });

  it("pins Math.random to 0.5 (D-09)", () => {
    // eslint-disable-next-line no-restricted-syntax -- intentional: this test verifies the Math.random spy in tests/setup.js
    expect(Math.random()).toBe(0.5);
  });
});
