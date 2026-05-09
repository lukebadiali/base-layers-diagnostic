// tests/cloud/retry.test.js
// @ts-check
// Phase 4 Wave 3 (D-11) smoke test. Phase 7 (FN-09) replaces the body with
// exponential-backoff + 429-aware retry. Today the stub is a pass-through —
// it invokes fn() exactly once and returns its result.
import { describe, it, expect, vi } from "vitest";
import { withRetry } from "../../src/cloud/retry.js";

describe("cloud/retry.js (Phase 4 D-11 stub)", () => {
  it("withRetry is a function", () => {
    expect(typeof withRetry).toBe("function");
  });

  it("withRetry invokes the wrapped fn exactly once and returns its result (pass-through)", async () => {
    const fn = vi.fn(async () => "ok");
    const out = await withRetry(fn);
    expect(out).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
