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

describe("uid", () => {
  it("returns a deterministic string under Math.random=0.5 + frozen Date.now", () => {
    // Both inputs are pinned by tests/setup.js — output must be stable across runs.
    // Pre-computed: (0.5).toString(36).slice(2,9) === "i"
    //               new Date("2026-01-01T00:00:00.000Z").getTime().toString(36).slice(-4) === "hs00"
    //               -> uid() === "ihs00"
    const a = uid();
    const b = uid();
    expect(a).toBe(b); // byte-identical inputs => byte-identical output (D-05 pinned)
    expect(a).toBe("ihs00");
    expect(typeof a).toBe("string");
  });

  it("prefixes the result with the supplied prefix", () => {
    expect(uid("u_").startsWith("u_")).toBe(true);
    expect(uid("org_").startsWith("org_")).toBe(true);
    // With pinned inputs, the suffix is deterministic too.
    expect(uid("u_")).toBe("u_ihs00");
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
});
