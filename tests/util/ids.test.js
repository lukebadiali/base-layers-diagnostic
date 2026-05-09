// tests/util/ids.test.js
// @ts-check
// Phase 2 (TEST-01): coverage of src/util/ids.js. Fake-timer aware via tests/setup.js.
import { describe, it, expect } from "vitest";
import {
  uid,
  iso,
  formatWhen,
  initials,
  firstNameFromAuthor,
} from "../../src/util/ids.js";

describe("iso", () => {
  it("returns the frozen test-time ISO string", () => {
    expect(iso()).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("uid (CODE-03 — crypto.randomUUID-backed)", () => {
  it("emits 11 hex chars from crypto.randomUUID with no prefix", () => {
    // Phase 4 (CODE-03 swap): uid now derives entropy from crypto.randomUUID()
    // rather than Math.random + Date.now. Shape = optional prefix + 11 hex chars
    // (lowercase 0-9a-f). tests/setup.js mocks crypto.randomUUID to a counter-
    // backed sentinel; the regex assertion is robust to any future setup change.
    expect(uid()).toMatch(/^[0-9a-f]{11}$/);
  });

  it("prefixes the result with the supplied prefix and emits 11 hex chars", () => {
    expect(uid("u_")).toMatch(/^u_[0-9a-f]{11}$/);
    expect(uid("org_")).toMatch(/^org_[0-9a-f]{11}$/);
  });

  it("derives entropy from crypto.randomUUID (not Math.random)", () => {
    // Verify uid actually invokes crypto.randomUUID by spying. The counter-backed
    // mock in tests/setup.js advances counter per call; the first 11 hex chars after
    // dash-stripping happen to be constant ("00000000000") because the counter only
    // varies in the trailing 12 hex digits — so we cannot use a !== b for uniqueness.
    // We assert the spy is invoked instead, which proves CODE-03 wiring.
    const before = /** @type {*} */ (crypto.randomUUID).mock.calls.length;
    uid();
    uid("p_");
    const after = /** @type {*} */ (crypto.randomUUID).mock.calls.length;
    expect(after - before).toBe(2);
  });
});

describe("formatWhen", () => {
  it("returns empty string for falsy input", () => {
    expect(formatWhen(null)).toBe("");
    expect(formatWhen(undefined)).toBe("");
    expect(formatWhen("")).toBe("");
    expect(formatWhen(0)).toBe("");
  });

  // Phase 4 Wave 6 (CODE-11): formatWhen now uses Math.floor instead of Math.round
  // so labels are monotonic-decreasing as time passes. 30 seconds floors to 0 minutes
  // → "just now" (was "1m ago" with Math.round). 20 seconds also floors to 0 → "just now".
  it.each([
    [20 * 1000, "just now"],            // 20s floors to 0 minutes → "just now"
    [10 * 60 * 1000, "10m ago"],        // 10 minutes (exact)
    [3 * 60 * 60 * 1000, "3h ago"],     // 3 hours (exact)
    [5 * 24 * 60 * 60 * 1000, "5d ago"], // 5 days (exact)
  ])("formats a timestamp %i ms in the past as '%s'", (ms, expected) => {
    expect(formatWhen(new Date(Date.now() - ms).toISOString())).toBe(expected);
  });

  it("falls back to toLocaleDateString for >7 days ago", () => {
    const out = formatWhen(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    // Must NOT match any relative pattern
    expect(out).not.toMatch(/just now|m ago|h ago|d ago/);
    expect(out.length).toBeGreaterThan(0);
  });

  // CODE-11 (Phase 4 Wave 6): monotonic-decreasing label assertion. With the
  // previous Math.round implementation, a 90s-old entry would render "2m ago"
  // then drift BACK to "1m ago" as it became 91s, 92s ... 119s old (because
  // Math.round flips at the .5 boundary). Math.floor keeps "1m ago" stable
  // until 120s elapses. Closes CONCERNS L4.
  it("uses Math.floor for the minute calculation (90s old → '1m ago', not '2m ago')", () => {
    const t0 = new Date(Date.now() - 90 * 1000).toISOString(); // 90 seconds old
    expect(formatWhen(t0)).toBe("1m ago"); // Math.floor(90/60) = 1
  });

  it("output is monotonic-decreasing across the minute boundary (CODE-11)", () => {
    // 60s, 90s, 119s — all floor to 1 minute → all render "1m ago".
    expect(formatWhen(new Date(Date.now() - 60 * 1000).toISOString())).toBe("1m ago");
    expect(formatWhen(new Date(Date.now() - 90 * 1000).toISOString())).toBe("1m ago");
    expect(formatWhen(new Date(Date.now() - 119 * 1000).toISOString())).toBe("1m ago");
    // 120s floors to 2 minutes → "2m ago" (label increased monotonically).
    expect(formatWhen(new Date(Date.now() - 120 * 1000).toISOString())).toBe("2m ago");
  });

  it("uses Math.floor for the hour calculation (89min old → '1h ago', not '1h ago' via round-up)", () => {
    // 89 minutes old: floor(89/60) = 1 → "1h ago". With Math.round, round(89/60) = 1 too,
    // so this case doesn't differ — but 90min old: floor(90/60) = 1 → "1h ago",
    // round(90/60) = 2 → "2h ago" (under round). Floor keeps "1h ago" stable through 119min.
    const t90 = new Date(Date.now() - 90 * 60 * 1000).toISOString();
    expect(formatWhen(t90)).toBe("1h ago"); // Math.floor(90/60) = 1
    const t119 = new Date(Date.now() - 119 * 60 * 1000).toISOString();
    expect(formatWhen(t119)).toBe("1h ago"); // Math.floor(119/60) = 1
  });

  it("uses Math.floor for the day calculation (36h old → '1d ago', not '2d ago')", () => {
    // 36 hours = 2160 minutes; floor(2160 / (60*24)) = 1 → "1d ago".
    // With Math.round: round(2160/1440) = round(1.5) = 2 → "2d ago".
    const t36h = new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString();
    expect(formatWhen(t36h)).toBe("1d ago"); // Math.floor(2160/1440) = 1
  });
});

describe("initials", () => {
  it.each([
    ["Luke Smith", "LS"],
    ["luke", "L"],
    ["", ""],
    ["Luke Skywalker Smith", "LS"], // slice(0, 2) keeps only first two
    ["  Luke   Smith  ", "LS"],     // collapses whitespace via /\s+/
  ])("initials(%j) returns %j", (input, expected) => {
    expect(initials(input)).toBe(expected);
  });

  it("uses default empty-string when called with no argument", () => {
    expect(initials()).toBe("");
  });
});

describe("firstNameFromAuthor", () => {
  it("uses authorName when present, taking the first whitespace-separated token", () => {
    expect(firstNameFromAuthor({ authorName: "Luke Smith" })).toBe("Luke");
    expect(firstNameFromAuthor({ authorName: "Luke" })).toBe("Luke");
  });

  it("falls back to authorEmail local-part split on .-_+ when authorName is missing", () => {
    expect(firstNameFromAuthor({ authorEmail: "luke.smith@example.com" })).toBe("Luke");
    expect(firstNameFromAuthor({ authorEmail: "foo+bar@x" })).toBe("Foo");
    expect(firstNameFromAuthor({ authorEmail: "alice-jones@x" })).toBe("Alice");
    expect(firstNameFromAuthor({ authorEmail: "bob_smith@x" })).toBe("Bob");
  });

  it("returns 'Unknown' when both authorName and authorEmail are absent or empty", () => {
    expect(firstNameFromAuthor({})).toBe("Unknown");
    expect(firstNameFromAuthor({ authorName: "", authorEmail: "" })).toBe("Unknown");
  });

  // Plan 02-06 (Wave 5) coverage back-fill: drive the defensive `|| ""` and
  // `if (first|piece)` short-circuit branches so the 100% src/util/** threshold
  // (D-15) holds. Each case targets a specific branch v8 reports uncovered.
  it("falls through to authorEmail when authorName is whitespace-only (no first token)", () => {
    // authorName.trim() yields "", so the name branch is skipped.
    expect(firstNameFromAuthor({ authorName: "   ", authorEmail: "alice@x" })).toBe("Alice");
  });

  it("returns 'Unknown' when authorEmail local-part has no usable piece (only delimiters)", () => {
    // local = ".-_+" → split(/[.\-_+]/)[0] === "" → piece falsy → falls through to "Unknown".
    expect(firstNameFromAuthor({ authorEmail: ".-_+@x" })).toBe("Unknown");
  });

  it("treats an at-prefixed email (no local part) as Unknown", () => {
    // local = "" → piece "" → "Unknown" (drives email branch but piece-empty subbranch).
    expect(firstNameFromAuthor({ authorEmail: "@x" })).toBe("Unknown");
  });
});
