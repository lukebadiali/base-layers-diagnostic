// Phase 3 (HOST-05, FN-10): cover isDuplicate / markSeen — 5-min window + cross-fingerprint independence
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { isDuplicate, markSeen, fingerprint, _clearForTest } from "../../src/csp/dedup.js";
import type { NormalisedReport } from "../../src/csp/normalise.js";

const r: NormalisedReport = {
  blockedUri: "https://evil.example/x.js",
  violatedDirective: "script-src-elem",
  documentUri: "https://baselayers.bedeveloped.com/",
  disposition: "report-only",
};

beforeEach(() => {
  _clearForTest();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("dedup — 5-minute window (D-11)", () => {
  it("first occurrence is not a duplicate", () => {
    expect(isDuplicate(r)).toBe(false);
  });

  it("second occurrence at +4m59s is a duplicate", () => {
    markSeen(r);
    vi.advanceTimersByTime(4 * 60 * 1000 + 59_000);
    expect(isDuplicate(r)).toBe(true);
  });

  it("occurrence at +5m+1ms is NOT a duplicate", () => {
    markSeen(r);
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    expect(isDuplicate(r)).toBe(false);
  });
});

describe("dedup — cross-fingerprint independence", () => {
  it("different directive on same origin is not a duplicate within the window", () => {
    markSeen(r);
    vi.advanceTimersByTime(60_000);
    expect(isDuplicate({ ...r, violatedDirective: "style-src" })).toBe(false);
  });

  it("different origin on same directive is not a duplicate", () => {
    markSeen(r);
    vi.advanceTimersByTime(60_000);
    expect(isDuplicate({ ...r, blockedUri: "https://other.example/y.js" })).toBe(false);
  });
});

describe("fingerprint — origin normalisation (D-11)", () => {
  it("strips path and query from blockedUri", () => {
    const a = fingerprint({ ...r, blockedUri: "https://x.example/a/b?c=d" });
    const b = fingerprint({ ...r, blockedUri: "https://x.example/" });
    expect(a).toBe(b);
  });

  it("lowercases host and directive", () => {
    const a = fingerprint({ ...r, blockedUri: "https://X.EXAMPLE/", violatedDirective: "Script-Src" });
    const b = fingerprint({ ...r, blockedUri: "https://x.example/", violatedDirective: "script-src" });
    expect(a).toBe(b);
  });

  it("uses raw value when blockedUri is not a URL (e.g. inline)", () => {
    expect(() => fingerprint({ ...r, blockedUri: "inline" })).not.toThrow();
  });
});
