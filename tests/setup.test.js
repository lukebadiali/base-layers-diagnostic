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

  // Phase 4 (CODE-03): the Math.random=0.5 spy was removed from tests/setup.js
  // when src/util/ids.js swapped to crypto.randomUUID. No production code uses
  // Math.random anymore (verified via `git grep "Math.random" src/`); the spy
  // is no longer load-bearing. The eslint no-restricted-syntax rule + the
  // security/detect-pseudoRandomBytes lint guard remain the regression fences.
});
