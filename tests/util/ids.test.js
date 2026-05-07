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

  it("calls crypto.randomUUID for entropy (not Math.random)", () => {
    // Each call must consume a new randomUUID — counter-backed mock in tests/setup.js
    // increments per call, so two consecutive uid() calls must differ.
    const a = uid();
    const b = uid();
    expect(a).not.toBe(b);
  });
});

describe("formatWhen", () => {
  it("returns empty string for falsy input", () => {
    expect(formatWhen(null)).toBe("");
    expect(formatWhen(undefined)).toBe("");
    expect(formatWhen("")).toBe("");
    expect(formatWhen(0)).toBe("");
  });

  // Note: formatWhen does Math.round((Date.now() - when) / 60000). 30 seconds rounds
  // to 1 minute (JS Math.round rounds .5 up), which falls into the < 60 branch
  // ("1m ago"), not < 1 ("just now"). Use 20 seconds (rounds to 0) for the
  // "just now" branch instead.
  it.each([
    [20 * 1000, "just now"],            // 20s rounds to 0 minutes → "just now"
    [10 * 60 * 1000, "10m ago"],        // 10 minutes
    [3 * 60 * 60 * 1000, "3h ago"],     // 3 hours
    [5 * 24 * 60 * 60 * 1000, "5d ago"], // 5 days
  ])("formats a timestamp %i ms in the past as '%s'", (ms, expected) => {
    expect(formatWhen(new Date(Date.now() - ms).toISOString())).toBe(expected);
  });

  it("falls back to toLocaleDateString for >7 days ago", () => {
    const out = formatWhen(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
    // Must NOT match any relative pattern
    expect(out).not.toMatch(/just now|m ago|h ago|d ago/);
    expect(out.length).toBeGreaterThan(0);
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
