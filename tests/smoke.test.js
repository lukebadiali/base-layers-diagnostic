// tests/smoke.test.js
// @ts-check

/**
 * Smoke test — exists only so `npm test` doesn't exit non-zero with
 * "No test files found". Real test coverage is Phase 2 (TEST-01..07 + TEST-10).
 *
 * Pulled forward from Wave 5 Plan 01-06 Task 1 Step 1 to unblock the
 * Wave 3 first-green-CI checkpoint. Vitest 4.x exits with code 1 when
 * no test files match — the plan assumed a benign warning.
 */
import { describe, it, expect } from "vitest";

describe("Smoke", () => {
  it("arithmetic works", () => {
    expect(1 + 1).toBe(2);
  });
});
