// tests/privacy-md-shape.test.js
// @ts-check
//
// Phase 11 Wave 2 (DOC-02): doc-shape gate asserting that PRIVACY.md at the
// repo root carries the canonical 7-section structure + the sub-processor
// table (exactly 2 rows: Google + Sentry; Google Fonts disclaimed) + the
// residency-section + DPA URLs + GDPR DSR flow + the Pitfall 19
// forbidden-words check ("compliant" / "certified" outside code spans).
//
// Mirrors the regex-over-file-body pattern used by tests/security-md-toc.test.js.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("PRIVACY.md — DOC-02 shape (Phase 11 Wave 2)", () => {
  const src = readFileSync(resolve(process.cwd(), "PRIVACY.md"), "utf-8");

  // Test 1 — file exists at repo root (the readFileSync above is the existence
  // probe; if the file is missing, vitest fails the entire describe block. We
  // also explicitly assert non-empty body to fail loudly on a stub file.)
  it("exists at repo root with non-trivial body", () => {
    expect(src.length).toBeGreaterThan(500);
  });

  // Test 2 — all 7 required `## N.` numbered sections present.
  it("contains all 7 required numbered sections (## 1. … ## 7.)", () => {
    const requiredHeadings = [
      /^## 1\. /m,
      /^## 2\. /m,
      /^## 3\. /m,
      /^## 4\. /m,
      /^## 5\. /m,
      /^## 6\. /m,
      /^## 7\. /m,
    ];
    for (const re of requiredHeadings) {
      expect(src, `missing section heading matching ${re}`).toMatch(re);
    }
  });

  // Slice helper — extract Section 2 (## 2. …) up to but not including ## 3.
  function sliceSection(srcText, sectionNumber) {
    const startMatch = srcText.match(new RegExp(`^## ${sectionNumber}\\. .*$`, "m"));
    if (!startMatch || startMatch.index === undefined) return "";
    const startIdx = startMatch.index;
    const afterStart = srcText.slice(startIdx + startMatch[0].length);
    const endMatch = afterStart.match(/^## \d+\. /m);
    if (!endMatch || endMatch.index === undefined) return afterStart;
    return afterStart.slice(0, endMatch.index);
  }

  // Test 3 — Sub-processors section has exactly 2 vendor rows (Google + Sentry).
  it("Section 2 sub-processor table contains exactly 2 vendor rows", () => {
    const section2 = sliceSection(src, 2);
    expect(section2.length).toBeGreaterThan(0);

    // Find the table block: contiguous lines starting with `|`.
    const tableLines = section2.split("\n").filter((line) => line.trim().startsWith("|"));

    // The table has: header row + delimiter row + N vendor rows.
    // Filter out delimiter rows (`|---|`-style).
    const dataLines = tableLines.filter((line) => !/^\|[\s:|-]+\|\s*$/.test(line.trim()));

    // dataLines = 1 header + 2 vendor rows = 3 total expected.
    // We assert vendor row count = total - 1 (header).
    const vendorRowCount = dataLines.length - 1;
    expect(vendorRowCount).toBe(2);
  });

  // Test 4 — Section 2 explicitly disclaims Google Fonts (positive form).
  it("Section 2 explicitly disclaims Google Fonts as a sub-processor", () => {
    const section2 = sliceSection(src, 2);
    expect(section2).toMatch(/Google Fonts/);
    // Match either "Not a sub-processor" or "no longer a sub-processor".
    expect(section2).toMatch(/Not a sub-processor|no longer a sub-processor/i);
  });

  // Test 5 — Section 3 cites `europe-west2` at least twice (Firestore + Functions).
  it("Section 3 cites `europe-west2` at least twice", () => {
    const section3 = sliceSection(src, 3);
    const matches = section3.match(/europe-west2/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  // Test 6 — Section 2 contains the verbatim DPA URLs.
  it("Section 2 contains verbatim DPA URLs (Google Cloud + Firebase + Sentry)", () => {
    const section2 = sliceSection(src, 2);
    expect(section2).toContain("https://cloud.google.com/terms/data-processing-addendum");
    expect(section2).toContain("https://firebase.google.com/terms/data-processing-terms");
    expect(section2).toContain("https://sentry.io/legal/dpa/");
  });

  // Test 7 — Section 5 cites both GDPR callable names + Art. 12(3) 30-day SLA.
  it("Section 5 cites gdprExportUser + gdprEraseUser callables + 30-day SLA", () => {
    const section5 = sliceSection(src, 5);
    expect(section5).toContain("gdprExportUser");
    expect(section5).toContain("gdprEraseUser");
    expect(section5).toMatch(/30 days/);
    expect(section5).toMatch(/Art\.\s*12\(3\)/);
  });

  // Test 8 — Pitfall 19 forbidden-words check ("compliant" / "certified")
  // outside backtick code spans.
  it("does not contain forbidden words `compliant` or `certified` outside code spans", () => {
    // Strip backtick code spans (single-line) and fenced code blocks.
    const stripped = src.replace(/```[\s\S]*?```/g, "").replace(/`[^`]+`/g, "");
    // Allow "non-certified" / "not certified" / "non-compliant" / "not compliant"
    // (the negation forms are acceptable; "credible, not certified" is the
    // canonical phrasing the project uses).
    const matches = stripped.match(/\b(?<!non-)(?<!not\s)(compliant|certified)\b/gi) || [];
    expect(
      matches.length,
      `forbidden-word hits outside code spans: ${JSON.stringify(matches)}`,
    ).toBe(0);
  });
});
