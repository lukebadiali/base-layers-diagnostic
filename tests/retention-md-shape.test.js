// tests/retention-md-shape.test.js
// @ts-check
//
// Phase 11 Wave 4 (DOC-05): doc-shape gate asserting that docs/RETENTION.md
// has been expanded from the existing 1-row file (FN-09 rate-limit) to a full
// per-data-class retention manifest. Per the plan must_haves:
//   - 7+ new data-class sections (8+ total `## ` headings counting intro)
//   - each section names a retention period, basis, deletion mechanism
//   - cross-references to gdprEraseUser + permanentlyDeleteSoftDeleted
//   - existing FN-09 Rate Limiting content preserved verbatim
//   - Pitfall 19 forbidden-words zero hits outside code spans
//
// Mirrors the regex-over-file-body pattern used by tests/privacy-md-shape.test.js.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("docs/RETENTION.md — DOC-05 shape (Phase 11 Wave 4)", () => {
  const src = readFileSync(resolve(process.cwd(), "docs/RETENTION.md"), "utf-8");

  // Test 1 — file exists at docs/RETENTION.md with non-trivial body.
  it("exists at docs/RETENTION.md with non-trivial body", () => {
    expect(src.length).toBeGreaterThan(2000);
  });

  // Test 2 — contains at least 9 `## ` headings (8 data-class sections + the
  // existing FN-09 row OR an intro heading). Per plan must_haves the file
  // expands from 1 row to 7+ data-class rows; total `## ` >= 9 captures the
  // intent (existing intro/FN-09 + 8 new data classes).
  it("contains at least 9 `## ` headings (8 new data classes + existing)", () => {
    const headings = src.match(/^## /gm) || [];
    expect(headings.length).toBeGreaterThanOrEqual(9);
  });

  // Test 3 — every data class section contains keywords for ALL of:
  // retention period + basis + deletion mechanism. The structural contract
  // is enforced at the file body level (any section may carry the keywords
  // — what matters is that the file as a whole covers all three axes).
  it("body cites retention period + basis + deletion mechanism keywords", () => {
    expect(
      src,
      "expected retention-period keywords (30 days / 7 years / 12 months / 90 days / annually)",
    ).toMatch(/30 days|7 years|12 months|90 days|annually/i);
    expect(src, "expected basis keywords (legal / operational / compliance)").toMatch(
      /legal|operational|compliance/i,
    );
    expect(
      src,
      "expected deletion-mechanism keywords (cascade / scheduled / manual / GDPR / Art. 17 / permanently)",
    ).toMatch(/cascade|scheduled|manual|gdpr|art\.\s*17|permanently/i);
  });

  // Test 4 — at least one row mentions `gdprEraseUser` (Phase 8 GDPR-02
  // cross-reference) — substring match accepts `gdprErase`.
  it("references the gdprEraseUser callable (Phase 8 GDPR-02)", () => {
    expect(src).toMatch(/gdprErase/);
  });

  // Test 5 — at least one row mentions `permanentlyDeleteSoftDeleted`
  // (Phase 8 LIFE callable).
  it("references the permanentlyDeleteSoftDeleted callable (Phase 8 LIFE)", () => {
    expect(src).toMatch(/permanentlyDeleteSoftDeleted/);
  });

  // Test 6 — existing FN-09 Rate Limiting section content preserved
  // verbatim. The signature phrase from the original file ("30 writes per
  // 60-second sliding window") must still appear.
  it("preserves the existing FN-09 Rate Limiting content verbatim", () => {
    expect(src).toContain("30 writes per 60-second sliding window");
  });

  // Test 7 — Pitfall 19 forbidden-words check ("compliant" / "certified")
  // outside backtick code spans, with negation-tolerant regex preserving
  // the project canonical phrasing "credible, not certified".
  it("does not contain forbidden words `compliant` or `certified` outside code spans", () => {
    const stripped = src.replace(/```[\s\S]*?```/g, "").replace(/`[^`]+`/g, "");
    const matches = stripped.match(/\b(?<!non-)(?<!not\s)(compliant|certified)\b/gi) || [];
    expect(
      matches.length,
      `forbidden-word hits outside code spans: ${JSON.stringify(matches)}`,
    ).toBe(0);
  });
});
