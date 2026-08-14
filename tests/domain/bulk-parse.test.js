// tests/domain/bulk-parse.test.js
// @ts-check
// 2026-08 scope change: the delimiter rule for bulk list entry. The
// comma-inside-an-item cases are the ones that matter commercially — a blind
// comma split shreds "Document ICP, including firmographics and triggers" into
// two useless fragments and the user does not notice until review.
import { describe, it, expect } from "vitest";
import { parseBulkList, MAX_BULK_ITEMS } from "../../src/domain/bulk-parse.js";

describe("parseBulkList — line breaks win over commas", () => {
  it("splits a multi-line list and preserves commas inside items", () => {
    const pasted = [
      "Document ICP, including firmographics and triggers",
      "Build top 50 hit list",
      "Improve the properties on HubSpot",
    ].join("\n");
    expect(parseBulkList(pasted)).toEqual([
      "Document ICP, including firmographics and triggers",
      "Build top 50 hit list",
      "Improve the properties on HubSpot",
    ]);
  });

  it("handles CRLF and lone CR line endings", () => {
    expect(parseBulkList("One\r\nTwo\rThree")).toEqual(["One", "Two", "Three"]);
  });

  it("drops blank lines and trailing whitespace", () => {
    expect(parseBulkList("  One  \n\n\n   \nTwo\n")).toEqual(["One", "Two"]);
  });

  it("returns [] for empty, whitespace-only and non-string input", () => {
    expect(parseBulkList("")).toEqual([]);
    expect(parseBulkList("   \n\n  ")).toEqual([]);
    expect(parseBulkList(/** @type {*} */ (null))).toEqual([]);
    expect(parseBulkList(/** @type {*} */ (undefined))).toEqual([]);
    expect(parseBulkList(/** @type {*} */ (42))).toEqual([]);
  });
});

describe("parseBulkList — leading markers", () => {
  it.each([
    ["- Document ICP", "Document ICP"],
    ["-Document ICP", "Document ICP"],
    ["– Document ICP", "Document ICP"],
    ["— Document ICP", "Document ICP"],
    ["• Document ICP", "Document ICP"],
    ["* Document ICP", "Document ICP"],
    ["· Document ICP", "Document ICP"],
    ["  •  Document ICP  ", "Document ICP"],
    ["1. Document ICP", "Document ICP"],
    ["2) Document ICP", "Document ICP"],
    ["10. Document ICP", "Document ICP"],
  ])("strips %j -> %j", (input, expected) => {
    expect(parseBulkList(`${input}\nSecond item`)).toEqual([expected, "Second item"]);
  });

  it("leaves numbers that are part of the text alone", () => {
    expect(parseBulkList("1.5x pipeline coverage\n2026 revenue plan\n10x the hit list")).toEqual([
      "1.5x pipeline coverage",
      "2026 revenue plan",
      "10x the hit list",
    ]);
  });

  it("drops lines that are nothing but a marker", () => {
    expect(parseBulkList("- One\n-\n•\n- Two")).toEqual(["One", "Two"]);
  });
});

describe("parseBulkList — single-line input", () => {
  it("splits a single line on its commas", () => {
    expect(parseBulkList("Document ICP, hit list, HubSpot properties")).toEqual([
      "Document ICP",
      "hit list",
      "HubSpot properties",
    ]);
  });

  it("treats a single bulleted line as one item, commas intact", () => {
    expect(parseBulkList("- Document ICP, including firmographics")).toEqual([
      "Document ICP, including firmographics",
    ]);
  });

  it("splits a bullet-collapsed single line on its bullets", () => {
    expect(parseBulkList("• Document ICP, incl. triggers • Build hit list • Fix HubSpot")).toEqual([
      "Document ICP, incl. triggers",
      "Build hit list",
      "Fix HubSpot",
    ]);
  });

  it("keeps a plain single line with no comma as one item", () => {
    expect(parseBulkList("Build top 50 hit list")).toEqual(["Build top 50 hit list"]);
  });

  it("ignores empty comma fragments", () => {
    expect(parseBulkList("One,, Two, ,Three,")).toEqual(["One", "Two", "Three"]);
  });
});

describe("MAX_BULK_ITEMS", () => {
  it("is a sane positive cap the caller can enforce", () => {
    expect(MAX_BULK_ITEMS).toBe(200);
    const overflow = Array.from({ length: MAX_BULK_ITEMS + 5 }, (_, i) => `Item ${i}`).join("\n");
    // The parser itself never truncates — refusing the batch is the caller's job.
    expect(parseBulkList(overflow)).toHaveLength(MAX_BULK_ITEMS + 5);
  });
});
